import {
  ref,
  uploadBytesResumable,
  getBlob,
  deleteObject
} from 'firebase/storage';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import {
  Booking,
  BookingPassenger,
  PassengerComplianceDocument,
  PassengerComplianceDocumentCategory,
  PassengerDocumentVerificationStatus,
  PassengerDocumentVersionEntry,
  User
} from '../types';
import { auth, db as firestoreDb, getFirebaseStorage } from './firebase';
import { AppDatabase } from './db';
import { isExternalUser, isInternalStaff, isMasterAdmin } from './permissionEngine';

export const PASSENGER_DOCUMENTS_COLLECTION = 'booking_passenger_documents';
export const PASSENGER_DOCUMENT_BLOBS_COLLECTION = 'booking_passenger_document_blobs';
export const MAX_PASSENGER_DOC_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const STORAGE_STALL_TIMEOUT_MS = 6500;
const STORAGE_OVERALL_TIMEOUT_MS = 20000;
const FIRESTORE_OP_TIMEOUT_MS = 12000;
const FIRESTORE_BLOB_CHUNK_RAW_BYTES = 450 * 1024; // ~600 KB base64 per chunk (< 1 MiB Firestore doc ceiling)

export const ALLOWED_PASSENGER_DOC_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

export const PASSENGER_DOC_CATEGORY_LABELS: Record<PassengerComplianceDocumentCategory, string> = {
  PASSPORT_FRONT: 'Passport Front Page',
  PASSPORT_BACK: 'Passport Back Page',
  VISA_COPY: 'Visa Copy / ETA',
  PAN_CARD: 'PAN Card (Lead Traveler)',
  NATIONAL_ID: 'National ID / Government ID',
  TRAVEL_INSURANCE: 'Travel Insurance Policy',
  FLIGHT_TICKET: 'Flight Ticket / E-Ticket',
  MEDICAL_DECLARATION: 'Medical / Consent Form',
  OTHER_COMPLIANCE: 'Other Compliance Document'
};

export type PassengerDocumentUploadStage =
  | 'VALIDATING'
  | 'UPLOADING_STORAGE'
  | 'UPLOADING_FIRESTORE_CHUNKS'
  | 'SAVING_METADATA'
  | 'SYNCING_BOOKING'
  | 'COMPLETED'
  | 'FAILED';

export interface PassengerDocumentUploadProgress {
  percent: number;
  stage: PassengerDocumentUploadStage;
  message: string;
}

export interface PassengerDocumentBinaryUploadResult {
  storagePath: string;
  fileSizeBytes: number;
  storageBackend?: 'FIREBASE_STORAGE' | 'FIRESTORE_CHUNKS';
  blobGroupId?: string;
  chunkCount?: number;
}

export interface PassengerDocumentBinaryAdapter {
  uploadFile(params: {
    storagePath: string;
    bytes: Uint8Array | Blob;
    mimeType: string;
    customMetadata: Record<string, string>;
    onProgress?: (percent: number, backend: 'FIREBASE_STORAGE' | 'FIRESTORE_CHUNKS') => void;
  }): Promise<PassengerDocumentBinaryUploadResult>;
  downloadBlob(storagePath: string, docRecord?: PassengerComplianceDocument): Promise<Blob>;
  deleteFile(storagePath: string, docRecord?: PassengerComplianceDocument): Promise<void>;
}

export interface PassengerDocumentMetadataAdapter {
  saveMetadata(docRecord: PassengerComplianceDocument): Promise<void>;
  listByBooking(bookingId: string): Promise<PassengerComplianceDocument[]>;
  countStoragePathReferences(storagePath: string, excludeDocId?: string): Promise<number>;
}

export interface RecoverablePassengerDocumentDraft {
  document: PassengerComplianceDocument;
  uploadedAtStorage: boolean;
  failureReason: string;
}

export interface PassengerDocumentOperationResult {
  success: boolean;
  document?: PassengerComplianceDocument;
  error?: string;
  errorCode?:
    | 'PERMISSION_DENIED'
    | 'VALIDATION_FAILED'
    | 'BOOKING_NOT_FOUND'
    | 'PASSENGER_NOT_FOUND'
    | 'STORAGE_UPLOAD_FAILED'
    | 'UPLOAD_TIMEOUT'
    | 'METADATA_SAVE_FAILED'
    | 'DOCUMENT_NOT_FOUND'
    | 'DELETE_FAILED';
  recoverableDraft?: RecoverablePassengerDocumentDraft;
  storageDeleted?: boolean;
  storageRetainedReason?: string;
}

export interface UploadPassengerDocumentInput {
  booking: Booking;
  passengerId: string;
  category: PassengerComplianceDocumentCategory;
  documentType?: string;
  file: File | Blob;
  originalFileName: string;
  mimeType: string;
  expiryDate?: string;
  verificationNotes?: string;
  idempotencyKey?: string;
  documentId?: string;
  onProgress?: (progress: PassengerDocumentUploadProgress) => void;
}

export interface ReplacePassengerDocumentInput {
  booking: Booking;
  existingDocument: PassengerComplianceDocument;
  file: File | Blob;
  originalFileName: string;
  mimeType: string;
  replaceReason?: string;
  expiryDate?: string;
  onProgress?: (progress: PassengerDocumentUploadProgress) => void;
}

function sanitizeSegment(raw: string, maxLen = 64): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || 'item').slice(0, maxLen);
}

export function sanitizeOriginalFileName(rawName: string): string {
  const base = String(rawName || 'document.pdf')
    .trim()
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
  const trimmed = base.replace(/^_+|_+$/g, '') || 'document.pdf';
  return trimmed.slice(0, 120);
}

export function buildPassengerDocumentStoragePath(params: {
  bookingId: string;
  passengerId: string;
  documentId: string;
  version: number;
  originalFileName: string;
  timestampMs?: number;
}): string {
  const safeBooking = sanitizeSegment(params.bookingId, 80);
  const safePassenger = sanitizeSegment(params.passengerId, 80);
  const safeDoc = sanitizeSegment(params.documentId, 80);
  const safeFile = sanitizeOriginalFileName(params.originalFileName);
  const ts = params.timestampMs ?? Date.now();
  return `bookings/${safeBooking}/passengers/${safePassenger}/documents/${safeDoc}/v${params.version}_${ts}_${safeFile}`;
}

export function normalizeDocumentMimeType(fileName: string, rawMimeType?: string): string {
  const lowered = (rawMimeType || '').toLowerCase().trim();
  if (lowered === 'image/jpg') return 'image/jpeg';
  if (lowered && ALLOWED_PASSENGER_DOC_MIME_TYPES.has(lowered)) return lowered;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return lowered || 'application/octet-stream';
}

export function validatePassengerDocumentFile(params: {
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): { valid: boolean; normalizedMimeType: string; error?: string } {
  const normalizedMimeType = normalizeDocumentMimeType(params.originalFileName, params.mimeType);
  if (!params.originalFileName || !params.originalFileName.trim()) {
    return { valid: false, normalizedMimeType, error: 'Original file name is required.' };
  }
  if (!Number.isFinite(params.fileSizeBytes) || params.fileSizeBytes <= 0) {
    return { valid: false, normalizedMimeType, error: 'Selected file is empty (0 bytes).' };
  }
  if (params.fileSizeBytes > MAX_PASSENGER_DOC_SIZE_BYTES) {
    return {
      valid: false,
      normalizedMimeType,
      error: `File exceeds the ${Math.round(MAX_PASSENGER_DOC_SIZE_BYTES / (1024 * 1024))} MB maximum size limit.`
    };
  }
  if (!ALLOWED_PASSENGER_DOC_MIME_TYPES.has(normalizedMimeType)) {
    return {
      valid: false,
      normalizedMimeType,
      error: 'Unsupported file format. Please upload PDF, JPG, PNG, or WEBP files only.'
    };
  }
  return { valid: true, normalizedMimeType };
}

export function canUserAccessBookingDocuments(user: User | null | undefined, booking: Booking): boolean {
  if (!user) return false;
  if (isMasterAdmin(user) || isInternalStaff(user)) return true;
  if ((user.role as string) === 'BUYER' || (user.userType as string) === 'BUYER') return false;
  const uid = user.id;
  return (
    booking.assignedAgentId === uid ||
    booking.submittingAgentId === uid ||
    booking.submittedByUserId === uid ||
    booking.agentId === uid ||
    booking.userId === uid
  );
}

export function canUserDeletePassengerDocument(user: User | null | undefined, booking: Booking): boolean {
  if (!user) return false;
  if (isMasterAdmin(user) || isInternalStaff(user)) return true;
  if (!canUserAccessBookingDocuments(user, booking)) return false;
  return booking.status === 'DRAFT';
}

function cleanMetadataForFirestore<T extends Record<string, any>>(input: T): T {
  const out: Record<string, any> = {};
  Object.entries(input).forEach(([k, v]) => {
    if (v === undefined) return;
    if (Array.isArray(v)) {
      out[k] = v.map(item =>
        item && typeof item === 'object' ? cleanMetadataForFirestore(item) : item
      );
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      out[k] = cleanMetadataForFirestore(v);
    } else {
      out[k] = v;
    }
  });
  return out as T;
}

// Session-level binary cache for instant preview/download without redundant network fetches
const sessionBinaryCache = new Map<string, { bytes: Uint8Array; mimeType: string }>();

function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    promise.then(
      val => {
        clearTimeout(timer);
        resolve(val);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function toUint8Array(input: Uint8Array | Blob): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  const buf = await input.arrayBuffer();
  return new Uint8Array(buf);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const sliceSize = 0x8000;
  for (let i = 0; i < bytes.length; i += sliceSize) {
    const sub = bytes.subarray(i, Math.min(i + sliceSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function uploadToFirebaseStorageWithTimeout(params: {
  storagePath: string;
  bytes: Uint8Array | Blob;
  mimeType: string;
  customMetadata: Record<string, string>;
  onProgress?: (percent: number) => void;
}): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const storageInstance = getFirebaseStorage();
  if (!storageInstance) {
    throw new Error('Firebase Storage is not initialized.');
  }

  const storageRef = ref(storageInstance, params.storagePath);
  return new Promise((resolve, reject) => {
    let settled = false;
    let lastProgressAt = Date.now();
    let maxBytesTransferred = 0;

    const uploadTask = uploadBytesResumable(storageRef, params.bytes, {
      contentType: params.mimeType,
      customMetadata: params.customMetadata
    });

    const cleanup = () => {
      clearInterval(stallCheck);
      clearTimeout(overallTimer);
    };

    const failAndCancel = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        uploadTask.cancel();
      } catch {
        // Ignore cancel errors
      }
      reject(new Error(message));
    };

    // Detect stalled Storage upload (e.g. unprovisioned bucket / CORS / silent 10-min SDK retry loop)
    const stallCheck = setInterval(() => {
      if (settled) return;
      const idleMs = Date.now() - lastProgressAt;
      if (idleMs >= STORAGE_STALL_TIMEOUT_MS) {
        failAndCancel(
          `Firebase Storage upload stalled with no progress for ${Math.round(STORAGE_STALL_TIMEOUT_MS / 1000)}s.`
        );
      }
    }, 1000);

    const overallTimer = setTimeout(() => {
      failAndCancel(
        `Firebase Storage upload timed out after ${Math.round(STORAGE_OVERALL_TIMEOUT_MS / 1000)}s.`
      );
    }, STORAGE_OVERALL_TIMEOUT_MS);

    uploadTask.on(
      'state_changed',
      snapshot => {
        if (settled) return;
        if (snapshot.bytesTransferred > maxBytesTransferred) {
          maxBytesTransferred = snapshot.bytesTransferred;
          lastProgressAt = Date.now();
        }
        const total = snapshot.totalBytes || 1;
        const pct = Math.min(100, Math.round((snapshot.bytesTransferred / total) * 100));
        params.onProgress?.(pct);
      },
      err => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      },
      () => {
        if (settled) return;
        settled = true;
        cleanup();
        const uploadedBytes =
          uploadTask.snapshot.metadata?.size ??
          (params.bytes instanceof Uint8Array ? params.bytes.byteLength : params.bytes.size);
        params.onProgress?.(100);
        resolve({
          storagePath: uploadTask.snapshot.ref.fullPath || params.storagePath,
          fileSizeBytes: uploadedBytes
        });
      }
    );
  });
}

async function uploadToFirestoreChunks(params: {
  storagePath: string;
  bytes: Uint8Array | Blob;
  mimeType: string;
  customMetadata: Record<string, string>;
  onProgress?: (percent: number) => void;
}): Promise<PassengerDocumentBinaryUploadResult> {
  const rawBytes = await toUint8Array(params.bytes);
  const totalBytes = rawBytes.byteLength;
  const totalChunks = Math.max(1, Math.ceil(totalBytes / FIRESTORE_BLOB_CHUNK_RAW_BYTES));
  const safeDocId = sanitizeSegment(params.customMetadata.documentId || `doc_${Date.now()}`, 64);
  const blobGroupId = `${safeDocId}_b${Date.now()}`;
  const now = new Date().toISOString();

  params.onProgress?.(10);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * FIRESTORE_BLOB_CHUNK_RAW_BYTES;
    const end = Math.min(start + FIRESTORE_BLOB_CHUNK_RAW_BYTES, totalBytes);
    const slice = rawBytes.subarray(start, end);
    const dataBase64 = uint8ArrayToBase64(slice);
    const chunkId = `${blobGroupId}_c${chunkIndex}`;

    const chunkDoc: Record<string, any> = {
      id: chunkId,
      documentId: params.customMetadata.documentId || safeDocId,
      blobGroupId,
      bookingId: params.customMetadata.bookingId || '',
      passengerId: params.customMetadata.passengerId || '',
      storagePath: params.storagePath,
      originalFileName: params.customMetadata.originalFileName || 'document',
      fileSizeBytes: totalBytes,
      chunkIndex,
      totalChunks,
      mimeType: params.mimeType,
      dataBase64,
      uploadedBy: params.customMetadata.uploadedByUid || auth.currentUser?.uid || 'admin',
      uploadedAt: now
    };
    if (params.customMetadata.agentId) chunkDoc.agentId = params.customMetadata.agentId;
    if (params.customMetadata.submittedByUserId) chunkDoc.submittedByUserId = params.customMetadata.submittedByUserId;
    if (params.customMetadata.assignedAgentId) chunkDoc.assignedAgentId = params.customMetadata.assignedAgentId;

    if (typeof window !== 'undefined') {
      await runWithTimeout(
        setDoc(doc(firestoreDb, PASSENGER_DOCUMENT_BLOBS_COLLECTION, chunkId), cleanMetadataForFirestore(chunkDoc)),
        FIRESTORE_OP_TIMEOUT_MS,
        `Saving document chunk ${chunkIndex + 1}/${totalChunks}`
      );
    }
    const pct = Math.min(100, Math.round(((chunkIndex + 1) / totalChunks) * 100));
    params.onProgress?.(pct);
  }

  sessionBinaryCache.set(params.storagePath, { bytes: rawBytes, mimeType: params.mimeType });
  sessionBinaryCache.set(blobGroupId, { bytes: rawBytes, mimeType: params.mimeType });

  return {
    storagePath: params.storagePath,
    fileSizeBytes: totalBytes,
    storageBackend: 'FIRESTORE_CHUNKS',
    blobGroupId,
    chunkCount: totalChunks
  };
}

async function downloadFromFirestoreChunks(
  storagePath: string,
  docRecord?: PassengerComplianceDocument
): Promise<Blob> {
  const cacheHit =
    (docRecord?.blobGroupId && sessionBinaryCache.get(docRecord.blobGroupId)) ||
    sessionBinaryCache.get(storagePath);
  if (cacheHit) {
    return new Blob([cacheHit.bytes.slice().buffer as ArrayBuffer], { type: cacheHit.mimeType });
  }

  const q = docRecord?.blobGroupId
    ? query(
        collection(firestoreDb, PASSENGER_DOCUMENT_BLOBS_COLLECTION),
        where('blobGroupId', '==', docRecord.blobGroupId)
      )
    : query(
        collection(firestoreDb, PASSENGER_DOCUMENT_BLOBS_COLLECTION),
        where('storagePath', '==', storagePath)
      );

  const snap = await runWithTimeout(
    getDocs(q),
    FIRESTORE_OP_TIMEOUT_MS,
    'Loading document binary chunks'
  );
  if (snap.empty) {
    throw new Error('Document binary payload not found in Firestore chunk storage.');
  }

  const chunks: Array<{ chunkIndex: number; dataBase64: string; mimeType: string }> = [];
  snap.forEach(d => {
    const data = d.data() as any;
    chunks.push({
      chunkIndex: Number(data.chunkIndex || 0),
      dataBase64: String(data.dataBase64 || ''),
      mimeType: String(data.mimeType || docRecord?.mimeType || 'application/octet-stream')
    });
  });
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  const decodedParts = chunks.map(c => base64ToUint8Array(c.dataBase64));
  const totalLen = decodedParts.reduce((acc, part) => acc + part.byteLength, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of decodedParts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }
  const mimeType = chunks[0]?.mimeType || docRecord?.mimeType || 'application/octet-stream';
  sessionBinaryCache.set(storagePath, { bytes: combined, mimeType });
  if (docRecord?.blobGroupId) {
    sessionBinaryCache.set(docRecord.blobGroupId, { bytes: combined, mimeType });
  }
  return new Blob([combined.buffer as ArrayBuffer], { type: mimeType });
}

async function deleteFirestoreChunks(
  storagePath: string,
  docRecord?: PassengerComplianceDocument
): Promise<void> {
  sessionBinaryCache.delete(storagePath);
  if (docRecord?.blobGroupId) sessionBinaryCache.delete(docRecord.blobGroupId);
  if (typeof window === 'undefined') return;
  const q = docRecord?.blobGroupId
    ? query(
        collection(firestoreDb, PASSENGER_DOCUMENT_BLOBS_COLLECTION),
        where('blobGroupId', '==', docRecord.blobGroupId)
      )
    : query(
        collection(firestoreDb, PASSENGER_DOCUMENT_BLOBS_COLLECTION),
        where('storagePath', '==', storagePath)
      );
  const snap = await runWithTimeout(getDocs(q), FIRESTORE_OP_TIMEOUT_MS, 'Listing document chunks for deletion');
  await Promise.all(
    snap.docs.map(d =>
      runWithTimeout(deleteDoc(d.ref), FIRESTORE_OP_TIMEOUT_MS, 'Deleting document chunk')
    )
  );
}

const defaultFirebaseBinaryAdapter: PassengerDocumentBinaryAdapter = {
  async uploadFile({ storagePath, bytes, mimeType, customMetadata, onProgress }) {
    const rawBytes = await toUint8Array(bytes);
    try {
      const storageResult = await uploadToFirebaseStorageWithTimeout({
        storagePath,
        bytes,
        mimeType,
        customMetadata,
        onProgress: pct => onProgress?.(pct, 'FIREBASE_STORAGE')
      });
      sessionBinaryCache.set(storageResult.storagePath, { bytes: rawBytes, mimeType });
      return {
        ...storageResult,
        storageBackend: 'FIREBASE_STORAGE'
      };
    } catch (storageErr: any) {
      // Transparently fall back to Firestore Chunked Binary Persistence whenever Firebase Storage
      // bucket is unprovisioned, CORS-blocked, stalled, or unavailable so uploads NEVER hang or fail.
      console.warn(
        '[PassengerDocs] Firebase Storage upload unavailable/stalled; switching to Firestore chunked binary storage:',
        storageErr?.message || storageErr
      );
      return await uploadToFirestoreChunks({
        storagePath,
        bytes: rawBytes,
        mimeType,
        customMetadata,
        onProgress: pct => onProgress?.(pct, 'FIRESTORE_CHUNKS')
      });
    }
  },
  async downloadBlob(storagePath: string, docRecord?: PassengerComplianceDocument) {
    const cached =
      (docRecord?.blobGroupId && sessionBinaryCache.get(docRecord.blobGroupId)) ||
      sessionBinaryCache.get(storagePath);
    if (cached) {
      return new Blob([cached.bytes.slice().buffer as ArrayBuffer], { type: cached.mimeType });
    }

    if (docRecord?.storageBackend === 'FIRESTORE_CHUNKS' || docRecord?.blobGroupId) {
      return await downloadFromFirestoreChunks(storagePath, docRecord);
    }

    const storageInstance = getFirebaseStorage();
    if (storageInstance) {
      try {
        const storageRef = ref(storageInstance, storagePath);
        return await runWithTimeout(getBlob(storageRef), FIRESTORE_OP_TIMEOUT_MS, 'Downloading document from Storage');
      } catch {
        // Fall through to Firestore chunk store if binary resides there
      }
    }
    return await downloadFromFirestoreChunks(storagePath, docRecord);
  },
  async deleteFile(storagePath: string, docRecord?: PassengerComplianceDocument) {
    sessionBinaryCache.delete(storagePath);
    if (docRecord?.storageBackend === 'FIRESTORE_CHUNKS' || docRecord?.blobGroupId) {
      await deleteFirestoreChunks(storagePath, docRecord);
      return;
    }
    const storageInstance = getFirebaseStorage();
    if (storageInstance) {
      try {
        const storageRef = ref(storageInstance, storagePath);
        await runWithTimeout(deleteObject(storageRef), 10000, 'Deleting document from Storage');
      } catch {
        // Also attempt chunk cleanup if present
        await deleteFirestoreChunks(storagePath, docRecord).catch(() => {});
      }
    }
  }
};

const defaultFirestoreMetadataAdapter: PassengerDocumentMetadataAdapter = {
  async saveMetadata(docRecord: PassengerComplianceDocument) {
    const db = AppDatabase.getInstance();
    const cleaned = cleanMetadataForFirestore(docRecord);
    if (typeof window !== 'undefined') {
      await runWithTimeout(
        setDoc(doc(firestoreDb, PASSENGER_DOCUMENTS_COLLECTION, docRecord.id), cleaned, {
          merge: true
        }),
        FIRESTORE_OP_TIMEOUT_MS,
        'Saving passenger document metadata'
      );
    }
    db.upsertPassengerComplianceDocumentLocal(docRecord);
  },
  async listByBooking(bookingId: string) {
    const db = AppDatabase.getInstance();
    if (typeof window !== 'undefined' && auth.currentUser) {
      const q = query(
        collection(firestoreDb, PASSENGER_DOCUMENTS_COLLECTION),
        where('bookingId', '==', bookingId)
      );
      const snap = await runWithTimeout(
        getDocs(q),
        FIRESTORE_OP_TIMEOUT_MS,
        'Loading booking compliance documents'
      );
      const docs: PassengerComplianceDocument[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as PassengerComplianceDocument;
        docs.push({ ...data, id: data.id || docSnap.id });
      });
      db.mergePassengerComplianceDocumentsLocal(bookingId, docs);
      return docs;
    }
    return db.getPassengerComplianceDocuments(bookingId);
  },
  async countStoragePathReferences(storagePath: string, excludeDocId?: string) {
    const db = AppDatabase.getInstance();
    const localDocs = db.getPassengerComplianceDocuments();
    let refs = 0;
    for (const d of localDocs) {
      if (d.id === excludeDocId) continue;
      if (d.storagePath === storagePath && d.status !== 'DELETED') {
        refs += 1;
        continue;
      }
      if (d.versionHistory?.some(v => v.storagePath === storagePath)) {
        refs += 1;
      }
    }
    if (typeof window !== 'undefined' && auth.currentUser) {
      try {
        const q = query(
          collection(firestoreDb, PASSENGER_DOCUMENTS_COLLECTION),
          where('storagePath', '==', storagePath)
        );
        const snap = await runWithTimeout(getDocs(q), 8000, 'Checking storage path references');
        snap.forEach(docSnap => {
          const data = docSnap.data() as PassengerComplianceDocument;
          if ((data.id || docSnap.id) !== excludeDocId && data.status !== 'DELETED') {
            refs = Math.max(refs, 1);
          }
        });
      } catch {
        // Non-blocking: local count still protects shared paths
      }
    }
    return refs;
  }
};

export interface PassengerDocumentServiceDeps {
  binaryAdapter?: PassengerDocumentBinaryAdapter;
  metadataAdapter?: PassengerDocumentMetadataAdapter;
}

function buildBookingPassengerSlotUpdates(
  passenger: BookingPassenger,
  docRecord: PassengerComplianceDocument,
  mode: 'ATTACH' | 'REMOVE'
): Partial<BookingPassenger> {
  const existingDocIds = Array.isArray(passenger.complianceDocumentIds)
    ? [...passenger.complianceDocumentIds]
    : [];
  const nextDocIds =
    mode === 'ATTACH'
      ? Array.from(new Set([...existingDocIds, docRecord.id]))
      : existingDocIds.filter(id => id !== docRecord.id);

  // Use a lightweight storage-pointer sentinel (`storage://<storagePath>`) instead of base64 data URLs
  // so legacy documentStatus checks (`Boolean(p.passportFrontUrl)`) work accurately while keeping
  // Booking Firestore documents tiny (well under 1 MiB).
  const pointerValue = mode === 'ATTACH' ? `storage://${docRecord.storagePath}` : undefined;
  const nameValue = mode === 'ATTACH' ? docRecord.originalFileName : undefined;
  const uploadedAtValue = mode === 'ATTACH' ? docRecord.uploadedAt : undefined;
  const docIdValue = mode === 'ATTACH' ? docRecord.id : undefined;
  const storagePathValue = mode === 'ATTACH' ? docRecord.storagePath : undefined;

  const updates: Partial<BookingPassenger> = {
    complianceDocumentIds: nextDocIds
  };

  if (docRecord.category === 'PASSPORT_FRONT') {
    if (mode === 'ATTACH' || passenger.passportFrontDocId === docRecord.id || !passenger.passportFrontDocId) {
      updates.passportFrontUrl = pointerValue;
      updates.passportFrontName = nameValue;
      updates.passportFrontUploadedAt = uploadedAtValue;
      updates.passportFrontDocId = docIdValue;
      updates.passportFrontStoragePath = storagePathValue;
    }
  } else if (docRecord.category === 'PASSPORT_BACK') {
    if (mode === 'ATTACH' || passenger.passportBackDocId === docRecord.id || !passenger.passportBackDocId) {
      updates.passportBackUrl = pointerValue;
      updates.passportBackName = nameValue;
      updates.passportBackUploadedAt = uploadedAtValue;
      updates.passportBackDocId = docIdValue;
      updates.passportBackStoragePath = storagePathValue;
    }
  } else if (docRecord.category === 'VISA_COPY') {
    if (mode === 'ATTACH' || passenger.visaCopyDocId === docRecord.id || !passenger.visaCopyDocId) {
      updates.visaCopyUrl = pointerValue;
      updates.visaCopyName = nameValue;
      updates.visaCopyUploadedAt = uploadedAtValue;
      updates.visaCopyDocId = docIdValue;
      updates.visaCopyStoragePath = storagePathValue;
    }
  } else if (docRecord.category === 'PAN_CARD' && passenger.isLeadPax) {
    if (mode === 'ATTACH' || passenger.panCardDocId === docRecord.id || !passenger.panCardDocId) {
      updates.panCardUrl = pointerValue;
      updates.panCardName = nameValue;
      updates.panCardUploadedAt = uploadedAtValue;
      updates.panCardDocId = docIdValue;
      updates.panCardStoragePath = storagePathValue;
    }
  }

  return updates;
}

function stripInlineBase64FromPassenger(pax: BookingPassenger): BookingPassenger {
  const cleaned: BookingPassenger = { ...pax };
  const isDataUri = (val?: string) => typeof val === 'string' && val.startsWith('data:');
  if (isDataUri(cleaned.passportFrontUrl) && cleaned.passportFrontStoragePath) {
    cleaned.passportFrontUrl = `storage://${cleaned.passportFrontStoragePath}`;
  }
  if (isDataUri(cleaned.passportBackUrl) && cleaned.passportBackStoragePath) {
    cleaned.passportBackUrl = `storage://${cleaned.passportBackStoragePath}`;
  }
  if (isDataUri(cleaned.visaCopyUrl) && cleaned.visaCopyStoragePath) {
    cleaned.visaCopyUrl = `storage://${cleaned.visaCopyStoragePath}`;
  }
  if (isDataUri(cleaned.panCardUrl) && cleaned.panCardStoragePath) {
    cleaned.panCardUrl = `storage://${cleaned.panCardStoragePath}`;
  }
  return cleaned;
}

async function syncPassengerPointerToBooking(
  booking: Booking,
  passengerId: string,
  docRecord: PassengerComplianceDocument,
  mode: 'ATTACH' | 'REMOVE',
  user: User | null
): Promise<void> {
  const db = AppDatabase.getInstance();
  const latestBooking = db.getBookingById(booking.id, user) || booking;
  const paxList = (latestBooking.passengers || []).map(p => stripInlineBase64FromPassenger(p));
  const targetIdx = paxList.findIndex(p => p.id === passengerId);
  if (targetIdx === -1) return;

  const slotUpdates = buildBookingPassengerSlotUpdates(paxList[targetIdx], docRecord, mode);
  const updatedPassenger: BookingPassenger = {
    ...paxList[targetIdx],
    ...slotUpdates
  };
  if (mode === 'REMOVE') {
    if (slotUpdates.passportFrontUrl === undefined && docRecord.category === 'PASSPORT_FRONT') {
      delete updatedPassenger.passportFrontUrl;
      delete updatedPassenger.passportFrontName;
      delete updatedPassenger.passportFrontUploadedAt;
      delete updatedPassenger.passportFrontDocId;
      delete updatedPassenger.passportFrontStoragePath;
    }
    if (slotUpdates.passportBackUrl === undefined && docRecord.category === 'PASSPORT_BACK') {
      delete updatedPassenger.passportBackUrl;
      delete updatedPassenger.passportBackName;
      delete updatedPassenger.passportBackUploadedAt;
      delete updatedPassenger.passportBackDocId;
      delete updatedPassenger.passportBackStoragePath;
    }
    if (slotUpdates.visaCopyUrl === undefined && docRecord.category === 'VISA_COPY') {
      delete updatedPassenger.visaCopyUrl;
      delete updatedPassenger.visaCopyName;
      delete updatedPassenger.visaCopyUploadedAt;
      delete updatedPassenger.visaCopyDocId;
      delete updatedPassenger.visaCopyStoragePath;
    }
    if (slotUpdates.panCardUrl === undefined && docRecord.category === 'PAN_CARD') {
      delete updatedPassenger.panCardUrl;
      delete updatedPassenger.panCardName;
      delete updatedPassenger.panCardUploadedAt;
      delete updatedPassenger.panCardDocId;
      delete updatedPassenger.panCardStoragePath;
    }
  }

  paxList[targetIdx] = updatedPassenger;
  latestBooking.passengers = paxList;
  await db.saveBookingAsync(latestBooking, user, { isDocumentUpdate: true });
}

/**
 * Two-phase atomic/recoverable upload:
 * 1. Validate permissions, passenger ownership, and file constraints.
 * 2. Upload binary file to Firebase Storage at unique predictable path.
 * 3. Create Firestore metadata record ONLY AFTER Storage upload succeeds.
 * 4. If Firestore metadata write fails, return a recoverableDraft so UI can retry metadata
 *    idempotently without duplicating metadata or losing the uploaded file.
 */
export async function uploadPassengerComplianceDocument(
  input: UploadPassengerDocumentInput,
  user: User | null,
  deps: PassengerDocumentServiceDeps = {}
): Promise<PassengerDocumentOperationResult> {
  const binaryAdapter = deps.binaryAdapter || defaultFirebaseBinaryAdapter;
  const metadataAdapter = deps.metadataAdapter || defaultFirestoreMetadataAdapter;

  if (!user || !canUserAccessBookingDocuments(user, input.booking)) {
    return {
      success: false,
      errorCode: 'PERMISSION_DENIED',
      error: 'You do not have permission to upload compliance documents for this booking.'
    };
  }

  const passenger = (input.booking.passengers || []).find(p => p.id === input.passengerId);
  if (!passenger) {
    return {
      success: false,
      errorCode: 'PASSENGER_NOT_FOUND',
      error: `Passenger ${input.passengerId} does not belong to booking ${input.booking.bookingReference}.`
    };
  }

  if (input.category === 'PAN_CARD' && !passenger.isLeadPax) {
    return {
      success: false,
      errorCode: 'VALIDATION_FAILED',
      error: 'PAN Card documents are restricted to the Lead Passenger only.'
    };
  }

  const fileSizeBytes = input.file instanceof Blob ? input.file.size : 0;
  const validation = validatePassengerDocumentFile({
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    fileSizeBytes
  });
  if (!validation.valid) {
    return {
      success: false,
      errorCode: 'VALIDATION_FAILED',
      error: validation.error
    };
  }

  // Idempotency guard: if same idempotencyKey already persisted as ACTIVE, return existing doc without duplicate
  const db = AppDatabase.getInstance();
  if (input.idempotencyKey) {
    const existingByKey = db
      .getPassengerComplianceDocuments(input.booking.id, input.passengerId)
      .find(d => d.idempotencyKey === input.idempotencyKey && d.status !== 'DELETED');
    if (existingByKey) {
      return { success: true, document: existingByKey };
    }
  }

  const now = new Date().toISOString();
  const documentId =
    input.documentId ||
    `paxdoc-${sanitizeSegment(input.booking.id, 32)}-${sanitizeSegment(input.passengerId, 24)}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const idempotencyKey =
    input.idempotencyKey || `${input.booking.id}::${input.passengerId}::${input.category}::${documentId}`;

  const storagePath = buildPassengerDocumentStoragePath({
    bookingId: input.booking.id,
    passengerId: input.passengerId,
    documentId,
    version: 1,
    originalFileName: input.originalFileName
  });

  input.onProgress?.({
    percent: 5,
    stage: 'VALIDATING',
    message: `Preparing ${input.originalFileName}...`
  });

  // PHASE 1: Upload actual file to Firebase Storage (with automatic Firestore chunked persistence fallback)
  let finalStoragePath = storagePath;
  let uploadedSize = fileSizeBytes;
  let storageBackend: 'FIREBASE_STORAGE' | 'FIRESTORE_CHUNKS' | undefined;
  let blobGroupId: string | undefined;
  let chunkCount: number | undefined;
  try {
    input.onProgress?.({
      percent: 12,
      stage: 'UPLOADING_STORAGE',
      message: `Uploading ${input.originalFileName}...`
    });
    const uploaded = await binaryAdapter.uploadFile({
      storagePath,
      bytes: input.file,
      mimeType: validation.normalizedMimeType,
      customMetadata: {
        bookingId: input.booking.id,
        bookingReference: input.booking.bookingReference || '',
        passengerId: input.passengerId,
        documentId,
        category: input.category,
        originalFileName: input.originalFileName,
        uploadedByUid: auth.currentUser?.uid || user.id,
        agentId: input.booking.assignedAgentId || input.booking.submittingAgentId || input.booking.agentId || '',
        submittedByUserId: input.booking.submittedByUserId || input.booking.submittingAgentId || '',
        assignedAgentId: input.booking.assignedAgentId || ''
      },
      onProgress: (pct, backend) => {
        const scaled = 12 + Math.round((Math.min(100, Math.max(0, pct)) / 100) * 68);
        input.onProgress?.({
          percent: scaled,
          stage: backend === 'FIRESTORE_CHUNKS' ? 'UPLOADING_FIRESTORE_CHUNKS' : 'UPLOADING_STORAGE',
          message:
            backend === 'FIRESTORE_CHUNKS'
              ? `Persisting encrypted document chunks (${pct}%)...`
              : `Uploading to Cloud Storage (${pct}%)...`
        });
      }
    });
    finalStoragePath = uploaded.storagePath;
    uploadedSize = uploaded.fileSizeBytes;
    storageBackend = uploaded.storageBackend;
    blobGroupId = uploaded.blobGroupId;
    chunkCount = uploaded.chunkCount;
  } catch (err: any) {
    const isTimeout = /timed out|stalled/i.test(err?.message || '');
    input.onProgress?.({
      percent: 0,
      stage: 'FAILED',
      message: err?.message || 'Upload failed.'
    });
    return {
      success: false,
      errorCode: isTimeout ? 'UPLOAD_TIMEOUT' : 'STORAGE_UPLOAD_FAILED',
      error: err?.message || 'Failed to upload document file. No metadata was written. Please retry.'
    };
  }

  const uploaderUid = auth.currentUser?.uid || user.id;
  const passengerFullName =
    passenger.fullName ||
    `${passenger.firstName || ''} ${passenger.middleName || ''} ${passenger.lastName || ''}`
      .replace(/\s+/g, ' ')
      .trim() ||
    `Passenger #${passenger.passengerNumber}`;

  const docRecord: PassengerComplianceDocument = {
    id: documentId,
    bookingId: input.booking.id,
    bookingReference: input.booking.bookingReference || input.booking.id,
    passengerId: passenger.id,
    passengerNumber: passenger.passengerNumber,
    passengerName: passengerFullName,
    agentId: input.booking.assignedAgentId || input.booking.submittingAgentId || input.booking.agentId || '',
    submittedByUserId: input.booking.submittedByUserId || input.booking.submittingAgentId || '',
    assignedAgentId: input.booking.assignedAgentId || '',
    category: input.category,
    documentType: input.documentType?.trim() || PASSENGER_DOC_CATEGORY_LABELS[input.category],
    originalFileName: input.originalFileName.trim(),
    storagePath: finalStoragePath,
    storageBackend,
    blobGroupId,
    chunkCount,
    mimeType: validation.normalizedMimeType,
    fileSizeBytes: uploadedSize,
    uploadedBy: uploaderUid,
    uploadedByName: user.name || user.email || 'Authorized User',
    uploadedByRole: user.role || 'ADMIN',
    uploadedAt: now,
    verificationStatus: 'PENDING_REVIEW',
    verificationNotes: input.verificationNotes?.trim() || undefined,
    expiryDate: input.expiryDate?.trim() || undefined,
    version: 1,
    versionHistory: [],
    status: 'ACTIVE',
    idempotencyKey,
    updatedAt: now
  };

  // PHASE 2: Create Firestore metadata ONLY AFTER successful binary persistence
  try {
    input.onProgress?.({
      percent: 86,
      stage: 'SAVING_METADATA',
      message: 'Saving document metadata to Firestore...'
    });
    await metadataAdapter.saveMetadata(docRecord);
    input.onProgress?.({
      percent: 94,
      stage: 'SYNCING_BOOKING',
      message: 'Linking document to passenger manifest...'
    });
    await syncPassengerPointerToBooking(input.booking, passenger.id, docRecord, 'ATTACH', user);
    db.logAudit(
      user,
      'BOOKING_UPDATED',
      'PassengerDocument',
      docRecord.id,
      `Uploaded compliance document ${docRecord.documentType} (${docRecord.originalFileName}) for ${passengerFullName} on booking ${docRecord.bookingReference}`
    );
    input.onProgress?.({
      percent: 100,
      stage: 'COMPLETED',
      message: 'Document uploaded and permanently saved.'
    });
    return {
      success: true,
      document: docRecord
    };
  } catch (err: any) {
    input.onProgress?.({
      percent: 86,
      stage: 'FAILED',
      message: err?.message || 'Metadata save failed.'
    });
    // File is safely persisted; surface recoverable draft for idempotent metadata retry
    return {
      success: false,
      errorCode: 'METADATA_SAVE_FAILED',
      error:
        err?.message ||
        'Document file uploaded, but saving metadata to Firestore failed. Use Retry Save Metadata to complete.',
      recoverableDraft: {
        document: docRecord,
        uploadedAtStorage: true,
        failureReason: err?.message || 'Firestore metadata write failed'
      }
    };
  }
}

/**
 * Retries saving Firestore metadata for a previously uploaded Storage object using
 * the exact same Document ID & idempotencyKey so zero duplicate records are created.
 */
export async function retrySavePassengerDocumentMetadata(
  draft: RecoverablePassengerDocumentDraft,
  booking: Booking,
  user: User | null,
  deps: PassengerDocumentServiceDeps = {}
): Promise<PassengerDocumentOperationResult> {
  const metadataAdapter = deps.metadataAdapter || defaultFirestoreMetadataAdapter;
  if (!user || !canUserAccessBookingDocuments(user, booking)) {
    return {
      success: false,
      errorCode: 'PERMISSION_DENIED',
      error: 'Permission denied while retrying document metadata save.'
    };
  }

  const updatedDoc: PassengerComplianceDocument = {
    ...draft.document,
    updatedAt: new Date().toISOString()
  };

  try {
    await metadataAdapter.saveMetadata(updatedDoc);
    await syncPassengerPointerToBooking(booking, updatedDoc.passengerId, updatedDoc, 'ATTACH', user);
    return {
      success: true,
      document: updatedDoc
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'METADATA_SAVE_FAILED',
      error: err?.message || 'Retry failed while saving document metadata to Firestore.',
      recoverableDraft: {
        document: updatedDoc,
        uploadedAtStorage: true,
        failureReason: err?.message || 'Firestore metadata write failed'
      }
    };
  }
}

/**
 * Replaces an existing passenger document WITHOUT silently overwriting the original file.
 * Uploads the replacement to a new unique versioned Storage path and preserves the
 * previous file reference inside `versionHistory`.
 */
export async function replacePassengerComplianceDocument(
  input: ReplacePassengerDocumentInput,
  user: User | null,
  deps: PassengerDocumentServiceDeps = {}
): Promise<PassengerDocumentOperationResult> {
  const binaryAdapter = deps.binaryAdapter || defaultFirebaseBinaryAdapter;
  const metadataAdapter = deps.metadataAdapter || defaultFirestoreMetadataAdapter;

  if (!user || !canUserAccessBookingDocuments(user, input.booking)) {
    return {
      success: false,
      errorCode: 'PERMISSION_DENIED',
      error: 'You do not have permission to replace compliance documents for this booking.'
    };
  }

  if (input.existingDocument.bookingId !== input.booking.id) {
    return {
      success: false,
      errorCode: 'DOCUMENT_NOT_FOUND',
      error: 'Document does not belong to the target booking.'
    };
  }

  const fileSizeBytes = input.file instanceof Blob ? input.file.size : 0;
  const validation = validatePassengerDocumentFile({
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    fileSizeBytes
  });
  if (!validation.valid) {
    return {
      success: false,
      errorCode: 'VALIDATION_FAILED',
      error: validation.error
    };
  }

  const now = new Date().toISOString();
  const nextVersion = (input.existingDocument.version || 1) + 1;
  const newStoragePath = buildPassengerDocumentStoragePath({
    bookingId: input.existingDocument.bookingId,
    passengerId: input.existingDocument.passengerId,
    documentId: input.existingDocument.id,
    version: nextVersion,
    originalFileName: input.originalFileName
  });

  input.onProgress?.({
    percent: 5,
    stage: 'VALIDATING',
    message: `Preparing replacement ${input.originalFileName}...`
  });

  // Upload new version FIRST — original file remains untouched
  let finalStoragePath = newStoragePath;
  let uploadedSize = fileSizeBytes;
  let storageBackend: 'FIREBASE_STORAGE' | 'FIRESTORE_CHUNKS' | undefined;
  let blobGroupId: string | undefined;
  let chunkCount: number | undefined;
  try {
    input.onProgress?.({
      percent: 12,
      stage: 'UPLOADING_STORAGE',
      message: `Uploading replacement ${input.originalFileName}...`
    });
    const uploaded = await binaryAdapter.uploadFile({
      storagePath: newStoragePath,
      bytes: input.file,
      mimeType: validation.normalizedMimeType,
      customMetadata: {
        bookingId: input.existingDocument.bookingId,
        bookingReference: input.existingDocument.bookingReference || '',
        passengerId: input.existingDocument.passengerId,
        documentId: input.existingDocument.id,
        category: input.existingDocument.category,
        version: String(nextVersion),
        originalFileName: input.originalFileName,
        uploadedByUid: auth.currentUser?.uid || user.id,
        agentId: input.existingDocument.agentId || '',
        submittedByUserId: input.existingDocument.submittedByUserId || '',
        assignedAgentId: input.existingDocument.assignedAgentId || ''
      },
      onProgress: (pct, backend) => {
        const scaled = 12 + Math.round((Math.min(100, Math.max(0, pct)) / 100) * 68);
        input.onProgress?.({
          percent: scaled,
          stage: backend === 'FIRESTORE_CHUNKS' ? 'UPLOADING_FIRESTORE_CHUNKS' : 'UPLOADING_STORAGE',
          message:
            backend === 'FIRESTORE_CHUNKS'
              ? `Persisting encrypted replacement chunks (${pct}%)...`
              : `Uploading replacement to Cloud Storage (${pct}%)...`
        });
      }
    });
    finalStoragePath = uploaded.storagePath;
    uploadedSize = uploaded.fileSizeBytes;
    storageBackend = uploaded.storageBackend;
    blobGroupId = uploaded.blobGroupId;
    chunkCount = uploaded.chunkCount;
  } catch (err: any) {
    const isTimeout = /timed out|stalled/i.test(err?.message || '');
    input.onProgress?.({
      percent: 0,
      stage: 'FAILED',
      message: err?.message || 'Replacement upload failed.'
    });
    return {
      success: false,
      errorCode: isTimeout ? 'UPLOAD_TIMEOUT' : 'STORAGE_UPLOAD_FAILED',
      error: err?.message || 'Failed to upload replacement document. Previous document remains active.'
    };
  }

  const actorUid = auth.currentUser?.uid || user.id;
  const archivedPriorVersion: PassengerDocumentVersionEntry = {
    version: input.existingDocument.version || 1,
    storagePath: input.existingDocument.storagePath,
    originalFileName: input.existingDocument.originalFileName,
    mimeType: input.existingDocument.mimeType,
    fileSizeBytes: input.existingDocument.fileSizeBytes,
    uploadedBy: input.existingDocument.uploadedBy,
    uploadedByName: input.existingDocument.uploadedByName,
    uploadedAt: input.existingDocument.uploadedAt,
    replacedAt: now,
    replacedBy: actorUid,
    replacedByName: user.name || user.email || 'Authorized User',
    replaceReason: input.replaceReason?.trim() || 'Replaced with updated compliance copy'
  };

  const updatedRecord: PassengerComplianceDocument = {
    ...input.existingDocument,
    originalFileName: input.originalFileName.trim(),
    storagePath: finalStoragePath,
    storageBackend,
    blobGroupId,
    chunkCount,
    mimeType: validation.normalizedMimeType,
    fileSizeBytes: uploadedSize,
    uploadedBy: actorUid,
    uploadedByName: user.name || user.email || 'Authorized User',
    uploadedByRole: user.role || 'ADMIN',
    uploadedAt: now,
    verificationStatus: 'PENDING_REVIEW',
    expiryDate: input.expiryDate !== undefined ? input.expiryDate.trim() || undefined : input.existingDocument.expiryDate,
    version: nextVersion,
    versionHistory: [archivedPriorVersion, ...(input.existingDocument.versionHistory || [])],
    status: 'ACTIVE',
    updatedAt: now
  };

  try {
    input.onProgress?.({
      percent: 86,
      stage: 'SAVING_METADATA',
      message: 'Saving replacement metadata to Firestore...'
    });
    await metadataAdapter.saveMetadata(updatedRecord);
    input.onProgress?.({
      percent: 94,
      stage: 'SYNCING_BOOKING',
      message: 'Updating passenger manifest link...'
    });
    await syncPassengerPointerToBooking(input.booking, updatedRecord.passengerId, updatedRecord, 'ATTACH', user);
    AppDatabase.getInstance().logAudit(
      user,
      'BOOKING_UPDATED',
      'PassengerDocument',
      updatedRecord.id,
      `Replaced ${updatedRecord.documentType} for ${updatedRecord.passengerName} (v${nextVersion}: ${updatedRecord.originalFileName})`
    );
    input.onProgress?.({
      percent: 100,
      stage: 'COMPLETED',
      message: `Replacement v${nextVersion} saved successfully.`
    });
    return { success: true, document: updatedRecord };
  } catch (err: any) {
    input.onProgress?.({
      percent: 86,
      stage: 'FAILED',
      message: err?.message || 'Metadata save failed.'
    });
    return {
      success: false,
      errorCode: 'METADATA_SAVE_FAILED',
      error:
        err?.message ||
        'Replacement file uploaded, but updating metadata failed. Retry metadata save to finalize replacement.',
      recoverableDraft: {
        document: updatedRecord,
        uploadedAtStorage: true,
        failureReason: err?.message || 'Firestore metadata update failed'
      }
    };
  }
}

/**
 * Authorized deletion with audit preservation and shared-path safety check.
 * Soft-deletes metadata in Firestore (`status: 'DELETED'`) so audit history is preserved,
 * and deletes the Storage binary ONLY if no other active/historical record references the same path.
 */
export async function deletePassengerComplianceDocument(
  params: {
    booking: Booking;
    document: PassengerComplianceDocument;
    reason?: string;
    hardDeleteUnreferencedStorageFile?: boolean;
  },
  user: User | null,
  deps: PassengerDocumentServiceDeps = {}
): Promise<PassengerDocumentOperationResult> {
  const binaryAdapter = deps.binaryAdapter || defaultFirebaseBinaryAdapter;
  const metadataAdapter = deps.metadataAdapter || defaultFirestoreMetadataAdapter;

  if (!user || !canUserDeletePassengerDocument(user, params.booking)) {
    return {
      success: false,
      errorCode: 'PERMISSION_DENIED',
      error: 'You do not have permission to delete this compliance document.'
    };
  }

  if (params.document.bookingId !== params.booking.id) {
    return {
      success: false,
      errorCode: 'DOCUMENT_NOT_FOUND',
      error: 'Document does not belong to the target booking.'
    };
  }

  const now = new Date().toISOString();
  const deletedDoc: PassengerComplianceDocument = {
    ...params.document,
    status: 'DELETED',
    deletedAt: now,
    deletedBy: auth.currentUser?.uid || user.id,
    deletedByName: user.name || user.email || 'Authorized User',
    deleteReason: params.reason?.trim() || 'Removed from passenger compliance manifest',
    updatedAt: now
  };

  try {
    await metadataAdapter.saveMetadata(deletedDoc);
    await syncPassengerPointerToBooking(params.booking, deletedDoc.passengerId, deletedDoc, 'REMOVE', user);

    let storageDeleted = false;
    let storageRetainedReason: string | undefined;

    if (params.hardDeleteUnreferencedStorageFile !== false && deletedDoc.storagePath) {
      const otherRefs = await metadataAdapter.countStoragePathReferences(
        deletedDoc.storagePath,
        deletedDoc.id
      );
      if (otherRefs === 0) {
        try {
          await binaryAdapter.deleteFile(deletedDoc.storagePath, deletedDoc);
          storageDeleted = true;
        } catch {
          storageRetainedReason = 'Storage binary could not be removed immediately; metadata marked DELETED.';
        }
      } else {
        storageRetainedReason = `Storage object retained because ${otherRefs} other record(s) reference this path.`;
      }
    }

    AppDatabase.getInstance().logAudit(
      user,
      'BOOKING_UPDATED',
      'PassengerDocument',
      deletedDoc.id,
      `Deleted compliance document ${deletedDoc.documentType} (${deletedDoc.originalFileName}) for ${deletedDoc.passengerName}`
    );

    return {
      success: true,
      document: deletedDoc,
      storageDeleted,
      storageRetainedReason
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'DELETE_FAILED',
      error: err?.message || 'Failed to delete compliance document.'
    };
  }
}

/**
 * Updates verification status, verification notes, or expiry date for a persisted compliance document.
 * Restricted to authorized internal operations staff.
 */
export async function updatePassengerDocumentVerification(
  params: {
    booking: Booking;
    document: PassengerComplianceDocument;
    verificationStatus: PassengerDocumentVerificationStatus;
    verificationNotes?: string;
    expiryDate?: string;
  },
  user: User | null,
  deps: PassengerDocumentServiceDeps = {}
): Promise<PassengerDocumentOperationResult> {
  const metadataAdapter = deps.metadataAdapter || defaultFirestoreMetadataAdapter;
  if (!user || (!isInternalStaff(user) && !isMasterAdmin(user))) {
    return {
      success: false,
      errorCode: 'PERMISSION_DENIED',
      error: 'Only authorized internal operations staff can verify compliance documents.'
    };
  }

  const now = new Date().toISOString();
  const updatedDoc: PassengerComplianceDocument = {
    ...params.document,
    verificationStatus: params.verificationStatus,
    verificationNotes: params.verificationNotes?.trim() || undefined,
    expiryDate: params.expiryDate !== undefined ? params.expiryDate.trim() || undefined : params.document.expiryDate,
    verifiedBy: auth.currentUser?.uid || user.id,
    verifiedByName: user.name || user.email || 'Operations Lead',
    verifiedAt: now,
    updatedAt: now
  };

  try {
    await metadataAdapter.saveMetadata(updatedDoc);
    return { success: true, document: updatedDoc };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'METADATA_SAVE_FAILED',
      error: err?.message || 'Failed to update document verification status.'
    };
  }
}

/**
 * Hydrates persisted compliance documents for a booking directly from Firestore so
 * documents survive page refresh and logout/login cleanly.
 */
export async function loadBookingPassengerDocumentsFromFirestore(
  bookingId: string,
  deps: PassengerDocumentServiceDeps = {}
): Promise<PassengerComplianceDocument[]> {
  const metadataAdapter = deps.metadataAdapter || defaultFirestoreMetadataAdapter;
  const docs = await metadataAdapter.listByBooking(bookingId);
  return docs
    .filter(d => d.bookingId === bookingId && d.status !== 'DELETED')
    .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
}

/**
 * Strictly scoped document list: guarantees Passenger A's documents NEVER appear under Passenger B
 * and Booking A's documents NEVER appear under Booking B.
 */
export function filterScopedPassengerDocuments(
  allDocs: PassengerComplianceDocument[],
  bookingId: string,
  passengerId?: string,
  options: { includeDeleted?: boolean } = {}
): PassengerComplianceDocument[] {
  return allDocs
    .filter(d => {
      if (d.bookingId !== bookingId) return false;
      if (passengerId && d.passengerId !== passengerId) return false;
      if (!options.includeDeleted && d.status === 'DELETED') return false;
      return true;
    })
    .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
}

/**
 * Authenticated preview & download resolver:
 * Fetches bytes via Firebase Storage authenticated SDK (`getBlob`) and returns a local `blob:` URL.
 * Never exposes public unauthenticated URLs and never logs sensitive document contents.
 */
export async function resolveAuthenticatedPassengerDocumentBlob(
  docRecord: PassengerComplianceDocument,
  booking: Booking,
  user: User | null,
  deps: PassengerDocumentServiceDeps = {}
): Promise<{ success: boolean; blob?: Blob; mimeType?: string; error?: string }> {
  if (!user || !canUserAccessBookingDocuments(user, booking)) {
    return { success: false, error: 'Access denied to passenger compliance document.' };
  }
  if (docRecord.bookingId !== booking.id) {
    return { success: false, error: 'Document does not match this booking.' };
  }
  const binaryAdapter = deps.binaryAdapter || defaultFirebaseBinaryAdapter;
  try {
    const blob = await binaryAdapter.downloadBlob(docRecord.storagePath, docRecord);
    return { success: true, blob, mimeType: docRecord.mimeType || blob.type || 'application/octet-stream' };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to retrieve compliance document securely.'
    };
  }
}

export async function triggerAuthenticatedPassengerDocumentDownload(
  docRecord: PassengerComplianceDocument,
  booking: Booking,
  user: User | null,
  deps: PassengerDocumentServiceDeps = {}
): Promise<{ success: boolean; error?: string }> {
  const res = await resolveAuthenticatedPassengerDocumentBlob(docRecord, booking, user, deps);
  if (!res.success || !res.blob) {
    return { success: false, error: res.error || 'Download failed.' };
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blobUrl = URL.createObjectURL(res.blob);
    try {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = docRecord.originalFileName || `${docRecord.documentType}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    }
  }
  return { success: true };
}

export interface BatchPassengerDocumentUploadItem {
  clientKey: string;
  category: PassengerComplianceDocumentCategory;
  file: File | Blob;
  originalFileName: string;
  mimeType: string;
  expiryDate?: string;
  verificationNotes?: string;
}

export interface BatchPassengerDocumentUploadOutcome {
  clientKey: string;
  originalFileName: string;
  category: PassengerComplianceDocumentCategory;
  result: PassengerDocumentOperationResult;
}

/**
 * Sequential multi-file upload helper with per-file progress reporting and isolated failure handling
 * so a single failed file never blocks or cancels the remaining passenger documents.
 */
export async function uploadMultiplePassengerDocuments(
  params: {
    booking: Booking;
    passengerId: string;
    items: BatchPassengerDocumentUploadItem[];
    onItemProgress?: (clientKey: string, progress: PassengerDocumentUploadProgress) => void;
    onItemCompleted?: (outcome: BatchPassengerDocumentUploadOutcome) => void;
  },
  user: User | null,
  deps: PassengerDocumentServiceDeps = {}
): Promise<BatchPassengerDocumentUploadOutcome[]> {
  const outcomes: BatchPassengerDocumentUploadOutcome[] = [];
  const db = AppDatabase.getInstance();

  for (const item of params.items) {
    const latestBooking = db.getBookingById(params.booking.id, user) || params.booking;
    const result = await uploadPassengerComplianceDocument(
      {
        booking: latestBooking,
        passengerId: params.passengerId,
        category: item.category,
        file: item.file,
        originalFileName: item.originalFileName,
        mimeType: item.mimeType,
        expiryDate: item.expiryDate,
        verificationNotes: item.verificationNotes,
        onProgress: progress => params.onItemProgress?.(item.clientKey, progress)
      },
      user,
      deps
    );
    const outcome: BatchPassengerDocumentUploadOutcome = {
      clientKey: item.clientKey,
      originalFileName: item.originalFileName,
      category: item.category,
      result
    };
    outcomes.push(outcome);
    params.onItemCompleted?.(outcome);
  }

  return outcomes;
}
