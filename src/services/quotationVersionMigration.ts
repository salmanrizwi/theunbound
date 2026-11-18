import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { auth, db as firestoreDb } from './firebase';
import { canUserViewInternalCostBreakdown } from './permissionEngine';
import {
  Quotation,
  QuotationMigrationState,
  QuotationVersionSectionDocument,
  QuotationVersionSummary,
  QuoteVersionRecord,
  User
} from '../types';
import {
  FIRESTORE_MAX_DOC_BYTES,
  SAFE_DOC_BYTE_THRESHOLD,
  buildCompactVersionSummary,
  cleanFirestoreUndefined,
  compactMasterQuotationForFirestore,
  computeDeterministicHexHash,
  deepCloneSafe,
  estimateFirestoreDocumentBytes,
  estimateFirestoreValueBytes,
  measureJsonBytes,
  offloadInlineBinaryAssets,
  reconstructQuotationVersionFromSections,
  splitQuotationVersionIntoSections,
  stripRestrictedCommercialFieldsForRole,
  verifyVersionRoundTripIntegrity,
  type BinaryAssetUploadHandler,
  type VersionRoundTripVerificationReport
} from './quotationVersionStorage';

export interface FieldSizeAuditEntry {
  field: string;
  jsonBytes: number;
  firestoreBytes: number;
  percentOfPayload: number;
  itemCount?: number;
}

export interface QuotationPayloadSizeAuditReport {
  quoteId: string;
  quoteNumber: string;
  totalJsonBytes: number;
  totalFirestoreBytes: number;
  exceedsFirestoreLimit: boolean;
  exceedsSafeThreshold: boolean;
  embeddedVersionCount: number;
  topContributors: FieldSizeAuditEntry[];
  embeddedVersionBreakdown: Array<{
    versionNumber: number;
    versionId: string;
    jsonBytes: number;
    firestoreBytes: number;
    topFields: FieldSizeAuditEntry[];
  }>;
  duplicationFindings: string[];
  binaryAssetFindings: Array<{ path: string; bytes: number; mimeType: string }>;
}

const DATA_URI_RE = /^data:([a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+);base64,/;

function scanBinaryStrings(node: any, path = '', out: Array<{ path: string; bytes: number; mimeType: string }> = []) {
  if (!node) return out;
  if (typeof node === 'string') {
    const m = node.match(DATA_URI_RE);
    if (m) {
      out.push({ path: path || '(root)', bytes: node.length, mimeType: m[1] });
    }
    return out;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      scanBinaryStrings(node[i], `${path}[${i}]`, out);
    }
    return out;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      scanBinaryStrings(v, path ? `${path}.${k}` : k, out);
    }
  }
  return out;
}

/**
 * Generates an exact field-by-field byte size report on any Quotation or QuoteVersionRecord payload.
 */
export function auditQuotationPayloadSizes(rawDoc: Partial<Quotation> & Record<string, any>): QuotationPayloadSizeAuditReport {
  const quoteId = String(rawDoc.id || rawDoc.quoteId || rawDoc.quoteNumber || 'unknown');
  const totalJsonBytes = measureJsonBytes(rawDoc);
  const totalFirestoreBytes = estimateFirestoreDocumentBytes(rawDoc, `quotations/${quoteId}`);

  const topContributors: FieldSizeAuditEntry[] = Object.entries(rawDoc)
    .filter(([, val]) => val !== undefined)
    .map(([field, val]) => {
      const jsonBytes = measureJsonBytes(val);
      const firestoreBytes = estimateFirestoreValueBytes(val) + field.length + 1;
      return {
        field,
        jsonBytes,
        firestoreBytes,
        percentOfPayload: totalFirestoreBytes > 0 ? Number(((firestoreBytes / totalFirestoreBytes) * 100).toFixed(2)) : 0,
        itemCount: Array.isArray(val) ? val.length : undefined
      };
    })
    .sort((a, b) => b.firestoreBytes - a.firestoreBytes);

  const embeddedVersions: QuoteVersionRecord[] = Array.isArray(rawDoc.versionHistory) ? rawDoc.versionHistory : [];
  const embeddedVersionBreakdown = embeddedVersions.map(ver => {
    const vNum = Number(ver.versionNumber || ver.version || 1);
    const vId = ver.id || `${quoteId}__v${vNum}`;
    const vJson = measureJsonBytes(ver);
    const vFs = estimateFirestoreDocumentBytes(ver as any, `quotations/${quoteId}/versions/${vId}`);
    const topFields: FieldSizeAuditEntry[] = Object.entries(ver)
      .filter(([, val]) => val !== undefined)
      .map(([field, val]) => {
        const jb = measureJsonBytes(val);
        const fb = estimateFirestoreValueBytes(val) + field.length + 1;
        return {
          field,
          jsonBytes: jb,
          firestoreBytes: fb,
          percentOfPayload: vFs > 0 ? Number(((fb / vFs) * 100).toFixed(2)) : 0,
          itemCount: Array.isArray(val) ? val.length : undefined
        };
      })
      .sort((a, b) => b.firestoreBytes - a.firestoreBytes);
    return {
      versionNumber: vNum,
      versionId: vId,
      jsonBytes: vJson,
      firestoreBytes: vFs,
      topFields
    };
  });

  const duplicationFindings: string[] = [];
  if (embeddedVersions.length > 0) {
    duplicationFindings.push(
      `Embedded versionHistory array contains ${embeddedVersions.length} full snapshot copies (${measureJsonBytes(embeddedVersions).toLocaleString()} bytes) inside master document.`
    );
  }
  if (rawDoc.pricingSnapshot && rawDoc.pricing_snapshot) {
    duplicationFindings.push('Duplicate pricing_snapshot camelCase/snake_case mirror present.');
  }
  if (rawDoc.currencyConversionSnapshot && rawDoc.currency_conversion_snapshot) {
    duplicationFindings.push('Duplicate currency_conversion_snapshot mirror present.');
  }
  if (Array.isArray(rawDoc.options) && rawDoc.options.length > 0 && Array.isArray(rawDoc.items)) {
    const optItemsBytes = measureJsonBytes(rawDoc.options[0]?.items || []);
    if (optItemsBytes > 0) {
      duplicationFindings.push(`options[0].items duplicates top-level items array (${optItemsBytes.toLocaleString()} bytes).`);
    }
  }
  if (rawDoc.termsAndConditions && rawDoc.commercialTermsSnapshot?.combinedPlainText) {
    duplicationFindings.push(
      `termsAndConditions duplicates commercialTermsSnapshot.combinedPlainText (${measureJsonBytes(rawDoc.termsAndConditions).toLocaleString()} bytes).`
    );
  }

  const binaryAssetFindings = scanBinaryStrings(rawDoc);

  return {
    quoteId,
    quoteNumber: String(rawDoc.quoteNumber || quoteId),
    totalJsonBytes,
    totalFirestoreBytes,
    exceedsFirestoreLimit: totalFirestoreBytes >= FIRESTORE_MAX_DOC_BYTES,
    exceedsSafeThreshold: totalFirestoreBytes > SAFE_DOC_BYTE_THRESHOLD,
    embeddedVersionCount: embeddedVersions.length,
    topContributors,
    embeddedVersionBreakdown,
    duplicationFindings,
    binaryAssetFindings
  };
}

export interface MigratedVersionArtifacts {
  versionNumber: number;
  versionId: string;
  originalLogicalVersion: QuoteVersionRecord;
  manifest: QuoteVersionRecord;
  sectionDocs: QuotationVersionSectionDocument[];
  manifestBytes: number;
  maxSectionBytes: number;
  verifiedRoundTrip: boolean;
  verificationReport: VersionRoundTripVerificationReport;
  migrationState: QuotationMigrationState;
}

export interface QuotationMigrationPlanResult {
  quoteId: string;
  beforeMasterBytes: number;
  afterMasterBytes: number;
  migratedVersions: MigratedVersionArtifacts[];
  compactedMasterDoc: Record<string, any>;
  summaries: QuotationVersionSummary[];
  allDocsWithinThreshold: boolean;
  maxWrittenDocBytes: number;
}

export interface SplitVersionPersistenceAdapter {
  getManifest: (quoteId: string, versionId: string) => Promise<QuoteVersionRecord | null>;
  createManifest: (quoteId: string, versionId: string, data: QuoteVersionRecord) => Promise<void>;
  updateManifest: (quoteId: string, versionId: string, patch: Partial<QuoteVersionRecord>) => Promise<void>;
  deleteUncommittedManifest: (quoteId: string, versionId: string) => Promise<void>;
  getSections: (quoteId: string, versionId: string) => Promise<QuotationVersionSectionDocument[]>;
  createSection: (quoteId: string, versionId: string, sectionId: string, data: QuotationVersionSectionDocument) => Promise<void>;
  deleteSection: (quoteId: string, versionId: string, sectionId: string) => Promise<void>;
}

const defaultFirestorePersistenceAdapter: SplitVersionPersistenceAdapter = {
  async getManifest(quoteId, versionId) {
    const snap = await getDoc(doc(firestoreDb, 'quotations', quoteId, 'versions', versionId));
    return snap.exists() ? (snap.data() as QuoteVersionRecord) : null;
  },
  async createManifest(quoteId, versionId, data) {
    await setDoc(doc(firestoreDb, 'quotations', quoteId, 'versions', versionId), cleanFirestoreUndefined(data));
  },
  async updateManifest(quoteId, versionId, patch) {
    await setDoc(
      doc(firestoreDb, 'quotations', quoteId, 'versions', versionId),
      cleanFirestoreUndefined(patch),
      { merge: true }
    );
  },
  async deleteUncommittedManifest(quoteId, versionId) {
    await deleteDoc(doc(firestoreDb, 'quotations', quoteId, 'versions', versionId));
  },
  async getSections(quoteId, versionId) {
    const snap = await getDocs(collection(firestoreDb, 'quotations', quoteId, 'versions', versionId, 'sections'));
    return snap.docs.map(d => d.data() as QuotationVersionSectionDocument);
  },
  async createSection(quoteId, versionId, sectionId, data) {
    await setDoc(
      doc(firestoreDb, 'quotations', quoteId, 'versions', versionId, 'sections', sectionId),
      cleanFirestoreUndefined(data)
    );
  },
  async deleteSection(quoteId, versionId, sectionId) {
    await deleteDoc(doc(firestoreDb, 'quotations', quoteId, 'versions', versionId, 'sections', sectionId));
  }
};

/**
 * Safe, idempotent, partial-migration-aware writer & read-back verifier for a single split version.
 * 1. Inspects existing Firestore manifest & section docs BEFORE writing.
 * 2. Reuses already-committed valid versions or matching valid sections (never creates duplicate section docs).
 * 3. Preserves existing legacy SINGLE_DOC_V1 manifest untouched until all sections are written, read back, and verified.
 * 4. Reads written documents back from Firestore, reconstructs, canonicalizes, and runs full 12-domain verification.
 * 5. Records VERIFICATION_FAILED & failing field paths without corrupting historical data if any check fails.
 */
export async function persistVerifiedSplitVersionAsync(params: {
  quoteId: string;
  versionId: string;
  originalLogicalVersion: QuoteVersionRecord;
  stagedManifest: QuoteVersionRecord;
  sectionDocs: QuotationVersionSectionDocument[];
  isLatest: boolean;
  committedAt?: string;
  migrationStatus?: 'MIGRATED_FROM_V1' | 'NATIVE_V2';
  adapter?: SplitVersionPersistenceAdapter;
  testHooks?: {
    failAfterSectionIndex?: number;
    tamperReadBackSections?: (secs: QuotationVersionSectionDocument[]) => QuotationVersionSectionDocument[];
  };
}): Promise<{
  committedManifest: QuoteVersionRecord;
  readBackSections: QuotationVersionSectionDocument[];
  verificationReport: VersionRoundTripVerificationReport;
  reusedExistingSectionCount: number;
  writtenSectionCount: number;
}> {
  const {
    quoteId,
    versionId,
    originalLogicalVersion,
    stagedManifest,
    sectionDocs,
    isLatest,
    committedAt = new Date().toISOString(),
    migrationStatus = 'MIGRATED_FROM_V1',
    adapter = defaultFirestorePersistenceAdapter,
    testHooks
  } = params;

  const existingManifest = await adapter.getManifest(quoteId, versionId);
  const existingSections = await adapter.getSections(quoteId, versionId);
  const isLegacySingleDoc =
    Boolean(existingManifest) &&
    (!existingManifest!.storageFormat || existingManifest!.storageFormat === 'SINGLE_DOC_V1') &&
    existingManifest!.manifestStatus !== 'PREPARING' &&
    existingManifest!.manifestStatus !== 'FAILED';

  const expectedSectionById = new Map<string, QuotationVersionSectionDocument>();
  sectionDocs.forEach(s => expectedSectionById.set(s.sectionId, s));

  // If already cleanly committed as SPLIT_SECTIONS_V2, verify existing sections & reuse idempotently
  if (
    existingManifest &&
    existingManifest.storageFormat === 'SPLIT_SECTIONS_V2' &&
    existingManifest.manifestStatus === 'COMMITTED' &&
    existingSections.length === sectionDocs.length
  ) {
    try {
      const reconstructedExisting = reconstructQuotationVersionFromSections(
        existingManifest,
        existingSections,
        { verifyIntegrity: true }
      );
      const existingReport = verifyVersionRoundTripIntegrity({
        originalVersion: originalLogicalVersion,
        reconstructedVersion: reconstructedExisting,
        manifest: existingManifest,
        sectionDocs: existingSections
      });
      if (existingReport.passed) {
        return {
          committedManifest: existingManifest,
          readBackSections: existingSections,
          verificationReport: existingReport,
          reusedExistingSectionCount: existingSections.length,
          writtenSectionCount: 0
        };
      }
    } catch {
      // Fall through only if existing split manifest is inconsistent and uncommitted/recoverable
    }
    if (existingManifest.manifestStatus === 'COMMITTED') {
      throw new Error(
        `Committed split version "${versionId}" already exists and failed integrity audit; refusing to overwrite committed historical snapshot.`
      );
    }
  }

  // Classify existing section docs: reuse valid matching ones, remove only stale/invalid uncommitted sections
  const validExistingIds = new Set<string>();
  const invalidExistingIds: string[] = [];
  for (const existingSec of existingSections) {
    const sid = existingSec.sectionId || existingSec.id;
    const expected = expectedSectionById.get(sid);
    if (
      expected &&
      existingSec.contentHash === expected.contentHash &&
      computeDeterministicHexHash(cleanFirestoreUndefined(existingSec.data || {})) === expected.contentHash
    ) {
      validExistingIds.add(sid);
    } else {
      invalidExistingIds.push(sid);
    }
  }

  // Only delete stale uncommitted PREPARING/FAILED manifest & invalid sections (NEVER delete SINGLE_DOC_V1 or COMMITTED!)
  if (
    existingManifest &&
    !isLegacySingleDoc &&
    (existingManifest.manifestStatus === 'PREPARING' || existingManifest.manifestStatus === 'FAILED')
  ) {
    for (const invalidId of invalidExistingIds) {
      await adapter.deleteSection(quoteId, versionId, invalidId);
    }
    await adapter.deleteUncommittedManifest(quoteId, versionId);
  } else if (!existingManifest && invalidExistingIds.length > 0) {
    // Recreate clean temporary PREPARING parent so invalid orphan sections can be deleted if needed
    await adapter.createManifest(quoteId, versionId, {
      ...stagedManifest,
      manifestStatus: 'PREPARING',
      migrationStatus,
      migrationState: 'IN_PROGRESS',
      isLatest: false
    });
    for (const invalidId of invalidExistingIds) {
      await adapter.deleteSection(quoteId, versionId, invalidId);
    }
    await adapter.deleteUncommittedManifest(quoteId, versionId);
  }

  // Stage manifest as PREPARING ONLY when there isn't an intact legacy SINGLE_DOC_V1 document at verRef
  if (!isLegacySingleDoc) {
    await adapter.createManifest(quoteId, versionId, {
      ...stagedManifest,
      manifestStatus: 'PREPARING',
      migrationStatus,
      migrationState: 'IN_PROGRESS',
      isLatest: false
    });
  }

  let writtenSectionCount = 0;
  try {
    for (let i = 0; i < sectionDocs.length; i += 1) {
      const secDoc = sectionDocs[i];
      if (validExistingIds.has(secDoc.sectionId)) {
        continue;
      }
      if (testHooks?.failAfterSectionIndex !== undefined && i >= testHooks.failAfterSectionIndex) {
        throw new Error(
          `Simulated section write failure at index ${i} (${secDoc.sectionId}) for ${versionId}`
        );
      }
      await adapter.createSection(quoteId, versionId, secDoc.sectionId, secDoc);
      writtenSectionCount += 1;
    }

    // Read written section documents back from Firestore before committing
    let readBackSections = await adapter.getSections(quoteId, versionId);
    if (testHooks?.tamperReadBackSections) {
      readBackSections = testHooks.tamperReadBackSections(readBackSections);
    }

    const verifyTargetManifest: QuoteVersionRecord = {
      ...stagedManifest,
      manifestStatus: 'COMMITTED',
      committedAt,
      migrationStatus,
      migrationState: 'VERIFIED',
      isLatest
    };

    const reconstructed = reconstructQuotationVersionFromSections(
      verifyTargetManifest,
      readBackSections,
      { verifyIntegrity: true }
    );

    const verificationReport = verifyVersionRoundTripIntegrity({
      originalVersion: originalLogicalVersion,
      reconstructedVersion: reconstructed,
      manifest: verifyTargetManifest,
      sectionDocs: readBackSections
    });

    if (!verificationReport.passed) {
      const topPaths = verificationReport.failingFieldPaths
        .slice(0, 8)
        .map(f => `${f.path} (${f.reason})`)
        .join('; ');
      const errMsg = `Legacy backfill round-trip verification failed for ${versionId}. Hash ${verificationReport.originalCanonicalHash} vs ${verificationReport.reconstructedCanonicalHash}. Failing paths: ${topPaths}`;
      if (!isLegacySingleDoc) {
        await adapter
          .updateManifest(quoteId, versionId, {
            manifestStatus: 'FAILED',
            migrationState: 'VERIFICATION_FAILED',
            failureReason: errMsg,
            failingFieldPaths: verificationReport.failingFieldPaths.map(f => f.path),
            isLatest: false,
            updatedAt: new Date().toISOString()
          })
          .catch(() => undefined);
      }
      const err: any = new Error(errMsg);
      err.verificationReport = verificationReport;
      throw err;
    }

    const verifiedAt = new Date().toISOString();
    const committedPatch: Partial<QuoteVersionRecord> = {
      storageFormat: 'SPLIT_SECTIONS_V2',
      schemaVersion: stagedManifest.schemaVersion,
      manifestStatus: 'COMMITTED',
      committedAt,
      sectionIds: stagedManifest.sectionIds,
      sections: stagedManifest.sections,
      sectionCount: stagedManifest.sectionCount,
      chunkCount: stagedManifest.chunkCount,
      sectionsIntegrityHash: stagedManifest.sectionsIntegrityHash,
      totalReconstructedBytes: stagedManifest.totalReconstructedBytes,
      migrationStatus,
      migrationState: 'COMMITTED',
      migratedAt: stagedManifest.migratedAt || verifiedAt,
      verifiedAt,
      isLatest,
      isImmutable: true,
      updatedAt: verifiedAt
    };

    await adapter.updateManifest(quoteId, versionId, committedPatch);

    return {
      committedManifest: {
        ...verifyTargetManifest,
        ...committedPatch,
        migrationState: 'COMMITTED',
        verifiedAt
      },
      readBackSections,
      verificationReport,
      reusedExistingSectionCount: validExistingIds.size,
      writtenSectionCount
    };
  } catch (stageErr: any) {
    if (!isLegacySingleDoc) {
      const failReason = stageErr?.message || 'Split version verification failed.';
      const isVerifyError =
        Boolean(stageErr?.verificationReport) ||
        failReason.includes('hash mismatch') ||
        failReason.includes('Incomplete split quotation version') ||
        failReason.includes('round-trip verification failed');
      await adapter
        .updateManifest(quoteId, versionId, {
          manifestStatus: 'FAILED',
          migrationState: isVerifyError ? 'VERIFICATION_FAILED' : 'IN_PROGRESS',
          failureReason: failReason,
          failingFieldPaths: stageErr?.verificationReport?.failingFieldPaths?.map((f: any) => f.path),
          isLatest: false,
          updatedAt: new Date().toISOString()
        })
        .catch(() => undefined);
    }
    throw stageErr;
  }
}

/**
 * Pure non-destructive planner & verifier that converts a legacy single-doc Quotation
 * (with embedded `versionHistory` and/or overloaded master document) into:
 * - SPLIT_SECTIONS_V2 manifests + sections (with automatic chunking <= 800 KiB)
 * - Full 12-domain lossless canonical round-trip check on EVERY migrated version
 * - Compacted master document with `versionHistory: []` + `versionSummaries` (<= 800 KiB)
 */
export async function buildNonDestructiveQuotationMigrationPlan(
  rawQuote: Quotation,
  options: {
    maxDocBytes?: number;
    existingSubcollectionVersions?: QuoteVersionRecord[];
    storageUploader?: BinaryAssetUploadHandler;
    enableStorageUpload?: boolean;
    user?: User | null;
    allowInternalCosts?: boolean;
  } = {}
): Promise<QuotationMigrationPlanResult> {
  const maxDocBytes = options.maxDocBytes ?? SAFE_DOC_BYTE_THRESHOLD;
  const quoteId = rawQuote.id || rawQuote.quoteNumber || `quote-${Date.now()}`;
  const beforeMasterBytes = estimateFirestoreDocumentBytes(rawQuote as any, `quotations/${quoteId}`);
  const migratedAt = new Date().toISOString();
  const allowInternalCosts =
    options.allowInternalCosts !== undefined
      ? options.allowInternalCosts
      : options.user
        ? canUserViewInternalCostBreakdown(options.user)
        : true;

  // Offload any oversized > 2KB base64 blobs cleanly if storage uploader is available
  const offloadRes = await offloadInlineBinaryAssets(deepCloneSafe(rawQuote), quoteId, {
    minByteThreshold: 2048,
    uploadHandler: options.storageUploader,
    enableStorageUpload: options.enableStorageUpload ?? false
  });
  const sourceQuote = offloadRes.payload;

  // Gather all unique historical versions from embedded `versionHistory` + subcollection docs (or synthesize v1)
  const versionMap = new Map<number, QuoteVersionRecord>();
  const candidates: QuoteVersionRecord[] = [
    ...(Array.isArray(sourceQuote.versionHistory) ? sourceQuote.versionHistory : []),
    ...(options.existingSubcollectionVersions || [])
  ];
  candidates.forEach(c => {
    const vNum = Number(c.versionNumber || c.version || 0);
    if (vNum <= 0) return;
    const prev = versionMap.get(vNum);
    if (!prev || (c.items?.length || 0) >= (prev.items?.length || 0)) {
      versionMap.set(vNum, c);
    }
  });

  let synthesizedFromMaster = false;
  if (versionMap.size === 0) {
    synthesizedFromMaster = true;
    const fallbackVer = Number(sourceQuote.latestVersion || sourceQuote.version || 1);
    versionMap.set(fallbackVer, {
      id: `${quoteId}__v${fallbackVer}`,
      version: fallbackVer,
      versionNumber: fallbackVer,
      quoteId,
      quoteNumber: sourceQuote.quoteNumber || quoteId,
      leadId: sourceQuote.leadId || sourceQuote.linkedLeadId,
      createdAt: sourceQuote.createdAt || migratedAt,
      updatedAt: sourceQuote.updatedAt || migratedAt,
      updatedBy: sourceQuote.updatedBy || sourceQuote.createdByName || 'Migration Engine',
      savedByName: sourceQuote.latestSavedBy || sourceQuote.createdByName || 'Migration Engine',
      savedByRole: (sourceQuote.createdByUserType as any) || 'B2B_AGENT',
      agentId: sourceQuote.agentId,
      userId: sourceQuote.userId || sourceQuote.createdBy,
      status: sourceQuote.status || 'SAVED',
      proposalStatus: sourceQuote.proposalStatus || 'saved',
      changesSummary: `Migrated snapshot v${fallbackVer}`,
      title: sourceQuote.title,
      destination: sourceQuote.destination,
      clientName: sourceQuote.clientName,
      clientEmail: sourceQuote.clientEmail,
      clientPhone: sourceQuote.clientPhone,
      clientCompany: sourceQuote.clientCompany,
      nationality: sourceQuote.nationality,
      travelStyle: sourceQuote.travelStyle,
      mealPlanPreference: sourceQuote.mealPlanPreference,
      travelStartDate: sourceQuote.travelStartDate,
      travelEndDate: sourceQuote.travelEndDate,
      totalPax: sourceQuote.totalPax,
      adultsCount: sourceQuote.adultsCount,
      childrenCount: sourceQuote.childrenCount,
      infantsCount: sourceQuote.infantsCount,
      childAges: sourceQuote.childAges,
      currency: sourceQuote.currency || 'USD',
      totalNetCost: sourceQuote.totalNetCost || 0,
      totalSellingPrice: sourceQuote.finalCustomerSellingPrice ?? sourceQuote.totalSellingPrice ?? 0,
      theUnboundBaseSellingPrice: sourceQuote.theUnboundBaseSellingPrice ?? sourceQuote.baseFinalSellingPrice,
      agentMarginType: sourceQuote.agentMarginType,
      agentMarginValue: sourceQuote.agentMarginValue,
      agentMarginAmount: sourceQuote.agentMarginAmount,
      overallDiscountPercent: sourceQuote.overallDiscountPercent,
      marginPercent: sourceQuote.overallMarkupPercent || 15,
      marginAmount: sourceQuote.totalMargin || 0,
      items: sourceQuote.items || [],
      routeHubs: sourceQuote.routeHubs || [],
      dayThemes: sourceQuote.dayThemes,
      dayDescriptions: sourceQuote.dayDescriptions,
      dayOverviews: sourceQuote.dayOverviews,
      dayNotes: sourceQuote.dayNotes,
      itineraryOverview: sourceQuote.itineraryOverview,
      inclusions: sourceQuote.inclusions,
      exclusions: sourceQuote.exclusions,
      importantInformation: sourceQuote.importantInformation,
      cancellationPolicy: sourceQuote.cancellationPolicy,
      options: sourceQuote.options,
      activeOptionId: sourceQuote.activeOptionId,
      quotationScope: sourceQuote.quotationScope || sourceQuote.scope,
      pricingSnapshot: sourceQuote.pricingSnapshot,
      currencyConversionSnapshot: sourceQuote.currencyConversionSnapshot,
      commercialTermsSnapshot: sourceQuote.commercialTermsSnapshot,
      authoritativeSnapshot: sourceQuote.authoritativeSnapshot,
      passengerBreakdown: sourceQuote.passengerBreakdown,
      roomingConfig: sourceQuote.roomingConfig,
      agentNotes: typeof sourceQuote.agentNotes === 'string' ? sourceQuote.agentNotes : undefined,
      termsAndConditions: sourceQuote.termsAndConditions,
      brandingMode: sourceQuote.brandingMode || 'STANDARD',
      brandingSnapshot: sourceQuote.brandingSnapshot,
      snapshotHash: sourceQuote.snapshotHash,
      isLatest: true,
      isImmutable: true
    });
  }

  const sortedVersions = Array.from(versionMap.values()).sort((a, b) => (b.version || 0) - (a.version || 0));
  const highestVer = sortedVersions[0]?.version || 1;
  const migratedVersions: MigratedVersionArtifacts[] = [];
  let maxWrittenDocBytes = 0;

  const masterForSplit = stripRestrictedCommercialFieldsForRole(sourceQuote, allowInternalCosts);

  for (const ver of sortedVersions) {
    const vNum = Number(ver.versionNumber || ver.version || 1);
    const verId = `${quoteId}__v${vNum}`;
    const enrichedVerRaw: QuoteVersionRecord = {
      ...ver,
      id: verId,
      quoteId,
      version: vNum,
      versionNumber: vNum,
      isLatest: vNum === highestVer,
      isImmutable: true,
      migrationStatus: 'MIGRATED_FROM_V1',
      migratedAt
    };

    // Sanitize BEFORE computing section hashes when user is a B2B Agent
    const versionForSplit = stripRestrictedCommercialFieldsForRole(enrichedVerRaw, allowInternalCosts);

    const split = splitQuotationVersionIntoSections(masterForSplit, versionForSplit, {
      maxDocBytes,
      manifestStatus: 'COMMITTED',
      preserveHistoricalIsolation: !synthesizedFromMaster
    });
    const finalManifest: QuoteVersionRecord = {
      ...split.manifest,
      manifestStatus: 'COMMITTED',
      committedAt: ver.committedAt || ver.updatedAt || migratedAt,
      migrationStatus: 'MIGRATED_FROM_V1',
      migrationState: 'VERIFIED',
      migratedAt,
      verifiedAt: migratedAt
    };

    // Mandatory 12-domain lossless round-trip verification BEFORE approving master compaction
    const reconstructed = reconstructQuotationVersionFromSections(finalManifest, split.sectionDocs, {
      verifyIntegrity: true
    });
    const verificationReport = verifyVersionRoundTripIntegrity({
      originalVersion: versionForSplit,
      reconstructedVersion: reconstructed,
      manifest: finalManifest,
      sectionDocs: split.sectionDocs
    });
    if (!verificationReport.passed) {
      const topPaths = verificationReport.failingFieldPaths
        .slice(0, 6)
        .map(f => `${f.path} (${f.reason})`)
        .join('; ');
      throw new Error(
        `Migration round-trip verification failed for ${verId}: failing field paths [${topPaths}]`
      );
    }

    const manifestBytes = estimateFirestoreDocumentBytes(finalManifest as any, `quotations/${quoteId}/versions/${verId}`);
    const maxSecBytes = split.sectionDocs.reduce((m, s) => Math.max(m, s.estimatedBytes), 0);
    maxWrittenDocBytes = Math.max(maxWrittenDocBytes, manifestBytes, maxSecBytes);

    migratedVersions.push({
      versionNumber: vNum,
      versionId: verId,
      originalLogicalVersion: versionForSplit,
      manifest: finalManifest,
      sectionDocs: split.sectionDocs,
      manifestBytes,
      maxSectionBytes: maxSecBytes,
      verifiedRoundTrip: true,
      verificationReport,
      migrationState: 'VERIFIED'
    });
  }

  const summaries: QuotationVersionSummary[] = migratedVersions.map(m =>
    buildCompactVersionSummary(m.manifest)
  );
  const latestVerId = `${quoteId}__v${highestVer}`;
  const compacted = compactMasterQuotationForFirestore(masterForSplit, summaries, latestVerId);
  const finalMasterDoc = {
    ...compacted.masterDoc,
    latestVersion: highestVer,
    latestVersionId: latestVerId,
    versionCount: summaries.length,
    migrationStatus: 'MIGRATED_FROM_V1',
    migrationState: 'COMMITTED' as QuotationMigrationState,
    migratedAt,
    verifiedAt: migratedAt
  };
  const afterMasterBytes = estimateFirestoreDocumentBytes(finalMasterDoc, `quotations/${quoteId}`);
  maxWrittenDocBytes = Math.max(maxWrittenDocBytes, afterMasterBytes);

  return {
    quoteId,
    beforeMasterBytes,
    afterMasterBytes,
    migratedVersions,
    compactedMasterDoc: finalMasterDoc,
    summaries,
    allDocsWithinThreshold: maxWrittenDocBytes <= maxDocBytes && maxWrittenDocBytes < FIRESTORE_MAX_DOC_BYTES,
    maxWrittenDocBytes
  };
}

/**
 * Executes a non-destructive Firestore migration for a given quotation ID using the authenticated client SDK.
 * Preserves ALL historical versions inside `/quotations/{quoteId}/versions/{versionId}/sections/*`,
 * verifies every version via read-back from Firestore BEFORE compacting `quotations/{quoteId}`,
 * and handles partially migrated versions safely without overwriting or deleting historical records.
 */
export async function migrateSingleQuotationInFirestoreAsync(
  quoteId: string,
  options: { user?: User | null } = {}
): Promise<QuotationMigrationPlanResult> {
  if (!auth.currentUser) {
    throw new Error('Authentication required before running live Firestore migration.');
  }
  const quoteRef = doc(firestoreDb, 'quotations', quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) {
    throw new Error(`Quotation ${quoteId} does not exist in Firestore.`);
  }
  const rawQuote = { ...(quoteSnap.data() as Quotation), id: (quoteSnap.data() as any).id || quoteSnap.id };

  const existingVersSnap = await getDocs(collection(firestoreDb, 'quotations', quoteId, 'versions'));
  const existingSubcolVers = existingVersSnap.docs.map(d => d.data() as QuoteVersionRecord);

  const plan = await buildNonDestructiveQuotationMigrationPlan(rawQuote, {
    existingSubcollectionVersions: existingSubcolVers,
    enableStorageUpload: true,
    user: options.user ?? null
  });
  if (!plan.allDocsWithinThreshold) {
    throw new Error(
      `Migration plan aborted for ${quoteId}: doc size ${plan.maxWrittenDocBytes} exceeds ${SAFE_DOC_BYTE_THRESHOLD} bytes.`
    );
  }

  for (const mv of plan.migratedVersions) {
    try {
      const persisted = await persistVerifiedSplitVersionAsync({
        quoteId,
        versionId: mv.versionId,
        originalLogicalVersion: mv.originalLogicalVersion,
        stagedManifest: mv.manifest,
        sectionDocs: mv.sectionDocs,
        isLatest: Boolean(mv.manifest.isLatest),
        committedAt: mv.manifest.committedAt,
        migrationStatus: 'MIGRATED_FROM_V1'
      });
      mv.manifest = persisted.committedManifest;
      mv.migrationState = 'COMMITTED';
    } catch (err: any) {
      await setDoc(
        quoteRef,
        cleanFirestoreUndefined({
          migrationState: 'VERIFICATION_FAILED',
          versionMigrationStates: {
            ...(rawQuote.versionMigrationStates || {}),
            [mv.versionId]: {
              state: 'VERIFICATION_FAILED',
              updatedAt: new Date().toISOString(),
              error: err?.message || 'Verification failed',
              failingFieldPaths: err?.verificationReport?.failingFieldPaths?.map((f: any) => f.path) || []
            }
          }
        }),
        { merge: true }
      ).catch(() => undefined);
      throw err;
    }
  }

  await setDoc(quoteRef, cleanFirestoreUndefined(plan.compactedMasterDoc), { merge: true });
  return plan;
}
