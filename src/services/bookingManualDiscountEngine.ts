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
  BookingTimelineEvent,
  CurrencyCode,
  PaymentInstallmentItem,
  PaymentSchedule,
  PaymentScheduleAuditEntry,
  PaymentScheduleStatus,
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
    canViewDiscountReports: false,
    canManagePaymentSchedule: false
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
      canViewDiscountReports: true,
      canManagePaymentSchedule: true
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
      canViewDiscountReports: true,
      canManagePaymentSchedule: true
    };
  }

  if (role === 'ADMIN') {
    const adminFinancialRevoked =
      perms.canAccessFinancials === false || finance.enabled === false;

    if (adminFinancialRevoked) {
      return {
        canViewInternalMargin: ops.view_internal_margin === true,
        canApplyManualDiscount: ops.apply_manual_discount === true,
        canApplyAdminCoupon: ops.apply_admin_coupon === true,
        canApproveManualDiscount: ops.approve_manual_discount === true,
        canOverrideMarginProtection: ops.override_margin_protection === true,
        canReverseManualDiscount: ops.reverse_manual_discount === true,
        canViewDiscountReports: ops.view_discount_reports === true,
        canManagePaymentSchedule: ops.manage_payment_schedule === true || ops.apply_manual_discount === true
      };
    }

    return {
      canViewInternalMargin: ops.view_internal_margin !== false,
      canApplyManualDiscount: ops.apply_manual_discount !== false,
      canApplyAdminCoupon: ops.apply_admin_coupon !== false,
      canApproveManualDiscount: ops.approve_manual_discount !== false,
      canOverrideMarginProtection: ops.override_margin_protection === true || ops.override_margin_protection === undefined,
      canReverseManualDiscount: ops.reverse_manual_discount !== false,
      canViewDiscountReports: ops.view_discount_reports !== false,
      canManagePaymentSchedule: ops.manage_payment_schedule !== false
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
    const canManageSchedule = Boolean(
      ops.manage_payment_schedule === true ||
      ops.apply_manual_discount === true ||
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
      canViewDiscountReports: canViewReports,
      canManagePaymentSchedule: canManageSchedule
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
      booking.current_selling_price ??
      booking.finalCustomerSellingPrice ??
      booking.final_customer_selling_price ??
      booking.totalAmount ??
      0
    )
  );

  // If legacy booking already had adminManualDiscountTotal without snapshot history, restore original before admin manual discounts
  const existingManualTotal = roundMoney(Math.max(0, booking.adminManualDiscountTotal || 0));
  const explicitOriginalSelling =
    typeof booking.original_selling_price === 'number' && booking.original_selling_price > 0
      ? roundMoney(booking.original_selling_price)
      : typeof booking.originalBookingAmount === 'number' && booking.originalBookingAmount > 0 && existingManualTotal > 0
        ? roundMoney(booking.originalBookingAmount)
        : null;
  const originalCustomerSellingPrice =
    explicitOriginalSelling !== null
      ? explicitOriginalSelling
      : roundMoney(currentCustomerSelling + existingManualTotal);

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

  const impliedManualDiscount = roundMoney(
    Math.max(existingManualTotal, Math.max(0, originalCustomerSellingPrice - currentCustomerSelling))
  );
  const effectiveRevisedCustomerSelling =
    currentCustomerSelling > 0 && currentCustomerSelling < originalCustomerSellingPrice
      ? currentCustomerSelling
      : originalCustomerSellingPrice;
  const remainingAfterDiscounts = roundMoney(
    originalTheUnboundMargin - b2bPromoDiscount - impliedManualDiscount
  );
  const discountedBaseSellingPrice = roundMoney(
    Math.max(0, originalBaseSellingPrice - b2bPromoDiscount - impliedManualDiscount)
  );

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
    original_selling_price: originalCustomerSellingPrice,
    current_selling_price: effectiveRevisedCustomerSelling,
    originalTheUnboundMargin,
    b2bPromotionDiscountAmount: b2bPromoDiscount,
    b2bPromotionCode: booking.appliedPromotion?.code || booking.appliedPromotion?.normalizedCode,
    b2bPromotionId: booking.appliedPromotion?.promotionId,
    agentAdditionalMarkupAmount: agentAdditionalMarkup,
    cumulativeAdminManualDiscount: impliedManualDiscount,
    remainingTheUnboundMargin: remainingAfterDiscounts,
    revisedBaseSellingPrice: discountedBaseSellingPrice,
    revisedCustomerSellingPrice: effectiveRevisedCustomerSelling,
    isLossMaking: remainingAfterDiscounts < 0,
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

  const eligibleDiscountBase = roundMoney(Math.max(0, latest.revisedBaseSellingPrice));
  const currentFinancials = resolveAuthoritativeBookingFinancials(booking, externalSnapshots);
  const amountAlreadyPaid = currentFinancials.verifiedPaidAmount;
  const revisedOutstandingBalance = roundMoney(Math.max(0, revisedCustomerSellingPrice - amountAlreadyPaid));
  const revisedCreditBalance = roundMoney(Math.max(0, amountAlreadyPaid - revisedCustomerSellingPrice));
  const isOverpaidAfterDiscount = revisedCreditBalance > 0;

  if (isOverpaidAfterDiscount) {
    validationWarnings.push(
      `Payments already received (${bookingCurrency} ${amountAlreadyPaid.toLocaleString()}) exceed the revised booking amount (${bookingCurrency} ${revisedCustomerSellingPrice.toLocaleString()}), resulting in a credit/overpayment position of ${bookingCurrency} ${revisedCreditBalance.toLocaleString()}. Historical payments will remain unchanged and no automatic cash refund will be issued.`
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
    latestSnapshotId: latest.snapshotId,
    eligibleDiscountBase,
    amountAlreadyPaid,
    revisedOutstandingBalance,
    revisedCreditBalance,
    isOverpaidAfterDiscount
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

  const resolvedApprovedBy = preview.requiresApproval
    ? (payload.approvedBy || (permissions.canApproveManualDiscount ? actor.id : undefined))
    : undefined;
  const resolvedApprovedByName = preview.requiresApproval
    ? (payload.approvedByName || (permissions.canApproveManualDiscount ? actor.name : undefined))
    : undefined;
  const resolvedApprovedAt = preview.requiresApproval ? nowIso : undefined;
  const resolvedApprovalRef = payload.approvalReference?.trim() || undefined;
  const resolvedInternalRef = payload.internalReference?.trim() || undefined;
  const resolvedEligibleBase = preview.eligibleDiscountBase ?? roundMoney(Math.max(0, latest.revisedBaseSellingPrice));

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
    original_selling_price: baseline.originalCustomerSellingPrice,
    current_selling_price: preview.revisedCustomerSellingPrice,
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
    previousSnapshotId: latest.snapshotId,
    previousSnapshotVersion: latest.version,
    discountType: preview.discountType,
    discountValue: preview.discountValue,
    discountAmount: preview.requestedDiscountAmount,
    discountReason: reason,
    internalReference: resolvedInternalRef,
    eligibleDiscountBase: resolvedEligibleBase,
    supplierCostProtectionValidated: !preview.marginProtectionBlocked && baseline.supplierNettCost === latest.supplierNettCost,
    approvalReference: resolvedApprovalRef,
    approvedBy: resolvedApprovedBy,
    approvedByName: resolvedApprovedByName,
    approvedAt: resolvedApprovedAt,
    createdBy: actor.id,
    createdByName: actor.name,
    createdByRole: actor.role,
    createdAt: nowIso,
    immutable: true
  };

  // Recalculate payment schedule before & after so every tranche & instalment reflects current_selling_price
  const verifiedPaidBefore = resolveVerifiedPaidAmount(booking);
  const previousPaymentSchedule = recalculateBookingPaymentSchedule(
    booking,
    latest.revisedCustomerSellingPrice,
    verifiedPaidBefore,
    preview.bookingCurrency,
    latest.createdAt || nowIso
  );
  const revisedPaymentSchedule = recalculateBookingPaymentSchedule(
    { ...booking, paymentSchedule: previousPaymentSchedule },
    newSnapshot.revisedCustomerSellingPrice,
    verifiedPaidBefore,
    preview.bookingCurrency,
    nowIso
  );

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
    internalReference: resolvedInternalRef,
    eligibleDiscountBase: resolvedEligibleBase,
    requiresApproval: preview.requiresApproval,
    approvedBy: resolvedApprovedBy,
    approvedByName: resolvedApprovedByName,
    approvedAt: resolvedApprovedAt,
    approvalReference: resolvedApprovalRef,
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
    originalBookingAmount: baseline.originalCustomerSellingPrice,
    previousPaymentSchedule,
    revisedPaymentSchedule,
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
    nowIso,
    adjustment
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
    original_selling_price: baseline.originalCustomerSellingPrice,
    current_selling_price: newRevisedCustomerSellingPrice,
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
    previousSnapshotId: latest.snapshotId,
    previousSnapshotVersion: latest.version,
    discountType: target.discountType,
    discountValue: target.discountValue,
    discountAmount: -target.discountAmountInBookingCurrency,
    discountReason: cleanReason,
    eligibleDiscountBase: roundMoney(Math.max(0, latest.revisedBaseSellingPrice)),
    supplierCostProtectionValidated: baseline.supplierNettCost === latest.supplierNettCost,
    createdBy: actor.id,
    createdByName: actor.name,
    createdByRole: actor.role,
    createdAt: nowIso,
    immutable: true
  };

  const verifiedPaidBefore = resolveVerifiedPaidAmount(booking);
  const previousPaymentSchedule = recalculateBookingPaymentSchedule(
    booking,
    latest.revisedCustomerSellingPrice,
    verifiedPaidBefore,
    baseline.currency,
    latest.createdAt || nowIso
  );
  const revisedPaymentSchedule = recalculateBookingPaymentSchedule(
    { ...booking, paymentSchedule: previousPaymentSchedule },
    newSnapshot.revisedCustomerSellingPrice,
    verifiedPaidBefore,
    baseline.currency,
    nowIso
  );

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
    originalBookingAmount: baseline.originalCustomerSellingPrice,
    previousPaymentSchedule,
    revisedPaymentSchedule,
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
    nowIso,
    reversalAdjustment
  );

  return {
    ok: true,
    reversalAdjustment,
    newSnapshot,
    updatedBooking
  };
}

function resolveVerifiedPaidAmount(booking: Booking): number {
  const proofs = booking.paymentProofs || [];
  if (proofs.length > 0) {
    return roundMoney(
      proofs
        .filter(p => p.verificationStatus === 'VERIFIED')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    );
  }
  return roundMoney(Math.max(0, Number(booking.amountPaid ?? (booking as any).paidAmount ?? 0)));
}

/**
 * Distributes an amount across weighted tranches using integer-cent largest-remainder
 * allocation so the sum of rounded tranche amounts matches targetTotal to the exact cent.
 */
function distributeAmountCentExact(targetTotal: number, weights: number[]): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const totalCents = Math.max(0, Math.round(roundMoney(targetTotal) * 100));
  if (totalCents === 0) return new Array(count).fill(0);

  const normalizedWeights = weights.map(w => (Number.isFinite(w) && w > 0 ? w : 0));
  const weightSum = normalizedWeights.reduce((acc, w) => acc + w, 0);
  const effectiveWeights = weightSum > 0 ? normalizedWeights : new Array(count).fill(1);
  const effectiveSum = effectiveWeights.reduce((acc, w) => acc + w, 0);

  const exactCents = effectiveWeights.map(w => (totalCents * w) / effectiveSum);
  const floorCents = exactCents.map(v => Math.floor(v));
  let remainder = totalCents - floorCents.reduce((acc, c) => acc + c, 0);

  const ranked = exactCents
    .map((v, idx) => ({ idx, frac: v - floorCents[idx] }))
    .sort((a, b) => (b.frac !== a.frac ? b.frac - a.frac : a.idx - b.idx));

  for (let i = 0; i < remainder && i < ranked.length; i++) {
    floorCents[ranked[i].idx] += 1;
  }

  return floorCents.map(c => roundMoney(c / 100));
}

export interface PaymentScheduleTrancheInput {
  id?: string;
  title: string;
  milestone?: string;
  description?: string;
  paymentTerms?: string;
  calculationMode?: 'PERCENTAGE' | 'FIXED';
  dueDate: string;
  amount?: number;
  percentage?: number;
  notes?: string;
}

export interface PaymentScheduleTrancheDiff {
  id: string;
  installmentNumber: number;
  title: string;
  milestone?: string;
  dueDate: string;
  status: PaymentInstallmentItem['status'];
  calculationMode: 'PERCENTAGE' | 'FIXED';
  isLockedPaid: boolean;
  paidAmount: number;
  previousAmount: number;
  previousPercentage: number;
  recalculatedAmount: number;
  recalculatedPercentage: number;
  deltaAmount: number;
}

export interface PaymentScheduleRecalculationPreview {
  bookingId: string;
  bookingReference: string;
  currency: CurrencyCode;
  financialSnapshotId: string;
  financialSnapshotVersion: number;
  originalBookingAmount: number;
  totalDiscountAmount: number;
  revisedBookingAmount: number;
  previousScheduleId?: string;
  previousScheduleVersion: number;
  previousBookingAmount: number;
  previousTotalScheduled: number;
  nextScheduleVersion: number;
  verifiedPaidAmount: number;
  outstandingBalance: number;
  creditBalance: number;
  isOverpaid: boolean;
  trancheDiffs: PaymentScheduleTrancheDiff[];
  recalculatedInstallments: PaymentInstallmentItem[];
  recalculatedTotalScheduled: number;
  unallocatedBalance: number;
  warnings: string[];
}

function isCommittedCustomPaymentSchedule(schedule: PaymentSchedule | undefined | null): boolean {
  return Boolean(
    schedule &&
    Array.isArray(schedule.installments) &&
    schedule.installments.length > 0 &&
    (schedule.isManualCustomSchedule === true || Boolean(schedule.scheduleId))
  );
}

/**
 * Distributes targetTotal across percentage weights with cent-exact accuracy,
 * assigning any rounding remainder strictly to the final open tranche.
 */
function distributeWithFinalOpenTrancheRounding(
  targetTotal: number,
  weights: number[],
  exactPercentages?: Array<number | undefined>
): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const safeTarget = roundMoney(Math.max(0, targetTotal));
  if (safeTarget <= 0) return new Array(count).fill(0);

  // If explicit percentages summing to ~100% are provided, calculate first N-1 directly
  // and let the final open tranche absorb the exact rounding difference.
  if (
    exactPercentages &&
    exactPercentages.length === count &&
    exactPercentages.every(p => typeof p === 'number' && Number.isFinite(p) && p >= 0)
  ) {
    const pctSum = roundMoney(exactPercentages.reduce((acc, p) => acc + (p || 0), 0));
    if (Math.abs(pctSum - 100) <= 0.02) {
      const amounts: number[] = [];
      let running = 0;
      for (let i = 0; i < count; i++) {
        if (i === count - 1) {
          amounts.push(roundMoney(Math.max(0, safeTarget - running)));
        } else {
          const val = roundMoney((safeTarget * (exactPercentages[i] || 0)) / 100);
          amounts.push(val);
          running = roundMoney(running + val);
        }
      }
      return amounts;
    }
  }

  // Proportional distribution with final open tranche absorbing any 1-cent remainder
  const cleanWeights = weights.map(w => (Number.isFinite(w) && w > 0 ? w : 0));
  const weightSum = cleanWeights.reduce((acc, w) => acc + w, 0);
  const effectiveWeights = weightSum > 0 ? cleanWeights : new Array(count).fill(1);
  const effectiveSum = effectiveWeights.reduce((acc, w) => acc + w, 0);

  const amounts: number[] = [];
  let running = 0;
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      amounts.push(roundMoney(Math.max(0, safeTarget - running)));
    } else {
      const val = roundMoney((safeTarget * effectiveWeights[i]) / effectiveSum);
      amounts.push(val);
      running = roundMoney(running + val);
    }
  }
  return amounts;
}

/**
 * Flags an existing Admin-committed custom Payment Schedule for recalculation
 * WITHOUT silently altering any saved tranche amounts, percentages, or payment allocations.
 */
function buildFlaggedPreservedSchedule(params: {
  booking: Booking;
  existingSchedule: PaymentSchedule;
  latestSnapshot: BookingPricingSnapshot;
  verifiedPaidAmount: number;
  nowIso: string;
  appendAuditEntry: boolean;
}): PaymentSchedule {
  const { booking, existingSchedule, latestSnapshot, verifiedPaidAmount, nowIso, appendAuditEntry } = params;
  const currency = (latestSnapshot.currency || existingSchedule.currency || booking.currency || 'USD') as CurrencyCode;
  const revisedTotal = roundMoney(Math.max(0, latestSnapshot.current_selling_price ?? latestSnapshot.revisedCustomerSellingPrice));
  const totalPaid = roundMoney(Math.max(0, verifiedPaidAmount));
  const balanceDue = roundMoney(Math.max(0, revisedTotal - totalPaid));
  const excessAmount = roundMoney(Math.max(0, totalPaid - revisedTotal));
  const previousBookingAmount = roundMoney(
    existingSchedule.revisedBookingAmount ?? existingSchedule.totalAmount ?? revisedTotal
  );

  const notice =
    excessAmount > 0
      ? `Booking amount changed from ${currency} ${previousBookingAmount.toLocaleString()} to ${currency} ${revisedTotal.toLocaleString()} (Snapshot v${latestSnapshot.version}). Saved schedule v${existingSchedule.scheduleVersion || 1} has been preserved without silent modification. Verified payments (${currency} ${totalPaid.toLocaleString()}) exceed the revised amount by ${currency} ${excessAmount.toLocaleString()} — use "Recalculate Payment Schedule" to review and save a new schedule version.`
      : `Booking amount changed from ${currency} ${previousBookingAmount.toLocaleString()} to ${currency} ${revisedTotal.toLocaleString()} (Snapshot v${latestSnapshot.version}). Saved schedule v${existingSchedule.scheduleVersion || 1} has been preserved untouched — click "Recalculate Payment Schedule" to preview and commit a new schedule version.`;

  const existingHistory = Array.isArray(existingSchedule.auditHistory) ? [...existingSchedule.auditHistory] : [];
  if (appendAuditEntry) {
    const alreadyFlaggedForSnapshot = existingHistory.some(
      entry =>
        entry.action === 'FLAGGED_FOR_ADJUSTMENT' &&
        entry.financialSnapshotVersion === latestSnapshot.version &&
        entry.newTotalAmount === revisedTotal
    );
    if (!alreadyFlaggedForSnapshot) {
      existingHistory.unshift({
        id: `ps-flag-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        action: 'FLAGGED_FOR_ADJUSTMENT',
        timestamp: nowIso,
        actorId: 'system',
        actorName: 'Financial Sync Engine',
        actorRole: 'SYSTEM',
        reason: `Booking financial snapshot updated to v${latestSnapshot.version} (${currency} ${previousBookingAmount.toLocaleString()} -> ${currency} ${revisedTotal.toLocaleString()}). Saved payment schedule v${existingSchedule.scheduleVersion || 1} preserved pending Admin recalculation.`,
        scheduleId: existingSchedule.scheduleId,
        scheduleVersion: existingSchedule.scheduleVersion || 1,
        financialSnapshotId: latestSnapshot.snapshotId,
        financialSnapshotVersion: latestSnapshot.version,
        previousTotalAmount: previousBookingAmount,
        newTotalAmount: revisedTotal,
        previousTotalScheduled: roundMoney(
          (existingSchedule.installments || []).reduce((s, i) => s + Number(i.amount || 0), 0)
        ),
        newTotalScheduled: roundMoney(
          (existingSchedule.installments || []).reduce((s, i) => s + Number(i.amount || 0), 0)
        ),
        bookingSellingTotal: revisedTotal,
        currency,
        trancheCountBefore: existingSchedule.installments.length,
        trancheCountAfter: existingSchedule.installments.length,
        summary: `Flagged schedule v${existingSchedule.scheduleVersion || 1} for recalculation after booking total changed from ${currency} ${previousBookingAmount.toLocaleString()} to ${currency} ${revisedTotal.toLocaleString()}.`
      });
    }
  }

  return {
    ...existingSchedule,
    // Keep saved schedule's original committed tranches & committed total untouched
    previousBookingAmount,
    latestBookingAmount: revisedTotal,
    latestFinancialSnapshotId: latestSnapshot.snapshotId,
    latestFinancialSnapshotVersion: latestSnapshot.version,
    totalPaid,
    balanceDue,
    excessAmount: excessAmount > 0 ? excessAmount : undefined,
    requiresAdjustment: true,
    scheduleStatus: 'RECALCULATION_REQUIRED',
    adjustmentNotice: notice,
    auditHistory: existingHistory,
    updatedAt: nowIso
  };
}

/**
 * Recalculates a derived/default PaymentSchedule against the authoritative revised selling price.
 * For Admin-committed custom schedules (`isManualCustomSchedule` or `scheduleId`), NEVER silently
 * mutates saved tranches — instead flags `RECALCULATION_REQUIRED` when `preserveCommittedCustom` is true.
 */
export function recalculateBookingPaymentSchedule(
  booking: Booking,
  revisedSellingPrice: number,
  verifiedPaidAmount: number,
  currency: CurrencyCode,
  nowIso: string = new Date().toISOString(),
  options?: {
    preserveCommittedCustom?: boolean;
    latestSnapshot?: BookingPricingSnapshot;
    appendAuditEntry?: boolean;
  }
): PaymentSchedule {
  const targetTotal = roundMoney(Math.max(0, revisedSellingPrice));
  const totalPaid = roundMoney(Math.max(0, verifiedPaidAmount));
  const balanceDue = roundMoney(Math.max(0, targetTotal - totalPaid));
  const excessAmount = roundMoney(Math.max(0, totalPaid - targetTotal));
  const existingSchedule = booking.paymentSchedule;
  const preserveCustom = options?.preserveCommittedCustom === true;

  if (preserveCustom && isCommittedCustomPaymentSchedule(existingSchedule)) {
    const committedAmount = roundMoney(
      existingSchedule!.revisedBookingAmount ?? existingSchedule!.totalAmount ?? 0
    );
    const snapVersionMismatch = Boolean(
      options?.latestSnapshot?.version &&
      existingSchedule!.financialSnapshotVersion &&
      existingSchedule!.financialSnapshotVersion !== options.latestSnapshot.version
    );
    const amountMismatch = Math.abs(committedAmount - targetTotal) > 0.01;

    if (amountMismatch || snapVersionMismatch) {
      const snap = options?.latestSnapshot || getLatestBookingPricingSnapshot(booking);
      return buildFlaggedPreservedSchedule({
        booking,
        existingSchedule: existingSchedule!,
        latestSnapshot: snap,
        verifiedPaidAmount: totalPaid,
        nowIso,
        appendAuditEntry: options?.appendAuditEntry === true
      });
    }

    // No financial drift — keep committed schedule intact and refresh live paid/outstanding summary
    return {
      ...existingSchedule!,
      totalPaid,
      balanceDue,
      excessAmount: excessAmount > 0 ? excessAmount : undefined,
      paymentStatus:
        balanceDue <= 0 && (targetTotal > 0 || totalPaid > 0)
          ? 'PAID'
          : totalPaid > 0
            ? 'PARTIALLY_PAID'
            : existingSchedule!.paymentStatus
    };
  }

  let schedulePaymentStatus: PaymentSchedule['paymentStatus'] = 'UNPAID';
  if (balanceDue <= 0 && (targetTotal > 0 || totalPaid > 0)) {
    schedulePaymentStatus = 'PAID';
  } else if (totalPaid > 0) {
    schedulePaymentStatus = 'PARTIALLY_PAID';
  }

  let sourceInstallments: PaymentInstallmentItem[] = [];

  if (existingSchedule?.installments && existingSchedule.installments.length > 0) {
    sourceInstallments = existingSchedule.installments.map((inst, idx) => ({
      ...inst,
      installmentNumber: inst.installmentNumber || idx + 1,
      currency
    }));
  } else if (Array.isArray(existingSchedule?.tranches) && existingSchedule!.tranches.length > 0) {
    sourceInstallments = existingSchedule!.tranches.map((tr: any, idx: number) => ({
      id: tr.id || `inst-${booking.id}-${idx + 1}`,
      title: tr.title || tr.label || `Installment ${idx + 1}`,
      milestone: tr.milestone,
      description: tr.description,
      paymentTerms: tr.paymentTerms,
      calculationMode: tr.calculationMode,
      installmentNumber: Number(tr.installmentNumber || idx + 1),
      percentage: typeof tr.percentage === 'number' ? tr.percentage : undefined,
      amount: roundMoney(Number(tr.amount || 0)),
      currency,
      dueDate: tr.dueDate || booking.paymentCutoffDate || booking.travelStartDate || nowIso.split('T')[0],
      status: (tr.status || 'PENDING') as PaymentInstallmentItem['status'],
      paidAmount: typeof tr.paidAmount === 'number' ? roundMoney(tr.paidAmount) : undefined,
      paidDate: tr.paidDate,
      paymentMethod: tr.paymentMethod,
      paymentProofId: tr.paymentProofId,
      allocatedPaymentProofIds: tr.allocatedPaymentProofIds,
      notes: tr.notes
    }));
  } else {
    const depositDue = booking.paymentCutoffDate || (booking.createdAt ? booking.createdAt.split('T')[0] : nowIso.split('T')[0]);
    const finalDue = booking.travelStartDate || booking.paymentCutoffDate || nowIso.split('T')[0];
    sourceInstallments = [
      {
        id: `inst-${booking.id}-1`,
        title: 'Advance Deposit (50%)',
        milestone: 'Booking Confirmation',
        calculationMode: 'PERCENTAGE',
        installmentNumber: 1,
        percentage: 50,
        amount: 0,
        currency,
        dueDate: depositDue,
        status: 'PENDING'
      },
      {
        id: `inst-${booking.id}-2`,
        title: 'Final Balance Payment (50%)',
        milestone: 'Pre-Departure Cut-off',
        calculationMode: 'PERCENTAGE',
        installmentNumber: 2,
        percentage: 50,
        amount: 0,
        currency,
        dueDate: finalDue,
        status: 'PENDING'
      }
    ];
  }

  // Separate immutable PAID tranches from recalculable open tranches.
  // Partially paid tranches keep their recorded paidAmount floor so paid amounts are never lost or duplicated.
  const lockedPaidIndices = new Set<number>();
  let lockedPaidSum = 0;
  sourceInstallments.forEach((inst, idx) => {
    if (inst.status === 'PAID') {
      lockedPaidIndices.add(idx);
      lockedPaidSum = roundMoney(lockedPaidSum + (inst.paidAmount ?? inst.amount ?? 0));
    }
  });

  const openIndices: number[] = [];
  const openWeights: number[] = [];
  const openExactPcts: Array<number | undefined> = [];
  sourceInstallments.forEach((inst, idx) => {
    if (!lockedPaidIndices.has(idx)) {
      openIndices.push(idx);
      const weight =
        typeof inst.percentage === 'number' && inst.percentage > 0
          ? inst.percentage
          : inst.amount > 0
            ? inst.amount
            : 1;
      openWeights.push(weight);
      openExactPcts.push(typeof inst.percentage === 'number' ? inst.percentage : undefined);
    }
  });

  const remainingToAllocate = roundMoney(Math.max(0, targetTotal - lockedPaidSum));
  const allocatedOpenAmounts = distributeWithFinalOpenTrancheRounding(
    remainingToAllocate,
    openWeights,
    lockedPaidIndices.size === 0 ? openExactPcts : undefined
  );

  // Preserve partial tranche paidAmounts cleanly without auto-marking unpaid tranches as PAID when no payment exists
  let unassignedPaid = roundMoney(Math.max(0, totalPaid - lockedPaidSum));
  const updatedInstallments: PaymentInstallmentItem[] = sourceInstallments.map((inst, idx) => {
    if (lockedPaidIndices.has(idx)) {
      const lockedAmt = roundMoney(inst.paidAmount ?? inst.amount ?? 0);
      return {
        ...inst,
        currency,
        amount: lockedAmt,
        paidAmount: lockedAmt,
        percentage: targetTotal > 0 ? roundMoney((lockedAmt / targetTotal) * 100) : 0,
        status: 'PAID'
      };
    }

    const openPos = openIndices.indexOf(idx);
    const newAmt = allocatedOpenAmounts[openPos] ?? 0;
    const appliedPaid = roundMoney(Math.min(newAmt, unassignedPaid));
    unassignedPaid = roundMoney(Math.max(0, unassignedPaid - appliedPaid));

    let nextStatus: PaymentInstallmentItem['status'] = 'PENDING';
    if (appliedPaid > 0 && appliedPaid >= newAmt - 0.01 && newAmt > 0) {
      nextStatus = 'PAID';
    } else if (appliedPaid > 0) {
      nextStatus = 'PARTIAL';
    } else if (inst.status === 'OVERDUE') {
      nextStatus = 'OVERDUE';
    }

    return {
      ...inst,
      currency,
      amount: newAmt,
      paidAmount: appliedPaid,
      percentage: targetTotal > 0 ? roundMoney((newAmt / targetTotal) * 100) : 0,
      status: nextStatus
    };
  });

  const syncedTranches = updatedInstallments.map(inst => ({
    id: inst.id,
    title: inst.title,
    label: inst.title,
    milestone: inst.milestone,
    description: inst.description || inst.notes || '',
    paymentTerms: inst.paymentTerms,
    calculationMode: inst.calculationMode || 'PERCENTAGE',
    installmentNumber: inst.installmentNumber,
    percentage: inst.percentage,
    amount: inst.amount,
    paidAmount: inst.paidAmount || 0,
    balanceDue: roundMoney(Math.max(0, inst.amount - (inst.paidAmount || 0))),
    currency: inst.currency,
    dueDate: inst.dueDate,
    status: inst.status,
    notes: inst.notes
  }));

  const prevTotal = existingSchedule ? roundMoney(Number(existingSchedule.totalAmount || 0)) : targetTotal;
  const totalChanged = Boolean(existingSchedule && Math.abs(prevTotal - targetTotal) > 0.01);
  const existingHistory = Array.isArray(existingSchedule?.auditHistory) ? [...existingSchedule!.auditHistory] : [];

  let requiresAdjustment = Boolean(existingSchedule?.requiresAdjustment);
  let adjustmentNotice = existingSchedule?.adjustmentNotice;

  if (totalChanged) {
    const isCustom = Boolean(existingSchedule?.isManualCustomSchedule);
    if (isCustom || excessAmount > 0) {
      requiresAdjustment = true;
      adjustmentNotice =
        excessAmount > 0
          ? `Booking total changed from ${currency} ${prevTotal.toLocaleString()} to ${currency} ${targetTotal.toLocaleString()}. Verified payments exceed the revised booking amount by ${currency} ${excessAmount.toLocaleString()} — please review refund/credit handling.`
          : `Booking total changed from ${currency} ${prevTotal.toLocaleString()} to ${currency} ${targetTotal.toLocaleString()}. Custom instalment tranches require recalculation.`;
    }
    existingHistory.unshift({
      id: `ps-aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action: isCustom || excessAmount > 0 ? 'FLAGGED_FOR_ADJUSTMENT' : 'RECALCULATED_ON_BOOKING_CHANGE',
      timestamp: nowIso,
      actorId: 'system',
      actorName: 'Financial Sync Engine',
      actorRole: 'SYSTEM',
      reason: 'Booking total changed due to manual discount or financial adjustment',
      previousTotalAmount: prevTotal,
      newTotalAmount: targetTotal,
      trancheCountBefore: sourceInstallments.length,
      trancheCountAfter: updatedInstallments.length,
      summary: `Recalculated ${updatedInstallments.length} payment tranche(s) from ${currency} ${prevTotal.toLocaleString()} to ${currency} ${targetTotal.toLocaleString()}.`
    });
  }

  const snap = options?.latestSnapshot;
  return {
    scheduleId: existingSchedule?.scheduleId,
    scheduleVersion: existingSchedule?.scheduleVersion,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    financialSnapshotId: snap?.snapshotId || existingSchedule?.financialSnapshotId,
    financialSnapshotVersion: snap?.version || existingSchedule?.financialSnapshotVersion,
    originalBookingAmount: snap ? roundMoney(snap.original_selling_price ?? snap.originalCustomerSellingPrice) : existingSchedule?.originalBookingAmount,
    totalDiscountAmount: snap ? roundMoney(snap.cumulativeAdminManualDiscount + snap.b2bPromotionDiscountAmount) : existingSchedule?.totalDiscountAmount,
    revisedBookingAmount: targetTotal,
    totalAmount: targetTotal,
    currency,
    installments: updatedInstallments,
    tranches: syncedTranches,
    totalPaid,
    balanceDue,
    unallocatedBalance: 0,
    isPartialSchedule: false,
    excessAmount: excessAmount > 0 ? excessAmount : undefined,
    paymentStatus: schedulePaymentStatus,
    scheduleStatus: requiresAdjustment ? 'RECALCULATION_REQUIRED' : 'ACTIVE',
    isManualCustomSchedule: existingSchedule?.isManualCustomSchedule,
    requiresAdjustment,
    adjustmentNotice,
    lastAdjustedAt: totalChanged ? nowIso : existingSchedule?.lastAdjustedAt,
    lastAdjustedBy: existingSchedule?.lastAdjustedBy,
    auditHistory: existingHistory,
    updatedAt: nowIso
  };
}

/**
 * Generates an authoritative live preview for recalculating an existing Payment Schedule
 * against the Latest Committed Booking Financial Snapshot BEFORE persisting a new version.
 *
 * Guarantees:
 * - Never mutates booking or historical schedule versions.
 * - Uses Latest Committed Financial Snapshot (never original pre-discount amount, never double-subtracts).
 * - Locks already-PAID tranches and preserves existing payment proof relationships.
 * - Never auto-marks unpaid tranches as PAID and never duplicates already-paid amounts.
 * - Final open tranche absorbs any rounding difference so totals match to the exact cent.
 */
export function previewPaymentScheduleRecalculation(params: {
  booking: Booking;
  externalSnapshots?: BookingPricingSnapshot[];
  existingSchedules?: PaymentSchedule[];
  nowIso?: string;
}): PaymentScheduleRecalculationPreview {
  const { booking, externalSnapshots, existingSchedules, nowIso = new Date().toISOString() } = params;
  const latestSnapshot = getLatestBookingPricingSnapshot(booking, externalSnapshots);
  const currency = (latestSnapshot.currency || booking.currency || 'USD') as CurrencyCode;
  const originalBookingAmount = roundMoney(
    Math.max(0, latestSnapshot.original_selling_price ?? latestSnapshot.originalCustomerSellingPrice)
  );
  const totalDiscountAmount = roundMoney(
    Math.max(0, (latestSnapshot.cumulativeAdminManualDiscount || 0) + (latestSnapshot.b2bPromotionDiscountAmount || 0))
  );
  const revisedBookingAmount = roundMoney(
    Math.max(0, latestSnapshot.current_selling_price ?? latestSnapshot.revisedCustomerSellingPrice)
  );
  const verifiedPaidAmount = resolveVerifiedPaidAmount(booking);
  const outstandingBalance = roundMoney(Math.max(0, revisedBookingAmount - verifiedPaidAmount));
  const creditBalance = roundMoney(Math.max(0, verifiedPaidAmount - revisedBookingAmount));
  const isOverpaid = creditBalance > 0;

  const historyList: PaymentSchedule[] = [
    ...(existingSchedules || []),
    ...(booking.paymentScheduleHistory || []),
    ...(booking.paymentSchedule ? [booking.paymentSchedule] : [])
  ];
  const maxVersion = historyList.reduce((max, s) => Math.max(max, Number(s.scheduleVersion || 0)), 0);
  const baseSchedule = booking.paymentSchedule || recalculateBookingPaymentSchedule(
    booking,
    revisedBookingAmount,
    verifiedPaidAmount,
    currency,
    nowIso
  );

  const prevInstallments = baseSchedule.installments || [];
  const previousTotalScheduled = roundMoney(
    prevInstallments.reduce((sum, inst) => sum + Number(inst.amount || 0), 0)
  );
  const previousBookingAmount = roundMoney(
    baseSchedule.revisedBookingAmount ?? baseSchedule.totalAmount ?? previousTotalScheduled
  );

  // Recalculate against the latest committed snapshot (forcing recalculation on a clone, never mutating source)
  const recalculated = recalculateBookingPaymentSchedule(
    { ...booking, paymentSchedule: baseSchedule },
    revisedBookingAmount,
    verifiedPaidAmount,
    currency,
    nowIso,
    { preserveCommittedCustom: false, latestSnapshot }
  );

  const warnings: string[] = [];
  if (isOverpaid) {
    warnings.push(
      `Verified payments received (${currency} ${verifiedPaidAmount.toLocaleString()}) exceed the revised booking amount (${currency} ${revisedBookingAmount.toLocaleString()}) by ${currency} ${creditBalance.toLocaleString()}. Historical payment proofs will remain unchanged; no automatic refund will be created.`
    );
  }
  const lockedPaidSum = roundMoney(
    prevInstallments
      .filter(i => i.status === 'PAID')
      .reduce((s, i) => s + Number(i.paidAmount ?? i.amount ?? 0), 0)
  );
  if (lockedPaidSum > revisedBookingAmount + 0.01) {
    warnings.push(
      `Already-PAID tranches (${currency} ${lockedPaidSum.toLocaleString()}) exceed the revised booking amount (${currency} ${revisedBookingAmount.toLocaleString()}). Paid tranches remain strictly immutable.`
    );
  }

  const trancheDiffs: PaymentScheduleTrancheDiff[] = recalculated.installments.map((nextInst, idx) => {
    const prevInst = prevInstallments[idx];
    const prevAmt = roundMoney(Number(prevInst?.amount || 0));
    const prevPct =
      typeof prevInst?.percentage === 'number'
        ? roundMoney(prevInst.percentage)
        : previousBookingAmount > 0
          ? roundMoney((prevAmt / previousBookingAmount) * 100)
          : 0;
    const nextAmt = roundMoney(Number(nextInst.amount || 0));
    const nextPct = roundMoney(Number(nextInst.percentage || 0));
    return {
      id: nextInst.id,
      installmentNumber: idx + 1,
      title: nextInst.title,
      milestone: nextInst.milestone,
      dueDate: nextInst.dueDate,
      status: nextInst.status,
      calculationMode: nextInst.calculationMode || (typeof prevInst?.percentage === 'number' ? 'PERCENTAGE' : 'FIXED'),
      isLockedPaid: prevInst?.status === 'PAID',
      paidAmount: roundMoney(Number(nextInst.paidAmount || 0)),
      previousAmount: prevAmt,
      previousPercentage: prevPct,
      recalculatedAmount: nextAmt,
      recalculatedPercentage: nextPct,
      deltaAmount: roundMoney(nextAmt - prevAmt)
    };
  });

  const recalculatedTotalScheduled = roundMoney(
    recalculated.installments.reduce((s, i) => s + Number(i.amount || 0), 0)
  );

  return {
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    currency,
    financialSnapshotId: latestSnapshot.snapshotId,
    financialSnapshotVersion: latestSnapshot.version,
    originalBookingAmount,
    totalDiscountAmount,
    revisedBookingAmount,
    previousScheduleId: baseSchedule.scheduleId,
    previousScheduleVersion: baseSchedule.scheduleVersion || (baseSchedule.isManualCustomSchedule ? 1 : 0),
    previousBookingAmount,
    previousTotalScheduled,
    nextScheduleVersion: maxVersion + 1,
    verifiedPaidAmount,
    outstandingBalance,
    creditBalance,
    isOverpaid,
    trancheDiffs,
    recalculatedInstallments: recalculated.installments,
    recalculatedTotalScheduled,
    unallocatedBalance: roundMoney(Math.max(0, revisedBookingAmount - recalculatedTotalScheduled)),
    warnings
  };
}

/**
 * Validates and builds a new immutable versioned PaymentSchedule linked to the
 * Latest Committed Booking Financial Snapshot.
 *
 * Enforces:
 * - Strict calculation against latest committed snapshot (never original pre-discount total).
 * - Percentage mode (cent-exact with final open tranche absorbing rounding) & Fixed mode.
 * - Strict rejection of negative amounts, percentages > 100%, or over-allocation above revisedBookingAmount.
 * - Explicit Partial Schedule support (`allowPartialSchedule: true`) with computed `unallocatedBalance`.
 * - Preservation of already-PAID tranches & partial payment floor without modifying payment proofs.
 * - Idempotency key replay protection & optimistic snapshot version conflict check.
 */
export function validateAndBuildVersionedPaymentSchedule(params: {
  booking: Booking;
  tranches: PaymentScheduleTrancheInput[];
  actor: {
    id: string;
    name: string;
    email?: string;
    role: string;
  };
  reason: string;
  allowPartialSchedule?: boolean;
  idempotencyKey?: string;
  expectedSnapshotVersion?: number;
  isRecalculation?: boolean;
  externalSnapshots?: BookingPricingSnapshot[];
  existingSchedules?: PaymentSchedule[];
  now?: Date;
}):
  | {
      ok: true;
      idempotentReplay: boolean;
      newSchedule: PaymentSchedule;
      supersededSchedule?: PaymentSchedule;
      updatedBooking: Booking;
    }
  | {
      ok: false;
      status: number;
      error: string;
    } {
  const {
    booking,
    tranches,
    actor,
    reason,
    allowPartialSchedule = false,
    idempotencyKey,
    expectedSnapshotVersion,
    isRecalculation = false,
    externalSnapshots,
    existingSchedules = [],
    now = new Date()
  } = params;

  const trimmedReason = (reason || '').trim();
  if (trimmedReason.length < 3) {
    return {
      ok: false,
      status: 400,
      error: 'Please enter a reason (at least 3 characters) for this payment schedule version.'
    };
  }

  if (!Array.isArray(tranches) || tranches.length === 0) {
    return { ok: false, status: 400, error: 'At least one payment tranche is required.' };
  }
  if (tranches.length > 50) {
    return { ok: false, status: 400, error: 'A payment schedule cannot contain more than 50 tranches.' };
  }

  // Merge existing version history from Firestore collection + booking document
  const scheduleById = new Map<string, PaymentSchedule>();
  for (const s of [...(booking.paymentScheduleHistory || []), ...existingSchedules]) {
    if (s && s.scheduleId) scheduleById.set(s.scheduleId, s);
  }
  if (booking.paymentSchedule?.scheduleId) {
    scheduleById.set(booking.paymentSchedule.scheduleId, booking.paymentSchedule);
  }
  const allVersions = Array.from(scheduleById.values()).sort(
    (a, b) => (a.scheduleVersion || 0) - (b.scheduleVersion || 0)
  );

  // Idempotency replay check
  const cleanIdempotencyKey = idempotencyKey?.trim() || undefined;
  if (cleanIdempotencyKey) {
    const existingReplay = allVersions.find(s => s.idempotencyKey === cleanIdempotencyKey);
    if (existingReplay) {
      return {
        ok: true,
        idempotentReplay: true,
        newSchedule: existingReplay,
        updatedBooking: booking
      };
    }
  }

  const latestSnapshot = getLatestBookingPricingSnapshot(booking, externalSnapshots);
  if (
    typeof expectedSnapshotVersion === 'number' &&
    expectedSnapshotVersion !== latestSnapshot.version
  ) {
    return {
      ok: false,
      status: 409,
      error: `Financial snapshot version conflict: expected Snapshot v${expectedSnapshotVersion}, but latest committed snapshot is v${latestSnapshot.version}. Refresh before saving.`
    };
  }

  const currency = (latestSnapshot.currency || booking.currency || 'USD') as CurrencyCode;
  const originalBookingAmount = roundMoney(
    Math.max(0, latestSnapshot.original_selling_price ?? latestSnapshot.originalCustomerSellingPrice)
  );
  const totalDiscountAmount = roundMoney(
    Math.max(0, (latestSnapshot.cumulativeAdminManualDiscount || 0) + (latestSnapshot.b2bPromotionDiscountAmount || 0))
  );
  const revisedBookingAmount = roundMoney(
    Math.max(0, latestSnapshot.current_selling_price ?? latestSnapshot.revisedCustomerSellingPrice)
  );
  const verifiedPaidAmount = resolveVerifiedPaidAmount(booking);

  const prevSchedule = booking.paymentSchedule;
  const prevInstallments = prevSchedule?.installments || [];
  const prevById = new Map<string, PaymentInstallmentItem>(prevInstallments.map(i => [i.id, i]));

  // Lock protection: already-PAID tranches cannot be deleted or altered in amount
  const paidExisting = prevInstallments.filter(i => i.status === 'PAID');
  for (const paidTranche of paidExisting) {
    const matching = tranches.find(t => t.id === paidTranche.id);
    if (!matching) {
      return {
        ok: false,
        status: 400,
        error: `Paid tranche "${paidTranche.title}" cannot be deleted once payment has been settled.`
      };
    }
    const resolvedInputAmt =
      matching.calculationMode === 'PERCENTAGE' && typeof matching.percentage === 'number' && matching.amount === undefined
        ? roundMoney((revisedBookingAmount * matching.percentage) / 100)
        : roundMoney(Number(matching.amount ?? paidTranche.amount));
    if (Math.abs(resolvedInputAmt - roundMoney(paidTranche.paidAmount ?? paidTranche.amount)) > 0.01) {
      return {
        ok: false,
        status: 400,
        error: `Paid tranche "${paidTranche.title}" amount (${currency} ${paidTranche.amount}) is locked and cannot be altered.`
      };
    }
  }

  // Validate individual rows & resolve amounts (supporting Percentage mode with final-tranche rounding absorption & Fixed mode)
  const resolvedAmounts: number[] = new Array(tranches.length).fill(0);
  const resolvedModes: Array<'PERCENTAGE' | 'FIXED'> = [];
  const openPercentageIndices: number[] = [];
  let sumPercentageInputs = 0;

  for (let i = 0; i < tranches.length; i++) {
    const t = tranches[i];
    if (!t.title || !t.title.trim()) {
      return { ok: false, status: 400, error: `Tranche #${i + 1} requires a title.` };
    }
    if (!t.dueDate || !t.dueDate.trim()) {
      return { ok: false, status: 400, error: `Tranche "${t.title}" requires a due date.` };
    }

    const prevItem = t.id ? prevById.get(t.id) : undefined;
    const isLockedPaid = prevItem?.status === 'PAID';
    const mode: 'PERCENTAGE' | 'FIXED' =
      t.calculationMode === 'PERCENTAGE'
        ? 'PERCENTAGE'
        : t.calculationMode === 'FIXED'
          ? 'FIXED'
          : typeof t.amount === 'number' && Number.isFinite(t.amount)
            ? 'FIXED'
            : 'PERCENTAGE';
    resolvedModes.push(mode);

    if (isLockedPaid) {
      resolvedAmounts[i] = roundMoney(prevItem!.paidAmount ?? prevItem!.amount);
      continue;
    }

    if (mode === 'PERCENTAGE') {
      const pct = Number(t.percentage);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return {
          ok: false,
          status: 400,
          error: `Tranche "${t.title}" percentage must be between 0% and 100%.`
        };
      }
      sumPercentageInputs = roundMoney(sumPercentageInputs + pct);
      openPercentageIndices.push(i);
      resolvedAmounts[i] = roundMoney((revisedBookingAmount * pct) / 100);
    } else {
      const amt = roundMoney(Number(t.amount));
      if (!Number.isFinite(amt) || amt < 0) {
        return { ok: false, status: 400, error: `Tranche "${t.title}" cannot have a negative or invalid amount.` };
      }
      if (typeof t.percentage === 'number' && Number.isFinite(t.percentage) && (t.percentage < 0 || t.percentage > 100.01)) {
        return { ok: false, status: 400, error: `Tranche "${t.title}" percentage must be between 0% and 100%.` };
      }
      resolvedAmounts[i] = amt;
    }

    // Partially paid tranche floor check: cannot reduce below already verified paidAmount on that tranche
    if (prevItem && prevItem.status === 'PARTIAL' && (prevItem.paidAmount || 0) > 0) {
      if (resolvedAmounts[i] + 0.01 < roundMoney(prevItem.paidAmount || 0)) {
        return {
          ok: false,
          status: 400,
          error: `Partially paid tranche "${t.title}" cannot be reduced below its already-paid amount (${currency} ${roundMoney(prevItem.paidAmount || 0).toLocaleString()}).`
        };
      }
    }
  }

  // If ALL open tranches are percentage-based and percentages sum to ~100% (with no locked paid tranches),
  // ensure final open tranche absorbs any cent rounding difference so total matches revisedBookingAmount exactly.
  if (
    openPercentageIndices.length > 0 &&
    openPercentageIndices.length === tranches.length &&
    Math.abs(sumPercentageInputs - 100) <= 0.02
  ) {
    let running = 0;
    for (let i = 0; i < tranches.length; i++) {
      if (i === tranches.length - 1) {
        resolvedAmounts[i] = roundMoney(Math.max(0, revisedBookingAmount - running));
      } else {
        running = roundMoney(running + resolvedAmounts[i]);
      }
    }
  }

  const sumTranches = roundMoney(resolvedAmounts.reduce((acc, v) => acc + v, 0));
  const variance = roundMoney(sumTranches - revisedBookingAmount);

  // Strictly block over-allocation unless locked paid tranches themselves exceed revised amount
  const lockedPaidTotal = roundMoney(
    paidExisting.reduce((s, p) => s + roundMoney(p.paidAmount ?? p.amount ?? 0), 0)
  );
  const effectiveMaxAllowed = roundMoney(Math.max(revisedBookingAmount, lockedPaidTotal));
  if (sumTranches > effectiveMaxAllowed + 0.02) {
    return {
      ok: false,
      status: 400,
      error: `Over-allocation blocked: total scheduled tranches (${currency} ${sumTranches.toLocaleString()}) cannot exceed the Revised Booking Amount (${currency} ${revisedBookingAmount.toLocaleString()}).`
    };
  }

  const unallocatedBalance = roundMoney(Math.max(0, revisedBookingAmount - sumTranches));
  const isPartialSchedule = unallocatedBalance > 0.02;

  if (isPartialSchedule && !allowPartialSchedule) {
    return {
      ok: false,
      status: 400,
      error: `Total of all payment tranches (${currency} ${sumTranches.toLocaleString()}) must equal the Revised Booking Amount (${currency} ${revisedBookingAmount.toLocaleString()}). Unallocated balance: ${currency} ${unallocatedBalance.toLocaleString()}. Enable "Allow Partial Schedule" if scheduling only a partial amount.`
    };
  }

  const nowIso = now.toISOString();
  const todayDate = nowIso.split('T')[0];

  // Allocate verified payments accurately without auto-marking unpaid tranches as PAID when amountPaid == 0
  let remainingPaidPool = verifiedPaidAmount;
  // First reserve locked paid tranches so already-settled tranches keep their exact payment allocation
  for (let i = 0; i < tranches.length; i++) {
    const prevItem = tranches[i].id ? prevById.get(tranches[i].id!) : undefined;
    if (prevItem?.status === 'PAID') {
      const lockedAmt = roundMoney(prevItem.paidAmount ?? prevItem.amount);
      remainingPaidPool = roundMoney(Math.max(0, remainingPaidPool - lockedAmt));
    }
  }

  const normalizedInstallments: PaymentInstallmentItem[] = tranches.map((t, idx) => {
    const amt = resolvedAmounts[idx];
    const pct =
      resolvedModes[idx] === 'PERCENTAGE' && typeof t.percentage === 'number' && Number.isFinite(t.percentage)
        ? roundMoney(t.percentage)
        : revisedBookingAmount > 0
          ? roundMoney((amt / revisedBookingAmount) * 100)
          : 0;
    const prevItem = t.id ? prevById.get(t.id) : undefined;
    const isLockedPaid = prevItem?.status === 'PAID';

    let paidForTranche = 0;
    let status: PaymentInstallmentItem['status'] = 'PENDING';

    if (isLockedPaid) {
      paidForTranche = roundMoney(prevItem!.paidAmount ?? prevItem!.amount);
      status = 'PAID';
    } else {
      paidForTranche = roundMoney(Math.min(amt, Math.max(0, remainingPaidPool)));
      remainingPaidPool = roundMoney(Math.max(0, remainingPaidPool - paidForTranche));
      if (paidForTranche > 0 && paidForTranche >= amt - 0.01 && amt > 0) {
        status = 'PAID';
      } else if (paidForTranche > 0) {
        status = 'PARTIAL';
      } else if (t.dueDate && t.dueDate < todayDate) {
        status = 'OVERDUE';
      }
    }

    return {
      id: t.id || `inst-${booking.id}-${Date.now()}-${idx + 1}`,
      installmentNumber: idx + 1,
      title: t.title.trim(),
      milestone: t.milestone?.trim() || undefined,
      description: t.description?.trim() || undefined,
      paymentTerms: t.paymentTerms?.trim() || undefined,
      calculationMode: resolvedModes[idx],
      dueDate: t.dueDate.trim(),
      amount: amt,
      percentage: pct,
      currency,
      status,
      paidAmount: paidForTranche,
      paidDate: prevItem?.paidDate || (status === 'PAID' ? todayDate : undefined),
      paidAt: prevItem?.paidAt || (status === 'PAID' ? nowIso : undefined),
      paymentMethod: prevItem?.paymentMethod,
      paymentReference: prevItem?.paymentReference,
      receiptUrl: prevItem?.receiptUrl,
      paymentProofId: prevItem?.paymentProofId,
      allocatedPaymentProofIds: prevItem?.allocatedPaymentProofIds,
      notes: t.notes?.trim() || undefined
    };
  });

  const maxVersion = allVersions.reduce((m, s) => Math.max(m, Number(s.scheduleVersion || 0)), 0);
  const baseVersion = prevSchedule && !prevSchedule.scheduleVersion && prevSchedule.isManualCustomSchedule ? 1 : maxVersion;
  const nextScheduleVersion = baseVersion + 1;
  const nextScheduleId = `ps-${booking.id}-v${nextScheduleVersion}`;

  const balanceDue = roundMoney(Math.max(0, revisedBookingAmount - verifiedPaidAmount));
  const excessAmount = roundMoney(Math.max(0, verifiedPaidAmount - revisedBookingAmount));
  const schedulePaymentStatus: PaymentSchedule['paymentStatus'] =
    verifiedPaidAmount >= revisedBookingAmount && revisedBookingAmount > 0
      ? 'PAID'
      : verifiedPaidAmount > 0
        ? 'PARTIALLY_PAID'
        : normalizedInstallments.some(i => i.status === 'OVERDUE')
          ? 'OVERDUE'
          : 'UNPAID';

  const scheduleStatus: PaymentScheduleStatus = isPartialSchedule ? 'PARTIAL' : 'ACTIVE';

  const actionType: PaymentScheduleAuditEntry['action'] = isRecalculation
    ? 'SCHEDULE_RECALCULATED'
    : prevInstallments.length === 0
      ? 'SCHEDULE_CREATED'
      : normalizedInstallments.length > prevInstallments.length
        ? 'TRANCHE_ADDED'
        : normalizedInstallments.length < prevInstallments.length
          ? 'TRANCHE_DELETED'
          : 'TRANCHE_UPDATED';

  const prevSumScheduled = roundMoney(prevInstallments.reduce((s, i) => s + Number(i.amount || 0), 0));
  const auditEntry: PaymentScheduleAuditEntry = {
    id: `ps-aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: nowIso,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: actionType,
    reason: trimmedReason,
    scheduleId: nextScheduleId,
    scheduleVersion: nextScheduleVersion,
    financialSnapshotId: latestSnapshot.snapshotId,
    financialSnapshotVersion: latestSnapshot.version,
    previousTotalAmount: prevSumScheduled,
    newTotalAmount: sumTranches,
    previousTotalScheduled: prevSumScheduled,
    newTotalScheduled: sumTranches,
    bookingSellingTotal: revisedBookingAmount,
    trancheCountBefore: prevInstallments.length,
    trancheCountAfter: normalizedInstallments.length,
    currency,
    summary: `Saved Payment Schedule v${nextScheduleVersion} linked to Financial Snapshot v${latestSnapshot.version} (${normalizedInstallments.length} tranche(s), ${currency} ${sumTranches.toLocaleString()}${isPartialSchedule ? `, unallocated ${currency} ${unallocatedBalance.toLocaleString()}` : ''}).`,
    trancheSummary: normalizedInstallments
      .map(i => `${i.title}: ${currency} ${i.amount.toLocaleString()} (${i.percentage}%) due ${i.dueDate}`)
      .join(' | ')
  };

  const syncedTranches = normalizedInstallments.map(inst => ({
    id: inst.id,
    title: inst.title,
    label: inst.title,
    milestone: inst.milestone,
    description: inst.description || inst.notes || '',
    paymentTerms: inst.paymentTerms,
    calculationMode: inst.calculationMode || 'FIXED',
    installmentNumber: inst.installmentNumber,
    percentage: inst.percentage,
    amount: inst.amount,
    paidAmount: inst.paidAmount || 0,
    balanceDue: roundMoney(Math.max(0, inst.amount - (inst.paidAmount || 0))),
    currency: inst.currency,
    dueDate: inst.dueDate,
    status: inst.status,
    notes: inst.notes
  }));

  const newSchedule: PaymentSchedule = {
    scheduleId: nextScheduleId,
    scheduleVersion: nextScheduleVersion,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    financialSnapshotId: latestSnapshot.snapshotId,
    financialSnapshotVersion: latestSnapshot.version,
    appliedAdjustmentId: latestSnapshot.sourceAdjustmentId,
    originalBookingAmount,
    totalDiscountAmount,
    revisedBookingAmount,
    previousBookingAmount: prevSchedule ? roundMoney(prevSchedule.revisedBookingAmount ?? prevSchedule.totalAmount) : undefined,
    latestBookingAmount: revisedBookingAmount,
    latestFinancialSnapshotId: latestSnapshot.snapshotId,
    latestFinancialSnapshotVersion: latestSnapshot.version,
    totalAmount: sumTranches,
    currency,
    totalPaid: verifiedPaidAmount,
    balanceDue,
    unallocatedBalance,
    isPartialSchedule,
    excessAmount: excessAmount > 0 ? excessAmount : undefined,
    paymentStatus: schedulePaymentStatus,
    scheduleStatus,
    idempotencyKey: cleanIdempotencyKey,
    installments: normalizedInstallments,
    tranches: syncedTranches,
    isManualCustomSchedule: true,
    requiresAdjustment: false,
    adjustmentNotice: undefined,
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: nowIso,
    lastAdjustedAt: nowIso,
    lastAdjustedBy: actor.name,
    auditHistory: [auditEntry, ...(prevSchedule?.auditHistory || [])],
    updatedAt: nowIso,
    immutable: true
  };

  // Preserve previous version immutably in booking.paymentScheduleHistory (never overwrite prior versions)
  let supersededSchedule: PaymentSchedule | undefined;
  const nextHistory: PaymentSchedule[] = [...allVersions];
  if (prevSchedule && isCommittedCustomPaymentSchedule(prevSchedule)) {
    const prevId = prevSchedule.scheduleId || `ps-${booking.id}-v${prevSchedule.scheduleVersion || 1}`;
    const alreadyInHistory = nextHistory.some(h => h.scheduleId === prevId);
    supersededSchedule = {
      ...prevSchedule,
      scheduleId: prevId,
      scheduleVersion: prevSchedule.scheduleVersion || 1,
      scheduleStatus: 'SUPERSEDED',
      immutable: true
    };
    if (!alreadyInHistory) {
      nextHistory.push(supersededSchedule);
    } else {
      const idx = nextHistory.findIndex(h => h.scheduleId === prevId);
      if (idx >= 0) {
        nextHistory[idx] = { ...nextHistory[idx], scheduleStatus: 'SUPERSEDED' };
      }
    }
  }
  nextHistory.push(newSchedule);
  nextHistory.sort((a, b) => (a.scheduleVersion || 0) - (b.scheduleVersion || 0));

  const timelineEvent: BookingTimelineEvent = {
    id: `tl-ps-v${nextScheduleVersion}-${Date.now()}`,
    timestamp: nowIso,
    title: isRecalculation
      ? `Payment Schedule Recalculated (v${nextScheduleVersion} · Snapshot v${latestSnapshot.version})`
      : `Payment Schedule v${nextScheduleVersion} Saved (${normalizedInstallments.length} Tranches)`,
    description: `${trimmedReason} • Revised Booking Amount: ${currency} ${revisedBookingAmount.toLocaleString()} • Scheduled: ${currency} ${sumTranches.toLocaleString()}${isPartialSchedule ? ` (Unallocated: ${currency} ${unallocatedBalance.toLocaleString()})` : ''}.`,
    actorName: `${actor.name} (${actor.role})`,
    type: 'PAYMENT'
  };

  const updatedBooking: Booking = {
    ...booking,
    paymentSchedule: newSchedule,
    paymentScheduleHistory: nextHistory,
    paymentCutoffDate: normalizedInstallments[normalizedInstallments.length - 1]?.dueDate || booking.paymentCutoffDate,
    amountPaid: verifiedPaidAmount,
    paidAmount: verifiedPaidAmount,
    balanceDue,
    pendingPaymentAmount: balanceDue,
    creditBalance: excessAmount,
    overpaidAmount: excessAmount,
    excessPaymentAmount: excessAmount,
    paymentStatus:
      verifiedPaidAmount >= revisedBookingAmount && revisedBookingAmount > 0
        ? 'PAID'
        : verifiedPaidAmount > 0
          ? 'PARTIALLY_PAID'
          : 'PENDING_PAYMENT',
    timeline: [timelineEvent, ...(booking.timeline || [])],
    updatedAt: nowIso
  };

  return {
    ok: true,
    idempotentReplay: false,
    newSchedule,
    supersededSchedule,
    updatedBooking
  };
}

export interface AuthoritativeBookingFinancials {
  bookingId: string;
  currency: CurrencyCode;
  originalBookingAmount: number;
  /** Immutable original selling price stored at booking creation */
  original_selling_price: number;
  /** Authoritative dynamically updated selling price after all active discounts */
  current_selling_price: number;
  originalBaseSellingPrice: number;
  b2bPromotionDiscountAmount: number;
  adminManualDiscountTotal: number;
  revisedBookingAmount: number;
  revisedBaseSellingPrice: number;
  supplierNettCost: number;
  originalTheUnboundMargin: number;
  remainingTheUnboundMargin: number;
  grossMarginPercent: number;
  isLossMaking: boolean;
  /** Verified / applied payments from the authoritative payment ledger (never mutated by discounts) */
  verifiedPaidAmount: number;
  /** Total non-rejected payment proofs uploaded (includes pending verification tranches) */
  totalRecordedPaidAmount: number;
  /** Payments uploaded but not yet verified */
  pendingVerificationAmount: number;
  /** Revised Final Booking Amount minus Verified Payments Applied (floored at 0) */
  outstandingBalance: number;
  /** Resulting overpayment / credit position when payments exceed Revised Final Booking Amount */
  creditBalance: number;
  isOverpaid: boolean;
  paymentStatus: Booking['paymentStatus'];
  /** Synchronized Payment Schedule derived against current_selling_price */
  paymentSchedule: PaymentSchedule;
  tranchesCount: number;
  hasManualDiscount: boolean;
  latestSnapshotId: string;
  latestSnapshotVersion: number;
  latestSnapshot: BookingPricingSnapshot;
  baselineSnapshot: BookingPricingSnapshot;
}

/**
 * Single authoritative financial summary resolver for EVERY screen, document, dashboard,
 * commercial account, payment summary, payment schedule, and report in the system.
 *
 * Strictly derives:
 *  - Original Booking Amount (`original_selling_price`) & Current Revised Selling Price (`current_selling_price`)
 *    from the committed BookingPricingSnapshot
 *  - Supplier Nett Cost & Remaining Margin from the committed snapshot (never recalculating ad-hoc)
 *  - Payments Applied from the immutable payment ledger (paymentProofs or legacy amountPaid)
 *  - Outstanding Balance = max(0, current_selling_price - Verified Payments Applied)
 *  - Credit / Overpayment Balance = max(0, Verified Payments Applied - current_selling_price)
 *  - Recalculated Payment Schedule & Tranches synced to current_selling_price
 */
export function resolveAuthoritativeBookingFinancials(
  booking: Booking,
  externalSnapshots?: BookingPricingSnapshot[]
): AuthoritativeBookingFinancials {
  const baselineSnapshot = buildInitialBookingPricingSnapshot(booking, externalSnapshots);
  const latestSnapshot = getLatestBookingPricingSnapshot(booking, externalSnapshots);
  const currency: CurrencyCode = (latestSnapshot.currency || booking.currency || 'USD') as CurrencyCode;

  const originalBookingAmount = roundMoney(
    Math.max(0, latestSnapshot.original_selling_price ?? latestSnapshot.originalCustomerSellingPrice)
  );
  const originalBaseSellingPrice = roundMoney(Math.max(0, latestSnapshot.originalBaseSellingPrice));
  const b2bPromotionDiscountAmount = roundMoney(Math.max(0, latestSnapshot.b2bPromotionDiscountAmount));
  const adminManualDiscountTotal = roundMoney(Math.max(0, latestSnapshot.cumulativeAdminManualDiscount));
  const revisedBookingAmount = roundMoney(
    Math.max(0, latestSnapshot.current_selling_price ?? latestSnapshot.revisedCustomerSellingPrice)
  );
  const revisedBaseSellingPrice = roundMoney(Math.max(0, latestSnapshot.revisedBaseSellingPrice));
  const supplierNettCost = roundMoney(Math.max(0, latestSnapshot.supplierNettCost));
  const originalTheUnboundMargin = roundMoney(latestSnapshot.originalTheUnboundMargin);
  const remainingTheUnboundMargin = roundMoney(latestSnapshot.remainingTheUnboundMargin);
  const grossMarginPercent =
    revisedBookingAmount > 0
      ? roundMoney((remainingTheUnboundMargin / revisedBookingAmount) * 100)
      : 0;

  // Reconcile actual payments without modifying historical payment transactions
  const proofs = booking.paymentProofs || [];
  const hasProofLedger = proofs.length > 0;
  const verifiedProofsSum = roundMoney(
    proofs
      .filter(p => p.verificationStatus === 'VERIFIED')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
  const uploadedProofsSum = roundMoney(
    proofs
      .filter(p => p.verificationStatus !== 'REJECTED')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
  const explicitRecordedPaid = roundMoney(
    Math.max(0, Number(booking.amountPaid ?? (booking as any).paidAmount ?? 0))
  );

  const verifiedPaidAmount = hasProofLedger ? verifiedProofsSum : explicitRecordedPaid;
  const totalRecordedPaidAmount = hasProofLedger ? uploadedProofsSum : explicitRecordedPaid;
  const pendingVerificationAmount = roundMoney(Math.max(0, totalRecordedPaidAmount - verifiedPaidAmount));

  const outstandingBalance = roundMoney(Math.max(0, revisedBookingAmount - verifiedPaidAmount));
  const creditBalance = roundMoney(Math.max(0, verifiedPaidAmount - revisedBookingAmount));
  const isOverpaid = creditBalance > 0;

  let paymentStatus: Booking['paymentStatus'] = 'PENDING_PAYMENT';
  if (verifiedPaidAmount >= revisedBookingAmount && (revisedBookingAmount > 0 || verifiedPaidAmount > 0)) {
    paymentStatus = 'PAID';
  } else if (verifiedPaidAmount > 0 || totalRecordedPaidAmount > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  } else {
    paymentStatus = 'PENDING_PAYMENT';
  }

  const paymentSchedule = recalculateBookingPaymentSchedule(
    booking,
    revisedBookingAmount,
    verifiedPaidAmount,
    currency,
    latestSnapshot.createdAt || booking.updatedAt || new Date().toISOString(),
    {
      preserveCommittedCustom: true,
      latestSnapshot,
      appendAuditEntry: false
    }
  );

  return {
    bookingId: booking.id,
    currency,
    originalBookingAmount,
    original_selling_price: originalBookingAmount,
    current_selling_price: revisedBookingAmount,
    originalBaseSellingPrice,
    b2bPromotionDiscountAmount,
    adminManualDiscountTotal,
    revisedBookingAmount,
    revisedBaseSellingPrice,
    supplierNettCost,
    originalTheUnboundMargin,
    remainingTheUnboundMargin,
    grossMarginPercent,
    isLossMaking: remainingTheUnboundMargin < 0,
    verifiedPaidAmount,
    totalRecordedPaidAmount,
    pendingVerificationAmount,
    outstandingBalance,
    creditBalance,
    isOverpaid,
    paymentStatus,
    paymentSchedule,
    tranchesCount: proofs.length,
    hasManualDiscount: adminManualDiscountTotal > 0,
    latestSnapshotId: latestSnapshot.snapshotId || `bps-${booking.id}-v${latestSnapshot.version}`,
    latestSnapshotVersion: latestSnapshot.version || 1,
    latestSnapshot,
    baselineSnapshot
  };
}

/**
 * Projects the latest committed immutable BookingPricingSnapshot onto the Booking document
 * so all modules (BookingsManager, B2B Portal, Proforma Invoices, Payment Summaries,
 * Payment Schedules, Commercial Accounts, Profitability Reports, Booking Timeline, Dashboards)
 * stay 100% synchronized with the single source of truth while strictly preserving
 * original_selling_price, Supplier Nett Cost, and historical payment proofs.
 */
export function projectSnapshotOntoBooking(
  booking: Booking,
  latestSnapshot: BookingPricingSnapshot,
  snapshotHistory: BookingPricingSnapshot[],
  adjustments: BookingManualDiscountAdjustment[],
  hasExistingInvoices: boolean,
  updatedAtIso: string,
  committedAdjustment?: BookingManualDiscountAdjustment
): Booking {
  const reconciled = resolveAuthoritativeBookingFinancials(booking, snapshotHistory);
  const recalculatedSchedule = isCommittedCustomPaymentSchedule(booking.paymentSchedule)
    ? recalculateBookingPaymentSchedule(
        booking,
        latestSnapshot.revisedCustomerSellingPrice,
        reconciled.verifiedPaidAmount,
        latestSnapshot.currency,
        updatedAtIso,
        {
          preserveCommittedCustom: true,
          latestSnapshot,
          appendAuditEntry: true
        }
      )
    : committedAdjustment?.revisedPaymentSchedule ||
      recalculateBookingPaymentSchedule(
        booking,
        latestSnapshot.revisedCustomerSellingPrice,
        reconciled.verifiedPaidAmount,
        latestSnapshot.currency,
        updatedAtIso,
        {
          preserveCommittedCustom: false,
          latestSnapshot
        }
      );

  // Append structured Booking Timeline event for Booking Timeline & Audit History
  let nextTimeline: BookingTimelineEvent[] = Array.isArray(booking.timeline) ? [...booking.timeline] : [];
  if (committedAdjustment) {
    const timelineEventId = `tl-bmd-${committedAdjustment.adjustmentId}`;
    if (!nextTimeline.some(ev => ev.id === timelineEventId)) {
      const isReversal = committedAdjustment.actionType === 'REVERSE';
      const cur = latestSnapshot.currency;
      const fmt = (n: number) => `${cur} ${roundMoney(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const typeLabel =
        committedAdjustment.discountType === 'PERCENTAGE'
          ? `${committedAdjustment.discountValue}%`
          : fmt(committedAdjustment.discountAmountInBookingCurrency);
      const couponTag = committedAdjustment.couponCode ? ` [Coupon: ${committedAdjustment.couponCode}]` : '';
      nextTimeline.unshift({
        id: timelineEventId,
        title: isReversal
          ? `Admin Manual Discount Reversed (+${fmt(committedAdjustment.discountAmountInBookingCurrency)})${couponTag}`
          : `Admin Manual Discount Applied (-${fmt(committedAdjustment.discountAmountInBookingCurrency)} / ${typeLabel})${couponTag}`,
        description: `Original: ${fmt(latestSnapshot.originalCustomerSellingPrice)} | Prior: ${fmt(committedAdjustment.sellingPriceBefore)} → Revised: ${fmt(latestSnapshot.revisedCustomerSellingPrice)} | Balance Outstanding: ${fmt(reconciled.outstandingBalance)} | Margin: ${fmt(committedAdjustment.marginBefore)} → ${fmt(committedAdjustment.marginAfter)} | Reason: ${committedAdjustment.reason}`,
        timestamp: committedAdjustment.appliedAt || updatedAtIso,
        type: 'PAYMENT',
        actorName: `${committedAdjustment.appliedByName} (${committedAdjustment.appliedByRole})`
      });
    }
  }

  return {
    ...booking,
    // Explicit Two-Field Selling Price Persistence
    original_selling_price: latestSnapshot.originalCustomerSellingPrice,
    current_selling_price: latestSnapshot.revisedCustomerSellingPrice,
    // Revised Customer-Facing Selling Price (Synchronized everywhere)
    originalBookingAmount: latestSnapshot.originalCustomerSellingPrice,
    totalAmount: latestSnapshot.revisedCustomerSellingPrice,
    finalCustomerSellingPrice: latestSnapshot.revisedCustomerSellingPrice,
    final_customer_selling_price: latestSnapshot.revisedCustomerSellingPrice,
    baseFinalSellingPrice: latestSnapshot.revisedBaseSellingPrice,
    base_final_selling_price: latestSnapshot.revisedBaseSellingPrice,
    // Payment Schedule & Tranches (Recalculated against current_selling_price)
    paymentSchedule: recalculatedSchedule,
    // Payment & Outstanding Balance Reconciliation (Never mutates paymentProofs or issues auto-refund)
    amountPaid: reconciled.verifiedPaidAmount,
    paidAmount: reconciled.verifiedPaidAmount,
    balanceDue: reconciled.outstandingBalance,
    pendingPaymentAmount: reconciled.outstandingBalance,
    creditBalance: reconciled.creditBalance,
    overpaidAmount: reconciled.creditBalance,
    excessPaymentAmount: reconciled.creditBalance,
    paymentStatus: reconciled.paymentStatus,
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
    grossMarginPercent: reconciled.grossMarginPercent,
    // Distinct Discount Tracking (Never conflated)
    b2bPromotionDiscountAmount: latestSnapshot.b2bPromotionDiscountAmount,
    adminManualDiscountTotal: latestSnapshot.cumulativeAdminManualDiscount,
    // Immutable Snapshot & Adjustment History References
    currentPricingSnapshotId: latestSnapshot.snapshotId,
    currentPricingSnapshotVersion: latestSnapshot.version,
    pricingSnapshotHistory: snapshotHistory,
    manualDiscountAdjustments: adjustments,
    // Booking Timeline & Audit History
    timeline: nextTimeline,
    // Invoice revision tracking (historical issued invoices are NEVER overwritten)
    hasRevisedPricingAfterInvoice: hasExistingInvoices || booking.hasRevisedPricingAfterInvoice,
    revisedPricingNotice: hasExistingInvoices
      ? `Booking pricing revised to v${latestSnapshot.version} (${latestSnapshot.currency} ${latestSnapshot.revisedCustomerSellingPrice.toLocaleString()}) after invoice issuance. Historical invoices remain immutable and are marked superseded.`
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
