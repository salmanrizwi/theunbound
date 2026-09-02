import React, { useState, useMemo } from 'react';
import { Product, CurrencyCode } from '../types';
import { useRoster } from '../context/RosterContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, convertCurrency, calculateProductPrice } from '../services/pricingEngine';
import { RosterCalendarPicker } from './RosterCalendarPicker';
import { 
  MapPin, 
  Clock, 
  Star, 
  Calendar, 
  Users, 
  Plus, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Lock, 
  CalendarCheck, 
  AlertTriangle, 
  ArrowRight,
  Layers,
  FileText,
  Sparkles,
  DollarSign,
  Info
} from 'lucide-react';

interface B2BProductRowCardProps {
  product: Product;
  allProducts?: Product[];
  currency: CurrencyCode;
  agentClientMarkupPercent?: number;
  isAlreadyAdded: boolean;
  addedCount: number;
  onViewDetails: (product: Product) => void;
  onOpenRosterModal: (product: Product) => void;
  onAddToQuote: (options: {
    adults: number;
    children: number;
    infants: number;
    travelDate: string;
    selectedAddonIds: string[];
    timeSlot?: string;
    notes?: string;
  }) => void;
}

export const B2BProductRowCard: React.FC<B2BProductRowCardProps> = ({
  product,
  allProducts = [],
  currency,
  agentClientMarkupPercent = 12,
  isAlreadyAdded,
  addedCount,
  onViewDetails,
  onOpenRosterModal,
  onAddToQuote
}) => {
  const { user } = useAuth();
  const { checkDateAvailability, getNextAvailableDate } = useRoster();

  // Inline dropdown expansion state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showInlineCalendar, setShowInlineCalendar] = useState(false);
  const [justAddedSuccess, setJustAddedSuccess] = useState(false);

  // Default date: Next open roster date or 14 days from now
  const initialDate = useMemo(() => {
    return getNextAvailableDate(product.id) || 
      new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
  }, [product.id, getNextAvailableDate]);

  // Form states for inline configuration
  const [travelDate, setTravelDate] = useState<string>(initialDate);
  const [adults, setAdults] = useState<number>(Math.max(1, product.minPax || 2));
  const [children, setChildren] = useState<number>(0);
  const [infants, setInfants] = useState<number>(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('Morning (09:00 - 13:00)');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialNotes, setSpecialNotes] = useState<string>('');

  // Real-time Roster Availability for the selected date & pax
  const rosterStatus = useMemo(() => {
    return checkDateAvailability(product.id, travelDate, adults + children);
  }, [product.id, travelDate, adults, children, checkDateAvailability]);

  // Optional Upgrade products tagged on this product
  const taggedUpgrades = useMemo(() => {
    if (!product.optionalUpgradeProductIds || (product.optionalUpgradeProductIds || []).length === 0) {
      return [];
    }
    return allProducts.filter(p => (product.optionalUpgradeProductIds || []).includes(p.id));
  }, [product.optionalUpgradeProductIds, allProducts]);

  // Real-time calculated price for the current dropdown form values
  const liveCalculation = useMemo(() => {
    return calculateProductPrice(product, {
      productId: product.id,
      pricingTier: 'B2B',
      userRole: user?.role || 'B2B_AGENT',
      adults,
      children,
      infants,
      travelDate,
      targetCurrency: currency,
      selectedAddonIds,
      agentClientMarkupPercent
    });
  }, [product, user, adults, children, infants, travelDate, currency, selectedAddonIds, agentClientMarkupPercent]);

  // Handle toggle add-on checkbox
  const handleToggleAddon = (addonId: string) => {
    setSelectedAddonIds(prev => 
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  // Submit and add to quotation
  const handleConfirmAdd = () => {
    onAddToQuote({
      adults,
      children,
      infants,
      travelDate,
      selectedAddonIds,
      timeSlot: selectedTimeSlot,
      notes: specialNotes
    });

    setJustAddedSuccess(true);
    setTimeout(() => {
      setJustAddedSuccess(false);
      setIsDropdownOpen(false);
    }, 1200);
  };

  return (
    <div
      id={`b2b-product-card-${product.id}`}
      className={`bg-white rounded-2xl border transition-all overflow-hidden ${
        isDropdownOpen
          ? 'border-[#00C6A6] shadow-md ring-1 ring-[#00C6A6]/30'
          : isAlreadyAdded
          ? 'border-emerald-200 bg-emerald-50/10 shadow-xs'
          : 'border-slate-200 hover:border-slate-300 shadow-xs'
      }`}
    >
      {/* ========================================================================= */}
      {/* MAIN COMPACT ROW HEADER */}
      {/* ========================================================================= */}
      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Product Thumbnail & Core Metadata */}
        <div className="flex items-start space-x-4 min-w-0 flex-1">
          <div
            onClick={() => onViewDetails(product)}
            className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 cursor-pointer group"
          >
            <img
              src={product.images[0] || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <span className="absolute bottom-1 left-1 bg-slate-950/80 text-[#00E5C0] font-mono text-[9px] font-bold px-1.5 py-0.5 rounded">
              {product.sku}
            </span>
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#00C6A6]/10 text-[#008972] px-2 py-0.5 rounded">
                {product.category}
              </span>
              <span className="text-[11px] font-medium text-slate-500 flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>{product.city}, {product.destinationName}</span>
              </span>
              <span className="text-[11px] font-medium text-slate-400 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{product.duration}</span>
              </span>
            </div>

            <h3
              onClick={() => onViewDetails(product)}
              className="font-bold text-sm text-slate-900 hover:text-[#008972] transition-colors leading-snug cursor-pointer line-clamp-1"
            >
              {product.name}
            </h3>

            <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
              {product.shortDescription}
            </p>

            <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-0.5">
              <span className="flex items-center space-x-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-bold text-slate-700">{(Number(product.rating) || 5.0).toFixed(1)}</span>
                <span>({product.reviewCount || 0})</span>
              </span>
              <span>•</span>
              <span className="text-slate-500 font-medium">
                Min {product.minPax} - Max {product.maxPax} pax
              </span>
              <span>•</span>
              <span className="text-slate-400">
                {product.operatingDays.slice(0, 4).join(', ')}
              </span>
              {isAlreadyAdded && (
                <>
                  <span>•</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {addedCount} in Quote Sidebar
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Confidential Wholesale Badge & Action Controls */}
        <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2.5 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="text-right">
            <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200/80">
              <Lock className="w-2.5 h-2.5 text-slate-400" />
              <span>Confidential Wholesale</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Calculated on Quote Creation
            </span>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              type="button"
              id={`b2b-btn-roster-${product.id}`}
              onClick={() => onOpenRosterModal(product)}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
              title="Check Roster & Capacity Calendar"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-[#008972]" />
              <span>Roster</span>
            </button>

            <button
              type="button"
              id={`b2b-btn-view-details-${product.id}`}
              onClick={() => onViewDetails(product)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Details</span>
            </button>

            {/* Primary Toggle Dropdown Button */}
            <button
              type="button"
              id={`b2b-btn-toggle-config-${product.id}`}
              onClick={() => setIsDropdownOpen(prev => !prev)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs ${
                isDropdownOpen
                  ? 'bg-slate-900 text-white ring-2 ring-[#00C6A6]'
                  : isAlreadyAdded
                  ? 'bg-slate-900 hover:bg-slate-800 text-[#00E5C0]'
                  : 'bg-[#00C6A6] hover:bg-[#008972] text-slate-950'
              }`}
            >
              {isDropdownOpen ? (
                <>
                  <span>Close Form</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : isAlreadyAdded ? (
                <>
                  <Plus className="w-3.5 h-3.5 text-[#00E5C0]" />
                  <span>Add Another Day</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Itinerary</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INLINE CONFIGURATION DROPDOWN PANEL BELOW PRODUCT ROW */}
      {/* ========================================================================= */}
      {isDropdownOpen && (
        <div 
          id={`b2b-inline-config-${product.id}`}
          className="border-t border-slate-200 bg-slate-50/80 p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200"
        >
          {/* Header of Inline Config Form */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-[#00C6A6]/20 text-[#008972] flex items-center justify-center font-bold text-xs">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Configure Ground Service & Quotation Details
                </h4>
                <p className="text-[11px] text-slate-500">
                  Enter travel date, guest count, and service preferences to add to the quotation sidebar.
                </p>
              </div>
            </div>

            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
              Product SKU: {product.sku}
            </span>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* 1. Travel Date Selection (4 cols) */}
            <div className="md:col-span-4 space-y-2 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Travel Date *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineCalendar(prev => !prev)}
                  className="text-[10px] text-[#008972] hover:underline font-bold"
                >
                  {showInlineCalendar ? 'Hide Calendar' : 'Roster Calendar'}
                </button>
              </div>

              <input
                type="date"
                value={travelDate}
                min={product.validityFrom || '2026-01-01'}
                max={product.validityTo || '2026-12-31'}
                onChange={(e) => setTravelDate(e.target.value)}
                className={`w-full bg-slate-50 border rounded-lg p-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none ${
                  rosterStatus.isAvailable ? 'border-slate-300 focus:border-[#00C6A6]' : 'border-rose-400 bg-rose-50/50 text-rose-900'
                }`}
              />

              {/* Roster Live Status Indicator */}
              <div className="pt-1">
                {rosterStatus.isAvailable ? (
                  <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200/80">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">Roster Verified ({rosterStatus.remainingCapacity} seats open)</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-700">
                    <div className="flex items-center space-x-1 font-bold">
                      <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>{rosterStatus.reason || 'Capacity blocked on this date'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = getNextAvailableDate(product.id, travelDate);
                        if (next) setTravelDate(next);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-2 rounded text-[10px] flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                    >
                      <span>Jump to Next Open Date</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Pax Selection Controls (4 cols) */}
            <div className="md:col-span-4 space-y-2 bg-white p-3 rounded-xl border border-slate-200">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Guest Breakdown (Pax) *</span>
              </label>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {/* Adults */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 block">Adults</span>
                  <input
                    type="number"
                    min={1}
                    max={product.maxPax || 20}
                    value={adults}
                    onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-center text-xs font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400 block text-center">Min {product.minPax}</span>
                </div>

                {/* Children */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 block">Children</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={children}
                    onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-center text-xs font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400 block text-center">5-11 yrs</span>
                </div>

                {/* Infants */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 block">Infants</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={infants}
                    onChange={(e) => setInfants(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-center text-xs font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400 block text-center">0-4 yrs</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 text-center pt-1 border-t border-slate-100 font-medium">
                Total Pax: {adults + children + infants} ({adults} Ad{children > 0 ? `, ${children} Ch` : ''}{infants > 0 ? `, ${infants} Inf` : ''})
              </div>
            </div>

            {/* 3. Time Slot & Service Preference (4 cols) */}
            <div className="md:col-span-4 space-y-2 bg-white p-3 rounded-xl border border-slate-200">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Operating Slot / Pickup Time</span>
              </label>

              <select
                value={selectedTimeSlot}
                onChange={(e) => setSelectedTimeSlot(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none cursor-pointer"
              >
                <option value="Morning (09:00 - 13:00)">Morning Slot (09:00 - 13:00)</option>
                <option value="Afternoon (13:30 - 17:30)">Afternoon Slot (13:30 - 17:30)</option>
                <option value="Full Day (09:00 - 18:00)">Full Day Tour (09:00 - 18:00)</option>
                <option value="Evening / Sunset (17:00 - 21:00)">Evening / Sunset Tour (17:00 - 21:00)</option>
                <option value="Custom Private Pickup">Custom Private Pickup Time</option>
              </select>

              <div>
                <input
                  type="text"
                  placeholder="Special notes (hotel pickup, guide language, dietary)..."
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Inline Roster Calendar View when toggled */}
          {showInlineCalendar && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center space-x-1.5">
                  <CalendarCheck className="w-4 h-4 text-[#00C6A6]" />
                  <span>Real-Time Roster Calendar for {product.name}</span>
                </span>
                <span className="text-[10px] text-slate-400">Click any date to select</span>
              </div>
              <RosterCalendarPicker
                productId={product.id}
                selectedDate={travelDate}
                onSelectDate={(newDate) => {
                  setTravelDate(newDate);
                  setShowInlineCalendar(false);
                }}
                paxCount={adults + children}
                minDate={product.validityFrom}
                maxDate={product.validityTo}
              />
            </div>
          )}

          {/* 4. Optional Upgrades & Add-ons Section (if available) */}
          {( ((product.addons && (product.addons || []).length > 0)) || (taggedUpgrades || []).length > 0 ) && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Optional Experience Upgrades & Add-ons</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {selectedAddonIds.length} upgrade(s) selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {/* Standard Addons */}
                {product.addons?.map(addon => {
                  const isChecked = selectedAddonIds.includes(addon.id);
                  const convertedPrice = convertCurrency(addon.price, product.currency, currency);
                  return (
                    <label
                      key={addon.id}
                      className={`flex items-start space-x-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                        isChecked ? 'bg-[#00C6A6]/10 border-[#00C6A6]' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleAddon(addon.id)}
                        className="mt-0.5 rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 truncate">{addon.name}</div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                          <span>{addon.description || 'Optional service'}</span>
                          <span className="font-mono font-bold text-slate-700">+{formatCurrency(convertedPrice, currency)}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}

                {/* Tagged Experience Upgrades */}
                {taggedUpgrades.map(upg => {
                  const isChecked = selectedAddonIds.includes(upg.id);
                  const convertedPrice = convertCurrency(upg.adultNetPrice, upg.currency, currency);
                  return (
                    <label
                      key={upg.id}
                      className={`flex items-start space-x-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                        isChecked ? 'bg-[#00C6A6]/10 border-[#00C6A6]' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleAddon(upg.id)}
                        className="mt-0.5 rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 truncate">{upg.name}</div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                          <span>VIP Upgrade</span>
                          <span className="font-mono font-bold text-[#008972]">+{formatCurrency(convertedPrice, currency)}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* BOTTOM ACTIONS BAR & LIVE ESTIMATED SUMMARY */}
          {/* ========================================================================= */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Live Pricing Summary in Selected Currency */}
            <div className="flex items-center space-x-4 text-xs w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Final Selling Price:
                </span>
                <span className="text-sm font-extrabold font-mono text-[#008972]">
                  {formatCurrency(liveCalculation.finalTotalSellingPrice, currency)}
                </span>
              </div>
            </div>

            {/* Form Submission Buttons */}
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                id={`b2b-btn-confirm-add-${product.id}`}
                disabled={!rosterStatus.isAvailable || justAddedSuccess}
                onClick={handleConfirmAdd}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer ${
                  justAddedSuccess
                    ? 'bg-emerald-600 text-white'
                    : !rosterStatus.isAvailable
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-[#00C6A6] hover:bg-[#008972] text-slate-950'
                }`}
              >
                {justAddedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Added to Itinerary Sidebar!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add to Quotation Itinerary</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
