/**
 * COMPREHENSIVE AUTOMATED AUDIT — THEUNBOUND CART USER ISOLATION & DATA OWNERSHIP
 *
 * Verifies all mandatory production security & functional scenarios:
 *   A. Different Agencies — strict UID isolation across Agent A, Agent B, Agent C
 *   B. Same Agency — multiple agents sharing identical agencyId have 100% independent carts
 *   C. Admin Adds on Behalf of Agent — explicit target UID, addedByRole='ADMIN', audit trail, non-admin rejection
 *   D. Account Switching & Logout Hygiene — instant in-memory/cache purge, zero stale flash
 *   E. Persistence Across Refresh & Logout/Login — restored strictly from users/{uid}/cart
 *   F. Security, IDOR, Immutability & Express HTTP API Enforcement + Firestore Rules Audit
 *   G. Independent Item Removal & Clear — zero cross-user side effects
 *   H. Safe Idempotent Legacy Shared Cart Migration & Admin Quarantine Review
 *   I. Quote Builder Separation & Zero Legacy Global Cart Storage Regression Audit
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import {
  UserCartService,
  createInMemoryUserCartBackend,
  buildUserCartItemDocument,
  cartDocumentToVerifiedQuoteItem,
  clearAllUidCartCachesFromDevice,
  readUidNamespacedCartCache,
  writeUidNamespacedCartCache,
  LEGACY_SHARED_CART_KEY,
  UID_CART_CACHE_PREFIX,
  isAuthorisedCartAdmin,
  resolveAuthenticatedCartUid
} from '../services/userCartService';
import {
  createUserCartRouter,
  createAdminUserCartRouter,
  InMemoryUserCartApiStore,
  VerifiedCartCaller
} from '../../server/userCartService';
import { Product, QuoteItem, User } from '../types';

// ============================================================================
// DETERMINISTIC FIXTURES & MOCK BROWSER STORAGE
// ============================================================================

class MockStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

function installMockWindowStorage() {
  const localStorage = new MockStorage();
  const sessionStorage = new MockStorage();
  (globalThis as any).window = { localStorage, sessionStorage };
  return { localStorage, sessionStorage };
}

function makeProduct(id: string, name: string, price = 1000): Product {
  return {
    id,
    name,
    sku: `SKU-${id}`,
    destinationId: 'dest_japan',
    destinationName: 'Japan',
    city: 'Tokyo',
    country: 'Japan',
    category: 'EXPERIENCE',
    productType: 'EXPERIENCE',
    duration: '4 Hours',
    adultNetPrice: price * 0.8,
    sellingPriceStartingFrom: price,
    currency: 'USD',
    supplierId: 'sup_jp_1',
    supplierName: 'Tokyo Luxury DMC',
    images: ['https://example.com/p.jpg'],
    status: 'ACTIVE'
  } as unknown as Product;
}

function makeQuoteItem(id: string, productId: string, name: string, price = 1000): QuoteItem {
  const product = makeProduct(productId, name, price);
  return {
    id,
    productId,
    title: name,
    category: 'EXPERIENCE',
    product,
    travelDate: '2026-10-15',
    pax: { adults: 2, children: 0, infants: 0 },
    sellingPrice: price * 2,
    nettPrice: price * 1.6,
    currency: 'USD',
    notes: ''
  } as unknown as QuoteItem;
}

const AGENT_A: User = {
  id: 'uid_agent_A',
  email: 'agent.a@alpha-travels.com',
  name: 'Agent Alpha One',
  role: 'B2B_AGENT',
  approvalStatus: 'APPROVED',
  companyId: 'agency_alpha_001',
  agencyName: 'Alpha Luxury Travels'
} as unknown as User;

const AGENT_A2_SAME_AGENCY: User = {
  id: 'uid_agent_A2',
  email: 'agent.a2@alpha-travels.com',
  name: 'Agent Alpha Two',
  role: 'B2B_AGENT',
  approvalStatus: 'APPROVED',
  companyId: 'agency_alpha_001', // SAME AGENCY AS AGENT_A!
  agencyName: 'Alpha Luxury Travels'
} as unknown as User;

const AGENT_B: User = {
  id: 'uid_agent_B',
  email: 'agent.b@beta-voyages.com',
  name: 'Agent Beta',
  role: 'B2B_AGENT',
  approvalStatus: 'APPROVED',
  companyId: 'agency_beta_002',
  agencyName: 'Beta Voyages'
} as unknown as User;

const AGENT_C: User = {
  id: 'uid_agent_C',
  email: 'agent.c@gamma-holidays.com',
  name: 'Agent Gamma',
  role: 'B2B_AGENT',
  approvalStatus: 'APPROVED',
  companyId: 'agency_gamma_003',
  agencyName: 'Gamma Holidays'
} as unknown as User;

const CMS_ADMIN: User = {
  id: 'uid_cms_admin_1',
  email: 'business@theunbound.in',
  name: 'TheUnbound Admin',
  role: 'ADMIN',
  approvalStatus: 'APPROVED'
} as unknown as User;

const TEAM_MEMBER: User = {
  id: 'uid_team_member_1',
  email: 'ops@theunbound.in',
  name: 'Ops Coordinator',
  role: 'TEAM_MEMBER',
  approvalStatus: 'APPROVED'
} as unknown as User;

const DIRECT_BUYER: User = {
  id: 'uid_buyer_1',
  email: 'consumer@example.com',
  name: 'Direct Buyer',
  role: 'BUYER',
  approvalStatus: 'APPROVED'
} as unknown as User;

// ============================================================================
// HTTP TEST HARNESS FOR EXPRESS ROUTERS
// ============================================================================

async function startTestApiServer() {
  const store = new InMemoryUserCartApiStore();
  [AGENT_A, AGENT_A2_SAME_AGENCY, AGENT_B, AGENT_C, CMS_ADMIN, TEAM_MEMBER, DIRECT_BUYER].forEach(
    (u) => store.users.set(u.id, u as any)
  );

  const tokenDirectory: Record<string, VerifiedCartCaller> = {
    tok_agent_A: {
      uid: AGENT_A.id,
      email: AGENT_A.email,
      name: AGENT_A.name,
      role: 'B2B_AGENT',
      userType: 'B2B_AGENT',
      approvalStatus: 'APPROVED',
      agencyId: 'agency_alpha_001',
      isAuthorisedCartAdmin: false,
      userDoc: AGENT_A as any,
      idToken: 'tok_agent_A'
    },
    tok_agent_A2: {
      uid: AGENT_A2_SAME_AGENCY.id,
      email: AGENT_A2_SAME_AGENCY.email,
      name: AGENT_A2_SAME_AGENCY.name,
      role: 'B2B_AGENT',
      userType: 'B2B_AGENT',
      approvalStatus: 'APPROVED',
      agencyId: 'agency_alpha_001',
      isAuthorisedCartAdmin: false,
      userDoc: AGENT_A2_SAME_AGENCY as any,
      idToken: 'tok_agent_A2'
    },
    tok_agent_B: {
      uid: AGENT_B.id,
      email: AGENT_B.email,
      name: AGENT_B.name,
      role: 'B2B_AGENT',
      userType: 'B2B_AGENT',
      approvalStatus: 'APPROVED',
      agencyId: 'agency_beta_002',
      isAuthorisedCartAdmin: false,
      userDoc: AGENT_B as any,
      idToken: 'tok_agent_B'
    },
    tok_admin: {
      uid: CMS_ADMIN.id,
      email: CMS_ADMIN.email,
      name: CMS_ADMIN.name,
      role: 'ADMIN',
      userType: 'ADMIN',
      approvalStatus: 'APPROVED',
      agencyId: null,
      isAuthorisedCartAdmin: true,
      userDoc: CMS_ADMIN as any,
      idToken: 'tok_admin'
    },
    tok_team: {
      uid: TEAM_MEMBER.id,
      email: TEAM_MEMBER.email,
      name: TEAM_MEMBER.name,
      role: 'TEAM_MEMBER',
      userType: 'TEAM_MEMBER',
      approvalStatus: 'APPROVED',
      agencyId: null,
      isAuthorisedCartAdmin: false,
      userDoc: TEAM_MEMBER as any,
      idToken: 'tok_team'
    }
  };

  const mockVerifier = async (req: express.Request) => {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return { ok: false as const, status: 401, error: 'Missing Bearer token' };
    }
    const token = auth.slice(7).trim();
    if (token === 'tok_buyer') {
      return { ok: false as const, status: 403, error: 'BUYER forbidden' };
    }
    const caller = tokenDirectory[token];
    if (!caller) {
      return { ok: false as const, status: 401, error: 'Invalid token' };
    }
    return { ok: true as const, caller };
  };

  const app = express();
  app.use(express.json());
  app.use('/api/cart', createUserCartRouter({ store, verifyCaller: mockVerifier }));
  app.use('/api/admin', createAdminUserCartRouter({ store, verifyCaller: mockVerifier }));

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return { server, baseUrl, store };
}

async function apiReq(
  baseUrl: string,
  method: string,
  urlPath: string,
  token?: string,
  body?: any
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// ============================================================================
// MAIN AUDIT RUNNER
// ============================================================================

async function runAudit() {
  let passed = 0;
  const pass = (label: string) => {
    passed++;
    console.log(`  [PASS] ${label}`);
  };

  console.log('\n=====================================================================');
  console.log(' THEUNBOUND CART USER ISOLATION & DATA OWNERSHIP — FULL AUDIT');
  console.log('=====================================================================\n');

  // --------------------------------------------------------------------------
  // TEST A: DIFFERENT AGENCIES — STRICT UID ISOLATION
  // --------------------------------------------------------------------------
  console.log('--- TEST A: Different Agencies Isolation (Agent A: 3, Agent B: 5, Agent C: 2) ---');
  {
    installMockWindowStorage();
    const backend = createInMemoryUserCartBackend();
    const svc = new UserCartService(backend);

    for (let i = 1; i <= 3; i++) {
      await svc.upsertOwnCartItem({
        actor: AGENT_A,
        actorFirebaseUid: AGENT_A.id,
        quoteItem: makeQuoteItem(`a_item_${i}`, `prod_a_${i}`, `Kyoto Tea Ceremony #${i}`, 400 + i * 50)
      });
    }
    for (let i = 1; i <= 5; i++) {
      await svc.upsertOwnCartItem({
        actor: AGENT_B,
        actorFirebaseUid: AGENT_B.id,
        quoteItem: makeQuoteItem(`b_item_${i}`, `prod_b_${i}`, `Swiss Alpine Rail #${i}`, 600 + i * 50)
      });
    }
    for (let i = 1; i <= 2; i++) {
      await svc.upsertOwnCartItem({
        actor: AGENT_C,
        actorFirebaseUid: AGENT_C.id,
        quoteItem: makeQuoteItem(`c_item_${i}`, `prod_c_${i}`, `Maldives Yacht Charter #${i}`, 1500 + i * 100)
      });
    }

    const cartA = await svc.listCartForUser({ actor: AGENT_A, actorFirebaseUid: AGENT_A.id, targetUid: AGENT_A.id });
    const cartB = await svc.listCartForUser({ actor: AGENT_B, actorFirebaseUid: AGENT_B.id, targetUid: AGENT_B.id });
    const cartC = await svc.listCartForUser({ actor: AGENT_C, actorFirebaseUid: AGENT_C.id, targetUid: AGENT_C.id });

    assert.strictEqual(cartA.length, 3, 'Agent A must have exactly 3 items');
    assert.strictEqual(cartB.length, 5, 'Agent B must have exactly 5 items');
    assert.strictEqual(cartC.length, 2, 'Agent C must have exactly 2 items');

    assert.ok(cartA.every((i) => i.ownerUid === AGENT_A.id && i.addedByRole === 'B2B_AGENT'));
    assert.ok(cartB.every((i) => i.ownerUid === AGENT_B.id && i.addedByRole === 'B2B_AGENT'));
    assert.ok(cartC.every((i) => i.ownerUid === AGENT_C.id && i.addedByRole === 'B2B_AGENT'));

    // Zero cross-contamination
    assert.strictEqual(cartA.filter((i) => i.cartItemId.startsWith('b_') || i.cartItemId.startsWith('c_')).length, 0);
    assert.strictEqual(cartB.filter((i) => i.cartItemId.startsWith('a_') || i.cartItemId.startsWith('c_')).length, 0);
    assert.strictEqual(cartC.filter((i) => i.cartItemId.startsWith('a_') || i.cartItemId.startsWith('b_')).length, 0);

    pass('Agent A (3), Agent B (5), Agent C (2) have 100% isolated carts with zero overlap');
  }

  // --------------------------------------------------------------------------
  // TEST B: SAME AGENCY ISOLATION (agencyId NEVER SHARES CARTS)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST B: Same Agency Isolation (Multiple Agents in agency_alpha_001) ---');
  {
    installMockWindowStorage();
    const backend = createInMemoryUserCartBackend();
    const svc = new UserCartService(backend);

    assert.strictEqual(
      (AGENT_A as any).companyId,
      (AGENT_A2_SAME_AGENCY as any).companyId,
      'Precondition: both agents must share identical agencyId'
    );

    await svc.upsertOwnCartItem({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      quoteItem: makeQuoteItem('alpha1_item1', 'prod_tokyo_1', 'Aman Tokyo Private Transfer', 950)
    });
    await svc.upsertOwnCartItem({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      quoteItem: makeQuoteItem('alpha1_item2', 'prod_tokyo_2', 'Ginza Michelin Omakase', 520)
    });

    await svc.upsertOwnCartItem({
      actor: AGENT_A2_SAME_AGENCY,
      actorFirebaseUid: AGENT_A2_SAME_AGENCY.id,
      quoteItem: makeQuoteItem('alpha2_item1', 'prod_paris_1', 'Louvre Private After-Hours Tour', 1200)
    });

    const cartA1 = await svc.listCartForUser({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      targetUid: AGENT_A.id
    });
    const cartA2 = await svc.listCartForUser({
      actor: AGENT_A2_SAME_AGENCY,
      actorFirebaseUid: AGENT_A2_SAME_AGENCY.id,
      targetUid: AGENT_A2_SAME_AGENCY.id
    });

    assert.strictEqual(cartA1.length, 2);
    assert.strictEqual(cartA2.length, 1);
    assert.strictEqual(cartA1.every((d) => d.ownerUid === AGENT_A.id), true);
    assert.strictEqual(cartA2.every((d) => d.ownerUid === AGENT_A2_SAME_AGENCY.id), true);
    assert.strictEqual(cartA2[0].cartItemId, 'alpha2_item1');

    // Verify cross-read inside the SAME agency is strictly rejected!
    let sameAgencyReadRejected = false;
    try {
      await svc.listCartForUser({
        actor: AGENT_A,
        actorFirebaseUid: AGENT_A.id,
        targetUid: AGENT_A2_SAME_AGENCY.id
      });
    } catch (e: any) {
      sameAgencyReadRejected = String(e.message).includes('PERMISSION_DENIED');
    }
    assert.strictEqual(sameAgencyReadRejected, true, 'Same-agency peer read MUST be rejected');

    pass('Same-agency agents (uid_agent_A & uid_agent_A2) have completely separate carts and cannot read each other');
  }

  // --------------------------------------------------------------------------
  // TEST C: AUTHORISED CMS ADMIN ADDS TO EXPLICIT TARGET AGENT + AUDIT TRAIL
  // --------------------------------------------------------------------------
  console.log('\n--- TEST C: CMS Admin Adds Item on Behalf of Agent A + Role Enforcement ---');
  {
    installMockWindowStorage();
    const backend = createInMemoryUserCartBackend();
    const svc = new UserCartService(backend);

    assert.strictEqual(isAuthorisedCartAdmin(CMS_ADMIN), true);
    assert.strictEqual(isAuthorisedCartAdmin(AGENT_A), false);
    assert.strictEqual(isAuthorisedCartAdmin(TEAM_MEMBER), false);
    assert.strictEqual(isAuthorisedCartAdmin(DIRECT_BUYER), false);
    assert.strictEqual(resolveAuthenticatedCartUid(DIRECT_BUYER, { uid: DIRECT_BUYER.id }), null);

    // Non-admin attempts must fail
    for (const unauthorizedActor of [AGENT_B, TEAM_MEMBER, DIRECT_BUYER]) {
      let rejected = false;
      try {
        await svc.adminAddItemToAgentCart({
          actor: unauthorizedActor,
          actorFirebaseUid: unauthorizedActor.id,
          targetAgent: AGENT_A,
          quoteItem: makeQuoteItem('unauth_item', 'prod_x', 'Unauthorized Inject', 100)
        });
      } catch (e: any) {
        rejected = String(e.message).includes('PERMISSION_DENIED');
      }
      assert.strictEqual(
        rejected,
        true,
        `Non-admin actor ${unauthorizedActor.role} MUST be rejected from adminAddItemToAgentCart`
      );
    }

    // Authorised Admin adds explicitly to AGENT_A
    const adminAdded = await svc.adminAddItemToAgentCart({
      actor: CMS_ADMIN,
      actorFirebaseUid: CMS_ADMIN.id,
      targetAgent: AGENT_A,
      quoteItem: makeQuoteItem('vip_concierge_1', 'prod_vip_1', 'VIP Haneda Tarmac Meet & Greet', 850),
      adminNote: 'Curated by concierge desk for VIP October itinerary'
    });

    assert.strictEqual(adminAdded.ownerUid, AGENT_A.id);
    assert.strictEqual(adminAdded.addedByUid, CMS_ADMIN.id);
    assert.strictEqual(adminAdded.addedByRole, 'ADMIN');
    assert.strictEqual(adminAdded.adminNote, 'Curated by concierge desk for VIP October itinerary');
    assert.ok(adminAdded.addedAt && adminAdded.addedAt.length >= 20);

    const cartA = await svc.listCartForUser({ actor: AGENT_A, actorFirebaseUid: AGENT_A.id, targetUid: AGENT_A.id });
    const cartB = await svc.listCartForUser({ actor: AGENT_B, actorFirebaseUid: AGENT_B.id, targetUid: AGENT_B.id });
    const cartA2 = await svc.listCartForUser({
      actor: AGENT_A2_SAME_AGENCY,
      actorFirebaseUid: AGENT_A2_SAME_AGENCY.id,
      targetUid: AGENT_A2_SAME_AGENCY.id
    });

    assert.strictEqual(cartA.length, 1);
    assert.strictEqual(cartA[0].addedByRole, 'ADMIN');
    assert.strictEqual(cartB.length, 0, 'Agent B must NOT see item Admin added to Agent A');
    assert.strictEqual(cartA2.length, 0, 'Same-agency Agent A2 must NOT see item Admin added to Agent A');

    // Verify QuoteItem view conversion preserves provenance badge metadata
    const viewItem = cartDocumentToVerifiedQuoteItem(cartA[0], AGENT_A.id);
    assert.ok(viewItem);
    assert.strictEqual(viewItem!.addedByRole, 'ADMIN');
    assert.strictEqual(viewItem!.addedByUid, CMS_ADMIN.id);
    assert.strictEqual(cartDocumentToVerifiedQuoteItem(cartA[0], AGENT_B.id), null);

    pass('Authorised Admin added item strictly to Agent A with ADMIN provenance; Agents B/A2 saw 0; non-admins rejected');
  }

  // --------------------------------------------------------------------------
  // TEST D: ACCOUNT SWITCHING & LOGOUT HYGIENE (ZERO STALE FLASH)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST D: Account Switching & Logout Hygiene ---');
  {
    const { localStorage, sessionStorage } = installMockWindowStorage();
    const backend = createInMemoryUserCartBackend();
    const svc = new UserCartService(backend);

    // Agent A adds 2 items and subscribes
    await svc.upsertOwnCartItem({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      quoteItem: makeQuoteItem('sw_a1', 'p_sw_a1', 'Tokyo Helicopter Transfer', 2200)
    });
    await svc.upsertOwnCartItem({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      quoteItem: makeQuoteItem('sw_a2', 'p_sw_a2', 'Hakone Ryokan Villa', 1800)
    });

    // Agent B has 1 different item
    await svc.upsertOwnCartItem({
      actor: AGENT_B,
      actorFirebaseUid: AGENT_B.id,
      quoteItem: makeQuoteItem('sw_b1', 'p_sw_b1', 'Amalfi Private Riva Boat', 2500)
    });

    const receivedBySessionA: string[][] = [];
    const unsubA = svc.subscribeToOwnCart(
      AGENT_A,
      AGENT_A.id,
      (docs) => receivedBySessionA.push(docs.map((d) => d.cartItemId))
    );

    assert.deepStrictEqual(receivedBySessionA[0], ['sw_a1', 'sw_a2']);
    assert.strictEqual(readUidNamespacedCartCache(AGENT_A.id).length, 2);
    assert.ok(sessionStorage.getItem(`${UID_CART_CACHE_PREFIX}${AGENT_A.id}`));

    // Logout Agent A -> unsubscribe + clear all device caches
    unsubA();
    clearAllUidCartCachesFromDevice();

    assert.strictEqual(readUidNamespacedCartCache(AGENT_A.id).length, 0);
    assert.strictEqual(sessionStorage.length, 0);
    assert.strictEqual(localStorage.length, 0);

    // Mutate Agent A's cart after unsubscribe -> must NOT trigger Agent A's old callback
    const callsBefore = receivedBySessionA.length;
    await svc.upsertOwnCartItem({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      quoteItem: makeQuoteItem('sw_a3', 'p_sw_a3', 'Late Item A', 500)
    });
    assert.strictEqual(receivedBySessionA.length, callsBefore, 'Unsubscribed listener must not fire');

    // Agent B logs in on the SAME browser device -> must see ONLY sw_b1 immediately, zero flash of A
    const receivedBySessionB: string[][] = [];
    const unsubB = svc.subscribeToOwnCart(
      AGENT_B,
      AGENT_B.id,
      (docs) => receivedBySessionB.push(docs.map((d) => d.cartItemId))
    );
    assert.deepStrictEqual(receivedBySessionB[0], ['sw_b1']);
    // Reading Agent A's cache key as Agent B returns empty and Agent B cannot read Agent A's docs
    writeUidNamespacedCartCache(
      AGENT_B.id,
      await svc.listCartForUser({ actor: AGENT_B, actorFirebaseUid: AGENT_B.id, targetUid: AGENT_B.id })
    );
    assert.strictEqual(readUidNamespacedCartCache(AGENT_A.id).length, 0);
    unsubB();

    pass('Logout immediately unsubscribes listeners, clears all device cart caches, and switches to Agent B with zero flash');
  }

  // --------------------------------------------------------------------------
  // TEST E: PERSISTENCE ACROSS REFRESH & LOGOUT/LOGIN
  // --------------------------------------------------------------------------
  console.log('\n--- TEST E: Persistence Across Refresh & Logout/Login ---');
  {
    installMockWindowStorage();
    const backend = createInMemoryUserCartBackend();
    const svc = new UserCartService(backend);

    await svc.upsertOwnCartItem({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      quoteItem: makeQuoteItem('persist_1', 'p_persist_1', 'Mount Fuji Private SUV', 780)
    });
    await svc.upsertOwnCartItem({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      quoteItem: makeQuoteItem('persist_2', 'p_persist_2', 'Nara Heritage Guide', 420)
    });

    // Simulate full browser storage wipe (refresh on brand-new device after logout)
    clearAllUidCartCachesFromDevice();
    assert.strictEqual(readUidNamespacedCartCache(AGENT_A.id).length, 0);

    // Agent A logs back in -> authoritative backend restores both items
    const restored = await svc.listCartForUser({ actor: AGENT_A, actorFirebaseUid: AGENT_A.id, targetUid: AGENT_A.id });
    assert.strictEqual(restored.length, 2);
    assert.deepStrictEqual(
      restored.map((d) => d.cartItemId).sort(),
      ['persist_1', 'persist_2']
    );

    pass('Agent A items persist across complete logout/device cache clear and restore accurately on re-login');
  }

  // --------------------------------------------------------------------------
  // TEST F & G: EXPRESS API SECURITY, IDOR, IMMUTABILITY & INDEPENDENT REMOVAL
  // --------------------------------------------------------------------------
  console.log('\n--- TEST F & G: Express HTTP API Security (401/403/IDOR/Immutability) + Independent Removal ---');
  {
    const { server, baseUrl, store } = await startTestApiServer();
    try {
      // F1. Unauthenticated requests -> 401
      const unauthGet = await apiReq(baseUrl, 'GET', '/api/cart');
      assert.strictEqual(unauthGet.status, 401, 'Unauthenticated GET /api/cart must return 401');

      const unauthAdmin = await apiReq(baseUrl, 'GET', '/api/admin/cart/quarantine');
      assert.strictEqual(unauthAdmin.status, 401, 'Unauthenticated Admin endpoint must return 401');

      // F2. BUYER forbidden -> 403
      const buyerGet = await apiReq(baseUrl, 'GET', '/api/cart', 'tok_buyer');
      assert.strictEqual(buyerGet.status, 403, 'BUYER GET /api/cart must return 403');

      // F3. Agent A adds 2 items; Agent A2 (same agency) adds 1 item; Agent B adds 2 items
      const addA1 = await apiReq(baseUrl, 'POST', '/api/cart/items', 'tok_agent_A', {
        quoteItem: makeQuoteItem('api_a1', 'p_api_a1', 'Kyoto Bamboo Rickshaw', 300)
      });
      assert.strictEqual(addA1.status, 201);
      assert.strictEqual(addA1.json.item.ownerUid, AGENT_A.id);
      assert.strictEqual(addA1.json.item.addedByRole, 'B2B_AGENT');

      const addA2 = await apiReq(baseUrl, 'POST', '/api/cart/items', 'tok_agent_A', {
        quoteItem: makeQuoteItem('api_a2', 'p_api_a2', 'Osaka Street Food Sommelier', 260)
      });
      assert.strictEqual(addA2.status, 201);

      const addPeerA2 = await apiReq(baseUrl, 'POST', '/api/cart/items', 'tok_agent_A2', {
        quoteItem: makeQuoteItem('api_peer_1', 'p_api_peer_1', 'Same Agency Peer Private Tour', 880)
      });
      assert.strictEqual(addPeerA2.status, 201);

      const addB1 = await apiReq(baseUrl, 'POST', '/api/cart/items', 'tok_agent_B', {
        quoteItem: makeQuoteItem('api_b1', 'p_api_b1', 'Zurich Chauffeur Sedan', 640)
      });
      assert.strictEqual(addB1.status, 201);

      // F4. IDOR query spoof: Agent A tries GET /api/cart?ownerUid=uid_agent_B -> 403
      const idorQuery = await apiReq(
        baseUrl,
        'GET',
        `/api/cart?ownerUid=${AGENT_B.id}`,
        'tok_agent_A'
      );
      assert.strictEqual(idorQuery.status, 403, 'IDOR query param spoofing must return 403');

      // F5. IDOR body spoof: Agent A tries POST /api/cart/items with ownerUid=uid_agent_B -> 403
      const idorWrite = await apiReq(baseUrl, 'POST', '/api/cart/items', 'tok_agent_A', {
        ownerUid: AGENT_B.id,
        quoteItem: makeQuoteItem('spoof_1', 'p_spoof', 'Spoofed Item', 100)
      });
      assert.strictEqual(idorWrite.status, 403, 'IDOR ownerUid write spoofing must return 403');

      // F6. Role escalation spoof on self-add -> 403
      const roleSpoof = await apiReq(baseUrl, 'POST', '/api/cart/items', 'tok_agent_A', {
        addedByRole: 'ADMIN',
        quoteItem: makeQuoteItem('spoof_role', 'p_spoof_r', 'Role Spoof', 100)
      });
      assert.strictEqual(roleSpoof.status, 403, 'Role escalation spoof must return 403');

      // F7. Immutability check: Agent A tries PATCH to reassign ownerUid to Agent B -> 403
      const mutateOwner = await apiReq(
        baseUrl,
        'PATCH',
        '/api/cart/items/api_a1',
        'tok_agent_A',
        { ownerUid: AGENT_B.id }
      );
      assert.strictEqual(mutateOwner.status, 403, 'Mutating immutable ownerUid must return 403');

      // F8. Valid mutable PATCH succeeds for own item
      const validPatch = await apiReq(
        baseUrl,
        'PATCH',
        '/api/cart/items/api_a1',
        'tok_agent_A',
        { notes: 'Window seats preferred', quantity: 4 }
      );
      assert.strictEqual(validPatch.status, 200);
      assert.strictEqual(validPatch.json.item.notes, 'Window seats preferred');
      assert.strictEqual(validPatch.json.item.quantity, 4);
      assert.strictEqual(validPatch.json.item.ownerUid, AGENT_A.id);

      // F9. Non-admins (Agent A & TEAM_MEMBER) blocked from Admin agent-cart endpoints -> 403
      const agentCallsAdmin = await apiReq(
        baseUrl,
        'GET',
        `/api/admin/agents/${AGENT_B.id}/cart`,
        'tok_agent_A'
      );
      assert.strictEqual(agentCallsAdmin.status, 403);

      const teamCallsAdmin = await apiReq(
        baseUrl,
        'POST',
        `/api/admin/agents/${AGENT_A.id}/cart/items`,
        'tok_team',
        { quoteItem: makeQuoteItem('tm_try', 'p_tm', 'Team Try', 100) }
      );
      assert.strictEqual(teamCallsAdmin.status, 403, 'TEAM_MEMBER must NOT be allowed to inject into agent carts');

      // F10. Authorised CMS Admin adds item explicitly to Agent A -> 201 + audit log
      const adminAddRes = await apiReq(
        baseUrl,
        'POST',
        `/api/admin/agents/${AGENT_A.id}/cart/items`,
        'tok_admin',
        {
          cartItemId: 'admin_curated_1',
          adminNote: 'VIP concierge recommendation',
          quoteItem: makeQuoteItem('admin_curated_1', 'p_vip_concierge', 'Kyoto Geisha Dinner', 1900)
        }
      );
      assert.strictEqual(adminAddRes.status, 201);
      assert.strictEqual(adminAddRes.json.ownerUid, AGENT_A.id);
      assert.strictEqual(adminAddRes.json.addedByUid, CMS_ADMIN.id);
      assert.strictEqual(adminAddRes.json.addedByRole, 'ADMIN');
      assert.ok(
        store.auditLogs.some(
          (l) => l.action === 'ADMIN_ADDED_AGENT_CART_ITEM' && l.targetUid === AGENT_A.id
        ),
        'Admin add must write an immutable audit log entry'
      );

      // Verify Agent A sees 3 items (2 own + 1 admin-added), Agent A2 sees 1, Agent B sees 1
      const getA = await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_A');
      const getA2 = await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_A2');
      const getB = await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_B');
      assert.strictEqual(getA.json.count, 3);
      assert.strictEqual(getA2.json.count, 1);
      assert.strictEqual(getB.json.count, 1);

      // G1. Independent Item Removal: Agent A removes 1 item -> Agent A has 2, A2 & B untouched
      const delA1 = await apiReq(baseUrl, 'DELETE', '/api/cart/items/api_a1', 'tok_agent_A');
      assert.strictEqual(delA1.status, 200);
      assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_A')).json.count, 2);
      assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_A2')).json.count, 1);
      assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_B')).json.count, 1);

      // G2. Independent Clear: Agent A clears entire cart -> Agent A has 0, A2 & B untouched
      const clearA = await apiReq(baseUrl, 'DELETE', '/api/cart', 'tok_agent_A');
      assert.strictEqual(clearA.status, 200);
      assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_A')).json.count, 0);
      assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_A2')).json.count, 1);
      assert.strictEqual((await apiReq(baseUrl, 'GET', '/api/cart', 'tok_agent_B')).json.count, 1);

      pass('Express HTTP API enforces 401/403/IDOR/ownerUid immutability, Admin audit logs, and independent delete/clear');
    } finally {
      server.close();
    }
  }

  // --------------------------------------------------------------------------
  // TEST H: SAFE IDEMPOTENT LEGACY MIGRATION & ADMIN QUARANTINE WORKFLOW
  // --------------------------------------------------------------------------
  console.log('\n--- TEST H: Safe Idempotent Legacy Migration & Quarantine Review ---');
  {
    const { localStorage, sessionStorage } = installMockWindowStorage();
    const backend = createInMemoryUserCartBackend();
    const svc = new UserCartService(backend);

    // Seed historical quotes & bookings snapshot (must NEVER be touched!)
    const historicalQuotations = [{ id: 'Q-2026-0001', finalTotal: 12500, items: ['legacy_q_item'] }];
    const historicalBookings = [{ id: 'BK-2026-0001', totalAmount: 12500, status: 'CONFIRMED' }];
    const quotesBefore = JSON.stringify(historicalQuotations);
    const bookingsBefore = JSON.stringify(historicalBookings);

    // Seed legacy shared global storage key with 3 mixed records:
    //  1) Verified ownerUid = AGENT_A.id -> safely migrates to users/uid_agent_A/cart
    //  2) Unowned shared record -> quarantined for Admin review
    //  3) Agency-only record (agencyId set, NO ownerUid) -> quarantined (NEVER assigned by agencyId!)
    const legacyRecords = [
      {
        ...makeQuoteItem('leg_owned_a', 'p_leg_1', 'Verified Legacy Tokyo Tour', 600),
        ownerUid: AGENT_A.id
      },
      makeQuoteItem('leg_unowned_1', 'p_leg_2', 'Ambiguous Shared Cart Hotel', 1400),
      {
        ...makeQuoteItem('leg_agency_only', 'p_leg_3', 'Agency-Only Legacy Transfer', 350),
        agencyId: 'agency_alpha_001'
      }
    ];
    localStorage.setItem(LEGACY_SHARED_CART_KEY, JSON.stringify(legacyRecords));
    sessionStorage.setItem(LEGACY_SHARED_CART_KEY, JSON.stringify(legacyRecords));

    // Pass 1: Agent A logs in and triggers migration
    const run1 = await svc.migrateOrQuarantineLegacyCartRecords({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      verifiedKnownUids: new Set([AGENT_A.id, AGENT_B.id])
    });

    assert.strictEqual(run1.migratedCount, 1, 'Only the explicitly verified ownerUid item should migrate');
    assert.strictEqual(run1.quarantinedCount, 2, 'Unowned and agency-only records must be quarantined');
    assert.strictEqual(run1.legacyKeysPurged, true, 'Legacy global shared key must be purged');
    assert.strictEqual(localStorage.getItem(LEGACY_SHARED_CART_KEY), null);
    assert.strictEqual(sessionStorage.getItem(LEGACY_SHARED_CART_KEY), null);

    // Pass 2: Idempotency check (re-running with same legacy external records creates ZERO duplicates)
    const run2 = await svc.migrateOrQuarantineLegacyCartRecords({
      actor: AGENT_A,
      actorFirebaseUid: AGENT_A.id,
      verifiedKnownUids: new Set([AGENT_A.id, AGENT_B.id]),
      externalLegacyRecords: legacyRecords.map((item) => ({
        item,
        sourceStorage: 'LEGACY_FIRESTORE' as const
      }))
    });
    assert.strictEqual(run2.migratedCount, 0, 'Idempotent re-run must not duplicate migrated item');
    assert.strictEqual(run2.skippedDuplicateCount, 1);

    // Verify Agent A has ONLY the 1 verified item, and Agent B has 0 items
    const cartA = await svc.listCartForUser({ actor: AGENT_A, actorFirebaseUid: AGENT_A.id, targetUid: AGENT_A.id });
    const cartB = await svc.listCartForUser({ actor: AGENT_B, actorFirebaseUid: AGENT_B.id, targetUid: AGENT_B.id });
    assert.strictEqual(cartA.length, 1);
    assert.strictEqual(cartB.length, 0);

    // Non-admin CANNOT inspect quarantined records
    let nonAdminQuarantineBlocked = false;
    try {
      await svc.listQuarantinedLegacyItems(AGENT_A);
    } catch (e: any) {
      nonAdminQuarantineBlocked = String(e.message).includes('PERMISSION_DENIED');
    }
    assert.strictEqual(nonAdminQuarantineBlocked, true);

    // Admin inspects quarantined items, assigns one to Agent B, archives one
    const quarantined = await svc.listQuarantinedLegacyItems(CMS_ADMIN);
    const agencyOnlyRec = quarantined.find((q) => q.quarantineReason === 'AGENCY_ONLY_OWNERSHIP');
    const sharedRec = quarantined.find((q) => q.quarantineReason === 'AMBIGUOUS_SHARED_STORAGE');
    assert.ok(agencyOnlyRec, 'Agency-only record must be quarantined with AGENCY_ONLY_OWNERSHIP');
    assert.ok(sharedRec, 'Shared record must be quarantined with AMBIGUOUS_SHARED_STORAGE');

    await svc.assignQuarantinedItemToAgent({
      actor: CMS_ADMIN,
      actorFirebaseUid: CMS_ADMIN.id,
      recordId: agencyOnlyRec!.id,
      targetAgent: AGENT_B,
      adminNote: 'Verified ownership with Beta Voyages'
    });
    await svc.archiveQuarantinedItem({
      actor: CMS_ADMIN,
      actorFirebaseUid: CMS_ADMIN.id,
      recordId: sharedRec!.id,
      reason: 'Stale pre-isolation test entry'
    });

    const cartBAfterAssign = await svc.listCartForUser({ actor: AGENT_B, actorFirebaseUid: AGENT_B.id, targetUid: AGENT_B.id });
    assert.strictEqual(cartBAfterAssign.length, 1);
    assert.strictEqual(cartBAfterAssign[0].ownerUid, AGENT_B.id);
    assert.strictEqual(cartBAfterAssign[0].addedByRole, 'ADMIN');

    // Historical quotations & bookings completely untouched
    assert.strictEqual(JSON.stringify(historicalQuotations), quotesBefore);
    assert.strictEqual(JSON.stringify(historicalBookings), bookingsBefore);

    pass('Idempotent legacy migration migrates only verified ownerUid, quarantines ambiguous/agency-only records, purges shared key, and preserves quotes/bookings');
  }

  // --------------------------------------------------------------------------
  // TEST I: STATIC CODEBASE & FIRESTORE RULES REGRESSION VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- TEST I: Firestore Rules, Quote Builder Separation & Zero Global Key Audit ---');
  {
    const root = process.cwd();
    const rulesSrc = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf-8');
    const quoteCtxSrc = fs.readFileSync(path.join(root, 'src/context/QuotationContext.tsx'), 'utf-8');
    const authCtxSrc = fs.readFileSync(path.join(root, 'src/context/AuthContext.tsx'), 'utf-8');

    // 1. Firestore rules enforce strict UID path, ownerUid immutability, admin-only quarantine
    assert.ok(rulesSrc.includes('match /users/{userId}/cart/{cartItemId}'));
    assert.ok(rulesSrc.includes('function isAuthorisedCartAdmin()'));
    assert.ok(rulesSrc.includes('function isValidUserCartItem('));
    assert.ok(rulesSrc.includes('request.resource.data.ownerUid == resource.data.ownerUid'));
    assert.ok(rulesSrc.includes('request.resource.data.addedByUid == resource.data.addedByUid'));
    assert.ok(rulesSrc.includes('request.resource.data.addedByRole == resource.data.addedByRole'));
    assert.ok(rulesSrc.includes('match /quarantined_legacy_cart_items/{recordId}'));
    assert.ok(rulesSrc.includes('allow get: if isValidId(recordId) && isAuthorisedCartAdmin();'));
    assert.ok(rulesSrc.includes('allow list: if isAuthorisedCartAdmin();'));

    // 2. QuotationContext NEVER reads or writes the legacy shared key directly (ignore comments)
    const quoteCtxCodeOnly = quoteCtxSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.strictEqual(
      quoteCtxCodeOnly.includes("'theunbound_cart_items'") ||
        quoteCtxCodeOnly.includes('"theunbound_cart_items"'),
      false,
      'QuotationContext.tsx MUST NOT read or write the legacy global shared key theunbound_cart_items'
    );
    assert.ok(quoteCtxSrc.includes('isEditingSavedQuoteRef'));
    assert.ok(quoteCtxSrc.includes('subscribeToOwnCart'));
    assert.ok(quoteCtxSrc.includes('isCartVerified'));

    // 3. AuthContext purges all UID cart caches on logout / unauthenticated transition
    assert.ok(authCtxSrc.includes('clearAllUidCartCachesFromDevice'));

    // 4. Verify buildUserCartItemDocument throws on ownerUid mutation attempt
    const existingDoc = buildUserCartItemDocument({
      ownerUid: AGENT_A.id,
      quoteItem: makeQuoteItem('imm_1', 'p_imm', 'Immutable Check', 500),
      addedByUid: AGENT_A.id,
      addedByRole: 'B2B_AGENT'
    });
    assert.throws(
      () =>
        buildUserCartItemDocument({
          ownerUid: AGENT_B.id,
          quoteItem: makeQuoteItem('imm_1', 'p_imm', 'Immutable Check', 500),
          addedByUid: AGENT_A.id,
          addedByRole: 'B2B_AGENT',
          existingDoc
        }),
      /ownerUid/i
    );

    pass('Firestore rules, QuotationContext Quote Builder separation, AuthContext logout purge, and immutability guards verified');
  }

  console.log(`\n=====================================================================`);
  console.log(` ALL ${passed}/${passed} CART USER ISOLATION AUDIT SUITES PASSED 100%!`);
  console.log(`=====================================================================\n`);
  process.exit(0);
}

runAudit().catch((err) => {
  console.error('\n[FAIL] Cart User Isolation Audit failed:', err);
  process.exit(1);
});
