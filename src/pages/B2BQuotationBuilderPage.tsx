import React, { useState, useMemo, useEffect } from 'react';
import { Product, Destination, CurrencyCode, QuoteItem, Quotation, Hotel } from '../types';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { useRoster } from '../context/RosterContext';
import { formatCurrency, convertCurrency, calculateProductPrice } from '../services/pricingEngine';
import { RosterCalendarPicker } from '../components/RosterCalendarPicker';
import { CurrencyConverterWidget } from '../components/CurrencyConverterWidget';
import { B2BProductRowCard } from '../components/B2BProductRowCard';
import { B2BHotelRowCard } from '../components/B2BHotelRowCard';
import { HotelDetailModal } from '../components/HotelDetailModal';
import { AppDatabase } from '../services/db';
import { hotelToProduct } from '../utils/hotelHelpers';
import { downloadQuotationPDF } from '../services/pdfGenerator';
import { GoogleTasksService } from '../services/googleTasksService';
import { 
  Building2, 
  MapPin, 
  Clock, 
  Star, 
  Calendar, 
  Users, 
  Plus, 
  Trash2, 
  Eye, 
  Sparkles, 
  FileText, 
  FileDown,
  Check, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Filter, 
  Lock, 
  DollarSign, 
  Percent, 
  ArrowRight, 
  Share2, 
  Printer, 
  ShieldCheck, 
  Briefcase, 
  HelpCircle,
  X,
  Layers,
  CalendarX,
  CalendarCheck,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  AlertOctagon,
  Bed,
  Compass,
  CheckCircle2
} from 'lucide-react';

export type QuotationScope = 'LAND_ONLY' | 'HOTEL_LAND' | 'HOTEL_ONLY';

interface B2BQuotationBuilderPageProps {
  destinations: Destination[];
  products: Product[];
  onViewProductDetails: (product: Product) => void;
  onOpenSpecs?: () => void;
  onBookQuotation?: (quotation: Quotation) => void;
}

export const B2BQuotationBuilderPage: React.FC<B2BQuotationBuilderPageProps> = ({
  destinations,
  products,
  onViewProductDetails,
  onOpenSpecs,
  onBookQuotation
}) => {
  const { user, role } = useAuth();
  const { 
    items, 
    currency, 
    setCurrency, 
    addProductToQuote, 
    removeProductFromQuote, 
    updateItemPax, 
    updateItemTravelDate,
    toggleItemAddon,
    clearQuote,
    clientName,
    setClientName,
    clientEmail,
    setClientEmail,
    clientCompany,
    setClientCompany,
    agentNotes,
    setAgentNotes,
    overallDiscountPercent,
    setOverallDiscountPercent,
    saveCurrentQuote
  } = useQuotation();

  const { checkDateAvailability, getNextAvailableDate } = useRoster();

  // Quotation Scope: Land Part vs Hotel & Land Part vs Hotel Only
  const [quotationScope, setQuotationScope] = useState<QuotationScope>('HOTEL_LAND');
  const [hotelLandViewMode, setHotelLandViewMode] = useState<'ALL' | 'HOTELS' | 'LAND'>('ALL');

  // Database and Live Hotels
  const db = AppDatabase.getInstance();
  const [hotels, setHotels] = useState<Hotel[]>(() => db.getHotels());
  const [inspectingHotel, setInspectingHotel] = useState<Hotel | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setHotels(db.getHotels());
    });
  }, [db]);

  // STEP 1: Destination Category Selection
  const [selectedDestinationSlug, setSelectedDestinationSlug] = useState<string>('all');

  // STEP 2: Filters & Search in Calculator Workspace
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedDuration, setSelectedDuration] = useState<string>('ALL');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('ALL');

  // Catalog inspection modal
  const [rosterPreviewProduct, setRosterPreviewProduct] = useState<Product | null>(null);

  // Sidebar controls
  const [agentClientMarkupPercent, setAgentClientMarkupPercent] = useState<number>(12); // Default 12% agent margin
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [sidebarCalendarItemId, setSidebarCalendarItemId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Final Quote Modal State
  const [isQuoteResultModalOpen, setIsQuoteResultModalOpen] = useState(false);
  const [activeQuoteTab, setActiveQuoteTab] = useState<'AGENT_WHOLESALE' | 'CLIENT_PROPOSAL'>('AGENT_WHOLESALE');
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedSuccessQuote, setSavedSuccessQuote] = useState<Quotation | null>(null);

  // Check for any Roster date conflicts in added items
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

  // Auto-resolve all blocked dates to earliest open slots
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

  // Handle Add to Itinerary with full inline dropdown parameters (without popping drawer)
  const handleAddProductFromDropdown = (
    product: Product,
    options: {
      adults: number;
      children: number;
      infants: number;
      travelDate: string;
      selectedAddonIds: string[];
      timeSlot?: string;
      notes?: string;
    }
  ) => {
    addProductToQuote(product, {
      adults: options.adults,
      children: options.children,
      infants: options.infants,
      travelDate: options.travelDate,
      selectedAddonIds: options.selectedAddonIds,
      openDrawer: false
    });
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId(null), 1800);
  };

  // Handle Add Hotel Stay to Itinerary
  const handleAddHotelStayToQuote = (
    hotelProduct: Product,
    options: {
      adults: number;
      children: number;
      infants: number;
      travelDate: string;
      nights: number;
      roomsCount: number;
      roomName: string;
      mealPlan: string;
    }
  ) => {
    addProductToQuote(hotelProduct, {
      adults: options.adults,
      children: options.children,
      infants: options.infants,
      travelDate: options.travelDate,
      selectedAddonIds: [],
      openDrawer: false
    });
    setJustAddedId(hotelProduct.id);
    setTimeout(() => setJustAddedId(null), 1800);
  };

  // Handle Quick Add to Sidebar without opening drawer
  const handleQuickAdd = (product: Product) => {
    const nextDate = getNextAvailableDate(product.id) || new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
    addProductToQuote(product, {
      adults: Math.max(1, product.minPax || 2),
      children: 0,
      infants: 0,
      travelDate: nextDate,
      selectedAddonIds: [],
      openDrawer: false
    });
    setJustAddedId(product.id);
    setTimeout(() => setJustAddedId(null), 1800);
  };

  // Destination category items for Step 1
  const destinationOptions = useMemo(() => {
    return [
      { slug: 'all', name: 'All Destinations', country: 'Global', count: products.length + hotels.length },
      ...destinations.map(d => {
        const destProds = products.filter(p => p.destinationSlug === d.slug || p.destinationName.toLowerCase().includes(d.name.toLowerCase()));
        const destHotels = hotels.filter(h => h.destinationId === d.id || h.destinationId === d.slug || h.country.toLowerCase().includes(d.name.toLowerCase()));
        return {
          slug: d.slug,
          name: d.name,
          country: d.country,
          count: destProds.length + destHotels.length
        };
      })
    ];
  }, [destinations, products, hotels]);

  // Filter products by selected destination
  const destinationFilteredProducts = useMemo(() => {
    if (selectedDestinationSlug === 'all') return products;
    const dest = destinations.find(d => d.slug === selectedDestinationSlug);
    if (!dest) return products;
    return products.filter(
      p => p.destinationSlug === dest.slug || p.destinationName.toLowerCase().includes(dest.name.toLowerCase())
    );
  }, [products, selectedDestinationSlug, destinations]);

  // Filter hotels by selected destination
  const destinationFilteredHotels = useMemo(() => {
    const published = hotels.filter(h => h.status === 'PUBLISHED' || !h.status);
    let list = published;

    if (selectedDestinationSlug !== 'all') {
      const dest = destinations.find(d => d.slug === selectedDestinationSlug);
      if (dest) {
        list = list.filter(h => 
          h.destinationId === dest.id || 
          h.destinationId === dest.slug || 
          h.country.toLowerCase().includes(dest.name.toLowerCase()) ||
          h.destinationName.toLowerCase().includes(dest.name.toLowerCase())
        );
      }
    }

    if (selectedCity !== 'ALL') {
      list = list.filter(h => 
        h.cityName.toLowerCase() === selectedCity.toLowerCase() ||
        h.cityId.toLowerCase() === selectedCity.toLowerCase() ||
        h.area.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(h => 
        h.name.toLowerCase().includes(q) ||
        h.cityName.toLowerCase().includes(q) ||
        h.area.toLowerCase().includes(q) ||
        h.code.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [hotels, selectedDestinationSlug, destinations, selectedCity, searchQuery]);

  // Unique categories for active destination
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    destinationFilteredProducts.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [destinationFilteredProducts]);

  // Unique cities for active destination
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    destinationFilteredProducts.forEach(p => {
      if (p.city) set.add(p.city);
    });
    destinationFilteredHotels.forEach(h => {
      if (h.cityName) set.add(h.cityName);
    });
    return Array.from(set);
  }, [destinationFilteredProducts, destinationFilteredHotels]);

  // Filtered products for List View
  const listProducts = useMemo(() => {
    return destinationFilteredProducts.filter(p => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCity = p.city.toLowerCase().includes(q);
        const matchesDesc = p.shortDescription.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        if (!matchesName && !matchesCity && !matchesDesc && !matchesSku) return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }

      // City
      if (selectedCity !== 'ALL' && p.city.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }

      // Duration
      if (selectedDuration !== 'ALL') {
        if (selectedDuration === 'HALF_DAY' && !p.duration.toLowerCase().includes('hour') && !p.duration.toLowerCase().includes('half')) return false;
        if (selectedDuration === 'FULL_DAY' && !p.duration.toLowerCase().includes('day') && !p.duration.toLowerCase().includes('7') && !p.duration.toLowerCase().includes('8')) return false;
      }

      // Availability
      if (selectedAvailability !== 'ALL' && p.availability !== selectedAvailability) {
        return false;
      }

      return true;
    });
  }, [destinationFilteredProducts, searchQuery, selectedCategory, selectedCity, selectedDuration, selectedAvailability]);

  // Calculate final B2B quote across all added items
  const b2bCalculatedItems = useMemo(() => {
    return items.map(item => {
      const calc = calculateProductPrice(item.product, {
        productId: item.product.id,
        pricingTier: 'B2B',
        adults: item.pax.adults,
        children: item.pax.children,
        infants: item.pax.infants,
        travelDate: item.travelDate,
        targetCurrency: currency,
        selectedAddonIds: item.selectedAddonIds,
        agentClientMarkupPercent: agentClientMarkupPercent
      });
      return {
        ...item,
        b2bCalc: calc
      };
    });
  }, [items, currency, agentClientMarkupPercent]);

  // Overall financial summary for B2B quote
  const b2bTotals = useMemo(() => {
    let totalSupplierNet = 0;
    let totalDmcWholesaleNet = 0;
    let totalAgentProfit = 0;
    let totalTaxes = 0;
    let totalServiceFees = 0;
    let totalClientSellingPrice = 0;
    let totalPax = 0;

    // Itemized breakdown: Hotels vs Land
    let hotelItemsCount = 0;
    let landItemsCount = 0;
    let hotelSellingPrice = 0;
    let landSellingPrice = 0;
    let hotelWholesaleNet = 0;
    let landWholesaleNet = 0;

    b2bCalculatedItems.forEach(item => {
      totalSupplierNet += item.b2bCalc.totalNetCost;
      totalDmcWholesaleNet += item.b2bCalc.b2bWholesaleNetToAgent;
      totalAgentProfit += item.b2bCalc.agentProfitAmount;
      totalTaxes += item.b2bCalc.taxAmount;
      totalServiceFees += item.b2bCalc.serviceFee;
      totalClientSellingPrice += item.b2bCalc.finalTotalSellingPrice;
      totalPax += (item.pax.adults + item.pax.children);

      const isHotel = item.product.category === 'Hotels' || item.product.sku.startsWith('HTL-') || item.product.sku.startsWith('STAY-');
      if (isHotel) {
        hotelItemsCount++;
        hotelSellingPrice += item.b2bCalc.finalTotalSellingPrice;
        hotelWholesaleNet += item.b2bCalc.b2bWholesaleNetToAgent;
      } else {
        landItemsCount++;
        landSellingPrice += item.b2bCalc.finalTotalSellingPrice;
        landWholesaleNet += item.b2bCalc.b2bWholesaleNetToAgent;
      }
    });

    if (overallDiscountPercent > 0) {
      const discount = totalClientSellingPrice * (overallDiscountPercent / 100);
      totalClientSellingPrice -= discount;
      totalAgentProfit -= discount;
    }

    const dmcGrossMargin = totalDmcWholesaleNet - totalSupplierNet;

    return {
      totalSupplierNet,
      totalDmcWholesaleNet,
      totalAgentProfit,
      dmcGrossMargin,
      totalTaxes,
      totalServiceFees,
      totalClientSellingPrice,
      totalPax: totalPax || 2,
      pricePerPax: totalPax > 0 ? totalClientSellingPrice / totalPax : totalClientSellingPrice,
      hotelItemsCount,
      landItemsCount,
      hotelSellingPrice,
      landSellingPrice,
      hotelWholesaleNet,
      landWholesaleNet
    };
  }, [b2bCalculatedItems, overallDiscountPercent]);

  const handleCreateQuoteClick = () => {
    if (items.length === 0) return;
    setIsQuoteResultModalOpen(true);
  };

  const handleSaveQuote = () => {
    const saved = saveCurrentQuote();
    if (saved) {
      setSavedSuccessQuote(saved);
      setTimeout(() => setSavedSuccessQuote(null), 3000);
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
          GoogleTasksService.getInstance().schedulePdfQuoteFollowUpTask(activeQuote, user);
        } catch (e) {
          console.debug('PDF follow-up task note:', e);
        }
      }
    } catch (err) {
      console.error('Error generating PDF quote:', err);
    }
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const currencies: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: B2B Workspace Header */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00C6A6]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
                <Briefcase className="w-3.5 h-3.5" />
                <span>B2B Travel Agent Quotation Studio</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Wholesale DMC Contract Rates
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              B2B Itinerary & Price Quotation Builder
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Select destinations, filter ground products in confidential list mode, add tours into the compact itinerary sidebar, and compute fully itemized wholesale quotations.
            </p>
          </div>

          {/* Quick Agent Context Badge & Currency */}
          <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#00E5C0] block">Authenticated Partner</span>
              <span className="text-xs font-bold text-white block">{user?.agencyName || 'Luxury Partner Agency'}</span>
              <span className="text-[11px] text-slate-400 font-mono">Agent: {user?.name || 'Elena Rostova'}</span>
            </div>

            <div className="pt-2 sm:pt-0 sm:pl-4 sm:border-l border-slate-700 space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block">Quote Currency & Live FX</label>
              <CurrencyConverterWidget compact={true} />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: SELECT DESTINATION FROM CATEGORY */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-[#00C6A6] text-slate-950 font-extrabold text-xs flex items-center justify-center">
              1
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Step 1: Select Destination from Category
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {destinationFilteredProducts.length} contracted products in region
          </span>
        </div>

        {/* Destination Category Pills */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {destinationOptions.map(dest => {
            const isSelected = selectedDestinationSlug === dest.slug;
            return (
              <button
                key={dest.slug}
                id={`b2b-dest-pill-${dest.slug}`}
                onClick={() => {
                  setSelectedDestinationSlug(dest.slug);
                  setSelectedCity('ALL');
                  setSelectedCategory('ALL');
                }}
                className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 ring-2 ring-[#00C6A6]'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                }`}
              >
                <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
                <span>{dest.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-[#00C6A6] text-slate-950 font-bold' : 'bg-slate-200 text-slate-600'
                }`}>
                  {dest.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1.5: QUOTATION SCOPE SELECTION (Land Part vs Hotel & Land Part vs Hotel) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center">
              ✦
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Quotation Structure & Scope
              </h2>
              <p className="text-xs text-slate-500">
                Select your package components. Relevant inventory and calculations will dynamically adapt.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200/80">
            <span>Active:</span>
            <strong className="text-slate-900">
              {quotationScope === 'LAND_ONLY' ? 'Land Part Only' : quotationScope === 'HOTEL_ONLY' ? 'Hotels Only' : 'Hotel & Land Part (Package)'}
            </strong>
          </span>
        </div>

        {/* 3 Scope Selector Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* 1. Land Part */}
          <button
            type="button"
            id="scope-btn-land-only"
            onClick={() => setQuotationScope('LAND_ONLY')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
              quotationScope === 'LAND_ONLY'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-[#00C6A6]'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${quotationScope === 'LAND_ONLY' ? 'bg-[#00C6A6] text-slate-950' : 'bg-slate-200 text-slate-700'}`}>
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Land Part</span>
                {quotationScope === 'LAND_ONLY' && <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6]" />}
              </div>
              <p className={`text-[11px] mt-0.5 leading-snug ${quotationScope === 'LAND_ONLY' ? 'text-slate-300' : 'text-slate-500'}`}>
                Guided tours, private transfers, day excursions & activities.
              </p>
            </div>
          </button>

          {/* 2. Hotel & Land Part */}
          <button
            type="button"
            id="scope-btn-hotel-land"
            onClick={() => setQuotationScope('HOTEL_LAND')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
              quotationScope === 'HOTEL_LAND'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-[#00C6A6]'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${quotationScope === 'HOTEL_LAND' ? 'bg-[#00C6A6] text-slate-950' : 'bg-slate-200 text-slate-700'}`}>
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Hotel & Land Part</span>
                {quotationScope === 'HOTEL_LAND' && <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6]" />}
              </div>
              <p className={`text-[11px] mt-0.5 leading-snug ${quotationScope === 'HOTEL_LAND' ? 'text-slate-300' : 'text-slate-500'}`}>
                Complete Itinerary: 5★ hotel accommodations + all ground tours.
              </p>
            </div>
          </button>

          {/* 3. Hotel Only */}
          <button
            type="button"
            id="scope-btn-hotel-only"
            onClick={() => setQuotationScope('HOTEL_ONLY')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
              quotationScope === 'HOTEL_ONLY'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-[#00C6A6]'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${quotationScope === 'HOTEL_ONLY' ? 'bg-[#00C6A6] text-slate-950' : 'bg-slate-200 text-slate-700'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Hotel</span>
                {quotationScope === 'HOTEL_ONLY' && <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6]" />}
              </div>
              <p className={`text-[11px] mt-0.5 leading-snug ${quotationScope === 'HOTEL_ONLY' ? 'text-slate-300' : 'text-slate-500'}`}>
                Contracted 5★ luxury stays, suites, ryokans & resorts.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 2: CALCULATOR WORKSPACE & RELEVANT FILTERS (LEFT LIST + RIGHT SIDEBAR) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-[#00C6A6] text-slate-950 font-extrabold text-xs flex items-center justify-center">
              2
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Step 2: Quotation Calculator & Product Catalog
            </h2>
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Confidential B2B Mode • Rates Hidden in Discovery List</span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
          {/* Keyword Search */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={quotationScope === 'HOTEL_ONLY' ? "Search hotel name, area, code..." : "Search tours, hotels, SKU, keywords..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
            />
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#00C6A6] focus:bg-white cursor-pointer"
            >
              <option value="ALL">All Categories ({availableCategories.length})</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#00C6A6] focus:bg-white cursor-pointer"
            >
              <option value="ALL">All City Hubs ({availableCities.length})</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="lg:col-span-2 flex items-center">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setSelectedCity('ALL');
                setSelectedDuration('ALL');
                setSelectedAvailability('ALL');
              }}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Sub-tab view switch for Hotel & Land Part mode */}
        {quotationScope === 'HOTEL_LAND' && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Filter View:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setHotelLandViewMode('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  hotelLandViewMode === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Products ({listProducts.length + destinationFilteredHotels.length})
              </button>
              <button
                type="button"
                onClick={() => setHotelLandViewMode('HOTELS')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  hotelLandViewMode === 'HOTELS'
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3 h-3 text-teal-600" />
                <span>Hotels Only ({destinationFilteredHotels.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setHotelLandViewMode('LAND')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  hotelLandViewMode === 'LAND'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Compass className="w-3 h-3 text-emerald-600" />
                <span>Land Tours ({listProducts.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN SPLIT: LEFT LIST VIEW (NO PRICE) + RIGHT COLLAPSED SIDEBAR */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN (8 Cols): PRODUCT CATALOG & HOTEL STAYS IN LIST MODE */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Header count info */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <span>
                {quotationScope === 'LAND_ONLY' 
                  ? `Land Ground Experiences (${listProducts.length})` 
                  : quotationScope === 'HOTEL_ONLY'
                  ? `Contracted 5★ Hotels & Stays (${destinationFilteredHotels.length})`
                  : `Package Inventory: Hotels (${destinationFilteredHotels.length}) + Land Tours (${listProducts.length})`}
              </span>
            </span>
            <span className="text-[11px] text-slate-400">
              List Mode • Confidential Partner View
            </span>
          </div>

          {/* 1. HOTEL ONLY SCOPE */}
          {quotationScope === 'HOTEL_ONLY' && (
            destinationFilteredHotels.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 space-y-3">
                <Building2 className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-bold text-sm text-slate-700">No hotel properties match your current destination or search</p>
                <p className="text-xs text-slate-400">Try changing the destination or clearing the search query.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCity('ALL');
                    setSelectedDestinationSlug('all');
                  }}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#008972] bg-[#00C6A6]/10 px-3 py-1.5 rounded-lg hover:bg-[#00C6A6]/20 cursor-pointer"
                >
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {destinationFilteredHotels.map(hotel => (
                  <B2BHotelRowCard
                    key={hotel.id}
                    hotel={hotel}
                    currency={currency}
                    agentMarkupPercent={agentClientMarkupPercent}
                    onAddHotelStayToQuote={handleAddHotelStayToQuote}
                    onViewHotelDetails={(h) => setInspectingHotel(h)}
                    isJustAdded={justAddedId === hotel.id}
                  />
                ))}
              </div>
            )
          )}

          {/* 2. LAND ONLY SCOPE */}
          {quotationScope === 'LAND_ONLY' && (
            listProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 space-y-3">
                <Search className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-bold text-sm text-slate-700">No land tours match your current filter selection</p>
                <p className="text-xs text-slate-400">Try changing the category, city, or clearing the search query.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setSelectedCity('ALL');
                    setSelectedDestinationSlug('all');
                  }}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#008972] bg-[#00C6A6]/10 px-3 py-1.5 rounded-lg hover:bg-[#00C6A6]/20 cursor-pointer"
                >
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {listProducts.map(product => {
                  const matchingItems = items.filter(i => i.product.id === product.id);
                  const isAlreadyAdded = matchingItems.length > 0;

                  return (
                    <B2BProductRowCard
                      key={product.id}
                      product={product}
                      allProducts={products}
                      currency={currency}
                      agentClientMarkupPercent={agentClientMarkupPercent}
                      isAlreadyAdded={isAlreadyAdded}
                      addedCount={matchingItems.length}
                      onViewDetails={onViewProductDetails}
                      onOpenRosterModal={(p) => setRosterPreviewProduct(p)}
                      onAddToQuote={(options) => handleAddProductFromDropdown(product, options)}
                    />
                  );
                })}
              </div>
            )
          )}

          {/* 3. HOTEL & LAND COMBINED SCOPE */}
          {quotationScope === 'HOTEL_LAND' && (
            <div className="space-y-6">
              {/* Hotels Section in Combined View */}
              {(hotelLandViewMode === 'ALL' || hotelLandViewMode === 'HOTELS') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-md bg-teal-50 text-[#008972] font-bold text-xs flex items-center justify-center">
                        <Building2 className="w-3 h-3" />
                      </span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Contracted Hotels & Stays ({destinationFilteredHotels.length})
                      </h3>
                    </div>
                    <span className="text-[11px] text-teal-700 font-semibold">5★ Luxury Properties</span>
                  </div>

                  {destinationFilteredHotels.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                      No hotel stays found for this destination or search.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {destinationFilteredHotels.map(hotel => (
                        <B2BHotelRowCard
                          key={hotel.id}
                          hotel={hotel}
                          currency={currency}
                          agentMarkupPercent={agentClientMarkupPercent}
                          onAddHotelStayToQuote={handleAddHotelStayToQuote}
                          onViewHotelDetails={(h) => setInspectingHotel(h)}
                          isJustAdded={justAddedId === hotel.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Land Tours Section in Combined View */}
              {(hotelLandViewMode === 'ALL' || hotelLandViewMode === 'LAND') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center">
                        <Compass className="w-3 h-3" />
                      </span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Land Tours, Transfers & Excursions ({listProducts.length})
                      </h3>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-semibold">Licensed Guides & Transfers</span>
                  </div>

                  {listProducts.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                      No ground tours found for this filter combination.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {listProducts.map(product => {
                        const matchingItems = items.filter(i => i.product.id === product.id);
                        const isAlreadyAdded = matchingItems.length > 0;

                        return (
                          <B2BProductRowCard
                            key={product.id}
                            product={product}
                            allProducts={products}
                            currency={currency}
                            agentClientMarkupPercent={agentClientMarkupPercent}
                            isAlreadyAdded={isAlreadyAdded}
                            addedCount={matchingItems.length}
                            onViewDetails={onViewProductDetails}
                            onOpenRosterModal={(p) => setRosterPreviewProduct(p)}
                            onAddToQuote={(options) => handleAddProductFromDropdown(product, options)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN (4-5 Cols): COMPACT COLLAPSED SIDEBAR (ADDED PRODUCTS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-20 space-y-4">
          <div className="bg-slate-900 rounded-3xl p-5 text-white border border-slate-800 shadow-xl space-y-4">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#00C6A6] flex items-center justify-center text-slate-950 font-bold text-xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Quotation Itinerary
                  </h3>
                  <span className="text-[10px] text-[#00E5C0] font-mono">
                    {items.length} Products in Sidebar
                  </span>
                </div>
              </div>

              {items.length > 0 && (
                <button
                  onClick={clearQuote}
                  className="text-[11px] text-slate-400 hover:text-rose-400 font-medium transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Client Reference & Agent Settings */}
            <div className="space-y-2.5 pt-1">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Client / Lead Traveler Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Harrison Family (VIP Private)"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:ring-1 focus:ring-[#00C6A6] focus:outline-none"
                />
              </div>

              {/* B2B Agent Client Markup Slider */}
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center space-x-1">
                    <Percent className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>Agent Client Margin</span>
                  </span>
                  <span className="font-extrabold font-mono text-[#00E5C0] text-sm">
                    {agentClientMarkupPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={agentClientMarkupPercent}
                  onChange={(e) => setAgentClientMarkupPercent(parseInt(e.target.value) || 0)}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#00C6A6]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0% (Wholesale Net)</span>
                  <span>12% (Standard)</span>
                  <span>30% (High Margin)</span>
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* COLLAPSED LIST OF ADDED PRODUCTS IN SIDEBAR */}
            {/* ================================================================= */}
            {/* Roster Conflict Warning Alert Banner in Sidebar */}
            {hasRosterConflict && (
              <div className="p-3 rounded-2xl bg-rose-950 border border-rose-700 text-rose-100 space-y-2 animate-in fade-in">
                <div className="flex items-start space-x-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[11px] font-extrabold text-rose-200">
                      Roster Alert: {conflictedItems.length} Product Date Conflict(s)
                    </h4>
                    <p className="text-[10px] text-rose-300 leading-tight">
                      Booking locked to prevent wrong reservations. Fix dates before computing price.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAutoResolveAllConflicts}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Auto-Resolve All to Open Dates</span>
                </button>
              </div>
            )}

            <div className="space-y-2 pt-1 max-h-[46vh] overflow-y-auto pr-1 scrollbar-thin">
              {items.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-800 text-center text-slate-400 space-y-2">
                  <Layers className="w-7 h-7 mx-auto text-slate-600" />
                  <p className="text-xs font-bold text-slate-300">No Tours Added Yet</p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Click "Add to Itinerary" on any tour on the left to include it here in collapsed mode.
                  </p>
                </div>
              ) : (
                items.map((item, idx) => {
                  const isExpanded = expandedItemId === item.id;
                  const isCalendarOpen = sidebarCalendarItemId === item.id;
                  const availability = checkDateAvailability(
                    item.product.id,
                    item.travelDate,
                    item.pax.adults + item.pax.children
                  );

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        !availability.isAvailable
                          ? 'bg-rose-950/40 border-rose-700 ring-1 ring-rose-500/40'
                          : isExpanded
                          ? 'bg-slate-800 border-[#00C6A6]/60 shadow-md'
                          : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80'
                      }`}
                    >
                      {/* Collapsed Row Bar (Takes minimal space: ~46px) */}
                      <div 
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className="p-2.5 flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <span className={`w-5 h-5 rounded-full font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border ${
                            availability.isAvailable 
                              ? 'bg-slate-900 text-[#00E5C0] border-slate-700' 
                              : 'bg-rose-600 text-white border-rose-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white truncate">
                              {item.product.name}
                            </h4>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="bg-slate-900 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                                {item.travelDate.slice(5)}
                              </span>
                              <span>•</span>
                              <span>{item.pax.adults} Ad{item.pax.children > 0 ? `, ${item.pax.children} Ch` : ''}</span>
                              {availability.isAvailable ? (
                                <span className="text-emerald-400 font-medium">✓ Roster Open</span>
                              ) : (
                                <span className="text-rose-400 font-bold">⚠️ Blocked</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 pl-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeProductFromQuote(item.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="p-1 text-slate-400 hover:text-white">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Section for inline date/pax edits */}
                      {isExpanded && (
                        <div className="p-3 pt-2 bg-slate-900/90 border-t border-slate-700/80 space-y-3 animate-in fade-in duration-150">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-bold text-slate-400 block">
                                  Travel Date
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setSidebarCalendarItemId(isCalendarOpen ? null : item.id)}
                                  className="text-[9px] text-[#00C6A6] hover:underline font-bold"
                                >
                                  {isCalendarOpen ? 'Hide' : 'Calendar'}
                                </button>
                              </div>
                              <input
                                type="date"
                                value={item.travelDate}
                                min={item.product.validityFrom}
                                max={item.product.validityTo}
                                onChange={(e) => updateItemTravelDate(item.id, e.target.value)}
                                className={`w-full bg-slate-800 border rounded-lg p-1.5 text-xs text-white font-mono ${
                                  availability.isAvailable ? 'border-slate-700' : 'border-rose-500 text-rose-300 font-bold'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                Adults / Children
                              </label>
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={item.pax.adults}
                                  onChange={(e) => updateItemPax(item.id, { ...item.pax, adults: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-center text-xs font-bold text-white"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={item.pax.children}
                                  onChange={(e) => updateItemPax(item.id, { ...item.pax, children: Math.max(0, parseInt(e.target.value) || 0) })}
                                  className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-center text-xs font-bold text-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Expandable Calendar Picker inside sidebar item */}
                          {isCalendarOpen && (
                            <div className="pt-2 border-t border-slate-800">
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

                          {/* Add-ons inline checkboxes if available */}
                          {item.product.addons && item.product.addons.length > 0 && (
                            <div className="pt-2 border-t border-slate-800 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Optional Add-ons:
                              </span>
                              {item.product.addons.map(addon => {
                                const isChecked = item.selectedAddonIds.includes(addon.id);
                                return (
                                  <label
                                    key={addon.id}
                                    className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleItemAddon(item.id, addon.id)}
                                      className="rounded bg-slate-800 border-slate-700 text-[#00C6A6] focus:ring-0"
                                    />
                                    <span className="truncate">{addon.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {!availability.isAvailable && (
                            <div className="p-2 rounded-lg bg-rose-950 border border-rose-800 text-[10px] text-rose-300 space-y-1.5">
                              <div className="flex items-start space-x-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                <span>{availability.reason}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = getNextAvailableDate(item.product.id, item.travelDate);
                                  if (next) updateItemTravelDate(item.id, next);
                                }}
                                className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded text-[10px] flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                              >
                                <span>Jump to Next Open Date</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Financial Scope Subtotals in Sidebar (when items present) */}
            {items.length > 0 && (b2bTotals.hotelSellingPrice > 0 || b2bTotals.landSellingPrice > 0) && (
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-1.5 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Price Breakdown Preview ({currency})
                </span>
                {b2bTotals.hotelSellingPrice > 0 && (
                  <div className="flex items-center justify-between text-teal-300">
                    <span className="flex items-center space-x-1">
                      <Building2 className="w-3 h-3" />
                      <span>Hotel Stays:</span>
                    </span>
                    <span className="font-mono font-bold">{formatCurrency(b2bTotals.hotelSellingPrice, currency)}</span>
                  </div>
                )}
                {b2bTotals.landSellingPrice > 0 && (
                  <div className="flex items-center justify-between text-emerald-300">
                    <span className="flex items-center space-x-1">
                      <Compass className="w-3 h-3" />
                      <span>Land Tours & Transfers:</span>
                    </span>
                    <span className="font-mono font-bold">{formatCurrency(b2bTotals.landSellingPrice, currency)}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-slate-700 flex items-center justify-between font-bold text-white">
                  <span>Client Selling Total:</span>
                  <span className="text-[#00E5C0] font-mono text-sm">{formatCurrency(b2bTotals.totalClientSellingPrice, currency)}</span>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* PRIMARY CTA: "CREATE QUOTE" BUTTON */}
            {/* ================================================================= */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                id="b2b-btn-create-quote"
                disabled={items.length === 0 || hasRosterConflict}
                onClick={handleCreateQuoteClick}
                className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm transition-all flex items-center justify-center space-x-2 ${
                  items.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : hasRosterConflict
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-700 cursor-not-allowed'
                    : 'bg-[#00C6A6] hover:bg-[#008972] text-slate-950 shadow-lg shadow-[#00C6A6]/20 hover:scale-102 cursor-pointer'
                }`}
              >
                {hasRosterConflict ? (
                  <>
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span>Booking Locked ({conflictedItems.length} Conflict)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Create Quote & Calculate Price</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-slate-400">
                {hasRosterConflict
                  ? '⚠️ DMC Roster Protocol: Resolve date conflicts above before computing wholesale rates.'
                  : 'Calculates complete B2B wholesale rates, commission, and client selling prices.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FINAL B2B QUOTATION MODAL / RESULT SUMMARY */}
      {/* ========================================================================= */}
      {isQuoteResultModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-[#00C6A6] flex items-center justify-center text-slate-950 font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {activeQuoteTab === 'AGENT_WHOLESALE' ? 'Agent Wholesale Quotation' : 'Client Itinerary Proposal'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {clientName || 'Harrison VIP Client'} • {items.length} Ground Products • Currency: {currency}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Tab switcher: Agent Wholesale vs Client Proposal */}
                <div className="bg-slate-800 p-1 rounded-xl flex items-center space-x-1 text-xs">
                  <button
                    onClick={() => setActiveQuoteTab('AGENT_WHOLESALE')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeQuoteTab === 'AGENT_WHOLESALE'
                        ? 'bg-[#00C6A6] text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Agent Wholesale View
                  </button>
                  <button
                    onClick={() => setActiveQuoteTab('CLIENT_PROPOSAL')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeQuoteTab === 'CLIENT_PROPOSAL'
                        ? 'bg-[#00C6A6] text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Client Proposal View
                  </button>
                </div>

                <button
                  onClick={() => setIsQuoteResultModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1" id="printable-b2b-quote">
              {/* Dynamic Issuing Authority Branding (B2B Agent vs DMC TheUnbound) */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  {role === 'B2B_AGENT' || role === 'AGENT' ? (
                    <>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#008972] block">
                        Authorized Agent Itinerary Proposal
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                        {user?.name || 'Elena Rostova'}
                      </h4>
                      <p className="text-slate-600 text-xs">
                        {user?.agencyName || 'Luxury Discovery Travel Partners'} • {user?.email || 'agent@luxurytravel.com'}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#008972] block">
                        Official DMC Quotation & Operations Vouchers
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                        TheUnbound Destination Management Company
                      </h4>
                      <p className="text-slate-600 text-xs">
                        sales@theunbound.in • Landline: 011-41185542 • Mobile: +91-9811654959, +91-9718894959 • A-46, Kanchan Kunj, Madanpur Khadar Extn-2
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Generated by: {user?.name || 'Marcus Vance'} ({role === 'ADMIN' ? 'DMC Admin' : 'Team Member'})
                      </p>
                    </>
                  )}
                </div>

                <div className="sm:text-right font-mono text-[11px] text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                  <p className="font-bold text-slate-900">REF: UBQ-B2B-{Math.floor(10000 + Math.random() * 90000)}</p>
                  <p>Issue Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-emerald-700 font-semibold">14-Day Rate Guarantee</p>
                </div>
              </div>

              {/* Financial KPI Ribbon */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {activeQuoteTab === 'AGENT_WHOLESALE' ? (
                  <>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">DMC Wholesale Net</span>
                      <span className="text-xl font-extrabold text-slate-900 font-mono">
                        {formatCurrency(b2bTotals.totalDmcWholesaleNet, currency)}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                        Final selling price to the B2B Agent
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Agent Profit</span>
                      <span className="text-xl font-extrabold text-emerald-700 font-mono">
                        {formatCurrency(b2bTotals.totalAgentProfit, currency)}
                      </span>
                      <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                        B2B agent's profit for his reference
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900 text-white">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">Client Total Selling</span>
                      <span className="text-xl font-extrabold text-white font-mono">
                        {formatCurrency(b2bTotals.totalClientSellingPrice, currency)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {formatCurrency(b2bTotals.pricePerPax, currency)} / person
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Itinerary Services</span>
                      <span className="text-xl font-extrabold text-slate-900 font-mono">
                        {items.length} Products
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Fully Scheduled & Guided</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Package Price Per Person</span>
                      <span className="text-xl font-extrabold text-slate-900 font-mono">
                        {formatCurrency(b2bTotals.pricePerPax, currency)}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">All-Inclusive Contracted Rate</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900 text-white">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">Grand Total Selling Price</span>
                      <span className="text-xl font-extrabold text-white font-mono">
                        {formatCurrency(b2bTotals.totalClientSellingPrice, currency)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Final All-Inclusive Total</span>
                    </div>
                  </>
                )}
              </div>

              {/* Itemized Table Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Itemized Product Quotation Breakdown
                </h4>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Product / Tour Name</th>
                        <th className="py-3 px-4">Travel Date</th>
                        <th className="py-3 px-4">Pax Config</th>
                        {activeQuoteTab === 'AGENT_WHOLESALE' && (
                          <>
                            <th className="py-3 px-4 font-mono">Wholesale Net</th>
                            <th className="py-3 px-4 font-mono text-emerald-700">Agent Profit</th>
                          </>
                        )}
                        <th className="py-3 px-4 font-mono text-right">Client Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {b2bCalculatedItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{item.product.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{item.product.city} • SKU: {item.product.sku}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{item.travelDate}</td>
                          <td className="py-3 px-4 text-slate-700">
                            {item.pax.adults} Adults{item.pax.children > 0 ? `, ${item.pax.children} Ch` : ''}
                          </td>
                          {activeQuoteTab === 'AGENT_WHOLESALE' && (
                            <>
                              <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                {formatCurrency(item.b2bCalc.b2bWholesaleNetToAgent, currency)}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                                +{formatCurrency(item.b2bCalc.agentProfitAmount, currency)}
                              </td>
                            </>
                          )}
                          <td className="py-3 px-4 font-mono font-extrabold text-slate-900 text-right">
                            {formatCurrency(item.b2bCalc.finalTotalSellingPrice, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DMC Roster Operational Security Guarantee */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-emerald-900 block">
                    Zero-Risk Guarantee: 100% DMC Roster Verified & Guide-Allocated
                  </span>
                  <p className="text-emerald-700 text-[11px] leading-relaxed">
                    All {items.length} services have been cross-referenced with real-time guide assignments, vehicle allotments, and operational schedules. Guaranteed zero double-booking risk.
                  </p>
                </div>
              </div>

              {/* Terms and Proposal Inclusions */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <span className="font-bold text-slate-900 block">DMC Partner Terms & Inclusions:</span>
                <ul className="text-slate-600 list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                  <li>Wholesale contracted rates guaranteed for 14 days from generation date.</li>
                  <li>Includes licensed English-speaking guides, private ground transfers, and destination inclusions.</li>
                  <li>Instant confirmation applies subject to guide dispatch and vehicle availability in DMC roster.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="btn-modal-download-pdf"
                  onClick={handleDownloadPDF}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  title="Download clean formatted PDF quotation document"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={handleShareLink}
                  className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Share Itinerary Link'}</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={handleSaveQuote}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Briefcase className="w-4 h-4 text-[#008972]" />
                  <span>{savedSuccessQuote ? 'Saved!' : 'Save Quote'}</span>
                </button>

                {onBookQuotation && (
                  <button
                    id="btn-modal-book-quotation"
                    onClick={() => {
                      const quoteToBook = saveCurrentQuote();
                      if (quoteToBook) {
                        setIsQuoteResultModalOpen(false);
                        onBookQuotation(quoteToBook);
                      }
                    }}
                    className="px-5 py-2.5 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-[#00C6A6]/20 hover:scale-102"
                  >
                    <CalendarCheck className="w-4 h-4 text-slate-950" />
                    <span>Book Itinerary (24–48h SLA Dispatch)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ROSTER PREVIEW MODAL FOR AGENTS INSPECTING CATALOG TOURS */}
      {/* ========================================================================= */}
      {rosterPreviewProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#00C6A6] flex items-center justify-center text-slate-950 font-bold">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white leading-tight">
                    {rosterPreviewProduct.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    SKU: {rosterPreviewProduct.sku} • {rosterPreviewProduct.city}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setRosterPreviewProduct(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600">
                <p>
                  Inspect real-time guide assignments, vehicle allotments, and operational days for this tour.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
                <RosterCalendarPicker
                  productId={rosterPreviewProduct.id}
                  selectedDate={getNextAvailableDate(rosterPreviewProduct.id) || new Date().toISOString().split('T')[0]}
                  onSelectDate={(newDate) => {
                    // Quick add with selected date without opening drawer
                    addProductToQuote(rosterPreviewProduct, {
                      travelDate: newDate,
                      adults: Math.max(1, rosterPreviewProduct.minPax || 2),
                      children: 0,
                      infants: 0,
                      selectedAddonIds: [],
                      openDrawer: false
                    });
                    setRosterPreviewProduct(null);
                  }}
                  paxCount={rosterPreviewProduct.minPax || 2}
                  minDate={rosterPreviewProduct.validityFrom}
                  maxDate={rosterPreviewProduct.validityTo}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRosterPreviewProduct(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleQuickAdd(rosterPreviewProduct);
                    setRosterPreviewProduct(null);
                  }}
                  className="px-4 py-2 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 text-xs font-extrabold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Itinerary</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HOTEL DETAIL & INSPECTION MODAL */}
      {/* ========================================================================= */}
      {inspectingHotel && (
        <HotelDetailModal
          hotel={inspectingHotel}
          isOpen={!!inspectingHotel}
          onClose={() => setInspectingHotel(null)}
          onAddStayToQuote={(stayConfig) => {
            handleAddHotelStayToQuote(inspectingHotel, stayConfig);
            setInspectingHotel(null);
          }}
        />
      )}
    </div>
  );
};
