import {
  AdminManualDiscountApplyPayload,
  AdminManualDiscountReversePayload,
  Booking,
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
      preview: BookingManualDiscountPreview;
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
        db.commitBookingManualDiscountSnapshot(
          json.updatedBooking,
          json.newSnapshot,
          json.adjustment,
          user,
          false
        );
        return {
          ok: true,
          idempotentReplay: Boolean(json.idempotentReplay),
          adjustment: json.adjustment,
          newSnapshot: json.newSnapshot,
          updatedBooking: json.updatedBooking,
          preview: json.preview
        };
      }
      // Strictly respect authoritative server rejections (400/401/403/404)
      if (res.status >= 400 && res.status < 500) {
        return {
          ok: false,
          error: json.error || 'Manual discount request was rejected by server.',
          preview: json.preview
        };
      }
    } catch {
      // Only fall back to local central-engine commit if backend is unreachable (e.g. local non-Firebase session)
    }
  }

  // Authoritative local central-engine commit (enforces identical RBAC, margin protection, and immutability)
  const freshBooking = db.getAllBookings().find(b => b.id === booking.id) || booking;
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

  db.commitBookingManualDiscountSnapshot(
    commit.updatedBooking,
    commit.newSnapshot,
    commit.adjustment,
    user,
    true,
    commit.initialSnapshotToPersist
  );

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
    adjustment: commit.adjustment,
    newSnapshot: commit.newSnapshot,
    updatedBooking: commit.updatedBooking,
    preview: commit.preview
  };
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
            idempotencyKey
          })
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.updatedBooking && json.newSnapshot && json.reversalAdjustment) {
        db.commitBookingManualDiscountSnapshot(
          json.updatedBooking,
          json.newSnapshot,
          json.reversalAdjustment,
          user,
          false
        );
        return {
          ok: true,
          idempotentReplay: Boolean(json.idempotentReplay),
          reversalAdjustment: json.reversalAdjustment,
          newSnapshot: json.newSnapshot,
          updatedBooking: json.updatedBooking
        };
      }
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, error: json.error || 'Reversal request was rejected by server.' };
      }
    } catch {
      // Fallback below on network error
    }
  }

  const freshBooking = db.getAllBookings().find(b => b.id === booking.id) || booking;
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
    existingInvoicesCount: db.getBookingInvoices(freshBooking.id).length
  });

  if (!commit.ok) {
    return { ok: false, error: commit.error };
  }

  db.commitBookingManualDiscountSnapshot(
    commit.updatedBooking,
    commit.newSnapshot,
    commit.reversalAdjustment,
    user,
    true
  );

  return {
    ok: true,
    idempotentReplay: false,
    reversalAdjustment: commit.reversalAdjustment,
    newSnapshot: commit.newSnapshot,
    updatedBooking: commit.updatedBooking
  };
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
