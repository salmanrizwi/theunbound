import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  X, 
  Sparkles, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Info, 
  ShieldCheck, 
  BedDouble, 
  Check, 
  Calculator,
  Lock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { CurrencyCode, ManualHotelDetails, MealPlanCode, SUPPORTED_CURRENCIES, TripRouteHub } from '../../types';
import { convertCurrency, formatCurrency } from '../../services/pricingEngine';
import { getMealPlanLabel } from '../../utils/hotelHelpers';

interface ManualHotelFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (manualData: ManualHotelDetails) => void;
  initialData?: Partial<ManualHotelDetails> | null;
  routeHubs: TripRouteHub[];
  defaultHubId?: string;
  getHubDates: (order: number, nights: number) => { checkInIso: string; checkOutIso: string };
  quoteCurrency: CurrencyCode;
  agentMarkupPercent?: number;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
}

const STAR_CATEGORIES = [
  '5-Star Luxury Hotel',
  '5-Star Luxury Resort',
  '4-Star Superior Hotel',
  '3-Star Standard Hotel',
  'Traditional Ryokan & Onsen',
  'Boutique Luxury Property',
  'Executive Serviced Suite',
  'Private Luxury Villa'
];

const MEAL_PLANS: { code: MealPlanCode; label: string; description: string }[] = [
  { code: 'BB', label: 'Bed & Breakfast', description: 'Daily gourmet breakfast included for all guests' },
  { code: 'RO', label: 'Room Only (No Meals)', description: 'Accommodation without meal inclusions' },
  { code: 'HB', label: 'Half Board', description: 'Daily breakfast and 3-course dinner included' },
  { code: 'FB', label: 'Full Board', description: 'All meals (breakfast, lunch, dinner) included' },
  { code: 'AI', label: 'All Inclusive Luxury', description: 'All dining, beverages, and select amenities included' }
];

export const ManualHotelFormModal: React.FC<ManualHotelFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  routeHubs,
  defaultHubId,
  getHubDates,
  quoteCurrency,
  agentMarkupPercent = 12,
  adultsCount = 2,
  childrenCount = 0,
  infantsCount = 0
}) => {
  // Target Hub state
  const selectedHub = useMemo(() => {
    if (initialData?.hubId) {
      return routeHubs.find(h => h.id === initialData.hubId || h.hubName.toLowerCase() === initialData.city?.toLowerCase());
    }
    if (defaultHubId) {
      return routeHubs.find(h => h.id === defaultHubId);
    }
    return routeHubs[0];
  }, [routeHubs, defaultHubId, initialData?.hubId, initialData?.city]);

  const [hubId, setHubId] = useState<string>(selectedHub?.id || routeHubs[0]?.id || '');
  const currentHub = useMemo(() => routeHubs.find(h => h.id === hubId) || routeHubs[0], [routeHubs, hubId]);

  // Form Fields
  const [hotelName, setHotelName] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [starRating, setStarRating] = useState<string>('5-Star Luxury Hotel');
  const [address, setAddress] = useState<string>('');
  const [roomType, setRoomType] = useState<string>('Deluxe Room');
  const [numberOfRooms, setNumberOfRooms] = useState<number>(1);
  const [numberOfNights, setNumberOfNights] = useState<number>(currentHub?.nights || 3);
  const [checkInDate, setCheckInDate] = useState<string>('');
  const [checkOutDate, setCheckOutDate] = useState<string>('');
  const [mealPlan, setMealPlan] = useState<MealPlanCode>('BB');
  const [mealPlanName, setMealPlanName] = useState<string>('');

  // Rate & Commercials
  const [ratePerNight, setRatePerNight] = useState<number | ''>(45000);
  const [rateCurrency, setRateCurrency] = useState<CurrencyCode>('JPY');
  const [rateType, setRateType] = useState<'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT' | 'TOTAL_STAY'>('PER_ROOM_PER_NIGHT');
  
  // Supplements & Internal
  const [childRate, setChildRate] = useState<number | ''>('');
  const [extraBedRate, setExtraBedRate] = useState<number | ''>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [supplierContact, setSupplierContact] = useState<string>('');

  // Error validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Initialize or reset form when modal opens or initialData changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setHotelName(initialData.hotelName || '');
      setCity(initialData.city || currentHub?.hubName || 'Tokyo');
      if (initialData.hubId) setHubId(initialData.hubId);
      setStarRating(initialData.starRating || '5-Star Luxury Hotel');
      setAddress(initialData.address || '');
      setRoomType(initialData.roomType || 'Deluxe Room');
      setNumberOfRooms(initialData.numberOfRooms || 1);
      setNumberOfNights(initialData.numberOfNights || currentHub?.nights || 2);
      setCheckInDate(initialData.checkInDate || '');
      setCheckOutDate(initialData.checkOutDate || '');
      setMealPlan((initialData.mealPlan as MealPlanCode) || 'BB');
      setMealPlanName(initialData.mealPlanName || '');
      setRatePerNight(initialData.ratePerNight !== undefined ? initialData.ratePerNight : 45000);
      setRateCurrency(initialData.rateCurrency || quoteCurrency || 'JPY');
      setRateType(initialData.rateType || 'PER_ROOM_PER_NIGHT');
      setChildRate(initialData.childRate || '');
      setExtraBedRate(initialData.extraBedRate || '');
      setInternalNotes(initialData.internalNotes || '');
      setSupplierContact(initialData.supplierContact || '');
    } else {
      // Default clean initialization
      const targetHub = currentHub || routeHubs[0];
      const targetHubOrder = targetHub?.order || 1;
      const targetHubNights = targetHub?.nights || 3;
      const { checkInIso, checkOutIso } = getHubDates(targetHubOrder, targetHubNights);

      setHotelName('');
      setCity(targetHub?.hubName || 'Tokyo');
      setHubId(targetHub?.id || '');
      setStarRating('5-Star Luxury Hotel');
      setAddress('');
      setRoomType('Deluxe Room');
      setNumberOfRooms(targetHub?.roomsCount || 1);
      setNumberOfNights(targetHubNights);
      setCheckInDate(checkInIso);
      setCheckOutDate(checkOutIso);
      setMealPlan('BB');
      setMealPlanName('');
      setRateCurrency(quoteCurrency || 'JPY');
      setRatePerNight(quoteCurrency === 'JPY' ? 45000 : 350);
      setRateType('PER_ROOM_PER_NIGHT');
      setChildRate('');
      setExtraBedRate('');
      setInternalNotes('');
      setSupplierContact('');
    }
    setErrors({});
  }, [isOpen, initialData, currentHub, defaultHubId, quoteCurrency]);

  // When Hub changes, auto-sync city and default dates if not customized
  const handleHubChange = (newHubId: string) => {
    setHubId(newHubId);
    const foundHub = routeHubs.find(h => h.id === newHubId);
    if (foundHub) {
      setCity(foundHub.hubName);
      setNumberOfNights(foundHub.nights || 2);
      const { checkInIso, checkOutIso } = getHubDates(foundHub.order, foundHub.nights || 2);
      setCheckInDate(checkInIso);
      setCheckOutDate(checkOutIso);
    }
  };

  // Sync Check-out date automatically when checkInDate or numberOfNights changes
  const handleNightsChange = (nights: number) => {
    const safeNights = Math.max(1, nights);
    setNumberOfNights(safeNights);
    if (checkInDate) {
      const d = new Date(checkInDate);
      d.setDate(d.getDate() + safeNights);
      setCheckOutDate(d.toISOString().split('T')[0]);
    }
  };

  const handleCheckInChange = (dateStr: string) => {
    setCheckInDate(dateStr);
    if (dateStr) {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + Math.max(1, numberOfNights));
      setCheckOutDate(d.toISOString().split('T')[0]);
    }
  };

  // Dynamic Live Cost Calculations
  const calculations = useMemo(() => {
    const rawRate = typeof ratePerNight === 'number' ? ratePerNight : 0;
    const safeRooms = Math.max(1, numberOfRooms || 1);
    const safeNights = Math.max(1, numberOfNights || 1);

    let baseNetTotalInRateCurrency = 0;
    if (rateType === 'TOTAL_STAY') {
      baseNetTotalInRateCurrency = rawRate;
    } else if (rateType === 'PER_PERSON_PER_NIGHT') {
      const perPax = rawRate;
      const extraChild = typeof childRate === 'number' ? childRate : 0;
      baseNetTotalInRateCurrency = (perPax * adultsCount + extraChild * childrenCount) * safeNights;
    } else {
      // Standard PER_ROOM_PER_NIGHT
      baseNetTotalInRateCurrency = rawRate * safeRooms * safeNights;
    }

    // Add extra bed if specified
    if (typeof extraBedRate === 'number' && extraBedRate > 0) {
      baseNetTotalInRateCurrency += extraBedRate * safeNights;
    }

    // Currency Conversion to Quotation Display Currency
    const netTotalInQuoteCurrency = convertCurrency(baseNetTotalInRateCurrency, rateCurrency, quoteCurrency);
    
    // Selling Price calculation with existing agent markup logic
    const markupRate = (agentMarkupPercent || 0) / 100;
    const finalSellingPrice = netTotalInQuoteCurrency * (1 + markupRate);
    const sellingPricePerNight = safeNights > 0 ? finalSellingPrice / safeNights : finalSellingPrice;

    return {
      baseNetTotalInRateCurrency,
      netTotalInQuoteCurrency,
      finalSellingPrice,
      sellingPricePerNight,
      safeRooms,
      safeNights
    };
  }, [
    ratePerNight, 
    numberOfRooms, 
    numberOfNights, 
    rateType, 
    childRate, 
    extraBedRate, 
    adultsCount, 
    childrenCount, 
    rateCurrency, 
    quoteCurrency, 
    agentMarkupPercent
  ]);

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!hotelName.trim()) {
      newErrors.hotelName = 'Hotel name is required';
    }
    if (!city.trim()) {
      newErrors.city = 'City or Hub location is required';
    }
    if (!roomType.trim()) {
      newErrors.roomType = 'Room type is required';
    }
    if (typeof ratePerNight !== 'number' || ratePerNight <= 0) {
      newErrors.ratePerNight = 'Please enter a valid rate greater than 0';
    }
    if (!checkInDate) {
      newErrors.checkInDate = 'Check-in date is required';
    }
    if (!checkOutDate) {
      newErrors.checkOutDate = 'Check-out date is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: ManualHotelDetails = {
      id: initialData?.id || `manual-hotel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      hotelName: hotelName.trim(),
      city: city.trim(),
      hubId: currentHub?.id || hubId,
      hubName: currentHub?.hubName || city.trim(),
      starRating,
      address: address.trim() || undefined,
      roomType: roomType.trim(),
      numberOfRooms: Math.max(1, numberOfRooms || 1),
      numberOfNights: Math.max(1, numberOfNights || 1),
      checkInDate,
      checkOutDate,
      mealPlan,
      mealPlanName: mealPlanName.trim() || getMealPlanLabel(mealPlan),
      ratePerNight: typeof ratePerNight === 'number' ? ratePerNight : 0,
      rateCurrency,
      rateType,
      childRate: typeof childRate === 'number' ? childRate : undefined,
      extraBedRate: typeof extraBedRate === 'number' ? extraBedRate : undefined,
      internalNotes: internalNotes.trim() || undefined,
      supplierContact: supplierContact.trim() || undefined,
      calculatedPrice: calculations.finalSellingPrice
    };

    onSave(payload);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 relative flex items-start justify-between">
          <div className="flex items-start space-x-3.5 pr-8">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {initialData?.hotelName ? 'Edit Manual Hotel & Rate' : 'Add Manual Hotel & Rate'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold uppercase tracking-wider">
                  Quotation-Only
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00E5C0]" />
                <span>Temporary quote accommodation • Does NOT modify the Hotel Master database</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-900 flex-1">
          
          {/* DATABASE ISOLATION NOTICE */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 flex items-start space-x-3 text-xs text-amber-900 shadow-2xs">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-amber-900">Quotation-Level Accommodation Record</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This property and custom rate exist strictly within this itinerary proposal. It will participate in full pricing, commercial markups, proposals, and PDF exports without creating a permanent Hotel Master record.
              </p>
            </div>
          </div>

          {/* SECTION 1: HOTEL & LOCATION */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-600" />
              <span>1. Property & Destination Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Hotel Name */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Hotel Property Name <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-slate-400">e.g. ABC Hotel Tokyo, Conrad Tokyo</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABC Hotel Tokyo"
                  value={hotelName}
                  onChange={(e) => {
                    setHotelName(e.target.value);
                    if (errors.hotelName) setErrors(prev => ({ ...prev, hotelName: '' }));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                    errors.hotelName 
                      ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-500/20' 
                      : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20'
                  }`}
                />
                {errors.hotelName && <p className="text-[11px] text-rose-600">{errors.hotelName}</p>}
              </div>

              {/* Destination Hub Assignment */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Assign to Route Hub
                </label>
                <select
                  value={hubId}
                  onChange={(e) => handleHubChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#00C6A6]"
                >
                  {routeHubs.map((hub, idx) => (
                    <option key={hub.id} value={hub.id}>
                      Hub #{idx + 1}: {hub.hubName} ({hub.nights} Nights)
                    </option>
                  ))}
                </select>
              </div>

              {/* Hotel Star Rating / Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Property Category / Star Rating
                </label>
                <select
                  value={starRating}
                  onChange={(e) => setStarRating(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#00C6A6]"
                >
                  {STAR_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* City / Area */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>City / Area <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tokyo, Ginza / Shinjuku"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              {/* Address / Location */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Address / Specific Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1-1-1 Otemachi, Chiyoda-ku"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: ROOM CONFIGURATION & DATES */}
          <div className="space-y-3.5 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <BedDouble className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. Room Type & Stay Configuration</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Room Type */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Room Type / Category <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deluxe King Room, Superior Twin"
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              {/* Number of Rooms */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Number of Rooms
                </label>
                <select
                  value={numberOfRooms}
                  onChange={(e) => setNumberOfRooms(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#00C6A6]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(r => (
                    <option key={r} value={r}>{r} {r === 1 ? 'Room' : 'Rooms'}</option>
                  ))}
                </select>
              </div>

              {/* Number of Nights */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Number of Nights
                </label>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    disabled={numberOfNights <= 1}
                    onClick={() => handleNightsChange(numberOfNights - 1)}
                    className="w-8 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs disabled:opacity-30 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={numberOfNights}
                    onChange={(e) => handleNightsChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-center px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleNightsChange(numberOfNights + 1)}
                    className="w-8 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Check-In Date */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Check-In Date <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="date"
                  required
                  value={checkInDate}
                  onChange={(e) => handleCheckInChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              {/* Check-Out Date */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Check-Out Date <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="date"
                  required
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              {/* Meal Plan */}
              <div className="sm:col-span-4 space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Meal Plan Included
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {MEAL_PLANS.map(mp => (
                    <button
                      key={mp.code}
                      type="button"
                      onClick={() => setMealPlan(mp.code)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        mealPlan === mp.code
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{mp.code}</span>
                        {mealPlan === mp.code && <Check className="w-3 h-3 text-indigo-600" />}
                      </div>
                      <span className="text-[10px] font-medium mt-1 leading-tight text-slate-600">{mp.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: MANUAL HOTEL RATE & COMMERCIALS */}
          <div className="space-y-3.5 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. Manual Hotel Rate & Pricing Engine</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Rate Currency */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Rate Currency
                </label>
                <select
                  value={rateCurrency}
                  onChange={(e) => setRateCurrency(e.target.value as CurrencyCode)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#00C6A6]"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name} ({c.symbol})</option>
                  ))}
                </select>
              </div>

              {/* Rate Type */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">
                  Pricing Rate Structure
                </label>
                <select
                  value={rateType}
                  onChange={(e) => setRateType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none cursor-pointer focus:bg-white focus:border-[#00C6A6]"
                >
                  <option value="PER_ROOM_PER_NIGHT">Per Room Per Night</option>
                  <option value="PER_PERSON_PER_NIGHT">Per Person Per Night</option>
                  <option value="TOTAL_STAY">Fixed Total Stay Cost</option>
                </select>
              </div>

              {/* Manual Rate Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>
                    Manual Rate ({rateCurrency}) <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Net Supplier Rate</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="e.g. 45000"
                    value={ratePerNight}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                      setRatePerNight(val);
                      if (errors.ratePerNight) setErrors(prev => ({ ...prev, ratePerNight: '' }));
                    }}
                    className={`w-full pl-3.5 pr-12 py-2.5 rounded-xl border text-sm font-bold font-mono outline-none transition-all ${
                      errors.ratePerNight 
                        ? 'border-rose-300 bg-rose-50 text-rose-900' 
                        : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    {rateCurrency}
                  </span>
                </div>
                {errors.ratePerNight && <p className="text-[11px] text-rose-600">{errors.ratePerNight}</p>}
              </div>
            </div>

            {/* LIVE PRICE CALCULATION SUMMARY CARD */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700/60 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-[#00E5C0]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Commercial Price Engine
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-mono text-[#00E5C0]">
                  Markup: +{agentMarkupPercent}%
                </span>
              </div>

              {/* Math breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-0.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Entered Net Cost</span>
                  <p className="font-mono font-bold text-sm text-slate-100">
                    {formatCurrency(calculations.baseNetTotalInRateCurrency, rateCurrency)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {rateType === 'TOTAL_STAY' 
                      ? 'Fixed Stay Cost' 
                      : `${formatCurrency(typeof ratePerNight === 'number' ? ratePerNight : 0, rateCurrency)} × ${calculations.safeRooms}R × ${calculations.safeNights}N`}
                  </p>
                </div>

                <div className="space-y-0.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Quotation Currency Net</span>
                  <p className="font-mono font-bold text-sm text-slate-100">
                    {formatCurrency(calculations.netTotalInQuoteCurrency, quoteCurrency)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Converted to Quote ({quoteCurrency})
                  </p>
                </div>

                <div className="space-y-0.5 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-300 uppercase font-bold">Final Selling Price</span>
                  <p className="font-mono font-extrabold text-base text-[#00E5C0]">
                    {formatCurrency(calculations.finalSellingPrice, quoteCurrency)}
                  </p>
                  <p className="text-[10px] text-emerald-300 font-medium">
                    {formatCurrency(calculations.sellingPricePerNight, quoteCurrency)} / night
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: INTERNAL NOTES & SUPPLIER CONTACT (HIDDEN FROM PROPOSAL) */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>4. Confidential Internal Notes (Private)</span>
              </h4>
              <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                <Lock className="w-2.5 h-2.5" />
                <span>Never exposed on client proposal / PDF</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Supplier / Reservation Contact
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sales Manager: Kenji Tanaka (kenji@hotel.com)"
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Internal Reservation Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Complimentary late checkout requested, high floor requested"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>
            </div>
          </div>

        </form>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auto-calculated into quote totals instantly</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#00A88F] hover:from-emerald-500 hover:to-[#00BFA0] text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{initialData?.hotelName ? 'Update Manual Hotel' : 'Save Manual Hotel'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
