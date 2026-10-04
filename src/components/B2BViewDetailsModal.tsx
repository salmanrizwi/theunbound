import React, { useState, useMemo, useEffect } from 'react';
import { 
  Product, 
  Hotel, 
  B2BPackage, 
  CurrencyCode, 
  SUPPORTED_CURRENCIES, 
  HotelRoomType, 
  HotelRate, 
  MealPlanCode 
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { useRoster } from '../context/RosterContext';
import { formatCurrency, convertCurrency } from '../services/pricingEngine';
import { canUserAccessB2BInventory } from '../services/permissionEngine';
import { calculateHotelStayPrice, getMealPlanLabel, hotelToProduct } from '../utils/hotelHelpers';
import { RosterCalendarPicker } from './RosterCalendarPicker';
import { WishlistButton } from './WishlistButton';
import { RichTextRenderer } from './common/RichTextRenderer';
import { AppDatabase } from '../services/db';
import { 
  X, 
  MapPin, 
  Clock, 
  Calendar, 
  Star, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calculator, 
  Lock, 
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
  ChevronDown,
  ChevronUp,
  Bed,
  Coffee,
  Ship,
  Anchor,
  Globe2,
  Ticket,
  Compass
} from 'lucide-react';

interface B2BViewDetailsModalProps {
  product?: Product | null;
  hotel?: Hotel | null;
  packageItem?: B2BPackage | null;
  onClose: () => void;
  // Standard product callbacks
  onOpenCalculator?: (product: Product) => void;
  onBookProduct?: (product: Product, initialDate?: string, adults?: number, children?: number) => void;
  // Hotel callbacks
  onConfigureHotel?: (hotel: Hotel) => void;
  onInstantBookHotel?: (hotel: Hotel, roomType: HotelRoomType, rate: HotelRate, nights: number) => void;
  // Package callbacks
  onCustomizePackage?: (pkg: B2BPackage) => void;
  onInstantBookPackage?: (pkg: B2BPackage) => void;
  onEnquirePackage?: (pkg: B2BPackage) => void;
  hidePrice?: boolean;
}

export const B2BViewDetailsModal: React.FC<B2BViewDetailsModalProps> = ({
  product,
  hotel,
  packageItem,
  onClose,
  onOpenCalculator,
  onBookProduct,
  onConfigureHotel,
  onInstantBookHotel,
  onCustomizePackage,
  onInstantBookPackage,
  onEnquirePackage,
  hidePrice = false
}) => {
  const { user, isAuthenticated, openAuthModal, role } = useAuth();
  const { currency, setCurrency, addProductToQuote, items } = useQuotation();
  const { checkDateAvailability, getNextAvailableDate } = useRoster();
  const db = AppDatabase.getInstance();

  // Active Photo Index in Gallery
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  // Check Authorized Access
  const isAuthorized = canUserAccessB2BInventory(user).allowed;

  // 1. STANDARD PRODUCT STATE & CALCULATIONS
  const productStartingPrice = product ? convertCurrency(
    product.sellingPriceStartingFrom,
    product.currency,
    currency
  ) : 0;

  // 2. HOTEL STATE & CALCULATIONS
  const roomTypes = hotel?.roomTypes || [];
  const hotelStartingPrice = useMemo(() => {
    if (!hotel) return 0;
    const netConverted = convertCurrency(hotel.startingNetPrice || 400, hotel.currency || 'USD', currency);
    // Add typical 12% markup and 10% tax for buyer starting estimation
    return Math.round(netConverted * 1.12 * 1.1);
  }, [hotel, currency]);

  // 3. PACKAGE STATE & CALCULATIONS
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [packageTab, setPackageTab] = useState<'ITINERARY' | 'INCLUSIONS' | 'HOTELS' | 'TERMS'>('ITINERARY');

  const packageDurationText = packageItem 
    ? `${packageItem.durationNights || (packageItem.durationDays - 1)} Nights / ${packageItem.durationDays} Days`
    : '';

  const packageDisplayPrice = useMemo(() => {
    if (!packageItem) return 0;
    const netCost = packageItem.baseNetCostUSD || 2500;
    const retailPrice = packageItem.suggestedSellingPriceUSD || Math.round(netCost * 1.3);
    const b2bAgentPrice = Math.round(netCost * (1 + (packageItem.pricingConfiguration?.b2bMarkupPercent || 12) / 100));
    const priceUSD = role === 'B2B_AGENT' || role === 'AGENT' || role === 'ADMIN' ? b2bAgentPrice : retailPrice;
    return convertCurrency(priceUSD, 'USD', currency);
  }, [packageItem, role, currency]);

  // Clean State Reset on Item Switch
  useEffect(() => {
    setActiveImageIdx(0);
    setCopiedLink(false);
  }, [product?.id, hotel?.id, packageItem?.id]);

  // Handle Share Link
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Guard: Unauthorized State Renderer
  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="relative bg-white rounded-3xl max-w-lg w-full p-8 text-center space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">Authorised B2B Agent Access Only</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              This inventory is available exclusively to authorised B2B Agents. Please log in or register as a B2B Agent to continue.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                onClose();
                openAuthModal('Sign in to access B2B inventory.');
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Login as B2B Agent</span>
            </button>
            <button
              onClick={() => {
                onClose();
                openAuthModal('Register your agency to unlock wholesale inventory.');
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-[#00C6A6]" />
              <span>Register Agency</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Resolve active properties based on modal target
  const name = product?.name || hotel?.name || packageItem?.title || 'Unknown Product';
  const category = product?.category || (hotel ? 'Hotel' : 'Package Circuit');
  const destination = product?.destinationName || hotel?.city || packageItem?.destinationName || 'Global';
  const hub = product?.city || hotel?.country || '';

  const images = useMemo(() => {
    if (product?.images && product.images.length > 0) return product.images;
    if (hotel?.images && hotel.images.length > 0) return hotel.images;
    if (hotel?.heroImage) return [hotel.heroImage];
    if (packageItem?.heroImage) return [packageItem.heroImage];
    if (packageItem?.images && packageItem.images.length > 0) return packageItem.images;
    return ['https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1200'];
  }, [product, hotel, packageItem]);

  const defaultImage = 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1200';

  // Standard Product handlers
  const handleConfigureProduct = () => {
    if (!product || !onOpenCalculator) return;
    onClose();
    onOpenCalculator(product);
  };

  const handleConfigureHotel = () => {
    if (!hotel || !onConfigureHotel) return;
    onClose();
    onConfigureHotel(hotel);
  };

  const handleConfigurePackage = () => {
    if (!packageItem || !onCustomizePackage) return;
    onClose();
    onCustomizePackage(packageItem);
  };

  // Icons Helper
  const getCategoryIcon = (cat: string) => {
    if (cat.includes('Tour')) return <Compass className="w-4 h-4 text-[#00C6A6]" />;
    if (cat.includes('Transfer')) return <Navigation className="w-4 h-4 text-[#00C6A6]" />;
    if (cat.includes('Ticket')) return <Ticket className="w-4 h-4 text-[#00C6A6]" />;
    if (cat.includes('Hotel')) return <Building2 className="w-4 h-4 text-[#00C6A6]" />;
    if (cat.includes('Yacht')) return <Ship className="w-4 h-4 text-[#00C6A6]" />;
    if (cat.includes('Ferry')) return <Anchor className="w-4 h-4 text-[#00C6A6]" />;
    return <Sparkles className="w-4 h-4 text-[#00C6A6]" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        id="b2b-view-details-modal"
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 max-w-6xl w-full overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
      >
        {/* 1. FIXED HEADER */}
        <div className="bg-white text-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-200/80 shrink-0">
          <div className="truncate pr-4 space-y-0.5">
            <h1 className="text-sm sm:text-lg font-black text-slate-900 truncate leading-tight">
              {name}
            </h1>
            <div className="flex items-center gap-2 text-slate-500 text-[11px] sm:text-xs">
              <span className="font-bold text-[#008972] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">{category}</span>
              <span>·</span>
              <span className="font-medium text-slate-600">{destination}</span>
              {hub && (
                <>
                  <span>·</span>
                  <span className="text-slate-500">{hub}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Currency Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2 sm:px-2.5 py-1 text-xs text-slate-700 shadow-2xs">
              <Globe2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
              <select
                id="details-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer pr-1"
                title="Change display currency"
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-white text-slate-800">
                    {c.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Share link button */}
            <button
              onClick={handleShare}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200/80 px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors cursor-pointer active:scale-95 font-medium border border-slate-200/60"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
              <span className="hidden sm:inline">{copiedLink ? 'Link Copied' : 'Share'}</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer active:scale-95 border border-slate-200/80"
              title="Close Modal"
              aria-label="Close Modal"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* 2. SCROLLABLE CONTENT BODY */}
        <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-[#F8FAFA]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            
            {/* LEFT COLUMN: Media Area, Summary & Descriptions */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              
              {/* Image Area with Gallery Grid */}
              <div className="space-y-2">
                <div className="aspect-16/10 sm:aspect-16/8 w-full rounded-2xl overflow-hidden bg-slate-100 relative shadow-inner border border-slate-200/80">
                  <img
                    src={images[activeImageIdx] || defaultImage}
                    alt={name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = defaultImage;
                    }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] sm:text-xs px-2.5 py-1 rounded-xl font-medium">
                    Photo {activeImageIdx + 1} of {images.length}
                  </div>
                </div>

                {images.length > 1 && (
                  <div className="flex items-center space-x-2 overflow-x-auto py-1 no-scrollbar">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIdx(idx)}
                        className={`relative w-16 h-11 sm:w-20 sm:h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                          activeImageIdx === idx ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/30' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt={`thumbnail-${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary Description Box */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#008972] border-b border-slate-100 pb-2">
                  {getCategoryIcon(category)}
                  <span>Overview & Specifications</span>
                </div>
                
                {product && (
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
                    {product.shortDescription || 'A professionally curated travel service delivering comfort, flexibility, and direct local coordination.'}
                  </p>
                )}
                {hotel && (
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
                    {hotel.description || `${hotel.name} offers premium luxury rooms, standard amenities, and direct wholesale B2B rate plan allocations.`}
                  </p>
                )}
                {packageItem && (
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
                    {packageItem.tagline || packageItem.description || 'Pre-designed high-fidelity multi-city circuit configured with premium hotels, transfers, and excursions.'}
                  </p>
                )}

                {/* Rich Text long description rendering */}
                {(product?.longDescription || hotel?.description || packageItem?.description) && (
                  <div className="pt-2">
                    <RichTextRenderer 
                      content={product?.longDescription || hotel?.description || packageItem?.description || ''} 
                      className="text-xs sm:text-sm text-slate-700 space-y-3 leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* PACKAGE SPECIFIC TABS FOR ITINERARY & HOTELS */}
              {packageItem && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="flex border-b border-slate-100 bg-slate-50/50">
                    {[
                      { id: 'ITINERARY', label: 'Day Itinerary', icon: Calendar },
                      { id: 'INCLUSIONS', label: 'Inclusions & Exclusions', icon: CheckCircle2 },
                      { id: 'HOTELS', label: 'Accommodations', icon: Bed }
                    ].map(t => {
                      const Icon = t.icon;
                      const isActive = packageTab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPackageTab(t.id as any)}
                          className={`flex items-center space-x-1.5 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                            isActive
                              ? 'border-[#008972] text-[#008972] bg-white'
                              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-4 space-y-4">
                    {packageTab === 'ITINERARY' && (
                      <div className="space-y-3">
                        {(packageItem.days || []).map((day, idx) => {
                          const isExpanded = expandedDay === day.dayNumber;
                          return (
                            <div key={idx} className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
                              <button
                                type="button"
                                onClick={() => setExpandedDay(isExpanded ? null : day.dayNumber)}
                                className="w-full px-4 py-3 flex items-center justify-between text-left font-bold text-slate-800 hover:bg-slate-100/50 transition-colors"
                              >
                                <span>Day {day.dayNumber}: {day.title}</span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {isExpanded && (
                                <div className="p-4 border-t border-slate-100 bg-white space-y-3">
                                  <p className="text-slate-600 leading-relaxed">{day.description}</p>
                                  {day.excursionIds && day.dayNumber === 1 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-slate-500">
                                        Included Excursions
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {packageTab === 'INCLUSIONS' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                          <span className="font-bold text-emerald-900 block mb-2">Package Inclusions</span>
                          <ul className="space-y-1.5 text-emerald-800 list-disc pl-4 leading-relaxed">
                            {(packageItem.inclusions || []).map((inc, idx) => <li key={idx}>{inc}</li>)}
                          </ul>
                        </div>
                        <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                          <span className="font-bold text-rose-900 block mb-2">Package Exclusions</span>
                          <ul className="space-y-1.5 text-rose-800 list-disc pl-4 leading-relaxed">
                            {(packageItem.exclusions || []).map((exc, idx) => <li key={idx}>{exc}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}

                    {packageTab === 'HOTELS' && (
                      <div className="space-y-3">
                        {(packageItem.hotelRoster || []).map((rost, idx) => {
                          return (
                            <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                              <div className="flex items-center space-x-3">
                                <Building2 className="w-5 h-5 text-slate-400" />
                                <div>
                                  <span className="font-bold text-slate-800">{rost.hotelName}</span>
                                  <span className="text-[10px] text-slate-500 block">Hub ID: {rost.hubId || 'Tokyo'} • Nights: {rost.nights || 1}</span>
                                </div>
                              </div>
                              <span className="text-[10px] bg-teal-50 text-[#008972] border border-[#00C6A6]/20 px-2 py-0.5 rounded-full font-bold">
                                {rost.roomCategory || 'Standard Room'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Standard product inclusions */}
              {product && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(product.inclusions || []).length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Included Services</span>
                      </div>
                      <ul className="space-y-2 text-slate-700 leading-relaxed list-disc pl-4 font-medium">
                        {product.inclusions.map((inc, i) => <li key={i}>{inc}</li>)}
                      </ul>
                    </div>
                  )}

                  {(product.exclusions || []).length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                      <div className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center space-x-1.5">
                        <XCircle className="w-4 h-4 text-rose-500" />
                        <span>Excluded Items</span>
                      </div>
                      <ul className="space-y-2 text-slate-700 leading-relaxed list-disc pl-4 font-medium">
                        {product.exclusions.map((exc, i) => <li key={i}>{exc}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Important Logistics Details */}
              {(product?.meetingPoint || product?.cancellationPolicy || hotel?.checkInHours || packageItem?.termsAndConditions) && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center space-x-1.5 border-b border-slate-100 pb-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Important Information & Policies</span>
                  </div>

                  {product?.meetingPoint && (
                    <div>
                      <span className="font-bold text-slate-800 block">Meeting Point & Pickup:</span>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{product.meetingPoint}</p>
                    </div>
                  )}

                  {product?.cancellationPolicy && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="font-bold text-slate-800 block">Cancellation Policy:</span>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{product.cancellationPolicy}</p>
                    </div>
                  )}

                  {hotel && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-bold text-slate-800 block">Check-In Hours:</span>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">{hotel.checkInHours || 'From 15:00 PM'}</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block">Check-Out Hours:</span>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">{hotel.checkOutHours || 'Until 11:00 AM'}</p>
                      </div>
                    </div>
                  )}

                  {packageItem?.termsAndConditions && (
                    <div>
                      <span className="font-bold text-slate-800 block">Terms & Conditions:</span>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{packageItem.termsAndConditions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Read-Only Service Specifications & Action Panel */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              <div className="bg-white text-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm sticky top-4 border border-slate-200/90">
                
                {/* A. Display Price */}
                <div className="mb-4">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#008972] block mb-1">
                    Partner Rate Display
                  </span>
                  
                  {hidePrice ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-600">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5 mb-0.5">
                        <Lock className="w-3.5 h-3.5 text-[#008972]" />
                        <span>Wholesale Rate Protected</span>
                      </p>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Partner agent rates are automatically applied upon configuring and adding to day quotation.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono tabular-nums">
                          {product && productStartingPrice > 0 && formatCurrency(productStartingPrice, currency)}
                          {product && productStartingPrice <= 0 && 'Configure to see Price'}
                          {hotel && hotelStartingPrice > 0 && formatCurrency(hotelStartingPrice, currency)}
                          {hotel && hotelStartingPrice <= 0 && 'Configure to see Price'}
                          {packageItem && formatCurrency(packageDisplayPrice, currency)}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">
                          {product && productStartingPrice > 0 && '/ Guest'}
                          {hotel && hotelStartingPrice > 0 && '/ Starting Night'}
                          {packageItem && '/ Pax'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* B. CATEGORY-SPECIFIC GENERAL SPECIFICATIONS (Strictly Read-Only) */}
                <div className="space-y-3 pt-4 border-t border-slate-100 mb-6 text-xs text-slate-600">
                  <div className="font-bold text-[#008972] text-[10px] uppercase tracking-wider mb-2">
                    General Service Specifications
                  </div>

                  {product && (
                    <div className="space-y-2.5">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Standard Capacity:</span>
                        <span className="font-bold text-slate-900">Up to {product.maxPax || 15} Guests</span>
                      </div>
                      
                      {product.category?.includes('Transfer') && (
                        <>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Transfer Route:</span>
                            <span className="font-bold text-slate-900">{product.routeType || 'Airport ↔ Destination Hotel'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Executive Asset:</span>
                            <span className="font-bold text-slate-900">{product.vehicleConfig?.name || 'Luxury Alphard MPV'}</span>
                          </div>
                          {product.vehicleConfig?.luggageCapacity && (
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                              <span className="text-slate-500">Luggage Allowance:</span>
                              <span className="font-bold text-slate-900">{product.vehicleConfig.luggageCapacity} Bags</span>
                            </div>
                          )}
                        </>
                      )}

                      {product.category?.includes('Tour') && (
                        <>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Tour Duration:</span>
                            <span className="font-bold text-slate-900">{product.durationHours || 4} Hours</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Guide Accompany:</span>
                            <span className="font-bold text-slate-900">{product.guideConfig?.guideType ? 'Private English Docent' : 'Professional Chauffeur Only'}</span>
                          </div>
                        </>
                      )}

                      {product.category?.includes('Yacht') && (
                        <>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Yacht Asset:</span>
                            <span className="font-bold text-slate-900">{product.yachtConfig?.name || 'Luxury Motor Yacht'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Yacht Length:</span>
                            <span className="font-bold text-slate-900">{product.yachtConfig?.length || '66 ft'}</span>
                          </div>
                        </>
                      )}

                      {product.category?.includes('Ferry') && (
                        <>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Transit Ports:</span>
                            <span className="font-bold text-slate-900">{product.ferryConfig?.departurePort || 'Tokyo'} ↔ {product.ferryConfig?.arrivalPort || 'Kyoto'}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Vessel Class:</span>
                            <span className="font-bold text-slate-900">{product.ferryConfig?.name || 'Standard Ferry Liner'}</span>
                          </div>
                        </>
                      )}

                      {product.category?.includes('Visa') && (
                        <>
                          <div className="flex justify-between border-b border-slate-100 pb-2">
                            <span className="text-slate-500">Processing Time:</span>
                            <span className="font-bold text-slate-900">{product.processingTimeDays || 5} Business Days</span>
                          </div>
                          {product.expressProcessingAvailable && (
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                              <span className="text-slate-500">Express Option:</span>
                              <span className="font-bold text-slate-900">Yes ({product.expressProcessingTimeDays || 2} Days)</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {hotel && (
                    <div className="space-y-2.5">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Star Rating:</span>
                        <span className="font-bold text-slate-900">{hotel.starRating || 5} Star Luxury</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Location Address:</span>
                        <span className="font-bold text-slate-900 truncate max-w-[180px]">{hotel.address || hotel.city}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Room Categories:</span>
                        <span className="font-bold text-slate-900">{hotel.roomTypes?.length || 1} Types Available</span>
                      </div>
                    </div>
                  )}

                  {packageItem && (
                    <div className="space-y-2.5">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Days / Nights:</span>
                        <span className="font-bold text-slate-900">{packageDurationText}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Tour Style:</span>
                        <span className="font-bold text-slate-900">{packageItem.tripType || 'Premium Custom Circuit'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Total Cities:</span>
                        <span className="font-bold text-slate-900">{(packageItem.routeSummary || []).length} hubs</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* C. LOWER CTAs */}
                <div className="space-y-2.5">
                  {/* Standard Products */}
                  {product && onOpenCalculator && (
                    <button
                      onClick={handleConfigureProduct}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md bg-[#00C6A6] hover:bg-[#00b094] text-white font-extrabold cursor-pointer hover:scale-102 shadow-[#00C6A6]/20 flex items-center justify-center space-x-2"
                    >
                      <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
                      <span>Configure & Add to Quote</span>
                    </button>
                  )}

                  {/* Hotels */}
                  {hotel && onConfigureHotel && (
                    <button
                      onClick={handleConfigureHotel}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md bg-[#00C6A6] hover:bg-[#00b094] text-white font-extrabold cursor-pointer hover:scale-102 shadow-[#00C6A6]/20 flex items-center justify-center space-x-2"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Configure & Add to Quote</span>
                    </button>
                  )}

                  {/* B2B Packages */}
                  {packageItem && onCustomizePackage && (
                    <button
                      onClick={handleConfigurePackage}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md bg-[#00C6A6] hover:bg-[#00b094] text-white font-extrabold cursor-pointer hover:scale-102 shadow-[#00C6A6]/20 flex items-center justify-center space-x-2"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Customize Circuit & Import</span>
                    </button>
                  )}

                  {/* Standard Wishlist Anchor */}
                  {product && (
                    <div className="pt-1">
                      <WishlistButton product={product} variant="button" />
                    </div>
                  )}
                </div>

                {/* Confidential Admin contract margin info */}
                {(role === 'ADMIN' || role === 'DMC_STAFF') && (
                  <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[10px] space-y-1">
                    <p className="font-bold text-[#008972] uppercase tracking-wider flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Confidential DMC Internals</span>
                    </p>
                    <p className="text-slate-600">
                      {product && `Contracted Net Adult: ${formatCurrency(product.adultNetPrice, product.currency)} (Margin: ${product.defaultMarkupPercent}%)`}
                      {packageItem && `Base Net Cost: ${formatCurrency(packageItem.baseNetCostUSD || 2500, 'USD')} (B2B Markup: ${packageItem.pricingConfiguration?.b2bMarkupPercent || 12}%)`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. FIXED ACTIONS FOOTER */}
        <div className="bg-white text-slate-800 px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-200/80 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-500 font-semibold hidden sm:block">
            {product && `${product.category} · Service Details Reference`}
            {hotel && `${hotel.starRating || 5} Star Hotel · Location Info`}
            {packageItem && `Itinerary Circuit: ${packageDurationText}`}
          </div>
          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-2xs"
            >
              Close Details
            </button>
            
            {/* Primary Action Replication */}
            {product && onOpenCalculator && (
              <button
                onClick={handleConfigureProduct}
                className="px-4 py-2 rounded-xl text-xs bg-[#00C6A6] hover:bg-[#00b094] text-white font-bold cursor-pointer transition-all shadow-xs shadow-[#00C6A6]/20"
              >
                Configure & Add to Quote
              </button>
            )}

            {hotel && onConfigureHotel && (
              <button
                onClick={handleConfigureHotel}
                className="px-4 py-2 rounded-xl text-xs bg-[#00C6A6] hover:bg-[#00b094] text-white font-bold cursor-pointer transition-all shadow-xs shadow-[#00C6A6]/20"
              >
                Configure & Add to Quote
              </button>
            )}

            {packageItem && onCustomizePackage && (
              <button
                onClick={handleConfigurePackage}
                className="px-4 py-2 rounded-xl text-xs bg-[#00C6A6] hover:bg-[#00b094] text-white font-bold cursor-pointer transition-all shadow-xs shadow-[#00C6A6]/20"
              >
                Customize Circuit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
