import { CurrencyCode, PricingCalculationRequest, PricingCalculationResult, AgentPricingResponse, Product, User, UserRole, HotelRate, B2BPackage, FXRateDetails, TieredPrice, InventoryValidity, InventorySurcharge, AppliedSurchargeDetail, SurchargeOverlapWarning, InventoryValidityEvaluation, SurchargeApplicationBasis, TripRouteHub, Quotation, QuoteItem, CurrencyConversionLineRecord, QuotationCurrencySnapshot, SurchargeMaster, QuotationSurchargeOverride, AppliedPromotionSnapshot } from '../types';
import { currencyEngine, convertCurrency as engineConvert, formatCurrency as engineFormat, getExchangeRateInfo, BASELINE_USD_RATES } from './currencyEngine';
import { computeStage1PromotionDiscount } from './promotionEngine';
import { AppDatabase } from './db';
import { hotelToProduct, manualHotelToProduct } from '../utils/hotelHelpers';
import { sanitizePricingResultForAgent } from '../utils/customerQuoteSanitizer';
import { RailPricingEngine } from './railPricingEngine';
import { resolveRailRateNettPrice } from '../types/rail';
import { evaluateCentralizedProductSurcharges, detectCentralizedSurchargeConflicts, validateSurchargeMaster, reconcileAppliedSurchargesMetadataAndStacking, doesSurchargeMatchProductScope } from './surchargeEngine';
import { pricingCache } from './pricingCache';
import { masterDataCache } from './masterDataCache';
import { performanceMonitor } from './performanceMonitor';
import { shouldExcludeHotelItemByNoAccommodation, doesHotelItemBelongToHubOccurrence } from '../utils/hubStayMatching';

// Standardized exchange rate base: 1 USD
export const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  ...BASELINE_USD_RATES
};

export function convertCurrency(amount: number, from: CurrencyCode | any, to: CurrencyCode | any): number {
  const fromCode = (typeof from === 'object' && from !== null) ? (from.code || 'USD') : (from || 'USD');
  const toCode = (typeof to === 'object' && to !== null) ? (to.code || 'USD') : (to || 'USD');
  return currencyEngine.convert(amount, fromCode, toCode);
}

export function formatCurrency(amount?: number | null, currency: CurrencyCode | any = 'USD', options?: { showCode?: boolean }): string {
  const safeCurrency: string = (typeof currency === 'object' && currency !== null) 
    ? (currency.code || 'USD') 
    : (typeof currency === 'string' ? currency : 'USD');
  return currencyEngine.format(amount, safeCurrency, options);
}

// ============================================================================
// AUTHORITATIVE VALIDITY PERIOD & REPEATABLE SURCHARGE ENGINE
// ============================================================================

export function isValidIsoDateString(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    !isNaN(dt.getTime()) &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function resolveInventoryValidity(entity: any): InventoryValidity {
  if (!entity) return { validFrom: '', validTo: '' };
  const validFrom = (
    entity.validity?.validFrom ||
    entity.validityFrom ||
    entity.effectiveFrom ||
    entity.validFrom ||
    ''
  ).trim();
  const validTo = (
    entity.validity?.validTo ||
    entity.validityTo ||
    entity.effectiveTo ||
    entity.validTo ||
    ''
  ).trim();
  return { validFrom, validTo };
}

export function evaluateInventoryValidity(
  entity: any,
  serviceDate?: string,
  serviceEndDate?: string
): InventoryValidityEvaluation {
  if (!entity) {
    return { isValid: false, reason: 'Inventory record not found.' };
  }

  const { validFrom, validTo } = resolveInventoryValidity(entity);

  if (validFrom && !isValidIsoDateString(validFrom)) {
    return { isValid: false, validFrom, validTo, reason: `Malformed Valid From date (${validFrom}).` };
  }
  if (validTo && !isValidIsoDateString(validTo)) {
    return { isValid: false, validFrom, validTo, reason: `Malformed Valid To date (${validTo}).` };
  }
  if (validFrom && validTo && validTo < validFrom) {
    return {
      isValid: false,
      validFrom,
      validTo,
      reason: `Valid To (${validTo}) must be on or after Valid From (${validFrom}).`
    };
  }

  if (serviceDate && serviceDate.trim()) {
    const cleanDate = serviceDate.trim();
    if (!isValidIsoDateString(cleanDate)) {
      return { isValid: false, validFrom, validTo, reason: `Invalid service date (${cleanDate}).` };
    }
    if (validFrom && cleanDate < validFrom) {
      return {
        isValid: false,
        validFrom,
        validTo,
        reason: `Service date (${cleanDate}) is prior to inventory validity start (${validFrom}).`
      };
    }
    if (validTo && cleanDate > validTo) {
      return {
        isValid: false,
        validFrom,
        validTo,
        reason: `Service date (${cleanDate}) is after inventory validity end (${validTo}).`
      };
    }

    if (serviceEndDate && serviceEndDate.trim()) {
      const cleanEnd = serviceEndDate.trim();
      if (isValidIsoDateString(cleanEnd) && validTo && cleanEnd > validTo) {
        return {
          isValid: false,
          validFrom,
          validTo,
          reason: `Service end date (${cleanEnd}) exceeds inventory validity end (${validTo}).`
        };
      }
    }
  }

  return {
    isValid: true,
    validFrom: validFrom || undefined,
    validTo: validTo || undefined
  };
}

export function detectSurchargeOverlaps(surcharges?: InventorySurcharge[]): SurchargeOverlapWarning[] {
  if (!surcharges || !Array.isArray(surcharges) || surcharges.length < 2) return [];
  const activeValid = surcharges.filter(
    s =>
      s &&
      s.status === 'ACTIVE' &&
      isValidIsoDateString(s.validFrom) &&
      isValidIsoDateString(s.validTo) &&
      s.validTo >= s.validFrom
  );

  const warnings: SurchargeOverlapWarning[] = [];
  for (let i = 0; i < activeValid.length; i++) {
    for (let j = i + 1; j < activeValid.length; j++) {
      const a = activeValid[i];
      const b = activeValid[j];
      if (a.validFrom <= b.validTo && b.validFrom <= a.validTo) {
        const overlapStart = a.validFrom > b.validFrom ? a.validFrom : b.validFrom;
        const overlapEnd = a.validTo < b.validTo ? a.validTo : b.validTo;
        warnings.push({
          firstId: a.surchargeId,
          firstName: a.name || 'Surcharge',
          secondId: b.surchargeId,
          secondName: b.name || 'Surcharge',
          overlapStart,
          overlapEnd,
          message: `"${a.name || 'Unnamed'}" (${a.validFrom} – ${a.validTo}) overlaps with "${b.name || 'Unnamed'}" (${b.validFrom} – ${b.validTo}).`
        });
      }
    }
  }
  return warnings;
}

export function validateInventoryValidityAndSurcharges(params: {
  validity?: InventoryValidity;
  validityFrom?: string;
  validityTo?: string;
  surcharges?: InventorySurcharge[];
  requireValidity?: boolean;
  nativeCurrency?: CurrencyCode | string;
}): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  overlaps: SurchargeOverlapWarning[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validFrom = (params.validity?.validFrom ?? params.validityFrom ?? '').trim();
  const validTo = (params.validity?.validTo ?? params.validityTo ?? '').trim();
  const requireValidity = params.requireValidity !== false;

  if (requireValidity) {
    if (!validFrom) {
      errors.push('Valid From date is required for sellable inventory.');
    }
    if (!validTo) {
      errors.push('Valid To date is required for sellable inventory.');
    }
  }

  if (validFrom && !isValidIsoDateString(validFrom)) {
    errors.push(`Valid From ("${validFrom}") is not a valid calendar date (YYYY-MM-DD).`);
  }
  if (validTo && !isValidIsoDateString(validTo)) {
    errors.push(`Valid To ("${validTo}") is not a valid calendar date (YYYY-MM-DD).`);
  }
  if (validFrom && validTo && isValidIsoDateString(validFrom) && isValidIsoDateString(validTo)) {
    if (validTo < validFrom) {
      errors.push('Valid To must be on or after Valid From.');
    }
  }

  const surcharges = params.surcharges || [];
  const seenIds = new Set<string>();

  surcharges.forEach((s, idx) => {
    const label = s.name?.trim() ? `Surcharge "${s.name.trim()}"` : `Surcharge #${idx + 1}`;
    if (!s.surchargeId || !s.surchargeId.trim()) {
      errors.push(`${label}: Missing stable surchargeId.`);
    } else if (seenIds.has(s.surchargeId)) {
      errors.push(`${label}: Duplicate surcharge ID (${s.surchargeId}).`);
    } else {
      seenIds.add(s.surchargeId);
    }

    if (!s.name || !s.name.trim()) {
      errors.push(`${label}: Surcharge Name must not be blank.`);
    }

    if (!s.validFrom || !isValidIsoDateString(s.validFrom)) {
      errors.push(`${label}: Valid From must be a valid date (YYYY-MM-DD).`);
    }
    if (!s.validTo || !isValidIsoDateString(s.validTo)) {
      errors.push(`${label}: Valid To must be a valid date (YYYY-MM-DD).`);
    }
    if (
      s.validFrom &&
      s.validTo &&
      isValidIsoDateString(s.validFrom) &&
      isValidIsoDateString(s.validTo) &&
      s.validTo < s.validFrom
    ) {
      errors.push(`${label}: Surcharge Valid To must be on or after Valid From.`);
    }

    if (s.type !== 'FIXED' && s.type !== 'PERCENTAGE') {
      errors.push(`${label}: Surcharge Type must be FIXED or PERCENTAGE.`);
    }

    if (typeof s.value !== 'number' || isNaN(s.value) || !isFinite(s.value) || s.value < 0) {
      errors.push(`${label}: Surcharge Value must be a valid non-negative number.`);
    } else if (s.type === 'PERCENTAGE' && s.value > 500) {
      errors.push(`${label}: Percentage surcharge value (${s.value}%) exceeds maximum allowed limit (500%).`);
    }

    if (s.type === 'FIXED') {
      const curr = (s.currency || params.nativeCurrency || '').toString().trim();
      if (!curr) {
        errors.push(`${label}: Currency is required for fixed monetary surcharges.`);
      }
    }

    if (!s.applicationBasis || !s.applicationBasis.trim()) {
      errors.push(`${label}: Application Basis is required.`);
    }
  });

  const overlaps = detectSurchargeOverlaps(surcharges);
  overlaps.forEach(o => {
    warnings.push(o.message);
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    overlaps
  };
}

export interface SurchargeEvaluationInput {
  surcharges?: InventorySurcharge[];
  itemId?: string;
  productId?: string;
  productName?: string;
  category?: string;
  productType?: string;
  destinationId?: string;
  destinationName?: string;
  country?: string;
  quoteId?: string;
  quoteVersion?: number;
  bookingDate?: string;
  surchargeOverrides?: QuotationSurchargeOverride[];
  baseTargetAmount?: number;
  serviceDate?: string;
  serviceEndDate?: string;
  nights?: number;
  coverageDays?: number;
  baseNativeAmount: number;
  nativeCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  adults: number;
  children: number;
  infants?: number;
  roomsCount?: number;
  vehiclesCount?: number;
  hoursCount?: number;
  devicesCount?: number;
  quantity?: number;
  defaultApplicationBasis?: SurchargeApplicationBasis;
}

export interface SurchargeEvaluationOutput {
  appliedSurcharges: AppliedSurchargeDetail[];
  totalSurchargeNative: number;
  totalSurchargeConverted: number;
  missingServiceDate: boolean;
  validationMessage?: string;
}

function buildServiceDateList(startDate: string, count: number): string[] {
  const safeCount = Math.max(1, Math.min(366, Math.floor(count || 1)));
  if (safeCount === 1) return [startDate];
  const [y, m, d] = startDate.split('-').map(Number);
  const dates: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    dates.push(dt.toISOString().split('T')[0]);
  }
  return dates;
}

export function evaluateApplicableSurcharges(input: SurchargeEvaluationInput): SurchargeEvaluationOutput {
  const rawDate = input.serviceDate?.trim();
  const dbMastersAll = AppDatabase.getInstance().getSurchargeMasters(false);
  const syntheticProduct = {
    id: input.productId || input.itemId || 'generic-inventory-item',
    name: input.productName || 'Inventory Service',
    category: (input.category || '') as any,
    productType: (input.productType || '') as any,
    destinationId: input.destinationId || '',
    destinationName: input.destinationName || '',
    country: input.country || input.destinationName || '',
    currency: input.nativeCurrency,
    surcharges: []
  } as unknown as Product;

  const matchedCentralCandidates = pricingCache
    .getCandidateSurchargesForProduct(syntheticProduct.id, dbMastersAll, undefined, false)
    .filter(s => doesSurchargeMatchProductScope(s, syntheticProduct));

  const hasOverrides = Array.isArray(input.surchargeOverrides) && input.surchargeOverrides.length > 0;
  if (matchedCentralCandidates.length === 0 && !hasOverrides) {
    return {
      appliedSurcharges: [],
      totalSurchargeNative: 0,
      totalSurchargeConverted: 0,
      missingServiceDate: false
    };
  }

  if (!rawDate || !isValidIsoDateString(rawDate)) {
    return {
      appliedSurcharges: [],
      totalSurchargeNative: 0,
      totalSurchargeConverted: 0,
      missingServiceDate: true,
      validationMessage: 'A valid service/travel date is required to evaluate date-based surcharges.'
    };
  }

  const centralResult = evaluateCentralizedProductSurcharges({
    product: syntheticProduct,
    productName: input.productName,
    centralizedSurcharges: dbMastersAll,
    serviceDate: rawDate,
    travelDate: rawDate,
    serviceEndDate: input.serviceEndDate,
    bookingDate: input.bookingDate,
    baseNativeSellingAmount: input.baseNativeAmount,
    baseSellingPriceInTargetCurrency: input.baseTargetAmount,
    productNativeCurrency: input.nativeCurrency,
    targetCurrency: input.targetCurrency,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    roomsCount: input.roomsCount,
    nights: input.nights,
    vehiclesCount: input.vehiclesCount,
    hoursCount: input.hoursCount,
    coverageDays: input.coverageDays,
    devicesCount: input.devicesCount,
    quantity: input.quantity,
    itemId: input.itemId,
    quoteId: input.quoteId,
    quoteVersion: input.quoteVersion,
    surchargeOverrides: input.surchargeOverrides
  });

  return {
    appliedSurcharges: centralResult.appliedSurcharges,
    totalSurchargeNative: centralResult.surchargeTotalInProductNative,
    totalSurchargeConverted: centralResult.surchargeTotalConverted,
    missingServiceDate: false,
    validationMessage: centralResult.validationMessage
  };
}

// Product categories that use capacity-based vehicle/yacht calculation by default
export const CAPACITY_BASED_CATEGORIES = [
  'Private Tour',
  'Private Tours',
  'Transfer',
  'Transfers',
  'Transport',
  'Private Yacht',
  'Private Yacht Charter',
  'Ferry',
  'Cruises'
];

export function isCapacityBasedProduct(product: Product): boolean {
  if (product.pricingMethod === 'capacity_based' || (product as any).pricingType === 'CAPACITY' || (product as any).pricingModel === 'CAPACITY') return true;
  if (product.pricingMethod === 'per_person') return false;
  if (product.pricingMethod as string === 'hourly' || product.pricingMethod === 'hourly_based') return false;
  if (product.vehicleConfig?.pricingMethod === 'capacity_based') return true;
  if (product.isTransfer) return true;
  if (product.vehicleConfig && product.vehicleConfig.maxSeats) return true;
  const cat = ((product as any).productCategory || product.category || '').toLowerCase();
  return (
    cat.includes('private tour') ||
    cat.includes('transfer') ||
    cat.includes('transport') ||
    cat.includes('private yacht') ||
    cat.includes('yacht') ||
    cat.includes('ferry') ||
    cat.includes('cruise')
  );
}

export interface CapacitySimulationRow {
  pax: number;
  perPersonNett: number;
  totalNett: number;
  perPersonSelling: number;
  totalSelling: number;
  vehiclesAllocated: number;
  isCapacityExceeded: boolean;
  status: 'optimal' | 'full' | 'exceeded';
}

export function generateCapacitySimulationMatrix(
  product: Product,
  targetCurrency?: CurrencyCode,
  appliedMarkupPercent?: number
): CapacitySimulationRow[] {
  const isCap = isCapacityBasedProduct(product);
  if (!isCap) return [];

  const baseCost = product.vehicleConfig?.unitVehicleNetCost ?? 
                   product.vehicleConfig?.totalTransferCost ?? 
                   product.adultNetPrice ?? 
                   product.adultNettCost ?? 
                   500;
  const maxCapacity = Math.max(1, product.vehicleConfig?.maxSeats || product.vehicleConfig?.passengerCapacity || product.maxPax || 10);
  const markup = appliedMarkupPercent !== undefined ? appliedMarkupPercent : (product.buyerMarkupPercent ?? product.defaultMarkupPercent ?? 25);
  const tax = product.taxPercent ?? 10;
  const curr = targetCurrency || product.currency;

  const convertedUnitCost = convertCurrency(baseCost, product.currency, curr);
  const unitSelling = calculateSellingPrice(convertedUnitCost, markup, tax, 0);

  const rows: CapacitySimulationRow[] = [];
  const maxSimulationPax = Math.max(maxCapacity + 2, Math.min(maxCapacity * 2, 20));

  for (let pax = 1; pax <= maxSimulationPax; pax++) {
    const isExceeded = pax > maxCapacity;
    const vehiclesAllocated = Math.ceil(pax / maxCapacity);
    const totalNett = isExceeded ? vehiclesAllocated * convertedUnitCost : convertedUnitCost;
    const perPersonNett = totalNett / pax;
    const totalSelling = isExceeded ? vehiclesAllocated * unitSelling : unitSelling;
    const perPersonSelling = totalSelling / pax;

    rows.push({
      pax,
      perPersonNett,
      totalNett,
      perPersonSelling,
      totalSelling,
      vehiclesAllocated,
      isCapacityExceeded: isExceeded,
      status: pax === maxCapacity ? 'full' : pax > maxCapacity ? 'exceeded' : 'optimal'
    });
  }

  return rows;
}

export interface CapacityTierResolutionParams {
  product: Product;
  passengerCount: number;
  routeId?: string;
  travelDate?: string;
  configuration?: Record<string, any>;
}

export interface CapacityTierResolutionResult {
  hasMatchedTier: boolean;
  matchingTier?: TieredPrice;
  vehicleName: string;
  vehicleType: string;
  vehicleModel?: string;
  fleetAssetId?: string;
  supplierNett: number;
  minPassengers: number;
  maxPassengers: number;
  vehiclesRequired: number;
  calculatedPrice: number;
  currency: CurrencyCode;
  validationError?: string;
  isCapacityExceeded?: boolean;
}

/**
 * Authoritative Central Service for Capacity Tier Resolution
 * Step 3 (Product-Specific Capacity Pricing Tiers) is the primary commercial pricing mechanism
 * based on passenger count and asset selection.
 */
export function resolveCapacityPricingTier(params: CapacityTierResolutionParams): CapacityTierResolutionResult {
  const { product, passengerCount, travelDate, configuration } = params;
  const curr: CurrencyCode = product.currency || product.nativeCurrency || 'USD';
  const targetAssetId = configuration?.vehicleId || configuration?.yachtId || configuration?.vesselId || configuration?.ferryId || configuration?.assetId;

  let activeTiers = (product.tieredPricing || []).filter(t => t.status !== 'INACTIVE');

  // Date validity check if travelDate is provided
  if (travelDate) {
    activeTiers = activeTiers.filter(t => {
      if (t.effectiveFrom && travelDate < t.effectiveFrom) return false;
      if (t.effectiveTo && travelDate > t.effectiveTo) return false;
      return true;
    });
  }

  // Filter by target asset if specified, otherwise search all active product tiers
  let tiersToSearch = activeTiers;
  if (targetAssetId) {
    const assetSpecificTiers = activeTiers.filter(t => 
      t.fleetId === targetAssetId || 
      (t as any).vehicleId === targetAssetId || 
      (t as any).assetId === targetAssetId
    );
    if (assetSpecificTiers.length > 0) {
      tiersToSearch = assetSpecificTiers;
    }
  }

  const sortedTiers = [...tiersToSearch].sort((a, b) => a.minPax - b.minPax);
  const totalPax = Math.max(1, passengerCount || 1);
  const vehicleConfig = product.vehicleConfig;
  const defaultVehicleName = vehicleConfig?.vehicleName || vehicleConfig?.vehicleModel || product.name;
  const defaultVehicleType = vehicleConfig?.vehicleType || 'Executive Fleet';
  const defaultUnitNett = vehicleConfig?.unitVehicleNetCost ?? vehicleConfig?.totalTransferCost ?? product.adultNetPrice ?? 0;

  // Match exact passenger range: minPax <= totalPax <= maxPax
  if (sortedTiers.length > 0) {
    const matched = sortedTiers.find(t => totalPax >= t.minPax && totalPax <= t.maxPax);

    if (matched) {
      const tierNett = matched.supplierNett !== undefined 
        ? matched.supplierNett 
        : (matched.nettPrice !== undefined 
          ? matched.nettPrice 
          : (matched.netCostPerPax !== undefined ? matched.netCostPerPax : defaultUnitNett));

      const isMarginInactive = (product as any).marginStatus === 'INACTIVE';
      const marginPct = isMarginInactive
        ? 0
        : (matched.marginValue !== undefined
            ? matched.marginValue
            : (product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 20));
      const tierMarginType = matched.marginType === 'FIXED' ? 'FIXED' : ((product as any).marginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE');
      const effectiveFixedMargin = isMarginInactive
        ? 0
        : (matched.marginType === 'FIXED' && matched.marginValue !== undefined
            ? matched.marginValue
            : ((product as any).marginType === 'FIXED' && (product as any).marginFixed !== undefined ? Number((product as any).marginFixed) : 0));

      const taxPct = matched.taxValue !== undefined 
        ? matched.taxValue 
        : (product.taxPercent ?? 10);
      
      const feePct = matched.serviceChargeValue !== undefined 
        ? matched.serviceChargeValue 
        : (product.serviceFeeFixed ?? 0);

      const b2bCalc = tierMarginType === 'FIXED'
        ? (() => {
            const unified = calculateUnifiedPrice({
              nettPrice: tierNett,
              quantity: 1,
              marginType: 'FIXED',
              marginValue: effectiveFixedMargin,
              taxPercent: taxPct,
              serviceChargeType: 'PERCENTAGE',
              serviceChargeValue: feePct,
              currency: curr
            });
            return { price: unified.finalPrice };
          })()
        : calculateB2BAgentPrice({
            nettCost: tierNett,
            marginPercent: marginPct,
            taxPercent: taxPct,
            serviceFeePercent: feePct,
            currency: curr
          });

      const tierVehicles = matched.vehicleCount !== undefined && matched.vehicleCount > 0 ? matched.vehicleCount : 1;

      return {
        hasMatchedTier: true,
        matchingTier: matched,
        vehicleName: matched.fleetName || (matched as any).vehicleName || defaultVehicleName,
        vehicleType: defaultVehicleType,
        vehicleModel: vehicleConfig?.vehicleModel,
        fleetAssetId: matched.fleetId || (matched as any).vehicleId || product.vehicleId,
        supplierNett: tierNett,
        minPassengers: matched.minPax,
        maxPassengers: matched.maxPax,
        vehiclesRequired: tierVehicles,
        calculatedPrice: b2bCalc.price,
        currency: curr
      };
    } else {
      // Step 3 tiers exist, but passenger count does NOT match any configured tier range
      return {
        hasMatchedTier: false,
        vehicleName: defaultVehicleName,
        vehicleType: defaultVehicleType,
        supplierNett: 0,
        minPassengers: 1,
        maxPassengers: sortedTiers[sortedTiers.length - 1]?.maxPax || 1,
        vehiclesRequired: 1,
        calculatedPrice: 0,
        currency: curr,
        isCapacityExceeded: true,
        validationError: `No pricing configured for this asset and passenger count (${totalPax} Pax).`
      };
    }
  }

  // Fallback if no Step 3 tiers are defined at all on product
  const maxSeats = Math.max(1, vehicleConfig?.maxSeats || vehicleConfig?.passengerCapacity || product.maxPax || 7);
  const allowMultiple = vehicleConfig?.allowMultipleVehicles ?? true;
  const vehiclesNeeded = totalPax > maxSeats && allowMultiple ? Math.ceil(totalPax / maxSeats) : 1;
  const totalNett = defaultUnitNett * vehiclesNeeded;

  const isMarginInactive = (product as any).marginStatus === 'INACTIVE';
  const marginPct = isMarginInactive ? 0 : (product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 20);
  const taxPct = product.taxPercent ?? 10;
  const feePct = product.serviceFeeFixed ?? 0;

  const b2bCalc = !isMarginInactive && (product as any).marginType === 'FIXED' && (product as any).marginFixed !== undefined
    ? {
        price: calculateUnifiedPrice({
          nettPrice: totalNett,
          quantity: 1,
          marginType: 'FIXED',
          marginValue: Number((product as any).marginFixed),
          taxPercent: taxPct,
          serviceChargeType: 'PERCENTAGE',
          serviceChargeValue: feePct,
          currency: curr
        }).finalPrice
      }
    : calculateB2BAgentPrice({
        nettCost: totalNett,
        marginPercent: marginPct,
        taxPercent: taxPct,
        serviceFeePercent: feePct,
        currency: curr
      });

  return {
    hasMatchedTier: totalPax <= maxSeats || allowMultiple,
    vehicleName: defaultVehicleName,
    vehicleType: defaultVehicleType,
    vehicleModel: vehicleConfig?.vehicleModel,
    fleetAssetId: product.vehicleId,
    supplierNett: totalNett,
    minPassengers: 1,
    maxPassengers: maxSeats,
    vehiclesRequired: vehiclesNeeded,
    calculatedPrice: b2bCalc.price,
    currency: curr,
    validationError: (totalPax > maxSeats && !allowMultiple) 
      ? `No pricing configured for this asset and passenger count (${totalPax} Pax).` 
      : undefined
  };
}

export function resolveVehiclePricingTier(
  productIdOrProduct: string | Product,
  vehicleId?: string,
  passengerCount: number = 1,
  travelDate?: string
): CapacityTierResolutionResult {
  const product = typeof productIdOrProduct === 'string'
    ? AppDatabase.getInstance().getProductById(productIdOrProduct)
    : productIdOrProduct;

  if (!product) {
    return {
      hasMatchedTier: false,
      vehicleName: 'Vehicle',
      vehicleType: 'Executive Chauffeur',
      supplierNett: 0,
      minPassengers: 1,
      maxPassengers: 1,
      vehiclesRequired: 1,
      calculatedPrice: 0,
      currency: 'USD',
      validationError: 'Product not found.'
    };
  }

  return resolveCapacityPricingTier({
    product,
    passengerCount,
    travelDate,
    configuration: { vehicleId }
  });
}

export function resolveYachtPricingTier(
  productIdOrProduct: string | Product,
  yachtId?: string,
  passengerCount: number = 1,
  travelDate?: string
): CapacityTierResolutionResult {
  const product = typeof productIdOrProduct === 'string'
    ? AppDatabase.getInstance().getProductById(productIdOrProduct)
    : productIdOrProduct;

  if (!product) {
    return {
      hasMatchedTier: false,
      vehicleName: 'Yacht',
      vehicleType: 'Luxury Yacht Charter',
      supplierNett: 0,
      minPassengers: 1,
      maxPassengers: 1,
      vehiclesRequired: 1,
      calculatedPrice: 0,
      currency: 'USD',
      validationError: 'Product not found.'
    };
  }

  return resolveCapacityPricingTier({
    product,
    passengerCount,
    travelDate,
    configuration: { yachtId, vehicleId: yachtId }
  });
}

export function resolveVesselPricingTier(
  productIdOrProduct: string | Product,
  vesselId?: string,
  passengerCount: number = 1,
  travelDate?: string
): CapacityTierResolutionResult {
  const product = typeof productIdOrProduct === 'string'
    ? AppDatabase.getInstance().getProductById(productIdOrProduct)
    : productIdOrProduct;

  if (!product) {
    return {
      hasMatchedTier: false,
      vehicleName: 'Vessel',
      vehicleType: 'Maritime Ferry / Vessel',
      supplierNett: 0,
      minPassengers: 1,
      maxPassengers: 1,
      vehiclesRequired: 1,
      calculatedPrice: 0,
      currency: 'USD',
      validationError: 'Product not found.'
    };
  }

  return resolveCapacityPricingTier({
    product,
    passengerCount,
    travelDate,
    configuration: { vesselId, ferryId: vesselId, vehicleId: vesselId }
  });
}

export class CapacityTierResolver {
  public static resolve(params: CapacityTierResolutionParams): CapacityTierResolutionResult {
    return resolveCapacityPricingTier(params);
  }
}

export type MarginType = 'PERCENTAGE' | 'FIXED';
export type ServiceChargeType = 'PERCENTAGE' | 'FIXED';

export interface UnifiedPricingInput {
  nettPrice: number;
  marginType?: MarginType;
  marginValue?: number; // e.g. 20 (for 20%) or 2500 (fixed amount)
  serviceChargeType?: ServiceChargeType;
  serviceChargeValue?: number; // e.g. 5 (for 5%) or 500 (fixed amount)
  taxPercent?: number; // e.g. 10 (for 10% tax)
  taxApplication?: 'ON_MARGIN' | 'ON_TOTAL' | 'NONE'; // Default: ON_MARGIN
  currency?: CurrencyCode;
  quantity?: number;
}

export interface UnifiedPricingResult {
  nettPrice: number;
  marginAmount: number;
  marginType: MarginType;
  marginValue: number;
  subtotal: number;
  serviceChargeAmount: number;
  serviceFeeAmount: number;
  serviceChargeType: ServiceChargeType;
  serviceChargeValue: number;
  taxAmount: number;
  taxPercent: number;
  finalPrice: number;
  unitFinalPrice: number;
  currency: CurrencyCode;
}

/**
 * Global Authoritative Calculation:
 * Universal Formula:
 * 1. Margin = Nett × B2B Margin %
 * 2. Tax = Margin × Tax % (Tax strictly on Margin)
 * 3. Subtotal = Nett + Margin + Tax
 * 4. Service Fee = Subtotal × Service Fee % (Service Fee on Subtotal)
 * 5. Price = Subtotal + Service Fee
 */
export function calculateUnifiedPrice(input: UnifiedPricingInput): UnifiedPricingResult {
  const nett = Math.max(0, input.nettPrice || 0);
  const qty = Math.max(1, input.quantity || 1);
  const totalNett = nett * qty;

  const marginType: MarginType = input.marginType || 'PERCENTAGE';
  const marginValue = input.marginValue !== undefined ? input.marginValue : 20;
  const marginAmount = marginType === 'FIXED' 
    ? marginValue * qty 
    : totalNett * (marginValue / 100);

  const taxPercent = input.taxPercent !== undefined ? input.taxPercent : 10;
  const taxAmount = marginAmount * (taxPercent / 100);

  const subtotal = totalNett + marginAmount + taxAmount;

  const serviceChargeType: ServiceChargeType = input.serviceChargeType || 'PERCENTAGE';
  const serviceChargeValue = input.serviceChargeValue !== undefined ? input.serviceChargeValue : 0;
  const serviceChargeAmount = serviceChargeType === 'FIXED' 
    ? serviceChargeValue * qty 
    : subtotal * (serviceChargeValue / 100);

  const finalPrice = Math.round((subtotal + serviceChargeAmount) * 100) / 100;
  const unitFinalPrice = qty > 0 ? Math.round((finalPrice / qty) * 100) / 100 : finalPrice;

  return {
    nettPrice: totalNett,
    marginAmount,
    marginType,
    marginValue,
    subtotal,
    serviceChargeAmount,
    serviceFeeAmount: serviceChargeAmount,
    serviceChargeType,
    serviceChargeValue,
    taxAmount,
    taxPercent,
    finalPrice,
    unitFinalPrice,
    currency: input.currency || 'USD'
  };
}

export function calculateSellingPrice(
  adultNetPrice: number,
  markupPercent: number = 20,
  taxPercent: number = 10,
  serviceFeePercent: number = 0,
  marginType: MarginType = 'PERCENTAGE',
  marginFixed: number = 0,
  serviceFeeFixed: number = 0
): number {
  const markupAmount = marginType === 'FIXED' ? marginFixed : adultNetPrice * (markupPercent / 100);
  const taxAmount = markupAmount * (taxPercent / 100);
  const subtotal = adultNetPrice + markupAmount + taxAmount;
  const serviceFeeAmount = serviceFeeFixed > 0 ? serviceFeeFixed : subtotal * (serviceFeePercent / 100);
  return Math.round((subtotal + serviceFeeAmount) * 100) / 100;
}

export interface DeliveredPriceInfo {
  isPriceAvailable?: boolean;
  priceUnavailableReason?: string;
  deliveredPrice: number; // In targetCurrency (converted from Base Currency)
  totalSellingPrice?: number;
  rawPriceInBaseCurrency: number;
  baseAdultNet: number;
  baseChildNet: number;
  baseInfantNet: number;
  appliedMarkupPercent: number;
  userTier: 'BUYER' | 'B2B_AGENT' | 'ADMIN';
  isCustomMargin: boolean;
  currency: CurrencyCode;
  isCapacityBased?: boolean;
  totalVehicleSellingPrice?: number;
  perPersonStartingFrom?: number;
  vehicleCapacity?: number;
  vehicleModel?: string;
  unitVehicleNetCost?: number;
}

export interface B2BPriceInput {
  nettCost: number;
  marginPercent?: number;
  taxPercent?: number;
  serviceFeePercent?: number;
  currency?: CurrencyCode;
}

export interface B2BPriceResult {
  nettCost: number;
  marginPercent: number;
  marginAmount: number;
  taxPercent: number;
  taxAmount: number;
  subtotal: number;
  serviceFeePercent: number;
  serviceFeeAmount: number;
  price: number;
  currency: CurrencyCode;
  pricingVersion: string;
}

/**
 * Single Authoritative B2B Agent Price Calculator
 * Formula:
 * 1. Margin Amount = Nett Cost × B2B Margin %
 * 2. Tax Amount = Margin Amount × Tax % (Tax strictly on Margin)
 * 3. Subtotal = Nett Cost + Margin Amount + Tax Amount
 * 4. Service Fee Amount = Subtotal × Service Fee % (Service Fee on Subtotal)
 * 5. Price = Subtotal + Service Fee Amount
 */
export function calculateB2BAgentPrice(input: B2BPriceInput): B2BPriceResult {
  const nettCost = Math.max(0, input.nettCost || 0);
  const marginPercent = input.marginPercent !== undefined ? input.marginPercent : 0;
  const taxPercent = input.taxPercent !== undefined ? input.taxPercent : 0;
  const serviceFeePercent = input.serviceFeePercent !== undefined ? input.serviceFeePercent : 0;

  const marginAmount = nettCost * (marginPercent / 100);
  const taxAmount = marginAmount * (taxPercent / 100);
  const subtotal = nettCost + marginAmount + taxAmount;
  const serviceFeeAmount = subtotal * (serviceFeePercent / 100);
  const price = Math.round((subtotal + serviceFeeAmount) * 100) / 100;

  return {
    nettCost,
    marginPercent,
    marginAmount,
    taxPercent,
    taxAmount,
    subtotal,
    serviceFeePercent,
    serviceFeeAmount,
    price,
    currency: input.currency || 'USD',
    pricingVersion: 'v2.0-b2b-canonical'
  };
}

// In-Memory High-Performance Memoization Cache for calculateDeliveredPriceForUser
const deliveredPriceCache = new Map<string, { result: DeliveredPriceInfo; timestamp: number }>();
const MAX_DELIVERED_CACHE_SIZE = 1500;

export function clearPricingEngineCache(): void {
  deliveredPriceCache.clear();
  pricingCache.clearAll();
}

/**
 * Calculates the exact Delivered Selling Price for a product based on:
 * Single commercial customer price: B2B Agent Price
 */
export function calculateDeliveredPriceForUser(
  product: Product,
  user: User | null,
  targetCurrency: CurrencyCode = 'USD'
): DeliveredPriceInfo {
  if (!product || !product.id) {
    return {
      deliveredPrice: 0,
      totalSellingPrice: 0,
      rawPriceInBaseCurrency: 0,
      baseAdultNet: 0,
      baseChildNet: 0,
      baseInfantNet: 0,
      appliedMarkupPercent: 0,
      userTier: 'B2B_AGENT',
      isCustomMargin: false,
      currency: targetCurrency,
      isCapacityBased: false,
      isPriceAvailable: false,
      priceUnavailableReason: 'Invalid product record'
    };
  }

  // Fast cache lookup (keyed on product margin governance version and master catalog version)
  const cacheKey = `${product.id}_${(product as any).updatedAt || (product as any).lastUpdated || ''}_mv${(product as any).marginConfigVersion ?? ''}_${(product as any).b2bAgentMarkupPercent ?? ''}_${(product as any).defaultMarkupPercent ?? ''}_${(product as any).marginType ?? ''}_${(product as any).marginFixed ?? ''}_${(product as any).marginStatus ?? ''}_pv${masterDataCache.getVersion('products')}_pmv${masterDataCache.getVersion('product_margin_configs')}_${user?.id || 'anon'}_${user?.role || 'B2B_AGENT'}_${user?.companyId || ''}_${targetCurrency}`;
  const cachedEntry = deliveredPriceCache.get(cacheKey);
  if (cachedEntry) {
    return cachedEntry.result;
  }

  const role: UserRole = user?.role || 'B2B_AGENT';
  const isAdmin =
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    ((role === 'TEAM_MEMBER' || role === 'DMC_STAFF') &&
      Boolean((user?.permissions as any)?.cmsFinance?.financialSummary || (user?.permissions as any)?.canManagePricing));
  const userTier: 'BUYER' | 'B2B_AGENT' | 'ADMIN' = isAdmin ? 'ADMIN' : 'B2B_AGENT';

  const isRail =
    product.category === 'Rail' ||
    product.productType === 'Rail' ||
    product.id?.startsWith('RAIL-JP') ||
    product.sku?.startsWith('JP-SHINKANSEN');

  if (isRail) {
    const db = AppDatabase.getInstance();
    const canonicalProductId = (
      product.id === 'RAIL-JP-GREEN-RESERVED' ||
      product.sku?.includes('GRN') ||
      product.name?.toLowerCase().includes('green car')
    )
      ? 'RAIL-JP-GREEN-RESERVED'
      : 'RAIL-JP-ORD-RESERVED';

    const storedRates = db.getRailRates();
    const preferredRate =
      storedRates.find(r =>
        r.productId === canonicalProductId &&
        r.active !== false &&
        !r.needsAdminReview &&
        (resolveRailRateNettPrice(r) ?? 0) > 0 &&
        (r.passengerType?.toUpperCase() === 'ADULT' || r.passengerType?.toUpperCase() === 'ADT') &&
        ((r.originStationId === 'JP-ST-TOKYO' && r.destinationStationId === 'JP-ST-KYOTO') ||
         (r.originStationId === 'JP-ST-KYOTO' && r.destinationStationId === 'JP-ST-TOKYO'))
      ) ||
      storedRates.find(r =>
        r.productId === canonicalProductId &&
        r.active !== false &&
        !r.needsAdminReview &&
        (resolveRailRateNettPrice(r) ?? 0) > 0 &&
        (r.passengerType?.toUpperCase() === 'ADULT' || r.passengerType?.toUpperCase() === 'ADT')
      );

    const originStationId = preferredRate?.originStationId || 'JP-ST-TOKYO';
    const destinationStationId = preferredRate?.destinationStationId || 'JP-ST-KYOTO';
    const serviceGroup = preferredRate?.serviceGroup || 'NOZOMI_MIZUHO';
    const travelDate = new Date().toISOString().split('T')[0];

    const railRes = RailPricingEngine.getInstance().calculatePrice({
      originStationId,
      destinationStationId,
      productId: canonicalProductId,
      serviceGroup,
      travelDate,
      adultsCount: 1,
      childrenCount: 0,
      userRole: role,
      targetCurrency
    });

    if (railRes.isPriceAvailable === false) {
      return {
        isPriceAvailable: false,
        priceUnavailableReason: railRes.priceUnavailableReason || 'Price unavailable — Admin configuration required',
        deliveredPrice: 0,
        totalSellingPrice: 0,
        rawPriceInBaseCurrency: 0,
        baseAdultNet: 0,
        baseChildNet: 0,
        baseInfantNet: 0,
        appliedMarkupPercent: 0,
        userTier,
        isCustomMargin: false,
        currency: targetCurrency
      };
    }

    return {
      isPriceAvailable: true,
      deliveredPrice: railRes.finalSellingPriceTargetCurrency,
      totalSellingPrice: railRes.finalSellingPriceTargetCurrency,
      rawPriceInBaseCurrency: railRes.finalSellingPriceJPY,
      baseAdultNet: isAdmin ? railRes.adultPerPaxSupplierJPY : 0,
      baseChildNet: isAdmin ? railRes.childPerPaxSupplierJPY : 0,
      baseInfantNet: 0,
      appliedMarkupPercent: isAdmin ? railRes.appliedMarkupPercent : 0,
      userTier,
      isCustomMargin: false,
      currency: targetCurrency
    };
  }

  const agencyPricing = AppDatabase.getInstance().resolveAgencyPricingSettings({ user });
  const isProductLevelEnabled = agencyPricing.productLevelMarginEnabled !== false;

  const appliedMarkupPercent = isProductLevelEnabled
    ? (product.b2bAgentMarkupPercent !== undefined
        ? product.b2bAgentMarkupPercent
        : (product.defaultMarkupPercent !== undefined ? product.defaultMarkupPercent : 20))
    : agencyPricing.agentLevelMarginPercent;
  const isCustomMargin = !isProductLevelEnabled;

  const isCapacity = isCapacityBasedProduct(product);
  let baseAdultNet = product.adultNetPrice ?? product.adultNettCost ?? 0;
  const productRates = (product as any).rates;
  if (!baseAdultNet && productRates && productRates.length > 0) {
    const firstRate = productRates[0];
    baseAdultNet = firstRate.netPrice ?? (firstRate as any).adultNetPrice ?? 0;
  }
  let baseChildNet = product.childNetPrice ?? product.childNettCost ?? 0;
  if (!baseChildNet && productRates && productRates.length > 0) {
    const firstRate = productRates[0];
    baseChildNet = (firstRate as any).childNetPrice ?? (baseAdultNet * 0.5);
  } else if (!baseChildNet) {
    baseChildNet = baseAdultNet * 0.5;
  }
  let baseInfantNet = product.infantNetPrice ?? product.infantNettCost ?? 0;

  if (isCapacity) {
    // If product has configured capacity tiers, use the first tier as starting point
    const firstTier = (product.tieredPricing && product.tieredPricing.length > 0) ? product.tieredPricing[0] : null;
    const vehicleCost = firstTier?.supplierNett ??
                        firstTier?.nettPrice ?? 
                        firstTier?.netCostPerPax ?? 
                        product.vehicleConfig?.unitVehicleNetCost ?? 
                        product.vehicleConfig?.totalTransferCost ?? 
                        baseAdultNet ?? 
                        500;
    const startingCapacity = firstTier?.maxPax ?? 
                             product.vehicleConfig?.maxSeats ?? 
                             product.vehicleConfig?.passengerCapacity ?? 
                             product.maxPax ?? 
                             7;
    const vehicleModel = product.vehicleConfig?.vehicleModel || product.vehicleConfig?.vehicleName || product.name;

    const tierMargin = isProductLevelEnabled
      ? ((firstTier as any)?.b2bMargin ?? firstTier?.marginValue ?? appliedMarkupPercent)
      : agencyPricing.agentLevelMarginPercent;
    const tierMarginType = isProductLevelEnabled ? (firstTier?.marginType || 'PERCENTAGE') : 'PERCENTAGE';
    const tierTax = firstTier?.taxValue ?? product.taxPercent ?? 10;
    const tierSvcValue = firstTier?.serviceChargeValue ?? (product as any).serviceFeePercent ?? (product as any).serviceFeeFixed ?? 0;
    const tierSvcType = firstTier?.serviceChargeType ?? ((product as any).serviceFeePercent !== undefined ? 'PERCENTAGE' : 'FIXED');

    const unifiedRes = calculateUnifiedPrice({
      nettPrice: vehicleCost,
      quantity: 1,
      marginType: tierMarginType,
      marginValue: tierMargin,
      taxPercent: tierTax,
      serviceChargeType: tierSvcType as any,
      serviceChargeValue: tierSvcValue,
      currency: product.currency || 'USD'
    });

    const rawVehicleSelling = unifiedRes.finalPrice;

    const totalVehicleSellingPrice = convertCurrency(rawVehicleSelling, product.currency, targetCurrency);
    const perPersonStartingFrom = totalVehicleSellingPrice / Math.max(1, startingCapacity);

    return {
      deliveredPrice: totalVehicleSellingPrice,
      totalSellingPrice: totalVehicleSellingPrice,
      rawPriceInBaseCurrency: rawVehicleSelling,
      baseAdultNet: isAdmin ? vehicleCost : 0,
      baseChildNet: 0,
      baseInfantNet: 0,
      appliedMarkupPercent: isAdmin ? tierMargin : 0,
      userTier,
      isCustomMargin: isAdmin ? isCustomMargin : false,
      currency: targetCurrency,
      isCapacityBased: true,
      totalVehicleSellingPrice,
      perPersonStartingFrom,
      vehicleCapacity: startingCapacity,
      vehicleModel,
      unitVehicleNetCost: isAdmin ? vehicleCost : undefined
    };
  }

  const rawSellingInBase = calculateSellingPrice(
    baseAdultNet,
    appliedMarkupPercent,
    product.taxPercent ?? 10,
    product.serviceFeeFixed ?? 0
  );

  const deliveredPrice = convertCurrency(rawSellingInBase, product.currency, targetCurrency);

  const result: DeliveredPriceInfo = {
    deliveredPrice,
    totalSellingPrice: deliveredPrice,
    rawPriceInBaseCurrency: rawSellingInBase,
    baseAdultNet: isAdmin ? baseAdultNet : 0,
    baseChildNet: isAdmin ? baseChildNet : 0,
    baseInfantNet: isAdmin ? baseInfantNet : 0,
    appliedMarkupPercent: isAdmin ? appliedMarkupPercent : 0,
    userTier,
    isCustomMargin: isAdmin ? isCustomMargin : false,
    currency: targetCurrency,
    isCapacityBased: false
  };

  if (deliveredPriceCache.size >= MAX_DELIVERED_CACHE_SIZE) {
    const firstKey = deliveredPriceCache.keys().next().value;
    if (firstKey) deliveredPriceCache.delete(firstKey);
  }
  deliveredPriceCache.set(cacheKey, { result, timestamp: Date.now() });

  return result;
}

export function calculateProductPrice(
  productOrParams: Product | {
    product: Product;
    productId?: string;
    pax?: { adults?: number; children?: number; infants?: number };
    adults?: number;
    children?: number;
    infants?: number;
    targetCurrency?: string;
    currency?: string;
    travelDate?: string;
    agentMarginType?: string;
    agentMarginValue?: number;
    pricingTier?: 'B2C' | 'B2B';
    userRole?: UserRole;
    user?: User | null;
    selectedAddonIds?: string[];
    selectedUpsellIds?: string[];
    quantity?: number;
    customMarkupPercent?: number;
    customDiscountPercent?: number;
  },
  requestArg?: PricingCalculationRequest
): PricingCalculationResult {
  let product: Product;
  let request: PricingCalculationRequest;

  if (requestArg) {
    product = productOrParams as Product;
    request = requestArg;
  } else if (productOrParams && (productOrParams as any).product) {
    product = (productOrParams as any).product;
    const params = productOrParams as any;
    request = {
      productId: product.id,
      pricingTier: params.pricingTier || 'B2B',
      userRole: params.userRole || 'B2B_AGENT',
      adults: params.pax?.adults ?? params.adults ?? 2,
      children: params.pax?.children ?? params.children ?? 0,
      infants: params.pax?.infants ?? params.infants ?? 0,
      quantity: params.quantity ?? 1,
      targetCurrency: params.targetCurrency || params.currency || product.currency || 'USD',
      travelDate: params.travelDate || params.checkInDate,
      selectedAddonIds: params.selectedAddonIds || [],
      customMarkupPercent: params.agentMarginType === 'PERCENTAGE' ? params.agentMarginValue : undefined,
      customDiscountPercent: params.discountPercent,
      vehicleId: params.vehicleId || params.fleetId || params.assetId
    } as any;
  } else {
    product = productOrParams as Product;
    request = {} as PricingCalculationRequest;
  }

  const user = request.user || null;
  const userRole = request.userRole || user?.role || 'B2B_AGENT';
  const pricingTier: 'B2C' | 'B2B' = 'B2B';

  // Strict Validation Rule: Product-Level Margin and Agent-Level Margin can NEVER be applied simultaneously
  if ((request as any).applyProductLevelMargin === true && (request as any).applyAgentLevelMargin === true) {
    throw new Error('Exclusive Margin Violation: Product-Level Margin and Agent-Level Margin can never be applied simultaneously.');
  }

  // Resolve authoritative Account Management Pricing & Margin Configuration for this agency/account
  let isProductLevelMarginEnabled = true;
  let configuredAgentLevelMarginPercent = 10;

  try {
    const db = AppDatabase.getInstance();
    const agencySettings = db.resolveAgencyPricingSettings({
      companyId: request.companyId || user?.companyId,
      agencyName: request.agencyName || user?.agencyName || user?.companyName,
      userId: user?.id,
      user
    });
    isProductLevelMarginEnabled = agencySettings.productLevelMarginEnabled;
    configuredAgentLevelMarginPercent = agencySettings.agentLevelMarginPercent;
  } catch {
    // Fallback to default ON
  }

  if (request.preserveHistoricalMarginMode) {
    isProductLevelMarginEnabled = request.historicalProductLevelMarginEnabled !== false;
    if (typeof request.historicalMarginPercent === 'number') {
      configuredAgentLevelMarginPercent = request.historicalMarginPercent;
    }
  } else if (typeof request.productLevelMarginEnabled === 'boolean') {
    isProductLevelMarginEnabled = request.productLevelMarginEnabled;
  }

  if (typeof request.customAgentMarginPercent === 'number') {
    configuredAgentLevelMarginPercent = request.customAgentMarginPercent;
  }

  const activeMarginMode: 'PRODUCT_LEVEL' | 'AGENT_LEVEL' = isProductLevelMarginEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL';

  const adults = Math.max(1, request.adults || 1);
  const children = Math.max(0, request.children || 0);
  const infants = Math.max(0, request.infants || 0);
  const totalPax = adults + children + infants;
  const quantity = Math.max(1, request.quantity || 1);
  const explicitServiceDate = request.travelDate && request.travelDate.trim() ? request.travelDate.trim() : undefined;
  const travelDate = explicitServiceDate || new Date().toISOString().split('T')[0];

  // If product was sanitized for agent view (adultNetPrice or markup fields stripped), restore master fields from AppDatabase
  if (
    product &&
    (product.adultNetPrice === undefined ||
      (product.b2bAgentMarkupPercent === undefined && product.defaultMarkupPercent === undefined))
  ) {
    try {
      const db = AppDatabase.getInstance();
      const prodAny = product as any;

      if ((prodAny.accommodationType === 'manual' || prodAny.isManualHotel) && prodAny.manualHotelDetails) {
        const rebuiltManual = manualHotelToProduct(prodAny.manualHotelDetails);
        product = {
          ...rebuiltManual,
          ...product,
          adultNetPrice: rebuiltManual.adultNetPrice,
          adultNettCost: rebuiltManual.adultNettCost,
          basePrice: (rebuiltManual as any).basePrice,
          defaultMarkupPercent: rebuiltManual.defaultMarkupPercent,
          b2bAgentMarkupPercent: rebuiltManual.b2bAgentMarkupPercent,
          buyerMarkupPercent: rebuiltManual.buyerMarkupPercent,
          taxPercent: rebuiltManual.taxPercent,
          serviceFeePercent: rebuiltManual.serviceFeePercent,
          currency: rebuiltManual.currency,
          nativeCurrency: rebuiltManual.nativeCurrency || rebuiltManual.currency
        } as Product;
      } else if (
        product.id?.startsWith('hotel-prod-') ||
        prodAny.hotelId ||
        product.productType === 'Hotel' ||
        product.productType === 'Hotel & Resort'
      ) {
        const directHotel = prodAny.hotelId ? db.getHotelById(prodAny.hotelId) : undefined;
        const matchedHotel = directHotel || db.getHotels().find(
          h =>
            (prodAny.hotelId && h.id === prodAny.hotelId) ||
            (product.id && product.id.startsWith(`hotel-prod-${h.id}-`)) ||
            (h.name && product.name && h.name.toLowerCase() === product.name.toLowerCase())
        );
        if (matchedHotel) {
          const matchedRoom =
            matchedHotel.roomTypes?.find(
              r =>
                (prodAny.roomTypeId && r.id === prodAny.roomTypeId) ||
                (product.id && product.id.includes(`-${r.id}-`)) ||
                (r.roomName && product.shortDescription?.toLowerCase().includes(r.roomName.toLowerCase()))
            ) || matchedHotel.roomTypes?.[0];
          const matchedRate = matchedRoom?.rates?.[0];
          const nights = Math.max(1, Number(prodAny.nights) || 1);
          const roomsCount = Math.max(1, Number(prodAny.roomsCount) || Math.ceil(adults / 2));
          const rebuiltHotelProd = hotelToProduct(matchedHotel, matchedRoom, matchedRate, nights, roomsCount);
          if (rebuiltHotelProd) {
            product = {
              ...rebuiltHotelProd,
              ...product,
              adultNetPrice: rebuiltHotelProd.adultNetPrice,
              adultNettCost: rebuiltHotelProd.adultNettCost,
              childNetPrice: rebuiltHotelProd.childNetPrice,
              childNettCost: rebuiltHotelProd.childNettCost,
              infantNetPrice: rebuiltHotelProd.infantNetPrice,
              infantNettCost: rebuiltHotelProd.infantNettCost,
              basePrice: (rebuiltHotelProd as any).basePrice,
              defaultMarkupPercent: rebuiltHotelProd.defaultMarkupPercent,
              b2bAgentMarkupPercent: rebuiltHotelProd.b2bAgentMarkupPercent,
              buyerMarkupPercent: rebuiltHotelProd.buyerMarkupPercent,
              taxPercent: rebuiltHotelProd.taxPercent,
              serviceFeePercent: rebuiltHotelProd.serviceFeePercent,
              surcharges: [],
              currency: rebuiltHotelProd.currency,
              nativeCurrency: rebuiltHotelProd.nativeCurrency || rebuiltHotelProd.currency
            } as Product;
          }
        }
      } else {
        const masterProd =
          (product.id && db.getProductById(product.id)) ||
          (prodAny.master_product_id && db.getProductById(prodAny.master_product_id)) ||
          (product.sku && db.getProductById(product.sku)) ||
          undefined;
        if (masterProd) {
          product = {
            ...masterProd,
            ...product,
            adultNetPrice: masterProd.adultNetPrice,
            adultNettCost: masterProd.adultNettCost,
            childNetPrice: masterProd.childNetPrice,
            childNettCost: masterProd.childNettCost,
            infantNetPrice: masterProd.infantNetPrice,
            infantNettCost: masterProd.infantNettCost,
            basePrice: (masterProd as any).basePrice ?? masterProd.adultNetPrice,
            defaultMarkupPercent: masterProd.defaultMarkupPercent,
            b2bAgentMarkupPercent: masterProd.b2bAgentMarkupPercent,
            buyerMarkupPercent: masterProd.buyerMarkupPercent,
            marginType: masterProd.marginType,
            marginFixed: masterProd.marginFixed,
            commissionPercent: masterProd.commissionPercent,
            marginStatus: masterProd.marginStatus,
            marginConfigVersion: masterProd.marginConfigVersion,
            marginUpdatedAt: masterProd.marginUpdatedAt,
            taxPercent: masterProd.taxPercent,
            serviceFeeFixed: masterProd.serviceFeeFixed,
            serviceFeePercent: masterProd.serviceFeePercent,
            tieredPricing: masterProd.tieredPricing,
            vehicleConfig: masterProd.vehicleConfig || product.vehicleConfig,
            ticketConfig: masterProd.ticketConfig || product.ticketConfig,
            guideConfig: masterProd.guideConfig || product.guideConfig,
            restaurantConfig: masterProd.restaurantConfig || product.restaurantConfig,
            mealPricing: masterProd.mealPricing || product.mealPricing,
            upsells: masterProd.upsells || product.upsells,
            addons: masterProd.addons || product.addons,
            surcharges: [],
            currency: product.currency || masterProd.currency,
            nativeCurrency: product.nativeCurrency || masterProd.nativeCurrency || masterProd.currency
          };
        }
      }
    } catch {
      // Ignore if DB not initialized
    }
  }

  // Authoritative Validity Evaluation
  const validityCheck = evaluateInventoryValidity(product, explicitServiceDate);

  // 1. Authoritative Rate Sheet & Database Lookup
  // Check if database contains an active, valid rate for this product / travel date
  let baseAdultNet = product.adultNetPrice ?? product.adultNettCost ?? (product as any).basePrice ?? (product as any).sellingPriceStartingFrom ?? 0;
  let baseChildNet = product.childNetPrice !== undefined ? product.childNetPrice : (product.childNettCost !== undefined ? product.childNettCost : baseAdultNet * 0.5);
  let baseInfantNet = product.infantNetPrice !== undefined ? product.infantNetPrice : (product.infantNettCost !== undefined ? product.infantNettCost : 0);
  let nativeCurrency = product.nativeCurrency || product.currency || 'USD';

  let authoritativeRateId: string | undefined = (product as any).rateId;
  let authoritativeRateVersion: string | number | undefined = (product as any).version || 1;
  let authoritativeRateFrom: string | undefined = product.validity?.validFrom || product.validityFrom;
  let authoritativeRateTo: string | undefined = product.validity?.validTo || product.validityTo;
  let authoritativeSourceCollection: string = 'products';
  let rateMarkupBuyer: number | undefined = undefined;
  let rateMarkupAgent: number | undefined = undefined;
  let rateTaxPercentage: number | undefined = undefined;

  try {
    const db = AppDatabase.getInstance();
    const matchingRates = db.getActiveProductRatesForProduct(product.id, product.sku);

    if (matchingRates.length > 0) {
      // Prioritize date-valid rate
      let matchedRate = matchingRates.find(r => {
        if (!travelDate) return true;
        const from = r.validityFrom || '1970-01-01';
        const to = r.validityTo || '2099-12-31';
        return from <= travelDate && travelDate <= to;
      });

      if (!matchedRate) {
        matchedRate = matchingRates[0];
      }

      if (matchedRate) {
        baseAdultNet = matchedRate.adultNett ?? matchedRate.perPersonCost ?? baseAdultNet;
        baseChildNet = matchedRate.childNett ?? matchedRate.cwbNett ?? (baseAdultNet * 0.5);
        baseInfantNet = matchedRate.infantNett ?? 0;
        if (matchedRate.currency) {
          nativeCurrency = matchedRate.currency;
        }
        authoritativeRateId = matchedRate.id;
        authoritativeRateVersion = (matchedRate as any).version || 1;
        authoritativeRateFrom = matchedRate.validityFrom;
        authoritativeRateTo = matchedRate.validityTo;
        authoritativeSourceCollection = 'product_pricing_rates';
        rateMarkupBuyer = matchedRate.markupBuyer;
        rateMarkupAgent = matchedRate.markupAgent;
        rateTaxPercentage = matchedRate.taxPercentage;
      }
    }
  } catch (e) {
    // Database instance not yet initialized or test environment
  }

  // Check Calendar Date Overrides if available
  if (product.datePricingOverrides && travelDate && product.datePricingOverrides[travelDate]) {
    const override = product.datePricingOverrides[travelDate];
    baseAdultNet = override.netPrice;
    baseChildNet = override.netPrice * 0.5;
  }

  // Check Tiered Pricing if available
  if (product.tieredPricing && (product.tieredPricing || []).length > 0) {
    const matchingTier = (product.tieredPricing || []).find(t => totalPax >= t.minPax && totalPax <= t.maxPax);
    if (matchingTier) {
      baseAdultNet = matchingTier.supplierNett ?? matchingTier.nettPrice ?? matchingTier.netCostPerPax;
      baseChildNet = baseAdultNet * 0.5;
    }
  }

  // 2. Capacity-Based Pricing Engine for Private Tours, Transfers & Transport
  const isCapacity = isCapacityBasedProduct(product);
  const isFixedStayHotel = product.accommodationType === 'manual' || 
                          product.isManualHotel || 
                          product.sku?.startsWith('MAN-HTL-') ||
                          product.pricingMethod === 'fixed_stay' ||
                          product.productType === 'Hotel & Resort' ||
                          product.id?.startsWith('hotel-prod-');

  let rawTotalNetCostInNative = 0;
  let adultNetInNative = 0;
  let childNetInNative = 0;
  let infantNetInNative = 0;

  // Capacity calculations
  let vehicleDetails: PricingCalculationResult['vehicleDetails'] | undefined = undefined;
  let matchingTierFound: TieredPrice | undefined = undefined;

  if (isCapacity) {
    // --- CAPACITY-BASED PRICING MODEL (Sections 2–14, 51) ---
    // CORE PRINCIPLE: Commercial passenger capacity is determined strictly by the Product's
    // configured capacity rules, NOT by the physical vehicle's generic seating capacity.
    const vehicleConfig = product.vehicleConfig;
    const vehicleModel = vehicleConfig?.vehicleModel || vehicleConfig?.vehicleName || product.name;
    const vehicleType = vehicleConfig?.vehicleType || 'Executive Vehicle';
    const genericPhysicalCapacity = Math.max(1, vehicleConfig?.maxSeats || vehicleConfig?.passengerCapacity || vehicleConfig?.totalSeats || product.maxPax || 7);
    const unitVehicleNetCost = vehicleConfig?.unitVehicleNetCost ?? 
                               vehicleConfig?.totalTransferCost ?? 
                               baseAdultNet ?? 
                               500;

    // Occupancy rules (configurable by Admin)
    const adultSeatsPerPax = vehicleConfig?.adultSeatCount !== undefined ? vehicleConfig.adultSeatCount : 1;
    const childSeatsPerPax = vehicleConfig?.childSeatCount !== undefined ? vehicleConfig.childSeatCount : 1;
    const infantSeatsPerPax = vehicleConfig?.infantSeatCount !== undefined ? vehicleConfig.infantSeatCount : 0;

    const adultSeatsOccupied = adults * adultSeatsPerPax;
    const childSeatsOccupied = children * childSeatsPerPax;
    const infantSeatsOccupied = infants * infantSeatsPerPax;
    const totalOccupiedSeats = adultSeatsOccupied + childSeatsOccupied + infantSeatsOccupied;

    const allowMultiple = vehicleConfig?.allowMultipleVehicles ?? true;
    const maxVehicles = vehicleConfig?.maxVehicles || 10;

    let vehiclesAllocated = quantity;
    let capacityExceeded = false;
    let capacityErrorMessage: string | undefined = undefined;

    // Check Product-Specific Capacity Rules (tieredPricing) FIRST
    const activeTiers = (product.tieredPricing || []).filter(t => t.status !== 'INACTIVE');
    const sortedTiers = [...activeTiers].sort((a, b) => a.minPax - b.minPax);

    if (sortedTiers.length > 0) {
      // Find matching passenger tier in product-specific capacity rules (prefer vehicleId match if provided)
      const targetVehicleId = (request as any).vehicleId || (request as any).fleetId;
      if (targetVehicleId) {
        matchingTierFound = sortedTiers.find(t => 
          (t.fleetId === targetVehicleId || (t as any).vehicleId === targetVehicleId) && 
          totalOccupiedSeats >= t.minPax && totalOccupiedSeats <= t.maxPax
        );
      }
      if (!matchingTierFound) {
        matchingTierFound = sortedTiers.find(t => totalOccupiedSeats >= t.minPax && totalOccupiedSeats <= t.maxPax);
      }

      if (matchingTierFound) {
        // Required vehicle count comes strictly from the product's configured capacity rule
        const tierVehicles = matchingTierFound.vehicleCount !== undefined && matchingTierFound.vehicleCount > 0 
          ? matchingTierFound.vehicleCount 
          : 1;
        vehiclesAllocated = tierVehicles * quantity;
        
        // Applicable price comes from the product capacity rule
        const tierNett = matchingTierFound.supplierNett !== undefined 
          ? matchingTierFound.supplierNett 
          : (matchingTierFound.nettPrice !== undefined 
            ? matchingTierFound.nettPrice 
            : (matchingTierFound.netCostPerPax !== undefined ? matchingTierFound.netCostPerPax : unitVehicleNetCost));
          
        rawTotalNetCostInNative = tierNett * quantity;
      } else {
        // totalOccupiedSeats exceeds configured tiers
        // Determine required vehicles using the Product's configured capacity rules (NOT generic physical vehicle capacity)
        const highestTier = sortedTiers[sortedTiers.length - 1];
        const highestTierCapacity = highestTier.maxPax || genericPhysicalCapacity;
        const highestTierVehicles = highestTier.vehicleCount || 1;
        const capacityPerVehicle = Math.max(1, Math.floor(highestTierCapacity / highestTierVehicles));
        
        vehiclesAllocated = Math.max(quantity, Math.ceil(totalOccupiedSeats / capacityPerVehicle) * quantity);
        if (vehiclesAllocated > maxVehicles && !allowMultiple) {
          capacityExceeded = true;
          capacityErrorMessage = `Passenger count (${totalOccupiedSeats} seats) exceeds maximum configured capacity (${highestTierCapacity} seats).`;
        }
        
        const tierUnitCost = highestTier.supplierNett !== undefined 
          ? highestTier.supplierNett 
          : (highestTier.nettPrice !== undefined 
            ? highestTier.nettPrice 
            : (highestTier.netCostPerPax !== undefined ? highestTier.netCostPerPax : unitVehicleNetCost));
        
        // Scale by vehicle units
        rawTotalNetCostInNative = Math.ceil(vehiclesAllocated / highestTierVehicles) * tierUnitCost;
      }
    } else {
      // No tiered rules configured - calculate based on unit cost with generic physical capacity as last resort
      vehiclesAllocated = Math.max(quantity, Math.ceil(totalOccupiedSeats / genericPhysicalCapacity) * quantity);
      rawTotalNetCostInNative = vehiclesAllocated * unitVehicleNetCost;
    }

    const perPersonNetInNative = totalPax > 0 ? rawTotalNetCostInNative / totalPax : rawTotalNetCostInNative;

    adultNetInNative = rawTotalNetCostInNative;
    childNetInNative = 0;
    infantNetInNative = 0;

    vehicleDetails = {
      vehicleName: matchingTierFound?.fleetName || vehicleConfig?.vehicleName || vehicleModel,
      vehicleModel,
      vehicleType,
      maxSeats: matchingTierFound?.maxPax || genericPhysicalCapacity,
      occupiedSeats: totalOccupiedSeats,
      vehiclesAllocated,
      vehiclesRequired: vehiclesAllocated,
      unitVehicleNetCost,
      totalVehicleNetCost: rawTotalNetCostInNative,
      perPersonNetCost: perPersonNetInNative,
      capacityExceeded,
      capacityErrorMessage,
      seatBreakdown: {
        adultSeats: adultSeatsOccupied,
        childSeats: childSeatsOccupied,
        infantSeats: infantSeatsOccupied,
        totalSeats: totalOccupiedSeats
      },
      allowMultipleVehicles: allowMultiple
    } as any;
  } else if (isFixedStayHotel) {
    // Fixed Total Stay Net Cost for Manual Hotel / Room Configuration
    let fixedStayBase = baseAdultNet;
    if ((product as any).manualHotelDetails) {
      const m = (product as any).manualHotelDetails;
      if (m.rateCurrency || m.currency) {
        nativeCurrency = (m.rateCurrency || m.currency) as CurrencyCode;
      }
      const mNights = Math.max(1, Number(m.numberOfNights ?? m.nights ?? 1));
      const mRooms = Math.max(1, Number(m.numberOfRooms ?? m.roomsCount ?? m.rooms ?? 1));
      const mRate = Number(m.ratePerNight ?? m.customRate ?? m.sellingPrice ?? m.netCost ?? 0);
      const mBasis = m.rateBasis || m.rateType || 'PER_ROOM_PER_NIGHT';
      if (mRate > 0) {
        if (mBasis === 'TOTAL_STAY') {
          fixedStayBase = mRate;
        } else if (mBasis === 'PER_ROOM_TOTAL_STAY') {
          fixedStayBase = mRate * mRooms;
        } else if (mBasis === 'PER_NIGHT') {
          fixedStayBase = mRate * mNights;
        } else if (mBasis === 'PER_PERSON_PER_NIGHT') {
          const cRate = typeof m.childRate === 'number' ? m.childRate : 0;
          fixedStayBase = (mRate * adults + cRate * children) * mNights;
        } else if (mBasis === 'PER_PERSON') {
          const cRate = typeof m.childRate === 'number' ? m.childRate : 0;
          fixedStayBase = (mRate * adults + cRate * children);
        } else {
          fixedStayBase = mRate * mRooms * mNights;
        }
        if (typeof m.extraBedRate === 'number' && m.extraBedRate > 0) {
          fixedStayBase += m.extraBedRate * mNights;
        }
      }
    }
    if (!fixedStayBase) {
      fixedStayBase = Number((product as any).basePrice ?? (product as any).sellingPriceStartingFrom ?? 0);
    }
    rawTotalNetCostInNative = fixedStayBase * quantity;
    adultNetInNative = rawTotalNetCostInNative;
    childNetInNative = 0;
    infantNetInNative = 0;
  } else if ((product.category as string) === 'Guides' || (product.category as string) === 'Guide' || (product as any).hourlyNetPrice || product.pricingMethod === 'hourly_based') {
    // Hourly Guide Service Pricing Engine (Section 17)
    const minHours = (product as any).minHours || product.guideConfig?.minHours || 4;
    const requestedHours = (request as any).serviceDurationHours || (request as any).hours || minHours;
    const billableHours = Math.max(minHours, requestedHours);
    const hourlyRate = product.hourlyNettCost || (product as any).hourlyNetPrice || product.guideConfig?.hourlyNetRate || baseAdultNet || 6000;
    rawTotalNetCostInNative = hourlyRate * billableHours * quantity;
    adultNetInNative = rawTotalNetCostInNative;
    childNetInNative = 0;
    infantNetInNative = 0;
  } else if ((product.category as string) === 'Lunch / Dinner Restaurant' || (product.category as string) === 'Restaurant') {
    // Restaurant Meal + Passenger Pricing Engine (Sections 18 & 19)
    const requestedMeal = (request as any).meal || (product.mealSelect && product.mealSelect[0]) || 'Lunch';
    const mealPricingList = product.mealPricing || product.restaurantConfig?.mealPricing || [];
    const matchedMeal = mealPricingList.find(m => m.meal && m.meal.toLowerCase() === (requestedMeal || '').toLowerCase() && m.status !== 'INACTIVE')
      || mealPricingList[0];

    if (matchedMeal) {
      const adultNett = matchedMeal.adultNettPrice !== undefined ? matchedMeal.adultNettPrice : baseAdultNet;
      const childNett = matchedMeal.childNettPrice !== undefined ? matchedMeal.childNettPrice : baseChildNet;
      const infantNett = matchedMeal.infantNettPrice || 0;
      
      adultNetInNative = adultNett * adults * quantity;
      childNetInNative = childNett * children * quantity;
      infantNetInNative = infantNett * infants * quantity;
      rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
    } else {
      adultNetInNative = baseAdultNet * adults * quantity;
      childNetInNative = baseChildNet * children * quantity;
      infantNetInNative = baseInfantNet * infants * quantity;
      rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
    }
  } else if ((product.category as string) === 'Tickets' || (product.category as string) === 'Ticket') {
    // Ticket Per-Person Pricing Engine (Section 15)
    const ticketTiers = product.ticketConfig?.ticketTiers || [];
    const requestedTierId = (request as any).ticketTierId || (request as any).tierId;
    const matchedTier = ticketTiers.find(t => t.id === requestedTierId && t.status !== 'INACTIVE') || ticketTiers[0];

    if (matchedTier) {
      const adultNett = matchedTier.adultNetPrice !== undefined ? matchedTier.adultNetPrice : baseAdultNet;
      const childNett = matchedTier.childNetPrice !== undefined ? matchedTier.childNetPrice : baseChildNet;
      const infantNett = matchedTier.infantNetPrice || 0;
      adultNetInNative = adultNett * adults * quantity;
      childNetInNative = childNett * children * quantity;
      infantNetInNative = infantNett * infants * quantity;
      rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
    } else {
      adultNetInNative = baseAdultNet * adults * quantity;
      childNetInNative = baseChildNet * children * quantity;
      infantNetInNative = baseInfantNet * infants * quantity;
      rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
    }
  } else {
    // Standard Per-Person Tour / Activity Pricing Engine (Section 16)
    adultNetInNative = baseAdultNet * adults * quantity;
    childNetInNative = baseChildNet * children * quantity;
    infantNetInNative = baseInfantNet * infants * quantity;
    rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
  }

  // Optional Experience Upgrades / Upsells & Add-ons Calculation (Section 20-21)
  let addonsNetInNative = 0;
  const activeUpsellIds = request.selectedUpsellIds || request.selectedAddonIds || [];
  
  if (activeUpsellIds.length > 0) {
    // 1. Check Product Upsells first (Authoritative Master Source)
    if (product.upsells && product.upsells.length > 0) {
      const selectedUpsells = product.upsells.filter(u => 
        u.status !== 'INACTIVE' && u.status !== 'ARCHIVED' && activeUpsellIds.includes(u.id)
      );
      for (const upsell of selectedUpsells) {
        const isPerBooking = upsell.priceType === 'PER_BOOKING' || upsell.priceType === 'PER_VEHICLE';
        const chargeablePax = isPerBooking ? 1 : (isCapacity ? 1 : (adults + children));
        const unitCost = upsell.netCost !== undefined ? upsell.netCost : upsell.price;
        const upsellAmountConverted = convertCurrency(unitCost * chargeablePax * quantity, upsell.currency, product.currency);
        addonsNetInNative += upsellAmountConverted;
      }
    } else if (product.addons && product.addons.length > 0) {
      // 2. Fallback to product.addons
      const selectedAddons = product.addons.filter(a => activeUpsellIds.includes(a.id));
      for (const addon of selectedAddons) {
        const chargeablePax = isCapacity ? 1 : (adults + children);
        const addonAmountConverted = convertCurrency(addon.pricePerPax * chargeablePax * quantity, addon.currency, product.currency);
        addonsNetInNative += addonAmountConverted;
      }
    }
  }

  rawTotalNetCostInNative += addonsNetInNative;

  // =========================================================================
  // STRICTLY EXCLUSIVE MARGIN ENGINE (PRODUCT-LEVEL vs AGENT-LEVEL)
  // =========================================================================
  // Rule 1: IF Product-Level Margin = ON  -> Apply Product-Level Margin; Agent-Level Margin = 0 / DISABLED
  // Rule 2: IF Product-Level Margin = OFF -> Product-Level Margin = 0 / DISABLED; Apply Agent-Level Margin
  // Rule 3: Never apply both Product-Level Margin and Agent-Level Margin simultaneously.
  // Rule 4: Buyer-Level Margin is completely removed from all calculations.
  let configuredMarkupPercent = 20;
  let selectedMarginRuleId = (product as any).rateId || authoritativeRateId || `RULE-PROD-${product.id}`;
  let selectedMarginType: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE';
  let selectedMarginValue = 20;
  let selectedMarginReason = 'System fallback default margin (20%)';

  if (request.customMarkupPercent !== undefined) {
    configuredMarkupPercent = request.customMarkupPercent;
    selectedMarginValue = configuredMarkupPercent;
    selectedMarginRuleId = 'RULE-CUSTOM-OVERRIDE';
    selectedMarginReason = `Explicit request customMarkupPercent (${request.customMarkupPercent}%)`;
  } else if (!isProductLevelMarginEnabled) {
    // CASE 2: Product-Level Margin = OFF -> Apply ONLY Agent-Level Margin (Product-Level Margin = 0 / DISABLED)
    configuredMarkupPercent = configuredAgentLevelMarginPercent;
    selectedMarginValue = configuredMarkupPercent;
    selectedMarginType = 'PERCENTAGE';
    selectedMarginRuleId = 'RULE-AGENT-LEVEL-MARGIN';
    selectedMarginReason = `Agent-Level Margin (${configuredMarkupPercent}%) — Product-Level Margin OFF`;
  } else if (isFixedStayHotel) {
    // CASE 1 (Hotel): Product-Level Margin = ON
    configuredMarkupPercent = product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 0;
    selectedMarginValue = configuredMarkupPercent;
    selectedMarginRuleId = `RULE-HOTEL-${product.id}`;
    selectedMarginReason = product.b2bAgentMarkupPercent !== undefined
      ? `Hotel B2B Agent margin (${product.b2bAgentMarkupPercent}%)`
      : `Hotel default margin (${configuredMarkupPercent}%)`;
  } else if ((product as any).marginStatus === 'INACTIVE') {
    // CASE 1 (Product Margin Governance INACTIVE): Product-Level Margin is ON at account level,
    // but this product's governance margin configuration is explicitly deactivated (0% product margin).
    configuredMarkupPercent = 0;
    selectedMarginValue = 0;
    selectedMarginType = 'PERCENTAGE';
    selectedMarginRuleId = `RULE-PROD-INACTIVE-${product.id}`;
    selectedMarginReason = `Product margin configuration is INACTIVE (0% product margin applied)`;
  } else {
    // CASE 1 (Product): Product-Level Margin = ON -> Apply Product-Level Margin; Agent-Level Margin is DISABLED
    if ((product as any).marginType === 'FIXED' && (product as any).marginFixed !== undefined) {
      configuredMarkupPercent = 0;
      selectedMarginType = 'FIXED';
      selectedMarginValue = Number((product as any).marginFixed);
      selectedMarginRuleId = `RULE-PROD-FIXED-${product.id}`;
      selectedMarginReason = `Product fixed margin (${selectedMarginValue} ${nativeCurrency})`;
    } else if (rateMarkupAgent !== undefined) {
      configuredMarkupPercent = rateMarkupAgent;
      selectedMarginValue = rateMarkupAgent;
      selectedMarginRuleId = authoritativeRateId || `RULE-RATE-${product.id}`;
      selectedMarginReason = `Active Master Rate Sheet B2B margin (${rateMarkupAgent}%)`;
    } else if (isCapacity && matchingTierFound && (matchingTierFound as any).b2bMargin !== undefined) {
      configuredMarkupPercent = (matchingTierFound as any).b2bMargin;
      selectedMarginValue = configuredMarkupPercent;
      selectedMarginRuleId = (matchingTierFound as any).pricingRuleId || matchingTierFound.id || `RULE-TIER-${product.id}`;
      selectedMarginReason = `Capacity tier B2B margin (${configuredMarkupPercent}%) for ${matchingTierFound.minPax}-${matchingTierFound.maxPax} pax`;
    } else if (isCapacity && matchingTierFound && matchingTierFound.marginValue !== undefined) {
      configuredMarkupPercent = matchingTierFound.marginValue;
      selectedMarginValue = matchingTierFound.marginValue;
      selectedMarginType = matchingTierFound.marginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
      selectedMarginRuleId = (matchingTierFound as any).pricingRuleId || matchingTierFound.id || `RULE-TIER-${product.id}`;
      selectedMarginReason = `Capacity tier margin rule ${(matchingTierFound as any).pricingRuleId || matchingTierFound.id} (${matchingTierFound.marginValue}${selectedMarginType === 'PERCENTAGE' ? '%' : ' fixed'}) for ${matchingTierFound.minPax}-${matchingTierFound.maxPax} pax`;
    } else if (product.b2bAgentMarkupPercent !== undefined) {
      configuredMarkupPercent = product.b2bAgentMarkupPercent;
      selectedMarginValue = product.b2bAgentMarkupPercent;
      selectedMarginRuleId = `RULE-PROD-B2B-${product.id}`;
      selectedMarginReason = `Product B2B Agent margin b2bAgentMarkupPercent (${product.b2bAgentMarkupPercent}%)`;
    } else if (product.defaultMarkupPercent !== undefined) {
      configuredMarkupPercent = product.defaultMarkupPercent;
      selectedMarginValue = product.defaultMarkupPercent;
      selectedMarginRuleId = `RULE-PROD-DEFAULT-${product.id}`;
      selectedMarginReason = `Product default margin defaultMarkupPercent (${product.defaultMarkupPercent}%) — no distinct B2B override configured`;
    } else {
      configuredMarkupPercent = 20;
      selectedMarginValue = 20;
      selectedMarginRuleId = 'RULE-SYSTEM-DEFAULT-20';
      selectedMarginReason = 'Centralized system fallback B2B margin (20%)';
    }
  }

  // COMMERCIAL PRICING PRINCIPLE: CALCULATE NATIVE FIRST, CONVERT SECOND
  // Universal B2B Pricing Formula (Sections 4, 20, 24, 49):
  // 1. Margin Amount = Nett Cost × B2B Margin %
  // 2. Tax Amount = Margin Amount × Tax % (Tax is strictly on Margin)
  // 3. Subtotal = Nett Cost + Margin Amount + Tax Amount
  // 4. Service Fee Amount = Subtotal × Service Fee % (Service Fee on Subtotal)
  // 5. Price = Subtotal + Service Fee Amount
  const nativeTotalNetCost = rawTotalNetCostInNative;
  let markupRate = configuredMarkupPercent / 100;
  let nativeMarkupAmount = nativeTotalNetCost * markupRate;

  // Support for configured fixed margin amounts ONLY when Product-Level Margin is ON and rule is ACTIVE
  if (isProductLevelMarginEnabled && request.customMarkupPercent === undefined && (product as any).marginStatus !== 'INACTIVE') {
    if (isCapacity && matchingTierFound && matchingTierFound.marginType === 'FIXED' && matchingTierFound.marginValue !== undefined) {
      nativeMarkupAmount = matchingTierFound.marginValue * quantity;
      markupRate = nativeTotalNetCost > 0 ? nativeMarkupAmount / nativeTotalNetCost : 0;
      selectedMarginType = 'FIXED';
      selectedMarginValue = matchingTierFound.marginValue;
    } else if ((product as any).marginType === 'FIXED' && (product as any).marginFixed !== undefined) {
      nativeMarkupAmount = Number((product as any).marginFixed) * (isCapacity ? 1 : totalPax);
      markupRate = nativeTotalNetCost > 0 ? nativeMarkupAmount / nativeTotalNetCost : 0;
      selectedMarginType = 'FIXED';
      selectedMarginValue = Number((product as any).marginFixed);
      selectedMarginRuleId = `RULE-PROD-FIXED-${product.id}`;
      selectedMarginReason = `Product fixed margin (${selectedMarginValue} ${nativeCurrency})`;
    }
  }

  // Authoritative Tax on Margin (Section 4 & 24)
  const configuredTaxPercent = (isCapacity && matchingTierFound && matchingTierFound.taxValue !== undefined)
    ? matchingTierFound.taxValue
    : (rateTaxPercentage !== undefined 
      ? rateTaxPercentage 
      : (product.taxPercent !== undefined ? product.taxPercent : 10));
  const taxRate = configuredTaxPercent / 100;
  const nativeTaxAmount = nativeMarkupAmount * taxRate;

  // Subtotal = Nett Cost + Margin Amount + Tax Amount
  const nativeSubtotal = nativeTotalNetCost + nativeMarkupAmount + nativeTaxAmount;

  // Service Fee on Subtotal (Section 4 & 24)
  let nativeServiceFee = 0;
  if (isCapacity && matchingTierFound && matchingTierFound.serviceChargeValue !== undefined) {
    const sType = matchingTierFound.serviceChargeType || 'PERCENTAGE';
    if (sType === 'PERCENTAGE') {
      nativeServiceFee = nativeSubtotal * (matchingTierFound.serviceChargeValue / 100);
    } else if (sType === 'FIXED') {
      nativeServiceFee = matchingTierFound.serviceChargeValue * quantity;
    }
  } else if (Number((product as any).serviceFeeFixed) > 0) {
    nativeServiceFee = Number((product as any).serviceFeeFixed) * (isCapacity ? 1 : totalPax);
  } else if ((product as any).serviceFeePercent !== undefined) {
    nativeServiceFee = nativeSubtotal * ((product as any).serviceFeePercent / 100);
  } else if ((product as any).serviceFee !== undefined) {
    const rawFee = (product as any).serviceFee;
    if (typeof rawFee === 'number' && rawFee > 0 && rawFee <= 100) {
      nativeServiceFee = nativeSubtotal * (rawFee / 100);
    } else if (typeof rawFee === 'number' && rawFee > 100) {
      nativeServiceFee = rawFee * (isCapacity ? 1 : totalPax);
    }
  }

  // Pre-discount total Price
  let nativeFinalSellingPrice = nativeSubtotal + nativeServiceFee;

  // Discounts & Commissions in Native Currency
  const discountPercent = request.customDiscountPercent || 0;
  const discountRate = discountPercent / 100;
  const nativeDiscountAmount = nativeFinalSellingPrice * discountRate;
  nativeFinalSellingPrice -= nativeDiscountAmount;

  const baseNativeSellingPriceBeforeSurcharges = nativeFinalSellingPrice;
  const targetCurrency = request.targetCurrency || nativeCurrency;
  const isConverted = targetCurrency !== nativeCurrency;

  // Centralized Surcharge Evaluation (Finance & Administration -> Surcharges)
  // Pass full central master catalog (including INACTIVE/ARCHIVED for migration provenance deduplication;
  // evaluateCentralizedProductSurcharges strictly filters to ACTIVE rules when computing amounts).
  const allApplicableSurchargeMasters = AppDatabase.getInstance().getSurchargeMasters(true);

  const explicitServiceEndDate =
    (request.serviceEndDate || (product as any).checkOutDate || (product as any).manualHotelDetails?.checkOutDate || '').trim() || undefined;
  const resolvedProductName = (request.productName || product.name || (product as any).title || '').trim();
  const effectiveNights = (request as any).nights || (product as any).nights;
  const effectiveRoomsCount = (request as any).roomsCount || (product as any).roomsCount || 1;
  const effectiveCoverageDays = (request as any).coverageDays || (product as any).coverageDays;

  const centralizedSurchargeEval = evaluateCentralizedProductSurcharges({
    product,
    productName: resolvedProductName,
    itemId: request.itemId,
    quoteId: request.quoteId,
    quoteVersion: request.quoteVersion,
    serviceDate: explicitServiceDate,
    travelDate: explicitServiceDate,
    serviceEndDate: explicitServiceEndDate,
    bookingDate: request.bookingDate,
    nights: effectiveNights,
    coverageDays: effectiveCoverageDays,
    adults,
    children,
    infants,
    roomsCount: effectiveRoomsCount,
    vehiclesCount: vehicleDetails?.vehiclesAllocated || quantity,
    hoursCount: (request as any).serviceDurationHours || (request as any).hours || (product as any).minHours || 1,
    devicesCount: (request as any).devicesCount || adults,
    quantity,
    baseNativeSellingAmount: baseNativeSellingPriceBeforeSurcharges,
    baseSellingPriceInTargetCurrency: request.baseSellingPriceInTargetCurrency,
    productNativeCurrency: nativeCurrency,
    targetCurrency,
    centralizedSurcharges: allApplicableSurchargeMasters,
    overrides: request.surchargeOverrides,
    frozenAppliedSurcharges: request.frozenAppliedSurcharges
  });

  nativeFinalSellingPrice = Math.round((baseNativeSellingPriceBeforeSurcharges + centralizedSurchargeEval.surchargeTotalInProductNative) * 100) / 100;

  const commissionPercent = product.commissionPercent || 0;
  const commissionRate = commissionPercent / 100;
  const nativeCommissionAmount = nativeTotalNetCost * commissionRate;

  const nativeGrossBeforeTax = nativeTotalNetCost + nativeMarkupAmount;
  const nativePricePerPerson = totalPax > 0 ? nativeFinalSellingPrice / totalPax : nativeFinalSellingPrice;

  // B2B Wholesale reporting values
  const b2bWholesaleMarkupRate = markupRate;
  const nativeB2bWholesaleNetToAgent = nativeFinalSellingPrice;
  const agentClientMarkupRate = (request.agentClientMarkupPercent || 0) / 100;
  const nativeAgentProfitAmount = 0;

  // 2. AUTHORITATIVE CURRENCY CONVERSION & ROUNDING
  // Calculation Flow: Supplier Nett Cost -> Currency Conversion -> Base Margin -> Taxes/Fees/Discounts -> Line-Item B2B Selling Price
  const snapshotRateOverride: number | undefined =
    typeof (request as any).snapshotExchangeRate === 'number' && (request as any).snapshotExchangeRate > 0
      ? (request as any).snapshotExchangeRate
      : undefined;

  const fxMeta = currencyEngine.convertWithMetadata(nativeTotalNetCost, nativeCurrency, targetCurrency, snapshotRateOverride);
  const combinedFxValid = fxMeta.isValid && centralizedSurchargeEval.fxValid;
  const combinedFxError = fxMeta.error || centralizedSurchargeEval.fxError;

  const fxDetails: FXRateDetails = {
    ...currencyEngine.getRateInfo(nativeCurrency, targetCurrency),
    effectiveRate: fxMeta.exchangeRate,
    rateDirection: fxMeta.rateDirection,
    rateVersion: fxMeta.rateVersion,
    isConverted: fxMeta.isConverted,
    isValid: combinedFxValid,
    validationError: combinedFxError
  };

  const conv = (val: number): number => {
    if (!combinedFxValid) return 0;
    if (!fxMeta.isConverted) return roundCurrencyAmount(val, targetCurrency);
    return roundCurrencyAmount(val * fxMeta.exchangeRate, targetCurrency);
  };

  const totalNetCost = conv(nativeTotalNetCost);
  const adultsSubtotalNet = conv(adultNetInNative);
  const childrenSubtotalNet = conv(childNetInNative);
  const infantsSubtotalNet = conv(infantNetInNative);
  const addonsSubtotalNet = conv(addonsNetInNative);

  // Compute commercial components in targetCurrency from converted totalNetCost so line-item sum is 100% consistent
  let markupAmount = 0;
  if (combinedFxValid) {
    if (
      isProductLevelMarginEnabled &&
      request.customMarkupPercent === undefined &&
      (product as any).marginStatus !== 'INACTIVE' &&
      isCapacity &&
      matchingTierFound &&
      matchingTierFound.marginType === 'FIXED' &&
      matchingTierFound.marginValue !== undefined
    ) {
      markupAmount = conv(matchingTierFound.marginValue * quantity);
    } else if (
      isProductLevelMarginEnabled &&
      request.customMarkupPercent === undefined &&
      (product as any).marginStatus !== 'INACTIVE' &&
      (product as any).marginType === 'FIXED' &&
      (product as any).marginFixed !== undefined
    ) {
      markupAmount = conv(Number((product as any).marginFixed) * (isCapacity ? 1 : totalPax));
    } else {
      markupAmount = roundCurrencyAmount(totalNetCost * markupRate, targetCurrency);
    }
  }

  const taxAmount = combinedFxValid ? roundCurrencyAmount(markupAmount * taxRate, targetCurrency) : 0;
  const convertedSubtotal = roundCurrencyAmount(totalNetCost + markupAmount + taxAmount, targetCurrency);

  let serviceFee = 0;
  if (combinedFxValid) {
    if (isCapacity && matchingTierFound && matchingTierFound.serviceChargeValue !== undefined) {
      const sType = matchingTierFound.serviceChargeType || 'PERCENTAGE';
      if (sType === 'PERCENTAGE') {
        serviceFee = roundCurrencyAmount(convertedSubtotal * (matchingTierFound.serviceChargeValue / 100), targetCurrency);
      } else if (sType === 'FIXED') {
        serviceFee = conv(matchingTierFound.serviceChargeValue * quantity);
      }
    } else if ((product as any).serviceFeeFixed !== undefined && Number((product as any).serviceFeeFixed) > 0) {
      serviceFee = conv(Number((product as any).serviceFeeFixed) * (isCapacity ? 1 : totalPax));
    } else if ((product as any).serviceFeePercent !== undefined) {
      serviceFee = roundCurrencyAmount(convertedSubtotal * ((product as any).serviceFeePercent / 100), targetCurrency);
    } else if ((product as any).serviceFee !== undefined) {
      const rawFee = (product as any).serviceFee;
      if (typeof rawFee === 'number' && rawFee > 0 && rawFee <= 100) {
        serviceFee = roundCurrencyAmount(convertedSubtotal * (rawFee / 100), targetCurrency);
      } else if (typeof rawFee === 'number' && rawFee > 100) {
        serviceFee = conv(rawFee * (isCapacity ? 1 : totalPax));
      }
    }
  }

  const preDiscountConverted = roundCurrencyAmount(convertedSubtotal + serviceFee, targetCurrency);
  const discountAmount = combinedFxValid && discountRate > 0
    ? roundCurrencyAmount(preDiscountConverted * discountRate, targetCurrency)
    : 0;
  const baseSellingPriceBeforeSurcharges = Math.max(0, roundCurrencyAmount(preDiscountConverted - discountAmount, targetCurrency));
  const reconciledProductSurcharges = combinedFxValid
    ? reconcileAppliedSurchargesMetadataAndStacking({
        appliedSurcharges: centralizedSurchargeEval.appliedSurcharges,
        itemId: request.itemId,
        product,
        productName: resolvedProductName,
        serviceDate: explicitServiceDate || travelDate,
        serviceEndDate: explicitServiceEndDate,
        nights: effectiveNights,
        targetCurrency,
        baseSellingPriceInTargetCurrency: baseSellingPriceBeforeSurcharges,
        quoteId: request.quoteId,
        quoteVersion: request.quoteVersion,
        masterSurcharges: allApplicableSurchargeMasters,
        preserveHistoricalAmounts: true
      })
    : centralizedSurchargeEval.appliedSurcharges;
  const convertedSurchargeTotal = combinedFxValid
    ? roundCurrencyAmount(
        reconciledProductSurcharges.length > 0
          ? reconciledProductSurcharges.reduce((sum, s) => sum + (s.appliedAmountConverted || 0), 0)
          : centralizedSurchargeEval.surchargeTotalConverted,
        targetCurrency
      )
    : 0;
  const finalTotalSellingPrice = combinedFxValid
    ? Math.max(0, roundCurrencyAmount(baseSellingPriceBeforeSurcharges + convertedSurchargeTotal, targetCurrency))
    : 0;

  const commissionAmount = fxMeta.isValid ? roundCurrencyAmount(totalNetCost * commissionRate, targetCurrency) : 0;
  const grossBeforeTax = roundCurrencyAmount(totalNetCost + markupAmount, targetCurrency);
  const pricePerPerson = totalPax > 0 ? roundCurrencyAmount(finalTotalSellingPrice / totalPax, targetCurrency) : finalTotalSellingPrice;

  const b2bWholesaleNetToAgent = finalTotalSellingPrice;
  const agentProfitAmount = conv(nativeAgentProfitAmount);

  // Update vehicle details with converted currency costs if applicable
  if (vehicleDetails) {
    vehicleDetails.unitVehicleNetCost = conv(vehicleDetails.unitVehicleNetCost);
    vehicleDetails.totalVehicleNetCost = conv(vehicleDetails.totalVehicleNetCost);
    vehicleDetails.perPersonNetCost = totalPax > 0 ? roundCurrencyAmount(vehicleDetails.totalVehicleNetCost / totalPax, targetCurrency) : vehicleDetails.totalVehicleNetCost;
  }

  const dmcMarginAmount = roundCurrencyAmount(markupAmount + serviceFee - discountAmount, targetCurrency);
  const dmcMarginPercent = totalNetCost > 0 ? (dmcMarginAmount / totalNetCost) * 100 : 0;

  // Proportional breakdown of selling price
  const sellingMultiplier = totalNetCost > 0 ? finalTotalSellingPrice / totalNetCost : 1;
  const adultsSubtotalSelling = isCapacity ? finalTotalSellingPrice : roundCurrencyAmount(adultsSubtotalNet * sellingMultiplier, targetCurrency);
  const childrenSubtotalSelling = isCapacity ? 0 : roundCurrencyAmount(childrenSubtotalNet * sellingMultiplier, targetCurrency);
  const infantsSubtotalSelling = isCapacity ? 0 : roundCurrencyAmount(infantsSubtotalNet * sellingMultiplier, targetCurrency);
  const addonsSubtotalSelling = roundCurrencyAmount(addonsSubtotalNet * sellingMultiplier, targetCurrency);
  const adultPricePerPax = adults > 0 ? (isCapacity ? pricePerPerson : roundCurrencyAmount(adultsSubtotalSelling / adults, targetCurrency)) : 0;
  const childPricePerPax = children > 0 ? (isCapacity ? pricePerPerson : roundCurrencyAmount(childrenSubtotalSelling / children, targetCurrency)) : 0;

  return {
    productId: product.id,
    productName: product.name,
    pricingTier,
    pax: {
      adults,
      children,
      infants,
      totalPax
    },
    travelDate: request.travelDate || new Date().toISOString().split('T')[0],
    currency: targetCurrency,
    adultsSubtotalNet,
    childrenSubtotalNet,
    infantsSubtotalNet,
    addonsSubtotalNet,
    totalNetCost,
    activeMarginMode,
    productLevelMarginEnabled: isProductLevelMarginEnabled,
    b2bWholesaleMarkupRate,
    b2bWholesaleNetToAgent,
    agentClientMarkupRate: 0,
    agentProfitAmount: 0,
    markupRate,
    markupAmount,
    grossBeforeTax,
    taxRate,
    taxAmount,
    serviceFee,
    discountRate,
    discountAmount,
    commissionRate,
    commissionAmount,
    adultsSubtotalSelling,
    childrenSubtotalSelling,
    infantsSubtotalSelling,
    addonsSubtotalSelling,
    adultPricePerPax,
    childPricePerPax,
    price: finalTotalSellingPrice,
    finalTotalSellingPrice,
    totalSellingPrice: finalTotalSellingPrice,
    sellingPriceFinal: finalTotalSellingPrice,
    pricePerPerson,
    marginAmount: markupAmount,
    serviceFeeAmount: serviceFee,
    dmcMarginAmount,
    dmcMarginPercent,
    isCapacityBased: isCapacity,
    pricingMethod: isCapacity ? 'capacity_based' : 'per_person',
    vehicleDetails,

    // Native Commercial Calculation (Calculate Native First, Convert Second)
    nativeCurrency,
    nativeTotalNetCost,
    nativeGrossBeforeTax,
    nativeMarkupAmount,
    nativeTaxAmount,
    nativeFinalSellingPrice,
    nativePricePerPerson,
    fxDetails,

    // Master Pricing Source of Truth & Audit Fields
    rateId: authoritativeRateId || (product as any).rateId || 'RTE-DEF-001',
    rateVersion: authoritativeRateVersion || 1,
    rateEffectiveFrom: authoritativeRateFrom || product.validity?.validFrom || product.validityFrom || '2026-01-01',
    rateEffectiveTo: authoritativeRateTo || product.validity?.validTo || product.validityTo || '2026-12-31',
    isAuthoritative: true,
    sourceCollection: authoritativeSourceCollection,
    pricingRequestId: `PRQ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    calculatedAt: new Date().toISOString(),

    // Calculation-Level Margin Diagnostics (Internal/Admin/Dev only; stripped for B2B Agents)
    marginRuleId: selectedMarginRuleId,
    marginType: selectedMarginType,
    marginValue: selectedMarginValue,
    marginSelectionReason: selectedMarginReason,

    // Validity & Surcharge Evaluation Snapshot
    validityCheck,
    appliedSurcharges: reconciledProductSurcharges,
    surchargeTotalNative: centralizedSurchargeEval.surchargeTotalInProductNative,
    surchargeTotal: convertedSurchargeTotal,
    baseSellingPriceBeforeSurcharges,
    surchargeValidationMessage: centralizedSurchargeEval.validationMessage || centralizedSurchargeEval.fxError,
    surchargeCatalogVersion: pricingCache.getSurchargeCatalogVersion()
  } as PricingCalculationResult;
}

export interface ComponentCalculationDiagnostic {
  packageId: string;
  productId: string;
  productName: string;
  nettPrice: number;
  sourceCurrency: CurrencyCode;
  marginRuleId: string;
  marginType: 'PERCENTAGE' | 'FIXED';
  marginValue: number;
  b2bAgent: string;
  convertedNettPrice: number;
  targetCurrency: CurrencyCode;
  calculatedSellingPrice: number;
  selectionReason: string;
}

/**
 * Generates and logs calculation-level diagnostics for Ready-Made Package components.
 * Restricted strictly to Admin / Internal users or development diagnostics; never exposed to B2B Agents.
 */
export function buildPackageCalculationDiagnostics(
  packageId: string,
  packageName: string,
  items: Array<{ product: Product; pax?: { adults: number; children: number; infants: number }; travelDate?: string }>,
  targetCurrency: CurrencyCode = 'USD',
  user?: User | null
): ComponentCalculationDiagnostic[] {
  const isInternalOrAdmin = user?.role === 'ADMIN' || user?.role === 'DMC_STAFF' || user?.category === 'INTERNAL';
  const isDevEnv = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV);
  if (!isInternalOrAdmin && !isDevEnv) {
    return [];
  }

  const db = AppDatabase.getInstance();
  const masterProducts = db.getProducts();
  const agentLabel = user ? `${user.name || user.email} (${user.role})` : 'B2B_AGENT (Standard Tier)';

  const diagnostics: ComponentCalculationDiagnostic[] = items.map(item => {
    const masterProd = masterProducts.find(
      p => p.id === item.product.id || p.product_id === item.product.id || (item.product.sku && p.sku === item.product.sku)
    ) || item.product;

    const fullCalc = calculateProductPrice(masterProd, {
      productId: masterProd.id,
      pricingTier: 'B2B',
      adults: item.pax?.adults ?? 2,
      children: item.pax?.children ?? 0,
      infants: item.pax?.infants ?? 0,
      travelDate: item.travelDate || new Date().toISOString().split('T')[0],
      targetCurrency,
      userRole: 'B2B_AGENT',
      user
    }) as any;

    return {
      packageId,
      productId: masterProd.id,
      productName: masterProd.name,
      nettPrice: fullCalc.nativeTotalNetCost ?? 0,
      sourceCurrency: (fullCalc.nativeCurrency || masterProd.currency || 'USD') as CurrencyCode,
      marginRuleId: fullCalc.marginRuleId || fullCalc.rateId || `RULE-PROD-${masterProd.id}`,
      marginType: fullCalc.marginType || 'PERCENTAGE',
      marginValue: fullCalc.marginValue ?? Math.round((fullCalc.markupRate || 0) * 10000) / 100,
      b2bAgent: agentLabel,
      convertedNettPrice: fullCalc.totalNetCost ?? 0,
      targetCurrency,
      calculatedSellingPrice: fullCalc.finalTotalSellingPrice ?? 0,
      selectionReason: fullCalc.marginSelectionReason || 'Database product B2B margin rule'
    };
  });

  if (isInternalOrAdmin) {
    console.debug(`[PricingEngine Diagnostics] Package "${packageName}" (${packageId}) — ${diagnostics.length} components:`, diagnostics);
  }

  return diagnostics;
}

/**
 * Authoritative Customer-Facing Pricing for B2B Agents
 * Returns sanitized AgentPricingResponse with ZERO internal net cost or commercial margin fields.
 */
export function calculateProductPriceForAgent(
  product: Product,
  request: PricingCalculationRequest
): AgentPricingResponse {
  const fullResult = calculateProductPrice(product, {
    ...request,
    userRole: 'B2B_AGENT',
    pricingTier: 'B2B'
  });
  return sanitizePricingResultForAgent(fullResult);
}

/**
 * PACKAGE PRICING SERVICE - UNIFIED & CONTROLLED (Section 13)
 * Authoritatively calculates package Final Selling Price based on inclusions,
 * dynamic component rates, and tiered role rules.
 * Never exposes internal net costs, markups, or tax breakdowns to non-admin roles!
 */
export interface PackagePricingRequest {
  packageId?: string;
  packageItem?: B2BPackage;
  adults?: number;
  children?: number;
  infants?: number;
  travelDate?: string;
  targetCurrency?: CurrencyCode;
  user?: User | null;
  userRole?: UserRole | string;
  pricingTier?: 'B2B' | 'B2C';
  agentClientMarkupPercent?: number;
  customMarkupPercent?: number;
  customDiscountPercent?: number;
}

export interface PackagePricingComponent {
  id: string;
  name: string;
  category: string;
  type: 'SERVICE' | 'HOTEL';
  dayNumber?: number;
  hubName?: string;
  netPrice: number;        // underlying supplier nett cost in targetCurrency
  sellingPrice: number;    // B2B selling price in targetCurrency from central engine
  retailPrice: number;     // Retail selling price in targetCurrency from central engine
  marginAmount: number;    // sellingPrice - netPrice
  marginPercent: number;   // margin percentage applied by centralized rules
  currency: CurrencyCode;
}

export interface PackagePricingResult {
  success: boolean;
  packageId: string;
  packageTitle: string;
  finalSellingPrice: number;
  pricePerPerson: number;
  currency: CurrencyCode;
  pax: {
    adults: number;
    children: number;
    infants: number;
    totalPax: number;
  };
  isAuthoritative: boolean;
  calculatedAt: string;
  rateId: string;
  rateVersion: number | string;
  // Internal breakdown strictly present ONLY for ADMIN or DMC_STAFF
  internalAudit?: {
    totalNetCostUSD: number;
    totalNetCostTarget: number;
    totalB2BSellingPrice: number;
    totalRetailSellingPrice: number;
    markupAmount: number;
    effectiveMarkupPercent: number;
    pricingMode: string;
    itemsCount: number;
    servicesNetCost: number;
    servicesSellingPrice: number;
    hotelsNetCost: number;
    hotelsSellingPrice: number;
    componentBreakdown: PackagePricingComponent[];
  };
}

export function calculatePackagePrice(request: PackagePricingRequest): PackagePricingResult {
  const db = AppDatabase.getInstance();
  const targetId = request.packageItem?.id || request.packageId;
  const masterPkg = targetId
    ? db.getPackages().find(p => p.id === targetId || p.slug === targetId)
    : undefined;
  const pkg: B2BPackage | undefined = masterPkg && request.packageItem
    ? {
        ...masterPkg,
        ...request.packageItem,
        routeHubs: masterPkg.routeHubs || request.packageItem.routeHubs,
        manualHotels: masterPkg.manualHotels || request.packageItem.manualHotels
      }
    : (request.packageItem || masterPkg);

  if (!pkg) {
    return {
      success: false,
      packageId: request.packageId || 'UNKNOWN',
      packageTitle: 'Package Not Found',
      finalSellingPrice: 0,
      pricePerPerson: 0,
      currency: request.targetCurrency || 'USD',
      pax: { 
        adults: request.adults || 2, 
        children: request.children || 0, 
        infants: request.infants || 0, 
        totalPax: (request.adults || 2) + (request.children || 0) + (request.infants || 0) 
      },
      isAuthoritative: false,
      calculatedAt: new Date().toISOString(),
      rateId: 'RATE-PKG-ERR',
      rateVersion: 1
    };
  }

  const adults = Math.max(1, request.adults || 2);
  const children = Math.max(0, request.children || 0);
  const infants = Math.max(0, request.infants || 0);
  const totalPax = adults + children + infants;
  const targetCurrency: CurrencyCode = request.targetCurrency || pkg.currency || 'USD';

  const userRole = request.userRole || request.user?.role || 'B2B_AGENT';
  const isAdminOrStaff = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'DMC_STAFF' || userRole === 'TEAM_MEMBER';
  const reqCompanyId = (request as any).companyId || request.user?.companyId;
  const reqAgencyName = (request as any).agencyName || request.user?.agencyName;

  const allProducts = db.getProducts();
  const allHotels = db.getHotels();
  const travelDate = request.travelDate || new Date().toISOString().split('T')[0];

  const componentBreakdown: PackagePricingComponent[] = [];
  let servicesNetCost = 0;
  let servicesB2BSelling = 0;

  let hotelsNetCost = 0;
  let hotelsB2BSelling = 0;

  // 1. Process Itinerary & Products (Ground Services, Excursions, Transfers, Rail)
  const processedProductIds = new Set<string>();

  if (Array.isArray(pkg.itinerary) && pkg.itinerary.length > 0) {
    pkg.itinerary.forEach(day => {
      const dayNum = Math.max(1, Number(day.dayNumber) || 1);
      const hubName = day.hubName;
      const dayDateObj = new Date(travelDate);
      if (!isNaN(dayDateObj.getTime())) {
        dayDateObj.setDate(dayDateObj.getDate() + (dayNum - 1));
      }
      const dayTravelDate = !isNaN(dayDateObj.getTime())
        ? dayDateObj.toISOString().split('T')[0]
        : travelDate;

      const productIdsToPrice: string[] = Array.from(
        new Set(
          [
            ...(Array.isArray(day.productIds) ? day.productIds : []),
            ...(day.transferId ? [day.transferId] : []),
            ...(day.railId ? [day.railId] : [])
          ].filter(Boolean)
        )
      );

      productIdsToPrice.forEach(prodId => {
        processedProductIds.add(prodId);
        const prod = allProducts.find(p => p.id === prodId || p.product_id === prodId || p.sku === prodId);
        if (prod) {
          // Calculate using Centralized Pricing Engine for B2B Wholesale (respecting Agency Product-Level vs Agent-Level Margin setting)
          const b2bCalc = calculateProductPrice(prod, {
            productId: prod.id,
            adults,
            children,
            infants,
            travelDate: dayTravelDate,
            targetCurrency,
            pricingTier: 'B2B',
            userRole: 'B2B_AGENT',
            user: request.user,
            companyId: reqCompanyId,
            agencyName: reqAgencyName,
            customMarkupPercent: request.agentClientMarkupPercent
          });

          const cNet = roundCurrencyAmount(b2bCalc.totalNetCost, targetCurrency);
          const cSelling = roundCurrencyAmount(b2bCalc.finalTotalSellingPrice, targetCurrency);
          const cMargin = roundCurrencyAmount(cSelling - cNet, targetCurrency);
          const cMarginPct = cNet > 0 ? Math.round(((cSelling - cNet) / cNet) * 100 * 10) / 10 : (prod.b2bAgentMarkupPercent ?? prod.defaultMarkupPercent ?? 12);

          servicesNetCost += cNet;
          servicesB2BSelling += cSelling;

          componentBreakdown.push({
            id: prod.id,
            name: prod.name,
            category: prod.category || 'Service',
            type: 'SERVICE',
            dayNumber: dayNum,
            hubName,
            netPrice: cNet,
            sellingPrice: cSelling,
            retailPrice: cSelling,
            marginAmount: cMargin,
            marginPercent: cMarginPct,
            currency: targetCurrency
          });
        }
      });
    });
  }

  // Also include any top-level productIds not already processed in itinerary
  if (Array.isArray(pkg.productIds)) {
    pkg.productIds.forEach(prodId => {
      if (!processedProductIds.has(prodId)) {
        processedProductIds.add(prodId);
        const prod = allProducts.find(p => p.id === prodId || p.product_id === prodId || p.sku === prodId);
        if (prod) {
          const b2bCalc = calculateProductPrice(prod, {
            productId: prod.id,
            adults,
            children,
            infants,
            travelDate,
            targetCurrency,
            pricingTier: 'B2B',
            userRole: 'B2B_AGENT',
            user: request.user,
            companyId: reqCompanyId,
            agencyName: reqAgencyName
          });

          const cNet = roundCurrencyAmount(b2bCalc.totalNetCost, targetCurrency);
          const cSelling = roundCurrencyAmount(b2bCalc.finalTotalSellingPrice, targetCurrency);
          const cMargin = roundCurrencyAmount(cSelling - cNet, targetCurrency);
          const cMarginPct = cNet > 0 ? Math.round(((cSelling - cNet) / cNet) * 100 * 10) / 10 : (prod.b2bAgentMarkupPercent ?? prod.defaultMarkupPercent ?? 12);

          servicesNetCost += cNet;
          servicesB2BSelling += cSelling;

          componentBreakdown.push({
            id: prod.id,
            name: prod.name,
            category: prod.category || 'Service',
            type: 'SERVICE',
            netPrice: cNet,
            sellingPrice: cSelling,
            retailPrice: cSelling,
            marginAmount: cMargin,
            marginPercent: cMarginPct,
            currency: targetCurrency
          });
        }
      }
    });
  }

  // 2. Process Accommodations (Hotels) if not Land-Only
  if (!pkg.isLandOnly) {
    if (Array.isArray(pkg.routeHubs) && pkg.routeHubs.length > 0) {
      pkg.routeHubs.forEach(hub => {
        if (hub.accommodationType === 'NO_ACCOMMODATION' || hub.accommodationType === 'none') {
          return;
        }

        const nights = Math.max(1, hub.nights || 1);
        const rooms = Math.max(1, hub.roomsCount || Math.ceil(adults / 2));

        if ((hub.accommodationType === 'MANUAL' || hub.accommodationType === 'manual' || hub.isManualHotel) && hub.manualHotel) {
          const manualProd = manualHotelToProduct(hub.manualHotel, { id: hub.destinationId, name: hub.destinationName }, { adults, children, infants });
          const b2bCalc = calculateProductPrice(manualProd, {
            productId: manualProd.id,
            adults,
            children,
            infants,
            travelDate,
            targetCurrency,
            pricingTier: 'B2B',
            userRole: 'B2B_AGENT',
            user: request.user,
            companyId: reqCompanyId,
            agencyName: reqAgencyName
          });

          const cNet = roundCurrencyAmount(b2bCalc.totalNetCost, targetCurrency);
          const cSelling = roundCurrencyAmount(b2bCalc.finalTotalSellingPrice, targetCurrency);
          const cMargin = roundCurrencyAmount(cSelling - cNet, targetCurrency);
          const cMarginPct = cNet > 0 ? Math.round(((cSelling - cNet) / cNet) * 100 * 10) / 10 : 15;

          hotelsNetCost += cNet;
          hotelsB2BSelling += cSelling;

          componentBreakdown.push({
            id: `manual-hotel-${hub.id}`,
            name: hub.manualHotel.hotelName || 'Manual Accommodation',
            category: 'Accommodation',
            type: 'HOTEL',
            hubName: hub.hubName,
            netPrice: cNet,
            sellingPrice: cSelling,
            retailPrice: cSelling,
            marginAmount: cMargin,
            marginPercent: cMarginPct,
            currency: targetCurrency
          });
        } else if (hub.hotelId) {
          const hotel = allHotels.find(h => h.id === hub.hotelId || (h.name || '').toLowerCase() === (hub.hotelId || '').toLowerCase());
          if (hotel) {
            const roomType = hotel.roomTypes?.find(r => r.id === hub.roomTypeId) || hotel.roomTypes?.[0];
            const hotelProd = hotelToProduct(hotel, roomType, undefined, nights, rooms);
            const b2bCalc = calculateProductPrice(hotelProd, {
              productId: hotelProd.id,
              adults,
              children,
              infants,
              travelDate,
              targetCurrency,
              pricingTier: 'B2B',
              userRole: 'B2B_AGENT',
              user: request.user,
              companyId: reqCompanyId,
              agencyName: reqAgencyName
            });

            const cNet = roundCurrencyAmount(b2bCalc.totalNetCost, targetCurrency);
            const cSelling = roundCurrencyAmount(b2bCalc.finalTotalSellingPrice, targetCurrency);
            const cMargin = roundCurrencyAmount(cSelling - cNet, targetCurrency);
            const cMarginPct = cNet > 0 ? Math.round(((cSelling - cNet) / cNet) * 100 * 10) / 10 : (roomType?.rates?.[0]?.markupPercent ?? 18);

            hotelsNetCost += cNet;
            hotelsB2BSelling += cSelling;

            componentBreakdown.push({
              id: hotel.id,
              name: `${hotel.name} (${roomType?.roomName || 'Room'} • ${nights}N)`,
              category: 'Accommodation',
              type: 'HOTEL',
              hubName: hub.hubName,
              netPrice: cNet,
              sellingPrice: cSelling,
              retailPrice: cSelling,
              marginAmount: cMargin,
              marginPercent: cMarginPct,
              currency: targetCurrency
            });
          }
        }
      });
    } else if (Array.isArray(pkg.hotelsSummary) && pkg.hotelsSummary.length > 0) {
      pkg.hotelsSummary.forEach((hs, idx) => {
        const hotel = allHotels.find(h => (hs.hotelId && h.id === hs.hotelId) || (h.name || '').toLowerCase() === (hs.name || '').toLowerCase());
        const nights = Math.max(1, hs.nights || 1);
        const rooms = 1;
        if (hotel) {
          const roomType = hotel.roomTypes?.find(r => (r.roomName || '').toLowerCase().includes((hs.roomType || '').toLowerCase())) || hotel.roomTypes?.[0];
          const hotelProd = hotelToProduct(hotel, roomType, undefined, nights, rooms);
          const b2bCalc = calculateProductPrice(hotelProd, {
            productId: hotelProd.id,
            adults,
            children,
            infants,
            travelDate,
            targetCurrency,
            pricingTier: 'B2B',
            userRole: 'B2B_AGENT',
            user: request.user,
            companyId: reqCompanyId,
            agencyName: reqAgencyName
          });

          const cNet = roundCurrencyAmount(b2bCalc.totalNetCost, targetCurrency);
          const cSelling = roundCurrencyAmount(b2bCalc.finalTotalSellingPrice, targetCurrency);
          const cMargin = roundCurrencyAmount(cSelling - cNet, targetCurrency);
          const cMarginPct = cNet > 0 ? Math.round(((cSelling - cNet) / cNet) * 100 * 10) / 10 : 18;

          hotelsNetCost += cNet;
          hotelsB2BSelling += cSelling;

          componentBreakdown.push({
            id: hotel.id || `hs-${idx}`,
            name: `${hs.name} (${hs.roomType || 'Room'} • ${nights}N)`,
            category: 'Accommodation',
            type: 'HOTEL',
            hubName: hs.cityName,
            netPrice: cNet,
            sellingPrice: cSelling,
            retailPrice: cSelling,
            marginAmount: cMargin,
            marginPercent: cMarginPct,
            currency: targetCurrency
          });
        }
      });
    }
  }

  // 3. Fallback for unconfigured or template packages
  if (componentBreakdown.length === 0) {
    const rawNetUSD = pkg.baseNetCostUSD || 2500;
    const netTarget = convertCurrency(rawNetUSD, 'USD', targetCurrency);
    servicesNetCost = netTarget;
    servicesB2BSelling = roundCurrencyAmount(netTarget * 1.12, targetCurrency);
  }

  // 4. Authoritative Total Price Determinations
  // Package Selling Price Formula:
  // Agent Package Price = Sum of Current B2B Selling Prices of Included Components
  const totalNetCostTarget = roundCurrencyAmount(servicesNetCost + hotelsNetCost, targetCurrency);
  const totalB2BSellingPrice = roundCurrencyAmount(servicesB2BSelling + hotelsB2BSelling, targetCurrency);

  let finalSellingPrice = totalB2BSellingPrice;

  // Apply custom overall discount if specified
  if (request.customDiscountPercent) {
    finalSellingPrice = Math.max(0, roundCurrencyAmount(finalSellingPrice * (1 - request.customDiscountPercent / 100), targetCurrency));
  }

  const pricePerPerson = totalPax > 0 ? Math.max(0, roundCurrencyAmount(finalSellingPrice / totalPax, targetCurrency)) : finalSellingPrice;
  const totalNetCostUSD = convertCurrency(totalNetCostTarget, targetCurrency, 'USD');
  const markupAmount = roundCurrencyAmount(finalSellingPrice - totalNetCostTarget, targetCurrency);
  const effectiveMarkupPercent = totalNetCostTarget > 0 ? Math.round((markupAmount / totalNetCostTarget) * 100 * 10) / 10 : 0;

  const result: PackagePricingResult = {
    success: true,
    packageId: pkg.id,
    packageTitle: pkg.title,
    finalSellingPrice,
    pricePerPerson,
    currency: targetCurrency,
    pax: { adults, children, infants, totalPax },
    isAuthoritative: true,
    calculatedAt: new Date().toISOString(),
    rateId: `PKG-RATE-${pkg.id}`,
    rateVersion: 'CENTRALIZED-v2'
  };

  // Strictly present internal breakdown ONLY for ADMIN or DMC_STAFF
  if (isAdminOrStaff) {
    result.internalAudit = {
      totalNetCostUSD,
      totalNetCostTarget,
      totalB2BSellingPrice,
      totalRetailSellingPrice: totalB2BSellingPrice,
      markupAmount,
      effectiveMarkupPercent,
      pricingMode: 'CENTRALIZED_ENGINE',
      itemsCount: componentBreakdown.length,
      servicesNetCost: roundCurrencyAmount(servicesNetCost, targetCurrency),
      servicesSellingPrice: roundCurrencyAmount(servicesB2BSelling, targetCurrency),
      hotelsNetCost: roundCurrencyAmount(hotelsNetCost, targetCurrency),
      hotelsSellingPrice: roundCurrencyAmount(hotelsB2BSelling, targetCurrency),
      componentBreakdown
    };
  }

  return result;
}

/**
 * AUTHORITATIVE PRICING SERVICE - UNIFIED ENTRY POINT
 * Section 5: "Inventory ID + Passenger Configuration + Date + Quantity + Service Configuration -> AUTHORITATIVE PRICING SERVICE -> Final Selling Price"
 */
export interface AuthoritativePriceRequest {
  inventoryId: string;
  inventoryType?: 'PRODUCT' | 'HOTEL' | 'TRANSFER' | 'VISA' | 'PACKAGE';
  passengerConfiguration?: {
    adults?: number;
    children?: number;
    infants?: number;
  };
  date?: string;
  quantity?: number;
  serviceConfiguration?: {
    roomTypeId?: string;
    mealPlan?: string;
    nights?: number;
    roomsCount?: number;
    routeId?: string;
    vehicleId?: string;
    selectedAddonIds?: string[];
    [key: string]: any;
  };
  targetCurrency?: CurrencyCode;
  user?: User | null;
  userRole?: UserRole;
  pricingTier?: 'B2B' | 'B2C';
  customMarkupPercent?: number;
  agentClientMarkupPercent?: number;
  customDiscountPercent?: number;
}

export function calculatePrice(request: AuthoritativePriceRequest): PricingCalculationResult {
  const db = AppDatabase.getInstance();
  const inventoryId = request.inventoryId;
  const inventoryType = request.inventoryType || 'PRODUCT';

  // Handle Packages through Authoritative Package Engine
  if (inventoryType === 'PACKAGE' || inventoryId.startsWith('pkg-')) {
    const pkg = db.getPackages().find(p => p.id === inventoryId || p.slug === inventoryId);
    if (pkg) {
      const pkgResult = calculatePackagePrice({
        packageItem: pkg,
        adults: request.passengerConfiguration?.adults,
        children: request.passengerConfiguration?.children,
        infants: request.passengerConfiguration?.infants,
        travelDate: request.date,
        targetCurrency: request.targetCurrency,
        user: request.user,
        userRole: request.userRole,
        pricingTier: request.pricingTier,
        agentClientMarkupPercent: request.agentClientMarkupPercent,
        customMarkupPercent: request.customMarkupPercent,
        customDiscountPercent: request.customDiscountPercent
      });

      const adultsCount = request.passengerConfiguration?.adults || 2;
      const childrenCount = request.passengerConfiguration?.children || 0;
      const infantsCount = request.passengerConfiguration?.infants || 0;
      const totalPax = adultsCount + childrenCount + infantsCount;
      const isAdminOrStaff = (request.userRole === 'ADMIN' || request.userRole === 'DMC_STAFF' || request.user?.role === 'ADMIN' || request.user?.role === 'DMC_STAFF');

      const adultsSelling = adultsCount * pkgResult.pricePerPerson;
      const childrenSelling = childrenCount * Math.round(pkgResult.pricePerPerson * 0.75);

      return {
        productId: pkg.id,
        productName: pkg.title,
        pricingTier: (request.pricingTier || 'B2C') as any,
        pax: {
          adults: adultsCount,
          children: childrenCount,
          infants: infantsCount,
          totalPax
        },
        travelDate: request.date || new Date().toISOString().split('T')[0],
        currency: pkgResult.currency,
        
        adultsSubtotalNet: isAdminOrStaff && pkgResult.internalAudit ? pkgResult.internalAudit.totalNetCostTarget * adultsCount : 0,
        childrenSubtotalNet: isAdminOrStaff && pkgResult.internalAudit ? pkgResult.internalAudit.totalNetCostTarget * 0.75 * childrenCount : 0,
        infantsSubtotalNet: 0,
        addonsSubtotalNet: 0,
        totalNetCost: isAdminOrStaff && pkgResult.internalAudit ? pkgResult.internalAudit.totalNetCostTarget * totalPax : 0,

        b2bWholesaleMarkupRate: isAdminOrStaff && pkgResult.internalAudit ? pkgResult.internalAudit.effectiveMarkupPercent / 100 : 0,
        b2bWholesaleNetToAgent: 0,
        agentClientMarkupRate: request.agentClientMarkupPercent ? request.agentClientMarkupPercent / 100 : 0,
        agentProfitAmount: 0,

        markupRate: isAdminOrStaff && pkgResult.internalAudit ? pkgResult.internalAudit.effectiveMarkupPercent / 100 : 0,
        markupAmount: isAdminOrStaff && pkgResult.internalAudit ? pkgResult.internalAudit.markupAmount : 0,
        grossBeforeTax: pkgResult.finalSellingPrice,

        taxRate: 0,
        taxAmount: 0,
        serviceFee: 0,
        discountRate: request.customDiscountPercent ? request.customDiscountPercent / 100 : 0,
        discountAmount: 0,
        commissionRate: 0,
        commissionAmount: 0,

        adultsSubtotalSelling: adultsSelling,
        childrenSubtotalSelling: childrenSelling,
        infantsSubtotalSelling: 0,
        addonsSubtotalSelling: 0,
        adultPricePerPax: pkgResult.pricePerPerson,
        childPricePerPax: Math.round(pkgResult.pricePerPerson * 0.75),

        finalTotalSellingPrice: pkgResult.finalSellingPrice,
        sellingPriceFinal: pkgResult.finalSellingPrice,
        pricePerPerson: pkgResult.pricePerPerson,

        dmcMarginAmount: isAdminOrStaff && pkgResult.internalAudit ? pkgResult.internalAudit.markupAmount : 0,
        dmcMarginPercent: isAdminOrStaff && pkgResult.internalAudit ? pkgResult.internalAudit.effectiveMarkupPercent : 0,

        isAuthoritative: true,
        rateId: pkgResult.rateId,
        rateVersion: pkgResult.rateVersion,
        calculatedAt: pkgResult.calculatedAt,
        sourceCollection: 'b2b_packages'
      };
    }
  }

  // 1. Resolve Product or Inventory Object
  let product: Product | undefined;

  // Check products table
  product = db.getProductById(inventoryId) || db.getProducts().find(p => p.sku === inventoryId);

  // If not found directly, check hotels
  if (!product && (inventoryType === 'HOTEL' || inventoryId.startsWith('htl-') || inventoryId.startsWith('hotel-'))) {
    const hotel = db.getHotelById(inventoryId) || db.getHotels().find(h => h.id === inventoryId || h.code === inventoryId);
    if (hotel) {
      const roomTypeId = request.serviceConfiguration?.roomTypeId;
      const room = roomTypeId ? hotel.roomTypes?.find(r => r.id === roomTypeId) : hotel.roomTypes?.[0];
      const nights = request.serviceConfiguration?.nights || 1;
      const roomsCount = request.serviceConfiguration?.roomsCount || 1;
      const mealPlan = request.serviceConfiguration?.mealPlan || 'BB';

      // Find matching hotel rate from db or room
      const hotelRates = db.getHotelRates ? db.getHotelRates() : [];
      const matchedDbRate = hotelRates.find((hr: any) => 
        (hr.hotelId === hotel.id || hr.id.includes(hotel.id)) && 
        (!room || hr.roomId === room.id || hr.id.includes(room.id)) &&
        (hr.status === 'ACTIVE' || !hr.status)
      );

      const baseRate = matchedDbRate || room?.rates?.[0] || {
        id: `HRATE-${hotel.id}-001`,
        mealPlan: mealPlan as any,
        mealPlanName: 'Breakfast Included',
        singleNetRate: hotel.startingNetPrice,
        doubleNetRate: hotel.startingNetPrice,
        tripleNetRate: hotel.startingNetPrice,
        extraBedRate: 0,
        childRate: 0,
        markupPercent: 20,
        taxPercent: 10,
        feePercent: 0,
        currency: hotel.currency || 'USD',
        validityFrom: '2026-01-01',
        validityTo: '2026-12-31'
      };

      const nightlyCost = baseRate.doubleNetRate || baseRate.singleNetRate || hotel.startingNetPrice;
      const totalStayCost = nightlyCost * nights * roomsCount;

      product = hotelToProduct(hotel, room, baseRate, nights, roomsCount);
      // Ensure custom rates and dates are preserved
      product.adultNetPrice = totalStayCost;
      product.currency = baseRate.currency || hotel.currency || 'USD';
      product.validityFrom = baseRate.validityFrom || '2026-01-01';
      product.validityTo = baseRate.validityTo || '2026-12-31';
      product.defaultMarkupPercent = baseRate.markupPercent || 20;
      product.b2bAgentMarkupPercent = baseRate.markupPercent || 20;
      product.taxPercent = baseRate.taxPercent || 10;
    }
  }

  // If not found, check transfer routes
  if (!product && (inventoryType === 'TRANSFER' || inventoryId.startsWith('tr-') || inventoryId.startsWith('TR-') || inventoryId.startsWith('route-'))) {
    const route = db.getTransferRoutes().find(r => r.id === inventoryId);
    if (route) {
      const transferRates = db.getTransferRates();
      const matchedRate = transferRates.find(tr => tr.routeId === route.id && tr.status === 'ACTIVE') || transferRates[0];
      const vehicleCost = matchedRate?.nettCost || 120;
      const curr = matchedRate?.currency || 'USD';

      product = {
        id: route.id,
        sku: route.id,
        destinationId: route.destinationId,
        destinationName: 'Destination Hub',
        country: 'Destination',
        city: route.routeName,
        productType: 'Transfer',
        category: 'Transfers',
        subcategory: route.vehicleType,
        name: route.routeName,
        shortDescription: `Private chauffeur transfer: ${route.routeName}`,
        longDescription: `Executive vehicle transfer with licensed chauffeur.`,
        supplierId: 'sup-ground-logistics',
        supplierName: 'Executive Ground Logistics',
        supplierProductCode: 'TR-EXEC',
        commissionPercent: 0,
        duration: '1.5 Hours',
        operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        operatingHours: '24/7 Operations',
        adultNetPrice: vehicleCost,
        childNetPrice: 0,
        infantNetPrice: 0,
        currency: curr,
        defaultMarkupPercent: 20,
        b2bAgentMarkupPercent: 20,
        buyerMarkupPercent: 30,
        taxPercent: 10,
        serviceFeeFixed: 0,
        sellingPriceStartingFrom: vehicleCost * 1.2,
        season: 'All Year',
        validityFrom: '2026-01-01',
        validityTo: '2026-12-31',
        minPax: 1,
        maxPax: route.maxCapacity || 6,
        availability: 'INSTANT',
        bookingRequiredDays: 1,
        cancellationPolicy: 'Free cancellation up to 24h prior.',
        inclusions: ['Private Vehicle', 'Luggage Assistance', 'Toll Charges'],
        exclusions: ['Driver Gratuities'],
        importantInformation: ['Driver awaits in arrivals hall with name board'],
        images: ['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=1200'],
        status: 'ACTIVE',
        pricingMethod: 'capacity_based',
        isTransfer: true,
        vehicleConfig: {
          pricingMethod: 'capacity_based',
          vehicleName: route.vehicleType || 'Executive MPV',
          vehicleModel: route.vehicleType || 'Executive MPV',
          vehicleType: 'Executive MPV',
          totalSeats: route.maxCapacity || 6,
          maxSeats: route.maxCapacity || 6,
          passengerCapacity: route.maxCapacity || 6,
          unitVehicleNetCost: vehicleCost,
          totalTransferCost: vehicleCost,
          allowMultipleVehicles: true,
          autoAllocateVehicles: true
        }
      };
    }
  }

  // Fallback if product still missing
  if (!product) {
    const fallbackProducts = db.getProducts();
    product = fallbackProducts[0] || {
      id: inventoryId,
      sku: inventoryId,
      destinationId: 'dest-default',
      destinationName: 'Global',
      country: 'Global',
      city: 'Hub',
      productType: 'Day Tours',
      category: 'Activities',
      subcategory: 'Guided Excursions',
      name: 'Travel Service',
      shortDescription: 'Contracted ground service.',
      longDescription: 'Authoritative DMC travel service.',
      supplierId: 'sup-default',
      supplierName: 'TheUnbound DMC Partner',
      supplierProductCode: 'UNB-DEF',
      commissionPercent: 0,
      duration: 'Full Day',
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: '09:00 - 18:00',
      adultNetPrice: 100,
      childNetPrice: 50,
      infantNetPrice: 0,
      currency: 'USD',
      defaultMarkupPercent: 25,
      b2bAgentMarkupPercent: 20,
      buyerMarkupPercent: 30,
      taxPercent: 10,
      serviceFeeFixed: 0,
      sellingPriceStartingFrom: 125,
      season: 'All Year',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31',
      minPax: 1,
      maxPax: 20,
      availability: 'INSTANT',
      bookingRequiredDays: 1,
      cancellationPolicy: 'Standard cancellation terms.',
      inclusions: ['Verified Service'],
      exclusions: ['Personal Expenses'],
      importantInformation: ['Standard service voucher'],
      images: ['https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200'],
      status: 'ACTIVE'
    };
  }

  const calculationRequest: PricingCalculationRequest = {
    productId: product.id,
    adults: request.passengerConfiguration?.adults || 2,
    children: request.passengerConfiguration?.children || 0,
    infants: request.passengerConfiguration?.infants || 0,
    quantity: request.quantity || 1,
    travelDate: request.date || new Date().toISOString().split('T')[0],
    targetCurrency: request.targetCurrency || product.currency,
    user: request.user || null,
    userRole: request.userRole || request.user?.role || 'BUYER',
    pricingTier: request.pricingTier || (request.user?.role === 'B2B_AGENT' || request.user?.role === 'AGENT' ? 'B2B' : 'B2C'),
    customMarkupPercent: request.customMarkupPercent,
    agentClientMarkupPercent: request.agentClientMarkupPercent,
    customDiscountPercent: request.customDiscountPercent,
    selectedAddonIds: request.serviceConfiguration?.selectedAddonIds
  };

  return calculateProductPrice(product, calculationRequest);
}

/**
 * AI PLANNER CONTROLLED PRICING TOOL (Section 26)
 * "getCurrentPrice({ inventoryId, serviceConfiguration, passengerConfiguration, date })"
 * Returns strictly what the AI needs: finalSellingPrice, currency, perPersonPrice, pax, audit metadata.
 * Internal net costs, supplier margins, and markups are strictly hidden!
 */
export interface ControlledPriceResponse {
  success: boolean;
  inventoryId: string;
  inventoryName: string;
  finalSellingPrice: number;
  currency: CurrencyCode;
  pricePerPerson: number;
  pax: {
    adults: number;
    children: number;
    infants: number;
    totalPax: number;
  };
  travelDate: string;
  rateId: string;
  rateVersion: string | number;
  isAuthoritative: boolean;
  pricingRequestId: string;
  calculatedAt: string;
  sourceCollection: string;
}

export function getCurrentPrice(params: {
  inventoryId: string;
  inventoryType?: 'PRODUCT' | 'HOTEL' | 'TRANSFER' | 'VISA' | 'PACKAGE';
  serviceConfiguration?: Record<string, any>;
  passengerConfiguration?: { adults?: number; children?: number; infants?: number };
  date?: string;
  currency?: CurrencyCode;
  user?: User | null;
  pricingTier?: 'B2B' | 'B2C';
}): ControlledPriceResponse {
  const result = calculatePrice({
    inventoryId: params.inventoryId,
    inventoryType: params.inventoryType,
    serviceConfiguration: params.serviceConfiguration,
    passengerConfiguration: params.passengerConfiguration,
    date: params.date,
    targetCurrency: params.currency,
    user: params.user,
    pricingTier: params.pricingTier
  });

  return {
    success: true,
    inventoryId: result.productId,
    inventoryName: result.productName,
    finalSellingPrice: result.finalTotalSellingPrice,
    currency: result.currency,
    pricePerPerson: result.pricePerPerson,
    pax: result.pax,
    travelDate: result.travelDate,
    rateId: result.rateId || 'RTE-DEF-001',
    rateVersion: result.rateVersion || 1,
    isAuthoritative: true,
    pricingRequestId: result.pricingRequestId || `PRQ-${Date.now()}`,
    calculatedAt: result.calculatedAt || new Date().toISOString(),
    sourceCollection: result.sourceCollection || 'product_pricing_rates'
  };
}

/**
 * PRICING SOURCE OF TRUTH AUDIT MAP (Section 39)
 */
export interface PricingSourceOfTruthEntry {
  inventoryType: string;
  sheetTab: string;
  collection: string;
  primaryKey: string;
  foreignKey: string;
  pricingFields: string[];
  currencyField: string;
  effectiveDateField: string;
  statusField: string;
  versionField: string;
  consumers: string[];
}

export function getPricingSourceOfTruthMap(): PricingSourceOfTruthEntry[] {
  return [
    {
      inventoryType: 'Activity & Day Tour Rates',
      sheetTab: 'PRODUCT_PRICING',
      collection: 'product_pricing_rates',
      primaryKey: 'id (pricing_id)',
      foreignKey: 'productId -> products.id',
      pricingFields: ['adultNett', 'childNett', 'cwbNett', 'cnbNett', 'infantNett', 'markupBuyer', 'markupAgent', 'taxPercentage'],
      currencyField: 'currency (USD, JPY, EUR, GBP)',
      effectiveDateField: 'validityFrom / validityTo',
      statusField: 'status (ACTIVE / INACTIVE)',
      versionField: 'version',
      consumers: ['AI Planner (getCurrentPrice)', 'B2B Quote Builder', 'Buyer Portal', 'Cart', 'Quotations', 'PDF / WhatsApp Quotes']
    },
    {
      inventoryType: 'Capacity-Based Tours & Private Yachts',
      sheetTab: 'PRODUCT_CAPACITY',
      collection: 'product_capacities',
      primaryKey: 'id (capacity_id)',
      foreignKey: 'productId -> products.id',
      pricingFields: ['capacity (max seats)', 'fixedNettCost', 'vehicleModel', 'unitVehicleNetCost'],
      currencyField: 'currency',
      effectiveDateField: 'season / validity dates',
      statusField: 'status (ACTIVE / INACTIVE)',
      versionField: 'version',
      consumers: ['AI Planner Fleet Allocation', 'Capacity Simulation Matrix', 'B2B Quote Builder Step 4 & Step 5', 'Ground Transport Ops']
    },
    {
      inventoryType: 'Hotel & Room Type Rates',
      sheetTab: 'HOTEL_RATES',
      collection: 'hotel_rates & hotels.roomTypes[].rates',
      primaryKey: 'id (rate_id)',
      foreignKey: 'hotelId -> hotels.id, roomId -> roomTypes.id',
      pricingFields: ['singleNetRate', 'doubleNetRate', 'tripleNetRate', 'extraBedRate', 'childRate', 'markupPercent', 'taxPercent'],
      currencyField: 'currency (USD, JPY, EUR)',
      effectiveDateField: 'validityFrom / validityTo',
      statusField: 'status (ACTIVE / INACTIVE)',
      versionField: 'version',
      consumers: ['AI Planner Hotel Matching', 'B2B Quote Builder Step 3 (Hotels & Accommodation Stays)', 'calculateHotelStayPrice', 'Buyer Portal']
    },
    {
      inventoryType: 'Hotel Meal Plans',
      sheetTab: 'HOTEL_MEAL_PLANS',
      collection: 'hotel_meal_plans',
      primaryKey: 'id (meal_plan_id)',
      foreignKey: 'hotelId -> hotels.id',
      pricingFields: ['mealCode (RO, BB, HB, FB, AI)', 'mealName'],
      currencyField: 'N/A',
      effectiveDateField: 'Year-Round',
      statusField: 'status (ACTIVE)',
      versionField: 'version',
      consumers: ['Hotel Room Selector', 'AI Planner Lodging Engine', 'Vouchers']
    },
    {
      inventoryType: 'Ground Transfers & Chauffeur Fleet',
      sheetTab: 'TRANSFER_RATES',
      collection: 'transfer_rates',
      primaryKey: 'id (transfer_rate_id)',
      foreignKey: 'routeId -> transfer_routes.id',
      pricingFields: ['nettCost', 'capacity', 'vehicle', 'rateType'],
      currencyField: 'currency',
      effectiveDateField: 'Year-Round / Effective Period',
      statusField: 'status (ACTIVE)',
      versionField: 'version',
      consumers: ['AI Planner Route Transitions', 'B2B Quote Builder Step 4 (Transfers & Ground Logistics)', 'Airport Fast-Track']
    },
    {
      inventoryType: 'Visa & Ancillary Services',
      sheetTab: 'VISA_RATES',
      collection: 'visa_rates & visas',
      primaryKey: 'id (visa_rate_id)',
      foreignKey: 'visaId -> visas.id',
      pricingFields: ['adultNett', 'childNett', 'embassyFee', 'serviceFee', 'markupAgent', 'markupBuyer'],
      currencyField: 'currency (USD)',
      effectiveDateField: 'Regulatory Validity',
      statusField: 'status (ACTIVE)',
      versionField: 'version',
      consumers: ['B2B Quote Builder Step 6 (Visa & Ancillary Services)', 'AI Planner Requirements', 'Visa Submissions']
    },
    {
      inventoryType: 'Fixed Packages & Circuit Itineraries',
      sheetTab: 'PACKAGES / PACKAGE_ITEMS',
      collection: 'b2b_packages & package_items',
      primaryKey: 'id (package_id)',
      foreignKey: 'packageId -> b2b_packages.id',
      pricingFields: ['baseNetCostUSD', 'suggestedSellingPriceUSD', 'itemCostOverrides'],
      currencyField: 'currency (USD)',
      effectiveDateField: 'Seasonal Package Tariffs',
      statusField: 'status (PUBLISHED)',
      versionField: 'version',
      consumers: ['Package Customizer', 'AI Planner Inspiration Circuits', 'B2B Quote Builder Import']
    },
    {
      inventoryType: 'Saved Quotations (Frozen Historical Snapshots)',
      sheetTab: 'N/A (Derived at Quote Issuance)',
      collection: 'saved_quotes & Firestore quotes',
      primaryKey: 'id (quoteId, quoteNumber)',
      foreignKey: 'userId -> users.id, items[].productId',
      pricingFields: ['items[].calculation (frozen snapshot)', 'totalSellingPrice', 'totalNetCost', 'totalMargin'],
      currencyField: 'currency',
      effectiveDateField: 'Frozen at Issuance Timestamp',
      statusField: 'status (DRAFT, ISSUED, CONFIRMED)',
      versionField: 'version',
      consumers: ['Buyer Portal', 'PDF Generation', 'WhatsApp Quote Dispatch', 'Email Quotations', 'Booking Conversion']
    }
  ];
}

/**
 * MASTER PRICING SERVICE
 * Central class encapsulating all authoritative pricing access.
 */
export class MasterPricingService {
  public static calculateProductPrice(product: Product, request: PricingCalculationRequest): PricingCalculationResult {
    return calculateProductPrice(product, request);
  }

  public static calculatePrice(request: AuthoritativePriceRequest): PricingCalculationResult {
    return calculatePrice(request);
  }

  public static calculatePackagePrice(request: PackagePricingRequest): PackagePricingResult {
    return calculatePackagePrice(request);
  }

  public static getCurrentPrice(params: {
    inventoryId: string;
    inventoryType?: 'PRODUCT' | 'HOTEL' | 'TRANSFER' | 'VISA' | 'PACKAGE';
    serviceConfiguration?: Record<string, any>;
    passengerConfiguration?: { adults?: number; children?: number; infants?: number };
    date?: string;
    currency?: CurrencyCode;
    user?: User | null;
    pricingTier?: 'B2B' | 'B2C';
  }): ControlledPriceResponse {
    return getCurrentPrice(params);
  }

  public static getPricingSourceOfTruthMap(): PricingSourceOfTruthEntry[] {
    return getPricingSourceOfTruthMap();
  }

  public static calculateQuoteInternalBreakdown(params: QuoteInternalBreakdownParams): QuoteInternalBreakdownResult {
    return calculateQuoteInternalBreakdown(params);
  }
}

// ============================================================================
// AUTHORITATIVE INTERNAL PRICING BREAKDOWN ENGINE (B2B QUOTE BUILDER STEP 8)
// ============================================================================

export interface QuoteItemForBreakdown {
  id: string;
  product: Product;
  pax?: { adults: number; children: number; infants: number };
  travelDate?: string;
  selectedAddonIds?: string[];
  hubId?: string;
  hotelId?: string;
  isManualHotel?: boolean;
  manualHotelDetails?: any;
  isNoAccommodation?: boolean;
  notes?: string;
  calculation?: any;
}

export interface InternalBreakdownItemResult {
  itemId: string;
  productName: string;
  category: string;
  nativeNetCost: number;
  nativeCurrency: CurrencyCode;
  convertedNetCost: number;
  currency: CurrencyCode;
  markupAmount: number;
  taxAmount: number;
  serviceFee: number;
  surchargeTotal?: number;
  appliedSurcharges?: AppliedSurchargeDetail[];
  baseSellingPriceBeforeSurcharges?: number;
  finalSellingPrice: number;
  theUnboundBaseSellingPrice?: number;
  agentAdditionalMarkupType?: 'PERCENTAGE' | 'FIXED';
  agentAdditionalMarkupValue?: number;
  agentAdditionalMarkupAmount?: number;
  finalCustomerSellingPrice?: number;
  isExcludedNoAccommodation: boolean;
  hasValidRate: boolean;
  incompleteReason?: string;
}

export interface QuoteInternalBreakdownParams {
  items: QuoteItemForBreakdown[];
  targetCurrency: CurrencyCode;
  agentMarginType?: 'PERCENTAGE' | 'FIXED';
  agentMarginValue?: number;
  overallDiscountPercent?: number;
  userRole?: string;
  user?: User | null;
  companyId?: string;
  agencyName?: string;
  productLevelMarginEnabled?: boolean;
  customAgentMarginPercent?: number;
  scope?: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY';
  routeHubs?: TripRouteHub[];
  adminManualMarginType?: 'PERCENTAGE' | 'FIXED';
  adminManualMarginValue?: number;
  adminMarginMode?: 'REPLACE' | 'ADD';
  preserveHistoricalSnapshot?: boolean;
  historicalSnapshot?: QuotationCurrencySnapshot;
  surchargeOverrides?: QuotationSurchargeOverride[];
  bookingDate?: string;
  appliedPromotion?: AppliedPromotionSnapshot | null;
}

export interface QuoteInternalBreakdownResult {
  isComplete: boolean;
  activeMarginMode?: 'PRODUCT_LEVEL' | 'AGENT_LEVEL';
  productLevelMarginEnabled?: boolean;
  configuredAgentLevelMarginPercent?: number;
  incompleteWarnings: Array<{
    itemId: string;
    productName: string;
    category?: string;
    reason: string;
  }>;
  missingCurrencyPairs?: string[];
  totalNettCost: number;          // Combined underlying nett cost before margin, taxes, service fees
  totalMargin: number;            // Applicable authorized margin amount (underlying markups + partner margin - discounts)
  underlyingMarginAmount: number; // Underlying inventory markup
  partnerMarginAmount: number;    // Additional partner margin (Product-level + Overall agent markup)
  productLevelAgentMarkupTotal?: number; // Sum of per-product agent additional markups
  overallAgentMarkupAmount?: number;     // Overall quotation agent additional markup
  totalAgentAdditionalMarkupAmount?: number; // Total agent additional markup
  taxAmount: number;              // Applicable tax calculated according to existing pricing rules
  serviceFee: number;             // Applicable service fee calculated according to existing pricing rules
  surchargesTotal?: number;       // Total converted selling surcharges across items
  appliedSurcharges?: AppliedSurchargeDetail[]; // Aggregated applied surcharge records
  baseSellingPrice: number;       // TheUnbound Base Selling Price (after Stage 1 promo discount, before agent additional markup)
  theUnboundBaseSellingPrice?: number; // Explicit alias for TheUnbound Base Selling Price
  preDiscountBaseSellingPrice?: number; // TheUnbound Base Selling Price BEFORE promotion code discount
  promotionDiscountAmount?: number;     // Stage 1 Promotional Discount Amount
  discountedBaseSellingPrice?: number;  // TheUnbound Base Selling Price AFTER promotion code discount
  appliedPromotion?: AppliedPromotionSnapshot | null; // Active promotion snapshot reflected in Stage 1
  discountAmount: number;         // Overall package discount amount
  finalPackagePrice: number;      // Customer-facing total produced by existing Pricing Engine
  hotelAccommodationTotal?: number; // Authoritative converted Hotel Accommodation Total
  landPartTotal?: number;           // Authoritative converted Land Part Total
  currency: CurrencyCode;
  itemizedBreakdown: InternalBreakdownItemResult[];
  adminManualMarginAmount?: number;
  existingMarginAmount?: number;
  revisedSellingPrice?: number;
  adminFinalTotal?: number;
}

/**
 * Authoritative validation helper for Agent-Controlled Additional Markup ("Your Additional Markup").
 * Enforces the commercial restriction:
 * - Markup value MUST be >= 0 (never negative).
 * - Final Customer Selling Price MUST be >= TheUnbound Base Selling Price.
 */
export function validateAgentAdditionalMarkup(
  rawValue: unknown,
  theUnboundBaseSellingPrice?: number,
  finalCustomerSellingPrice?: number
): {
  isValid: boolean;
  sanitizedValue: number;
  errorMessage?: string;
} {
  const numericVal = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (rawValue !== undefined && rawValue !== null && rawValue !== '' && (Number.isNaN(numericVal) || numericVal < 0)) {
    return {
      isValid: false,
      sanitizedValue: 0,
      errorMessage: 'Validation Error: Additional markup cannot be negative. You can only increase the selling price above TheUnbound Base Selling Price.'
    };
  }
  if (
    typeof theUnboundBaseSellingPrice === 'number' &&
    typeof finalCustomerSellingPrice === 'number' &&
    finalCustomerSellingPrice + 0.001 < theUnboundBaseSellingPrice
  ) {
    return {
      isValid: false,
      sanitizedValue: Math.max(0, Number.isFinite(numericVal) ? numericVal : 0),
      errorMessage: 'Validation Error: Final Customer Selling Price cannot be lower than TheUnbound Base Selling Price.'
    };
  }
  return {
    isValid: true,
    sanitizedValue: Math.max(0, Number.isFinite(numericVal) ? numericVal : 0)
  };
}

/**
 * Authoritative validation helper for Admin Manual Margin Adjustment on Total Nett Cost.
 * Rejects negative, NaN, or non-finite values and clamps sanitizedValue >= 0.
 */
export function validateAdminManualMargin(
  rawValue: unknown,
  marginType: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE'
): {
  isValid: boolean;
  sanitizedValue: number;
  errorMessage?: string;
} {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { isValid: true, sanitizedValue: 0 };
  }
  const numericVal = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(numericVal) || numericVal < 0) {
    return {
      isValid: false,
      sanitizedValue: 0,
      errorMessage:
        marginType === 'PERCENTAGE'
          ? 'Validation Error: Manual margin percentage cannot be negative or invalid. Enter 0% or higher.'
          : 'Validation Error: Manual margin fixed amount cannot be negative or invalid. Enter 0 or higher.'
    };
  }
  return {
    isValid: true,
    sanitizedValue: numericVal
  };
}

/**
 * Currency-aware rounding helper.
 * Preserves 2 decimal places for decimal currencies (INR, USD, EUR, GBP, AED, SGD, etc.)
 * and 0 decimal places for integer currencies (JPY, THB).
 */
export function roundCurrencyAmount(amount: number, currency?: string): number {
  if (!Number.isFinite(amount)) return 0;
  const code = (currency || '').toUpperCase().trim();
  if (code === 'JPY' || code === 'THB') {
    return Math.round(amount);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export interface ResolvedQuoteAgencyPricingContext {
  productLevelMarginEnabled: boolean;
  activeMarginMode: 'PRODUCT_LEVEL' | 'AGENT_LEVEL';
  agentLevelMarginPercent: number;
  companyId?: string;
  agencyName?: string;
  agentId?: string;
}

/**
 * Resolves the authoritative agency margin configuration for a quotation using
 * the quotation's own agency context (companyId / agentAgency / agentId) rather
 * than letting a logged-in internal Admin's user profile override the agent's settings.
 */
export function resolveQuoteAgencyPricingContext(
  quoteOrContext?: any,
  fallbackUser?: User | null
): ResolvedQuoteAgencyPricingContext {
  const qAny = quoteOrContext || {};
  const explicitCompanyId = qAny.companyId;
  const explicitAgencyName = qAny.agentAgency || qAny.agencyName || qAny.agentCompany || qAny.clientCompany;
  const explicitAgentId = qAny.agentId || qAny.createdBy;
  // Never fall back to an unrelated Admin user when the quotation already identifies an agent/agency
  const safeUserFallback =
    qAny.user ??
    (!explicitAgentId && !explicitAgencyName && !explicitCompanyId ? fallbackUser : undefined);

  let resolvedProductLevel = true;
  let resolvedAgentPercent = 10;
  try {
    const resolved = AppDatabase.getInstance().resolveAgencyPricingSettings({
      companyId: explicitCompanyId || safeUserFallback?.companyId,
      agencyName: explicitAgencyName || safeUserFallback?.agencyName || safeUserFallback?.companyName,
      userId: explicitAgentId || safeUserFallback?.id,
      user: safeUserFallback || undefined
    });
    resolvedProductLevel = resolved.productLevelMarginEnabled;
    resolvedAgentPercent = resolved.agentLevelMarginPercent;
  } catch {
    // defaults apply
  }

  const explicitBool =
    typeof qAny.productLevelMarginEnabled === 'boolean'
      ? qAny.productLevelMarginEnabled
      : typeof qAny.agencyPricingSettings?.productLevelMarginEnabled === 'boolean'
        ? qAny.agencyPricingSettings.productLevelMarginEnabled
        : typeof qAny.pricingSnapshot?.productLevelMarginEnabled === 'boolean'
          ? qAny.pricingSnapshot.productLevelMarginEnabled
          : typeof qAny.authoritativeSnapshot?.pricing?.productLevelMarginEnabled === 'boolean'
            ? qAny.authoritativeSnapshot.pricing.productLevelMarginEnabled
            : undefined;

  const explicitPctRaw =
    typeof qAny.agentLevelMarginPercent === 'number'
      ? qAny.agentLevelMarginPercent
      : typeof qAny.customAgentMarginPercent === 'number'
        ? qAny.customAgentMarginPercent
        : typeof qAny.agencyPricingSettings?.agentLevelMarginPercent === 'number'
          ? qAny.agencyPricingSettings.agentLevelMarginPercent
          : typeof qAny.pricingSnapshot?.agentLevelMarginPercent === 'number'
            ? qAny.pricingSnapshot.agentLevelMarginPercent
            : typeof qAny.authoritativeSnapshot?.pricing?.agentLevelMarginPercent === 'number'
              ? qAny.authoritativeSnapshot.pricing.agentLevelMarginPercent
              : undefined;

  const productLevelMarginEnabled =
    explicitBool !== undefined ? Boolean(explicitBool) : resolvedProductLevel;
  const agentLevelMarginPercent =
    explicitPctRaw !== undefined && Number.isFinite(explicitPctRaw) && explicitPctRaw >= 0
      ? Number(explicitPctRaw)
      : resolvedAgentPercent;

  return {
    productLevelMarginEnabled,
    activeMarginMode: productLevelMarginEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL',
    agentLevelMarginPercent,
    companyId: explicitCompanyId || safeUserFallback?.companyId,
    agencyName: explicitAgencyName || safeUserFallback?.agencyName || safeUserFallback?.companyName,
    agentId: explicitAgentId || safeUserFallback?.id
  };
}

function isManualHotelQuoteItem(item: any): boolean {
  if (!item) return false;
  return Boolean(
    item.isManualHotel ||
      item.product?.isManualHotel ||
      item.product?.sku?.startsWith('MAN-HTL-') ||
      item.product?.accommodationType === 'manual' ||
      item.accommodationType === 'manual' ||
      item.accommodationType === 'MANUAL'
  );
}

function isHotelCategoryOrProductItem(item: any): boolean {
  if (!item) return false;
  const catLower = (
    item.product?.category ||
    item.category ||
    item.product?.productType ||
    ''
  ).toLowerCase();
  return Boolean(
    catLower.includes('hotel') ||
      catLower.includes('accommodation') ||
      catLower.includes('resort') ||
      catLower.includes('ryokan') ||
      item.product?.productType === 'HOTEL' ||
      item.service_type === 'HOTEL' ||
      item.isManualHotel ||
      item.manualHotelDetails ||
      item.hotelId
  );
}

function isExcludedNoAccommodationItem(
  item: any,
  routeHubs: TripRouteHub[],
  isLandOnlyQuote: boolean
): boolean {
  if (!item) return true;
  const productName = item.product?.name || item.product?.title || '';
  const isExcludedByHubScope = shouldExcludeHotelItemByNoAccommodation(item, routeHubs, isLandOnlyQuote);
  return Boolean(
    isExcludedByHubScope ||
      item.isNoAccommodation ||
      item.accommodationType === 'NO_ACCOMMODATION' ||
      item.accommodationType === 'none' ||
      item.product?.accommodationType === 'NO_ACCOMMODATION' ||
      item.product?.accommodationType === 'none' ||
      item.product?.id === 'LAND_ONLY_HUB' ||
      item.product?.sku === 'LAND_ONLY_HUB' ||
      item.product?.sku === 'NO_ACCOMMODATION' ||
      productName.toLowerCase().includes('no accommodation') ||
      productName.toLowerCase().includes('arranged by client') ||
      (item.notes || '').toLowerCase().includes('arranged by client')
  );
}

interface ResolvedManualHotelPricing {
  hasValidRate: boolean;
  isComplimentary: boolean;
  productName: string;
  nativeCurrency: CurrencyCode;
  nativeNett: number;
  convertedNetCost: number;
  markupAmount: number;
  taxAmount: number;
  serviceFee: number;
  surchargeTotal: number;
  appliedSurcharges: AppliedSurchargeDetail[];
  finalSellingPrice: number;
  errorReason?: string;
}

function resolveManualHotelPricingInTargetCurrency(
  item: any,
  targetCurrency: CurrencyCode,
  preserveHistoricalSnapshot: boolean,
  snapshotLine?: CurrencyConversionLineRecord
): ResolvedManualHotelPricing {
  const manual = item.manualHotelDetails || item.product?.manualHotelDetails;
  const productName = manual?.hotelName || item.product?.name || item.product?.title || 'Manual Hotel Stay';
  const nights = Math.max(1, Number(manual?.numberOfNights ?? manual?.nights ?? item.nights ?? item.product?.nights ?? 1));
  const rooms = Math.max(1, Number(manual?.numberOfRooms ?? manual?.roomsCount ?? item.roomsCount ?? item.product?.roomsCount ?? 1));
  const rateBasis = manual?.rateBasis || manual?.rateType || 'PER_ROOM_PER_NIGHT';
  const rawNativeCurrency = (manual?.rateCurrency || manual?.currency || item.product?.nativeCurrency || item.product?.currency || 'USD') as string;
  const nativeCurrency = currencyEngine.normalizeCurrencyCode(rawNativeCurrency, 'USD') as CurrencyCode;

  const rawRate =
    manual?.ratePerNight !== undefined
      ? Number(manual.ratePerNight)
      : manual?.sellingPrice !== undefined
        ? Number(manual.sellingPrice)
        : manual?.netCost !== undefined
          ? Number(manual.netCost)
          : manual?.totalNetCost !== undefined
            ? Number(manual.totalNetCost)
            : item.product?.adultNetPrice !== undefined
              ? Number(item.product.adultNetPrice)
              : undefined;

  const effectiveValidationRate =
    rateBasis === 'PER_PERSON_PER_NIGHT' || rateBasis === 'PER_PERSON'
      ? Number(manual?.adultRate ?? rawRate ?? 0)
      : Number(rawRate ?? 0);

  const isComplimentary = Boolean(manual?.isComplimentary || manual?.isFreeStay);
  if (rawRate === undefined || Number.isNaN(effectiveValidationRate) || (effectiveValidationRate <= 0 && !isComplimentary)) {
    return {
      hasValidRate: false,
      isComplimentary: false,
      productName,
      nativeCurrency,
      nativeNett: 0,
      convertedNetCost: 0,
      markupAmount: 0,
      taxAmount: 0,
      serviceFee: 0,
      surchargeTotal: 0,
      appliedSurcharges: [],
      finalSellingPrice: item.calculation?.finalTotalSellingPrice || 0,
      errorReason: `Manual hotel rate missing or invalid (${rawRate ?? 'unspecified'})`
    };
  }

  let nativeNett = 0;
  if (rateBasis === 'TOTAL_STAY' || rateBasis === 'TOTAL' || rateBasis === 'TOTAL_PACKAGE') {
    nativeNett = rawRate;
  } else if (rateBasis === 'PER_ROOM_TOTAL_STAY') {
    nativeNett = rawRate * rooms;
  } else if (rateBasis === 'PER_NIGHT' || rateBasis === 'PER_ROOM_PER_NIGHT') {
    nativeNett = rawRate * rooms * nights;
  } else if (rateBasis === 'PER_PERSON_TOTAL_STAY') {
    const adultsCount = item.pax?.adults ?? (rooms * 2);
    nativeNett = rawRate * adultsCount;
  } else if (rateBasis === 'PER_PERSON_PER_NIGHT' || rateBasis === 'PER_PERSON') {
    const adultRate = manual?.adultRate !== undefined ? Number(manual.adultRate) : rawRate;
    const childRate = manual?.childRate !== undefined ? Number(manual.childRate) : 0;
    const adultsCount = item.pax?.adults ?? (rooms * 2);
    const childrenCount = item.pax?.children ?? 0;
    nativeNett = (adultRate * adultsCount + childRate * childrenCount) * nights;
  } else {
    nativeNett = rawRate * rooms * nights;
  }

  const snapshotRate =
    snapshotLine?.appliedExchangeRate ??
    (preserveHistoricalSnapshot && item.calculation?.currency === targetCurrency
      ? (item.calculation as any)?.fxDetails?.effectiveRate
      : undefined);

  const convMeta = currencyEngine.convertWithMetadata(nativeNett, nativeCurrency, targetCurrency, snapshotRate);
  if (!convMeta.isValid) {
    return {
      hasValidRate: false,
      isComplimentary,
      productName,
      nativeCurrency,
      nativeNett,
      convertedNetCost: 0,
      markupAmount: 0,
      taxAmount: 0,
      serviceFee: 0,
      surchargeTotal: 0,
      appliedSurcharges: [],
      finalSellingPrice: 0,
      errorReason: convMeta.error || `Missing exchange rate ${convMeta.originalCurrency} -> ${convMeta.targetCurrency}`
    };
  }

  const convertedNetCost = roundCurrencyAmount(convMeta.convertedAmount, targetCurrency);
  const calc = item.calculation as any;
  const calcCurrency = calc?.currency ? currencyEngine.normalizeCurrencyCode(calc.currency) : undefined;
  const hasMatchingCalcCurrency = calcCurrency === targetCurrency;

  let markupAmount = 0;
  let taxAmount = 0;
  let serviceFee = 0;
  let surchargeTotal = 0;
  let appliedSurcharges: AppliedSurchargeDetail[] = [];

  const convertCalcVal = (val?: number): number => {
    const n = Number(val || 0);
    if (n <= 0 || !calcCurrency) return 0;
    return hasMatchingCalcCurrency
      ? roundCurrencyAmount(n, targetCurrency)
      : roundCurrencyAmount(currencyEngine.convert(n, calcCurrency, targetCurrency), targetCurrency);
  };

  if (calc && calcCurrency) {
    markupAmount = convertCalcVal(calc.markupAmount);
    taxAmount = convertCalcVal(calc.taxAmount);
    serviceFee = convertCalcVal(calc.serviceFee);
    surchargeTotal = convertCalcVal(calc.surchargeTotal);
    if (Array.isArray(calc.appliedSurcharges)) {
      appliedSurcharges = hasMatchingCalcCurrency
        ? calc.appliedSurcharges
        : calc.appliedSurcharges.map((s: any) => ({
            ...s,
            appliedAmountConverted:
              typeof s.appliedAmountConverted === 'number'
                ? roundCurrencyAmount(currencyEngine.convert(s.appliedAmountConverted, calcCurrency, targetCurrency), targetCurrency)
                : s.appliedAmountConverted
          }));
    }
  } else if (manual?.totalSellingPrice !== undefined && Number(manual.totalSellingPrice) > nativeNett) {
    const nativeExtra = Number(manual.totalSellingPrice) - nativeNett;
    const convExtra = currencyEngine.convertWithMetadata(nativeExtra, nativeCurrency, targetCurrency, snapshotRate);
    if (convExtra.isValid) {
      markupAmount = roundCurrencyAmount(convExtra.convertedAmount, targetCurrency);
    }
  }

  const finalSellingPrice = roundCurrencyAmount(
    convertedNetCost + markupAmount + taxAmount + serviceFee + surchargeTotal,
    targetCurrency
  );

  return {
    hasValidRate: true,
    isComplimentary,
    productName,
    nativeCurrency,
    nativeNett,
    convertedNetCost,
    markupAmount,
    taxAmount,
    serviceFee,
    surchargeTotal,
    appliedSurcharges,
    finalSellingPrice
  };
}

/**
 * Calculates authoritative Total Nett Cost and internal commercial breakdown for the active quote option.
 * 
 * Rules:
 * 1. Sum of applicable underlying nett costs for all priced quote items before margin, taxes, and service fees.
 * 2. Exactly one calculation per item, no double-counting.
 * 3. Excludes items marked "No Accommodation (Arranged By Client)".
 * 4. Includes manual hotel rates using actual saved nett rate, quantity, rate basis, and stay duration.
 * 5. Handles private tours without duplicating vehicle costs already in the tour price.
 * 6. Converts each amount once using centralized CurrencyEngine.
 * 7. Flags incomplete if any item lacks a required nett cost or exchange rate without inventing defaults or showing misleading partial sums.
 * 8. Preserves existing Pricing Engine customer-facing final price.
 */
export function calculateQuoteInternalBreakdown(
  params: QuoteInternalBreakdownParams
): QuoteInternalBreakdownResult {
  const {
    items = [],
    targetCurrency = 'USD',
    agentMarginType = 'PERCENTAGE',
    agentMarginValue = 0,
    overallDiscountPercent = 0,
    user,
    companyId,
    agencyName,
    scope,
    routeHubs = [],
    preserveHistoricalSnapshot = false,
    historicalSnapshot,
    surchargeOverrides,
    bookingDate,
    appliedPromotion
  } = params;

  const agencySettings = resolveQuoteAgencyPricingContext(
    {
      companyId,
      agencyName,
      agentId: (params as any).agentId,
      productLevelMarginEnabled: params.productLevelMarginEnabled,
      agentLevelMarginPercent: params.customAgentMarginPercent,
      user: (!companyId && !agencyName && !(params as any).agentId) ? user : undefined
    },
    user
  );

  const isProductLevelMarginEnabled =
    params.productLevelMarginEnabled !== undefined
      ? Boolean(params.productLevelMarginEnabled)
      : agencySettings.productLevelMarginEnabled;

  const configuredAgentLevelMarginPercent =
    params.customAgentMarginPercent !== undefined
      ? Number(params.customAgentMarginPercent)
      : agencySettings.agentLevelMarginPercent;

  const perfT0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const activeMarginMode: 'PRODUCT_LEVEL' | 'AGENT_LEVEL' = isProductLevelMarginEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL';

  const breakdownCacheKey = buildQuoteBreakdownCacheKey({
    items,
    targetCurrency,
    agentMarginType,
    agentMarginValue,
    overallDiscountPercent,
    activeMarginMode,
    isProductLevelMarginEnabled,
    configuredAgentLevelMarginPercent,
    scope,
    routeHubs,
    adminManualMarginType: params.adminManualMarginType,
    adminManualMarginValue: params.adminManualMarginValue,
    adminMarginMode: params.adminMarginMode,
    preserveHistoricalSnapshot,
    historicalSnapshotId: historicalSnapshot?.snapshotId,
    surchargeOverrides,
    bookingDate: bookingDate || '',
    appliedPromotion: appliedPromotion || null
  });

  const cachedBreakdown = pricingCache.getBreakdown<QuoteInternalBreakdownResult>(breakdownCacheKey);
  if (cachedBreakdown) {
    const perfT1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    performanceMonitor.recordTiming('PRICING_ENGINE', 'calculateQuoteInternalBreakdown (cached)', perfT1 - perfT0);
    return cachedBreakdown;
  }

  const isLandOnlyQuote = scope === 'LAND_ONLY';

  const incompleteWarnings: QuoteInternalBreakdownResult['incompleteWarnings'] = [];
  const missingCurrencyPairsSet = new Set<string>();
  const itemizedBreakdown: InternalBreakdownItemResult[] = [];
  const allAppliedSurcharges: AppliedSurchargeDetail[] = [];
  const processedItemIds = new Set<string>();
  let centralizedMasterSurcharges: SurchargeMaster[] = [];
  try {
    centralizedMasterSurcharges = AppDatabase.getInstance().getSurchargeMasters(true);
  } catch {
    centralizedMasterSurcharges = [];
  }
  const activeCentralMasterIdSet = new Set(
    (centralizedMasterSurcharges || [])
      .filter(s => s && !s.isDeleted && s.status === 'ACTIVE' && s.isActive !== false)
      .map(s => s.id)
  );
  const itemsByIdMap = new Map<string, QuoteItem>();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it && it.id && !itemsByIdMap.has(it.id)) itemsByIdMap.set(it.id, it);
  }

  let accumulatedNetCost = 0;
  let accumulatedUnderlyingMarkup = 0;
  let accumulatedTax = 0;
  let accumulatedServiceFee = 0;
  let accumulatedSurcharges = 0;
  let accumulatedSellingPrice = 0;

  let hotelNetCost = 0;
  let hotelSellingPrice = 0;
  let hotelFeeAndTax = 0;
  let hotelItemCount = 0;
  let landNetCost = 0;
  let landSellingPrice = 0;
  let landFeeAndTax = 0;

  let isComplete = true;

  for (const item of items) {
    if (!item || !item.id || processedItemIds.has(item.id)) continue;
    processedItemIds.add(item.id);

    const productName = item.product?.name || (item.product as any)?.title || 'Service Item';
    const category = item.product?.category || 'General';
    const catLower = (category || (item.product as any)?.productType || '').toLowerCase();
    const isHotelItem = Boolean(
      catLower.includes('hotel') ||
      catLower.includes('accommodation') ||
      catLower.includes('resort') ||
      catLower.includes('ryokan') ||
      (item.product as any)?.productType === 'HOTEL' ||
      item.isManualHotel ||
      item.manualHotelDetails ||
      item.hotelId
    );
    const isExcludedByHubScope = shouldExcludeHotelItemByNoAccommodation(item, routeHubs, isLandOnlyQuote);

    // 1. Exclude items marked "No Accommodation (Arranged By Client)" or excluded by Land-Only / hub No Accommodation
    const isNoAccommodation = Boolean(
      isExcludedByHubScope ||
      item.isNoAccommodation ||
      (item as any).accommodationType === 'NO_ACCOMMODATION' ||
      (item as any).accommodationType === 'none' ||
      item.product?.accommodationType === 'NO_ACCOMMODATION' ||
      item.product?.accommodationType === 'none' ||
      item.product?.id === 'LAND_ONLY_HUB' ||
      item.product?.sku === 'LAND_ONLY_HUB' ||
      item.product?.sku === 'NO_ACCOMMODATION' ||
      (productName || '').toLowerCase().includes('no accommodation') ||
      (productName || '').toLowerCase().includes('arranged by client') ||
      (item.notes || '').toLowerCase().includes('arranged by client')
    );

    if (isNoAccommodation) {
      itemizedBreakdown.push({
        itemId: item.id,
        productName,
        category: 'Hotels & Accommodation',
        nativeNetCost: 0,
        nativeCurrency: targetCurrency,
        convertedNetCost: 0,
        currency: targetCurrency,
        markupAmount: 0,
        taxAmount: 0,
        serviceFee: 0,
        finalSellingPrice: 0,
        isExcludedNoAccommodation: true,
        hasValidRate: true
      });
      continue;
    }

    const snapshotLine = (preserveHistoricalSnapshot && historicalSnapshot?.targetCurrency === targetCurrency)
      ? historicalSnapshot.lineItems.find(li => li.itemId === item.id || li.productId === item.product?.id)
      : undefined;

    const isManualHotel = isManualHotelQuoteItem(item);

    if (isManualHotel) {
      const mh = resolveManualHotelPricingInTargetCurrency(
        item,
        targetCurrency,
        preserveHistoricalSnapshot,
        snapshotLine
      );

      if (!mh.hasValidRate) {
        isComplete = false;
        if (mh.errorReason && mh.errorReason.includes('exchange rate')) {
          const pairStr = `${mh.nativeCurrency} -> ${targetCurrency}`;
          missingCurrencyPairsSet.add(pairStr);
        }
        incompleteWarnings.push({
          itemId: item.id,
          productName: mh.productName,
          category: 'Hotels & Accommodation',
          reason: mh.errorReason || 'Manual hotel rate missing or invalid'
        });

        itemizedBreakdown.push({
          itemId: item.id,
          productName: mh.productName,
          category: 'Hotels & Accommodation',
          nativeNetCost: mh.nativeNett,
          nativeCurrency: mh.nativeCurrency,
          convertedNetCost: 0,
          currency: targetCurrency,
          markupAmount: 0,
          taxAmount: 0,
          serviceFee: 0,
          finalSellingPrice: mh.finalSellingPrice,
          isExcludedNoAccommodation: false,
          hasValidRate: false,
          incompleteReason: mh.errorReason || 'Missing authoritative manual nett rate'
        });
        continue;
      }

      accumulatedNetCost += mh.convertedNetCost;
      accumulatedUnderlyingMarkup += mh.markupAmount;
      accumulatedTax += mh.taxAmount;
      accumulatedServiceFee += mh.serviceFee;
      accumulatedSurcharges += mh.surchargeTotal;
      accumulatedSellingPrice += mh.finalSellingPrice;

      hotelItemCount++;
      hotelNetCost += mh.convertedNetCost;
      hotelSellingPrice += mh.finalSellingPrice;
      hotelFeeAndTax += (mh.serviceFee + mh.taxAmount + mh.surchargeTotal);
      if (mh.appliedSurcharges.length > 0) {
        allAppliedSurcharges.push(...mh.appliedSurcharges);
      }

      itemizedBreakdown.push({
        itemId: item.id,
        productName: mh.productName,
        category: 'Hotels & Accommodation',
        nativeNetCost: mh.nativeNett,
        nativeCurrency: mh.nativeCurrency,
        convertedNetCost: mh.convertedNetCost,
        currency: targetCurrency,
        markupAmount: mh.markupAmount,
        taxAmount: mh.taxAmount,
        serviceFee: mh.serviceFee,
        surchargeTotal: mh.surchargeTotal,
        appliedSurcharges: mh.appliedSurcharges,
        finalSellingPrice: mh.finalSellingPrice,
        isExcludedNoAccommodation: false,
        hasValidRate: true
      });
      continue;
    }

    // 3. Authoritative Pricing Engine for Standard Inventory Products
    // (Hotels, Tours, Tickets, Transfers, Guides, Rail, Ferries, Restaurants, Yachts, Visas, Ancillaries)
    try {
      const existingCalc = item.calculation;
      const rawSourceCurrency = item.product?.nativeCurrency || item.product?.currency || existingCalc?.nativeCurrency || targetCurrency;
      const snapshotRate = snapshotLine?.appliedExchangeRate ??
        (preserveHistoricalSnapshot && existingCalc?.currency === targetCurrency ? (existingCalc as any)?.fxDetails?.effectiveRate : undefined);

      // Explicitly validate FX rate availability BEFORE accepting any cached calculation
      const fxCheck = snapshotRate
        ? { isValid: true, fromCode: rawSourceCurrency, toCode: targetCurrency, effectiveRate: snapshotRate, error: undefined }
        : currencyEngine.validateConversion(rawSourceCurrency, targetCurrency);

      if (!fxCheck.isValid) {
        isComplete = false;
        const pairStr = `${fxCheck.fromCode} -> ${fxCheck.toCode}`;
        missingCurrencyPairsSet.add(pairStr);
        incompleteWarnings.push({
          itemId: item.id,
          productName,
          category,
          reason: fxCheck.error || `Missing exchange rate for currency pair ${pairStr}`
        });

        itemizedBreakdown.push({
          itemId: item.id,
          productName,
          category,
          nativeNetCost: existingCalc?.nativeTotalNetCost || item.product?.adultNetPrice || 0,
          nativeCurrency: (fxCheck.fromCode as CurrencyCode) || targetCurrency,
          convertedNetCost: 0,
          currency: targetCurrency,
          markupAmount: 0,
          taxAmount: 0,
          serviceFee: 0,
          finalSellingPrice: 0,
          isExcludedNoAccommodation: false,
          hasValidRate: false,
          incompleteReason: fxCheck.error || `Missing exchange rate ${pairStr}`
        });
        continue;
      }

      const existingCalcCurrency = existingCalc?.currency
        ? currencyEngine.normalizeCurrencyCode(existingCalc.currency)
        : (existingCalc?.nativeCurrency &&
            !(existingCalc as any)?.fxDetails?.isConverted &&
            existingCalc?.totalNetCost !== undefined &&
            existingCalc?.totalNetCost === existingCalc?.nativeTotalNetCost
              ? currencyEngine.normalizeCurrencyCode(existingCalc.nativeCurrency)
              : undefined);
      const existingCalcRate = (existingCalc as any)?.fxDetails?.effectiveRate;
      const isRateStillCurrent =
        preserveHistoricalSnapshot ||
        String(rawSourceCurrency).toUpperCase() === String(targetCurrency).toUpperCase() ||
        (typeof existingCalcRate === 'number' && Math.abs(existingCalcRate - fxCheck.effectiveRate) < 0.0000001);

      const hasItemSurchargeOverrides = Array.isArray(surchargeOverrides) && surchargeOverrides.some(
        ov => !ov.itemId || ov.itemId === item.id || !ov.productId || ov.productId === item.product?.id
      );

      const existingCalcMarginMode = (existingCalc as any)?.activeMarginMode;
      const isMarginModeStillCurrent =
        preserveHistoricalSnapshot ||
        (!existingCalcMarginMode
          ? isProductLevelMarginEnabled
          : (existingCalcMarginMode === activeMarginMode &&
              (isProductLevelMarginEnabled ||
                Math.abs(((existingCalc?.markupRate || 0) * 100) - configuredAgentLevelMarginPercent) < 0.001)));

      const existingSurchargesArr = existingCalc?.appliedSurcharges || snapshotLine?.appliedSurcharges;
      const hasCompleteSurchargeList =
        !existingCalc?.surchargeTotal ||
        existingCalc.surchargeTotal === 0 ||
        (Array.isArray(existingSurchargesArr) && existingSurchargesArr.length > 0);
      const isTravelDateCurrent =
        preserveHistoricalSnapshot ||
        !item.travelDate ||
        !existingCalc?.travelDate ||
        existingCalc.travelDate === item.travelDate;

      // For unlocked/draft quotations, ensure cached item.calculation matches current Surcharge Management catalog version
      // and does not contain any deleted, deactivated, or non-existent surcharge IDs.
      const hasStaleOrMissingDraftSurcharge =
        !preserveHistoricalSnapshot &&
        Array.isArray(existingSurchargesArr) &&
        existingSurchargesArr.some(as => {
          if (!as || as.overrideType === 'ADD_CUSTOM_SURCHARGE') return false;
          const sid = as.surchargeId;
          const isValidActive = Boolean(sid && activeCentralMasterIdSet.has(sid));
          if (!isValidActive && sid) {
            console.warn(
              `[PricingEngine Diagnostic] Draft quotation item "${productName}" (${item.id}) referenced surcharge ID "${sid}" ("${as.surchargeName || as.name || ''}") which no longer exists or is inactive in Surcharge Management. Rejecting stale surcharge and recalculating.`
            );
          }
          return !isValidActive;
        });

      const existingSurchargeVersion = (existingCalc as any)?.surchargeCatalogVersion;
      const isSurchargeCatalogVersionCurrent =
        preserveHistoricalSnapshot ||
        (!hasStaleOrMissingDraftSurcharge &&
          (existingSurchargeVersion === pricingCache.getSurchargeCatalogVersion() ||
            (existingSurchargeVersion === undefined && activeCentralMasterIdSet.size === 0)));

      const hasValidExistingCalc = Boolean(
        !hasItemSurchargeOverrides &&
        existingCalc &&
        typeof existingCalc.totalNetCost === 'number' &&
        existingCalc.totalNetCost > 0 &&
        existingCalcCurrency === targetCurrency &&
        isRateStillCurrent &&
        isMarginModeStillCurrent &&
        isSurchargeCatalogVersionCurrent &&
        (preserveHistoricalSnapshot || (hasCompleteSurchargeList && isTravelDateCurrent))
      );

      const enrichedItemProduct: Product =
        item.isManualHotel && item.manualHotelDetails
          ? manualHotelToProduct(item.manualHotelDetails)
          : ({
              ...item.product,
              ...((item as any).hotelId ? { hotelId: (item as any).hotelId } : {}),
              ...((item as any).roomTypeId ? { roomTypeId: (item as any).roomTypeId } : {}),
              ...((item as any).nights ? { nights: (item as any).nights } : {}),
              ...((item as any).roomsCount ? { roomsCount: (item as any).roomsCount } : {}),
              ...((item as any).manualHotelDetails ? { manualHotelDetails: (item as any).manualHotelDetails } : {}),
              ...((item as any).master_product_id ? { master_product_id: (item as any).master_product_id } : {})
            } as Product);

      const itemServiceDate = (item.travelDate || (item as any).checkInDate || (item as any).serviceDate || '').trim() || undefined;
      const itemServiceEndDate = ((item as any).checkOutDate || (item as any).serviceEndDate || (item as any).manualHotelDetails?.checkOutDate || '').trim() || undefined;
      const itemNights = (item as any).nights || (item.product as any)?.nights || (item as any).manualHotelDetails?.numberOfNights;
      const itemRoomsCount = (item as any).roomsCount || (item.product as any)?.roomsCount || (item as any).manualHotelDetails?.numberOfRooms || 1;
      const itemCoverageDays = (item as any).coverageDays || (item.product as any)?.coverageDays;

      const calc = hasValidExistingCalc
        ? {
            nativeTotalNetCost: existingCalc!.nativeTotalNetCost ?? existingCalc!.totalNetCost,
            nativeCurrency: (existingCalc!.nativeCurrency || rawSourceCurrency) as CurrencyCode,
            totalNetCost: roundCurrencyAmount(existingCalc!.totalNetCost, targetCurrency),
            finalTotalSellingPrice: roundCurrencyAmount(existingCalc!.finalTotalSellingPrice, targetCurrency),
            markupAmount: roundCurrencyAmount(existingCalc!.markupAmount || 0, targetCurrency),
            taxAmount: roundCurrencyAmount(existingCalc!.taxAmount || 0, targetCurrency),
            serviceFee: roundCurrencyAmount(existingCalc!.serviceFee || 0, targetCurrency),
            surchargeTotal: roundCurrencyAmount(existingCalc!.surchargeTotal || 0, targetCurrency),
            baseSellingPriceBeforeSurcharges: (existingCalc as any).baseSellingPriceBeforeSurcharges,
            appliedSurcharges: existingCalc!.appliedSurcharges || snapshotLine?.appliedSurcharges || []
          }
        : calculateProductPrice(enrichedItemProduct, {
            productId: enrichedItemProduct.id,
            productName,
            itemId: item.id,
            pricingTier: 'B2B',
            userRole: 'ADMIN',
            user,
            companyId,
            agencyName,
            productLevelMarginEnabled: isProductLevelMarginEnabled,
            customAgentMarginPercent: configuredAgentLevelMarginPercent,
            adults: item.pax?.adults || 2,
            children: item.pax?.children || 0,
            infants: item.pax?.infants || 0,
            travelDate: itemServiceDate,
            serviceEndDate: itemServiceEndDate,
            nights: itemNights,
            roomsCount: itemRoomsCount,
            coverageDays: itemCoverageDays,
            bookingDate,
            targetCurrency,
            selectedAddonIds: item.selectedAddonIds || [],
            surchargeOverrides,
            frozenAppliedSurcharges: preserveHistoricalSnapshot ? (snapshotLine?.appliedSurcharges || existingCalc?.appliedSurcharges) : undefined,
            ...(snapshotRate ? { snapshotExchangeRate: snapshotRate } : {})
          } as any);

      if ((calc as any).fxDetails && (calc as any).fxDetails.isValid === false) {
        isComplete = false;
        const errReason = (calc as any).fxDetails.validationError || (calc as any).surchargeValidationMessage || 'Missing surcharge FX rate';
        incompleteWarnings.push({
          itemId: item.id,
          productName,
          category,
          reason: errReason
        });
      }

      const totalPax = (item.pax?.adults || 2) + (item.pax?.children || 0);
      const isComplimentary = Boolean((item.product as any).isComplimentary || (item.product as any).isFree);

      // Check for valid nett cost
      if (calc.totalNetCost <= 0 && !isComplimentary && totalPax > 0) {
        isComplete = false;
        incompleteWarnings.push({
          itemId: item.id,
          productName,
          category,
          reason: `Authoritative supplier nett rate unavailable in ${calc.nativeCurrency || targetCurrency}`
        });

        itemizedBreakdown.push({
          itemId: item.id,
          productName,
          category,
          nativeNetCost: calc.nativeTotalNetCost || 0,
          nativeCurrency: calc.nativeCurrency || targetCurrency,
          convertedNetCost: 0,
          currency: targetCurrency,
          markupAmount: calc.markupAmount || 0,
          taxAmount: calc.taxAmount || 0,
          serviceFee: calc.serviceFee || 0,
          surchargeTotal: (calc as any).surchargeTotal || 0,
          appliedSurcharges: (calc as any).appliedSurcharges || [],
          finalSellingPrice: calc.finalTotalSellingPrice || 0,
          isExcludedNoAccommodation: false,
          hasValidRate: false,
          incompleteReason: 'Missing authoritative supplier nett rate'
        });
        continue;
      }

      const itemNet = roundCurrencyAmount(calc.totalNetCost, targetCurrency);
      const itemMarkup = roundCurrencyAmount(calc.markupAmount || 0, targetCurrency);
      const itemTax = roundCurrencyAmount(calc.taxAmount || 0, targetCurrency);
      const itemFee = roundCurrencyAmount(calc.serviceFee || 0, targetCurrency);
      const rawAppliedSurcharges: AppliedSurchargeDetail[] = Array.isArray((calc as any).appliedSurcharges)
        ? (calc as any).appliedSurcharges
        : [];
      const itemPreSurchargeBase =
        (calc as any).baseSellingPriceBeforeSurcharges !== undefined
          ? roundCurrencyAmount((calc as any).baseSellingPriceBeforeSurcharges, targetCurrency)
          : roundCurrencyAmount((calc.finalTotalSellingPrice || 0) - ((calc as any).surchargeTotal || 0), targetCurrency);
      const itemAppliedSurcharges = rawAppliedSurcharges.length > 0
        ? reconcileAppliedSurchargesMetadataAndStacking({
            appliedSurcharges: rawAppliedSurcharges,
            itemId: item.id,
            product: enrichedItemProduct,
            productName,
            serviceDate: itemServiceDate || (calc as any).travelDate,
            serviceEndDate: itemServiceEndDate,
            nights: itemNights,
            targetCurrency,
            baseSellingPriceInTargetCurrency: itemPreSurchargeBase,
            masterSurcharges: centralizedMasterSurcharges,
            preserveHistoricalAmounts: preserveHistoricalSnapshot || hasValidExistingCalc
          })
        : [];
      const itemSurcharge = itemAppliedSurcharges.length > 0
        ? roundCurrencyAmount(
            itemAppliedSurcharges.reduce((sum, s) => sum + (s.appliedAmountConverted || 0), 0),
            targetCurrency
          )
        : roundCurrencyAmount((calc as any).surchargeTotal || 0, targetCurrency);
      const itemSelling = roundCurrencyAmount(calc.finalTotalSellingPrice || 0, targetCurrency);

      accumulatedNetCost += itemNet;
      accumulatedUnderlyingMarkup += itemMarkup;
      accumulatedTax += itemTax;
      accumulatedServiceFee += itemFee;
      accumulatedSurcharges += itemSurcharge;
      accumulatedSellingPrice += itemSelling;

      if (isHotelItem) {
        hotelItemCount++;
        hotelNetCost += itemNet;
        hotelSellingPrice += itemSelling;
        hotelFeeAndTax += (itemFee + itemTax + itemSurcharge);
      } else {
        landNetCost += itemNet;
        landSellingPrice += itemSelling;
        landFeeAndTax += (itemFee + itemTax + itemSurcharge);
      }

      itemizedBreakdown.push({
        itemId: item.id,
        productName,
        category,
        nativeNetCost: calc.nativeTotalNetCost,
        nativeCurrency: calc.nativeCurrency || targetCurrency,
        convertedNetCost: itemNet,
        currency: targetCurrency,
        markupAmount: itemMarkup,
        taxAmount: itemTax,
        serviceFee: itemFee,
        surchargeTotal: itemSurcharge,
        appliedSurcharges: itemAppliedSurcharges,
        baseSellingPriceBeforeSurcharges: itemPreSurchargeBase,
        finalSellingPrice: itemSelling,
        isExcludedNoAccommodation: false,
        hasValidRate: true
      });
    } catch (err: any) {
      isComplete = false;
      incompleteWarnings.push({
        itemId: item.id,
        productName,
        category,
        reason: `Pricing engine error: ${err?.message || 'Calculation failed'}`
      });

      itemizedBreakdown.push({
        itemId: item.id,
        productName,
        category,
        nativeNetCost: 0,
        nativeCurrency: targetCurrency,
        convertedNetCost: 0,
        currency: targetCurrency,
        markupAmount: 0,
        taxAmount: 0,
        serviceFee: 0,
        finalSellingPrice: 0,
        isExcludedNoAccommodation: false,
        hasValidRate: false,
        incompleteReason: err?.message || 'Calculation failed'
      });
    }
  }

  // Include any orphaned routeHub.manualHotel that has no matching quote item (consistent with calculateQuoteTotal)
  if (!isLandOnlyQuote && Array.isArray(routeHubs) && routeHubs.length > 0) {
    const matchedHubItemIds = new Set<string>();
    routeHubs.forEach(h => {
      if (h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none') return;
      const existingHotelItem = items.find(it =>
        !matchedHubItemIds.has(it.id) &&
        isHotelCategoryOrProductItem(it) &&
        doesHotelItemBelongToHubOccurrence(it as QuoteItem, h, routeHubs)
      );
      if (existingHotelItem) {
        matchedHubItemIds.add(existingHotelItem.id);
      } else if (h.manualHotel) {
        const manualSourceCurr = currencyEngine.normalizeCurrencyCode(
          (h.manualHotel as any)?.rateCurrency || (h.manualHotel as any)?.currency || targetCurrency,
          targetCurrency
        ) as CurrencyCode;
        const synthItem: any = {
          id: `hub-manual-hotel-${h.itineraryHubOccurrenceId || h.id}`,
          isManualHotel: true,
          accommodationType: 'manual',
          manualHotelDetails: h.manualHotel,
          nights: h.nights || h.manualHotel.numberOfNights,
          roomsCount: h.roomsCount || h.manualHotel.numberOfRooms,
          hubId: h.id,
          itineraryHubOccurrenceId: h.itineraryHubOccurrenceId || h.id,
          product: {
            id: `hub-manual-hotel-${h.itineraryHubOccurrenceId || h.id}`,
            name: h.manualHotel.hotelName || `${h.hubName} Manual Hotel`,
            category: 'Hotels',
            currency: manualSourceCurr,
            nativeCurrency: manualSourceCurr
          }
        };
        const mh = resolveManualHotelPricingInTargetCurrency(synthItem, targetCurrency, preserveHistoricalSnapshot);
        if (mh.hasValidRate && mh.convertedNetCost > 0) {
          accumulatedNetCost += mh.convertedNetCost;
          accumulatedUnderlyingMarkup += mh.markupAmount;
          accumulatedTax += mh.taxAmount;
          accumulatedServiceFee += mh.serviceFee;
          accumulatedSurcharges += mh.surchargeTotal;
          accumulatedSellingPrice += mh.finalSellingPrice;
          hotelItemCount++;
          hotelNetCost += mh.convertedNetCost;
          hotelSellingPrice += mh.finalSellingPrice;
          hotelFeeAndTax += (mh.serviceFee + mh.taxAmount + mh.surchargeTotal);
          itemizedBreakdown.push({
            itemId: synthItem.id,
            productName: mh.productName,
            category: 'Hotels & Accommodation',
            nativeNetCost: mh.nativeNett,
            nativeCurrency: mh.nativeCurrency,
            convertedNetCost: mh.convertedNetCost,
            currency: targetCurrency,
            markupAmount: mh.markupAmount,
            taxAmount: mh.taxAmount,
            serviceFee: mh.serviceFee,
            surchargeTotal: mh.surchargeTotal,
            appliedSurcharges: mh.appliedSurcharges,
            finalSellingPrice: mh.finalSellingPrice,
            isExcludedNoAccommodation: false,
            hasValidRate: true
          });
        } else {
          const rawManualPrice =
            (h.manualHotel as any)?.totalSellingPrice ||
            (h.manualHotel as any)?.totalPrice ||
            (h.manualHotel as any)?.price ||
            (Number(h.manualHotel.ratePerNight || 0) *
              Math.max(1, Number(h.nights || h.manualHotel.numberOfNights || 1)) *
              Math.max(1, Number(h.roomsCount || h.manualHotel.numberOfRooms || 1)));
          if (rawManualPrice > 0) {
            const convertedManualPrice =
              preserveHistoricalSnapshot && (h.manualHotel as any)?.totalSellingPrice
                ? rawManualPrice
                : currencyEngine.convert(rawManualPrice, manualSourceCurr, targetCurrency);
            const rawManualNet =
              (h.manualHotel as any)?.totalNetCost ??
              (h.manualHotel as any)?.netCost ??
              (Number(h.manualHotel.ratePerNight || 0) *
                Math.max(1, Number(h.nights || h.manualHotel.numberOfNights || 1)) *
                Math.max(1, Number(h.roomsCount || h.manualHotel.numberOfRooms || 1)));
            const convertedManualNet =
              rawManualNet > 0
                ? currencyEngine.convert(rawManualNet, manualSourceCurr, targetCurrency)
                : 0;
            const inferredMarkup = Math.max(0, roundCurrencyAmount(convertedManualPrice - convertedManualNet, targetCurrency));
            accumulatedNetCost += convertedManualNet;
            accumulatedUnderlyingMarkup += inferredMarkup;
            accumulatedSellingPrice += convertedManualPrice;
            hotelItemCount++;
            hotelNetCost += convertedManualNet;
            hotelSellingPrice += convertedManualPrice;
            itemizedBreakdown.push({
              itemId: synthItem.id,
              productName: synthItem.product.name,
              category: 'Hotels & Accommodation',
              nativeNetCost: rawManualNet,
              nativeCurrency: manualSourceCurr,
              convertedNetCost: convertedManualNet,
              currency: targetCurrency,
              markupAmount: inferredMarkup,
              taxAmount: 0,
              serviceFee: 0,
              surchargeTotal: 0,
              appliedSurcharges: [],
              finalSellingPrice: convertedManualPrice,
              isExcludedNoAccommodation: false,
              hasValidRate: true
            });
          }
        }
      }
    });
  }

  // 4. Commercial Package Pricing Aggregations
  const totalNettCost = roundCurrencyAmount(isComplete ? accumulatedNetCost : 0, targetCurrency);
  const existingMarginAmount = roundCurrencyAmount(accumulatedUnderlyingMarkup, targetCurrency);
  const serviceFeeAmount = roundCurrencyAmount(accumulatedServiceFee, targetCurrency);
  const taxAmount = roundCurrencyAmount(accumulatedTax, targetCurrency);

  const hasAdminManualMargin =
    params.adminManualMarginValue !== undefined || params.adminMarginMode !== undefined;
  const adminMarginMode = params.adminMarginMode === 'REPLACE' ? 'REPLACE' : 'ADD';
  const adminMarginType = params.adminManualMarginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
  const validatedAdminMarginValue = validateAdminManualMargin(
    params.adminManualMarginValue,
    adminMarginType
  ).sanitizedValue;

  const adminManualMarginAmount = hasAdminManualMargin
    ? (adminMarginType === 'FIXED'
        ? roundCurrencyAmount(validatedAdminMarginValue, targetCurrency)
        : roundCurrencyAmount(totalNettCost * (validatedAdminMarginValue / 100), targetCurrency))
    : 0;

  // STAGE 1: Manual Margin Adjustment on Total Nett Cost
  // In ADD mode (default): manual margin is added on top of existing calculated margin (Existing Base Margin + Manual Margin Adjustment)
  // In REPLACE mode (optional): manual margin replaces accumulatedUnderlyingMarkup (including 0% Nett override)
  const effectiveUnderlyingMargin = hasAdminManualMargin
    ? (adminMarginMode === 'REPLACE'
        ? adminManualMarginAmount
        : roundCurrencyAmount(existingMarginAmount + adminManualMarginAmount, targetCurrency))
    : existingMarginAmount;

  const surchargesTotal = roundCurrencyAmount(accumulatedSurcharges, targetCurrency);

  // Core Surcharge Calculation Rule:
  // Surcharges are applied over and above the selling price after the applicable internal margin has been calculated.
  // When Admin Manual Margin is present, revisedSellingPrice encompasses Nett + Effective Margin + Surcharges + Service Fee.
  const revisedSellingPrice = roundCurrencyAmount(
    totalNettCost + effectiveUnderlyingMargin + surchargesTotal + serviceFeeAmount,
    targetCurrency
  );

  const stage1PreDiscountTotal = hasAdminManualMargin
    ? roundCurrencyAmount(revisedSellingPrice + taxAmount, targetCurrency)
    : roundCurrencyAmount(accumulatedSellingPrice, targetCurrency);

  const discountAmount = overallDiscountPercent > 0
    ? roundCurrencyAmount(stage1PreDiscountTotal * (overallDiscountPercent / 100), targetCurrency)
    : 0;

  const adminFinalTotal = Math.max(
    0,
    roundCurrencyAmount(stage1PreDiscountTotal - discountAmount, targetCurrency)
  );

  // STAGE 1B: Promotional Discount Code Application (strictly on TheUnbound Base Selling Price, BEFORE Stage 2 Agent Additional Markup)
  // Supplier Nett Cost and internal margins are NEVER modified. Base Selling Price is floored at 0.
  const stage1PromoResult = computeStage1PromotionDiscount({
    appliedPromotion: appliedPromotion || null,
    stage1PreDiscountBase: adminFinalTotal,
    targetCurrency
  });
  const preDiscountBaseSellingPrice = stage1PromoResult.preDiscountBaseSellingPrice;
  const promotionDiscountAmount = stage1PromoResult.promotionDiscountAmount;
  const discountedBaseSellingPrice = stage1PromoResult.discountedBaseSellingPrice;
  const resolvedAppliedPromotion = stage1PromoResult.updatedSnapshot;
  const promoScaleRatio =
    preDiscountBaseSellingPrice > 0 && promotionDiscountAmount > 0
      ? discountedBaseSellingPrice / preDiscountBaseSellingPrice
      : 1;

  // STAGE 2: Agent-Controlled Additional Markup ("Your Additional Markup")
  // Commercial Rules:
  // 1. Stage 1 (discountedBaseSellingPrice) is TheUnbound Base Selling Price (incorporating Product-Level/Agent-Level Margin, surcharges, and any active Promotion Discount).
  // 2. Stage 2 is the B2B Agent's own additional markup ("Your Additional Markup"), calculated strictly on the Discounted Base Selling Price.
  // 3. Increase-Only Rule: Markup must be >= 0. Negative markups are rejected/clamped to 0 so Final Customer Selling Price >= Discounted Base Selling Price.
  // 4. Deterministic No-Double-Application Rule:
  //    - If a line item has an individual Product-Level Additional Markup (> 0), that specific markup applies to that item.
  //    - Overall Quotation Percentage Markup applies only to items that do NOT already have an individual Product-Level Additional Markup.
  const baseSellingPrice = discountedBaseSellingPrice;

  // Compute Stage 1 Hotel & Land bases before Stage 2 Agent Additional Markup
  const roundedHotelNet = roundCurrencyAmount(hotelNetCost, targetCurrency);
  const roundedLandNet = roundCurrencyAmount(landNetCost, targetCurrency);
  const roundedHotelBaseSelling = roundCurrencyAmount(hotelSellingPrice, targetCurrency);
  const roundedLandBaseSelling = roundCurrencyAmount(landSellingPrice, targetCurrency);
  const roundedHotelFeeAndTax = roundCurrencyAmount(hotelFeeAndTax, targetCurrency);
  const roundedLandFeeAndTax = roundCurrencyAmount(landFeeAndTax, targetCurrency);

  let effectiveHotelStage1 = roundedHotelBaseSelling;
  let effectiveLandStage1 = roundedLandBaseSelling;

  if (hasAdminManualMargin && (totalNettCost > 0 || (adminMarginType === 'FIXED' && adminManualMarginAmount > 0))) {
    const safeAdminVal = validatedAdminMarginValue;
    if (adminMarginType === 'PERCENTAGE') {
      const hotelAdminMargin = roundCurrencyAmount(roundedHotelNet * (safeAdminVal / 100), targetCurrency);
      const landAdminMargin = roundCurrencyAmount(adminManualMarginAmount - hotelAdminMargin, targetCurrency);
      effectiveHotelStage1 = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(roundedHotelNet + hotelAdminMargin + roundedHotelFeeAndTax, targetCurrency)
        : roundCurrencyAmount(roundedHotelBaseSelling + hotelAdminMargin, targetCurrency);
      effectiveLandStage1 = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(roundedLandNet + landAdminMargin + roundedLandFeeAndTax, targetCurrency)
        : roundCurrencyAmount(roundedLandBaseSelling + landAdminMargin, targetCurrency);
    } else {
      const basisTotal = adminMarginMode === 'REPLACE' ? totalNettCost : roundCurrencyAmount(accumulatedSellingPrice, targetCurrency);
      const hotelBasis = adminMarginMode === 'REPLACE' ? roundedHotelNet : roundedHotelBaseSelling;
      const hotelShare = basisTotal > 0 ? (hotelBasis / basisTotal) : (hotelItemCount > 0 ? 1 : 0);
      const hotelAdminMargin = roundCurrencyAmount(adminManualMarginAmount * hotelShare, targetCurrency);
      const landAdminMargin = roundCurrencyAmount(adminManualMarginAmount - hotelAdminMargin, targetCurrency);
      effectiveHotelStage1 = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(roundedHotelNet + hotelAdminMargin + roundedHotelFeeAndTax, targetCurrency)
        : roundCurrencyAmount(roundedHotelBaseSelling + hotelAdminMargin, targetCurrency);
      effectiveLandStage1 = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(roundedLandNet + landAdminMargin + roundedLandFeeAndTax, targetCurrency)
        : roundCurrencyAmount(roundedLandBaseSelling + landAdminMargin, targetCurrency);
    }
  }

  const hotelDiscount = overallDiscountPercent > 0 && discountAmount > 0
    ? roundCurrencyAmount(effectiveHotelStage1 * (overallDiscountPercent / 100), targetCurrency)
    : 0;
  const stage1HotelPrePromo = Math.max(0, roundCurrencyAmount(effectiveHotelStage1 - hotelDiscount, targetCurrency));
  const stage1HotelAfterDiscount = promotionDiscountAmount > 0
    ? Math.max(0, roundCurrencyAmount(stage1HotelPrePromo * promoScaleRatio, targetCurrency))
    : stage1HotelPrePromo;

  const validatedOverallAgentMarginValue = validateAgentAdditionalMarkup(agentMarginValue).sanitizedValue;
  const stage1ScaleRatio = accumulatedSellingPrice > 0 ? (baseSellingPrice / accumulatedSellingPrice) : 1;

  let productLevelAgentMarkupTotal = 0;
  let hotelProductLevelMarkupTotal = 0;
  let unmarkedItemsStage1Base = 0;
  let unmarkedHotelStage1Base = 0;

  const nonExcludedCount = itemizedBreakdown.filter(x => !x.isExcludedNoAccommodation).length;
  for (const ib of itemizedBreakdown) {
    if (ib.isExcludedNoAccommodation) {
      ib.theUnboundBaseSellingPrice = 0;
      ib.agentAdditionalMarkupAmount = 0;
      ib.finalCustomerSellingPrice = 0;
      continue;
    }
    const matchedItem = itemsByIdMap.get(ib.itemId) as any;
    const catLower = (ib.category || matchedItem?.product?.category || '').toLowerCase();
    const ibIsHotel = Boolean(
      catLower.includes('hotel') ||
      catLower.includes('accommodation') ||
      catLower.includes('resort') ||
      catLower.includes('ryokan') ||
      matchedItem?.isManualHotel ||
      matchedItem?.manualHotelDetails ||
      matchedItem?.hotelId
    );
    let itemStage1PreDiscount = ib.finalSellingPrice;
    if (hasAdminManualMargin && (totalNettCost > 0 || (adminMarginType === 'FIXED' && adminManualMarginAmount > 0))) {
      const safeAdminVal = validatedAdminMarginValue;
      let itemAdminMargin = 0;
      if (adminMarginType === 'PERCENTAGE') {
        itemAdminMargin = roundCurrencyAmount(ib.convertedNetCost * (safeAdminVal / 100), targetCurrency);
      } else {
        const basisTotal = adminMarginMode === 'REPLACE' ? totalNettCost : roundCurrencyAmount(accumulatedSellingPrice, targetCurrency);
        const itemBasis = adminMarginMode === 'REPLACE' ? ib.convertedNetCost : ib.finalSellingPrice;
        const itemShare = basisTotal > 0 ? itemBasis / basisTotal : (nonExcludedCount > 0 ? 1 / nonExcludedCount : 0);
        itemAdminMargin = roundCurrencyAmount(adminManualMarginAmount * itemShare, targetCurrency);
      }
      itemStage1PreDiscount = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(ib.convertedNetCost + itemAdminMargin + ib.serviceFee + ib.taxAmount + (ib.surchargeTotal || 0), targetCurrency)
        : roundCurrencyAmount(ib.finalSellingPrice + itemAdminMargin, targetCurrency);
    }
    const itemStage1Discount = overallDiscountPercent > 0
      ? roundCurrencyAmount(itemStage1PreDiscount * (overallDiscountPercent / 100), targetCurrency)
      : 0;
    const itemStage1BasePrePromo = hasAdminManualMargin
      ? Math.max(0, roundCurrencyAmount(itemStage1PreDiscount - itemStage1Discount, targetCurrency))
      : (Math.abs(stage1ScaleRatio - 1) > 0.00001
          ? roundCurrencyAmount(ib.finalSellingPrice * stage1ScaleRatio, targetCurrency)
          : roundCurrencyAmount(ib.finalSellingPrice, targetCurrency));
    const itemStage1Base = hasAdminManualMargin && promotionDiscountAmount > 0
      ? Math.max(0, roundCurrencyAmount(itemStage1BasePrePromo * promoScaleRatio, targetCurrency))
      : itemStage1BasePrePromo;

    ib.theUnboundBaseSellingPrice = itemStage1Base;

    if (Array.isArray(ib.appliedSurcharges) && ib.appliedSurcharges.length > 0) {
      const itemPreSurchargeStage1 = Math.max(
        0,
        roundCurrencyAmount(itemStage1Base - (ib.surchargeTotal || 0), targetCurrency)
      );
      const reconciledItemSurcharges = reconcileAppliedSurchargesMetadataAndStacking({
        appliedSurcharges: ib.appliedSurcharges,
        itemId: ib.itemId,
        product: matchedItem?.product,
        productName: ib.productName,
        serviceDate: matchedItem?.travelDate || matchedItem?.checkInDate || matchedItem?.serviceDate,
        serviceEndDate: matchedItem?.checkOutDate || matchedItem?.serviceEndDate || matchedItem?.manualHotelDetails?.checkOutDate,
        nights: matchedItem?.nights || matchedItem?.product?.nights || matchedItem?.manualHotelDetails?.numberOfNights,
        targetCurrency,
        baseSellingPriceInTargetCurrency: itemPreSurchargeStage1,
        masterSurcharges: centralizedMasterSurcharges,
        preserveHistoricalAmounts: true
      });
      ib.appliedSurcharges = reconciledItemSurcharges;
      allAppliedSurcharges.push(...reconciledItemSurcharges);
    }

    const rawItemMarkupVal = matchedItem?.agentAdditionalMarkupValue;
    const itemMarkupValidation = validateAgentAdditionalMarkup(rawItemMarkupVal);
    const itemMarkupVal = itemMarkupValidation.sanitizedValue;
    const itemMarkupType: 'PERCENTAGE' | 'FIXED' =
      matchedItem?.agentAdditionalMarkupType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';

    if (itemMarkupVal > 0) {
      const itemMarkupAmt = itemMarkupType === 'PERCENTAGE'
        ? roundCurrencyAmount(itemStage1Base * (itemMarkupVal / 100), targetCurrency)
        : roundCurrencyAmount(itemMarkupVal, targetCurrency);
      ib.agentAdditionalMarkupType = itemMarkupType;
      ib.agentAdditionalMarkupValue = itemMarkupVal;
      ib.agentAdditionalMarkupAmount = itemMarkupAmt;
      ib.finalCustomerSellingPrice = roundCurrencyAmount(itemStage1Base + itemMarkupAmt, targetCurrency);

      productLevelAgentMarkupTotal = roundCurrencyAmount(productLevelAgentMarkupTotal + itemMarkupAmt, targetCurrency);
      if (ibIsHotel) {
        hotelProductLevelMarkupTotal = roundCurrencyAmount(hotelProductLevelMarkupTotal + itemMarkupAmt, targetCurrency);
      }
    } else {
      unmarkedItemsStage1Base = roundCurrencyAmount(unmarkedItemsStage1Base + itemStage1Base, targetCurrency);
      if (ibIsHotel) {
        unmarkedHotelStage1Base = roundCurrencyAmount(unmarkedHotelStage1Base + itemStage1Base, targetCurrency);
      }
    }
  }

  // If no items have individual product-level markups, use the exact Stage 1 bases to avoid any sum-of-parts rounding drift
  if (productLevelAgentMarkupTotal === 0) {
    unmarkedItemsStage1Base = baseSellingPrice;
    unmarkedHotelStage1Base = stage1HotelAfterDiscount;
  }

  const overallAgentMarkupAmount = validatedOverallAgentMarginValue > 0
    ? (agentMarginType === 'PERCENTAGE'
        ? roundCurrencyAmount(unmarkedItemsStage1Base * (validatedOverallAgentMarginValue / 100), targetCurrency)
        : roundCurrencyAmount(validatedOverallAgentMarginValue, targetCurrency))
    : 0;

  // Populate allocated overall markup on unmarked items for complete line-level customer price transparency
  for (const ib of itemizedBreakdown) {
    if (ib.isExcludedNoAccommodation) continue;
    if ((ib.agentAdditionalMarkupAmount || 0) > 0) continue;
    const itemStage1Base = ib.theUnboundBaseSellingPrice ?? ib.finalSellingPrice;
    let allocatedOverallMarkup = 0;
    if (overallAgentMarkupAmount > 0 && unmarkedItemsStage1Base > 0) {
      allocatedOverallMarkup = agentMarginType === 'PERCENTAGE'
        ? roundCurrencyAmount(itemStage1Base * (validatedOverallAgentMarginValue / 100), targetCurrency)
        : roundCurrencyAmount(overallAgentMarkupAmount * (itemStage1Base / unmarkedItemsStage1Base), targetCurrency);
    }
    ib.agentAdditionalMarkupType = agentMarginType;
    ib.agentAdditionalMarkupValue = validatedOverallAgentMarginValue;
    ib.agentAdditionalMarkupAmount = allocatedOverallMarkup;
    ib.finalCustomerSellingPrice = roundCurrencyAmount(itemStage1Base + allocatedOverallMarkup, targetCurrency);
  }

  const partnerMarginAmount = roundCurrencyAmount(
    productLevelAgentMarkupTotal + overallAgentMarkupAmount,
    targetCurrency
  );

  const finalPackagePrice = Math.max(
    baseSellingPrice,
    roundCurrencyAmount(baseSellingPrice + partnerMarginAmount, targetCurrency)
  );
  const totalMargin = roundCurrencyAmount(
    effectiveUnderlyingMargin + partnerMarginAmount - discountAmount - promotionDiscountAmount,
    targetCurrency
  );

  const hotelOverallMarkup = validatedOverallAgentMarginValue > 0
    ? (agentMarginType === 'PERCENTAGE'
        ? roundCurrencyAmount(unmarkedHotelStage1Base * (validatedOverallAgentMarginValue / 100), targetCurrency)
        : (unmarkedItemsStage1Base > 0
            ? roundCurrencyAmount(overallAgentMarkupAmount * (unmarkedHotelStage1Base / unmarkedItemsStage1Base), targetCurrency)
            : (baseSellingPrice > 0
                ? roundCurrencyAmount(overallAgentMarkupAmount * (stage1HotelAfterDiscount / baseSellingPrice), targetCurrency)
                : 0)))
    : 0;

  const hotelPartnerMargin = roundCurrencyAmount(
    hotelProductLevelMarkupTotal + hotelOverallMarkup,
    targetCurrency
  );
  const hotelAccommodationTotal = Math.max(0, roundCurrencyAmount(stage1HotelAfterDiscount + hotelPartnerMargin, targetCurrency));
  const landPartTotal = Math.max(0, roundCurrencyAmount(finalPackagePrice - hotelAccommodationTotal, targetCurrency));

  const breakdownResult: QuoteInternalBreakdownResult = {
    isComplete,
    activeMarginMode,
    productLevelMarginEnabled: isProductLevelMarginEnabled,
    configuredAgentLevelMarginPercent,
    incompleteWarnings,
    missingCurrencyPairs: Array.from(missingCurrencyPairsSet),
    totalNettCost,
    totalMargin,
    underlyingMarginAmount: existingMarginAmount,
    partnerMarginAmount,
    productLevelAgentMarkupTotal,
    overallAgentMarkupAmount,
    totalAgentAdditionalMarkupAmount: partnerMarginAmount,
    taxAmount,
    serviceFee: serviceFeeAmount,
    surchargesTotal,
    appliedSurcharges: allAppliedSurcharges,
    baseSellingPrice,
    theUnboundBaseSellingPrice: baseSellingPrice,
    preDiscountBaseSellingPrice,
    promotionDiscountAmount,
    discountedBaseSellingPrice,
    appliedPromotion: resolvedAppliedPromotion,
    discountAmount,
    finalPackagePrice,
    hotelAccommodationTotal,
    landPartTotal,
    currency: targetCurrency,
    itemizedBreakdown,
    adminManualMarginAmount,
    existingMarginAmount,
    revisedSellingPrice,
    adminFinalTotal
  };

  pricingCache.setBreakdown(breakdownCacheKey, breakdownResult);
  const perfT1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  performanceMonitor.recordTiming('PRICING_ENGINE', 'calculateQuoteInternalBreakdown', perfT1 - perfT0, {
    items: items.length
  });
  return breakdownResult;
}

function buildQuoteBreakdownCacheKey(args: {
  items: QuoteItemForBreakdown[];
  targetCurrency: CurrencyCode;
  agentMarginType: string;
  agentMarginValue: number;
  overallDiscountPercent: number;
  activeMarginMode: string;
  isProductLevelMarginEnabled: boolean;
  configuredAgentLevelMarginPercent: number;
  scope?: string;
  routeHubs: TripRouteHub[];
  adminManualMarginType?: string;
  adminManualMarginValue?: number;
  adminMarginMode?: string;
  preserveHistoricalSnapshot: boolean;
  historicalSnapshotId?: string;
  surchargeOverrides?: QuotationSurchargeOverride[];
  bookingDate: string;
  appliedPromotion?: AppliedPromotionSnapshot | null;
}): string {
  const itemSig = args.items.map((it: any) => {
    if (!it) return '';
    const p = it.product || {};
    const m = it.manualHotelDetails || p.manualHotelDetails || {};
    const calc = it.calculation || {};
    return [
      it.id || '',
      p.id || '',
      p.updatedAt || '',
      p.adultNetPrice ?? '',
      p.childNetPrice ?? '',
      p.adultPrice ?? '',
      p.currency || p.nativeCurrency || '',
      p.b2bAgentMarkupPercent ?? p.defaultMarkupPercent ?? p.b2bMarginPercent ?? p.marginPercent ?? '',
      p.marginType ?? '',
      p.marginFixed ?? '',
      p.marginStatus ?? '',
      p.marginConfigVersion ?? '',
      p.surcharges?.length || 0,
      it.travelDate || '',
      it.checkInDate || '',
      it.checkOutDate || '',
      it.nights ?? p.nights ?? '',
      it.roomsCount ?? p.roomsCount ?? '',
      it.coverageDays ?? p.coverageDays ?? '',
      it.hubId || '',
      it.hotelId || '',
      it.roomTypeId || '',
      it.isManualHotel ? 1 : 0,
      it.isNoAccommodation ? 1 : 0,
      (it as any).accommodationType || '',
      it.pax ? `${it.pax.adults}:${it.pax.children}:${it.pax.infants}` : '',
      Array.isArray(it.selectedAddonIds) ? it.selectedAddonIds.join(',') : '',
      it.agentAdditionalMarkupType || '',
      it.agentAdditionalMarkupValue ?? '',
      m.ratePerNight ?? '',
      m.rateCurrency ?? '',
      m.rateBasis ?? m.rateType ?? '',
      m.numberOfNights ?? m.nights ?? '',
      m.numberOfRooms ?? m.roomsCount ?? '',
      m.sellingPrice ?? m.netCost ?? '',
      m.adultRate ?? '',
      m.childRate ?? '',
      calc.currency || '',
      calc.totalNetCost ?? '',
      calc.finalTotalSellingPrice ?? '',
      calc.markupAmount ?? '',
      calc.activeMarginMode || '',
      (calc as any).fxDetails?.effectiveRate ?? '',
      (calc as any).surchargeCatalogVersion ?? '',
      calc.surchargeTotal ?? '',
      calc.appliedSurcharges?.length || 0,
      calc.travelDate || ''
    ].join(':');
  }).join('|');

  const hubSig = (args.routeHubs || [])
    .map(h => `${h.itineraryHubOccurrenceId || h.id}:${h.hubName || ''}:${h.accommodationType || ''}:${h.nights || ''}:${h.roomsCount || ''}:${h.manualHotel?.ratePerNight ?? ''}:${h.manualHotel?.rateCurrency ?? ''}`)
    .join(',');

  const ovSig = Array.isArray(args.surchargeOverrides) && args.surchargeOverrides.length > 0
    ? args.surchargeOverrides
        .map(o => `${o.id}:${o.overrideType}:${o.surchargeId}:${o.itemId || ''}:${o.productId || ''}:${o.overriddenAmount ?? ''}:${o.overriddenCurrency || ''}`)
        .join(',')
    : '';

  const promoSig = args.appliedPromotion
    ? `${args.appliedPromotion.promotionId}:${args.appliedPromotion.code}:${args.appliedPromotion.discountType}:${args.appliedPromotion.discountValue}:${args.appliedPromotion.promotionCurrency || args.appliedPromotion.currency || ''}:${args.appliedPromotion.eligibleBaseSellingPrice ?? ''}:${args.appliedPromotion.eligibilitySnapshot?.maxDiscountCap ?? ''}`
    : '';

  return [
    args.targetCurrency,
    args.scope || '',
    args.agentMarginType,
    args.agentMarginValue,
    args.overallDiscountPercent,
    args.activeMarginMode,
    args.isProductLevelMarginEnabled ? 1 : 0,
    args.configuredAgentLevelMarginPercent,
    args.adminMarginMode || '',
    args.adminManualMarginType || '',
    args.adminManualMarginValue ?? '',
    args.preserveHistoricalSnapshot ? 1 : 0,
    args.historicalSnapshotId || '',
    args.bookingDate,
    `scv${pricingCache.getSurchargeCatalogVersion()}`,
    `fxv${pricingCache.getFxCatalogVersion()}`,
    `smv${masterDataCache.getVersion('surcharge_masters')}`,
    `prd${masterDataCache.getVersion('products')}`,
    `pmc${masterDataCache.getVersion('product_margin_configs')}`,
    `rmr${masterDataCache.getVersion('rail_markup_rules')}`,
    `cmp${masterDataCache.getVersion('companies')}`,
    `usr${masterDataCache.getVersion('system_users')}`,
    promoSig,
    hubSig,
    ovSig,
    itemSig
  ].join('~');
}

/**
 * Authoritative Quote Total Calculator
 * Evaluates the active option (or root quote or item array), excludes any hotel items when Land-Only Mode
 * is active or when a hub is set to NO_ACCOMMODATION, and returns the exact customer-facing
 * and internal totals.
 *
 * CRITICAL HISTORICAL SNAPSHOT PROTECTION:
 * When a saved/finalized quotation has an immutable `currencyConversionSnapshot` (or `pricingSnapshot`)
 * matching the quotation's currency, this function honors the saved snapshot totals so refreshing
 * global FX rates never alters historical quotations.
 */
export function calculateQuoteTotal(
  quoteOrItems: (Partial<Quotation> & { items?: QuoteItem[]; routeHubs?: TripRouteHub[]; scope?: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY' | 'FULL_PACKAGE'; quotationScope?: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY' | 'FULL_PACKAGE' }) | QuoteItem[],
  activeOptionIdOrMarginType?: string,
  marginValueArg?: number,
  currencyArg?: string
): {
  baseSellingPrice: number;
  baseTotalPrice: number;
  theUnboundBaseSellingPrice: number;
  preDiscountBaseSellingPrice: number;
  promotionDiscountAmount: number;
  discountedBaseSellingPrice: number;
  appliedPromotion?: AppliedPromotionSnapshot | null;
  markupAmount: number;
  marginAmount: number;
  additionalAgentMarginAmount: number;
  productLevelAgentMarkupTotal: number;
  overallAgentMarkupAmount: number;
  discountAmount: number;
  finalCustomerSellingPrice: number;
  finalTotalSellingPrice: number;
  totalSellingPrice: number;
  totalNetCost: number;
  itemsIncludedCount: number;
  hotelItemsIncludedCount: number;
  hotelTotalSellingPrice: number;
  hotelTotalNetCost: number;
  hasHotelAccommodation: boolean;
  landItemsIncludedCount: number;
  landBaseSellingPrice: number;
  landPartTotalSellingPrice: number;
  landTotalNetCost: number;
  hasLandServices: boolean;
} {
  const isHotelItem = (it: QuoteItem): boolean => {
    const cat = (it.product?.category || it.category || it.product?.productType || '').toLowerCase();
    return cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan') ||
           it.product?.productType === 'HOTEL' || (it as any).service_type === 'HOTEL' ||
           Boolean(it.isManualHotel || it.manualHotelDetails || it.hotelId);
  };

  let activeItems: QuoteItem[] = [];
  let activeHubs: TripRouteHub[] = [];
  let isLandOnly = false;
  let marginType = 'PERCENTAGE';
  let marginValue = 0;
  let discountPercent = 0;
  const effectiveCurrency = currencyEngine.normalizeCurrencyCode(
    currencyArg || (!Array.isArray(quoteOrItems) ? ((quoteOrItems as any).currency || (quoteOrItems as any).transactionCurrencySnapshot) : undefined) || 'USD',
    'USD'
  );

  // Check for Immutable Historical Quotation Snapshot when evaluating a Quotation object
  let activeCurrencySnapshot: QuotationCurrencySnapshot | undefined = undefined;
  let activePricingSnapshot: any = undefined;

  if (Array.isArray(quoteOrItems)) {
    activeItems = quoteOrItems;
    marginType = activeOptionIdOrMarginType || 'PERCENTAGE';
    marginValue = marginValueArg ?? 0;
  } else {
    const quote = quoteOrItems;
    const activeOption = quote.options && quote.options.length > 0
      ? (quote.options.find(o => o.id === (activeOptionIdOrMarginType || quote.activeOptionId)) || quote.options[0])
      : undefined;

    activeCurrencySnapshot =
      (activeOption as any)?.currencyConversionSnapshot ||
      (activeOption as any)?.pricingSnapshot?.currencyConversionSnapshot ||
      quote.currencyConversionSnapshot ||
      (quote as any).currency_conversion_snapshot ||
      quote.pricingSnapshot?.currencyConversionSnapshot ||
      (quote as any).pricing_snapshot?.currencyConversionSnapshot;

    activePricingSnapshot =
      (activeOption as any)?.pricingSnapshot ||
      quote.pricingSnapshot ||
      (quote as any).pricing_snapshot;

    const rawItems: QuoteItem[] = (activeOption?.items && activeOption.items.length > 0)
      ? activeOption.items
      : (quote.items || []);
    const hubs: TripRouteHub[] = (activeOption?.routeHubs && activeOption.routeHubs.length > 0)
      ? activeOption.routeHubs
      : (quote.routeHubs || []);
    activeHubs = hubs;

    const effectiveScope = activeOption?.scope || activeOption?.quotationScope || quote.scope || quote.quotationScope || 'HOTEL_LAND';
    isLandOnly = effectiveScope === 'LAND_ONLY';

    activeItems = rawItems.filter(it => !isExcludedNoAccommodationItem(it, hubs, isLandOnly));

    marginType = quote.agentMarginType || (quote as any).agent_margin_type || 'PERCENTAGE';
    marginValue = quote.agentMarginValue !== undefined
      ? quote.agentMarginValue
      : ((quote as any).agent_margin_value !== undefined ? (quote as any).agent_margin_value : (quote.overallMarkupPercent || 0));
    discountPercent = quote.overallDiscountPercent || 0;

    const reqRawAdminVal = (quote as any).adminManualMarginValue ?? (quote as any).admin_manual_margin_value;
    const reqAdminType: 'PERCENTAGE' | 'FIXED' =
      ((quote as any).adminManualMarginType ?? (quote as any).admin_manual_margin_type) === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    const reqAdminMode: 'REPLACE' | 'ADD' =
      ((quote as any).adminMarginMode ?? (quote as any).admin_margin_mode) === 'REPLACE' ? 'REPLACE' : 'ADD';
    const reqAdminValue = validateAdminManualMargin(reqRawAdminVal, reqAdminType).sanitizedValue;
    const hasReqAdminConfig =
      reqRawAdminVal !== undefined ||
      (quote as any).adminMarginMode !== undefined ||
      (quote as any).admin_margin_mode !== undefined;

    const quoteAgencyCtxForSnap = resolveQuoteAgencyPricingContext(quote);

    // AUTHORITATIVE SNAPSHOT PRIORITY:
    // If the quotation carries a validated AuthoritativeQuotationSnapshot for this currency and option
    // (or is locked), return its frozen commercial breakdown directly without recalculation.
    const authSnap = quote.authoritativeSnapshot;
    const requestedOptionId = activeOptionIdOrMarginType || activeOption?.id || quote.activeOptionId;
    const authSnapAdminMatches =
      !hasReqAdminConfig ||
      (
        (authSnap?.pricing?.adminMarginMode ??
          (authSnap?.pricing?.currencyConversionSnapshot?.totals as any)?.manualMarginAdjustmentMode ??
          'ADD') === reqAdminMode &&
        (authSnap?.pricing?.adminManualMarginType ??
          (authSnap?.pricing?.currencyConversionSnapshot?.totals as any)?.manualMarginAdjustmentType ??
          'PERCENTAGE') === reqAdminType &&
        Math.abs(
          Number(
            authSnap?.pricing?.adminManualMarginValue ??
            (authSnap?.pricing?.currencyConversionSnapshot?.totals as any)?.manualMarginAdjustmentValue ??
            0
          ) - reqAdminValue
        ) < 0.0001
      );
    const authSnapMarginMode =
      (authSnap?.pricing as any)?.activeMarginMode ??
      ((authSnap?.pricing as any)?.productLevelMarginEnabled !== undefined
        ? ((authSnap?.pricing as any)?.productLevelMarginEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL')
        : undefined);
    const authSnapAgencyMatches =
      !authSnapMarginMode ||
      (authSnapMarginMode === quoteAgencyCtxForSnap.activeMarginMode &&
        (quoteAgencyCtxForSnap.productLevelMarginEnabled ||
          (authSnap?.pricing as any)?.agentLevelMarginPercent === undefined ||
          Math.abs(Number((authSnap?.pricing as any).agentLevelMarginPercent) - quoteAgencyCtxForSnap.agentLevelMarginPercent) < 0.001));

    const isWorkingQuoteLocked = Boolean(
      quote.isLocked ||
      ['ISSUED', 'SENT', 'APPROVED', 'ACCEPTED', 'CONVERTED', 'BOOKED'].includes(String(quote.status || '').toUpperCase())
    );
    const quoteVerForSnap = Number(quote.version || quote.latestVersion || 0);
    const authSnapVer = Number(authSnap?.versionNumber || 0);
    const authSnapVersionMatches = !quoteVerForSnap || !authSnapVer || quoteVerForSnap === authSnapVer;
    const authSnapOverridesMatch =
      JSON.stringify((quote as any).surchargeOverrides || []) ===
      JSON.stringify(authSnap?.pricing?.surchargeOverrides || []);
    const activeHasProductMarkup = activeItems.some(it => Number(it.agentAdditionalMarkupValue || 0) > 0);
    const snapHasProductMarkup = Number(authSnap?.pricing?.productLevelAgentMarkupTotal || 0) > 0;
    const authSnapItemMarkupsMatch = activeHasProductMarkup === snapHasProductMarkup;
    const quotePromoSig = quote.appliedPromotion
      ? `${quote.appliedPromotion.promotionId}:${quote.appliedPromotion.code}:${quote.appliedPromotion.discountValue}:${quote.appliedPromotion.discountAmount ?? ''}`
      : '';
    const authSnapPromoSig = authSnap?.pricing?.appliedPromotion
      ? `${authSnap.pricing.appliedPromotion.promotionId}:${authSnap.pricing.appliedPromotion.code}:${authSnap.pricing.appliedPromotion.discountValue}:${authSnap.pricing.appliedPromotion.discountAmount ?? ''}`
      : '';
    const authSnapPromoMatches = quotePromoSig === authSnapPromoSig;

    if (
      authSnap &&
      authSnap.pricing &&
      currencyEngine.normalizeCurrencyCode(authSnap.pricing.currency) === effectiveCurrency &&
      (!requestedOptionId || !authSnap.selectedOptionId || authSnap.selectedOptionId === requestedOptionId) &&
      (
        (isWorkingQuoteLocked && authSnapVersionMatches && authSnapAdminMatches && authSnapOverridesMatch && authSnapPromoMatches) ||
        (
          !isWorkingQuoteLocked &&
          authSnapVersionMatches &&
          authSnap.itinerary.itemsCount === activeItems.length &&
          authSnap.pricing.agentMarginType === marginType &&
          Math.abs(Number(authSnap.pricing.agentMarginValue || 0) - Number(marginValue || 0)) < 0.0001 &&
          Math.abs(Number(authSnap.pricing.overallDiscountPercent || 0) - Number(discountPercent || 0)) < 0.0001 &&
          authSnapAdminMatches &&
          authSnapAgencyMatches &&
          authSnapOverridesMatch &&
          authSnapItemMarkupsMatch &&
          authSnapPromoMatches
        )
      )
    ) {
      const sp = authSnap.pricing;
      const hotelCount = activeItems.filter(isHotelItem).length;
      const landCount = activeItems.filter(it => !isHotelItem(it)).length;
      const hotelSelling = isLandOnly ? 0 : roundCurrencyAmount(sp.hotelAccommodationTotal || 0, effectiveCurrency);
      const landSelling = roundCurrencyAmount(sp.landPartTotal || 0, effectiveCurrency);
      const finalPrice = isLandOnly ? landSelling : roundCurrencyAmount(sp.finalCustomerSellingPrice || 0, effectiveCurrency);
      const b2bBase = roundCurrencyAmount(sp.theUnboundBaseSellingPrice ?? sp.baseFinalSellingPrice ?? finalPrice, effectiveCurrency);
      const spPromoAmt = roundCurrencyAmount(sp.promotionDiscountAmount ?? sp.appliedPromotion?.discountAmount ?? 0, effectiveCurrency);
      const spPreDiscountBase = roundCurrencyAmount(sp.preDiscountBaseSellingPrice ?? (b2bBase + spPromoAmt), effectiveCurrency);
      const markupAmt = roundCurrencyAmount(sp.agentMarginAmount ?? 0, effectiveCurrency);
      const snapTotalNet = roundCurrencyAmount(
        sp.currencyConversionSnapshot?.totals?.convertedTotalNetCost ?? (quote.totalNetCost || 0),
        effectiveCurrency
      );
      const hotelNet = sp.currencyConversionSnapshot
        ? roundCurrencyAmount(
            sp.currencyConversionSnapshot.lineItems.filter(li => li.isHotel).reduce((s, li) => s + li.convertedNetCost, 0),
            effectiveCurrency
          )
        : 0;
      const landNet = sp.currencyConversionSnapshot
        ? roundCurrencyAmount(
            sp.currencyConversionSnapshot.lineItems.filter(li => !li.isHotel).reduce((s, li) => s + li.convertedNetCost, 0),
            effectiveCurrency
          )
        : 0;

      return {
        baseSellingPrice: b2bBase,
        baseTotalPrice: b2bBase,
        theUnboundBaseSellingPrice: b2bBase,
        preDiscountBaseSellingPrice: spPreDiscountBase,
        promotionDiscountAmount: spPromoAmt,
        discountedBaseSellingPrice: b2bBase,
        appliedPromotion: sp.appliedPromotion || null,
        markupAmount: markupAmt,
        marginAmount: markupAmt,
        additionalAgentMarginAmount: markupAmt,
        productLevelAgentMarkupTotal: roundCurrencyAmount(sp.productLevelAgentMarkupTotal || 0, effectiveCurrency),
        overallAgentMarkupAmount: roundCurrencyAmount(sp.overallAgentMarkupAmount ?? markupAmt, effectiveCurrency),
        discountAmount: roundCurrencyAmount(sp.discountsTotal || 0, effectiveCurrency),
        finalCustomerSellingPrice: finalPrice,
        finalTotalSellingPrice: finalPrice,
        totalSellingPrice: finalPrice,
        totalNetCost: snapTotalNet,
        itemsIncludedCount: activeItems.length,
        hotelItemsIncludedCount: isLandOnly ? 0 : hotelCount,
        hotelTotalSellingPrice: hotelSelling,
        hotelTotalNetCost: isLandOnly ? 0 : hotelNet,
        hasHotelAccommodation: !isLandOnly && hotelSelling > 0 && (hotelCount > 0 || (hubs || []).some(h => h.accommodationType !== 'NO_ACCOMMODATION' && (h.hotelId || h.manualHotel?.hotelName))),
        landItemsIncludedCount: landCount,
        landBaseSellingPrice: landSelling,
        landPartTotalSellingPrice: landSelling,
        landTotalNetCost: landNet,
        hasLandServices: landSelling > 0 || landCount > 0
      };
    }

    const hasAnyItemLevelAgentMarkup = activeItems.some(it => Number(it.agentAdditionalMarkupValue) > 0);
    const snapshotIncludesProductMarkups =
      activeCurrencySnapshot?.totals?.productLevelAgentMarkupTotal !== undefined &&
      activeItems.every((it) => {
        const val = Number(it.agentAdditionalMarkupValue || 0);
        if (val <= 0) return true;
        return typeof it.agentAdditionalMarkupAmount === 'number';
      });

    const hubsHaveActiveHotel =
      !isLandOnly &&
      (hubs || []).some(
        (h) => h.accommodationType !== 'NO_ACCOMMODATION' && (Boolean(h.hotelId) || Boolean(h.manualHotel?.hotelName))
      );
    const snapshotHasMissingHubHotel =
      hubsHaveActiveHotel &&
      activeCurrencySnapshot &&
      Number(activeCurrencySnapshot.totals?.hotelAccommodationTotal || 0) <= 0;

    const currencySnapAdminMatches =
      !hasReqAdminConfig ||
      (
        ((activeCurrencySnapshot?.totals as any)?.manualMarginAdjustmentMode ?? 'ADD') === reqAdminMode &&
        ((activeCurrencySnapshot?.totals as any)?.manualMarginAdjustmentType ?? 'PERCENTAGE') === reqAdminType &&
        Math.abs(
          Number((activeCurrencySnapshot?.totals as any)?.manualMarginAdjustmentValue ?? 0) - reqAdminValue
        ) < 0.0001
      );

    const hasQuoteSurchargeOverrides = Array.isArray((quote as any).surchargeOverrides) && (quote as any).surchargeOverrides.length > 0;
    const curSnapMarginMode =
      (activeCurrencySnapshot as any)?.activeMarginMode ??
      ((activeCurrencySnapshot as any)?.productLevelMarginEnabled !== undefined
        ? ((activeCurrencySnapshot as any).productLevelMarginEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL')
        : undefined);
    const curSnapAgencyMatches =
      !curSnapMarginMode ||
      (curSnapMarginMode === quoteAgencyCtxForSnap.activeMarginMode &&
        (quoteAgencyCtxForSnap.productLevelMarginEnabled ||
          (activeCurrencySnapshot as any)?.agentLevelMarginPercent === undefined ||
          Math.abs(Number((activeCurrencySnapshot as any).agentLevelMarginPercent) - quoteAgencyCtxForSnap.agentLevelMarginPercent) < 0.001));
    const curSnapHasProductMarkup = Number((activeCurrencySnapshot?.totals as any)?.productLevelAgentMarkupTotal || 0) > 0;
    const curSnapPromo = (activeCurrencySnapshot?.totals as any)?.appliedPromotion as AppliedPromotionSnapshot | null | undefined;
    const curSnapPromoSig = curSnapPromo
      ? `${curSnapPromo.promotionId}:${curSnapPromo.code}:${curSnapPromo.discountValue}:${curSnapPromo.discountAmount ?? ''}`
      : '';
    const curSnapPromoMatches = quotePromoSig === curSnapPromoSig;

    // HISTORICAL QUOTE PROTECTION:
    // If the quote has a valid immutable currencyConversionSnapshot for this targetCurrency
    // and its margin, agency, admin manual adjustment, promo & item count match (or the quote is locked/finalized), return the exact snapshot values!
    if (
      activeCurrencySnapshot &&
      activeCurrencySnapshot.isValid &&
      !snapshotHasMissingHubHotel &&
      curSnapPromoMatches &&
      currencyEngine.normalizeCurrencyCode(activeCurrencySnapshot.targetCurrency) === effectiveCurrency &&
      (
        (isWorkingQuoteLocked && currencySnapAdminMatches && !hasQuoteSurchargeOverrides) ||
        (
          !isWorkingQuoteLocked &&
          !hasQuoteSurchargeOverrides &&
          (!hasAnyItemLevelAgentMarkup || snapshotIncludesProductMarkups) &&
          hasAnyItemLevelAgentMarkup === curSnapHasProductMarkup &&
          activeCurrencySnapshot.lineItems.length === activeItems.length &&
          activeCurrencySnapshot.totals.additionalAgentMarginType === marginType &&
          Math.abs(Number(activeCurrencySnapshot.totals.additionalAgentMarginValue || 0) - Number(marginValue || 0)) < 0.0001 &&
          Number((activeCurrencySnapshot.totals as any).overallDiscountPercent ?? discountPercent) === Number(discountPercent || 0) &&
          currencySnapAdminMatches &&
          curSnapAgencyMatches
        )
      )
    ) {
      const snapTotals = activeCurrencySnapshot.totals;
      const hotelCount = activeCurrencySnapshot.lineItems.filter(li => li.isHotel).length;
      const landCount = activeCurrencySnapshot.lineItems.filter(li => !li.isHotel).length;
      const hotelNet = roundCurrencyAmount(
        activeCurrencySnapshot.lineItems.filter(li => li.isHotel).reduce((s, li) => s + li.convertedNetCost, 0),
        effectiveCurrency
      );
      const landNet = roundCurrencyAmount(
        activeCurrencySnapshot.lineItems.filter(li => !li.isHotel).reduce((s, li) => s + li.convertedNetCost, 0),
        effectiveCurrency
      );
      const hotelSelling = isLandOnly ? 0 : roundCurrencyAmount(snapTotals.hotelAccommodationTotal, effectiveCurrency);
      const landSelling = roundCurrencyAmount(snapTotals.landPartTotal, effectiveCurrency);
      const finalPrice = isLandOnly ? landSelling : roundCurrencyAmount(snapTotals.finalCustomerSellingPrice, effectiveCurrency);

      const snapB2BBase = roundCurrencyAmount(
        (snapTotals as any).theUnboundBaseSellingPrice ?? snapTotals.b2bSellingPriceTotal ?? snapTotals.finalCustomerSellingPrice,
        effectiveCurrency
      );
      const snapPromoAmt = roundCurrencyAmount((snapTotals as any).promotionDiscountAmount ?? curSnapPromo?.discountAmount ?? 0, effectiveCurrency);
      const snapPreDiscountBase = roundCurrencyAmount((snapTotals as any).preDiscountBaseSellingPrice ?? (snapB2BBase + snapPromoAmt), effectiveCurrency);
      const snapMarkup = roundCurrencyAmount(snapTotals.additionalAgentMarginAmount ?? 0, effectiveCurrency);
      const snapProductMarkup = roundCurrencyAmount((snapTotals as any).productLevelAgentMarkupTotal ?? 0, effectiveCurrency);
      const snapOverallMarkup = roundCurrencyAmount((snapTotals as any).overallAgentMarkupAmount ?? snapMarkup, effectiveCurrency);

      return {
        baseSellingPrice: snapB2BBase,
        baseTotalPrice: snapB2BBase,
        theUnboundBaseSellingPrice: snapB2BBase,
        preDiscountBaseSellingPrice: snapPreDiscountBase,
        promotionDiscountAmount: snapPromoAmt,
        discountedBaseSellingPrice: snapB2BBase,
        appliedPromotion: curSnapPromo || null,
        markupAmount: snapMarkup,
        marginAmount: snapMarkup,
        additionalAgentMarginAmount: snapMarkup,
        productLevelAgentMarkupTotal: snapProductMarkup,
        overallAgentMarkupAmount: snapOverallMarkup,
        discountAmount: roundCurrencyAmount(snapTotals.discountsTotal, effectiveCurrency),
        finalCustomerSellingPrice: finalPrice,
        finalTotalSellingPrice: finalPrice,
        totalSellingPrice: finalPrice,
        totalNetCost: roundCurrencyAmount(snapTotals.convertedTotalNetCost, effectiveCurrency),
        itemsIncludedCount: activeCurrencySnapshot.lineItems.length,
        hotelItemsIncludedCount: isLandOnly ? 0 : hotelCount,
        hotelTotalSellingPrice: hotelSelling,
        hotelTotalNetCost: isLandOnly ? 0 : hotelNet,
        hasHotelAccommodation: !isLandOnly && hotelCount > 0 && hotelSelling > 0,
        landItemsIncludedCount: landCount,
        landBaseSellingPrice: landSelling,
        landPartTotalSellingPrice: landSelling,
        landTotalNetCost: landNet,
        hasLandServices: landSelling > 0 || landCount > 0
      };
    }
  }

  const preserveHistorical = !Array.isArray(quoteOrItems) && Boolean(quoteOrItems.isLocked);
  const quoteAgencyCtx = !Array.isArray(quoteOrItems)
    ? resolveQuoteAgencyPricingContext(quoteOrItems)
    : resolveQuoteAgencyPricingContext({});
  const isProductLevelMarginEnabled = quoteAgencyCtx.productLevelMarginEnabled;
  const customAgentMarginPercent = quoteAgencyCtx.agentLevelMarginPercent;
  const expectedMarginMode = quoteAgencyCtx.activeMarginMode;

  let centralizedMasterSurcharges: SurchargeMaster[] = [];
  try {
    centralizedMasterSurcharges = AppDatabase.getInstance().getSurchargeMasters(true);
  } catch {
    centralizedMasterSurcharges = [];
  }
  const activeCentralMasterIdSet = new Set(
    (centralizedMasterSurcharges || [])
      .filter(s => s && !s.isDeleted && s.status === 'ACTIVE' && s.isActive !== false)
      .map(s => s.id)
  );
  const quoteSurchargeOverrides = !Array.isArray(quoteOrItems) ? (quoteOrItems as any).surchargeOverrides : undefined;

  // Resolve each item's calculation in effectiveCurrency identically to calculateQuoteInternalBreakdown.
  const resolveItemInTargetCurrency = (it: QuoteItem): { selling: number; net: number; feeAndTax: number } => {
    if (isManualHotelQuoteItem(it)) {
      const mh = resolveManualHotelPricingInTargetCurrency(it, effectiveCurrency, preserveHistorical);
      return {
        selling: mh.hasValidRate ? mh.finalSellingPrice : 0,
        net: mh.hasValidRate ? mh.convertedNetCost : 0,
        feeAndTax: mh.hasValidRate ? roundCurrencyAmount(mh.serviceFee + mh.taxAmount + mh.surchargeTotal, effectiveCurrency) : 0
      };
    }

    const calc = it.calculation as any;
    const rawSourceCurrency = it.product?.nativeCurrency || it.product?.currency || calc?.nativeCurrency || effectiveCurrency;
    const snapshotRate = preserveHistorical && calc?.currency === effectiveCurrency ? calc?.fxDetails?.effectiveRate : undefined;
    const fxCheck = snapshotRate
      ? { isValid: true, fromCode: rawSourceCurrency, toCode: effectiveCurrency, effectiveRate: snapshotRate }
      : currencyEngine.validateConversion(rawSourceCurrency, effectiveCurrency);

    const calcCurrency = calc?.currency
      ? currencyEngine.normalizeCurrencyCode(calc.currency)
      : (calc?.nativeCurrency &&
          !calc?.fxDetails?.isConverted &&
          calc?.totalNetCost !== undefined &&
          calc?.totalNetCost === calc?.nativeTotalNetCost
            ? currencyEngine.normalizeCurrencyCode(calc.nativeCurrency)
            : undefined);
    const calcRate = calc?.fxDetails?.effectiveRate;
    const isRateStillCurrent =
      preserveHistorical ||
      String(rawSourceCurrency).toUpperCase() === String(effectiveCurrency).toUpperCase() ||
      (fxCheck.isValid && typeof calcRate === 'number' && Math.abs(calcRate - fxCheck.effectiveRate) < 0.0000001);

    const calcMarginMode = calc?.activeMarginMode;
    const isMarginModeMatching =
      preserveHistorical ||
      (!calcMarginMode
        ? isProductLevelMarginEnabled
        : (calcMarginMode === expectedMarginMode &&
            (isProductLevelMarginEnabled ||
              Math.abs(((calc?.markupRate || 0) * 100) - customAgentMarginPercent) < 0.001)));

    const hasItemSurchargeOverrides =
      Array.isArray(quoteSurchargeOverrides) &&
      quoteSurchargeOverrides.some(
        (ov: any) => !ov.itemId || ov.itemId === it.id || !ov.productId || ov.productId === it.product?.id
      );
    const existingSurchargesArr = calc?.appliedSurcharges;
    const hasCompleteSurchargeList =
      !calc?.surchargeTotal ||
      calc.surchargeTotal === 0 ||
      (Array.isArray(existingSurchargesArr) && existingSurchargesArr.length > 0);
    const isTravelDateCurrent =
      preserveHistorical || !it.travelDate || !calc?.travelDate || calc.travelDate === it.travelDate;
    const hasStaleOrMissingDraftSurcharge =
      !preserveHistorical &&
      Array.isArray(existingSurchargesArr) &&
      existingSurchargesArr.some((as: any) => {
        if (!as || as.overrideType === 'ADD_CUSTOM_SURCHARGE') return false;
        return !(as.surchargeId && activeCentralMasterIdSet.has(as.surchargeId));
      });
    const isSurchargeCatalogVersionCurrent =
      preserveHistorical ||
      (!hasStaleOrMissingDraftSurcharge &&
        (calc?.surchargeCatalogVersion === pricingCache.getSurchargeCatalogVersion() ||
          (calc?.surchargeCatalogVersion === undefined && activeCentralMasterIdSet.size === 0)));

    if (
      !hasItemSurchargeOverrides &&
      calc &&
      typeof calc.totalNetCost === 'number' &&
      calc.totalNetCost > 0 &&
      calcCurrency === effectiveCurrency &&
      isRateStillCurrent &&
      isMarginModeMatching &&
      isSurchargeCatalogVersionCurrent &&
      (preserveHistorical || (hasCompleteSurchargeList && isTravelDateCurrent))
    ) {
      const selling =
        calc.finalTotalSellingPrice ??
        calc.totalSellingPrice ??
        (it as any).totalSellingPrice ??
        (it as any).totalPrice ??
        (it as any).sellingPrice ??
        0;
      const net = calc.totalNetCost ?? (it as any).totalNetCost ?? 0;
      const feeAndTax = (calc.serviceFee || 0) + (calc.taxAmount || 0) + (calc.surchargeTotal || 0);
      return {
        selling: roundCurrencyAmount(selling, effectiveCurrency),
        net: roundCurrencyAmount(net, effectiveCurrency),
        feeAndTax: roundCurrencyAmount(feeAndTax, effectiveCurrency)
      };
    }

    if (it.product) {
      const enrichedProduct: Product = {
        ...it.product,
        ...((it as any).hotelId ? { hotelId: (it as any).hotelId } : {}),
        ...((it as any).roomTypeId ? { roomTypeId: (it as any).roomTypeId } : {}),
        ...((it as any).nights ? { nights: (it as any).nights } : {}),
        ...((it as any).roomsCount ? { roomsCount: (it as any).roomsCount } : {}),
        ...((it as any).manualHotelDetails ? { manualHotelDetails: (it as any).manualHotelDetails } : {}),
        ...((it as any).master_product_id ? { master_product_id: (it as any).master_product_id } : {})
      } as Product;
      const itemServiceDate = (it.travelDate || (it as any).checkInDate || (it as any).serviceDate || '').trim() || undefined;
      const itemServiceEndDate = ((it as any).checkOutDate || (it as any).serviceEndDate || (it as any).manualHotelDetails?.checkOutDate || '').trim() || undefined;
      const itemNights = (it as any).nights || (it.product as any)?.nights || (it as any).manualHotelDetails?.numberOfNights;
      const itemRoomsCount = (it as any).roomsCount || (it.product as any)?.roomsCount || (it as any).manualHotelDetails?.numberOfRooms || 1;
      const itemCoverageDays = (it as any).coverageDays || (it.product as any)?.coverageDays;

      const freshCalc = calculateProductPrice(enrichedProduct, {
        productId: enrichedProduct.id,
        productName: enrichedProduct.name,
        itemId: it.id,
        pricingTier: 'B2B',
        userRole: 'ADMIN',
        companyId: quoteAgencyCtx.companyId,
        agencyName: quoteAgencyCtx.agencyName,
        adults: it.pax?.adults || 2,
        children: it.pax?.children || 0,
        infants: it.pax?.infants || 0,
        travelDate: itemServiceDate,
        serviceEndDate: itemServiceEndDate,
        nights: itemNights,
        roomsCount: itemRoomsCount,
        coverageDays: itemCoverageDays,
        targetCurrency: effectiveCurrency,
        selectedAddonIds: it.selectedAddonIds || [],
        surchargeOverrides: quoteSurchargeOverrides,
        productLevelMarginEnabled: isProductLevelMarginEnabled,
        customAgentMarginPercent,
        frozenAppliedSurcharges: preserveHistorical ? existingSurchargesArr : undefined,
        ...(snapshotRate ? { snapshotExchangeRate: snapshotRate } : {})
      } as any);

      const rawApplied = Array.isArray((freshCalc as any).appliedSurcharges) ? (freshCalc as any).appliedSurcharges : [];
      const itemPreSurcharge =
        (freshCalc as any).baseSellingPriceBeforeSurcharges !== undefined
          ? roundCurrencyAmount((freshCalc as any).baseSellingPriceBeforeSurcharges, effectiveCurrency)
          : roundCurrencyAmount((freshCalc.finalTotalSellingPrice || 0) - ((freshCalc as any).surchargeTotal || 0), effectiveCurrency);
      const reconciled = rawApplied.length > 0
        ? reconcileAppliedSurchargesMetadataAndStacking({
            appliedSurcharges: rawApplied,
            itemId: it.id,
            product: enrichedProduct,
            productName: enrichedProduct.name,
            serviceDate: itemServiceDate || (freshCalc as any).travelDate,
            serviceEndDate: itemServiceEndDate,
            nights: itemNights,
            targetCurrency: effectiveCurrency,
            baseSellingPriceInTargetCurrency: itemPreSurcharge,
            masterSurcharges: centralizedMasterSurcharges,
            preserveHistoricalAmounts: preserveHistorical
          })
        : [];
      const reconciledSurcharge = reconciled.length > 0
        ? roundCurrencyAmount(reconciled.reduce((sum, s) => sum + (s.appliedAmountConverted || 0), 0), effectiveCurrency)
        : roundCurrencyAmount((freshCalc as any).surchargeTotal || 0, effectiveCurrency);

      if (freshCalc.totalNetCost > 0 || freshCalc.finalTotalSellingPrice > 0) {
        return {
          selling: roundCurrencyAmount(freshCalc.finalTotalSellingPrice, effectiveCurrency),
          net: roundCurrencyAmount(freshCalc.totalNetCost, effectiveCurrency),
          feeAndTax: roundCurrencyAmount(
            (freshCalc.serviceFee || 0) + (freshCalc.taxAmount || 0) + reconciledSurcharge,
            effectiveCurrency
          )
        };
      }
    }

    const fallbackSelling =
      calc?.finalTotalSellingPrice ||
      calc?.totalSellingPrice ||
      (it as any).totalSellingPrice ||
      (it as any).totalPrice ||
      (it as any).sellingPrice ||
      0;
    const fallbackFromCurr = calcCurrency || it.product?.currency || effectiveCurrency;
    const convertedSelling = fallbackFromCurr === effectiveCurrency
      ? fallbackSelling
      : currencyEngine.convert(fallbackSelling, fallbackFromCurr, effectiveCurrency);
    const fallbackNet = calc?.totalNetCost || (it as any).totalNetCost || 0;
    const convertedNet = fallbackFromCurr === effectiveCurrency
      ? fallbackNet
      : currencyEngine.convert(fallbackNet, fallbackFromCurr, effectiveCurrency);
    const rawFallbackFeeAndTax = (calc?.serviceFee || 0) + (calc?.taxAmount || 0) + (calc?.surchargeTotal || 0);
    const convertedFeeAndTax = fallbackFromCurr === effectiveCurrency
      ? rawFallbackFeeAndTax
      : currencyEngine.convert(rawFallbackFeeAndTax, fallbackFromCurr, effectiveCurrency);
    return {
      selling: roundCurrencyAmount(convertedSelling, effectiveCurrency),
      net: roundCurrencyAmount(convertedNet, effectiveCurrency),
      feeAndTax: roundCurrencyAmount(convertedFeeAndTax, effectiveCurrency)
    };
  };

  // Partition activeItems into strictly non-overlapping Hotel vs Non-Hotel (Land) sets
  const hotelItems = activeItems.filter(isHotelItem);
  const landItems = activeItems.filter(it => !isHotelItem(it));

  const resolvedHotels = hotelItems.map(resolveItemInTargetCurrency);
  const resolvedLands = landItems.map(resolveItemInTargetCurrency);

  let hotelBaseSellingPrice = roundCurrencyAmount(resolvedHotels.reduce((sum, r) => sum + r.selling, 0), effectiveCurrency);
  let hotelTotalNetCost = roundCurrencyAmount(resolvedHotels.reduce((sum, r) => sum + r.net, 0), effectiveCurrency);
  let hotelFeeAndTax = roundCurrencyAmount(resolvedHotels.reduce((sum, r) => sum + r.feeAndTax, 0), effectiveCurrency);

  // Include any routeHub manualHotel that was not already represented in hotelItems using strict occurrence matching
  let hubManualHotelsCount = 0;
  if (!isLandOnly && activeHubs.length > 0) {
    const countedHotelIds = new Set<string>();
    activeHubs.forEach(h => {
      if (h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none') return;
      const matched = hotelItems.find(it =>
        !countedHotelIds.has(it.id) && doesHotelItemBelongToHubOccurrence(it, h, activeHubs)
      );
      if (matched) {
        countedHotelIds.add(matched.id);
      } else if (h.manualHotel) {
        const manualSourceCurr = currencyEngine.normalizeCurrencyCode(
          (h.manualHotel as any)?.rateCurrency || (h.manualHotel as any)?.currency || effectiveCurrency,
          effectiveCurrency
        ) as CurrencyCode;
        const synthItem: any = {
          id: `hub-manual-hotel-${h.itineraryHubOccurrenceId || h.id}`,
          isManualHotel: true,
          accommodationType: 'manual',
          manualHotelDetails: h.manualHotel,
          nights: h.nights || h.manualHotel.numberOfNights,
          roomsCount: h.roomsCount || h.manualHotel.numberOfRooms,
          hubId: h.id,
          itineraryHubOccurrenceId: h.itineraryHubOccurrenceId || h.id
        };
        const mh = resolveManualHotelPricingInTargetCurrency(synthItem, effectiveCurrency, preserveHistorical);
        if (mh.hasValidRate && mh.convertedNetCost > 0) {
          hotelBaseSellingPrice = roundCurrencyAmount(hotelBaseSellingPrice + mh.finalSellingPrice, effectiveCurrency);
          hotelTotalNetCost = roundCurrencyAmount(hotelTotalNetCost + mh.convertedNetCost, effectiveCurrency);
          hotelFeeAndTax = roundCurrencyAmount(hotelFeeAndTax + mh.serviceFee + mh.taxAmount + mh.surchargeTotal, effectiveCurrency);
          hubManualHotelsCount++;
        } else {
          const rawManualPrice = (h.manualHotel as any)?.totalSellingPrice ||
                                 (h.manualHotel as any)?.totalPrice ||
                                 (h.manualHotel as any)?.price ||
                                 ((Number(h.manualHotel.ratePerNight || 0)) * Math.max(1, Number(h.nights || h.manualHotel.numberOfNights || 1)) * Math.max(1, Number(h.manualHotel.numberOfRooms || 1)));
          if (rawManualPrice > 0) {
            const convertedManualPrice = preserveHistorical && (h.manualHotel as any)?.totalSellingPrice
              ? rawManualPrice
              : currencyEngine.convert(rawManualPrice, manualSourceCurr, effectiveCurrency);
            hotelBaseSellingPrice = roundCurrencyAmount(hotelBaseSellingPrice + convertedManualPrice, effectiveCurrency);
            const rawManualNet = (h.manualHotel as any)?.totalNetCost ?? (h.manualHotel as any)?.netCost ??
                                 ((Number(h.manualHotel.ratePerNight || 0)) * Math.max(1, Number(h.nights || h.manualHotel.numberOfNights || 1)) * Math.max(1, Number(h.manualHotel.numberOfRooms || 1)));
            if (rawManualNet > 0) {
              const convertedManualNet = currencyEngine.convert(rawManualNet, manualSourceCurr, effectiveCurrency);
              hotelTotalNetCost = roundCurrencyAmount(hotelTotalNetCost + convertedManualNet, effectiveCurrency);
            }
            hubManualHotelsCount++;
          }
        }
      }
    });
  }

  const landBaseSellingPrice = roundCurrencyAmount(resolvedLands.reduce((sum, r) => sum + r.selling, 0), effectiveCurrency);
  const landTotalNetCost = roundCurrencyAmount(resolvedLands.reduce((sum, r) => sum + r.net, 0), effectiveCurrency);
  const landFeeAndTax = roundCurrencyAmount(resolvedLands.reduce((sum, r) => sum + r.feeAndTax, 0), effectiveCurrency);

  const baseSellingPrice = roundCurrencyAmount(hotelBaseSellingPrice + landBaseSellingPrice, effectiveCurrency);
  const totalNetCost = roundCurrencyAmount(hotelTotalNetCost + landTotalNetCost, effectiveCurrency);
  const totalFeeAndTax = roundCurrencyAmount(hotelFeeAndTax + landFeeAndTax, effectiveCurrency);

  const rawAdminMarginVal = !Array.isArray(quoteOrItems)
    ? ((quoteOrItems as any).adminManualMarginValue ?? (quoteOrItems as any).admin_manual_margin_value ?? activePricingSnapshot?.adminManualMarginValue)
    : undefined;
  const adminMarginType: 'PERCENTAGE' | 'FIXED' = !Array.isArray(quoteOrItems)
    ? (((quoteOrItems as any).adminManualMarginType ?? (quoteOrItems as any).admin_manual_margin_type ?? activePricingSnapshot?.adminManualMarginType) === 'FIXED' ? 'FIXED' : 'PERCENTAGE')
    : 'PERCENTAGE';
  const adminMarginMode: 'REPLACE' | 'ADD' = !Array.isArray(quoteOrItems)
    ? (((quoteOrItems as any).adminMarginMode ?? (quoteOrItems as any).admin_margin_mode ?? activePricingSnapshot?.adminMarginMode) === 'REPLACE' ? 'REPLACE' : 'ADD')
    : 'ADD';
  const adminMarginValue = validateAdminManualMargin(rawAdminMarginVal, adminMarginType).sanitizedValue;
  const hasAdminMarginConfig = !Array.isArray(quoteOrItems) && (
    rawAdminMarginVal !== undefined ||
    (quoteOrItems as any).adminMarginMode !== undefined ||
    (quoteOrItems as any).admin_margin_mode !== undefined ||
    activePricingSnapshot?.adminMarginMode !== undefined
  );

  let effectiveBaseSellingPrice = baseSellingPrice;
  let effectiveHotelBaseSellingPrice = hotelBaseSellingPrice;
  let effectiveLandBaseSellingPrice = landBaseSellingPrice;

  const adminMarginAmount = adminMarginType === 'PERCENTAGE'
    ? roundCurrencyAmount(totalNetCost * (adminMarginValue / 100), effectiveCurrency)
    : roundCurrencyAmount(adminMarginValue, effectiveCurrency);

  let usedSavedStage1Base = false;

  if (hasAdminMarginConfig && (totalNetCost > 0 || (adminMarginType === 'FIXED' && adminMarginAmount > 0))) {
    effectiveBaseSellingPrice = adminMarginMode === 'REPLACE'
      ? roundCurrencyAmount(totalNetCost + adminMarginAmount + totalFeeAndTax, effectiveCurrency)
      : roundCurrencyAmount(baseSellingPrice + adminMarginAmount, effectiveCurrency);

    if (adminMarginType === 'PERCENTAGE') {
      const hotelAdminMargin = roundCurrencyAmount(hotelTotalNetCost * (adminMarginValue / 100), effectiveCurrency);
      const landAdminMargin = roundCurrencyAmount(adminMarginAmount - hotelAdminMargin, effectiveCurrency);
      effectiveHotelBaseSellingPrice = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(hotelTotalNetCost + hotelAdminMargin + hotelFeeAndTax, effectiveCurrency)
        : roundCurrencyAmount(hotelBaseSellingPrice + hotelAdminMargin, effectiveCurrency);
      effectiveLandBaseSellingPrice = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(landTotalNetCost + landAdminMargin + landFeeAndTax, effectiveCurrency)
        : roundCurrencyAmount(landBaseSellingPrice + landAdminMargin, effectiveCurrency);
    } else {
      const basisTotal = adminMarginMode === 'REPLACE' ? totalNetCost : baseSellingPrice;
      const hotelBasis = adminMarginMode === 'REPLACE' ? hotelTotalNetCost : hotelBaseSellingPrice;
      const hotelShare = basisTotal > 0 ? (hotelBasis / basisTotal) : ((hotelItems.length + hubManualHotelsCount) > 0 ? 1 : 0);
      const hotelAdminMargin = roundCurrencyAmount(adminMarginAmount * hotelShare, effectiveCurrency);
      const landAdminMargin = roundCurrencyAmount(adminMarginAmount - hotelAdminMargin, effectiveCurrency);
      effectiveHotelBaseSellingPrice = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(hotelTotalNetCost + hotelAdminMargin + hotelFeeAndTax, effectiveCurrency)
        : roundCurrencyAmount(hotelBaseSellingPrice + hotelAdminMargin, effectiveCurrency);
      effectiveLandBaseSellingPrice = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(landTotalNetCost + landAdminMargin + landFeeAndTax, effectiveCurrency)
        : roundCurrencyAmount(landBaseSellingPrice + landAdminMargin, effectiveCurrency);
    }
  } else if (!Array.isArray(quoteOrItems) && (quoteOrItems as any).totalNetCost === undefined) {
    // When net costs and admin manual margin were stripped (sanitized customer/agent quote), honor saved Stage 1 Final Total (which already includes Stage 1 discounts)
    const savedStage1Base =
      (quoteOrItems as any).revisedSellingPrice ??
      (quoteOrItems as any).revised_selling_price ??
      (quoteOrItems as any).theUnboundBaseSellingPrice ??
      (quoteOrItems as any).baseFinalSellingPrice ??
      (quoteOrItems as any).base_final_selling_price ??
      activePricingSnapshot?.theUnboundBaseSellingPrice ??
      activePricingSnapshot?.baseFinalSellingPrice;
    if (typeof savedStage1Base === 'number' && savedStage1Base > 0 && (!isLandOnly || hotelBaseSellingPrice === 0)) {
      usedSavedStage1Base = true;
      effectiveBaseSellingPrice = roundCurrencyAmount(savedStage1Base, effectiveCurrency);
      if (baseSellingPrice > 0 && effectiveBaseSellingPrice !== baseSellingPrice) {
        const hotelShare = hotelBaseSellingPrice / baseSellingPrice;
        effectiveHotelBaseSellingPrice = roundCurrencyAmount(effectiveBaseSellingPrice * hotelShare, effectiveCurrency);
        effectiveLandBaseSellingPrice = roundCurrencyAmount(effectiveBaseSellingPrice - effectiveHotelBaseSellingPrice, effectiveCurrency);
      }
    }
  }

  // Apply overall discount at Stage 1 ONLY when not already baked into a sanitized savedStage1Base
  const stage1DiscountAmount = usedSavedStage1Base
    ? roundCurrencyAmount(activePricingSnapshot?.discountsTotal ?? 0, effectiveCurrency)
    : (discountPercent > 0 && (totalNetCost > 0 || Array.isArray(quoteOrItems))
        ? roundCurrencyAmount(effectiveBaseSellingPrice * (discountPercent / 100), effectiveCurrency)
        : 0);
  const stage1PrePromoBase = usedSavedStage1Base
    ? effectiveBaseSellingPrice
    : Math.max(0, roundCurrencyAmount(effectiveBaseSellingPrice - stage1DiscountAmount, effectiveCurrency));

  const hotelDiscountAmount = !usedSavedStage1Base && discountPercent > 0 && stage1DiscountAmount > 0
    ? roundCurrencyAmount(effectiveHotelBaseSellingPrice * (discountPercent / 100), effectiveCurrency)
    : 0;
  const stage1HotelPrePromo = Math.max(0, roundCurrencyAmount(effectiveHotelBaseSellingPrice - hotelDiscountAmount, effectiveCurrency));
  const landDiscountAmount = !usedSavedStage1Base ? roundCurrencyAmount(stage1DiscountAmount - hotelDiscountAmount, effectiveCurrency) : 0;
  const stage1LandPrePromo = Math.max(0, roundCurrencyAmount(effectiveLandBaseSellingPrice - landDiscountAmount, effectiveCurrency));

  // STAGE 1B: Promotional Discount Code Application (strictly on TheUnbound Base Selling Price, BEFORE Stage 2 Agent Markup)
  const quoteAppliedPromo: AppliedPromotionSnapshot | null = !Array.isArray(quoteOrItems)
    ? ((quoteOrItems as any).appliedPromotion || (quoteOrItems as any).authoritativeSnapshot?.pricing?.appliedPromotion || null)
    : null;
  const savedBaseAlreadyIncludesPromo =
    usedSavedStage1Base &&
    Boolean(quoteAppliedPromo) &&
    !Array.isArray(quoteOrItems) &&
    typeof (quoteOrItems as any).discountedBaseSellingPrice === 'number' &&
    Math.abs(effectiveBaseSellingPrice - Number((quoteOrItems as any).discountedBaseSellingPrice)) < 0.05;

  const quotePromoCalc = savedBaseAlreadyIncludesPromo
    ? {
        preDiscountBaseSellingPrice: roundCurrencyAmount(
          Number((quoteOrItems as any).preDiscountBaseSellingPrice ?? (effectiveBaseSellingPrice + Number((quoteOrItems as any).promotionDiscountAmount ?? quoteAppliedPromo?.discountAmount ?? 0))),
          effectiveCurrency
        ),
        promotionDiscountAmount: roundCurrencyAmount(
          Number((quoteOrItems as any).promotionDiscountAmount ?? quoteAppliedPromo?.discountAmount ?? 0),
          effectiveCurrency
        ),
        discountedBaseSellingPrice: effectiveBaseSellingPrice,
        updatedSnapshot: quoteAppliedPromo
      }
    : computeStage1PromotionDiscount({
        appliedPromotion: quoteAppliedPromo,
        stage1PreDiscountBase: stage1PrePromoBase,
        targetCurrency: effectiveCurrency
      });

  const preDiscountBaseSellingPrice = quotePromoCalc.preDiscountBaseSellingPrice;
  const promotionDiscountAmount = quotePromoCalc.promotionDiscountAmount;
  const stage1FinalBase = quotePromoCalc.discountedBaseSellingPrice;
  const resolvedAppliedPromotion = quotePromoCalc.updatedSnapshot;
  const promoScaleRatio =
    !savedBaseAlreadyIncludesPromo && preDiscountBaseSellingPrice > 0 && promotionDiscountAmount > 0
      ? stage1FinalBase / preDiscountBaseSellingPrice
      : 1;

  const stage1HotelFinalBase =
    !savedBaseAlreadyIncludesPromo && promotionDiscountAmount > 0
      ? Math.max(0, roundCurrencyAmount(stage1HotelPrePromo * promoScaleRatio, effectiveCurrency))
      : stage1HotelPrePromo;
  const stage1LandFinalBase =
    !savedBaseAlreadyIncludesPromo && promotionDiscountAmount > 0
      ? Math.max(0, roundCurrencyAmount(stage1FinalBase - stage1HotelFinalBase, effectiveCurrency))
      : stage1LandPrePromo;

  // STAGE 2: Agent-Controlled Additional Markup ("Your Additional Markup")
  // Enforce non-negative validation and deterministic No-Double-Application rule
  const validatedOverallMarginValue = validateAgentAdditionalMarkup(marginValue).sanitizedValue;
  const stage1ScaleRatio = baseSellingPrice > 0 ? (stage1FinalBase / baseSellingPrice) : 1;

  let productLevelMarkupTotal = 0;
  let hotelProductLevelMarkupTotal = 0;
  let unmarkedItemsStage1Base = 0;
  let unmarkedHotelStage1Base = 0;

  const nonExcludedItemCount = hotelItems.length + landItems.length;
  const computeItemStage1Base = (rawSelling: number, itemNet: number, itemFeeAndTax: number): number => {
    let itemStage1PreDiscount = rawSelling;
    if (!usedSavedStage1Base && hasAdminMarginConfig && (totalNetCost > 0 || (adminMarginType === 'FIXED' && adminMarginAmount > 0))) {
      let itemAdminMargin = 0;
      if (adminMarginType === 'PERCENTAGE') {
        itemAdminMargin = roundCurrencyAmount(itemNet * (adminMarginValue / 100), effectiveCurrency);
      } else {
        const basisTotal = adminMarginMode === 'REPLACE' ? totalNetCost : baseSellingPrice;
        const itemBasis = adminMarginMode === 'REPLACE' ? itemNet : rawSelling;
        const itemShare = basisTotal > 0 ? itemBasis / basisTotal : (nonExcludedItemCount > 0 ? 1 / nonExcludedItemCount : 0);
        itemAdminMargin = roundCurrencyAmount(adminMarginAmount * itemShare, effectiveCurrency);
      }
      itemStage1PreDiscount = adminMarginMode === 'REPLACE'
        ? roundCurrencyAmount(itemNet + itemAdminMargin + itemFeeAndTax, effectiveCurrency)
        : roundCurrencyAmount(rawSelling + itemAdminMargin, effectiveCurrency);
    }
    const itemStage1Discount = !usedSavedStage1Base && discountPercent > 0
      ? roundCurrencyAmount(itemStage1PreDiscount * (discountPercent / 100), effectiveCurrency)
      : 0;
    const itemStage1PrePromo = hasAdminMarginConfig && !usedSavedStage1Base
      ? Math.max(0, roundCurrencyAmount(itemStage1PreDiscount - itemStage1Discount, effectiveCurrency))
      : (Math.abs(stage1ScaleRatio - 1) > 0.00001
          ? roundCurrencyAmount(rawSelling * stage1ScaleRatio, effectiveCurrency)
          : roundCurrencyAmount(rawSelling, effectiveCurrency));
    return hasAdminMarginConfig && !usedSavedStage1Base && !savedBaseAlreadyIncludesPromo && promotionDiscountAmount > 0
      ? Math.max(0, roundCurrencyAmount(itemStage1PrePromo * promoScaleRatio, effectiveCurrency))
      : itemStage1PrePromo;
  };

  hotelItems.forEach((it, idx) => {
    const resolved = resolvedHotels[idx] || { selling: 0, net: 0, feeAndTax: 0 };
    const itemStage1 = computeItemStage1Base(resolved.selling, resolved.net, resolved.feeAndTax);
    const itemMarkupVal = validateAgentAdditionalMarkup(it.agentAdditionalMarkupValue).sanitizedValue;
    const itemMarkupType = it.agentAdditionalMarkupType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    if (itemMarkupVal > 0) {
      const itemMarkupAmt = itemMarkupType === 'PERCENTAGE'
        ? roundCurrencyAmount(itemStage1 * (itemMarkupVal / 100), effectiveCurrency)
        : roundCurrencyAmount(itemMarkupVal, effectiveCurrency);
      productLevelMarkupTotal = roundCurrencyAmount(productLevelMarkupTotal + itemMarkupAmt, effectiveCurrency);
      hotelProductLevelMarkupTotal = roundCurrencyAmount(hotelProductLevelMarkupTotal + itemMarkupAmt, effectiveCurrency);
    } else {
      unmarkedItemsStage1Base = roundCurrencyAmount(unmarkedItemsStage1Base + itemStage1, effectiveCurrency);
      unmarkedHotelStage1Base = roundCurrencyAmount(unmarkedHotelStage1Base + itemStage1, effectiveCurrency);
    }
  });

  landItems.forEach((it, idx) => {
    const resolved = resolvedLands[idx] || { selling: 0, net: 0, feeAndTax: 0 };
    const itemStage1 = computeItemStage1Base(resolved.selling, resolved.net, resolved.feeAndTax);
    const itemMarkupVal = validateAgentAdditionalMarkup(it.agentAdditionalMarkupValue).sanitizedValue;
    const itemMarkupType = it.agentAdditionalMarkupType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    if (itemMarkupVal > 0) {
      const itemMarkupAmt = itemMarkupType === 'PERCENTAGE'
        ? roundCurrencyAmount(itemStage1 * (itemMarkupVal / 100), effectiveCurrency)
        : roundCurrencyAmount(itemMarkupVal, effectiveCurrency);
      productLevelMarkupTotal = roundCurrencyAmount(productLevelMarkupTotal + itemMarkupAmt, effectiveCurrency);
    } else {
      unmarkedItemsStage1Base = roundCurrencyAmount(unmarkedItemsStage1Base + itemStage1, effectiveCurrency);
    }
  });

  if (productLevelMarkupTotal === 0) {
    unmarkedItemsStage1Base = stage1FinalBase;
    unmarkedHotelStage1Base = stage1HotelFinalBase;
  }

  const overallAgentMarkupAmount = validatedOverallMarginValue > 0
    ? (marginType === 'PERCENTAGE'
        ? roundCurrencyAmount(unmarkedItemsStage1Base * (validatedOverallMarginValue / 100), effectiveCurrency)
        : roundCurrencyAmount(validatedOverallMarginValue, effectiveCurrency))
    : 0;

  const markupAmount = roundCurrencyAmount(productLevelMarkupTotal + overallAgentMarkupAmount, effectiveCurrency);
  const discountAmount = stage1DiscountAmount;
  const finalCustomerSellingPrice = Math.max(stage1FinalBase, roundCurrencyAmount(stage1FinalBase + markupAmount, effectiveCurrency));

  const hotelOverallMarkupAmount = validatedOverallMarginValue > 0
    ? (marginType === 'PERCENTAGE'
        ? roundCurrencyAmount(unmarkedHotelStage1Base * (validatedOverallMarginValue / 100), effectiveCurrency)
        : (unmarkedItemsStage1Base > 0
            ? roundCurrencyAmount(overallAgentMarkupAmount * (unmarkedHotelStage1Base / unmarkedItemsStage1Base), effectiveCurrency)
            : (stage1FinalBase > 0
                ? roundCurrencyAmount(overallAgentMarkupAmount * (stage1HotelFinalBase / stage1FinalBase), effectiveCurrency)
                : 0)))
    : 0;

  const hotelMarkupAmount = roundCurrencyAmount(hotelProductLevelMarkupTotal + hotelOverallMarkupAmount, effectiveCurrency);
  let hotelTotalSellingPrice = Math.max(0, roundCurrencyAmount(stage1HotelFinalBase + hotelMarkupAmount, effectiveCurrency));
  let landPartTotalSellingPrice = Math.max(0, roundCurrencyAmount(finalCustomerSellingPrice - hotelTotalSellingPrice, effectiveCurrency));

  // If saved snapshot has explicit hotelAccommodationTotal / landPartTotal and total matches, honor them
  if (
    !Array.isArray(quoteOrItems) &&
    activePricingSnapshot &&
    currencyEngine.normalizeCurrencyCode(activePricingSnapshot.currency) === effectiveCurrency &&
    activePricingSnapshot.finalCustomerSellingPrice === finalCustomerSellingPrice
  ) {
    if (typeof activePricingSnapshot.hotelAccommodationTotal === 'number' && !isLandOnly) {
      hotelTotalSellingPrice = roundCurrencyAmount(activePricingSnapshot.hotelAccommodationTotal, effectiveCurrency);
    }
    if (typeof activePricingSnapshot.landPartTotal === 'number') {
      landPartTotalSellingPrice = roundCurrencyAmount(activePricingSnapshot.landPartTotal, effectiveCurrency);
    }
  }

  const hotelItemsIncludedCount = hotelItems.length + hubManualHotelsCount;
  const landItemsIncludedCount = landItems.length;

  // Fallback for legacy snapshot records that have no item-level breakdown at all
  if (activeItems.length === 0 && hubManualHotelsCount === 0 && !Array.isArray(quoteOrItems)) {
    const q = quoteOrItems as any;
    const activeOpt = q.options && q.options.length > 0
      ? (q.options.find((o: any) => o.id === (activeOptionIdOrMarginType || q.activeOptionId)) || q.options[0])
      : undefined;
    const fallbackLand = activeOpt?.landPartTotal ?? q.landPartTotal;
    const fallbackTotal = activeOpt?.totalSellingPrice || q.finalCustomerSellingPrice || q.totalSellingPrice || 0;
    if (typeof fallbackLand === 'number' && fallbackLand > 0) {
      landPartTotalSellingPrice = fallbackLand;
    } else if (fallbackTotal > 0 && hotelTotalSellingPrice === 0) {
      landPartTotalSellingPrice = fallbackTotal;
    }
  }

  const hasHotelAccommodation = hotelItemsIncludedCount > 0 && hotelTotalSellingPrice > 0;
  const hasLandServices = landPartTotalSellingPrice > 0 || landItemsIncludedCount > 0;

  return {
    baseSellingPrice: stage1FinalBase,
    baseTotalPrice: stage1FinalBase,
    theUnboundBaseSellingPrice: stage1FinalBase,
    preDiscountBaseSellingPrice,
    promotionDiscountAmount,
    discountedBaseSellingPrice: stage1FinalBase,
    appliedPromotion: resolvedAppliedPromotion,
    markupAmount,
    marginAmount: markupAmount,
    additionalAgentMarginAmount: markupAmount,
    productLevelAgentMarkupTotal: productLevelMarkupTotal,
    overallAgentMarkupAmount,
    discountAmount,
    finalCustomerSellingPrice,
    finalTotalSellingPrice: finalCustomerSellingPrice,
    totalSellingPrice: finalCustomerSellingPrice,
    totalNetCost,
    itemsIncludedCount: activeItems.length,
    hotelItemsIncludedCount,
    hotelTotalSellingPrice,
    hotelTotalNetCost,
    hasHotelAccommodation,
    landItemsIncludedCount,
    landBaseSellingPrice: stage1LandFinalBase,
    landPartTotalSellingPrice,
    landTotalNetCost,
    hasLandServices
  };
}

/**
 * Builds an immutable QuotationCurrencySnapshot capturing every line item's source currency,
 * target currency, applied exchange rate, rate direction, FX source, timestamp, converted amounts,
 * margin calculation details, and final quotation totals.
 */
export function buildQuotationCurrencySnapshot(params: {
  quoteId: string;
  quoteVersion: number;
  items: QuoteItem[];
  targetCurrency: CurrencyCode;
  scope?: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY';
  routeHubs?: TripRouteHub[];
  userRole?: UserRole;
  user?: any;
  companyId?: string;
  agencyName?: string;
  productLevelMarginEnabled?: boolean;
  customAgentMarginPercent?: number;
  adminMarginMode?: 'ADD' | 'REPLACE';
  adminManualMarginType?: 'PERCENTAGE' | 'FIXED';
  adminManualMarginValue?: number;
  overallDiscountPercent?: number;
  agentMarginType?: 'PERCENTAGE' | 'FIXED';
  agentMarginValue?: number;
  preserveHistoricalSnapshot?: boolean;
  existingSnapshot?: QuotationCurrencySnapshot;
  surchargeOverrides?: QuotationSurchargeOverride[];
  bookingDate?: string;
  appliedPromotion?: AppliedPromotionSnapshot | null;
  precomputedBreakdown?: QuoteInternalBreakdownResult;
}): QuotationCurrencySnapshot {
  const {
    quoteId,
    quoteVersion = 1,
    items = [],
    targetCurrency,
    scope = 'HOTEL_LAND',
    routeHubs = [],
    userRole,
    user,
    companyId,
    agencyName,
    productLevelMarginEnabled,
    customAgentMarginPercent,
    adminMarginMode = 'ADD',
    adminManualMarginType = 'PERCENTAGE',
    adminManualMarginValue = 0,
    overallDiscountPercent = 0,
    agentMarginType = 'PERCENTAGE',
    agentMarginValue = 0,
    preserveHistoricalSnapshot = false,
    existingSnapshot,
    surchargeOverrides,
    bookingDate,
    appliedPromotion,
    precomputedBreakdown
  } = params;

  const breakdown = (precomputedBreakdown && precomputedBreakdown.currency === targetCurrency)
    ? precomputedBreakdown
    : calculateQuoteInternalBreakdown({
        items: items as any,
        targetCurrency,
        scope,
        routeHubs,
        userRole,
        user,
        companyId,
        agencyName,
        productLevelMarginEnabled,
        customAgentMarginPercent,
        adminMarginMode,
        adminManualMarginType,
        adminManualMarginValue,
        overallDiscountPercent,
        agentMarginType,
        agentMarginValue,
        preserveHistoricalSnapshot,
        historicalSnapshot: existingSnapshot,
        surchargeOverrides,
        bookingDate,
        appliedPromotion: appliedPromotion || null
      });

  const fxStatus = currencyEngine.getStatus();
  const capturedAt = new Date().toISOString();
  const precision = (targetCurrency === 'JPY' || targetCurrency === 'THB') ? 0 : 2;
  const roundingMode = precision === 0 ? 'ZERO_DECIMAL_INTEGER' : 'TWO_DECIMAL_STANDARD';

  const lineItems: CurrencyConversionLineRecord[] = breakdown.itemizedBreakdown
    .filter(ib => !ib.isExcludedNoAccommodation)
    .map(ib => {
      const matchedItem = items.find(i => i.id === ib.itemId);
      const catLower = (ib.category || matchedItem?.product?.category || '').toLowerCase();
      const isHotel = Boolean(
        catLower.includes('hotel') ||
        catLower.includes('accommodation') ||
        catLower.includes('resort') ||
        catLower.includes('ryokan') ||
        matchedItem?.isManualHotel ||
        matchedItem?.manualHotelDetails ||
        matchedItem?.hotelId
      );
      const existingLine = preserveHistoricalSnapshot && existingSnapshot?.targetCurrency === targetCurrency
        ? existingSnapshot.lineItems.find(l => l.itemId === ib.itemId)
        : undefined;
      const fxMeta = currencyEngine.convertWithMetadata(
        ib.nativeNetCost,
        ib.nativeCurrency,
        targetCurrency,
        existingLine?.appliedExchangeRate
      );
      const baseMarginPercent = ib.convertedNetCost > 0
        ? Number(((ib.markupAmount / ib.convertedNetCost) * 100).toFixed(4))
        : 0;

      return {
        itemId: ib.itemId,
        productId: matchedItem?.product?.id || ib.itemId,
        productName: ib.productName,
        category: ib.category,
        isHotel,
        originalAmount: ib.nativeNetCost,
        originalNetCost: ib.nativeNetCost,
        originalCurrency: ib.nativeCurrency,
        sourceCurrency: ib.nativeCurrency,
        targetCurrency,
        appliedExchangeRate: fxMeta.exchangeRate,
        exchangeRate: fxMeta.exchangeRate,
        rateDirection: fxMeta.rateDirection,
        fxSource: fxMeta.fxSource || fxStatus.provider,
        rateTimestamp: fxMeta.conversionTimestamp || fxStatus.lastFetchedAt,
        rateVersion: fxMeta.rateVersion,
        convertedNetCost: ib.convertedNetCost,
        convertedBaseSellingAmount: ib.finalSellingPrice,
        baseMarginPercent,
        baseMarginAmount: ib.markupAmount,
        taxAmount: ib.taxAmount,
        serviceFeeAmount: ib.serviceFee,
        surchargeTotal: ib.surchargeTotal || 0,
        appliedSurcharges: ib.appliedSurcharges || [],
        discountAmount: 0,
        finalLineSellingAmount: ib.finalSellingPrice,
        isValidRate: ib.hasValidRate && fxMeta.isValid,
        rateError: ib.incompleteReason || fxMeta.error
      };
    });

  const existingBaseMarginAmount = breakdown.existingMarginAmount || breakdown.underlyingMarginAmount || 0;
  const manualMarginAdjustmentAmount = breakdown.adminManualMarginAmount || 0;
  const surchargesTotal = breakdown.surchargesTotal || 0;
  const hotelAccommodationTotal = breakdown.hotelAccommodationTotal ?? 0;
  const landPartTotal = breakdown.landPartTotal ?? breakdown.finalPackagePrice;
  const finalCustomerSellingPrice = breakdown.finalPackagePrice;

  const normalizedAdminMode: 'ADD' | 'REPLACE' = adminMarginMode === 'REPLACE' ? 'REPLACE' : 'ADD';
  const normalizedAdminType: 'PERCENTAGE' | 'FIXED' = adminManualMarginType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
  const sanitizedAdminMarginValue = validateAdminManualMargin(adminManualMarginValue, normalizedAdminType).sanitizedValue;

  return {
    snapshotId: `fx-snap-${quoteId}-v${quoteVersion}-${Date.now()}`,
    quoteId,
    quoteVersion,
    targetCurrency,
    currencyPrecision: precision,
    roundingMode,
    fxSource: fxStatus.provider,
    capturedAt,
    activeMarginMode: breakdown.activeMarginMode,
    productLevelMarginEnabled: breakdown.productLevelMarginEnabled,
    agentLevelMarginPercent: breakdown.configuredAgentLevelMarginPercent,
    lineItems,
    totals: {
      convertedTotalNetCost: breakdown.totalNettCost,
      baseMarginTotal: existingBaseMarginAmount,
      manualMarginAdjustmentMode: normalizedAdminMode,
      manualMarginAdjustmentType: normalizedAdminType,
      manualMarginAdjustmentValue: sanitizedAdminMarginValue,
      manualMarginAdjustmentAmount,
      effectiveUnderlyingMarginAmount:
        normalizedAdminMode === 'REPLACE'
          ? manualMarginAdjustmentAmount
          : roundCurrencyAmount(existingBaseMarginAmount + manualMarginAdjustmentAmount, targetCurrency),
      taxesTotal: breakdown.taxAmount,
      serviceFeesTotal: breakdown.serviceFee,
      surchargesTotal,
      discountsTotal: breakdown.discountAmount,
      b2bSellingPriceTotal: breakdown.baseSellingPrice,
      theUnboundBaseSellingPrice: breakdown.theUnboundBaseSellingPrice ?? breakdown.baseSellingPrice,
      ...(breakdown.appliedPromotion
        ? {
            preDiscountBaseSellingPrice: breakdown.preDiscountBaseSellingPrice,
            promotionDiscountAmount: breakdown.promotionDiscountAmount || 0,
            discountedBaseSellingPrice: breakdown.discountedBaseSellingPrice ?? breakdown.baseSellingPrice,
            appliedPromotion: breakdown.appliedPromotion
          }
        : {}),
      additionalAgentMarginType: agentMarginType,
      additionalAgentMarginValue: agentMarginValue,
      additionalAgentMarginAmount: breakdown.partnerMarginAmount,
      productLevelAgentMarkupTotal: breakdown.productLevelAgentMarkupTotal ?? 0,
      overallAgentMarkupAmount: breakdown.overallAgentMarkupAmount ?? breakdown.partnerMarginAmount,
      hotelAccommodationTotal,
      landPartTotal,
      finalCustomerSellingPrice
    },
    totalConvertedNettCost: breakdown.totalNettCost,
    existingBaseMarginAmount,
    manualMarginAdjustmentAmount,
    manualMarginAdjustedTotal: breakdown.baseSellingPrice,
    theUnboundBaseSellingPrice: breakdown.theUnboundBaseSellingPrice ?? breakdown.baseSellingPrice,
    additionalAgentMarginAmount: breakdown.partnerMarginAmount,
    productLevelAgentMarkupTotal: breakdown.productLevelAgentMarkupTotal ?? 0,
    overallAgentMarkupAmount: breakdown.overallAgentMarkupAmount ?? breakdown.partnerMarginAmount,
    taxAmount: breakdown.taxAmount,
    surchargesTotal,
    appliedSurcharges: breakdown.appliedSurcharges || [],
    surchargeOverrides: surchargeOverrides || [],
    hotelAccommodationTotal,
    landPartTotal,
    finalCustomerSellingPrice,
    isValid: breakdown.isComplete && (breakdown.missingCurrencyPairs?.length || 0) === 0,
    missingCurrencyPairs: breakdown.missingCurrencyPairs || []
  };
}


