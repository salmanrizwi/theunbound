import { CurrencyCode, PricingCalculationRequest, PricingCalculationResult, AgentPricingResponse, Product, User, UserRole, HotelRate, B2BPackage, FXRateDetails, TieredPrice } from '../types';
import { currencyEngine, convertCurrency as engineConvert, formatCurrency as engineFormat, getExchangeRateInfo, BASELINE_USD_RATES } from './currencyEngine';
import { AppDatabase } from './db';
import { hotelToProduct } from '../utils/hotelHelpers';
import { sanitizePricingResultForAgent } from '../utils/customerQuoteSanitizer';

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
  if (product.pricingMethod === 'capacity_based') return true;
  if (product.pricingMethod === 'per_person') return false;
  if (product.pricingMethod as string === 'hourly' || product.pricingMethod === 'hourly_based') return false;
  if (product.vehicleConfig?.pricingMethod === 'capacity_based') return true;
  if (product.isTransfer) return true;
  if (product.vehicleConfig && product.vehicleConfig.maxSeats) return true;
  const cat = (product.category || '').toLowerCase();
  return (
    cat.includes('private tour') ||
    cat.includes('transfer') ||
    cat.includes('transport') ||
    cat.includes('private yacht') ||
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
  serviceChargeAmount: number;
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
    serviceChargeAmount,
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
  deliveredPrice: number; // In targetCurrency (converted from Base Currency)
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

/**
 * Calculates the exact Delivered Selling Price for a product based on:
 * 1. Product adult/child/infant nett costs in Base Currency
 * 2. User role & segregation (Buyer vs B2B Agent vs Admin)
 * 3. User custom margin overrides (if configured in Account Management)
 * 4. Product-level default markups (Buyer Markup % vs B2B Agent Markup %)
 * 5. Logged-out users strictly receive the Buyer pricing tier
 */
export function calculateDeliveredPriceForUser(
  product: Product,
  user: User | null,
  targetCurrency: CurrencyCode = 'USD'
): DeliveredPriceInfo {
  const role: UserRole = user?.role || 'BUYER';
  const isAgent = role === 'B2B_AGENT' || role === 'AGENT';
  const isAdmin = role === 'ADMIN' || role === 'TEAM_MEMBER' || role === 'DMC_STAFF';

  let userTier: 'BUYER' | 'B2B_AGENT' | 'ADMIN' = 'BUYER';
  let appliedMarkupPercent = product.buyerMarkupPercent !== undefined 
    ? product.buyerMarkupPercent 
    : (product.defaultMarkupPercent !== undefined ? product.defaultMarkupPercent : 30);
  let isCustomMargin = false;

  if (isAdmin) {
    userTier = 'ADMIN';
    appliedMarkupPercent = product.b2bAgentMarkupPercent !== undefined ? product.b2bAgentMarkupPercent : 20;
    if (user?.customAgentMarginPercent !== undefined) {
      appliedMarkupPercent = user.customAgentMarginPercent;
      isCustomMargin = true;
    }
  } else if (isAgent) {
    userTier = 'B2B_AGENT';
    // Default B2B Agent markup from product, else fallback 20%
    appliedMarkupPercent = product.b2bAgentMarkupPercent !== undefined ? product.b2bAgentMarkupPercent : 20;
    // Check if specific B2B Agent has a custom margin override
    if (user?.customAgentMarginPercent !== undefined) {
      appliedMarkupPercent = user.customAgentMarginPercent;
      isCustomMargin = true;
    }
  } else {
    // BUYER tier (or logged-out user)
    userTier = 'BUYER';
    // Default Buyer markup from product, else fallback 30%
    appliedMarkupPercent = product.buyerMarkupPercent !== undefined 
      ? product.buyerMarkupPercent 
      : (product.defaultMarkupPercent !== undefined ? product.defaultMarkupPercent : 30);
    // Check if specific Buyer has a custom margin override
    if (user?.customBuyerMarginPercent !== undefined) {
      appliedMarkupPercent = user.customBuyerMarginPercent;
      isCustomMargin = true;
    }
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

    const rawVehicleSelling = calculateSellingPrice(
      vehicleCost,
      appliedMarkupPercent,
      product.taxPercent ?? 10,
      product.serviceFeeFixed ?? 0
    );

    const totalVehicleSellingPrice = convertCurrency(rawVehicleSelling, product.currency, targetCurrency);
    const perPersonStartingFrom = totalVehicleSellingPrice / Math.max(1, startingCapacity);

    return {
      deliveredPrice: totalVehicleSellingPrice,
      rawPriceInBaseCurrency: rawVehicleSelling,
      baseAdultNet: vehicleCost,
      baseChildNet: 0,
      baseInfantNet: 0,
      appliedMarkupPercent,
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
  product: Product,
  request: PricingCalculationRequest
): PricingCalculationResult {
  const user = request.user || null;
  const userRole = request.userRole || user?.role || 'BUYER';
  const isAgent = userRole === 'B2B_AGENT' || userRole === 'AGENT' || request.pricingTier === 'B2B';
  const pricingTier: 'B2C' | 'B2B' = isAgent ? 'B2B' : 'B2C';

  const adults = Math.max(1, request.adults || 1);
  const children = Math.max(0, request.children || 0);
  const infants = Math.max(0, request.infants || 0);
  const totalPax = adults + children + infants;
  const quantity = Math.max(1, request.quantity || 1);
  const travelDate = request.travelDate || new Date().toISOString().split('T')[0];

  // 1. Authoritative Rate Sheet & Database Lookup
  // Check if database contains an active, valid rate for this product / travel date
  let baseAdultNet = product.adultNetPrice ?? product.adultNettCost ?? 0;
  let baseChildNet = product.childNetPrice !== undefined ? product.childNetPrice : (product.childNettCost !== undefined ? product.childNettCost : baseAdultNet * 0.5);
  let baseInfantNet = product.infantNetPrice !== undefined ? product.infantNetPrice : (product.infantNettCost !== undefined ? product.infantNettCost : 0);
  let nativeCurrency = product.nativeCurrency || product.currency || 'USD';

  let authoritativeRateId: string | undefined = (product as any).rateId;
  let authoritativeRateVersion: string | number | undefined = (product as any).version || 1;
  let authoritativeRateFrom: string | undefined = product.validityFrom;
  let authoritativeRateTo: string | undefined = product.validityTo;
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
                          product.sku?.startsWith('MAN-HTL-');

  let rawTotalNetCostInNative = 0;
  let adultNetInNative = 0;
  let childNetInNative = 0;
  let infantNetInNative = 0;

  // Capacity calculations
  let vehicleDetails: PricingCalculationResult['vehicleDetails'] | undefined = undefined;

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
    let matchingTierFound: TieredPrice | undefined = undefined;

    // Check Product-Specific Capacity Rules (tieredPricing) FIRST
    const activeTiers = (product.tieredPricing || []).filter(t => t.status !== 'INACTIVE');
    const sortedTiers = [...activeTiers].sort((a, b) => a.minPax - b.minPax);

    if (sortedTiers.length > 0) {
      // Find matching passenger tier in product-specific capacity rules
      matchingTierFound = sortedTiers.find(t => totalOccupiedSeats >= t.minPax && totalOccupiedSeats <= t.maxPax);

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
    rawTotalNetCostInNative = baseAdultNet * quantity;
    adultNetInNative = rawTotalNetCostInNative;
    childNetInNative = (baseChildNet || 0) * children * quantity;
    infantNetInNative = (baseInfantNet || 0) * infants * quantity;
    rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
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
    const matchedMeal = mealPricingList.find(m => m.meal && m.meal.toLowerCase() === requestedMeal.toLowerCase() && m.status !== 'INACTIVE')
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
  if (request.customMarkupPercent !== undefined) {
    configuredMarkupPercent = request.customMarkupPercent;
  } else if (pricingTier === 'B2B') {
    // SECTION 5: BUYER MARGIN MUST NOT BE USED for B2B. Use B2B Agent Margin only.
    if (user?.customAgentMarginPercent !== undefined) {
      configuredMarkupPercent = user.customAgentMarginPercent;
    } else if (rateMarkupAgent !== undefined) {
      configuredMarkupPercent = rateMarkupAgent;
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
  if ((product as any).marginType === 'FIXED' && (product as any).marginFixed !== undefined) {
    nativeMarkupAmount = Number((product as any).marginFixed) * (isCapacity ? 1 : totalPax);
    markupRate = nativeTotalNetCost > 0 ? nativeMarkupAmount / nativeTotalNetCost : 0;
  }

  // Authoritative Tax on Margin (Section 4 & 24)
  const configuredTaxPercent = rateTaxPercentage !== undefined 
    ? rateTaxPercentage 
    : (product.taxPercent !== undefined ? product.taxPercent : 10);
  const taxRate = configuredTaxPercent / 100;
  const nativeTaxAmount = nativeMarkupAmount * taxRate;

  // Subtotal = Nett Cost + Margin Amount + Tax Amount
  const nativeSubtotal = nativeTotalNetCost + nativeMarkupAmount + nativeTaxAmount;

  // Service Fee on Subtotal (Section 4 & 24)
  let nativeServiceFee = 0;
  if ((product as any).serviceFeeFixed !== undefined) {
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
  const targetCurrency = request.targetCurrency || nativeCurrency;
  const isConverted = targetCurrency !== nativeCurrency;
  const fxDetails: FXRateDetails = currencyEngine.getRateInfo(nativeCurrency, targetCurrency);

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
    sellingPriceFinal: finalTotalSellingPrice,
    pricePerPerson,
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
    rateEffectiveFrom: authoritativeRateFrom || product.validityFrom || '2026-01-01',
    rateEffectiveTo: authoritativeRateTo || product.validityTo || '2026-12-31',
    isAuthoritative: true,
    sourceCollection: authoritativeSourceCollection,
    pricingRequestId: `PRQ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    calculatedAt: new Date().toISOString()
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
        const htl = allHotels.find(h => h.id === hs.hotelId || h.name.toLowerCase() === hs.name.toLowerCase());
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
      consumers: ['AI Planner Fleet Allocation', 'Capacity Simulation Matrix', 'B2B Quote Builder Step 4', 'Ground Transport Ops']
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
      consumers: ['AI Planner Hotel Matching', 'B2B Quote Builder Step 2 (Lodging)', 'calculateHotelStayPrice', 'Buyer Portal']
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
      consumers: ['AI Planner Route Transitions', 'B2B Quote Builder Step 3 (Transfers)', 'Airport Fast-Track']
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
}
