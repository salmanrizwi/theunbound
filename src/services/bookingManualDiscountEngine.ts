import {
  AdminManualDiscountApplyPayload,
  Booking,
  BookingManualDiscountAdjustment,
  BookingManualDiscountPermissions,
  BookingManualDiscountPreview,
  BookingManualDiscountReportRow,
  BookingManualDiscountReportSummary,
  BookingManualDiscountSource,
  BookingManualDiscountType,
  BookingPricingSnapshot,
  BookingStatus,
  CurrencyCode,
  Promotion,
  User
} from '../types';
import { convertCurrency } from './pricingEngine';
import {
  normalizePromotionCode,
  resolveEffectivePromotionStatus
} from './promotionEngine';

// ============================================================================
// CENTRAL BOOKING MANUAL DISCOUNT & MARGIN RECALCULATION ENGINE
// Single Financial Source of Truth — Used by Backend API, DB, Reports & UI
// ============================================================================

export const BOOKING_MANUAL_DISCOUNT_BLOCKED_STATUSES: ReadonlySet<string> = new Set([
  'CANCELLED',
  'COMPLETED',
  'CLOSED',
  'REFUNDED'
]);

export const BOOKING_MANUAL_DISCOUNT_BLOCKED_PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  'REFUNDED'
]);

export const BOOKING_MANUAL_DISCOUNT_ALLOWED_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'DRAFT',
  'NEW',
  'TO_BE_PROCESSED',
  'PROCESSING',
  'WAITING_FOR_UPDATE',
  'CONFIRMED',
  'PENDING_CONFIRMATION',
  'IN_PROGRESS'
]);

const MASTER_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isBookingEligibleForManualDiscount(booking: Booking | null | undefined): {
  eligible: boolean;
  reason?: string;
} {
  if (!booking) {
    return { eligible: false, reason: 'Booking record not found.' };
  }
  if (booking.isDeleted) {
    return { eligible: false, reason: 'Cannot modify pricing on a deleted booking.' };
  }
  const status = String(booking.status || '').toUpperCase();
  if (BOOKING_MANUAL_DISCOUNT_BLOCKED_STATUSES.has(status)) {
    return {
      eligible: false,
      reason: `Manual discounts are blocked for bookings with status "${status}".`
    };
  }
  const payStatus = String(booking.paymentStatus || '').toUpperCase();
  if (BOOKING_MANUAL_DISCOUNT_BLOCKED_PAYMENT_STATUSES.has(payStatus)) {
    return {
      eligible: false,
      reason: `Manual discounts are blocked for bookings with payment status "${payStatus}".`
    };
  }
  if (!BOOKING_MANUAL_DISCOUNT_ALLOWED_STATUSES.has(status as BookingStatus)) {
    return {
      eligible: false,
      reason: `Booking status "${status}" does not permit pricing adjustments.`
    };
  }
  return { eligible: true };
}

/**
 * Granular RBAC resolution for Admin Manual Discount Coupons & Internal Margin Visibility.
 * B2B Agents, Buyers, Guests, and unapproved accounts are strictly denied all permissions.
 */
export function resolveAdminManualDiscountPermissions(
  user: Partial<User> | Record<string, any> | null | undefined
): BookingManualDiscountPermissions {
  const denyAll: BookingManualDiscountPermissions = {
    canViewInternalMargin: false,
    canApplyManualDiscount: false,
    canApplyAdminCoupon: false,
    canApproveManualDiscount: false,
    canOverrideMarginProtection: false,
    canReverseManualDiscount: false,
    canViewDiscountReports: false
  };

  if (!user) return denyAll;

  const email = String(user.email || '').trim().toLowerCase();
  const role = String(user.role || (user as any).userType || '').toUpperCase();

  if (MASTER_ADMIN_EMAILS.has(email)) {
    return {
      canViewInternalMargin: true,
      canApplyManualDiscount: true,
      canApplyAdminCoupon: true,
      canApproveManualDiscount: true,
      canOverrideMarginProtection: true,
      canReverseManualDiscount: true,
      canViewDiscountReports: true
    };
  }

  // Strictly block all external roles regardless of any client-side flags
  if (
    role === 'B2B_AGENT' ||
    role === 'AGENT' ||
    role === 'AGENCY_OWNER' ||
    role === 'BUYER' ||
    role === 'VIEWER' ||
    role === 'PUBLIC' ||
    !role
  ) {
    return denyAll;
  }

  if (user.approvalStatus && user.approvalStatus !== 'APPROVED') {
    return denyAll;
  }

  const perms = user.permissions || {};
  const ops = perms.bookingOperations || {};
  const finance = perms.cmsFinance || {};

  if (role === 'SUPER_ADMIN') {
    return {
      canViewInternalMargin: true,
      canApplyManualDiscount: true,
      canApplyAdminCoupon: true,
      canApproveManualDiscount: true,
      canOverrideMarginProtection: true,
      canReverseManualDiscount: true,
      canViewDiscountReports: true
    };
  }

  if (role === 'ADMIN') {
    return {
      canViewInternalMargin: ops.view_internal_margin !== false,
      canApplyManualDiscount: ops.apply_manual_discount !== false,
      canApplyAdminCoupon: ops.apply_admin_coupon !== false,
      canApproveManualDiscount: ops.approve_manual_discount !== false,
      canOverrideMarginProtection: ops.override_margin_protection === true || ops.override_margin_protection === undefined,
      canReverseManualDiscount: ops.reverse_manual_discount !== false,
      canViewDiscountReports: ops.view_discount_reports !== false
    };
  }

  // Internal staff (TEAM_MEMBER / DMC_STAFF): explicit granular opt-in required for sensitive actions
  if (role === 'TEAM_MEMBER' || role === 'DMC_STAFF') {
    const canViewMargin = Boolean(
      ops.view_internal_margin === true ||
      ops.view_internal_financials === true ||
      finance.enabled === true ||
      finance.pricing === true ||
      perms.canAccessFinancials === true
    );
    const canApply = Boolean(ops.apply_manual_discount === true);
    const canApplyCoupon = Boolean(ops.apply_admin_coupon === true || ops.apply_manual_discount === true);
    const canApprove = Boolean(ops.approve_manual_discount === true);
    // Margin loss-making override requires explicit permission — never granted implicitly to non-Admin staff
    const canOverride = Boolean(ops.override_margin_protection === true);
    const canReverse = Boolean(ops.reverse_manual_discount === true);
    const canViewReports = Boolean(
      ops.view_discount_reports === true ||
      finance.enabled === true ||
      perms.canAccessFinancials === true
    );

    return {
      canViewInternalMargin: canViewMargin,
      canApplyManualDiscount: canApply,
      canApplyAdminCoupon: canApplyCoupon,
      canApproveManualDiscount: canApprove,
      canOverrideMarginProtection: canOverride,
      canReverseManualDiscount: canReverse,
      canViewDiscountReports: canViewReports
    };
  }

  return denyAll;
}

/**
 * Resolves the authoritative Supplier Nett Cost for a booking.
 * INVARIANT: Never modified by B2B promotion discounts or Admin manual discounts.
 */
export function resolveAuthoritativeSupplierNettCost(booking: Booking): number {
  const initialSnapshot = getInitialBookingPricingSnapshotIfPresent(booking);
  if (initialSnapshot && Number.isFinite(initialSnapshot.supplierNettCost)) {
    return roundMoney(Math.max(0, initialSnapshot.supplierNettCost));
  }

  if (typeof booking.totalNetCost === 'number' && booking.totalNetCost >= 0 && booking.totalNetCost > 0) {
    return roundMoney(booking.totalNetCost);
  }
  if (typeof booking.internalNettCost === 'number' && booking.internalNettCost > 0) {
    return roundMoney(booking.internalNettCost);
  }
  if (typeof booking.supplierTotalCost === 'number' && booking.supplierTotalCost > 0) {
    return roundMoney(booking.supplierTotalCost);
  }
  if (typeof booking.supplierCost === 'number' && booking.supplierCost > 0) {
    return roundMoney(booking.supplierCost);
  }
  if (booking.items && booking.items.length > 0) {
    const sumFromItems = booking.items.reduce((acc, it) => {
      if (typeof it.supplierTotalCost === 'number' && it.supplierTotalCost > 0) {
        return acc + it.supplierTotalCost;
      }
      if (typeof it.supplierPrice === 'number' && it.supplierPrice > 0) {
        return acc + it.supplierPrice;
      }
      if (typeof it.unitNetPrice === 'number' && it.unitNetPrice > 0) {
        const qty = it.totalPax && it.totalPax > 0 ? it.totalPax : 1;
        // If unitNetPrice is already total line nett (matches quote conversion), avoid over-multiplying
        const lineSelling = it.totalPrice || it.unitSellingPrice || 0;
        if (lineSelling > 0 && it.unitNetPrice * qty > lineSelling * 1.5 && it.unitNetPrice <= lineSelling) {
          return acc + it.unitNetPrice;
        }
        return acc + it.unitNetPrice * qty;
      }
      return acc;
    }, 0);
    if (sumFromItems > 0) {
      return roundMoney(sumFromItems);
    }
  }
  return 0;
}

function getInitialBookingPricingSnapshotIfPresent(
  booking: Booking,
  externalSnapshots?: BookingPricingSnapshot[]
): BookingPricingSnapshot | null {
  const list = externalSnapshots && externalSnapshots.length > 0
    ? externalSnapshots
    : (booking.pricingSnapshotHistory || []);
  if (!list || list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a.version - b.version);
  return sorted[0] || null;
}

/**
 * Returns the canonical immutable baseline snapshot (Version 1) for a booking.
 * Never double-counts existing B2B promotion discounts or Stage 2 agent markups.
 */
export function buildInitialBookingPricingSnapshot(
  booking: Booking,
  externalSnapshots?: BookingPricingSnapshot[]
): BookingPricingSnapshot {
  const existingInitial = getInitialBookingPricingSnapshotIfPresent(booking, externalSnapshots);
  if (existingInitial) {
    return existingInitial;
  }

  const currency: CurrencyCode = booking.currency || 'USD';
  const supplierNettCost = resolveAuthoritativeSupplierNettCost(booking);

  const b2bPromoDiscount = roundMoney(
    Math.max(
      0,
      booking.b2bPromotionDiscountAmount ??
      booking.promotionDiscountAmount ??
      booking.appliedPromotion?.discountAmount ??
      0
    )
  );

  const agentAdditionalMarkup = roundMoney(
    Math.max(
      0,
      booking.agentMarginAmount ??
      booking.agent_margin_amount ??
      booking.agentMarkup ??
      0
    )
  );

  const currentCustomerSelling = roundMoney(
    Math.max(
      0,
      booking.finalCustomerSellingPrice ??
      booking.final_customer_selling_price ??
      booking.totalAmount ??
      0
    )
  );

  // If legacy booking already had adminManualDiscountTotal without snapshot history, restore original before admin manual discounts
  const existingManualTotal = roundMoney(Math.max(0, booking.adminManualDiscountTotal || 0));
  const originalCustomerSellingPrice = roundMoney(currentCustomerSelling + existingManualTotal);

  const discountedBaseFromBooking =
    booking.discountedBaseSellingPrice ??
    booking.baseFinalSellingPrice ??
    booking.base_final_selling_price;

  let originalBaseSellingPrice: number;
  if (typeof booking.preDiscountBaseSellingPrice === 'number' && booking.preDiscountBaseSellingPrice > 0) {
    originalBaseSellingPrice = roundMoney(booking.preDiscountBaseSellingPrice);
  } else if (typeof discountedBaseFromBooking === 'number' && discountedBaseFromBooking > 0) {
    originalBaseSellingPrice = roundMoney(discountedBaseFromBooking + b2bPromoDiscount + existingManualTotal);
  } else {
    originalBaseSellingPrice = roundMoney(
      Math.max(0, originalCustomerSellingPrice - agentAdditionalMarkup + b2bPromoDiscount)
    );
  }

  // Original applicable TheUnbound margin before B2B promo & Admin manual discounts
  const originalTheUnboundMargin =
    typeof booking.originalTheUnboundMargin === 'number' && Number.isFinite(booking.originalTheUnboundMargin)
      ? roundMoney(booking.originalTheUnboundMargin)
      : roundMoney(originalBaseSellingPrice - supplierNettCost);

  // Remaining margin after B2B promo (before any Admin manual discounts)
  const remainingAfterB2BPromo = roundMoney(originalTheUnboundMargin - b2bPromoDiscount);
  const discountedBaseSellingPrice = roundMoney(Math.max(0, originalBaseSellingPrice - b2bPromoDiscount));

  return {
    snapshotId: `bps-${booking.id}-v1`,
    id: `bps-${booking.id}-v1`,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    version: 1,
    currency,
    supplierNettCost,
    originalBaseSellingPrice,
    originalCustomerSellingPrice,
    originalTheUnboundMargin,
    b2bPromotionDiscountAmount: b2bPromoDiscount,
    b2bPromotionCode: booking.appliedPromotion?.code || booking.appliedPromotion?.normalizedCode,
    b2bPromotionId: booking.appliedPromotion?.promotionId,
    agentAdditionalMarkupAmount: agentAdditionalMarkup,
    cumulativeAdminManualDiscount: 0,
    remainingTheUnboundMargin: remainingAfterB2BPromo,
    revisedBaseSellingPrice: discountedBaseSellingPrice,
    revisedCustomerSellingPrice: originalCustomerSellingPrice,
    isLossMaking: remainingAfterB2BPromo < 0,
    sourceAction: 'INITIAL_BOOKING',
    createdBy: booking.submittedByUserId || booking.userId || 'system',
    createdByName: booking.submittingAgentNameSnapshot || booking.agentName || 'System Booking Snapshot',
    createdByRole: String(booking.submittedByUserRole || booking.userRole || 'SYSTEM'),
    createdAt: booking.createdAt || new Date().toISOString(),
    immutable: true
  };
}

/**
 * Returns the latest committed immutable pricing snapshot for a booking.
 */
export function getLatestBookingPricingSnapshot(
  booking: Booking,
  externalSnapshots?: BookingPricingSnapshot[]
): BookingPricingSnapshot {
  const list = externalSnapshots && externalSnapshots.length > 0
    ? externalSnapshots
    : (booking.pricingSnapshotHistory || []);

  if (list && list.length > 0) {
    const sorted = [...list].sort((a, b) => b.version - a.version);
    return sorted[0];
  }
  return buildInitialBookingPricingSnapshot(booking);
}

/**
 * Computes the set of reversed APPLY adjustment IDs purely from append-only ledger records.
 */
export function getReversedAdjustmentIdSet(
  adjustments: BookingManualDiscountAdjustment[] | undefined | null
): Set<string> {
  const reversed = new Set<string>();
  if (!Array.isArray(adjustments)) return reversed;
  for (const adj of adjustments) {
    if (adj.actionType === 'REVERSE' && adj.reversedAdjustmentId) {
      reversed.add(adj.reversedAdjustmentId);
    }
    if (adj.actionType === 'APPLY' && adj.status === 'REVERSED') {
      reversed.add(adj.adjustmentId || adj.id);
    }
  }
  return reversed;
}

/**
 * Computes active (non-reversed) APPLY adjustments from an append-only list.
 */
export function getActiveManualDiscountAdjustments(
  adjustments: BookingManualDiscountAdjustment[] | undefined | null
): BookingManualDiscountAdjustment[] {
  if (!Array.isArray(adjustments)) return [];
  const reversedIds = getReversedAdjustmentIdSet(adjustments);
  return adjustments.filter(
    adj => adj.actionType === 'APPLY' && !reversedIds.has(adj.adjustmentId || adj.id)
  );
}

/**
 * Validates whether a Promotion record is eligible for Admin Manual Coupon application on an existing booking.
 */
export function validateAdminCouponEligibilityForBooking(params: {
  coupon: Promotion;
  booking: Booking;
  existingCouponUsageCount?: number;
  now?: Date;
}): { valid: boolean; errors: string[]; warnings: string[] } {
  const { coupon, booking, existingCouponUsageCount = 0, now = new Date() } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  const channel = coupon.couponChannel || 'B2B_AGENT';
  if (channel !== 'ADMIN_MANUAL' && channel !== 'BOTH') {
    errors.push(
      `Coupon "${coupon.promoCode || coupon.title}" is restricted to B2B Agent quotations and is not enabled as an Admin Manual Coupon.`
    );
  }

  if (coupon.permittedForExistingBookings === false) {
    errors.push(`Coupon "${coupon.promoCode || coupon.title}" is not permitted for existing bookings.`);
  }

  const effectiveStatus = resolveEffectivePromotionStatus(coupon, now);
  if (effectiveStatus !== 'ACTIVE') {
    errors.push(
      `Coupon "${coupon.promoCode || coupon.title}" is currently ${effectiveStatus} and cannot be applied.`
    );
  }

  // Usage limit check
  if (coupon.totalUsageLimit && coupon.totalUsageLimit > 0) {
    const used = Math.max(
      existingCouponUsageCount,
      (coupon.successfulRedemptionsCount || 0) + (coupon.adminManualRedemptionsCount || 0)
    );
    if (used >= coupon.totalUsageLimit) {
      errors.push(`Coupon "${coupon.promoCode || coupon.title}" has reached its global usage limit (${coupon.totalUsageLimit}).`);
    }
  }

  // Eligible agencies restriction
  if (coupon.applicableAgencyIds && coupon.applicableAgencyIds.length > 0) {
    const bookingAgencyId = booking.agencyId || '';
    const bookingAgencyName = (booking.agencyName || booking.agentAgency || booking.customer?.agencyName || '').toLowerCase();
    const matchesAgency = coupon.applicableAgencyIds.some(
      id => id === bookingAgencyId || (bookingAgencyName && id.toLowerCase() === bookingAgencyName)
    );
    if (!matchesAgency) {
      errors.push(`Coupon "${coupon.promoCode || coupon.title}" is not eligible for this booking's agency.`);
    }
  }

  // Eligible booking IDs restriction
  if (coupon.eligibleBookingIds && coupon.eligibleBookingIds.length > 0) {
    const matchesBooking = coupon.eligibleBookingIds.some(
      id => id === booking.id || id === booking.bookingReference
    );
    if (!matchesBooking) {
      errors.push(`Coupon "${coupon.promoCode || coupon.title}" is restricted to specific bookings.`);
    }
  }

  // Eligible booking categories restriction
  if (coupon.eligibleBookingCategories && coupon.eligibleBookingCategories.length > 0) {
    const bookingCats = new Set(
      (booking.items || []).map(it => String(it.category || it.productType || '').toUpperCase())
    );
    const hasMatch = coupon.eligibleBookingCategories.some(c =>
      bookingCats.has(c.toUpperCase())
    );
    if (bookingCats.size > 0 && !hasMatch) {
      errors.push(`Coupon "${coupon.promoCode || coupon.title}" does not match the service categories on this booking.`);
    }
  }

  if (coupon.requiresAdminApproval) {
    warnings.push('This Admin coupon requires approval confirmation / reference before application.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Central preview calculator for Admin Manual Discounts & Admin Coupons.
 * Never mutates booking state. Computes exact financial impact from the latest committed snapshot.
 */
export function calculateBookingManualDiscountPreview(params: {
  booking: Booking;
  discountSource: BookingManualDiscountSource;
  discountType: BookingManualDiscountType;
  discountValue: number;
  discountCurrency?: CurrencyCode;
  coupon?: Promotion | null;
  couponUsageCount?: number;
  allowMarginOverride?: boolean;
  marginOverrideReason?: string;
  approvalReference?: string;
  permissions?: BookingManualDiscountPermissions;
  externalSnapshots?: BookingPricingSnapshot[];
  existingInvoicesCount?: number;
  now?: Date;
}): BookingManualDiscountPreview {
  const {
    booking,
    discountSource,
    discountType,
    discountValue,
    coupon = null,
    couponUsageCount = 0,
    allowMarginOverride = false,
    marginOverrideReason = '',
    approvalReference = '',
    permissions,
    externalSnapshots,
    existingInvoicesCount,
    now = new Date()
  } = params;

  const bookingCurrency: CurrencyCode = booking.currency || 'USD';
  const effectiveDiscountType: BookingManualDiscountType = coupon
    ? (coupon.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED')
    : discountType;
  const effectiveDiscountValue: number = coupon
    ? Number(coupon.discountValue || 0)
    : Number(discountValue || 0);
  const discountCurrency: CurrencyCode = coupon
    ? (coupon.currency || bookingCurrency)
    : (params.discountCurrency || bookingCurrency);

  const baseline = buildInitialBookingPricingSnapshot(booking, externalSnapshots);
  const latest = getLatestBookingPricingSnapshot(booking, externalSnapshots);

  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  // 1. Booking status & lifecycle check
  const eligibilityCheck = isBookingEligibleForManualDiscount(booking);
  if (!eligibilityCheck.eligible && eligibilityCheck.reason) {
    validationErrors.push(eligibilityCheck.reason);
  }

  // 2. Permission check (if provided)
  if (permissions) {
    if (discountSource === 'ADMIN_MANUAL_COUPON' && !permissions.canApplyAdminCoupon) {
      validationErrors.push('You do not have permission to apply Admin manual coupons.');
    } else if (discountSource === 'ADMIN_MANUAL_ADJUSTMENT' && !permissions.canApplyManualDiscount) {
      validationErrors.push('You do not have permission to apply manual booking discounts.');
    }
  }

  // 3. Coupon eligibility validation
  if (discountSource === 'ADMIN_MANUAL_COUPON') {
    if (!coupon) {
      validationErrors.push('Please select or enter a valid Admin Manual Coupon.');
    } else {
      const couponCheck = validateAdminCouponEligibilityForBooking({
        coupon,
        booking,
        existingCouponUsageCount: couponUsageCount,
        now
      });
      validationErrors.push(...couponCheck.errors);
      validationWarnings.push(...couponCheck.warnings);
    }
  }

  // 4. Value & FX conversion calculation
  if (!Number.isFinite(effectiveDiscountValue) || effectiveDiscountValue <= 0) {
    validationErrors.push('Discount value must be greater than zero.');
  }
  if (effectiveDiscountType === 'PERCENTAGE' && effectiveDiscountValue > 100) {
    validationErrors.push('Percentage discount cannot exceed 100%.');
  }

  let fxRateApplied = 1;
  let requestedDiscountAmount = 0;
  let couponCapApplied = false;

  if (effectiveDiscountValue > 0) {
    if (effectiveDiscountType === 'PERCENTAGE') {
      // Percentage is calculated against the latest committed TheUnbound base selling price
      const percentageBasis = Math.max(0, latest.revisedBaseSellingPrice);
      requestedDiscountAmount = roundMoney((percentageBasis * effectiveDiscountValue) / 100);
    } else {
      if (discountCurrency === bookingCurrency) {
        requestedDiscountAmount = roundMoney(effectiveDiscountValue);
        fxRateApplied = 1;
      } else {
        const converted = convertCurrency(effectiveDiscountValue, discountCurrency, bookingCurrency);
        requestedDiscountAmount = roundMoney(converted);
        fxRateApplied = effectiveDiscountValue > 0 ? roundMoney(converted / effectiveDiscountValue) : 1;
      }
    }

    // Apply coupon max discount cap if configured
    if (coupon) {
      const rawCap = coupon.maxDiscountAmount || coupon.maxDiscount || coupon.maxDiscountPerQuotation || 0;
      if (rawCap > 0) {
        const capInBookingCurrency =
          (coupon.currency || bookingCurrency) === bookingCurrency
            ? rawCap
            : convertCurrency(rawCap, coupon.currency || bookingCurrency, bookingCurrency);
        if (requestedDiscountAmount > capInBookingCurrency) {
          requestedDiscountAmount = roundMoney(capInBookingCurrency);
          couponCapApplied = true;
          validationWarnings.push(
            `Coupon cap applied: discount capped at ${bookingCurrency} ${requestedDiscountAmount.toLocaleString()}.`
          );
        }
      }
    }
  }

  // Never allow customer selling price to become negative
  if (requestedDiscountAmount > latest.revisedCustomerSellingPrice) {
    validationErrors.push(
      `Requested discount (${bookingCurrency} ${requestedDiscountAmount.toLocaleString()}) cannot exceed the current customer selling price (${bookingCurrency} ${latest.revisedCustomerSellingPrice.toLocaleString()}).`
    );
  }

  // 5. Margin Protection Calculation (Central Authority)
  const availableMarginBeforeDiscount = roundMoney(latest.remainingTheUnboundMargin);
  const cumulativeAdminManualDiscountAfter = roundMoney(
    latest.cumulativeAdminManualDiscount + requestedDiscountAmount
  );
  const remainingTheUnboundMarginAfter = roundMoney(
    availableMarginBeforeDiscount - requestedDiscountAmount
  );
  const revisedBaseSellingPrice = roundMoney(
    Math.max(0, latest.revisedBaseSellingPrice - requestedDiscountAmount)
  );
  const revisedCustomerSellingPrice = roundMoney(
    Math.max(0, latest.revisedCustomerSellingPrice - requestedDiscountAmount)
  );

  const exceedsAvailableMargin = requestedDiscountAmount > availableMarginBeforeDiscount;
  let marginProtectionBlocked = false;
  let isLossMakingOverride = false;

  if (exceedsAvailableMargin) {
    const canOverride = permissions ? permissions.canOverrideMarginProtection : false;
    if (!allowMarginOverride) {
      marginProtectionBlocked = true;
      validationErrors.push(
        `Margin protection blocked: requested discount (${bookingCurrency} ${requestedDiscountAmount.toLocaleString()}) exceeds available TheUnbound margin (${bookingCurrency} ${Math.max(0, availableMarginBeforeDiscount).toLocaleString()}).`
      );
    } else if (permissions && !canOverride) {
      marginProtectionBlocked = true;
      validationErrors.push(
        'Margin protection override denied: your role does not have Loss-Making Margin Override permission.'
      );
    } else if (!marginOverrideReason || marginOverrideReason.trim().length < 5) {
      marginProtectionBlocked = true;
      validationErrors.push(
        'A mandatory override reason (at least 5 characters) is required for a Loss-Making Margin Override.'
      );
    } else {
      isLossMakingOverride = true;
      validationWarnings.push(
        `Loss-Making Margin Override active: remaining margin will become ${bookingCurrency} ${remainingTheUnboundMarginAfter.toLocaleString()}.`
      );
    }
  }

  // 6. Coupon Approval check
  const requiresApproval = Boolean(coupon?.requiresAdminApproval);
  if (requiresApproval) {
    const canApprove = permissions ? permissions.canApproveManualDiscount : true;
    if (!canApprove && (!approvalReference || approvalReference.trim().length < 3)) {
      validationErrors.push(
        'This coupon requires Admin approval. Provide an approval reference or have an authorized approver apply it.'
      );
    }
  }

  const hasExistingInvoices =
    typeof existingInvoicesCount === 'number'
      ? existingInvoicesCount > 0
      : Boolean((booking.proformaInvoiceIds && booking.proformaInvoiceIds.length > 0) || booking.activeProformaInvoiceId);

  if (hasExistingInvoices) {
    validationWarnings.push(
      'An invoice has already been issued for this booking. Historical invoices will remain immutable; you may issue a revised versioned proforma invoice after applying this discount.'
    );
  }

  return {
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    bookingStatus: booking.status,
    bookingCurrency,
    discountCurrency,
    fxRateApplied,
    discountSource,
    discountType: effectiveDiscountType,
    discountValue: effectiveDiscountValue,
    couponId: coupon?.id,
    couponCode: coupon ? normalizePromotionCode(coupon.promoCode || '') : undefined,
    couponTitle: coupon?.title,
    couponCapApplied,
    supplierNettCost: baseline.supplierNettCost,
    originalBaseSellingPrice: baseline.originalBaseSellingPrice,
    originalCustomerSellingPrice: baseline.originalCustomerSellingPrice,
    originalTheUnboundMargin: baseline.originalTheUnboundMargin,
    b2bPromotionDiscountAmount: baseline.b2bPromotionDiscountAmount,
    b2bPromotionCode: baseline.b2bPromotionCode,
    agentAdditionalMarkupAmount: baseline.agentAdditionalMarkupAmount,
    previousAdminManualDiscountTotal: latest.cumulativeAdminManualDiscount,
    availableMarginBeforeDiscount,
    requestedDiscountAmount,
    cumulativeAdminManualDiscountAfter,
    remainingTheUnboundMarginAfter,
    previousCustomerSellingPrice: latest.revisedCustomerSellingPrice,
    revisedCustomerSellingPrice,
    previousBaseSellingPrice: latest.revisedBaseSellingPrice,
    revisedBaseSellingPrice,
    marginProtectionBlocked,
    requiresLossOverride: exceedsAvailableMargin,
    isLossMakingOverride,
    requiresApproval,
    hasExistingInvoices,
    eligible: eligibilityCheck.eligible,
    canApply: validationErrors.length === 0 && requestedDiscountAmount > 0,
    validationErrors,
    validationWarnings,
    latestSnapshotVersion: latest.version,
    latestSnapshotId: latest.snapshotId
  };
}

/**
 * Produces the next immutable adjustment record, immutable versioned pricing snapshot,
 * and updated booking projection fields (never overwriting previous snapshots or supplier nett cost).
 */
export function buildApplyManualDiscountCommit(params: {
  booking: Booking;
  payload: AdminManualDiscountApplyPayload;
  actor: {
    id: string;
    name: string;
    email?: string;
    role: string;
  };
  permissions: BookingManualDiscountPermissions;
  coupon?: Promotion | null;
  couponUsageCount?: number;
  externalSnapshots?: BookingPricingSnapshot[];
  externalAdjustments?: BookingManualDiscountAdjustment[];
  existingInvoicesCount?: number;
  now?: Date;
}):
  | {
      ok: true;
      initialSnapshotToPersist?: BookingPricingSnapshot;
      adjustment: BookingManualDiscountAdjustment;
      newSnapshot: BookingPricingSnapshot;
      updatedBooking: Booking;
      preview: BookingManualDiscountPreview;
    }
  | {
      ok: false;
      error: string;
      preview: BookingManualDiscountPreview;
    } {
  const {
    booking,
    payload,
    actor,
    permissions,
    coupon = null,
    couponUsageCount = 0,
    externalSnapshots,
    externalAdjustments,
    existingInvoicesCount,
    now = new Date()
  } = params;

  const reason = (payload.reason || '').trim();
  const preview = calculateBookingManualDiscountPreview({
    booking,
    discountSource: payload.discountSource,
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    discountCurrency: payload.discountCurrency,
    coupon,
    couponUsageCount,
    allowMarginOverride: payload.allowMarginOverride,
    marginOverrideReason: payload.marginOverrideReason,
    approvalReference: payload.approvalReference,
    permissions,
    externalSnapshots,
    existingInvoicesCount,
    now
  });

  if (reason.length < 3) {
    preview.validationErrors.push('A mandatory internal reason (at least 3 characters) is required.');
    preview.canApply = false;
  }

  if (
    typeof payload.expectedSnapshotVersion === 'number' &&
    payload.expectedSnapshotVersion !== preview.latestSnapshotVersion
  ) {
    preview.validationErrors.push(
      `Pricing snapshot version conflict: expected v${payload.expectedSnapshotVersion}, but latest committed snapshot is v${preview.latestSnapshotVersion}. Please refresh and retry.`
    );
    preview.canApply = false;
  }

  if (!preview.canApply) {
    return {
      ok: false,
      error: preview.validationErrors[0] || 'Manual discount cannot be applied.',
      preview
    };
  }

  const nowIso = now.toISOString();
  const existingSnapshots =
    externalSnapshots && externalSnapshots.length > 0
      ? [...externalSnapshots]
      : [...(booking.pricingSnapshotHistory || [])];
  const existingAdjustments =
    externalAdjustments && externalAdjustments.length > 0
      ? [...externalAdjustments]
      : [...(booking.manualDiscountAdjustments || [])];

  const baseline = buildInitialBookingPricingSnapshot(booking, existingSnapshots);
  const needsInitialPersist = existingSnapshots.length === 0;
  if (needsInitialPersist) {
    existingSnapshots.push(baseline);
  }

  const latest = getLatestBookingPricingSnapshot(booking, existingSnapshots);
  const nextVersion = latest.version + 1;
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  const adjustmentId = `bmd-${booking.id}-v${nextVersion}-${Date.now()}-${randomSuffix}`;
  const newSnapshotId = `bps-${booking.id}-v${nextVersion}`;

  const newSnapshot: BookingPricingSnapshot = {
    snapshotId: newSnapshotId,
    id: newSnapshotId,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    version: nextVersion,
    currency: preview.bookingCurrency,
    supplierNettCost: baseline.supplierNettCost, // STRICT INVARIANT: Never changed
    originalBaseSellingPrice: baseline.originalBaseSellingPrice,
    originalCustomerSellingPrice: baseline.originalCustomerSellingPrice,
    originalTheUnboundMargin: baseline.originalTheUnboundMargin,
    b2bPromotionDiscountAmount: baseline.b2bPromotionDiscountAmount,
    b2bPromotionCode: baseline.b2bPromotionCode,
    b2bPromotionId: baseline.b2bPromotionId,
    agentAdditionalMarkupAmount: baseline.agentAdditionalMarkupAmount,
    cumulativeAdminManualDiscount: preview.cumulativeAdminManualDiscountAfter,
    remainingTheUnboundMargin: preview.remainingTheUnboundMarginAfter,
    revisedBaseSellingPrice: preview.revisedBaseSellingPrice,
    revisedCustomerSellingPrice: preview.revisedCustomerSellingPrice,
    isLossMaking: preview.remainingTheUnboundMarginAfter < 0,
    sourceAction: 'ADMIN_MANUAL_DISCOUNT_APPLIED',
    sourceAdjustmentId: adjustmentId,
    createdBy: actor.id,
    createdByName: actor.name,
    createdByRole: actor.role,
    createdAt: nowIso,
    immutable: true
  };

  const adjustment: BookingManualDiscountAdjustment = {
    adjustmentId,
    id: adjustmentId,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    idempotencyKey: payload.idempotencyKey,
    actionType: 'APPLY',
    discountSource: payload.discountSource,
    fundingSource: 'THEUNBOUND_MARGIN',
    couponId: preview.couponId,
    couponCode: preview.couponCode || (payload.couponCode ? normalizePromotionCode(payload.couponCode) : undefined),
    couponTitle: preview.couponTitle,
    discountType: preview.discountType,
    discountValue: preview.discountValue,
    discountCurrency: preview.discountCurrency,
    bookingCurrency: preview.bookingCurrency,
    fxRateApplied: preview.fxRateApplied,
    discountAmountInBookingCurrency: preview.requestedDiscountAmount,
    signedDeltaAmount: -preview.requestedDiscountAmount,
    status: 'ACTIVE',
    reason,
    internalNotes: payload.internalNotes?.trim() || undefined,
    requiresApproval: preview.requiresApproval,
    approvedBy: preview.requiresApproval
      ? (payload.approvedBy || (permissions.canApproveManualDiscount ? actor.id : undefined))
      : undefined,
    approvedByName: preview.requiresApproval
      ? (payload.approvedByName || (permissions.canApproveManualDiscount ? actor.name : undefined))
      : undefined,
    approvedAt: preview.requiresApproval ? nowIso : undefined,
    approvalReference: payload.approvalReference?.trim() || undefined,
    marginOverrideUsed: preview.isLossMakingOverride,
    marginOverrideReason: preview.isLossMakingOverride ? payload.marginOverrideReason?.trim() : undefined,
    marginOverrideApprovedBy: preview.isLossMakingOverride ? actor.id : undefined,
    marginOverrideApprovedByName: preview.isLossMakingOverride ? actor.name : undefined,
    previousSnapshotId: latest.snapshotId,
    previousSnapshotVersion: latest.version,
    resultingSnapshotId: newSnapshot.snapshotId,
    resultingSnapshotVersion: newSnapshot.version,
    supplierNettCostSnapshot: baseline.supplierNettCost,
    marginBefore: latest.remainingTheUnboundMargin,
    marginAfter: newSnapshot.remainingTheUnboundMargin,
    sellingPriceBefore: latest.revisedCustomerSellingPrice,
    sellingPriceAfter: newSnapshot.revisedCustomerSellingPrice,
    appliedBy: actor.id,
    appliedByName: actor.name,
    appliedByEmail: actor.email,
    appliedByRole: actor.role,
    appliedAt: nowIso,
    agencyId: booking.agencyId,
    agencyName: booking.agencyName || booking.agentAgency || booking.customer?.agencyName,
    agentId: booking.submittingAgentId || booking.assignedAgentId || booking.agentId,
    agentName: booking.submittingAgentNameSnapshot || booking.agentName,
    accountManagerId: booking.assignedTeamMemberId,
    accountManagerName: booking.operationalOwnerName || booking.assignedTeamMemberName,
    immutable: true
  };

  const nextSnapshots = [...existingSnapshots, newSnapshot];
  const nextAdjustments = [...existingAdjustments, adjustment];

  const updatedBooking = projectSnapshotOntoBooking(
    booking,
    newSnapshot,
    nextSnapshots,
    nextAdjustments,
    preview.hasExistingInvoices,
    nowIso
  );

  return {
    ok: true,
    initialSnapshotToPersist: needsInitialPersist ? baseline : undefined,
    adjustment,
    newSnapshot,
    updatedBooking,
    preview
  };
}

/**
 * Produces an immutable REVERSAL adjustment record and a new versioned pricing snapshot
 * without deleting or modifying any historical snapshots, adjustments, or issued invoices.
 */
export function buildReverseManualDiscountCommit(params: {
  booking: Booking;
  adjustmentId: string;
  reason: string;
  idempotencyKey?: string;
  actor: {
    id: string;
    name: string;
    email?: string;
    role: string;
  };
  permissions: BookingManualDiscountPermissions;
  externalSnapshots?: BookingPricingSnapshot[];
  externalAdjustments?: BookingManualDiscountAdjustment[];
  existingInvoicesCount?: number;
  now?: Date;
}):
  | {
      ok: true;
      reversalAdjustment: BookingManualDiscountAdjustment;
      newSnapshot: BookingPricingSnapshot;
      updatedBooking: Booking;
    }
  | {
      ok: false;
      error: string;
    } {
  const {
    booking,
    adjustmentId,
    reason,
    idempotencyKey,
    actor,
    permissions,
    externalSnapshots,
    externalAdjustments,
    existingInvoicesCount,
    now = new Date()
  } = params;

  if (!permissions.canReverseManualDiscount) {
    return {
      ok: false,
      error: 'Forbidden: you do not have permission to reverse manual booking discounts.'
    };
  }

  const eligibilityCheck = isBookingEligibleForManualDiscount(booking);
  if (!eligibilityCheck.eligible) {
    return {
      ok: false,
      error: eligibilityCheck.reason || 'Booking status does not allow manual discount reversals.'
    };
  }

  const cleanReason = (reason || '').trim();
  if (cleanReason.length < 3) {
    return {
      ok: false,
      error: 'A mandatory reversal reason (at least 3 characters) is required.'
    };
  }

  const existingSnapshots =
    externalSnapshots && externalSnapshots.length > 0
      ? [...externalSnapshots]
      : [...(booking.pricingSnapshotHistory || [])];
  const existingAdjustments =
    externalAdjustments && externalAdjustments.length > 0
      ? [...externalAdjustments]
      : [...(booking.manualDiscountAdjustments || [])];

  const target = existingAdjustments.find(
    a => (a.adjustmentId === adjustmentId || a.id === adjustmentId) && a.actionType === 'APPLY'
  );
  if (!target) {
    return {
      ok: false,
      error: `Manual discount adjustment "${adjustmentId}" was not found on this booking.`
    };
  }

  const reversedIds = getReversedAdjustmentIdSet(existingAdjustments);
  if (reversedIds.has(target.adjustmentId)) {
    return {
      ok: false,
      error: `Manual discount adjustment "${adjustmentId}" has already been reversed.`
    };
  }

  const baseline = buildInitialBookingPricingSnapshot(booking, existingSnapshots);
  const latest = getLatestBookingPricingSnapshot(booking, existingSnapshots);
  const nextVersion = latest.version + 1;
  const nowIso = now.toISOString();
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  const reversalId = `bmd-rev-${booking.id}-v${nextVersion}-${Date.now()}-${randomSuffix}`;
  const newSnapshotId = `bps-${booking.id}-v${nextVersion}`;

  // Recalculate cumulative active admin discounts from scratch using remaining active APPLY records
  const remainingActiveApplies = existingAdjustments.filter(
    a =>
      a.actionType === 'APPLY' &&
      a.adjustmentId !== target.adjustmentId &&
      !reversedIds.has(a.adjustmentId)
  );
  const newCumulativeAdminDiscount = roundMoney(
    remainingActiveApplies.reduce((sum, a) => sum + (a.discountAmountInBookingCurrency || 0), 0)
  );

  const newRemainingMargin = roundMoney(
    baseline.originalTheUnboundMargin - baseline.b2bPromotionDiscountAmount - newCumulativeAdminDiscount
  );
  const newRevisedBaseSellingPrice = roundMoney(
    Math.max(0, baseline.originalBaseSellingPrice - baseline.b2bPromotionDiscountAmount - newCumulativeAdminDiscount)
  );
  const newRevisedCustomerSellingPrice = roundMoney(
    Math.max(0, baseline.originalCustomerSellingPrice - newCumulativeAdminDiscount)
  );

  const newSnapshot: BookingPricingSnapshot = {
    snapshotId: newSnapshotId,
    id: newSnapshotId,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    version: nextVersion,
    currency: baseline.currency,
    supplierNettCost: baseline.supplierNettCost, // STRICT INVARIANT: Never changed
    originalBaseSellingPrice: baseline.originalBaseSellingPrice,
    originalCustomerSellingPrice: baseline.originalCustomerSellingPrice,
    originalTheUnboundMargin: baseline.originalTheUnboundMargin,
    b2bPromotionDiscountAmount: baseline.b2bPromotionDiscountAmount,
    b2bPromotionCode: baseline.b2bPromotionCode,
    b2bPromotionId: baseline.b2bPromotionId,
    agentAdditionalMarkupAmount: baseline.agentAdditionalMarkupAmount,
    cumulativeAdminManualDiscount: newCumulativeAdminDiscount,
    remainingTheUnboundMargin: newRemainingMargin,
    revisedBaseSellingPrice: newRevisedBaseSellingPrice,
    revisedCustomerSellingPrice: newRevisedCustomerSellingPrice,
    isLossMaking: newRemainingMargin < 0,
    sourceAction: 'ADMIN_MANUAL_DISCOUNT_REVERSED',
    sourceAdjustmentId: reversalId,
    createdBy: actor.id,
    createdByName: actor.name,
    createdByRole: actor.role,
    createdAt: nowIso,
    immutable: true
  };

  const reversalAdjustment: BookingManualDiscountAdjustment = {
    adjustmentId: reversalId,
    id: reversalId,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    idempotencyKey,
    actionType: 'REVERSE',
    discountSource: target.discountSource,
    fundingSource: 'THEUNBOUND_MARGIN',
    couponId: target.couponId,
    couponCode: target.couponCode,
    couponTitle: target.couponTitle,
    discountType: target.discountType,
    discountValue: target.discountValue,
    discountCurrency: target.discountCurrency,
    bookingCurrency: target.bookingCurrency,
    fxRateApplied: target.fxRateApplied,
    discountAmountInBookingCurrency: target.discountAmountInBookingCurrency,
    signedDeltaAmount: target.discountAmountInBookingCurrency, // Positive restoration
    status: 'REVERSED',
    reason: cleanReason,
    requiresApproval: false,
    marginOverrideUsed: false,
    previousSnapshotId: latest.snapshotId,
    previousSnapshotVersion: latest.version,
    resultingSnapshotId: newSnapshot.snapshotId,
    resultingSnapshotVersion: newSnapshot.version,
    supplierNettCostSnapshot: baseline.supplierNettCost,
    marginBefore: latest.remainingTheUnboundMargin,
    marginAfter: newSnapshot.remainingTheUnboundMargin,
    sellingPriceBefore: latest.revisedCustomerSellingPrice,
    sellingPriceAfter: newSnapshot.revisedCustomerSellingPrice,
    reversedAdjustmentId: target.adjustmentId,
    reversedAt: nowIso,
    reversedBy: actor.id,
    reversedByName: actor.name,
    reversalReason: cleanReason,
    appliedBy: actor.id,
    appliedByName: actor.name,
    appliedByEmail: actor.email,
    appliedByRole: actor.role,
    appliedAt: nowIso,
    agencyId: booking.agencyId,
    agencyName: booking.agencyName || booking.agentAgency || booking.customer?.agencyName,
    agentId: booking.submittingAgentId || booking.assignedAgentId || booking.agentId,
    agentName: booking.submittingAgentNameSnapshot || booking.agentName,
    accountManagerId: booking.assignedTeamMemberId,
    accountManagerName: booking.operationalOwnerName || booking.assignedTeamMemberName,
    immutable: true
  };

  const nextSnapshots = [...existingSnapshots, newSnapshot];
  // Append-only ledger: keep original APPLY record intact, append REVERSE record
  const nextAdjustments = [...existingAdjustments, reversalAdjustment];

  const hasExistingInvoices =
    typeof existingInvoicesCount === 'number'
      ? existingInvoicesCount > 0
      : Boolean((booking.proformaInvoiceIds && booking.proformaInvoiceIds.length > 0) || booking.activeProformaInvoiceId);

  const updatedBooking = projectSnapshotOntoBooking(
    booking,
    newSnapshot,
    nextSnapshots,
    nextAdjustments,
    hasExistingInvoices,
    nowIso
  );

  return {
    ok: true,
    reversalAdjustment,
    newSnapshot,
    updatedBooking
  };
}

/**
 * Projects the latest committed immutable BookingPricingSnapshot onto the Booking document
 * so all modules (BookingsManager, B2B Portal, Proforma Invoices, Profitability Reports)
 * stay 100% synchronized with the single source of truth.
 */
export function projectSnapshotOntoBooking(
  booking: Booking,
  latestSnapshot: BookingPricingSnapshot,
  snapshotHistory: BookingPricingSnapshot[],
  adjustments: BookingManualDiscountAdjustment[],
  hasExistingInvoices: boolean,
  updatedAtIso: string
): Booking {
  const grossMarginPercent =
    latestSnapshot.revisedCustomerSellingPrice > 0
      ? roundMoney(
          (latestSnapshot.remainingTheUnboundMargin / latestSnapshot.revisedCustomerSellingPrice) * 100
        )
      : 0;

  return {
    ...booking,
    // Revised Customer-Facing Selling Price (Synchronized everywhere)
    totalAmount: latestSnapshot.revisedCustomerSellingPrice,
    finalCustomerSellingPrice: latestSnapshot.revisedCustomerSellingPrice,
    final_customer_selling_price: latestSnapshot.revisedCustomerSellingPrice,
    baseFinalSellingPrice: latestSnapshot.revisedBaseSellingPrice,
    base_final_selling_price: latestSnapshot.revisedBaseSellingPrice,
    // Supplier Nett Cost STRICTLY PRESERVED
    totalNetCost: latestSnapshot.supplierNettCost,
    internalNettCost: latestSnapshot.supplierNettCost,
    supplierCost: latestSnapshot.supplierNettCost,
    supplierTotalCost: latestSnapshot.supplierNettCost,
    // Internal Margin Fields (Stripped for B2B agents by sanitizeBookingForAgent)
    originalTheUnboundMargin: latestSnapshot.originalTheUnboundMargin,
    remainingTheUnboundMargin: latestSnapshot.remainingTheUnboundMargin,
    grossProfit: latestSnapshot.remainingTheUnboundMargin,
    internalProfit: latestSnapshot.remainingTheUnboundMargin,
    grossMarginPercent,
    // Distinct Discount Tracking (Never conflated)
    b2bPromotionDiscountAmount: latestSnapshot.b2bPromotionDiscountAmount,
    adminManualDiscountTotal: latestSnapshot.cumulativeAdminManualDiscount,
    // Immutable Snapshot & Adjustment History References
    currentPricingSnapshotId: latestSnapshot.snapshotId,
    currentPricingSnapshotVersion: latestSnapshot.version,
    pricingSnapshotHistory: snapshotHistory,
    manualDiscountAdjustments: adjustments,
    // Invoice revision tracking (historical issued invoices are NEVER overwritten)
    hasRevisedPricingAfterInvoice: hasExistingInvoices || booking.hasRevisedPricingAfterInvoice,
    revisedPricingNotice: hasExistingInvoices
      ? `Booking pricing revised to v${latestSnapshot.version} (${latestSnapshot.currency} ${latestSnapshot.revisedCustomerSellingPrice.toLocaleString()}) after invoice issuance. Historical invoices remain immutable; generate a revised proforma invoice if needed.`
      : booking.revisedPricingNotice,
    revisedPricingVersion: latestSnapshot.version,
    updatedAt: updatedAtIso
  };
}

/**
 * Builds the Admin Manual Discount Reporting Summary across bookings and append-only adjustments.
 */
export function buildBookingManualDiscountReport(params: {
  bookings: Booking[];
  adjustments?: BookingManualDiscountAdjustment[];
  agencyId?: string;
  couponCode?: string;
  adminUserId?: string;
  fromDate?: string;
  toDate?: string;
}): BookingManualDiscountReportSummary {
  const { bookings, adjustments: externalAdjustments, agencyId, couponCode, adminUserId, fromDate, toDate } = params;

  const normalizedFilterCode = couponCode ? normalizePromotionCode(couponCode) : '';
  const fromMs = fromDate ? new Date(fromDate).getTime() : null;
  const toMs = toDate ? new Date(`${toDate}T23:59:59.999Z`).getTime() : null;

  const adjustmentsByBooking = new Map<string, BookingManualDiscountAdjustment[]>();
  const sourceAdjustments: BookingManualDiscountAdjustment[] = externalAdjustments
    ? [...externalAdjustments]
    : bookings.flatMap(b => b.manualDiscountAdjustments || []);

  for (const adj of sourceAdjustments) {
    if (agencyId && adj.agencyId !== agencyId && adj.agencyName !== agencyId) continue;
    if (normalizedFilterCode && normalizePromotionCode(adj.couponCode || '') !== normalizedFilterCode) continue;
    if (adminUserId && adj.appliedBy !== adminUserId) continue;
    const ts = new Date(adj.appliedAt).getTime();
    if (fromMs !== null && Number.isFinite(ts) && ts < fromMs) continue;
    if (toMs !== null && Number.isFinite(ts) && ts > toMs) continue;

    const list = adjustmentsByBooking.get(adj.bookingId) || [];
    list.push(adj);
    adjustmentsByBooking.set(adj.bookingId, list);
  }

  const bookingMap = new Map<string, Booking>();
  for (const b of bookings) {
    bookingMap.set(b.id, b);
  }

  const rows: BookingManualDiscountReportRow[] = [];
  const totalAdminManualDiscountByCurrency: Record<string, number> = {};
  const totalRemainingMarginByCurrency: Record<string, number> = {};
  const couponMap = new Map<
    string,
    {
      couponCode: string;
      couponTitle?: string;
      applicationsCount: number;
      reversalsCount: number;
      totalDiscountAmount: number;
      currency: CurrencyCode;
    }
  >();

  let totalActiveAdjustments = 0;
  let totalReversedAdjustments = 0;
  let totalLossOverrideCount = 0;

  for (const [bookingId, adjList] of adjustmentsByBooking.entries()) {
    const booking = bookingMap.get(bookingId);
    const reversedSet = getReversedAdjustmentIdSet(adjList);
    const activeApplies = adjList.filter(a => a.actionType === 'APPLY' && !reversedSet.has(a.adjustmentId));
    const reversals = adjList.filter(a => a.actionType === 'REVERSE');

    totalActiveAdjustments += activeApplies.length;
    totalReversedAdjustments += reversals.length;
    const hasLossOverride = activeApplies.some(a => a.marginOverrideUsed);
    if (hasLossOverride) totalLossOverrideCount += 1;

    for (const adj of adjList) {
      if (adj.couponCode) {
        const key = `${adj.couponCode}::${adj.bookingCurrency}`;
        const existing = couponMap.get(key) || {
          couponCode: adj.couponCode,
          couponTitle: adj.couponTitle,
          applicationsCount: 0,
          reversalsCount: 0,
          totalDiscountAmount: 0,
          currency: adj.bookingCurrency
        };
        if (adj.actionType === 'APPLY') {
          existing.applicationsCount += 1;
          if (!reversedSet.has(adj.adjustmentId)) {
            existing.totalDiscountAmount = roundMoney(
              existing.totalDiscountAmount + adj.discountAmountInBookingCurrency
            );
          }
        } else {
          existing.reversalsCount += 1;
        }
        couponMap.set(key, existing);
      }
    }

    const latestSnap = booking ? getLatestBookingPricingSnapshot(booking) : null;
    const lastAdj = [...adjList].sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    )[0];

    const currency: CurrencyCode = latestSnap?.currency || lastAdj?.bookingCurrency || 'USD';
    const adminManualDiscountTotal = latestSnap
      ? latestSnap.cumulativeAdminManualDiscount
      : roundMoney(activeApplies.reduce((s, a) => s + a.discountAmountInBookingCurrency, 0));
    const remainingTheUnboundMargin = latestSnap
      ? latestSnap.remainingTheUnboundMargin
      : (lastAdj?.marginAfter ?? 0);

    totalAdminManualDiscountByCurrency[currency] = roundMoney(
      (totalAdminManualDiscountByCurrency[currency] || 0) + adminManualDiscountTotal
    );
    totalRemainingMarginByCurrency[currency] = roundMoney(
      (totalRemainingMarginByCurrency[currency] || 0) + remainingTheUnboundMargin
    );

    rows.push({
      bookingId,
      bookingReference: booking?.bookingReference || lastAdj?.bookingReference || bookingId,
      customerName: booking?.customer?.leadTravelerName || booking?.customer?.bookerName || 'Guest',
      agencyId: booking?.agencyId || lastAdj?.agencyId,
      agencyName: booking?.agencyName || booking?.agentAgency || booking?.customer?.agencyName || lastAdj?.agencyName,
      agentId: booking?.submittingAgentId || booking?.agentId || lastAdj?.agentId,
      agentName: booking?.submittingAgentNameSnapshot || booking?.agentName || lastAdj?.agentName,
      accountManagerName: booking?.operationalOwnerName || booking?.assignedTeamMemberName || lastAdj?.accountManagerName,
      currency,
      supplierNettCost: latestSnap?.supplierNettCost ?? lastAdj?.supplierNettCostSnapshot ?? 0,
      originalCustomerSellingPrice: latestSnap?.originalCustomerSellingPrice ?? lastAdj?.sellingPriceBefore ?? 0,
      b2bPromotionDiscountAmount: latestSnap?.b2bPromotionDiscountAmount ?? 0,
      adminManualDiscountTotal,
      revisedCustomerSellingPrice: latestSnap?.revisedCustomerSellingPrice ?? lastAdj?.sellingPriceAfter ?? 0,
      originalTheUnboundMargin: latestSnap?.originalTheUnboundMargin ?? 0,
      remainingTheUnboundMargin,
      activeAdjustmentsCount: activeApplies.length,
      reversedAdjustmentsCount: reversals.length,
      hasLossOverride,
      lastAdjustedAt: lastAdj?.appliedAt,
      lastAdjustedByName: lastAdj?.appliedByName
    });
  }

  rows.sort((a, b) =>
    new Date(b.lastAdjustedAt || 0).getTime() - new Date(a.lastAdjustedAt || 0).getTime()
  );

  return {
    totalBookingsWithManualDiscounts: rows.length,
    totalActiveAdjustments,
    totalReversedAdjustments,
    totalLossOverrideCount,
    totalAdminManualDiscountByCurrency,
    totalRemainingMarginByCurrency,
    byCouponCode: Array.from(couponMap.values()).sort(
      (a, b) => b.totalDiscountAmount - a.totalDiscountAmount
    ),
    rows
  };
}
