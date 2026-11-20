import { Product, Hotel, Destination, CityHub } from '../types';
import { evaluateInventoryValidity } from './pricingEngine';
import { AppDatabase } from './db';
import {
  buildDestinationVisibilityIndex,
  isProductActiveForB2B,
  isHotelActiveForB2B,
  paginateAfterEligibility
} from './destinationVisibility';

export interface B2BProductSearchParams {
  destinationId?: string;
  regionId?: string;
  hubId?: string;
  date?: string;
  category?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface B2BProductSearchResult {
  items: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  filtersApplied: {
    destinationId?: string;
    regionId?: string;
    hubId?: string;
    date?: string;
    category?: string;
    searchQuery?: string;
  };
}

export interface B2BHotelSearchParams {
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  infants?: number;
  roomsCount: number;
  destinationId?: string;
  hubId?: string;
  starRating?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface B2BHotelSearchResult {
  items: Hotel[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  stayDetails: {
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    adults: number;
    children: number;
    infants: number;
    roomsCount: number;
  };
  filtersApplied: {
    destinationId?: string;
    hubId?: string;
    starRating?: string;
    searchQuery?: string;
  };
}

/**
 * Service providing fast, indexed, search-first inventory discovery
 * for Products/Tours and Hotels/Ryokans in the B2B Agent Portal.
 */
export class InventoryDiscoveryService {
  private static instance: InventoryDiscoveryService | null = null;

  public static getInstance(): InventoryDiscoveryService {
    if (!InventoryDiscoveryService.instance) {
      InventoryDiscoveryService.instance = new InventoryDiscoveryService();
    }
    return InventoryDiscoveryService.instance;
  }

  /**
   * Search Products & Tours matching search-first discovery criteria.
   * Does NOT return all products if search has not been triggered.
   */
  public searchProducts(
    params: B2BProductSearchParams,
    sourceProducts?: Product[]
  ): B2BProductSearchResult {
    const db = AppDatabase.getInstance();
    const rawProducts = sourceProducts && sourceProducts.length > 0
      ? sourceProducts
      : db.getProducts();

    const deletedSet = db.getDeletedEntityIds();
    const allHubs = db.getCityHubs();
    const allRegions = db.getRegions();
    const visIndex = buildDestinationVisibilityIndex(db.getDestinations(), allHubs, deletedSet);

    const hubRegionLookup = new Map<string, string>();
    allHubs.forEach(h => {
      if (h && h.id && h.regionId) {
        hubRegionLookup.set(h.id.toLowerCase(), h.regionId.toLowerCase());
        if (h.name) hubRegionLookup.set(h.name.toLowerCase(), h.regionId.toLowerCase());
      }
    });
    const regionLookup = new Map<string, { id: string; name: string; slug: string }>();
    allRegions.forEach(r => {
      if (r && r.id) {
        const entry = {
          id: r.id.toLowerCase(),
          name: (r.name || '').toLowerCase(),
          slug: (r.slug || '').toLowerCase()
        };
        regionLookup.set(entry.id, entry);
        if (entry.name) regionLookup.set(entry.name, entry);
        if (entry.slug) regionLookup.set(entry.slug, entry);
      }
    });

    const seenIds = new Set<string>();
    const canonicalProducts = (rawProducts || []).filter(p => {
      if (!p || typeof p !== 'object' || !p.id) return false;
      if (seenIds.has(p.id)) return false;
      if (!isProductActiveForB2B(p, visIndex, deletedSet)) return false;
      seenIds.add(p.id);
      return true;
    });

    const destFilter = (params.destinationId || '').trim();
    const regionFilter = (params.regionId || '').trim();
    const hubFilter = (params.hubId || '').trim();
    const dateFilter = (params.date || '').trim();
    const categoryFilter = (params.category || '').trim();
    const query = (params.searchQuery || '').trim().toLowerCase();

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, params.pageSize || 20);

    const paginated = paginateAfterEligibility(
      canonicalProducts,
      product => {
        // 1. Destination filter (matches destinationId, destinationIds, destination, or destinationSlug)
        if (destFilter && destFilter !== 'ALL') {
          const pDestId = (product.destinationId || '').toLowerCase();
          const pDest = (product.destination || product.destinationName || '').toLowerCase();
          const pDestSlug = ((product as any).destinationSlug || '').toLowerCase();
          const target = destFilter.toLowerCase();

          const matchesDest =
            pDestId === target ||
            (Array.isArray(product.destinationIds) && product.destinationIds.some(did => (did || '').toLowerCase() === target)) ||
            pDest === target ||
            pDestSlug === target;

          if (!matchesDest) return false;
        }

        // 1b. Region filter (matches regionId, regionIds, regionName, regionNames, or any hub's parent region)
        if (regionFilter && regionFilter !== 'ALL') {
          const target = regionFilter.toLowerCase();
          const targetMeta = regionLookup.get(target);
          const targetIds = new Set<string>([
            target,
            ...(targetMeta ? [targetMeta.id, targetMeta.name, targetMeta.slug].filter(Boolean) : [])
          ]);

          const pRegId = (product.regionId || '').toLowerCase();
          const pRegName = (product.regionName || '').toLowerCase();
          const matchesDirectRegion =
            targetIds.has(pRegId) ||
            targetIds.has(pRegName) ||
            (Array.isArray(product.regionIds) && product.regionIds.some(rid => targetIds.has((rid || '').toLowerCase()))) ||
            (Array.isArray(product.regionNames) && product.regionNames.some(rn => targetIds.has((rn || '').toLowerCase())));

          const matchesHubParentRegion =
            (product.hubId && targetIds.has(hubRegionLookup.get(product.hubId.toLowerCase()) || '')) ||
            (Array.isArray(product.hubIds) && product.hubIds.some(hid => targetIds.has(hubRegionLookup.get((hid || '').toLowerCase()) || '')));

          if (!matchesDirectRegion && !matchesHubParentRegion) return false;
        }

        // 2. Hub filter (matches hubId, hubIds, hubNames, city, cityHubId, fromHubId, toHubId, or hubName)
        if (hubFilter && hubFilter !== 'ALL') {
          const pHubId = (product.hubId || (product as any).cityHubId || '').toLowerCase();
          const pFromHub = (product.fromHubId || '').toLowerCase();
          const pToHub = (product.toHubId || '').toLowerCase();
          const pHubName = ((product as any).hubName || (product as any).cityHubName || product.city || '').toLowerCase();
          const target = hubFilter.toLowerCase();

          const matchesHub =
            pHubId === target ||
            pFromHub === target ||
            pToHub === target ||
            pHubName === target ||
            (Array.isArray(product.hubIds) && product.hubIds.some(hid => (hid || '').toLowerCase() === target)) ||
            (Array.isArray(product.hubNames) && product.hubNames.some(hn => (hn || '').toLowerCase() === target));

          if (!matchesHub) return false;
        }

        // 3. Product Category filter
        if (categoryFilter && categoryFilter !== 'ALL') {
          const pCat = (product.category || '').toLowerCase();
          const target = categoryFilter.toLowerCase();
          if (target === 'rail') {
            if (pCat !== 'rail' && pCat !== 'rail / shinkansen') return false;
          } else if (pCat !== target) {
            return false;
          }
        }

        // 4. Date validity check
        if (dateFilter) {
          const evalResult = evaluateInventoryValidity(product, dateFilter);
          if (!evalResult.isValid) return false;
        }

        // 5. Text search query
        if (query) {
          const titleMatch = (product.title || product.name || '').toLowerCase().includes(query);
          const descMatch = (product.description || product.shortDescription || '').toLowerCase().includes(query);
          const codeMatch = (product.sku || (product as any).productCode || (product as any).code || '').toLowerCase().includes(query);
          const destMatch = (product.destination || product.destinationName || '').toLowerCase().includes(query);
          const regMatch = (product.regionName || '').toLowerCase().includes(query) ||
            (Array.isArray(product.regionNames) && product.regionNames.some(rn => (rn || '').toLowerCase().includes(query)));
          const hubMatch = ((product as any).hubName || (product as any).cityHubName || product.city || '').toLowerCase().includes(query) ||
            (Array.isArray(product.hubNames) && product.hubNames.some(hn => (hn || '').toLowerCase().includes(query)));

          if (!titleMatch && !descMatch && !codeMatch && !destMatch && !regMatch && !hubMatch) {
            return false;
          }
        }

        return true;
      },
      page,
      pageSize
    );

    return {
      items: paginated.items,
      totalCount: paginated.totalCount,
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalPages: paginated.totalPages,
      hasMore: paginated.hasMore,
      filtersApplied: {
        destinationId: destFilter || undefined,
        regionId: regionFilter || undefined,
        hubId: hubFilter || undefined,
        date: dateFilter || undefined,
        category: categoryFilter || undefined,
        searchQuery: query || undefined
      }
    };
  }

  /**
   * Search Hotels & Ryokans matching search-first stay and occupancy criteria.
   * Calculates nights and validates availability for stay dates.
   */
  public searchHotels(
    params: B2BHotelSearchParams,
    sourceHotels?: Hotel[]
  ): B2BHotelSearchResult {
    const db = AppDatabase.getInstance();
    const rawHotels = sourceHotels && sourceHotels.length > 0
      ? sourceHotels
      : db.getHotels();

    const deletedSet = db.getDeletedEntityIds();
    const visIndex = buildDestinationVisibilityIndex(db.getDestinations(), db.getCityHubs(), deletedSet);

    const canonicalHotels = (rawHotels || []).filter(
      h => Boolean(h && typeof h === 'object' && h.id && isHotelActiveForB2B(h, visIndex, deletedSet))
    );

    // Validate stay dates
    const checkIn = (params.checkInDate || '').trim();
    const checkOut = (params.checkOutDate || '').trim();

    if (!checkIn || !checkOut) {
      throw new Error('Both Check-in and Check-out dates are required to search hotels.');
    }

    const checkInTime = new Date(checkIn).getTime();
    const checkOutTime = new Date(checkOut).getTime();

    if (isNaN(checkInTime) || isNaN(checkOutTime)) {
      throw new Error('Invalid Check-in or Check-out date format.');
    }

    if (checkOutTime <= checkInTime) {
      throw new Error('Check-out date must be after Check-in date.');
    }

    const nights = Math.max(1, Math.round((checkOutTime - checkInTime) / (1000 * 60 * 60 * 24)));
    const adults = Math.max(1, params.adults || 1);
    const children = Math.max(0, params.children || 0);
    const infants = Math.max(0, params.infants || 0);
    const roomsCount = Math.max(1, params.roomsCount || 1);

    const destFilter = (params.destinationId || '').trim();
    const hubFilter = (params.hubId || '').trim();
    const starFilter = (params.starRating || '').trim();
    const query = (params.searchQuery || '').trim().toLowerCase();

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, params.pageSize || 12);

    const paginated = paginateAfterEligibility(
      canonicalHotels,
      hotel => {
        // 1. Destination filter
        if (destFilter && destFilter !== 'ALL') {
          const hDestId = (hotel.destinationId || '').toLowerCase();
          const hDest = ((hotel as any).destination || '').toLowerCase();
          const target = destFilter.toLowerCase();
          if (hDestId !== target && hDest !== target) return false;
        }

        // 2. Hub/City filter
        if (hubFilter && hubFilter !== 'ALL') {
          const hHubId = (hotel.hubId || hotel.cityId || '').toLowerCase();
          const hCity = (hotel.cityName || hotel.city || '').toLowerCase();
          const target = hubFilter.toLowerCase();
          if (hHubId !== target && hCity !== target) return false;
        }

        // 3. Star Rating filter
        if (starFilter && starFilter !== 'ALL') {
          const hStar = String(hotel.starRating || '');
          if (hStar !== starFilter) return false;
        }

        // 4. Stay date inventory validity check
        const hotelValidity = evaluateInventoryValidity(hotel, checkIn, checkOut);
        if (!hotelValidity.isValid) return false;

        // 5. Room capacity check (if roomTypes exist)
        if (hotel.roomTypes && hotel.roomTypes.length > 0) {
          const reqAdultsPerRoom = Math.ceil(adults / roomsCount);
          const hasSuitableRoom = hotel.roomTypes.some(room => {
            const maxOcc = room.maxOccupancy || (room as any).capacity || 2;
            return maxOcc >= reqAdultsPerRoom;
          });
          if (!hasSuitableRoom) {
            const totalMaxOcc = hotel.roomTypes.reduce((acc, r) => Math.max(acc, r.maxOccupancy || (r as any).capacity || 2), 0);
            if (totalMaxOcc < reqAdultsPerRoom) return false;
          }
        }

        // 6. Text query search
        if (query) {
          const nameMatch = (hotel.name || '').toLowerCase().includes(query);
          const cityMatch = (hotel.cityName || hotel.city || '').toLowerCase().includes(query);
          const descMatch = (hotel.description || '').toLowerCase().includes(query);
          const addressMatch = (hotel.address || '').toLowerCase().includes(query);

          if (!nameMatch && !cityMatch && !descMatch && !addressMatch) {
            return false;
          }
        }

        return true;
      },
      page,
      pageSize
    );

    return {
      items: paginated.items,
      totalCount: paginated.totalCount,
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalPages: paginated.totalPages,
      hasMore: paginated.hasMore,
      stayDetails: {
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
        adults,
        children,
        infants,
        roomsCount
      },
      filtersApplied: {
        destinationId: destFilter || undefined,
        hubId: hubFilter || undefined,
        starRating: starFilter || undefined,
        searchQuery: query || undefined
      }
    };
  }
}

export const inventoryDiscoveryService = InventoryDiscoveryService.getInstance();
