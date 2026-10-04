import React, { useState, useMemo, useEffect, ReactNode, ErrorInfo } from 'react';
import { 
  Heart, 
  Search, 
  Trash2, 
  Eye, 
  Sparkles, 
  ArrowRight, 
  Compass, 
  RotateCcw, 
  AlertCircle,
  Clock,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MapPin,
  Building2,
  ShoppingBag,
  Layers,
  FileCheck,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { Product, Hotel, B2BPackage, B2BTabType } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency, calculatePackagePrice } from '../../services/pricingEngine';
import { hotelToProduct } from '../../utils/hotelHelpers';

interface B2BWishlistManagerViewProps {
  onNavigate: (tab: B2BTabType) => void;
  onViewProductDetails?: (prod: Product) => void;
  onViewHotelDetails?: (hotel: Hotel) => void;
  onViewPackageDetails?: (pkg: B2BPackage) => void;
  onConfigureHotel?: (hotel: Hotel) => void;
  onConfigureProduct?: (prod: Product) => void;
  onConfigurePackage?: (pkg: B2BPackage) => void;
  onItemAddedToQuote?: (itemName: string) => void;
  products: Product[];
  hotels: Hotel[];
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WishlistErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WishlistErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    const self = this as any;
    self.setState({ hasError: false, error: null });
    if (self.props.onReset) {
      self.props.onReset();
    }
  };

  public render() {
    const self = this as any;
    if (self.state.hasError) {
      return (
        <div className="w-full max-w-xl mx-auto p-8 bg-white border border-rose-200 rounded-3xl shadow-lg my-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900 font-sans">
            Wishlist Rendering Error
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            Something went wrong while displaying your saved wishlist items ({self.state.error?.message || 'Unexpected Error'}).
          </p>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset & Reload Wishlist</span>
            </button>
          </div>
        </div>
      );
    }
    return self.props.children;
  }
}

export const B2BWishlistManagerView: React.FC<B2BWishlistManagerViewProps> = (props) => {
  return (
    <WishlistErrorBoundary>
      <WishlistManagerViewContent {...props} />
    </WishlistErrorBoundary>
  );
};

const WishlistManagerViewContent: React.FC<B2BWishlistManagerViewProps> = ({
  onNavigate,
  onViewProductDetails,
  onViewHotelDetails,
  onViewPackageDetails,
  onConfigureHotel,
  onConfigureProduct,
  onConfigurePackage,
  onItemAddedToQuote,
  products = [],
  hotels = []
}) => {
  const { user } = useAuth();
  const { currency } = useQuotation();
  const db = AppDatabase.getInstance();
  const [dbTick, setDbTick] = useState(0);

  // Filter and Sorting state
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSorting] = useState<string>('recent');

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setDbTick(tick => tick + 1);
    });
    return () => unsub();
  }, [db]);

  const rawWishlistItems = useMemo(() => {
    return user ? db.getWishlistItems(user.id) : [];
  }, [user, db, dbTick]);

  // Handle Remove Item
  const handleRemove = (itemId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove "${name}" from your wishlist?`)) {
      db.deleteWishlistItem(itemId);
      if (onItemAddedToQuote) {
        onItemAddedToQuote(`Removed ${name} from Wishlist`);
      }
    }
  };

  // Resolve inventory references with item-level error boundary
  const resolvedWishlistItems = useMemo(() => {
    const list: any[] = [];

    rawWishlistItems.forEach(item => {
      try {
        let name = 'Saved Travel Item';
        let category = 'Activity';
        let destination = 'Japan';
        let image = '';
        let basePriceLabel = 'Configure to see Price';
        let exactPrice: number | null = null;
        let isAvailable = true;
        let rawProduct: Product | null = null;
        let rawHotel: Hotel | null = null;
        let rawPackage: B2BPackage | null = null;
        let rawVisa: any = null;

        // Try product catalog
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          rawProduct = prod;
          name = prod.name;
          category = prod.category || 'Product';
          destination = prod.destinationName || prod.country || 'Japan';
          image = prod.imageUrl || prod.heroImage;
          isAvailable = prod.status !== 'INACTIVE' && prod.status !== 'ARCHIVED';

          // Pricing
          if (prod.priceRules && prod.priceRules.length > 0) {
            exactPrice = prod.priceRules[0].price;
            basePriceLabel = formatCurrency(exactPrice, currency);
          } else {
            basePriceLabel = 'Configure to see Price';
          }
        } else {
          // Try hotel catalog
          const hot = hotels.find(h => h.id === item.productId);
          if (hot) {
            rawHotel = hot;
            name = hot.name;
            category = 'Hotel & Ryokan';
            destination = hot.destinationName || 'Japan';
            image = hot.imageUrl || hot.heroImage;
            isAvailable = hot.status !== 'INACTIVE' && hot.status !== 'ARCHIVED';

            // Resolve cheapest rate
            const cheapRoom = hot.roomTypes?.[0];
            const cheapRate = cheapRoom?.rates?.[0];
            if (cheapRate && cheapRate.amount) {
              exactPrice = cheapRate.amount;
              basePriceLabel = `${formatCurrency(exactPrice, currency)} / night`;
            } else {
              basePriceLabel = 'Configure to see Price';
            }
          } else {
            // Try package catalog
            const pkg = db.getPackages().find(p => p.id === item.productId);
            if (pkg) {
              rawPackage = pkg;
              name = pkg.title;
              category = 'Tour Package';
              destination = pkg.destinationName || 'Japan';
              image = pkg.heroImage;
              isAvailable = pkg.status !== 'UNPUBLISHED' && pkg.status !== 'ARCHIVED' && pkg.status !== 'DRAFT';

              // Calculate package price
              try {
                const calculated = calculatePackagePrice({ packageItem: pkg, targetCurrency: currency });
                exactPrice = calculated.pricePerPerson;
                basePriceLabel = `${formatCurrency(exactPrice, currency)} / person`;
              } catch {
                basePriceLabel = 'Configure to see Price';
              }
            } else {
              // Try visa catalog
              const visa = db.getVisas().find(v => v.id === item.productId);
              if (visa) {
                rawVisa = visa;
                name = visa.visaType + ' for ' + visa.country;
                category = 'Visa Service';
                destination = visa.country || 'Japan';
                isAvailable = visa.status === 'ACTIVE';

                const feePrice = visa.sellingPrice || (visa.embassyFee + visa.serviceFee);
                if (feePrice) {
                  exactPrice = feePrice;
                  basePriceLabel = formatCurrency(exactPrice, currency);
                } else {
                  basePriceLabel = 'Configure to see Price';
                }
              } else {
                // Check other categories like travel protection, connectivity, etc.
                const protection = db.getTravelProtectionPlans().find(p => p.id === item.productId);
                if (protection) {
                  name = protection.serviceName;
                  category = 'Travel Protection';
                  destination = 'Japan Coverage';
                  isAvailable = protection.status !== 'INACTIVE' && protection.status !== 'ARCHIVED';
                  if (protection.sellingPricePerTrip) {
                    exactPrice = protection.sellingPricePerTrip;
                    basePriceLabel = formatCurrency(exactPrice, currency);
                  }
                } else {
                  const ground = db.getVipGroundServices().find(g => g.id === item.productId);
                  if (ground) {
                    name = ground.name;
                    category = 'Ground & Connectivity';
                    destination = ground.destinationId || 'Japan';
                    isAvailable = ground.status !== 'INACTIVE' && ground.status !== 'ARCHIVED';
                    if (ground.sellingPrice) {
                      exactPrice = ground.sellingPrice;
                      basePriceLabel = formatCurrency(exactPrice, currency);
                    }
                  } else {
                    const conn = db.getConnectivityPlans().find(c => c.id === item.productId);
                    if (conn) {
                      name = conn.name;
                      category = 'Ground & Connectivity';
                      destination = 'Japan Connectivity';
                      isAvailable = conn.status !== 'INACTIVE' && conn.status !== 'ARCHIVED';
                      if (conn.sellingPrice) {
                        exactPrice = conn.sellingPrice;
                        basePriceLabel = formatCurrency(exactPrice, currency);
                      }
                    } else {
                      // Malformed/deleted product reference
                      isAvailable = false;
                      name = 'Legacy Saved Product';
                      category = 'Unavailable Service';
                    }
                  }
                }
              }
            }
          }
        }

        list.push({
          id: item.id,
          productId: item.productId,
          addedAt: item.addedAt,
          notes: item.notes,
          name,
          category,
          destination,
          image,
          basePriceLabel,
          exactPrice,
          isAvailable,
          rawProduct,
          rawHotel,
          rawPackage,
          rawVisa
        });
      } catch (err) {
        console.error('Failed to resolve wishlist item:', item, err);
        // Resilient item fallback
        list.push({
          id: item.id,
          productId: item.productId,
          addedAt: item.addedAt,
          name: 'Saved Travel Product',
          category: 'Travel Service',
          destination: 'Japan',
          image: '',
          basePriceLabel: 'Configure to see Price',
          isAvailable: false
        });
      }
    });

    return list;
  }, [rawWishlistItems, products, hotels, currency, dbTick]);

  // Client side filtering & search
  const filteredItems = useMemo(() => {
    let result = [...resolvedWishlistItems];

    // Category Filter
    if (activeCategoryFilter !== 'all') {
      const matchKey = activeCategoryFilter.toLowerCase();
      result = result.filter(item => {
        const cat = item.category.toLowerCase();
        if (matchKey === 'products') return cat.includes('product') || cat.includes('activity') || cat.includes('tour') || cat.includes('rail');
        if (matchKey === 'hotels') return cat.includes('hotel') || cat.includes('ryokan') || cat.includes('stay');
        if (matchKey === 'packages') return cat.includes('package');
        if (matchKey === 'visa') return cat.includes('visa') || cat.includes('ancillary') || cat.includes('protection') || cat.includes('ground') || cat.includes('connectivity');
        return cat.includes(matchKey);
      });
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => {
        return (
          item.name.toLowerCase().includes(q) ||
          item.destination.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      });
    }

    // Sorting
    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'destination') {
      result.sort((a, b) => a.destination.localeCompare(b.destination));
    } else if (sortBy === 'category') {
      result.sort((a, b) => a.category.localeCompare(b.category));
    }

    return result;
  }, [resolvedWishlistItems, activeCategoryFilter, searchQuery, sortBy]);

  // Available wishlist count calculations for metadata header
  const totalItemsCount = resolvedWishlistItems.length;
  const totalAvailableCount = resolvedWishlistItems.filter(item => item.isAvailable).length;

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-200 font-sans">
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#00a88c] font-bold text-xs uppercase tracking-wider mb-1">
            <Heart className="w-4 h-4 text-[#00a88c] fill-[#00a88c]" />
            <span>Wishlist Management & Curated Folders</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            My Wishlist Catalog
          </h2>
          <p className="text-xs text-slate-500 max-w-xl mt-0.5 leading-relaxed">
            Manage search-saved products, luxury stays, and bespoke tour arrangements. Review pricing and instantly configure them into client quotations.
          </p>
        </div>

        <div className="bg-[#F5F9F8] border border-[#DDE8E6] px-5 py-3 rounded-2xl text-right shrink-0 flex items-center space-x-4">
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Saved Items</span>
            <span className="text-lg font-mono font-black text-slate-900">{totalItemsCount}</span>
          </div>
          <div className="border-l border-slate-200 h-8"></div>
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Available</span>
            <span className="text-lg font-mono font-black text-[#008f77]">{totalAvailableCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="space-y-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'all' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Items
          </button>
          <button 
            onClick={() => setActiveCategoryFilter('products')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'products' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Products & Tours
          </button>
          <button 
            onClick={() => setActiveCategoryFilter('hotels')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'hotels' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hotels & Ryokans
          </button>
          <button 
            onClick={() => setActiveCategoryFilter('packages')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'packages' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tour Packages
          </button>
          <button 
            onClick={() => setActiveCategoryFilter('visa')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'visa' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visas & Ancillaries
          </button>
        </div>

        {/* Search, Sort and Layout controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input - Always visible */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input 
              type="text"
              placeholder="Search wishlist items by name, destination, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-[#00C6A6] transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <select 
              value={sortBy}
              onChange={(e) => setSorting(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#00C6A6] cursor-pointer appearance-none"
            >
              <option value="recent">Recently Saved</option>
              <option value="name">Name (A-Z)</option>
              <option value="destination">Destination</option>
              <option value="category">Category</option>
            </select>
            <div className="absolute right-3.5 top-3 pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4 shadow-sm">
          <Heart className="w-12 h-12 text-slate-200 mx-auto" />
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery ? 'No Results Found' : 'Your Wishlist is Empty'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {searchQuery 
                ? 'Try adjusting your search terms or select another category filter above.' 
                : 'Save products, hotels, and custom travel arrangements you are interested in and easily return to configure them later.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center space-x-3">
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(''); setActiveCategoryFilter('all'); }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('products')}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explore Products</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => {
            const isItemAvailable = item.isAvailable;

            return (
              <div 
                key={item.id}
                className={`bg-white border rounded-3xl overflow-hidden hover:shadow-lg hover:border-[#00C6A6] transition-all flex flex-col justify-between group ${
                  !isItemAvailable ? 'opacity-85 border-slate-200' : 'border-slate-200/80'
                }`}
              >
                {/* Header/Thumbnail Slot */}
                <div className="h-44 relative bg-slate-100 overflow-hidden shrink-0">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-slate-100 to-slate-200/80 flex flex-col items-center justify-center text-center p-4">
                      <Heart className="w-10 h-10 text-slate-300" />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">{item.category}</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>

                  {/* Availability Badge */}
                  <div className="absolute top-3.5 left-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      isItemAvailable 
                        ? 'bg-teal-100 text-teal-800' 
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {isItemAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>

                  {/* Quick Remove Top Right */}
                  <button 
                    onClick={(e) => handleRemove(item.id, item.name, e)}
                    className="absolute top-3.5 right-3.5 p-2 rounded-full bg-white/90 backdrop-blur hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shadow-2xs cursor-pointer"
                    title="Remove from Wishlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Title lockup on image bottom */}
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <span className="text-[9px] text-[#00E5C0] font-black uppercase tracking-wider block">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-black truncate leading-tight mt-0.5" title={item.name}>
                      {item.name}
                    </h3>
                  </div>
                </div>

                {/* Body details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4 bg-white">
                  <div className="space-y-3">
                    {/* Location and Metadata */}
                    <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium truncate">{item.destination}</span>
                    </div>

                    {/* Customer-Facing Price Resolves here */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer Price</span>
                      <span className={`text-sm font-mono font-black mt-0.5 block ${
                        item.exactPrice ? 'text-slate-900' : 'text-slate-400 italic text-[11px]'
                      }`}>
                        {item.basePriceLabel}
                      </span>
                    </div>

                    {item.notes && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-2 leading-relaxed bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions Area */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2">
                    <div className="flex items-center gap-2">
                      {/* View Details */}
                      <button 
                        type="button"
                        onClick={() => {
                          if (item.category.includes('Hotel') && onViewHotelDetails && item.rawHotel) {
                            onViewHotelDetails(item.rawHotel);
                          } else if (item.category.includes('Package') && onViewPackageDetails && item.rawPackage) {
                            onViewPackageDetails(item.rawPackage);
                          } else if (onViewProductDetails && item.rawProduct) {
                            onViewProductDetails(item.rawProduct);
                          } else {
                            // General fallback
                            alert(`Details view not available for: ${item.name}`);
                          }
                        }}
                        className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>

                      {/* Configure and Add to Quote */}
                      <button 
                        type="button"
                        disabled={!isItemAvailable}
                        onClick={() => {
                          if (item.category.includes('Hotel') && onConfigureHotel && item.rawHotel) {
                            onConfigureHotel(item.rawHotel);
                          } else if (item.category.includes('Package') && onConfigurePackage && item.rawPackage) {
                            onConfigurePackage(item.rawPackage);
                          } else if (onConfigureProduct && item.rawProduct) {
                            onConfigureProduct(item.rawProduct);
                          } else {
                            // General configuration fallback, add direct to quote builder
                            try {
                              if (item.rawProduct) {
                                db.saveWishlistItem({
                                  ...item,
                                  addedAt: new Date().toISOString()
                                });
                                alert('Please select this item directly inside Quote Builder Step 3.');
                              } else {
                                onNavigate('CREATE_QUOTE');
                              }
                            } catch {
                              onNavigate('CREATE_QUOTE');
                            }
                          }
                        }}
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center space-x-1 ${
                          isItemAvailable 
                            ? 'bg-[#008f77] hover:bg-[#00705d] cursor-pointer' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Add to Quote</span>
                      </button>
                    </div>

                    <button 
                      onClick={(e) => handleRemove(item.id, item.name, e)}
                      className="text-center py-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <span>♡ Remove from Wishlist</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
