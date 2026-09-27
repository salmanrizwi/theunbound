import React, { useState, useMemo, useEffect } from 'react';
import { useQuotation } from '../context/QuotationContext';
import { useAuth } from '../context/AuthContext';
import { useRoster } from '../context/RosterContext';
import { formatCurrency } from '../services/pricingEngine';
import { canUserAccessB2BInventory } from '../services/permissionEngine';
import { RosterCalendarPicker } from './RosterCalendarPicker';
import { Quotation, Product, Hotel, CurrencyCode, SUPPORTED_CURRENCIES, Booking } from '../types';
import { db } from '../services/db';
import { GlobalConfiguratorRouter } from './Configurators/GlobalConfiguratorRouter';
import { BookingSubmissionModal } from './B2BAgentPortal/BookingSubmissionModal';
import { BookingConfirmationModal } from './BookingConfirmationModal';
import { 
  X, 
  Trash2, 
  Calendar, 
  Users, 
  ShieldCheck, 
  Check, 
  ArrowRight,
  Globe2,
  FileText, 
  CalendarX, 
  CalendarCheck, 
  RefreshCw, 
  AlertOctagon, 
  Sliders, 
  ShoppingBag, 
  Building2, 
  Layers, 
  FileCheck, 
  CheckCircle2, 
  Compass, 
  Clock,
  Car,
  Train,
  Lock
} from 'lucide-react';

interface QuoteBuilderDrawerProps {
  onBookQuote?: (booking: Booking) => void;
  onSubmitBooking?: () => void;
  onNavigateToQuoteBuilder?: () => void;
  onNavigateToCatalog?: (tab: 'products' | 'hotels' | 'packages' | 'visa' | 'home') => void;
}

export const QuoteBuilderDrawer: React.FC<QuoteBuilderDrawerProps> = ({ 
  onBookQuote, 
  onSubmitBooking,
  onNavigateToQuoteBuilder,
  onNavigateToCatalog 
}) => {
  const {
    items,
    currency,
    setCurrency,
    isQuoteDrawerOpen,
    setIsQuoteDrawerOpen,
    removeProductFromQuote,
    updateItemPax,
    updateItemTravelDate,
    clearQuote,
    totalNetCost,
    totalSellingPrice
  } = useQuotation();

  const { role, user, openAuthModal } = useAuth();
  const { checkDateAvailability, getNextAvailableDate } = useRoster();
  const [calendarPickerItemId, setCalendarPickerItemId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'HOTELS' | 'PRODUCTS' | 'VISAS' | 'PACKAGES'>('ALL');

  // Edit item modal state (Central GlobalConfiguratorRouter)
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined);

  // Booking Flow Modals
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isQuoteDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isQuoteDrawerOpen]);

  // ESC key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isQuoteDrawerOpen) {
        setIsQuoteDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuoteDrawerOpen, setIsQuoteDrawerOpen]);

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id);
    setEditingItem(item);
  };

  // Identify any products with Roster date conflicts
  const conflictedItems = useMemo(() => {
    return items.filter(item => {
      const check = checkDateAvailability(
        item.product.id,
        item.travelDate,
        item.pax.adults + item.pax.children
      );
      return !check.isAvailable;
    });
  }, [items, checkDateAvailability]);

  const hasRosterConflict = conflictedItems.length > 0;

  // Category counts
  const categoryCounts = useMemo(() => {
    let hotels = 0;
    let products = 0;
    let visas = 0;
    let packages = 0;

    items.forEach(item => {
      const cat = item.product.category?.toUpperCase() || '';
      const code = item.product.supplierProductCode || '';
      const sku = item.product.sku || '';
      const meta = (item as any).metadata;

      if (cat === 'ACCOMMODATION' || cat === 'HOTELS' || code.startsWith('SUP-HTL-') || meta?.hotelId) {
        hotels++;
      } else if (cat === 'VISA' || cat === 'VISA SERVICE' || sku.startsWith('VSA-') || meta?.visaProductId) {
        visas++;
      } else if (cat === 'PACKAGE' || meta?.isPackage) {
        packages++;
      } else {
        products++;
      }
    });

    return { hotels, products, visas, packages };
  }, [items]);

  // Filtered items based on active category filter
  const filteredItems = useMemo(() => {
    if (categoryFilter === 'ALL') return items;
    return items.filter(item => {
      const cat = item.product.category?.toUpperCase() || '';
      const code = item.product.supplierProductCode || '';
      const sku = item.product.sku || '';
      const meta = (item as any).metadata;

      if (categoryFilter === 'HOTELS') {
        return cat === 'ACCOMMODATION' || cat === 'HOTELS' || code.startsWith('SUP-HTL-') || meta?.hotelId;
      }
      if (categoryFilter === 'VISAS') {
        return cat === 'VISA' || cat === 'VISA SERVICE' || sku.startsWith('VSA-') || meta?.visaProductId;
      }
      if (categoryFilter === 'PACKAGES') {
        return cat === 'PACKAGE' || meta?.isPackage;
      }
      if (categoryFilter === 'PRODUCTS') {
        return !(cat === 'ACCOMMODATION' || cat === 'HOTELS' || code.startsWith('SUP-HTL-') || meta?.hotelId ||
                 cat === 'VISA' || cat === 'VISA SERVICE' || sku.startsWith('VSA-') || meta?.visaProductId ||
                 cat === 'PACKAGE' || meta?.isPackage);
      }
      return true;
    });
  }, [items, categoryFilter]);

  // Auto-resolve all blocked dates in 1 click
  const handleAutoResolveAllConflicts = () => {
    items.forEach(item => {
      const check = checkDateAvailability(
        item.product.id,
        item.travelDate,
        item.pax.adults + item.pax.children
      );
      if (!check.isAvailable) {
        const nextDate = getNextAvailableDate(item.product.id, item.travelDate);
        if (nextDate) {
          updateItemTravelDate(item.id, nextDate);
        }
      }
    });
  };

  // Primary Action: Open Booking Submission Flow
  const handleOpenBookingSubmission = () => {
    if (hasRosterConflict) return;
    setIsQuoteDrawerOpen(false);

    if (onSubmitBooking) {
      onSubmitBooking();
    } else {
      setIsSubmissionModalOpen(true);
    }
  };

  if (!isQuoteDrawerOpen && !isSubmissionModalOpen && !confirmedBooking) return null;

  const isAuthorized = canUserAccessB2BInventory(user).allowed;

  if (!isAuthorized) {
    if (!isQuoteDrawerOpen) return null;
    return (
      <div 
        className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-start animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsQuoteDrawerOpen(false);
          }
        }}
      >
        <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between p-6 sm:p-8 animate-in slide-in-from-left duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">B2B Quotation Cart</h3>
            <button 
              onClick={() => setIsQuoteDrawerOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center space-y-6 my-auto py-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-black text-slate-900">Authorised B2B Agent Access Only</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                This inventory and quotation cart is available exclusively to authorised B2B Agents. Please log in or register as a B2B Agent to continue.
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  setIsQuoteDrawerOpen(false);
                  openAuthModal('Sign in to access B2B inventory.');
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Login as B2B Agent</span>
              </button>
              <button
                onClick={() => {
                  setIsQuoteDrawerOpen(false);
                  openAuthModal('Register your agency to unlock wholesale inventory.');
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-[#00C6A6]" />
                <span>Become a B2B Partner</span>
              </button>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400 pt-4 border-t border-slate-100">
            Wholesale tariffs and supplier allocations are confidential trade materials.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Global Booking Submission Wizard Modal */}
      {isSubmissionModalOpen && (
        <BookingSubmissionModal
          isOpen={true}
          onClose={() => setIsSubmissionModalOpen(false)}
          onBackToCart={() => {
            setIsSubmissionModalOpen(false);
            setIsQuoteDrawerOpen(true);
          }}
          onBookingSuccess={(booking) => {
            setIsSubmissionModalOpen(false);
            if (onBookQuote) {
              onBookQuote(booking);
            } else {
              setConfirmedBooking(booking);
            }
          }}
        />
      )}

      {/* Global Booking Confirmation Modal */}
      {confirmedBooking && (
        <BookingConfirmationModal
          isOpen={true}
          onClose={() => setConfirmedBooking(null)}
          booking={confirmedBooking}
        />
      )}

      {/* Cart Drawer Panel (Left-Side) */}
      {isQuoteDrawerOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-start animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsQuoteDrawerOpen(false);
            }
          }}
        >
          <div 
            id="b2b-cart-drawer-left-panel"
            className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-left duration-300 border-r border-slate-200"
          >
            {/* Drawer Header (Fixed at top) */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0] shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#00E5C0]">
                      B2B Booking Cart
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="bg-[#00C6A6] text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                      {items.length} {items.length === 1 ? 'Product' : 'Products'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white font-sans mt-0.5">
                    Direct Booking Cart
                  </h2>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Cart Currency Switcher */}
                <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg">
                  <Globe2 className="w-3 h-3 text-[#00E5C0]" />
                  <select
                    id="cart-drawer-currency-select"
                    value={typeof currency === 'object' && currency !== null ? (currency as any).code : currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="bg-transparent text-white text-[11px] font-bold outline-none cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                {items.length > 0 && (
                  <button
                    onClick={clearQuote}
                    className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center space-x-1 font-bold cursor-pointer"
                    title="Clear all items in cart"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
                <button
                  id="close-quote-drawer-btn"
                  onClick={() => setIsQuoteDrawerOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close Cart (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Category Breakdown Tabs */}
            {items.length > 0 && (
              <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 flex items-center space-x-1.5 overflow-x-auto shrink-0 scrollbar-none">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  All Items ({items.length})
                </button>
                {categoryCounts.products > 0 && (
                  <button
                    onClick={() => setCategoryFilter('PRODUCTS')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1 ${
                      categoryFilter === 'PRODUCTS'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Compass className="w-3 h-3 text-emerald-600" />
                    <span>Tours & Transfers ({categoryCounts.products})</span>
                  </button>
                )}
                {categoryCounts.hotels > 0 && (
                  <button
                    onClick={() => setCategoryFilter('HOTELS')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1 ${
                      categoryFilter === 'HOTELS'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Building2 className="w-3 h-3 text-amber-600" />
                    <span>Hotels ({categoryCounts.hotels})</span>
                  </button>
                )}
                {categoryCounts.visas > 0 && (
                  <button
                    onClick={() => setCategoryFilter('VISAS')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1 ${
                      categoryFilter === 'VISAS'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <FileCheck className="w-3 h-3 text-blue-600" />
                    <span>Visa & Ancillary ({categoryCounts.visas})</span>
                  </button>
                )}
                {categoryCounts.packages > 0 && (
                  <button
                    onClick={() => setCategoryFilter('PACKAGES')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1 ${
                      categoryFilter === 'PACKAGES'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Layers className="w-3 h-3 text-indigo-600" />
                    <span>Packages ({categoryCounts.packages})</span>
                  </button>
                )}
              </div>
            )}

            {/* Drawer Scrollable Content Area */}
            <div className="overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5 flex-1 bg-slate-50/50 modal-body-scroll">
              {items.length === 0 ? (
                <div className="text-center py-14 px-4 bg-white rounded-3xl border border-slate-200 shadow-xs my-auto">
                  <div className="w-16 h-16 rounded-2xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center mx-auto mb-4 text-[#00a88c]">
                    <ShoppingBag className="w-8 h-8 text-[#008972]" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-1 font-sans">
                    Your Booking Cart is Empty
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                    Collect and configure contracted hotels, day tours, transfers, and visas from the catalog. Submit them directly as a booking request to operations.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto text-left">
                    <button
                      onClick={() => {
                        setIsQuoteDrawerOpen(false);
                        if (onNavigateToCatalog) onNavigateToCatalog('products');
                      }}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-center space-x-2.5 cursor-pointer group"
                    >
                      <Compass className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Tours & Activities</span>
                        <span className="text-[10px] text-slate-500">Day trips, guides, transfers</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsQuoteDrawerOpen(false);
                        if (onNavigateToCatalog) onNavigateToCatalog('hotels');
                      }}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-center space-x-2.5 cursor-pointer group"
                    >
                      <Building2 className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Contracted Hotels</span>
                        <span className="text-[10px] text-slate-500">Verified luxury hotels & availability</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsQuoteDrawerOpen(false);
                        if (onNavigateToCatalog) onNavigateToCatalog('visa');
                      }}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-center space-x-2.5 cursor-pointer group"
                    >
                      <FileCheck className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Visa & Ancillary Services</span>
                        <span className="text-[10px] text-slate-500">Official Visas, Protection & Ground</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsQuoteDrawerOpen(false);
                        if (onNavigateToCatalog) onNavigateToCatalog('packages');
                      }}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-center space-x-2.5 cursor-pointer group"
                    >
                      <Layers className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Ready-Made Circuits</span>
                        <span className="text-[10px] text-slate-500">Pre-costed packages</span>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Roster Conflict Warning Alert Banner */}
                  {hasRosterConflict && (
                    <div className="p-3.5 rounded-2xl bg-rose-950 border border-rose-700 text-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
                      <div className="flex items-start space-x-2.5">
                        <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-extrabold text-rose-200">
                            Roster Conflict: {conflictedItems.length} Service(s) Have Blocked Dates
                          </h4>
                          <p className="text-[11px] text-rose-300">
                            Zero-Risk Operational Policy: Direct booking is locked until dates are available in DMC Roster.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoResolveAllConflicts}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center space-x-1.5 shrink-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Auto-Fix Dates</span>
                      </button>
                    </div>
                  )}

                  {/* Selected Services Itemized List */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                        <span>Configured Products</span>
                        <span className="text-slate-400">({filteredItems.length})</span>
                      </h3>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Currency: {typeof currency === 'object' && currency !== null ? (currency as any).code : currency}
                      </span>
                    </div>

                    {filteredItems.map((item, idx) => {
                      const availability = checkDateAvailability(
                        item.product.id,
                        item.travelDate,
                        item.pax.adults + item.pax.children
                      );
                      const isCalendarOpen = calendarPickerItemId === item.id;
                      const cat = item.product.category?.toUpperCase() || '';
                      const isHotel = cat === 'ACCOMMODATION' || cat === 'HOTELS' || item.product.supplierProductCode?.startsWith('SUP-HTL-') || item.metadata?.hotelId;
                      const isVisa = cat === 'VISA' || cat === 'VISA SERVICE' || item.product.sku?.startsWith('VSA-') || item.metadata?.visaProductId;

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl bg-white border transition-all space-y-3 ${
                            !availability.isAvailable
                              ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/30'
                              : 'border-slate-200 hover:border-slate-300 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start space-x-3">
                              <span className={`w-6 h-6 rounded-full font-mono text-xs flex items-center justify-center shrink-0 ${
                                availability.isAvailable ? 'bg-slate-900 text-white font-bold' : 'bg-rose-600 text-white font-bold'
                              }`}>
                                {idx + 1}
                              </span>
                              <div>
                                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                    isHotel
                                      ? 'bg-amber-100 text-amber-900'
                                      : isVisa
                                      ? 'bg-blue-100 text-blue-900'
                                      : 'bg-slate-100 text-slate-800'
                                  }`}>
                                    {isHotel ? 'HOTEL STAY' : isVisa ? 'VISA & ANCILLARY' : item.product.category}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {item.product.city || item.product.destinationName}
                                  </span>
                                  {availability.isAvailable ? (
                                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded">
                                      <CalendarCheck className="w-3 h-3 text-emerald-600" />
                                      <span>Roster Confirmed</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.2 rounded">
                                      <CalendarX className="w-3 h-3 text-rose-600" />
                                      <span>Date Blocked</span>
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug mt-1">
                                  {item.customTitle || item.title || item.product.name}
                                </h4>
                                {item.railJourneyDetails && (
                                  <div className="mt-1.5 p-2 rounded-lg bg-teal-50 border border-teal-200 text-[11px] text-teal-950 flex flex-wrap items-center gap-1.5 font-medium">
                                    <span className="font-bold text-[#008972] flex items-center gap-1">
                                      <Train className="w-3.5 h-3.5" />
                                      {item.railJourneyDetails.originStationName} → {item.railJourneyDetails.destinationStationName}
                                    </span>
                                    <span>•</span>
                                    <span>{item.railJourneyDetails.carType} Car ({item.railJourneyDetails.seatType})</span>
                                    <span>•</span>
                                    <span className="font-semibold text-slate-700">{item.railJourneyDetails.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi Super Express' : 'Hikari / Kodama'}</span>
                                    {item.railJourneyDetails.seatPreference && (
                                      <>
                                        <span>•</span>
                                        <span className="text-slate-500">Pref: {item.railJourneyDetails.seatPreference}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 text-[11px] font-bold"
                                title="Configure parameters and options"
                              >
                                <Sliders className="w-3.5 h-3.5 text-[#008972]" />
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button
                                onClick={() => removeProductFromQuote(item.id)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove from cart"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Controls Row: Pax & Travel Date */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-100">
                            <div className="flex items-center space-x-2">
                              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <div className="flex items-center space-x-1.5 text-xs">
                                <span className="text-slate-500 font-medium">Adults:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={item.pax.adults}
                                  onChange={(e) =>
                                    updateItemPax(item.id, {
                                      ...item.pax,
                                      adults: Math.max(1, parseInt(e.target.value) || 1)
                                    })
                                  }
                                  className="w-12 bg-slate-50 border border-slate-200 rounded text-center font-bold text-xs py-0.5"
                                />
                                <span className="text-slate-500 font-medium ml-1">Child:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={15}
                                  value={item.pax.children}
                                  onChange={(e) =>
                                    updateItemPax(item.id, {
                                      ...item.pax,
                                      children: Math.max(0, parseInt(e.target.value) || 0)
                                    })
                                  }
                                  className="w-12 bg-slate-50 border border-slate-200 rounded text-center font-bold text-xs py-0.5"
                                />
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setCalendarPickerItemId(isCalendarOpen ? null : item.id)}
                                className="text-[11px] text-[#008972] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                                title="Open Roster Calendar"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{isCalendarOpen ? 'Close Roster' : 'Check Roster'}</span>
                              </button>
                              <input
                                type="date"
                                value={item.travelDate}
                                min={item.product.validityFrom}
                                max={item.product.validityTo}
                                onChange={(e) => updateItemTravelDate(item.id, e.target.value)}
                                className={`border rounded-lg text-xs px-2.5 py-1 font-mono font-medium ${
                                  availability.isAvailable
                                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                                    : 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Expandable Roster Calendar for this item */}
                          {isCalendarOpen && (
                            <div className="pt-2 border-t border-slate-100">
                              <RosterCalendarPicker
                                productId={item.product.id}
                                selectedDate={item.travelDate}
                                onSelectDate={(newDate) => {
                                  updateItemTravelDate(item.id, newDate);
                                }}
                                paxCount={item.pax.adults + item.pax.children}
                                minDate={item.product.validityFrom}
                                maxDate={item.product.validityTo}
                              />
                            </div>
                          )}

                          {/* Roster Conflict Alert & Quick-Fix Button */}
                          {!availability.isAvailable && (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-2">
                              <div className="flex items-start space-x-1.5">
                                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold block">
                                    Date Unavailable in DMC Inventory
                                  </span>
                                  <span className="text-[11px] text-rose-700">
                                    {availability.reason || 'This service is fully booked or blocked by operations.'}
                                  </span>
                                </div>
                              </div>
                              {availability.nextAvailableDate && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (availability.nextAvailableDate) {
                                      updateItemTravelDate(item.id, availability.nextAvailableDate);
                                    }
                                  }}
                                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                                >
                                  <CalendarCheck className="w-3.5 h-3.5" />
                                  <span>Switch to Next Available Date ({availability.nextAvailableDate})</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Pricing Details Breakdown */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Item Final Price</span>
                              <span className="font-black text-slate-900 font-mono text-sm">
                                {formatCurrency(item.calculation?.finalTotalSellingPrice || 0, currency)}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                All Inclusive
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer (Fixed at bottom) */}
            {items.length > 0 && (
              <div className="bg-slate-900 p-4 sm:p-5 border-t border-slate-800 shrink-0 space-y-4 pb-safe">
                
                {/* Price Breakdown */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Total ({items.length} {items.length === 1 ? 'Item' : 'Items'})
                    </span>
                    <span className="text-xs text-slate-400">
                      All taxes & fees included
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">
                      Final Price
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-white font-sans">
                      {formatCurrency(totalSellingPrice, currency)}
                    </span>
                  </div>
                </div>

                {/* Primary Direct Booking CTA Button */}
                <button
                  id="btn-submit-cart-booking"
                  disabled={hasRosterConflict || items.length === 0}
                  onClick={handleOpenBookingSubmission}
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center space-x-2 shadow-lg ${
                    hasRosterConflict || items.length === 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 shadow-[#00C6A6]/20 cursor-pointer hover:scale-[1.01]'
                  }`}
                >
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <span>SUBMIT BOOKING ({items.length} {items.length === 1 ? 'Item' : 'Items'})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Authoritative Category Configurator Router */}
      {editingItem && (
        <GlobalConfiguratorRouter
          isOpen={true}
          itemOrProduct={editingItem}
          portalOrigin="B2B_QUOTE_BUILDER"
          existingQuoteItemId={editingItemId || editingItem.id}
          initialTravelDate={editingItem.travelDate}
          initialAdults={editingItem.pax?.adults}
          initialChildren={editingItem.pax?.children}
          initialInfants={editingItem.pax?.infants}
          initialServiceTime={editingItem.serviceTime}
          initialNotes={editingItem.notes || editingItem.specialRequests}
          onClose={() => {
            setEditingItem(null);
            setEditingItemId(undefined);
          }}
          onSuccess={() => {
            setEditingItem(null);
            setEditingItemId(undefined);
          }}
        />
      )}
    </>
  );
};
