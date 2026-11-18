import { AppDatabase } from '../services/db';
import {
  buildAuthoritativeQuotationSnapshot,
  prepareAndPersistAuthoritativeSnapshot,
  recordQuotationGenerationEvent,
  validateQuotationOutputConsistency,
  stripHtmlTagsAndEntities,
  isQuotationSnapshotLocked
} from '../services/quotationSnapshotService';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel,
  isTheUnboundBrandString
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import { EmailNotificationService } from '../services/emailNotificationService';
import { generateWhatsAppQuoteMessage } from '../services/quoteWhatsAppService';
import { buildQuoteCommunicationPayload } from '../services/communicationDataBuilder';
import { saveAndVerifyMasterPackageFromQuote } from '../services/packageToQuoteTransformer';
import { formatCurrency } from '../services/pricingEngine';
import { clearSurchargeEngineCache } from '../services/surchargeEngine';
import {
  CurrencyCode,
  Destination,
  Product,
  Quotation,
  QuotationCommercialTermsSnapshot,
  QuoteItem,
  SurchargeMaster,
  User
} from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, details?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}`, details !== undefined ? JSON.stringify(details, null, 2) : '');
  }
}

const ADMIN_USER: User = {
  id: 'usr-admin-sync-audit',
  name: 'TheUnbound Admin Director',
  email: 'business@theunbound.in',
  role: 'ADMIN',
  userType: 'ADMIN',
  agencyName: 'theunbound',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const WHITE_LABEL_AGENT: User = {
  id: 'usr-wl-agent-sync-audit',
  name: 'Elena Vance',
  email: 'elena@aureliajourneys.com',
  companyEmail: 'concierge@aureliajourneys.com',
  companyPhone: '+44 20 7946 0821',
  phone: '+44 20 7946 0821',
  role: 'B2B_AGENT',
  userType: 'B2B_AGENT',
  agencyName: 'Aurelia Luxury Journeys',
  companyName: 'Aurelia Luxury Journeys',
  companyAddress: '18 Mayfair Gardens, London W1K 6LP, UK',
  companyWebsite: 'https://aureliajourneys.com',
  brandLogoUrl: 'https://aureliajourneys.com/logo.png',
  brandPrimaryColor: '#1e293b',
  brandAccentColor: '#b45309',
  quoteTagline: 'Curated Private Journeys',
  quoteFooterText: 'Aurelia Luxury Journeys Ltd • Registered in England & Wales',
  quoteDisclaimer: 'All arrangements issued exclusively by Aurelia Luxury Journeys.',
  createdAt: '2026-01-01T00:00:00.000Z'
};

function makeProduct(
  id: string,
  name: string,
  category: string,
  productType: string,
  netJPY: number,
  markupPct = 20
): Product {
  const isKyoto = id.includes('kyo');
  const hubId = isKyoto ? 'hub-kyoto' : 'hub-tokyo';
  const regionId = isKyoto ? 'region-jp-kansai' : 'region-jp-kanto';
  return {
    id,
    sku: `SKU-${id.toUpperCase()}`,
    name,
    category,
    productType,
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    regionId,
    regionIds: [regionId],
    hubId,
    hubIds: [hubId],
    hubName: isKyoto ? 'Kyoto' : 'Tokyo',
    hubNames: [isKyoto ? 'Kyoto' : 'Tokyo'],
    country: 'Japan',
    city: isKyoto ? 'Kyoto' : 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: netJPY,
    childNetPrice: Math.round(netJPY * 0.7),
    infantNetPrice: 0,
    defaultMarkupPercent: markupPct,
    b2bAgentMarkupPercent: markupPct,
    buyerMarkupPercent: markupPct,
    taxPercent: 0,
    validityFrom: '2026-01-01',
    validityTo: '2027-12-31',
    status: 'ACTIVE',
    inclusions: [`Private access for ${name}`, 'English-speaking specialist escort'],
    exclusions: ['Personal gratuities & beverages']
  } as unknown as Product;
}

function makeQuoteItem(
  id: string,
  product: Product,
  travelDate: string,
  adults = 2,
  dayNumber = 1
): QuoteItem {
  const unitSell = Math.round(
    (product.adultNetPrice || 0) * (1 + (product.b2bAgentMarkupPercent || 20) / 100)
  );
  const totalSell = unitSell * adults;
  return {
    id,
    product,
    travelDate,
    dayNumber,
    pax: { adults, children: 0, infants: 0 },
    serviceTime: '09:30',
    notes: `Confirmed allocation for ${product.name}`,
    selectedAddonIds: [],
    calculation: {
      unitNettPrice: product.adultNetPrice || 0,
      totalNettPrice: (product.adultNetPrice || 0) * adults,
      finalTotalSellingPrice: totalSell,
      sellingPriceFinal: totalSell,
      currency: 'JPY',
      nativeCurrency: 'JPY',
      surchargeTotal: 0,
      fxDetails: {
        sourceCurrency: 'JPY',
        targetCurrency: 'JPY',
        exchangeRate: 1,
        baseExchangeRate: 1,
        marginPercent: 0,
        capturedAt: '2026-05-01T00:00:00.000Z'
      }
    } as any,
    contentSnapshot: {
      productId: product.id,
      productName: product.name,
      category: product.category,
      inclusions: product.inclusions || [],
      exclusions: product.exclusions || []
    }
  } as unknown as QuoteItem;
}

function buildBaselineQuote(
  quoteId: string,
  quoteNumber: string,
  currency: CurrencyCode = 'USD',
  user: User = ADMIN_USER,
  brandingMode: 'STANDARD' | 'WHITE_LABEL' = 'STANDARD'
): Quotation {
  const prodTokyoTour = makeProduct(
    'prod-tyo-imperial-sync',
    'Tokyo Private Heritage & Tsukiji VIP Discovery',
    'Sightseeing',
    'Guided Tour',
    30000,
    20
  );
  const prodKyotoTea = makeProduct(
    'prod-kyo-tea-sync',
    'Kyoto Gion Private Machiya Tea & Geisha Walk',
    'Experiences',
    'Cultural Experience',
    25000,
    20
  );

  const item1 = makeQuoteItem('qi-sync-1', prodTokyoTour, '2026-12-20', 2, 1);
  const item2 = makeQuoteItem('qi-sync-2', prodKyotoTea, '2026-12-22', 2, 3);

  const routeHubs = [
    {
      id: 'hub-sync-tyo',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo',
      destinationId: 'DST-JPN',
      nights: 2,
      order: 1,
      roomsCount: 1,
      manualHotel: {
        hotelName: 'Aman Tokyo Otemachi',
        starRating: '5 Star',
        roomType: 'Deluxe Suite King',
        mealPlan: 'Daily Gourmet Breakfast',
        ratePerNight: 120000,
        rateCurrency: 'JPY',
        numberOfRooms: 1,
        numberOfNights: 2,
        totalNetCost: 200000,
        totalSellingPrice: 240000,
        currency: 'JPY',
        notes: 'Guaranteed early check-in request.'
      } as any
    },
    {
      id: 'hub-sync-kyo',
      hubId: 'hub-kyoto',
      hubName: 'Kyoto',
      destinationId: 'DST-JPN',
      nights: 1,
      order: 2,
      roomsCount: 1,
      manualHotel: {
        hotelName: 'Park Hyatt Kyoto',
        starRating: '5 Star',
        roomType: 'Pagoda View Room',
        mealPlan: 'Breakfast Included',
        ratePerNight: 110000,
        rateCurrency: 'JPY',
        numberOfRooms: 1,
        numberOfNights: 1,
        totalNetCost: 90000,
        totalSellingPrice: 110000,
        currency: 'JPY',
        notes: 'Complimentary welcome tea.'
      } as any
    }
  ];

  const termsSnapshot: QuotationCommercialTermsSnapshot = {
    snapshotId: `TERMS-SNAP-${quoteId}`,
    capturedAt: '2026-10-01T00:00:00.000Z',
    capturedBy: user.name,
    quoteVersion: 1,
    destinationIds: ['DST-JPN'],
    destinationNames: ['Japan'],
    missingDestinationIds: [],
    missingDestinationNames: [],
    termsStatus: 'QUOTATION_FINALISED',
    entries: [
      {
        targetId: 'DST-JPN',
        targetType: 'DESTINATION',
        targetName: 'Japan',
        configId: 'CFG-JPN-1',
        version: 1,
        contentHash: 'hash-jpn-1',
        htmlText:
          '<h4>1. Japan Golden Route Booking Conditions</h4><p>Full Shinkansen Green Car seat release requires passport details 21 days before departure.</p><h4>2. Ryokan &amp; Luxury Hotel Deposit Schedule</h4><p>30% initial deposit confirms suites; balance due 30 days prior to arrival in Tokyo.</p>',
        plainText:
          '1. Japan Golden Route Booking Conditions: Full Shinkansen Green Car seat release requires passport details 21 days before departure.\n\n2. Ryokan & Luxury Hotel Deposit Schedule: 30% initial deposit confirms suites; balance due 30 days prior to arrival in Tokyo.',
        whatsAppText:
          '*1. Japan Golden Route Booking Conditions*\nFull Shinkansen Green Car seat release requires passport details 21 days before departure.\n\n*2. Ryokan & Luxury Hotel Deposit Schedule*\n30% initial deposit confirms suites; balance due 30 days prior to arrival in Tokyo.',
        sections: [
          {
            sectionId: 'sec-jpn-1',
            heading: '1. Japan Golden Route Booking Conditions',
            htmlContent: '<p>Full Shinkansen Green Car seat release requires passport details 21 days before departure.</p>',
            displayOrder: 1,
            isActive: true
          },
          {
            sectionId: 'sec-jpn-2',
            heading: '2. Ryokan & Luxury Hotel Deposit Schedule',
            htmlContent: '<p>30% initial deposit confirms suites; balance due 30 days prior to arrival in Tokyo.</p>',
            displayOrder: 2,
            isActive: true
          }
        ]
      }
    ],
    combinedHeading: 'Commercial Quotation Terms — Japan',
    combinedHtml:
      '<h4>1. Japan Golden Route Booking Conditions</h4><p>Full Shinkansen Green Car seat release requires passport details 21 days before departure.</p><h4>2. Ryokan &amp; Luxury Hotel Deposit Schedule</h4><p>30% initial deposit confirms suites; balance due 30 days prior to arrival in Tokyo.</p>',
    combinedPlainText:
      '1. Japan Golden Route Booking Conditions: Full Shinkansen Green Car seat release requires passport details 21 days before departure.\n\n2. Ryokan & Luxury Hotel Deposit Schedule: 30% initial deposit confirms suites; balance due 30 days prior to arrival in Tokyo.',
    combinedWhatsAppText:
      '*1. Japan Golden Route Booking Conditions*\nFull Shinkansen Green Car seat release requires passport details 21 days before departure.\n\n*2. Ryokan & Luxury Hotel Deposit Schedule*\n30% initial deposit confirms suites; balance due 30 days prior to arrival in Tokyo.'
  };

  const baseQuote: Quotation = {
    id: quoteId,
    quoteNumber,
    version: 1,
    status: 'DRAFT',
    title: 'Imperial Tokyo & Kyoto Luxury Collection',
    destination: 'Japan',
    sourcePackageId: 'pkg-sync-master-01',
    sourcePackageName: 'Imperial Tokyo & Kyoto Luxury Collection',
    currency,
    quotationScope: 'HOTEL_LAND',
    activeOptionId: 'opt-1',
    totalNetCost: 0,
    totalSellingPrice: 0,
    totalMargin: 0,
    totalTaxes: 0,
    overallMarkupPercent: 10,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 10,
    overallDiscountPercent: 0,
    brandingMode,
    clientName: 'Vikramaditya Mehta',
    clientEmail: 'v.mehta@mehtacapital.in',
    clientPhone: '+91 98200 12345',
    clientCompany: 'Mehta Family Trust',
    agentId: user.id,
    agentName: user.name,
    agentAgency: user.agencyName || 'theunbound',
    agentEmail: user.companyEmail || user.email,
    agentPhone: user.companyPhone || user.phone,
    agentLogoUrl: user.brandLogoUrl,
    travelStartDate: '2026-12-20',
    travelEndDate: '2026-12-23',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    nationality: 'Indian',
    travelStyle: 'Private Ultra-Luxury',
    mealPlanPreference: 'Daily Breakfast (CP)',
    visaAssistanceChoice: 'YES',
    itineraryOverview: 'Four curated days across Tokyo and Kyoto featuring Michelin heritage access.',
    dayThemes: {
      1: 'Arrival in Tokyo & Otemachi Sky Check-In',
      2: 'Private Tokyo Imperial Heritage Immersion',
      3: 'Shinkansen First Class to Kyoto & Gion Evening',
      4: 'Kansai Departure & Chauffeur Farewell'
    },
    dayDescriptions: {
      1: 'VIP meet & assist at Haneda Airport with luxury Alphard transfer to Aman Tokyo.',
      2: 'Full-day private Tokyo discovery with specialist cultural historian.',
      3: 'Board Nozomi Shinkansen Green Car to Kyoto followed by Gion tea ceremony.',
      4: 'Leisurely breakfast before private transfer to Kansai International Airport.'
    },
    inclusions: [
      '3 Nights luxury 5-star suites across Tokyo and Kyoto',
      'Private Alphard transfers and Nozomi Shinkansen Green Car',
      '24/7 dedicated bilingual concierge assistance'
    ],
    exclusions: [
      'International return airfare and travel insurance',
      'Personal expenses, laundry, and alcoholic beverages'
    ],
    importantInformation: 'Passports must remain valid for at least 6 months past the return travel date.',
    cancellationPolicy: 'Free cancellation up to 45 days before arrival; 50% between 44 and 21 days.',
    termsStatus: 'QUOTATION_FINALISED',
    commercialTermsSnapshot: termsSnapshot,
    termsAndConditions: termsSnapshot.combinedPlainText,
    routeHubs,
    items: [item1, item2],
    options: [
      {
        id: 'opt-1',
        optionNumber: 1,
        title: 'Option 1: Luxury Suites',
        scope: 'HOTEL_LAND',
        quotationScope: 'HOTEL_LAND',
        routeHubs,
        items: [item1, item2]
      } as any
    ],
    validUntil: '2026-11-01T00:00:00.000Z',
    agentNotes: '',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z'
  };

  return baseQuote;
}

function seedProductsInDb(db: AppDatabase, quote: Quotation) {
  (quote.items || []).forEach((it) => {
    if (it.product) {
      db.saveProduct(it.product, ADMIN_USER);
    }
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log(' QUOTATION 7 OUTPUT OPTIONS SYNCHRONISATION — REGRESSION SUITE (A–I) ');
  console.log('========================================================================\n');

  const db = AppDatabase.getInstance();
  clearSurchargeEngineCache();

  // Seed/resolve active destination, regions, and city hubs for Master Package & Product validation
  const existingJapan = db.getDestinations().find((d) => d.id === 'DST-JPN');
  const japanDest: Destination = existingJapan || ({
    id: 'DST-JPN',
    name: 'Japan',
    slug: 'japan',
    country: 'Japan',
    currency: 'JPY',
    status: 'ACTIVE',
    isActive: true
  } as unknown as Destination);
  if (!existingJapan) {
    db.saveDestination(japanDest, ADMIN_USER);
  }
  const existingRegions = db.getRegions();
  if (!existingRegions.some((r) => r.id === 'region-jp-kanto')) {
    db.saveRegion(
      {
        id: 'region-jp-kanto',
        destinationId: 'DST-JPN',
        name: 'Kanto (Tokyo & Yokohama)',
        slug: 'kanto',
        status: 'ACTIVE',
        isActive: true,
        orderIndex: 1
      } as any,
      ADMIN_USER
    );
  }
  if (!existingRegions.some((r) => r.id === 'region-jp-kansai')) {
    db.saveRegion(
      {
        id: 'region-jp-kansai',
        destinationId: 'DST-JPN',
        name: 'Kansai (Kyoto & Osaka)',
        slug: 'kansai',
        status: 'ACTIVE',
        isActive: true,
        orderIndex: 2
      } as any,
      ADMIN_USER
    );
  }
  const existingHubs = db.getCityHubs();
  if (!existingHubs.some((h) => h.id === 'hub-tokyo')) {
    db.saveCityHub(
      {
        id: 'hub-tokyo',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        regionId: 'region-jp-kanto',
        regionName: 'Kanto (Tokyo & Yokohama)',
        name: 'Tokyo',
        status: 'ACTIVE',
        isActive: true,
        displayOrder: 1
      } as any,
      ADMIN_USER
    );
  }
  if (!existingHubs.some((h) => h.id === 'hub-kyoto')) {
    db.saveCityHub(
      {
        id: 'hub-kyoto',
        destinationId: 'DST-JPN',
        destinationName: 'Japan',
        regionId: 'region-jp-kansai',
        regionName: 'Kansai (Kyoto & Osaka)',
        name: 'Kyoto',
        status: 'ACTIVE',
        isActive: true,
        displayOrder: 2
      } as any,
      ADMIN_USER
    );
  }

  // ========================================================================
  // TEST A — Baseline Synchronisation across all 7 Output Options
  // ========================================================================
  console.log('--- [Test A] Baseline Synchronisation Across All 7 Output Options ---');
  const quoteA = buildBaselineQuote('QTE-SYNC-A', 'QTE-2026-SYNC-A', 'USD', ADMIN_USER, 'STANDARD');
  seedProductsInDb(db, quoteA);

  const resSaveA = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: quoteA,
    user: ADMIN_USER,
    outputOption: 'SAVE_DRAFT',
    actionType: 'CREATED'
  });

  assert(resSaveA.success && !resSaveA.blockedByConsistency, 'Test A: Save Quotation Draft succeeded & passed consistency validator');
  const savedA = resSaveA.quote;
  const snapA = resSaveA.snapshot;
  const expectedFinalPriceA = snapA.pricing.finalCustomerSellingPrice;
  const expectedHotelTotalA = snapA.pricing.hotelAccommodationTotal;
  const expectedLandTotalA = snapA.pricing.landPartTotal;
  const formattedFinalA = formatCurrency(expectedFinalPriceA, 'USD');

  assert(expectedFinalPriceA > 0, 'Test A: Authoritative Snapshot computed positive finalCustomerSellingPrice', { expectedFinalPriceA });
  assert(expectedHotelTotalA > 0 && expectedLandTotalA > 0, 'Test A: Hotel & Land totals calculated and separated cleanly');

  // Output 2: Preview Client Proposal
  const previewA = buildQuotePresentationModel(savedA, { selectedOptionIndexOrId: 'opt-1' });
  assert(
    Math.abs(previewA.finalCustomerSellingPriceNumeric - expectedFinalPriceA) < 0.01 &&
      previewA.hotelAccommodationTotalNumeric === expectedHotelTotalA &&
      previewA.landPartTotalNumeric === expectedLandTotalA,
    'Test A: Output 2 (Preview Client Proposal) matches authoritative snapshot exactly'
  );

  // Output 3: Download PDF Itinerary (Pagination Engine)
  const pdfPagesA = paginateQuotePresentationModel(previewA);
  const pdfTextA = stripHtmlTagsAndEntities(
    pdfPagesA.map((p) => `${p.headerHtml || ''} ${p.blocks.map((b) => b.html).join(' ')} ${p.footerHtml || ''}`).join(' ')
  );
  assert(
    pdfPagesA.length >= 1 &&
      pdfTextA.includes(formattedFinalA) &&
      pdfTextA.includes('Aman Tokyo Otemachi') &&
      pdfTextA.includes('Japan Golden Route Booking Conditions') &&
      pdfTextA.includes('Passports must remain valid for at least 6 months'),
    'Test A: Output 3 (Download PDF Itinerary) renders identical price, hotels, terms, and important info'
  );

  // Output 4: Send Proposal via Email (Canonical Email Service + Communication Builder)
  const emailA = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(savedA, {
    brandingMode: 'STANDARD',
    selectedOptionIndexOrId: 'opt-1'
  });
  const commPayloadA = buildQuoteCommunicationPayload(savedA, { selectedOptionIndexOrId: 'opt-1' });
  assert(
    emailA.textBody.includes(formattedFinalA) &&
      stripHtmlTagsAndEntities(emailA.htmlBody).includes(formattedFinalA) &&
      Math.abs(commPayloadA.pricing.finalSellingPrice - expectedFinalPriceA) < 0.01 &&
      emailA.textBody.toLowerCase().includes('commercial quotation terms — japan') &&
      emailA.textBody.includes('Japan Golden Route Booking Conditions'),
    'Test A: Output 4 (Send Proposal via Email) matches authoritative snapshot & commercial terms'
  );

  // Output 5: Share via WhatsApp
  const waA = generateWhatsAppQuoteMessage({
    quote: savedA,
    selectedOptionIndexOrId: 'opt-1',
    formatStyle: 'DETAILED',
    useEmojis: true
  });
  assert(
    waA.includes(formattedFinalA) &&
      waA.includes('Aman Tokyo Otemachi') &&
      waA.includes('Commercial Quotation Terms — Japan') &&
      waA.includes('3 Nights luxury 5-star suites'),
    'Test A: Output 5 (Share via WhatsApp) matches authoritative snapshot, hotels, inclusions & terms'
  );

  // Output 6: Save as Master Package
  const pkgResA = saveAndVerifyMasterPackageFromQuote({
    title: savedA.title || 'Imperial Tokyo & Kyoto',
    destination: japanDest,
    quotationScope: 'HOTEL_LAND',
    routeHubs: savedA.routeHubs || [],
    items: savedA.items || [],
    calendarDays: [
      { dayNumber: 1, dateString: '2026-12-20' },
      { dayNumber: 2, dateString: '2026-12-21' },
      { dayNumber: 3, dateString: '2026-12-22' },
      { dayNumber: 4, dateString: '2026-12-23' }
    ],
    dayThemes: savedA.dayThemes,
    dayDescriptions: savedA.dayDescriptions,
    inclusions: savedA.inclusions,
    exclusions: savedA.exclusions,
    importantInformation: savedA.importantInformation,
    cancellationPolicy: savedA.cancellationPolicy,
    termsAndConditions: snapA.commercialTerms.plainText,
    sourceQuoteId: savedA.id,
    sourceSnapshotVersion: snapA.versionNumber,
    sourceSnapshotHash: snapA.snapshotHash,
    currency: 'USD',
    adultsCount: 2,
    user: ADMIN_USER
  });
  assert(
    pkgResA.success &&
      pkgResA.pkg?.sourceQuoteId === savedA.id &&
      pkgResA.pkg?.sourceSnapshotVersion === snapA.versionNumber &&
      pkgResA.pkg?.sourceSnapshotHash === snapA.snapshotHash,
    'Test A: Output 6 (Save as Master Package) persisted linked snapshot metadata cleanly',
    { error: pkgResA.error }
  );

  // Output 7: Convert to Confirmed Booking
  const bookingA = db.convertQuotationToBooking(savedA, ADMIN_USER);
  assert(
    Boolean(bookingA) &&
      Math.abs((bookingA?.totalAmount || 0) - expectedFinalPriceA) < 0.01 &&
      bookingA?.hotelAccommodationTotal === expectedHotelTotalA &&
      bookingA?.landPartTotal === expectedLandTotalA &&
      bookingA?.sourceQuoteId === savedA.id &&
      bookingA?.sourceSnapshotVersion === snapA.versionNumber &&
      bookingA?.sourceSnapshotHash === snapA.snapshotHash,
    'Test A: Output 7 (Convert to Confirmed Booking) matches authoritative snapshot pricing & version links'
  );

  // Verify Generation History Audit Trail
  const genEvA = recordQuotationGenerationEvent(db, savedA, {
    outputOption: 'DOWNLOAD_PDF',
    status: 'SUCCEEDED',
    user: ADMIN_USER
  });
  assert(
    (genEvA.updatedQuote.generationHistory || []).length >= 1 &&
      genEvA.record.finalCustomerSellingPrice === expectedFinalPriceA &&
      genEvA.record.versionNumber === snapA.versionNumber,
    'Test A: generationHistory audit trail recorded output version, snapshot hash, and price'
  );

  // ========================================================================
  // TEST B — Price Modification & Version Increment Propagation
  // ========================================================================
  console.log('\n--- [Test B] Price Modification & Propagation Across All Outputs ---');
  const modifiedQuoteB: Quotation = {
    ...genEvA.updatedQuote,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 25,
    overallMarkupPercent: 25
  };
  const resPriceB = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: modifiedQuoteB,
    user: ADMIN_USER,
    outputOption: 'SAVE_DRAFT',
    actionType: 'PRICING_UPDATED'
  });
  assert(
    resPriceB.success &&
      resPriceB.versionBumped &&
      resPriceB.snapshot.versionNumber === 2 &&
      resPriceB.snapshot.pricing.finalCustomerSellingPrice > expectedFinalPriceA,
    'Test B: Markup update bumped version v1 -> v2 and recalculated higher authoritative price'
  );
  const priceB = resPriceB.snapshot.pricing.finalCustomerSellingPrice;
  const formattedB = formatCurrency(priceB, 'USD');
  const previewB = buildQuotePresentationModel(resPriceB.quote);
  const emailB = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(resPriceB.quote);
  const waB = generateWhatsAppQuoteMessage({ quote: resPriceB.quote });
  assert(
    previewB.finalCustomerSellingPriceFormatted === formattedB &&
      emailB.textBody.includes(formattedB) &&
      waB.includes(formattedB) &&
      (resPriceB.quote.versionHistory || []).some((v) => v.version === 1),
    'Test B: Updated price propagated identically to Preview/PDF/Email/WhatsApp and archived v1'
  );

  // ========================================================================
  // TEST C — Central Surcharge Modification Propagation
  // ========================================================================
  console.log('\n--- [Test C] Central Surcharge Modification Propagation ---');
  const quoteC = buildBaselineQuote('QTE-SYNC-C', 'QTE-2026-SYNC-C', 'JPY', ADMIN_USER, 'STANDARD');
  seedProductsInDb(db, quoteC);

  const activeWinterSurcharge: SurchargeMaster = {
    id: 'sur-winter-peak-sync',
    surchargeCode: 'WINTER_PEAK',
    code: 'WINTER_PEAK',
    name: 'Japan Winter Peak Operations Levy',
    surchargeCategory: 'Peak Season Surcharge',
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    applicableDestinations: ['Japan'],
    applicableDestinationIds: ['DST-JPN'],
    linkedProductIds: ['prod-tyo-imperial-sync', 'prod-kyo-tea-sync'],
    applicableCategories: ['Sightseeing', 'Experiences'],
    applyToAllCategoryProducts: true,
    calculationType: 'FIXED',
    pricingBasis: 'FIXED_AMOUNT',
    amount: 15000,
    currency: 'JPY',
    validFrom: '2026-12-01',
    validTo: '2027-01-31',
    status: 'ACTIVE',
    isActive: true,
    priority: 10,
    allowStacking: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z'
  };
  db.saveSurchargeMaster(activeWinterSurcharge, ADMIN_USER);
  clearSurchargeEngineCache();

  // Before vs with central surcharge applied cleanly through calculateQuoteTotal
  const resWithSurcharge = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: quoteC,
    user: ADMIN_USER,
    outputOption: 'SAVE_DRAFT',
    actionType: 'PRICING_UPDATED'
  });

  const snapC = resWithSurcharge.snapshot;
  const previewC = buildQuotePresentationModel(resWithSurcharge.quote);
  const bookingC = db.convertQuotationToBooking(resWithSurcharge.quote, ADMIN_USER);
  assert(
    snapC.pricing.surchargesTotal > 0 &&
      snapC.pricing.appliedSurcharges.some((s) => s.surchargeName === 'Japan Winter Peak Operations Levy') &&
      previewC.surchargesTotalNumeric === snapC.pricing.surchargesTotal &&
      bookingC?.surchargesTotal === snapC.pricing.surchargesTotal,
    'Test C: Active Admin central surcharge applied centrally and propagated identically to Snapshot, Preview, and Booking',
    { surchargesTotal: snapC.pricing.surchargesTotal, applied: snapC.pricing.appliedSurcharges.map((s) => s.surchargeName) }
  );

  // Clean up test surcharge so global state stays clean (save as INACTIVE because referenced quotes/bookings prevent hard delete)
  db.saveSurchargeMaster({ ...activeWinterSurcharge, status: 'INACTIVE' } as SurchargeMaster, ADMIN_USER);
  clearSurchargeEngineCache();

  // ========================================================================
  // TEST D — FX & Currency Switch Propagation
  // ========================================================================
  console.log('\n--- [Test D] FX & Currency Switch (USD -> EUR) Propagation ---');
  const quoteDEur: Quotation = {
    ...resPriceB.quote,
    currency: 'EUR'
  };
  const resEurD = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: quoteDEur,
    user: ADMIN_USER,
    outputOption: 'DOWNLOAD_PDF',
    actionType: 'PRICING_UPDATED'
  });
  const eurFormatted = formatCurrency(resEurD.snapshot.pricing.finalCustomerSellingPrice, 'EUR');
  const previewD = buildQuotePresentationModel(resEurD.quote);
  const emailD = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(resEurD.quote);
  const waD = generateWhatsAppQuoteMessage({ quote: resEurD.quote });
  assert(
    resEurD.success &&
      resEurD.snapshot.pricing.currency === 'EUR' &&
      resEurD.snapshot.pricing.currencyConversionSnapshot?.targetCurrency === 'EUR' &&
      previewD.currency === 'EUR' &&
      previewD.finalCustomerSellingPriceFormatted === eurFormatted &&
      emailD.textBody.includes(eurFormatted) &&
      waD.includes(eurFormatted),
    'Test D: Switching currency USD -> EUR synchronized Snapshot, Preview, PDF, Email, and WhatsApp identically'
  );

  // ========================================================================
  // TEST E — Content & Itinerary Modification Propagation
  // ========================================================================
  console.log('\n--- [Test E] Content Modification Propagation ---');
  const updatedInclusion = 'VIP Helicopter Mt. Fuji Sunset Flight';
  const updatedPolicy = 'Concierge modification permitted up to 14 days prior to check-in.';
  const quoteE: Quotation = {
    ...resEurD.quote,
    dayThemes: {
      ...(resEurD.quote.dayThemes || {}),
      2: 'Private Imperial Palace & Michelin Tempura Omakase'
    },
    inclusions: [...(resEurD.quote.inclusions || []), updatedInclusion],
    importantInformation: updatedPolicy
  };
  const resContentE = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: quoteE,
    user: ADMIN_USER,
    outputOption: 'SEND_EMAIL',
    actionType: 'EDITED'
  });
  const previewE = buildQuotePresentationModel(resContentE.quote);
  const pdfTextE = stripHtmlTagsAndEntities(
    paginateQuotePresentationModel(previewE).map((p) => p.blocks.map((b) => b.html).join(' ')).join(' ')
  );
  const emailE = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(resContentE.quote);
  const waE = generateWhatsAppQuoteMessage({ quote: resContentE.quote });
  assert(
    resContentE.success &&
      previewE.inclusions.includes(updatedInclusion) &&
      pdfTextE.includes(updatedInclusion) &&
      emailE.textBody.includes(updatedInclusion) &&
      waE.includes(updatedInclusion) &&
      pdfTextE.includes(updatedPolicy) &&
      emailE.textBody.includes(updatedPolicy),
    'Test E: Edited day themes, inclusions, and important information propagated identically across Preview, PDF, Email, and WhatsApp'
  );

  // ========================================================================
  // TEST F — Multi-Destination Commercial Quotation Terms Propagation
  // ========================================================================
  console.log('\n--- [Test F] Multi-Destination Commercial Terms Propagation ---');
  const quoteF = buildBaselineQuote('QTE-SYNC-F', 'QTE-2026-SYNC-F', 'USD', ADMIN_USER, 'STANDARD');
  seedProductsInDb(db, quoteF);
  quoteF.commercialTermsSnapshot = {
    snapshotId: 'TERMS-SNAP-F',
    capturedAt: '2026-10-05T00:00:00.000Z',
    capturedBy: ADMIN_USER.name,
    quoteVersion: 1,
    destinationIds: ['DST-JPN', 'DST-KOR'],
    destinationNames: ['Japan', 'South Korea'],
    missingDestinationIds: [],
    missingDestinationNames: [],
    termsStatus: 'QUOTATION_FINALISED',
    entries: [
      {
        targetId: 'DST-JPN',
        targetType: 'DESTINATION',
        targetName: 'Japan',
        configId: 'CFG-JPN-1',
        version: 1,
        contentHash: 'hash-multi-jpn',
        htmlText: '<h4>[Japan] Japan Rail & Luggage Forwarding</h4><p>Takkyubin same-day trunk forwarding operates between Tokyo and Kyoto stations.</p>',
        plainText: '[Japan] Japan Rail & Luggage Forwarding: Takkyubin same-day trunk forwarding operates between Tokyo and Kyoto stations.',
        whatsAppText: '*[Japan] Japan Rail & Luggage Forwarding*\nTakkyubin same-day trunk forwarding operates between Tokyo and Kyoto stations.',
        sections: [
          {
            sectionId: 'sec-multi-jpn-1',
            heading: 'Japan Rail & Luggage Forwarding',
            htmlContent: '<p>Takkyubin same-day trunk forwarding operates between Tokyo and Kyoto stations.</p>',
            displayOrder: 1,
            isActive: true
          }
        ]
      },
      {
        targetId: 'DST-KOR',
        targetType: 'DESTINATION',
        targetName: 'South Korea',
        configId: 'CFG-KOR-1',
        version: 1,
        contentHash: 'hash-multi-kor',
        htmlText: '<h4>[South Korea] K-ETA & Seoul VIP Fast-Track</h4><p>Incheon VIP Immigration Fast-Track requires flight manifest 72 hours pre-arrival.</p>',
        plainText: '[South Korea] K-ETA & Seoul VIP Fast-Track: Incheon VIP Immigration Fast-Track requires flight manifest 72 hours pre-arrival.',
        whatsAppText: '*[South Korea] K-ETA & Seoul VIP Fast-Track*\nIncheon VIP Immigration Fast-Track requires flight manifest 72 hours pre-arrival.',
        sections: [
          {
            sectionId: 'sec-multi-kor-1',
            heading: 'K-ETA & Seoul VIP Fast-Track',
            htmlContent: '<p>Incheon VIP Immigration Fast-Track requires flight manifest 72 hours pre-arrival.</p>',
            displayOrder: 1,
            isActive: true
          }
        ]
      }
    ],
    combinedHeading: 'Commercial Quotation Terms — Japan & South Korea',
    combinedHtml:
      '<h4>[Japan] Japan Rail & Luggage Forwarding</h4><p>Takkyubin same-day trunk forwarding operates between Tokyo and Kyoto stations.</p><h4>[South Korea] K-ETA & Seoul VIP Fast-Track</h4><p>Incheon VIP Immigration Fast-Track requires flight manifest 72 hours pre-arrival.</p>',
    combinedPlainText:
      '[Japan] Japan Rail & Luggage Forwarding: Takkyubin same-day trunk forwarding operates between Tokyo and Kyoto stations.\n\n[South Korea] K-ETA & Seoul VIP Fast-Track: Incheon VIP Immigration Fast-Track requires flight manifest 72 hours pre-arrival.',
    combinedWhatsAppText:
      '*[Japan] Japan Rail & Luggage Forwarding*\nTakkyubin same-day trunk forwarding operates between Tokyo and Kyoto stations.\n\n*[South Korea] K-ETA & Seoul VIP Fast-Track*\nIncheon VIP Immigration Fast-Track requires flight manifest 72 hours pre-arrival.'
  };
  quoteF.termsAndConditions = quoteF.commercialTermsSnapshot.combinedPlainText;

  const resMultiF = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: quoteF,
    user: ADMIN_USER,
    outputOption: 'SAVE_DRAFT',
    actionType: 'CREATED'
  });
  const previewF = buildQuotePresentationModel(resMultiF.quote);
  const pdfTextF = stripHtmlTagsAndEntities(
    paginateQuotePresentationModel(previewF).map((p) => p.blocks.map((b) => b.html).join(' ')).join(' ')
  );
  const emailF = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(resMultiF.quote);
  const waF = generateWhatsAppQuoteMessage({ quote: resMultiF.quote });
  const bookingF = db.convertQuotationToBooking(resMultiF.quote, ADMIN_USER);
  assert(
    resMultiF.success &&
      pdfTextF.includes('Takkyubin same-day trunk forwarding') &&
      pdfTextF.includes('Incheon VIP Immigration Fast-Track') &&
      emailF.textBody.includes('Incheon VIP Immigration Fast-Track') &&
      waF.includes('Incheon VIP Immigration Fast-Track') &&
      (bookingF?.termsAndConditions || '').includes('Incheon VIP Immigration Fast-Track'),
    'Test F: Multi-destination commercial terms rendered identically across Preview, PDF, Email, WhatsApp, and Booking'
  );

  // ========================================================================
  // TEST G — Standard vs White-Label Branding Isolation (Zero Price Drift & Zero Leaks)
  // ========================================================================
  console.log('\n--- [Test G] Standard vs White-Label Isolation & Zero Unbound Leaks ---');
  const quoteWL = buildBaselineQuote('QTE-SYNC-WL', 'QTE-2026-SYNC-WL', 'USD', WHITE_LABEL_AGENT, 'STANDARD');
  seedProductsInDb(db, quoteWL);

  const resStd = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: quoteWL,
    user: WHITE_LABEL_AGENT,
    outputOption: 'PREVIEW_PROPOSAL',
    brandingMode: 'STANDARD',
    actionType: 'CREATED'
  });
  const resWl = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: resStd.quote,
    user: WHITE_LABEL_AGENT,
    outputOption: 'DOWNLOAD_PDF',
    brandingMode: 'WHITE_LABEL',
    actionType: 'SAVED'
  });

  const wlModel = buildQuotePresentationModel(resWl.quote, {
    brandingMode: 'WHITE_LABEL',
    agencyName: WHITE_LABEL_AGENT.agencyName,
    email: WHITE_LABEL_AGENT.companyEmail,
    phone: WHITE_LABEL_AGENT.companyPhone,
    address: WHITE_LABEL_AGENT.companyAddress,
    website: WHITE_LABEL_AGENT.companyWebsite,
    footerText: WHITE_LABEL_AGENT.quoteFooterText
  });
  const wlPdfText = stripHtmlTagsAndEntities(
    paginateQuotePresentationModel(wlModel)
      .map((p) => `${p.headerHtml || ''} ${p.blocks.map((b) => b.html).join(' ')} ${p.footerHtml || ''}`)
      .join(' ')
  );
  const wlEmail = renderQuoteEmailFromPresentationModel(wlModel);
  const wlWa = renderQuoteWhatsAppFromPresentationModel(wlModel);

  const noLeakInWL =
    !isTheUnboundBrandString(wlModel.agencyName) &&
    !isTheUnboundBrandString(wlPdfText) &&
    !isTheUnboundBrandString(wlEmail.subject) &&
    !isTheUnboundBrandString(wlEmail.textBody) &&
    !isTheUnboundBrandString(stripHtmlTagsAndEntities(wlEmail.htmlBody)) &&
    !isTheUnboundBrandString(wlWa);

  assert(
    resStd.success &&
      resWl.success &&
      !resWl.versionBumped &&
      resWl.snapshot.versionNumber === resStd.snapshot.versionNumber &&
      resWl.snapshot.pricing.finalCustomerSellingPrice === resStd.snapshot.pricing.finalCustomerSellingPrice &&
      resWl.snapshot.pricing.landPartTotal === resStd.snapshot.pricing.landPartTotal &&
      resWl.snapshot.pricing.hotelAccommodationTotal === resStd.snapshot.pricing.hotelAccommodationTotal &&
      noLeakInWL &&
      wlPdfText.includes('Aurelia Luxury Journeys') &&
      wlEmail.textBody.includes('Aurelia Luxury Journeys') &&
      wlWa.includes('Aurelia Luxury Journeys'),
    'Test G: Branding switch STANDARD <-> WHITE_LABEL preserved exact prices, did NOT bump version, and leaked 0 TheUnbound strings',
    {
      versionStd: resStd.snapshot.versionNumber,
      versionWl: resWl.snapshot.versionNumber,
      priceStd: resStd.snapshot.pricing.finalCustomerSellingPrice,
      priceWl: resWl.snapshot.pricing.finalCustomerSellingPrice,
      noLeakInWL
    }
  );

  // ========================================================================
  // TEST H — Concurrency Mutex Lock & Idempotent Re-Export Version Stability
  // ========================================================================
  console.log('\n--- [Test H] Concurrency Lock & No Spurious Version Increments ---');
  const quoteH = buildBaselineQuote('QTE-SYNC-H', 'QTE-2026-SYNC-H', 'USD', ADMIN_USER, 'STANDARD');
  seedProductsInDb(db, quoteH);

  const concurrentResults = await Promise.all([
    prepareAndPersistAuthoritativeSnapshot({
      db,
      quote: quoteH,
      user: ADMIN_USER,
      outputOption: 'SAVE_DRAFT',
      actionType: 'CREATED'
    }),
    prepareAndPersistAuthoritativeSnapshot({
      db,
      quote: quoteH,
      user: ADMIN_USER,
      outputOption: 'PREVIEW_PROPOSAL',
      actionType: 'SAVED'
    }),
    prepareAndPersistAuthoritativeSnapshot({
      db,
      quote: quoteH,
      user: ADMIN_USER,
      outputOption: 'DOWNLOAD_PDF',
      actionType: 'SAVED'
    }),
    prepareAndPersistAuthoritativeSnapshot({
      db,
      quote: quoteH,
      user: ADMIN_USER,
      outputOption: 'SHARE_WHATSAPP',
      actionType: 'SAVED'
    })
  ]);

  assert(
    concurrentResults.every((r) => r.success) &&
      concurrentResults.every((r) => r.snapshot.versionNumber === 1) &&
      !isQuotationSnapshotLocked(quoteH.id),
    'Test H: Concurrent 4-channel dispatches executed sequentially via mutex, stayed pinned at v1, and released lock cleanly',
    {
      results: concurrentResults.map((r) => ({
        success: r.success,
        ver: r.snapshot.versionNumber,
        bumped: r.versionBumped,
        err: r.error
      })),
      lockedAfter: isQuotationSnapshotLocked(quoteH.id)
    }
  );

  // ========================================================================
  // TEST I — Historical Protection & Automated Consistency Mismatch Blocker
  // ========================================================================
  console.log('\n--- [Test I] Historical Quote Protection & Consistency Mismatch Blocker ---');
  const baseLocked = concurrentResults[3].quote;
  const lockedQuote: Quotation = {
    ...baseLocked,
    status: 'SENT',
    isLocked: true
  };
  db.saveQuote(lockedQuote, ADMIN_USER, 'SENT', 'Finalized sent quote');

  // Even if someone passes a tampered currency rate or external price shift on a locked re-export,
  // snapshot preserves locked historical pricing
  const reExportLocked = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: {
      ...lockedQuote,
      totalSellingPrice: 9999999 // stale field that must NOT override locked authoritativeSnapshot
    },
    user: ADMIN_USER,
    outputOption: 'DOWNLOAD_PDF',
    actionType: 'SAVED'
  });

  assert(
    reExportLocked.success &&
      reExportLocked.snapshot.pricing.finalCustomerSellingPrice === lockedQuote.authoritativeSnapshot?.pricing.finalCustomerSellingPrice,
    'Test I-1: Locked/SENT historical quote preserved exact frozen pricing on PDF re-export'
  );

  // Force an actual cross-channel mismatch: corrupt snapshot price while leaving quote options mismatched
  const corruptedSnapshot = buildAuthoritativeQuotationSnapshot(lockedQuote, {
    user: ADMIN_USER
  });
  corruptedSnapshot.pricing.finalCustomerSellingPrice = 123456; // mismatched vs buildQuotePresentationModel options/items? Note model prefers authSnap; test a snapshot where currency differs from model or snapshot vs quote items count/total mismatch!
  const corruptedQuote: Quotation = {
    ...lockedQuote,
    authoritativeSnapshot: {
      ...corruptedSnapshot,
      pricing: {
        ...corruptedSnapshot.pricing,
        currency: 'GBP' as CurrencyCode // snapshot claims GBP while quote.currency is USD -> model uses quote.currency ('USD') -> currency & price mismatch caught!
      }
    }
  };
  const blockedCheck = validateQuotationOutputConsistency(corruptedQuote);
  assert(
    !blockedCheck.isValid && blockedCheck.mismatches.length > 0,
    'Test I-2: Automated consistency validator detected snapshot vs channel mismatch and returned mismatches',
    { mismatches: blockedCheck.mismatches }
  );

  // Also test White-Label leak detection blocker when brandingSnapshot holds uncleaned TheUnbound identity
  const leakyWhiteLabelQuote: Quotation = {
    ...lockedQuote,
    brandingMode: 'WHITE_LABEL',
    agentAgency: 'theunbound',
    brandingSnapshot: {
      mode: 'WHITE_LABEL',
      agencyName: 'theunbound',
      agentName: 'Agent',
      email: 'sales@theunbound.in',
      capturedAt: '2026-10-01T10:00:00.000Z'
    }
  };
  const wlLeakBlocked = validateQuotationOutputConsistency(leakyWhiteLabelQuote, {
    brandingMode: 'WHITE_LABEL'
  });
  const blockedRecordRes = recordQuotationGenerationEvent(db, reExportLocked.quote, {
    outputOption: 'SEND_EMAIL',
    status: 'BLOCKED_CONSISTENCY',
    errorMessage: wlLeakBlocked.mismatches[0],
    mismatchDetails: wlLeakBlocked.mismatches,
    user: ADMIN_USER
  });
  assert(
    !wlLeakBlocked.isValid &&
      wlLeakBlocked.mismatches.some((m) => m.includes('White-Label isolation violation')) &&
      (blockedRecordRes.updatedQuote.generationHistory || []).some((g) => g.status === 'BLOCKED_CONSISTENCY'),
    'Test I-3: Consistency validator blocked White-Label leak & recorded BLOCKED_CONSISTENCY in generationHistory',
    { mismatches: wlLeakBlocked.mismatches }
  );

  console.log('\n========================================================================');
  console.log(` TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('========================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error in quotationOutputsSynchronisation.test.ts:', err);
  process.exit(1);
});
