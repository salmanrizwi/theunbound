/**
 * THEUNBOUND — B2B DESTINATION VISIBILITY & STRICT ACCESS CONTROL AUDIT SUITE
 *
 * Verifies end-to-end compliance with the absolute business rule:
 *   - Only destinations with authoritative status === 'ACTIVE' are visible/accessible in the B2B Agent Portal.
 *   - COMING_SOON, INACTIVE, DRAFT, ARCHIVED, DISABLED, DELETED, UNPUBLISHED, missing, null, or unknown
 *     statuses are 100% excluded across destinations, hubs, regions, products, rail, transfers,
 *     visas, ancillaries, hotels, packages, search, pagination, and backend APIs (/api/b2b/*).
 *   - Historical finalized quotes and saved drafts are preserved (never stripped or deleted), while
 *     affected drafts are flagged for review and new mutations/bookings on non-active destinations are blocked.
 *   - Admin CMS retains unrestricted visibility regardless of destination status.
 */

import http from 'http';
import express from 'express';
import { AddressInfo } from 'net';
import {
  buildDestinationVisibilityIndex,
  isDestinationStatusActive,
  isDestinationActive,
  isCityHubActiveForB2B,
  isRegionActiveForB2B,
  isProductActiveForB2B,
  isHotelActiveForB2B,
  isTransferRouteActiveForB2B,
  isVisaOrAncillaryActiveForB2B,
  isPackageActiveForB2B,
  paginateAfterEligibility,
  analyzeQuotationDestinationEligibility,
  resolveDestinationIdToken,
} from '../services/destinationVisibility';
import { AppDatabase } from '../services/db';
import { masterDataCache } from '../services/masterDataCache';
import { inventoryVisibilityService } from '../services/inventoryVisibilityService';
import { MasterDataService } from '../services/masterDataService';
import { GlobalCountingEngine } from '../services/countingEngine';
import { isPackageVisibleToB2BAgent } from '../services/packageToQuoteTransformer';
import { createB2BVisibilityRouter, B2BCatalogSnapshot } from '../../server/b2bVisibilityService';
import { Destination, User } from '../types';

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
    console.error(`  ❌ [FAIL] ${testName}`, details !== undefined ? details : '');
  }
}

async function httpJson(
  baseUrl: string,
  method: 'GET' | 'POST',
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runAudit() {
  console.log('================================================================');
  console.log('  THEUNBOUND — B2B DESTINATION VISIBILITY STRICT AUDIT SUITE');
  console.log('================================================================\n');

  // ------------------------------------------------------------------
  // SECTION 1: STRICT STATUS MATRIX & ZERO COMING_SOON LEAKAGE
  // ------------------------------------------------------------------
  console.log('--- 1. Strict Status Matrix & Zero COMING_SOON Leakage ---');

  assert(isDestinationStatusActive('ACTIVE') === true, 'ACTIVE (uppercase) is active');
  assert(isDestinationStatusActive(' active ') === true, 'active (lowercase + whitespace) is active');
  assert(isDestinationStatusActive('Active') === true, 'Active (titlecase) is active');

  const disallowedStatuses = [
    'INACTIVE',
    'COMING_SOON',
    'COMING SOON',
    'DRAFT',
    'ARCHIVED',
    'DISABLED',
    'DELETED',
    'UNPUBLISHED',
    'PUBLISHED', // Destinations strictly require ACTIVE, not PUBLISHED
    'LIVE',
    '',
    null,
    undefined,
    'UNKNOWN_STATE',
  ];

  for (const st of disallowedStatuses) {
    assert(
      isDestinationStatusActive(st as any) === false,
      `Status "${String(st)}" strictly rejected by isDestinationStatusActive`
    );
  }

  const testDests: any[] = [
    { id: 'dest-japan', slug: 'japan', name: 'Japan', country: 'Japan', status: 'ACTIVE', regionId: 'REG-001' },
    { id: 'dest-uk', slug: 'uk', name: 'United Kingdom', country: 'United Kingdom', status: 'ACTIVE', regionId: 'REG-002' },
    { id: 'dest-thailand', slug: 'thailand', name: 'Thailand', country: 'Thailand', status: 'COMING_SOON', regionId: 'REG-004' },
    { id: 'dest-vietnam', slug: 'vietnam', name: 'Vietnam', country: 'Vietnam', status: 'INACTIVE', regionId: 'REG-004' },
    { id: 'dest-bali', slug: 'bali', name: 'Bali & Indonesia', country: 'Indonesia', status: 'DRAFT', regionId: 'REG-004' },
    { id: 'dest-maldives', slug: 'maldives', name: 'Maldives', country: 'Maldives', status: 'ARCHIVED', regionId: 'REG-008' },
    { id: 'dest-korea', slug: 'south-korea', name: 'South Korea', country: 'South Korea', status: 'DISABLED', regionId: 'REG-001' },
    { id: 'dest-singapore', slug: 'singapore', name: 'Singapore', country: 'Singapore', status: 'ACTIVE', isDeleted: true, regionId: 'REG-004' },
    { id: 'dest-uae', slug: 'uae', name: 'Dubai & UAE', country: 'UAE', status: 'ACTIVE', isActive: false, regionId: 'REG-003' },
  ];

  const testHubs: any[] = [
    { id: 'hub-tokyo', slug: 'tokyo', name: 'Tokyo', destinationId: 'dest-japan', destinationName: 'Japan', status: 'ACTIVE' },
    { id: 'hub-london', slug: 'london', name: 'London', destinationId: 'dest-uk', destinationName: 'United Kingdom', status: 'ACTIVE' },
    { id: 'hub-bangkok', slug: 'bangkok', name: 'Bangkok', destinationId: 'dest-thailand', destinationName: 'Thailand', status: 'ACTIVE' },
    { id: 'hub-hanoi', slug: 'hanoi', name: 'Hanoi', destinationId: 'dest-vietnam', destinationName: 'Vietnam', status: 'ACTIVE' },
    { id: 'hub-ubud', slug: 'ubud', name: 'Ubud', destinationId: 'dest-bali', destinationName: 'Bali & Indonesia', status: 'ACTIVE' },
    { id: 'hub-osaka-inactive', slug: 'osaka-temp', name: 'Osaka Temp', destinationId: 'dest-japan', destinationName: 'Japan', status: 'COMING_SOON' },
  ];

  const tombstones = new Set<string>(['dest-singapore']);
  const index = buildDestinationVisibilityIndex(testDests, testHubs, tombstones);

  const eligibleDests = testDests.filter(d => isDestinationActive(d, tombstones));
  assert(
    eligibleDests.length === 2 &&
      eligibleDests.some(d => d.id === 'dest-japan') &&
      eligibleDests.some(d => d.id === 'dest-uk'),
    'Only ACTIVE non-deleted/non-disabled destinations survive (COMING_SOON & INACTIVE excluded)',
    eligibleDests.map(d => `${d.id}:${d.status}`)
  );
  assert(
    !eligibleDests.some(d => d.status === 'COMING_SOON'),
    'Zero COMING_SOON leakage in eligible destinations'
  );
  assert(
    !testDests.some(d => d.id === 'dest-uae' && isDestinationActive(d, tombstones)),
    'Destination with isActive=false excluded even if status says ACTIVE'
  );

  // ------------------------------------------------------------------
  // SECTION 2: CITY HUBS & REGIONS FILTERING
  // ------------------------------------------------------------------
  console.log('\n--- 2. City Hubs & Regions Filtering ---');

  const eligibleHubs = testHubs.filter(h => isCityHubActiveForB2B(h, index, tombstones));
  assert(
    eligibleHubs.length === 2 &&
      eligibleHubs.some(h => h.id === 'hub-tokyo') &&
      eligibleHubs.some(h => h.id === 'hub-london'),
    'Hubs belonging to COMING_SOON/INACTIVE/DRAFT destinations and non-active hubs excluded',
    eligibleHubs.map(h => h.id)
  );
  assert(!isCityHubActiveForB2B(testHubs[2], index, tombstones), 'Bangkok hub excluded when Thailand is COMING_SOON');
  assert(!isCityHubActiveForB2B(testHubs[3], index, tombstones), 'Hanoi hub excluded when Vietnam is INACTIVE');
  assert(!isCityHubActiveForB2B({ id: 'hub-orphan', name: 'Orphan', destinationId: 'dest-unknown', status: 'ACTIVE' }, index), 'Orphan hub fails closed');

  const regionActive = { id: 'reg-kanto', name: 'Kanto', destinationId: 'dest-japan', status: 'ACTIVE' };
  const regionInactiveParent = { id: 'reg-central-tha', name: 'Central Thailand', destinationId: 'dest-thailand', status: 'ACTIVE' };
  assert(isRegionActiveForB2B(regionActive, index) === true, 'Region under ACTIVE destination is visible');
  assert(isRegionActiveForB2B(regionInactiveParent, index) === false, 'Region under COMING_SOON destination is excluded');

  // ------------------------------------------------------------------
  // SECTION 3: PRODUCTS, RAIL, TRANSFERS, TOURS, GUIDES & FERRIES
  // ------------------------------------------------------------------
  console.log('\n--- 3. Products, Transfers & Japan Rail Strict Filtering ---');

  const prodTourTokyo = { id: 'p-tyo-tour', name: 'Tokyo Heritage Tour', category: 'Tours', destinationId: 'dest-japan', hubId: 'hub-tokyo', city: 'Tokyo', status: 'ACTIVE' };
  const prodGuideLondon = { id: 'p-lon-guide', name: 'London Blue Badge Guide', category: 'Guides', destinationId: 'dest-uk', hubId: 'hub-london', city: 'London', status: 'ACTIVE' };
  const prodRailJapan = { id: 'p-jr-shinkansen', name: 'Nozomi Shinkansen Tokyo-Kyoto', category: 'Rail', productType: 'SHINKANSEN', destinationId: 'dest-japan', status: 'ACTIVE' };
  const prodTourBangkok = { id: 'p-bkk-tour', name: 'Bangkok Grand Palace Tour', category: 'Tours', destinationId: 'dest-thailand', hubId: 'hub-bangkok', city: 'Bangkok', status: 'ACTIVE' };
  const prodFerryVietnam = { id: 'p-vn-ferry', name: 'Ha Long Bay Luxury Ferry', category: 'Ferry', destinationId: 'dest-vietnam', city: 'Hanoi', status: 'ACTIVE' };
  const prodYachtBali = { id: 'p-bali-yacht', name: 'Nusa Penida Yacht Charter', category: 'Yacht', destinationId: 'dest-bali', status: 'ACTIVE' };
  const prodDraftJapan = { id: 'p-tyo-draft', name: 'Tokyo Draft Tour', category: 'Tours', destinationId: 'dest-japan', status: 'DRAFT' };
  const prodOrphan = { id: 'p-orphan', name: 'Mystery Tour', category: 'Tours', status: 'ACTIVE' };

  assert(isProductActiveForB2B(prodTourTokyo, index) === true, 'ACTIVE product in ACTIVE Japan is visible');
  assert(isProductActiveForB2B(prodGuideLondon, index) === true, 'ACTIVE guide in ACTIVE UK is visible');
  assert(isProductActiveForB2B(prodRailJapan, index) === true, 'Japan Rail product visible while Japan is ACTIVE');
  assert(isProductActiveForB2B(prodTourBangkok, index) === false, 'Thailand tour excluded when Thailand is COMING_SOON');
  assert(isProductActiveForB2B(prodFerryVietnam, index) === false, 'Vietnam ferry excluded when Vietnam is INACTIVE');
  assert(isProductActiveForB2B(prodYachtBali, index) === false, 'Bali yacht excluded when Bali is DRAFT');
  assert(isProductActiveForB2B(prodDraftJapan, index) === false, 'DRAFT product in ACTIVE destination is excluded');
  assert(isProductActiveForB2B(prodOrphan, index) === false, 'Unmapped orphan product fails closed');

  // Simulate Japan becoming INACTIVE -> Japan Rail must vanish too
  const indexJapanInactive = buildDestinationVisibilityIndex(
    testDests.map(d => (d.id === 'dest-japan' ? { ...d, status: 'INACTIVE' } : d)),
    testHubs,
    tombstones
  );
  assert(
    isProductActiveForB2B(prodRailJapan, indexJapanInactive) === false,
    'Japan Rail / Shinkansen automatically excluded when Japan is marked INACTIVE'
  );

  // Transfer Routes
  const routeJapan = { id: 'tr-1', destinationId: 'dest-japan', fromHubId: 'hub-tokyo', status: 'ACTIVE' };
  const routeThailand = { id: 'tr-2', destinationId: 'dest-thailand', fromHubId: 'hub-bangkok', status: 'ACTIVE' };
  assert(isTransferRouteActiveForB2B(routeJapan, index) === true, 'Transfer route in ACTIVE Japan is visible');
  assert(isTransferRouteActiveForB2B(routeThailand, index) === false, 'Transfer route in COMING_SOON Thailand is excluded');

  // ------------------------------------------------------------------
  // SECTION 4: VISAS & ANCILLARY SERVICES
  // ------------------------------------------------------------------
  console.log('\n--- 4. Visas & Destination Ancillaries Filtering ---');

  const visaJapan = { id: 'v-jpn', country: 'Japan', visaType: 'Single Entry Tourist eVisa', status: 'ACTIVE' };
  const visaThailand = { id: 'v-tha', country: 'Thailand', visaType: 'Thailand Digital TDAC', status: 'ACTIVE' };
  const visaVietnam = { id: 'v-vnm', country: 'Vietnam', visaType: 'Vietnam 30-Day eVisa', status: 'ACTIVE' };
  const globalProtection = { id: 'anc-tp-global', name: 'Executive Multi-Country Protection', coverageArea: 'Global', status: 'ACTIVE' };
  const mixedAncillary = { id: 'anc-sea-sim', name: 'Regional eSIM', applicableDestinations: ['Japan', 'Thailand'], status: 'ACTIVE' };

  assert(isVisaOrAncillaryActiveForB2B(visaJapan, index) === true, 'Japan Visa visible when Japan is ACTIVE');
  assert(isVisaOrAncillaryActiveForB2B(visaThailand, index) === false, 'Thailand Visa hidden when Thailand is COMING_SOON');
  assert(isVisaOrAncillaryActiveForB2B(visaVietnam, index) === false, 'Vietnam Visa hidden when Vietnam is INACTIVE');
  assert(isVisaOrAncillaryActiveForB2B(globalProtection, index) === true, 'Explicitly Global ancillary allowed while active destinations exist');
  assert(
    isVisaOrAncillaryActiveForB2B(mixedAncillary, index) === false,
    'Multi-destination ancillary referencing non-active Thailand is strictly excluded'
  );

  // ------------------------------------------------------------------
  // SECTION 5: HOTELS & RYOKANS (incl. Seed Status 'PUBLISHED')
  // ------------------------------------------------------------------
  console.log('\n--- 5. Hotels & Ryokans Filtering ---');

  const hotelTokyo = { id: 'htl-aman-tyo', name: 'Aman Tokyo', destinationId: 'dest-japan', cityHubId: 'hub-tokyo', status: 'PUBLISHED' };
  const hotelBangkok = { id: 'htl-mo-bkk', name: 'Mandarin Oriental Bangkok', destinationId: 'dest-thailand', cityHubId: 'hub-bangkok', status: 'PUBLISHED' };
  const hotelVietnam = { id: 'htl-han', name: 'Sofitel Metropole Hanoi', country: 'Vietnam', cityName: 'Hanoi', status: 'ACTIVE' };
  const hotelDraftUK = { id: 'htl-lon-draft', name: 'London Draft Hotel', destinationId: 'dest-uk', status: 'DRAFT' };

  assert(isHotelActiveForB2B(hotelTokyo, index) === true, 'PUBLISHED hotel in ACTIVE Japan is visible');
  assert(isHotelActiveForB2B(hotelBangkok, index) === false, 'PUBLISHED hotel in COMING_SOON Thailand is excluded');
  assert(isHotelActiveForB2B(hotelVietnam, index) === false, 'ACTIVE hotel in INACTIVE Vietnam is excluded');
  assert(isHotelActiveForB2B(hotelDraftUK, index) === false, 'DRAFT hotel in ACTIVE UK is excluded');

  // ------------------------------------------------------------------
  // SECTION 6: SINGLE- & MULTI-DESTINATION PACKAGES
  // ------------------------------------------------------------------
  console.log('\n--- 6. Single- & Multi-Destination Packages Filtering ---');

  const pkgJapan = { id: 'pkg-jpn', title: 'Golden Route Japan', destinationId: 'dest-japan', destinationName: 'Japan', hubIds: ['hub-tokyo'], status: 'PUBLISHED' };
  const pkgMultiActiveAndComingSoon = {
    id: 'pkg-jpn-tha',
    title: 'Tokyo + Bangkok Dual Experience',
    destinationId: 'dest-japan',
    destinationIds: ['dest-japan', 'dest-thailand'],
    routeHubs: [{ hubId: 'hub-tokyo', destinationId: 'dest-japan' }, { hubId: 'hub-bangkok', destinationId: 'dest-thailand' }],
    status: 'PUBLISHED',
  };
  const pkgItineraryWithInactiveStop = {
    id: 'pkg-itin-inactive',
    title: 'Asia Heritage Trail',
    destinationId: 'dest-japan',
    itinerary: [
      { day: 1, destinationId: 'dest-japan', city: 'Tokyo' },
      { day: 4, destinationId: 'dest-vietnam', city: 'Hanoi' },
    ],
    status: 'PUBLISHED',
  };

  assert(isPackageActiveForB2B(pkgJapan, index) === true, 'Published package under ACTIVE Japan is visible');
  assert(isPackageActiveForB2B(pkgMultiActiveAndComingSoon, index) === false, 'Multi-destination package touching COMING_SOON Thailand is excluded');
  assert(isPackageActiveForB2B(pkgItineraryWithInactiveStop, index) === false, 'Package whose itinerary visits INACTIVE Vietnam is excluded');

  // ------------------------------------------------------------------
  // SECTION 7: POST-FILTER PAGINATION ACCURACY
  // ------------------------------------------------------------------
  console.log('\n--- 7. Post-Filter Pagination Integrity ---');

  const mixedProducts = [
    prodTourBangkok,
    prodFerryVietnam,
    prodTourTokyo,
    prodYachtBali,
    prodGuideLondon,
    prodRailJapan,
    prodDraftJapan,
  ];
  const page1 = paginateAfterEligibility(mixedProducts, p => isProductActiveForB2B(p, index), 1, 2);
  const page2 = paginateAfterEligibility(mixedProducts, p => isProductActiveForB2B(p, index), 2, 2);
  assert(page1.totalCount === 3, 'Pagination totalCount reflects ONLY eligible active-destination items (3)', page1.totalCount);
  assert(page1.totalPages === 2, 'Pagination totalPages computed strictly post-filter (2)', page1.totalPages);
  assert(page1.items.length === 2 && page1.hasMore === true, 'Page 1 returns exact slice without empty gaps from filtered items');
  assert(page2.items.length === 1 && page2.hasMore === false, 'Page 2 returns remaining eligible item accurately');

  // ------------------------------------------------------------------
  // SECTION 8: REAL-TIME CACHE INVALIDATION & ADMIN CMS PARITY
  // ------------------------------------------------------------------
  console.log('\n--- 8. Real-Time Cache Synchronization & Admin CMS Parity ---');

  const db = AppDatabase.getInstance();
  const masterData = MasterDataService.getInstance();
  const countingEngine = GlobalCountingEngine.getInstance();
  const adminUser: User = {
    id: 'usr-audit-admin',
    name: 'Audit Admin',
    email: 'admin@theunbound.in',
    role: 'ADMIN',
    category: 'INTERNAL',
    approvalStatus: 'APPROVED',
    createdAt: new Date().toISOString(),
  };

  // Seed deterministic records into AppDatabase for isolated Node verification
  const seedJapanDest: Destination = {
    id: 'dest-japan',
    slug: 'japan',
    name: 'Japan',
    country: 'Japan',
    regionId: 'REG-001',
    regionName: 'East Asia',
    status: 'ACTIVE',
    isActive: true,
    isPublished: true,
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',
    tagline: 'Precision & Heritage',
    description: 'Japan DMC Inventory',
    keySellingPoints: [],
    bestTimeToVisit: 'Spring & Autumn',
    idealTripDuration: '10 Days',
    travelStyle: 'Luxury',
    currency: 'JPY',
    highlights: [],
    cities: [],
    regions: [],
  } as any;

  db.saveDestination(seedJapanDest, adminUser);
  db.saveRegion({
    id: 'region-jp-kanto',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    name: 'Kanto (Tokyo & Yokohama)',
    slug: 'kanto',
    status: 'ACTIVE',
  } as any, adminUser);
  db.saveCityHub({
    id: 'hub-tokyo',
    slug: 'tokyo',
    name: 'Tokyo',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    regionId: 'region-jp-kanto',
    status: 'ACTIVE',
  } as any, adminUser);
  db.saveProduct({
    id: 'prod-audit-tyo-1',
    sku: 'TYO-AUD-01',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    country: 'Japan',
    regionId: 'region-jp-kanto',
    city: 'Tokyo',
    hubId: 'hub-tokyo',
    productType: 'Tour',
    category: 'Tours',
    name: 'Audit Tokyo Private Experience',
    shortDescription: 'Private Tour',
    longDescription: 'Private Tour',
    status: 'ACTIVE',
    isPublished: true,
    adultNetPrice: 200,
    childNetPrice: 100,
    infantNetPrice: 0,
    currency: 'USD',
    defaultMarkupPercent: 15,
    taxPercent: 0,
    commissionPercent: 0,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: 230,
  } as any, adminUser);
  db.saveHotel({
    id: 'htl-audit-tyo-1',
    name: 'Audit Aman Tokyo',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    country: 'Japan',
    cityHubId: 'hub-tokyo',
    cityName: 'Tokyo',
    status: 'PUBLISHED',
  } as any, adminUser);
  db.savePackage({
    id: 'pkg-audit-tyo-1',
    title: 'Audit Golden Route Japan',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    hubIds: ['hub-tokyo'],
    status: 'PUBLISHED',
    itinerary: [],
  } as any, adminUser);
  db.saveVisa({
    id: 'visa-audit-jpn-1',
    country: 'Japan',
    destinationId: 'dest-japan',
    visaType: 'Tourist eVisa',
    status: 'ACTIVE',
    sellingPrice: 80,
    currency: 'USD',
  } as any, adminUser);

  const initialDests = db.getDestinations();
  const japanOriginal = initialDests.find(d => resolveDestinationIdToken(d.id, index) === 'dest-japan' || d.name === 'Japan');
  assert(!!japanOriginal, 'AppDatabase seeded with Japan destination');

  if (japanOriginal) {
    const originalStatus = japanOriginal.status;
    let visibilityNotifications = 0;
    const unsubVis = inventoryVisibilityService.subscribe(() => {
      visibilityNotifications++;
    });

    // Ensure ACTIVE baseline
    db.saveDestination({ ...japanOriginal, status: 'ACTIVE' } as Destination, adminUser);
    const activeDestsBefore = inventoryVisibilityService.getB2BActiveDestinations();
    const activeProdsBefore = inventoryVisibilityService.getB2BActiveProducts();
    const japanVisibleBefore = activeDestsBefore.some(d => d.id === japanOriginal.id);
    const japanPkgCheckProd = activeProdsBefore.some(p => p.destinationId === japanOriginal.id || (p.country || '').toLowerCase() === 'japan');
    assert(japanVisibleBefore && japanPkgCheckProd, 'Baseline: ACTIVE Japan & its products visible in B2B InventoryVisibilityService');

    const versionBeforeToggle = masterDataCache.getVersion('destinations');

    // Toggle Japan -> COMING_SOON
    db.saveDestination({ ...japanOriginal, status: 'COMING_SOON' } as Destination, adminUser);
    await new Promise(resolve => setTimeout(resolve, 25));

    const versionAfterToggle = masterDataCache.getVersion('destinations');
    const activeDestsAfter = inventoryVisibilityService.getB2BActiveDestinations();
    const activeProdsAfter = inventoryVisibilityService.getB2BActiveProducts();
    const activeHotelsAfter = inventoryVisibilityService.getB2BActiveHotels();
    const activeHubsAfter = inventoryVisibilityService.getB2BActiveHubs();
    const activePkgsAfter = inventoryVisibilityService.getB2BActivePackages();
    const activeVisasAfter = inventoryVisibilityService.getB2BActiveVisas();

    assert(versionAfterToggle > versionBeforeToggle, 'masterDataCache version incremented immediately on destination status mutation');
    assert(visibilityNotifications > 0, 'inventoryVisibilityService subscribers notified immediately');
    assert(
      !activeDestsAfter.some(d => d.id === japanOriginal.id),
      'Japan immediately excluded from getB2BActiveDestinations() after transition to COMING_SOON'
    );
    assert(
      !activeProdsAfter.some(p => p.destinationId === japanOriginal.id || (p.country || '').toLowerCase() === 'japan'),
      'All Japan products immediately excluded from getB2BActiveProducts()'
    );
    assert(
      !activeHotelsAfter.some(h => h.destinationId === japanOriginal.id || (h.country || '').toLowerCase() === 'japan'),
      'All Japan hotels immediately excluded from getB2BActiveHotels()'
    );
    assert(
      !activeHubsAfter.some(h => h.destinationId === japanOriginal.id || (h.destinationName || '').toLowerCase() === 'japan'),
      'All Japan hubs immediately excluded from getB2BActiveHubs()'
    );
    assert(
      !activePkgsAfter.some(pkg => (pkg.destinationId === japanOriginal.id || (pkg.destinationName || '').toLowerCase() === 'japan') && isPackageVisibleToB2BAgent(pkg)),
      'All Japan packages immediately excluded from B2B package listings'
    );
    assert(
      !activeVisasAfter.some(v => (v.country || '').toLowerCase() === 'japan'),
      'Japan visas immediately excluded from getB2BActiveVisas()'
    );

    // Admin CMS Parity Check: Admin CMS still sees Japan even while COMING_SOON
    const adminAllDests = masterData.getAllDestinations();
    const adminHasJapan = adminAllDests.some(
      d => (d.id === japanOriginal.id || (d as any).legacyId === japanOriginal.id || d.name === 'Japan') && d.status === 'COMING_SOON'
    );
    const adminCounts = countingEngine.getCountsBreakdown({ destinationId: japanOriginal.id, onlyPublished: false });
    const b2bCounts = countingEngine.getCountsBreakdown({ destinationId: japanOriginal.id, onlyPublished: true });

    assert(adminHasJapan === true, 'Admin CMS MasterDataService.getAllDestinations() retains COMING_SOON Japan');
    assert(adminCounts.totalProducts > 0, 'Admin CMS countingEngine (onlyPublished: false) retains full Japan product counts', adminCounts);
    assert(b2bCounts.totalProducts === 0 && b2bCounts.hotels === 0 && b2bCounts.hubs === 0, 'B2B countingEngine (onlyPublished: true) returns 0 for non-active Japan', b2bCounts);

    // Restore Japan to original status (ACTIVE)
    db.saveDestination({ ...japanOriginal, status: originalStatus || 'ACTIVE' } as Destination, adminUser);
    unsubVis();

    const restoredVisible = inventoryVisibilityService.getB2BActiveDestinations().some(d => d.id === japanOriginal.id);
    assert(restoredVisible === true, 'Japan immediately re-appears in B2B Portal when restored to ACTIVE');
  }

  // ------------------------------------------------------------------
  // SECTION 9: HISTORICAL QUOTE PRESERVATION & DRAFT REVIEW DIAGNOSTICS
  // ------------------------------------------------------------------
  console.log('\n--- 9. Historical Quote Preservation & Draft Review Rules ---');

  const finalizedQuote = {
    id: 'qt-hist-001',
    status: 'APPROVED',
    destination: 'Thailand',
    destinationId: 'dest-thailand',
    items: [
      { id: 'qi-1', product: prodTourBangkok, netTotal: 250, sellingTotal: 320 },
    ],
  };

  const draftQuoteAffected = {
    id: 'qt-draft-001',
    status: 'DRAFT',
    destination: 'Thailand',
    destinationId: 'dest-thailand',
    items: [
      { id: 'qi-2', product: prodTourBangkok, netTotal: 250, sellingTotal: 320 },
    ],
  };

  const draftQuoteClean = {
    id: 'qt-draft-002',
    status: 'DRAFT',
    destination: 'Japan',
    destinationId: 'dest-japan',
    items: [
      { id: 'qi-3', product: prodTourTokyo, netTotal: 300, sellingTotal: 380 },
    ],
  };

  const finalizedSnapshotBefore = JSON.stringify(finalizedQuote);
  const finalizedReview = analyzeQuotationDestinationEligibility(finalizedQuote, index);
  const draftReviewAffected = analyzeQuotationDestinationEligibility(draftQuoteAffected, index);
  const draftReviewClean = analyzeQuotationDestinationEligibility(draftQuoteClean, index);

  assert(JSON.stringify(finalizedQuote) === finalizedSnapshotBefore, 'analyzeQuotationDestinationEligibility never mutates or strips historical records');
  assert(finalizedReview.isFinalizedHistorical === true && finalizedReview.requiresReview === true, 'Finalized quote recognized as preserved historical record even if destination later inactive');
  assert(draftReviewAffected.isFinalizedHistorical === false && draftReviewAffected.requiresReview === true, 'Draft quote touching COMING_SOON Thailand flagged with requiresReview=true');
  assert(draftReviewAffected.affectedDestinations.some(d => d.id === 'dest-thailand' && d.status === 'COMING_SOON'), 'Affected draft lists exact non-active destination and status');
  assert(draftReviewClean.requiresReview === false && draftReviewClean.affectedItemIds.length === 0, 'Clean ACTIVE-destination draft passes without review warning');

  // ------------------------------------------------------------------
  // SECTION 10: BACKEND EXPRESS API (/api/b2b/*) ENFORCEMENT
  // ------------------------------------------------------------------
  console.log('\n--- 10. Backend Express API (/api/b2b/*) HTTP Enforcement ---');

  const mockSnapshot: B2BCatalogSnapshot = {
    destinations: testDests,
    hubs: testHubs,
    products: mixedProducts,
    hotels: [hotelTokyo, hotelBangkok, hotelVietnam, hotelDraftUK],
    packages: [pkgJapan, pkgMultiActiveAndComingSoon, pkgItineraryWithInactiveStop],
    visas: [visaJapan, visaThailand, visaVietnam, globalProtection, mixedAncillary],
    tombstones: ['dest-singapore'],
  };

  const app = express();
  app.use(express.json());
  app.use('/api/b2b', createB2BVisibilityRouter(async () => mockSnapshot));

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/b2b`;

  try {
    // Destinations list + pagination
    const rDests = await httpJson(baseUrl, 'GET', '/destinations?page=1&pageSize=10');
    assert(
      rDests.status === 200 &&
        rDests.data.totalCount === 2 &&
        rDests.data.destinations.every((d: any) => d.status === 'ACTIVE'),
      'GET /api/b2b/destinations returns only ACTIVE destinations with accurate post-filter totalCount'
    );

    // Direct destination lookup
    const rDestActive = await httpJson(baseUrl, 'GET', '/destinations/japan');
    const rDestComingSoon = await httpJson(baseUrl, 'GET', '/destinations/thailand');
    const rDestInactive = await httpJson(baseUrl, 'GET', '/destinations/vietnam');
    assert(rDestActive.status === 200 && rDestActive.data.destination.id === 'dest-japan', 'GET /api/b2b/destinations/japan succeeds (200)');
    assert(rDestComingSoon.status === 403 && rDestComingSoon.data.code === 'DESTINATION_NOT_ACTIVE', 'GET /api/b2b/destinations/thailand blocked with 403 DESTINATION_NOT_ACTIVE');
    assert(rDestInactive.status === 403 && rDestInactive.data.code === 'DESTINATION_NOT_ACTIVE', 'GET /api/b2b/destinations/vietnam blocked with 403 DESTINATION_NOT_ACTIVE');

    // Hubs
    const rHubs = await httpJson(baseUrl, 'GET', '/hubs');
    const rHubsThailand = await httpJson(baseUrl, 'GET', '/hubs?destinationId=dest-thailand');
    assert(rHubs.status === 200 && rHubs.data.totalCount === 2, 'GET /api/b2b/hubs excludes hubs of non-active destinations');
    assert(rHubsThailand.status === 200 && rHubsThailand.data.totalCount === 0, 'GET /api/b2b/hubs?destinationId=dest-thailand returns empty');

    // Products + pagination + direct access
    const rProds = await httpJson(baseUrl, 'GET', '/products?page=1&pageSize=2');
    const rProdBangkok = await httpJson(baseUrl, 'GET', '/products/p-bkk-tour');
    const rProdTokyo = await httpJson(baseUrl, 'GET', '/products/p-tyo-tour');
    assert(
      rProds.status === 200 && rProds.data.totalCount === 3 && rProds.data.totalPages === 2 && rProds.data.products.length === 2,
      'GET /api/b2b/products paginates strictly after eligibility filter'
    );
    assert(rProdTokyo.status === 200 && rProdTokyo.data.product.id === 'p-tyo-tour', 'GET /api/b2b/products/p-tyo-tour succeeds');
    assert(rProdBangkok.status === 403 && rProdBangkok.data.code === 'DESTINATION_NOT_ACTIVE', 'GET /api/b2b/products/p-bkk-tour blocked (403)');

    // Hotels
    const rHotels = await httpJson(baseUrl, 'GET', '/hotels');
    const rHotelBkk = await httpJson(baseUrl, 'GET', '/hotels/htl-mo-bkk');
    assert(rHotels.status === 200 && rHotels.data.totalCount === 1 && rHotels.data.hotels[0].id === 'htl-aman-tyo', 'GET /api/b2b/hotels returns only ACTIVE-destination hotels');
    assert(rHotelBkk.status === 403 && rHotelBkk.data.code === 'DESTINATION_NOT_ACTIVE', 'GET /api/b2b/hotels/htl-mo-bkk blocked (403)');

    // Packages
    const rPkgs = await httpJson(baseUrl, 'GET', '/packages');
    const rPkgDual = await httpJson(baseUrl, 'GET', '/packages/pkg-jpn-tha');
    assert(rPkgs.status === 200 && rPkgs.data.totalCount === 1 && rPkgs.data.packages[0].id === 'pkg-jpn', 'GET /api/b2b/packages excludes multi-destination packages touching COMING_SOON');
    assert(rPkgDual.status === 403 && rPkgDual.data.code === 'DESTINATION_NOT_ACTIVE', 'GET /api/b2b/packages/pkg-jpn-tha blocked (403)');

    // Visas
    const rVisas = await httpJson(baseUrl, 'GET', '/visas');
    const rVisaTha = await httpJson(baseUrl, 'GET', '/visas/v-tha');
    assert(
      rVisas.status === 200 &&
        rVisas.data.totalCount === 2 &&
        rVisas.data.visas.every((v: any) => v.id === 'v-jpn' || v.id === 'anc-tp-global'),
      'GET /api/b2b/visas includes active-dest & global ancillaries, excludes COMING_SOON/INACTIVE visas'
    );
    assert(rVisaTha.status === 403 && rVisaTha.data.code === 'DESTINATION_NOT_ACTIVE', 'GET /api/b2b/visas/v-tha blocked (403)');

    // Quote Validation Endpoint
    const rQuoteNewValid = await httpJson(baseUrl, 'POST', '/quotes/validate', {
      mode: 'NEW',
      destinationId: 'dest-japan',
      itemsToAdd: [{ id: 'i1', product: prodTourTokyo }],
    });
    const rQuoteNewBlocked = await httpJson(baseUrl, 'POST', '/quotes/validate', {
      mode: 'NEW',
      destinationId: 'dest-thailand',
      itemsToAdd: [{ id: 'i2', product: prodTourBangkok }],
    });
    const rQuoteHistorical = await httpJson(baseUrl, 'POST', '/quotes/validate', {
      mode: 'FINALIZED',
      quotation: finalizedQuote,
    });
    const rQuoteDraftReview = await httpJson(baseUrl, 'POST', '/quotes/validate', {
      mode: 'DRAFT_REVIEW',
      quotation: draftQuoteAffected,
    });

    assert(rQuoteNewValid.status === 200 && rQuoteNewValid.data.allowed === true, 'POST /quotes/validate allows new quote for ACTIVE Japan');
    assert(
      rQuoteNewBlocked.status === 403 && rQuoteNewBlocked.data.allowed === false && rQuoteNewBlocked.data.code === 'DESTINATION_NOT_ACTIVE',
      'POST /quotes/validate blocks new quote/item for COMING_SOON Thailand (403)'
    );
    assert(
      rQuoteHistorical.status === 200 && rQuoteHistorical.data.allowed === true && rQuoteHistorical.data.preserveHistoricalData === true,
      'POST /quotes/validate preserves historical FINALIZED quotation without stripping'
    );
    assert(
      rQuoteDraftReview.status === 200 &&
        rQuoteDraftReview.data.preserveHistoricalData === true &&
        rQuoteDraftReview.data.review?.requiresReview === true,
      'POST /quotes/validate flags affected DRAFT for review while preserving data'
    );
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }

  console.log('\n================================================================');
  console.log(`  AUDIT SUMMARY: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit execution error:', err);
  process.exit(1);
});
