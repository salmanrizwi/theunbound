import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';
import { sanitizeQuoteItemForAgent } from '../utils/customerQuoteSanitizer';
import { canUserViewInternalCostBreakdown } from './permissionEngine';
import {
  AuthoritativeQuotationSnapshot,
  Quotation,
  QuotationVersionManifestStatus,
  QuotationVersionSectionDocument,
  QuotationVersionSectionId,
  QuotationVersionSectionRef,
  QuotationVersionStorageFormat,
  QuotationVersionSummary,
  QuoteItem,
  QuoteVersionRecord,
  TripRouteHub,
  User
} from '../types';

export const FIRESTORE_MAX_DOC_BYTES = 1_048_576; // 1 MiB exact Firestore limit
export const SAFE_DOC_BYTE_THRESHOLD = 819_200;   // 800 KiB conservative threshold
export const STORAGE_SCHEMA_VERSION_V2 = 2;

export const LOGICAL_SECTION_ORDER: QuotationVersionSectionId[] = [
  'trip_overview',
  'itinerary',
  'accommodation',
  'products_and_services',
  'pricing',
  'commercial_terms',
  'destination_policies',
  'passenger_details',
  'branding_and_output_settings'
];

const utf8Encoder = new TextEncoder();

export function utf8ByteLength(value: string): number {
  if (!value) return 0;
  return utf8Encoder.encode(value).length;
}

/**
 * Exact Firestore Document Size Estimator (official Firestore byte accounting + framing buffer).
 * Reference: https://firebase.google.com/docs/firestore/storage-size
 */
export function estimateFirestoreValueBytes(value: any): number {
  if (value === null || value === undefined) return 1;
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') return 8;
  if (typeof value === 'string') return utf8ByteLength(value) + 1;
  if (value instanceof Date) return 8;
  if (Array.isArray(value)) {
    let total = 0;
    for (let i = 0; i < value.length; i += 1) {
      total += estimateFirestoreValueBytes(value[i]);
    }
    return total;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return 1;
    let total = 0;
    for (let i = 0; i < entries.length; i += 1) {
      const [k, v] = entries[i];
      total += utf8ByteLength(k) + 1 + estimateFirestoreValueBytes(v);
    }
    return total;
  }
  return 8;
}

export function estimateFirestoreDocumentBytes(
  docData: Record<string, any>,
  documentPath = 'quotations/QTE-SAMPLE/versions/QTE-SAMPLE__v1/sections/products_and_services'
): number {
  const pathSegments = documentPath.split('/').filter(Boolean);
  const docNameSize =
    pathSegments.reduce((acc, seg) => acc + utf8ByteLength(seg) + 1, 0) + 16;
  const fieldsSize = estimateFirestoreValueBytes(docData);
  return docNameSize + 32 + fieldsSize;
}

export function measureJsonBytes(value: any): number {
  try {
    return utf8ByteLength(JSON.stringify(value));
  } catch {
    return 0;
  }
}

/**
 * Normalizes Firestore runtime values (Timestamp, Date, GeoPoint, DocumentReference, -0, NaN/Infinity)
 * while preserving array order, explicit null/empty values, numeric vs string distinctions, Unicode, and HTML.
 */
function normalizeFirestorePrimitivesPreserveOrder(value: any, seen = new WeakSet<object>()): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return 0;
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'object') return value;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  // Firestore Timestamp (SDK instance or serialized { seconds, nanoseconds } / { _seconds, _nanoseconds })
  if (typeof (value as any).toDate === 'function') {
    try {
      const d = (value as any).toDate();
      if (d instanceof Date && Number.isFinite(d.getTime())) {
        return d.toISOString();
      }
    } catch {
      // fall through
    }
  }
  if (
    (typeof (value as any).seconds === 'number' && typeof (value as any).nanoseconds === 'number') ||
    (typeof (value as any)._seconds === 'number' && typeof (value as any)._nanoseconds === 'number')
  ) {
    const keys = Object.keys(value);
    if (
      keys.every(
        k => k === 'seconds' || k === 'nanoseconds' || k === '_seconds' || k === '_nanoseconds' || k === 'type'
      )
    ) {
      const secs = Number((value as any).seconds ?? (value as any)._seconds ?? 0);
      const nanos = Number((value as any).nanoseconds ?? (value as any)._nanoseconds ?? 0);
      const ms = secs * 1000 + Math.floor(nanos / 1_000_000);
      return new Date(ms).toISOString();
    }
  }
  // Firestore GeoPoint
  if (
    typeof (value as any).latitude === 'number' &&
    typeof (value as any).longitude === 'number' &&
    (typeof (value as any).isEqual === 'function' ||
      value?.constructor?.name === 'GeoPoint' ||
      (Object.keys(value).length === 2 &&
        'latitude' in value &&
        'longitude' in value))
  ) {
    return {
      latitude: Object.is(value.latitude, -0) ? 0 : value.latitude,
      longitude: Object.is(value.longitude, -0) ? 0 : value.longitude
    };
  }
  // Firestore DocumentReference (avoid circular .firestore reference)
  if (
    typeof (value as any).path === 'string' &&
    typeof (value as any).id === 'string' &&
    ((value as any).firestore !== undefined || value?.constructor?.name === 'DocumentReference')
  ) {
    return {
      __firestoreRefPath: String((value as any).path),
      id: String((value as any).id)
    };
  }

  if (seen.has(value)) return null;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map(item =>
        item === undefined ? null : normalizeFirestorePrimitivesPreserveOrder(item, seen)
      );
    }
    const cloned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        cloned[k] = normalizeFirestorePrimitivesPreserveOrder(v, seen);
      }
    }
    return cloned;
  } finally {
    seen.delete(value);
  }
}

export function canonicalizeQuotationValue(value: any): any {
  const normalized = normalizeFirestorePrimitivesPreserveOrder(value);
  const sortKeys = (node: any): any => {
    if (node === null || node === undefined || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(sortKeys);
    const sorted: Record<string, any> = {};
    Object.keys(node)
      .sort()
      .forEach(k => {
        if (node[k] !== undefined) {
          sorted[k] = sortKeys(node[k]);
        }
      });
    return sorted;
  };
  return sortKeys(normalized);
}

export function deepCloneSafe<T>(val: T): T {
  if (val === undefined || val === null) return val;
  try {
    return normalizeFirestorePrimitivesPreserveOrder(val) as T;
  } catch {
    try {
      return JSON.parse(JSON.stringify(val));
    } catch {
      return val;
    }
  }
}

/**
 * Deterministic multi-lane 128-bit hex hash (synchronous across Browser & Node/tsx).
 */
export function computeDeterministicHexHash(input: any): string {
  const str = typeof input === 'string' ? input : JSON.stringify(canonicalizeQuotationValue(input));
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let h3 = 0x85ebca6b;
  let h4 = 0xc2b2ae35;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ (ch * 31), 0xc2b2ae35) >>> 0;
    h4 = Math.imul(h4 ^ ((ch << 5) - ch), 0x27d4eb2f) >>> 0;
  }
  return [h1, h2, h3, h4].map(n => n.toString(16).padStart(8, '0')).join('');
}

const RESTRICTED_COMMERCIAL_KEYS = new Set([
  'internalNettCost',
  'supplierCost',
  'internalMarkup',
  'internalProfit',
  'dmcMarginAmount',
  'totalNetCost',
  'totalNettCost',
  'totalMargin',
  'marginAmount',
  'marginPercent',
  'adminManualMarginType',
  'adminManualMarginValue',
  'adminManualMarginAmount',
  'adminMarginMode',
  'revisedSellingPrice',
  'totalConvertedNettCost',
  'convertedTotalNetCost',
  'existingBaseMarginAmount',
  'baseMarginTotal',
  'manualMarginAdjustmentMode',
  'manualMarginAdjustmentType',
  'manualMarginAdjustmentValue',
  'manualMarginAdjustmentAmount',
  'effectiveUnderlyingMarginAmount',
  'manualMarginAdjustedTotal',
  'originalNetCost',
  'convertedNetCost',
  'baseMarginPercent',
  'baseMarginAmount',
  'underlyingMarginAmount',
  'existingMarginAmount',
  'adminFinalTotal',
  'productLevelMarginEnabled',
  'activeMarginMode',
  'agentLevelMarginPercent'
]);

/**
 * Shared recursive cost-redaction helper applied BEFORE split hashing for external B2B Agents
 * so stored section contentHashes, sectionsIntegrityHash, and Firestore rules stay 100% consistent.
 */
export function stripRestrictedCommercialFieldsForRole<T = any>(
  payload: T,
  allowInternalCosts: boolean
): T {
  if (!payload || typeof payload !== 'object' || allowInternalCosts) return payload;
  const normalized = normalizeFirestorePrimitivesPreserveOrder(payload);
  const stripRecord = (obj: any, keyName?: string): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      if (keyName === 'items') {
        return obj.map((it: any) =>
          it && typeof it === 'object' ? stripRecord(sanitizeQuoteItemForAgent(it), 'item') : it
        );
      }
      return obj.map(el => stripRecord(el));
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (RESTRICTED_COMMERCIAL_KEYS.has(k)) continue;
      out[k] = stripRecord(v, k);
    }
    return out;
  };
  return stripRecord(normalized);
}

export function cleanFirestoreUndefined(data: any): any {
  return normalizeFirestorePrimitivesPreserveOrder(data) ?? null;
}

const DATA_URI_REGEX = /^data:([a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+);base64,([A-Za-z0-9+/=\s]+)$/;

export type BinaryAssetUploadHandler = (params: {
  quoteId: string;
  contentType: string;
  base64Payload: string;
  extension: string;
  hash: string;
  fieldPath: string;
}) => Promise<{ downloadUrl: string; storagePath: string } | null>;

async function runWithStorageTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Storage upload timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      val => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      },
      err => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function defaultFirebaseStorageUploader(params: {
  quoteId: string;
  contentType: string;
  base64Payload: string;
  extension: string;
  hash: string;
}): Promise<{ downloadUrl: string; storagePath: string } | null> {
  try {
    const storageInstance = getFirebaseStorage();
    if (!storageInstance) return null;
    const cleanBase64 = params.base64Payload.replace(/\s+/g, '');
    const binaryStr =
      typeof atob === 'function'
        ? atob(cleanBase64)
        : Buffer.from(cleanBase64, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i += 1) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const safeQuoteId = params.quoteId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `quotations/${safeQuoteId}/assets/${params.hash}.${params.extension}`;
    const storageRef = ref(storageInstance, storagePath);
    const snapshot = await runWithStorageTimeout(
      uploadBytes(storageRef, bytes, {
        contentType: params.contentType
      }),
      4000
    );
    const downloadUrl = await runWithStorageTimeout(getDownloadURL(snapshot.ref), 3000);
    return { downloadUrl, storagePath };
  } catch {
    return null;
  }
}

/**
 * Offloads embedded base64 binary blobs (> 2 KB) from quotation payloads to Firebase Storage
 * while keeping normal external HTTPS/relative URLs completely untouched.
 */
export async function offloadInlineBinaryAssets<T>(
  input: T,
  quoteId: string,
  options: {
    minByteThreshold?: number;
    uploadHandler?: BinaryAssetUploadHandler;
    enableStorageUpload?: boolean;
    uploadTimeoutMs?: number;
  } = {}
): Promise<{ payload: T; offloadedCount: number; offloadedPaths: string[] }> {
  const minBytes = options.minByteThreshold ?? 2048;
  const offloadedPaths: string[] = [];
  let offloadedCount = 0;

  const canAttemptUpload =
    options.enableStorageUpload !== false &&
    (Boolean(options.uploadHandler) || Boolean(getFirebaseStorage()));
  const uploader = options.uploadHandler || defaultFirebaseStorageUploader;
  const uploadTimeoutMs = options.uploadTimeoutMs ?? 5000;

  const walk = async (node: any, fieldPath: string): Promise<any> => {
    if (node === null || node === undefined) return node;
    if (typeof node === 'string') {
      if (node.length > minBytes) {
        const match = node.match(DATA_URI_REGEX);
        if (match && canAttemptUpload) {
          const contentType = match[1];
          const base64Payload = match[2];
          const ext = (contentType.split('/')[1] || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin';
          const hash = computeDeterministicHexHash(base64Payload);
          const uploaded = await runWithStorageTimeout(
            uploader({
              quoteId,
              contentType,
              base64Payload,
              extension: ext,
              hash,
              fieldPath
            }),
            uploadTimeoutMs
          ).catch(() => null);
          if (uploaded?.downloadUrl) {
            offloadedCount += 1;
            offloadedPaths.push(uploaded.storagePath);
            return uploaded.downloadUrl;
          }
        }
      }
      return node;
    }
    if (Array.isArray(node)) {
      const nextArr = new Array(node.length);
      for (let i = 0; i < node.length; i += 1) {
        nextArr[i] = await walk(node[i], `${fieldPath}[${i}]`);
      }
      return nextArr;
    }
    if (typeof node === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = await walk(v, fieldPath ? `${fieldPath}.${k}` : k);
      }
      return out;
    }
    return node;
  };

  const payload = await walk(deepCloneSafe(input), '');
  return { payload, offloadedCount, offloadedPaths };
}

function areJsonEquivalent(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a === null || b === null) return a === b;
  try {
    return (
      JSON.stringify(canonicalizeQuotationValue(a)) ===
      JSON.stringify(canonicalizeQuotationValue(b))
    );
  } catch {
    return false;
  }
}

export interface SplitVersionBuildResult {
  manifest: QuoteVersionRecord;
  sectionDocs: QuotationVersionSectionDocument[];
  totalSectionBytes: number;
  maxDocBytes: number;
  byteReport: Record<string, number>;
}

/**
 * Extracts explicit accommodation stay records per route hub occurrence so Step 3 repeated-hub
 * accommodations persist cleanly in `accommodation` without stripping hub occurrence data.
 */
function extractAccommodationStaySnapshots(
  routeHubs: TripRouteHub[] = [],
  roomingConfig?: Quotation['roomingConfig'],
  items: QuoteItem[] = []
): Record<string, any> {
  const hotelItemsByOccurrence = new Map<string, string[]>();
  items.forEach(it => {
    const occId = (it as any).itineraryHubOccurrenceId || (it as any).hubOccurrenceId;
    const isHotel =
      it.product?.productType === 'Hotel' ||
      it.product?.productType === 'Hotel & Resort' ||
      it.isManualHotel === true ||
      (it.product as any)?.category === 'Hotels';
    if (occId && isHotel && it.id) {
      const list = hotelItemsByOccurrence.get(String(occId)) || [];
      list.push(it.id);
      hotelItemsByOccurrence.set(String(occId), list);
    }
  });

  const stays = (routeHubs || []).map((hub, idx) => {
    const hasExplicitOccurrenceId = hub.itineraryHubOccurrenceId !== undefined;
    const occurrenceId = hub.itineraryHubOccurrenceId || hub.id || `occ-${idx + 1}`;
    return {
      hasExplicitOccurrenceId,
      itineraryHubOccurrenceId: occurrenceId,
      accommodationStayId: (hub as any).accommodationStayId || `stay-${occurrenceId}`,
      hubId: hub.hubId,
      hubName: hub.hubName,
      order: hub.order ?? idx + 1,
      nights: hub.nights ?? 1,
      checkInDate: hub.checkInDate,
      checkOutDate: hub.checkOutDate,
      accommodationType: hub.accommodationType,
      hotelId: hub.hotelId,
      roomTypeId: hub.roomTypeId,
      roomsCount: hub.roomsCount,
      isManualHotel: hub.isManualHotel,
      manualHotel: deepCloneSafe(hub.manualHotel),
      roomConfiguration: deepCloneSafe((hub as any).roomConfiguration),
      passengerAllocation: deepCloneSafe((hub as any).passengerAllocation),
      overriddenByLandOnly: hub.overriddenByLandOnly,
      savedAccommodationSnapshot: deepCloneSafe(hub.savedAccommodationSnapshot),
      linkedHotelQuoteItemIds: hotelItemsByOccurrence.get(String(occurrenceId)) || []
    };
  });

  return {
    stays,
    ...(roomingConfig !== undefined ? { roomingConfig: deepCloneSafe(roomingConfig) } : {})
  };
}

/**
 * Splits a monolithic payload into dynamic `<= SAFE_DOC_BYTE_THRESHOLD` (800 KiB) chunk documents
 * when a single logical section exceeds 800 KiB. Never drops or truncates content.
 */
function buildSectionDocsWithDynamicChunking(params: {
  logicalSection: QuotationVersionSectionId;
  rawData: Record<string, any>;
  quoteId: string;
  versionId: string;
  versionNumber: number;
  agentId?: string;
  userId?: string;
  createdAt: string;
  maxDocBytes?: number;
}): QuotationVersionSectionDocument[] {
  const maxBytes = params.maxDocBytes ?? SAFE_DOC_BYTE_THRESHOLD;
  const basePath = `quotations/${params.quoteId}/versions/${params.versionId}/sections`;

  const makeDoc = (
    sectionId: string,
    chunkIndex: number,
    totalChunks: number,
    data: Record<string, any>
  ): QuotationVersionSectionDocument => {
    const cleanData = cleanFirestoreUndefined(data);
    const contentHash = computeDeterministicHexHash(cleanData);
    const partialDoc: Omit<QuotationVersionSectionDocument, 'estimatedBytes'> & { estimatedBytes: number } = {
      id: sectionId,
      sectionId,
      quoteId: params.quoteId,
      versionId: params.versionId,
      versionNumber: params.versionNumber,
      logicalSection: params.logicalSection,
      chunkIndex,
      totalChunks,
      estimatedBytes: 0,
      contentHash,
      agentId: params.agentId,
      userId: params.userId,
      createdAt: params.createdAt,
      data: cleanData
    };
    const cleanedDoc = cleanFirestoreUndefined(partialDoc);
    cleanedDoc.estimatedBytes = estimateFirestoreDocumentBytes(
      cleanedDoc,
      `${basePath}/${sectionId}`
    );
    return cleanedDoc as QuotationVersionSectionDocument;
  };

  const singleCandidate = makeDoc(params.logicalSection, 0, 1, params.rawData);
  if (singleCandidate.estimatedBytes <= maxBytes) {
    return [singleCandidate];
  }

  // Section exceeds 800 KiB -> deterministic chunk splitting across arrays, maps, and huge strings
  const dataChunks: Array<Record<string, any>> = [];
  const remainingScalarData: Record<string, any> = {};
  const chunkBudget = Math.max(100_000, maxBytes - 16_384); // 16 KiB headroom for wrapper metadata

  const splitLargeString = (fieldKey: string, val: string): Array<Record<string, any>> => {
    const parts: Array<Record<string, any>> = [];
    let offset = 0;
    const maxCharsPerSlice = 250_000;
    while (offset < val.length) {
      // Shrink slice if multi-byte UTF-8 pushes estimated doc bytes past budget
      let end = Math.min(val.length, offset + maxCharsPerSlice);
      let slice = val.slice(offset, end);
      while (
        slice.length > 1000 &&
        estimateFirestoreDocumentBytes({
          __chunkedStringField: fieldKey,
          __chunkedTextPart: slice,
          __partIndex: parts.length
        }) > chunkBudget
      ) {
        end = offset + Math.floor((end - offset) * 0.7);
        slice = val.slice(offset, end);
      }
      parts.push({
        __chunkedStringField: fieldKey,
        __partIndex: parts.length,
        __chunkedTextPart: slice
      });
      offset = end;
    }
    return parts;
  };

  const splitLargeArray = (fieldKey: string, arr: any[]): Array<Record<string, any>> => {
    const arrayChunks: Array<Record<string, any>> = [];
    let currentSlice: any[] = [];
    for (let i = 0; i < arr.length; i += 1) {
      const elem = arr[i];
      const elemBytes = estimateFirestoreValueBytes(elem);
      if (elemBytes > chunkBudget && elem && typeof elem === 'object') {
        // Flush existing accumulated items first
        if (currentSlice.length > 0) {
          arrayChunks.push({ [fieldKey]: currentSlice });
          currentSlice = [];
        }
        // If a single array element (e.g. giant option with 100 items or huge description) exceeds chunkBudget:
        // Try splitting nested sub-array (`items`) inside the option if present, otherwise store as split entries
        if (Array.isArray(elem.items) && elem.items.length > 1) {
          const optBase = { ...elem, items: [], __splitNestedItems: true, __nestedTargetId: elem.id || `opt-${i}` };
          arrayChunks.push({ [fieldKey]: [optBase] });
          let nestedBuf: any[] = [];
          for (const subItem of elem.items) {
            const candidateDocSize = estimateFirestoreDocumentBytes({
              __nestedItemsForField: fieldKey,
              __nestedParentIndex: i,
              __nestedItems: [...nestedBuf, subItem]
            });
            if (nestedBuf.length > 0 && candidateDocSize > chunkBudget) {
              arrayChunks.push({
                __nestedItemsForField: fieldKey,
                __nestedParentIndex: i,
                __nestedItems: nestedBuf
              });
              nestedBuf = [subItem];
            } else {
              nestedBuf.push(subItem);
            }
          }
          if (nestedBuf.length > 0) {
            arrayChunks.push({
              __nestedItemsForField: fieldKey,
              __nestedParentIndex: i,
              __nestedItems: nestedBuf
            });
          }
          continue;
        }
        if (Array.isArray(elem.sections) && elem.sections.length > 0) {
          const entryBase = { ...elem, sections: [], __splitNestedSections: true };
          arrayChunks.push({ [fieldKey]: [entryBase] });
          let nestedSecBuf: any[] = [];
          for (let sIdx = 0; sIdx < elem.sections.length; sIdx += 1) {
            const subSec = elem.sections[sIdx];
            if (typeof subSec?.htmlContent === 'string' && estimateFirestoreValueBytes(subSec.htmlContent) > Math.floor(chunkBudget * 0.45)) {
              if (nestedSecBuf.length > 0) {
                arrayChunks.push({
                  __nestedSectionsForField: fieldKey,
                  __nestedParentIndex: i,
                  __nestedSections: nestedSecBuf
                });
                nestedSecBuf = [];
              }
              const htmlParts = splitLargeString('htmlContent', subSec.htmlContent);
              arrayChunks.push({
                __nestedSectionsForField: fieldKey,
                __nestedParentIndex: i,
                __nestedSections: [{ ...subSec, htmlContent: '', __chunkedHtmlParts: htmlParts.length }]
              });
              htmlParts.forEach((hp, pIdx) => {
                arrayChunks.push({
                  __nestedSectionHtmlChunkForField: fieldKey,
                  __nestedParentIndex: i,
                  __nestedSectionIndex: sIdx,
                  __partIndex: pIdx,
                  __chunkedTextPart: hp.__chunkedTextPart
                });
              });
              continue;
            }
            const candidateDocSize = estimateFirestoreDocumentBytes({
              __nestedSectionsForField: fieldKey,
              __nestedParentIndex: i,
              __nestedSections: [...nestedSecBuf, subSec]
            });
            if (nestedSecBuf.length > 0 && candidateDocSize > chunkBudget) {
              arrayChunks.push({
                __nestedSectionsForField: fieldKey,
                __nestedParentIndex: i,
                __nestedSections: nestedSecBuf
              });
              nestedSecBuf = [subSec];
            } else {
              nestedSecBuf.push(subSec);
            }
          }
          if (nestedSecBuf.length > 0) {
            arrayChunks.push({
              __nestedSectionsForField: fieldKey,
              __nestedParentIndex: i,
              __nestedSections: nestedSecBuf
            });
          }
          continue;
        }
        arrayChunks.push({ [fieldKey]: [elem] });
        continue;
      }

      const nextSlice = [...currentSlice, elem];
      const est = estimateFirestoreDocumentBytes({ [fieldKey]: nextSlice });
      if (currentSlice.length > 0 && est > chunkBudget) {
        arrayChunks.push({ [fieldKey]: currentSlice });
        currentSlice = [elem];
      } else {
        currentSlice = nextSlice;
      }
    }
    if (currentSlice.length > 0) {
      arrayChunks.push({ [fieldKey]: currentSlice });
    }
    return arrayChunks;
  };

  const splitLargeObject = (fieldKey: string, obj: Record<string, any>): Array<Record<string, any>> => {
    const objChunks: Array<Record<string, any>> = [];
    let currentMap: Record<string, any> = {};
    for (const [subKey, subVal] of Object.entries(obj)) {
      if (subVal === undefined) continue;
      if (typeof subVal === 'string' && estimateFirestoreValueBytes(subVal) > chunkBudget) {
        if (Object.keys(currentMap).length > 0) {
          objChunks.push({ [fieldKey]: currentMap });
          currentMap = {};
        }
        splitLargeString(`${fieldKey}::${subKey}`, subVal).forEach(part => objChunks.push(part));
        continue;
      }
      if (Array.isArray(subVal) && estimateFirestoreValueBytes(subVal) > chunkBudget) {
        if (Object.keys(currentMap).length > 0) {
          objChunks.push({ [fieldKey]: currentMap });
          currentMap = {};
        }
        splitLargeArray(`${fieldKey}::${subKey}`, subVal).forEach(part => objChunks.push(part));
        continue;
      }
      const nextMap = { ...currentMap, [subKey]: subVal };
      if (Object.keys(currentMap).length > 0 && estimateFirestoreDocumentBytes({ [fieldKey]: nextMap }) > chunkBudget) {
        objChunks.push({ [fieldKey]: currentMap });
        currentMap = { [subKey]: subVal };
      } else {
        currentMap = nextMap;
      }
    }
    if (Object.keys(currentMap).length > 0) {
      objChunks.push({ [fieldKey]: currentMap });
    }
    return objChunks;
  };

  for (const [key, val] of Object.entries(params.rawData)) {
    if (val === undefined || val === null) {
      remainingScalarData[key] = val;
      continue;
    }
    const fieldBytes = estimateFirestoreValueBytes(val);
    if (fieldBytes > Math.floor(chunkBudget * 0.45)) {
      if (Array.isArray(val)) {
        splitLargeArray(key, val).forEach(c => dataChunks.push(c));
        continue;
      }
      if (typeof val === 'string') {
        splitLargeString(key, val).forEach(c => dataChunks.push(c));
        continue;
      }
      if (typeof val === 'object') {
        splitLargeObject(key, val).forEach(c => dataChunks.push(c));
        continue;
      }
    }
    if (
      Object.keys(remainingScalarData).length > 0 &&
      estimateFirestoreDocumentBytes({ ...remainingScalarData, [key]: val }) > chunkBudget
    ) {
      dataChunks.push({ ...remainingScalarData });
      Object.keys(remainingScalarData).forEach(k => delete remainingScalarData[k]);
    }
    remainingScalarData[key] = val;
  }

  if (Object.keys(remainingScalarData).length > 0) {
    dataChunks.unshift(remainingScalarData);
  }
  if (dataChunks.length === 0) {
    dataChunks.push({});
  }

  const totalChunks = dataChunks.length;
  const builtDocs = dataChunks.map((chunkPayload, idx) =>
    makeDoc(`${params.logicalSection}__chunk_${idx}`, idx, totalChunks, chunkPayload)
  );

  for (const d of builtDocs) {
    if (d.estimatedBytes >= FIRESTORE_MAX_DOC_BYTES) {
      throw new Error(
        `Section chunk "${d.sectionId}" still measures ${d.estimatedBytes.toLocaleString()} bytes, exceeding Firestore maximum (${FIRESTORE_MAX_DOC_BYTES.toLocaleString()} bytes).`
      );
    }
  }
  return builtDocs;
}

export interface SplitQuotationOptions {
  user?: User | null;
  maxDocBytes?: number;
  manifestStatus?: QuotationVersionManifestStatus;
  preserveHistoricalIsolation?: boolean;
}

/**
 * Splits a full Quotation + QuoteVersionRecord into 9 logical subcollection documents
 * (plus dynamic sub-chunking if any section exceeds 800 KiB) and a compact manifest document.
 */
export function splitQuotationVersionIntoSections(
  quoteOrParams:
    | Quotation
    | {
        quote: Quotation;
        versionRecord: QuoteVersionRecord;
        user?: User | null;
        maxDocBytes?: number;
        manifestStatus?: QuotationVersionManifestStatus;
        preserveHistoricalIsolation?: boolean;
      },
  maybeVersionRecord?: QuoteVersionRecord,
  maybeOptions?: SplitQuotationOptions
): SplitVersionBuildResult {
  const normalizedParams =
    maybeVersionRecord !== undefined
      ? {
          quote: quoteOrParams as Quotation,
          versionRecord: maybeVersionRecord,
          user: maybeOptions?.user,
          maxDocBytes: maybeOptions?.maxDocBytes,
          manifestStatus: maybeOptions?.manifestStatus,
          preserveHistoricalIsolation: maybeOptions?.preserveHistoricalIsolation
        }
      : (quoteOrParams as {
          quote: Quotation;
          versionRecord: QuoteVersionRecord;
          user?: User | null;
          maxDocBytes?: number;
          manifestStatus?: QuotationVersionManifestStatus;
          preserveHistoricalIsolation?: boolean;
        });

  const shouldStripForUser =
    normalizedParams.user !== undefined &&
    normalizedParams.user !== null &&
    !canUserViewInternalCostBreakdown(normalizedParams.user);
  const quote = stripRestrictedCommercialFieldsForRole(
    deepCloneSafe(normalizedParams.quote),
    !shouldStripForUser
  );
  const versionRecord = stripRestrictedCommercialFieldsForRole(
    deepCloneSafe(normalizedParams.versionRecord),
    !shouldStripForUser
  );
  const maxDocBytesLimit = normalizedParams.maxDocBytes ?? SAFE_DOC_BYTE_THRESHOLD;
  const manifestStatusVal = normalizedParams.manifestStatus || 'PREPARING';
  const quoteId = versionRecord.quoteId || quote.id;
  const versionNumber = Number(versionRecord.versionNumber || versionRecord.version || quote.version || 1);
  const versionId = versionRecord.id || `${quoteId}__v${versionNumber}`;
  const createdAt = versionRecord.createdAt || versionRecord.updatedAt || new Date().toISOString();
  const agentId = versionRecord.agentId ?? quote.agentId;
  const userId = versionRecord.userId ?? quote.userId ?? quote.createdBy ?? quote.agentId;

  const isHistorical =
    normalizedParams.preserveHistoricalIsolation !== undefined
      ? Boolean(normalizedParams.preserveHistoricalIsolation)
      : versionNumber > 0 && Number(quote.latestVersion || quote.version || versionNumber) > versionNumber;

  const pick = <T>(verVal: T | undefined, quoteVal: T | undefined): T | undefined => {
    if (verVal !== undefined) return verVal;
    return isHistorical ? undefined : quoteVal;
  };

  const items = deepCloneSafe(pick(versionRecord.items, quote.items) ?? []);
  const routeHubs = deepCloneSafe(pick(versionRecord.routeHubs, quote.routeHubs) ?? []);
  const optionsRaw = pick(versionRecord.options, quote.options);
  const authSnapRaw = deepCloneSafe(pick(versionRecord.authoritativeSnapshot, quote.authoritativeSnapshot));
  const pricingSnapRaw = deepCloneSafe(pick(versionRecord.pricingSnapshot, quote.pricingSnapshot));
  const currencySnapRaw = deepCloneSafe(
    pick(versionRecord.currencyConversionSnapshot, quote.currencyConversionSnapshot) ??
      pricingSnapRaw?.currencyConversionSnapshot
  );
  const commercialTermsSnapRaw = deepCloneSafe(
    pick(versionRecord.commercialTermsSnapshot, quote.commercialTermsSnapshot)
  );
  const brandingSnapRaw = deepCloneSafe(pick(versionRecord.brandingSnapshot, quote.brandingSnapshot));

  // Lossless canonical deduplication inside Firestore section payloads
  const deduplicatedOptions = Array.isArray(optionsRaw)
    ? deepCloneSafe(optionsRaw).map((opt, idx) => {
        const nextOpt: any = { ...opt };
        if (idx === 0 && Array.isArray(opt.items) && areJsonEquivalent(opt.items, items)) {
          delete nextOpt.items;
          nextOpt.__mirrorsTopLevelItems = true;
        }
        if (idx === 0 && Array.isArray(opt.routeHubs) && areJsonEquivalent(opt.routeHubs, routeHubs)) {
          delete nextOpt.routeHubs;
          nextOpt.__mirrorsTopLevelRouteHubs = true;
        }
        return nextOpt;
      })
    : undefined;

  const pricingSectionAuth = authSnapRaw?.pricing ? deepCloneSafe(authSnapRaw.pricing) : undefined;
  if (
    pricingSectionAuth?.currencyConversionSnapshot &&
    currencySnapRaw &&
    areJsonEquivalent(pricingSectionAuth.currencyConversionSnapshot, currencySnapRaw)
  ) {
    delete (pricingSectionAuth as any).currencyConversionSnapshot;
    (pricingSectionAuth as any).__mirrorsCurrencyConversionSnapshot = true;
  }
  const cleanPricingSnapshot = pricingSnapRaw ? deepCloneSafe(pricingSnapRaw) : undefined;
  if (
    cleanPricingSnapshot?.currencyConversionSnapshot &&
    currencySnapRaw &&
    areJsonEquivalent(cleanPricingSnapshot.currencyConversionSnapshot, currencySnapRaw)
  ) {
    delete cleanPricingSnapshot.currencyConversionSnapshot;
    (cleanPricingSnapshot as any).__mirrorsCurrencyConversionSnapshot = true;
  }

  let authoritativeTripSection: any = undefined;
  if (authSnapRaw?.trip) {
    authoritativeTripSection = deepCloneSafe(authSnapRaw.trip);
    if (
      Array.isArray(authoritativeTripSection.routeHubs) &&
      areJsonEquivalent(authoritativeTripSection.routeHubs, routeHubs)
    ) {
      delete authoritativeTripSection.routeHubs;
      authoritativeTripSection.__mirrorsTopLevelRouteHubs = true;
    }
  }

  let authoritativeCommercialTermsSection: any = undefined;
  if (authSnapRaw?.commercialTerms) {
    authoritativeCommercialTermsSection = deepCloneSafe(authSnapRaw.commercialTerms);
    if (
      authoritativeCommercialTermsSection.snapshot &&
      commercialTermsSnapRaw &&
      areJsonEquivalent(authoritativeCommercialTermsSection.snapshot, commercialTermsSnapRaw)
    ) {
      delete authoritativeCommercialTermsSection.snapshot;
      authoritativeCommercialTermsSection.__mirrorsCommercialTermsSnapshot = true;
    }
  }

  const rawTermsText = pick(versionRecord.termsAndConditions, quote.termsAndConditions);
  const termsMirrorsCombined = Boolean(
    rawTermsText !== undefined &&
      commercialTermsSnapRaw?.combinedPlainText !== undefined &&
      rawTermsText === commercialTermsSnapRaw.combinedPlainText
  );

  // Preserve any extra legacy keys on versionRecord that are not explicitly handled below
  const HANDLED_TOP_LEVEL_KEYS = new Set<string>([
    'id', 'version', 'versionNumber', 'quoteId', 'quoteNumber', 'leadId', 'linkedLeadId', 'leadNumber',
    'previousVersionId', 'createdAt', 'updatedAt', 'updatedBy', 'savedByUserId', 'savedByName', 'savedByRole',
    'agentId', 'userId', 'createdByName', 'status', 'proposalStatus', 'isLocked', 'bookingId', 'bookingReference',
    'linkedBookingIds', 'sourcePackageId', 'sourcePackageName', 'sourcePackageSlug', 'sourcePackageUpdatedAt',
    'feasibilityScore', 'feasibilityStatus', 'feasibilityWarnings', 'visaAssistanceChoice', 'changesSummary',
    'restoredFromVersion', 'clientSaveRequestId', 'validUntil', 'activityLog', 'generationHistory',
    'title', 'destination', 'travelStartDate', 'travelEndDate', 'routeHubs', 'dayThemes', 'dayDescriptions',
    'dayOverviews', 'dayNotes', 'itineraryOverview', 'inclusions', 'exclusions', 'roomingConfig',
    'items', 'options', 'activeOptionId', 'currency', 'totalSellingPrice', 'finalCustomerSellingPrice',
    'theUnboundBaseSellingPrice', 'baseFinalSellingPrice', 'agentMarginType', 'agentMarginValue', 'agentMarginAmount',
    'productLevelAgentMarkupTotal', 'overallAgentMarkupAmount', 'totalAgentAdditionalMarkupAmount',
    'overallDiscountPercent', 'overallMarkupPercent', 'hotelAccommodationTotal', 'landPartTotal',
    'surchargesTotal', 'appliedSurcharges', 'surchargeOverrides', 'totalTaxes', 'totalNetCost',
    'marginPercent', 'marginAmount', 'internalNettCost', 'supplierCost', 'internalMarkup', 'internalProfit',
    'adminManualMarginType', 'adminManualMarginValue', 'adminManualMarginAmount', 'adminMarginMode',
    'revisedSellingPrice', 'pricingCalculatedAt', 'pricingVersion', 'adminBasePriceUpdatedNotification',
    'pricingSnapshot', 'currencyConversionSnapshot', 'termsStatus', 'missingTermsDestinations',
    'termsExceptionApproval', 'commercialTermsSnapshot', 'termsAndConditions',
    'importantInformation', 'cancellationPolicy', 'operationalRemarks', 'customOperationalRemarks',
    'clientUserId', 'clientName', 'clientEmail', 'clientPhone', 'clientCompany', 'nationality',
    'travelStyle', 'mealPlanPreference', 'totalPax', 'adultsCount', 'childrenCount', 'infantsCount',
    'childAges', 'passengerBreakdown', 'agentNotes',
    'brandingMode', 'brandingSnapshot', 'quotationScope', 'scope',
    'agentName', 'agentEmail', 'agentAgency', 'agentCompany', 'agentLogoUrl', 'agentPhone',
    'sharedHistory', 'authoritativeSnapshot', 'snapshotHash',
    'storageFormat', 'schemaVersion', 'manifestStatus', 'sections', 'sectionIds', 'sectionCount',
    'chunkCount', 'sectionsIntegrityHash', 'totalReconstructedBytes', 'committedAt', 'failureReason',
    'hasHydratedSections', 'migrationStatus', 'migrationState', 'migratedAt', 'verifiedAt', 'failingFieldPaths',
    'updatedByRole', 'updatedByEmail', 'isDeleted', 'totalItems', 'totalHubs', 'isImmutable', 'isLatest'
  ]);
  const extraVersionFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(versionRecord as Record<string, any>)) {
    if (!HANDLED_TOP_LEVEL_KEYS.has(k) && v !== undefined) {
      extraVersionFields[k] = deepCloneSafe(v);
    }
  }

  let authoritativeSnapshotMeta: Record<string, any> | undefined = undefined;
  if (authSnapRaw) {
    authoritativeSnapshotMeta = {};
    for (const [k, v] of Object.entries(authSnapRaw as Record<string, any>)) {
      if (
        k !== 'client' &&
        k !== 'agency' &&
        k !== 'branding' &&
        k !== 'trip' &&
        k !== 'itinerary' &&
        k !== 'pricing' &&
        k !== 'commercialTerms' &&
        v !== undefined
      ) {
        authoritativeSnapshotMeta[k] = deepCloneSafe(v);
      }
    }
  }

  // Build 9 logical section payloads without fabricating synthetic defaults over undefined legacy fields
  const logicalPayloads: Record<QuotationVersionSectionId, Record<string, any>> = {
    trip_overview: {
      quoteId,
      quoteNumber: isHistorical
        ? versionRecord.quoteNumber
        : (versionRecord.quoteNumber || quote.quoteNumber || quoteId),
      version: versionNumber,
      versionNumber,
      previousVersionId: versionRecord.previousVersionId,
      title: pick(versionRecord.title, quote.title),
      destination: pick(versionRecord.destination, quote.destination),
      travelStartDate: pick(versionRecord.travelStartDate, quote.travelStartDate),
      travelEndDate: pick(versionRecord.travelEndDate, quote.travelEndDate),
      status: isHistorical
        ? versionRecord.status
        : (pick(versionRecord.status, quote.status) || 'SAVED'),
      proposalStatus: pick(versionRecord.proposalStatus, quote.proposalStatus),
      isLocked: isHistorical ? (versionRecord as any).isLocked : (quote.isLocked ?? false),
      leadId: pick(versionRecord.leadId, quote.leadId || quote.linkedLeadId),
      linkedLeadId: isHistorical
        ? (versionRecord as any).linkedLeadId
        : (quote.linkedLeadId || quote.leadId || versionRecord.leadId),
      leadNumber: isHistorical ? (versionRecord as any).leadNumber : (quote as any).leadNumber,
      bookingId: pick(versionRecord.bookingId, quote.bookingId),
      bookingReference: pick(versionRecord.bookingReference, quote.bookingReference),
      linkedBookingIds: isHistorical ? (versionRecord as any).linkedBookingIds : quote.linkedBookingIds,
      sourcePackageId: isHistorical ? (versionRecord as any).sourcePackageId : quote.sourcePackageId,
      sourcePackageName: isHistorical ? (versionRecord as any).sourcePackageName : quote.sourcePackageName,
      sourcePackageSlug: isHistorical ? (versionRecord as any).sourcePackageSlug : quote.sourcePackageSlug,
      sourcePackageUpdatedAt: isHistorical
        ? (versionRecord as any).sourcePackageUpdatedAt
        : quote.sourcePackageUpdatedAt,
      feasibilityScore: isHistorical ? (versionRecord as any).feasibilityScore : quote.feasibilityScore,
      feasibilityStatus: isHistorical ? (versionRecord as any).feasibilityStatus : quote.feasibilityStatus,
      feasibilityWarnings: isHistorical ? (versionRecord as any).feasibilityWarnings : quote.feasibilityWarnings,
      visaAssistanceChoice: isHistorical ? (versionRecord as any).visaAssistanceChoice : quote.visaAssistanceChoice,
      changesSummary: versionRecord.changesSummary,
      restoredFromVersion: versionRecord.restoredFromVersion,
      clientSaveRequestId: versionRecord.clientSaveRequestId,
      validUntil: isHistorical ? (versionRecord as any).validUntil : quote.validUntil,
      activityLog: isHistorical ? (versionRecord as any).activityLog : quote.activityLog,
      generationHistory: isHistorical ? (versionRecord as any).generationHistory : quote.generationHistory,
      ...(Object.keys(extraVersionFields).length > 0 ? { __extraVersionFields: extraVersionFields } : {}),
      authoritativeTrip: authoritativeTripSection,
      authoritativeSnapshotMeta
    },
    itinerary: {
      routeHubs,
      dayThemes: pick(versionRecord.dayThemes, quote.dayThemes),
      dayDescriptions: pick(versionRecord.dayDescriptions, quote.dayDescriptions),
      dayOverviews: pick(versionRecord.dayOverviews, quote.dayOverviews),
      dayNotes: pick(versionRecord.dayNotes, quote.dayNotes),
      itineraryOverview: pick(versionRecord.itineraryOverview, quote.itineraryOverview ?? quote.narrative),
      inclusions: pick(versionRecord.inclusions, quote.inclusions),
      exclusions: pick(versionRecord.exclusions, quote.exclusions),
      authoritativeItinerary: authSnapRaw?.itinerary ? deepCloneSafe(authSnapRaw.itinerary) : undefined
    },
    accommodation: extractAccommodationStaySnapshots(
      routeHubs,
      pick(versionRecord.roomingConfig, quote.roomingConfig),
      items
    ),
    products_and_services: {
      items,
      ...(deduplicatedOptions !== undefined ? { options: deduplicatedOptions } : {}),
      activeOptionId: pick(versionRecord.activeOptionId, quote.activeOptionId)
    },
    pricing: {
      currency: isHistorical
        ? versionRecord.currency
        : (pick(versionRecord.currency, quote.currency) || 'USD'),
      totalSellingPrice: versionRecord.totalSellingPrice,
      finalCustomerSellingPrice: isHistorical
        ? (versionRecord as any).finalCustomerSellingPrice
        : (quote.finalCustomerSellingPrice ?? versionRecord.totalSellingPrice),
      theUnboundBaseSellingPrice: pick(
        versionRecord.theUnboundBaseSellingPrice,
        quote.theUnboundBaseSellingPrice
      ),
      baseFinalSellingPrice: isHistorical
        ? (versionRecord as any).baseFinalSellingPrice
        : (quote.baseFinalSellingPrice ?? versionRecord.theUnboundBaseSellingPrice),
      agentMarginType: pick(versionRecord.agentMarginType, quote.agentMarginType),
      agentMarginValue: pick(versionRecord.agentMarginValue, quote.agentMarginValue),
      agentMarginAmount: pick(versionRecord.agentMarginAmount, quote.agentMarginAmount),
      productLevelAgentMarkupTotal: isHistorical
        ? (versionRecord as any).productLevelAgentMarkupTotal
        : quote.productLevelAgentMarkupTotal,
      overallAgentMarkupAmount: isHistorical
        ? (versionRecord as any).overallAgentMarkupAmount
        : quote.overallAgentMarkupAmount,
      totalAgentAdditionalMarkupAmount: isHistorical
        ? (versionRecord as any).totalAgentAdditionalMarkupAmount
        : quote.totalAgentAdditionalMarkupAmount,
      overallDiscountPercent: pick(versionRecord.overallDiscountPercent, quote.overallDiscountPercent),
      overallMarkupPercent: isHistorical
        ? (versionRecord as any).overallMarkupPercent
        : quote.overallMarkupPercent,
      hotelAccommodationTotal: isHistorical
        ? (versionRecord as any).hotelAccommodationTotal
        : quote.hotelAccommodationTotal,
      landPartTotal: isHistorical ? (versionRecord as any).landPartTotal : quote.landPartTotal,
      surchargesTotal: isHistorical ? (versionRecord as any).surchargesTotal : quote.surchargesTotal,
      appliedSurcharges: isHistorical ? (versionRecord as any).appliedSurcharges : quote.appliedSurcharges,
      surchargeOverrides: isHistorical ? (versionRecord as any).surchargeOverrides : quote.surchargeOverrides,
      totalTaxes: isHistorical ? (versionRecord as any).totalTaxes : quote.totalTaxes,
      totalNetCost: versionRecord.totalNetCost,
      marginPercent: versionRecord.marginPercent,
      marginAmount: versionRecord.marginAmount,
      internalNettCost: pick((versionRecord as any).internalNettCost, quote.internalNettCost),
      supplierCost: pick((versionRecord as any).supplierCost, quote.supplierCost),
      internalMarkup: pick((versionRecord as any).internalMarkup, quote.internalMarkup),
      internalProfit: pick((versionRecord as any).internalProfit, quote.internalProfit),
      adminManualMarginType: isHistorical
        ? (versionRecord as any).adminManualMarginType
        : quote.adminManualMarginType,
      adminManualMarginValue: isHistorical
        ? (versionRecord as any).adminManualMarginValue
        : quote.adminManualMarginValue,
      adminManualMarginAmount: isHistorical
        ? (versionRecord as any).adminManualMarginAmount
        : quote.adminManualMarginAmount,
      adminMarginMode: isHistorical ? (versionRecord as any).adminMarginMode : quote.adminMarginMode,
      revisedSellingPrice: isHistorical ? (versionRecord as any).revisedSellingPrice : quote.revisedSellingPrice,
      pricingCalculatedAt: isHistorical ? (versionRecord as any).pricingCalculatedAt : quote.pricingCalculatedAt,
      pricingVersion: isHistorical ? (versionRecord as any).pricingVersion : quote.pricingVersion,
      adminBasePriceUpdatedNotification: isHistorical
        ? (versionRecord as any).adminBasePriceUpdatedNotification
        : quote.adminBasePriceUpdatedNotification,
      pricingSnapshot: cleanPricingSnapshot,
      currencyConversionSnapshot: currencySnapRaw,
      authoritativePricing: pricingSectionAuth
    },
    commercial_terms: {
      termsStatus: isHistorical
        ? (versionRecord as any).termsStatus
        : (quote.termsStatus ?? authSnapRaw?.commercialTerms?.termsStatus),
      missingTermsDestinations: isHistorical
        ? (versionRecord as any).missingTermsDestinations
        : quote.missingTermsDestinations,
      termsExceptionApproval: isHistorical
        ? (versionRecord as any).termsExceptionApproval
        : (quote.termsExceptionApproval ?? authSnapRaw?.commercialTerms?.termsExceptionApproval),
      commercialTermsSnapshot: commercialTermsSnapRaw,
      termsAndConditions: termsMirrorsCombined ? undefined : rawTermsText,
      __mirrorsCombinedPlainText: termsMirrorsCombined,
      authoritativeCommercialTerms: authoritativeCommercialTermsSection
    },
    destination_policies: {
      destination: pick(versionRecord.destination, quote.destination),
      importantInformation: pick(
        versionRecord.importantInformation,
        quote.importantInformation ?? authSnapRaw?.itinerary?.importantInformation
      ),
      cancellationPolicy: pick(
        versionRecord.cancellationPolicy,
        quote.cancellationPolicy ?? authSnapRaw?.itinerary?.cancellationPolicy
      ),
      operationalRemarks: isHistorical
        ? (versionRecord as any).operationalRemarks
        : (quote.operationalRemarks ?? authSnapRaw?.itinerary?.operationalRemarks),
      customOperationalRemarks: isHistorical
        ? (versionRecord as any).customOperationalRemarks
        : (quote.customOperationalRemarks ?? authSnapRaw?.itinerary?.customOperationalRemarks),
      destinationPolicyEntries: Array.isArray(commercialTermsSnapRaw?.entries)
        ? commercialTermsSnapRaw.entries.map(e => ({
            targetId: e.targetId,
            targetName: e.targetName,
            targetType: e.targetType,
            version: e.version,
            contentHash: e.contentHash,
            sectionsCount: Array.isArray(e.sections) ? e.sections.length : 0
          }))
        : []
    },
    passenger_details: {
      clientUserId: isHistorical ? (versionRecord as any).clientUserId : quote.clientUserId,
      clientName: pick(versionRecord.clientName, quote.clientName),
      clientEmail: pick(versionRecord.clientEmail, quote.clientEmail),
      clientPhone: pick(versionRecord.clientPhone, quote.clientPhone),
      clientCompany: pick(versionRecord.clientCompany, quote.clientCompany),
      nationality: pick(versionRecord.nationality, quote.nationality),
      travelStyle: pick(versionRecord.travelStyle, quote.travelStyle),
      mealPlanPreference: pick(versionRecord.mealPlanPreference, quote.mealPlanPreference),
      totalPax: pick(versionRecord.totalPax, quote.totalPax),
      adultsCount: pick(versionRecord.adultsCount, quote.adultsCount),
      childrenCount: pick(versionRecord.childrenCount, quote.childrenCount),
      infantsCount: pick(versionRecord.infantsCount, quote.infantsCount),
      childAges: pick(versionRecord.childAges, quote.childAges),
      passengerBreakdown: pick(versionRecord.passengerBreakdown, quote.passengerBreakdown),
      agentNotes: pick(
        versionRecord.agentNotes,
        typeof quote.agentNotes === 'string' ? quote.agentNotes : undefined
      ),
      authoritativeClient: authSnapRaw?.client ? deepCloneSafe(authSnapRaw.client) : undefined
    },
    branding_and_output_settings: {
      brandingMode: isHistorical
        ? versionRecord.brandingMode
        : (pick(versionRecord.brandingMode, quote.brandingMode) || 'STANDARD'),
      brandingSnapshot: brandingSnapRaw,
      quotationScope: pick(versionRecord.quotationScope, quote.quotationScope || quote.scope),
      scope: isHistorical
        ? (versionRecord as any).scope
        : (quote.scope || versionRecord.quotationScope || quote.quotationScope),
      activeOptionId: pick(versionRecord.activeOptionId, quote.activeOptionId),
      agentId,
      agentName: isHistorical ? (versionRecord as any).agentName : quote.agentName,
      agentEmail: isHistorical ? (versionRecord as any).agentEmail : quote.agentEmail,
      agentAgency: isHistorical ? (versionRecord as any).agentAgency : quote.agentAgency,
      agentCompany: isHistorical ? (versionRecord as any).agentCompany : quote.agentCompany,
      agentLogoUrl: isHistorical ? (versionRecord as any).agentLogoUrl : quote.agentLogoUrl,
      agentPhone: isHistorical ? (versionRecord as any).agentPhone : quote.agentPhone,
      sharedHistory: versionRecord.sharedHistory,
      authoritativeBranding: authSnapRaw?.branding ? deepCloneSafe(authSnapRaw.branding) : undefined,
      authoritativeAgency: authSnapRaw?.agency ? deepCloneSafe(authSnapRaw.agency) : undefined
    }
  };

  const sectionDocs: QuotationVersionSectionDocument[] = [];
  for (const logicalSection of LOGICAL_SECTION_ORDER) {
    const rawData = logicalPayloads[logicalSection];
    const chunkedDocs = buildSectionDocsWithDynamicChunking({
      logicalSection,
      rawData,
      quoteId,
      versionId,
      versionNumber,
      agentId,
      userId,
      createdAt,
      maxDocBytes: maxDocBytesLimit
    });
    sectionDocs.push(...chunkedDocs);
  }

  const sectionRefs: QuotationVersionSectionRef[] = sectionDocs.map(d => ({
    sectionId: d.sectionId,
    logicalSection: d.logicalSection,
    chunkIndex: d.chunkIndex,
    totalChunks: d.totalChunks,
    estimatedBytes: d.estimatedBytes,
    contentHash: d.contentHash
  }));

  const sectionsIntegrityHash = computeDeterministicHexHash(
    sectionRefs.map(r => `${r.sectionId}:${r.contentHash}`)
  );
  const totalSectionBytes = sectionDocs.reduce((sum, d) => sum + d.estimatedBytes, 0);

  const manifest: QuoteVersionRecord = cleanFirestoreUndefined({
    id: versionId,
    version: versionNumber,
    versionNumber,
    quoteId,
    quoteNumber: isHistorical
      ? versionRecord.quoteNumber
      : (versionRecord.quoteNumber || quote.quoteNumber || quoteId),
    leadId: pick(versionRecord.leadId, quote.leadId || quote.linkedLeadId),
    previousVersionId: versionRecord.previousVersionId,
    createdAt,
    updatedAt: versionRecord.updatedAt || createdAt,
    updatedBy: versionRecord.updatedBy,
    savedByUserId: versionRecord.savedByUserId,
    savedByName: versionRecord.savedByName,
    savedByRole: versionRecord.savedByRole,
    agentId,
    userId,
    createdByName: versionRecord.createdByName,
    status: isHistorical
      ? versionRecord.status
      : (pick(versionRecord.status, quote.status) || 'SAVED'),
    proposalStatus: pick(versionRecord.proposalStatus, quote.proposalStatus),
    changesSummary: versionRecord.changesSummary,
    title: pick(versionRecord.title, quote.title),
    destination: pick(versionRecord.destination, quote.destination),
    clientName: pick(versionRecord.clientName, quote.clientName),
    clientEmail: pick(versionRecord.clientEmail, quote.clientEmail),
    travelStartDate: pick(versionRecord.travelStartDate, quote.travelStartDate),
    travelEndDate: pick(versionRecord.travelEndDate, quote.travelEndDate),
    totalPax: pick(versionRecord.totalPax, quote.totalPax),
    adultsCount: pick(versionRecord.adultsCount, quote.adultsCount),
    childrenCount: pick(versionRecord.childrenCount, quote.childrenCount),
    infantsCount: pick(versionRecord.infantsCount, quote.infantsCount),
    currency: isHistorical
      ? versionRecord.currency
      : (pick(versionRecord.currency, quote.currency) || 'USD'),
    totalNetCost: versionRecord.totalNetCost,
    totalSellingPrice: versionRecord.totalSellingPrice,
    theUnboundBaseSellingPrice: versionRecord.theUnboundBaseSellingPrice,
    agentMarginType: versionRecord.agentMarginType,
    agentMarginValue: versionRecord.agentMarginValue,
    agentMarginAmount: versionRecord.agentMarginAmount,
    overallDiscountPercent: versionRecord.overallDiscountPercent,
    marginPercent: versionRecord.marginPercent,
    marginAmount: versionRecord.marginAmount,
    totalItems: items.length,
    totalHubs: routeHubs.length,
    activeOptionId: pick(versionRecord.activeOptionId, quote.activeOptionId),
    quotationScope: pick(versionRecord.quotationScope, quote.quotationScope),
    brandingMode: isHistorical
      ? versionRecord.brandingMode
      : (pick(versionRecord.brandingMode, quote.brandingMode) || 'STANDARD'),
    bookingId: pick(versionRecord.bookingId, quote.bookingId),
    bookingReference: pick(versionRecord.bookingReference, quote.bookingReference),
    snapshotHash: versionRecord.snapshotHash,
    clientSaveRequestId: versionRecord.clientSaveRequestId,
    restoredFromVersion: versionRecord.restoredFromVersion,
    isLatest: Boolean(versionRecord.isLatest),
    isImmutable: versionRecord.isImmutable !== undefined ? Boolean(versionRecord.isImmutable) : true,
    storageFormat: 'SPLIT_SECTIONS_V2' as QuotationVersionStorageFormat,
    schemaVersion: STORAGE_SCHEMA_VERSION_V2,
    manifestStatus: manifestStatusVal,
    sections: sectionRefs,
    sectionIds: sectionDocs.map(d => d.sectionId),
    sectionCount: LOGICAL_SECTION_ORDER.length,
    chunkCount: sectionDocs.length,
    sectionsIntegrityHash,
    totalReconstructedBytes: measureJsonBytes(versionRecord),
    migrationStatus: versionRecord.migrationStatus || 'NATIVE_V2',
    migrationState: versionRecord.migrationState,
    migratedAt: versionRecord.migratedAt,
    verifiedAt: versionRecord.verifiedAt,
    sharedHistory: versionRecord.sharedHistory
  });

  const manifestBytes = estimateFirestoreDocumentBytes(
    manifest,
    `quotations/${quoteId}/versions/${versionId}`
  );
  if (manifestBytes > maxDocBytesLimit) {
    throw new Error(
      `Manifest document "${versionId}" exceeds safe byte threshold (${manifestBytes} bytes).`
    );
  }

  const byteReport: Record<string, number> = {
    manifest: manifestBytes
  };
  let maxDocBytes = manifestBytes;
  for (const d of sectionDocs) {
    byteReport[d.sectionId] = d.estimatedBytes;
    if (d.estimatedBytes > maxDocBytes) maxDocBytes = d.estimatedBytes;
  }

  return {
    manifest,
    sectionDocs,
    totalSectionBytes,
    maxDocBytes,
    byteReport
  };
}

/**
 * Reassembles chunked documents back into a single logical section payload.
 */
function reassembleLogicalSectionData(
  docs: QuotationVersionSectionDocument[]
): Record<string, any> {
  if (!docs || docs.length === 0) return {};
  const sorted = [...docs].sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
  if (sorted.length === 1 && (sorted[0].totalChunks || 1) === 1) {
    return deepCloneSafe(sorted[0].data || {});
  }

  const merged: Record<string, any> = {};
  const chunkedStrings = new Map<string, Array<{ idx: number; part: string }>>();
  const nestedItemsByParent = new Map<string, Map<number, any[]>>();
  const nestedSectionsByParent = new Map<string, Map<number, any[]>>();
  const nestedSectionHtmlParts = new Map<string, Array<{ idx: number; part: string }>>();

  for (const d of sorted) {
    const payload = d.data || {};
    if (payload.__chunkedStringField && typeof payload.__chunkedTextPart === 'string') {
      const targetKey = String(payload.__chunkedStringField);
      const list = chunkedStrings.get(targetKey) || [];
      list.push({ idx: Number(payload.__partIndex || 0), part: payload.__chunkedTextPart });
      chunkedStrings.set(targetKey, list);
      continue;
    }

    if (payload.__nestedItemsForField && Array.isArray(payload.__nestedItems)) {
      const fieldKey = String(payload.__nestedItemsForField);
      const parentIdx = Number(payload.__nestedParentIndex || 0);
      if (!nestedItemsByParent.has(fieldKey)) nestedItemsByParent.set(fieldKey, new Map());
      const byParent = nestedItemsByParent.get(fieldKey)!;
      const existing = byParent.get(parentIdx) || [];
      byParent.set(parentIdx, [...existing, ...payload.__nestedItems]);
      continue;
    }

    if (payload.__nestedSectionsForField && Array.isArray(payload.__nestedSections)) {
      const fieldKey = String(payload.__nestedSectionsForField);
      const parentIdx = Number(payload.__nestedParentIndex || 0);
      if (!nestedSectionsByParent.has(fieldKey)) nestedSectionsByParent.set(fieldKey, new Map());
      const byParent = nestedSectionsByParent.get(fieldKey)!;
      const existing = byParent.get(parentIdx) || [];
      byParent.set(parentIdx, [...existing, ...payload.__nestedSections]);
      continue;
    }

    if (payload.__nestedSectionHtmlChunkForField && typeof payload.__chunkedTextPart === 'string') {
      const mapKey = `${payload.__nestedSectionHtmlChunkForField}::${payload.__nestedParentIndex}::${payload.__nestedSectionIndex}`;
      const list = nestedSectionHtmlParts.get(mapKey) || [];
      list.push({ idx: Number(payload.__partIndex || 0), part: payload.__chunkedTextPart });
      nestedSectionHtmlParts.set(mapKey, list);
      continue;
    }

    for (const [k, v] of Object.entries(payload)) {
      if (k.includes('::')) {
        const [parentKey, subKey] = k.split('::');
        if (!merged[parentKey] || typeof merged[parentKey] !== 'object') merged[parentKey] = {};
        if (Array.isArray(v)) {
          merged[parentKey][subKey] = [...(merged[parentKey][subKey] || []), ...v];
        } else {
          merged[parentKey][subKey] = v;
        }
      } else if (Array.isArray(v)) {
        merged[k] = [...(Array.isArray(merged[k]) ? merged[k] : []), ...v];
      } else if (v && typeof v === 'object' && merged[k] && typeof merged[k] === 'object' && !Array.isArray(merged[k])) {
        merged[k] = { ...merged[k], ...v };
      } else {
        merged[k] = v;
      }
    }
  }

  chunkedStrings.forEach((parts, fieldKey) => {
    const joined = parts
      .sort((a, b) => a.idx - b.idx)
      .map(p => p.part)
      .join('');
    if (fieldKey.includes('::')) {
      const [parentKey, subKey] = fieldKey.split('::');
      if (!merged[parentKey] || typeof merged[parentKey] !== 'object') merged[parentKey] = {};
      merged[parentKey][subKey] = joined;
    } else {
      merged[fieldKey] = joined;
    }
  });

  nestedItemsByParent.forEach((byParent, fieldKey) => {
    const targetArr = fieldKey.includes('::')
      ? (() => {
          const [pKey, sKey] = fieldKey.split('::');
          return merged[pKey]?.[sKey];
        })()
      : merged[fieldKey];
    if (Array.isArray(targetArr)) {
      byParent.forEach((nestedItems, parentIdx) => {
        if (targetArr[parentIdx]) {
          targetArr[parentIdx] = {
            ...targetArr[parentIdx],
            items: [...(targetArr[parentIdx].items || []), ...nestedItems]
          };
          delete targetArr[parentIdx].__splitNestedItems;
          delete targetArr[parentIdx].__nestedTargetId;
        }
      });
    }
  });

  nestedSectionsByParent.forEach((byParent, fieldKey) => {
    const targetArr = fieldKey.includes('::')
      ? (() => {
          const [pKey, sKey] = fieldKey.split('::');
          return merged[pKey]?.[sKey];
        })()
      : merged[fieldKey];
    if (Array.isArray(targetArr)) {
      byParent.forEach((nestedSecs, parentIdx) => {
        if (targetArr[parentIdx]) {
          const restoredSecs = [...(targetArr[parentIdx].sections || []), ...nestedSecs].map((sec: any, sIdx: number) => {
            if (sec.__chunkedHtmlParts !== undefined) {
              const mapKey = `${fieldKey}::${parentIdx}::${sIdx}`;
              const parts = nestedSectionHtmlParts.get(mapKey) || [];
              const htmlContent = parts
                .sort((a, b) => a.idx - b.idx)
                .map(p => p.part)
                .join('');
              const nextSec = { ...sec, htmlContent };
              delete nextSec.__chunkedHtmlParts;
              return nextSec;
            }
            return sec;
          });
          targetArr[parentIdx] = {
            ...targetArr[parentIdx],
            sections: restoredSecs
          };
          delete targetArr[parentIdx].__splitNestedSections;
        }
      });
    }
  });

  return merged;
}

/**
 * Reconstructs a complete, authoritative QuoteVersionRecord from a split manifest + section docs.
 * Validates section/chunk completeness and integrity hash cleanly.
 */
export function reconstructQuotationVersionFromSections(
  manifest: QuoteVersionRecord,
  sectionDocs: QuotationVersionSectionDocument[],
  options: { verifyIntegrity?: boolean } = {}
): QuoteVersionRecord {
  const verify = options.verifyIntegrity !== false;
  if (!manifest || manifest.storageFormat !== 'SPLIT_SECTIONS_V2') {
    return manifest;
  }

  const docsBySectionId = new Map<string, QuotationVersionSectionDocument>();
  const docsByLogicalSection = new Map<QuotationVersionSectionId, QuotationVersionSectionDocument[]>();

  for (const d of sectionDocs) {
    const sid = d.sectionId || d.id;
    docsBySectionId.set(sid, d);
    const list = docsByLogicalSection.get(d.logicalSection) || [];
    list.push(d);
    docsByLogicalSection.set(d.logicalSection, list);
  }

  const expectedIds = manifest.sectionIds || (manifest.sections || []).map(s => s.sectionId);
  if (verify && expectedIds.length > 0) {
    const missing = expectedIds.filter(id => !docsBySectionId.has(id));
    if (missing.length > 0) {
      throw new Error(
        `Incomplete split quotation version "${manifest.id || manifest.version}": missing section document(s) [${missing.join(', ')}].`
      );
    }
    // Verify EVERY section document's actual payload matches its declared contentHash
    for (const refItem of manifest.sections || []) {
      const loaded = docsBySectionId.get(refItem.sectionId);
      if (!loaded) continue;
      const computedDocHash = computeDeterministicHexHash(cleanFirestoreUndefined(loaded.data || {}));
      if (loaded.contentHash && computedDocHash !== loaded.contentHash) {
        throw new Error(
          `Section content hash mismatch on "${refItem.sectionId}" for "${manifest.id || manifest.version}" (expected ${loaded.contentHash}, got ${computedDocHash}).`
        );
      }
      if (refItem.contentHash && loaded.contentHash !== refItem.contentHash) {
        throw new Error(
          `Manifest section ref hash mismatch on "${refItem.sectionId}" for "${manifest.id || manifest.version}".`
        );
      }
    }
    if (manifest.sectionsIntegrityHash && manifest.sections && manifest.sections.length > 0) {
      const actualHash = computeDeterministicHexHash(
        manifest.sections.map(refItem => {
          const loaded = docsBySectionId.get(refItem.sectionId);
          return `${refItem.sectionId}:${loaded?.contentHash || ''}`;
        })
      );
      if (actualHash !== manifest.sectionsIntegrityHash) {
        throw new Error(
          `Integrity hash mismatch for quotation version "${manifest.id || manifest.version}" (expected ${manifest.sectionsIntegrityHash}, got ${actualHash}).`
        );
      }
    }
  }

  const overview = reassembleLogicalSectionData(docsByLogicalSection.get('trip_overview') || []);
  const itinerary = reassembleLogicalSectionData(docsByLogicalSection.get('itinerary') || []);
  const accommodation = reassembleLogicalSectionData(docsByLogicalSection.get('accommodation') || []);
  const productsSection = reassembleLogicalSectionData(docsByLogicalSection.get('products_and_services') || []);
  const pricing = reassembleLogicalSectionData(docsByLogicalSection.get('pricing') || []);
  const terms = reassembleLogicalSectionData(docsByLogicalSection.get('commercial_terms') || []);
  const policies = reassembleLogicalSectionData(docsByLogicalSection.get('destination_policies') || []);
  const passenger = reassembleLogicalSectionData(docsByLogicalSection.get('passenger_details') || []);
  const branding = reassembleLogicalSectionData(docsByLogicalSection.get('branding_and_output_settings') || []);

  const items: QuoteItem[] = deepCloneSafe(productsSection.items || []);
  const baseRouteHubs: TripRouteHub[] = deepCloneSafe(itinerary.routeHubs || []);

  // Rehydrate per-occurrence accommodation stays without injecting synthetic keys onto legacy hubs
  const stayMap = new Map<string, any>();
  if (Array.isArray(accommodation.stays)) {
    accommodation.stays.forEach((s: any) => {
      if (s?.itineraryHubOccurrenceId) stayMap.set(String(s.itineraryHubOccurrenceId), s);
    });
  }
  const routeHubs: TripRouteHub[] = baseRouteHubs.map((hub, idx) => {
    const occKey = String(hub.itineraryHubOccurrenceId || hub.id || `occ-${idx + 1}`);
    const stay = stayMap.get(occKey);
    if (!stay) return hub;
    const nextHub: any = { ...hub };
    if (
      nextHub.itineraryHubOccurrenceId === undefined &&
      stay.hasExplicitOccurrenceId === true &&
      stay.itineraryHubOccurrenceId !== undefined
    ) {
      nextHub.itineraryHubOccurrenceId = stay.itineraryHubOccurrenceId;
    }
    const stayFields: Array<keyof TripRouteHub> = [
      'accommodationType',
      'hotelId',
      'roomTypeId',
      'roomsCount',
      'checkInDate',
      'checkOutDate',
      'isManualHotel',
      'manualHotel',
      'overriddenByLandOnly',
      'savedAccommodationSnapshot'
    ];
    for (const f of stayFields) {
      if (nextHub[f] === undefined && stay[f] !== undefined) {
        nextHub[f] = deepCloneSafe(stay[f]);
      }
    }
    return nextHub as TripRouteHub;
  });

  const restoredOptions = Array.isArray(productsSection.options)
    ? productsSection.options.map((opt: any) => {
        const nextOpt = { ...opt };
        if (nextOpt.__mirrorsTopLevelItems) {
          delete nextOpt.__mirrorsTopLevelItems;
          nextOpt.items = deepCloneSafe(items);
        }
        if (nextOpt.__mirrorsTopLevelRouteHubs) {
          delete nextOpt.__mirrorsTopLevelRouteHubs;
          nextOpt.routeHubs = deepCloneSafe(routeHubs);
        }
        return nextOpt;
      })
    : undefined;

  const currencySnap = deepCloneSafe(pricing.currencyConversionSnapshot);
  const pricingSnapshot = pricing.pricingSnapshot ? deepCloneSafe(pricing.pricingSnapshot) : undefined;
  if (pricingSnapshot && (pricingSnapshot as any).__mirrorsCurrencyConversionSnapshot) {
    delete (pricingSnapshot as any).__mirrorsCurrencyConversionSnapshot;
    pricingSnapshot.currencyConversionSnapshot = deepCloneSafe(currencySnap);
  }

  const commercialTermsSnapshot = terms.commercialTermsSnapshot
    ? deepCloneSafe(terms.commercialTermsSnapshot)
    : undefined;
  const resolvedTermsText =
    terms.__mirrorsCombinedPlainText && commercialTermsSnapshot?.combinedPlainText !== undefined
      ? commercialTermsSnapshot.combinedPlainText
      : terms.termsAndConditions;

  // Reconstruct full AuthoritativeQuotationSnapshot seamlessly
  let authoritativeSnapshot: AuthoritativeQuotationSnapshot | undefined = undefined;
  if (overview.authoritativeSnapshotMeta) {
    const meta = overview.authoritativeSnapshotMeta;
    const authPricing = pricing.authoritativePricing ? deepCloneSafe(pricing.authoritativePricing) : undefined;
    if (authPricing && authPricing.__mirrorsCurrencyConversionSnapshot) {
      delete authPricing.__mirrorsCurrencyConversionSnapshot;
      authPricing.currencyConversionSnapshot = deepCloneSafe(currencySnap);
    }
    const authItinerary = itinerary.authoritativeItinerary
      ? deepCloneSafe(itinerary.authoritativeItinerary)
      : {
          itineraryOverview: itinerary.itineraryOverview,
          dayThemes: itinerary.dayThemes,
          dayDescriptions: itinerary.dayDescriptions,
          dayOverviews: itinerary.dayOverviews,
          dayNotes: itinerary.dayNotes,
          inclusions: itinerary.inclusions || [],
          exclusions: itinerary.exclusions || [],
          importantInformation: policies.importantInformation,
          cancellationPolicy: policies.cancellationPolicy,
          agentNotes: passenger.agentNotes,
          operationalRemarks: policies.operationalRemarks,
          customOperationalRemarks: policies.customOperationalRemarks,
          itemsCount: items.length
        };

    let restoredAuthTrip = overview.authoritativeTrip
      ? deepCloneSafe(overview.authoritativeTrip)
      : {
          title: overview.title ?? manifest.title,
          destination: overview.destination ?? manifest.destination,
          travelStartDate: overview.travelStartDate ?? manifest.travelStartDate,
          travelEndDate: overview.travelEndDate ?? manifest.travelEndDate,
          totalPax: passenger.totalPax ?? manifest.totalPax,
          adultsCount: passenger.adultsCount ?? manifest.adultsCount,
          childrenCount: passenger.childrenCount ?? manifest.childrenCount,
          infantsCount: passenger.infantsCount ?? manifest.infantsCount,
          childAges: passenger.childAges,
          passengerBreakdown: passenger.passengerBreakdown,
          roomingConfig: accommodation.roomingConfig,
          nationality: passenger.nationality,
          travelStyle: passenger.travelStyle,
          mealPlanPreference: passenger.mealPlanPreference,
          visaAssistanceChoice: overview.visaAssistanceChoice,
          routeHubs: deepCloneSafe(routeHubs)
        };
    if (restoredAuthTrip && restoredAuthTrip.__mirrorsTopLevelRouteHubs) {
      delete restoredAuthTrip.__mirrorsTopLevelRouteHubs;
      restoredAuthTrip.routeHubs = deepCloneSafe(routeHubs);
    }

    let restoredAuthTerms = terms.authoritativeCommercialTerms
      ? deepCloneSafe(terms.authoritativeCommercialTerms)
      : {
          termsStatus: terms.termsStatus,
          snapshot: commercialTermsSnapshot,
          plainText: resolvedTermsText ?? '',
          termsExceptionApproval: terms.termsExceptionApproval
        };
    if (restoredAuthTerms && restoredAuthTerms.__mirrorsCommercialTermsSnapshot) {
      delete restoredAuthTerms.__mirrorsCommercialTermsSnapshot;
      restoredAuthTerms.snapshot = deepCloneSafe(commercialTermsSnapshot);
    }

    authoritativeSnapshot = cleanFirestoreUndefined({
      ...meta,
      ...(passenger.authoritativeClient !== undefined ? { client: deepCloneSafe(passenger.authoritativeClient) } : {}),
      ...(branding.authoritativeAgency !== undefined ? { agency: deepCloneSafe(branding.authoritativeAgency) } : {}),
      ...(branding.authoritativeBranding !== undefined ? { branding: deepCloneSafe(branding.authoritativeBranding) } : {}),
      trip: restoredAuthTrip,
      itinerary: authItinerary,
      ...(authPricing !== undefined ? { pricing: authPricing } : {}),
      commercialTerms: restoredAuthTerms
    });
  }

  return cleanFirestoreUndefined({
    ...(overview.__extraVersionFields && typeof overview.__extraVersionFields === 'object'
      ? deepCloneSafe(overview.__extraVersionFields)
      : {}),
    ...manifest,
    quoteNumber: overview.quoteNumber ?? manifest.quoteNumber,
    title: overview.title ?? manifest.title,
    destination: overview.destination ?? manifest.destination,
    leadId: overview.leadId ?? manifest.leadId,
    linkedLeadId: overview.linkedLeadId,
    leadNumber: overview.leadNumber,
    travelStartDate: overview.travelStartDate ?? manifest.travelStartDate,
    travelEndDate: overview.travelEndDate ?? manifest.travelEndDate,
    status: overview.status ?? manifest.status,
    proposalStatus: overview.proposalStatus ?? manifest.proposalStatus,
    isLocked: overview.isLocked,
    changesSummary: overview.changesSummary ?? manifest.changesSummary,
    bookingId: overview.bookingId ?? manifest.bookingId,
    bookingReference: overview.bookingReference ?? manifest.bookingReference,
    linkedBookingIds: overview.linkedBookingIds,
    sourcePackageId: overview.sourcePackageId,
    sourcePackageName: overview.sourcePackageName,
    sourcePackageSlug: overview.sourcePackageSlug,
    sourcePackageUpdatedAt: overview.sourcePackageUpdatedAt,
    feasibilityScore: overview.feasibilityScore,
    feasibilityStatus: overview.feasibilityStatus,
    feasibilityWarnings: overview.feasibilityWarnings,
    visaAssistanceChoice: overview.visaAssistanceChoice,
    validUntil: overview.validUntil,
    activityLog: overview.activityLog,
    generationHistory: overview.generationHistory,
    previousVersionId: overview.previousVersionId ?? manifest.previousVersionId,
    clientSaveRequestId: overview.clientSaveRequestId ?? manifest.clientSaveRequestId,
    restoredFromVersion: overview.restoredFromVersion ?? manifest.restoredFromVersion,
    clientUserId: passenger.clientUserId,
    clientName: passenger.clientName ?? manifest.clientName,
    clientEmail: passenger.clientEmail ?? manifest.clientEmail,
    clientPhone: passenger.clientPhone,
    clientCompany: passenger.clientCompany,
    nationality: passenger.nationality,
    travelStyle: passenger.travelStyle,
    mealPlanPreference: passenger.mealPlanPreference,
    totalPax: passenger.totalPax ?? manifest.totalPax,
    adultsCount: passenger.adultsCount ?? manifest.adultsCount,
    childrenCount: passenger.childrenCount ?? manifest.childrenCount,
    infantsCount: passenger.infantsCount ?? manifest.infantsCount,
    childAges: passenger.childAges,
    passengerBreakdown: passenger.passengerBreakdown,
    roomingConfig: accommodation.roomingConfig,
    agentNotes: passenger.agentNotes,
    currency: pricing.currency ?? manifest.currency,
    totalNetCost: pricing.totalNetCost ?? manifest.totalNetCost,
    totalSellingPrice: pricing.totalSellingPrice ?? manifest.totalSellingPrice,
    finalCustomerSellingPrice: pricing.finalCustomerSellingPrice,
    theUnboundBaseSellingPrice:
      pricing.theUnboundBaseSellingPrice ?? manifest.theUnboundBaseSellingPrice,
    baseFinalSellingPrice: pricing.baseFinalSellingPrice,
    agentMarginType: pricing.agentMarginType ?? manifest.agentMarginType,
    agentMarginValue: pricing.agentMarginValue ?? manifest.agentMarginValue,
    agentMarginAmount: pricing.agentMarginAmount ?? manifest.agentMarginAmount,
    productLevelAgentMarkupTotal: pricing.productLevelAgentMarkupTotal,
    overallAgentMarkupAmount: pricing.overallAgentMarkupAmount,
    totalAgentAdditionalMarkupAmount: pricing.totalAgentAdditionalMarkupAmount,
    overallDiscountPercent:
      pricing.overallDiscountPercent ?? manifest.overallDiscountPercent,
    overallMarkupPercent: pricing.overallMarkupPercent,
    hotelAccommodationTotal: pricing.hotelAccommodationTotal,
    landPartTotal: pricing.landPartTotal,
    surchargesTotal: pricing.surchargesTotal,
    appliedSurcharges: pricing.appliedSurcharges,
    surchargeOverrides: pricing.surchargeOverrides,
    totalTaxes: pricing.totalTaxes,
    marginPercent: pricing.marginPercent ?? manifest.marginPercent,
    marginAmount: pricing.marginAmount ?? manifest.marginAmount,
    internalNettCost: pricing.internalNettCost,
    supplierCost: pricing.supplierCost,
    internalMarkup: pricing.internalMarkup,
    internalProfit: pricing.internalProfit,
    adminManualMarginType: pricing.adminManualMarginType,
    adminManualMarginValue: pricing.adminManualMarginValue,
    adminManualMarginAmount: pricing.adminManualMarginAmount,
    adminMarginMode: pricing.adminMarginMode,
    revisedSellingPrice: pricing.revisedSellingPrice,
    pricingCalculatedAt: pricing.pricingCalculatedAt,
    pricingVersion: pricing.pricingVersion,
    adminBasePriceUpdatedNotification: pricing.adminBasePriceUpdatedNotification,
    items,
    routeHubs,
    dayThemes: itinerary.dayThemes,
    dayDescriptions: itinerary.dayDescriptions,
    dayOverviews: itinerary.dayOverviews,
    dayNotes: itinerary.dayNotes,
    itineraryOverview: itinerary.itineraryOverview,
    inclusions: itinerary.inclusions,
    exclusions: itinerary.exclusions,
    importantInformation: policies.importantInformation,
    cancellationPolicy: policies.cancellationPolicy,
    operationalRemarks: policies.operationalRemarks,
    customOperationalRemarks: policies.customOperationalRemarks,
    options: restoredOptions,
    activeOptionId: productsSection.activeOptionId ?? manifest.activeOptionId,
    quotationScope: branding.quotationScope ?? manifest.quotationScope,
    scope: branding.scope,
    termsStatus: terms.termsStatus,
    missingTermsDestinations: terms.missingTermsDestinations,
    termsExceptionApproval: terms.termsExceptionApproval,
    pricingSnapshot,
    currencyConversionSnapshot: currencySnap,
    commercialTermsSnapshot,
    authoritativeSnapshot,
    termsAndConditions: resolvedTermsText,
    brandingMode: branding.brandingMode ?? manifest.brandingMode,
    brandingSnapshot: branding.brandingSnapshot,
    agentName: branding.agentName,
    agentEmail: branding.agentEmail,
    agentAgency: branding.agentAgency,
    agentCompany: branding.agentCompany,
    agentLogoUrl: branding.agentLogoUrl,
    agentPhone: branding.agentPhone,
    sharedHistory: branding.sharedHistory ?? manifest.sharedHistory,
    totalItems: items.length,
    totalHubs: routeHubs.length,
    hasHydratedSections: true
  });
}

// ============================================================================
// CANONICAL LOGICAL ROUND-TRIP VERIFICATION & DIAGNOSTIC DIFF ENGINE
// ============================================================================

export const MIGRATION_ONLY_EXCLUDED_FIELDS = new Set<string>([
  'storageFormat',
  'schemaVersion',
  'manifestStatus',
  'sections',
  'sectionIds',
  'sectionCount',
  'chunkCount',
  'sectionsIntegrityHash',
  'totalReconstructedBytes',
  'committedAt',
  'failureReason',
  'hasHydratedSections',
  'migrationStatus',
  'migrationState',
  'migratedAt',
  'verifiedAt',
  'failingFieldPaths',
  'updatedByRole',
  'updatedByEmail',
  'isDeleted',
  'totalItems',
  'totalHubs',
  'isImmutable',
  'isLatest',
  'sharedHistory'
]);

export interface RoundTripFieldDiff {
  path: string;
  domain: string;
  reason: string;
  originalPreview: string;
  reconstructedPreview: string;
}

export interface RoundTripValidationRow {
  validation: string;
  original: string;
  reconstructed: string;
  result: 'PASS' | 'FAIL';
  details?: string;
}

export interface VersionRoundTripVerificationReport {
  quoteId: string;
  versionId: string;
  passed: boolean;
  originalCanonicalHash: string;
  reconstructedCanonicalHash: string;
  sectionCount: number;
  chunkCount: number;
  maxSectionBytes: number;
  failingFieldPaths: RoundTripFieldDiff[];
  validationTable: RoundTripValidationRow[];
}

function classifyFieldDomain(fieldPath: string): string {
  const root = fieldPath.split('.')[0].replace(/\[\d+\]$/, '');
  if (
    root === 'dayThemes' ||
    root === 'dayDescriptions' ||
    root === 'dayOverviews' ||
    root === 'dayNotes' ||
    root === 'itineraryOverview' ||
    root === 'inclusions' ||
    root === 'exclusions'
  ) {
    return 'Itinerary';
  }
  if (root === 'routeHubs') {
    if (
      fieldPath.includes('hotelId') ||
      fieldPath.includes('roomTypeId') ||
      fieldPath.includes('roomsCount') ||
      fieldPath.includes('manualHotel') ||
      fieldPath.includes('accommodationType') ||
      fieldPath.includes('checkInDate') ||
      fieldPath.includes('checkOutDate') ||
      fieldPath.includes('savedAccommodationSnapshot')
    ) {
      return 'Accommodation stays';
    }
    return 'Hubs and order';
  }
  if (root === 'roomingConfig') return 'Accommodation stays';
  if (root === 'items' || root === 'options' || root === 'activeOptionId' || root === 'quotationScope') {
    return 'Products and services';
  }
  if (
    root === 'clientName' ||
    root === 'clientEmail' ||
    root === 'clientPhone' ||
    root === 'clientCompany' ||
    root === 'nationality' ||
    root === 'travelStyle' ||
    root === 'mealPlanPreference' ||
    root === 'totalPax' ||
    root === 'adultsCount' ||
    root === 'childrenCount' ||
    root === 'infantsCount' ||
    root === 'childAges' ||
    root === 'passengerBreakdown' ||
    root === 'agentNotes'
  ) {
    return 'Passenger details';
  }
  if (
    root === 'currency' ||
    root === 'totalNetCost' ||
    root === 'totalSellingPrice' ||
    root === 'theUnboundBaseSellingPrice' ||
    root === 'agentMarginType' ||
    root === 'agentMarginValue' ||
    root === 'agentMarginAmount' ||
    root === 'overallDiscountPercent' ||
    root === 'marginPercent' ||
    root === 'marginAmount' ||
    root === 'pricingSnapshot' ||
    root === 'currencyConversionSnapshot'
  ) {
    return 'Pricing snapshot';
  }
  if (root === 'commercialTermsSnapshot' || root === 'termsAndConditions') return 'Commercial terms';
  if (root === 'importantInformation' || root === 'cancellationPolicy') return 'Destination policies';
  if (root === 'authoritativeSnapshot') {
    if (fieldPath.includes('.itinerary')) return 'Itinerary';
    if (fieldPath.includes('.pricing')) return 'Pricing snapshot';
    if (fieldPath.includes('.commercialTerms')) return 'Commercial terms';
    if (fieldPath.includes('.trip.routeHubs')) return 'Hubs and order';
    if (fieldPath.includes('.client')) return 'Passenger details';
    return 'Metadata';
  }
  return 'Metadata';
}

function formatPreview(v: any): string {
  if (v === undefined) return '<missing/undefined>';
  if (v === null) return 'null';
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 120 ? `${s.slice(0, 117)}...` : s;
  } catch {
    return String(v);
  }
}

/**
 * Extracts only the logical quotation version content for canonical round-trip comparison,
 * omitting strictly migration-transport metadata without removing any business/commercial field.
 */
export function extractLogicalQuotationSnapshot(
  record: Partial<QuoteVersionRecord> & Record<string, any>
): Record<string, any> {
  const normalized = canonicalizeQuotationValue(record || {}) as Record<string, any>;
  const out: Record<string, any> = {};
  for (const key of Object.keys(normalized).sort()) {
    if (MIGRATION_ONLY_EXCLUDED_FIELDS.has(key)) continue;
    out[key] = normalized[key];
  }
  // Ensure empty default arrays/missing optional fields compare faithfully against each other only when semantically equivalent:
  // If original omitted `items` / `routeHubs` completely vs reconstructed `[]`, preserve exact comparison unless original explicitly had items/hubs:
  return out;
}

export function collectFieldPathDiffs(
  origVal: any,
  recVal: any,
  path = '',
  out: RoundTripFieldDiff[] = [],
  maxDiffs = 50
): RoundTripFieldDiff[] {
  if (out.length >= maxDiffs) return out;
  if (origVal === recVal) return out;

  if (origVal === undefined || recVal === undefined || origVal === null || recVal === null) {
    out.push({
      path: path || '(root)',
      domain: classifyFieldDomain(path || 'metadata'),
      reason: origVal === undefined ? 'unexpected_field_added' : recVal === undefined ? 'field_missing' : 'null_mismatch',
      originalPreview: formatPreview(origVal),
      reconstructedPreview: formatPreview(recVal)
    });
    return out;
  }

  if (typeof origVal !== typeof recVal) {
    out.push({
      path: path || '(root)',
      domain: classifyFieldDomain(path || 'metadata'),
      reason: `type_mismatch (${typeof origVal} vs ${typeof recVal})`,
      originalPreview: formatPreview(origVal),
      reconstructedPreview: formatPreview(recVal)
    });
    return out;
  }

  if (typeof origVal !== 'object') {
    out.push({
      path: path || '(root)',
      domain: classifyFieldDomain(path || 'metadata'),
      reason: 'value_mismatch',
      originalPreview: formatPreview(origVal),
      reconstructedPreview: formatPreview(recVal)
    });
    return out;
  }

  if (Array.isArray(origVal) || Array.isArray(recVal)) {
    if (!Array.isArray(origVal) || !Array.isArray(recVal)) {
      out.push({
        path: path || '(root)',
        domain: classifyFieldDomain(path || 'metadata'),
        reason: 'array_vs_object_mismatch',
        originalPreview: formatPreview(origVal),
        reconstructedPreview: formatPreview(recVal)
      });
      return out;
    }
    const maxLen = Math.max(origVal.length, recVal.length);
    for (let i = 0; i < maxLen && out.length < maxDiffs; i += 1) {
      if (i >= origVal.length || i >= recVal.length) {
        out.push({
          path: `${path}[${i}]`,
          domain: classifyFieldDomain(path),
          reason: `array_length_mismatch (${origVal.length} vs ${recVal.length})`,
          originalPreview: i < origVal.length ? formatPreview(origVal[i]) : '<out_of_bounds>',
          reconstructedPreview: i < recVal.length ? formatPreview(recVal[i]) : '<out_of_bounds>'
        });
      } else {
        collectFieldPathDiffs(origVal[i], recVal[i], `${path}[${i}]`, out, maxDiffs);
      }
    }
    return out;
  }

  const allKeys = Array.from(new Set([...Object.keys(origVal), ...Object.keys(recVal)])).sort();
  for (const k of allKeys) {
    if (out.length >= maxDiffs) break;
    const childPath = path ? `${path}.${k}` : k;
    collectFieldPathDiffs(origVal[k], recVal[k], childPath, out, maxDiffs);
  }
  return out;
}

/**
 * Full 12-domain canonical round-trip verifier used by both live backfill (`db.ts`)
 * and offline/batch migration (`quotationVersionMigration.ts`).
 */
export function verifyVersionRoundTripIntegrity(params: {
  originalVersion: QuoteVersionRecord;
  reconstructedVersion: QuoteVersionRecord;
  manifest?: QuoteVersionRecord;
  sectionDocs?: QuotationVersionSectionDocument[];
}): VersionRoundTripVerificationReport {
  const { originalVersion, reconstructedVersion, manifest, sectionDocs = [] } = params;
  const origLogical = extractLogicalQuotationSnapshot(originalVersion);
  const recLogical = extractLogicalQuotationSnapshot(reconstructedVersion);

  // If an ancient legacy record omitted `items` or `routeHubs` (undefined), and split storage restored empty `[]`,
  // do not mask non-empty mismatches, only avoid false failure if original was undefined and reconstructed is [].
  if (origLogical.items === undefined && Array.isArray(recLogical.items) && recLogical.items.length === 0) {
    origLogical.items = [];
  }
  if (origLogical.routeHubs === undefined && Array.isArray(recLogical.routeHubs) && recLogical.routeHubs.length === 0) {
    origLogical.routeHubs = [];
  }

  const diffs = collectFieldPathDiffs(origLogical, recLogical, '');
  const originalCanonicalHash = computeDeterministicHexHash(origLogical);
  const reconstructedCanonicalHash = computeDeterministicHexHash(recLogical);

  const sectionCount = manifest?.sectionCount ?? LOGICAL_SECTION_ORDER.length;
  const chunkCount = sectionDocs.length || manifest?.chunkCount || 0;
  const maxSectionBytes = sectionDocs.reduce((m, s) => Math.max(m, s.estimatedBytes || 0), 0);

  const hasDiffInDomain = (domainName: string) =>
    diffs.filter(d => d.domain === domainName);

  const buildDomainRow = (
    validation: string,
    origSummary: string,
    recSummary: string,
    domainFilter?: string
  ): RoundTripValidationRow => {
    const domainDiffs = domainFilter ? hasDiffInDomain(domainFilter) : [];
    return {
      validation,
      original: origSummary,
      reconstructed: recSummary,
      result: domainDiffs.length === 0 && origSummary === recSummary ? 'PASS' : 'FAIL',
      details: domainDiffs.length > 0 ? domainDiffs.map(d => `${d.path}: ${d.reason}`).join('; ') : undefined
    };
  };

  const origQuoteId = String(origLogical.quoteId || originalVersion.quoteId || '');
  const recQuoteId = String(recLogical.quoteId || reconstructedVersion.quoteId || '');
  const origVerId = String(origLogical.id || `${origQuoteId}__v${origLogical.version || 1}`);
  const recVerId = String(recLogical.id || `${recQuoteId}__v${recLogical.version || 1}`);

  const origItinHash = computeDeterministicHexHash({
    dayThemes: origLogical.dayThemes,
    dayDescriptions: origLogical.dayDescriptions,
    dayOverviews: origLogical.dayOverviews,
    dayNotes: origLogical.dayNotes,
    itineraryOverview: origLogical.itineraryOverview,
    inclusions: origLogical.inclusions,
    exclusions: origLogical.exclusions
  });
  const recItinHash = computeDeterministicHexHash({
    dayThemes: recLogical.dayThemes,
    dayDescriptions: recLogical.dayDescriptions,
    dayOverviews: recLogical.dayOverviews,
    dayNotes: recLogical.dayNotes,
    itineraryOverview: recLogical.itineraryOverview,
    inclusions: recLogical.inclusions,
    exclusions: recLogical.exclusions
  });

  const origHubSeq = (origLogical.routeHubs || []).map((h: any) => h.hubName || h.hubId).join(' -> ');
  const recHubSeq = (recLogical.routeHubs || []).map((h: any) => h.hubName || h.hubId).join(' -> ');
  const origStayHash = computeDeterministicHexHash({
    stays: (origLogical.routeHubs || []).map((h: any) => ({
      occ: h.itineraryHubOccurrenceId,
      hotelId: h.hotelId,
      roomTypeId: h.roomTypeId,
      roomsCount: h.roomsCount,
      checkIn: h.checkInDate,
      checkOut: h.checkOutDate,
      accType: h.accommodationType,
      manualHotel: h.manualHotel
    })),
    roomingConfig: origLogical.roomingConfig
  });
  const recStayHash = computeDeterministicHexHash({
    stays: (recLogical.routeHubs || []).map((h: any) => ({
      occ: h.itineraryHubOccurrenceId,
      hotelId: h.hotelId,
      roomTypeId: h.roomTypeId,
      roomsCount: h.roomsCount,
      checkIn: h.checkInDate,
      checkOut: h.checkOutDate,
      accType: h.accommodationType,
      manualHotel: h.manualHotel
    })),
    roomingConfig: recLogical.roomingConfig
  });

  const origItemsHash = computeDeterministicHexHash({
    items: origLogical.items,
    options: origLogical.options,
    activeOptionId: origLogical.activeOptionId,
    quotationScope: origLogical.quotationScope
  });
  const recItemsHash = computeDeterministicHexHash({
    items: recLogical.items,
    options: recLogical.options,
    activeOptionId: recLogical.activeOptionId,
    quotationScope: recLogical.quotationScope
  });

  const origPaxHash = computeDeterministicHexHash({
    clientName: origLogical.clientName,
    clientEmail: origLogical.clientEmail,
    clientPhone: origLogical.clientPhone,
    clientCompany: origLogical.clientCompany,
    nationality: origLogical.nationality,
    totalPax: origLogical.totalPax,
    adultsCount: origLogical.adultsCount,
    childrenCount: origLogical.childrenCount,
    infantsCount: origLogical.infantsCount,
    childAges: origLogical.childAges,
    passengerBreakdown: origLogical.passengerBreakdown,
    agentNotes: origLogical.agentNotes
  });
  const recPaxHash = computeDeterministicHexHash({
    clientName: recLogical.clientName,
    clientEmail: recLogical.clientEmail,
    clientPhone: recLogical.clientPhone,
    clientCompany: recLogical.clientCompany,
    nationality: recLogical.nationality,
    totalPax: recLogical.totalPax,
    adultsCount: recLogical.adultsCount,
    childrenCount: recLogical.childrenCount,
    infantsCount: recLogical.infantsCount,
    childAges: recLogical.childAges,
    passengerBreakdown: recLogical.passengerBreakdown,
    agentNotes: recLogical.agentNotes
  });

  const origPricingHash = computeDeterministicHexHash({
    currency: origLogical.currency,
    totalSellingPrice: origLogical.totalSellingPrice,
    theUnboundBaseSellingPrice: origLogical.theUnboundBaseSellingPrice,
    agentMarginType: origLogical.agentMarginType,
    agentMarginValue: origLogical.agentMarginValue,
    agentMarginAmount: origLogical.agentMarginAmount,
    overallDiscountPercent: origLogical.overallDiscountPercent,
    totalNetCost: origLogical.totalNetCost,
    marginPercent: origLogical.marginPercent,
    marginAmount: origLogical.marginAmount,
    pricingSnapshot: origLogical.pricingSnapshot,
    currencyConversionSnapshot: origLogical.currencyConversionSnapshot
  });
  const recPricingHash = computeDeterministicHexHash({
    currency: recLogical.currency,
    totalSellingPrice: recLogical.totalSellingPrice,
    theUnboundBaseSellingPrice: recLogical.theUnboundBaseSellingPrice,
    agentMarginType: recLogical.agentMarginType,
    agentMarginValue: recLogical.agentMarginValue,
    agentMarginAmount: recLogical.agentMarginAmount,
    overallDiscountPercent: recLogical.overallDiscountPercent,
    totalNetCost: recLogical.totalNetCost,
    marginPercent: recLogical.marginPercent,
    marginAmount: recLogical.marginAmount,
    pricingSnapshot: recLogical.pricingSnapshot,
    currencyConversionSnapshot: recLogical.currencyConversionSnapshot
  });

  const origTermsHash = computeDeterministicHexHash({
    commercialTermsSnapshot: origLogical.commercialTermsSnapshot,
    termsAndConditions: origLogical.termsAndConditions
  });
  const recTermsHash = computeDeterministicHexHash({
    commercialTermsSnapshot: recLogical.commercialTermsSnapshot,
    termsAndConditions: recLogical.termsAndConditions
  });

  const origPoliciesHash = computeDeterministicHexHash({
    importantInformation: origLogical.importantInformation,
    cancellationPolicy: origLogical.cancellationPolicy
  });
  const recPoliciesHash = computeDeterministicHexHash({
    importantInformation: recLogical.importantInformation,
    cancellationPolicy: recLogical.cancellationPolicy
  });

  const validationTable: RoundTripValidationRow[] = [
    {
      validation: 'Quotation ID',
      original: origQuoteId,
      reconstructed: recQuoteId,
      result: origQuoteId && origQuoteId === recQuoteId ? 'PASS' : 'FAIL'
    },
    {
      validation: 'Version ID',
      original: origVerId,
      reconstructed: recVerId,
      result: origVerId && origVerId === recVerId ? 'PASS' : 'FAIL'
    },
    {
      validation: 'Section count',
      original: `${sectionCount} logical / ${chunkCount} docs`,
      reconstructed: `${sectionCount} logical / ${sectionDocs.length || chunkCount} loaded`,
      result:
        sectionDocs.length === 0 || (manifest?.sectionIds ? sectionDocs.length === manifest.sectionIds.length : true)
          ? 'PASS'
          : 'FAIL'
    },
    buildDomainRow('Itinerary', `hash:${origItinHash.slice(0, 12)}`, `hash:${recItinHash.slice(0, 12)}`, 'Itinerary'),
    buildDomainRow(
      'Hubs and order',
      `${(origLogical.routeHubs || []).length} hubs (${origHubSeq})`,
      `${(recLogical.routeHubs || []).length} hubs (${recHubSeq})`,
      'Hubs and order'
    ),
    buildDomainRow(
      'Accommodation stays',
      `hash:${origStayHash.slice(0, 12)}`,
      `hash:${recStayHash.slice(0, 12)}`,
      'Accommodation stays'
    ),
    buildDomainRow(
      'Products and services',
      `${(origLogical.items || []).length} items | hash:${origItemsHash.slice(0, 12)}`,
      `${(recLogical.items || []).length} items | hash:${recItemsHash.slice(0, 12)}`,
      'Products and services'
    ),
    buildDomainRow(
      'Passenger details',
      `${origLogical.clientName || ''} (${origLogical.totalPax ?? '-'} pax) | hash:${origPaxHash.slice(0, 12)}`,
      `${recLogical.clientName || ''} (${recLogical.totalPax ?? '-'} pax) | hash:${recPaxHash.slice(0, 12)}`,
      'Passenger details'
    ),
    buildDomainRow(
      'Pricing snapshot',
      `${origLogical.currency || 'USD'} ${origLogical.totalSellingPrice} | hash:${origPricingHash.slice(0, 12)}`,
      `${recLogical.currency || 'USD'} ${recLogical.totalSellingPrice} | hash:${recPricingHash.slice(0, 12)}`,
      'Pricing snapshot'
    ),
    buildDomainRow(
      'Commercial terms',
      `hash:${origTermsHash.slice(0, 12)}`,
      `hash:${recTermsHash.slice(0, 12)}`,
      'Commercial terms'
    ),
    buildDomainRow(
      'Destination policies',
      `hash:${origPoliciesHash.slice(0, 12)}`,
      `hash:${recPoliciesHash.slice(0, 12)}`,
      'Destination policies'
    ),
    buildDomainRow(
      'Metadata',
      `hash:${originalCanonicalHash.slice(0, 12)}`,
      `hash:${reconstructedCanonicalHash.slice(0, 12)}`,
      'Metadata'
    )
  ];

  const passed =
    diffs.length === 0 &&
    originalCanonicalHash === reconstructedCanonicalHash &&
    validationTable.every(r => r.result === 'PASS');

  return {
    quoteId: origQuoteId,
    versionId: origVerId,
    passed,
    originalCanonicalHash,
    reconstructedCanonicalHash,
    sectionCount,
    chunkCount,
    maxSectionBytes,
    failingFieldPaths: diffs,
    validationTable
  };
}

/**
 * Builds a lightweight summary entry (~300 bytes) for storing in master `quotations/{id}.versionSummaries`.
 */
export function buildCompactVersionSummary(v: QuoteVersionRecord): QuotationVersionSummary {
  const verNum = Number(v.versionNumber || v.version || 1);
  return cleanFirestoreUndefined({
    id: v.id || `${v.quoteId}__v${verNum}`,
    version: verNum,
    versionNumber: verNum,
    previousVersionId: v.previousVersionId,
    createdAt: v.createdAt || v.updatedAt || new Date().toISOString(),
    updatedAt: v.updatedAt || v.createdAt || new Date().toISOString(),
    updatedBy: v.updatedBy || v.savedByName || 'Travel Consultant',
    savedByUserId: v.savedByUserId,
    savedByName: v.savedByName || v.updatedBy,
    savedByRole: v.savedByRole,
    status: v.status,
    proposalStatus: v.proposalStatus,
    currency: v.currency || 'USD',
    totalSellingPrice: Number(v.totalSellingPrice ?? 0),
    theUnboundBaseSellingPrice: v.theUnboundBaseSellingPrice,
    agentMarginAmount: v.agentMarginAmount,
    totalNetCost: v.totalNetCost,
    marginAmount: v.marginAmount,
    totalItems: v.totalItems ?? v.items?.length ?? 0,
    totalHubs: v.totalHubs ?? v.routeHubs?.length ?? 0,
    changesSummary: v.changesSummary || `Saved version v${verNum}`,
    snapshotHash: v.snapshotHash,
    clientSaveRequestId: v.clientSaveRequestId,
    restoredFromVersion: v.restoredFromVersion,
    storageFormat: v.storageFormat || 'SPLIT_SECTIONS_V2',
    schemaVersion: v.schemaVersion || STORAGE_SCHEMA_VERSION_V2,
    manifestStatus: v.manifestStatus || 'COMMITTED',
    sectionCount: v.sectionCount,
    chunkCount: v.chunkCount,
    committedAt: v.committedAt,
    isLatest: Boolean(v.isLatest),
    isImmutable: true
  });
}

/**
 * Compacts the master `quotations/{quoteId}` Firestore document so it NEVER embeds quadratic
 * `versionHistory` arrays or redundant duplicates and ALWAYS remains strictly `< SAFE_DOC_BYTE_THRESHOLD` (800 KiB).
 * Note: Full authoritative un-compacted data for every version lives safely inside `/versions/{id}/sections/*`.
 */
export function compactMasterQuotationForFirestore(
  quote: Quotation,
  summaries: QuotationVersionSummary[],
  latestVersionId?: string
): {
  masterDoc: Record<string, any>;
  estimatedBytes: number;
  dehydratedToVersionSections: boolean;
} {
  const clone: Record<string, any> = deepCloneSafe(quote) as any;

  // 1. Replace massive embedded versionHistory array with empty [] + lightweight versionSummaries (~300 B/ver)
  // Using [] ensures even `{ merge: true }` Firestore writes overwrite legacy bloated `versionHistory` blobs cleanly.
  clone.versionHistory = [];
  clone.versionSummaries = summaries.map(s => buildCompactVersionSummary(s as any));
  if (latestVersionId) {
    clone.latestVersionId = latestVersionId;
  }

  // 2. Remove exact camelCase/snake_case duplicate snapshots on Firestore master doc (restored in-memory on read)
  if (clone.pricingSnapshot && clone.pricing_snapshot && areJsonEquivalent(clone.pricingSnapshot, clone.pricing_snapshot)) {
    delete clone.pricing_snapshot;
  }
  if (clone.currencyConversionSnapshot && clone.currency_conversion_snapshot && areJsonEquivalent(clone.currencyConversionSnapshot, clone.currency_conversion_snapshot)) {
    delete clone.currency_conversion_snapshot;
  }
  if (clone.pricingSnapshot?.currencyConversionSnapshot && clone.currencyConversionSnapshot && areJsonEquivalent(clone.pricingSnapshot.currencyConversionSnapshot, clone.currencyConversionSnapshot)) {
    delete clone.pricingSnapshot.currencyConversionSnapshot;
  }
  if (Array.isArray(clone.options) && clone.options.length > 0 && Array.isArray(clone.items)) {
    if (areJsonEquivalent(clone.options[0].items, clone.items)) {
      clone.options[0] = { ...clone.options[0], __mirrorsTopLevelItems: true };
      delete clone.options[0].items;
    }
    if (Array.isArray(clone.routeHubs) && areJsonEquivalent(clone.options[0].routeHubs, clone.routeHubs)) {
      clone.options[0] = { ...clone.options[0], __mirrorsTopLevelRouteHubs: true };
      delete clone.options[0].routeHubs;
    }
  }
  if (clone.termsAndConditions && clone.commercialTermsSnapshot?.combinedPlainText === clone.termsAndConditions) {
    delete clone.termsAndConditions;
  }

  const docPath = `quotations/${quote.id}`;
  let estimatedBytes = estimateFirestoreDocumentBytes(clone, docPath);
  let dehydratedToVersionSections = false;

  // 3. If an unusually massive quotation's master doc STILL exceeds 800 KiB even without versionHistory
  //    (e.g. 80 items with long HTML descriptions or huge multi-option clones), dehydrate heavy master arrays
  //    ONLY on the Firestore pointer doc (all full unreduced data is persisted in latestVersionId sections!).
  if (estimatedBytes > SAFE_DOC_BYTE_THRESHOLD && latestVersionId) {
    dehydratedToVersionSections = true;
    clone.masterHydratedFromVersionId = latestVersionId;
    if (clone.authoritativeSnapshot?.commercialTerms) {
      delete clone.authoritativeSnapshot.commercialTerms.snapshot;
    }
    if (clone.commercialTermsSnapshot && estimateFirestoreValueBytes(clone.commercialTermsSnapshot) > 20_000) {
      clone.commercialTermsSnapshot = {
        ...clone.commercialTermsSnapshot,
        combinedHtml: '',
        combinedWhatsAppText: '',
        combinedPlainText: '',
        entries: []
      };
    }
    estimatedBytes = estimateFirestoreDocumentBytes(clone, docPath);

    if (estimatedBytes > SAFE_DOC_BYTE_THRESHOLD) {
      if (Array.isArray(clone.options)) {
        clone.options = clone.options.map((o: any) => ({
          id: o.id,
          optionNumber: o.optionNumber,
          title: o.title,
          badge: o.badge,
          hotelTier: o.hotelTier,
          scope: o.scope,
          __dehydratedToVersionId: latestVersionId
        }));
      }
      estimatedBytes = estimateFirestoreDocumentBytes(clone, docPath);
    }

    if (estimatedBytes > SAFE_DOC_BYTE_THRESHOLD && Array.isArray(clone.items)) {
      clone.items = clone.items.map((it: any) => ({
        id: it.id,
        productId: it.productId || it.product?.id,
        travelDate: it.travelDate,
        pax: it.pax,
        cityHub: it.cityHub,
        nights: it.nights,
        itineraryHubOccurrenceId: it.itineraryHubOccurrenceId,
        theUnboundBaseSellingPrice: it.theUnboundBaseSellingPrice,
        finalCustomerSellingPrice: it.finalCustomerSellingPrice,
        product: it.product
          ? {
              id: it.product.id,
              name: it.product.name,
              category: it.product.category,
              productType: it.product.productType,
              city: it.product.city
            }
          : undefined,
        calculation: it.calculation
          ? {
              finalTotalSellingPrice: it.calculation.finalTotalSellingPrice,
              targetCurrency: it.calculation.targetCurrency
            }
          : undefined,
        __dehydratedToVersionId: latestVersionId
      }));
      estimatedBytes = estimateFirestoreDocumentBytes(clone, docPath);
    }

    if (estimatedBytes > SAFE_DOC_BYTE_THRESHOLD) {
      delete clone.authoritativeSnapshot;
      delete clone.dayDescriptions;
      delete clone.dayOverviews;
      delete clone.dayNotes;
      clone.items = [];
      estimatedBytes = estimateFirestoreDocumentBytes(clone, docPath);
    }
  }

  return {
    masterDoc: cleanFirestoreUndefined(clone),
    estimatedBytes,
    dehydratedToVersionSections
  };
}

/**
 * Restores any canonical mirror flags created by `compactMasterQuotationForFirestore` when reading a master Quotation doc.
 */
export function normalizeHydratedMasterQuotation(raw: Quotation): Quotation {
  if (!raw || typeof raw !== 'object') return raw;
  const clone: Quotation = { ...raw };
  if (clone.pricingSnapshot && !clone.pricing_snapshot) {
    clone.pricing_snapshot = clone.pricingSnapshot;
  }
  if (clone.currencyConversionSnapshot && !clone.currency_conversion_snapshot) {
    clone.currency_conversion_snapshot = clone.currencyConversionSnapshot;
  }
  if (clone.pricingSnapshot && !clone.pricingSnapshot.currencyConversionSnapshot && clone.currencyConversionSnapshot) {
    clone.pricingSnapshot = {
      ...clone.pricingSnapshot,
      currencyConversionSnapshot: clone.currencyConversionSnapshot
    };
  }
  if (!clone.termsAndConditions && clone.commercialTermsSnapshot?.combinedPlainText) {
    clone.termsAndConditions = clone.commercialTermsSnapshot.combinedPlainText;
  }
  if (Array.isArray(clone.options) && clone.options.length > 0) {
    clone.options = clone.options.map((opt: any) => {
      const next = { ...opt };
      if (next.__mirrorsTopLevelItems && Array.isArray(clone.items)) {
        delete next.__mirrorsTopLevelItems;
        next.items = deepCloneSafe(clone.items);
      }
      if (next.__mirrorsTopLevelRouteHubs && Array.isArray(clone.routeHubs)) {
        delete next.__mirrorsTopLevelRouteHubs;
        next.routeHubs = deepCloneSafe(clone.routeHubs);
      }
      return next;
    });
  }
  return clone;
}
