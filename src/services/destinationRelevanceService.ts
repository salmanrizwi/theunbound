import { 
  Destination, 
  CityHub, 
  Hotel, 
  HotelRoomType, 
  Product, 
  TransferRoute, 
  VisaProduct, 
  B2BPackage, 
  QuoteItem, 
  TripRouteHub 
} from '../types';
import { AppDatabase } from './db';
import { masterDataCache } from './masterDataCache';
import { performanceMonitor } from './performanceMonitor';
import {
  buildDestinationVisibilityIndex,
  resolveDestinationIdToken,
  isCityHubActiveForB2B,
  isHotelActiveForB2B,
  isProductActiveForB2B,
  isTransferRouteActiveForB2B,
  isVisaOrAncillaryActiveForB2B,
  isPackageActiveForB2B
} from './destinationVisibility';

/**
 * Normalizes a destination identifier (id, slug, or name) for canonical matching.
 */
export function normalizeDestinationToken(val?: unknown): string {
  if (!val || typeof val !== 'string') return '';
  return val
    .toLowerCase()
    .trim()
    .replace(/^dest-/, '')
    .replace(/[-_/\s]+/g, ' ')
    .trim();
}

/**
 * Checks if an item's destination fields match a requested destination.
 */
export function matchesDestination(
  destCriteria: string | undefined,
  itemDestId?: string,
  itemDestName?: string,
  itemCountry?: string
): boolean {
  if (!destCriteria) return false;
  const token = normalizeDestinationToken(destCriteria);
  if (!token) return false;

  const idToken = normalizeDestinationToken(itemDestId);
  const nameToken = normalizeDestinationToken(itemDestName);
  const countryToken = normalizeDestinationToken(itemCountry);

  // Exact token match
  if (idToken === token || nameToken === token || countryToken === token) {
    return true;
  }

  // Alias mappings
  const aliases: Record<string, string[]> = {
    'uae': ['dubai', 'abu dhabi', 'united arab emirates'],
    'dubai': ['uae', 'united arab emirates'],
    'united arab emirates': ['uae', 'dubai'],
    'uk': ['united kingdom', 'great britain', 'england', 'britain', 'london'],
    'united kingdom': ['uk', 'england', 'britain'],
    'bali': ['indonesia'],
    'indonesia': ['bali'],
    'europe': ['schengen', 'france', 'paris', 'italy', 'spain', 'switzerland']
  };

  const matchedAliases = aliases[token] || [];
  for (const alias of matchedAliases) {
    if (idToken.includes(alias) || nameToken.includes(alias) || countryToken.includes(alias)) {
      return true;
    }
  }

  // Token inclusion (e.g. 'japan' in 'dest-japan' or 'Japan')
  if (idToken && (idToken.includes(token) || token.includes(idToken))) return true;
  if (nameToken && (nameToken.includes(token) || token.includes(nameToken))) return true;
  if (countryToken && (countryToken.includes(token) || token.includes(countryToken))) return true;

  return false;
}

/**
 * Checks if a hotel or product belongs to a specific Hub or City.
 */
export function matchesHub(
  hubCriteria: unknown,
  itemHubId?: unknown,
  itemCity?: unknown,
  itemCityId?: unknown,
  itemCityName?: unknown
): boolean {
  if (!hubCriteria || typeof hubCriteria !== 'string') return false;
  const target = hubCriteria.toLowerCase().replace(/^hub-/, '').trim();
  if (!target) return false;

  const hubId = typeof itemHubId === 'string' ? itemHubId.toLowerCase().replace(/^hub-/, '').trim() : '';
  const city = typeof itemCity === 'string' ? itemCity.toLowerCase().trim() : '';
  const cityId = typeof itemCityId === 'string' ? itemCityId.toLowerCase().trim() : '';
  const cityName = typeof itemCityName === 'string' ? itemCityName.toLowerCase().trim() : '';

  if (hubId && (hubId === target || hubId.includes(target) || target.includes(hubId))) {
    return true;
  }
  if (city && (city === target || city.includes(target) || target.includes(city))) {
    return true;
  }
  if (cityId && (cityId === target || cityId.includes(target) || target.includes(cityId))) {
    return true;
  }
  if (cityName && (cityName === target || cityName.includes(target) || target.includes(cityName))) {
    return true;
  }

  return false;
}

/**
 * CENTRALIZED RELEVANCE ENGINE
 * Authoritative single source of truth for destination-aware inventory filtering.
 * Enforced uniformly across the B2B Quote Builder, Step-by-Step Wizard, and AI Planner.
 */
export class DestinationRelevanceService {
  private static instance: DestinationRelevanceService;
  private db: AppDatabase;

  private constructor() {
    this.db = AppDatabase.getInstance();
  }

  public static getInstance(): DestinationRelevanceService {
    if (!DestinationRelevanceService.instance) {
      DestinationRelevanceService.instance = new DestinationRelevanceService();
    }
    return DestinationRelevanceService.instance;
  }

  private isTargetDestinationActive(destinationIdOrSlug: string): boolean {
    if (!destinationIdOrSlug) return false;
    const deletedSet = this.db.getDeletedEntityIds();
    const index = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      this.db.getCityHubs(),
      deletedSet
    );
    const resolvedId = resolveDestinationIdToken(destinationIdOrSlug, index);
    return Boolean(resolvedId && index.activeDestinationIds.has(resolvedId));
  }

  /**
   * LEVEL 2: Hubs / Cities strictly belonging to the destination.
   * Never returns hubs from non-active destinations or other destinations.
   */
  public getRelevantHubs(destinationIdOrSlug: string, sourceHubs?: CityHub[]): CityHub[] {
    if (!destinationIdOrSlug) return [];
    const deletedSet = this.db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      sourceHubs || this.db.getCityHubs(),
      deletedSet
    );
    const targetDestId = resolveDestinationIdToken(destinationIdOrSlug, visIndex);
    if (!targetDestId || !visIndex.activeDestinationIds.has(targetDestId)) {
      return [];
    }

    if (!sourceHubs) {
      const destVer = masterDataCache.getVersion('destinations');
      const hubsVer = masterDataCache.getVersion('city_hubs');
      const combinedVer = hubsVer * 100003 + destVer;
      const tombVer = masterDataCache.getVersion('inventory_tombstones');
      const cacheKey = `rel_hubs:${normalizeDestinationToken(destinationIdOrSlug)}`;
      const cached = masterDataCache.getDerived<CityHub[]>(cacheKey, combinedVer, tombVer);
      if (cached) {
        performanceMonitor.recordCacheHit('relevanceHubs');
        return [...cached];
      }
      performanceMonitor.recordCacheMiss('relevanceHubs');
      const allHubs = this.db.getCityHubs();
      const result = allHubs.filter(h => {
        if (!isCityHubActiveForB2B(h, visIndex, deletedSet)) return false;
        return matchesDestination(destinationIdOrSlug, h.destinationId, h.destinationName);
      });
      masterDataCache.setDerived(cacheKey, combinedVer, tombVer, result);
      return [...result];
    }

    return sourceHubs.filter(h => {
      if (!isCityHubActiveForB2B(h, visIndex, deletedSet)) return false;
      return matchesDestination(destinationIdOrSlug, h.destinationId, h.destinationName);
    });
  }

  /**
   * Resolves a CityHub record from Master Architecture by ID, slug, or name within a destination.
   */
  public resolveHubRecord(destinationIdOrSlug: string, hubIdOrName?: string, sourceHubs?: CityHub[]): CityHub | undefined {
    if (!hubIdOrName || typeof hubIdOrName !== 'string' || !hubIdOrName.trim()) return undefined;
    const deletedSet = this.db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      sourceHubs || this.db.getCityHubs(),
      deletedSet
    );
    const relevantHubs = destinationIdOrSlug
      ? this.getRelevantHubs(destinationIdOrSlug, sourceHubs)
      : (sourceHubs || this.db.getCityHubs()).filter(h => isCityHubActiveForB2B(h, visIndex, deletedSet));

    const clean = hubIdOrName.trim().toLowerCase();
    return relevantHubs.find(h =>
      (h.id && h.id.toLowerCase() === clean) ||
      (h.slug && h.slug.toLowerCase() === clean) ||
      (h.name && h.name.toLowerCase() === clean) ||
      ((h as any).hubName && (h as any).hubName.toLowerCase() === clean) ||
      matchesHub(hubIdOrName, h.id, h.name, h.slug, (h as any).hubName)
    );
  }

  /**
   * LEVEL 3: Hotels strictly belonging to an ACTIVE destination, and optionally narrowed to a hub.
   * When hubIdOrName is provided, only returns hotels in that hub.
   * If none exist or destination is non-active, returns [].
   */
  public getRelevantHotels(
    destinationIdOrSlug: string, 
    hubIdOrName?: string, 
    sourceHotels?: Hotel[]
  ): Hotel[] {
    if (!destinationIdOrSlug) return [];
    const deletedSet = this.db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      this.db.getCityHubs(),
      deletedSet
    );
    const targetDestId = resolveDestinationIdToken(destinationIdOrSlug, visIndex);
    if (!targetDestId || !visIndex.activeDestinationIds.has(targetDestId)) {
      return [];
    }

    if (!sourceHotels) {
      const destVer = masterDataCache.getVersion('destinations');
      const hotelsVer = masterDataCache.getVersion('hotels');
      const hubsVer = masterDataCache.getVersion('city_hubs');
      const tombVer = masterDataCache.getVersion('inventory_tombstones');
      const combinedVer = hotelsVer * 100003 + hubsVer * 1009 + destVer;
      const destToken = normalizeDestinationToken(destinationIdOrSlug);
      const hubToken = (hubIdOrName || '').toLowerCase().trim();
      const cacheKey = `rel_hotels:${destToken}:${hubToken}`;
      const cached = masterDataCache.getDerived<Hotel[]>(cacheKey, combinedVer, tombVer);
      if (cached) {
        performanceMonitor.recordCacheHit('relevanceHotels');
        return [...cached];
      }
      performanceMonitor.recordCacheMiss('relevanceHotels');

      // First resolve/cache destination-level hotels
      const destCacheKey = `rel_hotels_dest:${destToken}`;
      const destCombinedVer = hotelsVer * 100003 + destVer;
      let destHotels = masterDataCache.getDerived<Hotel[]>(destCacheKey, destCombinedVer, tombVer);
      if (!destHotels) {
        const allHotels = this.db.getHotels().filter(h => isHotelActiveForB2B(h, visIndex, deletedSet));
        destHotels = allHotels.filter(h =>
          matchesDestination(destinationIdOrSlug, h.destinationId, h.destinationName, h.country)
        );
        masterDataCache.setDerived(destCacheKey, destCombinedVer, tombVer, destHotels);
      }

      if (hubIdOrName) {
        const resolvedHub = this.resolveHubRecord(destinationIdOrSlug, hubIdOrName);
        const criteriaTokens = Array.from(new Set(
          [hubIdOrName, resolvedHub?.id, resolvedHub?.name, (resolvedHub as any)?.hubName, resolvedHub?.slug].filter(Boolean) as string[]
        ));
        const filtered = destHotels.filter(h =>
          criteriaTokens.some(token => matchesHub(token, h.hubId, h.city, h.cityId, h.cityName))
        );
        masterDataCache.setDerived(cacheKey, combinedVer, tombVer, filtered);
        return [...filtered];
      }

      masterDataCache.setDerived(cacheKey, combinedVer, tombVer, destHotels);
      return [...destHotels];
    }

    const allHotels = sourceHotels.filter(
      h => isHotelActiveForB2B(h, visIndex, deletedSet)
    );

    const destHotels = allHotels.filter(h => 
      matchesDestination(destinationIdOrSlug, h.destinationId, h.destinationName, h.country)
    );

    if (hubIdOrName) {
      const resolvedHub = this.resolveHubRecord(destinationIdOrSlug, hubIdOrName);
      const criteriaTokens = Array.from(new Set(
        [hubIdOrName, resolvedHub?.id, resolvedHub?.name, (resolvedHub as any)?.hubName, resolvedHub?.slug].filter(Boolean) as string[]
      ));
      return destHotels.filter(h => 
        criteriaTokens.some(token => matchesHub(token, h.hubId, h.city, h.cityId, h.cityName))
      );
    }

    return destHotels;
  }

  /**
   * LEVEL 4: Room types strictly configured for a specific hotel.
   */
  public getRelevantRooms(hotel: Hotel | null | undefined): HotelRoomType[] {
    if (!hotel || !hotel.roomTypes) return [];
    return hotel.roomTypes;
  }

  /**
   * LEVEL 4: Meal plans strictly configured in rates for a hotel or specific room.
   */
  public getRelevantMealPlans(hotel: Hotel | null | undefined, roomTypeId?: string): string[] {
    if (!hotel || !hotel.roomTypes || hotel.roomTypes.length === 0) {
      return ['Room Only (EP)'];
    }

    const targetRooms = roomTypeId 
      ? hotel.roomTypes.filter(r => r.id === roomTypeId)
      : hotel.roomTypes;

    const mealPlans = new Set<string>();
    for (const room of targetRooms) {
      if (room.rates && room.rates.length > 0) {
        for (const rate of room.rates) {
          if (rate.mealPlanName) mealPlans.add(rate.mealPlanName);
          else if (rate.mealPlan) mealPlans.add(rate.mealPlan);
        }
      }
    }

    if (mealPlans.size > 0) {
      return Array.from(mealPlans);
    }

    return ['Room Only (EP)', 'Bed & Breakfast (BB)', 'Half Board (HB)'];
  }

  /**
   * LEVEL 3: Activities & Products strictly belonging to the destination and resolved Hub.
   * Categorized into hub-specific activities vs destination-wide services (Rail passes, eSIM, Insurance).
   * Strictly resolves Hub recommendations from Master Architecture (CityHub -> Product) without generic Destination fallbacks.
   */
  public getRelevantProducts(
    destinationIdOrSlug: string,
    hubIdOrName?: string,
    sourceProducts?: Product[]
  ): {
    hubActivities: Product[];
    destinationWideProducts: Product[];
    allDestinationProducts: Product[];
  } {
    if (!destinationIdOrSlug) {
      return { hubActivities: [], destinationWideProducts: [], allDestinationProducts: [] };
    }

    const deletedSet = this.db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      this.db.getCityHubs(),
      deletedSet
    );
    const targetDestId = resolveDestinationIdToken(destinationIdOrSlug, visIndex);
    if (!targetDestId || !visIndex.activeDestinationIds.has(targetDestId)) {
      return { hubActivities: [], destinationWideProducts: [], allDestinationProducts: [] };
    }

    const isDestinationWide = (p: Product) => {
      const cat = (p.category || '').toLowerCase();
      const sub = (p.subcategory || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const hasHubBinding = Boolean(
        (p as any).hubId ||
        (Array.isArray(p.hubIds) && p.hubIds.length > 0) ||
        p.city ||
        p.fromHubId ||
        p.fromHubName
      );
      return (
        cat.includes('travel service') ||
        sub.includes('connectivity') ||
        sub.includes('insurance') ||
        sub.includes('pass') ||
        name.includes('rail pass') ||
        name.includes('esim') ||
        name.includes('wifi') ||
        name.includes('insurance') ||
        name.includes('nationwide') ||
        !hasHubBinding
      );
    };

    if (!sourceProducts) {
      const destVer = masterDataCache.getVersion('destinations');
      const prodVer = masterDataCache.getVersion('products');
      const railVer = masterDataCache.getVersion('japan_rail_commercial_products');
      const hubsVer = masterDataCache.getVersion('city_hubs');
      const tombVer = masterDataCache.getVersion('inventory_tombstones');
      const combinedVer = prodVer * 100003 + railVer * 1009 + hubsVer * 31 + destVer;
      const destToken = normalizeDestinationToken(destinationIdOrSlug);
      const hubToken = (hubIdOrName || '').toLowerCase().trim();
      const cacheKey = `rel_prods:${destToken}:${hubToken}`;
      const cached = masterDataCache.getDerived<{
        hubActivities: Product[];
        destinationWideProducts: Product[];
        allDestinationProducts: Product[];
      }>(cacheKey, combinedVer, tombVer);
      if (cached) {
        performanceMonitor.recordCacheHit('relevanceProducts');
        return {
          hubActivities: [...cached.hubActivities],
          destinationWideProducts: [...cached.destinationWideProducts],
          allDestinationProducts: [...cached.allDestinationProducts]
        };
      }
      performanceMonitor.recordCacheMiss('relevanceProducts');

      const destCacheKey = `rel_prods_dest:${destToken}`;
      const destCombinedVer = prodVer * 100003 + railVer * 1009 + destVer;
      let destBucket = masterDataCache.getDerived<{
        destProducts: Product[];
        destinationWideProducts: Product[];
      }>(destCacheKey, destCombinedVer, tombVer);
      if (!destBucket) {
        const allProducts = this.db.getProducts().filter(p => isProductActiveForB2B(p, visIndex, deletedSet));
        const destProducts = allProducts.filter(p =>
          matchesDestination(destinationIdOrSlug, p.destinationId, p.destinationName, p.country)
        );
        const destinationWideProducts = destProducts.filter(isDestinationWide);
        destBucket = { destProducts, destinationWideProducts };
        masterDataCache.setDerived(destCacheKey, destCombinedVer, tombVer, destBucket);
      }

      let hubActivities: Product[] = [];
      if (hubIdOrName && String(hubIdOrName).trim()) {
        const resolvedHub = this.resolveHubRecord(destinationIdOrSlug, hubIdOrName);
        const criteriaTokens = Array.from(new Set(
          [
            hubIdOrName,
            resolvedHub?.id,
            resolvedHub?.name,
            (resolvedHub as any)?.hubName,
            resolvedHub?.slug
          ].filter(Boolean) as string[]
        ));
        hubActivities = destBucket.destProducts.filter(p => {
          if (isDestinationWide(p)) return false;
          return criteriaTokens.some(token =>
            matchesHub(token, (p as any).hubId, p.city, (p as any).cityId, (p as any).cityName) ||
            (Array.isArray(p.hubIds) && p.hubIds.some(hId => matchesHub(token, hId))) ||
            matchesHub(token, p.fromHubId, p.fromHubName)
          );
        });
      }

      const result = {
        hubActivities,
        destinationWideProducts: destBucket.destinationWideProducts,
        allDestinationProducts: destBucket.destProducts
      };
      masterDataCache.setDerived(cacheKey, combinedVer, tombVer, result);
      return {
        hubActivities: [...result.hubActivities],
        destinationWideProducts: [...result.destinationWideProducts],
        allDestinationProducts: [...result.allDestinationProducts]
      };
    }

    const allProducts = sourceProducts.filter(
      p => isProductActiveForB2B(p, visIndex, deletedSet)
    );

    const destProducts = allProducts.filter(p => 
      matchesDestination(destinationIdOrSlug, p.destinationId, p.destinationName, p.country)
    );
    const destinationWideProducts = destProducts.filter(isDestinationWide);

    let hubActivities: Product[] = [];
    if (hubIdOrName && String(hubIdOrName).trim()) {
      const resolvedHub = this.resolveHubRecord(destinationIdOrSlug, hubIdOrName);
      const criteriaTokens = Array.from(new Set(
        [
          hubIdOrName,
          resolvedHub?.id,
          resolvedHub?.name,
          (resolvedHub as any)?.hubName,
          resolvedHub?.slug
        ].filter(Boolean) as string[]
      ));

      hubActivities = destProducts.filter(p => {
        if (isDestinationWide(p)) return false;
        return criteriaTokens.some(token =>
          matchesHub(token, (p as any).hubId, p.city, (p as any).cityId, (p as any).cityName) ||
          (Array.isArray(p.hubIds) && p.hubIds.some(hId => matchesHub(token, hId))) ||
          matchesHub(token, p.fromHubId, p.fromHubName)
        );
      });
    }

    return {
      hubActivities,
      destinationWideProducts,
      allDestinationProducts: destProducts
    };
  }

  /**
   * LEVEL 3: Rail Commercial Master Products for Destination.
   * Strictly verifies Japan destination is ACTIVE before returning Shinkansen products.
   */
  public getRelevantRailProducts(destinationIdOrSlug: string): Product[] {
    if (!destinationIdOrSlug) return [];
    const isJapan = matchesDestination(destinationIdOrSlug, 'dest-japan', 'Japan', 'Japan');
    if (!isJapan) return [];
    if (!this.isTargetDestinationActive('dest-japan') && !this.isTargetDestinationActive(destinationIdOrSlug)) {
      return [];
    }

    const deletedSet = this.db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      this.db.getCityHubs(),
      deletedSet
    );
    const allProducts = this.db.getProducts();
    const ord = allProducts.find(p => p.id === 'RAIL-JP-ORD-RESERVED');
    const grn = allProducts.find(p => p.id === 'RAIL-JP-GREEN-RESERVED');
    const list: Product[] = [];
    if (ord && isProductActiveForB2B(ord, visIndex, deletedSet)) list.push(ord);
    if (grn && isProductActiveForB2B(grn, visIndex, deletedSet)) list.push(grn);

    if (list.length > 0) return list;

    return allProducts.filter(p => 
      isProductActiveForB2B(p, visIndex, deletedSet) &&
      (p.id === 'RAIL-JP-ORD-RESERVED' || p.id === 'RAIL-JP-GREEN-RESERVED')
    );
  }

  /**
   * LEVEL 3: Transfer Routes strictly within the selected ACTIVE destination.
   */
  public getRelevantTransferRoutes(
    destinationIdOrSlug: string,
    fromHubId?: string,
    toHubId?: string,
    sourceRoutes?: TransferRoute[]
  ): TransferRoute[] {
    if (!destinationIdOrSlug) return [];
    const deletedSet = this.db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      this.db.getCityHubs(),
      deletedSet
    );
    const targetDestId = resolveDestinationIdToken(destinationIdOrSlug, visIndex);
    if (!targetDestId || !visIndex.activeDestinationIds.has(targetDestId)) {
      return [];
    }

    const allRoutes = (sourceRoutes || this.db.getTransferRoutes()).filter(
      r => isTransferRouteActiveForB2B(r, visIndex, deletedSet)
    );

    let destRoutes = allRoutes.filter(r => 
      matchesDestination(destinationIdOrSlug, r.destinationId, r.destinationName)
    );

    if (fromHubId) {
      destRoutes = destRoutes.filter(r => matchesHub(fromHubId, r.fromHubId, r.fromHubName));
    }

    if (toHubId) {
      destRoutes = destRoutes.filter(r => matchesHub(toHubId, r.toHubId, r.toHubName));
    }

    return destRoutes;
  }

  /**
   * LEVEL 3: Visa facilitation products strictly mapped to an ACTIVE destination country.
   */
  public getRelevantVisas(
    destinationIdOrSlug: string,
    nationality?: string,
    sourceVisas?: VisaProduct[]
  ): VisaProduct[] {
    if (!destinationIdOrSlug) return [];
    const deletedSet = this.db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      this.db.getCityHubs(),
      deletedSet
    );
    const targetDestId = resolveDestinationIdToken(destinationIdOrSlug, visIndex);
    if (!targetDestId || !visIndex.activeDestinationIds.has(targetDestId)) {
      return [];
    }

    const allVisas = (sourceVisas || this.db.getVisas()).filter(v =>
      isVisaOrAncillaryActiveForB2B(v, visIndex, deletedSet)
    );

    return allVisas.filter(v => 
      matchesDestination(destinationIdOrSlug, v.destinationId, undefined, v.country)
    );
  }

  /**
   * Reference Packages configured for the selected ACTIVE destination.
   */
  public getRelevantPackages(
    destinationIdOrSlug: string,
    sourcePackages?: B2BPackage[]
  ): B2BPackage[] {
    if (!destinationIdOrSlug) return [];
    const deletedSet = this.db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(
      this.db.getDestinations(),
      this.db.getCityHubs(),
      deletedSet
    );
    const targetDestId = resolveDestinationIdToken(destinationIdOrSlug, visIndex);
    if (!targetDestId || !visIndex.activeDestinationIds.has(targetDestId)) {
      return [];
    }

    const allPackages = (sourcePackages || this.db.getPackages()).filter(
      p => isPackageActiveForB2B(p, visIndex, deletedSet)
    );

    return allPackages.filter(p => 
      matchesDestination(destinationIdOrSlug, p.destinationId, p.destinationName)
    );
  }

  /**
   * Authoritative validation: Checks if an individual quote item is valid for the destination.
   */
  public validateItemForDestination(
    destinationIdOrSlug: string, 
    item: QuoteItem
  ): { valid: boolean; reason?: string } {
    if (!destinationIdOrSlug) return { valid: true };

    const p = item.product;
    // Check if item has explicit destination
    if (p.destinationId || p.country) {
      const matches = matchesDestination(destinationIdOrSlug, p.destinationId, p.destinationName, p.country);
      if (!matches) {
        return {
          valid: false,
          reason: `Item "${p.name}" belongs to ${p.country || p.destinationName || 'another destination'} and is invalid for ${destinationIdOrSlug}.`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Authoritative validation: Checks if a route hub is valid for the destination.
   */
  public validateRouteHubForDestination(
    destinationIdOrSlug: string,
    hub: TripRouteHub
  ): { valid: boolean; reason?: string } {
    if (!destinationIdOrSlug) return { valid: true };

    const destinationHubs = this.getRelevantHubs(destinationIdOrSlug);
    const isValid = destinationHubs.some(dh => 
      dh.id === hub.hubId || 
      dh.name.toLowerCase() === hub.hubName.toLowerCase()
    );

    if (!isValid) {
      return {
        valid: false,
        reason: `Hub "${hub.hubName}" is not part of the active destination.`
      };
    }

    return { valid: true };
  }

  /**
   * Full quote compatibility validator.
   */
  public validateEntireQuoteForDestination(
    destinationIdOrSlug: string,
    quoteState: {
      routeHubs?: TripRouteHub[];
      items?: QuoteItem[];
    }
  ): { isCompatible: boolean; incompatibleReasons: string[] } {
    const reasons: string[] = [];

    if (quoteState.routeHubs) {
      for (const hub of quoteState.routeHubs) {
        const check = this.validateRouteHubForDestination(destinationIdOrSlug, hub);
        if (!check.valid && check.reason) {
          reasons.push(check.reason);
        }
      }
    }

    if (quoteState.items) {
      for (const item of quoteState.items) {
        const check = this.validateItemForDestination(destinationIdOrSlug, item);
        if (!check.valid && check.reason) {
          reasons.push(check.reason);
        }
      }
    }

    return {
      isCompatible: reasons.length === 0,
      incompatibleReasons: reasons
    };
  }

  /**
   * Sanitizes and invalidates quote selections when changing destination.
   * Removes route hubs and items that do not belong to the newly selected destination.
   */
  public sanitizeQuoteForDestination(
    newDestinationIdOrSlug: string,
    currentItems: QuoteItem[],
    currentRouteHubs: TripRouteHub[]
  ): {
    cleanedItems: QuoteItem[];
    cleanedRouteHubs: TripRouteHub[];
    removedCount: number;
    removedDetails: string[];
  } {
    const removedDetails: string[] = [];

    const cleanedRouteHubs = currentRouteHubs.filter(hub => {
      const check = this.validateRouteHubForDestination(newDestinationIdOrSlug, hub);
      if (!check.valid) {
        removedDetails.push(`Route Hub: ${hub.hubName}`);
        return false;
      }
      return true;
    });

    const cleanedItems = currentItems.filter(item => {
      const check = this.validateItemForDestination(newDestinationIdOrSlug, item);
      if (!check.valid) {
        const itemType = (item as any).itemType || item.product.productType || item.product.category || 'Service';
        removedDetails.push(`${itemType}: ${item.product.name}`);
        return false;
      }
      return true;
    });

    return {
      cleanedItems,
      cleanedRouteHubs,
      removedCount: removedDetails.length,
      removedDetails
    };
  }
}
