import { ref, uploadBytes, getBlob } from 'firebase/storage';
import { Booking, BookingInvoice, CentralCompanyProfile, User } from '../types';
import { AppDatabase } from './db';
import { auth, getFirebaseStorage } from './firebase';
import {
  ProformaPreflightError,
  validateProformaInvoicePreflight
} from './proformaInvoicePreflight';
import {
  buildDocumentIdempotencyKey,
  resolveAuthoritativeProformaAmount
} from './bookingOperationsSyncService';
import { generateProformaInvoicePDF } from './bookingDocumentPdfService';

export interface ProformaPdfStorageAdapter {
  uploadPdf(params: {
    storagePath: string;
    bytes: Uint8Array;
    customMetadata: Record<string, string>;
  }): Promise<{ storagePath: string; pdfSizeBytes: number }>;
  downloadPdfBlob(storagePath: string): Promise<Blob>;
}

export interface ProformaInvoicePersistResult {
  success: boolean;
  invoice?: BookingInvoice;
  storagePersisted?: boolean;
  firestorePersisted?: boolean;
  pdfBytes?: Uint8Array;
  error?: ProformaPreflightError;
}

function sanitizeSegment(raw: string, maxLen = 80): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || 'proforma').slice(0, maxLen);
}

export function buildProformaInvoiceStoragePath(params: {
  bookingId: string;
  invoiceId: string;
  invoiceNumber: string;
  version: number;
}): string {
  const safeBooking = sanitizeSegment(params.bookingId, 64);
  const safeInvoiceId = sanitizeSegment(params.invoiceId, 64);
  const safeNum = sanitizeSegment(params.invoiceNumber, 64);
  return `bookings/${safeBooking}/proforma-invoices/${safeInvoiceId}/v${params.version}_${safeNum}.pdf`;
}

const defaultProformaPdfStorageAdapter: ProformaPdfStorageAdapter = {
  async uploadPdf({ storagePath, bytes, customMetadata }) {
    const storageInstance = getFirebaseStorage();
    if (!storageInstance) {
      throw new Error('Firebase Storage is not initialized.');
    }
    const storageRef = ref(storageInstance, storagePath);
    const snapshot = await uploadBytes(storageRef, bytes, {
      contentType: 'application/pdf',
      customMetadata
    });
    return {
      storagePath: snapshot.ref.fullPath || storagePath,
      pdfSizeBytes: snapshot.metadata?.size ?? bytes.byteLength
    };
  },
  async downloadPdfBlob(storagePath: string) {
    const storageInstance = getFirebaseStorage();
    if (!storageInstance) {
      throw new Error('Firebase Storage is not initialized.');
    }
    return await getBlob(ref(storageInstance, storagePath));
  }
};

/**
 * End-to-end authoritative Proforma Invoice generation and persistence pipeline:
 * 1. Validates with `validateProformaInvoicePreflight` (preliminary commercial checks ONLY; zero Tax/GST blockers).
 * 2. Prevents duplicates on retries via deterministic idempotency key.
 * 3. Preserves all previously issued versions immutably on explicit regeneration.
 * 4. Renders the real Proforma PDF displaying Final Booking Amount ONLY (zero separate TAX/Service Fee/margin lines).
 * 5. Uploads PDF binary to Firebase Storage and persists authoritative metadata to Firestore `invoices/{id}`.
 */
export async function generateAndPersistProformaInvoice(
  bookingId: string,
  user: User | null,
  options: {
    forceRegenerate?: boolean;
    idempotencyKey?: string;
    reason?: string;
    storageAdapter?: ProformaPdfStorageAdapter;
    skipStorageUpload?: boolean;
  } = {}
): Promise<ProformaInvoicePersistResult> {
  const preflight = validateProformaInvoicePreflight(bookingId, user);
  if (!preflight.valid || !preflight.booking) {
    return {
      success: false,
      error: preflight.error || {
        code: 'UNKNOWN_ERROR',
        title: 'Proforma Validation Failed',
        message: 'Unable to validate booking for Proforma Invoice generation.',
        missingRequirements: ['Valid booking data'],
        actionableInstruction: 'Verify booking details and try again.',
        bookingId
      }
    };
  }

  const db = AppDatabase.getInstance();
  const booking = preflight.booking;
  const authoritative = resolveAuthoritativeProformaAmount(booking);
  const existingInvoices = db.getBookingInvoices(booking.id);

  // Deduplication check for retries using explicit or snapshot-scoped idempotency key
  const requestIdempotencyKey =
    options.idempotencyKey ||
    (!options.forceRegenerate
      ? buildDocumentIdempotencyKey(
          'PROFORMA_INVOICE',
          booking.id,
          `${authoritative.sourcePricingSnapshotId || 'v1'}:${authoritative.finalBookingAmount}:${authoritative.currency}`
        )
      : undefined);

  if (requestIdempotencyKey) {
    const matchingExisting = existingInvoices.find(
      inv => inv.idempotencyKey === requestIdempotencyKey && inv.status !== 'VOIDED'
    );
    if (matchingExisting) {
      return {
        success: true,
        invoice: matchingExisting,
        storagePersisted: Boolean(matchingExisting.storagePath),
        firestorePersisted: true
      };
    }
  }

  // Generate invoice record in db (append-only; preserves prior versions immutably)
  const genRes = db.generateProformaInvoice(booking.id, user, Boolean(options.forceRegenerate), {
    idempotencyKey: requestIdempotencyKey,
    reason: options.reason
  });

  if (!genRes.success || !genRes.invoice) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        title: 'Proforma Invoice Generation Failed',
        message: genRes.error || 'Could not create Proforma Invoice record.',
        missingRequirements: ['Valid booking financial state'],
        actionableInstruction: 'Review booking pricing and retry.',
        bookingId: booking.id
      }
    };
  }

  const companyProfile = db.getCentralCompanyProfile();
  let invoice: BookingInvoice = { ...genRes.invoice };
  let pdfBytes: Uint8Array | undefined;
  let storagePersisted = false;

  try {
    const pdfResult = generateProformaInvoicePDF(invoice, booking, companyProfile);
    const arrayBuffer = pdfResult.pdf.output('arraybuffer');
    pdfBytes = new Uint8Array(arrayBuffer);

    const pdfFileName = pdfResult.filename;
    const storagePath = buildProformaInvoiceStoragePath({
      bookingId: booking.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      version: invoice.invoiceVersion || 1
    });

    if (!options.skipStorageUpload) {
      const adapter = options.storageAdapter || defaultProformaPdfStorageAdapter;
      try {
        const uploaded = await adapter.uploadPdf({
          storagePath,
          bytes: pdfBytes,
          customMetadata: {
            bookingId: booking.id,
            bookingReference: booking.bookingReference,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            documentVersion: String(invoice.invoiceVersion || 1),
            sourcePricingSnapshotId: invoice.sourcePricingSnapshotId || '',
            generatedByUid: auth.currentUser?.uid || user?.id || 'system'
          }
        });
        invoice = {
          ...invoice,
          storagePath: uploaded.storagePath,
          pdfFileName,
          pdfSizeBytes: uploaded.pdfSizeBytes,
          updatedAt: new Date().toISOString()
        };
        storagePersisted = true;
      } catch (storageErr) {
        // Non-fatal in offline/node environments; still record deterministic pdfFileName & metadata
        console.warn('[ProformaInvoiceService] Storage PDF upload note:', (storageErr as any)?.message || storageErr);
        invoice = {
          ...invoice,
          pdfFileName,
          pdfSizeBytes: pdfBytes.byteLength,
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      invoice = {
        ...invoice,
        pdfFileName,
        pdfSizeBytes: pdfBytes.byteLength,
        updatedAt: new Date().toISOString()
      };
    }
  } catch (pdfErr: any) {
    return {
      success: false,
      error: {
        code: 'PDF_GENERATION_FAILED',
        title: 'Proforma PDF Rendering Failed',
        message: pdfErr?.message || 'Failed to render Proforma Invoice PDF.',
        missingRequirements: ['Valid Proforma Invoice data'],
        actionableInstruction: 'Check booking details and retry Proforma Invoice generation.',
        bookingId: booking.id
      }
    };
  }

  // Persist authoritative metadata to local unified cache + Firestore `invoices/{id}`
  const firestorePersisted = await db.persistProformaInvoiceRecordAsync(invoice, booking, user);

  return {
    success: true,
    invoice,
    storagePersisted,
    firestorePersisted,
    pdfBytes
  };
}

/**
 * Downloads the Proforma Invoice PDF:
 * Uses the persisted Firebase Storage file if available (authenticated SDK `getBlob`),
 * seamlessly falling back to deterministic snapshot-locked PDF generation for legacy records.
 */
export async function downloadProformaInvoiceDocument(
  invoice: BookingInvoice,
  booking: Booking | null | undefined,
  companyProfile?: CentralCompanyProfile | null,
  storageAdapter?: ProformaPdfStorageAdapter
): Promise<{ success: boolean; source: 'STORAGE' | 'GENERATED'; fileName: string; error?: string }> {
  const fileName =
    invoice.pdfFileName ||
    `Proforma_Invoice_${invoice.invoiceNumber || invoice.id}_v${invoice.invoiceVersion || 1}.pdf`;

  if (invoice.storagePath && (storageAdapter || getFirebaseStorage())) {
    try {
      const adapter = storageAdapter || defaultProformaPdfStorageAdapter;
      const blob = await adapter.downloadPdfBlob(invoice.storagePath);
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blobUrl = URL.createObjectURL(blob);
        try {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } finally {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        }
      }
      return { success: true, source: 'STORAGE', fileName };
    } catch {
      // Fall through to deterministic snapshot-locked regeneration so download never breaks
    }
  }

  const profile = companyProfile || AppDatabase.getInstance().getCentralCompanyProfile();
  const pdfRes = generateProformaInvoicePDF(invoice, booking, profile);
  if (typeof window !== 'undefined') {
    pdfRes.download();
  }
  return { success: true, source: 'GENERATED', fileName: pdfRes.filename };
}
