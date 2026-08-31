import React, { useState } from 'react';
import { 
  B2BPackage, 
  CurrencyCode, 
  Product, 
  Hotel 
} from '../types';
import { AppDatabase } from '../services/db';
import { formatCurrency } from '../services/pricingEngine';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  MapPin, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Sparkles, 
  DollarSign, 
  Building2, 
  Layers, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Utensils, 
  Car, 
  Hotel as HotelIcon, 
  Compass, 
  FileText, 
  Share2, 
  Check, 
  Tag,
  Eye,
  Info,
  MessageSquare
} from 'lucide-react';

interface PackageDetailModalProps {
  packageItem: B2BPackage;
  onClose: () => void;
  onCustomizePackage?: (pkg: B2BPackage) => void;
  onInstantBook?: (pkg: B2BPackage) => void;
  onEnquirePackage?: (pkg: B2BPackage) => void;
}

export const PackageDetailModal: React.FC<PackageDetailModalProps> = ({
  packageItem,
  onClose,
  onCustomizePackage,
  onInstantBook,
  onEnquirePackage
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(packageItem.currency || 'USD');
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [activeTab, setActiveTab] = useState<'ITINERARY' | 'INCLUSIONS' | 'HOTELS' | 'TERMS'>('ITINERARY');

  const isB2BAgent = user && (user.role === 'B2B_AGENT' || user.role === 'AGENT' || user.role === 'ADMIN');
  const durationText = `${packageItem.durationNights || (packageItem.durationDays - 1)} Nights / ${packageItem.durationDays} Days`;

  // Calculate prices
  const netCost = packageItem.baseNetCostUSD || 2500;
  const retailPrice = packageItem.suggestedSellingPriceUSD || Math.round(netCost * 1.3);
  const b2bAgentPrice = Math.round(netCost * (1 + (packageItem.pricingConfiguration?.b2bMarkupPercent || 12) / 100));

  const displayPrice = isB2BAgent ? b2bAgentPrice : retailPrice;

  // Fetch referenced master products
  const masterProducts = db.getProducts();
  const masterHotels = db.getHotels();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full my-auto shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Hero Section */}
        <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-900 shrink-0">
          <img 
            src={packageItem.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200'} 
            alt={packageItem.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-black/30" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top Badges */}
          <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#008972] text-white text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-sm">
              <MapPin className="w-3.5 h-3.5" />
              <span>{packageItem.destinationName}</span>
            </span>

            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-wider">
              {packageItem.tripType || 'LUXURY'} • {durationText}
            </span>

            {isB2BAgent && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                B2B Wholesale Circuit
              </span>
            )}
          </div>

          {/* Hero Bottom Overlay */}
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-md">
              {packageItem.title}
            </h1>
            <p className="text-xs text-slate-200 mt-1 max-w-2xl line-clamp-2 leading-relaxed">
              {packageItem.tagline || packageItem.description}
            </p>
          </div>
        </div>

        {/* Route Summary Ribbon */}
        {packageItem.routeSummary && packageItem.routeSummary.length > 0 && (
          <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-2 overflow-x-auto py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Itinerary Circuit:
              </span>
              <div className="flex items-center space-x-1.5 shrink-0">
                {packageItem.routeSummary.map((route, i) => (
                  <React.Fragment key={i}>
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-xs font-bold text-[#00C6A6]">
                      {route}
                    </span>
                    {i < (packageItem.routeSummary || []).length - 1 && (
                      <span className="text-slate-600 font-black">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">
                  {isB2BAgent ? 'B2B Wholesale Rate' : 'Starting From'}
                </span>
                <span className="text-base font-black text-[#00C6A6] font-mono">
                  {formatCurrency(displayPrice, selectedCurrency)} <span className="text-[10px] text-slate-300 font-sans font-normal">/ pax</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sub-Navigation Tabs */}
        <div className="px-6 bg-slate-50 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto shrink-0">
          {[
            { id: 'ITINERARY', label: 'Day-by-Day Itinerary', icon: Calendar },
            { id: 'INCLUSIONS', label: 'Inclusions & Highlights', icon: CheckCircle2 },
            { id: 'HOTELS', label: 'Accommodation Roster', icon: HotelIcon },
            { id: 'TERMS', label: 'Terms & Policies', icon: ShieldCheck }
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center space-x-1.5 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[#008972] text-[#008972] bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* TAB 1: DAY BY DAY ITINERARY */}
          {activeTab === 'ITINERARY' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Structured Day-by-Day Schedule</h3>
                  <p className="text-[11px] text-slate-500">
                    Click each day to view morning to evening excursions, assigned 5★ hotels, and included meal plans.
                  </p>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setExpandedDay(null)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    Collapse All
                  </button>
                  <button
                    onClick={() => setExpandedDay(-1)} // expand all logic
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer"
                  >
                    Expand All
                  </button>
                </div>
              </div>

              {/* Itinerary Accordion */}
              <div className="space-y-3">
                {((packageItem.itinerary && packageItem.itinerary.length > 0)
                  ? packageItem.itinerary 
                  : Array.from({ length: packageItem.durationDays || 5 }, (_, i) => ({
                      dayNumber: i + 1,
                      title: `Day ${i + 1} Sightseeing & Discovery`,
                      description: 'Comprehensive guided excursions, luxury transit, and evening leisure.',
                      productIds: [],
                      mealsIncluded: { breakfast: true, lunch: false, dinner: false }
                    }))
                ).map((day, idx) => {
                  const isExpanded = expandedDay === -1 || expandedDay === day.dayNumber;
                  const dayProducts = masterProducts.filter(p => (day.productIds || []).includes(p.id));
                  const dayHotel = masterHotels.find(h => h.id === day.hotelId);

                  return (
                    <div 
                      key={idx}
                      className="bg-slate-50 rounded-2xl border border-slate-200/90 overflow-hidden transition-all"
                    >
                      {/* Day Header Bar */}
                      <button
                        onClick={() => setExpandedDay(isExpanded && expandedDay !== -1 ? null : day.dayNumber)}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="w-7 h-7 rounded-xl bg-[#008972] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                            {day.dayNumber}
                          </span>
                          <div>
                            <span className="font-black text-slate-900 text-xs block">{day.title}</span>
                            {day.hubName && (
                              <span className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1">
                                <MapPin className="w-2.5 h-2.5 text-[#008972]" />
                                <span>{day.hubName}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          {/* Meal badges */}
                          <div className="hidden sm:flex items-center space-x-1 text-[10px] text-slate-500 font-bold">
                            {day.mealsIncluded?.breakfast && <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200">B</span>}
                            {day.mealsIncluded?.lunch && <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200">L</span>}
                            {day.mealsIncluded?.dinner && <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200">D</span>}
                          </div>

                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {/* Day Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-200/60 bg-white">
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {day.description || 'Full day of bespoke touring, cultural discoveries, and private transport.'}
                          </p>

                          {/* Master Products assigned */}
                          {dayProducts.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Included Activities & Tours:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {dayProducts.map(prod => (
                                  <div key={prod.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-2">
                                    <Sparkles className="w-3.5 h-3.5 text-[#008972] shrink-0" />
                                    <div className="min-w-0">
                                      <span className="font-bold text-slate-800 text-[11px] block truncate">{prod.name}</span>
                                      <span className="text-[9px] text-slate-500 uppercase">{prod.category} • {prod.duration}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Accommodation & Meals Strip */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                            {dayHotel ? (
                              <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
                                <HotelIcon className="w-3.5 h-3.5 text-[#008972]" />
                                <span>Stay: <strong className="text-slate-900">{dayHotel.name}</strong> ({dayHotel.starRating}★)</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1.5 text-slate-500">
                                <HotelIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span>5★ Contracted Luxury Accommodation</span>
                              </div>
                            )}

                            <div className="flex items-center space-x-1 text-slate-600 font-medium">
                              <Utensils className="w-3 h-3 text-[#008972]" />
                              <span>Meals: {day.mealsIncluded?.breakfast ? 'Breakfast' : ''} {day.mealsIncluded?.lunch ? '• Lunch' : ''} {day.mealsIncluded?.dinner ? '• Dinner' : ''}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: INCLUSIONS & HIGHLIGHTS */}
          {activeTab === 'INCLUSIONS' && (
            <div className="space-y-6">
              {/* Highlights */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#008972]" />
                  <span>Key Experience Highlights</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(packageItem.highlights || [
                    'Skip-the-line VIP admissions to all imperial shrines and modern observation decks',
                    'High-speed Green Car Shinkansen / First-Class rail transit between all cities',
                    'Dedicated 24/7 bilingual ground operations duty manager dispatch',
                    'Mercedes S-Class private airport transfers and day touring chauffeurs'
                  ]).map((hl, idx) => (
                    <div key={idx} className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-start space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
                      <span className="text-xs font-semibold text-slate-800 leading-snug">{hl}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inclusions & Exclusions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center space-x-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Inclusions</span>
                  </h4>
                  <ul className="space-y-2">
                    {(packageItem.inclusions || [
                      'All hotel accommodations with daily buffet breakfast',
                      'Private chauffeur and airport transfers',
                      'All entrance tickets and guided tour fees',
                      'Rail passes with reserved seating'
                    ]).map((inc, i) => (
                      <li key={i} className="flex items-start space-x-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center space-x-1.5">
                    <X className="w-4 h-4 text-rose-600" />
                    <span>Exclusions</span>
                  </h4>
                  <ul className="space-y-2">
                    {(packageItem.exclusions || [
                      'International flights and airline taxes',
                      'Travel insurance and consular visa fees',
                      'Discretionary tipping and personal incidental expenses'
                    ]).map((exc, i) => (
                      <li key={i} className="flex items-start space-x-2 text-xs text-slate-700">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>{exc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOMMODATION ROSTER */}
          {activeTab === 'HOTELS' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Featured 5-Star Luxury Accommodations</h3>
                <p className="text-[11px] text-slate-500">
                  Pre-contracted hotel allotments with guaranteed room categories and daily breakfast.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(packageItem.hotelsSummary && packageItem.hotelsSummary.length > 0 
                  ? packageItem.hotelsSummary 
                  : [
                      { name: 'The Capitol Hotel Tokyu', cityName: 'Tokyo', nights: 3, roomType: 'Club Deluxe King Room', mealPlan: 'Bed & Breakfast' },
                      { name: 'The Ritz-Carlton Kyoto', cityName: 'Kyoto', nights: 2, roomType: 'Kamogawa River View Deluxe', mealPlan: 'Bed & Breakfast' }
                    ]
                ).map((hotel, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-bold uppercase">
                        {hotel.cityName} • {hotel.nights} Nights
                      </span>
                      <span className="text-[11px] font-bold text-amber-600">5★ Luxury</span>
                    </div>

                    <h4 className="font-black text-slate-900 text-sm">{hotel.name}</h4>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p>Room: <strong>{hotel.roomType}</strong></p>
                      <p>Meal Plan: <strong>{hotel.mealPlan || 'Bed & Breakfast'}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TERMS & POLICIES */}
          {activeTab === 'TERMS' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900">Cancellation Policy</h4>
                <p className="text-slate-600 leading-relaxed">
                  {packageItem.cancellationPolicy || 'Cancellations received up to 30 days prior to arrival are eligible for a 100% refund minus bank handling fees. Cancellations within 15-29 days forfeit 50% deposit. Cancellations under 14 days are non-refundable due to non-recoverable hotel allotments.'}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900">Terms & Conditions</h4>
                <p className="text-slate-600 leading-relaxed">
                  {packageItem.termsAndConditions || 'Rates are quoted in USD per person on double occupancy basis. All services are subject to confirmation at the time of deposit.'}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900">Important Travel Advisory</h4>
                <p className="text-slate-600 leading-relaxed">
                  {packageItem.importantInformation || 'Passport must be valid for a minimum of 6 months beyond the departure date. Visas must be arranged prior to departure if required for your nationality.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Bar */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              {isB2BAgent ? 'B2B Wholesale Price' : 'Total Package Price'}
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-black text-slate-900 font-mono">
                {formatCurrency(displayPrice, selectedCurrency)}
              </span>
              <span className="text-xs text-slate-500 font-medium">/ person</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs cursor-pointer"
            >
              Close
            </button>

            {isB2BAgent ? (
              <>
                {onInstantBook && (
                  <button
                    onClick={() => onInstantBook(packageItem)}
                    className="px-4 py-2.5 bg-[#008972] hover:bg-[#007360] text-white font-bold rounded-2xl text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Instant Book</span>
                  </button>
                )}
                {onCustomizePackage && (
                  <button
                    onClick={() => onCustomizePackage(packageItem)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-[#008972] text-white font-black rounded-2xl text-xs shadow-sm transition-all cursor-pointer flex items-center space-x-2"
                  >
                    <span>Customize Package Itinerary</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <>
                {onEnquirePackage && (
                  <button
                    onClick={() => onEnquirePackage(packageItem)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs transition-all cursor-pointer flex items-center space-x-1.5 border border-slate-200"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#008972]" />
                    <span>Enquire about Package</span>
                  </button>
                )}

                {onInstantBook && (
                  <button
                    onClick={() => onInstantBook(packageItem)}
                    className="px-5 py-2.5 bg-[#008972] hover:bg-[#007360] text-white font-black rounded-2xl text-xs shadow-sm transition-all cursor-pointer flex items-center space-x-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Book Package Now</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
