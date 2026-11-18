import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  UserCashbackConfiguration,
  UserCashbackConfigHistoryRecord,
  CashbackWalletSummary,
  CashbackLedgerTransaction,
  BookingCashbackRecord,
  UserBankAccount,
  CashbackWithdrawalRequest,
  CashbackPolicyConfig,
  CashbackAuditLogRecord,
  CashbackNotificationEvent,
  WithdrawalStatus
} from '../src/types';
import {
  roundMoney,
  roundPercent,
  validateCashbackPercentInput,
  resolveCashbackPresetType,
  computeCreditSchedule,
  calculateEligibleBookingComponents,
  isConfigEligibleForBooking,
  isBookingPaymentSatisfiedForCashback,
  evaluateDueForAutoCredit,
  maskAccountNumber,
  validateBankAccountInput,
  sanitizeBankAccountForDisplay,
  toMaskedBankSnapshot,
  canTransitionWithdrawalStatus,
  reconcileWalletFromLedger,
  normalizeDateYmd
} from '../src/services/cashbackEngine';
import {
  fromFirestoreDocument,
  toFirestoreFields
} from './marginGovernanceService';

// ============================================================================
// FIREBASE / FIRESTORE REST INFRASTRUCTURE
// ============================================================================

function getFirebaseConfig(): {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
} {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        projectId: parsed.projectId || 'gen-lang-client-0981426327',
        apiKey: parsed.apiKey || '',
        firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)'
      };
    }
  } catch (err) {
    console.warn('[CASHBACK-SVC] Could not read firebase-applet-config.json:', err);
  }
  return {
    projectId: 'gen-lang-client-0981426327',
    apiKey: '',
    firestoreDatabaseId: '(default)'
  };
}

function getFirestoreBaseUrl(): string {
  const cfg = getFirebaseConfig();
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
}

function getFirestoreDatabasePath(): string {
  const cfg = getFirebaseConfig();
  return `projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
}

export interface VerifiedCaller {
  uid: string;
  email: string;
  name: string;
  role: string;
  userDoc: Record<string, any> | null;
  idToken: string;
  isFinanceAdmin: boolean;
}

const MASTER_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

export function checkFinanceAdminAccess(userDoc: Record<string, any> | null, email: string): boolean {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (MASTER_ADMIN_EMAILS.has(cleanEmail)) return true;
  if (!userDoc) return false;
  const role = String(userDoc.role || userDoc.userType || '').toUpperCase();
  if (role === 'BUYER' || role === 'B2B_AGENT' || role === 'AGENT' || role === 'AGENCY_OWNER') {
    return false;
  }
  if (userDoc.approvalStatus && userDoc.approvalStatus !== 'APPROVED') {
    return false;
  }
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return true;
  }
  if (role === 'TEAM_MEMBER' || role === 'DMC_STAFF') {
    const perms = userDoc.permissions || {};
    return Boolean(
      perms.canAccessFinancials === true ||
      perms.cmsFinance?.cashbackManagement === true ||
      perms.cmsFinance?.financials === true ||
      perms.cmsFinance?.enabled === true
    );
  }
  return false;
}

async function verifyAuthenticatedCaller(
  req: Request,
  requireFinanceAdmin: boolean = false
): Promise<{ ok: true; caller: VerifiedCaller } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentication required: missing Bearer Firebase ID token.' };
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return { ok: false, status: 401, error: 'Authentication required: empty Firebase ID token.' };
  }

  const cfg = getFirebaseConfig();
  if (!cfg.apiKey) {
    return { ok: false, status: 500, error: 'Server Firebase configuration missing apiKey.' };
  }

  let uid = '';
  let email = '';
  let displayName = '';

  try {
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(5000)
      }
    );
    if (!lookupRes.ok) {
      return { ok: false, status: 401, error: 'Invalid or expired Firebase authentication token.' };
    }
    const lookupJson = (await lookupRes.json()) as any;
    const fbUser = Array.isArray(lookupJson.users) ? lookupJson.users[0] : null;
    if (!fbUser || !fbUser.localId || fbUser.disabled) {
      return { ok: false, status: 401, error: 'Authenticated Firebase user account not found or disabled.' };
    }
    uid = fbUser.localId;
    email = (fbUser.email || '').trim().toLowerCase();
    displayName = fbUser.displayName || '';
  } catch (err: any) {
    return { ok: false, status: 503, error: `Unable to verify Firebase Auth token: ${err?.message || 'network error'}` };
  }

  let userDoc: Record<string, any> | null = null;
  try {
    const userRes = await fetch(`${getFirestoreBaseUrl()}/users/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(5000)
    });
    if (userRes.ok) {
      const rawUserDoc = await userRes.json();
      userDoc = fromFirestoreDocument(rawUserDoc);
    }
  } catch {
    // Profile doc may not exist yet for newly minted accounts
  }

  const isFinanceAdmin = checkFinanceAdminAccess(userDoc, email);
  if (requireFinanceAdmin && !isFinanceAdmin) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Only authorized Administrators or Finance Managers can access Cashback Management.'
    };
  }

  return {
    ok: true,
    caller: {
      uid,
      email: email || userDoc?.email || '',
      name: userDoc?.name || userDoc?.displayName || displayName || email || 'User',
      role: String(userDoc?.role || (MASTER_ADMIN_EMAILS.has(email) ? 'ADMIN' : 'B2B_AGENT')).toUpperCase(),
      userDoc,
      idToken,
      isFinanceAdmin
    }
  };
}

let cachedMetadataToken: { token: string; expiresAtMs: number } | null = null;

async function getGoogleCloudAccessToken(): Promise<string | null> {
  if (cachedMetadataToken && Date.now() < cachedMetadataToken.expiresAtMs - 60_000) {
    return cachedMetadataToken.token;
  }
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(1500)
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    if (json?.access_token) {
      cachedMetadataToken = {
        token: json.access_token,
        expiresAtMs: Date.now() + Number(json.expires_in || 3000) * 1000
      };
      return json.access_token;
    }
  } catch {
    // Expected in local sandbox without GCP metadata server
  }
  return null;
}

async function fsGet(docPath: string, token: string, transaction?: string): Promise<{ exists: boolean; data: Record<string, any> | null }> {
  const txQuery = transaction ? `?transaction=${encodeURIComponent(transaction)}` : '';
  const url = `${getFirestoreBaseUrl()}/${docPath}${txQuery}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000)
  });
  if (res.status === 404) return { exists: false, data: null };
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore read failed for ${docPath} (${res.status}): ${errText}`);
  }
  return { exists: true, data: fromFirestoreDocument(await res.json()) };
}

async function fsList(
  collectionPath: string,
  token: string,
  maxDocs = 1000,
  whereUserId?: string
): Promise<Record<string, any>[]> {
  const segs = collectionPath.split('/').filter(Boolean);
  if (segs.length === 0) return [];
  const collectionId = segs[segs.length - 1];
  const parentSegs = segs.slice(0, -1).map((s) => decodeURIComponent(s)).map((s) => encodeURIComponent(s));
  const queryUrl = parentSegs.length > 0
    ? `${getFirestoreBaseUrl()}/${parentSegs.join('/')}:runQuery`
    : `${getFirestoreBaseUrl()}:runQuery`;

  if (whereUserId) {
    const structuredQuery: Record<string, any> = {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: whereUserId }
        }
      },
      limit: maxDocs
    };
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ structuredQuery }),
      signal: AbortSignal.timeout(8000)
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Firestore list failed for ${collectionPath} (${res.status}): ${errText}`);
    }
    const rows = (await res.json()) as any[];
    const out: Record<string, any>[] = [];
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row && row.document) {
          const parsed = fromFirestoreDocument(row.document);
          if (parsed) out.push(parsed);
        }
      }
    }
    return out;
  }

  const out: Record<string, any>[] = [];
  let lastDocName = '';
  const pageSize = Math.min(300, Math.max(1, maxDocs));

  while (out.length < maxDocs) {
    const remaining = maxDocs - out.length;
    const structuredQuery: Record<string, any> = {
      from: [{ collectionId }],
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: Math.min(pageSize, remaining)
    };
    if (lastDocName) {
      structuredQuery.startAt = {
        values: [{ referenceValue: lastDocName }],
        before: false
      };
    }

    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ structuredQuery }),
      signal: AbortSignal.timeout(8000)
    });
    if (res.status === 404) return out;
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Firestore list failed for ${collectionPath} (${res.status}): ${errText}`);
    }

    const rows = (await res.json()) as any[];
    if (!Array.isArray(rows) || rows.length === 0) break;

    let batchDocsCount = 0;
    let newestDocName = '';
    for (const row of rows) {
      if (row && row.document) {
        batchDocsCount += 1;
        newestDocName = row.document.name || newestDocName;
        const parsed = fromFirestoreDocument(row.document);
        if (parsed) out.push(parsed);
      }
    }

    if (batchDocsCount < Math.min(pageSize, remaining) || !newestDocName || newestDocName === lastDocName) {
      break;
    }
    lastDocName = newestDocName;
  }

  return out;
}

async function fsCommitWrites(token: string, writes: any[], transaction?: string): Promise<void> {
  if (writes.length === 0) return;
  const body: Record<string, any> = { writes };
  if (transaction) body.transaction = transaction;
  const res = await fetch(`${getFirestoreBaseUrl()}:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw Object.assign(new Error(`Firestore commit failed (${res.status}): ${errText}`), { httpStatus: res.status });
  }
}

async function fsBeginTx(token: string): Promise<string> {
  const res = await fetch(`${getFirestoreBaseUrl()}:beginTransaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ options: { readWrite: {} } }),
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) {
    throw new Error(`Failed to begin Firestore transaction (${res.status})`);
  }
  const json = (await res.json()) as { transaction: string };
  return json.transaction;
}

async function fsRollbackTx(token: string, transaction: string): Promise<void> {
  await fetch(`${getFirestoreBaseUrl()}:rollback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ transaction }),
    signal: AbortSignal.timeout(3000)
  }).catch(() => {});
}

// ============================================================================
// DEFAULT POLICY & SCHEDULER TELEMETRY
// ============================================================================

export function buildDefaultCashbackPolicy(): CashbackPolicyConfig {
  return {
    id: 'cashback_policy',
    creditDelayDays: 3,
    defaultCurrency: 'INR',
    minWithdrawalAmount: 500,
    maxWithdrawalAmount: 500000,
    requireFullPaymentBeforeCredit: false,
    requireConfirmedBookingStatus: true,
    allowWithdrawalOnlyWhenActive: true,
    showCashbackTabToIneligibleUsers: false,
    holdOnDispute: true,
    maxCashbackPercentCeiling: 25,
    eligibleComponents: {
      baseProductSellPrice: true,
      hotels: false,
      transfers: true,
      activities: true,
      tours: true,
      visas: true,
      packages: true,
      includeTaxes: false,
      includeServiceFees: false,
      includeSurcharges: false,
      deductDiscounts: true
    },
    updatedAt: new Date().toISOString(),
    updatedByUid: 'system',
    updatedByName: 'TheUnbound Finance Governance',
    version: 1
  };
}

export interface CashbackSchedulerTelemetry {
  lastRunAt: string | null;
  lastRunSource: 'STARTUP' | 'INTERVAL' | 'MANUAL_ADMIN' | 'SYSTEM_HOOK' | null;
  lastCreditedCount: number;
  lastHeldCount: number;
  lastCancelledCount: number;
  lastSkippedCount: number;
  lastError: string | null;
  totalBatchesExecuted: number;
}

const schedulerTelemetry: CashbackSchedulerTelemetry = {
  lastRunAt: null,
  lastRunSource: null,
  lastCreditedCount: 0,
  lastHeldCount: 0,
  lastCancelledCount: 0,
  lastSkippedCount: 0,
  lastError: null,
  totalBatchesExecuted: 0
};

export function getCashbackSchedulerTelemetry(): CashbackSchedulerTelemetry {
  return { ...schedulerTelemetry };
}

function stripSensitiveBookingFieldsForUser(record: Record<string, any>): Record<string, any> {
  const {
    internalNettCost,
    supplierCost,
    internalProfit,
    internalMargin,
    internalMarkup,
    ...safe
  } = record || {};
  return safe;
}

// ============================================================================
// AUTONOMOUS BACKGROUND AUTO-CREDITING JOB (SERVER-SIDE FIRESTORE BATCH)
// ============================================================================

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerRunning = false;

export async function runServerScheduledCashbackCreditingBatch(options?: {
  token?: string;
  nowIsoOverride?: string;
  source?: CashbackSchedulerTelemetry['lastRunSource'];
}): Promise<{
  ok: boolean;
  executedWithToken: boolean;
  creditedCount: number;
  heldCount: number;
  cancelledCount: number;
  skippedCount: number;
  creditedBookingIds: string[];
  errors: string[];
}> {
  if (schedulerRunning) {
    return {
      ok: true,
      executedWithToken: false,
      creditedCount: 0,
      heldCount: 0,
      cancelledCount: 0,
      skippedCount: 0,
      creditedBookingIds: [],
      errors: []
    };
  }
  schedulerRunning = true;
  const nowIso = options?.nowIsoOverride || new Date().toISOString();
  const creditedBookingIds: string[] = [];
  const errors: string[] = [];
  let creditedCount = 0;
  let heldCount = 0;
  let cancelledCount = 0;
  let skippedCount = 0;

  try {
    const token = options?.token || (await getGoogleCloudAccessToken());
    if (!token) {
      schedulerTelemetry.lastRunAt = nowIso;
      schedulerTelemetry.lastRunSource = options?.source || 'INTERVAL';
      schedulerTelemetry.totalBatchesExecuted += 1;
      return {
        ok: true,
        executedWithToken: false,
        creditedCount: 0,
        heldCount: 0,
        cancelledCount: 0,
        skippedCount: 0,
        creditedBookingIds: [],
        errors: []
      };
    }

    const [policySnap, recordsRaw, bookingsRaw, configsRaw, allTxRaw] = await Promise.all([
      fsGet('system_settings/cashback_policy', token).catch(() => ({ exists: false, data: null })),
      fsList('booking_cashback_records', token, 2000).catch(() => []),
      fsList('bookings', token, 2000).catch(() => []),
      fsList('cashback_user_configs', token, 2000).catch(() => []),
      fsList('cashback_ledger_transactions', token, 5000).catch(() => [])
    ]);

    const rawPolicy: CashbackPolicyConfig = policySnap.exists && policySnap.data
      ? ({ ...buildDefaultCashbackPolicy(), ...policySnap.data } as CashbackPolicyConfig)
      : buildDefaultCashbackPolicy();
    const policy: CashbackPolicyConfig = {
      ...rawPolicy,
      eligibleComponents: {
        ...buildDefaultCashbackPolicy().eligibleComponents,
        ...(rawPolicy.eligibleComponents || {}),
        hotels: false
      }
    };

    const bookingById = new Map<string, Record<string, any>>();
    bookingsRaw.forEach((b) => {
      if (b?.id) bookingById.set(b.id, b);
    });

    const configByUid = new Map<string, UserCashbackConfiguration>();
    configsRaw.forEach((c) => {
      if (c?.userId) configByUid.set(c.userId, c as UserCashbackConfiguration);
    });

    const existingIdempotencyKeys = new Set<string>();
    const txsByUser = new Map<string, CashbackLedgerTransaction[]>();
    allTxRaw.forEach((t) => {
      const tx = t as CashbackLedgerTransaction;
      if (tx.idempotencyKey) existingIdempotencyKeys.add(tx.idempotencyKey);
      const list = txsByUser.get(tx.userId) || [];
      list.push(tx);
      txsByUser.set(tx.userId, list);
    });

    const dbPath = getFirestoreDatabasePath();

    for (const rawRec of recordsRaw) {
      const rec = rawRec as BookingCashbackRecord;
      if (rec.status !== 'PENDING' && rec.status !== 'HELD') {
        continue;
      }

      const booking = bookingById.get(rec.bookingId);
      const userConfig = configByUid.get(rec.userId) || null;
      const decision = evaluateDueForAutoCredit({
        record: rec,
        booking: booking as any,
        policy,
        userConfig,
        nowIso
      });

      if (decision.action === 'WAIT') {
        skippedCount += 1;
        continue;
      }

      const idempotencyKey = `credit:${rec.bookingId}:${rec.id}`;
      if (decision.action === 'CREDIT' && existingIdempotencyKeys.has(idempotencyKey)) {
        skippedCount += 1;
        continue;
      }

      const tx = await fsBeginTx(token);
      try {
        const freshRecSnap = await fsGet(`booking_cashback_records/${encodeURIComponent(rec.id)}`, token, tx);
        const freshRec = freshRecSnap.data as BookingCashbackRecord | null;
        if (!freshRec || (freshRec.status !== 'PENDING' && freshRec.status !== 'HELD')) {
          await fsRollbackTx(token, tx);
          skippedCount += 1;
          continue;
        }

        if (decision.action === 'CREDIT') {
          const deterministicTxId = `CBTX-CRED-${rec.id}`;
          const txExistsSnap = await fsGet(`cashback_ledger_transactions/${encodeURIComponent(deterministicTxId)}`, token, tx);
          if (txExistsSnap.exists) {
            await fsRollbackTx(token, tx);
            skippedCount += 1;
            continue;
          }

          const creditAmount = roundMoney(freshRec.remainingCashbackAmount ?? freshRec.cashbackAmount);
          if (creditAmount <= 0) {
            await fsRollbackTx(token, tx);
            skippedCount += 1;
            continue;
          }

          const userTxs = [...(txsByUser.get(freshRec.userId) || [])];
          const ledgerTx: CashbackLedgerTransaction = {
            id: deterministicTxId,
            userId: freshRec.userId,
            agencyId: freshRec.agencyId,
            type: 'CASHBACK_CREDIT',
            direction: 'CREDIT',
            amount: creditAmount,
            currency: freshRec.currency,
            balanceAfterAvailable: 0,
            bookingId: freshRec.bookingId,
            bookingReference: freshRec.bookingReference,
            bookingCashbackRecordId: freshRec.id,
            idempotencyKey,
            description: `Automatic cashback credit (+${freshRec.cashbackPercent}%) for booking ${freshRec.bookingReference} completed on ${freshRec.travelEndDate} (+${policy.creditDelayDays}d).`,
            createdAt: nowIso,
            createdByUid: 'system-scheduler',
            createdByName: 'Automated Cashback Scheduler'
          };
          userTxs.unshift(ledgerTx);
          const nextWallet = reconcileWalletFromLedger({
            userId: freshRec.userId,
            defaultCurrency: policy.defaultCurrency,
            ledgerTransactions: userTxs,
            bookingRecords: recordsRaw.map((r) =>
              r.id === freshRec.id
                ? ({ ...freshRec, status: 'CREDITED', creditedAt: nowIso, creditLedgerTransactionId: deterministicTxId } as BookingCashbackRecord)
                : (r as BookingCashbackRecord)
            ),
            nowIso
          });
          const bucket = nextWallet.balancesByCurrency[freshRec.currency];
          ledgerTx.balanceAfterAvailable = bucket ? bucket.availableBalance : creditAmount;

          const updatedRec: BookingCashbackRecord = {
            ...freshRec,
            status: 'CREDITED',
            holdReason: undefined,
            creditedAt: nowIso,
            creditLedgerTransactionId: deterministicTxId,
            updatedAt: nowIso
          };

          const notifId = `CBNOTIF-CRED-${freshRec.id}`;
          const notif: CashbackNotificationEvent = {
            id: notifId,
            userId: freshRec.userId,
            type: 'CASHBACK_CREDITED',
            title: 'Cashback Credited to Wallet',
            message: `${freshRec.currency} ${creditAmount.toLocaleString()} cashback for booking ${freshRec.bookingReference} has been credited and is now available for withdrawal.`,
            bookingId: freshRec.bookingId,
            bookingReference: freshRec.bookingReference,
            amount: creditAmount,
            currency: freshRec.currency,
            deduplicationKey: `credited:${freshRec.bookingId}:${freshRec.id}`,
            isRead: false,
            createdAt: nowIso
          };

          const auditId = `CBAUD-CRED-${freshRec.id}`;
          const audit: CashbackAuditLogRecord = {
            id: auditId,
            action: 'CASHBACK_CREDITED',
            actorUid: 'system-scheduler',
            actorName: 'Automated Cashback Scheduler',
            actorRole: 'SYSTEM',
            targetUserId: freshRec.userId,
            entityType: 'BOOKING_CASHBACK',
            entityId: freshRec.id,
            bookingId: freshRec.bookingId,
            bookingReference: freshRec.bookingReference,
            amount: creditAmount,
            currency: freshRec.currency,
            summary: `Automatically credited ${freshRec.currency} ${creditAmount} to user ${freshRec.userId} for booking ${freshRec.bookingReference}.`,
            timestamp: nowIso
          };

          await fsCommitWrites(
            token,
            [
              {
                update: {
                  name: `${dbPath}/cashback_ledger_transactions/${deterministicTxId}`,
                  fields: toFirestoreFields(ledgerTx)
                },
                currentDocument: { exists: false }
              },
              {
                update: {
                  name: `${dbPath}/users/${freshRec.userId}/cashback/transactions/items/${deterministicTxId}`,
                  fields: toFirestoreFields(ledgerTx)
                }
              },
              {
                update: {
                  name: `${dbPath}/booking_cashback_records/${freshRec.id}`,
                  fields: toFirestoreFields(updatedRec)
                }
              },
              {
                update: {
                  name: `${dbPath}/bookings/${freshRec.bookingId}/cashback/${freshRec.id}`,
                  fields: toFirestoreFields(updatedRec)
                }
              },
              {
                update: {
                  name: `${dbPath}/cashback_wallets/${freshRec.userId}`,
                  fields: toFirestoreFields(nextWallet)
                }
              },
              {
                update: {
                  name: `${dbPath}/users/${freshRec.userId}/cashback/wallet`,
                  fields: toFirestoreFields(nextWallet)
                }
              },
              {
                update: {
                  name: `${dbPath}/cashback_notifications/${notifId}`,
                  fields: toFirestoreFields(notif)
                }
              },
              {
                update: {
                  name: `${dbPath}/cashback_audit_logs/${auditId}`,
                  fields: toFirestoreFields(audit)
                }
              }
            ],
            tx
          );

          txsByUser.set(freshRec.userId, userTxs);
          existingIdempotencyKeys.add(idempotencyKey);
          creditedCount += 1;
          creditedBookingIds.push(freshRec.bookingId);
        } else if (decision.action === 'HOLD' && freshRec.status !== 'HELD') {
          const updatedRec: BookingCashbackRecord = {
            ...freshRec,
            status: 'HELD',
            holdReason: decision.reason,
            updatedAt: nowIso
          };
          await fsCommitWrites(
            token,
            [
              {
                update: {
                  name: `${dbPath}/booking_cashback_records/${freshRec.id}`,
                  fields: toFirestoreFields(updatedRec)
                }
              },
              {
                update: {
                  name: `${dbPath}/bookings/${freshRec.bookingId}/cashback/${freshRec.id}`,
                  fields: toFirestoreFields(updatedRec)
                }
              }
            ],
            tx
          );
          heldCount += 1;
        } else if (decision.action === 'CANCEL') {
          const updatedRec: BookingCashbackRecord = {
            ...freshRec,
            status: 'CANCELLED',
            holdReason: decision.reason,
            cancelledAt: nowIso,
            updatedAt: nowIso
          };
          await fsCommitWrites(
            token,
            [
              {
                update: {
                  name: `${dbPath}/booking_cashback_records/${freshRec.id}`,
                  fields: toFirestoreFields(updatedRec)
                }
              },
              {
                update: {
                  name: `${dbPath}/bookings/${freshRec.bookingId}/cashback/${freshRec.id}`,
                  fields: toFirestoreFields(updatedRec)
                }
              }
            ],
            tx
          );
          cancelledCount += 1;
        } else {
          await fsRollbackTx(token, tx);
          skippedCount += 1;
        }
      } catch (innerErr: any) {
        await fsRollbackTx(token, tx);
        errors.push(`Record ${rec.id}: ${innerErr?.message || 'error'}`);
      }
    }

    schedulerTelemetry.lastRunAt = nowIso;
    schedulerTelemetry.lastRunSource = options?.source || 'INTERVAL';
    schedulerTelemetry.lastCreditedCount = creditedCount;
    schedulerTelemetry.lastHeldCount = heldCount;
    schedulerTelemetry.lastCancelledCount = cancelledCount;
    schedulerTelemetry.lastSkippedCount = skippedCount;
    schedulerTelemetry.lastError = errors.length > 0 ? errors.join('; ') : null;
    schedulerTelemetry.totalBatchesExecuted += 1;

    return {
      ok: true,
      executedWithToken: true,
      creditedCount,
      heldCount,
      cancelledCount,
      skippedCount,
      creditedBookingIds,
      errors
    };
  } catch (err: any) {
    schedulerTelemetry.lastRunAt = nowIso;
    schedulerTelemetry.lastError = err?.message || 'Batch error';
    return {
      ok: false,
      executedWithToken: false,
      creditedCount,
      heldCount,
      cancelledCount,
      skippedCount,
      creditedBookingIds,
      errors: [err?.message || 'Batch execution failed']
    };
  } finally {
    schedulerRunning = false;
  }
}

export function startCashbackScheduler(): void {
  if (schedulerTimer) return;
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  setTimeout(() => {
    runServerScheduledCashbackCreditingBatch({ source: 'STARTUP' }).catch(() => {});
  }, 15_000);
  schedulerTimer = setInterval(() => {
    runServerScheduledCashbackCreditingBatch({ source: 'INTERVAL' }).catch(() => {});
  }, FIVE_MINUTES_MS);
  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }
}

// ============================================================================
// EXPRESS ROUTER: USER CASHBACK PORTAL (/api/cashback)
// ============================================================================

export function createCashbackRouter(): Router {
  const router = Router();

  // Enforce authentication & self-only access for user endpoints
  router.get('/me', async (req: Request, res: Response): Promise<void> => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!auth.ok) {
      const err = auth as Extract<typeof auth, { ok: false }>;
      res.status(err.status).json({ success: false, error: err.error });
      return;
    }

    try {
      const { caller } = auth;
      const [cfgSnap, policySnap, bankList, txs, bookingRecs, withdrawals, notifs] = await Promise.all([
        fsGet(`cashback_user_configs/${encodeURIComponent(caller.uid)}`, caller.idToken).catch(() => ({ exists: false, data: null })),
        fsGet('system_settings/cashback_policy', caller.idToken).catch(() => ({ exists: false, data: null })),
        fsList(`users/${encodeURIComponent(caller.uid)}/bankAccounts`, caller.idToken, 100).catch(() => []),
        fsList(`users/${encodeURIComponent(caller.uid)}/cashback/transactions/items`, caller.idToken, 1000).catch(() => []),
        fsList('booking_cashback_records', caller.idToken, 1000, caller.uid).catch(() => []),
        fsList('cashbackWithdrawalRequests', caller.idToken, 1000, caller.uid).catch(() => []),
        fsList('cashback_notifications', caller.idToken, 500, caller.uid).catch(() => [])
      ]);

      const rawPolicy = policySnap.exists && policySnap.data
        ? ({ ...buildDefaultCashbackPolicy(), ...policySnap.data } as CashbackPolicyConfig)
        : buildDefaultCashbackPolicy();
      const policy: CashbackPolicyConfig = {
        ...rawPolicy,
        eligibleComponents: {
          ...buildDefaultCashbackPolicy().eligibleComponents,
          ...(rawPolicy.eligibleComponents || {}),
          hotels: false
        }
      };

      const myBookingRecords = (bookingRecs as BookingCashbackRecord[])
        .filter((r) => r.userId === caller.uid)
        .map(stripSensitiveBookingFieldsForUser);

      const myWithdrawals = (withdrawals as CashbackWithdrawalRequest[])
        .filter((w) => w.userId === caller.uid);

      const myNotifs = (notifs as CashbackNotificationEvent[])
        .filter((n) => n.userId === caller.uid);

      const wallet = reconcileWalletFromLedger({
        userId: caller.uid,
        defaultCurrency: policy.defaultCurrency,
        ledgerTransactions: txs as CashbackLedgerTransaction[],
        bookingRecords: myBookingRecords as BookingCashbackRecord[]
      });

      const safeBankAccounts = (bankList as UserBankAccount[]).map((acc) => sanitizeBankAccountForDisplay(acc));

      res.status(200).json({
        success: true,
        configuration: cfgSnap.data || null,
        wallet,
        transactions: txs,
        bookingRecords: myBookingRecords,
        bankAccounts: safeBankAccounts,
        withdrawals: myWithdrawals,
        notifications: myNotifs,
        policy: {
          creditDelayDays: policy.creditDelayDays,
          defaultCurrency: policy.defaultCurrency,
          minWithdrawalAmount: policy.minWithdrawalAmount,
          maxWithdrawalAmount: policy.maxWithdrawalAmount,
          allowWithdrawalOnlyWhenActive: policy.allowWithdrawalOnlyWhenActive,
          showCashbackTabToIneligibleUsers: policy.showCashbackTabToIneligibleUsers
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to load user cashback wallet.' });
    }
  });

  // Add or Update Bank Account (strictly bound to caller.uid)
  router.post('/bank-accounts', async (req: Request, res: Response): Promise<void> => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!auth.ok) {
      const err = auth as Extract<typeof auth, { ok: false }>;
      res.status(err.status).json({ success: false, error: err.error });
      return;
    }

    const body = req.body || {};
    if (body.userId && body.userId !== auth.caller.uid) {
      res.status(403).json({ success: false, error: 'Forbidden: Cannot add a bank account for another user.' });
      return;
    }

    const validation = validateBankAccountInput(body);
    if (!validation.valid) {
      res.status(400).json({ success: false, error: validation.errors.join(' ') });
      return;
    }

    try {
      const { caller } = auth;
      const nowIso = new Date().toISOString();
      const accountId = body.id ? String(body.id).replace(/[^a-zA-Z0-9_-]/g, '') : `BANK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const existingBanks = (await fsList(`users/${encodeURIComponent(caller.uid)}/bankAccounts`, caller.idToken, 50).catch(() => [])) as UserBankAccount[];

      const cleanAcctNumber = String(body.accountNumber || '').replace(/\s+/g, '');
      const masked = maskAccountNumber(cleanAcctNumber);
      const isFirst = existingBanks.length === 0;
      const isDefault = body.isDefault === true || isFirst;

      const bankDoc: UserBankAccount = {
        id: accountId,
        userId: caller.uid,
        accountHolderName: String(body.accountHolderName).trim(),
        bankName: String(body.bankName).trim(),
        branchName: String(body.branchName || '').trim() || undefined,
        accountNumberMasked: masked,
        accountNumberLast4: cleanAcctNumber.slice(-4),
        accountNumberStored: cleanAcctNumber,
        accountType: body.accountType === 'SAVINGS' || body.accountType === 'CURRENT' ? body.accountType : 'CURRENT',
        ifscCode: body.ifscCode ? String(body.ifscCode).trim().toUpperCase() : undefined,
        swiftCode: body.swiftCode ? String(body.swiftCode).trim().toUpperCase() : undefined,
        iban: body.iban ? String(body.iban).trim().toUpperCase() : undefined,
        country: String(body.country || 'India').trim(),
        currency: String(body.currency || 'INR').trim().toUpperCase(),
        isDefault,
        isVerified: true,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const dbPath = getFirestoreDatabasePath();
      const writes: any[] = [
        {
          update: {
            name: `${dbPath}/users/${caller.uid}/bankAccounts/${accountId}`,
            fields: toFirestoreFields(bankDoc)
          }
        },
        {
          update: {
            name: `${dbPath}/user_bank_accounts/${accountId}`,
            fields: toFirestoreFields(bankDoc)
          }
        }
      ];

      if (isDefault) {
        for (const other of existingBanks) {
          if (other.id !== accountId && other.isDefault) {
            writes.push({
              updateMask: { fieldPaths: ['isDefault', 'updatedAt'] },
              update: {
                name: `${dbPath}/users/${caller.uid}/bankAccounts/${other.id}`,
                fields: toFirestoreFields({ isDefault: false, updatedAt: nowIso })
              }
            });
            writes.push({
              updateMask: { fieldPaths: ['isDefault', 'updatedAt'] },
              update: {
                name: `${dbPath}/user_bank_accounts/${other.id}`,
                fields: toFirestoreFields({ isDefault: false, updatedAt: nowIso })
              }
            });
          }
        }
      }

      const auditId = `CBAUD-BANK-${Date.now()}`;
      writes.push({
        update: {
          name: `${dbPath}/cashback_audit_logs/${auditId}`,
          fields: toFirestoreFields({
            id: auditId,
            action: 'BANK_ACCOUNT_ADDED',
            actorUid: caller.uid,
            actorName: caller.name,
            actorRole: caller.role,
            targetUserId: caller.uid,
            entityType: 'BANK_ACCOUNT',
            entityId: accountId,
            summary: `Saved bank account ${bankDoc.bankName} (${masked}).`,
            timestamp: nowIso
          } as CashbackAuditLogRecord)
        }
      });

      await fsCommitWrites(caller.idToken, writes);
      res.status(200).json({
        success: true,
        bankAccount: sanitizeBankAccountForDisplay(bankDoc)
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to save bank account.' });
    }
  });

  // Submit Cashback Withdrawal Request (atomic ledger hold)
  router.post('/withdrawals', async (req: Request, res: Response): Promise<void> => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!auth.ok) {
      const err = auth as Extract<typeof auth, { ok: false }>;
      res.status(err.status).json({ success: false, error: err.error });
      return;
    }

    const body = req.body || {};
    if (body.userId && body.userId !== auth.caller.uid) {
      res.status(403).json({ success: false, error: 'Forbidden: Cannot submit withdrawal on behalf of another user.' });
      return;
    }

    const rawAmount = Number(body.requestedAmount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      res.status(400).json({ success: false, error: 'Withdrawal amount must be a positive number.' });
      return;
    }
    const requestedAmount = roundMoney(rawAmount);
    const currency = String(body.currency || 'INR').trim().toUpperCase();
    const bankAccountId = String(body.bankAccountId || '').trim();
    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey).trim() : `wd:${auth.caller.uid}:${Date.now()}`;

    if (!bankAccountId) {
      res.status(400).json({ success: false, error: 'Please select a verified bank account for payout.' });
      return;
    }

    try {
      const { caller } = auth;
      const nowIso = new Date().toISOString();

      const [cfgSnap, policySnap, bankSnap, existingTxs, existingWithdrawals] = await Promise.all([
        fsGet(`cashback_user_configs/${encodeURIComponent(caller.uid)}`, caller.idToken).catch(() => ({ exists: false, data: null })),
        fsGet('system_settings/cashback_policy', caller.idToken).catch(() => ({ exists: false, data: null })),
        fsGet(`users/${encodeURIComponent(caller.uid)}/bankAccounts/${encodeURIComponent(bankAccountId)}`, caller.idToken),
        fsList(`users/${encodeURIComponent(caller.uid)}/cashback/transactions/items`, caller.idToken, 2000).catch(() => []),
        fsList('cashbackWithdrawalRequests', caller.idToken, 1000, caller.uid).catch(() => [])
      ]);

      const rawPolicy = policySnap.exists && policySnap.data
        ? ({ ...buildDefaultCashbackPolicy(), ...policySnap.data } as CashbackPolicyConfig)
        : buildDefaultCashbackPolicy();
      const policy: CashbackPolicyConfig = {
        ...rawPolicy,
        eligibleComponents: {
          ...buildDefaultCashbackPolicy().eligibleComponents,
          ...(rawPolicy.eligibleComponents || {}),
          hotels: false
        }
      };

      const existingSameKey = (existingWithdrawals as CashbackWithdrawalRequest[]).find(
        (w) => w.userId === caller.uid && w.idempotencyKey === idempotencyKey
      );
      if (existingSameKey) {
        res.status(200).json({ success: true, withdrawalRequest: existingSameKey, deduplicated: true });
        return;
      }

      const config = cfgSnap.data as UserCashbackConfiguration | null;
      if (policy.allowWithdrawalOnlyWhenActive && (!config || !config.isEligible || config.status !== 'ACTIVE')) {
        res.status(403).json({ success: false, error: 'Withdrawals are currently disabled because your cashback configuration is inactive.' });
        return;
      }

      if (!bankSnap.exists || !bankSnap.data || bankSnap.data.userId !== caller.uid) {
        res.status(403).json({ success: false, error: 'Selected bank account does not exist or does not belong to your account.' });
        return;
      }

      const bankAccount = bankSnap.data as UserBankAccount;
      const bankValidation = validateBankAccountInput({
        accountHolderName: bankAccount.accountHolderName,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumberStored || bankAccount.accountNumberMasked,
        ifscCode: bankAccount.ifscCode,
        swiftCode: bankAccount.swiftCode,
        iban: bankAccount.iban,
        country: bankAccount.country,
        currency: bankAccount.currency
      });
      if (!bankValidation.valid) {
        res.status(400).json({ success: false, error: `Bank account validation failed: ${bankValidation.errors.join(' ')}` });
        return;
      }

      if (requestedAmount < policy.minWithdrawalAmount) {
        res.status(400).json({ success: false, error: `Minimum withdrawal amount is ${currency} ${policy.minWithdrawalAmount}.` });
        return;
      }
      if (policy.maxWithdrawalAmount > 0 && requestedAmount > policy.maxWithdrawalAmount) {
        res.status(400).json({ success: false, error: `Maximum single withdrawal amount is ${currency} ${policy.maxWithdrawalAmount}.` });
        return;
      }

      const currentWallet = reconcileWalletFromLedger({
        userId: caller.uid,
        defaultCurrency: policy.defaultCurrency,
        ledgerTransactions: existingTxs as CashbackLedgerTransaction[],
        bookingRecords: []
      });
      const availableInCurr = roundMoney(currentWallet.balancesByCurrency[currency]?.availableBalance ?? 0);
      if (requestedAmount > availableInCurr) {
        res.status(400).json({
          success: false,
          error: `Insufficient available cashback balance (${currency} ${availableInCurr.toLocaleString()}) for requested withdrawal (${currency} ${requestedAmount.toLocaleString()}).`
        });
        return;
      }

      const reqId = `CBWD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const holdTxId = `CBTX-HOLD-${reqId}`;
      const holdTx: CashbackLedgerTransaction = {
        id: holdTxId,
        userId: caller.uid,
        agencyId: caller.userDoc?.agencyId,
        type: 'WITHDRAWAL_HOLD',
        direction: 'HOLD',
        amount: requestedAmount,
        currency,
        balanceAfterAvailable: roundMoney(availableInCurr - requestedAmount),
        withdrawalRequestId: reqId,
        idempotencyKey: `hold:${reqId}`,
        description: `Held ${currency} ${requestedAmount.toLocaleString()} for withdrawal request ${reqId} (${bankAccount.bankName} ${bankAccount.accountNumberMasked}).`,
        createdAt: nowIso,
        createdByUid: caller.uid,
        createdByName: caller.name
      };

      const wdRequest: CashbackWithdrawalRequest = {
        id: reqId,
        requestNumber: reqId,
        userId: caller.uid,
        userName: caller.name,
        userEmail: caller.email,
        agencyId: caller.userDoc?.agencyId,
        agencyName: caller.userDoc?.agencyName || caller.userDoc?.companyName,
        requestedAmount,
        currency,
        bankAccountId: bankAccount.id,
        bankSnapshotMasked: toMaskedBankSnapshot(bankAccount),
        status: 'SUBMITTED',
        holdLedgerTransactionId: holdTxId,
        userNotes: body.userNotes ? String(body.userNotes).trim().slice(0, 500) : undefined,
        statusHistory: [
          {
            status: 'SUBMITTED',
            changedAt: nowIso,
            changedByUid: caller.uid,
            changedByName: caller.name,
            note: 'Withdrawal request submitted by user and available balance placed on hold.'
          }
        ],
        idempotencyKey,
        submittedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const nextWallet = reconcileWalletFromLedger({
        userId: caller.uid,
        defaultCurrency: policy.defaultCurrency,
        ledgerTransactions: [holdTx, ...(existingTxs as CashbackLedgerTransaction[])],
        bookingRecords: []
      });

      const notifId = `CBNOTIF-WD-${reqId}`;
      const notif: CashbackNotificationEvent = {
        id: notifId,
        userId: caller.uid,
        type: 'WITHDRAWAL_SUBMITTED',
        title: 'Withdrawal Request Submitted',
        message: `Your withdrawal request ${reqId} for ${currency} ${requestedAmount.toLocaleString()} to ${bankAccount.bankName} (${bankAccount.accountNumberMasked}) has been submitted for Finance review.`,
        withdrawalRequestId: reqId,
        amount: requestedAmount,
        currency,
        deduplicationKey: `wd-submitted:${reqId}`,
        isRead: false,
        createdAt: nowIso
      };

      const auditId = `CBAUD-WD-${reqId}`;
      const audit: CashbackAuditLogRecord = {
        id: auditId,
        action: 'WITHDRAWAL_SUBMITTED',
        actorUid: caller.uid,
        actorName: caller.name,
        actorRole: caller.role,
        targetUserId: caller.uid,
        entityType: 'WITHDRAWAL_REQUEST',
        entityId: reqId,
        withdrawalRequestId: reqId,
        amount: requestedAmount,
        currency,
        summary: `Submitted withdrawal ${reqId} for ${currency} ${requestedAmount} to ${bankAccount.accountNumberMasked}.`,
        timestamp: nowIso
      };

      const dbPath = getFirestoreDatabasePath();
      await fsCommitWrites(caller.idToken, [
        {
          update: {
            name: `${dbPath}/cashback_ledger_transactions/${holdTxId}`,
            fields: toFirestoreFields(holdTx)
          },
          currentDocument: { exists: false }
        },
        {
          update: {
            name: `${dbPath}/users/${caller.uid}/cashback/transactions/items/${holdTxId}`,
            fields: toFirestoreFields(holdTx)
          }
        },
        {
          update: {
            name: `${dbPath}/cashbackWithdrawalRequests/${reqId}`,
            fields: toFirestoreFields(wdRequest)
          },
          currentDocument: { exists: false }
        },
        {
          update: {
            name: `${dbPath}/cashback_wallets/${caller.uid}`,
            fields: toFirestoreFields(nextWallet)
          }
        },
        {
          update: {
            name: `${dbPath}/users/${caller.uid}/cashback/wallet`,
            fields: toFirestoreFields(nextWallet)
          }
        },
        {
          update: {
            name: `${dbPath}/cashback_notifications/${notifId}`,
            fields: toFirestoreFields(notif)
          }
        },
        {
          update: {
            name: `${dbPath}/cashback_audit_logs/${auditId}`,
            fields: toFirestoreFields(audit)
          }
        }
      ]);

      res.status(200).json({ success: true, withdrawalRequest: wdRequest, wallet: nextWallet });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to submit withdrawal request.' });
    }
  });

  // Cancel own SUBMITTED withdrawal request
  router.post('/withdrawals/:id/cancel', async (req: Request, res: Response): Promise<void> => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!auth.ok) {
      const err = auth as Extract<typeof auth, { ok: false }>;
      res.status(err.status).json({ success: false, error: err.error });
      return;
    }

    const reqId = String(req.params.id || '').trim();
    if (!reqId) {
      res.status(400).json({ success: false, error: 'Withdrawal ID is required.' });
      return;
    }

    try {
      const { caller } = auth;
      const nowIso = new Date().toISOString();
      const [wdSnap, existingTxs] = await Promise.all([
        fsGet(`cashbackWithdrawalRequests/${encodeURIComponent(reqId)}`, caller.idToken),
        fsList(`users/${encodeURIComponent(caller.uid)}/cashback/transactions/items`, caller.idToken, 2000).catch(() => [])
      ]);

      if (!wdSnap.exists || !wdSnap.data) {
        res.status(404).json({ success: false, error: 'Withdrawal request not found.' });
        return;
      }

      const wd = wdSnap.data as CashbackWithdrawalRequest;
      if (wd.userId !== caller.uid) {
        res.status(403).json({ success: false, error: 'Forbidden: Cannot cancel another user\'s withdrawal request.' });
        return;
      }
      if (!canTransitionWithdrawalStatus(wd.status, 'CANCELLED')) {
        res.status(409).json({ success: false, error: `Cannot cancel withdrawal request in status ${wd.status}.` });
        return;
      }

      const releaseTxId = `CBTX-REL-${reqId}`;
      const currentWallet = reconcileWalletFromLedger({
        userId: caller.uid,
        defaultCurrency: wd.currency,
        ledgerTransactions: existingTxs as CashbackLedgerTransaction[],
        bookingRecords: []
      });
      const currentAvail = currentWallet.balancesByCurrency[wd.currency]?.availableBalance ?? 0;

      const releaseTx: CashbackLedgerTransaction = {
        id: releaseTxId,
        userId: caller.uid,
        agencyId: wd.agencyId,
        type: 'WITHDRAWAL_RELEASE',
        direction: 'RELEASE',
        amount: wd.requestedAmount,
        currency: wd.currency,
        balanceAfterAvailable: roundMoney(currentAvail + wd.requestedAmount),
        withdrawalRequestId: reqId,
        idempotencyKey: `release:${reqId}`,
        description: `Released held funds for cancelled withdrawal request ${reqId}.`,
        createdAt: nowIso,
        createdByUid: caller.uid,
        createdByName: caller.name
      };

      const nextWallet = reconcileWalletFromLedger({
        userId: caller.uid,
        defaultCurrency: wd.currency,
        ledgerTransactions: [releaseTx, ...(existingTxs as CashbackLedgerTransaction[])],
        bookingRecords: []
      });

      const updatedWd: CashbackWithdrawalRequest = {
        ...wd,
        status: 'CANCELLED',
        releaseLedgerTransactionId: releaseTxId,
        statusHistory: [
          ...(wd.statusHistory || []),
          {
            status: 'CANCELLED',
            changedAt: nowIso,
            changedByUid: caller.uid,
            changedByName: caller.name,
            note: 'Cancelled by user prior to Finance approval; held funds released to available balance.'
          }
        ],
        updatedAt: nowIso
      };

      const dbPath = getFirestoreDatabasePath();
      await fsCommitWrites(caller.idToken, [
        {
          update: {
            name: `${dbPath}/cashback_ledger_transactions/${releaseTxId}`,
            fields: toFirestoreFields(releaseTx)
          },
          currentDocument: { exists: false }
        },
        {
          update: {
            name: `${dbPath}/users/${caller.uid}/cashback/transactions/items/${releaseTxId}`,
            fields: toFirestoreFields(releaseTx)
          }
        },
        {
          update: {
            name: `${dbPath}/cashbackWithdrawalRequests/${reqId}`,
            fields: toFirestoreFields(updatedWd)
          }
        },
        {
          update: {
            name: `${dbPath}/cashback_wallets/${caller.uid}`,
            fields: toFirestoreFields(nextWallet)
          }
        },
        {
          update: {
            name: `${dbPath}/users/${caller.uid}/cashback/wallet`,
            fields: toFirestoreFields(nextWallet)
          }
        }
      ]);

      res.status(200).json({ success: true, withdrawalRequest: updatedWd, wallet: nextWallet });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to cancel withdrawal request.' });
    }
  });

  return router;
}

// ============================================================================
// EXPRESS ROUTER: ADMIN CMS CASHBACK GOVERNANCE (/api/admin/cashback)
// ============================================================================

export function createAdminCashbackRouter(): Router {
  const router = Router();

  // Overview + live metrics + reconciliation check
  router.get('/overview', async (req: Request, res: Response): Promise<void> => {
    const auth = await verifyAuthenticatedCaller(req, true);
    if (!auth.ok) {
      const err = auth as Extract<typeof auth, { ok: false }>;
      res.status(err.status).json({ success: false, error: err.error });
      return;
    }

    try {
      const { caller } = auth;
      const [configs, wallets, withdrawals, records, ledgerTxs, auditLogs, policySnap] = await Promise.all([
        fsList('cashback_user_configs', caller.idToken, 2000).catch(() => []),
        fsList('cashback_wallets', caller.idToken, 2000).catch(() => []),
        fsList('cashbackWithdrawalRequests', caller.idToken, 2000).catch(() => []),
        fsList('booking_cashback_records', caller.idToken, 2000).catch(() => []),
        fsList('cashback_ledger_transactions', caller.idToken, 5000).catch(() => []),
        fsList('cashback_audit_logs', caller.idToken, 1000).catch(() => []),
        fsGet('system_settings/cashback_policy', caller.idToken).catch(() => ({ exists: false, data: null }))
      ]);

      const rawPolicy = policySnap.exists && policySnap.data
        ? ({ ...buildDefaultCashbackPolicy(), ...policySnap.data } as CashbackPolicyConfig)
        : buildDefaultCashbackPolicy();
      const policy: CashbackPolicyConfig = {
        ...rawPolicy,
        eligibleComponents: {
          ...buildDefaultCashbackPolicy().eligibleComponents,
          ...(rawPolicy.eligibleComponents || {}),
          hotels: false
        }
      };

      const walletList = wallets as CashbackWalletSummary[];
      const configList = configs as UserCashbackConfiguration[];
      const wdList = withdrawals as CashbackWithdrawalRequest[];
      const recList = records as BookingCashbackRecord[];

      const metrics = {
        totalCashbackUsers: configList.length,
        eligibleUsersCount: configList.filter((c) => c.isEligible && c.status === 'ACTIVE').length,
        totalPendingCashback: roundMoney(recList.filter((r) => r.status === 'PENDING' || r.status === 'HELD').reduce((s, r) => s + (r.remainingCashbackAmount ?? r.cashbackAmount ?? 0), 0)),
        totalCreditedCashback: roundMoney(walletList.reduce((s, w) => s + (w.totalCredited || 0), 0)),
        totalAvailableForWithdrawal: roundMoney(walletList.reduce((s, w) => s + (w.availableBalance || 0), 0)),
        totalWithdrawalRequests: wdList.length,
        pendingWithdrawalRequests: wdList.filter((w) => w.status === 'SUBMITTED' || w.status === 'UNDER_REVIEW').length,
        approvedWithdrawalsCount: wdList.filter((w) => w.status === 'APPROVED' || w.status === 'PROCESSING').length,
        paidWithdrawalsCount: wdList.filter((w) => w.status === 'PAID').length,
        rejectedWithdrawalsCount: wdList.filter((w) => w.status === 'REJECTED').length,
        totalPaidOut: roundMoney(wdList.filter((w) => w.status === 'PAID').reduce((s, w) => s + (w.requestedAmount || 0), 0))
      };

      res.status(200).json({
        success: true,
        metrics,
        configs: configList,
        wallets: walletList,
        withdrawals: wdList,
        bookingRecords: recList,
        ledgerTransactions: ledgerTxs,
        auditLogs,
        policy,
        schedulerTelemetry: getCashbackSchedulerTelemetry()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to load cashback overview.' });
    }
  });

  // Update per-user cashback configuration
  router.put('/users/:uid/config', async (req: Request, res: Response): Promise<void> => {
    const auth = await verifyAuthenticatedCaller(req, true);
    if (!auth.ok) {
      const err = auth as Extract<typeof auth, { ok: false }>;
      res.status(err.status).json({ success: false, error: err.error });
      return;
    }

    const targetUid = String(req.params.uid || '').trim();
    if (!targetUid) {
      res.status(400).json({ success: false, error: 'Target user UID is required.' });
      return;
    }

    try {
      const { caller } = auth;
      const body = req.body || {};
      const [policySnap, existingCfgSnap, targetUserSnap] = await Promise.all([
        fsGet('system_settings/cashback_policy', caller.idToken).catch(() => ({ exists: false, data: null })),
        fsGet(`cashback_user_configs/${encodeURIComponent(targetUid)}`, caller.idToken).catch(() => ({ exists: false, data: null })),
        fsGet(`users/${encodeURIComponent(targetUid)}`, caller.idToken).catch(() => ({ exists: false, data: null }))
      ]);

      const rawPolicy = policySnap.exists && policySnap.data
        ? ({ ...buildDefaultCashbackPolicy(), ...policySnap.data } as CashbackPolicyConfig)
        : buildDefaultCashbackPolicy();
      const policy: CashbackPolicyConfig = {
        ...rawPolicy,
        eligibleComponents: {
          ...buildDefaultCashbackPolicy().eligibleComponents,
          ...(rawPolicy.eligibleComponents || {}),
          hotels: false
        }
      };

      const pctCheck = validateCashbackPercentInput(body.cashbackPercent, policy.maxCashbackPercentCeiling);
      if (!pctCheck.valid) {
        res.status(400).json({ success: false, error: pctCheck.error });
        return;
      }

      const existing = existingCfgSnap.exists ? (existingCfgSnap.data as UserCashbackConfiguration) : null;
      const targetUser = targetUserSnap.data || {};
      const nowIso = new Date().toISOString();
      const nextVersion = Number(existing?.configVersion || 0) + 1;
      const cleanPercent = roundPercent(pctCheck.normalized);
      const isEligible = body.isEligible !== undefined ? Boolean(body.isEligible) : true;
      const status = body.status === 'INACTIVE' || body.status === 'SUSPENDED' || !isEligible ? (body.status === 'SUSPENDED' ? 'SUSPENDED' : 'INACTIVE') : 'ACTIVE';

      const nextCfg: UserCashbackConfiguration = {
        userId: targetUid,
        agencyId: targetUser.agencyId || body.agencyId || existing?.agencyId,
        userName: targetUser.name || body.userName || existing?.userName,
        userEmail: targetUser.email || body.userEmail || existing?.userEmail,
        isEligible,
        cashbackPercent: cleanPercent,
        presetType: resolveCashbackPresetType(cleanPercent),
        status,
        effectiveFrom: body.effectiveFrom ? normalizeDateYmd(body.effectiveFrom) : (existing?.effectiveFrom || nowIso.slice(0, 10)),
        effectiveTo: body.effectiveTo ? normalizeDateYmd(body.effectiveTo) : null,
        showInformationalNoticeWhenIneligible: Boolean(body.showInformationalNoticeWhenIneligible),
        notes: body.notes ? String(body.notes).trim().slice(0, 500) : existing?.notes,
        configVersion: nextVersion,
        createdAt: existing?.createdAt || nowIso,
        createdByUid: existing?.createdByUid || caller.uid,
        updatedAt: nowIso,
        updatedByUid: caller.uid,
        updatedByName: caller.name
      };

      const historyId = `CBCH-${targetUid}-${nextVersion}-${Date.now()}`;
      const historyRec: UserCashbackConfigHistoryRecord = {
        id: historyId,
        userId: targetUid,
        previousPercent: existing?.cashbackPercent ?? null,
        newPercent: cleanPercent,
        previousEligible: existing?.isEligible ?? false,
        newEligible: isEligible,
        previousStatus: existing?.status ?? 'NONE',
        newStatus: status,
        reason: body.reason ? String(body.reason).trim().slice(0, 500) : 'Updated in Cashback Governance',
        changedAt: nowIso,
        changedByUid: caller.uid,
        changedByName: caller.name,
        changedByEmail: caller.email
      };

      const auditId = `CBAUD-CFG-${Date.now()}`;
      const audit: CashbackAuditLogRecord = {
        id: auditId,
        action: existing ? 'CASHBACK_CONFIG_UPDATED' : 'CASHBACK_ELIGIBILITY_ENABLED',
        actorUid: caller.uid,
        actorName: caller.name,
        actorRole: caller.role,
        targetUserId: targetUid,
        entityType: 'USER_CONFIG',
        entityId: targetUid,
        previousValue: existing ? `${existing.cashbackPercent}% (${existing.status})` : 'NONE',
        newValue: `${cleanPercent}% (${status}, eligible=${isEligible})`,
        reason: historyRec.reason,
        summary: `Set user ${targetUser.email || targetUid} cashback configuration to ${cleanPercent}% (${status}).`,
        timestamp: nowIso
      };

      const dbPath = getFirestoreDatabasePath();
      await fsCommitWrites(caller.idToken, [
        {
          update: {
            name: `${dbPath}/cashback_user_configs/${targetUid}`,
            fields: toFirestoreFields(nextCfg)
          }
        },
        {
          update: {
            name: `${dbPath}/users/${targetUid}/cashback/configuration`,
            fields: toFirestoreFields(nextCfg)
          }
        },
        {
          update: {
            name: `${dbPath}/cashback_config_history/${historyId}`,
            fields: toFirestoreFields(historyRec)
          }
        },
        {
          update: {
            name: `${dbPath}/cashback_audit_logs/${auditId}`,
            fields: toFirestoreFields(audit)
          }
        }
      ]);

      res.status(200).json({ success: true, configuration: nextCfg, historyRecord: historyRec, auditLog: audit });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to update cashback configuration.' });
    }
  });

  // Transition withdrawal status (Approve, Under Review, Processing, Mark Paid, Reject)
  router.post('/withdrawals/:id/transition', async (req: Request, res: Response): Promise<void> => {
    const auth = await verifyAuthenticatedCaller(req, true);
    if (!auth.ok) {
      const err = auth as Extract<typeof auth, { ok: false }>;
      res.status(err.status).json({ success: false, error: err.error });
      return;
    }

    const reqId = String(req.params.id || '').trim();
    const body = req.body || {};
    const targetStatus = String(body.targetStatus || '').toUpperCase() as WithdrawalStatus;

    try {
      const { caller } = auth;
      const nowIso = new Date().toISOString();
      const wdSnap = await fsGet(`cashbackWithdrawalRequests/${encodeURIComponent(reqId)}`, caller.idToken);
      if (!wdSnap.exists || !wdSnap.data) {
        res.status(404).json({ success: false, error: 'Withdrawal request not found.' });
        return;
      }
      const wd = wdSnap.data as CashbackWithdrawalRequest;

      // Critical security rule: Prevent Admin self-approval / self-payout
      if (wd.userId === caller.uid && targetStatus !== 'CANCELLED') {
        res.status(403).json({
          success: false,
          error: 'Segregation of Duties Violation: You cannot approve, process, or mark paid your own cashback withdrawal request.'
        });
        return;
      }

      if (!canTransitionWithdrawalStatus(wd.status, targetStatus)) {
        res.status(409).json({
          success: false,
          error: `Invalid withdrawal status transition: ${wd.status} -> ${targetStatus}.`
        });
        return;
      }

      if (targetStatus === 'REJECTED' && !String(body.rejectionReason || '').trim()) {
        res.status(400).json({ success: false, error: 'Rejection reason is mandatory when rejecting a withdrawal request.' });
        return;
      }
      if (targetStatus === 'PAID' && (!String(body.paymentReference || '').trim() || !String(body.paymentDate || '').trim())) {
        res.status(400).json({ success: false, error: 'Payment reference and payment date are mandatory when marking withdrawal as PAID.' });
        return;
      }

      const existingTxs = (await fsList(`users/${encodeURIComponent(wd.userId)}/cashback/transactions/items`, caller.idToken, 2000).catch(() => [])) as CashbackLedgerTransaction[];
      const currentWallet = reconcileWalletFromLedger({
        userId: wd.userId,
        defaultCurrency: wd.currency,
        ledgerTransactions: existingTxs,
        bookingRecords: []
      });
      const currentAvail = currentWallet.balancesByCurrency[wd.currency]?.availableBalance ?? 0;

      const dbPath = getFirestoreDatabasePath();
      const writes: any[] = [];
      let extraTx: CashbackLedgerTransaction | null = null;
      const updatedWd: CashbackWithdrawalRequest = {
        ...wd,
        status: targetStatus,
        internalNotes: body.internalNotes !== undefined ? String(body.internalNotes).slice(0, 500) : wd.internalNotes,
        updatedAt: nowIso
      };

      if (targetStatus === 'APPROVED') {
        updatedWd.approvedAt = nowIso;
        updatedWd.approvedByUid = caller.uid;
        updatedWd.approvedByName = caller.name;
      } else if (targetStatus === 'PAID') {
        const debitTxId = `CBTX-DEBIT-${reqId}`;
        extraTx = {
          id: debitTxId,
          userId: wd.userId,
          agencyId: wd.agencyId,
          type: 'WITHDRAWAL_DEBIT',
          direction: 'DEBIT',
          amount: wd.requestedAmount,
          currency: wd.currency,
          balanceAfterAvailable: currentAvail,
          withdrawalRequestId: reqId,
          idempotencyKey: `debit:${reqId}`,
          description: `Payout settled for withdrawal ${reqId} (Ref: ${String(body.paymentReference).trim()}) to ${wd.bankSnapshotMasked.bankName} ${wd.bankSnapshotMasked.accountNumberMasked}.`,
          createdAt: nowIso,
          createdByUid: caller.uid,
          createdByName: caller.name
        };
        updatedWd.paidAt = nowIso;
        updatedWd.paidByUid = caller.uid;
        updatedWd.paidByName = caller.name;
        updatedWd.paymentReference = String(body.paymentReference).trim();
        updatedWd.paymentMethod = String(body.paymentMethod || 'BANK_TRANSFER').trim();
        updatedWd.paymentDate = String(body.paymentDate).trim();
        updatedWd.debitLedgerTransactionId = debitTxId;
      } else if (targetStatus === 'REJECTED') {
        const relTxId = `CBTX-REL-${reqId}`;
        extraTx = {
          id: relTxId,
          userId: wd.userId,
          agencyId: wd.agencyId,
          type: 'WITHDRAWAL_RELEASE',
          direction: 'RELEASE',
          amount: wd.requestedAmount,
          currency: wd.currency,
          balanceAfterAvailable: roundMoney(currentAvail + wd.requestedAmount),
          withdrawalRequestId: reqId,
          idempotencyKey: `release:${reqId}`,
          description: `Released held funds for rejected withdrawal ${reqId}: ${String(body.rejectionReason).trim()}.`,
          createdAt: nowIso,
          createdByUid: caller.uid,
          createdByName: caller.name
        };
        updatedWd.rejectedAt = nowIso;
        updatedWd.rejectedByUid = caller.uid;
        updatedWd.rejectedByName = caller.name;
        updatedWd.rejectionReason = String(body.rejectionReason).trim();
        updatedWd.releaseLedgerTransactionId = relTxId;
      }

      updatedWd.statusHistory = [
        ...(wd.statusHistory || []),
        {
          status: targetStatus,
          changedAt: nowIso,
          changedByUid: caller.uid,
          changedByName: caller.name,
          note: body.rejectionReason || body.paymentReference || body.internalNotes || `Transitioned to ${targetStatus}`
        }
      ];

      if (extraTx) {
        writes.push({
          update: {
            name: `${dbPath}/cashback_ledger_transactions/${extraTx.id}`,
            fields: toFirestoreFields(extraTx)
          },
          currentDocument: { exists: false }
        });
        writes.push({
          update: {
            name: `${dbPath}/users/${wd.userId}/cashback/transactions/items/${extraTx.id}`,
            fields: toFirestoreFields(extraTx)
          }
        });
      }

      const nextWallet = reconcileWalletFromLedger({
        userId: wd.userId,
        defaultCurrency: wd.currency,
        ledgerTransactions: extraTx ? [extraTx, ...existingTxs] : existingTxs,
        bookingRecords: []
      });

      writes.push({
        update: {
          name: `${dbPath}/cashbackWithdrawalRequests/${reqId}`,
          fields: toFirestoreFields(updatedWd)
        }
      });
      writes.push({
        update: {
          name: `${dbPath}/cashback_wallets/${wd.userId}`,
          fields: toFirestoreFields(nextWallet)
        }
      });
      writes.push({
        update: {
          name: `${dbPath}/users/${wd.userId}/cashback/wallet`,
          fields: toFirestoreFields(nextWallet)
        }
      });

      const notifId = `CBNOTIF-${reqId}-${targetStatus}`;
      const notif: CashbackNotificationEvent = {
        id: notifId,
        userId: wd.userId,
        type:
          targetStatus === 'APPROVED'
            ? 'WITHDRAWAL_APPROVED'
            : targetStatus === 'PAID'
              ? 'WITHDRAWAL_PAID'
              : targetStatus === 'REJECTED'
                ? 'WITHDRAWAL_REJECTED'
                : 'WITHDRAWAL_SUBMITTED',
        title: `Withdrawal ${targetStatus}`,
        message:
          targetStatus === 'PAID'
            ? `Payout of ${wd.currency} ${wd.requestedAmount.toLocaleString()} for ${reqId} to ${wd.bankSnapshotMasked.accountNumberMasked} was completed (Ref: ${updatedWd.paymentReference}).`
            : targetStatus === 'REJECTED'
              ? `Withdrawal ${reqId} was rejected (${updatedWd.rejectionReason}). Held balance has been released.`
              : `Withdrawal ${reqId} (${wd.currency} ${wd.requestedAmount.toLocaleString()}) status updated to ${targetStatus}.`,
        withdrawalRequestId: reqId,
        amount: wd.requestedAmount,
        currency: wd.currency,
        deduplicationKey: `wd:${reqId}:${targetStatus}`,
        isRead: false,
        createdAt: nowIso
      };
      writes.push({
        update: {
          name: `${dbPath}/cashback_notifications/${notifId}`,
          fields: toFirestoreFields(notif)
        }
      });

      await fsCommitWrites(caller.idToken, writes);
      res.status(200).json({ success: true, withdrawalRequest: updatedWd, wallet: nextWallet });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to update withdrawal status.' });
    }
  });

  // Trigger auto-credit scheduler immediately
  router.post('/scheduler/run', async (req: Request, res: Response): Promise<void> => {
    const auth = await verifyAuthenticatedCaller(req, true);
    if (!auth.ok) {
      const err = auth as Extract<typeof auth, { ok: false }>;
      res.status(err.status).json({ success: false, error: err.error });
      return;
    }

    const result = await runServerScheduledCashbackCreditingBatch({
      token: auth.caller.idToken,
      nowIsoOverride: typeof req.body?.nowIsoOverride === 'string' ? req.body.nowIsoOverride : undefined,
      source: 'MANUAL_ADMIN'
    });
    res.status(200).json({ success: true, ...result, telemetry: getCashbackSchedulerTelemetry() });
  });

  return router;
}
