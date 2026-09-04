import { 
  Destination, 
  CityHub, 
  Hotel, 
  HotelRoomType, 
  Product, 
  TransferRoute, 
  B2BPackage, 
  QuoteItem, 
  TripRouteHub, 
  CurrencyCode, 
  User, 
  FeasibilityCheckResult 
} from '../types';
import { AppDatabase } from './db';
import { calculateProductPrice, formatCurrency, convertCurrency, MasterPricingService, ControlledPriceResponse } from './pricingEngine';
import { checkItineraryFeasibility } from '../utils/b2bQuotationHelpers';
import { DestinationRelevanceService, matchesDestination } from './destinationRelevanceService';

/**
 * CONTROLLED RETRIEVAL TOOLS FOR AI PLANNER
 * Strictly reads from real TheUnbound Database instances.
 * Hallucination prevention: Only active, verified inventory is ever returned.
 */

export interface DestinationSearchResult {
  destination: Destination;
  hubs: CityHub[];
  hotelCount: number;
  activityCount: number;
  transferCount: number;
}

export interface HotelSearchCriteria {
  destinationId?: string;
  hubId?: string;
  starRating?: string;
  query?: string;
  minOccupancy?: number;
  style?: string;
}

export interface ProductSearchCriteria {
  destinationId?: string;
  hubId?: string;
  category?: string;
  interests?: string[];
  query?: string;
  maxPax?: number;
  durationHours?: number;
}

export interface TransferSearchCriteria {
  destinationId?: string;
  fromHubId?: string;
  toHubId?: string;
  transferType?: string;
  minCapacity?: number;
}

export class AiPlannerTools {
  private static instance: AiPlannerTools;
  private db: AppDatabase;

  private constructor() {
    this.db = AppDatabase.getInstance();
  }

  public static getInstance(): AiPlannerTools {
    if (!AiPlannerTools.instance) {
      AiPlannerTools.instance = new AiPlannerTools();
    }
    return AiPlannerTools.instance;
  }

  /**
   * Tool 1: Search Destinations
   */
  public searchDestinations(query?: string): DestinationSearchResult[] {
    const destinations = this.db.getDestinations().filter(d => d.status === 'ACTIVE' || !d.status);
    const hubs = this.db.getCityHubs();
    const hotels = this.db.getHotels().filter(h => h.status === 'PUBLISHED' || !h.status);
    const products = this.db.getProducts().filter(p => p.status === 'ACTIVE' || !p.status);
    const transfers = this.db.getTransferRoutes().filter(t => t.status === 'ACTIVE' || !t.status);

    const safeQuery = (query || '').toLowerCase().trim();

    return destinations
      .filter(dest => {
        if (!safeQuery) return true;
        return (
          dest.name.toLowerCase().includes(safeQuery) ||
          dest.country.toLowerCase().includes(safeQuery) ||
          dest.slug.toLowerCase().includes(safeQuery) ||
          (dest.description && dest.description.toLowerCase().includes(safeQuery))
        );
      })
      .map(dest => {
        const destHubs = hubs.filter(h => h.destinationId === dest.id || h.destinationName?.toLowerCase() === dest.name.toLowerCase());
        const destHotels = hotels.filter(h => h.destinationId === dest.id);
        const destProducts = products.filter(p => p.destinationId === dest.id);
        const destTransfers = transfers.filter(t => t.destinationId === dest.id);

        return {
          destination: dest,
          hubs: destHubs,
          hotelCount: destHotels.length,
          activityCount: destProducts.length,
          transferCount: destTransfers.length
        };
      });
  }

  /**
   * Tool 2: Search Hubs
   */
  public searchHubs(destinationId?: string, query?: string): CityHub[] {
    let hubs = destinationId 
      ? DestinationRelevanceService.getInstance().getRelevantHubs(destinationId)
      : this.db.getCityHubs().filter(h => h.status === 'ACTIVE' || !h.status);

    if (query) {
      const q = query.toLowerCase().trim();
      hubs = hubs.filter(h => 
        h.name.toLowerCase().includes(q) || 
        (h.tagline && h.tagline.toLowerCase().includes(q)) ||
        (h.description && h.description.toLowerCase().includes(q))
      );
    }

    return hubs;
  }

  /**
   * Tool 3: Search Hotels
   */
  public searchHotels(criteria: HotelSearchCriteria): Hotel[] {
    let hotels = criteria.destinationId
      ? DestinationRelevanceService.getInstance().getRelevantHotels(criteria.destinationId, criteria.hubId)
      : this.db.getHotels().filter(h => h.status === 'PUBLISHED' || !h.status);

    if (criteria.starRating) {
      const star = criteria.starRating.toLowerCase();
      if (star.includes('5')) {
        hotels = hotels.filter(h => (h.starRating || 0) >= 5);
      } else if (star.includes('4')) {
        hotels = hotels.filter(h => (h.starRating || 0) >= 4);
      } else if (star.includes('3')) {
        hotels = hotels.filter(h => (h.starRating || 0) >= 3);
      }
    }

    if (criteria.query) {
      const q = criteria.query.toLowerCase().trim();
      hotels = hotels.filter(h => 
        h.name.toLowerCase().includes(q) ||
        (h.cityName && h.cityName.toLowerCase().includes(q)) ||
        (h.city && h.city.toLowerCase().includes(q)) ||
        (h.area && h.area.toLowerCase().includes(q)) ||
        (h.address && h.address.toLowerCase().includes(q)) ||
        (h.description && h.description.toLowerCase().includes(q)) ||
        (h.amenities && h.amenities.some(t => t.toLowerCase().includes(q)))
      );
    }

    return hotels;
  }

  /**
   * Tool 4: Search Rooms for a Hotel
   */
  public searchRooms(hotelId: string): HotelRoomType[] {
    const hotel = this.db.getHotels().find(h => h.id === hotelId);
    return DestinationRelevanceService.getInstance().getRelevantRooms(hotel);
  }

  /**
   * Tool 5: Search Meal Plans
   */
  public searchMealPlans(hotelId?: string): string[] {
    if (hotelId) {
      const hotel = this.db.getHotels().find(h => h.id === hotelId);
      return DestinationRelevanceService.getInstance().getRelevantMealPlans(hotel);
    }
    return ['Room Only (EP)', 'Bed & Breakfast (BB)', 'Half Board (HB)', 'Full Board (FB)', 'All Inclusive (AI)'];
  }

  /**
   * Tool 6: Search Products & Activities
   */
  public searchProducts(criteria: ProductSearchCriteria): Product[] {
    let products: Product[] = [];
    if (criteria.destinationId) {
      const rel = DestinationRelevanceService.getInstance().getRelevantProducts(criteria.destinationId, criteria.hubId);
      products = criteria.hubId 
        ? [...rel.hubActivities, ...rel.destinationWideProducts]
        : rel.allDestinationProducts;
    } else {
      products = this.db.getProducts().filter(p => p.status === 'ACTIVE' || !p.status);
    }

    if (criteria.category) {
      const cat = criteria.category.toLowerCase().trim();
      products = products.filter(p => 
        (p.category && p.category.toLowerCase().includes(cat)) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(cat))
      );
    }

    if (criteria.interests && criteria.interests.length > 0) {
      const interestLower = criteria.interests.map(i => i.toLowerCase().trim());
      products = products.filter(p => {
        const text = `${p.name} ${p.shortDescription || ''} ${p.longDescription || ''} ${p.category || ''}`.toLowerCase();
        return interestLower.some(i => text.includes(i));
      });
    }

    if (criteria.query) {
      const q = criteria.query.toLowerCase().trim();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.shortDescription && p.shortDescription.toLowerCase().includes(q)) ||
        (p.longDescription && p.longDescription.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q))
      );
    }

    return products;
  }

  /**
   * Tool 7: Search Activities (excluding pure transfers/hotels)
   */
  public searchActivities(criteria: ProductSearchCriteria): Product[] {
    const products = this.searchProducts(criteria);
    return products.filter(p => {
      const cat = (p.category || '').toLowerCase();
      const isTransfer = (p as any).isTransfer || cat.includes('transfer');
      const isHotel = cat.includes('hotel') || cat.includes('accommodation');
      return !isTransfer && !isHotel;
    });
  }

  /**
   * Tool 8: Search Transfers & Transport Routes
   */
  public searchTransfers(criteria: TransferSearchCriteria): {
    routes: TransferRoute[];
    products: Product[];
  } {
    let routes: TransferRoute[] = [];
    if (criteria.destinationId) {
      routes = DestinationRelevanceService.getInstance().getRelevantTransferRoutes(
        criteria.destinationId,
        criteria.fromHubId,
        criteria.toHubId
      );
    } else {
      routes = this.db.getTransferRoutes().filter(r => r.status === 'ACTIVE' || !r.status);
    }

    let transferProducts = this.db.getProducts().filter(p => 
      (p.status === 'ACTIVE' || !p.status) &&
      ((p as any).isTransfer || (p.category || '').toLowerCase().includes('transfer') || (p.category || '').toLowerCase().includes('transport'))
    );

    if (criteria.destinationId) {
      transferProducts = transferProducts.filter(p => 
        matchesDestination(criteria.destinationId, p.destinationId, p.destinationName, p.country)
      );
    }

    if (criteria.transferType) {
      routes = routes.filter(r => r.transferType === criteria.transferType);
    }

    if (criteria.minCapacity) {
      routes = routes.filter(r => (r.maxCapacity || 6) >= criteria.minCapacity!);
    }

    return {
      routes,
      products: transferProducts
    };
  }

  /**
   * Tool 9: Search Visa Products
   */
  public searchVisaProducts(destinationId?: string, nationality?: string): any[] {
    if (destinationId) {
      return DestinationRelevanceService.getInstance().getRelevantVisas(destinationId, nationality);
    }
    return this.db.getVisas();
  }

  /**
   * Tool 10: Search Packages
   */
  public searchPackages(destinationId?: string): B2BPackage[] {
    if (destinationId) {
      return DestinationRelevanceService.getInstance().getRelevantPackages(destinationId);
    }
    return this.db.getPackages().filter(p => p.status === 'PUBLISHED' || !p.status);
  }

  /**
   * Tool 11: Calculate Quote Pricing using Authoritative Pricing Engine
   * Internal prices (net cost, margin, markup) are strictly hidden.
   */
  public calculateQuotePricing(
    items: QuoteItem[], 
    user: User | null, 
    currency: CurrencyCode = 'USD'
  ): {
    totalSellingPrice: number;
    itemsWithPrice: QuoteItem[];
  } {
    let grandTotal = 0;

    const itemsWithPrice = items.map(item => {
      const calculation = calculateProductPrice(item.product, {
        productId: item.product.id,
        adults: item.pax.adults,
        children: item.pax.children,
        infants: item.pax.infants,
        travelDate: item.travelDate,
        targetCurrency: currency,
        user: user,
        userRole: user?.role || 'B2B_AGENT',
        pricingTier: 'B2B',
        selectedAddonIds: item.selectedAddonIds || []
      });

      const convertedSelling = convertCurrency(calculation.finalTotalSellingPrice || calculation.sellingPriceFinal || 0, calculation.currency || item.product.currency, currency);
      grandTotal += convertedSelling;

      return {
        ...item,
        calculation: {
          ...calculation,
          finalTotalSellingPrice: convertedSelling,
          sellingPriceFinal: convertedSelling
        }
      };
    });

    return {
      totalSellingPrice: grandTotal,
      itemsWithPrice
    };
  }

  /**
   * Tool 12: Validate Itinerary
   */
  public validateItinerary(
    routeHubs: TripRouteHub[],
    items: QuoteItem[],
    totalDays: number,
    visaAssistance: string = 'NOT_REQUIRED'
  ): FeasibilityCheckResult {
    return checkItineraryFeasibility(
      routeHubs,
      items,
      totalDays,
      visaAssistance,
      items.some(i => (i.product.name || '').toLowerCase().includes('insurance')),
      items.some(i => (i.product.name || '').toLowerCase().includes('esim'))
    );
  }

  /**
   * Tool 13: Controlled Rate Lookup using Master Pricing Service (Section 26)
   * Exposes strictly finalSellingPrice, currency, perPersonPrice, and audit metadata.
   * Internal commercial breakdown (net costs, supplier margins, markups) are strictly hidden.
   */
  public getCurrentPrice(params: {
    inventoryId: string;
    inventoryType?: 'PRODUCT' | 'HOTEL' | 'TRANSFER' | 'VISA' | 'PACKAGE';
    serviceConfiguration?: Record<string, any>;
    passengerConfiguration?: { adults?: number; children?: number; infants?: number };
    date?: string;
    currency?: CurrencyCode;
    user?: User | null;
  }): ControlledPriceResponse {
    return MasterPricingService.getCurrentPrice({
      ...params,
      pricingTier: 'B2B'
    });
  }
}
