import { 
  PassengerClassification, 
  TripRouteHub, 
  QuoteItem, 
  FeasibilityCheckResult, 
  FeasibilityWarning, 
  Product,
  B2BInsurancePlan,
  B2BEsimPlan,
  QuoteItemContentSnapshot
} from '../types';

/**
 * Passenger Classification according to B2B Travel Industry Standards:
 * - Infant (INF): Below 2 years (< 2). Default cost 0 unless ticketed.
 * - Child No Bed (CNB): 2 to below 5 years (2 to < 5). No extra bed.
 * - Child With Bed (CWB): 5 to below 11 years (5 to < 11). Extra bed required.
 * - Adult (ADT): 11+ years.
 */
export function classifyPassengers(
  adultsCount: number,
  childAges: number[] = [],
  infantsCount: number = 0
): PassengerClassification {
  let adults = Math.max(1, adultsCount);
  let cwb = 0;
  let cnb = 0;
  let infants = Math.max(0, infantsCount);

  const cwbAges: number[] = [];
  const cnbAges: number[] = [];
  const infAges: number[] = [];

  childAges.forEach(age => {
    if (age < 2) {
      infants += 1;
      infAges.push(age);
    } else if (age >= 2 && age < 5) {
      cnb += 1;
      cnbAges.push(age);
    } else if (age >= 5 && age < 11) {
      cwb += 1;
      cwbAges.push(age);
    } else {
      // Age 11+ is classified as adult
      adults += 1;
    }
  });

  const parts: string[] = [];
  parts.push(`ADT: ${adults}`);
  
  if (cwb > 0) {
    const agesStr = cwbAges.length > 0 ? ` (Age ${cwbAges.join(', ')})` : '';
    parts.push(`CWB: ${cwb}${agesStr}`);
  }
  
  if (cnb > 0) {
    const agesStr = cnbAges.length > 0 ? ` (Age ${cnbAges.join(', ')})` : '';
    parts.push(`CNB: ${cnb}${agesStr}`);
  }
  
  if (infants > 0) {
    const agesStr = infAges.length > 0 ? ` (Age ${infAges.join(', ')})` : '';
    parts.push(`INF: ${infants}${agesStr}`);
  }

  const displayText = parts.join(' | ');
  const totalPax = adults + cwb + cnb + infants;

  return {
    adults,
    cwb,
    cnb,
    infants,
    cwbAges,
    cnbAges,
    infAges,
    totalPax,
    displayText
  };
}

/**
 * Standard Operational & Attraction Remarks
 */
export const STANDARD_OPERATIONAL_REMARKS: string[] = [
  'Infant below 2 years is considered free of charge unless specifically ticketed or charged by ground supplier/attraction.',
  'Children aged 2 to below 5 years are classified as CNB (Child No Bed). Hotel breakfast & service surcharges apply as per published tariff.',
  'Children aged 5 to below 11 years are classified as CWB (Child With Bed). Extra rollaway/sofa bed is included in room configuration.',
  'Guests aged 11 years and above are classified as Adults.',
  'Important Notice: If a guest is required to purchase an attraction ticket directly due to age, height, or attraction-specific eligibility rules, the ticket cost will be borne directly by the guest at the gate.'
];

/**
 * B2B Pre-negotiated Insurance Plans
 */
export const B2B_INSURANCE_PLANS: B2BInsurancePlan[] = [
  {
    id: 'ins-comprehensive-gold',
    name: 'Comprehensive International Gold Travel Protection',
    provider: 'Allianz Global Assistance / TheUnbound Cover',
    coverageAmountUSD: 250000,
    coverageSummary: 'Comprehensive medical emergency ($250k), trip interruption, flight delay, baggage loss, & COVID-19 coverage.',
    costPerDayAdultUSD: 4.50,
    costPerDayChildUSD: 2.50,
    sellingPricePerDayAdultUSD: 7.00,
    sellingPricePerDayChildUSD: 4.00,
    medicalEmergencyCoverage: '$250,000 USD cashless hospital admission',
    tripCancellationCoverage: '$5,000 USD non-refundable trip reimbursement',
    baggageLossCoverage: '$1,500 USD delayed or lost luggage protection'
  },
  {
    id: 'ins-elite-platinum',
    name: 'Elite Worldwide VIP Protection (Zero Deductible)',
    provider: 'AXA Assistance Worldwide',
    coverageAmountUSD: 500000,
    coverageSummary: 'Zero deductible premium cover with emergency medevac, adventure sport coverage, and concierge assistance.',
    costPerDayAdultUSD: 8.00,
    costPerDayChildUSD: 4.50,
    sellingPricePerDayAdultUSD: 12.00,
    sellingPricePerDayChildUSD: 7.00,
    medicalEmergencyCoverage: '$500,000 USD full emergency hospitalization',
    tripCancellationCoverage: '$10,000 USD cancellation for any certified reason',
    baggageLossCoverage: '$3,000 USD premium personal effects cover'
  }
];

/**
 * B2B Instant International eSIM Plans
 */
export const B2B_ESIM_PLANS: B2BEsimPlan[] = [
  {
    id: 'esim-asia-10gb',
    destination: 'Pan-Asia (Japan, Singapore, Malaysia, Bali, Vietnam, Thailand)',
    dataAllowance: '10 GB High-Speed 5G',
    validityDays: 15,
    carrier: 'Tier-1 Regional 5G Roaming Network',
    netCostUSD: 11.00,
    sellingPriceUSD: 18.00,
    features: ['Instant QR Activation', 'Hotspot / Tethering Enabled', '5G / 4G LTE Speed', 'WhatsApp / Google Maps Ground Access']
  },
  {
    id: 'esim-asia-unlimited',
    destination: 'Pan-Asia (Japan, Singapore, Malaysia, Bali, Vietnam, Thailand)',
    dataAllowance: 'Unlimited Data (Daily Fair Use 2GB High Speed, then Unlimited 128kbps)',
    validityDays: 10,
    carrier: 'Tier-1 Regional 5G Roaming Network',
    netCostUSD: 16.00,
    sellingPriceUSD: 26.00,
    features: ['Instant QR Activation', 'Unlimited Data Access', 'Zero Roaming Shock', 'Local Direct Routing']
  },
  {
    id: 'esim-global-20gb',
    destination: 'Worldwide 140+ Countries',
    dataAllowance: '20 GB Global 5G',
    validityDays: 30,
    carrier: 'Global Roaming Alliance',
    netCostUSD: 24.00,
    sellingPriceUSD: 38.00,
    features: ['Multi-Country Automatic Roaming', 'Valid across 140+ Nations', 'Hotspot Enabled', '30 Days Validity']
  }
];

/**
 * Intelligent Transfer Suggestions Generator
 */
export interface TransferSuggestion {
  id: string;
  type: 'AIRPORT_ARRIVAL' | 'INTERCITY' | 'AIRPORT_DEPARTURE';
  title: string;
  fromCity?: string;
  toCity?: string;
  fromLocation: string;
  toLocation: string;
  suggestedDay: number;
  dayNumber: number;
  estimatedCostUSD: number;
  vehicleType: 'Sedan' | 'SUV' | 'MPV' | 'Van' | 'Coach' | string;
  transferMode: 'PRIVATE' | 'SIC';
  description: string;
}

export function generateTransferSuggestions(
  routeHubs: TripRouteHub[],
  totalDays: number
): TransferSuggestion[] {
  const suggestions: TransferSuggestion[] = [];

  if (!routeHubs || routeHubs.length === 0) return suggestions;

  const firstHub = routeHubs[0];
  const lastHub = routeHubs[routeHubs.length - 1];

  // 1. Day 1 Airport Arrival Transfer
  suggestions.push({
    id: 'transfer-arrival-day1',
    type: 'AIRPORT_ARRIVAL',
    title: `${firstHub.hubName} International Airport → ${firstHub.hubName} Hotel`,
    fromCity: `${firstHub.hubName} Airport`,
    toCity: firstHub.hubName,
    fromLocation: `${firstHub.hubName} Airport (Arrival Hall Meet & Greet)`,
    toLocation: `${firstHub.hubName} Hotel / Accommodation`,
    suggestedDay: 1,
    dayNumber: 1,
    estimatedCostUSD: 65,
    vehicleType: 'MPV',
    transferMode: 'PRIVATE',
    description: `Private door-to-door ground transfer with English-speaking chauffeur & 60 mins flight delay buffer.`
  });

  // 2. Intercity transfers between consecutive hubs
  let currentDay = 1 + (firstHub.nights || 1);
  for (let i = 0; i < routeHubs.length - 1; i++) {
    const fromHub = routeHubs[i];
    const toHub = routeHubs[i + 1];

    suggestions.push({
      id: `transfer-intercity-${fromHub.hubId || i}-${toHub.hubId || i + 1}`,
      type: 'INTERCITY',
      title: `${fromHub.hubName} Hotel → ${toHub.hubName} Hotel`,
      fromCity: fromHub.hubName,
      toCity: toHub.hubName,
      fromLocation: `${fromHub.hubName} Hotel (Check-out)`,
      toLocation: `${toHub.hubName} Hotel (Check-in)`,
      suggestedDay: currentDay,
      dayNumber: currentDay,
      estimatedCostUSD: 140,
      vehicleType: 'MPV',
      transferMode: 'PRIVATE',
      description: `Scenic private intercity chauffeur transfer from ${fromHub.hubName} to ${toHub.hubName} with luggage assistance.`
    });

    currentDay += (toHub.nights || 1);
  }

  // 3. Final Day Airport Departure Transfer
  suggestions.push({
    id: `transfer-departure-day${totalDays}`,
    type: 'AIRPORT_DEPARTURE',
    title: `${lastHub.hubName} Hotel → ${lastHub.hubName} International Airport`,
    fromCity: lastHub.hubName,
    toCity: `${lastHub.hubName} Airport`,
    fromLocation: `${lastHub.hubName} Hotel (Lobby Pickup)`,
    toLocation: `${lastHub.hubName} Airport (Departure Terminal)`,
    suggestedDay: totalDays,
    dayNumber: totalDays,
    estimatedCostUSD: 65,
    vehicleType: 'MPV',
    transferMode: 'PRIVATE',
    description: `Scheduled private airport drop-off 3.5 hours prior to international flight departure.`
  });

  return suggestions;
}

/**
 * Comprehensive Feasibility & Operational Engine
 */
export function checkItineraryFeasibility(
  routeHubs: TripRouteHub[],
  items: QuoteItem[],
  totalDays: number,
  visaAssistanceChoice: string = 'NOT_REQUIRED',
  hasInsurance: boolean = false,
  hasEsim: boolean = false
): FeasibilityCheckResult {
  const warnings: FeasibilityWarning[] = [];
  const recommendations: string[] = [];
  let score = 10.0;

  // 1. Check Hotels Coverage
  const hotelItems = items.filter(it => 
    (it.product.category || '').toLowerCase().includes('hotel') || 
    (it.product.category || '').toLowerCase().includes('accommodation') ||
    (it.product.category || '').toLowerCase().includes('resort') ||
    it.isManualHotel === true ||
    (it as any).hotelDetails !== undefined
  );

  const totalHubNights = routeHubs.reduce((sum, h) => sum + (h.nights || 0), 0);
  const totalHotelNights = routeHubs.reduce((sum, h) => sum + (h.hotelId || h.isManualHotel ? h.nights : 0), 0);

  routeHubs.forEach((hub, idx) => {
    if (!hub.hotelId && !hub.isManualHotel) {
      score -= 1.5;
      warnings.push({
        id: `warn-hotel-missing-${hub.id || idx}`,
        type: 'HOTEL',
        severity: 'CRITICAL',
        message: `No accommodation selected for ${hub.hubName} (${hub.nights} Nights).`,
        actionLabel: `Add Hotel in ${hub.hubName}`,
        actionType: 'ADD_HOTEL',
        hubId: hub.hubId,
        hubName: hub.hubName
      });
    }
  });

  // 2. Check Airport Transfers (Arrival Day 1 and Departure Final Day)
  const transferItems = items.filter(it => 
    (it.product as any).isTransfer || 
    (it.product.category || '').toLowerCase().includes('transfer') ||
    (it.product.category || '').toLowerCase().includes('transport') ||
    (it.product.subcategory || '').toLowerCase().includes('transfer')
  );

  const hasArrivalTransfer = transferItems.some(it => 
    (it.product.name || '').toLowerCase().includes('arrival') || 
    (it.product.name || '').toLowerCase().includes('airport')
  );
  const hasDepartureTransfer = transferItems.some(it => 
    (it.product.name || '').toLowerCase().includes('departure') || 
    (it.product.name || '').toLowerCase().includes('drop')
  );

  if (!hasArrivalTransfer) {
    score -= 0.8;
    warnings.push({
      id: 'warn-arrival-transfer-missing',
      type: 'TRANSFER',
      severity: 'WARNING',
      message: 'Day 1 Arrival Airport Ground Transfer is not configured.',
      actionLabel: 'Add Arrival Transfer',
      actionType: 'ADD_TRANSFER',
      dayNumber: 1
    });
  }

  if (!hasDepartureTransfer && totalDays > 1) {
    score -= 0.6;
    warnings.push({
      id: 'warn-departure-transfer-missing',
      type: 'TRANSFER',
      severity: 'WARNING',
      message: `Day ${totalDays} Airport Departure Drop-off is not configured.`,
      actionLabel: 'Add Departure Transfer',
      actionType: 'ADD_TRANSFER',
      dayNumber: totalDays
    });
  }

  // 3. Check Intercity Transfers if multi-hub
  if (routeHubs.length > 1) {
    let currentDay = 1 + (routeHubs[0].nights || 1);
    for (let i = 0; i < routeHubs.length - 1; i++) {
      const fromHub = routeHubs[i];
      const toHub = routeHubs[i + 1];
      const hasIntercity = transferItems.some(it => 
        (it.product.name || '').toLowerCase().includes((fromHub.hubName || '').toLowerCase()) && 
        (it.product.name || '').toLowerCase().includes((toHub.hubName || '').toLowerCase())
      );

      if (!hasIntercity) {
        score -= 0.6;
        warnings.push({
          id: `warn-intercity-${fromHub.hubId}-${toHub.hubId}`,
          type: 'TRANSFER',
          severity: 'WARNING',
          message: `Intercity connection missing between ${fromHub.hubName} and ${toHub.hubName} (Day ${currentDay}).`,
          actionLabel: `Add ${fromHub.hubName} → ${toHub.hubName} Transfer`,
          actionType: 'ADD_TRANSFER',
          dayNumber: currentDay,
          hubName: toHub.hubName
        });
      }
      currentDay += (toHub.nights || 1);
    }
  }

  // 4. Check Sightseeing / Activities coverage
  const activityItems = items.filter(it => 
    !(it.product as any).isTransfer && 
    !(it.product as any).isVisa &&
    !(it.product.category || '').toLowerCase().includes('hotel') &&
    !(it.product.category || '').toLowerCase().includes('accommodation') &&
    !(it.product.category || '').toLowerCase().includes('insurance') &&
    !(it.product.category || '').toLowerCase().includes('esim')
  );

  if (activityItems.length === 0) {
    score -= 1.5;
    warnings.push({
      id: 'warn-no-activities',
      type: 'ACTIVITY',
      severity: 'WARNING',
      message: 'No curated sightseeing tours or local experiences have been added to this itinerary yet.',
      actionLabel: 'Explore Tours & Activities',
      actionType: 'ADD_ACTIVITY',
      dayNumber: 2
    });
  }

  // 5. Check Visa
  const visaItems = items.filter(it => (it.product as any).isVisa || (it.product.category || '').toLowerCase().includes('visa'));
  if (visaAssistanceChoice === 'YES' && visaItems.length === 0) {
    score -= 0.5;
    warnings.push({
      id: 'warn-visa-service-pending',
      type: 'VISA',
      severity: 'INFO',
      message: 'Client requested Visa Assistance, but no visa facilitation service is attached to the quote.',
      actionLabel: 'Add Visa Service',
      actionType: 'ADD_VISA'
    });
  }

  // 6. Value-Add Add-ons Check (Insurance & eSIM)
  if (!hasInsurance) {
    recommendations.push('Add comprehensive international travel insurance for maximum traveler protection.');
  }
  if (!hasEsim) {
    recommendations.push('Include instant regional 5G eSIM connectivity for seamless ground navigation.');
  }

  score = Math.max(1.0, Math.min(10.0, Number(score.toFixed(1))));

  let status: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'HIGH_RISK' = 'EXCELLENT';
  let statusLabel = 'Excellent & Operations-Ready';
  let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

  if (score >= 9.0) {
    status = 'EXCELLENT';
    statusLabel = 'Excellent & Operations-Ready';
    statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (score >= 7.5) {
    status = 'GOOD';
    statusLabel = 'Good Feasibility (Minor Ground Gaps)';
    statusColor = 'text-blue-700 bg-blue-50 border-blue-200';
  } else if (score >= 5.0) {
    status = 'NEEDS_ATTENTION';
    statusLabel = 'Needs Attention (Missing Key Ground Services)';
    statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
  } else {
    status = 'HIGH_RISK';
    statusLabel = 'High Operational Risk (Critical Logistics Missing)';
    statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
  }

  return {
    score,
    status,
    statusLabel,
    statusColor,
    warnings,
    recommendations
  };
}

/**
 * Creates a complete customer-facing content snapshot for any QuoteItem.
 * Ensures historical quote consistency across Saved Quotes, Emails, PDFs, and WhatsApp proposals.
 */
export function createQuoteItemContentSnapshot(
  product: Product,
  item: QuoteItem | any
): QuoteItemContentSnapshot {
  let overviewSpecifications = '';
  let inclusions: string[] = [];
  let exclusions: string[] = [];
  let sourceType = 'PRODUCT';
  const sourceId = product?.id || item?.productId || '';

  const cat = (product?.category || item?.category || '').toLowerCase();
  const isVisa = cat.includes('visa') || !!item?.visaSnapshot || (item?.service_type === 'VISA');
  const isHotel = cat.includes('hotel') || cat.includes('ryokan') || cat.includes('stay') || cat.includes('accommodation') || !!item?.accommodationType || !!item?.isManualHotel;
  const isRail = cat.includes('rail') || cat.includes('train') || !!item?.railJourneyDetails;
  
  // Resolve source type
  if (isVisa) {
    sourceType = 'VISA';
  } else if (isHotel) {
    sourceType = 'HOTEL';
  } else if (isRail) {
    sourceType = 'RAIL';
  } else if (
    cat.includes('insurance') || 
    cat.includes('protection') || 
    cat.includes('esim') || 
    cat.includes('connectivity') || 
    cat.includes('vip') || 
    cat.includes('ground') || 
    cat.includes('ancillary') ||
    item?.service_type === 'TRAVEL_PROTECTION' ||
    item?.service_type === 'CONNECTIVITY' ||
    item?.service_type === 'VIP_GROUND'
  ) {
    sourceType = 'ANCILLARY';
  } else {
    sourceType = 'PRODUCT';
  }

  // Compile Overview Specifications, Inclusions, and Exclusions
  if (isVisa) {
    overviewSpecifications = product?.longDescription || product?.description || product?.shortDescription || '';
    if (!overviewSpecifications) {
      overviewSpecifications = `Comprehensive visa services assistance and facilitation support for ${product?.destinationName || product?.country || 'Japan'}.`;
    }
    overviewSpecifications += `\n\n**Visa Service Details:**\n`;
    overviewSpecifications += `• **Service Name:** ${product?.name || 'Official E-Visa Assistance'}\n`;
    overviewSpecifications += `• **Destination:** ${product?.destinationName || product?.country || 'Japan'}\n`;
    if ((product as any)?.visaType) overviewSpecifications += `• **Visa Type:** ${(product as any)?.visaType}\n`;
    if (item?.visaSnapshot?.applicantNationality) {
      overviewSpecifications += `• **Nationality:** ${item.visaSnapshot.applicantNationality}\n`;
    }
    
    inclusions = product?.inclusions && product.inclusions.length > 0 
      ? product.inclusions 
      : ['Application dossier review & indexing', 'Official portal processing & submission coordination', 'Digital visa grant delivery & QR validation'];
    
    exclusions = product?.exclusions && product.exclusions.length > 0 
      ? product.exclusions 
      : ['Government Embassy Visa Fee (unless paid online)', 'Courier / physical document retrieval charges', 'Re-submission fees in case of client documentation errors'];

  } else if (isHotel) {
    if (item?.isManualHotel && item?.manualHotelDetails) {
      const mh = item.manualHotelDetails;
      overviewSpecifications = `**Bespoke Hotel Stay at ${mh.hotelName || 'Selected Premium Hotel'}**\n`;
      overviewSpecifications += `• **Location:** ${mh.cityHub || 'Japan'}\n`;
      overviewSpecifications += `• **Room Category:** ${mh.roomType || 'Standard Room'}\n`;
      overviewSpecifications += `• **Meal Arrangement:** ${mh.mealPlan || 'Breakfast Included'}\n`;
      overviewSpecifications += `• **Nights:** ${mh.nights || 1} Night(s)\n`;
      if (mh.specialRequests) {
        overviewSpecifications += `• **Special Instructions:** ${mh.specialRequests}\n`;
      }
      
      inclusions = [
        `${mh.nights || 1} Night(s) Stay in room type ${mh.roomType || 'Standard Room'}`,
        `Meal Plan: ${mh.mealPlan || 'Breakfast Included'}`,
        'All applicable local taxes, VAT, and service charges',
        'Direct 24/7 DMC concierge & support access'
      ];
      exclusions = [
        'Personal room service, telephone, minibar, and incidental bills',
        'Early check-in or late check-out charges unless pre-confirmed',
        'Tourism tax or city tourist bed fees payable locally at front desk'
      ];
    } else {
      overviewSpecifications = product?.longDescription || product?.description || product?.shortDescription || '';
      if (!overviewSpecifications) {
        overviewSpecifications = `Luxury accommodations and Japanese hospitality services at ${product?.name || 'Curated Hotel'}.`;
      }
      overviewSpecifications += `\n\n**Stay Details:**\n`;
      overviewSpecifications += `• **Hotel:** ${product?.name || 'Selected Property'}\n`;
      if ((product as any)?.starRating || (product as any)?.rating) overviewSpecifications += `• **Star Rating:** ${(product as any)?.starRating || (product as any)?.rating}★\n`;
      if ((product as any)?.cityName || product?.city) overviewSpecifications += `• **City:** ${(product as any)?.cityName || product?.city}\n`;
      if ((product as any)?.address) overviewSpecifications += `• **Address:** ${(product as any)?.address}\n`;
      if ((product as any)?.starRating) {
        overviewSpecifications += `• **Property Type:** ${(product as any).propertyType || 'Luxury Stay'}\n`;
      }
      
      inclusions = product?.inclusions && product.inclusions.length > 0 ? product.inclusions : [
        'Luxury Hotel overnight accommodation stay',
        'Hotel standard high-speed guest Wi-Fi',
        'Daily morning breakfast or specified room amenities'
      ];
      exclusions = product?.exclusions && product.exclusions.length > 0 ? product.exclusions : [
        'Personal room incidentals, minibar consumption, and phone charges',
        'Local city bed taxes or hot spring tax (onsen tax) paid locally'
      ];
    }

  } else if (isRail) {
    if (item?.railJourneyDetails) {
      const rd = item.railJourneyDetails;
      overviewSpecifications = `**Shinkansen High-Speed Bullet Train Itinerary**\n`;
      overviewSpecifications += `• **Journey Route:** ${rd.originStationName} (${rd.originStationCode}) ➔ ${rd.destinationStationName} (${rd.destinationStationCode})\n`;
      overviewSpecifications += `• **Service Class:** ${rd.carType} Class\n`;
      overviewSpecifications += `• **Seat Reservation:** ${rd.seatType}\n`;
      overviewSpecifications += `• **Shinkansen Group:** ${rd.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi Super Express' : 'Hikari/Kodama Super Express'}\n`;
      if (rd.trainName) overviewSpecifications += `• **Train Name / ID:** ${rd.trainName}\n`;
      if (rd.departureTime) overviewSpecifications += `• **Scheduled Departure:** ${rd.departureTime}\n`;
      if (rd.arrivalTime) overviewSpecifications += `• **Scheduled Arrival:** ${rd.arrivalTime}\n`;
      if (rd.seatPreference) overviewSpecifications += `• **Seat Preference:** ${rd.seatPreference}\n`;
      if (rd.pnrReference) overviewSpecifications += `• **SmartEX PNR:** ${rd.pnrReference}\n`;
      if (rd.hasOversizedBaggage) overviewSpecifications += `• **Baggage Category:** Oversized Baggage Area Included\n`;
      
      inclusions = [
        'Authoritative SmartEX high-speed train e-ticket issuance',
        `Guaranteed ${rd.carType} Class Seat Reservation`,
        'Oversized luggage area allocation (where selected)',
        'DMC digital ticket dispatch and platform guidance notes'
      ];
      exclusions = [
        'Onboard bento meals, drinks, and snacks',
        'Station porterage and terminal transfers',
        'Refund or modification fees once tickets are confirmed'
      ];
    } else {
      overviewSpecifications = product?.longDescription || product?.description || product?.shortDescription || '';
      if (!overviewSpecifications) {
        overviewSpecifications = `High-speed Shinkansen bullet train transit across the Japan golden route corridor.`;
      }
      
      inclusions = product?.inclusions && product.inclusions.length > 0 ? product.inclusions : [
        'Guaranteed seat reservations',
        'Bullet train ticketing & digital voucher'
      ];
      exclusions = product?.exclusions && product.exclusions.length > 0 ? product.exclusions : [
        'Onboard food and personal refreshments'
      ];
    }

  } else if (sourceType === 'ANCILLARY') {
    overviewSpecifications = product?.longDescription || product?.description || product?.shortDescription || '';
    if (!overviewSpecifications) {
      overviewSpecifications = `Bespoke ancillary travel support service: ${product?.name || 'Selected Ancillary Plan'}.`;
    }
    overviewSpecifications += `\n\n**Service Overview:**\n`;
    overviewSpecifications += `• **Service:** ${product?.name || 'Travel Add-on'}\n`;
    if (product?.category) overviewSpecifications += `• **Category:** ${product.category}\n`;
    if (product?.destinationName || product?.country) {
      overviewSpecifications += `• **Coverage/Destination:** ${product.destinationName || product.country}\n`;
    }
    
    inclusions = product?.inclusions && product.inclusions.length > 0 ? product.inclusions : [
      'Comprehensive customer assistance and setup support',
      'Authorized supplier coordination and tracking'
    ];
    exclusions = product?.exclusions && product.exclusions.length > 0 ? product.exclusions : [
      'Additional incidental fees outside the standard plan coverage',
      'Modifications or upgrades beyond the selected service plan'
    ];

  } else {
    // General Product (Private Tours, Day Trips, Activities)
    overviewSpecifications = product?.longDescription || product?.description || product?.shortDescription || '';
    if (!overviewSpecifications) {
      overviewSpecifications = `Bespoke curated travel experience: ${product?.name || 'Curated Activity'}.`;
    }
    
    overviewSpecifications += `\n\n**Experience Details:**\n`;
    overviewSpecifications += `• **Activity:** ${product?.name}\n`;
    if (product?.duration) overviewSpecifications += `• **Duration:** ${product.duration}\n`;
    if (product?.city || product?.location) overviewSpecifications += `• **Location:** ${product.city || product.location}\n`;
    if (product?.meetingPoint) overviewSpecifications += `• **Meeting Point:** ${product.meetingPoint}\n`;
    if (product?.pickupPoint || product?.pickupInformation) {
      overviewSpecifications += `• **Pickup Point:** ${product.pickupPoint || product.pickupInformation}\n`;
    }
    if (product?.dropoffPoint || product?.dropoffLocation) {
      overviewSpecifications += `• **Drop-off Point:** ${product.dropoffPoint || product.dropoffLocation}\n`;
    }
    if (product?.operatingHours) overviewSpecifications += `• **Timing:** ${product.operatingHours}\n`;
    
    inclusions = product?.inclusions && product.inclusions.length > 0 ? product.inclusions : [
      'Licensed English-speaking local expert guide',
      'All listed sight admissions & experience admissions',
      'Air-conditioned private chauffeur transport as detailed'
    ];
    exclusions = product?.exclusions && product.exclusions.length > 0 ? product.exclusions : [
      'Personal food, dining, and snacks unless listed',
      'Guide/driver gratuities and voluntary tips',
      'Souvenir costs and personal retail shopping'
    ];
  }

  // Handle sanitization/cleanup to ensure rich text formatting isn't lost
  const cleanSpecs = overviewSpecifications ? overviewSpecifications.trim() : '';

  return {
    overviewSpecifications: cleanSpecs,
    inclusions: Array.isArray(inclusions) ? inclusions.map(s => String(s).trim()) : [],
    exclusions: Array.isArray(exclusions) ? exclusions.map(s => String(s).trim()) : [],
    snapshotVersion: '1.0',
    sourceType,
    sourceId,
    capturedAt: new Date().toISOString()
  };
}
