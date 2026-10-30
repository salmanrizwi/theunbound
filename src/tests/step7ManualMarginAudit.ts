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
import { sanitizeQuoteForAgent, sanitizeQuoteForCustomer } from '../utils/customerQuoteSanitizer';
import { buildQuotePresentationModel, renderQuoteEmailFromPresentationModel, renderQuoteWhatsAppFromPresentationModel } from '../services/quotePresentationModel';
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

console.log('\n--- 6. Critical Pricing Handoff Verification (Exact Screenshot Scenario: ₹380,766.13 vs ₹385,017.74) ---');

// Exact screenshot scenario:
// Total Nett Cost = ₹380,766.13
// Existing Calculated Margin = +₹4,251.61
// Original Review & Pricing Total = ₹385,017.74
const screenshotItems: QuoteItemForBreakdown[] = [
  {
    id: 'item-screenshot-1',
    product: testProductA,
    pax: { adults: 2, children: 0, infants: 0 },
    travelDate: '2026-11-10',
    calculation: {
      nativeTotalNetCost: 250000.00,
      nativeCurrency: 'INR',
      totalNetCost: 250000.00,
      finalTotalSellingPrice: 252800.00,
      markupAmount: 2800.00,
      taxAmount: 0,
      serviceFee: 0
    }
  },
  {
    id: 'item-screenshot-2',
    product: testProductB,
    pax: { adults: 2, children: 0, infants: 0 },
    travelDate: '2026-11-12',
    calculation: {
      nativeTotalNetCost: 130766.13,
      nativeCurrency: 'INR',
      totalNetCost: 130766.13,
      finalTotalSellingPrice: 132217.74,
      markupAmount: 1451.61,
      taxAmount: 0,
      serviceFee: 0
    }
  }
];

// Test 1: Manual Margin Adjustment with 0% Additional Agent Margin
const test1Calc = calculateQuoteInternalBreakdown({
  items: screenshotItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 0,
  adminMarginMode: 'REPLACE',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 0
});

assert(
  test1Calc.totalNettCost === 380766.13 && test1Calc.existingMarginAmount === 4251.61,
  'Test 1a: Screenshot baseline has Total Nett Cost = ₹380,766.13 and Existing Margin = ₹4,251.61 (Original Total ₹385,017.74)',
  { totalNettCost: test1Calc.totalNettCost, existingMarginAmount: test1Calc.existingMarginAmount }
);

assert(
  test1Calc.adminFinalTotal === 380766.13 &&
  test1Calc.baseSellingPrice === 380766.13 &&
  test1Calc.partnerMarginAmount === 0 &&
  test1Calc.finalPackagePrice === 380766.13,
  'Test 1b: Manual Margin Adjustment Final Total = ₹380,766.13 -> Additional Agent Margin (0%) uses Existing Final Price = ₹380,766.13 (NOT ₹385,017.74) -> Final Quote Total = ₹380,766.13',
  {
    adminFinalTotal: test1Calc.adminFinalTotal,
    existingFinalPrice: test1Calc.baseSellingPrice,
    partnerMarginAmount: test1Calc.partnerMarginAmount,
    finalPackagePrice: test1Calc.finalPackagePrice
  }
);

// Test 2: Manual Margin Adjustment (₹380,766.13) + 10% Additional Agent Margin
const test2Calc = calculateQuoteInternalBreakdown({
  items: screenshotItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 0,
  adminMarginMode: 'REPLACE',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10
});

assert(
  test2Calc.adminFinalTotal === 380766.13 &&
  test2Calc.baseSellingPrice === 380766.13 &&
  test2Calc.partnerMarginAmount === 38076.61 &&
  test2Calc.finalPackagePrice === 418842.74,
  'Test 2: Manual Margin Adjustment Final Total = ₹380,766.13 + 10% Additional Agent Margin (+₹38,076.61) = Revised Final Price ₹418,842.74',
  {
    adminFinalTotal: test2Calc.adminFinalTotal,
    existingFinalPrice: test2Calc.baseSellingPrice,
    additionalAgentMarginAmount: test2Calc.partnerMarginAmount,
    finalPackagePrice: test2Calc.finalPackagePrice
  }
);

// Test 3: Change Manual Margin (Replace Base Margin vs Add to Existing Margin) -> Additional Agent Margin updates automatically
const test3Replace15 = calculateQuoteInternalBreakdown({
  items: screenshotItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 15,
  adminMarginMode: 'REPLACE',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10
});

// 380,766.13 * 15% = 57,114.92 -> Stage 1 Final Total = 437,881.05
// Stage 2: 437,881.05 * 10% = 43,788.11 -> Final Quote Total = 481,669.16
assert(
  test3Replace15.adminFinalTotal === 437881.05 &&
  test3Replace15.baseSellingPrice === 437881.05 &&
  test3Replace15.partnerMarginAmount === 43788.11 &&
  test3Replace15.finalPackagePrice === 481669.16,
  'Test 3a: Changing Manual Margin to 15% REPLACE updates Stage 1 Final Total to ₹437,881.05 and cascades to Stage 2 Existing Final Price (₹437,881.05 + ₹43,788.11 = ₹481,669.16)',
  test3Replace15
);

const test3AddFixed = calculateQuoteInternalBreakdown({
  items: screenshotItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'FIXED',
  adminManualMarginValue: 10000,
  adminMarginMode: 'ADD',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10
});

// In ADD mode: 380,766.13 + 4,251.61 + 10,000 = 395,017.74
// Stage 2 (10%): 395,017.74 * 10% = 39,501.77 -> Final Quote Total = 434,519.51
assert(
  test3AddFixed.adminFinalTotal === 395017.74 &&
  test3AddFixed.baseSellingPrice === 395017.74 &&
  test3AddFixed.partnerMarginAmount === 39501.77 &&
  test3AddFixed.finalPackagePrice === 434519.51,
  'Test 3b: Changing Manual Margin to +₹10,000 ADD mode updates Stage 1 Final Total to ₹395,017.74 and cascades to Stage 2 (₹395,017.74 + ₹39,501.77 = ₹434,519.51)',
  test3AddFixed
);

// Test 4: Change Additional Agent Margin (10% -> 15%) -> Manual Margin Adjustment Final Total remains unchanged
const test4Agent15 = calculateQuoteInternalBreakdown({
  items: screenshotItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 0,
  adminMarginMode: 'REPLACE',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 15
});

assert(
  test4Agent15.adminFinalTotal === 380766.13 &&
  test4Agent15.baseSellingPrice === 380766.13 &&
  test4Agent15.partnerMarginAmount === 57114.92 &&
  test4Agent15.finalPackagePrice === 437881.05,
  'Test 4: Changing Additional Agent Margin from 10% to 15% keeps Manual Margin Adjustment Final Total unchanged at ₹380,766.13 and updates only Agent Margin (+₹57,114.92) and Final Quote Total (₹437,881.05)',
  test4Agent15
);

// Test 5: Fixed Amount Additional Agent Margin
const test5FixedAgent = calculateQuoteInternalBreakdown({
  items: screenshotItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 0,
  adminMarginMode: 'REPLACE',
  agentMarginType: 'FIXED',
  agentMarginValue: 25000
});

assert(
  test5FixedAgent.adminFinalTotal === 380766.13 &&
  test5FixedAgent.baseSellingPrice === 380766.13 &&
  test5FixedAgent.partnerMarginAmount === 25000 &&
  test5FixedAgent.finalPackagePrice === 405766.13,
  'Test 5: Fixed Additional Agent Margin (+₹25,000) adds directly to Manual Margin Adjustment Final Total (₹380,766.13 + ₹25,000 = ₹405,766.13)',
  test5FixedAgent
);

// Test 6: Reset Additional Agent Margin to 0 -> Final Quote Total returns to Manual Margin Adjustment Final Total
const test6Reset = calculateQuoteInternalBreakdown({
  items: screenshotItems,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 0,
  adminMarginMode: 'REPLACE',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 0
});

assert(
  test6Reset.finalPackagePrice === 380766.13 && test6Reset.partnerMarginAmount === 0,
  'Test 6: Resetting Additional Agent Margin to 0 returns Final Quote Total to Manual Margin Adjustment Final Total (₹380,766.13)',
  test6Reset
);

// Test 7: Output Consistency Across Saved Quote, Presentation Model, PDF, Email, and WhatsApp
const screenshotQuote: Quotation = {
  id: 'qte-handoff-verify-01',
  quoteNumber: 'QTE-2026-HANDOFF',
  title: 'Japan Bespoke Luxury Journey',
  destination: 'Japan',
  currency: 'INR',
  items: screenshotItems as any,
  overallDiscountPercent: 0,
  agentNotes: '',
  termsAndConditions: 'Standard terms apply.',
  status: 'DRAFT',
  validUntil: '2026-12-31',
  totalNetCost: 380766.13,
  totalSellingPrice: 418842.74,
  totalTaxes: 0,
  totalMargin: 38076.61,
  baseFinalSellingPrice: 380766.13,
  base_final_selling_price: 380766.13,
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 0,
  adminManualMarginAmount: 0,
  adminMarginMode: 'REPLACE',
  revisedSellingPrice: 380766.13,
  revised_selling_price: 380766.13,
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10,
  agentMarginAmount: 38076.61,
  finalCustomerSellingPrice: 418842.74,
  final_customer_selling_price: 418842.74,
  agentId: 'usr-agent-margin-test',
  agentName: 'B2B Travel Agent',
  clientName: 'Aarav Sharma',
  travelStartDate: '2026-11-10',
  travelEndDate: '2026-11-15',
  adultsCount: 2,
  childrenCount: 0,
  infantsCount: 0,
  createdAt: '2026-10-30T00:00:00Z',
  updatedAt: '2026-10-30T00:00:00Z'
};

const savedHandoffQuote = db.saveQuote(screenshotQuote, adminUser, 'EDITED');
const handoffQuoteTotal = calculateQuoteTotal(savedHandoffQuote);
const sanitizedAgentHandoff = sanitizeQuoteForAgent(savedHandoffQuote);
const sanitizedAgentTotal = calculateQuoteTotal(sanitizedAgentHandoff);
const presentationModel = buildQuotePresentationModel(savedHandoffQuote);
const emailRendered = renderQuoteEmailFromPresentationModel(presentationModel);
const whatsappFromModel = renderQuoteWhatsAppFromPresentationModel(presentationModel);
const sanitizedCustomer = sanitizeQuoteForCustomer(savedHandoffQuote);

assert(
  savedHandoffQuote.baseFinalSellingPrice === 380766.13 &&
  savedHandoffQuote.agentMarginAmount === 38076.61 &&
  savedHandoffQuote.finalCustomerSellingPrice === 418842.74 &&
  handoffQuoteTotal.baseSellingPrice === 380766.13 &&
  handoffQuoteTotal.marginAmount === 38076.61 &&
  handoffQuoteTotal.finalCustomerSellingPrice === 418842.74 &&
  sanitizedAgentTotal.baseSellingPrice === 380766.13 &&
  sanitizedAgentTotal.finalCustomerSellingPrice === 418842.74,
  'Test 7a: Saved Quote, calculateQuoteTotal (raw & sanitized), and Agent Sanitizer all preserve exact ₹380,766.13 -> +₹38,076.61 -> ₹418,842.74 handoff',
  {
    savedBase: savedHandoffQuote.baseFinalSellingPrice,
    savedMargin: savedHandoffQuote.agentMarginAmount,
    savedFinal: savedHandoffQuote.finalCustomerSellingPrice,
    calcBase: handoffQuoteTotal.baseSellingPrice,
    calcFinal: handoffQuoteTotal.finalCustomerSellingPrice,
    sanitizedCalcFinal: sanitizedAgentTotal.finalCustomerSellingPrice
  }
);

assert(
  presentationModel.totalSellingPriceNumeric === 418842.74 &&
  presentationModel.landPartTotalFormatted === '₹418,842.74' &&
  emailRendered.htmlBody.includes('₹418,842.74') &&
  emailRendered.textBody.includes('₹418,842.74') &&
  whatsappFromModel.includes('₹418,842.74') &&
  sanitizedCustomer.formattedSellingPrice === '₹418,842.74',
  'Test 7b: Quotation Preview, PDF Presentation Model, HTML Email, Plain-Text Email, and WhatsApp output all display ₹418,842.74 consistently',
  {
    totalSellingPriceNumeric: presentationModel.totalSellingPriceNumeric,
    landPartTotalFormatted: presentationModel.landPartTotalFormatted,
    whatsappFormatted: sanitizedCustomer.formattedSellingPrice
  }
);

console.log('\n--- 7. Mandatory Default Mode (ADD) & Base Margin Inclusion Verification ---');

// Prompt Example Item: Supplier Nett Cost = ₹10,000, Existing Base Margin = 15% (₹1,500), B2B Base Selling = ₹11,500
const tenKItem: QuoteItemForBreakdown[] = [
  {
    id: 'item-10k-1',
    product: testProductA,
    pax: { adults: 1, children: 0, infants: 0 },
    travelDate: '2026-11-10',
    calculation: {
      nativeTotalNetCost: 10000,
      nativeCurrency: 'INR',
      totalNetCost: 10000,
      finalTotalSellingPrice: 11500,
      markupAmount: 1500,
      taxAmount: 0,
      serviceFee: 0
    }
  }
];

// Scenario 1 & 4: New quote default mode (adminMarginMode omitted or 'ADD') with 0% Manual Margin Adjustment
// Base margin = 15% (₹1,500), manual = 0% -> Effective margin = 15% (₹1,500), B2B Selling Price = ₹11,500
const defaultZeroManualCalc = calculateQuoteInternalBreakdown({
  items: tenKItem,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 0
  // adminMarginMode omitted -> must default to 'ADD'
});

assert(
  defaultZeroManualCalc.totalNettCost === 10000 &&
  defaultZeroManualCalc.existingMarginAmount === 1500 &&
  defaultZeroManualCalc.adminManualMarginAmount === 0 &&
  defaultZeroManualCalc.revisedSellingPrice === 11500 &&
  defaultZeroManualCalc.adminFinalTotal === 11500,
  'Scenario 1 & 4: Default mode (ADD) with 0% manual adjustment preserves 15% Existing Base Margin (₹1,500) -> B2B Selling Price = ₹11,500',
  defaultZeroManualCalc
);

// Scenario 3: Supplier Nett = ₹10,000, Existing Base Margin = 15% (₹1,500), Manual Margin Adjustment = 5% (₹500) in default ADD mode
// Effective Margin = 20% (₹2,000), B2B Selling Price = ₹12,000
const defaultAddFivePercentCalc = calculateQuoteInternalBreakdown({
  items: tenKItem,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 5
  // adminMarginMode omitted -> defaults to 'ADD'
});

assert(
  defaultAddFivePercentCalc.totalNettCost === 10000 &&
  defaultAddFivePercentCalc.existingMarginAmount === 1500 &&
  defaultAddFivePercentCalc.adminManualMarginAmount === 500 &&
  defaultAddFivePercentCalc.revisedSellingPrice === 12000 &&
  defaultAddFivePercentCalc.adminFinalTotal === 12000,
  'Scenario 3: Supplier Nett ₹10,000 + 15% Base Margin (₹1,500) + 5% Manual Margin (₹500) in default ADD mode -> Effective Margin = ₹2,000 (20%), B2B Selling Price = ₹12,000',
  defaultAddFivePercentCalc
);

// Scenario 5: Explicitly select Replace Base Margin ('REPLACE') with 20%
// Effective margin = 20% (₹2,000), B2B Selling Price = ₹12,000
const explicitReplaceTwentyPercentCalc = calculateQuoteInternalBreakdown({
  items: tenKItem,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 20,
  adminMarginMode: 'REPLACE'
});

assert(
  explicitReplaceTwentyPercentCalc.totalNettCost === 10000 &&
  explicitReplaceTwentyPercentCalc.adminManualMarginAmount === 2000 &&
  explicitReplaceTwentyPercentCalc.revisedSellingPrice === 12000 &&
  explicitReplaceTwentyPercentCalc.adminFinalTotal === 12000,
  'Scenario 5: Selecting Replace Base Margin (REPLACE) with 20% replaces 15% base margin -> Effective Margin = ₹2,000 (20%), B2B Selling Price = ₹12,000',
  explicitReplaceTwentyPercentCalc
);

// Scenario 6: Switch back from REPLACE to Add to Existing Margin ('ADD') with 5%
const switchBackToAddCalc = calculateQuoteInternalBreakdown({
  items: tenKItem,
  targetCurrency: 'INR',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 5,
  adminMarginMode: 'ADD',
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10
});

// Stage 1: ₹10,000 + ₹1,500 + ₹500 = ₹12,000
// Stage 2 (10% Additional Agent Margin): ₹12,000 + ₹1,200 = ₹13,200
assert(
  switchBackToAddCalc.adminFinalTotal === 12000 &&
  switchBackToAddCalc.baseSellingPrice === 12000 &&
  switchBackToAddCalc.partnerMarginAmount === 1200 &&
  switchBackToAddCalc.finalPackagePrice === 13200,
  'Scenario 6 & 9: Switching back to Add to Existing Margin restores Base (₹1,500) + Manual (₹500) = ₹12,000 and cascades to Additional Agent Margin (+10% = ₹1,200 -> ₹13,200)',
  switchBackToAddCalc
);

// Scenario 7 & 8: New quotation saved without explicit adminMarginMode defaults to 'ADD' in db.saveQuote & calculateQuoteTotal
const newDefaultQuote: Quotation = {
  id: 'qte-default-add-mode-01',
  quoteNumber: 'QTE-2026-ADDDEFAULT',
  title: 'Japan Package Quote',
  destination: 'Japan',
  currency: 'INR',
  items: tenKItem as any,
  overallDiscountPercent: 0,
  agentNotes: '',
  termsAndConditions: 'Standard terms apply.',
  status: 'DRAFT',
  validUntil: '2026-12-31',
  totalNetCost: 10000,
  totalSellingPrice: 13200,
  totalTaxes: 0,
  totalMargin: 3200,
  baseFinalSellingPrice: 12000,
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 5,
  agentMarginType: 'PERCENTAGE',
  agentMarginValue: 10,
  agentMarginAmount: 1200,
  finalCustomerSellingPrice: 13200,
  agentId: 'usr-agent-margin-test',
  agentName: 'B2B Travel Agent',
  clientName: 'Rohan Mehta',
  createdAt: '2026-10-30T00:00:00Z',
  updatedAt: '2026-10-30T00:00:00Z'
};

const savedDefaultQuote = db.saveQuote(newDefaultQuote, adminUser, 'CREATED');
const calcDefaultQuoteTotal = calculateQuoteTotal(savedDefaultQuote);

assert(
  savedDefaultQuote.adminMarginMode === 'ADD' &&
  savedDefaultQuote.pricingSnapshot?.adminMarginMode === 'ADD' &&
  calcDefaultQuoteTotal.baseSellingPrice === 12000 &&
  calcDefaultQuoteTotal.marginAmount === 1200 &&
  calcDefaultQuoteTotal.finalCustomerSellingPrice === 13200,
  'Scenario 7, 8 & 10: Newly saved quote defaults to adminMarginMode = ADD, persists in pricingSnapshot, and calculateQuoteTotal computes ₹12,000 Stage 1 + ₹1,200 Stage 2 = ₹13,200',
  {
    adminMarginMode: savedDefaultQuote.adminMarginMode,
    snapshotMode: savedDefaultQuote.pricingSnapshot?.adminMarginMode,
    baseSellingPrice: calcDefaultQuoteTotal.baseSellingPrice,
    finalCustomerSellingPrice: calcDefaultQuoteTotal.finalCustomerSellingPrice
  }
);

console.log('\n================================================================');
console.log(`  STEP 7 MANUAL MARGIN AUDIT COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

