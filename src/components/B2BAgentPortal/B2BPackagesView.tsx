import React, { useState, useMemo, useEffect } from 'react';
import { B2BPackage, CurrencyCode } from '../../types';
import { db } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { calculatePackagePrice, formatCurrency } from '../../services/pricingEngine';
import { canUserViewInternalCostBreakdown } from '../../services/permissionEngine';
import { canonicalImageService } from '../../services/imageService';
import {
  cleanPackageText,
  isPackageVisibleToB2BAgent,
  normalizePackageRecord,
  resolvePackageOrderedHubs
} from '../../services/packageToQuoteTransformer';
import { PackageDetailModal } from '../PackageDetailModal';
import {
  Search,
  MapPin,
  Clock,
  Sparkles,
  Check,
  Building2,
  Compass,
  Sliders,
  Eye,
  Heart,
  Layers,
  CheckCircle2
} from 'lucide-react';

interface B2BPackagesViewProps {
  onCustomizePackage: (pkg: B2BPackage) => void;
  onOpenCreateQuote?: () => void;
  onViewPackageDetails?: (pkg: B2BPackage) => void;
  onViewItemDetails?: (item: any, type: 'PRODUCT' | 'HOTEL' | 'PACKAGE') => void;
}

export const B2BPackagesView: React.FC<B2BPackagesViewProps> = ({
  onCustomizePackage,
  onViewPackageDetails,
  onViewItemDetails
}) => {
  const { user } = useAuth();
  const { currency } = useQuotation();

  const canViewInternalPricing = canUserViewInternalCostBreakdown(user);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedTripType, setSelectedTripType] = useState<string>('ALL');
  const [selectedDuration, setSelectedDuration] = useState<string>('ALL');
  const [activeModalPackage, setActiveModalPackage] = useState<B2BPackage | null>(null);

  const [packages, setPackages] = useState<B2BPackage[]>(() =>
    db
      .getPublishedB2BPackages()
      .map(normalizePackageRecord)
      .filter(isPackageVisibleToB2BAgent)
  );
  const [wishlistTrigger, setWishlistTrigger] = useState(0);

  useEffect(() => {
    const refreshPackages = () => {
      const latest = db
        .getPublishedB2BPackages()
        .map(normalizePackageRecord)
        .filter(isPackageVisibleToB2BAgent);
      setPackages(latest);
      setWishlistTrigger(prev => prev + 1);
      setActiveModalPackage(prev => {
        if (!prev) return null;
        const updated = latest.find(p => p.id === prev.id);
        return updated || prev;
      });
    };
    refreshPackages();
    const unsubscribe = db.subscribe(refreshPackages);
    const unsubImg = canonicalImageService.subscribe(refreshPackages);
    return () => {
      unsubscribe();
      unsubImg();
    };
  }, []);

  const savedItemIds = useMemo(() => {
    if (!user) return new Set<string>();
    const items = db.getWishlistItems(user.id);
    return new Set(items.map(i => i.productId || (i as any).itemId));
  }, [user, wishlistTrigger]);

  const handleToggleSavePackage = (e: React.MouseEvent, pkg: B2BPackage) => {
    e.stopPropagation();
    if (!user) return;
    const items = db.getWishlistItems(user.id);
    const existing = items.find(i => (i.productId || (i as any).itemId) === pkg.id);
    if (existing) {
      db.deleteWishlistItem(existing.id);
    } else {
      const folders = db.getWishlistFolders(user.id);
      db.saveWishlistItem({
        id: `wish-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId: user.id,
        productId: pkg.id,
        folderId: folders[0]?.id || 'default',
        notes: `Ready-Made Package: ${pkg.title}`,
        addedAt: new Date().toISOString()
      });
    }
    setWishlistTrigger(prev => prev + 1);
  };

  const handleViewPackage = (pkg: B2BPackage) => {
    const fresh = db.getPackageById(pkg.id);
    const normalized = normalizePackageRecord(fresh || pkg);
    setActiveModalPackage(normalized);
    if (onViewItemDetails) {
      onViewItemDetails(normalized, 'PACKAGE');
    }
  };

  // Dynamically derive destination options from active packages
  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    packages.forEach(pkg => {
      if (pkg.destinationName) set.add(pkg.destinationName);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [packages]);

  // Filter packages safely
  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return packages.filter(pkg => {
      const orderedHubs = resolvePackageOrderedHubs(pkg);
      const hubText = orderedHubs.map(h => h.hubName.toLowerCase()).join(' ');
      const tagsText = (pkg.tags || []).join(' ').toLowerCase();
      const highlightsText = (pkg.highlights || []).join(' ').toLowerCase();

      const matchesSearch =
        !q ||
        (pkg.title || '').toLowerCase().includes(q) ||
        (pkg.tagline || '').toLowerCase().includes(q) ||
        (pkg.description || '').toLowerCase().includes(q) ||
        (pkg.destinationName || '').toLowerCase().includes(q) ||
        (pkg.routeSummary || []).some(r => String(r).toLowerCase().includes(q)) ||
        hubText.includes(q) ||
        tagsText.includes(q) ||
        highlightsText.includes(q);

      const matchesDest =
        selectedDestination === 'ALL' ||
        (pkg.destinationName || '').toLowerCase() === selectedDestination.toLowerCase() ||
        pkg.destinationId === selectedDestination;

      const matchesType =
        selectedTripType === 'ALL' ||
        (pkg.tripType || '').toUpperCase() === selectedTripType.toUpperCase();

      let matchesDuration = true;
      if (selectedDuration === 'SHORT') matchesDuration = pkg.durationNights <= 4;
      if (selectedDuration === 'MEDIUM')
        matchesDuration = pkg.durationNights >= 5 && pkg.durationNights <= 7;
      if (selectedDuration === 'LONG') matchesDuration = pkg.durationNights >= 8;

      return matchesSearch && matchesDest && matchesType && matchesDuration;
    });
  }, [packages, searchQuery, selectedDestination, selectedTripType, selectedDuration]);

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready-Made B2B Packages</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-2">
            Pre-Curated Multi-Day Itineraries
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Browse authoritative, DMC-verified multi-day circuits synchronized directly from our master catalog. Inspect complete day-wise itineraries via <strong>View Package</strong> or click <strong>Customize Package</strong> to pre-populate the Quote Builder with all configured hubs, hotels, activities, transfers, inclusions, and pricing.
          </p>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search packages by title, destination, city hub, or highlight..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#008972] focus:bg-white transition-all"
            />
          </div>

          {/* Trip Type Filter */}
          <div>
            <select
              value={selectedTripType}
              onChange={e => setSelectedTripType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#008972]"
            >
              <option value="ALL">All Trip Styles</option>
              <option value="CULTURAL">Cultural & Heritage</option>
              <option value="LUXURY">Luxury & Bespoke</option>
              <option value="HONEYMOON">Honeymoon & Romance</option>
              <option value="FAMILY">Family & Theme Parks</option>
              <option value="ADVENTURE">Adventure & Nature</option>
              <option value="CLASSIC">Classic Circuit</option>
            </select>
          </div>

          {/* Duration Filter */}
          <div>
            <select
              value={selectedDuration}
              onChange={e => setSelectedDuration(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#008972]"
            >
              <option value="ALL">Any Duration</option>
              <option value="SHORT">Short Escapes (1–4 Nights)</option>
              <option value="MEDIUM">Classic Stays (5–7 Nights)</option>
              <option value="LONG">Extended Tours (8+ Nights)</option>
            </select>
          </div>
        </div>

        {/* Destination Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">
            Destination:
          </span>
          {destinationOptions.map(dest => (
            <button
              key={dest}
              onClick={() => setSelectedDestination(dest)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedDestination === dest
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dest === 'ALL' ? `All Destinations (${packages.length})` : dest}
            </button>
          ))}
        </div>
      </div>

      {/* Packages Grid */}
      {filteredPackages.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80">
          <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No Matching Packages Found</h3>
          <p className="text-sm text-slate-500 mt-1">
            Try clearing your search filters or selecting another destination.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredPackages.map(pkg => {
            const calc = calculatePackagePrice({
              packageItem: pkg,
              userRole: user?.role || 'B2B_AGENT',
              targetCurrency: currency as CurrencyCode,
              user
            });

            const orderedHubs = resolvePackageOrderedHubs(pkg);
            const cleanOverview = cleanPackageText(pkg.tagline || pkg.description);
            const configuredDaysCount = (pkg.itinerary || []).length || pkg.durationDays;
            const totalConfiguredServices = (pkg.productIds || []).length;

            return (
              <div
                key={pkg.id}
                onClick={() => handleViewPackage(pkg)}
                className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer group"
              >
                {/* Hero Image Header */}
                <div className="relative h-56 overflow-hidden bg-slate-900">
                  <img
                    src={canonicalImageService.resolvePackageImage(pkg)}
                    alt={pkg.title}
                    referrerPolicy="no-referrer"
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200';
                    }}
                    className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold flex items-center space-x-1.5 border border-white/15">
                        <MapPin className="w-3 h-3 text-teal-400" />
                        <span>{pkg.destinationName}</span>
                      </span>
                      <span className="px-3 py-1 rounded-full bg-teal-500/90 backdrop-blur-md text-slate-950 text-xs font-extrabold uppercase tracking-wider">
                        {pkg.tripType}
                      </span>
                      {pkg.isLandOnly ? (
                        <span className="px-2.5 py-1 rounded-full bg-purple-900/85 backdrop-blur-md text-purple-200 text-[11px] font-bold border border-purple-400/30">
                          Land-Only
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-900/85 backdrop-blur-md text-emerald-200 text-[11px] font-bold border border-emerald-400/30 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Available</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold flex items-center space-x-1.5 border border-white/15">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>
                          {pkg.durationDays}D / {pkg.durationNights}N
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={e => handleToggleSavePackage(e, pkg)}
                        title={
                          savedItemIds.has(pkg.id)
                            ? 'Remove from Wishlist'
                            : 'Save Package to Wishlist'
                        }
                        className={`p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                          savedItemIds.has(pkg.id)
                            ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                            : 'bg-slate-900/70 text-white/90 hover:text-rose-400 border-white/15'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            savedItemIds.has(pkg.id) ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Title & Overview */}
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-xl font-bold leading-snug line-clamp-1">{pkg.title}</h3>
                    {cleanOverview && (
                      <p className="text-xs text-slate-300 line-clamp-2 mt-1">{cleanOverview}</p>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    {/* Selected Hubs in Saved Order */}
                    {orderedHubs.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Selected Route & City Hubs
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {orderedHubs.map((hub, idx) => (
                            <React.Fragment key={`${hub.hubId}-${idx}`}>
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200/60">
                                {hub.hubName} ({hub.nights}N)
                              </span>
                              {idx < orderedHubs.length - 1 && (
                                <span className="text-slate-300 text-xs">→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Included Services & Accommodations Summary */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/70 text-xs font-semibold">
                        <Layers className="w-3.5 h-3.5 text-teal-600" />
                        <span>{configuredDaysCount}-Day Configured Itinerary</span>
                      </span>
                      {totalConfiguredServices > 0 && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200/70 text-xs font-semibold">
                          <Compass className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{totalConfiguredServices} Included Services</span>
                        </span>
                      )}
                      {!pkg.isLandOnly && (pkg.hotelsSummary || []).length > 0 && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/70 text-xs font-semibold">
                          <Building2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>{(pkg.hotelsSummary || []).length} Hotel Stays</span>
                        </span>
                      )}
                    </div>

                    {/* Hotels Summary if configured */}
                    {!pkg.isLandOnly && pkg.hotelsSummary && pkg.hotelsSummary.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Included Accommodations
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {pkg.hotelsSummary.slice(0, 2).map((h, i) => (
                            <div
                              key={i}
                              className="flex items-start space-x-2 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                            >
                              <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 truncate">{h.name}</div>
                                <div className="text-[11px] text-slate-500">
                                  {h.cityName} • {h.nights}N ({h.roomType})
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Highlights / Inclusions */}
                    {((pkg.highlights && pkg.highlights.length > 0) ||
                      (pkg.inclusions && pkg.inclusions.length > 0)) && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                          {pkg.highlights && pkg.highlights.length > 0
                            ? 'Key Package Highlights'
                            : 'Included Services'}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(pkg.highlights && pkg.highlights.length > 0
                            ? pkg.highlights
                            : pkg.inclusions || []
                          )
                            .slice(0, 4)
                            .map((itemText, i) => (
                              <div
                                key={i}
                                className="flex items-center space-x-1.5 text-xs text-slate-600"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="truncate">{cleanPackageText(itemText)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing & Actions Footer */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      {canViewInternalPricing && calc.internalAudit ? (
                        <div className="flex items-center space-x-4">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                              B2B Nett Cost
                            </span>
                            <span className="text-lg font-extrabold text-slate-900">
                              {formatCurrency(calc.internalAudit.totalNetCostTarget, currency as CurrencyCode)}
                            </span>
                          </div>
                          <div className="h-7 w-px bg-slate-200" />
                          <div>
                            <span className="text-[10px] font-bold uppercase text-teal-600 block">
                              Final Selling Price
                            </span>
                            <span className="text-lg font-extrabold text-[#008972]">
                              {formatCurrency(calc.pricePerPerson, currency as CurrencyCode)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-teal-600 block">
                            Final Selling Price (Per Person)
                          </span>
                          <span className="text-xl font-extrabold text-slate-900">
                            {formatCurrency(calc.pricePerPerson, currency as CurrencyCode)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleViewPackage(pkg);
                        }}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Package</span>
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          const fresh = db.getPackageById(pkg.id);
                          onCustomizePackage(normalizePackageRecord(fresh || pkg));
                        }}
                        className="px-4 py-2.5 bg-[#008972] hover:bg-[#00705d] text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Customize Package</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Package Detail View Modal (opens without altering Quote Builder state) */}
      {activeModalPackage && (
        <PackageDetailModal
          packageItem={activeModalPackage}
          onClose={() => setActiveModalPackage(null)}
          onCustomizePackage={pkg => {
            setActiveModalPackage(null);
            onCustomizePackage(pkg);
          }}
        />
      )}
    </div>
  );
};
