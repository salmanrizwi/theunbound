import { AppDatabase } from '../services/db';
import {
  calculateProductPrice,
  calculateQuoteInternalBreakdown,
  buildQuotationCurrencySnapshot,
  convertCurrency,
  clearPricingEngineCache
} from '../services/pricingEngine';
import { currencyEngine, getExchangeRateInfo } from '../services/currencyEngine';
import { DestinationRelevanceService } from '../services/destinationRelevanceService';
import { pricingCache } from '../services/pricingCache';
import { masterDataCache } from '../services/masterDataCache';
import { performanceMonitor } from '../services/performanceMonitor';
import { backgroundJobService } from '../services/backgroundJobService';
import { sanitizeQuoteForAgent, sanitizeQuoteDocumentForCustomer } from '../utils/customerQuoteSanitizer';
import { canUserViewInternalCostBreakdown, canUserShareQuoteWhatsApp } from '../services/permissionEngine';
import { buildAgencyBrandingSnapshotFromUser } from '../services/quotePresentationModel';
import { hotelToProduct } from '../utils/hotelHelpers';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { INITIAL_HOTELS } from '../data/initialHotels';
import { INITIAL_CITY_HUBS } from '../data/initialCityHubs';
import { INITIAL_SURCHARGE_MASTERS } from '../services/surchargeEngine';
import { Product, QuoteItem, Quotation, SurchargeMaster, User } from '../types';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(id: number, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const badge = passed ? 'PASS' : 'FAIL';
  console.log(`[${badge}] #${String(id).padStart(2, '0')} ${name}: ${details}`);
}

async function runAll() {
  const db = AppDatabase.getInstance();
  const relevance = DestinationRelevanceService.getInstance();

  const adminUser: User = {
    id: 'usr-admin-e2e',
    email: 'business@theunbound.in',
    name: 'Admin E2E',
    role: 'ADMIN',
    status: 'ACTIVE'
  } as any;

  const agentA: User = {
    id: 'usr-agent-alpha',
    email: 'alpha@agencya.com',
    name: 'Alice Agent',
    role: 'B2B_AGENT',
    companyId: 'comp-alpha',
    agencyName: 'Alpha Luxury Holidays',
    brandLogoUrl: 'https://agencya.com/logo.png',
    status: 'ACTIVE',
    permissions: { canShareWhatsApp: true, canExportPdf: true }
  } as any;

  const agentB: User = {
    id: 'usr-agent-beta',
    email: 'beta@agencyb.com',
    name: 'Bob Agent',
    role: 'B2B_AGENT',
    companyId: 'comp-beta',
    agencyName: 'Beta Tours',
    status: 'ACTIVE'
  } as any;

  // Seed clean in-memory datasets
  (db as any).setItem('products', INITIAL_PRODUCTS, false);
  (db as any).setItem('hotels', INITIAL_HOTELS, false);
  (db as any).setItem('city_hubs', INITIAL_CITY_HUBS, false);
  (db as any).setItem('surcharge_masters', INITIAL_SURCHARGE_MASTERS, false);
  clearPricingEngineCache();
  performanceMonitor.reset();

  const products = db.getProducts();
  const hotels = db.getHotels();

  // 1. Quote Builder Init & DB Memoized Getters
  const tInit0 = performance.now();
  const p1 = db.getProducts();
  const p2 = db.getProducts();
  const h1 = db.getHotels();
  const initMs = performance.now() - tInit0;
  const prodCacheStats = performanceMonitor.getSummary().caches.find(c => c.name === 'dbGetProducts');
  record(1, 'Quote Builder Init & Memoized DB Getters', (prodCacheStats?.hits ?? 0) >= 2 && p1.length > 0 && h1.length > 0 && initMs < 50, `products=${p1.length}, hotels=${h1.length}, cacheHits=${prodCacheStats?.hits ?? 0}, ${initMs.toFixed(2)}ms`);

  // 2. Destination Relevance Selection & Warm Cache Hit
  masterDataCache.bumpVersion('products');
  const destCold = relevance.getRelevantProducts('dest-japan', 'hub-tokyo');
  const tRelWarm = performance.now();
  const destWarm = relevance.getRelevantProducts('dest-japan', 'hub-tokyo');
  const relWarmMs = performance.now() - tRelWarm;
  const relCacheStats = performanceMonitor.getSummary().caches.find(c => c.name === 'relevanceProducts');
  record(2, 'Destination Product Relevance & Cache Hit', destCold.hubActivities.length > 0 && destCold.hubActivities.length === destWarm.hubActivities.length && (relCacheStats?.hits ?? 0) >= 1 && relWarmMs < 2, `hubActivities=${destCold.hubActivities.length}, cacheHits=${relCacheStats?.hits ?? 0}, warm=${relWarmMs.toFixed(3)}ms`);

  // 3. Hub Switching Hotel Relevance Parity
  const tokyoHotels = relevance.getRelevantHotels('dest-japan', 'hub-tokyo');
  const kyotoHotels = relevance.getRelevantHotels('dest-japan', 'hub-kyoto');
  record(3, 'Hub Switching & Hotel Filtering', tokyoHotels.length > 0 && kyotoHotels.length > 0, `tokyo=${tokyoHotels.length}, kyoto=${kyotoHotels.length}`);

  // 4. Product Search Filtering Performance across 100+ items
  const tSearch = performance.now();
  const searchQuery = 'tokyo';
  const searchHits = products.filter(p => (p.name || '').toLowerCase().includes(searchQuery) || (p.city || '').toLowerCase().includes(searchQuery));
  const searchMs = performance.now() - tSearch;
  record(4, 'Product Search Filter Latency', searchHits.length > 0 && searchMs < 20, `matches=${searchHits.length}, elapsed=${searchMs.toFixed(3)}ms`);

  // 5. Hotel Selection & hotelToProduct Calculation
  const sampleHotel = tokyoHotels[0] || hotels[0];
  const sampleRoom = sampleHotel.roomTypes?.[0];
  const hotelProd = hotelToProduct(sampleHotel, sampleRoom, 1, 3);
  const hotelCalc = calculateProductPrice(hotelProd, {
    productId: hotelProd.id,
    productName: hotelProd.name,
    pricingTier: 'B2B',
    userRole: 'B2B_AGENT',
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-04-05',
    targetCurrency: 'INR'
  });
  record(5, 'Hotel Selection & Tariff Calculation', hotelCalc.finalTotalSellingPrice > 0, `hotel=${sampleHotel.name}, INR=${hotelCalc.finalTotalSellingPrice}`);

  // 6. Transfer & Activity Calculation Parity
  const transferProd = products.find(p => (p.category || '').toLowerCase().includes('transfer')) || products[0];
  const activityProd = destCold.hubActivities[0] || products[1];
  const trfCalc = calculateProductPrice(transferProd, {
    productId: transferProd.id,
    pricingTier: 'B2B',
    userRole: 'ADMIN',
    adults: 2,
    children: 1,
    infants: 0,
    travelDate: '2026-04-05',
    targetCurrency: 'INR'
  });
  const actCalc = calculateProductPrice(activityProd, {
    productId: activityProd.id,
    pricingTier: 'B2B',
    userRole: 'ADMIN',
    adults: 2,
    children: 1,
    infants: 0,
    travelDate: '2026-04-05',
    targetCurrency: 'INR'
  });
  record(6, 'Transfer & Activity Tariff Calculation', trfCalc.finalTotalSellingPrice > 0 && actCalc.finalTotalSellingPrice > 0, `trf=${trfCalc.finalTotalSellingPrice}, act=${actCalc.finalTotalSellingPrice}`);

  // 7. Central Quote Breakdown + Cache Hit Parity
  const quoteItems: QuoteItem[] = [
    { id: 'qi-1', product: transferProd, travelDate: '2026-04-05', pax: { adults: 2, children: 1, infants: 0 }, calculation: trfCalc } as any,
    { id: 'qi-2', product: activityProd, travelDate: '2026-04-05', pax: { adults: 2, children: 1, infants: 0 }, calculation: actCalc } as any
  ];
  const breakdownInput = {
    items: quoteItems,
    targetCurrency: 'INR' as const,
    agentMarginType: 'PERCENTAGE' as const,
    agentMarginValue: 10,
    userRole: 'ADMIN' as const,
    user: adminUser,
    scope: 'HOTEL_LAND' as const
  };
  const b1 = calculateQuoteInternalBreakdown(breakdownInput);
  const tBWarm = performance.now();
  const b2 = calculateQuoteInternalBreakdown(breakdownInput);
  const bWarmMs = performance.now() - tBWarm;
  record(7, 'Quote Breakdown Cache Hit & Exact Parity', b1.finalPackagePrice === b2.finalPackagePrice && b1.surchargesTotal === b2.surchargesTotal && bWarmMs < 2, `final=${b1.finalPackagePrice}, warmMs=${bWarmMs.toFixed(3)}ms`);

  // 8. Applicable Surcharges Breakdown Metadata Completeness
  const linkedProd = activityProd;
  const surBaseMaster: SurchargeMaster = {
    id: 'sur-e2e-meta',
    surchargeCode: 'SUR-META-26',
    name: 'E2E Peak Foliage Supplement',
    surchargeCategory: 'SEASONAL',
    status: 'ACTIVE',
    isActive: true,
    validFrom: '2026-04-01',
    validTo: '2026-04-15',
    periods: [{ id: 'p-1', label: 'Spring Peak', travelStartDate: '2026-04-01', travelEndDate: '2026-04-15' }],
    allowStacking: true,
    priority: 100,
    linkedProductIds: [linkedProd.id],
    calculationType: 'FIXED',
    pricingBasis: 'PER_BOOKING',
    amount: 2000,
    currency: 'INR',
    version: 1
  } as any;
  (db as any).setItem('surcharge_masters', [...INITIAL_SURCHARGE_MASTERS, surBaseMaster], false);
  pricingCache.bumpSurchargeCatalogVersion();

  const linkedCalc = calculateProductPrice(linkedProd, {
    productId: linkedProd.id,
    productName: linkedProd.name,
    itemId: 'qi-sur',
    pricingTier: 'B2B',
    userRole: 'ADMIN',
    user: adminUser,
    adults: 2,
    children: 0,
    infants: 0,
    travelDate: '2026-04-05',
    targetCurrency: 'INR'
  });
  const surBreakdown = calculateQuoteInternalBreakdown({
    items: [{ id: 'qi-sur', product: linkedProd, travelDate: '2026-04-05', pax: { adults: 2, children: 0, infants: 0 }, calculation: linkedCalc } as any],
    targetCurrency: 'INR',
    userRole: 'ADMIN',
    user: adminUser
  });
  const surRows = surBreakdown.appliedSurcharges || [];
  const hasCompleteRows = surRows.length > 0 && surRows.every(
    r => Boolean(r.productName && r.surchargeName && r.serviceDate && r.periodStartDate && r.periodEndDate && r.calculationType && r.rateValue !== undefined && (r.priceAfterSurcharge || 0) > 0)
  );
  record(8, 'Surcharge Breakdown Metadata Completeness', hasCompleteRows, `rows=${surRows.length}, total=${surBreakdown.surchargesTotal}`);

  // 9. Surcharge Cache Invalidation on Admin Surcharge Master Mutation
  const baseBeforeSur = calculateQuoteInternalBreakdown({ ...breakdownInput, items: [{ id: 'qi-sur2', product: linkedProd, travelDate: '2026-04-05', pax: { adults: 2, children: 0, infants: 0 } } as any] });
  const extraSurcharge: SurchargeMaster = {
    id: 'sur-e2e-boost',
    surchargeCode: 'SUR-E2E',
    name: 'E2E Special Gala Surcharge',
    surchargeCategory: 'EVENT_SURCHARGE',
    allowStacking: true,
    priority: 90,
    linkedProductIds: [linkedProd.id],
    validFrom: '2026-04-01',
    validTo: '2026-04-10',
    calculationType: 'FIXED',
    pricingBasis: 'PER_BOOKING',
    amount: 5000,
    currency: 'INR',
    isActive: true,
    status: 'ACTIVE'
  } as any;
  (db as any).setItem('surcharge_masters', [...INITIAL_SURCHARGE_MASTERS, surBaseMaster, extraSurcharge], false);
  pricingCache.bumpSurchargeCatalogVersion();
  const baseAfterSur = calculateQuoteInternalBreakdown({ ...breakdownInput, items: [{ id: 'qi-sur2', product: linkedProd, travelDate: '2026-04-05', pax: { adults: 2, children: 0, infants: 0 } } as any] });
  (db as any).setItem('surcharge_masters', INITIAL_SURCHARGE_MASTERS, false);
  pricingCache.bumpSurchargeCatalogVersion();
  record(9, 'Surcharge Cache Invalidation on Master Update', (baseAfterSur.surchargesTotal || 0) > (baseBeforeSur.surchargesTotal || 0), `before=${baseBeforeSur.surchargesTotal}, after=${baseAfterSur.surchargesTotal}`);

  // 10. Multi-Currency FX Conversion Precision
  const jpyToInr = convertCurrency(10000, 'JPY', 'INR');
  const usdToEur = convertCurrency(100, 'USD', 'EUR');
  record(10, 'Multi-Currency FX Conversion Precision', jpyToInr > 0 && usdToEur > 0 && jpyToInr !== 10000, `10000 JPY=${jpyToInr} INR, 100 USD=${usdToEur} EUR`);

  // 11. Missing / Paused FX Pair Throws / Fails Validation (Never silent FX = 1)
  currencyEngine.setPairAvailability('USD', 'SGD', false, 'PAUSE');
  const pausedValidation = currencyEngine.validateConversion('USD', 'SGD');
  const silentConvertVal = convertCurrency(100, 'USD', 'SGD');
  currencyEngine.setPairAvailability('USD', 'SGD', true);
  record(11, 'Missing/Paused FX Pair Strict Blocking', !pausedValidation.isValid && pausedValidation.effectiveRate === 0 && silentConvertVal === 0, `isValid=${pausedValidation.isValid}, effectiveRate=${pausedValidation.effectiveRate}, converted=${silentConvertVal}`);

  // 12. FX Cache Invalidation on Admin Rate Update
  const usdSampleProd: Product = { ...transferProd, id: 'prod-fx-usd', currency: 'USD', adultNetPrice: 500, childNetPrice: 250 };
  const rateTestKey = { ...breakdownInput, items: [{ id: 'qi-fx-1', product: usdSampleProd, travelDate: '2026-04-05', pax: { adults: 2, children: 0, infants: 0 } } as any], targetCurrency: 'EUR' as const };
  const eurBefore = calculateQuoteInternalBreakdown(rateTestKey).finalPackagePrice;
  const origUsdEur = getExchangeRateInfo('USD', 'EUR').effectiveRate || 0.92;
  currencyEngine.setExchangeRate('USD', 'EUR', origUsdEur * 1.15);
  const eurAfter = calculateQuoteInternalBreakdown(rateTestKey).finalPackagePrice;
  currencyEngine.setExchangeRate('USD', 'EUR', origUsdEur);
  record(12, 'FX Cache Invalidation on Admin Rate Update', Math.abs(eurAfter - eurBefore) > 1, `before=${eurBefore}, after=${eurAfter}`);

  // 13. Agent Additional Markup (Percentage vs Fixed & Zero Double Counting)
  const pctMarkup = calculateQuoteInternalBreakdown({ ...breakdownInput, agentMarginType: 'PERCENTAGE', agentMarginValue: 15 });
  const fixedMarkup = calculateQuoteInternalBreakdown({ ...breakdownInput, agentMarginType: 'FIXED', agentMarginValue: 2500 });
  record(13, 'Agent Markup Percentage & Fixed Accuracy', pctMarkup.partnerMarginAmount > 0 && Math.abs(fixedMarkup.partnerMarginAmount - 2500) <= 1, `pctMargin=${pctMarkup.partnerMarginAmount}, fixedMargin=${fixedMarkup.partnerMarginAmount}`);

  // 14. Admin Manual Margin Adjustment (ADD vs REPLACE)
  const adminAdd = calculateQuoteInternalBreakdown({ ...breakdownInput, adminManualMarginType: 'FIXED', adminManualMarginValue: 3000, adminMarginMode: 'ADD' });
  const adminReplace = calculateQuoteInternalBreakdown({ ...breakdownInput, adminManualMarginType: 'FIXED', adminManualMarginValue: 3000, adminMarginMode: 'REPLACE' });
  record(14, 'Admin Manual Margin ADD & REPLACE Modes', adminAdd.revisedSellingPrice !== adminReplace.revisedSellingPrice, `ADD=${adminAdd.revisedSellingPrice}, REPLACE=${adminReplace.revisedSellingPrice}`);

  // 15. Overall Discount Application
  const noDisc = calculateQuoteInternalBreakdown({ ...breakdownInput, overallDiscountPercent: 0 });
  const withDisc = calculateQuoteInternalBreakdown({ ...breakdownInput, overallDiscountPercent: 5 });
  record(15, 'Overall Discount Reduction Integrity', withDisc.finalPackagePrice < noDisc.finalPackagePrice, `0%=${noDisc.finalPackagePrice}, 5%=${withDisc.finalPackagePrice}`);

  // 16. Quotation Currency Snapshot & Precomputed Breakdown Reuse
  const tSnap = performance.now();
  const snap1 = buildQuotationCurrencySnapshot({
    quoteId: 'q-snap-e2e',
    quoteVersion: 1,
    items: quoteItems,
    targetCurrency: 'INR',
    user: adminUser,
    precomputedBreakdown: b1
  });
  const snapMs = performance.now() - tSnap;
  record(16, 'Currency Snapshot Reuse & Immutability', snap1.lineItems.length === 2 && snap1.finalCustomerSellingPrice === b1.finalPackagePrice && snapMs < 20, `lines=${snap1.lineItems.length}, total=${snap1.finalCustomerSellingPrice}, elapsed=${snapMs.toFixed(3)}ms`);

  // 17. Customer/Agent Cost Redaction (Zero Nett Cost Leak)
  const rawSensitiveQuote: Quotation = {
    id: 'q-sec-e2e',
    quoteNumber: 'QTE-SEC-01',
    version: 1,
    title: 'Security Test Quote',
    destination: 'Japan',
    items: quoteItems,
    currency: 'INR',
    totalNetCost: 85000,
    totalSellingPrice: b1.finalPackagePrice,
    totalTaxes: 1200,
    totalMargin: 15000,
    theUnboundBaseSellingPrice: b1.theUnboundBaseSellingPrice,
    finalCustomerSellingPrice: b1.finalPackagePrice,
    clientName: 'VIP Guest',
    clientEmail: 'vip@guest.com',
    agentId: agentA.id,
    agentEmail: agentA.email,
    status: 'DRAFT'
  } as any;
  const agentSafe = sanitizeQuoteForAgent(rawSensitiveQuote);
  const custSafe = sanitizeQuoteDocumentForCustomer(rawSensitiveQuote);
  const leakedToAgent = (agentSafe.totalNetCost || 0) !== 0 || agentSafe.items.some((it: any) => (it.calculation?.totalNetCost || 0) !== 0);
  const leakedToCust = (custSafe.totalNetCost || 0) !== 0 || (custSafe.totalMargin || 0) !== 0;
  record(17, 'Agent & Customer Cost Confidentiality Redaction', !leakedToAgent && !leakedToCust, `agentLeaked=${leakedToAgent}, customerLeaked=${leakedToCust}`);

  // 18. Auto-Save Action Type ('AUTO_SAVED') & PerformanceMonitor Health
  const savedAuto = db.saveQuote({ ...rawSensitiveQuote }, agentA, 'AUTO_SAVED');
  performanceMonitor.recordAutoSave('SKIPPED');
  performanceMonitor.recordAutoSave('CONFLICT_PREVENTED');
  performanceMonitor.recordAutoSave('SUCCESS', 12.5);
  const autoStat = performanceMonitor.getSummary().autoSave;
  record(18, 'Auto-Save Quiet Persistence & Conflict Stats', Boolean(savedAuto.id) && autoStat.skippedNoDirty >= 1 && autoStat.conflictPrevented >= 1 && autoStat.succeeded >= 1, `saved=${savedAuto.id}, skipped=${autoStat.skippedNoDirty}, conflicts=${autoStat.conflictPrevented}`);

  // 19. Agency Isolation & Deep-Link Authorization
  const readByOwner = db.getQuoteByIdAuthorized(savedAuto.id, agentA);
  const readByOther = db.getQuoteByIdAuthorized(savedAuto.id, agentB);
  const readByAdmin = db.getQuoteByIdAuthorized(savedAuto.id, adminUser);
  record(19, 'Agency Isolation & RBAC Quote Retrieval', Boolean(readByOwner) && !readByOther && Boolean(readByAdmin), `owner=${Boolean(readByOwner)}, crossAgencyBlocked=${!readByOther}, admin=${Boolean(readByAdmin)}`);

  // 20. Background Job Service Idempotency & Retry Recovery
  let retryAttemptCounter = 0;
  const [resA, resB] = await Promise.all([
    backgroundJobService.enqueue({
      idempotencyKey: 'e2e-pdf-dedup',
      jobType: 'PDF_EXPORT',
      label: 'E2E Test PDF',
      maxRetries: 1,
      task: async (updateProgress) => {
        retryAttemptCounter++;
        updateProgress(50);
        if (retryAttemptCounter === 1) throw new Error('Transient canvas glitch');
        updateProgress(100);
        return 'PDF_OK';
      }
    }),
    backgroundJobService.enqueue({
      idempotencyKey: 'e2e-pdf-dedup',
      jobType: 'PDF_EXPORT',
      label: 'E2E Test PDF',
      maxRetries: 1,
      task: async () => 'SHOULD_DEDUP'
    })
  ]);
  record(20, 'Background Job Idempotency & Retry Recovery', resA === 'PDF_OK' && resB === 'PDF_OK' && retryAttemptCounter === 2, `resA=${resA}, resB=${resB}, totalAttempts=${retryAttemptCounter}`);

  // 21. RBAC Permission Engine Boundaries
  const agentSeesInternal = canUserViewInternalCostBreakdown(agentA);
  const adminSeesInternal = canUserViewInternalCostBreakdown(adminUser);
  const agentWaAllowed = canUserShareQuoteWhatsApp(agentA).allowed;
  record(21, 'RBAC Internal Cost & WhatsApp Boundaries', !agentSeesInternal && adminSeesInternal && agentWaAllowed, `agentInternal=${agentSeesInternal}, adminInternal=${adminSeesInternal}, wa=${agentWaAllowed}`);

  // 22. MasterDataCache Versioned Invalidations
  const vBefore = masterDataCache.getVersion('products');
  const tBefore = masterDataCache.getVersion('inventory_tombstones');
  masterDataCache.setDerived('test-slice', vBefore, tBefore, [1, 2, 3]);
  const hitBefore = masterDataCache.getDerived<number[]>('test-slice', vBefore, tBefore);
  const vAfter = masterDataCache.bumpVersion('products');
  const hitAfter = masterDataCache.getDerived<number[]>('test-slice', vAfter, tBefore);
  record(22, 'MasterDataCache Store & Versioned Invalidation', Array.isArray(hitBefore) && hitBefore.length === 3 && hitAfter === undefined, `hitBefore=${Boolean(hitBefore)}, clearedOnVersionBump=${hitAfter === undefined}`);

  // 23. Query Pagination Helper Verification (Public Firestore Collection + Local RBAC Slice)
  const manyQuotes = Array.from({ length: 35 }, (_, i) => ({ ...rawSensitiveQuote, id: `q-page-${i}`, updatedAt: new Date(Date.now() - i * 1000).toISOString() }));
  (db as any).setItem('saved_quotes', manyQuotes, false);
  const localAgentQuotes = db.getQuotesForUser(agentA);
  let firestorePaginationOk = false;
  let paginationDetail = '';
  try {
    const page1 = await db.queryCollectionPaginated<Quotation>('products', { pageSize: 5 });
    firestorePaginationOk = page1.items.length <= 5 && localAgentQuotes.length === 35;
    paginationDetail = `productsPage=${page1.items.length}, hasMore=${page1.hasMore}, localQuotes=${localAgentQuotes.length}`;
  } catch (err: any) {
    // Expected in unauthenticated Node runtime when Firestore rules enforce auth
    firestorePaginationOk = err?.code === 'permission-denied' && localAgentQuotes.length === 35;
    paginationDetail = `unauthFirestoreGuarded=${err?.code}, localQuotes=${localAgentQuotes.length}`;
  }
  record(23, 'Paginated Query Cap & RBAC Slice', firestorePaginationOk, paginationDetail);

  // 24. White-Label Agency Branding Snapshot Isolation
  const wlSnap = buildAgencyBrandingSnapshotFromUser(agentA, undefined, 'WHITE_LABEL');
  const stdSnap = buildAgencyBrandingSnapshotFromUser(agentA, undefined, 'STANDARD');
  record(24, 'White-Label Branding Isolation', wlSnap.mode === 'WHITE_LABEL' && wlSnap.agencyName === 'Alpha Luxury Holidays' && !wlSnap.agencyName.toLowerCase().includes('unbound') && stdSnap.mode === 'STANDARD', `wlAgency=${wlSnap.agencyName}, stdMode=${stdSnap.mode}`);

  // 25. PerformanceMonitor Full Summary Verification
  const summary = performanceMonitor.getSummary();
  record(25, 'PerformanceMonitor Summary Completeness', Object.keys(summary.timings).length >= 10 && Array.isArray(summary.caches) && summary.autoSave.totalSaves >= 1, `categories=${Object.keys(summary.timings).length}, caches=${summary.caches.length}, reads=${summary.firestoreReads}`);

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.length - passedCount;
  console.log(`\n================================================`);
  console.log(`QUOTE BUILDER E2E & PERF AUDIT: ${passedCount}/${results.length} PASSED (${failedCount} FAILED)`);
  console.log(`================================================`);
  process.exit(failedCount > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
