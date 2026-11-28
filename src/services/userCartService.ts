import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';
import { auth, db as firestoreDb } from './firebase';
import { AppDatabase, cleanForFirestore } from './db';
import {
  CartAddedByRole,
  Product,
  QuarantinedLegacyCartItem,
  QuoteItem,
  User,
  UserCartItemDocument,
  UserCartPassengerConfig
} from '../types';

// ============================================================================
// CONSTANTS & STRUCTURED FIRESTORE ERROR HANDLING
// ============================================================================

export const USER_CART_SCHEMA_VERSION = 2;
export const LEGACY_SHARED_CART_KEY = 'theunbound_cart_items';
export const UID_CART_CACHE_PREFIX = 'theunbound_cart_v2_uid_';
export const ADMIN_QUARANTINE_LOCAL_KEY = 'theunbound_admin_quarantined_legacy_cart_v1';

const MASTER_ADMIN_EMAILS = new Set([
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
]);

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export enum CartOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface CartFirestoreErrorInfo {
  error: string;
  operationType: CartOperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleCartFirestoreError(
  error: unknown,
  operationType: CartOperationType,
  path: string | null,
  rethrow = false
): CartFirestoreErrorInfo {
  const errInfo: CartFirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('[USER-CART] Firestore Error:', JSON.stringify(errInfo));
  if (rethrow) {
    throw new Error(JSON.stringify(errInfo));
  }
  return errInfo;
}

// ============================================================================
// AUTHORITATIVE IDENTITY, OWNERSHIP & ROLE VALIDATION
// ============================================================================

export function isValidCartDocumentId(id: string | undefined | null): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

export function sanitizeCartItemId(rawId?: string): string {
  const base = (rawId || `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return base || `cart_${Date.now()}`;
}

/**
 * Resolves the canonical Firebase Authentication UID for cart ownership.
 * STRICT RULE: Agency ID is NEVER accepted as a primary cart owner identifier.
 * Returns null if unauthenticated, anonymous, or BUYER.
 */
export function resolveAuthenticatedCartUid(
  user: User | null | undefined,
  firebaseUser?: { uid?: string | null; isAnonymous?: boolean } | null
): string | null {
  if (!user) return null;
  if (user.role === 'BUYER' || (user as any).userType === 'BUYER') return null;
  if (firebaseUser?.isAnonymous) return null;

  const fbUid = typeof firebaseUser?.uid === 'string' ? firebaseUser.uid.trim() : '';
  const profileFbUid = typeof (user as any).firebaseUid === 'string' ? (user as any).firebaseUid.trim() : '';
  const userId = typeof user.id === 'string' ? user.id.trim() : '';

  const resolved = fbUid || profileFbUid || userId;
  if (!resolved || !isValidCartDocumentId(resolved)) return null;
  return resolved;
}

/**
 * Strictly checks whether an actor is an authorised CMS Admin permitted to manage
 * another agent's cart or inspect quarantined legacy cart records.
 * Ordinary B2B Agents, Buyers, and standard Team Members are explicitly rejected.
 */
export function isAuthorisedCartAdmin(actor: User | null | undefined): boolean {
  if (!actor) return false;
  const email = (actor.email || '').trim().toLowerCase();
  if (MASTER_ADMIN_EMAILS.has(email)) return true;

  const role = String(actor.role || '').toUpperCase();
  const status = String(actor.approvalStatus || 'APPROVED').toUpperCase();
  if (status !== 'APPROVED') return false;

  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function resolveTargetAgentUid(targetAgent: User | null | undefined): string | null {
  if (!targetAgent) return null;
  if (targetAgent.role === 'BUYER' || (targetAgent as any).userType === 'BUYER') return null;
  const uid = (
    (typeof (targetAgent as any).firebaseUid === 'string' && (targetAgent as any).firebaseUid.trim()) ||
    (typeof targetAgent.id === 'string' && targetAgent.id.trim()) ||
    ''
  );
  if (!uid || !isValidCartDocumentId(uid)) return null;
  return uid;
}

export function resolveSecondaryAgencyId(user: User | null | undefined): string | null {
  if (!user) return null;
  const raw =
    (user as any).companyId ||
    (user as any).agencyId ||
    null;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim().slice(0, 128) : null;
}

// ============================================================================
// COMPACT PAYLOAD SANITIZATION & SCHEMA BUILDERS
// ============================================================================

export function compactQuoteItemPayloadForCart(item: QuoteItem): QuoteItem {
  const prod = item.product as any;
  if (!prod) return { ...item };

  const nextProd: Record<string, any> = { ...prod };
  if (Array.isArray(prod.galleryImages) && prod.galleryImages.length > 1) {
    nextProd.galleryImages = prod.galleryImages.slice(0, 1);
  }
  if (Array.isArray(prod.images) && prod.images.length > 1) {
    nextProd.images = prod.images.slice(0, 1);
  }
  if (typeof prod.image === 'string' && prod.image.startsWith('data:') && prod.image.length > 8192) {
    delete nextProd.image;
  }
  if (typeof prod.longDescription === 'string' && prod.longDescription.length > 600) {
    nextProd.longDescription = prod.longDescription.slice(0, 600);
  }
  if (Array.isArray(prod.roomTypes) && prod.roomTypes.length > 0) {
    delete nextProd.roomTypes;
  }

  return {
    ...item,
    product: nextProd as Product
  };
}

export function buildUserCartItemDocument(params: {
  ownerUid: string;
  agencyId?: string | null;
  quoteItem: QuoteItem;
  addedByUid: string;
  addedByRole: CartAddedByRole;
  addedByName?: string;
  addedByEmail?: string;
  adminNote?: string;
  existingDoc?: UserCartItemDocument | null;
}): UserCartItemDocument {
  const {
    ownerUid,
    agencyId = null,
    quoteItem,
    addedByUid,
    addedByRole,
    addedByName,
    addedByEmail,
    adminNote,
    existingDoc
  } = params;

  if (!isValidCartDocumentId(ownerUid)) {
    throw new Error('Invalid ownerUid: cart item requires a valid Firebase Authentication UID.');
  }
  if (!isValidCartDocumentId(addedByUid)) {
    throw new Error('Invalid addedByUid: cart item requires a valid actor Firebase Authentication UID.');
  }

  // Immutable ownership check on update
  if (existingDoc && existingDoc.ownerUid !== ownerUid) {
    throw new Error('Forbidden: ownerUid on an existing cart item is immutable and cannot be changed.');
  }

  const nowIso = new Date().toISOString();
  const cartItemId = existingDoc?.cartItemId || sanitizeCartItemId(quoteItem.id);
  const compactedItem = compactQuoteItemPayloadForCart({
    ...quoteItem,
    id: cartItemId,
    ownerUid,
    agencyId: existingDoc?.agencyId ?? agencyId ?? null,
    addedByUid: existingDoc?.addedByUid || addedByUid,
    addedByRole: existingDoc?.addedByRole || addedByRole,
    addedByName: existingDoc?.addedByName || addedByName,
    addedByEmail: existingDoc?.addedByEmail || addedByEmail,
    adminCartNote: adminNote !== undefined ? adminNote : existingDoc?.adminNote || quoteItem.adminCartNote,
    addedAt: existingDoc?.addedAt || quoteItem.addedAt || nowIso,
    updatedAt: nowIso,
    cartSchemaVersion: USER_CART_SCHEMA_VERSION
  });

  const prod = compactedItem.product || ({} as any);
  const pax: UserCartPassengerConfig = {
    adults: Math.max(1, Number(compactedItem.pax?.adults) || 1),
    children: Math.max(0, Number(compactedItem.pax?.children) || 0),
    infants: Math.max(0, Number(compactedItem.pax?.infants) || 0),
    ...(Array.isArray((compactedItem.pax as any)?.childAges)
      ? { childAges: (compactedItem.pax as any).childAges }
      : {})
  };

  const productId = String(
    compactedItem.productId || prod.id || compactedItem.master_product_id || cartItemId
  ).slice(0, 128);
  const productName = String(
    compactedItem.customTitle || compactedItem.title || compactedItem.productName || prod.name || 'Service'
  ).slice(0, 240);
  const productCategory = String(
    compactedItem.category || prod.category || prod.productType || 'SERVICE'
  ).slice(0, 80);
  const destinationId = String(
    prod.destinationId || prod.destinationName || prod.country || 'UNSPECIFIED'
  ).slice(0, 128);
  const hubId =
    compactedItem.hubId || (prod as any).hubId || (compactedItem.metadata as any)?.hubId || null;
  const selectedServiceDate = String(compactedItem.travelDate || compactedItem.checkInDate || '').slice(0, 32);
  const quantity = Math.max(
    1,
    Number(compactedItem.roomsCount) || Number(pax.adults + pax.children) || 1
  );

  const ticketTierId =
    compactedItem.ticketTierId ||
    (compactedItem.selected_options as any)?.ticketTierId ||
    (compactedItem.configuration_snapshot as any)?.ticketTierId ||
    compactedItem.calculation?.selectedTicketTierId;
  const ticketTierName =
    compactedItem.ticketTierName ||
    (compactedItem.selected_options as any)?.ticketTierName ||
    (compactedItem.configuration_snapshot as any)?.ticketTierName ||
    compactedItem.calculation?.selectedTicketTierName;
  const ticketTierDescription =
    compactedItem.ticketTierDescription ||
    (compactedItem.selected_options as any)?.ticketTierDescription ||
    (compactedItem.configuration_snapshot as any)?.ticketTierDescription ||
    compactedItem.calculation?.selectedTicketTierDescription;

  if (ticketTierId) compactedItem.ticketTierId = ticketTierId;
  if (ticketTierName) compactedItem.ticketTierName = ticketTierName;
  if (ticketTierDescription) compactedItem.ticketTierDescription = ticketTierDescription;

  const selectedOptions: Record<string, any> = {
    ...(compactedItem.selected_options || {}),
    ...(Array.isArray(compactedItem.selectedAddonIds) && compactedItem.selectedAddonIds.length > 0
      ? { selectedAddonIds: compactedItem.selectedAddonIds }
      : {}),
    ...(Array.isArray(compactedItem.selectedUpsellIds) && compactedItem.selectedUpsellIds.length > 0
      ? { selectedUpsellIds: compactedItem.selectedUpsellIds }
      : {}),
    ...(compactedItem.serviceTime ? { serviceTime: compactedItem.serviceTime } : {}),
    ...(compactedItem.roomTypeId ? { roomTypeId: compactedItem.roomTypeId } : {}),
    ...(compactedItem.mealPlanCode ? { mealPlanCode: compactedItem.mealPlanCode } : {}),
    ...(compactedItem.nights ? { nights: compactedItem.nights } : {}),
    ...(compactedItem.roomsCount ? { roomsCount: compactedItem.roomsCount } : {}),
    ...(ticketTierId ? { ticketTierId } : {}),
    ...(ticketTierName ? { ticketTierName } : {}),
    ...(ticketTierDescription ? { ticketTierDescription } : {})
  };

  return {
    cartItemId,
    ownerUid,
    agencyId: existingDoc?.agencyId ?? agencyId ?? null,
    productId,
    productName,
    productCategory,
    destinationId,
    hubId: hubId ? String(hubId).slice(0, 128) : null,
    selectedServiceDate,
    quantity,
    passengerConfig: pax,
    selectedOptions,
    notes: compactedItem.notes ? String(compactedItem.notes).slice(0, 2000) : '',
    itemPayload: compactedItem,
    addedByUid: existingDoc?.addedByUid || addedByUid,
    addedByRole: existingDoc?.addedByRole || addedByRole,
    addedByName: (existingDoc?.addedByName || addedByName || '').slice(0, 160),
    addedByEmail: (existingDoc?.addedByEmail || addedByEmail || '').slice(0, 160),
    adminNote:
      adminNote !== undefined
        ? String(adminNote).slice(0, 1000)
        : existingDoc?.adminNote || '',
    addedAt: existingDoc?.addedAt || nowIso,
    updatedAt: nowIso,
    status: 'ACTIVE',
    schemaVersion: USER_CART_SCHEMA_VERSION
  };
}

/**
 * Converts a verified UserCartItemDocument back to a QuoteItem for UI rendering,
 * asserting strict ownership before returning.
 */
export function cartDocumentToVerifiedQuoteItem(
  docData: UserCartItemDocument,
  expectedOwnerUid: string
): QuoteItem | null {
  if (!docData || !expectedOwnerUid) return null;
  if (docData.ownerUid !== expectedOwnerUid) return null;
  if (docData.status !== 'ACTIVE') return null;
  if (!docData.itemPayload || !docData.itemPayload.product) return null;

  const resolvedTierId =
    docData.itemPayload.ticketTierId ||
    docData.selectedOptions?.ticketTierId ||
    (docData.itemPayload as any).selected_options?.ticketTierId ||
    (docData.itemPayload as any).configuration_snapshot?.ticketTierId ||
    docData.itemPayload.calculation?.selectedTicketTierId;
  const resolvedTierName =
    docData.itemPayload.ticketTierName ||
    docData.selectedOptions?.ticketTierName ||
    (docData.itemPayload as any).selected_options?.ticketTierName ||
    (docData.itemPayload as any).configuration_snapshot?.ticketTierName ||
    docData.itemPayload.calculation?.selectedTicketTierName;
  const resolvedTierDescription =
    docData.itemPayload.ticketTierDescription ||
    docData.selectedOptions?.ticketTierDescription ||
    (docData.itemPayload as any).selected_options?.ticketTierDescription ||
    (docData.itemPayload as any).configuration_snapshot?.ticketTierDescription ||
    docData.itemPayload.calculation?.selectedTicketTierDescription;

  return {
    ...docData.itemPayload,
    id: docData.cartItemId,
    ...(resolvedTierId ? { ticketTierId: resolvedTierId } : {}),
    ...(resolvedTierName ? { ticketTierName: resolvedTierName } : {}),
    ...(resolvedTierDescription ? { ticketTierDescription: resolvedTierDescription } : {}),
    ownerUid: docData.ownerUid,
    agencyId: docData.agencyId ?? null,
    addedByUid: docData.addedByUid,
    addedByRole: docData.addedByRole,
    addedByName: docData.addedByName,
    addedByEmail: docData.addedByEmail,
    adminCartNote: docData.adminNote || undefined,
    addedAt: docData.addedAt,
    updatedAt: docData.updatedAt,
    cartSchemaVersion: docData.schemaVersion
  };
}

// ============================================================================
// UID-NAMESPACED NON-AUTHORITATIVE LOCAL CACHE (STRICT ISOLATION)
// ============================================================================

interface UidCartCacheEnvelope {
  ownerUid: string;
  schemaVersion: number;
  updatedAt: string;
  docs: UserCartItemDocument[];
}

export function getUidCartCacheKey(ownerUid: string): string {
  return `${UID_CART_CACHE_PREFIX}${ownerUid}`;
}

export function readUidNamespacedCartCache(ownerUid: string): UserCartItemDocument[] {
  if (typeof window === 'undefined' || !isValidCartDocumentId(ownerUid)) return [];
  const key = getUidCartCacheKey(ownerUid);
  try {
    const raw = window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UidCartCacheEnvelope;
    if (!parsed || parsed.ownerUid !== ownerUid || !Array.isArray(parsed.docs)) {
      return [];
    }
    // Strictly filter & validate every cached document belongs to ownerUid
    return parsed.docs.filter(
      (d) =>
        d &&
        d.ownerUid === ownerUid &&
        d.status === 'ACTIVE' &&
        isValidCartDocumentId(d.cartItemId) &&
        Boolean(d.itemPayload?.product)
    );
  } catch {
    return [];
  }
}

export function writeUidNamespacedCartCache(ownerUid: string, docs: UserCartItemDocument[]): void {
  if (typeof window === 'undefined' || !isValidCartDocumentId(ownerUid)) return;
  const key = getUidCartCacheKey(ownerUid);
  const ownedDocs = docs.filter((d) => d && d.ownerUid === ownerUid && d.status === 'ACTIVE');
  if (ownedDocs.length === 0) {
    clearUidNamespacedCartCache(ownerUid);
    return;
  }
  const envelope: UidCartCacheEnvelope = {
    ownerUid,
    schemaVersion: USER_CART_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    docs: ownedDocs
  };
  try {
    const serialized = JSON.stringify(envelope);
    try {
      window.sessionStorage?.setItem(key, serialized);
    } catch {}
    if (serialized.length <= 262144) {
      try {
        window.localStorage?.setItem(key, serialized);
      } catch {}
    }
  } catch {
    // Non-fatal cache write skip
  }
}

export function clearUidNamespacedCartCache(ownerUid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (ownerUid && isValidCartDocumentId(ownerUid)) {
      const key = getUidCartCacheKey(ownerUid);
      window.sessionStorage?.removeItem(key);
      window.localStorage?.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearAllUidCartCachesFromDevice(): void {
  if (typeof window === 'undefined') return;
  const storages: Storage[] = [];
  try {
    if (window.sessionStorage) storages.push(window.sessionStorage);
  } catch {}
  try {
    if (window.localStorage) storages.push(window.localStorage);
  } catch {}

  for (const store of storages) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && (k.startsWith(UID_CART_CACHE_PREFIX) || k === LEGACY_SHARED_CART_KEY)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => store.removeItem(k));
    } catch {
      // Ignore storage access errors
    }
  }
}

// ============================================================================
// STORAGE BACKEND INTERFACE (FIRESTORE PRODUCTION + IN-MEMORY TEST ADAPTER)
// ============================================================================

export interface UserCartPersistenceBackend {
  subscribeUserCart(
    ownerUid: string,
    onDocs: (docs: UserCartItemDocument[]) => void,
    onError?: (err: CartFirestoreErrorInfo) => void
  ): () => void;
  listUserCart(ownerUid: string): Promise<UserCartItemDocument[]>;
  getUserCartItem(ownerUid: string, cartItemId: string): Promise<UserCartItemDocument | null>;
  saveUserCartItem(ownerUid: string, docData: UserCartItemDocument): Promise<void>;
  deleteUserCartItem(ownerUid: string, cartItemId: string): Promise<void>;
  clearUserCart(ownerUid: string): Promise<void>;
  saveQuarantinedLegacyItem(record: QuarantinedLegacyCartItem): Promise<void>;
  listQuarantinedLegacyItems(): Promise<QuarantinedLegacyCartItem[]>;
  updateQuarantinedLegacyItem(recordId: string, updates: Partial<QuarantinedLegacyCartItem>): Promise<void>;
}

async function tryApiCartDelete(
  pathSuffix: string,
  expectedOwnerUid: string
): Promise<'OK' | 'UNAVAILABLE'> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return 'UNAVAILABLE';
  const currentUser = auth?.currentUser;
  if (!currentUser || currentUser.uid !== expectedOwnerUid || typeof currentUser.getIdToken !== 'function') {
    return 'UNAVAILABLE';
  }
  let idToken = '';
  try {
    idToken = await currentUser.getIdToken();
  } catch {
    return 'UNAVAILABLE';
  }
  if (!idToken) return 'UNAVAILABLE';

  let res: globalThis.Response;
  try {
    res = await fetch(`/api/cart${pathSuffix}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });
  } catch {
    return 'UNAVAILABLE';
  }

  if (res.ok) return 'OK';

  // Fail closed on explicit auth/permission/server validation rejection
  if (res.status === 401 || res.status === 403 || (res.status >= 400 && res.status !== 404 && res.status !== 502 && res.status !== 503)) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Cart API delete failed with status ${res.status}`);
  }
  return 'UNAVAILABLE';
}

const FIRESTORE_WRITE_BATCH_LIMIT = 450;

function createFirestoreUserCartBackend(): UserCartPersistenceBackend {
  return {
    subscribeUserCart(ownerUid, onDocs, onError) {
      const cartPath = `users/${ownerUid}/cart`;
      const colRef = collection(firestoreDb, 'users', ownerUid, 'cart');
      const q = query(colRef, orderBy('addedAt', 'asc'));

      return onSnapshot(
        q,
        (snapshot) => {
          const docs: UserCartItemDocument[] = [];
          snapshot.forEach((snapDoc) => {
            const raw = snapDoc.data() as UserCartItemDocument;
            // Defense-in-depth: never surface any record whose ownerUid != ownerUid
            if (raw && raw.ownerUid === ownerUid && raw.status === 'ACTIVE') {
              docs.push({
                ...raw,
                cartItemId: raw.cartItemId || snapDoc.id
              });
            }
          });
          onDocs(docs);
        },
        (error) => {
          const info = handleCartFirestoreError(error, CartOperationType.LIST, cartPath, false);
          onError?.(info);
        }
      );
    },

    async listUserCart(ownerUid) {
      const cartPath = `users/${ownerUid}/cart`;
      try {
        const snap = await getDocs(collection(firestoreDb, 'users', ownerUid, 'cart'));
        const docs: UserCartItemDocument[] = [];
        snap.forEach((d) => {
          const raw = d.data() as UserCartItemDocument;
          if (raw && raw.ownerUid === ownerUid && raw.status === 'ACTIVE') {
            docs.push({ ...raw, cartItemId: raw.cartItemId || d.id });
          }
        });
        docs.sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''));
        return docs;
      } catch (error) {
        handleCartFirestoreError(error, CartOperationType.LIST, cartPath, false);
        return [];
      }
    },

    async getUserCartItem(ownerUid, cartItemId) {
      const itemPath = `users/${ownerUid}/cart/${cartItemId}`;
      try {
        const snap = await getDoc(doc(firestoreDb, 'users', ownerUid, 'cart', cartItemId));
        if (!snap.exists()) return null;
        const raw = snap.data() as UserCartItemDocument;
        if (!raw || raw.ownerUid !== ownerUid) return null;
        return { ...raw, cartItemId: raw.cartItemId || snap.id };
      } catch (error) {
        handleCartFirestoreError(error, CartOperationType.GET, itemPath, false);
        return null;
      }
    },

    async saveUserCartItem(ownerUid, docData) {
      const itemPath = `users/${ownerUid}/cart/${docData.cartItemId}`;
      try {
        const cleaned = cleanForFirestore(docData);
        await setDoc(doc(firestoreDb, 'users', ownerUid, 'cart', docData.cartItemId), cleaned);
      } catch (error) {
        handleCartFirestoreError(error, CartOperationType.WRITE, itemPath, true);
      }
    },

    async deleteUserCartItem(ownerUid, cartItemId) {
      const itemPath = `users/${ownerUid}/cart/${cartItemId}`;
      try {
        const apiResult = await tryApiCartDelete(`/items/${encodeURIComponent(cartItemId)}`, ownerUid);
        if (apiResult === 'OK') return;
        await deleteDoc(doc(firestoreDb, 'users', ownerUid, 'cart', cartItemId));
      } catch (error) {
        handleCartFirestoreError(error, CartOperationType.DELETE, itemPath, true);
      }
    },

    async clearUserCart(ownerUid) {
      const cartPath = `users/${ownerUid}/cart`;
      try {
        const apiResult = await tryApiCartDelete('', ownerUid);
        if (apiResult === 'OK') return;

        const snap = await getDocs(collection(firestoreDb, 'users', ownerUid, 'cart'));
        if (snap.empty) return;

        const refsToDelete = snap.docs
          .filter((d) => {
            const raw = d.data() as UserCartItemDocument;
            return !raw || !raw.ownerUid || raw.ownerUid === ownerUid;
          })
          .map((d) => d.ref);

        for (let i = 0; i < refsToDelete.length; i += FIRESTORE_WRITE_BATCH_LIMIT) {
          const chunk = refsToDelete.slice(i, i + FIRESTORE_WRITE_BATCH_LIMIT);
          const batch = writeBatch(firestoreDb);
          chunk.forEach((ref) => batch.delete(ref));
          await batch.commit();
        }
      } catch (error) {
        handleCartFirestoreError(error, CartOperationType.DELETE, cartPath, true);
      }
    },

    async saveQuarantinedLegacyItem(record) {
      const path = `quarantined_legacy_cart_items/${record.id}`;
      try {
        const cleaned = cleanForFirestore(record);
        await setDoc(doc(firestoreDb, 'quarantined_legacy_cart_items', record.id), cleaned);
      } catch (error) {
        handleCartFirestoreError(error, CartOperationType.CREATE, path, false);
      }
      // Also mirror in Admin local quarantine buffer (never read by Agents)
      saveQuarantinedRecordLocally(record);
    },

    async listQuarantinedLegacyItems() {
      const path = 'quarantined_legacy_cart_items';
      const byId = new Map<string, QuarantinedLegacyCartItem>();
      readQuarantinedRecordsLocally().forEach((r) => byId.set(r.id, r));
      try {
        const snap = await getDocs(collection(firestoreDb, 'quarantined_legacy_cart_items'));
        snap.forEach((d) => {
          const data = d.data() as QuarantinedLegacyCartItem;
          if (data && data.id) {
            byId.set(data.id, data);
          }
        });
      } catch (error) {
        handleCartFirestoreError(error, CartOperationType.LIST, path, false);
      }
      return Array.from(byId.values()).sort((a, b) =>
        (b.discoveredAt || '').localeCompare(a.discoveredAt || '')
      );
    },

    async updateQuarantinedLegacyItem(recordId, updates) {
      const path = `quarantined_legacy_cart_items/${recordId}`;
      try {
        const existingSnap = await getDoc(doc(firestoreDb, 'quarantined_legacy_cart_items', recordId));
        if (existingSnap.exists()) {
          const merged = cleanForFirestore({
            ...(existingSnap.data() as Record<string, any>),
            ...updates
          });
          await setDoc(doc(firestoreDb, 'quarantined_legacy_cart_items', recordId), merged);
        }
      } catch (error) {
        handleCartFirestoreError(error, CartOperationType.UPDATE, path, false);
      }
      updateQuarantinedRecordLocally(recordId, updates);
    }
  };
}

function readQuarantinedRecordsLocally(): QuarantinedLegacyCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage?.getItem(ADMIN_QUARANTINE_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQuarantinedRecordLocally(record: QuarantinedLegacyCartItem): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readQuarantinedRecordsLocally();
    const filtered = existing.filter((r) => r.id !== record.id);
    filtered.unshift(record);
    window.localStorage?.setItem(ADMIN_QUARANTINE_LOCAL_KEY, JSON.stringify(filtered.slice(0, 200)));
  } catch {
    // Non-fatal
  }
}

function updateQuarantinedRecordLocally(
  recordId: string,
  updates: Partial<QuarantinedLegacyCartItem>
): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readQuarantinedRecordsLocally();
    const next = existing.map((r) => (r.id === recordId ? { ...r, ...updates } : r));
    window.localStorage?.setItem(ADMIN_QUARANTINE_LOCAL_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal
  }
}

// ============================================================================
// IN-MEMORY BACKEND FACTORY (FOR DETERMINISTIC MULTI-USER & SECURITY AUDITS)
// ============================================================================

export function createInMemoryUserCartBackend(): UserCartPersistenceBackend & {
  _carts: Map<string, Map<string, UserCartItemDocument>>;
  _quarantine: Map<string, QuarantinedLegacyCartItem>;
  _listeners: Map<string, Set<(docs: UserCartItemDocument[]) => void>>;
} {
  const _carts = new Map<string, Map<string, UserCartItemDocument>>();
  const _quarantine = new Map<string, QuarantinedLegacyCartItem>();
  const _listeners = new Map<string, Set<(docs: UserCartItemDocument[]) => void>>();

  const getBucket = (uid: string) => {
    let m = _carts.get(uid);
    if (!m) {
      m = new Map<string, UserCartItemDocument>();
      _carts.set(uid, m);
    }
    return m;
  };

  const emit = (uid: string) => {
    const subs = _listeners.get(uid);
    if (!subs) return;
    const docs = Array.from(getBucket(uid).values())
      .filter((d) => d.ownerUid === uid && d.status === 'ACTIVE')
      .sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''));
    subs.forEach((cb) => cb(docs.map((d) => ({ ...d }))));
  };

  return {
    _carts,
    _quarantine,
    _listeners,

    subscribeUserCart(ownerUid, onDocs) {
      let set = _listeners.get(ownerUid);
      if (!set) {
        set = new Set();
        _listeners.set(ownerUid, set);
      }
      set.add(onDocs);
      // Initial emission
      const initial = Array.from(getBucket(ownerUid).values())
        .filter((d) => d.ownerUid === ownerUid && d.status === 'ACTIVE')
        .sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''));
      onDocs(initial.map((d) => ({ ...d })));

      return () => {
        set?.delete(onDocs);
      };
    },

    async listUserCart(ownerUid) {
      return Array.from(getBucket(ownerUid).values())
        .filter((d) => d.ownerUid === ownerUid && d.status === 'ACTIVE')
        .sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''))
        .map((d) => ({ ...d }));
    },

    async getUserCartItem(ownerUid, cartItemId) {
      const found = getBucket(ownerUid).get(cartItemId);
      if (!found || found.ownerUid !== ownerUid) return null;
      return { ...found };
    },

    async saveUserCartItem(ownerUid, docData) {
      if (docData.ownerUid !== ownerUid) {
        throw new Error('PERMISSION_DENIED: ownerUid mismatch with target user cart path.');
      }
      getBucket(ownerUid).set(docData.cartItemId, { ...docData });
      emit(ownerUid);
    },

    async deleteUserCartItem(ownerUid, cartItemId) {
      getBucket(ownerUid).delete(cartItemId);
      emit(ownerUid);
    },

    async clearUserCart(ownerUid) {
      getBucket(ownerUid).clear();
      emit(ownerUid);
    },

    async saveQuarantinedLegacyItem(record) {
      _quarantine.set(record.id, { ...record });
    },

    async listQuarantinedLegacyItems() {
      return Array.from(_quarantine.values()).sort((a, b) =>
        (b.discoveredAt || '').localeCompare(a.discoveredAt || '')
      );
    },

    async updateQuarantinedLegacyItem(recordId, updates) {
      const existing = _quarantine.get(recordId);
      if (existing) {
        _quarantine.set(recordId, { ...existing, ...updates });
      }
    }
  };
}

// ============================================================================
// AUTHORITATIVE USER CART SERVICE
// ============================================================================

export interface LegacyMigrationSummary {
  inspectedCount: number;
  migratedCount: number;
  quarantinedCount: number;
  skippedDuplicateCount: number;
  legacyKeysPurged: boolean;
}

export class UserCartService {
  private backend: UserCartPersistenceBackend;
  private uidClearWatermarkMs = new Map<string, number>();
  private uidClearEpoch = new Map<string, number>();
  private uidDeletedTombstones = new Map<string, Map<string, number>>();
  private lastEventMs = 0;

  constructor(backend?: UserCartPersistenceBackend) {
    this.backend = backend || createFirestoreUserCartBackend();
  }

  public getBackend(): UserCartPersistenceBackend {
    return this.backend;
  }

  private nextMonotonicMs(floorMs = 0): number {
    const next = Math.max(Date.now(), floorMs + 1, this.lastEventMs + 1);
    this.lastEventMs = next;
    return next;
  }

  private parseDocTimestampMs(doc: UserCartItemDocument): number {
    const raw = doc?.updatedAt || doc?.addedAt || '';
    if (!raw) return 0;
    const ms = Date.parse(String(raw));
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  }

  private getOrCreateTombstoneMap(uid: string): Map<string, number> {
    let m = this.uidDeletedTombstones.get(uid);
    if (!m) {
      m = new Map<string, number>();
      this.uidDeletedTombstones.set(uid, m);
    }
    return m;
  }

  public filterStaleDocsForUid(
    ownerUid: string,
    docs: UserCartItemDocument[]
  ): UserCartItemDocument[] {
    const clearMs = this.uidClearWatermarkMs.get(ownerUid) || 0;
    const tombstones = this.uidDeletedTombstones.get(ownerUid);
    return (docs || []).filter((d) => {
      if (!d || d.ownerUid !== ownerUid || d.status !== 'ACTIVE') return false;
      const docMs = this.parseDocTimestampMs(d);
      if (clearMs > 0 && (docMs === 0 || docMs <= clearMs)) {
        return false;
      }
      const tombMs = tombstones?.get(d.cartItemId) || 0;
      if (tombMs > 0 && (docMs === 0 || docMs <= tombMs)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Subscribes strictly to the authenticated user's own cart path (`users/{ownerUid}/cart`).
   * Never reads global carts or agency carts, and suppresses pre-clear / tombstoned snapshots.
   */
  public subscribeToOwnCart(
    actor: User,
    firebaseUid: string | null | undefined,
    onItems: (docs: UserCartItemDocument[]) => void,
    onError?: (err: CartFirestoreErrorInfo) => void
  ): () => void {
    const ownerUid = resolveAuthenticatedCartUid(actor, firebaseUid ? { uid: firebaseUid } : null);
    if (!ownerUid) {
      onItems([]);
      return () => {};
    }

    return this.backend.subscribeUserCart(
      ownerUid,
      (docs) => {
        const filtered = this.filterStaleDocsForUid(ownerUid, docs);
        writeUidNamespacedCartCache(ownerUid, filtered);
        onItems(filtered);
      },
      onError
    );
  }

  /**
   * Lists items strictly for a specific user UID, enforcing actor authorization.
   */
  public async listCartForUser(params: {
    actor: User;
    actorFirebaseUid?: string | null;
    targetUid: string;
  }): Promise<UserCartItemDocument[]> {
    const { actor, actorFirebaseUid, targetUid } = params;
    const callerUid = resolveAuthenticatedCartUid(
      actor,
      actorFirebaseUid ? { uid: actorFirebaseUid } : null
    );
    if (!callerUid || !isValidCartDocumentId(targetUid)) {
      throw new Error('PERMISSION_DENIED: Authentication and valid target UID are required.');
    }

    const isSelf = callerUid === targetUid;
    const isAdmin = isAuthorisedCartAdmin(actor);

    if (!isSelf && !isAdmin) {
      throw new Error('PERMISSION_DENIED: Users may only access their own cart.');
    }

    const docs = await this.backend.listUserCart(targetUid);
    return this.filterStaleDocsForUid(targetUid, docs);
  }

  /**
   * B2B Agent (or self) adds or updates an item strictly in their own cart (`users/{actorUid}/cart`).
   * Rejects cross-user targets, immutable ownerUid tampering, and prevents superseded in-flight writes
   * from resurrecting after a concurrent delete or clear.
   */
  public async upsertOwnCartItem(params: {
    actor: User;
    actorFirebaseUid?: string | null;
    quoteItem: QuoteItem;
    requestedTargetUid?: string;
  }): Promise<UserCartItemDocument> {
    const { actor, actorFirebaseUid, quoteItem, requestedTargetUid } = params;
    const callerUid = resolveAuthenticatedCartUid(
      actor,
      actorFirebaseUid ? { uid: actorFirebaseUid } : null
    );
    if (!callerUid) {
      throw new Error('PERMISSION_DENIED: Must be an authenticated approved user to modify cart.');
    }

    if (requestedTargetUid && requestedTargetUid !== callerUid) {
      throw new Error(
        'PERMISSION_DENIED: Cannot write to another user cart through self-service cart action.'
      );
    }
    if (quoteItem.ownerUid && quoteItem.ownerUid !== callerUid) {
      throw new Error('PERMISSION_DENIED: Cannot spoof or mutate ownerUid on a cart item.');
    }

    const cartItemId = sanitizeCartItemId(quoteItem.id);
    const startEpoch = this.uidClearEpoch.get(callerUid) || 0;
    const clearFloor = this.uidClearWatermarkMs.get(callerUid) || 0;
    const tombFloor = this.uidDeletedTombstones.get(callerUid)?.get(cartItemId) || 0;
    const writeMs = this.nextMonotonicMs(Math.max(clearFloor, tombFloor));
    const writeIso = new Date(writeMs).toISOString();

    const existing = await this.backend.getUserCartItem(callerUid, cartItemId);
    if (existing && existing.ownerUid !== callerUid) {
      throw new Error('PERMISSION_DENIED: Existing cart item does not belong to authenticated user.');
    }

    const epochAfterGet = this.uidClearEpoch.get(callerUid) || 0;
    const tombAfterGet = this.uidDeletedTombstones.get(callerUid)?.get(cartItemId) || 0;
    if (epochAfterGet !== startEpoch || tombAfterGet > tombFloor) {
      const err: any = new Error('CART_WRITE_SUPERSEDED: Cart was cleared or item deleted while write was in flight.');
      err.code = 'CART_WRITE_SUPERSEDED';
      throw err;
    }

    const addedByRole: CartAddedByRole = isAuthorisedCartAdmin(actor) ? 'ADMIN' : 'B2B_AGENT';
    const docData = buildUserCartItemDocument({
      ownerUid: callerUid,
      agencyId: resolveSecondaryAgencyId(actor),
      quoteItem: { ...quoteItem, id: cartItemId },
      addedByUid: callerUid,
      addedByRole,
      addedByName: actor.name,
      addedByEmail: actor.email,
      existingDoc: existing
    });
    docData.updatedAt = writeIso;
    if (!existing) {
      docData.addedAt = writeIso;
    }

    // Clear prior delete tombstone strictly for clean post-delete / post-clear re-adds
    this.uidDeletedTombstones.get(callerUid)?.delete(cartItemId);

    await this.backend.saveUserCartItem(callerUid, docData);

    const epochAfterSave = this.uidClearEpoch.get(callerUid) || 0;
    const tombAfterSave = this.uidDeletedTombstones.get(callerUid)?.get(cartItemId) || 0;
    if (epochAfterSave !== startEpoch || tombAfterSave > tombFloor) {
      await this.backend.deleteUserCartItem(callerUid, docData.cartItemId).catch(() => {});
      clearUidNamespacedCartCache(callerUid);
      const err: any = new Error('CART_WRITE_SUPERSEDED: Cart was cleared or item deleted while save was in flight.');
      err.code = 'CART_WRITE_SUPERSEDED';
      throw err;
    }

    return docData;
  }

  /**
   * Removes a single item strictly from the authenticated user's own cart (or Admin targeting explicit agent).
   * Removing an item NEVER affects any other user's cart.
   * Fail-closed: rolls back optimistic tombstone if persistence fails.
   */
  public async removeCartItem(params: {
    actor: User;
    actorFirebaseUid?: string | null;
    targetUid?: string;
    cartItemId: string;
  }): Promise<void> {
    const { actor, actorFirebaseUid, targetUid, cartItemId } = params;
    const callerUid = resolveAuthenticatedCartUid(
      actor,
      actorFirebaseUid ? { uid: actorFirebaseUid } : null
    );
    if (!callerUid) {
      throw new Error('PERMISSION_DENIED: Authentication required to remove cart items.');
    }
    const effectiveTargetUid = targetUid || callerUid;
    if (!isValidCartDocumentId(effectiveTargetUid) || !isValidCartDocumentId(cartItemId)) {
      throw new Error('Invalid targetUid or cartItemId.');
    }

    const isSelf = callerUid === effectiveTargetUid;
    const isAdmin = isAuthorisedCartAdmin(actor);
    if (!isSelf && !isAdmin) {
      throw new Error('PERMISSION_DENIED: Cannot remove items from another user cart.');
    }

    const tombMap = this.getOrCreateTombstoneMap(effectiveTargetUid);
    const prevTombstoneMs = tombMap.get(cartItemId);
    const deleteMs = this.nextMonotonicMs(prevTombstoneMs || 0);
    tombMap.set(cartItemId, deleteMs);

    try {
      await this.backend.deleteUserCartItem(effectiveTargetUid, cartItemId);
    } catch (err) {
      if (prevTombstoneMs !== undefined) {
        tombMap.set(cartItemId, prevTombstoneMs);
      } else {
        tombMap.delete(cartItemId);
      }
      throw err;
    }

    const remainingCached = readUidNamespacedCartCache(effectiveTargetUid).filter(
      (d) => d.cartItemId !== cartItemId
    );
    writeUidNamespacedCartCache(effectiveTargetUid, remainingCached);

    if (!isSelf && isAdmin) {
      try {
        AppDatabase.getInstance().logAudit(
          { id: callerUid, name: actor.name || actor.email || 'Admin', role: actor.role },
          'ADMIN_REMOVED_AGENT_CART_ITEM',
          'B2B_CART',
          cartItemId,
          `Admin ${actor.name} (${callerUid}) removed cart item ${cartItemId} from target agent ${effectiveTargetUid}.`
        );
      } catch {}
    }
  }

  /**
   * Clears ONLY the authenticated user's own cart (never global or agency cart).
   * Fail-closed: rolls back optimistic clear watermark/epoch if backend clear fails.
   */
  public async clearOwnCart(params: {
    actor: User;
    actorFirebaseUid?: string | null;
    requestedTargetUid?: string;
  }): Promise<void> {
    const { actor, actorFirebaseUid, requestedTargetUid } = params;
    const callerUid = resolveAuthenticatedCartUid(
      actor,
      actorFirebaseUid ? { uid: actorFirebaseUid } : null
    );
    if (!callerUid) {
      throw new Error('PERMISSION_DENIED: Authentication required to clear cart.');
    }
    if (requestedTargetUid && requestedTargetUid !== callerUid) {
      throw new Error('PERMISSION_DENIED: Cannot clear another user cart.');
    }

    const prevWatermark = this.uidClearWatermarkMs.get(callerUid);
    const prevEpoch = this.uidClearEpoch.get(callerUid) || 0;
    const clearMs = this.nextMonotonicMs(prevWatermark || 0);

    this.uidClearWatermarkMs.set(callerUid, clearMs);
    this.uidClearEpoch.set(callerUid, prevEpoch + 1);

    try {
      await this.backend.clearUserCart(callerUid);
    } catch (err) {
      if (prevWatermark !== undefined) {
        this.uidClearWatermarkMs.set(callerUid, prevWatermark);
      } else {
        this.uidClearWatermarkMs.delete(callerUid);
      }
      this.uidClearEpoch.set(callerUid, prevEpoch);
      throw err;
    }

    this.uidDeletedTombstones.delete(callerUid);
    clearUidNamespacedCartCache(callerUid);
  }

  /**
   * Authorised CMS Admin explicitly adds an item to a specific target B2B Agent's cart.
   * Requires explicit target agent selection, resolves target Firebase Auth UID,
   * stamps addedByUid/addedByRole='ADMIN', and records an audit log.
   */
  public async adminAddItemToAgentCart(params: {
    actor: User;
    actorFirebaseUid?: string | null;
    targetAgent: User;
    quoteItem: QuoteItem;
    adminNote?: string;
  }): Promise<UserCartItemDocument> {
    const { actor, actorFirebaseUid, targetAgent, quoteItem, adminNote } = params;

    if (!isAuthorisedCartAdmin(actor)) {
      throw new Error(
        'PERMISSION_DENIED: Only authorised CMS Administrators may add items to another agent cart.'
      );
    }

    const adminUid = resolveAuthenticatedCartUid(
      actor,
      actorFirebaseUid ? { uid: actorFirebaseUid } : null
    );
    if (!adminUid) {
      throw new Error('PERMISSION_DENIED: Unable to resolve authenticated Admin UID.');
    }

    const targetUid = resolveTargetAgentUid(targetAgent);
    if (!targetUid) {
      throw new Error('Validation error: Target B2B Agent with a valid Firebase Auth UID must be explicitly selected.');
    }

    const cartItemId = sanitizeCartItemId(
      quoteItem.id || `admin-cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    );

    const clearFloor = this.uidClearWatermarkMs.get(targetUid) || 0;
    const tombFloor = this.uidDeletedTombstones.get(targetUid)?.get(cartItemId) || 0;
    const writeMs = this.nextMonotonicMs(Math.max(clearFloor, tombFloor));
    const writeIso = new Date(writeMs).toISOString();

    const docData = buildUserCartItemDocument({
      ownerUid: targetUid,
      agencyId: resolveSecondaryAgencyId(targetAgent),
      quoteItem: { ...quoteItem, id: cartItemId },
      addedByUid: adminUid,
      addedByRole: 'ADMIN',
      addedByName: actor.name,
      addedByEmail: actor.email,
      adminNote: adminNote?.trim() || `Added on behalf of ${targetAgent.name} by Admin ${actor.name}`
    });
    docData.updatedAt = writeIso;
    docData.addedAt = writeIso;

    this.uidDeletedTombstones.get(targetUid)?.delete(cartItemId);
    await this.backend.saveUserCartItem(targetUid, docData);

    // Record immutable audit trail
    try {
      AppDatabase.getInstance().logAudit(
        { id: adminUid, name: actor.name || actor.email || 'Admin', role: actor.role },
        'ADMIN_ADDED_CART_ITEM',
        'B2B_CART',
        cartItemId,
        `Admin ${actor.name} (${adminUid}) added "${docData.productName}" (${docData.productId}) to target agent ${targetAgent.name} (${targetUid}, agency: ${targetAgent.agencyName || docData.agencyId || 'N/A'}). Note: ${docData.adminNote || 'None'}`
      );
    } catch {
      // Non-fatal in headless test environments
    }

    return docData;
  }

  /**
   * Idempotent migration & safe quarantine for legacy shared `'theunbound_cart_items'` records.
   *
   * Rules:
   * 1. Records with a verified explicit `ownerUid` matching `verifiedKnownUids` are migrated
   *    idempotently into `users/{ownerUid}/cart/{deterministicId}` (only if caller is owner or Admin).
   * 2. Shared, agency-only, or unowned records are NEVER assigned to all agents or silently dropped —
   *    they are moved into Admin-only `quarantined_legacy_cart_items` for explicit Admin review.
   * 3. Legacy global storage key `'theunbound_cart_items'` is purged immediately after quarantine/migration
   *    so it can NEVER leak to any agent.
   * 4. Historical quotations and bookings are NEVER modified or deleted.
   */
  public async migrateOrQuarantineLegacyCartRecords(params: {
    actor: User;
    actorFirebaseUid?: string | null;
    verifiedKnownUids?: Set<string>;
    externalLegacyRecords?: Array<{
      item: Record<string, any>;
      sourceStorage: 'LOCAL_STORAGE' | 'SESSION_STORAGE' | 'LEGACY_FIRESTORE';
    }>;
  }): Promise<LegacyMigrationSummary> {
    const { actor, actorFirebaseUid, verifiedKnownUids, externalLegacyRecords } = params;
    const callerUid = resolveAuthenticatedCartUid(
      actor,
      actorFirebaseUid ? { uid: actorFirebaseUid } : null
    );
    const isAdmin = isAuthorisedCartAdmin(actor);

    const discovered: Array<{
      item: Record<string, any>;
      sourceStorage: 'LOCAL_STORAGE' | 'SESSION_STORAGE' | 'LEGACY_FIRESTORE';
    }> = [];

    if (Array.isArray(externalLegacyRecords)) {
      discovered.push(...externalLegacyRecords);
    }

    if (typeof window !== 'undefined') {
      const readKey = (
        store: Storage | undefined,
        source: 'LOCAL_STORAGE' | 'SESSION_STORAGE'
      ) => {
        if (!store) return;
        try {
          const raw = store.getItem(LEGACY_SHARED_CART_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((it) => {
              if (it && typeof it === 'object') {
                discovered.push({ item: it, sourceStorage: source });
              }
            });
          }
        } catch {
          // Malformed legacy data safely ignored
        }
      };
      readKey(window.sessionStorage, 'SESSION_STORAGE');
      readKey(window.localStorage, 'LOCAL_STORAGE');
    }

    const summary: LegacyMigrationSummary = {
      inspectedCount: discovered.length,
      migratedCount: 0,
      quarantinedCount: 0,
      skippedDuplicateCount: 0,
      legacyKeysPurged: false
    };

    const seenFingerprints = new Set<string>();

    for (let idx = 0; idx < discovered.length; idx++) {
      const { item, sourceStorage } = discovered[idx];
      const rawId = sanitizeCartItemId(String(item.id || item.cartItemId || `legacy_${idx}`));
      const prod = (item.product || {}) as Record<string, any>;
      const productId = String(item.productId || prod.id || 'unknown_product').slice(0, 128);
      const fingerprint = `${rawId}::${productId}::${item.travelDate || ''}`;
      if (seenFingerprints.has(fingerprint)) {
        summary.skippedDuplicateCount++;
        continue;
      }
      seenFingerprints.add(fingerprint);

      // Strictly check for explicit verified ownerUid (NEVER agencyId!)
      const candidateOwnerUid =
        typeof item.ownerUid === 'string' && isValidCartDocumentId(item.ownerUid.trim())
          ? item.ownerUid.trim()
          : null;

      const isKnownUid =
        Boolean(candidateOwnerUid) &&
        (!verifiedKnownUids || verifiedKnownUids.has(candidateOwnerUid!));
      const canMigrateForOwner =
        Boolean(candidateOwnerUid) &&
        isKnownUid &&
        (isAdmin || (callerUid !== null && candidateOwnerUid === callerUid));

      if (canMigrateForOwner && candidateOwnerUid && prod && prod.id) {
        const deterministicId = sanitizeCartItemId(`mig_${candidateOwnerUid.slice(0, 12)}_${rawId}`);
        const existing = await this.backend.getUserCartItem(candidateOwnerUid, deterministicId);
        if (existing) {
          summary.skippedDuplicateCount++;
          continue;
        }
        const docData = buildUserCartItemDocument({
          ownerUid: candidateOwnerUid,
          agencyId: typeof item.agencyId === 'string' ? item.agencyId : null,
          quoteItem: { ...(item as QuoteItem), id: deterministicId },
          addedByUid: candidateOwnerUid,
          addedByRole: 'B2B_AGENT',
          addedByName: typeof item.addedByName === 'string' ? item.addedByName : undefined
        });
        await this.backend.saveUserCartItem(candidateOwnerUid, docData);
        summary.migratedCount++;
      } else {
        // Quarantine ambiguous / shared / agency-only record for Admin review
        const reason: QuarantinedLegacyCartItem['quarantineReason'] = !candidateOwnerUid
          ? item.agencyId || item.companyId
            ? 'AGENCY_ONLY_OWNERSHIP'
            : 'AMBIGUOUS_SHARED_STORAGE'
          : !isKnownUid
          ? 'UNVERIFIED_OWNER_UID'
          : 'MISSING_OWNER_UID';

        const quarantineId = sanitizeCartItemId(`quar_${sourceStorage.slice(0, 3).toLowerCase()}_${rawId}`);
        const quarantineRecord: QuarantinedLegacyCartItem = {
          id: quarantineId,
          legacyItemId: rawId,
          sourceStorage,
          quarantineReason: reason,
          status: 'QUARANTINED',
          productId,
          productName: String(item.customTitle || item.title || prod.name || 'Legacy Cart Item').slice(0, 240),
          productCategory: String(item.category || prod.category || prod.productType || 'SERVICE').slice(0, 80),
          destinationId: String(prod.destinationId || prod.destinationName || '').slice(0, 128) || undefined,
          rawItemPayload: compactQuoteItemPayloadForCart(item as QuoteItem) as Record<string, any>,
          discoveredByUid: callerUid || 'system',
          discoveredAt: new Date().toISOString(),
          schemaVersion: USER_CART_SCHEMA_VERSION
        };

        await this.backend.saveQuarantinedLegacyItem(quarantineRecord);
        summary.quarantinedCount++;
      }
    }

    // Purge legacy global shared keys so they can NEVER be read again by any user
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.removeItem(LEGACY_SHARED_CART_KEY);
        window.localStorage?.removeItem(LEGACY_SHARED_CART_KEY);
        summary.legacyKeysPurged = true;
      } catch {}
    }

    return summary;
  }

  /**
   * Admin-only: list all quarantined legacy shared cart records.
   */
  public async listQuarantinedLegacyItems(actor: User): Promise<QuarantinedLegacyCartItem[]> {
    if (!isAuthorisedCartAdmin(actor)) {
      throw new Error('PERMISSION_DENIED: Only authorised Admins may inspect quarantined legacy cart records.');
    }
    return this.backend.listQuarantinedLegacyItems();
  }

  /**
   * Admin-only: assign a quarantined legacy cart item explicitly to a target B2B Agent's UID.
   */
  public async assignQuarantinedItemToAgent(params: {
    actor: User;
    actorFirebaseUid?: string | null;
    recordId: string;
    targetAgent: User;
    adminNote?: string;
  }): Promise<UserCartItemDocument> {
    const { actor, actorFirebaseUid, recordId, targetAgent, adminNote } = params;
    if (!isAuthorisedCartAdmin(actor)) {
      throw new Error('PERMISSION_DENIED: Only authorised Admins may assign quarantined cart items.');
    }
    const items = await this.backend.listQuarantinedLegacyItems();
    const record = items.find((r) => r.id === recordId);
    if (!record) {
      throw new Error(`Quarantined legacy cart record "${recordId}" not found.`);
    }
    if (record.status !== 'QUARANTINED') {
      throw new Error(`Quarantined record "${recordId}" has already been processed (${record.status}).`);
    }

    const created = await this.adminAddItemToAgentCart({
      actor,
      actorFirebaseUid,
      targetAgent,
      quoteItem: record.rawItemPayload as QuoteItem,
      adminNote: adminNote || `Assigned from quarantined legacy cart record ${recordId}`
    });

    const targetUid = resolveTargetAgentUid(targetAgent)!;
    const adminUid = resolveAuthenticatedCartUid(
      actor,
      actorFirebaseUid ? { uid: actorFirebaseUid } : null
    )!;
    await this.backend.updateQuarantinedLegacyItem(recordId, {
      status: 'ASSIGNED',
      assignedToUid: targetUid,
      assignedToName: targetAgent.name,
      assignedByUid: adminUid,
      assignedAt: new Date().toISOString(),
      adminNotes: adminNote
    });

    return created;
  }

  /**
   * Admin-only: safely archive/dismiss a quarantined legacy cart record without affecting quotes/bookings.
   */
  public async archiveQuarantinedItem(params: {
    actor: User;
    actorFirebaseUid?: string | null;
    recordId: string;
    reason?: string;
  }): Promise<void> {
    const { actor, actorFirebaseUid, recordId, reason } = params;
    if (!isAuthorisedCartAdmin(actor)) {
      throw new Error('PERMISSION_DENIED: Only authorised Admins may archive quarantined cart items.');
    }
    const adminUid = resolveAuthenticatedCartUid(
      actor,
      actorFirebaseUid ? { uid: actorFirebaseUid } : null
    )!;
    await this.backend.updateQuarantinedLegacyItem(recordId, {
      status: 'ARCHIVED',
      archivedByUid: adminUid,
      archivedAt: new Date().toISOString(),
      adminNotes: reason || 'Archived by Admin after legacy cart isolation review'
    });

    try {
      AppDatabase.getInstance().logAudit(
        { id: adminUid, name: actor.name || actor.email || 'Admin', role: actor.role },
        'ADMIN_ARCHIVED_QUARANTINED_CART_ITEM',
        'B2B_CART',
        recordId,
        `Admin ${actor.name} (${adminUid}) archived quarantined legacy cart item ${recordId}. Reason: ${reason || 'N/A'}`
      );
    } catch {}
  }
}

export const userCartService = new UserCartService();
