import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AppDatabase } from '../services/db';
import { destinationTermsService } from '../services/destinationTermsService';
import {
  buildMasterPackageFromQuoteWorkspace,
  isDayLicensedGuideEnabled,
  isPackageLicensedGuideEnabled,
  parseStrictBoolean,
  resolvePackageLicensedGuideState,
  transformPackageToQuoteState
} from '../services/packageToQuoteTransformer';
import { buildAuthoritativeQuotationSnapshot } from '../services/quotationSnapshotService';
import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import {
  buildQuoteCommunicationPayload,
  formatProposalEmailFromPayload,
  formatWhatsAppQuoteFromPayload
} from '../services/communicationDataBuilder';
import { resolveAuthoritativeCommercialTerms } from '../constants/commercialQuotationTerms';
import { B2BPackage, Product, Quotation, User } from '../types';

const adminUser: User = {
  id: 'usr-admin-pkg-audit',
  name: 'Elena Admin',
  email: 'admin@theunbound.com',
  role: 'ADMIN',
  agencyName: 'TheUnbound HQ'
} as User;

const b2bAgentUser: User = {
  id: 'usr-agent-pkg-audit',
  name: 'Rohan Agent',
  email: 'rohan@luxuryvoyages.in',
  role: 'B2B_AGENT',
  agencyName: 'Luxury Voyages India',
  companyId: 'comp-lux-ind'
} as User;

async function runAudit() {
  console.log('=== PRE-CURATED MULTI-DAY ITINERARIES COMPREHENSIVE AUDIT ===\n');
  const db = AppDatabase.getInstance();
  let passed = 0;

  const check = (label: string, fn: () => void) => {
    fn();
    passed++;
    console.log(`  [PASS] ${label}`);
  };

  // =========================================================================
  // PART 1: RESPONSIVE PACKAGE CARD LAYOUT & BUTTON INTEGRITY CHECKS
  // =========================================================================
  console.log('--- PART 1: Package Card Responsive Button & Layout Audit ---');
  const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

  check('PackageManager cards use xl:grid-cols-3, min-w-0, wrap-safe footer, and 36px touch targets', () => {
    const src = readSrc('src/components/AdminCMS/PackageManager.tsx');
    assert.ok(src.includes('grid-cols-1 md:grid-cols-2 xl:grid-cols-3'), 'Admin card grid uses xl:grid-cols-3');
    assert.ok(src.includes('min-w-0 bg-white rounded-3xl'), 'Admin card root allows shrinking without horizontal overflow');
    assert.ok(src.includes('rounded-b-3xl flex flex-wrap items-center justify-between gap-2.5'), 'Admin card footer wraps cleanly');
    assert.ok(src.includes('min-h-[36px] min-w-[36px]'), 'Icon action buttons meet touch-target height');
    assert.ok(src.includes('line-clamp-2 break-words'), 'Long package titles wrap cleanly up to 2 lines');
    assert.ok(!src.includes('guideIncluded: true'), 'PackageManager handleCreateNew no longer forces guideIncluded: true');
  });

  check('B2BPackagesView cards use wrap-safe footer, min-w-0, 40px action buttons, and 2-line titles', () => {
    const src = readSrc('src/components/B2BAgentPortal/B2BPackagesView.tsx');
    assert.ok(src.includes('min-w-0 bg-white rounded-3xl'), 'B2B card root prevents flex overflow');
    assert.ok(src.includes('flex flex-wrap items-center gap-2 w-full sm:w-auto'), 'B2B card button group wraps cleanly');
    assert.ok(src.includes('min-h-[40px]'), 'B2B card CTA buttons maintain comfortable height');
    assert.ok(src.includes('sm:flex-row sm:flex-wrap sm:items-end justify-between gap-3'), 'B2B card footer wraps cleanly without clipping');
    assert.ok(src.includes('line-clamp-2 break-words'), 'B2B card titles wrap without clipping');
  });

  check('ReadyMadePackagesSection, B2BDashboardView & B2BHomeDiscoveryView card footers wrap cleanly', () => {
    const readySrc = readSrc('src/components/ReadyMadePackagesSection.tsx');
    const dashSrc = readSrc('src/components/B2BAgentPortal/B2BDashboardView.tsx');
    const homeSrc = readSrc('src/components/B2BAgentPortal/B2BHomeDiscoveryView.tsx');
    assert.ok(readySrc.includes('grid-cols-1 md:grid-cols-2 xl:grid-cols-3'), 'Public/B2B section grid uses xl:grid-cols-3');
    assert.ok(readySrc.includes('rounded-b-3xl flex flex-wrap items-center justify-between gap-2.5'), 'ReadyMade footer wraps');
    assert.ok(dashSrc.includes('flex flex-wrap items-center justify-between gap-2'), 'Dashboard card footer wraps');
    assert.ok(homeSrc.includes('flex flex-wrap items-center gap-2 pt-1'), 'Home search card footer wraps');
  });

  check('ReadyMadePackageBuilder eliminates day.guideIncluded ?? true and hardcoded guideIncluded: true', () => {
    const src = readSrc('src/components/AdminCMS/ReadyMadePackageBuilder.tsx');
    assert.ok(!src.includes('day.guideIncluded ?? true'), 'Removed nullish fallback forcing true');
    assert.ok(!src.includes('guideIncluded: true'), 'Removed hardcoded guideIncluded: true on Add Day');
    assert.ok(src.includes('Include Licensed Guide in Package'), 'Package-level Licensed Guide checkbox present');
    assert.ok(src.includes('Synchronised Destination-Level Terms & Conditions'), 'Read-only synced Destination Terms panel present');
  });

  // =========================================================================
  // PART 2: LICENSED GUIDE PERSISTENCE & ALL 9 MANDATORY SCENARIOS
  // =========================================================================
  console.log('\n--- PART 2: Licensed Guide Persistence & End-to-End Verification ---');

  check('Strict boolean parsing never coerces undefined/null/"false" to true', () => {
    assert.strictEqual(parseStrictBoolean(true), true);
    assert.strictEqual(parseStrictBoolean(false), false);
    assert.strictEqual(parseStrictBoolean(undefined), undefined);
    assert.strictEqual(parseStrictBoolean(null), undefined);
    assert.strictEqual(parseStrictBoolean('false'), undefined);
    assert.strictEqual(parseStrictBoolean('true'), undefined);
  });

  const makePkgBase = (id: string, overrides: Partial<B2BPackage> = {}): B2BPackage => ({
    id,
    title: `Audit Package ${id}`,
    name: `Audit Package ${id}`,
    slug: `audit-pkg-${id}`,
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    destinationIds: ['DST-JPN'],
    destinationNames: ['Japan'],
    hubIds: ['hub-tokyo', 'hub-kyoto'],
    hubNames: ['Tokyo', 'Kyoto'],
    durationDays: 4,
    durationNights: 3,
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800',
    tagline: 'Signature curated itinerary across Tokyo and Kyoto.',
    description: 'Four-day refined cultural and culinary circuit.',
    routeSummary: ['Tokyo (2N)', 'Kyoto (1N)'],
    routeHubs: [
      { id: 'rh-t', hubId: 'hub-tokyo', hubName: 'Tokyo', destinationId: 'DST-JPN', destinationName: 'Japan', nights: 2, order: 1 },
      { id: 'rh-k', hubId: 'hub-kyoto', hubName: 'Kyoto', destinationId: 'DST-JPN', destinationName: 'Japan', nights: 1, order: 2 }
    ],
    hotelsSummary: [],
    productIds: [],
    itinerary: [
      { dayNumber: 1, title: 'Tokyo Arrival & Chauffeur Transfer', hubId: 'hub-tokyo', hubName: 'Tokyo', description: 'Private airport arrival transfer.', productIds: [], guideIncluded: false },
      { dayNumber: 2, title: 'Tokyo Exploration', hubId: 'hub-tokyo', hubName: 'Tokyo', description: 'Asakusa & Shibuya self-paced discovery.', productIds: [], guideIncluded: false },
      { dayNumber: 3, title: 'Bullet Train to Kyoto', hubId: 'hub-kyoto', hubName: 'Kyoto', description: 'Shinkansen rail transfer to Kyoto.', productIds: [], guideIncluded: false },
      { dayNumber: 4, title: 'Kyoto Departure', hubId: 'hub-kyoto', hubName: 'Kyoto', description: 'Departure transfer to airport.', productIds: [], guideIncluded: false }
    ],
    highlights: ['Private airport chauffeur transfers', 'Curated 5-star hotels'],
    inclusions: ['3 nights accommodation with breakfast', 'Private airport transfers'],
    exclusions: ['International flights'],
    baseNetCostUSD: 1800,
    suggestedSellingPriceUSD: 2250,
    currency: 'USD',
    tripType: 'LUXURY',
    tags: ['Japan'],
    status: 'PUBLISHED',
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  });

  // Scenario 1: Create new package with Licensed Guide checked
  const pkgGuideOn = makePkgBase('pkg-audit-guide-on', {
    licensedGuideIncluded: true,
    itinerary: [
      { dayNumber: 1, title: 'Tokyo Guided Discovery', hubId: 'hub-tokyo', hubName: 'Tokyo', description: 'City landmarks.', productIds: [], guideIncluded: true },
      { dayNumber: 2, title: 'Kyoto Guided Temples', hubId: 'hub-kyoto', hubName: 'Kyoto', description: 'Historic temples.', productIds: [], guideIncluded: true }
    ]
  });
  db.savePackage(pkgGuideOn, adminUser);
  check('Scenario 1: Create package with Licensed Guide checked persists true', () => {
    const saved = db.getPackageById('pkg-audit-guide-on');
    assert.ok(saved);
    assert.strictEqual(saved.licensedGuideIncluded, true);
    assert.strictEqual(isPackageLicensedGuideEnabled(saved), true);
    assert.strictEqual(saved.itinerary?.every(d => d.guideIncluded === true), true);
  });

  // Scenario 2 & 3: Create new package with Licensed Guide unchecked, save, reopen
  const pkgGuideOff = makePkgBase('pkg-audit-guide-off', {
    licensedGuideIncluded: false,
    highlights: ['Private airport transfers', 'Accredited private licensed docents for all landmark touring'],
    inclusions: ['3 nights accommodation', 'Licensed Guide Included'],
    itinerary: [
      { dayNumber: 1, title: 'Tokyo Arrival', hubId: 'hub-tokyo', hubName: 'Tokyo', description: 'Arrival.', productIds: [], guideIncluded: false },
      { dayNumber: 2, title: 'Tokyo Leisure', hubId: 'hub-tokyo', hubName: 'Tokyo', description: 'Leisure.', productIds: [], guideIncluded: false },
      { dayNumber: 3, title: 'Kyoto Transfer', hubId: 'hub-kyoto', hubName: 'Kyoto', description: 'Transfer.', productIds: [], guideIncluded: false },
      { dayNumber: 4, title: 'Departure', hubId: 'hub-kyoto', hubName: 'Kyoto', description: 'Departure.', productIds: [], guideIncluded: false }
    ]
  });
  db.savePackage(pkgGuideOff, adminUser);
  check('Scenario 2 & 3: Create & reopen package with Licensed Guide unchecked stays strictly false', () => {
    const reopened = db.getPackageById('pkg-audit-guide-off');
    assert.ok(reopened);
    assert.strictEqual(reopened.licensedGuideIncluded, false);
    const state = resolvePackageLicensedGuideState(reopened);
    assert.strictEqual(state.enabled, false);
    assert.strictEqual(state.isConfigured, true);
    assert.strictEqual(state.needsReview, false);
    assert.strictEqual(reopened.itinerary?.every(d => d.guideIncluded === false), true);
    assert.strictEqual(isDayLicensedGuideEnabled(reopened, reopened.itinerary?.[0]), false);
  });

  // Scenario 4: Edit existing enabled package -> uncheck -> save -> reopen
  const toggledOff: B2BPackage = {
    ...pkgGuideOn,
    licensedGuideIncluded: false
  };
  db.savePackage(toggledOff, adminUser);
  check('Scenario 4: Editing enabled package to unchecked forces package & all days to false on save/reopen', () => {
    const reopened = db.getPackageById('pkg-audit-guide-on');
    assert.ok(reopened);
    assert.strictEqual(reopened.licensedGuideIncluded, false);
    assert.strictEqual(isPackageLicensedGuideEnabled(reopened), false);
    assert.strictEqual(reopened.itinerary?.every(d => d.guideIncluded === false), true);
  });

  // Legacy package audit: missing config NEVER defaults to true
  check('Legacy Audit: Missing licensedGuideIncluded and day.guideIncluded never defaults to true (flags NEEDS_REVIEW)', () => {
    const legacyPkg = makePkgBase('pkg-audit-legacy', {
      licensedGuideIncluded: undefined,
      itinerary: [
        { dayNumber: 1, title: 'Day 1', description: 'Test', productIds: [] } // guideIncluded omitted
      ]
    });
    const state = resolvePackageLicensedGuideState(legacyPkg);
    assert.strictEqual(state.enabled, false);
    assert.strictEqual(state.isConfigured, false);
    assert.strictEqual(state.needsReview, true);
    assert.strictEqual(isDayLicensedGuideEnabled(legacyPkg, legacyPkg.itinerary?.[0]), false);
  });

  // Build Master Package from Quote Builder regression check (previous `hasGuide || true` bug)
  check('Master Package Sync: buildMasterPackageFromQuoteWorkspace never forces guideIncluded || true', () => {
    const built = buildMasterPackageFromQuoteWorkspace({
      title: 'Private Chauffeur No-Guide Circuit',
      quotationScope: 'LAND_ONLY',
      licensedGuideIncluded: false,
      currentDestination: { id: 'DST-JPN', name: 'Japan', country: 'Japan' } as any,
      routeHubs: pkgGuideOff.routeHubs || [],
      items: [],
      calendarDays: [
        { dayNumber: 1, dateString: '2026-10-01' },
        { dayNumber: 2, dateString: '2026-10-02' }
      ],
      dayNotes: { 1: 'Private airport arrival transfer', 2: 'Private museum visit' },
      currency: 'USD',
      user: adminUser
    });
    assert.strictEqual(built.pkg.licensedGuideIncluded, false);
    assert.strictEqual(built.pkg.itinerary?.every(d => d.guideIncluded === false), true);
  });

  // Setup Japan Destination-Level Published Terms BEFORE Scenarios 5-8 & Part 3!
  await destinationTermsService.saveDestinationTermsAsync({
    target: { targetId: 'DST-JPN', targetName: 'Japan', targetType: 'DESTINATION' },
    sections: [
      {
        sectionId: 'jpn-sec-1',
        heading: '1. Japan Deposit & Booking Policy',
        htmlContent:
          '<p>All <strong>Japan</strong> ground services require a <em>30% non-refundable deposit</em> upon confirmation.</p>' +
          '<ul><li>Peak Sakura & Autumn Foliage surcharges apply.</li><li>Rail passes are non-refundable once issued.</li></ul>' +
          '<table><thead><tr><th>Window</th><th>Penalty</th></tr></thead><tbody><tr><td>30+ days</td><td>20%</td></tr><tr><td>Under 15 days</td><td>100%</td></tr></tbody></table>' +
          '<p>Full policy reference: <a href="https://theunbound.in/terms/japan">Japan Official Policy</a></p>',
        displayOrder: 1,
        isActive: true
      },
      {
        sectionId: 'jpn-sec-2',
        heading: '2. Japan On-Ground Operations & Chauffeur Hours',
        htmlContent: '<ol><li>Standard private vehicle usage is <strong>10 hours / day</strong> within city limits.</li><li>Overtime charges are billed directly in JPY.</li></ol>',
        displayOrder: 2,
        isActive: true
      }
    ],
    publish: true,
    user: adminUser
  });

  // Scenario 5, 6, 7, 8: Add disabled package to quotation -> PDF -> Email -> Booking Conversion
  const freshOffPkg = db.getPackageById('pkg-audit-guide-off')!;
  const transformedOff = transformPackageToQuoteState(freshOffPkg, { user: b2bAgentUser, currency: 'USD' });

  const quoteFromDisabledPkg: Quotation = {
    id: 'qte-audit-guide-off',
    quoteNumber: 'UBQ-AUD-OFF-1',
    title: transformedOff.quoteTitle,
    sourcePackageId: transformedOff.sourcePackageId,
    sourcePackageName: transformedOff.sourcePackageName,
    destination: transformedOff.destination.name,
    quotationScope: transformedOff.quotationScope,
    travelStartDate: transformedOff.startDate,
    travelEndDate: transformedOff.endDate,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    totalPax: 2,
    routeHubs: transformedOff.routeHubs,
    items: transformedOff.items,
    dayThemes: transformedOff.dayThemes,
    dayDescriptions: transformedOff.dayDescriptions,
    dayOverviews: transformedOff.dayOverviews,
    dayNotes: transformedOff.dayNotes,
    inclusions: transformedOff.inclusions,
    exclusions: transformedOff.exclusions,
    importantInformation: transformedOff.importantInformation,
    cancellationPolicy: transformedOff.cancellationPolicy,
    termsAndConditions: transformedOff.termsAndConditions,
    commercialTermsSnapshot: transformedOff.commercialTermsSnapshot,
    termsStatus: transformedOff.termsStatus,
    currency: 'USD',
    status: 'DRAFT',
    version: 1,
    clientName: 'Aarav Sharma',
    clientEmail: 'aarav@example.com',
    totalNetCost: 1800,
    totalSellingPrice: 2250,
    finalCustomerSellingPrice: 2250,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as Quotation;

  const snapOff = buildAuthoritativeQuotationSnapshot(quoteFromDisabledPkg, { user: b2bAgentUser });
  const finalizedOffQuote: Quotation = {
    ...quoteFromDisabledPkg,
    authoritativeSnapshot: snapOff,
    commercialTermsSnapshot: snapOff.commercialTerms.snapshot,
    termsAndConditions: snapOff.commercialTerms.plainText
  };

  check('Scenario 5: Disabled Licensed Guide package loaded into Quote Builder has zero Licensed Guide notes/boilerplate', () => {
    assert.strictEqual(transformedOff.licensedGuideIncluded, false);
    const allNotes = Object.values(transformedOff.dayNotes || {}).join(' ');
    assert.ok(!/licensed\s+guide/i.test(allNotes), `dayNotes must not contain Licensed Guide, got: ${allNotes}`);
    const allInclusions = [...transformedOff.inclusions, ...transformedOff.highlights].join(' ');
    assert.ok(!/licensed\s+(guide|docent)/i.test(allInclusions), `inclusions/highlights must not contain Licensed Guide boilerplate: ${allInclusions}`);
  });

  check('Scenario 6: PDF presentation model from disabled package does not display Licensed Guide', () => {
    const model = buildQuotePresentationModel(finalizedOffQuote, {
      name: b2bAgentUser.name,
      agencyName: b2bAgentUser.agencyName,
      email: b2bAgentUser.email
    });
    const combinedDayNotes = model.days.map(d => d.dayNotes || '').join(' ');
    assert.ok(!/licensed\s+guide/i.test(combinedDayNotes), 'PDF model dayNotes must not contain Licensed Guide');
    const combinedInc = model.inclusions.join(' ');
    assert.ok(!/licensed\s+guide/i.test(combinedInc), 'PDF model inclusions must not contain Licensed Guide');
  });

  check('Scenario 7: Option 2 Complete Formatted Quotation Email from disabled package does not display Licensed Guide', () => {
    const payload = buildQuoteCommunicationPayload(finalizedOffQuote, { role: 'BUYER' });
    const { htmlBody: emailHtml, textBody: emailText } = formatProposalEmailFromPayload(payload);
    assert.ok(!/licensed\s+(local\s+)?guide/i.test(emailHtml), 'Option 2 Email HTML must not mention Licensed Guide');
    assert.ok(!/licensed\s+(local\s+)?guide/i.test(emailText), 'Email plain text must not mention Licensed Guide');
  });

  db.saveQuote(finalizedOffQuote, b2bAgentUser);
  const bookingFromOff = db.convertQuotationToBooking(finalizedOffQuote.id, b2bAgentUser);
  check('Scenario 8: Booking conversion from disabled package has zero auto-added Licensed Guide & preserves destination terms', () => {
    assert.ok(bookingFromOff, 'Booking created successfully');
    const hasGuideItem = (bookingFromOff.items || []).some(i => /licensed\s+guide/i.test(i.productName || ''));
    assert.strictEqual(hasGuideItem, false, 'Booking must not invent a Licensed Guide line item');
    assert.ok(bookingFromOff.commercialTermsSnapshot?.entries.length === 1, 'Booking preserves commercialTermsSnapshot');
    assert.ok(bookingFromOff.termsAndConditions?.includes('30% non-refundable deposit'), 'Booking preserves Japan destination terms');
  });

  // Scenario 9: Independently added Guide product remains completely unaffected
  const independentGuideProduct: Product = {
    id: 'prod-indep-licensed-guide-tokyo',
    name: 'Private English-Speaking Licensed Tour Guide — Full Day Tokyo (8 Hrs)',
    sku: 'TYO-GUIDE-8H',
    category: 'Guide' as any,
    productType: 'Guide' as any,
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    city: 'Tokyo',
    basePrice: 320,
    adultNetPrice: 260,
    sellingPriceStartingFrom: 320,
    currency: 'USD',
    status: 'ACTIVE',
    inclusions: ['8 hours private licensed national guide in Tokyo'],
    exclusions: ['Guest meals & admission tickets']
  } as any;

  const quoteWithIndependentGuideRaw: Quotation = {
    ...quoteFromDisabledPkg,
    id: 'qte-audit-indep-guide',
    quoteNumber: 'UBQ-AUD-GUIDE-9',
    items: [
      ...quoteFromDisabledPkg.items,
      {
        id: 'qi-indep-guide-1',
        product: independentGuideProduct,
        quantity: 1,
        travelDate: transformedOff.startDate,
        serviceTime: '09:00 AM',
        pax: { adults: 2, children: 0, infants: 0 },
        selectedAddonIds: [],
        calculation: {
          totalNetCost: 260,
          finalTotalSellingPrice: 320,
          totalSellingPrice: 320,
          currency: 'USD'
        } as any,
        finalCustomerSellingPrice: 320,
        totalNetCost: 260,
        totalSellingPrice: 320,
        currency: 'USD',
        notes: 'Independently selected full-day licensed guide'
      } as any
    ]
  };
  const snapWithIndepGuide = buildAuthoritativeQuotationSnapshot(quoteWithIndependentGuideRaw, { user: b2bAgentUser });
  const quoteWithIndependentGuide: Quotation = {
    ...quoteWithIndependentGuideRaw,
    authoritativeSnapshot: snapWithIndepGuide,
    commercialTermsSnapshot: snapWithIndepGuide.commercialTerms.snapshot,
    termsAndConditions: snapWithIndepGuide.commercialTerms.plainText
  };

  check('Scenario 9: Independently added Guide product stays active in Quote, PDF model, Email & Booking even when package guide flag is false', () => {
    const model = buildQuotePresentationModel(quoteWithIndependentGuide, {
      name: b2bAgentUser.name,
      agencyName: b2bAgentUser.agencyName,
      email: b2bAgentUser.email
    });
    const allDayServices = model.days.flatMap(d => d.services.map(s => s.listingName)).join(' ');
    assert.ok(allDayServices.includes('Private English-Speaking Licensed Tour Guide'), 'Independent Guide product appears in PDF model');
    const payload = buildQuoteCommunicationPayload(quoteWithIndependentGuide, { role: 'BUYER' });
    const { htmlBody: html } = formatProposalEmailFromPayload(payload);
    assert.ok(html.includes('Private English-Speaking Licensed Tour Guide'), 'Independent Guide product appears in Email HTML');
    db.saveQuote(quoteWithIndependentGuide, b2bAgentUser);
    const bookingWithGuide = db.convertQuotationToBooking(quoteWithIndependentGuide.id, b2bAgentUser);
    assert.ok(bookingWithGuide?.items.some(i => i.productId === independentGuideProduct.id), 'Independent Guide product appears in Booking');
  });

  // Authorization check: B2B Agent cannot modify package records
  let agentBlocked = false;
  try {
    await db.savePackageAsync({ ...freshOffPkg, licensedGuideIncluded: true }, b2bAgentUser);
  } catch (err: any) {
    agentBlocked = /Unauthorized/i.test(err?.message || '');
  }
  assert.strictEqual(agentBlocked, true, 'B2B Agent must be blocked from mutating master packages');
  passed++;
  console.log('  [PASS] Security Check: B2B Agent savePackageAsync blocked with Unauthorized error');

  // =========================================================================
  // PART 3: DESTINATION-LEVEL TERMS & CONDITIONS SYNCHRONISATION (ALL 10 SCENARIOS)
  // =========================================================================
  console.log('\n--- PART 3: Destination-Level Terms & Conditions Synchronisation ---');

  // Scenario 1: Single-destination package
  check('Terms Scenario 1: Single-destination package syncs Japan published Destination-level terms', () => {
    const res = destinationTermsService.evaluatePackageDestinationTerms(freshOffPkg, { user: adminUser });
    assert.strictEqual(res.termsStatus, 'TERMS_CONFIGURED');
    assert.strictEqual(res.missingTargets.length, 0);
    assert.strictEqual(res.resolvedEntries.length, 1);
    assert.strictEqual(res.resolvedEntries[0].targetId, 'DST-JPN');
    assert.strictEqual(res.resolvedEntries[0].version, 1);
    assert.ok(res.snapshot.combinedHtml.includes('<strong>Japan</strong>'));
    assert.ok(res.snapshot.combinedHtml.includes('<table>'));
    assert.ok(res.snapshot.combinedHtml.includes('https://theunbound.in/terms/japan'));
    assert.ok(res.snapshot.combinedPlainText.includes('30% non-refundable deposit'));
  });

  // Setup Second Destination (UAE / Dubai) for Multi-Destination test
  await destinationTermsService.saveDestinationTermsAsync({
    target: { targetId: 'DST-ARE', targetName: 'United Arab Emirates', targetType: 'DESTINATION' },
    sections: [
      {
        sectionId: 'uae-sec-1',
        heading: '1. UAE Tourism Dirham & Visa Clause',
        htmlContent: '<p><strong>UAE Tourism Dirham</strong> fees are payable directly at hotel check-in. <em>E-visa approval</em> requires 5 working days.</p>',
        displayOrder: 1,
        isActive: true
      }
    ],
    publish: true,
    user: adminUser
  });

  // Scenario 2: Multi-destination package (Japan + UAE)
  const multiDestPkg = makePkgBase('pkg-audit-multi-dest', {
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    destinationIds: ['DST-JPN', 'DST-ARE'],
    destinationNames: ['Japan', 'United Arab Emirates'],
    routeHubs: [
      { id: 'rh-t', hubId: 'hub-tokyo', hubName: 'Tokyo', destinationId: 'DST-JPN', destinationName: 'Japan', nights: 3, order: 1 },
      { id: 'rh-d', hubId: 'hub-dubai', hubName: 'Dubai', destinationId: 'DST-ARE', destinationName: 'United Arab Emirates', nights: 2, order: 2 }
    ]
  });

  check('Terms Scenario 2: Multi-destination package keeps Japan and UAE terms clearly separated in order', () => {
    const res = destinationTermsService.evaluatePackageDestinationTerms(multiDestPkg, { user: adminUser });
    assert.strictEqual(res.termsStatus, 'TERMS_CONFIGURED');
    assert.strictEqual(res.resolvedEntries.length, 2);
    assert.strictEqual(res.resolvedEntries[0].targetId, 'DST-JPN');
    assert.strictEqual(res.resolvedEntries[1].targetId, 'DST-ARE');
    const jpnIdx = res.snapshot.combinedHtml.indexOf('Japan — Commercial Quotation Terms');
    const uaeIdx = res.snapshot.combinedHtml.indexOf('United Arab Emirates — Commercial Quotation Terms');
    assert.ok(jpnIdx >= 0 && uaeIdx > jpnIdx, 'Both destination headings appear in exact package order');
    assert.ok(res.snapshot.combinedPlainText.includes('30% non-refundable deposit'));
    assert.ok(res.snapshot.combinedPlainText.includes('UAE Tourism Dirham'));
  });

  // Scenario 3: Long formatted destination terms preserved end-to-end
  check('Terms Scenario 3: Rich formatting (headings, bold, italic, ul/ol, table, link) preserved across package, PDF model, Email & WhatsApp', () => {
    const multiTransformed = transformPackageToQuoteState(multiDestPkg, { user: b2bAgentUser, currency: 'USD' });
    assert.strictEqual(multiTransformed.termsStatus, 'TERMS_CONFIGURED');
    assert.strictEqual(multiTransformed.commercialTermsSnapshot?.entries.length, 2);

    const multiQuoteRaw: Quotation = {
      ...quoteFromDisabledPkg,
      id: 'qte-audit-multi-terms',
      quoteNumber: 'UBQ-MULTI-TERMS-1',
      sourcePackageId: multiDestPkg.id,
      commercialTermsSnapshot: multiTransformed.commercialTermsSnapshot,
      termsStatus: multiTransformed.termsStatus,
      termsAndConditions: multiTransformed.termsAndConditions
    };
    const multiSnap = buildAuthoritativeQuotationSnapshot(multiQuoteRaw, { user: b2bAgentUser });
    const multiQuote: Quotation = {
      ...multiQuoteRaw,
      authoritativeSnapshot: multiSnap,
      commercialTermsSnapshot: multiSnap.commercialTerms.snapshot,
      termsAndConditions: multiSnap.commercialTerms.plainText
    };
    const model = buildQuotePresentationModel(multiQuote, { name: b2bAgentUser.name, agencyName: b2bAgentUser.agencyName, email: b2bAgentUser.email });
    assert.strictEqual(model.isDestinationWiseCommercialTerms, true);
    assert.ok(model.commercialTermsHtml.includes('<strong>Japan</strong>'));
    assert.ok(model.commercialTermsHtml.includes('<table>'));
    assert.ok(model.commercialTermsHtml.includes('https://theunbound.in/terms/japan'));
    assert.ok(model.commercialTermsHtml.includes('UAE Tourism Dirham'));

    const payload = buildQuoteCommunicationPayload(multiQuote, { role: 'BUYER' });
    const { htmlBody: emailHtml } = formatProposalEmailFromPayload(payload);
    assert.ok(emailHtml.includes('<strong>Japan</strong>'), 'Option 2 Email preserves bold');
    assert.ok(emailHtml.includes('<em>30% non-refundable deposit</em>'), 'Option 2 Email preserves italic');
    assert.ok(emailHtml.includes('<table'), 'Option 2 Email preserves table');
    assert.ok(emailHtml.includes('https://theunbound.in/terms/japan'), 'Option 2 Email preserves hyperlinks');
    assert.ok(emailHtml.includes('UAE Tourism Dirham'), 'Option 2 Email preserves second destination terms');

    const wa = formatWhatsAppQuoteFromPayload(payload);
    assert.ok(!/<[^>]+>/.test(wa), 'WhatsApp output contains zero raw HTML tags');
    assert.ok(wa.includes('30% non-refundable deposit') && wa.includes('UAE Tourism Dirham'), 'WhatsApp contains both destinations terms');
  });

  // Scenario 4: Missing destination terms -> explicit warning, NEVER generic fallback
  const unconfiguredDestPkg = makePkgBase('pkg-audit-missing-terms', {
    destinationId: 'DST-ISL',
    destinationName: 'Iceland',
    destinationIds: ['DST-ISL'],
    destinationNames: ['Iceland'],
    routeHubs: [
      { id: 'rh-rek', hubId: 'hub-reykjavik', hubName: 'Reykjavik', destinationId: 'DST-ISL', destinationName: 'Iceland', nights: 3, order: 1 }
    ]
  });

  check('Terms Scenario 4: Missing destination terms returns TERMS_MISSING with zero generic fallback', () => {
    const res = destinationTermsService.evaluatePackageDestinationTerms(unconfiguredDestPkg, { user: adminUser });
    assert.strictEqual(res.termsStatus, 'TERMS_MISSING');
    assert.strictEqual(res.canFinalise, false);
    assert.strictEqual(res.missingTargets.length, 1);
    assert.strictEqual(res.missingTargets[0].targetName, 'Iceland');
    assert.strictEqual(res.snapshot.combinedPlainText, '');

    const transformedMissing = transformPackageToQuoteState(unconfiguredDestPkg, { user: b2bAgentUser });
    assert.strictEqual(transformedMissing.termsStatus, 'TERMS_MISSING');
    assert.strictEqual(transformedMissing.termsAndConditions, '');
    assert.deepStrictEqual(transformedMissing.missingTermsDestinations, ['Iceland']);

    const resolvedAuth = resolveAuthoritativeCommercialTerms({
      termsStatus: transformedMissing.termsStatus,
      commercialTermsSnapshot: transformedMissing.commercialTermsSnapshot,
      termsAndConditions: transformedMissing.termsAndConditions
    });
    assert.strictEqual(resolvedAuth.plainText, '', 'resolveAuthoritativeCommercialTerms must NOT substitute generic Japan terms when TERMS_MISSING');
    assert.strictEqual(resolvedAuth.items.length, 0);
  });

  // Scenario 5, 6, 7: Historical finalised quotation immutability vs new quotation receiving v2 terms
  const historicalFinalisedQuote: Quotation = {
    ...finalizedOffQuote,
    id: 'qte-audit-historical-v1',
    quoteNumber: 'UBQ-HIST-V1',
    status: 'SENT',
    isLocked: true,
    termsStatus: 'QUOTATION_FINALISED'
  };

  // Publish v2 of Japan Destination-level Terms
  await destinationTermsService.saveDestinationTermsAsync({
    target: { targetId: 'DST-JPN', targetName: 'Japan', targetType: 'DESTINATION' },
    sections: [
      {
        sectionId: 'jpn-sec-v2',
        heading: '1. Japan Revised 2027 Commercial Terms (v2)',
        htmlContent: '<p>Updated <strong>40% advance deposit policy</strong> effective for all newly issued Japan quotations.</p>',
        displayOrder: 1,
        isActive: true
      }
    ],
    publish: true,
    user: adminUser
  });

  check('Terms Scenario 5: Updating Japan destination terms publishes v2 and syncs live to package evaluation', () => {
    const liveAfterUpdate = destinationTermsService.evaluatePackageDestinationTerms(freshOffPkg, { user: adminUser });
    assert.strictEqual(liveAfterUpdate.resolvedEntries[0].version, 2);
    assert.ok(liveAfterUpdate.snapshot.combinedPlainText.includes('40% advance deposit policy'));
  });

  check('Terms Scenario 6: Historical finalised quotation remains immutably frozen on v1 terms', () => {
    const resolvedHist = destinationTermsService.resolveQuoteEffectiveSnapshot(historicalFinalisedQuote, b2bAgentUser);
    assert.strictEqual(resolvedHist.isImmutableFrozen, true);
    assert.ok(resolvedHist.readiness.snapshot.combinedPlainText.includes('30% non-refundable deposit'), 'Historical finalised quote keeps v1');
    assert.ok(!resolvedHist.readiness.snapshot.combinedPlainText.includes('40% advance deposit policy'), 'Historical quote must NOT absorb v2');
  });

  check('Terms Scenario 7, 8, 9, 10: New quotation from same package picks up v2 across Quote, PDF model, Option 2 Email & Booking', () => {
    const newTransformed = transformPackageToQuoteState(freshOffPkg, { user: b2bAgentUser, currency: 'USD' });
    assert.strictEqual(newTransformed.termsStatus, 'TERMS_CONFIGURED');
    assert.strictEqual(newTransformed.commercialTermsSnapshot?.entries[0].version, 2);
    assert.ok(newTransformed.termsAndConditions.includes('40% advance deposit policy'));

    const newQuoteRaw: Quotation = {
      ...quoteFromDisabledPkg,
      id: 'qte-audit-new-v2',
      quoteNumber: 'UBQ-NEW-V2',
      status: 'DRAFT',
      isLocked: false,
      commercialTermsSnapshot: newTransformed.commercialTermsSnapshot,
      termsStatus: newTransformed.termsStatus,
      termsAndConditions: newTransformed.termsAndConditions
    };
    const newSnap = buildAuthoritativeQuotationSnapshot(newQuoteRaw, { user: b2bAgentUser });
    const newQuote: Quotation = {
      ...newQuoteRaw,
      authoritativeSnapshot: newSnap,
      commercialTermsSnapshot: newSnap.commercialTerms.snapshot,
      termsAndConditions: newSnap.commercialTerms.plainText
    };
    const model = buildQuotePresentationModel(newQuote, { name: b2bAgentUser.name, agencyName: b2bAgentUser.agencyName, email: b2bAgentUser.email });
    assert.ok(model.commercialTermsHtml.includes('40% advance deposit policy'), 'PDF presentation model includes v2');

    const payload = buildQuoteCommunicationPayload(newQuote, { role: 'BUYER' });
    const { htmlBody: emailHtml } = formatProposalEmailFromPayload(payload);
    assert.ok(emailHtml.includes('40% advance deposit policy'), 'Option 2 Email HTML includes v2');

    db.saveQuote(newQuote, b2bAgentUser);
    const newBooking = db.convertQuotationToBooking(newQuote.id, b2bAgentUser);
    assert.ok(newBooking?.termsAndConditions?.includes('40% advance deposit policy'), 'Converted Booking includes v2 destination terms');
    assert.strictEqual(newBooking?.commercialTermsSnapshot?.entries[0].version, 2);
  });

  // Also verify Package Quote Builder evaluation with routeHubs (Tokyo, Kyoto) resolves parent Japan Destination terms
  check('Quote Builder Sync: evaluateQuotationCommercialTerms with sourcePackageId resolves Japan Destination-level terms for Tokyo & Kyoto routeHubs', () => {
    const qbEval = destinationTermsService.evaluateQuotationCommercialTerms({
      quoteId: 'qte-qb-pkg-sync',
      quoteVersion: 1,
      destinationId: 'DST-JPN',
      destinationName: 'Japan',
      sourcePackageId: freshOffPkg.id,
      routeHubs: freshOffPkg.routeHubs,
      user: b2bAgentUser
    });
    assert.strictEqual(qbEval.termsStatus, 'TERMS_CONFIGURED');
    assert.strictEqual(qbEval.missingTargets.length, 0);
    assert.strictEqual(qbEval.resolvedEntries.length, 1);
    assert.strictEqual(qbEval.resolvedEntries[0].targetId, 'DST-JPN');
    assert.ok(qbEval.snapshot.combinedPlainText.includes('40% advance deposit policy'));
  });

  console.log(`\n=== ALL ${passed} PRE-CURATED PACKAGE AUDIT CHECKS PASSED ===`);
}

runAudit().catch((err) => {
  console.error('AUDIT FAILED:', err);
  process.exit(1);
});
