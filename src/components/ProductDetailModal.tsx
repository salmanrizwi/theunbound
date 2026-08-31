import React, { useState } from 'react';
import { Product, CurrencyCode, SUPPORTED_CURRENCIES } from '../types';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { useRoster } from '../context/RosterContext';
import { formatCurrency, convertCurrency } from '../services/pricingEngine';
import { RosterCalendarPicker } from './RosterCalendarPicker';
import { WishlistButton } from './WishlistButton';
import { 
  X, 
  MapPin, 
  Clock, 
  Star, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calculator, 
  Lock, 
  Calendar, 
  Building2, 
  Navigation,
  Sparkles,
  Share2,
  Check,
  Plus,
  CalendarCheck,
  CalendarX,
  UserCheck,
  ArrowRight,
  AlertTriangle,
  Globe2,
  ChevronDown
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onOpenCalculator: (product: Product) => void;
  onBookProduct?: (product: Product, initialDate?: string, adults?: number, children?: number) => void;
  hidePrice?: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onOpenCalculator,
  onBookProduct,
  hidePrice = false
}) => {
  const { isAuthenticated, openAuthModal, role } = useAuth();
  const { currency, setCurrency, addProductToQuote, items } = useQuotation();
  const { checkDateAvailability, getNextAvailableDate } = useRoster();

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [adults, setAdults] = useState(Math.max(1, product.minPax));
  const [childrenCount, setChildrenCount] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);

  // Initialize date to next available date in Roster
  const [selectedTravelDate, setSelectedTravelDate] = useState<string>(() => {
    const next = getNextAvailableDate(product.id);
    return next || new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
  });

  const convertedStartingPrice = convertCurrency(
    product.sellingPriceStartingFrom,
    product.currency,
    currency
  );

  const availability = checkDateAvailability(product.id, selectedTravelDate, adults + childrenCount);
  const isAlreadyInQuote = items.some(i => i.product.id === product.id);

  const handleCalculatorClick = () => {
    if (!isAuthenticated) {
      openAuthModal(
        `Please sign in to calculate dynamic pricing for ${product.name}`,
        () => onOpenCalculator(product)
      );
      return;
    }
    onOpenCalculator(product);
  };

  const handleAddToQuote = () => {
    if (!availability.isAvailable) {
      return;
    }
    if (!isAuthenticated) {
      openAuthModal(
        `Please sign in to add ${product.name} to your quotation`,
        () => addProductToQuote(product, { adults, children: childrenCount, travelDate: selectedTravelDate })
      );
      return;
    }
    addProductToQuote(product, {
      adults,
      children: childrenCount,
      travelDate: selectedTravelDate
    });
    onClose();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        id="product-detail-modal"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Modal Top Nav Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {product.category}
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-slate-300 text-xs font-medium">{product.destinationName} / {product.city}</span>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Synchronized Currency Selector in Modal Header */}
            <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
              <Globe2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
              <select
                id="modal-header-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
                title="Switch Currency"
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleShare}
              className="text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? 'Link Copied' : 'Share'}</span>
            </button>

            <button
              id="close-product-detail-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-6 space-y-8 flex-1">
          {/* Header Title & Ratings */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
                {product.name}
              </h1>

              <div className="flex items-center space-x-2 bg-amber-50 text-amber-900 px-3 py-1 rounded-full border border-amber-200">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-bold">{product.rating}</span>
                <span className="text-xs text-amber-700">({product.reviewCount} Verified Client Reviews)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center space-x-1 font-semibold text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-[#008972]" />
                <span>{product.location}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Duration: {product.duration}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Operating Days: {(product.operatingDays || []).join(', ') || 'Daily'}</span>
              </span>
            </div>
          </div>

          {/* Photo Gallery & Thumbnail Selector */}
          <div className="space-y-3">
            <div className="aspect-21/9 sm:aspect-16/7 w-full rounded-2xl overflow-hidden bg-slate-900 relative shadow-inner">
              <img
                src={(product.images || [])[activeImageIdx] || (product.images || [])[0] || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md text-white text-xs px-3 py-1 rounded-lg">
                Photo {activeImageIdx + 1} of {(product.images || []).length || 1}
              </div>
            </div>

            {(product.images || []).length > 1 && (
              <div className="flex items-center space-x-3 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`relative w-24 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      activeImageIdx === idx ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/30' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Overview & Detailed Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              {/* Long Description */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">
                  Experience Overview & Itinerary
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {product.longDescription || product.shortDescription}
                </p>
              </div>

              {/* Inclusions & Exclusions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-3 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Included Services</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-emerald-950">
                    {(product.inclusions || []).map((inc, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 mb-3 flex items-center space-x-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Exclusions</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-rose-950">
                    {(product.exclusions || []).map((exc, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{exc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Logistics, Meeting Point & Cancellation Policy */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1 flex items-center space-x-1.5">
                    <Navigation className="w-4 h-4 text-[#008972]" />
                    <span>Meeting Point & Pickup Logistics</span>
                  </h4>
                  <p className="text-xs text-slate-700">{product.meetingPoint}</p>
                  {product.pickupInformation && (
                    <p className="text-xs text-slate-500 mt-1">{product.pickupInformation}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Cancellation & Refund Protocol</span>
                  </h4>
                  <p className="text-xs text-slate-700">{product.cancellationPolicy}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Pricing & Fast Action Box */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl sticky top-4">
                {hidePrice ? (
                  <div className="mb-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00E5C0] flex items-center space-x-1 mb-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Wholesale Rate Protected</span>
                    </span>
                    <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 text-xs text-slate-300">
                      <p className="font-bold text-white mb-0.5">B2B Partner Discovery Mode</p>
                      <p className="text-[11px] text-slate-400">
                        Exact wholesale pricing is calculated upon adding product to the Quotation Builder.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Rate Header with integrated Currency Dropdown */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C6A6]">
                        Published Starting Rate
                      </span>
                      <div className="relative inline-flex items-center">
                        <Globe2 className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                        <select
                          id="product-detail-currency-select"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                          className="bg-slate-800 text-white font-bold text-xs rounded-lg pl-6 pr-6 py-1 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00C6A6] cursor-pointer hover:bg-slate-750 transition-colors appearance-none"
                          title="Change display currency"
                        >
                          {SUPPORTED_CURRENCIES.map(c => (
                            <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                              {c.code} ({c.symbol})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
                      </div>
                    </div>
                    
                    <div className="flex items-baseline space-x-2 mb-2">
                      <span className="text-3xl font-black text-white font-sans tracking-tight">
                        {formatCurrency(convertedStartingPrice, currency)}
                      </span>
                      <span className="text-xs text-slate-400">/ Adult (Retail)</span>
                    </div>

                    {product.currency !== currency && (
                      <div className="text-[11px] text-slate-400 flex items-center justify-between px-2.5 py-1.5 mb-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                        <span className="flex items-center space-x-1.5 text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                          <span>Base Supplier Rate:</span>
                        </span>
                        <span className="font-mono font-bold text-slate-200">
                          {formatCurrency(product.sellingPriceStartingFrom, product.currency)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Live DMC Roster Date & Capacity Inspector */}
                <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#00E5C0] flex items-center space-x-1.5">
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>DMC Roster Verification</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="text-[10px] text-[#00C6A6] hover:underline font-bold cursor-pointer"
                    >
                      {showCalendar ? 'Hide Calendar' : 'View Calendar'}
                    </button>
                  </div>

                  {/* Travel Date & Pax Selection */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">
                        Select Tour Date:
                      </label>
                      <input
                        type="date"
                        value={selectedTravelDate}
                        min={product.validityFrom}
                        max={product.validityTo}
                        onChange={(e) => setSelectedTravelDate(e.target.value)}
                        className={`w-full bg-slate-900 border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-[#00C6A6] focus:outline-none ${
                          availability.isAvailable ? 'border-slate-700' : 'border-rose-500 text-rose-300'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Adults:</label>
                        <input
                          type="number"
                          min={1}
                          max={product.maxPax}
                          value={adults}
                          onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-xs text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Children:</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={childrenCount}
                          onChange={(e) => setChildrenCount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-center text-xs text-white font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expandable Roster Calendar */}
                  {showCalendar && (
                    <div className="pt-2 border-t border-slate-700">
                      <RosterCalendarPicker
                        productId={product.id}
                        selectedDate={selectedTravelDate}
                        onSelectDate={(newDate) => {
                          setSelectedTravelDate(newDate);
                        }}
                        paxCount={adults + childrenCount}
                        minDate={product.validityFrom}
                        maxDate={product.validityTo}
                      />
                    </div>
                  )}

                  {/* Roster Live Status Badge */}
                  {availability.isAvailable ? (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-emerald-300">
                        <span className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Roster Verified Open</span>
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-900/80 px-1.5 py-0.5 rounded text-emerald-300">
                          {availability.remainingCapacity} Slots Free
                        </span>
                      </div>
                      {availability.assignedResourceName && (
                        <p className="text-[10px] text-emerald-400 flex items-center space-x-1">
                          <UserCheck className="w-3 h-3" />
                          <span>Guide: {availability.assignedResourceName}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-700 text-rose-200 text-xs space-y-2">
                      <div className="flex items-start space-x-1.5">
                        <CalendarX className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold text-rose-300 block">Date Unavailable in Roster</span>
                          <p className="text-[10px] text-rose-400 leading-snug mt-0.5">{availability.reason}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const next = getNextAvailableDate(product.id, selectedTravelDate);
                          if (next) setSelectedTravelDate(next);
                        }}
                        className="w-full py-1.5 px-2 bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700 text-emerald-300 rounded-lg text-[10px] font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                      >
                        <span>Jump to Next Open Date</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 text-xs text-slate-300 py-3 border-y border-slate-800 mb-6">
                  <div className="flex justify-between">
                    <span>Operating Days:</span>
                    <span className="font-semibold text-white">{product.operatingDays.join(', ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min / Max Capacity:</span>
                    <span className="font-semibold text-white">{product.minPax} to {product.maxPax} Pax</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Advance Booking:</span>
                    <span className="font-semibold text-white">{product.bookingRequiredDays} Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Validity Period:</span>
                    <span className="font-mono text-slate-400">{product.validityFrom} to {product.validityTo}</span>
                  </div>
                </div>

                {/* Primary Action Button */}
                {hidePrice ? (
                  <button
                    disabled={!availability.isAvailable}
                    onClick={handleAddToQuote}
                    className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center space-x-2 ${
                      availability.isAvailable
                        ? 'bg-[#00C6A6] hover:bg-[#008972] text-slate-950 shadow-[#00C6A6]/20 cursor-pointer hover:scale-102'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {availability.isAvailable ? (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add to Quotation Builder</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>Unavailable on Selected Date</span>
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      id="modal-calc-trigger-btn"
                      onClick={handleCalculatorClick}
                      className="w-full bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer hover:scale-102 mb-2.5"
                    >
                      {isAuthenticated ? (
                        <>
                          <Calculator className="w-4 h-4" />
                          <span>Open Dynamic Calculator</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Login to Access Pricing</span>
                        </>
                      )}
                    </button>

                    {/* Direct Booking Action (Product Booking with 24-48h SLA Notice) */}
                    {onBookProduct && (
                      <button
                        id="modal-direct-book-btn"
                        onClick={() => {
                          if (!isAuthenticated) {
                            openAuthModal(`Please sign in to book ${product.name}.`, () => {
                              onBookProduct(product, selectedTravelDate, adults, childrenCount);
                            });
                            return;
                          }
                          onBookProduct(product, selectedTravelDate, adults, childrenCount);
                        }}
                        className="w-full bg-slate-100 hover:bg-white text-slate-900 font-extrabold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer mb-2"
                      >
                        <CalendarCheck className="w-4 h-4 text-[#008972]" />
                        <span>Instant Book (24–48h SLA Dispatch)</span>
                      </button>
                    )}

                    {isAuthenticated && (
                      <button
                        disabled={!availability.isAvailable}
                        onClick={handleAddToQuote}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 mb-2 ${
                          availability.isAvailable
                            ? 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer'
                            : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        {availability.isAvailable ? (
                          <span>Add Verified Date to Quote</span>
                        ) : (
                          <span>Locked: Date Unavailable</span>
                        )}
                      </button>
                    )}

                    <div className="pt-1">
                      <WishlistButton product={product} variant="button" />
                    </div>
                  </>
                )}

                {/* Supplier info box (Confidential view for internal Admin/Staff) */}
                {(role === 'ADMIN' || role === 'DMC_STAFF') && (
                  <div className="mt-6 p-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] mb-1 flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>DMC Contracted Supplier Info</span>
                    </p>
                    <p className="font-bold text-white">{product.supplierName}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Code: {product.supplierProductCode}</p>
                    <div className="mt-2 pt-2 border-t border-slate-700/80 flex justify-between text-slate-300">
                      <span>Net Adult: {formatCurrency(product.adultNetPrice, product.currency)}</span>
                      <span>Margin: {product.defaultMarkupPercent}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
