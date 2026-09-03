import { Quotation, QuotationOption, TripRouteHub } from '../types';
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
  const senderName = userOverrideBranding?.name || quote.agentName || 'TheUnbound Travel Consultant';
  const senderAgency = userOverrideBranding?.agency || quote.agentAgency || quote.agentCompany || 'TheUnbound Luxury DMC';
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
  'tax breakdown'
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
