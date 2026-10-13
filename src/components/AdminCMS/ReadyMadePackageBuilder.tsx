import React, { useState, useMemo, useEffect } from 'react';
import { 
  B2BPackage, 
  Destination, 
  Product, 
  Hotel, 
  CityHub, 
  TripRouteHub, 
  PackageItineraryDay, 
  ManualHotelDetails, 
  CurrencyCode, 
  SUPPORTED_CURRENCIES,
  PackageStatus,
  AccommodationType,
  MealPlanCode
} from '../../types';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { hotelToProduct, manualHotelToProduct, isManualHotelPricingComplete } from '../../utils/hotelHelpers';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  Globe, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  MapPin, 
  Building2, 
  Calendar, 
  DollarSign, 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  FileText, 
  Check, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Tag, 
  Hotel as HotelIcon, 
  Car, 
  Compass, 
  Utensils, 
  Lock, 
  RefreshCw, 
  Save, 
  BedDouble, 
  Info, 
  Train, 
  Search, 
  Filter, 
  ShieldCheck,
  Luggage,
  Maximize2
} from 'lucide-react';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { EntitySEO } from '../../types/seo';

interface ReadyMadePackageBuilderProps {
  initialPackage: B2BPackage;
  destinations: Destination[];
  products: Product[];
  hotels: Hotel[];
  cityHubs: CityHub[];
  onSave: (pkg: B2BPackage, publishImmediately?: boolean) => void;
  onClose: () => void;
}

export const ReadyMadePackageBuilder: React.FC<ReadyMadePackageBuilderProps> = ({
  initialPackage,
  destinations,
  products,
  hotels,
  cityHubs,
  onSave,
  onClose
}) => {
  // Main Package State
  const [pkg, setPkg] = useState<B2BPackage>(() => {
    // Deep clone to avoid mutating parent before save
    const cloned: B2BPackage = JSON.parse(JSON.stringify(initialPackage));
    // Ensure nested structures are present
    cloned.highlights = cloned.highlights || [];
    cloned.inclusions = cloned.inclusions || [];
    cloned.exclusions = cloned.exclusions || [];
    cloned.tags = cloned.tags || [];
    cloned.routeSummary = cloned.routeSummary || [];
    cloned.hotelsSummary = cloned.hotelsSummary || [];
    cloned.productIds = cloned.productIds || [];
    cloned.itinerary = cloned.itinerary || [];
    cloned.manualHotels = cloned.manualHotels || [];
    cloned.routeHubs = cloned.routeHubs || [];
    cloned.isLandOnly = cloned.isLandOnly ?? false;
    cloned.currency = cloned.currency || 'USD';
    cloned.pricingConfiguration = cloned.pricingConfiguration || {
      pricingMode: 'LIVE',
      baseNetCostUSD: cloned.baseNetCostUSD || 2500,
      suggestedSellingPriceUSD: cloned.suggestedSellingPriceUSD || 3500,
      buyerMarkupPercent: 25,
      b2bMarkupPercent: 12,
      currency: cloned.currency || 'USD'
    };
    return cloned;
  });

  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState<
    'INFO' | 'ACCOMMODATION' | 'ITINERARY' | 'PRICING' | 'POLICIES' | 'SEO_PUBLISH' | 'PREVIEW'
  >('INFO');

  // Manual Hotel Modal State
  const [manualHotelModalOpen, setManualHotelModalOpen] = useState(false);
  const [editingManualHotelHubId, setEditingManualHotelHubId] = useState<string | null>(null);
  const [manualHotelForm, setManualHotelForm] = useState<ManualHotelDetails>({
    hotelName: '',
    city: '',
    roomType: 'Deluxe Room',
    mealPlan: 'BB',
    mealPlanName: 'Bed & Breakfast',
    numberOfNights: 2,
    numberOfRooms: 1,
    checkInDate: '2026-06-01',
    checkOutDate: '2026-06-03',
    ratePerNight: 280,
    rateCurrency: 'USD',
    rateBasis: 'PER_ROOM_PER_NIGHT',
    address: '',
    starRating: '5-Star Luxury'
  });

  // Add Product to Day Modal
  const [productSelectorDayIdx, setProductSelectorDayIdx] = useState<number | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('ALL');

  // Notification / Validation Banner State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Available City Hubs for current package destination
  const destinationHubs = useMemo(() => {
    return cityHubs.filter(h => 
      h.destinationId === pkg.destinationId || 
      (h.destinationName && h.destinationName.toLowerCase() === (pkg.destinationName || '').toLowerCase())
    );
  }, [cityHubs, pkg.destinationId, pkg.destinationName]);

  // Ensure routeHubs are synchronized if empty
  useEffect(() => {
    if (!pkg.routeHubs || pkg.routeHubs.length === 0) {
      if (destinationHubs.length > 0) {
        const initialHubs: TripRouteHub[] = destinationHubs.slice(0, 3).map((h, i) => ({
          id: `route-hub-${i + 1}-${h.id}`,
          hubId: h.id,
          hubName: h.name,
          destinationId: h.destinationId,
          destinationName: h.destinationName,
          nights: i === 0 ? 3 : 2,
          order: i + 1,
          accommodationType: pkg.isLandOnly ? 'NO_ACCOMMODATION' : 'none',
          roomsCount: 1
        }));
        
        const totalNights = initialHubs.reduce((sum, h) => sum + (h.nights || 0), 0);
        setPkg(prev => ({
          ...prev,
          routeHubs: initialHubs,
          durationNights: totalNights,
          durationDays: totalNights + 1,
          routeSummary: initialHubs.map(h => `${h.hubName} (${h.nights}N)`)
        }));
      }
    }
  }, [destinationHubs, pkg.routeHubs, pkg.isLandOnly]);

  // Handle Land-Only Mode Toggle
  const handleToggleLandOnly = (enabled: boolean) => {
    setPkg(prev => {
      const updatedHubs = (prev.routeHubs || []).map(hub => {
        if (enabled) {
          // Switching to Land-Only: Save current accommodation to snapshot and set to NO_ACCOMMODATION
          return {
            ...hub,
            savedAccommodationConfig: {
              accommodationType: hub.accommodationType || 'none',
              hotelId: hub.hotelId,
              roomTypeId: hub.roomTypeId,
              mealPlan: hub.mealPlan,
              roomsCount: hub.roomsCount,
              isManualHotel: hub.isManualHotel,
              manualHotel: hub.manualHotel
            },
            accommodationType: 'NO_ACCOMMODATION' as AccommodationType
          };
        } else {
          // Switching Land-Only OFF: Restore previous snapshot if available without auto-charging
          const saved = hub.savedAccommodationConfig;
          if (saved) {
            return {
              ...hub,
              accommodationType: saved.accommodationType || 'none',
              hotelId: saved.hotelId,
              roomTypeId: saved.roomTypeId,
              mealPlan: saved.mealPlan,
              roomsCount: saved.roomsCount || 1,
              isManualHotel: saved.isManualHotel,
              manualHotel: saved.manualHotel
            };
          }
          return {
            ...hub,
            accommodationType: 'none' as AccommodationType
          };
        }
      });

      return {
        ...prev,
        isLandOnly: enabled,
        routeHubs: updatedHubs
      };
    });

    showToast(
      enabled 
        ? 'Land-Only Mode enabled: All accommodation marked as "Arranged by Client". Hotel costs excluded.' 
        : 'Land-Only Mode disabled: Accommodation options restored.',
      'warning'
    );
  };

  // Accommodation Section Updates
  const updateHubAccommodation = (hubId: string, updates: Partial<TripRouteHub>) => {
    setPkg(prev => {
      const updatedHubs = (prev.routeHubs || []).map(h => {
        if (h.id === hubId || h.hubId === hubId) {
          return { ...h, ...updates };
        }
        return h;
      });

      // Update hotelsSummary for public viewing
      const summary = updatedHubs
        .filter(h => h.accommodationType === 'HOTEL' || h.accommodationType === 'MANUAL')
        .map(h => {
          if (h.accommodationType === 'MANUAL' && h.manualHotel) {
            return {
              name: h.manualHotel.hotelName,
              cityName: h.manualHotel.city || h.hubName,
              nights: h.nights || 1,
              roomType: h.manualHotel.roomType,
              mealPlan: h.manualHotel.mealPlanName || 'Custom'
            };
          }
          const matchedHotel = hotels.find(ht => ht.id === h.hotelId);
          const matchedRoom = matchedHotel?.roomTypes?.find(rt => rt.id === h.roomTypeId);
          return {
            hotelId: h.hotelId,
            name: matchedHotel?.name || 'Selected Luxury Hotel',
            cityName: matchedHotel?.city || h.hubName,
            nights: h.nights || 1,
            roomType: matchedRoom?.name || 'Standard Luxury Room',
            mealPlan: h.mealPlan || 'Bed & Breakfast'
          };
        });

      return {
        ...prev,
        routeHubs: updatedHubs,
        hotelsSummary: summary
      };
    });
  };

  // Open Manual Hotel Modal for a Hub
  const handleOpenManualHotel = (hub: TripRouteHub) => {
    setEditingManualHotelHubId(hub.id);
    if (hub.manualHotel) {
      setManualHotelForm({ ...hub.manualHotel });
    } else {
      setManualHotelForm({
        hotelName: '',
        city: hub.hubName,
        hubId: hub.hubId,
        hubName: hub.hubName,
        roomType: 'Deluxe Room',
        mealPlan: 'BB',
        mealPlanName: 'Bed & Breakfast',
        numberOfNights: hub.nights || 2,
        numberOfRooms: hub.roomsCount || 1,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-03',
        ratePerNight: 250,
        rateCurrency: pkg.currency || 'USD',
        rateBasis: 'PER_ROOM_PER_NIGHT',
        address: '',
        starRating: '5-Star Luxury'
      });
    }
    setManualHotelModalOpen(true);
  };

  // Save Manual Hotel from Modal
  const handleSaveManualHotel = () => {
    if (!editingManualHotelHubId) return;
    if (!manualHotelForm.hotelName.trim()) {
      showToast('Hotel Name is required for custom accommodation.', 'error');
      return;
    }

    const hub = (pkg.routeHubs || []).find(h => h.id === editingManualHotelHubId);
    if (!hub) return;

    const nights = Math.max(1, manualHotelForm.numberOfNights || hub.nights || 1);
    const rooms = Math.max(1, manualHotelForm.numberOfRooms || hub.roomsCount || 1);

    const safeManual: ManualHotelDetails = {
      ...manualHotelForm,
      hubId: hub.hubId,
      hubName: hub.hubName,
      city: manualHotelForm.city || hub.hubName,
      numberOfNights: nights,
      numberOfRooms: rooms
    };

    updateHubAccommodation(editingManualHotelHubId, {
      accommodationType: 'MANUAL',
      isManualHotel: true,
      manualHotel: safeManual
    });

    setManualHotelModalOpen(false);
    setEditingManualHotelHubId(null);
    showToast(`Added manual custom hotel: "${safeManual.hotelName}"`, 'success');
  };

  // Centralized Pricing Calculations
  const calculatedPricing = useMemo(() => {
    const targetCurrency = pkg.currency || 'USD';
    let totalServicesNetUSD = 0;
    let totalHotelsNetUSD = 0;
    const incompleteWarnings: string[] = [];

    // 1. Calculate Day Itinerary Services
    (pkg.itinerary || []).forEach(day => {
      (day.productIds || []).forEach(prodId => {
        const prod = products.find(p => p.id === prodId);
        if (prod) {
          const rawPrice = prod.adultNetPrice || prod.basePrice || 0;
          if (rawPrice <= 0) {
            incompleteWarnings.push(`Day ${day.dayNumber}: "${prod.name}" has $0 net price.`);
          }
          const priceInUSD = convertCurrency(rawPrice, prod.currency || 'USD', 'USD');
          totalServicesNetUSD += priceInUSD;
        }
      });
    });

    // 2. Calculate Accommodations (strictly 0 if isLandOnly)
    if (!pkg.isLandOnly) {
      (pkg.routeHubs || []).forEach(hub => {
        if (hub.accommodationType === 'NO_ACCOMMODATION' || hub.accommodationType === 'none') {
          // Zero cost
          return;
        }

        if (hub.accommodationType === 'MANUAL' && hub.manualHotel) {
          if (!isManualHotelPricingComplete(hub.manualHotel)) {
            incompleteWarnings.push(`Manual hotel "${hub.manualHotel.hotelName}" in ${hub.hubName} has incomplete pricing.`);
          }
          const manualProd = manualHotelToProduct(hub.manualHotel);
          const rawPrice = manualProd.adultNetPrice || 0;
          const priceInUSD = convertCurrency(rawPrice, manualProd.currency || 'USD', 'USD');
          totalHotelsNetUSD += priceInUSD;
        } else if (hub.accommodationType === 'HOTEL' && hub.hotelId) {
          const hotel = hotels.find(h => h.id === hub.hotelId);
          if (hotel) {
            const roomType = hotel.roomTypes?.find(r => r.id === hub.roomTypeId) || hotel.roomTypes?.[0];
            const nights = hub.nights || 1;
            const rooms = hub.roomsCount || 1;
            const nightlyRate = roomType?.rates?.[0]?.rate || hotel.starRating * 50 || 200;
            const hotelCurrency = (roomType?.rates?.[0]?.currency || hotel.currency || 'USD') as CurrencyCode;
            const stayTotalNative = nightlyRate * nights * rooms;
            const stayTotalUSD = convertCurrency(stayTotalNative, hotelCurrency, 'USD');
            totalHotelsNetUSD += stayTotalUSD;
          }
        }
      });
    }

    const totalNetUSD = Math.round(totalServicesNetUSD + totalHotelsNetUSD);
    const b2bMarkupPercent = pkg.pricingConfiguration?.b2bMarkupPercent ?? 12;
    const buyerMarkupPercent = pkg.pricingConfiguration?.buyerMarkupPercent ?? 25;

    const b2bPriceUSD = Math.round(totalNetUSD * (1 + b2bMarkupPercent / 100));
    const retailPriceUSD = Math.round(totalNetUSD * (1 + buyerMarkupPercent / 100));

    // Convert to target currency
    const totalNetTarget = convertCurrency(totalNetUSD, 'USD', targetCurrency);
    const b2bPriceTarget = convertCurrency(b2bPriceUSD, 'USD', targetCurrency);
    const retailPriceTarget = convertCurrency(retailPriceUSD, 'USD', targetCurrency);

    return {
      servicesNetUSD: totalServicesNetUSD,
      hotelsNetUSD: totalHotelsNetUSD,
      totalNetUSD,
      b2bPriceUSD,
      retailPriceUSD,
      totalNetTarget,
      b2bPriceTarget,
      retailPriceTarget,
      incompleteWarnings,
      isComplete: incompleteWarnings.length === 0 && totalNetUSD > 0
    };
  }, [pkg.itinerary, pkg.routeHubs, pkg.isLandOnly, pkg.currency, pkg.pricingConfiguration, products, hotels]);

  // Sync calculated price to package if pricing mode is LIVE
  useEffect(() => {
    if (pkg.pricingConfiguration?.pricingMode === 'LIVE') {
      if (calculatedPricing.totalNetUSD !== pkg.baseNetCostUSD) {
        setPkg(prev => ({
          ...prev,
          baseNetCostUSD: calculatedPricing.totalNetUSD,
          suggestedSellingPriceUSD: calculatedPricing.retailPriceUSD,
          finalSellingPriceUSD: calculatedPricing.retailPriceUSD,
          pricingConfiguration: {
            ...(prev.pricingConfiguration || { pricingMode: 'LIVE', currency: prev.currency || 'USD' }),
            baseNetCostUSD: calculatedPricing.totalNetUSD,
            suggestedSellingPriceUSD: calculatedPricing.retailPriceUSD,
            finalSellingPriceUSD: calculatedPricing.retailPriceUSD
          }
        }));
      }
    }
  }, [calculatedPricing, pkg.pricingConfiguration?.pricingMode, pkg.baseNetCostUSD]);

  // Pre-Publish Validation
  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!pkg.title.trim()) errs.push('Package title is required.');
    if (!pkg.destinationId) errs.push('Destination selection is required.');
    if (!pkg.durationDays || pkg.durationDays < 1) errs.push('Duration must be at least 1 day.');
    if (!pkg.itinerary || pkg.itinerary.length === 0) errs.push('Itinerary must have at least one day.');
    
    // Check Accommodations if NOT Land-Only
    if (!pkg.isLandOnly && pkg.routeHubs && pkg.routeHubs.length > 0) {
      const unassignedHubs = pkg.routeHubs.filter(h => 
        h.accommodationType === 'none' || 
        (!h.accommodationType && !h.hotelId && !h.isManualHotel)
      );
      if (unassignedHubs.length > 0) {
        errs.push(`Accommodation not chosen for ${unassignedHubs.map(h => h.hubName).join(', ')}. (Select a hotel, add manual rate, or enable Land-Only Mode)`);
      }
    }

    if (calculatedPricing.incompleteWarnings.length > 0) {
      errs.push(...calculatedPricing.incompleteWarnings);
    }

    return errs;
  }, [pkg, calculatedPricing]);

  // Save Handler
  const handleSave = (publishImmediately: boolean = false) => {
    if (publishImmediately && validationErrors.length > 0) {
      showToast(`Cannot publish: ${validationErrors[0]}`, 'error');
      return;
    }

    if (!pkg.title.trim()) {
      showToast('Package Title is required.', 'error');
      return;
    }

    const durationDays = Math.max(1, pkg.durationDays || (pkg.itinerary || []).length || 1);
    const durationNights = Math.max(0, durationDays - 1);
    const slug = pkg.slug?.trim() || pkg.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const finalPkg: B2BPackage = {
      ...pkg,
      slug,
      durationDays,
      durationNights,
      status: publishImmediately ? 'PUBLISHED' : (pkg.status || 'DRAFT'),
      isPublished: publishImmediately || pkg.status === 'PUBLISHED',
      updatedAt: new Date().toISOString()
    };

    onSave(finalPkg, publishImmediately);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-60 px-4 py-3 rounded-2xl shadow-2xl border flex items-center space-x-3 text-xs font-bold transition-all animate-in slide-in-from-top-3 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950 text-emerald-100 border-emerald-700' 
            : toastMessage.type === 'error'
            ? 'bg-rose-950 text-rose-100 border-rose-700'
            : 'bg-amber-950 text-amber-100 border-amber-700'
        }`}>
          <Sparkles className="w-4 h-4 text-[#00C6A6]" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* WORKSPACE TOP BAR */}
      <header className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#008972] text-white flex items-center justify-center font-black shrink-0 shadow-sm">
            <Package className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {pkg.id.startsWith('pkg-') ? 'TEMPLATE DRAFT' : pkg.id}
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                pkg.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {pkg.status || 'DRAFT'}
              </span>
              {pkg.isLandOnly && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center space-x-1">
                  <span>Land-Only Circuit</span>
                </span>
              )}
            </div>
            <h1 className="text-base font-black truncate text-white">
              {pkg.title || 'Untitled Ready-Made Tour Package'}
            </h1>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('PREVIEW')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'PREVIEW' ? 'bg-[#00C6A6] text-slate-950 shadow-sm' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Package Preview</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer border border-slate-700 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave(true)}
            className="px-5 py-2 bg-[#008972] hover:bg-[#007460] text-white rounded-xl text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-md transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Publish Package</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            title="Exit Package Builder"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* WORKSPACE NAVIGATION TABS */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-6 flex items-center space-x-1 overflow-x-auto shrink-0 scrollbar-none">
        {[
          { id: 'INFO', label: '1. Package Details & Route', icon: FileText },
          { id: 'ACCOMMODATION', label: '2. Hotels & Accommodations', icon: HotelIcon, badge: pkg.isLandOnly ? 'Land-Only' : undefined },
          { id: 'ITINERARY', label: '3. Day-Wise Itinerary', icon: Calendar, badge: `${(pkg.itinerary || []).length} Days` },
          { id: 'PRICING', label: '4. Pricing Engine & Currency', icon: DollarSign, badge: formatCurrency(calculatedPricing.totalNetUSD, 'USD') },
          { id: 'POLICIES', label: '5. Inclusions & Policies', icon: Tag },
          { id: 'SEO_PUBLISH', label: '6. SEO & Publishing', icon: Globe },
          { id: 'PREVIEW', label: '7. Live Preview', icon: Eye }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive 
                  ? 'border-[#00C6A6] text-[#00C6A6] bg-slate-800/40' 
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  isActive ? 'bg-[#00C6A6]/20 text-[#00C6A6]' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 bg-slate-100 overflow-y-auto p-4 sm:p-6 text-slate-900">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* TAB 1: BASIC INFO & DESTINATION ROUTE */}
          {activeTab === 'INFO' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-[#008972]" />
                  <span>Package Identification & Regional Routing</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure package identity, destination geography, duration, and visual imagery.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Package Title *</label>
                  <input
                    type="text"
                    value={pkg.title}
                    onChange={(e) => setPkg({
                      ...pkg,
                      title: e.target.value,
                      slug: pkg.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    })}
                    placeholder="e.g. Japan Signature Golden Route: Tokyo, Hakone & Kyoto"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:border-[#008972] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Package ID</label>
                  <input
                    type="text"
                    value={pkg.id}
                    onChange={(e) => setPkg({ ...pkg, id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-700 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Destination *</label>
                  <select
                    value={pkg.destinationId}
                    onChange={(e) => {
                      const dest = destinations.find(d => d.id === e.target.value);
                      if (dest) {
                        const newHubs = cityHubs.filter(h => h.destinationId === dest.id);
                        setPkg({
                          ...pkg,
                          destinationId: dest.id,
                          destinationName: dest.name,
                          regionId: dest.region,
                          regionName: dest.region,
                          hubIds: newHubs.map(h => h.id),
                          hubNames: newHubs.map(h => h.name)
                        });
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="">Select Destination</option>
                    {destinations.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.region || 'Asia'})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Travel Style / Theme</label>
                  <select
                    value={pkg.tripType}
                    onChange={(e) => setPkg({ ...pkg, tripType: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="LUXURY">Luxury 5★ VIP</option>
                    <option value="CULTURAL">Cultural & Heritage</option>
                    <option value="HONEYMOON">Honeymoon & Romantic</option>
                    <option value="ADVENTURE">Adventure & Nature</option>
                    <option value="FAMILY">Family Friendly</option>
                    <option value="CLASSIC">Classic Highlights</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Duration (Days / Nights)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={pkg.durationDays}
                        onChange={(e) => {
                          const days = Math.max(1, parseInt(e.target.value) || 1);
                          setPkg({ ...pkg, durationDays: days, durationNights: Math.max(0, days - 1) });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 outline-none"
                      />
                      <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold uppercase">Days</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={pkg.durationNights}
                        onChange={(e) => {
                          const nights = Math.max(0, parseInt(e.target.value) || 0);
                          setPkg({ ...pkg, durationNights: nights, durationDays: nights + 1 });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 outline-none"
                      />
                      <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold uppercase">Nights</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Tagline / Subheading</label>
                  <input
                    type="text"
                    value={pkg.tagline}
                    onChange={(e) => setPkg({ ...pkg, tagline: e.target.value })}
                    placeholder="e.g. 7-Day Signature Circuit with 5★ Stays & Private Bullet Train Green Car Seats"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                  />
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Package Overview Description</label>
                  <textarea
                    rows={3}
                    value={pkg.description}
                    onChange={(e) => setPkg({ ...pkg, description: e.target.value })}
                    placeholder="Describe the overall journey, pace, target traveler, and ground support..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                  />
                </div>

                {/* Hero Image & Gallery */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Hero Cover Image URL</label>
                  <input
                    type="text"
                    value={pkg.heroImage}
                    onChange={(e) => setPkg({ ...pkg, heroImage: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Hero Preview</label>
                  <div className="h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img 
                      src={pkg.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=400'} 
                      alt="Hero Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* ROUTE SUMMARY & HUBS */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Multi-City Circuit Route</h3>
                    <p className="text-[11px] text-slate-500">Order of cities / hubs included in this circuit.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const availableHub = destinationHubs.find(h => !(pkg.routeHubs || []).some(rh => rh.hubId === h.id)) || destinationHubs[0];
                      if (availableHub) {
                        const newOrder = (pkg.routeHubs || []).length + 1;
                        const newHub: TripRouteHub = {
                          id: `route-hub-${Date.now()}`,
                          hubId: availableHub.id,
                          hubName: availableHub.name,
                          destinationId: availableHub.destinationId,
                          destinationName: availableHub.destinationName,
                          nights: 2,
                          order: newOrder,
                          accommodationType: pkg.isLandOnly ? 'NO_ACCOMMODATION' : 'none',
                          roomsCount: 1
                        };
                        const updatedHubs = [...(pkg.routeHubs || []), newHub];
                        const totalNights = updatedHubs.reduce((sum, h) => sum + (h.nights || 0), 0);
                        setPkg({
                          ...pkg,
                          routeHubs: updatedHubs,
                          durationNights: totalNights,
                          durationDays: totalNights + 1,
                          routeSummary: updatedHubs.map(h => `${h.hubName} (${h.nights}N)`)
                        });
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add City Hub</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(pkg.routeHubs || []).map((hub, hubIdx) => (
                    <div key={hub.id || hubIdx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs">
                          {hubIdx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-xs text-slate-800 block">{hub.hubName}</span>
                          <span className="text-[11px] text-slate-500 font-semibold">{hub.nights} Nights</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            const newNights = Math.max(1, (hub.nights || 1) + 1);
                            const updatedHubs = (pkg.routeHubs || []).map((h, i) => i === hubIdx ? { ...h, nights: newNights } : h);
                            const totalNights = updatedHubs.reduce((sum, h) => sum + (h.nights || 0), 0);
                            setPkg({
                              ...pkg,
                              routeHubs: updatedHubs,
                              durationNights: totalNights,
                              durationDays: totalNights + 1,
                              routeSummary: updatedHubs.map(h => `${h.hubName} (${h.nights}N)`)
                            });
                          }}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          title="Increase nights"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newNights = Math.max(1, (hub.nights || 1) - 1);
                            const updatedHubs = (pkg.routeHubs || []).map((h, i) => i === hubIdx ? { ...h, nights: newNights } : h);
                            const totalNights = updatedHubs.reduce((sum, h) => sum + (h.nights || 0), 0);
                            setPkg({
                              ...pkg,
                              routeHubs: updatedHubs,
                              durationNights: totalNights,
                              durationDays: totalNights + 1,
                              routeSummary: updatedHubs.map(h => `${h.hubName} (${h.nights}N)`)
                            });
                          }}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          title="Decrease nights"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updatedHubs = (pkg.routeHubs || []).filter((_, i) => i !== hubIdx);
                            const totalNights = updatedHubs.reduce((sum, h) => sum + (h.nights || 0), 0);
                            setPkg({
                              ...pkg,
                              routeHubs: updatedHubs,
                              durationNights: totalNights,
                              durationDays: Math.max(1, totalNights + 1),
                              routeSummary: updatedHubs.map(h => `${h.hubName} (${h.nights}N)`)
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Remove city hub"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HOTELS & ACCOMMODATIONS (COMPLETE FLEXIBILITY & LAND-ONLY MODE) */}
          {activeTab === 'ACCOMMODATION' && (
            <div className="space-y-6">
              {/* LAND-ONLY MODE CARD */}
              <div className={`p-5 rounded-3xl border transition-all ${
                pkg.isLandOnly 
                  ? 'bg-purple-950 text-white border-purple-800 shadow-md' 
                  : 'bg-white text-slate-900 border-slate-200 shadow-sm'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shrink-0 ${
                      pkg.isLandOnly ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Luggage className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-black">
                          Land-Only Mode (Exclude Accommodations)
                        </h3>
                        {pkg.isLandOnly && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-400 text-purple-950 text-[10px] font-black uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 leading-relaxed ${pkg.isLandOnly ? 'text-purple-200' : 'text-slate-500'}`}>
                        {pkg.isLandOnly
                          ? 'Land-Only Mode is active: All accommodations are marked as "Arranged by Client". Hotel charges are completely excluded from the package price, while tours, activities, and transfers remain active.'
                          : 'Enable Land-Only Mode if this package is designed strictly for ground touring, transfers, and activities without bundled hotel stays.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleLandOnly(!pkg.isLandOnly)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center space-x-2 ${
                      pkg.isLandOnly
                        ? 'bg-white text-purple-950 hover:bg-purple-100 shadow-sm'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    <span>{pkg.isLandOnly ? 'Disable Land-Only Mode' : 'Enable Land-Only Mode'}</span>
                  </button>
                </div>
              </div>

              {/* ACCOMMODATION SECTIONS PER HUB */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Stay Accommodations ({pkg.routeHubs?.length || 0} Circuit Stays)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Configure accommodation arrangements for each city stay. Choose between Managed Hotels, No Accommodation, or Custom Manual Rates.
                    </p>
                  </div>
                </div>

                {(pkg.routeHubs || []).map((hub, hubIdx) => {
                  const isLandOnlyMode = !!pkg.isLandOnly;
                  const isNoAcc = isLandOnlyMode || hub.accommodationType === 'NO_ACCOMMODATION' || hub.accommodationType === 'none';
                  const isManual = hub.accommodationType === 'MANUAL' && !!hub.manualHotel;
                  const isManaged = hub.accommodationType === 'HOTEL' && !!hub.hotelId;

                  // Find matched hotel
                  const matchedHotel = hotels.find(h => h.id === hub.hotelId);
                  const matchedRoom = matchedHotel?.roomTypes?.find(r => r.id === hub.roomTypeId) || matchedHotel?.roomTypes?.[0];

                  // Filter hotels for this hub/city
                  const destinationHotels = hotels.filter(h => 
                    h.destinationId === pkg.destinationId || 
                    (h.cityName || h.city || '').toLowerCase() === (hub.hubName || '').toLowerCase()
                  );

                  return (
                    <div 
                      key={hub.id || hubIdx}
                      className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4"
                    >
                      {/* Section Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-3">
                          <span className="w-8 h-8 rounded-xl bg-[#008972] text-white flex items-center justify-center font-black text-xs shrink-0">
                            Stay {hubIdx + 1}
                          </span>
                          <div>
                            <h4 className="font-black text-sm text-slate-900">
                              {hub.hubName} Accommodation
                            </h4>
                            <span className="text-[11px] text-slate-500 font-semibold">
                              {hub.nights} Nights • Double Occupancy ({hub.roomsCount || 1} Room)
                            </span>
                          </div>
                        </div>

                        {/* Current Status Pill */}
                        <div>
                          {isLandOnlyMode || hub.accommodationType === 'NO_ACCOMMODATION' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              No Accommodation (Arranged by Client)
                            </span>
                          ) : isManual ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              Manual Custom Rate ({hub.manualHotel?.hotelName})
                            </span>
                          ) : isManaged ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                              Managed Hotel: {matchedHotel?.name}
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              Pending Selection
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ACCOMMODATION MODE SELECTION (Option A, B, C) */}
                      {!isLandOnlyMode ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {/* OPTION A: MANAGED HOTEL */}
                            <button
                              type="button"
                              onClick={() => {
                                const firstHotel = destinationHotels[0] || hotels[0];
                                updateHubAccommodation(hub.id, {
                                  accommodationType: 'HOTEL',
                                  hotelId: firstHotel?.id,
                                  roomTypeId: firstHotel?.roomTypes?.[0]?.id,
                                  mealPlan: 'Bed & Breakfast'
                                });
                              }}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                hub.accommodationType === 'HOTEL' 
                                  ? 'bg-[#008972]/10 border-[#008972] text-[#008972] shadow-xs' 
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <Building2 className="w-4 h-4" />
                                <span className="font-black text-xs">Option A: Managed Hotel</span>
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 block">
                                Choose from contracted master hotel inventory
                              </span>
                            </button>

                            {/* OPTION B: NO ACCOMMODATION */}
                            <button
                              type="button"
                              onClick={() => {
                                updateHubAccommodation(hub.id, {
                                  accommodationType: 'NO_ACCOMMODATION',
                                  hotelId: undefined,
                                  roomTypeId: undefined,
                                  isManualHotel: false
                                });
                              }}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                hub.accommodationType === 'NO_ACCOMMODATION' 
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs' 
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <X className="w-4 h-4" />
                                <span className="font-black text-xs">Option B: No Accommodation</span>
                              </div>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                Client arranges their own stay; $0 added
                              </span>
                            </button>

                            {/* OPTION C: MANUAL HOTEL / CUSTOM RATE */}
                            <button
                              type="button"
                              onClick={() => handleOpenManualHotel(hub)}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                hub.accommodationType === 'MANUAL' 
                                  ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs' 
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <Edit3 className="w-4 h-4" />
                                <span className="font-black text-xs">Option C: Manual Hotel Rate</span>
                              </div>
                              <span className="text-[10px] text-slate-500 mt-1 block">
                                Custom off-master hotel or contracted quote rate
                              </span>
                            </button>
                          </div>

                          {/* OPTION A DETAILS: Managed Hotel Configuration Fields */}
                          {hub.accommodationType === 'HOTEL' && (
                            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase text-emerald-900">Select Hotel</label>
                                  <select
                                    value={hub.hotelId || ''}
                                    onChange={(e) => {
                                      const selHotel = hotels.find(h => h.id === e.target.value);
                                      updateHubAccommodation(hub.id, {
                                        hotelId: selHotel?.id,
                                        roomTypeId: selHotel?.roomTypes?.[0]?.id
                                      });
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                  >
                                    <option value="">-- Choose Hotel in {hub.hubName} --</option>
                                    {destinationHotels.map(h => (
                                      <option key={h.id} value={h.id}>
                                        {h.name} ({h.starRating}★ in {h.cityName || h.city})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase text-emerald-900">Room Category</label>
                                  <select
                                    value={hub.roomTypeId || ''}
                                    onChange={(e) => updateHubAccommodation(hub.id, { roomTypeId: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                  >
                                    {(matchedHotel?.roomTypes || [
                                      { id: 'deluxe', name: 'Deluxe King Room' },
                                      { id: 'executive', name: 'Executive Suite' }
                                    ]).map(rt => (
                                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase text-emerald-900">Meal Plan</label>
                                  <select
                                    value={hub.mealPlan || 'Bed & Breakfast'}
                                    onChange={(e) => updateHubAccommodation(hub.id, { mealPlan: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                  >
                                    <option value="Room Only">Room Only (RO)</option>
                                    <option value="Bed & Breakfast">Bed & Breakfast (BB)</option>
                                    <option value="Half Board">Half Board (HB)</option>
                                    <option value="Full Board">Full Board (FB)</option>
                                  </select>
                                </div>
                              </div>

                              {matchedHotel && (
                                <div className="flex items-center justify-between text-xs text-emerald-900 pt-1">
                                  <span>{matchedHotel.name} • {matchedHotel.address}</span>
                                  <span className="font-mono font-bold">
                                    Contracted: {formatCurrency((matchedRoom?.rates?.[0]?.rate || 250) * (hub.nights || 1), pkg.currency || 'USD')} Total Stay
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* OPTION C DETAILS: Manual Hotel Summary */}
                          {hub.accommodationType === 'MANUAL' && hub.manualHotel && (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                              <div>
                                <span className="font-black text-xs text-amber-950 block">
                                  {hub.manualHotel.hotelName} ({hub.manualHotel.roomType})
                                </span>
                                <span className="text-[11px] text-amber-800">
                                  {hub.manualHotel.mealPlanName || 'Custom Meal Plan'} • {hub.nights} Nights Stay • Basis: {hub.manualHotel.rateBasis}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-xs text-amber-900">
                                  {formatCurrency(manualHotelToProduct(hub.manualHotel).adultNetPrice, pkg.currency || 'USD')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenManualHotel(hub)}
                                  className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  Edit Rate
                                </button>
                              </div>
                            </div>
                          )}

                          {/* OPTION B DETAILS: Arranged by client banner */}
                          {hub.accommodationType === 'NO_ACCOMMODATION' && (
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                              <span>Client will arrange accommodation independently in {hub.hubName}.</span>
                              <span className="font-mono font-bold text-slate-500">$0.00 (Excluded)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* LAND-ONLY MODE VIEW FOR THIS SECTION */
                        <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200 flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <span className="font-black text-purple-950 block">
                              No Accommodation (Arranged by Client)
                            </span>
                            <p className="text-[11px] text-purple-700">
                              Land-Only Mode is active. Hotel charges for {hub.hubName} are completely excluded from the package price.
                            </p>
                          </div>
                          <span className="font-mono font-bold text-purple-900 bg-purple-100 px-3 py-1 rounded-xl">
                            $0.00 (Excluded)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DAY-WISE ITINERARY BUILDER */}
          {activeTab === 'ITINERARY' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Day-Wise Circuit Itinerary Builder ({(pkg.itinerary || []).length} Days)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Construct the day-by-day program. Attach real activities, tours, private transfers, and rail passes from inventory.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const days = pkg.itinerary || [];
                    const nextDayNum = days.length + 1;
                    const hub = (pkg.routeHubs || [])[Math.min(days.length, (pkg.routeHubs || []).length - 1)];
                    const newDay: PackageItineraryDay = {
                      dayNumber: nextDayNum,
                      title: `Day ${nextDayNum} Excursions & Discovery`,
                      hubId: hub?.hubId,
                      hubName: hub?.hubName,
                      description: `Private guided experiences, cultural discovery, and leisure in ${hub?.hubName || 'the city'}.`,
                      productIds: [],
                      mealsIncluded: { breakfast: true, lunch: false, dinner: false },
                      guideIncluded: true,
                      freeTime: false
                    };
                    const updated = [...days, newDay];
                    setPkg({
                      ...pkg,
                      itinerary: updated,
                      durationDays: updated.length,
                      durationNights: Math.max(0, updated.length - 1)
                    });
                    showToast(`Added Day ${nextDayNum}`, 'success');
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-sm hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Day {((pkg.itinerary || []).length) + 1}</span>
                </button>
              </div>

              {/* Day List */}
              <div className="space-y-4">
                {(pkg.itinerary || []).map((day, dayIdx) => {
                  const dayProducts = products.filter(p => (day.productIds || []).includes(p.id));

                  return (
                    <div 
                      key={dayIdx}
                      className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4"
                    >
                      {/* Day Header Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-3">
                          <span className="w-8 h-8 rounded-xl bg-[#008972] text-white flex items-center justify-center font-black text-xs shrink-0">
                            {day.dayNumber}
                          </span>
                          <input
                            type="text"
                            value={day.title}
                            onChange={(e) => {
                              const copy = [...(pkg.itinerary || [])];
                              copy[dayIdx] = { ...copy[dayIdx], title: e.target.value };
                              setPkg({ ...pkg, itinerary: copy });
                            }}
                            placeholder="Day Title (e.g. Arrival in Tokyo & Evening Shinjuku Walk)"
                            className="font-bold text-slate-900 text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl w-72 sm:w-96 focus:border-[#008972] outline-none"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* City Hub Dropdown */}
                          <select
                            value={day.hubId || ''}
                            onChange={(e) => {
                              const h = cityHubs.find(ch => ch.id === e.target.value);
                              const copy = [...(pkg.itinerary || [])];
                              copy[dayIdx] = { ...copy[dayIdx], hubId: h?.id, hubName: h?.name };
                              setPkg({ ...pkg, itinerary: copy });
                            }}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                          >
                            <option value="">Select Hub</option>
                            {(pkg.routeHubs || []).map(rh => (
                              <option key={rh.hubId} value={rh.hubId}>{rh.hubName}</option>
                            ))}
                          </select>

                          {/* Reorder Up */}
                          {dayIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...(pkg.itinerary || [])];
                                const temp = copy[dayIdx - 1];
                                copy[dayIdx - 1] = copy[dayIdx];
                                copy[dayIdx] = temp;
                                // renumber
                                const renumbered = copy.map((d, i) => ({ ...d, dayNumber: i + 1 }));
                                setPkg({ ...pkg, itinerary: renumbered });
                              }}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer"
                              title="Move Day Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Reorder Down */}
                          {dayIdx < (pkg.itinerary || []).length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...(pkg.itinerary || [])];
                                const temp = copy[dayIdx + 1];
                                copy[dayIdx + 1] = copy[dayIdx];
                                copy[dayIdx] = temp;
                                // renumber
                                const renumbered = copy.map((d, i) => ({ ...d, dayNumber: i + 1 }));
                                setPkg({ ...pkg, itinerary: renumbered });
                              }}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer"
                              title="Move Day Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Day */}
                          <button
                            type="button"
                            onClick={() => {
                              const copy = (pkg.itinerary || []).filter((_, i) => i !== dayIdx);
                              const renumbered = copy.map((d, i) => ({ ...d, dayNumber: i + 1 }));
                              setPkg({
                                ...pkg,
                                itinerary: renumbered,
                                durationDays: Math.max(1, renumbered.length),
                                durationNights: Math.max(0, renumbered.length - 1)
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Remove Day"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Day Narrative Description */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-400">Day Narrative / Itinerary Notes</label>
                        <textarea
                          rows={2}
                          value={day.description}
                          onChange={(e) => {
                            const copy = [...(pkg.itinerary || [])];
                            copy[dayIdx] = { ...copy[dayIdx], description: e.target.value };
                            setPkg({ ...pkg, itinerary: copy });
                          }}
                          placeholder="Describe the morning activities, transfers, guided sights, and evening program..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#008972]"
                        />
                      </div>

                      {/* Attached Services & Activities */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-[#008972]" />
                            <span>Included Services & Products (Tours, Transfers, Rail)</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setProductSelectorDayIdx(dayIdx);
                              setProductSearchQuery('');
                              setProductCategoryFilter('ALL');
                            }}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Product from Inventory</span>
                          </button>
                        </div>

                        {dayProducts.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic bg-slate-50 p-3 rounded-2xl border border-dashed border-slate-200">
                            No products attached yet for Day {day.dayNumber}. Click "+ Add Product from Inventory" to attach tours, private chauffeur transfers, or rail.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {dayProducts.map(prod => (
                              <div 
                                key={prod.id}
                                className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold uppercase">
                                      {prod.category}
                                    </span>
                                    <span className="font-bold text-xs text-slate-800 truncate block">
                                      {prod.name}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {formatCurrency(prod.adultNetPrice || 0, prod.currency || 'USD')} • {prod.duration || 'Flexible'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...(pkg.itinerary || [])];
                                    copy[dayIdx] = {
                                      ...copy[dayIdx],
                                      productIds: (copy[dayIdx].productIds || []).filter(id => id !== prod.id)
                                    };
                                    // sync top-level productIds
                                    const allIds = Array.from(new Set(copy.flatMap(d => d.productIds || [])));
                                    setPkg({ ...pkg, itinerary: copy, productIds: allIds });
                                  }}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                  title="Remove product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Meals & Guide Toggles */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center space-x-4">
                          <span className="text-[10px] font-bold uppercase text-slate-400">Meals Included:</span>
                          <label className="flex items-center space-x-1.5 text-slate-700 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={day.mealsIncluded?.breakfast ?? true}
                              onChange={(e) => {
                                const copy = [...(pkg.itinerary || [])];
                                copy[dayIdx] = {
                                  ...copy[dayIdx],
                                  mealsIncluded: {
                                    breakfast: e.target.checked,
                                    lunch: !!copy[dayIdx].mealsIncluded?.lunch,
                                    dinner: !!copy[dayIdx].mealsIncluded?.dinner
                                  }
                                };
                                setPkg({ ...pkg, itinerary: copy });
                              }}
                              className="rounded text-[#008972]"
                            />
                            <span>Breakfast</span>
                          </label>

                          <label className="flex items-center space-x-1.5 text-slate-700 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={day.mealsIncluded?.lunch ?? false}
                              onChange={(e) => {
                                const copy = [...(pkg.itinerary || [])];
                                copy[dayIdx] = {
                                  ...copy[dayIdx],
                                  mealsIncluded: {
                                    breakfast: !!copy[dayIdx].mealsIncluded?.breakfast,
                                    lunch: e.target.checked,
                                    dinner: !!copy[dayIdx].mealsIncluded?.dinner
                                  }
                                };
                                setPkg({ ...pkg, itinerary: copy });
                              }}
                              className="rounded text-[#008972]"
                            />
                            <span>Lunch</span>
                          </label>

                          <label className="flex items-center space-x-1.5 text-slate-700 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={day.mealsIncluded?.dinner ?? false}
                              onChange={(e) => {
                                const copy = [...(pkg.itinerary || [])];
                                copy[dayIdx] = {
                                  ...copy[dayIdx],
                                  mealsIncluded: {
                                    breakfast: !!copy[dayIdx].mealsIncluded?.breakfast,
                                    lunch: !!copy[dayIdx].mealsIncluded?.lunch,
                                    dinner: e.target.checked
                                  }
                                };
                                setPkg({ ...pkg, itinerary: copy });
                              }}
                              className="rounded text-[#008972]"
                            />
                            <span>Dinner</span>
                          </label>
                        </div>

                        <div>
                          <label className="flex items-center space-x-1.5 text-slate-700 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={day.guideIncluded ?? true}
                              onChange={(e) => {
                                const copy = [...(pkg.itinerary || [])];
                                copy[dayIdx] = { ...copy[dayIdx], guideIncluded: e.target.checked };
                                setPkg({ ...pkg, itinerary: copy });
                              }}
                              className="rounded text-[#008972]"
                            />
                            <span>Licensed Guide Service Included</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PRICING ENGINE & CURRENCY INTEGRATION */}
          {activeTab === 'PRICING' && (
            <div className="space-y-6">
              {/* Pricing Engine Header */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-[#008972]" />
                      <span>Centralized Pricing Engine & Margin Control</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Calculates authoritative package price derived from configured services and applicable accommodation stays.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setPkg({
                        ...pkg,
                        pricingConfiguration: {
                          ...(pkg.pricingConfiguration || { baseNetCostUSD: 2500, currency: 'USD' }),
                          pricingMode: 'LIVE'
                        }
                      })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        (pkg.pricingConfiguration?.pricingMode || 'LIVE') === 'LIVE'
                          ? 'bg-[#008972] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Live Engine Mode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPkg({
                        ...pkg,
                        pricingConfiguration: {
                          ...(pkg.pricingConfiguration || { baseNetCostUSD: 2500, currency: 'USD' }),
                          pricingMode: 'LOCKED'
                        }
                      })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        pkg.pricingConfiguration?.pricingMode === 'LOCKED'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Locked Fixed Mode</span>
                    </button>
                  </div>
                </div>

                {/* Currency Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Display Currency</label>
                    <select
                      value={pkg.currency || 'USD'}
                      onChange={(e) => setPkg({ ...pkg, currency: e.target.value as CurrencyCode })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      {SUPPORTED_CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>{curr.code} ({curr.name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Wholesale Net Cost (USD)</label>
                    <input
                      type="number"
                      min="0"
                      disabled={pkg.pricingConfiguration?.pricingMode === 'LIVE'}
                      value={pkg.baseNetCostUSD || 0}
                      onChange={(e) => setPkg({ ...pkg, baseNetCostUSD: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black font-mono text-slate-900 outline-none disabled:bg-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">B2B Agent Markup %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={pkg.pricingConfiguration?.b2bMarkupPercent ?? 12}
                      onChange={(e) => setPkg({
                        ...pkg,
                        pricingConfiguration: {
                          ...(pkg.pricingConfiguration || { pricingMode: 'LIVE', baseNetCostUSD: 2500, currency: 'USD' }),
                          b2bMarkupPercent: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black font-mono text-slate-900 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Retail Markup %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={pkg.pricingConfiguration?.buyerMarkupPercent ?? 25}
                      onChange={(e) => setPkg({
                        ...pkg,
                        pricingConfiguration: {
                          ...(pkg.pricingConfiguration || { pricingMode: 'LIVE', baseNetCostUSD: 2500, currency: 'USD' }),
                          buyerMarkupPercent: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black font-mono text-slate-900 outline-none"
                    />
                  </div>
                </div>

                {/* Warnings / Flags */}
                {calculatedPricing.incompleteWarnings.length > 0 && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-1 text-xs text-amber-900">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Pricing Warnings (Incomplete Line Items)</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                      {calculatedPricing.incompleteWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ROLE-BASED PRICING PREVIEW BANNER */}
              <div className="bg-emerald-950 text-white rounded-3xl p-6 border border-emerald-800 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#00C6A6]" />
                    <span className="text-xs font-black uppercase tracking-wider">Role-Based Quotation Output</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-300">
                    Mode: {pkg.pricingConfiguration?.pricingMode || 'LIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-300 block">Wholesale Net Cost (Internal Only)</span>
                    <span className="text-2xl font-black font-mono text-white mt-1 block">
                      {formatCurrency(calculatedPricing.totalNetTarget, pkg.currency || 'USD')}
                    </span>
                    <span className="text-[10px] text-emerald-400 mt-0.5 block">
                      Ground Services: {formatCurrency(calculatedPricing.servicesNetUSD, 'USD')} • Accommodations: {formatCurrency(calculatedPricing.hotelsNetUSD, 'USD')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-300 block">B2B Agent Wholesale Rate</span>
                    <span className="text-2xl font-black font-mono text-[#00C6A6] mt-1 block">
                      {formatCurrency(calculatedPricing.b2bPriceTarget, pkg.currency || 'USD')}
                    </span>
                    <span className="text-[10px] text-emerald-400 mt-0.5 block">
                      Includes {pkg.pricingConfiguration?.b2bMarkupPercent ?? 12}% wholesale margin
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-300 block">Published Retail Price</span>
                    <span className="text-2xl font-black font-mono text-amber-300 mt-1 block">
                      {formatCurrency(calculatedPricing.retailPriceTarget, pkg.currency || 'USD')}
                    </span>
                    <span className="text-[10px] text-emerald-400 mt-0.5 block">
                      Includes {pkg.pricingConfiguration?.buyerMarkupPercent ?? 25}% retail margin
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INCLUSIONS, EXCLUSIONS, NOTES & POLICIES */}
          {activeTab === 'POLICIES' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-[#008972]" />
                  <span>Highlights, Inclusions, Notes & Cancellation Policy</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Package terms, inclusions, exclusions, and duty management guidelines.
                </p>
              </div>

              {/* Highlights */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Package Highlights (Bullet Points)</label>
                  <button
                    type="button"
                    onClick={() => setPkg({
                      ...pkg,
                      highlights: [...(pkg.highlights || []), 'Exclusive luxury circuit feature']
                    })}
                    className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    + Add Highlight
                  </button>
                </div>

                <div className="space-y-2">
                  {(pkg.highlights || []).map((hl, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={hl}
                        onChange={(e) => {
                          const copy = [...(pkg.highlights || [])];
                          copy[idx] = e.target.value;
                          setPkg({ ...pkg, highlights: copy });
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const copy = (pkg.highlights || []).filter((_, i) => i !== idx);
                          setPkg({ ...pkg, highlights: copy });
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inclusions & Exclusions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-900">Included Services</label>
                    <button
                      type="button"
                      onClick={() => setPkg({
                        ...pkg,
                        inclusions: [...(pkg.inclusions || []), 'Included service item']
                      })}
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[11px] font-bold cursor-pointer"
                    >
                      + Add Included
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(pkg.inclusions || []).map((inc, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={inc}
                          onChange={(e) => {
                            const copy = [...(pkg.inclusions || [])];
                            copy[idx] = e.target.value;
                            setPkg({ ...pkg, inclusions: copy });
                          }}
                          className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const copy = (pkg.inclusions || []).filter((_, i) => i !== idx);
                            setPkg({ ...pkg, inclusions: copy });
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-rose-900">Excluded Services</label>
                    <button
                      type="button"
                      onClick={() => setPkg({
                        ...pkg,
                        exclusions: [...(pkg.exclusions || []), 'Excluded service item']
                      })}
                      className="px-2 py-0.5 bg-rose-50 text-rose-800 rounded text-[11px] font-bold cursor-pointer"
                    >
                      + Add Excluded
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(pkg.exclusions || []).map((exc, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={exc}
                          onChange={(e) => {
                            const copy = [...(pkg.exclusions || [])];
                            copy[idx] = e.target.value;
                            setPkg({ ...pkg, exclusions: copy });
                          }}
                          className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const copy = (pkg.exclusions || []).filter((_, i) => i !== idx);
                            setPkg({ ...pkg, exclusions: copy });
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cancellation Policy & Important Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Cancellation Policy</label>
                  <textarea
                    rows={3}
                    value={pkg.cancellationPolicy || ''}
                    onChange={(e) => setPkg({ ...pkg, cancellationPolicy: e.target.value })}
                    placeholder="e.g. Free cancellation up to 30 days prior to arrival. 50% deposit fee within 15-29 days."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Important Information / Travel Advisory</label>
                  <textarea
                    rows={3}
                    value={pkg.importantInformation || ''}
                    onChange={(e) => setPkg({ ...pkg, importantInformation: e.target.value })}
                    placeholder="e.g. Passport validity must exceed 6 months. Visa requirements and local city taxes."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SEO & PUBLISHING */}
          {activeTab === 'SEO_PUBLISH' && (
            <div className="space-y-6">
              {/* Publication Status Selector */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <label className="text-xs font-bold text-slate-900 block">Publishing Status *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'PUBLISHED', label: 'Published Live', color: 'emerald' },
                    { id: 'DRAFT', label: 'Draft Template', color: 'amber' },
                    { id: 'REVIEW', label: 'In Review', color: 'blue' },
                    { id: 'ARCHIVED', label: 'Archived', color: 'slate' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setPkg({
                        ...pkg,
                        status: st.id as PackageStatus,
                        isPublished: st.id === 'PUBLISHED'
                      })}
                      className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer text-center ${
                        pkg.status === st.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pre-Publish Checklist */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Pre-Publishing Validation Checklist
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Package Title and URL slug configured', passed: !!pkg.title.trim() && !!pkg.slug },
                    { label: 'Destination assigned with regional hubs', passed: !!pkg.destinationId && (pkg.routeHubs || []).length > 0 },
                    { label: 'Day-Wise Itinerary created', passed: (pkg.itinerary || []).length > 0 },
                    { 
                      label: pkg.isLandOnly ? 'Land-Only Mode enabled (No accommodation charges)' : 'Accommodations configured for all stays', 
                      passed: pkg.isLandOnly || !(pkg.routeHubs || []).some(h => h.accommodationType === 'none')
                    },
                    { label: 'Pricing Engine calculation complete', passed: calculatedPricing.isComplete }
                  ].map((check, i) => (
                    <div key={i} className="flex items-center space-x-2 text-xs">
                      {check.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className={check.passed ? 'text-slate-800 font-semibold' : 'text-amber-800 font-semibold'}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEO Tab */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <EntitySEOSettingsTab
                  entityType="PACKAGE"
                  entity={{
                    ...pkg,
                    name: pkg.title,
                    description: pkg.description || pkg.tagline
                  }}
                  seo={pkg.seo as EntitySEO}
                  onChange={(newSeo) => setPkg({
                    ...pkg,
                    seo: newSeo,
                    slug: newSeo.slug || pkg.slug
                  })}
                />
              </div>
            </div>
          )}

          {/* TAB 7: LIVE INTERACTIVE PREVIEW */}
          {activeTab === 'PREVIEW' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden space-y-6">
              {/* Hero Banner */}
              <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-900">
                <img 
                  src={pkg.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200'} 
                  alt={pkg.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-[#008972] text-white text-xs font-black uppercase tracking-wider">
                    {pkg.destinationName}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase">
                    {pkg.durationDays} Days / {pkg.durationNights} Nights Circuit
                  </span>
                  {pkg.isLandOnly && (
                    <span className="px-3 py-1 rounded-full bg-purple-500 text-white text-xs font-black uppercase">
                      Land-Only Package
                    </span>
                  )}
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h1 className="text-xl sm:text-2xl font-black">{pkg.title}</h1>
                  <p className="text-xs text-slate-200 mt-1 max-w-2xl">{pkg.tagline || pkg.description}</p>
                </div>
              </div>

              {/* Preview Body */}
              <div className="p-6 space-y-6">
                {/* Highlights */}
                {(pkg.highlights || []).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Key Highlights</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pkg.highlights.map((hl, i) => (
                        <div key={i} className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start space-x-2 text-xs font-semibold text-slate-800">
                          <CheckCircle2 className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
                          <span>{hl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day-by-Day Preview */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Day-by-Day Itinerary</h4>
                  {(pkg.itinerary || []).map((day, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-slate-900">
                          Day {day.dayNumber}: {day.title}
                        </span>
                        {day.hubName && (
                          <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">
                            {day.hubName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{day.description}</p>
                      
                      {/* Products on this day */}
                      {(day.productIds || []).length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80 flex flex-wrap gap-1.5">
                          {day.productIds.map(pid => {
                            const p = products.find(prod => prod.id === pid);
                            if (!p) return null;
                            return (
                              <span key={pid} className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                                {p.name} ({p.category})
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Accommodations Preview */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Featured Accommodations</h4>
                  {pkg.isLandOnly ? (
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 font-semibold">
                      Accommodation is arranged independently by the client. Land-Only circuit includes all guided sightseeing, ground transfers, and itinerary services.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(pkg.routeHubs || []).map((hub, i) => (
                        <div key={i} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">{hub.hubName} ({hub.nights} Nights)</span>
                          {hub.accommodationType === 'NO_ACCOMMODATION' ? (
                            <span className="font-bold text-slate-700">Arranged by Client</span>
                          ) : hub.accommodationType === 'MANUAL' && hub.manualHotel ? (
                            <span className="font-bold text-slate-900">{hub.manualHotel.hotelName} ({hub.manualHotel.roomType})</span>
                          ) : (
                            <span className="font-bold text-slate-900">{hotels.find(h => h.id === hub.hotelId)?.name || 'Contracted Luxury Hotel'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* PRODUCT INVENTORY SELECTOR MODAL */}
      {productSelectorDayIdx !== null && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  Add Service to Day {(productSelectorDayIdx ?? 0) + 1}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select master products from contracted inventory for {pkg.destinationName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProductSelectorDayIdx(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 flex items-center space-x-2 bg-slate-50">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Search products by name, sku, city..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none"
                />
              </div>

              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="Tours & Experiences">Tours & Experiences</option>
                <option value="Transfers">Transfers</option>
                <option value="Rail Passes & Tickets">Rail Passes & Tickets</option>
                <option value="Travel Services">Travel Services</option>
              </select>
            </div>

            {/* Product List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {products
                .filter(p => {
                  const matchesDest = p.destinationId === pkg.destinationId || (p.destinationName || '').toLowerCase() === (pkg.destinationName || '').toLowerCase();
                  const matchesCat = productCategoryFilter === 'ALL' || p.category === productCategoryFilter;
                  const q = productSearchQuery.toLowerCase();
                  const matchesQ = !q || p.name.toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q);
                  return matchesDest && matchesCat && matchesQ;
                })
                .map(prod => {
                  const isAlreadyAdded = ((pkg.itinerary || [])[productSelectorDayIdx]?.productIds || []).includes(prod.id);
                  return (
                    <div 
                      key={prod.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-between transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold uppercase">
                            {prod.category}
                          </span>
                          <span className="font-bold text-xs text-slate-900 truncate block">
                            {prod.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {prod.city || 'Citywide'} • {formatCurrency(prod.adultNetPrice || 0, prod.currency || 'USD')} • {prod.duration || 'Flexible'}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isAlreadyAdded}
                        onClick={() => {
                          const copy = [...(pkg.itinerary || [])];
                          const curr = copy[productSelectorDayIdx].productIds || [];
                          copy[productSelectorDayIdx] = {
                            ...copy[productSelectorDayIdx],
                            productIds: [...curr, prod.id]
                          };
                          const allIds = Array.from(new Set(copy.flatMap(d => d.productIds || [])));
                          setPkg({ ...pkg, itinerary: copy, productIds: allIds });
                          setProductSelectorDayIdx(null);
                          showToast(`Attached "${prod.name}" to Day ${productSelectorDayIdx + 1}`, 'success');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isAlreadyAdded
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-[#008972] text-white hover:bg-[#007460]'
                        }`}
                      >
                        {isAlreadyAdded ? 'Added' : 'Attach'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* OPTION C: MANUAL HOTEL MODAL */}
      {manualHotelModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  Option C: Manual Hotel / Custom Rate
                </h3>
                <p className="text-[11px] text-slate-500">
                  Configure custom accommodation rate specific to this package.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualHotelModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Hotel Name *</label>
                <input
                  type="text"
                  value={manualHotelForm.hotelName}
                  onChange={(e) => setManualHotelForm({ ...manualHotelForm, hotelName: e.target.value })}
                  placeholder="e.g. Hoshinoya Kyoto Ryokan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">City / Destination</label>
                  <input
                    type="text"
                    value={manualHotelForm.city}
                    onChange={(e) => setManualHotelForm({ ...manualHotelForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Room Category</label>
                  <input
                    type="text"
                    value={manualHotelForm.roomType}
                    onChange={(e) => setManualHotelForm({ ...manualHotelForm, roomType: e.target.value })}
                    placeholder="e.g. Riverside Suite"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Native Rate ({manualHotelForm.rateCurrency || 'USD'})</label>
                  <input
                    type="number"
                    min="0"
                    value={manualHotelForm.ratePerNight}
                    onChange={(e) => setManualHotelForm({ ...manualHotelForm, ratePerNight: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Rate Basis</label>
                  <select
                    value={manualHotelForm.rateBasis || 'PER_ROOM_PER_NIGHT'}
                    onChange={(e) => setManualHotelForm({ ...manualHotelForm, rateBasis: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="PER_ROOM_PER_NIGHT">Per Room / Night</option>
                    <option value="TOTAL_STAY">Total Stay (Lump Sum)</option>
                    <option value="PER_PERSON_PER_NIGHT">Per Person / Night</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Meal Plan Description</label>
                <input
                  type="text"
                  value={manualHotelForm.mealPlanName || ''}
                  onChange={(e) => setManualHotelForm({ ...manualHotelForm, mealPlanName: e.target.value })}
                  placeholder="e.g. Kaiseki Multi-Course Dinner & Breakfast Included"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
                Notice: Manual hotels are strictly tied to this package template and do not alter master hotel inventory.
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end space-x-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setManualHotelModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveManualHotel}
                className="px-5 py-2 bg-[#008972] text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
              >
                Apply Hotel Rate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
