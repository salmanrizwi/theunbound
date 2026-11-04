import assert from 'node:assert';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AppDatabase } from '../services/db';
import { auth, db as firestoreDb } from '../services/firebase';
import { calculatePackagePrice } from '../services/pricingEngine';
import { transformPackageToQuoteState, buildMasterPackageFromQuoteWorkspace, saveAndVerifyMasterPackageFromQuote } from '../services/packageToQuoteTransformer';
import { B2BPackage } from '../types';

async function runMasterPackageAudit() {
  console.log('================================================================');
  console.log('  READY-MADE PACKAGE AUTHORITATIVE AUDIT & VERIFICATION');
  console.log('================================================================\n');

  // Authenticate as Admin
  console.log('Step 1: Authenticating as Admin in Firebase...');
  const cred = await signInWithEmailAndPassword(auth, 'admin@theunbound.com', 'Unboundpass11!');
  const adminUser = cred.user;
  const cmsUser: any = {
    id: adminUser.uid,
    name: 'TheUnbound Executive Admin',
    email: 'admin@theunbound.com',
    role: 'ADMIN',
    userType: 'ADMIN',
    approvalStatus: 'APPROVED'
  };
  console.log(`✅ Authenticated as ${adminUser.email} (${adminUser.uid})`);

  const db = AppDatabase.getInstance();
  console.log('Hydrating database from live Firestore...');
  await db.hydrateFromFirestoreNow();
  console.log(`Hydrated ${db.getProducts().length} products, ${db.getDestinations().length} destinations.`);
  const targetId = 'pkg-test-1791909396261-3';

  // Requirement 1 & 2: Authoritative package retrieval & identity
  console.log('\n--- Requirement 1 & 2: Authoritative Master Package Identity ---');
  const firestoreSnap = await getDoc(doc(firestoreDb, 'b2b_packages', targetId));
  assert(firestoreSnap.exists(), `Package ${targetId} exists in Firestore "b2b_packages" collection`);
  const pkgData = firestoreSnap.data() as B2BPackage;

  assert.strictEqual(pkgData.id, targetId, 'Package ID matches');
  assert.strictEqual(pkgData.title, 'Tokyo Uncovered - 5 Days of Iconic Japan', 'Package title matches');
  assert.strictEqual(pkgData.destinationId, 'DST-JPN', 'Destination is DST-JPN (Japan)');
  assert.strictEqual(pkgData.destinationName, 'Japan', 'Destination name is Japan');
  assert.strictEqual(pkgData.regionId, 'region-jp-kanto', 'Region is region-jp-kanto (Kanto)');
  assert(Array.isArray(pkgData.hubIds) && pkgData.hubIds.includes('hub-tokyo'), 'Hub is hub-tokyo');
  assert.strictEqual(pkgData.durationDays, 6, 'Duration is 6 Days');
  assert.strictEqual(pkgData.durationNights, 5, 'Duration is 5 Nights');
  assert.strictEqual(pkgData.status, 'PUBLISHED', 'Status is PUBLISHED');
  assert.strictEqual(pkgData.isPublished, true, 'isPublished is true');
  console.log(`✅ Package "${pkgData.title}" (${pkgData.id}) identity verified.`);

  // Requirement 3: In-Memory / Local DB persistence & Ready-Made Package listing
  console.log('\n--- Requirement 3: Ready-Made Package Listing & Catalog Availability ---');
  db.savePackage(pkgData, cmsUser);
  const localPkg = db.getPackageById(targetId);
  assert(localPkg !== null, 'Retrievable via db.getPackageById');
  const allPackages = db.getPackages();
  assert(allPackages.some(p => p.id === targetId), 'Included in db.getPackages()');
  const publishedPackages = db.getPublishedB2BPackages();
  assert(publishedPackages.some(p => p.id === targetId), 'Included in db.getPublishedB2BPackages()');
  console.log(`✅ Package present in catalog. Total packages in manager: ${allPackages.length}, published: ${publishedPackages.length}`);

  // Requirement 4: Itinerary & Product integrity
  console.log('\n--- Requirement 4: Itinerary Days & Product References Integrity ---');
  assert(Array.isArray(localPkg.itinerary) && localPkg.itinerary.length === 6, 'Itinerary has 6 days');
  assert(Array.isArray(localPkg.productIds) && localPkg.productIds.length === 8, '8 linked master product IDs');
  
  // Verify all 8 product IDs exist in db products
  const dbProds = db.getProducts();
  for (const pid of localPkg.productIds) {
    const pMatch = dbProds.find(p => p.id === pid);
    assert(pMatch !== undefined, `Referenced product ${pid} exists in master products (${pMatch?.name})`);
  }
  console.log(`✅ All 8 referenced products exist in master database.`);

  // Requirement 5: Centralized Pricing Engine verification
  console.log('\n--- Requirement 5: Centralized Pricing Engine Rate Calculation ---');
  const pricingResult = calculatePackagePrice({
    packageItem: localPkg,
    userRole: 'ADMIN',
    pricingTier: 'B2B',
    targetCurrency: 'USD',
    adults: 2,
    children: 0,
    infants: 0,
    user: cmsUser
  });
  const netCost = pricingResult.internalAudit?.totalNetCostTarget || pricingResult.internalAudit?.totalNetCostUSD || 0;
  console.log('Pricing result:', {
    netCost,
    finalSellingPrice: pricingResult.finalSellingPrice,
    currency: pricingResult.currency
  });
  assert(pricingResult.finalSellingPrice > 0, 'Pricing engine returns valid positive selling price');
  assert(netCost > 0, 'Pricing engine returns valid positive base nett cost');
  assert(pricingResult.finalSellingPrice >= netCost, 'Selling price >= Nett cost');
  console.log(`✅ Pricing calculated: Nett USD $${netCost}, Selling USD $${pricingResult.finalSellingPrice}`);

  // Requirement 6: Search & Filter verification
  console.log('\n--- Requirement 6: Search & Filter Verification ---');
  // Match title
  const searchMatch = allPackages.filter(p => p.title.toLowerCase().includes('tokyo uncovered'));
  assert(searchMatch.length > 0, 'Findable by search query "tokyo uncovered"');
  // Match destination
  const destMatch = allPackages.filter(p => p.destinationId === 'DST-JPN');
  assert(destMatch.some(p => p.id === targetId), 'Findable by destination filter DST-JPN');
  // Match status
  const statusMatch = allPackages.filter(p => p.status === 'PUBLISHED');
  assert(statusMatch.some(p => p.id === targetId), 'Findable by status filter PUBLISHED');
  console.log(`✅ Package correctly resolved by all search and filtering criteria.`);

  // Requirement 7: B2B Quote Customization flow
  console.log('\n--- Requirement 7: Transform Package into Quote Workspace (Customization) ---');
  const quoteWorkspace = transformPackageToQuoteState(localPkg, {
    travelStartDate: '2026-12-01',
    travelEndDate: '2026-12-06',
    adults: 2,
    children: 0,
    infants: 0,
    currency: 'USD',
    userRole: 'ADMIN',
    user: cmsUser
  });
  assert(quoteWorkspace.destination?.id === 'DST-JPN', 'Transformed quote destination is DST-JPN');
  assert(quoteWorkspace.tripNights === 5, 'Transformed quote duration is 5 nights');
  assert(quoteWorkspace.routeHubs.length === 1 && quoteWorkspace.routeHubs[0].hubId === 'hub-tokyo', 'Transformed quote route hub is Tokyo');
  assert(quoteWorkspace.items.length === 8, `Transformed quote items contains all 8 products (found ${quoteWorkspace.items.length})`);
  console.log(`✅ Package successfully customized into quote state with ${quoteWorkspace.items.length} items and 5 nights.`);

  // Requirement 8: Dispatch & Generation "Save as Master Package" integration & idempotency
  console.log('\n--- Requirement 8: Save as Master Package & Idempotency ---');
  const saveResult = saveAndVerifyMasterPackageFromQuote({
    title: 'Tokyo Uncovered - 5 Days of Iconic Japan',
    tagline: 'Signature 5-night curated circuit featuring Tokyo (Kanto).',
    description: 'Comprehensive 6-day / 5-night curated circuit across Tokyo (Kanto) including 8 master experiences.',
    tripType: 'LUXURY',
    status: 'PUBLISHED',
    featured: true,
    currentDestination: quoteWorkspace.destination,
    quotationScope: quoteWorkspace.quotationScope,
    routeHubs: quoteWorkspace.routeHubs,
    items: quoteWorkspace.items,
    dayThemes: quoteWorkspace.dayThemes,
    dayDescriptions: quoteWorkspace.dayDescriptions,
    dayOverviews: quoteWorkspace.dayOverviews,
    dayNotes: quoteWorkspace.dayNotes,
    inclusions: quoteWorkspace.inclusions,
    exclusions: quoteWorkspace.exclusions,
    importantInformation: quoteWorkspace.importantInformation,
    cancellationPolicy: quoteWorkspace.cancellationPolicy,
    currency: 'USD',
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    existingPackageId: targetId,
    updateExisting: true,
    user: cmsUser
  });

  assert(saveResult.success === true, `Save as Master Package succeeded: ${saveResult.error}`);
  assert.strictEqual(saveResult.pkg?.id, targetId, 'Idempotent update preserves original Master Package ID');
  const postSavePackages = db.getPackages();
  assert.strictEqual(postSavePackages.length, allPackages.length, 'No duplicate package created on update');
  console.log(`✅ Idempotent Save as Master Package verified. Package ID ${targetId} maintained.`);

  // Requirement 9: Tombstone Safety
  console.log('\n--- Requirement 9: Tombstone Safety Verification ---');
  const tombstones = db.getDeletedEntityIds();
  assert(!tombstones.has(targetId), `Package ${targetId} is not in tombstones`);
  assert(!tombstones.has(`Package_${targetId}`), `Package_${targetId} is not in tombstones`);
  assert(!tombstones.has(`b2b_packages_${targetId}`), `b2b_packages_${targetId} is not in tombstones`);
  console.log(`✅ Tombstone safety confirmed.`);

  // Requirement 10: Final Sanity Check
  console.log('\n--- Requirement 10: Final Master Package Retrieval Sanity ---');
  const finalCheck = db.getPackageById(targetId);
  assert(finalCheck !== null && finalCheck.status === 'PUBLISHED', 'Final check passed');
  console.log(`✅ Final check passed for "${finalCheck.title}"!`);

  console.log('\n================================================================');
  console.log('  ALL 10 READY-MADE PACKAGE REQUIREMENTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');

  process.exit(0);
}

runMasterPackageAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
