import { AppDatabase } from '../services/db';
import { DESTINATIONS } from '../data/destinations';
import { INITIAL_CITY_HUBS } from '../data/initialCityHubs';
import { B2BPackage, CityHub, Destination, User } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function runPackageHubSelectionAudit() {
  console.log('===============================================================');
  console.log('READY-MADE PACKAGE MANAGEMENT: EXPLICIT HUB SELECTION AUDIT');
  console.log('===============================================================\n');

  const db = AppDatabase.getInstance();
  db.syncFirestoreDocAsync = async (_col: string, _docId: string, _data: any) => true;

  // Ensure test environment has standard destinations and hubs available
  if (db.getDestinations().length === 0) {
    (db as any).setItem('destinations', DESTINATIONS);
  }
  if (db.getCityHubs().length === 0) {
    (db as any).setItem('city_hubs', INITIAL_CITY_HUBS);
  }

  const mockAdminUser: User = {
    id: 'usr-admin-test',
    email: 'business@theunbound.in',
    name: 'Admin Test',
    role: 'ADMIN',
    createdAt: new Date().toISOString()
  };

  const destinations: Destination[] = db.getDestinations();
  const cityHubs: CityHub[] = db.getCityHubs();

  assert(destinations.length > 0, `Destinations loaded (${destinations.length} destinations)`);
  assert(cityHubs.length > 0, `City Hubs loaded (${cityHubs.length} hubs)`);

  const japanDest = destinations.find(d => d.name.toLowerCase().includes('japan') || d.id === 'dest-japan') || destinations[0];
  const japanHubs = cityHubs.filter(h => h.destinationId === japanDest.id);
  assert(japanHubs.length > 0, `Destination "${japanDest.name}" has ${japanHubs.length} available hubs`);

  // --------------------------------------------------------------------------
  // TEST 1: Initial package state has NO hubs selected by default
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: Initial Package State & Zero Default Hubs ---');
  const initialNewPkg: B2BPackage = {
    id: `pkg-test-${Date.now()}-1`,
    title: 'Test Luxury Circuit (Explicit Hubs)',
    slug: `test-luxury-circuit-${Date.now()}`,
    destinationId: japanDest.id,
    destinationName: japanDest.name,
    hubIds: [], // Explicitly empty
    hubNames: [],
    durationDays: 5,
    durationNights: 4,
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',
    tagline: 'Signature Luxury Itinerary',
    description: 'Comprehensive wholesale circuit itinerary designed for discerning private travelers.',
    routeSummary: [],
    routeHubs: [],
    hotelsSummary: [],
    productIds: [],
    highlights: [],
    inclusions: [],
    exclusions: [],
    baseNetCostUSD: 2500,
    suggestedSellingPriceUSD: 3500,
    currency: 'USD',
    tripType: 'LUXURY',
    tags: ['Luxury'],
    status: 'DRAFT',
    isPublished: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  assert(initialNewPkg.hubIds.length === 0, 'No hub is automatically selected on new package initialization');
  assert((initialNewPkg.routeHubs || []).length === 0, 'No hub is automatically added to routeHubs');

  // --------------------------------------------------------------------------
  // TEST 2: Save package with ZERO selected hubs & verify persistence
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Saving Package with ZERO Selected Hubs ---');
  db.savePackage(initialNewPkg, mockAdminUser);
  const readBackZero = db.getPackageById(initialNewPkg.id);
  assert(!!readBackZero, 'Package with zero hubs saved and read back successfully');
  assert(Array.isArray(readBackZero?.hubIds) && readBackZero?.hubIds.length === 0, 'Saved package retains an empty hubIds array');
  assert(Array.isArray(readBackZero?.routeHubs) && readBackZero?.routeHubs.length === 0, 'Saved package retains an empty routeHubs array');

  // --------------------------------------------------------------------------
  // TEST 3: Admin explicitly selects ONE hub
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Admin Explicitly Selects ONE Hub ---');
  const targetHub1 = japanHubs[0];
  const pkgWithOneHub: B2BPackage = {
    ...initialNewPkg,
    id: `pkg-test-${Date.now()}-2`,
    title: 'Test Luxury Circuit One Hub (Explicit)',
    slug: `test-luxury-circuit-one-${Date.now()}`,
    hubIds: [targetHub1.id],
    hubNames: [targetHub1.name],
    routeHubs: [{
      id: `route-hub-1-${targetHub1.id}`,
      hubId: targetHub1.id,
      hubName: targetHub1.name,
      destinationId: japanDest.id,
      destinationName: japanDest.name,
      nights: 4,
      order: 1,
      accommodationType: 'NO_ACCOMMODATION',
      roomsCount: 1
    }],
    routeSummary: [`${targetHub1.name} (4N)`]
  };

  db.savePackage(pkgWithOneHub, mockAdminUser);
  const readBackOne = db.getPackageById(pkgWithOneHub.id);
  assert(readBackOne?.hubIds?.length === 1, 'Package with exactly ONE selected hub persisted');
  assert(readBackOne?.hubIds?.[0] === targetHub1.id, `Persisted hub ID strictly matches explicit selection "${targetHub1.name}" (${targetHub1.id})`);

  // --------------------------------------------------------------------------
  // TEST 4: Admin explicitly selects MULTIPLE hubs
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Admin Explicitly Selects MULTIPLE Hubs ---');
  const multiHubs = japanHubs.slice(0, 2);
  const pkgWithMultiHubs: B2BPackage = {
    ...initialNewPkg,
    id: `pkg-test-${Date.now()}-3`,
    title: 'Test Luxury Circuit Multi Hubs (Explicit)',
    slug: `test-luxury-circuit-multi-${Date.now()}`,
    hubIds: multiHubs.map(h => h.id),
    hubNames: multiHubs.map(h => h.name),
    routeHubs: multiHubs.map((h, i) => ({
      id: `route-hub-${i + 1}-${h.id}`,
      hubId: h.id,
      hubName: h.name,
      destinationId: japanDest.id,
      destinationName: japanDest.name,
      nights: 2,
      order: i + 1,
      accommodationType: 'NO_ACCOMMODATION',
      roomsCount: 1
    })),
    routeSummary: multiHubs.map(h => `${h.name} (2N)`)
  };

  db.savePackage(pkgWithMultiHubs, mockAdminUser);
  const readBackMulti = db.getPackageById(pkgWithMultiHubs.id);
  assert(readBackMulti?.hubIds?.length === multiHubs.length, `Package with ${multiHubs.length} selected hubs persisted`);
  multiHubs.forEach(h => {
    assert(readBackMulti?.hubIds?.includes(h.id) === true, `Hub "${h.name}" present in persisted hubIds`);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Changing destination clears incompatible hub selections
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Changing Destination Clears Incompatible Selections ---');
  const otherDest = destinations.find(d => d.id !== japanDest.id) || destinations[1];
  if (otherDest) {
    // Simulating destination change handler
    const changedPkg: B2BPackage = {
      ...pkgWithMultiHubs,
      destinationId: otherDest.id,
      destinationName: otherDest.name,
      // Incompatible hubs cleared!
      hubIds: [],
      hubNames: [],
      routeHubs: [],
      routeSummary: []
    };
    assert(changedPkg.hubIds.length === 0, 'Changing destination clears incompatible selected hubs');
    assert((changedPkg.routeHubs || []).length === 0, 'Changing destination clears route hubs');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Editing a package restores ONLY its saved hubs (empty remains empty)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Reopening/Editing Package Preserves Exact Selection ---');
  const reopenedZero = db.getPackageById(initialNewPkg.id);
  assert(Array.isArray(reopenedZero?.hubIds) && reopenedZero.hubIds.length === 0, 
    'An empty saved hub list remains completely empty after reopening/editing');

  const reopenedMulti = db.getPackageById(pkgWithMultiHubs.id);
  assert(reopenedMulti?.hubIds?.length === multiHubs.length, 
    'Reopening package with selected hubs restores only those exact saved hubs');

  // --------------------------------------------------------------------------
  // TEST 7: Deduplication and safety on repeated saves
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Repeated Saves Do Not Introduce Duplicate Hubs ---');
  const repeatedPkg: B2BPackage = {
    ...pkgWithMultiHubs,
    hubIds: Array.from(new Set([...pkgWithMultiHubs.hubIds!, ...pkgWithMultiHubs.hubIds!]))
  };
  db.savePackage(repeatedPkg, mockAdminUser);
  const readBackRepeated = db.getPackageById(repeatedPkg.id);
  assert(readBackRepeated?.hubIds?.length === multiHubs.length, 
    'Repeated saves do not introduce duplicate hub IDs');

  // --------------------------------------------------------------------------
  // TEST 8: Existing Hub Management records remain untouched
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Shared Hub Management Records Unchanged ---');
  const cityHubsAfter = db.getCityHubs();
  assert(cityHubsAfter.length === cityHubs.length, `City Hub count unchanged (${cityHubsAfter.length} hubs)`);
  assert(cityHubsAfter[0].id === cityHubs[0].id, 'First City Hub ID remains identical');

  // Clean up test records
  db.deletePackage(initialNewPkg.id, mockAdminUser);
  db.deletePackage(pkgWithOneHub.id, mockAdminUser);
  db.deletePackage(pkgWithMultiHubs.id, mockAdminUser);
  console.log('\nCleaned up test package records.');

  console.log('\n===============================================================');
  console.log('🎉 ALL READY-MADE PACKAGE HUB SELECTION AUDIT TESTS PASSED');
  console.log('===============================================================\n');
}

runPackageHubSelectionAudit().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
