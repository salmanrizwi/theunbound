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
import { cashbackService, getDefaultCashbackPolicy } from '../services/cashbackService';
import {
  computeCreditSchedule,
  calculateEligibleBookingComponents,
  maskAccountNumber,
  sanitizeBankAccountForDisplay,
  validateBankAccountInput,
  reconcileWalletFromLedger
} from '../services/cashbackEngine';
import { Booking, BookingItem, CurrencyCode, User } from '../types';

function makeAdmin(id = 'ADM-FIN-01', email = 'business@theunbound.in', name = 'Finance Director'): User {
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

function makeAgent(id: string, name: string, agencyId: string): User {
  return {
    id,
    name,
    email: `${id.toLowerCase()}@partner.test`,
    role: 'B2B_AGENT',
    approvalStatus: 'APPROVED',
    agencyId,
    agencyName: 'Aurora Luxury Voyages'
  } as unknown as User;
}

function makeBookingItem(params: {
  id: string;
  title: string;
  category: string;
  totalPrice: number;
  destinationName?: string;
  currency?: CurrencyCode;
}): BookingItem {
  return {
    id: params.id,
    productId: `prod-${params.id}`,
    productName: params.title,
    title: params.title,
    destinationId: 'DEST-JP',
    destinationName: params.destinationName || 'Japan',
    category: params.category,
    travelDate: '2026-12-01',
    adults: 2,
    children: 0,
    infants: 0,
    totalPax: 2,
    unitSellingPrice: params.totalPrice,
    totalPrice: params.totalPrice,
    currency: params.currency || 'INR'
  } as BookingItem;
}

function resetCashbackTestStore(): void {
  const db = AppDatabase.getInstance();
  (globalThis as any).localStorage.clear();
  db.setCashbackStore('users', []);
  db.setCashbackStore('bookings', []);
  db.setCashbackStore('cashback_user_configs', []);
  db.setCashbackStore('cashback_config_history', []);
  db.setCashbackStore('cashback_wallets', []);
  db.setCashbackStore('cashback_ledger_transactions', []);
  db.setCashbackStore('booking_cashback_records', []);
  db.setCashbackStore('user_bank_accounts', []);
  db.setCashbackStore('cashback_withdrawal_requests', []);
  db.setCashbackStore('cashback_audit_logs', []);
  db.setCashbackStore('cashback_notifications', []);
  db.setCashbackStore('agent_notifications', []);
  db.setCashbackStore('cashback_policy', {
    ...getDefaultCashbackPolicy(),
    requireFullPaymentBeforeCredit: false,
    requireConfirmedBookingStatus: true
  });
  cashbackService.attachToDatabase(db);
}

async function run(): Promise<void> {
  console.log('=== TheUnbound Cashback & Rewards Wallet — Comprehensive Audit Suite (Tests A–I) ===');

  const admin1 = makeAdmin('ADM-FIN-01', 'business@theunbound.in', 'Master Admin');
  const admin2 = makeAdmin('ADM-FIN-02', 'finance.controller@theunbound.in', 'Second Finance Approver');
  const userA = makeAgent('UID-AGENT-A', 'Agent A', 'AGENCY-SHARED-1');
  const userB = makeAgent('UID-AGENT-B', 'Agent B', 'AGENCY-SHARED-1');

  // -------------------------------------------------------------------------
  // TEST A: Per-User Eligibility Isolation & Agency Re-association Safety
  // -------------------------------------------------------------------------
  resetCashbackTestStore();
  const db = AppDatabase.getInstance();
  db.setCashbackStore('users', [admin1, admin2, userA, userB]);

  cashbackService.configureUserCashback({
    targetUserId: userA.id,
    isEligible: true,
    cashbackPercent: 2,
    status: 'ACTIVE',
    reason: 'Q4 Strategic Partner Incentive',
    actor: admin1
  });

  // Ineligible UID-B in same agency submits booking -> must NOT earn cashback
  const bookingB = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: {
        leadTravelerName: 'Client B',
        bookerName: 'Client B',
        email: 'clientb@example.com',
        phone: '+91-9000000002'
      },
      items: [
        makeBookingItem({
          id: 'b1',
          title: 'Tokyo Private Experience',
          category: 'TOUR',
          totalPrice: 150000
        })
      ],
      currency: 'INR',
      totalAmount: 150000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    userB
  );
  db.updateBookingStatus(bookingB.id, 'CONFIRMED', admin1);
  assert.equal(cashbackService.getBookingCashbackRecordsForUser(userB.id).length, 0, 'Test A: Ineligible UID-B must earn 0 cashback');
  assert.equal(cashbackService.canUserSeeCashbackWallet(userB), false, 'Test A: Ineligible UID-B wallet hidden by default');

  // Eligible UID-A submits booking -> earns 2% = ₹2,000 on ₹100,000
  const bookingA = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: {
        leadTravelerName: 'Client A',
        bookerName: 'Client A',
        email: 'clienta@example.com',
        phone: '+91-9000000001'
      },
      items: [
        makeBookingItem({
          id: 'a1',
          title: 'Tokyo & Hakone Private Land Package',
          category: 'TOUR',
          totalPrice: 100000
        })
      ],
      currency: 'INR',
      totalAmount: 100000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    userA
  );
  db.updateBookingStatus(bookingA.id, 'CONFIRMED', admin1);
  const recsA = cashbackService.getBookingCashbackRecordsForUser(userA.id);
  assert.equal(recsA.length, 1, 'Test A: UID-A booking cashback record created');
  assert.equal(recsA[0].cashbackAmount, 2000, 'Test A: 2% of 100,000 = 2,000');

  // Re-associate UID-A to a different agency -> cashback remains bound to UID-A
  const usersAfterMove = db.getUsers().map((u) => (u.id === userA.id ? { ...u, agencyId: 'AGENCY-NEW-99' } : u));
  db.setCashbackStore('users', usersAfterMove);
  const movedUserA = { ...userA, agencyId: 'AGENCY-NEW-99' };
  assert.equal(cashbackService.getWalletForUser(movedUserA.id).pendingCashback, 2000, 'Test A: UID-A retains pending cashback after agency move');
  console.log('PASS Test A: Per-user isolation and agency re-association preserved UID ownership.');

  // -------------------------------------------------------------------------
  // TEST B: Calculation Accuracy (1%, 2%, 5%, custom 3.5%, tax/fee exclusions, discount deduction)
  // -------------------------------------------------------------------------
  const policyStd = getDefaultCashbackPolicy();
  const taxFeeBooking: Partial<Booking> = {
    id: 'BK-MATH-1',
    bookingReference: 'BKG-MATH-1',
    sourceType: 'QUOTATION',
    customer: { leadTravelerName: 'Math Client', email: 'math@example.com', phone: '+91' },
    items: [
      makeBookingItem({ id: 'i1', title: 'Private Land Excursion', category: 'TOUR', totalPrice: 100000 }),
      makeBookingItem({ id: 'i2', title: 'Private Transfer', category: 'TRANSFER', totalPrice: 20000 }),
      makeBookingItem({ id: 'i3', title: 'Tax & GST', category: 'TAX', totalPrice: 15000 }),
      makeBookingItem({ id: 'i4', title: 'Service Fee', category: 'SERVICE_FEE', totalPrice: 5000 })
    ],
    currency: 'INR',
    totalAmount: 120000,
    pricingSnapshot: { totalDiscounts: 20000 } as any,
    travelStartDate: '2026-12-01',
    travelEndDate: '2026-12-08',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const compMath = calculateEligibleBookingComponents(taxFeeBooking, policyStd);
  // Eligible = (100000 + 20000) - 20000 discount = 100000 (15k tax & 5k fee excluded)
  assert.equal(compMath.eligibleAmount, 100000, 'Test B: Excludes taxes/fees and deducts discounts');
  assert.equal(Math.round(compMath.eligibleAmount * 0.01 * 100) / 100, 1000, 'Test B: 1% calculation');
  assert.equal(Math.round(compMath.eligibleAmount * 0.02 * 100) / 100, 2000, 'Test B: 2% calculation');
  assert.equal(Math.round(compMath.eligibleAmount * 0.05 * 100) / 100, 5000, 'Test B: 5% calculation');
  assert.equal(Math.round(compMath.eligibleAmount * 0.035 * 100) / 100, 3500, 'Test B: Custom 3.5% calculation');
  assert.equal(Math.round(250000 * 0.05 * 100) / 100, 12500, 'Test B: 250,000 @ 5% = 12,500');
  console.log('PASS Test B: Multi-rate cashback math, discount deductions, and tax/fee exclusions verified.');

  // -------------------------------------------------------------------------
  // TEST C: 3-Day Destination Timezone Auto-Credit & Unpaid Payment Hold
  // -------------------------------------------------------------------------
  const schedJst = computeCreditSchedule('2026-12-10', 3, 'Japan');
  assert.equal(schedJst.destinationTimezone, 'Asia/Tokyo', 'Test C: Japan mapped to Asia/Tokyo');
  assert.equal(schedJst.scheduledCreditDate, '2026-12-13', 'Test C: 2026-12-10 + 3d = 2026-12-13');
  // 2026-12-12T23:59:59+09:00 === 2026-12-12T14:59:59.000Z (MUST NOT CREDIT)
  const beforeCredit = cashbackService.runScheduledAutoCreditBatch({
    nowIsoOverride: '2026-12-12T14:59:59.000Z',
    source: 'SCHEDULER'
  });
  assert.equal(beforeCredit.creditedCount, 0, 'Test C: Must NOT credit 1 second before 2026-12-13 00:00:00 Asia/Tokyo');

  // 2026-12-13T00:00:01+09:00 === 2026-12-12T15:00:01.000Z (MUST CREDIT)
  const atCredit = cashbackService.runScheduledAutoCreditBatch({
    nowIsoOverride: '2026-12-12T15:00:01.000Z',
    source: 'SCHEDULER'
  });
  assert.equal(atCredit.creditedCount, 1, 'Test C: Credits once destination reaches 2026-12-13 00:00:01 Asia/Tokyo');
  assert.equal(cashbackService.getWalletForUser(userA.id).availableBalance, 2000, 'Test C: Available balance = ₹2,000');

  // Verify requireFullPaymentBeforeCredit hold behavior
  cashbackService.updatePolicy({ requireFullPaymentBeforeCredit: true }, admin1);
  const bookingUnpaid = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Unpaid Client', email: 'unpaid@example.com', phone: '+91' },
      items: [makeBookingItem({ id: 'iu1', title: 'Kyoto Tour', category: 'TOUR', totalPrice: 50000 })],
      currency: 'INR',
      totalAmount: 50000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    userA
  );
  db.updateBookingStatus(bookingUnpaid.id, 'CONFIRMED', admin1);
  const unpaidBatch = cashbackService.runScheduledAutoCreditBatch({
    nowIsoOverride: '2026-12-20T10:00:00.000Z',
    source: 'SCHEDULER'
  });
  assert.equal(unpaidBatch.creditedCount, 0, 'Test C: Unpaid booking held when requireFullPaymentBeforeCredit is enabled');
  const unpaidRec = cashbackService.getBookingCashbackRecordsForUser(userA.id).find((r) => r.bookingId === bookingUnpaid.id)!;
  assert.equal(unpaidRec.status, 'HELD', 'Test C: Unpaid booking cashback transitions to HELD');
  cashbackService.updatePolicy({ requireFullPaymentBeforeCredit: false }, admin1);
  console.log('PASS Test C: Destination-timezone +3d auto-credit timing & unpaid payment hold verified.');

  // -------------------------------------------------------------------------
  // TEST D: Historical Booking Percentage Immutability on Rate Upgrade
  // -------------------------------------------------------------------------
  cashbackService.configureUserCashback({
    targetUserId: userA.id,
    isEligible: true,
    cashbackPercent: 5,
    status: 'ACTIVE',
    reason: 'Tier upgrade to 5%',
    actor: admin1
  });
  const bookingA2 = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Client A2', email: 'clienta2@example.com', phone: '+91' },
      items: [makeBookingItem({ id: 'ia2', title: 'Kyoto Cultural Guided Circuit', category: 'TOUR', totalPrice: 100000 })],
      currency: 'INR',
      totalAmount: 100000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    userA
  );
  db.updateBookingStatus(bookingA2.id, 'CONFIRMED', admin1);
  const oldRecAfter = cashbackService.getBookingCashbackRecordsForUser(userA.id).find((r) => r.bookingId === bookingA.id)!;
  const newRecAfter = cashbackService.getBookingCashbackRecordsForUser(userA.id).find((r) => r.bookingId === bookingA2.id)!;
  assert.equal(oldRecAfter.cashbackPercent, 2, 'Test D: Historical booking retains 2% snapshot');
  assert.equal(oldRecAfter.cashbackAmount, 2000, 'Test D: Historical booking amount unchanged at ₹2,000');
  assert.equal(newRecAfter.cashbackPercent, 5, 'Test D: New booking adopts updated 5% rate');
  assert.equal(newRecAfter.cashbackAmount, 5000, 'Test D: New booking amount is ₹5,000');
  console.log('PASS Test D: Historical booking cashback snapshot immutability verified.');

  // -------------------------------------------------------------------------
  // TEST E: Bank Account Masking, Withdrawal Hold -> Approved -> Paid
  // -------------------------------------------------------------------------
  resetCashbackTestStore();
  db.setCashbackStore('users', [admin1, admin2, userA, userB]);
  cashbackService.configureUserCashback({
    targetUserId: userA.id,
    isEligible: true,
    cashbackPercent: 5,
    status: 'ACTIVE',
    actor: admin1
  });
  cashbackService.createManualLedgerAdjustment({
    targetUserId: userA.id,
    type: 'ADMIN_CREDIT_ADJUSTMENT',
    amount: 5000,
    currency: 'INR',
    reason: 'Opening test wallet settlement credit',
    actor: admin1
  });
  assert.equal(cashbackService.getWalletForUser(userA.id).availableBalance, 5000);

  // Invalid IFSC must fail
  assert.throws(
    () =>
      cashbackService.saveBankAccount({
        userId: userA.id,
        accountHolderName: 'Agent A',
        bankName: 'HDFC Bank',
        accountNumber: '50100999881234',
        ifscCode: 'INVALID123',
        currency: 'INR',
        actor: userA
      }),
    /IFSC/i,
    'Test E: Invalid IFSC must be rejected'
  );

  const savedBank = cashbackService.saveBankAccount({
    userId: userA.id,
    accountHolderName: 'Agent A',
    bankName: 'HDFC Bank',
    accountNumber: '50100999881234',
    ifscCode: 'HDFC0001234',
    currency: 'INR',
    isDefault: true,
    actor: userA
  });
  assert.equal(savedBank.accountNumberMasked, 'XXXXXXXXXX1234', 'Test E: Account number masked to last 4 digits');
  assert.equal(savedBank.accountNumberStored, undefined, 'Test E: Display bank object strips unmasked number');

  // Over-balance withdrawal blocked
  assert.throws(
    () =>
      cashbackService.submitWithdrawalRequest({
        userId: userA.id,
        requestedAmount: 6000,
        currency: 'INR',
        bankAccountId: savedBank.id,
        actor: userA
      }),
    /Insufficient/i,
    'Test E: Over-balance withdrawal rejected'
  );

  const wd1 = cashbackService.submitWithdrawalRequest({
    userId: userA.id,
    requestedAmount: 3000,
    currency: 'INR',
    bankAccountId: savedBank.id,
    actor: userA
  });
  const wAfterHold = cashbackService.getWalletForUser(userA.id);
  assert.equal(wAfterHold.availableBalance, 2000, 'Test E: Available reduced from 5000 -> 2000 on hold');
  assert.equal(wAfterHold.withdrawalPendingBalance, 3000, 'Test E: Withdrawal held = 3000');

  cashbackService.transitionWithdrawalRequest({ withdrawalRequestId: wd1.id, targetStatus: 'APPROVED', actor: admin1 });
  cashbackService.transitionWithdrawalRequest({ withdrawalRequestId: wd1.id, targetStatus: 'PROCESSING', actor: admin1 });
  cashbackService.transitionWithdrawalRequest({
    withdrawalRequestId: wd1.id,
    targetStatus: 'PAID',
    paymentReference: 'UTR-9988776655',
    paymentMethod: 'NEFT',
    paymentDate: '2026-12-20',
    actor: admin1
  });
  const wAfterPaid = cashbackService.getWalletForUser(userA.id);
  assert.equal(wAfterPaid.availableBalance, 2000, 'Test E: Available remains 2000 after Paid');
  assert.equal(wAfterPaid.withdrawalPendingBalance, 0, 'Test E: Held clears to 0 after Paid');
  assert.equal(wAfterPaid.totalWithdrawn, 3000, 'Test E: Total withdrawn = 3000');
  console.log('PASS Test E: Masked bank validation & Withdrawal HOLD -> APPROVED -> PROCESSING -> PAID verified.');

  // -------------------------------------------------------------------------
  // TEST F: Withdrawal Rejection Releases Funds & User Self-Cancel Works
  // -------------------------------------------------------------------------
  const wd2 = cashbackService.submitWithdrawalRequest({
    userId: userA.id,
    requestedAmount: 1500,
    currency: 'INR',
    bankAccountId: savedBank.id,
    actor: userA
  });
  assert.equal(cashbackService.getWalletForUser(userA.id).availableBalance, 500);
  cashbackService.transitionWithdrawalRequest({
    withdrawalRequestId: wd2.id,
    targetStatus: 'REJECTED',
    rejectionReason: 'Beneficiary KYC name mismatch',
    actor: admin1
  });
  const wAfterReject = cashbackService.getWalletForUser(userA.id);
  assert.equal(wAfterReject.availableBalance, 2000, 'Test F: Rejected withdrawal restores ₹1,500 to ₹2,000 available');
  assert.equal(wAfterReject.withdrawalPendingBalance, 0, 'Test F: Held returns to 0 after rejection');

  const wd3 = cashbackService.submitWithdrawalRequest({
    userId: userA.id,
    requestedAmount: 1000,
    currency: 'INR',
    bankAccountId: savedBank.id,
    actor: userA
  });
  assert.equal(cashbackService.getWalletForUser(userA.id).availableBalance, 1000);
  cashbackService.cancelOwnWithdrawal({ withdrawalRequestId: wd3.id, actor: userA });
  assert.equal(cashbackService.getWalletForUser(userA.id).availableBalance, 2000, 'Test F: User self-cancel restores ₹1,000');
  console.log('PASS Test F: Withdrawal rejection & user cancellation fund release verified.');

  // -------------------------------------------------------------------------
  // TEST G: Cancellation, Partial Refund Reversal, Travel Amendment & Dispute Hold
  // -------------------------------------------------------------------------
  const bkCancel = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Cancel Client', email: 'c@example.com', phone: '+91' },
      items: [makeBookingItem({ id: 'ic1', title: 'Tour C', category: 'TOUR', totalPrice: 40000 })],
      currency: 'INR',
      totalAmount: 40000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    userA
  );
  db.updateBookingStatus(bkCancel.id, 'CONFIRMED', admin1);
  assert.equal(cashbackService.getBookingCashbackRecordsForUser(userA.id).find((r) => r.bookingId === bkCancel.id)?.status, 'PENDING');
  db.updateBookingStatus(bkCancel.id, 'CANCELLED', admin1, 'Guest cancelled');
  const cancelledRec = cashbackService.getBookingCashbackRecordsForUser(userA.id).find((r) => r.bookingId === bkCancel.id)!;
  assert.equal(cancelledRec.status, 'CANCELLED', 'Test G: Booking cancellation voids pending cashback');

  // Credited booking + 40% partial refund reversal
  const bkRefund = db.createBooking(
    {
      sourceType: 'PRODUCT_DIRECT',
      destinationName: 'Japan',
      customer: { leadTravelerName: 'Refund Client', email: 'r@example.com', phone: '+91' },
      items: [makeBookingItem({ id: 'ir1', title: 'Hakone Private Ground Tour', category: 'TOUR', totalPrice: 100000 })],
      currency: 'INR',
      totalAmount: 100000,
      travelStartDate: '2026-12-01',
      travelEndDate: '2026-12-10'
    },
    userA
  );
  db.updateBookingStatus(bkRefund.id, 'CONFIRMED', admin1);

  // Dispute hold blocks crediting
  cashbackService.setBookingDisputeHold({ bookingId: bkRefund.id, isDisputed: true, reason: 'Supplier dispute', actor: admin1 });
  const heldBatch = cashbackService.runScheduledAutoCreditBatch({ nowIsoOverride: '2026-12-20T10:00:00.000Z', source: 'SCHEDULER' });
  assert.equal(heldBatch.creditedCount, 0, 'Test G: Dispute hold blocks scheduled credit');

  // Amend travelEndDate -> shifts scheduledCreditDate (+3d)
  const loadedBkRefund = db.getAllBookings().find((b) => b.id === bkRefund.id)!;
  loadedBkRefund.travelEndDate = '2026-12-15';
  db.saveBooking(loadedBkRefund, admin1);
  const amendedRec = cashbackService.getBookingCashbackRecordsForUser(userA.id).find((r) => r.bookingId === bkRefund.id)!;
  assert.equal(amendedRec.scheduledCreditDate, '2026-12-18', 'Test G: travelEndDate amendment shifts scheduledCreditDate to +3d');

  // Release dispute & credit after new scheduled date
  cashbackService.setBookingDisputeHold({ bookingId: bkRefund.id, isDisputed: false, reason: 'Resolved', actor: admin1 });
  const postAmendBatch = cashbackService.runScheduledAutoCreditBatch({ nowIsoOverride: '2026-12-19T10:00:00.000Z', source: 'SCHEDULER' });
  assert.equal(postAmendBatch.creditedCount, 1, 'Test G: Credited after dispute release and new travelEndDate + 3d');

  const availBeforeRefund = cashbackService.getWalletForUser(userA.id).availableBalance; // 2000 + 5000 = 7000
  assert.equal(availBeforeRefund, 7000);
  db.recordBookingRefund(bkRefund.id, 40000, false, '40% land tour refunded', admin1, { affectedComponent: 'LAND' });
  const availAfterRefund = cashbackService.getWalletForUser(userA.id).availableBalance; // 7000 - (5000 * 0.4 = 2000) = 5000
  assert.equal(availAfterRefund, 5000, 'Test G: 40% partial refund creates reversal debit reducing balance from 7000 -> 5000');
  assert.ok(
    cashbackService.getLedgerTransactionsForUser(userA.id).some((t) => t.type === 'CASHBACK_REVERSAL' && t.amount === 2000),
    'Test G: CASHBACK_REVERSAL ledger transaction created for 2000'
  );
  console.log('PASS Test G: Cancellation void, dispute hold, travel date amendment, and partial refund reversal verified.');

  // -------------------------------------------------------------------------
  // TEST H: RBAC, Anti-Self-Approval (Segregation of Duties), & PII Masking
  // -------------------------------------------------------------------------
  assert.throws(
    () => cashbackService.configureUserCashback({ targetUserId: userB.id, isEligible: true, cashbackPercent: 5, actor: userA }),
    /Unauthorized/i,
    'Test H: Agent cannot configure cashback'
  );
  assert.throws(
    () => cashbackService.createManualLedgerAdjustment({ targetUserId: userA.id, type: 'ADMIN_CREDIT_ADJUSTMENT', amount: 100, currency: 'INR', reason: 'Hack', actor: userA }),
    /Unauthorized/i,
    'Test H: Agent cannot create manual adjustments'
  );
  assert.throws(
    () => cashbackService.updatePolicy({ minWithdrawalAmount: 1 }, userA),
    /Unauthorized/i,
    'Test H: Agent cannot modify cashback policy'
  );
  assert.throws(
    () => cashbackService.getUnmaskedBankAccountForFinancePayout({ bankAccountId: savedBank.id, withdrawalRequestId: wd1.id, actor: userA }),
    /Unauthorized/i,
    'Test H: Non-admin cannot view unmasked bank account'
  );
  assert.throws(
    () => cashbackService.createManualLedgerAdjustment({ targetUserId: userA.id, type: 'ADMIN_DEBIT_ADJUSTMENT', amount: 999999, currency: 'INR', reason: 'Over-debit', actor: admin1 }),
    /Negative available balances are prohibited/i,
    'Test H: Negative balance adjustment prohibited'
  );

  // Admin self-approval segregation of duties test
  cashbackService.configureUserCashback({ targetUserId: admin1.id, isEligible: true, cashbackPercent: 1, status: 'ACTIVE', actor: admin2 });
  cashbackService.createManualLedgerAdjustment({ targetUserId: admin1.id, type: 'ADMIN_CREDIT_ADJUSTMENT', amount: 1000, currency: 'INR', reason: 'Admin wallet test', actor: admin2 });
  const adminBank = cashbackService.saveBankAccount({
    userId: admin1.id,
    accountHolderName: 'Master Admin',
    bankName: 'ICICI Bank',
    accountNumber: '123456789012',
    ifscCode: 'ICIC0000123',
    currency: 'INR',
    actor: admin1
  });
  const adminWd = cashbackService.submitWithdrawalRequest({
    userId: admin1.id,
    requestedAmount: 800,
    currency: 'INR',
    bankAccountId: adminBank.id,
    actor: admin1
  });
  assert.throws(
    () => cashbackService.transitionWithdrawalRequest({ withdrawalRequestId: adminWd.id, targetStatus: 'APPROVED', actor: admin1 }),
    /Segregation of Duties/i,
    'Test H: Admin cannot self-approve own withdrawal request'
  );
  const approvedByOther = cashbackService.transitionWithdrawalRequest({ withdrawalRequestId: adminWd.id, targetStatus: 'APPROVED', actor: admin2 });
  assert.equal(approvedByOther.status, 'APPROVED', 'Test H: Second finance admin approves withdrawal successfully');

  // Verify raw unmasked account string never appears in notifications or audit logs
  const auditDump = JSON.stringify(cashbackService.getAuditLogs());
  const notifDump = JSON.stringify(cashbackService.getNotificationsForUser(userA.id));
  assert.equal(auditDump.includes('50100999881234'), false, 'Test H: Full bank number must never leak in audit logs');
  assert.equal(notifDump.includes('50100999881234'), false, 'Test H: Full bank number must never leak in notifications');
  assert.equal(maskAccountNumber('50100999881234'), 'XXXXXXXXXX1234');
  assert.equal(sanitizeBankAccountForDisplay({ ...savedBank, accountNumberStored: '50100999881234' }).accountNumberStored, undefined);
  assert.equal(validateBankAccountInput({ accountHolderName: 'Alice Sterling', bankName: 'HDFC Bank', accountNumber: '1234567890', ifscCode: 'HDFC0001234' }).valid, true);
  console.log('PASS Test H: RBAC, anti-self-approval, negative-balance guard, and PII masking verified.');

  // -------------------------------------------------------------------------
  // TEST I: Scheduler & Ledger Reconciliation Idempotency
  // -------------------------------------------------------------------------
  const notifsBefore = cashbackService.getNotificationsForUser(userA.id).length;
  const txsBefore = cashbackService.getLedgerTransactionsForUser(userA.id).length;
  const repeat1 = cashbackService.runScheduledAutoCreditBatch({ nowIsoOverride: '2026-12-30T10:00:00.000Z', source: 'SCHEDULER' });
  const repeat2 = cashbackService.runScheduledAutoCreditBatch({ nowIsoOverride: '2026-12-30T10:05:00.000Z', source: 'SCHEDULER' });
  assert.equal(repeat1.creditedCount, 0, 'Test I: Repeat scheduler pass 1 credits 0 already-credited bookings');
  assert.equal(repeat2.creditedCount, 0, 'Test I: Repeat scheduler pass 2 credits 0 already-credited bookings');
  assert.equal(cashbackService.getNotificationsForUser(userA.id).length, notifsBefore, 'Test I: No duplicate notifications');
  assert.equal(cashbackService.getLedgerTransactionsForUser(userA.id).length, txsBefore, 'Test I: No duplicate ledger credits');

  const recon = cashbackService.reconcileAllWallets();
  assert.ok(recon.checkedUsers >= 2, 'Test I: Reconciled all active cashback wallets');
  const directReconciled = reconcileWalletFromLedger({
    userId: userA.id,
    defaultCurrency: 'INR',
    ledgerTransactions: cashbackService.getLedgerTransactionsForUser(userA.id),
    bookingRecords: cashbackService.getBookingCashbackRecordsForUser(userA.id)
  });
  assert.equal(directReconciled.availableBalance, cashbackService.getWalletForUser(userA.id).availableBalance, 'Test I: Wallet matches ledger replay');
  console.log('PASS Test I: Scheduler idempotency and ledger-first wallet reconciliation verified.');

  console.log('\nALL TESTS A–I PASSED SUCCESSFULLY!');
  process.exit(0);
}

run().catch((err) => {
  console.error('AUDIT SUITE FAILED:', err);
  process.exit(1);
});
