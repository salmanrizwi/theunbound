import { Hotel, HotelRoomType, HotelRate, MealPlanCode, Product, CurrencyCode, ManualHotelDetails } from '../types';
import { convertCurrency, formatCurrency } from '../services/pricingEngine';

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

  // Final Quoted Selling Price
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

  // Currency conversions to targetCurrency
  const hotelCurrency = rate.currency || hotel.currency || 'USD';
  const nightlyBaseNetRate = convertCurrency(baseNightlyRateInHotelCurr, hotelCurrency, targetCurrency);
  const nightlyExtraBedNetRate = convertCurrency(rate.extraBedRate || 0, hotelCurrency, targetCurrency);
  const nightlyChildNetRate = convertCurrency(rate.childRate || 0, hotelCurrency, targetCurrency);

  // Total Stay Net Cost
  const roomsTotalNetCost = nightlyBaseNetRate * nights * roomsCount;
  const extraBedsTotalNetCost = nightlyExtraBedNetRate * nights * extraBeds;
  const childrenTotalNetCost = nightlyChildNetRate * nights * children;
  const totalStayNetCost = roomsTotalNetCost + extraBedsTotalNetCost + childrenTotalNetCost;

  // Markups
  const b2bMarkupPercent = rate.markupPercent ?? 18;
  const b2bWholesaleMarkupRate = b2bMarkupPercent / 100;
  const b2bWholesaleNetToAgent = totalStayNetCost * (1 + b2bWholesaleMarkupRate);

  const agentClientMarkupRate = agentClientMarkupPercent / 100;
  const priceBeforeTaxWithAgent = b2bWholesaleNetToAgent * (1 + agentClientMarkupRate);
  const agentProfitAmount = priceBeforeTaxWithAgent - b2bWholesaleNetToAgent;

  // Taxes and Fees
  const taxRate = (rate.taxPercent ?? 10) / 100;
  const taxAmount = priceBeforeTaxWithAgent * taxRate;
  const serviceFee = convertCurrency(rate.feePercent ? (totalStayNetCost * (rate.feePercent / 100)) : 0, hotelCurrency, targetCurrency);

  // Discounts
  const discountRate = (customDiscountPercent || 0) / 100;
  const grossTotal = priceBeforeTaxWithAgent + taxAmount + serviceFee;
  const discountAmount = grossTotal * discountRate;

  // Final Quoted Selling Price
  const finalTotalSellingPrice = Math.max(0, grossTotal - discountAmount);
  const pricePerNightSelling = finalTotalSellingPrice / nights;
  const totalGuests = adults + children;
  const pricePerPersonSelling = totalGuests > 0 ? finalTotalSellingPrice / totalGuests : finalTotalSellingPrice;

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
  rate?: HotelRate,
  nights: number = 1,
  roomsCount: number = 1
): Product {
  const selectedRoom = roomType || hotel.roomTypes[0];
  const selectedRate = rate || selectedRoom?.rates[0] || {
    id: 'default-rate',
    mealPlan: 'BB' as MealPlanCode,
    mealPlanName: 'Bed & Breakfast Included',
    singleNetRate: hotel.startingNetPrice,
    doubleNetRate: hotel.startingNetPrice,
    tripleNetRate: hotel.startingNetPrice,
    extraBedRate: 0,
    childRate: 0,
    markupPercent: 0,
    taxPercent: 0,
    feePercent: 0,
    currency: hotel.currency || 'USD',
    validityFrom: '2026-01-01',
    validityTo: '2026-12-31'
  };

  const mealLabel = selectedRate.mealPlanName || getMealPlanLabel(selectedRate.mealPlan);
  const roomTitle = selectedRoom ? selectedRoom.roomName : 'Luxury Room';

  const basePrice = selectedRate.doubleNetRate || selectedRate.singleNetRate || hotel.startingNetPrice;
  const safeNights = Math.max(1, nights || 1);
  const safeRooms = Math.max(1, roomsCount || 1);
  const totalNetPrice = basePrice * safeNights * safeRooms;

  return {
    id: `hotel-prod-${hotel.id}-${selectedRoom?.id || 'std'}-${safeRooms}r-${safeNights}n`,
    sku: `${hotel.code}-${selectedRoom?.id?.substring(0, 4)?.toUpperCase() || 'STD'}`,
    destinationId: hotel.destinationId,
    destinationName: hotel.destinationName,
    country: hotel.country,
    city: hotel.cityName,
    productType: 'Hotel & Resort',
    name: `${hotel.name} - ${roomTitle} (${safeRooms} ${safeRooms > 1 ? 'Rooms' : 'Room'}, ${safeNights} ${safeNights > 1 ? 'Nights' : 'Night'})`,
    shortDescription: `${hotel.starRating}★ ${hotel.propertyType ? hotel.propertyType.replace('_', ' ') : 'Hotel'} in ${hotel.area}, ${hotel.cityName}. Includes ${mealLabel}.`,
    longDescription: `${hotel.description}\n\nRoom Details: ${selectedRoom?.description || ''}\nAmenities: ${(hotel.amenities || []).join(', ')}`,
    supplierId: `sup-${hotel.code}`,
    supplierName: `${hotel.name} Corporate Reservations`,
    supplierProductCode: hotel.code,
    category: 'Travel Services',
    subcategory: `${hotel.starRating}-Star Luxury Accommodation`,
    duration: `${safeNights} Night${safeNights > 1 ? 's' : ''} Stay (${safeRooms} Room${safeRooms > 1 ? 's' : ''})`,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    operatingHours: 'Check-in: 15:00 | Check-out: 12:00',
    adultNetPrice: totalNetPrice,
    childNetPrice: 0,
    infantNetPrice: 0,
    currency: selectedRate.currency || hotel.currency || 'USD',
    defaultMarkupPercent: 0,
    b2bAgentMarkupPercent: 0,
    buyerMarkupPercent: 0,
    taxPercent: 0,
    commissionPercent: 0,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: totalNetPrice,
    season: 'All Year',
    validityFrom: selectedRate.validityFrom || '2026-01-01',
    validityTo: selectedRate.validityTo || '2026-12-31',
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
    images: hotel.images && (hotel.images || []).length > 0 ? hotel.images : [hotel.heroImage],
    location: `${hotel.area}, ${hotel.cityName}, ${hotel.country}`,
    latitude: hotel.latitude || 0,
    longitude: hotel.longitude || 0,
    rating: hotel.starRating,
    reviewCount: 48,
    status: 'ACTIVE',
    lastUpdated: hotel.updatedAt || '2026-08-20'
  };
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

/**
 * Converts a quotation-level Manual Accommodation into a standardized Product object
 * STRICTLY for quotation calculation, itinerary rendering, proposal view, and PDF export.
 * 
 * CRITICAL DATABASE RULE:
 * This does NOT create a Hotel Master entry or modify the Hotel Management database.
 */
export function manualHotelToProduct(
  manual: ManualHotelDetails,
  destination?: { id?: string; name?: string }
): Product {
  const nights = Math.max(1, manual.numberOfNights || 1);
  const rooms = Math.max(1, manual.numberOfRooms || 1);
  const rate = Math.max(0, manual.ratePerNight || 0);

  // Total Stay Net calculation based on rateType
  let totalNetCost = rate * rooms * nights;
  if (manual.rateType === 'TOTAL_STAY') {
    totalNetCost = rate;
  } else if (manual.rateType === 'PER_PERSON_PER_NIGHT') {
    const adultRate = manual.adultRate || rate;
    const childRate = manual.childRate || 0;
    totalNetCost = (adultRate * (manual.numberOfRooms * 2) + childRate) * nights;
  }

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
    name: `${manual.hotelName} - ${manual.roomType} (${rooms} ${rooms > 1 ? 'Rooms' : 'Room'}, ${nights} ${nights > 1 ? 'Nights' : 'Night'})`,
    shortDescription: `${starLabel} in ${manual.city}. ${rooms} ${rooms > 1 ? 'Rooms' : 'Room'}, ${nights} ${nights > 1 ? 'Nights' : 'Night'}. Includes ${mealLabel}.`,
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
    currency: manual.rateCurrency || 'USD',
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
  };
}
