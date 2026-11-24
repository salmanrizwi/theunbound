import {
  Booking,
  Promotion,
  User
} from '../types';
import {
  buildBookingManualDiscountReport,
  buildInitialBookingPricingSnapshot,
  calculateBookingManualDiscountPreview,
  getLatestBookingPricingSnapshot,
  resolveAdminManualDiscountPermissions
} from '../services/bookingManualDiscountEngine';
import {
  BookingManualDiscountTransactionManager,
  InMemoryBookingDiscountStore
} from '../../server/bookingManualDiscountService';
import { sanitizeBookingForAgent } from '../utils/customerQuoteSanitizer';
import { calculateBookingProfitability } from '../services/crmOperationsEngine';
import { evaluatePromotionEligibilityAndDiscount } from '../services/promotionEngine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failed += 1;
    console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function makeAdminCaller(overrides: Partial<any> = {}) {
  const user: Partial<User> = {
    id: overrides.uid || 'admin-1',
    email: overrides.email || 'business@theunbound.in',
    name: overrides.name || 'Finance Director',
    role: overrides.role || 'ADMIN',
    approvalStatus: 'APPROVED',
    permissions: overrides.permissions
  };
  return {
    uid: user.id!,
    email: user.email!,
    name: user.name!,
    role: user.role!,
    idToken: 'test-token',
    permissions: resolveAdminManualDiscountPermissions(user)
  };
}

function makeBaseBooking(overrides: Partial<Booking> = {}): Booking {
  const now = '2026-11-24T10:00:00.000Z';
  return {
    id: overrides.id || 'bk-test-1',
    bookingReference: overrides.bookingReference || 'TUB-BK-2026-1001',
    sourceType: 'QUOTATION',
    destination: 'Japan',
    destinationName: 'Japan',
    currency: 'INR',
    totalAmount: 100000,
    finalCustomerSellingPrice: 100000,
    baseFinalSellingPrice: 100000,
    preDiscountBaseSellingPrice: 100000,
    discountedBaseSellingPrice: 100000,
    totalNetCost: 80000,
    internalNettCost: 80000,
    supplierCost: 80000,
    supplierTotalCost: 80000,
    internalMarkup: 20000,
    agentMarginAmount: 0,
    promotionDiscountAmount: 0,
    travelStartDate: '2027-04-01',
    travelEndDate: '2027-04-08',
    status: 'CONFIRMED',
    paymentStatus: 'PENDING_PAYMENT',
    agencyId: 'ag-1',
    agencyName: 'Sakura Voyages',
    submittingAgentId: 'agent-1',
    submittingAgentNameSnapshot: 'Aarav Mehta',
    customer: {
      leadTravelerName: 'Rohan Kapoor',
      email: 'rohan@example.com',
      phone: '+91-9800000000',
      agencyName: 'Sakura Voyages',
      totalAdults: 2,
      totalChildren: 0,
      totalInfants: 0
    },
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        productName: 'Tokyo & Kyoto Luxury Land Package',
        productSku: 'JP-LUX-01',
        destinationName: 'Japan',
        city: 'Tokyo',
        category: 'PACKAGE',
        travelDate: '2027-04-01',
        adults: 2,
        children: 0,
        infants: 0,
        totalPax: 2,
        selectedAddonNames: [],
        unitNetPrice: 40000,
        unitSellingPrice: 100000,
        totalPrice: 100000,
        currency: 'INR',
        supplierStatus: 'CONFIRMED_BY_SUPPLIER'
      }
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

async function runAudit() {
  console.log('\n====================================================================');
  console.log('ADMIN MANUAL DISCOUNT COUPONS & MARGIN RECALCULATION AUDIT SUITE');
  console.log('====================================================================\n');

  const adminCaller = makeAdminCaller();
  const staffNoOverride = makeAdminCaller({
    uid: 'staff-1',
    email: 'ops@theunbound.in',
    name: 'Operations Executive',
    role: 'TEAM_MEMBER',
    permissions: {
      bookingOperations: {
        view_internal_margin: true,
        apply_manual_discount: true,
        apply_admin_coupon: true,
        override_margin_protection: false,
        reverse_manual_discount: false
      }
    }
  });
  const b2bAgentUser: Partial<User> = {
    id: 'agent-1',
    email: 'agent@sakuravoyages.com',
    name: 'Aarav Mehta',
    role: 'B2B_AGENT',
    approvalStatus: 'APPROVED',
    permissions: {
      // Even if a malicious client payload sets flags, external roles MUST be denied
      bookingOperations: {
        view_internal_margin: true,
        apply_manual_discount: true,
        override_margin_protection: true
      }
    }
  };

  // --------------------------------------------------------------------------
  // TEST 1: Basic Manual Discount
  // Nett 80,000 | Original Selling 100,000 | Margin 20,000 | Admin Discount 5,000
  // -> Nett 80,000 | Revised Selling 95,000 | Remaining Margin 15,000
  // --------------------------------------------------------------------------
  console.log('--- Acceptance Test 1: Basic Manual Discount ---');
  {
    const store = new InMemoryBookingDiscountStore();
    const mgr = new BookingManualDiscountTransactionManager(store);
    const bk = makeBaseBooking({ id: 'bk-t1', bookingReference: 'TUB-BK-T1' });
    await store.saveBooking(bk);

    const res = await mgr.applyDiscount({
      bookingId: bk.id,
      caller: adminCaller,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 5000,
        discountCurrency: 'INR',
        reason: 'Repeat VIP partner commercial goodwill'
      }
    });

    assert(res.ok === true, 'Test 1 apply succeeds');
    if (res.ok) {
      assert(res.newSnapshot.supplierNettCost === 80000, 'Supplier Nett Cost strictly remains 80,000', `got ${res.newSnapshot.supplierNettCost}`);
      assert(res.newSnapshot.revisedCustomerSellingPrice === 95000, 'Revised Selling Price is 95,000', `got ${res.newSnapshot.revisedCustomerSellingPrice}`);
      assert(res.newSnapshot.remainingTheUnboundMargin === 15000, 'Remaining TheUnbound Margin is 15,000', `got ${res.newSnapshot.remainingTheUnboundMargin}`);
      assert(res.newSnapshot.version === 2, 'Snapshot version incremented to v2');
      assert(res.updatedBooking.totalAmount === 95000, 'Booking totalAmount synchronized to 95,000');
      assert(res.updatedBooking.totalNetCost === 80000, 'Booking totalNetCost untouched at 80,000');
      assert(store.snapshots.size === 2, 'Immutable v1 baseline and v2 snapshots both preserved');
      assert(store.auditLogs.length === 1 && store.auditLogs[0].action === 'BOOKING_MANUAL_DISCOUNT_APPLIED', 'Audit log recorded');
    }
  }

  // --------------------------------------------------------------------------
  // TEST 2: Discount Exceeds Available Margin
  // Available 5,000 | Request 7,000 -> Blocked, booking unchanged, available margin returned
  // Plus controlled Loss-Making Override verification
  // --------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 2: Discount Exceeds Available Margin & Loss Override ---');
  {
    const store = new InMemoryBookingDiscountStore();
    const mgr = new BookingManualDiscountTransactionManager(store);
    const bk = makeBaseBooking({
      id: 'bk-t2',
      bookingReference: 'TUB-BK-T2',
      totalNetCost: 95000,
      internalNettCost: 95000,
      supplierCost: 95000,
      supplierTotalCost: 95000,
      totalAmount: 100000,
      finalCustomerSellingPrice: 100000,
      preDiscountBaseSellingPrice: 100000,
      discountedBaseSellingPrice: 100000,
      internalMarkup: 5000
    });
    await store.saveBooking(bk);

    const blocked = await mgr.applyDiscount({
      bookingId: bk.id,
      caller: adminCaller,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 7000,
        discountCurrency: 'INR',
        reason: 'Requested 7k discount exceeding 5k margin'
      }
    });

    assert(blocked.ok === false, 'Exceeding margin discount is blocked by default');
    if (!blocked.ok) {
      assert(blocked.preview?.marginProtectionBlocked === true, 'marginProtectionBlocked flag is true');
      assert(blocked.preview?.availableMarginBeforeDiscount === 5000, 'Available margin (5,000) returned clearly');
    }
    const storedAfterBlock = await store.getBooking(bk.id);
    assert(storedAfterBlock?.totalAmount === 100000, 'Booking totalAmount completely unchanged after rejection');
    assert(store.adjustments.size === 0, 'Zero partial adjustments persisted on rejection');
    assert(store.auditLogs.some(l => l.action === 'BOOKING_MANUAL_DISCOUNT_REJECTED'), 'Rejected attempt audited');

    // Non-override staff attempting override is still strictly denied
    const staffOverrideDenied = await mgr.applyDiscount({
      bookingId: bk.id,
      caller: staffNoOverride,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 7000,
        discountCurrency: 'INR',
        reason: 'Attempted unauthorized loss override',
        allowMarginOverride: true,
        marginOverrideReason: 'Ops executive trying to override'
      }
    });
    assert(staffOverrideDenied.ok === false && staffOverrideDenied.status === 403, 'Staff without override permission blocked with 403');

    // Authorized Admin with explicit Loss-Making Override & mandatory reason succeeds
    const overrideOk = await mgr.applyDiscount({
      bookingId: bk.id,
      caller: adminCaller,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 7000,
        discountCurrency: 'INR',
        reason: 'Executive recovery credit',
        allowMarginOverride: true,
        marginOverrideReason: 'CEO written approval ref EXEC-2026-99'
      }
    });
    assert(overrideOk.ok === true, 'Authorized Loss-Making Override succeeds with mandatory reason');
    if (overrideOk.ok) {
      assert(overrideOk.newSnapshot.remainingTheUnboundMargin === -2000, 'Remaining margin accurately reflects -2,000 loss');
      assert(overrideOk.newSnapshot.isLossMaking === true, 'Snapshot flagged as isLossMaking');
      assert(overrideOk.newSnapshot.supplierNettCost === 95000, 'Supplier Nett Cost STILL untouched at 95,000');
      assert(overrideOk.adjustment.marginOverrideUsed === true, 'Adjustment records marginOverrideUsed = true');
    }
  }

  // --------------------------------------------------------------------------
  // TEST 3: Existing B2B Promotion + Admin Manual Discount (Coexistence, No Double Deduction)
  // Nett 80,000 | Pre-Discount Base 100,000 | B2B Promo 8,000 -> Discounted Base 92,000
  // Agent Markup 5,000 -> Customer Selling 97,000 | Remaining Eligible Margin = 12,000
  // Admin Manual Coupon 5,000 -> Selling 92,000 | Remaining Margin 7,000 | Nett 80,000
  // --------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 3: B2B Promotion + Admin Manual Coupon Coexistence ---');
  {
    const store = new InMemoryBookingDiscountStore();
    const mgr = new BookingManualDiscountTransactionManager(store);

    const adminCoupon: Promotion = {
      id: 'promo-admin-vip',
      title: 'Admin VIP Goodwill 5K',
      description: 'Internal Admin Margin-Funded Coupon',
      promoCode: 'ADMINVIP5K',
      normalizedPromoCode: 'ADMINVIP5K',
      promotionType: 'DISCOUNT_CODE',
      discountType: 'FIXED',
      discountValue: 5000,
      currency: 'INR',
      targetAudience: 'B2B_AGENT',
      displayPlacement: 'BANNER',
      frequency: 'ALWAYS',
      applicableProductIds: [],
      applyToAllProducts: true,
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      priority: 1,
      status: 'ACTIVE',
      isActive: true,
      couponChannel: 'ADMIN_MANUAL',
      fundingSource: 'THEUNBOUND_MARGIN',
      permittedForExistingBookings: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    await store.savePromotion(adminCoupon);

    // Ensure B2B Agent CANNOT self-apply an ADMIN_MANUAL coupon in the B2B Quote Builder!
    const b2bAttempt = evaluatePromotionEligibilityAndDiscount({
      promotion: adminCoupon,
      context: {
        code: 'ADMINVIP5K',
        stage: 'QUOTATION',
        agentUid: 'agent-1',
        agentRole: 'B2B_AGENT',
        preDiscountBaseSellingPrice: 100000,
        currency: 'INR'
      },
      usageCounts: {
        totalRedeemed: 0,
        totalActiveReservations: 0,
        agentRedeemed: 0,
        agentActiveReservations: 0,
        agencyRedeemed: 0,
        agencyActiveReservations: 0
      }
    });
    assert(b2bAttempt.valid === false, 'B2B Quote Builder rejects ADMIN_MANUAL-only coupon code');

    const bk = makeBaseBooking({
      id: 'bk-t3',
      bookingReference: 'TUB-BK-T3',
      totalNetCost: 80000,
      internalNettCost: 80000,
      supplierCost: 80000,
      preDiscountBaseSellingPrice: 100000,
      promotionDiscountAmount: 8000,
      b2bPromotionDiscountAmount: 8000,
      discountedBaseSellingPrice: 92000,
      baseFinalSellingPrice: 92000,
      agentMarginAmount: 5000,
      totalAmount: 97000,
      finalCustomerSellingPrice: 97000,
      appliedPromotion: {
        promotionId: 'promo-b2b-1',
        promotionName: 'Japan Spring Launch',
        code: 'JAPAN8K',
        normalizedCode: 'JAPAN8K',
        promotionConfigVersion: 1,
        discountType: 'FIXED',
        discountValue: 8000,
        currency: 'INR',
        eligibleBaseSellingPrice: 100000,
        preDiscountBaseSellingPrice: 100000,
        discountAmount: 8000,
        discountedBaseSellingPrice: 92000,
        appliedAt: '2026-11-24T09:00:00.000Z',
        appliedByUid: 'agent-1',
        appliedStage: 'QUOTATION',
        validationStatus: 'VALID'
      }
    });
    await store.saveBooking(bk);

    const baseline = buildInitialBookingPricingSnapshot(bk);
    assert(baseline.originalTheUnboundMargin === 20000, 'Baseline Original Margin is 20,000');
    assert(baseline.b2bPromotionDiscountAmount === 8000, 'Baseline preserves B2B promo discount 8,000');
    assert(baseline.remainingTheUnboundMargin === 12000, 'Remaining eligible margin after B2B promo is 12,000 (Agent 5k markup NOT counted as Unbound margin!)');

    // Attempt 15,000 manual discount (would pass if B2B promo were ignored, MUST block since only 12,000 remains!)
    const overB2BBlocked = await mgr.applyDiscount({
      bookingId: bk.id,
      caller: adminCaller,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 15000,
        discountCurrency: 'INR',
        reason: 'Should fail because B2B promo already consumed 8k of 20k margin'
      }
    });
    assert(overB2BBlocked.ok === false, '15k manual discount blocked because only 12k margin remains after 8k B2B promo');

    // Now apply valid 5,000 Admin Manual Coupon
    const res = await mgr.applyDiscount({
      bookingId: bk.id,
      caller: adminCaller,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_COUPON',
        discountType: 'FIXED',
        discountValue: 5000,
        couponId: adminCoupon.id,
        couponCode: 'ADMINVIP5K',
        reason: 'Admin VIP goodwill on top of B2B Spring promo'
      }
    });
    assert(res.ok === true, 'Admin Manual Coupon applied cleanly alongside B2B promo');
    if (res.ok) {
      assert(res.newSnapshot.b2bPromotionDiscountAmount === 8000, 'B2B Promo Discount stays independently 8,000');
      assert(res.newSnapshot.cumulativeAdminManualDiscount === 5000, 'Admin Manual Discount tracked independently as 5,000');
      assert(res.newSnapshot.remainingTheUnboundMargin === 7000, 'Remaining Margin is 7,000 (20k - 8k - 5k, zero double deduction)');
      assert(res.newSnapshot.revisedCustomerSellingPrice === 92000, 'Revised Customer Selling Price is 92,000 (97k - 5k)');
      assert(res.newSnapshot.supplierNettCost === 80000, 'Supplier Nett Cost untouched at 80,000');
      assert(res.newSnapshot.agentAdditionalMarkupAmount === 5000, 'Agent Additional Markup untouched at 5,000');
      const updatedPromo = (await store.listPromotions()).find(p => p.id === adminCoupon.id);
      assert(updatedPromo?.adminManualRedemptionsCount === 1, 'Coupon tracks adminManualRedemptionsCount independently');
      assert((updatedPromo?.successfulRedemptionsCount || 0) === 0, 'B2B successfulRedemptionsCount NOT polluted');
    }
  }

  // --------------------------------------------------------------------------
  // TEST 4: Multiple Sequential Admin Adjustments
  // Margin 20,000 -> -4,000 (v2, rem 16,000, sell 96,000) -> -6,000 (v3, rem 10,000, sell 90,000)
  // --------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 4: Multiple Sequential Admin Adjustments ---');
  let seqStore: InMemoryBookingDiscountStore;
  let seqMgr: BookingManualDiscountTransactionManager;
  let seqAdj1Id = '';
  let seqAdj2Id = '';
  {
    seqStore = new InMemoryBookingDiscountStore();
    seqMgr = new BookingManualDiscountTransactionManager(seqStore);
    const bk = makeBaseBooking({ id: 'bk-t4', bookingReference: 'TUB-BK-T4' });
    await seqStore.saveBooking(bk);

    const r1 = await seqMgr.applyDiscount({
      bookingId: bk.id,
      caller: adminCaller,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 4000,
        reason: 'First commercial goodwill adjustment'
      }
    });
    const r2 = await seqMgr.applyDiscount({
      bookingId: bk.id,
      caller: adminCaller,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 6000,
        reason: 'Second director courtesy adjustment'
      }
    });

    assert(r1.ok && r2.ok, 'Both sequential adjustments succeed');
    if (r1.ok && r2.ok) {
      seqAdj1Id = r1.adjustment.adjustmentId;
      seqAdj2Id = r2.adjustment.adjustmentId;
      assert(r2.newSnapshot.version === 3, 'Snapshot version incremented v1 -> v2 -> v3');
      assert(r2.newSnapshot.cumulativeAdminManualDiscount === 10000, 'Cumulative Admin Manual Discount is 10,000');
      assert(r2.newSnapshot.remainingTheUnboundMargin === 10000, 'Remaining Margin is 10,000');
      assert(r2.newSnapshot.revisedCustomerSellingPrice === 90000, 'Revised Selling Price is 90,000');
      assert(seqStore.snapshots.size === 3, 'All 3 immutable snapshots preserved (v1, v2, v3)');
      assert(seqStore.adjustments.size === 2, 'Both adjustments independently recorded');
    }
  }

  // --------------------------------------------------------------------------
  // TEST 5: Immutable Reversal
  // Reverse 1st adjustment (4,000) -> v4 snapshot, cumulative 6,000, margin 14,000, selling 94,000
  // Reversing the same adjustment twice must be rejected
  // --------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 5: Immutable Reversal & Double-Reversal Protection ---');
  {
    seqStore.invoiceCounts.set('bk-t4', 1); // Simulate historical invoice already issued
    const rev1 = await seqMgr.reverseDiscount({
      bookingId: 'bk-t4',
      caller: adminCaller,
      payload: {
        bookingId: 'bk-t4',
        adjustmentId: seqAdj1Id,
        reason: 'Applied in error to wrong booking tranche'
      }
    });

    assert(rev1.ok === true, 'Reversal succeeds cleanly');
    if (rev1.ok) {
      assert(rev1.reversalAdjustment.actionType === 'REVERSE', 'Immutable REVERSE record created');
      assert(rev1.reversalAdjustment.reversedAdjustmentId === seqAdj1Id, 'Links back to original adjustment ID');
      assert(rev1.newSnapshot.version === 4, 'New immutable snapshot v4 created');
      assert(rev1.newSnapshot.cumulativeAdminManualDiscount === 6000, 'Cumulative manual discount recalculated to 6,000');
      assert(rev1.newSnapshot.remainingTheUnboundMargin === 14000, 'Remaining margin restored to 14,000');
      assert(rev1.newSnapshot.revisedCustomerSellingPrice === 94000, 'Revised customer selling price restored to 94,000');
      assert(rev1.newSnapshot.supplierNettCost === 80000, 'Supplier Nett Cost remains 80,000');
      assert(rev1.updatedBooking.hasRevisedPricingAfterInvoice === true, 'Flags revised pricing after historical invoice without mutating old invoices');
      assert(seqStore.snapshots.size === 4, 'All 4 snapshots (v1, v2, v3, v4) preserved immutably');
      assert(seqStore.adjustments.size === 3, 'Append-only ledger holds 2 APPLY + 1 REVERSE record');
    }

    const doubleRev = await seqMgr.reverseDiscount({
      bookingId: 'bk-t4',
      caller: adminCaller,
      payload: {
        bookingId: 'bk-t4',
        adjustmentId: seqAdj1Id,
        reason: 'Duplicate reversal attempt'
      }
    });
    assert(doubleRev.ok === false, 'Duplicate reversal of same adjustment is blocked');
    assert(Boolean(seqAdj2Id), 'Second adjustment remains active independently');
  }

  // --------------------------------------------------------------------------
  // TEST 6: All Booking Outputs, Confidentiality Sanitization & Profitability Reports
  // --------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 6: Sanitization, Confidentiality, Reports & Status Blocking ---');
  {
    const updatedBk = (await seqStore.getBooking('bk-t4'))!;
    // 6A. External B2B Agent Sanitization
    const agentBooking = sanitizeBookingForAgent(updatedBk);
    assert(agentBooking.totalAmount === 94000, 'Agent sees strictly revised customer selling price (94,000)');
    assert(agentBooking.finalCustomerSellingPrice === 94000, 'Agent finalCustomerSellingPrice matches 94,000');
    assert(agentBooking.totalNetCost === undefined, 'Supplier nett cost stripped from Agent view');
    assert(agentBooking.originalTheUnboundMargin === undefined, 'Original internal margin stripped from Agent view');
    assert(agentBooking.remainingTheUnboundMargin === undefined, 'Remaining internal margin stripped from Agent view');
    assert(agentBooking.adminManualDiscountTotal === undefined, 'Internal margin-funded discount breakdown stripped from Agent view');
    assert(agentBooking.manualDiscountAdjustments === undefined, 'Internal adjustment ledger & reasons stripped from Agent view');
    assert(agentBooking.pricingSnapshotHistory === undefined, 'Internal snapshot history stripped from Agent view');

    // 6B. External B2B Agent RBAC check
    const agentPerms = resolveAdminManualDiscountPermissions(b2bAgentUser);
    assert(
      !agentPerms.canViewInternalMargin &&
        !agentPerms.canApplyManualDiscount &&
        !agentPerms.canApplyAdminCoupon &&
        !agentPerms.canOverrideMarginProtection &&
        !agentPerms.canReverseManualDiscount &&
        !agentPerms.canViewDiscountReports,
      'B2B Agent strictly denied all manual discount & internal margin permissions'
    );

    // 6C. Central Profitability Report sync
    const prof = calculateBookingProfitability(updatedBk);
    assert(prof.sellingPrice === 94000, 'Profitability report sellingPrice synced to 94,000');
    assert(prof.totalSupplierCost === 80000, 'Profitability report totalSupplierCost preserved at 80,000');
    assert(prof.remainingTheUnboundMargin === 14000, 'Profitability report remainingTheUnboundMargin synced to 14,000');
    assert(prof.adminManualDiscountTotal === 6000, 'Profitability report adminManualDiscountTotal synced to 6,000');

    // 6D. Admin Manual Discount Report Summary
    const report = buildBookingManualDiscountReport({
      bookings: [updatedBk]
    });
    assert(report.totalBookingsWithManualDiscounts === 1, 'Report lists 1 booking with manual discounts');
    assert(report.totalActiveAdjustments === 1 && report.totalReversedAdjustments === 1, 'Report distinguishes 1 active & 1 reversed adjustment');
    assert(report.totalAdminManualDiscountByCurrency['INR'] === 6000, 'Report totals active INR manual discount = 6,000');

    // 6E. Booking Status Restrictions (CANCELLED, COMPLETED, REFUNDED)
    const cancelledBk = makeBaseBooking({ id: 'bk-cancel', status: 'CANCELLED' });
    const completedBk = makeBaseBooking({ id: 'bk-done', status: 'COMPLETED' });
    const refundedBk = makeBaseBooking({ id: 'bk-ref', status: 'CONFIRMED', paymentStatus: 'REFUNDED' });
    const pCancel = calculateBookingManualDiscountPreview({
      booking: cancelledBk,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 1000,
      permissions: adminCaller.permissions
    });
    const pCompleted = calculateBookingManualDiscountPreview({
      booking: completedBk,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 1000,
      permissions: adminCaller.permissions
    });
    const pRefunded = calculateBookingManualDiscountPreview({
      booking: refundedBk,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 1000,
      permissions: adminCaller.permissions
    });
    assert(!pCancel.canApply && !pCancel.eligible, 'CANCELLED booking blocks manual discounts');
    assert(!pCompleted.canApply && !pCompleted.eligible, 'COMPLETED booking blocks manual discounts');
    assert(!pRefunded.canApply && !pRefunded.eligible, 'REFUNDED booking blocks manual discounts');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Concurrent Admin Activity & Idempotency Replay Safety
  // Two simultaneous 12,000 discounts against 20,000 available margin:
  // ONLY ONE succeeds; the second MUST be rejected by margin protection inside the per-booking lock!
  // Plus idempotent retry with identical key returns original adjustment without double-deducting!
  // --------------------------------------------------------------------------
  console.log('\n--- Acceptance Test 7: Concurrent Admin Race Protection & Idempotency ---');
  {
    const store = new InMemoryBookingDiscountStore();
    const mgr = new BookingManualDiscountTransactionManager(store);
    const bk = makeBaseBooking({ id: 'bk-t7', bookingReference: 'TUB-BK-T7' }); // Margin = 20,000
    await store.saveBooking(bk);

    const adminA = makeAdminCaller({ uid: 'admin-A', name: 'Admin Alpha' });
    const adminB = makeAdminCaller({ uid: 'admin-B', name: 'Admin Beta' });

    const [resA, resB] = await Promise.all([
      mgr.applyDiscount({
        bookingId: bk.id,
        caller: adminA,
        payload: {
          bookingId: bk.id,
          discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
          discountType: 'FIXED',
          discountValue: 12000,
          idempotencyKey: 'concurrent-key-A',
          reason: 'Admin A simultaneous 12k discount'
        }
      }),
      mgr.applyDiscount({
        bookingId: bk.id,
        caller: adminB,
        payload: {
          bookingId: bk.id,
          discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
          discountType: 'FIXED',
          discountValue: 12000,
          idempotencyKey: 'concurrent-key-B',
          reason: 'Admin B simultaneous 12k discount'
        }
      })
    ]);

    const successes = [resA, resB].filter(r => r.ok);
    const failures = [resA, resB].filter(r => !r.ok);
    assert(successes.length === 1 && failures.length === 1, 'Exactly ONE concurrent 12k request succeeds; second blocked against remaining 8k margin');

    const finalBk = (await store.getBooking(bk.id))!;
    const latest = getLatestBookingPricingSnapshot(finalBk);
    assert(latest.cumulativeAdminManualDiscount === 12000, 'Cumulative discount is strictly 12,000 (no overspend)');
    assert(latest.remainingTheUnboundMargin === 8000, 'Remaining margin is strictly 8,000 (not negative!)');
    assert(latest.revisedCustomerSellingPrice === 88000, 'Revised selling price is strictly 88,000');

    // Idempotent retry of the winning key must NOT create a duplicate adjustment
    const winningKey = resA.ok ? 'concurrent-key-A' : 'concurrent-key-B';
    const replay = await mgr.applyDiscount({
      bookingId: bk.id,
      caller: adminA,
      payload: {
        bookingId: bk.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 12000,
        idempotencyKey: winningKey,
        reason: 'Network retry of winning request'
      }
    });
    assert(replay.ok === true && replay.idempotentReplay === true, 'Idempotent retry detected and returned existing committed adjustment');
    assert(store.adjustments.size === 1, 'Zero duplicate adjustments created on idempotent retry');
  }

  console.log('\n====================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
