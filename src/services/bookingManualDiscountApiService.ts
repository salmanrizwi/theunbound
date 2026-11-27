import {
  AdminManualDiscountApplyPayload,
  AdminManualDiscountReversePayload,
  Booking,
  BookingInvoice,
  BookingManualDiscountAdjustment,
  BookingManualDiscountPreview,
  BookingManualDiscountReportSummary,
  BookingPricingSnapshot,
  Promotion,
  User
} from '../types';
import { auth as firebaseAuth } from './firebase';
import { AppDatabase } from './db';
import {
  buildApplyManualDiscountCommit,
  buildBookingManualDiscountReport,
  buildReverseManualDiscountCommit,
  calculateBookingManualDiscountPreview,
  resolveAdminManualDiscountPermissions,
  roundMoney
} from './bookingManualDiscountEngine';
import { findPromotionByCode } from './promotionEngine';

async function getBearerToken(): Promise<string | null> {
  try {
    const current = firebaseAuth?.currentUser;
    if (!current) return null;
    return await current.getIdToken();
  } catch {
    return null;
  }
}

export async function previewBookingManualDiscountAsync(params: {
  booking: Booking;
  payload: Partial<AdminManualDiscountApplyPayload>;
  user: User | null;
}): Promise<{ ok: true; preview: BookingManualDiscountPreview } | { ok: false; error: string }> {
  const { booking, payload, user } = params;
  const permissions = resolveAdminManualDiscountPermissions(user);
  if (!permissions.canViewInternalMargin) {
    return { ok: false, error: 'Forbidden: you do not have permission to view internal margin or discount previews.' };
  }

  const token = await getBearerToken();
  if (token) {
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(booking.id)}/manual-discounts/preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.preview) {
        return { ok: true, preview: json.preview };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: json.error || 'Unauthorized to preview manual discount.' };
      }
    } catch {
      // Fallback to central engine below only on transport unavailability
    }
  }

  const db = AppDatabase.getInstance();
  const promotions = db.getPromotions();
  let coupon: Promotion | null = null;
  if (payload.discountSource === 'ADMIN_MANUAL_COUPON') {
    coupon = payload.couponId
      ? promotions.find(p => p.id === payload.couponId) || null
      : payload.couponCode
        ? findPromotionByCode(promotions, payload.couponCode) || null
        : null;
  }

  const preview = calculateBookingManualDiscountPreview({
    booking,
    discountSource: payload.discountSource || 'ADMIN_MANUAL_ADJUSTMENT',
    discountType: payload.discountType || 'FIXED',
    discountValue: Number(payload.discountValue || 0),
    discountCurrency: payload.discountCurrency,
    coupon,
    allowMarginOverride: Boolean(payload.allowMarginOverride),
    marginOverrideReason: payload.marginOverrideReason,
    approvalReference: payload.approvalReference,
    permissions,
    existingInvoicesCount: db.getBookingInvoices(booking.id).length
  });

  return { ok: true, preview };
}

// Per-booking async mutex to serialize concurrent discount mutations in the browser/local process
const bookingDiscountLocks = new Map<string, Promise<unknown>>();

async function withBookingDiscountLock<T>(bookingId: string, fn: () => Promise<T>): Promise<T> {
  const previous = bookingDiscountLocks.get(bookingId) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const chained = previous.then(() => gate);
  bookingDiscountLocks.set(bookingId, chained);
  try {
    await previous;
    return await fn();
  } finally {
    release();
    if (bookingDiscountLocks.get(bookingId) === chained) {
      bookingDiscountLocks.delete(bookingId);
    }
  }
}

export async function applyBookingManualDiscountAsync(params: {
  booking: Booking;
  payload: AdminManualDiscountApplyPayload;
  user: User | null;
}): Promise<
  | {
      ok: true;
      idempotentReplay: boolean;
      adjustment: BookingManualDiscountAdjustment;
      newSnapshot: BookingPricingSnapshot;
      updatedBooking: Booking;
      revisedInvoice?: BookingInvoice;
      supersededInvoices?: BookingInvoice[];
      preview?: BookingManualDiscountPreview;
    }
  | { ok: false; error: string; preview?: BookingManualDiscountPreview }
> {
  const { booking, payload, user } = params;
  const permissions = resolveAdminManualDiscountPermissions(user);
  const db = AppDatabase.getInstance();

  if (!user) {
    return { ok: false, error: 'Authentication required to apply manual booking discounts.' };
  }

  const idempotencyKey =
    payload.idempotencyKey ||
    `bmd-apply-${booking.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const enrichedPayload: AdminManualDiscountApplyPayload = {
    ...payload,
    bookingId: booking.id,
    idempotencyKey
  };

  return await withBookingDiscountLock(booking.id, async () => {
  const token = await getBearerToken();
  if (token) {
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(booking.id)}/manual-discounts/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(enrichedPayload)
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.updatedBooking && json.newSnapshot && json.adjustment) {
        const syncedBooking = db.commitBookingManualDiscountSnapshot(
          json.updatedBooking,
          json.newSnapshot,
          json.adjustment,
          user,
          false
        );
        const syncedAdj =
          db.getBookingManualDiscountAdjustments(syncedBooking.id).find(
            a => a.adjustmentId === json.adjustment.adjustmentId
          ) || json.adjustment;
        const latestInv = syncedBooking.activeProformaInvoiceId
          ? db.getBookingInvoices(syncedBooking.id).find(i => i.id === syncedBooking.activeProformaInvoiceId)
          : undefined;
        return {
          ok: true,
          idempotentReplay: Boolean(json.idempotentReplay),
          adjustment: syncedAdj,
          newSnapshot: json.newSnapshot,
          updatedBooking: syncedBooking,
          revisedInvoice: latestInv,
          preview: json.preview
        };
      }
      // Strictly respect authoritative server rejections (4xx) AND server persistence errors (5xx)
      if (res.status >= 400) {
        return {
          ok: false,
          error: json.error || `Manual discount request failed on server (HTTP ${res.status}).`,
          preview: json.preview
        };
      }
    } catch {
      // Only fall back to local central-engine commit if backend endpoint is genuinely unreachable
    }
  }

  // Authoritative local central-engine commit (enforces identical RBAC, idempotency, concurrency, margin protection, and immutability)
  const freshBooking = db.getAllBookings().find(b => b.id === booking.id) || booking;
  const existingAdjustments = db.getBookingManualDiscountAdjustments(freshBooking.id);
  const existingSnapshots = db.getBookingPricingSnapshots(freshBooking.id);

  // Idempotency replay protection on retries / double-clicks
  const existingByKey = existingAdjustments.find(
    a => a.actionType === 'APPLY' && a.idempotencyKey && a.idempotencyKey === idempotencyKey
  );
  if (existingByKey) {
    const matchedSnap =
      existingSnapshots.find(s => s.snapshotId === existingByKey.resultingSnapshotId) ||
      existingSnapshots[existingSnapshots.length - 1];
    return {
      ok: true,
      idempotentReplay: true,
      adjustment: existingByKey,
      newSnapshot: matchedSnap,
      updatedBooking: freshBooking
    };
  }

  const promotions = db.getPromotions();
  const coupon =
    enrichedPayload.discountSource === 'ADMIN_MANUAL_COUPON'
      ? enrichedPayload.couponId
        ? promotions.find(p => p.id === enrichedPayload.couponId) || null
        : enrichedPayload.couponCode
          ? findPromotionByCode(promotions, enrichedPayload.couponCode) || null
          : null
      : null;

  const commit = buildApplyManualDiscountCommit({
    booking: freshBooking,
    payload: enrichedPayload,
    actor: {
      id: user.id,
      name: user.name || user.displayName || user.email || 'Admin',
      email: user.email,
      role: user.role
    },
    permissions,
    coupon,
    externalSnapshots: existingSnapshots.length > 0 ? existingSnapshots : undefined,
    externalAdjustments: existingAdjustments.length > 0 ? existingAdjustments : undefined,
    existingInvoicesCount: db.getBookingInvoices(freshBooking.id).length
  });

  if (!commit.ok) {
    db.logAudit(
      user,
      'BOOKING_MANUAL_DISCOUNT_REJECTED',
      'Booking',
      freshBooking.id,
      `Manual discount rejected on ${freshBooking.bookingReference}: ${commit.error}`
    );
    return { ok: false, error: commit.error, preview: commit.preview };
  }

  const persisted = await db.commitBookingManualDiscountSnapshotAsync(
    commit.updatedBooking,
    commit.newSnapshot,
    commit.adjustment,
    user,
    true,
    commit.initialSnapshotToPersist
  );

  if (persisted.error) {
    return {
      ok: false,
      error: persisted.error,
      preview: commit.preview
    };
  }

  if (coupon) {
    db.savePromotion(
      {
        ...coupon,
        adminManualRedemptionsCount: (coupon.adminManualRedemptionsCount || 0) + 1,
        adminManualDiscountValueGranted: roundMoney(
          (coupon.adminManualDiscountValueGranted || 0) +
            commit.adjustment.discountAmountInBookingCurrency
        ),
        updatedAt: commit.adjustment.appliedAt
      },
      user
    );
  }

  return {
    ok: true,
    idempotentReplay: false,
    adjustment: persisted.adjustment,
    newSnapshot: commit.newSnapshot,
    updatedBooking: persisted.booking,
    revisedInvoice: persisted.revisedInvoice,
    supersededInvoices: persisted.supersededInvoices,
    preview: commit.preview
  };
  });
}

export async function reverseBookingManualDiscountAsync(params: {
  booking: Booking;
  payload: AdminManualDiscountReversePayload;
  user: User | null;
}): Promise<
  | {
      ok: true;
      idempotentReplay: boolean;
      reversalAdjustment: BookingManualDiscountAdjustment;
      newSnapshot: BookingPricingSnapshot;
      updatedBooking: Booking;
      revisedInvoice?: BookingInvoice;
      supersededInvoices?: BookingInvoice[];
    }
  | { ok: false; error: string }
> {
  const { booking, payload, user } = params;
  const permissions = resolveAdminManualDiscountPermissions(user);
  const db = AppDatabase.getInstance();

  if (!user) {
    return { ok: false, error: 'Authentication required to reverse manual booking discounts.' };
  }

  const idempotencyKey =
    payload.idempotencyKey ||
    `bmd-rev-${booking.id}-${payload.adjustmentId}-${Date.now()}`;

  return await withBookingDiscountLock(booking.id, async () => {
  const token = await getBearerToken();
  if (token) {
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(booking.id)}/manual-discounts/${encodeURIComponent(payload.adjustmentId)}/reverse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            reason: payload.reason,
            idempotencyKey,
            expectedSnapshotVersion: payload.expectedSnapshotVersion
          })
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.updatedBooking && json.newSnapshot && json.reversalAdjustment) {
        const syncedBooking = db.commitBookingManualDiscountSnapshot(
          json.updatedBooking,
          json.newSnapshot,
          json.reversalAdjustment,
          user,
          false
        );
        const syncedRev =
          db.getBookingManualDiscountAdjustments(syncedBooking.id).find(
            a => a.adjustmentId === json.reversalAdjustment.adjustmentId
          ) || json.reversalAdjustment;
        const latestInv = syncedBooking.activeProformaInvoiceId
          ? db.getBookingInvoices(syncedBooking.id).find(i => i.id === syncedBooking.activeProformaInvoiceId)
          : undefined;
        return {
          ok: true,
          idempotentReplay: Boolean(json.idempotentReplay),
          reversalAdjustment: syncedRev,
          newSnapshot: json.newSnapshot,
          updatedBooking: syncedBooking,
          revisedInvoice: latestInv
        };
      }
      if (res.status >= 400) {
        return { ok: false, error: json.error || `Reversal request failed on server (HTTP ${res.status}).` };
      }
    } catch {
      // Fallback below on network error
    }
  }

  const freshBooking = db.getAllBookings().find(b => b.id === booking.id) || booking;
  const existingAdjustments = db.getBookingManualDiscountAdjustments(freshBooking.id);
  const existingSnapshots = db.getBookingPricingSnapshots(freshBooking.id);

  // Idempotency replay protection for reversal retries
  const existingReversal = existingAdjustments.find(
    a => a.actionType === 'REVERSE' && a.idempotencyKey && a.idempotencyKey === idempotencyKey
  );
  if (existingReversal) {
    const matchedSnap =
      existingSnapshots.find(s => s.snapshotId === existingReversal.resultingSnapshotId) ||
      existingSnapshots[existingSnapshots.length - 1];
    return {
      ok: true,
      idempotentReplay: true,
      reversalAdjustment: existingReversal,
      newSnapshot: matchedSnap,
      updatedBooking: freshBooking
    };
  }

  // Optimistic concurrency check if caller supplied expectedSnapshotVersion
  const latestVersion =
    existingSnapshots.length > 0
      ? Math.max(...existingSnapshots.map(s => s.version || 1))
      : Number(freshBooking.currentPricingSnapshotVersion || 1);
  if (
    typeof payload.expectedSnapshotVersion === 'number' &&
    payload.expectedSnapshotVersion !== latestVersion
  ) {
    return {
      ok: false,
      error: `Pricing snapshot version conflict: expected v${payload.expectedSnapshotVersion}, but latest committed snapshot is v${latestVersion}. Please refresh and retry.`
    };
  }

  const commit = buildReverseManualDiscountCommit({
    booking: freshBooking,
    adjustmentId: payload.adjustmentId,
    reason: payload.reason,
    idempotencyKey,
    actor: {
      id: user.id,
      name: user.name || user.displayName || user.email || 'Admin',
      email: user.email,
      role: user.role
    },
    permissions,
    externalSnapshots: existingSnapshots.length > 0 ? existingSnapshots : undefined,
    externalAdjustments: existingAdjustments.length > 0 ? existingAdjustments : undefined,
    existingInvoicesCount: db.getBookingInvoices(freshBooking.id).length
  });

  if (!commit.ok) {
    return { ok: false, error: commit.error };
  }

  const persisted = await db.commitBookingManualDiscountSnapshotAsync(
    commit.updatedBooking,
    commit.newSnapshot,
    commit.reversalAdjustment,
    user,
    true
  );

  if (persisted.error) {
    return { ok: false, error: persisted.error };
  }

  return {
    ok: true,
    idempotentReplay: false,
    reversalAdjustment: persisted.adjustment,
    newSnapshot: commit.newSnapshot,
    updatedBooking: persisted.booking,
    revisedInvoice: persisted.revisedInvoice,
    supersededInvoices: persisted.supersededInvoices
  };
  });
}

export async function fetchAdminManualDiscountReportAsync(params: {
  user: User | null;
  agencyId?: string;
  couponCode?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<{ ok: true; report: BookingManualDiscountReportSummary } | { ok: false; error: string }> {
  const { user, agencyId, couponCode, fromDate, toDate } = params;
  const permissions = resolveAdminManualDiscountPermissions(user);
  if (!permissions.canViewDiscountReports) {
    return { ok: false, error: 'Forbidden: missing permission to view manual discount reports.' };
  }

  const token = await getBearerToken();
  if (token) {
    try {
      const qs = new URLSearchParams();
      if (agencyId) qs.set('agencyId', agencyId);
      if (couponCode) qs.set('couponCode', couponCode);
      if (fromDate) qs.set('fromDate', fromDate);
      if (toDate) qs.set('toDate', toDate);
      const url = `/api/admin/manual-discounts/report${qs.toString() ? `?${qs.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.report) {
        return { ok: true, report: json.report };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: json.error || 'Unauthorized to load manual discount report.' };
      }
    } catch {
      // Fallback to local snapshot calculation
    }
  }

  const db = AppDatabase.getInstance();
  const report = buildBookingManualDiscountReport({
    bookings: db.getAllBookings(),
    agencyId,
    couponCode,
    fromDate,
    toDate
  });
  return { ok: true, report };
}
