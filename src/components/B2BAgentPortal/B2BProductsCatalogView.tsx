import React, { useState, useMemo, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  Plus, 
  Check, 
  Eye, 
  ShieldCheck, 
  Layers,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  BookmarkCheck,
  X,
  Users,
  Sparkles,
  ArrowRight,
  Trash2,
  RotateCcw,
  Calendar,
  Car,
  AlertCircle,
  Bus,
  Train,
  Globe2,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { Product, Destination, CityHub, DestinationRegionItem } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';
import { GlobalConfiguratorRouter } from '../Configurators/GlobalConfiguratorRouter';
import { isRailProduct } from '../../services/rail/JapanRailJourneyDataService';
import { AppDatabase } from '../../services/db';
import { canonicalImageService } from '../../services/imageService';
import { B2BViewDetailsModal } from '../B2BViewDetailsModal';

// Safely normalize any value to a lowercase trimmed string to prevent undefined property crashes
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
    const self = this as any;
    self.setState({ hasError: false, error: null });
    if (self.props.onResetFilters) {
      self.props.onResetFilters();
    }
  };

  public render() {
    const self = this as any;
    if (self.state.hasError) {
      return (
        <div className="w-full p-8 bg-white border border-rose-200 rounded-3xl shadow-lg my-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900 font-sans">
            Tours, Transfers & Ground Products Filter Error
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            Something went wrong while rendering product search results ({self.state.error?.message || 'Unexpected Error'}).
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

    return self.props.children;
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
  const { items, removeProductFromQuote, currency, setIsQuoteDrawerOpen } = useQuotation();

  // Canonical Master Data Collections
  const canonicalProducts = useMemo(() => {
    const raw = (products && products.length > 0) ? products : db.getProducts();
    return (raw || []).filter(p => Boolean(p && typeof p === 'object' && p.id));
  }, [products, db]);

  const canonicalDestinations = useMemo(() => {
    const raw = (destinations && destinations.length > 0) ? destinations : db.getDestinations();
    return (raw || []).filter(d => Boolean(d && typeof d === 'object' && d.id));
  }, [destinations, db]);

  const regions = useMemo(() => {
    return (db.getRegions() || []).filter(r => Boolean(r && typeof r === 'object' && r.id));
  }, [db]);

  const cityHubs = useMemo(() => {
    return (db.getCityHubs() || []).filter(h => Boolean(h && typeof h === 'object' && h.id));
  }, [db]);

  // Primary Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedHub, setSelectedHub] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [infants, setInfants] = useState<number>(0);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [fromHubId, setFromHubId] = useState<string>('ALL');
  const [toHubId, setToHubId] = useState<string>('ALL');

  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [selectedProductForQuoteModal, setSelectedProductForQuoteModal] = useState<Product | null>(null);
  const [quoteSuccessNotification, setQuoteSuccessNotification] = useState<{ product: Product; details: any } | null>(null);

  // Cascading Dependency 1: When Region changes, clear Destination and Hub if they don't belong to the new Region
  useEffect(() => {
    if (selectedRegion !== 'ALL') {
      if (selectedDestination !== 'ALL') {
        const dest = canonicalDestinations.find(d => d.id === selectedDestination);
        if (dest && dest.regionId && dest.regionId !== selectedRegion) {
          setSelectedDestination('ALL');
        }
      }
      if (selectedHub !== 'ALL') {
        const hub = cityHubs.find(h => h.id === selectedHub);
        if (hub && hub.regionId && hub.regionId !== selectedRegion) {
          setSelectedHub('ALL');
        }
      }
    }
  }, [selectedRegion, selectedDestination, selectedHub, canonicalDestinations, cityHubs]);

  // Cascading Dependency 2: When Destination changes, clear Hub if it doesn't belong to the new Destination
  useEffect(() => {
    if (selectedDestination !== 'ALL' && selectedHub !== 'ALL') {
      const hub = cityHubs.find(h => h.id === selectedHub);
      if (hub && hub.destinationId && hub.destinationId !== selectedDestination) {
        setSelectedHub('ALL');
      }
    }
  }, [selectedDestination, selectedHub, cityHubs]);

  // Available Destinations for dropdown based on active Region
  const availableDestinations = useMemo(() => {
    if (selectedRegion === 'ALL') return canonicalDestinations;
    return canonicalDestinations.filter(d => d.regionId === selectedRegion);
  }, [canonicalDestinations, selectedRegion]);

  // Available Hubs for dropdown based on active Region and Destination
  const availableHubs = useMemo(() => {
    return cityHubs.filter(h => {
      const matchesRegion = selectedRegion === 'ALL' || h.regionId === selectedRegion;
      const matchesDest = selectedDestination === 'ALL' || h.destinationId === selectedDestination;
      return matchesRegion && matchesDest;
    });
  }, [cityHubs, selectedRegion, selectedDestination]);

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

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRegion('ALL');
    setSelectedDestination('ALL');
    setSelectedHub('ALL');
    setSelectedCategory('ALL');
    setSelectedDate('');
    setAdults(2);
    setChildren(0);
    setInfants(0);
    setSelectedVehicle('ALL');
    setSelectedStatus('ALL');
    setFromHubId('ALL');
    setToHubId('ALL');
  };

  // Safe Defensive Filtering Execution Engine
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(canonicalProducts)) return [];

    const query = safeStr(searchQuery);
    const totalPassengers = Math.max(0, adults) + Math.max(0, children);

    return canonicalProducts.filter(p => {
      if (!p || typeof p !== 'object') return false;

      // 1. Text Search Filter (Name, SKU, City, Country, Description, Supplier, Category)
      if (query) {
        const name = safeStr(p.name);
        const title = safeStr((p as any).title);
        const sku = safeStr(p.sku);
        const city = safeStr(p.city);
        const country = safeStr(p.country);
        const desc = safeStr(p.shortDescription || p.longDescription);
        const supplier = safeStr(p.supplierName);
        const category = safeStr(p.category);

        const matchesQuery = 
          name.includes(query) ||
          title.includes(query) ||
          sku.includes(query) ||
          city.includes(query) ||
          country.includes(query) ||
          desc.includes(query) ||
          supplier.includes(query) ||
          category.includes(query);

        if (!matchesQuery) return false;
      }

      // 2. Master Region Filter
      if (selectedRegion !== 'ALL') {
        const pRegion = safeStr(p.regionId);
        if (pRegion && pRegion !== selectedRegion) {
          const destObj = canonicalDestinations.find(d => d.id === p.destinationId);
          if (!destObj || destObj.regionId !== selectedRegion) return false;
        }
      }

      // 3. Destination Filter
      if (selectedDestination !== 'ALL') {
        const pDestId = safeStr(p.destinationId);
        const pCountry = safeStr(p.country);
        const pDestName = safeStr(p.destinationName);
        const destObj = canonicalDestinations.find(d => d.id === selectedDestination);
        const targetName = destObj ? safeStr(destObj.name) : safeStr(selectedDestination);

        const matchesDest = 
          pDestId === selectedDestination ||
          (pCountry && pCountry === targetName) ||
          (pDestName && pDestName === targetName) ||
          pCountry === safeStr(selectedDestination);

        if (!matchesDest) return false;
      }

      // 4. City Hub Filter
      if (selectedHub !== 'ALL') {
        const pHubId = safeStr(p.hubId || p.cityHubId || p.fromHubId);
        const pCity = safeStr(p.city);
        const hubObj = cityHubs.find(h => h.id === selectedHub);
        const targetHubName = hubObj ? safeStr(hubObj.name) : safeStr(selectedHub);

        const matchesHub = 
          pHubId === selectedHub ||
          (pCity && pCity === targetHubName);

        if (!matchesHub) return false;
      }

      // 5. Category Filter
      if (selectedCategory !== 'ALL') {
        const pCat = safeStr(p.category);
        const targetCat = safeStr(selectedCategory);

        if (pCat !== targetCat) {
          const singularP = pCat.replace(/s$/, '');
          const singularTarget = targetCat.replace(/s$/, '');
          if (singularP !== singularTarget) return false;
        }
      }

      // 6. Transfer Route Filter (fromHubId / toHubId)
      if (selectedCategory.toLowerCase().includes('transfer')) {
        if (fromHubId !== 'ALL') {
          const pFrom = safeStr(p.fromHubId || p.hubId || p.cityHubId);
          if (pFrom && pFrom !== fromHubId) return false;
        }
        if (toHubId !== 'ALL') {
          const pTo = safeStr(p.toHubId);
          if (pTo && pTo !== toHubId) return false;
        }
      }

      // 7. Passengers & Capacity Check
      if (totalPassengers > 0) {
        const minPax = typeof p.minPax === 'number' ? p.minPax : 1;
        const maxPax = typeof p.maxPax === 'number' ? p.maxPax : 999;
        if (totalPassengers < minPax || totalPassengers > maxPax) return false;
      }

      // 8. Vehicle / Capacity Type
      if (selectedVehicle !== 'ALL') {
        const pVeh = safeStr((p as any).vehicleType || p.vehicleConfig?.type || p.subcategory);
        if (!pVeh.includes(safeStr(selectedVehicle))) return false;
      }

      // 9. Status Filter
      if (selectedStatus !== 'ALL') {
        const pStat = safeStr(p.status || 'ACTIVE').toUpperCase();
        if (pStat !== selectedStatus.toUpperCase()) return false;
      }

      return true;
    });
  }, [
    canonicalProducts,
    canonicalDestinations,
    cityHubs,
    searchQuery,
    selectedRegion,
    selectedDestination,
    selectedHub,
    selectedCategory,
    adults,
    children,
    selectedVehicle,
    selectedStatus,
    fromHubId,
    toHubId
  ]);

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
    searchQuery !== '' ||
    selectedRegion !== 'ALL' ||
    selectedDestination !== 'ALL' ||
    selectedHub !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedDate !== '' ||
    selectedVehicle !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    fromHubId !== 'ALL' ||
    toHubId !== 'ALL' ||
    adults !== 2 ||
    children !== 0;

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00C6A6]/10 text-[#00a88c] border border-[#00C6A6]/20 text-[10px] font-bold uppercase tracking-wider">
              B2B Contracted Tariff Inventory
            </span>
            <span className="text-xs text-slate-400 font-mono">({canonicalProducts.length} Wholesale SKUs)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Tours, Transfers & Ground Products</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Search private tours, chauffeured excursions, bullet train tickets, and exclusive museum VIP entries across all destinations.
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

      {/* Quick Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          All Products ({canonicalProducts.length})
        </button>

        {categories.map(cat => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Main Search & Cascading Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, SKU, city, supplier (e.g. Tokyo VIP, teamLab, Transfers, Kyoto Guide)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Core Hierarchy Dropdowns: Region -> Destination -> Hub -> Category */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2 w-full lg:w-auto shrink-0">
            {/* Region Dropdown */}
            {regions.length > 0 && (
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300 transition-colors"
              >
                <option value="ALL">All Regions</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}

            {/* Destination Dropdown */}
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="ALL">All Destinations</option>
              {availableDestinations.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Hub Dropdown */}
            {availableHubs.length > 0 && (
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300 transition-colors"
              >
                <option value="ALL">All City Hubs</option>
                {availableHubs.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons: Advanced Filter Drawer Toggle, Clear, View Mode */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0 pt-2 lg:pt-0">
            <button
              onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                isAdvancedFiltersOpen || selectedDate || adults !== 2 || selectedVehicle !== 'ALL' || selectedStatus !== 'ALL'
                  ? 'bg-teal-50 text-[#008f77] border-[#00C6A6]'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>More Filters</span>
              {isAdvancedFiltersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center space-x-1 cursor-pointer"
                title="Reset all search filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

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

        {/* Collapsible Advanced Filters Panel */}
        {isAdvancedFiltersOpen && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in duration-150">
            {/* Travel Date Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-[#00C6A6]" />
                <span>Travel Date</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:border-[#00C6A6]"
              />
            </div>

            {/* Passenger Count Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Users className="w-3 h-3 text-[#00C6A6]" />
                <span>Passengers (Adults)</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold outline-none focus:border-[#00C6A6]"
                />
              </div>
            </div>

            {/* Vehicle / Capacity Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Car className="w-3 h-3 text-[#00C6A6]" />
                <span>Vehicle / Capacity</span>
              </label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:border-[#00C6A6]"
              >
                <option value="ALL">Any Vehicle Type</option>
                <option value="sedan">Sedan / Standard (1-3 Pax)</option>
                <option value="van">Luxury Alphard / Van (1-6 Pax)</option>
                <option value="minibus">Minibus / Coach (7-18 Pax)</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Status</span>
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:border-[#00C6A6]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Tariff Only</option>
                <option value="INACTIVE">Archived / Paused</option>
              </select>
            </div>

            {/* Transfer Route Hub Filter (Visible when category is Transfer) */}
            {selectedCategory.toLowerCase().includes('transfer') && availableHubs.length > 0 && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-rose-500" />
                    <span>Origin Hub (From)</span>
                  </label>
                  <select
                    value={fromHubId}
                    onChange={(e) => setFromHubId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:border-[#00C6A6]"
                  >
                    <option value="ALL">Any Origin Hub</option>
                    {availableHubs.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    <span>Destination Hub (To)</span>
                  </label>
                  <select
                    value={toHubId}
                    onChange={(e) => setToHubId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:border-[#00C6A6]"
                  >
                    <option value="ALL">Any Destination Hub</option>
                    {availableHubs.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Active Filter Summary Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          <span>Showing </span>
          <span className="font-bold text-slate-900">{filteredProducts.length}</span>
          <span> of </span>
          <span className="font-bold text-slate-900">{canonicalProducts.length}</span>
          <span> ground products</span>
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 rounded-md bg-teal-50 text-[#008f77] text-[10px] font-bold">
              Filtered
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline cursor-pointer"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Results View: Grid or Table or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-xs space-y-4 max-w-xl mx-auto my-8 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 font-sans">No Products Found</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We couldn't find any contracted ground products matching your selected search criteria.
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
        /* Grid Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {filteredProducts.map(prod => {
            const inQuote = isProductInQuote(prod.id);
            const cityDisplay = prod.city || prod.destinationName || 'Japan';
            const countryDisplay = prod.country || 'Japan';
            const categoryDisplay = prod.category || 'Tour';
            const priceVal = typeof prod.sellingPriceStartingFrom === 'number' ? prod.sellingPriceStartingFrom : (prod.adultNetPrice || 0);

            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#00C6A6] hover:shadow-md transition-all flex flex-col overflow-hidden group"
              >
                {/* Image */}
                <div className="relative h-44 overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={canonicalImageService.resolveProductImage(prod)}
                    alt={prod.name || 'Product Image'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = canonicalImageService.resolveProductImage(prod);
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
                      <div className="flex items-baseline space-x-1">
                        <span className="text-sm font-extrabold text-slate-900 font-mono">
                          {formatCurrency(priceVal, prod.currency || currency)}
                        </span>
                        <span className="text-[10px] text-slate-400">/ person</span>
                      </div>
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
                        onClick={() => handleOpenAddProductModal(prod)}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-xs bg-[#00C6A6] hover:bg-[#00b395] text-slate-950"
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
        /* Table View */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3 px-4">SKU / Product Name</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Net Wholesale</th>
                  <th className="py-3 px-4">Starting Retail</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(prod => {
                  const isSelected = isProductInQuote(prod.id);
                  const priceVal = typeof prod.sellingPriceStartingFrom === 'number' ? prod.sellingPriceStartingFrom : (prod.adultNetPrice || 0);

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
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {formatCurrency(prod.adultNetPrice || 0, prod.currency || currency)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {formatCurrency(priceVal, prod.currency || currency)}
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
