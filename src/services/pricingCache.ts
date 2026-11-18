import { SurchargeMaster } from '../types';
import { performanceMonitor } from './performanceMonitor';

/**
 * Deterministic Bounded LRU Cache for Quote Breakdowns & Pre-Indexed Surcharge Lookups.
 * Guarantees exact numerical parity with uncached calculations by keying on all
 * commercial parameters, surcharge catalog version, and FX rate timestamp.
 */

const MAX_BREAKDOWN_CACHE_ENTRIES = 250;

class PricingCacheService {
  private static instance: PricingCacheService;
  private breakdownCache: Map<string, any> = new Map();
  private surchargeCatalogVersion: number = 1;
  private fxCatalogVersion: number = 1;

  // Pre-indexed surcharge buckets by catalog version & array identity
  private indexedSurchargesVersion: number = -1;
  private indexedArrayRef: SurchargeMaster[] | null = null;
  private indexedArrayLength: number = -1;
  private productLinkedIndex: Map<string, SurchargeMaster[]> = new Map();
  private broadRuleSurcharges: SurchargeMaster[] = [];

  private constructor() {}

  public static getInstance(): PricingCacheService {
    if (!PricingCacheService.instance) {
      PricingCacheService.instance = new PricingCacheService();
    }
    return PricingCacheService.instance;
  }

  public getSurchargeCatalogVersion(): number {
    return this.surchargeCatalogVersion;
  }

  public bumpSurchargeCatalogVersion(): void {
    this.surchargeCatalogVersion++;
    this.indexedSurchargesVersion = -1;
    this.indexedArrayRef = null;
    this.indexedArrayLength = -1;
    this.productLinkedIndex.clear();
    this.broadRuleSurcharges = [];
    this.breakdownCache.clear();
  }

  public getFxCatalogVersion(): number {
    return this.fxCatalogVersion;
  }

  public bumpFxCatalogVersion(): void {
    this.fxCatalogVersion++;
    this.breakdownCache.clear();
  }

  public clearAll(): void {
    this.breakdownCache.clear();
    this.indexedSurchargesVersion = -1;
    this.indexedArrayRef = null;
    this.indexedArrayLength = -1;
    this.productLinkedIndex.clear();
    this.broadRuleSurcharges = [];
  }

  public getBreakdown<T>(key: string): T | undefined {
    const val = this.breakdownCache.get(key);
    if (val !== undefined) {
      // Refresh LRU position
      this.breakdownCache.delete(key);
      this.breakdownCache.set(key, val);
      performanceMonitor.recordCacheHit('quoteBreakdown');
      return val as T;
    }
    performanceMonitor.recordCacheMiss('quoteBreakdown');
    return undefined;
  }

  public setBreakdown<T>(key: string, value: T): T {
    if (this.breakdownCache.size >= MAX_BREAKDOWN_CACHE_ENTRIES) {
      const oldestKey = this.breakdownCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.breakdownCache.delete(oldestKey);
        performanceMonitor.recordCacheEviction('quoteBreakdown');
      }
    }
    this.breakdownCache.set(key, value);
    return value;
  }

  /**
   * Builds/returns indexed surcharge candidates for a product (direct linkedProductIds
   * plus category/destination-level centralized rules), eliminating full-table linear
   * scans across all surcharges per quote item.
   */
  public getCandidateSurchargesForProduct(
    productId: string,
    allCentralizedSurcharges: SurchargeMaster[],
    catalogVersionHint?: number,
    strictLinkedOnly: boolean = false
  ): SurchargeMaster[] {
    if (!Array.isArray(allCentralizedSurcharges) || allCentralizedSurcharges.length === 0) {
      return [];
    }

    const activeVersion = catalogVersionHint ?? this.surchargeCatalogVersion;
    if (
      this.indexedSurchargesVersion !== activeVersion ||
      this.indexedArrayRef !== allCentralizedSurcharges ||
      this.indexedArrayLength !== allCentralizedSurcharges.length
    ) {
      this.rebuildSurchargeIndex(allCentralizedSurcharges, activeVersion);
    }

    const direct = productId ? this.productLinkedIndex.get(productId) : undefined;
    if (strictLinkedOnly && this.broadRuleSurcharges.length === 0) {
      return direct || [];
    }

    if (!direct || direct.length === 0) {
      return this.broadRuleSurcharges;
    }
    if (this.broadRuleSurcharges.length === 0) {
      return direct;
    }
    const seen = new Set<string>();
    const combined: SurchargeMaster[] = [];
    for (const s of direct) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        combined.push(s);
      }
    }
    for (const s of this.broadRuleSurcharges) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        combined.push(s);
      }
    }
    return combined;
  }

  private rebuildSurchargeIndex(all: SurchargeMaster[], version: number): void {
    this.productLinkedIndex.clear();
    this.broadRuleSurcharges = [];

    for (const s of all) {
      if (!s || !s.id || s.isDeleted) continue;
      if (s.status !== 'ACTIVE' || s.isActive === false) {
        continue;
      }
      const linked = Array.isArray(s.linkedProductIds) ? s.linkedProductIds.filter(Boolean) : [];
      const hasLinkedIds = linked.length > 0;
      const hasCategoryOrDestRule =
        s.applyToAllCategoryProducts === true ||
        (!hasLinkedIds &&
          ((Array.isArray(s.applicableCategories) && s.applicableCategories.length > 0) ||
            (Array.isArray(s.applicableDestinations) && s.applicableDestinations.length > 0) ||
            (Array.isArray(s.applicableDestinationIds) && s.applicableDestinationIds.length > 0) ||
            Boolean(s.destinationId || s.destinationName || s.hubId || s.regionId)));

      if (hasLinkedIds) {
        for (const pid of linked) {
          if (!pid) continue;
          let bucket = this.productLinkedIndex.get(pid);
          if (!bucket) {
            bucket = [];
            this.productLinkedIndex.set(pid, bucket);
          }
          bucket.push(s);
        }
      }

      if (hasCategoryOrDestRule || !hasLinkedIds) {
        this.broadRuleSurcharges.push(s);
      }
    }

    this.indexedSurchargesVersion = version;
    this.indexedArrayRef = all;
    this.indexedArrayLength = all.length;
  }
}

export const pricingCache = PricingCacheService.getInstance();
