import React, { useState, useMemo } from 'react';
import { Hotel, HotelRoomType, HotelRate, MealPlanCode, CurrencyCode, SUPPORTED_CURRENCIES } from '../types';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../services/pricingEngine';
import { calculateHotelStayPrice, getMealPlanLabel, hotelToProduct } from '../utils/hotelHelpers';
import { 
  X, 
  Star, 
  MapPin, 
  Building, 
  Bed, 
  Coffee, 
  CheckCircle2, 
  Calendar, 
  Users, 
  ShieldCheck, 
  Globe, 
  ExternalLink, 
  Navigation, 
  Sparkles, 
  Plus, 
  Check, 
  Info,
  ChevronLeft,
  ChevronRight,
  Plane,
  Train,
  Clock,
  Compass
} from 'lucide-react';

interface HotelDetailModalProps {
  hotel: Hotel | null;
  onClose: () => void;
  onInstantBook?: (hotel: Hotel, roomType: HotelRoomType, rate: HotelRate, nights: number) => void;
}

export const HotelDetailModal: React.FC<HotelDetailModalProps> = ({
  hotel,
  onClose,
  onInstantBook
}) => {
  const { role } = useAuth();
  const { currency, setCurrency, addProductToQuote } = useQuotation();

  // Active Photo Index in Gallery
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const roomTypes = hotel?.roomTypes || [];

  // Selected Room & Meal Plan
  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => {
    return roomTypes[0]?.id || '';
  });

  const selectedRoom = roomTypes.find(r => r.id === selectedRoomId) || roomTypes[0];
  const roomRates = selectedRoom?.rates || [];

  const [selectedRateId, setSelectedRateId] = useState<string>(() => {
    return roomRates[0]?.id || '';
  });

  // Keep rate updated if room changes
  const activeRate = roomRates.find(r => r.id === selectedRateId) || roomRates[0] || {
    id: 'std',
    mealPlan: 'BB' as MealPlanCode,
    mealPlanName: 'Bed & Breakfast Included',
    singleNetRate: hotel?.startingNetPrice || 500,
    doubleNetRate: hotel?.startingNetPrice || 600,
    tripleNetRate: hotel?.startingNetPrice || 750,
    extraBedRate: 100,
    childRate: 50,
    markupPercent: 18,
    taxPercent: 10,
    feePercent: 2.5,
    currency: hotel?.currency || 'USD',
    validityFrom: '2026-01-01',
    validityTo: '2026-12-31'
  };

  // Stay parameters for live calculation
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    const d = new Date(Date.now() + 86400000 * 14);
    return d.toISOString().split('T')[0];
  });
  const [nights, setNights] = useState<number>(3);
  const [roomsCount, setRoomsCount] = useState<number>(1);
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [extraBeds, setExtraBeds] = useState<number>(0);
  const [addedSuccess, setAddedSuccess] = useState(false);

  const startingSellingPrice = useMemo(() => {
    if (!hotel) return 0;
    const firstRoom = hotel.roomTypes?.[0];
    const firstRate = firstRoom?.rates?.[0] || activeRate;
    if (firstRoom && firstRate) {
      const calc = calculateHotelStayPrice({
        hotel,
        roomType: firstRoom,
        rate: firstRate,
        checkInDate,
        nights: 1,
        roomsCount: 1,
        adults: 2,
        children: 0,
        extraBeds: 0,
        targetCurrency: currency,
        agentClientMarkupPercent: 12
      });
      return calc.finalTotalSellingPrice;
    }
    const netConverted = convertCurrency(hotel.startingNetPrice || 400, hotel.currency, currency);
    return Math.round(netConverted * 1.12 * 1.1);
  }, [hotel, activeRate, checkInDate, currency]);

  if (!hotel) return null;

  const galleryImages = hotel.images && (hotel.images || []).length > 0 ? hotel.images : [hotel.heroImage];

  // Calculate live stay price
  const stayCalc = selectedRoom ? calculateHotelStayPrice({
    hotel,
    roomType: selectedRoom,
    rate: activeRate,
    checkInDate,
    nights,
    roomsCount,
    adults,
    children,
    extraBeds,
    targetCurrency: currency,
    agentClientMarkupPercent: 12
  }) : null;

  const handleAddHotelStay = () => {
    if (!selectedRoom) return;
    const hotelProd = hotelToProduct(hotel, selectedRoom, activeRate, nights);
    
    // Add product to global quotation context
    addProductToQuote(hotelProd, {
      adults,
      children,
      infants: 0,
      travelDate: checkInDate,
      openDrawer: true
    });

    setAddedSuccess(true);
    setTimeout(() => {
      setAddedSuccess(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-fadeIn">
      <div 
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[96vh] sm:max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-4 border-b border-slate-100 bg-white sticky top-0 z-20">
          <div className="flex items-center space-x-2 sm:space-x-3 truncate pr-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-teal-50 text-[#00C6A6] flex items-center justify-center font-bold shrink-0">
              <Building className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-1.5 sm:px-2 py-0.5 rounded-full">
                  {hotel.propertyType ? hotel.propertyType.replace('_', ' ') : 'Hotel'}
                </span>
                <div className="flex items-center text-amber-400">
                  {Array.from({ length: hotel.starRating }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 hidden xs:inline">Code: {hotel.code}</span>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-slate-900 mt-0.5 truncate">
                {hotel.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            {/* Live Currency Selector */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-50 border border-slate-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 hidden sm:inline">Currency:</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-800 border-none outline-none focus:ring-0 cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-3.5 sm:p-6 space-y-5 sm:space-y-8 flex-1">
          {/* 1. Hero Image & Gallery Section */}
          <div className="space-y-2 sm:space-y-3">
            <div className="relative h-56 sm:h-96 rounded-xl sm:rounded-2xl overflow-hidden bg-slate-900 group">
              <img
                src={galleryImages[activePhotoIdx] || hotel.heroImage}
                alt={hotel.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

              {/* Navigation Arrows for Gallery */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActivePhotoIdx((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/80 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePhotoIdx((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1))}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/80 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer active:scale-95"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </>
              )}

              {/* Location & Title Overlay */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-4 sm:left-4 sm:right-4 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 sm:gap-2 pointer-events-none">
                <div>
                  <div className="flex items-center space-x-1.5 sm:space-x-2 text-[11px] sm:text-xs font-semibold text-teal-300 mb-0.5 sm:mb-1">
                    <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>{hotel.area}, {hotel.cityName} • {hotel.country}</span>
                  </div>
                  <h3 className="text-base sm:text-2xl font-black text-white drop-shadow-md truncate">
                    {hotel.name}
                  </h3>
                </div>
                <div className="bg-black/50 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-white/20 text-right shrink-0">
                  <span className="text-[10px] sm:text-[11px] text-slate-300 block">Starting from</span>
                  <span className="text-sm sm:text-lg font-black text-emerald-400">
                    {formatCurrency(startingSellingPrice, currency)}
                    <span className="text-[10px] sm:text-xs font-normal text-slate-300"> / night</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Thumbnail Strip */}
            {galleryImages.length > 1 && (
              <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto pb-1 no-scrollbar">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`relative w-14 h-10 sm:w-20 sm:h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      activePhotoIdx === idx ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/30' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`${hotel.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Key Highlights & Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Description & Amenities */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
                <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center space-x-2">
                  <Info className="w-4 h-4 text-[#00C6A6]" />
                  <span>Property Overview & Atmosphere</span>
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {hotel.description}
                </p>
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{hotel.address}</span>
                  </div>
                  {hotel.website && (
                    <a
                      href={hotel.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Official Website</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Amenities */}
              {hotel.amenities && (hotel.amenities || []).length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#00C6A6]" />
                    <span>Signature Hotel Amenities & VIP Privileges</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(hotel.amenities || []).map((amenity, i) => (
                      <div key={i} className="flex items-center space-x-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-medium">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Location & Transfer Distances */}
              {hotel.locationDetails && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
                    <Compass className="w-4 h-4 text-[#00C6A6]" />
                    <span>Strategic Location & Transit Distances</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {hotel.locationDetails.airportName && (
                      <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <Plane className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block">{hotel.locationDetails.airportName}</span>
                          <span className="text-slate-500">
                            {hotel.locationDetails.airportDistanceKm} km ({hotel.locationDetails.airportTransferTimeMins} mins private transfer)
                          </span>
                        </div>
                      </div>
                    )}
                    {hotel.locationDetails.railwayStationName && (
                      <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <Train className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block">{hotel.locationDetails.railwayStationName}</span>
                          <span className="text-slate-500">
                            {hotel.locationDetails.railwayDistanceKm} km ({hotel.locationDetails.walkingDistanceMins} mins walking distance)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {hotel.locationDetails?.nearbyAttractions && (hotel.locationDetails.nearbyAttractions || []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-700 block mb-1.5">Nearby Cultural Highlights:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(hotel.locationDetails.nearbyAttractions || []).map((att, i) => (
                          <span key={i} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {att}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Col: Interactive Room & Stay Quotation Calculator */}
            <div className="space-y-4">
              <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
                      <Bed className="w-4 h-4 text-[#00C6A6]" />
                      <span>Stay Price Calculator</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">Real-time tariff calculation</span>
                  </div>
                  <span className="text-xs font-bold bg-[#00C6A6]/20 text-[#00C6A6] px-2 py-0.5 rounded-md">
                    Instant Quote
                  </span>
                </div>

                {/* 1. Room Type Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Select Room Category:
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => {
                      setSelectedRoomId(e.target.value);
                      const rm = (hotel.roomTypes || []).find(r => r.id === e.target.value);
                      if (rm && (rm.rates || []).length > 0) {
                        setSelectedRateId(rm.rates[0].id);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:ring-1 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                  >
                    {(hotel.roomTypes || []).map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.roomName} ({room.roomCategory})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Meal Plan Selector */}
                {selectedRoom && (selectedRoom.rates || []).length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Meal Plan & Rate Policy:
                    </label>
                    <select
                      value={selectedRateId}
                      onChange={(e) => setSelectedRateId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:ring-1 focus:ring-[#00C6A6] focus:border-[#00C6A6] outline-none"
                    >
                      {(selectedRoom.rates || []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.mealPlan} - {r.mealPlanName || getMealPlanLabel(r.mealPlan)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Dates & Nights Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Check-in Date:</label>
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:ring-1 focus:ring-[#00C6A6] outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Nights:</label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={nights}
                        onChange={(e) => setNights(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:ring-1 focus:ring-[#00C6A6] outline-none text-xs text-center"
                      />
                      <span className="text-[11px] text-slate-400">Nts</span>
                    </div>
                  </div>
                </div>

                {/* 4. Occupancy Grid */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Rooms:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={roomsCount}
                      onChange={(e) => setRoomsCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-medium text-center outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Adults:</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={adults}
                      onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-medium text-center outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Children:</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={children}
                      onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-medium text-center outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Calculation Summary Box */}
                {stayCalc && (
                  <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80 space-y-2 text-xs">
                    {(role === 'ADMIN' || role === 'DMC_STAFF') && (
                      <div className="space-y-1.5 pb-2 border-b border-slate-700/80 text-[11px] text-slate-400">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Admin Supplier Breakdown</span>
                        <div className="flex justify-between">
                          <span>Base Net Rate:</span>
                          <span className="font-mono text-slate-300">{formatCurrency(stayCalc.nightlyBaseNetRate, currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stay Net Cost:</span>
                          <span className="font-mono text-slate-300">{formatCurrency(stayCalc.roomsTotalNetCost, currency)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300">
                      <span>Stay Duration:</span>
                      <span className="font-semibold text-white">
                        {nights} {nights === 1 ? 'Night' : 'Nights'} • {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Occupancy:</span>
                      <span className="font-semibold text-white">
                        {adults} Adults{children > 0 ? `, ${children} Children` : ''}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-700 flex justify-between items-baseline">
                      <div>
                        <span className="text-xs font-bold text-white block">Final Selling Price:</span>
                        <span className="text-[10px] text-slate-400">All taxes, fees & breakfast included</span>
                      </div>
                      <span className="text-base sm:text-lg font-black text-emerald-400">
                        {formatCurrency(stayCalc.finalTotalSellingPrice, currency)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleAddHotelStay}
                    className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 ${
                      addedSuccess
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[#00C6A6] hover:bg-[#00b296] text-white shadow-md hover:shadow-lg'
                    }`}
                  >
                    {addedSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Added to Itinerary Quotation!</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add Hotel Stay to Quotation</span>
                      </>
                    )}
                  </button>

                  {onInstantBook && selectedRoom && (
                    <button
                      type="button"
                      onClick={() => onInstantBook(hotel, selectedRoom, activeRate, nights)}
                      className="w-full py-2 sm:py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer text-center active:scale-95"
                    >
                      Instant Reservation Request
                    </button>
                  )}
                </div>
              </div>

              {/* Room Highlights Box */}
              {selectedRoom && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                  <h5 className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <Bed className="w-3.5 h-3.5 text-slate-500" />
                    <span>{selectedRoom.roomName} Features</span>
                  </h5>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {selectedRoom.description}
                  </p>
                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400 block">Bed Configuration:</span>
                      <strong className="text-slate-800">{selectedRoom.bedType}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Room Size:</span>
                      <strong className="text-slate-800">{selectedRoom.roomSizeSqMeters} m²</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">View:</span>
                      <strong className="text-slate-800">{selectedRoom.view}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Max Guests:</span>
                      <strong className="text-slate-800">{selectedRoom.maxAdults} Adults, {selectedRoom.maxChildren} Chd</strong>
                    </div>
                  </div>
                  {selectedRoom.cancellationPolicy && (
                    <div className="mt-2 p-2 bg-amber-50/80 border border-amber-200/60 rounded-lg text-[10px] text-amber-800">
                      <strong>Policy:</strong> {selectedRoom.cancellationPolicy}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
