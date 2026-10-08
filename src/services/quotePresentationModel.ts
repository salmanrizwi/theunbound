import { Quotation, QuoteItem, TripRouteHub } from '../types';
import { formatCurrency } from './pricingEngine';
import { getInventoryDisplayName, getInventoryConfigurationSummary } from '../utils/inventoryDisplayHelpers';
import { isRailQuoteItem } from './rail/JapanRailJourneyDataService';

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

export interface QuotePresentationModel {
  quoteId: string;
  quoteNumber: string;
  version: number;
  status: string;
  createdDateFormatted: string;
  validUntilFormatted: string;
  currency: string;
  totalSellingPriceNumeric: number;
  
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
    priceFormatted: formatCurrency(itemPrice, currency),
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

  const items: QuoteItem[] = (activeOption?.items && activeOption.items.length > 0)
    ? activeOption.items
    : (quote.items || []);
  const hubs: TripRouteHub[] = (activeOption?.routeHubs && activeOption.routeHubs.length > 0)
    ? activeOption.routeHubs
    : (quote.routeHubs || []);
  const sortedHubs = [...hubs].sort((a, b) => a.order - b.order);

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

      if (h.hotelId || h.manualHotel?.hotelName) {
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
          priceFormatted: itemPrice > 0 ? formatCurrency(itemPrice, effectiveCurrency) : undefined,
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
      priceFormatted: itemPrice > 0 ? formatCurrency(itemPrice, effectiveCurrency) : undefined,
      notes: it.notes
    });
  });

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
    if (isHubCheckIn && activeHub && (activeHub.manualHotel?.hotelName || activeHub.hotelId)) {
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
          priceFormatted: formatCurrency(manualPrice, effectiveCurrency),
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
  const rawSellingPrice = (activeOption?.totalSellingPrice && activeOption.totalSellingPrice > 0)
    ? activeOption.totalSellingPrice
    : (quote.finalCustomerSellingPrice || (quote as any).final_customer_selling_price || quote.totalSellingPrice || (quote as any).totalAmount || 0);
  const itemsSumPrice = items.reduce((sum, it) => sum + (it.calculation?.finalTotalSellingPrice || it.calculation?.totalSellingPrice || (it as any).totalSellingPrice || 0), 0);
  const effectiveSellingPrice = rawSellingPrice > 0 ? rawSellingPrice : itemsSumPrice;
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
      ? 'Authorized Travel Partner • In Association with TheUnbound Wholesale DMC Network'
      : 'Destination Management Operations • Direct Ground Logistics & Wholesale Tour Hub',
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
    visaServices: visaItems.map(it => transformQuoteItemToPresentation(it, effectiveCurrency)),
    days,
    additionalServices: generalInclusions,
    operationalStandards,
    totalItineraryValueFormatted: formatCurrency(effectiveSellingPrice, effectiveCurrency),
    pricePerTravelerFormatted: `${formatCurrency(pricePerPerson, effectiveCurrency)} / Traveler (${effectivePax} Guests)`,
    guaranteedCurrencyLine: `Guaranteed in ${effectiveCurrency} • No Hidden Surcharges`,
    childAndAttractionPolicies,
    commercialTerms: quote.termsAndConditions || 'This quotation is issued by TheUnbound Wholesale DMC Network. Rates are valid for 14 calendar days from generation date. All reservations subject to live inventory confirmation upon deposit.',
    footerContactLine: 'TheUnbound DMC Global Ground Logistics • sales@theunbound.in • Official Contracted Quotation Document'
  };
}

// ============================================================================
// CANONICAL CHANNEL RENDERER 1: COMPLETE EMAIL RENDERER (HTML + PLAIN TEXT)
// ============================================================================

export function renderQuoteEmailFromPresentationModel(
  model: QuotePresentationModel,
  customNote?: string
): {
  subject: string;
  htmlBody: string;
  textBody: string;
} {
  const subject = `Bespoke Itinerary & Quotation Proposal [${model.quoteNumber} v${model.version}] — ${model.destination} (${model.totalDays} Days / ${model.totalNights} Nights) — ${model.clientName}`;

  const routeString = model.routeHubs.length > 0
    ? model.routeHubs.map(h => `${h.hubName} (${h.nights} ${h.nights === 1 ? 'Night' : 'Nights'})`).join(' → ')
    : model.destination;

  // 1. Build Complete Plain-Text Representation (mirrors 100% of Quote Preview)
  const textSections: string[] = [];
  const LINE_DIVIDER = '──────────────────────────────────────────────────────────────────────';

  textSections.push([
    LINE_DIVIDER,
    `${model.agencyName.toUpperCase()} — OFFICIAL ITINERARY & QUOTATION PROPOSAL`,
    model.agentAgencySubtitle,
    LINE_DIVIDER,
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
    LINE_DIVIDER,
    `Itinerary       : ${model.destination} Bespoke Travel Itinerary`,
    `Destination     : ${model.destination}`,
    `Route & Hubs    : ${routeString}`,
    `Duration        : ${model.totalDays} Days / ${model.totalNights} Nights`,
    `Travel Dates    : ${model.dateSpanText || 'Flexible Dates'}`,
    `Passengers      : ${model.paxDetailsText}`,
    model.nationality ? `Nationality     : ${model.nationality}` : '',
    model.travelStyle ? `Travel Style    : ${model.travelStyle}` : '',
    `Rate Per Person : ${model.pricePerPersonFormatted} (Inclusive of all ground taxes)`,
    `Total Quotation : ${model.totalItineraryValueFormatted} (${model.guaranteedCurrencyLine})`
  ].filter(Boolean).join('\n'));

  textSections.push([
    `2. CLIENT & SPECIALIST DOSSIER`,
    LINE_DIVIDER,
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

  if (model.hotels.length > 0) {
    const hotelLines = [
      `3. CURATED ACCOMMODATION SUMMARY (${model.hotels.length} ${model.hotels.length === 1 ? 'STAY' : 'STAYS'})`,
      LINE_DIVIDER
    ];
    model.hotels.forEach((h, idx) => {
      hotelLines.push(
        `[${idx + 1}] ${h.hotelName} (${h.cityHub}${h.starRating ? ` • ${h.starRating}` : ''})`,
        `    Stay Dates  : ${h.checkInDate} → ${h.checkOutDate} (${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'})`,
        `    Room & Meal : ${h.roomsCount} × ${h.roomType} | ${h.mealPlan} | Occupancy: ${h.occupancy}`,
        h.priceFormatted ? `    Tariff      : ${h.priceFormatted}` : '',
        h.overview ? `    Overview    : ${h.overview}` : '',
        h.inclusions.length > 0 ? `    Inclusions  : ${h.inclusions.join(' | ')}` : '',
        h.exclusions.length > 0 ? `    Exclusions  : ${h.exclusions.join(' | ')}` : '',
        h.notes ? `    Stay Notes  : ${h.notes}` : ''
      );
    });
    textSections.push(hotelLines.filter(Boolean).join('\n'));
  }

  if (model.visaServices.length > 0) {
    const visaLines = [
      `4. VISA & ANCILLARY SERVICES (${model.visaServices.length} INCLUDED)`,
      LINE_DIVIDER
    ];
    model.visaServices.forEach((v, idx) => {
      visaLines.push(
        `[${idx + 1}] ${v.listingName} (${v.categoryLabel}) — ${v.priceFormatted} [${v.paxText}]`,
        v.duration ? `    Duration        : ${v.duration}` : '',
        v.configurationSummary ? `    Specifications  : ${v.configurationSummary}` : '',
        v.overview ? `    Overview        : ${v.overview}` : '',
        v.inclusions.length > 0 ? `    Inclusions      : ${v.inclusions.map(i => `✓ ${i}`).join(' | ')}` : '',
        v.exclusions.length > 0 ? `    Exclusions      : ${v.exclusions.map(e => `✕ ${e}`).join(' | ')}` : '',
        v.specialInstructions ? `    Special Notes   : ${v.specialInstructions}` : ''
      );
    });
    textSections.push(visaLines.filter(Boolean).join('\n'));
  }

  const daySectionLines: string[] = [
    `5. DAY-BY-DAY CHRONOLOGICAL ITINERARY (${model.days.length} DAYS)`,
    LINE_DIVIDER
  ];

  model.days.forEach(day => {
    const transitionBadge = day.isTransitionDay && day.prevHubName ? ` [Transfer: ${day.prevHubName} → ${day.hubName}]` : '';
    const themeText = day.customTheme ? ` • ${day.customTheme}` : '';
    daySectionLines.push(
      `\n======================================================================`,
      `DAY ${String(day.dayNumber).padStart(2, '0')}: ${day.dayOfWeek}, ${day.formattedDate} — ${day.hubName} Base${transitionBadge}${themeText}`,
      `======================================================================`
    );

    if (day.dayOverview) {
      daySectionLines.push(`Day ${day.dayNumber} Overview: ${day.dayOverview}`);
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
          `      Price / Pax    : ${s.priceFormatted} (${s.paxText}) — ${s.statusText}`,
          (s.duration || s.serviceTime) ? `      Schedule       : ${[s.duration ? `Duration: ${s.duration}` : '', s.serviceTime ? `Time: ${s.serviceTime}` : ''].filter(Boolean).join(' • ')}` : '',
          s.configurationSummary ? `      Specifications : ${s.configurationSummary}` : '',
          s.meetingPoint ? `      Meeting Point  : ${s.meetingPoint}` : '',
          s.pickupPoint ? `      Pickup Point   : ${s.pickupPoint}` : '',
          s.dropoffPoint ? `      Drop-off Point : ${s.dropoffPoint}` : '',
          (s.isRail && s.railDetails) ? `      Bullet Train   : ${s.railDetails.origin} → ${s.railDetails.destination} | ${s.railDetails.carType} (${s.railDetails.seatType}) | ${s.railDetails.serviceGroup}${s.railDetails.seatPreference ? ` | Seat: ${s.railDetails.seatPreference}` : ''}${s.railDetails.pnrReference ? ` | PNR: ${s.railDetails.pnrReference}` : ''}` : '',
          s.overview ? `      Overview       : ${s.overview}` : '',
          s.inclusions.length > 0 ? `      Inclusions     : ${s.inclusions.map(i => `✓ ${i}`).join(' | ')}` : '',
          s.exclusions.length > 0 ? `      Exclusions     : ${s.exclusions.map(e => `✕ ${e}`).join(' | ')}` : '',
          s.specialInstructions ? `      Instructions   : ${s.specialInstructions}` : ''
        );
      });
    }

    if (day.dayNotes) {
      daySectionLines.push(`  Day ${day.dayNumber} Operational Notes: ${day.dayNotes}`);
    }
  });

  textSections.push(daySectionLines.filter(Boolean).join('\n'));

  if (model.additionalServices.length > 0) {
    const addLines = [
      `6. ADDITIONAL PACKAGE SERVICES & PRIVILEGES`,
      LINE_DIVIDER
    ];
    model.additionalServices.forEach((a, idx) => {
      addLines.push(
        `  [${idx + 1}] ${a.name} — ${a.priceFormatted}`,
        `      Details    : ${a.summary}`,
        a.overview ? `      Overview   : ${a.overview}` : '',
        (a.inclusions && a.inclusions.length > 0) ? `      Inclusions : ${a.inclusions.join(' | ')}` : '',
        (a.exclusions && a.exclusions.length > 0) ? `      Exclusions : ${a.exclusions.join(' | ')}` : '',
        a.specialInstructions ? `      Notes      : ${a.specialInstructions}` : ''
      );
    });
    textSections.push(addLines.filter(Boolean).join('\n'));
  }

  textSections.push([
    `7. GROUND OPERATIONS STANDARDS & INCLUSIONS`,
    LINE_DIVIDER,
    ...model.operationalStandards.map(op => `  • ${op.title}: ${op.desc}`)
  ].join('\n'));

  textSections.push([
    `8. OFFICIAL PROPOSAL TARIFF & FINANCIAL SUMMARY`,
    LINE_DIVIDER,
    `Guaranteed Total Itinerary Value : ${model.totalItineraryValueFormatted}`,
    `Package Rate Per Traveler        : ${model.pricePerTravelerFormatted}`,
    `Currency & Tax Guarantee         : ${model.guaranteedCurrencyLine}`,
    `Quotation Valid Until            : ${model.validUntilFormatted}`
  ].join('\n'));

  textSections.push([
    `9. OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY`,
    LINE_DIVIDER,
    ...model.childAndAttractionPolicies.map(p => `  • ${p}`)
  ].join('\n'));

  textSections.push([
    `10. COMMERCIAL QUOTATION TERMS & CONDITIONS`,
    LINE_DIVIDER,
    model.commercialTerms,
    ``,
    model.footerContactLine
  ].join('\n'));

  const textBody = textSections.join('\n\n');

  // 2. Build Complete Rich HTML Representation (mirrors 100% of Quote Preview & PDF)
  const renderServiceHtmlCard = (s: ServicePresentationItem) => {
    const operationalPointsHtml = (s.meetingPoint || s.pickupPoint || s.dropoffPoint) ? `
      <div style="margin: 6px 0; font-size: 11px; color: #334155;">
        ${s.meetingPoint ? `<span style="display: inline-block; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #cbd5e1; margin-right: 6px; margin-bottom: 4px;"><strong>Meeting Point:</strong> ${s.meetingPoint}</span>` : ''}
        ${s.pickupPoint ? `<span style="display: inline-block; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #cbd5e1; margin-right: 6px; margin-bottom: 4px;"><strong>Pickup:</strong> ${s.pickupPoint}</span>` : ''}
        ${s.dropoffPoint ? `<span style="display: inline-block; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #cbd5e1; margin-right: 6px; margin-bottom: 4px;"><strong>Drop-off:</strong> ${s.dropoffPoint}</span>` : ''}
      </div>
    ` : '';

    const railBoxHtml = (s.isRail && s.railDetails) ? `
      <div style="margin: 8px 0; padding: 10px 12px; border-radius: 10px; background: #eef2ff; border: 1px solid #c7d2fe; font-size: 11.5px; color: #312e81;">
        <div style="font-weight: 800; margin-bottom: 3px;">
          🚄 Bullet Train: ${s.railDetails.origin} → ${s.railDetails.destination} • ${s.railDetails.carType} (${s.railDetails.seatType}) • ${s.railDetails.serviceGroup}
        </div>
        <div style="font-size: 11px; color: #4338ca;">
          ${s.railDetails.seatPreference ? `<span style="margin-right: 12px;">Seat Preference: <strong>${s.railDetails.seatPreference}</strong></span>` : ''}
          ${s.railDetails.pnrReference ? `<span>SmartEX PNR: <strong style="font-family: monospace;">${s.railDetails.pnrReference}</strong></span>` : ''}
        </div>
      </div>
    ` : '';

    const overviewHtml = s.overview ? `
      <div style="margin-top: 8px;">
        <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 3px;">Overview & Specifications</span>
        <div style="font-size: 12px; color: #334155; line-height: 1.55;">${s.overview}</div>
      </div>
    ` : '';

    const inclusionsHtml = s.inclusions.length > 0 ? `
      <div style="margin-top: 8px;">
        <span style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Inclusions</span>
        <div>
          ${s.inclusions.map(inc => `<span style="display: inline-block; font-size: 11px; background: #ffffff; color: #064e3b; padding: 3px 8px; border-radius: 6px; border: 1px solid #a7f3d0; margin-right: 5px; margin-bottom: 5px;">✓ ${inc}</span>`).join('')}
        </div>
      </div>
    ` : '';

    const exclusionsHtml = s.exclusions.length > 0 ? `
      <div style="margin-top: 8px;">
        <span style="font-size: 10px; font-weight: 800; color: #e11d48; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Exclusions</span>
        <div>
          ${s.exclusions.map(exc => `<span style="display: inline-block; font-size: 11px; background: #ffffff; color: #881337; padding: 3px 8px; border-radius: 6px; border: 1px solid #fecdd3; margin-right: 5px; margin-bottom: 5px;">✕ ${exc}</span>`).join('')}
        </div>
      </div>
    ` : '';

    const specialInstructionsHtml = s.specialInstructions ? `
      <div style="font-size: 11.5px; color: #334155; background: #ffffff; padding: 8px 10px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 8px;">
        <strong>Special Instructions / Notes: </strong>${s.specialInstructions}
      </div>
    ` : '';

    return `
      <div style="padding: 14px 16px; border-radius: 14px; background: #f8fafc; border: 1px solid ${s.badgeBg || '#e2e8f0'}; margin-bottom: 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: top; padding-right: 12px;">
              <div style="margin-bottom: 6px;">
                <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 3px 8px; border-radius: 5px; background: ${s.badgeBg}; color: ${s.badgeText}; display: inline-block; margin-right: 6px;">
                  ${s.categoryLabel}
                </span>
                ${s.duration ? `<span style="font-size: 11px; color: #475569; margin-right: 6px;">⏱️ ${s.duration}</span>` : ''}
                ${s.serviceTime ? `<span style="font-size: 11px; font-family: monospace; font-weight: 700; color: #334155; background: #ffffff; padding: 2px 7px; border-radius: 5px; border: 1px solid #cbd5e1;">${s.serviceTime}</span>` : ''}
              </div>
              <h4 style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${s.listingName}</h4>
              ${s.configurationSummary && !s.isRail ? `<p style="font-size: 12px; color: #475569; margin: 0 0 6px 0; font-weight: 600;">${s.configurationSummary}</p>` : ''}
              ${operationalPointsHtml}
              ${railBoxHtml}
              ${overviewHtml}
              ${inclusionsHtml}
              ${exclusionsHtml}
              ${specialInstructionsHtml}
            </td>
            <td style="vertical-align: top; text-align: right; width: 130px; white-space: nowrap;">
              <div style="font-size: 14px; font-weight: 900; color: #0f172a; font-family: monospace;">${s.priceFormatted}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${s.paxText}</div>
              <span style="display: inline-block; margin-top: 6px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #047857; background: #ecfdf5; padding: 3px 7px; border-radius: 5px; border: 1px solid #a7f3d0;">${s.statusText}</span>
            </td>
          </tr>
        </table>
      </div>
    `;
  };

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 780px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; color: #0f172a; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);">
      <!-- 1. Document Header & Brand Identity -->
      <div style="padding: 24px 28px; border-bottom: 2px solid #020617; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: top;">
              <div>
                <span style="font-size: 26px; font-weight: 900; text-transform: lowercase; color: #020617; letter-spacing: -0.5px; margin-right: 10px;">${model.agencyName}</span>
                <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.06em; padding: 4px 9px; border-radius: 6px; background: #020617; color: #00E5C0; vertical-align: middle;">Official Itinerary Proposal</span>
              </div>
              <p style="font-size: 11.5px; color: #64748b; margin: 6px 0 0 0;">${model.agentAgencySubtitle}</p>
            </td>
            <td style="vertical-align: top; text-align: right; font-family: monospace; font-size: 11.5px;">
              <div style="font-size: 15px; font-weight: 900; color: #020617;">${model.quoteNumber} (v${model.version})</div>
              <div style="color: #64748b;">Quote ID: ${model.quoteId}</div>
              <div style="color: #64748b;">Date: ${model.createdDateFormatted}</div>
              <div style="color: #64748b;">Valid Until: ${model.validUntilFormatted}</div>
              <div style="color: #0d9488; font-weight: 700;">Status: ${model.status}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding: 24px 28px;">
        ${customNote && customNote.trim() ? `
          <div style="background: #f0fdf4; border-left: 4px solid #008972; padding: 14px 18px; border-radius: 0 12px 12px 0; margin-bottom: 20px; font-size: 13px; color: #14532d; line-height: 1.55;">
            <strong style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #008972; margin-bottom: 4px;">Personal Note from ${model.agentName}</strong>
            <div style="white-space: pre-line;">${customNote.trim()}</div>
          </div>
        ` : ''}

        <!-- 2. Curated Journey Overview Banner -->
        <div style="background: #0f172a; color: #ffffff; padding: 22px 24px; border-radius: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: top;">
                <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #00E5C0; font-weight: 800; display: block;">Curated Journey Overview</span>
                <h1 style="font-size: 21px; font-weight: 900; color: #ffffff; margin: 4px 0 6px 0;">${model.destination} Bespoke Travel Itinerary</h1>
                <p style="font-size: 12px; color: #cbd5e1; margin: 0; line-height: 1.6;">
                  <span>${model.totalDays} Days / ${model.totalNights} Nights</span>
                  <span> • </span>
                  <strong style="color: #00E5C0;">${model.paxDetailsText}</strong>
                  ${model.nationality ? `<span> • Nationality: <strong style="color: #ffffff;">${model.nationality}</strong></span>` : ''}
                  ${model.travelStyle ? `<span> • Style: <strong style="color: #ffffff;">${model.travelStyle}</strong></span>` : ''}
                  ${model.dateSpanText ? `<span> • <span style="font-family: monospace; color: #00E5C0;">${model.dateSpanText}</span></span>` : ''}
                  ${model.selectedOptionTitle ? `<span> • Option: <strong style="color: #38bdf8;">${model.selectedOptionTitle}</strong></span>` : ''}
                </p>
              </td>
              <td style="vertical-align: top; text-align: right; min-width: 155px;">
                <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 700; display: block;">Package Rate per Person</span>
                <div style="font-size: 22px; font-weight: 900; font-family: monospace; color: #00E5C0;">${model.pricePerPersonFormatted}</div>
                <span style="font-size: 10px; color: #94a3b8;">Inclusive of all ground taxes</span>
              </td>
            </tr>
          </table>

          ${model.routeHubs.length > 0 ? `
            <div style="padding-top: 14px; border-top: 1px solid #334155; margin-top: 14px;">
              <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">
                🧭 Route & Destination Hubs:
              </div>
              <div>
                ${model.routeHubs.map((h, i) => `
                  <span style="display: inline-block; background: #1e293b; padding: 5px 10px; border-radius: 8px; border: 1px solid #475569; font-size: 11.5px; color: #ffffff; margin-right: 4px; margin-bottom: 4px;">
                    📍 <strong>${h.hubName}</strong> <span style="color: #00E5C0; font-family: monospace;">(${h.nights} ${h.nights === 1 ? 'Night' : 'Nights'})</span>
                  </span>
                  ${i < model.routeHubs.length - 1 ? `<span style="color: #64748b; font-weight: bold; margin-right: 4px;">→</span>` : ''}
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- 3. Client & Specialist Dossier -->
        <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; margin-bottom: 22px; font-size: 12px;">
          <tr>
            <td style="width: 50%; padding: 16px; vertical-align: top; border-right: 1px solid #e2e8f0;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; display: block; margin-bottom: 4px;">👥 Valued Guest / Client</span>
              <div style="font-weight: 800; font-size: 14px; color: #0f172a;">${model.clientName}</div>
              ${model.clientCompany ? `<div style="color: #475569; font-weight: 600; margin-top: 2px;">${model.clientCompany}</div>` : ''}
              ${model.clientEmail ? `<div style="color: #64748b; font-family: monospace; margin-top: 2px;">${model.clientEmail}</div>` : ''}
              ${model.clientPhone ? `<div style="color: #64748b; font-family: monospace; margin-top: 2px;">${model.clientPhone}</div>` : ''}
            </td>
            <td style="width: 50%; padding: 16px; vertical-align: top;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; display: block; margin-bottom: 4px;">🎖️ Prepared By Destination Specialist</span>
              <div style="font-weight: 800; font-size: 14px; color: #0f172a;">${model.agentName}</div>
              <div style="color: #334155; font-weight: 600; margin-top: 2px;">${model.agencyName}</div>
              ${model.agentEmail ? `<div style="color: #64748b; font-family: monospace; margin-top: 2px;">${model.agentEmail}</div>` : ''}
              ${model.agentPhone ? `<div style="color: #64748b; font-family: monospace; margin-top: 2px;">${model.agentPhone}</div>` : ''}
              <div style="color: #0d9488; font-size: 11px; font-weight: 700; margin-top: 4px;">🛡️ 24/7 On-Ground Concierge & Multilingual Dispatch</div>
            </td>
          </tr>
        </table>

        <!-- 3.5. Curated Accommodation Summary Table (if hotels present) -->
        ${model.hotels.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <div style="border-bottom: 2px solid #92400e; padding-bottom: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
              <h2 style="font-size: 14px; font-weight: 900; color: #020617; text-transform: uppercase; margin: 0;">🏨 Curated Accommodation & Hotel Stays (${model.hotels.length})</h2>
            </div>
            <div style="border: 1px solid #fde68a; border-radius: 12px; overflow: hidden;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                <thead style="background: #fef3c7; color: #92400e;">
                  <tr>
                    <th style="padding: 10px 12px; font-weight: 800;">City Hub & Hotel</th>
                    <th style="padding: 10px 12px; font-weight: 800;">Check-In / Out & Nights</th>
                    <th style="padding: 10px 12px; font-weight: 800;">Room Config & Meal Plan</th>
                  </tr>
                </thead>
                <tbody>
                  ${model.hotels.map((h, i) => `
                    <tr style="border-top: ${i === 0 ? 'none' : '1px solid #fef3c7'}; background: #fffbeb;">
                      <td style="padding: 10px 12px; vertical-align: top;">
                        <strong style="color: #0f172a; font-size: 13px;">${h.hotelName}</strong>
                        <div style="font-size: 11px; color: #92400e; font-weight: 600;">📍 ${h.cityHub}${h.starRating ? ` • ${h.starRating}` : ''}</div>
                        ${h.notes ? `<div style="font-size: 11px; color: #475569; margin-top: 3px;">${h.notes}</div>` : ''}
                      </td>
                      <td style="padding: 10px 12px; vertical-align: top; color: #334155;">
                        <div style="font-weight: 700;">${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'}</div>
                        <div style="font-size: 11px; color: #64748b;">${h.checkInDate} → ${h.checkOutDate}</div>
                      </td>
                      <td style="padding: 10px 12px; vertical-align: top; color: #334155;">
                        <div style="font-weight: 700;">${h.roomsCount} × ${h.roomType}</div>
                        <div style="font-size: 11px; color: #059669; font-weight: 700;">${h.mealPlan}</div>
                        <div style="font-size: 11px; color: #64748b;">Occupancy: ${h.occupancy}</div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- 4. Visa & Ancillary Services -->
        ${model.visaServices.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <div style="border-bottom: 2px solid #065f46; padding-bottom: 6px; margin-bottom: 12px;">
              <h2 style="font-size: 14px; font-weight: 900; color: #020617; text-transform: uppercase; margin: 0;">
                🌐 Visa & Ancillary Services (${model.visaServices.length} Included)
              </h2>
            </div>
            ${model.visaServices.map(v => renderServiceHtmlCard(v)).join('')}
          </div>
        ` : ''}

        <!-- 5. Day-by-Day Chronological Itinerary -->
        <div style="margin-bottom: 24px;">
          <div style="border-bottom: 2px solid #020617; padding-bottom: 8px; margin-bottom: 14px;">
            <h2 style="font-size: 15px; font-weight: 900; color: #020617; text-transform: uppercase; margin: 0;">
              📅 Day-by-Day Itinerary & Scheduled Services (${model.days.length} Days)
            </h2>
          </div>

          ${model.days.map(day => `
            <div style="border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; margin-bottom: 18px; background: #ffffff;">
              <div style="background: #0f172a; color: #ffffff; padding: 12px 16px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="vertical-align: middle;">
                      <div style="font-weight: 900; font-size: 14px; color: #ffffff;">
                        <span style="display: inline-block; background: #00E5C0; color: #0f172a; font-family: monospace; font-weight: 900; font-size: 12px; padding: 2px 7px; border-radius: 6px; margin-right: 8px;">
                          DAY ${String(day.dayNumber).padStart(2, '0')}
                        </span>
                        Day ${day.dayNumber}: ${day.dayOfWeek}, ${day.formattedDate}
                        ${day.isTransitionDay && day.prevHubName ? `
                          <span style="display: inline-block; margin-left: 8px; padding: 2px 7px; border-radius: 5px; background: rgba(245, 158, 11, 0.25); color: #fcd34d; font-size: 10px; font-weight: 700;">
                            Transfer: ${day.prevHubName} → ${day.hubName}
                          </span>
                        ` : ''}
                      </div>
                      <div style="font-size: 11.5px; color: #cbd5e1; margin-top: 4px;">
                        <span style="color: #00E5C0;">📍</span> <strong>${day.hubName} Base</strong>
                        ${day.customTheme ? ` <span style="color: #64748b;">•</span> <span style="color: #00E5C0; font-weight: 700;">${day.customTheme}</span>` : ''}
                      </div>
                    </td>
                    <td style="vertical-align: middle; text-align: right; font-family: monospace; font-size: 11px; color: #94a3b8;">
                      ${day.services.length > 0 ? `${day.services.length} ${day.services.length === 1 ? 'Service' : 'Services'}` : 'Leisure Exploration'}
                    </td>
                  </tr>
                </table>
              </div>

              <div style="padding: 14px 16px;">
                ${day.dayOverview ? `
                  <div style="padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 12px; font-size: 12px; color: #334155; line-height: 1.5;">
                    <strong style="font-size: 10px; text-transform: uppercase; color: #0d9488; display: block; margin-bottom: 3px;">Day ${day.dayNumber} Overview</strong>
                    <div>${day.dayOverview}</div>
                  </div>
                ` : ''}

                ${day.services.length > 0
                  ? day.services.map(s => renderServiceHtmlCard(s)).join('')
                  : `
                    <div style="padding: 12px 14px; border-radius: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; font-size: 12px; color: #475569;">
                      <strong style="color: #1e293b;">• Day at Leisure in ${day.hubName} (Self-Paced)</strong>
                      <p style="margin: 4px 0 0 0; font-size: 11.5px; color: #64748b;">Free time for personal exploration, neighborhood shopping, and local dining discoveries. 24/7 concierge assistance available.</p>
                    </div>
                  `
                }

                ${day.dayNotes ? `
                  <div style="padding: 10px 14px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; margin-top: 10px; font-size: 11.5px; color: #78350f; line-height: 1.45;">
                    <strong>Day ${day.dayNumber} Operational Notes: </strong>${day.dayNotes}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- 6. Additional Package Services & Privileges -->
        ${model.additionalServices.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <div style="border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 12px; font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
              ✨ Additional Package Services & Privileges
            </div>
            ${model.additionalServices.map(a => `
              <div style="padding: 12px 14px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; margin-bottom: 8px; font-size: 12px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td>
                      <strong style="color: #0f172a; font-size: 13px;">${a.name}</strong>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${a.summary}</div>
                      ${a.overview ? `<div style="font-size: 11.5px; color: #334155; margin-top: 4px;">${a.overview}</div>` : ''}
                      ${a.inclusions && a.inclusions.length > 0 ? `<div style="font-size: 11px; color: #065f46; margin-top: 4px;"><strong>Inclusions:</strong> ${a.inclusions.join(' • ')}</div>` : ''}
                      ${a.exclusions && a.exclusions.length > 0 ? `<div style="font-size: 11px; color: #9f1239; margin-top: 2px;"><strong>Exclusions:</strong> ${a.exclusions.join(' • ')}</div>` : ''}
                    </td>
                    <td style="text-align: right; vertical-align: top; font-family: monospace; font-weight: 800; color: #0f172a;">
                      ${a.priceFormatted}
                    </td>
                  </tr>
                </table>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- 7. Ground Operations Standards -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin-bottom: 22px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 10px;">
            🛡️ TheUnbound Ground Operations Standards & Inclusions
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              ${model.operationalStandards.map(op => `
                <td style="width: 25%; vertical-align: top; padding: 6px;">
                  <div style="background: #ffffff; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <strong style="font-size: 11px; color: #0f172a; display: block; margin-bottom: 4px;">${op.title}</strong>
                    <p style="font-size: 10.5px; color: #64748b; margin: 0; line-height: 1.4;">${op.desc}</p>
                  </div>
                </td>
              `).join('')}
            </tr>
          </table>
        </div>

        <!-- 8. Official Proposal Tariff & Financial Summary -->
        <div style="background: #020617; color: #ffffff; padding: 22px 24px; border-radius: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                <span style="font-size: 10px; font-weight: 800; color: #00E5C0; text-transform: uppercase; letter-spacing: 0.1em; display: block;">Official Proposal Tariff</span>
                <h3 style="font-size: 19px; font-weight: 900; color: #ffffff; margin: 3px 0 5px 0;">Guaranteed Total Itinerary Value</h3>
                <p style="font-size: 11.5px; color: #cbd5e1; margin: 0;">All private transportation, accommodations, bullet train fares, guided experiences, entrance tickets, and applicable government taxes are fully included.</p>
              </td>
              <td style="vertical-align: middle; text-align: right; min-width: 180px;">
                <div style="font-size: 28px; font-weight: 900; font-family: monospace; color: #00E5C0;">${model.totalItineraryValueFormatted}</div>
                <div style="font-size: 12px; color: #cbd5e1; font-family: monospace; margin-top: 2px;">${model.pricePerTravelerFormatted}</div>
                <div style="font-size: 10.5px; color: #94a3b8; margin-top: 3px;">${model.guaranteedCurrencyLine}</div>
                <div style="font-size: 10.5px; color: #00E5C0; margin-top: 2px;">Valid Until: ${model.validUntilFormatted}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- 9. Operational Guidelines & Child / Attraction Policy -->
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; font-size: 11.5px;">
          <div style="font-weight: 900; color: #78350f; text-transform: uppercase; font-size: 11px; margin-bottom: 6px;">
            ℹ️ Operational Guidelines & Child / Attraction Policy
          </div>
          <ul style="margin: 0; padding-left: 18px; color: #92400e; line-height: 1.55;">
            ${model.childAndAttractionPolicies.map(p => `<li style="margin-bottom: 4px;">${p}</li>`).join('')}
          </ul>
        </div>

        <!-- 10. Commercial Quotation Terms & Footer -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11.5px; color: #64748b;">
          <div style="font-weight: 800; color: #1e293b; text-transform: uppercase; font-size: 10.5px; margin-bottom: 4px;">Commercial Quotation Terms & Conditions:</div>
          <p style="margin: 0 0 12px 0; color: #475569; line-height: 1.5;">${model.commercialTerms}</p>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 10px; font-size: 10.5px; color: #94a3b8; font-family: monospace; text-align: center;">
            ${model.footerContactLine}
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    subject,
    htmlBody,
    textBody
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
  if (model.hotels.length > 0) {
    const hotelLines: string[] = [
      useEmojis ? `🏨 *CURATED ACCOMMODATION & LUXURY STAYS (${model.hotels.length})*` : `*ACCOMMODATION & STAYS (${model.hotels.length})*`
    ];
    model.hotels.forEach(h => {
      if (useEmojis) {
        const entry = [
          `• 🏙️ *${h.cityHub.toUpperCase()}* — *${h.nightsCount}* ${h.nightsCount === 1 ? 'Night' : 'Nights'}`,
          `  ⭐ *${h.hotelName}*${h.starRating ? ` (${h.starRating})` : ''}`,
          `  🛏️ *Room:* ${h.roomsCount} × ${h.roomType} | 🍳 *Meal Plan:* ${h.mealPlan}`,
          `  📅 *Stay Dates:* ${h.checkInDate} ➔ ${h.checkOutDate}`,
          h.priceFormatted ? `  💵 *Tariff:* ${h.priceFormatted}` : '',
          h.overview ? `  📝 *Overview:* ${h.overview}` : '',
          h.inclusions.length > 0 ? `  ✅ *Inclusions:* ${h.inclusions.join(', ')}` : '',
          h.exclusions.length > 0 ? `  ❌ *Exclusions:* ${h.exclusions.join(', ')}` : '',
          h.notes ? `  💡 *Notes:* ${h.notes}` : ''
        ].filter(Boolean).join('\n');
        hotelLines.push(entry);
      } else {
        const entry = [
          `• *${h.cityHub.toUpperCase()}* — ${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'}`,
          `  ${h.hotelName}${h.starRating ? ` (${h.starRating})` : ''} | ${h.roomsCount} × ${h.roomType} • ${h.mealPlan}`,
          `  Stay Dates: ${h.checkInDate} to ${h.checkOutDate}`,
          h.priceFormatted ? `  Tariff: ${h.priceFormatted}` : '',
          h.overview ? `  Overview: ${h.overview}` : '',
          h.inclusions.length > 0 ? `  Inclusions: ${h.inclusions.join(', ')}` : '',
          h.exclusions.length > 0 ? `  Exclusions: ${h.exclusions.join(', ')}` : '',
          h.notes ? `  Notes: ${h.notes}` : ''
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
      const lines = [
        useEmojis
          ? `• 📑 *${v.listingName}* [${v.categoryLabel}] — *${v.priceFormatted}* (${v.paxText})`
          : `• *${v.listingName}* [${v.categoryLabel}] — ${v.priceFormatted} (${v.paxText})`,
        v.duration ? `  ⏱️ Duration: ${v.duration}` : '',
        v.configurationSummary ? `  ⚙️ Specs: ${v.configurationSummary}` : '',
        v.overview ? `  📖 Overview: ${v.overview}` : '',
        v.inclusions.length > 0 ? `  ✅ Inclusions: ${v.inclusions.join(', ')}` : '',
        v.exclusions.length > 0 ? `  ❌ Exclusions: ${v.exclusions.join(', ')}` : '',
        v.specialInstructions ? `  💡 Notes: ${v.specialInstructions}` : ''
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
        dayItems.push(`  📝 *Day Overview:* ${day.dayOverview}`);
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
              ? `  ${icon} *${s.listingName}* (${s.categoryLabel}) — *${s.priceFormatted}* [${s.paxText}]`
              : `  • *${s.listingName}* (${s.categoryLabel}) — ${s.priceFormatted} [${s.paxText}]`
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
          if (s.overview) {
            sLines.push(`     📖 Overview: ${s.overview}`);
          }
          if (s.inclusions.length > 0) {
            sLines.push(`     ✅ Inclusions: ${s.inclusions.join(', ')}`);
          }
          if (s.exclusions.length > 0) {
            sLines.push(`     ❌ Exclusions: ${s.exclusions.join(', ')}`);
          }
          if (s.specialInstructions) {
            sLines.push(`     💡 Instructions: ${s.specialInstructions}`);
          }
          dayItems.push(sLines.join('\n'));
        });
      }

      if (day.dayNotes) {
        dayItems.push(`  📌 *Day ${day.dayNumber} Notes:* ${day.dayNotes}`);
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
      addLines.push(
        useEmojis
          ? `• 💎 *${a.name}* — *${a.priceFormatted}*\n  ${a.summary}${a.overview ? `\n  Overview: ${a.overview}` : ''}`
          : `• *${a.name}* — ${a.priceFormatted}\n  ${a.summary}${a.overview ? `\n  Overview: ${a.overview}` : ''}`
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

  // 8. Final Quotation Investment & Commercial Terms
  const priceLines: string[] = [];
  if (useEmojis) {
    priceLines.push(
      `💰 *OFFICIAL PROPOSAL TARIFF & INVESTMENT SUMMARY*`,
      `🏷️ *FINAL QUOTATION TOTAL:* *${model.totalItineraryValueFormatted}*`,
      `👤 *Rate Per Traveler:* ${model.pricePerTravelerFormatted}`,
      `💱 *Currency & Taxes:* ${model.guaranteedCurrencyLine}`,
      `⏳ *Quote Valid Until:* *${model.validUntilFormatted}*`,
      ``,
      `📜 *Commercial Terms & Conditions:*`,
      `${model.commercialTerms}`
    );
  } else {
    priceLines.push(
      `*OFFICIAL PROPOSAL TARIFF & INVESTMENT SUMMARY*`,
      `Final Quotation Total: *${model.totalItineraryValueFormatted}*`,
      `Rate Per Traveler: ${model.pricePerTravelerFormatted}`,
      `Currency & Taxes: ${model.guaranteedCurrencyLine}`,
      `Quote Valid Until: ${model.validUntilFormatted}`,
      ``,
      `*Commercial Terms & Conditions:*`,
      `${model.commercialTerms}`
    );
  }
  sections.push(priceLines.join('\n'));

  // 9. Personal Note
  if (options?.customNote && options.customNote.trim()) {
    sections.push(
      useEmojis
        ? `📝 *PERSONAL NOTE FROM YOUR TRAVEL DESIGNER:*\n"${options.customNote.trim()}"`
        : `*PERSONAL NOTE:*\n${options.customNote.trim()}`
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
    { label: 'Total Quotation Value', value: model.totalItineraryValueFormatted },
    { label: 'Agent Name', value: model.agentName },
    { label: 'Agency Name', value: model.agencyName },
    { label: 'Valid Until Date', value: model.validUntilFormatted }
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


