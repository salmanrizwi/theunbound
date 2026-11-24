import {
  AppliedPromotionSnapshot,
  CampaignStatus,
  CurrencyCode,
  Promotion,
  PromotionBookingValidityPolicy,
  PromotionRedemptionRecord,
  PromotionReportRow,
  PromotionReservationRecord,
  PromotionValidationErrorCode,
  PromotionValidationResult
} from '../types';
import { convertCurrencyWithMetadata, roundCurrencyAmount } from './currencyEngine';

export interface PromotionEvaluationItem {
  id: string;
  productId?: string;
  productName?: string;
  category?: string;
  productType?: string;
  destinationId?: string;
  baseSellingPrice?: number;
}

export interface PromotionEvaluationContext {
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
  agentUid?: string;
  agentName?: string;
  agentRole?: string;
  agencyId?: string;
  agencyName?: string;
  existingQuotationPromotionId?: string;
  now?: Date;
}

export interface PromotionUsageCounts {
  totalRedeemed: number;
  totalActiveReservations: number;
  agentRedeemed: number;
  agentActiveReservations: number;
  agencyRedeemed: number;
  agencyActiveReservations: number;
}

export type CurrencyConverterFn = (
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
) => { convertedAmount: number; effectiveRate: number } | null;

/**
 * Canonical case-insensitive normalization for discount codes.
 */
export function normalizePromotionCode(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/**
 * Resolves effective lifecycle status taking explicit status, isActive, isArchived,
 * and start/end validity window into account.
 */
export function resolveEffectivePromotionStatus(
  promo: Promotion,
  now: Date = new Date()
): CampaignStatus {
  if (promo.isArchived || promo.status === 'ARCHIVED') return 'ARCHIVED';
  if (promo.status === 'DISABLED') return 'DISABLED';
  if (promo.status === 'DRAFT') return 'DRAFT';
  if (promo.status === 'PAUSED' || promo.isActive === false) {
    if (promo.status === 'EXPIRED') return 'EXPIRED';
    if (promo.status === 'SCHEDULED') return 'SCHEDULED';
    return 'PAUSED';
  }

  const todayIso = now.toISOString().slice(0, 10);
  if (promo.endDate && todayIso > promo.endDate) {
    return 'EXPIRED';
  }
  if (promo.startDate && todayIso < promo.startDate) {
    return 'SCHEDULED';
  }
  if (promo.status === 'EXPIRED') return 'EXPIRED';
  return 'ACTIVE';
}

/**
 * Checks case-insensitive uniqueness of a discount code across promotions.
 */
export function isPromotionCodeUnique(
  promotions: Promotion[],
  code: string,
  excludePromotionId?: string
): { unique: boolean; conflictingPromotion?: Promotion } {
  const normalized = normalizePromotionCode(code);
  if (!normalized) return { unique: true };

  const conflict = promotions.find((p) => {
    if (excludePromotionId && p.id === excludePromotionId) return false;
    if (p.isArchived || p.status === 'ARCHIVED') return false;
    const existing = normalizePromotionCode(p.normalizedPromoCode || p.promoCode);
    return existing !== '' && existing === normalized;
  });

  return conflict ? { unique: false, conflictingPromotion: conflict } : { unique: true };
}

/**
 * Finds a promotion matching the entered discount code (case-insensitive by default).
 */
export function findPromotionByCode(
  promotions: Promotion[],
  enteredCode: string
): Promotion | undefined {
  const trimmed = String(enteredCode || '').trim();
  const normalized = normalizePromotionCode(trimmed);
  if (!normalized) return undefined;

  return promotions.find((p) => {
    const rawStored = String(p.promoCode || '').trim();
    const normStored = normalizePromotionCode(p.normalizedPromoCode || rawStored);
    if (!normStored) return false;
    if (p.caseInsensitiveCode === false) {
      return rawStored === trimmed;
    }
    return normStored === normalized;
  });
}

/**
 * Default central FX converter wrapper.
 */
export function defaultCurrencyConverter(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): { convertedAmount: number; effectiveRate: number } | null {
  if (fromCurrency === toCurrency) {
    return {
      convertedAmount: roundCurrencyAmount(amount, toCurrency),
      effectiveRate: 1
    };
  }
  try {
    const res = convertCurrencyWithMetadata(amount, fromCurrency, toCurrency);
    if (!res.isValid || !Number.isFinite(res.convertedAmount)) {
      return null;
    }
    return {
      convertedAmount: roundCurrencyAmount(res.convertedAmount, toCurrency),
      effectiveRate: res.exchangeRate
    };
  } catch {
    return null;
  }
}

/**
 * Strips strictly Admin-only fields before returning any promotion detail to B2B Agents.
 */
export function sanitizePromotionForAgent(
  promo: Promotion
): Omit<Promotion, 'internalAdminNotes' | 'applicableAgentIds' | 'applicableAgencyIds'> {
  const copy = { ...promo };
  delete (copy as any).internalAdminNotes;
  delete (copy as any).applicableAgentIds;
  delete (copy as any).applicableAgencyIds;
  return copy;
}

/**
 * Normalizes product category strings so matching across HOTEL, ACTIVITY, TRANSFER, VEHICLE, GUIDE, RAIL, VISA, PACKAGE is reliable.
 */
export function normalizeProductCategoryTag(raw?: string): string {
  const val = String(raw || '').trim().toUpperCase();
  if (!val) return '';
  if (val.includes('HOTEL') || val.includes('ACCOMMODATION') || val.includes('STAY')) return 'HOTEL';
  if (val.includes('TRANSFER') || val.includes('AIRPORT')) return 'TRANSFER';
  if (val.includes('VEHICLE') || val.includes('CHARTER') || val.includes('TRANSPORT') || val.includes('CAR')) return 'VEHICLE';
  if (val.includes('GUIDE')) return 'GUIDE';
  if (val.includes('RAIL') || val.includes('TRAIN') || val.includes('SHINKANSEN')) return 'RAIL';
  if (val.includes('VISA')) return 'VISA';
  if (val.includes('PACKAGE') || val.includes('ITINERARY')) return 'PACKAGE';
  if (val.includes('ACTIVITY') || val.includes('TOUR') || val.includes('EXPERIENCE') || val.includes('SIGHTSEEING') || val.includes('TICKET')) return 'ACTIVITY';
  if (val.includes('ADDON') || val.includes('ANCILLARY')) return 'ADDON';
  return val;
}

function makeFailure(
  errorCode: PromotionValidationErrorCode,
  message: string,
  now: Date
): PromotionValidationResult {
  return {
    valid: false,
    errorCode,
    message,
    validatedAt: now.toISOString(),
    source: 'ENGINE'
  };
}

/**
 * Computes usage counts from raw redemption & reservation records.
 */
export function computePromotionUsageCounts(params: {
  promotionId: string;
  redemptions: PromotionRedemptionRecord[];
  reservations: PromotionReservationRecord[];
  agentUid?: string;
  agencyId?: string;
  excludeReservationId?: string;
  now?: Date;
}): PromotionUsageCounts {
  const nowMs = (params.now || new Date()).getTime();
  const activeRedemptions = params.redemptions.filter(
    (r) => r.promotionId === params.promotionId && r.status === 'REDEEMED'
  );
  const activeReservations = params.reservations.filter((r) => {
    if (r.promotionId !== params.promotionId) return false;
    if (params.excludeReservationId && r.id === params.excludeReservationId) return false;
    if (r.status !== 'RESERVED') return false;
    const expMs = new Date(r.expiresAt).getTime();
    return Number.isFinite(expMs) && expMs > nowMs;
  });

  const agentUid = params.agentUid || '';
  const agencyId = params.agencyId || '';

  return {
    totalRedeemed: activeRedemptions.length,
    totalActiveReservations: activeReservations.length,
    agentRedeemed: agentUid
      ? activeRedemptions.filter((r) => r.agentUid === agentUid).length
      : 0,
    agentActiveReservations: agentUid
      ? activeReservations.filter((r) => r.agentUid === agentUid).length
      : 0,
    agencyRedeemed: agencyId
      ? activeRedemptions.filter((r) => r.agencyId && r.agencyId === agencyId).length
      : 0,
    agencyActiveReservations: agencyId
      ? activeReservations.filter((r) => r.agencyId && r.agencyId === agencyId).length
      : 0
  };
}

/**
 * Single authoritative deterministic evaluation of eligibility + Stage 1 Base Selling Price discount.
 * Strictly applies ONLY to preDiscountBaseSellingPrice (never supplier nett cost, never Stage 2 agent markup).
 */
export function evaluatePromotionEligibilityAndDiscount(params: {
  promotion: Promotion | undefined | null;
  context: PromotionEvaluationContext;
  usageCounts?: PromotionUsageCounts;
  currencyConverter?: CurrencyConverterFn;
}): PromotionValidationResult {
  const now = params.context.now || new Date();
  const converter = params.currencyConverter || defaultCurrencyConverter;
  const ctx = params.context;
  const normalizedInput = normalizePromotionCode(ctx.code);

  if (!normalizedInput) {
    return makeFailure('EMPTY_CODE', 'Please enter a promotion code.', now);
  }

  const promo = params.promotion;
  if (!promo) {
    return makeFailure(
      'NOT_FOUND',
      'This promotion code is not recognised. Please check the code and try again.',
      now
    );
  }

  // 0. Strict Channel Separation: Admin-only manual coupons cannot be self-applied by B2B Agents
  if (promo.couponChannel === 'ADMIN_MANUAL') {
    return makeFailure(
      'AGENT_NOT_ELIGIBLE',
      'This coupon code is reserved for Admin Manual Booking Discounts and cannot be applied in B2B quotations.',
      now
    );
  }

  // 1. Lifecycle Status & Validity Dates
  const effectiveStatus = resolveEffectivePromotionStatus(promo, now);
  if (effectiveStatus === 'ARCHIVED') {
    return makeFailure('ARCHIVED', 'This promotion is no longer available.', now);
  }
  if (effectiveStatus === 'DISABLED') {
    return makeFailure('DISABLED', 'This promotion code has been disabled by the administrator.', now);
  }
  if (effectiveStatus === 'DRAFT') {
    return makeFailure('DRAFT', 'This promotion is not active yet.', now);
  }
  if (effectiveStatus === 'PAUSED') {
    return makeFailure('PAUSED', 'This promotion is currently paused and cannot be applied.', now);
  }
  if (effectiveStatus === 'SCHEDULED') {
    return makeFailure(
      'SCHEDULED',
      `This promotion is scheduled to begin on ${promo.startDate}.`,
      now
    );
  }
  if (effectiveStatus === 'EXPIRED') {
    return makeFailure(
      'EXPIRED',
      `This promotion expired on ${promo.endDate}.`,
      now
    );
  }

  // 2. Stage & Quotation State Restrictions
  if (ctx.stage === 'BOOKING_CONFIRMATION') {
    const isAlreadyOnQuote =
      Boolean(ctx.existingQuotationPromotionId) &&
      ctx.existingQuotationPromotionId === promo.id;
    if (!isAlreadyOnQuote && promo.allowAtBookingConfirmation === false) {
      return makeFailure(
        'BOOKING_STAGE_NOT_ALLOWED',
        'This promotion code can only be applied while preparing the quotation, not at booking confirmation.',
        now
      );
    }
  }

  if (ctx.isDraftQuotation && promo.allowOnDraftQuotations === false) {
    return makeFailure(
      'DRAFT_QUOTES_NOT_ALLOWED',
      'This promotion code is not permitted on draft quotations.',
      now
    );
  }

  if (ctx.isRevisedQuotation) {
    if (promo.newQuotationsOnly === true) {
      return makeFailure(
        'NEW_QUOTES_ONLY',
        'This promotion code is valid only for brand-new quotations.',
        now
      );
    }
    if (promo.allowReuseOnRevisedQuotation === false) {
      return makeFailure(
        'REVISED_QUOTE_NOT_ALLOWED',
        'This promotion code cannot be reused on revised quotations.',
        now
      );
    }
  }

  // 3. Audience / Agency / Agent Eligibility
  if (promo.targetAudience === 'BUYER' && ctx.agentRole === 'B2B_AGENT') {
    return makeFailure(
      'AGENT_NOT_ELIGIBLE',
      'This promotion is not eligible for B2B agent quotations.',
      now
    );
  }

  const restrictedAgencies = (promo.applicableAgencyIds || []).filter(Boolean);
  const restrictedAgents = (promo.applicableAgentIds || []).filter(Boolean);
  const hasAgencyOrAgentRestrictions =
    promo.applyToAllAgents === false &&
    (restrictedAgencies.length > 0 || restrictedAgents.length > 0);

  if (hasAgencyOrAgentRestrictions) {
    const agencyMatch =
      restrictedAgencies.length > 0 && Boolean(ctx.agencyId) && restrictedAgencies.includes(ctx.agencyId!);
    const agentMatch =
      restrictedAgents.length > 0 && Boolean(ctx.agentUid) && restrictedAgents.includes(ctx.agentUid!);

    if (restrictedAgents.length > 0 && restrictedAgencies.length === 0 && !agentMatch) {
      return makeFailure(
        'AGENT_NOT_ELIGIBLE',
        'This promotion code is restricted to selected B2B partner accounts.',
        now
      );
    }
    if (restrictedAgencies.length > 0 && restrictedAgents.length === 0 && !agencyMatch) {
      return makeFailure(
        'AGENCY_NOT_ELIGIBLE',
        'This promotion code is restricted to selected partner agencies.',
        now
      );
    }
    if (!agentMatch && !agencyMatch) {
      return makeFailure(
        'AGENT_NOT_ELIGIBLE',
        'Your account is not eligible for this restricted promotion code.',
        now
      );
    }
  }

  // 4. Destination Eligibility
  const allowedDestIds = (
    promo.applicableDestinationIds && promo.applicableDestinationIds.length > 0
      ? promo.applicableDestinationIds
      : promo.destinationId && promo.destinationId !== 'all'
        ? [promo.destinationId]
        : []
  ).filter((d) => d && d !== 'all');

  if (promo.applyToAllDestinations === false && allowedDestIds.length > 0) {
    const quoteDests = new Set<string>(
      [
        ctx.destinationId,
        ...(ctx.destinationIds || []),
        ...(ctx.items || []).map((it) => it.destinationId)
      ]
        .filter(Boolean)
        .map((s) => String(s).trim().toLowerCase())
    );
    const allowedNorm = allowedDestIds.map((d) => d.trim().toLowerCase());
    const destNameNorm = String(ctx.destinationName || '').trim().toLowerCase();
    const matched = allowedNorm.some(
      (ad) => quoteDests.has(ad) || (destNameNorm && (ad === destNameNorm || ad.includes(destNameNorm)))
    );
    if (!matched) {
      return makeFailure(
        'DESTINATION_NOT_ELIGIBLE',
        'This promotion code does not apply to the selected destination.',
        now
      );
    }
  }

  // 5. Passenger Minimum
  if (promo.minPassengers && promo.minPassengers > 0) {
    const pax = Number(ctx.totalPax || 0);
    if (pax < promo.minPassengers) {
      return makeFailure(
        'MIN_PASSENGERS_NOT_MET',
        `This promotion requires a minimum of ${promo.minPassengers} passenger(s).`,
        now
      );
    }
  }

  // 6. Usage Limits (Total, Per-Agent, Per-Agency)
  const counts: PromotionUsageCounts = params.usageCounts || {
    totalRedeemed: 0,
    totalActiveReservations: 0,
    agentRedeemed: 0,
    agentActiveReservations: 0,
    agencyRedeemed: 0,
    agencyActiveReservations: 0
  };

  let remainingTotalUses: number | null = null;
  if (promo.totalUsageLimit && promo.totalUsageLimit > 0) {
    const usedTotal = counts.totalRedeemed + counts.totalActiveReservations;
    remainingTotalUses = Math.max(0, promo.totalUsageLimit - usedTotal);
    if (usedTotal >= promo.totalUsageLimit) {
      return makeFailure(
        'USAGE_LIMIT_REACHED',
        'This promotion code has reached its maximum usage limit.',
        now
      );
    }
  }

  const effectiveAgentLimit =
    promo.oneTimePerUser === true
      ? Math.min(1, promo.maxUsesPerAgent && promo.maxUsesPerAgent > 0 ? promo.maxUsesPerAgent : 1)
      : promo.maxUsesPerAgent && promo.maxUsesPerAgent > 0
        ? promo.maxUsesPerAgent
        : null;

  let remainingAgentUses: number | null = null;
  if (effectiveAgentLimit !== null) {
    const usedAgent = counts.agentRedeemed + counts.agentActiveReservations;
    remainingAgentUses = Math.max(0, effectiveAgentLimit - usedAgent);
    if (usedAgent >= effectiveAgentLimit) {
      return makeFailure(
        'AGENT_USAGE_LIMIT_REACHED',
        'You have already reached your usage limit for this promotion code.',
        now
      );
    }
  }

  let remainingAgencyUses: number | null = null;
  if (promo.maxUsesPerAgency && promo.maxUsesPerAgency > 0) {
    const usedAgency = counts.agencyRedeemed + counts.agencyActiveReservations;
    remainingAgencyUses = Math.max(0, promo.maxUsesPerAgency - usedAgency);
    if (usedAgency >= promo.maxUsesPerAgency) {
      return makeFailure(
        'AGENCY_USAGE_LIMIT_REACHED',
        'Your agency has reached its maximum usage limit for this promotion code.',
        now
      );
    }
  }

  // 7. Determine Eligible Base Selling Price (Full Quotation or Category/Product Filtered)
  const preDiscountBase = roundCurrencyAmount(
    Math.max(0, Number(ctx.preDiscountBaseSellingPrice || 0)),
    ctx.currency
  );
  if (preDiscountBase <= 0) {
    return makeFailure(
      'ZERO_ELIGIBLE_BASE',
      'Cannot apply a promotion code to a quotation with zero base selling price.',
      now
    );
  }

  const restrictedCategories = (promo.applicableProductCategories || [])
    .map(normalizeProductCategoryTag)
    .filter(Boolean);
  const restrictedProductIds =
    promo.applyToAllProducts === false ? (promo.applicableProductIds || []).filter(Boolean) : [];

  let eligibleBase = preDiscountBase;
  let eligibleComponentIds: string[] | undefined;

  if ((restrictedCategories.length > 0 || restrictedProductIds.length > 0) && ctx.items && ctx.items.length > 0) {
    const matchedItems = ctx.items.filter((it) => {
      const catTag = normalizeProductCategoryTag(it.category || it.productType);
      const catOk = restrictedCategories.length === 0 || restrictedCategories.includes(catTag);
      const prodOk =
        restrictedProductIds.length === 0 ||
        (Boolean(it.productId) && restrictedProductIds.includes(it.productId!)) ||
        restrictedProductIds.includes(it.id);
      return catOk && prodOk;
    });

    if (matchedItems.length === 0) {
      return makeFailure(
        restrictedCategories.length > 0 ? 'PRODUCT_CATEGORY_NOT_ELIGIBLE' : 'PRODUCT_NOT_ELIGIBLE',
        'None of the services in this quotation qualify for this promotion’s product/category rules.',
        now
      );
    }

    eligibleComponentIds = matchedItems.map((m) => m.id);
    const sumMatched = matchedItems.reduce(
      (sum, it) => sum + Math.max(0, Number(it.baseSellingPrice || 0)),
      0
    );
    if (sumMatched > 0) {
      eligibleBase = roundCurrencyAmount(Math.min(preDiscountBase, sumMatched), ctx.currency);
    }
  } else if (restrictedCategories.length > 0 || restrictedProductIds.length > 0) {
    // No line items supplied yet while product/category restrictions exist
    if (ctx.items && ctx.items.length === 0) {
      return makeFailure(
        restrictedCategories.length > 0 ? 'PRODUCT_CATEGORY_NOT_ELIGIBLE' : 'PRODUCT_NOT_ELIGIBLE',
        'Add eligible services to this quotation before applying this promotion code.',
        now
      );
    }
  }

  // 8. Minimum Eligible Base Selling Price (with central FX conversion if currencies differ)
  const promoCurrency: CurrencyCode = promo.currency || ctx.currency;
  let fxRateUsed = 1;
  const minThresholdRaw = Math.max(
    Number(promo.minEligibleBaseSellingPrice || 0),
    Number(promo.minBookingValue || 0)
  );

  if (minThresholdRaw > 0) {
    const convMin = converter(minThresholdRaw, promoCurrency, ctx.currency);
    if (!convMin) {
      return makeFailure(
        'FX_CONVERSION_UNAVAILABLE',
        `Unable to convert promotion minimum threshold from ${promoCurrency} to ${ctx.currency}.`,
        now
      );
    }
    fxRateUsed = convMin.effectiveRate;
    if (eligibleBase + 0.001 < convMin.convertedAmount) {
      return makeFailure(
        'MIN_VALUE_NOT_MET',
        `Minimum eligible base selling price of ${ctx.currency} ${convMin.convertedAmount.toLocaleString()} is required to use this code.`,
        now
      );
    }
  }

  // 9. Compute Discount Amount Strictly on Eligible Base Selling Price
  let rawDiscount = 0;
  if (promo.discountType === 'PERCENTAGE') {
    const pct = Math.max(0, Math.min(100, Number(promo.discountValue || 0)));
    rawDiscount = roundCurrencyAmount((eligibleBase * pct) / 100, ctx.currency);
  } else {
    const fixedVal = Math.max(0, Number(promo.discountValue || 0));
    const convFixed = converter(fixedVal, promoCurrency, ctx.currency);
    if (!convFixed) {
      return makeFailure(
        'FX_CONVERSION_UNAVAILABLE',
        `Unable to convert fixed promotion amount from ${promoCurrency} to ${ctx.currency}.`,
        now
      );
    }
    fxRateUsed = convFixed.effectiveRate;
    rawDiscount = convFixed.convertedAmount;
  }

  // 10. Apply Max Discount Caps (in promotion currency -> converted to quotation currency)
  const configuredCaps = [promo.maxDiscountAmount, promo.maxDiscount, promo.maxDiscountPerQuotation]
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0);

  let effectiveCapInQuoteCurrency: number | undefined;
  if (configuredCaps.length > 0) {
    const strictestCap = Math.min(...configuredCaps);
    const convCap = converter(strictestCap, promoCurrency, ctx.currency);
    if (!convCap) {
      return makeFailure(
        'FX_CONVERSION_UNAVAILABLE',
        `Unable to convert maximum discount cap from ${promoCurrency} to ${ctx.currency}.`,
        now
      );
    }
    effectiveCapInQuoteCurrency = convCap.convertedAmount;
    rawDiscount = Math.min(rawDiscount, convCap.convertedAmount);
  }

  // 11. Never exceed eligible base or cause negative Base Selling Price
  const finalDiscountAmount = roundCurrencyAmount(
    Math.max(0, Math.min(rawDiscount, eligibleBase, preDiscountBase)),
    ctx.currency
  );
  const discountedBaseSellingPrice = roundCurrencyAmount(
    Math.max(0, preDiscountBase - finalDiscountAmount),
    ctx.currency
  );

  const canonicalCode = normalizePromotionCode(promo.normalizedPromoCode || promo.promoCode || ctx.code);

  const snapshot: AppliedPromotionSnapshot = {
    promotionId: promo.id,
    code: canonicalCode,
    normalizedCode: canonicalCode,
    promotionName: promo.title,
    promotionDescription: promo.description || promo.subtitle || undefined,
    promotionConfigVersion: promo.configVersion || 1,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    promotionCurrency: promoCurrency,
    currency: ctx.currency,
    fxConversionRate: fxRateUsed,
    eligibleBaseSellingPrice: eligibleBase,
    preDiscountBaseSellingPrice: preDiscountBase,
    discountAmount: finalDiscountAmount,
    discountedBaseSellingPrice,
    eligibleComponentIds,
    eligibleProductCategories: restrictedCategories.length > 0 ? restrictedCategories : undefined,
    appliedAt: now.toISOString(),
    appliedByUid: ctx.agentUid,
    appliedByName: ctx.agentName,
    appliedStage: ctx.stage,
    validationStatus: ctx.stage === 'BOOKING_CONFIRMATION' ? 'REVALIDATED_VALID' : 'VALID',
    validationMessage: `Promotion ${canonicalCode} applied.`,
    eligibilitySnapshot: {
      destinationIds: allowedDestIds.length > 0 ? allowedDestIds : undefined,
      productCategories: restrictedCategories.length > 0 ? restrictedCategories : undefined,
      minPassengers: promo.minPassengers,
      minEligibleBaseSellingPrice: minThresholdRaw || undefined,
      maxDiscountCap: effectiveCapInQuoteCurrency,
      bookingValidityPolicy: (promo.bookingValidityPolicy || 'REQUIRE_REACCEPTANCE') as PromotionBookingValidityPolicy,
      startDate: promo.startDate,
      endDate: promo.endDate
    }
  };

  return {
    valid: true,
    message: `Promotion ${canonicalCode} applied (-${ctx.currency} ${finalDiscountAmount.toLocaleString()}).`,
    appliedPromotion: snapshot,
    remainingTotalUses,
    remainingAgentUses,
    remainingAgencyUses,
    validatedAt: now.toISOString(),
    source: 'ENGINE'
  };
}

/**
 * Deterministically computes Stage 1 promotion discount for an existing AppliedPromotionSnapshot
 * when invoked inside central pricingEngine.ts (ensures single calculation source and zero negative totals).
 */
export function computeStage1PromotionDiscount(params: {
  appliedPromotion?: AppliedPromotionSnapshot | null;
  stage1PreDiscountBase: number;
  targetCurrency: CurrencyCode;
  currencyConverter?: CurrencyConverterFn;
}): {
  preDiscountBaseSellingPrice: number;
  promotionDiscountAmount: number;
  discountedBaseSellingPrice: number;
  updatedSnapshot: AppliedPromotionSnapshot | null;
} {
  const preDiscount = roundCurrencyAmount(
    Math.max(0, Number(params.stage1PreDiscountBase || 0)),
    params.targetCurrency
  );
  const promo = params.appliedPromotion;
  if (!promo || !promo.promotionId || preDiscount <= 0) {
    return {
      preDiscountBaseSellingPrice: preDiscount,
      promotionDiscountAmount: 0,
      discountedBaseSellingPrice: preDiscount,
      updatedSnapshot: promo || null
    };
  }

  const converter = params.currencyConverter || defaultCurrencyConverter;
  const eligibleRatio =
    promo.preDiscountBaseSellingPrice > 0 && promo.eligibleBaseSellingPrice > 0
      ? Math.min(1, promo.eligibleBaseSellingPrice / promo.preDiscountBaseSellingPrice)
      : 1;
  const eligibleBase =
    Math.abs(preDiscount - promo.preDiscountBaseSellingPrice) < 0.01 && promo.eligibleBaseSellingPrice > 0
      ? Math.min(preDiscount, promo.eligibleBaseSellingPrice)
      : roundCurrencyAmount(preDiscount * eligibleRatio, params.targetCurrency);

  let rawDiscount = 0;
  if (promo.discountType === 'PERCENTAGE') {
    const pct = Math.max(0, Math.min(100, Number(promo.discountValue || 0)));
    rawDiscount = roundCurrencyAmount((eligibleBase * pct) / 100, params.targetCurrency);
  } else {
    const fromCurr = promo.promotionCurrency || promo.currency || params.targetCurrency;
    if (fromCurr === params.targetCurrency) {
      rawDiscount = roundCurrencyAmount(Math.max(0, Number(promo.discountValue || 0)), params.targetCurrency);
    } else {
      const conv = converter(Math.max(0, Number(promo.discountValue || 0)), fromCurr, params.targetCurrency);
      rawDiscount = conv
        ? conv.convertedAmount
        : roundCurrencyAmount(Math.max(0, Number(promo.discountAmount || 0)), params.targetCurrency);
    }
  }

  const cap = promo.eligibilitySnapshot?.maxDiscountCap;
  if (typeof cap === 'number' && Number.isFinite(cap) && cap > 0) {
    if (promo.currency === params.targetCurrency) {
      rawDiscount = Math.min(rawDiscount, cap);
    } else {
      const convCap = converter(cap, promo.currency, params.targetCurrency);
      if (convCap) {
        rawDiscount = Math.min(rawDiscount, convCap.convertedAmount);
      }
    }
  }

  const discountAmount = roundCurrencyAmount(
    Math.max(0, Math.min(rawDiscount, eligibleBase, preDiscount)),
    params.targetCurrency
  );
  const discountedBase = roundCurrencyAmount(
    Math.max(0, preDiscount - discountAmount),
    params.targetCurrency
  );

  const updatedSnapshot: AppliedPromotionSnapshot = {
    ...promo,
    currency: params.targetCurrency,
    eligibleBaseSellingPrice: eligibleBase,
    preDiscountBaseSellingPrice: preDiscount,
    discountAmount,
    discountedBaseSellingPrice: discountedBase
  };

  return {
    preDiscountBaseSellingPrice: preDiscount,
    promotionDiscountAmount: discountAmount,
    discountedBaseSellingPrice: discountedBase,
    updatedSnapshot
  };
}

/**
 * Builds Admin reporting rows directly from Promotions, Redemptions, and Reservations.
 */
export function buildPromotionReportRows(params: {
  promotions: Promotion[];
  redemptions: PromotionRedemptionRecord[];
  reservations: PromotionReservationRecord[];
  now?: Date;
}): PromotionReportRow[] {
  const now = params.now || new Date();
  const nowMs = now.getTime();

  return params.promotions.map((promo) => {
    const promoRedemptions = params.redemptions.filter(
      (r) => r.promotionId === promo.id && r.status === 'REDEEMED'
    );
    const promoReservations = params.reservations.filter((r) => r.promotionId === promo.id);
    const pendingReservations = promoReservations.filter(
      (r) => r.status === 'RESERVED' && new Date(r.expiresAt).getTime() > nowMs
    ).length;
    const releasedReservations = promoReservations.filter(
      (r) => r.status === 'RELEASED' || r.status === 'EXPIRED'
    ).length;

    const totalUsageLimit =
      promo.totalUsageLimit && promo.totalUsageLimit > 0 ? promo.totalUsageLimit : null;
    const remainingUsage =
      totalUsageLimit !== null
        ? Math.max(0, totalUsageLimit - promoRedemptions.length - pendingReservations)
        : null;

    const totalDiscountValueGranted = promoRedemptions.reduce(
      (sum, r) => sum + Math.max(0, Number(r.discountAmount || 0)),
      0
    );

    const uniqueBookings = new Set(promoRedemptions.map((r) => r.bookingId).filter(Boolean));
    const uniqueAgencies = new Set(promoRedemptions.map((r) => r.agencyId || r.agencyName).filter(Boolean));
    const uniqueAgents = new Set(promoRedemptions.map((r) => r.agentUid).filter(Boolean));

    return {
      promotionId: promo.id,
      code: normalizePromotionCode(promo.normalizedPromoCode || promo.promoCode),
      promotionName: promo.title,
      status: resolveEffectivePromotionStatus(promo, now),
      startDate: promo.startDate,
      endDate: promo.endDate,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      currency: promo.currency,
      totalUsageLimit,
      totalApplications:
        promo.totalApplicationsCount ?? promoRedemptions.length + promoReservations.length,
      successfulRedemptions: promoRedemptions.length,
      pendingReservations,
      releasedReservations,
      failedApplications: promo.failedApplicationsCount || 0,
      remainingUsage,
      totalDiscountValueGranted: Math.round(totalDiscountValueGranted * 100) / 100,
      bookingsCount: uniqueBookings.size,
      uniqueAgenciesCount: uniqueAgencies.size,
      uniqueAgentsCount: uniqueAgents.size
    };
  });
}
