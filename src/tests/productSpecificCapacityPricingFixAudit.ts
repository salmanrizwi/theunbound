import { calculateUnifiedPrice, calculateProductPrice, formatCurrency } from '../services/pricingEngine';
import { Product } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

console.log('================================================================');
console.log('  PRODUCT-SPECIFIC CAPACITY PRICING TIER — AUTHORITATIVE AUDIT  ');
console.log('================================================================\n');

// -------------------------------------------------------------
// 0. PROMPT OBJECTIVE TEST CASE
// -------------------------------------------------------------
console.log('--- 0. Testing Prompt Objective Calculation ---');
{
  // Input: Nett = 16,500, B2B Margin = 50%, Tax = 18%, Service Fee = 3%
  const result = calculateUnifiedPrice({
    nettPrice: 16500,
    quantity: 1,
    marginType: 'PERCENTAGE',
    marginValue: 50,
    taxPercent: 18,
    serviceChargeType: 'PERCENTAGE',
    serviceChargeValue: 3,
    currency: 'USD'
  });

  assert(result.nettPrice === 16500, 'Nett = 16,500');
  assert(result.marginAmount === 8250, 'Margin Amount = 16,500 × 50% = 8,250');
  assert(result.taxAmount === 1485, 'Tax Amount = 8,250 × 18% = 1,485');
  const subtotal = result.nettPrice + result.marginAmount + result.taxAmount;
  assert(subtotal === 26235, 'Subtotal = 16,500 + 8,250 + 1,485 = 26,235');
  assert(result.serviceChargeAmount === 787.05, 'Service Fee = 26,235 × 3% = 787.05');
  assert(result.finalPrice === 27022.05, 'Price = 26,235 + 787.05 = 27,022.05');

  const formattedJPY = formatCurrency(Math.floor(result.finalPrice), 'JPY');
  assert(formattedJPY.includes('27,022') || formattedJPY.includes('27022'), 'Whole unit currency display shows 27,022');
}

// -------------------------------------------------------------
// TEST 1 — Section 27 Prompt Test
// -------------------------------------------------------------
console.log('\n--- Test 1: Standard Capacity Tier Formula ---');
{
  const res = calculateUnifiedPrice({
    nettPrice: 16500,
    quantity: 1,
    marginType: 'PERCENTAGE',
    marginValue: 50,
    taxPercent: 18,
    serviceChargeType: 'PERCENTAGE',
    serviceChargeValue: 3,
    currency: 'USD'
  });
  assert(res.marginAmount === 8250, 'Margin = 8,250');
  assert(res.taxAmount === 1485, 'Tax = 1,485');
  assert(res.serviceChargeAmount === 787.05, 'Service Fee = 787.05');
  assert(res.finalPrice === 27022.05, 'Price = 27,022.05');
}

// -------------------------------------------------------------
// TEST 2 — Section 27 Prompt Test
// -------------------------------------------------------------
console.log('\n--- Test 2: Secondary Formula Test ---');
{
  const res = calculateUnifiedPrice({
    nettPrice: 10000,
    quantity: 1,
    marginType: 'PERCENTAGE',
    marginValue: 20,
    taxPercent: 18,
    serviceChargeType: 'PERCENTAGE',
    serviceChargeValue: 5,
    currency: 'USD'
  });
  assert(res.marginAmount === 2000, 'Margin = 2,000');
  assert(res.taxAmount === 360, 'Tax = 360');
  assert(res.serviceChargeAmount === 618, 'Service Fee = 618');
  assert(res.finalPrice === 12978, 'Price = 12,978');
}

// -------------------------------------------------------------
// TEST 3 — Zero Margin
// -------------------------------------------------------------
console.log('\n--- Test 3: Zero Margin ---');
{
  const res = calculateUnifiedPrice({
    nettPrice: 10000,
    quantity: 1,
    marginType: 'PERCENTAGE',
    marginValue: 0,
    taxPercent: 18,
    serviceChargeType: 'PERCENTAGE',
    serviceChargeValue: 5,
    currency: 'USD'
  });
  assert(res.marginAmount === 0, 'Margin = 0');
  assert(res.taxAmount === 0, 'Tax = 0');
  assert(res.serviceChargeAmount === 500, 'Service Fee = 500');
  assert(res.finalPrice === 10500, 'Price = 10,500');
}

// -------------------------------------------------------------
// TEST 4 — Zero Service Fee
// -------------------------------------------------------------
console.log('\n--- Test 4: Zero Service Fee ---');
{
  const res = calculateUnifiedPrice({
    nettPrice: 10000,
    quantity: 1,
    marginType: 'PERCENTAGE',
    marginValue: 20,
    taxPercent: 18,
    serviceChargeType: 'PERCENTAGE',
    serviceChargeValue: 0,
    currency: 'USD'
  });
  assert(res.marginAmount === 2000, 'Margin = 2,000');
  assert(res.taxAmount === 360, 'Tax = 360');
  assert(res.serviceChargeAmount === 0, 'Service Fee = 0');
  assert(res.finalPrice === 12360, 'Price = 12,360');
}

// -------------------------------------------------------------
// TEST 5 — Native Currency First
// -------------------------------------------------------------
console.log('\n--- Test 5: Native Currency First ---');
{
  const prod: any = {
    id: 'prod-cap-curr-01',
    name: 'Luxury Executive Transfer',
    category: 'Transfers',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    pricingMethod: 'capacity_based',
    tieredPricing: [
      {
        id: 'tier-1',
        minPax: 1,
        maxPax: 3,
        supplierNett: 16500,
        marginValue: 50,
        taxValue: 18,
        serviceChargeType: 'PERCENTAGE',
        serviceChargeValue: 3,
        status: 'ACTIVE'
      }
    ],
    status: 'ACTIVE'
  };

  const calc = calculateProductPrice(prod, {
    productId: 'prod-cap-curr-01',
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'JPY',
    pricingTier: 'B2B'
  });

  assert(calc.nativeTotalNetCost === 16500, 'Native Supplier Nett = 16,500 JPY');
  assert(calc.nativeFinalSellingPrice === 27022.05, 'Native Price = 27,022.05 JPY');
  assert(calc.finalTotalSellingPrice === 27022.05, 'Delivered JPY Price = 27,022.05 JPY');
}

// -------------------------------------------------------------
// TEST 6 — Passenger Count Tier Resolution
// -------------------------------------------------------------
console.log('\n--- Test 6: Tier Resolution ---');
{
  const prod: any = {
    id: 'prod-multi-tier-01',
    name: 'Private Tour with Multi Tiers',
    category: 'Private Tour',
    currency: 'USD',
    pricingMethod: 'capacity_based',
    tieredPricing: [
      { id: 't1', minPax: 1, maxPax: 3, supplierNett: 1000, marginValue: 20, taxValue: 10, serviceChargeType: 'PERCENTAGE', serviceChargeValue: 5, status: 'ACTIVE' },
      { id: 't2', minPax: 4, maxPax: 6, supplierNett: 2000, marginValue: 20, taxValue: 10, serviceChargeType: 'PERCENTAGE', serviceChargeValue: 5, status: 'ACTIVE' },
      { id: 't3', minPax: 7, maxPax: 10, supplierNett: 3000, marginValue: 20, taxValue: 10, serviceChargeType: 'PERCENTAGE', serviceChargeValue: 5, status: 'ACTIVE' }
    ],
    status: 'ACTIVE'
  };

  const calc2Pax = calculateProductPrice(prod, { productId: 'prod-multi-tier-01', adults: 2, children: 0, infants: 0, travelDate: '2026-08-01', targetCurrency: 'USD', pricingTier: 'B2B' });
  const calc5Pax = calculateProductPrice(prod, { productId: 'prod-multi-tier-01', adults: 5, children: 0, infants: 0, travelDate: '2026-08-01', targetCurrency: 'USD', pricingTier: 'B2B' });
  const calc9Pax = calculateProductPrice(prod, { productId: 'prod-multi-tier-01', adults: 9, children: 0, infants: 0, travelDate: '2026-08-01', targetCurrency: 'USD', pricingTier: 'B2B' });

  assert(calc2Pax.totalNetCost === 1000, '2 Pax resolves to Tier 1 (1,000 USD)');
  assert(calc5Pax.totalNetCost === 2000, '5 Pax resolves to Tier 2 (2,000 USD)');
  assert(calc9Pax.totalNetCost === 3000, '9 Pax resolves to Tier 3 (3,000 USD)');
}

// -------------------------------------------------------------
// TEST 7 & 8 — Product & Route Isolation
// -------------------------------------------------------------
console.log('\n--- Test 7 & 8: Product & Route Isolation ---');
{
  const prodA: any = {
    id: 'prod-iso-01',
    name: 'Airport Transfer Route A',
    category: 'Transfer',
    currency: 'USD',
    pricingMethod: 'capacity_based',
    fromHubId: 'hub-1',
    toHubId: 'hub-2',
    tieredPricing: [{ id: 't1', minPax: 1, maxPax: 4, supplierNett: 500, marginValue: 20, taxValue: 10, status: 'ACTIVE' }],
    status: 'ACTIVE'
  };

  const prodB: any = {
    id: 'prod-iso-02',
    name: 'Airport Transfer Route B',
    category: 'Transfer',
    currency: 'USD',
    pricingMethod: 'capacity_based',
    fromHubId: 'hub-1',
    toHubId: 'hub-3',
    tieredPricing: [{ id: 't1', minPax: 1, maxPax: 4, supplierNett: 800, marginValue: 20, taxValue: 10, status: 'ACTIVE' }],
    status: 'ACTIVE'
  };

  const calcA = calculateProductPrice(prodA, { productId: 'prod-iso-01', adults: 2, children: 0, infants: 0, travelDate: '2026-08-01', targetCurrency: 'USD' });
  const calcB = calculateProductPrice(prodB, { productId: 'prod-iso-02', adults: 2, children: 0, infants: 0, travelDate: '2026-08-01', targetCurrency: 'USD' });

  assert(calcA.totalNetCost === 500, 'Route A evaluates to Route A tier (500 USD)');
  assert(calcB.totalNetCost === 800, 'Route B evaluates to Route B tier (800 USD)');
}

// -------------------------------------------------------------
// TEST 9 — Buyer Margin Isolation
// -------------------------------------------------------------
console.log('\n--- Test 9: Buyer Margin Isolation ---');
{
  const prod: any = {
    id: 'prod-buyer-iso',
    name: 'Private Yacht Experience',
    category: 'Private Yacht',
    currency: 'USD',
    buyerMarkupPercent: 40,
    b2bAgentMarkupPercent: 20,
    pricingMethod: 'capacity_based',
    tieredPricing: [
      { id: 't1', minPax: 1, maxPax: 10, supplierNett: 10000, b2bMargin: 20, buyerMargin: 40, taxValue: 10, serviceChargeType: 'PERCENTAGE', serviceChargeValue: 5, status: 'ACTIVE' }
    ],
    status: 'ACTIVE'
  };

  const b2bCalc = calculateProductPrice(prod, {
    productId: 'prod-buyer-iso',
    adults: 4,
    children: 0,
    infants: 0,
    travelDate: '2026-08-01',
    targetCurrency: 'USD',
    pricingTier: 'B2B'
  });

  // B2B calculation must use 20% margin, NOT 40% buyer margin!
  // Net = 10,000, Margin 20% = 2,000, Tax 10% = 200, Subtotal = 12,200, Fee 5% = 610, Total = 12,810
  assert(b2bCalc.finalTotalSellingPrice === 12810, 'B2B Agent Price = 12,810 USD (uses 20% B2B margin, buyer 40% margin ignored)');
}

console.log('\n================================================================');
console.log('  ALL PRODUCT-SPECIFIC CAPACITY PRICING AUDIT TESTS PASSED!     ');
console.log('================================================================');
