/**
 * Comprehensive Manual Margin Adjustment Audit & Regression Suite
 *
 * Verifies:
 * 1. Authoritative consolidated Total Nett Cost across all product categories:
 *    Hotels, Manual Hub Hotels, Tours/Activities, Transfers, Rail, Guides, Visas, and Surcharges
 * 2. Mode 1: ADD ("Add to Existing Margin", mandatory default) preserving Product-Level ON vs Agent-Level OFF
 * 3. Mode 2: REPLACE ("Replace Base Margin") replacing base margin while retaining surcharges, taxes, fees & discounts
 * 4. Mode switching (ADD <-> REPLACE) ignoring stale snapshots on unlocked drafts with zero auto-version bumps
 * 5. Validation (rejecting negative, NaN, Infinity) & Audit logging ('MARGIN_CHANGED') without creating versions
 * 6. Split-document Save Draft -> Load Version -> Restore Draft round-trip preserving Admin fields & stripping for Agent
 * 7. End-to-End Customer Output Sync (Preview, PDF, Email HTML/Text, WhatsApp, Lead Quotes, Booking Conversion)
 *    with strict zero-leak checks for totalNetCost, base margins, and adminManualMargin* fields
 */

import { AppDatabase } from '../services/db';
import {
  calculateProductPrice,
  calculateQuoteInternalBreakdown,
  calculateQuoteTotal,
  buildQuotationCurrencySnapshot,
  validateAdminManualMargin,
  resolveQuoteAgencyPricingContext,
  formatCurrency,
  roundCurrencyAmount,
  QuoteItemForBreakdown
} from '../services/pricingEngine';
import {
  prepareAndPersistAuthoritativeSnapshot,
  buildAuthoritativeQuotationSnapshot
} from '../services/quotationSnapshotService';
import { stripRestrictedCommercialFieldsForRole } from '../services/quotationVersionStorage';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import { EmailNotificationService } from '../services/emailNotificationService';
import { generateWhatsAppQuoteMessage } from '../services/quoteWhatsAppService';
import {
  sanitizeQuoteForAgent,
  sanitizeQuoteVersionForAgent,
  sanitizeQuoteForCustomer,
  sanitizeQuoteDocumentForCustomer
} from '../utils/customerQuoteSanitizer';
import { clearSurchargeEngineCache } from '../services/surchargeEngine';
import { CurrencyEngine } from '../services/currencyEngine';
import { Product, Quotation, QuoteItem, SurchargeMaster, User } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, details?: unknown): void {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${label}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${label}`, details !== undefined ? JSON.stringify(details, null, 2) : '');
  }
}

function makeProduct(opts: {
  id: string;
  name: string;
  category: string;
  productType: string;
  netINR: number;
  markupPercent?: number;
  taxPercent?: number;
  serviceFeeFixed?: number;
}): Product {
  return {
    id: opts.id,
    sku: `SKU-${opts.id.toUpperCase()}`,
    name: opts.name,
    category: opts.category as any,
    productType: opts.productType,
    destinationId: 'DST-JPN',
    destinationName: 'Japan',
    country: 'Japan',
    city: 'Tokyo',
    currency: 'INR',
    nativeCurrency: 'INR',
    adultNetPrice: opts.netINR,
    childNetPrice: 0,
    infantNetPrice: 0,
    defaultMarkupPercent: opts.markupPercent ?? 15,
    b2bAgentMarkupPercent: opts.markupPercent ?? 15,
    buyerMarkupPercent: opts.markupPercent ?? 15,
    taxPercent: opts.taxPercent ?? 0,
    serviceFeeFixed: opts.serviceFeeFixed ?? 0,
    pricingModel: 'PER_PERSON',
    validityFrom: '2026-01-01',
    validityTo: '2027-12-31',
    status: 'ACTIVE',
    inclusions: [`Included: ${opts.name}`],
    exclusions: ['Personal expenses']
  } as unknown as Product;
}

function makeItem(
  id: string,
  product: Product,
  travelDate: string,
  dayNumber: number,
  productLevelMarginEnabled = true,
  agentLevelMarginPercent = 10
): QuoteItem {
  const calculation = calculateProductPrice(product, {
    productId: product.id,
    pricingTier: 'B2B',
    userRole: 'ADMIN',
    adults: 1,
    children: 0,
    infants: 0,
    travelDate,
    targetCurrency: 'INR',
    selectedAddonIds: [],
    productLevelMarginEnabled,
    customAgentMarginPercent: agentLevelMarginPercent
  });
  return {
    id,
    product,
    travelDate,
    pax: { adults: 1, children: 0, infants: 0 },
    selectedAddonIds: [],
    calculation
  };
}

const INTERNAL_FORBIDDEN_KEYS = [
  'totalNetCost',
  'totalNettCost',
  'totalConvertedNettCost',
  'convertedTotalNetCost',
  'adminManualMarginType',
  'adminManualMarginValue',
  'adminManualMarginAmount',
  'adminMarginMode',
  'revisedSellingPrice',
  'manualMarginAdjustmentMode',
  'manualMarginAdjustmentType',
  'manualMarginAdjustmentValue',
  'manualMarginAdjustmentAmount',
  'existingBaseMarginAmount',
  'baseMarginTotal',
  'internalMarkup',
  'dmcMarginAmount',
  'productLevelMarginEnabled',
  'activeMarginMode',
  'agentLevelMarginPercent'
];

function findForbiddenKeys(obj: unknown, path = 'root'): string[] {
  const hits: string[] = [];
  if (!obj || typeof obj !== 'object') return hits;
  if (Array.isArray(obj)) {
    obj.forEach((entry, idx) => {
      hits.push(...findForbiddenKeys(entry, `${path}[${idx}]`));
    });
    return hits;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (INTERNAL_FORBIDDEN_KEYS.includes(k) && v !== undefined) {
      hits.push(`${path}.${k}`);
    }
    if (v && typeof v === 'object') {
      hits.push(...findForbiddenKeys(v, `${path}.${k}`));
    }
  }
  return hits;
}

async function runAudit() {
  console.log('================================================================================');
  console.log('  MANUAL MARGIN ADJUSTMENT — AUTHORITATIVE PRICING & OUTPUT SYNC AUDIT');
  console.log('================================================================================\n');

  const db = AppDatabase.getInstance();
  CurrencyEngine.getInstance().resetToBaselineRates();
  clearSurchargeEngineCache();

  const adminUser: User = {
    id: 'usr-admin-mma-audit',
    name: 'Global Admin Director',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  const agentUser: User = {
    id: 'usr-agent-mma-audit',
    name: 'Riya Kapoor',
    email: 'riya@meridiantravels.in',
    role: 'B2B_AGENT',
    agencyName: 'Meridian Bespoke Holidays',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  // Multi-category products summing to exactly ₹100,000 Total Nett Cost:
  // Hotel Inventory: ₹30,000 (15% markup -> ₹4,500)
  // Manual Hub Hotel: ₹15,000 net + ₹2,250 margin (15% -> ₹17,250)
  // Activity / Tour: ₹20,000 (15% markup -> ₹3,000)
  // Transfers: ₹10,000 (15% markup -> ₹1,500)
  // Rail: ₹12,000 (15% markup -> ₹1,800)
  // Guide: ₹8,000 (15% markup -> ₹1,200)
  // Visa & Ancillary: ₹5,000 (15% markup -> ₹750)
  // Combined Nett = 30k + 15k + 20k + 10k + 12k + 8k + 5k = ₹100,000
  // Combined Base Margin (15%) = ₹15,000 (12,750 items + 2,250 manual hotel) -> Base Selling = ₹115,000
  const prodHotel = makeProduct({
    id: 'mma-hotel-1',
    name: 'Park Hyatt Tokyo Deluxe',
    category: 'Hotels',
    productType: 'HOTEL',
    netINR: 30000,
    markupPercent: 15
  });
  const prodTour = makeProduct({
    id: 'mma-tour-1',
    name: 'Tokyo Private Cultural Discovery',
    category: 'Private Tours',
    productType: 'TOUR',
    netINR: 20000,
    markupPercent: 15
  });
  const prodTransfer = makeProduct({
    id: 'mma-trf-1',
    name: 'Haneda Private Alphard Transfer',
    category: 'Transfers',
    productType: 'TRANSFER',
    netINR: 10000,
    markupPercent: 15
  });
  const prodRail = makeProduct({
    id: 'mma-rail-1',
    name: 'Nozomi Shinkansen Green Car',
    category: 'Rail Services',
    productType: 'RAIL',
    netINR: 12000,
    markupPercent: 15
  });
  const prodGuide = {
    ...makeProduct({
      id: 'mma-guide-1',
      name: 'Full-Day Senior English Guide',
      category: 'Guides',
      productType: 'GUIDE',
      netINR: 8000,
      markupPercent: 15
    }),
    minHours: 1
  } as unknown as Product;
  const prodVisa = makeProduct({
    id: 'mma-visa-1',
    name: 'Japan Express eVisa Service',
    category: 'Visa & Ancillary Services',
    productType: 'VISA',
    netINR: 5000,
    markupPercent: 15
  });

  // Register products in DB so lookups work cleanly
  [prodHotel, prodTour, prodTransfer, prodRail, prodGuide, prodVisa].forEach(p => {
    try {
      db.saveProduct(p, adminUser);
    } catch {
      // ignore if test method differs
    }
  });

  // Add an active central surcharge on prodTour ONLY during test travel date 2026-12-20
  const peakSurcharge: SurchargeMaster = {
    id: 'surch-mma-peak-01',
    surchargeCode: 'SUR-MMA-PEAK',
    name: 'Year-End Gala Peak Supplement',
    surchargeCategory: 'EVENT_SURCHARGE',
    calculationType: 'FIXED',
    pricingBasis: 'PER_BOOKING',
    percentage: 0,
    amount: 2500,
    currency: 'INR',
    timezone: 'UTC',
    version: 1,
    status: 'ACTIVE',
    isActive: true,
    isDeleted: false,
    validFrom: '2026-12-15',
    validTo: '2026-12-28',
    linkedProductIds: [prodTour.id],
    allowStacking: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  } as unknown as SurchargeMaster;

  db.saveSurchargeMaster(peakSurcharge, adminUser);
  clearSurchargeEngineCache();

  const manualHotelItem: QuoteItem = {
    id: 'mma-it-manual-hotel',
    isManualHotel: true,
    hubId: 'hub-mma-kyoto',
    itineraryHubOccurrenceId: 'occ-mma-kyoto-1',
    travelDate: '2026-12-21',
    pax: { adults: 1, children: 0, infants: 0 },
    selectedAddonIds: [],
    product: {
      id: 'man-htl-kyoto-1',
      sku: 'MAN-HTL-KYOTO-1',
      name: 'Kyoto Ryokan Sanctuary',
      category: 'Hotels & Accommodation',
      productType: 'HOTEL',
      city: 'Kyoto',
      currency: 'INR',
      nativeCurrency: 'INR',
      isManualHotel: true,
      status: 'ACTIVE'
    } as any,
    manualHotelDetails: {
      hotelName: 'Kyoto Ryokan Sanctuary',
      starRating: '5 Star',
      roomType: 'Tatami Suite',
      mealPlan: 'Breakfast & Kaiseki',
      rateBasis: 'TOTAL_STAY',
      ratePerNight: 15000,
      rateCurrency: 'INR',
      numberOfRooms: 1,
      numberOfNights: 1,
      totalNetCost: 15000,
      totalSellingPrice: 17250,
      currency: 'INR',
      hubId: 'hub-mma-kyoto'
    } as any,
    calculation: {
      nativeTotalNetCost: 15000,
      nativeCurrency: 'INR',
      totalNetCost: 15000,
      currency: 'INR',
      markupAmount: 2250,
      taxAmount: 0,
      serviceFee: 0,
      surchargeTotal: 0,
      finalTotalSellingPrice: 17250,
      activeMarginMode: 'PRODUCT_LEVEL'
    } as any
  };

  const itemsProdOn: QuoteItem[] = [
    makeItem('mma-it-hotel', prodHotel, '2026-12-19', 1, true, 10),
    manualHotelItem,
    makeItem('mma-it-tour', prodTour, '2026-12-20', 2, true, 10),
    makeItem('mma-it-trf', prodTransfer, '2026-12-19', 1, true, 10),
    makeItem('mma-it-rail', prodRail, '2026-12-21', 3, true, 10),
    makeItem('mma-it-guide', prodGuide, '2026-12-20', 2, true, 10),
    makeItem('mma-it-visa', prodVisa, '2026-12-19', 1, true, 10)
  ];

  const manualHubRoute = [
    {
      id: 'hub-mma-tokyo',
      itineraryHubOccurrenceId: 'occ-mma-tokyo-1',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo',
      nights: 2,
      order: 1
    },
    {
      id: 'hub-mma-kyoto',
      itineraryHubOccurrenceId: 'occ-mma-kyoto-1',
      hubId: 'hub-kyoto',
      hubName: 'Kyoto',
      nights: 1,
      order: 2,
      manualHotel: {
        hotelName: 'Kyoto Ryokan Sanctuary',
        starRating: '5 Star',
        roomType: 'Tatami Suite',
        mealPlan: 'Breakfast & Kaiseki',
        ratePerNight: 15000,
        rateCurrency: 'INR',
        numberOfRooms: 1,
        numberOfNights: 1,
        totalNetCost: 15000,
        totalSellingPrice: 17250,
        currency: 'INR'
      } as any
    }
  ];

  // Expected authoritative base figures (with ₹2,500 active surcharge on Tour):
  // Total Nett Cost = 85,000 (inventory) + 15,000 (manual hub hotel) = ₹100,000
  // Existing Base Margin = 12,750 (inventory 15%) + 2,250 (manual hub hotel 15%) = ₹15,000
  // Active Surcharges = ₹2,500
  // Base Selling Price before manual margin = 100,000 + 15,000 + 2,500 = ₹117,500

  console.log('--- 1. Consolidated Total Nett Cost & Validation Rules ---');
  const negCheck = validateAdminManualMargin(-5, 'PERCENTAGE');
  const nanCheck = validateAdminManualMargin('abc', 'FIXED');
  const infCheck = validateAdminManualMargin(Infinity, 'PERCENTAGE');
  const validPctCheck = validateAdminManualMargin(5, 'PERCENTAGE');

  assert(
    !negCheck.isValid && negCheck.sanitizedValue === 0 && Boolean(negCheck.errorMessage),
    'Negative manual margin (-5%) is explicitly rejected with validation error',
    negCheck
  );
  assert(
    !nanCheck.isValid && nanCheck.sanitizedValue === 0 && Boolean(nanCheck.errorMessage),
    'NaN/non-numeric manual margin is explicitly rejected',
    nanCheck
  );
  assert(
    !infCheck.isValid && infCheck.sanitizedValue === 0 && Boolean(infCheck.errorMessage),
    'Infinity manual margin is explicitly rejected',
    infCheck
  );
  assert(
    validPctCheck.isValid && validPctCheck.sanitizedValue === 5 && !validPctCheck.errorMessage,
    'Valid positive manual margin passes validation cleanly',
    validPctCheck
  );

  // Verify ADD Mode (Default when adminMarginMode omitted) with 5% Manual Margin + 10% Agent Markup
  // Total Nett = ₹100,000
  // Existing Base Margin = ₹15,000
  // Manual Margin (5% on ₹100,000 Nett) = ₹5,000
  // Surcharges = ₹2,500
  // Stage 1 Revised Selling Price (B2B Base) = 100,000 + 15,000 + 5,000 + 2,500 = ₹122,500
  // Stage 2 Agent Markup (10% of ₹122,500) = ₹12,250
  // Final Customer Selling Price (ADD) = ₹134,750
  const breakdownAddDefault = calculateQuoteInternalBreakdown({
    items: itemsProdOn,
    routeHubs: manualHubRoute as any,
    targetCurrency: 'INR',
    productLevelMarginEnabled: true,
    customAgentMarginPercent: 10,
    adminManualMarginType: 'PERCENTAGE',
    adminManualMarginValue: 5,
    // adminMarginMode omitted -> MUST default to 'ADD'
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 10
  });

  assert(
    breakdownAddDefault.totalNettCost === 100000,
    'Consolidated Total Nett Cost sums Hotels + Manual Hotel + Tour + Transfer + Rail + Guide + Visa = ₹100,000',
    { received: breakdownAddDefault.totalNettCost }
  );
  assert(
    breakdownAddDefault.existingMarginAmount === 15000,
    'Existing Base Margin equals ₹15,000 across inventory items + manual hub hotel',
    { received: breakdownAddDefault.existingMarginAmount }
  );
  assert(
    breakdownAddDefault.surchargesTotal === 2500,
    'Central Surcharges Total preserves ₹2,500 active surcharge',
    { received: breakdownAddDefault.surchargesTotal }
  );
  assert(
    breakdownAddDefault.adminManualMarginAmount === 5000 &&
      breakdownAddDefault.revisedSellingPrice === 122500 &&
      breakdownAddDefault.adminFinalTotal === 122500 &&
      breakdownAddDefault.partnerMarginAmount === 12250 &&
      breakdownAddDefault.finalPackagePrice === 134750,
    'ADD Mode (Default): Nett(₹100k) + Base(₹15k) + Manual 5%(₹5k) + Surcharge(₹2.5k) = Stage1 ₹122,500 -> +10% Agent(₹12,250) = ₹134,750',
    breakdownAddDefault
  );

  // Verify Mutual Exclusivity: Product-Level Margin OFF -> Agent-Level Margin 10% (₹10,000 base), Product-Level = 0
  // Total Nett = ₹100,000, Agent-Level Base Margin = ₹10,000 (inventory 8,500) + manual hotel 2,250 = ₹10,750
  const itemsProdOff: QuoteItem[] = [
    makeItem('mma-off-hotel', prodHotel, '2026-12-19', 1, false, 10),
    manualHotelItem,
    makeItem('mma-off-tour', prodTour, '2026-12-20', 2, false, 10),
    makeItem('mma-off-trf', prodTransfer, '2026-12-19', 1, false, 10),
    makeItem('mma-off-rail', prodRail, '2026-12-21', 3, false, 10),
    makeItem('mma-off-guide', prodGuide, '2026-12-20', 2, false, 10),
    makeItem('mma-off-visa', prodVisa, '2026-12-19', 1, false, 10)
  ];
  const breakdownAgentLevelMode = calculateQuoteInternalBreakdown({
    items: itemsProdOff,
    routeHubs: manualHubRoute as any,
    targetCurrency: 'INR',
    productLevelMarginEnabled: false,
    customAgentMarginPercent: 10,
    adminManualMarginType: 'FIXED',
    adminManualMarginValue: 3000,
    adminMarginMode: 'ADD',
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0
  });
  assert(
    breakdownAgentLevelMode.activeMarginMode === 'AGENT_LEVEL' &&
      breakdownAgentLevelMode.existingMarginAmount === 10750 &&
      breakdownAgentLevelMode.adminManualMarginAmount === 3000 &&
      breakdownAgentLevelMode.revisedSellingPrice === 116250,
    'ADD Mode with Product-Level Margin OFF preserves Agent-Level Margin (₹10,750) + Fixed Manual Margin (₹3,000) + Surcharge (₹2,500) = ₹116,250',
    breakdownAgentLevelMode
  );

  console.log('\n--- 2. REPLACE Mode & Fixed/0% Override With Preserved Surcharges ---');
  // In REPLACE mode with 20% manual margin:
  // Base margin (₹15,000) is REPLACED with 20% of ₹100,000 Nett = ₹20,000
  // Surcharges (₹2,500) MUST remain preserved!
  // Stage 1 = 100,000 + 20,000 + 2,500 = ₹122,500
  // WAIT: Let's use 25% REPLACE so ADD (₹134,750) vs REPLACE produces a distinct number!
  // With 25% REPLACE:
  // Manual Margin = 25% of ₹100,000 = ₹25,000
  // Stage 1 = 100,000 + 25,000 + 2,500 = ₹127,500
  // Stage 2 Agent Markup (10% of ₹127,500) = ₹12,750
  // Final Customer Selling Price (REPLACE) = ₹140,250
  const breakdownReplace25 = calculateQuoteInternalBreakdown({
    items: itemsProdOn,
    routeHubs: manualHubRoute as any,
    targetCurrency: 'INR',
    productLevelMarginEnabled: true,
    customAgentMarginPercent: 10,
    adminManualMarginType: 'PERCENTAGE',
    adminManualMarginValue: 25,
    adminMarginMode: 'REPLACE',
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 10
  });
  assert(
    breakdownReplace25.totalNettCost === 100000 &&
      breakdownReplace25.adminManualMarginAmount === 25000 &&
      breakdownReplace25.surchargesTotal === 2500 &&
      breakdownReplace25.revisedSellingPrice === 127500 &&
      breakdownReplace25.adminFinalTotal === 127500 &&
      breakdownReplace25.partnerMarginAmount === 12750 &&
      breakdownReplace25.finalPackagePrice === 140250,
    'REPLACE Mode (25%): Replaces Base Margin -> Nett(₹100k) + Manual 25%(₹25k) + Surcharge(₹2.5k) = Stage1 ₹127,500 -> +10% Agent(₹12,750) = ₹140,250',
    breakdownReplace25
  );

  // REPLACE with 0% still retains ₹2,500 surcharge cleanly
  const breakdownReplaceZero = calculateQuoteInternalBreakdown({
    items: itemsProdOn,
    routeHubs: manualHubRoute as any,
    targetCurrency: 'INR',
    productLevelMarginEnabled: true,
    adminManualMarginType: 'PERCENTAGE',
    adminManualMarginValue: 0,
    adminMarginMode: 'REPLACE',
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0
  });
  assert(
    breakdownReplaceZero.adminManualMarginAmount === 0 &&
      breakdownReplaceZero.revisedSellingPrice === 102500 &&
      breakdownReplaceZero.finalPackagePrice === 102500,
    'REPLACE Mode (0%): Passes Nett(₹100,000) + Surcharge(₹2,500) = ₹102,500 without dropping surcharges',
    breakdownReplaceZero
  );

  console.log('\n--- 3. Stale Snapshot Invalidation, Mode Toggle, Audit Logging & Save-Draft-Only Versioning ---');
  // Build an unlocked quote saved under ADD (₹134,750) WITH snapshots attached
  const addSnapshot = buildQuotationCurrencySnapshot({
    quoteId: 'qte-mma-parity-01',
    quoteVersion: 1,
    items: itemsProdOn,
    routeHubs: manualHubRoute as any,
    targetCurrency: 'INR',
    userRole: 'ADMIN',
    productLevelMarginEnabled: true,
    customAgentMarginPercent: 10,
    adminManualMarginType: 'PERCENTAGE',
    adminManualMarginValue: 5,
    adminMarginMode: 'ADD',
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 10
  });

  const baseQuoteAdd: Quotation = {
    id: 'qte-mma-parity-01',
    quoteNumber: 'QTE-MMA-01',
    version: 1,
    latestVersion: 1,
    title: 'Comprehensive Japan Bespoke Luxury Proposal',
    destination: 'Japan',
    currency: 'INR',
    travelStartDate: '2026-12-19',
    travelEndDate: '2026-12-22',
    adultsCount: 1,
    childrenCount: 0,
    infantsCount: 0,
    routeHubs: manualHubRoute as any,
    items: itemsProdOn,
    overallDiscountPercent: 0,
    agentNotes: 'Bespoke VIP arrangements and private transfers.',
    termsAndConditions: 'Standard commercial terms.',
    status: 'DRAFT',
    isLocked: false,
    validUntil: '2026-12-31',
    adminManualMarginType: 'PERCENTAGE',
    adminManualMarginValue: 5,
    adminManualMarginAmount: 5000,
    adminMarginMode: 'ADD',
    revisedSellingPrice: 122500,
    baseFinalSellingPrice: 122500,
    theUnboundBaseSellingPrice: 122500,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 10,
    agentMarginAmount: 12250,
    finalCustomerSellingPrice: 134750,
    totalSellingPrice: 134750,
    totalNetCost: 100000,
    totalTaxes: 0,
    totalMargin: 32250,
    currencyConversionSnapshot: addSnapshot,
    agentId: agentUser.id,
    agentName: agentUser.name,
    agentAgency: agentUser.agencyName,
    clientName: 'Vikram Singhania',
    clientEmail: 'vikram@singhania.in',
    clientPhone: '+919811122334',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z'
  };

  // Explicit Save Draft creates v1
  const saveV1Res = await db.saveQuotationExplicitVersionAsync({
    quote: baseQuoteAdd,
    user: adminUser,
    clientSaveRequestId: 'req-mma-save-v1',
    changesSummary: 'Initial ADD mode save'
  });
  const versionsAfterV1 = db.getQuotationVersions(baseQuoteAdd.id, adminUser);
  assert(
    saveV1Res.versionNumber === 1 && versionsAfterV1.length === 1,
    'Explicit Save Draft created v1 (and v1 only)',
    { versionNumber: saveV1Res.versionNumber, count: versionsAfterV1.length }
  );

  // Switch working unlocked quote to REPLACE 25% WHILE STILL HOLDING old ADD snapshots -> must recalculate ₹140,250 & NOT create v2!
  const editedWorkingQuoteReplace: Quotation = {
    ...saveV1Res.quote,
    isLocked: false,
    adminMarginMode: 'REPLACE',
    adminManualMarginType: 'PERCENTAGE',
    adminManualMarginValue: 25
  };

  // Log audit event on mode/margin change (must NOT bump version!)
  const preAuditLogCount = db.getAuditLogs().length;
  db.logAudit(
    adminUser,
    'MARGIN_CHANGED',
    'Quotation',
    editedWorkingQuoteReplace.id,
    'Manual Margin updated to REPLACE 25%',
    'ADD 5%',
    'REPLACE 25%'
  );
  const postAuditLogs = db.getAuditLogs();
  const marginAuditEntry = postAuditLogs.find(l => l.action === 'MARGIN_CHANGED' && l.entityId === editedWorkingQuoteReplace.id);
  assert(
    postAuditLogs.length > preAuditLogCount && Boolean(marginAuditEntry),
    'MARGIN_CHANGED audit log recorded without creating a quotation version'
  );

  const calcSwitchedReplace = calculateQuoteTotal(editedWorkingQuoteReplace, undefined, undefined, 'INR');
  const versionsBeforeExplicitV2 = db.getQuotationVersions(baseQuoteAdd.id, adminUser);
  assert(
    calcSwitchedReplace.theUnboundBaseSellingPrice === 127500 &&
      calcSwitchedReplace.markupAmount === 12750 &&
      calcSwitchedReplace.finalCustomerSellingPrice === 140250 &&
      versionsBeforeExplicitV2.length === 1,
    'Unlocked draft mode switch ADD -> REPLACE ignores stale v1 snapshot, produces ₹140,250, and stays at v1 until Save Draft',
    { calcSwitchedReplace, versionCount: versionsBeforeExplicitV2.length }
  );

  // Preview/Email/WhatsApp snapshot sync without Save Draft stays at v1 while outputting ₹140,250
  const syncResReplace = await prepareAndPersistAuthoritativeSnapshot({
    db,
    quote: editedWorkingQuoteReplace,
    user: adminUser,
    outputOption: 'PREVIEW_PROPOSAL',
    actionType: 'PRICING_UPDATED'
  });
  const versionsAfterSync = db.getQuotationVersions(baseQuoteAdd.id, adminUser);
  assert(
    syncResReplace.success &&
      syncResReplace.snapshot.pricing.finalCustomerSellingPrice === 140250 &&
      versionsAfterSync.length === 1,
    'Output synchronization updates live quote to REPLACE ₹140,250 without creating auto-version',
    {
      success: syncResReplace.success,
      mismatches: syncResReplace.consistencyReport?.mismatches,
      final: syncResReplace.snapshot.pricing.finalCustomerSellingPrice,
      count: versionsAfterSync.length
    }
  );

  // Explicit Save Draft creates v2 (split document architecture) under REPLACE mode
  const saveV2Res = await db.saveQuotationExplicitVersionAsync({
    quote: syncResReplace.quote,
    user: adminUser,
    clientSaveRequestId: 'req-mma-save-v2',
    changesSummary: 'Updated Manual Margin to REPLACE 25%'
  });
  assert(
    saveV2Res.versionNumber === 2 &&
      saveV2Res.versionRecord.adminMarginMode === 'REPLACE' &&
      saveV2Res.versionRecord.adminManualMarginValue === 25 &&
      saveV2Res.versionRecord.adminManualMarginAmount === 25000 &&
      saveV2Res.versionRecord.revisedSellingPrice === 127500 &&
      saveV2Res.versionRecord.finalCustomerSellingPrice === 140250,
    'Explicit Save Draft creates v2 preserving REPLACE manual margin fields & authoritative ₹140,250',
    {
      version: saveV2Res.versionNumber,
      mode: saveV2Res.versionRecord.adminMarginMode,
      val: saveV2Res.versionRecord.adminManualMarginValue,
      final: saveV2Res.versionRecord.finalCustomerSellingPrice
    }
  );

  console.log('\n--- 4. Split-Document Load & Restore Round-Trip + Role-Aware Field Redaction ---');
  const loadedAdminV2 = await db.loadQuotationVersionFullAsync(baseQuoteAdd.id, 2, adminUser, { bypassCache: true });
  const loadedAgentV2 = await db.loadQuotationVersionFullAsync(baseQuoteAdd.id, 2, agentUser, { bypassCache: true });
  const restoredAdminV1 = await db.prepareRestoredWorkingQuoteAsync(baseQuoteAdd.id, 1, adminUser);
  const restoredAgentV1 = await db.prepareRestoredWorkingQuoteAsync(baseQuoteAdd.id, 1, agentUser);

  assert(
    Boolean(loadedAdminV2) &&
      loadedAdminV2?.adminMarginMode === 'REPLACE' &&
      loadedAdminV2?.adminManualMarginValue === 25 &&
      loadedAdminV2?.finalCustomerSellingPrice === 140250,
    'Admin loadQuotationVersionFullAsync(v2) recovers full internal manual margin configuration & ₹140,250'
  );
  const agentV2Leaks = findForbiddenKeys(loadedAgentV2, 'loadedAgentV2');
  assert(
    Boolean(loadedAgentV2) &&
      loadedAgentV2?.finalCustomerSellingPrice === 140250 &&
      agentV2Leaks.length === 0,
    'Agent loadQuotationVersionFullAsync(v2) sees ₹140,250 with ZERO internal cost/manual-margin keys leaked',
    agentV2Leaks
  );
  assert(
    Boolean(restoredAdminV1) &&
      restoredAdminV1?.adminMarginMode === 'ADD' &&
      restoredAdminV1?.adminManualMarginValue === 5 &&
      restoredAdminV1?.finalCustomerSellingPrice === 134750,
    'Admin prepareRestoredWorkingQuoteAsync(v1) restores ADD 5% & ₹134,750 into unsaved draft'
  );
  const agentV1Leaks = findForbiddenKeys(restoredAgentV1, 'restoredAgentV1');
  assert(
    Boolean(restoredAgentV1) &&
      restoredAgentV1?.finalCustomerSellingPrice === 134750 &&
      agentV1Leaks.length === 0,
    'Agent prepareRestoredWorkingQuoteAsync(v1) restores ₹134,750 with ZERO internal cost/manual-margin keys leaked',
    agentV1Leaks
  );
  assert(
    db.getQuotationVersions(baseQuoteAdd.id, adminUser).length === 2,
    'Restoring v1 into draft did NOT create a v3 version (remains strictly v2 until Save Draft)'
  );

  // Security sanitization checks across sanitizers & db.saveQuote
  const sanitizedAgent = sanitizeQuoteForAgent(saveV2Res.quote);
  const sanitizedVersion = sanitizeQuoteVersionForAgent(saveV2Res.versionRecord);
  const sanitizedCustDoc = sanitizeQuoteDocumentForCustomer(saveV2Res.quote);
  const savedByAgent = db.saveQuote(saveV2Res.quote, agentUser, 'EDITED');

  const leakSummary = [
    ...findForbiddenKeys(sanitizedAgent, 'sanitizedAgent'),
    ...findForbiddenKeys(sanitizedVersion, 'sanitizedVersion'),
    ...findForbiddenKeys(sanitizedCustDoc, 'sanitizedCustDoc'),
    ...findForbiddenKeys(savedByAgent, 'savedByAgent')
  ];
  assert(
    leakSummary.length === 0 &&
      sanitizedAgent.finalCustomerSellingPrice === 140250 &&
      sanitizedCustDoc.totalSellingPrice === 140250 &&
      savedByAgent.finalCustomerSellingPrice === 140250,
    'Zero internal fields (totalNetCost, base margin, adminManualMargin*, revisedSellingPrice) exposed to B2B Agent or Customer',
    leakSummary
  );

  console.log('\n--- 5. End-to-End Cross-Channel Output Verification (ADD vs REPLACE) ---');
  async function verifyAllOutputsForMode(quote: Quotation, expectedFinal: number, modeLabel: string) {
    const formattedExpected = formatCurrency(expectedFinal, 'INR');
    const engineTotals = calculateQuoteTotal(quote, undefined, undefined, 'INR');
    const previewModel = buildQuotePresentationModel(quote);
    const pdfPages = paginateQuotePresentationModel(previewModel);
    const pdfFullText = pdfPages.map(p => p.blocks.map(b => b.html).join('\n')).join('\n');
    const emailOutput = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(quote);
    const emailModelOut = renderQuoteEmailFromPresentationModel(previewModel);
    const waSvcMsg = generateWhatsAppQuoteMessage({ quote });
    const waModelMsg = renderQuoteWhatsAppFromPresentationModel(previewModel);
    const waSanitizedCust = sanitizeQuoteForCustomer(quote);

    // Lead / Saved Quote verification (when checking latest saved quote ID)
    const leadLookupQuote = db.getQuoteByIdAuthorized(quote.id, agentUser);
    const matchesSavedMaster =
      modeLabel === 'ADD'
        ? true
        : Boolean(leadLookupQuote && leadLookupQuote.finalCustomerSellingPrice === expectedFinal);

    // Booking conversion verification (using distinct clone IDs so both modes convert independently)
    const bookingInput: Quotation = {
      ...quote,
      id: `${quote.id}-${modeLabel.toLowerCase()}`,
      quoteNumber: `${quote.quoteNumber}-${modeLabel.toUpperCase()}`,
      clientName: `${quote.clientName} (${modeLabel} Convert)`,
      bookingId: undefined
    };
    const savedForBooking = db.saveQuote(bookingInput, adminUser, 'SENT');
    const convertedBooking = db.convertQuotationToBooking(savedForBooking, adminUser);
    const bookingInputSubmit: Quotation = {
      ...bookingInput,
      id: `${quote.id}-${modeLabel.toLowerCase()}-sub`,
      quoteNumber: `${quote.quoteNumber}-${modeLabel.toUpperCase()}-SUB`,
      clientName: `${quote.clientName} (${modeLabel} Submit)`,
      bookingId: undefined
    };
    db.saveQuote(bookingInputSubmit, adminUser, 'SENT');
    const submittedBooking = db.submitBookingFromQuote(bookingInputSubmit.id, adminUser);

    const allMatch =
      engineTotals.finalCustomerSellingPrice === expectedFinal &&
      previewModel.finalCustomerSellingPriceNumeric === expectedFinal &&
      previewModel.finalCustomerSellingPriceFormatted === formattedExpected &&
      pdfFullText.includes(formattedExpected) &&
      emailOutput.htmlBody.includes(formattedExpected) &&
      emailOutput.textBody.includes(formattedExpected) &&
      emailModelOut.htmlBody.includes(formattedExpected) &&
      waSvcMsg.includes(formattedExpected) &&
      waModelMsg.includes(formattedExpected) &&
      waSanitizedCust.formattedSellingPrice === formattedExpected &&
      (convertedBooking?.totalAmount || 0) === expectedFinal &&
      submittedBooking.totalAmount === expectedFinal &&
      matchesSavedMaster;

    // Ensure internal Nett Cost (100,000) and internal margin figures do NOT appear in customer outputs
    const leakedToCustomer =
      pdfFullText.includes('100,000') ||
      emailOutput.htmlBody.includes('100,000') ||
      waSvcMsg.includes('100,000') ||
      emailOutput.textBody.toLowerCase().includes('total nett') ||
      waSvcMsg.toLowerCase().includes('manual margin');

    assert(
      allMatch && !leakedToCustomer,
      `[${modeLabel}] 100% Parity (${formattedExpected}) across Engine, Preview, PDF, Email, WhatsApp, and Booking with ZERO Nett/Margin leak`,
      {
        engine: engineTotals.finalCustomerSellingPrice,
        preview: previewModel.finalCustomerSellingPriceFormatted,
        pdfHasPrice: pdfFullText.includes(formattedExpected),
        emailHasPrice: emailOutput.htmlBody.includes(formattedExpected),
        waHasPrice: waSvcMsg.includes(formattedExpected),
        convertedBooking: convertedBooking?.totalAmount,
        submittedBooking: submittedBooking.totalAmount,
        leakedToCustomer
      }
    );

    return {
      mode: modeLabel,
      nett: 100000,
      baseMargin: quote.adminMarginMode === 'REPLACE' ? 0 : 15000,
      manualMargin: quote.adminManualMarginAmount || 0,
      surcharges: 2500,
      stage1: engineTotals.theUnboundBaseSellingPrice,
      agentMarkup: engineTotals.markupAmount,
      preview: previewModel.finalCustomerSellingPriceFormatted,
      pdf: pdfFullText.includes(formattedExpected) ? formattedExpected : 'MISMATCH',
      email: emailOutput.htmlBody.includes(formattedExpected) ? formattedExpected : 'MISMATCH',
      whatsapp: waSvcMsg.includes(formattedExpected) ? formattedExpected : 'MISMATCH',
      booking: formatCurrency(submittedBooking.totalAmount, 'INR')
    };
  }

  const loadedAddV1 = (await db.loadQuotationVersionFullAsync(baseQuoteAdd.id, 1, adminUser, { bypassCache: true }))!;
  const addQuoteForParity: Quotation = {
    ...saveV1Res.quote,
    items: loadedAddV1.items || saveV1Res.quote.items,
    routeHubs: loadedAddV1.routeHubs || saveV1Res.quote.routeHubs,
    adminMarginMode: 'ADD',
    adminManualMarginType: 'PERCENTAGE',
    adminManualMarginValue: 5,
    adminManualMarginAmount: 5000,
    finalCustomerSellingPrice: 134750
  };
  const addRow = await verifyAllOutputsForMode(addQuoteForParity, 134750, 'ADD');
  const replaceRow = await verifyAllOutputsForMode(saveV2Res.quote, 140250, 'REPLACE');

  console.log('\n--- 6. Verified ADD vs REPLACE Comparison Summary ---');
  console.table([addRow, replaceRow]);

  // =========================================================================
  // 7. Admin Editing B2B Agent Quote (AGENT_LEVEL 12% Agency vs Admin PRODUCT_LEVEL ON)
  // Reproduces QTE-MW6K5WPA / QTE-2026-9301 class bug:
  // Admin editing an Agent's quote must preserve the Agent's agency context &
  // NEVER let Admin's PRODUCT_LEVEL setting override AGENT_LEVEL 12%, nor let
  // REPLACE | FIXED 24000 -> 24500 jump by more than exact +500!
  // =========================================================================
  console.log('\n--- 7. Admin Editing B2B Agent Quote (Agency Context Isolation & +500 REPLACE Step) ---');
  const agentCompanyId = 'cmp-mma-agent-12pct';
  db.saveCompany(
    {
      id: agentCompanyId,
      name: 'Sakura Elite Travel Partners',
      legalName: 'Sakura Elite Travel Partners Pvt Ltd',
      type: 'B2B_AGENCY',
      status: 'ACTIVE',
      linkedUserIds: ['usr-agent-sakura-12'],
      pricingSettings: {
        productLevelMarginEnabled: false,
        activeMarginMode: 'AGENT_LEVEL',
        agentLevelMarginPercent: 12,
        lastUpdatedBy: adminUser.id,
        lastUpdatedByName: adminUser.name,
        lastUpdatedAt: '2026-01-01T00:00:00.000Z'
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    } as any,
    adminUser
  );
  const sakuraAgentUser: User = {
    id: 'usr-agent-sakura-12',
    name: 'Arjun Mehta',
    email: 'arjun@sakuraelite.in',
    role: 'B2B_AGENT',
    companyId: agentCompanyId,
    agencyName: 'Sakura Elite Travel Partners',
    companyName: 'Sakura Elite Travel Partners',
    approvalStatus: 'APPROVED',
    customAgentMarginPercent: 12,
    pricingSettings: {
      productLevelMarginEnabled: false,
      activeMarginMode: 'AGENT_LEVEL',
      agentLevelMarginPercent: 12,
      lastUpdatedBy: adminUser.id,
      lastUpdatedByName: adminUser.name,
      lastUpdatedAt: '2026-01-01T00:00:00.000Z'
    },
    createdAt: '2026-01-01T00:00:00.000Z'
  };
  db.saveUser(sakuraAgentUser, adminUser);

  // Admin has PRODUCT_LEVEL = ON on own company/profile, while Sakura Agent has AGENT_LEVEL = 12%
  const adminWithOwnCompany: User = {
    ...adminUser,
    companyId: 'cmp-admin-own-prod-on',
    agencyName: 'TheUnbound Internal HQ',
    pricingSettings: {
      productLevelMarginEnabled: true,
      activeMarginMode: 'PRODUCT_LEVEL',
      agentLevelMarginPercent: 10,
      lastUpdatedBy: adminUser.id,
      lastUpdatedByName: adminUser.name,
      lastUpdatedAt: '2026-01-01T00:00:00.000Z'
    }
  };

  // Items: ₹100,000 inventory Nett (products have 25% default product markup, but Sakura uses AGENT_LEVEL 12%)
  const highProdHotel = makeProduct({
    id: 'mma-sakura-hotel',
    name: 'Aman Tokyo Pavilion',
    category: 'Hotels',
    productType: 'HOTEL',
    netINR: 60000,
    markupPercent: 25
  });
  const highProdTour = makeProduct({
    id: 'mma-sakura-tour',
    name: 'Private Mt Fuji Helicopter Tour',
    category: 'Private Tours',
    productType: 'TOUR',
    netINR: 40000,
    markupPercent: 25
  });
  // Intentionally pre-compute item.calculation under PRODUCT_LEVEL ON (wrong/stale relative to Sakura's AGENT_LEVEL 12%)
  const staleItemsForSakuraQuote: QuoteItem[] = [
    makeItem('sak-it-1', highProdHotel, '2026-10-10', 1, true, 12),
    makeItem('sak-it-2', highProdTour, '2026-10-11', 2, true, 12)
  ];

  const sakuraBaseQuote: Quotation = {
    id: 'qte-sakura-agency-isolation',
    quoteNumber: 'QTE-SAK-9301',
    version: 3,
    latestVersion: 3,
    title: 'Sakura Agency Isolation Audit Proposal',
    destination: 'Japan',
    currency: 'INR',
    travelStartDate: '2026-10-10',
    travelEndDate: '2026-10-12',
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    items: staleItemsForSakuraQuote,
    overallDiscountPercent: 0,
    agentNotes: '',
    termsAndConditions: 'Standard commercial terms.',
    totalNetCost: 100000,
    totalSellingPrice: 124000,
    totalMargin: 24000,
    totalTaxes: 0,
    status: 'DRAFT',
    isLocked: false,
    validUntil: '2026-12-31',
    companyId: agentCompanyId,
    agentId: sakuraAgentUser.id,
    agentName: sakuraAgentUser.name,
    agentAgency: sakuraAgentUser.agencyName,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    adminMarginMode: 'REPLACE',
    adminManualMarginType: 'FIXED',
    adminManualMarginValue: 24000,
    clientName: 'Rohan Malhotra',
    clientEmail: 'rohan@malhotra.in',
    clientPhone: '+919820011223',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z'
  };

  // Resolve agency context passing Admin as fallback user — MUST keep Sakura's AGENT_LEVEL 12%!
  const resolvedAgencyCtx = resolveQuoteAgencyPricingContext(sakuraBaseQuote, adminWithOwnCompany);
  assert(
    resolvedAgencyCtx.productLevelMarginEnabled === false &&
      resolvedAgencyCtx.activeMarginMode === 'AGENT_LEVEL' &&
      resolvedAgencyCtx.agentLevelMarginPercent === 12,
    'resolveQuoteAgencyPricingContext preserves Agent agency settings (AGENT_LEVEL 12%) even when Admin is logged in',
    resolvedAgencyCtx
  );

  // In REPLACE FIXED 24,000 (0% Agent additional markup, Nett = 100,000): Stage 1 = 124,000
  const sakuraV3Calc = calculateQuoteTotal(sakuraBaseQuote, undefined, undefined, 'INR');
  const sakuraV3Breakdown = calculateQuoteInternalBreakdown({
    items: staleItemsForSakuraQuote,
    targetCurrency: 'INR',
    companyId: agentCompanyId,
    agencyName: sakuraAgentUser.agencyName,
    user: adminWithOwnCompany,
    adminMarginMode: 'REPLACE',
    adminManualMarginType: 'FIXED',
    adminManualMarginValue: 24000,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0
  });
  const sakuraV3Snap = buildAuthoritativeQuotationSnapshot(sakuraBaseQuote, { user: adminWithOwnCompany });

  // Now Admin increases FIXED manual margin by +500 (24,000 -> 24,500) -> MUST increase total by EXACTLY +500 (124,000 -> 124,500)!
  const sakuraV4Edited: Quotation = {
    ...sakuraBaseQuote,
    adminManualMarginValue: 24500
  };
  const sakuraV4Calc = calculateQuoteTotal(sakuraV4Edited, undefined, undefined, 'INR');
  const sakuraV4Breakdown = calculateQuoteInternalBreakdown({
    items: staleItemsForSakuraQuote,
    targetCurrency: 'INR',
    companyId: agentCompanyId,
    agencyName: sakuraAgentUser.agencyName,
    user: adminWithOwnCompany,
    adminMarginMode: 'REPLACE',
    adminManualMarginType: 'FIXED',
    adminManualMarginValue: 24500,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0
  });
  const sakuraV4Snap = buildAuthoritativeQuotationSnapshot(sakuraV4Edited, { user: adminWithOwnCompany });
  const sakuraV4Saved = db.saveQuote(sakuraV4Edited, adminWithOwnCompany, 'EDITED');
  const sakuraV4Model = buildQuotePresentationModel(sakuraV4Saved);
  const sakuraV4Pdf = paginateQuotePresentationModel(sakuraV4Model).map(p => p.blocks.map(b => b.html).join('\n')).join('\n');
  const sakuraV4Email = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(sakuraV4Saved);
  const sakuraV4Wa = generateWhatsAppQuoteMessage({ quote: sakuraV4Saved });
  const sakuraV4Booking = db.convertQuotationToBooking(
    { ...sakuraV4Saved, id: 'qte-sakura-bkg-check', quoteNumber: 'QTE-SAK-BKG', bookingId: undefined },
    adminWithOwnCompany
  );

  // Also test ADD mode on the same quote so stale PRODUCT_LEVEL(25%) item calc MUST be invalidated to AGENT_LEVEL(12%)!
  const sakuraAddEdited: Quotation = {
    ...sakuraBaseQuote,
    adminMarginMode: 'ADD',
    adminManualMarginType: 'FIXED',
    adminManualMarginValue: 0
  };
  const sakuraAddCalc = calculateQuoteTotal(sakuraAddEdited, undefined, undefined, 'INR');
  const sakuraAddBreakdown = calculateQuoteInternalBreakdown({
    items: staleItemsForSakuraQuote,
    targetCurrency: 'INR',
    companyId: agentCompanyId,
    agencyName: sakuraAgentUser.agencyName,
    user: adminWithOwnCompany,
    adminMarginMode: 'ADD',
    adminManualMarginType: 'FIXED',
    adminManualMarginValue: 0,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0
  });

  assert(
    sakuraV3Calc.finalCustomerSellingPrice === 124000 &&
      sakuraV3Breakdown.finalPackagePrice === 124000 &&
      sakuraV3Snap.pricing.finalCustomerSellingPrice === 124000 &&
      sakuraV4Calc.finalCustomerSellingPrice === 124500 &&
      sakuraV4Breakdown.finalPackagePrice === 124500 &&
      sakuraV4Snap.pricing.finalCustomerSellingPrice === 124500 &&
      sakuraV4Model.finalCustomerSellingPriceNumeric === 124500 &&
      sakuraV4Pdf.includes('124,500') &&
      sakuraV4Email.htmlBody.includes('124,500') &&
      sakuraV4Wa.includes('124,500') &&
      sakuraV4Booking?.totalAmount === 124500 &&
      sakuraV4Saved.agentId === sakuraAgentUser.id &&
      sakuraV4Saved.companyId === agentCompanyId &&
      sakuraV4Saved.agentAgency === sakuraAgentUser.agencyName &&
      sakuraAddCalc.finalCustomerSellingPrice === 112000 &&
      sakuraAddBreakdown.finalPackagePrice === 112000 &&
      sakuraAddBreakdown.activeMarginMode === 'AGENT_LEVEL',
    'REPLACE FIXED 24000->24500 increases total by exact +₹500 (₹124,000->₹124,500) across ALL engines/outputs, preserves Agent identity, and ADD respects AGENT_LEVEL 12% (₹112,000)',
    {
      v3Total: sakuraV3Calc.finalCustomerSellingPrice,
      v4Total: sakuraV4Calc.finalCustomerSellingPrice,
      v4Breakdown: sakuraV4Breakdown.finalPackagePrice,
      v4Snap: sakuraV4Snap.pricing.finalCustomerSellingPrice,
      v4Booking: sakuraV4Booking?.totalAmount,
      savedAgentId: sakuraV4Saved.agentId,
      savedCompanyId: sakuraV4Saved.companyId,
      addTotal: sakuraAddCalc.finalCustomerSellingPrice,
      addBreakdown: sakuraAddBreakdown.finalPackagePrice,
      addMode: sakuraAddBreakdown.activeMarginMode
    }
  );

  // =========================================================================
  // 8. Rapid Mode/Value Toggles + Zero Rules + Multi-Currency Manual Hotels +
  //    Repeated Hubs + Stale Item FX Rate Invalidation
  // =========================================================================
  console.log('\n--- 8. Rapid Toggles, Zero Rules, Multi-Currency Manual Hotels, Repeated Hubs & Stale FX ---');
  // 1 USD = 85 INR in baseline CurrencyEngine (1000 USD -> 85,000 INR net)
  const usdRateToInr = CurrencyEngine.getInstance().convert(1000, 'USD', 'INR');
  const repeatedHubs: any[] = [
    {
      id: 'hub-tokyo-1',
      itineraryHubOccurrenceId: 'occ-tokyo-first',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo (Arrival)',
      nights: 2,
      order: 1,
      accommodationType: 'manual',
      manualHotel: {
        hotelName: 'Tokyo Ginza Boutique (Stay 1)',
        rateBasis: 'TOTAL_STAY',
        ratePerNight: 500,
        rateCurrency: 'USD',
        numberOfRooms: 1,
        numberOfNights: 2,
        totalNetCost: 500,
        currency: 'USD'
      }
    },
    {
      id: 'hub-tokyo-2',
      itineraryHubOccurrenceId: 'occ-tokyo-return',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo (Departure)',
      nights: 1,
      order: 2,
      accommodationType: 'manual',
      manualHotel: {
        hotelName: 'Tokyo Ginza Boutique (Stay 2)',
        rateBasis: 'TOTAL_STAY',
        ratePerNight: 500,
        rateCurrency: 'USD',
        numberOfRooms: 1,
        numberOfNights: 1,
        totalNetCost: 500,
        currency: 'USD'
      }
    }
  ];

  // Inventory product in USD with deliberately WRONG/STALE item.calculation FX rate (pretend old rate was 50 instead of current rate)
  const prodUsdTransfer = {
    ...makeProduct({
      id: 'mma-usd-trf',
      name: 'Narita VIP Limousine',
      category: 'Transfers',
      productType: 'TRANSFER',
      netINR: 200,
      markupPercent: 10
    }),
    currency: 'USD',
    nativeCurrency: 'USD',
    adultNetPrice: 200
  } as unknown as Product;

  const staleUsdTransferItem: QuoteItem = {
    id: 'it-stale-usd-trf',
    product: prodUsdTransfer,
    travelDate: '2026-11-10',
    pax: { adults: 1, children: 0, infants: 0 },
    selectedAddonIds: [],
    calculation: {
      nativeCurrency: 'USD',
      nativeTotalNetCost: 200,
      currency: 'INR',
      totalNetCost: 10000, // STALE old rate 50 INR/USD instead of live CurrencyEngine rate!
      markupAmount: 1000,
      taxAmount: 0,
      serviceFee: 0,
      surchargeTotal: 0,
      finalTotalSellingPrice: 11000,
      activeMarginMode: 'PRODUCT_LEVEL',
      fxDetails: { effectiveRate: 50, isValid: true, isConverted: true }
    } as any
  };

  // Orphaned repeated hub manual hotels (no hotel items in quote.items) + 1 USD product = 500 + 500 + 200 = $1,200 USD Nett
  const expected1200InrNett = roundCurrencyAmount(CurrencyEngine.getInstance().convert(500, 'USD', 'INR') * 2 + CurrencyEngine.getInstance().convert(200, 'USD', 'INR'), 'INR');
  const expected200InrBaseMargin = roundCurrencyAmount(CurrencyEngine.getInstance().convert(200, 'USD', 'INR') * 0.1, 'INR');

  const multiHubQuoteBase: Quotation = {
    ...sakuraBaseQuote,
    id: 'qte-multi-hub-stale-fx',
    quoteNumber: 'QTE-MULTI-FX',
    isLocked: false,
    companyId: undefined,
    agentId: adminUser.id,
    agentAgency: undefined,
    productLevelMarginEnabled: true,
    routeHubs: repeatedHubs,
    items: [staleUsdTransferItem],
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    overallDiscountPercent: 0
  };

  // Toggle sequence: ADD 0 -> REPLACE 0% -> REPLACE 0 FIXED -> ADD 10% -> REPLACE 10%
  const qAdd0: Quotation = { ...multiHubQuoteBase, adminMarginMode: 'ADD', adminManualMarginType: 'PERCENTAGE', adminManualMarginValue: 0 };
  const qRep0Pct: Quotation = { ...multiHubQuoteBase, adminMarginMode: 'REPLACE', adminManualMarginType: 'PERCENTAGE', adminManualMarginValue: 0 };
  const qRep0Fix: Quotation = { ...multiHubQuoteBase, adminMarginMode: 'REPLACE', adminManualMarginType: 'FIXED', adminManualMarginValue: 0 };
  const qAdd10Pct: Quotation = { ...multiHubQuoteBase, adminMarginMode: 'ADD', adminManualMarginType: 'PERCENTAGE', adminManualMarginValue: 10 };
  const qRep10Pct: Quotation = { ...multiHubQuoteBase, adminMarginMode: 'REPLACE', adminManualMarginType: 'PERCENTAGE', adminManualMarginValue: 10 };

  const bAdd0 = calculateQuoteInternalBreakdown({ items: [staleUsdTransferItem], routeHubs: repeatedHubs, targetCurrency: 'INR', productLevelMarginEnabled: true, adminMarginMode: 'ADD', adminManualMarginType: 'PERCENTAGE', adminManualMarginValue: 0 });
  const tAdd0 = calculateQuoteTotal(qAdd0, undefined, undefined, 'INR');

  const bRep0Pct = calculateQuoteInternalBreakdown({ items: [staleUsdTransferItem], routeHubs: repeatedHubs, targetCurrency: 'INR', productLevelMarginEnabled: true, adminMarginMode: 'REPLACE', adminManualMarginType: 'PERCENTAGE', adminManualMarginValue: 0 });
  const tRep0Pct = calculateQuoteTotal(qRep0Pct, undefined, undefined, 'INR');

  const bRep0Fix = calculateQuoteInternalBreakdown({ items: [staleUsdTransferItem], routeHubs: repeatedHubs, targetCurrency: 'INR', productLevelMarginEnabled: true, adminMarginMode: 'REPLACE', adminManualMarginType: 'FIXED', adminManualMarginValue: 0 });
  const tRep0Fix = calculateQuoteTotal(qRep0Fix, undefined, undefined, 'INR');

  const bAdd10 = calculateQuoteInternalBreakdown({ items: [staleUsdTransferItem], routeHubs: repeatedHubs, targetCurrency: 'INR', productLevelMarginEnabled: true, adminMarginMode: 'ADD', adminManualMarginType: 'PERCENTAGE', adminManualMarginValue: 10 });
  const tAdd10 = calculateQuoteTotal(qAdd10Pct, undefined, undefined, 'INR');

  const bRep10 = calculateQuoteInternalBreakdown({ items: [staleUsdTransferItem], routeHubs: repeatedHubs, targetCurrency: 'INR', productLevelMarginEnabled: true, adminMarginMode: 'REPLACE', adminManualMarginType: 'PERCENTAGE', adminManualMarginValue: 10 });
  const tRep10 = calculateQuoteTotal(qRep10Pct, undefined, undefined, 'INR');

  assert(
    Math.abs(usdRateToInr) > 0 &&
      bAdd0.totalNettCost === expected1200InrNett &&
      tAdd0.totalNetCost === expected1200InrNett &&
      tAdd0.hotelItemsIncludedCount === 2 &&
      bAdd0.finalPackagePrice === roundCurrencyAmount(expected1200InrNett + expected200InrBaseMargin, 'INR') &&
      tAdd0.finalCustomerSellingPrice === bAdd0.finalPackagePrice &&
      bRep0Pct.finalPackagePrice === expected1200InrNett &&
      tRep0Pct.finalCustomerSellingPrice === expected1200InrNett &&
      bRep0Fix.finalPackagePrice === expected1200InrNett &&
      tRep0Fix.finalCustomerSellingPrice === expected1200InrNett &&
      bAdd10.finalPackagePrice === tAdd10.finalCustomerSellingPrice &&
      bRep10.finalPackagePrice === tRep10.finalCustomerSellingPrice &&
      bAdd10.finalPackagePrice > bRep10.finalPackagePrice,
    'Repeated Tokyo hubs, multi-currency manual hotels, stale FX rate invalidation & rapid ADD/REPLACE (including 0% and 0 FIXED) keep 100% engine parity',
    {
      expected1200InrNett,
      expected200InrBaseMargin,
      bAdd0: bAdd0.finalPackagePrice,
      tAdd0: tAdd0.finalCustomerSellingPrice,
      bRep0Pct: bRep0Pct.finalPackagePrice,
      tRep0Pct: tRep0Pct.finalCustomerSellingPrice,
      bRep0Fix: bRep0Fix.finalPackagePrice,
      tRep0Fix: tRep0Fix.finalCustomerSellingPrice,
      bAdd10: bAdd10.finalPackagePrice,
      tAdd10: tAdd10.finalCustomerSellingPrice,
      bRep10: bRep10.finalPackagePrice,
      tRep10: tRep10.finalCustomerSellingPrice,
      hotelsCount: tAdd0.hotelItemsIncludedCount
    }
  );

  // =========================================================================
  // 9. B2B Agent Updating Stage 2 Markup on Sanitized Quote With Admin REPLACE
  //    Manual Margin + Overall Discount (No Double-Discounting / No Stage 1 Loss)
  // =========================================================================
  console.log('\n--- 9. B2B Agent Updating Stage 2 Markup on Admin REPLACE Quote (+Discount) ---');
  // Base Nett = ₹100,000; Admin REPLACE 25% -> ₹125,000; Discount 10% -> Stage 1 = ₹112,500
  const adminReplacedDiscountedQuote: Quotation = {
    ...sakuraBaseQuote,
    id: 'qte-agent-stage2-preserve',
    quoteNumber: 'QTE-STG2-01',
    version: 1,
    latestVersion: 1,
    adminMarginMode: 'REPLACE',
    adminManualMarginType: 'PERCENTAGE',
    adminManualMarginValue: 25,
    overallDiscountPercent: 10,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0
  };
  const adminSavedStage1Res = await db.saveQuotationExplicitVersionAsync({
    quote: adminReplacedDiscountedQuote,
    user: adminWithOwnCompany,
    clientSaveRequestId: 'req-stg2-admin-v1',
    changesSummary: 'Admin set REPLACE 25% + 10% discount'
  });

  // Agent receives strictly sanitized quote, then adds 10% Stage 2 Markup -> ₹112,500 * 1.10 = ₹123,750 (NOT double-discounted!)
  const sanitizedForAgentStage2 = sanitizeQuoteForAgent(adminSavedStage1Res.quote);
  const preStripLeaks = [
    ...findForbiddenKeys(sanitizedForAgentStage2, 'sanitizedForAgentStage2'),
    ...findForbiddenKeys(stripRestrictedCommercialFieldsForRole(adminSavedStage1Res.quote, false), 'stripRoleAgent')
  ];
  const agentUpdatedStage2Input: Quotation = {
    ...sanitizedForAgentStage2,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 10
  };
  const agentSavedStage2 = db.saveQuote(agentUpdatedStage2Input, sakuraAgentUser, 'EDITED');
  const adminReloadedAfterAgent = db.getQuoteByIdAuthorized(adminSavedStage1Res.quote.id, adminWithOwnCompany);

  assert(
    preStripLeaks.length === 0 &&
      adminSavedStage1Res.quote.theUnboundBaseSellingPrice === 112500 &&
      agentSavedStage2.theUnboundBaseSellingPrice === 112500 &&
      agentSavedStage2.finalCustomerSellingPrice === 123750 &&
      adminReloadedAfterAgent?.adminMarginMode === 'REPLACE' &&
      adminReloadedAfterAgent?.adminManualMarginValue === 25 &&
      adminReloadedAfterAgent?.finalCustomerSellingPrice === 123750 &&
      findForbiddenKeys(agentSavedStage2, 'agentSavedStage2').length === 0,
    'Agent Stage 2 markup (+10%) on sanitized REPLACE(25%)+Discount(10%) quote produces ₹123,750 without double-discounting or leaking/wiping Admin manual margin',
    {
      preStripLeaks,
      adminStage1: adminSavedStage1Res.quote.theUnboundBaseSellingPrice,
      agentStage1: agentSavedStage2.theUnboundBaseSellingPrice,
      agentFinal: agentSavedStage2.finalCustomerSellingPrice,
      reloadedMode: adminReloadedAfterAgent?.adminMarginMode,
      reloadedVal: adminReloadedAfterAgent?.adminManualMarginValue,
      reloadedFinal: adminReloadedAfterAgent?.finalCustomerSellingPrice
    }
  );

  // =========================================================================
  // 10. Multi-Version Inspect & Restore Round-Trip (v3 ADD <-> v4 REPLACE)
  // =========================================================================
  console.log('\n--- 10. Multi-Version Inspect & Restore Round-Trip (v3 ADD <-> v4 REPLACE) ---');
  const sakuraV3Explicit = await db.saveQuotationExplicitVersionAsync({
    quote: {
      ...sakuraBaseQuote,
      id: 'qte-sakura-v3-v4-restore',
      quoteNumber: 'QTE-V3V4-RST',
      adminMarginMode: 'ADD',
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 5000
    },
    user: adminWithOwnCompany,
    clientSaveRequestId: 'req-v3-add-5k',
    changesSummary: 'v1 ADD 5000 (simulating v3)'
  });
  const sakuraV4Explicit = await db.saveQuotationExplicitVersionAsync({
    quote: {
      ...sakuraV3Explicit.quote,
      adminMarginMode: 'REPLACE',
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 24500
    },
    user: adminWithOwnCompany,
    clientSaveRequestId: 'req-v4-replace-24500',
    changesSummary: 'v2 REPLACE 24500 (simulating v4)'
  });

  const inspectedV1Add = await db.loadQuotationVersionFullAsync('qte-sakura-v3-v4-restore', 1, adminWithOwnCompany, { bypassCache: true });
  const inspectedV2Rep = await db.loadQuotationVersionFullAsync('qte-sakura-v3-v4-restore', 2, adminWithOwnCompany, { bypassCache: true });
  const restoredV1Draft = await db.prepareRestoredWorkingQuoteAsync('qte-sakura-v3-v4-restore', 1, adminWithOwnCompany);
  const restoredV2Draft = await db.prepareRestoredWorkingQuoteAsync('qte-sakura-v3-v4-restore', 2, adminWithOwnCompany);
  const versionsAfterRestores = db.getQuotationVersions('qte-sakura-v3-v4-restore', adminWithOwnCompany);

  // v1 ADD 5000 on 100k Nett + 12% Agent-Level(12k) = 117,000; v2 REPLACE 24500 = 124,500
  assert(
    inspectedV1Add?.adminMarginMode === 'ADD' &&
      inspectedV1Add?.adminManualMarginValue === 5000 &&
      inspectedV1Add?.finalCustomerSellingPrice === 117000 &&
      inspectedV2Rep?.adminMarginMode === 'REPLACE' &&
      inspectedV2Rep?.adminManualMarginValue === 24500 &&
      inspectedV2Rep?.finalCustomerSellingPrice === 124500 &&
      restoredV1Draft?.adminMarginMode === 'ADD' &&
      restoredV1Draft?.adminManualMarginValue === 5000 &&
      restoredV1Draft?.finalCustomerSellingPrice === 117000 &&
      restoredV2Draft?.adminMarginMode === 'REPLACE' &&
      restoredV2Draft?.adminManualMarginValue === 24500 &&
      restoredV2Draft?.finalCustomerSellingPrice === 124500 &&
      restoredV1Draft?.companyId === agentCompanyId &&
      versionsAfterRestores.length === 2,
    'Inspecting & restoring between ADD and REPLACE versions preserves exact adminMarginMode, value, agency context, and never auto-bumps versions',
    {
      v1Price: inspectedV1Add?.finalCustomerSellingPrice,
      v2Price: inspectedV2Rep?.finalCustomerSellingPrice,
      restoredV1Mode: restoredV1Draft?.adminMarginMode,
      restoredV1Val: restoredV1Draft?.adminManualMarginValue,
      restoredV1Price: restoredV1Draft?.finalCustomerSellingPrice,
      restoredV2Mode: restoredV2Draft?.adminMarginMode,
      restoredV2Val: restoredV2Draft?.adminManualMarginValue,
      restoredV2Price: restoredV2Draft?.finalCustomerSellingPrice,
      versionCount: versionsAfterRestores.length
    }
  );

  console.log('\n================================================================================');
  console.log(`  COMPREHENSIVE MANUAL MARGIN AUDIT COMPLETE: ${passed}/${passed + failed} Passed (${failed} Failed)`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal error running comprehensive manual margin audit:', err);
  process.exit(1);
});
