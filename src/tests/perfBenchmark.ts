import { AppDatabase } from '../services/db';
import {
  calculateProductPrice,
  calculateQuoteInternalBreakdown,
  buildQuotationCurrencySnapshot,
  clearPricingEngineCache
} from '../services/pricingEngine';
import { sanitizeQuoteForAgent } from '../utils/customerQuoteSanitizer';
import { DestinationRelevanceService } from '../services/destinationRelevanceService';
import { evaluateCentralizedProductSurcharges, INITIAL_SURCHARGE_MASTERS } from '../services/surchargeEngine';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_HOTELS } from '../data/initialHotels';
import { INITIAL_CITY_HUBS } from '../data/initialCityHubs';
import { Product, QuoteItem, Quotation, SurchargeMaster, User } from '../types';

function measureMs(fn: () => void, iterations = 1): { totalMs: number; avgMs: number } {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const totalMs = performance.now() - t0;
  return {
    totalMs: Number(totalMs.toFixed(3)),
    avgMs: Number((totalMs / iterations).toFixed(3))
  };
}

export function runPerfBenchmark() {
  const db = AppDatabase.getInstance();
  const relevance = DestinationRelevanceService.getInstance();

  const mockAdmin: User = {
    id: 'usr-admin-bench',
    email: 'business@theunbound.in',
    name: 'Admin Bench',
    role: 'ADMIN',
    status: 'ACTIVE'
  } as any;

  const mockAgent: User = {
    id: 'usr-agent-bench',
    email: 'agent@bench.com',
    name: 'Agent Bench',
    role: 'B2B_AGENT',
    companyId: 'comp-bench',
    agencyName: 'Bench Travel Agency',
    status: 'ACTIVE'
  } as any;

  // Populate realistic catalog scale (expanded from INITIAL datasets) into in-memory DB
  const expandedProducts: Product[] = [];
  for (let rep = 0; rep < 15; rep++) {
    INITIAL_PRODUCTS.forEach((p, idx) => {
      expandedProducts.push({
        ...p,
        id: rep === 0 ? p.id : `${p.id}-bench-${rep}-${idx}`,
        sku: rep === 0 ? p.sku : `${p.sku}-${rep}`
      });
    });
  }
  const expandedHotels = [];
  for (let rep = 0; rep < 10; rep++) {
    INITIAL_HOTELS.forEach((h, idx) => {
      expandedHotels.push({
        ...h,
        id: rep === 0 ? h.id : `${h.id}-bench-${rep}-${idx}`
      });
    });
  }
  const expandedSurcharges: SurchargeMaster[] = [];
  for (let rep = 0; rep < 16; rep++) {
    INITIAL_SURCHARGE_MASTERS.forEach((s, idx) => {
      expandedSurcharges.push({
        ...s,
        id: rep === 0 ? s.id : `${s.id}-bench-${rep}-${idx}`,
        surchargeCode: rep === 0 ? s.surchargeCode : `${s.surchargeCode}-${rep}`,
        linkedProductIds: rep === 0 ? s.linkedProductIds : [`bench-other-${rep}-${idx}`]
      });
    });
  }

  // Inject into memoryCache via internal setters / direct key seeding for accurate in-memory simulation
  (db as any).setItem('products', expandedProducts, false);
  (db as any).setItem('hotels', expandedHotels, false);
  (db as any).setItem('city_hubs', INITIAL_CITY_HUBS, false);
  (db as any).setItem('surcharge_masters', expandedSurcharges, false);

  const products = db.getProducts();
  const hotels = db.getHotels();
  const surcharges = db.getSurchargeMasters(false);

  const sampleProducts = products.slice(0, 12);
  const sampleItems: QuoteItem[] = sampleProducts.map((p, idx) => ({
    id: `qitem-bench-${idx}`,
    product: p,
    travelDate: idx % 2 === 0 ? '2026-04-05' : '2026-05-02', // triggers Sakura + Golden Week surcharges
    pax: { adults: 2, children: 1, infants: 0 },
    selectedAddonIds: []
  } as any));

  const seededItems: QuoteItem[] = sampleItems.map((it) => ({
    ...it,
    calculation: calculateProductPrice(it.product, {
      productId: it.product.id,
      productName: it.product.name,
      itemId: it.id,
      pricingTier: 'B2B',
      userRole: 'ADMIN',
      adults: it.pax.adults,
      children: it.pax.children,
      infants: it.pax.infants,
      travelDate: it.travelDate,
      targetCurrency: 'INR'
    })
  }));

  const sampleQuote: Quotation = {
    id: 'q-bench-01',
    quoteNumber: 'QT-BENCH-001',
    version: 3,
    title: 'Japan Sakura Bench Trip',
    destination: 'Japan',
    currency: 'INR',
    items: seededItems,
    routeHubs: [
      { id: 'rh-1', hubId: 'hub-tokyo', hubName: 'Tokyo', nights: 4, order: 1 },
      { id: 'rh-2', hubId: 'hub-kyoto', hubName: 'Kyoto', nights: 3, order: 2 }
    ],
    travelStartDate: '2026-04-05',
    travelEndDate: '2026-04-12',
    adultsCount: 2,
    childrenCount: 1,
    infantsCount: 0,
    totalPax: 3,
    clientName: 'Benchmark Client',
    clientEmail: 'client@bench.com',
    agentId: mockAgent.id,
    agentEmail: mockAgent.email,
    agentMarginType: 'PERCENTAGE',
    agentMarginValue: 10,
    status: 'DRAFT'
  } as any;

  // Seed 40 quotes into saved_quotes to measure getQuotesForUser(agent) cost
  const agentQuotes = Array.from({ length: 40 }, (_, i) => ({
    ...sampleQuote,
    id: `q-agent-bench-${i}`,
    quoteNumber: `QT-2026-${100 + i}`,
    agentId: mockAgent.id,
    agentEmail: mockAgent.email
  }));
  (db as any).setItem('saved_quotes', agentQuotes, false);

  // 1. Cold & warm calculateProductPrice
  clearPricingEngineCache();
  const calcProdCold = measureMs(() => {
    clearPricingEngineCache();
    calculateProductPrice(sampleProducts[0], {
      productId: sampleProducts[0].id,
      pricingTier: 'B2B',
      userRole: 'ADMIN',
      adults: 2,
      children: 1,
      infants: 0,
      travelDate: '2026-04-05',
      targetCurrency: 'INR'
    });
  }, 50);

  const calcProdWarm = measureMs(() => {
    calculateProductPrice(sampleProducts[0], {
      productId: sampleProducts[0].id,
      pricingTier: 'B2B',
      userRole: 'ADMIN',
      adults: 2,
      children: 1,
      infants: 0,
      travelDate: '2026-04-05',
      targetCurrency: 'INR'
    });
  }, 50);

  // 2. Full 12-item calculateQuoteInternalBreakdown (uncached vs repeated Quote Builder updates)
  const breakdownBench = measureMs(() => {
    calculateQuoteInternalBreakdown({
      items: seededItems,
      targetCurrency: 'INR',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10,
      userRole: 'ADMIN',
      user: mockAdmin,
      routeHubs: sampleQuote.routeHubs,
      scope: 'HOTEL_LAND'
    });
  }, 20);

  // 3. Simulate single Quote Builder save cycle (breakdown + 2x snapshot + sanitize)
  const saveCycleBench = measureMs(() => {
    calculateQuoteInternalBreakdown({
      items: seededItems,
      targetCurrency: 'INR',
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10,
      userRole: 'ADMIN',
      user: mockAdmin,
      routeHubs: sampleQuote.routeHubs
    });
    buildQuotationCurrencySnapshot({
      quoteId: sampleQuote.id,
      quoteVersion: 3,
      items: seededItems,
      targetCurrency: 'INR',
      routeHubs: sampleQuote.routeHubs,
      user: mockAdmin,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10
    });
    buildQuotationCurrencySnapshot({
      quoteId: sampleQuote.id,
      quoteVersion: 3,
      items: seededItems,
      targetCurrency: 'INR',
      routeHubs: sampleQuote.routeHubs,
      user: mockAdmin,
      agentMarginType: 'PERCENTAGE',
      agentMarginValue: 10
    });
    sanitizeQuoteForAgent(sampleQuote);
  }, 5);

  // 4. Surcharge engine direct lookup across 12 items x 80 surcharges x 20
  const surchargeBench = measureMs(() => {
    for (const it of sampleItems) {
      evaluateCentralizedProductSurcharges({
        product: it.product,
        serviceDate: it.travelDate,
        adults: 2,
        children: 1,
        infants: 0,
        baseNativeSellingAmount: 15000,
        productNativeCurrency: 'JPY',
        targetCurrency: 'INR',
        centralizedSurcharges: surcharges
      });
    }
  }, 20);

  // 5. DestinationRelevanceService lookups across full catalog
  const relevanceBench = measureMs(() => {
    relevance.getRelevantProducts('dest-japan', 'hub-tokyo');
    relevance.getRelevantHotels('dest-japan', 'hub-tokyo');
  }, 50);

  // 6. getQuotesForUser(agent) across 40 saved quotes
  const agentQuotesListBench = measureMs(() => {
    db.getQuotesForUser(mockAgent);
  }, 5);

  // 7. db.getProducts + db.getHotels + db.getCityHubs + db.getDestinations
  const dbGettersBench = measureMs(() => {
    db.getProducts();
    db.getHotels();
    db.getCityHubs();
    db.getDestinations();
  }, 50);

  return {
    catalogCounts: {
      products: products.length,
      hotels: hotels.length,
      surcharges: surcharges.length,
      quotes: agentQuotes.length
    },
    metrics: {
      calculateProductPrice_cold_50x: calcProdCold,
      calculateProductPrice_warm_50x: calcProdWarm,
      calculateQuoteInternalBreakdown_12items_20x: breakdownBench,
      handleSaveDraft_pricingCycle_5x: saveCycleBench,
      surchargeEvaluation_12items_80surcharges_20x: surchargeBench,
      destinationRelevance_fullCatalog_50x: relevanceBench,
      getQuotesForUser_40quotes_5x: agentQuotesListBench,
      dbGetters_50x: dbGettersBench
    }
  };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('perfBenchmark')) {
  const res = runPerfBenchmark();
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}
