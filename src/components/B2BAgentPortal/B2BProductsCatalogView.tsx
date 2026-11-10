import React, { useState, useMemo, useEffect, ReactNode, ErrorInfo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  MapPin, 
  Clock, 
  Check, 
  Eye, 
  ShieldCheck, 
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  X,
  Users,
  Sparkles,
  ArrowRight,
  Trash2,
  RotateCcw,
  Calendar,
  AlertCircle,
  Compass,
  SlidersHorizontal,
  Layers,
  ChevronLeft
} from 'lucide-react';
import { Product, Destination, CityHub } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, calculateDeliveredPriceForUser } from '../../services/pricingEngine';
import { GlobalConfiguratorRouter } from '../Configurators/GlobalConfiguratorRouter';
import { isRailProduct } from '../../services/rail/JapanRailJourneyDataService';
import { AppDatabase } from '../../services/db';
import { canonicalImageService } from '../../services/imageService';
import { sanitizeImageUrl } from '../../utils/imageUtils';
import { B2BViewDetailsModal } from '../B2BViewDetailsModal';
import { inventoryDiscoveryService } from '../../services/inventoryDiscoveryService';

// Safely normalize any value to a lowercase trimmed string
const safeStr = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase();
};

interface ErrorBoundaryProps {
  children: ReactNode;
  onResetFilters?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ProductsModuleErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ProductsModuleErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onResetFilters) {
      this.props.onResetFilters();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full p-8 bg-white border border-rose-200 rounded-3xl shadow-lg my-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900 font-sans">
            Tours, Transfers & Ground Products Search Error
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            Something went wrong while rendering product search results ({this.state.error?.message || 'Unexpected Error'}).
          </p>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Filters & Retry</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface B2BProductsCatalogViewProps {
  products?: Product[];
  destinations?: Destination[];
  onOpenCreateQuote: () => void;
  onViewProductDetails?: (prod: Product) => void;
}

export const B2BProductsCatalogViewInner: React.FC<B2BProductsCatalogViewProps> = ({
  products = [],
  destinations = [],
  onOpenCreateQuote,
  onViewProductDetails
}) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER' || user?.role === 'DMC_STAFF';
  const { items, removeProductFromQuote, currency, setIsQuoteDrawerOpen } = useQuotation();
  const [dbTick, setDbTick] = useState(0);

  useEffect(() => {
    const unsubDb = db.subscribe(() => setDbTick(t => t + 1));
    const unsubImg = canonicalImageService.subscribe(() => setDbTick(t => t + 1));
    return () => {
      unsubDb();
      unsubImg();
    };
  }, [db]);

  // Canonical Master Data Collections
  const canonicalProducts = useMemo(() => {
    const freshDbProducts = db.getProducts();
    const raw = (freshDbProducts && freshDbProducts.length > 0) ? freshDbProducts : products;
    return (raw || []).filter(p => Boolean(p && typeof p === 'object' && p.id));
  }, [products, db, dbTick]);

  const canonicalDestinations = useMemo(() => {
    const freshDbDests = db.getDestinations();
    const raw = (freshDbDests && freshDbDests.length > 0) ? freshDbDests : destinations;
    return (raw || []).filter(d => Boolean(d && typeof d === 'object' && d.id));
  }, [destinations, db, dbTick]);

  const regions = useMemo(() => {
    return (db.getRegions() || []).filter(r => Boolean(r && typeof r === 'object' && r.id));
  }, [db, dbTick]);

  const cityHubs = useMemo(() => {
    return (db.getCityHubs() || []).filter(h => Boolean(h && typeof h === 'object' && h.id));
  }, [db, dbTick]);

  // Search-First State Management
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Search Filter Form States
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedHub, setSelectedHub] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Additional Advanced Filter States
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('ALL');
  const [fromHubId, setFromHubId] = useState<string>('ALL');
  const [toHubId, setToHubId] = useState<string>('ALL');

  // UI Presentation States
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [selectedProductForQuoteModal, setSelectedProductForQuoteModal] = useState<Product | null>(null);
  const [quoteSuccessNotification, setQuoteSuccessNotification] = useState<{ product: Product; details: any } | null>(null);

  // Available Hubs cascading dynamically based on selected Destination
  const availableHubs = useMemo(() => {
    if (!selectedDestination || selectedDestination === 'ALL') {
      return cityHubs;
    }
    return cityHubs.filter(h => {
      const hDestId = safeStr(h.destinationId);
      const target = safeStr(selectedDestination);
      const destObj = canonicalDestinations.find(d => d.id === selectedDestination);
      const targetName = destObj ? safeStr(destObj.name) : target;
      return hDestId === target || safeStr(h.name).includes(targetName);
    });
  }, [cityHubs, selectedDestination, canonicalDestinations]);

  // Reset Hub when Destination changes if the Hub does not belong to the selected Destination
  useEffect(() => {
    if (selectedDestination !== 'ALL' && selectedHub !== 'ALL') {
      const isHubValid = availableHubs.some(h => h.id === selectedHub);
      if (!isHubValid) {
        setSelectedHub('ALL');
      }
    }
  }, [selectedDestination, availableHubs, selectedHub]);

  // Canonical Unique Categories extracted safely
  const categories = useMemo(() => {
    const set = new Set<string>();
    canonicalProducts.forEach(p => {
      if (p && p.category) {
        set.add(String(p.category));
      }
    });
    return Array.from(set).sort();
  }, [canonicalProducts]);

  // Search Results using InventoryDiscoveryService
  const searchResult = useMemo(() => {
    if (!hasSearched) {
      return {
        items: [] as Product[],
        totalCount: 0,
        page: 1,
        pageSize,
        totalPages: 1,
        hasMore: false,
        filtersApplied: {}
      };
    }

    return inventoryDiscoveryService.searchProducts(
      {
        destinationId: selectedDestination,
        hubId: selectedHub,
        date: selectedDate,
        category: selectedCategory,
        searchQuery: searchQuery,
        page: currentPage,
        pageSize
      },
      canonicalProducts
    );
  }, [
    hasSearched,
    selectedDestination,
    selectedHub,
    selectedDate,
    selectedCategory,
    searchQuery,
    currentPage,
    canonicalProducts,
    pageSize
  ]);

  // Execute Search Handler
  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    setCurrentPage(1);
    setHasSearched(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 200);
  };

  // Reset / Clear Filters Handler
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDestination('ALL');
    setSelectedHub('ALL');
    setSelectedCategory('ALL');
    setSelectedDate('');
    setAdults(2);
    setChildren(0);
    setSelectedVehicle('ALL');
    setFromHubId('ALL');
    setToHubId('ALL');
    setHasSearched(false);
    setCurrentPage(1);
  };

  const isProductInQuote = (productId: string) => {
    return (items || []).some(it => it.product && it.product.id === productId);
  };

  const handleOpenProductDetails = (prod: Product) => {
    if (onViewProductDetails) {
      onViewProductDetails(prod);
    } else {
      setSelectedProductDetails(prod);
    }
  };

  const handleOpenAddProductModal = (prod: Product) => {
    setSelectedProductForQuoteModal(prod);
  };

  const handleRemoveFromQuote = (productId: string) => {
    const existing = (items || []).find(it => it.product && it.product.id === productId);
    if (existing) {
      removeProductFromQuote(existing.id);
    }
  };

  const hasActiveFilters = 
    selectedDestination !== 'ALL' ||
    selectedHub !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedDate !== '' ||
    searchQuery.trim() !== '';

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00C6A6]/10 text-[#00a88c] border border-[#00C6A6]/20 text-[10px] font-bold uppercase tracking-wider">
              Search-First Inventory Discovery
            </span>
            <span className="text-xs text-slate-400 font-mono">({canonicalProducts.length} Contracted Wholesale SKUs)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Tours, Transfers & Ground Products</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Query private tours, chauffeured excursions, bullet train tickets, and VIP museum entries across all destinations.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <span>Open Quotation Builder ({(items || []).length} in Quote)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Success Notification Banner */}
      {quoteSuccessNotification && (
        <div className="bg-teal-900 text-white px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg border border-[#00C6A6]/40 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#00C6A6] text-slate-950 flex items-center justify-center font-bold">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {quoteSuccessNotification.product.name} added to Cart!
              </div>
              <div className="text-[11px] text-[#00E5C0]">
                Scheduled for {quoteSuccessNotification.details?.travelDate || 'Selected Date'} ({quoteSuccessNotification.details?.adults || 2} Adults).
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsQuoteDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>View Cart</span>
            </button>
            <button
              onClick={() => setQuoteSuccessNotification(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Search-First Query Panel */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#00a88c] flex items-center justify-center font-bold">
              <Search className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Search Products & Tours</h2>
              <p className="text-[11px] text-slate-500">Filter by destination, hub, travel date and category</p>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        <form onSubmit={handleExecuteSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Filter 1: Destination */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-[#00C6A6]" />
                <span>Destination</span>
              </label>
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#00C6A6] focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">All Destinations</option>
                {canonicalDestinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Filter 2: Hub (cascading from Destination) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Compass className="w-3 h-3 text-[#00C6A6]" />
                <span>Hub / City</span>
              </label>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#00C6A6] focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">All Hubs in Destination</option>
                {availableHubs.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            {/* Filter 3: Travel Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-[#00C6A6]" />
                <span>Service Date</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
              />
            </div>

            {/* Filter 4: Product Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Layers className="w-3 h-3 text-[#00C6A6]" />
                <span>Category</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#00C6A6] focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Primary Action Button */}
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center justify-center space-x-2"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Products</span>
              </button>
            </div>
          </div>

          {/* Quick Keyword & Advanced Search Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Quick keyword search (e.g. Fuji, Tea Ceremony, Private Shinkansen, Limousine, teamLab)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                  isAdvancedFiltersOpen || adults !== 2 || selectedVehicle !== 'ALL'
                    ? 'bg-teal-50 text-[#008f77] border-[#00C6A6]'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>More Filters</span>
                {isAdvancedFiltersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Collapsible Advanced Filters */}
          {isAdvancedFiltersOpen && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                  <Users className="w-3 h-3 text-[#00C6A6]" />
                  <span>Passengers (Adults)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Children (Under 12)
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Vehicle / Fleet Class
                </label>
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:border-[#00C6A6]"
                >
                  <option value="ALL">Any Fleet Class</option>
                  <option value="SEDAN">Luxury Sedan (Alphard / Crown)</option>
                  <option value="VAN">Executive HiAce Van</option>
                  <option value="COACH">VIP Microbus / Coach</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* STATE 1: INITIAL SEARCH-FIRST EMPTY STATE (User has not yet triggered a search) */}
      {!hasSearched && (
        <div className="bg-white rounded-3xl p-10 md:p-14 text-center border border-slate-200/90 shadow-xs space-y-6 max-w-2xl mx-auto my-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-3xl bg-[#00C6A6]/10 text-[#00a88c] flex items-center justify-center mx-auto border border-[#00C6A6]/20">
            <Compass className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 font-sans tracking-tight">
              Search destinations, hubs and experiences to discover available products.
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-lg mx-auto">
              Select your client's intended destination, city hub, service date, or experience category above to load contracted wholesale inventory instantly.
            </p>
          </div>

          {/* Quick-Start Destination Shortcuts */}
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              Popular Destinations & Hubs
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canonicalDestinations.slice(0, 6).map(dest => (
                <button
                  key={dest.id}
                  onClick={() => {
                    setSelectedDestination(dest.id);
                    setIsSearching(true);
                    setHasSearched(true);
                    setCurrentPage(1);
                    setTimeout(() => setIsSearching(false), 200);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-[#00C6A6] hover:text-slate-950 border border-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <MapPin className="w-3 h-3 text-[#00C6A6]" />
                  <span>{dest.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STATE 2: SEARCH RESULTS (User has executed a search) */}
      {hasSearched && (
        <div className="space-y-5">
          {/* Results Summary Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Found</span>
              <span className="text-sm font-black text-slate-900 font-mono">{searchResult.totalCount}</span>
              <span className="text-xs text-slate-500">contracted products matching your search criteria</span>
              {searchResult.totalPages > 1 && (
                <span className="text-[11px] text-slate-400 font-mono">
                  (Page {searchResult.page} of {searchResult.totalPages})
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Search</span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === 'table' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Table View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {isSearching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-pulse">
                  <div className="h-40 bg-slate-100 rounded-xl"></div>
                  <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  <div className="h-8 bg-slate-100 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : searchResult.items.length === 0 ? (
            /* STATE 3: NO MATCHING RESULTS EMPTY STATE */
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-xs space-y-4 max-w-xl mx-auto my-8 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 font-sans">No products found</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  No products found for your selected filters. Try changing your destination, Hub, date or product category.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleResetFilters}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Clear Filters & Reset Search</span>
                </button>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {searchResult.items.map(prod => {
                const inQuote = isProductInQuote(prod.id);
                const cityDisplay = prod.city || prod.destinationName || 'Japan';
                const countryDisplay = prod.country || 'Japan';
                const categoryDisplay = prod.category || 'Tour';
                const deliveredInfo = calculateDeliveredPriceForUser(prod, user, currency);
                const isPriceUnavailable = deliveredInfo.isPriceAvailable === false || deliveredInfo.deliveredPrice <= 0;

                return (
                  <div
                    key={prod.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#00C6A6] hover:shadow-md transition-all flex flex-col overflow-hidden group"
                  >
                    {/* Lazy Loaded Image */}
                    <div className="relative h-44 overflow-hidden bg-slate-100 shrink-0">
                      <img
                        loading="lazy"
                        src={canonicalImageService.resolveProductImage(prod)}
                        alt={prod.name || 'Product Image'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const fallback = sanitizeImageUrl('', prod.category || prod.city);
                          if ((e.currentTarget as HTMLImageElement).src !== fallback) {
                            (e.currentTarget as HTMLImageElement).src = fallback;
                          }
                        }}
                      />
                      <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-md text-[10px] font-bold">
                        {cityDisplay}, {countryDisplay}
                      </div>
                      <div className="absolute top-3 right-3 bg-[#00C6A6] text-slate-950 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                        {categoryDisplay}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm line-clamp-1 group-hover:text-[#00a88c] transition-colors">
                          {prod.name || 'Contracted Product'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {prod.shortDescription || prod.longDescription || 'Professional ground handling and logistics.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700 truncate">{prod.duration || 'Flexible'}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-bold text-emerald-700">Direct SLA</span>
                        </div>
                      </div>

                      {/* Price Row */}
                      <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Final Selling Price</span>
                          {isPriceUnavailable ? (
                            <div className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold mt-0.5">
                              {deliveredInfo.priceUnavailableReason || 'Price unavailable'}
                            </div>
                          ) : (
                            <div className="flex items-baseline space-x-1">
                              <span className="text-sm font-extrabold text-slate-900 font-mono">
                                {formatCurrency(deliveredInfo.deliveredPrice, currency)}
                              </span>
                              <span className="text-[10px] text-slate-400">/ person</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                          Contracted
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="space-y-1.5 pt-1">
                        {inQuote ? (
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenAddProductModal(prod)}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                              title="Click to edit configuration in cart"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>In Cart (Edit)</span>
                            </button>
                            <button
                              onClick={() => handleRemoveFromQuote(prod.id)}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                              title="Remove from Cart"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={isPriceUnavailable && !isRailProduct(prod)}
                            onClick={() => handleOpenAddProductModal(prod)}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center shadow-xs ${
                              isPriceUnavailable && !isRailProduct(prod)
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 cursor-pointer'
                            }`}
                          >
                            <span>Configure & Add to Cart</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenProductDetails(prod)}
                          className="w-full py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
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
          ) : (
            /* TABLE VIEW */
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                      <th className="py-3 px-4">SKU / Product Name</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Duration</th>
                      {isAdminOrStaff && <th className="py-3 px-4">Net Wholesale</th>}
                      <th className="py-3 px-4">Final Selling Price</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {searchResult.items.map(prod => {
                      const isSelected = isProductInQuote(prod.id);
                      const deliveredInfo = calculateDeliveredPriceForUser(prod, user, currency);
                      const isPriceUnavailable = deliveredInfo.isPriceAvailable === false || deliveredInfo.deliveredPrice <= 0;

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="font-bold text-slate-900 line-clamp-1">{prod.name || 'Contracted Product'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{prod.sku || prod.id}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center space-x-1 font-medium text-slate-700">
                              <MapPin className="w-3 h-3 text-[#00C6A6]" />
                              <span>{prod.city || 'Japan'}, {prod.country || 'Japan'}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                              {prod.category || 'Tour'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium font-mono">
                            {prod.duration || 'Full Day'}
                          </td>
                          {isAdminOrStaff && (
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {isPriceUnavailable
                                ? '—'
                                : formatCurrency(deliveredInfo.baseAdultNet, prod.currency || currency)}
                            </td>
                          )}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {isPriceUnavailable ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold font-sans">
                                {deliveredInfo.priceUnavailableReason || 'Price unavailable'}
                              </span>
                            ) : (
                              formatCurrency(deliveredInfo.deliveredPrice, currency)
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleOpenProductDetails(prod)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {isSelected ? (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleOpenAddProductModal(prod)}
                                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1"
                                    title="Click to edit configuration in cart"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>In Cart (Edit)</span>
                                  </button>
                                  <button
                                    onClick={() => handleRemoveFromQuote(prod.id)}
                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200"
                                    title="Remove from Cart"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleOpenAddProductModal(prod)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 flex items-center"
                                  title="Configure & Add to Cart"
                                >
                                  <span>Configure & Add</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {searchResult.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center space-x-1">
                {[...Array(searchResult.totalPages)].map((_, idx) => {
                  const pageNum = idx + 1;
                  // Display up to 7 page numbers cleanly
                  if (
                    pageNum === 1 ||
                    pageNum === searchResult.totalPages ||
                    Math.abs(pageNum - currentPage) <= 1
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (
                    pageNum === 2 ||
                    pageNum === searchResult.totalPages - 1
                  ) {
                    return <span key={pageNum} className="text-slate-400 px-1 text-xs">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                disabled={!searchResult.hasMore}
                onClick={() => setCurrentPage(prev => Math.min(searchResult.totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Standardized B2B View Details Modal */}
      {selectedProductDetails && (
        <B2BViewDetailsModal
          product={selectedProductDetails}
          onClose={() => setSelectedProductDetails(null)}
          onOpenCalculator={(p) => {
            setSelectedProductDetails(null);
            handleOpenAddProductModal(p);
          }}
        />
      )}

      {/* Dedicated Category Configurator Router */}
      <GlobalConfiguratorRouter
        itemOrProduct={selectedProductForQuoteModal}
        isOpen={Boolean(selectedProductForQuoteModal)}
        portalOrigin="B2B_AGENT"
        onClose={() => setSelectedProductForQuoteModal(null)}
        onSuccess={(product, details) => {
          setQuoteSuccessNotification({
            product,
            details
          });
        }}
      />
    </div>
  );
};

export const B2BProductsCatalogView: React.FC<B2BProductsCatalogViewProps> = (props) => {
  return (
    <ProductsModuleErrorBoundary>
      <B2BProductsCatalogViewInner {...props} />
    </ProductsModuleErrorBoundary>
  );
};
