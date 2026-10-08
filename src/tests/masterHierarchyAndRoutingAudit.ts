import { AppDatabase } from '../services/db';
import { MasterDataService, CANONICAL_LEGACY_MAPPINGS } from '../services/masterDataService';
import { Product, MasterRegion, Destination, CityHub, User } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

async function runMasterHierarchyAndRoutingAudit() {
  console.log('================================================================');
  console.log('  THEUNBOUND MASTER REGION / DESTINATION / HUB INTEGRITY AUDIT');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();
  const masterData = MasterDataService.getInstance();
  
  const regions = masterData.getActiveRegions();
  const destinations = masterData.getActiveDestinations();
  const hubs = masterData.getActiveHubs();
  const products = db.getProducts();

  assert(regions.length >= 4, `Master Regions count is ${regions.length} (>= 4 expected)`);
  assert(destinations.length >= 5, `Destinations count is ${destinations.length} (>= 5 expected)`);
  assert(hubs.length >= 10, `City Hubs count is ${hubs.length} (>= 10 expected)`);
  assert(products.length > 0, `Products count is ${products.length} (> 0 expected)`);

  // ----------------------------------------------------
  // 2. CANONICAL RECORD INTEGRITY AUDIT
  // ----------------------------------------------------
  console.log('\n--- 2. Canonical Master Data IDs & Structure ---');
  const jpnRegion = masterData.getRegionById('REG-001');
  assert(jpnRegion !== undefined, 'Canonical East Asia Region (REG-001) exists');
  assert(Boolean(jpnRegion?.code), 'Region REG-001 has valid code');

  const jpnDest = masterData.getDestinationById('DST-JPN');
  assert(jpnDest !== undefined, 'Canonical Japan Destination (DST-JPN) exists');
  assert(jpnDest?.regionId === 'REG-001', 'Destination DST-JPN belongs to Region REG-001');

  const tyoHub = masterData.getHubById('HUB-TYO');
  assert(tyoHub !== undefined, 'Canonical Tokyo City Hub (HUB-TYO) exists');
  assert(tyoHub?.destinationId === 'DST-JPN', 'City Hub HUB-TYO belongs to Destination DST-JPN');

  // ----------------------------------------------------
  // 3. STRICT 3-TIER HIERARCHY VALIDATION (Section 12, 25 & 32)
  // ----------------------------------------------------
  console.log('\n--- 3. Strict 3-Tier Hierarchy Validator Tests ---');

  // Test 3.1: Valid 3-Tier hierarchy
  const validCheck = masterData.validateHierarchy('REG-001', 'DST-JPN', 'HUB-TYO');
  assert(validCheck.valid === true, 'Valid 3-Tier Hierarchy (REG-001 -> DST-JPN -> HUB-TYO) passes validation');
  assert(validCheck.region?.id === 'REG-001', 'Validator resolves canonical Region');
  assert(validCheck.destination?.id === 'DST-JPN', 'Validator resolves canonical Destination');
  assert(validCheck.hub?.id === 'HUB-TYO', 'Validator resolves canonical City Hub');

  // Test 3.2: Invalid Region
  const invalidRegCheck = masterData.validateHierarchy('REG-UNKNOWN-999', 'DST-JPN', 'HUB-TYO');
  assert(invalidRegCheck.valid === false, 'Invalid Region ID is rejected');
  assert(invalidRegCheck.code === 'INVALID_REGION', 'Rejection code is INVALID_REGION');

  // Test 3.3: Invalid Destination
  const invalidDestCheck = masterData.validateHierarchy('REG-001', 'DST-UNKNOWN-999', 'HUB-TYO');
  assert(invalidDestCheck.valid === false, 'Invalid Destination ID is rejected');
  assert(invalidDestCheck.code === 'INVALID_DESTINATION', 'Rejection code is INVALID_DESTINATION');

  // Test 3.4: Invalid Hub
  const invalidHubCheck = masterData.validateHierarchy('REG-001', 'DST-JPN', 'HUB-UNKNOWN-999');
  assert(invalidHubCheck.valid === false, 'Invalid Hub ID is rejected');
  assert(invalidHubCheck.code === 'INVALID_HUB', 'Rejection code is INVALID_HUB');

  // Test 3.5: Destination / Region Mismatch
  // Destination DST-UK (Western Europe REG-002) paired with East Asia (REG-001)
  const mismatchDestCheck = masterData.validateHierarchy('REG-001', 'DST-UK', 'HUB-LON');
  assert(mismatchDestCheck.valid === false, 'Destination/Region mismatch is strictly rejected');
  assert(mismatchDestCheck.code === 'DESTINATION_REGION_MISMATCH', 'Rejection code is DESTINATION_REGION_MISMATCH');

  // Test 3.6: Hub / Destination Mismatch
  // Hub HUB-LON (UK) paired with Destination DST-JPN (Japan)
  const mismatchHubCheck = masterData.validateHierarchy('REG-001', 'DST-JPN', 'HUB-LON');
  assert(mismatchHubCheck.valid === false, 'Hub/Destination mismatch is strictly rejected');
  assert(mismatchHubCheck.code === 'HUB_DESTINATION_MISMATCH', 'Rejection code is HUB_DESTINATION_MISMATCH');

  // ----------------------------------------------------
  // 4. CASCADING ISOLATION (Sections 13, 33 & 34)
  // ----------------------------------------------------
  console.log('\n--- 4. Cascading Filtering & Parent-Child Isolation ---');

  const eastAsiaDests = masterData.getDestinationsByRegionId('REG-001');
  assert(eastAsiaDests.length > 0, 'East Asia returns destinations');
  assert(eastAsiaDests.every(d => d.regionId === 'REG-001'), 'All East Asia destinations have regionId === REG-001');
  assert(!eastAsiaDests.some(d => d.id === 'DST-UK' || d.id === 'DST-FRA'), 'Zero European destinations leak into East Asia');

  const jpnHubs = masterData.getHubsByDestinationId('DST-JPN');
  assert(jpnHubs.length >= 4, `Japan returns ${jpnHubs.length} hubs (>= 4 expected: Tokyo, Kyoto, Osaka, Hakone)`);
  assert(jpnHubs.every(h => h.destinationId === 'DST-JPN'), 'All Japan hubs have destinationId === DST-JPN');
  assert(!jpnHubs.some(h => h.id === 'HUB-LON' || h.id === 'HUB-PAR'), 'Zero European hubs leak into Japan');

  // Empty query returns empty array (no guessing/all leakage)
  const emptyRegionDests = masterData.getDestinationsByRegionId('');
  assert(emptyRegionDests.length === 0, 'Blank regionId returns 0 destinations (no auto-guessing)');

  const emptyDestHubs = masterData.getHubsByDestinationId('');
  assert(emptyDestHubs.length === 0, 'Blank destinationId returns 0 hubs (no auto-guessing)');

  // ----------------------------------------------------
  // 5. DATABASE PRODUCT SAVE TRANSACTIONS (Sections 24, 25 & 36)
  // ----------------------------------------------------
  console.log('\n--- 5. Database Product Save Governance & Rejections ---');

  const adminUser: User = {
    id: 'usr-admin-001',
    name: 'Marcus Vance',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    category: 'INTERNAL',
    approvalStatus: 'APPROVED',
    createdAt: new Date().toISOString()
  };

  // Test 5.1: Save Product with Valid Hierarchy
  const testValidProd = {
    id: 'prod-test-valid-01',
    sku: 'UB-TEST-VALID',
    name: 'Kyoto Imperial Palace Morning Tour',
    productType: 'Private Tour',
    category: 'Private Tours',
    subcategory: 'Cultural Tour',
    regionId: 'REG-001',
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    hubId: 'HUB-KYO',
    city: 'Kyoto',
    country: 'Japan',
    duration: '4 Hours',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    operatingHours: '09:00 - 13:00',
    adultNetPrice: 35000,
    childNetPrice: 15000,
    infantNetPrice: 0,
    currency: 'JPY',
    nativeCurrency: 'JPY',
    supplierId: 'sup-01',
    supplierName: 'Kyoto Ground Ops',
    supplierProductCode: 'KGO-01',
    shortDescription: 'Palace tour with private docent',
    longDescription: 'Palace tour with private docent',
    status: 'ACTIVE'
  } as unknown as Product;

  db.saveProduct(testValidProd, adminUser);
  const savedProd = db.getProductById('prod-test-valid-01');
  assert(savedProd !== undefined, 'Valid product saved successfully');
  assert(savedProd?.regionId === 'REG-001', 'Product persisted canonical regionId (REG-001)');
  assert(savedProd?.destinationId === 'DST-JPN', 'Product persisted canonical destinationId (DST-JPN)');
  assert(savedProd?.hubId === 'HUB-KYO', 'Product persisted canonical hubId (HUB-KYO)');

  // Test 5.2: Save Product with Invalid Hierarchy (Should THROW Error)
  const testInvalidProd: Product = {
    ...testValidProd,
    id: 'prod-test-invalid-01',
    sku: 'UB-TEST-INVALID',
    regionId: 'REG-001',      // East Asia
    destinationId: 'DST-UK',   // UK (Western Europe) -> Mismatch!
    hubId: 'HUB-KYO'          // Kyoto (Japan) -> Mismatch!
  };

  let caughtError: string | null = null;
  try {
    db.saveProduct(testInvalidProd, adminUser);
  } catch (err: any) {
    caughtError = err.message;
  }
  assert(caughtError !== null, 'Database strictly rejects product save with invalid hierarchy');
  assert(caughtError?.includes('Data Integrity Error'), 'Error message identifies Data Integrity Error');

  // ----------------------------------------------------
  // 6. EXPLICIT LEGACY CODE MAPPINGS (Section 30)
  // ----------------------------------------------------
  console.log('\n--- 6. Explicit Legacy Mapping Table Verification ---');
  assert(CANONICAL_LEGACY_MAPPINGS['reg-east-asia']?.canonicalId === 'REG-001', 'reg-east-asia maps explicitly to REG-001');
  assert(CANONICAL_LEGACY_MAPPINGS['dest-japan']?.canonicalId === 'DST-JPN', 'dest-japan maps explicitly to DST-JPN');
  assert(CANONICAL_LEGACY_MAPPINGS['hub-tokyo']?.canonicalId === 'HUB-TYO', 'hub-tokyo maps explicitly to HUB-TYO');
  assert(CANONICAL_LEGACY_MAPPINGS['hub-kyoto']?.canonicalId === 'HUB-KYO', 'hub-kyoto maps explicitly to HUB-KYO');

  // Resolution through MasterDataService
  const legacyResolvedDest = masterData.getDestinationById('dest-japan');
  assert(legacyResolvedDest?.id === 'DST-JPN', 'getDestinationById("dest-japan") resolves to DST-JPN');

  const legacyResolvedHub = masterData.getHubById('hub-tokyo');
  assert(legacyResolvedHub?.id === 'HUB-TYO', 'getHubById("hub-tokyo") resolves to HUB-TYO');

  // ----------------------------------------------------
  // 7. CLEANUP & REGRESSION INTEGRITY
  // ----------------------------------------------------
  console.log('\n--- 7. Cleanup & Audit Summary ---');
  db.deleteProduct('prod-test-valid-01', adminUser);
  assert(db.getProductById('prod-test-valid-01') === undefined, 'Test product cleaned up cleanly');

  console.log('\n================================================================');
  console.log('  HIERARCHY & ROUTING AUDIT COMPLETE: ALL CHECKS PASSED');
  console.log('================================================================\n');

  process.exit(0);
}

runMasterHierarchyAndRoutingAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
