import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AppliedPromotionSnapshot,
  CurrencyCode,
  Promotion,
  PromotionRedemptionRecord,
  PromotionReservationRecord,
  PromotionValidationResult
} from '../src/types';
import {
  buildPromotionReportRows,
  computePromotionUsageCounts,
  evaluatePromotionEligibilityAndDiscount,
  findPromotionByCode,
  normalizePromotionCode,
  PromotionEvaluationItem
} from '../src/services/promotionEngine';
import { fromFirestoreDocument, toFirestoreFields } from './marginGovernanceService';

// ============================================================================
// FIREBASE / FIRESTORE REST CONFIGURATION
// ============================================================================

function getFirebaseConfig(): {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
} {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        projectId: parsed.projectId || 'gen-lang-client-0981426327',
        apiKey: parsed.apiKey || '',
        firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)'
      };
    }
  } catch (err) {
    console.warn('[PROMO-SVC] Could not read firebase-applet-config.json:', err);
  }
  return {
    projectId: 'gen-lang-client-0981426327',
    apiKey: '',
    firestoreDatabaseId: '(default)'
  };
}

function getFirestoreBaseUrl(): string {
  const cfg = getFirebaseConfig();
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
}

const MASTER_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

export interface VerifiedPromotionCaller {
  uid: string;
  email: string;
  name: string;
  role: string;
  agencyId?: string;
  agencyName?: string;
  userDoc: Record<string, any> | null;
  idToken: string;
  isPromotionAdmin: boolean;
}

export function checkPromotionAdminAccess(
  userDoc: Record<string, any> | null,
  email: string
): boolean {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (MASTER_ADMIN_EMAILS.has(cleanEmail)) return true;
  if (!userDoc) return false;
  const role = String(userDoc.role || userDoc.userType || '').toUpperCase();
  if (role === 'BUYER' || role === 'B2B_AGENT' || role === 'AGENT' || role === 'AGENCY_OWNER') {
    return false;
  }
  if (userDoc.approvalStatus && userDoc.approvalStatus !== 'APPROVED') {
    return false;
  }
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return true;
  }
  if (role === 'TEAM_MEMBER' || role === 'DMC_STAFF') {
    const perms = userDoc.permissions || {};
    return Boolean(
      perms.canAccessCMS === true ||
      perms.cmsMarketing?.promotions === true ||
      perms.cmsMarketing?.enabled === true
    );
  }
  return false;
}

async function verifyAuthenticatedCaller(
  req: Request,
  requireAdmin: boolean = false
): Promise<
  { ok: true; caller: VerifiedPromotionCaller } | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required: missing Bearer Firebase ID token.'
    };
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required: empty Firebase ID token.'
    };
  }

  const cfg = getFirebaseConfig();
  if (!cfg.apiKey) {
    return { ok: false, status: 500, error: 'Server Firebase configuration missing apiKey.' };
  }

  let uid = '';
  let email = '';
  let displayName = '';

  try {
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(5000)
      }
    );
    if (!lookupRes.ok) {
      return { ok: false, status: 401, error: 'Invalid or expired Firebase authentication token.' };
    }
    const lookupJson = (await lookupRes.json()) as any;
    const fbUser = Array.isArray(lookupJson.users) ? lookupJson.users[0] : null;
    if (!fbUser || !fbUser.localId || fbUser.disabled) {
      return { ok: false, status: 401, error: 'Authenticated user account not found or disabled.' };
    }
    uid = fbUser.localId;
    email = (fbUser.email || '').trim().toLowerCase();
    displayName = fbUser.displayName || '';
  } catch (err: any) {
    return {
      ok: false,
      status: 503,
      error: `Unable to verify authentication token: ${err?.message || 'network error'}`
    };
  }

  let userDoc: Record<string, any> | null = null;
  try {
    const userRes = await fetch(`${getFirestoreBaseUrl()}/users/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(5000)
    });
    if (userRes.ok) {
      userDoc = fromFirestoreDocument(await userRes.json());
    }
  } catch {
    // Profile doc optional for newly created accounts
  }

  const isPromotionAdmin = checkPromotionAdminAccess(userDoc, email);
  if (requireAdmin && !isPromotionAdmin) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Only authorized Administrators can access Promotion Management controls and reports.'
    };
  }

  const role = String(
    userDoc?.role || (MASTER_ADMIN_EMAILS.has(email) ? 'ADMIN' : 'B2B_AGENT')
  ).toUpperCase();

  return {
    ok: true,
    caller: {
      uid,
      email: email || userDoc?.email || '',
      name: userDoc?.name || userDoc?.displayName || displayName || email || 'User',
      role,
      agencyId: userDoc?.companyId || userDoc?.agencyId || undefined,
      agencyName: userDoc?.agencyName || userDoc?.companyName || undefined,
      userDoc,
      idToken,
      isPromotionAdmin
    }
  };
}

// ============================================================================
// PROMOTION STORE ADAPTER (FIRESTORE REST + IN-MEMORY TESTABLE IMPLEMENTATION)
// ============================================================================

export interface PromotionStoreAdapter {
  listPromotions(token: string): Promise<Promotion[]>;
  getPromotionById(id: string, token: string): Promise<Promotion | null>;
  savePromotion(promo: Promotion, token: string): Promise<void>;
  listReservations(token: string, promotionId?: string): Promise<PromotionReservationRecord[]>;
  getReservationById(id: string, token: string): Promise<PromotionReservationRecord | null>;
  saveReservation(res: PromotionReservationRecord, token: string): Promise<void>;
  listRedemptions(token: string, promotionId?: string): Promise<PromotionRedemptionRecord[]>;
  saveRedemption(red: PromotionRedemptionRecord, token: string): Promise<void>;
}

async function fsListCollection(
  collectionId: string,
  token: string,
  maxDocs = 1000
): Promise<Record<string, any>[]> {
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collectionId)}?pageSize=${Math.min(maxDocs, 1000)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000)
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore list failed for ${collectionId} (${res.status}): ${errText}`);
  }
  const json = (await res.json()) as any;
  const docs = Array.isArray(json.documents) ? json.documents : [];
  return docs.map((d: any) => fromFirestoreDocument(d));
}

async function fsGetDoc(
  collectionId: string,
  docId: string,
  token: string
): Promise<Record<string, any> | null> {
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collectionId)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000)
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore get failed for ${collectionId}/${docId} (${res.status}): ${errText}`);
  }
  return fromFirestoreDocument(await res.json());
}

async function fsSaveDoc(
  collectionId: string,
  docId: string,
  data: Record<string, any>,
  token: string
): Promise<void> {
  const url = `${getFirestoreBaseUrl()}/${encodeURIComponent(collectionId)}/${encodeURIComponent(docId)}`;
  const fields = toFirestoreFields(data);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firestore save failed for ${collectionId}/${docId} (${res.status}): ${errText}`);
  }
}

export class FirestorePromotionStore implements PromotionStoreAdapter {
  async listPromotions(token: string): Promise<Promotion[]> {
    const docs = await fsListCollection('promotions', token);
    return docs as Promotion[];
  }

  async getPromotionById(id: string, token: string): Promise<Promotion | null> {
    const doc = await fsGetDoc('promotions', id, token);
    return doc ? (doc as Promotion) : null;
  }

  async savePromotion(promo: Promotion, token: string): Promise<void> {
    await fsSaveDoc('promotions', promo.id, promo as Record<string, any>, token);
  }

  async listReservations(token: string, promotionId?: string): Promise<PromotionReservationRecord[]> {
    try {
      const docs = (await fsListCollection('promotion_reservations', token)) as PromotionReservationRecord[];
      return promotionId ? docs.filter((r) => r.promotionId === promotionId) : docs;
    } catch {
      return [];
    }
  }

  async getReservationById(id: string, token: string): Promise<PromotionReservationRecord | null> {
    const doc = await fsGetDoc('promotion_reservations', id, token);
    return doc ? (doc as PromotionReservationRecord) : null;
  }

  async saveReservation(res: PromotionReservationRecord, token: string): Promise<void> {
    await fsSaveDoc('promotion_reservations', res.id, res as Record<string, any>, token);
  }

  async listRedemptions(token: string, promotionId?: string): Promise<PromotionRedemptionRecord[]> {
    try {
      const docs = (await fsListCollection('promotion_redemptions', token)) as PromotionRedemptionRecord[];
      return promotionId ? docs.filter((r) => r.promotionId === promotionId) : docs;
    } catch {
      return [];
    }
  }

  async saveRedemption(red: PromotionRedemptionRecord, token: string): Promise<void> {
    await fsSaveDoc('promotion_redemptions', red.id, red as Record<string, any>, token);
  }
}

export class InMemoryPromotionStore implements PromotionStoreAdapter {
  public promotions = new Map<string, Promotion>();
  public reservations = new Map<string, PromotionReservationRecord>();
  public redemptions = new Map<string, PromotionRedemptionRecord>();

  constructor(initialPromos: Promotion[] = []) {
    for (const p of initialPromos) {
      this.promotions.set(p.id, { ...p });
    }
  }

  async listPromotions(): Promise<Promotion[]> {
    return Array.from(this.promotions.values()).map((p) => ({ ...p }));
  }

  async getPromotionById(id: string): Promise<Promotion | null> {
    const found = this.promotions.get(id);
    return found ? { ...found } : null;
  }

  async savePromotion(promo: Promotion): Promise<void> {
    this.promotions.set(promo.id, { ...promo });
  }

  async listReservations(_token: string, promotionId?: string): Promise<PromotionReservationRecord[]> {
    const all = Array.from(this.reservations.values()).map((r) => ({ ...r }));
    return promotionId ? all.filter((r) => r.promotionId === promotionId) : all;
  }

  async getReservationById(id: string): Promise<PromotionReservationRecord | null> {
    const found = this.reservations.get(id);
    return found ? { ...found } : null;
  }

  async saveReservation(res: PromotionReservationRecord): Promise<void> {
    this.reservations.set(res.id, { ...res });
  }

  async listRedemptions(_token: string, promotionId?: string): Promise<PromotionRedemptionRecord[]> {
    const all = Array.from(this.redemptions.values()).map((r) => ({ ...r }));
    return promotionId ? all.filter((r) => r.promotionId === promotionId) : all;
  }

  async saveRedemption(red: PromotionRedemptionRecord): Promise<void> {
    this.redemptions.set(red.id, { ...red });
  }
}

// ============================================================================
// PER-PROMOTION SERIALIZED CONCURRENCY MUTEX & TRANSACTION MANAGER
// ============================================================================

const promotionMutexQueues = new Map<string, Promise<void>>();

async function withPromotionLock<T>(promotionKey: string, task: () => Promise<T>): Promise<T> {
  const prev = promotionMutexQueues.get(promotionKey) || Promise.resolve();
  let releaseNext!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  const chained = prev.then(() => gate);
  promotionMutexQueues.set(promotionKey, chained);

  await prev;
  try {
    return await task();
  } finally {
    releaseNext();
    if (promotionMutexQueues.get(promotionKey) === chained) {
      promotionMutexQueues.delete(promotionKey);
    }
  }
}

export interface PromotionValidatePayload {
  code: string;
  stage?: 'QUOTATION' | 'BOOKING_CONFIRMATION';
  quotationId?: string;
  quotationVersion?: number;
  quotationStatus?: string;
  isDraftQuotation?: boolean;
  isRevisedQuotation?: boolean;
  preDiscountBaseSellingPrice: number;
  currency: CurrencyCode;
  destinationId?: string;
  destinationIds?: string[];
  destinationName?: string;
  items?: PromotionEvaluationItem[];
  totalPax?: number;
  existingQuotationPromotionId?: string;
  excludeReservationId?: string;
}

export interface PromotionReservePayload extends PromotionValidatePayload {
  quotationId: string;
  quotationNumber?: string;
  quotationVersion: number;
  idempotencyKey?: string;
  ttlMinutes?: number;
}

export interface PromotionConfirmRedemptionPayload {
  promotionId?: string;
  code?: string;
  reservationId?: string;
  idempotencyKey: string;
  bookingId: string;
  bookingReference?: string;
  quotationId: string;
  quotationNumber?: string;
  quotationVersion: number;
  preDiscountBaseSellingPrice: number;
  currency: CurrencyCode;
  destinationId?: string;
  destinationIds?: string[];
  destinationName?: string;
  items?: PromotionEvaluationItem[];
  totalPax?: number;
  appliedStage?: 'QUOTATION' | 'BOOKING_CONFIRMATION';
}

export class PromotionTransactionManager {
  constructor(private readonly store: PromotionStoreAdapter) {}

  async validateCode(
    payload: PromotionValidatePayload,
    caller: Pick<VerifiedPromotionCaller, 'uid' | 'name' | 'role' | 'agencyId' | 'agencyName' | 'idToken'>,
    now: Date = new Date()
  ): Promise<PromotionValidationResult> {
    const normalized = normalizePromotionCode(payload.code);
    if (!normalized) {
      return {
        valid: false,
        errorCode: 'EMPTY_CODE',
        message: 'Please enter a promotion code.',
        validatedAt: now.toISOString(),
        source: 'SERVER'
      };
    }

    const promotions = await this.store.listPromotions(caller.idToken);
    const promotion = findPromotionByCode(promotions, normalized);
    if (!promotion) {
      return {
        valid: false,
        errorCode: 'NOT_FOUND',
        message: 'This promotion code is not recognised. Please verify the code and try again.',
        validatedAt: now.toISOString(),
        source: 'SERVER'
      };
    }

    const [redemptions, reservations] = await Promise.all([
      this.store.listRedemptions(caller.idToken, promotion.id),
      this.store.listReservations(caller.idToken, promotion.id)
    ]);

    const usageCounts = computePromotionUsageCounts({
      promotionId: promotion.id,
      redemptions,
      reservations,
      agentUid: caller.uid,
      agencyId: caller.agencyId,
      excludeReservationId: payload.excludeReservationId,
      now
    });

    const result = evaluatePromotionEligibilityAndDiscount({
      promotion,
      context: {
        code: normalized,
        stage: payload.stage || 'QUOTATION',
        quotationId: payload.quotationId,
        quotationVersion: payload.quotationVersion,
        quotationStatus: payload.quotationStatus,
        isDraftQuotation: payload.isDraftQuotation,
        isRevisedQuotation: payload.isRevisedQuotation,
        preDiscountBaseSellingPrice: Number(payload.preDiscountBaseSellingPrice || 0),
        currency: payload.currency || 'INR',
        destinationId: payload.destinationId,
        destinationIds: payload.destinationIds,
        destinationName: payload.destinationName,
        items: payload.items || [],
        totalPax: payload.totalPax || 1,
        agentUid: caller.uid,
        agentName: caller.name,
        agentRole: caller.role,
        agencyId: caller.agencyId,
        agencyName: caller.agencyName,
        existingQuotationPromotionId: payload.existingQuotationPromotionId,
        now
      },
      usageCounts
    });

    return {
      ...result,
      source: 'SERVER'
    };
  }

  /**
   * Concurrency-safe temporary reservation for booking confirmation.
   * Prevents concurrent agents from exceeding the last remaining usage slot.
   */
  async reservePromotion(
    payload: PromotionReservePayload,
    caller: Pick<VerifiedPromotionCaller, 'uid' | 'name' | 'role' | 'agencyId' | 'agencyName' | 'idToken'>,
    now: Date = new Date()
  ): Promise<{
    ok: boolean;
    validation: PromotionValidationResult;
    reservation?: PromotionReservationRecord;
    appliedPromotion?: AppliedPromotionSnapshot;
    idempotentHit?: boolean;
  }> {
    const normalized = normalizePromotionCode(payload.code);
    const promotions = await this.store.listPromotions(caller.idToken);
    const promotion = findPromotionByCode(promotions, normalized);
    if (!promotion) {
      return {
        ok: false,
        validation: {
          valid: false,
          errorCode: 'NOT_FOUND',
          message: 'This promotion code is not recognised.',
          validatedAt: now.toISOString(),
          source: 'SERVER'
        }
      };
    }

    return withPromotionLock(promotion.id, async () => {
      const idempotencyKey =
        payload.idempotencyKey ||
        `res:${promotion.id}:${payload.quotationId}:v${payload.quotationVersion || 1}:${caller.uid}`;

      const [redemptions, reservations] = await Promise.all([
        this.store.listRedemptions(caller.idToken, promotion.id),
        this.store.listReservations(caller.idToken, promotion.id)
      ]);

      // Idempotent hit: return existing active reservation for same key
      const existingActive = reservations.find(
        (r) =>
          r.idempotencyKey === idempotencyKey &&
          r.status === 'RESERVED' &&
          new Date(r.expiresAt).getTime() > now.getTime()
      );
      if (existingActive) {
        const reval = evaluatePromotionEligibilityAndDiscount({
          promotion,
          context: {
            code: normalized,
            stage: 'BOOKING_CONFIRMATION',
            quotationId: payload.quotationId,
            quotationVersion: payload.quotationVersion,
            preDiscountBaseSellingPrice: Number(payload.preDiscountBaseSellingPrice || 0),
            currency: payload.currency || 'INR',
            destinationId: payload.destinationId,
            destinationIds: payload.destinationIds,
            destinationName: payload.destinationName,
            items: payload.items || [],
            totalPax: payload.totalPax || 1,
            agentUid: caller.uid,
            agentName: caller.name,
            agentRole: caller.role,
            agencyId: caller.agencyId,
            agencyName: caller.agencyName,
            existingQuotationPromotionId: payload.existingQuotationPromotionId,
            now
          },
          usageCounts: computePromotionUsageCounts({
            promotionId: promotion.id,
            redemptions,
            reservations,
            agentUid: caller.uid,
            agencyId: caller.agencyId,
            excludeReservationId: existingActive.id,
            now
          })
        });
        const applied = reval.appliedPromotion
          ? { ...reval.appliedPromotion, reservationId: existingActive.id }
          : undefined;
        return {
          ok: true,
          validation: { ...reval, appliedPromotion: applied, source: 'SERVER' },
          reservation: existingActive,
          appliedPromotion: applied,
          idempotentHit: true
        };
      }

      const usageCounts = computePromotionUsageCounts({
        promotionId: promotion.id,
        redemptions,
        reservations,
        agentUid: caller.uid,
        agencyId: caller.agencyId,
        now
      });

      const validation = evaluatePromotionEligibilityAndDiscount({
        promotion,
        context: {
          code: normalized,
          stage: 'BOOKING_CONFIRMATION',
          quotationId: payload.quotationId,
          quotationVersion: payload.quotationVersion,
          preDiscountBaseSellingPrice: Number(payload.preDiscountBaseSellingPrice || 0),
          currency: payload.currency || 'INR',
          destinationId: payload.destinationId,
          destinationIds: payload.destinationIds,
          destinationName: payload.destinationName,
          items: payload.items || [],
          totalPax: payload.totalPax || 1,
          agentUid: caller.uid,
          agentName: caller.name,
          agentRole: caller.role,
          agencyId: caller.agencyId,
          agencyName: caller.agencyName,
          existingQuotationPromotionId: payload.existingQuotationPromotionId,
          now
        },
        usageCounts
      });

      if (!validation.valid || !validation.appliedPromotion) {
        return {
          ok: false,
          validation: { ...validation, source: 'SERVER' }
        };
      }

      const reservationId = `pres_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const ttlMs = Math.max(1, Math.min(30, Number(payload.ttlMinutes || 10))) * 60_000;

      const reservation: PromotionReservationRecord = {
        id: reservationId,
        promotionId: promotion.id,
        code: validation.appliedPromotion.code,
        normalizedCode: validation.appliedPromotion.normalizedCode,
        quotationId: payload.quotationId,
        quotationNumber: payload.quotationNumber,
        quotationVersion: payload.quotationVersion || 1,
        agentUid: caller.uid,
        agentName: caller.name,
        agencyId: caller.agencyId,
        agencyName: caller.agencyName,
        discountAmount: validation.appliedPromotion.discountAmount,
        currency: validation.appliedPromotion.currency,
        preDiscountBaseSellingPrice: validation.appliedPromotion.preDiscountBaseSellingPrice,
        discountedBaseSellingPrice: validation.appliedPromotion.discountedBaseSellingPrice,
        idempotencyKey,
        status: 'RESERVED',
        reservedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString()
      };

      await this.store.saveReservation(reservation, caller.idToken);

      const appliedWithRes: AppliedPromotionSnapshot = {
        ...validation.appliedPromotion,
        reservationId
      };

      return {
        ok: true,
        validation: { ...validation, appliedPromotion: appliedWithRes, source: 'SERVER' },
        reservation,
        appliedPromotion: appliedWithRes
      };
    });
  }

  /**
   * Idempotent final redemption commit linked to a confirmed Booking.
   * Retries with the same idempotencyKey or bookingId never create duplicate redemptions.
   */
  async confirmRedemption(
    payload: PromotionConfirmRedemptionPayload,
    caller: Pick<VerifiedPromotionCaller, 'uid' | 'name' | 'email' | 'role' | 'agencyId' | 'agencyName' | 'idToken' | 'isPromotionAdmin'>,
    now: Date = new Date()
  ): Promise<{
    ok: boolean;
    redemption?: PromotionRedemptionRecord;
    appliedPromotion?: AppliedPromotionSnapshot;
    idempotentHit?: boolean;
    error?: string;
    errorCode?: string;
  }> {
    if (!payload.bookingId || !payload.idempotencyKey) {
      return {
        ok: false,
        error: 'bookingId and idempotencyKey are required to confirm promotion redemption.',
        errorCode: 'INVALID_REQUEST'
      };
    }

    const promotions = await this.store.listPromotions(caller.idToken);
    const promotion = payload.promotionId
      ? promotions.find((p) => p.id === payload.promotionId)
      : payload.code
        ? findPromotionByCode(promotions, payload.code)
        : undefined;

    if (!promotion) {
      return {
        ok: false,
        error: 'Referenced promotion could not be found.',
        errorCode: 'NOT_FOUND'
      };
    }

    return withPromotionLock(promotion.id, async () => {
      const [redemptions, reservations] = await Promise.all([
        this.store.listRedemptions(caller.idToken, promotion.id),
        this.store.listReservations(caller.idToken, promotion.id)
      ]);

      // Idempotency check: same idempotencyKey OR same bookingId + promotionId
      const existingRedemption = redemptions.find(
        (r) =>
          r.idempotencyKey === payload.idempotencyKey ||
          (r.bookingId === payload.bookingId && r.promotionId === promotion.id && r.status === 'REDEEMED')
      );
      if (existingRedemption) {
        return {
          ok: true,
          redemption: existingRedemption,
          idempotentHit: true
        };
      }

      let reservation: PromotionReservationRecord | undefined;
      if (payload.reservationId) {
        reservation = reservations.find((r) => r.id === payload.reservationId);
        if (!reservation) {
          return {
            ok: false,
            error: 'Promotion reservation not found or already released.',
            errorCode: 'RESERVATION_NOT_FOUND'
          };
        }
        if (reservation.agentUid !== caller.uid && !caller.isPromotionAdmin) {
          return {
            ok: false,
            error: 'Unauthorized: Cannot commit another agent’s promotion reservation.',
            errorCode: 'UNAUTHORIZED'
          };
        }
        if (reservation.status === 'RELEASED' || reservation.status === 'EXPIRED') {
          return {
            ok: false,
            error: 'Promotion reservation has expired or was released. Please revalidate before confirming.',
            errorCode: 'RESERVATION_EXPIRED'
          };
        }
      }

      // Server-side authoritative recalculation (NEVER trust client discount numbers!)
      const usageCounts = computePromotionUsageCounts({
        promotionId: promotion.id,
        redemptions,
        reservations,
        agentUid: caller.uid,
        agencyId: caller.agencyId,
        excludeReservationId: reservation?.id,
        now
      });

      const validation = evaluatePromotionEligibilityAndDiscount({
        promotion,
        context: {
          code: promotion.promoCode || promotion.normalizedPromoCode || payload.code || '',
          stage: 'BOOKING_CONFIRMATION',
          quotationId: payload.quotationId,
          quotationVersion: payload.quotationVersion,
          preDiscountBaseSellingPrice: Number(payload.preDiscountBaseSellingPrice || 0),
          currency: payload.currency || 'INR',
          destinationId: payload.destinationId,
          destinationIds: payload.destinationIds,
          destinationName: payload.destinationName,
          items: payload.items || [],
          totalPax: payload.totalPax || 1,
          agentUid: caller.uid,
          agentName: caller.name,
          agentRole: caller.role,
          agencyId: caller.agencyId,
          agencyName: caller.agencyName,
          existingQuotationPromotionId: payload.appliedStage === 'QUOTATION' ? promotion.id : undefined,
          now
        },
        usageCounts
      });

      if (!validation.valid || !validation.appliedPromotion) {
        return {
          ok: false,
          error: validation.message,
          errorCode: validation.errorCode || 'VALIDATION_FAILED'
        };
      }

      const redemptionId = `pred_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const redemption: PromotionRedemptionRecord = {
        id: redemptionId,
        promotionId: promotion.id,
        promotionName: promotion.title,
        code: validation.appliedPromotion.code,
        normalizedCode: validation.appliedPromotion.normalizedCode,
        bookingId: payload.bookingId,
        bookingReference: payload.bookingReference,
        quotationId: payload.quotationId,
        quotationNumber: payload.quotationNumber,
        quotationVersion: payload.quotationVersion || 1,
        reservationId: reservation?.id,
        idempotencyKey: payload.idempotencyKey,
        agencyId: caller.agencyId,
        agencyName: caller.agencyName,
        agentUid: caller.uid,
        agentName: caller.name,
        agentEmail: caller.email,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        preDiscountBaseSellingPrice: validation.appliedPromotion.preDiscountBaseSellingPrice,
        discountAmount: validation.appliedPromotion.discountAmount,
        discountedBaseSellingPrice: validation.appliedPromotion.discountedBaseSellingPrice,
        currency: validation.appliedPromotion.currency,
        status: 'REDEEMED',
        appliedStage: payload.appliedStage || 'QUOTATION',
        redeemedAt: now.toISOString()
      };

      await this.store.saveRedemption(redemption, caller.idToken);

      if (reservation) {
        await this.store.saveReservation(
          {
            ...reservation,
            status: 'COMMITTED',
            bookingId: payload.bookingId,
            committedAt: now.toISOString()
          },
          caller.idToken
        );
      }

      const appliedSnap: AppliedPromotionSnapshot = {
        ...validation.appliedPromotion,
        appliedStage: payload.appliedStage || validation.appliedPromotion.appliedStage,
        reservationId: reservation?.id,
        redemptionId
      };

      return {
        ok: true,
        redemption,
        appliedPromotion: appliedSnap
      };
    });
  }

  /**
   * Releases a temporary reservation when booking confirmation fails or is cancelled.
   */
  async releaseReservation(
    reservationId: string,
    reason: string,
    caller: Pick<VerifiedPromotionCaller, 'uid' | 'idToken' | 'isPromotionAdmin'>,
    now: Date = new Date()
  ): Promise<{ ok: boolean; error?: string }> {
    if (!reservationId) return { ok: false, error: 'reservationId is required.' };
    const existing = await this.store.getReservationById(reservationId, caller.idToken);
    if (!existing) {
      return { ok: true }; // Already gone / never created
    }
    if (existing.agentUid !== caller.uid && !caller.isPromotionAdmin) {
      return { ok: false, error: 'Unauthorized: Cannot release another agent’s reservation.' };
    }
    if (existing.status === 'COMMITTED') {
      return { ok: false, error: 'Cannot release a reservation that has already been committed.' };
    }
    await this.store.saveReservation(
      {
        ...existing,
        status: 'RELEASED',
        releasedAt: now.toISOString(),
        releaseReason: reason || 'Booking confirmation cancelled'
      },
      caller.idToken
    );
    return { ok: true };
  }
}

// ============================================================================
// EXPRESS ROUTERS
// ============================================================================

const defaultStore = new FirestorePromotionStore();
const defaultManager = new PromotionTransactionManager(defaultStore);

export function createPromotionRouter(manager: PromotionTransactionManager = defaultManager): Router {
  const router = Router();

  // POST /api/promotions/validate
  router.post('/validate', async (req: Request, res: Response) => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!('caller' in auth)) {
      return res.status(auth.status).json({ valid: false, errorCode: 'UNAUTHORIZED', message: auth.error });
    }
    try {
      const body = req.body || {};
      const preDiscount = Number(body.preDiscountBaseSellingPrice);
      if (!Number.isFinite(preDiscount) || preDiscount < 0) {
        return res.status(400).json({
          valid: false,
          errorCode: 'ZERO_ELIGIBLE_BASE',
          message: 'Valid preDiscountBaseSellingPrice is required.'
        });
      }
      const result = await manager.validateCode(
        {
          code: String(body.code || ''),
          stage: body.stage === 'BOOKING_CONFIRMATION' ? 'BOOKING_CONFIRMATION' : 'QUOTATION',
          quotationId: body.quotationId ? String(body.quotationId) : undefined,
          quotationVersion: body.quotationVersion ? Number(body.quotationVersion) : 1,
          quotationStatus: body.quotationStatus ? String(body.quotationStatus) : undefined,
          isDraftQuotation: Boolean(body.isDraftQuotation),
          isRevisedQuotation: Boolean(body.isRevisedQuotation),
          preDiscountBaseSellingPrice: preDiscount,
          currency: (body.currency || 'INR') as CurrencyCode,
          destinationId: body.destinationId ? String(body.destinationId) : undefined,
          destinationIds: Array.isArray(body.destinationIds) ? body.destinationIds.map(String) : undefined,
          destinationName: body.destinationName ? String(body.destinationName) : undefined,
          items: Array.isArray(body.items) ? body.items : [],
          totalPax: body.totalPax ? Number(body.totalPax) : 1,
          existingQuotationPromotionId: body.existingQuotationPromotionId
            ? String(body.existingQuotationPromotionId)
            : undefined,
          excludeReservationId: body.excludeReservationId ? String(body.excludeReservationId) : undefined
        },
        auth.caller
      );
      return res.status(result.valid ? 200 : 400).json(result);
    } catch (err: any) {
      console.error('[PROMO-SVC] /validate failed:', err);
      return res.status(500).json({
        valid: false,
        message: 'Unable to validate promotion code at this time. Please try again.'
      });
    }
  });

  // POST /api/promotions/reserve
  router.post('/reserve', async (req: Request, res: Response) => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!('caller' in auth)) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    try {
      const body = req.body || {};
      if (!body.code || !body.quotationId) {
        return res.status(400).json({ ok: false, error: 'code and quotationId are required.' });
      }
      const out = await manager.reservePromotion(
        {
          code: String(body.code),
          stage: 'BOOKING_CONFIRMATION',
          quotationId: String(body.quotationId),
          quotationNumber: body.quotationNumber ? String(body.quotationNumber) : undefined,
          quotationVersion: Number(body.quotationVersion || 1),
          idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey) : undefined,
          preDiscountBaseSellingPrice: Number(body.preDiscountBaseSellingPrice || 0),
          currency: (body.currency || 'INR') as CurrencyCode,
          destinationId: body.destinationId ? String(body.destinationId) : undefined,
          destinationIds: Array.isArray(body.destinationIds) ? body.destinationIds.map(String) : undefined,
          destinationName: body.destinationName ? String(body.destinationName) : undefined,
          items: Array.isArray(body.items) ? body.items : [],
          totalPax: body.totalPax ? Number(body.totalPax) : 1,
          existingQuotationPromotionId: body.existingQuotationPromotionId
            ? String(body.existingQuotationPromotionId)
            : undefined,
          ttlMinutes: body.ttlMinutes ? Number(body.ttlMinutes) : 10
        },
        auth.caller
      );
      return res.status(out.ok ? 200 : 409).json(out);
    } catch (err: any) {
      console.error('[PROMO-SVC] /reserve failed:', err);
      return res.status(500).json({ ok: false, error: 'Unable to reserve promotion right now.' });
    }
  });

  // POST /api/promotions/confirm-redemption
  router.post('/confirm-redemption', async (req: Request, res: Response) => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!('caller' in auth)) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    try {
      const body = req.body || {};
      const out = await manager.confirmRedemption(
        {
          promotionId: body.promotionId ? String(body.promotionId) : undefined,
          code: body.code ? String(body.code) : undefined,
          reservationId: body.reservationId ? String(body.reservationId) : undefined,
          idempotencyKey: String(body.idempotencyKey || ''),
          bookingId: String(body.bookingId || ''),
          bookingReference: body.bookingReference ? String(body.bookingReference) : undefined,
          quotationId: String(body.quotationId || ''),
          quotationNumber: body.quotationNumber ? String(body.quotationNumber) : undefined,
          quotationVersion: Number(body.quotationVersion || 1),
          preDiscountBaseSellingPrice: Number(body.preDiscountBaseSellingPrice || 0),
          currency: (body.currency || 'INR') as CurrencyCode,
          destinationId: body.destinationId ? String(body.destinationId) : undefined,
          destinationIds: Array.isArray(body.destinationIds) ? body.destinationIds.map(String) : undefined,
          destinationName: body.destinationName ? String(body.destinationName) : undefined,
          items: Array.isArray(body.items) ? body.items : [],
          totalPax: body.totalPax ? Number(body.totalPax) : 1,
          appliedStage: body.appliedStage === 'BOOKING_CONFIRMATION' ? 'BOOKING_CONFIRMATION' : 'QUOTATION'
        },
        auth.caller
      );
      return res.status(out.ok ? 200 : 400).json(out);
    } catch (err: any) {
      console.error('[PROMO-SVC] /confirm-redemption failed:', err);
      return res.status(500).json({ ok: false, error: 'Unable to record promotion redemption.' });
    }
  });

  // POST /api/promotions/release-reservation
  router.post('/release-reservation', async (req: Request, res: Response) => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!('caller' in auth)) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    try {
      const body = req.body || {};
      const out = await manager.releaseReservation(
        String(body.reservationId || ''),
        String(body.reason || 'Booking cancelled'),
        auth.caller
      );
      return res.status(out.ok ? 200 : 403).json(out);
    } catch (err: any) {
      console.error('[PROMO-SVC] /release-reservation failed:', err);
      return res.status(500).json({ ok: false, error: 'Unable to release reservation.' });
    }
  });

  // GET /api/promotions/my-redemptions (Agent sees ONLY their own redemptions)
  router.get('/my-redemptions', async (req: Request, res: Response) => {
    const auth = await verifyAuthenticatedCaller(req, false);
    if (!('caller' in auth)) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    try {
      const all = await defaultStore.listRedemptions(auth.caller.idToken);
      const mine = all
        .filter((r) => r.agentUid === auth.caller.uid)
        .sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime());
      return res.json({ ok: true, redemptions: mine });
    } catch (err: any) {
      console.error('[PROMO-SVC] /my-redemptions failed:', err);
      return res.status(500).json({ ok: false, error: 'Unable to load redemption history.' });
    }
  });

  return router;
}

export function createAdminPromotionRouter(store: PromotionStoreAdapter = defaultStore): Router {
  const router = Router();

  // GET /api/admin/promotions/report (Admin-only)
  router.get('/report', async (req: Request, res: Response) => {
    const auth = await verifyAuthenticatedCaller(req, true);
    if (!('caller' in auth)) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    try {
      const [promotions, redemptions, reservations] = await Promise.all([
        store.listPromotions(auth.caller.idToken),
        store.listRedemptions(auth.caller.idToken),
        store.listReservations(auth.caller.idToken)
      ]);
      const rows = buildPromotionReportRows({ promotions, redemptions, reservations });
      return res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        rows,
        redemptions: redemptions.sort(
          (a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime()
        ),
        reservations: reservations.sort(
          (a, b) => new Date(b.reservedAt).getTime() - new Date(a.reservedAt).getTime()
        )
      });
    } catch (err: any) {
      console.error('[PROMO-SVC] /admin/report failed:', err);
      return res.status(500).json({ ok: false, error: 'Failed to generate promotion report.' });
    }
  });

  // GET /api/admin/promotions/redemptions (Admin-only)
  router.get('/redemptions', async (req: Request, res: Response) => {
    const auth = await verifyAuthenticatedCaller(req, true);
    if (!('caller' in auth)) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    try {
      const promotionId = req.query.promotionId ? String(req.query.promotionId) : undefined;
      const redemptions = await store.listRedemptions(auth.caller.idToken, promotionId);
      return res.json({
        ok: true,
        redemptions: redemptions.sort(
          (a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime()
        )
      });
    } catch (err: any) {
      console.error('[PROMO-SVC] /admin/redemptions failed:', err);
      return res.status(500).json({ ok: false, error: 'Failed to load redemptions.' });
    }
  });

  return router;
}
