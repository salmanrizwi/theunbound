import { 
  Quotation, 
  QuotationOption, 
  QuoteVersionRecord,
  TripRouteHub, 
  Product, 
  QuoteItem, 
  Booking, 
  PricingCalculationResult, 
  AgentPricingResponse,
  B2BPackage
} from '../types';
import { formatCurrency, roundCurrencyAmount, calculateQuoteTotal } from '../services/pricingEngine';
import { doesHotelItemBelongToHubOccurrence } from './hubStayMatching';

export interface CustomerSanitizedQuote {
  quoteId: string;
  clientName: string;
  destinationSummary: string;
  travelDates: string;
  passengerSummary: string;
  tripDuration: string;
  nightsCount: number;
  daysCount: number;
  selectedOptionTitle?: string;
  selectedOptionNumber?: number;
  hotelsSummary: string[];
  experiencesSummary: string[];
  transfersSummary: string[];
  visaSummary?: string;
  otherServicesSummary: string[];
  finalSellingPrice: number;
  formattedSellingPrice: string;
  currency: string;
  validUntil?: string;
  senderName: string;
  senderAgency?: string;
  senderContact?: string;
}

/**
 * Format passenger breakdown into an elegant, human-readable string.
 * Never exposes internal passenger IDs, supplier codes, or base rates.
 */
export function formatPassengerSummary(quote: Quotation): string {
  const parts: string[] = [];
  const adults = quote.adultsCount || quote.passengerBreakdown?.adults || 2;
  const children = quote.childrenCount || quote.passengerBreakdown?.cnb || quote.passengerBreakdown?.cwb || 0;
  const infants = quote.infantsCount || quote.passengerBreakdown?.infants || 0;

  if (adults > 0) {
    parts.push(`${adults} ${adults === 1 ? 'Adult' : 'Adults'}`);
  }

  if (children > 0) {
    if (quote.childAges && quote.childAges.length > 0) {
      const agesText = quote.childAges.map(a => `${a}y`).join(', ');
      parts.push(`${children} ${children === 1 ? 'Child' : 'Children'} (Age: ${agesText})`);
    } else {
      parts.push(`${children} ${children === 1 ? 'Child' : 'Children'}`);
    }
  }

  if (infants > 0) {
    parts.push(`${infants} ${infants === 1 ? 'Infant' : 'Infants'}`);
  }

  return parts.length > 0 ? parts.join(' + ') : '2 Adults';
}

/**
 * Format multi-city or single-destination route summary without exposing internal hub IDs.
 * Example: "Tokyo (3 Nights) → Kyoto (2 Nights) → Osaka (2 Nights)"
 */
export function formatDestinationSummary(quote: Quotation): string {
  if (quote.routeHubs && quote.routeHubs.length > 0) {
    // Unique ordered hubs
    const hubParts = quote.routeHubs.map((h: TripRouteHub) => {
      const name = h.hubName || h.destinationName || 'City';
      const nights = h.nights || 1;
      return `${name} (${nights} ${nights === 1 ? 'Night' : 'Nights'})`;
    });
    return hubParts.join(' → ');
  }

  // Fallback: extract distinct cities from items
  const cities: string[] = [];
  (quote.items || []).forEach(it => {
    const city = it.product?.city || it.product?.destinationName;
    if (city && !cities.includes(city)) {
      cities.push(city);
    }
  });

  if (cities.length > 1) {
    return cities.join(' → ');
  }

  return quote.destination || 'Japan';
}

/**
 * Format travel dates cleanly (e.g., "15 Oct 2026 – 24 Oct 2026" or YYYY-MM-DD).
 */
export function formatTravelDates(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return 'Flexible Travel Dates';
  if (startDate && !endDate) return `Starting from ${startDate}`;
  if (!startDate && endDate) return `Until ${endDate}`;

  try {
    const sDate = new Date(startDate!);
    const eDate = new Date(endDate!);
    if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      return `${sDate.toLocaleDateString('en-US', options)} – ${eDate.toLocaleDateString('en-US', options)}`;
    }
  } catch {
    // Fallback to raw string
  }
  return `${startDate} – ${endDate}`;
}

/**
 * Sanitizes a Quotation object into a pure, customer-facing representation.
 * STRICT SECURITY: Completely strips all commercial fields (nett costs, markups, margins, supplier codes).
 */
export function sanitizeQuoteForCustomer(
  quote: Quotation,
  selectedOptionIndexOrId?: number | string,
  userOverrideBranding?: { name?: string; agency?: string; phone?: string; email?: string }
): CustomerSanitizedQuote {
  // Determine if a specific option is selected
  let activeOption: QuotationOption | undefined = undefined;
  let selectedOptionTitle: string | undefined = undefined;
  let selectedOptionNumber: number | undefined = undefined;

  if (quote.options && quote.options.length > 0) {
    if (typeof selectedOptionIndexOrId === 'number') {
      activeOption = quote.options[selectedOptionIndexOrId] || quote.options[0];
      selectedOptionNumber = selectedOptionIndexOrId + 1;
      selectedOptionTitle = activeOption?.title || `Option ${selectedOptionNumber}`;
    } else if (typeof selectedOptionIndexOrId === 'string') {
      const foundIdx = quote.options.findIndex(o => o.id === selectedOptionIndexOrId);
      if (foundIdx >= 0) {
        activeOption = quote.options[foundIdx];
        selectedOptionNumber = foundIdx + 1;
        selectedOptionTitle = activeOption.title || `Option ${foundIdx + 1}`;
      }
    } else if (quote.activeOptionId) {
      const foundIdx = quote.options.findIndex(o => o.id === quote.activeOptionId);
      if (foundIdx >= 0) {
        activeOption = quote.options[foundIdx];
        selectedOptionNumber = foundIdx + 1;
        selectedOptionTitle = activeOption.title || `Option ${foundIdx + 1}`;
      }
    }
  }

  // Authoritative Final Selling Price via central pricing engine
  const centralTotals = calculateQuoteTotal(quote, activeOption?.id, undefined, quote.currency);
  const finalPrice = roundCurrencyAmount(
    centralTotals.finalCustomerSellingPrice > 0
      ? centralTotals.finalCustomerSellingPrice
      : ((selectedOptionIndexOrId === undefined && (quote.finalCustomerSellingPrice ?? quote.final_customer_selling_price) !== undefined)
          ? (quote.finalCustomerSellingPrice ?? quote.final_customer_selling_price)!
          : (activeOption?.totalSellingPrice !== undefined
              ? activeOption.totalSellingPrice
              : (quote.finalCustomerSellingPrice ?? quote.final_customer_selling_price ?? quote.totalSellingPrice ?? 0))),
    quote.currency
  );

  // Nights and Days
  let nightsCount = 1;
  if (quote.routeHubs && quote.routeHubs.length > 0) {
    nightsCount = quote.routeHubs.reduce((acc, h) => acc + (h.nights || 0), 0);
  } else if (quote.travelStartDate && quote.travelEndDate) {
    const s = new Date(quote.travelStartDate).getTime();
    const e = new Date(quote.travelEndDate).getTime();
    if (!isNaN(s) && !isNaN(e) && e > s) {
      nightsCount = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
    }
  }
  const daysCount = nightsCount + 1;
  const tripDuration = `${nightsCount} ${nightsCount === 1 ? 'Night' : 'Nights'} / ${daysCount} ${daysCount === 1 ? 'Day' : 'Days'}`;

  // Customer Name
  const clientName = (quote.clientName && quote.clientName !== 'Client Name Pending')
    ? quote.clientName.trim()
    : 'Valued Guest';

  // Accommodation Summary
  const effectiveScope = activeOption?.scope || quote.scope || 'FULL_PACKAGE';
  const isLandOnly = effectiveScope === 'LAND_ONLY';
  const effectiveHubs = activeOption?.routeHubs || quote.routeHubs || [];
  const effectiveItems = activeOption?.items || quote.items || [];

  const hotelsSummary: string[] = [];
  if (!isLandOnly && effectiveHubs.length > 0) {
    const sortedHubs = [...effectiveHubs].sort((a, b) => (a.order || 0) - (b.order || 0));
    sortedHubs.forEach(h => {
      const isHubNoAcc = h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none';
      if (isHubNoAcc) return;
      const matchedItem = effectiveItems.find(it =>
        doesHotelItemBelongToHubOccurrence(it, h, sortedHubs)
      );
      if (matchedItem || h.hotelId || h.manualHotel?.hotelName) {
        const city = h.hubName || h.destinationName || 'City';
        const hotelName =
          h.manualHotel?.hotelName ||
          matchedItem?.manualHotelDetails?.hotelName ||
          matchedItem?.product?.name ||
          h.hotelId ||
          'Premium Selected Hotel';
        const nights = h.nights || 1;
        const roomType = h.roomConfiguration?.roomTypeName || h.manualHotel?.roomType || '';
        const mealPlan = h.roomConfiguration?.mealPlanName || h.manualHotel?.mealPlanName || h.manualHotel?.mealPlan || '';
        
        let desc = `${city} — ${hotelName} (${nights} ${nights === 1 ? 'Night' : 'Nights'}`;
        if (roomType) desc += `, ${roomType}`;
        if (mealPlan) desc += `, ${mealPlan}`;
        desc += ')';
        hotelsSummary.push(desc);
      }
    });
  }

  // If no routeHubs accommodation, inspect items
  if (!isLandOnly && hotelsSummary.length === 0) {
    effectiveItems.forEach(it => {
      if (it.isNoAccommodation || (it as any).accommodationType === 'NO_ACCOMMODATION' || (it as any).accommodationType === 'none') return;
      const p = it.product;
      if (p?.productType === 'HOTEL' || it.isManualHotel) {
        const city = p?.city || p?.destinationName || 'Destination';
        const name = it.manualHotelDetails?.hotelName || p?.name || 'Vetted Hotel Stay';
        hotelsSummary.push(`${city} — ${name}`);
      }
    });
  }

  // Experiences & Activities
  const experiencesSummary: string[] = [];
  (quote.items || []).forEach(it => {
    const p = it.product;
    const cat = (p?.category as string) || '';
    if (p?.productType === 'ACTIVITY' || p?.productType === 'TOUR' || p?.productType === 'DAY_TOUR' || p?.productType === 'EXPERIENCE' || cat === 'Activities' || cat === 'Private Tours' || cat === 'Day Trips' || cat === 'Tours') {
      const name = p?.name || 'Curated Sightseeing Experience';
      if (!experiencesSummary.includes(name)) {
        experiencesSummary.push(name);
      }
    }
  });

  // Transfers
  const transfersSummary: string[] = [];
  (quote.items || []).forEach(it => {
    const p = it.product;
    const cat = (p?.category as string) || '';
    if (p?.productType === 'TRANSFER' || cat === 'Transfers' || cat === 'Transport') {
      const name = p?.name || 'Private Airport / Intercity Transfer';
      if (!transfersSummary.includes(name)) {
        transfersSummary.push(name);
      }
    }
  });

  // Visa
  let visaSummary: string | undefined = undefined;
  if (quote.visaAssistanceChoice === 'YES') {
    visaSummary = `Included (${quote.destination} Visa Processing Support & Documentation)`;
  } else {
    // Check if visa item exists
    const visaItem = (quote.items || []).find(it => {
      const cat = (it.product?.category as string) || '';
      return it.product?.productType === 'VISA' || cat === 'Travel Services';
    });
    if (visaItem) {
      visaSummary = `Included (${visaItem.product.name})`;
    }
  }

  // Other Services (eSIM, Insurance, Guides, Addons)
  const otherServicesSummary: string[] = [];
  (quote.items || []).forEach(it => {
    const p = it.product;
    if (p?.productType === 'INSURANCE' || p?.productType === 'SERVICE' || p?.productType === 'ESIM') {
      otherServicesSummary.push(p.name);
    }
    // Also include selected addons if any
    if (it.selectedAddonIds && it.selectedAddonIds.length > 0 && p?.addons) {
      p.addons.forEach(ad => {
        if (it.selectedAddonIds.includes(ad.id) && !otherServicesSummary.includes(ad.name)) {
          otherServicesSummary.push(ad.name);
        }
      });
    }
  });

  // Format valid until date
  let validUntil: string | undefined = undefined;
  if (quote.validUntil) {
    try {
      const vDate = new Date(quote.validUntil);
      if (!isNaN(vDate.getTime())) {
        validUntil = vDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch {
      validUntil = quote.validUntil;
    }
  }

  // Sender details
  const senderName = userOverrideBranding?.name || quote.agentName || 'Travel Consultant';
  const senderAgency = userOverrideBranding?.agency || quote.agentAgency || quote.agentCompany || 'Ground Operations Desk';
  const senderContact = userOverrideBranding?.phone || userOverrideBranding?.email || quote.agentPhone || quote.agentEmail || '';

  return {
    quoteId: quote.quoteNumber || quote.id,
    clientName,
    destinationSummary: formatDestinationSummary(quote),
    travelDates: formatTravelDates(quote.travelStartDate, quote.travelEndDate),
    passengerSummary: formatPassengerSummary(quote),
    tripDuration,
    nightsCount,
    daysCount,
    selectedOptionTitle,
    selectedOptionNumber,
    hotelsSummary,
    experiencesSummary,
    transfersSummary,
    visaSummary,
    otherServicesSummary,
    finalSellingPrice: finalPrice,
    formattedSellingPrice: formatCurrency(finalPrice, quote.currency || 'USD'),
    currency: quote.currency || 'USD',
    validUntil,
    senderName,
    senderAgency,
    senderContact
  };
}

/**
 * Defensive Banned Words Detector:
 * Ensures NO internal commercial terms appear in the generated customer message.
 */
const BANNED_COMMERCIAL_TERMS = [
  'nett',
  'net cost',
  'net price',
  'supplier cost',
  'supplier rate',
  'base cost',
  'markup',
  'margin',
  'profit',
  'commission',
  'wholesale',
  'internal fee',
  'agent margin',
  'internal discount',
  'tax breakdown',
  'suggested selling price',
  'suggested selling',
  'suggested price',
  'recommended price',
  'recommended rate',
  'estimated price',
  'approximate price',
  'indicative price',
  'indicative rate',
  'ai suggested',
  'ai recommended',
  'b2b net',
  'wholesale tariff',
  'client rate',
  'cost before markup',
  'internal pricing',
  'rate per person',
  'rate per traveler',
  'price per person',
  'price per traveler',
  'unit price',
  'unit cost',
  'itemized price'
];

export function verifyNoCommercialLeak(message: string): { isSafe: boolean; detectedTerms: string[] } {
  const lower = (message || '').toLowerCase();
  const detectedTerms: string[] = [];

  BANNED_COMMERCIAL_TERMS.forEach(term => {
    // Check if the term exists as a distinct word/phrase
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(lower)) {
      detectedTerms.push(term);
    }
  });

  return {
    isSafe: detectedTerms.length === 0,
    detectedTerms
  };
}

/**
 * Sanitizes a full PricingCalculationResult into an AgentPricingResponse.
 * STRICT SECURITY: Completely strips all nett prices, wholesale markups,
 * supplier costs, DMC margins, and vehicle net cost breakdowns.
 */
export function sanitizePricingResultForAgent(
  calc: PricingCalculationResult | AgentPricingResponse
): AgentPricingResponse {
  if (!calc) {
    return {
      productId: '',
      productName: '',
      pricingTier: 'B2B',
      pax: { adults: 1, children: 0, infants: 0, totalPax: 1 },
      travelDate: '',
      currency: 'USD',
      adultsSubtotalSelling: 0,
      childrenSubtotalSelling: 0,
      infantsSubtotalSelling: 0,
      addonsSubtotalSelling: 0,
      adultPricePerPax: 0,
      childPricePerPax: 0,
      price: 0,
      finalTotalSellingPrice: 0,
      sellingPriceFinal: 0,
      pricePerPerson: 0
    };
  }

  // Safe vehicle details without net costs
  let safeVehicleDetails: AgentPricingResponse['vehicleDetails'] = undefined;
  if (calc.vehicleDetails) {
    safeVehicleDetails = {
      vehicleName: calc.vehicleDetails.vehicleName,
      vehicleModel: calc.vehicleDetails.vehicleModel,
      vehicleType: calc.vehicleDetails.vehicleType,
      maxSeats: calc.vehicleDetails.maxSeats,
      occupiedSeats: calc.vehicleDetails.occupiedSeats,
      vehiclesAllocated: calc.vehicleDetails.vehiclesAllocated,
      capacityExceeded: calc.vehicleDetails.capacityExceeded,
      capacityErrorMessage: calc.vehicleDetails.capacityErrorMessage,
      seatBreakdown: calc.vehicleDetails.seatBreakdown,
      allowMultipleVehicles: calc.vehicleDetails.allowMultipleVehicles
    };
  }

  return {
    productId: calc.productId,
    productName: calc.productName,
    pricingTier: calc.pricingTier,
    pax: {
      adults: calc.pax?.adults || 0,
      children: calc.pax?.children || 0,
      infants: calc.pax?.infants || 0,
      totalPax: calc.pax?.totalPax || (calc.pax?.adults || 0) + (calc.pax?.children || 0) + (calc.pax?.infants || 0)
    },
    travelDate: calc.travelDate || '',
    currency: calc.currency || 'USD',

    // Customer-facing Selling Prices ONLY
    adultsSubtotalSelling: calc.adultsSubtotalSelling ?? 0,
    childrenSubtotalSelling: calc.childrenSubtotalSelling ?? 0,
    infantsSubtotalSelling: calc.infantsSubtotalSelling ?? 0,
    addonsSubtotalSelling: calc.addonsSubtotalSelling ?? 0,
    adultPricePerPax: calc.adultPricePerPax ?? 0,
    childPricePerPax: calc.childPricePerPax ?? 0,

    price: (calc as any).price ?? calc.finalTotalSellingPrice ?? calc.sellingPriceFinal ?? 0,
    finalTotalSellingPrice: calc.finalTotalSellingPrice ?? calc.sellingPriceFinal ?? 0,
    totalSellingPrice: (calc as any).totalSellingPrice ?? (calc as any).deliveredPrice ?? (calc as any).totalVehicleSellingPrice ?? calc.finalTotalSellingPrice ?? calc.sellingPriceFinal ?? 0,
    sellingPriceFinal: calc.sellingPriceFinal ?? calc.finalTotalSellingPrice ?? 0,
    pricePerPerson: calc.pricePerPerson ?? 0,

    taxAmount: (calc as any).taxAmount,
    serviceFee: (calc as any).serviceFee,
    discountAmount: (calc as any).discountAmount,

    isCapacityBased: calc.isCapacityBased,
    pricingMethod: calc.pricingMethod,
    vehicleDetails: safeVehicleDetails,
    ...(calc.selectedTicketTierId ? { selectedTicketTierId: calc.selectedTicketTierId } : {}),
    ...(calc.selectedTicketTierName ? { selectedTicketTierName: calc.selectedTicketTierName } : {}),
    ...(calc.selectedTicketTierDescription ? { selectedTicketTierDescription: calc.selectedTicketTierDescription } : {}),

    rateEffectiveTo: calc.rateEffectiveTo,
    isAuthoritative: calc.isAuthoritative ?? true,
    calculatedAt: calc.calculatedAt || new Date().toISOString(),

    validityCheck: (calc as PricingCalculationResult).validityCheck,
    appliedSurcharges: Array.isArray((calc as PricingCalculationResult).appliedSurcharges)
      ? (calc as PricingCalculationResult).appliedSurcharges!.map(s => {
          const cleanS = { ...s };
          delete (cleanS as any).supplierNettNative;
          delete (cleanS as any).supplierNettConverted;
          return cleanS;
        })
      : (calc as PricingCalculationResult).appliedSurcharges,
    surchargeTotal: (calc as PricingCalculationResult).surchargeTotal,
    baseSellingPriceBeforeSurcharges: (calc as PricingCalculationResult).baseSellingPriceBeforeSurcharges,
    surchargeValidationMessage: (calc as PricingCalculationResult).surchargeValidationMessage,
    fxDetails: (calc as PricingCalculationResult).fxDetails
  };
}

/**
 * Sanitizes a Product object for B2B Agents.
 * STRICT SECURITY: Removes supplier nett rates, supplier codes, and internal markups.
 */
export function sanitizeProductForAgent(product: Product): Product {
  if (!product) return product;
  const clone: Product = { ...product };
  if ((product as any).pricingTiers) {
    (clone as any).pricingTiers = { ...(product as any).pricingTiers };
  }

  delete (clone as any).adultNetPrice;
  delete (clone as any).adultNettCost;
  delete (clone as any).childNetPrice;
  delete (clone as any).childNettCost;
  delete (clone as any).infantNetPrice;
  delete (clone as any).infantNettCost;
  delete (clone as any).internalNettCost;
  delete (clone as any).internalNetCost;
  delete (clone as any).supplierCost;
  delete (clone as any).totalNetCost;
  delete (clone as any).netCost;
  delete (clone as any).costPrice;
  delete (clone as any).unitNetPrice;
  delete (clone as any).defaultMarkupPercent;
  delete (clone as any).b2bAgentMarkupPercent;
  delete (clone as any).buyerMarkupPercent;
  delete (clone as any).b2bMargin;
  delete (clone as any).marginType;
  delete (clone as any).marginFixed;
  delete (clone as any).commissionPercent;
  delete (clone as any).marginStatus;
  delete (clone as any).marginConfigVersion;
  delete (clone as any).marginUpdatedAt;
  delete (clone as any).marginUpdatedBy;
  delete (clone as any).marginUpdatedByName;
  delete (clone as any).marginUpdatedByEmail;
  delete (clone as any).marginLastChangeReason;
  delete (clone as any).marginConfig;
  delete (clone as any).supplierProductCode;
  delete (clone as any).supplierId;
  delete (clone as any).supplierName;
  delete (clone as any).supplierEmail;
  delete (clone as any).supplierPhone;
  delete (clone as any).supplierType;
  delete (clone as any).unitVehicleNetCost;
  delete (clone as any).internalNotes;

  if (clone.surcharges && Array.isArray(clone.surcharges)) {
    clone.surcharges = clone.surcharges.map(s => {
      const cleanSurcharge = { ...s };
      delete (cleanSurcharge as any).internalNotes;
      return cleanSurcharge;
    });
  }

  // Sanitize addons if present
  if (clone.addons && Array.isArray(clone.addons)) {
    clone.addons = clone.addons.map(addon => {
      const a = { ...addon };
      delete (a as any).netPrice;
      delete (a as any).costPrice;
      return a;
    });
  }

  // Ensure selling price is the visible starting price
  if ((clone as any).pricingTiers?.b2b?.adultSellingPrice) {
    (clone as any).sellingPriceStartingFrom = (clone as any).pricingTiers.b2b.adultSellingPrice;
  }

  return clone;
}

/**
 * Sanitizes an individual QuoteItem for B2B Agents.
 */
export function sanitizeQuoteItemForAgent(item: QuoteItem): QuoteItem {
  if (!item) return item;
  const clone: QuoteItem = { ...item };

  delete (clone as any).totalNetCost;
  delete (clone as any).internalNettCost;
  delete (clone as any).supplierCost;
  delete (clone as any).internalMarkup;
  delete (clone as any).internalProfit;

  if (clone.product) {
    clone.product = sanitizeProductForAgent(clone.product);
  }

  if (clone.calculation) {
    clone.calculation = sanitizePricingResultForAgent(clone.calculation);
  }

  if (clone.manualHotelDetails) {
    clone.manualHotelDetails = { ...clone.manualHotelDetails };
    delete (clone.manualHotelDetails as any).netRate;
    delete (clone.manualHotelDetails as any).costPerNight;
    delete (clone.manualHotelDetails as any).supplierCost;
    delete (clone.manualHotelDetails as any).totalNetCost;
    delete (clone.manualHotelDetails as any).netCost;
  }

  if (Array.isArray((clone as any).appliedSurcharges)) {
    (clone as any).appliedSurcharges = (clone as any).appliedSurcharges.map((s: any) => {
      if (!s) return s;
      const cleanS = { ...s };
      delete cleanS.supplierNettNative;
      delete cleanS.supplierNettConverted;
      return cleanS;
    });
  }

  // Ensure non-negative agent additional markup if present
  if (clone.agentAdditionalMarkupValue !== undefined) {
    clone.agentAdditionalMarkupValue = Math.max(0, Number(clone.agentAdditionalMarkupValue) || 0);
  }

  return clone;
}

/**
 * Sanitizes a Quotation object into a pure Agent-facing representation.
 * STRICT SECURITY:
 * - Deletes totalNetCost, totalMargin, internalNettCost, internalMarkup, agentMarkup, internalProfit.
 * - Deletes internal margin configuration (productLevelMarginEnabled, activeMarginMode, agentLevelMarginPercent, adminManualMargin*).
 * - Preserves the B2B Agent's own "Your Additional Markup" fields (theUnboundBaseSellingPrice, baseFinalSellingPrice, agentMarginType, agentMarginValue, agentMarginAmount, productLevelAgentMarkupTotal, overallAgentMarkupAmount, totalAgentAdditionalMarkupAmount, finalCustomerSellingPrice, adminBasePriceUpdatedNotification).
 */
export function sanitizeQuoteForAgent(quote: Quotation): Quotation {
  if (!quote) return quote;
  const clone: Quotation = { ...quote };
  if (quote.pricingSnapshot) clone.pricingSnapshot = { ...quote.pricingSnapshot };
  if ((quote as any).pricing_snapshot) (clone as any).pricing_snapshot = { ...(quote as any).pricing_snapshot };

  const centralTotals = calculateQuoteTotal(clone, clone.activeOptionId, undefined, clone.currency);
  const theUnboundBaseSellingPrice = roundCurrencyAmount(
    centralTotals.theUnboundBaseSellingPrice > 0
      ? centralTotals.theUnboundBaseSellingPrice
      : (clone.theUnboundBaseSellingPrice ?? clone.baseFinalSellingPrice ?? clone.base_final_selling_price ?? clone.totalSellingPrice ?? 0),
    clone.currency
  );
  const agentMarginType = clone.agentMarginType ?? clone.agent_margin_type ?? 'PERCENTAGE';
  const rawAgentMarginValue = Number(clone.agentMarginValue ?? clone.agent_margin_value ?? (clone.overallMarkupPercent ?? 0));
  const agentMarginValue = Number.isFinite(rawAgentMarginValue) && rawAgentMarginValue > 0 ? rawAgentMarginValue : 0;
  const agentMarginAmount = roundCurrencyAmount(
    centralTotals.markupAmount > 0
      ? centralTotals.markupAmount
      : (clone.agentMarginAmount ?? clone.agent_margin_amount ?? (
          agentMarginType === 'PERCENTAGE'
            ? roundCurrencyAmount(theUnboundBaseSellingPrice * (agentMarginValue / 100), clone.currency)
            : roundCurrencyAmount(agentMarginValue, clone.currency)
        )),
    clone.currency
  );
  const finalCustomerSellingPrice = roundCurrencyAmount(
    centralTotals.finalCustomerSellingPrice > 0
      ? centralTotals.finalCustomerSellingPrice
      : Math.max(theUnboundBaseSellingPrice, (clone.finalCustomerSellingPrice ?? clone.final_customer_selling_price ?? (theUnboundBaseSellingPrice + agentMarginAmount))),
    clone.currency
  );

  // Set authoritative agent-facing & customer-facing pricing fields
  clone.theUnboundBaseSellingPrice = theUnboundBaseSellingPrice;
  clone.baseFinalSellingPrice = theUnboundBaseSellingPrice;
  clone.base_final_selling_price = theUnboundBaseSellingPrice;
  clone.agentMarginType = agentMarginType;
  clone.agent_margin_type = agentMarginType;
  clone.agentMarginValue = agentMarginValue;
  clone.agent_margin_value = agentMarginValue;
  clone.agentMarginAmount = agentMarginAmount;
  clone.agent_margin_amount = agentMarginAmount;
  clone.productLevelAgentMarkupTotal = centralTotals.productLevelAgentMarkupTotal;
  clone.overallAgentMarkupAmount = centralTotals.overallAgentMarkupAmount;
  clone.totalAgentAdditionalMarkupAmount = agentMarginAmount;
  clone.finalCustomerSellingPrice = finalCustomerSellingPrice;
  clone.final_customer_selling_price = finalCustomerSellingPrice;
  clone.totalSellingPrice = finalCustomerSellingPrice;

  // Strict Security Isolation: Strip internal commercial totals, internal margin mechanisms, rates, and supplier data
  delete (clone as any).totalNetCost;
  delete (clone as any).totalMargin;
  delete (clone as any).internalNettCost;
  delete (clone as any).internalMarkup;
  delete (clone as any).agentMarkup;
  delete (clone as any).internalProfit;
  delete (clone as any).supplierCost;
  delete (clone as any).rateSnapshot;
  delete (clone as any).commercialNotes;
  delete (clone as any).operationalRemarks;
  delete (clone as any).pricingFormulas;
  delete (clone as any).supplierRates;
  delete (clone as any).adminManualMarginType;
  delete (clone as any).admin_manual_margin_type;
  delete (clone as any).adminManualMarginValue;
  delete (clone as any).admin_manual_margin_value;
  delete (clone as any).adminManualMarginAmount;
  delete (clone as any).admin_manual_margin_amount;
  delete (clone as any).adminMarginMode;
  delete (clone as any).admin_margin_mode;
  delete (clone as any).revisedSellingPrice;
  delete (clone as any).revised_selling_price;
  delete (clone as any).pricingSettings;
  delete (clone as any).productLevelMarginEnabled;
  delete (clone as any).activeMarginMode;
  delete (clone as any).agentLevelMarginPercent;
  if (clone.pricingSnapshot) {
    delete (clone.pricingSnapshot as any).adminManualMarginType;
    delete (clone.pricingSnapshot as any).adminManualMarginValue;
    delete (clone.pricingSnapshot as any).adminManualMarginAmount;
    delete (clone.pricingSnapshot as any).adminMarginMode;
    delete (clone.pricingSnapshot as any).revisedSellingPrice;
    delete (clone.pricingSnapshot as any).totalNettCost;
    clone.pricingSnapshot.theUnboundBaseSellingPrice = theUnboundBaseSellingPrice;
    clone.pricingSnapshot.baseFinalSellingPrice = theUnboundBaseSellingPrice;
    clone.pricingSnapshot.agentMarginType = agentMarginType;
    clone.pricingSnapshot.agentMarginValue = agentMarginValue;
    clone.pricingSnapshot.agentMarginAmount = agentMarginAmount;
    clone.pricingSnapshot.productLevelAgentMarkupTotal = centralTotals.productLevelAgentMarkupTotal;
    clone.pricingSnapshot.overallAgentMarkupAmount = centralTotals.overallAgentMarkupAmount;
    clone.pricingSnapshot.totalAgentAdditionalMarkupAmount = agentMarginAmount;
    clone.pricingSnapshot.finalCustomerSellingPrice = finalCustomerSellingPrice;
    clone.pricingSnapshot.totalSellingPrice = finalCustomerSellingPrice;
  }
  if ((clone as any).pricing_snapshot) {
    const pss = { ...(clone as any).pricing_snapshot };
    delete pss.adminManualMarginType;
    delete pss.adminManualMarginValue;
    delete pss.adminManualMarginAmount;
    delete pss.adminMarginMode;
    delete pss.revisedSellingPrice;
    delete pss.totalNettCost;
    delete pss.totalNetCost;
    delete pss.totalMargin;
    if (pss.currencyConversionSnapshot) {
      pss.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
        pss.currencyConversionSnapshot,
        false
      );
    }
    (clone as any).pricing_snapshot = pss;
  }

  // Sanitize items and routeHubs (strip manualHotel internal nett costs)
  if (clone.items && Array.isArray(clone.items)) {
    clone.items = clone.items.map(sanitizeQuoteItemForAgent);
  }
  if (Array.isArray(clone.routeHubs)) {
    clone.routeHubs = sanitizeRouteHubsForExternal(clone.routeHubs, false);
  }

  if (clone.currencyConversionSnapshot) {
    clone.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
      clone.currencyConversionSnapshot,
      false
    );
  }
  if (clone.pricingSnapshot?.currencyConversionSnapshot) {
    clone.pricingSnapshot.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
      clone.pricingSnapshot.currencyConversionSnapshot,
      false
    );
  }
  if (clone.authoritativeSnapshot) {
    clone.authoritativeSnapshot = sanitizeAuthoritativeSnapshotForExternal(
      clone.authoritativeSnapshot,
      false
    );
  }

  // Sanitize quotation options if present
  if (clone.options && Array.isArray(clone.options)) {
    clone.options = clone.options.map(option => {
      const optClone: QuotationOption = { ...option };
      delete (optClone as any).totalNetCost;
      delete (optClone as any).totalMargin;
      delete (optClone as any).internalNettCost;
      delete (optClone as any).internalMarkup;
      delete (optClone as any).internalProfit;
      delete (optClone as any).supplierCost;
      delete (optClone as any).agentMarkupPercent;
      if ((optClone as any).currencyConversionSnapshot) {
        (optClone as any).currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
          (optClone as any).currencyConversionSnapshot,
          false
        );
      }
      if ((optClone as any).pricingSnapshot) {
        const ops = { ...(optClone as any).pricingSnapshot };
        delete ops.adminManualMarginType;
        delete ops.adminManualMarginValue;
        delete ops.adminManualMarginAmount;
        delete ops.adminMarginMode;
        delete ops.revisedSellingPrice;
        delete ops.totalNettCost;
        delete ops.totalNetCost;
        delete ops.totalMargin;
        if (ops.currencyConversionSnapshot) {
          ops.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
            ops.currencyConversionSnapshot,
            false
          );
        }
        (optClone as any).pricingSnapshot = ops;
      }
      if (optClone.items && Array.isArray(optClone.items)) {
        optClone.items = optClone.items.map(sanitizeQuoteItemForAgent);
      }
      if (Array.isArray(optClone.routeHubs)) {
        optClone.routeHubs = sanitizeRouteHubsForExternal(optClone.routeHubs, false);
      }
      return optClone;
    });
  }

  // Sanitize versionHistory and versionSummaries snapshots so no nett costs or internal margins leak to B2B Agents
  if (Array.isArray(clone.versionHistory)) {
    clone.versionHistory = clone.versionHistory.map(sanitizeQuoteVersionForAgent);
  }
  if (Array.isArray((clone as any).versionSummaries)) {
    (clone as any).versionSummaries = (clone as any).versionSummaries.map((vs: any) => {
      if (!vs || typeof vs !== 'object') return vs;
      const cleanVs = { ...vs };
      delete cleanVs.totalNetCost;
      delete cleanVs.totalMargin;
      delete cleanVs.internalMarkup;
      delete cleanVs.adminManualMarginType;
      delete cleanVs.adminManualMarginValue;
      delete cleanVs.adminManualMarginAmount;
      delete cleanVs.adminMarginMode;
      delete cleanVs.revisedSellingPrice;
      delete cleanVs.productLevelMarginEnabled;
      delete cleanVs.activeMarginMode;
      delete cleanVs.agentLevelMarginPercent;
      return cleanVs;
    });
  }

  return clone;
}

/**
 * Strips supplier nett costs and internal margin fields from routeHubs manualHotel records.
 */
function sanitizeRouteHubsForExternal(routeHubs: any[], stripCustomerHotelPrices: boolean): any[] {
  if (!Array.isArray(routeHubs)) return routeHubs;
  return routeHubs.map((rh: any) => {
    if (!rh || typeof rh !== 'object') return rh;
    const rhClone = { ...rh };
    if (rhClone.manualHotel && typeof rhClone.manualHotel === 'object') {
      const mh = { ...rhClone.manualHotel };
      delete mh.totalNetCost;
      delete mh.netCost;
      delete mh.costPerNight;
      delete mh.netRate;
      delete mh.ratePerNightNett;
      delete mh.supplierCost;
      delete mh.internalNotes;
      delete mh.dmcMarginAmount;
      if (stripCustomerHotelPrices) {
        delete mh.ratePerNight;
        delete mh.sellingPricePerNight;
        delete mh.totalSellingPrice;
      }
      rhClone.manualHotel = mh;
    }
    return rhClone;
  });
}

/**
 * Sanitizes a QuotationCurrencySnapshot so internal nett costs, underlying base margins,
 * and Admin manual margin overrides never leak to external B2B Agents or Customers.
 */
function sanitizeCurrencyConversionSnapshotForExternal(snap: any, stripAgentFields: boolean): any {
  if (!snap || typeof snap !== 'object') return snap;
  const cleanSnap = { ...snap };
  delete cleanSnap.totalConvertedNettCost;
  delete cleanSnap.existingBaseMarginAmount;
  delete cleanSnap.manualMarginAdjustmentAmount;
  delete cleanSnap.manualMarginAdjustedTotal;
  delete cleanSnap.activeMarginMode;
  delete cleanSnap.productLevelMarginEnabled;
  delete cleanSnap.agentLevelMarginPercent;
  if (stripAgentFields) {
    delete cleanSnap.theUnboundBaseSellingPrice;
    delete cleanSnap.additionalAgentMarginAmount;
    delete cleanSnap.productLevelAgentMarkupTotal;
    delete cleanSnap.overallAgentMarkupAmount;
  }
  if (cleanSnap.totals && typeof cleanSnap.totals === 'object') {
    const cleanTotals = { ...cleanSnap.totals };
    delete cleanTotals.convertedTotalNetCost;
    delete cleanTotals.baseMarginTotal;
    delete cleanTotals.manualMarginAdjustmentMode;
    delete cleanTotals.manualMarginAdjustmentType;
    delete cleanTotals.manualMarginAdjustmentValue;
    delete cleanTotals.manualMarginAdjustmentAmount;
    delete cleanTotals.effectiveUnderlyingMarginAmount;
    if (stripAgentFields) {
      delete cleanTotals.theUnboundBaseSellingPrice;
      delete cleanTotals.b2bSellingPriceTotal;
      delete cleanTotals.additionalAgentMarginType;
      delete cleanTotals.additionalAgentMarginValue;
      delete cleanTotals.additionalAgentMarginAmount;
      delete cleanTotals.productLevelAgentMarkupTotal;
      delete cleanTotals.overallAgentMarkupAmount;
    }
    cleanSnap.totals = cleanTotals;
  }
  if (Array.isArray(cleanSnap.appliedSurcharges)) {
    cleanSnap.appliedSurcharges = cleanSnap.appliedSurcharges.map((s: any) => {
      if (!s || typeof s !== 'object') return s;
      const cleanS = { ...s };
      delete cleanS.supplierNettNative;
      delete cleanS.supplierNettConverted;
      return cleanS;
    });
  }
  if (Array.isArray(cleanSnap.lineItems)) {
    cleanSnap.lineItems = cleanSnap.lineItems.map((li: any) => {
      if (!li || typeof li !== 'object') return li;
      const cleanLi = { ...li };
      delete cleanLi.originalAmount;
      delete cleanLi.originalNetCost;
      delete cleanLi.convertedNetCost;
      delete cleanLi.baseMarginPercent;
      delete cleanLi.baseMarginAmount;
      if (Array.isArray(cleanLi.appliedSurcharges)) {
        cleanLi.appliedSurcharges = cleanLi.appliedSurcharges.map((s: any) => {
          if (!s || typeof s !== 'object') return s;
          const cs = { ...s };
          delete cs.supplierNettNative;
          delete cs.supplierNettConverted;
          return cs;
        });
      }
      if (stripAgentFields) {
        delete cleanLi.convertedBaseSellingAmount;
        delete cleanLi.finalLineSellingAmount;
        delete cleanLi.taxAmount;
        delete cleanLi.serviceFeeAmount;
        delete cleanLi.surchargeTotal;
        delete cleanLi.appliedSurcharges;
        delete cleanLi.discountAmount;
      }
      return cleanLi;
    });
  }
  return cleanSnap;
}

/**
 * Sanitizes an AuthoritativeQuotationSnapshot for external B2B Agents or Customers.
 */
function sanitizeAuthoritativeSnapshotForExternal(authSnap: any, stripAgentFields: boolean): any {
  if (!authSnap || typeof authSnap !== 'object') return authSnap;
  const cleanAuth = { ...authSnap };
  if (cleanAuth.pricing && typeof cleanAuth.pricing === 'object') {
    const cleanPricing = { ...cleanAuth.pricing };
    delete cleanPricing.adminManualMarginType;
    delete cleanPricing.adminManualMarginValue;
    delete cleanPricing.adminManualMarginAmount;
    delete cleanPricing.adminMarginMode;
    delete cleanPricing.revisedSellingPrice;
    delete cleanPricing.totalNetCost;
    delete cleanPricing.totalNettCost;
    delete cleanPricing.totalMargin;
    delete cleanPricing.activeMarginMode;
    delete cleanPricing.productLevelMarginEnabled;
    delete cleanPricing.agentLevelMarginPercent;
    if (stripAgentFields) {
      delete cleanPricing.theUnboundBaseSellingPrice;
      delete cleanPricing.baseFinalSellingPrice;
      delete cleanPricing.agentMarginType;
      delete cleanPricing.agentMarginValue;
      delete cleanPricing.agentMarginAmount;
      delete cleanPricing.productLevelAgentMarkupTotal;
      delete cleanPricing.overallAgentMarkupAmount;
      delete cleanPricing.totalAgentAdditionalMarkupAmount;
    }
    if (cleanPricing.currencyConversionSnapshot) {
      cleanPricing.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
        cleanPricing.currencyConversionSnapshot,
        stripAgentFields
      );
    }
    cleanAuth.pricing = cleanPricing;
  }
  if (cleanAuth.trip && typeof cleanAuth.trip === 'object') {
    const cleanTrip = { ...cleanAuth.trip };
    if (Array.isArray(cleanTrip.routeHubs)) {
      cleanTrip.routeHubs = sanitizeRouteHubsForExternal(cleanTrip.routeHubs, stripAgentFields);
    }
    cleanAuth.trip = cleanTrip;
  }
  return cleanAuth;
}

/**
 * Sanitizes a historical QuoteVersionRecord snapshot for B2B Agents & non-internal users.
 * Strictly removes supplier nett costs, internal DMC margins, and admin manual margin overrides
 * while preserving historical selling prices, items, hubs, itinerary, terms, and agent markup.
 */
export function sanitizeQuoteVersionForAgent(v: QuoteVersionRecord): QuoteVersionRecord {
  if (!v) return v;
  const vClone: QuoteVersionRecord = { ...v };
  delete (vClone as any).totalNetCost;
  delete (vClone as any).marginPercent;
  delete (vClone as any).marginAmount;
  delete (vClone as any).internalNettCost;
  delete (vClone as any).supplierCost;
  delete (vClone as any).internalMarkup;
  delete (vClone as any).internalProfit;
  delete (vClone as any).adminManualMarginType;
  delete (vClone as any).adminManualMarginValue;
  delete (vClone as any).adminManualMarginAmount;
  delete (vClone as any).adminManualMarginMode;
  delete (vClone as any).adminMarginMode;
  delete (vClone as any).revisedSellingPrice;
  delete (vClone as any).dmcMarginAmount;
  delete (vClone as any).productLevelMarginEnabled;
  delete (vClone as any).activeMarginMode;
  delete (vClone as any).agentLevelMarginPercent;

  if (vClone.pricingSnapshot) {
    const ps = { ...vClone.pricingSnapshot };
    delete (ps as any).adminManualMarginType;
    delete (ps as any).adminManualMarginValue;
    delete (ps as any).adminManualMarginAmount;
    delete (ps as any).adminMarginMode;
    delete (ps as any).revisedSellingPrice;
    delete (ps as any).totalNettCost;
    delete (ps as any).totalNetCost;
    delete (ps as any).totalMargin;
    delete (ps as any).productLevelMarginEnabled;
    delete (ps as any).activeMarginMode;
    delete (ps as any).agentLevelMarginPercent;
    if (ps.currencyConversionSnapshot) {
      ps.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
        ps.currencyConversionSnapshot,
        false
      );
    }
    vClone.pricingSnapshot = ps;
  }

  if (vClone.currencyConversionSnapshot) {
    vClone.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
      vClone.currencyConversionSnapshot,
      false
    );
  }

  if (vClone.authoritativeSnapshot) {
    vClone.authoritativeSnapshot = sanitizeAuthoritativeSnapshotForExternal(
      vClone.authoritativeSnapshot,
      false
    );
  }

  if (Array.isArray(vClone.items)) {
    vClone.items = vClone.items.map(sanitizeQuoteItemForAgent);
  }
  if (Array.isArray(vClone.routeHubs)) {
    vClone.routeHubs = sanitizeRouteHubsForExternal(vClone.routeHubs, false);
  }

  if (Array.isArray(vClone.options)) {
    vClone.options = vClone.options.map(option => {
      const optClone: QuotationOption = { ...option };
      delete (optClone as any).totalNetCost;
      delete (optClone as any).totalMargin;
      delete (optClone as any).internalNettCost;
      delete (optClone as any).internalMarkup;
      delete (optClone as any).internalProfit;
      delete (optClone as any).supplierCost;
      if (Array.isArray(optClone.items)) {
        optClone.items = optClone.items.map(sanitizeQuoteItemForAgent);
      }
      if (Array.isArray(optClone.routeHubs)) {
        optClone.routeHubs = sanitizeRouteHubsForExternal(optClone.routeHubs, false);
      }
      return optClone;
    });
  }

  return vClone;
}

/**
 * Sanitizes a Booking object for B2B Agents.
 * STRICT SECURITY:
 * - Strips all totalNetCost, grossProfit, grossMarginPercent, internalNettCost, supplier allocations.
 * - Strips all supplier identities, supplier contact details, supplier confirmation refs, and nett costs from items.
 * - Strips all internal notes, internal tasks, internal audits, and supplier invoices.
 * - Locks submitted bookings into a hermetic read-only representation.
 * - Returns strictly final selling prices and customer-facing data.
 */
export function sanitizeBookingForAgent(b: Booking): Booking {
  if (!b) return b;
  const clone: Booking = { ...b };

  delete clone.totalNetCost;
  delete clone.grossProfit;
  delete clone.grossMarginPercent;
  delete (clone as any).internalNettCost;
  delete (clone as any).internalMarkup;
  delete (clone as any).agentMarkup;
  delete (clone as any).internalProfit;
  delete (clone as any).adminMarkup;
  delete (clone as any).supplierCost;
  delete (clone as any).supplierTotalCost;
  delete clone.supplierAllocations;
  delete clone.consolidatedAllocations;
  delete clone.supplierRequests;
  delete clone.operationalConfirmationOverride;
  delete (clone as any).internalNotes;
  delete (clone as any).internalNotesList;
  delete (clone as any).notesList;
  delete (clone as any).internalTasks;
  delete (clone as any).deskHandler;
  delete (clone as any).groundDispatch;
  delete (clone as any).dispatchDesk;
  delete clone.assignmentHistory;
  delete clone.assignmentNotes;

  // Strictly strip Admin Manual Discount internal margins, funding sources, reasons, and snapshot history.
  // B2B Agents & customer-facing documents MUST ONLY see the revised customer-facing selling price.
  delete clone.originalTheUnboundMargin;
  delete clone.remainingTheUnboundMargin;
  delete clone.adminManualDiscountTotal;
  delete clone.manualDiscountAdjustments;
  delete clone.pricingSnapshotHistory;
  delete clone.currentPricingSnapshotId;
  delete clone.currentPricingSnapshotVersion;
  delete clone.revisedPricingNotice;
  delete clone.revisedPricingVersion;
  delete clone.hasRevisedPricingAfterInvoice;

  // Ensure external customer-facing totalAmount matches the committed revised selling price
  if (typeof clone.finalCustomerSellingPrice === 'number' && Number.isFinite(clone.finalCustomerSellingPrice)) {
    clone.totalAmount = clone.finalCustomerSellingPrice;
  }

  // Strips internal invoices
  clone.uploadedInvoices = [];

  if (clone.items && Array.isArray(clone.items)) {
    clone.items = clone.items.map(rawIt => {
      const it = { ...rawIt };
      // Eliminate supplier identity and contacts
      delete it.supplierId;
      delete it.supplierName;
      delete it.supplierNameSnapshot;
      delete it.supplierContact;
      delete it.supplierPhone;
      delete it.supplierEmail;
      delete it.supplierAllocationStatus;
      delete it.supplierAllocatedAt;
      delete it.supplierAllocatedBy;
      delete it.allocationHistory;
      delete it.consolidatedAllocationId;
      delete it.allocationMethod;
      delete (it as any).allocatedSupplierId;
      delete (it as any).allocatedSupplierName;
      delete (it as any).supplierAllocated;
      delete (it as any).supplierStatus;
      delete (it as any).supplierVoucherStatus;
      delete (it as any).supplierInvoiceStatus;
      delete (it as any).supplierConfirmationRef;
      delete (it as any).supplierConfirmationStatus;
      delete (it as any).supplierReferenceNumber;
      delete (it as any).allocatedCost;

      // Eliminate supplier pricing, net costs, and allocated commercial prices
      delete it.netPrice;
      delete it.allocatedCommercialPrice;
      delete it.supplierPrice;
      delete it.supplierCurrency;
      delete it.supplierPriceType;
      delete it.supplierAdultPrice;
      delete it.supplierChildPrice;
      delete it.supplierInfantPrice;
      delete it.supplierQuantity;
      delete it.supplierTaxAmount;
      delete it.supplierAdditionalFees;
      delete it.supplierDiscount;
      delete it.supplierTotalCost;
      delete it.supplierPricingNotes;
      delete it.supplierPriceLastUpdatedAt;
      delete it.supplierPriceLastUpdatedBy;
      delete it.supplierPriceChangeReason;
      delete it.supplierPriceVersion;
      delete it.supplierPriceHistory;
      delete it.supplierPriceTax;
      delete it.supplierPriceFee;
      delete it.supplierPriceDiscount;
      delete it.supplierPaymentCutoffDate;
      delete it.supplierCancellationDeadline;
      delete it.supplierPriceValidityDate;
      delete it.supplierPriceSource;
      delete it.internalPricingNotes;
      delete it.internalNotes;
      delete it.internalOpsNotes;
      delete it.unitNetPrice;
      delete (it as any).costPrice;
      delete (it as any).netCost;
      delete (it as any).marginAmount;
      delete (it as any).marginPercent;
      return it;
    });
  }

  // Filter audit logs & timeline to strictly non-internal updates
  if (clone.timeline && Array.isArray(clone.timeline)) {
    clone.timeline = clone.timeline.filter((e: any) => 
      !e.internalOnly && !e.isInternal && e.type !== 'SUPPLIER_ACTION' && e.type !== 'INTERNAL_NOTE'
    );
  }

  // Set read-only flags for submitted bookings
  const isSubmitted = clone.status !== 'DRAFT';
  (clone as any).isSubmitted = isSubmitted;
  (clone as any).isReadOnly = isSubmitted;
  (clone as any).submissionLockMessage = 'This booking has been submitted and is now read-only. Please contact the internal team if a correction is required.';

  return clone;
}

/**
 * Sanitizes a Quotation object into a pure customer-facing Quotation document.
 * MANDATE (Price Confidentiality):
 * - Authoritative Final Total Selling Price ONLY.
 * - Strips all item-level, service-level, and product-level pricing calculations.
 * - Items retain full names, descriptions, dates, and inclusions.
 * - Strips all internal nett costs, supplier rates, markups, and margins.
 */
export function sanitizeQuoteDocumentForCustomer(quote: Quotation): Quotation {
  if (!quote) return quote;
  const clone: Quotation = sanitizeQuoteForAgent(quote);

  // Authoritative single final price
  const finalPrice = clone.finalCustomerSellingPrice ?? (clone as any).final_customer_selling_price ?? clone.totalSellingPrice;
  clone.totalSellingPrice = finalPrice;
  clone.finalCustomerSellingPrice = finalPrice;
  (clone as any).final_customer_selling_price = finalPrice;

  // Strip all agent markup & base selling price fields from end-customer document
  delete (clone as any).theUnboundBaseSellingPrice;
  delete (clone as any).baseFinalSellingPrice;
  delete (clone as any).base_final_selling_price;
  delete (clone as any).baseFinalSellingPriceCurrency;
  delete (clone as any).base_final_selling_price_currency;
  delete (clone as any).agentMarginType;
  delete (clone as any).agent_margin_type;
  delete (clone as any).agentMarginValue;
  delete (clone as any).agent_margin_value;
  delete (clone as any).agentMarginAmount;
  delete (clone as any).agent_margin_amount;
  delete (clone as any).productLevelAgentMarkupTotal;
  delete (clone as any).overallAgentMarkupAmount;
  delete (clone as any).totalAgentAdditionalMarkupAmount;
  delete (clone as any).overallMarkupPercent;
  delete (clone as any).adminBasePriceUpdatedNotification;
  if (clone.pricingSnapshot) {
    delete (clone.pricingSnapshot as any).theUnboundBaseSellingPrice;
    delete (clone.pricingSnapshot as any).baseFinalSellingPrice;
    delete (clone.pricingSnapshot as any).agentMarginType;
    delete (clone.pricingSnapshot as any).agentMarginValue;
    delete (clone.pricingSnapshot as any).agentMarginAmount;
    delete (clone.pricingSnapshot as any).productLevelAgentMarkupTotal;
    delete (clone.pricingSnapshot as any).overallAgentMarkupAmount;
    delete (clone.pricingSnapshot as any).totalAgentAdditionalMarkupAmount;
    delete (clone.pricingSnapshot as any).overallMarkupPercent;
    delete (clone.pricingSnapshot as any).adminBasePriceUpdatedNotification;
    if (clone.pricingSnapshot.currencyConversionSnapshot) {
      clone.pricingSnapshot.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
        clone.pricingSnapshot.currencyConversionSnapshot,
        true
      );
    }
  }
  if ((clone as any).pricing_snapshot?.currencyConversionSnapshot) {
    (clone as any).pricing_snapshot = {
      ...(clone as any).pricing_snapshot,
      currencyConversionSnapshot: sanitizeCurrencyConversionSnapshotForExternal(
        (clone as any).pricing_snapshot.currencyConversionSnapshot,
        true
      )
    };
  }
  if (clone.currencyConversionSnapshot) {
    clone.currencyConversionSnapshot = sanitizeCurrencyConversionSnapshotForExternal(
      clone.currencyConversionSnapshot,
      true
    );
  }
  if (clone.authoritativeSnapshot) {
    clone.authoritativeSnapshot = sanitizeAuthoritativeSnapshotForExternal(
      clone.authoritativeSnapshot,
      true
    );
  }
  if (Array.isArray(clone.routeHubs)) {
    clone.routeHubs = sanitizeRouteHubsForExternal(clone.routeHubs, true);
  }

  // Sanitize items so no item-level pricing or calculations leak
  if (clone.items && Array.isArray(clone.items)) {
    clone.items = clone.items.map(it => {
      const itClone: QuoteItem = { ...it };
      delete (itClone as any).calculation;
      delete (itClone as any).price;
      delete (itClone as any).totalSellingPrice;
      delete (itClone as any).finalTotalSellingPrice;
      delete (itClone as any).sellingPriceFinal;
      delete (itClone as any).unitSellingPrice;
      delete (itClone as any).theUnboundBaseSellingPrice;
      delete (itClone as any).agentAdditionalMarkupType;
      delete (itClone as any).agentAdditionalMarkupValue;
      delete (itClone as any).agentAdditionalMarkupAmount;
      delete (itClone as any).finalCustomerSellingPrice;
      if (itClone.manualHotelDetails) {
        itClone.manualHotelDetails = { ...itClone.manualHotelDetails };
        delete (itClone.manualHotelDetails as any).costPerNight;
        delete (itClone.manualHotelDetails as any).sellingPrice;
        delete (itClone.manualHotelDetails as any).totalSellingPrice;
      }
      return itClone;
    });
  }

  // Sanitize options if present
  if (clone.options && Array.isArray(clone.options)) {
    clone.options = clone.options.map(option => {
      const optClone: QuotationOption = { ...option };
      if (optClone.items && Array.isArray(optClone.items)) {
        optClone.items = optClone.items.map(it => {
          const itClone: QuoteItem = { ...it };
          delete (itClone as any).calculation;
          delete (itClone as any).price;
          delete (itClone as any).totalSellingPrice;
          delete (itClone as any).finalTotalSellingPrice;
          delete (itClone as any).sellingPriceFinal;
          delete (itClone as any).unitSellingPrice;
          delete (itClone as any).theUnboundBaseSellingPrice;
          delete (itClone as any).agentAdditionalMarkupType;
          delete (itClone as any).agentAdditionalMarkupValue;
          delete (itClone as any).agentAdditionalMarkupAmount;
          delete (itClone as any).finalCustomerSellingPrice;
          return itClone;
        });
      }
      return optClone;
    });
  }

  return clone;
}

/**
 * Strips confidential supplier nett costs, wholesale nett baselines, internal margin percentages,
 * and commercial audit records from a Ready-Made Package record before returning to B2B Agents or public viewers.
 */
export function sanitizePackageForAgent(pkg: B2BPackage): B2BPackage {
  if (!pkg) return pkg;
  const clone: B2BPackage = { ...pkg };

  // Strip top-level nett costs
  delete (clone as any).baseNetCostUSD;
  delete (clone as any).internalCostBreakdown;
  delete (clone as any).supplierCosts;

  // Sanitize pricingConfiguration to remove manual markups and nett base costs
  if (clone.pricingConfiguration) {
    clone.pricingConfiguration = { ...clone.pricingConfiguration };
    delete (clone.pricingConfiguration as any).baseNetCostUSD;
    delete (clone.pricingConfiguration as any).b2bMarkupPercent;
    delete (clone.pricingConfiguration as any).buyerMarkupPercent;
  }

  // Sanitize manual hotels if any
  if (Array.isArray(clone.manualHotels)) {
    clone.manualHotels = clone.manualHotels.map(mh => {
      const mhClone = { ...mh };
      delete (mhClone as any).ratePerNight;
      delete (mhClone as any).netCost;
      delete (mhClone as any).totalSellingPrice;
      delete (mhClone as any).costPerNight;
      return mhClone;
    });
  }

  // Sanitize routeHubs manual hotels
  if (Array.isArray(clone.routeHubs)) {
    clone.routeHubs = clone.routeHubs.map(rh => {
      const rhClone = { ...rh };
      if (rhClone.manualHotel) {
        const mh = { ...rhClone.manualHotel };
        delete (mh as any).ratePerNight;
        delete (mh as any).netCost;
        delete (mh as any).totalSellingPrice;
        rhClone.manualHotel = mh;
      }
      return rhClone;
    });
  }

  return clone;
}
