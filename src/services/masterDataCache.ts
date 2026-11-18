/**
 * Versioned Master Data & Hydration TTL Cache
 * Prevents redundant Firestore collection scans and enables O(1) version checks
 * across AppDatabase getters, DestinationRelevanceService, and Pricing Engine.
 */

class MasterDataCacheService {
  private static instance: MasterDataCacheService;
  private versions: Map<string, number> = new Map();
  private hydratedAt: Map<string, number> = new Map();
  private derivedCache: Map<string, { version: number; tombstoneVersion: number; value: any }> = new Map();

  // Default 5-minute TTL for master reference data hydration checks
  public static readonly DEFAULT_TTL_MS = 5 * 60 * 1000;

  private constructor() {}

  public static getInstance(): MasterDataCacheService {
    if (!MasterDataCacheService.instance) {
      MasterDataCacheService.instance = new MasterDataCacheService();
    }
    return MasterDataCacheService.instance;
  }

  public getVersion(key: string): number {
    return this.versions.get(key) || 1;
  }

  public bumpVersion(key: string): number {
    const next = (this.versions.get(key) || 1) + 1;
    this.versions.set(key, next);
    this.derivedCache.delete(key);
    return next;
  }

  public bumpAll(): void {
    for (const k of Array.from(this.versions.keys())) {
      this.versions.set(k, (this.versions.get(k) || 1) + 1);
    }
    this.derivedCache.clear();
  }

  public markHydrated(collectionName: string): void {
    this.hydratedAt.set(collectionName, Date.now());
  }

  public isFresh(collectionName: string, ttlMs: number = MasterDataCacheService.DEFAULT_TTL_MS): boolean {
    const ts = this.hydratedAt.get(collectionName);
    if (!ts) return false;
    return Date.now() - ts < ttlMs;
  }

  public invalidateHydration(collectionName?: string): void {
    if (collectionName) {
      this.hydratedAt.delete(collectionName);
    } else {
      this.hydratedAt.clear();
    }
  }

  public getDerived<T>(key: string, expectedVersion: number, tombstoneVersion: number): T | undefined {
    const entry = this.derivedCache.get(key);
    if (!entry) return undefined;
    if (entry.version === expectedVersion && entry.tombstoneVersion === tombstoneVersion) {
      return entry.value as T;
    }
    return undefined;
  }

  public setDerived<T>(key: string, version: number, tombstoneVersion: number, value: T): T {
    this.derivedCache.set(key, { version, tombstoneVersion, value });
    return value;
  }

  public clearAllDerived(): void {
    this.derivedCache.clear();
  }

  public invalidateDerivedByPrefix(prefix: string): void {
    for (const k of Array.from(this.derivedCache.keys())) {
      if (k.startsWith(prefix)) {
        this.derivedCache.delete(k);
      }
    }
  }
}

export const masterDataCache = MasterDataCacheService.getInstance();
