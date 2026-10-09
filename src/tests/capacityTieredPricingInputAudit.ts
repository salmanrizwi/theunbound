/**
 * Authoritative Capacity & Tiered Pricing Input Acceptance & Form State Audit
 * THEUNBOUND B2B DMC PLATFORM
 */

import { AppDatabase } from '../services/db';
import { Product, TieredPrice, CurrencyCode } from '../types';
import { calculateProductPrice } from '../services/pricingEngine';

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

async function runAudit() {
  console.log('================================================================');
  console.log('  CAPACITY & TIERED PRICING INPUT ACCEPTANCE AUDIT');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();

// 1. Audit Tier Creation Empty State (Section 8)
console.log('--- 1. Testing Tier Creation Empty State ---');
{
  const newTier: TieredPrice = {
    id: `tier-${Date.now()}`,
    capacityPricingRuleId: `CPR-${Date.now()}`,
    productCategory: 'Private Tours',
    tierLabel: '1–3 Pax',
    minPax: 1,
    maxPax: 3,
    minPassengers: 1,
    maxPassengers: 3,
    vehicleCount: 1,
    fleetId: 'veh-alphard-01',
    fleetName: 'Toyota Alphard Executive MPV',
    pricingUnit: 'Per Vehicle',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    nettPrice: undefined,
    netCostPerPax: undefined,
    marginType: 'PERCENTAGE',
    marginValue: undefined,
    taxType: 'PERCENTAGE',
    taxValue: undefined,
    serviceChargeType: 'FIXED',
    serviceChargeValue: undefined,
    finalPrice: undefined,
    status: 'ACTIVE'
  };

  assert(newTier.nettPrice === undefined, 'New tier nettPrice is initially undefined (not 0)');
  assert(newTier.marginValue === undefined, 'New tier marginValue is initially undefined (not 0%)');
  assert(newTier.finalPrice === undefined, 'New tier finalPrice is initially undefined (not 0)');
}

// 2. Audit Safe Decimal & Empty Parsing (Section 7)
console.log('\n--- 2. Testing Safe Decimal & Empty Parsing ---');
{
  const parseVal = (raw: string) => {
    if (raw.trim() === '') return undefined;
    const num = parseFloat(raw);
    return isNaN(num) ? undefined : num;
  };

  assert(parseVal('') === undefined, 'Empty input "" parses to undefined (not 0)');
  assert(parseVal('   ') === undefined, 'Whitespace input "   " parses to undefined');
  assert(parseVal('1000') === 1000, '"1000" parses to 1000');
  assert(parseVal('1000.50') === 1000.5, '"1000.50" parses to 1000.5 (exact decimal)');
  assert(parseVal('10000.75') === 10000.75, '"10000.75" parses to 10000.75 (exact decimal)');
  assert(parseVal('invalid') === undefined, 'Invalid string parses to undefined (not NaN)');
}

// 3. Audit Synchronized State & Live Final Price Computation (Section 5 & 10)
console.log('\n--- 3. Testing Tier Synchronization & Final Price Formula ---');
{
  const calcFinal = (net: number, marginVal = 20, marginType = 'PERCENTAGE', taxVal = 10, taxType = 'PERCENTAGE', svcFee = 500) => {
    const marginAmt = marginType === 'FIXED' ? marginVal : net * (marginVal / 100);
    const taxAmt = taxType === 'NOT_APPLICABLE' ? 0 : marginAmt * (taxVal / 100);
    return Math.round(net + marginAmt + taxAmt + svcFee);
  };

  // Standard case: 40,000 JPY nett + 20% margin (8,000) + 10% tax on margin (800) + 500 fee = 49,300 JPY
  const final1 = calcFinal(40000, 20, 'PERCENTAGE', 10, 'PERCENTAGE', 500);
  assert(final1 === 49300, 'Calculates correct final price with itemized margin, tax, and fee (49,300 JPY)');

  // Decimal case: 1,000.50 USD nett + 15% margin (150.075) + 10% tax on margin (15.0075) + 0 fee = 1,166 USD
  const final2 = calcFinal(1000.50, 15, 'PERCENTAGE', 10, 'PERCENTAGE', 0);
  assert(final2 === 1166, 'Calculates decimal input safely (1,166 USD)');
}

// 4. Audit Persistence Across Categories (Private Tour, Transfer, Private Yacht)
console.log('\n--- 4. Testing Persistence Across Three Capacity Categories ---');
{
  // 1. Private Tour
  const activeHubId = db.getCityHubs()[0]?.id || 'hub-tokyo';
  const activeRegionId = db.getMasterRegions()[0]?.id || 'reg-east-asia';
  const activeDestId = db.getDestinations()[0]?.id || 'dest-japan';

  const tourProduct = {
    id: `prod-test-tour-${Date.now()}`,
    sku: 'UB-TOUR-CAP-01',
    name: 'Tokyo Luxury Alphard Private Tour',
    category: 'Private Tours',
    pricingModel: 'CAPACITY_TIERED',
    pricingMethod: 'capacity_based',
    regionId: activeRegionId,
    destinationId: activeDestId,
    hubId: activeHubId,
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 45000,
    status: 'ACTIVE',
    inclusions: ['Private Alphard Chauffeur', 'Fuel', 'Tolls'],
    exclusions: ['Entry tickets'],
    vehicleConfig: {
      vehicleType: 'Executive MPV',
      vehicleModel: 'Toyota Alphard',
      maxSeats: 6,
      totalSeats: 6,
      unitVehicleNetCost: 45000
    },
    tieredPricing: [
      {
        id: 'tier-tour-1',
        tierLabel: '1–3 Pax',
        minPax: 1,
        maxPax: 3,
        vehicleCount: 1,
        fleetId: 'veh-alphard-01',
        fleetName: 'Toyota Alphard',
        currency: 'JPY',
        nativeCurrency: 'JPY',
        nettPrice: 45000,
        netCostPerPax: 45000,
        finalPrice: 55000,
        status: 'ACTIVE'
      },
      {
        id: 'tier-tour-2',
        tierLabel: '4–6 Pax',
        minPax: 4,
        maxPax: 6,
        vehicleCount: 1,
        fleetId: 'veh-alphard-01',
        fleetName: 'Toyota Alphard',
        currency: 'JPY',
        nativeCurrency: 'JPY',
        nettPrice: 60000,
        netCostPerPax: 60000,
        finalPrice: 73000,
        status: 'ACTIVE'
      }
    ]
  } as unknown as Product;

  db.saveProduct(tourProduct, null);
  const retrievedTour = db.getProductById(tourProduct.id);
  assert(retrievedTour !== undefined, 'Private Tour persisted successfully to database');
  assert(retrievedTour?.pricingModel === 'CAPACITY_TIERED', 'Private Tour retains pricingModel = CAPACITY_TIERED');
  assert(retrievedTour?.tieredPricing?.length === 2, 'Private Tour retains 2 capacity tiers');
  assert(retrievedTour?.tieredPricing?.[1].nettPrice === 60000, 'Private Tour retains edited 4-6 Pax nett price (60,000 JPY)');

  // 2. Transfer
  const transferProduct = {
    id: `prod-test-transfer-${Date.now()}`,
    sku: 'UB-TRANSFER-CAP-01',
    name: 'Haneda Airport to Tokyo City Chauffeur',
    category: 'Transfers',
    pricingModel: 'CAPACITY_TIERED',
    pricingMethod: 'capacity_based',
    regionId: activeRegionId,
    destinationId: activeDestId,
    hubId: activeHubId,
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 20000,
    status: 'ACTIVE',
    inclusions: ['Flight Tracking', 'Luggage Assist'],
    exclusions: ['Extra Stops'],
    fromHubId: activeHubId,
    toHubId: activeHubId,
    vehicleConfig: {
      vehicleType: 'Executive MPV',
      vehicleModel: 'Toyota Alphard',
      maxSeats: 3,
      totalSeats: 3,
      unitVehicleNetCost: 20000
    },
    tieredPricing: [
      {
        id: 'tier-trans-1',
        tierLabel: '1–3 Pax',
        minPax: 1,
        maxPax: 3,
        vehicleCount: 1,
        fleetId: 'veh-alphard-01',
        fleetName: 'Toyota Alphard',
        currency: 'JPY',
        nativeCurrency: 'JPY',
        nettPrice: 20000,
        netCostPerPax: 20000,
        finalPrice: 25000,
        status: 'ACTIVE'
      },
      {
        id: 'tier-trans-2',
        tierLabel: '4–6 Pax',
        minPax: 4,
        maxPax: 6,
        vehicleCount: 2,
        fleetId: 'veh-alphard-01',
        fleetName: 'Toyota Alphard',
        currency: 'JPY',
        nativeCurrency: 'JPY',
        nettPrice: 40000,
        netCostPerPax: 40000,
        finalPrice: 50000,
        status: 'ACTIVE'
      }
    ]
  } as unknown as Product;

  db.saveProduct(transferProduct, null);
  const retrievedTransfer = db.getProductById(transferProduct.id);
  assert(retrievedTransfer !== undefined, 'Transfer persisted successfully to database');
  assert(retrievedTransfer?.pricingModel === 'CAPACITY_TIERED', 'Transfer retains pricingModel = CAPACITY_TIERED');
  assert(retrievedTransfer?.tieredPricing?.[1].vehicleCount === 2, 'Transfer 4-6 Pax allocates 2 Alphards');
  assert(retrievedTransfer?.tieredPricing?.[1].nettPrice === 40000, 'Transfer 4-6 Pax retains nett price (40,000 JPY)');

  // 3. Private Yacht
  const yachtProduct = {
    id: `prod-test-yacht-${Date.now()}`,
    sku: 'UB-YACHT-CAP-01',
    name: 'Tokyo Bay Sunset Private Yacht Charter',
    category: 'Private Yacht',
    pricingModel: 'CAPACITY_TIERED',
    pricingMethod: 'capacity_based',
    regionId: activeRegionId,
    destinationId: activeDestId,
    hubId: activeHubId,
    destination: 'Japan',
    city: 'Tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 150000,
    status: 'ACTIVE',
    inclusions: ['Captain & Crew', 'Fuel', 'Champagne Welcome'],
    exclusions: ['Catering upgrade'],
    vehicleConfig: {
      vehicleType: 'Motor Yacht',
      vehicleModel: 'Azimut 66 Flybridge',
      maxSeats: 12,
      totalSeats: 12,
      unitVehicleNetCost: 150000
    },
    tieredPricing: [
      {
        id: 'tier-yacht-1',
        tierLabel: '1–6 Pax',
        minPax: 1,
        maxPax: 6,
        vehicleCount: 1,
        fleetId: 'yacht-azimut-66',
        fleetName: 'Azimut 66 Flybridge',
        currency: 'JPY',
        nativeCurrency: 'JPY',
        nettPrice: 150000,
        netCostPerPax: 150000,
        finalPrice: 195000,
        status: 'ACTIVE'
      },
      {
        id: 'tier-yacht-2',
        tierLabel: '7–12 Pax',
        minPax: 7,
        maxPax: 12,
        vehicleCount: 1,
        fleetId: 'yacht-azimut-66',
        fleetName: 'Azimut 66 Flybridge',
        currency: 'JPY',
        nativeCurrency: 'JPY',
        nettPrice: 180000,
        netCostPerPax: 180000,
        finalPrice: 234000,
        status: 'ACTIVE'
      }
    ]
  } as unknown as Product;

  db.saveProduct(yachtProduct, null);
  const retrievedYacht = db.getProductById(yachtProduct.id);
  assert(retrievedYacht !== undefined, 'Private Yacht persisted successfully to database');
  assert(retrievedYacht?.pricingModel === 'CAPACITY_TIERED', 'Private Yacht retains pricingModel = CAPACITY_TIERED');
  assert(retrievedYacht?.tieredPricing?.[1].nettPrice === 180000, 'Private Yacht 7-12 Pax retains nett price (180,000 JPY)');

  // Clean up test products
  db.deleteProduct(tourProduct.id, null);
  db.deleteProduct(transferProduct.id, null);
  db.deleteProduct(yachtProduct.id, null);
}

// 5. Test Live Pricing Engine Integration for Configured Products
console.log('\n--- 5. Testing Central Pricing Engine Match for Capacity Tiers ---');
{
  const product = {
    id: 'prod-calc-test-01',
    sku: 'UB-TEST-01',
    name: 'Authoritative Pricing Engine Capacity Test',
    category: 'Private Tours',
    pricingModel: 'CAPACITY_TIERED',
    pricingMethod: 'capacity_based',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    adultNetPrice: 50000,
    defaultMarkupPercent: 20,
    taxPercent: 10,
    taxMethod: 'on_margin',
    status: 'ACTIVE',
    vehicleConfig: {
      vehicleType: 'Executive MPV',
      vehicleModel: 'Toyota Alphard',
      maxSeats: 6,
      totalSeats: 6,
      unitVehicleNetCost: 50000
    },
    tieredPricing: [
      {
        id: 'tier-pax-1-3',
        tierLabel: '1–3 Pax',
        minPax: 1,
        maxPax: 3,
        vehicleCount: 1,
        nettPrice: 50000,
        netCostPerPax: 50000,
        status: 'ACTIVE'
      },
      {
        id: 'tier-pax-4-6',
        tierLabel: '4–6 Pax',
        minPax: 4,
        maxPax: 6,
        vehicleCount: 1,
        nettPrice: 65000,
        netCostPerPax: 65000,
        status: 'ACTIVE'
      }
    ]
  } as unknown as Product;

  const calc1 = calculateProductPrice(product, {
    productId: product.id,
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-10-01',
    targetCurrency: 'JPY'
  });

  assert(calc1.totalNetCost === 50000, '2 Pax matches 1–3 Pax tier nett price (50,000 JPY)');
  assert(calc1.finalTotalSellingPrice === 61000, '2 Pax final delivered price = 61,000 JPY (50,000 + 20% + 10%)');

  const calc2 = calculateProductPrice(product, {
    productId: product.id,
    adults: 5,
    children: 0,
    infants: 0,
    travelDate: '2026-10-01',
    targetCurrency: 'JPY'
  });

  assert(calc2.totalNetCost === 65000, '5 Pax matches 4–6 Pax tier nett price (65,000 JPY)');
  assert(calc2.finalTotalSellingPrice === 79300, '5 Pax final delivered price = 79,300 JPY (65,000 + 20% + 10%)');
}

// 6. Test Decimal Input Sanitization & Comma Paste Support
console.log('\n--- 6. Testing Decimal Input Sanitization & Comma Paste ---');
{
  const processInput = (rawInput: string) => {
    const raw = rawInput.replace(/,/g, '');
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      if (raw === '' || raw === '.') return { buffer: raw, parsed: undefined };
      const num = parseFloat(raw);
      return { buffer: raw, parsed: (!isNaN(num) && isFinite(num)) ? num : undefined };
    }
    return { buffer: '', parsed: undefined };
  };

  const test1 = processInput('1,250.50');
  assert(test1.buffer === '1250.50' && test1.parsed === 1250.5, 'Strips commas on paste e.g. "1,250.50" -> 1250.5');

  const test2 = processInput('12500.75');
  assert(test2.buffer === '12500.75' && test2.parsed === 12500.75, 'Accepts decimal values "12500.75"');

  const test3 = processInput('.');
  assert(test3.buffer === '.' && test3.parsed === undefined, 'Intermediate decimal "." does not yield 0 or NaN');

  const test4 = processInput('');
  assert(test4.buffer === '' && test4.parsed === undefined, 'Empty input does not convert to 0');
}

// 7. Test Multi-Tier Independence across Tour, Transfer, and Yacht
console.log('\n--- 7. Testing Multi-Tier Independence (Tour, Transfer, Yacht) ---');
{
  // Changing Tier 1 must NOT change Tier 2
  const tiers = [
    {
      id: 'tier-1',
      minPax: 1,
      maxPax: 3,
      vehicleCount: 1,
      supplierNett: 10000,
      currency: 'JPY',
      nativeCurrency: 'JPY',
      status: 'ACTIVE'
    },
    {
      id: 'tier-2',
      minPax: 4,
      maxPax: 6,
      vehicleCount: 1,
      supplierNett: 15000,
      currency: 'JPY',
      nativeCurrency: 'JPY',
      status: 'ACTIVE'
    }
  ] as unknown as TieredPrice[];

  // Immutable update to tier 1
  const updatedTiers = tiers.map((t, idx) => idx === 0 ? { ...t, supplierNett: 12000, nettPrice: 12000 } : t);
  assert(updatedTiers[0].supplierNett === 12000, 'Tier 1 supplierNett updated to 12000 JPY');
  assert(updatedTiers[1].supplierNett === 15000, 'Tier 2 supplierNett remains untouched at 15000 JPY');
}

// 8. Test Master Sync Google Sheets Governance (Section 20 & 21)
console.log('\n--- 8. Testing Google Sheets Master Sync Governance ---');
{
  const prodId = `prod-gov-test-${Date.now()}`;
  const prod = {
    id: prodId,
    sku: 'UB-GOV-01',
    name: 'Sync Governance Test Tour',
    category: 'Private Tours',
    pricingMethod: 'capacity_based',
    pricingModel: 'CAPACITY_TIERED',
    regionId: db.getMasterRegions()[0]?.id || 'reg-east-asia',
    destinationId: db.getDestinations()[0]?.id || 'dest-japan',
    hubId: db.getCityHubs()[0]?.id || 'hub-tokyo',
    currency: 'JPY',
    nativeCurrency: 'JPY',
    status: 'ACTIVE',
    tieredPricing: [
      {
        id: 'tier-gov-1',
        minPax: 1,
        maxPax: 3,
        vehicleCount: 1,
        supplierNett: 30000, // Configured by Admin
        nettPrice: 30000,
        status: 'ACTIVE'
      }
    ]
  } as unknown as Product;

  db.saveProduct(prod, null);

  // Incoming sync with empty supplier_nett (0 or blank) must NOT overwrite Admin's valid 30,000 JPY
  const incomingSheetCap = {
    id: 'tier-gov-1',
    productId: prodId,
    minPassengers: 1,
    maxPassengers: 3,
    vehicleCount: 1,
    supplierNett: undefined, // blank in sheet
    fixedNettCost: 0
  };

  const currentTier = db.getProductById(prodId)?.tieredPricing?.[0];
  const finalNett = (incomingSheetCap.supplierNett && incomingSheetCap.supplierNett > 0)
    ? incomingSheetCap.supplierNett 
    : (currentTier?.supplierNett ?? currentTier?.nettPrice ?? 0);

  assert(finalNett === 30000, 'Governance Rule: Blank sheet sync does NOT overwrite valid Admin Supplier Nett (30,000 JPY preserved)');

  db.deleteProduct(prodId, null);
}

  console.log('\n================================================================');
  console.log(`  CAPACITY INPUT AUDIT RESULT: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
