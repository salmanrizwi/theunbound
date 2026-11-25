import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {
  Booking,
  BookingInvoice,
  BookingItem,
  BookingPricingSnapshot,
  BookingVoucher,
  CentralCompanyProfile,
  User
} from '../types';
import {
  detectConfirmedServiceAmendment,
  groupBookingItemsByDay,
  hydrateBookingServiceItem,
  resolveAuthoritativeProformaAmount,
  sanitizeVerifiedGoogleMapsUrl,
  sortBookingItemsChronologically,
  validateActivityVoucherReadiness,
  validateCompleteVoucherReadiness
} from '../services/bookingOperationsSyncService';
import {
  generateActivityVoucherPDF,
  generateCompleteVoucherPDF,
  generateProformaInvoicePDF
} from '../services/bookingDocumentPdfService';
import { AppDatabase } from '../services/db';

// Node test shim for browser localStorage used by AppDatabase
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null
  };
}

// ============================================================================
// END-TO-END AUDIT & REAL PDF VERIFICATION SUITE
// Booking Pipeline -> Service Items -> Supplier Allocation -> Vouchers -> Proforma
// ============================================================================

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

/**
 * Extracts all rendered text strings from a jsPDF binary buffer by inflating
 * FlateDecode streams and parsing PDF literal strings.
 */
function extractSelectableTextFromPdf(pdfBytes: Uint8Array): string {
  const buf = Buffer.from(pdfBytes);
  const raw = buf.toString('latin1');
  const chunks: string[] = [];

  // Extract uncompressed segments as well
  chunks.push(raw);

  // Decompress every FlateDecode stream
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw)) !== null) {
    const streamData = Buffer.from(match[1], 'latin1');
    try {
      const inflated = zlib.inflateSync(streamData).toString('latin1');
      chunks.push(inflated);
    } catch {
      // Non-flate or image stream; ignore
    }
  }

  // Also unescape PDF literal strings (e.g., \( ... \)) into readable text
  const combined = chunks.join('\n');
  const literalRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  const extractedTexts: string[] = [];
  let lm: RegExpExecArray | null;
  while ((lm = literalRegex.exec(combined)) !== null) {
    const unescaped = lm[1]
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
    extractedTexts.push(unescaped);
  }
  return extractedTexts.join(' ');
}

function buildTestCompanyProfile(): CentralCompanyProfile {
  return {
    id: 'company-profile-main',
    companyName: 'TheUnbound Travel Pvt. Ltd.',
    legalName: 'TheUnbound Travel Private Limited',
    email: 'operations@theunbound.in',
    salesEmail: 'sales@theunbound.in',
    opsEmail: 'operations@theunbound.in',
    phone: '+91 9811654959',
    whatsappNumber: '+91 9811654959',
    emergencyContact: '+91 9811654959 (24/7 Operations)',
    website: 'https://theunbound.in',
    registeredAddress: 'Suite 402, Corporate Tower A, DLF Cyber City, Phase II, Gurugram, Haryana 122002, India',
    currentAddress: 'Level 9, One Horizon Center, Golf Course Road, Sector 43, Gurugram, Haryana 122002, India',
    gstin: '06AABCT9921K1Z4',
    updatedAt: '2026-11-01T10:00:00.000Z'
  };
}

function buildRealisticMultiServiceBooking(): Booking {
  // Intentionally placed OUT OF CHRONOLOGICAL ORDER to test strict chronological sorting
  const itemTicketActivity: BookingItem = {
    id: 'srv-item-teamlab-001',
    productId: 'prod-teamlab-planets-tokyo',
    sku: 'TUB-TYO-TLP-01',
    productName: 'teamLab Planets TOKYO — Timed Entry Digital Art Experience',
    category: 'ATTRACTIONS',
    destination: 'Tokyo, Japan',
    city: 'Tokyo',
    hub: 'Toyosu',
    serviceDate: '2026-11-12',
    travelDate: '2026-11-12',
    ticketDate: '2026-11-12',
    ticketEntryTime: '10:30 AM',
    serviceTime: '10:30 AM',
    startTime: '10:30 AM',
    endTime: '12:30 PM',
    reportingTime: '10:00 AM',
    timeZone: 'JST (UTC+9)',
    serviceTimezone: 'JST (UTC+9)',
    adults: 3,
    children: 1,
    infants: 1,
    totalPax: 5,
    quantity: 5,
    passengerAssignment: ['Aarav Mehta', 'Ananya Mehta', 'Rohan Mehta', 'Kavya Mehta (Child)', 'Reyansh Mehta (Infant)'],
    ageTicketCategories: '3x Adult Pass (18+), 1x Child Pass (4-12), 1x Infant Complimentary (0-3)',
    serviceDescription:
      'Immerse yourself in teamLab Planets TOKYO, a body-immersive museum in Toyosu comprising four massive exhibition spaces and two expansive gardens. Guests walk barefoot through shallow warm water illuminated by interactive digital koi projections, traverse a crystal-mirror universe suspended in infinite light, and step into the Floating Flower Garden where over 13,000 live orchids bloom dynamically in response to visitor movement.\n\nThis timed-entry reservation grants priority queue admission during your confirmed slot. Allow approximately two hours inside the installations and wear comfortable knee-rollable trousers for the water-based rooms.',
    serviceOverview:
      'Confirmed timed-entry digital art museum visit in Toyosu, Tokyo with barefoot water installations and interactive orchid garden.',
    inclusions: [
      'Confirmed timed-entry admission tickets for 3 Adults, 1 Child, and 1 Infant',
      'Access to all 4 Water & Forest Body-Immersive exhibition zones and 2 Gardens',
      'Complimentary secure lockers for shoes, strollers, and daypacks at the entrance',
      'Complimentary short-pants rental available upon request at the changing pavilion'
    ],
    exclusions: [
      'Hotel transfers (self-arrival via Yurikamome Line to Shin-Toyosu Station)',
      'Meals, beverages, and souvenirs at Vegan Ramen UZU Tokyo',
      'Personal travel insurance and optional photography add-ons'
    ],
    meetingPoint: 'teamLab Planets TOKYO Main Entrance Gate B (Timed-Entry QR Lane)',
    address: '6-1-16 Toyosu, Koto-ku, Tokyo 135-0061, Japan',
    googleMapsUrl: 'https://maps.google.com/?q=teamLab+Planets+TOKYO+Toyosu',
    importantInstructions:
      'Arrive at Gate B at least 30 minutes before your 10:30 AM entry slot (reporting time 10:00 AM). Entry is strictly time-controlled and late arrivals beyond 20 minutes cannot be accommodated. Guests will walk barefoot in knee-deep water; avoid long dresses or tight trousers that cannot be rolled up.',
    unitSellingPrice: 48,
    totalPrice: 240,
    currency: 'USD',
    supplierId: 'supp-jp-tickets-01',
    supplierName: 'Kanto Cultural Ticketing Co., Ltd.',
    supplierType: 'TICKET_PARTNER',
    supplierContact: '+81 3-5555-8190',
    supplierPhone: '+81 3-5555-8190',
    supplierEmail: 'reservations@kantoticketing.jp',
    supplierConfirmationRef: 'TLP-TYO-99241',
    supplierPrice: 165,
    supplierCurrency: 'USD',
    supplierConfirmationStatus: 'Confirmed',
    supplierAllocationStatus: 'Supplier Confirmed',
    supplierStatus: 'CONFIRMED_BY_SUPPLIER',
    operationalStatus: 'Confirmed',
    serviceVersion: 1
  };

  const itemAirportTransfer: BookingItem = {
    id: 'srv-item-transfer-002',
    productId: 'prod-hnd-private-alphard',
    sku: 'TUB-TYO-TRF-ALPHARD',
    productName: 'Haneda Airport Private Luxury Chauffeur Transfer',
    category: 'TRANSFERS',
    destination: 'Tokyo, Japan',
    city: 'Tokyo',
    hub: 'Haneda Airport -> Shinjuku',
    serviceDate: '2026-11-10',
    travelDate: '2026-11-10',
    pickupDate: '2026-11-10',
    pickupTime: '03:15 PM',
    serviceTime: '03:15 PM',
    startTime: '03:15 PM',
    timeZone: 'JST (UTC+9)',
    adults: 3,
    children: 1,
    infants: 1,
    totalPax: 5,
    quantity: 1,
    serviceDescription:
      'Private meet-and-greet airport arrival transfer from Tokyo Haneda International Airport (Terminal 3) directly to Park Hyatt Tokyo in Shinjuku. Your English-speaking uniformed chauffeur will monitor your incoming flight in real time and wait in the International Arrivals Hall holding a personalised name placard.',
    serviceOverview: 'Private Haneda Terminal 3 arrival transfer to Park Hyatt Tokyo in an Executive Lounge MPV.',
    vehicleType: 'Toyota Alphard Executive Lounge',
    vehicleCategory: 'Luxury MPV (Private)',
    vehicleSeaterCapacity: 6,
    vehicleCount: 1,
    luggageCapacity: '4 Large Suitcases + 4 Cabin Bags',
    pickupLocation: 'Haneda International Airport — Terminal 3 Arrivals Lobby (Exit Gate A)',
    dropoffLocation: 'Park Hyatt Tokyo, 3-7-1-2 Nishi-Shinjuku, Tokyo',
    routeDetails: 'HND Terminal 3 -> Metropolitan Expressway -> Shinjuku West Exit (Approx. 40 mins)',
    inclusions: [
      'Private chauffeur-driven Toyota Alphard Executive Lounge with child booster seat',
      '90 minutes complimentary flight arrival waiting time after landing',
      'All expressway tolls, airport parking charges, and fuel surcharges'
    ],
    exclusions: [
      'Additional unscheduled en-route stops beyond 15 minutes',
      'Porterage tips and after-hours surcharge past 10:00 PM'
    ],
    importantInstructions:
      'Flight tracking is enabled for NH-828. If immigration clearance exceeds 60 minutes, please WhatsApp our 24/7 Tokyo Dispatch Desk immediately so the chauffeur remains staged at Terminal 3.',
    unitSellingPrice: 310,
    totalPrice: 310,
    currency: 'USD',
    supplierId: 'supp-mk-limo-jp',
    supplierName: 'MK Chauffeur & Limousine Japan',
    supplierType: 'TRANSPORT',
    supplierContact: '+81 3-5555-3100',
    supplierPhone: '+81 3-5555-3100',
    supplierConfirmationRef: 'MK-HND-44021',
    supplierPrice: 215,
    supplierCurrency: 'USD',
    supplierConfirmationStatus: 'Confirmed',
    supplierAllocationStatus: 'Supplier Confirmed',
    supplierStatus: 'CONFIRMED_BY_SUPPLIER',
    operationalStatus: 'Confirmed',
    serviceVersion: 1
  };

  const itemHotelStay: BookingItem = {
    id: 'srv-item-hotel-003',
    productId: 'prod-park-hyatt-tokyo',
    sku: 'TUB-TYO-HTL-PHT',
    productName: 'Park Hyatt Tokyo — Park Deluxe Twin Room (5 Nights)',
    category: 'HOTELS',
    destination: 'Tokyo, Japan',
    city: 'Tokyo',
    hub: 'Shinjuku',
    serviceDate: '2026-11-10',
    travelDate: '2026-11-10',
    serviceTime: '04:30 PM',
    startTime: '04:30 PM',
    timeZone: 'JST (UTC+9)',
    adults: 3,
    children: 1,
    infants: 1,
    totalPax: 5,
    quantity: 5,
    serviceDescription:
      'Five nights luxury accommodation in two interconnecting Park Deluxe Rooms overlooking Mount Fuji and the Shinjuku skyline, inclusive of daily Girandole buffet breakfast and full access to Club On The Park spa and indoor lap pool.',
    serviceOverview: '5-night luxury stay at Park Hyatt Tokyo with daily breakfast and early crib setup.',
    address: '3-7-1-2 Nishi-Shinjuku, Shinjuku-ku, Tokyo 163-1055, Japan',
    googleMapsUrl: 'https://maps.google.com/?q=Park+Hyatt+Tokyo+Shinjuku',
    serviceHotelDetails: {
      hotelName: 'Park Hyatt Tokyo',
      roomType: '2x Interconnecting Park Deluxe Twin/King',
      mealPlan: 'Daily Buffet Breakfast (BB)',
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-15',
      confirmationNumber: 'PHT-778201'
    },
    inclusions: [
      '5 nights accommodation with guaranteed interconnecting doors',
      'Daily breakfast at Girandole for 3 Adults and 1 Child',
      'Complimentary baby crib and high-speed Wi-Fi'
    ],
    exclusions: [
      'Tokyo municipal accommodation tax payable locally at checkout if applicable',
      'Mini-bar, laundry, and spa treatments'
    ],
    importantInstructions: 'Present lead traveller passport and confirmation number PHT-778201 at the 41st-floor Sky Lobby reception desk.',
    unitSellingPrice: 780,
    totalPrice: 3900,
    currency: 'USD',
    supplierId: 'supp-pht-direct',
    supplierName: 'Park Hyatt Tokyo Reservations',
    supplierType: 'HOTEL',
    supplierContact: '+81 3-5322-1234',
    supplierConfirmationRef: 'PHT-778201',
    supplierPrice: 3100,
    supplierCurrency: 'USD',
    supplierConfirmationStatus: 'Confirmed',
    supplierAllocationStatus: 'Supplier Confirmed',
    supplierStatus: 'CONFIRMED_BY_SUPPLIER',
    operationalStatus: 'Confirmed',
    serviceVersion: 1
  };

  const itemGuidedTour: BookingItem = {
    id: 'srv-item-kyoto-004',
    productId: 'prod-kyoto-heritage-day',
    sku: 'TUB-KYO-EXC-09',
    productName: 'Full-Day Private Kyoto & Arashiyama Heritage Cultural Immersion',
    category: 'GUIDED_TOURS',
    destination: 'Kyoto, Japan',
    city: 'Kyoto',
    hub: 'Arashiyama & Higashiyama',
    serviceDate: '2026-11-11',
    travelDate: '2026-11-11',
    serviceTime: '09:00 AM',
    startTime: '09:00 AM',
    endTime: '05:30 PM',
    reportingTime: '08:45 AM',
    timeZone: 'JST (UTC+9)',
    adults: 3,
    children: 1,
    infants: 1,
    totalPax: 5,
    quantity: 1,
    serviceDescription:
      'Discover ancient Kyoto alongside a government-licensed English-speaking cultural historian. Begin with an early morning stroll through the Arashiyama Bamboo Grove and Tenryu-ji Zen Garden, continue to the gilded pavilions of Kinkaku-ji, and conclude with a curated walking exploration of the preserved wooden machiya lanes of Ninenzaka and Gion.',
    serviceOverview: 'Private 8.5-hour licensed-guide heritage excursion covering Arashiyama, Tenryu-ji, Kinkaku-ji, and Higashiyama.',
    meetingPoint: 'Kyoto Station Central Gate (Shinkansen Exit concourse beside Information Pillar)',
    address: 'Higashishiokoji Kamadonocho, Shimogyo Ward, Kyoto 600-8216, Japan',
    googleMapsUrl: 'https://maps.google.com/?q=Kyoto+Station+Central+Gate',
    inclusions: [
      'Dedicated government-licensed English-speaking cultural guide (8.5 hours)',
      'Entrance tickets for Tenryu-ji Garden and Kinkaku-ji Golden Pavilion',
      'Private matcha tea tasting session in a historic Higashiyama machiya'
    ],
    exclusions: [
      'Shinkansen bullet train tickets between Tokyo and Kyoto',
      'Lunch and personal shopping expenses'
    ],
    importantInstructions: 'Wear comfortable walking shoes as temple steps and stone-paved alleys in Higashiyama require moderate walking.',
    unitSellingPrice: 1200,
    totalPrice: 1200,
    currency: 'USD',
    supplierId: 'supp-kyoto-heritage',
    supplierName: 'Kyoto Heritage Curators GK',
    supplierType: 'GUIDE',
    supplierContact: '+81 75-555-2040',
    supplierConfirmationRef: 'KYO-HER-33108',
    supplierPrice: 720,
    supplierCurrency: 'USD',
    supplierConfirmationStatus: 'Confirmed',
    supplierAllocationStatus: 'Supplier Confirmed',
    supplierStatus: 'CONFIRMED_BY_SUPPLIER',
    operationalStatus: 'Confirmed',
    serviceVersion: 1
  };

  const itemPendingDining: BookingItem = {
    id: 'srv-item-kaiseki-005',
    productId: 'prod-gion-kaiseki-private',
    sku: 'TUB-KYO-DIN-05',
    productName: 'Private Kaiseki Geisha Dining Experience in Gion',
    category: 'DINING',
    destination: 'Kyoto, Japan',
    city: 'Kyoto',
    hub: 'Gion',
    serviceDate: '2026-11-13',
    travelDate: '2026-11-13',
    serviceTime: '07:00 PM',
    startTime: '07:00 PM',
    timeZone: 'JST (UTC+9)',
    adults: 3,
    children: 1,
    infants: 1,
    totalPax: 5,
    quantity: 1,
    serviceDescription:
      'Multi-course seasonal Kyoto kaiseki dinner hosted in a private tatami dining room in historic Gion with traditional maiko performance.',
    serviceOverview: 'Evening private tatami kaiseki dinner in Gion (awaiting final teahouse seating confirmation).',
    meetingPoint: 'Hanamikoji-dori South Entrance, Gion',
    unitSellingPrice: 850,
    totalPrice: 850,
    currency: 'USD',
    supplierId: 'supp-gion-ryotei',
    supplierName: 'Gion Ryotei Hospitality',
    supplierType: 'ACTIVITY',
    supplierPrice: 400,
    supplierCurrency: 'USD',
    // Pending confirmation — MUST NOT be fabricated as Confirmed!
    supplierConfirmationStatus: 'Awaiting Supplier Confirmation',
    supplierAllocationStatus: 'Awaiting Supplier Confirmation',
    supplierStatus: 'WAITING_FOR_SUPPLIER',
    operationalStatus: 'Confirmation Pending',
    serviceVersion: 1
  };

  const committedSnapshot: BookingPricingSnapshot = {
    snapshotId: 'snap-tub-8841-v2',
    bookingId: 'bk-audit-8841',
    version: 2,
    currency: 'USD',
    supplierNettCost: 4600,
    originalBaseSellingPrice: 6500,
    originalCustomerSellingPrice: 6500,
    originalTheUnboundMargin: 1900,
    agentAdditionalMarkupAmount: 0,
    b2bPromotionDiscountAmount: 300,
    cumulativeAdminManualDiscount: 250,
    revisedBaseSellingPrice: 5950,
    remainingTheUnboundMargin: 1350,
    revisedCustomerSellingPrice: 5950,
    isLossMaking: false,
    sourceAction: 'ADMIN_MANUAL_DISCOUNT_APPLIED',
    createdAt: '2026-11-02T09:15:00.000Z',
    createdBy: 'admin-ops-1',
    createdByName: 'Marcus Vance',
    createdByRole: 'ADMIN',
    immutable: true
  };

  const booking: Booking = {
    id: 'bk-audit-8841',
    bookingReference: 'TUB-BK-2026-8841',
    status: 'CONFIRMED',
    destination: 'Tokyo & Kyoto, Japan',
    destinationName: 'Tokyo & Kyoto, Japan',
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-15',
    currency: 'USD',
    agencyId: 'ag-meridian-01',
    agencyName: 'Meridian Bespoke Travel Pvt. Ltd.',
    agentId: 'agent-meridian-01',
    agentName: 'Riya Sharma',
    customer: {
      name: 'Aarav Mehta',
      leadTravelerName: 'Aarav Mehta',
      email: 'aarav.mehta@example.com',
      phone: '+91 98201 44110',
      totalAdults: 3,
      totalChildren: 1,
      totalInfants: 1
    },
    items: [
      itemTicketActivity,
      itemAirportTransfer,
      itemHotelStay,
      itemGuidedTour,
      itemPendingDining
    ],
    // Underlying financial components preserved internally (NEVER broken out on Proforma PDF)
    subtotal: 5350,
    taxAmount: 420,
    discountTotal: 550,
    totalAmount: 5950,
    paidAmount: 2000,
    paymentStatus: 'PARTIALLY_PAID',
    totalSupplierCost: 4600,
    originalTheUnboundMargin: 1900,
    remainingTheUnboundMargin: 1350,
    adminManualDiscountTotal: 250,
    currentPricingSnapshotId: committedSnapshot.snapshotId,
    currentPricingSnapshotVersion: committedSnapshot.version,
    pricingSnapshotHistory: [committedSnapshot],
    specialRequests: 'Family travelling with an infant (age 2) and child (age 8). Please ensure child booster seat in airport vehicle and vegetarian options for breakfast.',
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-02T09:15:00.000Z',
    ...({
      travelers: { adults: 3, children: 1, infants: 1 },
      taxTotal: 420,
      serviceFeeTotal: 180
    } as any)
  };

  return booking;
}

async function runAudit(): Promise<void> {
  console.log('=== BOOKING PIPELINE, SUPPLIER SYNC & PDF AUDIT SUITE ===\n');

  const outDir = '/tmp/theunbound-pdf-audit';
  fs.mkdirSync(outDir, { recursive: true });

  const companyProfile = buildTestCompanyProfile();
  const booking = buildRealisticMultiServiceBooking();
  const adminUser: User = {
    id: 'admin-ops-1',
    name: 'Marcus Vance',
    email: 'marcus@theunbound.in',
    role: 'ADMIN',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  // --------------------------------------------------------------------------
  // TEST 1: Hydration, Category Gating & Google Maps URL Validation
  // --------------------------------------------------------------------------
  console.log('[1/6] Testing Service Item Hydration, Category Gating & Google Maps Validation...');
  const hydratedItems = booking.items.map(it => hydrateBookingServiceItem(it, booking));
  const hTeamlab = hydratedItems.find(i => i.id === 'srv-item-teamlab-001')!;
  const hTransfer = hydratedItems.find(i => i.id === 'srv-item-transfer-002')!;
  const hHotel = hydratedItems.find(i => i.id === 'srv-item-hotel-003')!;
  const hPending = hydratedItems.find(i => i.id === 'srv-item-kaiseki-005')!;

  assert(hTeamlab.isTicketedActivity === true, 'teamLab must be classified as ticketed activity');
  assert(hTeamlab.isTransportService === false, 'teamLab must NOT be classified as transport service');
  assert(hTeamlab.resolvedTicketEntryTime === '10:30 AM', 'teamLab ticketEntryTime must resolve to 10:30 AM');
  assert(hTeamlab.resolvedReportingTime === '10:00 AM', 'teamLab reportingTime must resolve to 10:00 AM');
  assert(hTeamlab.resolvedInclusions.length === 4, 'teamLab must have 4 inclusions');
  assert(hTeamlab.resolvedExclusions.length === 3, 'teamLab must have 3 exclusions');
  assert(hTeamlab.resolvedGoogleMapsUrl.startsWith('https://maps.google.com/'), 'teamLab verified Google Maps URL preserved');

  assert(hTransfer.isTransportService === true, 'Airport transfer must be classified as transport service');
  assert(hTransfer.vehicleType === 'Toyota Alphard Executive Lounge', 'Airport transfer vehicleType preserved');
  assert(hHotel.isAccommodationService === true, 'Park Hyatt must be classified as accommodation');
  assert(hPending.isConfirmedForVoucher === false, 'Pending kaiseki must NOT be confirmed for voucher');

  assert(sanitizeVerifiedGoogleMapsUrl('javascript:alert(1)') === '', 'Malicious JS URL must be rejected');
  assert(sanitizeVerifiedGoogleMapsUrl('https://evil.example.com/map') === '', 'Non-Google-Maps domain must be rejected');
  assert(sanitizeVerifiedGoogleMapsUrl('https://maps.app.goo.gl/abc123') === 'https://maps.app.goo.gl/abc123', 'Verified Google short map URL must be accepted');
  console.log('   PASS: Hydration, category gating, and Google Maps sanitization verified.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Strict Chronological Ordering & Day-Wise Grouping
  // --------------------------------------------------------------------------
  console.log('[2/6] Testing Chronological Ordering & Day-Wise Grouping...');
  const confirmedOnly = sortBookingItemsChronologically(hydratedItems.filter(i => i.isConfirmedForVoucher));
  assert(confirmedOnly.length === 4, 'Expected 4 confirmed services');
  assert(confirmedOnly[0].id === 'srv-item-transfer-002', 'First chronological service must be Day 1 03:15 PM Transfer');
  assert(confirmedOnly[1].id === 'srv-item-hotel-003', 'Second chronological service must be Day 1 04:30 PM Hotel');
  assert(confirmedOnly[2].id === 'srv-item-kyoto-004', 'Third chronological service must be Day 2 09:00 AM Kyoto Tour');
  assert(confirmedOnly[3].id === 'srv-item-teamlab-001', 'Fourth chronological service must be Day 3 10:30 AM teamLab');

  const dayGroups = groupBookingItemsByDay(confirmedOnly, booking.travelStartDate);
  assert(dayGroups.length === 3, 'Expected 3 distinct dated day groups');
  assert(dayGroups[0].dayNumber === 1 && dayGroups[0].items.length === 2, 'Day 1 must contain Transfer + Hotel');
  assert(dayGroups[1].dayNumber === 2 && dayGroups[1].items.length === 1, 'Day 2 must contain Kyoto Tour');
  assert(dayGroups[2].dayNumber === 3 && dayGroups[2].items.length === 1, 'Day 3 must contain teamLab');
  console.log('   PASS: Strict chronological sorting & real day numbering verified.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Completeness Validation & Confirmed-Service Amendment Trigger
  // --------------------------------------------------------------------------
  console.log('[3/6] Testing Completeness Pre-Validation & Confirmed Amendment Reconfirmation Trigger...');
  const completeValidation = validateCompleteVoucherReadiness(booking, hydratedItems);
  assert(completeValidation.confirmedItems.length === 4, 'Complete readiness must detect 4 confirmed items');
  assert(completeValidation.pendingItems.length === 1, 'Complete readiness must isolate 1 pending item');
  assert(completeValidation.warnings.length >= 1, 'Complete readiness must warn about pending item without fabricating confirmation');

  const activityValidation = validateActivityVoucherReadiness(hTeamlab);
  assert(activityValidation.canGenerate === true && activityValidation.errors.length === 0, 'Confirmed teamLab item must be ready for Activity Voucher');

  const amendCheck = detectConfirmedServiceAmendment(booking.items[0], {
    ticketEntryTime: '02:00 PM',
    adults: 4,
    totalPax: 6
  });
  assert(amendCheck.requiresReconfirmation === true, 'Changing ticket entry time & PAX on confirmed item MUST require reconfirmation');
  assert(amendCheck.affectsVouchers === true, 'Operational amendment MUST flag vouchers as outdated');
  assert(
    amendCheck.changedFields.some(f => f.startsWith('Ticket Entry Time (10:30 AM -> 02:00 PM)')) &&
      amendCheck.changedFields.some(f => f.startsWith('Adults (3 -> 4)')),
    `Changed fields must accurately list Ticket Entry Time and Adults diffs (got: ${amendCheck.changedFields.join(', ')})`
  );
  console.log('   PASS: Pre-validation & confirmed-service amendment reconfirmation detection verified.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Authoritative Proforma Financial Resolution (No Tax/Fee Leakage)
  // --------------------------------------------------------------------------
  console.log('[4/6] Testing Authoritative Proforma Financial Resolution...');
  const proformaFin = resolveAuthoritativeProformaAmount(booking);
  assert(proformaFin.finalBookingAmount === 5950, `Expected Final Booking Amount 5950, got ${proformaFin.finalBookingAmount}`);
  assert(proformaFin.amountPaid === 2000, 'Expected Amount Paid 2000');
  assert(proformaFin.balanceDue === 3950, 'Expected Balance Due 3950');
  assert(proformaFin.sourcePricingSnapshotId === 'snap-tub-8841-v2', 'Expected snapshot reference snap-tub-8841-v2');
  assert(proformaFin.internalUnderlyingTaxTotal === 420, 'Internal tax component MUST remain intact in financial model');
  assert(proformaFin.internalUnderlyingServiceFeeTotal === 180, 'Internal service fee component MUST remain intact in financial model');
  console.log('   PASS: Authoritative Final Booking Amount verified & underlying tax/service fee preserved internally.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Full AppDatabase Lifecycle (No Duplicate Records, Versioning, Outdated Flag)
  // --------------------------------------------------------------------------
  console.log('[5/6] Testing AppDatabase Service Sync, Versioning & Post-Confirmation Amendment Lifecycle...');
  const db = AppDatabase.getInstance();
  db.updateCentralCompanyProfile(companyProfile, adminUser);
  db.saveBooking(booking, adminUser);

  const actVoucherRes = db.generateActivityVoucher(booking.id, 'srv-item-teamlab-001', adminUser);
  assert(actVoucherRes.success && actVoucherRes.voucher, `Activity voucher generation failed: ${actVoucherRes.error}`);
  const activityVoucher: BookingVoucher = actVoucherRes.voucher!;
  assert(activityVoucher.isCompleteBookingVoucher === false, 'Activity voucher flag must be false');
  assert(!activityVoucher.vehicleType && !activityVoucher.vehicle, 'Non-transport activity voucher MUST NOT contain vehicle data');

  const compVoucherRes = db.generateBookingVoucher(booking.id, adminUser, true);
  assert(compVoucherRes.success && compVoucherRes.voucher, `Complete voucher generation failed: ${compVoucherRes.error}`);
  const completeVoucher: BookingVoucher = compVoucherRes.voucher!;
  assert(completeVoucher.isCompleteBookingVoucher === true, 'Complete voucher flag must be true');

  const proformaRes = db.generateProformaInvoice(booking.id, adminUser);
  assert(proformaRes.success && proformaRes.invoice, `Proforma invoice generation failed: ${proformaRes.error}`);
  const proformaInvoice: BookingInvoice = {
    ...proformaRes.invoice!,
    bankAccountDetails: {
      bankName: 'HDFC Bank Ltd. (International Trade Desk)',
      accountName: 'TheUnbound Travel Pvt. Ltd.',
      accountNumber: '50200078910452',
      swiftBic: 'HDFCINBBDEL',
      iban: 'IFSC: HDFC0000240'
    }
  };
  assert(proformaInvoice.hideTaxAndServiceFeeBreakdown === true, 'Proforma must set hideTaxAndServiceFeeBreakdown = true');
  assert(proformaInvoice.proformaFinalBookingAmount === 5950, 'Proforma must store authoritative 5950 Final Booking Amount');

  // Check booking linkage & zero duplicate items
  const savedAfterGen = db.getBookingById(booking.id, adminUser)!;
  assert(savedAfterGen.items.length === 5, 'Booking must still have exactly 5 service items (zero duplicates)');
  assert(savedAfterGen.completeVoucherId === completeVoucher.id, 'completeVoucherId must be synced');
  assert(savedAfterGen.completeBookingVoucherId === completeVoucher.id, 'completeBookingVoucherId must be synced');

  // Now simulate a post-confirmation operational change on teamLab (change ticketEntryTime 10:30 AM -> 11:30 AM)
  const amendBookingCopy = db.getBookingById(booking.id, adminUser)!;
  const beforeHistoryLen = (amendBookingCopy.items.find(i => i.id === 'srv-item-teamlab-001')?.allocationHistory || []).length;
  const updateRes = db.updateServiceItem(
    booking.id,
    'srv-item-teamlab-001',
    { ticketEntryTime: '11:30 AM', serviceTime: '11:30 AM' },
    adminUser
  );
  assert(updateRes.success, `updateServiceItem failed: ${updateRes.error}`);
  const afterAmend = db.getBookingById(booking.id, adminUser)!;
  const amendedItem = afterAmend.items.find(i => i.id === 'srv-item-teamlab-001')!;
  assert(afterAmend.items.length === 5, 'Amendment MUST NOT create duplicate service item records');
  assert(
    amendedItem.supplierAllocationStatus === 'Amendment Required' &&
      amendedItem.supplierConfirmationStatus === 'Supplier Reconfirmation Required',
    `Expected Amendment Required / Supplier Reconfirmation Required, got ${amendedItem.supplierAllocationStatus} / ${amendedItem.supplierConfirmationStatus}`
  );
  assert(
    (amendedItem.allocationHistory || []).length > beforeHistoryLen,
    'Prior confirmation must be preserved in allocationHistory'
  );
  assert(
    amendedItem.allocationHistory?.[0]?.previousConfirmationRef === 'TLP-TYO-99241',
    'Prior confirmation ref TLP-TYO-99241 must be preserved in allocationHistory'
  );
  const outdatedActivityVch = (afterAmend.vouchersList || []).find(v => v.id === activityVoucher.id);
  const outdatedCompleteVch = (afterAmend.vouchersList || []).find(v => v.id === completeVoucher.id);
  assert(outdatedActivityVch?.isOutdated === true, 'Affected Activity Voucher MUST be marked isOutdated = true');
  assert(outdatedCompleteVch?.isOutdated === true, 'Affected Complete Voucher MUST be marked isOutdated = true');
  // Confirm financial snapshot was NOT altered by operational time change
  assert(
    (afterAmend as any).taxTotal === 420 &&
      (afterAmend as any).serviceFeeTotal === 180 &&
      afterAmend.totalAmount === 5950,
    'Underlying financial snapshot must remain intact'
  );
  console.log('   PASS: AppDatabase sync, zero duplicates, amendment reconfirmation, allocationHistory preservation & voucher invalidation verified.\n');

  // --------------------------------------------------------------------------
  // TEST 6: Real Vector PDF Generation, Layout Audit & Selectable Text Audit
  // --------------------------------------------------------------------------
  console.log('[6/6] Generating Real Vector PDFs & Running Layout + Text Content Audits...');
  const pdfBooking = buildRealisticMultiServiceBooking();

  // 6A. Activity Voucher PDF (from confirmed booking state)
  const freshActivityVoucher: BookingVoucher = { ...activityVoucher, isOutdated: false };
  const actPdf = generateActivityVoucherPDF(freshActivityVoucher, pdfBooking, companyProfile);
  const actBytes = actPdf.toUint8Array();
  const actPath = path.join(outDir, 'activity-voucher.pdf');
  fs.writeFileSync(actPath, actBytes);
  const actText = extractSelectableTextFromPdf(actBytes);

  assert(Buffer.from(actBytes.slice(0, 5)).toString('ascii') === '%PDF-', 'Activity PDF must start with %PDF-');
  assert(actPdf.layoutAudit.hasOverlap === false, 'Activity PDF must have ZERO overlapping blocks');
  assert(actPdf.layoutAudit.hasClipping === false, 'Activity PDF must have ZERO clipped blocks');
  assert(actPdf.layoutAudit.blankPages.length === 0, 'Activity PDF must have ZERO blank pages');
  assert(actText.includes('ACTIVITY VOUCHER'), 'Activity PDF must contain ACTIVITY VOUCHER badge');
  assert(actText.includes('teamLab Planets TOKYO'), 'Activity PDF must contain service name');
  assert(actText.includes('10:30 AM'), 'Activity PDF must contain ticket entry time 10:30 AM');
  assert(actText.includes('10:00 AM'), 'Activity PDF must contain reporting time 10:00 AM');
  assert(actText.includes('TLP-TYO-99241'), 'Activity PDF must contain supplier confirmation ref');
  assert(actText.includes('3 Adults, 1 Child, 1 Infant'), 'Activity PDF must contain exact passenger breakdown');
  assert(actText.includes('maps.google.com'), 'Activity PDF must contain verified Google Maps link');
  assert(actText.includes('Complimentary secure lockers'), 'Activity PDF must contain inclusions');
  assert(actText.includes('Vegan Ramen UZU'), 'Activity PDF must contain exclusions');
  assert(!actText.includes('Toyota Alphard'), 'Activity PDF must NOT leak vehicle details from other services');
  assert(!actText.includes('Vehicle Type'), 'Non-transport Activity PDF must NOT render Vehicle Type block');
  assert(
    !actText.includes('4,600') &&
      !actText.includes('1,350') &&
      !actText.includes('USD 165') &&
      !actText.includes('$165') &&
      !/nett cost|internal margin/i.test(actText),
    'Activity PDF must NOT leak supplier nett cost or internal margin'
  );
  console.log(`   PASS [Activity Voucher PDF]: ${actPath} (${actBytes.length} bytes, ${actPdf.pageCount} page(s), overlap=${actPdf.layoutAudit.hasOverlap}, clipping=${actPdf.layoutAudit.hasClipping}, blankPages=${actPdf.layoutAudit.blankPages.length})`);

  // 6B. Complete Booking Voucher PDF
  const freshCompleteVoucher: BookingVoucher = { ...completeVoucher, isOutdated: false };
  const compPdf = generateCompleteVoucherPDF(freshCompleteVoucher, pdfBooking, companyProfile);
  const compBytes = compPdf.toUint8Array();
  const compPath = path.join(outDir, 'complete-voucher.pdf');
  fs.writeFileSync(compPath, compBytes);
  const compText = extractSelectableTextFromPdf(compBytes);

  assert(Buffer.from(compBytes.slice(0, 5)).toString('ascii') === '%PDF-', 'Complete PDF must start with %PDF-');
  assert(compPdf.layoutAudit.hasOverlap === false, 'Complete PDF must have ZERO overlapping blocks');
  assert(compPdf.layoutAudit.hasClipping === false, 'Complete PDF must have ZERO clipped blocks');
  assert(compPdf.layoutAudit.blankPages.length === 0, 'Complete PDF must have ZERO blank pages');
  assert(compText.includes('COMPLETE BOOKING VOUCHER'), 'Complete PDF must contain COMPLETE BOOKING VOUCHER badge');
  assert(compText.includes('DAY 1') && compText.includes('DAY 2') && compText.includes('DAY 3'), 'Complete PDF must contain Day 1, Day 2, Day 3 banners');
  assert(compText.indexOf('DAY 1') < compText.indexOf('DAY 2') && compText.indexOf('DAY 2') < compText.indexOf('DAY 3'), 'Complete PDF must order days chronologically');
  assert(compText.indexOf('Haneda Airport Private Luxury Chauffeur Transfer') < compText.indexOf('teamLab Planets TOKYO'), 'Day 1 Transfer must precede Day 3 teamLab in Complete PDF');
  assert(compText.includes('Toyota Alphard Executive Lounge'), 'Complete PDF must include vehicle details for transport service');
  assert(compText.includes('Park Hyatt Tokyo'), 'Complete PDF must include hotel details');
  assert(/Services Pending Supplier Confirmation/i.test(compText), 'Complete PDF must separate pending services');
  assert(compText.includes('Private Kaiseki Geisha Dining Experience in Gion'), 'Complete PDF must list pending dining service clearly');
  assert(!compText.includes('4,600') && !compText.includes('1,350'), 'Complete PDF must NOT leak supplier nett cost or internal margin');
  console.log(`   PASS [Complete Voucher PDF]: ${compPath} (${compBytes.length} bytes, ${compPdf.pageCount} page(s), overlap=${compPdf.layoutAudit.hasOverlap}, clipping=${compPdf.layoutAudit.hasClipping}, blankPages=${compPdf.layoutAudit.blankPages.length})`);

  // 6C. Proforma Invoice PDF
  const profPdf = generateProformaInvoicePDF(proformaInvoice, booking, companyProfile);
  const profBytes = profPdf.toUint8Array();
  const profPath = path.join(outDir, 'proforma-invoice.pdf');
  fs.writeFileSync(profPath, profBytes);
  const profText = extractSelectableTextFromPdf(profBytes);

  assert(Buffer.from(profBytes.slice(0, 5)).toString('ascii') === '%PDF-', 'Proforma PDF must start with %PDF-');
  assert(profPdf.layoutAudit.hasOverlap === false, 'Proforma PDF must have ZERO overlapping blocks');
  assert(profPdf.layoutAudit.hasClipping === false, 'Proforma PDF must have ZERO clipped blocks');
  assert(profPdf.layoutAudit.blankPages.length === 0, 'Proforma PDF must have ZERO blank pages');
  assert(profText.includes('PROFORMA INVOICE'), 'Proforma PDF must clearly show PROFORMA INVOICE');
  assert(profText.includes('FINAL BOOKING AMOUNT'), 'Proforma PDF must show FINAL BOOKING AMOUNT');
  assert(profText.includes('USD 5,950.00'), 'Proforma PDF must display authoritative Final Booking Amount USD 5,950.00');
  assert(profText.includes('USD 2,000.00') && profText.includes('USD 3,950.00'), 'Proforma PDF must display Amount Paid & Balance Due');
  assert(profText.includes('DLF Cyber City') && profText.includes('One Horizon Center'), 'Proforma PDF must display Registered & Current addresses');
  assert(profText.includes('HDFC Bank') && profText.includes('HDFCINBBDEL'), 'Proforma PDF must display configured Bank Wire instructions');
  assert(!/\bGST\b/i.test(profText), 'Proforma PDF must NOT display GST');
  assert(!/Service Fee/i.test(profText), 'Proforma PDF must NOT display Service Fee');
  assert(!/Applicable Tax/i.test(profText), 'Proforma PDF must NOT display Applicable Tax');
  assert(!profText.includes('420.00') && !profText.includes('180.00'), 'Proforma PDF must NOT display separate tax (420) or service fee (180) amounts');
  assert(!profText.includes('4,600') && !profText.includes('1,350'), 'Proforma PDF must NOT expose supplier nett cost or internal margin');
  console.log(`   PASS [Proforma Invoice PDF]: ${profPath} (${profBytes.length} bytes, ${profPdf.pageCount} page(s), overlap=${profPdf.layoutAudit.hasOverlap}, clipping=${profPdf.layoutAudit.hasClipping}, blankPages=${profPdf.layoutAudit.blankPages.length})`);

  console.log('\n=== ALL 6 AUDIT SUITES PASSED SUCCESSFULLY ===');
}

runAudit().catch(err => {
  console.error('\nAUDIT SUITE FAILED:', err);
  process.exit(1);
});
