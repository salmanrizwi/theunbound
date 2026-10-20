import { CurrencyCode, PricingCalculationRequest, PricingCalculationResult, AgentPricingResponse, Product, User, UserRole, HotelRate, B2BPackage, FXRateDetails, TieredPrice, InventoryValidity, InventorySurcharge, AppliedSurchargeDetail, SurchargeOverlapWarning, InventoryValidityEvaluation, SurchargeApplicationBasis, TripRouteHub, Quotation, QuoteItem } from '../types';
import { currencyEngine, convertCurrency as engineConvert, formatCurrency as engineFormat, getExchangeRateInfo, BASELINE_USD_RATES } from './currencyEngine';
import { AppDatabase } from './db';
import { hotelToProduct } from '../utils/hotelHelpers';
import { sanitizePricingResultForAgent } from '../utils/customerQuoteSanitizer';
import { RailPricingEngine } from './railPricingEngine';
import { resolveRailRateNettPrice } from '../types/rail';

// Standardized exchange rate base: 1 USD
export const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  ...BASELINE_USD_RATES
};

export function convertCurrency(amount: number, from: CurrencyCode | any, to: CurrencyCode | any): number {
  const fromCode: CurrencyCode = (typeof from === 'object' && from !== null) ? (from.code || 'USD') : (from || 'USD');
  const toCode: CurrencyCode = (typeof to === 'object' && to !== null) ? (to.code || 'USD') : (to || 'USD');
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
    ''
  ).trim();
  const validTo = (
    entity.validity?.validTo ||
    entity.validityTo ||
    entity.effectiveTo ||
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
  const list = input.surcharges || [];
  const activeSurcharges = list.filter(s => s && s.status === 'ACTIVE');

  if (activeSurcharges.length === 0) {
    return {
      appliedSurcharges: [],
      totalSurchargeNative: 0,
      totalSurchargeConverted: 0,
      missingServiceDate: false
    };
  }

  const rawDate = input.serviceDate?.trim();
  if (!rawDate || !isValidIsoDateString(rawDate)) {
    return {
      appliedSurcharges: [],
      totalSurchargeNative: 0,
      totalSurchargeConverted: 0,
      missingServiceDate: true,
      validationMessage: 'A valid service/travel date is required to evaluate date-based surcharges.'
    };
  }

  const spanDays =
    input.nights && input.nights > 1
      ? input.nights
      : input.coverageDays && input.coverageDays > 1
        ? input.coverageDays
        : 1;

  const serviceDates = buildServiceDateList(rawDate, spanDays);
  const appliedIds = new Set<string>();
  const appliedSurcharges: AppliedSurchargeDetail[] = [];

  const adults = Math.max(1, input.adults || 1);
  const children = Math.max(0, input.children || 0);
  const chargeablePax = adults + children;
  const qty = Math.max(1, input.quantity || 1);
  const roomsCount = Math.max(1, input.roomsCount || 1);
  const vehiclesCount = Math.max(1, input.vehiclesCount || qty);
  const hoursCount = Math.max(1, input.hoursCount || 1);
  const devicesCount = Math.max(1, input.devicesCount || adults);
  const baseNative = Math.max(0, input.baseNativeAmount || 0);

  for (const s of activeSurcharges) {
    if (!s.surchargeId || appliedIds.has(s.surchargeId)) continue;
    if (!isValidIsoDateString(s.validFrom) || !isValidIsoDateString(s.validTo)) continue;
    if (s.validTo < s.validFrom) continue;
    if (typeof s.value !== 'number' || isNaN(s.value) || s.value < 0) continue;

    const eligibleDaysCount = serviceDates.filter(d => d >= s.validFrom && d <= s.validTo).length;
    if (eligibleDaysCount === 0) continue;

    appliedIds.add(s.surchargeId);

    const basis = (s.applicationBasis || input.defaultApplicationBasis || 'PER_PERSON').toUpperCase();
    let appliedAmountNative = 0;

    if (s.type === 'PERCENTAGE') {
      if (spanDays > 1 && (basis === 'PER_ROOM_NIGHT' || basis === 'PER_NIGHT' || basis === 'PER_DAY')) {
        const eligibleBasePortion = baseNative * (eligibleDaysCount / spanDays);
        appliedAmountNative = eligibleBasePortion * (s.value / 100);
      } else {
        appliedAmountNative = baseNative * (s.value / 100);
      }
    } else {
      const surchargeCurrency = (s.currency || input.nativeCurrency || 'USD') as CurrencyCode;
      const unitFixedInNative =
        surchargeCurrency !== input.nativeCurrency
          ? convertCurrency(s.value, surchargeCurrency, input.nativeCurrency)
          : s.value;

      switch (basis) {
        case 'PER_PERSON':
          appliedAmountNative = unitFixedInNative * chargeablePax * qty;
          break;
        case 'PER_ADULT':
          appliedAmountNative = unitFixedInNative * adults * qty;
          break;
        case 'PER_ROOM_NIGHT':
          appliedAmountNative = unitFixedInNative * roomsCount * eligibleDaysCount;
          break;
        case 'PER_NIGHT':
          appliedAmountNative = unitFixedInNative * eligibleDaysCount * qty;
          break;
        case 'PER_DAY':
          appliedAmountNative = unitFixedInNative * eligibleDaysCount * chargeablePax;
          break;
        case 'PER_VEHICLE':
          appliedAmountNative = unitFixedInNative * vehiclesCount;
          break;
        case 'PER_HOUR':
          appliedAmountNative = unitFixedInNative * hoursCount * qty;
          break;
        case 'PER_DEVICE':
          appliedAmountNative = unitFixedInNative * devicesCount;
          break;
        case 'PER_SERVICE':
        case 'PER_BOOKING':
        default:
          appliedAmountNative = unitFixedInNative * qty;
          break;
      }
    }

    appliedAmountNative = Math.round(appliedAmountNative * 100) / 100;
    const appliedAmountConverted =
      input.targetCurrency !== input.nativeCurrency
        ? convertCurrency(appliedAmountNative, input.nativeCurrency, input.targetCurrency)
        : appliedAmountNative;

    appliedSurcharges.push({
      surchargeId: s.surchargeId,
      name: s.name,
      validFrom: s.validFrom,
      validTo: s.validTo,
      type: s.type,
      value: s.value,
      currency: ((s.currency as CurrencyCode) || input.nativeCurrency),
      applicationBasis: basis,
      appliedAmountNative,
      appliedAmountConverted: Math.round(appliedAmountConverted * 100) / 100,
      eligibleDaysCount
    });
  }

  const totalSurchargeNative =
    Math.round(appliedSurcharges.reduce((sum, item) => sum + item.appliedAmountNative, 0) * 100) / 100;
  const totalSurchargeConverted =
    input.targetCurrency !== input.nativeCurrency
      ? Math.round(convertCurrency(totalSurchargeNative, input.nativeCurrency, input.targetCurrency) * 100) / 100
      : totalSurchargeNative;

  return {
    appliedSurcharges,
    totalSurchargeNative,
    totalSurchargeConverted,
    missingServiceDate: false
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

      const marginPct = matched.marginValue !== undefined 
        ? matched.marginValue 
        : (product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 20);
      
      const taxPct = matched.taxValue !== undefined 
        ? matched.taxValue 
        : (product.taxPercent ?? 10);
      
      const feePct = matched.serviceChargeValue !== undefined 
        ? matched.serviceChargeValue 
        : (product.serviceFeeFixed ?? 0);

      const b2bCalc = calculateB2BAgentPrice({
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

  const marginPct = product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 20;
  const taxPct = product.taxPercent ?? 10;
  const feePct = product.serviceFeeFixed ?? 0;

  const b2bCalc = calculateB2BAgentPrice({
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

/**
 * Calculates the exact Delivered Selling Price for a product based on:
 * Single commercial customer price: B2B Agent Price
 */
export function calculateDeliveredPriceForUser(
  product: Product,
  user: User | null,
  targetCurrency: CurrencyCode = 'USD'
): DeliveredPriceInfo {
  const role: UserRole = user?.role || 'B2B_AGENT';
  const isAdmin = role === 'ADMIN' || role === 'TEAM_MEMBER' || role === 'DMC_STAFF';
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
      baseAdultNet: railRes.adultPerPaxSupplierJPY,
      baseChildNet: railRes.childPerPaxSupplierJPY,
      baseInfantNet: 0,
      appliedMarkupPercent: railRes.appliedMarkupPercent,
      userTier,
      isCustomMargin: false,
      currency: targetCurrency
    };
  }

  let appliedMarkupPercent = product.b2bAgentMarkupPercent !== undefined 
    ? product.b2bAgentMarkupPercent 
    : (product.defaultMarkupPercent !== undefined ? product.defaultMarkupPercent : 20);
  let isCustomMargin = false;

  if (user?.customAgentMarginPercent !== undefined) {
    appliedMarkupPercent = user.customAgentMarginPercent;
    isCustomMargin = true;
  }

  const isCapacity = isCapacityBasedProduct(product);
  const baseAdultNet = product.adultNetPrice ?? product.adultNettCost ?? 0;
  const baseChildNet = product.childNetPrice ?? product.childNettCost ?? (baseAdultNet * 0.5);
  const baseInfantNet = product.infantNetPrice ?? product.infantNettCost ?? 0;

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

    const tierMargin = (firstTier as any)?.b2bMargin ?? firstTier?.marginValue ?? appliedMarkupPercent;
    const tierTax = firstTier?.taxValue ?? product.taxPercent ?? 10;
    const tierSvcValue = firstTier?.serviceChargeValue ?? (product as any).serviceFeePercent ?? (product as any).serviceFeeFixed ?? 0;
    const tierSvcType = firstTier?.serviceChargeType ?? ((product as any).serviceFeePercent !== undefined ? 'PERCENTAGE' : 'FIXED');

    const unifiedRes = calculateUnifiedPrice({
      nettPrice: vehicleCost,
      quantity: 1,
      marginType: firstTier?.marginType || 'PERCENTAGE',
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
      baseAdultNet: vehicleCost,
      baseChildNet: 0,
      baseInfantNet: 0,
      appliedMarkupPercent: tierMargin,
      userTier,
      isCustomMargin,
      currency: targetCurrency,
      isCapacityBased: true,
      totalVehicleSellingPrice,
      perPersonStartingFrom,
      vehicleCapacity: startingCapacity,
      vehicleModel,
      unitVehicleNetCost: vehicleCost
    };
  }

  const rawSellingInBase = calculateSellingPrice(
    baseAdultNet,
    appliedMarkupPercent,
    product.taxPercent ?? 10,
    product.serviceFeeFixed ?? 0
  );

  const deliveredPrice = convertCurrency(rawSellingInBase, product.currency, targetCurrency);

  return {
    deliveredPrice,
    totalSellingPrice: deliveredPrice,
    rawPriceInBaseCurrency: rawSellingInBase,
    baseAdultNet,
    baseChildNet,
    baseInfantNet,
    appliedMarkupPercent,
    userTier,
    isCustomMargin,
    currency: targetCurrency,
    isCapacityBased: false
  };
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
  const userRole = request.userRole || user?.role || 'BUYER';
  const isAgent = userRole === 'B2B_AGENT' || userRole === 'AGENT' || request.pricingTier === 'B2B';
  const pricingTier: 'B2C' | 'B2B' = isAgent ? 'B2B' : 'B2C';

  const adults = Math.max(1, request.adults || 1);
  const children = Math.max(0, request.children || 0);
  const infants = Math.max(0, request.infants || 0);
  const totalPax = adults + children + infants;
  const quantity = Math.max(1, request.quantity || 1);
  const explicitServiceDate = request.travelDate && request.travelDate.trim() ? request.travelDate.trim() : undefined;
  const travelDate = explicitServiceDate || new Date().toISOString().split('T')[0];

  // Authoritative Validity Evaluation
  const validityCheck = evaluateInventoryValidity(product, explicitServiceDate);

  // 1. Authoritative Rate Sheet & Database Lookup
  // Check if database contains an active, valid rate for this product / travel date
  let baseAdultNet = product.adultNetPrice ?? product.adultNettCost ?? (product as any).basePrice ?? 0;
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
    const productRates = db.getProductRates();
    const matchingRates = productRates.filter(r => 
      (r.productId === product.id || r.productId === product.sku) && 
      (r.status === 'ACTIVE' || !r.status)
    );

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
    if (!fixedStayBase && (product as any).manualHotelDetails) {
      const m = (product as any).manualHotelDetails;
      const mNights = Math.max(1, Number(m.numberOfNights ?? m.nights ?? 1));
      const mRooms = Math.max(1, Number(m.numberOfRooms ?? m.rooms ?? 1));
      const mRate = Number(m.ratePerNight ?? m.customRate ?? 0);
      const mBasis = m.rateBasis || m.rateType || 'PER_ROOM_PER_NIGHT';
      if (mBasis === 'TOTAL_STAY') {
        fixedStayBase = mRate;
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

  // Configurable Commercial Rates with User-Type Hierarchy & Rate Sheet Overrides:
  let configuredMarkupPercent = 20;
  if (isFixedStayHotel && request.customMarkupPercent === undefined) {
    configuredMarkupPercent = product.b2bAgentMarkupPercent ?? product.defaultMarkupPercent ?? 0;
  } else if (request.customMarkupPercent !== undefined) {
    configuredMarkupPercent = request.customMarkupPercent;
  } else if (pricingTier === 'B2B') {
    // SECTION 5: BUYER MARGIN MUST NOT BE USED for B2B. Use B2B Agent Margin only.
    if (user?.customAgentMarginPercent !== undefined) {
      configuredMarkupPercent = user.customAgentMarginPercent;
    } else if (rateMarkupAgent !== undefined) {
      configuredMarkupPercent = rateMarkupAgent;
    } else if (isCapacity && matchingTierFound && (matchingTierFound as any).b2bMargin !== undefined) {
      configuredMarkupPercent = (matchingTierFound as any).b2bMargin;
    } else if (isCapacity && matchingTierFound && matchingTierFound.marginValue !== undefined) {
      configuredMarkupPercent = matchingTierFound.marginValue;
    } else if (product.b2bAgentMarkupPercent !== undefined) {
      configuredMarkupPercent = product.b2bAgentMarkupPercent;
    } else {
      configuredMarkupPercent = 20;
    }
  } else {
    // Buyer tier (B2C)
    if (user?.customBuyerMarginPercent !== undefined) {
      configuredMarkupPercent = user.customBuyerMarginPercent;
    } else if (rateMarkupBuyer !== undefined) {
      configuredMarkupPercent = rateMarkupBuyer;
    } else if (isCapacity && matchingTierFound && (matchingTierFound as any).buyerMargin !== undefined) {
      configuredMarkupPercent = (matchingTierFound as any).buyerMargin;
    } else if (isCapacity && matchingTierFound && matchingTierFound.marginValue !== undefined) {
      configuredMarkupPercent = matchingTierFound.marginValue;
    } else if (product.buyerMarkupPercent !== undefined) {
      configuredMarkupPercent = product.buyerMarkupPercent;
    } else {
      configuredMarkupPercent = product.defaultMarkupPercent ?? 30;
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

  // Support for configured fixed margin amounts (Section 23)
  if (isCapacity && matchingTierFound && matchingTierFound.marginType === 'FIXED' && matchingTierFound.marginValue !== undefined) {
    nativeMarkupAmount = matchingTierFound.marginValue * quantity;
    markupRate = nativeTotalNetCost > 0 ? nativeMarkupAmount / nativeTotalNetCost : 0;
  } else if ((product as any).marginType === 'FIXED' && (product as any).marginFixed !== undefined) {
    nativeMarkupAmount = Number((product as any).marginFixed) * (isCapacity ? 1 : totalPax);
    markupRate = nativeTotalNetCost > 0 ? nativeMarkupAmount / nativeTotalNetCost : 0;
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
  } else if ((product as any).serviceFeeFixed !== undefined) {
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

  // Date-Based Surcharge Evaluation in Native Currency BEFORE FX Conversion
  // Flow: Native Price -> Applicable Surcharge Evaluation -> Updated Price -> Currency Conversion
  const defaultBasis: SurchargeApplicationBasis = isFixedStayHotel
    ? 'PER_ROOM_NIGHT'
    : isCapacity
      ? 'PER_VEHICLE'
      : ((product.category as string) === 'Guides' || (product.category as string) === 'Guide' || product.pricingMethod === 'hourly_based')
        ? 'PER_HOUR'
        : 'PER_PERSON';

  const surchargeEvaluation = evaluateApplicableSurcharges({
    surcharges: product.surcharges,
    serviceDate: explicitServiceDate,
    nights: (product as any).nights || (request as any).nights,
    coverageDays: (request as any).coverageDays || (product as any).coverageDays,
    baseNativeAmount: baseNativeSellingPriceBeforeSurcharges,
    nativeCurrency,
    targetCurrency,
    adults,
    children,
    infants,
    roomsCount: (product as any).roomsCount || (request as any).roomsCount || 1,
    vehiclesCount: vehicleDetails?.vehiclesAllocated || quantity,
    hoursCount: (request as any).serviceDurationHours || (request as any).hours || (product as any).minHours || 1,
    devicesCount: (request as any).devicesCount || adults,
    quantity,
    defaultApplicationBasis: defaultBasis
  });

  nativeFinalSellingPrice = Math.round((baseNativeSellingPriceBeforeSurcharges + surchargeEvaluation.totalSurchargeNative) * 100) / 100;

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

  // 2. CONVERT ONLY AT THE DELIVERED LEVEL (or convert itemized values using exact authoritative FX rate)
  const fxDetails: FXRateDetails = currencyEngine.getRateInfo(nativeCurrency, targetCurrency);

  const baseSellingPriceBeforeSurcharges = isConverted
    ? currencyEngine.convert(baseNativeSellingPriceBeforeSurcharges, nativeCurrency, targetCurrency)
    : baseNativeSellingPriceBeforeSurcharges;
  const finalTotalSellingPrice = isConverted ? currencyEngine.convert(nativeFinalSellingPrice, nativeCurrency, targetCurrency) : nativeFinalSellingPrice;
  const totalNetCost = isConverted ? currencyEngine.convert(nativeTotalNetCost, nativeCurrency, targetCurrency) : nativeTotalNetCost;
  const markupAmount = isConverted ? currencyEngine.convert(nativeMarkupAmount, nativeCurrency, targetCurrency) : nativeMarkupAmount;
  const taxAmount = isConverted ? currencyEngine.convert(nativeTaxAmount, nativeCurrency, targetCurrency) : nativeTaxAmount;
  const serviceFee = isConverted ? currencyEngine.convert(nativeServiceFee, nativeCurrency, targetCurrency) : nativeServiceFee;
  const discountAmount = isConverted ? currencyEngine.convert(nativeDiscountAmount, nativeCurrency, targetCurrency) : nativeDiscountAmount;
  const commissionAmount = isConverted ? currencyEngine.convert(nativeCommissionAmount, nativeCurrency, targetCurrency) : nativeCommissionAmount;
  const grossBeforeTax = isConverted ? currencyEngine.convert(nativeGrossBeforeTax, nativeCurrency, targetCurrency) : nativeGrossBeforeTax;
  const pricePerPerson = totalPax > 0 ? finalTotalSellingPrice / totalPax : finalTotalSellingPrice;

  const b2bWholesaleNetToAgent = isConverted ? currencyEngine.convert(nativeB2bWholesaleNetToAgent, nativeCurrency, targetCurrency) : nativeB2bWholesaleNetToAgent;
  const agentProfitAmount = isConverted ? currencyEngine.convert(nativeAgentProfitAmount, nativeCurrency, targetCurrency) : nativeAgentProfitAmount;

  // Converted Net Subtotals for line-item reporting
  const adultsSubtotalNet = isConverted ? currencyEngine.convert(adultNetInNative, nativeCurrency, targetCurrency) : adultNetInNative;
  const childrenSubtotalNet = isConverted ? currencyEngine.convert(childNetInNative, nativeCurrency, targetCurrency) : childNetInNative;
  const infantsSubtotalNet = isConverted ? currencyEngine.convert(infantNetInNative, nativeCurrency, targetCurrency) : infantNetInNative;
  const addonsSubtotalNet = isConverted ? currencyEngine.convert(addonsNetInNative, nativeCurrency, targetCurrency) : addonsNetInNative;

  // Update vehicle details with converted currency costs if applicable
  if (vehicleDetails) {
    vehicleDetails.unitVehicleNetCost = isConverted ? currencyEngine.convert(vehicleDetails.unitVehicleNetCost, nativeCurrency, targetCurrency) : vehicleDetails.unitVehicleNetCost;
    vehicleDetails.totalVehicleNetCost = isConverted ? currencyEngine.convert(vehicleDetails.totalVehicleNetCost, nativeCurrency, targetCurrency) : vehicleDetails.totalVehicleNetCost;
    vehicleDetails.perPersonNetCost = totalPax > 0 ? vehicleDetails.totalVehicleNetCost / totalPax : vehicleDetails.totalVehicleNetCost;
  }

  const dmcMarginAmount = markupAmount + serviceFee - discountAmount;
  const dmcMarginPercent = totalNetCost > 0 ? (dmcMarginAmount / totalNetCost) * 100 : 0;

  // Proportional breakdown of selling price
  const sellingMultiplier = totalNetCost > 0 ? finalTotalSellingPrice / totalNetCost : 1;
  const adultsSubtotalSelling = isCapacity ? finalTotalSellingPrice : (adultsSubtotalNet * sellingMultiplier);
  const childrenSubtotalSelling = isCapacity ? 0 : (childrenSubtotalNet * sellingMultiplier);
  const infantsSubtotalSelling = isCapacity ? 0 : (infantsSubtotalNet * sellingMultiplier);
  const addonsSubtotalSelling = addonsSubtotalNet * sellingMultiplier;
  const adultPricePerPax = adults > 0 ? (isCapacity ? pricePerPerson : (adultsSubtotalSelling / adults)) : 0;
  const childPricePerPax = children > 0 ? (isCapacity ? pricePerPerson : (childrenSubtotalSelling / children)) : 0;

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
    b2bWholesaleMarkupRate,
    b2bWholesaleNetToAgent,
    agentClientMarkupRate,
    agentProfitAmount,
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

    // Validity & Surcharge Evaluation Snapshot
    validityCheck,
    appliedSurcharges: surchargeEvaluation.appliedSurcharges,
    surchargeTotalNative: surchargeEvaluation.totalSurchargeNative,
    surchargeTotal: surchargeEvaluation.totalSurchargeConverted,
    baseSellingPriceBeforeSurcharges,
    surchargeValidationMessage: surchargeEvaluation.validationMessage
  };
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
    markupAmount: number;
    effectiveMarkupPercent: number;
    pricingMode: string;
    itemsCount: number;
  };
}

export function calculatePackagePrice(request: PackagePricingRequest): PackagePricingResult {
  const db = AppDatabase.getInstance();
  const pkg: B2BPackage | undefined = request.packageItem || (request.packageId ? db.getPackages().find(p => p.id === request.packageId || p.slug === request.packageId) : undefined);

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

  const userRole = request.userRole || request.user?.role || 'BUYER';
  const isAgent = userRole === 'B2B_AGENT' || userRole === 'AGENT' || request.pricingTier === 'B2B';
  const isAdminOrStaff = userRole === 'ADMIN' || userRole === 'DMC_STAFF';

  // 1. Base component cost determination:
  let evaluatedNetCostUSD = pkg.baseNetCostUSD || 2500;
  let itemsCount = 0;

  if (pkg.pricingConfiguration?.pricingMode === 'LIVE') {
    let dynamicSum = 0;
    const allProducts = db.getProducts();
    if (pkg.productIds && pkg.productIds.length > 0) {
      pkg.productIds.forEach(pid => {
        const prod = allProducts.find(p => p.id === pid);
        if (prod) {
          dynamicSum += convertCurrency(prod.adultNetPrice, prod.currency || 'USD', 'USD');
          itemsCount++;
        }
      });
    }

    const allHotels = db.getHotels();
    if (pkg.hotelsSummary && pkg.hotelsSummary.length > 0) {
      pkg.hotelsSummary.forEach(hs => {
        const htl = allHotels.find(h => (h.id && h.id === hs.hotelId) || ((h.name || '').toLowerCase() === (hs.name || '').toLowerCase()));
        const nightRate = htl?.startingNetPrice || 350;
        dynamicSum += (nightRate * (hs.nights || 1));
        itemsCount++;
      });
    }

    if (dynamicSum > 0) {
      evaluatedNetCostUSD = dynamicSum;
    }
  }

  // 2. Markup determination:
  let markupPercent = 25;
  if (isAgent) {
    markupPercent = pkg.pricingConfiguration?.b2bMarkupPercent ?? 12;
    if (request.agentClientMarkupPercent) {
      markupPercent += request.agentClientMarkupPercent;
    }
  } else {
    markupPercent = pkg.pricingConfiguration?.buyerMarkupPercent ?? 25;
  }

  if (request.customMarkupPercent !== undefined) {
    markupPercent = request.customMarkupPercent;
  }

  // 3. Authoritative per person price:
  let perPersonUSD = 0;
  if (!isAgent && (pkg.finalSellingPriceUSD || pkg.suggestedSellingPriceUSD) && pkg.pricingConfiguration?.pricingMode !== 'LIVE') {
    perPersonUSD = pkg.finalSellingPriceUSD || pkg.suggestedSellingPriceUSD || Math.round(evaluatedNetCostUSD * 1.25);
  } else {
    perPersonUSD = Math.round(evaluatedNetCostUSD * (1 + markupPercent / 100));
  }

  if (request.customDiscountPercent) {
    perPersonUSD = Math.round(perPersonUSD * (1 - request.customDiscountPercent / 100));
  }

  // Convert to target currency
  const pricePerPerson = convertCurrency(perPersonUSD, 'USD', targetCurrency);
  const childPricePerPerson = Math.round(pricePerPerson * 0.75);
  const finalSellingPrice = (adults * pricePerPerson) + (children * childPricePerPerson);

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
    rateVersion: pkg.pricingConfiguration?.pricingMode === 'LIVE' ? 'LIVE-V1' : 'FIXED-V1'
  };

  // Only expose internal breakdown for ADMIN or DMC_STAFF
  if (isAdminOrStaff) {
    const totalNetCostTarget = convertCurrency(evaluatedNetCostUSD, 'USD', targetCurrency);
    const markupAmount = finalSellingPrice - (totalNetCostTarget * adults + totalNetCostTarget * 0.75 * children);
    result.internalAudit = {
      totalNetCostUSD: evaluatedNetCostUSD,
      totalNetCostTarget,
      markupAmount,
      effectiveMarkupPercent: markupPercent,
      pricingMode: pkg.pricingConfiguration?.pricingMode || 'FIXED',
      itemsCount
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
  finalSellingPrice: number;
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
  scope?: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY';
  routeHubs?: TripRouteHub[];
  adminManualMarginType?: 'PERCENTAGE' | 'FIXED';
  adminManualMarginValue?: number;
  adminMarginMode?: 'REPLACE' | 'ADD';
}

export interface QuoteInternalBreakdownResult {
  isComplete: boolean;
  incompleteWarnings: Array<{
    itemId: string;
    productName: string;
    category?: string;
    reason: string;
  }>;
  totalNettCost: number;          // Combined underlying nett cost before margin, taxes, service fees
  totalMargin: number;            // Applicable authorized margin amount (underlying markups + partner margin - discounts)
  underlyingMarginAmount: number; // Underlying inventory markup
  partnerMarginAmount: number;    // Additional partner margin
  taxAmount: number;              // Applicable tax calculated according to existing pricing rules
  serviceFee: number;             // Applicable service fee calculated according to existing pricing rules
  baseSellingPrice: number;       // Base selling price before partner margin
  discountAmount: number;         // Overall package discount amount
  finalPackagePrice: number;      // Customer-facing total produced by existing Pricing Engine
  currency: CurrencyCode;
  itemizedBreakdown: InternalBreakdownItemResult[];
  adminManualMarginAmount?: number;
  existingMarginAmount?: number;
  revisedSellingPrice?: number;
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
    agentMarginValue = 10,
    overallDiscountPercent = 0,
    scope,
    routeHubs = []
  } = params;

  const isLandOnlyQuote = scope === 'LAND_ONLY';
  const noAccommodationHubIds = new Set(
    routeHubs
      .filter(h => isLandOnlyQuote || h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none')
      .map(h => h.id)
  );
  const noAccommodationHubNames = new Set(
    routeHubs
      .filter(h => isLandOnlyQuote || h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none')
      .map(h => (h.hubName || '').toLowerCase())
      .filter(Boolean)
  );

  const incompleteWarnings: QuoteInternalBreakdownResult['incompleteWarnings'] = [];
  const itemizedBreakdown: InternalBreakdownItemResult[] = [];
  const processedItemIds = new Set<string>();

  let accumulatedNetCost = 0;
  let accumulatedUnderlyingMarkup = 0;
  let accumulatedTax = 0;
  let accumulatedServiceFee = 0;
  let accumulatedSellingPrice = 0;
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
    const itemHubId = item.hubId || item.manualHotelDetails?.hubId || (item as any).metadata?.hubId;
    const itemCity = (item.manualHotelDetails?.city || item.product?.city || '').toLowerCase();
    const isExcludedByHubScope = isHotelItem && (
      isLandOnlyQuote ||
      (itemHubId ? noAccommodationHubIds.has(itemHubId) : (itemCity ? noAccommodationHubNames.has(itemCity) : false))
    );

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

    // 2. Manual Hotel Accommodation
    const isManualHotel = Boolean(
      item.isManualHotel ||
      item.product?.isManualHotel ||
      item.product?.sku?.startsWith('MAN-HTL-') ||
      item.product?.accommodationType === 'manual' ||
      (item as any).accommodationType === 'manual' ||
      (item as any).accommodationType === 'MANUAL'
    );

    if (isManualHotel) {
      const manual = item.manualHotelDetails || item.product?.manualHotelDetails || (item.product as any)?.manualHotelDetails;
      const nights = Math.max(1, Number(manual?.numberOfNights ?? manual?.nights ?? (item.product as any)?.nights ?? 1));
      const rooms = Math.max(1, Number(manual?.numberOfRooms ?? manual?.roomsCount ?? (item.product as any)?.roomsCount ?? 1));
      const rateBasis = manual?.rateBasis || manual?.rateType || 'PER_ROOM_PER_NIGHT';
      const nativeCurrency: CurrencyCode = (manual?.rateCurrency || manual?.currency || item.product?.currency || 'USD') as CurrencyCode;

      const rawRate = manual?.ratePerNight !== undefined
        ? Number(manual.ratePerNight)
        : (manual?.sellingPrice !== undefined
          ? Number(manual.sellingPrice)
          : (manual?.netCost !== undefined
            ? Number(manual.netCost)
            : (item.product?.adultNetPrice !== undefined ? Number(item.product.adultNetPrice) : undefined)));

      const effectiveValidationRate = (rateBasis === 'PER_PERSON_PER_NIGHT' || rateBasis === 'PER_PERSON')
        ? Number(manual?.adultRate ?? rawRate ?? 0)
        : Number(rawRate ?? 0);

      if (rawRate === undefined || isNaN(effectiveValidationRate) || (effectiveValidationRate <= 0 && !manual?.isComplimentary && !manual?.isFreeStay)) {
        isComplete = false;
        incompleteWarnings.push({
          itemId: item.id,
          productName: manual?.hotelName || productName,
          category: 'Hotels & Accommodation',
          reason: `Manual hotel rate missing or invalid (${rawRate ?? 'unspecified'})`
        });

        itemizedBreakdown.push({
          itemId: item.id,
          productName: manual?.hotelName || productName,
          category: 'Hotels & Accommodation',
          nativeNetCost: 0,
          nativeCurrency,
          convertedNetCost: 0,
          currency: targetCurrency,
          markupAmount: 0,
          taxAmount: 0,
          serviceFee: 0,
          finalSellingPrice: item.calculation?.finalTotalSellingPrice || 0,
          isExcludedNoAccommodation: false,
          hasValidRate: false,
          incompleteReason: 'Missing authoritative manual nett rate'
        });
        continue;
      }

      // Calculate authoritative native nett cost based on rate basis
      let nativeNett = 0;
      if (rateBasis === 'TOTAL_STAY') {
        nativeNett = rawRate;
      } else if (rateBasis === 'PER_ROOM_TOTAL_STAY') {
        nativeNett = rawRate * rooms;
      } else if (rateBasis === 'PER_NIGHT' || rateBasis === 'PER_ROOM_PER_NIGHT') {
        nativeNett = rawRate * rooms * nights;
      } else if (rateBasis === 'PER_PERSON_PER_NIGHT' || rateBasis === 'PER_PERSON') {
        const adultRate = manual?.adultRate !== undefined ? Number(manual.adultRate) : rawRate;
        const childRate = manual?.childRate !== undefined ? Number(manual.childRate) : 0;
        const adultsCount = item.pax?.adults ?? (rooms * 2);
        const childrenCount = item.pax?.children ?? 0;
        nativeNett = (adultRate * adultsCount + childRate * childrenCount) * nights;
      } else {
        // PER_ROOM_PER_NIGHT
        nativeNett = rawRate * rooms * nights;
      }

      let convertedNetCost = 0;
      try {
        convertedNetCost = currencyEngine.convert(nativeNett, nativeCurrency, targetCurrency);
        if (isNaN(convertedNetCost)) throw new Error('Conversion returned NaN');
      } catch {
        isComplete = false;
        incompleteWarnings.push({
          itemId: item.id,
          productName: manual?.hotelName || productName,
          category: 'Hotels & Accommodation',
          reason: `Exchange rate unavailable for currency ${nativeCurrency} to ${targetCurrency}`
        });

        itemizedBreakdown.push({
          itemId: item.id,
          productName: manual?.hotelName || productName,
          category: 'Hotels & Accommodation',
          nativeNetCost: nativeNett,
          nativeCurrency,
          convertedNetCost: 0,
          currency: targetCurrency,
          markupAmount: 0,
          taxAmount: 0,
          serviceFee: 0,
          finalSellingPrice: item.calculation?.finalTotalSellingPrice || 0,
          isExcludedNoAccommodation: false,
          hasValidRate: false,
          incompleteReason: `Missing exchange rate ${nativeCurrency} -> ${targetCurrency}`
        });
        continue;
      }

      const markupAmount = item.calculation?.markupAmount || 0;
      const taxAmount = item.calculation?.taxAmount || 0;
      const serviceFee = item.calculation?.serviceFee || 0;
      const finalSellingPrice = item.calculation?.finalTotalSellingPrice || convertedNetCost;

      accumulatedNetCost += convertedNetCost;
      accumulatedUnderlyingMarkup += markupAmount;
      accumulatedTax += taxAmount;
      accumulatedServiceFee += serviceFee;
      accumulatedSellingPrice += finalSellingPrice;

      itemizedBreakdown.push({
        itemId: item.id,
        productName: manual?.hotelName || productName,
        category: 'Hotels & Accommodation',
        nativeNetCost: nativeNett,
        nativeCurrency,
        convertedNetCost,
        currency: targetCurrency,
        markupAmount,
        taxAmount,
        serviceFee,
        finalSellingPrice,
        isExcludedNoAccommodation: false,
        hasValidRate: true
      });
      continue;
    }

    // 3. Authoritative Pricing Engine for Standard Inventory Products
    // (Tours, Tickets, Transfers, Guides, Rail, Ferries, Restaurants, Yachts, Visas, Ancillaries)
    try {
      const calc = calculateProductPrice(item.product, {
        productId: item.product.id,
        pricingTier: 'B2B',
        userRole: 'ADMIN',
        adults: item.pax?.adults || 2,
        children: item.pax?.children || 0,
        infants: item.pax?.infants || 0,
        travelDate: item.travelDate,
        targetCurrency,
        selectedAddonIds: item.selectedAddonIds || []
      });

      const totalPax = (item.pax?.adults || 2) + (item.pax?.children || 0);
      const isComplimentary = Boolean((item.product as any).isComplimentary || (item.product as any).isFree);

      // Check for valid nett cost
      if (calc.totalNetCost <= 0 && !isComplimentary && totalPax > 0) {
        // Missing rate
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
          finalSellingPrice: calc.finalTotalSellingPrice || 0,
          isExcludedNoAccommodation: false,
          hasValidRate: false,
          incompleteReason: 'Missing authoritative supplier nett rate'
        });
        continue;
      }

      accumulatedNetCost += calc.totalNetCost;
      accumulatedUnderlyingMarkup += calc.markupAmount || 0;
      accumulatedTax += calc.taxAmount || 0;
      accumulatedServiceFee += calc.serviceFee || 0;
      accumulatedSellingPrice += calc.finalTotalSellingPrice || 0;

      itemizedBreakdown.push({
        itemId: item.id,
        productName,
        category,
        nativeNetCost: calc.nativeTotalNetCost,
        nativeCurrency: calc.nativeCurrency || targetCurrency,
        convertedNetCost: calc.totalNetCost,
        currency: targetCurrency,
        markupAmount: calc.markupAmount || 0,
        taxAmount: calc.taxAmount || 0,
        serviceFee: calc.serviceFee || 0,
        finalSellingPrice: calc.finalTotalSellingPrice,
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

  // 4. Commercial Package Pricing Aggregations
  const totalNettCost = isComplete ? accumulatedNetCost : 0;
  const hasAdminManualMargin = params.adminManualMarginValue !== undefined && params.adminManualMarginValue > 0;
  const adminMarginMode = params.adminMarginMode || 'REPLACE';

  const adminManualMarginAmount = hasAdminManualMargin
    ? (params.adminManualMarginType === 'FIXED'
        ? Math.round(params.adminManualMarginValue || 0)
        : Math.round(totalNettCost * ((params.adminManualMarginValue || 0) / 100)))
    : 0;

  // Margin calculation on Total Nett Cost:
  // In REPLACE mode (default): manual margin replaces accumulatedUnderlyingMarkup to avoid duplicate margin
  // In ADD mode: manual margin is added on top of existing calculated margin
  const effectiveUnderlyingMargin = hasAdminManualMargin
    ? (adminMarginMode === 'REPLACE'
        ? adminManualMarginAmount
        : (accumulatedUnderlyingMarkup + adminManualMarginAmount))
    : accumulatedUnderlyingMarkup;

  const revisedSellingPrice = totalNettCost + effectiveUnderlyingMargin + accumulatedServiceFee;

  const baseSellingPrice = hasAdminManualMargin
    ? revisedSellingPrice
    : accumulatedSellingPrice;

  const partnerMarginAmount = agentMarginType === 'PERCENTAGE'
    ? Math.round(baseSellingPrice * ((agentMarginValue || 0) / 100))
    : Math.round(agentMarginValue || 0);

  const discountAmount = overallDiscountPercent > 0
    ? Math.round((baseSellingPrice + partnerMarginAmount) * (overallDiscountPercent / 100))
    : 0;

  const finalPackagePrice = Math.max(0, baseSellingPrice + partnerMarginAmount - discountAmount);
  const totalMargin = effectiveUnderlyingMargin + partnerMarginAmount - discountAmount;

  return {
    isComplete,
    incompleteWarnings,
    totalNettCost,
    totalMargin,
    underlyingMarginAmount: accumulatedUnderlyingMarkup,
    partnerMarginAmount,
    taxAmount: accumulatedTax,
    serviceFee: accumulatedServiceFee,
    baseSellingPrice,
    discountAmount,
    finalPackagePrice,
    currency: targetCurrency,
    itemizedBreakdown,
    adminManualMarginAmount,
    existingMarginAmount: accumulatedUnderlyingMarkup,
    revisedSellingPrice
  };
}

/**
 * Authoritative Quote Total Calculator
 * Evaluates the active option (or root quote or item array), excludes any hotel items when Land-Only Mode
 * is active or when a hub is set to NO_ACCOMMODATION, and returns the exact customer-facing
 * and internal totals.
 */
export function calculateQuoteTotal(
  quoteOrItems: (Partial<Quotation> & { items?: QuoteItem[]; routeHubs?: TripRouteHub[]; scope?: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY' | 'FULL_PACKAGE'; quotationScope?: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY' | 'FULL_PACKAGE' }) | QuoteItem[],
  activeOptionIdOrMarginType?: string,
  marginValueArg?: number,
  currencyArg?: string
): {
  baseSellingPrice: number;
  baseTotalPrice: number;
  markupAmount: number;
  marginAmount: number;
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

  if (Array.isArray(quoteOrItems)) {
    activeItems = quoteOrItems;
    marginType = activeOptionIdOrMarginType || 'PERCENTAGE';
    marginValue = marginValueArg ?? 0;
  } else {
    const quote = quoteOrItems;
    const activeOption = quote.options && quote.options.length > 0
      ? (quote.options.find(o => o.id === (activeOptionIdOrMarginType || quote.activeOptionId)) || quote.options[0])
      : undefined;

    const rawItems: QuoteItem[] = (activeOption?.items && activeOption.items.length > 0)
      ? activeOption.items
      : (quote.items || []);
    const hubs: TripRouteHub[] = (activeOption?.routeHubs && activeOption.routeHubs.length > 0)
      ? activeOption.routeHubs
      : (quote.routeHubs || []);
    activeHubs = hubs;

    const effectiveScope = activeOption?.scope || activeOption?.quotationScope || quote.scope || quote.quotationScope || 'HOTEL_LAND';
    isLandOnly = effectiveScope === 'LAND_ONLY';

    const noAccHubIds = new Set(
      hubs
        .filter(h => isLandOnly || h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none')
        .map(h => h.id)
    );
    const noAccHubNames = new Set(
      hubs
        .filter(h => isLandOnly || h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none')
        .map(h => (h.hubName || '').toLowerCase())
        .filter(Boolean)
    );

    activeItems = rawItems.filter(it => {
      if (it.isNoAccommodation || (it as any).accommodationType === 'NO_ACCOMMODATION' || (it as any).accommodationType === 'none') {
        return false;
      }
      if (isHotelItem(it)) {
        if (isLandOnly) return false;
        const itemHubId = it.hubId || it.manualHotelDetails?.hubId || (it.metadata as any)?.hubId;
        if (itemHubId && noAccHubIds.has(itemHubId)) return false;
        if (!itemHubId) {
          const itemCity = (it.manualHotelDetails?.city || it.product?.city || '').toLowerCase();
          if (itemCity && noAccHubNames.has(itemCity)) return false;
        }
      }
      return true;
    });

    marginType = quote.agentMarginType || 'PERCENTAGE';
    marginValue = quote.agentMarginValue !== undefined ? quote.agentMarginValue : (quote.overallMarkupPercent || 0);
    discountPercent = quote.overallDiscountPercent || 0;
  }

  const getItemSelling = (it: QuoteItem): number =>
    it.calculation?.finalTotalSellingPrice ||
    (it.calculation as any)?.totalSellingPrice ||
    (it as any).totalSellingPrice ||
    (it as any).totalPrice ||
    (it as any).sellingPrice ||
    0;

  const getItemNet = (it: QuoteItem): number =>
    (it.calculation as any)?.totalNetCost || (it as any).totalNetCost || 0;

  // Partition activeItems into strictly non-overlapping Hotel vs Non-Hotel (Land) sets
  const hotelItems = activeItems.filter(isHotelItem);
  const landItems = activeItems.filter(it => !isHotelItem(it));

  let hotelBaseSellingPrice = hotelItems.reduce((sum, it) => sum + getItemSelling(it), 0);
  const hotelTotalNetCost = hotelItems.reduce((sum, it) => sum + getItemNet(it), 0);

  // Include any routeHub manualHotel that was not already represented in hotelItems
  let hubManualHotelsCount = 0;
  if (!isLandOnly && activeHubs.length > 0) {
    const countedHotelIds = new Set<string>();
    activeHubs.forEach(h => {
      if (h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none') return;
      const matched = hotelItems.find(it => {
        if (countedHotelIds.has(it.id)) return false;
        return (h.hotelId && it.product?.id?.includes(h.hotelId)) ||
               (h.manualHotel?.hotelName && it.product?.name?.toLowerCase().includes(h.manualHotel.hotelName.toLowerCase())) ||
               (it.notes && it.notes.toLowerCase().includes((h.hubName || '').toLowerCase())) ||
               (it.hubId === h.id || it.manualHotelDetails?.hubId === h.id);
      });
      if (matched) {
        countedHotelIds.add(matched.id);
      } else if (h.manualHotel) {
        const manualPrice = (h.manualHotel as any)?.totalSellingPrice ||
                            (h.manualHotel as any)?.totalPrice ||
                            (h.manualHotel as any)?.price || 0;
        if (manualPrice > 0) {
          hotelBaseSellingPrice += manualPrice;
          hubManualHotelsCount++;
        }
      }
    });
  }

  const landBaseSellingPrice = landItems.reduce((sum, it) => sum + getItemSelling(it), 0);
  const landTotalNetCost = landItems.reduce((sum, it) => sum + getItemNet(it), 0);

  const baseSellingPrice = hotelBaseSellingPrice + landBaseSellingPrice;
  const totalNetCost = hotelTotalNetCost + landTotalNetCost;

  const adminMarginValue = !Array.isArray(quoteOrItems)
    ? ((quoteOrItems as any).adminManualMarginValue ?? (quoteOrItems as any).admin_manual_margin_value)
    : undefined;
  const adminMarginType = !Array.isArray(quoteOrItems)
    ? ((quoteOrItems as any).adminManualMarginType ?? (quoteOrItems as any).admin_manual_margin_type ?? 'PERCENTAGE')
    : 'PERCENTAGE';
  const adminMarginMode = !Array.isArray(quoteOrItems)
    ? ((quoteOrItems as any).adminMarginMode ?? (quoteOrItems as any).admin_margin_mode ?? 'REPLACE')
    : 'REPLACE';

  let effectiveBaseSellingPrice = baseSellingPrice;
  let effectiveHotelBaseSellingPrice = hotelBaseSellingPrice;
  let effectiveLandBaseSellingPrice = landBaseSellingPrice;

  if (adminMarginValue !== undefined && adminMarginValue > 0) {
    const adminMarginAmount = adminMarginType === 'PERCENTAGE'
      ? Math.round(totalNetCost * (adminMarginValue / 100))
      : Math.round(adminMarginValue);
    effectiveBaseSellingPrice = adminMarginMode === 'REPLACE'
      ? (totalNetCost + adminMarginAmount)
      : (baseSellingPrice + adminMarginAmount);

    if (adminMarginType === 'PERCENTAGE') {
      const hotelAdminMargin = Math.round(hotelTotalNetCost * (adminMarginValue / 100));
      const landAdminMargin = adminMarginAmount - hotelAdminMargin;
      effectiveHotelBaseSellingPrice = adminMarginMode === 'REPLACE'
        ? (hotelTotalNetCost + hotelAdminMargin)
        : (hotelBaseSellingPrice + hotelAdminMargin);
      effectiveLandBaseSellingPrice = adminMarginMode === 'REPLACE'
        ? (landTotalNetCost + landAdminMargin)
        : (landBaseSellingPrice + landAdminMargin);
    } else {
      const hotelShare = baseSellingPrice > 0 ? (hotelBaseSellingPrice / baseSellingPrice) : 0;
      const hotelAdminMargin = Math.round(adminMarginAmount * hotelShare);
      const landAdminMargin = adminMarginAmount - hotelAdminMargin;
      effectiveHotelBaseSellingPrice = adminMarginMode === 'REPLACE'
        ? (hotelTotalNetCost + hotelAdminMargin)
        : (hotelBaseSellingPrice + hotelAdminMargin);
      effectiveLandBaseSellingPrice = adminMarginMode === 'REPLACE'
        ? (landTotalNetCost + landAdminMargin)
        : (landBaseSellingPrice + landAdminMargin);
    }
  }

  const markupAmount = marginType === 'PERCENTAGE'
    ? Math.round(effectiveBaseSellingPrice * (marginValue / 100))
    : Math.round(marginValue);

  const discountAmount = discountPercent > 0
    ? Math.round((effectiveBaseSellingPrice + markupAmount) * (discountPercent / 100))
    : 0;

  const finalCustomerSellingPrice = Math.max(0, effectiveBaseSellingPrice + markupAmount - discountAmount);

  // Calculate Hotel Accommodation Total and Land Part Total using identical margin/discount rules
  const hotelMarkupAmount = marginType === 'PERCENTAGE'
    ? Math.round(effectiveHotelBaseSellingPrice * (marginValue / 100))
    : (effectiveBaseSellingPrice > 0
        ? Math.round(markupAmount * (effectiveHotelBaseSellingPrice / effectiveBaseSellingPrice))
        : 0);
  const hotelDiscountAmount = discountPercent > 0
    ? Math.round((effectiveHotelBaseSellingPrice + hotelMarkupAmount) * (discountPercent / 100))
    : 0;
  const hotelTotalSellingPrice = Math.max(0, effectiveHotelBaseSellingPrice + hotelMarkupAmount - hotelDiscountAmount);

  const landMarkupAmount = markupAmount - hotelMarkupAmount;
  const landDiscountAmount = discountAmount - hotelDiscountAmount;
  let landPartTotalSellingPrice = Math.max(0, effectiveLandBaseSellingPrice + landMarkupAmount - landDiscountAmount);

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
    baseSellingPrice: effectiveBaseSellingPrice,
    baseTotalPrice: effectiveBaseSellingPrice,
    markupAmount,
    marginAmount: markupAmount,
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
    landBaseSellingPrice: effectiveLandBaseSellingPrice,
    landPartTotalSellingPrice,
    landTotalNetCost,
    hasLandServices
  };
}
