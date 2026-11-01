import { CurrencyEngine } from '../services/currencyEngine';
import {
  calculateProductPrice,
  calculateQuoteInternalBreakdown,
  calculateQuoteTotal,
  buildQuotationCurrencySnapshot,
  formatCurrency,
  roundCurrencyAmount
} from '../services/pricingEngine';
import {
  buildQuotePresentationModel,
  renderQuoteEmailFromPresentationModel
} from '../services/quotePresentationModel';
import { buildSemanticBlocks } from '../services/pdfPaginationEngine';
import { generateWhatsAppQuoteMessage } from '../services/quoteWhatsAppService';
import { CurrencyCode, Product, Quotation, QuoteItem } from '../types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function makeTestProduct(params: {
  id: string;
  name: string;
  category: string;
  productType: string;
  currency: CurrencyCode;
  netPrice: number;
  markupPercent?: number;
  taxPercent?: number;
  serviceFeeFixed?: number;
}): Product {
  return {
    id: params.id,
    sku: `SKU-${params.id.toUpperCase()}`,
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    country: 'Japan',
    city: 'Tokyo',
    productType: params.productType,
    name: params.name,
    shortDescription: `${params.name} description`,
    longDescription: `${params.name} detailed description`,
    supplierId: 'sup-test',
    supplierName: 'Test Supplier',
    category: params.category as any,
    subcategory: params.productType,
    adultNetPrice: params.netPrice,
    childNetPrice: 0,
    infantNetPrice: 0,
    currency: params.currency,
    defaultMarkupPercent: params.markupPercent ?? 0,
    b2bAgentMarkupPercent: params.markupPercent ?? 0,
    taxPercent: params.taxPercent ?? 0,
    commissionPercent: 0,
    serviceFeeFixed: params.serviceFeeFixed ?? 0,
    season: 'All Year',
    validityFrom: '2025-01-01',
    validityTo: '2027-12-31',
    minPax: 1,
    maxPax: 20,
    availability: 'INSTANT',
    inclusions: ['Included'],
    exclusions: ['Excluded'],
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',
    galleryImages: [],
    status: 'ACTIVE'
  } as unknown as Product;
}

function makeQuoteItem(product: Product, targetCurrency: CurrencyCode, adults = 1): QuoteItem {
  const calculation = calculateProductPrice(product, {
    productId: product.id,
    pricingTier: 'B2B',
    adults,
    children: 0,
    infants: 0,
    travelDate: '2026-05-10',
    targetCurrency,
    selectedAddonIds: []
  });

  return {
    id: `item-${product.id}`,
    product,
    pax: { adults, children: 0, infants: 0 },
    travelDate: '2026-05-10',
    selectedAddonIds: [],
    calculation
  };
}

function buildFullSavedQuotation(params: {
  id: string;
  items: QuoteItem[];
  currency: CurrencyCode;
  adminManualMarginType?: 'PERCENTAGE' | 'FIXED';
  adminManualMarginValue?: number;
  adminMarginMode?: 'ADD' | 'REPLACE';
  agentMarginType?: 'PERCENTAGE' | 'FIXED';
  agentMarginValue?: number;
  brandingMode?: 'STANDARD' | 'WHITE_LABEL';
}): Quotation {
  const snapshot = buildQuotationCurrencySnapshot({
    quoteId: params.id,
    quoteVersion: 1,
    items: params.items,
    targetCurrency: params.currency,
    scope: 'HOTEL_LAND',
    routeHubs: [
      { id: 'hub-tokyo', hubId: 'tokyo', hubName: 'Tokyo', nights: 3, order: 1 }
    ],
    userRole: 'ADMIN',
    adminManualMarginType: params.adminManualMarginType ?? 'PERCENTAGE',
    adminManualMarginValue: params.adminManualMarginValue ?? 0,
    adminMarginMode: params.adminMarginMode ?? 'ADD',
    agentMarginType: params.agentMarginType ?? 'PERCENTAGE',
    agentMarginValue: params.agentMarginValue ?? 0,
    overallDiscountPercent: 0
  });

  return {
    id: params.id,
    quoteNumber: `QTE-2026-${params.id.toUpperCase()}`,
    version: 1,
    title: `Audit Quotation ${params.id}`,
    clientName: 'Kenji & Mei Sato',
    clientEmail: 'sato@example.com',
    clientCompany: 'Sato Executive Travel',
    agentId: 'usr-agent-01',
    agentName: 'Yuki Tanaka',
    agentAgency: 'Apex Bespoke Journeys',
    agentEmail: 'yuki@apexjourneys.com',
    agentPhone: '+81-3-5555-0199',
    destination: 'Japan',
    travelStartDate: '2026-05-10',
    travelEndDate: '2026-05-13',
    quotationScope: 'HOTEL_LAND',
    routeHubs: [
      { id: 'hub-tokyo', hubId: 'tokyo', hubName: 'Tokyo', nights: 3, order: 1 }
    ],
    currency: params.currency,
    items: params.items,
    overallDiscountPercent: 0,
    agentNotes: 'Standard B2B terms apply.',
    termsAndConditions: 'Standard booking terms and conditions.',
    status: 'SENT',
    createdAt: snapshot.capturedAt,
    updatedAt: snapshot.capturedAt,
    validUntil: '2026-05-24',
    totalNetCost: snapshot.totalConvertedNettCost,
    baseFinalSellingPrice: snapshot.manualMarginAdjustedTotal,
    agentMarginType: params.agentMarginType ?? 'PERCENTAGE',
    agentMarginValue: params.agentMarginValue ?? 0,
    agentMarginAmount: snapshot.additionalAgentMarginAmount,
    finalCustomerSellingPrice: snapshot.finalCustomerSellingPrice,
    totalSellingPrice: snapshot.finalCustomerSellingPrice,
    totalTaxes: snapshot.taxAmount,
    totalMargin: roundCurrencyAmount(
      snapshot.existingBaseMarginAmount + snapshot.manualMarginAdjustmentAmount + snapshot.additionalAgentMarginAmount,
      params.currency
    ),
    adminManualMarginType: params.adminManualMarginType ?? 'PERCENTAGE',
    adminManualMarginValue: params.adminManualMarginValue ?? 0,
    adminMarginMode: params.adminMarginMode ?? 'ADD',
    brandingMode: params.brandingMode ?? 'STANDARD',
    brandingSnapshot: {
      mode: params.brandingMode ?? 'STANDARD',
      agencyName: 'Apex Bespoke Journeys',
      agentName: 'Yuki Tanaka',
      email: 'yuki@apexjourneys.com',
      phone: '+81-3-5555-0199',
      capturedAt: snapshot.capturedAt
    },
    currencyConversionSnapshot: snapshot,
    pricingSnapshot: {
      baseFinalSellingPrice: snapshot.manualMarginAdjustedTotal,
      currency: params.currency,
      agentMarginType: params.agentMarginType ?? 'PERCENTAGE',
      agentMarginValue: params.agentMarginValue ?? 0,
      agentMarginAmount: snapshot.additionalAgentMarginAmount,
      finalCustomerSellingPrice: snapshot.finalCustomerSellingPrice,
      hotelAccommodationTotal: snapshot.hotelAccommodationTotal,
      landPartTotal: snapshot.landPartTotal,
      calculatedAt: snapshot.capturedAt,
      pricingVersion: 1,
      itemsCount: params.items.length,
      totalPax: 2,
      adminManualMarginType: params.adminManualMarginType ?? 'PERCENTAGE',
      adminManualMarginValue: params.adminManualMarginValue ?? 0,
      adminMarginMode: params.adminMarginMode ?? 'ADD',
      revisedSellingPrice: snapshot.manualMarginAdjustedTotal,
      currencyConversionSnapshot: snapshot
    }
  };
}

function verifyCrossChannelReconciliation(quote: Quotation, label: string): void {
  const snap = quote.currencyConversionSnapshot!;
  const expectedHotelFormatted = formatCurrency(snap.hotelAccommodationTotal, quote.currency);
  const expectedLandFormatted = formatCurrency(snap.landPartTotal, quote.currency);
  const expectedFinalFormatted = formatCurrency(snap.finalCustomerSellingPrice, quote.currency);

  // 1. Presentation Model (used by Proposal View, PDF, Email, WhatsApp)
  const model = buildQuotePresentationModel(quote);
  assert(
    model.currency === quote.currency,
    `[${label}] Presentation model currency mismatch: expected ${quote.currency}, got ${model.currency}`
  );
  assert(
    model.hotelAccommodationTotalNumeric === snap.hotelAccommodationTotal,
    `[${label}] Hotel total numeric mismatch: expected ${snap.hotelAccommodationTotal}, got ${model.hotelAccommodationTotalNumeric}`
  );
  assert(
    model.landPartTotalNumeric === snap.landPartTotal,
    `[${label}] Land total numeric mismatch: expected ${snap.landPartTotal}, got ${model.landPartTotalNumeric}`
  );
  assert(
    model.finalCustomerSellingPriceNumeric === snap.finalCustomerSellingPrice,
    `[${label}] Final customer selling price numeric mismatch: expected ${snap.finalCustomerSellingPrice}, got ${model.finalCustomerSellingPriceNumeric}`
  );
  if (snap.hotelAccommodationTotal > 0) {
    assert(
      model.hotelAccommodationTotalFormatted === expectedHotelFormatted,
      `[${label}] Hotel formatted mismatch: expected ${expectedHotelFormatted}, got ${model.hotelAccommodationTotalFormatted}`
    );
  } else {
    assert(
      model.hasHotelAccommodation === false,
      `[${label}] Expected hasHotelAccommodation=false when hotel total is 0`
    );
  }
  assert(
    model.landPartTotalFormatted === expectedLandFormatted,
    `[${label}] Land formatted mismatch: expected ${expectedLandFormatted}, got ${model.landPartTotalFormatted}`
  );
  assert(
    model.finalCustomerSellingPriceFormatted === expectedFinalFormatted,
    `[${label}] Final formatted mismatch: expected ${expectedFinalFormatted}, got ${model.finalCustomerSellingPriceFormatted}`
  );

  // 2. PDF Semantic Blocks
  const pdfBlocks = buildSemanticBlocks(model);
  const tariffBlock = pdfBlocks.find(b => b.id === 'block-tariff' || b.type === 'TARIFF_CONTAINER');
  assert(Boolean(tariffBlock), `[${label}] PDF tariff-container block missing`);
  assert(
    tariffBlock!.html.includes(expectedFinalFormatted),
    `[${label}] PDF tariff block does not contain Final Selling Price ${expectedFinalFormatted}`
  );
  assert(
    tariffBlock!.html.includes(expectedLandFormatted),
    `[${label}] PDF tariff block does not contain Land Part Total ${expectedLandFormatted}`
  );

  // 3. Email HTML & Plain Text
  const emailOutput = renderQuoteEmailFromPresentationModel(model);
  assert(
    emailOutput.proposalViewHtml.includes(expectedFinalFormatted),
    `[${label}] Email proposalViewHtml missing Final Selling Price ${expectedFinalFormatted}`
  );
  assert(
    emailOutput.textBody.includes(expectedFinalFormatted),
    `[${label}] Email textBody missing Final Selling Price ${expectedFinalFormatted}`
  );

  // 4. WhatsApp Message
  const waMessage = generateWhatsAppQuoteMessage({ quote });
  assert(
    waMessage.includes(expectedFinalFormatted),
    `[${label}] WhatsApp message missing Final Selling Price ${expectedFinalFormatted}`
  );
  assert(
    waMessage.includes(expectedLandFormatted),
    `[${label}] WhatsApp message missing Land Part Total ${expectedLandFormatted}`
  );
}

export function runCurrencyConversionAuditTests() {
  const fx = CurrencyEngine.getInstance();
  fx.resetToBaselineRates();

  console.log('================================================================================');
  console.log('EXECUTING MANDATORY CURRENCY CONVERSION AUDIT & RECONCILIATION SUITE (TESTS A-I)');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST A — Same-currency quotation (JPY -> JPY)
  // ---------------------------------------------------------------------------
  {
    const hotel = makeTestProduct({
      id: 'test-a-hotel',
      name: 'Palace Hotel Tokyo',
      category: 'Hotels',
      productType: 'Hotel',
      currency: 'JPY',
      netPrice: 30000,
      markupPercent: 0
    });
    const activity = makeTestProduct({
      id: 'test-a-act',
      name: 'Tokyo Cultural Tour',
      category: 'Sightseeing',
      productType: 'Tour',
      currency: 'JPY',
      netPrice: 12000,
      markupPercent: 0
    });
    const transfer = makeTestProduct({
      id: 'test-a-trf',
      name: 'Haneda Private Chauffeur',
      category: 'Transfers',
      productType: 'Transfer',
      currency: 'JPY',
      netPrice: 8000,
      markupPercent: 0
    });

    const items = [
      makeQuoteItem(hotel, 'JPY'),
      makeQuoteItem(activity, 'JPY'),
      makeQuoteItem(transfer, 'JPY')
    ];

    items.forEach(it => {
      assert(it.calculation?.fxDetails.effectiveRate === 1.0, 'Test A: JPY->JPY rate must be 1.0');
      assert(it.calculation?.fxDetails.isConverted === false, 'Test A: JPY->JPY must skip conversion');
      assert(it.calculation?.fxDetails.isValid === true, 'Test A: JPY->JPY must be valid');
    });

    const quote = buildFullSavedQuotation({
      id: 'test-a',
      items,
      currency: 'JPY'
    });

    assert(quote.currencyConversionSnapshot!.hotelAccommodationTotal === 30000, `Test A: Hotel total expected 30000, got ${quote.currencyConversionSnapshot!.hotelAccommodationTotal}`);
    assert(quote.currencyConversionSnapshot!.landPartTotal === 20000, `Test A: Land total expected 20000, got ${quote.currencyConversionSnapshot!.landPartTotal}`);
    assert(quote.currencyConversionSnapshot!.finalCustomerSellingPrice === 50000, `Test A: Base total expected 50000, got ${quote.currencyConversionSnapshot!.finalCustomerSellingPrice}`);
    verifyCrossChannelReconciliation(quote, 'Test A (Same-Currency JPY->JPY)');
    console.log('✅ TEST A PASSED — Same-Currency (JPY -> JPY): Hotel ¥30,000 + Activity ¥12,000 + Transfer ¥8,000 = ¥50,000 (rate = 1, conversion skipped)');
  }

  // ---------------------------------------------------------------------------
  // TEST B — Single-currency conversion (USD -> JPY @ 150)
  // ---------------------------------------------------------------------------
  {
    fx.setExchangeRate('USD', 'JPY', 150);
    const usdProduct = makeTestProduct({
      id: 'test-b-act',
      name: 'Private Mt. Fuji Helicopter Charter',
      category: 'Sightseeing',
      productType: 'Tour',
      currency: 'USD',
      netPrice: 200,
      markupPercent: 0
    });

    const items = [makeQuoteItem(usdProduct, 'JPY')];
    const quote = buildFullSavedQuotation({
      id: 'test-b',
      items,
      currency: 'JPY'
    });

    assert(items[0].calculation?.fxDetails.effectiveRate === 150, 'Test B: Applied rate must be 150');
    assert(items[0].calculation?.finalTotalSellingPrice === 30000, `Test B: Expected JPY 30,000, got ${items[0].calculation?.finalTotalSellingPrice}`);
    assert(quote.currencyConversionSnapshot!.finalCustomerSellingPrice === 30000, 'Test B: Snapshot final total must be JPY 30,000');
    verifyCrossChannelReconciliation(quote, 'Test B (USD 200 -> JPY 30,000 @ 150)');
    console.log('✅ TEST B PASSED — Single-Currency Conversion (USD -> JPY @ 150): USD 200 -> ¥30,000 across Builder, Snapshot, PDF, Email, WhatsApp');
  }

  // ---------------------------------------------------------------------------
  // TEST C — Single-currency conversion (JPY -> USD @ 0.0066666667)
  // ---------------------------------------------------------------------------
  {
    fx.setExchangeRate('JPY', 'USD', 0.0066666667);
    const jpyProduct = makeTestProduct({
      id: 'test-c-act',
      name: 'Kyoto Geisha Kaiseki Evening',
      category: 'Experiences',
      productType: 'Culture',
      currency: 'JPY',
      netPrice: 45000,
      markupPercent: 0
    });

    const items = [makeQuoteItem(jpyProduct, 'USD')];
    const quote = buildFullSavedQuotation({
      id: 'test-c',
      items,
      currency: 'USD'
    });

    assert(items[0].calculation?.finalTotalSellingPrice === 300.00, `Test C: Expected USD 300.00, got ${items[0].calculation?.finalTotalSellingPrice}`);
    assert(quote.currencyConversionSnapshot!.finalCustomerSellingPrice === 300.00, 'Test C: Snapshot final total must be USD 300.00');
    verifyCrossChannelReconciliation(quote, 'Test C (JPY 45,000 -> USD 300.00 @ 0.0066666667)');
    console.log('✅ TEST C PASSED — Single-Currency Conversion (JPY -> USD @ 0.0066666667): JPY 45,000 -> $300.00 across Builder, Snapshot, PDF, Email, WhatsApp');
  }

  // ---------------------------------------------------------------------------
  // TEST D — Multi-currency quotation (JPY + USD -> JPY @ 150)
  // ---------------------------------------------------------------------------
  {
    fx.setExchangeRate('USD', 'JPY', 150);
    const hotel1 = makeTestProduct({
      id: 'test-d-hotel',
      name: 'Aman Tokyo',
      category: 'Hotels',
      productType: 'Hotel',
      currency: 'JPY',
      netPrice: 30000,
      markupPercent: 0
    });
    const activity1 = makeTestProduct({
      id: 'test-d-act',
      name: 'TeamLab VIP Private Access',
      category: 'Sightseeing',
      productType: 'Tour',
      currency: 'USD',
      netPrice: 100,
      markupPercent: 0
    });
    const transfer1 = makeTestProduct({
      id: 'test-d-trf',
      name: 'Alphard Executive Transfer',
      category: 'Transfers',
      productType: 'Transfer',
      currency: 'JPY',
      netPrice: 10000,
      markupPercent: 0
    });
    const rail1 = makeTestProduct({
      id: 'test-d-rail',
      name: 'Nozomi Shinkansen Green Car',
      category: 'Rail',
      productType: 'Rail',
      currency: 'USD',
      netPrice: 50,
      markupPercent: 0
    });

    const items = [
      makeQuoteItem(hotel1, 'JPY'),
      makeQuoteItem(activity1, 'JPY'),
      makeQuoteItem(transfer1, 'JPY'),
      makeQuoteItem(rail1, 'JPY')
    ];

    assert(items[0].calculation?.finalTotalSellingPrice === 30000, 'Test D: Hotel 1 must be JPY 30,000');
    assert(items[1].calculation?.finalTotalSellingPrice === 15000, 'Test D: Activity 1 (USD 100 @ 150) must be JPY 15,000');
    assert(items[2].calculation?.finalTotalSellingPrice === 10000, 'Test D: Transfer 1 must be JPY 10,000');
    assert(items[3].calculation?.finalTotalSellingPrice === 7500, 'Test D: Rail 1 (USD 50 @ 150) must be JPY 7,500');

    const quote = buildFullSavedQuotation({
      id: 'test-d',
      items,
      currency: 'JPY'
    });

    assert(quote.currencyConversionSnapshot!.totalConvertedNettCost === 62500, `Test D: Converted base total expected 62500, got ${quote.currencyConversionSnapshot!.totalConvertedNettCost}`);
    assert(quote.currencyConversionSnapshot!.hotelAccommodationTotal === 30000, 'Test D: Hotel total must be 30,000');
    assert(quote.currencyConversionSnapshot!.landPartTotal === 32500, 'Test D: Land total must be 32,500');
    assert(quote.currencyConversionSnapshot!.finalCustomerSellingPrice === 62500, 'Test D: Final total must be 62,500');
    verifyCrossChannelReconciliation(quote, 'Test D (Multi-Currency -> JPY 62,500)');
    console.log('✅ TEST D PASSED — Multi-Currency Quotation (JPY + USD -> JPY @ 150): ¥30,000 + ¥15,000 + ¥10,000 + ¥7,500 = ¥62,500 across all outputs');
  }

  // ---------------------------------------------------------------------------
  // TEST E — Margin calculation consistency (Base, ADD, REPLACE, Additional Agent Margin)
  // ---------------------------------------------------------------------------
  {
    fx.setExchangeRate('USD', 'JPY', 150);
    // Base nett = USD 200 -> JPY 30,000; Base markup = 20% (+JPY 6,000) -> Base B2B Selling = JPY 36,000
    const hotel = makeTestProduct({
      id: 'test-e-hotel',
      name: 'Ritz-Carlton Kyoto',
      category: 'Hotels',
      productType: 'Hotel',
      currency: 'USD',
      netPrice: 200,
      markupPercent: 20
    });
    // Base nett = JPY 20,000; Base markup = 20% (+JPY 4,000) -> Base B2B Selling = JPY 24,000
    const land = makeTestProduct({
      id: 'test-e-land',
      name: 'Arashiyama Private Rickshaw & Bamboo Tour',
      category: 'Sightseeing',
      productType: 'Tour',
      currency: 'JPY',
      netPrice: 20000,
      markupPercent: 20
    });

    const items = [makeQuoteItem(hotel, 'JPY'), makeQuoteItem(land, 'JPY')];
    // Total Converted Nett = 30,000 + 20,000 = 50,000 JPY
    // Existing Base Margin (20%) = 6,000 + 4,000 = 10,000 JPY
    // Base Selling Price = 60,000 JPY (Hotel 36,000 + Land 24,000)

    // E1: Base margin only
    const quoteE1 = buildFullSavedQuotation({
      id: 'test-e1',
      items,
      currency: 'JPY',
      adminManualMarginType: 'PERCENTAGE',
      adminManualMarginValue: 0,
      adminMarginMode: 'ADD',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 0
    });
    assert(quoteE1.currencyConversionSnapshot!.totalConvertedNettCost === 50000, 'Test E1: Nett must be 50,000');
    assert(quoteE1.currencyConversionSnapshot!.existingBaseMarginAmount === 10000, 'Test E1: Base margin must be 10,000');
    assert(quoteE1.currencyConversionSnapshot!.finalCustomerSellingPrice === 60000, 'Test E1: Selling must be 60,000');
    verifyCrossChannelReconciliation(quoteE1, 'Test E1 (Base Margin Only)');

    // E2: Manual Margin Adjustment — Add to Existing Margin (+10% on Nett 50,000 = +5,000 -> Stage 1 Total = 65,000)
    const quoteE2 = buildFullSavedQuotation({
      id: 'test-e2',
      items,
      currency: 'JPY',
      adminManualMarginType: 'PERCENTAGE',
      adminManualMarginValue: 10,
      adminMarginMode: 'ADD',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 0
    });
    assert(quoteE2.currencyConversionSnapshot!.manualMarginAdjustmentAmount === 5000, 'Test E2: Manual margin must be 5,000');
    assert(quoteE2.currencyConversionSnapshot!.manualMarginAdjustedTotal === 65000, 'Test E2: Stage 1 total must be 65,000');
    assert(quoteE2.currencyConversionSnapshot!.finalCustomerSellingPrice === 65000, 'Test E2: Final total must be 65,000');
    verifyCrossChannelReconciliation(quoteE2, 'Test E2 (Manual Margin ADD +10%)');

    // E3: Manual Margin Adjustment — Replace Base Margin (15% on Nett 50,000 = +7,500 -> Stage 1 Total = 57,500)
    const quoteE3 = buildFullSavedQuotation({
      id: 'test-e3',
      items,
      currency: 'JPY',
      adminManualMarginType: 'PERCENTAGE',
      adminManualMarginValue: 15,
      adminMarginMode: 'REPLACE',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 0
    });
    assert(quoteE3.currencyConversionSnapshot!.manualMarginAdjustmentAmount === 7500, 'Test E3: Replacement margin must be 7,500');
    assert(quoteE3.currencyConversionSnapshot!.manualMarginAdjustedTotal === 57500, 'Test E3: Stage 1 total must be 57,500');
    assert(quoteE3.currencyConversionSnapshot!.finalCustomerSellingPrice === 57500, 'Test E3: Final total must be 57,500');
    verifyCrossChannelReconciliation(quoteE3, 'Test E3 (Manual Margin REPLACE 15%)');

    // E4: Additional Agent Margin (+10% on Stage 1 ADD total 65,000 = +6,500 -> Final Customer Selling Price = 71,500)
    const quoteE4 = buildFullSavedQuotation({
      id: 'test-e4',
      items,
      currency: 'JPY',
      adminManualMarginType: 'PERCENTAGE',
      adminManualMarginValue: 10,
      adminMarginMode: 'ADD',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10
    });
    assert(quoteE4.currencyConversionSnapshot!.manualMarginAdjustedTotal === 65000, 'Test E4: Stage 1 total must be 65,000');
    assert(quoteE4.currencyConversionSnapshot!.additionalAgentMarginAmount === 6500, 'Test E4: Agent margin on Stage 1 total must be 6,500');
    assert(quoteE4.currencyConversionSnapshot!.finalCustomerSellingPrice === 71500, 'Test E4: Final customer selling price must be 71,500');
    assert(
      quoteE4.currencyConversionSnapshot!.hotelAccommodationTotal + quoteE4.currencyConversionSnapshot!.landPartTotal === 71500,
      'Test E4: Hotel + Land totals must reconcile to 71,500'
    );
    verifyCrossChannelReconciliation(quoteE4, 'Test E4 (Stage 1 ADD + Stage 2 Agent Margin)');
    console.log('✅ TEST E PASSED — Margin Calculation Consistency: Base=¥60,000, ADD(+10%)=¥65,000, REPLACE(15%)=¥57,500, +Agent(10%)=¥71,500');
  }

  // ---------------------------------------------------------------------------
  // TEST F — Missing exchange rate handling (No silent fallback to 1)
  // ---------------------------------------------------------------------------
  {
    fx.setPairAvailability('USD', 'JPY', false);
    const validation = fx.validateConversion('USD', 'JPY');
    assert(validation.isValid === false, 'Test F: Paused USD->JPY pair must fail validation');
    assert(validation.effectiveRate === 0, 'Test F: Missing rate must NEVER assume an exchange rate of 1');
    assert(Boolean(validation.error && validation.error.includes('USD -> JPY')), 'Test F: Error must identify missing USD -> JPY pair');

    const usdProduct = makeTestProduct({
      id: 'test-f-prod',
      name: 'Missing Rate Test Product',
      category: 'Sightseeing',
      productType: 'Tour',
      currency: 'USD',
      netPrice: 250,
      markupPercent: 20
    });

    const item = makeQuoteItem(usdProduct, 'JPY');
    assert(item.calculation?.fxDetails.isValid === false, 'Test F: Item calculation fxDetails.isValid must be false');
    assert(item.calculation?.finalTotalSellingPrice === 0, 'Test F: Item with missing FX rate must not silently retain USD 250 as JPY 250');

    const breakdown = calculateQuoteInternalBreakdown({
      items: [item],
      targetCurrency: 'JPY',
      userRole: 'ADMIN'
    });
    assert(breakdown.isComplete === false, 'Test F: Breakdown must be marked incomplete when FX rate is missing');
    assert((breakdown.missingCurrencyPairs || []).includes('USD -> JPY'), 'Test F: Breakdown must list USD -> JPY in missingCurrencyPairs');

    // Restore pair availability
    fx.resetToBaselineRates();
    console.log('✅ TEST F PASSED — Missing Exchange Rate Handling: Never assumes rate=1, flags missing pair (USD -> JPY), blocks final quote generation');
  }

  // ---------------------------------------------------------------------------
  // TEST G — Historical quotation protection
  // ---------------------------------------------------------------------------
  {
    fx.setExchangeRate('USD', 'JPY', 150);
    const usdHotel = makeTestProduct({
      id: 'test-g-hotel',
      name: 'Park Hyatt Tokyo',
      category: 'Hotels',
      productType: 'Hotel',
      currency: 'USD',
      netPrice: 400,
      markupPercent: 0
    });
    const usdTour = makeTestProduct({
      id: 'test-g-tour',
      name: 'Private Tsukiji Culinary Walk',
      category: 'Sightseeing',
      productType: 'Tour',
      currency: 'USD',
      netPrice: 200,
      markupPercent: 0
    });

    const itemsAt150 = [makeQuoteItem(usdHotel, 'JPY'), makeQuoteItem(usdTour, 'JPY')];
    const finalizedQuote = buildFullSavedQuotation({
      id: 'test-g-hist',
      items: itemsAt150,
      currency: 'JPY'
    });
    // At rate 150: Hotel = JPY 60,000, Land = JPY 30,000, Total = JPY 90,000
    assert(finalizedQuote.currencyConversionSnapshot!.finalCustomerSellingPrice === 90000, 'Test G: Initial finalized total must be JPY 90,000');

    // Now update global FX rate to USD -> JPY = 160
    fx.setExchangeRate('USD', 'JPY', 160);

    // Re-evaluate historical quote via calculateQuoteTotal and buildQuotePresentationModel (used by PDF, Email, WhatsApp)
    const historicalTotalEval = calculateQuoteTotal(finalizedQuote);
    assert(historicalTotalEval.totalSellingPrice === 90000, `Test G: Historical quote total must remain 90000 after FX change to 160, got ${historicalTotalEval.totalSellingPrice}`);
    assert(
      finalizedQuote.currencyConversionSnapshot!.lineItems[0].appliedExchangeRate === 150,
      'Test G: Historical snapshot exchange rate must remain 150'
    );
    verifyCrossChannelReconciliation(finalizedQuote, 'Test G (Historical Quote Protected at 150 when Global FX=160)');
    console.log('✅ TEST G PASSED — Historical Quotation Protection: Finalized quote at USD->JPY=150 retains ¥90,000 across PDF, Email, WhatsApp after global FX updates to 160');
  }

  // ---------------------------------------------------------------------------
  // TEST H — Currency switching in Quote Builder (JPY -> USD -> JPY)
  // ---------------------------------------------------------------------------
  {
    fx.setExchangeRate('USD', 'JPY', 150);
    fx.setExchangeRate('JPY', 'USD', 0.0066666667);

    const jpyHotel = makeTestProduct({
      id: 'test-h-hotel',
      name: 'Hoshinoya Tokyo',
      category: 'Hotels',
      productType: 'Hotel',
      currency: 'JPY',
      netPrice: 45000,
      markupPercent: 20
    });
    const usdActivity = makeTestProduct({
      id: 'test-h-act',
      name: 'Hakone Private Lake Cruise',
      category: 'Sightseeing',
      productType: 'Tour',
      currency: 'USD',
      netPrice: 100,
      markupPercent: 20
    });

    // Step 1: Initial calculation in JPY
    const itemsInitialJPY = [makeQuoteItem(jpyHotel, 'JPY'), makeQuoteItem(usdActivity, 'JPY')];
    const snapInitialJPY = buildQuotationCurrencySnapshot({
      quoteId: 'test-h',
      quoteVersion: 1,
      items: itemsInitialJPY,
      targetCurrency: 'JPY',
      userRole: 'ADMIN'
    });

    // Step 2: Switch Quote Builder currency to USD
    const itemsSwitchedUSD = [makeQuoteItem(jpyHotel, 'USD'), makeQuoteItem(usdActivity, 'USD')];
    const snapSwitchedUSD = buildQuotationCurrencySnapshot({
      quoteId: 'test-h',
      quoteVersion: 1,
      items: itemsSwitchedUSD,
      targetCurrency: 'USD',
      userRole: 'ADMIN'
    });
    // Hotel: JPY 45,000 -> USD 300.00 + 20% = USD 360.00
    // Activity: USD 100.00 + 20% = USD 120.00
    // Total in USD = USD 480.00
    assert(snapSwitchedUSD.finalCustomerSellingPrice === 480.00, `Test H: USD total expected 480.00, got ${snapSwitchedUSD.finalCustomerSellingPrice}`);

    // Step 3: Switch Quote Builder currency back to JPY
    const itemsReturnedJPY = [makeQuoteItem(jpyHotel, 'JPY'), makeQuoteItem(usdActivity, 'JPY')];
    const snapReturnedJPY = buildQuotationCurrencySnapshot({
      quoteId: 'test-h',
      quoteVersion: 1,
      items: itemsReturnedJPY,
      targetCurrency: 'JPY',
      userRole: 'ADMIN'
    });

    // Must return to exact original JPY values with zero cumulative rounding drift
    assert(
      snapReturnedJPY.hotelAccommodationTotal === snapInitialJPY.hotelAccommodationTotal &&
      snapReturnedJPY.landPartTotal === snapInitialJPY.landPartTotal &&
      snapReturnedJPY.finalCustomerSellingPrice === snapInitialJPY.finalCustomerSellingPrice,
      `Test H: JPY->USD->JPY drift detected! Initial=${snapInitialJPY.finalCustomerSellingPrice}, Returned=${snapReturnedJPY.finalCustomerSellingPrice}`
    );
    console.log(`✅ TEST H PASSED — Currency Switching (JPY -> USD -> JPY): ¥${snapInitialJPY.finalCustomerSellingPrice.toLocaleString()} -> $${snapSwitchedUSD.finalCustomerSellingPrice.toFixed(2)} -> ¥${snapReturnedJPY.finalCustomerSellingPrice.toLocaleString()} (Zero cumulative rounding drift)`);
  }

  // ---------------------------------------------------------------------------
  // TEST I — White-label quotation currency consistency
  // ---------------------------------------------------------------------------
  {
    fx.setExchangeRate('USD', 'JPY', 150);
    const hotel = makeTestProduct({
      id: 'test-i-hotel',
      name: 'Mandarin Oriental Tokyo',
      category: 'Hotels',
      productType: 'Hotel',
      currency: 'JPY',
      netPrice: 30000,
      markupPercent: 10
    });
    const tour = makeTestProduct({
      id: 'test-i-tour',
      name: 'Nikko World Heritage Private Excursion',
      category: 'Sightseeing',
      productType: 'Tour',
      currency: 'USD',
      netPrice: 100,
      markupPercent: 10
    });

    const items = [makeQuoteItem(hotel, 'JPY'), makeQuoteItem(tour, 'JPY')];
    const standardQuote = buildFullSavedQuotation({
      id: 'test-i-std',
      items,
      currency: 'JPY',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10,
      brandingMode: 'STANDARD'
    });
    const whiteLabelQuote = buildFullSavedQuotation({
      id: 'test-i-wl',
      items,
      currency: 'JPY',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10,
      brandingMode: 'WHITE_LABEL'
    });

    const stdModel = buildQuotePresentationModel(standardQuote);
    const wlModel = buildQuotePresentationModel(whiteLabelQuote);

    assert(stdModel.finalCustomerSellingPriceFormatted === wlModel.finalCustomerSellingPriceFormatted, 'Test I: Standard vs White-Label Final Selling Price must be identical');
    assert(stdModel.hotelAccommodationTotalFormatted === wlModel.hotelAccommodationTotalFormatted, 'Test I: Standard vs White-Label Hotel Total must be identical');
    assert(stdModel.landPartTotalFormatted === wlModel.landPartTotalFormatted, 'Test I: Standard vs White-Label Land Total must be identical');

    verifyCrossChannelReconciliation(standardQuote, 'Test I (Standard Mode)');
    verifyCrossChannelReconciliation(whiteLabelQuote, 'Test I (White-Label Mode)');
    console.log(`✅ TEST I PASSED — White-Label Currency Consistency: Standard & White-Label outputs match 100% (${wlModel.finalCustomerSellingPriceFormatted})`);
  }

  fx.resetToBaselineRates();
  console.log('\n================================================================================');
  console.log('ALL 9 MANDATORY TESTS (A-I) & CROSS-CHANNEL RECONCILIATION CHECKS PASSED 100%');
  console.log('================================================================================');
}

runCurrencyConversionAuditTests();
