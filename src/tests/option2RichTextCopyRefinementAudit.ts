import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import { formatPlainTextQuotationToHtml, renderSimpleSemanticQuotationEmailFromModel } from '../services/quoteEmailFormatter';
import { Quotation } from '../types';

/**
 * ============================================================================
 * THEUNBOUND — AUDIT: OPTION 2 COMPLETE FORMATTED QUOTATION RICH TEXT REFINEMENT
 * ============================================================================
 * Verifies that Option 2 (Complete Formatted Quotation — Copy Rich Text)
 * produces clean, professional, well-structured content with NO oversized
 * horizontal rules, subtle compact separators, and preserved descriptions.
 */

const sampleQuote: Quotation = ({
  id: 'quote-audit-option-2-refinement',
  quoteNumber: 'UBQ-2026-OPT2-99',
  version: 2,
  status: 'SENT',
  leadId: 'lead-test-2',
  agentId: 'agent-102',
  agentName: 'Aarav Mehta',
  agentAgency: 'TheUnbound Luxury Journeys',
  agentEmail: 'aarav@theunbound.in',
  agentPhone: '+91-9811654959',
  clientName: 'Lady Eleanor Vance',
  clientCompany: 'Vance Heritage Trust',
  clientEmail: 'eleanor@vance-heritage.co.uk',
  clientPhone: '+44-20-7946-0987',
  destination: 'Japan Golden Route',
  travelStartDate: '2026-10-15',
  travelEndDate: '2026-10-22',
  paxCount: 2,
  adults: 2,
  children: 0,
  infants: 0,
  effectivePax: 2,
  currency: 'USD',
  totalAmount: 18500,
  totalSellingPrice: 18500,
  finalCustomerSellingPrice: 18500,
  createdAt: '2026-10-01T08:00:00Z',
  validUntil: '2026-10-31T23:59:59Z',
  routeHubs: [
    { id: 'hub-tokyo', hubId: 'tokyo', hubName: 'Tokyo', nights: 3, order: 1 },
    { id: 'hub-kyoto', hubId: 'kyoto', hubName: 'Kyoto', nights: 4, order: 2 }
  ],
  items: [
    {
      id: 'item-trf-1',
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
        description: '<p>Meet and greet inside arrival lobby with custom welcome signage.</p><br/><p>Luggage porterage to luxury Alphard Executive vehicle.</p>',
        inclusions: ['Private Alphard vehicle', 'Highway tolls & parking', 'Bilingual chauffeur'],
        exclusions: ['Driver gratuity']
      }
    },
    {
      id: 'item-tour-2',
      service_type: 'TOUR',
      category: 'Private Guided Sightseeing & Experiences',
      dayNumber: 2,
      totalPrice: 750,
      currency: 'USD',
      quantity: 1,
      paxCount: 2,
      product: {
        id: 'p-tour',
        name: 'Tokyo Ancient & Modern Highlights Discovery',
        category: 'Private Guided Sightseeing & Experiences',
        duration: '8 Hours',
        description: 'Morning exploration of historic Asakusa and Sensoji Temple.\n\nAfternoon immersion in futuristic Shibuya Sky observation platform.\n\n- Dedicated private luxury van throughout\n- Government-licensed cultural expert guide\n- All entrance tickets included',
        inclusions: ['Licensed English Guide', 'Private Van (8 hrs)', 'Shibuya Sky Tickets'],
        exclusions: ['Lunch & personal shopping']
      }
    }
  ]
} as unknown as Quotation);

async function runOption2RefinementAudit() {
  console.log('======================================================================');
  console.log('AUDIT: OPTION 2 COMPLETE FORMATTED QUOTATION RICH TEXT REFINEMENT');
  console.log('======================================================================');

  let passed = true;
  const model = buildQuotePresentationModel(sampleQuote);
  const { htmlBody, textBody } = renderSimpleSemanticQuotationEmailFromModel(model, 'Personal note: Green Car tickets confirmed.');

  // [CHECK 1] Verify NO oversized full-width horizontal divider lines
  console.log('\n[CHECK 1] Verifying NO oversized full-width horizontal lines...');
  
  // A. Check for raw full-width character lines (like ───────, =======, -------, _______ with 20+ chars)
  const longRuleRegex = /[─=\-_—]{15,}/g;
  const rawLongLinesInText = (textBody.match(longRuleRegex) || []);
  if (rawLongLinesInText.length > 0) {
    console.error(`FAIL: textBody contains ${rawLongLinesInText.length} oversized character dividers:`, rawLongLinesInText[0]);
    passed = false;
  }

  // B. Check that htmlBody contains NO full-width borders stretching across the content
  if (htmlBody.includes('border-bottom: 1px solid') || htmlBody.includes('border-bottom:1px solid')) {
    console.error('FAIL: htmlBody contains full-width border-bottom divider line.');
    passed = false;
  }
  if (htmlBody.includes('<hr') && !htmlBody.includes('width: 36px') && !htmlBody.includes('width: 42px')) {
    console.error('FAIL: htmlBody contains full-width <hr> divider.');
    passed = false;
  }
  console.log('PASS: Zero oversized full-width horizontal rules or borders detected.');

  // [CHECK 2] Verify subtle, compact section separators
  console.log('\n[CHECK 2] Verifying subtle, compact section separators...');
  if (htmlBody.includes('width: 36px') || htmlBody.includes('width: 42px')) {
    console.log('PASS: Found compact subtle section separators (width <= 42px).');
  } else {
    console.error('FAIL: Missing compact section separator.');
    passed = false;
  }

  // [CHECK 3] Headings clearly distinguish quotation sections
  console.log('\n[CHECK 3] Verifying clear heading hierarchy...');
  if (!htmlBody.includes('<h1') || !htmlBody.includes('THEUNBOUND')) {
    console.error('FAIL: Missing main quotation <h1> title.');
    passed = false;
  }
  if (!htmlBody.includes('<h2') || !htmlBody.includes('TRIP OVERVIEW')) {
    console.error('FAIL: Missing major section <h2> heading.');
    passed = false;
  }
  if (!htmlBody.includes('<h3') || !htmlBody.includes('DAY 1')) {
    console.error('FAIL: Missing day <h3> heading.');
    passed = false;
  }
  console.log('PASS: Heading hierarchy clearly distinguishes quotation sections.');

  // [CHECK 4] Product & service names remain easy to identify
  console.log('\n[CHECK 4] Verifying product and service names...');
  if (!htmlBody.includes('Haneda Airport (HND) VIP Chauffeur Transfer')) {
    console.error('FAIL: Missing Day 1 transfer product name.');
    passed = false;
  }
  if (!htmlBody.includes('Tokyo Ancient &amp; Modern Highlights Discovery') && !htmlBody.includes('Tokyo Ancient & Modern Highlights Discovery')) {
    console.error('FAIL: Missing Day 2 tour product name.');
    passed = false;
  }
  console.log('PASS: Product and service names are prominently formatted.');

  // [CHECK 5] Preserved description formatting & ZERO literal tags
  console.log('\n[CHECK 5] Verifying description formatting & zero literal tags...');
  if (!htmlBody.includes('Meet and greet inside arrival lobby') || !htmlBody.includes('Luggage porterage to luxury Alphard')) {
    console.error('FAIL: Day 1 description content was truncated or missing.');
    passed = false;
  }
  const leakedTags = ['<br/>', '<br />', '</br>', '&lt;p&gt;', '&lt;br/&gt;', '&lt;strong&gt;', '**'];
  leakedTags.forEach(tag => {
    if (htmlBody.includes(tag)) {
      console.error(`FAIL: Leaked raw tag or marker "${tag}" in htmlBody.`);
      passed = false;
    }
  });
  console.log('PASS: Description formatting preserved with zero leaked literal tags.');

  // [CHECK 6] Pricing confidentiality
  console.log('\n[CHECK 6] Verifying pricing confidentiality...');
  if (!htmlBody.includes('18,500 USD') && !htmlBody.includes('18,500')) {
    console.error('FAIL: Missing consolidated package total.');
    passed = false;
  }
  const itemPrices = ['450', '750'];
  itemPrices.forEach(price => {
    if (htmlBody.includes(`$${price}`) || htmlBody.includes(`USD ${price}`)) {
      console.error(`FAIL: Leaked confidential item price "${price}" in Option 2.`);
      passed = false;
    }
  });
  console.log('PASS: Strictly consolidated total package investment displayed.');

  // [CHECK 7] Verify plain text and HTML conversion parity
  console.log('\n[CHECK 7] Verifying formatPlainTextQuotationToHtml directly...');
  const directHtml = formatPlainTextQuotationToHtml(textBody);
  if (directHtml.includes('border-bottom: 1px solid')) {
    console.error('FAIL: formatPlainTextQuotationToHtml emitted full-width border-bottom.');
    passed = false;
  }
  if (directHtml.includes('──────────────────') || directHtml.includes('==================')) {
    console.error('FAIL: formatPlainTextQuotationToHtml leaked raw divider characters.');
    passed = false;
  }
  console.log('PASS: formatPlainTextQuotationToHtml produces clean, compact rich text.');

  console.log('\n======================================================================');
  if (passed) {
    console.log('ALL OPTION 2 RICH TEXT REFINEMENT CHECKS PASSED WITH 100% SUCCESS.');
  } else {
    console.error('AUDIT FAILED! Review errors above.');
    process.exit(1);
  }
  console.log('======================================================================');
}

runOption2RefinementAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
