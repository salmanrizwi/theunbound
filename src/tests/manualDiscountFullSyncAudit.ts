import { inflateSync } from 'zlib';
import {
  Booking,
  CurrencyCode,
  User
} from '../types';
import { AppDatabase } from '../services/db';
import {
  calculateBookingManualDiscountPreview,
  resolveAdminManualDiscountPermissions,
  resolveAuthoritativeBookingFinancials
} from '../services/bookingManualDiscountEngine';
import {
  applyBookingManualDiscountAsync,
  reverseBookingManualDiscountAsync
} from '../services/bookingManualDiscountApiService';
import {
  evaluateProformaInvoiceFreshness,
  resolveAuthoritativeProformaAmount
} from '../services/bookingOperationsSyncService';
import { generateAndPersistProformaInvoice } from '../services/proformaInvoiceService';
import { generateProformaInvoicePDF } from '../services/bookingDocumentPdfService';
import { calculateBookingProfitability } from '../services/crmOperationsEngine';
import { DashboardMetricsService } from '../services/dashboardMetricsService';
import {
  BookingManualDiscountTransactionManager,
  InMemoryBookingDiscountStore
} from '../../server/bookingManualDiscountService';

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

/**
 * Extracts readable text from jsPDF bytes (both plain and FlateDecode streams)
 * so we verify the actual rendered PDF text of Proforma Invoices v1 and v2.
 */
function extractPdfText(pdfBytes: Uint8Array): string {
  const raw = Buffer.from(pdfBytes).toString('latin1');
  const chunks: string[] = [raw];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const inflated = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      chunks.push(inflated);
    } catch {
      chunks.push(match[1]);
    }
  }
  return chunks.join('\n');
}

function makeAdminUser(): User {
  return {
    id: 'usr-admin-sync-audit',
    name: 'Finance Director',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00.000Z'
  };
}

function makeRestrictedStaffUser(): User {
  return {
    id: 'usr-staff-no-override',
    name: 'Operations Desk Officer',
    email: 'ops.officer@theunbound.in',
    role: 'TEAM_MEMBER',
    approvalStatus: 'APPROVED',
    permissions: {
      bookingOperations: {
        view_internal_margin: true,
        apply_manual_discount: true,
        override_margin_protection: false
      }
    },
    createdAt: '2026-01-01T00:00:00.000Z'
  };
}

function createFreshBooking(db: AppDatabase, admin: User, overrides: Partial<Booking> = {}): Booking {
  const id = overrides.id || `bk-sync-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const ref = overrides.bookingReference || `TUB-SYNC-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();
  const booking: Booking = {
    id,
    bookingReference: ref,
    sourceType: 'QUOTATION',
    sourceQuoteId: 'qt-orig-immutable-1',
    destination: 'Japan',
    destinationName: 'Japan',
    currency: 'INR',
    totalAmount: 100000,
    originalBookingAmount: 100000,
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
    amountPaid: 0,
    paidAmount: 0,
    balanceDue: 100000,
    creditBalance: 0,
    overpaidAmount: 0,
    travelStartDate: '2027-05-10',
    travelEndDate: '2027-05-17',
    status: 'CONFIRMED',
    paymentStatus: 'PENDING_PAYMENT',
    agencyId: 'ag-sync-1',
    agencyName: 'Sakura Bespoke Voyages',
    submittingAgentId: 'agent-sync-1',
    submittingAgentNameSnapshot: 'Aarav Mehta',
    agentName: 'Aarav Mehta',
    customer: {
      leadTravelerName: 'Rohan Kapoor',
      bookerName: 'Rohan Kapoor',
      email: 'rohan.kapoor@example.com',
      phone: '+91-98111-22334',
      agencyName: 'Sakura Bespoke Voyages',
      nationality: 'Indian',
      totalAdults: 1,
      totalChildren: 0,
      totalInfants: 0
    },
    passengers: [
      {
        id: 'pax-1',
        firstName: 'Rohan',
        lastName: 'Kapoor',
        passengerType: 'ADULT',
        isLead: true
      } as any
    ],
    items: [
      {
        id: 'item-srv-1',
        productId: 'prod-tokyo-1',
        productName: 'Tokyo Private Executive Ground Package',
        category: 'SIGHTSEEING',
        city: 'Tokyo',
        destinationName: 'Japan',
        travelDate: '2027-05-10',
        quantity: 1,
        unitNetPrice: 80000,
        unitSellingPrice: 100000,
        totalPrice: 100000,
        netPrice: 80000,
        currency: 'INR',
        supplierId: 'sup-jp-001',
        supplierName: 'Kanto Executive Ground DMC',
        supplierConfirmationRef: 'KANTO-CNF-7788',
        supplierStatus: 'CONFIRMED_BY_SUPPLIER'
      } as any
    ],
    paymentProofs: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };

  db.saveBooking(booking, admin);
  return db.getBookingById(booking.id, admin)!;
}

async function runAudit() {
  console.log('\n=====================================================================');
  console.log('MANUAL DISCOUNT ADJUSTMENT — FULL BOOKING & INVOICE SYNC AUDIT (7 TESTS)');
  console.log('=====================================================================\n');

  const db = AppDatabase.getInstance();
  const admin = makeAdminUser();
  const restrictedStaff = makeRestrictedStaffUser();
  const metricsService = DashboardMetricsService.getInstance();

  const todayRange = {
    currentRange: { start: new Date(Date.now() - 86400000), end: new Date(Date.now() + 86400000) },
    previousRange: { start: new Date(Date.now() - 86400000 * 3), end: new Date(Date.now() - 86400000 * 2) },
    label: 'Audit Window'
  };

  // =========================================================================
  // TEST 1: BASIC FIXED DISCOUNT (₹100,000 − ₹10,000 = ₹90,000 across ALL modules)
  // =========================================================================
  console.log('TEST 1 — Basic Fixed Discount (INR 100,000 − 10,000 = 90,000)');
  const b1 = createFreshBooking(db, admin, { id: 'bk-t1-basic', bookingReference: 'TUB-SYNC-T1' });

  const t1Res = await applyBookingManualDiscountAsync({
    booking: b1,
    payload: {
      bookingId: b1.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      discountCurrency: 'INR',
      reason: 'Executive relationship goodwill adjustment',
      internalReference: 'APR-2026-001',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t1-fixed-10000'
    },
    user: admin
  });

  assert(t1Res.ok, 'T1: Apply fixed ₹10,000 discount succeeds', !t1Res.ok ? (t1Res as { error: string }).error : undefined);
  const b1After = db.getBookingById(b1.id, admin)!;
  const fin1 = resolveAuthoritativeBookingFinancials(b1After);
  const pay1 = db.calculateBookingPaymentSummary(b1After);
  const proformaAmt1 = resolveAuthoritativeProformaAmount(b1After);
  const prof1 = calculateBookingProfitability(b1After);

  assert(fin1.originalBookingAmount === 100000, 'T1: Original Booking Amount preserved at 100,000', `got ${fin1.originalBookingAmount}`);
  assert(fin1.adminManualDiscountTotal === 10000, 'T1: Manual Discount recorded as 10,000', `got ${fin1.adminManualDiscountTotal}`);
  assert(fin1.revisedBookingAmount === 90000, 'T1: Revised Booking Amount = 90,000', `got ${fin1.revisedBookingAmount}`);
  assert(b1After.totalAmount === 90000 && b1After.finalCustomerSellingPrice === 90000, 'T1: Booking Details totalAmount & finalCustomerSellingPrice synced to 90,000');
  assert(pay1.totalAmount === 90000 && pay1.pendingAmount === 90000, 'T1: Payment Summary totalAmount & pendingAmount synced to 90,000');
  assert(proformaAmt1.finalBookingAmount === 90000, 'T1: Proforma resolver returns 90,000');
  assert(prof1.sellingPrice === 90000 && prof1.totalSupplierCost === 80000 && prof1.remainingTheUnboundMargin === 10000, 'T1: Profitability engine reflects selling 90,000, supplier cost 80,000, margin 10,000');
  assert(fin1.latestSnapshot.version === 2 && fin1.latestSnapshot.previousSnapshotVersion === 1, 'T1: Snapshot v2 references previousSnapshotVersion=1');
  assert(fin1.latestSnapshot.internalReference === 'APR-2026-001' && fin1.latestSnapshot.supplierCostProtectionValidated === true, 'T1: Section 4 audit fields (internalReference, supplierCostProtectionValidated) stored on snapshot');

  // Verify Dashboard KPI metrics reflect ₹90,000 (not ₹100,000)
  const kpi1 = metricsService.calculateKeyMetrics({
    bookings: [b1After],
    leads: [],
    quotes: [],
    users: [],
    suppliers: [],
    currentUser: admin,
    comparison: todayRange,
    baseCurrency: 'INR' as CurrencyCode
  });
  assert(kpi1.bookingValue.currentTotal === 90000, 'T1: Admin Dashboard KPI Booking Value synced to 90,000', `got ${kpi1.bookingValue.currentTotal}`);
  assert(kpi1.pendingPayments.totalOutstandingAmount === 90000, 'T1: Admin Dashboard KPI Pending Payments synced to 90,000', `got ${kpi1.pendingPayments.totalOutstandingAmount}`);

  // Generate Revised Proforma Invoice for T1
  const inv1Res = await generateAndPersistProformaInvoice(b1.id, admin, {
    forceRegenerate: true,
    skipStorageUpload: true
  });
  assert(inv1Res.success && !!inv1Res.invoice, 'T1: Revised Proforma Invoice generated cleanly');
  assert(
    inv1Res.invoice?.proformaFinalBookingAmount === 90000 && inv1Res.invoice?.totalAmount === 90000,
    'T1: Proforma Invoice reflects revised booking amount 90,000'
  );
  const inv1PdfText = extractPdfText(inv1Res.pdfBytes!);
  assert(inv1PdfText.includes('90,000.00'), 'T1: Rendered Proforma PDF contains 90,000.00');
  assert(!/\bService Fee\b/i.test(inv1PdfText) && !/\bTax\s*\(/i.test(inv1PdfText), 'T1: Proforma PDF omits separate TAX and Service Fee lines');

  // =========================================================================
  // TEST 2: PERCENTAGE DISCOUNT (10% of ₹100,000 = ₹10,000 → ₹90,000)
  // =========================================================================
  console.log('\nTEST 2 — Percentage Discount (10% of INR 100,000 = 10,000 -> 90,000)');
  const b2 = createFreshBooking(db, admin, { id: 'bk-t2-pct', bookingReference: 'TUB-SYNC-T2' });

  const preview2 = calculateBookingManualDiscountPreview({
    booking: b2,
    discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    discountCurrency: 'INR',
    permissions: resolveAdminManualDiscountPermissions(admin)
  });
  assert(
    preview2.validationErrors.length === 0 &&
      preview2.eligibleDiscountBase === 100000 &&
      preview2.requestedDiscountAmount === 10000 &&
      preview2.revisedCustomerSellingPrice === 90000,
    'T2: Preview calculates 10% of 100,000 eligible base = 10,000 discount -> 90,000 revised'
  );

  const t2Res = await applyBookingManualDiscountAsync({
    booking: b2,
    payload: {
      bookingId: b2.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      discountCurrency: 'INR',
      reason: '10% partner tier incentive',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t2-pct-10'
    },
    user: admin
  });
  assert(t2Res.ok, 'T2: Apply 10% percentage discount succeeds', !t2Res.ok ? (t2Res as { error: string }).error : undefined);
  const fin2 = resolveAuthoritativeBookingFinancials(db.getBookingById(b2.id, admin)!);
  assert(
    fin2.adminManualDiscountTotal === 10000 && fin2.revisedBookingAmount === 90000 && fin2.latestSnapshot.discountType === 'PERCENTAGE' && fin2.latestSnapshot.discountValue === 10,
    'T2: Percentage discount persisted with discountType=PERCENTAGE, discountValue=10, revised=90,000'
  );

  // =========================================================================
  // TEST 3: EXISTING PAYMENT & OVERPAYMENT / CREDIT BALANCE RECONCILIATION
  // =========================================================================
  console.log('\nTEST 3 — Existing Payment (INR 40,000 paid -> 50,000 outstanding) + Overpayment Credit');
  const b3 = createFreshBooking(db, admin, { id: 'bk-t3-payment', bookingReference: 'TUB-SYNC-T3' });

  // Record & verify ₹40,000 advance payment
  const addedProof = db.addBookingPaymentTranche(
    b3.id,
    {
      amount: 40000,
      currency: 'INR',
      trancheLabel: 'Tranche 1 Advance',
      paymentDate: '2026-11-20',
      paymentMethod: 'WIRE_TRANSFER',
      transactionRef: 'UTR-SYNC-40000',
      proofFileUrl: 'https://example.com/receipt-40k.pdf',
      proofFileName: 'receipt-40k.pdf',
      proofFileType: 'PDF'
    },
    admin
  );
  assert(!!addedProof, 'T3: Recorded ₹40,000 payment tranche');
  db.verifyBookingPayment(b3.id, addedProof!.id, 'VERIFIED', 'Verified in bank statement', admin);

  const b3BeforeDisc = db.getBookingById(b3.id, admin)!;
  const beforeDisc3 = resolveAuthoritativeBookingFinancials(b3BeforeDisc);
  assert(
    beforeDisc3.verifiedPaidAmount === 40000 && beforeDisc3.outstandingBalance === 60000 && beforeDisc3.paymentStatus === 'PARTIALLY_PAID',
    'T3: Before discount -> Paid 40,000, Outstanding 60,000, PARTIALLY_PAID'
  );

  const t3Res = await applyBookingManualDiscountAsync({
    booking: b3BeforeDisc,
    payload: {
      bookingId: b3.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      discountCurrency: 'INR',
      reason: 'Post-deposit goodwill adjustment',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t3-pay-reconcile'
    },
    user: admin
  });
  assert(t3Res.ok, 'T3: Applied ₹10,000 discount after ₹40,000 payment', !t3Res.ok ? (t3Res as { error: string }).error : undefined);

  const b3After = db.getBookingById(b3.id, admin)!;
  const fin3 = resolveAuthoritativeBookingFinancials(b3After);
  const pay3 = db.calculateBookingPaymentSummary(b3After);
  assert(
    fin3.revisedBookingAmount === 90000 && fin3.verifiedPaidAmount === 40000 && fin3.outstandingBalance === 50000 && fin3.creditBalance === 0,
    'T3: Revised=90,000, Paid=40,000 (unchanged), Outstanding=50,000, Credit=0'
  );
  assert(
    b3After.balanceDue === 50000 && pay3.pendingAmount === 50000 && b3After.paymentProofs?.length === 1 && b3After.paymentProofs[0].amount === 40000,
    'T3: Booking.balanceDue=50,000, PaymentSummary.pendingAmount=50,000, historical paymentProof untouched'
  );

  // Dashboard Pending Payments reflects exact ₹50,000 outstanding (NOT ₹90,000!)
  const kpi3 = metricsService.calculateKeyMetrics({
    bookings: [b3After],
    leads: [],
    quotes: [],
    users: [],
    suppliers: [],
    currentUser: admin,
    comparison: todayRange,
    baseCurrency: 'INR' as CurrencyCode
  });
  assert(
    kpi3.pendingPayments.totalOutstandingAmount === 50000,
    'T3: Dashboard Pending Payments accurately equals 50,000 (90,000 revised − 40,000 verified paid)',
    `got ${kpi3.pendingPayments.totalOutstandingAmount}`
  );

  // Overpayment / Credit Balance scenario: Booking ₹100,000, ₹95,000 verified paid, apply ₹10,000 discount -> ₹90,000 revised -> ₹0 due, ₹5,000 creditBalance
  const b3Over = createFreshBooking(db, admin, { id: 'bk-t3-overpay', bookingReference: 'TUB-SYNC-T3-OVR' });
  const proofOver = db.addBookingPaymentTranche(
    b3Over.id,
    {
      amount: 95000,
      currency: 'INR',
      trancheLabel: 'Tranche 1 Bulk Deposit',
      paymentDate: '2026-11-21',
      paymentMethod: 'WIRE_TRANSFER',
      transactionRef: 'UTR-SYNC-95000',
      proofFileUrl: 'https://example.com/receipt-95k.pdf',
      proofFileName: 'receipt-95k.pdf',
      proofFileType: 'PDF'
    },
    admin
  );
  db.verifyBookingPayment(b3Over.id, proofOver!.id, 'VERIFIED', 'Verified bulk deposit', admin);
  const b3OverBeforeDisc = db.getBookingById(b3Over.id, admin)!;
  const t3OverRes = await applyBookingManualDiscountAsync({
    booking: b3OverBeforeDisc,
    payload: {
      bookingId: b3Over.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      discountCurrency: 'INR',
      reason: 'Post-bulk-payment adjustment triggering credit position',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t3-overpay'
    },
    user: admin
  });
  assert(t3OverRes.ok, 'T3-Overpay: Discount reducing revised amount below paid amount succeeds cleanly', !t3OverRes.ok ? (t3OverRes as { error: string }).error : undefined);
  const b3OverAfter = db.getBookingById(b3Over.id, admin)!;
  const fin3Over = resolveAuthoritativeBookingFinancials(b3OverAfter);
  assert(
    fin3Over.revisedBookingAmount === 90000 &&
      fin3Over.verifiedPaidAmount === 95000 &&
      fin3Over.outstandingBalance === 0 &&
      fin3Over.creditBalance === 5000 &&
      fin3Over.isOverpaid === true &&
      fin3Over.paymentStatus === 'PAID',
    'T3-Overpay: Revised=90,000, Paid=95,000, BalanceDue=0, CreditBalance=5,000, isOverpaid=true, paymentStatus=PAID (no negative balance, no auto-refund)'
  );
  const invOverRes = await generateAndPersistProformaInvoice(b3Over.id, admin, {
    forceRegenerate: true,
    skipStorageUpload: true
  });
  const invOverPdfText = extractPdfText(invOverRes.pdfBytes!);
  assert(
    invOverPdfText.includes('CREDIT / OVERPAYMENT BALANCE') && invOverPdfText.includes('5,000.00'),
    'T3-Overpay: Revised Proforma PDF clearly shows CREDIT / OVERPAYMENT BALANCE of 5,000.00'
  );

  // =========================================================================
  // TEST 4: EXISTING PROFORMA INVOICE VERSIONING & IMMUTABILITY (v1 vs v2)
  // =========================================================================
  console.log('\nTEST 4 — Existing Proforma Invoice (v1 immutable & outdated -> v2 at 90,000)');
  const b4 = createFreshBooking(db, admin, { id: 'bk-t4-proforma', bookingReference: 'TUB-SYNC-T4' });

  // Issue Proforma Invoice v1 at ₹100,000 (Snapshot v1)
  const v1Gen = await generateAndPersistProformaInvoice(b4.id, admin, {
    skipStorageUpload: true
  });
  assert(v1Gen.success && !!v1Gen.invoice, 'T4: Proforma Invoice v1 issued before discount');
  const v1Invoice = v1Gen.invoice!;
  assert(
    v1Invoice.totalAmount === 100000 &&
      v1Invoice.proformaFinalBookingAmount === 100000 &&
      v1Invoice.sourcePricingSnapshotVersion === 1 &&
      v1Invoice.invoiceVersion === 1,
    'T4: Proforma v1 locked to 100,000 & sourcePricingSnapshotVersion=1'
  );

  // Apply ₹10,000 discount -> Snapshot v2 (₹90,000)
  const t4Disc = await applyBookingManualDiscountAsync({
    booking: db.getBookingById(b4.id, admin)!,
    payload: {
      bookingId: b4.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      discountCurrency: 'INR',
      reason: 'Post-proforma approved commercial discount',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t4-proforma-disc'
    },
    user: admin
  });
  assert(t4Disc.ok, 'T4: Applied ₹10,000 discount after v1 Proforma issued', !t4Disc.ok ? (t4Disc as { error: string }).error : undefined);

  const b4AfterDisc = db.getBookingById(b4.id, admin)!;
  const allB4Invs = db.getBookingInvoices(b4.id);
  const v1StoredAfterDisc = allB4Invs.find(i => i.id === v1Invoice.id)!;
  const v2Invoice = t4Disc.ok ? t4Disc.revisedInvoice : undefined;

  assert(
    v1StoredAfterDisc.totalAmount === 100000 && v1StoredAfterDisc.proformaFinalBookingAmount === 100000,
    'T4: Historical Proforma v1 record strictly immutable at 100,000'
  );
  assert(
    v1StoredAfterDisc.status === 'SUPERSEDED' &&
      v1StoredAfterDisc.isOutdated === true &&
      Boolean(v1StoredAfterDisc.supersededAt) &&
      v1StoredAfterDisc.supersededByInvoiceId === v2Invoice?.id,
    'T4: Prior Proforma v1 automatically marked SUPERSEDED & isOutdated with supersededByInvoiceId upon discount'
  );

  // Re-render v1 PDF AFTER discount — MUST STILL show 100,000.00 (never overwritten by booking's new 90,000!)
  const v1PdfAfterDisc = generateProformaInvoicePDF(v1StoredAfterDisc, b4AfterDisc, db.getCentralCompanyProfile());
  const v1PdfTextAfterDisc = extractPdfText(v1PdfAfterDisc.toUint8Array());
  assert(
    v1PdfTextAfterDisc.includes('100,000.00') && !v1PdfTextAfterDisc.includes('90,000.00'),
    'T4: Historical v1 PDF re-downloaded after discount STILL renders 100,000.00 (strictly immutable)'
  );

  // Verify Revised Proforma Invoice v2 was AUTOMATICALLY generated at ₹90,000 (Snapshot v2)
  assert(Boolean(v2Invoice), 'T4: Revised Proforma Invoice v2 automatically issued upon discount');
  assert(
    !!v2Invoice &&
      v2Invoice.id !== v1Invoice.id &&
      (v2Invoice.invoiceVersion || 0) === 2 &&
      v2Invoice.totalAmount === 90000 &&
      v2Invoice.proformaFinalBookingAmount === 90000 &&
      v2Invoice.sourcePricingSnapshotVersion === 2 &&
      v2Invoice.sourcePricingSnapshotId === resolveAuthoritativeBookingFinancials(b4AfterDisc).latestSnapshotId &&
      b4AfterDisc.activeProformaInvoiceId === v2Invoice.id,
    'T4: Auto-issued Revised Proforma v2 references Snapshot v2 & current_selling_price 90,000 while keeping v1 separate'
  );

  const v1FreshnessAfterV2 = evaluateProformaInvoiceFreshness(v1StoredAfterDisc, b4AfterDisc, allB4Invs);
  const v2Freshness = evaluateProformaInvoiceFreshness(v2Invoice!, b4AfterDisc, allB4Invs);
  assert(
    v1FreshnessAfterV2.isSupersededByNewerVersion === true && v1FreshnessAfterV2.statusLabel === 'SUPERSEDED',
    'T4: Proforma v1 evaluates as SUPERSEDED against latest booking & invoice list'
  );
  assert(
    v2Freshness.isOutdated === false && v2Freshness.statusLabel === 'CURRENT',
    'T4: Auto-issued Proforma v2 marked CURRENT against latest Snapshot v2'
  );

  // Verify adjustment ledger recorded associatedInvoiceVersions (both v1 SUPERSEDED and v2 ISSUED_REVISED)
  const t4Adj = t4Disc.ok ? t4Disc.adjustment : undefined;
  assert(
    !!t4Adj?.associatedInvoiceVersions &&
      t4Adj.associatedInvoiceVersions.some(v => v.invoiceId === v1Invoice.id && v.status === 'SUPERSEDED' && v.amount === 100000) &&
      t4Adj.associatedInvoiceVersions.some(v => v.invoiceId === v2Invoice?.id && v.status === 'ISSUED_REVISED' && v.amount === 90000),
    'T4: Adjustment history records associatedInvoiceVersions linking SUPERSEDED v1 (100,000) and ISSUED_REVISED v2 (90,000)'
  );

  // Render auto-issued v2 PDF and assert it shows 90,000.00 with zero TAX/Service Fee lines
  const v2Pdf = generateProformaInvoicePDF(v2Invoice!, b4AfterDisc, db.getCentralCompanyProfile());
  const v2PdfText = extractPdfText(v2Pdf.toUint8Array());
  assert(
    v2PdfText.includes('90,000.00') && !/\bService Fee\b/i.test(v2PdfText) && !/\bTax\s*\(/i.test(v2PdfText),
    'T4: Auto-issued Revised Proforma v2 PDF renders 90,000.00 with zero separate TAX/Service Fee lines'
  );

  // =========================================================================
  // TEST 5: MULTIPLE CUMULATIVE ADJUSTMENTS (₹5,000 then ₹2,000 = ₹7,000 -> ₹93,000)
  // =========================================================================
  console.log('\nTEST 5 — Multiple Adjustments (INR 5,000 + INR 2,000 -> cumulative 7,000, revised 93,000)');
  const b5 = createFreshBooking(db, admin, { id: 'bk-t5-multi', bookingReference: 'TUB-SYNC-T5' });

  const t5a = await applyBookingManualDiscountAsync({
    booking: b5,
    payload: {
      bookingId: b5.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 5000,
      discountCurrency: 'INR',
      reason: 'First discount tranche',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t5-first-5000'
    },
    user: admin
  });
  const t5b = await applyBookingManualDiscountAsync({
    booking: db.getBookingById(b5.id, admin)!,
    payload: {
      bookingId: b5.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 2000,
      discountCurrency: 'INR',
      reason: 'Second additional discount tranche',
      expectedSnapshotVersion: 2,
      idempotencyKey: 'idem-t5-second-2000'
    },
    user: admin
  });
  assert(t5a.ok && t5b.ok, 'T5: Both sequential manual discounts succeeded');

  const b5After = db.getBookingById(b5.id, admin)!;
  const fin5 = resolveAuthoritativeBookingFinancials(b5After);
  assert(fin5.originalBookingAmount === 100000, 'T5: Original booking amount remains 100,000 (untouched)');
  assert(fin5.adminManualDiscountTotal === 7000, 'T5: Cumulative manual discount equals 7,000 (no double reduction)', `got ${fin5.adminManualDiscountTotal}`);
  assert(fin5.revisedBookingAmount === 93000, 'T5: Final revised booking amount equals 93,000', `got ${fin5.revisedBookingAmount}`);
  assert(fin5.latestSnapshotVersion === 3 && fin5.latestSnapshot.previousSnapshotVersion === 2, 'T5: Snapshot chain v1 -> v2 -> v3 intact');

  // Also test reversal of second discount (restores ₹95,000 cleanly!)
  const secondAdjId = t5b.ok ? t5b.adjustment.adjustmentId : '';
  const t5Rev = await reverseBookingManualDiscountAsync({
    booking: b5After,
    payload: {
      bookingId: b5.id,
      adjustmentId: secondAdjId,
      reason: 'Reversing second adjustment per finance review',
      expectedSnapshotVersion: 3,
      idempotencyKey: 'idem-t5-reverse-second'
    },
    user: admin
  });
  assert(t5Rev.ok, 'T5: Reversal of ₹2,000 adjustment succeeded', !t5Rev.ok ? (t5Rev as { error: string }).error : undefined);
  const fin5Rev = resolveAuthoritativeBookingFinancials(db.getBookingById(b5.id, admin)!);
  assert(
    fin5Rev.adminManualDiscountTotal === 5000 && fin5Rev.revisedBookingAmount === 95000 && fin5Rev.latestSnapshotVersion === 4,
    'T5: After reversal -> cumulative discount 5,000, revised amount 95,000, snapshot v4'
  );

  // =========================================================================
  // TEST 6: CONCURRENCY & RETRY PROTECTION (Idempotency + Stale Version Conflict)
  // =========================================================================
  console.log('\nTEST 6 — Concurrency & Retry Protection (Idempotency Replay + Stale Version Rejection)');
  const b6 = createFreshBooking(db, admin, { id: 'bk-t6-concurrency', bookingReference: 'TUB-SYNC-T6' });

  // 6A: Duplicate click / retry with identical idempotencyKey
  const [dup1, dup2] = await Promise.all([
    applyBookingManualDiscountAsync({
      booking: b6,
      payload: {
        bookingId: b6.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 6000,
        discountCurrency: 'INR',
        reason: 'Double-click resilience test',
        expectedSnapshotVersion: 1,
        idempotencyKey: 'idem-t6-double-click'
      },
      user: admin
    }),
    applyBookingManualDiscountAsync({
      booking: b6,
      payload: {
        bookingId: b6.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 6000,
        discountCurrency: 'INR',
        reason: 'Double-click resilience test',
        expectedSnapshotVersion: 1,
        idempotencyKey: 'idem-t6-double-click'
      },
      user: admin
    })
  ]);

  assert(dup1.ok && dup2.ok, 'T6A: Both concurrent duplicate calls resolved without corruption');
  const replayDetected = (dup1.ok && dup1.idempotentReplay) || (dup2.ok && dup2.idempotentReplay);
  assert(replayDetected === true, 'T6A: Second duplicate call detected as idempotentReplay=true');
  const fin6A = resolveAuthoritativeBookingFinancials(db.getBookingById(b6.id, admin)!);
  assert(
    fin6A.adminManualDiscountTotal === 6000 && fin6A.revisedBookingAmount === 94000,
    'T6A: Discount applied EXACTLY ONCE (6,000 -> 94,000), zero duplicate deduction'
  );

  // 6B: Two simultaneous Admin adjustments targeting the SAME expectedSnapshotVersion=2 (different keys)
  const b6V2 = db.getBookingById(b6.id, admin)!;
  const [race1, race2] = await Promise.all([
    applyBookingManualDiscountAsync({
      booking: b6V2,
      payload: {
        bookingId: b6.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 3000,
        discountCurrency: 'INR',
        reason: 'Admin A concurrent adjustment',
        expectedSnapshotVersion: 2,
        idempotencyKey: 'idem-t6-race-admin-a'
      },
      user: admin
    }),
    applyBookingManualDiscountAsync({
      booking: b6V2,
      payload: {
        bookingId: b6.id,
        discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
        discountType: 'FIXED',
        discountValue: 4000,
        discountCurrency: 'INR',
        reason: 'Admin B concurrent adjustment (stale version)',
        expectedSnapshotVersion: 2,
        idempotencyKey: 'idem-t6-race-admin-b'
      },
      user: admin
    })
  ]);

  const raceSuccessCount = Number(race1.ok) + Number(race2.ok);
  const raceFail = !race1.ok ? (race1 as { ok: false; error: string }) : !race2.ok ? (race2 as { ok: false; error: string }) : null;
  assert(raceSuccessCount === 1 && raceFail !== null, 'T6B: Exactly ONE concurrent Admin wins and the second is blocked with version conflict');
  assert(
    !!raceFail && /updated concurrently|snapshot version/i.test(raceFail.error),
    'T6B: Blocked Admin receives explicit concurrency/version conflict message',
    raceFail?.error
  );

  // 6C: Server-side Transaction Manager reverseDiscount optimistic concurrency check (HTTP 409)
  const serverStore = new InMemoryBookingDiscountStore();
  const b6Server = createFreshBooking(db, admin, { id: 'bk-t6-server', bookingReference: 'TUB-SYNC-T6-SRV' });
  await serverStore.saveBooking(b6Server);
  const txMgr = new BookingManualDiscountTransactionManager(serverStore);
  const serverCaller = {
    uid: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    idToken: 'audit-token',
    permissions: resolveAdminManualDiscountPermissions(admin)
  };
  const srvApply = await txMgr.applyDiscount({
    bookingId: b6Server.id,
    caller: serverCaller,
    payload: {
      bookingId: b6Server.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 5000,
      discountCurrency: 'INR',
      reason: 'Server apply for reverse concurrency test',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'srv-apply-1'
    }
  });
  assert(srvApply.ok, 'T6C: Server-side transaction apply succeeded (v2)');
  const srvStaleReverse = await txMgr.reverseDiscount({
    bookingId: b6Server.id,
    caller: serverCaller,
    payload: {
      bookingId: b6Server.id,
      adjustmentId: srvApply.ok ? srvApply.adjustment.adjustmentId : '',
      reason: 'Stale reverse attempt',
      expectedSnapshotVersion: 1, // stale! current is 2
      idempotencyKey: 'srv-rev-stale'
    }
  });
  assert(
    !srvStaleReverse.ok && (srvStaleReverse as { ok: false; status: number }).status === 409,
    'T6C: Server-side reverseDiscount rejects stale expectedSnapshotVersion with HTTP 409'
  );

  // =========================================================================
  // TEST 7: FINANCIAL PROTECTION (Supplier Cost, Allocations, Quotations, Margin Guard)
  // =========================================================================
  console.log('\nTEST 7 — Financial Protection (Supplier Nett Cost, Allocations, Quotation & Margin Guard)');
  const b7 = createFreshBooking(db, admin, { id: 'bk-t7-protect', bookingReference: 'TUB-SYNC-T7' });

  // Attempt discount exceeding ₹20,000 margin (₹25,000) as staff WITHOUT margin override permission -> MUST BE BLOCKED
  const blockedRes = await applyBookingManualDiscountAsync({
    booking: b7,
    payload: {
      bookingId: b7.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 25000,
      discountCurrency: 'INR',
      reason: 'Exceeds TheUnbound margin without override',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t7-blocked'
    },
    user: restrictedStaff
  });
  assert(!blockedRes.ok, 'T7: Margin-exceeding discount (25,000 > 20,000 margin) blocked without override permission');

  // Apply valid ₹15,000 discount within margin -> verify supplier cost, items, allocation, quotation untouched
  const validT7 = await applyBookingManualDiscountAsync({
    booking: b7,
    payload: {
      bookingId: b7.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 15000,
      discountCurrency: 'INR',
      reason: 'Margin-funded commercial discount',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t7-valid-15000'
    },
    user: admin
  });
  assert(validT7.ok, 'T7: Valid ₹15,000 margin-funded discount succeeds', !validT7.ok ? (validT7 as { error: string }).error : undefined);
  const b7After = db.getBookingById(b7.id, admin)!;
  const fin7 = resolveAuthoritativeBookingFinancials(b7After);
  const item7 = b7After.items[0];
  assert(
    fin7.supplierNettCost === 80000 &&
      b7After.totalNetCost === 80000 &&
      b7After.internalNettCost === 80000 &&
      b7After.supplierCost === 80000 &&
      b7After.supplierTotalCost === 80000,
    'T7: Supplier Nett Cost remains strictly unchanged at 80,000 across all fields'
  );
  assert(
    item7.unitNetPrice === 80000 &&
      item7.netPrice === 80000 &&
      item7.supplierId === 'sup-jp-001' &&
      item7.supplierConfirmationRef === 'KANTO-CNF-7788',
    'T7: Service item Net Price & Supplier Allocation commercial records strictly unchanged'
  );
  assert(
    b7After.sourceQuoteId === 'qt-orig-immutable-1' && fin7.baselineSnapshot.originalCustomerSellingPrice === 100000,
    'T7: Historical Quotation reference & baseline snapshot strictly unchanged'
  );
  assert(
    fin7.remainingTheUnboundMargin === 5000 && fin7.isLossMaking === false,
    'T7: Remaining TheUnbound Margin reduced accurately from 20,000 to 5,000'
  );

  // =========================================================================
  // TEST 8: EXACT SPECIFICATION SCENARIO (₹1,207,341.69 - ₹17,000.00 = ₹1,190,341.69)
  //         + EXPLICIT TWO-FIELD DB PERSISTENCE (original_selling_price & current_selling_price)
  // =========================================================================
  console.log('\nTEST 8 — Exact Spec Scenario (₹1,207,341.69 - ₹17,000.00 = ₹1,190,341.69) & Two-Field DB Persistence');
  const b8 = createFreshBooking(db, admin, {
    id: 'bk-t8-spec-exact',
    bookingReference: 'TUB-SYNC-T8',
    totalAmount: 1207341.69,
    finalCustomerSellingPrice: 1207341.69,
    final_customer_selling_price: 1207341.69,
    baseFinalSellingPrice: 1207341.69,
    base_final_selling_price: 1207341.69,
    preDiscountBaseSellingPrice: 1207341.69,
    originalBookingAmount: 1207341.69,
    original_selling_price: 1207341.69,
    current_selling_price: 1207341.69,
    totalNetCost: 1000000,
    internalNettCost: 1000000,
    supplierCost: 1000000,
    supplierTotalCost: 1000000,
    originalTheUnboundMargin: 207341.69,
    remainingTheUnboundMargin: 207341.69,
    balanceDue: 1207341.69,
    pendingPaymentAmount: 1207341.69
  });

  const t8Res = await applyBookingManualDiscountAsync({
    booking: b8,
    payload: {
      bookingId: b8.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 17000,
      discountCurrency: 'INR',
      reason: 'Executive negotiated manual discount',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t8-spec-17000'
    },
    user: admin
  });
  assert(t8Res.ok, 'T8: Applied ₹17,000.00 manual discount on ₹1,207,341.69 booking');
  const b8After = db.getBookingById(b8.id, admin)!;
  const fin8 = resolveAuthoritativeBookingFinancials(b8After);

  assert(
    b8After.original_selling_price === 1207341.69 && fin8.original_selling_price === 1207341.69,
    'T8: original_selling_price remains immutable at 1,207,341.69',
    `got ${b8After.original_selling_price}`
  );
  assert(
    b8After.current_selling_price === 1190341.69 &&
      fin8.current_selling_price === 1190341.69 &&
      b8After.totalAmount === 1190341.69,
    'T8: current_selling_price & totalAmount updated to exact 1,190,341.69',
    `got ${b8After.current_selling_price}`
  );
  assert(
    fin8.verifiedPaidAmount === 0 && fin8.outstandingBalance === 1190341.69 && b8After.balanceDue === 1190341.69,
    'T8: Amount Received = 0.00 and Balance Outstanding = 1,190,341.69'
  );
  assert(
    fin8.supplierNettCost === 1000000 && fin8.remainingTheUnboundMargin === 190341.69,
    'T8: Supplier Nett Cost unchanged (1,000,000.00) and Remaining Margin = 190,341.69',
    `got margin ${fin8.remainingTheUnboundMargin}`
  );

  // Verify default 50/50 payment schedule cent-exact recalculation on ₹1,190,341.69
  const sched8 = b8After.paymentSchedule!;
  const sum8 = Math.round(sched8.installments.reduce((s, inst) => s + inst.amount, 0) * 100) / 100;
  assert(
    sched8.totalAmount === 1190341.69 &&
      sched8.balanceDue === 1190341.69 &&
      sched8.installments.length === 2 &&
      sum8 === 1190341.69,
    'T8: Default Payment Schedule recalculated cent-exact to 1,190,341.69',
    `sum=${sum8}, total=${sched8.totalAmount}`
  );

  // =========================================================================
  // TEST 9: CUSTOM PAYMENT SCHEDULE WITH PAID TRANCHE IMMUTABILITY + RECALCULATION
  // =========================================================================
  console.log('\nTEST 9 — Payment Schedule Recalculation (Paid Tranche Immutable, Unpaid Tranches Cent-Exact)');
  const b9 = createFreshBooking(db, admin, {
    id: 'bk-t9-schedule',
    bookingReference: 'TUB-SYNC-T9',
    totalAmount: 100000,
    finalCustomerSellingPrice: 100000,
    original_selling_price: 100000,
    current_selling_price: 100000,
    amountPaid: 30000,
    paidAmount: 30000,
    paymentProofs: [
      {
        id: 'pay-t9-dep',
        trancheLabel: 'Deposit Tranche 1',
        amount: 30000,
        currency: 'INR',
        paymentDate: '2026-07-01',
        paymentMethod: 'WIRE_TRANSFER',
        transactionRef: 'UTR-T9-DEP',
        proofFileUrl: 'storage://bookings/bk-t9-schedule/payments/dep.pdf',
        uploadedAt: '2026-07-01T10:00:00.000Z',
        verificationStatus: 'VERIFIED'
      }
    ],
    paymentSchedule: {
      bookingId: 'bk-t9-schedule',
      bookingReference: 'TUB-SYNC-T9',
      totalAmount: 100000,
      currency: 'INR',
      totalPaid: 30000,
      balanceDue: 70000,
      paymentStatus: 'PARTIALLY_PAID',
      updatedAt: '2026-07-01T10:00:00.000Z',
      installments: [
        {
          id: 'inst-t9-1',
          title: 'Initial Deposit (30%)',
          installmentNumber: 1,
          percentage: 30,
          amount: 30000,
          paidAmount: 30000,
          paidDate: '2026-07-01',
          currency: 'INR',
          dueDate: '2026-07-01',
          status: 'PAID'
        },
        {
          id: 'inst-t9-2',
          title: 'Second Instalment (40%)',
          installmentNumber: 2,
          percentage: 40,
          amount: 40000,
          currency: 'INR',
          dueDate: '2026-08-01',
          status: 'PENDING'
        },
        {
          id: 'inst-t9-3',
          title: 'Final Settlement (30%)',
          installmentNumber: 3,
          percentage: 30,
          amount: 30000,
          currency: 'INR',
          dueDate: '2026-09-01',
          status: 'PENDING'
        }
      ]
    }
  });

  const t9Res = await applyBookingManualDiscountAsync({
    booking: b9,
    payload: {
      bookingId: b9.id,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 10000,
      discountCurrency: 'INR',
      reason: 'Discount applied after 30% deposit paid',
      expectedSnapshotVersion: 1,
      idempotencyKey: 'idem-t9-sched-10000'
    },
    user: admin
  });
  assert(t9Res.ok, 'T9: Applied ₹10,000 discount on booking with custom 3-tranche payment schedule');

  const b9After = db.getBookingById(b9.id, admin)!;
  const sched9 = b9After.paymentSchedule!;
  const inst1 = sched9.installments[0];
  const inst2 = sched9.installments[1];
  const inst3 = sched9.installments[2];
  const sum9 = Math.round((inst1.amount + inst2.amount + inst3.amount) * 100) / 100;

  assert(
    inst1.status === 'PAID' && inst1.amount === 30000 && inst1.paidAmount === 30000,
    'T9: Already-PAID Tranche 1 remains strictly immutable at 30,000'
  );
  assert(
    sched9.totalAmount === 90000 &&
      sched9.balanceDue === 60000 &&
      sum9 === 90000 &&
      Math.round((inst2.amount + inst3.amount) * 100) / 100 === 60000,
    'T9: Unpaid Tranches 2 & 3 recalculated proportionally to sum cent-exact to remaining 60,000 (total 90,000)',
    `inst2=${inst2.amount}, inst3=${inst3.amount}, sum=${sum9}`
  );
  assert(
    !!(t9Res.ok && t9Res.adjustment.previousPaymentSchedule?.totalAmount === 100000) &&
      !!(t9Res.ok && t9Res.adjustment.revisedPaymentSchedule?.totalAmount === 90000),
    'T9: Adjustment ledger snapshots both previousPaymentSchedule (100,000) and revisedPaymentSchedule (90,000)'
  );

  // =========================================================================
  // TEST 10: BOOKING TIMELINE & AUDIT HISTORY SYNCHRONIZATION
  // =========================================================================
  console.log('\nTEST 10 — Booking Timeline & Audit History Events (Discount + Auto-Issued Revised Invoice)');
  const b4Timeline = b4AfterDisc.timeline || [];
  const hasDiscountTimelineEv = b4Timeline.some(
    ev => ev.type === 'PAYMENT' && ev.title.includes('Admin Manual Discount Applied') && ev.description.includes('90,000.00')
  );
  const hasInvoiceTimelineEv = b4Timeline.some(
    ev => ev.type === 'DOCUMENT' && ev.title.includes('Revised Proforma Invoice Auto-Issued') && ev.description.includes('Superseded')
  );
  assert(
    hasDiscountTimelineEv,
    'T10: Booking Timeline records Admin Manual Discount event with revised selling price & margin delta'
  );
  assert(
    hasInvoiceTimelineEv,
    'T10: Booking Timeline records auto-superseded v1 & auto-issued Revised Proforma v2 event'
  );

  console.log('\n=====================================================================');
  console.log(`AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('UNHANDLED AUDIT ERROR:', err);
  process.exit(1);
});
