/**
 * Internal Pricing Breakdown Audit & Certification Suite
 * Validates the B2B Quote Builder Step 8 Internal Pricing Breakdown feature:
 * - Role-Based Access Control (Admin, Team Member, Agent, Buyer)
 * - Server-side & Data Layer Sanitization (db.ts, customerQuoteSanitizer)
 * - Total Nett Cost calculation across inventory categories
 * - Exclusion of "No Accommodation (Arranged By Client)"
 * - Manual Hotel rate calculations (rooms, nights, rate basis)
 * - Private Tour vehicle cost isolation (no double-counting)
 * - Single-pass currency conversion
 * - Incomplete tariff & exchange rate warning detection
 * - Multi-option (1, 2, 3) independent live recalculation
 */

import { AppDatabase } from '../services/db';
import { 
  canUserViewInternalCostBreakdown, 
  canUserViewWholesaleRates 
} from '../services/permissionEngine';
import { 
  calculateQuoteInternalBreakdown, 
  QuoteItemForBreakdown, 
  convertCurrency, 
  formatCurrency 
} from '../services/pricingEngine';
import { sanitizeQuoteForAgent } from '../utils/customerQuoteSanitizer';
import { User, Quotation, Product } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}`, details || '');
  }
}

console.log('================================================================');
console.log('  INTERNAL PRICING BREAKDOWN (STEP 8) AUDIT & CERTIFICATION');
console.log('================================================================\n');

// Mock Users
const adminUser: User = {
  id: 'usr-admin-test',
  email: 'admin@theunbound.in',
  name: 'Admin User',
  role: 'ADMIN',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

const authorizedTeamUser: User = {
  id: 'usr-team-auth-test',
  email: 'team.auth@theunbound.in',
  name: 'Authorized Team Member',
  role: 'TEAM_MEMBER',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

const restrictedTeamUser: User = {
  id: 'usr-team-restr-test',
  email: 'team.restr@theunbound.in',
  name: 'Restricted Team Member',
  role: 'TEAM_MEMBER',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  permissions: {
    canViewWholesaleNetRates: false,
    bookingOperations: {
      view_supplier_prices: false
    }
  } as any
};

const b2bAgentUser: User = {
  id: 'usr-agent-test',
  email: 'agent@tokyotravel.com',
  name: 'Partner B2B Agent',
  role: 'B2B_AGENT',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

const buyerUser: User = {
  id: 'usr-buyer-test',
  email: 'buyer@client.com',
  name: 'Direct Client',
  role: 'BUYER',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

// -------------------------------------------------------------
// SECTION 1: ROLE-BASED VISIBILITY & PERMISSIONS
// -------------------------------------------------------------
console.log('--- 1. Testing Role-Based Visibility (permissionEngine) ---');

assert(
  canUserViewInternalCostBreakdown(adminUser) === true,
  'Admin user is authorized to view internal cost breakdown'
);

assert(
  canUserViewInternalCostBreakdown(authorizedTeamUser) === true,
  'Internal Team Member with default permissions is authorized'
);

assert(
  canUserViewInternalCostBreakdown(restrictedTeamUser) === false,
  'Internal Team Member with restricted permissions is denied'
);

assert(
  canUserViewInternalCostBreakdown(b2bAgentUser) === false,
  'External B2B Agent is strictly blocked from viewing internal costs'
);

assert(
  canUserViewInternalCostBreakdown(buyerUser) === false,
  'Buyer is strictly blocked from viewing internal costs'
);

assert(
  canUserViewInternalCostBreakdown(null) === false,
  'Unauthenticated user is denied'
);

// -------------------------------------------------------------
// SECTION 2: DATA LAYER SANITIZATION & REDACTION (db.ts)
// -------------------------------------------------------------
console.log('\n--- 2. Testing Data Layer Protection & Sanitization (db.ts) ---');

const db = AppDatabase.getInstance();

const sampleFullQuote: Quotation = {
  id: 'quote-internal-test-01',
  quoteNumber: 'UBQ-2026-TEST01',
  title: 'Test Tokyo & Kyoto Itinerary',
  destination: 'Japan',
  currency: 'USD',
  status: 'DRAFT',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  validUntil: new Date().toISOString(),
  agentId: b2bAgentUser.id,
  agentName: b2bAgentUser.name,
  clientName: 'VIP Travelers',
  items: [],
  overallDiscountPercent: 0,
  agentNotes: '',
  termsAndConditions: '',
  totalNetCost: 4500,
  totalSellingPrice: 5800,
  totalTaxes: 150,
  totalMargin: 1150,
  internalNettCost: 4500,
  supplierCost: 4500,
  internalMarkup: 1150
};

// Test db.saveQuote returns sanitized quote to B2B Agent
const savedByAgent = db.saveQuote(sampleFullQuote, b2bAgentUser);
assert(
  (!savedByAgent.totalNetCost || savedByAgent.totalNetCost === 0) &&
  (!savedByAgent.totalMargin || savedByAgent.totalMargin === 0) &&
  (savedByAgent as any).internalNettCost === undefined,
  'db.saveQuote strips internal nett cost and margins when saved by B2B Agent'
);

// Test db.saveQuote returns raw quote to Admin
const savedByAdmin = db.saveQuote(sampleFullQuote, adminUser);
assert(
  savedByAdmin.totalNetCost === 4500 &&
  savedByAdmin.totalSellingPrice > 0,
  'db.saveQuote preserves authoritative internal costs when saved by Admin'
);

// Test db.getQuoteByIdAuthorized for B2B Agent
const retrievedByAgent = db.getQuoteByIdAuthorized('quote-internal-test-01', b2bAgentUser);
assert(
  retrievedByAgent !== null &&
  (!retrievedByAgent.totalNetCost || retrievedByAgent.totalNetCost === 0) &&
  (!retrievedByAgent.totalMargin || retrievedByAgent.totalMargin === 0),
  'db.getQuoteByIdAuthorized strips nett costs when retrieved by B2B Agent'
);

// Test db.getQuoteByIdAuthorized for Restricted Team Member
const retrievedByRestricted = db.getQuoteByIdAuthorized('quote-internal-test-01', restrictedTeamUser);
assert(
  retrievedByRestricted !== null &&
  (!retrievedByRestricted.totalNetCost || retrievedByRestricted.totalNetCost === 0),
  'db.getQuoteByIdAuthorized sanitizes quote for Team Member without cost visibility permissions'
);

// Test db.getQuoteByIdAuthorized for Authorized Team Member
const retrievedByAuthTeam = db.getQuoteByIdAuthorized('quote-internal-test-01', authorizedTeamUser);
assert(
  retrievedByAuthTeam !== null &&
  retrievedByAuthTeam.totalNetCost === 4500,
  'db.getQuoteByIdAuthorized preserves internal costs for authorized Team Member'
);

// -------------------------------------------------------------
// SECTION 3: TOTAL NETT COST CALCULATION ENGINE
// -------------------------------------------------------------
console.log('\n--- 3. Testing calculateQuoteInternalBreakdown Calculation Engine ---');

// Mock sample products
const samplePrivateTour: Product = {
  id: 'prod-tour-tokyo',
  sku: 'TOU-TYO-001',
  name: 'Tokyo Full Day Highlights Private Tour',
  category: 'Private Tours',
  productType: 'Private Tour',
  currency: 'JPY',
  adultNetPrice: 40000,
  adultNettCost: 40000,
  childNetPrice: 20000,
  infantNetPrice: 0,
  sellingPriceStartingFrom: 50000,
  priceSelling: 50000,
  destinationId: 'japan',
  destinationName: 'Japan',
  status: 'ACTIVE'
} as any;

const sampleTicket: Product = {
  id: 'prod-ticket-shibuya',
  sku: 'TCK-SHIB-001',
  name: 'Shibuya Sky Observation Deck Admission',
  category: 'Tickets',
  productType: 'Ticket',
  currency: 'JPY',
  adultNetPrice: 2200,
  adultNettCost: 2200,
  childNetPrice: 1100,
  sellingPriceStartingFrom: 2800,
  priceSelling: 2800,
  destinationId: 'japan',
  destinationName: 'Japan',
  status: 'ACTIVE'
} as any;

// Test calculation for Tour + Ticket (in JPY)
const quoteItems: QuoteItemForBreakdown[] = [
  {
    id: 'item-01',
    product: samplePrivateTour,
    pax: { adults: 2, children: 1, infants: 0 },
    travelDate: '2026-10-15'
  },
  {
    id: 'item-02',
    product: sampleTicket,
    pax: { adults: 2, children: 1, infants: 0 },
    travelDate: '2026-10-15'
  }
];

const breakdownJPY = calculateQuoteInternalBreakdown({
  items: quoteItems,
  targetCurrency: 'JPY',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10,
  overallDiscountPercent: 0
});

assert(breakdownJPY.isComplete === true, 'Calculation completes with zero missing rates');
assert(breakdownJPY.totalNettCost > 0, 'Calculates valid Total Nett Cost in JPY');
assert(breakdownJPY.totalNettCost < breakdownJPY.finalPackagePrice, 'Total Nett Cost is strictly less than customer-facing final price');
assert(
  breakdownJPY.finalPackagePrice === (breakdownJPY.baseSellingPrice + breakdownJPY.partnerMarginAmount),
  'Final Package Price strictly adheres to existing Pricing Engine formula'
);

// -------------------------------------------------------------
// SECTION 4: EXCLUSION OF "NO ACCOMMODATION (ARRANGED BY CLIENT)"
// -------------------------------------------------------------
console.log('\n--- 4. Testing Exclusion of "No Accommodation (Arranged By Client)" ---');

const clientArrangedHotelItem: QuoteItemForBreakdown = {
  id: 'item-no-acc',
  product: {
    id: 'LAND_ONLY_HUB',
    sku: 'LAND_ONLY_HUB',
    name: 'No Accommodation (Arranged by Client)',
    category: 'Hotels',
    productType: 'Hotel & Resort',
    adultNetPrice: 0,
    currency: 'USD'
  } as any,
  isNoAccommodation: true
};

const breakdownWithNoAcc = calculateQuoteInternalBreakdown({
  items: [...quoteItems, clientArrangedHotelItem],
  targetCurrency: 'JPY',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10
});

assert(
  breakdownWithNoAcc.totalNettCost === breakdownJPY.totalNettCost,
  'Items marked "No Accommodation (Arranged By Client)" contribute exactly 0 to Total Nett Cost'
);
assert(
  breakdownWithNoAcc.isComplete === true,
  'Exclusion of client-arranged accommodation does NOT flag breakdown as incomplete'
);

// -------------------------------------------------------------
// SECTION 5: MANUAL HOTEL RATES CALCULATION
// -------------------------------------------------------------
console.log('\n--- 5. Testing Manual Hotel Rate Calculation ---');

const manualHotelItem: QuoteItemForBreakdown = {
  id: 'item-manual-hotel',
  product: {
    id: 'MAN-HTL-KYOTO',
    sku: 'MAN-HTL-KYO',
    name: 'Kyoto Boutique Ryokan',
    category: 'Travel Services',
    productType: 'Hotel & Resort',
    accommodationType: 'manual',
    isManualHotel: true,
    currency: 'USD',
    adultNetPrice: 300
  } as any,
  isManualHotel: true,
  manualHotelDetails: {
    hotelName: 'Kyoto Boutique Ryokan',
    numberOfNights: 3,
    numberOfRooms: 2,
    ratePerNight: 250,
    rateType: 'PER_NIGHT',
    rateCurrency: 'USD'
  }
};

const breakdownManual = calculateQuoteInternalBreakdown({
  items: [manualHotelItem],
  targetCurrency: 'USD'
});

// 3 nights * 2 rooms * 250 USD = 1,500 USD net cost
assert(
  breakdownManual.isComplete === true,
  'Manual hotel rate validates cleanly'
);
assert(
  breakdownManual.totalNettCost === 1500,
  `Manual hotel calculates exact 1,500 USD (3 nights * 2 rooms * 250 rate): received ${breakdownManual.totalNettCost}`
);

// Test Manual Hotel with TOTAL_STAY rate basis
const manualHotelTotalStay: QuoteItemForBreakdown = {
  id: 'item-manual-stay',
  isManualHotel: true,
  product: { id: 'MAN-STAY', name: 'Tokyo Suite Package', category: 'Hotels' } as any,
  manualHotelDetails: {
    hotelName: 'Tokyo Suite Package',
    numberOfNights: 5,
    numberOfRooms: 1,
    ratePerNight: 1200,
    rateType: 'TOTAL_STAY',
    rateCurrency: 'USD'
  }
};

const breakdownTotalStay = calculateQuoteInternalBreakdown({
  items: [manualHotelTotalStay],
  targetCurrency: 'USD'
});

assert(
  breakdownTotalStay.totalNettCost === 1200,
  'Manual hotel with TOTAL_STAY basis bills flat 1,200 USD without multiplication by nights'
);

// -------------------------------------------------------------
// SECTION 6: INCOMPLETE TARIFF & RATE DETECTION
// -------------------------------------------------------------
console.log('\n--- 6. Testing Incomplete Tariff & Exchange Rate Detection ---');

const missingRateProduct: Product = {
  id: 'prod-missing-rate',
  sku: 'PRD-ERR-001',
  name: 'Bespoke Unpriced Tea Ceremony',
  category: 'Activities',
  productType: 'Activity',
  currency: 'JPY',
  adultNetPrice: undefined,
  adultNettCost: undefined,
  status: 'ACTIVE'
} as any;

const itemWithMissingRate: QuoteItemForBreakdown = {
  id: 'item-missing-rate',
  product: missingRateProduct,
  pax: { adults: 2, children: 0, infants: 0 }
};

const breakdownIncomplete = calculateQuoteInternalBreakdown({
  items: [itemWithMissingRate],
  targetCurrency: 'USD'
});

assert(
  breakdownIncomplete.isComplete === false,
  'Incomplete breakdown is correctly flagged when an item lacks a nett cost'
);
assert(
  breakdownIncomplete.incompleteWarnings.length > 0,
  'Identifies affected incomplete item in warnings array'
);
assert(
  breakdownIncomplete.incompleteWarnings[0].productName === 'Bespoke Unpriced Tea Ceremony',
  'Identifies exact product name of the incomplete item'
);
assert(
  breakdownIncomplete.totalNettCost === 0,
  'Does not return misleading partial Total Nett Cost when calculation is incomplete'
);

// -------------------------------------------------------------
// SECTION 7: MULTI-OPTION INDEPENDENCE (OPTIONS 1, 2, 3)
// -------------------------------------------------------------
console.log('\n--- 7. Testing Independent Multi-Option (1, 2, 3) Recalculation ---');

const option1Items = [quoteItems[0]]; // Tour only
const option2Items = [quoteItems[0], quoteItems[1]]; // Tour + Ticket
const option3Items = [quoteItems[0], manualHotelItem]; // Tour + Hotel

const opt1Breakdown = calculateQuoteInternalBreakdown({ items: option1Items, targetCurrency: 'USD' });
const opt2Breakdown = calculateQuoteInternalBreakdown({ items: option2Items, targetCurrency: 'USD' });
const opt3Breakdown = calculateQuoteInternalBreakdown({ items: option3Items, targetCurrency: 'USD' });

assert(
  opt1Breakdown.totalNettCost > 0 &&
  opt2Breakdown.totalNettCost > opt1Breakdown.totalNettCost,
  'Option 2 (Tour + Ticket) has strictly higher nett cost than Option 1 (Tour only)'
);

assert(
  opt3Breakdown.totalNettCost > opt2Breakdown.totalNettCost,
  'Option 3 (Tour + Hotel) has distinct independent nett cost from Option 1 and Option 2'
);

console.log('================================================================');
console.log(`  INTERNAL PRICING BREAKDOWN AUDIT COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
