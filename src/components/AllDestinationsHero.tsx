import React from 'react';
import { Destination } from '../types';
import { Compass, ArrowRight, ShieldCheck, CheckCircle2, Globe2 } from 'lucide-react';

interface AllDestinationsHeroProps {
  destinations: Destination[];
  onSelectDestination: (slug: string) => void;
  onExploreProducts: () => void;
}

export const AllDestinationsHero: React.FC<AllDestinationsHeroProps> = ({
  destinations,
  onSelectDestination,
  onExploreProducts
}) => {
  const totalDestinations = destinations.length;
  const totalHubs = destinations.reduce((acc, d) => acc + (d.cities ? d.cities.length : 0), 0);
  const destinationNamesList = destinations.map(d => d.name).join(', ');
  const sampleHubNames = destinations.flatMap(d => (d.cities ? d.cities.map(c => c.name) : [])).slice(0, 3).join(', ');

  return (
    <div className="space-y-8 mb-10">
      {/* Main Global Portfolio Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 text-white shadow-xl">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1600&auto=format&fit=crop"
            alt="All Destinations - Global DMC Portfolio"
            className="w-full h-full object-cover object-center opacity-35 scale-105 transition-transform duration-1000 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-transparent" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 sm:py-16 lg:px-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/40 backdrop-blur-md mb-4">
            <Globe2 className="w-3.5 h-3.5" />
            <span>Global DMC Destination Portfolio • {totalDestinations} Active Regions</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
            Explore All {totalDestinations} Destinations
          </h1>

          <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed mb-6">
            Access our complete multi-destination DMC portfolio covering {destinationNamesList || 'our global partner regions'}. Direct contracted rates, expert local guides, and bespoke luxury logistics.
          </p>

          {/* Key Global DMC Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mb-8">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">
                Destinations
              </span>
              <span className="text-xl font-bold text-white">{totalDestinations} Regions</span>
              <p className="text-[11px] text-slate-300 truncate">{destinationNamesList}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">
                City Hubs
              </span>
              <span className="text-xl font-bold text-white">
                {totalHubs} Hubs
              </span>
              <p className="text-[11px] text-slate-300 truncate">{sampleHubNames ? `${sampleHubNames}...` : 'Direct Gateways'}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">
                Logistics
              </span>
              <span className="text-xl font-bold text-white">100% Direct</span>
              <p className="text-[11px] text-slate-300">Net B2B Contracts</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">
                Operations
              </span>
              <span className="text-xl font-bold text-white">24/7 Support</span>
              <p className="text-[11px] text-slate-300">Ground Assistance</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="hero-explore-all-products-btn"
              onClick={onExploreProducts}
              className="bg-[#00C6A6] text-slate-950 px-6 py-2.5 rounded-lg font-bold hover:bg-[#00b296] transition-colors shadow-sm cursor-pointer text-sm flex items-center space-x-2"
            >
              <Compass className="w-4 h-4" />
              <span>Browse All Travel Products</span>
            </button>
            <div className="flex items-center space-x-2 text-xs text-slate-300 ml-2">
              <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
              <span>Live Verified Ground Contracts</span>
            </div>
          </div>
        </div>

        {/* Value Highlights Bar */}
        <div className="relative z-10 bg-slate-900/90 backdrop-blur-md border-t border-white/10 px-6 py-3.5">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-300">
            {destinations.slice(0, 6).map((dest) => (
              <div key={dest.id} className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#00C6A6] shrink-0" />
                <span className="truncate"><strong>{dest.name}:</strong> {dest.tagline || (dest.highlights && dest.highlights[0]) || `${dest.cities.length} Gateways`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Destination Feature Showcase Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Globe2 className="w-5 h-5 text-[#00C6A6]" />
              <span>Explore Our {totalDestinations} Core Destinations</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any destination to filter tours, regional hubs, and local DMC ground operations
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {destinations.map((dest) => (
            <div
              key={dest.id}
              id={`destination-card-${dest.slug}`}
              onClick={() => onSelectDestination(dest.slug)}
              className="group bg-white rounded-2xl border border-slate-200 hover:border-[#00C6A6] hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
            >
              {/* Destination Image Banner */}
              <div className="relative aspect-16/9 w-full overflow-hidden bg-slate-900">
                <img
                  src={dest.heroImage}
                  alt={dest.name}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
                
                {/* Destination Badge */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 text-slate-900 backdrop-blur-md shadow-xs">
                    {dest.country}
                  </span>
                </div>

                {/* Hub Count Pill */}
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#00C6A6] text-slate-950 shadow-xs">
                    {dest.cities ? dest.cities.length : 0} Hubs
                  </span>
                </div>

                {/* Destination Name on Image */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-xl font-bold text-white leading-tight group-hover:text-[#00E5C0] transition-colors">
                    {dest.name}
                  </h3>
                  <p className="text-[11px] text-slate-200 line-clamp-1 mt-0.5">
                    {dest.tagline}
                  </p>
                </div>
              </div>

              {/* Destination Body Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {dest.description}
                  </p>

                  {/* Highlights Pill List */}
                  {dest.highlights && dest.highlights.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        DMC Key Highlights
                      </span>
                      <ul className="space-y-1">
                        {dest.highlights.slice(0, 2).map((h, i) => (
                          <li key={i} className="text-xs text-slate-700 flex items-start space-x-1.5">
                            <span className="text-[#00C6A6] font-bold mt-0.5">•</span>
                            <span className="line-clamp-1">{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Hub Preview */}
                  {dest.cities && dest.cities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {dest.cities.slice(0, 4).map((c) => (
                        <span
                          key={c.id}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium"
                        >
                          {c.name}
                        </span>
                      ))}
                      {dest.cities.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[11px]">
                          +{dest.cities.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Link */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#008972] transition-colors flex items-center space-x-1">
                    <span>View {dest.name} Products</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-slate-400">
                    Currency: {dest.currency}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
