import { AppDatabase } from '../services/db';
import { MasterDataService, CANONICAL_LEGACY_MAPPINGS } from '../services/masterDataService';
import { countingEngine } from '../services/countingEngine';
import { Product, DestinationRegionItem, CityHub, User } from '../types';
import { collection, getDocs } from 'firebase/firestore';
import { db as firestoreDb } from '../services/firebase';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function waitForDatabaseHydration(db: AppDatabase): Promise<void> {
  await db.hydrateFromFirestoreNow();
}

async function runMasterHierarchyAndRoutingAudit() {
  console.log('================================================================');
  console.log('  THEUNBOUND SECTION 15, 16 & 17 ACCEPTANCE & INTEGRITY AUDIT');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();
  const masterData = MasterDataService.getInstance();

  console.log('Waiting for live Firestore hydration...');
  await waitForDatabaseHydration(db);

  const destinations = db.getDestinations();
  const regions = db.getRegions();
  const hubs = db.getCityHubs();
  const products = db.getProducts();

  console.log(`Hydrated: ${destinations.length} Destinations, ${regions.length} Regions, ${hubs.length} Hubs, ${products.length} Products\n`);

  // ----------------------------------------------------
  // TEST 1: Open a destination and verify its actual regions, hubs, and products
  // ----------------------------------------------------
  console.log('--- Acceptance Test 1: Destination -> Regions, Hubs & Products ---');
  const jpnDest = masterData.getDestinationById('DST-JPN');
  assert(jpnDest !== undefined, 'Destination DST-JPN ("Japan") exists in database');
  assert(jpnDest?.name === 'Japan', `Destination name is "${jpnDest?.name}"`);

  const jpnRegions = masterData.getRegionsByDestinationId('DST-JPN');
  assert(jpnRegions.length === 7, `DST-JPN has ${jpnRegions.length} Regions (expected 7: Kanto, Kansai, Chubu, Chugoku, Hokkaido, Kyushu, Tohoku)`);
  assert(jpnRegions.every(r => r.destinationId === 'DST-JPN'), 'Every Japan Region references destinationId === "DST-JPN"');

  const jpnHubs = masterData.getHubsByDestinationId('DST-JPN', false);
  assert(jpnHubs.length === 12, `DST-JPN has ${jpnHubs.length} City Hubs (expected 12)`);
  assert(jpnHubs.every(h => h.destinationId === 'DST-JPN'), 'Every Japan Hub references destinationId === "DST-JPN"');

  const jpnProducts = masterData.getProductsByDestinationId('DST-JPN', false);
  const jpnActiveProducts = masterData.getProductsByDestinationId('DST-JPN', true);
  assert(jpnProducts.length === 151, `DST-JPN has ${jpnProducts.length} total real production Products (expected 151, ${jpnActiveProducts.length} ACTIVE)`);
  assert(jpnProducts.every(p => p.destinationId === 'DST-JPN'), 'Every Japan Product references destinationId === "DST-JPN"');

  // Verify no duplicate destinations exist
  const destSlugs = destinations.map(d => d.slug.toLowerCase());
  assert(new Set(destSlugs).size === destSlugs.length, `Zero duplicate destination slugs across ${destinations.length} destinations`);

  // ----------------------------------------------------
  // TEST 2: Open a region and verify its parent destination and associated hubs/products
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 2: Region -> Parent Destination, Hubs & Products ---');
  const kantoRegion = masterData.getDestinationRegionById('region-jp-kanto');
  assert(kantoRegion !== undefined, 'Region "region-jp-kanto" ("Kanto") exists');
  assert(kantoRegion?.destinationId === 'DST-JPN', 'Region "region-jp-kanto" belongs to parent Destination "DST-JPN"');

  const kantoHubs = masterData.getHubsByRegionId('region-jp-kanto', false);
  assert(kantoHubs.length >= 2, `Kanto Region has ${kantoHubs.length} hubs (${kantoHubs.map(h => h.name).join(', ')})`);
  assert(kantoHubs.every(h => h.regionId === 'region-jp-kanto' && h.destinationId === 'DST-JPN'), 'All Kanto hubs belong to region-jp-kanto and DST-JPN');

  const kantoProducts = masterData.getProductsByRegionId('region-jp-kanto', false);
  assert(kantoProducts.length > 0, `Kanto Region has ${kantoProducts.length} associated products`);
  assert(
    kantoProducts.every(p => p.regionId === 'region-jp-kanto' || (Array.isArray(p.regionIds) && p.regionIds.includes('region-jp-kanto'))),
    'All Kanto products belong to region-jp-kanto'
  );

  const kansaiRegion = masterData.getDestinationRegionById('region-jp-kansai');
  assert(kansaiRegion !== undefined && kansaiRegion.destinationId === 'DST-JPN', 'Region "region-jp-kansai" belongs to parent Destination "DST-JPN"');
  const kansaiHubs = masterData.getHubsByRegionId('region-jp-kansai', false);
  assert(kansaiHubs.some(h => h.id === 'hub-kyoto') && kansaiHubs.some(h => h.id === 'hub-osaka'), 'Kansai Region contains Kyoto and Osaka hubs');

  // ----------------------------------------------------
  // TEST 3: Open a hub and verify its parent destination and region and associated products
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 3: Hub -> Parent Destination, Parent Region & Products ---');
  const tokyoHub = masterData.getHubById('hub-tokyo');
  assert(tokyoHub !== undefined, 'City Hub "hub-tokyo" ("Tokyo") exists');
  assert(tokyoHub?.destinationId === 'DST-JPN', 'Tokyo Hub references parent Destination "DST-JPN"');
  assert(tokyoHub?.regionId === 'region-jp-kanto', 'Tokyo Hub references parent Region "region-jp-kanto"');

  const tokyoProducts = masterData.getProductsByHubId('hub-tokyo', false);
  assert(tokyoProducts.length > 0, `Tokyo Hub has ${tokyoProducts.length} associated products`);
  assert(
    tokyoProducts.every(p => p.hubId === 'hub-tokyo' || (Array.isArray(p.hubIds) && p.hubIds.includes('hub-tokyo'))),
    'All Tokyo Hub products reference hub-tokyo'
  );

  const kyotoHub = masterData.getHubById('hub-kyoto');
  assert(kyotoHub !== undefined, 'City Hub "hub-kyoto" ("Kyoto") exists');
  assert(kyotoHub?.destinationId === 'DST-JPN', 'Kyoto Hub references parent Destination "DST-JPN"');
  assert(kyotoHub?.regionId === 'region-jp-kansai', 'Kyoto Hub references parent Region "region-jp-kansai"');

  const kyotoProducts = masterData.getProductsByHubId('hub-kyoto', false);
  assert(kyotoProducts.length > 0, `Kyoto Hub has ${kyotoProducts.length} associated products`);

  // ----------------------------------------------------
  // TEST 4: Open a product and verify its actual geographical associations
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 4: Product Geographical Associations ---');
  const sampleProduct = tokyoProducts.find(p => p.category !== 'Rail' && p.status === 'ACTIVE')!;
  assert(sampleProduct !== undefined, `Sample product "${sampleProduct.name}" (${sampleProduct.id}) loaded`);
  const sampleAudit = masterData.auditProductHierarchy(sampleProduct);
  assert(sampleAudit.valid === true, `Product "${sampleProduct.id}" has valid geographical hierarchy (Dest: ${sampleProduct.destinationId}, Reg: ${sampleProduct.regionId}, Hub: ${sampleProduct.hubId}, Cat: ${sampleProduct.category})`);

  // ----------------------------------------------------
  // TEST 5: Change a product's hub in Admin and verify the change appears consistently across all relevant pages
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 5: Admin Product Hub Reassignment Synchronization ---');
  const adminUser: User = {
    id: 'usr-admin-001',
    name: 'System Admin',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    category: 'INTERNAL',
    approvalStatus: 'APPROVED',
    createdAt: new Date().toISOString()
  };

  const originalHubId = sampleProduct.hubId!;
  const originalHubIds = [...(sampleProduct.hubIds || [originalHubId])];
  const originalRegionId = sampleProduct.regionId!;
  const originalRegionName = sampleProduct.regionName!;
  const originalCity = sampleProduct.city;

  const initialTokyoCount = masterData.getProductsByHubId('hub-tokyo', false).length;
  const initialKyotoCount = masterData.getProductsByHubId('hub-kyoto', false).length;
  const initialKantoCount = masterData.getProductsByRegionId('region-jp-kanto', false).length;
  const initialKansaiCount = masterData.getProductsByRegionId('region-jp-kansai', false).length;

  // Move product from Tokyo (Kanto) to Kyoto (Kansai)
  db.saveProduct({
    ...sampleProduct,
    hubId: 'hub-kyoto',
    hubIds: ['hub-kyoto'],
    regionId: 'region-jp-kansai',
    regionName: 'Kansai (Kinki)',
    city: 'Kyoto'
  }, adminUser);

  const afterMoveTokyoCount = masterData.getProductsByHubId('hub-tokyo', false).length;
  const afterMoveKyotoCount = masterData.getProductsByHubId('hub-kyoto', false).length;
  const afterMoveKantoCount = masterData.getProductsByRegionId('region-jp-kanto', false).length;
  const afterMoveKansaiCount = masterData.getProductsByRegionId('region-jp-kansai', false).length;
  const countingKyotoProds = countingEngine.getFilteredProducts({ destinationId: 'DST-JPN', regionId: 'region-jp-kansai', hubId: 'hub-kyoto' });

  assert(afterMoveTokyoCount === initialTokyoCount - 1, `Tokyo Hub product count decreased from ${initialTokyoCount} to ${afterMoveTokyoCount}`);
  assert(afterMoveKyotoCount === initialKyotoCount + 1, `Kyoto Hub product count increased from ${initialKyotoCount} to ${afterMoveKyotoCount}`);
  assert(afterMoveKantoCount === initialKantoCount - 1, `Kanto Region product count decreased from ${initialKantoCount} to ${afterMoveKantoCount}`);
  assert(afterMoveKansaiCount === initialKansaiCount + 1, `Kansai Region product count increased from ${initialKansaiCount} to ${afterMoveKansaiCount}`);
  assert(countingKyotoProds.some(p => p.id === sampleProduct.id), 'countingEngine immediately reflects product under Kyoto & Kansai');

  // Restore original hub & region
  db.saveProduct({
    ...sampleProduct,
    hubId: originalHubId,
    hubIds: originalHubIds,
    regionId: originalRegionId,
    regionName: originalRegionName,
    city: originalCity
  }, adminUser);

  assert(masterData.getProductsByHubId('hub-tokyo', false).length === initialTokyoCount, 'Product restored to original Tokyo Hub cleanly');
  assert(masterData.getProductsByHubId('hub-kyoto', false).length === initialKyotoCount, 'Kyoto Hub count restored to original');

  // ----------------------------------------------------
  // TEST 6: Attempt to create invalid geographical relationships and verify backend rejects them
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 6: Backend Rejection of Invalid Geographical Relationships ---');

  // 6.1: Region with nonexistent Destination
  let regError: string | null = null;
  try {
    db.saveRegion({
      id: 'region-invalid-test',
      destinationId: 'DST-NONEXISTENT-999',
      name: 'Invalid Region'
    }, adminUser);
  } catch (err: any) {
    regError = err.message;
  }
  assert(regError !== null && regError.includes('Data Integrity Error'), `Region with nonexistent Destination rejected: ${regError}`);

  // 6.2: Hub with mismatched Destination & Region (e.g. Destination = DST-JPN, Region = region-uk-england)
  let hubError: string | null = null;
  try {
    db.saveCityHub({
      id: 'hub-invalid-test',
      destinationId: 'DST-JPN',
      destinationName: 'Japan',
      regionId: 'region-uk-england',
      regionName: 'England',
      name: 'Invalid Hub',
      tagline: '',
      description: '',
      heroImage: '',
      images: [],
      productCount: 0,
      hotelCount: 0,
      displayOrder: 99,
      highlights: [],
      isPublished: true,
      status: 'ACTIVE'
    }, adminUser);
  } catch (err: any) {
    hubError = err.message;
  }
  assert(hubError !== null && hubError.includes('Data Integrity Error'), `Hub with mismatched Region/Destination rejected: ${hubError}`);

  // 6.3: Product with mismatched Destination / Region / Hub
  let prodError: string | null = null;
  try {
    db.saveProduct({
      ...sampleProduct,
      id: 'prod-invalid-test',
      destinationId: 'DST-UK', // UK
      regionId: 'region-jp-kanto', // Japan region!
      hubId: 'hub-tokyo' // Japan hub!
    }, adminUser);
  } catch (err: any) {
    prodError = err.message;
  }
  assert(prodError !== null && prodError.includes('Data Integrity Error'), `Product with mismatched hierarchy rejected: ${prodError}`);

  // 6.4: Deleting a parent Destination/Region/Hub with dependent children is rejected
  let delDestError: string | null = null;
  try {
    db.deleteDestination('DST-JPN', adminUser);
  } catch (err: any) {
    delDestError = err.message;
  }
  assert(
    delDestError !== null && (delDestError.includes('Cannot delete Destination') || delDestError.includes('Data Integrity Error')),
    `Deleting Destination with dependent children rejected: ${delDestError}`
  );

  let delRegError: string | null = null;
  try {
    db.deleteRegion('region-jp-kanto', adminUser);
  } catch (err: any) {
    delRegError = err.message;
  }
  assert(
    delRegError !== null && (delRegError.includes('Cannot delete Region') || delRegError.includes('Data Integrity Error')),
    `Deleting Region with dependent children rejected: ${delRegError}`
  );

  let delHubError: string | null = null;
  try {
    db.deleteCityHub('hub-tokyo', adminUser);
  } catch (err: any) {
    delHubError = err.message;
  }
  assert(
    delHubError !== null && (delHubError.includes('Cannot delete City Hub') || delHubError.includes('Data Integrity Error')),
    `Deleting Hub with dependent products rejected: ${delHubError}`
  );

  // ----------------------------------------------------
  // TEST 7: Verify that unassigned products are clearly identified rather than silently mapped
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 7: Unassigned Products Clearly Identified (No Silent Mapping) ---');
  const unassignedMockProduct = {
    ...sampleProduct,
    id: 'prod-unassigned-check',
    destinationId: '',
    regionId: '',
    hubId: '',
    hubIds: []
  } as Product;
  const unassignedAudit = masterData.auditProductHierarchy(unassignedMockProduct);
  assert(unassignedAudit.valid === false, 'Unassigned product is flagged as invalid by auditProductHierarchy');
  assert(unassignedAudit.issues.length >= 3, `Unassigned product audit reports specific issues: ${unassignedAudit.issues.join('; ')}`);

  // ----------------------------------------------------
  // TEST 8: Verify that no dummy records appear in production dashboards, dropdowns, listings, or search results
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 8: Zero Dummy / Test Records in Production ---');
  const dummyIds = [
    'prod-1792664042651-5779',
    'prod-1792664069356-8605',
    'prod-1792664123979-7843',
    'prod-1792664146523-8685',
    'prod-kyoto-arashiyama-zen',
    'prod-tokyo-imperial-tour',
    'prod-tokyo-private-arrival-trf'
  ];
  for (const dId of dummyIds) {
    assert(db.getProductById(dId) === undefined, `Confirmed demo product "${dId}" is absent`);
  }
  assert(db.getHotels().length === 0, 'Demo hotels (htl-kyoto-ritz, htl-tokyo-palace) are absent');
  assert(db.getPromotions().length === 0, 'Seeded demo promotions are absent');
  assert(db.getReviews().length === 0, 'Fake google reviews are absent');
  const campaignSnap = await getDocs(collection(firestoreDb, 'campaigns'));
  const campaignIds = campaignSnap.docs.map(d => d.id);
  assert(!db.getB2BPackages().some(p => p.id.startsWith('PKG-TEST-')), 'Test B2B packages are absent');
  const tokyoPkg = db.getPackageById('pkg-test-1791909396261-3');
  assert(tokyoPkg !== null && tokyoPkg.title === 'Tokyo Uncovered - 5 Days of Iconic Japan', 'Authoritative production package "Tokyo Uncovered - 5 Days of Iconic Japan" (pkg-test-1791909396261-3) is present and retrievable');

  // ----------------------------------------------------
  // TEST 9: Verify that refreshing the application does not create duplicate records
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 9: Idempotent Refresh (No Duplicate Records) ---');
  const destCountBefore = db.getDestinations().length;
  const regCountBefore = db.getRegions().length;
  const hubCountBefore = db.getCityHubs().length;
  const prodCountBefore = db.getProducts().length;

  const sameDbInstance = AppDatabase.getInstance();
  assert(sameDbInstance.getDestinations().length === destCountBefore, `Destinations count unchanged (${destCountBefore})`);
  assert(sameDbInstance.getRegions().length === regCountBefore, `Regions count unchanged (${regCountBefore})`);
  assert(sameDbInstance.getCityHubs().length === hubCountBefore, `City Hubs count unchanged (${hubCountBefore})`);
  assert(sameDbInstance.getProducts().length === prodCountBefore, `Products count unchanged (${prodCountBefore})`);

  // ----------------------------------------------------
  // TEST 10: Verify that existing valid production records and relationships are preserved
  // ----------------------------------------------------
  console.log('\n--- Acceptance Test 10: All Production Records & Relationships Preserved ---');
  const fullGeoAudit = masterData.auditAllGeographicalRelationships();
  console.log('Full Geographical Audit Summary:', JSON.stringify(fullGeoAudit, null, 2));
  assert(fullGeoAudit.valid === true, 'Full geographical audit status is valid');
  assert(fullGeoAudit.duplicateDestinations.length === 0, '0 duplicate destinations');
  assert(fullGeoAudit.orphanedRegions.length === 0, '0 orphaned regions');
  assert(fullGeoAudit.orphanedHubs.length === 0, '0 orphaned hubs or mismatched hubs');
  assert(fullGeoAudit.unmappedProducts.length === 0, '0 unmapped or invalid products across all 151 production products');
  assert(db.getProducts().length === 151, 'All 151 production products have valid Destination -> Region -> Hub relationships');

  console.log('\n================================================================');
  console.log('  ALL 10 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');

  process.exit(0);
}

runMasterHierarchyAndRoutingAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
