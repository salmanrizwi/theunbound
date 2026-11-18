/**
 * Applicable Surcharges Breakdown — End-to-End Data Flow, Metadata & Progressive Stacking Audit
 *
 * Verifies all root causes addressed across Admin CMS -> surchargeEngine -> pricingEngine ->
 * Manual Margin Adjustment -> Snapshot & Export parity:
 *  1. Complete canonical fields (itemId, productName, serviceDate, serviceEndDate, surchargeName,
 *     periodStartDate, periodEndDate, calculationType, rateValue, priceAfterSurcharge).
 *  2. Compatibility with Admin CMS SurchargeManagementModule periods (`travelValidFrom`/`travelValidTo`).
 *  3. Boundary & expired date window checks + multi-night stays.
 *  4. Fixed pax-specific rates (`adultAmount`/`childAmount` when `amount === 0`) and multi-currency (`JPY`, `GBP`, `USD`, `INR`).
 *  5. Progressive `priceAfterSurcharge` stacking when multiple surcharges apply to the same product.
 *  6. Multi-product independence (each row isolated by `itemId` and actual product name).
 *  7. Live synchronization with Admin Manual Margin Adjustment (`ADD` and `REPLACE` modes).
 *  8. Historical snapshot preservation (`preserveHistoricalSnapshot`) and duplicate-row prevention.
 */

import { AppDatabase } from '../services/db';
import { currencyEngine } from '../services/currencyEngine';
import {
  calculateProductPrice,
  calculateQuoteInternalBreakdown,
  buildQuotationCurrencySnapshot,
  roundCurrencyAmount
} from '../services/pricingEngine';
import { evaluateCentralizedProductSurcharges } from '../services/surchargeEngine';
import { Product, ProductCategory, SurchargeMaster, User } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, label: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${label}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${label}`, details !== undefined ? JSON.stringify(details, null, 2) : '');
  }
}

console.log('================================================================================');
console.log('  APPLICABLE SURCHARGES BREAKDOWN — DATA FLOW & STACKING VERIFICATION');
console.log('================================================================================\n');

const db = AppDatabase.getInstance();

const adminUser: User = {
  id: 'usr-admin-sur-audit',
  email: 'admin@theunbound.in',
  name: 'Pricing Admin',
  role: 'ADMIN',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z'
};

// Products
const tourProduct: Product = {
  id: 'prod-sur-tour-tokyo-01',
  sku: 'TKY-CITY-01',
  name: 'Tokyo City Tour',
  category: 'Sightseeing' as ProductCategory,
  destinationId: 'dest-japan',
  destinationName: 'Japan',
  country: 'Japan',
  city: 'Tokyo',
  currency: 'JPY',
  adultNetPrice: 20000,
  childNetPrice: 12000,
  infantNetPrice: 0,
  defaultMarkupPercent: 15,
  taxPercent: 0,
  commissionPercent: 0,
  minPax: 1,
  maxPax: 10,
  validity: { validFrom: '2026-01-01', validTo: '2027-12-31' },
  status: 'ACTIVE'
} as any;

const transferProduct: Product = {
  id: 'prod-sur-trf-haneda-01',
  sku: 'HND-TRF-01',
  name: 'Private Airport Transfer',
  category: 'Transfers' as ProductCategory,
  destinationId: 'dest-japan',
  destinationName: 'Japan',
  country: 'Japan',
  city: 'Tokyo',
  currency: 'GBP',
  adultNetPrice: 200,
  childNetPrice: 200,
  infantNetPrice: 0,
  vehicleConfig: {
    vehicleName: 'Toyota Alphard Executive',
    vehicleModel: 'Toyota Alphard',
    vehicleType: 'MPV',
    maxSeats: 6,
    passengerCapacity: 6,
    unitVehicleNetCost: 200
  },
  defaultMarkupPercent: 10,
  taxPercent: 0,
  commissionPercent: 0,
  minPax: 1,
  maxPax: 6,
  validity: { validFrom: '2026-01-01', validTo: '2027-12-31' },
  status: 'ACTIVE'
} as any;

const hotelProduct: Product = {
  id: 'prod-sur-htl-kyoto-01',
  sku: 'KYO-HTL-01',
  name: 'Hotel Gracery Kyoto Sanjo — Deluxe Twin',
  category: 'Hotels & Accommodation' as ProductCategory,
  productType: 'Hotel',
  destinationId: 'dest-japan',
  destinationName: 'Japan',
  country: 'Japan',
  city: 'Kyoto',
  currency: 'JPY',
  adultNetPrice: 18000,
  childNetPrice: 9000,
  infantNetPrice: 0,
  nights: 3,
  roomsCount: 1,
  defaultMarkupPercent: 10,
  taxPercent: 0,
  commissionPercent: 0,
  minPax: 1,
  maxPax: 6,
  validity: { validFrom: '2026-01-01', validTo: '2027-12-31' },
  status: 'ACTIVE'
} as any;

// Register products in memory DB
(db as any).products = [...((db as any).products || []).filter((p: Product) => !p.id.startsWith('prod-sur-')), tourProduct, transferProduct, hotelProduct];

// Centralized surcharges including Admin CMS `travelValidFrom`/`travelValidTo` periods & pax-specific fixed rates
const pctPeakSurcharge: SurchargeMaster = {
  id: 'sur-audit-pct-01',
  surchargeCode: 'SUR-PEAK-26',
  name: 'Autumn Foliage Peak Multiplier',
  surchargeCategory: 'PEAK_SEASON',
  status: 'ACTIVE',
  isActive: true,
  validFrom: '2026-11-10',
  validTo: '2026-11-25',
  periods: [
    {
      id: 'per-1',
      label: 'Autumn Peak Window',
      travelValidFrom: '2026-11-10',
      travelValidTo: '2026-11-25'
    } as any
  ],
  timezone: 'Asia/Tokyo',
  allowStacking: true,
  priority: 100,
  linkedProductIds: [tourProduct.id, hotelProduct.id],
  calculationType: 'PERCENTAGE',
  pricingBasis: 'PERCENTAGE',
  amount: 0,
  percentage: 15,
  currency: 'JPY',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const fixedJpyPerPaxSurcharge: SurchargeMaster = {
  id: 'sur-audit-fix-jpy-02',
  surchargeCode: 'SUR-FEST-26',
  name: 'Imperial Illumination Guide Levy',
  surchargeCategory: 'EVENT_SURCHARGE',
  status: 'ACTIVE',
  isActive: true,
  validFrom: '2026-11-15',
  validTo: '2026-11-20',
  periods: [
    {
      id: 'per-2',
      label: 'Evening Event Window',
      travelStartDate: '2026-11-15',
      travelEndDate: '2026-11-20'
    }
  ],
  timezone: 'Asia/Tokyo',
  allowStacking: true,
  priority: 90,
  linkedProductIds: [tourProduct.id],
  calculationType: 'FIXED',
  pricingBasis: 'PER_PERSON',
  amount: 3500,
  currency: 'JPY',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const fixedGbpPaxSplitSurcharge: SurchargeMaster = {
  id: 'sur-audit-fix-gbp-03',
  surchargeCode: 'SUR-NIGHT-LON',
  name: 'Late Night Chauffeur Dispatch Fee',
  surchargeCategory: 'OPERATIONAL_FEE',
  status: 'ACTIVE',
  isActive: true,
  validFrom: '2026-11-01',
  validTo: '2026-11-30',
  timezone: 'UTC',
  allowStacking: true,
  priority: 80,
  linkedProductIds: [transferProduct.id],
  calculationType: 'FIXED',
  pricingBasis: 'PER_PERSON',
  amount: 0, // Intentionally 0 on `amount` with adultAmount & childAmount configured
  adultAmount: 45,
  childAmount: 25,
  currency: 'GBP',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

db.saveSurchargeMaster(pctPeakSurcharge, adminUser);
db.saveSurchargeMaster(fixedJpyPerPaxSurcharge, adminUser);
db.saveSurchargeMaster(fixedGbpPaxSplitSurcharge, adminUser);

console.log('--- 1. Single-Day Product With Stacked Percentage + Fixed JPY Surcharges ---');
const tourCalc = calculateProductPrice(tourProduct, {
  productId: tourProduct.id,
  productName: tourProduct.name,
  itemId: 'item-tky-1',
  quoteId: 'qte-audit-1',
  quoteVersion: 1,
  pricingTier: 'B2B',
  userRole: 'ADMIN',
  user: adminUser,
  productLevelMarginEnabled: true,
  adults: 2,
  children: 0,
  infants: 0,
  travelDate: '2026-11-15',
  targetCurrency: 'INR'
});

const tourSurs = tourCalc.appliedSurcharges || [];
assert(tourSurs.length === 2, 'Two stacked surcharges applied to Tokyo City Tour', { count: tourSurs.length });
const s1 = tourSurs[0];
const s2 = tourSurs[1];
const pctRow = tourSurs.find(x => x.surchargeId === pctPeakSurcharge.id);
const fixRow = tourSurs.find(x => x.surchargeId === fixedJpyPerPaxSurcharge.id);

assert(
  pctRow?.itemId === 'item-tky-1' &&
  pctRow?.productName === 'Tokyo City Tour' &&
  pctRow?.serviceDate === '2026-11-15' &&
  pctRow?.surchargeName === 'Autumn Foliage Peak Multiplier' &&
  pctRow?.periodStartDate === '2026-11-10' &&
  pctRow?.periodEndDate === '2026-11-25' &&
  pctRow?.calculationType === 'PERCENTAGE' &&
  pctRow?.rateValue === 15,
  'Surcharge (Percentage) emits all required metadata fields cleanly',
  pctRow
);

assert(
  fixRow?.itemId === 'item-tky-1' &&
  fixRow?.productName === 'Tokyo City Tour' &&
  fixRow?.surchargeName === 'Imperial Illumination Guide Levy' &&
  fixRow?.periodStartDate === '2026-11-15' &&
  fixRow?.periodEndDate === '2026-11-20' &&
  fixRow?.calculationType === 'FIXED' &&
  fixRow?.rateValue === 3500 &&
  fixRow?.currency === 'JPY',
  'Surcharge (Fixed JPY) emits exact ¥3,500 source rate & period window',
  fixRow
);

assert(
  s1 !== undefined &&
  s2 !== undefined &&
  s1.baseSellingPriceInTargetCurrency === tourCalc.baseSellingPriceBeforeSurcharges &&
  s1.priceAfterSurcharge === roundCurrencyAmount(s1.baseSellingPriceInTargetCurrency! + s1.appliedAmountConverted, 'INR') &&
  s2.baseSellingPriceInTargetCurrency === s1.priceAfterSurcharge &&
  s2.priceAfterSurcharge === tourCalc.finalTotalSellingPrice,
  'Stacked surcharges produce sequential progressive priceAfterSurcharge ending at item finalTotalSellingPrice',
  {
    baseBefore: tourCalc.baseSellingPriceBeforeSurcharges,
    s1Base: s1?.baseSellingPriceInTargetCurrency,
    s1After: s1?.priceAfterSurcharge,
    s2Base: s2?.baseSellingPriceInTargetCurrency,
    s2After: s2?.priceAfterSurcharge,
    finalSelling: tourCalc.finalTotalSellingPrice
  }
);

console.log('\n--- 2. Boundary Dates, TravelValidFrom Compatibility & Multi-Night Stay ---');
const boundaryStart = evaluateCentralizedProductSurcharges({
  product: tourProduct,
  serviceDate: '2026-11-10',
  adults: 2,
  targetCurrency: 'INR',
  centralizedSurcharges: [pctPeakSurcharge]
});
const boundaryBefore = evaluateCentralizedProductSurcharges({
  product: tourProduct,
  serviceDate: '2026-11-09',
  adults: 2,
  targetCurrency: 'INR',
  centralizedSurcharges: [pctPeakSurcharge]
});
const boundaryAfter = evaluateCentralizedProductSurcharges({
  product: tourProduct,
  serviceDate: '2026-11-26',
  adults: 2,
  targetCurrency: 'INR',
  centralizedSurcharges: [pctPeakSurcharge]
});

assert(
  boundaryStart.appliedSurcharges.length === 1 &&
  boundaryStart.appliedSurcharges[0].periodStartDate === '2026-11-10' &&
  boundaryStart.appliedSurcharges[0].periodEndDate === '2026-11-25' &&
  boundaryBefore.appliedSurcharges.length === 0 &&
  boundaryAfter.appliedSurcharges.length === 0,
  'Admin CMS travelValidFrom/travelValidTo period window matches exact inclusive range 2026-11-10..2026-11-25 only'
);

const stayCalc = calculateProductPrice(hotelProduct, {
  productId: hotelProduct.id,
  productName: hotelProduct.name,
  itemId: 'item-htl-1',
  pricingTier: 'B2B',
  userRole: 'ADMIN',
  user: adminUser,
  productLevelMarginEnabled: true,
  adults: 2,
  children: 0,
  infants: 0,
  travelDate: '2026-11-18',
  serviceEndDate: '2026-11-21',
  nights: 3,
  roomsCount: 1,
  targetCurrency: 'INR'
});

assert(
  stayCalc.appliedSurcharges?.[0]?.serviceDate === '2026-11-18' &&
  stayCalc.appliedSurcharges?.[0]?.serviceEndDate === '2026-11-21' &&
  stayCalc.appliedSurcharges?.[0]?.eligibleDaysCount === 3,
  'Multi-night stay retains full serviceDate..serviceEndDate range and counts eligible nights accurately',
  stayCalc.appliedSurcharges?.[0]
);

console.log('\n--- 3. Zero-Amount Pax-Specific Fixed Rate (GBP) & Multi-Product Breakdown + Manual Margin Live Update ---');
const transferCalc = calculateProductPrice(transferProduct, {
  productId: transferProduct.id,
  productName: transferProduct.name,
  itemId: 'item-trf-1',
  pricingTier: 'B2B',
  userRole: 'ADMIN',
  user: adminUser,
  productLevelMarginEnabled: true,
  adults: 2,
  children: 1,
  infants: 0,
  travelDate: '2026-11-16',
  targetCurrency: 'INR'
});

const trfSur = transferCalc.appliedSurcharges?.[0];
assert(
  trfSur !== undefined &&
  trfSur.currency === 'GBP' &&
  trfSur.adultRate === 45 &&
  trfSur.childRate === 25 &&
  trfSur.rateValue === 45 &&
  trfSur.appliedAmountNative === 115 && // 2*45 + 1*25
  trfSur.productName === 'Private Airport Transfer',
  'Pax-split GBP surcharge with amount:0 resolves £45 adult / £25 child rates and £115 native amount (never £0.00)',
  trfSur
);

const multiItems = [
  {
    id: 'item-tky-1',
    product: tourProduct,
    pax: { adults: 2, children: 0, infants: 0 },
    travelDate: '2026-11-15',
    calculation: tourCalc
  },
  {
    id: 'item-trf-1',
    product: transferProduct,
    pax: { adults: 2, children: 1, infants: 0 },
    travelDate: '2026-11-16',
    calculation: transferCalc
  }
];

const breakdownAddZero = calculateQuoteInternalBreakdown({
  items: multiItems,
  targetCurrency: 'INR',
  user: adminUser,
  productLevelMarginEnabled: true,
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 0,
  adminMarginMode: 'ADD'
});

const breakdownAddTen = calculateQuoteInternalBreakdown({
  items: multiItems,
  targetCurrency: 'INR',
  user: adminUser,
  productLevelMarginEnabled: true,
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 10,
  adminMarginMode: 'ADD'
});

const breakdownReplaceTwenty = calculateQuoteInternalBreakdown({
  items: multiItems,
  targetCurrency: 'INR',
  user: adminUser,
  productLevelMarginEnabled: true,
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 20,
  adminMarginMode: 'REPLACE'
});

const rowsAddZero = breakdownAddZero.appliedSurcharges || [];
const rowsAddTen = breakdownAddTen.appliedSurcharges || [];
const rowsReplace = breakdownReplaceTwenty.appliedSurcharges || [];

assert(
  rowsAddZero.length === 3 &&
  rowsAddTen.length === 3 &&
  rowsReplace.length === 3 &&
  rowsAddZero.every(r => r.productName !== 'Inventory Service' && Boolean(r.surchargeName) && Boolean(r.periodStartDate) && Boolean(r.periodEndDate) && (r.calculationType === 'PERCENTAGE' || r.calculationType === 'FIXED') && r.priceAfterSurcharge !== undefined),
  'All 3 breakdown rows across 2 independent items have non-blank product names, names, periods, types, rates, and prices',
  rowsAddZero.map(r => ({ p: r.productName, s: r.surchargeName, after: r.priceAfterSurcharge }))
);

const sumRowsAddZero = roundCurrencyAmount(rowsAddZero.reduce((acc, r) => acc + r.appliedAmountConverted, 0), 'INR');
assert(
  sumRowsAddZero === breakdownAddZero.surchargesTotal &&
  breakdownAddTen.surchargesTotal === breakdownAddZero.surchargesTotal &&
  breakdownReplaceTwenty.surchargesTotal === breakdownAddZero.surchargesTotal,
  'Total Surcharges equals exact sum of breakdown rows and remains unchanged under Manual Margin ADD & REPLACE edits',
  {
    sumRowsAddZero,
    addZeroTotal: breakdownAddZero.surchargesTotal,
    addTenTotal: breakdownAddTen.surchargesTotal,
    replaceTotal: breakdownReplaceTwenty.surchargesTotal
  }
);

const tourItemRowTen = breakdownAddTen.itemizedBreakdown.find(b => b.itemId === 'item-tky-1');
const tourLastSurTen = rowsAddTen.filter(r => r.itemId === 'item-tky-1').pop();
const trfItemRowTen = breakdownAddTen.itemizedBreakdown.find(b => b.itemId === 'item-trf-1');
const trfLastSurTen = rowsAddTen.find(r => r.itemId === 'item-trf-1');

assert(
  tourLastSurTen?.priceAfterSurcharge === tourItemRowTen?.theUnboundBaseSellingPrice &&
  trfLastSurTen?.priceAfterSurcharge === trfItemRowTen?.theUnboundBaseSellingPrice &&
  (tourLastSurTen?.priceAfterSurcharge || 0) > (rowsAddZero.filter(r => r.itemId === 'item-tky-1').pop()?.priceAfterSurcharge || 0),
  'Manual Margin ADD +10% updates every row priceAfterSurcharge live to match each item updated Stage 1 base selling price',
  {
    tourItemBaseTen: tourItemRowTen?.theUnboundBaseSellingPrice,
    tourSurAfterTen: tourLastSurTen?.priceAfterSurcharge,
    trfItemBaseTen: trfItemRowTen?.theUnboundBaseSellingPrice,
    trfSurAfterTen: trfLastSurTen?.priceAfterSurcharge
  }
);

console.log('\n--- 4. Snapshot Parity & Historical Legacy Metadata Hydration Without Altering Amounts ---');
const snapshot = buildQuotationCurrencySnapshot({
  quoteId: 'qte-audit-multi',
  quoteVersion: 2,
  items: multiItems as any,
  targetCurrency: 'INR',
  user: adminUser,
  productLevelMarginEnabled: true,
  adminMarginMode: 'ADD',
  adminManualMarginType: 'PERCENTAGE',
  adminManualMarginValue: 10
});

assert(
  snapshot.appliedSurcharges?.length === 3 &&
  snapshot.totals.surchargesTotal === breakdownAddTen.surchargesTotal,
  'Currency snapshot carries identical 3 reconciled surcharge rows & exact surchargesTotal'
);

// Simulate legacy broken calculation where metadata fields were missing on a historical frozen quote
const legacyBrokenItem = {
  id: 'item-hist-1',
  product: {
    id: tourProduct.id,
    name: 'Legacy Tokyo Tour Name',
    currency: 'JPY' as const,
    adultNetPrice: 20000
  } as any,
  pax: { adults: 2, children: 0, infants: 0 },
  travelDate: '2026-11-15',
  calculation: {
    nativeTotalNetCost: 40000,
    nativeCurrency: 'JPY',
    totalNetCost: 22400,
    markupAmount: 3360,
    taxAmount: 0,
    serviceFee: 0,
    surchargeTotal: 5992,
    baseSellingPriceBeforeSurcharges: 25760,
    finalTotalSellingPrice: 31752,
    currency: 'INR',
    appliedSurcharges: [
      {
        surchargeId: pctPeakSurcharge.id,
        appliedAmountNative: 6900,
        appliedAmountConverted: 3864,
        currency: 'JPY'
      },
      {
        surchargeId: fixedJpyPerPaxSurcharge.id,
        appliedAmountNative: 3800,
        appliedAmountConverted: 2128,
        currency: 'JPY'
      }
    ]
  }
};

const hydratedHistBreakdown = calculateQuoteInternalBreakdown({
  items: [legacyBrokenItem as any],
  targetCurrency: 'INR',
  user: adminUser,
  preserveHistoricalSnapshot: true
});

const histRows = hydratedHistBreakdown.appliedSurcharges || [];
assert(
  histRows.length === 2 &&
  hydratedHistBreakdown.surchargesTotal === 5992 &&
  histRows[0].appliedAmountConverted === 3864 &&
  histRows[1].appliedAmountConverted === 2128 &&
  histRows[0].productName === 'Legacy Tokyo Tour Name' &&
  histRows[0].serviceDate === '2026-11-15' &&
  histRows[0].surchargeName === 'Autumn Foliage Peak Multiplier' &&
  histRows[0].calculationType === 'PERCENTAGE' &&
  histRows[0].rateValue === 15 &&
  histRows[1].surchargeName === 'Imperial Illumination Guide Levy' &&
  histRows[1].rateValue === 3500 &&
  histRows[1].priceAfterSurcharge === 31752,
  'Historical frozen snapshot preserves exact frozen amounts (₹3,864 + ₹2,128 = ₹5,992) while hydrating all missing UI metadata',
  histRows
);

console.log('\n================================================================================');
console.log(`  SURCHARGE BREAKDOWN VERIFICATION: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('================================================================================');

if (failedTests > 0) {
  process.exit(1);
}
