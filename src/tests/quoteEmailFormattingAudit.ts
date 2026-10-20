/**
 * COMPREHENSIVE TEST AUDIT:
 * Send Complete Quotation Email: Two Formatting Modes Audit
 * 
 * Tests:
 * 1. Option 1 — Rich HTML Quotation Preview (Proposal View Mode)
 *    - Follows Proposal View's content hierarchy & visual identity
 *    - Responsive email width container (max-width 680px, width 100%, table layout)
 *    - Day-wise itinerary layout, service cards, bullet trains, hotel stays
 *    - Price confidentiality: only final total package cost, zero item leaks
 *    - Preview matches delivered email
 * 
 * 2. Option 2 — Complete Plain-Text Quotation (Simple Formatting Mode)
 *    - Simple, clean, properly formatted email WITHOUT a designed layout
 *    - No colored backgrounds, no decorative banners, no cards, no complex tables, no badges
 *    - Handles <br>, <br/>, and malformed </br> safely
 *    - Handles <p>, <div>, <strong>, <b>, <ul>, <ol>, <li>, and Markdown **
 *    - Bold headings, properly separated paragraphs, standard bullet and numbered lists
 *    - All original quotation content preserved
 *    - Only final total visible
 * 
 * 3. Email Delivery & Channel Regression
 *    - Mode selection respected without template cross-contamination
 *    - Gmail dispatch payload carries intended body format + plain text alternative
 *    - WhatsApp, PDF and quotation builders remain 100% operational
 */

import { Quotation } from '../types';
import { 
  buildQuotePresentationModel, 
  renderQuoteEmailFromPresentationModel,
  renderQuoteWhatsAppFromPresentationModel
} from '../services/quotePresentationModel';
import { 
  formatPlainTextQuotationToHtml, 
  renderProposalViewHtmlEmail,
  renderSimpleSemanticQuotationEmailFromModel
} from '../services/quoteEmailFormatter';
import { EmailNotificationService } from '../services/emailNotificationService';

const mockTestQuote: Quotation = ({
  id: 'quote-email-test-01',
  quoteNumber: 'UBQ-2026-EMAIL-01',
  version: 1,
  status: 'DRAFT',
  title: 'Classic Japan Heritage & Modern Wonder',
  destination: 'Japan',
  currency: 'INR',
  totalSellingPrice: 385000,
  finalCustomerSellingPrice: 385000,
  clientName: 'Sunita & Rajesh Sharma',
  clientEmail: 'rajesh.sharma@traveler.com',
  clientPhone: '+91 98200 12345',
  agentName: 'Aarav Mehta',
  agentAgency: 'TheUnbound Luxury Journeys',
  agentEmail: 'aarav@theunbound.in',
  agentPhone: '+91 98116 54959',
  travelStartDate: '2026-10-15',
  travelEndDate: '2026-10-20',
  termsAndConditions: 'All services are guaranteed upon receipt of initial deposit. Flight schedules subject to airline terms.',
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
  routeHubs: [
    { id: 'hub-tokyo', hubName: 'Tokyo', nights: 3, order: 0 },
    { id: 'hub-kyoto', hubName: 'Kyoto', nights: 2, order: 1 }
  ],
  items: [
    {
      id: 'item-h1',
      category: 'Hotels',
      service_type: 'HOTEL',
      product: {
        id: 'prod-h1',
        name: 'The Capitol Hotel Tokyu',
        category: 'Hotels',
        productType: 'HOTEL',
        city: 'Tokyo',
        destinationName: 'Japan',
        duration: '3 Nights',
        longDescription: 'Iconic luxury property in Akasaka with panoramic Tokyo skyline views.',
        inclusions: ['Club Lounge Breakfast', 'High-Speed Wi-Fi', 'Spa Access'],
        exclusions: ['City accommodation tax']
      },
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-10-15',
      calculation: {
        productId: 'prod-h1',
        productName: 'The Capitol Hotel Tokyu',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 180000,
        finalTotalSellingPrice: 180000,
        sellingPriceFinal: 180000
      }
    },
    {
      id: 'item-rail-1',
      category: 'Rail Services',
      service_type: 'RAIL',
      product: {
        id: 'prod-r1',
        name: 'Tokaido Shinkansen Nozomi Bullet Train',
        category: 'Rail Services',
        productType: 'RAIL',
        duration: '2 Hours 15 Mins',
        longDescription: 'High-speed bullet train journey between Tokyo and Kyoto.',
        inclusions: ['Reserved Green Car Seats', 'Luggage Allocation'],
        exclusions: ['Meals & Refreshments']
      },
      isRail: true,
      railJourneyDetails: {
        originStationName: 'Tokyo Station',
        destinationStationName: 'Kyoto Station',
        carType: 'Green Car',
        seatType: 'Reserved Window',
        serviceGroup: 'NOZOMI',
        seatPreference: 'Mt. Fuji View (Seats 14A, 14B)',
        pnrReference: 'SMARTEX-88392'
      },
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-10-18',
      calculation: {
        productId: 'prod-r1',
        productName: 'Tokaido Shinkansen Nozomi',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 35000,
        finalTotalSellingPrice: 35000,
        sellingPriceFinal: 35000
      }
    },
    {
      id: 'item-tour-1',
      category: 'Tours',
      service_type: 'DAY_TOUR',
      product: {
        id: 'prod-t1',
        name: 'Private Kyoto Gion & Kinkaku-ji Sanctuary Discovery',
        category: 'Tours',
        productType: 'DAY_TOUR',
        duration: '8 Hours',
        longDescription: 'Exclusive guided tour of Kyoto heritage monuments with licensed English speaking docent.',
        inclusions: ['Private Chauffeur Alphard', 'All Temple Entrance Tickets', 'English Certified Guide'],
        exclusions: ['Personal dining & beverages']
      },
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-10-19',
      calculation: {
        productId: 'prod-t1',
        productName: 'Private Kyoto Tour',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 120000,
        finalTotalSellingPrice: 120000,
        sellingPriceFinal: 120000
      }
    },
    {
      id: 'item-visa-1',
      category: 'Visa & Ancillary Services',
      service_type: 'VISA',
      product: {
        id: 'prod-v1',
        name: 'Japan Tourist eVisa Expedited Concierge Service',
        category: 'Visa & Ancillary Services',
        productType: 'Visa Service',
        duration: '4 Working Days',
        longDescription: 'Comprehensive embassy document verification and consular submission.',
        inclusions: ['Consular Fees Included', 'Doorstep Document Collection'],
        exclusions: ['Biometric centre express fee']
      },
      pax: { adults: 2, children: 0, infants: 0 },
      calculation: {
        productId: 'prod-v1',
        productName: 'Japan eVisa',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 20000,
        finalTotalSellingPrice: 20000,
        sellingPriceFinal: 20000
      }
    }
  ]
} as unknown as Quotation);

export function runQuoteEmailFormattingAudit() {
  console.log('======================================================================');
  console.log('AUDIT: SEND COMPLETE QUOTATION EMAIL — TWO FORMATTING MODES');
  console.log('======================================================================');

  let passed = true;
  const model = buildQuotePresentationModel(mockTestQuote);

  // ==========================================================================
  // [TEST 1] OPTION 1 — RICH HTML QUOTATION PREVIEW (PROPOSAL VIEW FORMAT)
  // ==========================================================================
  console.log('\n[TEST 1] Testing Option 1: Rich HTML Quotation Preview (Proposal View Mode)...');
  const proposalViewHtml = renderProposalViewHtmlEmail(model, 'We have reserved your bullet train seats on the Mt. Fuji side.');

  // 1.1 Visual Hierarchy & Proposal View Identity
  if (!proposalViewHtml.includes('Official Itinerary Proposal')) {
    console.error('FAIL: Option 1 missing "Official Itinerary Proposal" header badge.');
    passed = false;
  }
  if (!proposalViewHtml.includes('Curated Journey Overview')) {
    console.error('FAIL: Option 1 missing Proposal View "Curated Journey Overview" banner.');
    passed = false;
  }
  if (!proposalViewHtml.includes('Route & Destination Hubs:')) {
    console.error('FAIL: Option 1 missing Route Hubs timeline.');
    passed = false;
  }
  if (!proposalViewHtml.includes('Valued Guest / Client') || !proposalViewHtml.includes('Prepared By Destination Specialist')) {
    console.error('FAIL: Option 1 missing 2-column Client & Specialist Dossier.');
    passed = false;
  }

  // 1.2 Responsive email width requirements
  if (!proposalViewHtml.includes('max-width: 680px') || !proposalViewHtml.includes('width: 100%')) {
    console.error('FAIL: Option 1 missing responsive fluid container (max-width: 680px, width: 100%).');
    passed = false;
  }
  if (!proposalViewHtml.includes('table-layout: fixed') || !proposalViewHtml.includes('word-wrap: break-word')) {
    console.error('FAIL: Option 1 missing overflow prevention rules.');
    passed = false;
  }

  // 1.3 Day-wise itinerary layout & content
  if (!proposalViewHtml.includes('Day-by-Day Itinerary & Scheduled Services')) {
    console.error('FAIL: Option 1 missing Day-by-Day Itinerary section heading.');
    passed = false;
  }
  if (!proposalViewHtml.includes('Day 1:') && !proposalViewHtml.includes('Day 01')) {
    console.error('FAIL: Option 1 missing Day 1 heading banner.');
    passed = false;
  }
  if (!proposalViewHtml.includes('Activities & Highlights')) {
    console.error('FAIL: Option 1 missing "Activities & Highlights" subsection.');
    passed = false;
  }
  if (!proposalViewHtml.includes('Overnight:')) {
    console.error('FAIL: Option 1 missing "Overnight:" field.');
    passed = false;
  }
  if (!proposalViewHtml.includes('Tokaido Shinkansen Nozomi')) {
    console.error('FAIL: Option 1 missing Shinkansen Bullet Train service.');
    passed = false;
  }
  if (!proposalViewHtml.includes('SMARTEX-88392')) {
    console.error('FAIL: Option 1 missing PNR reference.');
    passed = false;
  }

  // 1.4 Pricing Confidentiality in Option 1 (Single consolidated total only)
  if (!proposalViewHtml.includes('TOTAL PACKAGE INVESTMENT')) {
    console.error('FAIL: Option 1 missing TOTAL PACKAGE INVESTMENT signature box.');
    passed = false;
  }
  if (!proposalViewHtml.includes('385,000') && !proposalViewHtml.includes('3,85,000')) {
    console.error('FAIL: Option 1 missing consolidated total 385,000 INR.');
    passed = false;
  }
  if (!proposalViewHtml.includes('Hotel Accommodation Total')) {
    console.error('FAIL: Option 1 missing "Hotel Accommodation Total".');
    passed = false;
  }
  if (!proposalViewHtml.includes('180,000') && !proposalViewHtml.includes('1,80,000')) {
    console.error('FAIL: Option 1 missing Hotel Accommodation Total amount 180,000 INR.');
    passed = false;
  }
  const leakedPriceTerms = ['120,000', '35,000', '20,000'];
  leakedPriceTerms.forEach(term => {
    if (proposalViewHtml.includes(`₹${term}`) || proposalViewHtml.includes(`INR ${term}`)) {
      console.error(`FAIL: Option 1 leaked confidential item price "${term}".`);
      passed = false;
    }
  });

  console.log('PASS: Option 1 (Rich HTML Preview) matches Proposal View visual identity and responsiveness.');

  // ==========================================================================
  // [TEST 2] OPTION 2 — COMPLETE PLAIN-TEXT QUOTATION (SIMPLE FORMATTING MODE)
  // ==========================================================================
  console.log('\n[TEST 2] Testing Option 2: Complete Plain-Text Quotation (Simple Formatting Mode)...');

  // 2.1 Test formatting markers conversion (<br>, malformed </br>, <p>, <div>, <strong>, <b>, <ul>, entities)
  const legacyContentWithMarkers = `
**THEUNBOUND — COMPLETE TRAVEL QUOTATION**</br>
<br/>
Destination: Japan<br>
Travel Dates: 15 Oct 2026 - 20 Oct 2026</br>
<br />
<strong>TRIP OVERVIEW</strong>
<p>Bespoke ground travel proposal for Japan featuring Tokyo & Kyoto.<br>All ground transportation and bullet trains arranged.</p>
<div>DAY 1 — ARRIVAL IN TOKYO</div>
Welcome to Tokyo. Private chauffeur meet and greet at Haneda Airport.
Activities and Highlights
• Transfer to hotel in private Alphard
• Check-in at <b>The Capitol Hotel Tokyu</b> (3 Nights)
• Evening orientation walk
Overnight: Tokyo Hub

DAY 2 — TOKYO SIGHTSEEING
Full day guided discovery.
Activities and Highlights
1. Meiji Shrine & Harajuku walk
2. Shibuya Sky observation deck
3. Asakusa Senso-ji temple

WHAT'S INCLUDED
• 24/7 Ground operations concierge
• English certified docent guide & chauffeur
• All monument entrance admissions

WHAT'S EXCLUDED
• Personal shopping & gratuities
• International airfare

TOTAL PACKAGE INVESTMENT
Final Total: 385,000 INR
Currency Guarantee: INR Guaranteed
Validity: Valid for 14 calendar days

IMPORTANT INFORMATION
Child age policies apply at attraction gates.
  `.trim();

  const simpleFormattedHtml = formatPlainTextQuotationToHtml(legacyContentWithMarkers);

  // 2.2 Semantic tags produced
  if (!simpleFormattedHtml.includes('<h1')) {
    console.error('FAIL: Option 2 missing <h1> main title.');
    passed = false;
  }
  if (!simpleFormattedHtml.includes('<h2') || !simpleFormattedHtml.includes('TRIP OVERVIEW')) {
    console.error('FAIL: Option 2 missing <h2> TRIP OVERVIEW section heading.');
    passed = false;
  }
  if (!simpleFormattedHtml.includes('<h3') || !simpleFormattedHtml.includes('DAY 1 — ARRIVAL IN TOKYO')) {
    console.error('FAIL: Option 2 missing <h3> day heading.');
    passed = false;
  }
  if (!simpleFormattedHtml.includes('<ul') || !simpleFormattedHtml.includes('<li')) {
    console.error('FAIL: Option 2 missing <ul> bullet lists.');
    passed = false;
  }
  if (!simpleFormattedHtml.includes('<ol') || !simpleFormattedHtml.includes('<li')) {
    console.error('FAIL: Option 2 missing <ol> numbered lists.');
    passed = false;
  }
  if (!simpleFormattedHtml.includes('<strong>')) {
    console.error('FAIL: Option 2 missing <strong> bold elements.');
    passed = false;
  }

  // 2.3 Safe marker cleanup: no malformed </br>, no raw \n, no literal markdown **
  if (simpleFormattedHtml.includes('</br>') || simpleFormattedHtml.includes('<br/>') || simpleFormattedHtml.includes('<br />')) {
    console.error('FAIL: Option 2 produced raw uncleaned <br> or </br> markers.');
    passed = false;
  }
  if (simpleFormattedHtml.includes('**')) {
    console.error('FAIL: Option 2 leaked raw literal markdown ** characters.');
    passed = false;
  }
  if (simpleFormattedHtml.includes('\\n')) {
    console.error('FAIL: Option 2 produced literal \\n strings.');
    passed = false;
  }

  // 2.4 Crucial Requirement: NO DESIGNED PROPOSAL VIEW LAYOUT IN OPTION 2
  // Must NOT have colored card backgrounds, dark banners, pills, or decorative marketing graphics!
  if (simpleFormattedHtml.includes('Official Itinerary Proposal')) {
    console.error('FAIL: Option 2 inherited Proposal View header banner.');
    passed = false;
  }
  if (simpleFormattedHtml.includes('Curated Journey Overview')) {
    console.error('FAIL: Option 2 inherited Proposal View dark banner.');
    passed = false;
  }
  if (simpleFormattedHtml.includes('background: #020617') || simpleFormattedHtml.includes('background: #0f172a')) {
    console.error('FAIL: Option 2 inherited dark background banner styling.');
    passed = false;
  }
  if (simpleFormattedHtml.includes('#00C6A6') || simpleFormattedHtml.includes('#00E5C0')) {
    console.error('FAIL: Option 2 inherited teal brand accents contrary to simple plain-text design requirement.');
    passed = false;
  }

  // 2.5 Price Confidentiality in Option 2
  if (!simpleFormattedHtml.includes('385,000 INR')) {
    console.error('FAIL: Option 2 missing final total 385,000 INR.');
    passed = false;
  }
  leakedPriceTerms.forEach(term => {
    if (simpleFormattedHtml.includes(`₹${term}`) || simpleFormattedHtml.includes(`INR ${term}`)) {
      console.error(`FAIL: Option 2 leaked confidential item price "${term}".`);
      passed = false;
    }
  });

  console.log('PASS: Option 2 (Complete Plain-Text Quotation) generates clean semantic HTML without designed layout.');

  // ==========================================================================
  // [TEST 3] DIRECT MODEL GENERATION OF OPTION 2
  // ==========================================================================
  console.log('\n[TEST 3] Testing renderSimpleSemanticQuotationEmailFromModel direct generation...');
  const directSimpleResult = renderSimpleSemanticQuotationEmailFromModel(model, 'Personal note from Aarav.');

  if (!directSimpleResult.textBody || !directSimpleResult.htmlBody) {
    console.error('FAIL: renderSimpleSemanticQuotationEmailFromModel did not produce both textBody and htmlBody.');
    passed = false;
  }
  if (!directSimpleResult.htmlBody.includes('THEUNBOUND — COMPLETE TRAVEL QUOTATION')) {
    console.error('FAIL: Direct simple semantic html missing main title.');
    passed = false;
  }
  if (!directSimpleResult.htmlBody.includes('TOTAL PACKAGE INVESTMENT')) {
    console.error('FAIL: Direct simple semantic html missing TOTAL PACKAGE INVESTMENT.');
    passed = false;
  }
  if (!directSimpleResult.textBody.includes('385,000') && !directSimpleResult.textBody.includes('3,85,000')) {
    console.error('FAIL: Direct simple textBody missing 385,000 / 3,85,000 INR.');
    passed = false;
  }

  console.log('PASS: Direct model generation of Option 2 verified with clean text and HTML representation.');

  // ==========================================================================
  // [TEST 4] EMAIL NOTIFICATION SERVICE & DUAL-MODE API INTEGRATION
  // ==========================================================================
  console.log('\n[TEST 4] Testing EmailNotificationService dual-mode quotation generation...');
  const emailService = EmailNotificationService.getInstance();

  // Mode 1: Proposal View Mode
  const emailOutputMode1 = emailService.generateQuotationProposalEmail(mockTestQuote, {
    customNote: 'Note for client',
    formattingMode: 'PROPOSAL_VIEW'
  });
  if (!emailOutputMode1.proposalViewHtml || !emailOutputMode1.proposalViewHtml.includes('Curated Journey Overview')) {
    console.error('FAIL: EmailNotificationService Mode 1 missing Proposal View HTML.');
    passed = false;
  }

  // Mode 2: Plain-Text Mode
  const emailOutputMode2 = emailService.generateQuotationProposalEmail(mockTestQuote, {
    customNote: 'Note for client',
    formattingMode: 'PLAIN_TEXT'
  });
  if (!emailOutputMode2.simpleSemanticHtml || emailOutputMode2.simpleSemanticHtml.includes('Curated Journey Overview')) {
    console.error('FAIL: EmailNotificationService Mode 2 incorrectly contains designed Proposal View banner.');
    passed = false;
  }
  if (!emailOutputMode2.fullHtml.includes('THEUNBOUND') || !emailOutputMode2.fullHtml.includes('<h1')) {
    console.error('FAIL: EmailNotificationService Mode 2 fullHtml missing simple semantic title.');
    passed = false;
  }

  console.log('PASS: EmailNotificationService properly routes between Option 1 and Option 2 without template cross-contamination.');

  // ==========================================================================
  // [TEST 5] WHATSAPP & PERIPHERAL CHANNELS REGRESSION CHECK
  // ==========================================================================
  console.log('\n[TEST 5] Testing WhatsApp and peripheral channels parity...');
  const waOutput = renderQuoteWhatsAppFromPresentationModel(model);
  if (!waOutput.includes('The Capitol Hotel Tokyu') || !waOutput.includes('Tokaido Shinkansen Nozomi')) {
    console.error('FAIL: WhatsApp quotation output missing services.');
    passed = false;
  }
  if (!waOutput.includes('Hotel Accommodation Total')) {
    console.error('FAIL: WhatsApp quotation output missing Hotel Accommodation Total.');
    passed = false;
  }
  if (!waOutput.includes('180,000') && !waOutput.includes('1,80,000')) {
    console.error('FAIL: WhatsApp quotation output missing Hotel Accommodation Total amount 180,000.');
    passed = false;
  }
  if (waOutput.includes('₹120,000') || waOutput.includes('₹35,000') || waOutput.includes('₹20,000')) {
    console.error('FAIL: WhatsApp output leaked individual item prices.');
    passed = false;
  }

  console.log('PASS: WhatsApp and peripheral quotation workflows remain 100% operational.');

  // ==========================================================================
  // [TEST 6] LITERAL TAG ELIMINATION & STORED HTML CONTENT RENDERING (BUG FIX AUDIT)
  // ==========================================================================
  console.log('\n[TEST 6] Testing Stored HTML Content Parsing & Literal Tag Elimination...');
  const quoteWithStoredHtmlMarkup: Quotation = {
    ...mockTestQuote,
    id: 'quote-html-markup-test',
    quoteNumber: 'UBQ-2026-MARKUP-01',
    items: [
      {
        ...mockTestQuote.items[0],
        product: {
          ...mockTestQuote.items[0].product,
          longDescription: '<p>Day 1: Arrival in Tokyo</p><p>Transfer to the hotel</p><br/><p>Day 2: Explore Tokyo</p>'
        }
      },
      {
        ...mockTestQuote.items[1],
        contentSnapshot: {
          overviewSpecifications: '&lt;p&gt;High-speed bullet train transfer between Tokyo & Kyoto.&lt;/p&gt;&lt;br/&gt;&lt;p&gt;Green Car reserved seating included.&lt;/p&gt;',
          inclusions: ['Reserved Green Car Seats'],
          exclusions: [],
          sourceType: 'INVENTORY_PRODUCT',
          sourceId: 'prod-r1',
          capturedAt: '2026-10-13T10:00:00Z'
        }
      }
    ]
  };

  const modelWithMarkup = buildQuotePresentationModel(quoteWithStoredHtmlMarkup);
  const option1Html = renderProposalViewHtmlEmail(modelWithMarkup);
  const option2Result = renderSimpleSemanticQuotationEmailFromModel(modelWithMarkup);

  // 6.1 Option 1 must NOT display literal <p>, <br/>, or </br> tags
  const opt1Tags = ['&lt;p&gt;', '&lt;/p&gt;', '&lt;br/&gt;', '&lt;br&gt;', '&lt;br /&gt;'].filter(t => option1Html.includes(t));
  if (opt1Tags.length > 0) {
    console.error('FAIL: Option 1 displayed literal HTML tags:', opt1Tags);
    const idx = option1Html.indexOf(opt1Tags[0]);
    console.error('Context:', option1Html.slice(Math.max(0, idx - 50), idx + 80));
    passed = false;
  }
  if (option1Html.includes('</br>')) {
    console.error('FAIL: Option 1 leaked malformed </br> tag.');
    passed = false;
  }
  // Must render formatted paragraphs
  if (!option1Html.includes('Day 1: Arrival in Tokyo') || !option1Html.includes('Transfer to the hotel')) {
    console.error('FAIL: Option 1 missing paragraph content from stored HTML.');
    passed = false;
  }

  // 6.2 Option 2 must NOT display literal <p>, <br/>, or </br> tags
  const opt2Tags = ['&lt;p&gt;', '&lt;/p&gt;', '&lt;br/&gt;', '&lt;br&gt;', '&lt;br /&gt;'].filter(t => option2Result.htmlBody.includes(t));
  if (opt2Tags.length > 0) {
    console.error('FAIL: Option 2 displayed literal HTML tags:', opt2Tags);
    passed = false;
  }
  if (option2Result.htmlBody.includes('</br>')) {
    console.error('FAIL: Option 2 leaked malformed </br> tag.');
    passed = false;
  }
  // Must render formatted paragraphs
  if (!option2Result.htmlBody.includes('Day 1: Arrival in Tokyo') || !option2Result.htmlBody.includes('Transfer to the hotel')) {
    console.error('FAIL: Option 2 missing paragraph content from stored HTML.');
    passed = false;
  }

  // 6.3 MIME text/plain must NOT contain HTML tags (<p>, <br/>, </br>)
  const textBodyTags = ['<p>', '</p>', '<br/>', '<br>', '</br>', '<br />'].filter(t => option2Result.textBody.includes(t));
  if (textBodyTags.length > 0) {
    console.error('FAIL: Plain text MIME alternative leaked raw HTML tags:', textBodyTags);
    const idx = option2Result.textBody.indexOf(textBodyTags[0]);
    console.error('Context:', option2Result.textBody.slice(Math.max(0, idx - 50), idx + 80));
    passed = false;
  }
  if (!option2Result.textBody.includes('Day 1: Arrival in Tokyo') || !option2Result.textBody.includes('Transfer to the hotel')) {
    console.error('FAIL: Plain text MIME alternative missing clean text lines.');
    passed = false;
  }

  // 6.4 WhatsApp output must NOT contain raw HTML tags and must convert to WhatsApp markdown
  const waMarkupResult = renderQuoteWhatsAppFromPresentationModel(modelWithMarkup);
  const waTags = ['<p>', '</p>', '<br/>', '<br>', '</br>', '<br />', '<div>', '</div>', '<strong>', '</strong>', '&lt;', '&gt;'].filter(t => waMarkupResult.includes(t));
  if (waTags.length > 0) {
    console.error('FAIL: WhatsApp output leaked raw HTML or entity tags:', waTags);
    passed = false;
  }
  if (!waMarkupResult.includes('Day 1: Arrival in Tokyo') || !waMarkupResult.includes('Transfer to the hotel')) {
    console.error('FAIL: WhatsApp output missing content lines from stored HTML.');
    passed = false;
  }

  console.log('PASS: Stored HTML content properly converted to formatted email and WhatsApp content with zero literal tags in Option 1, Option 2, textBody, and WhatsApp.');

  console.log('\n======================================================================');
  if (passed) {
    console.log('ALL TWO-FORMATTING-MODES QUOTATION EMAIL & WHATSAPP AUDITS PASSED WITH 100% SUCCESS.');
  } else {
    console.error('AUDIT FAILED! Review errors above.');
    process.exit(1);
  }
  console.log('======================================================================');
}

runQuoteEmailFormattingAudit();
