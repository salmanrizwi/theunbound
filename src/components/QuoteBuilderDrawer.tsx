import React, { useState, useMemo, useEffect } from 'react';
import { useQuotation } from '../context/QuotationContext';
import { useAuth } from '../context/AuthContext';
import { useRoster } from '../context/RosterContext';
import { formatCurrency } from '../services/pricingEngine';
import { RosterCalendarPicker } from './RosterCalendarPicker';
import { Quotation, Product, Hotel, CurrencyCode, SUPPORTED_CURRENCIES } from '../types';
import { googleCalendarAutomation } from '../services/googleCalendarAutomationService';
import { downloadQuotationPDF } from '../services/pdfGenerator';
import { INITIAL_HOTELS } from '../data/initialHotels';
import { INITIAL_VISAS } from '../data/initialVisas';
import { VisaProduct } from './B2BAgentPortal/B2BVisaView';
import { AddProductToQuoteModal } from './B2BAgentPortal/AddProductToQuoteModal';
import { AddHotelToQuoteModal } from './B2BAgentPortal/AddHotelToQuoteModal';
import { AddVisaToQuoteModal } from './B2BAgentPortal/AddVisaToQuoteModal';
import { 
  X, 
  Trash2, 
  FileDown, 
  Bookmark, 
  Calendar, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  Printer, 
  Check, 
  Lock,
  ArrowRight,
  Globe2,
  FileText,
  AlertTriangle,
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
  DollarSign
} from 'lucide-react';

interface QuoteBuilderDrawerProps {
  onBookQuote?: (quote: Quotation) => void;
  onNavigateToQuoteBuilder?: () => void;
  onNavigateToCatalog?: (tab: 'products' | 'hotels' | 'packages' | 'visa' | 'home') => void;
}

export const QuoteBuilderDrawer: React.FC<QuoteBuilderDrawerProps> = ({ 
  onBookQuote, 
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
    clientName,
    setClientName,
    clientEmail,
    setClientEmail,
    clientCompany,
    setClientCompany,
    agentNotes,
    setAgentNotes,
    totalNetCost,
    totalSellingPrice,
    totalMarginAmount,
    saveCurrentQuote
  } = useQuotation();

  const { user, role } = useAuth();
  const { checkDateAvailability, getNextAvailableDate } = useRoster();
  const isInternalUser = role === 'ADMIN' || role === 'DMC_STAFF';
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);
  const [showProposalPreview, setShowProposalPreview] = useState(false);
  const [calendarPickerItemId, setCalendarPickerItemId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'HOTELS' | 'PRODUCTS' | 'VISAS' | 'PACKAGES'>('ALL');

  // Edit item modals state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [editingVisa, setEditingVisa] = useState<VisaProduct | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined);

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
    const cat = item.product.category?.toUpperCase() || '';
    const code = item.product.supplierProductCode || '';
    const sku = item.product.sku || '';
    const meta = (item as any).metadata;

    // Check if Hotel
    if (cat === 'ACCOMMODATION' || cat === 'HOTELS' || code.startsWith('SUP-HTL-') || meta?.hotelId) {
      const hotel = INITIAL_HOTELS.find(h => 
        h.id === item.product.id || 
        h.id === meta?.hotelId ||
        code === `SUP-HTL-${h.id}` || 
        h.name.toLowerCase() === item.product.name.toLowerCase()
      ) || {
        id: item.product.id,
        name: item.product.name,
        code: item.product.sku || 'HTL-001',
        destinationId: item.product.destinationId,
        destinationName: item.product.destinationName,
        cityName: item.product.city,
        country: item.product.country,
        starRating: 5,
        propertyType: 'HOTEL',
        shortDescription: item.product.shortDescription,
        description: item.product.longDescription || item.product.shortDescription,
        heroImage: item.product.heroImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop',
        images: [],
        address: item.product.city,
        amenities: ['Free WiFi', 'Breakfast Included', 'Concierge'],
        roomTypes: [
          {
            id: 'room-std',
            name: 'Deluxe Room',
            rates: [
              {
                id: 'rate-1',
                seasonName: 'Standard',
                validFrom: item.product.validityFrom || '2025-01-01',
                validTo: item.product.validityTo || '2026-12-31',
                singleNetRate: 300,
                doubleNetRate: item.calculation?.adultPricePerPax || item.product.adultNetPrice || 350,
                tripleNetRate: 450,
                adultNettCost: item.calculation?.adultPricePerPax || item.product.adultNetPrice || 350,
                childNettCost: 150,
                infantNettCost: 0,
                markupPercent: 18,
                currency: 'USD'
              }
            ]
          }
        ]
      } as unknown as Hotel;
      setEditingHotel(hotel);
      return;
    }

    // Check if Visa
    if (cat === 'VISA' || cat === 'VISA SERVICE' || sku.startsWith('VSA-') || meta?.visaProductId) {
      const visa = INITIAL_VISAS.find(v => 
        v.id === item.product.id || 
        v.id === meta?.visaProductId ||
        sku.includes(v.countryCode) ||
        v.country.toLowerCase() === item.product.country.toLowerCase()
      ) || {
        id: item.product.id,
        country: item.product.country,
        countryCode: item.product.country.substring(0, 2).toUpperCase(),
        visaType: item.product.name,
        entryType: 'SINGLE_ENTRY',
        validityDays: 90,
        stayDurationDays: 15,
        processingTimeDays: 5,
        expressProcessingAvailable: true,
        expressProcessingTimeDays: 2,
        embassyFee: 30,
        serviceFee: 25,
        expressServiceFee: 50,
        currency: 'USD',
        description: item.product.shortDescription,
        documentsChecklist: ['Valid Passport', 'Passport Photograph', 'Return Flight Ticket'],
        category: 'Tourist',
        validity: '90 Days'
      } as unknown as VisaProduct;
      setEditingVisa(visa);
      return;
    }

    // Standard Tour / Transfer / Activity Product
    setEditingProduct(item.product);
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

  const handleSaveQuote = () => {
    if (hasRosterConflict) return;
    const saved = saveCurrentQuote();
    if (saved) {
      setIsSavedSuccessfully(true);
      setTimeout(() => setIsSavedSuccessfully(false), 3000);
    }
  };

  const handleProceedToQuoteBuilder = () => {
    saveCurrentQuote();
    setIsQuoteDrawerOpen(false);
    if (onNavigateToQuoteBuilder) {
      onNavigateToQuoteBuilder();
    }
  };

  const handleDownloadPDF = () => {
    try {
      const activeQuote = saveCurrentQuote();
      if (activeQuote) {
        downloadQuotationPDF({
          quote: activeQuote,
          agentName: user?.name,
          agentAgency: user?.agencyName,
          agentEmail: user?.email,
          agentRole: user?.role
        });

        try {
          googleCalendarAutomation.triggerQuoteFollowUpSLA(activeQuote, user);
        } catch (e) {
          console.debug('PDF follow-up SLA automation note:', e);
        }
      }
    } catch (err) {
      console.error('Error generating PDF quote:', err);
    }
  };

  const handlePrintProposal = () => {
    try {
      const activeQuote = saveCurrentQuote();
      if (activeQuote) {
        googleCalendarAutomation.triggerQuoteFollowUpSLA(activeQuote, user);
      }
    } catch (e) {
      console.debug('PDF follow-up SLA automation note:', e);
    }
    window.print();
  };

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
                  B2B Cart & Workspace
                </span>
                <span className="text-slate-600">•</span>
                <span className="bg-[#00C6A6] text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                  {items.length} {items.length === 1 ? 'Service' : 'Services'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white font-sans">
                Staged Itinerary Workspace
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Cart Currency Switcher */}
            <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg">
              <Globe2 className="w-3 h-3 text-[#00E5C0]" />
              <select
                id="cart-drawer-currency-select"
                value={currency}
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
                title="Clear all staged items in cart"
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
                <span>Visas ({categoryCounts.visas})</span>
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
        <div className="overflow-y-auto p-4 sm:p-5 space-y-5 flex-1 bg-slate-50/50">
          {items.length === 0 ? (
            <div className="text-center py-14 px-4 bg-white rounded-3xl border border-slate-200 shadow-xs my-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center mx-auto mb-4 text-[#00a88c]">
                <ShoppingBag className="w-8 h-8 text-[#008972]" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1 font-sans">
                Your B2B Travel Cart is Empty
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                Collect and configure contracted hotels, private tours, transfers, and visas from the catalogue. They will stage here before you generate an official client quotation.
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
                    <span className="text-[10px] text-slate-500">5★ luxury & boutique stays</span>
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
                    <span className="text-xs font-bold text-slate-900 block">Turnkey Packages</span>
                    <span className="text-[10px] text-slate-500">Curated multi-day itineraries</span>
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
                    <span className="text-xs font-bold text-slate-900 block">Visa Services</span>
                    <span className="text-[10px] text-slate-500">Express tourist e-visas</span>
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
                        Zero-Risk Operational Policy: Quotation and proposal generation is locked until dates are available in DMC Roster.
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
                    <span>Configured Travel Services</span>
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
                                {isHotel ? 'HOTEL STAY' : isVisa ? 'VISA SERVICE' : item.product.category}
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
                              {item.product.name}
                            </h4>
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
                            <span className="hidden sm:inline">Configure</span>
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
                            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold text-rose-900">Roster Conflict on {item.travelDate}: </span>
                              <span className="text-rose-700">{availability.reason}</span>
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-rose-200 flex items-center justify-between">
                            <span className="text-[10px] text-rose-600">Booking locked to prevent supplier discrepancy.</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = getNextAvailableDate(item.product.id, item.travelDate);
                                if (next) updateItemTravelDate(item.id, next);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-colors cursor-pointer shadow-xs"
                            >
                              <span>Auto-Fix to Next Open Date</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Item Financial Summary */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                        <div className="text-slate-500 text-[11px]">
                          {isInternalUser ? (
                            <span>B2B Net: <span className="font-mono font-bold text-slate-800">{formatCurrency(item.calculation.totalNetCost, currency)}</span></span>
                          ) : (
                            <span>Wholesale Rate: <span className="font-mono font-bold text-slate-800">{formatCurrency(item.calculation.adultPricePerPax, currency)} / pax</span></span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Staged Selling Total</span>
                          <span className="font-black text-sm text-slate-900 font-mono">
                            {formatCurrency(item.calculation.finalTotalSellingPrice, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Client & Itinerary Quick-Reference Details */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#008972]" />
                    <span>Client & Proposal Reference</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">Carries into Quotation Builder</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Client Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Mr. & Mrs. Anderson"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Client Email</label>
                    <input
                      type="email"
                      placeholder="client@luxurytravel.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Company / Agency</label>
                    <input
                      type="text"
                      placeholder="VIP Travel Club"
                      value={clientCompany}
                      onChange={(e) => setClientCompany(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Internal Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Special anniversary greetings, dietary preferences, executive vehicle upgrade requested."
                    value={agentNotes}
                    onChange={(e) => setAgentNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer Fixed Footer */}
        {items.length > 0 && (
          <div className="bg-slate-900 text-white p-4 sm:p-5 border-t border-slate-800 shrink-0 space-y-3.5">
            {/* Workflow Step Bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pb-2 border-b border-slate-800">
              <span className="flex items-center space-x-1 text-[#00E5C0] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C0]" />
                <span>1. Cart Workspace</span>
              </span>
              <span>→</span>
              <span className="font-semibold text-slate-300">2. Quote Builder</span>
              <span>→</span>
              <span className="text-slate-400">3. Proposal Document</span>
              <span>→</span>
              <span className="text-slate-400">4. Confirmation</span>
            </div>

            {/* Price Breakdown */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Wholesale Net Cost
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-300 font-mono">
                  {formatCurrency(totalNetCost, currency)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">
                  Total Client Selling Price
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white font-sans">
                  {formatCurrency(totalSellingPrice, currency)}
                </span>
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="space-y-2 pt-1">
              {/* Primary CTA: Transfer to Quotation Builder */}
              <button
                id="btn-proceed-to-quote-builder"
                disabled={hasRosterConflict}
                onClick={handleProceedToQuoteBuilder}
                className={`w-full py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center space-x-2 shadow-lg ${
                  hasRosterConflict
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 shadow-[#00C6A6]/20 cursor-pointer hover:scale-[1.01]'
                }`}
              >
                <span>Proceed to Build Quotation</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Secondary Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="btn-save-cart-quote"
                  disabled={hasRosterConflict}
                  onClick={handleSaveQuote}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 ${
                    hasRosterConflict
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer'
                  }`}
                  title="Save current cart state as quote draft"
                >
                  {isSavedSuccessfully ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5 text-[#00C6A6]" />
                      <span>Save Draft</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-download-pdf-quote"
                  disabled={hasRosterConflict}
                  onClick={handleDownloadPDF}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                    hasRosterConflict
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs'
                  }`}
                  title="Download clean PDF quotation"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF Quote</span>
                </button>

                <button
                  id="btn-preview-proposal"
                  disabled={hasRosterConflict}
                  onClick={() => setShowProposalPreview(true)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                    hasRosterConflict
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer border border-slate-700'
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Proposal</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Client Proposal Printable PDF Viewer */}
        {showProposalPreview && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Proposal Modal Header */}
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Globe2 className="w-5 h-5 text-[#00C6A6]" />
                  <span className="font-bold text-sm">Official Client Travel Proposal</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm"
                    title="Download clean formatted PDF quotation document"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download as PDF</span>
                  </button>
                  <button
                    onClick={handlePrintProposal}
                    className="flex items-center space-x-1.5 bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-700 cursor-pointer border border-slate-700"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => setShowProposalPreview(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Itinerary Document Body */}
              <div className="overflow-y-auto p-8 space-y-6 text-slate-900 bg-white" id="printable-client-proposal">
                {/* Brand & Reference Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div>
                    {role === 'B2B_AGENT' || role === 'AGENT' ? (
                      <>
                        <h1 className="text-2xl font-black font-sans tracking-tight text-slate-900">
                          {user?.name || 'Travel Agent Partner'}
                        </h1>
                        <p className="text-xs uppercase tracking-widest text-[#008972] font-bold">
                          {user?.agencyName || 'Authorized Travel Partner Agency'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Tailored Travel Itinerary • In Association with TheUnbound DMC
                        </p>
                      </>
                    ) : (
                      <>
                        <h1 className="text-2xl font-black font-sans tracking-tight text-slate-900">TheUnbound</h1>
                        <p className="text-xs uppercase tracking-widest text-[#008972] font-bold">
                          Destination Management Company (DMC)
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Direct Ground Logistics & Tour Operations Hub
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          sales@theunbound.in • Landline: 011-41185542 • Mobile: +91-9811654959, +91-9718894959
                        </p>
                      </>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-slate-900">
                      REF: UBQ-2026-{Math.floor(1000 + Math.random() * 9000)}
                    </p>
                    <p className="text-xs text-slate-500">Date: {new Date().toLocaleDateString()}</p>
                    <p className="text-xs text-slate-700 font-semibold mt-1">
                      {role === 'B2B_AGENT' || role === 'AGENT'
                        ? `Agent: ${user?.name || 'B2B Agent'} (${user?.agencyName || 'Agency'})`
                        : role === 'ADMIN'
                        ? `DMC Operator: TheUnbound (Admin: ${user?.name || 'Marcus Vance'})`
                        : `DMC Operator: TheUnbound (Team Member: ${user?.name || 'Kenji Sato'})`}
                    </p>
                  </div>
                </div>

                {/* Client Reference Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Valued Guest / Client:</p>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">{clientName || 'Private Client Group'}</p>
                    {clientEmail && <p className="text-slate-600">{clientEmail}</p>}
                    {clientCompany && <p className="text-slate-600">{clientCompany}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Quotation Status:</p>
                    <p className="font-bold text-emerald-700 text-sm mt-0.5">CONFIRMED ITINERARY RATES</p>
                    <p className="text-slate-500">Valid for 14 calendar days</p>
                  </div>
                </div>

                {/* Detailed Line Items Table */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
                    Curated Itinerary Products & Services
                  </h3>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-500">
                        <th className="py-2 font-semibold">Service Description</th>
                        <th className="py-2 font-semibold">Destination / City</th>
                        <th className="py-2 font-semibold">Date</th>
                        <th className="py-2 font-semibold">Pax</th>
                        <th className="py-2 font-semibold text-right">Published Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-3 font-bold text-slate-900">{item.product.name}</td>
                          <td className="py-3 text-slate-600">{item.product.destinationName} ({item.product.city})</td>
                          <td className="py-3 text-slate-600 font-mono">{item.travelDate}</td>
                          <td className="py-3 text-slate-600">{item.pax.adults}A {item.pax.children > 0 ? `${item.pax.children}C` : ''}</td>
                          <td className="py-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.calculation.finalTotalSellingPrice, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Final Price Summary Box */}
                <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-baseline">
                  <div>
                    <p className="text-xs font-bold text-slate-900">All-Inclusive Contracted Rate</p>
                    <p className="text-[11px] text-slate-500">Fully scheduled ground logistics, licensed guide allocation, and destination inclusions.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Total Quotation Value:</span>
                    <span className="text-2xl font-black text-slate-950 font-sans">
                      {formatCurrency(totalSellingPrice, currency)}
                    </span>
                  </div>
                </div>

                {/* Terms and Sign-off */}
                <div className="bg-slate-50 p-4 rounded-xl text-[11px] text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">Terms & Conditions:</p>
                  <p>1. Services are held on provisional allotment and subject to ground supplier confirmation upon written voucher deposit.</p>
                  <p>2. Chauffeur waiting times and baggage assistance adhere strictly to DMC standard operating protocol.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Edit Modals */}
        <AddProductToQuoteModal
          product={editingProduct}
          existingItemId={editingItemId}
          isOpen={Boolean(editingProduct)}
          onClose={() => {
            setEditingProduct(null);
            setEditingItemId(undefined);
          }}
        />

        <AddHotelToQuoteModal
          hotel={editingHotel}
          existingItemId={editingItemId}
          isOpen={Boolean(editingHotel)}
          onClose={() => {
            setEditingHotel(null);
            setEditingItemId(undefined);
          }}
        />

        <AddVisaToQuoteModal
          visa={editingVisa}
          existingItemId={editingItemId}
          isOpen={Boolean(editingVisa)}
          onClose={() => {
            setEditingVisa(null);
            setEditingItemId(undefined);
          }}
        />
      </div>
    </div>
  );
};
