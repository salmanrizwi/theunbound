import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db as firestore } from './firebase';
import {
  DestinationCommercialTermsConfig,
  DestinationTermsSection,
  DestinationTermsTargetType,
  DestinationTermsVersionRecord,
  Quotation,
  QuotationCommercialTermsSnapshot,
  QuotationDestinationTermsEntry,
  QuotationTermsExceptionApproval,
  QuotationTermsStatus,
  QuoteItem,
  TripRouteHub,
  User
} from '../types';
import { masterDataCache } from './masterDataCache';
import { MasterDataService, CANONICAL_LEGACY_MAPPINGS } from './masterDataService';
import {
  COMMERCIAL_QUOTATION_TERMS_HEADING,
  buildInitial16SectionsClone,
  renderDestinationSectionsToHtml,
  renderDestinationSectionsToPlainText,
  renderDestinationSectionsToWhatsApp
} from '../constants/commercialQuotationTerms';
import { sanitizeRichText, richTextToPlainText, richTextToWhatsApp } from '../utils/richTextFormatter';
import { AppDatabase } from './db';

const COLLECTION_TERMS = 'destination_commercial_terms';
const COLLECTION_HISTORY = 'destination_commercial_terms_history';
const LOCAL_STORAGE_TERMS_KEY = 'theunbound_destination_commercial_terms_v1';
const LOCAL_STORAGE_HISTORY_KEY = 'theunbound_destination_commercial_terms_history_v1';

export interface ResolvedTargetDescriptor {
  targetId: string;
  targetType: DestinationTermsTargetType;
  targetName: string;
  parentDestinationId?: string;
  parentDestinationName?: string;
}

export interface DestinationTermsReadinessResult {
  termsStatus: QuotationTermsStatus;
  canFinalise: boolean;
  canExportCompleteQuote: boolean;
  missingTargets: ResolvedTargetDescriptor[];
  resolvedEntries: QuotationDestinationTermsEntry[];
  snapshot: QuotationCommercialTermsSnapshot;
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore storage restriction
  }
  return null;
}

function computeFNV1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getCanonicalTermsDocId(targetId: string): string {
  const clean = (targetId || 'unknown').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  return `terms-${clean}`;
}

export function computeSectionsContentHash(sections: DestinationTermsSection[]): string {
  const active = [...(sections || [])]
    .filter((s) => s.isActive !== false && (s.heading?.trim() || s.htmlContent?.trim()))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  const canonicalString = active
    .map((s) => `${(s.heading || '').trim()}::${sanitizeRichText(s.htmlContent || '').trim()}`)
    .join('||');
  return computeFNV1aHash(canonicalString);
}

/**
 * Strips undefined values recursively for safe Firestore persistence.
 */
function cleanFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestorePayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = cleanFirestorePayload(v);
      }
    }
    return out as T;
  }
  return obj;
}

class DestinationCommercialTermsService {
  private static instance: DestinationCommercialTermsService;

  private memoryConfigs: Map<string, DestinationCommercialTermsConfig> = new Map();
  private memoryHistory: Map<string, DestinationTermsVersionRecord[]> = new Map();
  private inFlightTargetLoads: Map<string, Promise<DestinationCommercialTermsConfig | null>> = new Map();
  private listeners: Set<() => void> = new Set();
  private hydratedAllForAdmin = false;

  private constructor() {
    this.loadFromLocalCache();
  }

  public static getInstance(): DestinationCommercialTermsService {
    if (!DestinationCommercialTermsService.instance) {
      DestinationCommercialTermsService.instance = new DestinationCommercialTermsService();
    }
    return DestinationCommercialTermsService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    masterDataCache.bumpVersion(COLLECTION_TERMS);
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('[DestinationTermsService] Listener error:', e);
      }
    });
  }

  private loadFromLocalCache(): void {
    const storage = getSafeStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(LOCAL_STORAGE_TERMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DestinationCommercialTermsConfig[];
        if (Array.isArray(parsed)) {
          parsed.forEach((cfg) => {
            if (cfg?.targetId) {
              this.memoryConfigs.set(cfg.targetId, cfg);
            }
          });
        }
      }
      const rawHist = storage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (rawHist) {
        const parsedHist = JSON.parse(rawHist) as Record<string, DestinationTermsVersionRecord[]>;
        if (parsedHist && typeof parsedHist === 'object') {
          Object.entries(parsedHist).forEach(([k, v]) => {
            if (Array.isArray(v)) {
              this.memoryHistory.set(k, v);
            }
          });
        }
      }
    } catch {
      // ignore malformed local storage cache
    }
  }

  private saveToLocalCache(): void {
    const storage = getSafeStorage();
    if (!storage) return;
    try {
      const configsArr = Array.from(this.memoryConfigs.values());
      storage.setItem(LOCAL_STORAGE_TERMS_KEY, JSON.stringify(configsArr));

      const histObj: Record<string, DestinationTermsVersionRecord[]> = {};
      this.memoryHistory.forEach((v, k) => {
        histObj[k] = v;
      });
      storage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(histObj));
    } catch {
      // ignore quota limits
    }
  }

  /**
   * Resets internal state (primarily for deterministic automated testing isolation).
   */
  public clearCacheForTests(): void {
    this.memoryConfigs.clear();
    this.memoryHistory.clear();
    this.inFlightTargetLoads.clear();
    this.hydratedAllForAdmin = false;
    const storage = getSafeStorage();
    if (storage) {
      storage.removeItem(LOCAL_STORAGE_TERMS_KEY);
      storage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    }
    this.notifyListeners();
  }

  /**
   * Canonical Target Resolver — normalizes destination / region / hub IDs using MasterDataService
   * and AppDatabase so legacy slugs ("dest-japan") and canonical IDs ("DST-JPN") never diverge,
   * while distinct City Hubs ("hub-tokyo", "hub-kyoto", "hub-osaka") maintain separate identities.
   */
  public resolveCanonicalTarget(input: {
    targetId?: string;
    targetName?: string;
    targetType?: DestinationTermsTargetType;
    parentDestinationId?: string;
    parentDestinationName?: string;
  }): ResolvedTargetDescriptor {
    let destinations: any[] = [];
    let hubs: any[] = [];
    let regions: any[] = [];
    try {
      const db = AppDatabase.getInstance();
      destinations = db.getDestinations() || [];
      hubs = db.getCityHubs() || [];
      regions = db.getRegions() || [];
    } catch {
      // safe fallback during bootstrap
    }

    const masterService = MasterDataService.getInstance();
    let canonicalDests = destinations;
    let canonicalHubs = hubs;
    let canonicalRegions = regions;
    try {
      canonicalDests = masterService.getAllDestinations();
      canonicalHubs = masterService.getAllHubs();
      canonicalRegions = masterService.getAllDestinationRegions();
    } catch {
      // keep AppDatabase arrays if MasterDataService not yet hydrated
    }

    const resolveDestinationCanonicalId = (rawVal?: string): string => {
      const clean = (rawVal || '').trim().toLowerCase();
      if (!clean) return '';
      const mapped = CANONICAL_LEGACY_MAPPINGS[clean];
      if (mapped?.type === 'DESTINATION') return mapped.canonicalId;
      const found = canonicalDests.find(
        (d) =>
          (d.id || '').toLowerCase() === clean ||
          (d.slug || '').toLowerCase() === clean ||
          (d.name || '').toLowerCase() === clean ||
          ((d as any).legacyId || '').toLowerCase() === clean
      );
      return found ? found.id : (rawVal || '').trim();
    };

    const resolveHubCanonicalId = (rawVal?: string): string => {
      const clean = (rawVal || '').trim().toLowerCase();
      if (!clean) return '';
      const mapped = CANONICAL_LEGACY_MAPPINGS[clean];
      if (mapped?.type === 'HUB') return mapped.canonicalId;
      const found = canonicalHubs.find(
        (h) =>
          (h.id || '').toLowerCase() === clean ||
          (h.name || '').toLowerCase() === clean ||
          ((h as any).legacyId || '').toLowerCase() === clean
      );
      return found ? found.id : (rawVal || '').trim();
    };

    const rawId = (input.targetId || '').trim();
    const rawName = (input.targetName || '').trim();

    // 1. Check City Hubs first if targetType is HUB or ID/name matches a hub
    if (input.targetType !== 'DESTINATION' && input.targetType !== 'REGION') {
      const canonicalRawHubId = resolveHubCanonicalId(rawId);
      const matchedHub = canonicalHubs.find(
        (h) =>
          (rawId && (h.id === rawId || h.id === canonicalRawHubId)) ||
          (rawName && (h.name || '').toLowerCase() === rawName.toLowerCase())
      );
      if (matchedHub) {
        const canonicalParentId = resolveDestinationCanonicalId(
          matchedHub.destinationId || input.parentDestinationId || ''
        );
        const parentDest = canonicalDests.find(
          (d) => d.id === canonicalParentId || d.id === matchedHub.destinationId
        );
        return {
          targetId: matchedHub.id,
          targetType: 'HUB',
          targetName: matchedHub.name || rawName || matchedHub.id,
          parentDestinationId: canonicalParentId || matchedHub.destinationId || undefined,
          parentDestinationName: parentDest?.name || matchedHub.destinationName || input.parentDestinationName
        };
      }
      if (input.targetType === 'HUB') {
        const canonicalParent = input.parentDestinationId
          ? resolveDestinationCanonicalId(input.parentDestinationId)
          : undefined;
        return {
          targetId: canonicalRawHubId || rawId || `hub-${rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          targetType: 'HUB',
          targetName: rawName || rawId,
          parentDestinationId: canonicalParent || undefined,
          parentDestinationName: input.parentDestinationName
        };
      }
    }

    // 2. Check Regions if targetType is REGION or ID starts with region-
    if (input.targetType === 'REGION' || rawId.startsWith('region-')) {
      const matchedRegion = canonicalRegions.find(
        (r) =>
          (rawId && r.id === rawId) ||
          (rawName && (r.name || '').toLowerCase() === rawName.toLowerCase())
      );
      if (matchedRegion) {
        const canonicalParentId = resolveDestinationCanonicalId(matchedRegion.destinationId || '');
        const parentDest = canonicalDests.find(
          (d) => d.id === canonicalParentId || d.id === matchedRegion.destinationId
        );
        return {
          targetId: matchedRegion.id,
          targetType: 'REGION',
          targetName: matchedRegion.name || rawName || matchedRegion.id,
          parentDestinationId: canonicalParentId || matchedRegion.destinationId,
          parentDestinationName: parentDest?.name || matchedRegion.destinationName || input.parentDestinationName
        };
      }
    }

    // 3. Check Master Destinations
    const canonicalDestId = resolveDestinationCanonicalId(rawId || rawName);
    const matchedDest = canonicalDests.find(
      (d) =>
        d.id === canonicalDestId ||
        d.id === rawId ||
        d.slug?.toLowerCase() === rawId.toLowerCase() ||
        (rawName && d.name?.toLowerCase() === rawName.toLowerCase())
    );

    if (matchedDest) {
      return {
        targetId: resolveDestinationCanonicalId(matchedDest.id) || matchedDest.id,
        targetType: 'DESTINATION',
        targetName: matchedDest.name || rawName || matchedDest.id
      };
    }

    const fallbackId =
      canonicalDestId ||
      rawId ||
      `dest-${rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
    return {
      targetId: fallbackId,
      targetType: input.targetType || 'DESTINATION',
      targetName: rawName || rawId || fallbackId,
      parentDestinationId: input.parentDestinationId
        ? resolveDestinationCanonicalId(input.parentDestinationId)
        : undefined,
      parentDestinationName: input.parentDestinationName
    };
  }

  /**
   * Synchronous read from in-memory/local cache by canonical target ID.
   */
  public getCachedConfigByTargetId(targetId: string): DestinationCommercialTermsConfig | null {
    if (!targetId) return null;
    const direct = this.memoryConfigs.get(targetId);
    if (direct) return direct;
    const resolved = this.resolveCanonicalTarget({ targetId });
    return this.memoryConfigs.get(resolved.targetId) || null;
  }

  public getAllCachedConfigs(): DestinationCommercialTermsConfig[] {
    return Array.from(this.memoryConfigs.values());
  }

  /**
   * Admin CMS only: loads all destination commercial terms configs from Firestore.
   * Never invoked by B2B Quote Builder.
   */
  public async getAllConfigsForAdminAsync(forceRefresh = false): Promise<DestinationCommercialTermsConfig[]> {
    if (this.hydratedAllForAdmin && !forceRefresh && masterDataCache.isFresh(COLLECTION_TERMS)) {
      return this.getAllCachedConfigs();
    }
    try {
      if (firestore) {
        const snap = await getDocs(collection(firestore, COLLECTION_TERMS));
        snap.docs.forEach((d) => {
          const data = d.data() as DestinationCommercialTermsConfig;
          if (data?.targetId) {
            this.memoryConfigs.set(data.targetId, {
              ...data,
              id: data.id || d.id
            });
          }
        });
        this.hydratedAllForAdmin = true;
        masterDataCache.markHydrated(COLLECTION_TERMS);
        this.saveToLocalCache();
      }
    } catch (err) {
      console.warn('[DestinationTermsService] Admin fetch failed, using cached configs:', err);
    }
    return this.getAllCachedConfigs();
  }

  /**
   * Targeted B2B Quote Builder / Preview lookup:
   * Fetches ONLY the requested target IDs (plus any explicit parent IDs if needed) via single-doc / batched `in` queries.
   * Does NOT retrieve unrelated destinations.
   */
  public async loadPublishedTermsForTargetsAsync(
    targets: ResolvedTargetDescriptor[],
    forceRefresh = false
  ): Promise<DestinationCommercialTermsConfig[]> {
    if (!targets || targets.length === 0) return [];

    const canonicalTargets = targets.map((t) => this.resolveCanonicalTarget(t));
    const uniqueTargetIds = Array.from(
      new Set(
        canonicalTargets.flatMap((t) =>
          [t.targetId, t.parentDestinationId].filter((id): id is string => Boolean(id))
        )
      )
    );

    const missingOrStaleIds = uniqueTargetIds.filter(
      (id) => forceRefresh || !this.memoryConfigs.has(id)
    );

    if (missingOrStaleIds.length > 0 && firestore) {
      const batchPromises: Promise<void>[] = [];
      for (let i = 0; i < missingOrStaleIds.length; i += 10) {
        const chunk = missingOrStaleIds.slice(i, i + 10);
        const batchPromise = (async () => {
          try {
            const q = query(
              collection(firestore, COLLECTION_TERMS),
              where('targetId', 'in', chunk),
              where('status', '==', 'PUBLISHED'),
              where('isActive', '==', true)
            );
            const snap = await getDocs(q);
            snap.docs.forEach((docSnap) => {
              const data = docSnap.data() as DestinationCommercialTermsConfig;
              if (data?.targetId) {
                this.memoryConfigs.set(data.targetId, {
                  ...data,
                  id: data.id || docSnap.id
                });
              }
            });
          } catch {
            // Fallback to targeted doc reads if index not yet ready or offline
            await Promise.all(
              chunk.map(async (tid) => {
                const inflightKey = tid;
                if (this.inFlightTargetLoads.has(inflightKey)) {
                  await this.inFlightTargetLoads.get(inflightKey);
                  return;
                }
                const loader = (async (): Promise<DestinationCommercialTermsConfig | null> => {
                  try {
                    const docRef = doc(firestore, COLLECTION_TERMS, getCanonicalTermsDocId(tid));
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                      const data = docSnap.data() as DestinationCommercialTermsConfig;
                      if (data?.status === 'PUBLISHED' && data?.isActive === true) {
                        this.memoryConfigs.set(data.targetId || tid, {
                          ...data,
                          id: data.id || docSnap.id
                        });
                        return data;
                      }
                    }
                  } catch {
                    // Permission or non-existent doc: treat as unconfigured/missing
                  }
                  return null;
                })();
                this.inFlightTargetLoads.set(inflightKey, loader);
                try {
                  await loader;
                } finally {
                  this.inFlightTargetLoads.delete(inflightKey);
                }
              })
            );
          }
        })();
        batchPromises.push(batchPromise);
      }

      await Promise.all(batchPromises);
      this.saveToLocalCache();
    }

    return uniqueTargetIds
      .map((id) => this.memoryConfigs.get(id))
      .filter((cfg): cfg is DestinationCommercialTermsConfig => Boolean(cfg));
  }

  /**
   * Derives the ordered list of selected Destination / City Hub targets from a Quotation's
   * selected country destination, route hubs, and itinerary items.
   */
  public extractQuotationDestinationTargets(params: {
    destinationId?: string;
    destinationName?: string;
    routeHubs?: TripRouteHub[];
    items?: QuoteItem[];
  }): ResolvedTargetDescriptor[] {
    const seen = new Set<string>();
    const results: ResolvedTargetDescriptor[] = [];

    const addUniqueTarget = (desc: ResolvedTargetDescriptor) => {
      if (!desc.targetId || seen.has(desc.targetId)) return;
      seen.add(desc.targetId);
      results.push(desc);
    };

    const primaryDest =
      params.destinationId || params.destinationName
        ? this.resolveCanonicalTarget({
            targetId: params.destinationId,
            targetName: params.destinationName,
            targetType: 'DESTINATION'
          })
        : null;

    // 1. Ordered Itinerary Route Hubs (e.g. Tokyo -> Kyoto -> Osaka)
    if (Array.isArray(params.routeHubs) && params.routeHubs.length > 0) {
      params.routeHubs.forEach((hub) => {
        const hubDesc = this.resolveCanonicalTarget({
          targetId: hub.hubId || hub.hubName,
          targetName: hub.hubName || hub.destinationName,
          targetType: 'HUB',
          parentDestinationId: hub.destinationId || primaryDest?.targetId,
          parentDestinationName: hub.destinationName || primaryDest?.targetName
        });
        addUniqueTarget(hubDesc);
      });
    }

    // 2. Scan quote items for any additional hubs or multi-country destinations
    if (Array.isArray(params.items) && params.items.length > 0) {
      params.items.forEach((item) => {
        const prod: any = item.product || {};
        const itemHubId = item.hubId || prod.hubId;
        const itemCity = item.manualHotelDetails?.city || prod.city;
        const itemDestId = prod.destinationId;
        const itemDestName = prod.destinationName || prod.country;

        if (itemHubId || itemCity) {
          const itemHubDesc = this.resolveCanonicalTarget({
            targetId: itemHubId || itemCity,
            targetName: itemCity || itemHubId,
            targetType: 'HUB',
            parentDestinationId: itemDestId || primaryDest?.targetId,
            parentDestinationName: itemDestName || primaryDest?.targetName
          });
          // Only append if it resolved to a known hub or distinct city hub
          if (itemHubId || itemHubDesc.targetType === 'HUB') {
            addUniqueTarget(itemHubDesc);
          }
        } else if (itemDestId && (!primaryDest || this.resolveCanonicalTarget({ targetId: itemDestId, targetType: 'DESTINATION' }).targetId !== primaryDest.targetId)) {
          addUniqueTarget(
            this.resolveCanonicalTarget({
              targetId: itemDestId,
              targetName: itemDestName,
              targetType: 'DESTINATION'
            })
          );
        }
      });
    }

    // 3. Fallback to Primary Destination when no Route Hubs or item hubs exist
    if (results.length === 0 && primaryDest) {
      addUniqueTarget(primaryDest);
    }

    return results;
  }

  /**
   * Strict Per-Target Published Terms Resolution.
   * - Returns own published active config if present.
   * - Falls back to parent destination ONLY when `allowParentInheritance === true` is explicitly configured
   *   and parent has active published terms.
   * - NEVER falls back to sibling hubs or unrelated destinations.
   */
  public resolvePublishedConfigForTarget(target: ResolvedTargetDescriptor): {
    config: DestinationCommercialTermsConfig | null;
    inheritedFromParentId?: string;
    inheritedFromParentName?: string;
  } {
    const ownConfig = this.getCachedConfigByTargetId(target.targetId);
    if (ownConfig) {
      const activeSections = (ownConfig.sections || []).filter(
        (s) => s.isActive !== false && (s.heading?.trim() || s.htmlContent?.trim())
      );
      if (ownConfig.status === 'PUBLISHED' && ownConfig.isActive === true && activeSections.length > 0) {
        return { config: ownConfig };
      }

      // Explicit opt-in parent inheritance
      if (ownConfig.allowParentInheritance === true && (ownConfig.parentDestinationId || target.parentDestinationId)) {
        const parentId = ownConfig.parentDestinationId || target.parentDestinationId!;
        const parentConfig = this.getCachedConfigByTargetId(parentId);
        if (parentConfig && parentConfig.status === 'PUBLISHED' && parentConfig.isActive === true) {
          const parentActiveSections = (parentConfig.sections || []).filter(
            (s) => s.isActive !== false && (s.heading?.trim() || s.htmlContent?.trim())
          );
          if (parentActiveSections.length > 0) {
            return {
              config: parentConfig,
              inheritedFromParentId: parentConfig.targetId,
              inheritedFromParentName: parentConfig.targetName
            };
          }
        }
      }

      return { config: null };
    }

    // No config on targetId -> strictly missing (do NOT silently inherit parent unless explicit config allows it)
    return { config: null };
  }

  /**
   * Resolves all selected destinations/hubs for a quotation, consolidates ONLY genuinely identical
   * term configurations (never hiding destination-specific clauses), builds the QuotationCommercialTermsSnapshot,
   * and evaluates missing-terms validation & approval readiness.
   */
  public evaluateQuotationCommercialTerms(params: {
    quoteId?: string;
    quoteVersion?: number;
    destinationId?: string;
    destinationName?: string;
    routeHubs?: TripRouteHub[];
    items?: QuoteItem[];
    user?: Partial<User> | null;
    isFinalised?: boolean;
    termsExceptionApproval?: QuotationTermsExceptionApproval;
  }): DestinationTermsReadinessResult {
    const targets = this.extractQuotationDestinationTargets({
      destinationId: params.destinationId,
      destinationName: params.destinationName,
      routeHubs: params.routeHubs,
      items: params.items
    });

    const missingTargets: ResolvedTargetDescriptor[] = [];
    const rawResolved: Array<{
      target: ResolvedTargetDescriptor;
      config: DestinationCommercialTermsConfig;
      activeSections: DestinationTermsSection[];
      contentHash: string;
      inheritedFromParentId?: string;
      inheritedFromParentName?: string;
    }> = [];

    targets.forEach((target) => {
      const resolution = this.resolvePublishedConfigForTarget(target);
      if (!resolution.config) {
        missingTargets.push(target);
        return;
      }
      const activeSections = [...(resolution.config.sections || [])]
        .filter((s) => s.isActive !== false && (s.heading?.trim() || s.htmlContent?.trim()))
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

      if (activeSections.length === 0) {
        missingTargets.push(target);
        return;
      }

      const contentHash = resolution.config.contentHash || computeSectionsContentHash(activeSections);
      rawResolved.push({
        target,
        config: resolution.config,
        activeSections,
        contentHash,
        inheritedFromParentId: resolution.inheritedFromParentId,
        inheritedFromParentName: resolution.inheritedFromParentName
      });
    });

    // Safe Multi-Destination Consolidation:
    // Group only when consecutive or multiple destinations have identical active section hashes.
    const consolidatedEntries: QuotationDestinationTermsEntry[] = [];
    const hashToEntryIndex = new Map<string, number>();

    rawResolved.forEach((item) => {
      const existingIdx = hashToEntryIndex.get(item.contentHash);
      if (existingIdx !== undefined) {
        const entry = consolidatedEntries[existingIdx];
        entry.consolidatedTargetIds = [...(entry.consolidatedTargetIds || [entry.targetId]), item.target.targetId];
        entry.consolidatedTargetNames = [...(entry.consolidatedTargetNames || [entry.targetName]), item.target.targetName];
        // Update display heading of consolidated entry
        entry.targetName = entry.consolidatedTargetNames.join(' & ');
        return;
      }

      const htmlText = renderDestinationSectionsToHtml(item.activeSections);
      const plainText = renderDestinationSectionsToPlainText(item.activeSections);
      const whatsAppText = renderDestinationSectionsToWhatsApp(item.activeSections);

      const newEntry: QuotationDestinationTermsEntry = {
        targetId: item.target.targetId,
        targetType: item.target.targetType,
        targetName: item.target.targetName,
        configId: item.config.id,
        version: item.config.version || 1,
        inheritedFromParentId: item.inheritedFromParentId,
        inheritedFromParentName: item.inheritedFromParentName,
        consolidatedTargetIds: [item.target.targetId],
        consolidatedTargetNames: [item.target.targetName],
        contentHash: item.contentHash,
        sections: item.activeSections.map((s) => ({ ...s })),
        htmlText,
        plainText,
        whatsAppText
      };

      hashToEntryIndex.set(item.contentHash, consolidatedEntries.length);
      consolidatedEntries.push(newEntry);
    });

    // Check exception approval validity (must cover every currently missing target ID)
    const approval = params.termsExceptionApproval;
    const isExceptionApproved = Boolean(
      approval &&
      approval.approved &&
      approval.reason?.trim() &&
      missingTargets.every((mt) => approval.missingDestinationIds.includes(mt.targetId))
    );

    let termsStatus: QuotationTermsStatus = 'DRAFT_UNCHECKED';
    if (targets.length === 0) {
      termsStatus = 'DRAFT_UNCHECKED';
    } else if (missingTargets.length > 0) {
      termsStatus = isExceptionApproved ? 'TERMS_APPROVED' : 'TERMS_MISSING';
    } else if (consolidatedEntries.length > 0) {
      termsStatus = params.isFinalised ? 'QUOTATION_FINALISED' : 'TERMS_CONFIGURED';
    }

    const canFinalise =
      termsStatus === 'TERMS_CONFIGURED' ||
      termsStatus === 'TERMS_APPROVED' ||
      termsStatus === 'QUOTATION_FINALISED';

    // Build combined formatted outputs across all resolved destination groups
    const isMultiGroup = consolidatedEntries.length > 1;
    const combinedHtml = consolidatedEntries
      .map((entry) => {
        const groupHeader = isMultiGroup || consolidatedEntries.length === 1
          ? `<div style="margin: 8px 0 4px 0; padding: 4px 8px; background: #f8fafc; border-left: 3px solid #0f172a; font-size: 10.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">${entry.targetName} — Commercial Quotation Terms <span style="font-weight: 600; color: #64748b; text-transform: none;">(v${entry.version}${entry.inheritedFromParentName ? ` • Inherited from ${entry.inheritedFromParentName}` : ''})</span></div>`
          : '';
        return `<div style="margin-bottom: 10px;">${groupHeader}${entry.htmlText}</div>`;
      })
      .join('');

    const combinedPlainText = consolidatedEntries
      .map((entry) => {
        const header = `${entry.targetName.toUpperCase()} — COMMERCIAL QUOTATION TERMS (v${entry.version})`;
        return `${header}\n${entry.plainText}`;
      })
      .join('\n\n----------------------------------------\n\n');

    const combinedWhatsAppText = consolidatedEntries
      .map((entry) => {
        const header = `📍 *${entry.targetName.toUpperCase()} — COMMERCIAL QUOTATION TERMS (v${entry.version})*`;
        return `${header}\n\n${entry.whatsAppText}`;
      })
      .join('\n\n━━━━━━━━━━━━━━━━━━━━━\n\n');

    const snapshot: QuotationCommercialTermsSnapshot = {
      snapshotId: `terms-snap-${params.quoteId || 'draft'}-v${params.quoteVersion || 1}-${Date.now()}`,
      capturedAt: new Date().toISOString(),
      capturedBy: params.user?.name || params.user?.email || 'System',
      quoteVersion: params.quoteVersion || 1,
      destinationIds: targets.map((t) => t.targetId),
      destinationNames: targets.map((t) => t.targetName),
      entries: consolidatedEntries,
      missingDestinationIds: missingTargets.map((t) => t.targetId),
      missingDestinationNames: missingTargets.map((t) => t.targetName),
      termsStatus,
      termsExceptionApproval: isExceptionApproved ? approval : undefined,
      combinedHeading:
        consolidatedEntries.length === 1
          ? `${COMMERCIAL_QUOTATION_TERMS_HEADING} — ${consolidatedEntries[0].targetName}`
          : COMMERCIAL_QUOTATION_TERMS_HEADING,
      combinedHtml,
      combinedPlainText,
      combinedWhatsAppText
    };

    return {
      termsStatus,
      canFinalise,
      canExportCompleteQuote: canFinalise,
      missingTargets,
      resolvedEntries: consolidatedEntries,
      snapshot
    };
  }

  /**
   * Preserves frozen immutable snapshot on finalised/locked quotations regardless of later CMS updates.
   * For active Draft quotations, returns newly evaluated live readiness.
   */
  public resolveQuoteEffectiveSnapshot(
    quote: Partial<Quotation> & { destination?: string },
    user?: Partial<User> | null
  ): {
    isImmutableFrozen: boolean;
    readiness: DestinationTermsReadinessResult;
  } {
    const isFinalisedQuote = Boolean(
      quote.isLocked ||
      quote.termsStatus === 'QUOTATION_FINALISED' ||
      (quote.status as string) === 'ISSUED' ||
      quote.status === 'SENT' ||
      quote.status === 'APPROVED' ||
      quote.status === 'ACCEPTED' ||
      quote.status === 'CONVERTED'
    );

    if (isFinalisedQuote && quote.commercialTermsSnapshot && quote.commercialTermsSnapshot.entries.length > 0) {
      return {
        isImmutableFrozen: true,
        readiness: {
          termsStatus: 'QUOTATION_FINALISED',
          canFinalise: true,
          canExportCompleteQuote: true,
          missingTargets: [],
          resolvedEntries: quote.commercialTermsSnapshot.entries,
          snapshot: quote.commercialTermsSnapshot
        }
      };
    }

    const readiness = this.evaluateQuotationCommercialTerms({
      quoteId: quote.id,
      quoteVersion: quote.version || 1,
      destinationName: quote.destination,
      routeHubs: quote.routeHubs,
      items: quote.items,
      user,
      isFinalised: isFinalisedQuote,
      termsExceptionApproval: quote.termsExceptionApproval
    });

    return {
      isImmutableFrozen: false,
      readiness
    };
  }

  // ==========================================================================
  // ADMIN CMS MANAGEMENT OPERATIONS (Create, Draft, Edit, Copy, Publish, History)
  // ==========================================================================

  private assertAdminOrContentPermission(user?: Partial<User> | null): void {
    if (!user) return; // allow test/system headless calls unless role explicitly invalid
    const role = (user.role || '').toUpperCase();
    const isAllowedRole =
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'TEAM_MEMBER' ||
      role === 'DMC_STAFF';
    if (!isAllowedRole) {
      throw new Error('Unauthorized: Only Admin or authorized CMS Content Managers can modify Destination Commercial Terms.');
    }
    const cmsContentEnabled = user.permissions?.cmsContent?.enabled !== false;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && !cmsContentEnabled) {
      throw new Error('Unauthorized: Your account lacks CMS Content Management permission.');
    }
  }

  private normalizeSections(sections: DestinationTermsSection[]): DestinationTermsSection[] {
    const now = new Date().toISOString();
    return [...(sections || [])]
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((s, idx) => ({
        sectionId: s.sectionId || `sec-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
        heading: (s.heading || '').trim(),
        description: s.description ? s.description.trim() : undefined,
        htmlContent: sanitizeRichText(s.htmlContent || ''),
        displayOrder: idx + 1,
        isActive: s.isActive !== false,
        createdAt: s.createdAt || now,
        updatedAt: now
      }));
  }

  /**
   * Saves a draft OR publishes a new version for a single destination/region/hub independently.
   * When saving a Draft on an already-published config, `sections` remains the live published version
   * while `draftSections` holds the pending unpublished draft edits so B2B quotes never display unpublished drafts!
   */
  public async saveDestinationTermsAsync(params: {
    target: {
      targetId: string;
      targetName: string;
      targetType: DestinationTermsTargetType;
      parentDestinationId?: string;
      parentDestinationName?: string;
    };
    sections: DestinationTermsSection[];
    publish: boolean;
    isActive?: boolean;
    allowParentInheritance?: boolean;
    sourceTemplateType?: 'TEMPLATE_16' | 'COPIED' | 'SCRATCH';
    copiedFromTargetId?: string;
    copiedFromTargetName?: string;
    changeSummary?: string;
    user?: Partial<User> | null;
  }): Promise<DestinationCommercialTermsConfig> {
    this.assertAdminOrContentPermission(params.user);

    const canonical = this.resolveCanonicalTarget(params.target);
    const existing = this.memoryConfigs.get(canonical.targetId);
    const now = new Date().toISOString();
    const docId = existing?.id || getCanonicalTermsDocId(canonical.targetId);
    const actorName = params.user?.name || params.user?.email || 'Admin CMS';
    const actorRole = params.user?.role || 'ADMIN';
    const actorEmail = params.user?.email || 'admin@theunbound.com';

    const sanitizedSections = this.normalizeSections(params.sections);

    let nextConfig: DestinationCommercialTermsConfig;

    if (params.publish) {
      const nextVersion = (existing?.version || 0) + 1;
      const contentHash = computeSectionsContentHash(sanitizedSections);

      nextConfig = {
        id: docId,
        targetId: canonical.targetId,
        targetType: canonical.targetType,
        targetName: canonical.targetName,
        parentDestinationId: canonical.parentDestinationId,
        parentDestinationName: canonical.parentDestinationName,
        version: nextVersion,
        status: 'PUBLISHED',
        isActive: params.isActive !== false,
        allowParentInheritance: Boolean(params.allowParentInheritance),
        sections: sanitizedSections,
        draftSections: undefined,
        hasUnpublishedDraft: false,
        sourceTemplateType: params.sourceTemplateType || existing?.sourceTemplateType || 'TEMPLATE_16',
        copiedFromTargetId: params.copiedFromTargetId || existing?.copiedFromTargetId,
        copiedFromTargetName: params.copiedFromTargetName || existing?.copiedFromTargetName,
        contentHash,
        createdAt: existing?.createdAt || now,
        createdBy: existing?.createdBy || actorName,
        updatedAt: now,
        updatedBy: actorName,
        updatedByRole: actorRole,
        updatedByEmail: actorEmail,
        publishedAt: now,
        publishedBy: actorName
      };

      // Append immutable version history record
      const historyRecord: DestinationTermsVersionRecord = {
        id: `${docId}-v${nextVersion}-${Date.now()}`,
        termsConfigId: docId,
        targetId: canonical.targetId,
        targetName: canonical.targetName,
        targetType: canonical.targetType,
        version: nextVersion,
        status: 'PUBLISHED',
        allowParentInheritance: nextConfig.allowParentInheritance,
        sections: sanitizedSections.map((s) => ({ ...s })),
        changeSummary:
          params.changeSummary ||
          (nextVersion === 1
            ? `Initial Commercial Quotation Terms published for ${canonical.targetName}`
            : `Published v${nextVersion} for ${canonical.targetName}`),
        createdAt: now,
        createdBy: actorName,
        createdByEmail: actorEmail
      };

      const existingHist = this.memoryHistory.get(docId) || [];
      this.memoryHistory.set(docId, [historyRecord, ...existingHist]);

      if (firestore) {
        try {
          await setDoc(doc(firestore, COLLECTION_HISTORY, historyRecord.id), cleanFirestorePayload(historyRecord));
        } catch (err) {
          console.warn('[DestinationTermsService] Firestore history sync warning:', err);
        }
      }
    } else {
      // Save Draft without disturbing live published terms (if any exist)
      const isAlreadyPublished = existing?.status === 'PUBLISHED';
      const nextVersion = existing?.version || 1;
      nextConfig = {
        id: docId,
        targetId: canonical.targetId,
        targetType: canonical.targetType,
        targetName: canonical.targetName,
        parentDestinationId: canonical.parentDestinationId,
        parentDestinationName: canonical.parentDestinationName,
        version: nextVersion,
        status: isAlreadyPublished ? 'PUBLISHED' : 'DRAFT',
        isActive: isAlreadyPublished ? existing!.isActive : (params.isActive !== false),
        allowParentInheritance:
          params.allowParentInheritance !== undefined
            ? Boolean(params.allowParentInheritance)
            : Boolean(existing?.allowParentInheritance),
        sections: isAlreadyPublished ? existing!.sections : sanitizedSections,
        draftSections: isAlreadyPublished ? sanitizedSections : undefined,
        hasUnpublishedDraft: isAlreadyPublished ? true : false,
        sourceTemplateType: params.sourceTemplateType || existing?.sourceTemplateType || 'TEMPLATE_16',
        copiedFromTargetId: params.copiedFromTargetId || existing?.copiedFromTargetId,
        copiedFromTargetName: params.copiedFromTargetName || existing?.copiedFromTargetName,
        contentHash: existing?.contentHash || computeSectionsContentHash(sanitizedSections),
        createdAt: existing?.createdAt || now,
        createdBy: existing?.createdBy || actorName,
        updatedAt: now,
        updatedBy: actorName,
        updatedByRole: actorRole,
        updatedByEmail: actorEmail,
        publishedAt: existing?.publishedAt,
        publishedBy: existing?.publishedBy
      };
    }

    this.memoryConfigs.set(canonical.targetId, nextConfig);
    this.saveToLocalCache();
    this.notifyListeners();

    if (firestore) {
      try {
        await setDoc(doc(firestore, COLLECTION_TERMS, docId), cleanFirestorePayload(nextConfig));
      } catch (err) {
        console.warn('[DestinationTermsService] Firestore save sync warning:', err);
      }
    }

    try {
      const db = AppDatabase.getInstance();
      db.logAudit(
        { id: params.user?.id || 'admin', name: actorName, role: (actorRole as any) || 'ADMIN' },
        'SETTINGS_UPDATED',
        'Destination Commercial Terms',
        docId,
        `${params.publish ? 'Published' : 'Saved draft'} commercial quotation terms v${nextConfig.version} for ${canonical.targetName} (${canonical.targetId})`
      );
    } catch {
      // ignore if AppDatabase unavailable in isolated test
    }

    return nextConfig;
  }

  /**
   * Convenience initializer: creates an independent copy from the 16-section template,
   * from scratch, or copied cleanly from another destination (zero shared references).
   */
  public async initializeTermsForDestinationAsync(params: {
    target: {
      targetId: string;
      targetName: string;
      targetType: DestinationTermsTargetType;
      parentDestinationId?: string;
      parentDestinationName?: string;
    };
    mode: 'TEMPLATE_16' | 'COPY_FROM' | 'SCRATCH';
    sourceTargetId?: string;
    publishImmediately?: boolean;
    allowParentInheritance?: boolean;
    user?: Partial<User> | null;
  }): Promise<DestinationCommercialTermsConfig> {
    this.assertAdminOrContentPermission(params.user);
    const now = new Date().toISOString();
    let sections: DestinationTermsSection[] = [];
    let copiedFromTargetId: string | undefined;
    let copiedFromTargetName: string | undefined;

    if (params.mode === 'TEMPLATE_16') {
      sections = buildInitial16SectionsClone();
    } else if (params.mode === 'COPY_FROM' && params.sourceTargetId) {
      const sourceCanonical = this.resolveCanonicalTarget({ targetId: params.sourceTargetId });
      const sourceConfig =
        this.memoryConfigs.get(sourceCanonical.targetId) || this.memoryConfigs.get(params.sourceTargetId);
      if (!sourceConfig) {
        throw new Error(`Source destination "${params.sourceTargetId}" does not have configured terms to copy.`);
      }
      const sourceSections =
        sourceConfig.draftSections && sourceConfig.draftSections.length > 0
          ? sourceConfig.draftSections
          : sourceConfig.sections;
      sections = sourceSections.map((s, idx) => ({
        ...s,
        sectionId: `sec-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now
      }));
      copiedFromTargetId = sourceConfig.targetId;
      copiedFromTargetName = sourceConfig.targetName;
    } else {
      sections = [
        {
          sectionId: `sec-1-${Math.random().toString(36).slice(2, 6)}`,
          heading: '1. Commercial Quotation Terms',
          description: 'Custom destination booking condition',
          htmlContent: '<p>Enter destination-specific booking and payment conditions here.</p>',
          displayOrder: 1,
          isActive: true,
          createdAt: now,
          updatedAt: now
        }
      ];
    }

    return this.saveDestinationTermsAsync({
      target: params.target,
      sections,
      publish: Boolean(params.publishImmediately),
      isActive: true,
      allowParentInheritance: Boolean(params.allowParentInheritance),
      sourceTemplateType:
        params.mode === 'TEMPLATE_16' ? 'TEMPLATE_16' : params.mode === 'COPY_FROM' ? 'COPIED' : 'SCRATCH',
      copiedFromTargetId,
      copiedFromTargetName,
      changeSummary:
        params.mode === 'COPY_FROM'
          ? `Copied independent terms configuration from ${copiedFromTargetName}`
          : params.mode === 'TEMPLATE_16'
          ? 'Initialized from 16-section Commercial Quotation Terms template'
          : 'Created custom Commercial Quotation Terms from scratch',
      user: params.user
    });
  }

  public async getVersionHistoryAsync(targetId: string): Promise<DestinationTermsVersionRecord[]> {
    const canonical = this.resolveCanonicalTarget({ targetId });
    const docId = getCanonicalTermsDocId(canonical.targetId);

    if (firestore) {
      try {
        const q = query(
          collection(firestore, COLLECTION_HISTORY),
          where('termsConfigId', '==', docId),
          orderBy('version', 'desc'),
          limit(25)
        );
        const snap = await getDocs(q);
        const records = snap.docs.map((d) => d.data() as DestinationTermsVersionRecord);
        if (records.length > 0) {
          this.memoryHistory.set(docId, records);
          this.saveToLocalCache();
          return records;
        }
      } catch {
        // fallback to in-memory/local cache
      }
    }

    return [...(this.memoryHistory.get(docId) || [])].sort((a, b) => b.version - a.version);
  }

  public async deleteDestinationTermsConfigAsync(
    targetId: string,
    user?: Partial<User> | null
  ): Promise<void> {
    this.assertAdminOrContentPermission(user);
    const canonical = this.resolveCanonicalTarget({ targetId });
    const docId = getCanonicalTermsDocId(canonical.targetId);

    this.memoryConfigs.delete(canonical.targetId);
    this.saveToLocalCache();
    this.notifyListeners();

    if (firestore) {
      try {
        await deleteDoc(doc(firestore, COLLECTION_TERMS, docId));
      } catch (err) {
        console.warn('[DestinationTermsService] Firestore delete warning:', err);
      }
    }
  }

  /**
   * Notifies Administrators when a B2B Agent encounters a destination missing configured terms.
   */
  public async notifyAdminMissingTermsAsync(params: {
    quoteId: string;
    quoteNumber: string;
    missingTargets: ResolvedTargetDescriptor[];
    user?: Partial<User> | null;
  }): Promise<void> {
    const names = params.missingTargets.map((t) => `${t.targetName} (${t.targetId})`).join(', ');
    const now = new Date().toISOString();

    try {
      const db = AppDatabase.getInstance();
      db.logAudit(
        { id: params.user?.id || 'agent', name: params.user?.name || 'B2B Agent', role: (params.user?.role as any) || 'B2B_AGENT' },
        'SETTINGS_UPDATED',
        'Quotation Commercial Terms Alert',
        params.quoteId,
        `Quotation ${params.quoteNumber} requires Admin configuration of Commercial Quotation Terms for missing destination(s): ${names}`
      );

      if (firestore) {
        await setDoc(doc(firestore, 'admin_activities', `missing-terms-${params.quoteId}-${Date.now()}`), {
          type: 'MISSING_DESTINATION_TERMS',
          quoteId: params.quoteId,
          quoteNumber: params.quoteNumber,
          missingTargetIds: params.missingTargets.map((t) => t.targetId),
          missingTargetNames: params.missingTargets.map((t) => t.targetName),
          requestedBy: params.user?.name || params.user?.email || 'B2B Agent',
          requestedByEmail: params.user?.email || '',
          createdAt: now,
          status: 'PENDING_ADMIN_ACTION'
        });
      }
    } catch (err) {
      console.warn('[DestinationTermsService] Failed to record admin missing terms notification:', err);
    }
  }
}

export const destinationTermsService = DestinationCommercialTermsService.getInstance();
