/**
 * End-to-End Automated Audit & Regression Suite:
 * - PART 1: Passenger Manifest & Compliance Documents (Firebase Storage + Firestore Metadata)
 * - PART 2: Proforma Invoices & Commercial Accounts (Decoupled from Tax Invoice Compliance)
 * - PART 4: Real PDF Rendering & Tax Invoice Regression Verification
 */
import zlib from 'zlib';
import { AppDatabase } from '../services/db';
import {
  Booking,
  CentralCompanyProfile,
  PassengerComplianceDocument,
  User
} from '../types';
import {
  PassengerDocumentBinaryAdapter,
  PassengerDocumentMetadataAdapter,
  deletePassengerComplianceDocument,
  filterScopedPassengerDocuments,
  loadBookingPassengerDocumentsFromFirestore,
  replacePassengerComplianceDocument,
  resolveAuthenticatedPassengerDocumentBlob,
  retrySavePassengerDocumentMetadata,
  updatePassengerDocumentVerification,
  uploadPassengerComplianceDocument
} from '../services/passengerDocumentService';
import {
  validateProformaInvoicePreflight,
  validateTaxInvoicePreflight
} from '../services/proformaInvoicePreflight';
import {
  ProformaPdfStorageAdapter,
  downloadProformaInvoiceDocument,
  generateAndPersistProformaInvoice
} from '../services/proformaInvoiceService';
import { generateProformaInvoicePDF } from '../services/bookingDocumentPdfService';

let passed = 0;
let failed = 0;

function assert(condition: unknown, label: string, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  [PASS] ${label}`);
  } else {
    failed += 1;
    console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function extractReadableTextFromPdfBytes(pdfBytes: Uint8Array): string {
  const raw = Buffer.from(pdfBytes).toString('latin1');
  const chunks: string[] = [raw];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const inflated = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      chunks.push(inflated);
    } catch {
      chunks.push(match[1]);
    }
  }
  const combined = chunks.join('\n');
  const literalMatches = combined.match(/\(([^()]*)\)/g) || [];
  const extracted = literalMatches
    .map(m => m.slice(1, -1).replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\'))
    .join(' ');
  return `${combined}\n${extracted}`;
}

function createInMemoryAdapters() {
  const storageFiles = new Map<string, { bytes: Uint8Array; mimeType: string; metadata: Record<string, string> }>();
  const firestoreDocs = new Map<string, PassengerComplianceDocument>();
  const callOrder: string[] = [];
  let failNextStorageUpload = false;
  let failNextMetadataSave = false;

  const binaryAdapter: PassengerDocumentBinaryAdapter = {
    async uploadFile({ storagePath, bytes, mimeType, customMetadata }) {
      callOrder.push(`STORAGE_UPLOAD:${storagePath}`);
      if (failNextStorageUpload) {
        failNextStorageUpload = false;
        throw new Error('Simulated Firebase Storage network error');
      }
      const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(await bytes.arrayBuffer());
      storageFiles.set(storagePath, { bytes: arr, mimeType, metadata: customMetadata });
      return { storagePath, fileSizeBytes: arr.byteLength };
    },
    async downloadBlob(storagePath) {
      const entry = storageFiles.get(storagePath);
      if (!entry) throw new Error(`Storage object not found: ${storagePath}`);
      return new Blob([entry.bytes], { type: entry.mimeType });
    },
    async deleteFile(storagePath) {
      callOrder.push(`STORAGE_DELETE:${storagePath}`);
      storageFiles.delete(storagePath);
    }
  };

  const metadataAdapter: PassengerDocumentMetadataAdapter = {
    async saveMetadata(docRecord) {
      callOrder.push(`FIRESTORE_SAVE:${docRecord.id}`);
      if (failNextMetadataSave) {
        failNextMetadataSave = false;
        throw new Error('Simulated Firestore write timeout');
      }
      firestoreDocs.set(docRecord.id, JSON.parse(JSON.stringify(docRecord)));
      AppDatabase.getInstance().upsertPassengerComplianceDocumentLocal(docRecord);
    },
    async listByBooking(bookingId) {
      const list = Array.from(firestoreDocs.values()).filter(d => d.bookingId === bookingId);
      AppDatabase.getInstance().mergePassengerComplianceDocumentsLocal(bookingId, list);
      return list;
    },
    async countStoragePathReferences(storagePath, excludeDocId) {
      let count = 0;
      for (const d of firestoreDocs.values()) {
        if (d.id === excludeDocId) continue;
        if (d.storagePath === storagePath && d.status !== 'DELETED') count += 1;
        else if (d.versionHistory?.some(v => v.storagePath === storagePath)) count += 1;
      }
      return count;
    }
  };

  return {
    storageFiles,
    firestoreDocs,
    callOrder,
    binaryAdapter,
    metadataAdapter,
    setFailNextStorageUpload(v: boolean) {
      failNextStorageUpload = v;
    },
    setFailNextMetadataSave(v: boolean) {
      failNextMetadataSave = v;
    }
  };
}

function createInMemoryProformaStorageAdapter() {
  const pdfStore = new Map<string, { bytes: Uint8Array; metadata: Record<string, string> }>();
  const adapter: ProformaPdfStorageAdapter = {
    async uploadPdf({ storagePath, bytes, customMetadata }) {
      pdfStore.set(storagePath, { bytes: new Uint8Array(bytes), metadata: customMetadata });
      return { storagePath, pdfSizeBytes: bytes.byteLength };
    },
    async downloadPdfBlob(storagePath) {
      const found = pdfStore.get(storagePath);
      if (!found) throw new Error(`Proforma PDF not found in Storage: ${storagePath}`);
      return new Blob([found.bytes], { type: 'application/pdf' });
    }
  };
  return { pdfStore, adapter };
}

async function runAudit() {
  console.log('\n=========================================================================');
  console.log('THEUNBOUND AUDIT: PASSENGER COMPLIANCE DOCS + PROFORMA INVOICE PIPELINE');
  console.log('=========================================================================\n');

  const db = AppDatabase.getInstance();

  const adminUser: User = {
    id: 'usr-admin-audit',
    name: 'Operations Admin',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    userType: 'ADMIN',
    approvalStatus: 'APPROVED'
  } as any;

  const opsStaffUser: User = {
    id: 'usr-ops-audit',
    name: 'Booking Desk Lead',
    email: 'ops@theunbound.in',
    role: 'TEAM_MEMBER',
    userType: 'TEAM_MEMBER',
    approvalStatus: 'APPROVED',
    permissions: {
      cmsOperations: { enabled: true },
      cmsFinance: { enabled: false }
    }
  } as any;

  const ownerAgentUser: User = {
    id: 'usr-agent-owner',
    name: 'Priya Sharma',
    email: 'priya@horizonholidays.in',
    agencyName: 'Horizon Holidays Pvt Ltd',
    role: 'B2B_AGENT',
    userType: 'B2B_AGENT',
    approvalStatus: 'APPROVED'
  } as any;

  const otherAgentUser: User = {
    id: 'usr-agent-other',
    name: 'Vikram Mehta',
    email: 'vikram@otheragency.in',
    agencyName: 'Other Agency',
    role: 'B2B_AGENT',
    userType: 'B2B_AGENT',
    approvalStatus: 'APPROVED'
  } as any;

  const directBuyerUser: User = {
    id: 'usr-buyer-blocked',
    name: 'Direct Buyer',
    email: 'buyer@example.com',
    role: 'BUYER',
    userType: 'BUYER',
    approvalStatus: 'APPROVED'
  } as any;

  // Configure authoritative Central Company Profile WITHOUT GSTIN to prove Proforma works without tax registration
  const companyProfileNoGst: CentralCompanyProfile = {
    id: 'central_company_profile',
    companyName: 'TheUnbound Travel Experiences',
    legalName: 'TheUnbound Travel Experiences LLP',
    registeredAddress: 'Suite 402, Heritage Corporate Plaza, Connaught Place, New Delhi 110001, India',
    currentAddress: 'Floor 8, Cyber Greens Tower B, Gurugram, Haryana 122002, India',
    phone: '+91-11-4000-8899',
    email: 'accounts@theunbound.in',
    salesEmail: 'sales@theunbound.in',
    opsEmail: 'ops@theunbound.in',
    whatsappNumber: '+91-98100-00001',
    emergencyContact: '+91-98100-00002',
    website: 'https://theunbound.in',
    gstin: '',
    updatedAt: new Date().toISOString()
  };
  db.updateCentralCompanyProfile(companyProfileNoGst, adminUser);

  const now = new Date().toISOString();
  const bookingA: Booking = {
    id: 'bk-audit-docs-001',
    bookingReference: 'UB-2026-AUDIT-01',
    userId: ownerAgentUser.id,
    agentId: ownerAgentUser.id,
    assignedAgentId: ownerAgentUser.id,
    submittingAgentId: ownerAgentUser.id,
    submittedByUserId: ownerAgentUser.id,
    agentNameSnapshot: ownerAgentUser.name,
    agentEmailSnapshot: ownerAgentUser.email,
    agentAgencySnapshot: ownerAgentUser.agencyName,
    status: 'CONFIRMED',
    paymentStatus: 'PARTIALLY_PAID',
    currency: 'INR',
    totalAmount: 142500,
    amountPaid: 42500,
    balanceDue: 100000,
    internalNettCost: 112000,
    totalSupplierCost: 112000,
    internalProfit: 30500,
    totalTax: 7125,
    serviceFee: 2500,
    currentPricingSnapshotId: 'SNAP-AUDIT-001-V2',
    currentPricingSnapshotVersion: 2,
    pricingSnapshotHistory: [
      {
        snapshotId: 'SNAP-AUDIT-001-V1',
        version: 1,
        bookingId: 'bk-audit-docs-001',
        bookingReference: 'UB-2026-AUDIT-01',
        currency: 'INR',
        supplierNettCost: 112000,
        originalTheUnboundMargin: 38000,
        cumulativeAdminManualDiscounts: 0,
        remainingTheUnboundMargin: 38000,
        originalCustomerSellingPrice: 150000,
        revisedCustomerSellingPrice: 150000,
        triggerType: 'INITIAL_BOOKING',
        createdAt: now,
        createdBy: adminUser.id,
        createdByName: adminUser.name,
        immutable: true
      },
      {
        snapshotId: 'SNAP-AUDIT-001-V2',
        version: 2,
        bookingId: 'bk-audit-docs-001',
        bookingReference: 'UB-2026-AUDIT-01',
        currency: 'INR',
        supplierNettCost: 112000,
        originalTheUnboundMargin: 38000,
        cumulativeAdminManualDiscounts: 7500,
        remainingTheUnboundMargin: 30500,
        originalCustomerSellingPrice: 150000,
        revisedCustomerSellingPrice: 142500,
        triggerType: 'ADMIN_MANUAL_DISCOUNT',
        createdAt: now,
        createdBy: adminUser.id,
        createdByName: adminUser.name,
        immutable: true
      }
    ],
    customer: {
      leadTravelerName: 'Aarav Kapoor',
      email: '', // Intentionally blank secondary email to verify Proforma does NOT block on optional guest email
      phone: '+91-98100-11223',
      agencyName: 'Horizon Holidays Pvt Ltd',
      nationality: 'Indian',
      totalAdults: 2,
      totalChildren: 0
    },
    passengers: [
      {
        id: 'pax-a-001',
        passengerNumber: 1,
        firstName: 'Aarav',
        lastName: 'Kapoor',
        fullName: 'Aarav Kapoor',
        isLeadPax: true,
        nationality: 'Indian',
        passportNumber: 'Z9001122',
        passportExpiryDate: '2031-08-15'
      },
      {
        id: 'pax-b-002',
        passengerNumber: 2,
        firstName: 'Meera',
        lastName: 'Kapoor',
        fullName: 'Meera Kapoor',
        isLeadPax: false,
        nationality: 'Indian',
        passportNumber: 'Z9003344',
        passportExpiryDate: '2030-05-20'
      }
    ],
    items: [
      {
        id: 'svc-item-1',
        productId: 'prod-tokyo-1',
        productName: 'Tokyo Private Cultural Immersion & Luxury Van Charter',
        destinationName: 'Tokyo',
        category: 'EXPERIENCE',
        serviceDate: '2026-10-12',
        adults: 2,
        children: 0,
        totalPax: 2,
        unitNetPrice: 56000,
        nettCost: 112000,
        unitPrice: 71250,
        totalSellingPrice: 142500,
        currency: 'INR'
      } as any
    ],
    createdAt: now,
    updatedAt: now
  } as any;

  const bookingB: Booking = {
    ...JSON.parse(JSON.stringify(bookingA)),
    id: 'bk-audit-docs-002',
    bookingReference: 'UB-2026-AUDIT-02',
    assignedAgentId: otherAgentUser.id,
    agentId: otherAgentUser.id,
    submittingAgentId: otherAgentUser.id,
    submittedByUserId: otherAgentUser.id,
    passengers: [
      {
        id: 'pax-c-003',
        passengerNumber: 1,
        firstName: 'Rohan',
        lastName: 'Verma',
        fullName: 'Rohan Verma',
        isLeadPax: true,
        nationality: 'Indian'
      }
    ]
  };

  db.saveBooking(bookingA, adminUser);
  db.saveBooking(bookingB, adminUser);

  // =========================================================================
  // PART 1 TESTS: PASSENGER MANIFEST & COMPLIANCE DOCUMENTS
  // =========================================================================
  console.log('--- PART 1: PASSENGER MANIFEST & COMPLIANCE DOCUMENTS ---');

  const adapters = createInMemoryAdapters();
  const samplePdfBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])], {
    type: 'application/pdf'
  });
  const sampleJpgBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], {
    type: 'image/jpeg'
  });

  // Test 1: Single document upload order (Storage first -> Firestore second) + zero base64 in booking
  const up1 = await uploadPassengerComplianceDocument(
    {
      booking: bookingA,
      passengerId: 'pax-a-001',
      category: 'PASSPORT_FRONT',
      file: samplePdfBlob,
      originalFileName: 'Aarav_Passport_Front.pdf',
      mimeType: 'application/pdf',
      expiryDate: '2031-08-15'
    },
    adminUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  assert(up1.success && Boolean(up1.document), 'Test 1a: Single compliance document upload succeeds');
  assert(
    adapters.callOrder[0]?.startsWith('STORAGE_UPLOAD:') &&
      adapters.callOrder[1]?.startsWith('FIRESTORE_SAVE:'),
    'Test 1b: Storage upload completes strictly BEFORE Firestore metadata write'
  );
  assert(
    up1.document!.storagePath.startsWith('bookings/bk-audit-docs-001/passengers/pax-a-001/documents/'),
    'Test 1c: Predictable unique Storage path generated for booking + passenger'
  );
  const refreshedBookingA = db.getBookingById(bookingA.id, adminUser)!;
  const paxA = refreshedBookingA.passengers!.find(p => p.id === 'pax-a-001')!;
  assert(
    Boolean(paxA.passportFrontUrl?.startsWith('storage://')) && !paxA.passportFrontUrl?.startsWith('data:'),
    'Test 1d: Booking record stores lightweight storage:// pointer (ZERO base64 binary in Firestore)'
  );

  // Test 2: Multiple documents for a single passenger
  const up2 = await uploadPassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      passengerId: 'pax-a-001',
      category: 'PASSPORT_BACK',
      file: sampleJpgBlob,
      originalFileName: 'Aarav_Passport_Back.jpg',
      mimeType: 'image/jpeg'
    },
    adminUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  const up3 = await uploadPassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      passengerId: 'pax-a-001',
      category: 'PAN_CARD',
      file: samplePdfBlob,
      originalFileName: 'Aarav_PAN_Card.pdf',
      mimeType: 'application/pdf'
    },
    adminUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  const up4 = await uploadPassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      passengerId: 'pax-a-001',
      category: 'TRAVEL_INSURANCE',
      file: samplePdfBlob,
      originalFileName: 'Aarav_Travel_Insurance.pdf',
      mimeType: 'application/pdf'
    },
    adminUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  assert(
    up2.success && up3.success && up4.success,
    'Test 2: Multiple compliance documents (Passport Back, Lead PAN, Travel Insurance) persist for single passenger'
  );

  // Test 3: Multiple passengers + strict Passenger A vs Passenger B & Booking A vs Booking B isolation
  const upPaxB = await uploadPassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      passengerId: 'pax-b-002',
      category: 'PASSPORT_FRONT',
      file: samplePdfBlob,
      originalFileName: 'Meera_Passport_Front.pdf',
      mimeType: 'application/pdf'
    },
    ownerAgentUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  const upBookingB = await uploadPassengerComplianceDocument(
    {
      booking: bookingB,
      passengerId: 'pax-c-003',
      category: 'PASSPORT_FRONT',
      file: samplePdfBlob,
      originalFileName: 'Rohan_Passport_Front.pdf',
      mimeType: 'application/pdf'
    },
    otherAgentUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  const allFirestoreDocs = Array.from(adapters.firestoreDocs.values());
  const scopedPaxA = filterScopedPassengerDocuments(allFirestoreDocs, bookingA.id, 'pax-a-001');
  const scopedPaxB = filterScopedPassengerDocuments(allFirestoreDocs, bookingA.id, 'pax-b-002');
  const scopedBookingB = filterScopedPassengerDocuments(allFirestoreDocs, bookingB.id, 'pax-c-003');
  assert(
    upPaxB.success && upBookingB.success && scopedPaxA.length === 4 && scopedPaxB.length === 1 && scopedBookingB.length === 1,
    'Test 3a: Multi-passenger & multi-booking document counts match exact ownership'
  );
  assert(
    scopedPaxA.every(d => d.passengerId === 'pax-a-001' && d.bookingId === bookingA.id) &&
      scopedPaxB.every(d => d.passengerId === 'pax-b-002' && d.bookingId === bookingA.id),
    'Test 3b: Strict isolation — Passenger A docs never appear under Passenger B or Booking B'
  );

  // Test 4: Storage upload failure aborts cleanly without orphan Firestore metadata
  const countBeforeStorageFail = adapters.firestoreDocs.size;
  adapters.setFailNextStorageUpload(true);
  const failedStorageRes = await uploadPassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      passengerId: 'pax-b-002',
      category: 'VISA_COPY',
      file: samplePdfBlob,
      originalFileName: 'Meera_Visa_Fail.pdf',
      mimeType: 'application/pdf'
    },
    ownerAgentUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  assert(
    !failedStorageRes.success &&
      failedStorageRes.errorCode === 'STORAGE_UPLOAD_FAILED' &&
      adapters.firestoreDocs.size === countBeforeStorageFail,
    'Test 4: Storage failure aborts cleanly with ZERO orphan Firestore metadata written'
  );

  // Test 5: Metadata write failure returns recoverableDraft; Retry Save Metadata succeeds idempotently
  adapters.setFailNextMetadataSave(true);
  const failedMetaRes = await uploadPassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      passengerId: 'pax-b-002',
      category: 'VISA_COPY',
      file: samplePdfBlob,
      originalFileName: 'Meera_Japan_Visa.pdf',
      mimeType: 'application/pdf'
    },
    ownerAgentUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  assert(
    !failedMetaRes.success &&
      failedMetaRes.errorCode === 'METADATA_SAVE_FAILED' &&
      Boolean(failedMetaRes.recoverableDraft?.uploadedAtStorage),
    'Test 5a: Metadata failure returns recoverableDraft while file remains safe in Storage'
  );
  const retryRes = await retrySavePassengerDocumentMetadata(
    failedMetaRes.recoverableDraft!,
    refreshedBookingA,
    ownerAgentUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  const retryAgainRes = await retrySavePassengerDocumentMetadata(
    failedMetaRes.recoverableDraft!,
    refreshedBookingA,
    ownerAgentUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  const visaDocsForPaxB = Array.from(adapters.firestoreDocs.values()).filter(
    d => d.bookingId === bookingA.id && d.passengerId === 'pax-b-002' && d.category === 'VISA_COPY'
  );
  assert(
    retryRes.success && retryAgainRes.success && visaDocsForPaxB.length === 1,
    'Test 5b: Retry Save Metadata succeeds idempotently with ZERO duplicate metadata records'
  );

  // Test 6: Document replacement creates new versioned Storage path & preserves v1 immutably
  const originalV1Path = up1.document!.storagePath;
  const replaceRes = await replacePassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      existingDocument: up1.document!,
      file: sampleJpgBlob,
      originalFileName: 'Aarav_Passport_Front_HD.jpg',
      mimeType: 'image/jpeg',
      replaceReason: 'Higher resolution color scan'
    },
    adminUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  assert(
    replaceRes.success &&
      replaceRes.document!.version === 2 &&
      replaceRes.document!.storagePath !== originalV1Path &&
      replaceRes.document!.versionHistory?.length === 1 &&
      replaceRes.document!.versionHistory![0].storagePath === originalV1Path &&
      adapters.storageFiles.has(originalV1Path) &&
      adapters.storageFiles.has(replaceRes.document!.storagePath),
    'Test 6: Replacement uploads to new versioned path, increments v2, and preserves original v1 file untouched'
  );

  // Test 7: Simulated reload / cross-session persistence (clear local memory cache -> re-hydrate from Firestore)
  db.mergePassengerComplianceDocumentsLocal(bookingA.id, []);
  assert(
    db.getPassengerComplianceDocuments(bookingA.id).length === 0,
    'Test 7a: Local cache cleared to simulate page reload / fresh sign-in'
  );
  const rehydratedDocs = await loadBookingPassengerDocumentsFromFirestore(bookingA.id, {
    metadataAdapter: adapters.metadataAdapter
  });
  assert(
    rehydratedDocs.length === 6 &&
      rehydratedDocs.some(d => d.id === up1.document!.id && d.version === 2),
    'Test 7b: Hydrating from Firestore restores all persisted documents and v2 replacement metadata'
  );

  // Test 8: Authenticated preview & download access control
  const previewAdmin = await resolveAuthenticatedPassengerDocumentBlob(
    replaceRes.document!,
    refreshedBookingA,
    adminUser,
    { binaryAdapter: adapters.binaryAdapter }
  );
  const previewOwner = await resolveAuthenticatedPassengerDocumentBlob(
    replaceRes.document!,
    refreshedBookingA,
    ownerAgentUser,
    { binaryAdapter: adapters.binaryAdapter }
  );
  const previewOtherAgent = await resolveAuthenticatedPassengerDocumentBlob(
    replaceRes.document!,
    refreshedBookingA,
    otherAgentUser,
    { binaryAdapter: adapters.binaryAdapter }
  );
  const previewBuyer = await resolveAuthenticatedPassengerDocumentBlob(
    replaceRes.document!,
    refreshedBookingA,
    directBuyerUser,
    { binaryAdapter: adapters.binaryAdapter }
  );
  assert(
    previewAdmin.success && previewOwner.success && !previewOtherAgent.success && !previewBuyer.success,
    'Test 8: Authenticated Storage blob fetch allows Admin & owning Agent, blocks unrelated Agent & Direct Buyer'
  );

  // Test 9: Verification status update + Authorized deletion (unreferenced deleted vs shared retained)
  const verifyRes = await updatePassengerDocumentVerification(
    {
      booking: refreshedBookingA,
      document: replaceRes.document!,
      verificationStatus: 'APPROVED',
      verificationNotes: 'Bio page matches manifest'
    },
    adminUser,
    { metadataAdapter: adapters.metadataAdapter }
  );
  assert(
    verifyRes.success && verifyRes.document!.verificationStatus === 'APPROVED',
    'Test 9a: Internal staff verification status & notes persisted cleanly'
  );

  const deleteUnrefRes = await deletePassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      document: up4.document!,
      reason: 'Superseded insurance certificate'
    },
    adminUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  assert(
    deleteUnrefRes.success &&
      deleteUnrefRes.document!.status === 'DELETED' &&
      Boolean(deleteUnrefRes.document!.deletedBy) &&
      deleteUnrefRes.storageDeleted === true &&
      !adapters.storageFiles.has(up4.document!.storagePath),
    'Test 9b: Authorized delete soft-deletes metadata for audit & removes unreferenced Storage object'
  );

  // Simulate shared-path reference safety check before Storage deletion
  const sharedDocClone: PassengerComplianceDocument = {
    ...up2.document!,
    id: 'paxdoc-shared-ref-clone'
  };
  await adapters.metadataAdapter.saveMetadata(sharedDocClone);
  const deleteSharedRes = await deletePassengerComplianceDocument(
    {
      booking: refreshedBookingA,
      document: up2.document!,
      reason: 'Remove duplicate reference'
    },
    adminUser,
    { binaryAdapter: adapters.binaryAdapter, metadataAdapter: adapters.metadataAdapter }
  );
  assert(
    deleteSharedRes.success &&
      deleteSharedRes.storageDeleted === false &&
      adapters.storageFiles.has(up2.document!.storagePath),
    'Test 9c: Shared Storage path is safely RETAINED when another active record references it'
  );

  // Test 10: External B2B agent on submitted booking preserves Visa fields & cannot tamper identity
  const bookingBeforeAgentUpdate = db.getBookingById(bookingA.id, adminUser)!;
  db.updateBookingPassenger(
    bookingA.id,
    'pax-b-002',
    {
      firstName: 'HACKED_NAME',
      visaCopyName: 'Meera_Japan_Visa.pdf',
      visaCopyUrl: 'storage://bookings/bk-audit-docs-001/passengers/pax-b-002/documents/visa/v1.pdf'
    },
    ownerAgentUser
  );
  const afterAgentUpdate = db.getBookingById(bookingA.id, adminUser)!;
  const paxBAfter = afterAgentUpdate.passengers!.find(p => p.id === 'pax-b-002')!;
  assert(
    paxBAfter.firstName === 'Meera' &&
      paxBAfter.visaCopyName === 'Meera_Japan_Visa.pdf' &&
      Boolean(paxBAfter.visaCopyUrl?.startsWith('storage://')),
    'Test 10: External B2B agent on submitted booking preserves Visa copy fields while identity remains immutable'
  );

  // =========================================================================
  // PART 2 TESTS: PROFORMA INVOICES & COMMERCIAL ACCOUNTS
  // =========================================================================
  console.log('\n--- PART 2: PROFORMA INVOICES & COMMERCIAL ACCOUNTS ---');

  // Test 11: Proforma succeeds WITHOUT GSTIN, tax series, tax approval, or optional guest email
  const preflightOps = validateProformaInvoicePreflight(bookingA.id, opsStaffUser);
  assert(
    preflightOps.valid && !preflightOps.error,
    'Test 11: Proforma preflight SUCCEEDS for Ops staff without company GSTIN, customer GSTIN, tax series, tax approval, or optional guest email'
  );

  // Test 12: Essential controls still enforced (unauthenticated, unauthorized, cancelled, missing ref, missing currency, missing/zero amount)
  const pfNoAuth = validateProformaInvoicePreflight(bookingA.id, null);
  const pfBuyer = validateProformaInvoicePreflight(bookingA.id, directBuyerUser);
  const pfOtherAgent = validateProformaInvoicePreflight(bookingA.id, otherAgentUser);
  assert(
    !pfNoAuth.valid && !pfBuyer.valid && !pfOtherAgent.valid,
    'Test 12a: Unauthenticated users, Direct Buyers, and unrelated B2B Agents are strictly blocked'
  );

  const cancelledBooking: Booking = {
    ...JSON.parse(JSON.stringify(bookingA)),
    id: 'bk-audit-cancelled',
    bookingReference: 'UB-CANCELLED-01',
    status: 'CANCELLED'
  };
  const zeroAmountBooking: Booking = {
    ...JSON.parse(JSON.stringify(bookingA)),
    id: 'bk-audit-zero',
    bookingReference: 'UB-ZERO-01',
    totalAmount: 0,
    pricingSnapshotHistory: [],
    items: []
  };
  const noCurrencyBooking: Booking = {
    ...JSON.parse(JSON.stringify(bookingA)),
    id: 'bk-audit-nocurr',
    bookingReference: 'UB-NOCURR-01',
    currency: '' as any,
    pricingSnapshotHistory: [],
    items: [{ id: 'i1', productName: 'Test', totalSellingPrice: 1000 } as any]
  };
  const noRefBooking: Booking = {
    ...JSON.parse(JSON.stringify(bookingA)),
    id: 'bk-audit-noref',
    bookingReference: ''
  };
  db.saveBooking(cancelledBooking, adminUser);
  db.saveBooking(zeroAmountBooking, adminUser);
  db.saveBooking(noCurrencyBooking, adminUser);
  db.saveBooking(noRefBooking, adminUser);

  assert(
    validateProformaInvoicePreflight(cancelledBooking.id, adminUser).error?.code === 'BOOKING_INVALID',
    'Test 12b: Cancelled booking is blocked from Proforma generation'
  );
  assert(
    validateProformaInvoicePreflight(zeroAmountBooking.id, adminUser).error?.code === 'FINANCIAL_SNAPSHOT_MISSING',
    'Test 12c: Missing/zero financial snapshot amount is blocked (never invents fabricated amount)'
  );
  assert(
    validateProformaInvoicePreflight(noCurrencyBooking.id, adminUser).error?.code === 'CURRENCY_MISSING',
    'Test 12d: Missing booking currency is blocked'
  );
  assert(
    validateProformaInvoicePreflight(noRefBooking.id, adminUser).error?.code === 'BOOKING_REFERENCE_MISSING',
    'Test 12e: Missing booking reference is blocked'
  );

  // Test 13 & 14 & 15: End-to-end Proforma generation + Storage PDF upload + Real PDF text reconciliation + Idempotency + Versioning + Cross-session reload
  const proformaStorage = createInMemoryProformaStorageAdapter();
  const idempKey = 'PF-IDEMP-AUDIT-001';
  const genV1 = await generateAndPersistProformaInvoice(bookingA.id, opsStaffUser, {
    idempotencyKey: idempKey,
    storageAdapter: proformaStorage.adapter
  });
  assert(
    genV1.success &&
      Boolean(genV1.invoice) &&
      genV1.storagePersisted === true &&
      Boolean(genV1.invoice!.storagePath?.startsWith(`bookings/${bookingA.id}/proforma-invoices/`)) &&
      Boolean(genV1.pdfBytes && genV1.pdfBytes.byteLength > 1000),
    'Test 13a: Proforma Invoice generated, real PDF rendered (>1 KB), and PDF persisted to Firebase Storage'
  );

  assert(
    genV1.invoice!.totalAmount === 142500 &&
      genV1.invoice!.proformaFinalBookingAmount === 142500 &&
      Boolean(genV1.invoice!.sourcePricingSnapshotId) &&
      genV1.invoice!.documentType === 'PROFORMA_INVOICE' &&
      genV1.invoice!.agentId === ownerAgentUser.id,
    'Test 13b: Proforma reconciles exactly to authoritative snapshot revisedCustomerSellingPrice (142,500 INR) & sets ownership metadata',
    `Got total=${genV1.invoice!.totalAmount}, snap=${genV1.invoice!.sourcePricingSnapshotId}, agentId=${genV1.invoice!.agentId}`
  );

  // Real PDF text extraction audit (normalize wrapped PDF line breaks to spaces)
  const pdfText = extractReadableTextFromPdfBytes(genV1.pdfBytes!).replace(/\s+/g, ' ');
  const requiredPdfTokens = [
    'PROFORMA INVOICE',
    'UB-2026-AUDIT-01',
    '142,500',
    'TheUnbound Travel Experiences LLP',
    'Heritage Corporate Plaza',
    'Cyber Greens Tower B',
    'preliminary commercial document'
  ];
  const missingTokens = requiredPdfTokens.filter(t => !pdfText.includes(t));
  assert(
    missingTokens.length === 0,
    'Test 14a: Real PDF includes PROFORMA INVOICE header, booking ref, Final Booking Amount, authoritative Central Company Profile addresses, and non-tax disclaimer',
    missingTokens.length > 0 ? `Missing tokens: ${missingTokens.join(', ')}` : undefined
  );
  assert(
    !pdfText.includes('Service Fee') &&
      !pdfText.includes('Net Price') &&
      !pdfText.includes('112,000') &&
      !pdfText.includes('30,500') &&
      !pdfText.includes('7,125') &&
      !pdfText.includes('50200084920192') &&
      !pdfText.includes('HDFCINBB'),
    'Test 14b: Real PDF contains ZERO separate TAX/Service Fee lines, ZERO supplier net cost/margin leaks, and ZERO hardcoded fake bank details'
  );

  // Idempotent retry prevents duplicate invoice creation
  const retryGenV1 = await generateAndPersistProformaInvoice(bookingA.id, opsStaffUser, {
    idempotencyKey: idempKey,
    storageAdapter: proformaStorage.adapter
  });
  assert(
    retryGenV1.success &&
      retryGenV1.invoice!.id === genV1.invoice!.id &&
      db.getBookingInvoices(bookingA.id).length === 1,
    'Test 15a: Retrying Proforma generation with same idempotencyKey prevents duplicate records'
  );

  // Explicit regeneration creates v2 while preserving v1 immutably
  const genV2 = await generateAndPersistProformaInvoice(bookingA.id, adminUser, {
    forceRegenerate: true,
    reason: 'Updated due date per agency request',
    storageAdapter: proformaStorage.adapter
  });
  const allBookingAInvoices = db.getBookingInvoices(bookingA.id);
  assert(
    genV2.success &&
      genV2.invoice!.id !== genV1.invoice!.id &&
      genV2.invoice!.invoiceVersion === 2 &&
      allBookingAInvoices.length === 2 &&
      allBookingAInvoices.some(i => i.id === genV1.invoice!.id && i.invoiceVersion === 1),
    'Test 15b: Regenerating Proforma creates v2 while preserving v1 immutably'
  );

  // Download test from persisted Storage PDF
  const dlRes = await downloadProformaInvoiceDocument(
    genV2.invoice!,
    bookingA,
    companyProfileNoGst,
    proformaStorage.adapter
  );
  assert(
    dlRes.success && dlRes.source === 'STORAGE',
    'Test 15c: Proforma download retrieves persisted PDF directly from Firebase Storage'
  );

  // Cross-session hydration fix verification (`booking_invoices` empty while Firestore `invoices` cache has records)
  (db as any).setItem('booking_invoices', []);
  (db as any).setItem('invoices', [genV1.invoice!, genV2.invoice!]);
  const hydratedInvoices = db.getBookingInvoices(bookingA.id);
  assert(
    hydratedInvoices.length === 2 &&
      hydratedInvoices[0].id === genV2.invoice!.id &&
      hydratedInvoices[1].id === genV1.invoice!.id,
    'Test 15d: Cross-session Firestore `invoices` hydration restores all Proforma versions even when `booking_invoices` local cache is empty'
  );

  // Test 16: Tax Invoice Regression Test — Tax Invoice MUST STILL enforce statutory compliance
  const taxNoGstRes = validateTaxInvoicePreflight(bookingA.id, adminUser, {
    taxInvoiceSeriesConfigured: false,
    taxInvoiceApproved: false
  });
  assert(
    !taxNoGstRes.valid && taxNoGstRes.error?.code === 'TAX_REGISTRATION_MISSING',
    'Test 16a: Tax Invoice preflight STILL blocks when issuing company GSTIN is missing'
  );

  // Configure Company GSTIN, then verify Tax Series, Tax Approval, Finance role, and Customer Billing gates
  db.updateCentralCompanyProfile({ ...companyProfileNoGst, gstin: '07AABCU9603R1ZM' }, adminUser);

  const taxNoSeriesRes = validateTaxInvoicePreflight(bookingA.id, adminUser, {
    taxInvoiceSeriesConfigured: false,
    taxInvoiceApproved: true
  });
  assert(
    !taxNoSeriesRes.valid && taxNoSeriesRes.error?.code === 'TAX_SERIES_MISSING',
    'Test 16b: Tax Invoice preflight STILL blocks when statutory Tax Invoice numbering series is missing'
  );

  const taxNoApprovalRes = validateTaxInvoicePreflight(bookingA.id, adminUser, {
    taxInvoiceSeriesConfigured: true,
    taxInvoiceApproved: false
  });
  assert(
    !taxNoApprovalRes.valid && taxNoApprovalRes.error?.code === 'TAX_APPROVAL_REQUIRED',
    'Test 16c: Tax Invoice preflight STILL blocks when statutory Finance approval is missing'
  );

  const taxOpsBlocked = validateTaxInvoicePreflight(bookingA.id, opsStaffUser, {
    taxInvoiceSeriesConfigured: true,
    taxInvoiceApproved: true
  });
  assert(
    !taxOpsBlocked.valid && taxOpsBlocked.error?.code === 'PERMISSION_DENIED',
    'Test 16d: Tax Invoice preflight STILL restricts statutory issuance to Admin/Finance (non-Finance Ops blocked)'
  );

  const taxMissingEmailRes = validateTaxInvoicePreflight(bookingA.id, adminUser, {
    taxInvoiceSeriesConfigured: true,
    taxInvoiceApproved: true
  });
  assert(
    !taxMissingEmailRes.valid && taxMissingEmailRes.error?.code === 'CUSTOMER_DETAILS_MISSING',
    'Test 16e: Tax Invoice preflight STILL requires statutory customer billing email (unlike Proforma)'
  );

  // Ensure valid statutory Tax Invoice passes when all statutory requirements are satisfied
  const taxReadyBooking: Booking = {
    ...JSON.parse(JSON.stringify(bookingA)),
    id: 'bk-audit-tax-ready',
    bookingReference: 'UB-TAX-READY-01',
    customer: {
      ...bookingA.customer,
      email: 'finance@horizonholidays.in'
    }
  };
  db.saveBooking(taxReadyBooking, adminUser);
  const taxValidRes = validateTaxInvoicePreflight(taxReadyBooking.id, adminUser, {
    taxInvoiceSeriesConfigured: true,
    taxInvoiceApproved: true
  });
  assert(
    taxValidRes.valid && !taxValidRes.error,
    'Test 16f: Tax Invoice preflight PASSES cleanly when all statutory Finance & GST requirements are met'
  );

  console.log('\n=========================================================================');
  console.log(`AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================================================\n');
  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit script crashed:', err);
  process.exit(1);
});
