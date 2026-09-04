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
import { formatCurrency, calculatePackagePrice } from '../../services/pricingEngine';
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPackages.map(pkg => (
          <div
            key={pkg.id}
            className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg hover:border-purple-500 transition-all flex flex-col justify-between group"
          >
            <div>
              {/* Card Image */}
              <div className="h-48 relative overflow-hidden bg-slate-900">
                <img
                  src={pkg.heroImage}
                  alt={pkg.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
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
                  onClick={() => setSelectedPackageDetails(pkg)}
                  className="w-full py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-300" />
                  <span>View Itinerary</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Day-Wise Itinerary Preview Modal (Fits Viewport, Fixed Header/Footer, Scrollable Body) */}
      {selectedPackageDetails && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          onClick={() => setSelectedPackageDetails(null)}
        >
          <div 
            className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                  {selectedPackageDetails.destinationName} • {selectedPackageDetails.durationNights} Nights / {selectedPackageDetails.durationDays} Days Circuit
                </span>
                <h2 className="text-lg font-black text-slate-900 font-sans">
                  {selectedPackageDetails.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedPackageDetails(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Itinerary Schedule */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {selectedPackageDetails.heroImage && (
                <div className="h-56 rounded-2xl overflow-hidden bg-slate-100">
                  <img
                    src={selectedPackageDetails.heroImage}
                    alt={selectedPackageDetails.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <p className="text-slate-600 leading-relaxed text-xs">
                {selectedPackageDetails.description}
              </p>

              {/* Day-Wise Timeline Schedule */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Day-Wise Turnkey Itinerary Schedule</span>
                </h3>

                <div className="space-y-3 border-l-2 border-purple-200 pl-4 ml-2">
                  {(selectedPackageDetails.dayWiseItinerary || [
                    { day: 1, title: 'Arrival & VIP Private Transfer', description: 'Chauffeured airport pickup, luxury check-in, evening welcome reception.' },
                    { day: 2, title: 'Historic Highlights & Private Guide Tour', description: 'Full day private chauffeured excursion with licensed English-speaking guide.' },
                    { day: 3, title: 'Cultural Immersion & Gourmet Dining', description: 'Exclusive tea ceremony, artisan workshops, and Michelin-starred dinner.' },
                    { day: 4, title: 'High-Speed Shinkansen to Next Hub', description: 'First-class bullet train transfer with reserved luggage allotments.' },
                    { day: 5, title: 'Departure & Dedicated Concierge Farewell', description: 'Private transfer to international airport for departure flight.' }
                  ]).map((item: any, idx: number) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-purple-600 border-2 border-white ring-2 ring-purple-100"></div>
                      <div className="font-extrabold text-slate-900 text-xs">
                        Day {item.day || idx + 1}: {item.title}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inclusions & Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
                  <h4 className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider">Package Inclusions</h4>
                  <ul className="space-y-1 text-emerald-950 text-[11px]">
                    {(selectedPackageDetails.inclusions || []).map((inc, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-2">
                  <h4 className="font-bold text-purple-900 uppercase text-[10px] tracking-wider">Key Highlights</h4>
                  <ul className="space-y-1 text-purple-950 text-[11px]">
                    {(selectedPackageDetails.highlights || []).map((h, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <Star className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Final Selling Price</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {formatCurrency(calculatePackagePrice({ packageItem: selectedPackageDetails, targetCurrency: currency }).pricePerPerson, currency)}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/ person</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedPackageDetails(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    const pkg = selectedPackageDetails;
                    setSelectedPackageDetails(null);
                    onCustomizePackage(pkg);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 font-black text-xs transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Customize in Quote Builder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
