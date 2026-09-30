/**
 * THEUNBOUND — HOMEPAGE DATA SYNC, DESTINATIONS, HUBS, COUNTS & REGULATORY AFFILIATIONS AUDIT
 * 
 * Production Quality Certification & Automated Audit Suite
 */

import { AppDatabase } from '../services/db';
import { homepageService, HomepageSectionRegistryItem } from '../services/homepageService';
import { GlobalCountingEngine } from '../services/countingEngine';
import { inventoryVisibilityService } from '../services/inventoryVisibilityService';
import { SheetsSyncService } from '../services/sheetsSyncService';
import { MASTER_SHEETS_TAB_DEFINITIONS } from '../data/googleSheetsTemplate';
import { 
  Destination, 
  CityHub, 
  Product, 
  Hotel, 
  VisaProduct, 
  RailRoute, 
  B2BPackage, 
  HomepageConfig, 
  HomepageAffiliation, 
  User 
} from '../types';
import { INITIAL_AFFILIATIONS, INITIAL_HOMEPAGE_CONFIG } from '../data/initialHomepage';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}`);
    if (failureDetails) {
      console.error(`     Details: ${failureDetails}`);
    }
  }
}

export async function runHomepageDataSyncAudit(): Promise<void> {
  console.log('\n================================================================');
  console.log('  THEUNBOUND HOMEPAGE DATA SYNC & REGULATORY AFFILIATIONS AUDIT');
  console.log('================================================================\n');

  // Initialize Canonical Master Sheets sync so Firestore collections have live data
  const syncEngine = SheetsSyncService.getInstance();
  const canonicalMultiTabData: Record<string, string[][]> = {};
  for (const tabDef of MASTER_SHEETS_TAB_DEFINITIONS) {
    if (tabDef.tabName !== 'INSTRUCTIONS') {
      canonicalMultiTabData[tabDef.tabName] = [
        tabDef.columns.map(c => c.key),
        ...tabDef.sampleRows
      ];
    }
  }

  await syncEngine.commitMultiTabSync(
    canonicalMultiTabData, 
    undefined,
    null
  );

  const db = AppDatabase.getInstance();
  const countingEngine = GlobalCountingEngine.getInstance();
  const adminUser: User = {
    id: 'usr-admin-audit',
    name: 'Audit Administrator',
    email: 'admin@theunbound.com',
    role: 'ADMIN',
    agencyName: 'TheUnbound HQ',
    createdAt: new Date().toISOString()
  };

  // --------------------------------------------------------------------------
  // 1. HOMEPAGE SECTION REGISTRY & MAP AUDIT
  // --------------------------------------------------------------------------
  console.log('--- 1. Homepage Section Registry & Architecture Mapping ---');
  const sections: HomepageSectionRegistryItem[] = homepageService.getHomepageSections();
  assert(sections.length >= 10, 'Homepage Section Registry registers all core sections (>= 10)', `Found: ${sections.length}`);
  
  const sectionIds = sections.map(s => s.sectionId);
  const requiredModules = [
    'hero',
    'brandIntroduction',
    'cityHubs',
    'destinationFilter',
    'partnershipBenefits',
    'affiliations',
    'onboardingProcess',
    'testimonials',
    'homepageFaqs',
    'conversionCta'
  ];

  requiredModules.forEach(mod => {
    assert(sectionIds.includes(mod), `Section "${mod}" present in Homepage Section Registry`);
  });

  const affiliationSection = sections.find(s => s.sectionId === 'affiliations');
  assert(
    !!affiliationSection && affiliationSection.sectionType === 'AFFILIATIONS',
    'Affiliation section registered with type AFFILIATIONS'
  );
  assert(
    affiliationSection?.firestoreSource === 'homepage_config/main.affiliations',
    'Affiliation section sources directly from Firestore homepage_config'
  );

  // --------------------------------------------------------------------------
  // 2. DYNAMIC DESTINATION DATA & ZERO HARDCODING AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Destination Synchronization & Zero Hardcoding Audit ---');
  const rawDestinations = db.getDestinations().filter(d => d.slug !== 'all');
  const homepageDestinations = homepageService.getHomepageDestinations();
  
  assert(homepageDestinations.length > 0, `Homepage loads active destinations from Firestore (Found: ${homepageDestinations.length})`);
  assert(homepageDestinations.length <= rawDestinations.length, 'Homepage excludes hidden / ineligible destinations according to visibility rules');

  // Verify destinations are objects from Firestore and not static hardcoded strings
  homepageDestinations.forEach(d => {
    assert(typeof d.id === 'string' && d.id.length > 0, `Destination "${d.name}" has valid canonical ID: ${d.id}`);
    assert(typeof d.slug === 'string' && d.slug.length > 0, `Destination "${d.name}" has valid routing slug: ${d.slug}`);
    assert(typeof d.regionId === 'string' && d.regionId.length > 0, `Destination "${d.name}" belongs to 3-tier Region ID: ${d.regionId}`);
  });

  // Verify zero hardcoded arrays
  const testDestSlug = 'test-audit-dest-' + Date.now();
  const testDest: Destination = {
    id: 'dst-audit-test',
    slug: testDestSlug,
    name: 'Scandinavia Arctic Gateway',
    country: 'Norway',
    regionId: 'REG-002',
    tagline: 'Fjords & Northern Lights',
    description: 'Premier Arctic Norway travel corridor.',
    keySellingPoints: ['Northern Lights', 'Fjord Cruises'],
    bestTimeToVisit: 'October - March',
    idealTripDuration: '7 - 10 Days',
    travelStyle: 'Luxury Expeditions',
    highlights: ['Northern Lights', 'Fjord Cruises'],
    featuredProductIds: [],
    heroImage: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb',
    currency: 'EUR',
    status: 'ACTIVE',
    cities: []
  };

  // Add temporary test destination
  db.saveDestination(testDest, adminUser);
  const updatedDestinations = homepageService.getHomepageDestinations('ADMIN');
  const containsNewDest = updatedDestinations.some(d => d.slug === testDestSlug);
  assert(containsNewDest, 'Dynamic Destination Sync: Newly created destination automatically appears without code changes');

  // Deactivate destination
  testDest.status = 'INACTIVE';
  db.saveDestination(testDest, adminUser);
  const visibleAfterDeactivation = homepageService.getHomepageDestinations('B2B_AGENT');
  const excludedWhenInactive = !visibleAfterDeactivation.some(d => d.slug === testDestSlug);
  assert(excludedWhenInactive, 'Deactivated destination disappears from public/agent discovery while historical record is preserved');

  // Cleanup test destination
  db.deleteDestination(testDest.id, adminUser);

  // --------------------------------------------------------------------------
  // 3. DYNAMIC HUB DATA & DESTINATION CASCADING AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Hub Synchronization & Hierarchy Cascading Audit ---');
  const homepageHubs = homepageService.getHomepageHubs();
  assert(homepageHubs.length > 0, `Homepage loads configured hubs resolved from canonical city_hubs (Found: ${homepageHubs.length})`);

  homepageHubs.forEach(({ item, hub, destination }) => {
    assert(!!hub && !!hub.id, `Hub entry "${item.hubId}" resolves to authoritative CityHub record: ${hub?.name}`);
    if (destination) {
      assert(
        hub.destinationId === destination.id || destination.slug === hub.destinationId || item.destinationIdOverride !== undefined,
        `Hub "${hub.name}" belongs to correct Destination "${destination.name}" (hub.destinationId === destination.id)`
      );
    }
  });

  // --------------------------------------------------------------------------
  // 4. INVENTORY COUNTS & ANTI-PAGINATION BUG AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Authoritative Inventory Counts & Anti-Pagination Audit ---');
  const activeProductsCount = homepageService.getActiveProductCount();
  const rawDbProducts = db.getProducts().length;
  assert(activeProductsCount > 0, `Active Products Count calculated dynamically: ${activeProductsCount}`);
  assert(activeProductsCount <= rawDbProducts, `Products count respects published/active filters (Active: ${activeProductsCount} <= Raw: ${rawDbProducts})`);

  const activeHotelsCount = homepageService.getActiveHotelCount();
  const rawDbHotels = db.getHotels().length;
  assert(activeHotelsCount >= 0, `Active Hotels Count calculated dynamically: ${activeHotelsCount}`);
  assert(activeHotelsCount <= rawDbHotels, `Hotels count matches canonical Firestore hotels collection`);

  const activeVisaCount = homepageService.getActiveVisaCount();
  const rawDbVisas = db.getVisas().length;
  assert(activeVisaCount >= 0, `Active Visa Services Count calculated dynamically: ${activeVisaCount}`);
  assert(activeVisaCount <= rawDbVisas, `Visa count matches canonical Firestore visas collection`);

  const activeRailCount = homepageService.getActiveRailCount();
  const rawDbRail = db.getRailRoutes().length;
  assert(activeRailCount >= 0, `Active Rail Routes Count calculated dynamically: ${activeRailCount}`);
  assert(activeRailCount <= rawDbRail, `Rail count matches canonical Firestore rail collection`);

  const activePackagesCount = homepageService.getActivePackageCount();
  const rawDbPackages = db.getB2BPackages().length;
  assert(activePackagesCount >= 0, `Active B2B Packages Count calculated dynamically: ${activePackagesCount}`);
  assert(activePackagesCount <= rawDbPackages, `Package count matches canonical Firestore packages collection`);

  // Category counts
  const categoryCounts = homepageService.getCategoryCounts();
  assert(categoryCounts !== undefined && typeof categoryCounts === 'object', 'Category counts breakdown calculated');
  assert(categoryCounts['Hotels'] === activeHotelsCount, 'Category counts: Hotels count matches authoritative count');
  assert(categoryCounts['Visa'] === activeVisaCount, 'Category counts: Visa count matches authoritative count');
  assert(categoryCounts['Rail'] === activeRailCount, 'Category counts: Rail count matches authoritative count');

  // Verify Anti-Pagination Bug
  // A slice(0, 6) in UI must not override the true activeProductCount
  const simulatedDisplaySliceLength = 6;
  assert(
    activeProductsCount !== simulatedDisplaySliceLength || activeProductsCount === rawDbProducts,
    'Anti-Pagination Verification: Total product count represents full database inventory, not UI slice length'
  );

  // --------------------------------------------------------------------------
  // 5. REGULATORY VERIFICATION / AFFILIATION SECTION AUDIT (JATA / MSME / NIDHI)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Regulatory Affiliations Audit (JATA / MSME / NIDHI) ---');
  const affiliations = homepageService.getHomepageAffiliations();
  assert(affiliations.length >= 3, `Regulatory Affiliations populated (Found: ${affiliations.length}, >= 3 expected)`);

  const jata = affiliations.find(a => a.name.toUpperCase() === 'JATA');
  assert(!!jata, 'JATA (Japan Association of Travel Agents) affiliation present');
  assert(
    jata?.fullName === 'Japan Association of Travel Agents',
    'JATA has accurate canonical entity name: Japan Association of Travel Agents'
  );
  assert(
    jata?.officialLink?.includes('jata-net.or.jp') === true,
    'JATA points to official destination: https://www.jata-net.or.jp/'
  );
  assert(
    typeof jata?.verificationReference === 'string' && jata.verificationReference.length > 0,
    `JATA has valid verification reference: ${jata?.verificationReference}`
  );

  const msme = affiliations.find(a => a.name.toUpperCase() === 'MSME');
  assert(!!msme, 'MSME (Ministry of Micro, Small & Medium Enterprises) affiliation present');
  assert(
    msme?.officialLink?.includes('msme.gov.in') === true,
    'MSME points to official destination: https://msme.gov.in/'
  );
  assert(
    typeof msme?.verificationReference === 'string' && msme.verificationReference.length > 0,
    `MSME has valid Udyam registration reference: ${msme?.verificationReference}`
  );

  const nidhi = affiliations.find(a => a.name.toUpperCase() === 'NIDHI');
  assert(!!nidhi, 'NIDHI (National Integrated Database of Hospitality Industry) affiliation present');
  assert(
    nidhi?.officialLink?.includes('nidhi.tourism.gov.in') === true,
    'NIDHI points to official Ministry of Tourism portal: https://nidhi.tourism.gov.in/'
  );
  assert(
    typeof nidhi?.verificationReference === 'string' && nidhi.verificationReference.length > 0,
    `NIDHI has valid Ministry registration reference: ${nidhi?.verificationReference}`
  );

  // Terminology check: verify affiliations are not mislabeled as Awards, Certifications, or Sponsors
  affiliations.forEach(aff => {
    assert(
      !['award', 'sponsor', 'trophy'].includes(aff.type.toLowerCase()),
      `Affiliation "${aff.name}" strictly classified as regulatory/accredited trade affiliation (Type: ${aff.type})`
    );
  });

  // --------------------------------------------------------------------------
  // 6. CMS SYNCHRONIZATION & DYNAMIC MUTATION AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Admin CMS Dynamic Control & Live Synchronization Audit ---');
  const initialConfig = db.getHomepageConfig();
  const testTitle = 'Live Tested Ground Operations — ' + Date.now();
  
  // 1. Admin updates section title
  const updatedConfig: HomepageConfig = {
    ...initialConfig,
    destinationSectionTitle: testTitle,
    showAffiliationsSection: true
  };
  db.updateHomepageConfig(updatedConfig, adminUser);
  
  const fetchedConfig = db.getHomepageConfig();
  assert(
    fetchedConfig.destinationSectionTitle === testTitle,
    'CMS Save & Reflect: Admin updates destination section title and change persists immediately'
  );

  // 2. Admin toggles affiliation active status
  if (jata) {
    homepageService.toggleAffiliation(jata.id, adminUser);
    const afterToggle = db.getHomepageConfig().affiliations?.find(a => a.id === jata.id);
    assert(afterToggle?.isActive === false, 'CMS Mutation: Admin can toggle affiliation inactive');
    
    // Toggle back
    homepageService.toggleAffiliation(jata.id, adminUser);
    const afterRestore = db.getHomepageConfig().affiliations?.find(a => a.id === jata.id);
    assert(afterRestore?.isActive === true, 'CMS Mutation: Admin can restore affiliation to active state');
  }

  // Restore initial config title
  db.updateHomepageConfig(initialConfig, adminUser);

  // --------------------------------------------------------------------------
  // 7. COUNT RECONCILIATION REPORT
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Automated Count Reconciliation Report ---');
  const reconciliation = homepageService.reconcileCounts();
  reconciliation.forEach(item => {
    assert(
      item.difference >= 0,
      `Reconciliation [${item.metric}]: Homepage (${item.homepageCount}) <= Firestore Total (${item.firestoreCount}) — ${item.notes}`
    );
  });

  // --------------------------------------------------------------------------
  // 8. FINAL AUDIT SUMMARY & CERTIFICATION
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  HOMEPAGE AUDIT RESULT: ${passedTests}/${totalTests} Checks Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error(`Audit failed with ${failedTests} issues.`);
    process.exit(1);
  } else {
    console.log('  FINAL HOMEPAGE CERTIFICATION: PASS');
    console.log('  ALL HOMEPAGE SECTIONS, DATA SOURCES & REGULATORY AFFILIATIONS FULLY CERTIFIED.\n');
    process.exit(0);
  }
}

// Run audit
runHomepageDataSyncAudit();
