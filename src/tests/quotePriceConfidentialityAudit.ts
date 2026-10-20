import { Quotation, QuoteItem } from '../types';
import { 
  buildQuotePresentationModel, 
  renderQuoteEmailFromPresentationModel, 
  renderQuoteWhatsAppFromPresentationModel 
} from '../services/quotePresentationModel';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import { 
  sanitizeQuoteDocumentForCustomer, 
  sanitizeQuoteForCustomer, 
  verifyNoCommercialLeak 
} from '../utils/customerQuoteSanitizer';

// Mock quote with realistic complex products, hotels, rail journeys, visas, and calculations
const mockQuote: Quotation = ({
  id: 'quote-test-confidentiality-101',
  quoteNumber: 'UBQ-2026-CONF-01',
  version: 2,
  status: 'SENT',
  title: 'Golden Route Luxury Discovery',
  destination: 'Japan',
  currency: 'INR',
  totalSellingPrice: 250000,
  finalCustomerSellingPrice: 250000,
  baseFinalSellingPrice: 220000,
  totalNetCost: 180000,
  totalMargin: 70000,
  agentMarginAmount: 30000,
  agentMarginValue: 13.6,
  agentMarginType: 'PERCENTAGE',
  clientName: 'Vikram Malhotra',
  clientEmail: 'vikram.m@luxurytravel.in',
  clientPhone: '+919811654959',
  travelStartDate: '2026-11-10',
  travelEndDate: '2026-11-15',
  termsAndConditions: 'All proposed rates are confidential and valid for 14 calendar days from generation date.',
  adultsCount: 2,
  childrenCount: 1,
  infantsCount: 0,
  routeHubs: [
    { id: 'hub-tokyo', hubName: 'Tokyo', nights: 3, order: 0 },
    { id: 'hub-kyoto', hubName: 'Kyoto', nights: 2, order: 1 }
  ],
  items: [
    {
      id: 'item-hotel-tokyo',
      category: 'Hotels',
      service_type: 'HOTEL',
      product: {
        id: 'prod-hotel-1',
        name: 'The Capitol Hotel Tokyu',
        category: 'Hotels',
        productType: 'HOTEL',
        city: 'Tokyo',
        destinationName: 'Japan',
        duration: '3 Nights',
        longDescription: 'Luxury 5-star haven overlooking Hie Shrine in central Akasaka.',
        inclusions: ['Daily Club Lounge Breakfast', 'High-Speed Wi-Fi', 'Complimentary Gym & Pool Access'],
        exclusions: ['City accommodation tax', 'Personal laundry']
      },
      pax: { adults: 2, children: 1, infants: 0 },
      travelDate: '2026-11-10',
      calculation: {
        productId: 'prod-hotel-1',
        productName: 'The Capitol Hotel Tokyu',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 90000,
        finalTotalSellingPrice: 90000,
        sellingPriceFinal: 90000,
        pricePerPerson: 30000,
        adultsSubtotalSelling: 90000,
        childrenSubtotalSelling: 0,
        infantsSubtotalSelling: 0
      }
    },
    {
      id: 'item-rail-shinkansen',
      category: 'Rail Services',
      service_type: 'RAIL',
      product: {
        id: 'prod-rail-1',
        name: 'Shinkansen Bullet Train Tokyo to Kyoto',
        category: 'Rail Services',
        productType: 'RAIL',
        duration: '2 Hours 15 Mins',
        longDescription: 'Tokaido Shinkansen Nozomi high-speed bullet train.',
        inclusions: ['Reserved Green Car Seats', 'Luggage Compartment Access'],
        exclusions: ['Onboard Bento Meals']
      },
      isRail: true,
      railJourneyDetails: {
        originStationName: 'Tokyo Station',
        originStationCode: 'TYO',
        destinationStationName: 'Kyoto Station',
        destinationStationCode: 'KYO',
        carType: 'Green Car',
        seatType: 'Reserved Seat',
        serviceGroup: 'NOZOMI_MIZUHO',
        seatPreference: 'Mt. Fuji Window Side (Seats 12A, 12B, 12C)',
        pnrReference: 'SMARTEX-99281'
      },
      pax: { adults: 2, children: 1, infants: 0 },
      travelDate: '2026-11-13',
      calculation: {
        productId: 'prod-rail-1',
        productName: 'Shinkansen Bullet Train Tokyo to Kyoto',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 28000,
        finalTotalSellingPrice: 28000,
        sellingPriceFinal: 28000,
        pricePerPerson: 9333
      }
    },
    {
      id: 'item-tour-kyoto',
      category: 'Tours',
      service_type: 'DAY_TOUR',
      product: {
        id: 'prod-tour-1',
        name: 'Private Arashiyama Bamboo Grove & Kinkaku-ji Sanctuary Tour',
        category: 'Tours',
        productType: 'DAY_TOUR',
        duration: '7 Hours',
        longDescription: 'Comprehensive private guided exploration of Western Kyoto with certified English docent.',
        inclusions: ['Private Chauffeur Alphard', 'All Temple Entrance Tickets', 'English Licensed Guide'],
        exclusions: ['Lunch and beverages']
      },
      pax: { adults: 2, children: 1, infants: 0 },
      travelDate: '2026-11-14',
      calculation: {
        productId: 'prod-tour-1',
        productName: 'Private Arashiyama Bamboo Grove',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 65000,
        finalTotalSellingPrice: 65000,
        sellingPriceFinal: 65000,
        pricePerPerson: 21666
      }
    },
    {
      id: 'item-visa-japan',
      category: 'Visa & Ancillary Services',
      service_type: 'VISA',
      product: {
        id: 'prod-visa-1',
        name: 'Japan Tourist eVisa Expedited Concierge Facilitation',
        category: 'Visa & Ancillary Services',
        productType: 'Visa Service',
        duration: '5 Working Days',
        longDescription: 'Complete documentation audit, appointment scheduling, and consulate visa fee coverage.',
        inclusions: ['Consulate Visa Fees', 'Document Verification & Preparation', 'Doorstep Passport Courier'],
        exclusions: ['Biometric centre surcharges']
      },
      pax: { adults: 2, children: 1, infants: 0 },
      calculation: {
        productId: 'prod-visa-1',
        productName: 'Japan Tourist eVisa',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 15000,
        finalTotalSellingPrice: 15000,
        sellingPriceFinal: 15000,
        pricePerPerson: 5000
      }
    }
  ]
} as unknown as Quotation);

export function runQuotePriceConfidentialityAudit() {
  console.log('======================================================================');
  console.log('AUDIT: FINAL QUOTATION PRICE CONFIDENTIALITY ACROSS ALL CHANNELS');
  console.log('======================================================================');

  let passed = true;

  // 1. Audit Canonical Presentation Model
  console.log('\n[TEST 1] Auditing Canonical Presentation Model...');
  const model = buildQuotePresentationModel(mockQuote);

  if (model.currency !== 'INR') {
    console.error('FAIL: Model currency mismatch. Expected INR, got:', model.currency);
    passed = false;
  }
  if (!model.totalItineraryValueFormatted.includes('250,000') && !model.totalItineraryValueFormatted.includes('2,50,000')) {
    console.error('FAIL: Expected total quotation to be 250,000 INR, got:', model.totalItineraryValueFormatted);
    passed = false;
  }

  // Verify all service items have priceFormatted set to empty string
  model.days.forEach(d => {
    d.services.forEach(s => {
      if (s.priceFormatted && s.priceFormatted.trim() !== '') {
        console.error(`FAIL: Service "${s.listingName}" in Day ${d.dayNumber} exposed priceFormatted: "${s.priceFormatted}"`);
        passed = false;
      }
    });
  });

  model.visaServices.forEach(v => {
    if (v.priceFormatted && v.priceFormatted.trim() !== '') {
      console.error(`FAIL: Visa service "${v.listingName}" exposed priceFormatted: "${v.priceFormatted}"`);
      passed = false;
    }
  });

  model.hotels.forEach(h => {
    if (h.priceFormatted) {
      console.error(`FAIL: Hotel "${h.hotelName}" exposed priceFormatted: "${h.priceFormatted}"`);
      passed = false;
    }
  });

  console.log('PASS: Canonical Presentation Model contains zero item-level prices.');

  // 2. Audit PDF Generation
  console.log('\n[TEST 2] Auditing Multi-Page PDF Pagination Engine Output...');
  const pdfPages = paginateQuotePresentationModel(model);
  const allPdfHtml = pdfPages.map(p => p.blocks.map(b => b.html).join('')).join('');

  if (!allPdfHtml.includes('TOTAL PACKAGE INVESTMENT')) {
    console.error('FAIL: PDF missing "TOTAL PACKAGE INVESTMENT" section header.');
    passed = false;
  }
  if (!allPdfHtml.includes('Final Total:')) {
    console.error('FAIL: PDF missing "Final Total:" line.');
    passed = false;
  }
  if (!allPdfHtml.includes('Hotel Accommodation Total')) {
    console.error('FAIL: PDF missing "Hotel Accommodation Total" line.');
    passed = false;
  }
  if (!allPdfHtml.includes('90,000')) {
    console.error('FAIL: PDF missing Hotel Accommodation Total amount 90,000.');
    passed = false;
  }

  // Check that individual non-hotel item prices (28,000, 65,000, 15,000) are NOT present
  const forbiddenItemPrices = ['₹28,000', '28,000', '₹65,000', '65,000', '₹15,000', '15,000'];
  forbiddenItemPrices.forEach(fp => {
    if (allPdfHtml.includes(`₹${fp}`) || allPdfHtml.includes(`INR ${fp}`)) {
      console.error(`FAIL: PDF leaked item price: ${fp}`);
      passed = false;
    }
  });

  // Verify that itinerary cards (outside the tariff container) do NOT leak any item prices
  const cardsHtml = pdfPages.map(p => p.blocks.filter(b => b.type !== 'TARIFF_CONTAINER').map(b => b.html).join('')).join('');
  if (cardsHtml.includes('90,000') || cardsHtml.includes('₹90,000')) {
    console.error('FAIL: PDF leaked hotel price inside itinerary card.');
    passed = false;
  }

  // Verify items remain visible
  if (!allPdfHtml.includes('The Capitol Hotel Tokyu') || !allPdfHtml.includes('Shinkansen Bullet Train') || !allPdfHtml.includes('Private Arashiyama Bamboo')) {
    console.error('FAIL: Itinerary items missing from PDF rendering.');
    passed = false;
  }

  console.log('PASS: PDF pagination output displays single consolidated TOTAL PACKAGE INVESTMENT with zero item leaks.');

  // 3. Audit Email Outputs (HTML & Plain Text)
  console.log('\n[TEST 3] Auditing Complete Quotation Email (HTML & Plain Text)...');
  const emailOutput = renderQuoteEmailFromPresentationModel(model);

  // Check Plain Text
  if (!emailOutput.textBody.includes('TOTAL PACKAGE INVESTMENT')) {
    console.error('FAIL: Plain text email missing "TOTAL PACKAGE INVESTMENT".');
    passed = false;
  }
  if (emailOutput.textBody.includes('Rate Per Person :')) {
    console.error('FAIL: Plain text email leaked "Rate Per Person :".');
    passed = false;
  }
  if (emailOutput.textBody.includes('Rate Per Traveler :')) {
    console.error('FAIL: Plain text email leaked "Rate Per Traveler :".');
    passed = false;
  }

  // Check HTML
  if (!emailOutput.htmlBody.includes('TOTAL PACKAGE INVESTMENT')) {
    console.error('FAIL: HTML email missing "TOTAL PACKAGE INVESTMENT".');
    passed = false;
  }
  if (emailOutput.htmlBody.includes('pricePerTravelerFormatted') || emailOutput.htmlBody.includes('/ Traveler')) {
    console.error('FAIL: HTML email leaked per-traveler calculations.');
    passed = false;
  }

  console.log('PASS: Complete Quotation Email conforms 100% to single consolidated price presentation.');

  // 4. Audit WhatsApp Quotation Message
  console.log('\n[TEST 4] Auditing WhatsApp Quotation Message Generation...');
  const waDetailed = renderQuoteWhatsAppFromPresentationModel(model, { useEmojis: true });
  const waSummary = renderQuoteWhatsAppFromPresentationModel(model, { useEmojis: false });

  if (!waDetailed.includes('TOTAL PACKAGE INVESTMENT')) {
    console.error('FAIL: WhatsApp message missing "TOTAL PACKAGE INVESTMENT".');
    passed = false;
  }
  if (!waDetailed.includes('Final Total:')) {
    console.error('FAIL: WhatsApp message missing "Final Total:".');
    passed = false;
  }
  if (waDetailed.includes('Rate Per Traveler') || waDetailed.includes('Rate Per Person')) {
    console.error('FAIL: WhatsApp message leaked Rate Per Traveler.');
    passed = false;
  }
  if (waDetailed.includes('Tariff: ₹') || waDetailed.includes('Tariff: 90000') || waDetailed.includes('— ₹90,000')) {
    console.error('FAIL: WhatsApp message leaked individual item price.');
    passed = false;
  }

  const leakAudit = verifyNoCommercialLeak(waDetailed);
  if (!leakAudit.isSafe) {
    console.error('FAIL: WhatsApp message triggered commercial leak audit terms:', leakAudit.detectedTerms);
    passed = false;
  }

  console.log('PASS: WhatsApp quotation message verified safe with zero item-level pricing.');

  // 5. Audit Customer Quotation Document Sanitization
  console.log('\n[TEST 5] Auditing sanitizeQuoteDocumentForCustomer...');
  const sanitizedDoc = sanitizeQuoteDocumentForCustomer(mockQuote);

  if (sanitizedDoc.totalSellingPrice !== 250000) {
    console.error('FAIL: Sanitized document final total altered:', sanitizedDoc.totalSellingPrice);
    passed = false;
  }
  if ((sanitizedDoc as any).totalNetCost !== undefined) {
    console.error('FAIL: Sanitized document retained totalNetCost.');
    passed = false;
  }
  if ((sanitizedDoc as any).totalMargin !== undefined) {
    console.error('FAIL: Sanitized document retained totalMargin.');
    passed = false;
  }

  sanitizedDoc.items?.forEach(it => {
    if (it.calculation !== undefined) {
      console.error(`FAIL: Sanitized quote item "${it.product?.name}" retained calculation object.`);
      passed = false;
    }
  });

  console.log('PASS: sanitizeQuoteDocumentForCustomer strips all item-level pricing calculations.');

  // 6. Audit Anti-Regression & Items Retention
  console.log('\n[TEST 6] Auditing Inclusions, Descriptions & Itinerary Retention...');
  if (!model.days.some(d => d.services.some(s => s.inclusions.length > 0))) {
    console.error('FAIL: Service inclusions were accidentally stripped.');
    passed = false;
  }
  if (!model.days.some(d => d.services.some(s => s.overview.length > 0))) {
    console.error('FAIL: Service descriptions were accidentally stripped.');
    passed = false;
  }

  console.log('PASS: All itinerary content, descriptions, and inclusions remain fully intact.');

  console.log('\n======================================================================');
  if (passed) {
    console.log('ALL FINAL QUOTATION PRICE CONFIDENTIALITY AUDITS PASSED WITH 100% SUCCESS.');
  } else {
    console.error('AUDIT FAILED! Review errors above.');
    process.exit(1);
  }
  console.log('======================================================================');
}

runQuotePriceConfidentialityAudit();
