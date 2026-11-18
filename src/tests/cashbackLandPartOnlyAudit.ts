import assert from 'node:assert/strict';

// Lightweight browser shims for headless Node / tsx execution
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    }
  };
}
if (typeof (globalThis as any).sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = (globalThis as any).localStorage;
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    location: { origin: 'http://localhost:3000', hostname: 'localhost' },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

import { AppDatabase } from '../services/db';
import { cashbackService } from '../services/cashbackService';
import { calculateEligibleBookingComponents } from '../services/cashbackEngine';
import { Booking, BookingItem, CurrencyCode, Quotation, User } from '../types';

function makeAdmin(id = 'ADM-FIN-LAND', email = 'business@theunbound.in', name = 'Finance Director'): User {
  return {
    id,
    name,
    email,
    role: 'ADMIN',
    approvalStatus: 'APPROVED',
    permissions: {
      canAccessFinancials: true,
      canApproveUsers: true,
      cmsFinance: {
        analytics: true,
        financials: true,
        financialPolicies: true,
        marginCommissionGovernance: true,
        cashbackManagement: true,
        voucherBuilder: true,
        systemLogs: true
      }
    }
  } as unknown as User;
}

function makeAgent(id: string, name: string, agencyId = 'AGY-LAND-01'): User {
  return {
    id,
    name,
    email: `${id.toLowerCase()}@partner.test`,
    role: 'B2B_AGENT',
    approvalStatus: 'APPROVED',
    agencyId,
    agencyName: 'Aurora Land Journeys'
  } as unknown as User;
}

function makeBookingItem(params: {
  id: string;
  title: string;
  category: string;
  totalPrice: number;
  productType?: string;
  service_type?: string;
  itemType?: string;
  hotelId?: string;
  isHotel?: boolean;
  isManualHotel?: boolean;
  accommodationType?: BookingItem['accommodationType'];
  isCancelled?: boolean;
  currency?: CurrencyCode;
}): BookingItem {
  return {
    id: params.id,
    productId: `prod-${params.id}`,
    productName: params.title,
    title: params.title,
    destination: 'Japan',
    destinationName: 'Japan',
    category: params.category,
    productType: params.productType,
    service_type: params.service_type,
    itemType: params.itemType,
    hotelId: params.hotelId,
    isHotel: params.isHotel,
    isManualHotel: params.isManualHotel,
    accommodationType: params.accommodationType,
    isCancelled: params.isCancelled,
    travelDate: '2026-12-01',
    adults: 2,
    children: 0,
    infants: 0,
    totalPax: 2,
    unitSellingPrice: params.totalPrice,
    totalPrice: params.totalPrice,
    currency: params.currency || 'INR'
  };
}

function resetStore(users: User[]) {
  (globalThis as any).localStorage.clear();
  const db = AppDatabase.getInstance();
  db.setCashbackStore('bookings', []);
  db.setCashbackStore('saved_quotes', []);
  db.setCashbackStore('cashback_user_configs', []);
  db.setCashbackStore('cashback_config_history', []);
  db.setCashbackStore('cashback_wallets', []);
  db.setCashbackStore('cashback_ledger_transactions', []);
  db.setCashbackStore('booking_cashback_records', []);
  db.setCashbackStore('user_bank_accounts', []);
  db.setCashbackStore('cashbackWithdrawalRequests', []);
  db.setCashbackStore('cashback_audit_logs', []);
  db.setCashbackStore('cashback_notifications', []);
  db.setCashbackStore('cashback_policy', null);
  db.setCashbackStore('users', users);
}

async function runTests() {
  const db = AppDatabase.getInstance();
  cashbackService.attachToDatabase(db);

  const admin = makeAdmin();
  const agent2 = makeAgent('AGT-2PCT', 'Agent Two Percent');
  const agent5 = makeAgent('AGT-5PCT', 'Agent Five Percent');
  const agent1 = makeAgent('AGT-1PCT', 'Agent One Percent');

  resetStore([admin, agent2, agent5, agent1]);

  // Verify mandatory policy lock: attempting to enable hotels still clamps hotels = false
  const attemptedPolicy = cashbackService.updatePolicy(
    {
      eligibleComponents: {
        baseProductSellPrice: true,
        hotels: true,
        transfers: true,
        activities: true,
        tours: true,
        visas: true,
        packages: true,
        includeTaxes: false,
        includeServiceFees: false,
        includeSurcharges: false,
        deductDiscounts: true
      }
    },
    admin
  );
  assert.equal(attemptedPolicy.eligibleComponents.hotels, false, 'Policy Lock: hotels must always remain excluded (false)');

  cashbackService.configureUserCashback({
    targetUserId: agent2.id,
    isEligible: true,
    cashbackPercent: 2,
    status: 'ACTIVE',
    actor: admin
  });
  cashbackService.configureUserCashback({
    targetUserId: agent5.id,
    isEligible: true,
    cashbackPercent: 5,
    status: 'ACTIVE',
    actor: admin
  });
  cashbackService.configureUserCashback({
    targetUserId: agent1.id,
    isEligible: true,
    cashbackPercent: 1,
    status: 'ACTIVE',
    actor: admin
  });

  // ---------------------------------------------------------------------------
  // TEST A: Hotel 150,000 + Land 100,000 @ 2% = 2,000
  // ---------------------------------------------------------------------------
  const bkA = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Client A', email: 'a@test.com', phone: '+91-90001' },
      items: [
        makeBookingItem({ id: 'a-hotel', title: 'Park Hyatt Tokyo', category: 'HOTEL', totalPrice: 150000, isHotel: true }),
        makeBookingItem({ id: 'a-land', title: 'Mount Fuji Private Tour', category: 'TOUR', totalPrice: 100000 })
      ],
      currency: 'INR',
      totalAmount: 250000,
      hotelAccommodationTotal: 150000,
      landPartTotal: 100000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    agent2
  );
  db.updateBookingStatus(bkA.id, 'CONFIRMED', admin);
  const recA = cashbackService.getBookingCashbackRecordsForUser(agent2.id).find((r) => r.bookingId === bkA.id)!;
  assert.equal(recA.hotelAccommodationTotal, 150000, 'Test A: Hotel total stored = 150,000');
  assert.equal(recA.landPartTotal, 100000, 'Test A: Land part total stored = 100,000');
  assert.equal(recA.eligibleAmount, 100000, 'Test A: Eligible amount equals Land Part Total');
  assert.equal(recA.cashbackAmount, 2000, 'Test A: 2% of 100,000 Land Part = 2,000');
  console.log('PASS Test A: Hotel ₹150k + Land ₹100k @ 2% => ₹2,000.');

  // ---------------------------------------------------------------------------
  // TEST B: Hotel 200,000 + Land 80,000 @ 5% = 4,000
  // ---------------------------------------------------------------------------
  const bkB = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Client B', email: 'b@test.com', phone: '+91-90002' },
      items: [
        makeBookingItem({ id: 'b-hotel', title: 'Aman Kyoto Stay', category: 'RESORT', totalPrice: 200000, isHotel: true }),
        makeBookingItem({ id: 'b-land', title: 'Kyoto Cultural & Rail Pass', category: 'ACTIVITY', totalPrice: 80000 })
      ],
      currency: 'INR',
      totalAmount: 280000,
      hotelAccommodationTotal: 200000,
      landPartTotal: 80000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    agent5
  );
  db.updateBookingStatus(bkB.id, 'CONFIRMED', admin);
  const recB = cashbackService.getBookingCashbackRecordsForUser(agent5.id).find((r) => r.bookingId === bkB.id)!;
  assert.equal(recB.eligibleAmount, 80000, 'Test B: Eligible amount equals Land Part Total 80,000');
  assert.equal(recB.cashbackAmount, 4000, 'Test B: 5% of 80,000 Land Part = 4,000');
  console.log('PASS Test B: Hotel ₹200k + Land ₹80k @ 5% => ₹4,000.');

  // ---------------------------------------------------------------------------
  // TEST C: Hotel 0 + Land 50,000 @ 1% = 500
  // ---------------------------------------------------------------------------
  const bkC = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Client C', email: 'c@test.com', phone: '+91-90003' },
      items: [
        makeBookingItem({ id: 'c-land', title: 'Airport Chauffeur & Guide', category: 'TRANSFER', totalPrice: 50000 })
      ],
      currency: 'INR',
      totalAmount: 50000,
      hotelAccommodationTotal: 0,
      landPartTotal: 50000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    agent1
  );
  db.updateBookingStatus(bkC.id, 'CONFIRMED', admin);
  const recC = cashbackService.getBookingCashbackRecordsForUser(agent1.id).find((r) => r.bookingId === bkC.id)!;
  assert.equal(recC.hotelAccommodationTotal, 0);
  assert.equal(recC.landPartTotal, 50000);
  assert.equal(recC.cashbackAmount, 500, 'Test C: 1% of 50,000 Land-only = 500');
  console.log('PASS Test C: Hotel ₹0 + Land ₹50k @ 1% => ₹500.');

  // ---------------------------------------------------------------------------
  // TEST D: Hotel-Only Booking (Hotel 100,000 + Land 0 @ 5% => ₹0, NOT_ELIGIBLE)
  // ---------------------------------------------------------------------------
  const agentHotelOnly = makeAgent('AGT-HOTELONLY', 'Hotel Only Agent');
  resetStore([admin, agent2, agent5, agent1, agentHotelOnly]);
  cashbackService.configureUserCashback({
    targetUserId: agentHotelOnly.id,
    isEligible: true,
    cashbackPercent: 5,
    status: 'ACTIVE',
    actor: admin
  });

  const bkD = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Client D', email: 'd@test.com', phone: '+91-90004' },
      items: [
        makeBookingItem({
          id: 'd-hotel',
          title: 'Ritz-Carlton Tokyo Room Only',
          category: 'HOTEL',
          totalPrice: 100000,
          isHotel: true
        })
      ],
      currency: 'INR',
      totalAmount: 100000,
      hotelAccommodationTotal: 100000,
      landPartTotal: 0,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    agentHotelOnly
  );
  db.updateBookingStatus(bkD.id, 'CONFIRMED', admin);
  const recD = cashbackService.getBookingCashbackRecordsForUser(agentHotelOnly.id).find((r) => r.bookingId === bkD.id)!;
  assert.equal(recD.status, 'NOT_ELIGIBLE', 'Test D: Hotel-only booking gets explicit NOT_ELIGIBLE audit record');
  assert.equal(recD.eligibleAmount, 0, 'Test D: Eligible amount = 0');
  assert.equal(recD.cashbackAmount, 0, 'Test D: Cashback amount = 0');
  assert.equal(recD.remainingCashbackAmount, 0);
  const walletD = cashbackService.getWalletForUser(agentHotelOnly.id);
  assert.equal(walletD.pendingCashback, 0, 'Test D: Wallet pending remains 0');
  assert.equal(walletD.availableBalance, 0, 'Test D: Wallet available remains 0');
  const postD = cashbackService.runScheduledAutoCreditBatch({ nowIsoOverride: '2026-12-20T00:00:00.000Z', source: 'SCHEDULER' });
  assert.equal(postD.creditedCount, 0, 'Test D: Scheduler must NEVER credit hotel-only booking');
  console.log('PASS Test D: Hotel-only booking records NOT_ELIGIBLE with ₹0 cashback.');

  // ---------------------------------------------------------------------------
  // TEST E: Renamed Accommodation Classification Guard & Mixed Categories
  // ---------------------------------------------------------------------------
  const mixedBooking: Partial<Booking> = {
    id: 'BK-MIXED-RENAME',
    bookingReference: 'TUB-MIX-01',
    sourceType: 'QUOTATION',
    customer: { leadTravelerName: 'Mixed Client', email: 'mix@test.com', phone: '+91' },
    items: [
      // Renamed hotel disguised as "Luxury Tour Package" in productName, but carrying authoritative productType & hotelId
      makeBookingItem({
        id: 'm1',
        title: 'Luxury Tour Package',
        category: 'Ground Package',
        productType: 'HOTEL',
        hotelId: 'HTL-991',
        totalPrice: 120000
      }),
      // Renamed manual hotel with isManualHotel flag
      makeBookingItem({
        id: 'm2',
        title: 'Exclusive Activity & Dining Experience',
        category: 'Experience',
        isManualHotel: true,
        totalPrice: 30000
      }),
      // Authoritative Ryokan category disguised in title
      makeBookingItem({
        id: 'm3',
        title: 'Hakone Mountain Sightseeing',
        category: 'RYOKAN',
        totalPrice: 50000
      }),
      // Eligible Land Part services: Tour + Transfer + Rail + Activity + Guide
      makeBookingItem({ id: 'm4', title: 'Private Chauffeur Transfer', category: 'TRANSFER', totalPrice: 25000 }),
      makeBookingItem({ id: 'm5', title: 'Shinkansen Green Car Rail Pass', category: 'RAIL', totalPrice: 35000 }),
      makeBookingItem({ id: 'm6', title: 'Tea Ceremony & Cultural Activity', category: 'ACTIVITY', totalPrice: 20000 }),
      makeBookingItem({ id: 'm7', title: 'Licensed Local Guide', category: 'GUIDE', totalPrice: 20000 })
    ],
    currency: 'INR',
    totalAmount: 300000,
    hotelAccommodationTotal: 200000,
    landPartTotal: 100000
  };
  const compMixed = calculateEligibleBookingComponents(mixedBooking, attemptedPolicy);
  assert.equal(compMixed.verificationStatus, 'VERIFIED', 'Test E: Breakdown reconciles cleanly');
  assert.equal(compMixed.hotelAccommodationTotal, 200000, 'Test E: All 3 accommodation items excluded despite misleading titles');
  assert.equal(compMixed.landPartTotal, 100000, 'Test E: All 4 land items summed = 100,000');
  assert.equal(compMixed.eligibleAmount, 100000);
  assert.equal(compMixed.breakdown.excludedAccommodationItems?.length, 3);
  assert.equal(compMixed.breakdown.landPartLineItems?.length, 4);
  console.log('PASS Test E: Renamed hotels excluded via authoritative fields; mixed Land services reconciled.');

  // ---------------------------------------------------------------------------
  // TEST F: End-to-End Lifecycle (Hotel-Only Refund, Partial Land Refund,
  //         Hotel-Only Amendment, Land Amendment, Hotel Item Cancellation,
  //         Quote Conversion, Missing/Contradictory UNVERIFIED_HOLD Guard)
  // ---------------------------------------------------------------------------
  resetStore([admin, agent2, agent5]);
  cashbackService.configureUserCashback({
    targetUserId: agent5.id,
    isEligible: true,
    cashbackPercent: 5,
    status: 'ACTIVE',
    actor: admin
  });

  // F1: Quote conversion (convertQuotationToBooking) preserves hotelAccommodationTotal, landPartTotal & creates cashback
  const quote: Quotation = {
    id: 'QT-LAND-1',
    quoteNumber: 'QT-2026-LAND-01',
    agentId: agent5.id,
    agentName: agent5.name,
    agentAgency: agent5.agencyName,
    createdBy: agent5.id,
    clientName: 'Quote Client',
    clientEmail: 'q@test.com',
    destination: 'Japan',
    travelStartDate: '2026-12-01',
    travelEndDate: '2026-12-10',
    currency: 'INR',
    totalSellingPrice: 250000,
    hotelAccommodationTotal: 150000,
    landPartTotal: 100000,
    status: 'SENT',
    items: [
      {
        id: 'qi-1',
        travelDate: '2026-12-01',
        pax: { adults: 2, children: 0, infants: 0 },
        finalCustomerSellingPrice: 150000,
        product: {
          id: 'prod-htl-1',
          name: 'Tokyo Luxury Stay',
          category: 'Hotel',
          productType: 'HOTEL',
          hotelId: 'HTL-1',
          destinationName: 'Japan',
          city: 'Tokyo',
          sku: 'HTL-TOK-1'
        } as any
      } as any,
      {
        id: 'qi-2',
        travelDate: '2026-12-02',
        pax: { adults: 2, children: 0, infants: 0 },
        finalCustomerSellingPrice: 100000,
        product: {
          id: 'prod-tour-1',
          name: 'Kyoto & Nara Full Day Circuit',
          category: 'Tour',
          productType: 'TOUR',
          destinationName: 'Japan',
          city: 'Kyoto',
          sku: 'TUR-KYO-1'
        } as any
      } as any
    ]
  } as unknown as Quotation;

  const convertedBk = db.convertQuotationToBooking(quote, agent5)!;
  assert.ok(convertedBk, 'Test F1: Quote converted to booking');
  db.updateBookingStatus(convertedBk.id, 'CONFIRMED', admin);
  const recF1 = cashbackService.getBookingCashbackRecordsForUser(agent5.id).find((r) => r.bookingId === convertedBk.id)!;
  assert.equal(recF1.hotelAccommodationTotal, 150000, 'Test F1: Converted booking preserves hotelAccommodationTotal = 150,000');
  assert.equal(recF1.landPartTotal, 100000, 'Test F1: Converted booking preserves landPartTotal = 100,000');
  assert.equal(recF1.cashbackAmount, 5000, 'Test F1: 5% of 100,000 Land Part = 5,000 (150k hotel excluded)');

  // F2: Hotel-only amendment (Hotel increases from 150k -> 220k, Land stays 100k) => cashback unchanged!
  const bkAmendHotel = db.getAllBookings().find((b) => b.id === convertedBk.id)!;
  bkAmendHotel.items[0].totalPrice = 220000;
  bkAmendHotel.hotelAccommodationTotal = 220000;
  bkAmendHotel.totalAmount = 320000;
  bkAmendHotel.finalCustomerSellingPrice = 320000;
  db.saveBooking(bkAmendHotel, admin);
  const recAfterHotelAmend = cashbackService.getBookingCashbackRecordsForUser(agent5.id).find((r) => r.bookingId === convertedBk.id)!;
  assert.equal(recAfterHotelAmend.cashbackAmount, 5000, 'Test F2: Hotel-only amendment leaves cashback unchanged at 5,000');
  assert.ok(
    recAfterHotelAmend.amendmentHistory?.some((a) => a.previousHotelTotal === 150000 && a.newHotelTotal === 220000 && a.newCashbackAmount === 5000),
    'Test F2: Hotel-only amendment logged an audited no-change entry'
  );

  // F3: Credit booking at +3d post-travel (2026-12-13 Asia/Tokyo)
  const credBatch = cashbackService.runScheduledAutoCreditBatch({
    nowIsoOverride: '2026-12-12T15:05:00.000Z',
    source: 'SCHEDULER'
  });
  assert.equal(credBatch.creditedCount, 1, 'Test F3: Credited 5,000 to Agent 5%');
  assert.equal(cashbackService.getWalletForUser(agent5.id).availableBalance, 5000);

  // F4: Hotel-only refund => ZERO reversal; cashback remains 5,000
  db.recordBookingRefund(convertedBk.id, 70000, false, 'Hotel suite downgrade refund', admin, {
    affectedComponent: 'HOTEL',
    hotelRefundAmount: 70000
  });
  assert.equal(cashbackService.getWalletForUser(agent5.id).availableBalance, 5000, 'Test F4: Hotel-only refund causes 0 cashback reversal');

  // F5: Partial Land refund of 40,000 against 100,000 Land Part (NOT against 320,000 booking total!)
  // 40,000 / 100,000 = 40% reversal -> 40% of 5,000 = 2,000 reversed -> balance drops 5,000 -> 3,000
  db.recordBookingRefund(convertedBk.id, 40000, false, 'Cancelled optional Kyoto excursion', admin, {
    affectedComponent: 'LAND',
    landRefundAmount: 40000
  });
  assert.equal(
    cashbackService.getWalletForUser(agent5.id).availableBalance,
    3000,
    'Test F5: Partial Land refund divides strictly by landPartTotal (40k/100k = 40% -> 2,000 reversed)'
  );
  const txsF5 = cashbackService.getLedgerTransactionsForUser(agent5.id);
  assert.ok(txsF5.some((t) => t.type === 'CASHBACK_REVERSAL' && t.amount === 2000), 'Test F5: CASHBACK_REVERSAL = 2,000 posted');

  // F6: Missing / contradictory breakdown fails closed to UNVERIFIED_HOLD (status = 'HELD'), never falls back to totalAmount
  const bkCorrupt = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Corrupt Client', email: 'corrupt@test.com', phone: '+91-90099' },
      items: [], // No itemized services AND no hotel/land totals provided
      currency: 'INR',
      totalAmount: 180000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    agent5
  );
  db.updateBookingStatus(bkCorrupt.id, 'CONFIRMED', admin);
  const recCorrupt = cashbackService.getBookingCashbackRecordsForUser(agent5.id).find((r) => r.bookingId === bkCorrupt.id)!;
  assert.equal(recCorrupt.status, 'HELD', 'Test F6: Missing Land/Hotel breakdown places record on HELD');
  assert.equal(recCorrupt.verificationStatus, 'UNVERIFIED_HOLD', 'Test F6: Marked UNVERIFIED_HOLD');
  assert.equal(recCorrupt.cashbackAmount, 0, 'Test F6: Never calculates cashback on unverified totalAmount');
  const blockedBatch = cashbackService.runScheduledAutoCreditBatch({
    nowIsoOverride: '2026-12-25T10:00:00.000Z',
    source: 'SCHEDULER'
  });
  assert.equal(blockedBatch.creditedCount, 0, 'Test F6: UNVERIFIED_HOLD booking cannot be auto-credited');

  // F7: Cancelling hotel item inside a mixed pending booking leaves Land cashback intact
  const bkMixedCancel = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Hotel Item Cancel Client', email: 'hc@test.com', phone: '+91-90007' },
      items: [
        makeBookingItem({ id: 'hc-1', title: 'Luxury Ryokan', category: 'HOTEL', totalPrice: 120000, isHotel: true }),
        makeBookingItem({ id: 'hc-2', title: 'Private Alpine Tour', category: 'TOUR', totalPrice: 60000 })
      ],
      currency: 'INR',
      totalAmount: 180000,
      hotelAccommodationTotal: 120000,
      landPartTotal: 60000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    agent5
  );
  db.updateBookingStatus(bkMixedCancel.id, 'CONFIRMED', admin);
  const recBeforeHotelCancel = cashbackService.getBookingCashbackRecordsForUser(agent5.id).find((r) => r.bookingId === bkMixedCancel.id)!;
  assert.equal(recBeforeHotelCancel.cashbackAmount, 3000, 'Test F7: Initial Land cashback = 5% of 60,000 = 3,000');

  const bkLoadedCancelHotel = db.getAllBookings().find((b) => b.id === bkMixedCancel.id)!;
  bkLoadedCancelHotel.items[0].isCancelled = true;
  bkLoadedCancelHotel.hotelAccommodationTotal = 0;
  bkLoadedCancelHotel.totalAmount = 60000;
  bkLoadedCancelHotel.finalCustomerSellingPrice = 60000;
  db.saveBooking(bkLoadedCancelHotel, admin);
  const recAfterHotelCancel = cashbackService.getBookingCashbackRecordsForUser(agent5.id).find((r) => r.bookingId === bkMixedCancel.id)!;
  assert.equal(recAfterHotelCancel.cashbackAmount, 3000, 'Test F7: Cancelling hotel item only keeps Land cashback = 3,000');

  // Wallet reconciliation check remains zero discrepancy
  const recon = cashbackService.reconcileAllWallets();
  assert.equal(recon.discrepancyCount, 0, 'Test F8: All wallets reconcile cleanly with immutable ledger');

  console.log('PASS Test F: Amendments, hotel-only/partial-land refunds, quote conversion, UNVERIFIED_HOLD, and ledger reconciliation verified.');
  console.log('\nALL CASHBACK LAND-PART-ONLY AUDIT TESTS (A–F) PASSED.');
}

runTests().catch((err) => {
  console.error('LAND-PART-ONLY AUDIT FAILED:', err);
  process.exit(1);
});
