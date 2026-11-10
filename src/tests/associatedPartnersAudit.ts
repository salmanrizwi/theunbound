import { AppDatabase } from '../services/db';
import { AssociatedPartner, HomepageConfig } from '../types';
import { INITIAL_HOMEPAGE_CONFIG } from '../data/initialHomepage';
import { CANONICAL_SECTION_DEFINITIONS } from '../components/AdminCMS/HomepageManager';

console.log('================================================================');
console.log('🧪 ASSOCIATED PARTNERS LOGO CAROUSEL & CMS COMPREHENSIVE AUDIT');
console.log('================================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? ` - Details: ${details}` : ''}`);
    throw new Error(`Audit Failure in: ${testName}`);
  }
}

async function runAudit() {
  const db = AppDatabase.getInstance();

  // Test 1: STRICT NO DUMMY DATA in initial config
  console.log('\n--- Test 1: Strict No Dummy Data Verification ---');
  assert(
    Array.isArray(INITIAL_HOMEPAGE_CONFIG.associatedPartners) &&
      INITIAL_HOMEPAGE_CONFIG.associatedPartners.length === 0,
    'INITIAL_HOMEPAGE_CONFIG does not contain fake, sample, or dummy partners',
    `Found length: ${INITIAL_HOMEPAGE_CONFIG.associatedPartners?.length}`
  );
  assert(
    INITIAL_HOMEPAGE_CONFIG.showAssociatedPartners === true,
    'INITIAL_HOMEPAGE_CONFIG has showAssociatedPartners enabled by default'
  );

  // Test 2: Canonical Sequence & Module Order
  console.log('\n--- Test 2: Module Sequence & Canonical Ordering ---');
  assert(
    INITIAL_HOMEPAGE_CONFIG.homepageModuleOrder?.includes('associatedPartners') === true,
    'homepageModuleOrder includes "associatedPartners"'
  );
  const defExists = CANONICAL_SECTION_DEFINITIONS.some(d => d.key === 'associatedPartners');
  assert(defExists, 'CANONICAL_SECTION_DEFINITIONS contains "associatedPartners"');

  // Test 3: AppDatabase CRUD Operations
  console.log('\n--- Test 3: AppDatabase Associated Partners CRUD Operations ---');
  const adminUser: any = {
    id: 'usr-admin-test',
    email: 'business@theunbound.in',
    name: 'Executive Admin',
    role: 'ADMIN'
  };

  const initialPartners = db.getAssociatedPartners();
  assert(Array.isArray(initialPartners), 'db.getAssociatedPartners() returns an array');

  // Create a verified partner
  const testPartner1: AssociatedPartner = {
    id: 'partner-test-airline',
    name: 'All Nippon Airways',
    logoUrl: '/logos/ana_official.png',
    websiteUrl: 'https://www.ana.co.jp/',
    category: 'Airlines & Aviation',
    description: 'Premier 5-star Japanese carrier for domestic and international air dispatches.',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveAssociatedPartner(testPartner1, adminUser);

  const afterCreate = db.getAssociatedPartners();
  const createdAna = afterCreate.find(p => p.id === 'partner-test-airline');
  assert(Boolean(createdAna), 'Saved partner is retrievable via getAssociatedPartners()');
  assert(createdAna?.name === 'All Nippon Airways', 'Partner name persisted accurately');
  assert(createdAna?.websiteUrl === 'https://www.ana.co.jp/', 'Partner website URL persisted');

  // Also verify synced into homepage_config
  const hpConfig = db.getHomepageConfig();
  const hpAna = hpConfig.associatedPartners?.find(p => p.id === 'partner-test-airline');
  assert(Boolean(hpAna), 'Saved partner is synchronized into homepage_config.associatedPartners');

  // Create a second partner (Inactive)
  const testPartner2: AssociatedPartner = {
    id: 'partner-test-hotel',
    name: 'Hoshino Resorts',
    logoUrl: '/logos/hoshino_official.png',
    websiteUrl: 'https://www.hoshinoresorts.com/',
    category: 'Hotel & Hospitality Brands',
    description: 'Luxury ryokan and boutique resort operator.',
    displayOrder: 2,
    isActive: false, // Inactive
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveAssociatedPartner(testPartner2, adminUser);

  // Test 4: Active Filter for Public Homepage
  console.log('\n--- Test 4: Active Filter for Public Carousel Display ---');
  const allPartners = db.getAssociatedPartners(false);
  const activeOnly = db.getAssociatedPartners(true);
  assert(allPartners.length >= 2, 'All partners includes both active and inactive');
  assert(
    activeOnly.some(p => p.id === 'partner-test-airline'),
    'Active list contains active partner'
  );
  assert(
    !activeOnly.some(p => p.id === 'partner-test-hotel'),
    'Active list strictly excludes inactive partner'
  );

  // Test 5: Reordering Partners
  console.log('\n--- Test 5: Partner Sequence Reordering ---');
  db.reorderAssociatedPartners(['partner-test-hotel', 'partner-test-airline'], adminUser);
  const reordered = db.getAssociatedPartners();
  const hotelPartner = reordered.find(p => p.id === 'partner-test-hotel');
  const airlinePartner = reordered.find(p => p.id === 'partner-test-airline');
  assert(hotelPartner?.displayOrder === 1, 'Hoshino Resorts reordered to index 1');
  assert(airlinePartner?.displayOrder === 2, 'ANA reordered to index 2');

  // Clean up test records
  console.log('\n--- Test 6: Safe Deletion & Isolation ---');
  db.deleteAssociatedPartner('partner-test-airline', adminUser);
  db.deleteAssociatedPartner('partner-test-hotel', adminUser);

  const afterDelete = db.getAssociatedPartners();
  assert(
    !afterDelete.some(p => p.id === 'partner-test-airline' || p.id === 'partner-test-hotel'),
    'Test partners cleanly deleted without residue'
  );

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} ASSOCIATED PARTNERS AUDIT TESTS PASSED!`);
  console.log('================================================================\n');
}

runAudit().catch(err => {
  console.error('Fatal error during audit:', err);
  process.exit(1);
});
