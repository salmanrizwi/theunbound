import { Hotel, HotelRoomType, HotelRate, MealPlanCode, Product, CurrencyCode, ManualHotelDetails, InventorySurcharge, AppliedSurchargeDetail, InventoryValidityEvaluation } from '../types';
import { convertCurrency, formatCurrency, evaluateInventoryValidity, evaluateApplicableSurcharges } from '../services/pricingEngine';
import { canonicalImageService } from '../services/imageService';

export function collectHotelSurcharges(
  hotel?: Hotel,
  roomType?: HotelRoomType,
  rate?: HotelRate
): InventorySurcharge[] {
  const nativeCurr = rate?.currency || hotel?.currency || 'USD';
  const combined: InventorySurcharge[] = [
    ...(hotel?.surcharges || []),
    ...(roomType?.surcharges || []),
    ...(rate?.surcharges || [])
  ];
  const seen = new Set<string>();
  const deduplicated: InventorySurcharge[] = [];
  for (const s of combined) {
    if (!s || !s.surchargeId || seen.has(s.surchargeId)) continue;
    seen.add(s.surchargeId);
    deduplicated.push({
      ...s,
      currency: (s.currency || nativeCurr) as CurrencyCode,
      applicationBasis: s.applicationBasis || 'PER_ROOM_NIGHT'
    });
  }
  return deduplicated;
}

export interface HotelStayCalculationParams {
  hotel: Hotel;
  roomType: HotelRoomType;
  rate: HotelRate;
  checkInDate: string;
  checkOutDate?: string;
  nights: number;
  roomsCount: number;
  adults: number;
  children: number;
  extraBeds: number;
  targetCurrency: CurrencyCode;
  agentClientMarkupPercent?: number;
  customDiscountPercent?: number;
}

export interface HotelStayCalculationResult {
  hotelId: string;
  hotelName: string;
  roomTypeId: string;
  roomName: string;
  mealPlan: MealPlanCode;
  mealPlanName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  roomsCount: number;
  adults: number;
  children: number;
  extraBeds: number;
  currency: CurrencyCode;

  // Nightly base rates
  nightlyBaseNetRate: number; // in targetCurrency
  nightlyExtraBedNetRate: number;
  nightlyChildNetRate: number;

  // Total Stay Net Costs
  roomsTotalNetCost: number;
  extraBedsTotalNetCost: number;
  childrenTotalNetCost: number;
  totalStayNetCost: number; // Total DMC Supplier Cost

  // B2B Wholesale Calculations
  b2bWholesaleMarkupRate: number; // e.g. 0.18 for 18%
  b2bWholesaleNetToAgent: number;
  agentClientMarkupRate: number;
  agentProfitAmount: number;

  // Commercials & Taxes
  taxRate: number;
  taxAmount: number;
  serviceFee: number;
  discountRate: number;
  discountAmount: number;

  // Validity & Surcharges
  validityCheck?: InventoryValidityEvaluation;
  appliedSurcharges?: AppliedSurchargeDetail[];
  surchargeTotalNative?: number;
  surchargeTotal?: number;
  baseSellingPriceBeforeSurcharges?: number;

  // Final Quoted Selling Price
  price: number;
  finalTotalSellingPrice: number;
  pricePerNightSelling: number;
  pricePerPersonSelling: number;
}

/**
 * Calculates the exact stay price for a hotel room configuration
 */
export function calculateHotelStayPrice(params: HotelStayCalculationParams): HotelStayCalculationResult {
  const {
    hotel,
    roomType,
    rate,
    checkInDate,
    nights: rawNights,
    roomsCount: rawRooms,
    adults: rawAdults,
    children: rawChildren,
    extraBeds: rawExtraBeds,
    targetCurrency,
    agentClientMarkupPercent = 12,
    customDiscountPercent = 0
  } = params;

  const nights = Math.max(1, rawNights || 1);
  const roomsCount = Math.max(1, rawRooms || 1);
  const adults = Math.max(1, rawAdults || 1);
  const children = Math.max(0, rawChildren || 0);
  const extraBeds = Math.max(0, rawExtraBeds || 0);

  // Compute checkOutDate if not provided
  let checkOutDate = params.checkOutDate;
  if (!checkOutDate) {
    const d = new Date(checkInDate || Date.now());
    d.setDate(d.getDate() + nights);
    checkOutDate = d.toISOString().split('T')[0];
  }

  // Determine base nightly net rate based on occupancy per room
  // (e.g. single pax = singleNetRate, 2 pax = doubleNetRate, 3+ pax = tripleNetRate)
  const paxPerRoom = Math.ceil(adults / roomsCount);
  let baseNightlyRateInHotelCurr = rate.doubleNetRate;
  if (paxPerRoom === 1 && rate.singleNetRate > 0) {
    baseNightlyRateInHotelCurr = rate.singleNetRate;
  } else if (paxPerRoom >= 3 && rate.tripleNetRate > 0) {
    baseNightlyRateInHotelCurr = rate.tripleNetRate;
  } else {
    baseNightlyRateInHotelCurr = rate.doubleNetRate || rate.singleNetRate || hotel.startingNetPrice;
  }

  // Native Currency Calculation First -> Surcharge Evaluation -> Currency Conversion
  const hotelCurrency: CurrencyCode = (rate.currency || hotel.currency || 'USD') as CurrencyCode;
  const nativeRoomsNetCost = baseNightlyRateInHotelCurr * nights * roomsCount;
  const nativeExtraBedsNetCost = (rate.extraBedRate || 0) * nights * extraBeds;
  const nativeChildrenNetCost = (rate.childRate || 0) * nights * children;
  const nativeTotalStayNetCost = nativeRoomsNetCost + nativeExtraBedsNetCost + nativeChildrenNetCost;

  // Universal B2B Pricing Formula in Native Currency:
  const b2bMarkupPercent = rate.markupPercent ?? 20;
  const b2bWholesaleMarkupRate = b2bMarkupPercent / 100;
  const nativeMarginAmount = nativeTotalStayNetCost * b2bWholesaleMarkupRate;

  const taxRate = (rate.taxPercent ?? 10) / 100;
  const nativeTaxAmount = nativeMarginAmount * taxRate;

  const nativeSubtotal = nativeTotalStayNetCost + nativeMarginAmount + nativeTaxAmount;

  const serviceFeeRate = (rate.feePercent ?? 0) / 100;
  const nativeServiceFee = nativeSubtotal * serviceFeeRate;

  const discountRate = (customDiscountPercent || 0) / 100;
  const nativeGrossTotal = nativeSubtotal + nativeServiceFee;
  const nativeDiscountAmount = nativeGrossTotal * discountRate;
  const nativeBaseSellingBeforeSurcharges = Math.max(0, nativeGrossTotal - nativeDiscountAmount);

  // Validity & Surcharge Evaluation in Native Currency
  const effectiveValidFrom = rate.validity?.validFrom || rate.validityFrom || roomType?.validity?.validFrom || roomType?.validityFrom || hotel.validity?.validFrom || hotel.validityFrom || '';
  const effectiveValidTo = rate.validity?.validTo || rate.validityTo || roomType?.validity?.validTo || roomType?.validityTo || hotel.validity?.validTo || hotel.validityTo || '';
  const validityCheck = evaluateInventoryValidity(
    { validity: { validFrom: effectiveValidFrom, validTo: effectiveValidTo } },
    checkInDate
  );

  const combinedSurcharges = collectHotelSurcharges(hotel, roomType, rate);
  const surchargeEval = evaluateApplicableSurcharges({
    surcharges: combinedSurcharges,
    serviceDate: checkInDate,
    nights,
    baseNativeAmount: nativeBaseSellingBeforeSurcharges,
    nativeCurrency: hotelCurrency,
    targetCurrency,
    adults,
    children,
    roomsCount,
    quantity: 1,
    defaultApplicationBasis: 'PER_ROOM_NIGHT'
  });

  const nativeFinalSellingPrice = Math.max(0, nativeBaseSellingBeforeSurcharges + surchargeEval.totalSurchargeNative);

  // Currency conversions to targetCurrency
  const nightlyBaseNetRate = convertCurrency(baseNightlyRateInHotelCurr, hotelCurrency, targetCurrency);
  const nightlyExtraBedNetRate = convertCurrency(rate.extraBedRate || 0, hotelCurrency, targetCurrency);
  const nightlyChildNetRate = convertCurrency(rate.childRate || 0, hotelCurrency, targetCurrency);

  const roomsTotalNetCost = convertCurrency(nativeRoomsNetCost, hotelCurrency, targetCurrency);
  const extraBedsTotalNetCost = convertCurrency(nativeExtraBedsNetCost, hotelCurrency, targetCurrency);
  const childrenTotalNetCost = convertCurrency(nativeChildrenNetCost, hotelCurrency, targetCurrency);
  const totalStayNetCost = convertCurrency(nativeTotalStayNetCost, hotelCurrency, targetCurrency);

  const taxAmount = convertCurrency(nativeTaxAmount, hotelCurrency, targetCurrency);
  const serviceFee = convertCurrency(nativeServiceFee, hotelCurrency, targetCurrency);
  const discountAmount = convertCurrency(nativeDiscountAmount, hotelCurrency, targetCurrency);
  const baseSellingPriceBeforeSurcharges = convertCurrency(nativeBaseSellingBeforeSurcharges, hotelCurrency, targetCurrency);

  // Final Quoted Price
  const finalTotalSellingPrice = convertCurrency(nativeFinalSellingPrice, hotelCurrency, targetCurrency);
  const pricePerNightSelling = finalTotalSellingPrice / nights;
  const totalGuests = adults + children;
  const pricePerPersonSelling = totalGuests > 0 ? finalTotalSellingPrice / totalGuests : finalTotalSellingPrice;

  const b2bWholesaleNetToAgent = finalTotalSellingPrice;
  const agentClientMarkupRate = (agentClientMarkupPercent || 0) / 100;
  const agentProfitAmount = 0;

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    roomTypeId: roomType.id,
    roomName: roomType.roomName,
    mealPlan: rate.mealPlan,
    mealPlanName: rate.mealPlanName || getMealPlanLabel(rate.mealPlan),
    checkInDate,
    checkOutDate,
    nights,
    roomsCount,
    adults,
    children,
    extraBeds,
    currency: targetCurrency,

    nightlyBaseNetRate,
    nightlyExtraBedNetRate,
    nightlyChildNetRate,

    roomsTotalNetCost,
    extraBedsTotalNetCost,
    childrenTotalNetCost,
    totalStayNetCost,

    b2bWholesaleMarkupRate,
    b2bWholesaleNetToAgent,
    agentClientMarkupRate,
    agentProfitAmount,

    taxRate,
    taxAmount,
    serviceFee,
    discountRate,
    discountAmount,

    validityCheck,
    appliedSurcharges: surchargeEval.appliedSurcharges,
    surchargeTotalNative: surchargeEval.totalSurchargeNative,
    surchargeTotal: surchargeEval.totalSurchargeConverted,
    baseSellingPriceBeforeSurcharges,

    price: finalTotalSellingPrice,
    finalTotalSellingPrice,
    pricePerNightSelling,
    pricePerPersonSelling
  };
}

export function getMealPlanLabel(code: MealPlanCode): string {
  switch (code) {
    case 'RO':
      return 'Room Only (No Meals)';
    case 'BB':
      return 'Bed & Breakfast Included';
    case 'HB':
      return 'Half Board (Breakfast & Dinner)';
    case 'FB':
      return 'Full Board (All Meals)';
    case 'AI':
      return 'All Inclusive Luxury';
    default:
      return 'Breakfast Included';
  }
}

/**
 * Converts a Hotel + Room Type + Rate into a standardized Product object
 * so it can be handled seamlessly across all quotation and booking flows.
 */
export function hotelToProduct(
  hotel: Hotel,
  roomType?: HotelRoomType,
  rateOrRoomsCount?: HotelRate | number,
  nightsOrRooms?: number,
  roomsCountArg?: number
): Product {
  const selectedRoom = roomType || hotel.roomTypes?.[0];
  let selectedRate: HotelRate;
  let safeRooms = 1;
  let safeNights = 1;

  if (typeof rateOrRoomsCount === 'number') {
    safeRooms = Math.max(1, rateOrRoomsCount);
    safeNights = Math.max(1, nightsOrRooms || 1);
    const roomFallbackRate = (selectedRoom as any)?.baseRatePerNight || (selectedRoom as any)?.ratePerNight || (selectedRoom as any)?.startingNetPrice || hotel.startingNetPrice || 0;
    selectedRate = (selectedRoom?.rates && selectedRoom.rates[0]) || {
      id: 'default-rate',
      mealPlan: (selectedRoom?.mealPlan as MealPlanCode) || 'BB',
      mealPlanName: 'Bed & Breakfast Included',
      singleNetRate: roomFallbackRate,
      doubleNetRate: roomFallbackRate,
      tripleNetRate: roomFallbackRate,
      extraBedRate: (selectedRoom as any)?.extraAdultRate || 0,
      childRate: (selectedRoom as any)?.childWithBedRate || 0,
      markupPercent: 0,
      taxPercent: 0,
      feePercent: 0,
      currency: (selectedRoom as any)?.currency || hotel.currency || 'USD',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31'
    };
  } else {
    safeNights = Math.max(1, nightsOrRooms || 1);
    safeRooms = Math.max(1, roomsCountArg || 1);
    const roomFallbackRate = (selectedRoom as any)?.baseRatePerNight || (selectedRoom as any)?.ratePerNight || (selectedRoom as any)?.startingNetPrice || hotel.startingNetPrice || 0;
    selectedRate = rateOrRoomsCount || (selectedRoom?.rates && selectedRoom.rates[0]) || {
      id: 'default-rate',
      mealPlan: (selectedRoom?.mealPlan as MealPlanCode) || 'BB',
      mealPlanName: 'Bed & Breakfast Included',
      singleNetRate: roomFallbackRate,
      doubleNetRate: roomFallbackRate,
      tripleNetRate: roomFallbackRate,
      extraBedRate: (selectedRoom as any)?.extraAdultRate || 0,
      childRate: (selectedRoom as any)?.childWithBedRate || 0,
      markupPercent: 0,
      taxPercent: 0,
      feePercent: 0,
      currency: (selectedRoom as any)?.currency || hotel.currency || 'USD',
      validityFrom: '2026-01-01',
      validityTo: '2026-12-31'
    };
  }

  const mealLabel = selectedRate.mealPlanName || (selectedRoom?.mealPlan ? String(selectedRoom.mealPlan) : getMealPlanLabel(selectedRate.mealPlan));
  const roomTitle = selectedRoom ? selectedRoom.roomName : 'Luxury Room';

  const basePrice = selectedRate.doubleNetRate || selectedRate.singleNetRate || (selectedRoom as any)?.baseRatePerNight || (selectedRoom as any)?.ratePerNight || hotel.startingNetPrice || 0;
  const safeEffectiveNights = safeNights;
  const safeEffectiveRooms = safeRooms;
  const totalNetPrice = basePrice * safeEffectiveNights * safeEffectiveRooms;
  const hotelCurr = (selectedRoom as any)?.currency || selectedRate.currency || hotel.currency || 'USD';

  const canonicalHotelName = (hotel as any).listingName || hotel.name;
  const resolvedHeroImage = canonicalImageService.resolveHotelImage(hotel);
  const resolvedGallery = canonicalImageService.resolveHotelGallery(hotel);

  const effectiveValidFrom =
    selectedRate.validity?.validFrom ||
    selectedRate.validityFrom ||
    selectedRoom?.validity?.validFrom ||
    selectedRoom?.validityFrom ||
    hotel.validity?.validFrom ||
    hotel.validityFrom ||
    '2026-01-01';
  const effectiveValidTo =
    selectedRate.validity?.validTo ||
    selectedRate.validityTo ||
    selectedRoom?.validity?.validTo ||
    selectedRoom?.validityTo ||
    hotel.validity?.validTo ||
    hotel.validityTo ||
    '2026-12-31';
  const combinedSurcharges = collectHotelSurcharges(hotel, selectedRoom, selectedRate);

  return {
    id: `hotel-prod-${hotel.id}-${selectedRoom?.id || 'std'}-${safeEffectiveRooms}r-${safeEffectiveNights}n`,
    sku: `${hotel.code || 'HTL'}-${selectedRoom?.id?.substring(0, 4)?.toUpperCase() || 'STD'}`,
    destinationId: hotel.destinationId,
    destinationName: hotel.destinationName,
    country: hotel.country,
    city: hotel.cityName || hotel.city,
    productType: 'Hotel & Resort',
    listingName: canonicalHotelName,
    name: canonicalHotelName,
    roomType: roomTitle,
    mealPlan: mealLabel,
    roomsCount: safeEffectiveRooms,
    nights: safeEffectiveNights,
    shortDescription: `${roomTitle} • ${mealLabel} • ${safeEffectiveRooms} ${safeEffectiveRooms > 1 ? 'Rooms' : 'Room'}, ${safeEffectiveNights} ${safeEffectiveNights > 1 ? 'Nights' : 'Night'}`,
    longDescription: `${hotel.description}\n\nRoom Details: ${selectedRoom?.description || ''}\nAmenities: ${(hotel.amenities || []).join(', ')}`,
    supplierId: `sup-${hotel.code || hotel.id}`,
    supplierName: `${hotel.name} Corporate Reservations`,
    supplierProductCode: hotel.code || hotel.id,
    category: 'Hotels & Accommodation',
    subcategory: `${hotel.starRating || 5}-Star Luxury Accommodation`,
    duration: `${safeEffectiveNights} Night${safeEffectiveNights > 1 ? 's' : ''} Stay (${safeEffectiveRooms} Room${safeEffectiveRooms > 1 ? 's' : ''})`,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    operatingHours: 'Check-in: 15:00 | Check-out: 12:00',
    adultNetPrice: totalNetPrice,
    adultNettCost: totalNetPrice,
    basePrice: totalNetPrice,
    childNetPrice: 0,
    infantNetPrice: 0,
    currency: hotelCurr,
    defaultMarkupPercent: 0,
    b2bAgentMarkupPercent: 0,
    buyerMarkupPercent: 0,
    taxPercent: 0,
    commissionPercent: 0,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: totalNetPrice,
    season: 'All Year',
    validityFrom: effectiveValidFrom,
    validityTo: effectiveValidTo,
    validity: {
      validFrom: effectiveValidFrom,
      validTo: effectiveValidTo
    },
    surcharges: combinedSurcharges,
    minPax: 1,
    maxPax: (selectedRoom?.maxOccupancy || 2) * safeRooms,
    availability: 'INSTANT',
    bookingRequiredDays: 1,
    cancellationPolicy: selectedRoom?.cancellationPolicy || 'Free cancellation up to 7 days prior to check-in.',
    inclusions: [
      `${safeNights} Night${safeNights > 1 ? 's' : ''} Luxury Accommodation in ${safeRooms}x ${roomTitle}`,
      mealLabel,
      ...(hotel.amenities.slice(0, 3)),
      'Direct Concierge Access & Luggage Handling'
    ],
    exclusions: [
      'Personal incidental expenses & minibar consumption',
      'City tourism taxes where payable locally',
      'Early check-in / late check-out unless pre-confirmed'
    ],
    importantInformation: [
      `Check-in from 15:00, check-out until 12:00.`,
      `Passport ID verification required upon arrival.`,
      selectedRoom?.childPolicy || 'Children stay complimentary under 6 years.'
    ],
    meetingPoint: `${hotel.name} Reception Lobby (${hotel.address})`,
    pickupInformation: 'Direct hotel check-in desk.',
    heroImage: resolvedHeroImage,
    galleryImages: resolvedGallery,
    images: resolvedGallery.length > 0 ? resolvedGallery : [resolvedHeroImage],
    location: `${hotel.area}, ${hotel.cityName}, ${hotel.country}`,
    latitude: hotel.latitude || 0,
    longitude: hotel.longitude || 0,
    rating: hotel.starRating,
    reviewCount: 48,
    status: 'ACTIVE',
    lastUpdated: hotel.updatedAt || '2026-08-20'
  } as unknown as Product;
}

export interface OccupancyValidationResult {
  isValid: boolean;
  errors: string[];
  maxAllowedAdults: number;
  maxAllowedChildren: number;
  maxAllowedInfants: number;
  maxAllowedTotalPax: number;
  recommendedRoomsCount: number;
  perRoomAdults: number;
  perRoomChildren: number;
  perRoomInfants: number;
  perRoomTotalPax: number;
}

/**
 * Cross-checks passenger count (adults, children, infants) against hotel room occupancy limits
 */
export function validateRoomOccupancy(
  room: HotelRoomType | undefined,
  roomsCount: number = 1,
  adults: number = 2,
  children: number = 0,
  infants: number = 0
): OccupancyValidationResult {
  const safeRooms = Math.max(1, roomsCount || 1);
  const perRoomAdults = room?.maxAdults ?? 2;
  const perRoomChildren = room?.maxChildren !== undefined ? room.maxChildren : 2;
  const perRoomInfants = room?.maxInfants !== undefined ? room.maxInfants : 1;
  const perRoomTotalPax = room?.maxOccupancy || (perRoomAdults + perRoomChildren) || 3;

  const maxAllowedAdults = perRoomAdults * safeRooms;
  const maxAllowedChildren = perRoomChildren * safeRooms;
  const maxAllowedInfants = perRoomInfants * safeRooms;
  const maxAllowedTotalPax = perRoomTotalPax * safeRooms;

  const errors: string[] = [];

  if (adults > maxAllowedAdults) {
    errors.push(
      `Adult capacity exceeded: ${adults} Adults require at least ${Math.ceil(adults / perRoomAdults)} rooms (selected ${safeRooms} ${safeRooms > 1 ? 'rooms allow' : 'room allows'} max ${maxAllowedAdults} adults, ${perRoomAdults}/room).`
    );
  }

  if (children > maxAllowedChildren) {
    errors.push(
      `Child capacity exceeded: ${children} Children exceed the maximum allowance of ${maxAllowedChildren} children (${perRoomChildren} children/room for ${safeRooms} ${safeRooms > 1 ? 'rooms' : 'room'}).`
    );
  }

  if (infants > maxAllowedInfants) {
    errors.push(
      `Infant capacity exceeded: ${infants} Infants exceed the maximum limit of ${maxAllowedInfants} infants (${perRoomInfants} infant/room for ${safeRooms} ${safeRooms > 1 ? 'rooms' : 'room'}).`
    );
  }

  const totalGuests = adults + children;
  if (totalGuests > maxAllowedTotalPax) {
    errors.push(
      `Total occupancy exceeded: ${totalGuests} guests (${adults} adults + ${children} children) exceed maximum capacity of ${maxAllowedTotalPax} guests (${perRoomTotalPax} max guests/room for ${safeRooms} ${safeRooms > 1 ? 'rooms' : 'room'}).`
    );
  }

  // Calculate recommended rooms needed to fit all passengers safely
  const roomsForAdults = Math.ceil(adults / Math.max(1, perRoomAdults));
  const roomsForChildren = children > 0 ? Math.ceil(children / Math.max(1, perRoomChildren)) : 1;
  const roomsForInfants = infants > 0 ? Math.ceil(infants / Math.max(1, perRoomInfants)) : 1;
  const roomsForTotalPax = Math.ceil(totalGuests / Math.max(1, perRoomTotalPax));

  const recommendedRoomsCount = Math.max(1, roomsForAdults, roomsForChildren, roomsForInfants, roomsForTotalPax);

  return {
    isValid: errors.length === 0,
    errors,
    maxAllowedAdults,
    maxAllowedChildren,
    maxAllowedInfants,
    maxAllowedTotalPax,
    recommendedRoomsCount,
    perRoomAdults,
    perRoomChildren,
    perRoomInfants,
    perRoomTotalPax
  };
}

export function isManualHotelPricingComplete(manual?: ManualHotelDetails | null): boolean {
  if (!manual) return false;
  if (!manual.hotelName || !manual.hotelName.trim()) return false;
  const nights = Number(manual.numberOfNights ?? manual.nights ?? 0);
  const rooms = Number(manual.numberOfRooms ?? manual.roomsCount ?? 0);
  if (isNaN(nights) || nights < 1 || isNaN(rooms) || rooms < 1) return false;
  const rateBasis = manual.rateBasis || manual.rateType || 'PER_ROOM_PER_NIGHT';
  if (rateBasis === 'PER_PERSON_PER_NIGHT' || rateBasis === 'PER_PERSON') {
    const adultRate = Number(manual.adultRate ?? manual.ratePerNight ?? 0);
    return !isNaN(adultRate) && adultRate > 0;
  }
  const rate = Number(manual.ratePerNight ?? manual.sellingPrice ?? manual.netCost ?? manual.totalSellingPrice ?? 0);
  return !isNaN(rate) && rate > 0;
}

/**
 * Converts a quotation-level Manual Accommodation into a standardized Product object
 * STRICTLY for quotation calculation, itinerary rendering, proposal view, and PDF export.
 * 
 * CRITICAL DATABASE RULE:
 * This does NOT create a Hotel Master entry or modify the Hotel Management database.
 */
export function manualHotelToProduct(
  manual: ManualHotelDetails,
  destination?: { id?: string; name?: string },
  pax?: { adults?: number; children?: number; infants?: number }
): Product {
  const nights = Math.max(1, Number(manual.numberOfNights ?? manual.nights ?? 1));
  const rooms = Math.max(1, Number(manual.numberOfRooms ?? manual.roomsCount ?? 1));
  const rateBasis = manual.rateBasis || manual.rateType || 'PER_ROOM_PER_NIGHT';
  const rawRate = Number(manual.ratePerNight ?? manual.sellingPrice ?? manual.netCost ?? 0);
  const rate = isNaN(rawRate) ? 0 : Math.max(0, rawRate);

  // Total Stay Net calculation based on rateType / rateBasis
  let totalNetCost = 0;
  if (isManualHotelPricingComplete(manual)) {
    if (rateBasis === 'TOTAL_STAY' || (rateBasis as string) === 'TOTAL' || (rateBasis as string) === 'TOTAL_PACKAGE') {
      totalNetCost = rate;
    } else if (rateBasis === 'PER_ROOM_TOTAL_STAY') {
      totalNetCost = rate * rooms;
    } else if (rateBasis === 'PER_NIGHT' || rateBasis === 'PER_ROOM_PER_NIGHT') {
      totalNetCost = rate * rooms * nights;
    } else if ((rateBasis as string) === 'PER_PERSON_TOTAL_STAY') {
      const adultsCount = pax?.adults ?? (manual as any).adultsCount ?? (rooms * 2);
      totalNetCost = rate * adultsCount;
    } else if (rateBasis === 'PER_PERSON_PER_NIGHT' || rateBasis === 'PER_PERSON') {
      const adultRate = Number(manual.adultRate ?? rate) || 0;
      const childRate = Number(manual.childRate ?? 0) || 0;
      const adultsCount = pax?.adults ?? (manual as any).adultsCount ?? (rooms * 2);
      const childrenCount = pax?.children ?? (manual as any).childrenCount ?? 0;
      totalNetCost = (adultRate * adultsCount + childRate * childrenCount) * nights;
    } else {
      // PER_ROOM_PER_NIGHT
      totalNetCost = rate * rooms * nights;
    }
  }

  const nativeCurrency = (manual.rateCurrency || manual.currency || 'USD') as CurrencyCode;

  const mealLabel = manual.mealPlanName || (typeof manual.mealPlan === 'string' && manual.mealPlan.length > 2 ? manual.mealPlan : getMealPlanLabel(manual.mealPlan as MealPlanCode));
  const starLabel = manual.starRating || 'Bespoke Accommodation';
  const cleanId = manual.id || `manual-hotel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return {
    id: cleanId,
    sku: `MAN-HTL-${(manual.city || 'QUO').substring(0, 3).toUpperCase()}`,
    destinationId: destination?.id || 'dest-custom',
    destinationName: destination?.name || manual.city || 'Custom Destination',
    hubId: manual.hubId,
    country: destination?.name || 'Local Destination',
    city: manual.city || 'City Center',
    productType: 'Hotel & Resort',
    listingName: manual.hotelName,
    name: manual.hotelName,
    roomType: manual.roomType,
    mealPlan: mealLabel,
    roomsCount: rooms,
    nights: nights,
    shortDescription: `${manual.roomType} • ${mealLabel} • ${rooms} ${rooms > 1 ? 'Rooms' : 'Room'}, ${nights} ${nights > 1 ? 'Nights' : 'Night'}`,
    longDescription: `Quotation-level manual accommodation booking at ${manual.hotelName}.\n\nRoom Type: ${manual.roomType}\nMeal Plan: ${mealLabel}\nCheck-in: ${manual.checkInDate} | Check-out: ${manual.checkOutDate}\nLocation/Address: ${manual.address || manual.city}`,
    supplierId: 'sup-manual-quote-entry',
    supplierName: manual.supplierContact || `${manual.hotelName} (Direct Quotation)`,
    supplierProductCode: 'MANUAL_QUOTATION_RATE',
    category: 'Travel Services',
    subcategory: `${starLabel}`,
    duration: `${nights} Night${nights > 1 ? 's' : ''} Stay (${rooms} Room${rooms > 1 ? 's' : ''})`,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    operatingHours: 'Check-in: 15:00 | Check-out: 11:00',
    adultNetPrice: totalNetCost,
    childNetPrice: 0,
    infantNetPrice: 0,
    basePrice: totalNetCost,
    priceType: 'PER_GROUP',
    currency: nativeCurrency,
    defaultMarkupPercent: 0,
    b2bAgentMarkupPercent: 0,
    buyerMarkupPercent: 0,
    taxPercent: 0,
    commissionPercent: 0,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: totalNetCost,
    season: 'All Year',
    validityFrom: manual.checkInDate || '2026-01-01',
    validityTo: manual.checkOutDate || '2026-12-31',
    minPax: 1,
    maxPax: rooms * 4,
    availability: 'INSTANT',
    bookingRequiredDays: 0,
    cancellationPolicy: 'Quotation-specific accommodation terms as agreed with supplier.',
    inclusions: [
      `${nights} Night${nights > 1 ? 's' : ''} Stay in ${rooms}x ${manual.roomType}`,
      mealLabel,
      'Direct Concierge Access & Hotel Services'
    ],
    exclusions: [
      'Personal incidental expenses & minibar consumption',
      'City tourism taxes where payable locally',
      'Early check-in / late check-out unless pre-arranged'
    ],
    importantInformation: [
      `Check-in date: ${manual.checkInDate}, Check-out date: ${manual.checkOutDate}`,
      `Hotel: ${manual.hotelName} (${manual.address || manual.city})`,
      'Valid identification required upon arrival.'
    ],
    meetingPoint: `${manual.hotelName} Reception Desk (${manual.address || manual.city})`,
    pickupInformation: 'Direct hotel check-in desk.',
    images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'],
    location: manual.address || `${manual.city}, Destination`,
    latitude: 35.6762,
    longitude: 139.6503,
    rating: 5,
    reviewCount: 1,
    status: 'ACTIVE',
    lastUpdated: new Date().toISOString(),
    accommodationType: 'manual',
    isManualHotel: true,
    manualHotelDetails: manual
  } as unknown as Product;
}
