import { AppDatabase } from './db';
import { MasterDataService } from './masterDataService';
import { Product, Hotel, CityHub, Destination, DestinationRegionItem, MasterRegion, ProductCategory } from '../types';

/**
 * Universal Filter Options for counting and inventory querying
 * Strictly follows the geographical hierarchy: Destination -> Region -> Hub -> Products
 */
export interface UniversalCountFilter {
  masterRegionId?: string;
  destinationId?: string;     // Accepts destination ID or slug
  regionId?: string;          // Accepts destination region ID or slug
  hubId?: string;             // Accepts city hub ID or slug
  category?: ProductCategory | string;
  searchQuery?: string;
  onlyPublished?: boolean;    // Defaults to true for public storefront queries, false for admin
}

export interface InventoryCountsBreakdown {
  totalProducts: number;
  tours: number;
  activities: number;
  transfers: number;
  rail: number;
  guides: number;
  packages: number;
  hotels: number;
  hubs: number;
  destinations: number;
  regions: number;
}

export class GlobalCountingEngine {
  private static instance: GlobalCountingEngine;
  private db: AppDatabase;

  private constructor() {
    this.db = AppDatabase.getInstance();
  }

  public static getInstance(): GlobalCountingEngine {
    if (!GlobalCountingEngine.instance) {
      GlobalCountingEngine.instance = new GlobalCountingEngine();
    }
    return GlobalCountingEngine.instance;
  }

  /**
   * Resolves a destination identifier (id, slug, or exact name) to the canonical Destination object
   */
  public resolveDestination(destinationIdOrSlug?: string): Destination | undefined {
    if (!destinationIdOrSlug || destinationIdOrSlug === 'all') return undefined;
    return MasterDataService.getInstance().getDestinationById(destinationIdOrSlug, true);
  }

  /**
   * Resolves a DestinationRegionItem identifier (id, slug, or exact name)
   */
  public resolveRegion(regionIdOrSlug?: string): DestinationRegionItem | undefined {
    if (!regionIdOrSlug || regionIdOrSlug === 'all') return undefined;
    return MasterDataService.getInstance().getDestinationRegionById(regionIdOrSlug, true);
  }

  /**
   * Resolves a MasterRegion identifier (id or slug)
   */
  public resolveMasterRegion(regionIdOrSlug?: string): MasterRegion | undefined {
    if (!regionIdOrSlug || regionIdOrSlug === 'all') return undefined;
    return MasterDataService.getInstance().getRegionById(regionIdOrSlug);
  }

  /**
   * Resolves a Hub identifier (id or slug or exact name)
   */
  public resolveHub(hubIdOrName?: string): CityHub | undefined {
    if (!hubIdOrName || hubIdOrName === 'all') return undefined;
    return MasterDataService.getInstance().getHubById(hubIdOrName, true);
  }

  /**
   * Matches whether a given Product belongs to the filter hierarchy:
   * Destination -> Region -> Hub -> Category -> Search
   * Strictly uses validated database ID relationships (never text guessing).
   */
  public matchesProductFilter(product: Product, filter: UniversalCountFilter = {}): boolean {
    if (!product || !product.id) return false;
    if ((product as any).status === 'DELETED') return false;

    const masterData = MasterDataService.getInstance();

    // Visibility / Published Rule
    const onlyPublished = filter.onlyPublished !== false;
    if (onlyPublished) {
      if ((product as any).isPublished === false) return false;
      if (product.status && product.status !== 'ACTIVE') return false;
    }

    // 1. Macro Master Region filter (if specified)
    if (filter.masterRegionId && filter.masterRegionId !== 'all') {
      const macroRegion = this.resolveMasterRegion(filter.masterRegionId);
      if (!macroRegion) return false;
      const pDest = masterData.getDestinationById(product.destinationId, true);
      if (!pDest || pDest.regionId !== macroRegion.id) return false;
    }

    // 2. Destination filter (strictly by destinationId relationship)
    if (filter.destinationId && filter.destinationId !== 'all') {
      const targetDest = this.resolveDestination(filter.destinationId);
      if (!targetDest) return false;
      const pDest = masterData.getDestinationById(product.destinationId, true);
      if (!pDest || pDest.id !== targetDest.id) return false;
    }

    // 3. Region filter (strictly by regionId / regionIds / associated hub's regionId)
    if (filter.regionId && filter.regionId !== 'all') {
      const targetRegion = this.resolveRegion(filter.regionId);
      if (!targetRegion) return false;
      const pDest = masterData.getDestinationById(product.destinationId, true);
      if (!pDest || pDest.id !== targetRegion.destinationId) return false;

      const directMatch =
        product.regionId === targetRegion.id ||
        (Array.isArray((product as any).regionIds) && (product as any).regionIds.includes(targetRegion.id));

      let multiHubRegionMatch = false;
      if (!directMatch && Array.isArray(product.hubIds) && product.hubIds.length > 1) {
        multiHubRegionMatch = product.hubIds.some(hid => {
          const h = masterData.getHubById(hid, true);
          return h && h.regionId === targetRegion.id && h.destinationId === targetRegion.destinationId;
        });
      }

      if (!directMatch && !multiHubRegionMatch) return false;
    }

    // 4. Hub filter (strictly by hubId or validated multi-hub hubIds array)
    if (filter.hubId && filter.hubId !== 'all') {
      const targetHub = this.resolveHub(filter.hubId);
      if (!targetHub) return false;
      const pDest = masterData.getDestinationById(product.destinationId, true);
      if (!pDest || pDest.id !== targetHub.destinationId) return false;

      const primaryResolved = product.hubId ? masterData.getHubById(product.hubId, true) : undefined;
      const matchesPrimary = primaryResolved?.id === targetHub.id;
      const matchesMultiHub =
        Array.isArray(product.hubIds) &&
        product.hubIds.length > 0 &&
        product.hubIds.some(hid => masterData.getHubById(hid, true)?.id === targetHub.id);

      if (!matchesPrimary && !matchesMultiHub) return false;
    }

    // 5. Category filter
    if (filter.category && filter.category !== 'All' && filter.category !== 'ALL') {
      const targetCat = filter.category.toUpperCase();
      const pCat = (product.category || '').toUpperCase();
      if (pCat !== targetCat && !pCat.includes(targetCat) && !targetCat.includes(pCat)) return false;
    }

    // 6. Search Query
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase().trim();
      const inTitle = (product.name || '').toLowerCase().includes(q);
      const inShortDesc = (product.shortDescription || '').toLowerCase().includes(q);
      const inLongDesc = (product.longDescription || '').toLowerCase().includes(q);
      const inCity = (product.city || '').toLowerCase().includes(q);
      const inSku = (product.sku || '').toLowerCase().includes(q);
      if (!inTitle && !inShortDesc && !inLongDesc && !inCity && !inSku) return false;
    }

    return true;
  }

  /**
   * Matches whether a given Hotel belongs to the filter hierarchy:
   * Destination -> Region -> Hub -> Search
   */
  public matchesHotelFilter(hotel: Hotel, filter: UniversalCountFilter = {}): boolean {
    if (!hotel || !hotel.id) return false;
    if ((hotel as any).status === 'DELETED') return false;

    const masterData = MasterDataService.getInstance();

    const onlyPublished = filter.onlyPublished !== false;
    if (onlyPublished) {
      if ((hotel as any).isPublished === false) return false;
      if ((hotel as any).status === 'ARCHIVED' || (hotel as any).status === 'DRAFT' || (hotel as any).status === 'INACTIVE') return false;
    }

    // 1. Macro Master Region
    if (filter.masterRegionId && filter.masterRegionId !== 'all') {
      const region = this.resolveMasterRegion(filter.masterRegionId);
      if (!region) return false;
      const dest = masterData.getDestinationById(hotel.destinationId, true);
      if (!dest || dest.regionId !== region.id) return false;
    }

    // 2. Destination filter
    if (filter.destinationId && filter.destinationId !== 'all') {
      const canonicalDest = this.resolveDestination(filter.destinationId);
      if (!canonicalDest) return false;
      const hDest = masterData.getDestinationById(hotel.destinationId, true);
      if (!hDest || hDest.id !== canonicalDest.id) return false;
    }

    // 3. Region filter
    if (filter.regionId && filter.regionId !== 'all') {
      const targetRegion = this.resolveRegion(filter.regionId);
      if (!targetRegion) return false;
      const hHub = masterData.getHubById(hotel.hubId || hotel.cityId, true);
      const hRegionId = (hotel as any).regionId || hHub?.regionId;
      if (hRegionId !== targetRegion.id) return false;
    }

    // 4. Hub filter
    if (filter.hubId && filter.hubId !== 'all') {
      const canonicalHub = this.resolveHub(filter.hubId);
      if (!canonicalHub) return false;
      const hHub = masterData.getHubById(hotel.hubId || hotel.cityId, true);
      if (!hHub || hHub.id !== canonicalHub.id) return false;
    }

    // 5. Search Query
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase().trim();
      const inName = (hotel.name || '').toLowerCase().includes(q);
      const inDesc = (hotel.description || '').toLowerCase().includes(q);
      const inCity = (hotel.cityName || hotel.area || '').toLowerCase().includes(q);
      if (!inName && !inDesc && !inCity) return false;
    }

    return true;
  }

  /**
   * Matches whether a CityHub belongs to the filter hierarchy (Destination -> Region -> Hub)
   */
  public matchesHubFilter(hub: CityHub, filter: UniversalCountFilter = {}): boolean {
    if (!hub || !hub.id) return false;
    if ((hub as any).status === 'DELETED') return false;

    const onlyPublished = filter.onlyPublished !== false;
    if (onlyPublished) {
      if (hub.status === 'ARCHIVED' || hub.status === 'INACTIVE' || hub.isActive === false) return false;
    }

    const masterData = MasterDataService.getInstance();

    if (filter.destinationId && filter.destinationId !== 'all') {
      const canonicalDest = this.resolveDestination(filter.destinationId);
      if (!canonicalDest) return false;
      const hubDest = masterData.getDestinationById(hub.destinationId, true);
      if (!hubDest || hubDest.id !== canonicalDest.id) return false;
    }

    if (filter.regionId && filter.regionId !== 'all') {
      const canonicalReg = this.resolveRegion(filter.regionId);
      if (!canonicalReg) return false;
      if (hub.regionId !== canonicalReg.id) return false;
    }

    if (filter.hubId && filter.hubId !== 'all') {
      const canonicalHub = this.resolveHub(filter.hubId);
      if (!canonicalHub || hub.id !== canonicalHub.id) return false;
    }

    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase().trim();
      const inName = (hub.name || '').toLowerCase().includes(q);
      const inDesc = (hub.description || '').toLowerCase().includes(q);
      if (!inName && !inDesc) return false;
    }

    return true;
  }

  // =========================================================================
  // CORE FILTERED DATA SET RETRIEVERS (De-duplicated by ID)
  // =========================================================================

  public getFilteredProducts(filter: UniversalCountFilter = {}): Product[] {
    const allProducts = this.db.getProducts();
    const map = new Map<string, Product>();
    for (const p of allProducts) {
      if (this.matchesProductFilter(p, filter)) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }

  public getFilteredHotels(filter: UniversalCountFilter = {}): Hotel[] {
    const allHotels = this.db.getHotels();
    const map = new Map<string, Hotel>();
    for (const h of allHotels) {
      if (this.matchesHotelFilter(h, filter)) {
        map.set(h.id, h);
      }
    }
    return Array.from(map.values());
  }

  public getFilteredHubs(filter: UniversalCountFilter = {}): CityHub[] {
    const allHubs = this.db.getCityHubs();
    const map = new Map<string, CityHub>();
    for (const h of allHubs) {
      if (this.matchesHubFilter(h, filter)) {
        map.set(h.id, h);
      }
    }
    return Array.from(map.values());
  }

  public getFilteredRegions(filter: UniversalCountFilter = {}): DestinationRegionItem[] {
    const allRegions = this.db.getRegions();
    const onlyPublished = filter.onlyPublished !== false;
    return allRegions.filter(r => {
      if (!r || !r.id || (r as any).status === 'DELETED') return false;
      if (onlyPublished && (r.status === 'INACTIVE' || r.isActive === false)) return false;
      if (filter.destinationId && filter.destinationId !== 'all') {
        const dest = this.resolveDestination(filter.destinationId);
        if (!dest || r.destinationId !== dest.id) return false;
      }
      if (filter.regionId && filter.regionId !== 'all') {
        const reg = this.resolveRegion(filter.regionId);
        if (!reg || r.id !== reg.id) return false;
      }
      return true;
    });
  }

  public getFilteredDestinations(filter: UniversalCountFilter = {}): Destination[] {
    const allDestinations = this.db.getDestinations();
    return allDestinations.filter(d => {
      if (!d || !d.id || (d as any).status === 'DELETED') return false;
      if (filter.masterRegionId && filter.masterRegionId !== 'all') {
        const reg = this.resolveMasterRegion(filter.masterRegionId);
        const destRegionId = d.regionId || (d as any).masterRegionId;
        if (reg && destRegionId !== reg.id) return false;
      }
      if (filter.destinationId && filter.destinationId !== 'all') {
        const dest = this.resolveDestination(filter.destinationId);
        if (!dest || d.id !== dest.id) return false;
      }
      if (filter.searchQuery && filter.searchQuery.trim()) {
        const q = filter.searchQuery.toLowerCase().trim();
        const inName = (d.name || '').toLowerCase().includes(q);
        const inDesc = (d.tagline || d.description || '').toLowerCase().includes(q);
        if (!inName && !inDesc) return false;
      }
      return true;
    });
  }

  // =========================================================================
  // GLOBAL METRIC & COUNT GETTERS (Guaranteed Universal Consistency)
  // =========================================================================

  public getProductCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredProducts(filter).length;
  }

  public getHotelCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredHotels(filter).length;
  }

  public getHubCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredHubs(filter).length;
  }

  public getDestinationCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredDestinations(filter).length;
  }

  public getRegionCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredRegions(filter).length;
  }

  public getTourCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredProducts({ ...filter, category: 'Tour' }).length;
  }

  public getActivityCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredProducts({ ...filter, category: 'Activity' }).length;
  }

  public getTransferCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredProducts({ ...filter, category: 'Transfer' }).length;
  }

  public getRailCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredProducts({ ...filter, category: 'Rail' }).length;
  }

  public getGuideCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredProducts({ ...filter, category: 'Guide' }).length;
  }

  public getPackageCount(filter: UniversalCountFilter = {}): number {
    return this.getFilteredProducts({ ...filter, category: 'Package' }).length;
  }

  /**
   * Generates a comprehensive, synchronized breakdown of all inventory counts
   * for a given destination, region, or hub.
   */
  public getCountsBreakdown(filter: UniversalCountFilter = {}): InventoryCountsBreakdown {
    const products = this.getFilteredProducts(filter);
    const hotels = this.getFilteredHotels(filter);
    const hubs = this.getFilteredHubs(filter);
    const destinations = this.getFilteredDestinations(filter);
    const regions = this.getFilteredRegions(filter).length;

    let tours = 0;
    let activities = 0;
    let transfers = 0;
    let rail = 0;
    let guides = 0;
    let packages = 0;

    for (const p of products) {
      const cat = (p.category || '').toUpperCase();
      if (cat === 'TOUR') tours++;
      else if (cat === 'ACTIVITY') activities++;
      else if (cat.includes('TRANSFER')) transfers++;
      else if (cat.includes('RAIL')) rail++;
      else if (cat === 'GUIDE') guides++;
      else if (cat === 'PACKAGE') packages++;
    }

    return {
      totalProducts: products.length,
      tours,
      activities,
      transfers,
      rail,
      guides,
      packages,
      hotels: hotels.length,
      hubs: hubs.length,
      destinations: destinations.length,
      regions
    };
  }

  /**
   * Recalculates and flushes all counts across the system
   */
  public recalculateAllCounts(): InventoryCountsBreakdown {
    return this.getCountsBreakdown({});
  }

  /**
   * Returns exact counts for a specific Destination Card or Destination Header
   */
  public getDestinationMetrics(destinationIdOrSlug: string) {
    const filter = { destinationId: destinationIdOrSlug };
    const breakdown = this.getCountsBreakdown(filter);
    return {
      regionsCount: breakdown.regions,
      hubsCount: breakdown.hubs,
      hotelsCount: breakdown.hotels,
      productsCount: breakdown.totalProducts,
      toursAndActivitiesCount: breakdown.tours + breakdown.activities,
      transfersCount: breakdown.transfers,
      railCount: breakdown.rail,
      packagesCount: breakdown.packages
    };
  }

  /**
   * Returns exact counts for a specific Region Card or Region Header
   */
  public getRegionMetrics(regionId: string) {
    const filter = { regionId };
    const breakdown = this.getCountsBreakdown(filter);
    return {
      hubsCount: breakdown.hubs,
      hotelsCount: breakdown.hotels,
      productsCount: breakdown.totalProducts,
      toursAndActivitiesCount: breakdown.tours + breakdown.activities,
      transfersCount: breakdown.transfers,
      railCount: breakdown.rail,
      packagesCount: breakdown.packages
    };
  }

  /**
   * Returns exact counts for a specific Hub Card or Hub Header
   */
  public getHubMetrics(hubId: string) {
    const filter = { hubId };
    const breakdown = this.getCountsBreakdown(filter);
    return {
      hotelsCount: breakdown.hotels,
      productsCount: breakdown.totalProducts,
      toursAndActivitiesCount: breakdown.tours + breakdown.activities,
      transfersCount: breakdown.transfers,
      railCount: breakdown.rail,
      toursCount: breakdown.tours,
      activitiesCount: breakdown.activities,
      packagesCount: breakdown.packages
    };
  }
}

// Convenient export of the engine singleton
export const countingEngine = GlobalCountingEngine.getInstance();
