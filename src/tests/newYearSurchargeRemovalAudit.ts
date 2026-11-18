import { AppDatabase } from '../services/db';
import {
  calculateProductPrice,
  calculateQuoteInternalBreakdown,
  evaluateApplicableSurcharges
} from '../services/pricingEngine';
import { clearSurchargeEngineCache, INITIAL_SURCHARGE_MASTERS } from '../services/surchargeEngine';
import { Product, SurchargeMaster, User } from '../types';

const ADMIN_ACTOR: User = {
  id: 'usr-admin-business',
  name: 'Master Admin',
  email: 'business@theunbound.in',
  role: 'ADMIN',
  createdAt: '2026-01-01T00:00:00.000Z'
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string, details?: any) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`, details || '');
  }
}

async function runAudit() {
  console.log('===================================================================');
  console.log(' CRITICAL AUDIT: UNAUTHORISED "NEW YEAR" SURCHARGE & DEMO DATA FIX ');
  console.log('===================================================================\n');

  const db = AppDatabase.getInstance();
  clearSurchargeEngineCache();

  // -------------------------------------------------------------------------
  // 0. Verify No Hardcoded Demo Surcharges & No Legacy Product Surcharge Evaluation
  // -------------------------------------------------------------------------
  console.log('--- [Check 0] Hardcoded Demo Surcharges & Legacy Inline Surcharge Rejection ---');
  assert(
    INITIAL_SURCHARGE_MASTERS.length === 0,
    'INITIAL_SURCHARGE_MASTERS is strictly empty (0 hardcoded demo surcharges)'
  );
  assert(
    db.getSurchargeMasters(true).length === 0,
    'Default Surcharge Management catalog starts with 0 surcharges'
  );

  const legacyNaritaTransferProduct: Product = {
    id: 'prod-1790959387901',
    sku: 'TRF-NRT-TYO-01',
    name: 'Narita Airport -> Tokyo Hotel',
    category: 'Transfers',
    productType: 'Airport Transfer',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    country: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 35000,
    childNetPrice: 35000,
    infantNetPrice: 0,
    defaultMarkupPercent: 20,
    b2bAgentMarkupPercent: 20,
    buyerMarkupPercent: 20,
    taxPercent: 10,
    validityFrom: '2026-01-01',
    validityTo: '2027-12-31',
    status: 'ACTIVE',
    // Simulate a legacy inline "New Year" surcharge still attached to a product object
    surcharges: [
      {
        surchargeId: 'SUR-MVW9M7GL-3KEUV',
        name: 'New Year',
        type: 'PERCENTAGE',
        value: 30,
        currency: 'JPY',
        validFrom: '2026-12-15',
        validTo: '2027-01-05',
        applicationBasis: 'PER_VEHICLE',
        status: 'ACTIVE'
      }
    ]
  } as unknown as Product;

  // -------------------------------------------------------------------------
  // TEST A: No Active Surcharges in Surcharge Management
  // -------------------------------------------------------------------------
  console.log('\n--- [Test A] No Active Surcharges in Surcharge Management ---');
  const calcTestA = calculateProductPrice(legacyNaritaTransferProduct, {
    productId: legacyNaritaTransferProduct.id,
    productName: legacyNaritaTransferProduct.name,
    pricingTier: 'B2B',
    userRole: 'ADMIN',
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-12-31', // New Year's Eve
    targetCurrency: 'JPY'
  });

  assert(
    calcTestA.surchargeTotal === 0 && (calcTestA.appliedSurcharges || []).length === 0,
    'Test A1: Product calculation on 2026-12-31 applies 0 surcharges and ignores legacy inline "New Year" surcharge',
    { surchargeTotal: calcTestA.surchargeTotal, appliedSurcharges: calcTestA.appliedSurcharges }
  );

  const directEvalTestA = evaluateApplicableSurcharges({
    surcharges: legacyNaritaTransferProduct.surcharges,
    productId: legacyNaritaTransferProduct.id,
    productName: legacyNaritaTransferProduct.name,
    category: 'Transfers',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    serviceDate: '2027-01-01', // New Year's Day
    baseNativeAmount: 42000,
    baseTargetAmount: 42000,
    nativeCurrency: 'JPY',
    targetCurrency: 'JPY',
    adults: 2,
    children: 0,
    quantity: 1
  });

  assert(
    directEvalTestA.totalSurchargeConverted === 0 && directEvalTestA.appliedSurcharges.length === 0,
    'Test A2: evaluateApplicableSurcharges on 2027-01-01 applies 0 surcharges when Surcharge Management is empty'
  );

  const quoteTestA = calculateQuoteInternalBreakdown({
    items: [
      {
        id: 'item-ny-1',
        product: legacyNaritaTransferProduct,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-12-31'
      }
    ],
    targetCurrency: 'JPY',
    user: ADMIN_ACTOR
  });

  assert(
    quoteTestA.surchargesTotal === 0 && (quoteTestA.appliedSurcharges || []).length === 0,
    'Test A3: Quotation total during Dec 2026 / Jan 2027 has 0 surcharges and no "New Year" surcharge appears',
    { surchargesTotal: quoteTestA.surchargesTotal }
  );

  // -------------------------------------------------------------------------
  // TEST B: Active Surcharge Created in Surcharge Management
  // -------------------------------------------------------------------------
  console.log('\n--- [Test B] Active Surcharge Created in Surcharge Management ---');
  const adminCreatedSurcharge: SurchargeMaster = {
    id: 'sur-admin-ny-official-2026',
    code: 'SUR-ADM-NY-01',
    surchargeCode: 'SUR-ADM-NY-01',
    name: 'Official Admin Year-End Chauffeur Supplement',
    surchargeCategory: 'Year-End & New Year Peak',
    destinationId: 'dest-japan',
    destinationName: 'Japan',
    applicableDestinations: ['Japan'],
    applicableDestinationIds: ['dest-japan'],
    applicableCategories: ['Transfers'],
    linkedProductIds: [legacyNaritaTransferProduct.id],
    status: 'ACTIVE',
    isActive: true,
    validFrom: '2026-12-28',
    validTo: '2027-01-03',
    timezone: 'Asia/Tokyo',
    allowStacking: false,
    priority: 100,
    calculationType: 'FIXED',
    pricingBasis: 'FIXED_AMOUNT',
    amount: 8000,
    currency: 'JPY',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveSurchargeMaster(adminCreatedSurcharge, ADMIN_ACTOR, 'Test B: Created official surcharge');

  const quoteTestB = calculateQuoteInternalBreakdown({
    items: [
      {
        id: 'item-ny-1',
        product: legacyNaritaTransferProduct,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-12-31'
      }
    ],
    targetCurrency: 'JPY',
    user: ADMIN_ACTOR
  });

  assert(
    quoteTestB.surchargesTotal === 8000 &&
      quoteTestB.appliedSurcharges?.length === 1 &&
      quoteTestB.appliedSurcharges[0].surchargeId === 'sur-admin-ny-official-2026' &&
      quoteTestB.appliedSurcharges[0].surchargeName === 'Official Admin Year-End Chauffeur Supplement',
    'Test B1: Active surcharge created in Surcharge Management is applied accurately (JPY 8,000)',
    { surchargesTotal: quoteTestB.surchargesTotal, applied: quoteTestB.appliedSurcharges }
  );

  // -------------------------------------------------------------------------
  // TEST C: Inactive Surcharge in Surcharge Management
  // -------------------------------------------------------------------------
  console.log('\n--- [Test C] Inactive Surcharge in Surcharge Management ---');
  db.toggleSurchargeMasterStatus('sur-admin-ny-official-2026', 'INACTIVE', ADMIN_ACTOR, 'Test C: Deactivated surcharge');

  const quoteTestC = calculateQuoteInternalBreakdown({
    items: [
      {
        id: 'item-ny-1',
        product: legacyNaritaTransferProduct,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-12-31'
      }
    ],
    targetCurrency: 'JPY',
    user: ADMIN_ACTOR
  });

  assert(
    quoteTestC.surchargesTotal === 0 && (quoteTestC.appliedSurcharges || []).length === 0,
    'Test C1: Deactivated surcharge is NOT applied to new quotation calculations',
    { surchargesTotal: quoteTestC.surchargesTotal }
  );

  // Reactivate for Tests D, E, F, G
  db.toggleSurchargeMasterStatus('sur-admin-ny-official-2026', 'ACTIVE', ADMIN_ACTOR, 'Reactivate for Test D');

  // -------------------------------------------------------------------------
  // TEST D: Date Outside Surcharge Range
  // -------------------------------------------------------------------------
  console.log('\n--- [Test D] Date Outside Surcharge Range ---');
  const quoteTestD = calculateQuoteInternalBreakdown({
    items: [
      {
        id: 'item-ny-outside',
        product: legacyNaritaTransferProduct,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-12-16' // Outside 2026-12-28..2027-01-03 (even though inside legacy 2026-12-15..2027-01-05!)
      }
    ],
    targetCurrency: 'JPY',
    user: ADMIN_ACTOR
  });

  assert(
    quoteTestD.surchargesTotal === 0 && (quoteTestD.appliedSurcharges || []).length === 0,
    'Test D1: Quotation outside central surcharge date range has 0 surcharges',
    { surchargesTotal: quoteTestD.surchargesTotal }
  );

  // -------------------------------------------------------------------------
  // TEST E: Destination-Specific Surcharge Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- [Test E] Destination-Specific Surcharge Isolation ---');
  const londonTransferProduct: Product = {
    ...legacyNaritaTransferProduct,
    id: 'prod-uk-heathrow-trf',
    sku: 'TRF-LHR-LON-01',
    name: 'Heathrow Airport -> Central London Hotel',
    destinationId: 'dest-uk',
    destinationName: 'United Kingdom',
    country: 'United Kingdom',
    city: 'London',
    currency: 'GBP',
    nativeCurrency: 'GBP',
    adultNetPrice: 180,
    childNetPrice: 180,
    surcharges: []
  };

  // Also test broad category surcharge for Destination A (Japan) vs Destination B (United Kingdom)
  db.saveSurchargeMaster(
    {
      ...adminCreatedSurcharge,
      linkedProductIds: [],
      applyToAllCategoryProducts: true,
      applicableCategories: ['Transfers'],
      destinationId: 'dest-japan',
      destinationName: 'Japan',
      applicableDestinations: ['Japan'],
      applicableDestinationIds: ['dest-japan']
    },
    ADMIN_ACTOR,
    'Test E: Broad Japan transfer surcharge'
  );

  const quoteTestE = calculateQuoteInternalBreakdown({
    items: [
      {
        id: 'item-uk-1',
        product: londonTransferProduct,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-12-31'
      }
    ],
    targetCurrency: 'GBP',
    user: ADMIN_ACTOR
  });

  assert(
    quoteTestE.surchargesTotal === 0 && (quoteTestE.appliedSurcharges || []).length === 0,
    "Test E1: Destination A (Japan) surcharge does NOT apply to Destination B (United Kingdom) quotation",
    { surchargesTotal: quoteTestE.surchargesTotal }
  );

  // -------------------------------------------------------------------------
  // TEST F: Historical Finalised Quotation Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- [Test F] Historical Finalised Quotation Snapshot Preservation ---');
  const calcWithActiveSurcharge = calculateProductPrice(legacyNaritaTransferProduct, {
    productId: legacyNaritaTransferProduct.id,
    productName: legacyNaritaTransferProduct.name,
    itemId: 'item-locked-1',
    pricingTier: 'B2B',
    userRole: 'ADMIN',
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-12-31',
    targetCurrency: 'JPY'
  });

  assert(
    calcWithActiveSurcharge.surchargeTotal === 8000,
    'Test F1: Pre-lock calculation includes active JPY 8,000 surcharge'
  );

  // Now delete the surcharge from Surcharge Management
  const delResult = db.deleteSurchargeMaster('sur-admin-ny-official-2026', ADMIN_ACTOR, 'Test F/G: Delete surcharge');
  assert(delResult.success === true, 'Test F2: Deleted surcharge from Surcharge Management');

  // Verify historical locked quotation preserves its frozen snapshot
  const lockedQuoteEval = calculateQuoteInternalBreakdown({
    items: [
      {
        id: 'item-locked-1',
        product: legacyNaritaTransferProduct,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-12-31',
        calculation: calcWithActiveSurcharge
      }
    ],
    targetCurrency: 'JPY',
    user: ADMIN_ACTOR,
    preserveHistoricalSnapshot: true,
    historicalSnapshot: {
      snapshotId: 'snap-hist-01',
      lockedAt: '2026-11-01T00:00:00.000Z',
      targetCurrency: 'JPY',
      totalNetCost: calcWithActiveSurcharge.totalNetCost,
      totalMargin: calcWithActiveSurcharge.dmcMarginAmount,
      totalTax: calcWithActiveSurcharge.taxAmount,
      totalServiceFee: calcWithActiveSurcharge.serviceFee,
      totalSurcharges: 8000,
      finalSellingPrice: calcWithActiveSurcharge.finalTotalSellingPrice,
      lineItems: [
        {
          itemId: 'item-locked-1',
          productId: legacyNaritaTransferProduct.id,
          productName: legacyNaritaTransferProduct.name,
          category: 'Transfers',
          nativeNetCost: calcWithActiveSurcharge.nativeTotalNetCost,
          nativeCurrency: 'JPY',
          appliedExchangeRate: 1,
          convertedNetCost: calcWithActiveSurcharge.totalNetCost,
          marginAmount: calcWithActiveSurcharge.dmcMarginAmount,
          taxAmount: calcWithActiveSurcharge.taxAmount,
          serviceFee: calcWithActiveSurcharge.serviceFee,
          surchargeTotal: 8000,
          appliedSurcharges: calcWithActiveSurcharge.appliedSurcharges,
          finalSellingPrice: calcWithActiveSurcharge.finalTotalSellingPrice
        }
      ]
    } as any
  });

  assert(
    lockedQuoteEval.surchargesTotal === 8000 &&
      lockedQuoteEval.finalPackagePrice === calcWithActiveSurcharge.finalTotalSellingPrice,
    'Test F3: Historical locked/finalised quotation preserves its financial snapshot unchanged (JPY 8,000)',
    { lockedSurcharges: lockedQuoteEval.surchargesTotal, lockedTotal: lockedQuoteEval.finalPackagePrice }
  );

  // -------------------------------------------------------------------------
  // TEST G: Draft Quotation Recalculation (No Stale Cached Surcharges)
  // -------------------------------------------------------------------------
  console.log('\n--- [Test G] Draft Quotation Recalculation ---');
  // Pass the exact same item that still has `calculation: calcWithActiveSurcharge` (cached from before deletion),
  // but with preserveHistoricalSnapshot: false (unlocked draft quotation).
  const draftQuoteRecalc = calculateQuoteInternalBreakdown({
    items: [
      {
        id: 'item-draft-1',
        product: legacyNaritaTransferProduct,
        pax: { adults: 2, children: 0, infants: 0 },
        travelDate: '2026-12-31',
        calculation: calcWithActiveSurcharge
      }
    ],
    targetCurrency: 'JPY',
    user: ADMIN_ACTOR,
    preserveHistoricalSnapshot: false
  });

  assert(
    draftQuoteRecalc.surchargesTotal === 0 && (draftQuoteRecalc.appliedSurcharges || []).length === 0,
    'Test G1: Draft quotation recalculation rejects deleted/missing cached surcharge and recalculates using only current active Surcharge Management records (0 surcharges)',
    { draftSurcharges: draftQuoteRecalc.surchargesTotal, applied: draftQuoteRecalc.appliedSurcharges }
  );

  console.log('\n===================================================================');
  console.log(` AUDIT SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Unhandled error in audit:', err);
  process.exit(1);
});
