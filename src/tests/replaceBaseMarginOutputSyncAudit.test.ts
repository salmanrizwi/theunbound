import { AppDatabase } from '../services/db';
import {
  calculateQuoteInternalBreakdown,
  calculateQuoteTotal,
  formatCurrency
} from '../services/pricingEngine';
import {
  buildAuthoritativeQuotationSnapshot,
  prepareAndPersistAuthoritativeSnapshot,
  stripHtmlTagsAndEntities,
  validateQuotationOutputConsistency
} from '../services/quotationSnapshotService';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import { EmailNotificationService } from '../services/emailNotificationService';
import { generateWhatsAppQuoteMessage } from '../services/quoteWhatsAppService';
import { buildQuoteCommunicationPayload } from '../services/communicationDataBuilder';
import { verifyNoCommercialLeak } from '../utils/customerQuoteSanitizer';
import {
  CurrencyCode,
  Product,
  Quotation,
  QuotationCommercialTermsSnapshot,
  QuoteItem,
  User
} from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, details?: unknown) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`, details !== undefined ? JSON.stringify(details, null, 2) : '');
  }
}

function approxEqual(a: number, b: number, tol = 0.05): boolean {
  return Math.abs(a - b) <= tol;
}

const ADMIN_USER: User = {
  id: 'usr-admin-replace-audit',
  name: 'Admin Director',
  email: 'business@theunbound.in',
  role: 'ADMIN',
  userType: 'ADMIN',
  agencyName: 'theunbound',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const AGENT_USER: User = {
  id: 'usr-agent-replace-audit',
  name: 'Rohan Mehta',
  email: 'rohan@horizonvacations.in',
  role: 'B2B_AGENT',
  userType: 'B2B_AGENT',
  agencyName: 'Horizon Vacations',
  companyName: 'Horizon Vacations',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const COMMERCIAL_TERMS_FIXTURE: QuotationCommercialTermsSnapshot = {
  resolvedAt: '2026-05-01T00:00:00.000Z',
  combinedHeading: 'Commercial Quotation Terms & Conditions',
  combinedPlainText: '1. Bookings are subject to availability.\n2. Standard cancellation terms apply.',
  combinedHtml: '<p>1. Bookings are subject to availability.</p><p>2. Standard cancellation terms apply.</p>',
  combinedWhatsAppText: 'Terms: Bookings are subject to availability.',
  missingTargets: [],
  entries: [
    {
      targetType: 'DESTINATION',
      targetId: 'DST-JPN',
      targetName: 'Japan',
      version: 1,
      updatedAt: '2026-05-01T00:00:00.000Z',
      sections: [
        {
          id: 'sec-jp-1',
          heading: 'Booking Terms',
          htmlContent: '<p>Standard Japan DMC commercial terms apply.</p>',
          displayOrder: 1,
          isActive: true
        }
      ]
    }
  ]
} as unknown as QuotationCommercialTermsSnapshot;

const FORBIDDEN_INTERNAL_KEYS = new Set([
  'totalNetCost',
  'netCost',
  'internalNettCost',
  'supplierCost',
  'internalMarkup',
  'internalMargin',
  'internalProfit',
  'adultNetPrice',
  'childNetPrice',
  'infantNetPrice',
  'netPrice',
  'nettPrice',
  'supplierNetRate',
  'defaultMarkupPercent',
  'unitNettPrice',
  'totalNettPrice',
  'nativeTotalNetCost',
  'adminManualMarginType',
  'adminManualMarginValue',
  'adminManualMarginAmount',
  'adminMarginMode',
  'existingMarginAmount'
]);

function findLeakedInternalKeys(obj: unknown, path = 'root', out: string[] = []): string[] {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, idx) => findLeakedInternalKeys(v, `${path}[${idx}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_INTERNAL_KEYS.has(k) && v !== undefined) {
      out.push(`${path}.${k}=${JSON.stringify(v)}`);
    }
    if (v && typeof v === 'object') {
      findLeakedInternalKeys(v, `${path}.${k}`, out);
    }
  }
  return out;
}

function makeFixedINRProduct(opts: {
  id: string;
  name: string;
  category: string;
  productType: string;
  netINR: number;
  markupPct?: number;
  markupFixed?: number;
  serviceFeeFixed?: number;
  taxPct?: number;
}): Product {
  return {
    id: opts.id,
    sku: `SKU-${opts.id.toUpperCase()}`,
    name: opts.name,
    category: opts.category,
    productType: opts.productType,
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    country: 'Japan',
    city: 'Tokyo',
    currency: 'INR',
    nativeCurrency: 'INR',
    pricingModel: 'FIXED',
    adultNetPrice: opts.netINR,
    childNetPrice: 0,
    infantNetPrice: 0,
    defaultMarkupPercent: opts.markupPct ?? 20,
    b2bAgentMarkupPercent: opts.markupPct ?? 20,
    buyerMarkupPercent: opts.markupPct ?? 20,
    ...(opts.markupFixed !== undefined ? { markupType: 'FIXED', defaultMarkupAmount: opts.markupFixed } : {}),
    serviceFeeFixed: opts.serviceFeeFixed ?? 0,
    taxPercent: opts.taxPct ?? 0,
    validityFrom: '2026-01-01',
    validityTo: '2027-12-31',
    status: 'ACTIVE',
    inclusions: [`Included arrangement for ${opts.name}`],
    exclusions: ['Personal expenses']
  } as unknown as Product;
}

function makeItem(
  id: string,
  product: Product,
  travelDate: string,
  options?: {
    dayNumber?: number;
    agentAdditionalMarkupType?: 'PERCENTAGE' | 'FIXED';
    agentAdditionalMarkupValue?: number;
    staleCalculationSelling?: number;
  }
): QuoteItem {
  const net = (product as any).adultNetPrice || 0;
  const pct = (product as any).defaultMarkupPercent ?? 20;
  const sell = options?.staleCalculationSelling ?? Math.round((net * (1 + pct / 100) + Number.EPSILON) * 100) / 100;
  return {
    id,
    product,
    travelDate,
    ...(options?.dayNumber ? ({ dayNumber: options.dayNumber } as any) : {}),
    pax: { adults: 1, children: 0, infants: 0 },
    selectedAddonIds: [],
    ...(options?.agentAdditionalMarkupType ? { agentAdditionalMarkupType: options.agentAdditionalMarkupType } : {}),
    ...(options?.agentAdditionalMarkupValue !== undefined ? { agentAdditionalMarkupValue: options.agentAdditionalMarkupValue } : {}),
    calculation: {
      unitNettPrice: net,
      totalNettPrice: net,
      totalNetCost: net,
      nativeTotalNetCost: net,
      finalTotalSellingPrice: sell,
      sellingPriceFinal: sell,
      markupAmount: Math.round((sell - net + Number.EPSILON) * 100) / 100,
      markupRate: pct / 100,
      currency: 'INR',
      nativeCurrency: 'INR',
      surchargeTotal: 0,
      taxAmount: 0,
      serviceFee: (product as any).serviceFeeFixed || 0,
      activeMarginMode: 'PRODUCT_LEVEL'
    } as any
  } as unknown as QuoteItem;
}

function buildINRFixtureQuote(params: {
  quoteId: string;
  quoteNumber: string;
  adminMarginMode: 'REPLACE' | 'ADD';
  adminManualMarginType: 'FIXED' | 'PERCENTAGE';
  adminManualMarginValue: number;
  agentMarginType?: 'PERCENTAGE' | 'FIXED';
  agentMarginValue?: number;
  items?: QuoteItem[];
  version?: number;
  leadId?: string;
}): Quotation {
  const defaultProd = makeFixedINRProduct({
    id: `prod-${params.quoteId}`,
    name: 'Tokyo Private Executive Package',
    category: 'Sightseeing',
    productType: 'Private Tour',
    netINR: 100000,
    markupPct: 20
  });
  const items = params.items || [makeItem(`qi-${params.quoteId}`, defaultProd, '2026-10-12', { dayNumber: 1 })];
  const ver = params.version ?? 1;
  return {
    id: params.quoteId,
    quoteNumber: params.quoteNumber,
    version: ver,
    versionNumber: ver,
    title: `Audit Quote ${params.quoteNumber}`,
    destination: 'Japan',
    clientName: 'Aarav Kapoor',
    clientEmail: 'aarav.kapoor@example.com',
    clientPhone: '+91 98200 11223',
    clientCompany: 'Kapoor Holdings',
    agentId: AGENT_USER.id,
    agentName: AGENT_USER.name,
    agentEmail: AGENT_USER.email,
    agentAgency: AGENT_USER.agencyName,
    currency: 'INR' as CurrencyCode,
    quotationScope: 'HOTEL_LAND',
    scope: 'HOTEL_LAND',
    activeOptionId: 'opt-1',
    travelStartDate: '2026-10-12',
    travelEndDate: '2026-10-15',
    adultsCount: 1,
    childrenCount: 0,
    infantsCount: 0,
    totalPax: 1,
    status: 'DRAFT',
    isLocked: false,
    productLevelMarginEnabled: true,
    agentLevelMarginPercent: 15,
    activeMarginMode: 'PRODUCT_LEVEL',
    adminMarginMode: params.adminMarginMode,
    adminManualMarginType: params.adminManualMarginType,
    adminManualMarginValue: params.adminManualMarginValue,
    agentMarginType: params.agentMarginType ?? 'PERCENTAGE',
    agentMarginValue: params.agentMarginValue ?? 0,
    overallMarkupPercent: params.agentMarginType === 'FIXED' ? 0 : (params.agentMarginValue ?? 0),
    overallDiscountPercent: 0,
    items,
    routeHubs: [
      {
        id: 'hub-tokyo-1',
        hubId: 'hub-tokyo',
        hubName: 'Tokyo',
        destinationId: 'DST-JPN',
        nights: 3,
        order: 1,
        roomsCount: 1,
        accommodationType: 'NO_ACCOMMODATION'
      }
    ],
    commercialTermsSnapshot: COMMERCIAL_TERMS_FIXTURE,
    termsAndConditions: COMMERCIAL_TERMS_FIXTURE.combinedPlainText,
    termsStatus: 'CONFIGURED',
    brandingMode: 'STANDARD',
    leadId: params.leadId,
    linkedLeadId: params.leadId,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    totalNetCost: 0,
    totalSellingPrice: 0,
    totalTaxes: 0,
    totalMargin: 0,
    validUntil: '2026-06-01T00:00:00.000Z'
  } as unknown as Quotation;
}

async function runAuditSuite() {
  const db = AppDatabase.getInstance();
  (db as any).setItem('saved_quotes', []);
  (db as any).setItem('bookings', []);
  (db as any).setItem('leads', []);

  // =========================================================================
  // QTE-2026-9301 Version 5 Exact Pattern Reproduction
  // Total Nett: 185,022.91 | Existing Calc Margin: 82,373.68 | Manual FIXED 24,550 REPLACE
  // Surcharges + Service Fee + Tax: 59,269.01 => Stage 1 Final Total = 268,841.92
  // Stage 2 Agent Markup: 11,545.39 => Stage 2 Customer Selling Price = 280,387.31
  // =========================================================================
  console.log('\n--- 1. QTE-2026-9301 v5 Exact Pattern & Root Cause Proof ---');
  {
    const baseProd9301 = makeFixedINRProduct({
      id: 'prod-9301-land',
      name: 'Japan Private Curated Land & Rail Package',
      category: 'Sightseeing',
      productType: 'Private Package',
      netINR: 185022.91,
      markupPct: (82373.68 / 185022.91) * 100,
      serviceFeeFixed: 59269.01,
      taxPct: 0
    });
    const item9301 = makeItem('qi-9301-1', baseProd9301, '2026-10-12', {
      dayNumber: 1,
      staleCalculationSelling: 185022.91 + 82373.68 + 59269.01
    });

    // Zero Stage 2 markup => both Stage 1 (Builder) and Stage 2 (all outputs) === 268,841.92
    const q9301NoStage2 = buildINRFixtureQuote({
      quoteId: 'QTE-2026-9301-NO-STAGE2',
      quoteNumber: 'QTE-2026-9301',
      adminMarginMode: 'REPLACE',
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 24550,
      agentMarginType: 'FIXED',
      agentMarginValue: 0,
      items: [item9301],
      version: 5
    });
    const bdNoStage2 = calculateQuoteInternalBreakdown({
      items: q9301NoStage2.items,
      targetCurrency: 'INR',
      agentMarginType: 'FIXED',
      agentMarginValue: 0,
      overallDiscountPercent: 0,
      userRole: 'ADMIN',
      user: ADMIN_USER,
      productLevelMarginEnabled: true,
      scope: 'HOTEL_LAND',
      routeHubs: q9301NoStage2.routeHubs,
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 24550,
      adminMarginMode: 'REPLACE'
    });
    const totNoStage2 = calculateQuoteTotal(q9301NoStage2, 'opt-1', undefined, 'INR');
    assert(approxEqual(bdNoStage2.adminFinalTotal, 268841.92, 0.05), `QTE-2026-9301 no-Stage2 Step 7 Stage 1 = 268,841.92 (got ${bdNoStage2.adminFinalTotal})`);
    assert(approxEqual(totNoStage2.finalCustomerSellingPrice, 268841.92, 0.05), `QTE-2026-9301 no-Stage2 calculateQuoteTotal = 268,841.92 (got ${totNoStage2.finalCustomerSellingPrice})`);

    // With Stage 2 Agent Additional Markup = 11,545.39 => Stage 1 = 268,841.92, Customer Output = 280,387.31
    const q9301v4 = buildINRFixtureQuote({
      quoteId: 'QTE-2026-9301',
      quoteNumber: 'QTE-2026-9301',
      adminMarginMode: 'REPLACE',
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 24500,
      agentMarginType: 'FIXED',
      agentMarginValue: 11545.39,
      items: [item9301],
      version: 4
    });
    const q9301v5 = buildINRFixtureQuote({
      quoteId: 'QTE-2026-9301',
      quoteNumber: 'QTE-2026-9301',
      adminMarginMode: 'REPLACE',
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 24550,
      agentMarginType: 'FIXED',
      agentMarginValue: 11545.39,
      items: [item9301],
      version: 5
    });
    const bdV4 = calculateQuoteInternalBreakdown({
      items: q9301v4.items,
      targetCurrency: 'INR',
      agentMarginType: 'FIXED',
      agentMarginValue: 11545.39,
      overallDiscountPercent: 0,
      userRole: 'ADMIN',
      user: ADMIN_USER,
      productLevelMarginEnabled: true,
      scope: 'HOTEL_LAND',
      routeHubs: q9301v4.routeHubs,
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 24500,
      adminMarginMode: 'REPLACE'
    });
    const bdV5 = calculateQuoteInternalBreakdown({
      items: q9301v5.items,
      targetCurrency: 'INR',
      agentMarginType: 'FIXED',
      agentMarginValue: 11545.39,
      overallDiscountPercent: 0,
      userRole: 'ADMIN',
      user: ADMIN_USER,
      productLevelMarginEnabled: true,
      scope: 'HOTEL_LAND',
      routeHubs: q9301v5.routeHubs,
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 24550,
      adminMarginMode: 'REPLACE'
    });
    const totV5 = calculateQuoteTotal(q9301v5, 'opt-1', undefined, 'INR');
    assert(approxEqual(bdV5.adminFinalTotal, 268841.92, 0.05), `QTE-2026-9301 v5 Stage 1 Admin Final Total = 268,841.92 (got ${bdV5.adminFinalTotal})`);
    assert(approxEqual(bdV5.partnerMarginAmount, 11545.39, 0.05), `QTE-2026-9301 v5 Stage 2 Agent Markup = 11,545.39 (got ${bdV5.partnerMarginAmount})`);
    assert(approxEqual(bdV5.finalPackagePrice, 280387.31, 0.05), `QTE-2026-9301 v5 Stage 2 Final Customer Price = 280,387.31 (got ${bdV5.finalPackagePrice})`);
    assert(approxEqual(totV5.finalCustomerSellingPrice, 280387.31, 0.05), `QTE-2026-9301 v5 calculateQuoteTotal = 280,387.31 (got ${totV5.finalCustomerSellingPrice})`);
    assert(approxEqual(bdV4.finalPackagePrice, 280337.31, 0.05), `QTE-2026-9301 v4 (FIXED 24,500) = 280,337.31 (got ${bdV4.finalPackagePrice})`);
    assert(approxEqual(bdV5.finalPackagePrice - bdV4.finalPackagePrice, 50, 0.05), `QTE-2026-9301 v4->v5 (+50 manual margin) increases final price by exactly +50`);

    // Multi-item per-item Stage 2 markup parity between calculateQuoteInternalBreakdown & calculateQuoteTotal under REPLACE mode
    const multiP1 = makeFixedINRProduct({ id: 'mp1', name: 'Tokyo Stay', category: 'Hotels', productType: 'Hotel', netINR: 80000, markupPct: 30, serviceFeeFixed: 2000 });
    const multiP2 = makeFixedINRProduct({ id: 'mp2', name: 'Kyoto Tour', category: 'Sightseeing', productType: 'Tour', netINR: 20000, markupPct: 10, serviceFeeFixed: 500 });
    const multiItems = [
      makeItem('mi-1', multiP1, '2026-10-12', { dayNumber: 1, agentAdditionalMarkupType: 'PERCENTAGE', agentAdditionalMarkupValue: 10 }),
      makeItem('mi-2', multiP2, '2026-10-13', { dayNumber: 2 })
    ];
    const multiQuote = buildINRFixtureQuote({
      quoteId: 'QTE-MULTI-REPLACE',
      quoteNumber: 'QTE-MULTI-REPLACE',
      adminMarginMode: 'REPLACE',
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 15000,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 5,
      items: multiItems
    });
    const multiBd = calculateQuoteInternalBreakdown({
      items: multiItems,
      targetCurrency: 'INR',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 5,
      overallDiscountPercent: 0,
      userRole: 'ADMIN',
      user: ADMIN_USER,
      productLevelMarginEnabled: true,
      scope: 'HOTEL_LAND',
      routeHubs: multiQuote.routeHubs,
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 15000,
      adminMarginMode: 'REPLACE'
    });
    const multiTot = calculateQuoteTotal(multiQuote, 'opt-1', undefined, 'INR');
    assert(
      approxEqual(multiBd.finalPackagePrice, multiTot.finalCustomerSellingPrice, 0.01),
      `Per-item Stage 2 markup under REPLACE mode matches between internalBreakdown (${multiBd.finalPackagePrice}) & calculateQuoteTotal (${multiTot.finalCustomerSellingPrice})`
    );
  }

  // =========================================================================
  // Tests A - E: Full Matrix (Fixed/Pct x Replace/Add + Zero Manual Margin)
  // =========================================================================
  const matrixCases: Array<{
    key: string;
    mode: 'REPLACE' | 'ADD';
    type: 'FIXED' | 'PERCENTAGE';
    value: number;
    expectedTotal: number;
  }> = [
    { key: 'Test A (Fixed Replace 24,550)', mode: 'REPLACE', type: 'FIXED', value: 24550, expectedTotal: 124550 },
    { key: 'Test B (Fixed Add 24,550)', mode: 'ADD', type: 'FIXED', value: 24550, expectedTotal: 144550 },
    { key: 'Test C (Pct Replace 10%)', mode: 'REPLACE', type: 'PERCENTAGE', value: 10, expectedTotal: 110000 },
    { key: 'Test D (Pct Add 10%)', mode: 'ADD', type: 'PERCENTAGE', value: 10, expectedTotal: 130000 },
    { key: 'Test E1 (Zero Replace)', mode: 'REPLACE', type: 'FIXED', value: 0, expectedTotal: 100000 },
    { key: 'Test E2 (Zero Add)', mode: 'ADD', type: 'FIXED', value: 0, expectedTotal: 120000 }
  ];

  console.log('\n--- 2. Tests A-E + Test F (9-Point Cross-Channel Parity & Confidentiality) ---');
  for (const tc of matrixCases) {
    const lead = db.captureLeadFromSource({
      contactName: 'Aarav Kapoor',
      email: 'aarav.kapoor@example.com',
      destinationName: 'Japan',
      source: 'MANUAL_ENTRY'
    }, ADMIN_USER);

    const rawQ = buildINRFixtureQuote({
      quoteId: `QTE-MAT-${tc.mode}-${tc.type}-${tc.value}`,
      quoteNumber: `QTE-MAT-${tc.mode}-${tc.value}`,
      adminMarginMode: tc.mode,
      adminManualMarginType: tc.type,
      adminManualMarginValue: tc.value,
      leadId: lead.id
    });

    const authSnap = buildAuthoritativeQuotationSnapshot(rawQ, {
      versionNumber: 1,
      selectedOptionIndexOrId: 'opt-1',
      brandingMode: 'STANDARD',
      user: ADMIN_USER,
      preserveExistingPricingIfLocked: false,
      recalculateIfDirty: true
    });
    const prepped = {
      ...rawQ,
      theUnboundBaseSellingPrice: authSnap.pricing.theUnboundBaseSellingPrice,
      baseFinalSellingPrice: authSnap.pricing.baseFinalSellingPrice,
      finalCustomerSellingPrice: authSnap.pricing.finalCustomerSellingPrice,
      totalSellingPrice: authSnap.pricing.finalCustomerSellingPrice,
      snapshotVersion: 1,
      snapshotHash: authSnap.snapshotHash,
      authoritativeSnapshot: authSnap
    } as Quotation;

    const saveRes = await db.saveQuotationExplicitVersionAsync({
      quote: prepped,
      user: ADMIN_USER,
      clientSaveRequestId: `save-mat-${tc.key}`
    });
    const saved = saveRes.quote;

    const bd = calculateQuoteInternalBreakdown({
      items: saved.items,
      targetCurrency: 'INR',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 0,
      overallDiscountPercent: 0,
      userRole: 'ADMIN',
      user: ADMIN_USER,
      productLevelMarginEnabled: true,
      scope: 'HOTEL_LAND',
      routeHubs: saved.routeHubs,
      adminManualMarginType: tc.type,
      adminManualMarginValue: tc.value,
      adminMarginMode: tc.mode
    });
    const engineTot = calculateQuoteTotal(saved, 'opt-1', undefined, 'INR');
    const consistency = validateQuotationOutputConsistency(saved, { selectedOptionIndexOrId: 'opt-1', brandingMode: 'STANDARD' });

    const presModel = buildQuotePresentationModel(saved);
    const pdfPages = paginateQuotePresentationModel(presModel);
    const pdfText = stripHtmlTagsAndEntities(
      pdfPages.map(p => `${p.headerHtml || ''} ${p.blocks.map(b => b.html).join(' ')} ${p.footerHtml || ''}`).join(' ')
    );
    const emailRender = renderQuoteEmailFromPresentationModel(presModel);
    const emailPayload = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(saved, {
      brandingMode: 'STANDARD',
      selectedOptionIndexOrId: 'opt-1'
    });
    const waRender = renderQuoteWhatsAppFromPresentationModel(presModel);
    const waMsg = generateWhatsAppQuoteMessage({
      quote: saved,
      selectedOptionIndexOrId: 'opt-1',
      formatStyle: 'DETAILED',
      useEmojis: true
    });
    const commPayload = buildQuoteCommunicationPayload(saved, { selectedOptionIndexOrId: 'opt-1' });
    const refreshedLead = db.getLeads().find(l => l.id === lead.id);
    const booking = db.convertQuotationToBooking(saved, ADMIN_USER);
    const expectedFormatted = formatCurrency(tc.expectedTotal, 'INR');

    assert(approxEqual(bd.finalPackagePrice, tc.expectedTotal), `${tc.key}: Builder Step 7 = ${tc.expectedTotal} (got ${bd.finalPackagePrice})`);
    assert(approxEqual(engineTot.finalCustomerSellingPrice, tc.expectedTotal), `${tc.key}: Engine calculateQuoteTotal = ${tc.expectedTotal} (got ${engineTot.finalCustomerSellingPrice})`);
    assert(approxEqual(saved.finalCustomerSellingPrice || 0, tc.expectedTotal), `${tc.key}: Saved Version = ${tc.expectedTotal} (got ${saved.finalCustomerSellingPrice})`);
    assert(consistency.isValid, `${tc.key}: validateQuotationOutputConsistency passed`, consistency.mismatches);
    assert(presModel.finalCustomerSellingPriceFormatted === expectedFormatted, `${tc.key}: Preview = ${expectedFormatted} (got ${presModel.finalCustomerSellingPriceFormatted})`);
    assert(pdfPages.length >= 1 && pdfText.includes(expectedFormatted), `${tc.key}: PDF includes ${expectedFormatted}`);
    assert(emailRender.htmlBody.includes(expectedFormatted) && emailRender.textBody.includes(expectedFormatted) && emailPayload.textBody.includes(expectedFormatted) && stripHtmlTagsAndEntities(emailPayload.htmlBody).includes(expectedFormatted), `${tc.key}: Email includes ${expectedFormatted}`);
    assert(waRender.includes(expectedFormatted) && waMsg.includes(expectedFormatted), `${tc.key}: WhatsApp includes ${expectedFormatted}`);
    assert(approxEqual(commPayload.pricing.finalSellingPrice, tc.expectedTotal), `${tc.key}: CommPayload = ${commPayload.pricing.finalSellingPrice}`);
    assert(approxEqual(refreshedLead?.quoteSnapshot?.finalSellingPrice || 0, tc.expectedTotal), `${tc.key}: Lead QuoteSnapshot = ${tc.expectedTotal} (got ${refreshedLead?.quoteSnapshot?.finalSellingPrice})`);
    const bookingTotal = (booking as any)?.finalCustomerSellingPrice || (booking as any)?.totalSellingPrice || booking?.totalAmount || 0;
    assert(approxEqual(bookingTotal, tc.expectedTotal), `${tc.key}: Booking = ${tc.expectedTotal} (got ${bookingTotal})`);

    // Confidentiality / Leak Check (Test F)
    const leakedKeys = findLeakedInternalKeys(presModel);
    assert(leakedKeys.length === 0, `${tc.key}: QuotePresentationModel has zero leaked internal keys`, leakedKeys);
    const waSafe = verifyNoCommercialLeak(waRender);
    const emailSafe = verifyNoCommercialLeak(emailPayload.textBody);
    assert(waSafe.isSafe && emailSafe.isSafe, `${tc.key}: Email & WhatsApp pass verifyNoCommercialLeak`, { waSafe, emailSafe });
    if (tc.expectedTotal !== 100000) {
      assert(!waRender.includes('100,000') && !emailPayload.textBody.includes('100,000'), `${tc.key}: Nett cost 100,000 absent from customer outputs`);
    }
  }

  // =========================================================================
  // Test G: Mode/Type Toggles, v5->v6 Save, Stage-3 Dehydrated Stub Recovery, v5 Immutability
  // =========================================================================
  console.log('\n--- 3. Test G: Mode/Type Toggles, Dehydrated Recovery & v5 Immutability ---');
  {
    const baseQ = buildINRFixtureQuote({
      quoteId: 'QTE-TEST-G-IMMUT',
      quoteNumber: 'QTE-TEST-G',
      adminMarginMode: 'ADD',
      adminManualMarginType: 'PERCENTAGE',
      adminManualMarginValue: 10,
      version: 5
    });
    const prepV5 = await prepareAndPersistAuthoritativeSnapshot({
      db,
      quote: baseQ,
      user: ADMIN_USER,
      outputOption: 'SAVE_DRAFT',
      selectedOptionIndexOrId: 'opt-1',
      brandingMode: 'STANDARD'
    });
    const saveV5 = await db.saveQuotationExplicitVersionAsync({
      quote: prepV5.quote,
      user: ADMIN_USER,
      clientSaveRequestId: 'test-g-v5'
    });
    const v5Price = saveV5.quote.finalCustomerSellingPrice || 0;
    assert(approxEqual(v5Price, 130000), `v5 saved in ADD + 10% = 130,000 (got ${v5Price})`);

    const v5Ver = saveV5.versionNumber;
    const nextVer = v5Ver + 1;

    // Toggle ADD + 10% -> REPLACE + FIXED 24,550 while retaining stale v5 authoritativeSnapshot (recalculateIfDirty test!)
    const editedToV6 = {
      ...saveV5.quote,
      adminMarginMode: 'REPLACE' as const,
      adminManualMarginType: 'FIXED' as const,
      adminManualMarginValue: 24550,
      isLocked: true,
      status: 'BOOKED' as const // Even if historically locked before edit, Save Draft recalculates when dirty
    };
    const prepV6 = buildAuthoritativeQuotationSnapshot(editedToV6, {
      existingSaved: saveV5.quote,
      versionNumber: nextVer,
      selectedOptionIndexOrId: 'opt-1',
      brandingMode: 'STANDARD',
      user: ADMIN_USER,
      preserveExistingPricingIfLocked: false,
      recalculateIfDirty: true
    });
    assert(approxEqual(prepV6.pricing.finalCustomerSellingPrice, 124550), `Recalculated v${nextVer} (REPLACE + FIXED 24,550) ignores stale lock/snapshot -> 124,550 (got ${prepV6.pricing.finalCustomerSellingPrice})`);

    const saveV6 = await db.saveQuotationExplicitVersionAsync({
      quote: { ...editedToV6, authoritativeSnapshot: prepV6, finalCustomerSellingPrice: prepV6.pricing.finalCustomerSellingPrice, totalSellingPrice: prepV6.pricing.finalCustomerSellingPrice, isLocked: false, status: 'SAVED' },
      user: ADMIN_USER,
      clientSaveRequestId: 'test-g-v6'
    });
    const v6Ver = saveV6.versionNumber;
    assert(v6Ver === nextVer && approxEqual(saveV6.quote.finalCustomerSellingPrice || 0, 124550), `v${v6Ver} committed with 124,550 (got v${v6Ver}, ${saveV6.quote.finalCustomerSellingPrice})`);

    // Verify prior version remained completely immutable
    const loadedV5 = await db.loadQuotationVersionFullAsync('QTE-TEST-G-IMMUT', v5Ver, ADMIN_USER);
    assert(
      loadedV5 !== null && approxEqual(loadedV5.finalCustomerSellingPrice || loadedV5.totalSellingPrice || 0, 130000),
      `v${v5Ver} remained strictly immutable at 130,000 after v${v6Ver} save (got ${loadedV5?.finalCustomerSellingPrice})`
    );

    // Stage-3 dehydrated stub recovery without bumping version
    const v6VersionId = `QTE-TEST-G-IMMUT__v${v6Ver}`;
    const dehydratedStub: Quotation = {
      ...saveV6.quote,
      items: saveV6.quote.items.map(it => ({
        id: it.id,
        productId: it.product?.id,
        __dehydratedToVersionId: v6VersionId
      })) as any,
      options: (saveV6.quote.options || []).map(o => ({
        id: o.id,
        optionNumber: o.optionNumber,
        __dehydratedToVersionId: v6VersionId
      })) as any,
      masterHydratedFromVersionId: v6VersionId
    };
    const vCountBeforeHydrate = db.getQuotationVersions('QTE-TEST-G-IMMUT', ADMIN_USER).length;
    const quotesArr = db.getAllSavedQuotes();
    const idxG = quotesArr.findIndex(q => q.id === 'QTE-TEST-G-IMMUT');
    if (idxG >= 0) {
      quotesArr[idxG] = dehydratedStub;
      (db as any).setItem('saved_quotes', quotesArr, false);
    }
    const fetchedHydrated = await db.fetchQuotationByIdFromFirestore('QTE-TEST-G-IMMUT', ADMIN_USER);
    const hasNoStub = Boolean(
      fetchedHydrated &&
      fetchedHydrated.items.length > 0 &&
      !fetchedHydrated.items.some((it: any) => Boolean(it.__dehydratedToVersionId))
    );
    assert(hasNoStub, `Stage-3 __dehydratedToVersionId master stub auto-hydrates full items & options cleanly`);
    const vCountAfterHydrate = db.getQuotationVersions('QTE-TEST-G-IMMUT', ADMIN_USER).length;
    assert(
      vCountAfterHydrate === vCountBeforeHydrate,
      `Hydration + output verification does not auto-bump or create phantom versions (before=${vCountBeforeHydrate}, after=${vCountAfterHydrate})`
    );

    // Agent sanitization check on saved v6
    const agentView = db.getQuoteByIdAuthorized('QTE-TEST-G-IMMUT', AGENT_USER);
    const agentLeaks = findLeakedInternalKeys(agentView);
    assert(agentLeaks.length === 0 && approxEqual(agentView?.finalCustomerSellingPrice || 0, 124550), `B2B Agent authorized view strips internal nett/admin margin while preserving 124,550`, agentLeaks);
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAuditSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
