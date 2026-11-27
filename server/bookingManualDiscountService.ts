import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AdminManualDiscountApplyPayload,
  AdminManualDiscountReversePayload,
  Booking,
  BookingManualDiscountAdjustment,
  BookingManualDiscountPermissions,
  BookingManualDiscountPreview,
  BookingManualDiscountReportSummary,
  BookingPricingSnapshot,
  PaymentSchedule,
  Promotion
} from '../src/types';
import {
  buildApplyManualDiscountCommit,
  buildBookingManualDiscountReport,
  buildInitialBookingPricingSnapshot,
  buildReverseManualDiscountCommit,
  calculateBookingManualDiscountPreview,
  getLatestBookingPricingSnapshot,
  PaymentScheduleRecalculationPreview,
  PaymentScheduleTrancheInput,
  previewPaymentScheduleRecalculation,
  resolveAdminManualDiscountPermissions,
  roundMoney,
  validateAndBuildVersionedPaymentSchedule
} from '../src/services/bookingManualDiscountEngine';
import { findPromotionByCode, normalizePromotionCode } from '../src/services/promotionEngine';
import { fromFirestoreDocument, toFirestoreFields } from './marginGovernanceService';

// ============================================================================
// FIREBASE / FIRESTORE REST CONFIGURATION
// ============================================================================

const DEFAULT_PROJECT_ID = 'gen-lang-client-0981426327';
const DEFAULT_DATABASE_ID = 'ai-studio-theunbounddmctra-384adde8-26cf-49a7-8158-336473069762';

function getFirebaseConfig(): {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
} {
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'firebase-applet-config.json')
    ];
    for (const configPath of candidatePaths) {
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return {
          projectId: parsed.projectId || DEFAULT_PROJECT_ID,
          apiKey: parsed.apiKey || '',
          firestoreDatabaseId: parsed.firestoreDatabaseId || DEFAULT_DATABASE_ID
        };
      }
    }
  } catch (err) {
    console.warn('[MANUAL-DISCOUNT-SVC] Could not read firebase-applet-config.json:', err);
  }
  return {
    projectId: DEFAULT_PROJECT_ID,
    apiKey: '',
    firestoreDatabaseId: DEFAULT_DATABASE_ID
  };
}

function getFirestoreBaseUrl(): string {
  const cfg = getFirebaseConfig();
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
}

const MASTER_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

export interface VerifiedAdminCaller {
  uid: string;
  email: string;
  name: string;
  role: string;
  userDoc: Record<string, any> | null;
  idToken: string;
  permissions: BookingManualDiscountPermissions;
}

async function verifyAdminCaller(
  req: Request
): Promise<
  { ok: true; caller: VerifiedAdminCaller } | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required: missing Bearer Firebase ID token.'
    };
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required: empty Firebase ID token.'
    };
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
      return { ok: false, status: 401, error: 'Authenticated user account not found or disabled.' };
    }
    uid = fbUser.localId;
    email = (fbUser.email || '').trim().toLowerCase();
    displayName = fbUser.displayName || '';
  } catch (err: any) {
    return {
      ok: false,
      status: 503,
      error: `Unable to verify authentication token: ${err?.message || 'network error'}`
    };
  }

  let userDoc: Record<string, any> | null = null;
  try {
    const userRes = await fetch(`${getFirestoreBaseUrl()}/users/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(5000)
    });
    if (userRes.ok) {
      userDoc = fromFirestoreDocument(await userRes.json());
    }
  } catch {
    // Profile doc optional for newly provisioned accounts
  }

  const resolvedRole = String(
    userDoc?.role || userDoc?.userType || (MASTER_ADMIN_EMAILS.has(email) ? 'SUPER_ADMIN' : 'B2B_AGENT')
  ).toUpperCase();

  const permissions = resolveAdminManualDiscountPermissions({
    ...(userDoc || {}),
    id: uid,
    email,
    role: resolvedRole
  });

  // Block any external user (B2B_AGENT, BUYER, etc.) or unauthorized staff immediately at the API gateway
  const hasAnyAdminFinancialAccess =
    permissions.canViewInternalMargin ||
    permissions.canApplyManualDiscount ||
    permissions.canApplyAdminCoupon ||
    permissions.canReverseManualDiscount ||
    permissions.canViewDiscountReports ||
    permissions.canManagePaymentSchedule;

  if (!hasAnyAdminFinancialAccess) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Your account does not have internal financial or booking discount/schedule permissions.'
    };
  }

  return {
    ok: true,
    caller: {
      uid,
      email: email || userDoc?.email || '',
      name: userDoc?.name || userDoc?.displayName || displayName || email || 'Admin',
      role: resolvedRole,
      userDoc,
      idToken,
      permissions
    }
  };
}

// ============================================================================
// STORE ADAPTER (PRODUCTION FIRESTORE REST + IN-MEMORY TESTABLE ADAPTER)
// ============================================================================

export interface BookingDiscountStoreAdapter {
  getBooking(bookingId: string, token: string): Promise<Booking | null>;
  listBookings(token: string): Promise<Booking[]>;
  saveBooking(booking: Booking, token: string): Promise<void>;
  listPromotions(token: string): Promise<Promotion[]>;
  savePromotion(promotion: Promotion, token: string): Promise<void>;
  listSnapshots(token: string, bookingId?: string): Promise<BookingPricingSnapshot[]>;
  saveSnapshot(snapshot: BookingPricingSnapshot, token: string): Promise<void>;
  listAdjustments(token: string, bookingId?: string): Promise<BookingManualDiscountAdjustment[]>;
  saveAdjustment(adjustment: BookingManualDiscountAdjustment, token: string): Promise<void>;
  listPaymentSchedules?(token: string, bookingId: string): Promise<PaymentSchedule[]>;
  savePaymentSchedule?(schedule: PaymentSchedule, token: string): Promise<void>;
  saveAuditLog(log: Record<string, any>, token: string): Promise<void>;
  countInvoicesForBooking(bookingId: string, token: string): Promise<number>;
}

async function fsListCollection(
  collectionId: string,
  token: string,
  maxDocs = 1000
): Promise<Record<string, any>[]> {
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collectionId)}?pageSize=${Math.min(maxDocs, 1000)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000)
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore list failed for ${collectionId} (${res.status}): ${errText}`);
  }
  const json = (await res.json()) as any;
  const docs = Array.isArray(json.documents) ? json.documents : [];
  return docs
    .map((d: any) => fromFirestoreDocument(d))
    .filter((d): d is Record<string, any> => Boolean(d));
}

/**
 * Executes a scoped Firestore structured query filtered by an exact string field
 * (e.g. `bookingId == '...'` or `couponId == '...'`) via `:runQuery` so single-booking
 * operations NEVER perform an unfiltered full-collection list.
 */
export async function fsQueryCollectionByField(
  collectionId: string,
  fieldPath: string,
  stringValue: string,
  token: string,
  maxDocs = 500
): Promise<Record<string, any>[]> {
  const url = `${getFirestoreBaseUrl()}:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: { stringValue }
          }
        },
        limit: Math.min(maxDocs, 1000)
      }
    }),
    signal: AbortSignal.timeout(8000)
  });

  if (res.status === 404) return [];
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore query failed for ${collectionId} where ${fieldPath}==${stringValue} (${res.status}): ${errText}`);
  }

  const rows = (await res.json()) as any[];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(r => r && r.document)
    .map(r => fromFirestoreDocument(r.document))
    .filter((d): d is Record<string, any> => Boolean(d));
}

async function fsGetDoc(
  collectionId: string,
  docId: string,
  token: string
): Promise<Record<string, any> | null> {
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collectionId)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000)
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore get failed for ${collectionId}/${docId} (${res.status}): ${errText}`);
  }
  return fromFirestoreDocument(await res.json());
}

async function fsWriteDoc(
  collectionId: string,
  docId: string,
  data: Record<string, any>,
  token: string,
  createOnly = false
): Promise<void> {
  const cleanPayload = JSON.parse(JSON.stringify(data));
  const query = createOnly ? '?currentDocument.exists=false' : '';
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collectionId)}/${encodeURIComponent(docId)}${query}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: toFirestoreFields(cleanPayload) }),
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore write failed for ${collectionId}/${docId} (${res.status}): ${errText}`);
  }
}

export class FirestoreBookingDiscountStore implements BookingDiscountStoreAdapter {
  async getBooking(bookingId: string, token: string): Promise<Booking | null> {
    const doc = await fsGetDoc('bookings', bookingId, token);
    return doc ? (doc as Booking) : null;
  }

  async listBookings(token: string): Promise<Booking[]> {
    return (await fsListCollection('bookings', token)) as Booking[];
  }

  async saveBooking(booking: Booking, token: string): Promise<void> {
    await fsWriteDoc('bookings', booking.id, booking as any, token, false);
  }

  async listPromotions(token: string): Promise<Promotion[]> {
    return (await fsListCollection('promotions', token)) as Promotion[];
  }

  async savePromotion(promotion: Promotion, token: string): Promise<void> {
    await fsWriteDoc('promotions', promotion.id, promotion as any, token, false);
  }

  async listSnapshots(token: string, bookingId?: string): Promise<BookingPricingSnapshot[]> {
    if (bookingId) {
      return (await fsQueryCollectionByField(
        'booking_pricing_snapshots',
        'bookingId',
        bookingId,
        token
      )) as BookingPricingSnapshot[];
    }
    return (await fsListCollection('booking_pricing_snapshots', token)) as BookingPricingSnapshot[];
  }

  async saveSnapshot(snapshot: BookingPricingSnapshot, token: string): Promise<void> {
    await fsWriteDoc('booking_pricing_snapshots', snapshot.snapshotId, snapshot as any, token, true);
  }

  async listAdjustments(token: string, bookingId?: string): Promise<BookingManualDiscountAdjustment[]> {
    if (bookingId) {
      return (await fsQueryCollectionByField(
        'booking_manual_discounts',
        'bookingId',
        bookingId,
        token
      )) as BookingManualDiscountAdjustment[];
    }
    return (await fsListCollection('booking_manual_discounts', token)) as BookingManualDiscountAdjustment[];
  }

  async saveAdjustment(adjustment: BookingManualDiscountAdjustment, token: string): Promise<void> {
    await fsWriteDoc('booking_manual_discounts', adjustment.adjustmentId, adjustment as any, token, true);
  }

  async listPaymentSchedules(token: string, bookingId: string): Promise<PaymentSchedule[]> {
    return (await fsQueryCollectionByField(
      'booking_payment_schedules',
      'bookingId',
      bookingId,
      token
    )) as PaymentSchedule[];
  }

  async savePaymentSchedule(schedule: PaymentSchedule, token: string): Promise<void> {
    const scheduleId = schedule.scheduleId || `ps-${schedule.bookingId}-v${schedule.scheduleVersion || 1}`;
    await fsWriteDoc(
      'booking_payment_schedules',
      scheduleId,
      { ...schedule, scheduleId, immutable: true },
      token,
      true
    );
  }

  async saveAuditLog(log: Record<string, any>, token: string): Promise<void> {
    const id = log.id || `audit-bmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await fsWriteDoc('audit_logs', id, { ...log, id }, token, false);
  }

  async countInvoicesForBooking(bookingId: string, token: string): Promise<number> {
    try {
      const invoices = await fsQueryCollectionByField('invoices', 'bookingId', bookingId, token);
      return invoices.filter((inv: any) => inv.status !== 'DELETED').length;
    } catch {
      return 0;
    }
  }
}

/**
 * In-memory deterministic store implementing the exact production store interface.
 * Enables automated acceptance tests (including concurrent Admin locks & idempotency replays)
 * against the exact BookingManualDiscountTransactionManager logic.
 */
export class InMemoryBookingDiscountStore implements BookingDiscountStoreAdapter {
  public bookings = new Map<string, Booking>();
  public promotions = new Map<string, Promotion>();
  public snapshots = new Map<string, BookingPricingSnapshot>();
  public adjustments = new Map<string, BookingManualDiscountAdjustment>();
  public paymentSchedules = new Map<string, PaymentSchedule>();
  public auditLogs: Record<string, any>[] = [];
  public invoiceCounts = new Map<string, number>();

  async getBooking(bookingId: string): Promise<Booking | null> {
    const b = this.bookings.get(bookingId);
    return b ? JSON.parse(JSON.stringify(b)) : null;
  }

  async listBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values()).map(b => JSON.parse(JSON.stringify(b)));
  }

  async saveBooking(booking: Booking): Promise<void> {
    this.bookings.set(booking.id, JSON.parse(JSON.stringify(booking)));
  }

  async listPromotions(): Promise<Promotion[]> {
    return Array.from(this.promotions.values()).map(p => JSON.parse(JSON.stringify(p)));
  }

  async savePromotion(promotion: Promotion): Promise<void> {
    this.promotions.set(promotion.id, JSON.parse(JSON.stringify(promotion)));
  }

  async listSnapshots(_token: string, bookingId?: string): Promise<BookingPricingSnapshot[]> {
    const all = Array.from(this.snapshots.values()).map(s => JSON.parse(JSON.stringify(s)));
    return bookingId ? all.filter(s => s.bookingId === bookingId) : all;
  }

  async saveSnapshot(snapshot: BookingPricingSnapshot): Promise<void> {
    if (this.snapshots.has(snapshot.snapshotId)) {
      throw new Error(`Immutable snapshot conflict: ${snapshot.snapshotId} already exists.`);
    }
    this.snapshots.set(snapshot.snapshotId, JSON.parse(JSON.stringify(snapshot)));
  }

  async listAdjustments(_token: string, bookingId?: string): Promise<BookingManualDiscountAdjustment[]> {
    const all = Array.from(this.adjustments.values()).map(a => JSON.parse(JSON.stringify(a)));
    return bookingId ? all.filter(a => a.bookingId === bookingId) : all;
  }

  async saveAdjustment(adjustment: BookingManualDiscountAdjustment): Promise<void> {
    if (this.adjustments.has(adjustment.adjustmentId)) {
      throw new Error(`Immutable adjustment conflict: ${adjustment.adjustmentId} already exists.`);
    }
    this.adjustments.set(adjustment.adjustmentId, JSON.parse(JSON.stringify(adjustment)));
  }

  async listPaymentSchedules(_token: string, bookingId: string): Promise<PaymentSchedule[]> {
    const all = Array.from(this.paymentSchedules.values()).map(s => JSON.parse(JSON.stringify(s)));
    return all.filter(s => s.bookingId === bookingId);
  }

  async savePaymentSchedule(schedule: PaymentSchedule): Promise<void> {
    const scheduleId = schedule.scheduleId || `ps-${schedule.bookingId}-v${schedule.scheduleVersion || 1}`;
    if (this.paymentSchedules.has(scheduleId)) {
      throw new Error(`Immutable payment schedule conflict: ${scheduleId} already exists.`);
    }
    this.paymentSchedules.set(scheduleId, JSON.parse(JSON.stringify({ ...schedule, scheduleId, immutable: true })));
  }

  async saveAuditLog(log: Record<string, any>): Promise<void> {
    this.auditLogs.push(JSON.parse(JSON.stringify(log)));
  }

  async countInvoicesForBooking(bookingId: string): Promise<number> {
    return this.invoiceCounts.get(bookingId) || 0;
  }
}

// ============================================================================
// TRANSACTION MANAGER WITH PER-BOOKING SERIALIZED LOCK & IDEMPOTENCY
// ============================================================================

export class BookingManualDiscountTransactionManager {
  private readonly bookingLocks = new Map<string, Promise<void>>();
  private readonly store: BookingDiscountStoreAdapter;

  constructor(store: BookingDiscountStoreAdapter) {
    this.store = store;
  }

  private async withBookingLock<T>(bookingId: string, task: () => Promise<T>): Promise<T> {
    const prior = this.bookingLocks.get(bookingId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    const chained = prior.then(() => current);
    this.bookingLocks.set(bookingId, chained);

    await prior;
    try {
      return await task();
    } finally {
      release();
      if (this.bookingLocks.get(bookingId) === chained) {
        this.bookingLocks.delete(bookingId);
      }
    }
  }

  private async resolveCoupon(
    payload: { couponId?: string; couponCode?: string },
    token: string
  ): Promise<{ coupon: Promotion | null; allPromotions: Promotion[] }> {
    const allPromotions = await this.store.listPromotions(token);
    if (payload.couponId) {
      const byId = allPromotions.find(p => p.id === payload.couponId) || null;
      if (byId) return { coupon: byId, allPromotions };
    }
    if (payload.couponCode) {
      const byCode = findPromotionByCode(allPromotions, payload.couponCode) || null;
      return { coupon: byCode, allPromotions };
    }
    return { coupon: null, allPromotions };
  }

  public async previewDiscount(params: {
    bookingId: string;
    payload: Partial<AdminManualDiscountApplyPayload>;
    caller: Pick<VerifiedAdminCaller, 'uid' | 'email' | 'name' | 'role' | 'permissions' | 'idToken'>;
  }): Promise<{ ok: true; preview: BookingManualDiscountPreview } | { ok: false; status: number; error: string }> {
    const { bookingId, payload, caller } = params;
    if (!caller.permissions.canViewInternalMargin) {
      return { ok: false, status: 403, error: 'Forbidden: missing internal margin visibility permission.' };
    }

    const booking = await this.store.getBooking(bookingId, caller.idToken);
    if (!booking) {
      return { ok: false, status: 404, error: `Booking "${bookingId}" not found.` };
    }

    const [snapshots, adjustments, invoiceCount] = await Promise.all([
      this.store.listSnapshots(caller.idToken, bookingId),
      this.store.listAdjustments(caller.idToken, bookingId),
      this.store.countInvoicesForBooking(bookingId, caller.idToken)
    ]);

    const { coupon } = payload.discountSource === 'ADMIN_MANUAL_COUPON'
      ? await this.resolveCoupon(payload, caller.idToken)
      : { coupon: null };

    let couponUsageCount = 0;
    if (coupon) {
      const allAdjustments = await this.store.listAdjustments(caller.idToken);
      const reversedIds = new Set(
        allAdjustments.filter(a => a.actionType === 'REVERSE' && a.reversedAdjustmentId).map(a => a.reversedAdjustmentId)
      );
      couponUsageCount = allAdjustments.filter(
        a => a.actionType === 'APPLY' && a.couponId === coupon.id && !reversedIds.has(a.adjustmentId)
      ).length;
    }

    const preview = calculateBookingManualDiscountPreview({
      booking: {
        ...booking,
        pricingSnapshotHistory: snapshots.length > 0 ? snapshots : booking.pricingSnapshotHistory,
        manualDiscountAdjustments: adjustments.length > 0 ? adjustments : booking.manualDiscountAdjustments
      },
      discountSource: payload.discountSource || 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: payload.discountType || 'FIXED',
      discountValue: Number(payload.discountValue || 0),
      discountCurrency: payload.discountCurrency,
      coupon,
      couponUsageCount,
      allowMarginOverride: Boolean(payload.allowMarginOverride),
      marginOverrideReason: payload.marginOverrideReason,
      approvalReference: payload.approvalReference,
      permissions: caller.permissions,
      externalSnapshots: snapshots.length > 0 ? snapshots : undefined,
      existingInvoicesCount: Math.max(invoiceCount, booking.proformaInvoiceIds?.length || 0)
    });

    return { ok: true, preview };
  }

  public async applyDiscount(params: {
    bookingId: string;
    payload: AdminManualDiscountApplyPayload;
    caller: Pick<VerifiedAdminCaller, 'uid' | 'email' | 'name' | 'role' | 'permissions' | 'idToken'>;
  }): Promise<
    | {
        ok: true;
        idempotentReplay: boolean;
        adjustment: BookingManualDiscountAdjustment;
        newSnapshot: BookingPricingSnapshot;
        updatedBooking: Booking;
        preview: BookingManualDiscountPreview;
      }
    | {
        ok: false;
        status: number;
        error: string;
        preview?: BookingManualDiscountPreview;
      }
  > {
    const { bookingId, payload, caller } = params;

    return this.withBookingLock(bookingId, async () => {
      const booking = await this.store.getBooking(bookingId, caller.idToken);
      if (!booking) {
        return { ok: false, status: 404, error: `Booking "${bookingId}" not found.` };
      }

      const [snapshots, adjustments, invoiceCount] = await Promise.all([
        this.store.listSnapshots(caller.idToken, bookingId),
        this.store.listAdjustments(caller.idToken, bookingId),
        this.store.countInvoicesForBooking(bookingId, caller.idToken)
      ]);

      // 1. Idempotency replay check inside lock
      if (payload.idempotencyKey && payload.idempotencyKey.trim()) {
        const cleanKey = payload.idempotencyKey.trim();
        const existingMatch = adjustments.find(
          a => a.actionType === 'APPLY' && a.idempotencyKey === cleanKey
        );
        if (existingMatch) {
          const matchingSnap =
            snapshots.find(s => s.snapshotId === existingMatch.resultingSnapshotId) ||
            getLatestBookingPricingSnapshot(booking, snapshots);
          const preview = calculateBookingManualDiscountPreview({
            booking,
            discountSource: existingMatch.discountSource,
            discountType: existingMatch.discountType,
            discountValue: existingMatch.discountValue,
            discountCurrency: existingMatch.discountCurrency,
            permissions: caller.permissions,
            externalSnapshots: snapshots
          });
          return {
            ok: true,
            idempotentReplay: true,
            adjustment: existingMatch,
            newSnapshot: matchingSnap,
            updatedBooking: booking,
            preview
          };
        }
      }

      // 2. Resolve Admin coupon if applicable
      const { coupon } = payload.discountSource === 'ADMIN_MANUAL_COUPON'
        ? await this.resolveCoupon(payload, caller.idToken)
        : { coupon: null };

      let couponUsageCount = 0;
      if (coupon) {
        const allAdjustments = await this.store.listAdjustments(caller.idToken);
        const reversedIds = new Set(
          allAdjustments
            .filter(a => a.actionType === 'REVERSE' && a.reversedAdjustmentId)
            .map(a => a.reversedAdjustmentId)
        );
        couponUsageCount = allAdjustments.filter(
          a => a.actionType === 'APPLY' && a.couponId === coupon.id && !reversedIds.has(a.adjustmentId)
        ).length;
      }

      // 3. Authoritative calculation via Central Pricing Engine
      const commit = buildApplyManualDiscountCommit({
        booking,
        payload: { ...payload, bookingId },
        actor: {
          id: caller.uid,
          name: caller.name,
          email: caller.email,
          role: caller.role
        },
        permissions: caller.permissions,
        coupon,
        couponUsageCount,
        externalSnapshots: snapshots.length > 0 ? snapshots : undefined,
        externalAdjustments: adjustments.length > 0 ? adjustments : undefined,
        existingInvoicesCount: Math.max(invoiceCount, booking.proformaInvoiceIds?.length || 0)
      });

      if (!commit.ok) {
        // Audit rejected attempt without modifying booking
        await this.store.saveAuditLog(
          {
            id: `audit-bmd-rej-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            action: 'BOOKING_MANUAL_DISCOUNT_REJECTED',
            entityType: 'Booking',
            entityId: booking.id,
            userId: caller.uid,
            userName: caller.name,
            userRole: caller.role,
            timestamp: new Date().toISOString(),
            details: `Manual discount rejected on ${booking.bookingReference}: ${commit.error}`,
            metadata: {
              bookingReference: booking.bookingReference,
              requestedDiscountAmount: commit.preview.requestedDiscountAmount,
              availableMarginBeforeDiscount: commit.preview.availableMarginBeforeDiscount,
              marginProtectionBlocked: commit.preview.marginProtectionBlocked,
              couponCode: commit.preview.couponCode || payload.couponCode
            }
          },
          caller.idToken
        );
        const status = commit.preview.validationErrors.some(e =>
          e.toLowerCase().includes('permission') || e.toLowerCase().includes('denied')
        )
          ? 403
          : 400;
        return {
          ok: false,
          status,
          error: commit.error,
          preview: commit.preview
        };
      }

      // 4. Persist immutable baseline snapshot (if first adjustment), immutable adjustment,
      //    immutable new snapshot, and only then update booking projection + coupon usage counter
      if (commit.initialSnapshotToPersist) {
        await this.store.saveSnapshot(commit.initialSnapshotToPersist, caller.idToken);
      }
      await this.store.saveAdjustment(commit.adjustment, caller.idToken);
      await this.store.saveSnapshot(commit.newSnapshot, caller.idToken);
      await this.store.saveBooking(commit.updatedBooking, caller.idToken);

      if (coupon) {
        const updatedCoupon: Promotion = {
          ...coupon,
          adminManualRedemptionsCount: (coupon.adminManualRedemptionsCount || 0) + 1,
          adminManualDiscountValueGranted: roundMoney(
            (coupon.adminManualDiscountValueGranted || 0) +
              commit.adjustment.discountAmountInBookingCurrency
          ),
          updatedAt: commit.adjustment.appliedAt
        };
        await this.store.savePromotion(updatedCoupon, caller.idToken);
      }

      // 5. Immutable Audit Log
      await this.store.saveAuditLog(
        {
          id: `audit-bmd-app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: 'BOOKING_MANUAL_DISCOUNT_APPLIED',
          entityType: 'Booking',
          entityId: booking.id,
          userId: caller.uid,
          userName: caller.name,
          userRole: caller.role,
          timestamp: commit.adjustment.appliedAt,
          details: `Admin manual discount (${commit.adjustment.discountSource}${commit.adjustment.couponCode ? ` · ${commit.adjustment.couponCode}` : ''}) of ${commit.adjustment.bookingCurrency} ${commit.adjustment.discountAmountInBookingCurrency.toLocaleString()} applied to ${booking.bookingReference}. Selling Price: ${commit.adjustment.sellingPriceBefore} -> ${commit.adjustment.sellingPriceAfter}. Remaining Margin: ${commit.adjustment.marginBefore} -> ${commit.adjustment.marginAfter}. Reason: ${commit.adjustment.reason}${commit.adjustment.marginOverrideUsed ? ` [LOSS OVERRIDE: ${commit.adjustment.marginOverrideReason}]` : ''}`,
          metadata: {
            adjustmentId: commit.adjustment.adjustmentId,
            snapshotId: commit.newSnapshot.snapshotId,
            snapshotVersion: commit.newSnapshot.version,
            couponCode: commit.adjustment.couponCode,
            supplierNettCost: commit.newSnapshot.supplierNettCost,
            marginBefore: commit.adjustment.marginBefore,
            marginAfter: commit.adjustment.marginAfter,
            sellingPriceBefore: commit.adjustment.sellingPriceBefore,
            sellingPriceAfter: commit.adjustment.sellingPriceAfter,
            marginOverrideUsed: commit.adjustment.marginOverrideUsed,
            marginOverrideReason: commit.adjustment.marginOverrideReason
          }
        },
        caller.idToken
      );

      return {
        ok: true,
        idempotentReplay: false,
        adjustment: commit.adjustment,
        newSnapshot: commit.newSnapshot,
        updatedBooking: commit.updatedBooking,
        preview: commit.preview
      };
    });
  }

  public async reverseDiscount(params: {
    bookingId: string;
    payload: AdminManualDiscountReversePayload;
    caller: Pick<VerifiedAdminCaller, 'uid' | 'email' | 'name' | 'role' | 'permissions' | 'idToken'>;
  }): Promise<
    | {
        ok: true;
        idempotentReplay: boolean;
        reversalAdjustment: BookingManualDiscountAdjustment;
        newSnapshot: BookingPricingSnapshot;
        updatedBooking: Booking;
      }
    | {
        ok: false;
        status: number;
        error: string;
      }
  > {
    const { bookingId, payload, caller } = params;

    return this.withBookingLock(bookingId, async () => {
      if (!caller.permissions.canReverseManualDiscount) {
        return {
          ok: false,
          status: 403,
          error: 'Forbidden: you do not have permission to reverse manual booking discounts.'
        };
      }

      const booking = await this.store.getBooking(bookingId, caller.idToken);
      if (!booking) {
        return { ok: false, status: 404, error: `Booking "${bookingId}" not found.` };
      }

      const [snapshots, adjustments, invoiceCount] = await Promise.all([
        this.store.listSnapshots(caller.idToken, bookingId),
        this.store.listAdjustments(caller.idToken, bookingId),
        this.store.countInvoicesForBooking(bookingId, caller.idToken)
      ]);

      // Idempotency replay check for reversal
      if (payload.idempotencyKey && payload.idempotencyKey.trim()) {
        const cleanKey = payload.idempotencyKey.trim();
        const existingReversal = adjustments.find(
          a => a.actionType === 'REVERSE' && a.idempotencyKey === cleanKey
        );
        if (existingReversal) {
          const matchingSnap =
            snapshots.find(s => s.snapshotId === existingReversal.resultingSnapshotId) ||
            getLatestBookingPricingSnapshot(booking, snapshots);
          return {
            ok: true,
            idempotentReplay: true,
            reversalAdjustment: existingReversal,
            newSnapshot: matchingSnap,
            updatedBooking: booking
          };
        }
      }

      // Optimistic concurrency check on reversal
      const latestSnap = getLatestBookingPricingSnapshot(booking, snapshots);
      if (
        typeof payload.expectedSnapshotVersion === 'number' &&
        payload.expectedSnapshotVersion !== latestSnap.version
      ) {
        return {
          ok: false,
          status: 409,
          error: `Pricing snapshot version conflict: expected v${payload.expectedSnapshotVersion}, but latest committed snapshot is v${latestSnap.version}. Please refresh and retry.`
        };
      }

      const commit = buildReverseManualDiscountCommit({
        booking,
        adjustmentId: payload.adjustmentId,
        reason: payload.reason,
        idempotencyKey: payload.idempotencyKey,
        actor: {
          id: caller.uid,
          name: caller.name,
          email: caller.email,
          role: caller.role
        },
        permissions: caller.permissions,
        externalSnapshots: snapshots.length > 0 ? snapshots : undefined,
        externalAdjustments: adjustments.length > 0 ? adjustments : undefined,
        existingInvoicesCount: Math.max(invoiceCount, booking.proformaInvoiceIds?.length || 0)
      });

      if (!commit.ok) {
        return { ok: false, status: 400, error: commit.error };
      }

      await this.store.saveAdjustment(commit.reversalAdjustment, caller.idToken);
      await this.store.saveSnapshot(commit.newSnapshot, caller.idToken);
      await this.store.saveBooking(commit.updatedBooking, caller.idToken);

      await this.store.saveAuditLog(
        {
          id: `audit-bmd-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: 'BOOKING_MANUAL_DISCOUNT_REVERSED',
          entityType: 'Booking',
          entityId: booking.id,
          userId: caller.uid,
          userName: caller.name,
          userRole: caller.role,
          timestamp: commit.reversalAdjustment.appliedAt,
          details: `Reversed manual discount adjustment ${payload.adjustmentId} (${commit.reversalAdjustment.bookingCurrency} ${commit.reversalAdjustment.discountAmountInBookingCurrency.toLocaleString()}) on ${booking.bookingReference}. Selling Price: ${commit.reversalAdjustment.sellingPriceBefore} -> ${commit.reversalAdjustment.sellingPriceAfter}. Remaining Margin: ${commit.reversalAdjustment.marginBefore} -> ${commit.reversalAdjustment.marginAfter}. Reason: ${commit.reversalAdjustment.reason}`,
          metadata: {
            reversalAdjustmentId: commit.reversalAdjustment.adjustmentId,
            reversedAdjustmentId: payload.adjustmentId,
            snapshotId: commit.newSnapshot.snapshotId,
            snapshotVersion: commit.newSnapshot.version,
            supplierNettCost: commit.newSnapshot.supplierNettCost
          }
        },
        caller.idToken
      );

      return {
        ok: true,
        idempotentReplay: false,
        reversalAdjustment: commit.reversalAdjustment,
        newSnapshot: commit.newSnapshot,
        updatedBooking: commit.updatedBooking
      };
    });
  }

  public async getBookingHistory(params: {
    bookingId: string;
    caller: Pick<VerifiedAdminCaller, 'uid' | 'permissions' | 'idToken'>;
  }): Promise<
    | {
        ok: true;
        baselineSnapshot: BookingPricingSnapshot;
        latestSnapshot: BookingPricingSnapshot;
        snapshots: BookingPricingSnapshot[];
        adjustments: BookingManualDiscountAdjustment[];
      }
    | { ok: false; status: number; error: string }
  > {
    const { bookingId, caller } = params;
    if (!caller.permissions.canViewInternalMargin) {
      return { ok: false, status: 403, error: 'Forbidden: missing internal margin visibility permission.' };
    }
    const booking = await this.store.getBooking(bookingId, caller.idToken);
    if (!booking) {
      return { ok: false, status: 404, error: `Booking "${bookingId}" not found.` };
    }
    const [snapshots, adjustments] = await Promise.all([
      this.store.listSnapshots(caller.idToken, bookingId),
      this.store.listAdjustments(caller.idToken, bookingId)
    ]);

    const mergedSnapshots =
      snapshots.length > 0
        ? [...snapshots].sort((a, b) => a.version - b.version)
        : (booking.pricingSnapshotHistory && booking.pricingSnapshotHistory.length > 0
            ? [...booking.pricingSnapshotHistory].sort((a, b) => a.version - b.version)
            : [buildInitialBookingPricingSnapshot(booking)]);

    const mergedAdjustments =
      adjustments.length > 0
        ? [...adjustments].sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
        : [...(booking.manualDiscountAdjustments || [])].sort(
            (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
          );

    return {
      ok: true,
      baselineSnapshot: mergedSnapshots[0],
      latestSnapshot: mergedSnapshots[mergedSnapshots.length - 1],
      snapshots: mergedSnapshots,
      adjustments: mergedAdjustments
    };
  }

  public async getReport(params: {
    caller: Pick<VerifiedAdminCaller, 'permissions' | 'idToken'>;
    agencyId?: string;
    couponCode?: string;
    adminUserId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<
    | { ok: true; report: BookingManualDiscountReportSummary }
    | { ok: false; status: number; error: string }
  > {
    const { caller, agencyId, couponCode, adminUserId, fromDate, toDate } = params;
    if (!caller.permissions.canViewDiscountReports) {
      return { ok: false, status: 403, error: 'Forbidden: missing manual discount reporting permission.' };
    }
    const [bookings, adjustments] = await Promise.all([
      this.store.listBookings(caller.idToken),
      this.store.listAdjustments(caller.idToken)
    ]);
    const report = buildBookingManualDiscountReport({
      bookings,
      adjustments: adjustments.length > 0 ? adjustments : undefined,
      agencyId,
      couponCode: couponCode ? normalizePromotionCode(couponCode) : undefined,
      adminUserId,
      fromDate,
      toDate
    });
    return { ok: true, report };
  }

  public async getBookingPaymentSchedules(params: {
    bookingId: string;
    caller: Pick<VerifiedAdminCaller, 'uid' | 'permissions' | 'idToken'>;
  }): Promise<
    | {
        ok: true;
        activeSchedule: PaymentSchedule | null;
        schedules: PaymentSchedule[];
        latestSnapshot: BookingPricingSnapshot;
      }
    | { ok: false; status: number; error: string }
  > {
    const { bookingId, caller } = params;
    if (!caller.permissions.canViewInternalMargin && !caller.permissions.canManagePaymentSchedule) {
      return { ok: false, status: 403, error: 'Forbidden: missing payment schedule visibility permission.' };
    }
    const booking = await this.store.getBooking(bookingId, caller.idToken);
    if (!booking) {
      return { ok: false, status: 404, error: `Booking "${bookingId}" not found.` };
    }
    const [snapshots, storedSchedules] = await Promise.all([
      this.store.listSnapshots(caller.idToken, bookingId),
      this.store.listPaymentSchedules
        ? this.store.listPaymentSchedules(caller.idToken, bookingId)
        : Promise.resolve([])
    ]);

    const latestSnapshot = getLatestBookingPricingSnapshot(booking, snapshots.length > 0 ? snapshots : undefined);
    const byId = new Map<string, PaymentSchedule>();
    for (const s of [...(booking.paymentScheduleHistory || []), ...storedSchedules]) {
      if (s && s.scheduleId) byId.set(s.scheduleId, s);
    }
    if (booking.paymentSchedule?.scheduleId) {
      byId.set(booking.paymentSchedule.scheduleId, booking.paymentSchedule);
    }
    const schedules = Array.from(byId.values()).sort(
      (a, b) => (b.scheduleVersion || 0) - (a.scheduleVersion || 0)
    );

    return {
      ok: true,
      activeSchedule: booking.paymentSchedule || schedules[0] || null,
      schedules,
      latestSnapshot
    };
  }

  public async previewScheduleRecalculation(params: {
    bookingId: string;
    caller: Pick<VerifiedAdminCaller, 'uid' | 'permissions' | 'idToken'>;
  }): Promise<
    | { ok: true; preview: PaymentScheduleRecalculationPreview }
    | { ok: false; status: number; error: string }
  > {
    const { bookingId, caller } = params;
    if (!caller.permissions.canManagePaymentSchedule) {
      return { ok: false, status: 403, error: 'Forbidden: missing permission to recalculate booking payment schedules.' };
    }
    const booking = await this.store.getBooking(bookingId, caller.idToken);
    if (!booking) {
      return { ok: false, status: 404, error: `Booking "${bookingId}" not found.` };
    }
    const [snapshots, existingSchedules] = await Promise.all([
      this.store.listSnapshots(caller.idToken, bookingId),
      this.store.listPaymentSchedules
        ? this.store.listPaymentSchedules(caller.idToken, bookingId)
        : Promise.resolve([])
    ]);
    const preview = previewPaymentScheduleRecalculation({
      booking,
      externalSnapshots: snapshots.length > 0 ? snapshots : undefined,
      existingSchedules
    });
    return { ok: true, preview };
  }

  public async savePaymentScheduleVersion(params: {
    bookingId: string;
    payload: {
      tranches: PaymentScheduleTrancheInput[];
      reason: string;
      allowPartialSchedule?: boolean;
      idempotencyKey?: string;
      expectedSnapshotVersion?: number;
      isRecalculation?: boolean;
    };
    caller: Pick<VerifiedAdminCaller, 'uid' | 'email' | 'name' | 'role' | 'permissions' | 'idToken'>;
  }): Promise<
    | {
        ok: true;
        idempotentReplay: boolean;
        newSchedule: PaymentSchedule;
        updatedBooking: Booking;
        latestSnapshot: BookingPricingSnapshot;
      }
    | { ok: false; status: number; error: string }
  > {
    const { bookingId, payload, caller } = params;

    return this.withBookingLock(bookingId, async () => {
      if (!caller.permissions.canManagePaymentSchedule) {
        return {
          ok: false,
          status: 403,
          error: 'Forbidden: your role is not permitted to create or modify booking payment schedules.'
        };
      }

      const booking = await this.store.getBooking(bookingId, caller.idToken);
      if (!booking) {
        return { ok: false, status: 404, error: `Booking "${bookingId}" not found.` };
      }

      const [snapshots, existingSchedules] = await Promise.all([
        this.store.listSnapshots(caller.idToken, bookingId),
        this.store.listPaymentSchedules
          ? this.store.listPaymentSchedules(caller.idToken, bookingId)
          : Promise.resolve([])
      ]);

      const latestSnapshot = getLatestBookingPricingSnapshot(
        booking,
        snapshots.length > 0 ? snapshots : undefined
      );

      const built = validateAndBuildVersionedPaymentSchedule({
        booking,
        tranches: payload.tranches || [],
        actor: {
          id: caller.uid,
          name: caller.name,
          email: caller.email,
          role: caller.role
        },
        reason: payload.reason,
        allowPartialSchedule: Boolean(payload.allowPartialSchedule),
        idempotencyKey: payload.idempotencyKey,
        expectedSnapshotVersion: payload.expectedSnapshotVersion,
        isRecalculation: Boolean(payload.isRecalculation),
        externalSnapshots: snapshots.length > 0 ? snapshots : undefined,
        existingSchedules
      });

      if (!built.ok) {
        return { ok: false, status: built.status, error: built.error };
      }

      if (built.idempotentReplay) {
        return {
          ok: true,
          idempotentReplay: true,
          newSchedule: built.newSchedule,
          updatedBooking: built.updatedBooking,
          latestSnapshot
        };
      }

      // Persist baseline snapshot if booking had no snapshot document in Firestore yet
      if (snapshots.length === 0) {
        const baseline = buildInitialBookingPricingSnapshot(booking);
        await this.store.saveSnapshot(baseline, caller.idToken);
      }

      // Persist immutable payment schedule version BEFORE updating booking projection
      if (this.store.savePaymentSchedule) {
        // Also persist v1 historical custom schedule if it existed only on booking doc without a Firestore schedule doc
        if (
          built.supersededSchedule &&
          built.supersededSchedule.scheduleId &&
          !existingSchedules.some(s => s.scheduleId === built.supersededSchedule!.scheduleId)
        ) {
          await this.store.savePaymentSchedule(
            {
              ...built.supersededSchedule,
              financialSnapshotId:
                built.supersededSchedule.financialSnapshotId || latestSnapshot.previousSnapshotId || `bps-${booking.id}-v1`,
              financialSnapshotVersion:
                built.supersededSchedule.financialSnapshotVersion || latestSnapshot.previousSnapshotVersion || 1,
              originalBookingAmount:
                built.supersededSchedule.originalBookingAmount ?? latestSnapshot.originalCustomerSellingPrice,
              totalDiscountAmount: built.supersededSchedule.totalDiscountAmount ?? 0,
              revisedBookingAmount:
                built.supersededSchedule.revisedBookingAmount ?? built.supersededSchedule.totalAmount,
              createdBy: built.supersededSchedule.createdBy || caller.uid,
              createdAt: built.supersededSchedule.createdAt || built.supersededSchedule.updatedAt || new Date().toISOString(),
              immutable: true
            },
            caller.idToken
          );
        }
        await this.store.savePaymentSchedule(built.newSchedule, caller.idToken);
      }

      await this.store.saveBooking(built.updatedBooking, caller.idToken);

      await this.store.saveAuditLog(
        {
          id: `audit-ps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: payload.isRecalculation ? 'PAYMENT_SCHEDULE_RECALCULATED' : 'PAYMENT_SCHEDULE_SAVED',
          entityType: 'Booking',
          entityId: booking.id,
          userId: caller.uid,
          userName: caller.name,
          userRole: caller.role,
          timestamp: built.newSchedule.createdAt || built.newSchedule.updatedAt,
          details: `Saved Payment Schedule v${built.newSchedule.scheduleVersion} (${built.newSchedule.scheduleId}) linked to Snapshot v${latestSnapshot.version} on ${booking.bookingReference}. Revised Booking Amount: ${built.newSchedule.currency} ${built.newSchedule.revisedBookingAmount}. Scheduled Total: ${built.newSchedule.currency} ${built.newSchedule.totalAmount}. Reason: ${payload.reason}`,
          metadata: {
            scheduleId: built.newSchedule.scheduleId,
            scheduleVersion: built.newSchedule.scheduleVersion,
            financialSnapshotId: latestSnapshot.snapshotId,
            financialSnapshotVersion: latestSnapshot.version,
            revisedBookingAmount: built.newSchedule.revisedBookingAmount,
            totalScheduled: built.newSchedule.totalAmount,
            unallocatedBalance: built.newSchedule.unallocatedBalance || 0,
            scheduleStatus: built.newSchedule.scheduleStatus
          }
        },
        caller.idToken
      );

      return {
        ok: true,
        idempotentReplay: false,
        newSchedule: built.newSchedule,
        updatedBooking: built.updatedBooking,
        latestSnapshot
      };
    });
  }
}

// ============================================================================
// EXPRESS ROUTER
// ============================================================================

export function createAdminBookingManualDiscountRouter(
  storeAdapter?: BookingDiscountStoreAdapter
): Router {
  const router = Router();
  const manager = new BookingManualDiscountTransactionManager(
    storeAdapter || new FirestoreBookingDiscountStore()
  );

  // Preview manual discount impact & margin protection
  router.post('/bookings/:bookingId/manual-discounts/preview', async (req: Request, res: Response) => {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const result = await manager.previewDiscount({
        bookingId: req.params.bookingId,
        payload: req.body || {},
        caller: auth.caller
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.json({ preview: result.preview, permissions: auth.caller.permissions });
    } catch (err: any) {
      console.error('[MANUAL-DISCOUNT-SVC] Preview error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to calculate manual discount preview.' });
    }
  });

  // Apply Admin Manual Discount / Coupon (serialized lock + idempotency + immutable snapshots)
  router.post('/bookings/:bookingId/manual-discounts/apply', async (req: Request, res: Response) => {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const result = await manager.applyDiscount({
        bookingId: req.params.bookingId,
        payload: {
          ...(req.body || {}),
          bookingId: req.params.bookingId
        },
        caller: auth.caller
      });
      if (!result.ok) {
        return res.status(result.status).json({
          error: result.error,
          preview: result.preview
        });
      }
      return res.json({
        success: true,
        idempotentReplay: result.idempotentReplay,
        adjustment: result.adjustment,
        newSnapshot: result.newSnapshot,
        updatedBooking: result.updatedBooking,
        preview: result.preview
      });
    } catch (err: any) {
      console.error('[MANUAL-DISCOUNT-SVC] Apply error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to apply manual discount.' });
    }
  });

  // Reverse a previously applied Admin Manual Discount (append-only immutable reversal)
  router.post('/bookings/:bookingId/manual-discounts/:adjustmentId/reverse', async (req: Request, res: Response) => {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const result = await manager.reverseDiscount({
        bookingId: req.params.bookingId,
        payload: {
          bookingId: req.params.bookingId,
          adjustmentId: req.params.adjustmentId,
          reason: String(req.body?.reason || ''),
          idempotencyKey: req.body?.idempotencyKey
        },
        caller: auth.caller
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.json({
        success: true,
        idempotentReplay: result.idempotentReplay,
        reversalAdjustment: result.reversalAdjustment,
        newSnapshot: result.newSnapshot,
        updatedBooking: result.updatedBooking
      });
    } catch (err: any) {
      console.error('[MANUAL-DISCOUNT-SVC] Reverse error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to reverse manual discount.' });
    }
  });

  // Fetch immutable snapshot & adjustment history for a booking
  router.get('/bookings/:bookingId/manual-discounts/history', async (req: Request, res: Response) => {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const result = await manager.getBookingHistory({
        bookingId: req.params.bookingId,
        caller: auth.caller
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.json({
        baselineSnapshot: result.baselineSnapshot,
        latestSnapshot: result.latestSnapshot,
        snapshots: result.snapshots,
        adjustments: result.adjustments,
        permissions: auth.caller.permissions
      });
    } catch (err: any) {
      console.error('[MANUAL-DISCOUNT-SVC] History error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to load manual discount history.' });
    }
  });

  // Admin Manual Discount Financial & Utilization Report
  router.get('/manual-discounts/report', async (req: Request, res: Response) => {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const result = await manager.getReport({
        caller: auth.caller,
        agencyId: req.query.agencyId ? String(req.query.agencyId) : undefined,
        couponCode: req.query.couponCode ? String(req.query.couponCode) : undefined,
        adminUserId: req.query.adminUserId ? String(req.query.adminUserId) : undefined,
        fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
        toDate: req.query.toDate ? String(req.query.toDate) : undefined
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.json({ report: result.report });
    } catch (err: any) {
      console.error('[MANUAL-DISCOUNT-SVC] Report error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to generate manual discount report.' });
    }
  });

  // Fetch immutable versioned payment schedules & latest financial snapshot for a booking
  router.get('/bookings/:bookingId/payment-schedules', async (req: Request, res: Response) => {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const result = await manager.getBookingPaymentSchedules({
        bookingId: req.params.bookingId,
        caller: auth.caller
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.json({
        activeSchedule: result.activeSchedule,
        schedules: result.schedules,
        latestSnapshot: result.latestSnapshot,
        permissions: auth.caller.permissions
      });
    } catch (err: any) {
      console.error('[MANUAL-DISCOUNT-SVC] Get payment schedules error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to load payment schedule versions.' });
    }
  });

  // Preview recalculating an existing Payment Schedule against the Latest Committed Financial Snapshot
  router.post('/bookings/:bookingId/payment-schedules/preview-recalculation', async (req: Request, res: Response) => {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const result = await manager.previewScheduleRecalculation({
        bookingId: req.params.bookingId,
        caller: auth.caller
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.json({ preview: result.preview });
    } catch (err: any) {
      console.error('[MANUAL-DISCOUNT-SVC] Preview payment schedule recalculation error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to preview payment schedule recalculation.' });
    }
  });

  // Save a new immutable Payment Schedule version linked to the Latest Committed Financial Snapshot
  router.post('/bookings/:bookingId/payment-schedules', async (req: Request, res: Response) => {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const result = await manager.savePaymentScheduleVersion({
        bookingId: req.params.bookingId,
        payload: {
          tranches: Array.isArray(req.body?.tranches) ? req.body.tranches : [],
          reason: String(req.body?.reason || ''),
          allowPartialSchedule: Boolean(req.body?.allowPartialSchedule),
          idempotencyKey: req.body?.idempotencyKey ? String(req.body.idempotencyKey) : undefined,
          expectedSnapshotVersion:
            typeof req.body?.expectedSnapshotVersion === 'number'
              ? req.body.expectedSnapshotVersion
              : undefined,
          isRecalculation: Boolean(req.body?.isRecalculation)
        },
        caller: auth.caller
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.json({
        success: true,
        idempotentReplay: result.idempotentReplay,
        newSchedule: result.newSchedule,
        updatedBooking: result.updatedBooking,
        latestSnapshot: result.latestSnapshot
      });
    } catch (err: any) {
      console.error('[MANUAL-DISCOUNT-SVC] Save payment schedule error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to save payment schedule version.' });
    }
  });

  return router;
}
