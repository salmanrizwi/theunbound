import {
  Product,
  Destination,
  MasterRegion,
  Promotion,
  BlogArticle,
  GoogleReview,
  Hotel,
  CityHub,
  DestinationFAQ,
  GalleryImage,
  EmailCampaignConfig,
  RosterResource,
  ProductRosterRule,
  VisaProduct,
  TravelProtectionPlan,
  VipGroundService,
  ConnectivityPlan,
  B2BPackage,
  TravelLead,
  VehicleMaster,
  YachtMaster,
  FerryMaster
} from '../types';
import { RailStation, RailRoute, RailRate, RailSeasonCalendarPeriod } from '../types/rail';

export interface DemoSeedBundle {
  INITIAL_PRODUCTS: Product[];
  DESTINATIONS: Destination[];
  INITIAL_MASTER_REGIONS: MasterRegion[];
  INITIAL_PROMOTIONS: Promotion[];
  INITIAL_BLOGS: BlogArticle[];
  INITIAL_REVIEWS: GoogleReview[];
  INITIAL_HOTELS: Hotel[];
  INITIAL_CITY_HUBS: CityHub[];
  INITIAL_FAQS: DestinationFAQ[];
  INITIAL_GALLERY: GalleryImage[];
  INITIAL_CAMPAIGNS: EmailCampaignConfig[];
  INITIAL_ROSTER_RESOURCES: RosterResource[];
  INITIAL_PRODUCT_ROSTER_RULES: Record<string, ProductRosterRule>;
  INITIAL_VISAS: VisaProduct[];
  INITIAL_TRAVEL_PROTECTION_PLANS: TravelProtectionPlan[];
  INITIAL_VIP_GROUND_SERVICES: VipGroundService[];
  INITIAL_CONNECTIVITY_PLANS: ConnectivityPlan[];
  INITIAL_B2B_PACKAGES: B2BPackage[];
  INITIAL_LEADS: TravelLead[];
  INITIAL_RAIL_STATIONS: RailStation[];
  INITIAL_RAIL_ROUTES: RailRoute[];
  INITIAL_RAIL_RATES: RailRate[];
  INITIAL_RAIL_SEASON_CALENDAR: RailSeasonCalendarPeriod[];
  INITIAL_VEHICLES: VehicleMaster[];
  INITIAL_YACHTS: YachtMaster[];
  INITIAL_FERRIES: FerryMaster[];
}

let cachedSeeds: DemoSeedBundle | null = null;
let loadingPromise: Promise<DemoSeedBundle> | null = null;

export function getCachedDemoSeeds(): DemoSeedBundle | null {
  return cachedSeeds;
}

export async function loadDemoSeedsAsync(): Promise<DemoSeedBundle> {
  if (cachedSeeds) return cachedSeeds;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const [
      { INITIAL_PRODUCTS },
      { DESTINATIONS },
      { INITIAL_MASTER_REGIONS },
      { INITIAL_PROMOTIONS },
      { INITIAL_BLOGS },
      { INITIAL_REVIEWS },
      { INITIAL_HOTELS },
      { INITIAL_CITY_HUBS },
      { INITIAL_FAQS },
      { INITIAL_GALLERY },
      { INITIAL_CAMPAIGNS },
      { INITIAL_ROSTER_RESOURCES, INITIAL_PRODUCT_ROSTER_RULES },
      { INITIAL_VISAS },
      { INITIAL_TRAVEL_PROTECTION_PLANS, INITIAL_VIP_GROUND_SERVICES, INITIAL_CONNECTIVITY_PLANS },
      { INITIAL_B2B_PACKAGES },
      { INITIAL_LEADS },
      { INITIAL_RAIL_STATIONS },
      { INITIAL_RAIL_ROUTES },
      { INITIAL_RAIL_RATES },
      { INITIAL_RAIL_SEASON_CALENDAR },
      { INITIAL_VEHICLES },
      { INITIAL_YACHTS },
      { INITIAL_FERRIES }
    ] = await Promise.all([
      import('./initialProducts'),
      import('./destinations'),
      import('./initialRegions'),
      import('./initialPromotions'),
      import('./initialBlogs'),
      import('./initialReviews'),
      import('./initialHotels'),
      import('./initialCityHubs'),
      import('./initialFAQs'),
      import('./initialGallery'),
      import('./initialCampaigns'),
      import('./initialRoster'),
      import('./initialVisas'),
      import('./initialAncillaryServices'),
      import('./initialPackages'),
      import('./initialLeads'),
      import('./initialRailStations'),
      import('./initialRailRoutes'),
      import('./initialRailRates'),
      import('./initialRailSeasons'),
      import('./initialVehicles'),
      import('./initialYachts'),
      import('./initialFerries')
    ]);

    cachedSeeds = {
      INITIAL_PRODUCTS,
      DESTINATIONS,
      INITIAL_MASTER_REGIONS,
      INITIAL_PROMOTIONS,
      INITIAL_BLOGS,
      INITIAL_REVIEWS,
      INITIAL_HOTELS,
      INITIAL_CITY_HUBS,
      INITIAL_FAQS,
      INITIAL_GALLERY,
      INITIAL_CAMPAIGNS,
      INITIAL_ROSTER_RESOURCES,
      INITIAL_PRODUCT_ROSTER_RULES,
      INITIAL_VISAS,
      INITIAL_TRAVEL_PROTECTION_PLANS,
      INITIAL_VIP_GROUND_SERVICES,
      INITIAL_CONNECTIVITY_PLANS,
      INITIAL_B2B_PACKAGES,
      INITIAL_LEADS,
      INITIAL_RAIL_STATIONS,
      INITIAL_RAIL_ROUTES,
      INITIAL_RAIL_RATES,
      INITIAL_RAIL_SEASON_CALENDAR,
      INITIAL_VEHICLES,
      INITIAL_YACHTS,
      INITIAL_FERRIES
    };
    return cachedSeeds;
  })();

  return loadingPromise;
}
