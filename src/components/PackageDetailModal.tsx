import React, { useState, useMemo, useEffect } from 'react';
import {
  B2BPackage,
  CurrencyCode,
  SUPPORTED_CURRENCIES,
  Product,
  Hotel
} from '../types';
import { AppDatabase } from '../services/db';
import { calculatePackagePrice, formatCurrency } from '../services/pricingEngine';
import { canUserViewInternalCostBreakdown } from '../services/permissionEngine';
import { canonicalImageService } from '../services/imageService';
import {
  cleanPackageText,
  normalizePackageRecord,
  resolvePackageOrderedHubs
} from '../services/packageToQuoteTransformer';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { RichTextRenderer } from './common/RichTextRenderer';
import {
  X,
  MapPin,
  Calendar,
  CheckCircle2,
  Sparkles,
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
  Check,
  Info,
  MessageSquare,
  Globe2,
  Train,
  AlertCircle
} from 'lucide-react';

interface PackageDetailModalProps {
  packageItem: B2BPackage;
  onClose: () => void;
  onCustomizePackage?: (pkg: B2BPackage) => void;
  onInstantBook?: (pkg: B2BPackage) => void;
  onEnquirePackage?: (pkg: B2BPackage) => void;
}

export const PackageDetailModal: React.FC<PackageDetailModalProps> = ({
  packageItem: initialPackageItem,
  onClose,
  onCustomizePackage,
  onInstantBook,
  onEnquirePackage
}) => {
  const { user } = useAuth();
  const { currency: quoteCurrency } = useQuotation();
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

  // Always resolve the latest authoritative package record from db
  const packageItem = useMemo(() => {
    const latest = db.getPackageById(initialPackageItem.id);
    return normalizePackageRecord(latest || initialPackageItem);
  }, [db, initialPackageItem, dbTick]);

  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(
    (quoteCurrency as CurrencyCode) || packageItem.currency || 'USD'
  );
  const [expandedDay, setExpandedDay] = useState<number | null>(-1); // Expand all by default for full inspection
  const [activeTab, setActiveTab] = useState<'ITINERARY' | 'OVERVIEW' | 'INCLUSIONS' | 'HOTELS' | 'TERMS'>('ITINERARY');
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const isB2BAgent =
    user && (user.role === 'B2B_AGENT' || user.role === 'AGENT' || user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF');
  const canViewInternalCosts = canUserViewInternalCostBreakdown(user);

  const durationText = `${packageItem.durationDays} Days / ${packageItem.durationNights} Nights`;

  // Authoritative pricing calculation via centralized pricingEngine
  const pricingResult = useMemo(() => {
    return calculatePackagePrice({
      packageItem,
      userRole: user?.role || 'B2B_AGENT',
      targetCurrency: selectedCurrency,
      user
    });
  }, [packageItem, user, selectedCurrency]);

  // Ordered hubs strictly from the package configuration
  const orderedHubs = useMemo(() => resolvePackageOrderedHubs(packageItem), [packageItem]);

  // Master products and hotels for resolving linked IDs
  const masterProducts = useMemo(() => db.getProducts(), [db, dbTick]);
  const masterHotels = useMemo(() => db.getHotels(), [db, dbTick]);

  // Package Gallery Images
  const galleryImages = useMemo(() => {
    const primary = canonicalImageService.resolvePackageImage(packageItem);
    const rawList = [
      ...(packageItem.heroImage ? [packageItem.heroImage] : []),
      ...(packageItem.galleryImages || []),
      ...((packageItem as any).images || [])
    ]
      .map(img => canonicalImageService.resolveImageUrl(img, packageItem.destinationName || 'Japan'))
      .filter(Boolean);
    const unique = Array.from(new Set([primary, ...rawList])).filter(Boolean);
    return unique.length > 0 ? unique : [primary];
  }, [packageItem, dbTick]);

  // Configured Accommodations (only actual configured hotels — never invent placeholders)
  const configuredAccommodations = useMemo(() => {
    const list: Array<{
      name: string;
      cityName: string;
      nights: number;
      roomType: string;
      mealPlan: string;
      starRating?: number;
      isManual?: boolean;
    }> = [];

    if (packageItem.isLandOnly) return list;

    if (Array.isArray(packageItem.hotelsSummary) && packageItem.hotelsSummary.length > 0) {
      packageItem.hotelsSummary.forEach(hs => {
        if (!hs || !hs.name) return;
        const matched = masterHotels.find(
          h => (hs.hotelId && h.id === hs.hotelId) || (h.name || '').toLowerCase() === hs.name.toLowerCase()
        );
        list.push({
          name: hs.name,
          cityName: hs.cityName || matched?.cityName || matched?.city || packageItem.destinationName,
          nights: hs.nights || 1,
          roomType: hs.roomType || matched?.roomTypes?.[0]?.roomName || 'Configured Room',
          mealPlan: hs.mealPlan || 'As Configured',
          starRating: matched?.starRating
        });
      });
    } else if (Array.isArray(packageItem.hotelReferences) && packageItem.hotelReferences.length > 0) {
      packageItem.hotelReferences.forEach(hr => {
        const matched = masterHotels.find(h => h.id === hr.hotelId);
        const name = hr.hotelName || matched?.name;
        if (!name) return;
        list.push({
          name,
          cityName: hr.hubName || matched?.cityName || matched?.city || packageItem.destinationName,
          nights: hr.nights || 1,
          roomType: hr.roomTypeName || matched?.roomTypes?.find(r => r.id === hr.roomTypeId)?.roomName || 'Configured Room',
          mealPlan: hr.mealPlanCode || 'As Configured',
          starRating: matched?.starRating
        });
      });
    }

    if (Array.isArray(packageItem.manualHotels) && packageItem.manualHotels.length > 0) {
      packageItem.manualHotels.forEach(mh => {
        if (!mh || !mh.hotelName) return;
        list.push({
          name: mh.hotelName,
          cityName: mh.city || packageItem.destinationName,
          nights: mh.numberOfNights || 1,
          roomType: mh.roomType || 'Standard Room',
          mealPlan: mh.mealPlanName || mh.mealPlan || 'As Configured',
          starRating: mh.starRating,
          isManual: true
        });
      });
    }

    // Also check day-level hotels if not already in list
    if (list.length === 0 && Array.isArray(packageItem.itinerary)) {
      packageItem.itinerary.forEach(day => {
        if (!day.hotelId && !day.hotelName) return;
        const matched = day.hotelId ? masterHotels.find(h => h.id === day.hotelId) : undefined;
        const hName = day.hotelName || matched?.name;
        if (!hName) return;
        const existing = list.find(item => item.name.toLowerCase() === hName.toLowerCase());
        if (existing) {
          existing.nights += 1;
        } else {
          list.push({
            name: hName,
            cityName: day.hubName || matched?.cityName || matched?.city || packageItem.destinationName,
            nights: 1,
            roomType: matched?.roomTypes?.find(r => r.id === day.roomTypeId)?.roomName || 'Configured Room',
            mealPlan: day.mealPlan || 'As Configured',
            starRating: matched?.starRating
          });
        }
      });
    }

    return list;
  }, [packageItem, masterHotels]);

  // All configured products/services across package
  const configuredServices = useMemo(() => {
    const ids = new Set<string>(packageItem.productIds || []);
    (packageItem.itinerary || []).forEach(d => {
      (d.productIds || []).forEach(id => ids.add(id));
      if (d.transferId) ids.add(d.transferId);
      if (d.railId) ids.add(d.railId);
    });
    return Array.from(ids)
      .map(id => masterProducts.find(p => p.id === id || p.product_id === id || p.sku === id))
      .filter((p): p is Product => Boolean(p));
  }, [packageItem, masterProducts]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-5xl w-full my-auto shadow-2xl border border-slate-200 flex flex-col max-h-[94dvh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Hero Section */}
        <div className="relative h-48 sm:h-72 w-full overflow-hidden bg-slate-900 shrink-0">
          <img
            src={galleryImages[activeImageIdx] || galleryImages[0]}
            alt={packageItem.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={e => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-black/30" />

          {/* Top Right Controls: Currency + Close */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 bg-black/55 backdrop-blur-md border border-white/20 rounded-full px-3 py-1 text-xs text-white">
              <Globe2 className="w-3.5 h-3.5 text-[#00C6A6]" />
              <select
                value={selectedCurrency}
                onChange={e => setSelectedCurrency(e.target.value as CurrencyCode)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                    {c.code}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer border border-white/15"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Top Left Badges */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-[calc(100%-9rem)]">
            <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-[#008972] text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-xs">
              <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{packageItem.destinationName}</span>
            </span>

            <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
              {packageItem.tripType || 'CULTURAL'} • {durationText}
            </span>

            {packageItem.isLandOnly ? (
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-purple-500 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-xs">
                Land-Only Package
              </span>
            ) : (
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-400 text-slate-950 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                Published B2B Package
              </span>
            )}
          </div>

          {/* Hero Bottom Overlay */}
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-6 sm:right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-white">
            <div className="max-w-2xl">
              <h1 className="text-lg sm:text-2xl font-black text-white leading-tight drop-shadow-md">
                {packageItem.title}
              </h1>
              {packageItem.tagline && (
                <p className="text-[11px] sm:text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed">
                  {cleanPackageText(packageItem.tagline)}
                </p>
              )}
            </div>

            {galleryImages.length > 1 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 shrink-0">
                {galleryImages.slice(0, 5).map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImageIdx(i)}
                    className={`w-12 h-8 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                      activeImageIdx === i ? 'border-[#00C6A6] scale-105' : 'border-white/30 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Hubs Route Ribbon (only actual configured hubs in saved order) */}
        <div className="bg-slate-900 px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center space-x-2 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Selected Hubs ({orderedHubs.length}):
            </span>
            <div className="flex items-center space-x-1.5 shrink-0">
              {orderedHubs.map((hub, i) => (
                <React.Fragment key={`${hub.hubId}-${i}`}>
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-xs font-bold text-[#00C6A6] border border-slate-700">
                    {hub.hubName} ({hub.nights}N)
                  </span>
                  {i < orderedHubs.length - 1 && (
                    <span className="text-slate-500 font-black text-xs">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4 shrink-0">
            {canViewInternalCosts && pricingResult.internalAudit && (
              <div className="text-right hidden md:block">
                <span className="text-[9px] uppercase text-slate-400 font-bold block">
                  Internal Nett Cost
                </span>
                <span className="text-sm font-bold text-slate-300 font-mono">
                  {formatCurrency(pricingResult.internalAudit.totalNetCostTarget, selectedCurrency)}
                </span>
              </div>
            )}
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                Final Selling Price
              </span>
              <span className="text-base font-black text-[#00C6A6] font-mono">
                {formatCurrency(pricingResult.pricePerPerson, selectedCurrency)}{' '}
                <span className="text-[10px] text-slate-300 font-sans font-normal">/ person</span>
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="px-6 bg-slate-50 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto shrink-0">
          {[
            { id: 'ITINERARY', label: `Day-Wise Itinerary (${(packageItem.itinerary || []).length})`, icon: Calendar },
            { id: 'OVERVIEW', label: 'Overview & Services', icon: Layers },
            { id: 'INCLUSIONS', label: 'Inclusions & Exclusions', icon: CheckCircle2 },
            { id: 'HOTELS', label: 'Accommodations', icon: HotelIcon },
            { id: 'TERMS', label: 'Important Info & Terms', icon: ShieldCheck }
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
          {/* TAB 1: DAY-WISE ITINERARY */}
          {activeTab === 'ITINERARY' && (
            <div className="space-y-4">
              {/* Overview & Description Banner */}
              {(packageItem.description || packageItem.tagline) && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#008972] flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>Package Overview</span>
                  </div>
                  <RichTextRenderer
                    content={packageItem.description || packageItem.tagline || ''}
                    className="text-xs text-slate-700 leading-relaxed"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Configured Day-by-Day Itinerary ({(packageItem.itinerary || []).length} Days)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Complete day-wise schedule, activities, transfers, accommodations, and meal inclusions saved in this package.
                  </p>
                </div>
                {(packageItem.itinerary || []).length > 0 && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setExpandedDay(null)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer"
                    >
                      Collapse All
                    </button>
                    <button
                      onClick={() => setExpandedDay(-1)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer"
                    >
                      Expand All
                    </button>
                  </div>
                )}
              </div>

              {(packageItem.itinerary || []).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
                  No day-by-day itinerary items have been configured for this package yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {(packageItem.itinerary || []).map((day, idx) => {
                    const isExpanded = expandedDay === -1 || expandedDay === day.dayNumber;
                    const dayProdIdSet = new Set<string>([
                      ...(day.productIds || []),
                      ...(day.transferId ? [day.transferId] : []),
                      ...(day.railId ? [day.railId] : [])
                    ]);
                    const dayProducts = Array.from(dayProdIdSet)
                      .map(pid => masterProducts.find(p => p.id === pid || p.product_id === pid || p.sku === pid))
                      .filter((p): p is Product => Boolean(p));

                    const dayHotel: Hotel | undefined = day.hotelId
                      ? masterHotels.find(h => h.id === day.hotelId)
                      : day.hotelName
                        ? masterHotels.find(h => (h.name || '').toLowerCase() === day.hotelName!.toLowerCase())
                        : undefined;

                    const resolvedHotelName = day.hotelName || dayHotel?.name;
                    const resolvedHubName =
                      day.hubName ||
                      orderedHubs.find(h => h.hubId === day.hubId)?.hubName ||
                      '';

                    const mealsList: string[] = [];
                    if (day.mealsIncluded?.breakfast) mealsList.push('Breakfast');
                    if (day.mealsIncluded?.lunch) mealsList.push('Lunch');
                    if (day.mealsIncluded?.dinner) mealsList.push('Dinner');
                    if (mealsList.length === 0 && day.mealPlan) mealsList.push(day.mealPlan);

                    return (
                      <div
                        key={`${day.dayNumber}-${idx}`}
                        className="bg-slate-50 rounded-2xl border border-slate-200/90 overflow-hidden transition-all"
                      >
                        {/* Day Header Bar */}
                        <button
                          onClick={() =>
                            setExpandedDay(isExpanded && expandedDay !== -1 ? null : day.dayNumber)
                          }
                          className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="w-7 h-7 rounded-xl bg-[#008972] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                              {day.dayNumber}
                            </span>
                            <div>
                              <span className="font-black text-slate-900 text-xs sm:text-sm block">
                                Day {day.dayNumber}: {cleanPackageText(day.title)}
                              </span>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                {resolvedHubName && (
                                  <span className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1">
                                    <MapPin className="w-2.5 h-2.5 text-[#008972]" />
                                    <span>{resolvedHubName}</span>
                                  </span>
                                )}
                                {dayProducts.length > 0 && (
                                  <span className="text-[10px] text-indigo-600 font-bold">
                                    • {dayProducts.length} {dayProducts.length === 1 ? 'Service' : 'Services'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            {mealsList.length > 0 && (
                              <div className="hidden sm:flex items-center space-x-1 text-[10px] text-slate-600 font-bold">
                                {mealsList.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="px-2 py-0.5 bg-white rounded-md border border-slate-200"
                                  >
                                    {m}
                                  </span>
                                ))}
                              </div>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {/* Day Expanded Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 space-y-3 border-t border-slate-200/60 bg-white">
                            {day.description ? (
                              <RichTextRenderer
                                content={day.description}
                                className="text-xs text-slate-700 leading-relaxed"
                              />
                            ) : (
                              <p className="text-xs text-slate-400 italic">
                                No narrative description provided for this day.
                              </p>
                            )}

                            {/* Day Activities, Transfers & Services */}
                            {dayProducts.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Configured Activities, Transfers & Services:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {dayProducts.map(prod => {
                                    const isTransfer = (prod.category || '').toLowerCase().includes('transfer');
                                    const isRail = (prod.category || '').toLowerCase().includes('rail');
                                    return (
                                      <div
                                        key={prod.id}
                                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-2.5"
                                      >
                                        {isTransfer ? (
                                          <Car className="w-4 h-4 text-amber-600 shrink-0" />
                                        ) : isRail ? (
                                          <Train className="w-4 h-4 text-indigo-600 shrink-0" />
                                        ) : (
                                          <Compass className="w-4 h-4 text-[#008972] shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                          <span className="font-bold text-slate-800 text-[11px] block truncate">
                                            {prod.name}
                                          </span>
                                          <span className="text-[10px] text-slate-500">
                                            {prod.category}
                                            {prod.city ? ` • ${prod.city}` : ''}
                                            {prod.duration ? ` • ${prod.duration}` : ''}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Operational Notes if present */}
                            {(day.operationalNotes || day.notes) && (
                              <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900">
                                <span className="font-bold">Operational Notes: </span>
                                <span>{cleanPackageText(day.operationalNotes || day.notes)}</span>
                              </div>
                            )}

                            {/* Accommodation & Meals Strip (only if configured) */}
                            {(resolvedHotelName || mealsList.length > 0 || day.guideIncluded || day.freeTime) && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                                <div className="flex flex-wrap items-center gap-3">
                                  {resolvedHotelName && !packageItem.isLandOnly && (
                                    <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
                                      <HotelIcon className="w-3.5 h-3.5 text-[#008972]" />
                                      <span>
                                        Stay: <strong className="text-slate-900">{resolvedHotelName}</strong>
                                        {dayHotel?.starRating ? ` (${dayHotel.starRating}★)` : ''}
                                      </span>
                                    </div>
                                  )}
                                  {day.guideIncluded && (
                                    <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold text-[10px] border border-teal-200">
                                      Guide Included
                                    </span>
                                  )}
                                  {day.freeTime && (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                                      Includes Free Time
                                    </span>
                                  )}
                                </div>

                                {mealsList.length > 0 && (
                                  <div className="flex items-center space-x-1 text-slate-600 font-medium">
                                    <Utensils className="w-3 h-3 text-[#008972]" />
                                    <span>Meals: {mealsList.join(' • ')}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OVERVIEW & SERVICES */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <h3 className="text-sm font-black text-slate-900">Package Description & Overview</h3>
                {packageItem.description || packageItem.tagline ? (
                  <RichTextRenderer
                    content={packageItem.description || packageItem.tagline || ''}
                    className="text-xs text-slate-700 leading-relaxed space-y-2"
                  />
                ) : (
                  <p className="text-xs text-slate-400 italic">No detailed description configured.</p>
                )}
              </div>

              {/* Selected Hubs in Saved Order */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Selected Route & City Hubs (Saved Order)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {orderedHubs.map((hub, idx) => (
                    <div
                      key={`${hub.hubId}-${idx}`}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-[#00C6A6] font-black text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{hub.hubName}</div>
                          <div className="text-[10px] text-slate-500">{hub.nights} Nights Allocated</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configured Services Summary */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Included Tours, Transfers & Ground Services ({configuredServices.length})
                </h4>
                {configuredServices.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No standalone catalog products linked directly; refer to day-wise itinerary descriptions and inclusions.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {configuredServices.map(prod => (
                      <div
                        key={prod.id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start space-x-3"
                      >
                        <Compass className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">{prod.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {prod.category} • {prod.city || packageItem.destinationName}
                            {prod.duration ? ` • ${prod.duration}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INCLUSIONS & EXCLUSIONS */}
          {activeTab === 'INCLUSIONS' && (
            <div className="space-y-6">
              {/* Key Highlights */}
              {(packageItem.highlights || []).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#008972]" />
                    <span>Key Package Highlights</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(packageItem.highlights || []).map((hl, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-start space-x-2.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-slate-800 leading-snug">
                          {cleanPackageText(hl)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inclusions & Exclusions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center space-x-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Inclusions ({(packageItem.inclusions || []).length})</span>
                  </h4>
                  {(packageItem.inclusions || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No specific inclusions listed.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(packageItem.inclusions || []).map((inc, i) => (
                        <li key={i} className="flex items-start space-x-2 text-xs text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{cleanPackageText(inc)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center space-x-1.5">
                    <X className="w-4 h-4 text-rose-600" />
                    <span>Exclusions ({(packageItem.exclusions || []).length})</span>
                  </h4>
                  {(packageItem.exclusions || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No specific exclusions listed.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(packageItem.exclusions || []).map((exc, i) => (
                        <li key={i} className="flex items-start space-x-2 text-xs text-slate-700">
                          <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{cleanPackageText(exc)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACCOMMODATION ROSTER */}
          {activeTab === 'HOTELS' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {packageItem.isLandOnly
                    ? 'Land-Only Package Arrangement'
                    : 'Configured Package Accommodations'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {packageItem.isLandOnly
                    ? 'This package is configured on a Land-Only basis (no hotel stays included).'
                    : 'Accommodations pre-configured in this package and transferred to Step 3 of the Quote Builder.'}
                </p>
              </div>

              {packageItem.isLandOnly ? (
                <div className="p-6 bg-purple-50 rounded-3xl border border-purple-200 text-purple-950 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                      ✓
                    </span>
                    <h4 className="font-black text-sm">Accommodation Arranged Independently (Land-Only)</h4>
                  </div>
                  <p className="text-xs text-purple-800 leading-relaxed">
                    This itinerary is configured as a <strong>Land-Only package</strong>. Configured ground services, transfers, and activities will be loaded into the Quote Builder with accommodation set to Land-Only.
                  </p>
                </div>
              ) : configuredAccommodations.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                  <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No Pre-Allocated Hotels Configured</p>
                  <p className="text-[11px] text-slate-500">
                    When you click Customize Package, you can select contracted or manual hotels for each city hub in Step 3 of the Quote Builder.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {configuredAccommodations.map((hotel, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-bold uppercase">
                          {hotel.cityName} • {hotel.nights} {hotel.nights === 1 ? 'Night' : 'Nights'}
                        </span>
                        {hotel.starRating && (
                          <span className="text-[11px] font-bold text-amber-600">{hotel.starRating}★ Hotel</span>
                        )}
                      </div>

                      <h4 className="font-black text-slate-900 text-sm">{hotel.name}</h4>
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <p>
                          Room Category: <strong>{hotel.roomType}</strong>
                        </p>
                        <p>
                          Meal Plan: <strong>{hotel.mealPlan}</strong>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TERMS & IMPORTANT INFORMATION */}
          {activeTab === 'TERMS' && (
            <div className="space-y-4 text-xs">
              {packageItem.importantInformation && (
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-2">
                  <h4 className="font-bold text-amber-900 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Important Travel Information</span>
                  </h4>
                  <RichTextRenderer
                    content={packageItem.importantInformation}
                    className="text-slate-700 leading-relaxed"
                  />
                </div>
              )}

              {packageItem.cancellationPolicy && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900">Cancellation Policy</h4>
                  <RichTextRenderer
                    content={packageItem.cancellationPolicy}
                    className="text-slate-600 leading-relaxed"
                  />
                </div>
              )}

              {packageItem.termsAndConditions && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900">Terms & Conditions</h4>
                  <RichTextRenderer
                    content={packageItem.termsAndConditions}
                    className="text-slate-600 leading-relaxed"
                  />
                </div>
              )}

              {!packageItem.importantInformation &&
                !packageItem.cancellationPolicy &&
                !packageItem.termsAndConditions && (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
                    No special terms or advisories configured for this package. Standard partner terms apply.
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Modal Action Bar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center justify-between sm:block">
            <div>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block">
                Final Selling Price
              </span>
              <div className="flex items-baseline space-x-1 sm:space-x-1.5">
                <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                  {formatCurrency(pricingResult.pricePerPerson, selectedCurrency)}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-500 font-medium">/ person</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="sm:hidden px-3 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={onClose}
              className="hidden sm:inline-flex px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer active:scale-95"
            >
              Close
            </button>

            {isB2BAgent ? (
              <>
                {onInstantBook && (
                  <button
                    onClick={() => onInstantBook(packageItem)}
                    className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#008972]" />
                    <span>Direct Book</span>
                  </button>
                )}
                {onCustomizePackage && (
                  <button
                    onClick={() => onCustomizePackage(packageItem)}
                    className="flex-1 sm:flex-initial px-3.5 sm:px-5 py-2 sm:py-2.5 bg-[#008972] hover:bg-[#007360] text-white font-black rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95"
                  >
                    <span>Customize Package in Quote Builder</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </>
            ) : (
              <>
                {onEnquirePackage && (
                  <button
                    onClick={() => onEnquirePackage(packageItem)}
                    className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 border border-slate-200 active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#008972]" />
                    <span>Enquire</span>
                  </button>
                )}

                {onInstantBook && (
                  <button
                    onClick={() => onInstantBook(packageItem)}
                    className="flex-1 sm:flex-initial px-3.5 sm:px-5 py-2 sm:py-2.5 bg-[#008972] hover:bg-[#007360] text-white font-black rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Book Package</span>
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
