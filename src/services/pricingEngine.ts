import { CurrencyCode, PricingCalculationRequest, PricingCalculationResult, Product } from '../types';

// Standardized exchange rate base: 1 USD
export const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 154.5
};

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return amount;
  const inUsd = amount / EXCHANGE_RATES[from];
  return inUsd * EXCHANGE_RATES[to];
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const decimals = currency === 'JPY' ? 0 : 2;
  const symbolMap: Record<CurrencyCode, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥'
  };

  return `${symbolMap[currency]}${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

export function calculateProductPrice(
  product: Product,
  request: PricingCalculationRequest
): PricingCalculationResult {
  const pricingTier: 'B2C' | 'B2B' = request.pricingTier || 'B2B';
  const adults = Math.max(1, request.adults || 1);
  const children = Math.max(0, request.children || 0);
  const infants = Math.max(0, request.infants || 0);
  const totalPax = adults + children + infants;
  const quantity = Math.max(1, request.quantity || 1);
  const travelDate = request.travelDate || new Date().toISOString().split('T')[0];

  // 1. Determine Base Net Costs with Date-Wise & Tiered Overrides
  let baseAdultNet = product.adultNetPrice;
  let baseChildNet = product.childNetPrice !== undefined ? product.childNetPrice : product.adultNetPrice * 0.5;
  let baseInfantNet = product.infantNetPrice || 0;

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
    // ----------------------------------------------------
    // TRANSFER PRICING ENGINE: Fixed Total Vehicle Cost
    // e.g. Total Vehicle Cost = $200 regardless of 2, 4, 6 pax
    // Per-Person cost = $200 / Pax
    // ----------------------------------------------------
    const vehicleCost = product.vehicleConfig?.totalTransferCost || product.adultNetPrice || 200;
    rawTotalNetCostInNative = vehicleCost * quantity;
    adultNetInNative = rawTotalNetCostInNative;
    childNetInNative = 0;
    infantNetInNative = 0;
  } else {
    // ----------------------------------------------------
    // TOUR / ACTIVITY / TICKET PRICING ENGINE
    // Adult Net + Child Net + Infant Net
    // ----------------------------------------------------
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

  // Configurable Commercial Rates
  // Dynamic Markup %: default 25% or product markup or request override
  const defaultMarkup = product.defaultMarkupPercent || 25;
  const configuredMarkupPercent = request.customMarkupPercent !== undefined 
    ? request.customMarkupPercent 
    : (pricingTier === 'B2C' ? Math.max(defaultMarkup, 25) : 10);

  // Dynamic Tax %: default 18% or product taxPercent
  const configuredTaxPercent = product.taxPercent !== undefined ? product.taxPercent : 18;
  const taxRate = configuredTaxPercent / 100;

  // Dynamic Fee %: default 2.5% or product service fee percentage
  const configuredFeePercent = product.serviceFeeFixed > 0 ? (product.serviceFeeFixed / (totalNetCost || 1)) * 100 : 2.5;
  const feeRate = configuredFeePercent / 100;

  // ----------------------------------------------------
  // FORMULA SPEC:
  // Net Cost = Adult Cost + Child Cost + Infant Cost
  // Markup = Net Cost * Markup %
  // Tax = Net Cost * Tax %
  // Fee = Net Cost * Fee %
  // Selling Price = Net Cost + Markup + Tax + Fee
  // ----------------------------------------------------
  let markupRate = configuredMarkupPercent / 100;
  let markupAmount = totalNetCost * markupRate;
  let taxAmount = totalNetCost * taxRate;
  let serviceFee = totalNetCost * feeRate;

  // Discounts & Commissions
  const discountPercent = request.customDiscountPercent || 0;
  const discountRate = discountPercent / 100;
  const discountAmount = (totalNetCost + markupAmount + taxAmount + serviceFee) * discountRate;

  const commissionPercent = product.commissionPercent || 0;
  const commissionRate = commissionPercent / 100;
  const commissionAmount = totalNetCost * commissionRate;

  let b2bWholesaleMarkupRate = 0.10;
  let b2bWholesaleNetToAgent = totalNetCost + (totalNetCost * 0.10);
  let agentClientMarkupRate = (request.agentClientMarkupPercent || 12) / 100;
  let agentProfitAmount = b2bWholesaleNetToAgent * agentClientMarkupRate;

  if (pricingTier === 'B2B') {
    const wholesaleMarginPercent = request.customMarkupPercent !== undefined ? request.customMarkupPercent : 10;
    b2bWholesaleMarkupRate = wholesaleMarginPercent / 100;
    const dmcWholesaleMarginAmount = totalNetCost * b2bWholesaleMarkupRate;
    b2bWholesaleNetToAgent = totalNetCost + dmcWholesaleMarginAmount;

    agentProfitAmount = b2bWholesaleNetToAgent * agentClientMarkupRate;
    markupAmount = dmcWholesaleMarginAmount + agentProfitAmount;
    markupRate = totalNetCost > 0 ? markupAmount / totalNetCost : 0;
  }

  const grossBeforeTax = totalNetCost + markupAmount;
  const finalTotalSellingPrice = (totalNetCost + markupAmount + taxAmount + serviceFee) - discountAmount;

  const dmcMarginAmount = markupAmount + serviceFee - discountAmount;
  const dmcMarginPercent = totalNetCost > 0 ? (dmcMarginAmount / totalNetCost) * 100 : 0;

  // Per Person Selling Cost (For transfers, divides fixed vehicle selling price by total pax)
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
