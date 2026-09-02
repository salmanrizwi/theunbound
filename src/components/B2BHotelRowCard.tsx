import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Hotel, HotelRoomType, HotelRate, MealPlanCode, CurrencyCode, Product } from '../types';
import { formatCurrency, convertCurrency } from '../services/pricingEngine';
import { calculateHotelStayPrice, getMealPlanLabel, hotelToProduct } from '../utils/hotelHelpers';
import { 
  Building, 
  Star, 
  MapPin, 
  Bed, 
  Calendar, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Check, 
  Eye, 
  Sparkles, 
  DollarSign, 
  Clock, 
  ShieldCheck,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

interface B2BHotelRowCardProps {
  hotel: Hotel;
  currency: CurrencyCode;
  agentMarkupPercent: number;
  onAddHotelStayToQuote: (
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
  ) => void;
  onViewHotelDetails: (hotel: Hotel) => void;
  isJustAdded?: boolean;
}

export const B2BHotelRowCard: React.FC<B2BHotelRowCardProps> = ({
  hotel,
  currency,
  agentMarkupPercent,
  onAddHotelStayToQuote,
  onViewHotelDetails,
  isJustAdded = false
}) => {
  const { user } = useAuth();
  // Inline Expansion State
  const [isExpanded, setIsExpanded] = useState(false);

  // Safe room types array
  const roomTypes = hotel.roomTypes || [];

  // Selected Room & Meal Plan
  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => roomTypes[0]?.id || '');
  const selectedRoom = roomTypes.find(r => r.id === selectedRoomId) || roomTypes[0];

  const roomRates = selectedRoom?.rates || [];
  const [selectedRateId, setSelectedRateId] = useState<string>(() => roomRates[0]?.id || '');
  const activeRate = roomRates.find(r => r.id === selectedRateId) || roomRates[0] || {
    id: 'default',
    mealPlan: 'BB' as MealPlanCode,
    mealPlanName: 'Bed & Breakfast Included',
    singleNetRate: hotel.startingNetPrice,
    doubleNetRate: hotel.startingNetPrice,
    tripleNetRate: hotel.startingNetPrice,
    extraBedRate: 80,
    childRate: 40,
    markupPercent: 18,
    taxPercent: 10,
    feePercent: 2.5,
    currency: hotel.currency || 'USD',
    validityFrom: '2026-01-01',
    validityTo: '2026-12-31'
  };

  // Stay parameters
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    const d = new Date(Date.now() + 86400000 * 14);
    return d.toISOString().split('T')[0];
  });
  const [nights, setNights] = useState<number>(3);
  const [roomsCount, setRoomsCount] = useState<number>(1);
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [extraBeds, setExtraBeds] = useState<number>(0);

  // Quick feedback state
  const [addedLocal, setAddedLocal] = useState(false);

  // Live calculation
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
    agentClientMarkupPercent: agentMarkupPercent
  }) : null;

  const handleAddStay = () => {
    if (!selectedRoom) return;
    const hotelProd = hotelToProduct(hotel, selectedRoom, activeRate, nights);
    
    onAddHotelStayToQuote(hotelProd, {
      adults,
      children,
      infants: 0,
      travelDate: checkInDate,
      nights,
      roomsCount,
      roomName: selectedRoom.roomName,
      mealPlan: activeRate.mealPlanName || getMealPlanLabel(activeRate.mealPlan)
    });

    setAddedLocal(true);
    setTimeout(() => setAddedLocal(false), 2000);
  };

  const startingSellingPrice = useMemo(() => {
    const firstRoom = hotel.roomTypes?.[0];
    const firstRate = firstRoom?.rates?.[0] || activeRate;
    if (firstRoom) {
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
        agentClientMarkupPercent: agentMarkupPercent
      });
      return calc.finalTotalSellingPrice;
    }
    const netConverted = convertCurrency(hotel.startingNetPrice || 400, hotel.currency, currency);
    return Math.round(netConverted * (1 + (agentMarkupPercent || 15) / 100) * 1.1);
  }, [hotel, activeRate, checkInDate, currency, agentMarkupPercent]);

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
      isExpanded 
        ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/20' 
        : 'border-slate-200 hover:border-slate-300'
    }`}>
      {/* Primary Row Header */}
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Thumbnail & Info */}
        <div className="flex items-start space-x-3.5 flex-1 min-w-0">
          <div 
            onClick={() => onViewHotelDetails(hotel)}
            className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer group"
          >
            <img
              src={hotel.heroImage}
              alt={hotel.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
            <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-xs text-white text-[9px] font-black px-1.5 py-0.5 rounded flex items-center">
              <Star className="w-2.5 h-2.5 text-amber-400 fill-current mr-0.5" />
              <span>{hotel.starRating}★</span>
            </div>
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Eye className="w-4 h-4" />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="bg-teal-50 text-teal-700 border border-teal-200/60 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
                <Building className="w-2.5 h-2.5 text-teal-600" />
                <span>HOTEL / STAY</span>
              </span>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                {hotel.propertyType ? hotel.propertyType.replace('_', ' ') : 'Hotel'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Code: {hotel.code}
              </span>
            </div>

            <h3 
              onClick={() => onViewHotelDetails(hotel)}
              className="text-sm sm:text-base font-bold text-slate-900 truncate hover:text-[#008972] transition-colors cursor-pointer"
            >
              {hotel.name}
            </h3>

            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span className="flex items-center space-x-1 text-slate-600">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>{hotel.area}, {hotel.cityName}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1 text-slate-600">
                <Bed className="w-3 h-3 text-slate-400" />
                <span>{roomTypes.length} Room Types</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 line-clamp-1">
              {hotel.shortDescription || hotel.description}
            </p>
          </div>
        </div>

        {/* Right: Pricing Indicator & Action Controls */}
        <div className="flex items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <div className="text-left lg:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Starting Final Rate
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-sm sm:text-base font-black text-slate-900">
                {formatCurrency(startingSellingPrice, currency)}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">/ night</span>
            </div>
            <span className="text-[9px] text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded inline-block border border-teal-200/60">
              Guaranteed Tariff
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onViewHotelDetails(hotel)}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
              title="Inspect Property Details"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                isExpanded
                  ? 'bg-slate-900 text-white'
                  : 'bg-teal-50 hover:bg-teal-100 text-[#008972] border border-teal-200/80'
              }`}
            >
              <Bed className="w-3.5 h-3.5" />
              <span>{isExpanded ? 'Hide Options' : 'Select Room & Stay'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Room Selection & Live Rate Configurator */}
      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Room Type */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Room Category:
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => {
                  setSelectedRoomId(e.target.value);
                  const rm = roomTypes.find(r => r.id === e.target.value);
                  if (rm && rm.rates && (rm.rates || []).length > 0) {
                    setSelectedRateId(rm.rates[0].id);
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
              >
                {roomTypes.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomName} ({room.roomCategory})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Meal Plan */}
            {selectedRoom && (
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Meal Plan & Board:
                </label>
                <select
                  value={selectedRateId}
                  onChange={(e) => setSelectedRateId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
                >
                  {selectedRoom.rates.map((rate) => (
                    <option key={rate.id} value={rate.id}>
                      {rate.mealPlan} - {rate.mealPlanName || getMealPlanLabel(rate.mealPlan)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Check-In & Nights */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Check-in:</label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Nights:</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={nights}
                  onChange={(e) => setNights(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>

            {/* 4. Occupancy */}
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Rooms:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={roomsCount}
                  onChange={(e) => setRoomsCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-1 py-1.5 text-xs font-semibold text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Adults:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-1 py-1.5 text-xs font-semibold text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Children:</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-1 py-1.5 text-xs font-semibold text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>

          {/* Rate Calculation Summary Bar & Add Button */}
          {stayCalc && (
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {(user?.role === 'ADMIN' || user?.role === 'DMC_STAFF') && (
                  <>
                    <div>
                      <span className="text-slate-500">Nightly Net:</span>{' '}
                      <strong className="text-slate-900">{formatCurrency(stayCalc.nightlyBaseNetRate, currency)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Net Cost:</span>{' '}
                      <strong className="text-slate-900">{formatCurrency(stayCalc.roomsTotalNetCost, currency)}</strong>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-slate-500">Stay Duration:</span>{' '}
                  <strong className="text-slate-900">{nights} {nights === 1 ? 'Night' : 'Nights'} • {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Meal Plan:</span>{' '}
                  <span className="font-semibold text-slate-800">{activeRate.mealPlanName || activeRate.mealPlan}</span>
                </div>
                <div>
                  <span className="text-slate-500">Final Selling Price:</span>{' '}
                  <strong className="text-emerald-600 font-black text-sm">{formatCurrency(stayCalc.finalTotalSellingPrice, currency)}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddStay}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shrink-0 cursor-pointer ${
                  addedLocal || isJustAdded
                    ? 'bg-emerald-500 text-white'
                    : 'bg-[#00C6A6] hover:bg-[#00b296] text-white shadow-xs hover:shadow-md'
                }`}
              >
                {addedLocal || isJustAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Itinerary!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Configure & Add to Quote</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
