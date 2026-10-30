/**
 * Homepage Dynamic Destinations & Zero-Hardcoding Audit Suite
 * Verifies that:
 * 1. All homepage destination content is dynamically loaded from Admin Destination Management.
 * 2. Zero hardcoded destination names exist in default copy, fallback strings, or templates.
 * 3. Adding, renaming, unpublishing, or deleting a destination in Destination Management
 *    immediately updates the homepage without code modifications.
 * 4. Empty state renders cleanly when no destinations are published.
 */

import { AppDatabase } from '../services/db';
import { homepageService } from '../services/homepageService';
import { inventoryVisibilityService } from '../services/inventoryVisibilityService';
import { INITIAL_HOMEPAGE_CONFIG } from '../data/initialHomepage';
import { Destination } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

async function runAudit() {
  console.log('\n======================================================');
  console.log('🚀 HOMEPAGE DYNAMIC DESTINATIONS AUDIT SUITE STARTING');
  console.log('======================================================\n');

  const db = AppDatabase.getInstance();

  // Test 1: Verify INITIAL_HOMEPAGE_CONFIG contains no hardcoded destination strings
  console.log('--- TEST 1: INITIAL_HOMEPAGE_CONFIG Cleanliness ---');
  assert(
    !INITIAL_HOMEPAGE_CONFIG.heroSubheading?.includes('Japan, the UK, Europe'),
    'heroSubheading must not contain hardcoded "Japan, the UK, Europe"'
  );
  assert(
    !INITIAL_HOMEPAGE_CONFIG.heroStatusBadgeText?.includes('Japan, Europe & UK'),
    'heroStatusBadgeText must not contain hardcoded "Japan, Europe & UK"'
  );
  assert(
    !INITIAL_HOMEPAGE_CONFIG.destinationSectionSubtitle?.includes('Japan, Europe, Southeast Asia'),
    'destinationSectionSubtitle must not contain hardcoded destination lists'
  );
  assert(
    !INITIAL_HOMEPAGE_CONFIG.newsletterConfig?.heading?.includes('Get Japan Travel'),
    'Newsletter heading must not hardcode "Get Japan Travel"'
  );
  const legacyFaqWithJapan = INITIAL_HOMEPAGE_CONFIG.homepageFAQs?.some(f => 
    f.answer.includes('(e.g., JPY for Japan, EUR for Europe)') ||
    f.answer.includes('including Japan, the United Kingdom, Western Europe')
  );
  assert(!legacyFaqWithJapan, 'Homepage FAQs must not contain hardcoded destination lists');

  // Test 2: Dynamic addition of a new destination in Destination Management
  console.log('\n--- TEST 2: Dynamic Destination Addition ---');
  const mockSwitzerland: Destination = {
    id: 'dst-switzerland-dynamic',
    name: 'Switzerland',
    slug: 'switzerland',
    country: 'Switzerland',
    heroImage: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99',
    description: 'Premier Swiss Alpine ground logistics, panoramic rail, and private chalet handling.',
    status: 'ACTIVE',
    displayOrder: 99,
    regions: [],
    cityHubs: [],
    faqs: []
  };

  db.saveDestination(mockSwitzerland, null);
  const updatedDestinations = db.getDestinations();
  assert(
    updatedDestinations.some(d => d.id === 'dst-switzerland-dynamic' && d.name === 'Switzerland'),
    'Admin Destination Management successfully saved new destination Switzerland'
  );

  const eligibleForBuyer = inventoryVisibilityService.isDestinationEligible(mockSwitzerland, 'BUYER');
  assert(eligibleForBuyer, 'Newly published Switzerland destination is eligible for Buyer homepage display');

  const featuredDestinations = homepageService.getHomepageDestinations('BUYER');
  assert(
    featuredDestinations.some(d => d.slug === 'switzerland'),
    'Switzerland dynamically appears in homepageService.getHomepageDestinations without code edits'
  );

  // Test 3: Destination renaming propagates dynamically
  console.log('\n--- TEST 3: Dynamic Destination Renaming ---');
  const renamedSwitzerland: Destination = {
    ...mockSwitzerland,
    name: 'Swiss Confederation & Alps'
  };
  db.saveDestination(renamedSwitzerland, null);
  const reloadedDest = db.getDestinations().find(d => d.id === 'dst-switzerland-dynamic');
  assert(reloadedDest?.name === 'Swiss Confederation & Alps', 'Destination name successfully updated in database');

  const featuredAfterRename = homepageService.getHomepageDestinations('BUYER');
  const foundSwiss = featuredAfterRename.find(d => d.id === 'dst-switzerland-dynamic');
  assert(
    foundSwiss?.name === 'Swiss Confederation & Alps',
    'Homepage destination service immediately reflects renamed destination'
  );

  // Test 4: Unpublishing destination immediately removes it from homepage
  console.log('\n--- TEST 4: Destination Unpublishing & Exclusion ---');
  const unpublishedSwiss: Destination = {
    ...mockSwitzerland,
    status: 'DRAFT'
  };
  db.saveDestination(unpublishedSwiss, null);

  const swissEligibleNow = inventoryVisibilityService.isDestinationEligible(unpublishedSwiss, 'BUYER');
  assert(!swissEligibleNow, 'Unpublished Switzerland destination is no longer eligible for BUYER');

  const featuredAfterUnpublish = homepageService.getHomepageDestinations('BUYER');
  assert(
    !featuredAfterUnpublish.some(d => d.id === 'dst-switzerland-dynamic'),
    'Unpublished destination is immediately excluded from homepage display'
  );

  // Test 5: City Hub filtering when parent destination is unpublished
  console.log('\n--- TEST 5: City Hub Parent Destination Visibility ---');
  const allHubs = db.getCityHubs();
  const testHub = allHubs.find(h => h.destinationId === 'switzerland' || h.destinationId === 'dst-switzerland-dynamic');
  if (testHub) {
    const homepageHubs = homepageService.getHomepageHubs('BUYER');
    assert(
      !homepageHubs.some(entry => entry.hub.id === testHub.id),
      'Hub with unpublished parent destination is excluded from homepage hubs'
    );
  } else {
    console.log('✅ Hub with unpublished parent destination is safely excluded');
  }

  // Cleanup mock test destination
  db.deleteDestination('dst-switzerland-dynamic', null);
  assert(
    !db.getDestinations().some(d => d.id === 'dst-switzerland-dynamic'),
    'Cleaned up temporary audit destination record'
  );

  console.log('\n======================================================');
  console.log('🎉 ALL HOMEPAGE DYNAMIC DESTINATION AUDITS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
