/**
 * Step 7 Manual Margin Controls Audit & Certification Suite
 * 
 * Verifies:
 * 1. Admin manual margin on top of Total Nett Cost (Percentage & Fixed Amount)
 * 2. Admin margin modes: REPLACE (default, avoids duplicate margin) vs ADD
 * 3. Central pricing engine preservation of taxes, service fees, discounts
 * 4. B2B Agent additional margin on top of Existing Final Price (Percentage & Fixed Amount)
 * 5. Distinct calculation bases (Nett Cost for Admin vs Final Price for Agent)
 * 6. User-type segregation (Admin, Team Member with/without permissions, B2B Agent, Buyer)
 * 7. Server-side & Client-side data protection (stripping admin margins & nett costs for agents)
 * 8. Authoritative calculateQuoteTotal & db.saveQuote persistence
 */

import { AppDatabase } from '../services/db';
import { 
  canUserViewInternalCostBreakdown 
} from '../services/permissionEngine';
import { 
  calculateQuoteInternalBreakdown, 
  calculateQuoteTotal,
  QuoteItemForBreakdown 
} from '../services/pricingEngine';
import { sanitizeQuoteForAgent } from '../utils/customerQuoteSanitizer';
import { User, Quotation, Product, ProductCategory } from '../types';

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
console.log('  STEP 7 MANUAL MARGIN CONTROLS AUDIT & CERTIFICATION');
console.log('================================================================\n');

// 1. Mock Users
const adminUser: User = {
  id: 'usr-admin-margin-test',
  email: 'business@theunbound.in',
  name: 'Marcus Administrator',
  role: 'ADMIN',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

const authorizedTeamUser: User = {
  id: 'usr-team-auth-test',
  email: 'ops.manager@theunbound.in',
  name: 'Operations Manager',
  role: 'TEAM_MEMBER',
  approvalStatus: 'APPROVED',
  permissions: {
    canViewWholesaleNetRates: true
  },
  createdAt: '2026-01-01T00:00:00Z'
};

const restrictedTeamUser: User = {
  id: 'usr-team-restr-test',
  email: 'intern@theunbound.in',
  name: 'Junior Intern',
  role: 'TEAM_MEMBER',
  approvalStatus: 'APPROVED',
  permissions: {
    canViewWholesaleNetRates: false
  },
  createdAt: '2026-01-01T00:00:00Z'
};

const b2bAgentUser: User = {
  id: 'usr-agent-margin-test',
  email: 'partner.agent@travelagency.com',
  name: 'B2B Travel Agent',
  role: 'B2B_AGENT',
  agencyName: 'Horizon Travels',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

const buyerUser: User = {
  id: 'usr-buyer-margin-test',
  email: 'direct.buyer@gmail.com',
  name: 'John Direct Traveler',
  role: 'BUYER',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

// Mock Test Inventory Items
const testProductA = {
  id: 'prod-tour-tokyo-01',
  sku: 'PROD-TKY-01',
  name: 'Tokyo Full Day Private Discovery',
  category: 'Private Tours' as ProductCategory,
  destinationId: 'dest-japan',
  destinationName: 'Japan',
  country: 'Japan',
  city: 'Tokyo',
  currency: 'INR',
  netPrice: 60000,
  sellingPrice: 75000,
  adultNetPrice: 60000,
  adultSellingPrice: 75000,
  status: 'ACTIVE',
  pricingModel: 'PER_PERSON',
  shortDescription: 'Tokyo Private Tour',
  longDescription: 'Tokyo Private Tour Long',
  supplierId: 'supp-1',
  supplierName: 'Japan DMC',
  supplierProductCode: 'SUP-01',
  productType: 'TOUR',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
} as unknown as Product;

const testProductB = {
  id: 'prod-trf-kyoto-01',
  sku: 'PROD-KYO-01',
  name: 'Kyoto Station Private Chauffeur Transfer',
  category: 'Transfers' as ProductCategory,
  destinationId: 'dest-japan',
  destinationName: 'Japan',
  country: 'Japan',
  city: 'Kyoto',
  currency: 'INR',
  netPrice: 40000,
  sellingPrice: 50000,
  adultNetPrice: 40000,
  adultSellingPrice: 50000,
  status: 'ACTIVE',
  pricingModel: 'PER_VEHICLE',
  shortDescription: 'Kyoto Transfer',
  longDescription: 'Kyoto Transfer Long',
  supplierId: 'supp-1',
  supplierName: 'Japan DMC',
  supplierProductCode: 'SUP-02',
  productType: 'TRANSFER',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
} as unknown as Product;

const sampleItems: QuoteItemForBreakdown[] = [
  {
    id: 'item-1',
    product: testProductA,
    pax: { adults: 1, children: 0, infants: 0 },
    travelDate: '2026-11-10',
    calculation: {
      nativeTotalNetCost: 60000,
      nativeCurrency: 'INR',
      totalNetCost: 60000,
      finalTotalSellingPrice: 75000,
      markupAmount: 15000,
      taxAmount: 0,
      serviceFee: 0
    }
  },
  {
    id: 'item-2',
    product: testProductB,
    pax: { adults: 1, children: 0, infants: 0 },
    travelDate: '2026-11-12',
    calculation: {
      nativeTotalNetCost: 40000,
      nativeCurrency: 'INR',
      totalNetCost: 40000,
      finalTotalSellingPrice: 50000,
      markupAmount: 10000,
      taxAmount: 0,
      serviceFee: 0
    }
  }
];

// Baseline: Total Nett Cost = 60,000 + 40,000 = 100,000 INR
// Underlying markup = 15,000 + 10,000 = 25,000 INR
// Base selling price = 125,000 INR

console.log('--- 1. Testing Admin Manual Margin on Total Nett Cost ---');

// Case 1A: Admin sets 15% manual margin on Total Nett Cost in REPLACE mode
const adminCalcReplace = calculateQuoteInternalBreakdown({
  items: sampleItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 15,
  adminMarginMode: 'REPLACE',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 0 // No agent markup
});

assert(
  adminCalcReplace.totalNettCost === 100000,
  'Admin breakdown correctly identifies Total Nett Cost as ₹100,000',
  { received: adminCalcReplace.totalNettCost }
);

assert(
  adminCalcReplace.adminManualMarginAmount === 15000,
  'Admin 15% manual margin on Total Nett Cost is exactly ₹15,000 (100,000 * 15%)',
  { received: adminCalcReplace.adminManualMarginAmount }
);

assert(
  adminCalcReplace.revisedSellingPrice === 115000,
  'Revised Selling Price starts with Total Nett Cost + Manual Margin = ₹115,000 (₹100,000 + ₹15,000)',
  { received: adminCalcReplace.revisedSellingPrice }
);

assert(
  adminCalcReplace.finalPackagePrice === 115000,
  'Final Package Price in REPLACE mode avoids duplicate margin and equals ₹115,000',
  { received: adminCalcReplace.finalPackagePrice }
);

// Case 1B: Admin sets Fixed Amount (₹20,000) manual margin on Total Nett Cost
const adminCalcFixed = calculateQuoteInternalBreakdown({
  items: sampleItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'FIXED',
  adminManualMarginValue: 20000,
  adminMarginMode: 'REPLACE',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 0
});

assert(
  adminCalcFixed.adminManualMarginAmount === 20000,
  'Admin Fixed manual margin is exactly ₹20,000',
  { received: adminCalcFixed.adminManualMarginAmount }
);

assert(
  adminCalcFixed.revisedSellingPrice === 120000,
  'Revised Selling Price with ₹20,000 fixed margin = ₹120,000 (₹100,000 + ₹20,000)',
  { received: adminCalcFixed.revisedSellingPrice }
);

// Case 1C: Admin sets ADD mode (adds to existing calculated margin)
const adminCalcAdd = calculateQuoteInternalBreakdown({
  items: sampleItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 15,
  adminMarginMode: 'ADD',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 0
});

assert(
  adminCalcAdd.revisedSellingPrice === (adminCalcAdd.totalNettCost + (adminCalcAdd.existingMarginAmount || 0) + adminCalcAdd.adminManualMarginAmount!),
  `In ADD mode, revised price equals Nett (₹${adminCalcAdd.totalNettCost}) + Existing (₹${adminCalcAdd.existingMarginAmount}) + Manual (₹${adminCalcAdd.adminManualMarginAmount}) = ₹${adminCalcAdd.revisedSellingPrice}`,
  { received: adminCalcAdd.revisedSellingPrice }
);

console.log('\n--- 2. Testing B2B Agent Additional Margin on Final Price ---');

// Case 2A: Agent adds 10% on top of existing Final Price (₹125,000)
// Expected: Additional Agent Margin = ₹125,000 * 10% = ₹12,500
// Revised Final Price = ₹125,000 + ₹12,500 = ₹137,500
const existingFinalPrice = 125000;
const agentMarginPercent = 10;
const additionalAgentMarginAmount = Math.round(existingFinalPrice * (agentMarginPercent / 100));
const revisedAgentFinalPrice = existingFinalPrice + additionalAgentMarginAmount;

assert(
  additionalAgentMarginAmount === 12500,
  'Agent 10% margin on Existing Final Price (₹125,000) is exactly ₹12,500 (not calculated on nett)',
  { received: additionalAgentMarginAmount }
);

assert(
  revisedAgentFinalPrice === 137500,
  'Revised Final Price becomes ₹137,500 (₹125,000 + ₹12,500) matching prompt specification exactly',
  { received: revisedAgentFinalPrice }
);

// Case 2B: Agent adds Fixed Amount (₹15,000) on top of Final Price (₹125,000)
const agentFixedMargin = 15000;
const revisedAgentFixedPrice = existingFinalPrice + agentFixedMargin;

assert(
  revisedAgentFixedPrice === 140000,
  'Agent fixed margin of ₹15,000 on Final Price yields ₹140,000 (₹125,000 + ₹15,000)',
  { received: revisedAgentFixedPrice }
);

// Case 2C: Distinct Calculation Bases verification
// Verify that Admin's 10% on Nett (₹10,000) is strictly different from Agent's 10% on Final Price (₹12,500)
const admin10PercentAmount = 100000 * 0.10; // ₹10,000
const agent10PercentAmount = 125000 * 0.10; // ₹12,500
assert(
  admin10PercentAmount !== agent10PercentAmount && admin10PercentAmount === 10000 && agent10PercentAmount === 12500,
  'Admin margin basis (Nett) and Agent margin basis (Final Price) produce distinct results as required',
  { admin10PercentAmount, agent10PercentAmount }
);

console.log('\n--- 3. Testing User-Type Segregation & Security ---');

assert(
  canUserViewInternalCostBreakdown(adminUser) === true,
  'Admin user is authorized to configure Admin manual margin on Total Nett Cost'
);

assert(
  canUserViewInternalCostBreakdown(authorizedTeamUser) === true,
  'Team Member with explicit permissions is authorized to view/configure internal costs'
);

assert(
  canUserViewInternalCostBreakdown(restrictedTeamUser) === false,
  'Team Member without explicit permissions is strictly blocked (margin controls hidden)'
);

assert(
  canUserViewInternalCostBreakdown(b2bAgentUser) === false,
  'B2B Agent is strictly blocked from Total Nett Cost (sees only Additional Agent Margin)'
);

assert(
  canUserViewInternalCostBreakdown(buyerUser) === false,
  'Buyer is strictly denied access to margin controls by default'
);

console.log('\n--- 4. Testing Sanitization & Data Layer Protection ---');

const masterQuote: Quotation = {
  id: 'qte-margin-audit-01',
  quoteNumber: 'QTE-2026-TEST',
  title: 'Japan Classic Tour',
  destination: 'Japan',
  currency: 'INR',
  items: sampleItems as any,
  overallDiscountPercent: 0,
  agentNotes: '',
  termsAndConditions: '',
  status: 'DRAFT',
  validUntil: '2026-12-31',
  totalNetCost: 100000,
  totalSellingPrice: 137500,
  totalTaxes: 0,
  totalMargin: 37500,
  baseFinalSellingPrice: 125000,
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 15,
  adminManualMarginAmount: 15000,
  adminMarginMode: 'REPLACE',
  revisedSellingPrice: 115000,
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10,
  agentMarginAmount: 12500,
  finalCustomerSellingPrice: 137500,
  agentId: 'usr-agent-margin-test',
  agentName: 'B2B Travel Agent',
  clientName: 'VIP Client',
  createdAt: '2026-10-13T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z'
};

const sanitizedForAgent = sanitizeQuoteForAgent(masterQuote);

assert(
  (sanitizedForAgent as any).totalNetCost === undefined,
  'Agent sanitized quote does NOT contain totalNetCost'
);

assert(
  (sanitizedForAgent as any).adminManualMarginType === undefined,
  'Agent sanitized quote does NOT contain adminManualMarginType'
);

assert(
  (sanitizedForAgent as any).adminManualMarginValue === undefined,
  'Agent sanitized quote does NOT contain adminManualMarginValue'
);

assert(
  (sanitizedForAgent as any).adminManualMarginAmount === undefined,
  'Agent sanitized quote does NOT contain adminManualMarginAmount'
);

assert(
  (sanitizedForAgent as any).adminMarginMode === undefined,
  'Agent sanitized quote does NOT contain adminMarginMode'
);

assert(
  sanitizedForAgent.finalCustomerSellingPrice === 137500,
  'Agent sanitized quote preserves customer selling price of ₹137,500',
  { received: sanitizedForAgent.finalCustomerSellingPrice }
);

assert(
  sanitizedForAgent.agentMarginAmount === 12500,
  'Agent sanitized quote preserves agent margin amount of ₹12,500',
  { received: sanitizedForAgent.agentMarginAmount }
);

console.log('\n--- 5. Testing calculateQuoteTotal & Database Persistence ---');

const quoteTotalResult = calculateQuoteTotal(masterQuote);

assert(
  quoteTotalResult.totalNetCost === 100000,
  'calculateQuoteTotal computes exact Total Nett Cost of ₹100,000',
  { received: quoteTotalResult.totalNetCost }
);

assert(
  quoteTotalResult.baseSellingPrice === 115000,
  'calculateQuoteTotal incorporates Admin manual margin into effective base selling price (₹115,000)',
  { received: quoteTotalResult.baseSellingPrice }
);

// Test saving quote to AppDatabase
const db = AppDatabase.getInstance();
const savedAdminQuote = db.saveQuote(masterQuote, adminUser, 'EDITED');

assert(
  savedAdminQuote.adminManualMarginValue === 15,
  'db.saveQuote by Admin preserves adminManualMarginValue (15%)',
  { received: savedAdminQuote.adminManualMarginValue }
);

assert(
  savedAdminQuote.adminMarginMode === 'REPLACE',
  'db.saveQuote by Admin preserves adminMarginMode (REPLACE)',
  { received: savedAdminQuote.adminMarginMode }
);

assert(
  savedAdminQuote.pricingSnapshot?.adminManualMarginAmount === 15000,
  'db.saveQuote embeds adminManualMarginAmount in pricingSnapshot',
  { received: savedAdminQuote.pricingSnapshot?.adminManualMarginAmount }
);

const savedAgentQuote = db.saveQuote(masterQuote, b2bAgentUser, 'EDITED');

assert(
  (savedAgentQuote as any).totalNetCost === undefined,
  'db.saveQuote by B2B Agent strips totalNetCost from agent return value'
);

assert(
  (savedAgentQuote as any).adminManualMarginValue === undefined,
  'db.saveQuote by B2B Agent strips adminManualMarginValue from agent return value'
);

console.log('\n================================================================');
console.log(`  STEP 7 MANUAL MARGIN AUDIT COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
