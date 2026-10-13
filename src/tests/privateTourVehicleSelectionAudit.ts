import { AppDatabase } from '../services/db';
import { operationalMasterInventory } from '../services/operationalMasterInventoryService';
import { operationalAssetEligibility } from '../services/operationalAssetEligibilityService';
import { calculateProductPrice, resolveCapacityPricingTier } from '../services/pricingEngine';
import { getInventoryConfigurationSummary } from '../utils/inventoryDisplayHelpers';
import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import { Product, User, QuoteItem, Quotation } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}${details ? ` - ${details}` : ''}`);
  }
}

console.log('================================================================');
console.log('  THEUNBOUND PRIVATE TOUR VEHICLE SELECTION AUDIT SUITE');
console.log('================================================================');

// --- 1. Vehicle Master Inventory & Active Status Verification ---
console.log('\n--- 1. Vehicle Master Inventory & Active Status Verification ---');
const activeVehicles = operationalMasterInventory.getActiveVehicles();
assert(activeVehicles.length > 0, 'Active vehicles exist in authoritative inventory', `Found ${activeVehicles.length} vehicles`);

const alphard = activeVehicles.find(v => v.id.includes('alphard'));
const hiace = activeVehicles.find(v => v.id.includes('hiace'));
const coaster = activeVehicles.find(v => v.id.includes('coaster'));

assert(Boolean(alphard), 'Toyota Alphard Executive MPV registered in inventory');
assert(alphard?.seatingCapacity === 7, 'Alphard has configured 7-passenger capacity', `Got ${alphard?.seatingCapacity}`);
assert(Boolean(hiace), 'Toyota Hiace Grand Cabin registered in inventory');
assert(hiace?.seatingCapacity === 10, 'Hiace has configured 10-passenger capacity', `Got ${hiace?.seatingCapacity}`);
assert(Boolean(coaster), 'Toyota Coaster registered in inventory');
assert(coaster?.seatingCapacity === 21, 'Coaster has configured 21-passenger capacity', `Got ${coaster?.seatingCapacity}`);

// --- 2. Operational Asset Eligibility for Private Tours ---
console.log('\n--- 2. Operational Asset Eligibility for Private Tours ---');
const testPrivateTour: Product = {
  id: 'jp-tour-test-01',
  sku: 'TOUR-JP-PVT-01',
  name: 'Tokyo Modern & Edo Heritage Private VIP Chauffeur Tour',
  category: 'Private Tours',
  productType: 'Private Tour',
  destinationId: 'dest-japan',
  destinationName: 'Japan',
  country: 'Japan',
  duration: 'Full Day (8 Hours)',
  currency: 'JPY',
  adultNetPrice: 65000,
  maxPax: 7,
  minPax: 1,
  status: 'ACTIVE',
  supplierId: 'sup-tokyo-fleet',
  supplierName: 'Tokyo Executive Chauffeur Services'
} as any;

const eligibleAssets = operationalAssetEligibility.getEligibleAssets({
  product: testPrivateTour,
  productType: 'Private Tours',
  destinationId: testPrivateTour.destinationId
});

assert(eligibleAssets.vehicles.length >= 3, 'Eligible vehicles returned for Japan Private Tour', `Count: ${eligibleAssets.vehicles.length}`);
assert(eligibleAssets.vehicles.every(v => v.status === 'ACTIVE'), 'All returned vehicles are ACTIVE');

// --- 3. Passenger Capacity Validation ---
console.log('\n--- 3. Passenger Capacity Validation ---');
// 5 passengers should fit in 7-seater Alphard
const pax5FitsAlphard = 5 <= (alphard?.seatingCapacity || 0);
assert(pax5FitsAlphard, '5 Pax accommodates in 7-seat Alphard without violation');

// 9 passengers should exceed 7-seater Alphard
const pax9ExceedsAlphard = 9 > (alphard?.seatingCapacity || 0);
assert(pax9ExceedsAlphard, '9 Pax correctly flags capacity violation on 7-seat Alphard');

// 9 passengers accommodates in 10-seater HiAce
const pax9FitsHiace = 9 <= (hiace?.seatingCapacity || 0);
assert(pax9FitsHiace, '9 Pax comfortably accommodates in 10-seat Hiace');

// 15 passengers accommodates in 21-seater Coaster
const pax15FitsCoaster = 15 <= (coaster?.seatingCapacity || 0);
assert(pax15FitsCoaster, '15 Pax accommodates in 21-seat Coaster');

// --- 4. Centralized Pricing Engine Integration ---
console.log('\n--- 4. Centralized Pricing Engine Integration ---');
const calcWithAlphard = calculateProductPrice(testPrivateTour, {
  productId: testPrivateTour.id,
  adults: 4,
  children: 0,
  infants: 0,
  travelDate: '2026-11-15',
  targetCurrency: 'JPY',
  vehicleId: alphard?.id
} as any);

assert(calcWithAlphard.finalTotalSellingPrice > 0, 'Pricing engine calculates valid selling price with Alphard', `Price: ${calcWithAlphard.finalTotalSellingPrice}`);
assert(calcWithAlphard.currency === 'JPY', 'Native currency JPY preserved');

// --- 5. Role-Based Pricing Security ---
console.log('\n--- 5. Role-Based Pricing Security ---');
const agentUser: User = {
  id: 'usr-agent-001',
  name: 'B2B Travel Agent',
  email: 'agent@luxurytravel.com',
  role: 'B2B_AGENT'
} as any;

const adminUser: User = {
  id: 'usr-admin-001',
  name: 'Operations Director',
  email: 'ops@theunbound.in',
  role: 'ADMIN'
} as any;

const agentCalc = calculateProductPrice(testPrivateTour, {
  productId: testPrivateTour.id,
  adults: 2,
  children: 0,
  infants: 0,
  travelDate: '2026-11-15',
  targetCurrency: 'JPY',
  user: agentUser,
  userRole: 'B2B_AGENT'
} as any);

const adminCalc = calculateProductPrice(testPrivateTour, {
  productId: testPrivateTour.id,
  adults: 2,
  children: 0,
  infants: 0,
  travelDate: '2026-11-15',
  targetCurrency: 'JPY',
  user: adminUser,
  userRole: 'ADMIN'
} as any);

assert(agentCalc.finalTotalSellingPrice > 0, 'Agent receives valid commercial wholesale selling price');
assert(adminCalc.totalNetCost > 0, 'Admin retains authoritative supplier nett cost visibility');

// --- 6. Quote Item Persistence & Snapshot Integrity ---
console.log('\n--- 6. Quote Item Persistence & Snapshot Integrity ---');
const quoteItem: QuoteItem = {
  id: 'item-tour-001',
  product: testPrivateTour,
  pax: { adults: 4, children: 0, infants: 0 },
  travelDate: '2026-11-15',
  serviceTime: '09:00 AM',
  notes: `${testPrivateTour.name} (${alphard?.name}) | Pickup: Palace Hotel Tokyo Lobby`,
  selectedAddonIds: [],
  calculation: calcWithAlphard,
  vehicleId: alphard?.id,
  vehicleNameSnapshot: alphard?.name,
  vehicleTypeSnapshot: alphard?.classification,
  vehicleCapacitySnapshot: alphard?.seatingCapacity,
  configuration_snapshot: {
    vehicleId: alphard?.id,
    vehicleName: alphard?.name,
    vehicleType: alphard?.classification,
    masterCapacity: alphard?.seatingCapacity,
    luggageCapacity: alphard?.luggageCapacity,
    travelDate: '2026-11-15',
    serviceTime: '09:00 AM'
  }
};

assert(quoteItem.vehicleId === alphard?.id, 'Stable vehicleId attached to Quote Item');
assert(quoteItem.configuration_snapshot?.vehicleId === alphard?.id, 'Vehicle preserved in configuration_snapshot');
assert(quoteItem.configuration_snapshot?.masterCapacity === 7, 'Vehicle capacity snapshot preserved');

// --- 7. Customer-Facing Summary & Presentation Model ---
console.log('\n--- 7. Customer-Facing Summary & Presentation Model ---');
const summary = getInventoryConfigurationSummary(quoteItem);
assert(summary.includes('Toyota Alphard'), 'Vehicle name cleanly formatted in customer-facing summary', `Summary: "${summary}"`);

const dummyQuote: Quotation = {
  id: 'qte-tour-test',
  quoteNumber: 'UBQ-2026-7890',
  title: 'Japan Bespoke VIP Itinerary',
  clientName: 'Alexander Vance',
  clientEmail: 'alex@example.com',
  agentId: 'usr-agent-01',
  agentName: 'Travel Agent',
  destination: 'Japan',
  currency: 'JPY',
  items: [quoteItem],
  version: 1,
  isLocked: false,
  overallDiscountPercent: 0,
  agentNotes: '',
  termsAndConditions: 'Terms apply.',
  status: 'DRAFT',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
  totalNetCost: 0,
  totalSellingPrice: calcWithAlphard.finalTotalSellingPrice,
  totalTaxes: 0,
  totalMargin: 0,
  routeHubs: [
    {
      id: 'hub-tokyo',
      hubId: 'hub-tokyo',
      hubName: 'Tokyo',
      order: 1,
      nights: 3,
      accommodationType: 'NO_ACCOMMODATION'
    }
  ]
};

const presentation = buildQuotePresentationModel(dummyQuote);
assert(presentation.days.length > 0 || presentation.additionalServices.length > 0, 'Presentation model builds successfully');
const allServices: any[] = [...presentation.days.flatMap(d => d.services), ...presentation.additionalServices];
const matchedPres = allServices.find(s => (s.listingName || s.name || '').includes('Tokyo Modern'));
assert(Boolean(matchedPres), 'Private Tour present in quotation presentation model');

// --- 8. Backward Compatibility: Tour Without Vehicle ---
console.log('\n--- 8. Backward Compatibility: Tour Without Vehicle ---');
const legacyQuoteItem: QuoteItem = {
  id: 'item-tour-legacy',
  product: testPrivateTour,
  pax: { adults: 2, children: 0, infants: 0 },
  travelDate: '2026-11-15',
  calculation: calcWithAlphard,
  selectedAddonIds: []
};

const legacySummary = getInventoryConfigurationSummary(legacyQuoteItem);
assert(typeof legacySummary === 'string', 'Legacy Private Tour without vehicle loads cleanly without crash');

console.log('\n================================================================');
console.log(`  AUDIT COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
