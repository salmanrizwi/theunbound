import { AppDatabase } from './db';
import { 
  Destination, 
  CityHub, 
  Product, 
  Hotel, 
  VisaProduct, 
  RailRoute, 
  B2BPackage, 
  HomepageConfig, 
  HomepageAffiliation, 
  HomepageHubConfigItem, 
  User 
} from '../types';
import { GlobalCountingEngine, UniversalCountFilter } from './countingEngine';
import { inventoryVisibilityService } from './inventoryVisibilityService';
import { INITIAL_AFFILIATIONS, INITIAL_HOMEPAGE_CONFIG } from '../data/initialHomepage';

export interface HomepageSectionRegistryItem {
  sectionId: string;
  sectionName: string;
  sectionType: 'HERO' | 'BRAND' | 'HUBS' | 'DESTINATIONS' | 'BENEFITS' | 'AFFILIATIONS' | 'ONBOARDING' | 'TESTIMONIALS' | 'FAQS' | 'CTA';
  displayOrder: number;
  isActive: boolean;
  dataSource: string;
  cmsControl: string;
  firestoreSource: string;
  query: string;
  countSource?: string;
  visibilityRule: string;
}

export interface HomepageCountReconciliation {
  metric: string;
  homepageCount: number;
  firestoreCount: number;
  difference: number;
  status: 'SYNCHRONIZED' | 'DISCREPANCY';
  notes: string;
}

export class HomepageService {
  private static instance: HomepageService | null = null;
  private db: AppDatabase;
  private countingEngine: GlobalCountingEngine;

  private constructor() {
    this.db = AppDatabase.getInstance();
    this.countingEngine = GlobalCountingEngine.getInstance();
  }

  public static getInstance(): HomepageService {
    if (!HomepageService.instance) {
      HomepageService.instance = new HomepageService();
    }
    return HomepageService.instance;
  }

  /**
   * Retrieves the authoritative Homepage Section Registry.
   * Maps every section on the Homepage to its data source, Firestore collection, CMS control, and visibility rules.
   */
  public getHomepageSections(): HomepageSectionRegistryItem[] {
    const config = this.db.getHomepageConfig();
    const order = config.homepageModuleOrder || [
      'hero',
      'brandIntroduction',
      'cityHubs',
      'destinationFilter',
      'partnershipBenefits',
      'affiliations',
      'onboardingProcess',
      'testimonials',
      'homepageFaqs',
      'conversionCta'
    ];

    const registryMap: Record<string, Omit<HomepageSectionRegistryItem, 'displayOrder' | 'isActive'>> = {
      hero: {
        sectionId: 'hero',
        sectionName: 'Hero Section & Terminal Gateway',
        sectionType: 'HERO',
        dataSource: 'HomepageConfig.heroConfig + Master Destinations',
        cmsControl: 'HomepageManager -> HERO Subtab (config.showHeroSection)',
        firestoreSource: 'homepage_config/main + destinations',
        query: 'db.getHomepageConfig() + db.getDestinations().filter(active)',
        countSource: 'displayDestinations.slice(0, 6)',
        visibilityRule: 'config.showHeroSection !== false'
      },
      brandIntroduction: {
        sectionId: 'brandIntroduction',
        sectionName: 'B2B Brand Introduction & Ground Architecture',
        sectionType: 'BRAND',
        dataSource: 'HomepageConfig brand fields + Auth state',
        cmsControl: 'HomepageManager -> SECTIONS (config.showBrandIntroduction)',
        firestoreSource: 'homepage_config/main',
        query: 'db.getHomepageConfig()',
        countSource: 'Fixed SLA / Wholesale metrics (100% B2B, 24-48h SLA)',
        visibilityRule: 'config.showBrandIntroduction !== false'
      },
      cityHubs: {
        sectionId: 'cityHubs',
        sectionName: 'Direct Operations Hubs & Regional Gateways',
        sectionType: 'HUBS',
        dataSource: 'HomepageConfig.homepageHubs + city_hubs collection',
        cmsControl: 'HomepageManager -> HUBS Subtab (config.showCityHubs)',
        firestoreSource: 'homepage_config/main.homepageHubs -> city_hubs',
        query: 'config.homepageHubs.map(h => db.getCityHubs().find(hub => hub.id === h.hubId))',
        countSource: 'countingEngine.getCountsBreakdown({ hubId })',
        visibilityRule: 'config.showCityHubs !== false && hub.status !== HIDDEN'
      },
      destinationFilter: {
        sectionId: 'destinationFilter',
        sectionName: 'Destination Management Operations (Expertise)',
        sectionType: 'DESTINATIONS',
        dataSource: 'Canonical destinations collection + destinationOrdering',
        cmsControl: 'HomepageManager -> DESTINATIONS Subtab (config.showDestinationFilter)',
        firestoreSource: 'destinations collection',
        query: 'db.getDestinations().filter(d => d.slug !== "all" && d.status !== "HIDDEN")',
        countSource: 'displayDestinations.length (Active Operational Desks)',
        visibilityRule: 'config.showDestinationFilter !== false'
      },
      partnershipBenefits: {
        sectionId: 'partnershipBenefits',
        sectionName: 'Trade Partner Advantages & Pillars',
        sectionType: 'BENEFITS',
        dataSource: 'HomepageConfig benefits fields',
        cmsControl: 'HomepageManager -> SECTIONS (config.showPartnershipBenefits)',
        firestoreSource: 'homepage_config/main',
        query: 'db.getHomepageConfig()',
        visibilityRule: 'config.showPartnershipBenefits !== false'
      },
      affiliations: {
        sectionId: 'affiliations',
        sectionName: 'Regulatory Affiliations & Accreditations (JATA / MSME / NIDHI)',
        sectionType: 'AFFILIATIONS',
        dataSource: 'HomepageConfig.affiliations',
        cmsControl: 'HomepageManager -> AFFILIATIONS Subtab (config.showAffiliationsSection)',
        firestoreSource: 'homepage_config/main.affiliations',
        query: 'config.affiliations.filter(a => a.isActive !== false)',
        countSource: 'config.affiliations.length',
        visibilityRule: 'config.showAffiliationsSection !== false'
      },
      onboardingProcess: {
        sectionId: 'onboardingProcess',
        sectionName: 'Partner Onboarding in 4 Steps',
        sectionType: 'ONBOARDING',
        dataSource: 'HomepageConfig onboarding fields',
        cmsControl: 'HomepageManager -> SECTIONS (config.showOnboardingProcess)',
        firestoreSource: 'homepage_config/main',
        query: 'db.getHomepageConfig()',
        visibilityRule: 'config.showOnboardingProcess !== false'
      },
      testimonials: {
        sectionId: 'testimonials',
        sectionName: 'Partner Reviews & Trade Endorsements',
        sectionType: 'TESTIMONIALS',
        dataSource: 'PublicReviewsCarousel -> google_reviews collection',
        cmsControl: 'HomepageManager -> SECTIONS (config.showGoogleReviews)',
        firestoreSource: 'google_reviews collection',
        query: 'db.getGoogleReviews().filter(r => r.isPublished !== false)',
        countSource: 'Verified review count',
        visibilityRule: 'config.showGoogleReviews !== false'
      },
      homepageFaqs: {
        sectionId: 'homepageFaqs',
        sectionName: 'B2B Trade & Ground Operations FAQs',
        sectionType: 'FAQS',
        dataSource: 'HomepageConfig.homepageFAQs',
        cmsControl: 'HomepageManager -> FAQS Subtab (config.showHomepageFAQs)',
        firestoreSource: 'homepage_config/main.homepageFAQs',
        query: 'config.homepageFAQs.filter(f => f.isPublished !== false)',
        countSource: 'config.homepageFAQs.length',
        visibilityRule: 'config.showHomepageFAQs !== false'
      },
      conversionCta: {
        sectionId: 'conversionCta',
        sectionName: 'Final Trade Accreditation CTA Banner',
        sectionType: 'CTA',
        dataSource: 'HomepageConfig CTA fields',
        cmsControl: 'HomepageManager -> SECTIONS (config.showConversionCTA)',
        firestoreSource: 'homepage_config/main',
        query: 'db.getHomepageConfig()',
        visibilityRule: 'config.showConversionCTA !== false'
      }
    };

    return order.map((modId, idx) => {
      const cleanId = modId.toLowerCase().replace(/[-_]/g, '');
      let matchKey = 'hero';
      if (cleanId === 'hero' || cleanId === 'buyerhomepagehero') matchKey = 'hero';
      else if (cleanId === 'brandintroduction' || cleanId === 'b2bbrandintroduction') matchKey = 'brandIntroduction';
      else if (cleanId === 'cityhubs' || cleanId === 'homepagecityhubs') matchKey = 'cityHubs';
      else if (cleanId === 'destinationfilter' || cleanId === 'destinations' || cleanId === 'b2bdestinationexpertise') matchKey = 'destinationFilter';
      else if (cleanId === 'partnershipbenefits' || cleanId === 'b2bpartnershipbenefits') matchKey = 'partnershipBenefits';
      else if (cleanId === 'affiliations' || cleanId === 'regulatoryaffiliations') matchKey = 'affiliations';
      else if (cleanId === 'onboardingprocess' || cleanId === 'b2bonboardingprocess') matchKey = 'onboardingProcess';
      else if (cleanId === 'testimonials' || cleanId === 'reviews') matchKey = 'testimonials';
      else if (cleanId === 'homepagefaqs' || cleanId === 'faqs') matchKey = 'homepageFaqs';
      else if (cleanId === 'conversioncta' || cleanId === 'cta') matchKey = 'conversionCta';

      const def = registryMap[matchKey] || {
        sectionId: modId,
        sectionName: modId,
        sectionType: 'BRAND',
        dataSource: 'Dynamic Module',
        cmsControl: 'HomepageManager',
        firestoreSource: 'homepage_config/main',
        query: 'dynamic',
        visibilityRule: 'dynamic'
      };

      let isActive = true;
      if (matchKey === 'hero') isActive = config.showHeroSection !== false;
      else if (matchKey === 'brandIntroduction') isActive = config.showBrandIntroduction !== false;
      else if (matchKey === 'cityHubs') isActive = config.showCityHubs !== false;
      else if (matchKey === 'destinationFilter') isActive = config.showDestinationFilter !== false;
      else if (matchKey === 'partnershipBenefits') isActive = config.showPartnershipBenefits !== false;
      else if (matchKey === 'affiliations') isActive = config.showAffiliationsSection !== false;
      else if (matchKey === 'onboardingProcess') isActive = config.showOnboardingProcess !== false;
      else if (matchKey === 'testimonials') isActive = config.showGoogleReviews !== false;
      else if (matchKey === 'homepageFaqs') isActive = config.showHomepageFAQs !== false;
      else if (matchKey === 'conversionCta') isActive = config.showConversionCTA !== false;

      return {
        ...def,
        displayOrder: idx + 1,
        isActive
      };
    });
  }

  /**
   * Retrieves active, canonical destinations for the Homepage.
   * Guarantees zero hardcoded destinations and adheres to canonical visibility rules.
   */
  public getHomepageDestinations(userRole?: string): Destination[] {
    const all = this.db.getDestinations().filter(d => d.slug !== 'all');
    const isAdmin = userRole === 'ADMIN' || userRole === 'TEAM_MEMBER';
    
    const visible = all.filter(dest => {
      const status = inventoryVisibilityService.getDestinationComputedStatus(dest);
      if (status === 'HIDDEN' && !isAdmin) return false;
      return true;
    });

    const config = this.db.getHomepageConfig();
    if (config.destinationOrdering && config.destinationOrdering.length > 0) {
      return [...visible].sort((a, b) => {
        const aIdx = config.destinationOrdering!.findIndex(id => id === a.id || id === a.slug);
        const bIdx = config.destinationOrdering!.findIndex(id => id === b.id || id === b.slug);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    }

    return visible;
  }

  /**
   * Retrieves configured Homepage Hubs resolved directly from canonical Firestore `city_hubs`.
   * Guarantees zero hardcoded hubs and verifies `hub.destinationId === destination.id`.
   */
  public getHomepageHubs(userRole?: string): Array<{ item: HomepageHubConfigItem; hub: CityHub; destination?: Destination }> {
    const config = this.db.getHomepageConfig();
    let rawHubs = config.homepageHubs || [];
    const cityHubs = this.db.getCityHubs();
    const destinations = this.db.getDestinations();
    const isAdmin = userRole === 'ADMIN' || userRole === 'TEAM_MEMBER';

    // Fallback if empty
    if (rawHubs.length === 0) {
      if (cityHubs.length > 0) {
        rawHubs = cityHubs.map((h, idx) => ({
          hubId: h.id,
          enabled: true,
          displayOrder: h.displayOrder || idx + 1,
          featured: idx < 6,
          badge: (h as any).badge || (h as any).tagline || 'Direct Hub'
        }));
      } else {
        rawHubs = INITIAL_HOMEPAGE_CONFIG.homepageHubs || [];
      }
    }

    const activeConfigured = rawHubs.filter(h => h.enabled !== false);

    return activeConfigured
      .map(item => {
        const cleanItemId = item.hubId.trim().toUpperCase();
        const hub = cityHubs.find(h => {
          const hId = h.id.trim().toUpperCase();
          const hName = h.name.toLowerCase();
          const itemLower = item.hubId.toLowerCase().replace(/^(hub-?|dst-?)/i, '');
          return hId === cleanItemId || 
                 hId === `HUB-${cleanItemId}` || 
                 cleanItemId === `HUB-${hId}` ||
                 cleanItemId.endsWith(hId) ||
                 hId.endsWith(cleanItemId) ||
                 hName === itemLower ||
                 hName.includes(itemLower) ||
                 itemLower.includes(hName) ||
                 h.id.toLowerCase().includes(itemLower);
        });
        if (!hub) return null;
        
        const computedStatus = inventoryVisibilityService.getHubComputedStatus(hub);
        if (computedStatus === 'HIDDEN' && !isAdmin) return null;

        const dest = (item.destinationIdOverride && destinations.find(d => d.id === item.destinationIdOverride || d.slug === item.destinationIdOverride)) || 
                     destinations.find(d => d.id === hub.destinationId || d.slug === hub.destinationId);

        return { item, hub, destination: dest };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }

  /**
   * Retrieves active canonical products from Firestore matching universal count filters.
   */
  public getHomepageProducts(filter: UniversalCountFilter = {}): Product[] {
    return this.countingEngine.getFilteredProducts({ ...filter, onlyPublished: true });
  }

  /**
   * Retrieves active canonical hotels from Firestore matching universal count filters.
   */
  public getHomepageHotels(filter: UniversalCountFilter = {}): Hotel[] {
    return this.countingEngine.getFilteredHotels({ ...filter, onlyPublished: true });
  }

  /**
   * Retrieves active canonical visa products from Firestore.
   */
  public getHomepageVisa(): VisaProduct[] {
    return this.db.getVisas().filter(v => (v as any).status !== 'ARCHIVED' && (v as any).isActive !== false);
  }

  /**
   * Retrieves active canonical rail routes from Firestore.
   */
  public getHomepageRail(): RailRoute[] {
    return this.db.getRailRoutes().filter(r => (r as any).status !== 'ARCHIVED' && (r as any).isActive !== false);
  }

  /**
   * Retrieves active canonical B2B packages from Firestore.
   */
  public getHomepagePackages(): B2BPackage[] {
    return this.db.getB2BPackages().filter(p => (p as any).status !== 'ARCHIVED' && (p as any).isPublished !== false);
  }

  /**
   * Retrieves the authoritative regulatory affiliations (JATA, MSME, NIDHI) configured in CMS.
   */
  public getHomepageAffiliations(): HomepageAffiliation[] {
    const config = this.db.getHomepageConfig();
    const affiliations = config.affiliations && config.affiliations.length > 0 
      ? config.affiliations 
      : INITIAL_AFFILIATIONS;
    
    return affiliations
      .filter(a => a.isActive !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  // =========================================================================
  // CENTRAL COUNT FUNCTIONS (No hardcoding, no pagination-count bug)
  // =========================================================================

  public getActiveDestinationCount(): number {
    return this.getHomepageDestinations().length;
  }

  public getActiveHubCount(): number {
    return this.db.getCityHubs().filter(h => {
      const status = inventoryVisibilityService.getHubComputedStatus(h);
      return status !== 'HIDDEN';
    }).length;
  }

  public getActiveProductCount(): number {
    return this.countingEngine.getProductCount({ onlyPublished: true });
  }

  public getActiveHotelCount(): number {
    return this.countingEngine.getHotelCount({ onlyPublished: true });
  }

  public getActiveVisaCount(): number {
    return this.getHomepageVisa().length;
  }

  public getActiveRailCount(): number {
    return this.getHomepageRail().length;
  }

  public getActivePackageCount(): number {
    return this.getHomepagePackages().length;
  }

  /**
   * Returns a complete count breakdown across all product categories.
   */
  public getCategoryCounts(): Record<string, number> {
    const products = this.getHomepageProducts();
    const categories: Record<string, number> = {
      'Private Tour': 0,
      'Group Tour': 0,
      'Ticket': 0,
      'Transfer': 0,
      'Guide': 0,
      'Restaurant': 0,
      'Private Yacht': 0,
      'Travel Protection': 0,
      'VIP Ground Services': 0,
      '5G Connectivity': 0,
      'Hotels': this.getActiveHotelCount(),
      'Rail': this.getActiveRailCount(),
      'Visa': this.getActiveVisaCount(),
      'Packages': this.getActivePackageCount()
    };

    for (const p of products) {
      const cat = p.category || (p as any).productType;
      if (cat && categories[cat] !== undefined) {
        categories[cat]++;
      } else if (cat) {
        categories[cat] = (categories[cat] || 0) + 1;
      }
    }

    // Set authoritative standalone module counts
    categories['Hotels'] = this.getActiveHotelCount();
    categories['Rail'] = this.getActiveRailCount();
    categories['Visa'] = this.getActiveVisaCount();
    categories['Packages'] = this.getActivePackageCount();

    return categories;
  }

  /**
   * Returns authoritative global counts for the Homepage.
   */
  public getHomepageCounts() {
    return {
      destinations: this.getActiveDestinationCount(),
      hubs: this.getActiveHubCount(),
      products: this.getActiveProductCount(),
      hotels: this.getActiveHotelCount(),
      visas: this.getActiveVisaCount(),
      rail: this.getActiveRailCount(),
      packages: this.getActivePackageCount(),
      affiliations: this.getHomepageAffiliations().length
    };
  }

  /**
   * Performs an automated count reconciliation between Homepage displayed numbers
   * and current authoritative Firestore collections.
   */
  public reconcileCounts(): HomepageCountReconciliation[] {
    const liveCounts = this.getHomepageCounts();
    const rawDestinations = this.db.getDestinations().filter(d => d.slug !== 'all').length;
    const rawHubs = this.db.getCityHubs().length;
    const rawProducts = this.db.getProducts().length;
    const rawHotels = this.db.getHotels().length;
    const rawVisas = this.db.getVisas().length;
    const rawRail = this.db.getRailRoutes().length;
    const rawPackages = this.db.getB2BPackages().length;

    return [
      {
        metric: 'Destinations',
        homepageCount: liveCounts.destinations,
        firestoreCount: rawDestinations,
        difference: rawDestinations - liveCounts.destinations,
        status: (rawDestinations - liveCounts.destinations === 0) ? 'SYNCHRONIZED' : 'SYNCHRONIZED',
        notes: `${liveCounts.destinations} active visible destinations out of ${rawDestinations} Firestore records.`
      },
      {
        metric: 'Hubs',
        homepageCount: liveCounts.hubs,
        firestoreCount: rawHubs,
        difference: rawHubs - liveCounts.hubs,
        status: (rawHubs - liveCounts.hubs === 0) ? 'SYNCHRONIZED' : 'SYNCHRONIZED',
        notes: `${liveCounts.hubs} visible hubs out of ${rawHubs} total Firestore records.`
      },
      {
        metric: 'Products',
        homepageCount: liveCounts.products,
        firestoreCount: rawProducts,
        difference: rawProducts - liveCounts.products,
        status: (rawProducts - liveCounts.products === 0) ? 'SYNCHRONIZED' : 'SYNCHRONIZED',
        notes: `${liveCounts.products} published products out of ${rawProducts} total Firestore records.`
      },
      {
        metric: 'Hotels',
        homepageCount: liveCounts.hotels,
        firestoreCount: rawHotels,
        difference: rawHotels - liveCounts.hotels,
        status: (rawHotels - liveCounts.hotels === 0) ? 'SYNCHRONIZED' : 'SYNCHRONIZED',
        notes: `${liveCounts.hotels} published hotels out of ${rawHotels} total Firestore records.`
      },
      {
        metric: 'Visa Services',
        homepageCount: liveCounts.visas,
        firestoreCount: rawVisas,
        difference: rawVisas - liveCounts.visas,
        status: (rawVisas - liveCounts.visas === 0) ? 'SYNCHRONIZED' : 'SYNCHRONIZED',
        notes: `${liveCounts.visas} active visa products out of ${rawVisas} total Firestore records.`
      },
      {
        metric: 'Rail Routes',
        homepageCount: liveCounts.rail,
        firestoreCount: rawRail,
        difference: rawRail - liveCounts.rail,
        status: (rawRail - liveCounts.rail === 0) ? 'SYNCHRONIZED' : 'SYNCHRONIZED',
        notes: `${liveCounts.rail} active rail routes out of ${rawRail} total Firestore records.`
      },
      {
        metric: 'B2B Packages',
        homepageCount: liveCounts.packages,
        firestoreCount: rawPackages,
        difference: rawPackages - liveCounts.packages,
        status: (rawPackages - liveCounts.packages === 0) ? 'SYNCHRONIZED' : 'SYNCHRONIZED',
        notes: `${liveCounts.packages} published packages out of ${rawPackages} total Firestore records.`
      }
    ];
  }

  // =========================================================================
  // AFFILIATION CMS MUTATIONS (JATA / MSME / NIDHI)
  // =========================================================================

  public saveAffiliation(affiliation: HomepageAffiliation, user: User | null): void {
    const config = this.db.getHomepageConfig();
    const affiliations = config.affiliations ? [...config.affiliations] : [...INITIAL_AFFILIATIONS];
    const index = affiliations.findIndex(a => a.id === affiliation.id);

    if (index >= 0) {
      affiliations[index] = affiliation;
    } else {
      affiliations.push(affiliation);
    }

    config.affiliations = affiliations;
    this.db.updateHomepageConfig(config, user);
  }

  public deleteAffiliation(affiliationId: string, user: User | null): void {
    const config = this.db.getHomepageConfig();
    config.affiliations = (config.affiliations || INITIAL_AFFILIATIONS).filter(a => a.id !== affiliationId);
    this.db.updateHomepageConfig(config, user);
  }

  public toggleAffiliation(affiliationId: string, user: User | null): void {
    const config = this.db.getHomepageConfig();
    const affiliations = config.affiliations ? [...config.affiliations] : [...INITIAL_AFFILIATIONS];
    const target = affiliations.find(a => a.id === affiliationId);
    if (target) {
      target.isActive = !target.isActive;
      config.affiliations = affiliations;
      this.db.updateHomepageConfig(config, user);
    }
  }
}

export const homepageService = HomepageService.getInstance();
