import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Building2, 
  ShoppingBag, 
  Layers, 
  Globe2, 
  ArrowRight, 
  Check, 
  Plus, 
  Eye, 
  Sparkles, 
  Clock, 
  Star, 
  FileText, 
  ShieldCheck, 
  ChevronRight, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Compass, 
  Plane, 
  FileCheck, 
  CheckCircle2, 
  PlusCircle, 
  Flame,
  BookmarkCheck,
  Zap,
  Filter,
  ArrowLeft,
  Home,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Destination, Hotel, Product, B2BPackage, CityHub, Quotation } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { VISA_CATALOG, VisaProduct } from './B2BVisaView';
import { DestinationHubsContextView, HubProductsContextView } from './B2BContextualExplorer';
import { AddProductToQuoteModal } from './AddProductToQuoteModal';
import { AddHotelToQuoteModal } from './AddHotelToQuoteModal';
import { AddVisaToQuoteModal } from './AddVisaToQuoteModal';

interface B2BHomeDiscoveryViewProps {
  destinations: Destination[];
  hotels: Hotel[];
  products: Product[];
  cityHubs: CityHub[];
  onNavigate: (tab: string, subTab?: string) => void;
  onOpenCreateQuoteWithDestination?: (destSlug: string) => void;
  onOpenPackageCustomizer?: (pkg: B2BPackage) => void;
  onViewProductDetails?: (prod: Product) => void;
  onViewHotelDetails?: (hotel: Hotel) => void;
  onViewPackageDetails?: (pkg: B2BPackage) => void;
  onOpenCalculator?: (prod: Product) => void;
  onItemAddedToQuote?: (itemName: string) => void;
}

export const B2BHomeDiscoveryView: React.FC<B2BHomeDiscoveryViewProps> = ({
  destinations = [],
  hotels = [],
  products = [],
  cityHubs = [],
  onNavigate,
  onOpenCreateQuoteWithDestination,
  onOpenPackageCustomizer,
  onViewProductDetails,
  onViewHotelDetails,
  onViewPackageDetails,
  onOpenCalculator,
  onItemAddedToQuote
}) => {
  const { user } = useAuth();
  const { items, addProductToQuote, removeProductFromQuote, currency } = useQuotation();
  const db = AppDatabase.getInstance();

  // Contextual Hierarchy Navigation State
  const [selectedDestinationContext, setSelectedDestinationContext] = useState<Destination | null>(null);
  const [selectedHubContext, setSelectedHubContext] = useState<CityHub | null>(null);
  const [hubProductSearch, setHubProductSearch] = useState('');
  const [hubCategoryFilter, setHubCategoryFilter] = useState<'ALL' | 'TOURS' | 'TRANSFERS' | 'GROUND' | 'HOTELS'>('ALL');
  const [hubSortBy, setHubSortBy] = useState<'POPULAR' | 'PRICE_LOW' | 'PRICE_HIGH' | 'NAME'>('POPULAR');

  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'ALL' | 'DESTINATIONS' | 'HUBS' | 'PRODUCTS' | 'HOTELS' | 'PACKAGES' | 'VISA'>('ALL');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Configuration Modal States
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [selectedHotelForModal, setSelectedHotelForModal] = useState<Hotel | null>(null);
  const [selectedVisaForModal, setSelectedVisaForModal] = useState<VisaProduct | null>(null);
  const [modalExistingItemId, setModalExistingItemId] = useState<string | undefined>(undefined);

  const handleOpenConfigureProduct = (prod: Product) => {
    const existing = items.find(it => it.product.id === prod.id || it.product.sku === prod.sku);
    setModalExistingItemId(existing?.id);
    setSelectedProductForModal(prod);
  };

  const handleOpenConfigureHotel = (hotel: Hotel) => {
    const existing = items.find(it => it.product.id === hotel.id || it.product.supplierProductCode === `SUP-HTL-${hotel.id}`);
    setModalExistingItemId(existing?.id);
    setSelectedHotelForModal(hotel);
  };

  const handleOpenConfigureVisa = (visa: VisaProduct) => {
    const existing = items.find(it => it.product.id === visa.id || it.product.id.includes(visa.id));
    setModalExistingItemId(existing?.id);
    setSelectedVisaForModal(visa);
  };

  const packages = useMemo(() => db.getPackages(), [db]);

  // Context Navigation Handlers
  const handleSelectDestinationForHubs = (dest: Destination) => {
    setSelectedDestinationContext(dest);
    setSelectedHubContext(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectHub = (hub: CityHub) => {
    // If destination context not set, resolve from hub
    if (!selectedDestinationContext) {
      const parentDest = destinations.find(d => 
        d.id === hub.destinationId || 
        d.name.toLowerCase() === (hub.destinationName || '').toLowerCase()
      );
      if (parentDest) setSelectedDestinationContext(parentDest);
    }
    setSelectedHubContext(hub);
    setHubProductSearch('');
    setHubCategoryFilter('ALL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToAllDestinations = () => {
    setSelectedDestinationContext(null);
    setSelectedHubContext(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToDestinationHubs = () => {
    setSelectedHubContext(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Master Search Categorization Engine
  const searchResults = useMemo(() => {
    const q = masterSearchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedDestinations = destinations.filter(d => 
      d.name.toLowerCase().includes(q) || 
      d.country.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );

    const matchedHubs = cityHubs.filter(h => 
      h.name.toLowerCase().includes(q) || 
      (h.destinationName && h.destinationName.toLowerCase().includes(q)) ||
      (h.stateProvince && h.stateProvince.toLowerCase().includes(q))
    );

    const matchedProducts = products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );

    const matchedHotels = hotels.filter(h => 
      h.name.toLowerCase().includes(q) ||
      (h.cityName && h.cityName.toLowerCase().includes(q)) ||
      (h.city && h.city.toLowerCase().includes(q))
    );

    const matchedPackages = packages.filter(pkg => 
      pkg.title.toLowerCase().includes(q) ||
      pkg.destinationName.toLowerCase().includes(q) ||
      pkg.tagline.toLowerCase().includes(q) ||
      pkg.routeSummary.some(r => r.toLowerCase().includes(q))
    );

    const matchedVisas = VISA_CATALOG.filter(v => 
      v.country.toLowerCase().includes(q) ||
      v.visaType.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q)
    );

    const totalCount = 
      matchedDestinations.length + 
      matchedHubs.length + 
      matchedProducts.length + 
      matchedHotels.length + 
      matchedPackages.length + 
      matchedVisas.length;

    return {
      destinations: matchedDestinations,
      hubs: matchedHubs,
      products: matchedProducts,
      hotels: matchedHotels,
      packages: matchedPackages,
      visas: matchedVisas,
      totalCount
    };
  }, [masterSearchQuery, destinations, cityHubs, products, hotels, packages]);

  // Real Count Calculation Helper per Destination
  const getDestinationMetrics = (destName: string, destId: string) => {
    const destNameLower = destName.toLowerCase();
    
    // Hubs count
    const destHubs = cityHubs.filter(h => 
      h.destinationId === destId || 
      (h.destinationName && h.destinationName.toLowerCase() === destNameLower)
    );

    // Products count
    const destProducts = products.filter(p => 
      p.destinationId === destId || 
      p.destinationName.toLowerCase().includes(destNameLower) ||
      p.country.toLowerCase().includes(destNameLower)
    );

    // Hotels count
    const destHotels = hotels.filter(h => 
      h.destinationId === destId || 
      (h.cityName && destProducts.some(p => p.city.toLowerCase() === h.cityName.toLowerCase()))
    );

    return {
      hubsCount: destHubs.length > 0 ? destHubs.length : Math.max(1, destProducts.reduce((acc, p) => p.city ? acc.add(p.city) : acc, new Set()).size),
      productsCount: destProducts.length,
      hotelsCount: destHotels.length
    };
  };

  // Real Count Helper per Hub
  const getHubMetrics = (hub: CityHub) => {
    const hubNameLower = hub.name.toLowerCase();
    const hubProducts = products.filter(p => 
      p.hubId === hub.id || 
      (p.city && p.city.toLowerCase() === hubNameLower)
    );
    const hubHotels = hotels.filter(h => 
      h.cityHubId === hub.id || 
      (h.cityName && h.cityName.toLowerCase() === hubNameLower) ||
      (h.city && h.city.toLowerCase() === hubNameLower)
    );
    return {
      productsCount: hubProducts.length,
      hotelsCount: hubHotels.length
    };
  };

  const isProductInQuote = (productId: string) => items.some(it => it.product.id === productId);
  const isHotelInQuote = (hotelId: string) => items.some(it => it.product.id === hotelId);

  const toggleProduct = (prod: Product) => {
    const existing = items.find(it => it.product.id === prod.id);
    if (existing) {
      removeProductFromQuote(existing.id);
    } else {
      addProductToQuote(prod, { adults: 2, children: 0, infants: 0 });
    }
  };

  const toggleHotel = (hotel: Hotel) => {
    const existing = items.find(it => it.product.id === hotel.id);
    if (existing) {
      removeProductFromQuote(existing.id);
    } else {
      const room = hotel.roomTypes?.[0];
      const rateUSD = room?.rates?.[0]?.adultNettCost || room?.rates?.[0]?.doubleNetRate || 380;
      const hotelProd: Product = {
        id: hotel.id,
        sku: `HTL-${hotel.id}`,
        destinationId: hotel.destinationId || 'dest-japan',
        destinationName: 'Contracted Property',
        country: hotel.cityName || 'Japan',
        city: hotel.cityName || 'Tokyo',
        productType: 'Hotel',
        name: `${hotel.name} (${room?.roomName || 'Deluxe Room'})`,
        shortDescription: hotel.shortDescription || '5-Star Luxury Accommodation',
        longDescription: hotel.shortDescription || '',
        supplierId: 'sup-hotel',
        supplierName: hotel.name,
        supplierProductCode: `SUP-HTL-${hotel.id}`,
        category: 'Travel Services',
        subcategory: 'Luxury Stay',
        duration: 'Per Night',
        operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        operatingHours: '24/7 Concierge',
        adultNetPrice: rateUSD,
        childNetPrice: 0,
        infantNetPrice: 0,
        currency: 'USD',
        defaultMarkupPercent: 15,
        taxPercent: 10,
        commissionPercent: 10,
        serviceFeeFixed: 0,
        sellingPriceStartingFrom: rateUSD * 1.2,
        season: 'All Year',
        validityFrom: '2025-01-01',
        validityTo: '2026-12-31',
        minPax: 1,
        maxPax: 4,
        availability: 'INSTANT',
        bookingRequiredDays: 1,
        cancellationPolicy: 'Free cancellation up to 7 days prior.',
        inclusions: ['Daily Gourmet Breakfast', 'Complimentary High-Speed WiFi', 'Access to Health Club & Onsen'],
        exclusions: ['City Stay Taxes (payable on departure)', 'Personal Incidental Expenses'],
        importantInformation: ['Valid Passport Required at Check-in', 'Standard Check-in 15:00'],
        heroImage: hotel.heroImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop',
        galleryImages: hotel.galleryImages || [hotel.heroImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop']
      };
      addProductToQuote(hotelProd, { adults: 2, children: 0, infants: 0 });
      if (onItemAddedToQuote) onItemAddedToQuote(hotel.name);
    }
  };

  const FAQS = [
    {
      q: 'How do TheUnbound DMC wholesale contracted tariffs work?',
      a: 'All rates displayed in your B2B portal are net confidential wholesale contract rates directly negotiated with local hotels, chauffeured fleets, and licensed tour operators. You can freely set your client markup percentage or use suggested selling prices.'
    },
    {
      q: 'What is the guaranteed Ground Operations SLA?',
      a: 'Once a booking is submitted with traveler details and deposit proof, our local destination duty operations team confirms all hotel allotments, guides, and train passes within a strict 24–48 hour window and generates official DMC service vouchers.'
    },
    {
      q: 'Can I export white-label proposal PDFs for my clients?',
      a: 'Yes! The Quotation Builder allows you to download clean, professionally formatted client proposals featuring your agency branding, itemized day-wise schedules, photo galleries, and zero DMC wholesale pricing disclosures.'
    },
    {
      q: 'How are multi-currency payments and deposits handled?',
      a: 'We support instant settlement in USD, EUR, GBP, and JPY via corporate bank telegraphic transfer or secure payment gateways. Bookings can be secured with initial deposits while final balance deadlines align with ground cancellation cut-offs.'
    }
  ];

  // 1. Contextual View: Single Hub Selected -> Render Hub Products & Hotels
  if (selectedHubContext) {
    return (
      <HubProductsContextView
        hub={selectedHubContext}
        destinationName={selectedDestinationContext?.name}
        allProducts={products}
        allHotels={hotels}
        onBackToDestination={handleBackToDestinationHubs}
        onBackToHome={handleBackToAllDestinations}
        onOpenCreateQuote={() => {
          if (selectedDestinationContext && onOpenCreateQuoteWithDestination) {
            onOpenCreateQuoteWithDestination(selectedDestinationContext.slug || selectedDestinationContext.id);
          } else {
            onNavigate('create-quote');
          }
        }}
        onViewProductDetails={onViewProductDetails}
        onViewHotelDetails={onViewHotelDetails}
        onOpenCalculator={onOpenCalculator}
        onItemAddedToQuote={onItemAddedToQuote}
      />
    );
  }

  // 2. Contextual View: Single Destination Selected -> Render Destination Hubs
  if (selectedDestinationContext) {
    return (
      <DestinationHubsContextView
        destination={selectedDestinationContext}
        allHubs={cityHubs}
        allProducts={products}
        allHotels={hotels}
        onSelectHub={handleSelectHub}
        onBackToHome={handleBackToAllDestinations}
        onOpenCreateQuote={(slug) => {
          if (onOpenCreateQuoteWithDestination) {
            onOpenCreateQuoteWithDestination(slug);
          } else {
            onNavigate('create-quote');
          }
        }}
        onNavigateToPackages={() => onNavigate('packages')}
        onViewProductDetails={onViewProductDetails}
        onViewHotelDetails={onViewHotelDetails}
        onOpenCalculator={onOpenCalculator}
        onItemAddedToQuote={onItemAddedToQuote}
      />
    );
  }

  return (
    <div className="space-y-12 pb-12">
      {/* 1. Welcome / Search Hero (Bright, spacious, trade-focused) */}
      <section className="bg-gradient-to-b from-teal-50/50 via-white to-slate-50/50 border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Trade Badge & Headline */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#00C6A6]/10 text-[#008a73] border border-[#00C6A6]/25 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>TheUnbound Wholesale Sourcing & DMC Desk</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 font-sans tracking-tight">
                Discover, Quote & Book <span className="text-[#00a88c]">Global Ground Logistics</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
                Instant wholesale tariffs, contracted 5-star properties, private chauffeured excursions, bullet train ticketing, and visa checklists across our dedicated destinations.
              </p>
            </div>

            {/* Quick Action Triggers */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={() => onNavigate('create-quote')}
                className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 px-5 py-3 rounded-2xl text-xs font-black transition-all shadow-md shadow-[#00C6A6]/20 hover:scale-[1.02] cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Quotation</span>
              </button>
              <button
                onClick={() => onNavigate('packages')}
                className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#00C6A6]" />
                <span>Ready-Made Packages</span>
              </button>
            </div>
          </div>

          {/* 2. MASTER SEARCH PANEL ("Search Everything") */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/50 p-4 sm:p-6 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Search className="w-4 h-4 text-[#00C6A6]" />
              <span>Search Everything (Destinations, Hubs, Tours, Hotels, Packages, Visas)</span>
            </div>

            {/* Input & Search Button */}
            <div className="relative flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search destinations (Japan, UK), cities (Tokyo, London), hotels, private day tours, rail passes, or visas..."
                  value={masterSearchQuery}
                  onChange={(e) => setMasterSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#00C6A6] rounded-2xl text-sm text-slate-900 font-medium outline-none transition-all placeholder:text-slate-400"
                />
                {masterSearchQuery && (
                  <button
                    onClick={() => setMasterSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 bg-slate-200/80 px-2 py-1 rounded-md"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  if (masterSearchQuery) {
                    // Stay on search result view
                  }
                }}
                className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shrink-0"
              >
                <span>Search Everything</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center flex-wrap gap-1.5 pt-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Filters:</span>
              {[
                { id: 'ALL', label: 'All Catalog' },
                { id: 'DESTINATIONS', label: 'Destinations', icon: Globe2 },
                { id: 'HUBS', label: 'City Hubs', icon: MapPin },
                { id: 'PRODUCTS', label: 'Tours & Activities', icon: ShoppingBag },
                { id: 'HOTELS', label: 'Hotels', icon: Building2 },
                { id: 'PACKAGES', label: 'Packages', icon: Layers },
                { id: 'VISA', label: 'Visa Desk', icon: FileCheck }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategoryFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center space-x-1.5 cursor-pointer text-xs ${
                    activeCategoryFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* LIVE MASTER SEARCH RESULTS DRAWER */}
            {searchResults && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Search Results ({searchResults.totalCount} matches found for "{masterSearchQuery}")
                  </span>
                  <span className="text-[11px] text-slate-400">Click any result to explore or quote</span>
                </div>

                {searchResults.totalCount === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <p className="text-sm font-bold text-slate-700">No matching items found for "{masterSearchQuery}".</p>
                    <p className="text-xs text-slate-500">Try searching for "Tokyo", "London", "Private Chauffeur", "5 Star", "Visa", or "Japan".</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Matched Destinations */}
                    {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'DESTINATIONS') && searchResults.destinations.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase">
                          <Globe2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                          <span>Destinations ({searchResults.destinations.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {searchResults.destinations.map(d => {
                            const metrics = getDestinationMetrics(d.name, d.id);
                            return (
                              <div
                                key={d.id}
                                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#00C6A6] transition-all flex items-center justify-between group"
                              >
                                <div>
                                  <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-[#00a88c] transition-colors">{d.name}</h4>
                                  <p className="text-[11px] text-slate-500">{metrics.hubsCount} Hubs • {metrics.productsCount} Products • {metrics.hotelsCount} Hotels</p>
                                </div>
                                <button
                                  onClick={() => onOpenCreateQuoteWithDestination ? onOpenCreateQuoteWithDestination(d.slug || d.id) : onNavigate('create-quote')}
                                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Quote →
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Matched Hubs */}
                    {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'HUBS') && searchResults.hubs.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          <span>City Hubs ({searchResults.hubs.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                          {searchResults.hubs.map(h => {
                            const metrics = getHubMetrics(h);
                            return (
                              <div
                                key={h.id}
                                onClick={() => onNavigate('products')}
                                className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-500 hover:bg-white transition-all cursor-pointer flex items-center justify-between"
                              >
                                <div>
                                  <h5 className="font-bold text-slate-900 text-xs">{h.name}</h5>
                                  <span className="text-[10px] text-slate-500">{h.destinationName} • {metrics.productsCount} Tours</span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Matched Products */}
                    {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'PRODUCTS') && searchResults.products.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase">
                          <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Wholesale Products & Tours ({searchResults.products.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {searchResults.products.slice(0, 6).map(p => {
                            const inQuote = isProductInQuote(p.id);
                            return (
                              <div key={p.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500 transition-all flex flex-col justify-between space-y-2">
                                <div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                    <span className="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">{p.category}</span>
                                    <span>{p.city}, {p.country}</span>
                                  </div>
                                  <h5 className="font-bold text-slate-900 text-xs leading-snug line-clamp-1">{p.name}</h5>
                                  <span className="text-xs font-mono font-extrabold text-slate-900 block mt-1">
                                    Net {formatCurrency(p.adultNetPrice, currency)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1.5 pt-1">
                                  <button
                                    onClick={() => handleOpenConfigureProduct(p)}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                                      inQuote ? 'bg-emerald-600 text-white' : 'bg-[#00C6A6] text-slate-950 hover:bg-[#00b395]'
                                    }`}
                                  >
                                    {inQuote ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                    <span>{inQuote ? 'In Cart (Edit)' : 'Configure & Add to Cart'}</span>
                                  </button>
                                  <button
                                    onClick={() => onViewProductDetails ? onViewProductDetails(p) : onNavigate('products')}
                                    className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                                    title="View Product Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Matched Hotels */}
                    {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'HOTELS') && searchResults.hotels.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase">
                          <Building2 className="w-3.5 h-3.5 text-amber-500" />
                          <span>Hotels ({searchResults.hotels.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {searchResults.hotels.slice(0, 6).map(h => {
                            const inQuote = isHotelInQuote(h.id);
                            return (
                              <div key={h.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-500 transition-all flex flex-col justify-between space-y-2">
                                <div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                    <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">{h.starRating}★ Hotel</span>
                                    <span>{h.cityName || h.city}</span>
                                  </div>
                                  <h5 className="font-bold text-slate-900 text-xs line-clamp-1">{h.name}</h5>
                                  <span className="text-[11px] text-slate-500 block">{h.shortDescription || 'Wholesale allotment available'}</span>
                                </div>
                                <div className="flex items-center space-x-1.5 pt-1">
                                  <button
                                    onClick={() => handleOpenConfigureHotel(h)}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                                      inQuote ? 'bg-emerald-600 text-white' : 'bg-[#00C6A6] text-slate-950 hover:bg-[#00b395]'
                                    }`}
                                  >
                                    {inQuote ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                    <span>{inQuote ? 'In Cart (Edit)' : 'Configure & Add to Cart'}</span>
                                  </button>
                                  <button
                                    onClick={() => onViewHotelDetails ? onViewHotelDetails(h) : onNavigate('hotels')}
                                    className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Matched Visas */}
                    {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'VISA') && searchResults.visas.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase">
                          <FileCheck className="w-3.5 h-3.5 text-teal-500" />
                          <span>Visas ({searchResults.visas.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {searchResults.visas.slice(0, 3).map(v => {
                            const inQuote = items.some(it => it.product.id === v.id || it.product.id.includes(v.id));
                            return (
                              <div key={v.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-500 transition-all flex flex-col justify-between space-y-2">
                                <div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                    <span className="font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">{v.country}</span>
                                    <span>{v.embassySubmissionType}</span>
                                  </div>
                                  <h5 className="font-bold text-slate-900 text-xs line-clamp-1">{v.visaType}</h5>
                                  <span className="text-[11px] text-slate-500 block">{v.processingTimeDays}</span>
                                </div>
                                <div className="flex items-center space-x-1.5 pt-1">
                                  <button
                                    onClick={() => handleOpenConfigureVisa(v)}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                                      inQuote ? 'bg-emerald-600 text-white' : 'bg-[#00C6A6] text-slate-950 hover:bg-[#00b395]'
                                    }`}
                                  >
                                    {inQuote ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                    <span>{inQuote ? 'In Cart (Edit)' : 'Configure & Add to Cart'}</span>
                                  </button>
                                  <button
                                    onClick={() => onNavigate('visa')}
                                    className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Matched Packages */}
                    {(activeCategoryFilter === 'ALL' || activeCategoryFilter === 'PACKAGES') && searchResults.packages.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase">
                          <Layers className="w-3.5 h-3.5 text-purple-500" />
                          <span>Ready-Made Packages ({searchResults.packages.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {searchResults.packages.slice(0, 3).map(pkg => (
                            <div key={pkg.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-purple-500 transition-all flex flex-col justify-between space-y-2">
                              <div>
                                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                                  {pkg.durationDays}D / {pkg.durationNights}N • {pkg.destinationName}
                                </span>
                                <h5 className="font-bold text-slate-900 text-xs mt-1.5 line-clamp-1">{pkg.title}</h5>
                                <p className="text-[11px] text-slate-500 line-clamp-1">{pkg.tagline}</p>
                              </div>
                              <div className="flex items-center space-x-2 pt-1">
                                <button
                                  onClick={() => onOpenPackageCustomizer ? onOpenPackageCustomizer(pkg) : onNavigate('create-quote')}
                                  className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-[11px] font-bold transition-all cursor-pointer"
                                >
                                  Customize Package
                                </button>
                                <button
                                  onClick={() => onViewPackageDetails ? onViewPackageDetails(pkg) : onNavigate('packages')}
                                  className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Container for Discovery Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">

        {/* 3. EXPLORE DESTINATIONS SECTION */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold text-[#00a88c] uppercase tracking-wider flex items-center space-x-1.5">
                <Globe2 className="w-3.5 h-3.5" />
                <span>Primary Operational Territories</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans mt-0.5">Explore Destinations</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Direct ground office coverage, wholesale contracted allotments, and licensed bilingual guides.
              </p>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900 hover:text-[#00C6A6] transition-colors cursor-pointer shrink-0"
            >
              <span>View All Inventory</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {destinations.map(dest => {
              const metrics = getDestinationMetrics(dest.name, dest.id);
              return (
                <div
                  key={dest.id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-[#00C6A6] transition-all flex flex-col overflow-hidden group"
                >
                  {/* Destination Image */}
                  <div className="relative h-56 overflow-hidden bg-slate-100">
                    <img
                      src={dest.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
                      alt={dest.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent"></div>

                    {/* Top Badges */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-xs text-white text-[11px] font-bold">
                        {dest.country}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#00C6A6] text-slate-950 text-[10px] font-black uppercase">
                        Active DMC Office
                      </span>
                    </div>

                    {/* Bottom Title & Counts */}
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <h3 className="text-2xl font-black text-white font-sans drop-shadow-xs">{dest.name}</h3>
                      <p className="text-xs text-slate-200 flex items-center space-x-3 mt-1 font-mono font-medium">
                        <span>{metrics.hubsCount} Hubs</span>
                        <span>•</span>
                        <span>{metrics.productsCount} Products</span>
                        <span>•</span>
                        <span>{metrics.hotelsCount} Hotels</span>
                      </p>
                    </div>
                  </div>

                  {/* Body & Actions */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {dest.description || `Comprehensive luxury DMC services, private excursions, and 5-star contracted inventory across ${dest.name}.`}
                    </p>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => onOpenCreateQuoteWithDestination ? onOpenCreateQuoteWithDestination(dest.slug || dest.id) : onNavigate('create-quote')}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 font-black text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Create Quote</span>
                      </button>

                      <button
                        onClick={() => handleSelectDestinationForHubs(dest)}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <span>Explore Hubs</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. EXPLORE HUBS SECTION */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>Operational City Gateways</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans mt-0.5">Explore City Hubs</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Targeted regional logistics, private airport fast-tracks, and local concierge stations.
              </p>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
            >
              <span>Browse All Hub Products</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {cityHubs.slice(0, 12).map(hub => {
              const metrics = getHubMetrics(hub);
              return (
                <div
                  key={hub.id}
                  onClick={() => handleSelectHub(hub)}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {hub.destinationName || 'Destination'}
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                      {hub.name}
                    </h4>
                  </div>
                  <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{metrics.productsCount} Tours</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. FEATURED HOTELS SECTION */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Wholesale Luxury Allotments</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans mt-0.5">Featured Contracted Hotels</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                5★ Luxury Ryokans, Manor Houses, and Grand City Hotels with guaranteed wholesale allotments.
              </p>
            </div>
            <button
              onClick={() => onNavigate('hotels')}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900 hover:text-amber-600 transition-colors cursor-pointer shrink-0"
            >
              <span>View All Hotels ({hotels.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {hotels.slice(0, 4).map(hotel => {
              const inQuote = isHotelInQuote(hotel.id);
              const room = hotel.roomTypes?.[0];
              const rateUSD = room?.rates?.[0]?.adultNettCost || room?.rates?.[0]?.doubleNetRate || 380;
              return (
                <div
                  key={hotel.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-amber-500 hover:shadow-md transition-all flex flex-col overflow-hidden group"
                >
                  {/* Image */}
                  <div className="relative h-44 overflow-hidden bg-slate-100">
                    <img
                      src={hotel.heroImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop'}
                      alt={hotel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-bold">
                      {hotel.cityName || hotel.city}
                    </div>
                    <div className="absolute top-3 right-3 bg-amber-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center space-x-0.5">
                      <Star className="w-3 h-3 fill-slate-950" />
                      <span>{hotel.starRating}★</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm line-clamp-1">{hotel.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {hotel.shortDescription || 'Gourmet breakfast included • Concierge access'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">B2B Net / Night</span>
                        <span className="text-sm font-extrabold text-slate-900 font-mono">
                          {formatCurrency(rateUSD, currency)}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Instant SLA
                      </span>
                    </div>

                    {/* 3 Clear Actions */}
                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={() => handleOpenConfigureHotel(hotel)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs ${
                          inQuote
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#00C6A6] hover:bg-[#00b395] text-slate-950'
                        }`}
                      >
                        {inQuote ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{inQuote ? 'In Cart (Edit Stay)' : 'Configure & Add to Cart'}</span>
                      </button>

                      <button
                        onClick={() => onViewHotelDetails ? onViewHotelDetails(hotel) : onNavigate('hotels')}
                        className="w-full py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View Hotel Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 6. READY-MADE PACKAGES SECTION */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Turnkey Tour Circuits</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-sans mt-0.5">Ready-Made Packages</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete multi-city circuits with Shinkansen passes, 5★ properties, and private guide manifests.
              </p>
            </div>
            <button
              onClick={() => onNavigate('packages')}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900 hover:text-purple-600 transition-colors cursor-pointer shrink-0"
            >
              <span>Explore All Packages ({packages.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.slice(0, 3).map(pkg => (
              <div
                key={pkg.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-purple-500 transition-all flex flex-col overflow-hidden group"
              >
                {/* Hero Image */}
                <div className="relative h-48 overflow-hidden bg-slate-100">
                  <img
                    src={pkg.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
                    alt={pkg.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>

                  <div className="absolute top-3 left-3 bg-purple-900/90 backdrop-blur-xs text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    {pkg.destinationName}
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="text-[11px] font-bold text-[#00E5C0]">
                      {pkg.durationDays} Days / {pkg.durationNights} Nights
                    </span>
                    <h3 className="text-base font-black text-white font-sans line-clamp-1 drop-shadow-xs mt-0.5">
                      {pkg.title}
                    </h3>
                  </div>
                </div>

                {/* Body & Actions */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.routeSummary.map((r, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {r}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {pkg.tagline || pkg.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Wholesale Tariff / Pax</span>
                      <span className="text-base font-extrabold text-slate-900 font-mono">
                        {formatCurrency(pkg.baseNetCostUSD, currency)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 font-mono">
                      Rec. {formatCurrency(pkg.suggestedSellingPriceUSD, currency)}
                    </span>
                  </div>

                  {/* Actions: View Package & Customize */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => onOpenPackageCustomizer ? onOpenPackageCustomizer(pkg) : onNavigate('create-quote')}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 font-black text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Customize in Quote Builder</span>
                    </button>

                    <button
                      onClick={() => onViewPackageDetails ? onViewPackageDetails(pkg) : onNavigate('packages')}
                      className="w-full py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-300" />
                      <span>View Itinerary</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7. FAQS SECTION */}
        <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 flex items-center justify-center text-[#00a88c]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 font-sans">B2B Agent & Travel Trade FAQs</h3>
              <p className="text-xs text-slate-500">Key questions on wholesale contracting, operational SLAs, and white-label proposals.</p>
            </div>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="rounded-2xl border border-slate-200/80 overflow-hidden transition-all">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between bg-slate-50 hover:bg-slate-100/70 transition-colors font-bold text-xs text-slate-900 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#00a88c] shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100 animate-in fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Configuration Modals */}
      <AddProductToQuoteModal
        product={selectedProductForModal}
        existingItemId={modalExistingItemId}
        isOpen={Boolean(selectedProductForModal)}
        onClose={() => {
          setSelectedProductForModal(null);
          setModalExistingItemId(undefined);
        }}
        onSuccess={(product) => {
          if (onItemAddedToQuote) onItemAddedToQuote(product.name);
        }}
      />

      <AddHotelToQuoteModal
        hotel={selectedHotelForModal}
        existingItemId={modalExistingItemId}
        isOpen={Boolean(selectedHotelForModal)}
        onClose={() => {
          setSelectedHotelForModal(null);
          setModalExistingItemId(undefined);
        }}
        onSuccess={(hotel) => {
          if (onItemAddedToQuote) onItemAddedToQuote(hotel.name);
        }}
      />

      <AddVisaToQuoteModal
        visa={selectedVisaForModal}
        existingItemId={modalExistingItemId}
        isOpen={Boolean(selectedVisaForModal)}
        onClose={() => {
          setSelectedVisaForModal(null);
          setModalExistingItemId(undefined);
        }}
        onSuccess={(visa) => {
          if (onItemAddedToQuote) onItemAddedToQuote(`${visa.country} ${visa.visaType}`);
        }}
      />
    </div>
  );
};
