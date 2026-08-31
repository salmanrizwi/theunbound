import { CurrencyCode, PricingCalculationRequest, PricingCalculationResult, Product, User, UserRole } from '../types';
import { ExchangeRateService, DEFAULT_EXCHANGE_RATES } from './exchangeRateService';

// Standardized exchange rate base: 1 USD
export const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  ...DEFAULT_EXCHANGE_RATES
};

export function convertCurrency(amount: number, from: CurrencyCode | any, to: CurrencyCode | any): number {
  const fromCode: CurrencyCode = (typeof from === 'object' && from !== null) ? (from.code || 'USD') : (from || 'USD');
  const toCode: CurrencyCode = (typeof to === 'object' && to !== null) ? (to.code || 'USD') : (to || 'USD');
  if (fromCode === toCode) return amount;
  return ExchangeRateService.getInstance().convert(amount, fromCode, toCode);
}

export function formatCurrency(amount?: number | null, currency: CurrencyCode | any = 'USD'): string {
  const safeAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : (Number(amount) || 0);
  const safeCurrency: string = (typeof currency === 'object' && currency !== null) 
    ? (currency.code || 'USD') 
    : (typeof currency === 'string' ? currency : 'USD');
  const decimals = (safeCurrency === 'JPY' || safeCurrency === 'THB') ? 0 : 2;
  const symbolMap: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AED: 'AED ',
    THB: '฿',
    AUD: 'A$',
    CAD: 'CA$',
    SGD: 'S$',
    INR: '₹',
    CHF: 'CHF '
  };

  const symbol = symbolMap[safeCurrency] || `${safeCurrency} `;
  return `${symbol}${safeAmount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

// Product categories that use capacity-based vehicle/yacht calculation by default
export const CAPACITY_BASED_CATEGORIES = ['Private Tours', 'Transfers', 'Transport', 'Private Yacht'];

export function isCapacityBasedProduct(product: Product): boolean {
  if (product.pricingMethod === 'capacity_based') return true;
  if (product.pricingMethod === 'per_person') return false;
  if (product.vehicleConfig?.pricingMethod === 'capacity_based') return true;
  if (product.isTransfer) return true;
  return CAPACITY_BASED_CATEGORIES.includes(product.category as string) || 
         product.category === 'Private Yacht' || 
         (product.category as string) === 'Cruises';
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

export function calculateSellingPrice(
  adultNetPrice: number,
  markupPercent: number = 20,
  taxPercent: number = 10,
  serviceFeeFixed: number = 0
): number {
  const markupAmount = adultNetPrice * (markupPercent / 100);
  const taxAmount = markupAmount * (taxPercent / 100);
  return adultNetPrice + markupAmount + taxAmount + serviceFeeFixed;
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
    const vehicleCost = product.vehicleConfig?.unitVehicleNetCost ?? 
                        product.vehicleConfig?.totalTransferCost ?? 
                        baseAdultNet ?? 
                        500;
    const maxSeats = product.vehicleConfig?.maxSeats || product.vehicleConfig?.passengerCapacity || product.maxPax || 7;
    const vehicleModel = product.vehicleConfig?.vehicleModel || product.vehicleConfig?.vehicleName || product.name;

    const rawVehicleSelling = calculateSellingPrice(
      vehicleCost,
      appliedMarkupPercent,
      product.taxPercent ?? 10,
      product.serviceFeeFixed ?? 0
    );

    const totalVehicleSellingPrice = convertCurrency(rawVehicleSelling, product.currency, targetCurrency);
    const perPersonStartingFrom = totalVehicleSellingPrice / Math.max(1, maxSeats);

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
      vehicleCapacity: maxSeats,
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

  // 1. Determine Base Net Costs with Date-Wise & Tiered Overrides in Base Currency
  let baseAdultNet = product.adultNetPrice ?? product.adultNettCost ?? 0;
  let baseChildNet = product.childNetPrice !== undefined ? product.childNetPrice : (product.childNettCost !== undefined ? product.childNettCost : baseAdultNet * 0.5);
  let baseInfantNet = product.infantNetPrice !== undefined ? product.infantNetPrice : (product.infantNettCost !== undefined ? product.infantNettCost : 0);

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
      baseAdultNet = matchingTier.netCostPerPax;
      baseChildNet = matchingTier.netCostPerPax * 0.5;
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
    // --- CAPACITY-BASED PRICING MODEL ---
    // Rule: Total Vehicle Cost / Actual Occupied Seats = Per-Person Nett Cost.
    // Total Vehicle Cost remains unchanged until the vehicle's maximum capacity is exceeded.
    const vehicleConfig = product.vehicleConfig;
    const vehicleModel = vehicleConfig?.vehicleModel || vehicleConfig?.vehicleName || product.name;
    const vehicleType = vehicleConfig?.vehicleType || 'Executive Vehicle';
    const maxSeats = Math.max(1, vehicleConfig?.maxSeats || vehicleConfig?.passengerCapacity || vehicleConfig?.totalSeats || product.maxPax || 7);
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
    const autoAllocate = vehicleConfig?.autoAllocateVehicles ?? true;
    const maxVehicles = vehicleConfig?.maxVehicles || 10;

    let vehiclesAllocated = quantity;
    let capacityExceeded = false;
    let capacityErrorMessage: string | undefined = undefined;

    if (totalOccupiedSeats <= (maxSeats * quantity)) {
      vehiclesAllocated = quantity;
      capacityExceeded = false;
    } else {
      // Passenger count exceeds configured vehicle capacity
      if (autoAllocate || allowMultiple) {
        vehiclesAllocated = Math.max(quantity, Math.ceil(totalOccupiedSeats / maxSeats));
        if (vehiclesAllocated > maxVehicles) {
          capacityExceeded = true;
          capacityErrorMessage = `Passenger count (${totalOccupiedSeats} seats) exceeds maximum allowed fleet capacity (${maxVehicles * maxSeats} seats across ${maxVehicles} vehicles).`;
        }
      } else {
        vehiclesAllocated = quantity;
        capacityExceeded = true;
        capacityErrorMessage = `Vehicle capacity of ${maxSeats} seats exceeded (${totalOccupiedSeats} seats required). Please add another vehicle or select a higher-capacity transport option.`;
      }
    }

    // Total Vehicle Nett Cost: remains fixed per vehicle (e.g. ₹500 for 1–7 passengers on 1 vehicle)
    rawTotalNetCostInNative = vehiclesAllocated * unitVehicleNetCost;
    const perPersonNetInNative = totalPax > 0 ? rawTotalNetCostInNative / totalPax : rawTotalNetCostInNative;

    adultNetInNative = rawTotalNetCostInNative;
    childNetInNative = 0;
    infantNetInNative = 0;

    vehicleDetails = {
      vehicleName: vehicleConfig?.vehicleName || vehicleModel,
      vehicleModel,
      vehicleType,
      maxSeats,
      occupiedSeats: totalOccupiedSeats,
      vehiclesAllocated,
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
    };
  } else if (isFixedStayHotel) {
    // Fixed Total Stay Net Cost for Manual Hotel / Room Configuration
    rawTotalNetCostInNative = baseAdultNet * quantity;
    adultNetInNative = rawTotalNetCostInNative;
    childNetInNative = (baseChildNet || 0) * children * quantity;
    infantNetInNative = (baseInfantNet || 0) * infants * quantity;
    rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
  } else {
    // Standard Per-Person Tour / Activity / Hotel Pricing Engine
    adultNetInNative = baseAdultNet * adults * quantity;
    childNetInNative = baseChildNet * children * quantity;
    infantNetInNative = baseInfantNet * infants * quantity;
    rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
  }

  // Add-ons Calculation
  let addonsNetInNative = 0;
  if (request.selectedAddonIds && (request.selectedAddonIds || []).length > 0 && product.addons) {
    const selectedAddons = (product.addons || []).filter(a => (request.selectedAddonIds || []).includes(a.id));
    for (const addon of selectedAddons) {
      const chargeablePax = isCapacity ? 1 : (adults + children);
      const addonAmountConverted = convertCurrency(addon.pricePerPax * chargeablePax * quantity, addon.currency, product.currency);
      addonsNetInNative += addonAmountConverted;
    }
  }

  rawTotalNetCostInNative += addonsNetInNative;

  // Convert Net Subtotals to Target Currency
  const targetCurrency = request.targetCurrency || product.currency;
  const adultsSubtotalNet = convertCurrency(adultNetInNative, product.currency, targetCurrency);
  const childrenSubtotalNet = convertCurrency(childNetInNative, product.currency, targetCurrency);
  const infantsSubtotalNet = convertCurrency(infantNetInNative, product.currency, targetCurrency);
  const addonsSubtotalNet = convertCurrency(addonsNetInNative, product.currency, targetCurrency);
  const totalNetCost = convertCurrency(rawTotalNetCostInNative, product.currency, targetCurrency);

  // Update vehicle details with converted currency costs if applicable
  if (vehicleDetails) {
    vehicleDetails.unitVehicleNetCost = convertCurrency(vehicleDetails.unitVehicleNetCost, product.currency, targetCurrency);
    vehicleDetails.totalVehicleNetCost = convertCurrency(vehicleDetails.totalVehicleNetCost, product.currency, targetCurrency);
    vehicleDetails.perPersonNetCost = totalPax > 0 ? vehicleDetails.totalVehicleNetCost / totalPax : vehicleDetails.totalVehicleNetCost;
  }

  // Configurable Commercial Rates with User-Type Hierarchy:
  let configuredMarkupPercent = 25;
  if (request.customMarkupPercent !== undefined) {
    configuredMarkupPercent = request.customMarkupPercent;
  } else if (pricingTier === 'B2B') {
    if (user?.customAgentMarginPercent !== undefined) {
      configuredMarkupPercent = user.customAgentMarginPercent;
    } else if (product.b2bAgentMarkupPercent !== undefined) {
      configuredMarkupPercent = product.b2bAgentMarkupPercent;
    } else {
      configuredMarkupPercent = 20;
    }
  } else {
    // Buyer tier
    if (user?.customBuyerMarginPercent !== undefined) {
      configuredMarkupPercent = user.customBuyerMarginPercent;
    } else if (product.buyerMarkupPercent !== undefined) {
      configuredMarkupPercent = product.buyerMarkupPercent;
    } else {
      configuredMarkupPercent = product.defaultMarkupPercent ?? 30;
    }
  }

  // Markup calculation on totalNetCost
  let markupRate = configuredMarkupPercent / 100;
  let markupAmount = totalNetCost * markupRate;

  let b2bWholesaleMarkupRate = configuredMarkupPercent / 100;
  let b2bWholesaleNetToAgent = totalNetCost + (totalNetCost * b2bWholesaleMarkupRate);
  let agentClientMarkupRate = (request.agentClientMarkupPercent || 12) / 100;
  let agentProfitAmount = b2bWholesaleNetToAgent * agentClientMarkupRate;

  if (pricingTier === 'B2B') {
    const dmcWholesaleMarginAmount = totalNetCost * b2bWholesaleMarkupRate;
    b2bWholesaleNetToAgent = totalNetCost + dmcWholesaleMarginAmount;
    agentProfitAmount = b2bWholesaleNetToAgent * agentClientMarkupRate;
    markupAmount = dmcWholesaleMarginAmount + agentProfitAmount;
    markupRate = totalNetCost > 0 ? markupAmount / totalNetCost : 0;
  }

  // TAX SPEC: Tax is calculated on the MARGIN amount only!
  const configuredTaxPercent = product.taxPercent !== undefined ? product.taxPercent : 10;
  const taxRate = configuredTaxPercent / 100;
  const taxAmount = markupAmount * taxRate;

  // Dynamic Fee %: 0 if explicitly 0 or Hotels / Manual Accommodations, otherwise default service fee
  const configuredFeePercent = product.serviceFeeFixed !== undefined 
    ? (totalNetCost > 0 ? (product.serviceFeeFixed / totalNetCost) * 100 : 0)
    : (product.productType === 'Hotel' || product.accommodationType === 'manual' || product.isManualHotel ? 0 : 2.5);
  const feeRate = configuredFeePercent / 100;
  const serviceFee = totalNetCost * feeRate;

  // Discounts & Commissions
  const discountPercent = request.customDiscountPercent || 0;
  const discountRate = discountPercent / 100;
  const discountAmount = (totalNetCost + markupAmount + taxAmount + serviceFee) * discountRate;

  const commissionPercent = product.commissionPercent || 0;
  const commissionRate = commissionPercent / 100;
  const commissionAmount = totalNetCost * commissionRate;

  const grossBeforeTax = totalNetCost + markupAmount;
  const finalTotalSellingPrice = (totalNetCost + markupAmount + taxAmount + serviceFee) - discountAmount;

  const dmcMarginAmount = markupAmount + serviceFee - discountAmount;
  const dmcMarginPercent = totalNetCost > 0 ? (dmcMarginAmount / totalNetCost) * 100 : 0;

  // Per Person Selling Cost
  const pricePerPerson = totalPax > 0 ? finalTotalSellingPrice / totalPax : finalTotalSellingPrice;

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
    finalTotalSellingPrice,
    sellingPriceFinal: finalTotalSellingPrice,
    pricePerPerson,
    dmcMarginAmount,
    dmcMarginPercent,
    isCapacityBased: isCapacity,
    pricingMethod: isCapacity ? 'capacity_based' : 'per_person',
    vehicleDetails
  };
}
