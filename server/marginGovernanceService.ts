import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export type MarginTypeMode = 'PERCENTAGE' | 'FIXED';
export type MarginRuleStatus = 'ACTIVE' | 'INACTIVE';

export interface MarginUpdateInput {
  marginType: MarginTypeMode;
  marginValue: number;
  commissionPercent?: number;
  status?: MarginRuleStatus;
  reason?: string;
  expectedVersion?: number;
  changeSource?: 'MARGIN_GOVERNANCE' | 'PRODUCT_MANAGEMENT' | 'BULK_GOVERNANCE';
  batchId?: string;
}

export interface VerifiedAdminCaller {
  uid: string;
  email: string;
  name: string;
  role: string;
  idToken: string;
}

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
    console.warn('[MARGIN-GOV] Could not read firebase-applet-config.json:', err);
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

// =========================================================================
// FIRESTORE REST VALUE CODEC
// =========================================================================

export function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('arrayValue' in val) {
    const arr = val.arrayValue?.values;
    return Array.isArray(arr) ? arr.map(fromFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

export function fromFirestoreDocument(doc: any): Record<string, any> | null {
  if (!doc || !doc.fields) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    out[k] = fromFirestoreValue(v);
  }
  if (!out.id && typeof doc.name === 'string') {
    const segs = doc.name.split('/');
    out.id = segs[segs.length - 1];
  }
  return out;
}

export function toFirestoreValue(val: any): any {
  if (val === null) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { nullValue: null };
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((item) => item !== undefined).map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

export function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

// =========================================================================
// INPUT VALIDATION & AUTHORITATIVE SELLING PRICE COMPUTATION
// =========================================================================

export function validateMarginPayload(raw: any): {
  valid: boolean;
  error?: string;
  normalized?: MarginUpdateInput;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Request payload is required.' };
  }

  const marginType: MarginTypeMode =
    raw.marginType === 'FIXED' || raw.marginType === 'PERCENTAGE'
      ? raw.marginType
      : 'PERCENTAGE';

  if (raw.marginType !== undefined && raw.marginType !== 'PERCENTAGE' && raw.marginType !== 'FIXED') {
    return { valid: false, error: `Unsupported marginType "${String(raw.marginType)}". Must be PERCENTAGE or FIXED.` };
  }

  if (raw.marginValue === undefined || raw.marginValue === null || raw.marginValue === '') {
    return { valid: false, error: 'Margin value is required and cannot be empty.' };
  }

  const rawStr = typeof raw.marginValue === 'string' ? raw.marginValue.trim() : String(raw.marginValue);
  if (!/^-?\d+(\.\d+)?$/.test(rawStr)) {
    return { valid: false, error: `Malformed margin value "${rawStr}". Enter a valid numeric value.` };
  }

  const marginValue = Number(rawStr);
  if (!Number.isFinite(marginValue) || Number.isNaN(marginValue)) {
    return { valid: false, error: 'Margin value must be a finite number.' };
  }

  if (marginValue < 0) {
    return { valid: false, error: 'Margin value cannot be negative.' };
  }

  if (marginType === 'PERCENTAGE' && marginValue > 500) {
    return { valid: false, error: 'Percentage margin cannot exceed 500%.' };
  }

  if (marginType === 'FIXED' && marginValue > 10000000) {
    return { valid: false, error: 'Fixed margin exceeds maximum allowed commercial ceiling (10,000,000).' };
  }

  const decimalParts = rawStr.split('.');
  if (decimalParts[1] && decimalParts[1].length > 2) {
    return { valid: false, error: 'Margin value supports at most 2 decimal places.' };
  }

  let commissionPercent: number | undefined = undefined;
  if (raw.commissionPercent !== undefined && raw.commissionPercent !== null && raw.commissionPercent !== '') {
    const commStr = typeof raw.commissionPercent === 'string' ? raw.commissionPercent.trim() : String(raw.commissionPercent);
    if (!/^-?\d+(\.\d+)?$/.test(commStr)) {
      return { valid: false, error: `Malformed commission percentage "${commStr}".` };
    }
    const commVal = Number(commStr);
    if (!Number.isFinite(commVal) || commVal < 0 || commVal > 100) {
      return { valid: false, error: 'Commission percentage must be between 0% and 100%.' };
    }
    const commDec = commStr.split('.')[1];
    if (commDec && commDec.length > 2) {
      return { valid: false, error: 'Commission percentage supports at most 2 decimal places.' };
    }
    commissionPercent = Math.round(commVal * 100) / 100;
  }

  const status: MarginRuleStatus | undefined =
    raw.status === 'ACTIVE' || raw.status === 'INACTIVE' ? raw.status : undefined;
  if (raw.status !== undefined && !status) {
    return { valid: false, error: `Invalid configuration status "${String(raw.status)}".` };
  }

  let expectedVersion: number | undefined = undefined;
  if (raw.expectedVersion !== undefined && raw.expectedVersion !== null && raw.expectedVersion !== '') {
    const ver = Number(raw.expectedVersion);
    if (!Number.isInteger(ver) || ver < 0) {
      return { valid: false, error: 'Invalid expectedVersion for optimistic concurrency check.' };
    }
    expectedVersion = ver;
  }

  const reason = typeof raw.reason === 'string' ? raw.reason.trim().slice(0, 500) : undefined;
  const changeSource =
    raw.changeSource === 'BULK_GOVERNANCE' || raw.changeSource === 'PRODUCT_MANAGEMENT'
      ? raw.changeSource
      : 'MARGIN_GOVERNANCE';

  return {
    valid: true,
    normalized: {
      marginType,
      marginValue: Math.round(marginValue * 100) / 100,
      commissionPercent,
      status,
      reason: reason || undefined,
      expectedVersion,
      changeSource,
      batchId: typeof raw.batchId === 'string' ? raw.batchId.slice(0, 80) : undefined
    }
  };
}

export function computeB2BSellingPriceFromNett(params: {
  nettCost: number;
  marginType: MarginTypeMode;
  marginValue: number;
  taxPercent: number;
  serviceFeeValue?: number;
  serviceFeeType?: 'PERCENTAGE' | 'FIXED';
  serviceFeePercent?: number;
  isInactive?: boolean;
}): number {
  const nett = Math.max(0, Number(params.nettCost) || 0);
  if (nett <= 0 && params.marginType === 'PERCENTAGE') return 0;
  const marginAmt = params.isInactive
    ? 0
    : params.marginType === 'FIXED'
      ? Math.max(0, params.marginValue)
      : nett * (Math.max(0, params.marginValue) / 100);
  const taxAmt = marginAmt * (Math.max(0, Number(params.taxPercent) || 0) / 100);
  const subtotal = nett + marginAmt + taxAmt;
  const rawFee = Math.max(0, Number(params.serviceFeeValue ?? params.serviceFeePercent ?? 0) || 0);
  const feeAmt = params.serviceFeeType === 'FIXED' ? rawFee : subtotal * (rawFee / 100);
  return Math.round((subtotal + feeAmt) * 100) / 100;
}

// =========================================================================
// AUTHORIZATION VERIFICATION (IDENTITY TOOLKIT + FIRESTORE USER DOC)
// =========================================================================

const AUTHORIZED_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

export function isRoleAuthorizedForMarginGovernance(userDoc: Record<string, any> | null, tokenEmail: string): boolean {
  const normalizedEmail = (tokenEmail || '').trim().toLowerCase();
  if (AUTHORIZED_ADMIN_EMAILS.has(normalizedEmail)) {
    return true;
  }
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
      perms.cmsFinance?.enabled === true
    );
  }
  return false;
}

async function verifyAdminCaller(req: Request): Promise<{ ok: true; caller: VerifiedAdminCaller } | { ok: false; status: number; error: string }> {
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
    const lookupJson = await lookupRes.json() as any;
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

  // Verify Firestore /users/{uid} authorization role & permissions
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
  } catch (err) {
    console.debug('[MARGIN-GOV] User profile lookup note:', err);
  }

  if (!isRoleAuthorizedForMarginGovernance(userDoc, email)) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Only authorized internal Administrators or Finance Managers can access Margin & Commission Governance.'
    };
  }

  return {
    ok: true,
    caller: {
      uid,
      email: email || userDoc?.email || 'business@theunbound.in',
      name: userDoc?.name || userDoc?.displayName || displayName || email || 'Administrator',
      role: String(userDoc?.role || (AUTHORIZED_ADMIN_EMAILS.has(email) ? 'ADMIN' : 'TEAM_MEMBER')).toUpperCase(),
      idToken
    }
  };
}

// =========================================================================
// FIRESTORE REST HELPERS (TRANSACTIONAL READ / WRITE)
// =========================================================================

async function firestoreGetDoc(
  collection: string,
  docId: string,
  idToken: string,
  transaction?: string
): Promise<{ exists: boolean; data: Record<string, any> | null }> {
  const txQuery = transaction ? `?transaction=${encodeURIComponent(transaction)}` : '';
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}${txQuery}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(6000)
  });
  if (res.status === 404) {
    return { exists: false, data: null };
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore read failed for ${collection}/${docId} (${res.status}): ${errText}`);
  }
  const raw = await res.json();
  return { exists: true, data: fromFirestoreDocument(raw) };
}

async function firestoreListCollection(
  collection: string,
  idToken: string,
  maxDocs: number = 1000
): Promise<Record<string, any>[]> {
  const segs = collection.split('/').filter(Boolean);
  if (segs.length === 0) return [];
  const collectionId = segs[segs.length - 1];
  const parentSegs = segs.slice(0, -1).map((s) => encodeURIComponent(s));
  const queryUrl = parentSegs.length > 0
    ? `${getFirestoreBaseUrl()}/${parentSegs.join('/')}:runQuery`
    : `${getFirestoreBaseUrl()}:runQuery`;

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
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ structuredQuery }),
      signal: AbortSignal.timeout(8000)
    });
    if (res.status === 404) return out;
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Firestore list failed for ${collection} (${res.status}): ${errText}`);
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

async function executeTransactionalProductMarginUpdate(params: {
  productId: string;
  input: MarginUpdateInput;
  caller: VerifiedAdminCaller;
}): Promise<
  | {
      ok: true;
      updatedProduct: Record<string, any>;
      marginConfig: Record<string, any>;
      auditLog: Record<string, any>;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
      currentVersion?: number;
      currentConfig?: Record<string, any> | null;
    }
> {
  const { productId, input, caller } = params;
  const baseUrl = getFirestoreBaseUrl();
  const dbPath = getFirestoreDatabasePath();

  // 1. Begin Firestore read-write transaction
  const beginRes = await fetch(`${baseUrl}:beginTransaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${caller.idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ options: { readWrite: {} } }),
    signal: AbortSignal.timeout(6000)
  });
  if (!beginRes.ok) {
    const errText = await beginRes.text().catch(() => '');
    throw new Error(`Failed to begin Firestore transaction (${beginRes.status}): ${errText}`);
  }
  const { transaction } = await beginRes.json() as { transaction: string };

  const rollbackTx = async () => {
    await fetch(`${baseUrl}:rollback`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${caller.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transaction }),
      signal: AbortSignal.timeout(3000)
    }).catch(() => {});
  };

  try {
    // 2. Read authoritative product & margin config inside transaction
    const [prodSnap, cfgSnap] = await Promise.all([
      firestoreGetDoc('products', productId, caller.idToken, transaction),
      firestoreGetDoc('product_margin_configs', productId, caller.idToken, transaction)
    ]);

    if (!prodSnap.exists || !prodSnap.data || prodSnap.data.isDeleted === true || prodSnap.data.status === 'DELETED') {
      await rollbackTx();
      return {
        ok: false,
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        error: `Product "${productId}" was not found or has been deleted.`
      };
    }

    const product = prodSnap.data;
    const existingCfg = cfgSnap.exists ? cfgSnap.data : null;
    const currentVersion = Math.max(
      Number(existingCfg?.version || 0),
      Number(product.marginConfigVersion || 0)
    );

    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== currentVersion
    ) {
      await rollbackTx();
      return {
        ok: false,
        status: 409,
        code: 'VERSION_CONFLICT',
        error: `Margin configuration for "${product.name || productId}" was modified by another administrator (expected v${input.expectedVersion}, latest is v${currentVersion}). Reload latest configuration before saving.`,
        currentVersion,
        currentConfig: existingCfg
      };
    }

    const nowIso = new Date().toISOString();
    const todayIso = nowIso.split('T')[0];
    const nextVersion = currentVersion + 1;
    const nextStatus: MarginRuleStatus = input.status || existingCfg?.status || product.marginStatus || 'ACTIVE';
    const nextCommission = input.commissionPercent !== undefined
      ? input.commissionPercent
      : Number(existingCfg?.commissionPercent ?? product.commissionPercent ?? 0);

    const prevMarginType: MarginTypeMode =
      existingCfg?.marginType === 'FIXED' || product.marginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    const prevMarginValue =
      existingCfg?.marginValue !== undefined
        ? Number(existingCfg.marginValue)
        : (prevMarginType === 'FIXED'
            ? (product.marginFixed !== undefined ? Number(product.marginFixed) : null)
            : (product.b2bAgentMarkupPercent !== undefined
                ? Number(product.b2bAgentMarkupPercent)
                : (product.defaultMarkupPercent !== undefined ? Number(product.defaultMarkupPercent) : null)));
    const prevCommission = existingCfg?.commissionPercent ?? (product.commissionPercent !== undefined ? Number(product.commissionPercent) : null);
    const prevStatus: 'ACTIVE' | 'INACTIVE' | 'NOT_CONFIGURED' = existingCfg
      ? existingCfg.status
      : (prevMarginValue !== null ? 'ACTIVE' : 'NOT_CONFIGURED');

    const syncedPct = input.marginType === 'PERCENTAGE'
      ? input.marginValue
      : Number(product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 0);
    const syncedFixed = input.marginType === 'FIXED' ? input.marginValue : 0;

    // Recompute authoritative sellingPriceStartingFrom and synchronize any tieredPricing/capacityTiers
    const isCapacity =
      product.pricingMethod === 'capacity_based' ||
      ['Private Tours', 'Transfers', 'Private Yacht', 'Ferry'].includes(String(product.category || ''));
    const baseNet = isCapacity
      ? Number(product.vehicleConfig?.unitVehicleNetCost ?? product.adultNetPrice ?? 0)
      : Number(product.adultNetPrice ?? 0);
    const taxPct = Number(product.taxPercent ?? 0);
    const fixedFee = Number(product.serviceFeeFixed ?? 0);
    const pctFee = Number(product.serviceFeePercent ?? 0);
    const prodFeeType: 'PERCENTAGE' | 'FIXED' = fixedFee > 0 ? 'FIXED' : 'PERCENTAGE';
    const prodFeeValue = fixedFee > 0 ? fixedFee : pctFee;

    const updatedTiers = Array.isArray(product.tieredPricing) && product.tieredPricing.length > 0
      ? product.tieredPricing.map((tier: any) => {
          const tierNet = Number(tier.supplierNett ?? tier.nettPrice ?? tier.netCostPerPax ?? baseNet ?? 0);
          const tierTax = tier.taxValue !== undefined ? Number(tier.taxValue) : taxPct;
          const tierFeeType: 'PERCENTAGE' | 'FIXED' =
            tier.serviceChargeValue !== undefined
              ? (tier.serviceChargeType === 'FIXED' ? 'FIXED' : 'PERCENTAGE')
              : prodFeeType;
          const tierFee = tier.serviceChargeValue !== undefined ? Number(tier.serviceChargeValue) : prodFeeValue;
          const tierFinal = computeB2BSellingPriceFromNett({
            nettCost: tierNet,
            marginType: input.marginType,
            marginValue: input.marginValue,
            taxPercent: tierTax,
            serviceFeeType: tierFeeType,
            serviceFeeValue: tierFee,
            isInactive: nextStatus === 'INACTIVE'
          });
          return {
            ...tier,
            marginType: input.marginType,
            marginValue: input.marginValue,
            finalPrice: tierFinal,
            sellingPricePerPax: tierFinal
          };
        })
      : product.tieredPricing;

    const updatedCapacityTiers = Array.isArray(product.capacityTiers) && product.capacityTiers.length > 0
      ? product.capacityTiers.map((tier: any) => {
          const tierNet = Number(tier.supplierNett ?? tier.nettPrice ?? baseNet ?? 0);
          const tierTax = tier.taxValue !== undefined ? Number(tier.taxValue) : taxPct;
          const tierFeeType: 'PERCENTAGE' | 'FIXED' =
            tier.serviceChargeValue !== undefined
              ? (tier.serviceChargeType === 'FIXED' ? 'FIXED' : 'PERCENTAGE')
              : prodFeeType;
          const tierFee = tier.serviceChargeValue !== undefined ? Number(tier.serviceChargeValue) : prodFeeValue;
          const tierFinal = computeB2BSellingPriceFromNett({
            nettCost: tierNet,
            marginType: input.marginType,
            marginValue: input.marginValue,
            taxPercent: tierTax,
            serviceFeeType: tierFeeType,
            serviceFeeValue: tierFee,
            isInactive: nextStatus === 'INACTIVE'
          });
          return {
            ...tier,
            marginType: input.marginType,
            marginValue: input.marginValue,
            finalPrice: tierFinal
          };
        })
      : product.capacityTiers;

    const recomputedSelling = computeB2BSellingPriceFromNett({
      nettCost: baseNet,
      marginType: input.marginType,
      marginValue: input.marginValue,
      taxPercent: taxPct,
      serviceFeeType: prodFeeType,
      serviceFeeValue: prodFeeValue,
      isInactive: nextStatus === 'INACTIVE'
    });

    const productUpdateFields: Record<string, any> = {
      defaultMarkupPercent: syncedPct,
      b2bAgentMarkupPercent: syncedPct,
      marginType: input.marginType,
      marginFixed: syncedFixed,
      commissionPercent: nextCommission,
      marginStatus: nextStatus,
      marginConfigVersion: nextVersion,
      sellingPriceStartingFrom: recomputedSelling,
      marginUpdatedAt: nowIso,
      marginUpdatedBy: caller.uid,
      marginUpdatedByName: caller.name,
      marginUpdatedByEmail: caller.email,
      marginLastChangeReason: input.reason || 'Updated in Margin & Commission Governance',
      updatedAt: nowIso,
      lastUpdated: todayIso,
      updatedBy: caller.uid,
      updatedByRole: caller.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
      updatedByEmail: caller.email
    };
    if (Array.isArray(updatedTiers)) {
      productUpdateFields.tieredPricing = updatedTiers;
    }
    if (Array.isArray(updatedCapacityTiers)) {
      productUpdateFields.capacityTiers = updatedCapacityTiers;
    }

    const marginConfigRecord: Record<string, any> = {
      id: productId,
      productId,
      sku: product.sku || productId,
      productName: product.name || product.title || productId,
      category: String(product.category || ''),
      destinationId: product.destinationId || '',
      destinationName: product.destinationName || '',
      regionId: product.regionId || '',
      regionName: product.regionName || '',
      hubId: product.hubId || '',
      city: product.city || '',
      supplierId: product.supplierId || '',
      supplierName: product.supplierName || '',
      currency: product.nativeCurrency || product.currency || 'USD',
      marginType: input.marginType,
      marginValue: input.marginValue,
      b2bAgentMarkupPercent: syncedPct,
      defaultMarkupPercent: syncedPct,
      marginFixed: syncedFixed,
      commissionPercent: nextCommission,
      isActive: nextStatus === 'ACTIVE',
      status: nextStatus,
      applicableScope: 'ALL_B2B',
      version: nextVersion,
      createdAt: existingCfg?.createdAt || nowIso,
      updatedAt: nowIso,
      updatedByUid: caller.uid,
      updatedByEmail: caller.email,
      updatedByName: caller.name,
      updatedByRole: caller.role,
      changeReason: input.reason || 'Updated via Margin & Commission Governance',
      changeSource: input.changeSource || 'MARGIN_GOVERNANCE',
      schemaVersion: 1
    };

    const action = !existingCfg
      ? 'MARGIN_CREATED'
      : input.changeSource === 'BULK_GOVERNANCE'
        ? 'MARGIN_BULK_UPDATED'
        : nextStatus !== prevStatus
          ? 'MARGIN_STATUS_CHANGED'
          : (prevMarginValue === input.marginValue && prevMarginType === input.marginType && nextCommission !== prevCommission)
            ? 'COMMISSION_UPDATED'
            : 'MARGIN_UPDATED';

    const logId = `PMA-${productId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const auditLogRecord: Record<string, any> = {
      id: logId,
      productId,
      sku: product.sku || productId,
      productName: product.name || product.title || productId,
      action,
      previousMarginType: prevMarginType,
      newMarginType: input.marginType,
      previousMarginValue: prevMarginValue,
      newMarginValue: input.marginValue,
      previousCommissionPercent: prevCommission,
      newCommissionPercent: nextCommission,
      previousStatus: prevStatus,
      newStatus: nextStatus,
      previousVersion: currentVersion,
      newVersion: nextVersion,
      reason: input.reason || '',
      changeSource: input.changeSource || 'MARGIN_GOVERNANCE',
      ...(input.batchId ? { batchId: input.batchId } : {}),
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorName: caller.name,
      actorRole: caller.role,
      timestamp: nowIso
    };

    const writes: any[] = [
      {
        updateMask: { fieldPaths: Object.keys(productUpdateFields) },
        update: {
          name: `${dbPath}/products/${productId}`,
          fields: toFirestoreFields(productUpdateFields)
        }
      },
      {
        update: {
          name: `${dbPath}/product_margin_configs/${productId}`,
          fields: toFirestoreFields(marginConfigRecord)
        }
      },
      {
        update: {
          name: `${dbPath}/product_margin_audit_logs/${logId}`,
          fields: toFirestoreFields(auditLogRecord)
        }
      }
    ];

    // Keep Japan Rail Commercial Product synced if Rail product exists
    const isRail =
      productId === 'RAIL-JP-ORD-RESERVED' ||
      productId === 'RAIL-JP-GREEN-RESERVED' ||
      product.category === 'Rail' ||
      product.category === 'Rail / Shinkansen';
    if (isRail) {
      const railSnap = await firestoreGetDoc('japan_rail_commercial_products', productId, caller.idToken, transaction);
      if (railSnap.exists && railSnap.data) {
        const nextPricingConfig = {
          ...(railSnap.data.pricingConfiguration || {}),
          marginType: input.marginType,
          marginValue: input.marginValue
        };
        const railUpdate = {
          pricingConfiguration: nextPricingConfig,
          updatedAt: nowIso,
          updatedBy: caller.name,
          updatedByEmail: caller.email,
          updatedByRole: caller.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN'
        };
        writes.push({
          updateMask: { fieldPaths: Object.keys(railUpdate) },
          update: {
            name: `${dbPath}/japan_rail_commercial_products/${productId}`,
            fields: toFirestoreFields(railUpdate)
          }
        });
      }
    }

    // 3. Atomic commit
    const commitRes = await fetch(`${baseUrl}:commit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${caller.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transaction, writes }),
      signal: AbortSignal.timeout(8000)
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text().catch(() => '');
      const status = commitRes.status === 403 ? 403 : commitRes.status === 409 || commitRes.status === 400 ? commitRes.status : 500;
      throw Object.assign(new Error(`Firestore transaction commit failed (${commitRes.status}): ${errText}`), { httpStatus: status });
    }

    // 4. Authoritative read-back confirmation
    const [verifiedProdSnap, verifiedCfgSnap] = await Promise.all([
      firestoreGetDoc('products', productId, caller.idToken),
      firestoreGetDoc('product_margin_configs', productId, caller.idToken)
    ]);

    return {
      ok: true,
      updatedProduct: verifiedProdSnap.data || { ...product, ...productUpdateFields },
      marginConfig: verifiedCfgSnap.data || marginConfigRecord,
      auditLog: auditLogRecord
    };
  } catch (err) {
    await rollbackTx();
    throw err;
  }
}

// =========================================================================
// EXPRESS ROUTER FOR /api/admin/margins
// =========================================================================

const MARGIN_CATALOG_TTL_MS = 15_000;
const marginCatalogCache = new Map<string, { productsRaw: Record<string, any>[]; configsRaw: Record<string, any>[]; expiresAt: number }>();
const inFlightMarginCatalog = new Map<string, Promise<{ productsRaw: Record<string, any>[]; configsRaw: Record<string, any>[] }>>();

export function invalidateMarginGovernanceCache(): void {
  marginCatalogCache.clear();
}

async function listMarginCatalogCached(idToken: string): Promise<{ productsRaw: Record<string, any>[]; configsRaw: Record<string, any>[] }> {
  const key = idToken.slice(-24);
  const now = Date.now();
  const cached = marginCatalogCache.get(key);
  if (cached && now < cached.expiresAt) {
    return { productsRaw: cached.productsRaw, configsRaw: cached.configsRaw };
  }
  const inflight = inFlightMarginCatalog.get(key);
  if (inflight) return inflight;

  const promise = Promise.all([
    firestoreListCollection('products', idToken, 2000),
    firestoreListCollection('product_margin_configs', idToken, 2000).catch(() => [])
  ])
    .then(([productsRaw, configsRaw]) => {
      marginCatalogCache.set(key, {
        productsRaw,
        configsRaw,
        expiresAt: Date.now() + MARGIN_CATALOG_TTL_MS
      });
      return { productsRaw, configsRaw };
    })
    .finally(() => {
      inFlightMarginCatalog.delete(key);
    });

  inFlightMarginCatalog.set(key, promise);
  return promise;
}

export function createMarginGovernanceRouter(): Router {
  const router = Router();

  /**
   * GET /api/admin/margins/products
   * Server-filtered, sorted, paginated product margin governance query + live summary metrics.
   */
  router.get('/products', async (req: Request, res: Response): Promise<void> => {
    const authResult = await verifyAdminCaller(req);
    if (!authResult.ok) {
      const authErr = authResult as Extract<typeof authResult, { ok: false }>;
      res.status(authErr.status).json({ success: false, error: authErr.error });
      return;
    }

    try {
      const { caller } = authResult;
      const { productsRaw, configsRaw } = await listMarginCatalogCached(caller.idToken);

      const cfgByProdId = new Map<string, Record<string, any>>();
      configsRaw.forEach((c) => {
        if (c?.productId) cfgByProdId.set(c.productId, c);
      });

      const nowMs = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      const joined = productsRaw
        .filter((p) => p && p.id && p.isDeleted !== true && p.status !== 'DELETED')
        .map((p) => {
          const cfg = cfgByProdId.get(p.id);
          const effectiveMarginType: MarginTypeMode =
            cfg?.marginType === 'FIXED' || p.marginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
          const effectivePct =
            cfg?.b2bAgentMarkupPercent ??
            p.b2bAgentMarkupPercent ??
            p.defaultMarkupPercent;
          const effectiveFixed = cfg?.marginFixed ?? p.marginFixed;
          const effectiveValue =
            cfg?.marginValue !== undefined
              ? Number(cfg.marginValue)
              : (effectiveMarginType === 'FIXED'
                  ? (effectiveFixed !== undefined ? Number(effectiveFixed) : undefined)
                  : (effectivePct !== undefined ? Number(effectivePct) : undefined));
          const isExplicitInactive =
            cfg?.status === 'INACTIVE' ||
            p.marginStatus === 'INACTIVE' ||
            p.status === 'ARCHIVED';
          const configStatus: 'CONFIGURED' | 'NOT_CONFIGURED' | 'INACTIVE' = isExplicitInactive
            ? 'INACTIVE'
            : (effectiveValue !== undefined && effectiveValue !== null && !Number.isNaN(Number(effectiveValue)))
              ? 'CONFIGURED'
              : 'NOT_CONFIGURED';

          return {
            product: {
              ...p,
              ...(effectivePct !== undefined ? { b2bAgentMarkupPercent: Number(effectivePct), defaultMarkupPercent: Number(effectivePct) } : {}),
              marginType: effectiveMarginType,
              ...(effectiveFixed !== undefined ? { marginFixed: Number(effectiveFixed) } : {}),
              commissionPercent: cfg?.commissionPercent ?? p.commissionPercent ?? 0,
              marginStatus: cfg?.status || p.marginStatus || 'ACTIVE',
              marginConfigVersion: cfg?.version ?? p.marginConfigVersion ?? 0
            } as Record<string, any>,
            marginConfig: cfg || null,
            configStatus,
            effectiveMarginType,
            effectiveMarginValue: effectiveValue ?? null,
            updatedAt: cfg?.updatedAt || p.marginUpdatedAt || p.updatedAt || ''
          };
        });

      const summary = {
        totalProducts: joined.length,
        configuredCount: joined.filter((j) => j.configStatus === 'CONFIGURED').length,
        unconfiguredCount: joined.filter((j) => j.configStatus === 'NOT_CONFIGURED').length,
        inactiveCount: joined.filter((j) => j.configStatus === 'INACTIVE').length,
        recentlyUpdatedCount: joined.filter((j) => {
          const ts = j.updatedAt ? new Date(j.updatedAt).getTime() : 0;
          return ts > 0 && nowMs - ts <= sevenDaysMs;
        }).length
      };

      // Server-side filters
      const q = String(req.query.q || '').trim().toLowerCase();
      const category = String(req.query.category || 'ALL');
      const destinationId = String(req.query.destinationId || 'ALL');
      const regionId = String(req.query.regionId || 'ALL');
      const hubId = String(req.query.hubId || 'ALL');
      const supplierId = String(req.query.supplierId || 'ALL');
      const productStatus = String(req.query.productStatus || 'ALL');
      const marginStatus = String(req.query.marginStatus || 'ALL');
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(String(req.query.pageSize || '25'), 10) || 25));

      const filtered = joined.filter((item) => {
        const p = item.product;
        if (q) {
          const hay = `${p.name || ''} ${p.id || ''} ${p.sku || ''} ${p.destinationName || ''} ${p.city || ''} ${p.supplierName || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (category !== 'ALL' && p.category !== category) return false;
        if (destinationId !== 'ALL' && p.destinationId !== destinationId) return false;
        if (regionId !== 'ALL' && p.regionId !== regionId) return false;
        if (hubId !== 'ALL' && p.hubId !== hubId && !(Array.isArray(p.hubIds) && p.hubIds.includes(hubId))) return false;
        if (supplierId !== 'ALL' && p.supplierId !== supplierId) return false;
        if (productStatus !== 'ALL' && p.status !== productStatus) return false;
        if (marginStatus !== 'ALL' && item.configStatus !== marginStatus) return false;
        return true;
      });

      const totalFiltered = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const rows = filtered.slice(start, start + pageSize);

      res.status(200).json({
        success: true,
        summary,
        pagination: {
          page: safePage,
          pageSize,
          totalItems: totalFiltered,
          totalPages
        },
        rows
      });
    } catch (err: any) {
      console.error('[MARGIN-GOV] GET /products failed:', err);
      res.status(500).json({ success: false, error: err?.message || 'Failed to query product margin governance records.' });
    }
  });

  /**
   * GET /api/admin/margins/products/:productId
   * Fetch single product margin configuration & recent audit logs.
   */
  router.get('/products/:productId', async (req: Request, res: Response): Promise<void> => {
    const authResult = await verifyAdminCaller(req);
    if (!authResult.ok) {
      const authErr = authResult as Extract<typeof authResult, { ok: false }>;
      res.status(authErr.status).json({ success: false, error: authErr.error });
      return;
    }

    try {
      const productId = String(req.params.productId || '').trim();
      if (!productId) {
        res.status(400).json({ success: false, error: 'Product ID is required.' });
        return;
      }
      const { caller } = authResult;
      const [prodSnap, cfgSnap, allLogs] = await Promise.all([
        firestoreGetDoc('products', productId, caller.idToken),
        firestoreGetDoc('product_margin_configs', productId, caller.idToken),
        firestoreListCollection('product_margin_audit_logs', caller.idToken, 500).catch(() => [])
      ]);

      if (!prodSnap.exists || !prodSnap.data) {
        res.status(404).json({ success: false, error: `Product "${productId}" not found.` });
        return;
      }

      const auditLogs = allLogs
        .filter((l) => l.productId === productId)
        .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

      res.status(200).json({
        success: true,
        product: prodSnap.data,
        marginConfig: cfgSnap.data,
        auditLogs
      });
    } catch (err: any) {
      console.error('[MARGIN-GOV] GET /products/:productId failed:', err);
      res.status(500).json({ success: false, error: err?.message || 'Failed to fetch product margin detail.' });
    }
  });

  /**
   * POST /api/admin/margins/products/:productId
   * Authoritative transactional single-product margin update with optimistic concurrency.
   */
  router.post('/products/:productId', async (req: Request, res: Response): Promise<void> => {
    const authResult = await verifyAdminCaller(req);
    if (!authResult.ok) {
      const authErr = authResult as Extract<typeof authResult, { ok: false }>;
      res.status(authErr.status).json({ success: false, error: authErr.error });
      return;
    }

    const productId = String(req.params.productId || '').trim();
    if (!productId) {
      res.status(400).json({ success: false, error: 'Product ID is required.' });
      return;
    }

    const validation = validateMarginPayload(req.body);
    if (!validation.valid || !validation.normalized) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', error: validation.error });
      return;
    }

    try {
      const result = await executeTransactionalProductMarginUpdate({
        productId,
        input: validation.normalized,
        caller: authResult.caller
      });

      if (!result.ok) {
        const failure = result as Extract<typeof result, { ok: false }>;
        res.status(failure.status).json({
          success: false,
          code: failure.code,
          error: failure.error,
          currentVersion: failure.currentVersion,
          currentConfig: failure.currentConfig
        });
        return;
      }

      invalidateMarginGovernanceCache();
      res.status(200).json({
        success: true,
        product: result.updatedProduct,
        marginConfig: result.marginConfig,
        auditLog: result.auditLog
      });
    } catch (err: any) {
      console.error('[MARGIN-GOV] POST /products/:productId failed:', err);
      const status = typeof err?.httpStatus === 'number' ? err.httpStatus : 500;
      res.status(status).json({
        success: false,
        code: 'TRANSACTION_FAILED',
        error: err?.message || 'Transactional Firestore persistence failed.'
      });
    }
  });

  /**
   * POST /api/admin/margins/bulk
   * Bounded bulk update with per-product isolation and partial-failure reporting.
   */
  router.post('/bulk', async (req: Request, res: Response): Promise<void> => {
    const authResult = await verifyAdminCaller(req);
    if (!authResult.ok) {
      const authErr = authResult as Extract<typeof authResult, { ok: false }>;
      res.status(authErr.status).json({ success: false, error: authErr.error });
      return;
    }

    const rawIds = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
    const productIds: string[] = Array.from(new Set(rawIds.map((id: any) => String(id || '').trim()).filter(Boolean)));
    if (productIds.length === 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', error: 'At least one product must be selected for bulk update.' });
      return;
    }
    if (productIds.length > 100) {
      res.status(400).json({ success: false, code: 'BATCH_LIMIT_EXCEEDED', error: 'Bulk update is bounded to 100 products per request.' });
      return;
    }

    const validation = validateMarginPayload({
      ...req.body,
      changeSource: 'BULK_GOVERNANCE'
    });
    if (!validation.valid || !validation.normalized) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', error: validation.error });
      return;
    }

    const batchId = validation.normalized.batchId || `BULK-MG-${Date.now()}`;
    const expectedVersions: Record<string, number> =
      req.body?.expectedVersions && typeof req.body.expectedVersions === 'object'
        ? req.body.expectedVersions
        : {};

    const updatedProducts: Record<string, any>[] = [];
    const updatedConfigs: Record<string, any>[] = [];
    const auditLogs: Record<string, any>[] = [];
    const succeededIds: string[] = [];
    const failedItems: Array<{ productId: string; code: string; error: string }> = [];

    // Execute in bounded chunks of 5 concurrent transactions
    const CHUNK_SIZE = 5;
    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      const chunk = productIds.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (pid) => {
          try {
            const perItemInput: MarginUpdateInput = {
              ...validation.normalized!,
              batchId,
              expectedVersion:
                expectedVersions[pid] !== undefined ? Number(expectedVersions[pid]) : undefined
            };
            const r = await executeTransactionalProductMarginUpdate({
              productId: pid,
              input: perItemInput,
              caller: authResult.caller
            });
            if (r.ok) {
              succeededIds.push(pid);
              updatedProducts.push(r.updatedProduct);
              updatedConfigs.push(r.marginConfig);
              auditLogs.push(r.auditLog);
            } else {
              const failure = r as Extract<typeof r, { ok: false }>;
              failedItems.push({ productId: pid, code: failure.code, error: failure.error });
            }
          } catch (err: any) {
            failedItems.push({
              productId: pid,
              code: 'TRANSACTION_FAILED',
              error: err?.message || 'Unexpected error during Firestore commit.'
            });
          }
        })
      );
    }

    if (succeededIds.length > 0) {
      invalidateMarginGovernanceCache();
    }
    const status = failedItems.length > 0 && succeededIds.length === 0 ? 409 : 200;
    res.status(status).json({
      success: failedItems.length === 0,
      partialSuccess: succeededIds.length > 0 && failedItems.length > 0,
      batchId,
      totalRequested: productIds.length,
      succeededIds,
      failedItems,
      updatedProducts,
      updatedConfigs,
      auditLogs
    });
  });

  /**
   * GET /api/admin/margins/audit
   * Returns recent margin governance audit logs (optionally filtered by productId).
   */
  router.get('/audit', async (req: Request, res: Response): Promise<void> => {
    const authResult = await verifyAdminCaller(req);
    if (!authResult.ok) {
      const authErr = authResult as Extract<typeof authResult, { ok: false }>;
      res.status(authErr.status).json({ success: false, error: authErr.error });
      return;
    }

    try {
      const productId = String(req.query.productId || '').trim();
      const all = await firestoreListCollection('product_margin_audit_logs', authResult.caller.idToken, 500);
      const filtered = (productId ? all.filter((l) => l.productId === productId) : all)
        .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
        .slice(0, 100);
      res.status(200).json({ success: true, logs: filtered });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to read margin audit logs.' });
    }
  });

  return router;
}
