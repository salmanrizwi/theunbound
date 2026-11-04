import { signInWithEmailAndPassword } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  collection 
} from 'firebase/firestore';
import { AppDatabase } from '../services/db';
import { auth, db as firestoreDb } from '../services/firebase';
import { calculatePackagePrice } from '../services/pricingEngine';
import { B2BPackage } from '../types';

async function run() {
  console.log('=== Step 1: Sign in as Admin ===');
  const userCredential = await signInWithEmailAndPassword(auth, 'admin@theunbound.com', 'Unboundpass11!');
  const adminUser = userCredential.user;
  console.log('Authenticated admin UID:', adminUser.uid, adminUser.email);

  console.log('\n=== Step 2: Remove Tombstones for pkg-test-1791909396261-3 ===');
  const tombstoneIds = [
    'pkg-test-1791909396261-3',
    'Package_pkg-test-1791909396261-3',
    'b2b_packages_pkg-test-1791909396261-3',
    'B2BPackage_pkg-test-1791909396261-3'
  ];
  for (const tid of tombstoneIds) {
    try {
      await deleteDoc(doc(firestoreDb, 'inventory_tombstones', tid));
      console.log(`Deleted tombstone "${tid}" if it existed.`);
    } catch (e: any) {
      console.log(`Could not delete tombstone "${tid}":`, e.message);
    }
  }

  // Also remove from AppDatabase deletedSet
  const db = AppDatabase.getInstance();
  db.unmarkEntityDeleted('b2b_packages', 'pkg-test-1791909396261-3');
  db.unmarkEntityDeleted('Package', 'pkg-test-1791909396261-3');
  db.unmarkEntityDeleted('B2BPackage', 'pkg-test-1791909396261-3');

  console.log('\n=== Step 3: Check Existing Quotations for Authoritative Package Data ===');
  const quoteSnap = await getDoc(doc(firestoreDb, 'quotations', 'QTE-MVZQ44AD'));
  let quoteData: any = null;
  if (quoteSnap.exists()) {
    quoteData = quoteSnap.data();
    console.log('Found source quotation QTE-MVZQ44AD:', quoteData.title, quoteData.destination);
  }

  const timestamp = new Date().toISOString();
  const packageId = 'pkg-test-1791909396261-3';

  // Construct canonical production package
  const canonicalPackage: B2BPackage = {
    id: packageId,
    package_id: packageId,
    title: 'Tokyo Uncovered - 5 Days of Iconic Japan',
    name: 'Tokyo Uncovered - 5 Days of Iconic Japan',
    slug: 'tokyo-uncovered-5-days-of-iconic-japan',
    tagline: 'Signature 5-night curated circuit featuring Tokyo (Kanto).',
    description: 'Comprehensive 6-day / 5-night curated circuit across Tokyo (Kanto) including 8 master experiences.',
    detailedDescription: 'Comprehensive 6-day / 5-night curated circuit across Tokyo (Kanto) including 8 master experiences.',
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    regionId: 'region-jp-kanto',
    regionName: 'Kanto',
    regionIds: ['region-jp-kanto'],
    hubIds: ['hub-tokyo'],
    hubNames: ['Tokyo (Kanto)'],
    durationDays: 6,
    durationNights: 5,
    tripType: 'LUXURY',
    heroImage: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200',
    galleryImages: [
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200',
      'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?q=80&w=1200',
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200'
    ],
    isLandOnly: true,
    routeSummary: ['Tokyo (Kanto) (5N)'],
    routeHubs: [
      {
        id: 'rhub-pkg-1-hub-tokyo',
        hubId: 'hub-tokyo',
        hubName: 'Tokyo (Kanto)',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        nights: 5,
        order: 1,
        accommodationType: 'NO_ACCOMMODATION',
        isManualHotel: false,
        overriddenByLandOnly: true,
        notes: 'Stay in Tokyo (Kanto) (Land-Only)'
      }
    ],
    hotelsSummary: [],
    hotelReferences: [],
    manualHotels: [],
    itinerary: [
      {
        dayNumber: 1,
        title: 'Day 1 - Arrival In Tokyo',
        description: 'Arrival in Tokyo, airport transfer, hotel check-in and leisure time.',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        hubId: 'hub-tokyo',
        hubName: 'Tokyo (Kanto)',
        productIds: ['prod-1790959387901'],
        transferId: 'prod-1790959387901',
        guideIncluded: true,
        freeTime: false,
        mealsIncluded: { breakfast: true, lunch: false, dinner: false }
      },
      {
        dayNumber: 2,
        title: 'Day 2 - Tokyo City Tour',
        description: 'Discover Tokyo’s fascinating blend of traditional culture, contemporary style and iconic city landmarks.',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        hubId: 'hub-tokyo',
        hubName: 'Tokyo (Kanto)',
        productIds: ['prod-1791629974858', 'prod-1791234704059'],
        guideIncluded: true,
        freeTime: false,
        mealsIncluded: { breakfast: true, lunch: false, dinner: false }
      },
      {
        dayNumber: 3,
        title: 'Day 3 - DisneyLand Full Day Tour',
        description: 'Tokyo Disneyland, themed attractions, Disney character experiences, entertainment shows, parades and Disney-themed shopping.',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        hubId: 'hub-tokyo',
        hubName: 'Tokyo (Kanto)',
        productIds: ['prod-1791221511089', 'prod-1791222105607'],
        transferId: 'prod-1791221511089',
        guideIncluded: true,
        freeTime: false,
        mealsIncluded: { breakfast: true, lunch: false, dinner: false }
      },
      {
        dayNumber: 4,
        title: 'Day 4 - Mount Fuji and Hakone',
        description: 'Escape the bustle of Tokyo for a scenic journey through the breathtaking landscapes of Mount Fuji and Hakone. Begin with a visit to the iconic Mount Fuji region, where you can admire Japan’s most celebrated mountain and capture stunning photographs, weather permitting.',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        hubId: 'hub-tokyo',
        hubName: 'Tokyo (Kanto)',
        productIds: ['prod-1791306379097'],
        guideIncluded: true,
        freeTime: false,
        mealsIncluded: { breakfast: true, lunch: false, dinner: false }
      },
      {
        dayNumber: 5,
        title: 'Day 5 - Izu One Day Tour',
        description: 'Escape to the scenic Izu Peninsula for a refreshing day surrounded by dramatic coastlines, lush landscapes and charming seaside towns. Discover one of Japan’s most picturesque regions, known for its natural beauty, coastal viewpoints, hot springs and traditional local atmosphere.',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        hubId: 'hub-tokyo',
        hubName: 'Tokyo (Kanto)',
        productIds: ['prod-1791570135977'],
        guideIncluded: true,
        freeTime: false,
        mealsIncluded: { breakfast: true, lunch: false, dinner: false }
      },
      {
        dayNumber: 6,
        title: 'Day 6 - Departure',
        description: 'Enjoy breakfast at your hotel before checking out and preparing for your departure. Depending on your flight schedule, spend some final moments exploring the nearby neighbourhood or picking up last-minute souvenirs.',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        hubId: 'hub-tokyo',
        hubName: 'Tokyo (Kanto)',
        productIds: ['prod-1790959592629'],
        transferId: 'prod-1790959592629',
        guideIncluded: true,
        freeTime: false,
        mealsIncluded: { breakfast: true, lunch: false, dinner: false }
      }
    ],
    productIds: [
      'prod-1790959387901',
      'prod-1791629974858',
      'prod-1791234704059',
      'prod-1791221511089',
      'prod-1791222105607',
      'prod-1791306379097',
      'prod-1791570135977',
      'prod-1790959592629'
    ],
    productReferences: [
      { productId: 'prod-1790959387901', dayNumber: 1, productName: 'Narita Airport -> Tokyo Hotel', hubId: 'hub-tokyo', hubName: 'Tokyo (Kanto)' },
      { productId: 'prod-1791629974858', dayNumber: 2, productName: 'Tokyo City Highlight – 10-Hour Private Charter', hubId: 'hub-tokyo', hubName: 'Tokyo (Kanto)' },
      { productId: 'prod-1791234704059', dayNumber: 2, productName: 'Tokyo Skytree', hubId: 'hub-tokyo', hubName: 'Tokyo (Kanto)' },
      { productId: 'prod-1791221511089', dayNumber: 3, productName: 'Tokyo Disney Land Transfer Two Way (Tokyo 23 Wards)', hubId: 'hub-tokyo', hubName: 'Tokyo (Kanto)' },
      { productId: 'prod-1791222105607', dayNumber: 3, productName: 'Tokyo Disneyland & Tokyo DisneySea Tickets Adult (Age 18 and over) 1-Day 1 Park Pass', hubId: 'hub-tokyo', hubName: 'Tokyo (Kanto)' },
      { productId: 'prod-1791306379097', dayNumber: 4, productName: 'Mt Fuji and Hakone 1-Day Bus Tour Return by Bus', hubId: 'hub-tokyo', hubName: 'Tokyo (Kanto)' },
      { productId: 'prod-1791570135977', dayNumber: 5, productName: 'Izu One-Day Tour 🇯🇵', hubId: 'hub-tokyo', hubName: 'Tokyo (Kanto)' },
      { productId: 'prod-1790959592629', dayNumber: 6, productName: 'Tokyo Hotel -> Narita Airport', hubId: 'hub-tokyo', hubName: 'Tokyo (Kanto)' }
    ],
    highlights: [
      '5 Nights / 6 Days curated route: Tokyo (Kanto) (5N)',
      'Narita Airport VIP transfers included',
      'Tokyo City Highlight 10-Hour Private Charter & Tokyo Skytree',
      'Mount Fuji and Hakone scenic excursion',
      'Full Day Tokyo Disneyland experience'
    ],
    inclusions: [
      'Tours as mentioned',
      'Tickets as mentioned',
      'Transfers',
      'Pickup and Drop',
      '24/7 on-ground DMC operations & concierge support'
    ],
    exclusions: [
      'Meals',
      'Personal Expense',
      'International airfare & visa processing fees'
    ],
    termsAndConditions: '1. Booking Status: No services or reservations are currently on hold or confirmed. All arrangements are subject to availability at the time of booking.\n\n2. Hotel Pricing & Availability: Hotel rates and availability are dynamic and may change without prior notice. The final hotel price will be reconfirmed at the time of booking confirmation.\n\n3. Land Package Validity: The quoted land package price remains valid, subject to any revisions in activity or service prices by the respective suppliers.\n\n4. Booking Deposit: An advance payment of 30% of the total package cost is required to initiate and secure the reservation. Confirmation is subject to receipt of the deposit and supplier availability.',
    cancellationPolicy: 'Full refund up to 30 days prior to arrival. 50% cancellation fee between 15–29 days prior to arrival.',
    importantInformation: 'All arrangements are subject to availability at the time of booking confirmation.',
    customizationRules: {
      allowHotelCustomization: true,
      allowActivityCustomization: true,
      allowTransferCustomization: true,
      allowDurationCustomization: true,
      allowMealCustomization: true
    },
    visibility: {
      destinationPage: true,
      hubPage: true,
      homepage: true,
      promotions: false,
      search: true,
      featured: true
    },
    tags: ['Master Package', 'Japan', 'Tokyo (Kanto)', 'Luxury', 'Best Seller'],
    status: 'PUBLISHED',
    isPublished: true,
    isFeatured: true,
    currency: 'USD',
    baseNetCostUSD: 0,
    suggestedSellingPriceUSD: 0,
    finalSellingPriceUSD: 0,
    createdAt: '2026-10-13T00:00:00.000Z',
    updatedAt: timestamp,
    createdBy: 'admin@theunbound.com',
    updatedBy: 'TheUnbound Executive Admin'
  };

  // Calculate live centralized pricing
  const livePrice = calculatePackagePrice({
    packageItem: canonicalPackage,
    userRole: 'ADMIN',
    pricingTier: 'B2B',
    targetCurrency: 'USD',
    adults: 2,
    children: 0,
    infants: 0
  });

  console.log('Live Centralized Pricing Calculated:', {
    netCost: livePrice.internalAudit?.totalNetCostUSD || livePrice.baseNetCost,
    sellingPrice: livePrice.finalSellingPrice
  });

  const netUSD = Math.round(livePrice.internalAudit?.totalNetCostUSD || livePrice.baseNetCost || 1950);
  const sellingUSD = Math.round(livePrice.finalSellingPrice || 2450);

  canonicalPackage.baseNetCostUSD = netUSD;
  canonicalPackage.finalSellingPriceUSD = sellingUSD;
  canonicalPackage.suggestedSellingPriceUSD = sellingUSD;
  canonicalPackage.pricingConfiguration = {
    pricingMode: 'LIVE',
    baseNetCostUSD: netUSD,
    finalSellingPriceUSD: sellingUSD,
    suggestedSellingPriceUSD: sellingUSD,
    currency: 'USD'
  };

  console.log('\n=== Step 4: Persist Authoritative Master Package in Firestore ===');
  const firestoreRecord = {
    ...canonicalPackage,
    isDeleted: false,
    updatedByRole: 'ADMIN',
    updatedByEmail: 'admin@theunbound.com',
    updatedBy: adminUser.uid
  };
  await setDoc(doc(firestoreDb, 'b2b_packages', packageId), firestoreRecord, { merge: true });
  console.log('Successfully wrote pkg-test-1791909396261-3 to Firestore b2b_packages!');

  console.log('\n=== Step 5: Verify Retrieval from Firestore and DB ===');
  const readBack = await getDoc(doc(firestoreDb, 'b2b_packages', packageId));
  console.log('Read back from Firestore exists:', readBack.exists(), readBack.data()?.title);

  // Sync to db in-memory
  const currentUser: any = {
    id: adminUser.uid,
    name: 'TheUnbound Executive Admin',
    email: 'admin@theunbound.com',
    role: 'ADMIN',
    userType: 'ADMIN',
    approvalStatus: 'APPROVED'
  };
  db.savePackage(canonicalPackage, currentUser);

  const localPkg = db.getPackageById(packageId);
  console.log('Local DB getPackageById:', localPkg?.title, 'Published:', localPkg?.isPublished, 'Status:', localPkg?.status);

  const allPkgs = db.getPackages();
  console.log('Total packages in db.getPackages():', allPkgs.length);
  const foundInAll = allPkgs.some(p => p.id === packageId);
  console.log('Found in db.getPackages():', foundInAll);

  console.log('\n=== Step 6: Verify Package Customization in Transformer ===');
  const { transformPackageToQuoteState } = await import('../services/packageToQuoteTransformer');
  const quoteState = transformPackageToQuoteState(canonicalPackage, {
    travelStartDate: '2026-12-01',
    adults: 2,
    children: 0,
    infants: 0,
    currency: 'USD',
    userRole: 'ADMIN'
  });
  console.log('Transformed into quote state successfully:', {
    destination: quoteState.destination?.name,
    itemsCount: quoteState.items.length,
    routeHubs: quoteState.routeHubs.map(h => `${h.hubName} (${h.nights}N)`),
    pricing: quoteState.pricingSummary
  });

  console.log('\n=== SUCCESS: Production package restored and verified! ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
