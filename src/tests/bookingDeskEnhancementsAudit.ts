import assert from 'assert';
import { AppDatabase } from '../services/db';
import { Booking, PassengerComplianceDocument, User } from '../types';
import {
  PassengerDocumentBinaryAdapter,
  PassengerDocumentMetadataAdapter,
  PassengerDocumentUploadProgress,
  uploadMultiplePassengerDocuments,
  uploadPassengerComplianceDocument
} from '../services/passengerDocumentService';
import { applyBookingManualDiscountAsync } from '../services/bookingManualDiscountApiService';
import {
  previewBookingPaymentScheduleRecalculationAsync,
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

const adminUser: User = {
  id: 'admin-audit-01',
  name: 'Senior Admin',
  email: 'admin@theunbound.in',
  role: 'ADMIN',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00.000Z'
};

const opsUser: User = {
  id: 'ops-audit-01',
  name: 'Ops Coordinator',
  email: 'ops@theunbound.in',
  role: 'TEAM_MEMBER',
  approvalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00.000Z'
};

async function runAudit() {
  const db = AppDatabase.getInstance();
  let passed = 0;

  // Seed fresh booking with 4 PAX, INR 400,000 total (100,000/pax), net cost 300,000
  const bookingId = `bk-desk-audit-${Date.now()}`;
  const seededBooking: Booking = {
    id: bookingId,
    bookingReference: `TUB-DESK-${Math.floor(1000 + Math.random() * 9000)}`,
    destination: 'Japan',
    destinationName: 'Japan Grand Circuit',
    travelStartDate: '2026-11-10',
    travelEndDate: '2026-11-18',
    currency: 'INR',
    totalAmount: 400000,
    current_selling_price: 400000,
    original_selling_price: 400000,
    originalBookingAmount: 400000,
    finalCustomerSellingPrice: 400000,
    supplierTotalCost: 300000,
    supplierCost: 300000,
    totalNetCost: 300000,
    paidAmount: 0,
    amountPaid: 0,
    balanceDue: 400000,
    status: 'CONFIRMED',
    paymentStatus: 'PENDING_PAYMENT',
    sourceType: 'MANUAL',
    customer: {
      leadTravelerName: 'Aarav Mehta',
      email: 'aarav@example.com',
      phone: '+91-9876543210',
      agencyName: 'Apex Luxury Holidays',
      totalAdults: 4,
      totalChildren: 0,
      totalPax: 4
    },
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        productName: 'Tokyo & Kyoto Private Ground Package',
        destination: 'Japan',
        city: 'Tokyo',
        category: 'TOUR',
        travelDate: '2026-11-10',
        adults: 4,
        children: 0,
        infants: 0,
        totalPax: 4,
        unitSellingPrice: 400000,
        totalPrice: 400000,
        supplierCost: 300000,
        currency: 'INR'
      } as any
    ],
    passengers: [
      {
        id: 'pax-audit-1',
        firstName: 'Aarav',
        lastName: 'Mehta',
        fullName: 'Aarav Mehta',
        isLeadPax: true,
        nationality: 'Indian'
      } as any
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.saveBooking(seededBooking, adminUser);

  // =========================================================================
  // 1. PROFORMA INVOICE: CREATE, RBAC, FULL EDIT + PAX RECALC, BOOKING SYNC, DELETE & AUDIT
  // =========================================================================
  const genRes = db.generateProformaInvoice(bookingId, adminUser, true);
  assert.strictEqual(genRes.success, true, 'Initial Proforma Invoice generation must succeed');
  const inv1 = genRes.invoice!;
  assert.strictEqual(inv1.totalPax, 4, 'Initial Proforma Invoice PAX must be 4');
  assert.strictEqual(inv1.perPersonPrice, 100000, 'Initial per-person price must be 100,000');
  assert.ok((inv1.auditHistory?.length || 0) >= 1, 'Initial creation audit entry must be logged');
  passed++;

  // Non-Admin blocked from changing PAX or deleting Proforma
  const opsPaxEdit = db.editProformaInvoiceFull(
    bookingId,
    inv1.id,
    { totalPax: 6 },
    opsUser,
    'Ops trying to change PAX'
  );
  assert.strictEqual(opsPaxEdit.success, false, 'Non-Admin must be blocked from changing PAX');

  const opsDelete = db.deleteProformaInvoice(bookingId, inv1.id, opsUser, 'Ops trying to delete');
  assert.strictEqual(opsDelete.success, false, 'Non-Admin must be blocked from deleting Proforma Invoice');
  passed++;

  // Admin full-field edit with PAX 4 -> 6 (PER_PERSON_DRIVES_TOTAL => 600,000)
  const adminPaxEdit = db.editProformaInvoiceFull(
    bookingId,
    inv1.id,
    {
      invoiceNumber: 'TUB-PINV-CUSTOM-2026',
      invoiceDate: '2026-09-01',
      dueDate: '2026-10-15',
      totalPax: 6,
      recalcMode: 'PER_PERSON_DRIVES_TOTAL',
      customerName: 'Aarav Mehta & Family',
      leadTravelerName: 'Aarav Mehta',
      agencyName: 'Apex Premier Travel Pvt Ltd',
      billedToGstin: '27AABCA1234F1Z5',
      destination: 'Japan Autumn Grand Circuit',
      travelDates: '2026-11-10 to 2026-11-20',
      billingAddress: '42 Marine Drive, Mumbai',
      notes: 'Includes VIP airport greet',
      terms: '50% deposit, 50% balance 30 days prior',
      bankAccountDetails: {
        bankName: 'HDFC Bank',
        accountName: 'TheUnbound Travel Pvt Ltd',
        accountNumber: '50200012345678',
        swiftBic: 'HDFCINBBXXX'
      }
    },
    adminUser,
    'Group expanded from 4 to 6 PAX per partner addendum'
  );
  assert.strictEqual(adminPaxEdit.success, true, `Admin full edit failed: ${adminPaxEdit.error}`);
  const editedInv = adminPaxEdit.invoice!;
  assert.strictEqual(editedInv.invoiceNumber, 'TUB-PINV-CUSTOM-2026', 'Invoice number must update');
  assert.strictEqual(editedInv.totalPax, 6, 'Invoice PAX must update to 6');
  assert.strictEqual(editedInv.perPersonPrice, 100000, 'Per-person rate must remain 100,000');
  assert.strictEqual(editedInv.totalAmount, 600000, 'Invoice total must recalculate to 600,000');
  assert.strictEqual(editedInv.proformaFinalBookingAmount, 600000, 'Proforma final amount must recalculate to 600,000');
  assert.strictEqual(editedInv.balanceDue, 600000, 'Balance due must recalculate to 600,000');
  assert.strictEqual(editedInv.agencyName, 'Apex Premier Travel Pvt Ltd', 'Agency name must update');

  // Verify booking-wide financial & PAX synchronization
  const syncedBooking = db.getBookingById(bookingId, adminUser)!;
  assert.strictEqual(syncedBooking.customer?.totalPax, 6, 'Booking PAX must sync to 6');
  assert.strictEqual(syncedBooking.totalAmount, 600000, 'Booking totalAmount must sync to 600,000');
  assert.strictEqual(syncedBooking.current_selling_price, 600000, 'Booking current_selling_price must sync to 600,000');
  assert.strictEqual(syncedBooking.balanceDue, 600000, 'Booking balanceDue must sync to 600,000');
  assert.ok(
    editedInv.auditHistory?.some(a => a.action === 'PAX_RECALCULATED' && a.previousPax === 4 && a.newPax === 6),
    'PAX_RECALCULATED audit log must be recorded'
  );
  passed++;

  // Admin edit in TOTAL_DRIVES_PER_PERSON mode (540,000 / 6 PAX = 90,000/pax)
  const adminTotalEdit = db.editProformaInvoiceFull(
    bookingId,
    inv1.id,
    {
      totalPax: 6,
      totalAmount: 540000,
      recalcMode: 'TOTAL_DRIVES_PER_PERSON'
    },
    adminUser,
    'Negotiated corporate group package total'
  );
  assert.strictEqual(adminTotalEdit.success, true, 'Total-driven recalculation must succeed');
  assert.strictEqual(adminTotalEdit.invoice!.totalAmount, 540000);
  assert.strictEqual(adminTotalEdit.invoice!.perPersonPrice, 90000, 'Per-person price must recalculate to 90,000');
  assert.strictEqual(db.getBookingById(bookingId, adminUser)!.totalAmount, 540000);
  passed++;

  // =========================================================================
  // 2. PAYMENT SCHEDULE & INSTALMENT TRANCHES
  // =========================================================================
  // Non-Admin blocked
  const opsSchedule = db.saveBookingPaymentSchedule(
    bookingId,
    [{ title: 'Full Payment', dueDate: '2026-10-01', amount: 540000 }],
    opsUser,
    'Ops attempt'
  );
  assert.strictEqual(opsSchedule.success, false, 'Non-Admin must be blocked from editing payment schedule');

  // Mismatched tranche sum rejected
  const mismatchRes = db.saveBookingPaymentSchedule(
    bookingId,
    [
      { title: 'Tranche 1', dueDate: '2026-09-15', amount: 200000 },
      { title: 'Tranche 2', dueDate: '2026-10-15', amount: 200000 }
    ],
    adminUser,
    'Invalid sum test'
  );
  assert.strictEqual(mismatchRes.success, false, 'Schedule whose sum differs from revised booking total must be rejected');

  // Valid 3-tranche custom schedule (162,000 + 162,000 + 216,000 = 540,000)
  const validScheduleRes = db.saveBookingPaymentSchedule(
    bookingId,
    [
      { title: 'Tranche 1 — Booking Deposit', description: '30% confirmation deposit', dueDate: '2026-09-15', amount: 162000 },
      { title: 'Tranche 2 — Hotel Cut-off', description: '30% mid-term milestone', dueDate: '2026-10-05', amount: 162000 },
      { title: 'Tranche 3 — Final Balance', description: '40% pre-departure settlement', dueDate: '2026-10-25', amount: 216000 }
    ],
    adminUser,
    'Configured 3-tranche corporate payment schedule'
  );
  assert.strictEqual(validScheduleRes.success, true, `Valid 3-tranche save failed: ${validScheduleRes.error}`);
  const ps1 = validScheduleRes.paymentSchedule!;
  assert.strictEqual(ps1.installments.length, 3, 'Must save 3 tranches');
  assert.strictEqual(ps1.installments[0].percentage, 30, 'Tranche 1 percentage must be 30%');
  assert.strictEqual(ps1.installments[2].percentage, 40, 'Tranche 3 percentage must be 40%');
  assert.strictEqual(ps1.balanceDue, 540000, 'Remaining balance must be 540,000');
  assert.strictEqual(ps1.isManualCustomSchedule, true, 'Must mark custom schedule');
  assert.ok((ps1.auditHistory?.length || 0) >= 1, 'Schedule modification audit entry must be logged');
  passed++;

  // Apply Manual Discount (-40,000 => revised total 500,000) -> verify saved custom schedule v1 is NOT silently overwritten,
  // is flagged RECALCULATION_REQUIRED, and Admin can preview & save immutable Schedule v2!
  const bookingBeforeDiscount = db.getBookingById(bookingId, adminUser)!;
  const discountRes = await applyBookingManualDiscountAsync({
    booking: bookingBeforeDiscount,
    payload: {
      bookingId,
      discountSource: 'ADMIN_MANUAL_ADJUSTMENT',
      discountType: 'FIXED',
      discountValue: 40000,
      reason: 'Loyalty commercial goodwill discount'
    },
    user: adminUser
  });
  assert.strictEqual(
    discountRes.ok,
    true,
    `Manual discount failed: ${discountRes.ok === false ? discountRes.error : ''}`
  );
  const afterDiscountBooking = db.getBookingById(bookingId, adminUser)!;
  assert.strictEqual(
    afterDiscountBooking.paymentSchedule?.totalAmount,
    540000,
    'Committed custom payment schedule v1 must NOT be silently overwritten when a discount is applied'
  );
  assert.strictEqual(
    afterDiscountBooking.paymentSchedule?.scheduleStatus,
    'RECALCULATION_REQUIRED',
    'Saved custom schedule must be marked RECALCULATION_REQUIRED'
  );
  assert.strictEqual(
    afterDiscountBooking.paymentSchedule?.latestBookingAmount,
    500000,
    'Schedule must expose latestBookingAmount = 500,000 from revised snapshot'
  );
  assert.strictEqual(
    afterDiscountBooking.paymentSchedule?.requiresAdjustment,
    true,
    'Custom payment schedule must be flagged for adjustment after manual discount'
  );
  assert.ok(
    afterDiscountBooking.paymentSchedule?.auditHistory?.some(e => e.action === 'FLAGGED_FOR_ADJUSTMENT'),
    'Audit trail must record FLAGGED_FOR_ADJUSTMENT'
  );

  // Admin previews side-by-side recalculation before saving Schedule v2
  const previewRes = await previewBookingPaymentScheduleRecalculationAsync({
    booking: afterDiscountBooking,
    user: adminUser
  });
  assert.strictEqual(previewRes.ok, true, 'Admin recalculation preview must succeed');
  if (previewRes.ok) {
    assert.strictEqual(previewRes.preview.previousTotalScheduled, 540000);
    assert.strictEqual(previewRes.preview.recalculatedTotalScheduled, 500000);
    assert.strictEqual(previewRes.preview.nextScheduleVersion, 2);

    const recalcSaveRes = await saveBookingPaymentScheduleVersionAsync({
      booking: afterDiscountBooking,
      tranches: previewRes.preview.recalculatedInstallments.map(i => ({
        id: i.id,
        title: i.title,
        description: i.description,
        dueDate: i.dueDate,
        calculationMode: 'PERCENTAGE',
        percentage: i.percentage,
        amount: i.amount
      })),
      reason: 'Confirmed recalculated payment schedule v2 after INR 40,000 goodwill discount',
      isRecalculation: true,
      expectedSnapshotVersion: previewRes.preview.financialSnapshotVersion,
      user: adminUser
    });
    assert.strictEqual(
      recalcSaveRes.ok,
      true,
      `Recalculated v2 save failed: ${recalcSaveRes.ok === false ? recalcSaveRes.error : ''}`
    );
    if (recalcSaveRes.ok) {
      assert.strictEqual(recalcSaveRes.newSchedule.scheduleVersion, 2, 'Must increment to Schedule v2');
      assert.strictEqual(recalcSaveRes.newSchedule.totalAmount, 500000, 'Schedule v2 total must equal 500,000');
      assert.strictEqual(recalcSaveRes.newSchedule.requiresAdjustment, false, 'Adjustment flag must clear on v2');
      assert.strictEqual(recalcSaveRes.newSchedule.scheduleStatus, 'ACTIVE');
      const historyV1 = recalcSaveRes.updatedBooking.paymentScheduleHistory?.find(h => h.scheduleVersion === 1);
      assert.ok(historyV1, 'Historical Schedule v1 must remain preserved in paymentScheduleHistory');
      assert.strictEqual(historyV1?.totalAmount, 540000, 'Historical Schedule v1 total must remain 540,000');
      assert.strictEqual(historyV1?.scheduleStatus, 'SUPERSEDED', 'Historical Schedule v1 must be marked SUPERSEDED');
    }
  }
  passed++;

  // Simulate Tranche 1 settled (PAID) and confirm PAID tranche immutability protection
  const settledBooking = db.getBookingById(bookingId, adminUser)!;
  const firstTrancheAmt = settledBooking.paymentSchedule!.installments[0].amount;
  settledBooking.paidAmount = firstTrancheAmt;
  settledBooking.paymentSchedule!.installments[0].status = 'PAID';
  settledBooking.paymentSchedule!.installments[0].paidAmount = firstTrancheAmt;
  db.saveBooking(settledBooking, adminUser);

  const attemptDeletePaidTranche = db.saveBookingPaymentSchedule(
    bookingId,
    [{ title: 'Single Remaining', dueDate: '2026-10-25', amount: 500000 }],
    adminUser,
    'Try deleting paid tranche'
  );
  assert.strictEqual(attemptDeletePaidTranche.success, false, 'Deleting an already-PAID tranche must be blocked');
  passed++;

  // =========================================================================
  // 3. PROFORMA INVOICE ADMIN DELETE + PERMANENT AUDIT LOG
  // =========================================================================
  const beforeDeleteCount = db.getBookingInvoices(bookingId).length;
  const deleteRes = db.deleteProformaInvoice(
    bookingId,
    inv1.id,
    adminUser,
    'Replacing with consolidated corporate proforma'
  );
  assert.strictEqual(deleteRes.success, true, `Admin delete failed: ${deleteRes.error}`);
  const afterDeleteList = db.getBookingInvoices(bookingId);
  assert.strictEqual(
    afterDeleteList.some(inv => inv.id === inv1.id),
    false,
    'Deleted proforma must not appear in getBookingInvoices'
  );
  assert.strictEqual(afterDeleteList.length, beforeDeleteCount - 1, 'Invoice count must decrement by 1');
  const bookingAfterDelete = db.getBookingById(bookingId, adminUser)!;
  assert.ok(
    bookingAfterDelete.proformaInvoiceAuditHistory?.some(
      a => a.action === 'DELETED' && a.invoiceId === inv1.id && a.reason?.includes('consolidated corporate')
    ),
    'Permanent DELETED audit entry must remain on booking.proformaInvoiceAuditHistory'
  );
  passed++;

  // =========================================================================
  // 4. PASSENGER COMPLIANCE DOCUMENTS: PROGRESS, MULTI-FILE, RETRY & NO HANG
  // =========================================================================
  const memBlobs = new Map<string, Blob>();
  const memMeta = new Map<string, PassengerComplianceDocument>();
  let failOnceOnFileName = 'visa_scan_flaky.pdf';

  const testBinaryAdapter: PassengerDocumentBinaryAdapter = {
    async uploadFile({ storagePath, bytes, mimeType, onProgress }) {
      onProgress?.(25, 'FIRESTORE_CHUNKS');
      if (storagePath.includes('visa_scan_flaky') && failOnceOnFileName === 'visa_scan_flaky.pdf') {
        failOnceOnFileName = ''; // fail once, succeed on retry
        throw new Error('Simulated transient network drop');
      }
      onProgress?.(75, 'FIRESTORE_CHUNKS');
      const blob = bytes instanceof Blob ? bytes : new Blob([bytes as any], { type: mimeType });
      memBlobs.set(storagePath, blob);
      onProgress?.(100, 'FIRESTORE_CHUNKS');
      return {
        storagePath,
        fileSizeBytes: blob.size,
        storageBackend: 'FIRESTORE_CHUNKS',
        blobGroupId: `grp-${Date.now()}`,
        chunkCount: 1
      };
    },
    async downloadBlob(storagePath) {
      const b = memBlobs.get(storagePath);
      if (!b) throw new Error('Not found');
      return b;
    },
    async deleteFile(storagePath) {
      memBlobs.delete(storagePath);
    }
  };

  const testMetaAdapter: PassengerDocumentMetadataAdapter = {
    async saveMetadata(docRecord) {
      memMeta.set(docRecord.id, docRecord);
    },
    async listByBooking(bId) {
      return Array.from(memMeta.values()).filter(d => d.bookingId === bId);
    },
    async countStoragePathReferences(storagePath, excludeDocId) {
      return Array.from(memMeta.values()).filter(
        d => d.storagePath === storagePath && d.id !== excludeDocId && d.status !== 'DELETED'
      ).length;
    }
  };

  const testDeps = { binaryAdapter: testBinaryAdapter, metadataAdapter: testMetaAdapter };

  const progressEvents: PassengerDocumentUploadProgress[] = [];
  const pdfBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], {
    type: 'application/pdf'
  });

  const singleRes = await uploadPassengerComplianceDocument(
    {
      booking: db.getBookingById(bookingId, adminUser)!,
      passengerId: 'pax-audit-1',
      category: 'PASSPORT_FRONT',
      file: pdfBlob,
      originalFileName: 'aarav_passport_front.pdf',
      mimeType: 'application/pdf',
      onProgress: p => progressEvents.push(p)
    },
    adminUser,
    testDeps
  );
  assert.strictEqual(singleRes.success, true, `Single doc upload failed: ${singleRes.error}`);
  assert.strictEqual(singleRes.document?.storageBackend, 'FIRESTORE_CHUNKS');
  assert.ok(progressEvents.length >= 3, 'Must emit granular upload progress callbacks');
  assert.strictEqual(progressEvents[progressEvents.length - 1].percent, 100, 'Final progress must reach 100%');
  assert.strictEqual(progressEvents[progressEvents.length - 1].stage, 'COMPLETED');
  passed++;

  // Multi-file upload where 1 file succeeds and 1 file transiently fails -> retry succeeds!
  const multiResults = await uploadMultiplePassengerDocuments(
    {
      booking: db.getBookingById(bookingId, adminUser)!,
      passengerId: 'pax-audit-1',
      items: [
        {
          clientKey: 'file-1',
          category: 'PASSPORT_BACK',
          file: pdfBlob,
          originalFileName: 'aarav_passport_back.pdf',
          mimeType: 'application/pdf'
        },
        {
          clientKey: 'file-2',
          category: 'VISA_COPY',
          file: pdfBlob,
          originalFileName: 'visa_scan_flaky.pdf',
          mimeType: 'application/pdf'
        }
      ]
    },
    adminUser,
    testDeps
  );
  assert.strictEqual(multiResults.length, 2, 'Multi-file upload must return result for each file');
  assert.strictEqual(multiResults[0].result.success, true, 'First file in batch must succeed');
  assert.strictEqual(multiResults[1].result.success, false, 'Flaky second file must report clear failure without hanging');

  // Retry failed file
  const retryRes = await uploadPassengerComplianceDocument(
    {
      booking: db.getBookingById(bookingId, adminUser)!,
      passengerId: 'pax-audit-1',
      category: 'VISA_COPY',
      file: pdfBlob,
      originalFileName: 'visa_scan_flaky.pdf',
      mimeType: 'application/pdf'
    },
    adminUser,
    testDeps
  );
  assert.strictEqual(retryRes.success, true, 'Retrying failed upload must succeed cleanly');
  const savedForBooking = await testMetaAdapter.listByBooking(bookingId);
  assert.strictEqual(savedForBooking.length, 3, 'All 3 compliance documents must be permanently linked to booking & passenger');
  passed++;

  console.log(`\nALL ${passed} BOOKING DESK ENHANCEMENT AUDITS PASSED!`);
  process.exit(0);
}

runAudit().catch(err => {
  console.error('AUDIT FAILED:', err);
  process.exit(1);
});
