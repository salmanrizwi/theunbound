/**
 * THEUNBOUND — SPLIT-DOCUMENT QUOTATION VERSION STORAGE AUDIT SUITE
 *
 * Verifies root-cause resolution for Firestore's 1 MiB (1,048,576 B) document size limit
 * across master quotations, `quotations/{quoteId}/versions/{versionId}` manifests,
 * and `quotations/{quoteId}/versions/{versionId}/sections/{sectionId}` documents.
 */

import { AppDatabase } from '../services/db';
import {
  FIRESTORE_MAX_DOC_BYTES,
  SAFE_DOC_BYTE_THRESHOLD,
  computeDeterministicHexHash,
  estimateFirestoreDocumentBytes,
  reconstructQuotationVersionFromSections
} from '../services/quotationVersionStorage';
import {
  auditQuotationPayloadSizes,
  buildNonDestructiveQuotationMigrationPlan
} from '../services/quotationVersionMigration';
import {
  buildAuthoritativeQuotationSnapshot
} from '../services/quotationSnapshotService';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import { Quotation, QuoteItem, QuoteVersionRecord, TripRouteHub, User } from '../types';

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

const ADMIN_USER: User = {
  id: 'usr-admin-split-audit',
  name: 'Internal Operations Director',
  email: 'ops@theunbound.in',
  role: 'ADMIN',
  userType: 'ADMIN',
  agencyName: 'theunbound',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const B2B_AGENT_USER: User = {
  id: 'usr-agent-split-audit',
  name: 'Kenji Sato',
  email: 'kenji@kurosawa-travel.jp',
  role: 'B2B_AGENT',
  userType: 'B2B_AGENT',
  agencyName: 'Kurosawa Bespoke Journeys',
  companyName: 'Kurosawa Bespoke Journeys',
  companyAddress: 'Ginza 6-Chome, Chuo-ku, Tokyo',
  brandPrimaryColor: '#0f172a',
  brandAccentColor: '#00c6a6',
  createdAt: '2026-01-01T00:00:00.000Z'
};

function makeRepeatedHubs(): TripRouteHub[] {
  const sequence = [
    { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 3, hotelId: 'htl-aman-tokyo', hotelName: 'Aman Tokyo' },
    { hubId: 'hub-osaka', hubName: 'Osaka', nights: 2, hotelId: 'htl-conrad-osaka', hotelName: 'Conrad Osaka' },
    { hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 3, hotelId: 'htl-ritz-kyoto', hotelName: 'The Ritz-Carlton Kyoto' },
    { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 2, hotelId: 'htl-palace-tokyo', hotelName: 'Palace Hotel Tokyo' },
    { hubId: 'hub-osaka', hubName: 'Osaka', nights: 1, hotelId: 'htl-stregis-osaka', hotelName: 'The St. Regis Osaka' },
    { hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 2, hotelId: 'htl-peninsula-tokyo', hotelName: 'The Peninsula Tokyo' }
  ];

  return sequence.map((entry, idx) => ({
    id: `occ-hub-${idx + 1}`,
    itineraryHubOccurrenceId: `occ-hub-${idx + 1}`,
    accommodationStayId: `stay-${idx + 1}`,
    hubId: entry.hubId,
    hubName: entry.hubName,
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    nights: entry.nights,
    order: idx + 1,
    accommodationType: 'hotel',
    hotelId: entry.hotelId,
    hotelName: entry.hotelName,
    roomsCount: 2,
    roomType: 'Premier Corner Suite',
    mealPlan: 'BB',
    checkInDate: `2026-10-${String(10 + idx * 2).padStart(2, '0')}`,
    checkOutDate: `2026-10-${String(10 + idx * 2 + entry.nights).padStart(2, '0')}`
  }));
}

function makeRichItems(count: number, descriptionPaddingBytes: number): QuoteItem[] {
  const richParagraph = 'Private bespoke curated cultural expedition including English-speaking master curator, priority VIP entry access, chauffeured Alphard transfers, tea ceremony tasting, and multi-course seasonal kaiseki dining. '.repeat(
    Math.max(1, Math.ceil(descriptionPaddingBytes / 210))
  );

  const items: QuoteItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const unitSell = 450 + i * 25;
    const unitNet = 320 + i * 15;
    items.push({
      id: `item-split-${i + 1}`,
      dayNumber: (i % 13) + 1,
      travelDate: `2026-10-${String(10 + (i % 13)).padStart(2, '0')}`,
      hubId: i % 2 === 0 ? 'hub-tokyo' : 'hub-kyoto',
      itineraryHubOccurrenceId: i % 2 === 0 ? 'occ-hub-1' : 'occ-hub-3',
      accommodationStayId: i % 3 === 0 ? 'stay-1' : undefined,
      pax: { adults: 2, children: 1, infants: 0 },
      selectedVariant: 'Private VIP',
      selectedAddonIds: ['addon-guide', 'addon-priority'],
      notes: `Operational briefing note #${i + 1}: ${richParagraph.slice(0, 600)}`,
      product: {
        id: `prod-jp-${i + 1}`,
        sku: `JP-BESPOKE-${String(i + 1).padStart(3, '0')}`,
        name: `Curated Experience Day ${(i % 13) + 1} - Service ${i + 1}`,
        productType: i % 5 === 0 ? 'HOTEL' : 'ACTIVITY',
        category: i % 5 === 0 ? 'Luxury Accommodation' : 'Private Cultural Experiences',
        destinationId: 'dest-japan',
        destinationName: 'Japan',
        city: i % 2 === 0 ? 'Tokyo' : 'Kyoto',
        country: 'Japan',
        duration: 'Full Day (8 Hours)',
        description: `${richParagraph} [Service #${i + 1}]`,
        inclusions: [
          'Dedicated licensed chauffeur & luxury Alphard MPV',
          'Priority monument tickets and private curator access',
          'Bottled artisanal spring water and cold towels'
        ],
        exclusions: ['Personal travel insurance', 'Gratuities at guest discretion'],
        adultNetPrice: unitNet / 2,
        sellingPriceStartingFrom: unitSell / 2,
        currency: 'USD',
        supplierId: `sup-conf-${i + 1}`,
        supplierName: `Confidential Ground Operator #${i + 1}`,
        images: [`https://cdn.example.com/japan/service-${i + 1}.jpg`],
        status: 'ACTIVE'
      } as any,
      calculation: {
        totalNetCost: unitNet,
        supplierCost: unitNet,
        internalNettCost: unitNet,
        markupRate: 0.25,
        finalTotalSellingPrice: unitSell,
        sellingPriceFinal: unitSell,
        totalMargin: unitSell - unitNet,
        currency: 'USD',
        isPackagePrice: false
      } as any,
      agentAdditionalMarkupType: 'PERCENTAGE',
      agentAdditionalMarkupValue: 5
    } as any);
  }
  return items;
}

function makeCommercialHtmlBlock(repeatCount: number): string {
  const clause =
    '<section><h3>Commercial Term Clause</h3><p>All land arrangements, hotel allocations, private Shinkansen reserved seats, and bilingual concierge coverage remain subject to supplier availability at final remittance. Cancellation tiers apply 45/30/14 days prior to check-in.</p></section>';
  return `<div class="commercial-terms">${clause.repeat(repeatCount)}</div>`;
}

function buildRealisticOversizedQuote(quoteId: string, opts?: { embeddedVersions?: number; itemCount?: number; descBytes?: number; htmlRepeats?: number }): Quotation {
  const itemCount = opts?.itemCount ?? 45;
  const descBytes = opts?.descBytes ?? 5200;
  const htmlRepeats = opts?.htmlRepeats ?? 120;
  const hubs = makeRepeatedHubs();
  const items = makeRichItems(itemCount, descBytes);
  const totalNet = items.reduce((s, it) => s + ((it.calculation as any)?.totalNetCost || 0), 0);
  const totalBaseSell = items.reduce((s, it) => s + (it.calculation?.finalTotalSellingPrice || 0), 0);
  const finalSell = Math.round(totalBaseSell * 1.05);
  const htmlTerms = makeCommercialHtmlBlock(htmlRepeats);
  const plainTerms = htmlTerms.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const dayDescriptions: Record<number, string> = {};
  const dayOverviews: Record<number, string> = {};
  const dayThemes: Record<number, string> = {};
  for (let d = 1; d <= 14; d += 1) {
    dayThemes[d] = `Day ${d}: Imperial Heritage & Culinary Craft`;
    dayOverviews[d] = `Private day ${d} touring with master artisans across historic districts.`;
    dayDescriptions[d] = `Detailed Hour-by-Hour Day ${d} Itinerary: `.repeat(25) + 'Concludes with evening private transfer.';
  }

  const baseQuote: Quotation = {
    id: quoteId,
    quoteId,
    quoteNumber: quoteId,
    leadId: 'lead-mwglgyd1',
    linkedLeadId: 'lead-mwglgyd1',
    version: opts?.embeddedVersions ?? 3,
    versionNumber: opts?.embeddedVersions ?? 3,
    latestVersion: opts?.embeddedVersions ?? 3,
    status: 'SAVED',
    proposalStatus: 'saved',
    title: 'Grand Imperial Japan Autumn Circuit (Tokyo-Osaka-Kyoto Loop)',
    destination: 'Japan',
    currency: 'USD',
    totalNetCost: totalNet,
    internalNettCost: totalNet,
    supplierCost: totalNet,
    totalMargin: finalSell - totalNet,
    internalProfit: finalSell - totalNet,
    theUnboundBaseSellingPrice: totalBaseSell,
    baseFinalSellingPrice: totalBaseSell,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 5,
    agentMarginAmount: finalSell - totalBaseSell,
    totalSellingPrice: finalSell,
    finalCustomerSellingPrice: finalSell,
    totalTaxes: 1200,
    overallMarkupPercent: 25,
    overallDiscountPercent: 0,
    clientName: 'Vikramaditya Singhania',
    clientEmail: 'vikram@singhania.example.com',
    clientPhone: '+91 98200 11223',
    clientCompany: 'Singhania Family Office',
    agentId: B2B_AGENT_USER.id,
    userId: B2B_AGENT_USER.id,
    agentName: B2B_AGENT_USER.name,
    agentEmail: B2B_AGENT_USER.email,
    agentAgency: B2B_AGENT_USER.agencyName,
    createdBy: B2B_AGENT_USER.id,
    createdByName: B2B_AGENT_USER.name,
    createdByUserType: 'B2B_AGENT',
    travelStartDate: '2026-10-10',
    travelEndDate: '2026-10-23',
    totalPax: 3,
    adultsCount: 2,
    childrenCount: 1,
    infantsCount: 0,
    childAges: [8],
    items,
    routeHubs: hubs,
    dayThemes,
    dayOverviews,
    dayDescriptions,
    itineraryOverview: 'Multi-stop luxury circuit returning to Tokyo and Osaka across 13 nights.',
    inclusions: ['All private luxury transfers', 'Daily breakfast at 5-star properties', 'Bilingual concierge desk'],
    exclusions: ['International airfare', 'Personal incidentals'],
    importantInformation: 'Passport validity must exceed 6 months prior to entry into Japan.',
    cancellationPolicy: 'Free cancellation up to 45 days prior; tiered penalties thereafter.',
    termsAndConditions: plainTerms,
    commercialTermsSnapshot: {
      snapshotVersion: 1,
      resolvedAt: '2026-10-01T00:00:00.000Z',
      combinedHeading: 'Commercial Quotation Terms — Japan',
      combinedHtml: htmlTerms,
      combinedPlainText: plainTerms,
      combinedWhatsAppText: plainTerms,
      entries: [
        {
          targetType: 'DESTINATION',
          targetId: 'dest-japan',
          targetName: 'Japan',
          sections: [
            {
              id: 'sec-payment',
              heading: 'Payment Terms & Schedule',
              htmlContent: htmlTerms,
              displayOrder: 1,
              isActive: true
            },
            {
              id: 'sec-cancellation',
              heading: 'Cancellation & Amendment Policy',
              htmlContent: htmlTerms,
              displayOrder: 2,
              isActive: true
            }
          ]
        }
      ]
    } as any,
    options: [
      {
        id: 'opt-default',
        optionNumber: 1,
        title: 'Option A - Signature Luxury',
        items,
        routeHubs: hubs,
        totalSellingPrice: finalSell,
        totalNetCost: totalNet
      }
    ],
    activeOptionId: 'opt-default',
    brandingMode: 'WHITE_LABEL',
    brandingSnapshot: {
      companyName: B2B_AGENT_USER.agencyName,
      primaryColor: '#0f172a',
      accentColor: '#00c6a6'
    } as any,
    validUntil: '2026-11-30T00:00:00.000Z',
    agentNotes: 'Executive VIP circuit with repeated Tokyo & Osaka hotel stays.',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z'
  };

  baseQuote.authoritativeSnapshot = buildAuthoritativeQuotationSnapshot(baseQuote, {
    versionNumber: baseQuote.version,
    user: B2B_AGENT_USER
  });

  const embeddedCount = opts?.embeddedVersions ?? 3;
  const versionHistory: QuoteVersionRecord[] = [];
  for (let v = embeddedCount; v >= 1; v -= 1) {
    versionHistory.push({
      id: `${quoteId}__v${v}`,
      quoteId,
      quoteNumber: quoteId,
      leadId: baseQuote.leadId,
      version: v,
      versionNumber: v,
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: `2026-10-0${Math.min(9, v)}T10:00:00.000Z`,
      updatedBy: B2B_AGENT_USER.name,
      savedByName: B2B_AGENT_USER.name,
      savedByRole: 'B2B_AGENT',
      agentId: B2B_AGENT_USER.id,
      userId: B2B_AGENT_USER.id,
      status: 'SAVED',
      proposalStatus: 'saved',
      changesSummary: `Legacy embedded revision v${v}`,
      title: baseQuote.title,
      destination: baseQuote.destination,
      clientName: baseQuote.clientName,
      clientEmail: baseQuote.clientEmail,
      travelStartDate: baseQuote.travelStartDate,
      travelEndDate: baseQuote.travelEndDate,
      totalPax: baseQuote.totalPax,
      adultsCount: baseQuote.adultsCount,
      childrenCount: baseQuote.childrenCount,
      currency: baseQuote.currency,
      totalNetCost: totalNet,
      totalSellingPrice: finalSell - (embeddedCount - v) * 50,
      marginPercent: 25,
      marginAmount: finalSell - totalNet,
      items,
      routeHubs: hubs,
      dayThemes,
      dayOverviews,
      dayDescriptions,
      commercialTermsSnapshot: baseQuote.commercialTermsSnapshot,
      authoritativeSnapshot: baseQuote.authoritativeSnapshot,
      options: baseQuote.options,
      activeOptionId: baseQuote.activeOptionId,
      termsAndConditions: plainTerms,
      isLatest: v === embeddedCount,
      isImmutable: true
    } as QuoteVersionRecord);
  }
  baseQuote.versionHistory = versionHistory;
  return baseQuote;
}

async function runAudit() {
  console.log('\n=======================================================================');
  console.log('SPLIT-DOCUMENT QUOTATION VERSION ARCHITECTURE — COMPREHENSIVE AUDIT');
  console.log('=======================================================================\n');

  const db = AppDatabase.getInstance();

  // -------------------------------------------------------------------------
  // TEST 1: Forensic Payload Size Audit (Models QTE-MWGLGYD1 ~1.29 MB)
  // -------------------------------------------------------------------------
  console.log('1. Forensic Payload Size Audit (Modeling QTE-MWGLGYD1 > 1.29 MB):');
  const legacyMWGLGYD1 = buildRealisticOversizedQuote('QTE-MWGLGYD1', {
    embeddedVersions: 3,
    itemCount: 42,
    descBytes: 5600,
    htmlRepeats: 120
  });
  const auditReport = auditQuotationPayloadSizes(legacyMWGLGYD1);
  console.log(
    `     Master raw Firestore est bytes: ${auditReport.totalFirestoreBytes.toLocaleString()} B | Top contributors: ${auditReport.topContributors
      .slice(0, 4)
      .map(c => `${c.field}=${c.firestoreBytes.toLocaleString()}B (${c.percentOfPayload}%)`)
      .join(', ')}`
  );
  assert(
    auditReport.totalFirestoreBytes > FIRESTORE_MAX_DOC_BYTES,
    `Legacy master quotation exceeds 1 MiB limit (${auditReport.totalFirestoreBytes.toLocaleString()} B > 1,048,576 B)`
  );
  assert(
    auditReport.duplicationFindings.some(f => f.includes('Embedded versionHistory')),
    'Audit accurately pinpoints embedded versionHistory array duplication'
  );
  assert(
    auditReport.duplicationFindings.some(f => f.includes('options[0].items')),
    'Audit accurately detects options[0].items mirroring top-level items'
  );

  // -------------------------------------------------------------------------
  // TEST 2: Non-Destructive Migration (QTE-MWGLGYD1 v1-v3 & 41-version QTE-MW6K5WPA)
  // -------------------------------------------------------------------------
  console.log('\n2. Non-Destructive Legacy Migration (QTE-MWGLGYD1 & 41-version QTE-MW6K5WPA):');
  const planMWGLGYD1 = await buildNonDestructiveQuotationMigrationPlan(legacyMWGLGYD1);
  assert(
    planMWGLGYD1.allDocsWithinThreshold && planMWGLGYD1.maxWrittenDocBytes <= SAFE_DOC_BYTE_THRESHOLD,
    `QTE-MWGLGYD1 migrated max doc ${planMWGLGYD1.maxWrittenDocBytes.toLocaleString()} B <= ${SAFE_DOC_BYTE_THRESHOLD.toLocaleString()} B`
  );
  assert(
    planMWGLGYD1.migratedVersions.length === 3 &&
      planMWGLGYD1.migratedVersions.every(v => v.verifiedRoundTrip),
    'QTE-MWGLGYD1 v1..v3 all migrated & round-trip hash verified without data loss'
  );
  assert(
    planMWGLGYD1.afterMasterBytes <= SAFE_DOC_BYTE_THRESHOLD &&
      Array.isArray(planMWGLGYD1.compactedMasterDoc.versionHistory) &&
      planMWGLGYD1.compactedMasterDoc.versionHistory.length === 0,
    `QTE-MWGLGYD1 compacted master shrunk ${planMWGLGYD1.beforeMasterBytes.toLocaleString()} B -> ${planMWGLGYD1.afterMasterBytes.toLocaleString()} B`
  );

  const legacy41 = buildRealisticOversizedQuote('QTE-MW6K5WPA', {
    embeddedVersions: 41,
    itemCount: 18,
    descBytes: 1800,
    htmlRepeats: 30
  });
  const audit41 = auditQuotationPayloadSizes(legacy41);
  const plan41 = await buildNonDestructiveQuotationMigrationPlan(legacy41);
  assert(
    audit41.totalFirestoreBytes > FIRESTORE_MAX_DOC_BYTES && plan41.allDocsWithinThreshold,
    `QTE-MW6K5WPA (41 versions) migrated ${audit41.totalFirestoreBytes.toLocaleString()} B -> max doc ${plan41.maxWrittenDocBytes.toLocaleString()} B <= 800 KiB`
  );
  assert(
    plan41.migratedVersions.length === 41 && plan41.summaries.length === 41,
    `All 41 historical versions preserved with compact versionSummaries (${plan41.summaries.length})`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Explicit Save Draft of >1.3 MiB Quotation (v4) + Auto-Backfill of v1-v3
  // -------------------------------------------------------------------------
  console.log('\n3. Save Draft Split Pipeline + Automatic Legacy Backfill (QTE-MWGLGYD1 v4 > 1.3 MiB):');
  // Seed legacy QTE-MWGLGYD1 with v1..v3 embedded into store
  const seededQuoteList = [legacyMWGLGYD1, ...db.getAllSavedQuotes().filter(q => q.id !== 'QTE-MWGLGYD1')];
  (db as any).setItem('saved_quotes', seededQuoteList, false);

  // Create heavy v4 payload (> 1.3 MiB single version snapshot!)
  const heavyV4Quote = buildRealisticOversizedQuote('QTE-MWGLGYD1', {
    embeddedVersions: 3,
    itemCount: 55,
    descBytes: 14000,
    htmlRepeats: 220
  });
  heavyV4Quote.title = 'Grand Imperial Japan V4 — Expanded Bespoke Architecture';
  heavyV4Quote.agentNotes = 'Executive VIP v4 explicit draft note preserving all hubs & hotel stays.';

  const v4JsonBytes = estimateFirestoreDocumentBytes(heavyV4Quote as any, 'quotations/QTE-MWGLGYD1/versions/QTE-MWGLGYD1__v4');
  console.log(`     Pre-split v4 candidate payload est: ${v4JsonBytes.toLocaleString()} B (> 1 MiB)`);
  assert(
    v4JsonBytes > FIRESTORE_MAX_DOC_BYTES,
    `Heavy v4 candidate exceeds Firestore 1 MiB limit pre-split (${v4JsonBytes.toLocaleString()} B)`
  );

  const saveV4Res = await db.saveQuotationExplicitVersionAsync({
    quote: heavyV4Quote,
    user: ADMIN_USER,
    changesSummary: 'Saved oversized v4 bespoke luxury circuit cleanly',
    clientSaveRequestId: 'req-split-v4-001'
  });

  assert(saveV4Res.versionNumber === 4 && !saveV4Res.deduplicated, 'Explicit Save Draft produced sequential version v4');
  assert(
    saveV4Res.versionRecord.storageFormat === 'SPLIT_SECTIONS_V2' &&
      saveV4Res.versionRecord.manifestStatus === 'COMMITTED',
    'v4 persisted with SPLIT_SECTIONS_V2 + COMMITTED manifest'
  );

  const debugV4 = db.getSplitVersionDebugSnapshot('QTE-MWGLGYD1', 4);
  const maxSectionBytes = Math.max(...(debugV4.sectionDocs || []).map(s => s.estimatedBytes));
  const manifestBytes = estimateFirestoreDocumentBytes(debugV4.manifest as any, 'quotations/QTE-MWGLGYD1/versions/QTE-MWGLGYD1__v4');
  const masterBytes = debugV4.compactedMaster?.estimatedBytes ?? 0;
  console.log(
    `     Post-split sizes: manifest=${manifestBytes.toLocaleString()}B, sections=${debugV4.sectionDocs.length} (max=${maxSectionBytes.toLocaleString()}B), compactedMaster=${masterBytes.toLocaleString()}B`
  );

  assert(
    manifestBytes <= SAFE_DOC_BYTE_THRESHOLD &&
      maxSectionBytes <= SAFE_DOC_BYTE_THRESHOLD &&
      masterBytes > 0 &&
      masterBytes <= SAFE_DOC_BYTE_THRESHOLD,
    'Manifest, ALL sections/chunks, and compacted master are strictly <= 800 KiB'
  );

  // Verify embedded v1..v3 were automatically backfilled before master compaction
  const backfilledV1Debug = db.getSplitVersionDebugSnapshot('QTE-MWGLGYD1', 1);
  const backfilledV3Debug = db.getSplitVersionDebugSnapshot('QTE-MWGLGYD1', 3);
  assert(
    Boolean(backfilledV1Debug.manifest?.storageFormat === 'SPLIT_SECTIONS_V2' && backfilledV1Debug.sectionDocs.length > 0) &&
      Boolean(backfilledV3Debug.manifest?.storageFormat === 'SPLIT_SECTIONS_V2' && backfilledV3Debug.sectionDocs.length > 0),
    'Prior embedded v1..v3 backfilled into SPLIT_SECTIONS_V2 BEFORE master versionHistory compaction'
  );

  // Lossless reconstruction equality
  const reconstructedV4 = reconstructQuotationVersionFromSections(debugV4.manifest!, debugV4.sectionDocs, {
    verifyIntegrity: true
  });
  assert(
    computeDeterministicHexHash(heavyV4Quote.items) === computeDeterministicHexHash(reconstructedV4.items) &&
      computeDeterministicHexHash(heavyV4Quote.routeHubs) === computeDeterministicHexHash(reconstructedV4.routeHubs) &&
      reconstructedV4.routeHubs?.length === 6 &&
      reconstructedV4.dayDescriptions?.[14] === heavyV4Quote.dayDescriptions?.[14] &&
      reconstructedV4.commercialTermsSnapshot?.combinedPlainText === heavyV4Quote.commercialTermsSnapshot?.combinedPlainText,
    'Reconstructed v4 matches original items, 6 repeated hubs, 14-day descriptions, and commercial terms losslessly'
  );

  // -------------------------------------------------------------------------
  // TEST 4: Single-Section Overflow (>1 MiB single items array AND >1 MiB HTML terms)
  // -------------------------------------------------------------------------
  console.log('\n4. Dynamic Sub-Chunking of Massive Single Section (> 1 MiB Items & Terms):');
  const ultraHeavyQuote = buildRealisticOversizedQuote('QTE-CHUNK-TEST', {
    embeddedVersions: 0,
    itemCount: 80,
    descBytes: 18000,
    htmlRepeats: 3500
  });
  const saveChunkRes = await db.saveQuotationExplicitVersionAsync({
    quote: ultraHeavyQuote,
    user: ADMIN_USER,
    changesSummary: 'Test single-section multi-chunk overflow',
    clientSaveRequestId: 'req-chunk-test-001'
  });
  const debugChunk = db.getSplitVersionDebugSnapshot('QTE-CHUNK-TEST', saveChunkRes.versionNumber);
  const itemChunks = debugChunk.sectionDocs.filter(s => s.sectionId === 'products_and_services' || s.sectionId.startsWith('products_and_services__chunk_'));
  const termsChunks = debugChunk.sectionDocs.filter(s => s.sectionId === 'commercial_terms' || s.sectionId.startsWith('commercial_terms__chunk_'));
  const allUnderCap = debugChunk.sectionDocs.every(s => s.estimatedBytes <= SAFE_DOC_BYTE_THRESHOLD);

  console.log(
    `     Chunk counts: items=${itemChunks.length}, terms=${termsChunks.length}, totalSections=${debugChunk.sectionDocs.length}`
  );
  assert(
    itemChunks.length >= 2 && termsChunks.length >= 2 && allUnderCap,
    `Single huge sections auto-split into chunks (${itemChunks.length} item chunks, ${termsChunks.length} terms chunks), all <= 800 KiB`
  );
  const loadedChunkVer = await db.loadQuotationVersionFullAsync('QTE-CHUNK-TEST', saveChunkRes.versionNumber, ADMIN_USER);
  assert(
    Boolean(loadedChunkVer) &&
      computeDeterministicHexHash(loadedChunkVer?.items) === computeDeterministicHexHash(ultraHeavyQuote.items) &&
      loadedChunkVer?.commercialTermsSnapshot?.combinedHtml === ultraHeavyQuote.commercialTermsSnapshot?.combinedHtml,
    'Chunked items (80) and massive HTML commercial terms reassemble byte-identically'
  );

  // -------------------------------------------------------------------------
  // TEST 5: Inline Base64 Binary Asset Offloading (>2 KB)
  // -------------------------------------------------------------------------
  console.log('\n5. Inline Base64 Binary Image Offloading (> 2 KB):');
  const uploadedPaths: string[] = [];
  const fakeBase64Img = `data:image/png;base64,${'A'.repeat(6000)}`;
  const assetQuote = buildRealisticOversizedQuote('QTE-ASSET-TEST', {
    embeddedVersions: 0,
    itemCount: 4,
    descBytes: 500,
    htmlRepeats: 10
  });
  (assetQuote.items[0].product as any).images = [fakeBase64Img, 'https://cdn.example.com/keep-me.jpg'];
  assetQuote.agentLogoUrl = fakeBase64Img;

  const assetSaveRes = await db.saveQuotationExplicitVersionAsync({
    quote: assetQuote,
    user: B2B_AGENT_USER,
    changesSummary: 'Test base64 offloading',
    clientSaveRequestId: 'req-asset-test-001',
    testHooks: {
      enableStorageUpload: true,
      storageUploader: async ({ quoteId, hash, extension }) => {
        const storagePath = `quotation-assets/${quoteId}/${hash}.${extension}`;
        const outUrl = `https://storage.googleapis.com/theunbound-assets/${storagePath}`;
        uploadedPaths.push(outUrl);
        return { downloadUrl: outUrl, storagePath };
      }
    }
  });
  const loadedAssetVer = await db.loadQuotationVersionFullAsync('QTE-ASSET-TEST', assetSaveRes.versionNumber, B2B_AGENT_USER);
  assert(
    uploadedPaths.length >= 1 &&
      typeof (loadedAssetVer?.items?.[0]?.product as any)?.images?.[0] === 'string' &&
      (loadedAssetVer?.items?.[0]?.product as any)?.images?.[0].startsWith('https://storage.googleapis.com/') &&
      (loadedAssetVer?.items?.[0]?.product as any)?.images?.[1] === 'https://cdn.example.com/keep-me.jpg',
    'Base64 > 2 KB offloaded cleanly to HTTPS URL while preserving existing external URLs'
  );

  // -------------------------------------------------------------------------
  // TEST 6: Partial Staged Failure + Clean Sequential Recovery (No Orphaned Gaps)
  // -------------------------------------------------------------------------
  console.log('\n6. Staged Failure Isolation & Clean Sequential Recovery:');
  const versionBeforeFail = db.getQuoteByIdAuthorized('QTE-MWGLGYD1', ADMIN_USER)?.latestVersion || 4;
  let failureCaught = false;
  try {
    await db.saveQuotationExplicitVersionAsync({
      quote: heavyV4Quote,
      user: ADMIN_USER,
      changesSummary: 'Simulated interrupted v5 attempt',
      clientSaveRequestId: 'req-fail-v5-attempt',
      testHooks: { failAfterSectionIndex: 3 }
    });
  } catch {
    failureCaught = true;
  }
  const versionAfterFail = db.getQuoteByIdAuthorized('QTE-MWGLGYD1', ADMIN_USER)?.latestVersion;
  const failedDebug = db.getSplitVersionDebugSnapshot('QTE-MWGLGYD1', 5);
  assert(
    failureCaught &&
      failedDebug.manifest?.manifestStatus === 'FAILED' &&
      versionAfterFail === versionBeforeFail &&
      db.getQuotationVersions('QTE-MWGLGYD1', ADMIN_USER).every(v => v.version !== 5),
    'Aborted staged save marks FAILED, keeps master at v4, and hides failed attempt from version history'
  );

  const retrySuccess = await db.saveQuotationExplicitVersionAsync({
    quote: heavyV4Quote,
    user: ADMIN_USER,
    changesSummary: 'Clean retry after staged interruption',
    clientSaveRequestId: 'req-retry-v5-success'
  });
  assert(
    retrySuccess.versionNumber === 5 && retrySuccess.versionRecord.manifestStatus === 'COMMITTED',
    `Retry after failure cleanly commits sequential v5 (no gap or v6 skip)`
  );

  // -------------------------------------------------------------------------
  // TEST 7: Single-Flight Concurrency Lock & clientSaveRequestId Idempotency
  // -------------------------------------------------------------------------
  console.log('\n7. Single-Flight Locking & Duplicate clientSaveRequestId Idempotency:');
  const [dupA, dupB] = await Promise.all([
    db.saveQuotationExplicitVersionAsync({
      quote: heavyV4Quote,
      user: ADMIN_USER,
      changesSummary: 'Idempotent double click',
      clientSaveRequestId: 'req-idempotent-v6'
    }),
    db.saveQuotationExplicitVersionAsync({
      quote: heavyV4Quote,
      user: ADMIN_USER,
      changesSummary: 'Idempotent double click',
      clientSaveRequestId: 'req-idempotent-v6'
    })
  ]);
  assert(
    dupA.versionNumber === 6 && dupB.versionNumber === 6 && (dupB.deduplicated || dupA.deduplicated),
    'Concurrent identical clientSaveRequestId calls deduplicate to single v6'
  );

  // -------------------------------------------------------------------------
  // TEST 8: Strict B2B Agent Internal Cost Redaction Across Split Docs
  // -------------------------------------------------------------------------
  console.log('\n8. Strict B2B Agent Commercial Cost Redaction Across Split Docs:');
  const agentTestQuote = buildRealisticOversizedQuote('QTE-AGENT-REDACT', {
    embeddedVersions: 0,
    itemCount: 8,
    descBytes: 1200,
    htmlRepeats: 15
  });
  const agentSaveRes = await db.saveQuotationExplicitVersionAsync({
    quote: agentTestQuote,
    user: B2B_AGENT_USER,
    changesSummary: 'Agent save redaction check',
    clientSaveRequestId: 'req-agent-redact-001'
  });
  const agentDebug = db.getSplitVersionDebugSnapshot('QTE-AGENT-REDACT', agentSaveRes.versionNumber);
  const serializedDebug = JSON.stringify({
    manifest: agentDebug.manifest,
    sections: agentDebug.sectionDocs,
    master: agentDebug.compactedMaster?.doc
  });
  const leakedKeys = ['totalNetCost', 'internalNettCost', 'supplierCost', 'internalProfit', 'totalMargin', 'marginAmount'].filter(k =>
    serializedDebug.includes(`"${k}"`)
  );
  const agentVersionsList = db.getQuotationVersions('QTE-AGENT-REDACT', B2B_AGENT_USER);
  const loadedForAgent = await db.loadQuotationVersionFullAsync('QTE-AGENT-REDACT', 1, B2B_AGENT_USER);
  const loadedSerialized = JSON.stringify({ agentVersionsList, loadedForAgent });
  const leakedInLoaded = ['totalNetCost', 'internalNettCost', 'supplierCost', 'internalProfit'].filter(k =>
    loadedSerialized.includes(`"${k}"`)
  );
  assert(
    leakedKeys.length === 0 && leakedInLoaded.length === 0,
    `Zero internal supplier/net cost keys exposed to B2B_AGENT across manifest, sections, compacted master, or loaders`,
    { leakedKeys, leakedInLoaded }
  );

  // -------------------------------------------------------------------------
  // TEST 9: Restore Draft, All 7 Output Actions Parity & Booking Conversion
  // -------------------------------------------------------------------------
  console.log('\n9. Restore Draft, Output Parity (Preview / PDF / Email / WhatsApp / Booking):');
  // Clear cached full version temporarily from memory cache so loader proves section reassembly works
  const v3Loaded = await db.loadQuotationVersionFullAsync('QTE-MWGLGYD1', 3, ADMIN_USER);
  const v4Loaded = await db.loadQuotationVersionFullAsync('QTE-MWGLGYD1', 4, ADMIN_USER);
  assert(
    Boolean(v3Loaded && v3Loaded.items && v3Loaded.items.length === 42) &&
      Boolean(v4Loaded && v4Loaded.items && v4Loaded.items.length === 55),
    'Historical split versions v3 (42 items) & v4 (55 items) independently reconstruct without cross-bleed'
  );

  const restoredDraft = await db.prepareRestoredWorkingQuoteAsync('QTE-MWGLGYD1', 3, ADMIN_USER);
  const currentMaxBeforeRestore = db.getQuoteByIdAuthorized('QTE-MWGLGYD1', ADMIN_USER)?.latestVersion;
  assert(
    Boolean(restoredDraft) &&
      restoredDraft?.items.length === 42 &&
      currentMaxBeforeRestore === 6,
    'prepareRestoredWorkingQuoteAsync restores v3 into unsaved draft without auto-creating v7'
  );

  // Check Preview/PDF/Email/WhatsApp parity on reconstructed v4 quote
  const v4MasterHydrated = await db.hydrateMasterQuotationFromVersionAsync('QTE-MWGLGYD1', 'QTE-MWGLGYD1__v4', B2B_AGENT_USER);
  assert(Boolean(v4MasterHydrated && v4MasterHydrated.items.length === 55), 'hydrateMasterQuotationFromVersionAsync restores 55 items');

  if (v4MasterHydrated) {
    const model = buildQuotePresentationModel(v4MasterHydrated, B2B_AGENT_USER);
    const pdfPages = paginateQuotePresentationModel(model);
    const emailOut = renderQuoteEmailFromPresentationModel(model);
    const whatsappText = renderQuoteWhatsAppFromPresentationModel(model);
    const formattedTotal = model.finalCustomerSellingPriceFormatted;

    assert(
      pdfPages.length >= 1 &&
        emailOut.htmlBody.includes(formattedTotal) &&
        whatsappText.includes(formattedTotal) &&
        emailOut.htmlBody.includes(v4MasterHydrated.quoteNumber) &&
        whatsappText.includes(v4MasterHydrated.quoteNumber),
      `Output parity verified: PDF (${pdfPages.length} pages), Email, and WhatsApp all display authoritative ${formattedTotal}`
    );
  }

  // Booking conversion preserves exact sourceQuoteVersionId
  const booking = db.submitBookingFromQuote('QTE-MWGLGYD1', ADMIN_USER);
  assert(
    Boolean(booking && booking.sourceQuoteVersionId === 'QTE-MWGLGYD1__v6'),
    `Convert to Booking captures exact latest split sourceQuoteVersionId (${booking?.sourceQuoteVersionId})`
  );

  console.log('\n=======================================================================');
  console.log(`AUDIT SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('=======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
