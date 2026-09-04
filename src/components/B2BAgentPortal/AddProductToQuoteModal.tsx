import React, { useState, useMemo } from 'react';
import { 
  X, 
  Users, 
  Calendar, 
  Clock, 
  Check, 
  Plus, 
  FileText, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  AlertCircle, 
  MapPin, 
  Compass, 
  DollarSign, 
  Lock,
  Car,
  Utensils,
  Anchor,
  Globe2,
  Train,
  Luggage,
  Languages
} from 'lucide-react';
import { Product, CurrencyCode } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { calculateProductPrice, formatCurrency, convertCurrency } from '../../services/pricingEngine';

interface AddProductToQuoteModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (product: Product, details: { travelDate: string; serviceTime?: string; adults: number; children: number; infants: number }) => void;
  existingItemId?: string;
  initialTravelDate?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialInfants?: number;
  initialServiceTime?: string;
  initialNotes?: string;
  initialSelectedAddonIds?: string[];
}

export const AddProductToQuoteModal: React.FC<AddProductToQuoteModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
  existingItemId,
  initialTravelDate,
  initialAdults = 2,
  initialChildren = 0,
  initialInfants = 0,
  initialServiceTime = '09:30 AM',
  initialNotes = '',
  initialSelectedAddonIds = []
}) => {
  const { user } = useAuth();
  const { currency, addProductToQuote, updateQuoteItem } = useQuotation();

  const [adults, setAdults] = useState<number>(initialAdults);
  const [children, setChildren] = useState<number>(initialChildren);
  const [infants, setInfants] = useState<number>(initialInfants);
  const [travelDate, setTravelDate] = useState<string>(() => {
    if (initialTravelDate) return initialTravelDate;
    const d = new Date(Date.now() + 86400000 * 14);
    return d.toISOString().split('T')[0];
  });
  const [serviceTime, setServiceTime] = useState<string>(initialServiceTime);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(initialSelectedAddonIds);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Category specific inputs
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [dropoffLocation, setDropoffLocation] = useState<string>('');
  const [flightNumber, setFlightNumber] = useState<string>('');
  const [luggageCount, setLuggageCount] = useState<number>(2);
  const [guideLanguage, setGuideLanguage] = useState<string>('English');
  const [dietaryRequirements, setDietaryRequirements] = useState<string>('');
  const [railClass, setRailClass] = useState<string>('Ordinary Class');

  // Sync state when initial props change or modal opens
  React.useEffect(() => {
    if (isOpen && product) {
      if (initialTravelDate) setTravelDate(initialTravelDate);
      setAdults(initialAdults);
      setChildren(initialChildren);
      setInfants(initialInfants);
      setServiceTime(initialServiceTime);
      setNotes(initialNotes || '');
      setSelectedAddonIds(initialSelectedAddonIds || []);
      setErrorMsg(null);
    }
  }, [isOpen, product?.id, initialTravelDate, initialAdults, initialChildren, initialInfants, initialServiceTime, initialNotes, existingItemId]);

  const pricingTier = user && user.role !== 'PUBLIC' ? 'B2B' : 'B2C';

  const isTransfer = useMemo(() => {
    if (!product) return false;
    const cat = (product.category || '').toLowerCase();
    const sub = (product.subcategory || '').toLowerCase();
    const pType = (product.productType || '').toLowerCase();
    const name = (product.name || '').toLowerCase();
    return cat.includes('transfer') || sub.includes('transfer') || pType.includes('transfer') || name.includes('transfer') || name.includes('airport');
  }, [product]);

  const isGuideOrTour = useMemo(() => {
    if (!product) return false;
    const cat = (product.category || '').toLowerCase();
    const sub = (product.subcategory || '').toLowerCase();
    const name = (product.name || '').toLowerCase();
    return cat.includes('tour') || sub.includes('guide') || name.includes('guide') || name.includes('walking') || name.includes('excursion');
  }, [product]);

  const isDining = useMemo(() => {
    if (!product) return false;
    const cat = (product.category || '').toLowerCase();
    const sub = (product.subcategory || '').toLowerCase();
    const name = (product.name || '').toLowerCase();
    return cat.includes('dining') || sub.includes('culinary') || name.includes('michelin') || name.includes('dinner') || name.includes('lunch') || name.includes('kaiseki');
  }, [product]);

  const isRail = useMemo(() => {
    if (!product) return false;
    const cat = (product.category || '').toLowerCase();
    const name = (product.name || '').toLowerCase();
    return cat.includes('rail') || name.includes('pass') || name.includes('bullet') || name.includes('shinkansen') || name.includes('train');
  }, [product]);

  const isYacht = useMemo(() => {
    if (!product) return false;
    const name = (product.name || '').toLowerCase();
    const cat = (product.category || '').toLowerCase();
    return name.includes('yacht') || name.includes('cruise') || name.includes('boat') || cat.includes('yacht');
  }, [product]);

  const calculation = useMemo(() => {
    if (!product) return null;
    return calculateProductPrice(product, {
      productId: product.id,
      pricingTier,
      adults: Math.max(1, adults),
      children,
      infants,
      travelDate,
      targetCurrency: currency,
      selectedAddonIds,
      customMarkupPercent: product.defaultMarkupPercent
    });
  }, [product, adults, children, infants, travelDate, currency, selectedAddonIds, pricingTier]);

  if (!isOpen || !product) return null;

  const totalPax = adults + children + infants;

  const handleToggleAddon = (addonId: string) => {
    setSelectedAddonIds(prev =>
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const handleConfirmAdd = () => {
    if (!travelDate) {
      setErrorMsg('Please select a valid service date.');
      return;
    }
    if (adults < 1) {
      setErrorMsg('At least 1 adult passenger is required.');
      return;
    }

    const specificNoteParts = [
      isTransfer && pickupLocation ? `Pickup: ${pickupLocation}` : '',
      isTransfer && dropoffLocation ? `Dropoff: ${dropoffLocation}` : '',
      isTransfer && flightNumber ? `Flight/Train: ${flightNumber}` : '',
      isTransfer && luggageCount ? `Luggage: ${luggageCount} bags` : '',
      isGuideOrTour && guideLanguage ? `Language: ${guideLanguage}` : '',
      isDining && dietaryRequirements ? `Dietary: ${dietaryRequirements}` : '',
      isRail && railClass ? `Class: ${railClass}` : '',
      notes.trim()
    ].filter(Boolean);

    const compiledNotes = specificNoteParts.join(' | ') || undefined;

    if (existingItemId) {
      updateQuoteItem(existingItemId, product, {
        adults,
        children,
        infants,
        travelDate,
        serviceTime,
        notes: compiledNotes,
        selectedAddonIds
      });
    } else {
      addProductToQuote(product, {
        adults,
        children,
        infants,
        travelDate,
        serviceTime,
        notes: compiledNotes,
        selectedAddonIds,
        openDrawer: false
      });
    }

    if (onSuccess) {
      onSuccess(product, {
        travelDate,
        serviceTime,
        adults,
        children,
        infants
      });
    }

    onClose();
  };

  const dayOfWeek = travelDate ? new Date(travelDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        id="add-product-to-quote-modal"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0] shrink-0 mt-0.5">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#00C6A6] text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  {product.category || 'Tour & Activity'}
                </span>
                {product.city && (
                  <span className="text-xs text-slate-300 font-medium flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-[#00E5C0]" />
                    <span>{product.city}, {product.country}</span>
                  </span>
                )}
                <span className="text-xs text-slate-400 font-mono">({product.sku || product.id})</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1 leading-snug">
                {product.name}
              </h2>
            </div>
          </div>

          <button
            id="close-add-quote-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/50">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl flex items-center space-x-2 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Service Date & Time Selection */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
              <Calendar className="w-4 h-4 text-[#00A88F]" />
              <span>Service Date & Time Configuration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Service / Travel Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={(e) => {
                    setTravelDate(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6]"
                />
                {dayOfWeek && (
                  <p className="text-[10px] text-teal-800 font-medium mt-1">
                    🗓️ {dayOfWeek}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Service Time Slot
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  {['09:00 AM', '14:00 PM', '18:00 PM', 'Flexible'].map(timeSlot => (
                    <button
                      key={timeSlot}
                      type="button"
                      onClick={() => setServiceTime(timeSlot)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        serviceTime === timeSlot
                          ? 'bg-[#00C6A6] text-white shadow-2xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {timeSlot}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or custom time (e.g. 10:30 AM / Sunset)..."
                  value={serviceTime}
                  onChange={(e) => setServiceTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#00C6A6]"
                />
              </div>
            </div>
          </div>

          {/* Passenger Manifest (Pax) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <Users className="w-4 h-4 text-[#00A88F]" />
                <span>Passenger Manifest</span>
              </div>
              <span className="text-xs font-extrabold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 font-mono">
                Total: {totalPax} {totalPax === 1 ? 'Guest' : 'Guests'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Adults */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Adults (12+)</span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatCurrency(calculation?.adultPricePerPax || convertCurrency(product.adultNetPrice * (1 + (product.defaultMarkupPercent || 15) / 100), product.currency || 'USD', currency), currency)} / pax
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={adults <= 1}
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults(adults + 1)}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs cursor-pointer flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Children (2-11)</span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {formatCurrency(calculation?.childPricePerPax || convertCurrency((product.childNetPrice || (product.adultNetPrice * 0.7)) * (1 + (product.defaultMarkupPercent || 15) / 100), product.currency || 'USD', currency), currency)} / child
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={children <= 0}
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{children}</span>
                  <button
                    type="button"
                    onClick={() => setChildren(children + 1)}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs cursor-pointer flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Infants */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Infants (0-2)</span>
                  <span className="text-[10px] text-emerald-600 block font-bold">
                    Complimentary
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={infants <= 0}
                    onClick={() => setInfants(Math.max(0, infants - 1))}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs disabled:opacity-30 cursor-pointer flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="text-xs font-black font-mono text-slate-900">{infants}</span>
                  <button
                    type="button"
                    onClick={() => setInfants(infants + 1)}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-black text-xs cursor-pointer flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Category-Specific Operational Fields */}
          {isTransfer && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                <Car className="w-4 h-4 text-[#00A88F]" />
                <span>Chauffeured Transfer & Logistics Routing</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Pick-up Location / Airport</label>
                  <input
                    type="text"
                    placeholder="e.g. Haneda Airport (HND) Terminal 3 or Hotel Lobby..."
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Drop-off Destination</label>
                  <input
                    type="text"
                    placeholder="e.g. Aman Tokyo Hotel or Tokyo Station..."
                    value={dropoffLocation}
                    onChange={(e) => setDropoffLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Flight / Train Number</label>
                  <input
                    type="text"
                    placeholder="e.g. NH 007 / JL 043 / Nozomi 12..."
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Luggage Pieces</label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={luggageCount <= 0}
                      onClick={() => setLuggageCount(Math.max(0, luggageCount - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs disabled:opacity-30 flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-mono font-bold text-xs bg-slate-50 py-1.5 rounded-lg border border-slate-200">
                      {luggageCount} {luggageCount === 1 ? 'Bag' : 'Bags'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLuggageCount(luggageCount + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isGuideOrTour && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                <Languages className="w-4 h-4 text-[#00A88F]" />
                <span>Guide Spoken Language & Tour Arrangement</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['English', 'Japanese', 'French', 'Spanish', 'Mandarin', 'German', 'Italian', 'Arabic'].map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setGuideLanguage(lang)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      guideLanguage === lang
                        ? 'bg-teal-50 border-[#00C6A6] text-teal-950 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isDining && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                <Utensils className="w-4 h-4 text-[#00A88F]" />
                <span>Gastronomy & Dietary Preferences</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Dietary Requirements & Allergies</label>
                <input
                  type="text"
                  placeholder="e.g. Vegetarian, No shellfish, Halal-friendly, Gluten-free, Nut allergy..."
                  value={dietaryRequirements}
                  onChange={(e) => setDietaryRequirements(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6]"
                />
              </div>
            </div>
          )}

          {isRail && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                <Train className="w-4 h-4 text-[#00A88F]" />
                <span>Rail Class & Ticket Grade</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Ordinary Class', 'Green Car (Executive)', 'Gran Class (Ultra VIP)'].map(cls => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setRailClass(cls)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      railClass === cls
                        ? 'bg-teal-50 border-[#00C6A6] text-teal-950 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Add-ons if product has them */}
          {product.addons && product.addons.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                <Sparkles className="w-4 h-4 text-[#00A88F]" />
                <span>Optional Service Add-Ons & Enhancements</span>
              </div>
              <div className="space-y-2">
                {product.addons.map(addon => {
                  const isChecked = selectedAddonIds.includes(addon.id);
                  return (
                    <label
                      key={addon.id}
                      onClick={() => handleToggleAddon(addon.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-teal-50/80 border-[#00C6A6] text-teal-950 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked ? 'bg-[#00C6A6] border-[#00C6A6] text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold block">{addon.name}</span>
                          {addon.description && (
                            <span className="text-[10px] text-slate-500">{addon.description}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-900">
                        +{formatCurrency(convertCurrency(addon.price, product.currency || 'USD', currency), currency)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Requests / Notes */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
              <FileText className="w-4 h-4 text-[#00A88F]" />
              <span>Special Requests & Operational Notes</span>
            </div>
            <textarea
              rows={2}
              placeholder="e.g. Hotel lobby pick-up required, English speaking driver requested, dietary allergies..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] placeholder:text-slate-400"
            />
          </div>

          {/* Live Calculation Summary Banner */}
          {calculation && (
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00E5C0]" />
                  <span>Real-time Tariff Calculation</span>
                </span>
                <span className="text-[11px] text-[#00E5C0] font-mono font-bold">
                  {totalPax} Guests • {dayOfWeek}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 block">Per Person Rate</span>
                  <span className="text-sm font-bold text-slate-200 font-mono">
                    {formatCurrency(calculation.pricePerPerson, currency)}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Based on {totalPax} Pax • Taxes included
                  </span>
                </div>

                <div className="bg-teal-950/60 p-2.5 rounded-xl border border-teal-600/40">
                  <span className="text-[10px] text-teal-300 font-bold block">Final Selling Price</span>
                  <span className="text-lg font-black text-[#00E5C0] font-mono">
                    {formatCurrency(calculation.finalTotalSellingPrice, currency)}
                  </span>
                  <span className="text-[9px] text-teal-400 block">
                    ✓ Clean Final Price • All Inclusive
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-add-to-quote-btn"
            onClick={handleConfirmAdd}
            className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00A88F] text-slate-950 text-xs font-black transition-all flex items-center space-x-2 cursor-pointer shadow-md hover:shadow-lg"
          >
            {existingItemId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{existingItemId ? 'Update Item' : 'Add to Cart'} ({formatCurrency(calculation?.finalTotalSellingPrice || 0, currency)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
