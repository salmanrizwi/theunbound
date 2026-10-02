import * as React from 'react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  User 
} from '../../types';
import { 
  Search, 
  X, 
  Package, 
  Hotel as HotelIcon, 
  Compass, 
  Layers, 
  Users, 
  FileText, 
  CalendarCheck, 
  UserCheck, 
  BookOpen, 
  Megaphone, 
  ArrowRight, 
  Sparkles,
  AlertCircle,
  Loader2,
  CornerDownLeft,
  ArrowUpDown
} from 'lucide-react';

// Error Boundary specifically for Search to prevent any search crash from unmounting the CMS
interface SearchErrorBoundaryProps {
  children: React.ReactNode;
  fallbackQuery?: string;
  onReset?: () => void;
}

interface SearchErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

class SearchErrorBoundary extends React.Component<SearchErrorBoundaryProps, SearchErrorBoundaryState> {
  state: SearchErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): SearchErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CMSGlobalSearch] Rendering error caught by boundary:', error, errorInfo);
  }

  render() {
    const self = this as any;
    if (self.state.hasError) {
      return (
        <div className="p-8 text-center bg-white rounded-2xl space-y-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Search encountered a temporary issue</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            We couldn't render some search items with this query. You can refine your search or clear it.
          </p>
          <button
            onClick={() => {
              self.setState({ hasError: false });
              self.props.onReset?.();
            }}
            className="px-4 py-1.5 text-xs font-bold text-[#00C6A6] bg-[#00C6A6]/10 hover:bg-[#00C6A6]/20 rounded-xl transition-colors cursor-pointer"
          >
            Clear and Try Again
          </button>
        </div>
      );
    }
    return self.props.children;
  }
}

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  entityType: 'PRODUCT' | 'HOTEL' | 'DESTINATION' | 'HUB' | 'LEAD' | 'QUOTE' | 'BOOKING' | 'USER' | 'BLOG' | 'PROMOTION';
  moduleSection: string;
  subTab?: string;
  badge?: string;
  record?: any;
}

interface CMSGlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
  currentUser?: User | null;
}

type CategoryFilter = 'ALL' | 'PRODUCT' | 'HOTEL' | 'DESTINATION' | 'LEAD' | 'QUOTE' | 'BOOKING' | 'USER' | 'CONTENT';

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'ALL', label: 'All Results' },
  { id: 'PRODUCT', label: 'Products' },
  { id: 'HOTEL', label: 'Hotels' },
  { id: 'DESTINATION', label: 'Destinations' },
  { id: 'LEAD', label: 'Leads' },
  { id: 'QUOTE', label: 'Quotes' },
  { id: 'BOOKING', label: 'Bookings' },
  { id: 'USER', label: 'Users' },
  { id: 'CONTENT', label: 'Content' }
];

export const CMSGlobalSearch: React.FC<CMSGlobalSearchProps> = ({
  isOpen,
  onClose,
  onNavigate,
  currentUser
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [searchError, setSearchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const db = AppDatabase.getInstance();

  // Reset state when opened or closed
  useEffect(() => {
    if (isOpen) {
      setSearchError(null);
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
      setDebouncedQuery('');
      setIsSearching(false);
      setSelectedCategory('ALL');
      setSelectedIndex(0);
      setSearchError(null);
    }
  }, [isOpen]);

  // Debounce search query to keep typing completely non-blocking and fluid
  useEffect(() => {
    if (!query) {
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
      setSelectedIndex(0);
    }, 120);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset selected index when category filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [selectedCategory]);

  // Compute search results with complete null-safety and exception resilience
  const searchResults = useMemo<SearchResultItem[]>(() => {
    const cleanQ = (debouncedQuery || '').trim().toLowerCase();
    if (!cleanQ) return [];

    try {
      const results: SearchResultItem[] = [];

      // Helper for null-safe string matching
      const matches = (value?: string | null | number) => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(cleanQ);
      };

      // 1. Products
      if (selectedCategory === 'ALL' || selectedCategory === 'PRODUCT') {
        const products = db.getProducts() || [];
        products.forEach(p => {
          if (!p) return;
          if (
            matches(p.name) ||
            matches(p.category) ||
            matches(p.subcategory) ||
            matches(p.city) ||
            matches(p.country) ||
            matches(p.sku) ||
            matches(p.supplierName) ||
            matches(p.destinationName)
          ) {
            results.push({
              id: p.id || '',
              title: p.name || 'Unnamed Product',
              subtitle: `${p.category || 'Product'} • ${p.city || ''}${p.country ? ', ' + p.country : ''} • Rate: ${p.currency || 'USD'} ${p.adultNetPrice ?? 0}`,
              entityType: 'PRODUCT',
              moduleSection: 'PRODUCT_MANAGEMENT',
              subTab: 'PRODUCTS',
              badge: p.status || 'ACTIVE',
              record: p
            });
          }
        });
      }

      // 2. Hotels
      if (selectedCategory === 'ALL' || selectedCategory === 'HOTEL') {
        const hotels = db.getHotels() || [];
        hotels.forEach(h => {
          if (!h) return;
          if (
            matches(h.name) ||
            matches(h.cityName) ||
            matches(h.country) ||
            matches(h.code) ||
            matches(h.propertyType)
          ) {
            results.push({
              id: h.id || '',
              title: h.name || 'Unnamed Hotel',
              subtitle: `${h.starRating ?? 5}★ ${String(h.propertyType || 'HOTEL').replace(/_/g, ' ')} • ${h.cityName || ''}${h.country ? ', ' + h.country : ''} • from ${h.currency || 'USD'} ${h.startingNetPrice ?? 0}/nt`,
              entityType: 'HOTEL',
              moduleSection: 'HOTEL_MANAGEMENT',
              subTab: 'HOTELS',
              badge: h.status || 'ACTIVE',
              record: h
            });
          }
        });
      }

      // 3. Destinations
      if (selectedCategory === 'ALL' || selectedCategory === 'DESTINATION') {
        const destinations = db.getDestinations() || [];
        destinations.forEach(d => {
          if (!d) return;
          if (
            matches(d.name) ||
            matches(d.country) ||
            matches(d.regionName) ||
            matches(d.tagline) ||
            matches((d as any).code)
          ) {
            results.push({
              id: d.id || '',
              title: d.name || 'Unnamed Destination',
              subtitle: `Country: ${d.country || 'N/A'} • Currency: ${d.currency || 'USD'} • ${d.cities?.length || 0} Hubs`,
              entityType: 'DESTINATION',
              moduleSection: 'DESTINATION_MANAGEMENT',
              subTab: 'DESTINATIONS',
              badge: d.status || 'ACTIVE',
              record: d
            });
          }
        });

        // 4. City Hubs
        const hubs = db.getCityHubs() || [];
        hubs.forEach(hb => {
          if (!hb) return;
          if (
            matches(hb.name) ||
            matches(hb.destinationName) ||
            matches(hb.regionName) ||
            matches(hb.tagline)
          ) {
            results.push({
              id: hb.id || '',
              title: hb.name || 'Unnamed Hub',
              subtitle: `City Hub in ${hb.destinationName || 'Destination'} • ${hb.productCount ?? 0} Products • ${hb.hotelCount ?? 0} Hotels`,
              entityType: 'HUB',
              moduleSection: 'DESTINATION_MANAGEMENT',
              subTab: 'CITIES',
              badge: hb.status || 'ACTIVE',
              record: hb
            });
          }
        });
      }

      // 5. Leads
      if (selectedCategory === 'ALL' || selectedCategory === 'LEAD') {
        const leads = db.getLeads() || [];
        leads.forEach(l => {
          if (!l) return;
          if (
            matches(l.contactName) ||
            matches(l.email) ||
            matches(l.leadNumber) ||
            matches(l.agencyName) ||
            matches(l.destinationName) ||
            matches(l.phone)
          ) {
            results.push({
              id: l.id || '',
              title: `${l.contactName || 'Lead'} (${l.leadNumber || 'No Ref'})`,
              subtitle: `${l.agencyName ? l.agencyName + ' • ' : ''}${l.destinationName || 'Destination'} • Budget: ${l.currency || 'USD'} ${l.estimatedBudget ?? 0}`,
              entityType: 'LEAD',
              moduleSection: 'LEAD_MANAGEMENT',
              subTab: 'LEADS',
              badge: l.status || 'NEW',
              record: l
            });
          }
        });
      }

      // 6. Quotations
      if (selectedCategory === 'ALL' || selectedCategory === 'QUOTE') {
        const quotes = db.getAllSavedQuotes() || [];
        quotes.forEach(q => {
          if (!q) return;
          if (
            matches(q.quoteNumber) ||
            matches(q.clientName) ||
            matches(q.agentName) ||
            matches(q.destination) ||
            matches((q as any).customerEmail || (q as any).clientEmail)
          ) {
            results.push({
              id: q.id || '',
              title: `${q.quoteNumber || 'Quote'} — ${q.clientName || 'Guest'}`,
              subtitle: `${q.destination || 'Custom Itinerary'} • Agent: ${q.agentName || 'Direct'} • Total: ${q.currency || 'USD'} ${(q.totalSellingPrice ?? 0).toLocaleString()}`,
              entityType: 'QUOTE',
              moduleSection: 'LEAD_MANAGEMENT',
              subTab: 'QUOTES',
              badge: q.status || 'DRAFT',
              record: q
            });
          }
        });
      }

      // 7. Bookings
      if (selectedCategory === 'ALL' || selectedCategory === 'BOOKING') {
        const bookings = db.getAllBookings() || [];
        bookings.forEach(b => {
          if (!b) return;
          const cust = (b.customer || {}) as any;
          if (
            matches(b.bookingReference) ||
            matches(cust.leadTravelerName) ||
            matches(cust.name) ||
            matches(cust.email) ||
            matches(cust.agencyName) ||
            matches((b as any).customerName) ||
            matches((b as any).customerEmail)
          ) {
            results.push({
              id: b.id || '',
              title: `${b.bookingReference || 'Booking'} — ${cust.leadTravelerName || cust.name || 'Guest'}`,
              subtitle: `${b.items?.length || 0} Services • Travel: ${b.travelStartDate || 'TBD'} • Total: ${b.currency || 'USD'} ${(b.totalAmount ?? 0).toLocaleString()}`,
              entityType: 'BOOKING',
              moduleSection: 'BOOKING_MANAGEMENT',
              subTab: 'BOOKINGS',
              badge: b.status || 'CONFIRMED',
              record: b
            });
          }
        });
      }

      // 8. Users (Only if admin or account viewer)
      if ((selectedCategory === 'ALL' || selectedCategory === 'USER') && (!currentUser || currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER' || (currentUser as any).isSuperAdmin)) {
        const users = db.getUsers() || [];
        users.forEach(u => {
          if (!u) return;
          if (
            matches(u.name) ||
            matches(u.firstName) ||
            matches(u.lastName) ||
            matches(u.email) ||
            matches(u.agencyName) ||
            matches(u.role)
          ) {
            results.push({
              id: u.id || '',
              title: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User',
              subtitle: `${u.role || 'Member'} • ${u.email || ''} • ${u.agencyName || 'Direct'}`,
              entityType: 'USER',
              moduleSection: 'ACCOUNT_MANAGEMENT',
              subTab: 'USERS_ACCESS',
              badge: u.approvalStatus || 'APPROVED',
              record: u
            });
          }
        });
      }

      // 9. Blogs & Content
      if (selectedCategory === 'ALL' || selectedCategory === 'CONTENT') {
        const blogs = db.getBlogs() || [];
        blogs.forEach(bg => {
          if (!bg) return;
          if (
            matches(bg.title) ||
            matches(bg.category) ||
            matches(bg.author) ||
            matches(bg.summary)
          ) {
            results.push({
              id: bg.id || '',
              title: bg.title || 'Untitled Article',
              subtitle: `Blog • Category: ${bg.category || 'Travel'} • Author: ${bg.author || 'TheUnbound'}`,
              entityType: 'BLOG',
              moduleSection: 'PAGE_MANAGEMENT',
              subTab: 'BLOGS',
              badge: bg.status || 'PUBLISHED',
              record: bg
            });
          }
        });

        // 10. Promotions
        const promotions = db.getPromotions() || [];
        promotions.forEach(pr => {
          if (!pr) return;
          if (
            matches(pr.title) ||
            matches(pr.description) ||
            matches(pr.promoCode)
          ) {
            results.push({
              id: pr.id || '',
              title: pr.title || 'Special Promotion',
              subtitle: `Promo Code: ${pr.promoCode || 'N/A'} • Discount: ${pr.discountValue ?? 0}${pr.discountType === 'PERCENTAGE' ? '%' : ' ' + (pr.currency || 'USD')}`,
              entityType: 'PROMOTION',
              moduleSection: 'MARKETING_MANAGEMENT',
              subTab: 'PROMOTIONS',
              badge: pr.isActive ? 'ACTIVE' : 'INACTIVE',
              record: pr
            });
          }
        });
      }

      return results.slice(0, 30);
    } catch (err: any) {
      console.error('[CMSGlobalSearch] Search computation error:', err);
      setSearchError(err?.message || 'Failed to search records');
      return [];
    }
  }, [debouncedQuery, selectedCategory, db, currentUser]);

  // Handle keyboard navigation (Escape, ArrowUp, ArrowDown, Enter)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (searchResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeItem = searchResults[selectedIndex] || searchResults[0];
        if (activeItem) {
          handleSelectResult(activeItem);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getEntityIcon = (type: SearchResultItem['entityType']) => {
    switch (type) {
      case 'PRODUCT': return Package;
      case 'HOTEL': return HotelIcon;
      case 'DESTINATION': return Compass;
      case 'HUB': return Layers;
      case 'LEAD': return Users;
      case 'QUOTE': return FileText;
      case 'BOOKING': return CalendarCheck;
      case 'USER': return UserCheck;
      case 'BLOG': return BookOpen;
      case 'PROMOTION': return Megaphone;
      default: return Search;
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    onNavigate(item.moduleSection, item.subTab, item.id);
    onClose();
  };

  return (
    <SearchErrorBoundary fallbackQuery={query} onReset={() => setQuery('')}>
      {/* Semi-transparent backdrop - NEVER solid white */}
      <div 
        className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-3 sm:px-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div 
          className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-98 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Search Input Bar */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center space-x-3 bg-slate-50/80">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#008972] flex items-center justify-center shrink-0">
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#008972]" />
              ) : (
                <Search className="w-4 h-4 text-[#008972]" />
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, hotels, destinations, leads, quotes, bookings, users..."
              className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-semibold outline-hidden selection:bg-[#00C6A6] selection:text-slate-950"
              autoComplete="off"
              spellCheck={false}
            />

            {query && (
              <button 
                onClick={() => {
                  setQuery('');
                  setDebouncedQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button 
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-200/80 hover:bg-slate-300/80 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Close (ESC)"
            >
              ESC
            </button>
          </div>

          {/* Filter Categories Chips */}
          <div className="px-3.5 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center space-x-1.5 overflow-x-auto scrollbar-none select-none shrink-0">
            {CATEGORY_TABS.map(cat => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#008972] text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Results Area */}
          <div ref={listRef} className="overflow-y-auto p-2.5 sm:p-3 space-y-1 flex-1 max-h-[60vh]">
            {searchError ? (
              <div className="py-10 px-4 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Search Error</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">{searchError}</p>
                <button
                  onClick={() => {
                    setSearchError(null);
                    setQuery('');
                  }}
                  className="mt-2 px-3.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  Reset Search
                </button>
              </div>
            ) : query.trim() === '' ? (
              <div className="py-12 px-4 text-center text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                  <Sparkles className="w-6 h-6 text-[#008972]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700">Quick Global Search</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Type to instantly search product inventory, contracted hotels, city hubs, leads, active quotations, bookings, client accounts, and CMS content.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 max-w-lg mx-auto">
                  <span className="text-[11px] text-slate-400">Quick suggestions:</span>
                  {['Tokyo', 'Shinkansen', 'Hotel', 'Transfer', 'Quote', 'Booking'].map(term => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700">No matching records found for "{query}"</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Try searching by SKU, booking reference code, customer email, destination, hotel name, or change the category filter above.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="px-3 py-1 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <span>Found {searchResults.length} Match{searchResults.length === 1 ? '' : 'es'}</span>
                  <span className="text-[10px] lowercase font-normal text-slate-400">use ↑↓ to navigate</span>
                </div>

                {searchResults.map((item, index) => {
                  const Icon = getEntityIcon(item.entityType);
                  const isSelected = index === selectedIndex;

                  return (
                    <div
                      key={`${item.entityType}-${item.id}-${index}`}
                      data-index={index}
                      onClick={() => handleSelectResult(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full text-left p-2.5 sm:p-3 rounded-2xl transition-all flex items-center justify-between group cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-50/60 border-emerald-300/80 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#008972] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-[#008972]/10 group-hover:text-[#008972]'
                        }`}>
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>

                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                              isSelected ? 'text-[#008972]' : 'text-slate-400 group-hover:text-[#008972]'
                            }`}>
                              {item.entityType}
                            </span>
                            {item.badge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-400 group-hover:text-[#008972] shrink-0 pl-2">
                        {isSelected && (
                          <span className="hidden sm:inline-flex items-center text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded mr-1">
                            <CornerDownLeft className="w-3 h-3 mr-0.5" /> Enter
                          </span>
                        )}
                        <span className="hidden sm:inline">Open</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Shortcuts Guide */}
          <div className="p-2.5 sm:p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 px-4 gap-2">
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center">
                <ArrowUpDown className="w-3 h-3 mr-1 text-slate-400" /> Navigate
              </span>
              <span className="inline-flex items-center">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono text-[10px] mr-1">↵</kbd> Select
              </span>
            </div>
            <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono text-[10px]">ESC</kbd> to exit</span>
          </div>
        </div>
      </div>
    </SearchErrorBoundary>
  );
};
