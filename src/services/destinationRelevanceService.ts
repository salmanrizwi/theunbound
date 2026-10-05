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

  /**
   * LEVEL 2: Hubs / Cities strictly belonging to the destination.
   * Never returns hubs from other destinations or global fallbacks.
   */
  public getRelevantHubs(destinationIdOrSlug: string, sourceHubs?: CityHub[]): CityHub[] {
    const allHubs = sourceHubs || this.db.getCityHubs();
    if (!destinationIdOrSlug) return [];

    return allHubs.filter(h => {
      if (h.status && h.status !== 'ACTIVE') return false;
      return matchesDestination(destinationIdOrSlug, h.destinationId, h.destinationName);
    });
  }

  /**
   * LEVEL 3: Hotels strictly belonging to the destination, and optionally narrowed to a hub.
   * When hubIdOrName is provided, only returns hotels in that hub.
   * If none exist, returns [] (never falls back to other cities or global list).
   */
  public getRelevantHotels(
    destinationIdOrSlug: string, 
    hubIdOrName?: string, 
    sourceHotels?: Hotel[]
  ): Hotel[] {
    const allHotels = (sourceHotels || this.db.getHotels()).filter(
      h => h.status === 'PUBLISHED' || !h.status
    );
    if (!destinationIdOrSlug) return [];

    // Filter by Destination
    const destHotels = allHotels.filter(h => 
      matchesDestination(destinationIdOrSlug, h.destinationId, h.destinationName, h.country)
    );

    // Filter by Hub if specified
    if (hubIdOrName) {
      return destHotels.filter(h => 
        matchesHub(hubIdOrName, h.hubId, h.city, h.cityId, h.cityName)
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
   * LEVEL 3: Activities & Products strictly belonging to the destination.
   * Categorized into hub-specific activities vs destination-wide services (Rail passes, eSIM, Insurance).
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
    const allProducts = (sourceProducts || this.db.getProducts()).filter(
      p => p.status === 'ACTIVE' || !p.status
    );
    if (!destinationIdOrSlug) {
      return { hubActivities: [], destinationWideProducts: [], allDestinationProducts: [] };
    }

    // Filter strictly to the destination
    const destProducts = allProducts.filter(p => 
      matchesDestination(destinationIdOrSlug, p.destinationId, p.destinationName, p.country)
    );

    // Identify destination-wide products (Rail passes, eSIM, Insurance, nationwide services)
    const isDestinationWide = (p: Product) => {
      const cat = (p.category || '').toLowerCase();
      const sub = (p.subcategory || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
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
        !p.city
      );
    };

    const destinationWideProducts = destProducts.filter(isDestinationWide);

    // If hub is provided, filter hub activities
    let hubActivities: Product[] = [];
    if (hubIdOrName) {
      hubActivities = destProducts.filter(p => 
        !isDestinationWide(p) && (
          matchesHub(hubIdOrName, (p as any).hubId, p.city) ||
          (p.hubIds && p.hubIds.some(hId => matchesHub(hubIdOrName, hId)))
        )
      );
    } else {
      hubActivities = destProducts.filter(p => !isDestinationWide(p));
    }

    return {
      hubActivities,
      destinationWideProducts,
      allDestinationProducts: destProducts
    };
  }

  /**
   * LEVEL 3: Rail Commercial Master Products for Destination.
   * When Japan is selected, returns the canonical Commercial Master Products:
   * 1. Ordinary Car — Reserved Seat (ORDINARY_RESERVED / RAIL-JP-ORD-RESERVED)
   * 2. Green Car — First Class / Reserved (GREEN_RESERVED / RAIL-JP-GREEN-RESERVED)
   */
  public getRelevantRailProducts(destinationIdOrSlug: string): Product[] {
    if (!destinationIdOrSlug) return [];
    const isJapan = matchesDestination(destinationIdOrSlug, 'dest-japan', 'Japan', 'Japan');
    if (!isJapan) return [];

    const allProducts = this.db.getProducts();
    const ord = allProducts.find(p => p.id === 'RAIL-JP-ORD-RESERVED');
    const grn = allProducts.find(p => p.id === 'RAIL-JP-GREEN-RESERVED');
    const list: Product[] = [];
    if (ord && (ord.status === 'ACTIVE' || !ord.status)) list.push(ord);
    if (grn && (grn.status === 'ACTIVE' || !grn.status)) list.push(grn);

    if (list.length > 0) return list;

    // Fallback if not in database
    return allProducts.filter(p => 
      (p.status === 'ACTIVE' || !p.status) &&
      (p.id === 'RAIL-JP-ORD-RESERVED' || p.id === 'RAIL-JP-GREEN-RESERVED')
    );
  }

  /**
   * LEVEL 3: Transfer Routes strictly within the selected destination.
   * Verifies that both departure hub and arrival hub are mapped to the destination.
   */
  public getRelevantTransferRoutes(
    destinationIdOrSlug: string,
    fromHubId?: string,
    toHubId?: string,
    sourceRoutes?: TransferRoute[]
  ): TransferRoute[] {
    const allRoutes = (sourceRoutes || this.db.getTransferRoutes()).filter(
      r => r.status === 'ACTIVE' || !r.status
    );
    if (!destinationIdOrSlug) return [];

    // Filter by destination
    let destRoutes = allRoutes.filter(r => 
      matchesDestination(destinationIdOrSlug, r.destinationId, r.destinationName)
    );

    // If fromHubId is specified
    if (fromHubId) {
      destRoutes = destRoutes.filter(r => matchesHub(fromHubId, r.fromHubId, r.fromHubName));
    }

    // If toHubId is specified
    if (toHubId) {
      destRoutes = destRoutes.filter(r => matchesHub(toHubId, r.toHubId, r.toHubName));
    }

    return destRoutes;
  }

  /**
   * LEVEL 3: Visa facilitation products strictly mapped to the destination country.
   */
  public getRelevantVisas(
    destinationIdOrSlug: string,
    nationality?: string,
    sourceVisas?: VisaProduct[]
  ): VisaProduct[] {
    const allVisas = sourceVisas || this.db.getVisas();
    if (!destinationIdOrSlug) return [];

    return allVisas.filter(v => 
      matchesDestination(destinationIdOrSlug, v.destinationId, undefined, v.country)
    );
  }

  /**
   * Reference Packages configured for the selected destination.
   * Used by AI Planner for structural reference and presets.
   */
  public getRelevantPackages(
    destinationIdOrSlug: string,
    sourcePackages?: B2BPackage[]
  ): B2BPackage[] {
    const allPackages = (sourcePackages || this.db.getPackages()).filter(
      p => p.status === 'PUBLISHED' || !p.status
    );
    if (!destinationIdOrSlug) return [];

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
