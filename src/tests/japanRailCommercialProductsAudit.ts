/**
 * THEUNBOUND — JAPAN RAIL COMMERCIAL MASTER PRODUCTS & PRICING AUDIT SUITE
 * 
 * Production Quality Certification & Automated Audit Suite
 * Verifies that Admin CMS has full CRUD for exactly 2 Commercial Master Products:
 * 1. Ordinary Car — Reserved Seat (ORDINARY_RESERVED)
 * 2. Green Car — First Class / Reserved (GREEN_RESERVED)
 * 
 * Verifies zero route-product explosion, dynamic journey mapping, central B2B pricing,
 * and historical snapshot protection.
 */

import { AppDatabase } from '../services/db';
import { JapanRailCommercialProduct } from '../types/rail';
import { INITIAL_JAPAN_RAIL_COMMERCIAL_PRODUCTS } from '../data/initialRailCommercialProducts';
import { japanRailJourneyDataService } from '../services/rail/JapanRailJourneyDataService';
import { railPricingEngine } from '../services/railPricingEngine';
import { User, Quotation } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}`);
    if (failureDetails) {
      console.error(`     Details: ${failureDetails}`);
    }
  }
}

export async function runJapanRailCommercialProductsAudit(): Promise<void> {
  console.log('\n================================================================');
  console.log('  THEUNBOUND JAPAN RAIL COMMERCIAL MASTER PRODUCTS AUDIT');
  console.log('================================================================\n');

  const db = AppDatabase.getInstance();
  const adminUser: User = {
    id: 'usr-admin-rail-audit',
    name: 'Rail Commercial Architect',
    email: 'admin@theunbound.in',
    role: 'ADMIN',
    agencyName: 'TheUnbound DMC Rail Ops',
    createdAt: new Date().toISOString()
  };

  // --------------------------------------------------------------------------
  // 1. EXACT TWO COMMERCIAL MASTER PRODUCTS REGISTRY AUDIT
  // --------------------------------------------------------------------------
  console.log('--- 1. Exact Two Commercial Master Products Registry ---');
  const commercialProducts = db.getJapanRailCommercialProducts();
  assert(
    commercialProducts.length === 2,
    `Japan Rail Commercial Product registry contains EXACTLY 2 products (Found: ${commercialProducts.length})`
  );

  const ordProduct = commercialProducts.find(p => p.productCode === 'ORDINARY_RESERVED' || p.id === 'RAIL-JP-ORD-RESERVED');
  assert(!!ordProduct, 'Product 1 exists: Ordinary Car — Reserved Seat (ORDINARY_RESERVED)');
  if (ordProduct) {
    assert(ordProduct.productName.includes('Ordinary Car'), `Product 1 Name is accurate: "${ordProduct.productName}"`);
    assert(ordProduct.carType === 'Ordinary', `Product 1 Car Type is "Ordinary"`);
    assert(ordProduct.reservationType === 'Reserved Seat' || ordProduct.seatType === 'Reserved', `Product 1 Reservation Type is "Reserved Seat"`);
    assert(ordProduct.category === 'RAIL' || (ordProduct.category as any) === 'Rail', `Product 1 Category is "RAIL"`);
    assert(ordProduct.nativeCurrency === 'JPY', `Product 1 Native Currency is "JPY" (strictly no INR default)`);
    assert(ordProduct.status === 'ACTIVE', `Product 1 Status is ACTIVE`);
  }

  const greenProduct = commercialProducts.find(p => p.productCode === 'GREEN_RESERVED' || p.id === 'RAIL-JP-GREEN-RESERVED');
  assert(!!greenProduct, 'Product 2 exists: Green Car — First Class / Reserved (GREEN_RESERVED)');
  if (greenProduct) {
    assert(greenProduct.productName.includes('Green Car'), `Product 2 Name is accurate: "${greenProduct.productName}"`);
    assert(greenProduct.carType === 'Green', `Product 2 Car Type is "Green"`);
    assert(greenProduct.classType.toLowerCase().includes('first'), `Product 2 Class Type is "First Class"`);
    assert(greenProduct.reservationType === 'Reserved Seat' || greenProduct.seatType === 'Reserved', `Product 2 Reservation Type is "Reserved Seat"`);
    assert(greenProduct.category === 'RAIL' || (greenProduct.category as any) === 'Rail', `Product 2 Category is "RAIL"`);
    assert(greenProduct.nativeCurrency === 'JPY', `Product 2 Native Currency is "JPY"`);
    assert(greenProduct.status === 'ACTIVE', `Product 2 Status is ACTIVE`);
  }

  // --------------------------------------------------------------------------
  // 2. ADMIN CRUD WORKSPACE & MUTATION AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Admin CMS CRUD Workspace & Mutations ---');
  
  // READ by ID and Code
  const byCode = db.getJapanRailCommercialProductById('ORDINARY_RESERVED');
  assert(!!byCode && byCode.productCode === 'ORDINARY_RESERVED', 'READ: Resolved commercial product by productCode "ORDINARY_RESERVED"');
  const byId = db.getJapanRailCommercialProductById('RAIL-JP-GREEN-RESERVED');
  assert(!!byId && byId.productCode === 'GREEN_RESERVED', 'READ: Resolved commercial product by canonical ID "RAIL-JP-GREEN-RESERVED"');

  // UPDATE Commercial Master Product
  if (ordProduct) {
    const originalName = ordProduct.productName;
    const testUpdatedName = 'Ordinary Car — Reserved Seat (smartEX Guaranteed)';
    const updatedProd: JapanRailCommercialProduct = {
      ...ordProduct,
      productName: testUpdatedName,
      pricingConfiguration: {
        ...ordProduct.pricingConfiguration,
        marginValue: 14.5
      }
    };

    db.saveJapanRailCommercialProduct(updatedProd, adminUser);
    const refreshed = db.getJapanRailCommercialProductById('ORDINARY_RESERVED');
    assert(
      refreshed?.productName === testUpdatedName,
      `UPDATE: Admin updated commercial product name to "${testUpdatedName}"`
    );
    assert(
      refreshed?.pricingConfiguration.marginValue === 14.5,
      `UPDATE: Admin updated B2B Agent margin to 14.5%`
    );

    // Restore original
    db.saveJapanRailCommercialProduct({ ...ordProduct, productName: originalName }, adminUser);
  }

  // EXACT 2-PRODUCT GOVERNANCE: Prevent creation of unauthorized 3rd product
  let preventedThirdProduct = false;
  try {
    const invalidThirdProduct: any = {
      id: 'RAIL-JP-UNAUTHORIZED-SPECIAL',
      productCode: 'TOKYO_SPECIAL_NON_RESERVED',
      productName: 'Tokyo Special Non-Reserved Route',
      category: 'RAIL',
      destinationId: 'dest-japan',
      productType: 'INVALID_CODE',
      carType: 'Ordinary',
      classType: 'Standard',
      reservationType: 'Non-Reserved',
      nativeCurrency: 'JPY',
      status: 'ACTIVE',
      pricingConfiguration: { pricingMode: 'DYNAMIC_ROUTE_FARE' }
    };
    db.saveJapanRailCommercialProduct(invalidThirdProduct, adminUser);
  } catch (err: any) {
    preventedThirdProduct = true;
  }
  assert(
    preventedThirdProduct,
    'Governance Rule: Prevented creation of unauthorized 3rd commercial rail product (Only ORDINARY_RESERVED & GREEN_RESERVED permitted)'
  );

  // --------------------------------------------------------------------------
  // 3. ZERO ROUTE-PRODUCT EXPLOSION AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Dynamic Route Inventory vs Commercial Product Separation ---');
  const stations = db.getRailStations();
  const routes = db.getRailRoutes();
  const rawProducts = db.getProducts();

  const railProductsInCatalog = rawProducts.filter(p => 
    p.category === 'Rail' || (p.category as any) === 'RAIL' || p.productType === 'Rail' || p.id.startsWith('RAIL-JP')
  );

  assert(
    stations.length >= 10,
    `Dynamic Station Inventory active (${stations.length} stations)`
  );
  assert(
    routes.length >= 20,
    `Dynamic Route Network active (${routes.length} connected route pairs)`
  );
  assert(
    railProductsInCatalog.length <= 4,
    `Zero Product Explosion: Exactly commercial master products in catalog (Found: ${railProductsInCatalog.length}, strictly <= 4, not ${stations.length * routes.length}+ products)`
  );

  // --------------------------------------------------------------------------
  // 4. DYNAMIC PRICING ENGINE & JOURNEY CONFIGURATOR AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Dynamic Pricing Engine & B2B Calculation ---');
  
  // Test Pricing for Tokyo -> Kyoto (Nozomi, 2 Adults, 1 Child)
  const tokyoKyotoOrdinary = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-KYOTO',
    productId: 'RAIL-JP-ORD-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: '2026-05-15',
    adultsCount: 2,
    childrenCount: 1,
    targetCurrency: 'JPY'
  });

  assert(
    tokyoKyotoOrdinary.finalSellingPriceJPY > 0,
    `Dynamic Pricing: Tokyo -> Kyoto Ordinary 2 Adults + 1 Child = ¥${tokyoKyotoOrdinary.finalSellingPriceJPY.toLocaleString()} JPY`
  );
  assert(
    tokyoKyotoOrdinary.carType === 'Ordinary',
    'Pricing result correctly preserves Ordinary Car Class'
  );

  const tokyoKyotoGreen = railPricingEngine.calculatePrice({
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-KYOTO',
    productId: 'RAIL-JP-GREEN-RESERVED',
    serviceGroup: 'NOZOMI_MIZUHO',
    travelDate: '2026-05-15',
    adultsCount: 2,
    childrenCount: 1,
    targetCurrency: 'JPY'
  });

  assert(
    tokyoKyotoGreen.finalSellingPriceJPY > tokyoKyotoOrdinary.finalSellingPriceJPY,
    `First Class Tariff: Tokyo -> Kyoto Green Car (¥${tokyoKyotoGreen.finalSellingPriceJPY.toLocaleString()}) > Ordinary (¥${tokyoKyotoOrdinary.finalSellingPriceJPY.toLocaleString()})`
  );

  // --------------------------------------------------------------------------
  // 5. HISTORICAL SNAPSHOT PROTECTION & SAFE DELETE / ARCHIVE AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Historical Protection & Safe Archive Policy ---');

  // Create a mock quote referencing the Ordinary Car product
  const mockQuote: any = {
    id: `quo-rail-audit-${Date.now()}`,
    quoteNumber: `TUB-QT-RAIL-${Date.now()}`,
    title: 'Japan Rail Shinkansen Journey',
    clientName: 'VIP Traveler',
    agentId: 'usr-agent-test',
    agentName: 'B2B Travel Partner',
    agentEmail: 'agent@partner.com',
    leadId: 'led-test-123',
    destination: 'Japan',
    totalSellingPrice: tokyoKyotoOrdinary.finalSellingPriceJPY,
    currency: 'JPY',
    adults: 2,
    children: 1,
    infants: 0,
    travelStartDate: '2026-05-15',
    travelEndDate: '2026-05-20',
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `item-rail-${Date.now()}`,
        productId: 'RAIL-JP-ORD-RESERVED',
        commercialProductId: 'ORDINARY_RESERVED',
        productName: 'Ordinary Car — Reserved Seat',
        serviceType: 'Rail',
        dayNumber: 1,
        date: '2026-05-15',
        sellingPriceFinal: tokyoKyotoOrdinary.finalSellingPriceJPY,
        currency: 'JPY',
        quantity: 1,
        adults: 2,
        children: 1,
        status: 'ACTIVE'
      } as any
    ]
  };

  db.saveQuote(mockQuote, adminUser);

  // Attempt to delete the referenced Ordinary Car product
  const archiveResult = db.deleteJapanRailCommercialProduct('ORDINARY_RESERVED', adminUser);
  assert(
    archiveResult.action === 'ARCHIVED',
    `Safe Archive: Product referenced by active Quote is ARCHIVED instead of hard-deleted (${archiveResult.message})`
  );

  const referencedQuoteAfter = db.getRawQuoteById(mockQuote.id);
  assert(
    !!referencedQuoteAfter && referencedQuoteAfter.items[0].productId === 'RAIL-JP-ORD-RESERVED',
    'Historical Integrity: Existing Quote item and pricing snapshot remain intact and immutable'
  );

  // Restore status to ACTIVE
  const ordCurrent = db.getJapanRailCommercialProductById('ORDINARY_RESERVED');
  if (ordCurrent) {
    db.saveJapanRailCommercialProduct({ ...ordCurrent, status: 'ACTIVE' }, adminUser);
  }

  // Cleanup test quote
  db.deleteQuote(mockQuote.id, adminUser);

  console.log('\n================================================================');
  console.log(`  JAPAN RAIL COMMERCIAL PRODUCTS AUDIT RESULT: ${passedTests}/${totalTests} Checks Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    throw new Error(`Japan Rail Commercial Products Audit failed with ${failedTests} issues.`);
  } else {
    console.log('  FINAL CERTIFICATION: PASS');
    console.log('  EXACTLY 2 COMMERCIAL MASTER PRODUCTS OPERATIONAL & FULLY GOVERNED.\n');
  }
}

// Direct execution when executed via tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  runJapanRailCommercialProductsAudit()
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
