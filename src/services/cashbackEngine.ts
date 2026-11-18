import {
  Booking,
  BookingCashbackComponentBreakdown,
  BookingCashbackLineItemSnapshot,
  BookingCashbackRecord,
  BookingItem,
  CashbackCurrencyBucket,
  CashbackLedgerTransaction,
  CashbackPolicyConfig,
  CashbackPresetType,
  CashbackWalletSummary,
  MaskedBankDetailsSnapshot,
  UserBankAccount,
  UserCashbackConfiguration,
  WithdrawalStatus
} from '../types';

export const SUPPORTED_CASHBACK_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AED',
  'THB',
  'AUD',
  'CAD',
  'SGD',
  'CHF'
] as const;

/**
 * Decimal-safe monetary rounding using 2-decimal precision.
 */
export function roundMoney(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || Number.isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function roundPercent(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || Number.isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function resolveCashbackPresetType(percent: number): CashbackPresetType {
  const p = roundPercent(percent);
  if (p === 1) return '1%';
  if (p === 2) return '2%';
  if (p === 5) return '5%';
  return 'CUSTOM';
}

export function validateCashbackPercentInput(
  rawPercent: unknown,
  maxCeiling: number = 25
): { valid: boolean; normalized: number; error?: string } {
  if (rawPercent === undefined || rawPercent === null || rawPercent === '') {
    return { valid: false, normalized: 0, error: 'Cashback percentage is required.' };
  }
  const str = typeof rawPercent === 'string' ? rawPercent.trim() : String(rawPercent);
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    return {
      valid: false,
      normalized: 0,
      error: 'Cashback percentage must be a valid non-negative number with at most 2 decimal places.'
    };
  }
  const val = roundPercent(Number(str));
  if (!Number.isFinite(val) || val < 0) {
    return { valid: false, normalized: 0, error: 'Cashback percentage cannot be negative.' };
  }
  const ceiling = Math.min(100, Math.max(0.01, Number(maxCeiling) || 25));
  if (val > ceiling) {
    return {
      valid: false,
      normalized: val,
      error: `Cashback percentage (${val}%) exceeds maximum configurable limit (${ceiling}%).`
    };
  }
  return { valid: true, normalized: val };
}

/**
 * Extracts YYYY-MM-DD calendar date safely.
 */
export function normalizeDateYmd(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const trimmed = String(dateStr).trim();
  const ymdMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymdMatch) return ymdMatch[1];
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pure calendar day arithmetic in UTC without DST shift errors.
 */
export function addCalendarDays(ymdDate: string, daysToAdd: number): string {
  const clean = normalizeDateYmd(ymdDate);
  const [y, m, d] = clean.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + daysToAdd, 0, 0, 0, 0));
  return dt.toISOString().slice(0, 10);
}

/**
 * Maps travel destination strings to authoritative IANA timezones.
 */
export function resolveDestinationTimezone(destinationName?: string, explicitTimezone?: string): string {
  if (explicitTimezone) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: explicitTimezone }).format(new Date());
      return explicitTimezone;
    } catch {
      // fall through
    }
  }
  const dest = (destinationName || '').toLowerCase();
  if (
    dest.includes('japan') ||
    dest.includes('tokyo') ||
    dest.includes('kyoto') ||
    dest.includes('osaka') ||
    dest.includes('hokkaido') ||
    dest.includes('okinawa')
  ) {
    return 'Asia/Tokyo';
  }
  if (dest.includes('india') || dest.includes('delhi') || dest.includes('mumbai') || dest.includes('jaipur')) {
    return 'Asia/Kolkata';
  }
  if (dest.includes('thailand') || dest.includes('bangkok') || dest.includes('phuket') || dest.includes('vietnam')) {
    return 'Asia/Bangkok';
  }
  if (dest.includes('singapore')) return 'Asia/Singapore';
  if (dest.includes('dubai') || dest.includes('uae') || dest.includes('abu dhabi')) return 'Asia/Dubai';
  if (dest.includes('uk') || dest.includes('london') || dest.includes('united kingdom')) return 'Europe/London';
  if (
    dest.includes('europe') ||
    dest.includes('paris') ||
    dest.includes('france') ||
    dest.includes('italy') ||
    dest.includes('rome') ||
    dest.includes('swiss') ||
    dest.includes('switzerland')
  ) {
    return 'Europe/Paris';
  }
  if (dest.includes('sydney') || dest.includes('melbourne') || dest.includes('australia')) {
    return 'Australia/Sydney';
  }
  if (dest.includes('new york') || dest.includes('usa')) return 'America/New_York';
  return 'Asia/Tokyo';
}

/**
 * Resolves exact UTC ISO timestamp for `YYYY-MM-DD 00:00:00` in the given IANA timezone.
 */
export function destinationLocalMidnightToUtcIso(ymdDate: string, timeZone: string): string {
  const clean = normalizeDateYmd(ymdDate);
  const [year, month, day] = clean.split('-').map(Number);
  const targetUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  const getOffsetMs = (utcMs: number): number => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      });
      const parts = fmt.formatToParts(new Date(utcMs));
      const map: Record<string, number> = {};
      for (const p of parts) {
        if (p.type !== 'literal') {
          map[p.type] = Number(p.value);
        }
      }
      const zonedAsUtcMs = Date.UTC(
        map.year,
        (map.month || 1) - 1,
        map.day || 1,
        map.hour === 24 ? 0 : (map.hour || 0),
        map.minute || 0,
        map.second || 0,
        0
      );
      return zonedAsUtcMs - utcMs;
    } catch {
      return 0;
    }
  };

  const firstOffset = getOffsetMs(targetUtcMs);
  const firstGuess = targetUtcMs - firstOffset;
  const secondOffset = getOffsetMs(firstGuess);
  const finalUtcMs = targetUtcMs - secondOffset;
  return new Date(finalUtcMs).toISOString();
}

export function computeCreditSchedule(
  travelEndDate: string,
  delayDays = 3,
  destinationName?: string,
  explicitTimezone?: string
): {
  travelEndDateYmd: string;
  destinationTimezone: string;
  scheduledCreditDate: string;
  scheduledCreditAtUtc: string;
} {
  const travelEndDateYmd = normalizeDateYmd(travelEndDate);
  const destinationTimezone = resolveDestinationTimezone(destinationName, explicitTimezone);
  const safeDelay = Math.max(0, Math.floor(Number(delayDays) || 3));
  const scheduledCreditDate = addCalendarDays(travelEndDateYmd, safeDelay);
  const scheduledCreditAtUtc = destinationLocalMidnightToUtcIso(scheduledCreditDate, destinationTimezone);
  return {
    travelEndDateYmd,
    destinationTimezone,
    scheduledCreditDate,
    scheduledCreditAtUtc
  };
}

/**
 * Checks if a user's cashback configuration is eligible for a given booking date.
 */
export function isConfigEligibleForBooking(
  config: UserCashbackConfiguration | null | undefined,
  bookingDateYmd: string
): { eligible: boolean; reason?: string } {
  if (!config) {
    return { eligible: false, reason: 'No cashback configuration assigned to user account.' };
  }
  if (!config.isEligible || config.status !== 'ACTIVE') {
    return { eligible: false, reason: `User cashback eligibility is ${config.status || 'INACTIVE'}.` };
  }
  if (!Number.isFinite(config.cashbackPercent) || config.cashbackPercent <= 0) {
    return { eligible: false, reason: 'Assigned cashback percentage is 0%.' };
  }
  const bookingDay = normalizeDateYmd(bookingDateYmd);
  const effFrom = config.effectiveFrom ? normalizeDateYmd(config.effectiveFrom) : '1970-01-01';
  if (bookingDay < effFrom) {
    return { eligible: false, reason: `Booking date (${bookingDay}) precedes effective date (${effFrom}).` };
  }
  if (config.effectiveTo) {
    const effTo = normalizeDateYmd(config.effectiveTo);
    if (bookingDay > effTo) {
      return { eligible: false, reason: `Booking date (${bookingDay}) exceeds effective expiry (${effTo}).` };
    }
  }
  return { eligible: true };
}

// =========================================================================
// AUTHORITATIVE ACCOMMODATION CLASSIFIER & LAND-PART-ONLY BREAKDOWN
// =========================================================================

const ACCOMMODATION_TYPE_PATTERN =
  /\b(hotel|hotels|accommodation|accommodations|resort|resorts|ryokan|ryokans|villa|villas|lodging|guesthouse|hostel|homestay|room|rooms|hotel_room|hotel_stay|accommodation_package|stay)\b/i;

export function getActiveBookingItemAmount(item: BookingItem | Record<string, any>): number {
  if (!item) return 0;
  if (
    item.isCancelled === true ||
    String(item.supplierStatus || '').toUpperCase() === 'CANCELLED' ||
    String(item.operationalStatus || '').toUpperCase() === 'CANCELLED' ||
    String(item.workflowStage || '').toUpperCase() === 'CANCELLED'
  ) {
    return 0;
  }
  return roundMoney(
    Math.max(
      0,
      Number(
        (item as any).subtotal ??
          item.totalPrice ??
          Number((item as any).price ?? item.unitSellingPrice ?? 0) * Number((item as any).quantity ?? item.totalPax ?? 1)
      )
    )
  );
}

/**
 * Classifies whether a booking line item represents Hotel / Accommodation.
 * CRITICAL RULE: Never classifies accommodation merely by product name.
 * Uses authoritative category/productType/service_type/hotelId/manual flags & PricingSnapshot metadata.
 */
export function isAccommodationBookingItem(
  item: BookingItem | Record<string, any>,
  snapshotLineItems: Array<Record<string, any>> = []
): { isAccommodation: boolean; isNoAccommodationPlaceholder: boolean; hasAuthoritativeType: boolean; reason?: string } {
  if (!item) {
    return { isAccommodation: false, isNoAccommodationPlaceholder: false, hasAuthoritativeType: false };
  }

  const accTypeRaw = String(item.accommodationType || (item as any).product?.accommodationType || '').trim();
  const accTypeUpper = accTypeRaw.toUpperCase();
  if (
    accTypeUpper === 'NO_ACCOMMODATION' ||
    accTypeUpper === 'NONE' ||
    item.productId === 'LAND_ONLY_HUB' ||
    (item as any).productSku === 'LAND_ONLY_HUB' ||
    (item as any).productSku === 'NO_ACCOMMODATION' ||
    (item as any).isNoAccommodation === true
  ) {
    return {
      isAccommodation: false,
      isNoAccommodationPlaceholder: true,
      hasAuthoritativeType: true,
      reason: 'No-accommodation placeholder'
    };
  }

  const snapMatch = snapshotLineItems.find(
    (s) => (s.itemId && item.id && s.itemId === item.id) || (s.productId && item.productId && s.productId === item.productId)
  );
  if (snapMatch && snapMatch.isHotel === true) {
    return {
      isAccommodation: true,
      isNoAccommodationPlaceholder: false,
      hasAuthoritativeType: true,
      reason: 'PricingSnapshot classified line item as hotel/accommodation'
    };
  }

  const typeFields = [
    item.category,
    item.productType,
    item.service_type,
    item.itemType,
    (item as any).supplierType,
    (item as any).product?.category,
    (item as any).product?.productType,
    snapMatch?.category
  ]
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
    .map((v) => String(v).trim());

  const hasAuthoritativeType = typeFields.length > 0 || Boolean(snapMatch);

  for (const tf of typeFields) {
    if (ACCOMMODATION_TYPE_PATTERN.test(tf)) {
      return {
        isAccommodation: true,
        isNoAccommodationPlaceholder: false,
        hasAuthoritativeType: true,
        reason: `Authoritative category/type (${tf}) classified as accommodation`
      };
    }
  }

  if (
    item.isHotel === true ||
    item.isManualHotel === true ||
    Boolean((item as any).product?.isManualHotel) ||
    Boolean(item.manualHotelDetails) ||
    Boolean(item.serviceHotelDetails) ||
    Boolean(item.hotelId) ||
    (accTypeRaw !== '' && accTypeUpper !== 'NO_ACCOMMODATION' && accTypeUpper !== 'NONE')
  ) {
    return {
      isAccommodation: true,
      isNoAccommodationPlaceholder: false,
      hasAuthoritativeType: true,
      reason: 'Authoritative hotel flag / hotelId / manualHotelDetails present'
    };
  }

  return {
    isAccommodation: false,
    isNoAccommodationPlaceholder: false,
    hasAuthoritativeType
  };
}

/**
 * Computes eligible booking amount strictly on the Land Part Total (Hotel Accommodation always excluded),
 * reusing central pricing engine breakdown fields when present and reconciling line items before approval.
 * NEVER falls back to totalBookingAmount when breakdown is missing or contradictory — marks UNVERIFIED_HOLD instead.
 */
export function calculateEligibleBookingComponents(
  booking: Partial<Booking>,
  policy?: CashbackPolicyConfig
): {
  totalBookingAmount: number;
  hotelAccommodationTotal: number;
  landPartTotal: number;
  eligibleAmount: number;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED_HOLD';
  holdReason?: string;
  pricingSnapshotVersion?: number | string;
  breakdown: BookingCashbackComponentBreakdown;
} {
  const snapshot: any = (booking as any).pricingSnapshot || (booking as any).pricing_snapshot || null;
  const currencySnap: any = (booking as any).currencyConversionSnapshot || snapshot?.currencyConversionSnapshot || null;
  const snapshotLineItems: Array<Record<string, any>> = Array.isArray(currencySnap?.lineItems)
    ? currencySnap.lineItems
    : Array.isArray(snapshot?.lineItems)
      ? snapshot.lineItems
      : [];

  const pricingSnapshotVersion =
    booking.sourceSnapshotVersion ??
    booking.pricingVersion ??
    snapshot?.version ??
    snapshot?.snapshotVersion ??
    currencySnap?.quoteVersion;

  const totalBookingAmount = roundMoney(
    Math.max(0, Number(booking.finalCustomerSellingPrice ?? booking.final_customer_selling_price ?? booking.totalAmount ?? 0))
  );

  const items = Array.isArray(booking.items) ? booking.items : [];
  let itemTaxTotal = 0;
  let itemFeeTotal = 0;
  let itemHotelTotal = 0;
  let itemLandTotal = 0;
  let hasUnclassifiedPositiveItem = false;

  const landPartLineItems: BookingCashbackLineItemSnapshot[] = [];
  const excludedAccommodationItems: BookingCashbackLineItemSnapshot[] = [];

  for (const item of items) {
    const rawCat = String(item.category || item.productType || item.service_type || item.itemType || '').trim();
    const upperCat = rawCat.toUpperCase();
    const itemTitle = String(item.productName || item.title || 'Service Item').trim();
    const amt = getActiveBookingItemAmount(item);

    if (upperCat === 'TAX' || /\b(TAX|GST|VAT)\b/.test(upperCat)) {
      itemTaxTotal = roundMoney(itemTaxTotal + amt);
      continue;
    }
    if (upperCat === 'FEE' || upperCat === 'SERVICE_FEE' || /\b(SERVICE\s*FEE|BOOKING\s*FEE)\b/.test(upperCat)) {
      itemFeeTotal = roundMoney(itemFeeTotal + amt);
      continue;
    }

    const cls = isAccommodationBookingItem(item, snapshotLineItems);
    if (cls.isNoAccommodationPlaceholder) {
      continue;
    }

    if (cls.isAccommodation) {
      itemHotelTotal = roundMoney(itemHotelTotal + amt);
      excludedAccommodationItems.push({
        itemId: item.id,
        productId: item.productId,
        productName: itemTitle,
        category: rawCat || 'HOTEL',
        productType: item.productType || item.service_type,
        amount: amt,
        included: false,
        exclusionReason: cls.reason || 'Hotel accommodation excluded from cashback'
      });
    } else {
      if (!cls.hasAuthoritativeType && amt > 0) {
        hasUnclassifiedPositiveItem = true;
      }
      if (amt > 0) {
        itemLandTotal = roundMoney(itemLandTotal + amt);
        landPartLineItems.push({
          itemId: item.id,
          productId: item.productId,
          productName: itemTitle,
          category: rawCat || 'LAND_SERVICE',
          productType: item.productType || item.service_type,
          amount: amt,
          included: true
        });
      }
    }
  }

  const taxAmount = roundMoney(
    Math.max(
      itemTaxTotal,
      Number(snapshot?.totalTax ?? snapshot?.taxOnMargin ?? snapshot?.taxes ?? snapshot?.totals?.taxesTotal ?? (booking as any).taxAmount ?? 0)
    )
  );
  const serviceFeeAmount = roundMoney(
    Math.max(
      itemFeeTotal,
      Number(
        snapshot?.totalFees ??
          snapshot?.serviceFee ??
          snapshot?.serviceFeeAmount ??
          snapshot?.totals?.serviceFeesTotal ??
          (booking as any).serviceFeeAmount ??
          0
      )
    )
  );
  const surchargeAmount = roundMoney(
    Math.max(0, Number(booking.surchargesTotal ?? snapshot?.surchargesTotal ?? snapshot?.totalSurcharges ?? snapshot?.totals?.surchargesTotal ?? 0))
  );
  const discountAmount = roundMoney(
    Math.max(0, Number(snapshot?.totalDiscounts ?? snapshot?.discountsTotal ?? snapshot?.totals?.discountsTotal ?? snapshot?.discountAmount ?? (booking as any).discountAmount ?? 0))
  );

  // Extract authoritative pricing engine hotelAccommodationTotal & landPartTotal if present
  const rawExplicitHotel =
    booking.hotelAccommodationTotal ??
    snapshot?.hotelAccommodationTotal ??
    currencySnap?.hotelAccommodationTotal ??
    currencySnap?.totals?.hotelAccommodationTotal;
  const rawExplicitLand =
    booking.landPartTotal ??
    snapshot?.landPartTotal ??
    currencySnap?.landPartTotal ??
    currencySnap?.totals?.landPartTotal;

  const hasExplicitHotel = typeof rawExplicitHotel === 'number' && Number.isFinite(rawExplicitHotel);
  const hasExplicitLand = typeof rawExplicitLand === 'number' && Number.isFinite(rawExplicitLand);

  const rules = policy?.eligibleComponents;
  const deductDiscounts = rules?.deductDiscounts ?? true;
  const includeTaxes = rules?.includeTaxes ?? false;
  const includeFees = rules?.includeServiceFees ?? false;

  const makeHeldResult = (reason: string) => ({
    totalBookingAmount,
    hotelAccommodationTotal: 0,
    landPartTotal: 0,
    eligibleAmount: 0,
    verificationStatus: 'UNVERIFIED_HOLD' as const,
    holdReason: reason,
    pricingSnapshotVersion,
    breakdown: {
      baseSellAmount: 0,
      hotelAccommodationTotal: 0,
      landPartTotal: 0,
      taxExcludedAmount: taxAmount,
      feeExcludedAmount: serviceFeeAmount,
      surchargeAmount,
      discountDeductedAmount: discountAmount,
      landPartLineItems,
      excludedAccommodationItems
    }
  });

  if (totalBookingAmount <= 0 && itemHotelTotal === 0 && itemLandTotal === 0) {
    return {
      totalBookingAmount: 0,
      hotelAccommodationTotal: 0,
      landPartTotal: 0,
      eligibleAmount: 0,
      verificationStatus: 'VERIFIED',
      pricingSnapshotVersion,
      breakdown: {
        baseSellAmount: 0,
        hotelAccommodationTotal: 0,
        landPartTotal: 0,
        taxExcludedAmount: taxAmount,
        feeExcludedAmount: serviceFeeAmount,
        surchargeAmount,
        discountDeductedAmount: discountAmount,
        landPartLineItems,
        excludedAccommodationItems
      }
    };
  }

  let resolvedHotelTotal = 0;
  let resolvedLandTotal = 0;
  let verified = false;
  let holdReason: string | undefined;

  const tolerance = Math.max(5, roundMoney(totalBookingAmount * 0.02));

  // Case A: Explicit authoritative pricing engine totals are provided
  if (hasExplicitHotel || hasExplicitLand) {
    const expHotel = roundMoney(Math.max(0, Number(hasExplicitHotel ? rawExplicitHotel : 0)));
    const expLand = roundMoney(Math.max(0, Number(hasExplicitLand ? rawExplicitLand : 0)));
    const bothProvided = hasExplicitHotel && hasExplicitLand;
    const expSum = roundMoney(expHotel + expLand);

    // Check whether explicit totals reconcile with totalBookingAmount (accounting for optional separate tax/fee/discount)
    const expTotalMatchesBooking = bothProvided
      ? Math.abs(expSum - totalBookingAmount) <= tolerance ||
        Math.abs(roundMoney(expSum + itemTaxTotal + itemFeeTotal - discountAmount) - totalBookingAmount) <= tolerance
      : Math.abs((hasExplicitHotel ? expHotel : expLand) - totalBookingAmount) <= tolerance || expSum <= totalBookingAmount;

    // Check against active items when items exist (catches stale snapshot totals after item-level cancellation/edit)
    const contradictsItems =
      items.length > 0 &&
      ((itemHotelTotal > 0 && expHotel <= 0) ||
        (itemHotelTotal > 0 && itemLandTotal === 0 && expLand > 0) ||
        (itemHotelTotal === 0 && expHotel > 0 && itemLandTotal > 0));

    if (expTotalMatchesBooking && !contradictsItems && !hasUnclassifiedPositiveItem) {
      resolvedHotelTotal = hasExplicitHotel ? expHotel : Math.max(0, roundMoney(totalBookingAmount - expLand));
      resolvedLandTotal = hasExplicitLand ? expLand : Math.max(0, roundMoney(totalBookingAmount - resolvedHotelTotal));
      verified = true;
    } else if (items.length > 0 && !hasUnclassifiedPositiveItem) {
      // Fallback to active line items ONLY if line items themselves cleanly reconcile with totalBookingAmount
      const itemCombined = roundMoney(itemHotelTotal + itemLandTotal);
      const itemWithExtras = roundMoney(itemCombined + itemTaxTotal + itemFeeTotal - (deductDiscounts ? discountAmount : 0));
      const itemMatchesDirect = Math.abs(itemCombined - totalBookingAmount) <= tolerance;
      const itemMatchesWithExtras = Math.abs(itemWithExtras - totalBookingAmount) <= tolerance;

      if (itemMatchesDirect || itemMatchesWithExtras) {
        if (deductDiscounts && discountAmount > 0 && itemMatchesWithExtras) {
          const hotelShare = itemCombined > 0 ? itemHotelTotal / itemCombined : 0;
          const hotelDisc = roundMoney(discountAmount * hotelShare);
          const landDisc = roundMoney(discountAmount - hotelDisc);
          resolvedHotelTotal = Math.max(0, roundMoney(itemHotelTotal - hotelDisc));
          resolvedLandTotal = Math.max(0, roundMoney(itemLandTotal - landDisc));
        } else {
          resolvedHotelTotal = itemHotelTotal;
          resolvedLandTotal = itemLandTotal;
        }
        verified = true;
      } else {
        holdReason = `Booking total (${totalBookingAmount}) does not cleanly reconcile with authoritative Hotel (${expHotel}) + Land (${expLand}) or line items (${itemCombined}). Held for Admin review.`;
      }
    } else {
      holdReason = hasUnclassifiedPositiveItem
        ? 'Booking contains line item(s) missing authoritative category/productType classification. Held for Admin review.'
        : `Authoritative Hotel (${expHotel}) + Land (${expLand}) totals do not reconcile with booking total (${totalBookingAmount}). Held for Admin review.`;
    }
  } else if (items.length > 0) {
    // Case B: No explicit split on booking — derive and reconcile strictly from classified line items
    if (hasUnclassifiedPositiveItem) {
      return makeHeldResult(
        'Booking contains line item(s) missing authoritative category/productType classification. Held for Admin review.'
      );
    }

    const itemCombined = roundMoney(itemHotelTotal + itemLandTotal);
    const itemWithTaxesFeesDiscount = roundMoney(itemCombined + itemTaxTotal + itemFeeTotal - discountAmount);
    const itemWithSnapshotTaxesFees = roundMoney(itemCombined + taxAmount + serviceFeeAmount - discountAmount);
    const matchesDirect = Math.abs(itemCombined - totalBookingAmount) <= tolerance;
    const matchesItemExtras = Math.abs(itemWithTaxesFeesDiscount - totalBookingAmount) <= tolerance;
    const matchesSnapshotExtras = Math.abs(itemWithSnapshotTaxesFees - totalBookingAmount) <= tolerance;

    if (matchesDirect || matchesItemExtras || matchesSnapshotExtras) {
      const shouldDeductFromItems =
        deductDiscounts &&
        discountAmount > 0 &&
        ((matchesItemExtras && (itemTaxTotal > 0 || itemFeeTotal > 0 || !matchesDirect)) ||
          (matchesSnapshotExtras && (taxAmount > 0 || serviceFeeAmount > 0 || !matchesDirect)));
      if (shouldDeductFromItems) {
        const hotelShare = itemCombined > 0 ? itemHotelTotal / itemCombined : 0;
        const hotelDisc = roundMoney(discountAmount * hotelShare);
        const landDisc = roundMoney(discountAmount - hotelDisc);
        resolvedHotelTotal = Math.max(0, roundMoney(itemHotelTotal - hotelDisc));
        resolvedLandTotal = Math.max(0, roundMoney(itemLandTotal - landDisc));
      } else {
        resolvedHotelTotal = itemHotelTotal;
        resolvedLandTotal = itemLandTotal;
      }
      verified = true;
    } else {
      holdReason = `Booking total (${totalBookingAmount}) could not be reconciled against categorized line items (Hotel=${itemHotelTotal}, Land=${itemLandTotal}). Held for Admin review.`;
    }
  } else {
    // Case C: Missing both itemized breakdown and authoritative split -> NEVER default to totalBookingAmount
    holdReason =
      'Missing verifiable Land Part vs Hotel Accommodation breakdown (no line items or pricing snapshot split). Held for Admin review.';
  }

  if (!verified) {
    return makeHeldResult(holdReason || 'Unverifiable Land Part breakdown. Held for Admin review.');
  }

  // Strictly enforce Land-Part-Only base (taxes/fees excluded unless policy enables them AND they aren't hotel taxes)
  let eligible = resolvedLandTotal;
  const nonHotelShare = resolvedHotelTotal + resolvedLandTotal > 0 ? resolvedLandTotal / (resolvedHotelTotal + resolvedLandTotal) : 1;
  if (includeTaxes && itemTaxTotal > 0 && resolvedLandTotal > 0) {
    eligible = roundMoney(eligible + roundMoney(itemTaxTotal * nonHotelShare));
  }
  if (includeFees && itemFeeTotal > 0 && resolvedLandTotal > 0) {
    eligible = roundMoney(eligible + roundMoney(itemFeeTotal * nonHotelShare));
  }

  const eligibleAmount = roundMoney(Math.max(0, Math.min(totalBookingAmount > 0 ? totalBookingAmount : eligible, eligible)));

  return {
    totalBookingAmount,
    hotelAccommodationTotal: resolvedHotelTotal,
    landPartTotal: resolvedLandTotal,
    eligibleAmount,
    verificationStatus: 'VERIFIED',
    pricingSnapshotVersion,
    breakdown: {
      baseSellAmount: resolvedLandTotal,
      hotelAccommodationTotal: resolvedHotelTotal,
      landPartTotal: resolvedLandTotal,
      taxExcludedAmount: includeTaxes ? 0 : taxAmount,
      feeExcludedAmount: includeFees ? 0 : serviceFeeAmount,
      surchargeAmount,
      discountDeductedAmount: deductDiscounts ? discountAmount : 0,
      landPartLineItems,
      excludedAccommodationItems
    }
  };
}

export function isBookingPaymentSatisfiedForCashback(
  booking: Partial<Booking>,
  policy?: CashbackPolicyConfig
): boolean {
  if (!policy?.requireFullPaymentBeforeCredit) {
    return true;
  }
  const pStatus = String(booking.paymentStatus || '').toUpperCase();
  if (pStatus === 'PAID') return true;
  if (Array.isArray(booking.paymentProofs) && booking.paymentProofs.length > 0) {
    const paidSum = booking.paymentProofs
      .filter((p) => {
        const st = String((p as any).status || 'APPROVED').toUpperCase();
        return st === 'VERIFIED' || st === 'APPROVED';
      })
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    if (paidSum > 0 && paidSum >= (Number(booking.totalAmount) || 0) - 0.01) {
      return true;
    }
  }
  return false;
}

/**
 * Builds the immutable Booking Cashback Snapshot on booking creation / confirmation.
 * Enforces Land-Part-Only rule:
 * - Hotel Accommodation Total is ALWAYS excluded.
 * - Hotel-only bookings (verified landPartTotal === 0) record an explicit NOT_ELIGIBLE audit record with ₹0 cashback.
 * - Unverifiable / unreconciled breakdowns record a HELD (UNVERIFIED_HOLD) audit record with ₹0 pending/credited.
 */
export function buildInitialBookingCashbackRecord(params: {
  booking: Booking;
  userConfig: UserCashbackConfiguration | null | undefined;
  policy: CashbackPolicyConfig;
  bookingCreatedDateYmd?: string;
  nowIso?: string;
}): BookingCashbackRecord | null {
  const { booking, userConfig, policy } = params;
  const nowIso = params.nowIso || new Date().toISOString();
  const bookingCreatedDate = params.bookingCreatedDateYmd || normalizeDateYmd(booking.createdAt || nowIso);

  const eligibility = isConfigEligibleForBooking(userConfig, bookingCreatedDate);
  if (!eligibility.eligible || !userConfig) {
    return null;
  }

  const ownerUid = booking.submittedByUserId || booking.agentId || booking.userId;
  if (!ownerUid) return null;

  const statusUpper = String(booking.status || 'NEW').toUpperCase();
  if (statusUpper === 'CANCELLED') return null;

  const comp = calculateEligibleBookingComponents(booking, policy);
  const pct = roundPercent(userConfig.cashbackPercent);
  const destName = booking.destinationName || booking.destination || booking.items?.[0]?.destinationName;
  const sched = computeCreditSchedule(
    booking.travelEndDate || booking.travelStartDate || bookingCreatedDate,
    policy.creditDelayDays,
    destName,
    booking.serviceTimezone
  );
  const recordId = `cb-${booking.id}`;
  const currency = (booking.currency || policy.defaultCurrency || 'INR').toUpperCase();

  // Case 1: Breakdown could not be verified -> HELD for Admin review (never falls back to totalAmount)
  if (comp.verificationStatus === 'UNVERIFIED_HOLD') {
    return {
      id: recordId,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      userId: ownerUid,
      agencyId: booking.agencyId || userConfig.agencyId,
      agencyName: booking.agentAgencySnapshot || booking.agentAgency || booking.agencyName,
      userName: userConfig.userName || booking.agentName,
      userEmail: userConfig.userEmail,
      customerName: booking.customer?.leadTravelerName || booking.customer?.bookerName || 'Traveler',
      destinationName: destName,
      destinationTimezone: sched.destinationTimezone,
      travelStartDate: normalizeDateYmd(booking.travelStartDate),
      travelEndDate: sched.travelEndDateYmd,
      scheduledCreditDate: sched.scheduledCreditDate,
      scheduledCreditAtUtc: sched.scheduledCreditAtUtc,
      bookingCreatedDate,
      bookingTotalSnapshot: comp.totalBookingAmount,
      hotelAccommodationTotal: 0,
      landPartTotal: 0,
      eligibleAmount: 0,
      cashbackPercent: pct,
      cashbackAmount: 0,
      remainingCashbackAmount: 0,
      reversedAmount: 0,
      currency,
      configVersionSnapshot: userConfig.configVersion || 1,
      policyVersionSnapshot: policy.version || 1,
      pricingSnapshotVersion: comp.pricingSnapshotVersion,
      verificationStatus: 'UNVERIFIED_HOLD',
      calculatedAt: nowIso,
      componentBreakdown: comp.breakdown,
      status: 'HELD',
      isDisputed: false,
      holdReason: comp.holdReason || 'Unverified Land Part breakdown. Held for Admin review.',
      amendmentHistory: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }

  const cashbackAmount = roundMoney((comp.eligibleAmount * pct) / 100);

  // Case 2: Verified Hotel-only booking (landPartTotal === 0) -> explicit NOT_ELIGIBLE audit record with ₹0 cashback
  if (comp.eligibleAmount <= 0 || cashbackAmount <= 0) {
    if (comp.totalBookingAmount <= 0) return null;
    return {
      id: recordId,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      userId: ownerUid,
      agencyId: booking.agencyId || userConfig.agencyId,
      agencyName: booking.agentAgencySnapshot || booking.agentAgency || booking.agencyName,
      userName: userConfig.userName || booking.agentName,
      userEmail: userConfig.userEmail,
      customerName: booking.customer?.leadTravelerName || booking.customer?.bookerName || 'Traveler',
      destinationName: destName,
      destinationTimezone: sched.destinationTimezone,
      travelStartDate: normalizeDateYmd(booking.travelStartDate),
      travelEndDate: sched.travelEndDateYmd,
      scheduledCreditDate: sched.scheduledCreditDate,
      scheduledCreditAtUtc: sched.scheduledCreditAtUtc,
      bookingCreatedDate,
      bookingTotalSnapshot: comp.totalBookingAmount,
      hotelAccommodationTotal: comp.hotelAccommodationTotal,
      landPartTotal: 0,
      eligibleAmount: 0,
      cashbackPercent: pct,
      cashbackAmount: 0,
      remainingCashbackAmount: 0,
      reversedAmount: 0,
      currency,
      configVersionSnapshot: userConfig.configVersion || 1,
      policyVersionSnapshot: policy.version || 1,
      pricingSnapshotVersion: comp.pricingSnapshotVersion,
      verificationStatus: 'VERIFIED',
      calculatedAt: nowIso,
      componentBreakdown: comp.breakdown,
      status: 'NOT_ELIGIBLE',
      isDisputed: false,
      holdReason: 'Hotel-only booking: Hotel Accommodation Total is excluded from cashback (Land Part Total = 0).',
      amendmentHistory: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }

  const paymentOk = isBookingPaymentSatisfiedForCashback(booking, policy);

  return {
    id: recordId,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    userId: ownerUid,
    agencyId: booking.agencyId || userConfig.agencyId,
    agencyName: booking.agentAgencySnapshot || booking.agentAgency || booking.agencyName,
    userName: userConfig.userName || booking.agentName,
    userEmail: userConfig.userEmail,
    customerName: booking.customer?.leadTravelerName || booking.customer?.bookerName || 'Traveler',
    destinationName: destName,
    destinationTimezone: sched.destinationTimezone,
    travelStartDate: normalizeDateYmd(booking.travelStartDate),
    travelEndDate: sched.travelEndDateYmd,
    scheduledCreditDate: sched.scheduledCreditDate,
    scheduledCreditAtUtc: sched.scheduledCreditAtUtc,
    bookingCreatedDate,
    bookingTotalSnapshot: comp.totalBookingAmount,
    hotelAccommodationTotal: comp.hotelAccommodationTotal,
    landPartTotal: comp.landPartTotal,
    eligibleAmount: comp.eligibleAmount,
    cashbackPercent: pct,
    cashbackAmount,
    remainingCashbackAmount: cashbackAmount,
    reversedAmount: 0,
    currency,
    configVersionSnapshot: userConfig.configVersion || 1,
    policyVersionSnapshot: policy.version || 1,
    pricingSnapshotVersion: comp.pricingSnapshotVersion,
    verificationStatus: 'VERIFIED',
    calculatedAt: nowIso,
    componentBreakdown: comp.breakdown,
    status: paymentOk ? 'PENDING' : 'HELD',
    isDisputed: false,
    holdReason: paymentOk ? undefined : 'Waiting for booking payment verification before credit release.',
    amendmentHistory: [],
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

/**
 * Evaluates whether a booking cashback record is ready for automatic crediting at `nowIso`.
 */
export function evaluateDueForAutoCredit(params: {
  record: BookingCashbackRecord;
  booking?: Booking;
  policy: CashbackPolicyConfig;
  userConfig?: UserCashbackConfiguration | null;
  nowIso?: string;
}): {
  action: 'CREDIT' | 'WAIT' | 'HOLD' | 'CANCEL';
  reason: string;
} {
  const { record, booking, policy } = params;
  const nowIso = params.nowIso || new Date().toISOString();

  if (
    record.status === 'CREDITED' ||
    record.status === 'CANCELLED' ||
    record.status === 'REVERSED' ||
    record.status === 'NOT_ELIGIBLE'
  ) {
    return { action: 'WAIT', reason: `Non-pending/terminal state: ${record.status}` };
  }
  if (record.isDisputed) {
    return { action: 'HOLD', reason: record.holdReason || 'Booking is currently under dispute hold.' };
  }
  if (record.verificationStatus === 'UNVERIFIED_HOLD') {
    return { action: 'HOLD', reason: record.holdReason || 'Booking Land Part breakdown could not be verified. Held for Admin review.' };
  }
  if (Number(record.landPartTotal ?? record.eligibleAmount ?? 0) <= 0 || Number(record.remainingCashbackAmount ?? record.cashbackAmount ?? 0) <= 0) {
    return { action: 'WAIT', reason: 'Eligible Land Part Total / Cashback Amount is 0.' };
  }

  if (booking) {
    const bStatus = String(booking.status || '').toUpperCase();
    if (bStatus === 'CANCELLED') {
      return { action: 'CANCEL', reason: 'Associated booking was cancelled.' };
    }
    const payStatus = String(booking.paymentStatus || '').toUpperCase();
    if (payStatus === 'REFUNDED') {
      return { action: 'CANCEL', reason: 'Associated booking was fully refunded.' };
    }
    const liveComp = calculateEligibleBookingComponents(booking, policy);
    if (liveComp.verificationStatus === 'UNVERIFIED_HOLD') {
      return {
        action: 'HOLD',
        reason: liveComp.holdReason || 'Booking Land Part breakdown failed reconciliation check prior to auto-credit.'
      };
    }
    if (policy.requireConfirmedBookingStatus && !['CONFIRMED', 'COMPLETED'].includes(bStatus)) {
      return { action: 'WAIT', reason: `Booking status is ${bStatus}; awaiting confirmation.` };
    }
    if (!isBookingPaymentSatisfiedForCashback(booking, policy)) {
      if (new Date(nowIso).getTime() >= new Date(record.scheduledCreditAtUtc).getTime()) {
        return { action: 'HOLD', reason: 'Travel +3 days elapsed but full payment is not yet verified.' };
      }
      return { action: 'WAIT', reason: 'Awaiting payment verification and travel completion +3 days.' };
    }
  } else if (policy.requireFullPaymentBeforeCredit && record.status === 'HELD') {
    return { action: 'HOLD', reason: record.holdReason || 'Booking payment verification pending.' };
  }

  const nowMs = new Date(nowIso).getTime();
  const dueMs = new Date(record.scheduledCreditAtUtc).getTime();
  if (nowMs >= dueMs) {
    return {
      action: 'CREDIT',
      reason: `Destination credit boundary (${record.scheduledCreditDate} ${record.destinationTimezone}) reached.`
    };
  }

  return {
    action: 'WAIT',
    reason: `Scheduled credit on ${record.scheduledCreditDate} (${record.destinationTimezone}).`
  };
}

// =========================================================================
// BANK ACCOUNT VALIDATION & MASKING
// =========================================================================

export function maskAccountNumber(accountNumber: string): string {
  const clean = String(accountNumber || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!clean) return 'XXXXXX';
  const last4 = clean.slice(-4);
  const maskedLen = Math.max(4, clean.length - 4);
  return `${'X'.repeat(maskedLen)}${last4}`;
}

export function isValidIFSC(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(ifsc || '').trim().toUpperCase());
}

export interface BankAccountInput {
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  swiftCode?: string;
  iban?: string;
  country?: string;
  currency?: string;
}

export function validateBankAccountInput(input: BankAccountInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const holder = String(input.accountHolderName || '').trim();
  const bankName = String(input.bankName || '').trim();
  const acct = String(input.accountNumber || '').replace(/\s+/g, '');
  const ifsc = String(input.ifscCode || '').trim().toUpperCase();
  const swift = String(input.swiftCode || '').trim().toUpperCase();
  const iban = String(input.iban || '').trim().toUpperCase();
  const country = String(input.country || 'India').trim().toUpperCase();

  if (holder.length < 2) {
    errors.push('Account holder name is required.');
  }
  if (bankName.length < 2) {
    errors.push('Bank name is required.');
  }
  const isAlreadyMasked = /^X{4,}[a-zA-Z0-9]{4}$/.test(acct);
  if (!isAlreadyMasked && !/^[a-zA-Z0-9]{6,24}$/.test(acct)) {
    errors.push('Account number must be 6 to 24 alphanumeric characters.');
  }
  if (country === 'IN' || country === 'INDIA') {
    if (ifsc && !isValidIFSC(ifsc)) {
      errors.push('Invalid IFSC code (expected format e.g. HDFC0001234).');
    } else if (!ifsc && !swift && !iban) {
      errors.push('IFSC code (or SWIFT/IBAN) is required.');
    }
  } else if (!ifsc && !swift && !iban) {
    errors.push('IFSC, SWIFT, or IBAN routing identifier is required.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function sanitizeBankAccountForDisplay(acct: UserBankAccount): UserBankAccount {
  const { accountNumberStored: secret, ...safe } = acct;
  const masked = acct.accountNumberMasked || maskAccountNumber(secret || acct.accountNumberLast4 || '');
  const last4 = acct.accountNumberLast4 || masked.slice(-4);
  return {
    ...safe,
    accountNumberMasked: masked,
    accountNumberLast4: last4
  };
}

export function toMaskedBankSnapshot(acct: UserBankAccount): MaskedBankDetailsSnapshot {
  const safe = sanitizeBankAccountForDisplay(acct);
  return {
    id: safe.id,
    accountHolderName: safe.accountHolderName,
    bankName: safe.bankName,
    branchName: safe.branchName,
    accountNumberMasked: safe.accountNumberMasked,
    accountNumberLast4: safe.accountNumberLast4,
    accountType: safe.accountType,
    ifscCode: safe.ifscCode,
    swiftCode: safe.swiftCode,
    iban: safe.iban,
    country: safe.country,
    currency: safe.currency
  };
}

// =========================================================================
// WITHDRAWAL STATE MACHINE & LEDGER RECONCILIATION
// =========================================================================

export const ALLOWED_WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PROCESSING', 'PAID', 'REJECTED'],
  PROCESSING: ['PAID', 'REJECTED'],
  PAID: [],
  REJECTED: [],
  CANCELLED: []
};

export function canTransitionWithdrawalStatus(
  from: WithdrawalStatus,
  to: WithdrawalStatus
): boolean {
  return (ALLOWED_WITHDRAWAL_TRANSITIONS[from] || []).includes(to);
}

/**
 * Ledger-first authoritative wallet reconciliation.
 * Computes available, pending, held, credited, withdrawn, and reversed balances strictly from immutable ledger transactions.
 */
export function reconcileWalletFromLedger(params: {
  userId: string;
  defaultCurrency?: string;
  ledgerTransactions: CashbackLedgerTransaction[];
  bookingRecords: BookingCashbackRecord[];
  nowIso?: string;
}): CashbackWalletSummary {
  const { userId, ledgerTransactions = [], bookingRecords = [] } = params;
  const defaultCur = (params.defaultCurrency || 'INR').toUpperCase();
  const userTxs = [...ledgerTransactions]
    .filter((t) => t.userId === userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const userRecords = bookingRecords.filter((r) => r.userId === userId);
  const buckets: Record<string, CashbackCurrencyBucket> = {};

  const ensureBucket = (cur: string): CashbackCurrencyBucket => {
    const code = (cur || defaultCur).toUpperCase();
    if (!buckets[code]) {
      buckets[code] = {
        currency: code,
        availableBalance: 0,
        pendingBalance: 0,
        heldInWithdrawals: 0,
        totalCredited: 0,
        totalWithdrawn: 0,
        totalReversed: 0
      };
    }
    return buckets[code];
  };

  for (const tx of userTxs) {
    const b = ensureBucket(tx.currency || defaultCur);
    const amt = roundMoney(Math.max(0, Number(tx.amount) || 0));

    switch (tx.type) {
      case 'CASHBACK_CREDIT':
        b.availableBalance = roundMoney(b.availableBalance + amt);
        b.totalCredited = roundMoney(b.totalCredited + amt);
        break;
      case 'ADMIN_CREDIT_ADJUSTMENT':
        b.availableBalance = roundMoney(b.availableBalance + amt);
        b.totalCredited = roundMoney(b.totalCredited + amt);
        break;
      case 'WITHDRAWAL_HOLD':
        b.availableBalance = roundMoney(b.availableBalance - amt);
        b.heldInWithdrawals = roundMoney(b.heldInWithdrawals + amt);
        break;
      case 'WITHDRAWAL_RELEASE':
        b.availableBalance = roundMoney(b.availableBalance + amt);
        b.heldInWithdrawals = roundMoney(Math.max(0, b.heldInWithdrawals - amt));
        break;
      case 'WITHDRAWAL_DEBIT':
        b.heldInWithdrawals = roundMoney(Math.max(0, b.heldInWithdrawals - amt));
        b.totalWithdrawn = roundMoney(b.totalWithdrawn + amt);
        break;
      case 'ADMIN_DEBIT_ADJUSTMENT':
        b.availableBalance = roundMoney(b.availableBalance - amt);
        b.totalReversed = roundMoney(b.totalReversed + amt);
        break;
      case 'CASHBACK_REVERSAL':
        b.availableBalance = roundMoney(b.availableBalance - amt);
        b.totalReversed = roundMoney(b.totalReversed + amt);
        break;
    }
  }

  let heldCashback = 0;
  for (const rec of userRecords) {
    const b = ensureBucket(rec.currency || defaultCur);
    const remaining = roundMoney(Math.max(0, Number(rec.remainingCashbackAmount ?? rec.cashbackAmount ?? 0)));
    if (rec.status === 'PENDING') {
      b.pendingBalance = roundMoney(b.pendingBalance + remaining);
    } else if (rec.status === 'HELD') {
      b.pendingBalance = roundMoney(b.pendingBalance + remaining);
      heldCashback = roundMoney(heldCashback + remaining);
    }
  }

  const bucketKeys = Object.keys(buckets);
  const primaryCurrency =
    (buckets[defaultCur] ? defaultCur : undefined) ||
    (userTxs.length > 0 ? userTxs[userTxs.length - 1].currency : undefined) ||
    (userRecords.length > 0 ? userRecords[0].currency : undefined) ||
    bucketKeys[0] ||
    defaultCur;

  const primary = ensureBucket(primaryCurrency);
  const ts = params.nowIso || new Date().toISOString();

  return {
    id: userId,
    userId,
    primaryCurrency,
    availableBalance: primary.availableBalance,
    pendingCashback: primary.pendingBalance,
    heldCashback,
    withdrawalPendingBalance: primary.heldInWithdrawals,
    totalCredited: primary.totalCredited,
    totalWithdrawn: primary.totalWithdrawn,
    totalReversed: primary.totalReversed,
    balancesByCurrency: buckets,
    lastReconciledAt: ts,
    updatedAt: ts
  };
}
