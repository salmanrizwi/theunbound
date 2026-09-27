import React, { useState, useMemo } from 'react';
import { 
  Destination, 
  Hotel, 
  Product, 
  CityHub, 
  B2BPackage, 
  Quotation 
} from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { 
  Home, 
  ChevronRight, 
  ArrowLeft, 
  MapPin, 
  Building2, 
  ShoppingBag, 
  Search, 
  SlidersHorizontal, 
  Check, 
  Plus, 
  Eye, 
  BookmarkCheck, 
  Sparkles, 
  Clock, 
  Star, 
  PlusCircle, 
  ShieldCheck, 
  Plane,
  Layers,
  ArrowRight
} from 'lucide-react';
import { GlobalConfiguratorRouter } from '../Configurators/GlobalConfiguratorRouter';
import { AddHotelToQuoteModal } from './AddHotelToQuoteModal';

interface DestinationHubsViewProps {
  destination: Destination;
  allHubs: CityHub[];
  allProducts: Product[];
  allHotels: Hotel[];
  onSelectHub: (hub: CityHub) => void;
  onBackToHome: () => void;
  onOpenCreateQuote: (destSlug: string) => void;
  onNavigateToPackages: () => void;
  onViewProductDetails?: (prod: Product) => void;
  onViewHotelDetails?: (hotel: Hotel) => void;
  onOpenCalculator?: (prod: Product) => void;
  onItemAddedToQuote?: (name: string) => void;
}

export const DestinationHubsContextView: React.FC<DestinationHubsViewProps> = ({
  destination,
  allHubs,
  allProducts,
  allHotels,
  onSelectHub,
  onBackToHome,
  onOpenCreateQuote,
  onNavigateToPackages,
  onViewProductDetails,
  onViewHotelDetails,
  onOpenCalculator,
  onItemAddedToQuote
}) => {
  const { items, addProductToQuote, currency } = useQuotation();

  // Configuration Modal States
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [selectedHotelForModal, setSelectedHotelForModal] = useState<Hotel | null>(null);
  const [modalExistingItemId, setModalExistingItemId] = useState<string | undefined>(undefined);

  const handleOpenConfigureProduct = (prod: Product) => {
    const existing = items.find(it => it.product.sku === prod.sku || it.product.id === prod.id);
    setModalExistingItemId(existing?.id);
    setSelectedProductForModal(prod);
  };

  const handleOpenConfigureHotel = (hotel: Hotel) => {
    const existing = items.find(it => it.product.id === hotel.id || it.product.supplierProductCode === `SUP-HTL-${hotel.id}`);
    setModalExistingItemId(existing?.id);
    setSelectedHotelForModal(hotel);
  };

  // Filter hubs for this destination
  const hubs = useMemo(() => {
    return allHubs.filter(h => 
      h.destinationId === destination.id ||
      (h.destinationName && h.destinationName.toLowerCase() === destination.name.toLowerCase()) ||
      (destination.name.toLowerCase().includes(h.destinationName || ''))
    );
  }, [allHubs, destination]);

  // Filter products for this destination
  const destinationProducts = useMemo(() => {
    return allProducts.filter(p => 
      p.destinationName.toLowerCase().includes(destination.name.toLowerCase()) ||
      p.country.toLowerCase().includes(destination.country.toLowerCase())
    );
  }, [allProducts, destination]);

  // Filter hotels for this destination
  const destinationHotels = useMemo(() => {
    return allHotels.filter(h => 
      (h.cityName && destination.name.toLowerCase().includes(h.cityName.toLowerCase())) ||
      (h.city && destination.name.toLowerCase().includes(h.city.toLowerCase())) ||
      (h.country && h.country.toLowerCase().includes(destination.country.toLowerCase()))
    );
  }, [allHotels, destination]);

  const isProductInQuote = (sku: string) => items.some(item => item.product.sku === sku);
  const isHotelInQuote = (hotelId: string) => items.some(item => item.product.supplierProductCode === `SUP-HTL-${hotelId}` || item.product.id === hotelId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-in fade-in duration-300">
      {/* 1. Context Breadcrumb & Back Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <nav className="flex items-center space-x-2 text-xs font-bold text-slate-500">
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-1 hover:text-[#00C6A6] transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Discovery Home</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-extrabold">{destination.name}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-extrabold">Operational City Hubs</span>
        </nav>

        <button
          onClick={onBackToHome}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Destinations</span>
        </button>
      </div>

      {/* 2. Destination Hero Header Card */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-xl border border-slate-800">
        <div className="relative h-64 sm:h-72 w-full">
          <img
            src={destination.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop'}
            alt={destination.name}
            className="w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        </div>

        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-slate-800/90 text-slate-200 text-xs font-bold backdrop-blur-xs">
                {destination.country}
              </span>
              <span className="px-3 py-1 rounded-full bg-[#00C6A6] text-slate-950 text-xs font-black uppercase tracking-wider">
                Direct DMC Desk
              </span>
            </div>
            <div className="hidden sm:flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-white text-xs font-mono font-medium">
                SLA: 24h Confirmation
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white font-sans tracking-tight">
                {destination.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 max-w-3xl mt-1 leading-relaxed line-clamp-2">
                {destination.description || `Contracted wholesale inventory, bilingual licensed guides, and private transport fleet across ${destination.name}.`}
              </p>
            </div>

            {/* Quick Metrics & CTA */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/15">
              <div className="flex items-center space-x-4 text-xs font-mono text-slate-200">
                <span className="flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#00E5C0]" />
                  <strong className="text-white">{hubs.length}</strong> City Hubs
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#00E5C0]" />
                  <strong className="text-white">{destinationProducts.length}</strong> Products
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#00E5C0]" />
                  <strong className="text-white">{destinationHotels.length}</strong> 5★ Hotels
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onOpenCreateQuote(destination.slug || destination.id)}
                  className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create Quote for {destination.name}</span>
                </button>
                <button
                  onClick={onNavigateToPackages}
                  className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer backdrop-blur-xs"
                >
                  <Layers className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Packages</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational City Hubs Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 font-sans flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-teal-600" />
              <span>Operational City Hubs in {destination.name}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a gateway city to view targeted tours, airport transfers, day excursions, and hotel allotments.
            </p>
          </div>
        </div>

        {hubs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {hubs.map(hub => {
              const hubProds = allProducts.filter(p => p.city.toLowerCase().includes(hub.name.toLowerCase()));
              const hubHots = allHotels.filter(h => (h.cityName && h.cityName.toLowerCase().includes(hub.name.toLowerCase())) || (h.city && h.city.toLowerCase().includes(hub.name.toLowerCase())));
              return (
                <div
                  key={hub.id}
                  onClick={() => onSelectHub(hub)}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-[#00C6A6] hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                        {hub.stateProvince || destination.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {hub.airportCode || 'HUB'}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 group-hover:text-[#00a88c] transition-colors">
                      {hub.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {hub.description || `Full dispatch operations, private chauffeured transfers, and luxury accommodation inventory in ${hub.name}.`}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[11px] font-mono font-medium text-slate-600 space-x-2">
                      <span><strong>{hubProds.length}</strong> Tours</span>
                      <span>•</span>
                      <span><strong>{hubHots.length}</strong> Hotels</span>
                    </div>
                    <span className="text-xs font-black text-[#00a88c] flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                      <span>Explore</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">No standalone city hubs indexed for {destination.name}.</p>
            <p className="text-[11px] text-slate-400">You can still browse all destination-level products and hotels below.</p>
          </div>
        )}
      </section>

      {/* 4. Signature Products in this Destination */}
      {destinationProducts.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 font-sans flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                <span>Signature Tours & Activities in {destination.name} ({destinationProducts.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Contracted excursions, private guides, and cultural experiences ready to add to quotes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {destinationProducts.slice(0, 6).map(product => {
              const inQuote = isProductInQuote(product.sku);
              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="relative h-44 overflow-hidden bg-slate-100">
                    <img
                      src={product.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-bold">
                      {product.city}
                    </div>
                    <div className="absolute top-3 right-3 bg-emerald-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                      {product.availability || 'Instant'}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                        {product.category} • {product.duration}
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm mt-0.5 line-clamp-1">{product.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {product.shortDescription}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Final Selling Price</span>
                        <div className="flex items-baseline space-x-1">
                          <span className="text-sm font-extrabold text-slate-900 font-mono">
                            {formatCurrency(convertCurrency(product.sellingPriceStartingFrom, product.currency || 'USD', currency), currency)}
                          </span>
                          <span className="text-[10px] text-slate-400">/ person</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                        Authoritative
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={() => handleOpenConfigureProduct(product)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs ${
                          inQuote
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#00C6A6] hover:bg-[#00b395] text-slate-950'
                        }`}
                      >
                        {inQuote ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{inQuote ? 'In Cart (Edit)' : 'Configure & Add to Cart'}</span>
                      </button>

                      <button
                        onClick={() => onViewProductDetails && onViewProductDetails(product)}
                        className="w-full py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. 5-Star Hotels in this Destination */}
      {destinationHotels.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 font-sans flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                <span>Contracted Luxury Properties in {destination.name} ({destinationHotels.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                5★ Hotels, Manor Houses, and Ryokans with guaranteed wholesale allocations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {destinationHotels.slice(0, 3).map(hotel => {
              const inQuote = isHotelInQuote(hotel.id);
              const room = hotel.roomTypes?.[0];
              const rateUSD = room?.rates?.[0]?.adultNettCost || room?.rates?.[0]?.doubleNetRate || 380;
              return (
                <div
                  key={hotel.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
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

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm line-clamp-1">{hotel.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {hotel.shortDescription || 'Gourmet breakfast included • Concierge access'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Final Selling Price</span>
                        <div className="flex items-baseline space-x-1">
                          <span className="text-sm font-extrabold text-slate-900 font-mono">
                            {formatCurrency(convertCurrency(hotel.startingSellingPrice || Math.round(rateUSD * 1.25), hotel.currency || 'USD', currency), currency)}
                          </span>
                          <span className="text-[10px] text-slate-400">/ night</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Instant SLA
                      </span>
                    </div>

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
                        onClick={() => onViewHotelDetails && onViewHotelDetails(hotel)}
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
      )}

      {/* Dedicated Category Configurator Router */}
      <GlobalConfiguratorRouter
        itemOrProduct={selectedProductForModal}
        existingQuoteItemId={modalExistingItemId}
        isOpen={Boolean(selectedProductForModal)}
        portalOrigin="B2B_AGENT"
        onClose={() => {
          setSelectedProductForModal(null);
          setModalExistingItemId(undefined);
        }}
        onSuccess={(item) => {
          const name = item?.name || item?.product?.name || 'Service';
          if (onItemAddedToQuote) onItemAddedToQuote(name);
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
    </div>
  );
};

interface HubProductsViewProps {
  hub: CityHub;
  destinationName?: string;
  allProducts: Product[];
  allHotels: Hotel[];
  onBackToDestination: () => void;
  onBackToHome: () => void;
  onOpenCreateQuote: () => void;
  onViewProductDetails?: (prod: Product) => void;
  onViewHotelDetails?: (hotel: Hotel) => void;
  onOpenCalculator?: (prod: Product) => void;
  onItemAddedToQuote?: (name: string) => void;
}

export const HubProductsContextView: React.FC<HubProductsViewProps> = ({
  hub,
  destinationName,
  allProducts,
  allHotels,
  onBackToDestination,
  onBackToHome,
  onOpenCreateQuote,
  onViewProductDetails,
  onViewHotelDetails,
  onOpenCalculator,
  onItemAddedToQuote
}) => {
  const { items, addProductToQuote, currency } = useQuotation();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'TOURS' | 'TRANSFERS' | 'DAY_TRIPS' | 'HOTELS'>('ALL');
  const [sortBy, setSortBy] = useState<'POPULAR' | 'PRICE_LOW' | 'PRICE_HIGH' | 'NAME'>('POPULAR');

  // Configuration Modal States
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [selectedHotelForModal, setSelectedHotelForModal] = useState<Hotel | null>(null);
  const [modalExistingItemId, setModalExistingItemId] = useState<string | undefined>(undefined);

  const handleOpenConfigureProduct = (prod: Product) => {
    const existing = items.find(it => it.product.sku === prod.sku || it.product.id === prod.id);
    setModalExistingItemId(existing?.id);
    setSelectedProductForModal(prod);
  };

  const handleOpenConfigureHotel = (hotel: Hotel) => {
    const existing = items.find(it => it.product.id === hotel.id || it.product.supplierProductCode === `SUP-HTL-${hotel.id}`);
    setModalExistingItemId(existing?.id);
    setSelectedHotelForModal(hotel);
  };

  // Hub Products
  const hubProducts = useMemo(() => {
    return allProducts.filter(p => 
      p.city.toLowerCase().includes(hub.name.toLowerCase()) ||
      (p.destinationName && p.destinationName.toLowerCase().includes(hub.name.toLowerCase()))
    );
  }, [allProducts, hub]);

  // Hub Hotels
  const hubHotels = useMemo(() => {
    return allHotels.filter(h => 
      (h.cityName && h.cityName.toLowerCase().includes(hub.name.toLowerCase())) ||
      (h.city && h.city.toLowerCase().includes(hub.name.toLowerCase()))
    );
  }, [allHotels, hub]);

  // Counts
  const toursCount = hubProducts.filter(p => !p.category.toLowerCase().includes('transfer') && !p.subcategory.toLowerCase().includes('day trip')).length;
  const transfersCount = hubProducts.filter(p => p.category.toLowerCase().includes('transfer') || p.subcategory.toLowerCase().includes('transfer')).length;
  const dayTripsCount = hubProducts.filter(p => p.subcategory.toLowerCase().includes('day trip') || p.category.toLowerCase().includes('day trip')).length;

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let prods = hubProducts;
    if (categoryFilter === 'TOURS') {
      prods = prods.filter(p => !p.category.toLowerCase().includes('transfer') && !p.subcategory.toLowerCase().includes('day trip'));
    } else if (categoryFilter === 'TRANSFERS') {
      prods = prods.filter(p => p.category.toLowerCase().includes('transfer') || p.subcategory.toLowerCase().includes('transfer'));
    } else if (categoryFilter === 'DAY_TRIPS') {
      prods = prods.filter(p => p.subcategory.toLowerCase().includes('day trip') || p.category.toLowerCase().includes('day trip'));
    } else if (categoryFilter === 'HOTELS') {
      return [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      prods = prods.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.shortDescription.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'PRICE_LOW') {
      prods = [...prods].sort((a, b) => a.adultNetPrice - b.adultNetPrice);
    } else if (sortBy === 'PRICE_HIGH') {
      prods = [...prods].sort((a, b) => b.adultNetPrice - a.adultNetPrice);
    } else if (sortBy === 'NAME') {
      prods = [...prods].sort((a, b) => a.name.localeCompare(b.name));
    }

    return prods;
  }, [hubProducts, categoryFilter, searchQuery, sortBy]);

  // Filtered Hotels
  const filteredHotels = useMemo(() => {
    if (categoryFilter !== 'ALL' && categoryFilter !== 'HOTELS') return [];
    let hots = hubHotels;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      hots = hots.filter(h => h.name.toLowerCase().includes(q) || (h.shortDescription && h.shortDescription.toLowerCase().includes(q)));
    }
    return hots;
  }, [hubHotels, categoryFilter, searchQuery]);

  const isProductInQuote = (sku: string) => items.some(item => item.product.sku === sku);
  const isHotelInQuote = (hotelId: string) => items.some(item => item.product.supplierProductCode === `SUP-HTL-${hotelId}` || item.product.id === hotelId);

  const parentDest = destinationName || hub.destinationName || 'Destination';

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-in fade-in duration-300">
      {/* 1. Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <nav className="flex items-center space-x-2 text-xs font-bold text-slate-500">
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-1 hover:text-[#00C6A6] transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Discovery Home</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button
            onClick={onBackToDestination}
            className="hover:text-[#00C6A6] transition-colors cursor-pointer"
          >
            {parentDest}
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-extrabold">{hub.name} Inventory</span>
        </nav>

        <button
          onClick={onBackToDestination}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to {parentDest} Hubs</span>
        </button>
      </div>

      {/* 2. Hub Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00C6A6] text-slate-950 text-[10px] font-black uppercase tracking-wider">
              Gateway Hub Station
            </span>
            <span className="text-xs font-mono text-slate-300">
              {parentDest} • Airport Code: {hub.airportCode || 'HUB'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white font-sans tracking-tight">
            {hub.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {hub.description || `Direct ground operations, chauffeur dispatch, and 5-star contracted inventory in ${hub.name}.`}
          </p>
          <div className="flex items-center space-x-4 pt-2 text-xs font-mono text-slate-300">
            <span><strong>{hubProducts.length}</strong> Ground Products</span>
            <span>•</span>
            <span><strong>{hubHotels.length}</strong> Contracted Hotels</span>
            <span>•</span>
            <span className="text-[#00E5C0]">SLA: Instant Confirmation</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenCreateQuote}
            className="px-5 py-3 rounded-2xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Quote for {hub.name}</span>
          </button>
        </div>
      </div>

      {/* 3. Category Filter Pills & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All Inventory ({hubProducts.length + hubHotels.length})
            </button>
            <button
              onClick={() => setCategoryFilter('TOURS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'TOURS'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Tours & Excursions ({toursCount})
            </button>
            <button
              onClick={() => setCategoryFilter('TRANSFERS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'TRANSFERS'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Transfers & Rail ({transfersCount})
            </button>
            <button
              onClick={() => setCategoryFilter('DAY_TRIPS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'DAY_TRIPS'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Day Trips ({dayTripsCount})
            </button>
            <button
              onClick={() => setCategoryFilter('HOTELS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'HOTELS'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Hotels ({hubHotels.length})
            </button>
          </div>

          {/* Search & Sort */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${hub.name}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#00C6A6]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="POPULAR">Popular</option>
              <option value="PRICE_LOW">Price: Low → High</option>
              <option value="PRICE_HIGH">Price: High → Low</option>
              <option value="NAME">Name: A → Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Products & Hotels Grid */}
      <div className="space-y-6">
        {/* Products Grid */}
        {filteredProducts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
              <span>Ground Tours & Services ({filteredProducts.length})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map(product => {
                const inQuote = isProductInQuote(product.sku);
                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="relative h-44 overflow-hidden bg-slate-100">
                      <img
                        src={product.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-bold">
                        {product.city}
                      </div>
                      <div className="absolute top-3 right-3 bg-emerald-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                        {product.availability || 'Instant'}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                          {product.category} • {product.duration}
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-sm mt-0.5 line-clamp-1">{product.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {product.shortDescription}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Final Selling Price</span>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-sm font-extrabold text-slate-900 font-mono">
                              {formatCurrency(convertCurrency(product.sellingPriceStartingFrom, product.currency || 'USD', currency), currency)}
                            </span>
                            <span className="text-[10px] text-slate-400">/ person</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                          Authoritative
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <button
                          onClick={() => handleOpenConfigureProduct(product)}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs ${
                            inQuote
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#00C6A6] hover:bg-[#00b395] text-slate-950'
                          }`}
                        >
                          {inQuote ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          <span>{inQuote ? 'In Cart (Edit)' : 'Configure & Add to Cart'}</span>
                        </button>

                        <button
                          onClick={() => onViewProductDetails && onViewProductDetails(product)}
                          className="w-full py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hotels Grid */}
        {filteredHotels.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>Contracted Hotels in {hub.name} ({filteredHotels.length})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredHotels.map(hotel => {
                const inQuote = isHotelInQuote(hotel.id);
                const room = hotel.roomTypes?.[0];
                const rateUSD = room?.rates?.[0]?.adultNettCost || room?.rates?.[0]?.doubleNetRate || 380;
                return (
                  <div
                    key={hotel.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
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

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm line-clamp-1">{hotel.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {hotel.shortDescription || 'Gourmet breakfast included • Concierge access'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Final Selling Price</span>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-sm font-extrabold text-slate-900 font-mono">
                              {formatCurrency(convertCurrency(hotel.startingSellingPrice || Math.round(rateUSD * 1.25), hotel.currency || 'USD', currency), currency)}
                            </span>
                            <span className="text-[10px] text-slate-400">/ night</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          Instant SLA
                        </span>
                      </div>

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
                          onClick={() => onViewHotelDetails && onViewHotelDetails(hotel)}
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
          </div>
        )}

        {filteredProducts.length === 0 && filteredHotels.length === 0 && (
          <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-3">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-base font-extrabold text-slate-900">No inventory matched your search filter</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try resetting your category tab or clearing the search query to explore all products and hotels for {hub.name}.
            </p>
            <button
              onClick={() => {
                setCategoryFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Dedicated Category Configurator Router */}
      <GlobalConfiguratorRouter
        itemOrProduct={selectedProductForModal}
        existingQuoteItemId={modalExistingItemId}
        isOpen={Boolean(selectedProductForModal)}
        portalOrigin="B2B_AGENT"
        onClose={() => {
          setSelectedProductForModal(null);
          setModalExistingItemId(undefined);
        }}
        onSuccess={(item) => {
          const name = item?.name || item?.product?.name || 'Service';
          if (onItemAddedToQuote) onItemAddedToQuote(name);
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
    </div>
  );
};
