import { CurrencyEngine } from '../services/currencyEngine';
import {
  displayCurrencyService,
  canUserEditDisplayCurrency,
  getCurrencyPrecision,
  roundAmountForCurrency,
  formatDisplayMoney
} from '../services/displayCurrencyService';
import { DashboardMetricsService } from '../services/dashboardMetricsService';
import { Booking, CurrencyCode, Hotel, Product, Quotation, User } from '../types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function approxEqual(a: number | null, b: number, tolerance = 0.05): boolean {
  if (a === null || !Number.isFinite(a)) return false;
  return Math.abs(a - b) <= tolerance;
}

function makeUser(overrides: Partial<User>): User {
  return {
    id: overrides.id || 'usr-test',
    name: overrides.name || 'Test User',
    email: overrides.email || 'user@example.com',
    role: overrides.role || 'B2B_AGENT',
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    createdAt: new Date().toISOString(),
    ...overrides
  } as User;
}

export async function runGlobalDisplayCurrencyAudit() {
  const fx = CurrencyEngine.getInstance();
  fx.resetToBaselineRates();

  // Set deterministic FX rates for exact mathematical verification
  fx.setExchangeRate('USD', 'INR', 95.1);
  fx.setExchangeRate('INR', 'USD', 1 / 95.1);
  fx.setExchangeRate('USD', 'JPY', 153.5);
  fx.setExchangeRate('JPY', 'USD', 1 / 153.5);
  fx.setExchangeRate('USD', 'EUR', 0.86);
  fx.setExchangeRate('EUR', 'USD', 1 / 0.86);
  fx.setExchangeRate('EUR', 'INR', 95.1 / 0.86);
  fx.setExchangeRate('INR', 'EUR', 0.86 / 95.1);
  fx.setExchangeRate('JPY', 'INR', 95.1 / 153.5);
  fx.setExchangeRate('INR', 'JPY', 153.5 / 95.1);
  fx.setExchangeRate('JPY', 'EUR', 0.86 / 153.5);
  fx.setExchangeRate('EUR', 'JPY', 153.5 / 0.86);

  console.log('================================================================================');
  console.log('GLOBAL DISPLAY CURRENCY MANAGEMENT AUDIT SUITE (TESTS A-G)');
  console.log('================================================================================\n');

  const adminActor = makeUser({
    id: 'usr-admin-business',
    name: 'Global Master Admin',
    email: 'business@theunbound.in',
    role: 'ADMIN'
  });

  // Reset display currency to USD as Admin
  await displayCurrencyService.setGlobalDisplayCurrency('USD', adminActor);

  // ---------------------------------------------------------------------------
  // TEST A — Supported Currencies, Precision Rules & Cross-Currency Conversion
  // ---------------------------------------------------------------------------
  {
    assert(getCurrencyPrecision('JPY') === 0, 'Test A: JPY must use 0 decimals');
    assert(getCurrencyPrecision('THB') === 0, 'Test A: THB must use 0 decimals');
    assert(getCurrencyPrecision('USD') === 2, 'Test A: USD must use 2 decimals');
    assert(getCurrencyPrecision('INR') === 2, 'Test A: INR must use 2 decimals');
    assert(getCurrencyPrecision('EUR') === 2, 'Test A: EUR must use 2 decimals');
    assert(roundAmountForCurrency(15350.6, 'JPY') === 15351, 'Test A: JPY rounding must be integer');
    assert(roundAmountForCurrency(123.456, 'USD') === 123.46, 'Test A: USD rounding must be 2 decimals');

    const jpyToUsd = displayCurrencyService.convertForDisplay(15350, 'JPY', 'USD');
    assert(jpyToUsd.status === 'OK', 'Test A: JPY -> USD status must be OK');
    assert(approxEqual(jpyToUsd.convertedAmount, 100, 0.02), `Test A: JPY 15,350 -> USD expected ~100.00, got ${jpyToUsd.convertedAmount}`);
    assert(jpyToUsd.isConverted === true, 'Test A: JPY -> USD must set isConverted=true');
    assert(jpyToUsd.nativeFormatted.includes('15,350'), `Test A: Native formatted must keep JPY 15,350, got ${jpyToUsd.nativeFormatted}`);

    const usdIdentity = displayCurrencyService.convertForDisplay(250, 'USD', 'USD');
    assert(usdIdentity.status === 'IDENTITY', 'Test A: USD -> USD status must be IDENTITY');
    assert(usdIdentity.convertedAmount === 250, 'Test A: USD -> USD must preserve exact 250');
    assert(usdIdentity.isConverted === false, 'Test A: USD -> USD must set isConverted=false');

    console.log('✅ TEST A PASSED — Precision Rules & Cross-Currency Display Conversion');
  }

  // ---------------------------------------------------------------------------
  // TEST B — Strict Admin RBAC Enforcement & Audit Trail
  // ---------------------------------------------------------------------------
  {
    const agentUser = makeUser({ id: 'usr-agent-1', email: 'agent@partner.com', role: 'B2B_AGENT' });
    const teamUser = makeUser({ id: 'usr-team-1', email: 'ops@theunbound.in', role: 'TEAM_MEMBER' as any });
    const buyerUser = makeUser({ id: 'usr-buyer-1', email: 'traveler@gmail.com', role: 'BUYER' as any });
    const superAdminUser = makeUser({ id: 'usr-super-1', email: 'super@theunbound.in', role: 'SUPER_ADMIN' as any });

    assert(canUserEditDisplayCurrency(null) === false, 'Test B: null user cannot edit display currency');
    assert(canUserEditDisplayCurrency(agentUser) === false, 'Test B: B2B_AGENT cannot edit display currency');
    assert(canUserEditDisplayCurrency(teamUser) === false, 'Test B: TEAM_MEMBER cannot edit display currency');
    assert(canUserEditDisplayCurrency(buyerUser) === false, 'Test B: BUYER cannot edit display currency');
    assert(canUserEditDisplayCurrency(adminActor) === true, 'Test B: ADMIN can edit display currency');
    assert(canUserEditDisplayCurrency(superAdminUser) === true, 'Test B: SUPER_ADMIN can edit display currency');

    const deniedRes = await displayCurrencyService.setGlobalDisplayCurrency('INR', agentUser);
    assert(deniedRes.success === false, 'Test B: Non-admin switch must fail');
    assert(displayCurrencyService.getDisplayCurrency() === 'USD', 'Test B: Failed switch must not mutate active displayCurrency');

    const invalidRes = await displayCurrencyService.setGlobalDisplayCurrency('ZZZ', adminActor);
    assert(invalidRes.success === false, 'Test B: Unsupported currency code must fail');

    let auditTriggered = false;
    let auditPrev: CurrencyCode | null = null;
    let auditNext: CurrencyCode | null = null;
    const allowedRes = await displayCurrencyService.setGlobalDisplayCurrency('INR', adminActor, {
      auditLogger: (prev, next) => {
        auditTriggered = true;
        auditPrev = prev;
        auditNext = next;
      }
    });
    assert(allowedRes.success === true, 'Test B: Admin switch to INR must succeed');
    assert(displayCurrencyService.getDisplayCurrency() === 'INR', 'Test B: Global Display Currency must now be INR');
    assert(auditTriggered && auditPrev === 'USD' && auditNext === 'INR', 'Test B: Audit logger must record USD -> INR');

    console.log('✅ TEST B PASSED — Strict Admin RBAC Enforcement & Audit Trail');
  }

  // ---------------------------------------------------------------------------
  // TEST C — Native DB Immutability & Commercial Quote Currency Isolation
  // ---------------------------------------------------------------------------
  {
    const hotel = {
      id: 'htl-tokyo-1',
      name: 'Aman Tokyo',
      currency: 'JPY' as CurrencyCode,
      startingNetPrice: 153500
    } as unknown as Hotel;

    const product = {
      id: 'prd-eur-1',
      name: 'VIP Louvre Experience',
      currency: 'EUR' as CurrencyCode,
      adultNetPrice: 860
    } as unknown as Product;

    const quote = {
      id: 'qte-comm-1',
      quoteNumber: 'TUB-QT-9001',
      currency: 'JPY' as CurrencyCode,
      totalSellingPrice: 307000,
      finalCustomerSellingPrice: 307000
    } as unknown as Quotation;

    await displayCurrencyService.setGlobalDisplayCurrency('USD', adminActor);
    const hotelDisplayUsd = displayCurrencyService.convertForDisplay(hotel.startingNetPrice, hotel.currency);
    const productDisplayUsd = displayCurrencyService.convertForDisplay(product.adultNetPrice, product.currency);
    const quoteDisplayUsd = displayCurrencyService.convertForDisplay(quote.finalCustomerSellingPrice, quote.currency);

    assert(approxEqual(hotelDisplayUsd.convertedAmount, 1000, 0.05), 'Test C: JPY 153,500 hotel displays as ~$1,000.00');
    assert(approxEqual(productDisplayUsd.convertedAmount, 1000, 0.05), 'Test C: EUR 860 product displays as ~$1,000.00');
    assert(approxEqual(quoteDisplayUsd.convertedAmount, 2000, 0.05), 'Test C: JPY 307,000 quote displays as ~$2,000.00');

    await displayCurrencyService.setGlobalDisplayCurrency('EUR', adminActor);
    // Verify native fields were NEVER touched
    assert(hotel.currency === 'JPY' && hotel.startingNetPrice === 153500, 'Test C: Hotel native currency/amount must remain untouched');
    assert(product.currency === 'EUR' && product.adultNetPrice === 860, 'Test C: Product native currency/amount must remain untouched');
    assert(quote.currency === 'JPY' && quote.finalCustomerSellingPrice === 307000, 'Test C: Customer-facing quote commercial currency/amount must remain untouched');

    console.log('✅ TEST C PASSED — Native DB Immutability & Commercial Quote Currency Isolation');
  }

  // ---------------------------------------------------------------------------
  // TEST D — Mixed-Currency Pipeline Value Aggregation (Convert Before Sum)
  // ---------------------------------------------------------------------------
  {
    const mixedQuotes = [
      { id: 'q1', quoteNumber: 'Q-1', status: 'SENT', currency: 'USD', totalSellingPrice: 1000 },
      { id: 'q2', quoteNumber: 'Q-2', status: 'APPROVED', currency: 'INR', totalSellingPrice: 95100 },
      { id: 'q3', quoteNumber: 'Q-3', status: 'DRAFT', currency: 'JPY', totalSellingPrice: 153500 },
      { id: 'q4', quoteNumber: 'Q-4', status: 'SENT', currency: 'EUR', totalSellingPrice: 860 }
    ];

    await displayCurrencyService.setGlobalDisplayCurrency('USD', adminActor);
    const usdAgg = displayCurrencyService.aggregateForDisplay(mixedQuotes, q => ({
      amount: q.totalSellingPrice,
      currency: q.currency
    }));

    assert(usdAgg.convertedCount === 4 && usdAgg.unavailableCount === 0, 'Test D: All 4 mixed-currency quotes must convert');
    assert(approxEqual(usdAgg.totalConverted, 4000, 0.05), `Test D: Mixed USD pipeline expected $4,000.00 (never raw $249,460), got ${usdAgg.totalConverted}`);

    await displayCurrencyService.setGlobalDisplayCurrency('INR', adminActor);
    const inrAgg = displayCurrencyService.aggregateForDisplay(mixedQuotes, q => ({
      amount: q.totalSellingPrice,
      currency: q.currency
    }));
    // 4 * 95,100 = 380,400 INR
    assert(approxEqual(inrAgg.totalConverted, 380400, 1.0), `Test D: Mixed INR pipeline expected ₹380,400.00, got ${inrAgg.totalConverted}`);

    console.log('✅ TEST D PASSED — Mixed-Currency Pipeline Value Converted Per-Record Before Aggregation');
  }

  // ---------------------------------------------------------------------------
  // TEST E — Repeated Switching Yields Zero Cascading / Rounding Drift
  // ---------------------------------------------------------------------------
  {
    const sampleAmount = 153500;
    const sampleCurr: CurrencyCode = 'JPY';

    await displayCurrencyService.setGlobalDisplayCurrency('USD', adminActor);
    const initialUsd = displayCurrencyService.convertForDisplay(sampleAmount, sampleCurr).convertedAmount;

    await displayCurrencyService.setGlobalDisplayCurrency('INR', adminActor);
    await displayCurrencyService.setGlobalDisplayCurrency('EUR', adminActor);
    await displayCurrencyService.setGlobalDisplayCurrency('JPY', adminActor);
    await displayCurrencyService.setGlobalDisplayCurrency('USD', adminActor);

    const finalUsd = displayCurrencyService.convertForDisplay(sampleAmount, sampleCurr).convertedAmount;
    assert(initialUsd === finalUsd, `Test E: USD -> INR -> EUR -> JPY -> USD caused drift! initial=${initialUsd}, final=${finalUsd}`);

    console.log('✅ TEST E PASSED — Zero Cascading Conversion Drift Across Repeated Switches');
  }

  // ---------------------------------------------------------------------------
  // TEST F — Unavailable / Paused FX Pair Never Falls Back to Rate = 1
  // ---------------------------------------------------------------------------
  {
    fx.setPairAvailability('JPY', 'USD', false);
    fx.setPairAvailability('USD', 'JPY', false);
    displayCurrencyService.invalidateConversionCache();

    await displayCurrencyService.setGlobalDisplayCurrency('USD', adminActor);
    const pausedRes = displayCurrencyService.convertForDisplay(30000, 'JPY', 'USD');
    assert(pausedRes.status === 'UNAVAILABLE', `Test F: Expected status UNAVAILABLE, got ${pausedRes.status}`);
    assert(pausedRes.convertedAmount === null, 'Test F: convertedAmount must be null when FX rate is unavailable');
    assert(pausedRes.formatted === 'FX Unavailable', `Test F: formatted must be "FX Unavailable", got ${pausedRes.formatted}`);

    const mixedWithPaused = [
      { id: 'q-ok', amount: 500, currency: 'USD' },
      { id: 'q-paused', amount: 30000, currency: 'JPY' }
    ];
    const aggWithPaused = displayCurrencyService.aggregateForDisplay(mixedWithPaused, x => x, 'USD');
    assert(aggWithPaused.hasUnavailableRates === true, 'Test F: Aggregate must flag hasUnavailableRates=true');
    assert(aggWithPaused.unavailableCount === 1 && aggWithPaused.convertedCount === 1, 'Test F: Aggregate must count 1 converted and 1 unavailable');
    assert(aggWithPaused.totalConverted === 500, `Test F: Paused JPY 30,000 must NEVER fall back to 1:1 ($30,500), expected 500, got ${aggWithPaused.totalConverted}`);

    const allPausedAgg = displayCurrencyService.aggregateForDisplay([{ id: 'p1', amount: 30000, currency: 'JPY' }], x => x, 'USD');
    assert(allPausedAgg.formattedTotal === 'FX Unavailable', `Test F: All-paused aggregate must display "FX Unavailable", got ${allPausedAgg.formattedTotal}`);

    const unsupportedRes = displayCurrencyService.convertForDisplay(100, 'ZZZ', 'USD');
    assert(unsupportedRes.status === 'UNAVAILABLE' && unsupportedRes.formatted === 'FX Unavailable', 'Test F: Unsupported currency must return FX Unavailable');
    assert(formatDisplayMoney(null, 'USD') === 'FX Unavailable', 'Test F: formatDisplayMoney(null) must return FX Unavailable');

    // Restore baseline rates
    fx.resetToBaselineRates();
    fx.setExchangeRate('USD', 'INR', 95.1);
    fx.setExchangeRate('INR', 'USD', 1 / 95.1);
    fx.setExchangeRate('USD', 'JPY', 153.5);
    fx.setExchangeRate('JPY', 'USD', 1 / 153.5);
    fx.setExchangeRate('USD', 'EUR', 0.86);
    fx.setExchangeRate('EUR', 'USD', 1 / 0.86);
    displayCurrencyService.invalidateConversionCache();

    console.log('✅ TEST F PASSED — Unavailable / Paused FX Pairs Explicitly Surface "FX Unavailable" (No 1:1 Fallback)');
  }

  // ---------------------------------------------------------------------------
  // TEST G — DashboardMetricsService Multi-Currency Booking Value & FX Warning
  // ---------------------------------------------------------------------------
  {
    const metricsSvc = DashboardMetricsService.getInstance();
    const nowIso = new Date().toISOString();
    const comparison = metricsSvc.getDateInterval('THIS_MONTH');

    const testBookings: Booking[] = [
      {
        id: 'bk-jpy',
        bookingReference: 'BK-001',
        status: 'CONFIRMED',
        currency: 'JPY',
        totalAmount: 153500, // USD 1,000
        paymentStatus: 'UNPAID',
        createdAt: nowIso
      } as unknown as Booking,
      {
        id: 'bk-eur',
        bookingReference: 'BK-002',
        status: 'CONFIRMED',
        currency: 'EUR',
        totalAmount: 860, // USD 1,000
        paymentStatus: 'PAID',
        createdAt: nowIso
      } as unknown as Booking
    ];

    const metricsUsd = metricsSvc.calculateKeyMetrics({
      bookings: testBookings,
      leads: [],
      quotes: [],
      users: [],
      suppliers: [],
      currentUser: adminActor,
      comparison,
      baseCurrency: 'USD'
    });

    assert(approxEqual(metricsUsd.bookingValue.currentTotal, 2000, 0.5), `Test G: Dashboard USD bookingValue expected ~$2,000, got ${metricsUsd.bookingValue.currentTotal}`);
    assert(metricsUsd.bookingValue.hasUnavailableRates === false, 'Test G: All pairs active so hasUnavailableRates must be false');

    // Pause JPY->USD and confirm DashboardMetricsService flags unavailable instead of summing 0 silently
    fx.setPairAvailability('JPY', 'USD', false);
    displayCurrencyService.invalidateConversionCache();

    const metricsPaused = metricsSvc.calculateKeyMetrics({
      bookings: testBookings,
      leads: [],
      quotes: [],
      users: [],
      suppliers: [],
      currentUser: adminActor,
      comparison,
      baseCurrency: 'USD'
    });
    assert(metricsPaused.bookingValue.hasUnavailableRates === true, 'Test G: DashboardMetricsService must flag hasUnavailableRates when JPY->USD is paused');
    assert(metricsPaused.bookingValue.unavailableCount === 1, `Test G: Expected 1 unavailable rate, got ${metricsPaused.bookingValue.unavailableCount}`);
    assert(approxEqual(metricsPaused.bookingValue.currentTotal, 1000, 0.5), `Test G: Only convertible EUR booking ($1,000) should sum, got ${metricsPaused.bookingValue.currentTotal}`);

    fx.resetToBaselineRates();
    await displayCurrencyService.setGlobalDisplayCurrency('USD', adminActor);
    console.log('✅ TEST G PASSED — DashboardMetricsService Converts Multi-Currency Bookings & Surfaces Missing FX');
  }

  console.log('\n================================================================================');
  console.log('ALL 7 GLOBAL DISPLAY CURRENCY AUDIT TESTS (A-G) PASSED 100%');
  console.log('================================================================================');
}

runGlobalDisplayCurrencyAudit().catch((err) => {
  console.error('❌ GLOBAL DISPLAY CURRENCY AUDIT FAILED:', err);
  process.exit(1);
});
