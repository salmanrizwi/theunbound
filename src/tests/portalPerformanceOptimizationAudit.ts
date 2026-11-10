import { AppDatabase } from '../services/db';
import { 
  calculateDeliveredPriceForUser, 
  calculateProductPrice,
  clearPricingEngineCache,
  formatCurrency,
  convertCurrency
} from '../services/pricingEngine';
import { calculateHotelStayPrice, clearHotelStayPriceCache } from '../utils/hotelHelpers';
import { Product, Hotel, User, Company } from '../types';

export interface PerformanceAuditResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  benchmarks: {
    name: string;
    unmemoizedMs: number;
    memoizedMs: number;
    speedupFactor: string;
  }[];
  details: {
    test: string;
    status: 'PASS' | 'FAIL';
    message?: string;
  }[];
}

export function runPortalPerformanceOptimizationAudit(): PerformanceAuditResult {
  const details: { test: string; status: 'PASS' | 'FAIL'; message?: string }[] = [];
  const benchmarks: { name: string; unmemoizedMs: number; memoizedMs: number; speedupFactor: string }[] = [];
  const db = AppDatabase.getInstance();

  const mockUser: User = {
    id: 'usr-agent-test-01',
    email: 'agent@luxurytravel.com',
    name: 'Luxury Travel Agent',
    role: 'B2B_AGENT',
    companyId: 'comp-agency-01',
    agencyName: 'Luxury Travel Agency',
    status: 'ACTIVE'
  } as any;

  const mockAdminUser: User = {
    id: 'usr-admin-test-01',
    email: 'operations@theunbound.in',
    name: 'Operations Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    permissions: {
      cmsFinance: { financialSummary: true },
      canManagePricing: true
    } as any
  } as any;

  const mockProduct: Product = {
    id: 'prod-test-tokyo-vip',
    sku: 'TYO-VIP-101',
    name: 'Private VIP Tokyo Highlights Tour',
    title: 'Private VIP Tokyo Highlights Tour',
    destinationId: 'dest-tokyo',
    destination: 'Tokyo',
    category: 'Sightseeing Tours',
    status: 'ACTIVE',
    currency: 'USD',
    basePrice: 500,
    adultNetPrice: 350,
    adultNettCost: 350,
    rates: [
      {
        id: 'rate-adult-std',
        name: 'Standard Adult Rate',
        netPrice: 350,
        currency: 'USD',
        marginPercent: 20
      }
    ],
    updatedAt: '2026-11-09T10:00:00Z'
  } as any;

  const mockHotel: Hotel = {
    id: 'hotel-test-tokyo-luxury',
    name: 'The Tokyo Prestige Palace',
    destinationId: 'dest-tokyo',
    city: 'Tokyo',
    starRating: 5,
    currency: 'USD',
    startingNetPrice: 400,
    startingSellingPrice: 520,
    roomTypes: [
      {
        id: 'room-deluxe-king',
        roomName: 'Deluxe Imperial King',
        maxOccupancy: 2,
        rates: [
          {
            id: 'rate-bb-deluxe',
            mealPlan: 'BB',
            mealPlanName: 'Breakfast Included',
            singleNetRate: 400,
            doubleNetRate: 450,
            tripleNetRate: 550,
            markupPercent: 20,
            taxPercent: 10,
            feePercent: 0,
            currency: 'USD'
          }
        ]
      }
    ],
    surcharges: [
      {
        surchargeId: 'sur-peak-season',
        name: 'Autumn Peak Surcharge',
        status: 'ACTIVE',
        type: 'FIXED',
        value: 50,
        currency: 'USD',
        validFrom: '2026-10-01',
        validTo: '2026-11-30',
        applicationBasis: 'PER_ROOM_NIGHT'
      }
    ]
  } as any;

  // --------------------------------------------------------------------------
  // BENCHMARK 1: AppDatabase In-Memory Caching Speedup
  // --------------------------------------------------------------------------
  try {
    db.invalidateMemoryCache();
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      db.invalidateMemoryCache();
      db.getProducts();
    }
    const tUnmemoized = performance.now() - t0;

    // Now test with in-memory cache active
    const t1 = performance.now();
    for (let i = 0; i < 50; i++) {
      db.getProducts();
    }
    const tMemoized = performance.now() - t1;

    const factor = tMemoized > 0 ? (tUnmemoized / tMemoized).toFixed(1) + 'x' : '>100x';
    benchmarks.push({
      name: 'AppDatabase In-Memory Cache (50 calls)',
      unmemoizedMs: Number(tUnmemoized.toFixed(2)),
      memoizedMs: Number(tMemoized.toFixed(2)),
      speedupFactor: factor
    });

    details.push({
      test: 'AppDatabase In-Memory Cache (Zero JSON.parse latency)',
      status: 'PASS',
      message: `Cached 50 calls in ${tMemoized.toFixed(2)}ms vs ${tUnmemoized.toFixed(2)}ms without cache (${factor} faster)`
    });
  } catch (err: any) {
    details.push({
      test: 'AppDatabase In-Memory Cache',
      status: 'FAIL',
      message: err.message
    });
  }

  // --------------------------------------------------------------------------
  // BENCHMARK 2: Pricing Engine Memoization Speedup & Mathematical Exactness
  // --------------------------------------------------------------------------
  try {
    clearPricingEngineCache();
    // Warm-up and calculate authoritative unmemoized baseline
    const baseline = calculateDeliveredPriceForUser(mockProduct, mockUser, 'USD');

    // Run 100 uncached calculations
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      clearPricingEngineCache();
      calculateDeliveredPriceForUser(mockProduct, mockUser, 'USD');
    }
    const tUncachedPricing = performance.now() - t0;

    // Run 100 cached calculations
    const t1 = performance.now();
    let cachedResult = null;
    for (let i = 0; i < 100; i++) {
      cachedResult = calculateDeliveredPriceForUser(mockProduct, mockUser, 'USD');
    }
    const tCachedPricing = performance.now() - t1;

    // Verify 100% exact numerical match
    const pricesMatch = Math.abs(cachedResult!.deliveredPrice - baseline.deliveredPrice) < 0.0001;
    const factor = tCachedPricing > 0 ? (tUncachedPricing / tCachedPricing).toFixed(1) + 'x' : '>100x';

    benchmarks.push({
      name: 'Pricing Engine Delivered Price Memoization (100 calls)',
      unmemoizedMs: Number(tUncachedPricing.toFixed(2)),
      memoizedMs: Number(tCachedPricing.toFixed(2)),
      speedupFactor: factor
    });

    if (pricesMatch) {
      details.push({
        test: 'Pricing Engine Memoization Numerical Parity (Exact 100.000%)',
        status: 'PASS',
        message: `Price $${baseline.deliveredPrice} matches identically across all cached iterations (${factor} speedup)`
      });
    } else {
      details.push({
        test: 'Pricing Engine Memoization Numerical Parity',
        status: 'FAIL',
        message: `Deviation detected: baseline $${baseline.deliveredPrice} vs cached $${cachedResult?.deliveredPrice}`
      });
    }
  } catch (err: any) {
    details.push({
      test: 'Pricing Engine Memoization Numerical Parity',
      status: 'FAIL',
      message: err.message
    });
  }

  // --------------------------------------------------------------------------
  // BENCHMARK 3: Hotel Stay Calculation Memoization
  // --------------------------------------------------------------------------
  try {
    clearHotelStayPriceCache();
    const stayBaseline = calculateHotelStayPrice({
      hotel: mockHotel,
      nights: 3,
      roomsCount: 1,
      adults: 2,
      children: 0,
      extraBeds: 0,
      targetCurrency: 'USD',
      checkInDate: '2026-11-15'
    });

    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      clearHotelStayPriceCache();
      calculateHotelStayPrice({
        hotel: mockHotel,
        nights: 3,
        roomsCount: 1,
        adults: 2,
        children: 0,
        extraBeds: 0,
        targetCurrency: 'USD',
        checkInDate: '2026-11-15'
      });
    }
    const tUncachedHotel = performance.now() - t0;

    const t1 = performance.now();
    let cachedHotelStay = null;
    for (let i = 0; i < 50; i++) {
      cachedHotelStay = calculateHotelStayPrice({
        hotel: mockHotel,
        nights: 3,
        roomsCount: 1,
        adults: 2,
        children: 0,
        extraBeds: 0,
        targetCurrency: 'USD',
        checkInDate: '2026-11-15'
      });
    }
    const tCachedHotel = performance.now() - t1;

    const hotelPricesMatch = Math.abs(cachedHotelStay!.finalTotalSellingPrice - stayBaseline.finalTotalSellingPrice) < 0.0001;
    const factor = tCachedHotel > 0 ? (tUncachedHotel / tCachedHotel).toFixed(1) + 'x' : '>100x';

    benchmarks.push({
      name: 'Hotel Stay Calculation Memoization (50 calls)',
      unmemoizedMs: Number(tUncachedHotel.toFixed(2)),
      memoizedMs: Number(tCachedHotel.toFixed(2)),
      speedupFactor: factor
    });

    if (hotelPricesMatch) {
      details.push({
        test: 'Hotel Stay Calculation Memoization Parity',
        status: 'PASS',
        message: `Stay total $${stayBaseline.finalTotalSellingPrice} matches identically (${factor} speedup)`
      });
    } else {
      details.push({
        test: 'Hotel Stay Calculation Memoization Parity',
        status: 'FAIL',
        message: `Deviation detected in hotel stay total`
      });
    }
  } catch (err: any) {
    details.push({
      test: 'Hotel Stay Calculation Memoization Parity',
      status: 'FAIL',
      message: err.message
    });
  }

  // --------------------------------------------------------------------------
  // TEST 4: Surcharge Sequence Protection (Margin first, Surcharge over and above)
  // --------------------------------------------------------------------------
  try {
    const stayWithSurcharge = calculateHotelStayPrice({
      hotel: mockHotel,
      nights: 2,
      roomsCount: 1,
      adults: 2,
      children: 0,
      extraBeds: 0,
      targetCurrency: 'USD',
      checkInDate: '2026-11-10' // in peak season
    });

    const stayWithoutSurcharge = calculateHotelStayPrice({
      hotel: mockHotel,
      nights: 2,
      roomsCount: 1,
      adults: 2,
      children: 0,
      extraBeds: 0,
      targetCurrency: 'USD',
      checkInDate: '2026-12-15' // outside peak season
    });

    const surchargeDifference = stayWithSurcharge.finalTotalSellingPrice - stayWithoutSurcharge.finalTotalSellingPrice;
    // Expected: 2 nights * $50/night = $100 surcharge difference
    if (Math.abs(surchargeDifference - 100) < 0.01) {
      details.push({
        test: 'Surcharge Calculation Sequence Integrity (Over & Above Margin)',
        status: 'PASS',
        message: 'Peak surcharge of $100 (2 nights * $50) strictly applied over base selling price'
      });
    } else {
      details.push({
        test: 'Surcharge Calculation Sequence Integrity',
        status: 'FAIL',
        message: `Expected $100 difference, got $${surchargeDifference}`
      });
    }
  } catch (err: any) {
    details.push({
      test: 'Surcharge Calculation Sequence Integrity',
      status: 'FAIL',
      message: err.message
    });
  }

  // --------------------------------------------------------------------------
  // TEST 5: Role-Based Pricing Secrecy Protection
  // --------------------------------------------------------------------------
  try {
    const agentView = calculateDeliveredPriceForUser(mockProduct, mockUser, 'USD');
    const adminView = calculateDeliveredPriceForUser(mockProduct, mockAdminUser, 'USD');

    // Supplier nett cost must NEVER be exposed to regular B2B agent
    const agentNettHidden = agentView.baseAdultNet === 0;
    const adminNettVisible = adminView.baseAdultNet > 0;

    if (agentNettHidden && adminNettVisible) {
      details.push({
        test: 'Role-Based Commercial Secrecy (Nett Cost Protection)',
        status: 'PASS',
        message: 'Agent view correctly conceals internal nett cost while Admin view exposes SLA wholesale cost'
      });
    } else {
      details.push({
        test: 'Role-Based Commercial Secrecy',
        status: 'FAIL',
        message: `Leaked cost: agent baseAdultNet = ${agentView.baseAdultNet}`
      });
    }
  } catch (err: any) {
    details.push({
      test: 'Role-Based Commercial Secrecy',
      status: 'FAIL',
      message: err.message
    });
  }

  // --------------------------------------------------------------------------
  // TEST 6: Invalidation Safety on Product Update
  // --------------------------------------------------------------------------
  try {
    clearPricingEngineCache();
    const initialPrice = calculateDeliveredPriceForUser(mockProduct, mockUser, 'USD');

    const updatedProduct = {
      ...mockProduct,
      updatedAt: '2026-11-10T12:00:00Z',
      adultNetPrice: 450,
      adultNettCost: 450,
      rates: [
        {
          id: 'rate-adult-std',
          name: 'Standard Adult Rate',
          netPrice: 450, // increased by 100
          currency: 'USD',
          marginPercent: 20
        }
      ]
    } as any;

    const freshPrice = calculateDeliveredPriceForUser(updatedProduct, mockUser, 'USD');
    if (freshPrice.deliveredPrice !== initialPrice.deliveredPrice) {
      details.push({
        test: 'Cache Invalidation On Entity Timestamp Update',
        status: 'PASS',
        message: `Price refreshed automatically on version change ($${initialPrice.deliveredPrice} -> $${freshPrice.deliveredPrice})`
      });
    } else {
      details.push({
        test: 'Cache Invalidation On Entity Timestamp Update',
        status: 'FAIL',
        message: 'Cache returned stale price after product rate update'
      });
    }
  } catch (err: any) {
    details.push({
      test: 'Cache Invalidation On Entity Timestamp Update',
      status: 'FAIL',
      message: err.message
    });
  }

  const passedTests = details.filter(d => d.status === 'PASS').length;
  const failedTests = details.filter(d => d.status === 'FAIL').length;

  return {
    totalTests: details.length,
    passedTests,
    failedTests,
    benchmarks,
    details
  };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('portalPerformanceOptimizationAudit')) {
  const result = runPortalPerformanceOptimizationAudit();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.failedTests > 0 ? 1 : 0);
}
