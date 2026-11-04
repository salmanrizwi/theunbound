import { AppDatabase } from '../services/db';
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
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel,
  validateQuotePresentationCompleteness
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import { EmailNotificationService } from '../services/emailNotificationService';
import { generateWhatsAppQuoteMessage } from '../services/quoteWhatsAppService';
import { sanitizeQuoteForAgent } from '../utils/customerQuoteSanitizer';
import { Product, Quotation, QuoteItem, User } from '../types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function createTestProduct(overrides: Partial<Product> & { id: string; name: string; adultNetPrice: number; defaultMarkupPercent: number }): Product {
  return {
    sku: `SKU-${overrides.id}`,
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    country: 'Japan',
    city: 'Tokyo',
    productType: 'Guided Tour',
    shortDescription: 'Curated luxury ground service',
    longDescription: 'Full day private cultural experience with licensed guide.',
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
    currency: 'USD',
    nativeCurrency: 'USD',
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
    inclusions: ['Private vehicle', 'English speaking guide'],
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

function buildFullQuoteForScenario(params: {
  quoteId: string;
  quoteNumber: string;
  items: QuoteItem[];
  currency: 'USD' | 'INR' | 'JPY';
  productLevelMarginEnabled: boolean;
  agentLevelMarginPercent: number;
  agentMarginType: 'PERCENTAGE' | 'FIXED';
  agentMarginValue: number;
  overallDiscountPercent?: number;
  brandingMode?: 'STANDARD' | 'WHITE_LABEL';
  isLocked?: boolean;
}): {
  quote: Quotation;
  breakdown: ReturnType<typeof calculateQuoteInternalBreakdown>;
  totals: ReturnType<typeof calculateQuoteTotal>;
} {
  const {
    quoteId,
    quoteNumber,
    items,
    currency,
    productLevelMarginEnabled,
    agentLevelMarginPercent,
    agentMarginType,
    agentMarginValue,
    overallDiscountPercent = 0,
    brandingMode = 'STANDARD',
    isLocked = false
  } = params;

  const breakdown = calculateQuoteInternalBreakdown({
    items,
    targetCurrency: currency,
    productLevelMarginEnabled,
    customAgentMarginPercent: agentLevelMarginPercent,
    agentMarginType,
    agentMarginValue,
    overallDiscountPercent,
    scope: 'HOTEL_LAND'
  });

  const currencyConversionSnapshot = buildQuotationCurrencySnapshot({
    quoteId,
    quoteVersion: 1,
    items,
    targetCurrency: currency,
    scope: 'HOTEL_LAND',
    productLevelMarginEnabled,
    customAgentMarginPercent: agentLevelMarginPercent,
    agentMarginType,
    agentMarginValue,
    overallDiscountPercent
  });

  const theUnboundBase = breakdown.theUnboundBaseSellingPrice;
  const markupAmt = breakdown.partnerMarginAmount;
  const finalCustomerPrice = breakdown.finalPackagePrice;

  const quote: Quotation = {
    id: quoteId,
    quoteNumber,
    version: 1,
    title: 'Tokyo & Kyoto Signature Discovery',
    destination: 'Japan',
    quotationScope: 'HOTEL_LAND',
    scope: 'HOTEL_LAND',
    isLocked,
    items,
    currency,
    overallMarkupPercent: agentMarginType === 'PERCENTAGE' ? agentMarginValue : 0,
    overallDiscountPercent,
    totalNetCost: breakdown.totalNettCost,
    totalSellingPrice: finalCustomerPrice,
    totalTaxes: breakdown.taxAmount,
    totalMargin: breakdown.totalMargin,
    theUnboundBaseSellingPrice: theUnboundBase,
    baseFinalSellingPrice: theUnboundBase,
    base_final_selling_price: theUnboundBase,
    agentMarginType,
    agent_margin_type: agentMarginType,
    agentMarginValue,
    agent_margin_value: agentMarginValue,
    agentMarginAmount: markupAmt,
    agent_margin_amount: markupAmt,
    productLevelAgentMarkupTotal: breakdown.productLevelAgentMarkupTotal,
    overallAgentMarkupAmount: breakdown.overallAgentMarkupAmount,
    totalAgentAdditionalMarkupAmount: markupAmt,
    finalCustomerSellingPrice: finalCustomerPrice,
    final_customer_selling_price: finalCustomerPrice,
    hotelAccommodationTotal: breakdown.hotelAccommodationTotal,
    landPartTotal: breakdown.landPartTotal,
    currencyConversionSnapshot,
    pricingSnapshot: {
      baseFinalSellingPrice: theUnboundBase,
      theUnboundBaseSellingPrice: theUnboundBase,
      currency,
      agentMarginType,
      agentMarginValue,
      agentMarginAmount: markupAmt,
      productLevelAgentMarkupTotal: breakdown.productLevelAgentMarkupTotal,
      overallAgentMarkupAmount: breakdown.overallAgentMarkupAmount,
      totalAgentAdditionalMarkupAmount: markupAmt,
      finalCustomerSellingPrice: finalCustomerPrice,
      hotelAccommodationTotal: breakdown.hotelAccommodationTotal,
      landPartTotal: breakdown.landPartTotal,
      calculatedAt: currencyConversionSnapshot.capturedAt,
      pricingVersion: 1,
      itemsCount: items.length,
      totalPax: 2,
      currencyConversionSnapshot
    },
    clientName: 'Aarav Mehta',
    clientEmail: 'aarav.mehta@example.com',
    clientPhone: '+919876543210',
    clientCompany: 'Horizon Luxury Travels',
    agentId: 'usr-b2b-test-agent',
    agentName: 'Rohan Sharma',
    agentAgency: 'Horizon Luxury Travels',
    agentEmail: 'rohan@horizontravels.in',
    agentPhone: '+919811122233',
    brandingMode,
    brandingSnapshot: {
      mode: brandingMode,
      agencyName: 'Horizon Luxury Travels',
      agentName: 'Rohan Sharma',
      email: 'rohan@horizontravels.in',
      phone: '+919811122233',
      website: 'https://www.horizontravels.in',
      address: 'Nariman Point, Mumbai, India',
      capturedAt: new Date().toISOString()
    },
    status: 'DRAFT',
    travelStartDate: '2026-05-10',
    travelEndDate: '2026-05-14',
    validUntil: '2026-05-01',
    totalPax: 2,
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    routeHubs: [
      {
        id: 'hub-tokyo',
        hubId: 'hub-tokyo',
        order: 1,
        hubName: 'Tokyo',
        destinationId: 'dest-japan',
        destinationName: 'Japan',
        nights: 4,
        accommodationType: 'hotel'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  (quote as any).productLevelMarginEnabled = productLevelMarginEnabled;
  (quote as any).agentLevelMarginPercent = agentLevelMarginPercent;

  const totals = calculateQuoteTotal(quote, undefined, undefined, currency);
  return { quote, breakdown, totals };
}

function verifyAllChannelsMatch(quote: Quotation, expectedBase: number, expectedMarkup: number, expectedFinal: number): void {
  const formattedExpectedFinal = formatCurrency(expectedFinal, quote.currency);
  const formattedExpectedBase = formatCurrency(expectedBase, quote.currency);

  // 1. Central Pricing Engine calculateQuoteTotal
  const centralTotals = calculateQuoteTotal(quote, undefined, undefined, quote.currency);
  assert(
    centralTotals.theUnboundBaseSellingPrice === expectedBase,
    `Central totals theUnboundBaseSellingPrice (${centralTotals.theUnboundBaseSellingPrice}) !== expectedBase (${expectedBase})`
  );
  assert(
    centralTotals.markupAmount === expectedMarkup,
    `Central totals markupAmount (${centralTotals.markupAmount}) !== expectedMarkup (${expectedMarkup})`
  );
  assert(
    centralTotals.finalCustomerSellingPrice === expectedFinal,
    `Central totals finalCustomerSellingPrice (${centralTotals.finalCustomerSellingPrice}) !== expectedFinal (${expectedFinal})`
  );

  // 2. Sanitized Agent Quote
  const sanitized = sanitizeQuoteForAgent(quote);
  assert(
    sanitized.theUnboundBaseSellingPrice === expectedBase,
    `Sanitized quote theUnboundBaseSellingPrice (${sanitized.theUnboundBaseSellingPrice}) !== expectedBase (${expectedBase})`
  );
  assert(
    sanitized.agentMarginAmount === expectedMarkup,
    `Sanitized quote agentMarginAmount (${sanitized.agentMarginAmount}) !== expectedMarkup (${expectedMarkup})`
  );
  assert(
    sanitized.finalCustomerSellingPrice === expectedFinal,
    `Sanitized quote finalCustomerSellingPrice (${sanitized.finalCustomerSellingPrice}) !== expectedFinal (${expectedFinal})`
  );
  assert(
    (sanitized as any).totalNetCost === undefined,
    `Sanitized quote leaked totalNetCost`
  );
  assert(
    (sanitized as any).agentLevelMarginPercent === undefined,
    `Sanitized quote leaked internal agentLevelMarginPercent`
  );

  // 3. Canonical Presentation Model (shared by Quote Preview & PDF)
  const model = buildQuotePresentationModel(quote);
  assert(
    model.baseSellingPriceNumeric === expectedBase,
    `PresentationModel baseSellingPriceNumeric (${model.baseSellingPriceNumeric}) !== expectedBase (${expectedBase})`
  );
  assert(
    model.baseSellingPriceFormatted === formattedExpectedBase,
    `PresentationModel baseSellingPriceFormatted (${model.baseSellingPriceFormatted}) !== (${formattedExpectedBase})`
  );
  assert(
    model.agentMarginAmountNumeric === expectedMarkup,
    `PresentationModel agentMarginAmountNumeric (${model.agentMarginAmountNumeric}) !== expectedMarkup (${expectedMarkup})`
  );
  assert(
    model.finalCustomerSellingPriceNumeric === expectedFinal,
    `PresentationModel finalCustomerSellingPriceNumeric (${model.finalCustomerSellingPriceNumeric}) !== expectedFinal (${expectedFinal})`
  );
  assert(
    model.finalCustomerSellingPriceFormatted === formattedExpectedFinal,
    `PresentationModel finalCustomerSellingPriceFormatted (${model.finalCustomerSellingPriceFormatted}) !== (${formattedExpectedFinal})`
  );

  // 4. PDF Pagination Engine (Download PDF Itinerary blocks)
  const pdfPages = paginateQuotePresentationModel(model);
  const fullPdfHtml = pdfPages.map(p => p.blocks.map(b => b.html).join('\n')).join('\n');
  assert(
    fullPdfHtml.includes(formattedExpectedFinal),
    `PDF Itinerary HTML does not contain expected Final Selling Price ${formattedExpectedFinal}`
  );

  // 5. Complete Quotation Email (Proposal View HTML + Plain Text)
  const emailService = EmailNotificationService.getInstance();
  const canonicalEmail = emailService.buildCanonicalQuotationEmail(quote);
  assert(
    canonicalEmail.proposalViewHtml.includes(formattedExpectedFinal),
    `Complete Quotation Email Proposal HTML does not contain expected Final Selling Price ${formattedExpectedFinal}`
  );
  assert(
    canonicalEmail.simpleSemanticHtml.includes(formattedExpectedFinal),
    `Complete Quotation Email Simple HTML does not contain expected Final Selling Price ${formattedExpectedFinal}`
  );
  assert(
    canonicalEmail.textBody.includes(formattedExpectedFinal),
    `Complete Quotation Email Plain Text does not contain expected Final Selling Price ${formattedExpectedFinal}`
  );

  // 6. Share via WhatsApp
  const whatsAppMsg = generateWhatsAppQuoteMessage({ quote });
  assert(
    whatsAppMsg.includes(formattedExpectedFinal),
    `WhatsApp Quotation Message does not contain expected Final Selling Price ${formattedExpectedFinal}`
  );

  // 7. Channel Completeness Validator
  const completeness = validateQuotePresentationCompleteness(model, canonicalEmail, whatsAppMsg);
  assert(
    completeness.isComplete,
    `Channel completeness failed: EmailHTML missing=[${completeness.missingInEmailHtml.join(',')}], EmailText missing=[${completeness.missingInEmailText.join(',')}], WhatsApp missing=[${completeness.missingInWhatsApp.join(',')}]`
  );
}

async function runAudit(): Promise<void> {
  console.log('================================================================================');
  console.log(' STARTING MARGIN-BASED PRICING & EXPORT SYNCHRONIZATION AUDIT (TESTS A - J)');
  console.log('================================================================================');

  // Create a base product with Nett = 5,000 per adult (2 adults = 10,000 Nett), Product-Level Margin = 15%
  const baseTourProduct = createTestProduct({
    id: 'prod-audit-10k',
    name: 'Tokyo Imperial Private Cultural Tour',
    adultNetPrice: 5000,
    defaultMarkupPercent: 15,
    b2bAgentMarkupPercent: 15,
    currency: 'USD',
    nativeCurrency: 'USD'
  });

  // ============================================================================
  // TEST A: Product-Level Margin ON (15% Product, 10% Agent-Level inactive, 0% Additional Markup)
  // Expected: Nett = 10,000 -> TheUnbound Base Selling Price = 11,500 -> Final = 11,500
  // ============================================================================
  {
    const calcOn = calculateProductPrice(baseTourProduct, {
      productId: baseTourProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-11',
      targetCurrency: 'USD',
      productLevelMarginEnabled: true,
      customAgentMarginPercent: 10
    });
    assert(calcOn.totalNetCost === 10000, `Test A: Net cost expected 10000, got ${calcOn.totalNetCost}`);
    assert(calcOn.finalTotalSellingPrice === 11500, `Test A: Product selling price expected 11500, got ${calcOn.finalTotalSellingPrice}`);

    const itemA: QuoteItem = {
      id: 'item-test-a',
      product: baseTourProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-11',
      calculation: calcOn
    };

    const { quote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-a',
      quoteNumber: 'QT-TEST-A',
      items: [itemA],
      currency: 'USD',
      productLevelMarginEnabled: true,
      agentLevelMarginPercent: 10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 0
    });

    verifyAllChannelsMatch(quote, 11500, 0, 11500);
    console.log('✅ TEST A PASSED: Product-Level Margin ON (15% Product, 0% Agent Markup) => Base=$11,500, Final=$11,500 across Builder, PDF, Email & WhatsApp');
  }

  // ============================================================================
  // TEST B: Product-Level Margin OFF (15% Product inactive, 10% Agent-Level active, 0% Additional Markup)
  // Expected: Nett = 10,000 -> TheUnbound Base Selling Price = 11,000 -> Final = 11,000
  // ============================================================================
  {
    const calcOff = calculateProductPrice(baseTourProduct, {
      productId: baseTourProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-11',
      targetCurrency: 'USD',
      productLevelMarginEnabled: false,
      customAgentMarginPercent: 10
    });
    assert(calcOff.totalNetCost === 10000, `Test B: Net cost expected 10000, got ${calcOff.totalNetCost}`);
    assert(calcOff.finalTotalSellingPrice === 11000, `Test B: Product selling price expected 11000, got ${calcOff.finalTotalSellingPrice}`);

    const itemB: QuoteItem = {
      id: 'item-test-b',
      product: baseTourProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-11',
      calculation: calcOff
    };

    const { quote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-b',
      quoteNumber: 'QT-TEST-B',
      items: [itemB],
      currency: 'USD',
      productLevelMarginEnabled: false,
      agentLevelMarginPercent: 10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 0
    });

    verifyAllChannelsMatch(quote, 11000, 0, 11000);
    console.log('✅ TEST B PASSED: Product-Level Margin OFF (10% Internal Agent-Level Margin, 0% Agent Markup) => Base=$11,000, Final=$11,000 across Builder, PDF, Email & WhatsApp');
  }

  // ============================================================================
  // TEST C: Product-Level Margin ON + Agent Additional Markup (15% Product, 10% Additional Markup)
  // Expected: Nett = 10,000 -> Base = 11,500 -> Agent Additional Markup = 1,150 -> Final = 12,650
  // ============================================================================
  {
    const calcOn = calculateProductPrice(baseTourProduct, {
      productId: baseTourProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-11',
      targetCurrency: 'USD',
      productLevelMarginEnabled: true,
      customAgentMarginPercent: 10
    });

    const itemC: QuoteItem = {
      id: 'item-test-c',
      product: baseTourProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-11',
      calculation: calcOn
    };

    const { quote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-c',
      quoteNumber: 'QT-TEST-C',
      items: [itemC],
      currency: 'USD',
      productLevelMarginEnabled: true,
      agentLevelMarginPercent: 10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10
    });

    verifyAllChannelsMatch(quote, 11500, 1150, 12650);
    console.log('✅ TEST C PASSED: Product-Level Margin ON (15%) + Agent Additional Markup (10%) => Base=$11,500, Markup=$1,150, Final=$12,650 across Builder, PDF, Email & WhatsApp');
  }

  // ============================================================================
  // TEST D: Product-Level Margin OFF + Agent Additional Markup (10% Agent-Level, 10% Additional Markup)
  // Expected: Nett = 10,000 -> Base = 11,000 -> Agent Additional Markup = 1,100 -> Final = 12,100
  // ============================================================================
  {
    const calcOff = calculateProductPrice(baseTourProduct, {
      productId: baseTourProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-11',
      targetCurrency: 'USD',
      productLevelMarginEnabled: false,
      customAgentMarginPercent: 10
    });

    const itemD: QuoteItem = {
      id: 'item-test-d',
      product: baseTourProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-11',
      calculation: calcOff
    };

    const { quote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-d',
      quoteNumber: 'QT-TEST-D',
      items: [itemD],
      currency: 'USD',
      productLevelMarginEnabled: false,
      agentLevelMarginPercent: 10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10
    });

    verifyAllChannelsMatch(quote, 11000, 1100, 12100);
    console.log('✅ TEST D PASSED: Product-Level Margin OFF (10% Internal) + Agent Additional Markup (10%) => Base=$11,000, Markup=$1,100, Final=$12,100 across Builder, PDF, Email & WhatsApp');
  }

  // ============================================================================
  // TEST E: No Double Margin Application (Exclusive Internal Margin + Per-Item vs Overall Markup)
  // ============================================================================
  {
    let doubleMarginBlocked = false;
    try {
      calculateProductPrice(baseTourProduct, {
        productId: baseTourProduct.id,
        adults: 2,
        children: 0,
        infants: 0,
        travelDate: '2026-05-11',
        targetCurrency: 'USD',
        applyProductLevelMargin: true,
        applyAgentLevelMargin: true
      } as any);
    } catch {
      doubleMarginBlocked = true;
    }
    assert(doubleMarginBlocked, 'Test E: Simultaneous Product-Level and Agent-Level margin application must throw error');

    // Also verify that when an item has an item-level additional markup (e.g. $500), overall percentage markup (10%) does NOT double-apply to that already-marked-up item
    const calcItem = calculateProductPrice(baseTourProduct, {
      productId: baseTourProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-11',
      targetCurrency: 'USD',
      productLevelMarginEnabled: true
    });
    const itemWithSpecificMarkup: QuoteItem = {
      id: 'item-specific-markup',
      product: baseTourProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-11',
      calculation: calcItem,
      agentAdditionalMarkupType: 'FIXED',
      agentAdditionalMarkupValue: 500
    };
    const { quote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-e',
      quoteNumber: 'QT-TEST-E',
      items: [itemWithSpecificMarkup],
      currency: 'USD',
      productLevelMarginEnabled: true,
      agentLevelMarginPercent: 10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10
    });
    // Since the only item already has a $500 product-level agent markup, unmarkedItemsStage1Base is 0, so total markup is strictly $500 (Final = $12,000)
    verifyAllChannelsMatch(quote, 11500, 500, 12000);
    console.log('✅ TEST E PASSED: Zero double-margin application enforced across internal and external markup stages');
  }

  // ============================================================================
  // TEST F: Multiple Product Categories (Hotel + Activity + Transfer + Visa)
  // ============================================================================
  {
    const hotelProduct = createTestProduct({
      id: 'prod-hotel-tokyo',
      name: 'Palace Hotel Tokyo (Deluxe King • 4 Nights)',
      category: 'Hotels',
      productType: 'Hotel & Resort',
      adultNetPrice: 4000, // Fixed stay 4 nights = 4,000 Nett
      defaultMarkupPercent: 20,
      b2bAgentMarkupPercent: 20 // Selling = 4,800
    });
    const transferProduct = createTestProduct({
      id: 'prod-trf-narita',
      name: 'Private Narita Airport Executive Alphard Transfer',
      category: 'Transfers',
      productType: 'Private Transfer',
      adultNetPrice: 500, // Per-vehicle charter = 500 Nett
      defaultMarkupPercent: 10,
      b2bAgentMarkupPercent: 10 // Selling = 550
    });
    const visaProduct = createTestProduct({
      id: 'prod-visa-jp',
      name: 'Japan Tourist Visa Facilitation',
      category: 'Travel Services',
      subcategory: 'Visa Facilitation',
      productType: 'Visa Service',
      sku: 'VSA-JP-01',
      adultNetPrice: 100, // 2 adults = 200 Nett
      defaultMarkupPercent: 25,
      b2bAgentMarkupPercent: 25 // Selling = 250
    });

    const itemsF: QuoteItem[] = [
      {
        id: 'it-f-hotel',
        product: hotelProduct,
        hotelId: 'htl-palace-tokyo',
        hubId: 'hub-tokyo',
        nights: 4,
        roomsCount: 1,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-05-10',
        calculation: calculateProductPrice(hotelProduct, {
          productId: hotelProduct.id,
          adults: 2,
          children: 0,
          infants: 0,
          travelDate: '2026-05-10',
          targetCurrency: 'USD',
          productLevelMarginEnabled: true
        })
      },
      {
        id: 'it-f-tour',
        product: baseTourProduct, // Selling = 11,500
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-05-11',
        calculation: calculateProductPrice(baseTourProduct, {
          productId: baseTourProduct.id,
          adults: 2,
          children: 0,
          infants: 0,
          travelDate: '2026-05-11',
          targetCurrency: 'USD',
          productLevelMarginEnabled: true
        })
      },
      {
        id: 'it-f-transfer',
        product: transferProduct, // Selling = 550
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-05-10',
        calculation: calculateProductPrice(transferProduct, {
          productId: transferProduct.id,
          adults: 2,
          children: 0,
          infants: 0,
          travelDate: '2026-05-10',
          targetCurrency: 'USD',
          productLevelMarginEnabled: true
        })
      },
      {
        id: 'it-f-visa',
        product: visaProduct, // Selling = 250
        service_type: 'VISA',
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-05-10',
        calculation: calculateProductPrice(visaProduct, {
          productId: visaProduct.id,
          adults: 2,
          children: 0,
          infants: 0,
          travelDate: '2026-05-10',
          targetCurrency: 'USD',
          productLevelMarginEnabled: true
        })
      }
    ];

    // Total Base = 4,800 (Hotel) + 11,500 (Tour) + 550 (Transfer) + 250 (Visa) = 17,100
    // With 10% Agent Additional Markup = +1,710 => Final = 18,810 (Hotel = 5,280, Land = 13,530)
    const { quote, totals } = buildFullQuoteForScenario({
      quoteId: 'qt-test-f',
      quoteNumber: 'QT-TEST-F',
      items: itemsF,
      currency: 'USD',
      productLevelMarginEnabled: true,
      agentLevelMarginPercent: 10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10
    });

    assert(totals.hotelTotalSellingPrice === 5280, `Test F: Expected hotel total 5280, got ${totals.hotelTotalSellingPrice}`);
    assert(totals.landPartTotalSellingPrice === 13530, `Test F: Expected land total 13530, got ${totals.landPartTotalSellingPrice}`);
    assert(
      totals.hotelTotalSellingPrice + totals.landPartTotalSellingPrice === totals.finalCustomerSellingPrice,
      `Test F: Hotel + Land (${totals.hotelTotalSellingPrice + totals.landPartTotalSellingPrice}) !== Final (${totals.finalCustomerSellingPrice})`
    );
    verifyAllChannelsMatch(quote, 17100, 1710, 18810);
    console.log('✅ TEST F PASSED: Multi-category breakdown (Hotel=$5,280 + Land=$13,530 = Final=$18,810) synchronized across all outputs');
  }

  // ============================================================================
  // TEST G: Multi-Currency Conversion (USD/JPY to INR) via Central FX Engine
  // ============================================================================
  {
    const jpyProduct = createTestProduct({
      id: 'prod-jpy-shinkansen',
      name: 'Nozomi Shinkansen Green Car Reserved (Tokyo to Kyoto)',
      category: 'Rail',
      productType: 'Bullet Train',
      adultNetPrice: 20000, // 2 adults = 40,000 JPY
      defaultMarkupPercent: 15,
      b2bAgentMarkupPercent: 15,
      currency: 'JPY',
      nativeCurrency: 'JPY'
    });

    const calcInr = calculateProductPrice(jpyProduct, {
      productId: jpyProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-12',
      targetCurrency: 'INR',
      productLevelMarginEnabled: true
    });
    assert(calcInr.currency === 'INR', `Test G: Expected currency INR, got ${calcInr.currency}`);
    assert(calcInr.finalTotalSellingPrice > 0, `Test G: Expected positive INR selling price`);

    const itemG: QuoteItem = {
      id: 'it-g-jpy',
      product: jpyProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-12',
      calculation: calcInr
    };

    const expectedBaseInr = calcInr.finalTotalSellingPrice;
    const expectedMarkupInr = roundCurrencyAmount(expectedBaseInr * 0.1, 'INR');
    const expectedFinalInr = roundCurrencyAmount(expectedBaseInr + expectedMarkupInr, 'INR');

    const { quote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-g',
      quoteNumber: 'QT-TEST-G',
      items: [itemG],
      currency: 'INR',
      productLevelMarginEnabled: true,
      agentLevelMarginPercent: 10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10
    });

    verifyAllChannelsMatch(quote, expectedBaseInr, expectedMarkupInr, expectedFinalInr);
    console.log(`✅ TEST G PASSED: Multi-currency JPY -> INR conversion (Base=${formatCurrency(expectedBaseInr, 'INR')}, Final=${formatCurrency(expectedFinalInr, 'INR')}) matches across all channels`);
  }

  // ============================================================================
  // TEST H: Surcharges, Taxes, and Discounts Reconciliation
  // ============================================================================
  {
    const taxedProduct = createTestProduct({
      id: 'prod-taxed',
      name: 'Kyoto Geisha Private Tea Ceremony',
      adultNetPrice: 1000, // 2 adults = 2,000 Nett
      defaultMarkupPercent: 20, // +400 = 2,400
      b2bAgentMarkupPercent: 20,
      taxPercent: 10, // +240 tax = 2,640
      taxMethod: 'on_total',
      taxBase: 'total',
      serviceFeeFixed: 60 // +60 fee = 2,700
    });

    const calcH = calculateProductPrice(taxedProduct, {
      productId: taxedProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-12',
      targetCurrency: 'USD',
      productLevelMarginEnabled: true
    });

    const itemH: QuoteItem = {
      id: 'it-h-taxed',
      product: taxedProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-12',
      calculation: calcH
    };

    // Apply 10% overall discount and $200 fixed agent additional markup
    const preDiscountBase = calcH.finalTotalSellingPrice;
    const discountAmt = roundCurrencyAmount(preDiscountBase * 0.1, 'USD');
    const expectedBaseAfterDiscount = roundCurrencyAmount(preDiscountBase - discountAmt, 'USD');
    const expectedFinalH = roundCurrencyAmount(expectedBaseAfterDiscount + 200, 'USD');

    const { quote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-h',
      quoteNumber: 'QT-TEST-H',
      items: [itemH],
      currency: 'USD',
      productLevelMarginEnabled: true,
      agentLevelMarginPercent: 10,
      agentMarginType: 'FIXED',
      agentMarginValue: 200,
      overallDiscountPercent: 10
    });

    verifyAllChannelsMatch(quote, expectedBaseAfterDiscount, 200, expectedFinalH);
    console.log(`✅ TEST H PASSED: Taxes, service fees, discounts (-$${discountAmt}) and fixed markup (+$200) reconciled to $${expectedFinalH}`);
  }

  // ============================================================================
  // TEST I: Historical Quotation Preservation
  // ============================================================================
  {
    const calcLocked = calculateProductPrice(baseTourProduct, {
      productId: baseTourProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-11',
      targetCurrency: 'USD',
      productLevelMarginEnabled: true
    });
    const itemLocked: QuoteItem = {
      id: 'it-locked',
      product: baseTourProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-11',
      calculation: calcLocked
    };

    const { quote: lockedQuote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-i',
      quoteNumber: 'QT-TEST-I',
      items: [itemLocked],
      currency: 'USD',
      productLevelMarginEnabled: true,
      agentLevelMarginPercent: 10,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10,
      isLocked: true
    });

    // Simulate future change in product margin or agency margin setting on the quote object
    (lockedQuote as any).productLevelMarginEnabled = false;
    (lockedQuote as any).agentLevelMarginPercent = 25;

    // Because lockedQuote has an authoritative currencyConversionSnapshot and isLocked=true, its historical price ($12,650) is preserved
    verifyAllChannelsMatch(lockedQuote, 11500, 1150, 12650);
    console.log('✅ TEST I PASSED: Historical locked quotation snapshot ($12,650) preserved against subsequent margin configuration mutations');
  }

  // ============================================================================
  // TEST J: White-Label vs Standard Quotation Presentation & Confidentiality
  // ============================================================================
  {
    const calcWl = calculateProductPrice(baseTourProduct, {
      productId: baseTourProduct.id,
      adults: 2,
      children: 0,
      infants: 0,
      travelDate: '2026-05-11',
      targetCurrency: 'USD',
      productLevelMarginEnabled: false,
      customAgentMarginPercent: 12 // 12% internal agent-level margin -> Base = $11,200
    });
    const itemWl: QuoteItem = {
      id: 'it-wl',
      product: baseTourProduct,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-05-11',
      calculation: calcWl
    };

    const { quote: wlQuote } = buildFullQuoteForScenario({
      quoteId: 'qt-test-j',
      quoteNumber: 'QT-TEST-J',
      items: [itemWl],
      currency: 'USD',
      productLevelMarginEnabled: false,
      agentLevelMarginPercent: 12,
      agentMarginType: 'FIXED',
      agentMarginValue: 800, // +$800 Agent Additional Markup -> Final = $12,000
      brandingMode: 'WHITE_LABEL'
    });

    verifyAllChannelsMatch(wlQuote, 11200, 800, 12000);

    const emailOut = EmailNotificationService.getInstance().buildCanonicalQuotationEmail(wlQuote);
    const waOut = generateWhatsAppQuoteMessage({ quote: wlQuote });
    const modelOut = buildQuotePresentationModel(wlQuote);
    const pdfPages = paginateQuotePresentationModel(modelOut);
    const pdfHtml = pdfPages.map(p => p.blocks.map(b => b.html).join('\n')).join('\n');

    // Verify no TheUnbound branding in White-Label outputs and no internal Nett ($10,000) or Base ($11,200) leaked to customer outputs
    assert(!emailOut.proposalViewHtml.toLowerCase().includes('theunbound'), 'Test J: White-label email HTML leaked TheUnbound branding');
    assert(!waOut.toLowerCase().includes('theunbound'), 'Test J: White-label WhatsApp leaked TheUnbound branding');
    assert(!emailOut.proposalViewHtml.includes('$10,000'), 'Test J: Email HTML leaked supplier nett cost $10,000');
    assert(!waOut.includes('$10,000'), 'Test J: WhatsApp leaked supplier nett cost $10,000');
    assert(!pdfHtml.includes('$10,000'), 'Test J: PDF HTML leaked supplier nett cost $10,000');

    console.log('✅ TEST J PASSED: White-label branding isolation and strict commercial confidentiality verified across PDF, Email & WhatsApp');
  }

  console.log('================================================================================');
  console.log(' ALL 10 MARGIN-BASED PRICING & EXPORT SYNCHRONIZATION AUDITS PASSED (10/10)');
  console.log('================================================================================');
  process.exit(0);
}

runAudit().catch(err => {
  console.error('❌ AUDIT FAILED:', err);
  process.exit(1);
});
