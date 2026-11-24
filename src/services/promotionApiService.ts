import {
  AppliedPromotionSnapshot,
  CurrencyCode,
  PromotionRedemptionRecord,
  PromotionReportRow,
  PromotionReservationRecord,
  PromotionValidationResult,
  User
} from '../types';
import { auth as firebaseAuth } from './firebase';
import { db } from './db';
import {
  buildPromotionReportRows,
  computePromotionUsageCounts,
  evaluatePromotionEligibilityAndDiscount,
  findPromotionByCode,
  normalizePromotionCode,
  PromotionEvaluationItem
} from './promotionEngine';

async function getBearerToken(): Promise<string | null> {
  try {
    const current = firebaseAuth?.currentUser;
    if (!current) return null;
    return await current.getIdToken();
  } catch {
    return null;
  }
}

export interface ClientValidatePromotionRequest {
  code: string;
  stage: 'QUOTATION' | 'BOOKING_CONFIRMATION';
  quotationId?: string;
  quotationVersion?: number;
  quotationStatus?: string;
  isDraftQuotation?: boolean;
  isRevisedQuotation?: boolean;
  preDiscountBaseSellingPrice: number;
  currency: CurrencyCode;
  destinationId?: string;
  destinationIds?: string[];
  destinationName?: string;
  items?: PromotionEvaluationItem[];
  totalPax?: number;
  existingQuotationPromotionId?: string;
  user?: User | null;
}

export async function validatePromotionCodeAsync(
  req: ClientValidatePromotionRequest
): Promise<PromotionValidationResult> {
  const normalized = normalizePromotionCode(req.code);
  if (!normalized) {
    return {
      valid: false,
      errorCode: 'EMPTY_CODE',
      message: 'Please enter a promotion code.',
      validatedAt: new Date().toISOString(),
      source: 'ENGINE'
    };
  }

  const token = await getBearerToken();
  if (token) {
    try {
      const response = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: normalized,
          stage: req.stage,
          quotationId: req.quotationId,
          quotationVersion: req.quotationVersion,
          quotationStatus: req.quotationStatus,
          isDraftQuotation: req.isDraftQuotation,
          isRevisedQuotation: req.isRevisedQuotation,
          preDiscountBaseSellingPrice: req.preDiscountBaseSellingPrice,
          currency: req.currency,
          destinationId: req.destinationId,
          destinationIds: req.destinationIds,
          destinationName: req.destinationName,
          items: req.items || [],
          totalPax: req.totalPax || 1,
          existingQuotationPromotionId: req.existingQuotationPromotionId
        })
      });

      const data = await response.json().catch(() => null);
      if (data && typeof data.valid === 'boolean' && response.status < 500) {
        return { ...data, source: 'SERVER' };
      }
    } catch (err) {
      console.warn('[PROMO-API] Backend /api/promotions/validate unavailable, falling back to engine:', err);
    }
  }

  const promotions = db.getPromotions();
  const promo = findPromotionByCode(promotions, normalized);
  const redemptions = db.getPromotionRedemptions();
  const reservations = db.getPromotionReservations();
  const usageCounts = promo
    ? computePromotionUsageCounts({
        promotionId: promo.id,
        redemptions,
        reservations,
        agentUid: req.user?.id,
        agencyId: req.user?.companyId
      })
    : undefined;

  return evaluatePromotionEligibilityAndDiscount({
    promotion: promo,
    context: {
      code: normalized,
      stage: req.stage,
      quotationId: req.quotationId,
      quotationVersion: req.quotationVersion,
      quotationStatus: req.quotationStatus,
      isDraftQuotation: req.isDraftQuotation,
      isRevisedQuotation: req.isRevisedQuotation,
      preDiscountBaseSellingPrice: req.preDiscountBaseSellingPrice,
      currency: req.currency,
      destinationId: req.destinationId,
      destinationIds: req.destinationIds,
      destinationName: req.destinationName,
      items: req.items || [],
      totalPax: req.totalPax || 1,
      agentUid: req.user?.id,
      agentName: req.user?.name,
      agentRole: req.user?.role,
      agencyId: req.user?.companyId,
      agencyName: req.user?.agencyName,
      existingQuotationPromotionId: req.existingQuotationPromotionId
    },
    usageCounts
  });
}

export async function reservePromotionForBookingAsync(params: {
  code: string;
  quotationId: string;
  quotationNumber?: string;
  quotationVersion: number;
  idempotencyKey: string;
  preDiscountBaseSellingPrice: number;
  currency: CurrencyCode;
  destinationId?: string;
  destinationIds?: string[];
  destinationName?: string;
  items?: PromotionEvaluationItem[];
  totalPax?: number;
  existingQuotationPromotionId?: string;
  user?: User | null;
}): Promise<{
  ok: boolean;
  validation: PromotionValidationResult;
  reservation?: PromotionReservationRecord;
  appliedPromotion?: AppliedPromotionSnapshot;
}> {
  const token = await getBearerToken();
  if (token) {
    try {
      const response = await fetch('/api/promotions/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: normalizePromotionCode(params.code),
          quotationId: params.quotationId,
          quotationNumber: params.quotationNumber,
          quotationVersion: params.quotationVersion,
          idempotencyKey: params.idempotencyKey,
          preDiscountBaseSellingPrice: params.preDiscountBaseSellingPrice,
          currency: params.currency,
          destinationId: params.destinationId,
          destinationIds: params.destinationIds,
          destinationName: params.destinationName,
          items: params.items || [],
          totalPax: params.totalPax || 1,
          existingQuotationPromotionId: params.existingQuotationPromotionId
        })
      });
      const data = await response.json().catch(() => null);
      if (data && typeof data.ok === 'boolean' && response.status < 500) {
        if (data.reservation) {
          db.upsertLocalPromotionReservation(data.reservation);
        }
        return data;
      }
    } catch (err) {
      console.warn('[PROMO-API] /api/promotions/reserve unavailable, using local fallback:', err);
    }
  }

  const validation = await validatePromotionCodeAsync({
    code: params.code,
    stage: 'BOOKING_CONFIRMATION',
    quotationId: params.quotationId,
    quotationVersion: params.quotationVersion,
    preDiscountBaseSellingPrice: params.preDiscountBaseSellingPrice,
    currency: params.currency,
    destinationId: params.destinationId,
    destinationIds: params.destinationIds,
    destinationName: params.destinationName,
    items: params.items,
    totalPax: params.totalPax,
    existingQuotationPromotionId: params.existingQuotationPromotionId,
    user: params.user
  });

  if (!validation.valid || !validation.appliedPromotion) {
    return { ok: false, validation };
  }

  const now = new Date();
  const reservation: PromotionReservationRecord = {
    id: `pres_local_${Date.now()}`,
    promotionId: validation.appliedPromotion.promotionId,
    code: validation.appliedPromotion.code,
    normalizedCode: validation.appliedPromotion.normalizedCode,
    quotationId: params.quotationId,
    quotationNumber: params.quotationNumber,
    quotationVersion: params.quotationVersion,
    agentUid: params.user?.id || 'anonymous',
    agentName: params.user?.name,
    agencyId: params.user?.companyId,
    agencyName: params.user?.agencyName,
    discountAmount: validation.appliedPromotion.discountAmount,
    currency: validation.appliedPromotion.currency,
    preDiscountBaseSellingPrice: validation.appliedPromotion.preDiscountBaseSellingPrice,
    discountedBaseSellingPrice: validation.appliedPromotion.discountedBaseSellingPrice,
    idempotencyKey: params.idempotencyKey,
    status: 'RESERVED',
    reservedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString()
  };
  db.upsertLocalPromotionReservation(reservation);

  const applied = { ...validation.appliedPromotion, reservationId: reservation.id };
  return { ok: true, validation: { ...validation, appliedPromotion: applied }, reservation, appliedPromotion: applied };
}

export async function confirmPromotionRedemptionAsync(params: {
  promotionId: string;
  code: string;
  reservationId?: string;
  idempotencyKey: string;
  bookingId: string;
  bookingReference?: string;
  quotationId: string;
  quotationNumber?: string;
  quotationVersion: number;
  preDiscountBaseSellingPrice: number;
  currency: CurrencyCode;
  destinationId?: string;
  destinationIds?: string[];
  destinationName?: string;
  items?: PromotionEvaluationItem[];
  totalPax?: number;
  appliedStage: 'QUOTATION' | 'BOOKING_CONFIRMATION';
  appliedPromotion?: AppliedPromotionSnapshot | null;
  user?: User | null;
}): Promise<{
  ok: boolean;
  redemption?: PromotionRedemptionRecord;
  appliedPromotion?: AppliedPromotionSnapshot;
  error?: string;
}> {
  const token = await getBearerToken();
  if (token) {
    try {
      const response = await fetch('/api/promotions/confirm-redemption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          promotionId: params.promotionId,
          code: params.code,
          reservationId: params.reservationId,
          idempotencyKey: params.idempotencyKey,
          bookingId: params.bookingId,
          bookingReference: params.bookingReference,
          quotationId: params.quotationId,
          quotationNumber: params.quotationNumber,
          quotationVersion: params.quotationVersion,
          preDiscountBaseSellingPrice: params.preDiscountBaseSellingPrice,
          currency: params.currency,
          destinationId: params.destinationId,
          destinationIds: params.destinationIds,
          destinationName: params.destinationName,
          items: params.items || [],
          totalPax: params.totalPax || 1,
          appliedStage: params.appliedStage
        })
      });
      const data = await response.json().catch(() => null);
      if (data && typeof data.ok === 'boolean' && response.status < 500) {
        if (data.redemption) {
          db.upsertLocalPromotionRedemption(data.redemption);
        }
        return data;
      }
    } catch (err) {
      console.warn('[PROMO-API] /api/promotions/confirm-redemption unavailable:', err);
    }
  }

  const existing = db
    .getPromotionRedemptions()
    .find(
      (r) =>
        r.idempotencyKey === params.idempotencyKey ||
        (r.bookingId === params.bookingId && r.promotionId === params.promotionId)
    );
  if (existing) {
    return { ok: true, redemption: existing };
  }

  const snap = params.appliedPromotion;
  if (!snap) {
    return { ok: false, error: 'Missing promotion snapshot for redemption.' };
  }

  const redemption: PromotionRedemptionRecord = {
    id: `pred_local_${Date.now()}`,
    promotionId: snap.promotionId,
    promotionName: snap.promotionName,
    code: snap.code,
    normalizedCode: snap.normalizedCode,
    bookingId: params.bookingId,
    bookingReference: params.bookingReference,
    quotationId: params.quotationId,
    quotationNumber: params.quotationNumber,
    quotationVersion: params.quotationVersion,
    reservationId: params.reservationId,
    idempotencyKey: params.idempotencyKey,
    agencyId: params.user?.companyId,
    agencyName: params.user?.agencyName,
    agentUid: params.user?.id || 'anonymous',
    agentName: params.user?.name,
    agentEmail: params.user?.email,
    discountType: snap.discountType,
    discountValue: snap.discountValue,
    preDiscountBaseSellingPrice: snap.preDiscountBaseSellingPrice,
    discountAmount: snap.discountAmount,
    discountedBaseSellingPrice: snap.discountedBaseSellingPrice,
    currency: snap.currency,
    status: 'REDEEMED',
    appliedStage: params.appliedStage,
    redeemedAt: new Date().toISOString()
  };
  db.upsertLocalPromotionRedemption(redemption);
  return {
    ok: true,
    redemption,
    appliedPromotion: { ...snap, redemptionId: redemption.id }
  };
}

export async function releasePromotionReservationAsync(
  reservationId: string,
  reason: string = 'Booking confirmation cancelled'
): Promise<void> {
  if (!reservationId) return;
  db.markLocalPromotionReservationReleased(reservationId, reason);
  const token = await getBearerToken();
  if (!token) return;
  try {
    await fetch('/api/promotions/release-reservation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ reservationId, reason })
    });
  } catch {
    // Best-effort release
  }
}

export async function fetchAdminPromotionReportAsync(): Promise<{
  rows: PromotionReportRow[];
  redemptions: PromotionRedemptionRecord[];
  reservations: PromotionReservationRecord[];
  source: 'SERVER' | 'LOCAL';
}> {
  const token = await getBearerToken();
  if (token) {
    try {
      const response = await fetch('/api/admin/promotions/report', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.ok && Array.isArray(data.rows)) {
          return {
            rows: data.rows,
            redemptions: Array.isArray(data.redemptions) ? data.redemptions : [],
            reservations: Array.isArray(data.reservations) ? data.reservations : [],
            source: 'SERVER'
          };
        }
      }
    } catch (err) {
      console.warn('[PROMO-API] Admin report endpoint fallback:', err);
    }
  }

  const promotions = db.getPromotions();
  const redemptions = db.getPromotionRedemptions();
  const reservations = db.getPromotionReservations();
  return {
    rows: buildPromotionReportRows({ promotions, redemptions, reservations }),
    redemptions,
    reservations,
    source: 'LOCAL'
  };
}
