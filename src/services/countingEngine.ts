import { AppDatabase } from './db';
import { Product, Hotel, CityHub, Destination, MasterRegion, Quotation, ProductCategory } from '../types';

/**
 * Universal Filter Options for counting and inventory querying
 */
export interface UniversalCountFilter {
  masterRegionId?: string;
  destinationId?: string;     // Accepts destination id or slug or exact name
  hubId?: string;             // Accepts city hub id or name
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
   * Resolves a destination identifier (slug, id, or case-insensitive name) to the canonical Destination object
   */
  public resolveDestination(destinationIdOrSlug?: string): Destination | undefined {
    if (!destinationIdOrSlug || destinationIdOrSlug === 'all') return undefined;
    const destinations = this.db.getDestinations();
    const query = (destinationIdOrSlug || '').toLowerCase().trim();
    return destinations.find(d => 
      (d.id || '').toLowerCase() === query || 
      (d.slug || '').toLowerCase() === query || 
      (d.name || '').toLowerCase() === query
    );
  }

  /**
   * Resolves a MasterRegion identifier (id or slug)
   */
  public resolveMasterRegion(regionIdOrSlug?: string): MasterRegion | undefined {
    if (!regionIdOrSlug || regionIdOrSlug === 'all') return undefined;
    const regions = this.db.getMasterRegions();
    const query = (regionIdOrSlug || '').toLowerCase().trim();
    return regions.find(r => 
      (r.id || '').toLowerCase() === query || 
      (r.slug || '').toLowerCase() === query || 
      (r.name || '').toLowerCase() === query
    );
  }

  /**
   * Resolves a Hub identifier (id or name or slug)
   */
  public resolveHub(hubIdOrName?: string): CityHub | undefined {
    if (!hubIdOrName || hubIdOrName === 'all') return undefined;
    const hubs = this.db.getCityHubs();
    const query = (hubIdOrName || '').toLowerCase().trim();
    return hubs.find(h => 
      (h.id || '').toLowerCase() === query || 
      (h.name || '').toLowerCase() === query ||
      (h.id || '').toLowerCase() === `hub-${query}` ||
      (h.name && query.includes(h.name.toLowerCase())) ||
      (h.name && h.name.toLowerCase().includes(query))
    );
  }

  /**
   * Matches whether a given Product belongs to the filter hierarchy (Region -> Destination -> Hub -> Category -> Search)
   */
  public matchesProductFilter(product: Product, filter: UniversalCountFilter = {}): boolean {
    if (!product || !product.id) return false;

    // Visibility / Published Rule
    const onlyPublished = filter.onlyPublished !== false;
    if (onlyPublished) {
      if ((product as any).isPublished === false) return false;
      if ((product as any).status === 'ARCHIVED' || (product as any).status === 'DRAFT') return false;
    }

    // 1. Master Region Hierarchy filter
    if (filter.masterRegionId && filter.masterRegionId !== 'all') {
      const region = this.resolveMasterRegion(filter.masterRegionId);
      if (region) {
        const dest = this.db.getDestinations().find(d => 
          (d.id && product.destinationId && d.id.toLowerCase() === product.destinationId.toLowerCase()) ||
          (d.slug && product.destinationId && d.slug.toLowerCase() === product.destinationId.toLowerCase()) ||
          (d.name && product.country && d.name.toLowerCase() === product.country.toLowerCase()) ||
          (d.name && product.destinationName && d.name.toLowerCase() === product.destinationName.toLowerCase())
        );
        const destRegionId = dest?.regionId || (dest as any)?.masterRegionId;
        if (!dest || destRegionId !== region.id) return false;
      }
    }

    // 2. Destination filter
    if (filter.destinationId && filter.destinationId !== 'all') {
      const canonicalDest = this.resolveDestination(filter.destinationId);
      const targetQuery = (canonicalDest ? canonicalDest.id : filter.destinationId || '').toLowerCase();
      const targetName = (canonicalDest?.name || filter.destinationId || '').toLowerCase();
      const targetSlug = (canonicalDest?.slug || filter.destinationId || '').toLowerCase();

      const pDestId = (product.destinationId || '').toLowerCase();
      const pDestSlug = ((product as any).destinationSlug || '').toLowerCase();
      const pDestName = (product.destinationName || '').toLowerCase();
      const pCountry = (product.country || '').toLowerCase();

      const matchesDest = pDestId === targetQuery || 
                          pDestId === targetSlug || 
                          pDestSlug === targetSlug ||
                          pDestSlug === targetQuery ||
                          pDestName === targetName ||
                          pCountry === targetName ||
                          (targetName && pDestId.includes(targetName)) ||
                          (targetName && pDestName.includes(targetName)) ||
                          (targetName && pCountry.includes(targetName)) ||
                          (targetQuery && pDestId.includes(targetQuery));
      if (!matchesDest) return false;
    }

    // 3. Hub / City filter
    if (filter.hubId && filter.hubId !== 'all') {
      const canonicalHub = this.resolveHub(filter.hubId);
      const targetHubId = (canonicalHub ? canonicalHub.id : filter.hubId || '').toLowerCase();
      const targetHubName = (canonicalHub?.name || filter.hubId || '').toLowerCase();

      const pHubId = ((product as any).hubId || '').toLowerCase();
      const pCity = (product.city || '').toLowerCase();

      const matchesHub = pHubId === targetHubId || 
                         pHubId === targetHubName ||
                         pCity === targetHubName || 
                         pCity === targetHubId ||
                         pCity.includes(targetHubName) || 
                         (targetHubName && targetHubName.includes(pCity));
      if (!matchesHub) return false;
    }

    // 4. Category filter
    if (filter.category && filter.category !== 'All' && filter.category !== 'ALL') {
      const targetCat = filter.category.toUpperCase();
      const pCat = (product.category || '').toUpperCase();
      if (pCat !== targetCat && !pCat.includes(targetCat) && !targetCat.includes(pCat)) return false;
    }

    // 5. Search Query
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
   * Matches whether a given Hotel belongs to the filter hierarchy (Region -> Destination -> Hub -> Search)
   */
  public matchesHotelFilter(hotel: Hotel, filter: UniversalCountFilter = {}): boolean {
    if (!hotel || !hotel.id) return false;

    const onlyPublished = filter.onlyPublished !== false;
    if (onlyPublished) {
      if ((hotel as any).isPublished === false) return false;
      if ((hotel as any).status === 'ARCHIVED' || (hotel as any).status === 'DRAFT') return false;
    }

    // 1. Master Region
    if (filter.masterRegionId && filter.masterRegionId !== 'all') {
      const region = this.resolveMasterRegion(filter.masterRegionId);
      if (region) {
        const dest = this.db.getDestinations().find(d => 
          (d.id && hotel.destinationId && d.id.toLowerCase() === hotel.destinationId.toLowerCase()) ||
          (d.slug && hotel.destinationId && d.slug.toLowerCase() === hotel.destinationId.toLowerCase()) ||
          (d.name && hotel.country && d.name.toLowerCase() === hotel.country.toLowerCase()) ||
          (d.name && hotel.destinationName && d.name.toLowerCase() === hotel.destinationName.toLowerCase())
        );
        const destRegionId = dest?.regionId || (dest as any)?.masterRegionId;
        if (!dest || destRegionId !== region.id) return false;
      }
    }

    // 2. Destination filter
    if (filter.destinationId && filter.destinationId !== 'all') {
      const canonicalDest = this.resolveDestination(filter.destinationId);
      const targetQuery = (canonicalDest ? canonicalDest.id : filter.destinationId || '').toLowerCase();
      const targetName = (canonicalDest?.name || filter.destinationId || '').toLowerCase();
      const targetSlug = (canonicalDest?.slug || filter.destinationId || '').toLowerCase();

      const hDestId = (hotel.destinationId || '').toLowerCase();
      const hCountry = (hotel.country || '').toLowerCase();
      const hDestName = (hotel.destinationName || '').toLowerCase();

      const matchesDest = hDestId === targetQuery || 
                          hDestId === targetSlug || 
                          hCountry === targetName ||
                          hDestName === targetName ||
                          (targetName && hDestId.includes(targetName)) ||
                          (targetName && hCountry.includes(targetName)) ||
                          (targetSlug && hDestId.includes(targetSlug));
      if (!matchesDest) return false;
    }

    // 3. Hub / City filter
    if (filter.hubId && filter.hubId !== 'all') {
      const canonicalHub = this.resolveHub(filter.hubId);
      const targetHubId = (canonicalHub ? canonicalHub.id : filter.hubId || '').toLowerCase();
      const targetHubName = (canonicalHub?.name || filter.hubId || '').toLowerCase();

      const hHubId = (hotel.hubId || hotel.cityId || '').toLowerCase();
      const hCity = (hotel.cityName || hotel.area || '').toLowerCase();

      const matchesHub = hHubId === targetHubId || 
                         hHubId === targetHubName ||
                         hCity === targetHubName || 
                         hCity === targetHubId ||
                         hCity.includes(targetHubName) || 
                         (targetHubName && targetHubName.includes(hCity));
      if (!matchesHub) return false;
    }

    // 4. Search Query
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
   * Matches whether a CityHub belongs to the filter hierarchy
   */
  public matchesHubFilter(hub: CityHub, filter: UniversalCountFilter = {}): boolean {
    if (!hub || !hub.id) return false;

    if (filter.destinationId && filter.destinationId !== 'all') {
      const canonicalDest = this.resolveDestination(filter.destinationId);
      const targetQuery = (canonicalDest ? canonicalDest.id : filter.destinationId || '').toLowerCase();
      const targetName = (canonicalDest?.name || filter.destinationId || '').toLowerCase();
      const targetSlug = (canonicalDest?.slug || filter.destinationId || '').toLowerCase();

      const hubDestId = (hub.destinationId || '').toLowerCase();
      const hubDestName = (hub.destinationName || '').toLowerCase();

      const matches = hubDestId === targetQuery || 
                      hubDestId === targetSlug || 
                      hubDestName === targetName ||
                      (targetName && hubDestId.includes(targetName)) ||
                      (targetName && hubDestName.includes(targetName)) ||
                      (targetSlug && hubDestId.includes(targetSlug));
      if (!matches) return false;
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
  // CORE FILTERED DATA SET RETRIEVERS (De-duplicated & deduplicated by ID)
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

  public getFilteredDestinations(filter: UniversalCountFilter = {}): Destination[] {
    const allDestinations = this.db.getDestinations();
    return allDestinations.filter(d => {
      if (filter.masterRegionId && filter.masterRegionId !== 'all') {
        const reg = this.resolveMasterRegion(filter.masterRegionId);
        const destRegionId = d.regionId || (d as any).masterRegionId;
        if (reg && destRegionId !== reg.id) return false;
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

  public getRegionCount(): number {
    return this.db.getMasterRegions().length;
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
   * for a given destination, hub, or master region.
   */
  public getCountsBreakdown(filter: UniversalCountFilter = {}): InventoryCountsBreakdown {
    const products = this.getFilteredProducts(filter);
    const hotels = this.getFilteredHotels(filter);
    const hubs = this.getFilteredHubs(filter);
    const destinations = this.getFilteredDestinations(filter);
    const regions = this.db.getMasterRegions().length;

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
      else if (cat === 'TRANSFER') transfers++;
      else if (cat === 'RAIL') rail++;
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
   * Returns exact counts for a specific Destination Card or Destination Header
   */
  public getDestinationMetrics(destinationIdOrSlug: string) {
    const filter = { destinationId: destinationIdOrSlug };
    const breakdown = this.getCountsBreakdown(filter);
    return {
      hubsCount: breakdown.hubs,
      hotelsCount: breakdown.hotels,
      productsCount: breakdown.totalProducts,
      toursAndActivitiesCount: breakdown.tours + breakdown.activities,
      transfersCount: breakdown.transfers,
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
      toursCount: breakdown.tours,
      activitiesCount: breakdown.activities,
      packagesCount: breakdown.packages
    };
  }
}

// Convenient export of the engine singleton
export const countingEngine = GlobalCountingEngine.getInstance();
