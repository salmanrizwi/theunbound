import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {
  Booking,
  BookingItem,
  Hotel,
  Product,
  Supplier,
  User
} from '../types';
import {
  buildConfiguredCategoryFilterOptions,
  calculateMarginMetrics,
  distributeConsolidatedCommercialPrice,
  isItemEligibleForNewConsolidatedAllocation,
  matchesCategoryFilter,
  resolveAuthoritativeCategory,
  resolveServiceItemFinancials,
  validateConsolidatedCurrency,
  validateSupplierEligibilityForItems
} from '../services/supplierAllocationEngine';
import {
  formatRichContentForDisplay,
  hydrateBookingServiceItem
} from '../services/bookingOperationsSyncService';
import {
  generateActivityVoucherPDF,
  generateCompleteVoucherPDF
} from '../services/bookingDocumentPdfService';
import { sanitizeBookingForAgent } from '../utils/customerQuoteSanitizer';
import { AppDatabase } from '../services/db';

// Node localStorage shim for AppDatabase
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear()
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

function extractPdfTextAndAudit(pdfBuffer: Uint8Array): {
  pageCount: number;
  fullText: string;
  blankPages: number;
} {
  const buf = Buffer.from(pdfBuffer);
  const raw = buf.toString('latin1');
  const pageMatches = raw.match(/\/Type\s*\/Page\b/g) || [];
  const pageCount = Math.max(1, pageMatches.length);

  const chunks: string[] = [raw];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw)) !== null) {
    const streamData = Buffer.from(match[1], 'latin1');
    try {
      const inflated = zlib.inflateSync(streamData).toString('latin1');
      chunks.push(inflated);
    } catch {
      // Non-flate or image stream
    }
  }

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
  const fullText = extractedTexts.join(' ');
  const blankPages = fullText.trim().length > 0 ? 0 : pageCount;

  return { pageCount, fullText, blankPages };
}

async function runAudit() {
  console.log('========================================================================');
  console.log('SERVICE ITEMS PRICING, CATEGORY FILTER, CONTENT & CONSOLIDATED ALLOCATION AUDIT');
  console.log('========================================================================\n');

  // ------------------------------------------------------------------------
  // 1. PRICING & MARGIN ENGINE TESTS
  // ------------------------------------------------------------------------
  console.log('1. Pricing & Margin Calculation Tests');
  const m1 = calculateMarginMetrics(8000, 10000);
  assert(m1.marginAmount === 2000 && m1.marginPercent === 25, 'Net ₹8,000 / Selling ₹10,000 => Margin ₹2,000 (25%)');

  const mZero = calculateMarginMetrics(0, 10000);
  assert(
    mZero.marginAmount === 10000 && mZero.marginPercent === null && !Number.isNaN(mZero.marginAmount),
    'Zero Net Price handled safely (marginPercent === null, no NaN/Infinity)'
  );

  const mConsol = calculateMarginMetrics(34000, 40000);
  assert(
    mConsol.marginAmount === 6000 && mConsol.marginPercent === 17.65,
    'Consolidated Net ₹34,000 / Commercial ₹40,000 => Margin ₹6,000 (17.65%)'
  );

  // Proportional rounding reconciliation across 3 equal items (₹10,000 / 3)
  const threeEqualItems: BookingItem[] = ['A', 'B', 'C'].map((k, idx) => ({
    id: `SI-EQ-${idx + 1}`,
    productId: `P-EQ-${idx + 1}`,
    productName: `Equal Service ${k}`,
    category: 'Activities',
    travelDate: '2026-10-10',
    adults: 2,
    children: 0,
    infants: 0,
    totalPax: 2,
    netPrice: 3000,
    unitSellingPrice: 2000,
    sellingPrice: 4000,
    totalPrice: 4000,
    currency: 'INR',
    supplierStatus: 'PENDING_DISPATCH'
  }));

  const propDist = distributeConsolidatedCommercialPrice({
    items: threeEqualItems,
    consolidatedCommercialPrice: 10000,
    allocationMethod: 'PROPORTIONAL_NET_COST'
  });
  const propSum = propDist.itemAllocations.reduce((s, a) => s + a.allocatedCommercialPrice, 0);
  assert(
    propDist.valid &&
      propDist.reconciliationDelta === 0 &&
      Math.round(propSum * 100) === 1000000 &&
      propDist.itemAllocations[0].allocatedCommercialPrice === 3333.34 &&
      propDist.itemAllocations[1].allocatedCommercialPrice === 3333.33 &&
      propDist.itemAllocations[2].allocatedCommercialPrice === 3333.33,
    'Proportional distribution cent-exact largest-remainder reconciliation (3333.34 + 3333.33 + 3333.33 = 10000.00)'
  );

  // Manual allocation valid vs invalid mismatch
  const manualValid = distributeConsolidatedCommercialPrice({
    items: threeEqualItems,
    consolidatedCommercialPrice: 10000,
    allocationMethod: 'MANUAL',
    manualAllocations: { 'SI-EQ-1': 5000, 'SI-EQ-2': 3000, 'SI-EQ-3': 2000 }
  });
  assert(
    manualValid.valid && manualValid.reconciliationDelta === 0,
    'Manual allocation exact match accepted (5000 + 3000 + 2000 = 10000)'
  );

  const manualMismatch = distributeConsolidatedCommercialPrice({
    items: threeEqualItems,
    consolidatedCommercialPrice: 10000,
    allocationMethod: 'MANUAL',
    manualAllocations: { 'SI-EQ-1': 5000, 'SI-EQ-2': 3000, 'SI-EQ-3': 1500 }
  });
  assert(
    !manualMismatch.valid && manualMismatch.reconciliationDelta === 500,
    'Manual allocation mismatch rejected with exact variance (500)'
  );

  // Currency mismatch blocker (never assume FX rate = 1)
  const mixedCurrencyItems: BookingItem[] = [
    { ...threeEqualItems[0], currency: 'INR', supplierCurrency: 'INR' },
    { ...threeEqualItems[1], currency: 'USD', supplierCurrency: 'USD' }
  ];
  const currBlocked = validateConsolidatedCurrency(mixedCurrencyItems);
  assert(!currBlocked.valid, 'Currency mismatch (INR + USD) blocked without FX conversion basis');

  const currWithFx = distributeConsolidatedCommercialPrice({
    items: mixedCurrencyItems,
    consolidatedCommercialPrice: 50000,
    allocationMethod: 'PROPORTIONAL_NET_COST',
    authorizedCommonCurrency: 'INR',
    authorizedFxRates: { USD_INR: 85 }
  });
  assert(
    currWithFx.valid && currWithFx.currency === 'INR' && currWithFx.reconciliationDelta === 0,
    'Currency mismatch allowed ONLY with explicit authorized FX rate (USD_INR=85)'
  );

  // ------------------------------------------------------------------------
  // 2. AUTHORITATIVE CATEGORY FILTER TESTS (ALL CATEGORIES)
  // ------------------------------------------------------------------------
  console.log('\n2. Authoritative Product & Hotel Category Filter Tests');

  const testProducts: Product[] = [
    { id: 'P-ACT', name: 'teamLab Planets Tokyo', category: 'Activities', destinationId: 'JP', city: 'Tokyo', adultNetPrice: 3000, sellingPriceStartingFrom: 4500, currency: 'INR', description: 'Immersive digital art museum.', narrative: 'Walk through water and light installations.', overview: 'Timed entry ticket in Toyosu.' } as any,
    { id: 'P-TOUR', name: 'Kyoto Heritage Guided Day Tour', category: 'Private Tours', destinationId: 'JP', city: 'Kyoto', adultNetPrice: 8000, sellingPriceStartingFrom: 10000, currency: 'INR', description: '<p>Full-day heritage circuit.</p><ul><li>Fushimi Inari</li><li>Kinkaku-ji</li></ul>', narrative: '', overview: 'Includes licensed English-speaking guide.' } as any,
    { id: 'P-TRF', name: 'Haneda Airport Private Transfer', category: 'Transfers', destinationId: 'JP', city: 'Tokyo', adultNetPrice: 5000, sellingPriceStartingFrom: 6500, currency: 'INR' } as any,
    { id: 'P-RAIL', name: 'Tokyo to Kyoto Shinkansen Nozomi', category: 'Rail / Shinkansen', destinationId: 'JP', city: 'Tokyo', adultNetPrice: 9000, sellingPriceStartingFrom: 11000, currency: 'INR' } as any,
    { id: 'P-GUIDE', name: 'Licensed Local Kyoto Guide', category: 'Guides', destinationId: 'JP', city: 'Kyoto', adultNetPrice: 4000, sellingPriceStartingFrom: 5500, currency: 'INR' } as any,
    { id: 'P-VISA', name: 'Japan eVisa Processing Assistance', category: 'Visa & Ancillary Services', destinationId: 'JP', city: 'Tokyo', adultNetPrice: 2000, sellingPriceStartingFrom: 3000, currency: 'INR' } as any,
    { id: 'P-YACHT', name: 'Tokyo Bay Private Yacht Charter', category: 'Private Yacht', destinationId: 'JP', city: 'Tokyo', adultNetPrice: 25000, sellingPriceStartingFrom: 32000, currency: 'INR' } as any,
    { id: 'P-FERRY', name: 'Miyajima Scenic Ferry', category: 'Ferries', destinationId: 'JP', city: 'Hiroshima', adultNetPrice: 1500, sellingPriceStartingFrom: 2200, currency: 'INR' } as any,
    { id: 'P-MEAL', name: 'Ginza Kaiseki Dinner', category: 'Lunch / Dinner Restaurant', destinationId: 'JP', city: 'Tokyo', adultNetPrice: 6000, sellingPriceStartingFrom: 8000, currency: 'INR' } as any
  ];

  const testHotels: Hotel[] = [
    { id: 'H-001', name: 'Park Hyatt Tokyo', category: 'Hotels', destinationId: 'JP', city: 'Tokyo', startingNetPrice: 35000, currency: 'INR', description: 'Luxury high-rise hotel in Shinjuku.', overview: 'Breakfast included.' } as any
  ];

  const prodMap = new Map(testProducts.map(p => [p.id, p]));
  const hotelMap = new Map(testHotels.map(h => [h.id, h]));

  const catalogItems: BookingItem[] = [
    ...testProducts.map((p, idx) => ({
      id: `SI-CAT-${idx + 1}`,
      productId: p.id,
      productName: p.name,
      category: 'Legacy Unnormalized Label', // Intentionally stale to verify authoritative Product Management lookup
      travelDate: `2026-11-0${idx + 1}`,
      adults: 2,
      children: 0,
      infants: 0,
      totalPax: 2,
      unitSellingPrice: p.sellingPriceStartingFrom || 0,
      totalPrice: p.sellingPriceStartingFrom || 0,
      currency: 'INR' as const,
      supplierStatus: 'PENDING_DISPATCH' as const
    })),
    {
      id: 'SI-CAT-HOTEL',
      productId: 'H-001',
      hotelId: 'H-001',
      isHotel: true,
      productName: 'Park Hyatt Tokyo',
      category: 'Hotel accommodation',
      travelDate: '2026-11-01',
      adults: 2,
      children: 0,
      infants: 0,
      totalPax: 2,
      unitSellingPrice: 45000,
      totalPrice: 45000,
      currency: 'INR',
      supplierStatus: 'PENDING_DISPATCH'
    }
  ];

  const expectedCategories: Array<{ filterId: string; expectedItemId: string; label: string }> = [
    { filterId: 'ACTIVITY', expectedItemId: 'SI-CAT-1', label: 'Activity' },
    { filterId: 'TOUR', expectedItemId: 'SI-CAT-2', label: 'Tour' },
    { filterId: 'TRANSFER', expectedItemId: 'SI-CAT-3', label: 'Transfer' },
    { filterId: 'RAIL', expectedItemId: 'SI-CAT-4', label: 'Rail' },
    { filterId: 'GUIDE', expectedItemId: 'SI-CAT-5', label: 'Guide' },
    { filterId: 'VISA', expectedItemId: 'SI-CAT-6', label: 'Visa' },
    { filterId: 'YACHT', expectedItemId: 'SI-CAT-7', label: 'Private Yacht' },
    { filterId: 'FERRY', expectedItemId: 'SI-CAT-8', label: 'Ferry' },
    { filterId: 'RESTAURANT', expectedItemId: 'SI-CAT-9', label: 'Meals & Dining' },
    { filterId: 'HOTEL', expectedItemId: 'SI-CAT-HOTEL', label: 'Hotel / Accommodation (Hotel Management)' }
  ];

  for (const tc of expectedCategories) {
    const matched = catalogItems.filter(it =>
      matchesCategoryFilter(
        it,
        tc.filterId,
        prodMap.get(it.productId) || null,
        hotelMap.get(it.hotelId || it.productId) || null
      )
    );
    assert(
      matched.length === 1 && matched[0].id === tc.expectedItemId,
      `Category filter "${tc.label}" matches exactly ${tc.expectedItemId}`
    );
  }

  const allRestored = catalogItems.filter(it => matchesCategoryFilter(it, 'ALL', prodMap.get(it.productId), hotelMap.get(it.hotelId || it.productId)));
  assert(allRestored.length === catalogItems.length, 'Clearing category filter ("ALL") restores all 10 items');

  const filterOpts = buildConfiguredCategoryFilterOptions(catalogItems, prodMap, hotelMap);
  assert(filterOpts.find(o => o.id === 'HOTEL')?.count === 1 && filterOpts.find(o => o.id === 'ACTIVITY')?.count === 1, 'Configured category option counts accurate');

  // ------------------------------------------------------------------------
  // 3. PRODUCT CONTENT MAPPING & HISTORICAL SNAPSHOT TESTS
  // ------------------------------------------------------------------------
  console.log('\n3. Product Content Mapping & Historical Snapshot Tests');

  const richFormatted = formatRichContentForDisplay('<p>First paragraph.</p><ul><li>Bullet A</li><li>Bullet B</li></ul>');
  assert(
    richFormatted.includes('First paragraph.') && richFormatted.includes('- Bullet A') && !richFormatted.includes('<p>'),
    'Rich HTML formatted cleanly into safe plain text preserving bullets & line breaks'
  );

  // Snapshot preserved even when master product changes later
  const snapItem: BookingItem = {
    ...catalogItems[0],
    serviceDescription: 'Historical Description Snapshot v1',
    serviceNarrative: 'Historical Narrative Snapshot v1',
    serviceOverview: 'Historical Overview Snapshot v1'
  };
  const mutatedMasterProduct: Product = {
    ...testProducts[0],
    description: 'NEW EDITED MASTER DESCRIPTION',
    narrative: 'NEW EDITED MASTER NARRATIVE',
    overview: 'NEW EDITED MASTER OVERVIEW'
  };
  const hydratedSnap = hydrateBookingServiceItem(snapItem, null, mutatedMasterProduct, null);
  assert(
    hydratedSnap.resolvedDescription === 'Historical Description Snapshot v1' &&
      hydratedSnap.resolvedNarrative === 'Historical Narrative Snapshot v1' &&
      hydratedSnap.resolvedOverview === 'Historical Overview Snapshot v1',
    'Historical Description/Narrative/Overview snapshot preserved when Master Product is later edited'
  );

  const emptyContentItem: BookingItem = {
    ...catalogItems[2],
    serviceDescription: '',
    serviceNarrative: '',
    serviceOverview: ''
  };
  const hydratedEmpty = hydrateBookingServiceItem(emptyContentItem, null, testProducts[2], null);
  assert(
    hydratedEmpty.resolvedDescription === '' &&
      hydratedEmpty.resolvedNarrative === '' &&
      hydratedEmpty.resolvedOverview === '',
    'All-empty Description/Narrative/Overview stay empty (zero placeholder strings fabricated)'
  );

  // ------------------------------------------------------------------------
  // 4. CONSOLIDATED SUPPLIER ALLOCATION WORKFLOW & DB INTEGRATION TESTS
  // ------------------------------------------------------------------------
  console.log('\n4. Consolidated Supplier Allocation Workflow & Validation Tests');

  const db = AppDatabase.getInstance();
  const adminUser: User = {
    id: 'uid-admin-1',
    name: 'Operations Director',
    displayName: 'Operations Director',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    approvalStatus: 'APPROVED'
  } as any;

  const b2bAgentUser: User = {
    id: 'uid-agent-1',
    name: 'Partner Agent',
    email: 'agent@partner.com',
    role: 'B2B_AGENT',
    approvalStatus: 'APPROVED'
  } as any;

  const eligibleSupplier: Supplier = {
    id: 'SUP-ACTIVITY-PRO',
    name: 'Japan Experiences DMC',
    status: 'ACTIVE',
    categories: ['ACTIVITY', 'TOUR', 'SIGHTSEEING'],
    email: 'ops@japanexperiences.jp',
    phone: '+81 3 5555 0101',
    city: 'Tokyo',
    destination: 'Japan'
  } as any;

  const ineligibleHotelSupplier: Supplier = {
    id: 'SUP-HOTEL-ONLY',
    name: 'Tokyo Luxury Stays Direct',
    status: 'ACTIVE',
    categories: ['HOTEL'],
    email: 'res@tokyostays.jp',
    phone: '+81 3 5555 0199',
    city: 'Tokyo',
    destination: 'Japan'
  } as any;

  // Seed products, suppliers, and booking into localStorage cache via db.setItem
  (db as any).setItem('products', testProducts);
  (db as any).setItem('hotels', testHotels);
  (db as any).setItem('suppliers', [eligibleSupplier, ineligibleHotelSupplier]);
  (db as any).setItem('supplier_allocations', []);

  // Build 5-activity booking (total net = 34,000 INR; consolidated commercial = 40,000 INR)
  const fiveActivities: BookingItem[] = [
    {
      id: 'SI-001',
      productId: 'P-ACT',
      productName: 'teamLab Planets Tokyo',
      category: 'Activities',
      categoryId: 'ACTIVITY',
      destination: 'Japan',
      hub: 'Tokyo',
      serviceDate: '2026-11-10',
      travelDate: '2026-11-10',
      serviceTime: '10:00',
      ticketEntryTime: '10:00',
      adults: 2,
      children: 0,
      infants: 0,
      totalPax: 2,
      netPrice: 6000,
      unitNetPrice: 6000,
      unitSellingPrice: 4000,
      sellingPrice: 8000,
      totalPrice: 8000,
      currency: 'INR',
      serviceDescription: 'Immersive barefoot digital art museum in Toyosu.',
      serviceNarrative: 'Journey across four expansive water and garden realms.',
      serviceOverview: 'Entry window valid 30 mins from ticket slot.',
      supplierStatus: 'PENDING_DISPATCH'
    },
    {
      id: 'SI-002',
      productId: 'P-TOUR',
      productName: 'Kyoto Heritage Guided Day Tour',
      category: 'Private Tours',
      categoryId: 'TOUR',
      destination: 'Japan',
      hub: 'Kyoto',
      serviceDate: '2026-11-11',
      travelDate: '2026-11-11',
      serviceTime: '08:30',
      adults: 2,
      children: 0,
      infants: 0,
      totalPax: 2,
      netPrice: 8000,
      unitNetPrice: 8000,
      unitSellingPrice: 5000,
      sellingPrice: 10000,
      totalPrice: 10000,
      currency: 'INR',
      serviceDescription: 'Guided exploration of Fushimi Inari and Arashiyama.',
      serviceNarrative: '',
      serviceOverview: '',
      supplierStatus: 'PENDING_DISPATCH'
    },
    {
      id: 'SI-003',
      productId: 'P-ACT',
      productName: 'Shibuya Sky Sunset Deck',
      category: 'Activities',
      categoryId: 'ACTIVITY',
      destination: 'Japan',
      hub: 'Tokyo',
      serviceDate: '2026-11-12',
      travelDate: '2026-11-12',
      serviceTime: '17:00',
      ticketEntryTime: '17:00',
      adults: 2,
      children: 0,
      infants: 0,
      totalPax: 2,
      netPrice: 5000,
      unitNetPrice: 5000,
      unitSellingPrice: 3500,
      sellingPrice: 7000,
      totalPrice: 7000,
      currency: 'INR',
      serviceDescription: '',
      serviceNarrative: 'Watch twilight settle over Mount Fuji and Shibuya Crossing.',
      serviceOverview: '',
      supplierStatus: 'PENDING_DISPATCH'
    },
    {
      id: 'SI-004',
      productId: 'P-TOUR',
      productName: 'Nara Deer Park & Todaiji Excursion',
      category: 'Private Tours',
      categoryId: 'TOUR',
      destination: 'Japan',
      hub: 'Nara',
      serviceDate: '2026-11-13',
      travelDate: '2026-11-13',
      serviceTime: '09:30',
      adults: 2,
      children: 0,
      infants: 0,
      totalPax: 2,
      netPrice: 7000,
      unitNetPrice: 7000,
      unitSellingPrice: 4500,
      sellingPrice: 9000,
      totalPrice: 9000,
      currency: 'INR',
      serviceDescription: '',
      serviceNarrative: '',
      serviceOverview: 'Half-day curated excursion with temple admission.',
      supplierStatus: 'PENDING_DISPATCH'
    },
    {
      id: 'SI-005',
      productId: 'P-ACT',
      productName: 'Osaka Castle Cultural Pass',
      category: 'Activities',
      categoryId: 'ACTIVITY',
      destination: 'Japan',
      hub: 'Osaka',
      serviceDate: '2026-11-14',
      travelDate: '2026-11-14',
      serviceTime: '11:00',
      adults: 2,
      children: 0,
      infants: 0,
      totalPax: 2,
      netPrice: 8000,
      unitNetPrice: 8000,
      unitSellingPrice: 5500,
      sellingPrice: 11000,
      totalPrice: 11000,
      currency: 'INR',
      serviceDescription: '',
      serviceNarrative: '',
      serviceOverview: '',
      supplierStatus: 'PENDING_DISPATCH'
    }
  ];

  const booking: Booking = {
    id: 'bk-consol-audit-1',
    bookingReference: 'TUB-2026-CONSOL-001',
    status: 'CONFIRMED',
    currency: 'INR',
    totalAmount: 45000,
    finalCustomerSellingPrice: 45000,
    destination: 'Japan',
    destinationName: 'Japan',
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-15',
    agencyName: 'Aurora Luxury Travel',
    submittingAgentId: 'uid-agent-1',
    customer: {
      name: 'Rohan Mehta',
      leadTravelerName: 'Rohan Mehta',
      email: 'rohan@example.com',
      phone: '+91 98111 00000',
      totalAdults: 2,
      totalChildren: 0,
      totalInfants: 0,
      totalPax: 2
    },
    items: fiveActivities,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as any;

  (db as any).setItem('bookings', [booking]);

  // Security RBAC test: B2B Agent cannot create consolidated allocation
  const agentAttempt = db.createConsolidatedSupplierAllocation(
    {
      bookingId: booking.id,
      serviceItemIds: ['SI-001', 'SI-002'],
      supplierId: eligibleSupplier.id,
      consolidatedCommercialPrice: 18000,
      allocationMethod: 'PROPORTIONAL_NET_COST'
    },
    b2bAgentUser
  );
  assert(!agentAttempt.success, 'B2B Agent blocked from creating consolidated supplier allocation');

  // Ineligible supplier test: Hotel-only supplier blocked for Activity/Tour items
  const ineligCheck = validateSupplierEligibilityForItems(ineligibleHotelSupplier, fiveActivities, prodMap, hotelMap);
  assert(
    !ineligCheck.eligible && ineligCheck.incompatibleItems.length === 5,
    'Hotel-only supplier rejected with all 5 incompatible Activity/Tour items explicitly listed'
  );

  const ineligCreate = db.createConsolidatedSupplierAllocation(
    {
      bookingId: booking.id,
      serviceItemIds: fiveActivities.map(i => i.id),
      supplierId: ineligibleHotelSupplier.id,
      consolidatedCommercialPrice: 40000,
      allocationMethod: 'PROPORTIONAL_NET_COST'
    },
    adminUser
  );
  assert(!ineligCreate.success, 'Database creation blocks ineligible supplier assignment');

  // Create 5-item consolidated allocation with Eligible Supplier (Net ₹34,000, Commercial ₹40,000)
  const createRes = db.createConsolidatedSupplierAllocation(
    {
      bookingId: booking.id,
      serviceItemIds: fiveActivities.map(i => i.id),
      supplierId: eligibleSupplier.id,
      consolidatedCommercialPrice: 40000,
      allocationMethod: 'PROPORTIONAL_NET_COST',
      status: 'SENT_TO_SUPPLIER',
      confirmationRef: 'JP-GRP-2026-771',
      supplierNotes: 'VIP honeymoon guests.',
      internalNotes: 'Negotiated 5-activity bundle rate.',
      idempotencyKey: 'idem-consol-5-items'
    },
    adminUser
  );
  assert(
    createRes.success &&
      Boolean(createRes.allocation) &&
      createRes.allocation!.serviceItemIds?.length === 5 &&
      createRes.allocation!.totalNetCost === 34000 &&
      createRes.allocation!.consolidatedCommercialPrice === 40000 &&
      createRes.allocation!.totalMarginAmount === 6000 &&
      createRes.allocation!.totalMarginPercent === 17.65,
    '5-item Consolidated Supplier Allocation created (Net ₹34,000 / Commercial ₹40,000 / Margin ₹6,000 / 17.65%)'
  );

  // Verify idempotency replay does not create duplicate record
  const idemReplay = db.createConsolidatedSupplierAllocation(
    {
      bookingId: booking.id,
      serviceItemIds: fiveActivities.map(i => i.id),
      supplierId: eligibleSupplier.id,
      consolidatedCommercialPrice: 40000,
      allocationMethod: 'PROPORTIONAL_NET_COST',
      idempotencyKey: 'idem-consol-5-items'
    },
    adminUser
  );
  assert(
    idemReplay.success && idemReplay.allocation!.id === createRes.allocation!.id,
    'Idempotency key prevents duplicate consolidated allocation records'
  );

  // Verify duplicate active allocation blocked with new key
  const dupAttempt = db.createConsolidatedSupplierAllocation(
    {
      bookingId: booking.id,
      serviceItemIds: ['SI-001', 'SI-002'],
      supplierId: eligibleSupplier.id,
      consolidatedCommercialPrice: 18000,
      allocationMethod: 'PROPORTIONAL_NET_COST',
      idempotencyKey: 'idem-dup-attempt'
    },
    adminUser
  );
  assert(!dupAttempt.success, 'Duplicate active allocation blocked for items already in active consolidated allocation');

  // Verify original selling prices untouched & all 5 individual items preserved distinctly
  const afterCreateBooking = db.getBookingById(booking.id, adminUser)!;
  assert(
    afterCreateBooking.items.length === 5 &&
      afterCreateBooking.items.every((it, idx) => it.id === fiveActivities[idx].id && it.totalPrice === fiveActivities[idx].totalPrice),
    'All 5 Service Items remain distinct with original customer selling prices strictly untouched'
  );

  // Verify independent per-item confirmation tracking (confirm ONLY SI-001)
  const partialConfirm = db.updateConsolidatedSupplierAllocation(
    createRes.allocation!.id,
    {
      status: 'AWAITING_CONFIRMATION',
      itemUpdates: [
        {
          serviceItemId: 'SI-001',
          confirmationStatus: 'Supplier Confirmed',
          itemConfirmationRef: 'TLP-CONF-101'
        }
      ],
      applyStatusToAllItems: false,
      note: 'Confirmed teamLab Planets only; awaiting other 4 slots.'
    },
    adminUser
  );
  const afterPartial = partialConfirm.booking!;
  const si1 = afterPartial.items.find(i => i.id === 'SI-001')!;
  const si2 = afterPartial.items.find(i => i.id === 'SI-002')!;
  assert(
    si1.supplierConfirmationStatus === 'Confirmed' &&
      si1.supplierConfirmationRef === 'TLP-CONF-101' &&
      si2.supplierConfirmationStatus !== 'Confirmed',
    'Independent per-item confirmation: confirming SI-001 does NOT falsely confirm SI-002..SI-005'
  );

  // Confirm all 5 items to test post-confirmation amendment & real voucher PDF generation
  const allConfirm = db.updateConsolidatedSupplierAllocation(
    createRes.allocation!.id,
    {
      status: 'CONFIRMED',
      applyStatusToAllItems: true,
      note: 'All 5 activities confirmed by Japan Experiences DMC.'
    },
    adminUser
  );
  assert(
    allConfirm.success && allConfirm.booking!.items.every(i => i.supplierConfirmationStatus === 'Confirmed'),
    'Confirming consolidated allocation with applyStatusToAllItems=true confirms all 5 items cleanly'
  );

  // Verify B2B Agent booking sanitization strips all net cost, margin & consolidated allocation data
  const sanitizedForAgent = sanitizeBookingForAgent(allConfirm.booking!);
  assert(
    sanitizedForAgent.consolidatedAllocations === undefined &&
      sanitizedForAgent.items.every(
        it =>
          it.netPrice === undefined &&
          it.unitNetPrice === undefined &&
          it.allocatedCommercialPrice === undefined &&
          it.consolidatedAllocationId === undefined &&
          it.supplierId === undefined &&
          it.supplierName === undefined
      ),
    'B2B Agent booking sanitizer strips netPrice, allocatedCommercialPrice, consolidatedAllocations & supplier details'
  );

  // ------------------------------------------------------------------------
  // 5. REAL PDF VOUCHER GENERATION & PRIVACY/CONTENT VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n5. Real Activity & Complete Voucher PDF Verification');

  const actVchRes = db.generateActivityVoucher(booking.id, 'SI-001', adminUser, true);
  const compVchRes = db.generateBookingVoucher(booking.id, adminUser, true);
  assert(actVchRes.success && Boolean(actVchRes.voucher), 'Activity Voucher generated for consolidated SI-001');
  assert(compVchRes.success && Boolean(compVchRes.voucher), 'Complete Booking Voucher generated for all 5 consolidated items');

  const refreshedBooking = db.getBookingById(booking.id, adminUser)!;
  const outDir = '/tmp/theunbound-consolidated-pdf-audit';
  fs.mkdirSync(outDir, { recursive: true });

  const actPdfRes = generateActivityVoucherPDF(actVchRes.voucher!, refreshedBooking);
  const compPdfRes = generateCompleteVoucherPDF(compVchRes.voucher!, refreshedBooking);

  const actBytes = actPdfRes.toUint8Array();
  const compBytes = compPdfRes.toUint8Array();
  fs.writeFileSync(path.join(outDir, 'activity-voucher.pdf'), actBytes);
  fs.writeFileSync(path.join(outDir, 'complete-voucher.pdf'), compBytes);

  const actAudit = extractPdfTextAndAudit(actBytes);
  const compAudit = extractPdfTextAndAudit(compBytes);

  assert(
    actPdfRes.pageCount >= 1 &&
      actAudit.blankPages === 0 &&
      !actPdfRes.layoutAudit.hasOverlap &&
      !actPdfRes.layoutAudit.hasClipping &&
      actPdfRes.layoutAudit.blankPages.length === 0,
    `Activity Voucher PDF rendered cleanly (${actPdfRes.pageCount} page(s), overlap=false, clipping=false, blankPages=0)`
  );
  assert(
    actAudit.fullText.includes('Immersive barefoot digital art museum in Toyosu.') &&
      actAudit.fullText.includes('Journey across four expansive water and garden realms.') &&
      actAudit.fullText.includes('Entry window valid 30 mins from ticket slot.'),
    'Activity Voucher PDF renders Description, Itinerary Narrative, and Operational Overview independently'
  );
  assert(
    !actAudit.fullText.includes('34,000') &&
      !actAudit.fullText.includes('40,000') &&
      !actAudit.fullText.includes('17.65') &&
      !actAudit.fullText.toLowerCase().includes('net price') &&
      !actAudit.fullText.toLowerCase().includes('margin'),
    'Activity Voucher PDF leaks ZERO internal net cost, consolidated commercial price, or margin'
  );

  assert(
    compPdfRes.pageCount >= 1 &&
      compAudit.blankPages === 0 &&
      !compPdfRes.layoutAudit.hasOverlap &&
      !compPdfRes.layoutAudit.hasClipping &&
      compPdfRes.layoutAudit.blankPages.length === 0,
    `Complete Booking Voucher PDF rendered cleanly (${compPdfRes.pageCount} page(s), overlap=false, clipping=false, blankPages=0)`
  );
  assert(
    compAudit.fullText.includes('teamLab Planets Tokyo') &&
      compAudit.fullText.includes('Kyoto Heritage Guided Day Tour') &&
      compAudit.fullText.includes('Shibuya Sky Sunset Deck') &&
      compAudit.fullText.includes('Nara Deer Park & Todaiji Excursion') &&
      compAudit.fullText.includes('Osaka Castle Cultural Pass') &&
      compAudit.fullText.includes('Watch twilight settle over Mount Fuji') &&
      compAudit.fullText.includes('Half-day curated excursion with temple admission.'),
    'Complete Voucher PDF includes all 5 consolidated services chronologically with populated Description/Narrative/Overview'
  );
  assert(
    !compAudit.fullText.includes('34,000') &&
      !compAudit.fullText.includes('40,000') &&
      !compAudit.fullText.includes('17.65') &&
      !compAudit.fullText.toLowerCase().includes('margin'),
    'Complete Voucher PDF leaks ZERO internal net cost, consolidated commercial price, or margin'
  );

  // Verify post-confirmation amendment on SI-001 flags Amendment Required on item & consolidated parent
  const amendRes = db.updateServiceItem(
    booking.id,
    'SI-001',
    { serviceDate: '2026-11-15', changeReason: 'Guest requested later date' },
    adminUser
  );
  const allocsAfterAmend = db.getBookingConsolidatedAllocations(booking.id);
  const parentAfterAmend = allocsAfterAmend.find(a => a.id === createRes.allocation!.id)!;
  assert(
    amendRes.success &&
      amendRes.item!.supplierConfirmationStatus === 'Supplier Reconfirmation Required' &&
      parentAfterAmend.status === 'AMENDMENT_REQUIRED' &&
      parentAfterAmend.itemAllocations?.find(a => a.serviceItemId === 'SI-001')?.confirmationStatus === 'Amendment Required',
    'Post-confirmation amendment on consolidated item flags Amendment Required on item & parent allocation with history'
  );

  // Cleanup temp PDF audit files
  fs.rmSync(outDir, { recursive: true, force: true });

  console.log('\n========================================================================');
  console.log(`AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit script threw unexpected error:', err);
  process.exit(1);
});
