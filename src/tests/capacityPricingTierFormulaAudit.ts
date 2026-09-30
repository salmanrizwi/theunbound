import { calculateUnifiedPrice, calculateProductPrice, calculateDeliveredPriceForUser } from '../services/pricingEngine';
import { sanitizePricingResultForAgent } from '../utils/customerQuoteSanitizer';
import { Product, TieredPrice } from '../types';

function runCapacityPricingTierFormulaAudit() {
  console.log('================================================================');
  console.log(' PRODUCT-SPECIFIC CAPACITY PRICING TIER FORMULA AUDIT');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // TEST 1: Authoritative Example Test Case
  // Nett = 16,500 | B2B Margin = 50% | Tax = 18% of Margin | Service Fee = 3% of Subtotal
  const test1Input = {
    nettPrice: 16500,
    quantity: 1,
    marginType: 'PERCENTAGE' as const,
    marginValue: 50,
    taxPercent: 18,
    serviceChargeType: 'PERCENTAGE' as const,
    serviceChargeValue: 3,
    currency: 'JPY' as const
  };

  const res1 = calculateUnifiedPrice(test1Input);

  assert(res1.marginAmount === 8250, `Margin Amount = 8,250 (Got: ${res1.marginAmount})`);
  assert(res1.taxAmount === 1485, `Tax Amount = 1,485 (Got: ${res1.taxAmount})`);
  assert(res1.subtotal === 26235, `Subtotal = 26,235 (Got: ${res1.subtotal})`);
  assert(res1.serviceFeeAmount === 787.05, `Service Fee Amount = 787.05 (Got: ${res1.serviceFeeAmount})`);
  assert(res1.finalPrice === 27022.05, `Final Price = 27,022.05 (Got: ${res1.finalPrice})`);
  assert(Math.round(res1.finalPrice) === 27022, `Rounded Whole Unit Display = 27,022 (Got: ${Math.round(res1.finalPrice)})`);

  // TEST 2: Product-Specific Capacity Tier in calculateProductPrice (Private Yacht / Transfer / Private Tour)
  const capacityProduct: any = {
    id: 'prod-yacht-001',
    title: 'Luxury Yacht Charter',
    productCategory: 'YACHT',
    category: 'Private Yacht',
    pricingType: 'CAPACITY',
    pricingModel: 'CAPACITY',
    currency: 'USD',
    tieredPricing: [
      {
        id: 'cpr-10',
        tierLabel: '1-10 Pax',
        netCostPerPax: 16500,
        capacityPricingRuleId: 'CPR-10',
        minPax: 1,
        maxPax: 10,
        minPassengers: 1,
        maxPassengers: 10,
        supplierNett: 16500,
        nettPrice: 16500,
        marginValue: 50,
        marginType: 'PERCENTAGE',
        taxValue: 18,
        taxType: 'PERCENTAGE',
        serviceChargeValue: 3,
        serviceChargeType: 'PERCENTAGE',
        currency: 'USD',
        effectiveDate: '2026-01-01',
        status: 'ACTIVE'
      }
    ]
  };

  const prodPriceRes = calculateProductPrice(capacityProduct as Product, {
    adults: 6,
    userRole: 'AGENT',
    customMarkupPercent: undefined,
    buyerMarginPercent: 25 // Buyer margin should be IGNORED for B2B price
  } as any);

  assert(prodPriceRes.totalSellingPrice === 27022.05, `calculateProductPrice B2B totalSellingPrice = 27,022.05 (Got: ${prodPriceRes.totalSellingPrice})`);
  assert(prodPriceRes.marginAmount === 8250, `calculateProductPrice marginAmount = 8,250 (Got: ${prodPriceRes.marginAmount})`);
  assert(prodPriceRes.taxAmount === 1485, `calculateProductPrice taxAmount = 1,485 (Got: ${prodPriceRes.taxAmount})`);
  assert(prodPriceRes.serviceFeeAmount === 787.05, `calculateProductPrice serviceFeeAmount = 787.05 (Got: ${prodPriceRes.serviceFeeAmount})`);

  // TEST 3: Buyer Margin Ignored for B2B
  const deliveredRes = calculateDeliveredPriceForUser(
    capacityProduct as Product,
    { role: 'AGENT', id: 'agent-1' } as any,
    'USD'
  );

  assert(deliveredRes.totalSellingPrice === 27022.05, `calculateDeliveredPriceForUser for AGENT = 27,022.05 (Buyer margin ignored)`);

  // TEST 4: Agent DTO Redaction Verification
  const sanitizedForAgent = sanitizePricingResultForAgent(deliveredRes as any);
  assert(sanitizedForAgent.totalSellingPrice === 27022.05, `Sanitized Agent DTO retains totalSellingPrice = 27,022.05`);
  assert((sanitizedForAgent as any).totalNetCost === undefined, `Sanitized Agent DTO redacts totalNetCost`);
  assert((sanitizedForAgent as any).dmcMarginAmount === undefined, `Sanitized Agent DTO redacts dmcMarginAmount`);

  console.log('================================================================');
  console.log(` AUDIT SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCapacityPricingTierFormulaAudit();
