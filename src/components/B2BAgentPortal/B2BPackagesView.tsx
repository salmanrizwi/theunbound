import React, { useState, useMemo } from 'react';
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
  Eye
} from 'lucide-react';
import { B2BPackage, CurrencyCode } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { useQuotation } from '../../context/QuotationContext';

interface B2BPackagesViewProps {
  onCustomizePackage: (pkg: B2BPackage) => void;
  onOpenCreateQuote: () => void;
}

export const B2BPackagesView: React.FC<B2BPackagesViewProps> = ({
  onCustomizePackage,
  onOpenCreateQuote
}) => {
  const db = AppDatabase.getInstance();
  const packages = useMemo(() => db.getPackages(), [db]);
  const { currency } = useQuotation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedTripType, setSelectedTripType] = useState<string>('ALL');
  const [previewPackage, setPreviewPackage] = useState<B2BPackage | null>(null);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase tracking-wider">
              Wholesale Package Inventory
            </span>
            <span className="text-xs text-slate-400">({packages.length} Ready-Made Multi-City Circuits)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Ready-Made Tour Packages</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Pre-assembled multi-city itineraries with contracted 5★ hotels, Shinkansen rail passes, and private guided touring. 1-click to customize for your client.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          <span>Build Custom Itinerary from Scratch</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by package name, city route (e.g. Tokyo, Kyoto, London, Swiss Alps)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All Destinations</option>
            <option value="Japan">Japan</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Europe">Europe (Swiss / Italy)</option>
          </select>

          <select
            value={selectedTripType}
            onChange={(e) => setSelectedTripType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPackages.map(pkg => (
          <div
            key={pkg.id}
            className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs hover:shadow-xl hover:border-[#00C6A6] transition-all flex flex-col justify-between group"
          >
            <div>
              {/* Card Image */}
              <div className="h-48 relative overflow-hidden">
                <img
                  src={pkg.heroImage}
                  alt={pkg.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur text-[11px] font-bold text-[#00E5C0] border border-slate-700">
                  {pkg.durationNights} Nights / {pkg.durationDays} Days
                </div>

                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur text-[10px] font-bold text-slate-900">
                  {pkg.tripType}
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider font-bold block">
                    {pkg.destinationName}
                  </span>
                  <h3 className="text-sm font-bold leading-tight">{pkg.title}</h3>
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
                  {pkg.description}
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

            {/* Card Footer: Pricing & Customize Button */}
            <div className="p-5 pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] text-slate-400 block leading-tight">Wholesale Net From</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {formatCurrency(pkg.baseNetCostUSD, currency)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPreviewPackage(pkg)}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Quick View Inclusions"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onCustomizePackage(pkg)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Customize Quote →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Package Quick Preview Modal */}
      {previewPackage && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#00C6A6] uppercase tracking-wider block">
                  {previewPackage.destinationName} • {previewPackage.durationNights}N / {previewPackage.durationDays}D
                </span>
                <h2 className="text-xl font-bold text-slate-900">{previewPackage.title}</h2>
              </div>
              <button
                onClick={() => setPreviewPackage(null)}
                className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {previewPackage.description}
            </p>

            {previewPackage.highlights && (previewPackage.highlights || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Key Highlights:</h4>
                <ul className="space-y-1 text-xs text-slate-700">
                  {(previewPackage.highlights || []).map((h, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <Check className="w-3.5 h-3.5 text-[#00C6A6] shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previewPackage.inclusions && (previewPackage.inclusions || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Included In Package:</h4>
                <ul className="space-y-1 text-xs text-slate-700">
                  {(previewPackage.inclusions || []).map((inc, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">Suggested Selling Tariff</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {formatCurrency(previewPackage.suggestedSellingPriceUSD, currency)}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setPreviewPackage(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const pkg = previewPackage;
                    setPreviewPackage(null);
                    onCustomizePackage(pkg);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Load into Quotation Builder →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
