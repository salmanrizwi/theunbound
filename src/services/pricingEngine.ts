import { CurrencyCode, PricingCalculationRequest, PricingCalculationResult, Product, User, UserRole } from '../types';
import { ExchangeRateService, DEFAULT_EXCHANGE_RATES } from './exchangeRateService';

// Standardized exchange rate base: 1 USD
export const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  ...DEFAULT_EXCHANGE_RATES
};

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return amount;
  return ExchangeRateService.getInstance().convert(amount, from, to);
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const decimals = (currency === 'JPY' || currency === 'THB') ? 0 : 2;
  const symbolMap: Record<CurrencyCode, string> = {
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

  const symbol = symbolMap[currency] || `${currency} `;
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
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

  const baseAdultNet = product.adultNetPrice ?? product.adultNettCost ?? 0;
  const baseChildNet = product.childNetPrice ?? product.childNettCost ?? (baseAdultNet * 0.5);
  const baseInfantNet = product.infantNetPrice ?? product.infantNettCost ?? 0;

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
    currency: targetCurrency
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
  if (product.tieredPricing && product.tieredPricing.length > 0) {
    const matchingTier = product.tieredPricing.find(t => totalPax >= t.minPax && totalPax <= t.maxPax);
    if (matchingTier) {
      baseAdultNet = matchingTier.netCostPerPax;
      baseChildNet = matchingTier.netCostPerPax * 0.5;
    }
  }

  // Check if Product is Transfer (Fixed Vehicle Cost Engine)
  const isTransfer = product.isTransfer || 
                     product.category === 'Transfers' || 
                     product.category === 'Transport' || 
                     product.productType?.toLowerCase().includes('transfer');

  let rawTotalNetCostInNative = 0;
  let adultNetInNative = 0;
  let childNetInNative = 0;
  let infantNetInNative = 0;

  if (isTransfer) {
    // Fixed Total Vehicle Cost
    const vehicleCost = product.vehicleConfig?.totalTransferCost || baseAdultNet || 200;
    rawTotalNetCostInNative = vehicleCost * quantity;
    adultNetInNative = rawTotalNetCostInNative;
    childNetInNative = 0;
    infantNetInNative = 0;
  } else {
    // Tour / Activity / Hotel Pricing Engine with Adult, Child & Infant Costs
    adultNetInNative = baseAdultNet * adults * quantity;
    childNetInNative = baseChildNet * children * quantity;
    infantNetInNative = baseInfantNet * infants * quantity;
    rawTotalNetCostInNative = adultNetInNative + childNetInNative + infantNetInNative;
  }

  // Add-ons Calculation
  let addonsNetInNative = 0;
  if (request.selectedAddonIds && request.selectedAddonIds.length > 0 && product.addons) {
    const selectedAddons = product.addons.filter(a => request.selectedAddonIds?.includes(a.id));
    for (const addon of selectedAddons) {
      const chargeablePax = isTransfer ? 1 : (adults + children);
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

  // TAX SPEC: Tax is calculated on the MARGIN amount
  const configuredTaxPercent = product.taxPercent !== undefined ? product.taxPercent : 10;
  const taxRate = configuredTaxPercent / 100;
  const taxAmount = markupAmount * taxRate;

  // Dynamic Fee %: default 2.5% on net cost or product service fee
  const configuredFeePercent = product.serviceFeeFixed > 0 ? (product.serviceFeeFixed / (totalNetCost || 1)) * 100 : 2.5;
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
  const adultsSubtotalSelling = isTransfer ? finalTotalSellingPrice : (adultsSubtotalNet * sellingMultiplier);
  const childrenSubtotalSelling = isTransfer ? 0 : (childrenSubtotalNet * sellingMultiplier);
  const infantsSubtotalSelling = isTransfer ? 0 : (infantsSubtotalNet * sellingMultiplier);
  const addonsSubtotalSelling = addonsSubtotalNet * sellingMultiplier;
  const adultPricePerPax = adults > 0 ? (isTransfer ? pricePerPerson : (adultsSubtotalSelling / adults)) : 0;
  const childPricePerPax = children > 0 ? (isTransfer ? pricePerPerson : (childrenSubtotalSelling / children)) : 0;

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
    pricePerPerson,
    dmcMarginAmount,
    dmcMarginPercent
  };
}
