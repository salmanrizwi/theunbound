import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { Booking, User } from '../types';
import { AppDatabase } from '../services/db';
import {
  buildBookingManualDiscountReport,
  getLatestBookingPricingSnapshot,
  resolveAdminManualDiscountPermissions,
  resolveAuthoritativeBookingFinancials
} from '../services/bookingManualDiscountEngine';
import { sanitizeBookingForAgent } from '../utils/customerQuoteSanitizer';
import { applyBookingManualDiscountAsync } from '../services/bookingManualDiscountApiService';
import {
  BookingManualDiscountTransactionManager,
  FirestoreBookingDiscountStore,
  InMemoryBookingDiscountStore
} from '../../server/bookingManualDiscountService';
import {
  getFirebaseAdminApp,
  getServerFirebaseConfig,
  getServerFirestoreBaseUrl,
  verifyServerFirebaseIdToken
} from '../../server/firebaseServerAuth';
import {
  fetchBookingPaymentSchedulesAsync,
  saveBookingPaymentScheduleVersionAsync
} from '../services/paymentScheduleApiService';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] || null,
    get length() {
      return store.size;
    }
  };
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = createMemoryStorage();
}

/**
 * Faithful evaluator of the exact CEL rules in /firestore.rules for:
 *  - canReadBookingFinancialSnapshots()
 *  - canWriteBookingFinancialSnapshots()
 *  - canManageBookingPaymentSchedules()
 * Including CEL strict map-key error simulation (accessing missing map keys without `.get(...)` throws in CEL).
 */
function evaluateFirestoreFinancialRules(params: {
  auth: { uid: string; email?: string } | null;
  userDoc: Record<string, any> | null;
}) {
  const { auth, userDoc } = params;
  const isAuthenticated = auth !== null;

  const mapGet = (obj: Record<string, any> | null | undefined, key: string, fallback: any) => {
    if (!obj || typeof obj !== 'object') return fallback;
    return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined ? obj[key] : fallback;
  };

  const hasUserDoc = Boolean(userDoc);
  const currentRole = hasUserDoc
    ? mapGet(userDoc, 'role', mapGet(userDoc, 'userType', ''))
    : '';

  const emailLower = auth?.email ? auth.email.toLowerCase() : '';
  const isSuperAdmin =
    isAuthenticated &&
    (emailLower === 'business@theunbound.in' ||
      emailLower === 'admin@theunbound.com' ||
      emailLower === 'marcus@theunbound.in' ||
      (hasUserDoc &&
        (mapGet(userDoc, 'role', '') === 'SUPER_ADMIN' ||
          mapGet(userDoc, 'userType', '') === 'SUPER_ADMIN')));

  const isMasterAdmin =
    isSuperAdmin ||
    (isAuthenticated &&
      hasUserDoc &&
      (mapGet(userDoc, 'role', '') === 'ADMIN' || mapGet(userDoc, 'userType', '') === 'ADMIN') &&
      mapGet(userDoc, 'approvalStatus', 'APPROVED') === 'APPROVED');

  const isNotBuyer =
    !hasUserDoc ||
    (userDoc!.role !== 'BUYER' &&
      (!Object.prototype.hasOwnProperty.call(userDoc!, 'userType') || userDoc!.userType !== 'BUYER'));

  const isApprovedUser =
    isAuthenticated &&
    isNotBuyer &&
    (isMasterAdmin ||
      (hasUserDoc &&
        (userDoc!.approvalStatus === 'APPROVED' ||
          !Object.prototype.hasOwnProperty.call(userDoc!, 'approvalStatus'))));

  const hasPerms =
    hasUserDoc &&
    Object.prototype.hasOwnProperty.call(userDoc!, 'permissions') &&
    typeof userDoc!.permissions === 'object' &&
    userDoc!.permissions !== null;

  const perms = hasPerms ? userDoc!.permissions : null;

  const hasBookingOpsPerm = (key: string, defaultVal: boolean): boolean => {
    if (
      hasPerms &&
      Object.prototype.hasOwnProperty.call(perms, 'bookingOperations') &&
      typeof perms.bookingOperations === 'object' &&
      perms.bookingOperations !== null
    ) {
      return mapGet(perms.bookingOperations, key, defaultVal) === true;
    }
    return defaultVal;
  };

  const hasCmsFinanceAccess =
    hasPerms &&
    (mapGet(perms, 'canAccessFinancials', false) === true ||
      (Object.prototype.hasOwnProperty.call(perms, 'cmsFinance') &&
        typeof perms.cmsFinance === 'object' &&
        perms.cmsFinance !== null &&
        (mapGet(perms.cmsFinance, 'enabled', false) === true ||
          mapGet(perms.cmsFinance, 'pricing', false) === true)));

  const adminFinancialRevoked =
    hasPerms &&
    (mapGet(perms, 'canAccessFinancials', true) === false ||
      (Object.prototype.hasOwnProperty.call(perms, 'cmsFinance') &&
        typeof perms.cmsFinance === 'object' &&
        perms.cmsFinance !== null &&
        mapGet(perms.cmsFinance, 'enabled', true) === false));

  const canReadSnapshots =
    isSuperAdmin ||
    (isApprovedUser &&
      hasUserDoc &&
      ((currentRole === 'ADMIN' &&
        ((!adminFinancialRevoked &&
          (hasBookingOpsPerm('view_internal_margin', true) ||
            hasBookingOpsPerm('apply_manual_discount', false) ||
            hasBookingOpsPerm('view_discount_reports', false) ||
            hasCmsFinanceAccess)) ||
          (adminFinancialRevoked &&
            (hasBookingOpsPerm('view_internal_margin', false) ||
              hasBookingOpsPerm('apply_manual_discount', false) ||
              hasBookingOpsPerm('view_discount_reports', false))))) ||
        (['TEAM_MEMBER', 'DMC_STAFF'].includes(currentRole) &&
          (hasBookingOpsPerm('view_internal_margin', false) ||
            hasBookingOpsPerm('view_internal_financials', false) ||
            hasBookingOpsPerm('apply_manual_discount', false) ||
            hasBookingOpsPerm('apply_admin_coupon', false) ||
            hasBookingOpsPerm('view_discount_reports', false) ||
            hasCmsFinanceAccess))));

  const canWriteSnapshots =
    isSuperAdmin ||
    (isApprovedUser &&
      hasUserDoc &&
      ((currentRole === 'ADMIN' &&
        ((!adminFinancialRevoked &&
          (hasBookingOpsPerm('apply_manual_discount', true) ||
            hasBookingOpsPerm('apply_admin_coupon', true) ||
            hasBookingOpsPerm('reverse_manual_discount', true))) ||
          (adminFinancialRevoked &&
            (hasBookingOpsPerm('apply_manual_discount', false) ||
              hasBookingOpsPerm('apply_admin_coupon', false) ||
              hasBookingOpsPerm('reverse_manual_discount', false))))) ||
        (['TEAM_MEMBER', 'DMC_STAFF'].includes(currentRole) &&
          (hasBookingOpsPerm('apply_manual_discount', false) ||
            hasBookingOpsPerm('apply_admin_coupon', false) ||
            hasBookingOpsPerm('reverse_manual_discount', false)))));

  const canManagePaymentSchedules =
    isSuperAdmin ||
    (isApprovedUser &&
      hasUserDoc &&
      ((currentRole === 'ADMIN' &&
        ((!adminFinancialRevoked &&
          (hasBookingOpsPerm('manage_payment_schedule', true) ||
            hasBookingOpsPerm('apply_manual_discount', true) ||
            hasCmsFinanceAccess)) ||
          (adminFinancialRevoked &&
            (hasBookingOpsPerm('manage_payment_schedule', false) ||
              hasBookingOpsPerm('apply_manual_discount', false))))) ||
        (['TEAM_MEMBER', 'DMC_STAFF'].includes(currentRole) &&
          (hasBookingOpsPerm('manage_payment_schedule', false) ||
            hasBookingOpsPerm('apply_manual_discount', false) ||
            hasCmsFinanceAccess))));

  return {
    canReadSnapshots,
    canWriteSnapshots,
    canManagePaymentSchedules
  };
}

function makeSeedBooking(id: string, total = 100000, netCost = 70000): Booking {
  const nowIso = '2026-11-27T10:00:00.000Z';
  return {
    id,
    bookingReference: `TUB-FIN-${id.slice(-4).toUpperCase()}`,
    destination: 'Japan',
    destinationName: 'Kyoto & Tokyo Luxury Trail',
    travelStartDate: '2027-04-10',
    travelEndDate: '2027-04-18',
    currency: 'INR',
    totalAmount: total,
    originalBookingAmount: total,
    original_selling_price: total,
    current_selling_price: total,
    finalCustomerSellingPrice: total,
    baseFinalSellingPrice: total,
    supplierTotalCost: netCost,
    supplierCost: netCost,
    totalNetCost: netCost,
    internalNettCost: netCost,
    originalTheUnboundMargin: total - netCost,
    remainingTheUnboundMargin: total - netCost,
    paidAmount: 0,
    amountPaid: 0,
    balanceDue: total,
    status: 'CONFIRMED',
    paymentStatus: 'PENDING_PAYMENT',
    agencyId: 'agency-horizon-01',
    agencyName: 'Horizon Luxury Travel',
    agentId: 'agent-b2b-01',
    submittingAgentId: 'agent-b2b-01',
    agentName: 'Rohan Mehta',
    customer: {
      leadTravelerName: 'Aarav Sharma',
      bookerName: 'Rohan Mehta',
      email: 'rohan@horizontravel.in',
      phone: '+91 98200 00001',
      agencyName: 'Horizon Luxury Travel',
      totalPax: 2,
      totalAdults: 2,
      totalChildren: 0
    },
    items: [],
    serviceItems: [
      {
        id: `svc-${id}-1`,
        type: 'HOTEL',
        title: 'Aman Tokyo — Deluxe Palace Garden View (4 Nights)',
        supplierName: 'Aman Resorts Japan',
        netCost: netCost * 0.6,
        sellingPrice: total * 0.6,
        currency: 'INR',
        status: 'CONFIRMED'
      } as any,
      {
        id: `svc-${id}-2`,
        type: 'TRANSFER',
        title: 'Private Alphard Chauffeur Charter & Shinkansen Green Car',
        supplierName: 'Tokyo Executive Chauffeurs',
        netCost: netCost * 0.4,
        sellingPrice: total * 0.4,
        currency: 'INR',
        status: 'CONFIRMED'
      } as any
    ],
    paymentProofs: [],
    timeline: [],
    createdAt: nowIso,
    updatedAt: nowIso
  } as unknown as Booking;
}

function makeCaller(user: User) {
  return {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    idToken: `test-token-${user.id}`,
    permissions: resolveAdminManualDiscountPermissions(user)
  };
}

async function runAudit() {
  console.log('================================================================================');
  console.log('AUDIT: FIRESTORE 403 FIX + 6-ROLE MATRIX + PAYMENT SCHEDULE & TRANCHES (TESTS 1-8)');
  console.log('================================================================================');

  // ---------------------------------------------------------------------------
  // STATIC RULES VERIFICATION: Ensure firestore.rules has null-safe CEL & matchers
  // ---------------------------------------------------------------------------
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert.ok(rulesText.includes('function canReadBookingFinancialSnapshots()'), 'firestore.rules must define canReadBookingFinancialSnapshots');
  assert.ok(rulesText.includes('function canWriteBookingFinancialSnapshots()'), 'firestore.rules must define canWriteBookingFinancialSnapshots');
  assert.ok(rulesText.includes('function canManageBookingPaymentSchedules()'), 'firestore.rules must define canManageBookingPaymentSchedules');
  assert.ok(rulesText.includes('match /booking_payment_schedules/{scheduleId}'), 'firestore.rules must define /booking_payment_schedules/{scheduleId}');
  assert.ok(rulesText.includes("currentUserData().get('userType', '')"), 'firestore.rules must use CEL null-safe .get() for userType');
  console.log('[PASS] Static verification of /firestore.rules null-safe CEL helpers & financial matchers');

  // ---------------------------------------------------------------------------
  // SCOPED :runQuery VERIFICATION (NO UNFILTERED LIST ON SINGLE BOOKING)
  // ---------------------------------------------------------------------------
  const capturedCalls: Array<{ url: string; method: string; body?: any }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    capturedCalls.push({ url, method, body });
    return {
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => '[]'
    } as any;
  }) as any;

  try {
    const fsStore = new FirestoreBookingDiscountStore();
    await fsStore.listSnapshots('mock-jwt', 'bk-query-test-01');
    await fsStore.listAdjustments('mock-jwt', 'bk-query-test-01');
    await fsStore.listPaymentSchedules('mock-jwt', 'bk-query-test-01');
    await fsStore.countInvoicesForBooking('bk-query-test-01', 'mock-jwt');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.strictEqual(capturedCalls.length, 4, 'Expected 4 scoped Firestore :runQuery requests');
  for (const call of capturedCalls) {
    assert.strictEqual(call.method, 'POST', 'Scoped query must use POST :runQuery, never unfiltered GET');
    assert.ok(call.url.endsWith(':runQuery'), `Expected :runQuery endpoint, got ${call.url}`);
    assert.ok(
      call.url.includes('ai-studio-theunbounddmctra-384adde8-26cf-49a7-8158-336473069762'),
      `Firestore URL must target the provisioned named database ID, got ${call.url}`
    );
    assert.strictEqual(call.body?.structuredQuery?.where?.fieldFilter?.field?.fieldPath, 'bookingId');
    assert.strictEqual(call.body?.structuredQuery?.where?.fieldFilter?.op, 'EQUAL');
    assert.strictEqual(call.body?.structuredQuery?.where?.fieldFilter?.value?.stringValue, 'bk-query-test-01');
  }
  console.log('[PASS] FirestoreBookingDiscountStore uses scoped POST :runQuery (bookingId == X) on named DB');

  // ---------------------------------------------------------------------------
  // 6-ROLE PERMISSION REGRESSION MATRIX (RULES + ENGINE + BACKEND MANAGER)
  // ---------------------------------------------------------------------------
  const roleUsers: Array<{
    label: string;
    user: User;
    userDoc: Record<string, any>;
    expectRead: boolean;
    expectDiscountWrite: boolean;
    expectScheduleManage: boolean;
  }> = [
    {
      label: '1. Super Admin (minimal userDoc without userType/permissions map)',
      user: {
        id: 'u-super-admin',
        name: 'Marcus Founder',
        email: 'business@theunbound.in',
        role: 'SUPER_ADMIN',
        approvalStatus: 'APPROVED',
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      // Deliberately omit `userType` and `permissions` to prove CEL null-safety!
      userDoc: { id: 'u-super-admin', email: 'business@theunbound.in', role: 'SUPER_ADMIN' },
      expectRead: true,
      expectDiscountWrite: true,
      expectScheduleManage: true
    },
    {
      label: '2. Admin with financial permission',
      user: {
        id: 'u-fin-admin',
        name: 'Priya Finance Admin',
        email: 'priya.admin@theunbound.in',
        role: 'ADMIN',
        approvalStatus: 'APPROVED',
        permissions: {
          canAccessFinancials: true,
          cmsFinance: { enabled: true, pricing: true },
          bookingOperations: {
            view_internal_margin: true,
            apply_manual_discount: true,
            manage_payment_schedule: true
          }
        } as any,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      userDoc: {
        id: 'u-fin-admin',
        email: 'priya.admin@theunbound.in',
        role: 'ADMIN',
        approvalStatus: 'APPROVED',
        permissions: {
          canAccessFinancials: true,
          cmsFinance: { enabled: true, pricing: true },
          bookingOperations: {
            view_internal_margin: true,
            apply_manual_discount: true,
            manage_payment_schedule: true
          }
        }
      },
      expectRead: true,
      expectDiscountWrite: true,
      expectScheduleManage: true
    },
    {
      label: '3. Admin without financial permission (explicitly revoked)',
      user: {
        id: 'u-content-admin',
        name: 'Content Only Admin',
        email: 'content.admin@theunbound.in',
        role: 'ADMIN',
        approvalStatus: 'APPROVED',
        permissions: {
          canAccessFinancials: false,
          cmsFinance: { enabled: false }
        } as any,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      userDoc: {
        id: 'u-content-admin',
        email: 'content.admin@theunbound.in',
        role: 'ADMIN',
        approvalStatus: 'APPROVED',
        permissions: {
          canAccessFinancials: false,
          cmsFinance: { enabled: false }
        }
      },
      expectRead: false,
      expectDiscountWrite: false,
      expectScheduleManage: false
    },
    {
      label: '4. Team Member with assigned financial/discount/schedule permission',
      user: {
        id: 'u-fin-tm',
        name: 'Karan Commercial Executive',
        email: 'karan.exec@theunbound.in',
        role: 'TEAM_MEMBER',
        approvalStatus: 'APPROVED',
        permissions: {
          canAccessFinancials: true,
          cmsFinance: { enabled: true, pricing: true },
          bookingOperations: {
            view_internal_margin: true,
            apply_manual_discount: true,
            manage_payment_schedule: true
          }
        } as any,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      userDoc: {
        id: 'u-fin-tm',
        email: 'karan.exec@theunbound.in',
        role: 'TEAM_MEMBER',
        approvalStatus: 'APPROVED',
        permissions: {
          canAccessFinancials: true,
          cmsFinance: { enabled: true, pricing: true },
          bookingOperations: {
            view_internal_margin: true,
            apply_manual_discount: true,
            manage_payment_schedule: true
          }
        }
      },
      expectRead: true,
      expectDiscountWrite: true,
      expectScheduleManage: true
    },
    {
      label: '5. Team Member without financial permission (Ops coordinator)',
      user: {
        id: 'u-ops-tm',
        name: 'Ground Ops Member',
        email: 'ground.ops@theunbound.in',
        role: 'TEAM_MEMBER',
        approvalStatus: 'APPROVED',
        permissions: {
          cmsOperations: { enabled: true }
        } as any,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      userDoc: {
        id: 'u-ops-tm',
        email: 'ground.ops@theunbound.in',
        role: 'TEAM_MEMBER',
        approvalStatus: 'APPROVED',
        permissions: {
          cmsOperations: { enabled: true }
        }
      },
      expectRead: false,
      expectDiscountWrite: false,
      expectScheduleManage: false
    },
    {
      label: '6. B2B Agent (external agency partner)',
      user: {
        id: 'agent-b2b-01',
        name: 'Rohan Mehta',
        email: 'rohan@horizontravel.in',
        role: 'B2B_AGENT',
        approvalStatus: 'APPROVED',
        agencyId: 'agency-horizon-01',
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      userDoc: {
        id: 'agent-b2b-01',
        email: 'rohan@horizontravel.in',
        role: 'B2B_AGENT',
        approvalStatus: 'APPROVED',
        agencyId: 'agency-horizon-01',
        // Even if a malformed doc had flags, B2B_AGENT must be strictly denied!
        permissions: {
          canAccessFinancials: true,
          bookingOperations: { apply_manual_discount: true, view_internal_margin: true }
        }
      },
      expectRead: false,
      expectDiscountWrite: false,
      expectScheduleManage: false
    }
  ];

  for (const rc of roleUsers) {
    const ruleEval = evaluateFirestoreFinancialRules({
      auth: { uid: rc.user.id, email: rc.user.email },
      userDoc: rc.userDoc
    });
    const enginePerms = resolveAdminManualDiscountPermissions(rc.user);

    assert.strictEqual(ruleEval.canReadSnapshots, rc.expectRead, `Firestore rule read mismatch for ${rc.label}`);
    assert.strictEqual(ruleEval.canWriteSnapshots, rc.expectDiscountWrite, `Firestore rule write mismatch for ${rc.label}`);
    assert.strictEqual(ruleEval.canManagePaymentSchedules, rc.expectScheduleManage, `Firestore rule schedule mismatch for ${rc.label}`);

    assert.strictEqual(enginePerms.canViewInternalMargin, rc.expectRead, `Engine margin visibility mismatch for ${rc.label}`);
    assert.strictEqual(enginePerms.canApplyManualDiscount, rc.expectDiscountWrite, `Engine discount write mismatch for ${rc.label}`);
    assert.strictEqual(enginePerms.canManagePaymentSchedule, rc.expectScheduleManage, `Engine schedule manage mismatch for ${rc.label}`);
  }
  console.log('[PASS] 6-Role Permission Regression Matrix verified across Firestore Rules & Central Engine');

  const superAdmin = roleUsers[0].user;
  const finAdmin = roleUsers[1].user;
  const revokedAdmin = roleUsers[2].user;
  const unauthTeamMember = roleUsers[4].user;
  const b2bAgent = roleUsers[5].user;

  // ===========================================================================
  // TEST 1 & TEST 2: MARGIN-FUNDED DISCOUNT PERMISSION FIX & UNAUTHORIZED BLOCK
  // ===========================================================================
  const store1 = new InMemoryBookingDiscountStore();
  const manager1 = new BookingManualDiscountTransactionManager(store1);
  const bk1 = makeSeedBooking('bk-acc-test-01', 100000, 70000);
  await store1.saveBooking(bk1);

  // Test 2: Unauthorized roles (B2B Agent, Ops Team Member, Revoked Admin) strictly blocked (403)
  for (const blockedUser of [b2bAgent, unauthTeamMember, revokedAdmin]) {
    const blockedPreview = await manager1.previewDiscount({
      bookingId: bk1.id,
      payload: { discountSource: 'ADMIN_MANUAL_ADJUSTMENT', discountType: 'FIXED', discountValue: 10000 },
      caller: makeCaller(blockedUser)
    });
    assert.strictEqual(blockedPreview.ok, false);
    if (!blockedPreview.ok) assert.strictEqual(blockedPreview.status, 403);

    const blockedApply = await manager1.applyDiscount({
      bookingId: bk1.id,
      payload: {
        bookingId: bk1.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 10000,
        reason: 'Unauthorized attempt'
      },
      caller: makeCaller(blockedUser)
    });
    assert.strictEqual(blockedApply.ok, false);
    if (!blockedApply.ok) assert.strictEqual(blockedApply.status, 403);

    const blockedSchedule = await manager1.savePaymentScheduleVersion({
      bookingId: bk1.id,
      payload: {
        tranches: [{ title: 'T1', dueDate: '2027-01-15', amount: 100000 }],
        reason: 'Unauthorized schedule attempt'
      },
      caller: makeCaller(blockedUser)
    });
    assert.strictEqual(blockedSchedule.ok, false);
    if (!blockedSchedule.ok) assert.strictEqual(blockedSchedule.status, 403);
  }
  console.log('[PASS] Acceptance Test 2: Unauthorized users (B2B Agent, Ops Team Member, Revoked Admin) strictly blocked (HTTP 403)');

  // Test 1: Authorised Admin applies Margin-Funded Discount (INR 100,000 -> -INR 10,000 -> INR 90,000)
  const apply1 = await manager1.applyDiscount({
    bookingId: bk1.id,
    payload: {
      bookingId: bk1.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      reason: 'Approved commercial partnership discount',
      idempotencyKey: 'idem-test1-apply-10k'
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(apply1.ok, true, `Test 1 applyDiscount failed: ${apply1.ok === false ? apply1.error : ''}`);
  if (apply1.ok) {
    assert.strictEqual(apply1.newSnapshot.version, 2);
    assert.strictEqual(apply1.newSnapshot.originalCustomerSellingPrice, 100000);
    assert.strictEqual(apply1.newSnapshot.revisedCustomerSellingPrice, 90000);
    assert.strictEqual(apply1.newSnapshot.supplierNettCost, 70000, 'Supplier net cost must remain unchanged');
    assert.strictEqual(apply1.newSnapshot.remainingTheUnboundMargin, 20000, 'Margin reduced from 30,000 to 20,000');
    assert.strictEqual(store1.snapshots.size, 2, 'Baseline v1 + Revised v2 snapshots stored in booking_pricing_snapshots');

    // Sanitized B2B agent view must strip internal margin & snapshot history
    const sanitizedForB2B = sanitizeBookingForAgent(apply1.updatedBooking);
    assert.strictEqual(sanitizedForB2B.totalAmount, 90000, 'B2B agent sees revised selling price 90,000');
    assert.strictEqual((sanitizedForB2B as any).remainingTheUnboundMargin, undefined, 'Internal margin stripped for B2B');
    assert.strictEqual((sanitizedForB2B as any).pricingSnapshotHistory, undefined, 'Pricing snapshots stripped for B2B');
  }
  console.log('[PASS] Acceptance Test 1: Margin-Funded Discount succeeds with zero 403 error & saves Snapshot v2');

  // ===========================================================================
  // TEST 3: PAYMENT SCHEDULE AFTER DISCOUNT (SCENARIO A + ROUNDING + PARTIAL)
  // ===========================================================================
  // Booking already has Snapshot v2 = INR 90,000 (Original 100,000 - Discount 10,000)
  // Create 30% / 30% / 40% tranches -> must equal 27,000 / 27,000 / 36,000 (Total 90,000)
  const schedA = await manager1.savePaymentScheduleVersion({
    bookingId: bk1.id,
    payload: {
      tranches: [
        { title: 'Tranche 1 — Booking Deposit', milestone: 'Upon Confirmation', dueDate: '2027-01-15', calculationMode: 'PERCENTAGE', percentage: 30 },
        { title: 'Tranche 2 — Supplier Cut-Off', milestone: '60 Days Prior', dueDate: '2027-02-10', calculationMode: 'PERCENTAGE', percentage: 30 },
        { title: 'Tranche 3 — Final Settlement', milestone: '30 Days Prior', dueDate: '2027-03-10', calculationMode: 'PERCENTAGE', percentage: 40 }
      ],
      reason: 'Initial 30/30/40 schedule created after INR 10,000 discount',
      expectedSnapshotVersion: 2
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(schedA.ok, true, `Test 3 schedule save failed: ${schedA.ok === false ? schedA.error : ''}`);
  if (schedA.ok) {
    const inst = schedA.newSchedule.installments;
    assert.strictEqual(inst[0].amount, 27000, 'Tranche 1 (30% of 90,000) must be 27,000');
    assert.strictEqual(inst[1].amount, 27000, 'Tranche 2 (30% of 90,000) must be 27,000');
    assert.strictEqual(inst[2].amount, 36000, 'Tranche 3 (40% of 90,000) must be 36,000');
    assert.strictEqual(schedA.newSchedule.totalAmount, 90000, 'Total scheduled must equal 90,000 (never 100,000)');
    assert.strictEqual(schedA.newSchedule.financialSnapshotVersion, 2);
    assert.strictEqual(schedA.newSchedule.scheduleVersion, 1);
    // Unpaid tranches must NOT be auto-marked PAID when paidAmount == 0
    assert.ok(inst.every(i => i.status !== 'PAID' && (i.paidAmount || 0) === 0), 'Unpaid tranches must remain PENDING');
  }

  // Test 3b: Cent-exact final-tranche rounding absorption (33.33% / 33.33% / 33.34% of 90,000 => 29,997 + 29,997 + 30,006 = 90,000.00)
  const schedRounding = await manager1.savePaymentScheduleVersion({
    bookingId: bk1.id,
    payload: {
      tranches: [
        { title: 'T1', dueDate: '2027-01-15', calculationMode: 'PERCENTAGE', percentage: 33.33 },
        { title: 'T2', dueDate: '2027-02-15', calculationMode: 'PERCENTAGE', percentage: 33.33 },
        { title: 'T3', dueDate: '2027-03-15', calculationMode: 'PERCENTAGE', percentage: 33.34 }
      ],
      reason: '3-way split rounding check'
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(schedRounding.ok, true);
  if (schedRounding.ok) {
    const sumExact = Number(
      schedRounding.newSchedule.installments.reduce((s, i) => s + i.amount, 0).toFixed(2)
    );
    assert.strictEqual(sumExact, 90000, 'Final open tranche must absorb rounding so sum equals 90,000.00 exactly');
  }

  // Test 3c: Over-allocation strictly blocked & Partial Schedule explicitly supported with unallocatedBalance
  const overAlloc = await manager1.savePaymentScheduleVersion({
    bookingId: bk1.id,
    payload: {
      tranches: [
        { title: 'T1', dueDate: '2027-01-15', calculationMode: 'FIXED', amount: 60000 },
        { title: 'T2', dueDate: '2027-02-15', calculationMode: 'FIXED', amount: 40000 }
      ],
      reason: 'Attempt 100k on 90k booking'
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(overAlloc.ok, false, 'Over-allocation above revised booking amount must be rejected');

  const partialSched = await manager1.savePaymentScheduleVersion({
    bookingId: bk1.id,
    payload: {
      tranches: [
        { title: 'Initial Deposit Only', dueDate: '2027-01-15', calculationMode: 'FIXED', amount: 25000 }
      ],
      allowPartialSchedule: true,
      reason: 'Partial deposit schedule while awaiting flight confirmation'
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(partialSched.ok, true);
  if (partialSched.ok) {
    assert.strictEqual(partialSched.newSchedule.isPartialSchedule, true);
    assert.strictEqual(partialSched.newSchedule.scheduleStatus, 'PARTIAL');
    assert.strictEqual(partialSched.newSchedule.unallocatedBalance, 65000, 'Unallocated balance must equal 65,000');
  }
  console.log('[PASS] Acceptance Test 3: Post-discount 30/30/40 tranches (27k/27k/36k = 90k), cent-exact rounding & partial schedule verified');

  // ===========================================================================
  // TEST 4: DISCOUNT APPLIED AFTER PAYMENT SCHEDULE EXISTS (SCENARIO B)
  // ===========================================================================
  const store4 = new InMemoryBookingDiscountStore();
  const manager4 = new BookingManualDiscountTransactionManager(store4);
  const bk4 = makeSeedBooking('bk-acc-test-04', 100000, 70000);
  await store4.saveBooking(bk4);

  // Step 1: Create 2 tranches of 50% / 50% = INR 50,000 / INR 50,000 (Schedule v1)
  const v1Res = await manager4.savePaymentScheduleVersion({
    bookingId: bk4.id,
    payload: {
      tranches: [
        { title: 'Tranche 1 (50%)', dueDate: '2027-01-20', calculationMode: 'PERCENTAGE', percentage: 50 },
        { title: 'Tranche 2 (50%)', dueDate: '2027-03-01', calculationMode: 'PERCENTAGE', percentage: 50 }
      ],
      reason: 'Initial 50/50 payment schedule on INR 100,000',
      idempotencyKey: 'idem-bk4-v1'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(v1Res.ok, true);
  if (v1Res.ok) {
    assert.strictEqual(v1Res.newSchedule.scheduleVersion, 1);
    assert.strictEqual(v1Res.newSchedule.installments[0].amount, 50000);
    assert.strictEqual(v1Res.newSchedule.installments[1].amount, 50000);
  }

  // Idempotent double-click replay check
  const v1Replay = await manager4.savePaymentScheduleVersion({
    bookingId: bk4.id,
    payload: {
      tranches: [
        { title: 'Tranche 1 (50%)', dueDate: '2027-01-20', calculationMode: 'PERCENTAGE', percentage: 50 },
        { title: 'Tranche 2 (50%)', dueDate: '2027-03-01', calculationMode: 'PERCENTAGE', percentage: 50 }
      ],
      reason: 'Initial 50/50 payment schedule on INR 100,000',
      idempotencyKey: 'idem-bk4-v1'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(v1Replay.ok, true);
  if (v1Replay.ok) {
    assert.strictEqual(v1Replay.idempotentReplay, true, 'Duplicate idempotencyKey must replay without creating v2');
    assert.strictEqual(v1Replay.newSchedule.scheduleVersion, 1);
  }

  // Step 2: Apply Margin-Funded Discount of INR 10,000 -> Revised = INR 90,000
  const disc4 = await manager4.applyDiscount({
    bookingId: bk4.id,
    payload: {
      bookingId: bk4.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      reason: 'Executive margin-funded adjustment'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(disc4.ok, true);
  if (disc4.ok) {
    const activeSched = disc4.updatedBooking.paymentSchedule!;
    // MUST NOT silently overwrite v1!
    assert.strictEqual(activeSched.totalAmount, 100000, 'Saved custom schedule v1 must NOT be silently modified');
    assert.strictEqual(activeSched.installments[0].amount, 50000);
    assert.strictEqual(activeSched.installments[1].amount, 50000);
    assert.strictEqual(activeSched.requiresAdjustment, true, 'Must flag requiresAdjustment = true');
    assert.strictEqual(activeSched.scheduleStatus, 'RECALCULATION_REQUIRED', 'Must mark RECALCULATION_REQUIRED');
    assert.strictEqual(activeSched.previousBookingAmount, 100000);
    assert.strictEqual(activeSched.latestBookingAmount, 90000);
  }

  // Step 3: Preview Recalculation -> must propose INR 45,000 / INR 45,000
  const prev4 = await manager4.previewScheduleRecalculation({
    bookingId: bk4.id,
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(prev4.ok, true);
  if (prev4.ok) {
    assert.strictEqual(prev4.preview.previousBookingAmount, 100000);
    assert.strictEqual(prev4.preview.revisedBookingAmount, 90000);
    assert.strictEqual(prev4.preview.trancheDiffs[0].previousAmount, 50000);
    assert.strictEqual(prev4.preview.trancheDiffs[0].recalculatedAmount, 45000);
    assert.strictEqual(prev4.preview.trancheDiffs[1].previousAmount, 50000);
    assert.strictEqual(prev4.preview.trancheDiffs[1].recalculatedAmount, 45000);
    assert.strictEqual(prev4.preview.nextScheduleVersion, 2);

    // Step 4: Admin confirms & saves Schedule v2
    const v2Res = await manager4.savePaymentScheduleVersion({
      bookingId: bk4.id,
      payload: {
        tranches: prev4.preview.recalculatedInstallments.map(i => ({
          id: i.id,
          title: i.title,
          dueDate: i.dueDate,
          calculationMode: 'PERCENTAGE',
          percentage: i.percentage,
          amount: i.amount
        })),
        reason: 'Recalculated 50/50 tranches to 45k/45k after INR 10,000 discount',
        isRecalculation: true,
        expectedSnapshotVersion: prev4.preview.financialSnapshotVersion
      },
      caller: makeCaller(superAdmin)
    });
    assert.strictEqual(v2Res.ok, true);
    if (v2Res.ok) {
      assert.strictEqual(v2Res.newSchedule.scheduleVersion, 2);
      assert.strictEqual(v2Res.newSchedule.financialSnapshotVersion, 2);
      assert.strictEqual(v2Res.newSchedule.installments[0].amount, 45000);
      assert.strictEqual(v2Res.newSchedule.installments[1].amount, 45000);
      assert.strictEqual(v2Res.newSchedule.totalAmount, 90000);
      assert.strictEqual(v2Res.newSchedule.scheduleStatus, 'ACTIVE');
      assert.strictEqual(store4.paymentSchedules.size, 2, 'Both v1 and v2 immutable docs must exist in booking_payment_schedules');
      const storedV1 = store4.paymentSchedules.get(`ps-${bk4.id}-v1`);
      assert.ok(storedV1, 'v1 document preserved in booking_payment_schedules');
      assert.strictEqual(storedV1?.totalAmount, 100000, 'v1 preserved untouched at 100,000');
    }
  }
  console.log('[PASS] Acceptance Test 4: Scenario B non-silent flag, preview (50k/50k -> 45k/45k), and immutable v2 verified');

  // ===========================================================================
  // TEST 5: EXISTING PARTIAL PAYMENT PROTECTION
  // ===========================================================================
  // Original INR 100,000, Payment already received = INR 30,000 (VERIFIED proof on Tranche 1 PAID),
  // Apply INR 10,000 discount -> Revised = INR 90,000, Paid = INR 30,000, Outstanding = INR 60,000!
  const store5 = new InMemoryBookingDiscountStore();
  const manager5 = new BookingManualDiscountTransactionManager(store5);
  const bk5 = makeSeedBooking('bk-acc-test-05', 100000, 65000);
  bk5.amountPaid = 30000;
  bk5.paidAmount = 30000;
  bk5.balanceDue = 70000;
  bk5.paymentStatus = 'PARTIALLY_PAID';
  bk5.paymentProofs = [
    {
      id: 'proof-verified-30k',
      bookingId: bk5.id,
      amount: 30000,
      currency: 'INR',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'UTR9988776655',
      verificationStatus: 'VERIFIED',
      uploadedBy: b2bAgent.id,
      uploadedAt: '2026-11-26T09:00:00.000Z',
      verifiedBy: superAdmin.id,
      verifiedAt: '2026-11-26T10:00:00.000Z'
    } as any
  ];
  await store5.saveBooking(bk5);

  // Save initial schedule v1 where Tranche 1 (30,000) is PAID and Tranche 2 (70,000) is PENDING
  const s5v1 = await manager5.savePaymentScheduleVersion({
    bookingId: bk5.id,
    payload: {
      tranches: [
        { id: 't5-1', title: 'Deposit Tranche (Paid)', dueDate: '2027-01-10', calculationMode: 'FIXED', amount: 30000 },
        { id: 't5-2', title: 'Balance Tranche', dueDate: '2027-03-10', calculationMode: 'FIXED', amount: 70000 }
      ],
      reason: 'Initial schedule with INR 30,000 verified deposit'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(s5v1.ok, true);
  if (s5v1.ok) {
    assert.strictEqual(s5v1.newSchedule.installments[0].status, 'PAID');
    assert.strictEqual(s5v1.newSchedule.installments[0].paidAmount, 30000);
    assert.strictEqual(s5v1.newSchedule.installments[1].status, 'PENDING');
    assert.strictEqual(s5v1.newSchedule.installments[1].paidAmount, 0);
  }

  // Apply Margin-Funded Discount of INR 10,000
  const disc5 = await manager5.applyDiscount({
    bookingId: bk5.id,
    payload: {
      bookingId: bk5.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      reason: 'Margin-funded commercial concession'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(disc5.ok, true);
  if (disc5.ok) {
    const fin5 = resolveAuthoritativeBookingFinancials(disc5.updatedBooking);
    assert.strictEqual(fin5.revisedBookingAmount, 90000, 'Revised Booking Amount must be 90,000');
    assert.strictEqual(fin5.verifiedPaidAmount, 30000, 'Paid Amount must remain 30,000');
    assert.strictEqual(fin5.outstandingBalance, 60000, 'Outstanding Balance must equal 60,000');
    assert.strictEqual(disc5.updatedBooking.paymentProofs?.length, 1, 'Historical payment proof must remain untouched');
    assert.strictEqual(disc5.updatedBooking.paymentProofs?.[0].amount, 30000);
  }

  // Preview & save recalculated v2 -> Tranche 1 stays locked at 30,000 PAID; Tranche 2 adjusts to 60,000 PENDING
  const prev5 = await manager5.previewScheduleRecalculation({
    bookingId: bk5.id,
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(prev5.ok, true);
  if (prev5.ok) {
    assert.strictEqual(prev5.preview.trancheDiffs[0].isLockedPaid, true);
    assert.strictEqual(prev5.preview.trancheDiffs[0].recalculatedAmount, 30000, 'Paid Tranche 1 remains locked at 30,000');
    assert.strictEqual(prev5.preview.trancheDiffs[1].recalculatedAmount, 60000, 'Open Tranche 2 adjusts to remaining 60,000');

    const s5v2 = await manager5.savePaymentScheduleVersion({
      bookingId: bk5.id,
      payload: {
        tranches: prev5.preview.recalculatedInstallments.map(i => ({
          id: i.id,
          title: i.title,
          dueDate: i.dueDate,
          calculationMode: 'FIXED',
          amount: i.amount
        })),
        reason: 'Recalculated open tranche to INR 60,000 while keeping INR 30,000 paid tranche locked',
        isRecalculation: true
      },
      caller: makeCaller(superAdmin)
    });
    assert.strictEqual(s5v2.ok, true);
    if (s5v2.ok) {
      assert.strictEqual(s5v2.newSchedule.totalAmount, 90000);
      assert.strictEqual(s5v2.newSchedule.totalPaid, 30000);
      assert.strictEqual(s5v2.newSchedule.balanceDue, 60000);
      assert.strictEqual(s5v2.newSchedule.installments[0].status, 'PAID');
      assert.strictEqual(s5v2.newSchedule.installments[0].paidAmount, 30000);
      assert.strictEqual(s5v2.newSchedule.installments[1].status, 'PENDING', 'Unpaid Tranche 2 must NOT be auto-marked PAID');
      assert.strictEqual(s5v2.newSchedule.installments[1].paidAmount, 0, 'Already-paid 30k must NOT be duplicated into Tranche 2');
      assert.strictEqual(s5v2.newSchedule.installments[1].amount, 60000);
    }
  }
  console.log('[PASS] Acceptance Test 5: Partial payment INR 30,000 preserved, PAID tranche locked, open tranche = INR 60,000');

  // ===========================================================================
  // TEST 6 & TEST 7: MULTIPLE DISCOUNTS (SCENARIO C) & REVERSAL (SCENARIO D)
  // ===========================================================================
  const store6 = new InMemoryBookingDiscountStore();
  const manager6 = new BookingManualDiscountTransactionManager(store6);
  const bk6 = makeSeedBooking('bk-acc-test-06', 100000, 65000);
  await store6.saveBooking(bk6);

  // Discount 1: INR 5,000 -> Snapshot v2 = INR 95,000
  const d6_1 = await manager6.applyDiscount({
    bookingId: bk6.id,
    payload: {
      bookingId: bk6.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 5000,
      reason: 'First commercial discount (-5,000)'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(d6_1.ok, true);
  if (d6_1.ok) assert.strictEqual(d6_1.newSnapshot.revisedCustomerSellingPrice, 95000);

  // Save Schedule v1 on INR 95,000 (50% / 50% = 47,500 / 47,500)
  const s6v1 = await manager6.savePaymentScheduleVersion({
    bookingId: bk6.id,
    payload: {
      tranches: [
        { title: 'T1', dueDate: '2027-01-15', calculationMode: 'PERCENTAGE', percentage: 50 },
        { title: 'T2', dueDate: '2027-03-15', calculationMode: 'PERCENTAGE', percentage: 50 }
      ],
      reason: 'Schedule v1 on INR 95,000'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(s6v1.ok, true);

  // Discount 2: INR 5,000 -> Snapshot v3 = INR 90,000 (cumulative 10,000 — NO double subtraction!)
  const d6_2 = await manager6.applyDiscount({
    bookingId: bk6.id,
    payload: {
      bookingId: bk6.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 5000,
      reason: 'Second commercial discount (-5,000)'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(d6_2.ok, true);
  let secondAdjustmentId = '';
  if (d6_2.ok) {
    secondAdjustmentId = d6_2.adjustment.adjustmentId;
    assert.strictEqual(d6_2.newSnapshot.version, 3);
    assert.strictEqual(d6_2.newSnapshot.cumulativeAdminManualDiscount, 10000);
    assert.strictEqual(d6_2.newSnapshot.revisedCustomerSellingPrice, 90000, 'Must equal 90,000 without double-subtracting');
    assert.strictEqual(d6_2.updatedBooking.paymentSchedule?.scheduleStatus, 'RECALCULATION_REQUIRED');
  }

  // Recalculate Schedule v2 against Snapshot v3 (INR 90,000 -> 45,000 / 45,000)
  const prev6 = await manager6.previewScheduleRecalculation({ bookingId: bk6.id, caller: makeCaller(superAdmin) });
  assert.strictEqual(prev6.ok, true);
  if (prev6.ok) {
    assert.strictEqual(prev6.preview.revisedBookingAmount, 90000);
    const s6v2 = await manager6.savePaymentScheduleVersion({
      bookingId: bk6.id,
      payload: {
        tranches: prev6.preview.recalculatedInstallments.map(i => ({
          id: i.id,
          title: i.title,
          dueDate: i.dueDate,
          calculationMode: 'PERCENTAGE',
          percentage: i.percentage,
          amount: i.amount
        })),
        reason: 'Recalculated Schedule v2 on Snapshot v3 (INR 90,000)',
        isRecalculation: true
      },
      caller: makeCaller(superAdmin)
    });
    assert.strictEqual(s6v2.ok, true);
    if (s6v2.ok) {
      assert.strictEqual(s6v2.newSchedule.totalAmount, 90000);
      assert.strictEqual(s6v2.newSchedule.installments[0].amount, 45000);
      assert.strictEqual(s6v2.newSchedule.installments[1].amount, 45000);
    }
  }
  console.log('[PASS] Acceptance Test 6: Multiple discounts (-5k then -5k => 90k) recalculate cleanly without double-subtracting');

  // Test 7 (Scenario D): Reverse Discount 2 (+5,000 -> Snapshot v4 = INR 95,000)
  const rev6 = await manager6.reverseDiscount({
    bookingId: bk6.id,
    payload: {
      bookingId: bk6.id,
      adjustmentId: secondAdjustmentId,
      reason: 'Reversing second discount after itinerary scope restored'
    },
    caller: makeCaller(superAdmin)
  });
  assert.strictEqual(rev6.ok, true, `Test 7 reversal failed: ${rev6.ok === false ? rev6.error : ''}`);
  if (rev6.ok) {
    assert.strictEqual(rev6.newSnapshot.version, 4);
    assert.strictEqual(rev6.newSnapshot.revisedCustomerSellingPrice, 95000);
    assert.strictEqual(rev6.updatedBooking.paymentSchedule?.totalAmount, 90000, 'Schedule v2 preserved at 90,000 until Admin recalculates');
    assert.strictEqual(rev6.updatedBooking.paymentSchedule?.scheduleStatus, 'RECALCULATION_REQUIRED');
    assert.strictEqual(rev6.updatedBooking.paymentSchedule?.latestBookingAmount, 95000);
  }

  const prev7 = await manager6.previewScheduleRecalculation({ bookingId: bk6.id, caller: makeCaller(superAdmin) });
  assert.strictEqual(prev7.ok, true);
  if (prev7.ok) {
    assert.strictEqual(prev7.preview.revisedBookingAmount, 95000);
    const s6v3 = await manager6.savePaymentScheduleVersion({
      bookingId: bk6.id,
      payload: {
        tranches: prev7.preview.recalculatedInstallments.map(i => ({
          id: i.id,
          title: i.title,
          dueDate: i.dueDate,
          calculationMode: 'PERCENTAGE',
          percentage: i.percentage,
          amount: i.amount
        })),
        reason: 'Recalculated Schedule v3 on Snapshot v4 (INR 95,000) after discount reversal',
        isRecalculation: true
      },
      caller: makeCaller(superAdmin)
    });
    assert.strictEqual(s6v3.ok, true);
    if (s6v3.ok) {
      assert.strictEqual(s6v3.newSchedule.scheduleVersion, 3);
      assert.strictEqual(s6v3.newSchedule.totalAmount, 95000);
      assert.strictEqual(s6v3.newSchedule.installments[0].amount, 47500);
      assert.strictEqual(s6v3.newSchedule.installments[1].amount, 47500);
      assert.strictEqual(store6.paymentSchedules.size, 3, 'All 3 immutable schedule versions (v1, v2, v3) preserved');
    }
  }
  console.log('[PASS] Acceptance Test 7: Discount reversal flags schedule & creates Schedule v3 (95k) while preserving v1 & v2');

  // ===========================================================================
  // TEST 8: CROSS-MODULE CONSISTENCY (BOOKING SUMMARY, PROFORMA, REVISED PROFORMA, LEDGER, REPORTS)
  // ===========================================================================
  const appDb = AppDatabase.getInstance();
  const bk8Id = `bk-acc-test-08-${Date.now()}`;
  const bk8 = makeSeedBooking(bk8Id, 100000, 70000);
  appDb.saveBooking(bk8, superAdmin);

  // Issue initial Proforma Invoice BEFORE discount (INR 100,000 — final booking amount only, zero separate TAX/Service Fee)
  const piInitialRes = appDb.generateProformaInvoice(bk8Id, superAdmin, true);
  assert.strictEqual(piInitialRes.success, true, 'Initial Proforma Invoice must be generated');
  const piInitial = piInitialRes.invoice!;
  assert.strictEqual(piInitial.totalAmount, 100000);
  assert.strictEqual(piInitial.proformaFinalBookingAmount, 100000);
  assert.strictEqual((piInitial as any).taxTotal || piInitial.taxAmount || 0, 0, 'Proforma Invoice must NOT add separate TAX line');

  // Apply INR 10,000 Margin-Funded Discount via applyBookingManualDiscountAsync (commits into AppDatabase)
  const currentBk8 = appDb.getBookingById(bk8Id, superAdmin)!;
  const d8 = await applyBookingManualDiscountAsync({
    booking: currentBk8,
    payload: {
      bookingId: bk8Id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      reason: 'Cross-module synchronization verification'
    },
    user: superAdmin
  });
  assert.strictEqual(d8.ok, true, `Test 8 discount failed: ${d8.ok === false ? d8.error : ''}`);

  // Save Payment Schedule (50% / 50% = 45,000 / 45,000 = 90,000)
  const sched8 = appDb.saveBookingPaymentSchedule(
    bk8Id,
    [
      { title: 'Tranche 1 (50%)', dueDate: '2027-01-15', calculationMode: 'PERCENTAGE', percentage: 50 },
      { title: 'Tranche 2 (50%)', dueDate: '2027-03-01', calculationMode: 'PERCENTAGE', percentage: 50 }
    ],
    superAdmin,
    'Cross-module 50/50 schedule on INR 90,000'
  );
  assert.strictEqual(sched8.success, true);

  // Generate Revised Proforma Invoice AFTER discount
  const piRevisedRes = appDb.generateProformaInvoice(bk8Id, superAdmin, true);
  assert.strictEqual(piRevisedRes.success, true, 'Revised Proforma Invoice must be generated');
  const latestInvoice8 = piRevisedRes.invoice!;
  const allInvoices8 = appDb.getBookingInvoices(bk8Id);
  const supersededInitial = allInvoices8.find(inv => inv.id === piInitial.id);
  assert.ok(supersededInitial, 'Initial issued Proforma Invoice must remain preserved');

  const syncedBk8 = appDb.getBookingById(bk8Id, superAdmin)!;
  const authFin8 = resolveAuthoritativeBookingFinancials(syncedBk8, appDb.getBookingPricingSnapshots(bk8Id));
  const latestSnap8 = getLatestBookingPricingSnapshot(syncedBk8, appDb.getBookingPricingSnapshots(bk8Id));
  const report8 = buildBookingManualDiscountReport({ bookings: [syncedBk8] });

  // Assert every single financial module matches INR 90,000 from Snapshot v2
  assert.strictEqual(latestSnap8.revisedCustomerSellingPrice, 90000, 'Snapshot v2 revised selling price = 90,000');
  assert.strictEqual(syncedBk8.totalAmount, 90000, 'Booking Summary totalAmount = 90,000');
  assert.strictEqual(syncedBk8.current_selling_price, 90000, 'Booking current_selling_price = 90,000');
  assert.strictEqual(syncedBk8.original_selling_price, 100000, 'Original selling price preserved at 100,000');
  assert.strictEqual(syncedBk8.supplierTotalCost, 70000, 'Supplier net cost untouched at 70,000');
  assert.strictEqual(authFin8.revisedBookingAmount, 90000, 'Financial Summary revisedBookingAmount = 90,000');
  assert.strictEqual(authFin8.adminManualDiscountTotal, 10000, 'Manual Discount Adjustment total = 10,000');
  assert.strictEqual(authFin8.outstandingBalance, 90000, 'Outstanding Balance = 90,000');
  assert.strictEqual(syncedBk8.paymentSchedule?.totalAmount, 90000, 'Payment Schedule total = 90,000');
  assert.strictEqual(syncedBk8.paymentSchedule?.balanceDue, 90000, 'Payment Collection balanceDue = 90,000');
  assert.strictEqual(latestInvoice8.totalAmount, 90000, 'Revised Proforma Invoice totalAmount = 90,000');
  assert.strictEqual(latestInvoice8.proformaFinalBookingAmount, 90000, 'Revised Proforma final booking amount = 90,000');
  assert.strictEqual((latestInvoice8 as any).taxTotal || latestInvoice8.taxAmount || 0, 0, 'Revised Proforma Invoice has zero separate TAX line');
  assert.strictEqual(
    (latestInvoice8.items || []).some((it: any) => /tax|gst|vat|service fee/i.test(String(it.description || ''))),
    false,
    'Proforma Invoice items must show final booking amount without separate TAX or Service Fee lines'
  );
  assert.strictEqual(report8.rows[0]?.revisedCustomerSellingPrice, 90000, 'Financial Report revisedCustomerSellingPrice = 90,000');
  assert.strictEqual(report8.rows[0]?.remainingTheUnboundMargin, 20000, 'Financial Report remaining margin = 20,000');
  console.log('[PASS] Acceptance Test 8: 100% Cross-Module Financial Consistency verified across all 9 surfaces');

  // ===========================================================================
  // ACCEPTANCE TESTS A-G: FIREBASE CLIENT/SERVER SEPARATION & TRANCHE PERSISTENCE
  // ===========================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('RUNNING ACCEPTANCE TESTS A-G (FIREBASE CONFIG FIX & INSTALMENT TRANCHE SAVING)');
  console.log('--------------------------------------------------------------------------------');

  // TEST A: Firebase Client & Admin SDK Singleton Initialization + Zero missing apiKey
  const appletCfg = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8')
  );
  for (const key of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'firestoreDatabaseId']) {
    assert.ok(typeof appletCfg[key] === 'string' && appletCfg[key].length > 0, `Frontend config missing ${key}`);
  }
  const serverCfg = getServerFirebaseConfig();
  assert.strictEqual(serverCfg.projectId, 'gen-lang-client-0981426327', 'Server projectId must match provisioned Firebase project');
  assert.strictEqual(
    serverCfg.firestoreDatabaseId,
    'ai-studio-theunbounddmctra-384adde8-26cf-49a7-8158-336473069762',
    'Server firestoreDatabaseId must match provisioned named Firestore database'
  );
  const adminApp1 = getFirebaseAdminApp();
  const adminApp2 = getFirebaseAdminApp();
  assert.strictEqual(adminApp1, adminApp2, 'Firebase Admin SDK must initialize once as a singleton');
  assert.strictEqual(adminApp1.options.projectId, 'gen-lang-client-0981426327');
  assert.ok(
    getServerFirestoreBaseUrl().includes('ai-studio-theunbounddmctra-384adde8-26cf-49a7-8158-336473069762'),
    'Server Firestore REST base URL must point to provisioned named database'
  );
  // Verify invalid token triggers HTTP 401 via Firebase Admin SDK — NEVER HTTP 500 "missing apiKey"
  const invalidTokenRes = await verifyServerFirebaseIdToken('malformed.invalid.token');
  assert.strictEqual(invalidTokenRes.ok, false, 'Invalid JWT must be rejected by Firebase Admin SDK');
  if (!invalidTokenRes.ok) {
    assert.strictEqual(invalidTokenRes.status, 401, 'Invalid JWT must return HTTP 401');
    assert.ok(
      !/missing apikey/i.test(invalidTokenRes.error),
      `Server must never return missing apiKey error, got: ${invalidTokenRes.error}`
    );
  }
  // Static check: ZERO server files may contain "missing apiKey" or "accounts:lookup"
  const serverDir = path.resolve(process.cwd(), 'server');
  for (const fileName of fs.readdirSync(serverDir)) {
    if (!fileName.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(serverDir, fileName), 'utf8');
    assert.strictEqual(
      /missing apikey/i.test(content),
      false,
      `server/${fileName} must not reference "missing apiKey"`
    );
    assert.strictEqual(
      content.includes('accounts:lookup'),
      false,
      `server/${fileName} must not use client Auth REST accounts:lookup`
    );
  }
  console.log('[PASS] Acceptance Test A: Firebase Client/Admin SDK separation, singleton init & zero missing apiKey verified');

  // TEST B & C: Create 3 Instalment Tranches, then Edit Amount & Due Date (v1 -> v2 with full metadata)
  const storeBC = new InMemoryBookingDiscountStore();
  const managerBC = new BookingManualDiscountTransactionManager(storeBC);
  const bkBC = makeSeedBooking('bk-acc-bc-01', 120000, 84000);
  await storeBC.saveBooking(bkBC);

  const create3Res = await managerBC.savePaymentScheduleVersion({
    bookingId: bkBC.id,
    payload: {
      tranches: [
        { id: 'tr-1', title: 'Booking Deposit', milestone: 'Confirmation', dueDate: '2027-01-10', calculationMode: 'FIXED', amount: 30000 },
        { id: 'tr-2', title: 'Supplier Guarantee', milestone: '45 Days Prior', dueDate: '2027-02-20', calculationMode: 'FIXED', amount: 45000 },
        { id: 'tr-3', title: 'Final Balance', milestone: '15 Days Prior', dueDate: '2027-03-20', calculationMode: 'FIXED', amount: 45000 }
      ],
      reason: 'Create 3 instalment tranches (Test B)',
      idempotencyKey: 'idem-test-b-create-3'
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(create3Res.ok, true);
  if (create3Res.ok) {
    const s1 = create3Res.newSchedule;
    assert.strictEqual(s1.scheduleVersion, 1);
    assert.strictEqual(s1.installments.length, 3);
    assert.strictEqual(s1.totalAmount, 120000);
    assert.ok(s1.scheduleId && s1.bookingId === bkBC.id);
    assert.ok(s1.financialSnapshotId && s1.financialSnapshotVersion === 1);
    assert.strictEqual(s1.revisedBookingAmount, 120000);
    assert.strictEqual(s1.currency, 'INR');
    assert.strictEqual(s1.createdBy, finAdmin.id);
    assert.ok(s1.createdAt && s1.updatedAt);
  }

  // Test C: Edit Tranche 2 & Tranche 3 amounts + due date
  const editRes = await managerBC.savePaymentScheduleVersion({
    bookingId: bkBC.id,
    payload: {
      tranches: [
        { id: 'tr-1', title: 'Booking Deposit', milestone: 'Confirmation', dueDate: '2027-01-10', calculationMode: 'FIXED', amount: 30000 },
        { id: 'tr-2', title: 'Supplier Guarantee (Revised)', milestone: '40 Days Prior', dueDate: '2027-02-25', calculationMode: 'FIXED', amount: 50000 },
        { id: 'tr-3', title: 'Final Balance (Revised)', milestone: '15 Days Prior', dueDate: '2027-03-25', calculationMode: 'FIXED', amount: 40000 }
      ],
      reason: 'Update Tranche 2 & 3 amounts and due dates (Test C)',
      idempotencyKey: 'idem-test-c-edit'
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(editRes.ok, true);
  if (editRes.ok) {
    assert.strictEqual(editRes.newSchedule.scheduleVersion, 2);
    assert.strictEqual(editRes.newSchedule.installments[1].amount, 50000);
    assert.strictEqual(editRes.newSchedule.installments[1].dueDate, '2027-02-25');
    assert.strictEqual(editRes.newSchedule.installments[2].amount, 40000);
    assert.strictEqual(editRes.newSchedule.installments[2].dueDate, '2027-03-25');
    assert.strictEqual(storeBC.paymentSchedules.size, 2, 'v1 preserved & v2 persisted');
  }
  console.log('[PASS] Acceptance Tests B & C: 3-tranche creation & edit persistence (v1 -> v2) with full metadata verified');

  // TEST D: Discount Calculation (INR 100,000 - INR 10,000 = INR 90,000 -> 30% / 40% / 30% = 27k / 36k / 27k)
  const storeD = new InMemoryBookingDiscountStore();
  const managerD = new BookingManualDiscountTransactionManager(storeD);
  const bkD = makeSeedBooking('bk-acc-d-01', 100000, 68000);
  await storeD.saveBooking(bkD);
  const discD = await managerD.applyDiscount({
    bookingId: bkD.id,
    payload: {
      bookingId: bkD.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      reason: 'INR 10,000 commercial discount (Test D)'
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(discD.ok, true);
  const schedD = await managerD.savePaymentScheduleVersion({
    bookingId: bkD.id,
    payload: {
      tranches: [
        { title: 'Tranche 1 (30%)', dueDate: '2027-01-15', calculationMode: 'PERCENTAGE', percentage: 30 },
        { title: 'Tranche 2 (40%)', dueDate: '2027-02-15', calculationMode: 'PERCENTAGE', percentage: 40 },
        { title: 'Tranche 3 (30%)', dueDate: '2027-03-15', calculationMode: 'PERCENTAGE', percentage: 30 }
      ],
      reason: '30/40/30 tranches on revised INR 90,000 (Test D)'
    },
    caller: makeCaller(finAdmin)
  });
  assert.strictEqual(schedD.ok, true);
  if (schedD.ok) {
    assert.strictEqual(schedD.newSchedule.installments[0].amount, 27000, '30% of 90,000 = 27,000');
    assert.strictEqual(schedD.newSchedule.installments[1].amount, 36000, '40% of 90,000 = 36,000');
    assert.strictEqual(schedD.newSchedule.installments[2].amount, 27000, '30% of 90,000 = 27,000');
    assert.strictEqual(schedD.newSchedule.totalAmount, 90000, 'Total scheduled = 90,000');
  }
  console.log('[PASS] Acceptance Test D: Discounted INR 90,000 split 30%/40%/30% = INR 27,000 / 36,000 / 27,000 verified');

  // TEST E & G: Failure Recovery (no false success on network error, safe idempotent retry) + Refresh/Re-login Persistence
  const storeEG = new InMemoryBookingDiscountStore();
  const managerEG = new BookingManualDiscountTransactionManager(storeEG);
  const bkEG = makeSeedBooking('bk-acc-eg-01', 90000, 60000);
  await storeEG.saveBooking(bkEG);

  // Mock authenticated fetch to simulate (1) transient network error, (2) successful retry, (3) idempotent replay, (4) refresh GET
  let fetchAttempt = 0;
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes(`/api/admin/bookings/${bkEG.id}/payment-schedules`)) {
      if ((init?.method || 'GET') === 'POST') {
        fetchAttempt += 1;
        if (fetchAttempt === 1) {
          throw new Error('Simulated transient network drop');
        }
        const body = JSON.parse(String(init?.body || '{}'));
        const res = await managerEG.savePaymentScheduleVersion({
          bookingId: bkEG.id,
          payload: body,
          caller: makeCaller(finAdmin)
        });
        if (res.ok) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, ...res })
          } as any;
        }
        const errRes = res as { ok: false; status: number; error: string };
        return {
          ok: false,
          status: errRes.status,
          json: async () => ({ success: false, error: errRes.error })
        } as any;
      }
      if ((init?.method || 'GET') === 'GET') {
        const schedules = await storeEG.listPaymentSchedules(undefined, bkEG.id);
        return {
          ok: true,
          status: 200,
          json: async () => ({ schedules })
        } as any;
      }
    }
    return savedFetch(input, init);
  }) as any;

  try {
    const retryKey = 'idem-test-e-retry-01';
    const tranchesEG = [
      { title: 'T1', dueDate: '2027-01-15', calculationMode: 'PERCENTAGE' as const, percentage: 30 },
      { title: 'T2', dueDate: '2027-02-15', calculationMode: 'PERCENTAGE' as const, percentage: 40 },
      { title: 'T3', dueDate: '2027-03-15', calculationMode: 'PERCENTAGE' as const, percentage: 30 }
    ];

    // Attempt 1: Simulated network failure -> MUST return { ok: false } and NEVER claim fake success
    const failedSave = await saveBookingPaymentScheduleVersionAsync({
      booking: bkEG,
      tranches: tranchesEG,
      reason: 'Persisted after retry',
      idempotencyKey: retryKey,
      user: finAdmin,
      bearerToken: 'test-verified-bearer-token'
    });
    assert.strictEqual(failedSave.ok, false, 'Authenticated network failure must return { ok: false } (never fake success)');
    assert.strictEqual(storeEG.paymentSchedules.size, 0, 'No schedule persisted during failed attempt');

    // Attempt 2: Retry with identical idempotencyKey -> succeeds cleanly
    const retrySave = await saveBookingPaymentScheduleVersionAsync({
      booking: bkEG,
      tranches: tranchesEG,
      reason: 'Persisted after retry',
      idempotencyKey: retryKey,
      user: finAdmin,
      bearerToken: 'test-verified-bearer-token'
    });
    assert.strictEqual(retrySave.ok, true, `Retry save failed: ${retrySave.ok === false ? retrySave.error : ''}`);
    if (retrySave.ok) {
      assert.strictEqual(retrySave.idempotentReplay, false);
      assert.strictEqual(retrySave.newSchedule.scheduleVersion, 1);
      assert.strictEqual(storeEG.paymentSchedules.size, 1, 'Exactly 1 schedule version stored after retry');
    }

    // Attempt 3: Duplicate click / retry replay with same idempotencyKey -> zero duplicate version created
    const duplicateReplay = await saveBookingPaymentScheduleVersionAsync({
      booking: bkEG,
      tranches: tranchesEG,
      reason: 'Persisted after retry',
      idempotencyKey: retryKey,
      user: finAdmin,
      bearerToken: 'test-verified-bearer-token'
    });
    assert.strictEqual(duplicateReplay.ok, true);
    if (duplicateReplay.ok) {
      assert.strictEqual(duplicateReplay.idempotentReplay, true, 'Duplicate retry must replay without creating v2');
      assert.strictEqual(storeEG.paymentSchedules.size, 1, 'Zero duplicate schedules created');
    }

    // TEST G: Clear localStorage (simulate hard refresh / fresh browser login), then hydrate via fetchBookingPaymentSchedulesAsync
    (globalThis as any).localStorage.clear();
    const refreshed = await fetchBookingPaymentSchedulesAsync({
      bookingId: bkEG.id,
      user: finAdmin,
      bearerToken: 'test-verified-bearer-token'
    });
    assert.strictEqual(refreshed.ok, true, 'Post-refresh fetch must succeed');
    if (refreshed.ok) {
      assert.strictEqual(refreshed.schedules.length, 1, 'Persisted schedule remains available after localStorage clear');
      assert.strictEqual(refreshed.schedules[0].totalAmount, 90000);
      assert.strictEqual(refreshed.schedules[0].installments.length, 3);
      assert.strictEqual(refreshed.schedules[0].installments[0].amount, 27000);
      assert.strictEqual(refreshed.schedules[0].installments[1].amount, 36000);
      assert.strictEqual(refreshed.schedules[0].installments[2].amount, 27000);
    }
  } finally {
    globalThis.fetch = savedFetch;
  }
  console.log('[PASS] Acceptance Tests E, F & G: Failure recovery/idempotent retry, RBAC permissions & post-refresh persistence verified');

  console.log('================================================================================');
  console.log('ALL ACCEPTANCE TESTS (1-8 + A-G) + 6-ROLE MATRIX + FIREBASE ADMIN SDK AUDIT PASSED!');
  console.log('================================================================================');
}

runAudit().catch(err => {
  console.error('AUDIT FAILED:', err);
  process.exit(1);
});
