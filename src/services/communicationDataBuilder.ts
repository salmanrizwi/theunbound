import { 
  Quotation, 
  QuotationOption, 
  QuoteItem, 
  TripRouteHub, 
  Booking, 
  TravelLead, 
  CommunicationChannel, 
  CommunicationRole, 
  CommunicationEventType,
  CommunicationAuditLog
} from '../types';
import { formatCurrency } from './pricingEngine';
import { 
  formatPassengerSummary, 
  formatDestinationSummary, 
  formatTravelDates,
  verifyNoCommercialLeak 
} from '../utils/customerQuoteSanitizer';

// ----------------------------------------------------
// AUTHORITATIVE COMMUNICATION PAYLOAD DATA STRUCTURES
// ----------------------------------------------------

export interface CommunicationPassengerInfo {
  adultsCount: number;
  childrenCount: number;
  childAges: number[];
  infantsCount: number;
  infantAges: number[];
  totalPax: number;
  leadPassengerName: string;
  passengerNames?: string[];
  displayText: string;
  specialRequirements?: string;
}

export interface CommunicationDayActivity {
  id: string;
  title: string;
  category: string;
  location: string;
  time?: string;
  duration?: string;
  paxCount?: number;
  inclusions?: string[];
  meetingPoint?: string;
  specialInstructions?: string;
}

export interface CommunicationDayTransfer {
  id: string;
  title: string;
  type: string;
  date: string;
  pickupLocation: string;
  dropLocation: string;
  pickupTime?: string;
  vehicleType: string;
  capacity?: string;
  paxCount?: number;
  instructions?: string;
}

export interface CommunicationDayWisePlanItem {
  dayNumber: number;
  date: string; // Formatted e.g. "12 Oct 2026"
  dateIso: string; // e.g. "2026-10-12"
  dayOfWeek: string; // e.g. "Mon"
  locationHub: string; // e.g. "Tokyo"
  overnight: string; // e.g. "Tokyo"
  title: string; // e.g. "Arrival in Tokyo & Hotel Check-in"
  hotelStay?: {
    hotelName: string;
    cityHub: string;
    starRating?: string;
    checkIn: boolean;
    checkOut: boolean;
    nightsInHub: number;
    roomType?: string;
    mealPlan?: string;
    notes?: string;
  };
  transfers: CommunicationDayTransfer[];
  activities: CommunicationDayActivity[];
  transportServices: Array<{ title: string; route?: string; departureTime?: string; arrivalTime?: string; classType?: string }>;
  meals: string[];
  visaServices: Array<{ name: string; destination: string; serviceType?: string; applicantsCount?: number }>;
  notes?: string;
}

export interface CommunicationHotelDetail {
  id?: string;
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
  notes?: string;
}

export interface CommunicationTransferDetail {
  id?: string;
  serviceName: string;
  date: string;
  pickupLocation: string;
  dropLocation: string;
  pickupTime?: string;
  vehicleType: string;
  capacity?: string;
  passengerCount: number;
  transferType: string;
  instructions?: string;
}

export interface CommunicationActivityDetail {
  id?: string;
  activityName: string;
  location: string;
  date: string;
  time?: string;
  duration?: string;
  passengerCount: number;
  inclusions: string[];
  meetingPoint?: string;
  specialInstructions?: string;
}

export interface CommunicationVisaDetail {
  id?: string;
  serviceName: string;
  destination: string;
  applicability: string;
  applicantsCount: number;
  serviceType: string;
  processingInfo?: string;
  documentationNotes?: string;
}

export interface CommunicationOptionDetail {
  optionId: string;
  optionNumber: number;
  optionTitle: string;
  hotelTier?: string;
  sellingPrice: number;
  formattedSellingPrice: string;
  currency: string;
  hotels: CommunicationHotelDetail[];
  dayWisePlan: CommunicationDayWisePlanItem[];
  inclusions: string[];
  exclusions: string[];
  terms?: string;
}

export interface QuoteCommunicationPayload {
  quoteId: string;
  version: number;
  quoteDate: string;
  validUntil: string;
  preparedFor: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  preparedBy: {
    name: string;
    agency?: string;
    email?: string;
    phone?: string;
    role?: string;
    logoUrl?: string;
  };
  tripSummary: {
    destination: string;
    citiesHubs: string[];
    travelDates: string;
    durationDays: number;
    durationNights: number;
    durationText: string;
    travelers: CommunicationPassengerInfo;
    hotelCategory?: string;
    travelStyle?: string;
    keyExperiences: string[];
    transferStyle?: string;
    visaRequirements?: string;
  };
  dayWisePlan: CommunicationDayWisePlanItem[];
  hotels: CommunicationHotelDetail[];
  activities: CommunicationActivityDetail[];
  transfers: CommunicationTransferDetail[];
  visaServices: CommunicationVisaDetail[];
  otherServices: Array<{ name: string; category: string; description?: string }>;
  inclusions: string[];
  exclusions: string[];
  pricing: {
    finalSellingPrice: number;
    formattedPrice: string;
    currency: string;
    taxesIncluded: boolean;
    paymentTerms?: string;
    cancellationTerms?: string;
    validUntilText: string;
    // Internal Admin/Ops ONLY (NEVER exposed to Buyer or Agent)
    commercialDetails?: {
      totalNetCost: number;
      totalMargin: number;
      totalTaxes: number;
      markupPercent?: number;
    };
  };
  options?: CommunicationOptionDetail[];
  selectedOptionNumber?: number;
  selectedOptionTitle?: string;
  importantNotes: string[];
  proposalViewUrl?: string;
}

export interface BookingCommunicationPayload {
  bookingId: string;
  bookingReference: string;
  leadId?: string;
  quoteId?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    agencyName?: string;
    agentRef?: string;
    flightDetails?: string;
    pickupLocation?: string;
    specialRequests?: string;
  };
  destination: string;
  travelDates: string;
  durationText: string;
  travelers: CommunicationPassengerInfo;
  servicesCount: {
    hotels: number;
    activities: number;
    transfers: number;
    visas: number;
    total: number;
  };
  dayWisePlan: CommunicationDayWisePlanItem[];
  bookedItems: Array<{
    name: string;
    sku: string;
    category: string;
    destination: string;
    date: string;
    paxText: string;
    sellingPrice: number;
    formattedPrice: string;
  }>;
  totalSellingPrice: number;
  formattedTotalPrice: string;
  currency: string;
  paymentStatus: string;
  bookingStatus: string;
  paymentProofs?: Array<{
    trancheLabel: string;
    amount: number;
    currency: string;
    status: string;
    date: string;
  }>;
  actionRequired: string;
  nextSlaDeadline: string;
  portalUrl: string;
}

export interface LeadCommunicationPayload {
  leadId: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    agencyName?: string;
  };
  source: string;
  destination: string;
  travelDates: string;
  travelers: string;
  quoteId?: string;
  requestedServices: string[];
  budget?: string;
  status: string;
  actionRequired: string;
  portalUrl: string;
}

export interface OperationalCommunicationPayload {
  bookingId: string;
  bookingReference: string;
  serviceType: 'TRANSFER' | 'ACTIVITY' | 'HOTEL' | 'GUIDE' | 'RAIL' | 'JOBSHEET';
  serviceName: string;
  customer: {
    name: string;
    phone?: string;
    pax: string;
  };
  serviceDate: string;
  serviceTime?: string;
  fromLocation?: string;
  toLocation?: string;
  vehicle?: string;
  passengers: number;
  status: string;
  actionRequired: string;
  portalUrl: string;
}

// ----------------------------------------------------
// BUILDER IMPLEMENTATION
// ----------------------------------------------------

/**
 * Builds day-wise chronological itinerary from actual quote products & hubs.
 * NEVER invents false times or confirmed details; explicitly leaves pending where unconfigured.
 */
export function buildDayWiseItinerary(
  items: QuoteItem[],
  hubs: TripRouteHub[],
  startDateStr?: string,
  endDateStr?: string,
  dayThemes?: Record<number, string>
): CommunicationDayWisePlanItem[] {
  const sortedHubs = [...hubs].sort((a, b) => a.order - b.order);

  let calDays: Array<{ dayNumber: number; dateIso: string; dayOfWeek: string; formattedDate: string }> = [];

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
          dateIso: iso,
          dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        current.setDate(current.getDate() + 1);
        dayCount++;
      }
    }
  }

  // Fallback: derive from items travelDates or default duration
  if (calDays.length === 0) {
    const validDates: string[] = items.map(it => it.travelDate).filter((d): d is string => Boolean(d));
    const uniqueDates: string[] = Array.from(new Set<string>(validDates)).sort();
    if (uniqueDates.length > 0) {
      calDays = uniqueDates.map((dateStr, idx) => {
        const d = new Date(dateStr);
        return {
          dayNumber: idx + 1,
          dateIso: dateStr,
          dayOfWeek: isNaN(d.getTime()) ? `Day ${idx + 1}` : d.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
      });
    } else {
      const totalNights = sortedHubs.reduce((sum, h) => sum + (h.nights || 0), 0) || Math.max(items.length, 3);
      const base = new Date();
      for (let i = 0; i <= totalNights; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        calDays.push({
          dayNumber: i + 1,
          dateIso: d.toISOString().split('T')[0],
          dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
    }
  }

  return calDays.map((calDay) => {
    // 1. Determine active hub
    let activeHub: TripRouteHub | null = null;
    let isHubCheckIn = false;
    let isHubCheckOut = false;

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
          }
          if (calDay.dayNumber === hubEndDay && i < sortedHubs.length - 1) {
            isHubCheckOut = true;
          }
          break;
        }
        runningNightCount += hubNights;
      }
      // If last day of trip (post final night)
      if (!activeHub && calDay.dayNumber > runningNightCount) {
        activeHub = sortedHubs[sortedHubs.length - 1];
        isHubCheckOut = true;
      }
    }

    const hubName = activeHub?.hubName || activeHub?.destinationName || 'Destination Hub';

    // 2. Find items matching this day
    const dayItems = items.filter(it => {
      if (it.travelDate) {
        return it.travelDate === calDay.dateIso;
      }
      // If no explicit date, distribute by dayNumber or active hub
      return false;
    });

    // 3. Categorize services
    const activities: CommunicationDayActivity[] = [];
    const transfers: CommunicationDayTransfer[] = [];
    const transportServices: Array<{ title: string; route?: string; departureTime?: string; arrivalTime?: string; classType?: string }> = [];
    const visaServices: Array<{ name: string; destination: string; serviceType?: string; applicantsCount?: number }> = [];
    const meals: string[] = [];

    // Hotel accommodation in this hub
    let hotelStay: CommunicationDayWisePlanItem['hotelStay'] | undefined = undefined;
    if (activeHub && (activeHub.hotelId || activeHub.manualHotel?.hotelName)) {
      const hotelName = activeHub.manualHotel?.hotelName || activeHub.hotelId || 'Selected Luxury Hotel';
      const roomType = activeHub.manualHotel?.roomType || undefined;
      const mealPlan = activeHub.manualHotel?.mealPlan || 'Breakfast Included';
      
      hotelStay = {
        hotelName,
        cityHub: hubName,
        starRating: activeHub.manualHotel?.starRating || (activeHub.manualHotel as any)?.category || '4 Star / 5 Star',
        checkIn: isHubCheckIn,
        checkOut: isHubCheckOut,
        nightsInHub: activeHub.nights || 1,
        roomType,
        mealPlan,
        notes: activeHub.manualHotel?.internalNotes || (activeHub.manualHotel as any)?.notes
      };

      if (mealPlan && !meals.includes(mealPlan)) {
        meals.push(mealPlan);
      }
    }

    dayItems.forEach(it => {
      const p = it.product;
      const pType = p.productType || '';
      const cat = p.category || '';

      if (pType === 'TRANSFER' || cat === 'Transfers' || cat === 'Transport') {
        transfers.push({
          id: it.id,
          title: p.name,
          type: (p as any).transferType || 'Private Dedicated Vehicle',
          date: it.travelDate || calDay.formattedDate,
          pickupLocation: (it as any).pickupLocation || (p as any).pickupLocation || `${hubName} Arrival Point`,
          dropLocation: (it as any).dropLocation || (p as any).dropLocation || hotelStay?.hotelName || `${hubName} Hotel`,
          pickupTime: (it as any).pickupTime || undefined,
          vehicleType: (p as any).vehicleType || 'Executive Luxury Chauffeur',
          paxCount: it.pax?.adults || 2,
          instructions: (it as any).transferInstructions || undefined
        });
      } else if (pType === 'ACTIVITY' || pType === 'TOUR' || pType === 'DAY_TOUR' || cat === 'Activities' || cat === 'Private Tours' || cat === 'Day Trips' || cat === 'Tours') {
        activities.push({
          id: it.id,
          title: p.name,
          category: p.category || 'Curated Experience',
          location: p.city || hubName,
          time: (it as any).scheduledTime || undefined,
          duration: (p as any).duration || (p as any).durationHours ? `${(p as any).durationHours} Hours` : undefined,
          paxCount: it.pax?.adults || 2,
          inclusions: (p as any).includedFeatures || (p as any).inclusions || [],
          meetingPoint: (p as any).meetingPoint || undefined,
          specialInstructions: (it as any).specialInstructions || undefined
        });
      } else if (pType === 'VISA' || pType === 'Visa Service' || (p as any).subcategory === 'Visa Facilitation') {
        visaServices.push({
          name: p.name,
          destination: p.destinationName || hubName,
          serviceType: (p as any).visaType || 'Official E-Visa Assistance',
          applicantsCount: it.pax?.adults || 1
        });
      } else if (pType === 'RAIL' || pType === 'TRAIN') {
        transportServices.push({
          title: p.name,
          route: `${hubName} Corridor`,
          classType: 'Standard / Green Car'
        });
      }
    });

    // Determine Day Title
    let dayTitle = dayThemes?.[calDay.dayNumber];
    if (!dayTitle) {
      if (calDay.dayNumber === 1) {
        dayTitle = `Arrival in ${hubName} & Leisure`;
      } else if (activities.length > 0) {
        dayTitle = `${hubName}: ${activities[0].title}`;
      } else if (isHubCheckIn && calDay.dayNumber > 1) {
        dayTitle = `Scenic Transfer & Check-in at ${hubName}`;
      } else if (calDay.dayNumber === calDays.length) {
        dayTitle = `Departure from ${hubName} — Journey Home`;
      } else {
        dayTitle = `${hubName} City Experience & Leisure`;
      }
    }

    return {
      dayNumber: calDay.dayNumber,
      date: calDay.formattedDate,
      dateIso: calDay.dateIso,
      dayOfWeek: calDay.dayOfWeek,
      locationHub: hubName,
      overnight: hubName,
      title: dayTitle,
      hotelStay,
      transfers,
      activities,
      transportServices,
      meals: meals.length > 0 ? meals : ['At Leisure'],
      visaServices,
      notes: undefined
    };
  });
}

/**
 * Builds the canonical QuoteCommunicationPayload from an authoritative Quotation record.
 */
export function buildQuoteCommunicationPayload(
  quote: Quotation,
  options?: {
    selectedOptionIndexOrId?: number | string;
    role?: CommunicationRole;
    senderBranding?: { name?: string; agency?: string; phone?: string; email?: string; logoUrl?: string };
  }
): QuoteCommunicationPayload {
  const role: CommunicationRole = options?.role || 'BUYER';

  // 1. Option selection
  let activeOption: QuotationOption | undefined = undefined;
  let selectedOptionTitle: string | undefined = undefined;
  let selectedOptionNumber: number | undefined = undefined;

  if (quote.options && quote.options.length > 0) {
    if (typeof options?.selectedOptionIndexOrId === 'number') {
      activeOption = quote.options[options.selectedOptionIndexOrId] || quote.options[0];
      selectedOptionNumber = options.selectedOptionIndexOrId + 1;
      selectedOptionTitle = activeOption?.title || `Option ${selectedOptionNumber}`;
    } else if (typeof options?.selectedOptionIndexOrId === 'string') {
      const idx = quote.options.findIndex(o => o.id === options.selectedOptionIndexOrId);
      if (idx >= 0) {
        activeOption = quote.options[idx];
        selectedOptionNumber = idx + 1;
        selectedOptionTitle = activeOption.title || `Option ${selectedOptionNumber}`;
      }
    } else if (quote.activeOptionId) {
      const idx = quote.options.findIndex(o => o.id === quote.activeOptionId);
      if (idx >= 0) {
        activeOption = quote.options[idx];
        selectedOptionNumber = idx + 1;
        selectedOptionTitle = activeOption.title || `Option ${selectedOptionNumber}`;
      }
    }
  }

  const effectiveItems = activeOption?.items || quote.items || [];
  const effectiveHubs = activeOption?.routeHubs || quote.routeHubs || [];
  const effectiveSellingPrice = activeOption?.totalSellingPrice !== undefined
    ? activeOption.totalSellingPrice
    : (quote.totalSellingPrice || 0);

  // 2. Passenger info
  const adultsCount = quote.adultsCount || quote.passengerBreakdown?.adults || 2;
  const childrenCount = quote.childrenCount || quote.passengerBreakdown?.cnb || quote.passengerBreakdown?.cwb || 0;
  const childAges = quote.childAges || quote.passengerBreakdown?.cwbAges || [];
  const infantsCount = quote.infantsCount || quote.passengerBreakdown?.infants || 0;
  const infantAges = quote.passengerBreakdown?.infAges || [];
  const totalPax = quote.totalPax || (adultsCount + childrenCount + infantsCount);

  const travelers: CommunicationPassengerInfo = {
    adultsCount,
    childrenCount,
    childAges,
    infantsCount,
    infantAges,
    totalPax,
    leadPassengerName: quote.clientName || 'Valued Guest',
    displayText: formatPassengerSummary(quote),
    specialRequirements: quote.operationalRemarks?.join(', ') || undefined
  };

  // 3. Duration calculation
  let durationNights = 1;
  if (effectiveHubs.length > 0) {
    durationNights = effectiveHubs.reduce((acc, h) => acc + (h.nights || 0), 0);
  } else if (quote.travelStartDate && quote.travelEndDate) {
    const s = new Date(quote.travelStartDate).getTime();
    const e = new Date(quote.travelEndDate).getTime();
    if (!isNaN(s) && !isNaN(e) && e > s) {
      durationNights = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
    }
  }
  const durationDays = durationNights + 1;
  const durationText = `${durationNights} ${durationNights === 1 ? 'Night' : 'Nights'} / ${durationDays} ${durationDays === 1 ? 'Day' : 'Days'}`;

  // 4. Day-wise Plan
  const dayWisePlan = buildDayWiseItinerary(
    effectiveItems,
    effectiveHubs,
    quote.travelStartDate,
    quote.travelEndDate,
    quote.dayThemes
  );

  // 5. Itemized Accommodation
  const hotels: CommunicationHotelDetail[] = [];
  if (effectiveHubs.length > 0) {
    let checkInCounter = 0;
    effectiveHubs.forEach(h => {
      if (h.hotelId || h.manualHotel?.hotelName) {
        const city = h.hubName || h.destinationName || 'City Hub';
        const hotelName = h.manualHotel?.hotelName || h.hotelId || 'Premium Curated Hotel';
        const nights = h.nights || 1;
        const roomType = h.manualHotel?.roomType || 'Standard Luxury Room';
        const mealPlan = h.manualHotel?.mealPlan || 'Daily Breakfast Included';
        const starRating = h.manualHotel?.starRating || (h.manualHotel as any)?.category || '4 Star / 5 Star';

        let checkInDate = quote.travelStartDate || 'Day 1';
        let checkOutDate = quote.travelEndDate || `Day ${nights + 1}`;

        if (quote.travelStartDate) {
          const s = new Date(quote.travelStartDate);
          s.setDate(s.getDate() + checkInCounter);
          checkInDate = s.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
          s.setDate(s.getDate() + nights);
          checkOutDate = s.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        checkInCounter += nights;

        hotels.push({
          id: h.id,
          hotelName,
          cityHub: city,
          starRating,
          checkInDate,
          checkOutDate,
          nightsCount: nights,
          roomType,
          roomsCount: quote.roomingConfig?.roomsCount || 1,
          occupancy: `${adultsCount} Adults${childrenCount ? ` + ${childrenCount} Ch` : ''}`,
          mealPlan,
          notes: h.manualHotel?.internalNotes || (h.manualHotel as any)?.notes
        });
      }
    });
  }

  // 6. Itemized Activities & Transfers & Visas
  const activities: CommunicationActivityDetail[] = [];
  const transfers: CommunicationTransferDetail[] = [];
  const visaServices: CommunicationVisaDetail[] = [];
  const otherServices: Array<{ name: string; category: string; description?: string }> = [];

  effectiveItems.forEach(it => {
    const p = it.product;
    const pType = p.productType || '';
    const cat = p.category || '';

    if (pType === 'TRANSFER' || cat === 'Transfers' || cat === 'Transport') {
      transfers.push({
        id: it.id,
        serviceName: p.name,
        date: it.travelDate || quote.travelStartDate || 'As per itinerary',
        pickupLocation: (it as any).pickupLocation || (p as any).pickupLocation || `${p.city || quote.destination} Station / Airport`,
        dropLocation: (it as any).dropLocation || (p as any).dropLocation || 'Selected Hotel Stay',
        pickupTime: (it as any).pickupTime || undefined,
        vehicleType: (p as any).vehicleType || 'Dedicated Private Vehicle',
        capacity: (p as any).capacity || `${it.pax?.adults || 2} Pax`,
        passengerCount: it.pax?.adults || adultsCount,
        transferType: (p as any).transferType || 'Private Dedicated Chauffeur',
        instructions: (it as any).transferInstructions || undefined
      });
    } else if (pType === 'ACTIVITY' || pType === 'TOUR' || pType === 'DAY_TOUR' || cat === 'Activities' || cat === 'Private Tours' || cat === 'Day Trips' || cat === 'Tours') {
      activities.push({
        id: it.id,
        activityName: p.name,
        location: p.city || quote.destination,
        date: it.travelDate || quote.travelStartDate || 'Scheduled Itinerary Day',
        time: (it as any).scheduledTime || undefined,
        duration: (p as any).duration || (p as any).durationHours ? `${(p as any).durationHours} Hours` : undefined,
        passengerCount: it.pax?.adults || adultsCount,
        inclusions: (p as any).includedFeatures || (p as any).inclusions || [],
        meetingPoint: (p as any).meetingPoint || undefined,
        specialInstructions: (it as any).specialInstructions || undefined
      });
    } else if (pType === 'VISA' || pType === 'Visa Service' || (p as any).subcategory === 'Visa Facilitation' || p.sku?.startsWith('VSA-')) {
      visaServices.push({
        id: it.id,
        serviceName: p.name,
        destination: p.destinationName || quote.destination,
        applicability: 'All Registered Travelers',
        applicantsCount: it.pax?.adults || adultsCount,
        serviceType: (p as any).visaType || 'Official E-Visa Assistance & Document Audit',
        processingInfo: (p as any).processingTime || '3-5 Business Days',
        documentationNotes: 'Valid Passport copies (min 6 months validity) required upon booking acceptance.'
      });
    } else if (pType !== 'HOTEL' && !it.isManualHotel) {
      otherServices.push({
        name: p.name,
        category: p.category || 'Travel Inclusions',
        description: p.shortDescription || p.name
      });
    }
  });

  // 7. Inclusions & Exclusions
  const inclusions: string[] = [
    `${durationText} bespoke itinerary management by TheUnbound Destination Management Company`,
    `Hand-picked accommodation across ${effectiveHubs.map(h => h.hubName).join(', ') || quote.destination}`,
    `All contracted private transfers and airport ground logistics as specified in Day-Wise Plan`,
    `All listed sightseeing experiences, entrance tickets, and licensed local guide services`,
    `24/7 dedicated local emergency ground assistance hotline & dispatch team`
  ];
  if (visaServices.length > 0) {
    inclusions.push(`Comprehensive visa documentation filing and assistance for ${quote.destination}`);
  }

  const exclusions: string[] = [
    'International & domestic flight airfare (unless explicitly listed as included)',
    'Personal expenditures, mini-bar, telephone calls, and room service laundry',
    'Travel insurance & medical emergency cover (available upon request)',
    'Optional gratuities/tips for local chauffeurs and private tour guides',
    'Early check-in and late check-out beyond hotel standard operating policies'
  ];

  // 8. Commercial Protection (Zero Leaks to Buyer / Agent)
  const isInternalAdmin = role === 'ADMIN_OPS';
  const commercialDetails = isInternalAdmin ? {
    totalNetCost: quote.totalNetCost || 0,
    totalMargin: quote.totalMargin || 0,
    totalTaxes: quote.totalTaxes || 0,
    markupPercent: quote.overallMarkupPercent || 0
  } : undefined;

  // 9. Options Breakdown
  let optionsList: CommunicationOptionDetail[] | undefined = undefined;
  if (quote.options && quote.options.length > 0) {
    optionsList = quote.options.map((opt, idx) => {
      const optHotels: CommunicationHotelDetail[] = [];
      (opt.routeHubs || []).forEach(h => {
        if (h.hotelId || h.manualHotel?.hotelName) {
          optHotels.push({
            hotelName: h.manualHotel?.hotelName || h.hotelId || 'Premium Hotel',
            cityHub: h.hubName || h.destinationName || 'Hub',
            checkInDate: quote.travelStartDate || 'TBD',
            checkOutDate: quote.travelEndDate || 'TBD',
            nightsCount: h.nights || 1,
            roomType: h.manualHotel?.roomType || 'Standard Room',
            roomsCount: 1,
            occupancy: `${adultsCount} Adults`,
            mealPlan: h.manualHotel?.mealPlan || 'Breakfast'
          });
        }
      });

      return {
        optionId: opt.id,
        optionNumber: idx + 1,
        optionTitle: opt.title || `Option ${idx + 1}`,
        hotelTier: opt.hotelTier || opt.badge,
        sellingPrice: opt.totalSellingPrice,
        formattedSellingPrice: formatCurrency(opt.totalSellingPrice, quote.currency || 'USD'),
        currency: quote.currency || 'USD',
        hotels: optHotels,
        dayWisePlan: buildDayWiseItinerary(opt.items || [], opt.routeHubs || [], quote.travelStartDate, quote.travelEndDate),
        inclusions,
        exclusions
      };
    });
  }

  // Sender branding
  const preparedBy = {
    name: options?.senderBranding?.name || quote.agentName || 'TheUnbound Travel Specialist',
    agency: options?.senderBranding?.agency || quote.agentAgency || quote.agentCompany || 'TheUnbound Luxury DMC Network',
    email: options?.senderBranding?.email || quote.agentEmail || 'sales@theunbound.in',
    phone: options?.senderBranding?.phone || quote.agentPhone || '+91-9811654959',
    role: quote.agentAgency ? 'Authorised Travel Partner' : 'Ground Operations Lead',
    logoUrl: options?.senderBranding?.logoUrl || quote.agentLogoUrl
  };

  return {
    quoteId: quote.quoteNumber || quote.id,
    version: quote.version || 1,
    quoteDate: quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    validUntil: quote.validUntil || '14 Days from issuance',
    preparedFor: {
      name: quote.clientName || 'Valued Guest',
      email: quote.clientEmail,
      phone: quote.clientPhone,
      company: quote.clientCompany
    },
    preparedBy,
    tripSummary: {
      destination: quote.destination || 'Global Itinerary',
      citiesHubs: effectiveHubs.map(h => h.hubName || h.destinationName) || [quote.destination],
      travelDates: formatTravelDates(quote.travelStartDate, quote.travelEndDate),
      durationDays,
      durationNights,
      durationText,
      travelers,
      hotelCategory: hotels[0]?.starRating || '4 Star / 5 Star Curated',
      travelStyle: quote.travelStyle || 'Private & Tailor-Made Luxury',
      keyExperiences: activities.slice(0, 4).map(a => a.activityName),
      transferStyle: transfers[0]?.transferType || 'Private Dedicated Vehicle',
      visaRequirements: visaServices.length > 0 ? 'Visa Facilitation Included' : undefined
    },
    dayWisePlan,
    hotels,
    activities,
    transfers,
    visaServices,
    otherServices,
    inclusions,
    exclusions,
    pricing: {
      finalSellingPrice: effectiveSellingPrice,
      formattedPrice: formatCurrency(effectiveSellingPrice, quote.currency || 'USD'),
      currency: quote.currency || 'USD',
      taxesIncluded: true,
      paymentTerms: '30% Advance Deposit upon acceptance; 70% Balance 21 days prior to travel departure.',
      cancellationTerms: 'Cancellations up to 30 days prior: 90% refundable. 15-29 days: 50% refundable. Within 14 days: 100% cancellation charge.',
      validUntilText: quote.validUntil || '14 Days from issuance',
      commercialDetails
    },
    options: optionsList,
    selectedOptionNumber,
    selectedOptionTitle,
    importantNotes: [
      'Rooms and chauffeur allocations are held on provisional basis until deposit clearance.',
      'Check-in standard time is 15:00 hrs; check-out is 11:00 hrs across partner hotels.',
      'All listed transfers provide meet & greet with dedicated name-board service.'
    ]
  };
}

/**
 * Builds the canonical BookingCommunicationPayload from an authoritative Booking record.
 */
export function buildBookingCommunicationPayload(
  booking: Booking,
  role?: CommunicationRole
): BookingCommunicationPayload {
  const adults = booking.customer.totalAdults || (booking.customer as any).passengers?.adults || 2;
  const children = booking.customer.totalChildren || (booking.customer as any).passengers?.children || 0;
  const infants = booking.customer.totalInfants || (booking.customer as any).passengers?.infants || 0;
  const totalPax = adults + children + infants;

  const travelers: CommunicationPassengerInfo = {
    adultsCount: adults,
    childrenCount: children,
    childAges: [],
    infantsCount: infants,
    infantAges: [],
    totalPax,
    leadPassengerName: booking.customer.leadTravelerName || 'Guest',
    displayText: `${adults} Adults${children ? ` • ${children} Ch` : ''}`
  };

  const dayWisePlan = buildDayWiseItinerary(
    (booking.items || []).map(bi => ({
      id: bi.id,
      product: {
        id: bi.productId,
        name: bi.productName,
        sku: bi.productSku,
        category: bi.category as any,
        productType: bi.category as any,
        destinationName: bi.destinationName,
        city: bi.city,
        basePrice: bi.unitSellingPrice || bi.totalPrice,
        currency: bi.currency as any
      } as any,
      selectedAddonIds: bi.selectedAddonNames || [],
      calculation: {
        totalNetCost: bi.unitNetPrice ? bi.unitNetPrice * bi.totalPax : bi.totalPrice,
        totalSellingPrice: bi.totalPrice,
        currency: bi.currency
      } as any,
      quantity: 1,
      travelDate: bi.travelDate,
      pax: { adults: bi.adults, children: bi.children, infants: bi.infants },
      totalNetCost: bi.totalPrice,
      totalSellingPrice: bi.totalPrice,
      currency: bi.currency as any
    })),
    [],
    booking.travelStartDate,
    booking.travelEndDate
  );

  const bookedItems = (booking.items || []).map(item => ({
    name: item.productName,
    sku: item.productSku,
    category: item.category,
    destination: `${item.destinationName} (${item.city})`,
    date: item.travelDate,
    paxText: `${item.adults} Adults${item.children ? ` • ${item.children} Ch` : ''}`,
    sellingPrice: item.totalPrice,
    formattedPrice: formatCurrency(item.totalPrice, item.currency)
  }));

  const destination = booking.items?.[0]?.destinationName || 'Destinations';
  const durationText = booking.travelStartDate && booking.travelEndDate 
    ? `${booking.travelStartDate} to ${booking.travelEndDate}`
    : 'Upcoming Travel Dates';

  return {
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    leadId: (booking as any).leadId,
    quoteId: (booking as any).quoteId,
    customer: {
      name: booking.customer.leadTravelerName,
      email: booking.customer.email,
      phone: booking.customer.phone,
      agencyName: booking.customer.agencyName,
      agentRef: booking.customer.agentRefNumber,
      flightDetails: booking.customer.flightDetails,
      pickupLocation: booking.customer.pickupLocation,
      specialRequests: booking.customer.specialRequests
    },
    destination,
    travelDates: `${booking.travelStartDate} – ${booking.travelEndDate}`,
    durationText,
    travelers,
    servicesCount: {
      hotels: (booking.items || []).filter(i => i.category === 'Hotels').length,
      activities: (booking.items || []).filter(i => i.category === 'Activities' || i.category === 'Tours').length,
      transfers: (booking.items || []).filter(i => i.category === 'Transfers').length,
      visas: (booking.items || []).filter(i => i.category === 'Visa' || i.category === 'Travel Services').length,
      total: (booking.items || []).length
    },
    dayWisePlan,
    bookedItems,
    totalSellingPrice: booking.totalAmount,
    formattedTotalPrice: formatCurrency(booking.totalAmount, booking.currency),
    currency: booking.currency,
    paymentStatus: booking.paymentStatus,
    bookingStatus: booking.status,
    paymentProofs: booking.paymentProofs?.map(p => ({
      trancheLabel: p.trancheLabel,
      amount: p.amount,
      currency: p.currency,
      status: p.verificationStatus,
      date: p.uploadedAt
    })),
    actionRequired: booking.status === 'PENDING_CONFIRMATION'
      ? 'Verify local hotel allotment & chauffeur dispatch within 24-48h SLA'
      : 'Operations processing underway',
    nextSlaDeadline: '24–48 Hours',
    portalUrl: `/admin?tab=BOOKING_MANAGEMENT&bookingId=${booking.id}`
  };
}

// ----------------------------------------------------
// COMPLETENESS VALIDATION (SECTION 38)
// ----------------------------------------------------

export function validateQuoteCommunication(payload: QuoteCommunicationPayload): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: Customer
  if (!payload.preparedFor.name || payload.preparedFor.name === 'Client Name Pending') {
    errors.push('Customer name is required before generating official communication.');
  }

  // Required: Quote ID
  if (!payload.quoteId) {
    errors.push('Authoritative Quote ID is missing.');
  }

  // Required: Destination
  if (!payload.tripSummary.destination) {
    errors.push('Destination is missing.');
  }

  // Required: Pricing
  if (!payload.pricing.finalSellingPrice || payload.pricing.finalSellingPrice <= 0) {
    errors.push('Final selling price must be greater than zero.');
  }

  // Required: Day-Wise Plan
  if (!payload.dayWisePlan || payload.dayWisePlan.length === 0) {
    errors.push('A complete Day-Wise Plan is mandatory for all customer-facing proposals.');
  }

  // Required: Travelers
  if (!payload.tripSummary.travelers.adultsCount || payload.tripSummary.travelers.adultsCount < 1) {
    errors.push('At least 1 adult passenger must be specified.');
  }

  // Warnings for best practice
  if (payload.hotels.length === 0 && payload.dayWisePlan.length > 2) {
    warnings.push('No hotel accommodation is explicitly linked for this multi-day itinerary.');
  }

  if (payload.transfers.length === 0) {
    warnings.push('No airport or intercity transfers are included in this quote.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ----------------------------------------------------
// CONTEXTUAL EMAIL SUBJECTS (SECTION 27)
// ----------------------------------------------------

export function generateContextualEmailSubject(
  type: 'NEW_BOOKING' | 'QUOTE_READY' | 'PAYMENT_PROOF' | 'BOOKING_STATUS' | 'NEW_LEAD' | 'OPERATIONAL_ALERT',
  data: {
    destination?: string;
    bookingRef?: string;
    quoteRef?: string;
    customerName?: string;
    travelDate?: string;
    duration?: string;
    amount?: number;
    currency?: string;
    status?: string;
    serviceType?: string;
  }
): string {
  switch (type) {
    case 'NEW_BOOKING':
      return `New ${data.destination || 'Ground'} Booking — ${data.bookingRef || 'BK-NEW'} — ${data.customerName || 'Guest'} — ${data.travelDate || 'Upcoming'}`;
    case 'QUOTE_READY':
      return `Quote Ready — ${data.destination || 'Itinerary'} ${data.duration || ''} — ${data.quoteRef || 'Proposal'} — ${data.customerName || 'Valued Guest'}`;
    case 'PAYMENT_PROOF':
      return `Payment Proof Submitted — ${data.bookingRef || 'Booking'} — ${data.currency || 'INR'} ${(data.amount || 0).toLocaleString()}`;
    case 'BOOKING_STATUS':
      return `Booking Status Updated — ${data.bookingRef || 'Booking'} — ${data.status || 'Processed'}`;
    case 'NEW_LEAD':
      return `New Lead — ${data.destination || 'Custom'} Trip — ${data.customerName || 'Lead'} — ${data.quoteRef || 'Ref'}`;
    case 'OPERATIONAL_ALERT':
      return `Action Required — ${data.serviceType || 'Service'} Confirmation — ${data.bookingRef || 'Ground Ops'}`;
    default:
      return `TheUnbound DMC Communication — ${data.bookingRef || data.quoteRef || 'Official Update'}`;
  }
}

// ----------------------------------------------------
// WHATSAPP QUOTE MESSAGE FORMATTER (SECTION 16)
// ----------------------------------------------------

export interface FormatWhatsAppQuoteOptions {
  useEmojis?: boolean;
  formatStyle?: 'DETAILED' | 'SUMMARY';
}

export function formatWhatsAppQuoteFromPayload(
  payload: QuoteCommunicationPayload,
  customNote?: string,
  optionsOrUseEmojis?: boolean | FormatWhatsAppQuoteOptions
): string {
  // Normalize options
  const options: FormatWhatsAppQuoteOptions = typeof optionsOrUseEmojis === 'boolean'
    ? { useEmojis: optionsOrUseEmojis }
    : (optionsOrUseEmojis || { useEmojis: true, formatStyle: 'DETAILED' });

  const useEmojis = options.useEmojis !== false;
  const isSummary = options.formatStyle === 'SUMMARY';

  const DIVIDER = useEmojis ? '━━━━━━━━━━━━━━━━━━━━━' : '------------------------';
  const sections: string[] = [];

  // 1. Header & Trip Overview
  const headerLines: string[] = [];
  if (useEmojis) {
    headerLines.push(
      `✨ *THEUNBOUND — LUXURY TRAVEL PROPOSAL* ✨`,
      `📋 *Quote Reference:* *#${payload.quoteId}*`,
      `👋 *Prepared for:* *${payload.preparedFor.name}*`,
      ``,
      `🌍 *Destination:* *${payload.tripSummary.destination.toUpperCase()}*`,
      `🗓️ *Duration:* ${payload.tripSummary.durationText}`,
      `👥 *Travelers:* ${payload.tripSummary.travelers.displayText}`,
      `✈️ *Travel Dates:* ${payload.tripSummary.travelDates}`
    );
    if (payload.selectedOptionTitle) {
      headerLines.push(`🌟 *Curated Option:* ${payload.selectedOptionTitle}`);
    }
    if (payload.tripSummary.citiesHubs && payload.tripSummary.citiesHubs.length > 0) {
      headerLines.push(`🗺️ *Route Highlights:* ${payload.tripSummary.citiesHubs.join(' ➔ ')}`);
    }
  } else {
    headerLines.push(
      `*THEUNBOUND — TRAVEL PROPOSAL*`,
      `Quote ID: *#${payload.quoteId}*`,
      `Prepared for: *${payload.preparedFor.name}*`,
      ``,
      `*${payload.tripSummary.destination.toUpperCase()}*`,
      `Duration: ${payload.tripSummary.durationText}`,
      `Travelers: ${payload.tripSummary.travelers.displayText}`,
      `Travel Dates: ${payload.tripSummary.travelDates}`
    );
    if (payload.selectedOptionTitle) {
      headerLines.push(`Selected Option: ${payload.selectedOptionTitle}`);
    }
    if (payload.tripSummary.citiesHubs && payload.tripSummary.citiesHubs.length > 0) {
      headerLines.push(`Route Hubs: ${payload.tripSummary.citiesHubs.join(' -> ')}`);
    }
  }
  sections.push(headerLines.join('\n'));

  // 2. Curated Accommodation by Hub
  if (payload.hotels.length > 0) {
    const hotelLines: string[] = [
      useEmojis ? `🏨 *CURATED ACCOMMODATION & LUXURY STAYS*` : `*ACCOMMODATION & STAYS*`
    ];
    payload.hotels.forEach(h => {
      if (useEmojis) {
        let hotelEntry = `• 🏙️ *${h.cityHub.toUpperCase()}* — *${h.nightsCount}* ${h.nightsCount === 1 ? 'Night' : 'Nights'}\n  ⭐ *${h.hotelName}*\n  🛏️ *Room:* ${h.roomType} | 🍳 *Meal Plan:* ${h.mealPlan}`;
        if (h.checkInDate && h.checkOutDate) {
          hotelEntry += `\n  📅 *Stay Dates:* ${h.checkInDate} ➔ ${h.checkOutDate}`;
        }
        hotelLines.push(hotelEntry);
      } else {
        let hotelEntry = `• *${h.cityHub.toUpperCase()}* — ${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'}\n  ${h.hotelName} (${h.roomType} • ${h.mealPlan})`;
        if (h.checkInDate && h.checkOutDate) {
          hotelEntry += `\n  Stay Dates: ${h.checkInDate} to ${h.checkOutDate}`;
        }
        hotelLines.push(hotelEntry);
      }
    });
    sections.push(hotelLines.join('\n'));
  }

  // 3. Complete Day-Wise Plan (Section 16 Mandate)
  if (!isSummary && payload.dayWisePlan && payload.dayWisePlan.length > 0) {
    const planLines: string[] = [
      useEmojis ? `🗺️ *CHRONOLOGICAL DAY-WISE ITINERARY*` : `*DAY-WISE ITINERARY*`
    ];

    payload.dayWisePlan.forEach(day => {
      const dayHeader = useEmojis
        ? `📅 *Day ${day.dayNumber} [${day.dayOfWeek ? `${day.dayOfWeek}, ` : ''}${day.date}]:* *${day.title}*`
        : `*Day ${day.dayNumber} (${day.date}): ${day.title}*`;

      const dayItems: string[] = [dayHeader];

      // Transfers
      if (day.transfers && day.transfers.length > 0) {
        day.transfers.forEach(t => {
          if (useEmojis) {
            dayItems.push(`  🚗 *Private Transfer:* ${t.title}\n     📍 ${t.pickupLocation} ➔ ${t.dropLocation}${t.pickupTime ? ` (${t.pickupTime})` : ''}${t.vehicleType ? ` [${t.vehicleType}]` : ''}`);
          } else {
            dayItems.push(`  • Transfer: ${t.title} (${t.pickupLocation} -> ${t.dropLocation})${t.pickupTime ? ` @ ${t.pickupTime}` : ''}`);
          }
        });
      }

      // Transit / Rail
      if (day.transportServices && day.transportServices.length > 0) {
        day.transportServices.forEach(r => {
          if (useEmojis) {
            dayItems.push(`  🚅 *Transit / Train:* ${r.title} (${r.route}) [${r.classType}]`);
          } else {
            dayItems.push(`  • Rail / Transit: ${r.title} (${r.route}) [${r.classType}]`);
          }
        });
      }

      // Activities
      if (day.activities && day.activities.length > 0) {
        day.activities.forEach(a => {
          if (useEmojis) {
            let actLine = `  🎟️ *Curated Experience:* ${a.title}${a.time ? ` (@ ${a.time})` : ''}`;
            if (a.location) {
              actLine += `\n     📍 Location: ${a.location}`;
            }
            if (a.inclusions && a.inclusions.length > 0) {
              actLine += `\n     ✨ Inclusions: ${a.inclusions.join(', ')}`;
            }
            if (a.specialInstructions) {
              actLine += `\n     💡 Note: ${a.specialInstructions}`;
            }
            dayItems.push(actLine);
          } else {
            let actLine = `  • Activity: ${a.title}${a.time ? ` @ ${a.time}` : ''}`;
            if (a.location) {
              actLine += ` [${a.location}]`;
            }
            if (a.inclusions && a.inclusions.length > 0) {
              actLine += ` (Includes: ${a.inclusions.join(', ')})`;
            }
            dayItems.push(actLine);
          }
        });
      }

      // Hotel stay
      if (day.hotelStay) {
        if (useEmojis) {
          dayItems.push(`  🏨 *Hotel Stay:* ${day.hotelStay.hotelName}${day.hotelStay.checkIn ? ' 🔑 [Check-in]' : ''}`);
        } else {
          dayItems.push(`  • Hotel: ${day.hotelStay.hotelName}${day.hotelStay.checkIn ? ' [Check-in]' : ''}`);
        }
      }

      // Meals
      if (day.meals && day.meals.length > 0 && day.meals[0] !== 'At Leisure') {
        if (useEmojis) {
          dayItems.push(`  🍽️ *Meals Included:* ${day.meals.join(', ')}`);
        } else {
          dayItems.push(`  • Meals: ${day.meals.join(', ')}`);
        }
      }

      // Overnight
      if (useEmojis) {
        dayItems.push(`  🛌 *Overnight Hub:* ${day.overnight}`);
      } else {
        dayItems.push(`  • Overnight: ${day.overnight}`);
      }

      planLines.push(dayItems.join('\n'));
      planLines.push(useEmojis ? `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈` : `------------------------`);
    });

    // Remove trailing mini divider
    if (planLines[planLines.length - 1].startsWith('┈') || planLines[planLines.length - 1].startsWith('-')) {
      planLines.pop();
    }

    sections.push(planLines.join('\n'));
  }

  // 4. Package Inclusions & Privileges
  const inclusionLines: string[] = [
    useEmojis ? `💎 *PACKAGE INCLUSIONS & PRIVILEGES*` : `*PACKAGE INCLUSIONS*`
  ];
  if (payload.inclusions && payload.inclusions.length > 0) {
    payload.inclusions.forEach(inc => {
      inclusionLines.push(useEmojis ? `✅ ${inc}` : `• ${inc}`);
    });
  } else {
    const defaultInclusions = [
      'All private door-to-door ground transfers with professional chauffeur',
      'Handpicked luxury accommodation with daily gourmet breakfast',
      'Pre-booked priority entrance tickets to all scheduled tours & attractions',
      'English-speaking certified local guide on scheduled tours',
      '24/7 dedicated emergency ground dispatch & concierge assistance via WhatsApp',
      'All applicable destination road tolls, fuel fees & local service taxes'
    ];
    defaultInclusions.forEach(inc => {
      inclusionLines.push(useEmojis ? `✅ ${inc}` : `• ${inc}`);
    });
  }
  sections.push(inclusionLines.join('\n'));

  // 5. Exclusions & Transparency
  const exclusionLines: string[] = [
    useEmojis ? `ℹ️ *IMPORTANT EXCLUSIONS / TRANSPARENCY*` : `*EXCLUSIONS*`
  ];
  if (payload.exclusions && payload.exclusions.length > 0) {
    payload.exclusions.forEach(exc => {
      exclusionLines.push(useEmojis ? `❌ ${exc}` : `• ${exc}`);
    });
  } else {
    const defaultExclusions = [
      'International flights (available upon request from our air ticketing desk)',
      'Personal expenditures, laundry, telephone calls & minibar charges',
      'City tourist taxes payable directly at hotel reception upon check-out (if applicable)',
      'Optional travel insurance & personal gratuities'
    ];
    defaultExclusions.forEach(exc => {
      exclusionLines.push(useEmojis ? `❌ ${exc}` : `• ${exc}`);
    });
  }
  sections.push(exclusionLines.join('\n'));

  // 6. Visa & Special Services (if applicable)
  if ((payload.visaServices && payload.visaServices.length > 0) || (payload.otherServices && payload.otherServices.length > 0)) {
    const visaLines: string[] = [
      useEmojis ? `🛂 *VISA & CONCIERGE SERVICES*` : `*VISA & TRAVEL SERVICES*`
    ];
    if (payload.visaServices) {
      payload.visaServices.forEach(v => {
        if (useEmojis) {
          visaLines.push(`• 📑 *${v.serviceName}* (${v.destination}) — ${v.applicability || 'Document verification & submission support'}`);
        } else {
          visaLines.push(`• Visa: ${v.serviceName} (${v.destination}) — ${v.applicability || 'Documentation support'}`);
        }
      });
    }
    if (payload.otherServices) {
      payload.otherServices.forEach(s => {
        if (useEmojis) {
          visaLines.push(`• 📶 *${s.name}* (${s.category})`);
        } else {
          visaLines.push(`• Service: ${s.name} (${s.category})`);
        }
      });
    }
    sections.push(visaLines.join('\n'));
  }

  // 7. Investment & Pricing
  const priceLines: string[] = [];
  if (useEmojis) {
    priceLines.push(
      `💰 *PACKAGE INVESTMENT SUMMARY*`,
      `🏷️ *TOTAL FINAL SELLING PRICE:* *${payload.pricing.formattedPrice}*`,
      `👥 *Travelers:* ${payload.tripSummary.travelers.displayText}`,
      `🔒 *Taxes & Fees:* Fully Included — Zero Hidden Surcharges`,
      `⏳ *Price Guaranteed Until:* *${payload.pricing.validUntilText}*`
    );
  } else {
    priceLines.push(
      `*PACKAGE INVESTMENT*`,
      `Total Final Selling Price: *${payload.pricing.formattedPrice}*`,
      `Travelers: ${payload.tripSummary.travelers.displayText}`,
      `Taxes & Fees: Included`,
      `Quote Valid Until: ${payload.pricing.validUntilText}`
    );
  }
  sections.push(priceLines.join('\n'));

  // 8. Custom Note (if provided)
  if (customNote && customNote.trim()) {
    if (useEmojis) {
      sections.push(`📝 *PERSONAL NOTE FROM YOUR TRAVEL DESIGNER:*\n"${customNote.trim()}"`);
    } else {
      sections.push(`*SPECIAL NOTES:*\n${customNote.trim()}`);
    }
  }

  // 9. Interactive Quick Replies & Call to Actions (MANDATE)
  const interactiveLines: string[] = [];
  if (useEmojis) {
    interactiveLines.push(
      `📲 *INTERACTIVE QUICK REPLIES (TAP TO RESPOND):*`,
      `To proceed or customize, simply reply to this message:`,
      ``,
      `1️⃣ *Reply "1" or "CONFIRM"* ➔ Lock in dates & receive booking voucher + invoice`,
      `2️⃣ *Reply "2" or "CUSTOMIZE"* ➔ Adjust dates, swap hotels, or customize activities`,
      `3️⃣ *Reply "3" or "CALL ME"* ➔ Request a quick consultation call with our destination specialist`,
      `4️⃣ *Reply "4" or "PDF"* ➔ Receive full high-resolution official PDF proposal brochure`,
      ``,
      `💬 *Have a question?* Reply directly to this WhatsApp chat — our concierge desk is online to assist you!`
    );
  } else {
    interactiveLines.push(
      `*HOW TO PROCEED (QUICK REPLIES):*`,
      `Reply to this message with any of the following options:`,
      `[1] Confirm & Request Booking Invoice`,
      `[2] Customize Hotels, Dates or Itinerary`,
      `[3] Request a Call with our Destination Specialist`,
      `[4] Request Official PDF Proposal Document`,
      ``,
      `For any questions or changes, please reply directly to this chat.`
    );
  }
  sections.push(interactiveLines.join('\n'));

  // 10. Contact / Dedicated Concierge Sign-off
  const closingLines: string[] = [];
  if (useEmojis) {
    closingLines.push(
      `🛎️ *DEDICATED TRAVEL CONCIERGE*`,
      `👤 *${payload.preparedBy.name}*`,
      `🏢 ${payload.preparedBy.agency || 'TheUnbound Luxury DMC'}`,
      payload.preparedBy.phone ? `📞 WhatsApp / Direct: ${payload.preparedBy.phone}` : '📞 WhatsApp: +91-9811654959',
      payload.preparedBy.email ? `✉️ Email: ${payload.preparedBy.email}` : '✉️ Email: concierge@theunbound.in',
      `🌐 *TheUnbound Global Partner Network*`
    );
  } else {
    closingLines.push(
      `*TRAVEL CONCIERGE & DESK*`,
      `Prepared by: *${payload.preparedBy.name}*`,
      `Agency: ${payload.preparedBy.agency || 'TheUnbound Luxury DMC'}`,
      payload.preparedBy.phone ? `WhatsApp / Tel: ${payload.preparedBy.phone}` : 'WhatsApp: +91-9811654959',
      payload.preparedBy.email ? `Email: ${payload.preparedBy.email}` : 'Email: concierge@theunbound.in'
    );
  }
  sections.push(closingLines.filter(Boolean).join('\n'));

  const fullMessage = sections.join(`\n\n${DIVIDER}\n\n`);

  // Verify Zero Commercial Leakage
  const check = verifyNoCommercialLeak(fullMessage);
  if (!check.isSafe) {
    console.error('COMMERCIAL LEAK PREVENTED in WhatsApp:', check.detectedTerms);
    return fullMessage.replace(new RegExp(`\\b(${check.detectedTerms.join('|')})\\b`, 'gi'), '');
  }

  return fullMessage;
}

// ----------------------------------------------------
// EMAIL PROPOSAL HTML & TEXT FORMATTER (SECTION 17)
// ----------------------------------------------------

export function formatProposalEmailFromPayload(
  payload: QuoteCommunicationPayload
): { htmlBody: string; textBody: string } {
  const textBody = `
Dear ${payload.preparedFor.name},

Please find your personalized travel proposal for ${payload.tripSummary.destination}.

TRIP SUMMARY
Destination: ${payload.tripSummary.destination}
Travel Dates: ${payload.tripSummary.travelDates}
Duration: ${payload.tripSummary.durationText}
Travelers: ${payload.tripSummary.travelers.displayText}

DAY-WISE ITINERARY
${payload.dayWisePlan.map(d => `Day ${d.dayNumber} (${d.date}): ${d.title} - Overnight in ${d.overnight}`).join('\n')}

ACCOMMODATION
${payload.hotels.map(h => `${h.cityHub}: ${h.hotelName} (${h.nightsCount} Nights, ${h.roomType}, ${h.mealPlan})`).join('\n')}

EXPERIENCES & TRANSFERS
${payload.activities.map(a => `• Activity: ${a.activityName} (${a.location})`).join('\n')}
${payload.transfers.map(t => `• Transfer: ${t.serviceName} (${t.pickupLocation} to ${t.dropLocation})`).join('\n')}

TOTAL TRIP PRICE: ${payload.pricing.formattedPrice}
Quote Valid Until: ${payload.pricing.validUntilText}

Prepared by: ${payload.preparedBy.name} (${payload.preparedBy.agency || 'TheUnbound Partner Network'})
  `.trim();

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #0f172a; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
      <!-- Header -->
      <div style="background-color: #0f172a; padding: 28px 24px; text-align: left; border-bottom: 3px solid #00C6A6;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-transform: lowercase;">theunbound</h1>
            <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #00E5C0;">Bespoke Travel Proposal</p>
          </div>
          <div style="text-align: right; background: rgba(255,255,255,0.08); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
            <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; display: block; font-weight: 700;">Quote Reference</span>
            <span style="font-family: monospace; font-size: 14px; font-weight: 700; color: #ffffff;">${payload.quoteId}</span>
          </div>
        </div>
      </div>

      <!-- Main Body -->
      <div style="padding: 28px 24px;">
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          Dear <strong>${payload.preparedFor.name}</strong>,
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
          We are pleased to present your tailored itinerary proposal for <strong>${payload.tripSummary.destination}</strong> (${payload.tripSummary.durationText}).
        </p>

        <!-- Trip Summary Card -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
            Trip Summary
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 5px 0; color: #64748b; width: 35%;">Destination:</td>
              <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${payload.tripSummary.destination}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Cities & Route:</td>
              <td style="padding: 5px 0; font-weight: 600; color: #008972;">${payload.tripSummary.citiesHubs.join(' → ')}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Travel Dates:</td>
              <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${payload.tripSummary.travelDates}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Duration:</td>
              <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${payload.tripSummary.durationText}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Travelers:</td>
              <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${payload.tripSummary.travelers.displayText}</td>
            </tr>
            ${payload.selectedOptionTitle ? `
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Package Option:</td>
              <td style="padding: 5px 0; font-weight: 700; color: #0284c7;">${payload.selectedOptionTitle}</td>
            </tr>` : ''}
          </table>
        </div>

        <!-- Accommodation Section -->
        ${payload.hotels.length > 0 ? `
        <h3 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
          Curated Accommodation (${payload.hotels.length} Stays)
        </h3>
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
            <thead style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
              <tr>
                <th style="padding: 10px 14px; font-weight: 700; color: #475569;">City & Hotel</th>
                <th style="padding: 10px 14px; font-weight: 700; color: #475569;">Dates & Nights</th>
                <th style="padding: 10px 14px; font-weight: 700; color: #475569;">Room & Meals</th>
              </tr>
            </thead>
            <tbody>
              ${payload.hotels.map((h, i) => `
                <tr style="border-bottom: ${i === payload.hotels.length - 1 ? 'none' : '1px solid #f1f5f9'};">
                  <td style="padding: 10px 14px;">
                    <strong style="color: #0f172a;">${h.hotelName}</strong>
                    <div style="font-size: 11px; color: #64748b;">${h.cityHub} • ${h.starRating}</div>
                  </td>
                  <td style="padding: 10px 14px; color: #334155;">
                    <div>${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'}</div>
                    <div style="font-size: 11px; color: #64748b;">${h.checkInDate} to ${h.checkOutDate}</div>
                  </td>
                  <td style="padding: 10px 14px; color: #334155;">
                    <div>${h.roomType}</div>
                    <div style="font-size: 11px; color: #008972; font-weight: 600;">${h.mealPlan}</div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Day-Wise Itinerary Plan (Mandate) -->
        <h3 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
          Day-Wise Itinerary (${payload.dayWisePlan.length} Days)
        </h3>
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; padding: 14px; background: #ffffff;">
          ${payload.dayWisePlan.map(day => `
            <div style="border-bottom: 1px solid #f1f5f9; padding: 12px 0;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                <strong style="font-size: 13px; color: #0f172a;">
                  Day ${day.dayNumber} — ${day.title}
                </strong>
                <span style="font-size: 11px; color: #64748b; font-weight: 600;">
                  📅 ${day.date} (${day.dayOfWeek})
                </span>
              </div>
              <div style="font-size: 12px; line-height: 1.6; color: #475569; padding-left: 8px;">
                ${day.transfers.length > 0 ? `
                  <div style="margin: 2px 0; color: #0284c7;">
                    🚗 <strong>Transfer:</strong> ${day.transfers.map(t => `${t.title} (${t.pickupLocation} → ${t.dropLocation})`).join('; ')}
                  </div>
                ` : ''}
                ${day.activities.length > 0 ? `
                  <div style="margin: 2px 0; color: #0f172a;">
                    🎯 <strong>Experience:</strong> ${day.activities.map(a => `${a.title}${a.time ? ` (${a.time})` : ''}`).join('; ')}
                  </div>
                ` : ''}
                ${day.hotelStay ? `
                  <div style="margin: 2px 0; color: #334155;">
                    🏨 <strong>Hotel:</strong> ${day.hotelStay.hotelName} ${day.hotelStay.checkIn ? '(Check-in)' : ''}
                  </div>
                ` : ''}
                <div style="margin: 2px 0; font-size: 11px; color: #64748b;">
                  🍽️ Meals: ${day.meals.join(', ')} • 🌙 Overnight: <strong>${day.overnight}</strong>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Inclusions & Exclusions -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px;">
            <strong style="font-size: 11px; text-transform: uppercase; color: #166534; display: block; margin-bottom: 8px;">
              ✓ Included in Package
            </strong>
            <ul style="margin: 0; padding-left: 16px; font-size: 11px; line-height: 1.5; color: #14532d;">
              ${payload.inclusions.slice(0, 4).map(inc => `<li>${inc}</li>`).join('')}
            </ul>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px;">
            <strong style="font-size: 11px; text-transform: uppercase; color: #991b1b; display: block; margin-bottom: 8px;">
              ✕ Not Included
            </strong>
            <ul style="margin: 0; padding-left: 16px; font-size: 11px; line-height: 1.5; color: #7f1d1d;">
              ${payload.exclusions.slice(0, 4).map(exc => `<li>${exc}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- Pricing Card -->
        <div style="background-color: #0f172a; border-radius: 12px; padding: 18px 20px; color: #ffffff; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; display: block;">Final Package Investment</span>
            <span style="font-size: 11px; color: #00E5C0;">All private transfers, experiences, stays & taxes included</span>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 24px; font-weight: 900; color: #00E5C0; font-family: monospace;">
              ${payload.pricing.formattedPrice}
            </span>
          </div>
        </div>

        <!-- Proposal Call to Action -->
        <div style="text-align: center; margin-bottom: 24px;">
          <p style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
            Proposal Valid Until: <strong>${payload.pricing.validUntilText}</strong>
          </p>
        </div>

        <!-- Prepared By Section -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 4px 0;">
            Prepared by: <strong>${payload.preparedBy.name}</strong> • ${payload.preparedBy.agency || 'TheUnbound DMC Partner'}
          </p>
          <p style="margin: 0;">
            Contact: <a href="mailto:${payload.preparedBy.email}" style="color: #008972; text-decoration: none;">${payload.preparedBy.email}</a> • ${payload.preparedBy.phone || '+91-9811654959'}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
        TheUnbound Destination Management Company Ltd. • Global Ground Operations & Tailor-Made Luxury Tariffs
      </div>
    </div>
  `;

  return { htmlBody, textBody };
}
