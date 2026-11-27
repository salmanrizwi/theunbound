import {
  Booking,
  BookingItem,
  ConsolidatedAllocationItemDistribution,
  ConsolidatedPriceAllocationMethod,
  CurrencyCode,
  Hotel,
  Product,
  Supplier,
  SupplierAllocationRecord,
  SupplierAllocationStatus,
  SupplierCategory
} from '../types';

// ============================================================================
// DECIMAL-SAFE CURRENCY ARITHMETIC & MARGIN ENGINE
// ============================================================================

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export interface MarginMetrics {
  netPrice: number;
  sellingOrCommercialPrice: number;
  marginAmount: number;
  /** (Margin Amount / Net Price) * 100; null when netPrice <= 0 to prevent division by zero */
  marginPercent: number | null;
}

/**
 * Authoritative Margin Calculation:
 *   Margin Amount = Selling/Commercial Price - Net Price
 *   Margin Percentage = (Margin Amount / Net Price) * 100  (null if Net Price <= 0)
 */
export function calculateMarginMetrics(
  netPrice: number,
  sellingOrCommercialPrice: number
): MarginMetrics {
  const safeNet = roundCurrency(Math.max(0, Number.isFinite(netPrice) ? netPrice : 0));
  const safePrice = roundCurrency(Math.max(0, Number.isFinite(sellingOrCommercialPrice) ? sellingOrCommercialPrice : 0));
  const marginAmount = roundCurrency(safePrice - safeNet);
  const marginPercent = safeNet > 0 ? roundCurrency((marginAmount / safeNet) * 100) : null;

  return {
    netPrice: safeNet,
    sellingOrCommercialPrice: safePrice,
    marginAmount,
    marginPercent
  };
}

export interface ServiceItemFinancials {
  netPrice: number;
  sellingPrice: number;
  marginAmount: number;
  marginPercent: number | null;
  allocatedCommercialPrice?: number;
  allocatedCommercialMarginAmount?: number;
  allocatedCommercialMarginPercent?: number | null;
  currency: CurrencyCode;
  netCurrency: CurrencyCode;
  hasCurrencyMismatch: boolean;
  hasNetPrice: boolean;
  hasSellingPrice: boolean;
  isLegacyMissingNet: boolean;
}

/**
 * Resolves authoritative Net Price, Selling Price, and Margin for an individual Service Item.
 * - Preserves approved quotation/booking selling price without overwriting it.
 * - Maps existing supplier/net fields cleanly without creating competing sources of truth.
 */
export function resolveServiceItemFinancials(
  item: BookingItem,
  booking?: Booking | null,
  productRecord?: Product | null,
  hotelRecord?: Hotel | null
): ServiceItemFinancials {
  const bookingCurrency = (item.currency || booking?.currency || 'USD') as CurrencyCode;

  // Authoritative Selling Price (never silently recalculates/overwrites approved booking/quote totalPrice)
  const rawSelling =
    typeof item.sellingPrice === 'number' && item.sellingPrice >= 0
      ? item.sellingPrice
      : typeof item.totalPrice === 'number' && item.totalPrice >= 0
      ? item.totalPrice
      : typeof item.unitSellingPrice === 'number' && item.unitSellingPrice > 0
      ? roundCurrency(item.unitSellingPrice * Math.max(1, item.totalPax || 1))
      : 0;
  const sellingPrice = roundCurrency(rawSelling);
  const hasSellingPrice = sellingPrice > 0;

  // Authoritative Net Price (internal supplier/product cost)
  let rawNet = 0;
  let hasNetPrice = false;
  let netCurrency: CurrencyCode = (item.supplierCurrency || bookingCurrency) as CurrencyCode;

  if (typeof item.netPrice === 'number' && item.netPrice > 0) {
    rawNet = item.netPrice;
    hasNetPrice = true;
  } else if (typeof item.supplierTotalCost === 'number' && item.supplierTotalCost > 0) {
    rawNet = item.supplierTotalCost;
    hasNetPrice = true;
  } else if (typeof item.supplierPrice === 'number' && item.supplierPrice > 0) {
    const paxCount = Math.max(1, item.totalPax || (item.adults || 0) + (item.children || 0) || 1);
    rawNet =
      item.supplierPriceType === 'Per Person'
        ? roundCurrency(item.supplierPrice * paxCount)
        : item.supplierPrice;
    hasNetPrice = true;
  } else if (typeof item.unitNetPrice === 'number' && item.unitNetPrice > 0) {
    // unitNetPrice in quote-to-booking conversion often already stores totalNetCost for the item;
    // preserve it directly if it's <= sellingPrice (or no sellingPrice), never inflate arbitrarily
    rawNet = item.unitNetPrice;
    hasNetPrice = true;
  } else if (productRecord) {
    const adults = Math.max(0, item.adults ?? 0);
    const children = Math.max(0, item.children ?? 0);
    const infants = Math.max(0, item.infants ?? 0);
    const adultNet = Number(productRecord.adultNetPrice ?? productRecord.adultNettCost ?? 0);
    const childNet = Number(productRecord.childNetPrice ?? productRecord.childNettCost ?? 0);
    const infantNet = Number(productRecord.infantNetPrice ?? productRecord.infantNettCost ?? 0);
    const computedFromProduct =
      adults + children + infants > 0
        ? adultNet * adults + childNet * children + infantNet * infants
        : adultNet * Math.max(1, item.totalPax || 1);
    if (computedFromProduct > 0) {
      rawNet = roundCurrency(computedFromProduct);
      netCurrency = (productRecord.currency || bookingCurrency) as CurrencyCode;
      hasNetPrice = true;
    }
  } else if (hotelRecord && hotelRecord.startingNetPrice > 0) {
    rawNet = roundCurrency(hotelRecord.startingNetPrice);
    netCurrency = (hotelRecord.currency || bookingCurrency) as CurrencyCode;
    hasNetPrice = true;
  }

  const netPrice = roundCurrency(rawNet);
  const metrics = calculateMarginMetrics(netPrice, sellingPrice);

  let allocatedCommercialMarginAmount: number | undefined;
  let allocatedCommercialMarginPercent: number | null | undefined;
  if (typeof item.allocatedCommercialPrice === 'number' && item.allocatedCommercialPrice >= 0) {
    const commMetrics = calculateMarginMetrics(netPrice, item.allocatedCommercialPrice);
    allocatedCommercialMarginAmount = commMetrics.marginAmount;
    allocatedCommercialMarginPercent = commMetrics.marginPercent;
  }

  return {
    netPrice,
    sellingPrice,
    marginAmount: metrics.marginAmount,
    marginPercent: metrics.marginPercent,
    allocatedCommercialPrice: item.allocatedCommercialPrice,
    allocatedCommercialMarginAmount,
    allocatedCommercialMarginPercent,
    currency: bookingCurrency,
    netCurrency,
    hasCurrencyMismatch: Boolean(hasNetPrice && netCurrency !== bookingCurrency),
    hasNetPrice,
    hasSellingPrice,
    isLegacyMissingNet: !hasNetPrice
  };
}

// ============================================================================
// AUTHORITATIVE PRODUCT / HOTEL CATEGORY IDENTITY & FILTERING
// ============================================================================

export type CanonicalCategoryId =
  | 'ACTIVITY'
  | 'TOUR'
  | 'TRANSFER'
  | 'RAIL'
  | 'GUIDE'
  | 'VISA'
  | 'HOTEL'
  | 'YACHT'
  | 'FERRY'
  | 'RESTAURANT'
  | 'PACKAGE'
  | 'OTHER';

export interface CanonicalCategoryDescriptor {
  id: CanonicalCategoryId;
  label: string;
  shortLabel: string;
}

export const CANONICAL_SERVICE_CATEGORIES: CanonicalCategoryDescriptor[] = [
  { id: 'ACTIVITY', label: 'Activity', shortLabel: 'Activity' },
  { id: 'TOUR', label: 'Tour', shortLabel: 'Tour' },
  { id: 'TRANSFER', label: 'Transfer', shortLabel: 'Transfer' },
  { id: 'RAIL', label: 'Rail', shortLabel: 'Rail' },
  { id: 'GUIDE', label: 'Guide', shortLabel: 'Guide' },
  { id: 'VISA', label: 'Visa', shortLabel: 'Visa' },
  { id: 'HOTEL', label: 'Hotel / Accommodation', shortLabel: 'Hotel' },
  { id: 'YACHT', label: 'Private Yacht', shortLabel: 'Yacht' },
  { id: 'FERRY', label: 'Ferry', shortLabel: 'Ferry' },
  { id: 'RESTAURANT', label: 'Meals & Dining', shortLabel: 'Dining' },
  { id: 'PACKAGE', label: 'Package', shortLabel: 'Package' },
  { id: 'OTHER', label: 'Other Travel Service', shortLabel: 'Other' }
];

const CATEGORY_LABEL_MAP = new Map<CanonicalCategoryId, string>(
  CANONICAL_SERVICE_CATEGORIES.map(c => [c.id, c.label])
);

export function normalizeRawCategoryToCanonicalId(raw?: string | null): CanonicalCategoryId {
  const val = String(raw || '').trim().toLowerCase();
  if (!val) return 'OTHER';

  // Exact canonical codes first
  if (val === 'hotel' || val === 'hotels' || val === 'accommodation' || val === 'stay' || val === 'lodging' || val === 'ryokan' || val === 'resort') {
    return 'HOTEL';
  }
  if (val === 'activity' || val === 'activities' || val === 'ticket' || val === 'tickets' || val === 'attraction' || val === 'attractions' || val === 'experience' || val === 'experiences' || val === 'activity/experience') {
    return 'ACTIVITY';
  }
  if (val === 'tour' || val === 'tours' || val === 'private tours' || val === 'group tours' || val === 'guided tour' || val === 'day trips' || val === 'day tour' || val === 'sightseeing' || val === 'excursion' || val === 'excursions') {
    return 'TOUR';
  }
  if (val === 'transfer' || val === 'transfers' || val === 'private transfer' || val === 'transport' || val === 'airport transfer' || val === 'chauffeur' || val === 'chauffeur driven' || val === 'car rental' || val === 'vehicle') {
    return 'TRANSFER';
  }
  if (val === 'rail' || val === 'rail / shinkansen' || val === 'shinkansen' || val === 'train' || val === 'rail ticket' || val === 'jr pass') {
    return 'RAIL';
  }
  if (val === 'guide' || val === 'guides' || val === 'guide service' || val === 'licensed guide') {
    return 'GUIDE';
  }
  if (val === 'visa' || val === 'visa & ancillary services' || val === 'visa assistance' || val === 'visa service' || val === 'ancillary' || val === 'concierge') {
    return 'VISA';
  }
  if (val === 'yacht' || val === 'private yacht' || val === 'private yacht charter' || val === 'cruise') {
    return 'YACHT';
  }
  if (val === 'ferry' || val === 'ferries' || val === 'boat') {
    return 'FERRY';
  }
  if (val === 'meal' || val === 'meals' || val === 'dining' || val === 'restaurant' || val === 'lunch / dinner restaurant') {
    return 'RESTAURANT';
  }
  if (val === 'package' || val === 'packages' || val === 'ready made package') {
    return 'PACKAGE';
  }

  // Substring checks strictly against category strings (never product names or supplier names)
  if (val.includes('hotel') || val.includes('accommodat') || val.includes('lodging') || val.includes('ryokan')) return 'HOTEL';
  if (val.includes('rail') || val.includes('shinkansen') || val.includes('train')) return 'RAIL';
  if (val.includes('yacht') || val.includes('cruise')) return 'YACHT';
  if (val.includes('ferr')) return 'FERRY';
  if (val.includes('visa') || val.includes('ancillary')) return 'VISA';
  if (val.includes('guide')) return 'GUIDE';
  if (val.includes('transfer') || val.includes('transport') || val.includes('chauffeur')) return 'TRANSFER';
  if (val.includes('restaurant') || val.includes('meal') || val.includes('dining')) return 'RESTAURANT';
  if (val.includes('package')) return 'PACKAGE';
  if (val.includes('tour') || val.includes('sightseeing') || val.includes('day trip')) return 'TOUR';
  if (val.includes('activit') || val.includes('ticket') || val.includes('experience') || val.includes('excursion')) return 'ACTIVITY';

  return 'OTHER';
}

export interface ResolvedCategoryIdentity {
  categoryId: CanonicalCategoryId;
  categoryLabel: string;
  sourceCategoryLabel: string;
  source: 'HOTEL_MANAGEMENT' | 'PRODUCT_MANAGEMENT' | 'SERVICE_ITEM_SNAPSHOT';
}

/**
 * Resolves stable Category ID and display label strictly from authoritative Hotel Management
 * or Product Management records (via stable IDs), falling back to preserved item snapshot.
 * Never derives category from product names or supplier names.
 */
export function resolveAuthoritativeCategory(
  item: BookingItem,
  productRecord?: Product | null,
  hotelRecord?: Hotel | null
): ResolvedCategoryIdentity {
  // 1. Separate Hotel Management Architecture takes precedence for hotel records
  if (hotelRecord || item.hotelId || item.isHotel || item.isManualHotel || item.manualHotelDetails || item.serviceHotelDetails) {
    const rawLabel = hotelRecord?.category || item.sourceCategoryLabel || 'Hotels';
    return {
      categoryId: 'HOTEL',
      categoryLabel: CATEGORY_LABEL_MAP.get('HOTEL') || 'Hotel / Accommodation',
      sourceCategoryLabel: rawLabel,
      source: 'HOTEL_MANAGEMENT'
    };
  }

  // 2. Authoritative Product Management record via stable productId
  if (productRecord && productRecord.category) {
    const id = normalizeRawCategoryToCanonicalId(productRecord.category);
    return {
      categoryId: id,
      categoryLabel: CATEGORY_LABEL_MAP.get(id) || productRecord.category,
      sourceCategoryLabel: productRecord.category,
      source: 'PRODUCT_MANAGEMENT'
    };
  }

  // 3. Preserved Service Item category snapshot (categoryId -> category -> productType -> service_type)
  if (item.categoryId) {
    const id = normalizeRawCategoryToCanonicalId(item.categoryId);
    return {
      categoryId: id,
      categoryLabel: CATEGORY_LABEL_MAP.get(id) || item.sourceCategoryLabel || item.category || 'Other Travel Service',
      sourceCategoryLabel: item.sourceCategoryLabel || item.category || CATEGORY_LABEL_MAP.get(id) || 'Other',
      source: 'SERVICE_ITEM_SNAPSHOT'
    };
  }

  const rawSnap = item.sourceCategoryLabel || item.category || item.productType || item.service_type || '';
  const id = normalizeRawCategoryToCanonicalId(rawSnap);
  return {
    categoryId: id,
    categoryLabel: CATEGORY_LABEL_MAP.get(id) || rawSnap || 'Other Travel Service',
    sourceCategoryLabel: rawSnap || CATEGORY_LABEL_MAP.get(id) || 'Other',
    source: 'SERVICE_ITEM_SNAPSHOT'
  };
}

export function matchesCategoryFilter(
  item: BookingItem,
  selectedCategoryId: string,
  productRecord?: Product | null,
  hotelRecord?: Hotel | null
): boolean {
  if (!selectedCategoryId || selectedCategoryId === 'ALL') return true;
  const resolved = resolveAuthoritativeCategory(item, productRecord, hotelRecord);
  const targetCanonical = normalizeRawCategoryToCanonicalId(selectedCategoryId);
  return resolved.categoryId === targetCanonical;
}

export interface CategoryFilterOption {
  id: CanonicalCategoryId;
  label: string;
  count: number;
}

export function buildConfiguredCategoryFilterOptions(
  items: BookingItem[],
  productMap?: Map<string, Product>,
  hotelMap?: Map<string, Hotel>
): CategoryFilterOption[] {
  const counts = new Map<CanonicalCategoryId, number>();
  CANONICAL_SERVICE_CATEGORIES.forEach(c => counts.set(c.id, 0));

  for (const item of items) {
    const prod = item.productId && productMap ? productMap.get(item.productId) || null : null;
    const hotel = (item.hotelId || item.productId) && hotelMap
      ? hotelMap.get(item.hotelId || item.productId) || null
      : null;
    const resolved = resolveAuthoritativeCategory(item, prod, hotel);
    counts.set(resolved.categoryId, (counts.get(resolved.categoryId) || 0) + 1);
  }

  return CANONICAL_SERVICE_CATEGORIES.map(c => ({
    id: c.id,
    label: c.label,
    count: counts.get(c.id) || 0
  }));
}

// ============================================================================
// SUPPLIER-CATEGORY ELIGIBILITY VALIDATION
// ============================================================================

const CATEGORY_TO_ELIGIBLE_SUPPLIER_CATEGORIES: Record<CanonicalCategoryId, SupplierCategory[]> = {
  ACTIVITY: ['ACTIVITY', 'SIGHTSEEING', 'TOUR', 'EVENT', 'DMC_GROUND'],
  TOUR: ['TOUR', 'SIGHTSEEING', 'ACTIVITY', 'DMC_GROUND'],
  TRANSFER: ['TRANSFER', 'TRANSPORT', 'DMC_GROUND'],
  RAIL: ['RAIL', 'TRANSPORT', 'DMC_GROUND'],
  GUIDE: ['GUIDE', 'TOUR', 'SIGHTSEEING', 'DMC_GROUND'],
  VISA: ['VISA', 'INSURANCE', 'ESIM', 'DMC_GROUND'],
  HOTEL: ['HOTEL', 'DMC_GROUND'],
  YACHT: ['YACHT', 'CRUISE', 'ACTIVITY', 'DMC_GROUND'],
  FERRY: ['CRUISE', 'TRANSPORT', 'TRANSFER', 'DMC_GROUND'],
  RESTAURANT: ['RESTAURANT', 'DMC_GROUND'],
  PACKAGE: ['TOUR', 'ACTIVITY', 'SIGHTSEEING', 'DMC_GROUND'],
  OTHER: ['OTHER', 'DMC_GROUND', 'ACTIVITY', 'TOUR', 'TRANSFER', 'TRANSPORT']
};

export function normalizeSupplierCategoryToken(raw: string): SupplierCategory {
  const v = String(raw || '').trim().toUpperCase().replace(/[\s/-]+/g, '_');
  if (v.includes('DMC') || v.includes('GROUND')) return 'DMC_GROUND';
  if (v.includes('HOTEL') || v.includes('ACCOMMODATION') || v.includes('LODG')) return 'HOTEL';
  if (v.includes('TRANSFER')) return 'TRANSFER';
  if (v.includes('TRANSPORT') || v.includes('CHAUFFEUR') || v.includes('VEHICLE')) return 'TRANSPORT';
  if (v.includes('RAIL') || v.includes('SHINKANSEN') || v.includes('TRAIN')) return 'RAIL';
  if (v.includes('GUIDE')) return 'GUIDE';
  if (v.includes('VISA')) return 'VISA';
  if (v.includes('YACHT')) return 'YACHT';
  if (v.includes('CRUISE') || v.includes('FERR')) return 'CRUISE';
  if (v.includes('RESTAURANT') || v.includes('DINING') || v.includes('MEAL')) return 'RESTAURANT';
  if (v.includes('SIGHTSEEING')) return 'SIGHTSEEING';
  if (v.includes('TOUR')) return 'TOUR';
  if (v.includes('ACTIVIT') || v.includes('TICKET') || v.includes('EXPERIENCE')) return 'ACTIVITY';
  if (v.includes('EVENT')) return 'EVENT';
  if (v.includes('FLIGHT')) return 'FLIGHT';
  if (v.includes('INSURANCE')) return 'INSURANCE';
  if (v.includes('ESIM')) return 'ESIM';
  return 'OTHER';
}

export function getSupplierNormalizedCategories(supplier: Supplier): Set<SupplierCategory> {
  const set = new Set<SupplierCategory>();
  (supplier.categories || []).forEach(c => set.add(normalizeSupplierCategoryToken(String(c))));
  (supplier.serviceCoverage?.supportedCategories || []).forEach(c => set.add(normalizeSupplierCategoryToken(String(c))));
  (supplier.serviceCoverage?.serviceCategories || []).forEach(c => set.add(normalizeSupplierCategoryToken(String(c))));
  if (supplier.supplierType) {
    set.add(normalizeSupplierCategoryToken(supplier.supplierType));
  }
  return set;
}

export interface SupplierEligibilityIssue {
  serviceItemId: string;
  productName: string;
  categoryId: CanonicalCategoryId;
  categoryLabel: string;
  requiredSupplierCategories: SupplierCategory[];
  reason: string;
}

export interface SupplierEligibilityResult {
  eligible: boolean;
  supplierCategories: SupplierCategory[];
  incompatibleItems: SupplierEligibilityIssue[];
  warnings: string[];
}

export function validateSupplierEligibilityForItems(
  supplier: Supplier | null | undefined,
  items: BookingItem[],
  productMap?: Map<string, Product>,
  hotelMap?: Map<string, Hotel>
): SupplierEligibilityResult {
  if (!supplier) {
    return {
      eligible: false,
      supplierCategories: [],
      incompatibleItems: [],
      warnings: ['Please select an active supplier from the Supplier Management database.']
    };
  }

  const warnings: string[] = [];
  if (supplier.status && supplier.status !== 'ACTIVE') {
    warnings.push(`Supplier "${supplier.name}" is currently "${supplier.status}" and cannot receive new allocations.`);
    return {
      eligible: false,
      supplierCategories: Array.from(getSupplierNormalizedCategories(supplier)),
      incompatibleItems: [],
      warnings
    };
  }

  const supplierCats = getSupplierNormalizedCategories(supplier);
  const incompatibleItems: SupplierEligibilityIssue[] = [];

  for (const item of items) {
    const prod = item.productId && productMap ? productMap.get(item.productId) || null : null;
    const hotel = (item.hotelId || item.productId) && hotelMap
      ? hotelMap.get(item.hotelId || item.productId) || null
      : null;
    const resolvedCat = resolveAuthoritativeCategory(item, prod, hotel);
    const allowedSupplierCats = CATEGORY_TO_ELIGIBLE_SUPPLIER_CATEGORIES[resolvedCat.categoryId] || ['DMC_GROUND', 'OTHER'];

    const isEligibleForItem = allowedSupplierCats.some(reqCat => supplierCats.has(reqCat));
    if (!isEligibleForItem) {
      const reason = `Supplier "${supplier.name}" (${Array.from(supplierCats).join(', ') || 'No Categories'}) is not eligible for "${item.productName}" (${resolvedCat.categoryLabel}). Required: ${allowedSupplierCats.join(' / ')}.`;
      incompatibleItems.push({
        serviceItemId: item.id,
        productName: item.productName,
        categoryId: resolvedCat.categoryId,
        categoryLabel: resolvedCat.categoryLabel,
        requiredSupplierCategories: allowedSupplierCats,
        reason
      });
      warnings.push(reason);
    }
  }

  return {
    eligible: incompatibleItems.length === 0 && warnings.length === 0,
    supplierCategories: Array.from(supplierCats),
    incompatibleItems,
    warnings
  };
}

// ============================================================================
// CONSOLIDATED CURRENCY VALIDATION & EXACT PRICE DISTRIBUTION
// ============================================================================

export interface ConsolidatedCurrencyValidation {
  valid: boolean;
  currency: CurrencyCode;
  detectedCurrencies: CurrencyCode[];
  error?: string;
}

/**
 * Ensures all selected items share an identical currency before consolidated pricing.
 * Never assumes an exchange rate of 1 when currencies differ.
 */
export function validateConsolidatedCurrency(
  items: BookingItem[],
  booking?: Booking | null,
  productMap?: Map<string, Product>,
  hotelMap?: Map<string, Hotel>,
  authorizedCommonCurrency?: CurrencyCode,
  authorizedFxRates?: Record<string, number>
): ConsolidatedCurrencyValidation {
  const detectedSet = new Set<CurrencyCode>();

  for (const item of items) {
    const prod = item.productId && productMap ? productMap.get(item.productId) || null : null;
    const hotel = (item.hotelId || item.productId) && hotelMap
      ? hotelMap.get(item.hotelId || item.productId) || null
      : null;
    const fin = resolveServiceItemFinancials(item, booking, prod, hotel);
    detectedSet.add(fin.hasNetPrice ? fin.netCurrency : fin.currency);
  }

  const detectedCurrencies = Array.from(detectedSet);
  const fallbackCurrency = (authorizedCommonCurrency || detectedCurrencies[0] || booking?.currency || 'USD') as CurrencyCode;

  if (detectedCurrencies.length > 1) {
    // Allow ONLY if an explicit authorized common currency + valid positive FX conversion rate is supplied for every non-matching currency
    const hasCompleteFxBasis = Boolean(
      authorizedCommonCurrency &&
      authorizedFxRates &&
      detectedCurrencies.every(cur =>
        cur === authorizedCommonCurrency ||
        (typeof authorizedFxRates[`${cur}_${authorizedCommonCurrency}`] === 'number' &&
          authorizedFxRates[`${cur}_${authorizedCommonCurrency}`] > 0)
      )
    );

    if (!hasCompleteFxBasis) {
      return {
        valid: false,
        currency: fallbackCurrency,
        detectedCurrencies,
        error: `Currency mismatch detected across selected Service Items (${detectedCurrencies.join(', ')}). Establish an authorised common currency and FX conversion rate before consolidated pricing.`
      };
    }

    return {
      valid: true,
      currency: authorizedCommonCurrency!,
      detectedCurrencies
    };
  }

  return {
    valid: true,
    currency: detectedCurrencies[0] || fallbackCurrency,
    detectedCurrencies
  };
}

export interface DistributeConsolidatedPriceInput {
  items: BookingItem[];
  booking?: Booking | null;
  productMap?: Map<string, Product>;
  hotelMap?: Map<string, Hotel>;
  consolidatedCommercialPrice: number;
  allocationMethod: ConsolidatedPriceAllocationMethod;
  manualAllocations?: Record<string, number>;
  authorizedCommonCurrency?: CurrencyCode;
  authorizedFxRates?: Record<string, number>;
}

export interface ConsolidatedDistributionResult {
  valid: boolean;
  errors: string[];
  currency: CurrencyCode;
  allocationMethod: ConsolidatedPriceAllocationMethod;
  totalNetCost: number;
  totalSellingPrice: number;
  consolidatedCommercialPrice: number;
  totalMarginAmount: number;
  totalMarginPercent: number | null;
  reconciliationDelta: number;
  itemAllocations: ConsolidatedAllocationItemDistribution[];
}

/**
 * Decimal-safe distribution of a Consolidated Supplier Commercial Price across N Service Items.
 * Supports ONLY two explicit methods:
 *   1. PROPORTIONAL_NET_COST: Individual = Consolidated * (Individual Net / Total Net) with cent-exact largest-remainder reconciliation.
 *   2. MANUAL: Admin specifies each individual amount; sum must reconcile exactly (0.00 delta) with consolidated price.
 */
export function distributeConsolidatedCommercialPrice(
  input: DistributeConsolidatedPriceInput
): ConsolidatedDistributionResult {
  const {
    items,
    booking,
    productMap,
    hotelMap,
    consolidatedCommercialPrice,
    allocationMethod,
    manualAllocations,
    authorizedCommonCurrency,
    authorizedFxRates
  } = input;

  const errors: string[] = [];
  const currCheck = validateConsolidatedCurrency(
    items,
    booking,
    productMap,
    hotelMap,
    authorizedCommonCurrency,
    authorizedFxRates
  );

  if (items.length === 0) {
    errors.push('At least one Service Item must be selected for consolidated allocation.');
  }

  if (!currCheck.valid && currCheck.error) {
    errors.push(currCheck.error);
  }

  if (!Number.isFinite(consolidatedCommercialPrice) || consolidatedCommercialPrice < 0) {
    errors.push('Consolidated Supplier Commercial Price must be a valid non-negative amount.');
  }

  if (allocationMethod !== 'PROPORTIONAL_NET_COST' && allocationMethod !== 'MANUAL') {
    errors.push('Unsupported allocation method. Select Proportional (by Net Cost) or Manual allocation.');
  }

  const targetCurrency = currCheck.currency;
  const normalizedTargetCents = toCents(Math.max(0, Number.isFinite(consolidatedCommercialPrice) ? consolidatedCommercialPrice : 0));
  const normalizedConsolidatedPrice = fromCents(normalizedTargetCents);

  // Resolve each item's net cost (converting via explicit FX rate only if authorized) & selling price
  const prepared = items.map(item => {
    const prod = item.productId && productMap ? productMap.get(item.productId) || null : null;
    const hotel = (item.hotelId || item.productId) && hotelMap
      ? hotelMap.get(item.hotelId || item.productId) || null
      : null;
    const fin = resolveServiceItemFinancials(item, booking, prod, hotel);
    const cat = resolveAuthoritativeCategory(item, prod, hotel);

    let effectiveNet = fin.netPrice;
    if (fin.hasNetPrice && fin.netCurrency !== targetCurrency && authorizedFxRates) {
      const rate = authorizedFxRates[`${fin.netCurrency}_${targetCurrency}`];
      if (rate && rate > 0) {
        effectiveNet = roundCurrency(fin.netPrice * rate);
      }
    }

    return {
      item,
      cat,
      netCost: roundCurrency(effectiveNet),
      netCostCents: toCents(effectiveNet),
      sellingPrice: fin.sellingPrice
    };
  });

  const totalNetCents = prepared.reduce((acc, p) => acc + p.netCostCents, 0);
  const totalNetCost = fromCents(totalNetCents);
  const totalSellingPrice = roundCurrency(prepared.reduce((acc, p) => acc + p.sellingPrice, 0));

  const allocatedCentsByItem = new Map<string, number>();

  if (allocationMethod === 'PROPORTIONAL_NET_COST') {
    if (totalNetCents <= 0) {
      errors.push('Proportional allocation requires a positive Total Net Cost (> 0). Enter Net Prices on selected items or choose Manual allocation.');
      prepared.forEach(p => allocatedCentsByItem.set(p.item.id, 0));
    } else {
      // Exact largest-remainder method in integer cents so sum(allocated) === consolidatedCommercialPrice strictly
      const exactShares = prepared.map((p, idx) => {
        const exactCents = (normalizedTargetCents * p.netCostCents) / totalNetCents;
        const floorCents = Math.floor(exactCents);
        const remainder = exactCents - floorCents;
        return { id: p.item.id, idx, floorCents, remainder };
      });

      let distributedCents = exactShares.reduce((sum, s) => sum + s.floorCents, 0);
      let remainingCents = normalizedTargetCents - distributedCents;

      // Sort by largest fractional remainder descending, breaking ties deterministically by original index
      const byRemainder = [...exactShares].sort((a, b) => {
        if (Math.abs(b.remainder - a.remainder) > 1e-12) return b.remainder - a.remainder;
        return a.idx - b.idx;
      });

      let cursor = 0;
      while (remainingCents > 0 && byRemainder.length > 0) {
        byRemainder[cursor % byRemainder.length].floorCents += 1;
        remainingCents -= 1;
        cursor += 1;
      }

      exactShares.forEach(s => allocatedCentsByItem.set(s.id, s.floorCents));
    }
  } else if (allocationMethod === 'MANUAL') {
    let manualSumCents = 0;
    for (const p of prepared) {
      const rawVal = manualAllocations?.[p.item.id];
      if (rawVal === undefined || rawVal === null || !Number.isFinite(Number(rawVal)) || Number(rawVal) < 0) {
        errors.push(`Manual allocated commercial price for "${p.item.productName}" must be a valid non-negative number.`);
        allocatedCentsByItem.set(p.item.id, 0);
      } else {
        const c = toCents(Number(rawVal));
        allocatedCentsByItem.set(p.item.id, c);
        manualSumCents += c;
      }
    }

    if (manualSumCents !== normalizedTargetCents) {
      const delta = fromCents(normalizedTargetCents - manualSumCents);
      errors.push(
        `Manual allocation total (${fromCents(manualSumCents).toFixed(2)} ${targetCurrency}) must equal the Consolidated Supplier Commercial Price (${normalizedConsolidatedPrice.toFixed(2)} ${targetCurrency}). Variance: ${delta.toFixed(2)} ${targetCurrency}.`
      );
    }
  }

  const itemAllocations: ConsolidatedAllocationItemDistribution[] = prepared.map(p => {
    const allocatedPrice = fromCents(allocatedCentsByItem.get(p.item.id) || 0);
    const m = calculateMarginMetrics(p.netCost, allocatedPrice);
    return {
      serviceItemId: p.item.id,
      productId: p.item.productId,
      productName: p.item.productName,
      categoryId: p.cat.categoryId,
      categoryLabel: p.cat.categoryLabel,
      destination: p.item.destination || p.item.destinationName || booking?.destination,
      hub: p.item.hub || p.item.city,
      serviceDate: p.item.serviceDate || p.item.travelDate || booking?.travelStartDate,
      netCost: p.netCost,
      sellingPrice: p.sellingPrice,
      allocatedCommercialPrice: allocatedPrice,
      marginAmount: m.marginAmount,
      marginPercent: m.marginPercent,
      currency: targetCurrency,
      confirmationStatus: (p.item.supplierAllocationStatus || 'Supplier Selected') as SupplierAllocationStatus,
      itemConfirmationRef: p.item.supplierConfirmationRef
    };
  });

  const sumAllocatedCents = itemAllocations.reduce((acc, a) => acc + toCents(a.allocatedCommercialPrice), 0);
  const reconciliationDelta = fromCents(normalizedTargetCents - sumAllocatedCents);
  const totalMargin = calculateMarginMetrics(totalNetCost, normalizedConsolidatedPrice);

  return {
    valid: errors.length === 0 && reconciliationDelta === 0,
    errors,
    currency: targetCurrency,
    allocationMethod,
    totalNetCost,
    totalSellingPrice,
    consolidatedCommercialPrice: normalizedConsolidatedPrice,
    totalMarginAmount: totalMargin.marginAmount,
    totalMarginPercent: totalMargin.marginPercent,
    reconciliationDelta,
    itemAllocations
  };
}

// ============================================================================
// DUPLICATE ACTIVE ALLOCATION GUARD
// ============================================================================

export function isItemInActiveConsolidatedAllocation(
  item: BookingItem,
  existingAllocations: SupplierAllocationRecord[] = []
): { inActiveAllocation: boolean; allocationId?: string; supplierName?: string } {
  const activeStatuses = new Set(['ALLOCATED', 'CONFIRMED', 'SENT_TO_SUPPLIER', 'AWAITING_CONFIRMATION', 'AMENDMENT_REQUIRED', 'COMPLETED']);

  if (item.consolidatedAllocationId) {
    const parent = existingAllocations.find(a => a.id === item.consolidatedAllocationId);
    if (!parent || activeStatuses.has(parent.status)) {
      return {
        inActiveAllocation: true,
        allocationId: item.consolidatedAllocationId,
        supplierName: parent?.supplierNameSnapshot || item.supplierName
      };
    }
  }

  for (const alloc of existingAllocations) {
    if (alloc.allocationType !== 'CONSOLIDATED') continue;
    if (!activeStatuses.has(alloc.status)) continue;
    if (alloc.serviceItemIds?.includes(item.id) || alloc.serviceItemId === item.id) {
      return {
        inActiveAllocation: true,
        allocationId: alloc.id,
        supplierName: alloc.supplierNameSnapshot
      };
    }
  }

  return { inActiveAllocation: false };
}

export function isItemEligibleForNewConsolidatedAllocation(
  item: BookingItem,
  existingAllocations: SupplierAllocationRecord[] = []
): { eligible: boolean; reason?: string } {
  if (item.isCancelled || item.operationalStatus === 'Cancelled') {
    return { eligible: false, reason: 'Cancelled Service Items cannot be allocated.' };
  }

  const consolidatedCheck = isItemInActiveConsolidatedAllocation(item, existingAllocations);
  if (consolidatedCheck.inActiveAllocation) {
    return {
      eligible: false,
      reason: `Already linked to active Consolidated Allocation ${consolidatedCheck.allocationId} (${consolidatedCheck.supplierName || 'Allocated Supplier'}).`
    };
  }

  const hasActiveIndividualAllocation = Boolean(
    (item.supplierId || item.supplierName) &&
    item.supplierAllocationStatus &&
    !['Not Allocated', 'Pending Allocation', 'Allocation Pending', 'Cancelled', 'Supplier Cancelled', 'Rejected by Supplier'].includes(item.supplierAllocationStatus)
  );

  if (hasActiveIndividualAllocation) {
    return {
      eligible: false,
      reason: `Already allocated individually to "${item.supplierName}" (${item.supplierAllocationStatus}). Unallocate first to include in a consolidated allocation.`
    };
  }

  return { eligible: true };
}
