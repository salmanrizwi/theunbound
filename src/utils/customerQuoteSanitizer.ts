import { 
  Quotation, 
  QuotationOption, 
  TripRouteHub, 
  Product, 
  QuoteItem, 
  Booking, 
  PricingCalculationResult, 
  AgentPricingResponse 
} from '../types';
import { formatCurrency } from '../services/pricingEngine';

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

  // Authoritative Final Selling Price
  const finalPrice = activeOption?.totalSellingPrice !== undefined
    ? activeOption.totalSellingPrice
    : (quote.totalSellingPrice || 0);

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
  const hotelsSummary: string[] = [];
  if (quote.routeHubs && quote.routeHubs.length > 0) {
    quote.routeHubs.forEach(h => {
      if (h.hotelId || h.manualHotel?.hotelName) {
        const city = h.hubName || h.destinationName || 'City';
        const hotelName = h.manualHotel?.hotelName || h.hotelId || 'Premium Selected Hotel';
        const nights = h.nights || 1;
        const roomType = h.manualHotel?.roomType || '';
        const mealPlan = h.manualHotel?.mealPlan || '';
        
        let desc = `${city} — ${hotelName} (${nights} ${nights === 1 ? 'Night' : 'Nights'}`;
        if (roomType) desc += `, ${roomType}`;
        if (mealPlan) desc += `, ${mealPlan}`;
        desc += ')';
        hotelsSummary.push(desc);
      }
    });
  }

  // If no routeHubs accommodation, inspect items
  if (hotelsSummary.length === 0) {
    (quote.items || []).forEach(it => {
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
  'internal pricing'
];

export function verifyNoCommercialLeak(message: string): { isSafe: boolean; detectedTerms: string[] } {
  const lower = message.toLowerCase();
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
    sellingPriceFinal: calc.sellingPriceFinal ?? calc.finalTotalSellingPrice ?? 0,
    pricePerPerson: calc.pricePerPerson ?? 0,

    taxAmount: (calc as any).taxAmount,
    serviceFee: (calc as any).serviceFee,
    discountAmount: (calc as any).discountAmount,

    isCapacityBased: calc.isCapacityBased,
    pricingMethod: calc.pricingMethod,
    vehicleDetails: safeVehicleDetails,

    rateEffectiveTo: calc.rateEffectiveTo,
    isAuthoritative: calc.isAuthoritative ?? true,
    calculatedAt: calc.calculatedAt || new Date().toISOString()
  };
}

/**
 * Sanitizes a Product object for B2B Agents.
 * STRICT SECURITY: Removes supplier nett rates, supplier codes, and internal markups.
 */
export function sanitizeProductForAgent(product: Product): Product {
  if (!product) return product;
  const clone: Product = JSON.parse(JSON.stringify(product));

  delete (clone as any).adultNetPrice;
  delete (clone as any).adultNettCost;
  delete (clone as any).childNetPrice;
  delete (clone as any).childNettCost;
  delete (clone as any).infantNetPrice;
  delete (clone as any).infantNettCost;
  delete (clone as any).defaultMarkupPercent;
  delete (clone as any).b2bAgentMarkupPercent;
  delete (clone as any).buyerMarkupPercent;
  delete (clone as any).supplierProductCode;
  delete (clone as any).supplierId;
  delete (clone as any).supplierName;
  delete (clone as any).supplierEmail;
  delete (clone as any).supplierPhone;
  delete (clone as any).supplierType;
  delete (clone as any).unitVehicleNetCost;
  delete (clone as any).internalNotes;

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
  const clone: QuoteItem = JSON.parse(JSON.stringify(item));

  if (clone.product) {
    clone.product = sanitizeProductForAgent(clone.product);
  }

  if (clone.calculation) {
    clone.calculation = sanitizePricingResultForAgent(clone.calculation);
  }

  if (clone.manualHotelDetails) {
    delete (clone.manualHotelDetails as any).netRate;
    delete (clone.manualHotelDetails as any).costPerNight;
    delete (clone.manualHotelDetails as any).supplierCost;
  }

  return clone;
}

/**
 * Sanitizes a Quotation object into a pure Agent-facing representation.
 * STRICT SECURITY:
 * - Deletes totalNetCost, totalMargin, internalNettCost, internalMarkup, agentMarkup, internalProfit.
 * - Deletes private operational notes and rate snapshots.
 * - Sanitizes all items and options to remove net costs.
 */
export function sanitizeQuoteForAgent(quote: Quotation): Quotation {
  if (!quote) return quote;
  const clone: Quotation = JSON.parse(JSON.stringify(quote));

  // Authoritative Agent-Facing Pricing Preservation (Section 5 & 8)
  const baseFinalSellingPrice = clone.baseFinalSellingPrice ?? clone.base_final_selling_price ?? clone.totalSellingPrice;
  const agentMarginType = clone.agentMarginType ?? clone.agent_margin_type ?? 'PERCENTAGE';
  const agentMarginValue = clone.agentMarginValue ?? clone.agent_margin_value ?? (clone.overallMarkupPercent ?? 0);
  const agentMarginAmount = clone.agentMarginAmount ?? clone.agent_margin_amount ?? (
    agentMarginType === 'PERCENTAGE'
      ? Math.round(baseFinalSellingPrice * (agentMarginValue / 100))
      : Math.round(agentMarginValue)
  );
  const finalCustomerSellingPrice = clone.finalCustomerSellingPrice ?? clone.final_customer_selling_price ?? (baseFinalSellingPrice + agentMarginAmount);

  // Set Agent-facing fields explicitly
  clone.baseFinalSellingPrice = baseFinalSellingPrice;
  clone.base_final_selling_price = baseFinalSellingPrice;
  clone.baseFinalSellingPriceCurrency = clone.baseFinalSellingPriceCurrency || clone.currency;
  clone.base_final_selling_price_currency = clone.base_final_selling_price_currency || clone.currency;
  clone.agentMarginType = agentMarginType;
  clone.agent_margin_type = agentMarginType;
  clone.agentMarginValue = agentMarginValue;
  clone.agent_margin_value = agentMarginValue;
  clone.agentMarginAmount = agentMarginAmount;
  clone.agent_margin_amount = agentMarginAmount;
  clone.finalCustomerSellingPrice = finalCustomerSellingPrice;
  clone.final_customer_selling_price = finalCustomerSellingPrice;
  clone.totalSellingPrice = finalCustomerSellingPrice;

  // Strict Security Isolation: Strip internal commercial totals, rates, and supplier data (Section 5)
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
  delete (clone as any).customOperationalRemarks;
  delete (clone as any).pricingFormulas;
  delete (clone as any).supplierRates;

  // Sanitize items
  if (clone.items && Array.isArray(clone.items)) {
    clone.items = clone.items.map(sanitizeQuoteItemForAgent);
  }

  // Sanitize quotation options if present
  if (clone.options && Array.isArray(clone.options)) {
    clone.options = clone.options.map(option => {
      const optClone: QuotationOption = JSON.parse(JSON.stringify(option));
      delete (optClone as any).totalNetCost;
      delete (optClone as any).totalMargin;
      delete (optClone as any).internalNettCost;
      delete (optClone as any).internalMarkup;
      delete (optClone as any).internalProfit;
      delete (optClone as any).supplierCost;
      if (optClone.items && Array.isArray(optClone.items)) {
        optClone.items = optClone.items.map(sanitizeQuoteItemForAgent);
      }
      return optClone;
    });
  }

  return clone;
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
  const clone: Booking = JSON.parse(JSON.stringify(b));

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

  // Strips internal invoices
  clone.uploadedInvoices = [];

  if (clone.items && Array.isArray(clone.items)) {
    clone.items = clone.items.map(it => {
      // Eliminate supplier identity and contacts
      delete it.supplierId;
      delete it.supplierName;
      delete it.supplierContact;
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

      // Eliminate supplier pricing and nett costs
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
