import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  CartAddedByRole,
  QuarantinedLegacyCartItem,
  QuoteItem,
  UserCartItemDocument
} from '../src/types';
import {
  buildUserCartItemDocument,
  isValidCartDocumentId,
  sanitizeCartItemId,
  USER_CART_SCHEMA_VERSION
} from '../src/services/userCartService';
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
    console.warn('[USER-CART-API] Could not read firebase-applet-config.json:', err);
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

// ============================================================================
// VERIFIED CALLER IDENTITY & STRICT AUTHORISATION
// ============================================================================

export interface VerifiedCartCaller {
  uid: string;
  email: string;
  name: string;
  role: string;
  userType: string;
  approvalStatus: string;
  agencyId: string | null;
  isAuthorisedCartAdmin: boolean;
  userDoc: Record<string, any> | null;
  idToken: string;
}

export type CartCallerVerifier = (
  req: Request
) => Promise<
  { ok: true; caller: VerifiedCartCaller } | { ok: false; status: number; error: string }
>;

function computeIsAuthorisedCartAdmin(params: {
  email: string;
  role: string;
  approvalStatus: string;
}): boolean {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (MASTER_ADMIN_EMAILS.has(normalizedEmail)) return true;
  if (params.approvalStatus !== 'APPROVED') return false;
  return params.role === 'ADMIN' || params.role === 'SUPER_ADMIN';
}

export async function verifyAuthenticatedCartCaller(
  req: Request
): Promise<
  { ok: true; caller: VerifiedCartCaller } | { ok: false; status: number; error: string }
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
    uid = String(fbUser.localId).trim();
    email = String(fbUser.email || '').trim().toLowerCase();
    displayName = String(fbUser.displayName || '').trim();
  } catch (err: any) {
    return {
      ok: false,
      status: 503,
      error: `Unable to verify authentication token: ${err?.message || 'network error'}`
    };
  }

  if (!isValidCartDocumentId(uid)) {
    return { ok: false, status: 401, error: 'Invalid authenticated user identifier.' };
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
    // Optional for newly provisioned master admin accounts
  }

  const role = String(
    userDoc?.role || (MASTER_ADMIN_EMAILS.has(email) ? 'ADMIN' : 'B2B_AGENT')
  ).toUpperCase();
  const userType = String(userDoc?.userType || role).toUpperCase();
  const approvalStatus = String(userDoc?.approvalStatus || 'APPROVED').toUpperCase();

  if (role === 'BUYER' || userType === 'BUYER') {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: B2B cart access is restricted to approved B2B Agents and authorised Administrators.'
    };
  }

  const isAdmin = computeIsAuthorisedCartAdmin({ email, role, approvalStatus });
  if (!isAdmin && approvalStatus !== 'APPROVED') {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: User account must be APPROVED to access the B2B cart.'
    };
  }

  const rawAgency = userDoc?.companyId || userDoc?.agencyId || null;
  const agencyId =
    typeof rawAgency === 'string' && rawAgency.trim().length > 0
      ? rawAgency.trim().slice(0, 128)
      : null;

  return {
    ok: true,
    caller: {
      uid,
      email: email || String(userDoc?.email || '').trim().toLowerCase(),
      name: String(userDoc?.name || userDoc?.displayName || displayName || email || 'User').slice(0, 160),
      role,
      userType,
      approvalStatus,
      agencyId,
      isAuthorisedCartAdmin: isAdmin,
      userDoc,
      idToken
    }
  };
}

// ============================================================================
// STORE ADAPTER (PRODUCTION FIRESTORE REST + IN-MEMORY TESTABLE ADAPTER)
// ============================================================================

export interface UserCartApiStoreAdapter {
  getUserProfile(uid: string, token: string): Promise<Record<string, any> | null>;
  listUserCart(ownerUid: string, token: string): Promise<UserCartItemDocument[]>;
  getUserCartItem(
    ownerUid: string,
    cartItemId: string,
    token: string
  ): Promise<UserCartItemDocument | null>;
  saveUserCartItem(
    ownerUid: string,
    docData: UserCartItemDocument,
    token: string,
    createOnly?: boolean
  ): Promise<void>;
  deleteUserCartItem(ownerUid: string, cartItemId: string, token: string): Promise<void>;
  clearUserCart(ownerUid: string, token: string): Promise<number>;
  listQuarantinedItems(token: string): Promise<QuarantinedLegacyCartItem[]>;
  getQuarantinedItem(recordId: string, token: string): Promise<QuarantinedLegacyCartItem | null>;
  saveQuarantinedItem(record: QuarantinedLegacyCartItem, token: string): Promise<void>;
  saveAuditLog(log: Record<string, any>, token: string): Promise<void>;
}

async function fsGetPath(docPath: string, token: string): Promise<Record<string, any> | null> {
  const url = `${getFirestoreBaseUrl()}/${docPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000)
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(`Firestore get failed (${res.status}): ${errText}`);
    err.status = res.status;
    throw err;
  }
  return fromFirestoreDocument(await res.json());
}

async function fsListPath(
  collectionPath: string,
  token: string,
  maxDocs = 500
): Promise<Record<string, any>[]> {
  const url = `${getFirestoreBaseUrl()}/${collectionPath}?pageSize=${Math.min(maxDocs, 1000)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000)
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(`Firestore list failed (${res.status}): ${errText}`);
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as any;
  const docs = Array.isArray(json.documents) ? json.documents : [];
  return docs.map((d: any) => fromFirestoreDocument(d));
}

async function fsWritePath(
  docPath: string,
  data: Record<string, any>,
  token: string,
  createOnly = false
): Promise<void> {
  const cleanPayload = JSON.parse(JSON.stringify(data));
  const query = createOnly ? '?currentDocument.exists=false' : '';
  const url = `${getFirestoreBaseUrl()}/${docPath}${query}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: toFirestoreFields(cleanPayload) }),
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(`Firestore write failed (${res.status}): ${errText}`);
    err.status = res.status;
    throw err;
  }
}

async function fsDeletePath(docPath: string, token: string): Promise<void> {
  const url = `${getFirestoreBaseUrl()}/${docPath}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000)
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err: any = new Error(`Firestore delete failed (${res.status}): ${errText}`);
    err.status = res.status;
    throw err;
  }
}

export class FirestoreUserCartApiStore implements UserCartApiStoreAdapter {
  async getUserProfile(uid: string, token: string): Promise<Record<string, any> | null> {
    return fsGetPath(`users/${encodeURIComponent(uid)}`, token);
  }

  async listUserCart(ownerUid: string, token: string): Promise<UserCartItemDocument[]> {
    const docs = await fsListPath(`users/${encodeURIComponent(ownerUid)}/cart`, token);
    return (docs as UserCartItemDocument[])
      .filter((d) => d && d.ownerUid === ownerUid && d.status === 'ACTIVE')
      .sort((a, b) => String(a.addedAt || '').localeCompare(String(b.addedAt || '')));
  }

  async getUserCartItem(
    ownerUid: string,
    cartItemId: string,
    token: string
  ): Promise<UserCartItemDocument | null> {
    const doc = await fsGetPath(
      `users/${encodeURIComponent(ownerUid)}/cart/${encodeURIComponent(cartItemId)}`,
      token
    );
    if (!doc) return null;
    if (doc.ownerUid !== ownerUid) return null;
    return doc as UserCartItemDocument;
  }

  async saveUserCartItem(
    ownerUid: string,
    docData: UserCartItemDocument,
    token: string,
    createOnly = false
  ): Promise<void> {
    await fsWritePath(
      `users/${encodeURIComponent(ownerUid)}/cart/${encodeURIComponent(docData.cartItemId)}`,
      docData as any,
      token,
      createOnly
    );
  }

  async deleteUserCartItem(ownerUid: string, cartItemId: string, token: string): Promise<void> {
    await fsDeletePath(
      `users/${encodeURIComponent(ownerUid)}/cart/${encodeURIComponent(cartItemId)}`,
      token
    );
  }

  async clearUserCart(ownerUid: string, token: string): Promise<number> {
    const items = await this.listUserCart(ownerUid, token);
    for (const item of items) {
      await this.deleteUserCartItem(ownerUid, item.cartItemId, token);
    }
    return items.length;
  }

  async listQuarantinedItems(token: string): Promise<QuarantinedLegacyCartItem[]> {
    const docs = await fsListPath('quarantined_legacy_cart_items', token);
    return (docs as QuarantinedLegacyCartItem[]).sort((a, b) =>
      String(b.discoveredAt || '').localeCompare(String(a.discoveredAt || ''))
    );
  }

  async getQuarantinedItem(
    recordId: string,
    token: string
  ): Promise<QuarantinedLegacyCartItem | null> {
    const doc = await fsGetPath(`quarantined_legacy_cart_items/${encodeURIComponent(recordId)}`, token);
    return doc ? (doc as QuarantinedLegacyCartItem) : null;
  }

  async saveQuarantinedItem(record: QuarantinedLegacyCartItem, token: string): Promise<void> {
    await fsWritePath(
      `quarantined_legacy_cart_items/${encodeURIComponent(record.id)}`,
      record as any,
      token,
      false
    );
  }

  async saveAuditLog(log: Record<string, any>, token: string): Promise<void> {
    const id = sanitizeCartItemId(String(log.id || `audit_cart_${Date.now()}`));
    await fsWritePath(`audit_logs/${encodeURIComponent(id)}`, { ...log, id }, token, true);
  }
}

export class InMemoryUserCartApiStore implements UserCartApiStoreAdapter {
  public users = new Map<string, Record<string, any>>();
  public carts = new Map<string, Map<string, UserCartItemDocument>>();
  public quarantine = new Map<string, QuarantinedLegacyCartItem>();
  public auditLogs: Record<string, any>[] = [];

  private ensureBucket(uid: string): Map<string, UserCartItemDocument> {
    if (!this.carts.has(uid)) {
      this.carts.set(uid, new Map());
    }
    return this.carts.get(uid)!;
  }

  async getUserProfile(uid: string): Promise<Record<string, any> | null> {
    const u = this.users.get(uid);
    return u ? JSON.parse(JSON.stringify(u)) : null;
  }

  async listUserCart(ownerUid: string): Promise<UserCartItemDocument[]> {
    const bucket = this.ensureBucket(ownerUid);
    return Array.from(bucket.values())
      .filter((d) => d.ownerUid === ownerUid && d.status === 'ACTIVE')
      .map((d) => JSON.parse(JSON.stringify(d)))
      .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
  }

  async getUserCartItem(ownerUid: string, cartItemId: string): Promise<UserCartItemDocument | null> {
    const doc = this.ensureBucket(ownerUid).get(cartItemId);
    if (!doc || doc.ownerUid !== ownerUid) return null;
    return JSON.parse(JSON.stringify(doc));
  }

  async saveUserCartItem(
    ownerUid: string,
    docData: UserCartItemDocument,
    _token: string,
    createOnly = false
  ): Promise<void> {
    const bucket = this.ensureBucket(ownerUid);
    if (createOnly && bucket.has(docData.cartItemId)) {
      const err: any = new Error('Cart item already exists.');
      err.status = 409;
      throw err;
    }
    bucket.set(docData.cartItemId, JSON.parse(JSON.stringify(docData)));
  }

  async deleteUserCartItem(ownerUid: string, cartItemId: string): Promise<void> {
    this.ensureBucket(ownerUid).delete(cartItemId);
  }

  async clearUserCart(ownerUid: string): Promise<number> {
    const bucket = this.ensureBucket(ownerUid);
    const count = bucket.size;
    bucket.clear();
    return count;
  }

  async listQuarantinedItems(): Promise<QuarantinedLegacyCartItem[]> {
    return Array.from(this.quarantine.values())
      .map((r) => JSON.parse(JSON.stringify(r)))
      .sort((a, b) => String(b.discoveredAt).localeCompare(String(a.discoveredAt)));
  }

  async getQuarantinedItem(recordId: string): Promise<QuarantinedLegacyCartItem | null> {
    const r = this.quarantine.get(recordId);
    return r ? JSON.parse(JSON.stringify(r)) : null;
  }

  async saveQuarantinedItem(record: QuarantinedLegacyCartItem): Promise<void> {
    this.quarantine.set(record.id, JSON.parse(JSON.stringify(record)));
  }

  async saveAuditLog(log: Record<string, any>): Promise<void> {
    this.auditLogs.push(JSON.parse(JSON.stringify(log)));
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const IMMUTABLE_CART_FIELDS = ['ownerUid', 'addedByUid', 'addedByRole', 'addedAt', 'cartItemId'] as const;

function parseQuoteItemFromRequestBody(body: any): QuoteItem | null {
  if (!body || typeof body !== 'object') return null;
  const candidate =
    body.itemPayload && typeof body.itemPayload === 'object'
      ? body.itemPayload
      : body.quoteItem && typeof body.quoteItem === 'object'
      ? body.quoteItem
      : body;

  if (!candidate || typeof candidate !== 'object') return null;
  if (!candidate.product || typeof candidate.product !== 'object') return null;

  const prod = candidate.product;
  if (!prod.id && !candidate.productId) return null;

  return candidate as QuoteItem;
}

function mapStoreErrorStatus(err: any): number {
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 600) {
    return err.status;
  }
  const msg = String(err?.message || '');
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) return 403;
  if (msg.includes('401')) return 401;
  if (msg.includes('404')) return 404;
  return 500;
}

// ============================================================================
// ROUTER 1: AUTHENTICATED USER OWN-CART API (/api/cart)
// ============================================================================

export function createUserCartRouter(options?: {
  store?: UserCartApiStoreAdapter;
  verifyCaller?: CartCallerVerifier;
}): Router {
  const router = Router();
  const store = options?.store || new FirestoreUserCartApiStore();
  const verifyCaller = options?.verifyCaller || verifyAuthenticatedCartCaller;

  // GET /api/cart — Strictly loads authenticated caller's own UID cart ONLY.
  // Explicitly ignores/rejects cross-user ownerUid/agencyId override attempts.
  router.get('/', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { caller } = auth;

    // Security check: reject explicit IDOR query attempts targeting another user
    const requestedOwnerUid =
      typeof req.query.ownerUid === 'string' ? req.query.ownerUid.trim() : '';
    const requestedUserId =
      typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    if (
      (requestedOwnerUid && requestedOwnerUid !== caller.uid) ||
      (requestedUserId && requestedUserId !== caller.uid)
    ) {
      return res.status(403).json({
        error: 'Forbidden: Cross-user cart access is prohibited. Users may only access their own cart.'
      });
    }

    try {
      const items = await store.listUserCart(caller.uid, caller.idToken);
      return res.status(200).json({
        ownerUid: caller.uid,
        schemaVersion: USER_CART_SCHEMA_VERSION,
        count: items.length,
        items
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to load authenticated user cart.'
      });
    }
  });

  // POST /api/cart/items — Add/upsert an item strictly into caller's own UID cart.
  router.post('/items', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { caller } = auth;
    const body = req.body || {};

    // Reject cross-user ownership spoofing immediately with 403
    if (body.ownerUid !== undefined && String(body.ownerUid).trim() !== caller.uid) {
      return res.status(403).json({
        error: 'Forbidden: Cannot add a cart item with an ownerUid different from the authenticated user.'
      });
    }
    if (body.addedByUid !== undefined && String(body.addedByUid).trim() !== caller.uid) {
      return res.status(403).json({
        error: 'Forbidden: addedByUid must match the authenticated user.'
      });
    }
    if (
      body.addedByRole !== undefined &&
      String(body.addedByRole).trim().toUpperCase() !== 'B2B_AGENT'
    ) {
      return res.status(403).json({
        error: 'Forbidden: Self-added cart items must record addedByRole as B2B_AGENT. Use the Admin endpoint for on-behalf-of additions.'
      });
    }

    const quoteItem = parseQuoteItemFromRequestBody(body);
    if (!quoteItem) {
      return res.status(400).json({
        error: 'Invalid cart item payload: a valid product object and productId are required.'
      });
    }

    // Also guard against nested ownerUid mismatch inside itemPayload
    if (quoteItem.ownerUid && quoteItem.ownerUid !== caller.uid) {
      return res.status(403).json({
        error: 'Forbidden: Nested itemPayload.ownerUid does not match authenticated user.'
      });
    }

    try {
      const targetId = sanitizeCartItemId(body.cartItemId || quoteItem.id);
      const existing = await store.getUserCartItem(caller.uid, targetId, caller.idToken);

      const docData = buildUserCartItemDocument({
        ownerUid: caller.uid,
        agencyId: caller.agencyId,
        quoteItem: { ...quoteItem, id: targetId },
        addedByUid: caller.uid,
        addedByRole: 'B2B_AGENT',
        addedByName: caller.name,
        addedByEmail: caller.email,
        existingDoc: existing
      });

      await store.saveUserCartItem(caller.uid, docData, caller.idToken, false);
      return res.status(existing ? 200 : 201).json({
        ownerUid: caller.uid,
        item: docData
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to save cart item.'
      });
    }
  });

  // PATCH /api/cart/items/:cartItemId — Update mutable fields on caller's own cart item.
  router.patch('/items/:cartItemId', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { caller } = auth;
    const cartItemId = String(req.params.cartItemId || '').trim();
    if (!isValidCartDocumentId(cartItemId)) {
      return res.status(400).json({ error: 'Invalid cartItemId parameter.' });
    }

    const body = req.body || {};

    try {
      const existing = await store.getUserCartItem(caller.uid, cartItemId, caller.idToken);
      if (!existing) {
        return res.status(404).json({
          error: 'Cart item not found in the authenticated user cart.'
        });
      }

      // Enforce immutability of ownership & provenance fields
      for (const field of IMMUTABLE_CART_FIELDS) {
        if (body[field] !== undefined && body[field] !== (existing as any)[field]) {
          return res.status(403).json({
            error: `Forbidden: Field "${field}" is immutable on cart items and cannot be modified.`
          });
        }
      }
      if (body.itemPayload?.ownerUid && body.itemPayload.ownerUid !== existing.ownerUid) {
        return res.status(403).json({
          error: 'Forbidden: Cannot reassign cart item ownership.'
        });
      }

      const mergedQuoteItem: QuoteItem = {
        ...existing.itemPayload,
        ...(body.itemPayload && typeof body.itemPayload === 'object' ? body.itemPayload : {}),
        ...(body.pax || body.passengerConfig
          ? { pax: { ...existing.itemPayload.pax, ...(body.pax || body.passengerConfig) } }
          : {}),
        ...(typeof body.selectedServiceDate === 'string'
          ? { travelDate: body.selectedServiceDate }
          : {}),
        ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
        id: existing.cartItemId
      };

      const updatedDoc = buildUserCartItemDocument({
        ownerUid: caller.uid,
        agencyId: existing.agencyId ?? caller.agencyId,
        quoteItem: mergedQuoteItem,
        addedByUid: existing.addedByUid,
        addedByRole: existing.addedByRole,
        addedByName: existing.addedByName,
        addedByEmail: existing.addedByEmail,
        adminNote: existing.adminNote,
        existingDoc: existing
      });

      if (typeof body.quantity === 'number' && Number.isFinite(body.quantity) && body.quantity >= 1) {
        updatedDoc.quantity = Math.floor(body.quantity);
      }

      await store.saveUserCartItem(caller.uid, updatedDoc, caller.idToken, false);
      return res.status(200).json({
        ownerUid: caller.uid,
        item: updatedDoc
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to update cart item.'
      });
    }
  });

  // DELETE /api/cart/items/:cartItemId — Remove an item strictly from caller's own cart.
  router.delete('/items/:cartItemId', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { caller } = auth;
    const cartItemId = String(req.params.cartItemId || '').trim();
    if (!isValidCartDocumentId(cartItemId)) {
      return res.status(400).json({ error: 'Invalid cartItemId parameter.' });
    }

    try {
      await store.deleteUserCartItem(caller.uid, cartItemId, caller.idToken);
      return res.status(200).json({
        deleted: true,
        ownerUid: caller.uid,
        cartItemId
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to delete cart item.'
      });
    }
  });

  // DELETE /api/cart — Clear strictly the authenticated caller's own cart ONLY.
  router.delete('/', async (req: Request, res: Response) => {
    const auth = await verifyCaller(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    const { caller } = auth;

    try {
      const removedCount = await store.clearUserCart(caller.uid, caller.idToken);
      return res.status(200).json({
        cleared: true,
        ownerUid: caller.uid,
        removedCount
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to clear user cart.'
      });
    }
  });

  return router;
}

// ============================================================================
// ROUTER 2: AUTHORISED ADMIN AGENT-CART & QUARANTINE API (/api/admin)
// ============================================================================

export function createAdminUserCartRouter(options?: {
  store?: UserCartApiStoreAdapter;
  verifyCaller?: CartCallerVerifier;
}): Router {
  const router = Router();
  const store = options?.store || new FirestoreUserCartApiStore();
  const verifyCaller = options?.verifyCaller || verifyAuthenticatedCartCaller;

  async function requireAuthorisedAdmin(
    req: Request,
    res: Response
  ): Promise<VerifiedCartCaller | null> {
    const auth = await verifyCaller(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return null;
    }
    if (!auth.caller.isAuthorisedCartAdmin) {
      res.status(403).json({
        error: 'Forbidden: Only authorised CMS Administrators (ADMIN / SUPER_ADMIN) may manage agent carts or review quarantined cart items.'
      });
      return null;
    }
    return auth.caller;
  }

  // GET /api/admin/agents/:targetUid/cart — Inspect a specific target agent's isolated cart
  router.get('/agents/:targetUid/cart', async (req: Request, res: Response) => {
    const admin = await requireAuthorisedAdmin(req, res);
    if (!admin) return;

    const targetUid = String(req.params.targetUid || '').trim();
    if (!isValidCartDocumentId(targetUid)) {
      return res.status(400).json({ error: 'Invalid targetUid parameter.' });
    }

    try {
      const targetUser = await store.getUserProfile(targetUid, admin.idToken);
      if (!targetUser) {
        return res.status(404).json({ error: `Target agent UID "${targetUid}" does not exist.` });
      }
      const items = await store.listUserCart(targetUid, admin.idToken);
      return res.status(200).json({
        targetUid,
        targetName: targetUser.name || targetUser.displayName || targetUser.email || targetUid,
        agencyId: targetUser.companyId || targetUser.agencyId || null,
        count: items.length,
        items
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to load target agent cart.'
      });
    }
  });

  // POST /api/admin/agents/:targetUid/cart/items — Admin adds item explicitly to targetUid's cart
  router.post('/agents/:targetUid/cart/items', async (req: Request, res: Response) => {
    const admin = await requireAuthorisedAdmin(req, res);
    if (!admin) return;

    const targetUid = String(req.params.targetUid || '').trim();
    if (!isValidCartDocumentId(targetUid)) {
      return res.status(400).json({
        error: 'Explicit target B2B Agent UID is required to add an item on behalf of an agent.'
      });
    }

    const body = req.body || {};
    const quoteItem = parseQuoteItemFromRequestBody(body);
    if (!quoteItem) {
      return res.status(400).json({
        error: 'Invalid cart item payload: a valid product object and productId are required.'
      });
    }

    try {
      const targetUser = await store.getUserProfile(targetUid, admin.idToken);
      if (!targetUser) {
        return res.status(404).json({ error: `Target agent UID "${targetUid}" was not found.` });
      }
      const targetRole = String(targetUser.role || targetUser.userType || '').toUpperCase();
      if (targetRole === 'BUYER') {
        return res.status(400).json({
          error: 'Invalid target user: Cart items cannot be assigned to BUYER accounts.'
        });
      }

      const targetAgencyId =
        typeof targetUser.companyId === 'string' && targetUser.companyId.trim()
          ? targetUser.companyId.trim()
          : typeof targetUser.agencyId === 'string' && targetUser.agencyId.trim()
          ? targetUser.agencyId.trim()
          : null;

      const cartItemId = sanitizeCartItemId(
        body.cartItemId || `admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      );
      const adminNote =
        typeof body.adminNote === 'string' ? body.adminNote.trim().slice(0, 1000) : '';

      const docData = buildUserCartItemDocument({
        ownerUid: targetUid,
        agencyId: targetAgencyId,
        quoteItem: { ...quoteItem, id: cartItemId },
        addedByUid: admin.uid,
        addedByRole: 'ADMIN' as CartAddedByRole,
        addedByName: admin.name,
        addedByEmail: admin.email,
        adminNote
      });

      await store.saveUserCartItem(targetUid, docData, admin.idToken, true);

      // Record immutable audit trail
      const auditId = sanitizeCartItemId(`audit_cart_admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      await store.saveAuditLog(
        {
          id: auditId,
          userId: admin.uid,
          userName: admin.name,
          userEmail: admin.email,
          userRole: admin.role,
          action: 'ADMIN_ADDED_AGENT_CART_ITEM',
          module: 'B2B_CART',
          recordId: cartItemId,
          targetUid,
          targetEmail: targetUser.email || '',
          productId: docData.productId,
          productName: docData.productName,
          details: `Admin ${admin.name} (${admin.uid}) added "${docData.productName}" to agent ${targetUser.name || targetUid} (UID: ${targetUid}) cart. Note: ${adminNote || 'N/A'}`,
          timestamp: docData.addedAt
        },
        admin.idToken
      );

      return res.status(201).json({
        ownerUid: targetUid,
        addedByUid: admin.uid,
        addedByRole: 'ADMIN',
        item: docData
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to add item to target agent cart.'
      });
    }
  });

  // DELETE /api/admin/agents/:targetUid/cart/items/:cartItemId — Admin removes item from target agent's cart
  router.delete('/agents/:targetUid/cart/items/:cartItemId', async (req: Request, res: Response) => {
    const admin = await requireAuthorisedAdmin(req, res);
    if (!admin) return;

    const targetUid = String(req.params.targetUid || '').trim();
    const cartItemId = String(req.params.cartItemId || '').trim();
    if (!isValidCartDocumentId(targetUid) || !isValidCartDocumentId(cartItemId)) {
      return res.status(400).json({ error: 'Invalid targetUid or cartItemId parameter.' });
    }

    try {
      await store.deleteUserCartItem(targetUid, cartItemId, admin.idToken);
      const auditId = sanitizeCartItemId(`audit_cart_rm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      await store.saveAuditLog(
        {
          id: auditId,
          userId: admin.uid,
          userName: admin.name,
          userRole: admin.role,
          action: 'ADMIN_REMOVED_AGENT_CART_ITEM',
          module: 'B2B_CART',
          recordId: cartItemId,
          targetUid,
          details: `Admin ${admin.name} (${admin.uid}) removed cart item ${cartItemId} from target agent UID ${targetUid}.`,
          timestamp: new Date().toISOString()
        },
        admin.idToken
      );

      return res.status(200).json({
        deleted: true,
        targetUid,
        cartItemId
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to remove target agent cart item.'
      });
    }
  });

  // GET /api/admin/cart/quarantine — List quarantined legacy shared cart records
  router.get('/cart/quarantine', async (req: Request, res: Response) => {
    const admin = await requireAuthorisedAdmin(req, res);
    if (!admin) return;

    try {
      const records = await store.listQuarantinedItems(admin.idToken);
      return res.status(200).json({
        count: records.length,
        records
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to load quarantined legacy cart records.'
      });
    }
  });

  // POST /api/admin/cart/quarantine/:recordId/assign — Assign quarantined item to an explicit target agent UID
  router.post('/cart/quarantine/:recordId/assign', async (req: Request, res: Response) => {
    const admin = await requireAuthorisedAdmin(req, res);
    if (!admin) return;

    const recordId = String(req.params.recordId || '').trim();
    const targetUid = String(req.body?.targetUid || '').trim();
    const adminNote =
      typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim().slice(0, 1000) : '';

    if (!isValidCartDocumentId(recordId) || !isValidCartDocumentId(targetUid)) {
      return res.status(400).json({ error: 'Valid recordId and targetUid are required.' });
    }

    try {
      const record = await store.getQuarantinedItem(recordId, admin.idToken);
      if (!record) {
        return res.status(404).json({ error: `Quarantined record "${recordId}" not found.` });
      }
      if (record.status !== 'QUARANTINED') {
        return res.status(409).json({
          error: `Quarantined record "${recordId}" has already been processed (${record.status}).`
        });
      }

      const targetUser = await store.getUserProfile(targetUid, admin.idToken);
      if (!targetUser) {
        return res.status(404).json({ error: `Target agent UID "${targetUid}" not found.` });
      }

      const cartItemId = sanitizeCartItemId(`qassign_${recordId}_${Date.now()}`);
      const docData = buildUserCartItemDocument({
        ownerUid: targetUid,
        agencyId: targetUser.companyId || targetUser.agencyId || null,
        quoteItem: { ...(record.rawItemPayload as QuoteItem), id: cartItemId },
        addedByUid: admin.uid,
        addedByRole: 'ADMIN',
        addedByName: admin.name,
        addedByEmail: admin.email,
        adminNote: adminNote || `Assigned from quarantined legacy record ${recordId}`
      });

      await store.saveUserCartItem(targetUid, docData, admin.idToken, true);

      const updatedRecord: QuarantinedLegacyCartItem = {
        ...record,
        status: 'ASSIGNED',
        assignedToUid: targetUid,
        assignedToName: String(targetUser.name || targetUser.displayName || targetUid),
        assignedByUid: admin.uid,
        assignedAt: new Date().toISOString(),
        adminNotes: adminNote || record.adminNotes
      };
      await store.saveQuarantinedItem(updatedRecord, admin.idToken);

      return res.status(200).json({
        record: updatedRecord,
        assignedItem: docData
      });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to assign quarantined legacy cart record.'
      });
    }
  });

  // POST /api/admin/cart/quarantine/:recordId/archive — Archive quarantined legacy cart record
  router.post('/cart/quarantine/:recordId/archive', async (req: Request, res: Response) => {
    const admin = await requireAuthorisedAdmin(req, res);
    if (!admin) return;

    const recordId = String(req.params.recordId || '').trim();
    const reason =
      typeof req.body?.reason === 'string'
        ? req.body.reason.trim().slice(0, 1000)
        : 'Archived by Admin after legacy cart isolation review';

    if (!isValidCartDocumentId(recordId)) {
      return res.status(400).json({ error: 'Valid recordId is required.' });
    }

    try {
      const record = await store.getQuarantinedItem(recordId, admin.idToken);
      if (!record) {
        return res.status(404).json({ error: `Quarantined record "${recordId}" not found.` });
      }
      const updatedRecord: QuarantinedLegacyCartItem = {
        ...record,
        status: 'ARCHIVED',
        archivedByUid: admin.uid,
        archivedAt: new Date().toISOString(),
        adminNotes: reason
      };
      await store.saveQuarantinedItem(updatedRecord, admin.idToken);
      return res.status(200).json({ record: updatedRecord });
    } catch (err: any) {
      return res.status(mapStoreErrorStatus(err)).json({
        error: err?.message || 'Failed to archive quarantined legacy cart record.'
      });
    }
  });

  return router;
}
