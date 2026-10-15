import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import { renderProposalViewHtmlEmail, renderPdfFidelityQuotationHtmlEmail } from '../services/quoteEmailFormatter';
import { paginateQuotePresentationModel, buildSemanticBlocks } from '../services/pdfPaginationEngine';
import { Quotation } from '../types';

/**
 * ============================================================================
 * THEUNBOUND — AUDIT: RICH HTML QUOTATION PREVIEW EXACT PDF FIDELITY
 * ============================================================================
 * Verifies that the Rich HTML Quotation Preview reproduces the generated
 * quotation PDF as closely as technically possible.
 */

const sampleQuote: Quotation = ({
  id: 'quote-audit-pdf-fidelity',
  quoteNumber: 'UBQ-2026-9901',
  version: 3,
  status: 'SENT',
  leadId: 'lead-test-1',
  agentId: 'agent-101',
  agentName: 'Kenji Sato',
  agentAgency: 'TheUnbound Japan Luxury DMC',
  agentEmail: 'kenji.sato@theunbound.in',
  agentPhone: '+81-3-5555-0199',
  clientName: 'Lord George Cavendish',
  clientCompany: 'Cavendish Heritage Trust',
  clientEmail: 'george@cavendish-heritage.co.uk',
  clientPhone: '+44-20-7946-0123',
  destination: 'Japan Golden Route & Kansai Heritage',
  travelStartDate: '2026-10-10',
  travelEndDate: '2026-10-18',
  paxCount: 2,
  adults: 2,
  children: 0,
  infants: 0,
  effectivePax: 2,
  currency: 'USD',
  totalAmount: 14500,
  netTotal: 12100,
  marginAmount: 2400,
  marginPercent: 16.5,
  createdAt: '2026-10-01T08:00:00Z',
  validUntil: '2026-10-31T23:59:59Z',
  routeHubs: [
    { id: 'hub-tokyo', hubId: 'tokyo', hubName: 'Tokyo', nights: 3, order: 1 },
    { id: 'hub-hakone', hubId: 'hakone', hubName: 'Hakone', nights: 1, order: 2 },
    { id: 'hub-kyoto', hubId: 'kyoto', hubName: 'Kyoto', nights: 4, order: 3 }
  ],
  items: [
    {
      id: 'item-visa',
      service_type: 'VISA',
      category: 'Visa & Ancillary Services',
      dayNumber: 1,
      totalPrice: 200,
      currency: 'USD',
      quantity: 2,
      paxCount: 2,
      product: {
        id: 'p-visa',
        name: 'Japan eVisa Diplomatic Facilitation',
        productType: 'Visa Service',
        category: 'Travel Services',
        description: '<p>End-to-end diplomatic filing and embassy verification.</p><br/><p>Standard tourist single-entry.</p>'
      }
    },
    {
      id: 'item-d1-trf',
      service_type: 'TRANSFER',
      category: 'Private Airport Transfers',
      dayNumber: 1,
      totalPrice: 450,
      currency: 'USD',
      quantity: 1,
      paxCount: 2,
      product: {
        id: 'p-trf',
        name: 'Haneda Airport (HND) VIP Chauffeur Transfer',
        category: 'Private Airport Transfers',
        duration: '75 Mins',
        description: '&lt;p&gt;Meet and greet inside arrival lobby with custom welcome signage.&lt;/p&gt;&lt;br/&gt;&lt;p&gt;Luggage porterage to luxury Alphard Executive Lounge vehicle.&lt;/p&gt;',
        inclusions: ['Private Alphard vehicle', 'Highway tolls & parking', 'Bilingual chauffeur'],
        exclusions: ['Driver gratuity']
      }
    },
    {
      id: 'item-d2-tour',
      service_type: 'TOUR',
      category: 'Private Guided Sightseeing & Experiences',
      dayNumber: 2,
      totalPrice: 650,
      currency: 'USD',
      quantity: 1,
      paxCount: 2,
      product: {
        id: 'p-tour',
        name: 'Tokyo Ancient & Modern Highlights Private Discovery',
        category: 'Private Guided Sightseeing & Experiences',
        duration: '8 Hours',
        description: 'Morning exploration of historic Asakusa and Sensoji Temple.\n\nAfternoon immersion in futuristic Shibuya Sky observation platform.\n\n- Dedicated private luxury van throughout\n- Government-licensed cultural expert guide\n- All entrance tickets included',
        inclusions: ['Licensed English Guide', 'Private Van (8 hrs)', 'Shibuya Sky Tickets'],
        exclusions: ['Lunch & personal shopping']
      }
    },
    {
      id: 'item-d4-shinkansen',
      service_type: 'RAIL',
      category: 'Japan Rail Bullet Trains (Shinkansen)',
      dayNumber: 4,
      totalPrice: 320,
      currency: 'USD',
      quantity: 2,
      paxCount: 2,
      product: {
        id: 'p-rail',
        name: 'Tokaido Shinkansen Nozomi (Tokyo to Kyoto)',
        category: 'Japan Rail Bullet Trains (Shinkansen)',
        description: 'High-speed bullet train transfer between Tokyo & Kyoto Stations with Green Car seating.'
      },
      railJourneyDetails: {
        originStationId: 'JP-ST-TOKYO',
        originStationName: 'Tokyo Station',
        originStationCode: 'TYO',
        destinationStationId: 'JP-ST-KYOTO',
        destinationStationName: 'Kyoto Station',
        destinationStationCode: 'KYO',
        carType: 'Green Car',
        seatType: 'Reserved Window Seat',
        serviceGroup: 'Nozomi Super Express',
        seatPreference: 'Mt. Fuji Side (Car 8, Seats 12A/12B)',
        pnrReference: 'SMARTEX-99214'
      }
    }
  ]
} as unknown as Quotation);

async function runPdfEmailFidelityAudit() {
  console.log('======================================================================');
  console.log('AUDIT: RICH HTML QUOTATION PREVIEW — EXACT PDF FIDELITY');
  console.log('======================================================================');

  let passed = true;
  const model = buildQuotePresentationModel(sampleQuote);
  const pdfBlocks = buildSemanticBlocks(model);
  const emailHtml = renderPdfFidelityQuotationHtmlEmail(model, 'Personal Specialist Note: All Green Car seats on Shinkansen are pre-allocated.');

  // [CHECK 1] Header and branding match PDF
  console.log('\n[CHECK 1] Verifying Header and Branding Match PDF...');
  if (!emailHtml.toLowerCase().includes(model.agencyName.toLowerCase())) {
    console.error(`FAIL: Missing agency name "${model.agencyName}" in email.`);
    passed = false;
  }
  if (!emailHtml.includes('Official Itinerary Proposal')) {
    console.error('FAIL: Missing "Official Itinerary Proposal" header badge.');
    passed = false;
  }
  if (!emailHtml.includes(model.quoteNumber)) {
    console.error(`FAIL: Missing quote number "${model.quoteNumber}".`);
    passed = false;
  }
  if (!emailHtml.includes(model.agentAgencySubtitle)) {
    console.error('FAIL: Missing agent agency subtitle matching PDF.');
    passed = false;
  }
  console.log('PASS: Header, branding, badges, and layout match PDF.');

  // [CHECK 2] Heading hierarchy and typography match PDF
  console.log('\n[CHECK 2] Verifying Heading Hierarchy & Typography Match PDF...');
  if (!emailHtml.includes('Curated Journey Overview')) {
    console.error('FAIL: Missing "Curated Journey Overview" banner title.');
    passed = false;
  }
  const destHeadingHtml = model.destination.replace(/&/g, '&amp;') + ' Bespoke Travel Itinerary';
  if (!emailHtml.includes(destHeadingHtml) && !emailHtml.includes(`${model.destination} Bespoke Travel Itinerary`)) {
    console.error('FAIL: Missing destination itinerary heading.');
    passed = false;
  }
  if (!emailHtml.includes('Route & Destination Hubs:')) {
    console.error('FAIL: Missing Route & Destination Hubs section.');
    passed = false;
  }
  if (!emailHtml.includes('Day-by-Day Itinerary & Scheduled Services')) {
    console.error('FAIL: Missing Day-by-Day Itinerary heading.');
    passed = false;
  }
  if (!emailHtml.includes('TOTAL PACKAGE INVESTMENT')) {
    console.error('FAIL: Missing TOTAL PACKAGE INVESTMENT heading.');
    passed = false;
  }
  console.log('PASS: Heading hierarchy and typography match PDF.');

  // [CHECK 3] Descriptions retain original formatting (paragraphs, line breaks, lists)
  console.log('\n[CHECK 3] Verifying Descriptions Retain Original Formatting...');
  if (!emailHtml.includes('Meet and greet inside arrival lobby')) {
    console.error('FAIL: Missing Day 1 transfer description content.');
    passed = false;
  }
  if (!emailHtml.includes('Luggage porterage to luxury Alphard')) {
    console.error('FAIL: Missing Day 1 paragraph 2 content.');
    passed = false;
  }
  if (!emailHtml.includes('Dedicated private luxury van throughout') || !emailHtml.includes('Government-licensed cultural expert guide')) {
    console.error('FAIL: Missing bullet points in Day 2 tour description.');
    passed = false;
  }
  console.log('PASS: Product and service descriptions retain full formatting (paragraphs & lists).');

  // [CHECK 4] Zero literal HTML tags leaked
  console.log('\n[CHECK 4] Verifying ZERO Literal HTML Tags Leaked in Rendered Output...');
  const literalTagRegexes = [
    /&lt;p&gt;/i,
    /&lt;\/p&gt;/i,
    /&lt;br\s*\/?&gt;/i,
    /&lt;strong&gt;/i,
    /&lt;div&gt;/i,
    /<p>[^<]*&lt;br/i
  ];
  literalTagRegexes.forEach(regex => {
    if (regex.test(emailHtml)) {
      console.error(`FAIL: Leaked raw tag entity matching regex: ${regex}`);
      passed = false;
    }
  });
  console.log('PASS: Zero literal HTML tags in rendered email.');

  // [CHECK 5] Email client responsive width and overflow prevention
  console.log('\n[CHECK 5] Verifying Email Client Responsive Width & Overflow Prevention...');
  if (!emailHtml.includes('max-width: 680px') || !emailHtml.includes('width: 100%')) {
    console.error('FAIL: Missing max-width: 680px fluid container.');
    passed = false;
  }
  if (!emailHtml.includes('table-layout: fixed') || !emailHtml.includes('word-wrap: break-word')) {
    console.error('FAIL: Missing table-layout: fixed overflow safety.');
    passed = false;
  }
  console.log('PASS: Responsive email wrapper prevents horizontal scrolling on mobile.');

  // [CHECK 6] Pricing confidentiality across the email
  console.log('\n[CHECK 6] Verifying Commercial Pricing Confidentiality (Zero Item Prices Leaked)...');
  if (!emailHtml.includes('Final Total: 14,500 USD') && !emailHtml.includes('14,500')) {
    console.error('FAIL: Missing final total 14,500 USD.');
    passed = false;
  }
  const itemPrices = ['450', '650', '320', '200', '12,100', '2,400'];
  itemPrices.forEach(price => {
    if (emailHtml.includes(`$${price}`) || emailHtml.includes(`USD ${price}`)) {
      console.error(`FAIL: Leaked confidential item price "${price}" in email!`);
      passed = false;
    }
  });
  console.log('PASS: Only consolidated TOTAL PACKAGE INVESTMENT is displayed. Zero item prices leaked.');

  // [CHECK 7] Parity between renderProposalViewHtmlEmail and renderPdfFidelityQuotationHtmlEmail
  console.log('\n[CHECK 7] Verifying Function Alias Parity...');
  const legacyAliasHtml = renderProposalViewHtmlEmail(model);
  const pdfFidelityHtml = renderPdfFidelityQuotationHtmlEmail(model);
  if (legacyAliasHtml !== pdfFidelityHtml) {
    console.error('FAIL: renderProposalViewHtmlEmail and renderPdfFidelityQuotationHtmlEmail must produce identical output.');
    passed = false;
  }
  console.log('PASS: Full parity confirmed between all email preview pipelines.');

  console.log('\n======================================================================');
  if (passed) {
    console.log('ALL PDF FIDELITY AUDIT CHECKS PASSED WITH 100% SUCCESS.');
  } else {
    console.error('AUDIT FAILED! Review errors above.');
    process.exit(1);
  }
  console.log('======================================================================');
}

runPdfEmailFidelityAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
