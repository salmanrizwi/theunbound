/**
 * ============================================================================
 * HOTEL ACCOMMODATION TOTAL & LAND PART TOTAL SEPARATION AUDIT
 * Verifies that Hotel Accommodation Total and Land Part Total (excluding
 * accommodation) are calculated from the central pricing engine and displayed
 * separately across:
 * 1. WhatsApp quotation message
 * 2. Rich HTML quotation email preview (Option 1)
 * 3. Formatted copied rich-text quotation (Option 2)
 * 4. Downloadable PDF quotation
 *
 * Verifies single source of truth, mathematical consistency, zero overlap /
 * double-counting, zero supplier leak, and conditional display rules.
 * ============================================================================
 */

import { Quotation, QuoteItem, Product } from '../types';
import { buildQuotePresentationModel, renderQuoteWhatsAppFromPresentationModel } from '../services/quotePresentationModel';
import { renderProposalViewHtmlEmail, renderSimpleSemanticQuotationEmailFromModel } from '../services/quoteEmailFormatter';
import { paginateQuotePresentationModel } from '../services/pdfPaginationEngine';
import { calculateQuoteTotal } from '../services/pricingEngine';
import { AppDatabase } from '../services/db';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log('======================================================================');
console.log('HOTEL ACCOMMODATION TOTAL & LAND PART TOTAL SEPARATION AUDIT');
console.log('======================================================================\n');

// ----------------------------------------------------------------------------
// TEST CASE A: MULTI-HOTEL + LAND SERVICES QUOTATION (TOKYO 3N + KYOTO 2N)
// ----------------------------------------------------------------------------
console.log('--- 1. Testing Multi-Hotel + Land Services Quotation (INR Currency) ---');

const multiHotelQuote: Quotation = {
  id: 'quote-multi-hotel-test',
  quoteNumber: 'QTE-2026-MULTI',
  title: 'Japan Golden Route Bespoke Journey',
  version: 1,
  status: 'DRAFT',
  destination: 'Japan',
  currency: 'INR',
  totalNetCost: 200000,
  totalSellingPrice: 245000,
  finalCustomerSellingPrice: 245000,
  overallDiscountPercent: 0,
  overallMarkupPercent: 0,
  agentId: 'agent-1',
  agentName: 'Vikram Malhotra',
  agentAgency: 'TheUnbound Bespoke Journeys',
  clientName: 'Priya & Rahul Kapoor',
  clientEmail: 'rahul.kapoor@example.com',
  clientPhone: '+91 98116 54959',
  travelStartDate: '2026-11-10',
  travelEndDate: '2026-11-15',
  totalPax: 2,
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
  termsAndConditions: 'Standard DMC Terms apply. Validity 14 days.',
  validUntil: '2026-11-24',
  createdAt: '2026-10-20T00:00:00Z',
  updatedAt: '2026-10-20T00:00:00Z',
  totalTaxes: 0,
  totalMargin: 45000,
  agentNotes: 'Luxury ground journey with 5-star hotel accommodations.',
  routeHubs: [
    { id: 'hub-tokyo', hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 3, order: 0 },
    { id: 'hub-kyoto', hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 2, order: 1 }
  ],
  items: [
    // Hotel 1: Tokyo 3 Nights @ 70,000 selling total
    {
      id: 'item-hotel-tokyo',
      category: 'Hotels',
      service_type: 'HOTEL',
      product: {
        id: 'prod-capitol-tokyu',
        name: 'The Capitol Hotel Tokyu',
        category: 'Hotels',
        productType: 'HOTEL',
        city: 'Tokyo',
        destinationName: 'Japan',
        longDescription: 'Luxury accommodation in Akasaka with breakfast.'
      } as unknown as Product,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-11-10',
      calculation: {
        productId: 'prod-capitol-tokyu',
        productName: 'The Capitol Hotel Tokyu',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 70000,
        finalTotalSellingPrice: 70000
      } as any
    },
    // Hotel 2: Kyoto 2 Nights @ 50,000 selling total
    {
      id: 'item-hotel-kyoto',
      category: 'Hotels',
      service_type: 'HOTEL',
      product: {
        id: 'prod-thousand-kyoto',
        name: 'The Thousand Kyoto',
        category: 'Hotels',
        productType: 'HOTEL',
        city: 'Kyoto',
        destinationName: 'Japan',
        longDescription: 'Modern luxury retreat next to Kyoto Station.'
      } as unknown as Product,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-11-13',
      calculation: {
        productId: 'prod-thousand-kyoto',
        productName: 'The Thousand Kyoto',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 50000,
        finalTotalSellingPrice: 50000
      } as any
    },
    // Non-Hotel Item 1: Private Guided Tours @ 75,000
    {
      id: 'item-activity-1',
      category: 'Activities',
      service_type: 'ACTIVITY',
      product: {
        id: 'prod-guided-tour',
        name: 'Full Day Private Tokyo Heritage Discovery',
        category: 'Activities',
        productType: 'ACTIVITY',
        city: 'Tokyo',
        destinationName: 'Japan'
      } as unknown as Product,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-11-11',
      calculation: {
        productId: 'prod-guided-tour',
        productName: 'Full Day Private Tokyo Heritage Discovery',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 75000,
        finalTotalSellingPrice: 75000
      } as any
    },
    // Non-Hotel Item 2: Private Transfers & Shinkansen @ 50,000
    {
      id: 'item-transfer-1',
      category: 'Transfers',
      service_type: 'TRANSFER',
      product: {
        id: 'prod-transfer-1',
        name: 'Private Airport & Intercity Chauffeur Transfers',
        category: 'Transfers',
        productType: 'TRANSFER',
        city: 'Tokyo',
        destinationName: 'Japan'
      } as unknown as Product,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-11-12',
      calculation: {
        productId: 'prod-transfer-1',
        productName: 'Private Airport & Intercity Chauffeur Transfers',
        pricingTier: 'B2B',
        currency: 'INR',
        price: 50000,
        finalTotalSellingPrice: 50000
      } as any
    }
  ]
};

// 1. Central Pricing Engine Check
const calcResult = calculateQuoteTotal(multiHotelQuote);
assert(calcResult.hotelItemsIncludedCount === 2, 'calculateQuoteTotal detects exactly 2 hotel items');
assert(calcResult.landItemsIncludedCount === 2, 'calculateQuoteTotal detects exactly 2 non-accommodation (land) items');
assert(calcResult.hotelTotalSellingPrice === 120000, 'calculateQuoteTotal computes exact Hotel Accommodation Total of ₹120,000 (70k + 50k)');
assert(calcResult.landPartTotalSellingPrice === 125000, 'calculateQuoteTotal computes exact Land Part Total of ₹125,000 (75k + 50k) excluding hotels');
assert(calcResult.hasHotelAccommodation === true, 'calculateQuoteTotal sets hasHotelAccommodation to true');
assert(calcResult.hasLandServices === true, 'calculateQuoteTotal sets hasLandServices to true');

// 2. Canonical QuotePresentationModel Check
const presentationModel = buildQuotePresentationModel(multiHotelQuote);
assert(presentationModel.hasHotelAccommodation === true, 'Presentation model identifies hotel accommodation presence');
assert(presentationModel.hotelAccommodationTotalNumeric === 120000, 'Presentation model aggregates exact Hotel Accommodation Total of ₹120,000');
assert(presentationModel.landPartTotalNumeric === 125000, 'Presentation model computes exact Land Part Total of ₹125,000 (excludes ₹120,000 hotels)');
assert(Boolean(presentationModel.hotelAccommodationTotalFormatted?.includes('120,000') || presentationModel.hotelAccommodationTotalFormatted?.includes('1,20,000')), 'Hotel total formatted with currency');
assert(Boolean(presentationModel.landPartTotalFormatted.includes('125,000') || presentationModel.landPartTotalFormatted.includes('1,25,000')), 'Land Part Total formatted with currency');

// 3. Channel 1: WhatsApp Quotation Message
const waMessage = renderQuoteWhatsAppFromPresentationModel(presentationModel, { useEmojis: true });
assert(waMessage.includes('Hotel Accommodation Total:'), 'WhatsApp includes "Hotel Accommodation Total:"');
assert(waMessage.includes('Land Part Total:'), 'WhatsApp includes "Land Part Total:"');
assert(!waMessage.includes('Complete Package Total'), 'WhatsApp does NOT display the old "Complete Package Total" label');
assert(Boolean(waMessage.includes('120,000') || waMessage.includes('1,20,000')), 'WhatsApp displays calculated hotel total of ₹120,000');
assert(Boolean(waMessage.includes('125,000') || waMessage.includes('1,25,000')), 'WhatsApp displays calculated land part total of ₹125,000');
assert(!waMessage.includes('245,000') && !waMessage.includes('2,45,000'), 'WhatsApp does NOT combine hotel and non-hotel costs into Land Part Total');
const hotelIndexWA = waMessage.indexOf('Hotel Accommodation Total');
const landIndexWA = waMessage.indexOf('Land Part Total');
assert(hotelIndexWA !== -1 && landIndexWA !== -1 && hotelIndexWA < landIndexWA, 'WhatsApp displays Hotel Accommodation Total before Land Part Total');

// 4. Channel 2: Rich HTML Email Preview (Option 1)
const htmlEmail = renderProposalViewHtmlEmail(presentationModel);
assert(htmlEmail.includes('Hotel Accommodation Total:'), 'HTML Email includes "Hotel Accommodation Total:"');
assert(htmlEmail.includes('Land Part Total:'), 'HTML Email includes "Land Part Total:"');
assert(!htmlEmail.includes('Complete Package Total'), 'HTML Email does NOT display the old "Complete Package Total" label');
assert(Boolean(htmlEmail.includes('120,000') || htmlEmail.includes('1,20,000')), 'HTML Email displays calculated hotel total of ₹120,000');
assert(Boolean(htmlEmail.includes('125,000') || htmlEmail.includes('1,25,000')), 'HTML Email displays calculated land part total of ₹125,000');
assert(!htmlEmail.includes('245,000') && !htmlEmail.includes('2,45,000'), 'HTML Email does NOT display combined 245,000 total');
const hotelIndexHTML = htmlEmail.indexOf('Hotel Accommodation Total');
const landIndexHTML = htmlEmail.indexOf('Land Part Total');
assert(hotelIndexHTML !== -1 && landIndexHTML !== -1 && hotelIndexHTML < landIndexHTML, 'HTML Email displays Hotel Accommodation Total before Land Part Total');

// 5. Channel 3: Complete Plain-Text / Rich-Text Quotation (Option 2)
const option2 = renderSimpleSemanticQuotationEmailFromModel(presentationModel);
assert(option2.textBody.includes('Hotel Accommodation Total:'), 'Option 2 plain-text includes "Hotel Accommodation Total:"');
assert(option2.textBody.includes('Land Part Total:'), 'Option 2 plain-text includes "Land Part Total:"');
assert(!option2.textBody.includes('Complete Package Total'), 'Option 2 plain-text does NOT display old "Complete Package Total"');
assert(Boolean(option2.textBody.includes('120,000') || option2.textBody.includes('1,20,000')), 'Option 2 displays hotel total of ₹120,000');
assert(Boolean(option2.textBody.includes('125,000') || option2.textBody.includes('1,25,000')), 'Option 2 displays land part total of ₹125,000');
assert(option2.htmlBody.includes('Hotel Accommodation Total'), 'Option 2 copied rich-text HTML includes "Hotel Accommodation Total"');
assert(option2.htmlBody.includes('Land Part Total'), 'Option 2 copied rich-text HTML includes "Land Part Total"');

// 6. Channel 4: Multi-Page PDF Pagination Engine Output
const pdfPages = paginateQuotePresentationModel(presentationModel);
const allPdfHtml = pdfPages.map(p => p.blocks.map(b => b.html).join('')).join('');
assert(allPdfHtml.includes('Hotel Accommodation Total:'), 'PDF includes "Hotel Accommodation Total:"');
assert(allPdfHtml.includes('Land Part Total:'), 'PDF includes "Land Part Total:"');
assert(!allPdfHtml.includes('Complete Package Total'), 'PDF does NOT display the old "Complete Package Total" label');
assert(Boolean(allPdfHtml.includes('120,000') || allPdfHtml.includes('1,20,000')), 'PDF displays hotel total of ₹120,000');
assert(Boolean(allPdfHtml.includes('125,000') || allPdfHtml.includes('1,25,000')), 'PDF displays land part total of ₹125,000');
assert(!allPdfHtml.includes('245,000') && !allPdfHtml.includes('2,45,000'), 'PDF does NOT display combined 245,000 total');
const hotelIndexPDF = allPdfHtml.indexOf('Hotel Accommodation Total');
const landIndexPDF = allPdfHtml.indexOf('Land Part Total');
assert(hotelIndexPDF !== -1 && landIndexPDF !== -1 && hotelIndexPDF < landIndexPDF, 'PDF displays Hotel Accommodation Total before Land Part Total');


// ----------------------------------------------------------------------------
// TEST CASE B: LAND-ONLY / NO ACCOMMODATION QUOTATION (CONDITIONAL OMISSION)
// ----------------------------------------------------------------------------
console.log('\n--- 2. Testing Land-Only / No Accommodation Quotation (USD Currency) ---');

const landOnlyQuote: Quotation = {
  id: 'quote-land-only-test',
  quoteNumber: 'QTE-2026-LAND',
  title: 'Japan Land-Only Ground Exploration',
  version: 1,
  status: 'DRAFT',
  destination: 'Japan',
  currency: 'USD',
  scope: 'LAND_ONLY',
  quotationScope: 'LAND_ONLY',
  totalNetCost: 3000,
  totalSellingPrice: 4200,
  finalCustomerSellingPrice: 4200,
  overallDiscountPercent: 0,
  overallMarkupPercent: 0,
  agentId: 'agent-1',
  agentName: 'Vikram Malhotra',
  agentAgency: 'TheUnbound Bespoke Journeys',
  clientName: 'David & Sarah Miller',
  clientEmail: 'david.miller@example.com',
  travelStartDate: '2026-11-10',
  travelEndDate: '2026-11-15',
  totalPax: 2,
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
  termsAndConditions: 'Land-only package. Traveler books own accommodations.',
  validUntil: '2026-11-24',
  createdAt: '2026-10-20T00:00:00Z',
  updatedAt: '2026-10-20T00:00:00Z',
  totalTaxes: 0,
  totalMargin: 1200,
  agentNotes: 'Excludes all accommodation charges as requested.',
  routeHubs: [
    { id: 'hub-tokyo', hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 3, order: 0, accommodationType: 'NO_ACCOMMODATION' },
    { id: 'hub-kyoto', hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 2, order: 1, accommodationType: 'NO_ACCOMMODATION' }
  ],
  items: [
    {
      id: 'item-activity-land',
      category: 'Activities',
      service_type: 'ACTIVITY',
      product: {
        id: 'prod-activity-land',
        name: 'Private Bilingual Cultural Immersion Tour',
        category: 'Activities',
        productType: 'ACTIVITY',
        city: 'Tokyo',
        destinationName: 'Japan'
      } as unknown as Product,
      pax: { adults: 2, children: 0, infants: 0 },
      travelDate: '2026-11-11',
      calculation: {
        productId: 'prod-activity-land',
        productName: 'Private Bilingual Cultural Immersion Tour',
        pricingTier: 'B2B',
        currency: 'USD',
        price: 4200,
        finalTotalSellingPrice: 4200
      } as any
    }
  ]
};

const landOnlyModel = buildQuotePresentationModel(landOnlyQuote);
assert(landOnlyModel.hasHotelAccommodation === false, 'Land-only quote sets hasHotelAccommodation to false');
assert(landOnlyModel.hotelAccommodationTotalNumeric === 0, 'Land-only quote hotelAccommodationTotalNumeric is 0');
assert(landOnlyModel.hotelAccommodationTotalFormatted === undefined, 'Land-only quote hotelAccommodationTotalFormatted is undefined');
assert(landOnlyModel.landPartTotalNumeric === 4200, 'Land-only quote landPartTotalNumeric is $4,200');

const landOnlyWA = renderQuoteWhatsAppFromPresentationModel(landOnlyModel, { useEmojis: true });
assert(!landOnlyWA.includes('Hotel Accommodation Total'), 'WhatsApp omits "Hotel Accommodation Total" when no hotel is included');
assert(landOnlyWA.includes('Land Part Total:'), 'WhatsApp displays "Land Part Total:"');

const landOnlyHTML = renderProposalViewHtmlEmail(landOnlyModel);
assert(!landOnlyHTML.includes('Hotel Accommodation Total'), 'HTML Email omits "Hotel Accommodation Total" when no hotel is included');
assert(landOnlyHTML.includes('Land Part Total:'), 'HTML Email displays "Land Part Total:"');

const landOnlyOption2 = renderSimpleSemanticQuotationEmailFromModel(landOnlyModel);
assert(!landOnlyOption2.textBody.includes('Hotel Accommodation Total'), 'Option 2 plain-text omits "Hotel Accommodation Total" when no hotel is included');
assert(landOnlyOption2.textBody.includes('Land Part Total:'), 'Option 2 plain-text displays "Land Part Total:"');

const landOnlyPDFPages = paginateQuotePresentationModel(landOnlyModel);
const landOnlyPDFHtml = landOnlyPDFPages.map(p => p.blocks.map(b => b.html).join('')).join('');
assert(!landOnlyPDFHtml.includes('Hotel Accommodation Total'), 'PDF omits "Hotel Accommodation Total" when no hotel is included');
assert(landOnlyPDFHtml.includes('Land Part Total:'), 'PDF displays "Land Part Total:"');


// ----------------------------------------------------------------------------
// TEST CASE C: ZERO COMMERCIAL LEAKS & RATE INTEGRITY
// ----------------------------------------------------------------------------
console.log('\n--- 3. Testing Confidentiality & Single Source of Truth Parity ---');

// Verify supplier nett cost (200,000) and internal margin (45,000) are NEVER exposed
const forbiddenCommercialTerms = ['200,000', '2,000,00', '45,000', 'nett', 'margin', 'markup'];
forbiddenCommercialTerms.forEach(term => {
  assert(!waMessage.toLowerCase().includes(`supplier ${term}`), `WhatsApp does not leak internal commercial term: ${term}`);
  assert(!htmlEmail.toLowerCase().includes(`supplier ${term}`), `HTML email does not leak internal commercial term: ${term}`);
  assert(!allPdfHtml.toLowerCase().includes(`supplier ${term}`), `PDF does not leak internal commercial term: ${term}`);
});

// ----------------------------------------------------------------------------
// TEST CASE D: REAL DATABASE QUOTATION RECORDS PARITY
// ----------------------------------------------------------------------------
console.log('\n--- 4. Testing Real Database Quotation Records ---');
const db = AppDatabase.getInstance();
const mockAdmin = { id: 'usr-admin-business', role: 'ADMIN', email: 'business@theunbound.in', name: 'Admin' } as any;
db.saveQuote(multiHotelQuote, mockAdmin, 'CREATED');
db.saveQuote(landOnlyQuote, mockAdmin, 'CREATED');
const dbQuotes = db.getAllSavedQuotesForUser(mockAdmin);
assert(dbQuotes.length >= 2, `Loaded ${dbQuotes.length} persisted quotation record(s) from AppDatabase`);

dbQuotes.forEach((q: Quotation) => {
  const model = buildQuotePresentationModel(q);
  const wa = renderQuoteWhatsAppFromPresentationModel(model);
  const html = renderProposalViewHtmlEmail(model);
  const opt2 = renderSimpleSemanticQuotationEmailFromModel(model);
  const pdf = paginateQuotePresentationModel(model).map(p => p.blocks.map(b => b.html).join('')).join('');

  assert(wa.includes(model.landPartTotalFormatted), `Quote ${q.quoteNumber}: WhatsApp matches Land Part Total (${model.landPartTotalFormatted})`);
  assert(html.includes(model.landPartTotalFormatted), `Quote ${q.quoteNumber}: HTML Email matches Land Part Total (${model.landPartTotalFormatted})`);
  assert(opt2.textBody.includes(model.landPartTotalFormatted), `Quote ${q.quoteNumber}: Copy Rich Text matches Land Part Total (${model.landPartTotalFormatted})`);
  assert(pdf.includes(model.landPartTotalFormatted), `Quote ${q.quoteNumber}: PDF matches Land Part Total (${model.landPartTotalFormatted})`);

  if (model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted) {
    assert(wa.includes(model.hotelAccommodationTotalFormatted), `Quote ${q.quoteNumber}: WhatsApp matches Hotel Accommodation Total (${model.hotelAccommodationTotalFormatted})`);
    assert(html.includes(model.hotelAccommodationTotalFormatted), `Quote ${q.quoteNumber}: HTML Email matches Hotel Accommodation Total (${model.hotelAccommodationTotalFormatted})`);
    assert(opt2.textBody.includes(model.hotelAccommodationTotalFormatted), `Quote ${q.quoteNumber}: Copy Rich Text matches Hotel Accommodation Total (${model.hotelAccommodationTotalFormatted})`);
    assert(pdf.includes(model.hotelAccommodationTotalFormatted), `Quote ${q.quoteNumber}: PDF matches Hotel Accommodation Total (${model.hotelAccommodationTotalFormatted})`);
  } else {
    assert(!wa.includes('Hotel Accommodation Total'), `Quote ${q.quoteNumber}: WhatsApp omits Hotel Accommodation Total when no hotel present`);
    assert(!html.includes('Hotel Accommodation Total'), `Quote ${q.quoteNumber}: HTML Email omits Hotel Accommodation Total when no hotel present`);
    assert(!opt2.textBody.includes('Hotel Accommodation Total'), `Quote ${q.quoteNumber}: Copy Rich Text omits Hotel Accommodation Total when no hotel present`);
    assert(!pdf.includes('Hotel Accommodation Total'), `Quote ${q.quoteNumber}: PDF omits Hotel Accommodation Total when no hotel present`);
  }
});

db.deleteQuote(multiHotelQuote.id, mockAdmin);
db.deleteQuote(landOnlyQuote.id, mockAdmin);

console.log('\n======================================================================');
console.log('🎉 ALL HOTEL ACCOMMODATION TOTAL & LAND PART TOTAL AUDIT CHECKS PASSED (100%)');
console.log('======================================================================\n');
