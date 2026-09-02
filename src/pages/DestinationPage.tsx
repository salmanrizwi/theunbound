import React, { useState, useMemo, useEffect } from 'react';
import { Destination, Product, ProductFilterState, Hotel, CityHub, HomepageConfig } from '../types';
import { DestinationHero } from '../components/DestinationHero';
import { AllDestinationsHero } from '../components/AllDestinationsHero';
import { CityHubs } from '../components/CityHubs';
import { CategoryFilter } from '../components/CategoryFilter';
import { SearchAndFilter } from '../components/SearchAndFilter';
import { ProductCard } from '../components/ProductCard';
import { FeaturedHotelsSection } from '../components/FeaturedHotelsSection';
import { HotelDetailModal } from '../components/HotelDetailModal';
import { ReadyMadePackagesSection } from '../components/ReadyMadePackagesSection';
import { B2BPackage } from '../types';
import { useQuotation } from '../context/QuotationContext';
import { convertCurrency } from '../services/pricingEngine';
import { AppDatabase } from '../services/db';
import { countingEngine } from '../services/countingEngine';
import { campaignAnalytics } from '../services/campaignAnalyticsService';
import { PublicReviewsCarousel } from '../components/PublicReviewsCarousel';
import { PublicHappyCustomerGallery } from '../components/PublicHappyCustomerGallery';
import { Sparkles, MapPin, Compass, ShieldCheck, HelpCircle, ChevronDown, ChevronUp, Globe2, Layers, CheckCircle2, Clock, Building2, FileText, Award } from 'lucide-react';

interface DestinationPageProps {
  destination: Destination | null;
  allDestinations: Destination[];
  onSelectDestination: (destSlug: string) => void;
  products: Product[];
  onViewProduct: (product: Product) => void;
  onOpenCalculator: (product: Product) => void;
  onInstantBook?: (product: Product) => void;
  onCustomizePackage?: (pkg: B2BPackage) => void;
}

export const DestinationPage: React.FC<DestinationPageProps> = ({
  destination,
  allDestinations,
  onSelectDestination,
  products,
  onViewProduct,
  onOpenCalculator,
  onInstantBook,
  onCustomizePackage
}) => {
  const { currency } = useQuotation();
  const db = AppDatabase.getInstance();

  const isAllDestinations = !destination || destination.slug === 'all';

  // Database state for Hubs, Hotels, and Homepage Config
  const [cityHubs, setCityHubs] = useState<CityHub[]>(() => db.getCityHubs());
  const [hotels, setHotels] = useState<Hotel[]>(() => db.getHotels());
  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig>(() => db.getHomepageConfig());
  const [inspectingHotel, setInspectingHotel] = useState<Hotel | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setCityHubs(db.getCityHubs());
      setHotels(db.getHotels());
      setHomepageConfig(db.getHomepageConfig());
    });
  }, [db]);

  // Filters State
  const [filters, setFilters] = useState<ProductFilterState>({
    searchQuery: '',
    destination: destination ? destination.name : '',
    city: '',
    category: '',
    productType: '',
    minPrice: 0,
    maxPrice: 2000,
    duration: '',
    availability: '',
    sortBy: 'popular'
  });

  // Reset or adjust filters when destination changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      destination: destination ? destination.name : '',
      city: ''
    }));
  }, [destination?.slug]);

  const [expandedFaqIdx, setExpandedFaqIdx] = useState<number | null>(null);

  // Products belonging to current destination or all destinations
  const safeProducts = products || [];
  const safeAllDestinations = allDestinations || [];

  const destinationProducts = useMemo(() => {
    if (isAllDestinations) {
      return safeProducts;
    }
    return countingEngine.getFilteredProducts({ destinationId: destination?.slug || destination?.id }) || [];
  }, [safeProducts, destination, isAllDestinations]);

  // Hotels filtered for this destination / city
  const destinationHotels = useMemo(() => {
    return countingEngine.getFilteredHotels({
      destinationId: isAllDestinations ? undefined : (destination?.slug || destination?.id),
      hubId: filters.city || undefined
    });
  }, [isAllDestinations, destination, filters.city, hotels]);

  // Hierarchical Hubs tagged for this destination (or all destinations)
  const activeHubs = useMemo(() => {
    let hubsList: CityHub[] = [];

    if (isAllDestinations) {
      hubsList = cityHubs || [];
    } else if (destination) {
      hubsList = countingEngine.getFilteredHubs({ destinationId: destination.slug || destination.id }) || [];

      // If no hubs found in cityHubs table yet for this destination, fallback to destination.cities
      if ((hubsList || []).length === 0 && destination.cities && (destination.cities || []).length > 0) {
        hubsList = (destination.cities || []).map((c, idx) => ({
          id: c.id,
          destinationId: destination.id,
          destinationName: destination.name,
          regionId: destination.regionId || '',
          regionName: destination.regionName || '',
          name: c.name,
          tagline: c.tagline || 'Contracted Touring Gateway',
          description: 'Key regional gateway with verified direct DMC contracts and expert local guides.',
          heroImage: c.image,
          images: [c.image],
          productCount: c.productCount || 0,
          hotelCount: 3,
          displayOrder: idx + 1,
          highlights: ['Local Sightseeing', 'Private Transit', 'Bespoke Guides'],
          isPublished: true,
          status: 'ACTIVE'
        }));
      }
    }

    // Enhance with live product and hotel counts and sort by hierarchical displayOrder
    return (hubsList || [])
      .map(hub => {
        const metrics = countingEngine.getHubMetrics(hub.id || hub.name);
        return {
          ...hub,
          productCount: metrics.productsCount,
          hotelCount: metrics.hotelsCount
        };
      })
      .sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1));
  }, [isAllDestinations, destination, cityHubs, destinationProducts, hotels]);

  // Legacy active cities for dropdown filters
  const activeCities = useMemo(() => {
    let rawList: { id: string; name: string; tagline?: string; image?: string; productCount?: number }[] = [];
    if (activeHubs.length > 0) {
      rawList = activeHubs.map(h => ({
        id: h.id,
        name: h.name,
        tagline: h.tagline,
        image: h.heroImage,
        productCount: h.productCount
      }));
    } else if (isAllDestinations) {
      rawList = allDestinations.flatMap(d => (d.cities || []));
    } else if (destination) {
      rawList = destination.cities || [];
    }
    
    // Deduplicate by city name to prevent duplicate entries/keys
    const seen = new Set<string>();
    return rawList.filter(c => {
      const key = (c.name || c.id || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activeHubs, isAllDestinations, allDestinations, destination]);

  // Unique categories & live category counts in this destination / all destinations
  const availableCategories = useMemo(() => {
    const set = new Set(destinationProducts.map(p => p.category));
    return Array.from(set);
  }, [destinationProducts]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    destinationProducts.forEach(p => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [destinationProducts]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    let list = destinationProducts.filter((p) => {
      // Search query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCity = p.city.toLowerCase().includes(q);
        const matchesDesc = p.shortDescription.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesDest = p.destinationName.toLowerCase().includes(q) || p.country.toLowerCase().includes(q);
        if (!matchesName && !matchesCity && !matchesDesc && !matchesSku && !matchesDest) return false;
      }

      // City filter
      if (filters.city && p.city.toLowerCase() !== filters.city.toLowerCase()) {
        return false;
      }

      // Category filter
      if (filters.category && p.category !== filters.category) {
        return false;
      }

      // Availability filter
      if (filters.availability && p.availability !== filters.availability) {
        return false;
      }

      // Max price filter (converted to current currency)
      const convertedPrice = convertCurrency(p.sellingPriceStartingFrom, p.currency, currency);
      if (filters.maxPrice && convertedPrice > filters.maxPrice) {
        return false;
      }

      return true;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      const priceA = convertCurrency(a.sellingPriceStartingFrom, a.currency, currency);
      const priceB = convertCurrency(b.sellingPriceStartingFrom, b.currency, currency);

      switch (filters.sortBy) {
        case 'price-asc':
          return priceA - priceB;
        case 'price-desc':
          return priceB - priceA;
        case 'rating':
          return b.rating - a.rating;
        case 'popular':
        default:
          return b.reviewCount - a.reviewCount;
      }
    });

    return list;
  }, [destinationProducts, filters, currency]);

  // Active destination-specific promo
  const destPromo = useMemo(() => {
    const active = db.getActivePromotions();
    return active.find(p => 
      (p.displayPlacement === 'DESTINATION_PAGE' || p.displayPlacement === 'PROMO_SECTION') &&
      (!p.destinationId || p.destinationId === 'all' || p.destinationId === destination?.id || p.destinationId === destination?.slug)
    );
  }, [db, destination]);

  // Track destination promo view
  useEffect(() => {
    if (destPromo) {
      campaignAnalytics.trackView(destPromo.id, 'DESTINATION_PAGE', {
        destinationId: destination?.id || destination?.slug,
        title: destPromo.title
      });
    }
  }, [destPromo?.id, destination?.id]);

  const handleProductViewTracking = (product: Product) => {
    campaignAnalytics.trackProductView(product.id, destination?.id || product.destinationId);
    onViewProduct(product);
  };

  const handleProductCalcTracking = (product: Product) => {
    campaignAnalytics.trackProductView(product.id, destination?.id || product.destinationId);
    onOpenCalculator(product);
  };

  const handleCitySelect = (cityName: string) => {
    setFilters(prev => ({
      ...prev,
      city: prev.city === cityName ? '' : cityName
    }));
  };

  const handleCategorySelect = (categoryName: string) => {
    setFilters(prev => ({
      ...prev,
      category: prev.category === categoryName ? '' : categoryName
    }));
  };

  const scrollToProducts = () => {
    const target = document.getElementById('products-grid-section');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 space-y-8">
      {/* 1. Hero Banner: All Destinations vs Single Destination */}
      {homepageConfig.showHeroSection !== false && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {isAllDestinations ? (
            <AllDestinationsHero
              destinations={allDestinations}
              config={homepageConfig}
              onSelectDestination={onSelectDestination}
              onExploreProducts={scrollToProducts}
            />
          ) : (
            <DestinationHero
              destination={destination}
              allDestinations={allDestinations}
              onSelectDestination={onSelectDestination}
              onExploreProducts={scrollToProducts}
            />
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* B2B DMC Operational Credibility Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-[#008f77] shrink-0 border border-teal-100">
                <ShieldCheck className="w-5 h-5 text-[#00C6A6]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Direct DMC Licensing</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Contracted ground operations, verified bilingual guides & executive fleets.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-[#008f77] shrink-0 border border-teal-100">
                <Clock className="w-5 h-5 text-[#00C6A6]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">24–48h SLA Operations Desk</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Guaranteed booking turnaround & dedicated on-trip operations support.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-[#008f77] shrink-0 border border-teal-100">
                <Building2 className="w-5 h-5 text-[#00C6A6]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Curated Inventory</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Directly negotiated luxury stays, private ryokans, and high-touch excursions.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-[#008f77] shrink-0 border border-teal-100">
                <FileText className="w-5 h-5 text-[#00C6A6]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">B2B Quotation Studio</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Multi-currency agent proposals, customizable markups & instant client PDFs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Destination / Region Quick Filter Selector for 'All Destinations' */}
        {isAllDestinations && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Globe2 className="w-4 h-4 text-[#00C6A6]" />
                  <span>Filter Products by Destination</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Switch view or filter all travel experiences across our {safeAllDestinations.length} premier regions: {safeAllDestinations.map(d => d.name).join(', ')}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-400">Total Portfolio:</span>
                <span className="text-xs font-bold bg-slate-900 text-white px-2.5 py-0.5 rounded-full">
                  {safeProducts.length} Products
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {safeAllDestinations.map((d, idx) => {
                const metrics = countingEngine.getDestinationMetrics(d.slug || d.id);
                return (
                  <button
                    key={`dest-portfolio-btn-${d.id || d.slug}-${idx}`}
                    type="button"
                    onClick={() => onSelectDestination(d.slug)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-[#00C6A6] bg-slate-50 hover:bg-white hover:shadow-xs transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={d.heroImage}
                        alt={d.name}
                        className="w-10 h-10 rounded-lg object-cover group-hover:scale-105 transition-transform"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#008972] transition-colors">
                          {d.name}
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          {metrics.hubsCount} Hubs • {metrics.productsCount} Tours
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#00C6A6] group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. City Hubs Navigation */}
        <CityHubs
          hubs={activeHubs}
          cities={activeCities}
          selectedCity={filters.city}
          onSelectCity={handleCitySelect}
          destinationName={destination?.name || 'All Destinations'}
          parentRegionName={destination?.regionName || 'Global DMC Portfolio'}
          totalProductsCount={destinationProducts.length}
        />

        {/* 4. Category Filter Tabs */}
        <CategoryFilter
          categories={availableCategories}
          selectedCategory={filters.category}
          onSelectCategory={handleCategorySelect}
          categoryCounts={categoryCounts}
          totalCount={destinationProducts.length}
        />

        {/* 5. Live Search and Secondary Filters */}
        <SearchAndFilter
          filters={filters}
          onFilterChange={setFilters}
          availableCities={activeCities.map(c => c.name)}
          totalResults={filteredProducts.length}
        />

        {/* Active Destination Campaign Promo Ribbon */}
        {destPromo && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-6 border border-[#00C6A6]/30 shadow-md text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="bg-[#00C6A6] text-slate-950 font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  {destPromo.discountType === 'PERCENTAGE' ? `${destPromo.discountValue}% OFF` : `${destPromo.discountValue} ${destPromo.currency || 'USD'} OFF`}
                </span>
                {destPromo.promoCode && (
                  <span className="font-mono text-xs text-[#00E5C0] font-bold bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                    CODE: {destPromo.promoCode}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                {destPromo.title}
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {destPromo.subtitle || destPromo.description}
              </p>
            </div>

            <button
              onClick={() => {
                campaignAnalytics.trackClick(
                  destPromo.id,
                  'DESTINATION_PAGE',
                  'dest_promo_action_btn',
                  destPromo.ctaText || 'Claim Deal',
                  { destinationId: destination?.id }
                );
                const el = document.getElementById('products-grid-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-colors shrink-0 cursor-pointer"
            >
              {destPromo.ctaText || 'Explore Contracted Rates'} →
            </button>
          </div>
        )}

        {/* 6. Products Section Heading */}
        <div id="products-grid-section" className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {filters.category
                ? `${filters.category} in ${isAllDestinations ? 'All Destinations' : destination?.name}`
                : isAllDestinations
                ? `All Available Products across ${safeAllDestinations.map(d => d.name).join(', ')}`
                : `Featured Products in ${destination?.name}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAllDestinations
                ? `Showing direct wholesale DMC inventory across all ${safeAllDestinations.length} destination portfolios`
                : `Verified ground contracts and bespoke experiences in ${destination?.country}`}
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium shrink-0">
            Showing <strong className="text-slate-900">{filteredProducts.length}</strong> verified contracts
          </span>
        </div>

        {/* 7. Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <Compass className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No matching travel products found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Try adjusting your hub selection, clear search keywords, or reset category filters.
            </p>
            <button
              onClick={() => setFilters({
                searchQuery: '',
                destination: destination ? destination.name : '',
                city: '',
                category: '',
                productType: '',
                minPrice: 0,
                maxPrice: 2000,
                duration: '',
                availability: '',
                sortBy: 'popular'
              })}
              className="bg-[#00C6A6] text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-xs hover:bg-[#00b296] transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onViewDetails={handleProductViewTracking}
                onOpenCalculator={handleProductCalcTracking}
                onInstantBook={onInstantBook}
              />
            ))}
          </div>
        )}

        {/* 7. Ready-Made Packages Section */}
        <div className="mt-14 pt-8 border-t border-slate-200">
          <ReadyMadePackagesSection
            destinationId={isAllDestinations ? 'all' : (destination?.slug || destination?.id)}
            destinationName={isAllDestinations ? 'Signature Circuits' : destination?.name}
            onCustomizePackage={onCustomizePackage}
            currency={currency}
          />
        </div>

        {/* 7.1 Featured Hotel Section - ONLY visible if there are hotels to show */}
        {destinationHotels.length > 0 && (
          <div className="mt-14 pt-8 border-t border-slate-200">
            <FeaturedHotelsSection
              hotels={destinationHotels}
              destinationName={isAllDestinations ? 'All Destinations' : destination?.name}
              onViewHotel={(hotel) => setInspectingHotel(hotel)}
            />
          </div>
        )}

        {/* 7.4 Happy Customer Moments Gallery */}
        <div className="mt-16">
          <PublicHappyCustomerGallery destinationName={isAllDestinations ? undefined : destination?.name} />
        </div>

        {/* 7.5 Verified Ground Testimonials & Reviews */}
        <div className="mt-16">
          <PublicReviewsCarousel destinationName={isAllDestinations ? undefined : destination?.name} />
        </div>

        {/* 8. Destination Trade Information & FAQs */}
        {(() => {
          // Dynamic FAQ resolution
          let displayedFaqs: { q: string; a: string; category?: string }[] = [];
          
          if (isAllDestinations) {
            const homeFaqs = db.getHomepageConfig().homepageFAQs?.filter(f => f.isPublished !== false) || [];
            if (homeFaqs.length > 0) {
              displayedFaqs = homeFaqs.map(f => ({ q: f.question, a: f.answer, category: f.category }));
            }
          } else if (destination) {
            const destFaqs = db.getDestinationFAQs().filter(
              f => (f.destinationId === destination.id || f.destinationId === destination.slug) && f.isPublished !== false
            );
            if (destFaqs.length > 0) {
              displayedFaqs = destFaqs.map(f => ({ q: f.question, a: f.answer, category: f.category }));
            }
          }

          // Fallbacks if no custom FAQs configured yet
          if (displayedFaqs.length === 0) {
            displayedFaqs = [
              {
                q: isAllDestinations
                  ? `What is the standard cancellation window across ${allDestinations.map(d => d.name).join(', ')}?`
                  : `What is the standard cancellation window for ${destination?.name} private tours?`,
                a: `Most contracted ground services allow full refunds up to 72 hours prior to scheduled departure. Specialty private charters, Michelin dining reservations, and peak seasonal allocations require 7 to 14 days advance written notice.`
              },
              {
                q: isAllDestinations
                  ? 'How do multi-currency conversions and VAT work across all destinations?'
                  : `How do currency conversions and VAT work for ${destination?.name}?`,
                a: `Published rates in our portal automatically convert native ground supplier contracts (${allDestinations.map(d => d.currency).join(', ')}) into your selected billing currency using real-time dynamic exchange rate formulas.`
              },
              {
                q: isAllDestinations
                  ? `Can TheUnbound combine ${allDestinations.map(d => d.name).slice(0, 3).join(', ')} tours into a single multi-destination quote?`
                  : `Can TheUnbound customize bespoke multi-city itineraries for VIP groups in ${destination?.name}?`,
                a: `Yes. Our B2B Quotation Builder allows travel agents to bundle services across multiple countries into a single unified proposal with consolidated billing and itemized net rates.`
              },
              {
                q: 'Are child rates and infant seats provided on chauffeur vehicles?',
                a: `Certified child safety seats and booster chairs can be added directly via our dynamic pricing calculator as complimentary or low-cost add-on selections.`
              }
            ];
          }

          return (
            <div id="destination-info-section" className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6 mt-12">
              <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-[#008972]/10 flex items-center justify-center text-[#008972]">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isAllDestinations ? 'Global Multi-Destination' : destination?.name} DMC Operations & Agent Advisory
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isAllDestinations 
                      ? 'Managed from Homepage FAQs Manager (General & Trade Operations) in CMS.' 
                      : 'Managed from Destination Management -> Destination FAQs & Trade Notes in CMS.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedFaqs.map((faq, idx) => {
                  const isExpanded = expandedFaqIdx === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setExpandedFaqIdx(isExpanded ? null : idx)}
                      className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors cursor-pointer space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2 pr-2">
                          {faq.category && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#008972]/10 text-[#008972]">
                              {faq.category}
                            </span>
                          )}
                          <h4 className="text-xs font-bold text-slate-800 leading-snug">{faq.q}</h4>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                      </div>
                      {isExpanded && (
                        <p className="text-xs text-slate-600 leading-relaxed pt-1">
                          {faq.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Hotel Detail & Interactive Rate Calculator Modal */}
      {inspectingHotel && (
        <HotelDetailModal
          hotel={inspectingHotel}
          onClose={() => setInspectingHotel(null)}
        />
      )}
    </div>
  );
};
