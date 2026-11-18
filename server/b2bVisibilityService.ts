import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  buildDestinationVisibilityIndex,
  isDestinationActive,
  isCityHubActiveForB2B,
  isProductActiveForB2B,
  isHotelActiveForB2B,
  isPackageActiveForB2B,
  isVisaOrAncillaryActiveForB2B,
  paginateAfterEligibility,
  analyzeQuotationDestinationEligibility,
  resolveDestinationIdToken
} from '../src/services/destinationVisibility';
import { fromFirestoreDocument } from './marginGovernanceService';

export interface B2BCatalogSnapshot {
  destinations: any[];
  hubs: any[];
  products: any[];
  hotels: any[];
  packages: any[];
  visas: any[];
  tombstones?: any[];
}

function getFirebaseConfig(): {
  projectId: string;
  firestoreDatabaseId: string;
} {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        projectId: parsed.projectId || 'gen-lang-client-0981426327',
        firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)'
      };
    }
  } catch (err) {
    console.warn('[B2B-VISIBILITY] Could not read firebase-applet-config.json:', err);
  }
  return {
    projectId: 'gen-lang-client-0981426327',
    firestoreDatabaseId: '(default)'
  };
}

function getFirestoreBaseUrl(): string {
  const cfg = getFirebaseConfig();
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
}

async function firestoreListCollection(
  collectionName: string,
  authHeader?: string
): Promise<Record<string, any>[]> {
  const results: Record<string, any>[] = [];
  let pageToken = '';
  const baseUrl = getFirestoreBaseUrl();

  for (let page = 0; page < 10; page++) {
    const url = new URL(`${baseUrl}/${collectionName}`);
    url.searchParams.set('pageSize', '500');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const headers: Record<string, string> = {};
    if (authHeader && authHeader.startsWith('Bearer ')) {
      headers.Authorization = authHeader;
    }

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Firestore list failed for ${collectionName} (${res.status}): ${text}`);
    }

    const json = (await res.json()) as any;
    const docs = Array.isArray(json.documents) ? json.documents : [];
    for (const doc of docs) {
      const parsed = fromFirestoreDocument(doc);
      if (parsed) {
        results.push(parsed);
      }
    }

    if (!json.nextPageToken) break;
    pageToken = String(json.nextPageToken);
  }

  return results;
}

export async function fetchB2BCatalogFromFirestore(authHeader?: string): Promise<B2BCatalogSnapshot> {
  const [destinations, hubs, products, hotels, packages, visas, tombstones] = await Promise.all([
    firestoreListCollection('destinations', authHeader),
    firestoreListCollection('city_hubs', authHeader).catch(() => []),
    firestoreListCollection('products', authHeader),
    firestoreListCollection('hotels', authHeader).catch(() => []),
    firestoreListCollection('b2b_packages', authHeader).catch(() => []),
    firestoreListCollection('visas', authHeader).catch(() => []),
    firestoreListCollection('inventory_tombstones', authHeader).catch(() => [])
  ]);

  return {
    destinations,
    hubs,
    products,
    hotels,
    packages,
    visas,
    tombstones
  };
}

const B2B_CATALOG_CACHE_TTL_MS = 20_000;
const liveCatalogCache = new Map<string, { snapshot: B2BCatalogSnapshot; expiresAt: number }>();
const inFlightCatalogRequests = new Map<string, Promise<B2BCatalogSnapshot>>();

export function invalidateB2BCatalogCache(): void {
  liveCatalogCache.clear();
}

async function fetchB2BCatalogCached(authHeader?: string): Promise<B2BCatalogSnapshot> {
  const cacheKey = authHeader && authHeader.startsWith('Bearer ') ? `auth:${authHeader.slice(-24)}` : 'anon';
  const now = Date.now();
  const cached = liveCatalogCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.snapshot;
  }

  const inflight = inFlightCatalogRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const promise = fetchB2BCatalogFromFirestore(authHeader)
    .then((snapshot) => {
      liveCatalogCache.set(cacheKey, {
        snapshot,
        expiresAt: Date.now() + B2B_CATALOG_CACHE_TTL_MS
      });
      return snapshot;
    })
    .finally(() => {
      inFlightCatalogRequests.delete(cacheKey);
    });

  inFlightCatalogRequests.set(cacheKey, promise);
  return promise;
}

function buildDeletedSet(tombstones?: any[]): Set<string> {
  const set = new Set<string>();
  if (!Array.isArray(tombstones)) return set;
  for (const t of tombstones) {
    if (!t) continue;
    const rawId = typeof t === 'string' ? t : (t.entityId || t.id);
    if (rawId) set.add(String(rawId).trim().toLowerCase());
  }
  return set;
}

function parsePaginationParams(req: Request): { page?: number; pageSize?: number } {
  const pageRaw = req.query.page !== undefined ? Number(req.query.page) : undefined;
  const pageSizeRaw = req.query.pageSize !== undefined ? Number(req.query.pageSize) : undefined;
  return {
    page: pageRaw && Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : undefined,
    pageSize: pageSizeRaw && Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : undefined
  };
}

export function createB2BVisibilityRouter(
  dataProvider?: (authHeader?: string) => Promise<B2BCatalogSnapshot>
): Router {
  const router = Router();
  const loadSnapshot = dataProvider || fetchB2BCatalogCached;

  const getContext = async (req: Request) => {
    const snapshot = await loadSnapshot(req.headers.authorization);
    const deletedIds = buildDeletedSet(snapshot.tombstones);
    const index = buildDestinationVisibilityIndex(snapshot.destinations, snapshot.hubs, deletedIds);
    return { snapshot, deletedIds, index };
  };

  // GET /api/b2b/destinations
  router.get('/destinations', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds } = await getContext(req);
      const q = String(req.query.searchQuery || '').trim().toLowerCase();

      const activeDestinations = (snapshot.destinations || []).filter((d) => {
        if (!isDestinationActive(d, deletedIds)) return false;
        if (!q) return true;
        return (
          String(d.name || '').toLowerCase().includes(q) ||
          String(d.country || '').toLowerCase().includes(q) ||
          String(d.slug || '').toLowerCase().includes(q)
        );
      });

      const { page, pageSize } = parsePaginationParams(req);
      if (page || pageSize) {
        const paged = paginateAfterEligibility(activeDestinations, () => true, page || 1, pageSize || 20);
        return res.json({ destinations: paged.items, ...paged });
      }
      return res.json({ destinations: activeDestinations, totalCount: activeDestinations.length });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to enforce B2B destination visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/destinations/:idOrSlug
  router.get('/destinations/:idOrSlug', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds } = await getContext(req);
      const key = String(req.params.idOrSlug || '').trim().toLowerCase();
      const dest = (snapshot.destinations || []).find(
        (d) =>
          String(d.id || '').trim().toLowerCase() === key ||
          String(d.slug || '').trim().toLowerCase() === key
      );

      if (!dest) {
        return res.status(404).json({
          error: 'Destination not found.',
          code: 'DESTINATION_NOT_FOUND'
        });
      }

      if (!isDestinationActive(dest, deletedIds)) {
        return res.status(403).json({
          error: 'Destination is not Active and is excluded from the B2B Agent Portal.',
          code: 'DESTINATION_NOT_ACTIVE'
        });
      }

      return res.json({ destination: dest });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to verify destination visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/hubs
  router.get('/hubs', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const destFilter = String(req.query.destinationId || '').trim();
      const resolvedFilterDest = destFilter ? resolveDestinationIdToken(destFilter, index) : null;

      if (destFilter && (!resolvedFilterDest || !index.activeDestinationIds.has(resolvedFilterDest))) {
        return res.json({ hubs: [], totalCount: 0 });
      }

      const activeHubs = (snapshot.hubs || []).filter((hub) => {
        if (!isCityHubActiveForB2B(hub, index, deletedIds)) return false;
        if (resolvedFilterDest) {
          const parentId =
            resolveDestinationIdToken(hub.destinationId, index) ||
            resolveDestinationIdToken(hub.destinationName, index);
          return parentId === resolvedFilterDest;
        }
        return true;
      });

      return res.json({ hubs: activeHubs, totalCount: activeHubs.length });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to enforce B2B hub visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/products
  router.get('/products', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const destFilter = String(req.query.destinationId || '').trim();
      const hubFilter = String(req.query.hubId || '').trim().toLowerCase();
      const categoryFilter = String(req.query.category || '').trim().toLowerCase();
      const q = String(req.query.searchQuery || '').trim().toLowerCase();

      const resolvedFilterDest = destFilter ? resolveDestinationIdToken(destFilter, index) : null;
      if (destFilter && (!resolvedFilterDest || !index.activeDestinationIds.has(resolvedFilterDest))) {
        const { page, pageSize } = parsePaginationParams(req);
        const paged = paginateAfterEligibility([], () => true, page || 1, pageSize || 20);
        return res.json({ products: paged.items, ...paged });
      }

      const eligible = (snapshot.products || []).filter((p) => {
        if (!isProductActiveForB2B(p, index, deletedIds)) return false;
        if (resolvedFilterDest) {
          const pDest =
            resolveDestinationIdToken(p.destinationId, index) ||
            resolveDestinationIdToken(p.destinationName, index) ||
            resolveDestinationIdToken(p.country, index);
          if (pDest !== resolvedFilterDest) return false;
        }
        if (hubFilter) {
          const pHub = String(p.hubId || p.cityHubId || '').trim().toLowerCase();
          const pCity = String(p.city || '').trim().toLowerCase();
          if (pHub !== hubFilter && pCity !== hubFilter) return false;
        }
        if (categoryFilter && categoryFilter !== 'all') {
          if (String(p.category || '').trim().toLowerCase() !== categoryFilter) return false;
        }
        if (q) {
          const matchesSearch =
            String(p.name || '').toLowerCase().includes(q) ||
            String(p.city || '').toLowerCase().includes(q) ||
            String(p.destinationName || '').toLowerCase().includes(q) ||
            String(p.country || '').toLowerCase().includes(q) ||
            String(p.category || '').toLowerCase().includes(q) ||
            String(p.sku || '').toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }
        return true;
      });

      const { page, pageSize } = parsePaginationParams(req);
      if (page || pageSize) {
        const paged = paginateAfterEligibility(eligible, () => true, page || 1, pageSize || 20);
        return res.json({ products: paged.items, ...paged });
      }
      return res.json({ products: eligible, totalCount: eligible.length });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to enforce B2B product visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/products/:id
  router.get('/products/:id', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const idKey = String(req.params.id || '').trim().toLowerCase();
      const prod = (snapshot.products || []).find(
        (p) =>
          String(p.id || '').trim().toLowerCase() === idKey ||
          String(p.sku || '').trim().toLowerCase() === idKey
      );

      if (!prod) {
        return res.status(404).json({ error: 'Product not found.', code: 'PRODUCT_NOT_FOUND' });
      }

      if (!isProductActiveForB2B(prod, index, deletedIds)) {
        return res.status(403).json({
          error: 'Product is excluded from the B2B Agent Portal because its destination is not Active.',
          code: 'DESTINATION_NOT_ACTIVE'
        });
      }

      return res.json({ product: prod });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to verify product visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/hotels
  router.get('/hotels', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const destFilter = String(req.query.destinationId || '').trim();
      const hubFilter = String(req.query.hubId || '').trim().toLowerCase();
      const q = String(req.query.searchQuery || '').trim().toLowerCase();

      const resolvedFilterDest = destFilter ? resolveDestinationIdToken(destFilter, index) : null;
      if (destFilter && (!resolvedFilterDest || !index.activeDestinationIds.has(resolvedFilterDest))) {
        const { page, pageSize } = parsePaginationParams(req);
        const paged = paginateAfterEligibility([], () => true, page || 1, pageSize || 20);
        return res.json({ hotels: paged.items, ...paged });
      }

      const eligible = (snapshot.hotels || []).filter((h) => {
        if (!isHotelActiveForB2B(h, index, deletedIds)) return false;
        if (resolvedFilterDest) {
          const hDest =
            resolveDestinationIdToken(h.destinationId, index) ||
            resolveDestinationIdToken(h.destinationName, index) ||
            resolveDestinationIdToken(h.country, index);
          if (hDest !== resolvedFilterDest) return false;
        }
        if (hubFilter) {
          const hHub = String(h.cityHubId || h.hubId || '').trim().toLowerCase();
          const hCity = String(h.cityName || h.city || '').trim().toLowerCase();
          if (hHub !== hubFilter && hCity !== hubFilter) return false;
        }
        if (q) {
          const matchesSearch =
            String(h.name || '').toLowerCase().includes(q) ||
            String(h.cityName || h.city || '').toLowerCase().includes(q) ||
            String(h.destinationName || '').toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }
        return true;
      });

      const { page, pageSize } = parsePaginationParams(req);
      if (page || pageSize) {
        const paged = paginateAfterEligibility(eligible, () => true, page || 1, pageSize || 20);
        return res.json({ hotels: paged.items, ...paged });
      }
      return res.json({ hotels: eligible, totalCount: eligible.length });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to enforce B2B hotel visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/hotels/:id
  router.get('/hotels/:id', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const idKey = String(req.params.id || '').trim().toLowerCase();
      const hotel = (snapshot.hotels || []).find((h) => String(h.id || '').trim().toLowerCase() === idKey);

      if (!hotel) {
        return res.status(404).json({ error: 'Hotel not found.', code: 'HOTEL_NOT_FOUND' });
      }

      if (!isHotelActiveForB2B(hotel, index, deletedIds)) {
        return res.status(403).json({
          error: 'Hotel is excluded from the B2B Agent Portal because its destination is not Active.',
          code: 'DESTINATION_NOT_ACTIVE'
        });
      }

      return res.json({ hotel });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to verify hotel visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/packages
  router.get('/packages', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const destFilter = String(req.query.destinationId || '').trim();
      const q = String(req.query.searchQuery || '').trim().toLowerCase();

      const resolvedFilterDest = destFilter ? resolveDestinationIdToken(destFilter, index) : null;
      if (destFilter && (!resolvedFilterDest || !index.activeDestinationIds.has(resolvedFilterDest))) {
        const { page, pageSize } = parsePaginationParams(req);
        const paged = paginateAfterEligibility([], () => true, page || 1, pageSize || 20);
        return res.json({ packages: paged.items, ...paged });
      }

      const eligible = (snapshot.packages || []).filter((pkg) => {
        if (!isPackageActiveForB2B(pkg, index, deletedIds)) return false;
        if (resolvedFilterDest) {
          const pDest =
            resolveDestinationIdToken(pkg.destinationId, index) ||
            resolveDestinationIdToken(pkg.destinationName, index);
          if (pDest !== resolvedFilterDest) return false;
        }
        if (q) {
          const matchesSearch =
            String(pkg.title || '').toLowerCase().includes(q) ||
            String(pkg.destinationName || '').toLowerCase().includes(q) ||
            String(pkg.tagline || '').toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }
        return true;
      });

      const { page, pageSize } = parsePaginationParams(req);
      if (page || pageSize) {
        const paged = paginateAfterEligibility(eligible, () => true, page || 1, pageSize || 20);
        return res.json({ packages: paged.items, ...paged });
      }
      return res.json({ packages: eligible, totalCount: eligible.length });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to enforce B2B package visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/packages/:id
  router.get('/packages/:id', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const idKey = String(req.params.id || '').trim().toLowerCase();
      const pkg = (snapshot.packages || []).find((p) => String(p.id || '').trim().toLowerCase() === idKey);

      if (!pkg) {
        return res.status(404).json({ error: 'Package not found.', code: 'PACKAGE_NOT_FOUND' });
      }

      if (!isPackageActiveForB2B(pkg, index, deletedIds)) {
        return res.status(403).json({
          error: 'Package references one or more non-active destinations and is excluded from the B2B Agent Portal.',
          code: 'DESTINATION_NOT_ACTIVE'
        });
      }

      return res.json({ package: pkg });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to verify package visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/visas
  router.get('/visas', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const destFilter = String(req.query.destinationId || req.query.country || '').trim();
      const q = String(req.query.searchQuery || '').trim().toLowerCase();

      const resolvedFilterDest = destFilter ? resolveDestinationIdToken(destFilter, index) : null;
      if (destFilter && (!resolvedFilterDest || !index.activeDestinationIds.has(resolvedFilterDest))) {
        const { page, pageSize } = parsePaginationParams(req);
        const paged = paginateAfterEligibility([], () => true, page || 1, pageSize || 20);
        return res.json({ visas: paged.items, ...paged });
      }

      const eligible = (snapshot.visas || []).filter((v) => {
        if (!isVisaOrAncillaryActiveForB2B(v, index, deletedIds)) return false;
        if (resolvedFilterDest) {
          const vDest =
            resolveDestinationIdToken(v.destinationId, index) ||
            resolveDestinationIdToken(v.country, index) ||
            resolveDestinationIdToken(v.destinationName, index);
          if (vDest !== resolvedFilterDest) return false;
        }
        if (q) {
          const matchesSearch =
            String(v.country || '').toLowerCase().includes(q) ||
            String(v.visaType || '').toLowerCase().includes(q) ||
            String(v.description || '').toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }
        return true;
      });

      const { page, pageSize } = parsePaginationParams(req);
      if (page || pageSize) {
        const paged = paginateAfterEligibility(eligible, () => true, page || 1, pageSize || 20);
        return res.json({ visas: paged.items, ...paged });
      }
      return res.json({ visas: eligible, totalCount: eligible.length });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to enforce B2B visa visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // GET /api/b2b/visas/:id
  router.get('/visas/:id', async (req: Request, res: Response) => {
    try {
      const { snapshot, deletedIds, index } = await getContext(req);
      const idKey = String(req.params.id || '').trim().toLowerCase();
      const visa = (snapshot.visas || []).find((v) => String(v.id || '').trim().toLowerCase() === idKey);

      if (!visa) {
        return res.status(404).json({ error: 'Visa service not found.', code: 'VISA_NOT_FOUND' });
      }

      if (!isVisaOrAncillaryActiveForB2B(visa, index, deletedIds)) {
        return res.status(403).json({
          error: 'Visa service belongs to a non-active destination and is excluded from the B2B Agent Portal.',
          code: 'DESTINATION_NOT_ACTIVE'
        });
      }

      return res.json({ visa });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to verify visa service visibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  // POST /api/b2b/quotes/validate
  router.post('/quotes/validate', async (req: Request, res: Response) => {
    try {
      const { index } = await getContext(req);
      const { mode = 'NEW', destinationId, quotation, itemsToAdd } = req.body || {};

      if (mode === 'FINALIZED') {
        const review = analyzeQuotationDestinationEligibility(quotation || {}, index);
        return res.json({
          allowed: true,
          preserveHistoricalData: true,
          review
        });
      }

      if (mode === 'DRAFT_REVIEW') {
        const review = analyzeQuotationDestinationEligibility(quotation || {}, index);
        return res.json({
          allowed: !review.requiresReview,
          preserveHistoricalData: true,
          review
        });
      }

      // Fail-closed validation for NEW quote creation or ADD_ITEM mutations
      const blockedReasons: string[] = [];

      if (destinationId) {
        const resolved = resolveDestinationIdToken(destinationId, index);
        if (!resolved || !index.activeDestinationIds.has(resolved)) {
          blockedReasons.push(`Destination "${destinationId}" is not Active.`);
        }
      }

      const candidateItems = Array.isArray(itemsToAdd)
        ? itemsToAdd
        : Array.isArray(quotation?.items)
          ? quotation.items
          : [];

      const review = analyzeQuotationDestinationEligibility(
        {
          destination: quotation?.destination || destinationId,
          destinationId: quotation?.destinationId || destinationId,
          items: candidateItems
        },
        index
      );

      if (review.requiresReview || blockedReasons.length > 0) {
        return res.status(403).json({
          allowed: false,
          code: 'DESTINATION_NOT_ACTIVE',
          error:
            blockedReasons[0] ||
            `One or more destinations (${
              review.affectedDestinations.map(d => `${d.name} (${d.status})`).join(', ') || 'Unknown'
            }) are not Active for B2B sales.`,
          review
        });
      }

      return res.json({
        allowed: true,
        review
      });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Failed to validate quotation destination eligibility.',
        detail: err?.message || 'Service unavailable'
      });
    }
  });

  return router;
}
