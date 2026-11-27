import { Booking, BookingPricingSnapshot, PaymentSchedule, User } from '../types';
import { auth as firebaseAuth } from './firebase';
import { AppDatabase } from './db';
import {
  getLatestBookingPricingSnapshot,
  PaymentScheduleRecalculationPreview,
  PaymentScheduleTrancheInput,
  previewPaymentScheduleRecalculation,
  resolveAdminManualDiscountPermissions
} from './bookingManualDiscountEngine';

async function getBearerToken(): Promise<string | null> {
  try {
    const current = firebaseAuth?.currentUser;
    if (!current) return null;
    return await current.getIdToken();
  } catch {
    return null;
  }
}

const scheduleLocks = new Map<string, Promise<unknown>>();

async function withPaymentScheduleLock<T>(bookingId: string, fn: () => Promise<T>): Promise<T> {
  const prior = scheduleLocks.get(bookingId) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const chained = prior.then(() => gate);
  scheduleLocks.set(bookingId, chained);
  try {
    await prior;
    return await fn();
  } finally {
    release();
    if (scheduleLocks.get(bookingId) === chained) {
      scheduleLocks.delete(bookingId);
    }
  }
}

export async function previewBookingPaymentScheduleRecalculationAsync(params: {
  booking: Booking;
  user: User | null;
}): Promise<{ ok: true; preview: PaymentScheduleRecalculationPreview } | { ok: false; error: string }> {
  const { booking, user } = params;
  const permissions = resolveAdminManualDiscountPermissions(user);
  if (!permissions.canManagePaymentSchedule) {
    return {
      ok: false,
      error: 'Forbidden: your account does not have permission to recalculate booking payment schedules.'
    };
  }

  const token = await getBearerToken();
  if (token) {
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(booking.id)}/payment-schedules/preview-recalculation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({})
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.preview) {
        return { ok: true, preview: json.preview };
      }
      if (res.status >= 400) {
        return {
          ok: false,
          error: json.error || `Failed to preview payment schedule recalculation (HTTP ${res.status}).`
        };
      }
    } catch {
      // Fall back to deterministic central engine when backend transport is offline
    }
  }

  const db = AppDatabase.getInstance();
  const snapshots = db.getBookingPricingSnapshots(booking.id);
  const existingSchedules = db.getBookingPaymentSchedules(booking.id);
  const preview = previewPaymentScheduleRecalculation({
    booking,
    externalSnapshots: snapshots.length > 0 ? snapshots : undefined,
    existingSchedules
  });
  return { ok: true, preview };
}

export async function saveBookingPaymentScheduleVersionAsync(params: {
  booking: Booking;
  tranches: PaymentScheduleTrancheInput[];
  reason: string;
  allowPartialSchedule?: boolean;
  idempotencyKey?: string;
  expectedSnapshotVersion?: number;
  isRecalculation?: boolean;
  user: User | null;
  bearerToken?: string;
}): Promise<
  | {
      ok: true;
      idempotentReplay: boolean;
      newSchedule: PaymentSchedule;
      updatedBooking: Booking;
      latestSnapshot: BookingPricingSnapshot;
    }
  | { ok: false; error: string }
> {
  const {
    booking,
    tranches,
    reason,
    allowPartialSchedule = false,
    idempotencyKey,
    expectedSnapshotVersion,
    isRecalculation = false,
    user,
    bearerToken
  } = params;

  if (!user) {
    return { ok: false, error: 'Authentication required to save a payment schedule.' };
  }

  const permissions = resolveAdminManualDiscountPermissions(user);
  if (!permissions.canManagePaymentSchedule) {
    return {
      ok: false,
      error: 'Forbidden: your account does not have permission to create or modify booking payment schedules.'
    };
  }

  const cleanKey =
    idempotencyKey?.trim() ||
    `ps-save-${booking.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return await withPaymentScheduleLock(booking.id, async () => {
    const db = AppDatabase.getInstance();
    const token = bearerToken ?? (await getBearerToken());

    if (token) {
      try {
        const res = await fetch(
          `/api/admin/bookings/${encodeURIComponent(booking.id)}/payment-schedules`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              tranches,
              reason,
              allowPartialSchedule,
              idempotencyKey: cleanKey,
              expectedSnapshotVersion,
              isRecalculation
            })
          }
        );
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success && json.newSchedule && json.updatedBooking) {
          const syncedBooking = db.commitVersionedPaymentSchedule(
            json.updatedBooking,
            json.newSchedule,
            user,
            false
          );
          return {
            ok: true,
            idempotentReplay: Boolean(json.idempotentReplay),
            newSchedule: json.newSchedule,
            updatedBooking: syncedBooking,
            latestSnapshot:
              json.latestSnapshot ||
              getLatestBookingPricingSnapshot(syncedBooking, db.getBookingPricingSnapshots(syncedBooking.id))
          };
        }
        return {
          ok: false,
          error:
            json.error ||
            `Payment schedule could not be persisted to Firestore (HTTP ${res.status}). Your unsaved changes are preserved—please retry.`
        };
      } catch (networkErr: any) {
        // Strict persistence guarantee: never falsely claim save succeeded in an authenticated
        // browser session when the backend/Firestore write could not be confirmed.
        return {
          ok: false,
          error: `Network error while saving payment schedule (${networkErr?.message || 'connection failed'}). Your unsaved tranche inputs have been preserved—please retry safely.`
        };
      }
    }

    // In browser mode without a valid Firebase Auth session, require sign-in before claiming persistence
    if (typeof window !== 'undefined' && firebaseAuth?.currentUser) {
      return {
        ok: false,
        error: 'Unable to acquire a fresh Firebase authentication token. Please refresh or sign in again before saving.'
      };
    }

    const localRes = db.saveBookingPaymentSchedule(booking.id, tranches, user, reason, {
      allowPartialSchedule,
      idempotencyKey: cleanKey,
      expectedSnapshotVersion,
      isRecalculation
    });

    if (!localRes.success || !localRes.paymentSchedule || !localRes.booking) {
      return { ok: false, error: localRes.error || 'Failed to save payment schedule.' };
    }

    const latestSnapshot = getLatestBookingPricingSnapshot(
      localRes.booking,
      db.getBookingPricingSnapshots(localRes.booking.id)
    );

    return {
      ok: true,
      idempotentReplay: Boolean(localRes.idempotentReplay),
      newSchedule: localRes.paymentSchedule,
      updatedBooking: localRes.booking,
      latestSnapshot
    };
  });
}

export async function fetchBookingPaymentSchedulesAsync(params: {
  bookingId: string;
  user: User | null;
  bearerToken?: string;
}): Promise<
  | {
      ok: true;
      activeSchedule: PaymentSchedule | null;
      schedules: PaymentSchedule[];
      latestSnapshot?: BookingPricingSnapshot;
    }
  | { ok: false; error: string }
> {
  const { bookingId, user, bearerToken } = params;
  const permissions = resolveAdminManualDiscountPermissions(user);
  if (!permissions.canViewInternalMargin && !permissions.canManagePaymentSchedule) {
    return { ok: false, error: 'Forbidden: missing payment schedule visibility permission.' };
  }

  const db = AppDatabase.getInstance();
  const token = bearerToken ?? (await getBearerToken());
  if (token) {
    try {
      const res = await fetch(
        `/api/admin/bookings/${encodeURIComponent(bookingId)}/payment-schedules`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.schedules)) {
        // Hydrate Firestore schedules into local AppDatabase cache so refresh / reopen stays synced
        const booking = db.getAllBookings().find(b => b.id === bookingId);
        if (booking && json.activeSchedule && user) {
          db.commitVersionedPaymentSchedule(
            {
              ...booking,
              paymentSchedule: json.activeSchedule,
              paymentScheduleHistory: json.schedules
            },
            json.activeSchedule,
            user,
            false
          );
        }
        return {
          ok: true,
          activeSchedule: json.activeSchedule || null,
          schedules: json.schedules,
          latestSnapshot: json.latestSnapshot
        };
      }
      if (res.status >= 400) {
        return { ok: false, error: json.error || `Failed to fetch payment schedules (HTTP ${res.status}).` };
      }
    } catch {
      // Fall back to hydrated Firestore snapshot listener cache on transient read error
    }
  }

  const schedules = db.getBookingPaymentSchedules(bookingId);
  const booking = db.getAllBookings().find(b => b.id === bookingId);
  return {
    ok: true,
    activeSchedule: booking?.paymentSchedule || schedules[0] || null,
    schedules
  };
}
