import { doc, setDoc } from 'firebase/firestore';
import { auth, db as firestoreDb } from './firebase';
import { cleanFirestoreUndefined } from './quotationVersionStorage';

export type QuotationOperationType =
  | 'SAVE_DRAFT'
  | 'SNAPSHOT_CREATE'
  | 'PDF_GENERATE'
  | 'EMAIL_SEND'
  | 'WHATSAPP_SHARE'
  | 'SAVE_MASTER_PACKAGE'
  | 'CONVERT_BOOKING';

export type QuotationOperationStatus =
  | 'IDLE'
  | 'PREPARING'
  | 'VALIDATING'
  | 'GENERATING'
  | 'SENDING'
  | 'CHECKING_STATUS'
  | 'IN_PROGRESS'
  | 'VERIFYING'
  | 'ACCEPTED_BY_PROVIDER'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'RETRY_AVAILABLE';

export interface QuotationOperationRecord {
  operationId: string;
  idempotencyKey: string;
  quoteId: string;
  versionId?: string;
  uid: string;
  operationType: QuotationOperationType;
  status: QuotationOperationStatus;
  createdAt: string;
  startedAt: string;
  completedAt?: string;
  updatedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  safeUserMessage?: string;
  retryCount: number;
  resultRef?: string;
}

export class BoundedOperationTimeoutError extends Error {
  public readonly code: string;
  public readonly isTimeout = true;

  constructor(label: string, timeoutMs: number, code = 'OPERATION_TIMEOUT') {
    super(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Your previous saved data was not modified.`);
    this.name = 'BoundedOperationTimeoutError';
    this.code = code;
  }
}

export function withBoundedTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  errorCode = 'OPERATION_TIMEOUT'
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new BoundedOperationTimeoutError(label, timeoutMs, errorCode));
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function classifyOperationError(err: unknown): {
  errorCode: string;
  errorMessage: string;
  safeUserMessage: string;
  isTimeout: boolean;
} {
  if (err instanceof BoundedOperationTimeoutError || (err as any)?.isTimeout) {
    const msg = (err as Error)?.message || 'The operation timed out.';
    return {
      errorCode: (err as any)?.code || 'OPERATION_TIMEOUT',
      errorMessage: msg,
      safeUserMessage: msg,
      isTimeout: true
    };
  }

  const rawMsg = err instanceof Error ? err.message : String(err || 'Unexpected operation error');
  const lower = rawMsg.toLowerCase();

  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions') || lower.includes('403')) {
    return {
      errorCode: 'FIRESTORE_PERMISSION_DENIED',
      errorMessage: rawMsg,
      safeUserMessage: 'Permission denied while saving to Firestore. Please confirm your session is active and retry.',
      isTimeout: false
    };
  }

  if (lower.includes('network') || lower.includes('offline') || lower.includes('failed to fetch') || lower.includes('aborted')) {
    return {
      errorCode: 'NETWORK_ERROR',
      errorMessage: rawMsg,
      safeUserMessage: 'Network interruption prevented completion. You can safely retry without duplicating saved data.',
      isTimeout: lower.includes('aborted')
    };
  }

  if (lower.includes('exceeds') && lower.includes('bytes')) {
    return {
      errorCode: 'DOCUMENT_SIZE_EXCEEDED',
      errorMessage: rawMsg,
      safeUserMessage: 'Quotation payload exceeded single-document size safety limits after splitting.',
      isTimeout: false
    };
  }

  return {
    errorCode: (err as any)?.code || 'OPERATION_FAILED',
    errorMessage: rawMsg,
    safeUserMessage: rawMsg.length > 260 ? `${rawMsg.slice(0, 257)}...` : rawMsg,
    isTimeout: false
  };
}

class QuotationOperationsService {
  private static instance: QuotationOperationsService;
  private operations: Map<string, QuotationOperationRecord> = new Map();
  private subscribers: Set<() => void> = new Set();
  private readonly maxMemoryRecords = 120;

  private constructor() {}

  public static getInstance(): QuotationOperationsService {
    if (!QuotationOperationsService.instance) {
      QuotationOperationsService.instance = new QuotationOperationsService();
    }
    return QuotationOperationsService.instance;
  }

  public subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(): void {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore subscriber error
      }
    });
  }

  private persistBestEffort(record: QuotationOperationRecord): void {
    if (typeof window === 'undefined' || !auth.currentUser) return;
    if (record.uid !== auth.currentUser.uid) return;
    const payload = cleanFirestoreUndefined({
      ...record,
      errorMessage: record.errorMessage ? String(record.errorMessage).slice(0, 500) : undefined,
      safeUserMessage: record.safeUserMessage ? String(record.safeUserMessage).slice(0, 300) : undefined,
      resultRef: record.resultRef ? String(record.resultRef).slice(0, 240) : undefined
    });
    void withBoundedTimeout(
      setDoc(doc(firestoreDb, 'quotation_operations', record.operationId), payload, { merge: true }),
      5000,
      'Persist operation telemetry'
    ).catch(() => undefined);
  }

  public startOperation(params: {
    idempotencyKey: string;
    quoteId: string;
    versionId?: string;
    uid?: string;
    operationType: QuotationOperationType;
    status?: QuotationOperationStatus;
  }): QuotationOperationRecord {
    const now = new Date().toISOString();
    const resolvedUid = (typeof window !== 'undefined' ? auth.currentUser?.uid : undefined) || params.uid || 'local-session';

    // Check prior attempts with same idempotencyKey to preserve retryCount accurately
    const existingByKey = Array.from(this.operations.values()).find(
      (op) => op.idempotencyKey === params.idempotencyKey && op.quoteId === params.quoteId && op.operationType === params.operationType
    );

    const isRetry = Boolean(
      existingByKey &&
      (existingByKey.status === 'FAILED' || existingByKey.status === 'TIMED_OUT' || existingByKey.status === 'RETRY_AVAILABLE')
    );

    const operationId = existingByKey
      ? existingByKey.operationId
      : `qop_${params.operationType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const record: QuotationOperationRecord = {
      operationId,
      idempotencyKey: params.idempotencyKey,
      quoteId: params.quoteId,
      versionId: params.versionId,
      uid: resolvedUid,
      operationType: params.operationType,
      status: params.status || 'IN_PROGRESS',
      createdAt: existingByKey?.createdAt || now,
      startedAt: now,
      updatedAt: now,
      retryCount: isRetry ? (existingByKey?.retryCount || 0) + 1 : (existingByKey?.retryCount || 0)
    };

    this.operations.set(operationId, record);
    if (this.operations.size > this.maxMemoryRecords) {
      const oldestKey = this.operations.keys().next().value;
      if (oldestKey) this.operations.delete(oldestKey);
    }
    this.notify();
    this.persistBestEffort(record);
    return record;
  }

  public updateOperation(
    operationId: string,
    patch: Partial<Pick<QuotationOperationRecord, 'status' | 'versionId' | 'completedAt' | 'errorCode' | 'errorMessage' | 'safeUserMessage' | 'resultRef'>>
  ): QuotationOperationRecord | null {
    const existing = this.operations.get(operationId);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: QuotationOperationRecord = {
      ...existing,
      ...patch,
      updatedAt: now,
      completedAt:
        patch.completedAt ||
        (patch.status && ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'RETRY_AVAILABLE'].includes(patch.status)
          ? now
          : existing.completedAt)
    };
    this.operations.set(operationId, updated);
    this.notify();
    this.persistBestEffort(updated);
    return updated;
  }

  public markSucceeded(operationId: string, extras?: { versionId?: string; resultRef?: string }): QuotationOperationRecord | null {
    return this.updateOperation(operationId, {
      status: 'SUCCEEDED',
      versionId: extras?.versionId,
      resultRef: extras?.resultRef,
      completedAt: new Date().toISOString(),
      errorCode: undefined,
      errorMessage: undefined,
      safeUserMessage: undefined
    });
  }

  public markFailed(operationId: string, err: unknown): QuotationOperationRecord | null {
    const classified = classifyOperationError(err);
    return this.updateOperation(operationId, {
      status: classified.isTimeout ? 'TIMED_OUT' : 'FAILED',
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
      safeUserMessage: classified.safeUserMessage,
      completedAt: new Date().toISOString()
    });
  }

  public getOperationsForQuote(quoteId: string): QuotationOperationRecord[] {
    return Array.from(this.operations.values())
      .filter((op) => op.quoteId === quoteId)
      .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  }

  public getLatestOperationForQuote(
    quoteId: string,
    operationType?: QuotationOperationType
  ): QuotationOperationRecord | null {
    const matches = this.getOperationsForQuote(quoteId).filter(
      (op) => !operationType || op.operationType === operationType
    );
    return matches[0] || null;
  }
}

export const quotationOperationsService = QuotationOperationsService.getInstance();
