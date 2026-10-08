import React, { useState, useMemo, useEffect } from 'react';
import { 
  Layers, 
  Search, 
  Filter, 
  Sparkles, 
  MapPin, 
  Clock, 
  Star, 
  DollarSign, 
  Check, 
  ArrowRight, 
  SlidersHorizontal,
  ChevronRight,
  Eye,
  BookmarkCheck,
  X,
  Calendar,
  Building2,
  Train,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { B2BPackage, CurrencyCode } from '../../types';
import { AppDatabase } from '../../services/db';
import { canonicalImageService } from '../../services/imageService';
import { formatCurrency, calculatePackagePrice } from '../../services/pricingEngine';
import { useQuotation } from '../../context/QuotationContext';
import { B2BViewDetailsModal } from '../B2BViewDetailsModal';

interface B2BPackagesViewProps {
  onCustomizePackage: (pkg: B2BPackage) => void;
  onOpenCreateQuote: () => void;
  onViewPackageDetails?: (pkg: B2BPackage) => void;
}

export const B2BPackagesView: React.FC<B2BPackagesViewProps> = ({
  onCustomizePackage,
  onOpenCreateQuote,
  onViewPackageDetails
}) => {
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

  const packages = useMemo(() => db.getPackages(), [db, dbTick]);
  const { currency } = useQuotation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedTripType, setSelectedTripType] = useState<string>('ALL');
  const [selectedPackageDetails, setSelectedPackageDetails] = useState<B2BPackage | null>(null);

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = 
        pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.destinationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.routeSummary.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDest = selectedDestination === 'ALL' || pkg.destinationId === selectedDestination || pkg.destinationName.toLowerCase() === selectedDestination.toLowerCase();
      const matchesType = selectedTripType === 'ALL' || pkg.tripType === selectedTripType;

      return matchesSearch && matchesDest && matchesType;
    });
  }, [packages, searchQuery, selectedDestination, selectedTripType]);

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-bold uppercase tracking-wider">
              Wholesale Package Circuits
            </span>
            <span className="text-xs text-slate-400 font-mono">({packages.length} Ready-Made Multi-City Circuits)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Ready-Made Tour Packages</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Pre-assembled multi-city itineraries with contracted 5★ hotels, bullet train tickets, and private guided touring. 1-click to customize for your client.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <span>Build Itinerary from Scratch</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by package name, city route (e.g. Tokyo, Kyoto, London, Swiss Alps)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="ALL">All Destinations</option>
            <option value="Japan">Japan</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Europe">Europe (Swiss / Italy)</option>
          </select>

          <select
            value={selectedTripType}
            onChange={(e) => setSelectedTripType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="ALL">All Travel Styles</option>
            <option value="LUXURY">Luxury 5★</option>
            <option value="CULTURAL">Cultural Heritage</option>
            <option value="HONEYMOON">Honeymoon Romantic</option>
            <option value="ADVENTURE">Adventure & Snow</option>
          </select>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {filteredPackages.map(pkg => (
          <div
            key={pkg.id}
            className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg hover:border-purple-500 transition-all flex flex-col justify-between group"
          >
            <div>
              {/* Card Image */}
              <div className="h-48 relative overflow-hidden bg-slate-900">
                <img
                  src={canonicalImageService.resolvePackageImage(pkg)}
                  alt={pkg.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = canonicalImageService.resolvePackageImage(pkg);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-[11px] font-bold text-[#00E5C0] border border-slate-700">
                  {pkg.durationNights} Nights / {pkg.durationDays} Days
                </div>

                <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[10px] font-bold text-slate-900">
                  {pkg.tripType}
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider font-bold block">
                    {pkg.destinationName}
                  </span>
                  <h3 className="text-sm font-extrabold leading-tight line-clamp-1 drop-shadow-xs">{pkg.title}</h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-4">
                {/* Multi-City Route Pills */}
                {pkg.routeSummary && (pkg.routeSummary || []).length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itinerary Circuit:</span>
                    <div className="flex flex-wrap gap-1">
                      {(pkg.routeSummary || []).map((r, idx) => (
                        <span key={idx} className="text-[11px] px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded-lg font-medium">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {pkg.tagline || pkg.description}
                </p>

                {/* Hotels Snapshot */}
                {pkg.hotelsSummary && (pkg.hotelsSummary || []).length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Contracted Hotels:</span>
                    <div className="space-y-1">
                      {(pkg.hotelsSummary || []).slice(0, 3).map((h, i) => (
                        <div key={i} className="flex justify-between text-[11px] text-slate-700">
                          <span className="truncate font-semibold">• {h.name}</span>
                          <span className="text-slate-400 shrink-0 font-mono">({h.nights}N)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer: Pricing & 3 Actions */}
            <div className="p-5 pt-3 border-t border-slate-100 space-y-3 bg-slate-50/50">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block leading-tight font-bold uppercase tracking-wider">Final Selling Price</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-base font-black text-slate-900 font-mono">
                      {formatCurrency(calculatePackagePrice({ packageItem: pkg, targetCurrency: currency }).pricePerPerson, currency)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">/ person</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                  Authoritative Rate
                </span>
              </div>

              {/* 3 Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => onCustomizePackage(pkg)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 font-black text-xs transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Customize in Quote Builder</span>
                </button>

                <button
                  onClick={() => {
                    if (onViewPackageDetails) {
                      onViewPackageDetails(pkg);
                    } else {
                      setSelectedPackageDetails(pkg);
                    }
                  }}
                  className="w-full py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-300" />
                  <span>View Details</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Standardized B2B View Details Modal */}
      {selectedPackageDetails && (
        <B2BViewDetailsModal
          packageItem={selectedPackageDetails}
          onClose={() => setSelectedPackageDetails(null)}
          onCustomizePackage={(pkg) => {
            setSelectedPackageDetails(null);
            onCustomizePackage(pkg);
          }}
        />
      )}
    </div>
  );
};
