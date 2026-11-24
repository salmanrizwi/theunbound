import assert from 'assert';
import {
  Product,
  Promotion,
  Quotation,
  QuoteItem
} from '../types';
import {
  buildPromotionReportRows,
  computeStage1PromotionDiscount,
  evaluatePromotionEligibilityAndDiscount,
  isPromotionCodeUnique,
  normalizePromotionCode,
  sanitizePromotionForAgent
} from '../services/promotionEngine';
import {
  calculateProductPrice,
  calculateQuoteInternalBreakdown,
  calculateQuoteTotal
} from '../services/pricingEngine';
import {
  buildAuthoritativeQuotationSnapshot,
  computeQuotationCommercialContentHash
} from '../services/quotationSnapshotService';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import {
  renderOption2CompleteFormattedHtmlEmail,
  renderProposalViewHtmlEmail,
  renderSimpleSemanticQuotationEmailFromModel,
  validateOption2PricingSummary
} from '../services/quoteEmailFormatter';
import { AppDatabase } from '../services/db';
import {
  checkPromotionAdminAccess,
  InMemoryPromotionStore,
  PromotionTransactionManager
} from '../../server/promotionService';

// ============================================================================
// TEST HARNESS & FIXTURES
// ============================================================================

let passed = 0;
let failed = 0;

async function runCase(id: string, name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${id}: ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  [FAIL] ${id}: ${name}`);
    console.error(`         ${err?.message || err}`);
  }
}

const NOW = new Date('2026-06-15T10:00:00.000Z');

function makePromo(overrides: Partial<Promotion> = {}): Promotion {
  const code = overrides.promoCode ?? 'JAPAN10';
  return {
    id: overrides.id || `promo-${code.toLowerCase()}`,
    title: overrides.title || 'Japan Launch 10% Off',
    subtitle: '10% off TheUnbound Base Selling Price',
    description: 'Seasonal B2B promotional discount on eligible Japan itineraries.',
    internalAdminNotes: 'CONFIDENTIAL_ADMIN_BUDGET_REF_9991',
    promoCode: code,
    normalizedPromoCode: normalizePromotionCode(code),
    caseInsensitiveCode: true,
    promotionType: 'DISCOUNT_CODE',
    configVersion: 1,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    currency: 'INR',
    minBookingValue: 0,
    minEligibleBaseSellingPrice: 0,
    maxDiscount: 0,
    maxDiscountAmount: 0,
    maxDiscountPerQuotation: 0,
    targetAudience: 'B2B_AGENT',
    displayPlacement: 'BANNER',
    frequency: 'ALWAYS',
    destinationId: 'all',
    applicableDestinationIds: [],
    applyToAllDestinations: true,
    applicableProductCategories: [],
    applicableProductIds: [],
    applyToAllProducts: true,
    applicableAgencyIds: [],
    applicableAgentIds: [],
    applyToAllAgents: true,
    minPassengers: 0,
    totalUsageLimit: undefined,
    maxUsesPerAgent: undefined,
    maxUsesPerAgency: undefined,
    maxUsesPerBooking: 1,
    oneTimePerUser: false,
    allowReuseOnRevisedQuotation: true,
    newQuotationsOnly: false,
    allowOnDraftQuotations: true,
    allowAtBookingConfirmation: true,
    bookingValidityPolicy: 'REQUIRE_REACCEPTANCE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    priority: 1,
    status: 'ACTIVE',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function makeTestProduct(overrides: Partial<Product> & { id: string; name: string; adultNetPrice: number; defaultMarkupPercent: number }): Product {
  return {
    sku: `SKU-${overrides.id}`,
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    country: 'Japan',
    city: 'Tokyo',
    productType: 'Guided Tour',
    shortDescription: 'Curated Japan ground service',
    longDescription: 'Full day private cultural experience.',
    supplierId: 'sup-jp-01',
    supplierName: 'Tokyo Ground Operations',
    supplierProductCode: `SUP-${overrides.id}`,
    category: 'Tours',
    subcategory: 'Private Cultural Tour',
    duration: '8 Hours',
    operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    operatingHours: '09:00 - 17:00',
    childNetPrice: 0,
    infantNetPrice: 0,
    currency: 'INR',
    nativeCurrency: 'INR',
    b2bAgentMarkupPercent: overrides.defaultMarkupPercent,
    taxPercent: 0,
    commissionPercent: 0,
    serviceFeeFixed: 0,
    sellingPriceStartingFrom: overrides.adultNetPrice,
    season: 'All Year',
    validityFrom: '2025-01-01',
    validityTo: '2027-12-31',
    minPax: 1,
    maxPax: 20,
    availability: 'INSTANT',
    bookingRequiredDays: 1,
    cancellationPolicy: 'Standard 7-day cancellation policy',
    inclusions: ['Private vehicle'],
    exclusions: ['Personal expenses'],
    meetingPoint: 'Hotel Lobby',
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    galleryImages: [],
    tags: ['Tokyo', 'Private'],
    highlights: ['Iconic landmarks'],
    status: 'ACTIVE',
    lastUpdated: '2026-01-01',
    ...overrides
  } as Product;
}

/**
 * Creates 2 items totaling exactly 80,000 INR supplier nett cost and 100,000 INR TheUnbound Base Selling Price
 * (25% product-level internal margin on each item: 20,000 * 2 adults = 40,000 nett -> 50,000 selling each).
 */
function makeSampleItems(): QuoteItem[] {
  const hotelProduct = makeTestProduct({
    id: 'prod-hotel-tokyo',
    name: 'Grand Prince Hotel Takanawa',
    category: 'Hotels',
    productType: 'Hotel',
    adultNetPrice: 20000,
    defaultMarkupPercent: 25
  });
  const tourProduct = makeTestProduct({
    id: 'prod-act-fuji',
    name: 'Mt Fuji & Hakone Private Day Tour',
    category: 'Tours',
    productType: 'Guided Tour',
    adultNetPrice: 20000,
    defaultMarkupPercent: 25
  });

  const calcHotel = calculateProductPrice(hotelProduct, {
    productId: hotelProduct.id,
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-10-10',
    targetCurrency: 'INR',
    productLevelMarginEnabled: true
  });
  const calcTour = calculateProductPrice(tourProduct, {
    productId: tourProduct.id,
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-10-11',
    targetCurrency: 'INR',
    productLevelMarginEnabled: true
  });

  return [
    {
      id: 'item-hotel-1',
      product: hotelProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-10-10',
      calculation: calcHotel
    },
    {
      id: 'item-act-1',
      product: tourProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-10-11',
      calculation: calcTour
    }
  ];
}

function makeSampleQuote(overrides: Partial<Quotation> = {}): Quotation {
  const items = overrides.items || makeSampleItems();
  const q: Quotation = {
    id: overrides.id || 'quote-promo-audit-1',
    quoteNumber: overrides.quoteNumber || 'QT-PROMO-2026-001',
    version: overrides.version ?? 1,
    title: '6 Days Japan Cherry Blossom Circuit',
    destination: 'Japan',
    destinationId: 'dest-japan',
    clientName: 'Aarav Sharma',
    clientEmail: 'aarav@example.com',
    clientPhone: '+91 9876543210',
    agentId: 'agent-1',
    agentName: 'Riya Verma',
    agentAgency: 'Skyline Travels Pvt Ltd',
    companyId: 'agency-1',
    travelStartDate: '2026-10-10',
    travelEndDate: '2026-10-15',
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    currency: 'INR',
    items,
    quotationScope: 'HOTEL_LAND',
    scope: 'HOTEL_LAND',
    brandingMode: 'STANDARD',
    status: 'DRAFT',
    productLevelMarginEnabled: true,
    activeMarginMode: 'PRODUCT_LEVEL',
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    overallMarkupPercent: 0,
    overallDiscountPercent: 0,
    totalNetCost: 80000,
    totalSellingPrice: 100000,
    createdBy: 'agent-1',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides
  } as Quotation;
  return q;
}

const AGENT_CALLER_1 = {
  uid: 'agent-1',
  name: 'Riya Verma',
  email: 'riya@skylinetravels.in',
  role: 'B2B_AGENT',
  agencyId: 'agency-1',
  agencyName: 'Skyline Travels Pvt Ltd',
  idToken: 'mock-token-1',
  isPromotionAdmin: false
};

const AGENT_CALLER_2 = {
  uid: 'agent-2',
  name: 'Kabir Mehta',
  email: 'kabir@horizonholidays.in',
  role: 'B2B_AGENT',
  agencyId: 'agency-2',
  agencyName: 'Horizon Holidays',
  idToken: 'mock-token-2',
  isPromotionAdmin: false
};

// ============================================================================
// MAIN SUITE (40 SCENARIOS)
// ============================================================================

async function main() {
  console.log('\n=== PROMOTION MANAGEMENT ENGINE — 40-SCENARIO COMPREHENSIVE AUDIT ===\n');

  // --------------------------------------------------------------------------
  // SECTION A: BASIC CALCULATIONS & ELIGIBILITY RULES (1–12)
  // --------------------------------------------------------------------------
  console.log('--- Section A: Basic Calculations & Eligibility Rules ---');

  await runCase('A01', '10% percentage discount on Base Selling Price 100,000 -> 10,000 off, 90,000 discounted base', () => {
    const promo = makePromo({ discountType: 'PERCENTAGE', discountValue: 10 });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: 'japan10',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        totalPax: 2,
        now: NOW
      }
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.appliedPromotion?.code, 'JAPAN10');
    assert.strictEqual(res.appliedPromotion?.discountAmount, 10000);
    assert.strictEqual(res.appliedPromotion?.discountedBaseSellingPrice, 90000);
  });

  await runCase('A02', 'Fixed discount 7,500 INR on Base 100,000 -> 7,500 off, 92,500 discounted base', () => {
    const promo = makePromo({ promoCode: 'FLAT7500', discountType: 'FIXED', discountValue: 7500, currency: 'INR' });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: '  flat7500 ',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        totalPax: 2,
        now: NOW
      }
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.appliedPromotion?.discountAmount, 7500);
    assert.strictEqual(res.appliedPromotion?.discountedBaseSellingPrice, 92500);
  });

  await runCase('A03', 'Maximum discount cap enforces ceiling on percentage discount', () => {
    const promo = makePromo({
      promoCode: 'CAP5K',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxDiscount: 5000,
      maxDiscountAmount: 5000,
      currency: 'INR'
    });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: 'CAP5K',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        now: NOW
      }
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.appliedPromotion?.discountAmount, 5000);
    assert.strictEqual(res.appliedPromotion?.discountedBaseSellingPrice, 95000);
  });

  await runCase('A04', 'Minimum eligible Base Selling Price rejects quotes below threshold', () => {
    const promo = makePromo({ promoCode: 'MIN150K', minEligibleBaseSellingPrice: 150000, currency: 'INR' });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: 'MIN150K',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        now: NOW
      }
    });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, 'MIN_VALUE_NOT_MET');
  });

  await runCase('A05', 'Invalid / unknown promotion code returns NOT_FOUND', () => {
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: undefined,
      context: {
        code: 'NO_SUCH_CODE',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        now: NOW
      }
    });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, 'NOT_FOUND');
  });

  await runCase('A06', 'Expired promotion rejected with EXPIRED', () => {
    const promo = makePromo({ promoCode: 'OLD2025', startDate: '2025-01-01', endDate: '2025-12-31' });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: { code: 'OLD2025', stage: 'QUOTATION', preDiscountBaseSellingPrice: 100000, currency: 'INR', now: NOW }
    });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, 'EXPIRED');
  });

  await runCase('A07', 'Future scheduled promotion rejected with SCHEDULED', () => {
    const promo = makePromo({ promoCode: 'FUTURE2027', startDate: '2027-01-01', endDate: '2027-06-30', status: 'SCHEDULED' });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: { code: 'FUTURE2027', stage: 'QUOTATION', preDiscountBaseSellingPrice: 100000, currency: 'INR', now: NOW }
    });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, 'SCHEDULED');
  });

  await runCase('A08', 'Paused and Disabled promotions rejected cleanly', () => {
    const paused = makePromo({ promoCode: 'PAUSED1', status: 'PAUSED', isActive: false });
    const disabled = makePromo({ promoCode: 'DIS1', status: 'DISABLED', isActive: false });
    const r1 = evaluatePromotionEligibilityAndDiscount({
      promotion: paused,
      context: { code: 'PAUSED1', stage: 'QUOTATION', preDiscountBaseSellingPrice: 100000, currency: 'INR', now: NOW }
    });
    const r2 = evaluatePromotionEligibilityAndDiscount({
      promotion: disabled,
      context: { code: 'DIS1', stage: 'QUOTATION', preDiscountBaseSellingPrice: 100000, currency: 'INR', now: NOW }
    });
    assert.strictEqual(r1.valid, false);
    assert.strictEqual(r1.errorCode, 'PAUSED');
    assert.strictEqual(r2.valid, false);
    assert.strictEqual(r2.errorCode, 'DISABLED');
  });

  await runCase('A09', 'Destination-restricted promotion rejects non-matching destination & accepts matching destination', () => {
    const promo = makePromo({
      promoCode: 'JPONLY',
      applyToAllDestinations: false,
      applicableDestinationIds: ['dest-japan']
    });
    const bad = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: 'JPONLY',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        destinationId: 'dest-vietnam',
        now: NOW
      }
    });
    const good = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: 'JPONLY',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        destinationId: 'dest-japan',
        now: NOW
      }
    });
    assert.strictEqual(bad.valid, false);
    assert.strictEqual(bad.errorCode, 'DESTINATION_NOT_ELIGIBLE');
    assert.strictEqual(good.valid, true);
  });

  await runCase('A10', 'Product-category restriction applies discount ONLY to eligible category base price', () => {
    const promo = makePromo({
      promoCode: 'HOTEL20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      applicableProductCategories: ['HOTEL']
    });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: 'HOTEL20',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        items: [
          { id: 'item-hotel-1', productId: 'prod-hotel-tokyo', category: 'HOTEL', baseSellingPrice: 50000 },
          { id: 'item-act-1', productId: 'prod-act-fuji', category: 'ACTIVITY', baseSellingPrice: 50000 }
        ],
        now: NOW
      }
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.appliedPromotion?.eligibleBaseSellingPrice, 50000);
    assert.strictEqual(res.appliedPromotion?.discountAmount, 10000);
    assert.strictEqual(res.appliedPromotion?.discountedBaseSellingPrice, 90000);
  });

  await runCase('A11', 'Agent/Agency restriction rejects unauthorized agent & case-insensitive uniqueness prevents duplicate codes', () => {
    const promo = makePromo({
      promoCode: 'VIPAGENT',
      applyToAllAgents: false,
      applicableAgentIds: ['agent-1']
    });
    const denied = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: 'VIPAGENT',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        agentUid: 'agent-2',
        agencyId: 'agency-2',
        now: NOW
      }
    });
    assert.strictEqual(denied.valid, false);
    assert.strictEqual(denied.errorCode, 'AGENT_NOT_ELIGIBLE');

    assert.strictEqual(isPromotionCodeUnique([promo], 'vipagent').unique, false);
    assert.strictEqual(isPromotionCodeUnique([promo], 'VIPAGENT', promo.id).unique, true);
    assert.strictEqual(isPromotionCodeUnique([promo], 'NEWCODE99').unique, true);
  });

  await runCase('A12', 'Discount exceeding Base Selling Price clamps strictly to 0 (never negative)', () => {
    const promo = makePromo({
      promoCode: 'MEGA500K',
      discountType: 'FIXED',
      discountValue: 500000,
      currency: 'INR'
    });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: promo,
      context: {
        code: 'MEGA500K',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 40000,
        currency: 'INR',
        now: NOW
      }
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.appliedPromotion?.discountAmount, 40000);
    assert.strictEqual(res.appliedPromotion?.discountedBaseSellingPrice, 0);
  });

  // --------------------------------------------------------------------------
  // SECTION B: QUOTATION WORKFLOW, SNAPSHOTS & ALL OUTPUT CHANNELS (13–20)
  // --------------------------------------------------------------------------
  console.log('--- Section B: Quotation Workflow, Snapshots & All Outputs ---');

  const promo10 = makePromo({
    promoCode: 'AUTUMN10',
    title: 'Autumn B2B Offer',
    discountType: 'PERCENTAGE',
    discountValue: 10
  });
  const eval10 = evaluatePromotionEligibilityAndDiscount({
    promotion: promo10,
    context: {
      code: 'AUTUMN10',
      stage: 'QUOTATION',
      preDiscountBaseSellingPrice: 100000,
      currency: 'INR',
      now: NOW
    }
  });
  const applied10 = eval10.appliedPromotion!;

  await runCase('B13', 'Applying & removing promotion changes commercial content hash without creating versions automatically', () => {
    const qNoPromo = makeSampleQuote({ appliedPromotion: null });
    const qWithPromo = makeSampleQuote({ appliedPromotion: applied10 });
    const h1 = computeQuotationCommercialContentHash(qNoPromo);
    const h2 = computeQuotationCommercialContentHash(qWithPromo);
    assert.notStrictEqual(h1, h2, 'Commercial hash must change when promotion is applied');
    const qRemoved = makeSampleQuote({ appliedPromotion: null });
    assert.strictEqual(computeQuotationCommercialContentHash(qRemoved), h1);
  });

  await runCase('B14', 'Authoritative Quotation Snapshot persists full AppliedPromotionSnapshot and pre/post base prices', () => {
    const quote = makeSampleQuote({ appliedPromotion: applied10 });
    const snap = buildAuthoritativeQuotationSnapshot(quote);
    assert.ok(snap.pricing.appliedPromotion, 'Snapshot must persist appliedPromotion');
    assert.strictEqual(snap.pricing.appliedPromotion?.code, 'AUTUMN10');
    assert.strictEqual(snap.pricing.preDiscountBaseSellingPrice, 100000);
    assert.strictEqual(snap.pricing.promotionDiscountAmount, 10000);
    assert.strictEqual(snap.pricing.discountedBaseSellingPrice, 90000);
    assert.strictEqual(snap.pricing.finalCustomerSellingPrice, 90000);
  });

  await runCase('B15', 'QuotePresentationModel reads appliedPromotion exclusively from authoritative snapshot (no recalculation)', () => {
    const quote = makeSampleQuote({ appliedPromotion: applied10 });
    const snap = buildAuthoritativeQuotationSnapshot(quote);
    const savedQuote: Quotation = {
      ...quote,
      authoritativeSnapshot: snap,
      totalSellingPrice: snap.pricing.finalCustomerSellingPrice,
      finalCustomerSellingPrice: snap.pricing.finalCustomerSellingPrice
    };
    const model = buildQuotePresentationModel(savedQuote);
    assert.ok(model.appliedPromotion, 'PresentationModel must expose appliedPromotion');
    assert.strictEqual(model.appliedPromotion?.code, 'AUTUMN10');
    assert.strictEqual(model.appliedPromotion?.discountAmountNumeric, 10000);
    assert.strictEqual(model.finalCustomerSellingPriceNumeric, 90000);
  });

  await runCase('B16', 'Email Option 1 (HTML & Plain Text) displays promotional discount and matches snapshot grandTotal', () => {
    const quote = makeSampleQuote({ appliedPromotion: applied10 });
    const snap = buildAuthoritativeQuotationSnapshot(quote);
    const savedQuote: Quotation = {
      ...quote,
      authoritativeSnapshot: snap,
      totalSellingPrice: snap.pricing.finalCustomerSellingPrice,
      finalCustomerSellingPrice: snap.pricing.finalCustomerSellingPrice
    };
    const model = buildQuotePresentationModel(savedQuote);
    const html1 = renderProposalViewHtmlEmail(model);
    const text1 = renderQuoteEmailFromPresentationModel(model).textBody;
    assert.ok(html1.includes('AUTUMN10'), 'Email Option 1 HTML must display promotion code');
    assert.ok(html1.includes('Promotional Discount'), 'Email Option 1 HTML must display Promotional Discount label');
    assert.ok(text1.includes('AUTUMN10'), 'Email Option 1 Plain Text must display promotion code');
  });

  await runCase('B17', 'Email Option 2 (Spreadsheet) shows promotional discount when applied AND preserves 2-row invariant when absent', () => {
    const quoteWithPromo = makeSampleQuote({ appliedPromotion: applied10 });
    const snapWithPromo = buildAuthoritativeQuotationSnapshot(quoteWithPromo);
    const savedWithPromo: Quotation = {
      ...quoteWithPromo,
      authoritativeSnapshot: snapWithPromo,
      totalSellingPrice: snapWithPromo.pricing.finalCustomerSellingPrice,
      finalCustomerSellingPrice: snapWithPromo.pricing.finalCustomerSellingPrice
    };
    const modelWithPromo = buildQuotePresentationModel(savedWithPromo);
    const opt2HtmlWithPromo = renderOption2CompleteFormattedHtmlEmail(modelWithPromo);
    const opt2SimpleWithPromo = renderSimpleSemanticQuotationEmailFromModel(modelWithPromo);
    assert.ok(opt2HtmlWithPromo.includes('AUTUMN10'), 'Option 2 HTML must include applied promo code');
    assert.ok(opt2SimpleWithPromo.textBody.includes('AUTUMN10'), 'Option 2 Plain Text must include applied promo code');

    const quoteNoPromo = makeSampleQuote({ appliedPromotion: null });
    const snapNoPromo = buildAuthoritativeQuotationSnapshot(quoteNoPromo);
    const savedNoPromo: Quotation = {
      ...quoteNoPromo,
      authoritativeSnapshot: snapNoPromo,
      totalSellingPrice: snapNoPromo.pricing.finalCustomerSellingPrice,
      finalCustomerSellingPrice: snapNoPromo.pricing.finalCustomerSellingPrice
    };
    const modelNoPromo = buildQuotePresentationModel(savedNoPromo);
    const opt2HtmlNoPromo = renderOption2CompleteFormattedHtmlEmail(modelNoPromo);
    const validation = validateOption2PricingSummary(modelNoPromo);
    assert.strictEqual(
      validation.isValid,
      true,
      `Option 2 without promo must pass pricing summary validation: ${validation.missingFields.join('; ')}`
    );
    assert.ok(
      !opt2HtmlNoPromo.includes('Promotional Discount'),
      'Option 2 without promo must preserve strict 2-row summary without a discount row'
    );
  });

  await runCase('B18', 'WhatsApp Proposal (Emoji & Plain modes) displays promotional discount identically to snapshot', () => {
    const quote = makeSampleQuote({ appliedPromotion: applied10 });
    const snap = buildAuthoritativeQuotationSnapshot(quote);
    const savedQuote: Quotation = {
      ...quote,
      authoritativeSnapshot: snap,
      totalSellingPrice: snap.pricing.finalCustomerSellingPrice,
      finalCustomerSellingPrice: snap.pricing.finalCustomerSellingPrice
    };
    const model = buildQuotePresentationModel(savedQuote);
    const waEmoji = renderQuoteWhatsAppFromPresentationModel(model, { useEmojis: true });
    const waPlain = renderQuoteWhatsAppFromPresentationModel(model, { useEmojis: false });
    assert.ok(waEmoji.includes('AUTUMN10') && waEmoji.includes('Promotional Discount'));
    assert.ok(waPlain.includes('AUTUMN10') && waPlain.includes('Promotional Discount'));
  });

  await runCase('B19', 'Customer-facing outputs NEVER leak internalAdminNotes, supplier nett cost, or internal margin', () => {
    const quote = makeSampleQuote({ appliedPromotion: applied10 });
    const snap = buildAuthoritativeQuotationSnapshot(quote);
    const savedQuote: Quotation = {
      ...quote,
      authoritativeSnapshot: snap,
      totalSellingPrice: snap.pricing.finalCustomerSellingPrice,
      finalCustomerSellingPrice: snap.pricing.finalCustomerSellingPrice
    };
    const model = buildQuotePresentationModel(savedQuote);
    const combinedOutput = [
      renderProposalViewHtmlEmail(model),
      renderQuoteEmailFromPresentationModel(model).textBody,
      renderOption2CompleteFormattedHtmlEmail(model),
      renderQuoteWhatsAppFromPresentationModel(model, { useEmojis: false })
    ].join('\n');
    assert.ok(!combinedOutput.includes('CONFIDENTIAL_ADMIN_BUDGET_REF_9991'), 'Must never leak internalAdminNotes');
    assert.ok(!/\bsupplier nett\b/i.test(combinedOutput), 'Must never leak supplier nett');
    assert.ok(!/\binternal margin\b/i.test(combinedOutput), 'Must never leak internal margin');
  });

  await runCase('B20', 'Zero duplicate discount across repeated snapshot builds / quote re-hydration', () => {
    const quote = makeSampleQuote({ appliedPromotion: applied10 });
    const snap1 = buildAuthoritativeQuotationSnapshot(quote);
    const hydrated: Quotation = {
      ...quote,
      authoritativeSnapshot: snap1,
      appliedPromotion: snap1.pricing.appliedPromotion,
      totalSellingPrice: snap1.pricing.finalCustomerSellingPrice,
      finalCustomerSellingPrice: snap1.pricing.finalCustomerSellingPrice
    };
    const snap2 = buildAuthoritativeQuotationSnapshot(hydrated);
    assert.strictEqual(snap1.pricing.finalCustomerSellingPrice, 90000);
    assert.strictEqual(snap2.pricing.finalCustomerSellingPrice, 90000, 'Re-snapshotting must NEVER double-deduct promotion discount');
    assert.strictEqual(snap2.pricing.promotionDiscountAmount, 10000);
  });

  // --------------------------------------------------------------------------
  // SECTION C: BOOKING CONFIRMATION, CONCURRENCY, IDEMPOTENCY & IMMUTABILITY (21–28)
  // --------------------------------------------------------------------------
  console.log('--- Section C: Booking Confirmation, Concurrency & Idempotency ---');

  await runCase('C21', 'Scenario A: Confirm booking with quote-stage code reserves and redeems cleanly without double-deduction', async () => {
    const store = new InMemoryPromotionStore([makePromo({ promoCode: 'BOOK10', totalUsageLimit: 5 })]);
    const mgr = new PromotionTransactionManager(store);

    const res = await mgr.reservePromotion(
      {
        code: 'BOOK10',
        quotationId: 'q-c21',
        quotationNumber: 'QT-C21',
        quotationVersion: 1,
        idempotencyKey: 'idem-c21',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        existingQuotationPromotionId: 'promo-book10'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.appliedPromotion?.discountAmount, 10000);
    assert.strictEqual(res.appliedPromotion?.discountedBaseSellingPrice, 90000);

    const commit = await mgr.confirmRedemption(
      {
        promotionId: 'promo-book10',
        code: 'BOOK10',
        reservationId: res.reservation?.id,
        idempotencyKey: 'idem-c21',
        bookingId: 'bk-c21',
        bookingReference: 'BK-2026-C21',
        quotationId: 'q-c21',
        quotationNumber: 'QT-C21',
        quotationVersion: 1,
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        appliedStage: 'QUOTATION'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(commit.ok, true);
    assert.strictEqual(commit.redemption?.discountAmount, 10000);
    assert.strictEqual(commit.redemption?.bookingId, 'bk-c21');
  });

  await runCase('C22', 'Scenario B: Booking-stage promotion entry respects allowAtBookingConfirmation flag', async () => {
    const blockedPromo = makePromo({ promoCode: 'QUOTEONLY', allowAtBookingConfirmation: false });
    const allowedPromo = makePromo({ promoCode: 'BOOKOK', allowAtBookingConfirmation: true });
    const store = new InMemoryPromotionStore([blockedPromo, allowedPromo]);
    const mgr = new PromotionTransactionManager(store);

    const rBlocked = await mgr.validateCode(
      {
        code: 'QUOTEONLY',
        stage: 'BOOKING_CONFIRMATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(rBlocked.valid, false);
    assert.strictEqual(rBlocked.errorCode, 'BOOKING_STAGE_NOT_ALLOWED');

    const rAllowed = await mgr.validateCode(
      {
        code: 'BOOKOK',
        stage: 'BOOKING_CONFIRMATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(rAllowed.valid, true);
    assert.strictEqual(rAllowed.appliedPromotion?.appliedStage, 'BOOKING_CONFIRMATION');
  });

  await runCase('C23', 'Scenario C: Revalidation detects paused/expired promotion between quotation and booking confirmation', async () => {
    const promo = makePromo({ promoCode: 'EXPIREME', status: 'PAUSED', isActive: false });
    const store = new InMemoryPromotionStore([promo]);
    const mgr = new PromotionTransactionManager(store);
    const reval = await mgr.validateCode(
      {
        code: 'EXPIREME',
        stage: 'BOOKING_CONFIRMATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        existingQuotationPromotionId: promo.id
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(reval.valid, false);
    assert.strictEqual(reval.errorCode, 'PAUSED');
  });

  await runCase('C24', 'Concurrency Race Test: Two simultaneous reservations for last 1 remaining slot -> strictly 1 succeeds, 1 fails', async () => {
    const promo = makePromo({ promoCode: 'LASTSLOT1', totalUsageLimit: 1 });
    const store = new InMemoryPromotionStore([promo]);
    const mgr = new PromotionTransactionManager(store);

    const [res1, res2] = await Promise.all([
      mgr.reservePromotion(
        {
          code: 'LASTSLOT1',
          quotationId: 'q-race-1',
          quotationVersion: 1,
          idempotencyKey: 'race-key-1',
          preDiscountBaseSellingPrice: 100000,
          currency: 'INR'
        },
        AGENT_CALLER_1,
        NOW
      ),
      mgr.reservePromotion(
        {
          code: 'LASTSLOT1',
          quotationId: 'q-race-2',
          quotationVersion: 1,
          idempotencyKey: 'race-key-2',
          preDiscountBaseSellingPrice: 100000,
          currency: 'INR'
        },
        AGENT_CALLER_2,
        NOW
      )
    ]);

    const successes = [res1, res2].filter((r) => r.ok);
    const failures = [res1, res2].filter((r) => !r.ok);
    assert.strictEqual(successes.length, 1, 'Strictly 1 concurrent reservation may claim the last slot');
    assert.strictEqual(failures.length, 1, 'The losing concurrent reservation must be rejected');
    assert.strictEqual(failures[0].validation.errorCode, 'USAGE_LIMIT_REACHED');
  });

  await runCase('C25', 'Idempotent Retry Test: Duplicate confirmRedemption with same idempotencyKey creates strictly 1 redemption', async () => {
    const promo = makePromo({ promoCode: 'IDEM10', totalUsageLimit: 5 });
    const store = new InMemoryPromotionStore([promo]);
    const mgr = new PromotionTransactionManager(store);

    const reserve = await mgr.reservePromotion(
      {
        code: 'IDEM10',
        quotationId: 'q-idem-1',
        quotationVersion: 1,
        idempotencyKey: 'idem-retry-99',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(reserve.ok, true);

    const first = await mgr.confirmRedemption(
      {
        promotionId: promo.id,
        code: 'IDEM10',
        reservationId: reserve.reservation!.id,
        idempotencyKey: 'idem-retry-99',
        bookingId: 'bk-idem-99',
        quotationId: 'q-idem-1',
        quotationVersion: 1,
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        appliedStage: 'QUOTATION'
      },
      AGENT_CALLER_1,
      NOW
    );
    const retry = await mgr.confirmRedemption(
      {
        promotionId: promo.id,
        code: 'IDEM10',
        reservationId: reserve.reservation!.id,
        idempotencyKey: 'idem-retry-99',
        bookingId: 'bk-idem-99',
        quotationId: 'q-idem-1',
        quotationVersion: 1,
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        appliedStage: 'QUOTATION'
      },
      AGENT_CALLER_1,
      NOW
    );

    assert.strictEqual(first.ok, true);
    assert.strictEqual(retry.ok, true);
    assert.strictEqual(retry.idempotentHit, true);
    assert.strictEqual(first.redemption?.id, retry.redemption?.id);
    const allReds = await store.listRedemptions('mock', promo.id);
    assert.strictEqual(allReds.length, 1, 'Must never create duplicate redemption records');
  });

  await runCase('C26', 'Releasing reservation immediately frees usage slot for next booking', async () => {
    const promo = makePromo({ promoCode: 'REL1', totalUsageLimit: 1 });
    const store = new InMemoryPromotionStore([promo]);
    const mgr = new PromotionTransactionManager(store);

    const r1 = await mgr.reservePromotion(
      {
        code: 'REL1',
        quotationId: 'q-rel-1',
        quotationVersion: 1,
        idempotencyKey: 'rel-key-1',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(r1.ok, true);

    const released = await mgr.releaseReservation(
      r1.reservation!.id,
      'Booking cancelled before commit',
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(released.ok, true);

    const r2 = await mgr.reservePromotion(
      {
        code: 'REL1',
        quotationId: 'q-rel-2',
        quotationVersion: 1,
        idempotencyKey: 'rel-key-2',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_2,
      NOW
    );
    assert.strictEqual(r2.ok, true, 'Released slot must become available again');
  });

  await runCase('C27', 'Per-Agent & Per-Agency usage limits enforce caps accurately', async () => {
    const promo = makePromo({ promoCode: 'ONCEUSER', oneTimePerUser: true, maxUsesPerAgency: 2 });
    const store = new InMemoryPromotionStore([promo]);
    const mgr = new PromotionTransactionManager(store);

    const r1 = await mgr.reservePromotion(
      {
        code: 'ONCEUSER',
        quotationId: 'q-u1',
        quotationVersion: 1,
        idempotencyKey: 'u1-key',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(r1.ok, true);
    await mgr.confirmRedemption(
      {
        promotionId: promo.id,
        code: 'ONCEUSER',
        reservationId: r1.reservation!.id,
        idempotencyKey: 'u1-key',
        bookingId: 'bk-u1',
        quotationId: 'q-u1',
        quotationVersion: 1,
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        appliedStage: 'QUOTATION'
      },
      AGENT_CALLER_1,
      NOW
    );

    const secondSameAgent = await mgr.validateCode(
      { code: 'ONCEUSER', stage: 'QUOTATION', preDiscountBaseSellingPrice: 100000, currency: 'INR' },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(secondSameAgent.valid, false);
    assert.strictEqual(secondSameAgent.errorCode, 'AGENT_USAGE_LIMIT_REACHED');

    const otherAgent = await mgr.validateCode(
      { code: 'ONCEUSER', stage: 'QUOTATION', preDiscountBaseSellingPrice: 100000, currency: 'INR' },
      AGENT_CALLER_2,
      NOW
    );
    assert.strictEqual(otherAgent.valid, true);
  });

  await runCase('C28', 'Admin report aggregation accurately computes redemptions, pending, released, remaining & granted total', async () => {
    const promo = makePromo({ promoCode: 'RPT10', totalUsageLimit: 10 });
    const store = new InMemoryPromotionStore([promo]);
    const mgr = new PromotionTransactionManager(store);

    const r1 = await mgr.reservePromotion(
      {
        code: 'RPT10',
        quotationId: 'q-r1',
        quotationVersion: 1,
        idempotencyKey: 'rpt-1',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_1,
      NOW
    );
    await mgr.confirmRedemption(
      {
        promotionId: promo.id,
        code: 'RPT10',
        reservationId: r1.reservation!.id,
        idempotencyKey: 'rpt-1',
        bookingId: 'bk-r1',
        quotationId: 'q-r1',
        quotationVersion: 1,
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        appliedStage: 'QUOTATION'
      },
      AGENT_CALLER_1,
      NOW
    );
    const r2 = await mgr.reservePromotion(
      {
        code: 'RPT10',
        quotationId: 'q-r2',
        quotationVersion: 1,
        idempotencyKey: 'rpt-2',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_2,
      NOW
    );
    assert.strictEqual(r2.ok, true);

    const rows = buildPromotionReportRows({
      promotions: await store.listPromotions(),
      redemptions: await store.listRedemptions('mock'),
      reservations: await store.listReservations('mock'),
      now: NOW
    });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].successfulRedemptions, 1);
    assert.strictEqual(rows[0].pendingReservations, 1);
    assert.strictEqual(rows[0].remainingUsage, 8);
    assert.strictEqual(rows[0].totalDiscountValueGranted, 10000);
    assert.strictEqual(rows[0].uniqueAgenciesCount, 1);
    assert.strictEqual(rows[0].uniqueAgentsCount, 1);
  });

  // --------------------------------------------------------------------------
  // SECTION D: PRICING ENGINE INTEGRITY (29–36)
  // --------------------------------------------------------------------------
  console.log('--- Section D: Pricing Engine Integrity ---');

  await runCase('D29', 'Discount applies strictly to TheUnbound Base Selling Price (Stage 1) — Supplier Nett Cost untouched', () => {
    const items = makeSampleItems();
    const b0 = calculateQuoteInternalBreakdown({
      items,
      targetCurrency: 'INR',
      productLevelMarginEnabled: true,
      appliedPromotion: null
    });
    const b1 = calculateQuoteInternalBreakdown({
      items,
      targetCurrency: 'INR',
      productLevelMarginEnabled: true,
      appliedPromotion: applied10
    });

    assert.strictEqual(b0.totalNettCost, 80000);
    assert.strictEqual(b1.totalNettCost, 80000, 'Supplier Nett Cost must NEVER be altered by promotions');
    assert.strictEqual(b1.preDiscountBaseSellingPrice, 100000);
    assert.strictEqual(b1.promotionDiscountAmount, 10000);
    assert.strictEqual(b1.theUnboundBaseSellingPrice, 90000);
    assert.strictEqual(b1.finalPackagePrice, 90000);
  });

  await runCase('D30', 'Stage 2 Agent Additional Markup calculates on the DISCOUNTED Base Selling Price', () => {
    const items = makeSampleItems();
    const b = calculateQuoteInternalBreakdown({
      items,
      targetCurrency: 'INR',
      productLevelMarginEnabled: true,
      appliedPromotion: applied10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 5
    });
    assert.strictEqual(b.preDiscountBaseSellingPrice, 100000);
    assert.strictEqual(b.promotionDiscountAmount, 10000);
    assert.strictEqual(b.theUnboundBaseSellingPrice, 90000);
    assert.strictEqual(b.partnerMarginAmount, 4500, '5% Agent Additional Markup must be calculated on 90,000 discounted base');
    assert.strictEqual(b.finalPackagePrice, 94500);
  });

  await runCase('D31', 'Stage 2 Fixed Agent Markup adds cleanly onto Discounted Base Selling Price', () => {
    const items = makeSampleItems();
    const b = calculateQuoteInternalBreakdown({
      items,
      targetCurrency: 'INR',
      productLevelMarginEnabled: true,
      appliedPromotion: applied10,
      agentMarginType: 'FIXED',
      agentMarginValue: 8000
    });
    assert.strictEqual(b.theUnboundBaseSellingPrice, 90000);
    assert.strictEqual(b.partnerMarginAmount, 8000);
    assert.strictEqual(b.finalPackagePrice, 98000);
  });

  await runCase('D32', 'Internal margin configuration (Product-Level vs Agent-Level exclusivity) remains intact', () => {
    const items = makeSampleItems();
    const bNoPromo = calculateQuoteInternalBreakdown({
      items,
      targetCurrency: 'INR',
      productLevelMarginEnabled: false,
      customAgentMarginPercent: 15,
      appliedPromotion: null
    });
    assert.strictEqual(bNoPromo.theUnboundBaseSellingPrice, 92000);
    assert.strictEqual(bNoPromo.totalNettCost, 80000);

    const promoEval = evaluatePromotionEligibilityAndDiscount({
      promotion: promo10,
      context: {
        code: 'AUTUMN10',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 92000,
        currency: 'INR',
        now: NOW
      }
    });
    const bPromo = calculateQuoteInternalBreakdown({
      items,
      targetCurrency: 'INR',
      productLevelMarginEnabled: false,
      customAgentMarginPercent: 15,
      appliedPromotion: promoEval.appliedPromotion
    });
    assert.strictEqual(bPromo.totalNettCost, 80000);
    assert.strictEqual(bPromo.preDiscountBaseSellingPrice, 92000);
    assert.strictEqual(bPromo.promotionDiscountAmount, 9200);
    assert.strictEqual(bPromo.theUnboundBaseSellingPrice, 82800);
  });

  await runCase('D33', 'Admin Manual Margin (ADD mode) applies to Stage 1 before promotion discount, Supplier Nett unchanged', () => {
    const items = makeSampleItems();
    const b = calculateQuoteInternalBreakdown({
      items,
      targetCurrency: 'INR',
      productLevelMarginEnabled: true,
      adminManualMarginType: 'FIXED',
      adminManualMarginValue: 10000,
      adminMarginMode: 'ADD',
      appliedPromotion: applied10
    });
    assert.strictEqual(b.totalNettCost, 80000);
    assert.strictEqual(b.preDiscountBaseSellingPrice, 110000);
    assert.strictEqual(b.promotionDiscountAmount, 11000);
    assert.strictEqual(b.theUnboundBaseSellingPrice, 99000);
  });

  await runCase('D34', 'calculateQuoteTotal matches calculateQuoteInternalBreakdown grand total exactly', () => {
    const quote = makeSampleQuote({
      appliedPromotion: applied10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 5,
      overallMarkupPercent: 5
    });
    const b = calculateQuoteInternalBreakdown({
      items: quote.items,
      targetCurrency: 'INR',
      productLevelMarginEnabled: true,
      appliedPromotion: applied10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 5
    });
    const total = calculateQuoteTotal(quote, undefined, undefined, 'INR');
    assert.strictEqual(total.finalCustomerSellingPrice, b.finalPackagePrice);
    assert.strictEqual(total.finalCustomerSellingPrice, 94500);
  });

  await runCase('D35', 'FX currency conversion for fixed promotion amount uses central FX engine cleanly', () => {
    const usdPromo = makePromo({
      promoCode: 'USD100',
      discountType: 'FIXED',
      discountValue: 100,
      currency: 'USD'
    });
    const res = evaluatePromotionEligibilityAndDiscount({
      promotion: usdPromo,
      context: {
        code: 'USD100',
        stage: 'QUOTATION',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        now: NOW
      }
    });
    assert.strictEqual(res.valid, true);
    assert.ok(
      res.appliedPromotion!.discountAmount > 5000 && res.appliedPromotion!.discountAmount < 15000,
      'USD 100 must convert to INR via central FX engine'
    );
    assert.strictEqual(res.appliedPromotion!.currency, 'INR');
  });

  await runCase('D36', 'computeStage1PromotionDiscount dynamically recomputes percentage when itinerary changes', () => {
    const recomputed = computeStage1PromotionDiscount({
      stage1PreDiscountBase: 200000,
      targetCurrency: 'INR',
      appliedPromotion: applied10
    });
    assert.strictEqual(recomputed.promotionDiscountAmount, 20000);
    assert.strictEqual(recomputed.discountedBaseSellingPrice, 180000);
  });

  // --------------------------------------------------------------------------
  // SECTION E: SECURITY, RBAC & SANITIZATION (37–40)
  // --------------------------------------------------------------------------
  console.log('--- Section E: Security, RBAC & Data Protection ---');

  await runCase('E37', 'RBAC: B2B Agent & Retail Buyer are strictly denied Promotion Admin access; Admin is allowed', () => {
    assert.strictEqual(checkPromotionAdminAccess({ role: 'B2B_AGENT', approvalStatus: 'APPROVED' }, 'agent@agency.com'), false);
    assert.strictEqual(checkPromotionAdminAccess({ role: 'BUYER', approvalStatus: 'APPROVED' }, 'buyer@mail.com'), false);
    assert.strictEqual(checkPromotionAdminAccess({ role: 'TEAM_MEMBER', permissions: { canAccessCMS: false } }, 'staff@theunbound.in'), false);
    assert.strictEqual(checkPromotionAdminAccess({ role: 'ADMIN', approvalStatus: 'APPROVED' }, 'ops@theunbound.in'), true);
    assert.strictEqual(checkPromotionAdminAccess(null, 'business@theunbound.in'), true);
  });

  await runCase('E38', 'sanitizePromotionForAgent strips internalAdminNotes and sensitive targeting lists', () => {
    const promo = makePromo({
      internalAdminNotes: 'SECRET_DEAL_WITH_GM',
      applicableAgentIds: ['agent-1', 'agent-secret'],
      applicableAgencyIds: ['agency-1']
    });
    const safe = sanitizePromotionForAgent(promo);
    assert.strictEqual('internalAdminNotes' in safe, false);
    assert.strictEqual('applicableAgentIds' in safe, false);
    assert.strictEqual('applicableAgencyIds' in safe, false);
    assert.strictEqual(safe.promoCode, promo.promoCode);
  });

  await runCase('E39', 'Server confirmRedemption recalculates discount authoritatively (ignores client manipulation)', async () => {
    const promo = makePromo({ promoCode: 'AUTH10', discountType: 'PERCENTAGE', discountValue: 10 });
    const store = new InMemoryPromotionStore([promo]);
    const mgr = new PromotionTransactionManager(store);

    const commit = await mgr.confirmRedemption(
      {
        promotionId: promo.id,
        code: 'AUTH10',
        idempotencyKey: 'sec-e39',
        bookingId: 'bk-e39',
        quotationId: 'q-e39',
        quotationVersion: 1,
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        appliedStage: 'BOOKING_CONFIRMATION'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(commit.ok, true);
    assert.strictEqual(commit.redemption?.discountAmount, 10000);
    assert.strictEqual(commit.redemption?.discountedBaseSellingPrice, 90000);
  });

  await runCase('E40', 'Cross-agent protection: Agent 2 cannot release or commit Agent 1’s promotion reservation', async () => {
    const promo = makePromo({ promoCode: 'LOCK1', totalUsageLimit: 5 });
    const store = new InMemoryPromotionStore([promo]);
    const mgr = new PromotionTransactionManager(store);

    const res1 = await mgr.reservePromotion(
      {
        code: 'LOCK1',
        quotationId: 'q-lock-1',
        quotationVersion: 1,
        idempotencyKey: 'lock-key-1',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      AGENT_CALLER_1,
      NOW
    );
    assert.strictEqual(res1.ok, true);

    const hijackRelease = await mgr.releaseReservation(
      res1.reservation!.id,
      'Hijack attempt',
      AGENT_CALLER_2,
      NOW
    );
    assert.strictEqual(hijackRelease.ok, false);

    const hijackCommit = await mgr.confirmRedemption(
      {
        promotionId: promo.id,
        code: 'LOCK1',
        reservationId: res1.reservation!.id,
        idempotencyKey: 'hijack-commit-1',
        bookingId: 'bk-hijack-1',
        quotationId: 'q-lock-1',
        quotationVersion: 1,
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR',
        appliedStage: 'QUOTATION'
      },
      AGENT_CALLER_2,
      NOW
    );
    assert.strictEqual(hijackCommit.ok, false);
    assert.strictEqual(hijackCommit.errorCode, 'UNAUTHORIZED');
  });

  // Ensure DB still has zero seeded demo promotions (masterHierarchyAndRoutingAudit invariant)
  assert.strictEqual(AppDatabase.getInstance().getPromotions().length, 0, 'DB must have zero seeded demo promotions');

  console.log(`\n=== AUDIT SUMMARY: ${passed} passed, ${failed} failed (total ${passed + failed}) ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in promotionEngineComprehensiveAudit:', err);
  process.exit(1);
});
