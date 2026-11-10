import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  MapPin, 
  Star, 
  Check, 
  Eye, 
  Users, 
  Calendar, 
  Bed, 
  Trash2, 
  RotateCcw, 
  ArrowRight, 
  X, 
  AlertCircle,
  SlidersHorizontal,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { Hotel, Destination } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';
import { calculateHotelStayPrice } from '../../utils/hotelHelpers';
import { AddHotelToQuoteModal } from './AddHotelToQuoteModal';
import { B2BViewDetailsModal } from '../B2BViewDetailsModal';
import { canonicalImageService } from '../../services/imageService';
import { AppDatabase } from '../../services/db';
import { inventoryDiscoveryService } from '../../services/inventoryDiscoveryService';

interface B2BHotelsCatalogViewProps {
  hotels?: Hotel[];
  destinations?: Destination[];
  onOpenCreateQuote: () => void;
  onViewHotelDetails?: (hotel: Hotel) => void;
}

export const B2BHotelsCatalogView: React.FC<B2BHotelsCatalogViewProps> = ({
  hotels = [],
  destinations = [],
  onOpenCreateQuote,
  onViewHotelDetails
}) => {
  const { items, removeProductFromQuote, currency, setIsQuoteDrawerOpen } = useQuotation();
  const db = AppDatabase.getInstance();
  const [dbTick, setDbTick] = useState(0);

  useEffect(() => {
    const unsubDb = db.subscribe(() => setDbTick(t => t + 1));
    const unsubImg = canonicalImageService.subscribe(() => setDbTick(t => t + 1));
    return () => {
      unsubDb();
      unsubImg();
    };
  }, [db]);

  const canonicalHotels = useMemo(() => {
    const fresh = db.getHotels();
    return (fresh && fresh.length > 0) ? fresh : hotels;
  }, [hotels, db, dbTick]);

  const canonicalDestinations = useMemo(() => {
    const fresh = db.getDestinations();
    return (fresh && fresh.length > 0) ? fresh : destinations;
  }, [destinations, db, dbTick]);

  // Search-First State Management
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Search Form State (with required defaults)
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    const d = new Date(Date.now() + 86400000 * 14);
    return d.toISOString().split('T')[0];
  });
  const [checkOutDate, setCheckOutDate] = useState<string>(() => {
    const d = new Date(Date.now() + 86400000 * 17);
    return d.toISOString().split('T')[0];
  });
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [infants, setInfants] = useState<number>(0);
  const [roomsCount, setRoomsCount] = useState<number>(1);

  // Optional Filter States
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedStarRating, setSelectedStarRating] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState<boolean>(false);

  // Modal States
  const [selectedHotelForDetails, setSelectedHotelForDetails] = useState<Hotel | null>(null);
  const [selectedHotelForQuote, setSelectedHotelForQuote] = useState<Hotel | null>(null);
  const [quoteSuccessNotification, setQuoteSuccessNotification] = useState<{ hotel: Hotel; details: any } | null>(null);

  // Calculate nights dynamically
  const calculatedNights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 3;
    const diff = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [checkInDate, checkOutDate]);

  // Execute Hotel Search using InventoryDiscoveryService
  const searchResult = useMemo(() => {
    if (!hasSearched) {
      return {
        items: [] as Hotel[],
        totalCount: 0,
        page: 1,
        pageSize,
        totalPages: 1,
        hasMore: false,
        stayDetails: {
          checkInDate,
          checkOutDate,
          nights: calculatedNights,
          adults,
          children,
          infants,
          roomsCount
        },
        filtersApplied: {}
      };
    }

    try {
      return inventoryDiscoveryService.searchHotels(
        {
          checkInDate,
          checkOutDate,
          adults,
          children,
          infants,
          roomsCount,
          destinationId: selectedDestination,
          starRating: selectedStarRating,
          searchQuery,
          page: currentPage,
          pageSize
        },
        canonicalHotels
      );
    } catch (err: any) {
      return {
        items: [] as Hotel[],
        totalCount: 0,
        page: 1,
        pageSize,
        totalPages: 1,
        hasMore: false,
        stayDetails: {
          checkInDate,
          checkOutDate,
          nights: calculatedNights,
          adults,
          children,
          infants,
          roomsCount
        },
        filtersApplied: {}
      };
    }
  }, [
    hasSearched,
    checkInDate,
    checkOutDate,
    adults,
    children,
    infants,
    roomsCount,
    selectedDestination,
    selectedStarRating,
    searchQuery,
    currentPage,
    canonicalHotels,
    calculatedNights,
    pageSize
  ]);

  // Search Submission Handler with Validation
  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError(null);

    if (!checkInDate || !checkOutDate) {
      setSearchError('Both Check-in and Check-out dates are required.');
      return;
    }

    const checkInTime = new Date(checkInDate).getTime();
    const checkOutTime = new Date(checkOutDate).getTime();

    if (isNaN(checkInTime) || isNaN(checkOutTime)) {
      setSearchError('Invalid date format. Please select valid calendar dates.');
      return;
    }

    if (checkOutTime <= checkInTime) {
      setSearchError('Check-out date must be strictly after Check-in date.');
      return;
    }

    if (adults < 1) {
      setSearchError('At least 1 adult guest is required.');
      return;
    }

    if (roomsCount < 1) {
      setSearchError('At least 1 room is required.');
      return;
    }

    setIsSearching(true);
    setCurrentPage(1);
    setHasSearched(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 200);
  };

  // Reset Filters Handler
  const handleResetFilters = () => {
    const dIn = new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
    const dOut = new Date(Date.now() + 86400000 * 17).toISOString().split('T')[0];
    setCheckInDate(dIn);
    setCheckOutDate(dOut);
    setAdults(2);
    setChildren(0);
    setInfants(0);
    setRoomsCount(1);
    setSelectedDestination('ALL');
    setSelectedStarRating('ALL');
    setSearchQuery('');
    setSearchError(null);
    setHasSearched(false);
    setCurrentPage(1);
  };

  const isHotelInQuote = (hotelId: string) => {
    return items.some(it => it.product && (it.product.id === hotelId || it.product.id.includes(hotelId)));
  };

  const handleOpenAddHotelModal = (hotel: Hotel) => {
    setSelectedHotelForQuote(hotel);
  };

  const handleRemoveHotelFromQuote = (hotelId: string) => {
    const existing = items.find(it => it.product && (it.product.id === hotelId || it.product.id.includes(hotelId)));
    if (existing) {
      removeProductFromQuote(existing.id);
    }
  };

  const handleViewDetails = (hotel: Hotel) => {
    if (onViewHotelDetails) {
      onViewHotelDetails(hotel);
    } else {
      setSelectedHotelForDetails(hotel);
    }
  };

  const hasActiveFilters = 
    selectedDestination !== 'ALL' ||
    selectedStarRating !== 'ALL' ||
    searchQuery.trim() !== '' ||
    adults !== 2 ||
    children !== 0 ||
    roomsCount !== 1;

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
              Search-First Discovery
            </span>
            <span className="text-xs text-slate-400 font-mono">({canonicalHotels.length} Luxury Properties & Ryokans)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Contracted Accommodations & Ryokans</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Query direct wholesale allocations with room upgrades, gourmet breakfast inclusions, and VIP welcome amenities.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <span>Open Quotation Builder ({items.length} in Quote)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Success Notification Banner */}
      {quoteSuccessNotification && (
        <div className="bg-amber-950 text-white px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg border border-amber-500/40 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {quoteSuccessNotification.hotel.name} added to Cart!
              </div>
              <div className="text-[11px] text-amber-300">
                {quoteSuccessNotification.details?.nights || calculatedNights} Nights ({quoteSuccessNotification.details?.checkInDate} to {quoteSuccessNotification.details?.checkOutDate}) • {quoteSuccessNotification.details?.roomName || 'Deluxe Room'}.
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsQuoteDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>View Cart</span>
            </button>
            <button
              onClick={() => setQuoteSuccessNotification(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
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
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Search Accommodations & Ryokans</h2>
              <p className="text-[11px] text-slate-500">Configure stay dates, party size, rooms, and destination</p>
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

        {/* Validation Error Alert */}
        {searchError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-rose-700 text-xs font-bold animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        <form onSubmit={handleExecuteSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {/* Filter 1: Check-in Date */}
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-amber-500" />
                <span>Check-in Date</span>
              </label>
              <input
                type="date"
                required
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Filter 2: Check-out Date */}
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-amber-500" />
                <span>Check-out Date</span>
              </label>
              <input
                type="date"
                required
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Filter 3: Adults */}
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Users className="w-3 h-3 text-amber-500" />
                <span>Adults</span>
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={adults}
                onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Filter 4: Children */}
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Child (0-11)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={children}
                onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Filter 5: Infant */}
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Infant (Under 2)
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={infants}
                onChange={(e) => setInfants(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Filter 6: Rooms */}
            <div className="space-y-1 lg:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Bed className="w-3 h-3 text-amber-500" />
                <span>Rooms</span>
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={roomsCount}
                onChange={(e) => setRoomsCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Primary Action Button */}
            <div className="flex items-end lg:col-span-1">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center justify-center space-x-2"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Hotels</span>
              </button>
            </div>
          </div>

          {/* Quick Destination & Star Rating Filter Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by hotel or ryokan name, city or district (e.g. Tokyu Capitol, Aman Tokyo, Hoshinoya, Park Hyatt)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition-all"
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
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
              >
                <option value="ALL">All Destinations</option>
                {canonicalDestinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                value={selectedStarRating}
                onChange={(e) => setSelectedStarRating(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
              >
                <option value="ALL">All Star Ratings</option>
                <option value="5">5★ Luxury & Ryokans</option>
                <option value="4">4★ Premium Heritage</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* STATE 1: INITIAL SEARCH-FIRST EMPTY STATE (User has not yet triggered a search) */}
      {!hasSearched && (
        <div className="bg-white rounded-3xl p-10 md:p-14 text-center border border-slate-200/90 shadow-xs space-y-6 max-w-2xl mx-auto my-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Building2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 font-sans tracking-tight">
              Enter your stay dates and guest details to discover suitable hotels and ryokans.
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-lg mx-auto">
              Specify your client's check-in date, check-out date, and party size above to verify live room allotments, contracted nightly rates, and gourmet meal plans.
            </p>
          </div>

          {/* Quick-Start Destination Shortcuts */}
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
              Popular Hotel Hubs
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
                  className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-amber-400 hover:text-slate-950 border border-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <MapPin className="w-3 h-3 text-amber-600" />
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500">Found</span>
                <span className="text-sm font-black text-slate-900 font-mono">{searchResult.totalCount}</span>
                <span className="text-xs text-slate-500">luxury properties matching your stay criteria</span>
              </div>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                {calculatedNights} Nights ({checkInDate} to {checkOutDate}) • {adults} Adults{children > 0 ? `, ${children} Children` : ''} • {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'}
              </span>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Search</span>
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {isSearching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3 animate-pulse">
                  <div className="h-44 bg-slate-100 rounded-2xl"></div>
                  <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  <div className="h-10 bg-slate-100 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : searchResult.items.length === 0 ? (
            /* STATE 3: NO MATCHING RESULTS EMPTY STATE */
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-xs space-y-4 max-w-xl mx-auto my-8 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Building2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 font-sans">No hotels found</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  No hotels found for your selected stay dates and guest requirements. Try adjusting your search criteria.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleResetFilters}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Clear Filters & Reset Search</span>
                </button>
              </div>
            </div>
          ) : (
            /* HOTELS RESULTS GRID */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {searchResult.items.map(hotel => {
                const inQuote = isHotelInQuote(hotel.id);
                const room = hotel.roomTypes?.[0];
                const stayCalc = calculateHotelStayPrice({
                  hotel,
                  roomType: room,
                  rate: room?.rates?.[0],
                  nights: calculatedNights,
                  roomsCount: roomsCount,
                  adults: adults,
                  children: children,
                  extraBeds: 0,
                  targetCurrency: currency
                });

                const convertedNightlySellingPrice = stayCalc.pricePerNightSelling > 0
                  ? stayCalc.pricePerNightSelling
                  : convertCurrency(hotel.startingSellingPrice || 380, (hotel.currency || 'USD') as any, currency);

                const totalStaySellingPrice = stayCalc.totalSellingPrice > 0
                  ? stayCalc.totalSellingPrice
                  : convertedNightlySellingPrice * calculatedNights * roomsCount;

                return (
                  <div
                    key={hotel.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-amber-500 transition-all flex flex-col overflow-hidden group"
                  >
                    {/* Image Header */}
                    <div 
                      className="relative h-48 overflow-hidden bg-slate-900 cursor-pointer"
                      onClick={() => handleViewDetails(hotel)}
                    >
                      <img
                        loading="lazy"
                        src={canonicalImageService.resolveHotelImage(hotel)}
                        alt={hotel.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = canonicalImageService.resolveHotelImage(hotel);
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                      <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-[#00E5C0]">
                        {hotel.cityName || hotel.city}
                      </div>
                      <div className="absolute top-3 right-3 flex items-center px-2.5 py-0.5 rounded-full bg-amber-400 text-[10px] font-black text-slate-950">
                        <Star className="w-3 h-3 fill-slate-950 mr-0.5" />
                        {hotel.starRating || 5}★
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <h3 className="text-base font-extrabold leading-tight truncate drop-shadow-xs">{hotel.name}</h3>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2.5">
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {hotel.shortDescription || 'Prestigious property with dedicated concierge, bespoke dining, and wellness spa.'}
                        </p>

                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-700">
                            <span className="font-semibold text-[11px]">Room Type:</span>
                            <span className="font-bold text-slate-900 truncate max-w-[150px]">{room?.roomName || 'Deluxe Room'}</span>
                          </div>
                          <div className="flex justify-between text-slate-700">
                            <span className="font-semibold text-[11px]">Board Basis:</span>
                            <span className="text-emerald-700 font-bold">Gourmet Breakfast Included</span>
                          </div>
                          <div className="flex justify-between text-slate-700">
                            <span className="font-semibold text-[11px]">Stay Duration:</span>
                            <span className="text-amber-800 font-bold">{calculatedNights} Nights • {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Price Row */}
                      <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                            Stay Total ({calculatedNights} Nights)
                          </span>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-base font-black text-slate-900 font-mono">
                              {formatCurrency(totalStaySellingPrice, currency)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({formatCurrency(convertedNightlySellingPrice, currency)}/night)
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          Direct Allotment
                        </span>
                      </div>

                      {/* Standardized 3 Action Buttons */}
                      <div className="space-y-2 pt-1">
                        {/* Primary Row: Add to Quote or In Quote status */}
                        {inQuote ? (
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenAddHotelModal(hotel)}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                              title="Click to adjust stay dates, nights or room tier"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>In Cart (Edit Stay)</span>
                            </button>
                            <button
                              onClick={() => handleRemoveHotelFromQuote(hotel.id)}
                              className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                              title="Remove from Cart"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenAddHotelModal(hotel)}
                            className="w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-black"
                          >
                            <span>Configure & Add to Cart</span>
                          </button>
                        )}

                        {/* Secondary Row: View Details (Full Width) */}
                        <button
                          onClick={() => handleViewDetails(hotel)}
                          className="w-full py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-300" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {/* Dedicated Add Hotel to Quote Modal with Pre-populated Search Stay Parameters */}
      {selectedHotelForQuote && (
        <AddHotelToQuoteModal
          hotel={selectedHotelForQuote}
          isOpen={!!selectedHotelForQuote}
          initialCheckInDate={checkInDate}
          initialNights={calculatedNights}
          initialAdults={adults}
          initialChildren={children}
          initialInfants={infants}
          initialRoomsCount={roomsCount}
          onClose={() => setSelectedHotelForQuote(null)}
          onSuccess={(h, details) => {
            setQuoteSuccessNotification({ hotel: h, details });
          }}
        />
      )}

      {/* Standardized Buyer-style Hotel Details Modal */}
      {selectedHotelForDetails && (
        <B2BViewDetailsModal
          hotel={selectedHotelForDetails}
          onClose={() => setSelectedHotelForDetails(null)}
          onConfigureHotel={(h) => {
            setSelectedHotelForDetails(null);
            setSelectedHotelForQuote(h);
          }}
        />
      )}
    </div>
  );
};
