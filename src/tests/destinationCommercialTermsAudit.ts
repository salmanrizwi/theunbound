import assert from 'assert';
import {
  Quotation,
  DestinationTermsSection,
  QuotationTermsExceptionApproval,
  User
} from '../types';
import {
  COMMERCIAL_QUOTATION_TERMS_16_TEMPLATE_SECTIONS,
  COMMERCIAL_QUOTATION_TERMS_ITEMS,
  resolveAuthoritativeCommercialTerms
} from '../constants/commercialQuotationTerms';
import { destinationTermsService } from '../services/destinationTermsService';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import {
  paginateQuotePresentationModel,
  validatePaginatedQuoteCompleteness
} from '../services/pdfPaginationEngine';
import {
  buildQuoteCommunicationPayload,
  formatProposalEmailFromPayload,
  formatWhatsAppQuoteFromPayload
} from '../services/communicationDataBuilder';
import {
  richTextToPlainText,
  richTextToWhatsApp,
  sanitizeRichText
} from '../utils/richTextFormatter';

// Minimal in-memory localStorage shim for headless Node execution
const memoryStorageStore = new Map<string, string>();
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {};
}
if (typeof (globalThis as any).localStorage === 'undefined' || !(globalThis as any).window.localStorage) {
  const shim: Storage = {
    get length() {
      return memoryStorageStore.size;
    },
    clear() {
      memoryStorageStore.clear();
    },
    getItem(key: string) {
      return memoryStorageStore.has(key) ? memoryStorageStore.get(key)! : null;
    },
    key(idx: number) {
      return Array.from(memoryStorageStore.keys())[idx] || null;
    },
    removeItem(key: string) {
      memoryStorageStore.delete(key);
    },
    setItem(key: string, val: string) {
      memoryStorageStore.set(key, String(val));
    }
  };
  (globalThis as any).localStorage = shim;
  (globalThis as any).window.localStorage = shim;
}
if (typeof (globalThis as any).sessionStorage === 'undefined' || !(globalThis as any).window.sessionStorage) {
  const sessionMap = new Map<string, string>();
  const sShim: Storage = {
    get length() {
      return sessionMap.size;
    },
    clear() {
      sessionMap.clear();
    },
    getItem(key: string) {
      return sessionMap.has(key) ? sessionMap.get(key)! : null;
    },
    key(idx: number) {
      return Array.from(sessionMap.keys())[idx] || null;
    },
    removeItem(key: string) {
      sessionMap.delete(key);
    },
    setItem(key: string, val: string) {
      sessionMap.set(key, String(val));
    }
  };
  (globalThis as any).sessionStorage = sShim;
  (globalThis as any).window.sessionStorage = sShim;
}

const adminUser: Partial<User> = {
  id: 'usr-admin-test',
  name: 'Elena Admin',
  email: 'elena@theunbound.com',
  role: 'ADMIN'
};

const contentManagerUser: Partial<User> = {
  id: 'usr-cms-test',
  name: 'Kenji CMS Manager',
  email: 'kenji@theunbound.com',
  role: 'TEAM_MEMBER',
  permissions: {
    cmsContent: { enabled: true }
  } as any
};

const b2bAgentUser: Partial<User> = {
  id: 'usr-agent-test',
  name: 'Rohan Mehta',
  email: 'rohan@luxuryvoyages.in',
  agencyName: 'Luxury Voyages India',
  role: 'B2B_AGENT'
};

function makeBaseQuote(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'qte-dest-terms-test-01',
    quoteNumber: 'UBQ-2026-TERM-01',
    version: 1,
    status: 'DRAFT',
    title: 'Curated Multi-Hub Journey',
    destination: 'Japan',
    currency: 'INR',
    overallDiscountPercent: 0,
    validUntil: '2026-12-31',
    totalNetCost: 150000,
    totalSellingPrice: 200000,
    finalCustomerSellingPrice: 200000,
    baseFinalSellingPrice: 185000,
    totalTaxes: 0,
    totalMargin: 50000,
    clientName: 'Aarav Sharma',
    clientEmail: 'aarav.sharma@example.com',
    clientPhone: '+91-9988776655',
    agentId: 'usr-agent-test',
    agentName: 'Rohan Mehta',
    agentAgency: 'Luxury Voyages India',
    agentEmail: 'rohan@luxuryvoyages.in',
    agentPhone: '+91-9811112222',
    agentNotes: '',
    termsAndConditions: '',
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-16',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    routeHubs: [
      { id: 'rh-tokyo', hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 3, order: 0, destinationId: 'DST-JPN', destinationName: 'Japan' }
    ],
    items: [
      {
        id: 'itm-tokyo-hotel',
        hubId: 'hub-tokyo',
        category: 'Hotels',
        service_type: 'HOTEL',
        product: {
          id: 'prod-tokyo-hotel',
          name: 'Park Hyatt Tokyo',
          category: 'Hotels',
          productType: 'Hotel',
          city: 'Tokyo',
          hubId: 'hub-tokyo',
          destinationId: 'DST-JPN',
          destinationName: 'Japan',
          country: 'Japan',
          duration: '3 Nights',
          inclusions: ['Daily Breakfast'],
          exclusions: ['Personal expenses']
        } as any,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-11-10',
        calculation: {
          productId: 'prod-tokyo-hotel',
          productName: 'Park Hyatt Tokyo',
          pricingTier: 'B2B',
          currency: 'INR',
          price: 200000,
          finalTotalSellingPrice: 200000,
          sellingPriceFinal: 200000,
          pricePerPerson: 100000,
          adultsSubtotalSelling: 200000,
          childrenSubtotalSelling: 0,
          infantsSubtotalSelling: 0
        } as any
      }
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides
  };
}

async function runAudit(): Promise<void> {
  console.log('=== DESTINATION-WISE COMMERCIAL QUOTATION TERMS AUDIT ===');
  destinationTermsService.clearCacheForTests();

  // Test 1 & 2: 16-section template cloning + independent destination creation
  assert.strictEqual(
    COMMERCIAL_QUOTATION_TERMS_16_TEMPLATE_SECTIONS.length,
    16,
    'Initial template must have 16 sections'
  );

  const tokyoConfig = await destinationTermsService.initializeTermsForDestinationAsync({
    target: {
      targetId: 'hub-tokyo',
      targetName: 'Tokyo',
      targetType: 'HUB',
      parentDestinationId: 'DST-JPN',
      parentDestinationName: 'Japan'
    },
    mode: 'TEMPLATE_16',
    publishImmediately: true,
    user: adminUser
  });
  assert.strictEqual(tokyoConfig.sections.length, 16, 'Tokyo should clone all 16 template sections');
  assert.strictEqual(tokyoConfig.version, 1);
  assert.strictEqual(tokyoConfig.status, 'PUBLISHED');

  // Test 3: Copy Terms from Tokyo to Kyoto independently & mutate Tokyo afterwards
  const kyotoCopied = await destinationTermsService.initializeTermsForDestinationAsync({
    target: {
      targetId: 'hub-kyoto',
      targetName: 'Kyoto',
      targetType: 'HUB',
      parentDestinationId: 'DST-JPN',
      parentDestinationName: 'Japan'
    },
    mode: 'COPY_FROM',
    sourceTargetId: 'hub-tokyo',
    publishImmediately: true,
    user: adminUser
  });
  assert.strictEqual(kyotoCopied.copiedFromTargetId, 'hub-tokyo');

  // Test 4: Edit Tokyo with rich HTML (table, list, hyperlink), reorder sections, deactivate 1 section, verify Kyoto untouched & version increments
  const richTokyoHtml = `
    <p>Tokyo hotel allocations require mandatory prepayment as detailed below.</p>
    <ul><li>Peak cherry blossom surcharge applies</li><li>Non-refundable within 21 days</li></ul>
    <table>
      <thead><tr><th>Window</th><th>Deposit</th><th>Cancellation</th></tr></thead>
      <tbody><tr><td>30+ Days Prior</td><td>30% Deposit</td><td>10% Admin Fee</td></tr><tr><td>0-14 Days</td><td>100% Due</td><td>Non-Refundable</td></tr></tbody>
    </table>
    <p>Inspect supplier policy at <a href="https://tokyo.example.com/policy">Tokyo Ground Policy</a>.</p>
  `;
  const sanitizedRich = sanitizeRichText(richTokyoHtml);
  assert.ok(sanitizedRich.includes('<table>') && sanitizedRich.includes('<th>Window</th>'), 'sanitizeRichText must preserve structured HTML tables');
  assert.ok(sanitizedRich.includes('<a href="https://tokyo.example.com/policy"'), 'sanitizeRichText must preserve hyperlinks');

  const updatedTokyoSections: DestinationTermsSection[] = tokyoConfig.sections.map((s, idx) => {
    if (idx === 0) {
      return {
        ...s,
        heading: '1. Tokyo Specific Payment & Schedule Matrix',
        htmlContent: richTokyoHtml,
        displayOrder: 2
      };
    }
    if (idx === 1) {
      return {
        ...s,
        displayOrder: 1
      };
    }
    if (idx === 15) {
      return {
        ...s,
        isActive: false // Deactivate section 16
      };
    }
    return s;
  });

  const tokyoV2 = await destinationTermsService.saveDestinationTermsAsync({
    target: {
      targetId: 'hub-tokyo',
      targetName: 'Tokyo',
      targetType: 'HUB',
      parentDestinationId: 'DST-JPN',
      parentDestinationName: 'Japan'
    },
    sections: updatedTokyoSections,
    publish: true,
    changeSummary: 'Added Tokyo payment table and reordered section 1/2',
    user: adminUser
  });
  assert.strictEqual(tokyoV2.version, 2, 'Publishing Tokyo update should increment version to 2');

  const kyotoCurrent = destinationTermsService.getCachedConfigByTargetId('hub-kyoto');
  assert.strictEqual(kyotoCurrent?.version, 1, 'Kyoto version must remain v1 after Tokyo update');
  assert.ok(!kyotoCurrent?.sections.some((s) => s.htmlContent.includes('Peak cherry blossom surcharge applies')), 'Kyoto must remain isolated from Tokyo edits');

  const history = await destinationTermsService.getVersionHistoryAsync('hub-tokyo');
  assert.strictEqual(history.length, 2, 'Version history should record v1 and v2');
  assert.strictEqual(history[0].version, 2);

  // Test 5: Draft changes in CMS must NOT leak to B2B Quotes until published
  await destinationTermsService.saveDestinationTermsAsync({
    target: {
      targetId: 'hub-tokyo',
      targetName: 'Tokyo',
      targetType: 'HUB',
      parentDestinationId: 'DST-JPN',
      parentDestinationName: 'Japan'
    },
    sections: updatedTokyoSections.map((s, idx) => idx === 0 ? { ...s, htmlContent: '<p>UNPUBLISHED DRAFT SECRET RULE</p>' } : s),
    publish: false,
    user: contentManagerUser
  });
  const tokyoEvalWithDraftPending = destinationTermsService.evaluateQuotationCommercialTerms({
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    routeHubs: [{ id: 'rh-t', hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 3, order: 0 }],
    user: b2bAgentUser
  });
  assert.strictEqual(tokyoEvalWithDraftPending.termsStatus, 'TERMS_CONFIGURED');
  assert.ok(!tokyoEvalWithDraftPending.snapshot.combinedHtml.includes('UNPUBLISHED DRAFT SECRET RULE'), 'Unpublished draft must never appear on B2B quotes');
  assert.ok(tokyoEvalWithDraftPending.snapshot.combinedHtml.includes('Peak cherry blossom surcharge applies'), 'Published v2 terms must remain active');
  assert.strictEqual(tokyoEvalWithDraftPending.resolvedEntries[0].sections.length, 15, 'Deactivated section 16 must be excluded from live quotation');
  console.log('✓ Tests 1–5 Passed: Independent CRUD, 16-section cloning, isolated copying, version history, unpublished draft isolation, deactivated exclusion');

  // Test 6 & 7: Single-destination vs Multi-destination grouped & identical consolidation
  const osakaDifferent = await destinationTermsService.saveDestinationTermsAsync({
    target: {
      targetId: 'hub-osaka',
      targetName: 'Osaka',
      targetType: 'HUB',
      parentDestinationId: 'DST-JPN',
      parentDestinationName: 'Japan'
    },
    sections: [
      {
        sectionId: 'osaka-1',
        heading: '1. Osaka Expo & Convention Terms',
        htmlContent: '<p>Osaka Expo blackout dates carry 100% guarantee policy.</p>',
        displayOrder: 1,
        isActive: true
      }
    ],
    publish: true,
    user: adminUser
  });
  assert.strictEqual(osakaDifferent.version, 1);

  const multiEval = destinationTermsService.evaluateQuotationCommercialTerms({
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    routeHubs: [
      { id: 'rh-1', hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 2, order: 0 },
      { id: 'rh-2', hubId: 'hub-osaka', hubName: 'Osaka', nights: 2, order: 1 }
    ],
    user: b2bAgentUser
  });
  assert.strictEqual(multiEval.termsStatus, 'TERMS_CONFIGURED');
  assert.strictEqual(multiEval.resolvedEntries.length, 2, 'Distinct destinations must produce 2 separate grouped entries');

  // Identical destinations consolidate cleanly when content hashes match
  const naraIdentical = await destinationTermsService.initializeTermsForDestinationAsync({
    target: { targetId: 'hub-nara', targetName: 'Nara', targetType: 'HUB', parentDestinationId: 'DST-JPN', parentDestinationName: 'Japan' },
    mode: 'COPY_FROM',
    sourceTargetId: 'hub-osaka',
    publishImmediately: true,
    user: adminUser
  });
  assert.strictEqual(naraIdentical.version, 1);

  const consolidatedEval = destinationTermsService.evaluateQuotationCommercialTerms({
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    routeHubs: [
      { id: 'rh-o', hubId: 'hub-osaka', hubName: 'Osaka', nights: 2, order: 0 },
      { id: 'rh-n', hubId: 'hub-nara', hubName: 'Nara', nights: 1, order: 1 }
    ],
    user: b2bAgentUser
  });
  assert.strictEqual(consolidatedEval.resolvedEntries.length, 1, '100% identical destination configs should consolidate cleanly');
  assert.ok(consolidatedEval.resolvedEntries[0].consolidatedTargetNames?.includes('Osaka') && consolidatedEval.resolvedEntries[0].consolidatedTargetNames?.includes('Nara'));

  // Test 8: Changing destination replaces stale terms immediately
  const switchedEval = destinationTermsService.evaluateQuotationCommercialTerms({
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    routeHubs: [{ id: 'rh-o', hubId: 'hub-osaka', hubName: 'Osaka', nights: 2, order: 0 }],
    user: b2bAgentUser
  });
  assert.ok(!switchedEval.snapshot.combinedPlainText.includes('Peak cherry blossom surcharge applies'), 'Switching from Tokyo to Osaka must replace stale Tokyo terms');
  assert.ok(switchedEval.snapshot.combinedPlainText.includes('Osaka Expo blackout dates'));
  console.log('✓ Tests 6–8 Passed: Single vs multi-destination grouping, safe identical-hash consolidation, immediate destination replacement');

  // Test 9 & 10: Finalised quote snapshot immutability vs new quote pickup
  const finalisedQuote = makeBaseQuote({
    status: 'SENT',
    isLocked: true,
    termsStatus: 'QUOTATION_FINALISED',
    commercialTermsSnapshot: tokyoEvalWithDraftPending.snapshot
  });
  // Admin updates Tokyo to v3
  await destinationTermsService.saveDestinationTermsAsync({
    target: { targetId: 'hub-tokyo', targetName: 'Tokyo', targetType: 'HUB', parentDestinationId: 'DST-JPN', parentDestinationName: 'Japan' },
    sections: [{ sectionId: 't-v3', heading: '1. NEW V3 POLICY', htmlContent: '<p>2027 V3 UPDATED DEPOSIT POLICY 50%</p>', displayOrder: 1, isActive: true }],
    publish: true,
    user: adminUser
  });

  const finalisedResolved = destinationTermsService.resolveQuoteEffectiveSnapshot(finalisedQuote, b2bAgentUser);
  assert.strictEqual(finalisedResolved.isImmutableFrozen, true);
  assert.ok(finalisedResolved.readiness.snapshot.combinedPlainText.includes('Peak cherry blossom surcharge applies'), 'Finalised quote must preserve old v2 snapshot permanently');
  assert.ok(!finalisedResolved.readiness.snapshot.combinedPlainText.includes('2027 V3 UPDATED DEPOSIT POLICY 50%'), 'Finalised quote must NOT absorb v3 CMS edits');

  const newDraftResolved = destinationTermsService.resolveQuoteEffectiveSnapshot(makeBaseQuote({ status: 'DRAFT' }), b2bAgentUser);
  assert.strictEqual(newDraftResolved.isImmutableFrozen, false);
  assert.ok(newDraftResolved.readiness.snapshot.combinedPlainText.includes('2027 V3 UPDATED DEPOSIT POLICY 50%'), 'New draft quote must pick up published v3 terms');
  console.log('✓ Tests 9–10 Passed: Immutable finalised quote snapshot vs live v3 CMS pickup on new drafts');

  // Test 11 & 12: Missing terms blocking, Admin notify, Admin exception override, opt-in-only parent inheritance
  await destinationTermsService.saveDestinationTermsAsync({
    target: { targetId: 'DST-JPN', targetName: 'Japan', targetType: 'DESTINATION' },
    sections: [{ sectionId: 'jpn-1', heading: '1. Japan National Policy', htmlContent: '<p>Japan National Level Policy Clause</p>', displayOrder: 1, isActive: true }],
    publish: true,
    user: adminUser
  });

  // Hub "Sapporo" is unconfigured -> must be TERMS_MISSING even though parent Japan has published terms!
  const missingEval = destinationTermsService.evaluateQuotationCommercialTerms({
    quoteId: 'qte-missing-test',
    quoteVersion: 1,
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    routeHubs: [{ id: 'rh-sapporo', hubId: 'hub-sapporo', hubName: 'Sapporo', nights: 2, order: 0, destinationId: 'DST-JPN', destinationName: 'Japan' }],
    user: b2bAgentUser
  });
  assert.strictEqual(missingEval.termsStatus, 'TERMS_MISSING', 'Unconfigured hub must NOT silently inherit country destination terms');
  assert.strictEqual(missingEval.canFinalise, false);
  assert.strictEqual(missingEval.canExportCompleteQuote, false);
  assert.strictEqual(missingEval.missingTargets[0].targetId, 'hub-sapporo');

  await destinationTermsService.notifyAdminMissingTermsAsync({
    quoteId: 'qte-missing-test',
    quoteNumber: 'UBQ-MISS-1',
    missingTargets: missingEval.missingTargets,
    user: b2bAgentUser
  });

  // Admin approves exception for Sapporo
  const approval: QuotationTermsExceptionApproval = {
    approved: true,
    approvedBy: 'Elena Admin',
    approvedByEmail: 'elena@theunbound.com',
    approvedAt: new Date().toISOString(),
    reason: 'Special MICE charter agreement overrides Sapporo terms temporarily',
    missingDestinationIds: ['hub-sapporo'],
    missingDestinationNames: ['Sapporo']
  };
  const approvedMissingEval = destinationTermsService.evaluateQuotationCommercialTerms({
    quoteId: 'qte-missing-test',
    quoteVersion: 1,
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    routeHubs: [{ id: 'rh-sapporo', hubId: 'hub-sapporo', hubName: 'Sapporo', nights: 2, order: 0, destinationId: 'DST-JPN', destinationName: 'Japan' }],
    user: adminUser,
    termsExceptionApproval: approval
  });
  assert.strictEqual(approvedMissingEval.termsStatus, 'TERMS_APPROVED');
  assert.strictEqual(approvedMissingEval.canFinalise, true);

  // Explicit opt-in parent inheritance
  await destinationTermsService.saveDestinationTermsAsync({
    target: {
      targetId: 'hub-hakone',
      targetName: 'Hakone',
      targetType: 'HUB',
      parentDestinationId: 'DST-JPN',
      parentDestinationName: 'Japan'
    },
    sections: [],
    publish: false,
    allowParentInheritance: true,
    user: adminUser
  });
  const inheritedEval = destinationTermsService.evaluateQuotationCommercialTerms({
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    routeHubs: [{ id: 'rh-h', hubId: 'hub-hakone', hubName: 'Hakone', nights: 1, order: 0, destinationId: 'DST-JPN', destinationName: 'Japan' }],
    user: b2bAgentUser
  });
  assert.strictEqual(inheritedEval.termsStatus, 'TERMS_CONFIGURED', 'Explicitly enabled parent inheritance should resolve parent country terms');
  assert.strictEqual(inheritedEval.resolvedEntries[0].inheritedFromParentId, 'DST-JPN');
  console.log('✓ Tests 11–13 Passed: Missing destination terms blocking, Admin notification & exception approval, explicit opt-in-only inheritance');

  // Test 14–16: Preview / PDF Pagination / Email HTML & Plain / WhatsApp / White-Label parity + rich table/link conversion
  const richQuoteForExport = makeBaseQuote({
    commercialTermsSnapshot: tokyoEvalWithDraftPending.snapshot,
    termsStatus: 'QUOTATION_FINALISED',
    status: 'SENT',
    isLocked: true,
    brandingMode: 'WHITE_LABEL',
    brandingSnapshot: {
      mode: 'WHITE_LABEL',
      agencyName: 'Luxury Voyages India',
      email: 'desk@luxuryvoyages.in',
      phone: '+91-9811112222'
    } as any
  });

  const presentationModel = buildQuotePresentationModel(richQuoteForExport, {
    name: 'Rohan Mehta',
    agencyName: 'Luxury Voyages India',
    email: 'desk@luxuryvoyages.in',
    phone: '+91-9811112222',
    brandingMode: 'WHITE_LABEL'
  });
  assert.strictEqual(presentationModel.isDestinationWiseCommercialTerms, true);
  assert.ok(presentationModel.commercialTerms.includes('Peak cherry blossom surcharge applies'));
  assert.ok(presentationModel.commercialTerms.includes('Window | Deposit | Cancellation'), 'Plain text terms must format HTML tables cleanly');
  assert.ok(presentationModel.commercialTerms.includes('https://tokyo.example.com/policy'), 'Plain text must preserve hyperlink URL');

  const waFromModel = renderQuoteWhatsAppFromPresentationModel(presentationModel);
  assert.ok(!/<[^>]+>/.test(waFromModel), 'WhatsApp output must NEVER contain literal HTML tags');
  assert.ok(waFromModel.includes('Peak cherry blossom surcharge applies'));
  assert.ok(!waFromModel.toLowerCase().includes('theunbound'), 'White-Label WhatsApp must not expose TheUnbound branding');

  const emailFromModel = renderQuoteEmailFromPresentationModel(presentationModel);
  assert.ok(emailFromModel.htmlBody.includes('Peak cherry blossom surcharge applies'));
  assert.ok(emailFromModel.textBody.includes('Peak cherry blossom surcharge applies'));
  assert.ok(!emailFromModel.htmlBody.toLowerCase().includes('theunbound'), 'White-Label Email HTML must not expose TheUnbound branding');

  // Verify communicationDataBuilder direct path uses snapshot too
  const commPayload = buildQuoteCommunicationPayload(richQuoteForExport, { role: 'BUYER' });
  const waFromComm = formatWhatsAppQuoteFromPayload(commPayload);
  const emailFromComm = formatProposalEmailFromPayload(commPayload);
  assert.ok(waFromComm.includes('Peak cherry blossom surcharge applies'), 'communicationDataBuilder WhatsApp must include destination-wise terms');
  assert.ok(emailFromComm.htmlBody.includes('Peak cherry blossom surcharge applies'), 'communicationDataBuilder Email HTML must include destination-wise terms');

  // Verify PDF pagination breaks destination-wise 15+ section terms across pages without clipping
  const pdfPages = paginateQuotePresentationModel(presentationModel);
  const completeness = validatePaginatedQuoteCompleteness(presentationModel, pdfPages);
  assert.strictEqual(completeness.valid, true, `PDF pagination validation failed: ${completeness.errors.join('; ')}`);
  const allPdfHtml = pdfPages.map((p) => p.blocks.map((b) => b.html).join('\n')).join('\n');
  assert.ok(allPdfHtml.includes('Peak cherry blossom surcharge applies'));
  assert.ok(allPdfHtml.includes('Window</th>'));
  assert.ok(pdfPages.length >= 2, '15-section destination terms with itinerary should paginate cleanly across multiple A4 pages');

  // RichTextFormatter table / link helpers direct unit assertion
  const plainFromTable = richTextToPlainText(richTokyoHtml);
  assert.ok(!/<[^>]+>/.test(plainFromTable) && plainFromTable.includes('30% Deposit'), 'richTextToPlainText must preserve table content without HTML tags');
  const waFromTable = richTextToWhatsApp(richTokyoHtml);
  assert.ok(!/<[^>]+>/.test(waFromTable) && waFromTable.includes('Tokyo Ground Policy'), 'richTextToWhatsApp must preserve links without HTML tags');
  console.log('✓ Tests 14–16 Passed: Proposal model, PDF A4 multi-page pagination, HTML/Plain Email, WhatsApp, communicationDataBuilder, White-Label parity');

  // Test 17: Role Permission Enforcement (B2B Agent cannot edit/publish/delete destination terms)
  let agentWriteBlocked = false;
  try {
    await destinationTermsService.saveDestinationTermsAsync({
      target: { targetId: 'hub-tokyo', targetName: 'Tokyo', targetType: 'HUB' },
      sections: [],
      publish: true,
      user: b2bAgentUser
    });
  } catch (err: any) {
    agentWriteBlocked = String(err?.message || '').includes('Unauthorized');
  }
  assert.strictEqual(agentWriteBlocked, true, 'B2B Agent must be strictly blocked from writing destination terms');

  // Test 18: Persistence Across Cache Clear / Local Storage Reload
  (destinationTermsService as any).memoryConfigs.clear();
  (destinationTermsService as any).loadFromLocalCache();
  const reloadedOsaka = destinationTermsService.getCachedConfigByTargetId('hub-osaka');
  assert.ok(reloadedOsaka && reloadedOsaka.sections[0].heading.includes('Osaka Expo'), 'Destination terms must survive cache reload from persistence');

  // Test 19: Legacy non-snapshot quotation backward compatibility
  const legacyResolved = resolveAuthoritativeCommercialTerms({
    termsAndConditions: '',
    status: 'ISSUED',
    isLocked: true
  });
  assert.strictEqual(legacyResolved.items.length, COMMERCIAL_QUOTATION_TERMS_ITEMS.length, 'Legacy non-snapshot quotes must retain 4-item fallback');

  console.log('✓ Tests 17–21 Passed: RBAC enforcement, persistence reload recovery, legacy non-snapshot compatibility');
  console.log('ALL DESTINATION-WISE COMMERCIAL TERMS AUDIT TESTS PASSED CLEANLY!');
}

runAudit().catch((err) => {
  console.error('❌ DESTINATION COMMERCIAL TERMS AUDIT FAILED:', err);
  process.exit(1);
});
