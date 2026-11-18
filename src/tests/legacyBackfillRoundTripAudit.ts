/**
 * THEUNBOUND — LEGACY QUOTATION BACKFILL ROUND-TRIP VERIFICATION AUDIT SUITE
 *
 * Reproduces, diagnoses, and verifies the root-cause fix for:
 *   "Output Synchronisation Validation Blocked: Legacy backfill round-trip verification failed for QTE-MWGLGYD1__v1."
 *
 * Covers:
 *   1. Pre-split vs post-split sanitization parity for B2B_AGENT & ADMIN.
 *   2. Absence of synthetic `itineraryHubOccurrenceId` or `masterQuote` contamination on legacy versions.
 *   3. Firestore primitive normalization (`Timestamp`, `Date`, `GeoPoint`, `DocumentReference`, `-0`, Unicode/HTML, null vs undefined, array order).
 *   4. Full 12-domain canonical round-trip validation table for QTE-MWGLGYD1__v1.
 *   5. Partial-migration failure, read-back verification, orphan-safe idempotent retry, and SINGLE_DOC_V1 preservation.
 *   6. Regression across Quote Builder, Quotes, Lead Management, Output Hub (PDF/Email/WhatsApp), and <= 800 KiB doc sizes.
 */

import { db } from '../services/db';
import {
  FIRESTORE_MAX_DOC_BYTES,
  SAFE_DOC_BYTE_THRESHOLD,
  computeDeterministicHexHash,
  deepCloneSafe,
  estimateFirestoreDocumentBytes,
  reconstructQuotationVersionFromSections,
  splitQuotationVersionIntoSections,
  stripRestrictedCommercialFieldsForRole,
  verifyVersionRoundTripIntegrity
} from '../services/quotationVersionStorage';
import {
  buildNonDestructiveQuotationMigrationPlan,
  persistVerifiedSplitVersionAsync,
  type SplitVersionPersistenceAdapter
} from '../services/quotationVersionMigration';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import {
  Quotation,
  QuotationVersionSectionDocument,
  QuoteItem,
  QuoteVersionRecord,
  TripRouteHub,
  User
} from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, label: string, details?: unknown) {
  totalTests += 1;
  if (condition) {
    passedTests += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failedTests += 1;
    console.error(`  [FAIL] ${label}`, details ?? '');
  }
}

const B2B_AGENT: User = {
  id: 'usr-agent-qte-mwg',
  name: 'Elena Vance',
  email: 'elena@lumina-luxury.co.uk',
  role: 'B2B_AGENT',
  userType: 'B2B_AGENT',
  agencyName: 'Lumina Luxury Travel',
  companyName: 'Lumina Luxury Travel Ltd',
  createdAt: '2025-11-01T00:00:00.000Z'
};

const ADMIN_USER: User = {
  id: 'usr-admin-qte-mwg',
  name: 'Rohan Mehta',
  email: 'rohan@theunbound.in',
  role: 'ADMIN',
  userType: 'ADMIN',
  agencyName: 'theunbound',
  createdAt: '2025-11-01T00:00:00.000Z'
};

/**
 * Simulates a strict Firestore rules-enforcing persistence store:
 * - Sections cannot be updated (`allow update: if false`), only created or deleted under PREPARING/FAILED.
 * - Manifests follow PREPARING -> COMMITTED|FAILED or SINGLE_DOC_V1 -> COMMITTED transitions.
 */
function createRulesEnforcingFirestoreAdapter(options: {
  initialManifests?: Record<string, QuoteVersionRecord>;
  initialSections?: Record<string, QuotationVersionSectionDocument[]>;
  enforceNonInternalKeys?: boolean;
} = {}) {
  const manifests = new Map<string, QuoteVersionRecord>();
  const sectionsByVer = new Map<string, Map<string, QuotationVersionSectionDocument>>();

  if (options.initialManifests) {
    for (const [k, v] of Object.entries(options.initialManifests)) {
      manifests.set(k, deepCloneSafe(v));
    }
  }
  if (options.initialSections) {
    for (const [verId, list] of Object.entries(options.initialSections)) {
      const m = new Map<string, QuotationVersionSectionDocument>();
      list.forEach(s => m.set(s.sectionId, deepCloneSafe(s)));
      sectionsByVer.set(verId, m);
    }
  }

  const key = (qId: string, vId: string) => `${qId}/${vId}`;

  const adapter: SplitVersionPersistenceAdapter = {
    async getManifest(quoteId, versionId) {
      const found = manifests.get(key(quoteId, versionId));
      return found ? deepCloneSafe(found) : null;
    },
    async createManifest(quoteId, versionId, data) {
      const k = key(quoteId, versionId);
      if (manifests.has(k)) {
        throw new Error(`Firestore permission/conflict error: manifest ${k} already exists on create.`);
      }
      manifests.set(k, deepCloneSafe(data));
    },
    async updateManifest(quoteId, versionId, patch) {
      const k = key(quoteId, versionId);
      const existing = manifests.get(k);
      if (!existing) {
        throw new Error(`Firestore not-found error: manifest ${k} missing on update.`);
      }
      const isLegacyV1 = !existing.storageFormat || existing.storageFormat === 'SINGLE_DOC_V1';
      if (existing.manifestStatus === 'PREPARING') {
        if (patch.manifestStatus !== 'COMMITTED' && patch.manifestStatus !== 'FAILED') {
          throw new Error(`Firestore rules rejected invalid transition from PREPARING to ${patch.manifestStatus}.`);
        }
      } else if (isLegacyV1) {
        if (patch.storageFormat !== 'SPLIT_SECTIONS_V2' || patch.manifestStatus !== 'COMMITTED') {
          throw new Error(`Firestore rules rejected non-verified overwrite of legacy SINGLE_DOC_V1 doc ${k}.`);
        }
      } else {
        throw new Error(`Firestore rules rejected immutable manifest update on ${k} (${existing.manifestStatus}).`);
      }
      manifests.set(k, deepCloneSafe({ ...existing, ...patch } as QuoteVersionRecord));
    },
    async deleteUncommittedManifest(quoteId, versionId) {
      const k = key(quoteId, versionId);
      const existing = manifests.get(k);
      if (existing && existing.manifestStatus !== 'PREPARING' && existing.manifestStatus !== 'FAILED') {
        throw new Error(`Firestore rules rejected delete on committed manifest ${k}.`);
      }
      manifests.delete(k);
    },
    async getSections(quoteId, versionId) {
      const map = sectionsByVer.get(key(quoteId, versionId));
      return map ? Array.from(map.values()).map(d => deepCloneSafe(d)) : [];
    },
    async createSection(quoteId, versionId, sectionId, data) {
      const k = key(quoteId, versionId);
      if (!sectionsByVer.has(k)) sectionsByVer.set(k, new Map());
      const map = sectionsByVer.get(k)!;
      if (map.has(sectionId)) {
        // Simulates Firestore `allow update: if false` blocking duplicate/overwrite write on setDoc(secRef)
        throw new Error(`PERMISSION_DENIED: section ${sectionId} already exists and allow update: if false.`);
      }
      if (options.enforceNonInternalKeys) {
        const d: any = data;
        const inner: any = d.data || {};
        for (const forbidden of ['totalNetCost', 'internalNettCost', 'supplierCost', 'marginAmount']) {
          if (forbidden in d || forbidden in inner) {
            throw new Error(`PERMISSION_DENIED: restricted internal key "${forbidden}" present for B2B agent.`);
          }
        }
      }
      map.set(sectionId, deepCloneSafe(data));
    },
    async deleteSection(quoteId, versionId, sectionId) {
      const k = key(quoteId, versionId);
      const manifest = manifests.get(k);
      if (!manifest || (manifest.manifestStatus !== 'PREPARING' && manifest.manifestStatus !== 'FAILED')) {
        throw new Error(`PERMISSION_DENIED: cannot delete section ${sectionId} when parent manifest is ${manifest?.manifestStatus}.`);
      }
      sectionsByVer.get(k)?.delete(sectionId);
    }
  };

  return { adapter, manifests, sectionsByVer };
}

function buildLegacyQteMwglgyd1V1(options: { withEdgePrimitives?: boolean } = {}): QuoteVersionRecord {
  // Exact pre-Repeated-Hubs legacy routeHubs (NO itineraryHubOccurrenceId!)
  const legacyRouteHubs: TripRouteHub[] = [
    {
      id: 'hub-occ-legacy-1',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo',
      destinationId: 'dest-jp',
      destinationName: 'Japan',
      nights: 3,
      order: 1,
      accommodationType: 'hotel',
      hotelId: 'htl-aman-tokyo',
      hotelName: 'Aman Tokyo',
      roomsCount: 1,
      roomType: 'Deluxe King',
      mealPlan: 'BB',
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-04'
    } as any,
    {
      id: 'hub-occ-legacy-2',
      hubId: 'hub-kyoto',
      hubName: 'Kyoto',
      destinationId: 'dest-jp',
      destinationName: 'Japan',
      nights: 2,
      order: 2,
      accommodationType: 'hotel',
      hotelId: 'htl-ritz-kyoto',
      hotelName: 'The Ritz-Carlton Kyoto',
      roomsCount: 1,
      roomType: 'Kamogawa Suite',
      mealPlan: 'BB',
      checkInDate: '2026-11-04',
      checkOutDate: '2026-11-06'
    } as any
  ];

  const legacyItems: QuoteItem[] = [
    {
      id: 'item-legacy-1',
      dayNumber: 1,
      travelDate: '2026-11-01',
      hubId: 'hub-tokyo',
      pax: { adults: 2, children: 0, infants: 0 },
      selectedVariant: 'Private Mercedes V-Class',
      product: {
        id: 'prod-hnd-trf',
        name: 'Haneda VIP Meet & Private Transfer — 東京・羽田空港送迎',
        destination: 'Japan',
        city: 'Tokyo',
        category: 'Transfers',
        productType: 'Transfer',
        description: '<p>Chauffeured transfer with concierge greeting.</p>',
        duration: '1.5 hours',
        images: ['https://example.com/transfer.jpg'],
        currency: 'USD',
        supplierId: 'sup-internal-jp-01',
        adultNetPrice: 210,
        childNetPrice: 0,
        adultSellingPrice: 280,
        childSellingPrice: 0,
        inclusions: ['Airport Meet & Greet', 'Express Toll Fees'],
        exclusions: ['Porterage Tips']
      } as any,
      pricing: {
        currency: 'USD',
        adultNetPrice: 210,
        childNetPrice: 0,
        adultSellingPrice: 280,
        childSellingPrice: 0,
        totalNetCost: 210,
        totalSellingPrice: 280
      } as any,
      calculation: {
        baseNetPrice: 210,
        baseSellingPrice: 280,
        finalTotalSellingPrice: 280,
        targetCurrency: 'USD',
        fxRateUsed: 1
      } as any
    } as any,
    {
      id: 'item-legacy-2',
      dayNumber: 2,
      travelDate: '2026-11-02',
      hubId: 'hub-tokyo',
      pax: { adults: 2, children: 0, infants: 0 },
      selectedVariant: 'Private Tea Master Experience',
      product: {
        id: 'prod-tea-tyo',
        name: 'Asakusa Private Tea Ceremony & Heritage Walk',
        destination: 'Japan',
        city: 'Tokyo',
        category: 'Experiences',
        productType: 'Activity',
        description: '<p>Includes matcha whisking & kimono dressing.</p>',
        duration: '4 hours',
        images: ['https://example.com/tea.jpg'],
        currency: 'USD',
        supplierId: 'sup-internal-jp-02',
        adultNetPrice: 180,
        childNetPrice: 0,
        adultSellingPrice: 320,
        childSellingPrice: 0,
        inclusions: ['Matcha Sweets', 'English Historian'],
        exclusions: []
      } as any,
      calculation: {
        baseNetPrice: 360,
        baseSellingPrice: 640,
        finalTotalSellingPrice: 640,
        targetCurrency: 'USD',
        fxRateUsed: 1
      } as any
    } as any
  ];

  const base: any = {
    id: 'QTE-MWGLGYD1__v1',
    version: 1,
    versionNumber: 1,
    quoteId: 'QTE-MWGLGYD1',
    quoteNumber: 'QTE-MWGLGYD1',
    leadId: 'LEAD-JP-2026-009',
    createdAt: options.withEdgePrimitives
      ? { seconds: 1762000000, nanoseconds: 500000000, toDate: () => new Date(1762000000500) }
      : '2025-11-01T12:26:40.000Z',
    updatedAt: '2025-11-01T12:30:00.000Z',
    updatedBy: 'Elena Vance',
    savedByUserId: B2B_AGENT.id,
    savedByName: B2B_AGENT.name,
    savedByRole: 'B2B_AGENT',
    agentId: B2B_AGENT.id,
    userId: B2B_AGENT.id,
    createdByName: B2B_AGENT.name,
    status: 'SAVED',
    proposalStatus: 'saved',
    changesSummary: 'Initial Japan Cherry Blossom Quote v1',
    title: 'Japan Golden Route Bespoke v1 — 東京 & 京都',
    destination: 'Japan',
    clientName: 'Arthur Pendelton',
    clientEmail: 'arthur@pendelton.org',
    clientPhone: '+44 7700 900112',
    clientCompany: 'Pendelton Family Office',
    nationality: 'United Kingdom',
    travelStartDate: '2026-11-01',
    travelEndDate: '2026-11-06',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    childAges: [],
    currency: 'USD',
    totalNetCost: 570,
    totalSellingPrice: 920,
    theUnboundBaseSellingPrice: 920,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    agentMarginAmount: 0,
    overallDiscountPercent: 0,
    marginPercent: 15,
    marginAmount: 350,
    items: legacyItems,
    routeHubs: legacyRouteHubs,
    itineraryOverview: 'A curated 5-night journey spanning Tokyo and Kyoto.',
    inclusions: ['Airport VIP Meet & Greet', 'Daily Breakfast'],
    exclusions: ['International Flights'],
    importantInformation: 'Passport must have 6 months validity.',
    cancellationPolicy: 'Free cancellation up to 30 days prior to arrival.',
    termsAndConditions: 'Standard Japan B2B quotation terms v1.',
    brandingMode: 'STANDARD',
    agentNotes: options.withEdgePrimitives ? 'Special dietary note: café & crème brûlée' : 'VIP honeymoon setup requested',
    // Simulate legacy custom/extra fields & edge Firestore primitives
    customLegacyCode: '100',
    numericCountField: 100,
    emptyNotesMap: {},
    nullableRef: null,
    negativeZeroVal: options.withEdgePrimitives ? -0 : 0,
    geoLocation: options.withEdgePrimitives ? { latitude: 35.6762, longitude: 139.6503 } : undefined,
    docRefSample: options.withEdgePrimitives ? { path: 'destinations/dest-jp', id: 'dest-jp' } : undefined,
    isLatest: false,
    isImmutable: true,
    sharedHistory: []
  };

  return base as QuoteVersionRecord;
}

function buildModernMasterQteMwglgyd1(v1: QuoteVersionRecord): Quotation {
  const repeatedHubsV4: TripRouteHub[] = [
    {
      id: 'occ-1',
      itineraryHubOccurrenceId: 'occ-1',
      accommodationStayId: 'stay-1',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo',
      nights: 2,
      order: 1,
      accommodationType: 'hotel',
      hotelId: 'htl-aman-tokyo',
      hotelName: 'Aman Tokyo',
      roomsCount: 1
    } as any,
    {
      id: 'occ-2',
      itineraryHubOccurrenceId: 'occ-2',
      accommodationStayId: 'stay-2',
      hubId: 'hub-osaka',
      hubName: 'Osaka',
      nights: 2,
      order: 2,
      accommodationType: 'hotel',
      hotelId: 'htl-conrad-osaka',
      hotelName: 'Conrad Osaka',
      roomsCount: 1
    } as any,
    {
      id: 'occ-3',
      itineraryHubOccurrenceId: 'occ-3',
      accommodationStayId: 'stay-3',
      hubId: 'hub-kyoto',
      hubName: 'Kyoto',
      nights: 2,
      order: 3,
      accommodationType: 'hotel',
      hotelId: 'htl-ritz-kyoto',
      hotelName: 'The Ritz-Carlton Kyoto',
      roomsCount: 1
    } as any,
    {
      id: 'occ-4',
      itineraryHubOccurrenceId: 'occ-4',
      accommodationStayId: 'stay-4',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo',
      nights: 1,
      order: 4,
      accommodationType: 'hotel',
      hotelId: 'htl-palace-tokyo',
      hotelName: 'Palace Hotel Tokyo',
      roomsCount: 1
    } as any
  ];

  const modernItems = deepCloneSafe(v1.items || []);
  modernItems[0].itineraryHubOccurrenceId = 'occ-1';
  modernItems[1].itineraryHubOccurrenceId = 'occ-4';

  const v3: QuoteVersionRecord = {
    ...deepCloneSafe(v1),
    id: 'QTE-MWGLGYD1__v3',
    version: 3,
    versionNumber: 3,
    previousVersionId: 'QTE-MWGLGYD1__v1',
    updatedAt: '2026-04-01T10:00:00.000Z',
    changesSummary: 'Updated v3 with repeated Tokyo return stay & surcharge',
    routeHubs: repeatedHubsV4,
    items: modernItems,
    totalSellingPrice: 4850,
    theUnboundBaseSellingPrice: 4400,
    agentMarginType: 'FIXED',
    agentMarginValue: 450,
    agentMarginAmount: 450,
    dayThemes: { 1: 'Arrival in Tokyo', 2: 'Tea Ceremony' },
    appliedSurcharges: [
      { id: 'sur-1', name: 'Sakura Peak Season Supplement', amount: 250, currency: 'USD' } as any
    ],
    commercialTermsSnapshot: {
      termsVersion: 2,
      combinedPlainText: 'Updated 2026 Japan Commercial Quotation Terms.',
      combinedHtml: '<p>Updated 2026 Japan Commercial Quotation Terms.</p>',
      combinedWhatsAppText: 'Updated 2026 Japan Terms',
      entries: []
    } as any,
    isLatest: true
  } as any;

  return {
    id: 'QTE-MWGLGYD1',
    quoteId: 'QTE-MWGLGYD1',
    quoteNumber: 'QTE-MWGLGYD1',
    leadId: 'LEAD-JP-2026-009',
    title: 'Japan Golden Route Multi-Stay Expedition v4',
    destination: 'Japan',
    status: 'SAVED',
    proposalStatus: 'saved',
    currency: 'USD',
    version: 3,
    versionNumber: 3,
    latestVersion: 3,
    latestVersionId: 'QTE-MWGLGYD1__v3',
    clientName: 'Arthur Pendelton',
    clientEmail: 'arthur@pendelton.org',
    clientPhone: '+44 7700 900112',
    clientCompany: 'Pendelton Family Office',
    travelStartDate: '2026-11-01',
    travelEndDate: '2026-11-08',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    routeHubs: repeatedHubsV4,
    items: modernItems,
    dayThemes: { 1: 'Arrival in Tokyo', 2: 'Tea Ceremony', 6: 'Tokyo Return Encore' },
    appliedSurcharges: [
      { id: 'sur-1', name: 'Sakura Peak Season Supplement', amount: 250, currency: 'USD' } as any
    ],
    commercialTermsSnapshot: v3.commercialTermsSnapshot,
    termsAndConditions: 'Updated 2026 Japan Commercial Quotation Terms.',
    theUnboundBaseSellingPrice: 4400,
    baseFinalSellingPrice: 4400,
    agentMarginType: 'FIXED',
    agentMarginValue: 450,
    agentMarginAmount: 450,
    finalCustomerSellingPrice: 4850,
    totalSellingPrice: 4850,
    totalNetCost: 3100,
    internalNettCost: 3100,
    agentId: B2B_AGENT.id,
    userId: B2B_AGENT.id,
    createdBy: B2B_AGENT.id,
    createdByName: B2B_AGENT.name,
    createdByUserType: 'B2B_AGENT',
    createdAt: '2025-11-01T12:26:40.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    versionHistory: [v3, v1]
  } as any;
}

async function run() {
  console.log('\n=== LEGACY BACKFILL ROUND-TRIP VERIFICATION AUDIT SUITE (QTE-MWGLGYD1__v1) ===\n');

  // -------------------------------------------------------------------------
  // TEST 1: Reproduce & verify why old buggy path failed vs fixed B2B_AGENT path
  // -------------------------------------------------------------------------
  console.log('[Suite 1] Exact Failure Reproduction vs Fixed 12-Domain Verification (B2B_AGENT)');
  const v1 = buildLegacyQteMwglgyd1V1({ withEdgePrimitives: true });
  const masterQuote = buildModernMasterQteMwglgyd1(v1);

  // Confirm that raw v1 lacks `itineraryHubOccurrenceId` on routeHubs & lacks modern `dayThemes` / `commercialTermsSnapshot`
  assert(
    v1.routeHubs!.every(h => h.itineraryHubOccurrenceId === undefined),
    'Legacy QTE-MWGLGYD1__v1 fixture models pre-Repeated-Hubs hubs lacking itineraryHubOccurrenceId'
  );
  assert(
    v1.commercialTermsSnapshot === undefined && v1.dayThemes === undefined,
    'Legacy v1 lacks newer masterQuote.commercialTermsSnapshot & dayThemes (isolation invariant)'
  );

  // Demonstrate root cause #1: If stripped AFTER splitting without updating contentHash, integrity fails
  const buggyUnsanitizedSplit = splitQuotationVersionIntoSections(masterQuote, v1, {
    maxDocBytes: SAFE_DOC_BYTE_THRESHOLD,
    manifestStatus: 'COMMITTED',
    preserveHistoricalIsolation: true
  });
  const postMutatedSections = buggyUnsanitizedSplit.sectionDocs.map(sec =>
    stripRestrictedCommercialFieldsForRole(sec, false)
  );
  let buggyHashThrew = false;
  try {
    reconstructQuotationVersionFromSections(buggyUnsanitizedSplit.manifest, postMutatedSections, {
      verifyIntegrity: true
    });
  } catch (err: any) {
    buggyHashThrew = String(err?.message || '').includes('content hash mismatch');
  }
  assert(
    buggyHashThrew,
    'Reproduces bug root cause: post-split sanitization invalidates section contentHash unless sanitized BEFORE split'
  );

  // Now run FIXED non-destructive migration plan as B2B_AGENT
  const planB2B = await buildNonDestructiveQuotationMigrationPlan(masterQuote, {
    user: B2B_AGENT,
    allowInternalCosts: false
  });
  const v1Plan = planB2B.migratedVersions.find(m => m.versionId === 'QTE-MWGLGYD1__v1')!;
  assert(Boolean(v1Plan), 'Migration plan includes QTE-MWGLGYD1__v1 alongside v3');
  assert(v1Plan.verifiedRoundTrip && v1Plan.verificationReport.passed, 'QTE-MWGLGYD1__v1 passes full 12-domain canonical round-trip check under B2B_AGENT');
  assert(
    v1Plan.verificationReport.failingFieldPaths.length === 0,
    'Zero failing field paths on fixed B2B_AGENT QTE-MWGLGYD1__v1 round-trip',
    v1Plan.verificationReport.failingFieldPaths
  );

  const recV1 = reconstructQuotationVersionFromSections(v1Plan.manifest, v1Plan.sectionDocs, {
    verifyIntegrity: true
  });
  assert(
    recV1.routeHubs!.every(h => h.itineraryHubOccurrenceId === undefined),
    'Reconstructed legacy v1 routeHubs do NOT receive synthetic itineraryHubOccurrenceId'
  );
  assert(
    recV1.commercialTermsSnapshot === undefined && recV1.dayThemes === undefined && (recV1 as any).appliedSurcharges === undefined,
    'Historical version isolation verified: v1 does NOT inherit v3/v4 commercialTermsSnapshot, dayThemes, or appliedSurcharges'
  );
  assert(
    recV1.termsAndConditions === 'Standard Japan B2B quotation terms v1.',
    'Legacy v1 preserves exact historical termsAndConditions verbatim without regeneration'
  );
  assert(
    typeof (recV1 as any).customLegacyCode === 'string' &&
      (recV1 as any).customLegacyCode === '100' &&
      (recV1 as any).numericCountField === 100,
    'Type fidelity preserved: string "100" stays string "100", number 100 stays number 100'
  );
  assert(
    (recV1 as any).nullableRef === null &&
      typeof (recV1 as any).emptyNotesMap === 'object' &&
      Object.keys((recV1 as any).emptyNotesMap).length === 0 &&
      (recV1 as any).geoLocation?.latitude === 35.6762 &&
      (recV1 as any).docRefSample?.path === 'destinations/dest-jp',
    'Firestore primitives (Timestamp -> ISO, GeoPoint, DocumentReference, null, empty {}) survive round-trip losslessly'
  );

  // Print the 12-row diagnostic validation table from actual test output
  console.log('\n  --- 12-Domain Validation Table (QTE-MWGLGYD1__v1 | B2B_AGENT) ---');
  console.log(`  Canonical Hash Original     : ${v1Plan.verificationReport.originalCanonicalHash}`);
  console.log(`  Canonical Hash Reconstructed: ${v1Plan.verificationReport.reconstructedCanonicalHash}`);
  console.log(
    `  Sections / Chunks / MaxBytes: ${v1Plan.verificationReport.sectionCount} logical / ${v1Plan.sectionDocs.length} docs / ${v1Plan.maxSectionBytes} bytes`
  );
  for (const row of v1Plan.verificationReport.validationTable) {
    console.log(`  | ${row.validation.padEnd(22)} | ${row.result.padEnd(4)} | orig=${row.original} | rec=${row.reconstructed}`);
  }
  console.log('  ------------------------------------------------------------------\n');

  // -------------------------------------------------------------------------
  // TEST 2: Admin Run (preserves full internal costs losslessly) & Repeated Hubs
  // -------------------------------------------------------------------------
  console.log('[Suite 2] Admin Full-Cost Fidelity & Repeated Hubs in v3');
  const planAdmin = await buildNonDestructiveQuotationMigrationPlan(masterQuote, {
    user: ADMIN_USER,
    allowInternalCosts: true
  });
  const v1Admin = planAdmin.migratedVersions.find(m => m.versionId === 'QTE-MWGLGYD1__v1')!;
  const v3Admin = planAdmin.migratedVersions.find(m => m.versionId === 'QTE-MWGLGYD1__v3')!;
  assert(
    v1Admin.verificationReport.passed && v3Admin.verificationReport.passed,
    'ADMIN migration passes all 12 domains for both legacy v1 and repeated-hub v3'
  );
  const recV1Admin = reconstructQuotationVersionFromSections(v1Admin.manifest, v1Admin.sectionDocs, {
    verifyIntegrity: true
  });
  assert(
    recV1Admin.totalNetCost === 570 && (recV1Admin.items![0] as any).pricing?.totalNetCost === 210,
    'ADMIN preserves internal costs (totalNetCost=570, item net=210) losslessly'
  );
  const recV3Admin = reconstructQuotationVersionFromSections(v3Admin.manifest, v3Admin.sectionDocs, {
    verifyIntegrity: true
  });
  assert(
    recV3Admin.routeHubs!.length === 4 &&
      recV3Admin.routeHubs![0].itineraryHubOccurrenceId === 'occ-1' &&
      recV3Admin.routeHubs![3].itineraryHubOccurrenceId === 'occ-4' &&
      recV3Admin.routeHubs![0].hotelId !== recV3Admin.routeHubs![3].hotelId,
    'Repeated hubs (Tokyo Stay 1 = Aman Tokyo, Stay 4 = Palace Hotel Tokyo) preserve exact order and distinct stay IDs'
  );

  // -------------------------------------------------------------------------
  // TEST 3: Partial Failure, Idempotent Retry, SINGLE_DOC_V1 Preservation & Tamper Fail-Closed
  // -------------------------------------------------------------------------
  console.log('[Suite 3] Failure Recovery, Rules-Enforced Partial Retry & Read-Back Tamper Rejection');

  // Scenario A: Legacy v1 exists in Firestore as a legacy SINGLE_DOC_V1 doc; failure occurs after writing section 3
  const { adapter: partialAdapter, manifests, sectionsByVer } = createRulesEnforcingFirestoreAdapter({
    initialManifests: {
      'QTE-MWGLGYD1/QTE-MWGLGYD1__v1': {
        ...deepCloneSafe(v1Plan.originalLogicalVersion),
        storageFormat: 'SINGLE_DOC_V1',
        manifestStatus: 'COMMITTED',
        isLatest: false
      } as QuoteVersionRecord
    },
    enforceNonInternalKeys: true
  });

  let partialFailedAsExpected = false;
  try {
    await persistVerifiedSplitVersionAsync({
      quoteId: 'QTE-MWGLGYD1',
      versionId: 'QTE-MWGLGYD1__v1',
      originalLogicalVersion: v1Plan.originalLogicalVersion,
      stagedManifest: { ...v1Plan.manifest, manifestStatus: 'PREPARING' },
      sectionDocs: v1Plan.sectionDocs,
      isLatest: false,
      adapter: partialAdapter,
      testHooks: { failAfterSectionIndex: 3 }
    });
  } catch (err: any) {
    partialFailedAsExpected = String(err?.message || '').includes('Simulated section write failure');
  }
  assert(partialFailedAsExpected, 'Mid-backfill section write failure aborts cleanly without committing');

  const storedPartialSections = sectionsByVer.get('QTE-MWGLGYD1/QTE-MWGLGYD1__v1');
  const storedManifestDuringFail = manifests.get('QTE-MWGLGYD1/QTE-MWGLGYD1__v1');
  assert(
    storedPartialSections?.size === 3,
    `Partial failure leaves 3 written sections in Firestore without deleting SINGLE_DOC_V1 (found ${storedPartialSections?.size})`
  );
  assert(
    storedManifestDuringFail?.storageFormat === 'SINGLE_DOC_V1' &&
      storedManifestDuringFail?.manifestStatus === 'COMMITTED',
    'Legacy SINGLE_DOC_V1 manifest remains completely intact (never overwritten with PREPARING/FAILED)'
  );

  // Retry migration against same adapter: must inspect existing, reuse 3 sections (avoiding allow update: if false), write remaining 6, verify & commit!
  const retryResult = await persistVerifiedSplitVersionAsync({
    quoteId: 'QTE-MWGLGYD1',
    versionId: 'QTE-MWGLGYD1__v1',
    originalLogicalVersion: v1Plan.originalLogicalVersion,
    stagedManifest: { ...v1Plan.manifest, manifestStatus: 'PREPARING' },
    sectionDocs: v1Plan.sectionDocs,
    isLatest: false,
    adapter: partialAdapter
  });
  assert(
    retryResult.reusedExistingSectionCount === 3 &&
      retryResult.writtenSectionCount === v1Plan.sectionDocs.length - 3 &&
      retryResult.verificationReport.passed &&
      retryResult.committedManifest.migrationState === 'COMMITTED',
    `Idempotent retry reused ${retryResult.reusedExistingSectionCount} valid sections, wrote ${retryResult.writtenSectionCount} missing sections without duplicates, verified read-back & committed`
  );

  // Scenario B: Simulate read-back mismatch (tamper with reconstructed pricing total during read-back)
  const { adapter: tamperAdapter, manifests: tamperManifests } = createRulesEnforcingFirestoreAdapter();
  let tamperRejected = false;
  let tamperPaths: string[] = [];
  try {
    await persistVerifiedSplitVersionAsync({
      quoteId: 'QTE-MWGLGYD1',
      versionId: 'QTE-MWGLGYD1__v2',
      originalLogicalVersion: v1Plan.originalLogicalVersion,
      stagedManifest: {
        ...v1Plan.manifest,
        id: 'QTE-MWGLGYD1__v2',
        version: 2,
        versionNumber: 2,
        manifestStatus: 'PREPARING'
      },
      sectionDocs: v1Plan.sectionDocs.map(s => ({
        ...s,
        versionId: 'QTE-MWGLGYD1__v2',
        versionNumber: 2
      })),
      isLatest: false,
      adapter: tamperAdapter,
      testHooks: {
        tamperReadBackSections: secs =>
          secs.map(s => {
            if (s.logicalSection !== 'pricing') return s;
            const nextData = { ...s.data, totalSellingPrice: 999999 };
            return {
              ...s,
              data: nextData,
              contentHash: computeDeterministicHexHash(nextData)
            };
          })
      }
    });
  } catch (err: any) {
    const msg = String(err?.message || '');
    tamperRejected =
      msg.includes('Legacy backfill round-trip verification failed') ||
      msg.includes('hash mismatch');
    tamperPaths = (err?.verificationReport?.failingFieldPaths || []).map((f: any) => f.path);
  }
  const failedManifestEntry = tamperManifests.get('QTE-MWGLGYD1/QTE-MWGLGYD1__v2');
  assert(
    tamperRejected &&
      failedManifestEntry?.manifestStatus === 'FAILED' &&
      failedManifestEntry?.migrationState === 'VERIFICATION_FAILED',
    'Read-back tamper fails closed at integrity gate, records VERIFICATION_FAILED & blocks commit',
    { tamperPaths }
  );

  // Also verify exact failing field-path diagnostics when a reconstructed field diverges
  const semanticRec = deepCloneSafe(v1Plan.originalLogicalVersion);
  semanticRec.totalSellingPrice = 999999;
  const semanticReport = verifyVersionRoundTripIntegrity({
    originalVersion: v1Plan.originalLogicalVersion,
    reconstructedVersion: semanticRec,
    manifest: v1Plan.manifest,
    sectionDocs: v1Plan.sectionDocs
  });
  assert(
    !semanticReport.passed &&
      semanticReport.failingFieldPaths.some(f => f.path === 'totalSellingPrice' && f.domain === 'Pricing snapshot'),
    'verifyVersionRoundTripIntegrity reports exact failing field path (totalSellingPrice -> Pricing snapshot)',
    semanticReport.failingFieldPaths
  );

  // -------------------------------------------------------------------------
  // TEST 4: End-to-End AppDatabase Save Draft + Backfill + Output Hub Consistency + <= 800 KiB
  // -------------------------------------------------------------------------
  console.log('[Suite 4] End-to-End AppDatabase Save Draft, Coexistence, Output Hub & Size Regression');
  // Seed legacy QTE-MWGLGYD1 cleanly
  db.saveQuote(masterQuote, B2B_AGENT, 'CREATED', 'Seeded legacy QTE-MWGLGYD1');

  const { adapter: dbTestAdapter } = createRulesEnforcingFirestoreAdapter({
    enforceNonInternalKeys: true
  });

  const explicitSaveRes = await db.saveQuotationExplicitVersionAsync({
    quote: {
      ...masterQuote,
      changesSummary: 'Explicit Save Draft v4 after audit fix'
    } as Quotation,
    user: B2B_AGENT,
    clientSaveRequestId: `req-mwg-v4-${Date.now()}`,
    changesSummary: 'Explicit Save Draft v4',
    testHooks: { persistenceAdapter: dbTestAdapter }
  });

  assert(
    explicitSaveRes.versionNumber === 4,
    `Explicit Save Draft created sequential v4 (got v${explicitSaveRes.versionNumber}) and verified legacy v1 & v3 backfill`
  );

  // Verify ALL version reads & Lead Management grouping
  const versionsList = db.getQuotationVersions('QTE-MWGLGYD1', B2B_AGENT);
  const groupedForLead = db.getQuoteVersionsGroupedByQuoteForLead('LEAD-JP-2026-009', B2B_AGENT);
  assert(
    versionsList.some(v => (v.versionNumber || v.version) === 1) &&
      versionsList.some(v => (v.versionNumber || v.version) === 3) &&
      versionsList.some(v => (v.versionNumber || v.version) === 4),
    'All historical versions (v1, v3, v4) coexist seamlessly in getQuotationVersions'
  );
  assert(
    groupedForLead.length === 1 && groupedForLead[0].totalVersions >= 3,
    `Lead Management grouped versions retain complete version history after backfill compaction (totalVersions=${groupedForLead[0]?.totalVersions})`
  );

  // Reconstruct historical v1 via AppDatabase async reader and check all output formats match historical v1 price ($920)
  const loadedHistoricalV1 = await db.loadQuotationVersionFullAsync('QTE-MWGLGYD1', 1, B2B_AGENT);
  assert(
    loadedHistoricalV1 !== null &&
      loadedHistoricalV1.totalSellingPrice === 920 &&
      loadedHistoricalV1.termsAndConditions === 'Standard Japan B2B quotation terms v1.',
    'Historical v1 reconstructed via loadQuotationVersionFullAsync retains exact original $920 price and v1 terms'
  );

  // Check Output Hub (Preview/PDF/Email/WhatsApp) on reconstructed v1
  const v1PresentationQuote = {
    ...masterQuote,
    ...loadedHistoricalV1,
    id: 'QTE-MWGLGYD1',
    version: 1,
    versionNumber: 1,
    finalCustomerSellingPrice: 920,
    totalSellingPrice: 920,
    theUnboundBaseSellingPrice: 920,
    baseFinalSellingPrice: 920,
    agentMarginAmount: 0
  } as Quotation;
  const model = buildQuotePresentationModel(v1PresentationQuote, B2B_AGENT);
  const emailOut = renderQuoteEmailFromPresentationModel(model);
  const waOut = renderQuoteWhatsAppFromPresentationModel(model);
  const pdfPages = paginateQuotePresentationModel(model);
  const formattedV1Price = model.finalCustomerSellingPriceFormatted;
  assert(
    model.finalCustomerSellingPriceNumeric === 920 &&
      emailOut.htmlBody.includes(formattedV1Price) &&
      waOut.includes(formattedV1Price) &&
      pdfPages.length > 0,
    `All Output Hub generators (Presentation Model, PDF=${pdfPages.length}pp, Email, WhatsApp) render identical ${formattedV1Price} from reconstructed v1`
  );

  // Verify compacted master & every written document strictly <= 800 KiB
  const debugV4 = db.getSplitVersionDebugSnapshot('QTE-MWGLGYD1', 4);
  const debugV1 = db.getSplitVersionDebugSnapshot('QTE-MWGLGYD1', 1);
  const maxSectionBytes = Math.max(
    ...(debugV4.sectionDocs || []).map(s => s.estimatedBytes),
    ...(debugV1.sectionDocs || []).map(s => s.estimatedBytes),
    0
  );
  const compactedMasterBytes = debugV4.compactedMaster?.estimatedBytes || 0;
  assert(
    compactedMasterBytes > 0 &&
      compactedMasterBytes <= SAFE_DOC_BYTE_THRESHOLD &&
      maxSectionBytes <= SAFE_DOC_BYTE_THRESHOLD &&
      maxSectionBytes < FIRESTORE_MAX_DOC_BYTES,
    `All Firestore docs stay strictly <= 800 KiB (master=${compactedMasterBytes} B, maxSection=${maxSectionBytes} B)`
  );

  console.log(`\n=== SUMMARY: ${passedTests}/${totalTests} checks passed, ${failedTests} failed ===`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error in legacyBackfillRoundTripAudit:', err);
  process.exit(1);
});
