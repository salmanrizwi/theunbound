import { Hotel, HotelRoomType, HotelRate, MealPlanCode, Product, CurrencyCode } from '../types';
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
  nights: number = 1
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
    markupPercent: 18,
    taxPercent: 10,
    feePercent: 2.5,
    currency: hotel.currency || 'USD',
    validityFrom: '2026-01-01',
    validityTo: '2026-12-31'
  };

  const mealLabel = selectedRate.mealPlanName || getMealPlanLabel(selectedRate.mealPlan);
  const roomTitle = selectedRoom ? selectedRoom.roomName : 'Luxury Suite';

  const basePrice = selectedRate.doubleNetRate || selectedRate.singleNetRate || hotel.startingNetPrice;
  const markup = selectedRate.markupPercent ?? 18;
  const tax = selectedRate.taxPercent ?? 10;
  const sellingStarting = basePrice * (1 + markup / 100) * (1 + tax / 100);

  return {
    id: `hotel-prod-${hotel.id}-${selectedRoom?.id || 'std'}`,
    sku: `${hotel.code}-${selectedRoom?.id?.substring(0, 4)?.toUpperCase() || 'STD'}`,
    destinationId: hotel.destinationId,
    destinationName: hotel.destinationName,
    destinationSlug: hotel.destinationId,
    country: hotel.country,
    city: hotel.cityName,
    productType: 'Hotel & Resort',
    name: `${hotel.name} - ${roomTitle}`,
    shortDescription: `${hotel.starRating}★ ${hotel.propertyType.replace('_', ' ')} in ${hotel.area}, ${hotel.cityName}. Includes ${mealLabel}.`,
    longDescription: `${hotel.description}\n\nRoom Details: ${selectedRoom?.description || ''}\nAmenities: ${hotel.amenities.join(', ')}`,
    supplierId: `sup-${hotel.code}`,
    supplierName: `${hotel.name} Corporate Reservations`,
    supplierProductCode: hotel.code,
    category: 'Hotels',
    subcategory: `${hotel.starRating}-Star Luxury Accommodation`,
    duration: `${nights} Night${nights > 1 ? 's' : ''} Stay`,
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    operatingHours: 'Check-in: 15:00 | Check-out: 12:00',
    adultNetPrice: basePrice,
    childNetPrice: selectedRate.childRate || Math.round(basePrice * 0.4),
    infantNetPrice: 0,
    currency: selectedRate.currency || hotel.currency || 'USD',
    defaultMarkupPercent: markup,
    b2bAgentMarkupPercent: markup,
    buyerMarkupPercent: markup + 5,
    taxPercent: tax,
    commissionPercent: 10,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: sellingStarting,
    season: 'All Year',
    validityFrom: selectedRate.validityFrom || '2026-01-01',
    validityTo: selectedRate.validityTo || '2026-12-31',
    minPax: 1,
    maxPax: selectedRoom?.maxOccupancy || 3,
    availability: 'INSTANT',
    bookingRequiredDays: 1,
    cancellationPolicy: selectedRoom?.cancellationPolicy || 'Free cancellation up to 7 days prior to check-in.',
    inclusions: [
      `${nights} Night${nights > 1 ? 's' : ''} Luxury Accommodation in ${roomTitle}`,
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
    images: hotel.images && hotel.images.length > 0 ? hotel.images : [hotel.heroImage],
    heroImage: hotel.heroImage,
    highlights: hotel.amenities.slice(0, 4),
    rating: hotel.starRating,
    reviewCount: 48,
    isFeatured: true,
    lastUpdated: hotel.updatedAt || '2026-08-20'
  };
}
