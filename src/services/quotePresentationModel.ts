import { Quotation, QuoteItem, TripRouteHub } from '../types';
import { formatCurrency, calculateQuoteTotal } from './pricingEngine';
import { getInventoryDisplayName, getInventoryConfigurationSummary } from '../utils/inventoryDisplayHelpers';
import { isRailQuoteItem } from './rail/JapanRailJourneyDataService';
import { 
  renderProposalViewHtmlEmail,
  renderStructuredQuotationHtmlEmail, 
  formatPlainTextQuotationToHtml,
  renderSimpleSemanticQuotationEmailFromModel,
  convertHtmlToCleanPlainText
} from './quoteEmailFormatter';
import { richTextToWhatsApp } from '../utils/richTextFormatter';

export interface ServicePresentationItem {
  id: string;
  category: string;
  categoryLabel: string;
  badgeBg: string;
  badgeText: string;
  colorClass: string;
  badgeClass: string;
  listingName: string;
  duration?: string;
  serviceTime?: string;
  configurationSummary?: string;
  isRail: boolean;
  railDetails?: {
    origin: string;
    destination: string;
    carType: string;
    seatType: string;
    serviceGroup: string;
    seatPreference?: string;
    pnrReference?: string;
  };
  overview: string;
  inclusions: string[];
  exclusions: string[];
  specialInstructions?: string;
  meetingPoint?: string;
  pickupPoint?: string;
  dropoffPoint?: string;
  priceFormatted: string;
  paxText: string;
  statusText: string;
  rawItem: QuoteItem;
}

export interface DayPresentationData {
  dayId: string;
  dayNumber: number;
  dateString: string;
  dayOfWeek: string;
  formattedDate: string;
  hubName: string;
  isTransitionDay: boolean;
  prevHubName?: string;
  customTheme?: string;
  dayOverview?: string;
  dayNotes?: string;
  services: ServicePresentationItem[];
}

export interface OperationalStandardCard {
  title: string;
  desc: string;
  icon: string;
}

export interface HotelPresentationItem {
  id: string;
  hotelName: string;
  cityHub: string;
  starRating?: string;
  checkInDate: string;
  checkOutDate: string;
  nightsCount: number;
  roomType: string;
  roomsCount: number;
  occupancy: string;
  mealPlan: string;
  overview?: string;
  inclusions: string[];
  exclusions: string[];
  priceFormatted?: string;
  notes?: string;
}

export interface AccommodationStaySummaryItem {
  hubId?: string;
  city: string;
  nights: number;
  hotelName: string;
  roomSummary?: string;
  checkInDate?: string;
  checkOutDate?: string;
  mealPlan?: string;
  isNoAccommodation?: boolean;
}

export interface QuotePresentationModel {
  quoteId: string;
  quoteNumber: string;
  version: number;
  status: string;
  createdDateFormatted: string;
  validUntilFormatted: string;
  currency: string;
  totalSellingPriceNumeric: number;
  
  // Separate Primary Totals: Hotel Accommodation Total & Land Part Total (Excludes Accommodation)
  hasHotelAccommodation: boolean;
  hotelAccommodationTotalNumeric: number;
  hotelAccommodationTotalFormatted?: string;
  hotelItemsCount: number;

  hasLandServices: boolean;
  landPartTotalNumeric: number;
  landPartTotalFormatted: string;
  landItemsCount: number;
  
  // Agent & Agency Branding
  agencyName: string;
  agentName: string;
  agentEmail?: string;
  agentPhone?: string;
  agentLogoUrl?: string;
  agentAgencySubtitle: string;
  agentNotes?: string;
  
  // Client Dossier
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPhone?: string;
  
  // Journey Overview
  destination: string;
  totalDays: number;
  totalNights: number;
  effectivePax: number;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  paxDetailsText: string;
  nationality?: string;
  travelStyle?: string;
  dateSpanText?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  selectedOptionTitle?: string;
  selectedOptionNumber?: number;
  pricePerPersonFormatted: string;
  routeHubs: Array<{
    hubName: string;
    nights: number;
  }>;
  
  // Curated Hotels Summary
  hotels: HotelPresentationItem[];

  // Accommodations Summary (All Route Hubs, including NO_ACCOMMODATION)
  accommodations: AccommodationStaySummaryItem[];

  // Visa & Ancillary Services
  visaServices: ServicePresentationItem[];
  
  // Day-by-Day Chronological Itinerary
  days: DayPresentationData[];
  
  // General Inclusions
  additionalServices: Array<{
    name: string;
    summary: string;
    priceFormatted: string;
    category?: string;
    overview?: string;
    inclusions?: string[];
    exclusions?: string[];
    specialInstructions?: string;
  }>;
  
  // Operational Standards
  operationalStandards: OperationalStandardCard[];
  
  // Financial Tariff
  totalItineraryValueFormatted: string;
  pricePerTravelerFormatted: string;
  guaranteedCurrencyLine: string;
  
  // Operational Policies
  childAndAttractionPolicies: string[];
  
  // Commercial Terms
  commercialTerms: string;
  footerContactLine: string;
}

export function isVisaQuoteItem(it: QuoteItem): boolean {
  return it.service_type === 'VISA' ||
         it.service_type === 'TRAVEL_PROTECTION' ||
         it.service_type === 'VIP_GROUND' ||
         it.service_type === 'CONNECTIVITY' ||
         it.category === 'Visa & Ancillary Services' ||
         it.product?.productType === 'Visa Service' || 
         it.product?.productType === 'Travel Protection' ||
         it.product?.productType === '5G Connectivity' ||
         it.product?.subcategory === 'Visa Facilitation' || 
         it.product?.subcategory === 'Travel Insurance' ||
         it.product?.subcategory === 'Ground VIP Services' ||
         it.product?.subcategory === 'eSIM Connectivity' ||
         it.product?.sku?.startsWith('VSA-') ||
         it.product?.sku?.startsWith('VISA-') ||
         it.product?.sku?.startsWith('INS-') ||
         it.product?.sku?.startsWith('VIP-') ||
         it.product?.sku?.startsWith('ESIM-') ||
         (it.product?.category === 'Travel Services' && it.product?.name?.toLowerCase().includes('visa')) ||
         Boolean(it.product?.name?.toLowerCase().includes('visa') && it.product?.name?.toLowerCase().includes('entry'));
}

export function getCategoryStyleMeta(category?: string, productType?: string) {
  const cat = (category || productType || '').toLowerCase();
  if (cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan')) {
    return {
      label: 'Luxury Accommodation',
      badgeBg: '#FEF3C7',
      badgeText: '#92400E',
      colorClass: 'bg-amber-50/80 text-amber-900 border-amber-200/90',
      badgeClass: 'bg-amber-100 text-amber-900'
    };
  }
  if (cat.includes('rail') || cat.includes('train') || cat.includes('shinkansen')) {
    return {
      label: 'High-Speed Shinkansen Bullet Train',
      badgeBg: '#E0E7FF',
      badgeText: '#3730A3',
      colorClass: 'bg-indigo-50/80 text-indigo-900 border-indigo-200/90',
      badgeClass: 'bg-indigo-100 text-indigo-900'
    };
  }
  if (cat.includes('transfer') || cat.includes('transport') || cat.includes('vehicle')) {
    return {
      label: 'Private Ground Transfer',
      badgeBg: '#DBEAFE',
      badgeText: '#1E40AF',
      colorClass: 'bg-blue-50/80 text-blue-900 border-blue-200/90',
      badgeClass: 'bg-blue-100 text-blue-900'
    };
  }
  if (cat.includes('dining') || cat.includes('food') || cat.includes('culinary') || cat.includes('meal')) {
    return {
      label: 'Curated Dining Experience',
      badgeBg: '#FFE4E6',
      badgeText: '#9F1239',
      colorClass: 'bg-rose-50/80 text-rose-900 border-rose-200/90',
      badgeClass: 'bg-rose-100 text-rose-900'
    };
  }
  if (cat.includes('visa') || cat.includes('insurance') || cat.includes('connectivity') || cat.includes('vip')) {
    return {
      label: 'Visa & Ancillary Service',
      badgeBg: '#D1FAE5',
      badgeText: '#065F46',
      colorClass: 'bg-emerald-50/80 text-emerald-900 border-emerald-200/90',
      badgeClass: 'bg-emerald-100 text-emerald-900'
    };
  }
  return {
    label: 'Guided Tour & Sightseeing',
    badgeBg: '#CCFBF1',
    badgeText: '#115E59',
    colorClass: 'bg-teal-50/80 text-teal-900 border-teal-200/90',
    badgeClass: 'bg-teal-100 text-teal-900'
  };
}

export function transformQuoteItemToPresentation(item: QuoteItem, currency: string): ServicePresentationItem {
  const isRail = isRailQuoteItem(item) || (item.category === 'Rail') || (item as any).service_type === 'RAIL' || Boolean(item.railJourneyDetails);
  const styleMeta = getCategoryStyleMeta(item.product?.category || item.category, item.product?.productType);
  const itemPrice = item.calculation?.finalTotalSellingPrice || item.calculation?.totalSellingPrice || (item as any).totalPrice || (item as any).sellingPrice || 0;

  const rawInclusions = item.contentSnapshot?.inclusions || item.product?.inclusions || (item as any).inclusions || [];
  const inclusions = Array.isArray(rawInclusions) ? rawInclusions.map(inc => String(inc).trim()).filter(Boolean) : [];

  const rawExclusions = item.contentSnapshot?.exclusions || item.product?.exclusions || (item as any).exclusions || [];
  const exclusions = Array.isArray(rawExclusions) ? rawExclusions.map(exc => String(exc).trim()).filter(Boolean) : [];

  const overview = item.contentSnapshot?.overviewSpecifications || 
                   item.product?.longDescription || 
                   item.product?.description || 
                   item.product?.shortDescription || 
                   (item as any).description || '';

  let railDetails;
  if (isRail && item.railJourneyDetails) {
    const rd = item.railJourneyDetails;
    railDetails = {
      origin: `${rd.originStationName || 'Origin'} (${rd.originStationCode || 'TYO'})`,
      destination: `${rd.destinationStationName || 'Destination'} (${rd.destinationStationCode || 'KYO'})`,
      carType: rd.carType || 'Ordinary',
      seatType: rd.seatType || 'Reserved Seat',
      serviceGroup: rd.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi Super Express' : 'Hikari/Kodama Express',
      seatPreference: rd.seatPreference,
      pnrReference: rd.pnrReference
    };
  }

  const meetingPoint = item.metadata?.meetingPoint || (item.product as any)?.meetingPoint || (item as any).meetingPoint;
  const pickupPoint = item.metadata?.pickupPoint || item.selected_options?.pickupLocation || (item.product as any)?.pickupPoint || (item as any).pickupPoint;
  const dropoffPoint = item.metadata?.dropoffPoint || item.selected_options?.dropoffLocation || (item.product as any)?.dropoffPoint || (item as any).dropoffPoint;

  const adultsCount = item.pax?.adults || (item as any).paxCount || 2;
  const childrenCount = item.pax?.children || 0;

  return {
    id: item.id || `item-${Math.random()}`,
    category: item.product?.category || item.category || 'Service',
    categoryLabel: styleMeta.label,
    badgeBg: styleMeta.badgeBg,
    badgeText: styleMeta.badgeText,
    colorClass: styleMeta.colorClass,
    badgeClass: styleMeta.badgeClass,
    listingName: getInventoryDisplayName(item),
    duration: item.product?.duration || (item as any).duration,
    serviceTime: item.serviceTime,
    configurationSummary: getInventoryConfigurationSummary(item),
    isRail,
    railDetails,
    overview,
    inclusions,
    exclusions,
    specialInstructions: item.notes || (item as any).specialInstructions,
    meetingPoint,
    pickupPoint,
    dropoffPoint,
    priceFormatted: '',
    paxText: `${adultsCount} Adults${childrenCount ? `, ${childrenCount} Ch` : ''}`,
    statusText: 'Confirmed Allotment',
    rawItem: item
  };
}

export function buildQuotePresentationModel(
  quote: Quotation,
  agentOverride?: {
    name?: string;
    agencyName?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
    selectedOptionIndexOrId?: number | string;
  }
): QuotePresentationModel {
  // Resolve option if applicable without ever discarding populated quote.items for an empty option slot
  let activeOption = undefined as any;
  let selectedOptionTitle: string | undefined = undefined;
  let selectedOptionNumber: number | undefined = undefined;

  if (quote.options && quote.options.length > 0) {
    const sel = agentOverride?.selectedOptionIndexOrId ?? quote.activeOptionId;
    if (typeof sel === 'number') {
      const zeroIdxCandidate = quote.options[sel];
      const oneIdxCandidate = sel >= 1 ? (quote.options.find(o => o.optionNumber === sel) || quote.options[sel - 1]) : undefined;
      if (zeroIdxCandidate && ((zeroIdxCandidate.items && zeroIdxCandidate.items.length > 0) || !oneIdxCandidate)) {
        activeOption = zeroIdxCandidate;
        selectedOptionNumber = zeroIdxCandidate.optionNumber || (sel + 1);
      } else if (oneIdxCandidate) {
        activeOption = oneIdxCandidate;
        selectedOptionNumber = oneIdxCandidate.optionNumber || sel;
      }
      if (activeOption) {
        selectedOptionTitle = activeOption.title || activeOption.optionTitle || `Option ${selectedOptionNumber}`;
      }
    } else if (typeof sel === 'string') {
      const idx = quote.options.findIndex(o => o.id === sel);
      if (idx >= 0) {
        activeOption = quote.options[idx];
        selectedOptionNumber = activeOption.optionNumber || (idx + 1);
        selectedOptionTitle = activeOption.title || activeOption.optionTitle || `Option ${selectedOptionNumber}`;
      }
    }
  }

  const rawItems: QuoteItem[] = (activeOption?.items && activeOption.items.length > 0)
    ? activeOption.items
    : (quote.items || []);
  const hubs: TripRouteHub[] = (activeOption?.routeHubs && activeOption.routeHubs.length > 0)
    ? activeOption.routeHubs
    : (quote.routeHubs || []);
  const sortedHubs = [...hubs].sort((a, b) => a.order - b.order);

  const effectiveScope = activeOption?.quotationScope || activeOption?.scope || quote.quotationScope || quote.scope || 'FULL_PACKAGE';
  const isLandOnlyQuote = effectiveScope === 'LAND_ONLY';

  const isHubNoAccommodation = (h?: TripRouteHub | null): boolean => {
    if (!h) return isLandOnlyQuote;
    return isLandOnlyQuote || h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none';
  };

  const noAccommodationHubIds = new Set(
    sortedHubs.filter(h => isHubNoAccommodation(h)).map(h => h.id)
  );
  const noAccommodationHubNames = new Set(
    sortedHubs.filter(h => isHubNoAccommodation(h)).map(h => (h.hubName || '').toLowerCase()).filter(Boolean)
  );

  const isHotelQuoteItem = (it: QuoteItem): boolean => {
    const cat = (it.product?.category || it.category || it.product?.productType || '').toLowerCase();
    return cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan') ||
           it.product?.productType === 'HOTEL' || (it as any).service_type === 'HOTEL' ||
           Boolean(it.isManualHotel || it.manualHotelDetails || it.hotelId);
  };

  const items: QuoteItem[] = rawItems.filter(it => {
    if (it.isNoAccommodation || (it as any).accommodationType === 'NO_ACCOMMODATION' || (it as any).accommodationType === 'none') {
      return false;
    }
    if (isHotelQuoteItem(it)) {
      if (isLandOnlyQuote) return false;
      const itemHubId = it.hubId || it.manualHotelDetails?.hubId || (it.metadata as any)?.hubId;
      if (itemHubId && noAccommodationHubIds.has(itemHubId)) return false;
      if (!itemHubId) {
        const itemCity = (it.manualHotelDetails?.city || it.product?.city || '').toLowerCase();
        if (itemCity && noAccommodationHubNames.has(itemCity)) return false;
      }
    }
    return true;
  });

  const effectiveCurrency = quote.currency || 'USD';
  const effectiveAgency = agentOverride?.agencyName || quote.agentAgency || quote.agentCompany;
  const effectiveAgentName = agentOverride?.name || quote.agentName || 'Bespoke Travel Specialist';
  const effectiveAgentEmail = agentOverride?.email || quote.agentEmail || 'sales@theunbound.in';
  const effectiveAgentPhone = agentOverride?.phone || quote.agentPhone || '+91-9811654959';
  const effectiveAgentLogoUrl = agentOverride?.logoUrl || quote.agentLogoUrl;

  const effectiveAgentNotes = typeof quote.agentNotes === 'string'
    ? quote.agentNotes
    : Array.isArray(quote.agentNotes)
      ? (quote.agentNotes as any[]).map(x => typeof x === 'string' ? x : x?.text || '').filter(Boolean).join('\n')
      : undefined;

  // Split visa vs non-visa
  const visaItems = items.filter(isVisaQuoteItem);
  const nonVisaItems = items.filter(it => !isVisaQuoteItem(it));

  // Compute days
  const startDateStr = quote.travelStartDate;
  const endDateStr = quote.travelEndDate;
  let calDays: Array<{ dayNumber: number; dateString: string; dayOfWeek: string; formattedDate: string }> = [];

  if (startDateStr && endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const current = new Date(start);
      let dayCount = 1;
      while (current <= end) {
        const iso = current.toISOString().split('T')[0];
        calDays.push({
          dayNumber: dayCount,
          dateString: iso,
          dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        current.setDate(current.getDate() + 1);
        dayCount++;
      }
    }
  }

  if (calDays.length === 0) {
    const validDates = nonVisaItems.map(it => it.travelDate).filter((d): d is string => Boolean(d));
    const uniqueDates = Array.from(new Set<string>(validDates)).sort();
    if (uniqueDates.length > 0) {
      calDays = uniqueDates.map((dateStr, idx) => {
        const d = new Date(dateStr);
        return {
          dayNumber: idx + 1,
          dateString: dateStr,
          dayOfWeek: isNaN(d.getTime()) ? `Day ${idx + 1}` : d.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
      });
    } else {
      const maxExplicitDay = nonVisaItems.reduce((max, it) => Math.max(max, Number((it as any).dayNumber) || 0), 0);
      const totalNights = hubs.reduce((sum, h) => sum + (h.nights || 0), 0) || Math.max(maxExplicitDay > 0 ? maxExplicitDay - 1 : 0, items.length, 3);
      const base = new Date();
      for (let i = 0; i <= totalNights; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        calDays.push({
          dayNumber: i + 1,
          dateString: d.toISOString().split('T')[0],
          dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
    }
  }

  const effectivePax = quote.totalPax || (quote as any).effectivePax || (quote as any).paxCount || ((quote.adultsCount || (quote as any).adults || 2) + (quote.childrenCount || (quote as any).children || 0) + (quote.infantsCount || (quote as any).infants || 0));
  const adultsDisplay = quote.adultsCount || (quote as any).adults || effectivePax || 2;
  const childrenDisplay = quote.childrenCount || (quote as any).children || 0;
  const infantsDisplay = quote.infantsCount || (quote as any).infants || 0;

  // Build curated hotels list from routeHubs and hotel QuoteItems
  const hotels: HotelPresentationItem[] = [];
  const seenHotelKeys = new Set<string>();

  if (sortedHubs.length > 0) {
    let checkInOffset = 0;
    sortedHubs.forEach((h, hIdx) => {
      const city = h.hubName || h.destinationName || quote.destination || 'City Hub';
      const nights = h.nights || 1;
      let checkInDate = quote.travelStartDate || `Day ${checkInOffset + 1}`;
      let checkOutDate = quote.travelEndDate || `Day ${checkInOffset + nights + 1}`;

      if (quote.travelStartDate) {
        const s = new Date(quote.travelStartDate);
        if (!isNaN(s.getTime())) {
          s.setDate(s.getDate() + checkInOffset);
          checkInDate = s.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
          s.setDate(s.getDate() + nights);
          checkOutDate = s.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }
      checkInOffset += nights;

      if (!isHubNoAccommodation(h) && (h.hotelId || h.manualHotel?.hotelName)) {
        const matchedHotelItem = nonVisaItems.find(it => {
          const cat = (it.product?.category || it.category || '').toLowerCase();
          const isHtl = cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan') || Boolean(it.isManualHotel);
          if (!isHtl) return false;
          return (h.hotelId && it.product?.id?.includes(h.hotelId)) ||
                 (h.manualHotel?.hotelName && it.product?.name?.toLowerCase().includes(h.manualHotel.hotelName.toLowerCase())) ||
                 (it.notes && it.notes.toLowerCase().includes(city.toLowerCase()));
        });

        const hotelName = h.manualHotel?.hotelName || (matchedHotelItem ? getInventoryDisplayName(matchedHotelItem) : h.hotelId) || 'Selected Luxury Hotel';
        const roomType = h.manualHotel?.roomType || matchedHotelItem?.selected_options?.roomType || 'Deluxe Luxury Room';
        const mealPlan = h.manualHotel?.mealPlanName || h.manualHotel?.mealPlan || 'Daily Breakfast Included';
        const starRating = h.manualHotel?.starRating || (h.manualHotel as any)?.category || '4 Star / 5 Star';
        const roomsCount = h.roomsCount || h.manualHotel?.numberOfRooms || quote.roomingConfig?.roomsCount || 1;
        const itemPrice = matchedHotelItem ? (matchedHotelItem.calculation?.finalTotalSellingPrice || matchedHotelItem.calculation?.totalSellingPrice || 0) : 0;

        const key = `${hotelName.toLowerCase()}-${city.toLowerCase()}`;
        seenHotelKeys.add(key);
        if (matchedHotelItem?.id) seenHotelKeys.add(matchedHotelItem.id);

        hotels.push({
          id: h.id || `hotel-hub-${hIdx}`,
          hotelName,
          cityHub: city,
          starRating: String(starRating),
          checkInDate,
          checkOutDate,
          nightsCount: nights,
          roomType,
          roomsCount,
          occupancy: `${adultsDisplay} Adults${childrenDisplay ? ` + ${childrenDisplay} Ch` : ''}`,
          mealPlan,
          overview: matchedHotelItem?.contentSnapshot?.overviewSpecifications || matchedHotelItem?.product?.longDescription || matchedHotelItem?.product?.shortDescription,
          inclusions: matchedHotelItem?.contentSnapshot?.inclusions || matchedHotelItem?.product?.inclusions || [mealPlan, `${roomsCount} × ${roomType} (${nights} Nights)`],
          exclusions: matchedHotelItem?.contentSnapshot?.exclusions || matchedHotelItem?.product?.exclusions || [],
          priceFormatted: undefined,
          notes: h.manualHotel?.internalNotes || (h.manualHotel as any)?.notes || matchedHotelItem?.notes
        });
      }
    });
  }

  // Also include any standalone Hotel QuoteItems that were not matched via routeHubs
  nonVisaItems.forEach((it, idx) => {
    const cat = (it.product?.category || it.category || it.product?.productType || '').toLowerCase();
    const isHtl = cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan') || Boolean(it.isManualHotel);
    if (!isHtl) return;
    if (seenHotelKeys.has(it.id)) return;
    const hotelName = getInventoryDisplayName(it);
    const city = it.product?.city || quote.destination || 'Destination Hub';
    const key = `${hotelName.toLowerCase()}-${city.toLowerCase()}`;
    if (seenHotelKeys.has(key)) return;
    seenHotelKeys.add(key);

    const itemPrice = it.calculation?.finalTotalSellingPrice || it.calculation?.totalSellingPrice || 0;
    hotels.push({
      id: it.id || `hotel-item-${idx}`,
      hotelName,
      cityHub: city,
      starRating: '4 Star / 5 Star',
      checkInDate: it.travelDate || quote.travelStartDate || 'Day 1',
      checkOutDate: quote.travelEndDate || 'As per itinerary',
      nightsCount: (it as any).quantity || 1,
      roomType: getInventoryConfigurationSummary(it) || 'Luxury Room',
      roomsCount: quote.roomingConfig?.roomsCount || 1,
      occupancy: `${it.pax?.adults || adultsDisplay} Adults${it.pax?.children ? ` + ${it.pax.children} Ch` : ''}`,
      mealPlan: 'Daily Breakfast Included',
      overview: it.contentSnapshot?.overviewSpecifications || it.product?.longDescription || it.product?.shortDescription,
      inclusions: it.contentSnapshot?.inclusions || it.product?.inclusions || [],
      exclusions: it.contentSnapshot?.exclusions || it.product?.exclusions || [],
      priceFormatted: undefined,
      notes: it.notes
    });
  });

  // Build accommodations summary list for all route hubs (including NO_ACCOMMODATION)
  const accommodations: AccommodationStaySummaryItem[] = [];
  if (sortedHubs.length > 0) {
    let checkInOffset = 0;
    sortedHubs.forEach((h, hIdx) => {
      const city = h.hubName || h.destinationName || quote.destination || `Hub ${hIdx + 1}`;
      const nights = h.nights || 1;
      let checkInDate = quote.travelStartDate || `Day ${checkInOffset + 1}`;
      let checkOutDate = quote.travelEndDate || `Day ${checkInOffset + nights + 1}`;

      if (quote.travelStartDate) {
        const s = new Date(quote.travelStartDate);
        if (!isNaN(s.getTime())) {
          s.setDate(s.getDate() + checkInOffset);
          checkInDate = s.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
          s.setDate(s.getDate() + nights);
          checkOutDate = s.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }
      checkInOffset += nights;

      const isNoAcc = isHubNoAccommodation(h);
      if (isNoAcc) {
        accommodations.push({
          hubId: h.id,
          city,
          nights,
          hotelName: 'No Accommodation (Arranged by Client)',
          roomSummary: 'Arranged directly by traveler / Client self-booked',
          checkInDate,
          checkOutDate,
          isNoAccommodation: true
        });
      } else {
        const matchedHotelItem = nonVisaItems.find(it => {
          const cat = (it.product?.category || it.category || '').toLowerCase();
          const isHtl = cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan') || Boolean(it.isManualHotel);
          if (!isHtl) return false;
          return (h.hotelId && it.product?.id?.includes(h.hotelId)) ||
                 (h.manualHotel?.hotelName && it.product?.name?.toLowerCase().includes(h.manualHotel.hotelName.toLowerCase())) ||
                 (it.notes && it.notes.toLowerCase().includes(city.toLowerCase()));
        });

        const hotelName = h.manualHotel?.hotelName || (matchedHotelItem ? getInventoryDisplayName(matchedHotelItem) : h.hotelId) || 'Selected Luxury Hotel';
        const roomType = h.manualHotel?.roomType || matchedHotelItem?.selected_options?.roomType || 'Standard Room';
        const mealPlan = h.manualHotel?.mealPlanName || h.manualHotel?.mealPlan || 'Daily Breakfast Included';
        const roomsCount = h.roomsCount || h.manualHotel?.numberOfRooms || quote.roomingConfig?.roomsCount || 1;

        accommodations.push({
          hubId: h.id,
          city,
          nights,
          hotelName,
          roomSummary: `${roomsCount} Room(s) • ${roomType} (${mealPlan})`,
          checkInDate,
          checkOutDate,
          mealPlan,
          isNoAccommodation: false
        });
      }
    });
  } else if (hotels.length > 0) {
    hotels.forEach(h => {
      accommodations.push({
        hubId: h.id,
        city: h.cityHub,
        nights: h.nightsCount,
        hotelName: h.hotelName,
        roomSummary: `${h.roomsCount} Room(s) • ${h.roomType} (${h.mealPlan})`,
        checkInDate: h.checkInDate,
        checkOutDate: h.checkOutDate,
        mealPlan: h.mealPlan,
        isNoAccommodation: false
      });
    });
  }

  const days: DayPresentationData[] = calDays.map((calDay) => {
    let activeHub: TripRouteHub | null = null;
    let isTransitionDay = false;
    let isHubCheckIn = false;
    let prevHub: TripRouteHub | null = null;

    if (sortedHubs.length > 0) {
      let runningNightCount = 0;
      for (let i = 0; i < sortedHubs.length; i++) {
        const hub = sortedHubs[i];
        const hubNights = hub.nights || 1;
        const hubStartDay = runningNightCount + 1;
        const hubEndDay = runningNightCount + hubNights;

        if (calDay.dayNumber >= hubStartDay && calDay.dayNumber <= hubEndDay) {
          activeHub = hub;
          if (calDay.dayNumber === hubStartDay) {
            isHubCheckIn = true;
            if (i > 0) {
              isTransitionDay = true;
              prevHub = sortedHubs[i - 1];
            }
          }
          break;
        }
        runningNightCount += hubNights;
      }

      if (!activeHub && sortedHubs.length > 0) {
        activeHub = sortedHubs[sortedHubs.length - 1];
      }
    }

    const dayItems = nonVisaItems.filter(it => {
      if (it.travelDate) {
        return it.travelDate === calDay.dateString;
      }
      return Number((it as any).dayNumber) === calDay.dayNumber;
    });

    const dayServices = dayItems.map(it => transformQuoteItemToPresentation(it, effectiveCurrency));

    // If this day is a hub check-in and the hub has a manualHotel/hotelId that wasn't already in dayItems, synthesize a hotel service card so all channels show it
    if (isHubCheckIn && activeHub && !isHubNoAccommodation(activeHub) && (activeHub.manualHotel?.hotelName || activeHub.hotelId)) {
      const targetHotelName = (activeHub.manualHotel?.hotelName || activeHub.hotelId || '').toLowerCase();
      const alreadyHasHotelInDay = dayServices.some(s =>
        s.categoryLabel === 'Luxury Accommodation' ||
        s.listingName.toLowerCase().includes(targetHotelName)
      );
      if (!alreadyHasHotelInDay) {
        const hubName = activeHub.hubName || quote.destination || 'Japan';
        const hotelDisplayName = activeHub.manualHotel?.hotelName || activeHub.hotelId || `${hubName} Luxury Hotel`;
        const roomType = activeHub.manualHotel?.roomType || 'Deluxe Room';
        const mealPlan = activeHub.manualHotel?.mealPlanName || activeHub.manualHotel?.mealPlan || 'Daily Breakfast Included';
        const roomsCount = activeHub.roomsCount || activeHub.manualHotel?.numberOfRooms || quote.roomingConfig?.roomsCount || 1;
        const nights = activeHub.nights || 1;
        const htlStyle = getCategoryStyleMeta('Accommodation', 'Hotel');
        const manualPrice = activeHub.manualHotel
          ? ((activeHub.manualHotel as any).totalSellingPrice || (activeHub.manualHotel.ratePerNight || 0) * nights * roomsCount)
          : 0;

        dayServices.unshift({
          id: `synth-hotel-${activeHub.id || calDay.dayNumber}`,
          category: 'Accommodation',
          categoryLabel: htlStyle.label,
          badgeBg: htlStyle.badgeBg,
          badgeText: htlStyle.badgeText,
          colorClass: htlStyle.colorClass,
          badgeClass: htlStyle.badgeClass,
          listingName: hotelDisplayName,
          duration: `${nights} ${nights === 1 ? 'Night' : 'Nights'}`,
          configurationSummary: `${roomType} • ${roomsCount} ${roomsCount === 1 ? 'Room' : 'Rooms'} • ${mealPlan}`,
          isRail: false,
          overview: `Confirmed ${nights}-night accommodation stay at ${hotelDisplayName} in ${hubName}.`,
          inclusions: [mealPlan, `${roomsCount} × ${roomType} (${nights} Nights)`],
          exclusions: [],
          specialInstructions: activeHub.manualHotel?.internalNotes || activeHub.notes,
          priceFormatted: '',
          paxText: `${adultsDisplay} Adults${childrenDisplay ? `, ${childrenDisplay} Ch` : ''}`,
          statusText: 'Confirmed Allotment',
          rawItem: {
            id: `synth-hotel-${activeHub.id || calDay.dayNumber}`,
            product: {
              id: activeHub.hotelId || `htl-${calDay.dayNumber}`,
              name: hotelDisplayName,
              category: 'Accommodation'
            } as any,
            travelDate: calDay.dateString,
            pax: { adults: adultsDisplay, children: childrenDisplay, infants: infantsDisplay },
            selectedAddonIds: [],
            calculation: {
              totalNetCost: 0,
              totalSellingPrice: manualPrice,
              finalTotalSellingPrice: manualPrice,
              currency: effectiveCurrency
            } as any,
            totalNetCost: 0,
            totalSellingPrice: manualPrice,
            currency: effectiveCurrency as any
          } as any
        });
      }
    }

    const customTheme = quote.dayThemes?.[calDay.dayNumber];
    const dayOverview = (quote as any).dayOverviews?.[calDay.dayNumber];
    const dayNotes = (quote as any).dayNotes?.[calDay.dayNumber];

    return {
      dayId: `day-${calDay.dayNumber}`,
      dayNumber: calDay.dayNumber,
      dateString: calDay.dateString,
      dayOfWeek: calDay.dayOfWeek,
      formattedDate: calDay.formattedDate,
      hubName: activeHub?.hubName || quote.destination || 'Japan',
      isTransitionDay,
      prevHubName: prevHub?.hubName,
      customTheme,
      dayOverview,
      dayNotes,
      services: dayServices
    };
  });

  const dayDatesSet = new Set(calDays.map(d => d.dateString));
  const dayNumbersSet = new Set(calDays.map(d => d.dayNumber));
  const generalInclusions = nonVisaItems
    .filter(it => {
      if (it.travelDate) {
        return !dayDatesSet.has(it.travelDate);
      }
      if ((it as any).dayNumber !== undefined) {
        return !dayNumbersSet.has(Number((it as any).dayNumber));
      }
      return true;
    })
    .map(it => {
      const pres = transformQuoteItemToPresentation(it, effectiveCurrency);
      return {
        name: pres.listingName,
        summary: pres.configurationSummary || `${it.product?.category || 'Service'} • ${it.product?.city || quote.destination}`,
        priceFormatted: pres.priceFormatted,
        category: pres.categoryLabel,
        overview: pres.overview,
        inclusions: pres.inclusions,
        exclusions: pres.exclusions,
        specialInstructions: pres.specialInstructions
      };
    });

  const totalNights = hubs.reduce((sum, h) => sum + (h.nights || 0), 0) || Math.max(1, days.length - 1);

  // --------------------------------------------------------------------------
  // Single Authoritative Pricing Calculation via Central Pricing Engine
  // --------------------------------------------------------------------------
  const centralTotals = calculateQuoteTotal(quote, activeOption?.id);

  let hotelAccommodationTotalNumeric = centralTotals.hotelTotalSellingPrice;
  let landPartTotalNumeric = centralTotals.landPartTotalSellingPrice;
  const hotelItemsCount = centralTotals.hotelItemsIncludedCount;
  const landItemsCount = centralTotals.landItemsIncludedCount;

  // Fallback to pre-calculated quote / activeOption fields only if no items exist
  if (!isLandOnlyQuote && hotelAccommodationTotalNumeric === 0 && hotelItemsCount === 0) {
    if (typeof (activeOption as any)?.hotelAccommodationTotal === 'number' && (activeOption as any).hotelAccommodationTotal > 0) {
      hotelAccommodationTotalNumeric = (activeOption as any).hotelAccommodationTotal;
    } else if (typeof (quote as any).hotelAccommodationTotal === 'number' && (quote as any).hotelAccommodationTotal > 0) {
      hotelAccommodationTotalNumeric = (quote as any).hotelAccommodationTotal;
    } else if (typeof (quote as any).hotelTotalSelling === 'number' && (quote as any).hotelTotalSelling > 0) {
      hotelAccommodationTotalNumeric = (quote as any).hotelTotalSelling;
    }
  }

  const hasHotelAccommodation = !isLandOnlyQuote && hotelAccommodationTotalNumeric > 0 && (hotelItemsCount > 0 || hotels.length > 0);
  const hotelAccommodationTotalFormatted = hasHotelAccommodation
    ? formatCurrency(hotelAccommodationTotalNumeric, effectiveCurrency)
    : undefined;

  // Critical Rule: Land Part Total strictly excludes all hotel accommodation charges
  const hasLandServices = landPartTotalNumeric > 0 || landItemsCount > 0;
  const landPartTotalFormatted = formatCurrency(landPartTotalNumeric, effectiveCurrency);

  // Use Land Part Total as the customer-facing non-accommodation total across all templates
  const effectiveSellingPrice = landPartTotalNumeric;
  const pricePerPerson = effectiveSellingPrice / Math.max(1, effectivePax);

  const paxDetailsText = quote.passengerBreakdown
    ? `ADT: ${quote.passengerBreakdown.adults}${quote.passengerBreakdown.cwb > 0 ? ` | CWB: ${quote.passengerBreakdown.cwb}` : ''}${quote.passengerBreakdown.cnb > 0 ? ` | CNB: ${quote.passengerBreakdown.cnb}` : ''}${quote.passengerBreakdown.infants > 0 ? ` | INF: ${quote.passengerBreakdown.infants}` : ''}`
    : `${effectivePax} Guests (${adultsDisplay} Adults${childrenDisplay ? `, ${childrenDisplay} Children` : ''}${infantsDisplay ? `, ${infantsDisplay} Infants` : ''})`;

  const dateSpanText = (quote.travelStartDate && quote.travelEndDate)
    ? `${quote.travelStartDate} → ${quote.travelEndDate}`
    : (calDays.length > 0 ? `${calDays[0].dateString} → ${calDays[calDays.length - 1].dateString}` : undefined);

  const operationalStandards: OperationalStandardCard[] = [
    {
      title: '🚗 Private Chauffeur Fleet',
      desc: 'Pristine air-conditioned vehicles with commercial licensed drivers and door-to-door luggage handling.',
      icon: 'Car'
    },
    {
      title: '⛩️ Licensed Local Guides',
      desc: 'Government-certified bilingual specialists delivering insightful cultural and historical immersion.',
      icon: 'Award'
    },
    {
      title: '🏨 Confirmed Allocations',
      desc: 'Direct supplier contracted allotments with daily breakfast and verified luxury standards.',
      icon: 'Building2'
    },
    {
      title: '🛡️ 24/7 Operations Desk',
      desc: 'Live flight tracking, real-time dispatch monitoring, and 24/7 emergency WhatsApp concierge support.',
      icon: 'ShieldCheck'
    }
  ];

  const childAndAttractionPolicies = [
    'Infant below 2 years is considered free of charge unless specifically charged by ground supplier or airline.',
    'Children aged 2 to below 5 years are classified as CNB (Child No Bed). Hotel breakfast & service surcharges apply as per tariff.',
    'Children aged 5 to below 11 years are classified as CWB (Child With Bed). Extra bed is included in the room allotment.',
    'Guests aged 11 years and above are classified as Adults.',
    'Important: If a guest is required to purchase an attraction ticket directly due to age, height, or attraction-specific eligibility rules, the ticket cost will be borne directly by the guest at the gate.'
  ];

  const formatValidUntil = (val?: string) => {
    if (!val) return '14 Days from issuance';
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return val;
  };

  const formatCreatedDate = (val?: string) => {
    if (!val) return new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return val;
  };

  return {
    quoteId: quote.id || quote.quoteNumber || 'UBQ-2026',
    quoteNumber: quote.quoteNumber || quote.id || 'UBQ-2026',
    version: quote.version || 1,
    status: quote.status || 'DRAFT',
    createdDateFormatted: formatCreatedDate(quote.createdAt),
    validUntilFormatted: formatValidUntil(quote.validUntil),
    currency: effectiveCurrency,
    totalSellingPriceNumeric: effectiveSellingPrice,
    agencyName: effectiveAgency || 'theunbound',
    agentName: effectiveAgentName,
    agentEmail: effectiveAgentEmail,
    agentPhone: effectiveAgentPhone,
    agentLogoUrl: effectiveAgentLogoUrl,
    agentAgencySubtitle: effectiveAgency 
      ? 'Authorized Travel Partner • In Association with TheUnbound Luxury DMC Network'
      : 'Destination Management Operations • Direct Ground Logistics & Destination Operations Hub',
    agentNotes: effectiveAgentNotes,
    clientName: quote.clientName && quote.clientName !== 'Client Name Pending' ? quote.clientName : (quote.clientName || 'Valued Guest'),
    clientCompany: quote.clientCompany,
    clientEmail: quote.clientEmail,
    clientPhone: quote.clientPhone,
    destination: quote.destination || 'Japan',
    totalDays: days.length,
    totalNights,
    effectivePax,
    adultsCount: adultsDisplay,
    childrenCount: childrenDisplay,
    infantsCount: infantsDisplay,
    paxDetailsText,
    nationality: quote.nationality,
    travelStyle: quote.travelStyle,
    dateSpanText,
    travelStartDate: quote.travelStartDate,
    travelEndDate: quote.travelEndDate,
    selectedOptionTitle,
    selectedOptionNumber,
    pricePerPersonFormatted: formatCurrency(pricePerPerson, effectiveCurrency),
    routeHubs: sortedHubs.map(h => ({ hubName: h.hubName || h.destinationName || quote.destination || 'Hub', nights: h.nights || 1 })),
    hotels,
    accommodations,
    hasHotelAccommodation,
    hotelAccommodationTotalNumeric,
    hotelAccommodationTotalFormatted,
    hotelItemsCount,
    hasLandServices,
    landPartTotalNumeric,
    landPartTotalFormatted,
    landItemsCount,
    visaServices: visaItems.map(it => transformQuoteItemToPresentation(it, effectiveCurrency)),
    days,
    additionalServices: generalInclusions,
    operationalStandards,
    totalItineraryValueFormatted: landPartTotalFormatted,
    pricePerTravelerFormatted: `${formatCurrency(pricePerPerson, effectiveCurrency)} / Traveler (${effectivePax} Guests)`,
    guaranteedCurrencyLine: `Guaranteed in ${effectiveCurrency} • No Hidden Surcharges`,
    childAndAttractionPolicies,
    commercialTerms: quote.termsAndConditions || 'This quotation is issued by TheUnbound Luxury DMC Network. Rates are valid for 14 calendar days from generation date. All reservations subject to live inventory confirmation upon deposit.',
    footerContactLine: 'TheUnbound DMC Global Ground Logistics • sales@theunbound.in • Official Contracted Quotation Document'
  };
}

// ============================================================================
// CANONICAL CHANNEL RENDERER 1: COMPLETE EMAIL RENDERER (HTML + PLAIN TEXT)
// ============================================================================

export function renderQuoteEmailFromPresentationModel(
  model: QuotePresentationModel,
  customNote?: string,
  mode: 'PROPOSAL_VIEW' | 'PLAIN_TEXT' = 'PROPOSAL_VIEW'
): {
  subject: string;
  htmlBody: string;
  textBody: string;
  proposalViewHtml: string;
  simpleSemanticHtml: string;
} {
  const subject = `Bespoke Itinerary & Quotation Proposal [${model.quoteNumber} v${model.version}] — ${model.destination} (${model.totalDays} Days / ${model.totalNights} Nights) — ${model.clientName}`;

  const routeString = model.routeHubs.length > 0
    ? model.routeHubs.map(h => `${h.hubName} (${h.nights} ${h.nights === 1 ? 'Night' : 'Nights'})`).join(' → ')
    : model.destination;

  // 1. Build Complete Plain-Text Representation (mirrors 100% of Quote Preview)
  const textSections: string[] = [];

  textSections.push([
    `${model.agencyName.toUpperCase()} — OFFICIAL ITINERARY & QUOTATION PROPOSAL`,
    model.agentAgencySubtitle,
    ``,
    `Quote Reference : ${model.quoteNumber} (v${model.version})`,
    `Quote ID        : ${model.quoteId}`,
    `Status          : ${model.status}`,
    `Issue Date      : ${model.createdDateFormatted}`,
    `Valid Until     : ${model.validUntilFormatted}`,
    model.selectedOptionTitle ? `Selected Option : ${model.selectedOptionTitle}` : ''
  ].filter(Boolean).join('\n'));

  if (customNote && customNote.trim()) {
    textSections.push([
      `PERSONAL NOTE FROM ${model.agentName.toUpperCase()}:`,
      customNote.trim()
    ].join('\n'));
  }

  textSections.push([
    `1. CURATED JOURNEY OVERVIEW`,
    `Itinerary       : ${model.destination} Bespoke Travel Itinerary`,
    `Destination     : ${model.destination}`,
    `Route & Hubs    : ${routeString}`,
    `Duration        : ${model.totalDays} Days / ${model.totalNights} Nights`,
    `Travel Dates    : ${model.dateSpanText || 'Flexible Dates'}`,
    `Passengers      : ${model.paxDetailsText}`,
    model.nationality ? `Nationality     : ${model.nationality}` : '',
    model.travelStyle ? `Travel Style    : ${model.travelStyle}` : '',
    ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
      `Hotel Accommodation Total : ${model.hotelAccommodationTotalFormatted}`
    ] : []),
    `Land Part Total : ${model.landPartTotalFormatted}`
  ].filter(Boolean).join('\n'));

  textSections.push([
    `2. CLIENT & SPECIALIST DOSSIER`,
    `Prepared For (Client):`,
    `  Name          : ${model.clientName}`,
    model.clientCompany ? `  Company       : ${model.clientCompany}` : '',
    model.clientEmail ? `  Email         : ${model.clientEmail}` : '',
    model.clientPhone ? `  Phone         : ${model.clientPhone}` : '',
    ``,
    `Prepared By (Specialist):`,
    `  Specialist    : ${model.agentName}`,
    `  Agency        : ${model.agencyName}`,
    model.agentEmail ? `  Email         : ${model.agentEmail}` : '',
    model.agentPhone ? `  Phone         : ${model.agentPhone}` : '',
    model.agentNotes ? `  Agent Notes   : ${model.agentNotes}` : ''
  ].filter(Boolean).join('\n'));

  if (model.accommodations && model.accommodations.length > 0) {
    const accommodationLines = [
      `3. ACCOMMODATION & HOTEL STAYS (${model.accommodations.length} ${model.accommodations.length === 1 ? 'STAY' : 'STAYS'})`
    ];
    model.accommodations.forEach((acc, idx) => {
      accommodationLines.push(
        `[${idx + 1}] ${acc.hotelName} (${acc.city})`,
        `    Stay Dates  : ${acc.checkInDate || 'TBD'} → ${acc.checkOutDate || 'TBD'} (${acc.nights} ${acc.nights === 1 ? 'Night' : 'Nights'})`,
        acc.roomSummary ? `    Room Config : ${acc.roomSummary}` : ''
      );
    });
    textSections.push(accommodationLines.filter(Boolean).join('\n'));
  } else if (model.hotels.length > 0) {
    const hotelLines = [
      `3. CURATED ACCOMMODATION SUMMARY (${model.hotels.length} ${model.hotels.length === 1 ? 'STAY' : 'STAYS'})`
    ];
    model.hotels.forEach((h, idx) => {
      hotelLines.push(
        `[${idx + 1}] ${h.hotelName} (${h.cityHub}${h.starRating ? ` • ${h.starRating}` : ''})`,
        `    Stay Dates  : ${h.checkInDate} → ${h.checkOutDate} (${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'})`,
        `    Room & Meal : ${h.roomsCount} × ${h.roomType} | ${h.mealPlan} | Occupancy: ${h.occupancy}`,
        h.overview ? `    Overview    : ${convertHtmlToCleanPlainText(h.overview)}` : '',
        h.inclusions.length > 0 ? `    Inclusions  : ${h.inclusions.join(' | ')}` : '',
        h.exclusions.length > 0 ? `    Exclusions  : ${h.exclusions.join(' | ')}` : '',
        h.notes ? `    Stay Notes  : ${convertHtmlToCleanPlainText(h.notes)}` : ''
      );
    });
    textSections.push(hotelLines.filter(Boolean).join('\n'));
  }

  if (model.visaServices.length > 0) {
    const visaLines = [
      `4. VISA & ANCILLARY SERVICES (${model.visaServices.length} INCLUDED)`
    ];
    model.visaServices.forEach((v, idx) => {
      visaLines.push(
        `[${idx + 1}] ${v.listingName} (${v.categoryLabel}) [${v.paxText}] • Included`,
        v.duration ? `    Duration        : ${v.duration}` : '',
        v.configurationSummary ? `    Specifications  : ${v.configurationSummary}` : '',
        v.overview ? `    Overview        : ${convertHtmlToCleanPlainText(v.overview)}` : '',
        v.inclusions.length > 0 ? `    Inclusions      : ${v.inclusions.map(i => `✓ ${i}`).join(' | ')}` : '',
        v.exclusions.length > 0 ? `    Exclusions      : ${v.exclusions.map(e => `✕ ${e}`).join(' | ')}` : '',
        v.specialInstructions ? `    Special Notes   : ${convertHtmlToCleanPlainText(v.specialInstructions)}` : ''
      );
    });
    textSections.push(visaLines.filter(Boolean).join('\n'));
  }

  const daySectionLines: string[] = [
    `5. DAY-BY-DAY CHRONOLOGICAL ITINERARY (${model.days.length} DAYS)`
  ];

  model.days.forEach(day => {
    const transitionBadge = day.isTransitionDay && day.prevHubName ? ` [Transfer: ${day.prevHubName} → ${day.hubName}]` : '';
    const themeText = day.customTheme ? ` • ${day.customTheme}` : '';
    daySectionLines.push(
      ``,
      `DAY ${String(day.dayNumber).padStart(2, '0')}: ${day.dayOfWeek}, ${day.formattedDate} — ${day.hubName} Base${transitionBadge}${themeText}`
    );

    if (day.dayOverview) {
      daySectionLines.push(`Day ${day.dayNumber} Overview: ${convertHtmlToCleanPlainText(day.dayOverview)}`);
    }

    if (day.services.length === 0) {
      daySectionLines.push(
        `  • Day at Leisure in ${day.hubName} (Self-Paced)`,
        `    Free time for personal exploration, neighborhood shopping, and local dining discoveries.`
      );
    } else {
      day.services.forEach((s, sIdx) => {
        daySectionLines.push(
          `  [${sIdx + 1}] ${s.listingName} (${s.categoryLabel})`,
          `      Allotment Status : ${s.statusText} (${s.paxText})`,
          (s.duration || s.serviceTime) ? `      Schedule       : ${[s.duration ? `Duration: ${s.duration}` : '', s.serviceTime ? `Time: ${s.serviceTime}` : ''].filter(Boolean).join(' • ')}` : '',
          s.configurationSummary ? `      Specifications : ${s.configurationSummary}` : '',
          s.meetingPoint ? `      Meeting Point  : ${s.meetingPoint}` : '',
          s.pickupPoint ? `      Pickup Point   : ${s.pickupPoint}` : '',
          s.dropoffPoint ? `      Drop-off Point : ${s.dropoffPoint}` : '',
          (s.isRail && s.railDetails) ? `      Bullet Train   : ${s.railDetails.origin} → ${s.railDetails.destination} | ${s.railDetails.carType} (${s.railDetails.seatType}) | ${s.railDetails.serviceGroup}${s.railDetails.seatPreference ? ` | Seat: ${s.railDetails.seatPreference}` : ''}${s.railDetails.pnrReference ? ` | PNR: ${s.railDetails.pnrReference}` : ''}` : '',
          s.overview ? `      Overview       : ${convertHtmlToCleanPlainText(s.overview)}` : '',
          s.inclusions.length > 0 ? `      Inclusions     : ${s.inclusions.map(i => `✓ ${i}`).join(' | ')}` : '',
          s.exclusions.length > 0 ? `      Exclusions     : ${s.exclusions.map(e => `✕ ${e}`).join(' | ')}` : '',
          s.specialInstructions ? `      Instructions   : ${convertHtmlToCleanPlainText(s.specialInstructions)}` : ''
        );
      });
    }

    if (day.dayNotes) {
      daySectionLines.push(`  Day ${day.dayNumber} Operational Notes: ${convertHtmlToCleanPlainText(day.dayNotes)}`);
    }
  });

  textSections.push(daySectionLines.filter(Boolean).join('\n'));

  if (model.additionalServices.length > 0) {
    const addLines = [
      `6. ADDITIONAL PACKAGE SERVICES & PRIVILEGES`
    ];
    model.additionalServices.forEach((a, idx) => {
      addLines.push(
        `  [${idx + 1}] ${a.name} • Included`,
        `      Details    : ${a.summary}`,
        a.overview ? `      Overview   : ${convertHtmlToCleanPlainText(a.overview)}` : '',
        (a.inclusions && a.inclusions.length > 0) ? `      Inclusions : ${a.inclusions.join(' | ')}` : '',
        (a.exclusions && a.exclusions.length > 0) ? `      Exclusions : ${a.exclusions.join(' | ')}` : '',
        a.specialInstructions ? `      Notes      : ${convertHtmlToCleanPlainText(a.specialInstructions)}` : ''
      );
    });
    textSections.push(addLines.filter(Boolean).join('\n'));
  }

  textSections.push([
    `7. GROUND OPERATIONS STANDARDS & INCLUSIONS`,
    ...model.operationalStandards.map(op => `  • ${op.title}: ${op.desc}`)
  ].join('\n'));

  textSections.push([
    `8. TOTAL PACKAGE INVESTMENT`,
    ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
      `Hotel Accommodation Total        : ${model.hotelAccommodationTotalFormatted}`
    ] : []),
    `Land Part Total                  : ${model.landPartTotalFormatted}`,
    `Currency & Tax Guarantee         : ${model.guaranteedCurrencyLine}`,
    `Quotation Valid Until            : ${model.validUntilFormatted}`
  ].join('\n'));

  textSections.push([
    `9. OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY`,
    ...model.childAndAttractionPolicies.map(p => `  • ${p}`)
  ].join('\n'));

  textSections.push([
    `10. COMMERCIAL QUOTATION TERMS & CONDITIONS`,
    convertHtmlToCleanPlainText(model.commercialTerms),
    ``,
    convertHtmlToCleanPlainText(model.footerContactLine)
  ].join('\n'));

  const textBody = textSections.join('\n\n');

  // Option 1: Proposal View Rich HTML Email (adapted for responsive email clients)
  const proposalViewHtml = renderProposalViewHtmlEmail(model, customNote);

  // Option 2: Complete Plain-Text Quotation (Simple Semantic Formatted HTML)
  const simpleSemanticHtml = formatPlainTextQuotationToHtml(textBody);

  const htmlBody = mode === 'PLAIN_TEXT' ? simpleSemanticHtml : proposalViewHtml;

  return {
    subject,
    htmlBody,
    textBody,
    proposalViewHtml,
    simpleSemanticHtml
  };
}

// ============================================================================
// CANONICAL CHANNEL RENDERER 2: COMPLETE WHATSAPP RENDERER
// ============================================================================

export function renderQuoteWhatsAppFromPresentationModel(
  model: QuotePresentationModel,
  options?: {
    customNote?: string;
    useEmojis?: boolean;
    formatStyle?: 'DETAILED' | 'SUMMARY';
  }
): string {
  const useEmojis = options?.useEmojis !== false;
  const DIVIDER = useEmojis ? '━━━━━━━━━━━━━━━━━━━━━' : '------------------------';
  const sections: string[] = [];

  const routeString = model.routeHubs.length > 0
    ? model.routeHubs.map(h => `${h.hubName} (${h.nights}N)`).join(useEmojis ? ' ➔ ' : ' -> ')
    : model.destination;

  // 1. Header, Quote Reference, Client & Agent Details, Trip Overview
  const headerLines: string[] = [];
  if (useEmojis) {
    headerLines.push(
      `✨ *OFFICIAL TRAVEL QUOTATION PROPOSAL* ✨`,
      `📋 *Quote Reference:* *#${model.quoteNumber}* (v${model.version})`,
      `🆔 *Quote ID:* ${model.quoteId} | *Status:* ${model.status}`,
      `📅 *Issued:* ${model.createdDateFormatted} | *Valid Until:* ${model.validUntilFormatted}`,
      ``,
      `👋 *Prepared For:* *${model.clientName}*`,
      model.clientCompany ? `🏢 *Client Organization:* ${model.clientCompany}` : '',
      model.clientEmail ? `✉️ *Client Email:* ${model.clientEmail}` : '',
      model.clientPhone ? `📞 *Client Phone:* ${model.clientPhone}` : '',
      ``,
      `🌍 *Destination:* *${model.destination.toUpperCase()}*`,
      `🗓️ *Duration:* ${model.totalDays} Days / ${model.totalNights} Nights`,
      `✈️ *Travel Dates:* ${model.dateSpanText || 'Flexible Dates'}`,
      `👥 *Passengers:* ${model.paxDetailsText}`,
      model.nationality ? `🛂 *Nationality:* ${model.nationality}` : '',
      model.travelStyle ? `💎 *Travel Style:* ${model.travelStyle}` : '',
      model.selectedOptionTitle ? `🌟 *Curated Option:* ${model.selectedOptionTitle}` : '',
      `🗺️ *Route & Hubs:* ${routeString}`
    );
  } else {
    headerLines.push(
      `*OFFICIAL TRAVEL QUOTATION PROPOSAL*`,
      `Quote Reference: *#${model.quoteNumber}* (v${model.version})`,
      `Quote ID: ${model.quoteId} | Status: ${model.status}`,
      `Issued: ${model.createdDateFormatted} | Valid Until: ${model.validUntilFormatted}`,
      ``,
      `Prepared For: *${model.clientName}*`,
      model.clientCompany ? `Organization: ${model.clientCompany}` : '',
      model.clientEmail ? `Client Email: ${model.clientEmail}` : '',
      model.clientPhone ? `Client Phone: ${model.clientPhone}` : '',
      ``,
      `Destination: *${model.destination.toUpperCase()}*`,
      `Duration: ${model.totalDays} Days / ${model.totalNights} Nights`,
      `Travel Dates: ${model.dateSpanText || 'Flexible Dates'}`,
      `Passengers: ${model.paxDetailsText}`,
      model.nationality ? `Nationality: ${model.nationality}` : '',
      model.travelStyle ? `Travel Style: ${model.travelStyle}` : '',
      model.selectedOptionTitle ? `Selected Option: ${model.selectedOptionTitle}` : '',
      `Route & Hubs: ${routeString}`
    );
  }
  sections.push(headerLines.filter(l => l !== '').join('\n').replace(/\n\n+/g, '\n\n'));

  // 2. Curated Accommodation & Luxury Stays
  if (model.accommodations && model.accommodations.length > 0) {
    const accLines: string[] = [
      useEmojis ? `🏨 *ACCOMMODATION & STAYS (${model.accommodations.length})*` : `*ACCOMMODATION & STAYS (${model.accommodations.length})*`
    ];
    model.accommodations.forEach(acc => {
      const isNoAcc = acc.hotelName.includes('No Accommodation') || acc.isNoAccommodation;
      if (useEmojis) {
        accLines.push(
          `• 🏙️ *${acc.city.toUpperCase()}* — *${acc.nights}* ${acc.nights === 1 ? 'Night' : 'Nights'}\n  ${isNoAcc ? '🚫' : '⭐'} *${acc.hotelName}*${acc.roomSummary ? ` | ${acc.roomSummary}` : ''}${acc.checkInDate && acc.checkOutDate ? `\n  📅 ${acc.checkInDate} ➔ ${acc.checkOutDate}` : ''}`
        );
      } else {
        accLines.push(
          `• *${acc.city.toUpperCase()}* — ${acc.nights} ${acc.nights === 1 ? 'Night' : 'Nights'}\n  ${acc.hotelName}${acc.roomSummary ? ` | ${acc.roomSummary}` : ''}${acc.checkInDate && acc.checkOutDate ? `\n  Stay Dates: ${acc.checkInDate} to ${acc.checkOutDate}` : ''}`
        );
      }
    });
    sections.push(accLines.join('\n'));
  } else if (model.hotels.length > 0) {
    const hotelLines: string[] = [
      useEmojis ? `🏨 *CURATED ACCOMMODATION & LUXURY STAYS (${model.hotels.length})*` : `*ACCOMMODATION & STAYS (${model.hotels.length})*`
    ];
    model.hotels.forEach(h => {
      const hotelOverview = h.overview ? richTextToWhatsApp(h.overview) : '';
      const hotelNotes = h.notes ? richTextToWhatsApp(h.notes) : '';
      if (useEmojis) {
        const entry = [
          `• 🏙️ *${h.cityHub.toUpperCase()}* — *${h.nightsCount}* ${h.nightsCount === 1 ? 'Night' : 'Nights'}`,
          `  ⭐ *${h.hotelName}*${h.starRating ? ` (${h.starRating})` : ''}`,
          `  🛏️ *Room:* ${h.roomsCount} × ${h.roomType} | 🍳 *Meal Plan:* ${h.mealPlan}`,
          `  📅 *Stay Dates:* ${h.checkInDate} ➔ ${h.checkOutDate}`,
          hotelOverview ? `  📝 *Overview:* ${hotelOverview}` : '',
          h.inclusions.length > 0 ? `  ✅ *Inclusions:* ${h.inclusions.map(i => richTextToWhatsApp(i)).join(', ')}` : '',
          h.exclusions.length > 0 ? `  ❌ *Exclusions:* ${h.exclusions.map(e => richTextToWhatsApp(e)).join(', ')}` : '',
          hotelNotes ? `  💡 *Notes:* ${hotelNotes}` : ''
        ].filter(Boolean).join('\n');
        hotelLines.push(entry);
      } else {
        const entry = [
          `• *${h.cityHub.toUpperCase()}* — ${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'}`,
          `  ${h.hotelName}${h.starRating ? ` (${h.starRating})` : ''} | ${h.roomsCount} × ${h.roomType} • ${h.mealPlan}`,
          `  Stay Dates: ${h.checkInDate} to ${h.checkOutDate}`,
          hotelOverview ? `  Overview: ${hotelOverview}` : '',
          h.inclusions.length > 0 ? `  Inclusions: ${h.inclusions.map(i => richTextToWhatsApp(i)).join(', ')}` : '',
          h.exclusions.length > 0 ? `  Exclusions: ${h.exclusions.map(e => richTextToWhatsApp(e)).join(', ')}` : '',
          hotelNotes ? `  Notes: ${hotelNotes}` : ''
        ].filter(Boolean).join('\n');
        hotelLines.push(entry);
      }
    });
    sections.push(hotelLines.join('\n'));
  }

  // 3. Visa & Ancillary Services
  if (model.visaServices.length > 0) {
    const visaLines: string[] = [
      useEmojis ? `🛂 *VISA & ANCILLARY SERVICES (${model.visaServices.length} INCLUDED)*` : `*VISA & ANCILLARY SERVICES (${model.visaServices.length} INCLUDED)*`
    ];
    model.visaServices.forEach(v => {
      const vOverview = v.overview ? richTextToWhatsApp(v.overview) : '';
      const vInstructions = v.specialInstructions ? richTextToWhatsApp(v.specialInstructions) : '';
      const lines = [
        useEmojis
          ? `• 📑 *${v.listingName}* [${v.categoryLabel}] • *Included* (${v.paxText})`
          : `• *${v.listingName}* [${v.categoryLabel}] • Included (${v.paxText})`,
        v.duration ? `  ⏱️ Duration: ${v.duration}` : '',
        v.configurationSummary ? `  ⚙️ Specs: ${v.configurationSummary}` : '',
        vOverview ? `  📖 Overview: ${vOverview}` : '',
        v.inclusions.length > 0 ? `  ✅ Inclusions: ${v.inclusions.map(i => richTextToWhatsApp(i)).join(', ')}` : '',
        v.exclusions.length > 0 ? `  ❌ Exclusions: ${v.exclusions.map(e => richTextToWhatsApp(e)).join(', ')}` : '',
        vInstructions ? `  💡 Notes: ${vInstructions}` : ''
      ].filter(Boolean);
      visaLines.push(lines.join('\n'));
    });
    sections.push(visaLines.join('\n'));
  }

  // 4. Complete Day-by-Day Chronological Itinerary (Always included in full)
  if (model.days.length > 0) {
    const planLines: string[] = [
      useEmojis ? `🗺️ *DAY-BY-DAY CHRONOLOGICAL ITINERARY (${model.days.length} DAYS)*` : `*DAY-BY-DAY CHRONOLOGICAL ITINERARY (${model.days.length} DAYS)*`
    ];

    model.days.forEach(day => {
      const transitionStr = day.isTransitionDay && day.prevHubName ? ` [Transfer: ${day.prevHubName} ➔ ${day.hubName}]` : '';
      const themeStr = day.customTheme ? ` — ${day.customTheme}` : '';
      const dayHeader = useEmojis
        ? `📅 *DAY ${day.dayNumber} (${day.dayOfWeek}, ${day.formattedDate}): ${day.hubName} Base*${transitionStr}${themeStr}`
        : `*DAY ${day.dayNumber} (${day.dayOfWeek}, ${day.formattedDate}): ${day.hubName} Base*${transitionStr}${themeStr}`;

      const dayItems: string[] = [dayHeader];

      if (day.dayOverview) {
        dayItems.push(`  📝 *Day Overview:* ${richTextToWhatsApp(day.dayOverview)}`);
      }

      if (day.services.length === 0) {
        dayItems.push(
          useEmojis
            ? `  🧭 *Day at Leisure in ${day.hubName}* — Free time for personal exploration, shopping & local dining.`
            : `  • Day at Leisure in ${day.hubName} — Free time for personal exploration, shopping & local dining.`
        );
      } else {
        day.services.forEach(s => {
          const icon = s.isRail ? '🚅' : s.categoryLabel.includes('Accommodation') ? '🏨' : s.categoryLabel.includes('Transfer') ? '🚗' : '🎟️';
          const sLines: string[] = [
            useEmojis
              ? `  ${icon} *${s.listingName}* (${s.categoryLabel}) [${s.paxText}]`
              : `  • *${s.listingName}* (${s.categoryLabel}) [${s.paxText}]`
          ];

          if (s.duration || s.serviceTime) {
            const sched = [s.duration ? `Duration: ${s.duration}` : '', s.serviceTime ? `Time: ${s.serviceTime}` : ''].filter(Boolean).join(' | ');
            sLines.push(`     ⏱️ ${sched}`);
          }
          if (s.configurationSummary && !s.isRail) {
            sLines.push(`     ⚙️ Specs: ${s.configurationSummary}`);
          }
          if (s.meetingPoint) {
            sLines.push(`     📍 Meeting Point: ${s.meetingPoint}`);
          }
          if (s.pickupPoint) {
            sLines.push(`     🚗 Pickup: ${s.pickupPoint}`);
          }
          if (s.dropoffPoint) {
            sLines.push(`     🏁 Drop-off: ${s.dropoffPoint}`);
          }
          if (s.isRail && s.railDetails) {
            sLines.push(
              `     🚄 Bullet Train: ${s.railDetails.origin} ➔ ${s.railDetails.destination} • ${s.railDetails.carType} (${s.railDetails.seatType}) • ${s.railDetails.serviceGroup}${s.railDetails.seatPreference ? ` • Seat: ${s.railDetails.seatPreference}` : ''}${s.railDetails.pnrReference ? ` • PNR: ${s.railDetails.pnrReference}` : ''}`
            );
          }
          const sOverview = s.overview ? richTextToWhatsApp(s.overview) : '';
          if (sOverview) {
            sLines.push(`     📖 Overview: ${sOverview}`);
          }
          if (s.inclusions.length > 0) {
            sLines.push(`     ✅ Inclusions: ${s.inclusions.map(i => richTextToWhatsApp(i)).join(', ')}`);
          }
          if (s.exclusions.length > 0) {
            sLines.push(`     ❌ Exclusions: ${s.exclusions.map(e => richTextToWhatsApp(e)).join(', ')}`);
          }
          const sInstructions = s.specialInstructions ? richTextToWhatsApp(s.specialInstructions) : '';
          if (sInstructions) {
            sLines.push(`     💡 Instructions: ${sInstructions}`);
          }
          dayItems.push(sLines.join('\n'));
        });
      }

      if (day.dayNotes) {
        dayItems.push(`  📌 *Day ${day.dayNumber} Notes:* ${richTextToWhatsApp(day.dayNotes)}`);
      }

      dayItems.push(useEmojis ? `  🛌 *Overnight Hub:* ${day.hubName}` : `  • Overnight Hub: ${day.hubName}`);
      planLines.push(dayItems.join('\n'));
      planLines.push(useEmojis ? `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈` : `------------------------`);
    });

    if (planLines[planLines.length - 1].startsWith('┈') || planLines[planLines.length - 1].startsWith('-')) {
      planLines.pop();
    }
    sections.push(planLines.join('\n'));
  }

  // 5. Additional Package Services & Privileges
  if (model.additionalServices.length > 0) {
    const addLines: string[] = [
      useEmojis ? `✨ *ADDITIONAL PACKAGE SERVICES & PRIVILEGES*` : `*ADDITIONAL PACKAGE SERVICES & PRIVILEGES*`
    ];
    model.additionalServices.forEach(a => {
      const aSummary = a.summary ? richTextToWhatsApp(a.summary) : '';
      const aOverview = a.overview ? richTextToWhatsApp(a.overview) : '';
      const aInstructions = a.specialInstructions ? richTextToWhatsApp(a.specialInstructions) : '';
      addLines.push(
        useEmojis
          ? `• 💎 *${a.name}* • *Included*\n  ${aSummary}${aOverview ? `\n  Overview: ${aOverview}` : ''}${aInstructions ? `\n  Notes: ${aInstructions}` : ''}`
          : `• *${a.name}* • Included\n  ${aSummary}${aOverview ? `\n  Overview: ${aOverview}` : ''}${aInstructions ? `\n  Notes: ${aInstructions}` : ''}`
      );
    });
    sections.push(addLines.join('\n'));
  }

  // 6. Ground Operations Standards
  const stdLines: string[] = [
    useEmojis ? `🛡️ *GROUND OPERATIONS STANDARDS & GUARANTEES*` : `*GROUND OPERATIONS STANDARDS & GUARANTEES*`
  ];
  model.operationalStandards.forEach(op => {
    stdLines.push(`• *${op.title}:* ${op.desc}`);
  });
  sections.push(stdLines.join('\n'));

  // 7. Operational Guidelines & Child / Attraction Policies
  if (model.childAndAttractionPolicies.length > 0) {
    const polLines: string[] = [
      useEmojis ? `ℹ️ *OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY*` : `*OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY*`
    ];
    model.childAndAttractionPolicies.forEach(p => {
      polLines.push(`• ${p}`);
    });
    sections.push(polLines.join('\n'));
  }

  // 8. YOUR TRAVEL QUOTATION (PRICING SUMMARY)
  const priceLines: string[] = [];
  const cleanCommercialTerms = richTextToWhatsApp(model.commercialTerms);
  if (useEmojis) {
    priceLines.push(
      `💰 *Your Travel Quotation*`,
      ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
        ``,
        `🏨 *Hotel Accommodation Total:* ${model.hotelAccommodationTotalFormatted}`
      ] : []),
      ``,
      `🏷️ *Land Part Total:* ${model.landPartTotalFormatted}`,
      ``,
      `💱 *Currency & Taxes:* ${model.guaranteedCurrencyLine}`,
      `⏳ *Quote Valid Until:* *${model.validUntilFormatted}*`,
      ``,
      `📜 *Commercial Terms & Conditions:*`,
      cleanCommercialTerms
    );
  } else {
    priceLines.push(
      `*Your Travel Quotation*`,
      ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
        ``,
        `Hotel Accommodation Total: ${model.hotelAccommodationTotalFormatted}`
      ] : []),
      ``,
      `Land Part Total: ${model.landPartTotalFormatted}`,
      ``,
      `Currency & Taxes: ${model.guaranteedCurrencyLine}`,
      `Quote Valid Until: ${model.validUntilFormatted}`,
      ``,
      `*Commercial Terms & Conditions:*`,
      cleanCommercialTerms
    );
  }
  sections.push(priceLines.join('\n'));

  // 9. Personal Note
  if (options?.customNote && options.customNote.trim()) {
    const cleanCustomNote = richTextToWhatsApp(options.customNote.trim());
    sections.push(
      useEmojis
        ? `📝 *PERSONAL NOTE FROM YOUR TRAVEL DESIGNER:*\n"${cleanCustomNote}"`
        : `*PERSONAL NOTE:*\n${cleanCustomNote}`
    );
  }

  // 10. Quick Replies & Concierge Contact
  const interactiveLines: string[] = [];
  if (useEmojis) {
    interactiveLines.push(
      `📲 *INTERACTIVE QUICK REPLIES (TAP TO RESPOND):*`,
      `1️⃣ *Reply "1" or "CONFIRM"* ➔ Lock in dates & receive booking voucher + invoice`,
      `2️⃣ *Reply "2" or "CUSTOMIZE"* ➔ Adjust dates, swap hotels, or customize activities`,
      `3️⃣ *Reply "3" or "CALL ME"* ➔ Request a consultation call with our destination specialist`,
      `4️⃣ *Reply "4" or "PDF"* ➔ Receive full high-resolution official PDF proposal brochure`,
      ``,
      `🛎️ *DEDICATED TRAVEL CONCIERGE*`,
      `👤 *${model.agentName}*`,
      `🏢 ${model.agencyName}`,
      model.agentPhone ? `📞 WhatsApp / Direct: ${model.agentPhone}` : '',
      model.agentEmail ? `✉️ Email: ${model.agentEmail}` : ''
    );
  } else {
    interactiveLines.push(
      `*HOW TO PROCEED (QUICK REPLIES):*`,
      `[1] Confirm & Request Booking Invoice`,
      `[2] Customize Hotels, Dates or Itinerary`,
      `[3] Request a Call with our Destination Specialist`,
      `[4] Request Official PDF Proposal Document`,
      ``,
      `*TRAVEL CONCIERGE & DESK*`,
      `Prepared by: *${model.agentName}* (${model.agencyName})`,
      model.agentPhone ? `WhatsApp / Tel: ${model.agentPhone}` : '',
      model.agentEmail ? `Email: ${model.agentEmail}` : ''
    );
  }
  sections.push(interactiveLines.filter(Boolean).join('\n'));

  return sections.join(`\n\n${DIVIDER}\n\n`);
}

// ============================================================================
// CANONICAL COMPLETENESS VALIDATOR (PREVIEW vs PDF vs EMAIL vs WHATSAPP)
// ============================================================================

export interface QuoteChannelCompletenessReport {
  isComplete: boolean;
  missingInEmailHtml: string[];
  missingInEmailText: string[];
  missingInWhatsApp: string[];
  checkedElementsCount: number;
}

export function validateQuotePresentationCompleteness(
  model: QuotePresentationModel,
  emailOutput?: { subject: string; htmlBody: string; textBody: string },
  whatsAppOutput?: string
): QuoteChannelCompletenessReport {
  const email = emailOutput || renderQuoteEmailFromPresentationModel(model);
  const whatsapp = whatsAppOutput || renderQuoteWhatsAppFromPresentationModel(model);

  const missingInEmailHtml: string[] = [];
  const missingInEmailText: string[] = [];
  const missingInWhatsApp: string[] = [];

  const requiredTokens: { label: string; value: string }[] = [
    { label: 'Quote Reference', value: model.quoteNumber },
    { label: 'Client Name', value: model.clientName },
    { label: 'Destination', value: model.destination },
    { label: 'Passenger Summary', value: model.paxDetailsText },
    { label: 'Land Part Total', value: model.landPartTotalFormatted },
    { label: 'Agent Name', value: model.agentName },
    { label: 'Agency Name', value: model.agencyName },
    { label: 'Valid Until Date', value: model.validUntilFormatted },
    ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
      { label: 'Hotel Accommodation Total', value: model.hotelAccommodationTotalFormatted }
    ] : [])
  ];

  model.hotels.forEach(h => {
    requiredTokens.push({ label: `Hotel: ${h.hotelName}`, value: h.hotelName });
  });

  model.visaServices.forEach(v => {
    requiredTokens.push({ label: `Visa Service: ${v.listingName}`, value: v.listingName });
  });

  model.days.forEach(d => {
    requiredTokens.push({ label: `Day ${d.dayNumber} Hub`, value: d.hubName });
    d.services.forEach(s => {
      requiredTokens.push({ label: `Day ${d.dayNumber} Service: ${s.listingName}`, value: s.listingName });
      if (s.meetingPoint) {
        requiredTokens.push({ label: `Meeting Point: ${s.meetingPoint}`, value: s.meetingPoint });
      }
      if (s.pickupPoint) {
        requiredTokens.push({ label: `Pickup Point: ${s.pickupPoint}`, value: s.pickupPoint });
      }
      if (s.dropoffPoint) {
        requiredTokens.push({ label: `Dropoff Point: ${s.dropoffPoint}`, value: s.dropoffPoint });
      }
    });
  });

  requiredTokens.forEach(token => {
    if (!token.value) return;
    if (!email.htmlBody.includes(token.value)) {
      missingInEmailHtml.push(token.label);
    }
    if (!email.textBody.includes(token.value)) {
      missingInEmailText.push(token.label);
    }
    if (!whatsapp.includes(token.value)) {
      missingInWhatsApp.push(token.label);
    }
  });

  return {
    isComplete:
      missingInEmailHtml.length === 0 &&
      missingInEmailText.length === 0 &&
      missingInWhatsApp.length === 0,
    missingInEmailHtml,
    missingInEmailText,
    missingInWhatsApp,
    checkedElementsCount: requiredTokens.length
  };
}

export function generateWhatsAppSummaryText(
  model: QuotePresentationModel,
  options?: {
    customNote?: string;
    useEmojis?: boolean;
    formatStyle?: 'DETAILED' | 'SUMMARY';
  }
): string {
  return renderQuoteWhatsAppFromPresentationModel(model, options);
}

export function generateEmailPlainTextSummary(
  model: QuotePresentationModel,
  customNote?: string
): string {
  return renderQuoteEmailFromPresentationModel(model, customNote).textBody;
}

export { 
  renderProposalViewHtmlEmail,
  renderStructuredQuotationHtmlEmail, 
  formatPlainTextQuotationToHtml,
  formatPlainTextQuotationToSimpleSemanticHtml,
  renderSimpleSemanticQuotationEmailFromModel
} from './quoteEmailFormatter';



