import React, { useState, useMemo, useEffect } from 'react';
import { Destination, Product, ProductFilterState } from '../types';
import { DestinationHero } from '../components/DestinationHero';
import { AllDestinationsHero } from '../components/AllDestinationsHero';
import { CityHubs } from '../components/CityHubs';
import { CategoryFilter } from '../components/CategoryFilter';
import { SearchAndFilter } from '../components/SearchAndFilter';
import { ProductCard } from '../components/ProductCard';
import { useQuotation } from '../context/QuotationContext';
import { convertCurrency } from '../services/pricingEngine';
import { PublicReviewsCarousel } from '../components/PublicReviewsCarousel';
import { Sparkles, MapPin, Compass, ShieldCheck, HelpCircle, ChevronDown, ChevronUp, Globe2, Layers, CheckCircle2 } from 'lucide-react';

interface DestinationPageProps {
  destination: Destination | null;
  allDestinations: Destination[];
  onSelectDestination: (destSlug: string) => void;
  products: Product[];
  onViewProduct: (product: Product) => void;
  onOpenCalculator: (product: Product) => void;
  onInstantBook?: (product: Product) => void;
}

export const DestinationPage: React.FC<DestinationPageProps> = ({
  destination,
  allDestinations,
  onSelectDestination,
  products,
  onViewProduct,
  onOpenCalculator,
  onInstantBook
}) => {
  const { currency } = useQuotation();

  const isAllDestinations = !destination || destination.slug === 'all';

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

  // All combined city hubs across all destinations or single destination
  const activeCities = useMemo(() => {
    if (isAllDestinations) {
      return allDestinations.flatMap(d => d.cities);
    }
    return destination ? destination.cities : [];
  }, [isAllDestinations, allDestinations, destination]);

  // Products belonging to current destination or all destinations
  const destinationProducts = useMemo(() => {
    if (isAllDestinations) {
      return products;
    }
    return products.filter(
      p => p.destinationSlug === destination.slug || 
           p.destinationName.toLowerCase().includes(destination.name.toLowerCase()) ||
           p.country.toLowerCase().includes(destination.name.toLowerCase())
    );
  }, [products, destination, isAllDestinations]);

  // Unique categories in this destination / all destinations
  const availableCategories = useMemo(() => {
    const set = new Set(destinationProducts.map(p => p.category));
    return Array.from(set);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {isAllDestinations ? (
          <AllDestinationsHero
            destinations={allDestinations}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
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
                  Switch view or filter all travel experiences across our 3 premier regions
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-400">Total Portfolio:</span>
                <span className="text-xs font-bold bg-slate-900 text-white px-2.5 py-0.5 rounded-full">
                  {products.length} Products
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {allDestinations.map(d => {
                const count = products.filter(
                  p => p.destinationSlug === d.slug || p.destinationName.toLowerCase().includes(d.name.toLowerCase())
                ).length;
                return (
                  <button
                    key={d.id}
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
                          {d.cities.length} Hubs • {count} Tours
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
          cities={activeCities}
          selectedCity={filters.city}
          onSelectCity={handleCitySelect}
        />

        {/* 4. Category Filter Tabs */}
        <CategoryFilter
          categories={availableCategories}
          selectedCategory={filters.category}
          onSelectCategory={handleCategorySelect}
        />

        {/* 5. Live Search and Secondary Filters */}
        <SearchAndFilter
          filters={filters}
          onFilterChange={setFilters}
          availableCities={activeCities.map(c => c.name)}
          totalResults={filteredProducts.length}
        />

        {/* 6. Products Section Heading */}
        <div id="products-grid-section" className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {filters.category
                ? `${filters.category} in ${isAllDestinations ? 'All Destinations' : destination?.name}`
                : isAllDestinations
                ? 'All Available Products across Japan, UK & Europe'
                : `Featured Products in ${destination?.name}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAllDestinations
                ? 'Showing direct wholesale DMC inventory across all 3 countries'
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
                onViewDetails={onViewProduct}
                onOpenCalculator={onOpenCalculator}
                onInstantBook={onInstantBook}
              />
            ))}
          </div>
        )}

        {/* 7.5 Verified Ground Testimonials & Reviews */}
        <div className="mt-16">
          <PublicReviewsCarousel destinationName={isAllDestinations ? undefined : destination?.name} />
        </div>

        {/* 8. Destination Trade Information & FAQs */}
        <div id="destination-info-section" className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6 mt-12">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-[#00C6A6]/10 flex items-center justify-center text-[#00C6A6]">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAllDestinations ? 'Global Multi-Destination' : destination?.name} DMC Operations & Agent Advisory
              </h3>
              <p className="text-xs text-slate-500">
                Important ground logistics, visa policies, and seasonal operational tips for travel designers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                q: isAllDestinations
                  ? 'What is the standard cancellation window across Japan, UK, and Europe?'
                  : `What is the standard cancellation window for ${destination?.name} private tours?`,
                a: `Most contracted ground services allow full refunds up to 72 hours prior to scheduled departure. Specialty private charters, Michelin dining reservations, and peak seasonal allocations require 7 to 14 days advance written notice.`
              },
              {
                q: isAllDestinations
                  ? 'How do multi-currency conversions and VAT work across all destinations?'
                  : `How do currency conversions and VAT work for ${destination?.name}?`,
                a: `Published rates in our portal automatically convert native ground supplier contracts (JPY, GBP, EUR) into your selected billing currency (USD, EUR, GBP, JPY) using real-time dynamic exchange rate formulas.`
              },
              {
                q: isAllDestinations
                  ? 'Can TheUnbound combine Japan, UK, and European tours into a single multi-destination quote?'
                  : `Can TheUnbound customize bespoke multi-city itineraries for VIP groups?`,
                a: `Yes. Our B2B Quotation Builder allows travel agents to bundle services across multiple countries into a single unified proposal with consolidated billing and itemized net rates.`
              },
              {
                q: 'Are child rates and infant seats provided on chauffeur vehicles?',
                a: `Certified child safety seats and booster chairs can be added directly via our dynamic pricing calculator as complimentary or low-cost add-on selections.`
              }
            ].map((faq, idx) => {
              const isExpanded = expandedFaqIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setExpandedFaqIdx(isExpanded ? null : idx)}
                  className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-800 leading-snug">{faq.q}</h4>
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
      </div>
    </div>
  );
};
