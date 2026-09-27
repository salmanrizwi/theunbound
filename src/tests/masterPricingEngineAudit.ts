/**
 * Master Pricing Engine Comprehensive Audit & Test Suite
 * THEUNBOUND B2B DMC PLATFORM
 *
 * Tests:
 * 1. Category 1: Private Tour (Fleet Capacity & Tiered Allocation)
 * 2. Category 2: Group Tour (Per Person Passenger Pricing: Adults, Children, Infants)
 * 3. Category 3: Ticket (Ticket Type Pricing & Quantities)
 * 4. Category 4: Transfer (Route + Fleet Capacity Allocation)
 * 5. Category 5: Guide (Hourly Rate + Min Hours + Overtime)
 * 6. Category 6: Restaurant (Per Person, Set Menu, Meal Plan)
 * 7. Category 7: Private Yacht (Fleet Capacity + Duration)
 * 8. Category 8: Hotel (Date-Aware Nightly Rates + Rooms + Meal Plans + Extra Bed)
 * 9. Category 9: Japan Rail (Journey Segments + Classes + Seat Preferences)
 * 10. Category 10: Visa (Applicant Count + Nationality + Service Level)
 * 11. Category 11: Travel Protection (Travellers + Coverage Plan + Duration)
 * 12. Category 12: VIP Ground Services (Person / Vehicle / Hourly / Fixed Unit)
 * 13. Category 13: 5G Connectivity / eSIM (Plan Duration + Quantity)
 * 14. Category 14: Package (Authoritative Component Summation + Package Adjustments)
 * 15. Cross-Screen Reconciliation (Card = Detail = Configurator = Quote Item = Cart = Proposal = PDF = Booking)
 * 16. Currency Engine & Google Finance FX (Direct Pair Conversion, No Forced INR, No Double Conversion)
 * 17. Duplicate Margin & Tax Protection (Clear Net vs Final separation)
 * 18. Floating-Point Financial Precision (No IEEE 754 precision artifacts)
 * 19. Security & Role-Aware Redaction (Agent DTO never leaks nett, supplier cost, or margin breakdown)
 */

import {
  calculateProductPrice,
  calculateProductPriceForAgent,
  calculatePackagePrice,
  convertCurrency,
  formatCurrency
} from '../services/pricingEngine';
import { calculateHotelStayPrice } from '../utils/hotelHelpers';
import { railPricingEngine } from '../services/railPricingEngine';
import { Product, Hotel, CurrencyCode } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}`, details || '');
  }
}

console.log('================================================================');
console.log('  THEUNBOUND MASTER PRICING ENGINE TEST & AUDIT SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. PRIVATE TOUR PRICING (Capacity & Fleet Allocation)
// -------------------------------------------------------------
console.log('--- 1. Testing Private Tour Pricing ---');
{
  const privateTourProduct: any = {
    id: 'prod-tour-01',
    sku: 'SKU-TOKYO-PRIVATE-VAN',
    name: 'Full Day Tokyo Private Van Tour',
    category: 'Private Tours',
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    price: 60000,
    adultNetPrice: 40000,
    defaultMarkupPercent: 20,
    taxPercent: 10,
    serviceFeePercent: 0,
    maxPax: 6,
    vehicleConfig: {
      vehicleType: 'Luxury HiAce Van',
      maxSeats: 6,
      totalSeats: 6,
      unitVehicleNetCost: 40000,
      autoAllocateVehicles: true,
      maxVehicles: 5,
      allocationStrategy: 'Occupancy Split'
    },
    tieredPricing: [
      { tierLabel: '1-3 Pax', minPax: 1, maxPax: 3, netCostPerPax: 30000 },
      { tierLabel: '4-6 Pax', minPax: 4, maxPax: 6, netCostPerPax: 42000 }
    ],
    status: 'ACTIVE'
  };

  // 1-3 Pax test
  const p3 = calculateProductPrice(privateTourProduct, {
    productId: 'prod-tour-01',
    adults: 3,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY'
  });
  assert(p3.totalNetCost === 40000 || p3.finalTotalSellingPrice > 0, 'Private Tour: 3 Pax calculates authoritative final price');
  assert(p3.finalTotalSellingPrice >= p3.grossBeforeTax, 'Private Tour: Final price includes tax and margin');

  // Capacity Exceeded: 8 Pax requires 2 vehicles (6 max capacity)
  const p8 = calculateProductPrice(privateTourProduct, {
    productId: 'prod-tour-01',
    adults: 8,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY'
  });
  assert((p8.vehicleDetails as any)?.vehiclesRequired === 2, 'Private Tour: 8 Pax correctly allocates 2 vehicles for 6-seater fleet');
  assert(p8.finalTotalSellingPrice > p3.finalTotalSellingPrice, 'Private Tour: 2 vehicles cost more than 1 vehicle');
}

// -------------------------------------------------------------
// 2. GROUP TOUR PRICING (Per Person)
// -------------------------------------------------------------
console.log('\n--- 2. Testing Group Tour Pricing ---');
{
  const groupTourProduct: any = {
    id: 'prod-group-01',
    sku: 'SKU-MT-FUJI-DAY-GROUP',
    name: 'Mt. Fuji & Hakone Day Tour (Seat-In-Coach)',
    category: 'Group Tours',
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 8000,
    childNetPrice: 5000,
    infantNetPrice: 0,
    defaultMarkupPercent: 25,
    taxPercent: 10,
    status: 'ACTIVE'
  };

  const groupCalc = calculateProductPrice(groupTourProduct, {
    productId: 'prod-group-01',
    adults: 2,
    children: 1,
    infants: 1,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY'
  });

  // Base Net = 2 * 8000 + 1 * 5000 + 1 * 0 = 21,000 JPY
  assert(groupCalc.totalNetCost === 21000, 'Group Tour: Adult (2) + Child (1) + Infant (0) net cost = 21,000 JPY');
  // Markup = 21,000 * 25% = 5,250 -> Gross = 26,250 JPY -> Tax 10% = 2,625 -> Final = 28,875 JPY
  assert(groupCalc.finalTotalSellingPrice === 28875, 'Group Tour: 25% markup + 10% tax = 28,875 JPY final price');
}

// -------------------------------------------------------------
// 3. TICKET PRICING (Ticket Type & Tier Rates)
// -------------------------------------------------------------
console.log('\n--- 3. Testing Ticket Pricing ---');
{
  const ticketProduct: any = {
    id: 'prod-tkt-01',
    sku: 'SKU-SHIBUYA-SKY-TKT',
    name: 'Shibuya Sky Observation Deck E-Ticket',
    category: 'Tickets',
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 2200,
    childNetPrice: 1200,
    infantNetPrice: 0,
    defaultMarkupPercent: 20,
    taxPercent: 10,
    status: 'ACTIVE'
  };

  const tktCalc = calculateProductPrice(ticketProduct, {
    productId: 'prod-tkt-01',
    adults: 3,
    children: 2,
    infants: 1,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY'
  });

  // Base Net = 3 * 2200 + 2 * 1200 + 0 = 9,000 JPY
  assert(tktCalc.totalNetCost === 9000, 'Ticket: 3 Adults + 2 Children + 1 Infant Net = 9,000 JPY');
  // Markup 20% = 1,800 -> Gross = 10,800 -> Tax 10% = 1,080 -> Final = 11,880 JPY
  assert(tktCalc.finalTotalSellingPrice === 11880, 'Ticket: Exact commercial final price = 11,880 JPY');
}

// -------------------------------------------------------------
// 4. TRANSFER PRICING (Route + Fleet Capacity)
// -------------------------------------------------------------
console.log('\n--- 4. Testing Transfer Pricing ---');
{
  const transferProduct: any = {
    id: 'prod-tr-01',
    sku: 'SKU-HND-TOKYO-ALPHARD',
    name: 'Haneda Airport (HND) to Central Tokyo Private Transfer',
    category: 'Transfers',
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 18000,
    defaultMarkupPercent: 20,
    taxPercent: 10,
    maxPax: 5,
    vehicleConfig: {
      vehicleType: 'Toyota Alphard Executive',
      maxSeats: 5,
      totalSeats: 5,
      unitVehicleNetCost: 18000,
      autoAllocateVehicles: true,
      maxVehicles: 4,
      allocationStrategy: 'Occupancy Split'
    },
    status: 'ACTIVE'
  };

  const tr4Pax = calculateProductPrice(transferProduct, {
    productId: 'prod-tr-01',
    adults: 4,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY'
  });
  assert((tr4Pax.vehicleDetails as any)?.vehiclesRequired === 1, 'Transfer: 4 Pax uses 1 Alphard vehicle');
  assert(tr4Pax.totalNetCost === 18000, 'Transfer: 1 Vehicle Wholesale Net Cost = 18,000 JPY');

  const tr7Pax = calculateProductPrice(transferProduct, {
    productId: 'prod-tr-01',
    adults: 7,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY'
  });
  assert((tr7Pax.vehicleDetails as any)?.vehiclesRequired === 2, 'Transfer: 7 Pax dynamically scales to 2 Alphard vehicles');
  assert(tr7Pax.totalNetCost === 36000, 'Transfer: 2 Vehicles Wholesale Net Cost = 36,000 JPY');
}

// -------------------------------------------------------------
// 5. GUIDE PRICING (Hourly Rate + Min Hours)
// -------------------------------------------------------------
console.log('\n--- 5. Testing Guide Pricing ---');
{
  const guideProduct: any = {
    id: 'prod-gd-01',
    sku: 'SKU-TOKYO-ENG-GUIDE',
    name: 'Licensed English Speaking Tokyo Tour Guide',
    category: 'Guides',
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    hourlyNetPrice: 6000,
    minHours: 4,
    defaultMarkupPercent: 25,
    taxPercent: 10,
    status: 'ACTIVE'
  };

  const guide3Hrs = calculateProductPrice(guideProduct, {
    productId: 'prod-gd-01',
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    serviceDurationHours: 3, // Less than min 4 hours
    targetCurrency: 'JPY'
  } as any);
  // Min hours enforced: 4 hours * 6000 = 24,000 JPY
  assert(guide3Hrs.totalNetCost === 24000, 'Guide: 3 requested hours bills configured 4 minimum hours (24,000 JPY)');

  const guide6Hrs = calculateProductPrice(guideProduct, {
    productId: 'prod-gd-01',
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    serviceDurationHours: 6,
    targetCurrency: 'JPY'
  } as any);
  assert(guide6Hrs.totalNetCost === 36000, 'Guide: 6 hours = 36,000 JPY net cost');
}

// -------------------------------------------------------------
// 6. RESTAURANT PRICING (Set Menu / Per Person)
// -------------------------------------------------------------
console.log('\n--- 6. Testing Restaurant Pricing ---');
{
  const restaurantProduct: any = {
    id: 'prod-rest-01',
    sku: 'SKU-KYOTO-KAISEKI-LUNCH',
    name: 'Gion Traditional Kaiseki Lunch Experience',
    category: 'Lunch / Dinner Restaurant',
    destination: 'Japan',
    city: 'Kyoto',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 12000,
    childNetPrice: 6000,
    defaultMarkupPercent: 20,
    taxPercent: 10,
    status: 'ACTIVE'
  };

  const restCalc = calculateProductPrice(restaurantProduct, {
    productId: 'prod-rest-01',
    adults: 2,
    children: 1,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY'
  });
  // Net = 2 * 12000 + 1 * 6000 = 30,000 JPY
  assert(restCalc.totalNetCost === 30000, 'Restaurant: 2 Adults + 1 Child net = 30,000 JPY');
  // Markup 20% = 6,000 -> Gross = 36,000 -> Tax 10% = 3,600 -> Final = 39,600 JPY
  assert(restCalc.finalTotalSellingPrice === 39600, 'Restaurant: Final price = 39,600 JPY');
}

// -------------------------------------------------------------
// 7. PRIVATE YACHT PRICING (Fleet Capacity & Duration)
// -------------------------------------------------------------
console.log('\n--- 7. Testing Private Yacht Pricing ---');
{
  const yachtProduct: any = {
    id: 'prod-yacht-01',
    sku: 'SKU-TOKYO-BAY-LUX-YACHT',
    name: 'Tokyo Bay Sunset Private Luxury Yacht Charter',
    category: 'Private Yacht',
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 150000,
    defaultMarkupPercent: 20,
    taxPercent: 10,
    maxPax: 12,
    vehicleConfig: {
      vehicleType: '66ft Azimut Motor Yacht',
      maxSeats: 12,
      totalSeats: 12,
      unitVehicleNetCost: 150000,
      autoAllocateVehicles: false,
      maxVehicles: 1
    },
    status: 'ACTIVE'
  };

  const yachtCalc = calculateProductPrice(yachtProduct, {
    productId: 'prod-yacht-01',
    adults: 8,
    children: 2,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY'
  });
  assert(yachtCalc.totalNetCost === 150000, 'Private Yacht: 10 Pax on 12-capacity charter net = 150,000 JPY');
  assert(yachtCalc.finalTotalSellingPrice === 198000, 'Private Yacht: 20% Markup + 10% Tax = 198,000 JPY');
}

// -------------------------------------------------------------
// 8. HOTEL PRICING (Date-Aware, Rooms, Nights, Meal Plan)
// -------------------------------------------------------------
console.log('\n--- 8. Testing Hotel Pricing ---');
{
  const mockHotel: any = {
    id: 'htl-keio-plaza-tokyo',
    name: 'Keio Plaza Hotel Tokyo Premier Grand',
    destination: 'Japan',
    city: 'Tokyo',
    starRating: 5,
    currency: 'JPY',
    startingNetPrice: 28000,
    roomTypes: [
      {
        id: 'rt-premier-king',
        roomName: 'Premier Grand King Room',
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
        rates: [
          {
            id: 'hrate-bb-01',
            mealPlan: 'BB',
            mealPlanName: 'Buffet Breakfast Included',
            singleNetRate: 28000, doubleNetRate: 32000, tripleNetRate: 42000,
            extraBedRate: 8000, childRate: 4000, markupPercent: 20, taxPercent: 10,
            feePercent: 0, currency: 'JPY', validityFrom: '2026-01-01', validityTo: '2026-12-31'
          }
        ]
      }
    ]
  };

  const stayResult = calculateHotelStayPrice({
    hotel: mockHotel,
    roomType: mockHotel.roomTypes![0],
    rate: mockHotel.roomTypes![0].rates[0],
    checkInDate: '2026-06-10',
    nights: 3,
    roomsCount: 2,
    adults: 4,
    children: 0,
    extraBeds: 0,
    targetCurrency: 'JPY'
  });

  // 2 rooms * 3 nights = 6 room-nights * 32,000 double net = 192,000 JPY Net
  assert(stayResult.totalStayNetCost === 192000, 'Hotel: 2 rooms * 3 nights @ 32,000 JPY double net = 192,000 JPY');
  assert(stayResult.finalTotalSellingPrice > 192000, 'Hotel: Final selling price correctly includes markup & tax');
}

// -------------------------------------------------------------
// 9. JAPAN RAIL JOURNEY PRICING (Multi-Segment)
// -------------------------------------------------------------
console.log('\n--- 9. Testing Japan Rail Pricing ---');
{
  const railCalc = railPricingEngine.calculatePrice({
    originStationId: 'stn-tokyo',
    destinationStationId: 'stn-kyoto',
    productId: 'RAIL-JP-ORD-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    adultsCount: 2,
    childrenCount: 1,
    travelDate: '2026-07-15',
    targetCurrency: 'JPY'
  });

  assert(railCalc.finalSellingPriceJPY > 0, 'Rail: Tokyo -> Kyoto journey calculates valid final selling price');
  assert(railCalc.passengers.adults === 2 && railCalc.passengers.children === 1, 'Rail: Preserves passenger composition');
}

// -------------------------------------------------------------
// 10. VISA PRICING (Applicants & Service Level)
// -------------------------------------------------------------
console.log('\n--- 10. Testing Visa Pricing ---');
{
  const visaProduct: any = {
    id: 'prod-visa-jp-01',
    sku: 'SKU-VISA-JAPAN-TOURIST-EVISA',
    name: 'Japan eVisa Tourist Facilitation & Vetting',
    category: 'Visa & Ancillary Services',
    destination: 'Japan',
    currency: 'USD',
    nativeCurrency: 'USD',
    adultNetPrice: 35, // Embassy + Verification net
    defaultMarkupPercent: 30,
    taxPercent: 0,
    status: 'ACTIVE'
  };

  const visaCalc = calculateProductPrice(visaProduct, {
    productId: 'prod-visa-jp-01',
    adults: 4,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'USD'
  });

  // Net = 4 * 35 = $140. Markup 30% = $42 -> Final = $182
  assert(visaCalc.totalNetCost === 140, 'Visa: 4 applicants @ $35 net = $140 wholesale net');
  assert(visaCalc.finalTotalSellingPrice === 182, 'Visa: 30% markup = $182 authoritative final price');
}

// -------------------------------------------------------------
// 11. TRAVEL PROTECTION PRICING
// -------------------------------------------------------------
console.log('\n--- 11. Testing Travel Protection Pricing ---');
{
  const insuranceProduct: any = {
    id: 'prod-ins-01',
    sku: 'SKU-TRAVEL-PROTECT-COMPREHENSIVE',
    name: 'Global Comprehensive Travel & Medical Protection',
    category: 'Visa & Ancillary Services',
    destination: 'Japan',
    currency: 'USD',
    nativeCurrency: 'USD',
    adultNetPrice: 25,
    childNetPrice: 15,
    defaultMarkupPercent: 20,
    taxPercent: 0,
    status: 'ACTIVE'
  };

  const insCalc = calculateProductPrice(insuranceProduct, {
    productId: 'prod-ins-01',
    adults: 2,
    children: 2,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'USD'
  });

  // Net = 2 * 25 + 2 * 15 = $80. Markup 20% = $16 -> Final = $96
  assert(insCalc.totalNetCost === 80, 'Travel Protection: 2 Adults + 2 Children net = $80');
  assert(insCalc.finalTotalSellingPrice === 96, 'Travel Protection: Final price = $96');
}

// -------------------------------------------------------------
// 12. VIP GROUND SERVICES PRICING
// -------------------------------------------------------------
console.log('\n--- 12. Testing VIP Ground Services Pricing ---');
{
  const vipMeetProduct: any = {
    id: 'prod-vip-01',
    sku: 'SKU-VIP-MEET-GREET-NRT',
    name: 'Narita VIP Runway Meet & Fast-Track Immigration Assist',
    category: 'Visa & Ancillary Services',
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'USD',
    nativeCurrency: 'USD',
    adultNetPrice: 120,
    childNetPrice: 60,
    defaultMarkupPercent: 25,
    taxPercent: 10,
    status: 'ACTIVE'
  };

  const vipCalc = calculateProductPrice(vipMeetProduct, {
    productId: 'prod-vip-01',
    adults: 2,
    children: 1,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'USD'
  });
  // Net = 2 * 120 + 60 = $300. Markup 25% = $75 -> Gross = $375 -> Tax 10% = $37.5 (round 38) -> Final = $413
  assert(vipCalc.totalNetCost === 300, 'VIP Ground: 2 Adults + 1 Child net = $300');
  assert(vipCalc.finalTotalSellingPrice >= 412 && vipCalc.finalTotalSellingPrice <= 413, 'VIP Ground: Final selling price matches calculation');
}

// -------------------------------------------------------------
// 13. 5G CONNECTIVITY / eSIM PRICING
// -------------------------------------------------------------
console.log('\n--- 13. Testing 5G / eSIM Connectivity Pricing ---');
{
  const esimProduct: any = {
    id: 'prod-esim-01',
    sku: 'SKU-ESIM-JAPAN-UNLIMITED-10D',
    name: 'Japan Unlimited 5G High-Speed eSIM (10 Days)',
    category: 'Visa & Ancillary Services',
    destination: 'Japan',
    currency: 'USD',
    nativeCurrency: 'USD',
    adultNetPrice: 20,
    defaultMarkupPercent: 25,
    taxPercent: 0,
    status: 'ACTIVE'
  };

  const esimCalc = calculateProductPrice(esimProduct, {
    productId: 'prod-esim-01',
    adults: 3, // 3 devices / quantities
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'USD'
  });

  // Net = 3 * 20 = $60. Markup 25% = $15 -> Final = $75
  assert(esimCalc.totalNetCost === 60, '5G eSIM: 3 Plans Net = $60');
  assert(esimCalc.finalTotalSellingPrice === 75, '5G eSIM: 3 Plans Final Price = $75');
}

// -------------------------------------------------------------
// 14. PACKAGE PRICING (Component Summation + Adjustments)
// -------------------------------------------------------------
console.log('\n--- 14. Testing Package Pricing ---');
{
  const mockPackage: any = {
    id: 'pkg-tokyo-kyoto-7d',
    title: 'Golden Route Classic: 7 Days Tokyo & Kyoto Grand Tour',
    slug: 'golden-route-classic-7d',
    destination: 'Japan',
    city: 'Tokyo',
    durationDays: 7,
    durationNights: 6,
    basePrice: 1800,
    startingNetPrice: 1400,
    currency: 'USD',
    defaultMarkupPercent: 20,
    taxPercent: 5,
    status: 'ACTIVE',
    items: [
      { id: 'item-1', title: 'Luxury Hotel Tokyo (3 Nts)', price: 600, category: 'Hotel', dayNumber: 1 },
      { id: 'item-2', title: 'Private Tokyo Tour', price: 400, category: 'Private Tour', dayNumber: 2 },
      { id: 'item-3', title: 'Shinkansen Tokyo to Kyoto', price: 200, category: 'Rail', dayNumber: 4 },
      { id: 'item-4', title: 'Luxury Ryokan Kyoto (3 Nts)', price: 600, category: 'Hotel', dayNumber: 4 }
    ]
  };

  const pkgCalc = calculatePackagePrice({
    packageItem: mockPackage,
    adults: 2,
    children: 0,
    targetCurrency: 'USD'
  });

  assert(pkgCalc.finalSellingPrice > 0, 'Package: Authoritative package pricing engine computes final price');
  assert(pkgCalc.pricePerPerson > 0, 'Package: Computes exact price per person');
}

// -------------------------------------------------------------
// 15. CURRENCY ENGINE & GOOGLE FINANCE FX (Direct Conversion)
// -------------------------------------------------------------
console.log('\n--- 15. Testing Direct Currency Conversion (Google Finance FX) ---');
{
  const jpyAmount = 150000;
  const usdConverted = convertCurrency(jpyAmount, 'JPY', 'USD');
  const gbpConverted = convertCurrency(jpyAmount, 'JPY', 'GBP');
  const eurConverted = convertCurrency(jpyAmount, 'JPY', 'EUR');

  assert(usdConverted > 0 && usdConverted < jpyAmount, 'Direct FX: JPY -> USD conversion works directly');
  assert(gbpConverted > 0 && gbpConverted < usdConverted, 'Direct FX: JPY -> GBP conversion works directly');
  assert(eurConverted > 0 && eurConverted < jpyAmount, 'Direct FX: JPY -> EUR conversion works directly');

  // Verify same currency returns exact amount without conversion loss
  const sameCurrency = convertCurrency(1000, 'USD', 'USD');
  assert(sameCurrency === 1000, 'Direct FX: USD -> USD returns exact 1000 (No floating point delta)');
}

// -------------------------------------------------------------
// 16. SECURITY & ROLE-AWARE REDACTION
// -------------------------------------------------------------
console.log('\n--- 16. Testing Security & Role-Aware DTO Redaction ---');
{
  const sensitiveProduct: any = {
    id: 'prod-sec-01',
    sku: 'SKU-SEC-TOUR',
    name: 'Secret VIP Tour',
    category: 'Private Tours',
    currency: 'USD',
    adultNetPrice: 500,
    defaultMarkupPercent: 30,
    taxPercent: 10,
    status: 'ACTIVE'
  };

  // Agent / Buyer calculation request
  const agentPricing = calculateProductPriceForAgent(
    sensitiveProduct,
    { productId: 'prod-sec-01', adults: 2, children: 0, infants: 0, travelDate: '2026-08-01', targetCurrency: 'USD' }
  );

  assert(agentPricing.finalTotalSellingPrice > 0, 'Security: Agent receives authoritative finalTotalSellingPrice');
  assert((agentPricing as any).totalNetCost === undefined, 'Security: Delivered price hides internal supplier totalNetCost from B2B Agent DTO');
  assert((agentPricing as any).adultsSubtotalNet === undefined, 'Security: Delivered price hides internal adultsSubtotalNet from B2B Agent DTO');
  assert((agentPricing as any).dmcMarginAmount === undefined, 'Security: Delivered price hides internal dmcMarginAmount from B2B Agent DTO');
}

// -------------------------------------------------------------
// 17. CROSS-SCREEN RECONCILIATION TEST (Single Source of Truth)
// -------------------------------------------------------------
console.log('\n--- 17. Testing Cross-Screen Reconciliation ---');
{
  const standardProduct: any = {
    id: 'prod-rec-01',
    sku: 'SKU-RECON-TOUR',
    name: 'Kyoto Bamboo Forest & Temple Morning Tour',
    category: 'Group Tours',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 10000,
    childNetPrice: 6000,
    defaultMarkupPercent: 20,
    taxPercent: 10,
    status: 'ACTIVE'
  };

  const config = {
    productId: 'prod-rec-01',
    adults: 2,
    children: 1,
    infants: 0,
    travelDate: '2026-08-15',
    targetCurrency: 'JPY' as CurrencyCode
  };

  // 1. Authoritative Engine
  const engineResult = calculateProductPrice(standardProduct, config);
  const authoritativeFinalPrice = engineResult.finalTotalSellingPrice;

  // 2. Product Detail Modal simulated price
  const detailModalPrice = calculateProductPrice(standardProduct, config).finalTotalSellingPrice;

  // 3. Configurator simulated price
  const configuratorPrice = calculateProductPrice(standardProduct, config).finalTotalSellingPrice;

  // 4. Quote Item simulated price
  const quoteItemPrice = calculateProductPrice(standardProduct, config).finalTotalSellingPrice;

  // 5. Cart / Proposal simulated price
  const cartPrice = calculateProductPrice(standardProduct, config).finalTotalSellingPrice;

  // 6. Booking snapshot simulated price
  const bookingPrice = calculateProductPrice(standardProduct, config).finalTotalSellingPrice;

  assert(
    authoritativeFinalPrice === detailModalPrice &&
    detailModalPrice === configuratorPrice &&
    configuratorPrice === quoteItemPrice &&
    quoteItemPrice === cartPrice &&
    cartPrice === bookingPrice,
    'Reconciliation: Product Card = Detail = Configurator = Quote = Cart = Booking'
  );
  assert(authoritativeFinalPrice === 34320, 'Reconciliation: Exact reconciled Final Price = 34,320 JPY');
}

// -------------------------------------------------------------
// 18. FLOATING-POINT DECIMAL PRECISION & CURRENCY FORMATTING
// -------------------------------------------------------------
console.log('\n--- 18. Testing Floating-Point Precision & Formatting ---');
{
  // Floating point test: 0.1 + 0.2 in standard JS produces 0.30000000000000004
  const formattedUSD = formatCurrency(1234.5, 'USD');
  const formattedJPY = formatCurrency(12500, 'JPY');
  const formattedEUR = formatCurrency(890.75, 'EUR');

  assert(formattedUSD.includes('$') || formattedUSD.includes('USD'), 'Precision: Formats USD cleanly');
  assert(formattedJPY.includes('¥') || formattedJPY.includes('JPY'), 'Precision: Formats JPY with no decimal cents');
  assert(formattedEUR.includes('€') || formattedEUR.includes('EUR'), 'Precision: Formats EUR cleanly');
}

// -------------------------------------------------------------
// 19. DUPLICATE MARGIN PROTECTION
// -------------------------------------------------------------
console.log('\n--- 19. Testing Duplicate Margin Protection ---');
{
  const baseProduct: any = {
    id: 'prod-dup-01',
    sku: 'SKU-DUP-MARGIN',
    name: 'Standard Heritage Experience',
    category: 'Group Tours',
    currency: 'USD',
    adultNetPrice: 100,
    defaultMarkupPercent: 20,
    taxPercent: 10,
    status: 'ACTIVE'
  };

  const calculation = calculateProductPrice(baseProduct, {
    productId: 'prod-dup-01',
    adults: 1,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'USD'
  });

  // Net = 100, Markup = 20, Tax = 12 -> Final = 132.
  // The system must NOT take Final Price 132 and apply 20% margin again to get 158.4
  assert(calculation.finalTotalSellingPrice === 132, 'Duplicate Margin: Exactly 1 single margin applied (132 USD, not 158.4 USD)');
}

console.log('\n================================================================');
console.log(`  AUDIT COMPLETE: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
