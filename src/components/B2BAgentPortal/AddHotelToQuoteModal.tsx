import React, { useState, useMemo } from 'react';
import { 
  X, 
  Building2, 
  Calendar, 
  Users, 
  Bed, 
  Coffee, 
  Check, 
  Plus, 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  AlertCircle, 
  MapPin, 
  Star,
  Info,
  Clock,
  ChevronRight,
  FileText
} from 'lucide-react';
import { Hotel, HotelRoomType, HotelRate, MealPlanCode, CurrencyCode, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { calculateHotelStayPrice, getMealPlanLabel, hotelToProduct } from '../../utils/hotelHelpers';
import { formatCurrency, convertCurrency } from '../../services/pricingEngine';

interface AddHotelToQuoteModalProps {
  hotel: Hotel | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (hotel: Hotel, details: any) => void;
  existingItemId?: string;
  initialCheckInDate?: string;
  initialNights?: number;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialRoomsCount?: number;
  initialRoomId?: string;
  initialRateId?: string;
  initialSpecialRequests?: string;
  initialBedPreference?: 'KING' | 'TWIN' | 'NO_PREF';
}

export const AddHotelToQuoteModal: React.FC<AddHotelToQuoteModalProps> = ({
  hotel,
  isOpen,
  onClose,
  onSuccess,
  existingItemId,
  initialCheckInDate,
  initialNights = 3,
  initialAdults = 2,
  initialChildren = 0,
  initialInfants = 0,
  initialRoomsCount = 1,
  initialRoomId,
  initialRateId,
  initialSpecialRequests = '',
  initialBedPreference = 'NO_PREF'
}) => {
  const { user } = useAuth();
  const { currency, addProductToQuote, updateQuoteItem } = useQuotation();

  const roomTypes = hotel?.roomTypes || [];

  // Stay parameters state
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    if (initialCheckInDate) return initialCheckInDate;
    const d = new Date(Date.now() + 86400000 * 14);
    return d.toISOString().split('T')[0];
  });
  const [nights, setNights] = useState<number>(initialNights);
  const [roomsCount, setRoomsCount] = useState<number>(initialRoomsCount);
  const [adults, setAdults] = useState<number>(initialAdults);
  const [children, setChildren] = useState<number>(initialChildren);
  const [infants, setInfants] = useState<number>(initialInfants);
  const [extraBeds, setExtraBeds] = useState<number>(0);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => initialRoomId || roomTypes[0]?.id || '');
  const [selectedRateId, setSelectedRateId] = useState<string>(initialRateId || '');
  const [specialRequests, setSpecialRequests] = useState<string>(initialSpecialRequests);
  const [bedPreference, setBedPreference] = useState<'KING' | 'TWIN' | 'NO_PREF'>(initialBedPreference);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when props change
  React.useEffect(() => {
    if (isOpen && hotel) {
      if (initialCheckInDate) setCheckInDate(initialCheckInDate);
      setNights(initialNights);
      setRoomsCount(initialRoomsCount);
      setAdults(initialAdults);
      setChildren(initialChildren);
      setInfants(initialInfants);
      setSpecialRequests(initialSpecialRequests || '');
      setBedPreference(initialBedPreference || 'NO_PREF');
      if (initialRoomId) {
        setSelectedRoomId(initialRoomId);
      } else if (hotel.roomTypes && hotel.roomTypes.length > 0) {
        setSelectedRoomId(hotel.roomTypes[0].id);
      }
      if (initialRateId) {
        setSelectedRateId(initialRateId);
      } else if (hotel.roomTypes && hotel.roomTypes[0]?.rates && hotel.roomTypes[0].rates.length > 0) {
        setSelectedRateId(hotel.roomTypes[0].rates[0].id);
      }
      setErrorMsg(null);
    }
  }, [isOpen, hotel?.id, initialCheckInDate, initialNights, initialAdults, initialChildren, initialInfants, initialRoomsCount, initialRoomId, initialRateId, initialSpecialRequests, initialBedPreference, existingItemId]);

  const selectedRoom = roomTypes.find(r => r.id === selectedRoomId) || roomTypes[0];
  const roomRates = selectedRoom?.rates || [];

  // Active rate
  const activeRate: HotelRate = roomRates.find(r => r.id === selectedRateId) || roomRates[0] || {
    id: 'std-rate',
    mealPlan: 'BB' as MealPlanCode,
    mealPlanName: 'Bed & Breakfast Included',
    singleNetRate: hotel?.startingNetPrice || 400,
    doubleNetRate: hotel?.startingNetPrice || 480,
    tripleNetRate: (hotel?.startingNetPrice || 480) * 1.35,
    extraBedRate: 90,
    childRate: 45,
    markupPercent: 15,
    taxPercent: 10,
    feePercent: 2.5,
    currency: hotel?.currency || 'USD',
    validityFrom: '2026-01-01',
    validityTo: '2026-12-31'
  };

  // Compute check out date
  const checkOutDate = useMemo(() => {
    if (!checkInDate) return '';
    const d = new Date(checkInDate);
    d.setDate(d.getDate() + Math.max(1, nights));
    return d.toISOString().split('T')[0];
  }, [checkInDate, nights]);

  // Live Stay Price Calculation
  const stayCalculation = useMemo(() => {
    if (!hotel || !selectedRoom) return null;
    return calculateHotelStayPrice({
      hotel,
      roomType: selectedRoom,
      rate: activeRate,
      checkInDate,
      checkOutDate,
      nights,
      roomsCount,
      adults: Math.max(1, adults),
      children,
      extraBeds,
      targetCurrency: currency,
      agentClientMarkupPercent: 12
    });
  }, [hotel, selectedRoom, activeRate, checkInDate, checkOutDate, nights, roomsCount, adults, children, extraBeds, currency]);

  if (!isOpen || !hotel) return null;

  const totalGuests = adults + children + infants;

  const handleConfirmAddHotel = () => {
    if (!checkInDate) {
      setErrorMsg('Please select a valid check-in date.');
      return;
    }
    if (nights < 1) {
      setErrorMsg('Stay duration must be at least 1 night.');
      return;
    }
    if (adults < 1) {
      setErrorMsg('At least 1 adult guest is required.');
      return;
    }
    if (!selectedRoom) {
      setErrorMsg('Please select a room category.');
      return;
    }

    // Convert to standard Product representation
    const hotelProduct = hotelToProduct(
      hotel,
      selectedRoom,
      activeRate,
      nights,
      roomsCount
    );

    const hotelConfigPayload = {
      configurationType: 'HOTEL' as const,
      configurator: 'HOTEL_CONFIGURATOR' as const,
      hotelId: hotel.id,
      hotelName: hotel.name,
      starRating: hotel.starRating,
      city: hotel.cityName || hotel.city,
      country: hotel.country || 'Japan',
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      rateId: activeRate?.id,
      rateName: (activeRate as any)?.name || (activeRate as any)?.rateName || (activeRate as any)?.seasonName || 'Standard Rate',
      mealPlan: activeRate?.mealPlan || 'BB',
      mealPlanLabel: getMealPlanLabel(activeRate?.mealPlan || 'BB'),
      checkInDate,
      checkOutDate,
      nights,
      roomsCount,
      occupancy: `${adults} Adults${children ? `, ${children} Children` : ''}${infants ? `, ${infants} Infants` : ''}`,
      adults,
      children,
      infants,
      bedPreference,
      specialRequests: specialRequests.trim(),
      pricing: stayCalculation,
      version: 1,
      configuredAt: new Date().toISOString()
    };

    const fullNotes = [
      bedPreference !== 'NO_PREF' ? `Bed Preference: ${bedPreference === 'KING' ? '1 King Bed' : 'Twin Beds'}` : '',
      specialRequests.trim()
    ].filter(Boolean).join(' | ');

    if (existingItemId) {
      updateQuoteItem(existingItemId, {
        ...hotelProduct,
        metadata: {
          ...(hotelProduct as any).metadata,
          hotelConfigurationPayload: hotelConfigPayload
        }
      }, {
        adults,
        children,
        infants,
        travelDate: checkInDate,
        notes: fullNotes || undefined
      });
    } else {
      addProductToQuote({
        ...hotelProduct,
        metadata: {
          ...(hotelProduct as any).metadata,
          hotelConfigurationPayload: hotelConfigPayload
        }
      }, {
        adults,
        children,
        infants,
        travelDate: checkInDate,
        notes: fullNotes || undefined,
        openDrawer: false
      });
    }

    if (onSuccess) {
      onSuccess(hotel, {
        checkInDate,
        checkOutDate,
        nights,
        roomsCount,
        adults,
        children,
        infants,
        roomName: selectedRoom.roomName,
        mealPlan: activeRate.mealPlan
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div 
        id="add-hotel-to-quote-modal"
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92dvh] animate-scaleUp"
      >
        {/* Fixed Top Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-5 flex items-start justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-start space-x-2.5 sm:space-x-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                  Hotel Configurator
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                  {hotel.starRating || 5}★ Luxury
                </span>
                <span className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center space-x-1">
                  <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00E5C0]" />
                  <span>{hotel.cityName || hotel.city}, {hotel.country || 'Japan'}</span>
                </span>
              </div>
              <h2 className="text-sm sm:text-xl font-bold text-white mt-1 leading-snug font-sans flex items-center gap-1.5 truncate">
                <span className="truncate">{hotel.name}</span>
                <span className="text-xs font-semibold text-slate-400 shrink-0">({nights} {nights === 1 ? 'Night' : 'Nights'})</span>
              </h2>
            </div>
          </div>

          <button
            id="close-add-hotel-modal-btn"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 bg-slate-50/50 modal-body-scroll">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl flex items-center space-x-2 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Stay Dates & Duration Grid */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Stay Schedule & Duration</span>
              </div>
              <span className="text-xs font-extrabold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-mono">
                {nights} {nights === 1 ? 'Night' : 'Nights'} Stay
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Check-In Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Check-In Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => {
                    setCheckInDate(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6]"
                />
              </div>

              {/* Nights Counter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nights Duration
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={nights <= 1}
                    onClick={() => setNights(Math.max(1, nights - 1))}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-sm disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-mono font-black text-sm text-slate-900 bg-slate-50 py-1.5 rounded-xl border border-slate-200">
                    {nights}N
                  </span>
                  <button
                    type="button"
                    onClick={() => setNights(nights + 1)}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-sm cursor-pointer flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Check-Out Date (Computed) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Check-Out Date
                </label>
                <div className="w-full px-3 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono flex items-center justify-between">
                  <span>{checkOutDate || 'Auto-calculated'}</span>
                  <span className="text-[10px] text-slate-500 font-sans">11:00 AM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rooms & Occupancy Configuration */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <Users className="w-4 h-4 text-amber-600" />
                <span>Rooms & Guest Manifest</span>
              </div>
              <span className="text-xs font-extrabold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 font-mono">
                {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'} • {totalGuests} {totalGuests === 1 ? 'Guest' : 'Guests'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Rooms Count */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-800">Rooms</span>
                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={roomsCount <= 1}
                    onClick={() => setRoomsCount(Math.max(1, roomsCount - 1))}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs disabled:opacity-30 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{roomsCount}</span>
                  <button
                    type="button"
                    onClick={() => setRoomsCount(roomsCount + 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Adults */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-800">Adults (12+)</span>
                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={adults <= 1}
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs disabled:opacity-30 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-800">Children (2-11)</span>
                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={children <= 0}
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs disabled:opacity-30 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(children + 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Extra Beds */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-800">Extra Beds</span>
                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={extraBeds <= 0}
                    onClick={() => setExtraBeds(Math.max(0, extraBeds - 1))}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs disabled:opacity-30 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{extraBeds}</span>
                  <button
                    type="button"
                    onClick={() => setExtraBeds(extraBeds + 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Room Category Selection */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <Bed className="w-4 h-4 text-amber-600" />
                <span>Contracted Room Category & Tariff Tier</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {roomTypes.length} Available Room Classes
              </span>
            </div>

            <div className="space-y-2">
              {roomTypes.map((room) => {
                const isSelected = room.id === selectedRoomId;
                const sellingRateUSD = (room as any).startingSellingRateUSD || (room.rates?.[0] as any)?.sellingRateUSD || Math.round(((room.rates?.[0]?.adultNettCost || room.rates?.[0]?.doubleNetRate || 380) * 1.3));
                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      if (room.rates && room.rates.length > 0) {
                        setSelectedRateId(room.rates[0].id);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-500 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="font-bold text-xs text-slate-900">{room.roomName || room.name}</span>
                        {room.maxOccupancy && (
                          <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Max {room.maxOccupancy} Guests
                          </span>
                        )}
                      </div>
                      {room.description && (
                        <p className="text-[11px] text-slate-500 pl-6 leading-tight">
                          {room.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right pl-6 sm:pl-0 shrink-0">
                      <div className="text-xs font-black font-mono text-slate-900">
                        {formatCurrency(convertCurrency(sellingRateUSD, 'USD', currency), currency)} <span className="text-[10px] font-normal text-slate-500">/ night</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        Guaranteed Tariff
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Meal Plan & Board Basis */}
          {roomRates.length > 0 && (
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                <Coffee className="w-4 h-4 text-amber-600" />
                <span>Meal Plan & Board Basis</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roomRates.map((rate) => {
                  const isRateActive = rate.id === activeRate.id;
                  return (
                    <div
                      key={rate.id}
                      onClick={() => setSelectedRateId(rate.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isRateActive
                          ? 'bg-teal-50 border-[#00C6A6] text-teal-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          isRateActive ? 'border-[#00C6A6] bg-[#00C6A6] text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isRateActive && <div className="w-1 h-1 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs">{rate.mealPlanName || getMealPlanLabel(rate.mealPlan)}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                        {rate.mealPlan}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bed Preference & Special Requests */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Bedding Preference & Special Hotel Instructions</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBedPreference('KING')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  bedPreference === 'KING'
                    ? 'bg-amber-50 border-amber-500 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                1 King Bed
              </button>
              <button
                type="button"
                onClick={() => setBedPreference('TWIN')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  bedPreference === 'TWIN'
                    ? 'bg-amber-50 border-amber-500 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Twin Beds (2 Beds)
              </button>
              <button
                type="button"
                onClick={() => setBedPreference('NO_PREF')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  bedPreference === 'NO_PREF'
                    ? 'bg-amber-50 border-amber-500 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                No Preference
              </button>
            </div>

            <textarea
              rows={2}
              placeholder="e.g. Non-smoking room, high floor requested, honeymoon setup with VIP fruit platter..."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] placeholder:text-slate-400"
            />
          </div>

          {/* Live Stay Calculation Banner */}
          {stayCalculation && (
            <div className="bg-slate-900 text-white p-4.5 rounded-2xl shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00E5C0]" />
                  <span>Hotel Stay Pricing Summary</span>
                </span>
                <span className="text-[11px] text-[#00E5C0] font-mono font-bold">
                  {nights} Nights • {roomsCount} {roomsCount === 1 ? 'Room' : 'Rooms'} • {totalGuests} Guests
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Per Night Selling Rate</span>
                  <span className="text-sm font-bold text-slate-200 font-mono">
                    {formatCurrency(stayCalculation.pricePerNightSelling, currency)}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    {selectedRoom?.name || 'Standard Room'} • {activeRate.mealPlanName || 'Breakfast Included'}
                  </span>
                </div>

                <div className="bg-amber-950/60 p-2.5 rounded-xl border border-amber-600/40">
                  <span className="text-[10px] text-amber-300 font-bold block">Final Selling Price</span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    {formatCurrency(stayCalculation.finalTotalSellingPrice, currency)}
                  </span>
                  <span className="text-[9px] text-amber-300/80 block">
                    ✓ Total Stay • All Taxes & Surcharges Included
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="p-3.5 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-add-hotel-to-quote-btn"
            onClick={handleConfirmAddHotel}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all flex items-center space-x-1.5 sm:space-x-2 cursor-pointer shadow-md hover:shadow-lg whitespace-nowrap min-w-0"
          >
            {existingItemId ? <Check className="w-4 h-4 shrink-0" /> : <Plus className="w-4 h-4 shrink-0" />}
            <span className="truncate">
              <span className="hidden sm:inline">{existingItemId ? 'Update Hotel Stay' : 'Add Hotel Stay to Cart'}</span>
              <span className="sm:hidden">{existingItemId ? 'Update Stay' : 'Add Stay'}</span> ({formatCurrency(stayCalculation?.finalTotalSellingPrice || 0, currency)})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const HotelConfigurator = AddHotelToQuoteModal;
export default AddHotelToQuoteModal;
