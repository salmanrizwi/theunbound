/**
 * Comprehensive Automated Verification Suite:
 * Margin & Commission Governance (Tests A - G)
 */

import { AppDatabase } from '../services/db';
import {
  buildMarginGovernanceRow,
  bulkSaveProductMargins,
  canUserManageMargins,
  queryLocalMarginGovernanceCatalog,
  saveProductMargin,
  validateMarginGovernanceInput
} from '../services/marginGovernanceService';
import {
  calculateProductPrice,
  calculateQuoteInternalBreakdown,
  clearPricingEngineCache
} from '../services/pricingEngine';
import { sanitizeProductForAgent } from '../utils/customerQuoteSanitizer';
import {
  isRoleAuthorizedForMarginGovernance,
  validateMarginPayload
} from '../../server/marginGovernanceService';
import { Product, QuoteItem, Quotation, User } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, label: string, details?: unknown) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${label}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ [FAIL] ${label}`, details !== undefined ? details : '');
  }
}

const adminUser: User = {
  id: 'usr-admin-business',
  name: 'Finance Director',
  email: 'business@theunbound.in',
  role: 'ADMIN',
  category: 'INTERNAL',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  permissions: {
    canAccessCMS: true,
    canAccessFinancials: true,
    cmsFinance: { enabled: true, marginManagement: true, pricingManagement: true }
  }
};

const financeStaffUser: User = {
  id: 'usr-team-fin',
  name: 'Finance Manager',
  email: 'finance.mgr@theunbound.in',
  role: 'TEAM_MEMBER',
  category: 'INTERNAL',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  permissions: {
    canAccessCMS: true,
    canAccessFinancials: true,
    cmsFinance: { enabled: true, marginManagement: true }
  }
};

const unprivilegedStaffUser: User = {
  id: 'usr-team-ops',
  name: 'Ops Coordinator',
  email: 'ops.coord@theunbound.in',
  role: 'TEAM_MEMBER',
  category: 'INTERNAL',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  permissions: {
    canAccessCMS: true,
    canAccessFinancials: false,
    cmsFinance: { enabled: false }
  }
};

const b2bAgentUser: User = {
  id: 'usr-agent-01',
  name: 'Partner Agent',
  email: 'agent@partnertravel.com',
  role: 'B2B_AGENT',
  category: 'EXTERNAL',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  companyName: 'Partner Travel Co'
};

const agencyOwnerUser: User = {
  id: 'usr-owner-01',
  name: 'Agency Owner',
  email: 'owner@partnertravel.com',
  role: 'AGENCY_OWNER',
  category: 'EXTERNAL',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  companyName: 'Partner Travel Co'
};

const buyerUser: User = {
  id: 'usr-buyer-01',
  name: 'Direct Buyer',
  email: 'buyer@example.com',
  role: 'BUYER',
  category: 'EXTERNAL',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

async function runAudit() {
  console.log('====================================================================');
  console.log('  MARGIN & COMMISSION GOVERNANCE — AUTOMATED VERIFICATION SUITE');
  console.log('====================================================================\n');

  const db = AppDatabase.getInstance();
  if (db.getProducts().length === 0 && INITIAL_PRODUCTS.length > 0) {
    (db as any).setItem('products', INITIAL_PRODUCTS.map((p) => ({ ...p })), false);
  }
  const catalog = db.getProducts();
  assert(catalog.length >= 4, `Master product catalog loaded (${catalog.length} products available)`);

  // Pick a real non-rail deterministic product with adultNetPrice > 0
  const baseProd =
    catalog.find(
      (p) =>
        p.status === 'ACTIVE' &&
        Number(p.adultNetPrice) > 0 &&
        p.category !== 'Rail' &&
        p.category !== 'Rail / Shinkansen'
    ) || catalog[0];

  const secondProd =
    catalog.find(
      (p) =>
        p.id !== baseProd.id &&
        p.status === 'ACTIVE' &&
        Number(p.adultNetPrice) > 0 &&
        p.category !== 'Rail' &&
        p.category !== 'Rail / Shinkansen'
    ) || catalog[1];

  const thirdProd =
    catalog.find(
      (p) =>
        p.id !== baseProd.id &&
        p.id !== secondProd.id &&
        p.status === 'ACTIVE' &&
        Number(p.adultNetPrice) > 0 &&
        p.category !== 'Rail' &&
        p.category !== 'Rail / Shinkansen'
    ) || catalog[2];

  const untouchedProd =
    catalog.find(
      (p) =>
        p.id !== baseProd.id &&
        p.id !== secondProd.id &&
        p.id !== thirdProd.id &&
        p.category !== 'Rail' &&
        p.category !== 'Rail / Shinkansen'
    ) || catalog[3];

  // Snapshot original margins so we can prove exact before -> after delta
  const initialUpdateRes = await saveProductMargin({
    productId: baseProd.id,
    marginType: 'PERCENTAGE',
    marginValue: 15,
    commissionPercent: 2.5,
    status: 'ACTIVE',
    reason: 'Baseline 15% before Test A',
    actor: adminUser
  });
  assert(initialUpdateRes.success, `Baseline setup for ${baseProd.sku} (${baseProd.id}) at 15% succeeded`);

  const baselineRow = buildMarginGovernanceRow(initialUpdateRes.product!, initialUpdateRes.marginConfig);
  const beforeMarginPct = baselineRow.effectiveMarginValue;
  const beforeSellingPrice = baselineRow.currentSellingPrice;

  // =========================================================================
  // TEST A — Single Product Margin Update (15% -> 22%) & Full Synchronization
  // =========================================================================
  console.log('\n--- TEST A: Single Product Margin Update (15% -> 22%) ---');
  const expectedV = baselineRow.version;
  const updateARes = await saveProductMargin({
    productId: baseProd.id,
    marginType: 'PERCENTAGE',
    marginValue: 22,
    commissionPercent: 4,
    status: 'ACTIVE',
    reason: 'Test A Q3 margin adjustment',
    expectedVersion: expectedV,
    changeSource: 'MARGIN_GOVERNANCE',
    actor: adminUser
  });

  assert(updateARes.success === true, 'Single margin save succeeded');
  assert(updateARes.product?.b2bAgentMarkupPercent === 22, 'Product.b2bAgentMarkupPercent updated to 22%');
  assert(updateARes.product?.defaultMarkupPercent === 22, 'Product.defaultMarkupPercent synchronized to 22%');
  assert(updateARes.product?.commissionPercent === 4, 'Product.commissionPercent updated to 4%');
  assert(updateARes.marginConfig?.version === expectedV + 1, `Config version incremented to v${expectedV + 1}`);
  assert(updateARes.auditLog?.previousMarginValue === 15 && updateARes.auditLog?.newMarginValue === 22, 'Audit log captured 15 -> 22');

  const prodFromDb = db.getProductById(baseProd.id)!;
  const cfgFromDb = db.getProductMarginConfigs().find((c) => c.productId === baseProd.id)!;
  const logsFromDb = db.getProductMarginAuditLogs(baseProd.id);
  const afterRow = buildMarginGovernanceRow(prodFromDb, cfgFromDb);

  assert(prodFromDb.b2bAgentMarkupPercent === 22 && prodFromDb.defaultMarkupPercent === 22, 'Product Management resolution reflects 22%');
  assert(cfgFromDb.marginValue === 22 && cfgFromDb.b2bAgentMarkupPercent === 22, 'Authoritative margin config record reflects 22%');
  assert(logsFromDb.some((l) => l.newMarginValue === 22 && l.newVersion === expectedV + 1), 'Product audit trail contains v+1 update');
  assert(afterRow.currentSellingPrice > beforeSellingPrice, `Selling price increased (${beforeSellingPrice} -> ${afterRow.currentSellingPrice})`);

  // =========================================================================
  // TEST B — Persistence & Sync Verification Across Fresh Cache Reload
  // =========================================================================
  console.log('\n--- TEST B: Persistence & Cache Reload Verification ---');
  db.invalidateMemoryCache('product_margin_configs');
  db.invalidateMemoryCache('product_margin_audit_logs');
  // Simulate cold reload where base catalog re-hydrates while persisted product_margin_configs storage holds latest 22%
  (db as any).setItem('products', INITIAL_PRODUCTS.map((p) => ({ ...p })), false);
  clearPricingEngineCache();

  const reloadedProd = db.getProductById(baseProd.id)!;
  const reloadedCfg = db.getProductMarginConfigs().find((c) => c.productId === baseProd.id)!;
  const reloadedCatalog = queryLocalMarginGovernanceCatalog({ search: baseProd.sku });
  const reloadedRow = reloadedCatalog.rows.find((r) => r.product.id === baseProd.id);

  assert(reloadedProd?.b2bAgentMarkupPercent === 22, 'Reloaded Product retains 22% b2bAgentMarkupPercent');
  assert(reloadedProd?.defaultMarkupPercent === 22, 'Reloaded Product retains 22% defaultMarkupPercent');
  assert(reloadedCfg?.marginValue === 22, 'Reloaded Margin Config retains 22%');
  assert(reloadedRow?.effectiveMarginValue === 22, 'Margin Governance query after reload returns 22%');

  // =========================================================================
  // TEST C — Concurrent Updates & Optimistic Concurrency Conflict Handling
  // =========================================================================
  console.log('\n--- TEST C: Concurrent Updates & Conflict Handling ---');
  const versionNow = reloadedRow!.version;
  // Admin Session 1 saves v -> v+1
  const session1 = await saveProductMargin({
    productId: baseProd.id,
    marginType: 'PERCENTAGE',
    marginValue: 24,
    expectedVersion: versionNow,
    reason: 'Admin Session 1 win',
    actor: adminUser
  });
  assert(session1.success === true, `Session 1 succeeded at expectedVersion=${versionNow}`);

  // Admin Session 2 attempts save with stale expectedVersion
  const session2 = await saveProductMargin({
    productId: baseProd.id,
    marginType: 'PERCENTAGE',
    marginValue: 11,
    expectedVersion: versionNow, // stale!
    reason: 'Admin Session 2 stale overwrite attempt',
    actor: financeStaffUser
  });
  assert(session2.success === false && session2.code === 'VERSION_CONFLICT', 'Stale update rejected with VERSION_CONFLICT');
  assert(session2.currentVersion === versionNow + 1, `Conflict response reports latest version v${versionNow + 1}`);
  assert(db.getProductById(baseProd.id)?.b2bAgentMarkupPercent === 24, 'Stale update did NOT overwrite 24%');

  // Restore 22% cleanly at latest version for downstream pricing tests
  const restore22 = await saveProductMargin({
    productId: baseProd.id,
    marginType: 'PERCENTAGE',
    marginValue: 22,
    commissionPercent: 4,
    expectedVersion: versionNow + 1,
    reason: 'Normalize to 22% for downstream tests',
    actor: adminUser
  });
  assert(restore22.success === true, 'Normalized back to 22% cleanly');

  // =========================================================================
  // TEST D — Bulk Update & Partial Failure Handling + Retry Failed Only
  // =========================================================================
  console.log('\n--- TEST D: Bulk Update & Partial Failure Handling ---');
  const untouchedBefore = db.getProductById(untouchedProd.id)!.b2bAgentMarkupPercent;
  const thirdBefore = db.getProductById(thirdProd.id)!.b2bAgentMarkupPercent;

  const bulkRes = await bulkSaveProductMargins({
    productIds: [secondProd.id, thirdProd.id],
    marginType: 'PERCENTAGE',
    marginValue: 19,
    commissionPercent: 3,
    applyCommissionUpdate: true,
    status: 'ACTIVE',
    reason: 'Test D Bulk Batch',
    actor: adminUser,
    simulateFailureForProductIds: [thirdProd.id]
  });

  assert(bulkRes.partialSuccess === true && bulkRes.success === false, 'Bulk batch reported partialSuccess=true');
  assert(bulkRes.succeededIds.includes(secondProd.id), 'Succeeded product updated in bulk batch');
  assert(bulkRes.failedItems.length === 1 && bulkRes.failedItems[0].productId === thirdProd.id, 'Simulated failed item captured in failedItems');
  assert(db.getProductById(secondProd.id)?.b2bAgentMarkupPercent === 19, 'Succeeded bulk product persisted 19%');
  assert(db.getProductById(thirdProd.id)?.b2bAgentMarkupPercent === thirdBefore, 'Failed bulk product remained unchanged');
  assert(db.getProductById(untouchedProd.id)?.b2bAgentMarkupPercent === untouchedBefore, 'Unselected product remained completely untouched');

  // Retry failed items only
  const retryRes = await bulkSaveProductMargins({
    productIds: bulkRes.failedItems.map((f) => f.productId),
    marginType: 'PERCENTAGE',
    marginValue: 19,
    commissionPercent: 3,
    applyCommissionUpdate: true,
    status: 'ACTIVE',
    reason: 'Test D Retry Failed Only',
    actor: adminUser
  });
  assert(retryRes.success === true && retryRes.succeededIds.includes(thirdProd.id), 'Retry of failed item succeeded');
  assert(db.getProductById(thirdProd.id)?.b2bAgentMarkupPercent === 19, 'Retried product persisted 19%');

  // =========================================================================
  // TEST E — Pricing Engine Integration & Agency Mode Precedence
  // =========================================================================
  console.log('\n--- TEST E: Pricing Engine Integration & Agency Margin Mode Precedence ---');
  clearPricingEngineCache();
  const latestBaseProd = db.getProductById(baseProd.id)!;
  const nett = Number(latestBaseProd.vehicleConfig?.unitVehicleNetCost ?? latestBaseProd.adultNetPrice ?? 100);
  const currency = (latestBaseProd.nativeCurrency || latestBaseProd.currency || 'USD') as any;

  // Test with explicit productLevelMarginEnabled = true (uses 22%)
  const quoteItemBase: QuoteItem = {
    id: 'qi-test-e1',
    product: latestBaseProd,
    pax: { adults: 2, children: 0, infants: 0 },
    travelDate: '2026-08-15',
    calculation: {} as any
  };

  const breakdownProductMode = calculateQuoteInternalBreakdown({
    items: [quoteItemBase],
    targetCurrency: currency,
    productLevelMarginEnabled: true,
    customAgentMarginPercent: 12,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    user: b2bAgentUser
  });

  const prodModePct =
    breakdownProductMode.itemizedBreakdown[0].convertedNetCost > 0
      ? (breakdownProductMode.itemizedBreakdown[0].markupAmount / breakdownProductMode.itemizedBreakdown[0].convertedNetCost) * 100
      : 0;

  assert(
    breakdownProductMode.activeMarginMode === 'PRODUCT_LEVEL',
    'Product-Level Margin ON selects PRODUCT_LEVEL mode'
  );
  assert(
    Math.abs(prodModePct - 22) < 0.05,
    `Product-Level Mode applies updated 22% (got ${prodModePct.toFixed(2)}%, markup=${breakdownProductMode.itemizedBreakdown[0].markupAmount}, net=${breakdownProductMode.itemizedBreakdown[0].convertedNetCost})`
  );

  // Test with productLevelMarginEnabled = false (uses Internal Agent-Level Margin 12%, NOT 22%, and NEVER both)
  const breakdownAgentMode = calculateQuoteInternalBreakdown({
    items: [quoteItemBase],
    targetCurrency: currency,
    productLevelMarginEnabled: false,
    customAgentMarginPercent: 12,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    user: b2bAgentUser
  });

  const agentModePct =
    breakdownAgentMode.itemizedBreakdown[0].convertedNetCost > 0
      ? (breakdownAgentMode.itemizedBreakdown[0].markupAmount / breakdownAgentMode.itemizedBreakdown[0].convertedNetCost) * 100
      : 0;

  assert(
    breakdownAgentMode.activeMarginMode === 'AGENT_LEVEL',
    'Product-Level Margin OFF selects AGENT_LEVEL mode'
  );
  assert(
    Math.abs(agentModePct - 12) < 0.05,
    `Agent-Level Mode applies 12% instead of 22% (got ${agentModePct.toFixed(2)}%)`
  );
  assert(
    breakdownAgentMode.underlyingMarginAmount < breakdownProductMode.underlyingMarginAmount,
    'Product-Level (22%) and Agent-Level (12%) margins are never stacked simultaneously'
  );

  // Verify commissionPercent does NOT alter customer/B2B selling price, while agentMarginValue Additional Markup adds cleanly
  const breakdownWithAdditional = calculateQuoteInternalBreakdown({
    items: [quoteItemBase],
    targetCurrency: currency,
    productLevelMarginEnabled: true,
    customAgentMarginPercent: 12,
    agentMarginType: 'FIXED',
    agentMarginValue: 50,
    user: b2bAgentUser
  });
  assert(
    Math.abs(breakdownWithAdditional.partnerMarginAmount - 50) < 0.01,
    `Agent Additional Markup (+50 ${currency}) remains independent of governance commission (4%)`
  );
  assert(
    Math.abs(
      breakdownWithAdditional.finalPackagePrice -
        (breakdownProductMode.finalPackagePrice + 50)
    ) <= 1,
    'Final customer selling price = B2B selling price + independent Agent Additional Markup'
  );

  // Test FIXED margin type & INACTIVE margin status
  const fixedNetProd: Product = {
    ...latestBaseProd,
    id: `${latestBaseProd.id}-fixed`,
    pricingMethod: 'per_person',
    adultNetPrice: 1000,
    childNetPrice: 0,
    infantNetPrice: 0,
    taxPercent: 0,
    serviceFeeFixed: 0,
    marginType: 'FIXED',
    marginFixed: 250,
    b2bAgentMarkupPercent: 22,
    defaultMarkupPercent: 22,
    marginStatus: 'ACTIVE',
    currency: 'USD',
    nativeCurrency: 'USD'
  };
  const fixedCalc = calculateProductPrice(
    fixedNetProd,
    {
      productId: fixedNetProd.id,
      adults: 1,
      children: 0,
      infants: 0,
      travelDate: '2026-08-15',
      targetCurrency: 'USD',
      productLevelMarginEnabled: true,
      customAgentMarginPercent: 12,
      user: b2bAgentUser
    }
  );
  assert(
    fixedCalc.finalTotalSellingPrice === 1250,
    `FIXED margin adds exact fixed amount (1000 + 250 = 1250, got ${fixedCalc.finalTotalSellingPrice})`
  );

  const inactiveCalc = calculateProductPrice(
    { ...fixedNetProd, marginStatus: 'INACTIVE' },
    {
      productId: fixedNetProd.id,
      adults: 1,
      children: 0,
      infants: 0,
      travelDate: '2026-08-15',
      targetCurrency: 'USD',
      productLevelMarginEnabled: true,
      customAgentMarginPercent: 12,
      user: b2bAgentUser
    }
  );
  assert(
    inactiveCalc.finalTotalSellingPrice === 1000,
    `INACTIVE margin status disables product margin (got ${inactiveCalc.finalTotalSellingPrice})`
  );

  // =========================================================================
  // TEST F — Historical Quotation Snapshot Immutability
  // =========================================================================
  console.log('\n--- TEST F: Quotation Snapshot Immutability ---');
  const savedQuoteSnapshot = calculateQuoteInternalBreakdown({
    items: [quoteItemBase],
    targetCurrency: currency,
    productLevelMarginEnabled: true,
    customAgentMarginPercent: 12,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 0,
    user: b2bAgentUser
  });

  const savedQuoteRecord: Quotation = {
    id: 'QTE-TEST-IMMUTABLE',
    quoteNumber: 'QTE-TEST-IMMUTABLE',
    version: 1,
    title: 'Historical Frozen Quote',
    destination: latestBaseProd.destinationName,
    agentId: b2bAgentUser.id,
    agentName: b2bAgentUser.name,
    agentEmail: b2bAgentUser.email,
    clientName: 'Test Client',
    travelStartDate: '2026-08-15',
    travelEndDate: '2026-08-20',
    adultsCount: 2,
    childrenCount: 0,
    infantsCount: 0,
    items: [quoteItemBase],
    overallDiscountPercent: 0,
    totalNetCost: savedQuoteSnapshot.totalNettCost,
    totalSellingPrice: savedQuoteSnapshot.finalPackagePrice,
    totalTaxes: savedQuoteSnapshot.taxAmount,
    totalMargin: savedQuoteSnapshot.underlyingMarginAmount,
    finalCustomerSellingPrice: savedQuoteSnapshot.finalPackagePrice,
    currency: currency,
    status: 'SENT',
    isLocked: true,
    agentNotes: '',
    termsAndConditions: '',
    validUntil: '2026-09-15',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currencyConversionSnapshot: {
      snapshotId: 'snap-frozen-v1',
      quoteId: 'QTE-TEST-IMMUTABLE',
      quoteVersion: 1,
      targetCurrency: currency,
      currencyPrecision: 2,
      roundingMode: 'TWO_DECIMAL_STANDARD',
      fxSource: 'TEST',
      capturedAt: new Date().toISOString(),
      activeMarginMode: 'PRODUCT_LEVEL',
      productLevelMarginEnabled: true,
      agentLevelMarginPercent: 12,
      lineItems: savedQuoteSnapshot.itemizedBreakdown as any,
      totals: {
        convertedTotalNetCost: savedQuoteSnapshot.totalNettCost,
        baseMarginTotal: savedQuoteSnapshot.underlyingMarginAmount,
        manualMarginAdjustmentMode: 'ADD',
        manualMarginAdjustmentType: 'FIXED',
        manualMarginAdjustmentValue: 0,
        manualMarginAdjustmentAmount: 0,
        effectiveUnderlyingMarginAmount: savedQuoteSnapshot.underlyingMarginAmount,
        taxesTotal: savedQuoteSnapshot.taxAmount,
        serviceFeesTotal: savedQuoteSnapshot.serviceFee,
        discountsTotal: 0,
        b2bSellingPriceTotal: savedQuoteSnapshot.baseSellingPrice,
        additionalAgentMarginType: 'PERCENTAGE',
        additionalAgentMarginValue: 0,
        additionalAgentMarginAmount: 0,
        hotelAccommodationTotal: 0,
        landPartTotal: savedQuoteSnapshot.landPartTotal ?? savedQuoteSnapshot.baseSellingPrice,
        finalCustomerSellingPrice: savedQuoteSnapshot.finalPackagePrice
      },
      totalConvertedNettCost: savedQuoteSnapshot.totalNettCost,
      existingBaseMarginAmount: savedQuoteSnapshot.underlyingMarginAmount,
      manualMarginAdjustmentAmount: 0,
      manualMarginAdjustedTotal: savedQuoteSnapshot.baseSellingPrice,
      additionalAgentMarginAmount: 0,
      taxAmount: savedQuoteSnapshot.taxAmount,
      hotelAccommodationTotal: 0,
      landPartTotal: savedQuoteSnapshot.landPartTotal ?? savedQuoteSnapshot.baseSellingPrice,
      finalCustomerSellingPrice: savedQuoteSnapshot.finalPackagePrice,
      isValid: true,
      missingCurrencyPairs: []
    }
  };
  const existingQuotes = db.getAllSavedQuotes();
  (db as any).setItem('saved_quotes', [savedQuoteRecord, ...existingQuotes.filter((q) => q.id !== savedQuoteRecord.id)], false);

  // Now update product margin from 22% -> 35%
  const bump35 = await saveProductMargin({
    productId: baseProd.id,
    marginType: 'PERCENTAGE',
    marginValue: 35,
    expectedVersion: db.getProductMarginConfigs().find((c) => c.productId === baseProd.id)?.version,
    reason: 'Test F margin bump after historical quote frozen',
    actor: adminUser
  });
  assert(bump35.success === true, 'Product margin updated from 22% -> 35%');

  const storedHistoricalQuote = db.getRawQuoteById('QTE-TEST-IMMUTABLE')!;
  const preservedBreakdown = calculateQuoteInternalBreakdown({
    items: storedHistoricalQuote.items,
    targetCurrency: currency,
    productLevelMarginEnabled: true,
    preserveHistoricalSnapshot: true,
    historicalSnapshot: storedHistoricalQuote.currencyConversionSnapshot,
    user: b2bAgentUser
  });
  assert(
    preservedBreakdown.finalPackagePrice === savedQuoteSnapshot.finalPackagePrice,
    `Frozen quotation preserves original total (${preservedBreakdown.finalPackagePrice} === ${savedQuoteSnapshot.finalPackagePrice})`
  );
  assert(storedHistoricalQuote.version === 1, 'Saved quotation version counter was NOT auto-incremented');

  // New quotation uses updated 35%
  const freshProdAfter35 = db.getProductById(baseProd.id)!;
  const freshQuoteBreakdown = calculateQuoteInternalBreakdown({
    items: [{ ...quoteItemBase, product: freshProdAfter35 }],
    targetCurrency: currency,
    productLevelMarginEnabled: true,
    user: b2bAgentUser
  });
  const freshPct =
    freshQuoteBreakdown.itemizedBreakdown[0].convertedNetCost > 0
      ? (freshQuoteBreakdown.itemizedBreakdown[0].markupAmount / freshQuoteBreakdown.itemizedBreakdown[0].convertedNetCost) * 100
      : 0;
  assert(
    Math.abs(freshPct - 35) < 0.05 &&
      freshQuoteBreakdown.finalPackagePrice > savedQuoteSnapshot.finalPackagePrice,
    `New quotation immediately uses updated 35% margin (${savedQuoteSnapshot.finalPackagePrice} -> ${freshQuoteBreakdown.finalPackagePrice})`
  );

  // =========================================================================
  // TEST G — Security, Role Access, Validation & Agent Redaction
  // =========================================================================
  console.log('\n--- TEST G: Security, Role Access, Validation & Agent Redaction ---');
  assert(canUserManageMargins(adminUser).allowed === true, 'Admin user permitted');
  assert(canUserManageMargins(financeStaffUser).allowed === true, 'Finance-permitted team member permitted');
  assert(canUserManageMargins(unprivilegedStaffUser).allowed === false, 'Unprivileged team member denied');
  assert(canUserManageMargins(b2bAgentUser).allowed === false, 'B2B_AGENT denied client-side');
  assert(canUserManageMargins(agencyOwnerUser).allowed === false, 'AGENCY_OWNER denied client-side');
  assert(canUserManageMargins(buyerUser).allowed === false, 'BUYER denied client-side');

  assert(isRoleAuthorizedForMarginGovernance(b2bAgentUser as any, b2bAgentUser.email) === false, 'Server RBAC rejects B2B_AGENT');
  assert(isRoleAuthorizedForMarginGovernance(agencyOwnerUser as any, agencyOwnerUser.email) === false, 'Server RBAC rejects AGENCY_OWNER');
  assert(isRoleAuthorizedForMarginGovernance(unprivilegedStaffUser as any, unprivilegedStaffUser.email) === false, 'Server RBAC rejects unprivileged TEAM_MEMBER');
  assert(isRoleAuthorizedForMarginGovernance(financeStaffUser as any, financeStaffUser.email) === true, 'Server RBAC permits Finance TEAM_MEMBER');

  const agentSaveAttempt = await saveProductMargin({
    productId: baseProd.id,
    marginType: 'PERCENTAGE',
    marginValue: 1,
    actor: b2bAgentUser
  });
  assert(agentSaveAttempt.success === false && agentSaveAttempt.code === 'FORBIDDEN', 'saveProductMargin blocks B2B Agent with FORBIDDEN');

  // Strict input validation (client & server)
  const badInputs = ['', '   ', '-5', 'NaN', 'abc', '501', '12.345'];
  for (const bad of badInputs) {
    const clientV = validateMarginGovernanceInput({ marginType: 'PERCENTAGE', marginValue: bad });
    const serverV = validateMarginPayload({ marginType: 'PERCENTAGE', marginValue: bad });
    assert(!clientV.valid && !serverV.valid, `Rejected malformed/out-of-bounds input "${bad}" without coercing to 0`);
  }

  // Redaction verification for Agent DTO
  const sanitized = sanitizeProductForAgent(freshProdAfter35) as any;
  assert(sanitized.b2bAgentMarkupPercent === undefined, 'sanitizeProductForAgent strips b2bAgentMarkupPercent');
  assert(sanitized.defaultMarkupPercent === undefined, 'sanitizeProductForAgent strips defaultMarkupPercent');
  assert(sanitized.marginType === undefined, 'sanitizeProductForAgent strips marginType');
  assert(sanitized.marginFixed === undefined, 'sanitizeProductForAgent strips marginFixed');
  assert(sanitized.commissionPercent === undefined, 'sanitizeProductForAgent strips commissionPercent');
  assert(sanitized.marginStatus === undefined, 'sanitizeProductForAgent strips marginStatus');
  assert(sanitized.marginConfigVersion === undefined, 'sanitizeProductForAgent strips marginConfigVersion');
  assert(sanitized.marginLastChangeReason === undefined, 'sanitizeProductForAgent strips marginLastChangeReason');

  // Print clean summary & verified product metrics
  console.log('\n--------------------------------------------------------------------');
  console.log('VERIFIED REAL PRODUCT EXAMPLE:');
  console.log(`  Product ID:   ${baseProd.id}`);
  console.log(`  Product SKU:  ${baseProd.sku}`);
  console.log(`  Product Name: ${baseProd.name}`);
  console.log(`  Nett Cost:    ${nett} ${currency}`);
  console.log(`  Before Margin: ${beforeMarginPct}% -> Selling ${beforeSellingPrice} ${currency}`);
  console.log(`  After Margin:  22% -> Selling ${afterRow.currentSellingPrice} ${currency}`);
  console.log(`  Bumped Margin: 35% -> New Quote Final ${freshQuoteBreakdown.finalPackagePrice} ${currency} (Saved Quote v1 Frozen at ${preservedBreakdown.finalPackagePrice} ${currency})`);
  console.log('--------------------------------------------------------------------');
  console.log(`\nSUMMARY: ${passedAssertions}/${totalAssertions} passed, ${failedAssertions} failed.`);

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal error in marginCommissionGovernanceAudit:', err);
  process.exit(1);
});
