/**
 * THEUNBOUND — QUOTATION VERSION CONTROL, LEAD VERSION ISOLATION,
 * COST CONFIDENTIALITY & MULTI-HUB STABILITY AUDIT SUITE
 */

import fs from 'node:fs';
import path from 'node:path';
import { AppDatabase } from '../services/db';
import { prepareAndPersistAuthoritativeSnapshot } from '../services/quotationSnapshotService';
import { resolveAndValidateQuoteForBuilder } from '../services/quotationRouting';
import { computeQuotationVersionDiff } from '../components/Quotations/QuotationVersionHistoryModal';
import { Quotation, QuoteItem, TripRouteHub, User } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: unknown) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}`, details ?? '');
  }
}

function makeSampleItem(id: string, name: string, sellingPrice: number, netCost: number): QuoteItem {
  return {
    id,
    travelDate: '2026-11-10',
    pax: { adults: 2, children: 0, infants: 0 },
    product: {
      id: `prod-${id}`,
      sku: `SKU-${id}`,
      name,
      productType: 'ACTIVITY',
      category: 'Activities',
      destinationId: 'dest-japan',
      destinationName: 'Japan',
      city: 'Tokyo',
      country: 'Japan',
      duration: '4 Hours',
      adultNetPrice: netCost / 2,
      sellingPriceStartingFrom: sellingPrice / 2,
      currency: 'USD',
      supplierId: 'sup-internal-01',
      supplierName: 'Confidential Tokyo Supplier',
      images: [],
      status: 'ACTIVE'
    } as any,
    calculation: {
      totalNetCost: netCost,
      markupRate: 0.25,
      finalTotalSellingPrice: sellingPrice,
      sellingPriceFinal: sellingPrice,
      currency: 'USD',
      isPackagePrice: false
    } as any,
    agentAdditionalMarkupType: 'PERCENTAGE',
    agentAdditionalMarkupValue: 0
  } as any;
}

function makeSampleHub(uid: string, hubName: string, nights: number, order: number): TripRouteHub {
  return {
    id: uid,
    hubId: hubName.toLowerCase(),
    hubName,
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    nights,
    order,
    accommodationType: 'hotel',
    roomsCount: 1
  };
}

function makeBaseQuote(id: string, quoteNumber: string, leadId: string, agentUser: User, items: QuoteItem[], hubs: TripRouteHub[], sellingPrice: number, netCost: number): Quotation {
  const now = new Date().toISOString();
  return {
    id,
    quoteNumber,
    leadId,
    linkedLeadId: leadId,
    version: 1,
    latestVersion: 1,
    status: 'DRAFT',
    title: `Bespoke Proposal ${quoteNumber}`,
    destination: 'Japan',
    currency: 'USD',
    totalNetCost: netCost,
    internalNettCost: netCost,
    supplierCost: netCost,
    totalMargin: sellingPrice - netCost,
    internalProfit: sellingPrice - netCost,
    theUnboundBaseSellingPrice: sellingPrice,
    baseFinalSellingPrice: sellingPrice,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    agentMarginAmount: 0,
    totalSellingPrice: sellingPrice,
    finalCustomerSellingPrice: sellingPrice,
    totalTaxes: 0,
    overallMarkupPercent: 20,
    overallDiscountPercent: 0,
    clientName: 'Aarav Mehta',
    clientEmail: 'aarav.mehta@example.com',
    clientPhone: '+91 98111 00001',
    clientCompany: 'Mehta Ventures',
    agentId: agentUser.id,
    agentName: agentUser.name,
    agentEmail: agentUser.email,
    agentAgency: agentUser.agencyName,
    createdBy: agentUser.id,
    createdByName: agentUser.name,
    createdByUserType: 'B2B_AGENT',
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-15',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    agentNotes: '',
    termsAndConditions: '',
    validUntil: '2026-12-31',
    routeHubs: hubs,
    items,
    createdAt: now,
    updatedAt: now
  };
}

async function runAudit() {
  console.log('================================================================');
  console.log('  QUOTATION VERSION CONTROL & HUB STABILITY AUDIT SUITE');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();

  const adminUser: User = {
    id: 'usr-admin-audit',
    name: 'Admin Controller',
    email: 'admin@theunbound.com',
    role: 'ADMIN',
    category: 'INTERNAL',
    approvalStatus: 'APPROVED',
    createdAt: new Date().toISOString()
  };

  const agentUser: User = {
    id: 'usr-agent-audit-1',
    name: 'Neha Kapoor',
    email: 'neha@luxuryjourneys.in',
    agencyName: 'Luxury Journeys India',
    role: 'B2B_AGENT',
    category: 'EXTERNAL',
    approvalStatus: 'APPROVED',
    createdAt: new Date().toISOString()
  };

  // Seed a lead owned by agentUser
  const leadId = `lead-audit-${Date.now()}`;
  const seededLead = db.captureLeadFromSource(
    {
      leadId,
      contactName: 'Aarav Mehta',
      email: 'aarav.mehta@example.com',
      phone: '+91 98111 00001',
      destinationName: 'Japan',
      paxAdults: 2,
      paxChildren: 0,
      userId: agentUser.id,
      userType: 'B2B_AGENT',
      b2bAgentId: agentUser.id,
      source: 'B2B_PARTNER'
    },
    agentUser
  );

  const quoteAId = `quote-audit-a-${Date.now()}`;
  const quoteBId = `quote-audit-b-${Date.now()}`;

  // ------------------------------------------------------------------
  // 1. NO QUOTATION AUTOSAVE & SAVE-DRAFT-ONLY VERSIONING
  // ------------------------------------------------------------------
  console.log('--- 1. No Autosave & Save-Draft-Only Versioning ---');

  const unsavedDraft = makeBaseQuote(
    quoteAId,
    'UBQ-AUDIT-A',
    seededLead.id,
    agentUser,
    [makeSampleItem('it-a1', 'Tokyo Private VIP City Tour', 1000, 750)],
    [makeSampleHub('hub-a1', 'Tokyo', 3, 1)],
    1000,
    750
  );

  // Calling saveQuote(..., 'AUTO_SAVED') must be a strict no-op
  db.saveQuote(unsavedDraft, agentUser, 'AUTO_SAVED');
  const afterAutoSaveLookup = db.getQuoteByIdAuthorized(quoteAId, adminUser);
  assert(!afterAutoSaveLookup, 'AUTO_SAVED does not create or persist a quotation');
  assert(
    db.getQuotationVersions(quoteAId, adminUser).length === 0,
    'AUTO_SAVED creates 0 quotation versions'
  );

  // Explicit Save Draft creates v1
  const saveV1 = await db.saveQuotationExplicitVersionAsync({
    quote: unsavedDraft,
    user: agentUser,
    clientSaveRequestId: 'req-v1-a',
    changesSummary: 'Initial v1 draft'
  });
  assert(saveV1.versionNumber === 1, 'First explicit Save Draft creates version 1');
  assert(!saveV1.deduplicated, 'First Save Draft is not deduplicated');

  // Idempotency check with identical clientSaveRequestId
  const saveV1Repeat = await db.saveQuotationExplicitVersionAsync({
    quote: unsavedDraft,
    user: agentUser,
    clientSaveRequestId: 'req-v1-a',
    changesSummary: 'Duplicate rapid click'
  });
  assert(
    saveV1Repeat.deduplicated && saveV1Repeat.versionNumber === 1,
    'Duplicate Save Draft click with identical clientSaveRequestId is idempotent and stays at v1'
  );

  // Non-Save-Draft outputs (PREVIEW_PROPOSAL / DOWNLOAD_PDF / SEND_EMAIL) must NEVER create or bump a version
  const afterPreview = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: {
      ...saveV1.quote,
      items: [
        makeSampleItem('it-a1', 'Tokyo Private VIP City Tour', 1000, 750),
        makeSampleItem('it-a2', 'Kyoto Matcha Heritage Walk', 500, 350)
      ],
      totalSellingPrice: 1500,
      finalCustomerSellingPrice: 1500
    },
    outputOption: 'PREVIEW_PROPOSAL',
    user: agentUser,
    actionType: 'SAVED',
    awaitCloudSync: false
  });
  assert(
    afterPreview.versionBumped === false && afterPreview.quote.version === 1,
    'PREVIEW_PROPOSAL never bumps quotation version'
  );
  assert(
    db.getQuotationVersions(quoteAId, adminUser).length === 1,
    'Quotation A still has exactly 1 saved version after preview output'
  );

  // Explicit Save Draft v2 with updated hub + item
  const editedForV2: Quotation = {
    ...saveV1.quote,
    items: [
      makeSampleItem('it-a1', 'Tokyo Private VIP City Tour', 1000, 750),
      makeSampleItem('it-a2', 'Kyoto Matcha Heritage Walk', 600, 420)
    ],
    routeHubs: [
      makeSampleHub('hub-a1', 'Tokyo', 3, 1),
      makeSampleHub('hub-a2', 'Kyoto', 2, 2)
    ],
    theUnboundBaseSellingPrice: 1600,
    baseFinalSellingPrice: 1600,
    totalSellingPrice: 1600,
    finalCustomerSellingPrice: 1600,
    totalNetCost: 1170,
    internalNettCost: 1170
  };
  const saveV2 = await db.saveQuotationExplicitVersionAsync({
    quote: editedForV2,
    user: adminUser,
    clientSaveRequestId: 'req-v2-a',
    changesSummary: 'Added Kyoto hub & heritage walk (v2)'
  });
  assert(saveV2.versionNumber === 2, 'Second explicit Save Draft creates version 2');

  const editedForV3: Quotation = {
    ...saveV2.quote,
    items: [
      makeSampleItem('it-a1', 'Tokyo Private VIP City Tour', 1000, 750),
      makeSampleItem('it-a2', 'Kyoto Matcha Heritage Walk', 600, 420),
      makeSampleItem('it-a3', 'Osaka Street Food Evening', 400, 280)
    ],
    routeHubs: [
      makeSampleHub('hub-a1', 'Tokyo', 3, 1),
      makeSampleHub('hub-a2', 'Kyoto', 2, 2),
      makeSampleHub('hub-a3', 'Osaka', 2, 3)
    ],
    theUnboundBaseSellingPrice: 2000,
    baseFinalSellingPrice: 2000,
    totalSellingPrice: 2000,
    finalCustomerSellingPrice: 2000,
    totalNetCost: 1450,
    internalNettCost: 1450
  };
  const saveV3 = await db.saveQuotationExplicitVersionAsync({
    quote: editedForV3,
    user: adminUser,
    clientSaveRequestId: 'req-v3-a',
    changesSummary: 'Added Osaka hub & food tour (v3)'
  });
  assert(saveV3.versionNumber === 3, 'Third explicit Save Draft creates version 3');

  const versionsAdminA = db.getQuotationVersions(quoteAId, adminUser);
  assert(
    versionsAdminA.length === 3 &&
      versionsAdminA[0].version === 3 &&
      versionsAdminA[0].isLatest === true &&
      versionsAdminA[1].version === 2 &&
      versionsAdminA[1].isLatest === false &&
      versionsAdminA[2].version === 1 &&
      versionsAdminA[2].isLatest === false,
    'Versions are ordered descending (v3, v2, v1) with isLatest=true strictly on v3'
  );
  assert(
    versionsAdminA[2].items?.length === 1 && versionsAdminA[0].items?.length === 3,
    'Historical v1 snapshot remains immutable after v2 and v3 saves'
  );

  // ------------------------------------------------------------------
  // 2. NON-AUTOSAVING RESTORE, COMPARE & READ-ONLY ENFORCEMENT
  // ------------------------------------------------------------------
  console.log('\n--- 2. Version History, Compare, Read-Only & Non-Autosaving Restore ---');

  const resolvedHistorical = resolveAndValidateQuoteForBuilder(
    db,
    { quoteId: quoteAId, quoteVersion: 1, mode: 'edit', leadId: seededLead.id },
    agentUser
  );
  assert(
    resolvedHistorical.isValid && resolvedHistorical.mode === 'readonly',
    'Opening historical non-latest version with mode=edit enforces readonly mode'
  );

  const restoredWorking = db.restoreQuotationVersion(quoteAId, 1, agentUser);
  assert(
    Boolean(restoredWorking) &&
      restoredWorking!.restoredFromVersion === 1 &&
      restoredWorking!.items.length === 1 &&
      restoredWorking!.routeHubs?.length === 1 &&
      db.getQuotationVersions(quoteAId, adminUser).length === 3,
    'restoreQuotationVersion loads v1 into working state WITHOUT auto-saving a v4 version'
  );

  const resolvedRestoreRoute = resolveAndValidateQuoteForBuilder(
    db,
    { quoteId: quoteAId, quoteVersion: 1, mode: 'restore', leadId: seededLead.id },
    agentUser
  );
  assert(
    resolvedRestoreRoute.isValid && resolvedRestoreRoute.mode === 'restore',
    'resolveAndValidateQuoteForBuilder preserves restore mode for working draft editing'
  );

  // Explicit Save Draft after restore creates v4 (max + 1), never overwriting v1/v2/v3
  const saveV4AfterRestore = await db.saveQuotationExplicitVersionAsync({
    quote: restoredWorking!,
    user: agentUser,
    clientSaveRequestId: 'req-v4-restore',
    restoredFromVersion: 1,
    changesSummary: 'Saved v4 from restored v1 baseline'
  });
  assert(
    saveV4AfterRestore.versionNumber === 4 &&
      saveV4AfterRestore.versionRecord.restoredFromVersion === 1 &&
      db.getQuotationVersions(quoteAId, adminUser).length === 4,
    'Explicit Save Draft after restore creates v4 (max + 1) while preserving v1, v2, v3'
  );

  // Version Compare diff check (v1 vs v3)
  const v1Snap = versionsAdminA.find(v => v.version === 1)!;
  const v3Snap = versionsAdminA.find(v => v.version === 3)!;
  const diffAdmin = computeQuotationVersionDiff(v1Snap, v3Snap, true);
  assert(
    diffAdmin.priceDelta === 1000 &&
      diffAdmin.hubDiffs.length === 2 &&
      diffAdmin.itemDiffs.length === 2 &&
      diffAdmin.netCostDelta === 700,
    'computeQuotationVersionDiff reports exact selling price, hub, item, and admin net cost deltas'
  );

  // ------------------------------------------------------------------
  // 3. STRICT PER-QUOTATION LEAD ISOLATION & B2B COST CONFIDENTIALITY
  // ------------------------------------------------------------------
  console.log('\n--- 3. Strict Per-Quotation Lead Isolation & B2B Cost Hiding ---');

  const quoteBDraft = makeBaseQuote(
    quoteBId,
    'UBQ-AUDIT-B',
    seededLead.id,
    agentUser,
    [makeSampleItem('it-b1', 'Hakone Mount Fuji Private Charter', 2500, 1850)],
    [makeSampleHub('hub-b1', 'Hakone', 2, 1)],
    2500,
    1850
  );
  await db.saveQuotationExplicitVersionAsync({
    quote: quoteBDraft,
    user: agentUser,
    clientSaveRequestId: 'req-v1-b',
    changesSummary: 'Separate Quote B v1'
  });

  const groupedAdmin = db.getQuoteVersionsGroupedByQuoteForLead(seededLead.id, adminUser);
  const groupA = groupedAdmin.find(g => g.quoteId === quoteAId);
  const groupB = groupedAdmin.find(g => g.quoteId === quoteBId);

  assert(
    groupedAdmin.length === 2 && Boolean(groupA) && Boolean(groupB),
    'Lead Management groups quotations strictly into 2 distinct quote containers'
  );
  assert(
    groupA!.versions.length === 4 &&
      groupA!.versions.every(v => v.quoteId === quoteAId) &&
      groupB!.versions.length === 1 &&
      groupB!.versions.every(v => v.quoteId === quoteBId),
    'Zero cross-contamination between Quote A versions and Quote B versions on the same lead'
  );

  // Verify B2B Agent strictly CANNOT see supplier nett costs or DMC margins anywhere
  const groupedAgent = db.getQuoteVersionsGroupedByQuoteForLead(seededLead.id, agentUser);
  const flatLeadVersionsAgent = db.getQuoteVersionsForLead(seededLead.id, agentUser);
  const agentV3 = groupedAgent.find(g => g.quoteId === quoteAId)?.versions.find(v => v.version === 3);

  assert(
    Boolean(agentV3) &&
      (agentV3 as any).totalNetCost === undefined &&
      (agentV3 as any).marginAmount === undefined &&
      (agentV3 as any).marginPercent === undefined &&
      (agentV3 as any).internalNettCost === undefined &&
      (agentV3 as any).supplierCost === undefined &&
      (agentV3 as any).internalProfit === undefined &&
      (agentV3 as any).dmcMarginAmount === undefined,
    'B2B Agent grouped version history strictly hides totalNetCost and DMC margins'
  );
  assert(
    agentV3!.items!.every(
      it =>
        (it.calculation as any)?.totalNetCost === undefined &&
        (it.calculation as any)?.markupRate === undefined &&
        (it.product as any)?.adultNetPrice === undefined &&
        (it.product as any)?.supplierId === undefined &&
        (it.product as any)?.supplierName === undefined
    ),
    'B2B Agent version items strictly strip adultNetPrice, calculation.totalNetCost, and supplier details'
  );
  assert(
    flatLeadVersionsAgent.every(
      v => (v as any).totalNetCost === undefined && (v as any).marginAmount === undefined
    ),
    'getQuoteVersionsForLead strips internal cost fields for B2B Agents'
  );

  const adminV3 = groupedAdmin.find(g => g.quoteId === quoteAId)?.versions.find(v => v.version === 3);
  assert(
    adminV3?.totalNetCost === 1450 && (adminV3?.marginAmount ?? 0) > 0,
    'Admin user retains full internal net cost and margin visibility'
  );

  // ------------------------------------------------------------------
  // 4. MULTI-HUB ANTI-FLICKER & CODEBASE INVARIANTS
  // ------------------------------------------------------------------
  console.log('\n--- 4. Multi-Hub Anti-Flicker & Rules Hardening Invariants ---');

  const root = process.cwd();
  const builderSrc = fs.readFileSync(
    path.join(root, 'src/components/B2BAgentPortal/UnifiedB2BQuotationBuilder.tsx'),
    'utf8'
  );
  const workspaceSrc = fs.readFileSync(
    path.join(root, 'src/components/B2BAgentPortal/StepByStepQuotationWorkspace.tsx'),
    'utf8'
  );
  const rulesSrc = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

  assert(
    !builderSrc.includes("'AUTO_SAVED'") && !workspaceSrc.includes('Auto-Saved'),
    'Quote Builder & Workspace contain zero AUTO_SAVED triggers or Auto-Saved UI pills'
  );
  assert(
    builderSrc.includes('hydratedSessionKeyRef') &&
      builderSrc.includes('handleUpdateRouteHubs') &&
      builderSrc.includes('isInternalHubMutationRef'),
    'UnifiedB2BQuotationBuilder enforces single-hydration session guard & atomic hub updates'
  );
  assert(
    workspaceSrc.includes('hubUidRef') && !workspaceSrc.includes('animate-fadeIn'),
    'StepByStepQuotationWorkspace uses monotonic hub UIDs and zero animate-fadeIn step flashes'
  );
  assert(
    rulesSrc.includes('allow update: if false;') &&
      rulesSrc.includes('isValidId(versionId)') &&
      rulesSrc.includes("!('dmcMarginAmount' in request.resource.data)"),
    'firestore.rules enforces immutable version snapshots (allow update: if false) & cost field isolation'
  );

  console.log('\n================================================================');
  console.log(`  AUDIT COMPLETE: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
