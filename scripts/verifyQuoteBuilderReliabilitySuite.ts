import express from 'express';
import http from 'node:http';
import { AppDatabase } from '../src/services/db';
import { Quotation, User } from '../src/types';
import { createIntegrationsRouter } from '../server/integrationsService';
import { EmailNotificationService } from '../src/services/emailNotificationService';
import {
  generateWhatsAppQuoteMessage,
  buildSafeWhatsAppSharePayload,
  recordWhatsAppQuoteShareAsync,
  MAX_WHATSAPP_URL_MESSAGE_CHARS
} from '../src/services/quoteWhatsAppService';
import { backgroundJobService } from '../src/services/backgroundJobService';
import {
  quotationOperationsService,
  withBoundedTimeout,
  BoundedOperationTimeoutError,
  classifyOperationError
} from '../src/services/quotationOperationsService';
import { buildQuotePresentationModel } from '../src/services/quotePresentationModel';
import { paginateQuotePresentationModel, validatePdfLayoutBounds } from '../src/services/pdfPaginationEngine';
import { downloadQuotationPDF } from '../src/services/pdfGenerator';
import {
  splitQuotationVersionIntoSections,
  reconstructQuotationVersionFromSections
} from '../src/services/quotationVersionStorage';
import { buildAuthoritativeQuotationSnapshot } from '../src/services/quotationSnapshotService';
import { sanitizeQuoteForCustomer, verifyNoCommercialLeak } from '../src/utils/customerQuoteSanitizer';

function assert(cond: boolean, label: string, failures: string[]) {
  if (!cond) {
    failures.push(label);
    console.error(`  [FAIL] ${label}`);
  } else {
    console.log(`  [PASS] ${label}`);
  }
}

function buildRichTestQuote(id: string, version: number, overrides: Partial<Quotation> = {}): Quotation {
  return {
    id,
    quoteNumber: `UBQ-2026-${id.slice(-4).toUpperCase()}`,
    title: 'Tokyo, Hakone & Kyoto Bespoke Imperial Journey',
    destination: 'Japan',
    clientName: 'Vikram & Ananya Mehta',
    clientEmail: 'vikram.mehta@customtravel.in',
    clientPhone: '+91 98116 54959',
    clientCompany: 'Crestwood Holidays',
    agentId: 'usr-agent-test-01',
    agentName: 'Rohan Kapoor',
    agentAgency: 'Crestwood Luxury Travel',
    agentEmail: 'rohan@crestwoodholidays.in',
    agentPhone: '+91-9811654959',
    currency: 'JPY',
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-16',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    version,
    status: 'DRAFT',
    isLocked: false,
    overallDiscountPercent: 0,
    overallMarkupPercent: 10,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 10,
    agentMarginAmount: 65000,
    totalNetCost: 520000,
    totalSellingPrice: 715000,
    baseFinalSellingPrice: 650000,
    finalCustomerSellingPrice: 715000,
    totalTaxes: 0,
    totalMargin: 130000,
    termsAndConditions: 'Valid for 14 days. 30% deposit confirms hotel and rail allocations.',
    createdAt: '2026-10-15T10:00:00.000Z',
    updatedAt: '2026-10-15T10:00:00.000Z',
    routeHubs: [
      {
        id: 'hub-tokyo-1',
        hubId: 'tokyo',
        hubName: 'Tokyo',
        destinationId: 'japan',
        nights: 3,
        order: 1,
        manualHotel: {
          hotelName: 'Park Hyatt Tokyo',
          starRating: '5 Star',
          roomType: 'Park Suite King',
          mealPlan: 'Daily Breakfast (CP)',
          roomsCount: 1,
          nights: 3,
          sellingPricePerNight: 110000,
          totalSellingPrice: 330000,
          currency: 'JPY'
        } as any
      },
      {
        id: 'hub-kyoto-2',
        hubId: 'kyoto',
        hubName: 'Kyoto',
        destinationId: 'japan',
        nights: 3,
        order: 2,
        manualHotel: {
          hotelName: 'The Ritz-Carlton Kyoto',
          starRating: '5 Star',
          roomType: 'Kamogawa River View',
          mealPlan: 'Daily Breakfast (CP)',
          roomsCount: 1,
          nights: 3,
          sellingPricePerNight: 105000,
          totalSellingPrice: 315000,
          currency: 'JPY'
        } as any
      }
    ],
    dayThemes: {
      1: 'Arrival at Haneda & Private Chauffeur Check-in',
      2: 'Tokyo Heritage, Meiji Shrine & Ginza Private Culinary Tour',
      3: 'Mt. Fuji Hakone Private Excursion by Luxury Alphard',
      4: 'Nozomi Shinkansen Green Car Tokyo to Kyoto & Gion Walk',
      5: 'Arashiyama Bamboo Grove, Tenryu-ji & Golden Pavilion',
      6: 'Nara Todai-ji & Fushimi Inari Evening Torii Trail',
      7: 'Kansai International Private Chauffeur Departure'
    },
    items: [
      {
        id: 'item-trf-hnd',
        travelDate: '2026-11-10',
        serviceTime: '14:00',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        pickupPoint: 'Haneda International Airport Gate A',
        dropoffPoint: 'Park Hyatt Tokyo',
        totalNetCost: 30000,
        totalSellingPrice: 40000,
        currency: 'JPY',
        product: {
          id: 'prod-trf-hnd',
          name: 'Private Toyota Alphard Haneda Airport Transfer',
          category: 'Transfers',
          productType: 'TRANSFER',
          destinationId: 'japan',
          destinationName: 'Japan',
          city: 'Tokyo',
          shortDescription: 'Chauffeur meet & greet executive MPV transfer.',
          inclusions: ['Flight monitoring', '90 min airport wait time', 'Highway tolls'],
          exclusions: ['After-hours surcharge'],
          basePrice: 40000,
          currency: 'JPY'
        } as any,
        calculation: {
          finalTotalSellingPrice: 40000,
          totalSellingPrice: 40000,
          totalNetCost: 30000,
          currency: 'JPY'
        } as any
      },
      {
        id: 'item-act-fuji',
        travelDate: '2026-11-12',
        serviceTime: '08:30',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        meetingPoint: 'Park Hyatt Tokyo Concierge Lobby',
        totalNetCost: 85000,
        totalSellingPrice: 115000,
        currency: 'JPY',
        product: {
          id: 'prod-fuji-pvt',
          name: 'Private Mt. Fuji 5th Station, Owakudani & Lake Ashi Cruise',
          category: 'Tours & Sightseeing',
          productType: 'ACTIVITY',
          destinationId: 'japan',
          destinationName: 'Japan',
          city: 'Tokyo',
          shortDescription: 'Full-day private guided excursion around Mt. Fuji and Hakone Valley.',
          inclusions: ['Licensed English guide', 'Private MPV', 'Lake Ashi cruise tickets'],
          exclusions: ['Personal lunch'],
          basePrice: 115000,
          currency: 'JPY'
        } as any,
        calculation: {
          finalTotalSellingPrice: 115000,
          totalSellingPrice: 115000,
          totalNetCost: 85000,
          currency: 'JPY'
        } as any
      },
      {
        id: 'item-rail-kyo',
        travelDate: '2026-11-13',
        serviceTime: '09:30',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        meetingPoint: 'Tokyo Station Shinkansen Central Gate',
        totalNetCost: 29000,
        totalSellingPrice: 36000,
        currency: 'JPY',
        railJourneyDetails: {
          originStationId: 'JP-ST-TOKYO',
          originStationName: 'Tokyo Station',
          destinationStationId: 'JP-ST-KYOTO',
          destinationStationName: 'Kyoto Station',
          serviceGroup: 'NOZOMI_MIZUHO',
          carType: 'GREEN',
          seatType: 'RESERVED',
          seatPreference: 'Mt. Fuji Window Seats (D/E)'
        } as any,
        product: {
          id: 'RAIL-JP-GREEN-RESERVED',
          name: 'Nozomi Shinkansen Green Car (Tokyo -> Kyoto)',
          category: 'Rail',
          productType: 'RAIL',
          destinationId: 'japan',
          destinationName: 'Japan',
          city: 'Kyoto',
          shortDescription: 'First Class Shinkansen bullet train seats.',
          inclusions: ['Green Car seat reservation'],
          exclusions: ['Station transfers'],
          basePrice: 36000,
          currency: 'JPY'
        } as any,
        calculation: {
          finalTotalSellingPrice: 36000,
          totalSellingPrice: 36000,
          totalNetCost: 29000,
          currency: 'JPY'
        } as any
      },
      {
        id: 'item-visa-jp',
        travelDate: '2026-11-10',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        totalNetCost: 14000,
        totalSellingPrice: 24000,
        currency: 'JPY',
        product: {
          id: 'VSA-JP-TOURIST',
          name: 'Japan Tourist Single-Entry Consular Visa & ERFS Sponsorship',
          category: 'Visa & Ancillary Services',
          productType: 'VISA',
          destinationId: 'japan',
          destinationName: 'Japan',
          city: 'Tokyo',
          shortDescription: 'Official consular documentation & visa processing.',
          inclusions: ['ERFS sponsorship letter', 'VFS handling'],
          exclusions: ['Courier charges'],
          basePrice: 24000,
          currency: 'JPY'
        } as any,
        calculation: {
          finalTotalSellingPrice: 24000,
          totalSellingPrice: 24000,
          totalNetCost: 14000,
          currency: 'JPY'
        } as any
      }
    ] as any[],
    ...overrides
  };
}

async function main() {
  const failures: string[] = [];
  const db = AppDatabase.getInstance();
  const agentUser: User = {
    id: 'usr-agent-test-01',
    name: 'Rohan Kapoor',
    email: 'rohan@crestwoodholidays.in',
    role: 'B2B_AGENT',
    agencyName: 'Crestwood Luxury Travel',
    status: 'ACTIVE'
  } as any;

  // =========================================================================
  // TEST A: End-to-End Quote Builder Save Draft, Idempotency & Reopen Fidelity
  // =========================================================================
  console.log('\n=== TEST A: Save Draft v1 -> Idempotent Retry -> Reopen Hydrate -> Sequential v2 ===');
  const quoteId = `QTE-RELIAB-${Date.now().toString(36).toUpperCase()}`;
  const draftV1 = buildRichTestQuote(quoteId, 1);
  const snapV1 = buildAuthoritativeQuotationSnapshot(draftV1, {
    versionNumber: 1,
    brandingMode: 'STANDARD',
    user: agentUser
  });
  draftV1.snapshotVersion = 1;
  draftV1.snapshotHash = snapV1.snapshotHash;
  draftV1.authoritativeSnapshot = snapV1;

  const reqIdV1 = `req-save-v1-${Date.now()}`;
  const saveV1 = await db.saveQuotationExplicitVersionAsync({
    quote: draftV1,
    user: agentUser,
    clientSaveRequestId: reqIdV1
  });
  assert(saveV1.versionNumber === 1, 'Save Draft v1 returns versionNumber === 1', failures);
  assert(
    saveV1.versionRecord.storageFormat === 'SPLIT_SECTIONS_V2' &&
      db.getSplitVersionDebugSnapshot(quoteId, 1)?.manifest?.storageFormat === 'SPLIT_SECTIONS_V2',
    'Save Draft v1 uses SPLIT_SECTIONS_V2 architecture',
    failures
  );
  const v1AuthoritativePrice = saveV1.quote.finalCustomerSellingPrice!;

  const dupV1 = await db.saveQuotationExplicitVersionAsync({
    quote: draftV1,
    user: agentUser,
    clientSaveRequestId: reqIdV1
  });
  assert(dupV1.deduplicated === true && dupV1.versionNumber === 1, 'Retry with identical clientSaveRequestId deduplicates without bumping to v2', failures);

  const hydratedV1 = await db.hydrateMasterQuotationFromVersionAsync(quoteId, 1, agentUser);
  assert(Boolean(hydratedV1 && hydratedV1.items.length === 4 && hydratedV1.routeHubs?.length === 2), 'Hydrated v1 restores all 4 items and 2 route hubs', failures);

  const draftV2 = buildRichTestQuote(quoteId, 2, {
    title: 'Tokyo, Hakone & Kyoto Bespoke Imperial Journey (Updated v2)',
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 18
  });
  const snapV2 = buildAuthoritativeQuotationSnapshot(draftV2, {
    versionNumber: 2,
    brandingMode: 'STANDARD',
    user: agentUser
  });
  draftV2.snapshotVersion = 2;
  draftV2.snapshotHash = snapV2.snapshotHash;
  draftV2.authoritativeSnapshot = snapV2;
  draftV2.finalCustomerSellingPrice = snapV2.pricing.finalCustomerSellingPrice;
  draftV2.totalSellingPrice = snapV2.pricing.finalCustomerSellingPrice;

  const saveV2 = await db.saveQuotationExplicitVersionAsync({
    quote: draftV2,
    user: agentUser,
    clientSaveRequestId: `req-save-v2-${Date.now()}`
  });
  assert(saveV2.versionNumber === 2, 'Sequential Save Draft creates versionNumber === 2', failures);
  const v2AuthoritativePrice = saveV2.quote.finalCustomerSellingPrice!;

  const loadedV1 = await db.loadQuotationVersionFullAsync(quoteId, 1, agentUser);
  const loadedV2 = await db.loadQuotationVersionFullAsync(quoteId, 2, agentUser);
  assert(
    Boolean(
      loadedV1 &&
        loadedV2 &&
        v2AuthoritativePrice > v1AuthoritativePrice &&
        loadedV1.finalCustomerSellingPrice === v1AuthoritativePrice &&
        loadedV2.finalCustomerSellingPrice === v2AuthoritativePrice
    ),
    `v1 remains immutable (${v1AuthoritativePrice}) while v2 persists updated pricing independently (${v2AuthoritativePrice})`,
    failures
  );

  // =========================================================================
  // TEST B: Bounded Timeouts, Job Lock Recovery & PDF Layout Validation
  // =========================================================================
  console.log('\n=== TEST B: Bounded Job Timeouts, PDF Model Bounds & Non-DOM Failure Recovery ===');
  let timedOutProperly = false;
  try {
    await backgroundJobService.enqueue({
      idempotencyKey: `test-timeout-${Date.now()}`,
      jobType: 'PDF_EXPORT',
      label: 'Simulated Hung PDF Task',
      maxRetries: 0,
      timeoutMs: 80,
      task: () => new Promise(() => {
        // Intentionally never resolves
      })
    });
  } catch (err: any) {
    timedOutProperly = err instanceof BoundedOperationTimeoutError && err.isTimeout === true;
  }
  assert(timedOutProperly, 'BackgroundJobService rejects hung task deterministically via BoundedOperationTimeoutError', failures);
  assert(backgroundJobService.getActiveJobs().length === 0, 'Active background jobs lock clears after timeout failure', failures);

  const pdfModel = buildQuotePresentationModel(draftV2);
  const pages = paginateQuotePresentationModel(pdfModel);
  const layoutValidation = validatePdfLayoutBounds(pages);
  assert(pages.length >= 2 && layoutValidation.valid, `PDF pagination engine validates A4 layout bounds cleanly (${pages.length} pages)`, failures);

  let pdfOnErrorCalled = false;
  const nonDomPdfResult = await downloadQuotationPDF({
    quote: draftV2,
    onError: () => {
      pdfOnErrorCalled = true;
    }
  });
  assert(!nonDomPdfResult.success && pdfOnErrorCalled, 'downloadQuotationPDF returns explicit failure and fires onError cleanly in non-DOM environment', failures);

  // =========================================================================
  // TEST C: Email Dispatch, Configuration Guard, Status Check & PDF Parity
  // =========================================================================
  console.log('\n=== TEST C: Email Quotation Generation, Config Guard, Status Verification & PDF Parity ===');
  const emailService = EmailNotificationService.getInstance();
  const placeholderReject = await emailService.sendViaGmailApi(
    'client@example.com',
    'Japan Itinerary',
    '<p>Test</p>'
  );
  assert(!placeholderReject.success && placeholderReject.providerStatus === 'INVALID_RECIPIENT', 'Placeholder recipient @example.com is blocked cleanly before dispatch', failures);

  const invalidFmtReject = await emailService.sendViaGmailApi(
    'not-an-email',
    'Japan Itinerary',
    '<p>Test</p>'
  );
  assert(!invalidFmtReject.success && invalidFmtReject.providerStatus === 'INVALID_RECIPIENT', 'Malformed recipient email is rejected with validation error', failures);

  const canonicalEmail = emailService.buildCanonicalQuotationEmail(draftV2);
  assert(
    canonicalEmail.model.finalCustomerSellingPriceNumeric === pdfModel.finalCustomerSellingPriceNumeric &&
      canonicalEmail.model.finalCustomerSellingPriceFormatted === pdfModel.finalCustomerSellingPriceFormatted &&
      canonicalEmail.model.version === pdfModel.version &&
      canonicalEmail.htmlBody.includes(pdfModel.finalCustomerSellingPriceFormatted),
    `Canonical Email & PDF share exact snapshot version (v${pdfModel.version}) and total (${pdfModel.finalCustomerSellingPriceFormatted})`,
    failures
  );

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/integrations', createIntegrationsRouter());
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  try {
    const builtEmail = emailService.generateQuotationProposalEmail(draftV2);

    // 1. Missing email configuration (no server OAuth env vars and no Authorization token)
    const hasServerOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
    if (!hasServerOAuth) {
      const unconfiguredRes = await fetch(`http://localhost:${port}/api/integrations/gmail/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: draftV2.clientEmail,
          subject: builtEmail.subject,
          htmlBody: builtEmail.fullHtml,
          meta: { quoteId: draftV2.id, idempotencyKey: `unconf-${Date.now()}`, eventType: 'QUOTE_EMAIL_SENT' }
        })
      });
      const unconfiguredJson: any = await unconfiguredRes.json();
      assert(
        unconfiguredRes.status === 400 && !unconfiguredJson.success && unconfiguredJson.status === 'CONFIGURATION_ERROR',
        'Missing email configuration returns explicit HTTP 400 CONFIGURATION_ERROR instead of fake success',
        failures
      );
    }

    // 2. Configured sandbox relay dispatch + acceptance vs recipient delivery distinction
    const idempKey = `email-test-${Date.now()}`;
    const res1 = await fetch(`http://localhost:${port}/api/integrations/gmail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer theunbound-transactional-relay' },
      body: JSON.stringify({
        to: draftV2.clientEmail,
        subject: builtEmail.subject,
        htmlBody: builtEmail.fullHtml,
        meta: { quoteId: draftV2.id, idempotencyKey: idempKey, eventType: 'QUOTE_EMAIL_SENT' }
      })
    });
    const json1: any = await res1.json();
    assert(
      res1.ok &&
        json1.success &&
        json1.acceptedByProvider === true &&
        json1.deliveryConfirmed === false &&
        json1.provider === 'TRANSACTIONAL_RELAY' &&
        Boolean(json1.messageId),
      'Express /api/integrations/gmail/send returns acceptedByProvider=true, deliveryConfirmed=false with messageId',
      failures
    );

    // 3. Double-click / idempotent retry
    const res2 = await fetch(`http://localhost:${port}/api/integrations/gmail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer theunbound-transactional-relay' },
      body: JSON.stringify({
        to: draftV2.clientEmail,
        subject: builtEmail.subject,
        htmlBody: builtEmail.fullHtml,
        meta: { quoteId: draftV2.id, idempotencyKey: idempKey, eventType: 'QUOTE_EMAIL_SENT' }
      })
    });
    const json2: any = await res2.json();
    assert(res2.ok && json2.alreadySent === true && json2.messageId === json1.messageId, 'Email retry / double-click with identical idempotencyKey returns alreadySent without duplicate send', failures);

    // 4. Timeout recovery status endpoint check
    const statusResHit = await fetch(`http://localhost:${port}/api/integrations/gmail/status?idempotencyKey=${encodeURIComponent(idempKey)}`);
    const statusJsonHit: any = await statusResHit.json();
    assert(
      statusResHit.ok && statusJsonHit.found === true && statusJsonHit.acceptedByProvider === true && statusJsonHit.messageId === json1.messageId,
      'GET /api/integrations/gmail/status recovers accepted operation metadata for timed-out idempotencyKey',
      failures
    );

    const statusResMiss = await fetch(`http://localhost:${port}/api/integrations/gmail/status?idempotencyKey=never-sent-${Date.now()}`);
    const statusJsonMiss: any = await statusResMiss.json();
    assert(
      statusResMiss.ok && statusJsonMiss.found === false && statusJsonMiss.status === 'NOT_FOUND',
      'GET /api/integrations/gmail/status returns NOT_FOUND when prior dispatch did not succeed',
      failures
    );
  } finally {
    server.close();
  }

  // =========================================================================
  // TEST D: WhatsApp URL-Length Protection & VersionHistory Integrity
  // =========================================================================
  console.log('\n=== TEST D: WhatsApp Long Itinerary URL Guard, No versionHistory Pollution & Async Save ===');
  const hugeItems = Array.from({ length: 18 }).map((_, idx) => ({
    ...draftV2.items[idx % draftV2.items.length],
    id: `huge-item-${idx}`,
    notes: `Detailed chauffeur & VIP concierge instructions for service segment #${idx + 1}: meet at hotel grand foyer 15 mins prior with luggage assistance.`
  }));
  const longQuote = buildRichTestQuote(quoteId, 2, {
    items: hugeItems as any[],
    versionHistory: [{ version: 1, updatedAt: '2026-10-15T10:00:00Z', updatedBy: 'Rohan', changesSummary: 'Initial v1' }]
  });
  const waMsg = generateWhatsAppQuoteMessage({ quote: longQuote });
  const leakCheck = verifyNoCommercialLeak(waMsg);
  assert(leakCheck.isSafe && waMsg.length > MAX_WHATSAPP_URL_MESSAGE_CHARS, `Generated long WhatsApp message safely (${waMsg.length} chars) with zero commercial leaks`, failures);

  const waPayload = buildSafeWhatsAppSharePayload('+91 98116 54959', waMsg);
  assert(waPayload.wasCompactedForUrl && waPayload.urlMessage.length <= MAX_WHATSAPP_URL_MESSAGE_CHARS, 'buildSafeWhatsAppSharePayload compacts URL payload cleanly for long itineraries to prevent HTTP 414', failures);

  const waRecord = await recordWhatsAppQuoteShareAsync(db, longQuote, {
    quote: longQuote,
    recipientPhone: '919811654959',
    user: agentUser,
    savePhoneToCustomerProfile: true
  });
  assert(
    (waRecord.updatedQuote.versionHistory?.length || 0) === 1,
    'recordWhatsAppQuoteShareAsync does NOT corrupt immutable versionHistory with synthetic entries',
    failures
  );
  assert(Boolean(waRecord.updatedQuote.lastSharedViaWhatsAppAt), 'recordWhatsAppQuoteShareAsync records lastSharedViaWhatsAppAt cleanly', failures);

  // =========================================================================
  // TEST E: Split-Section Chunking (>800 KiB), Tamper Guard, Concurrency & RBAC
  // =========================================================================
  console.log('\n=== TEST E: >800 KiB Split Chunking, Integrity Guard, Concurrency Lock & RBAC Strip ===');
  const giantQuote = buildRichTestQuote(`QTE-GIANT-${Date.now().toString(36).toUpperCase()}`, 1, {
    items: Array.from({ length: 160 }).map((_, idx) => ({
      ...draftV2.items[idx % draftV2.items.length],
      id: `giant-item-${idx}`,
      internalNettCost: 99999,
      supplierCost: 88888,
      product: {
        ...draftV2.items[idx % draftV2.items.length].product,
        internalNettCost: 77777,
        longDescription: `Day segment ${idx + 1}: ` + 'Curated private cultural immersion and transfer logistics details. '.repeat(90)
      }
    })) as any[]
  });

  const preparedSections = splitQuotationVersionIntoSections({
    quote: giantQuote,
    versionRecord: {
      id: `${giantQuote.id}-v1`,
      versionId: 'v1',
      version: 1,
      quoteId: giantQuote.id,
      createdAt: giantQuote.createdAt,
      createdBy: agentUser.name,
      userId: agentUser.id,
      title: giantQuote.title,
      destination: giantQuote.destination,
      clientName: giantQuote.clientName,
      totalSellingPrice: giantQuote.totalSellingPrice,
      currency: giantQuote.currency,
      items: giantQuote.items,
      routeHubs: giantQuote.routeHubs,
      dayThemes: giantQuote.dayThemes,
      status: 'DRAFT'
    } as any,
    user: agentUser
  });
  const maxSectionBytes = preparedSections.maxDocBytes;
  const rawPayloadBytes = preparedSections.totalSectionBytes;
  assert(
    preparedSections.sectionDocs.length > 1 && rawPayloadBytes > 800 * 1024 && maxSectionBytes <= 820_000,
    `Payload > 800 KiB (${Math.round(rawPayloadBytes / 1024)} KiB) splits into ${preparedSections.sectionDocs.length} bounded sections (max ${Math.round(maxSectionBytes / 1024)} KiB)`,
    failures
  );

  // RBAC strip check
  const serializedSections = JSON.stringify(preparedSections.sectionDocs);
  assert(
    !serializedSections.includes('internalNettCost') && !serializedSections.includes('supplierCost') && !serializedSections.includes('totalNetCost'),
    'Split sections for B2B Agent strictly strip internalNettCost, supplierCost, and totalNetCost',
    failures
  );

  const sanitizedAgentQuote = sanitizeQuoteForCustomer(giantQuote);
  assert((sanitizedAgentQuote as any).totalNetCost === undefined, 'sanitizeQuoteForCustomer strips totalNetCost', failures);

  const reconstructed = reconstructQuotationVersionFromSections(
    preparedSections.manifest,
    preparedSections.sectionDocs,
    { verifyIntegrity: true }
  );
  assert((reconstructed.items?.length || 0) === 160, 'reconstructQuotationVersionFromSections restores all 160 items losslessly with verified integrity', failures);

  // Tamper / missing section guard
  let detectedMissingSection = false;
  try {
    reconstructQuotationVersionFromSections(
      preparedSections.manifest,
      preparedSections.sectionDocs.slice(0, -1),
      { verifyIntegrity: true }
    );
  } catch {
    detectedMissingSection = true;
  }
  assert(detectedMissingSection, 'reconstructQuotationVersionFromSections rejects missing/truncated section chunk when verifyIntegrity is enabled', failures);

  // Concurrent save serialization test
  const concurrentId = `QTE-CONC-${Date.now().toString(36).toUpperCase()}`;
  const qA = buildRichTestQuote(concurrentId, 1);
  const qB = buildRichTestQuote(concurrentId, 1, { title: 'Concurrent Revision B' });
  const [resA, resB] = await Promise.all([
    db.saveQuotationExplicitVersionAsync({ quote: qA, user: agentUser, clientSaveRequestId: `conc-a-${Date.now()}` }),
    db.saveQuotationExplicitVersionAsync({ quote: qB, user: agentUser, clientSaveRequestId: `conc-b-${Date.now()}` })
  ]);
  const vers = [resA.versionNumber, resB.versionNumber].sort((a, b) => a - b);
  assert(vers[0] === 1 && vers[1] === 2, `Concurrent Save Draft calls serialize cleanly without version collision (${vers.join(', ')})`, failures);

  // Operations telemetry & error classifier checks
  const trackedOp = quotationOperationsService.startOperation({
    operationType: 'SAVE_DRAFT',
    quoteId: concurrentId,
    versionId: 'v3',
    uid: agentUser.id,
    idempotencyKey: `op-test-${concurrentId}`
  });
  quotationOperationsService.markFailed(
    trackedOp.operationId,
    new BoundedOperationTimeoutError('Save', 30000)
  );
  const latestOps = quotationOperationsService.getOperationsForQuote(concurrentId);
  assert(
    latestOps.length === 1 &&
      latestOps[0].status === 'TIMED_OUT' &&
      classifyOperationError(new BoundedOperationTimeoutError('Save', 30000)).isTimeout === true,
    'quotationOperationsService records TIMED_OUT errorCode & state traceably',
    failures
  );

  // Timeout utility check
  const fastResult = await withBoundedTimeout(Promise.resolve(42), 500, 'Fast Check');
  assert(fastResult === 42, 'withBoundedTimeout resolves timely promises without overhead', failures);

  console.log('\n============================================================');
  if (failures.length > 0) {
    console.error(`RELIABILITY SUITE FAILED (${failures.length} failure(s)):`);
    failures.forEach((f) => console.error(` - ${f}`));
    process.exit(1);
  } else {
    console.log('ALL QUOTE BUILDER RELIABILITY SUITE CHECKS PASSED!');
  }
}

main().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
