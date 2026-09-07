import React from 'react';
import { Destination, HomepageConfig } from '../types';
import { Globe2, Building2, Clock, Layers, PlusCircle, ArrowRight } from 'lucide-react';
import { countingEngine } from '../services/countingEngine';
import { navigateTo } from '../services/portalRouter';
import { UniversalHero } from './UniversalHero';

interface AllDestinationsHeroProps {
  destinations: Destination[];
  config?: HomepageConfig;
  onSelectDestination: (slug: string) => void;
  onExploreProducts: () => void;
}

export const AllDestinationsHero: React.FC<AllDestinationsHeroProps> = ({
  destinations,
  config,
  onSelectDestination,
  onExploreProducts
}) => {
  const destList = destinations || [];
  const totalDestinations = destList.length;

  return (
    <div className="w-full mb-10">
      {/* 1. Master Universal Hero Section */}
      <UniversalHero
        context="HOMEPAGE"
        config={{
          ...config?.heroConfig,
          showPillars: false,
          showTrustStrip: false
        }}
        homepageConfig={config}
        allDestinations={destList}
        onExploreProducts={onExploreProducts}
        onSelectDestination={onSelectDestination}
      />

      {/* 2. Interactive Destination Feature Showcase Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        <div id="destinations-grid-heading" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap min-w-0">
              <Globe2 className="w-5 h-5 text-[#00C6A6] shrink-0" />
              <span className="break-words">Explore Our {totalDestinations} Core Destination Operations</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-normal break-words">
              Select any destination to filter tours, regional hubs, and local DMC ground operations
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {destinations.map((dest, idx) => {
            const metrics = countingEngine.getDestinationMetrics(dest.slug || dest.id);
            return (
            <div
              key={`dest-hero-card-${dest.id || dest.slug}-${idx}`}
              id={`destination-card-${dest.slug}`}
              onClick={() => onSelectDestination(dest.slug)}
              className="group bg-white rounded-2xl border border-slate-200 hover:border-[#00C6A6] hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col min-w-0 h-full"
            >
              {/* Destination Image Banner with coordinated overlays */}
              <div className="relative aspect-16/10 sm:aspect-16/9 min-h-[175px] sm:min-h-[190px] w-full overflow-hidden bg-slate-900 shrink-0">
                <img
                  src={dest.heroImage}
                  alt={dest.name}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                
                {/* Top Badges: Country + Hub/Tour counts in unified flexible container */}
                <div className="absolute top-3 inset-x-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 text-slate-900 backdrop-blur-md shadow-xs shrink-0 max-w-full truncate">
                    {dest.country}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#00C6A6] text-slate-950 shadow-xs whitespace-nowrap">
                      {metrics.hubsCount || (dest.cities ? (dest.cities || []).length : 0)} Hubs
                    </span>
                    {metrics.productsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/90 text-white border border-white/20 backdrop-blur-xs whitespace-nowrap">
                        {metrics.productsCount} Tours
                      </span>
                    )}
                  </div>
                </div>

                {/* Destination Name and Tagline on Image */}
                <div className="absolute bottom-3 inset-x-3 text-white z-10">
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-tight group-hover:text-[#00E5C0] transition-colors break-words">
                    {dest.name}
                  </h3>
                  {dest.tagline && (
                    <p className="text-[11px] sm:text-xs text-slate-200 mt-1 leading-snug break-words">
                      {dest.tagline}
                    </p>
                  )}
                </div>
              </div>

              {/* Destination Body Content */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4 min-w-0">
                <div className="space-y-3 min-w-0">
                  <p className="text-xs text-slate-600 leading-relaxed break-words">
                    {dest.description}
                  </p>

                  {/* Highlights List */}
                  {dest.highlights && (dest.highlights || []).length > 0 && (
                    <div className="space-y-1.5 pt-1 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        DMC Key Highlights
                      </span>
                      <ul className="space-y-1.5 min-w-0">
                        {(dest.highlights || []).slice(0, 2).map((h, i) => (
                          <li key={i} className="text-xs text-slate-700 flex items-start gap-2 min-w-0">
                            <span className="text-[#00C6A6] font-bold mt-0.5 shrink-0 select-none">•</span>
                            <span className="break-words leading-snug min-w-0 flex-1">{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Hub Preview */}
                  {dest.cities && (dest.cities || []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 min-w-0">
                      {(dest.cities || []).slice(0, 4).map((c, cIdx) => (
                        <span
                          key={`dest-city-${dest.id || dest.slug}-${c.id || c.name}-${cIdx}`}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium whitespace-nowrap"
                        >
                          {c.name}
                        </span>
                      ))}
                      {(dest.cities || []).length > 4 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium whitespace-nowrap">
                          +{(dest.cities || []).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Link: Fully wrapped, flexible, and responsive */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#008972] transition-colors inline-flex items-center gap-1.5 min-w-0 flex-1 break-words">
                    <span className="break-words leading-snug">View {dest.name} Products ({metrics.productsCount})</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-slate-500 shrink-0 whitespace-nowrap ml-auto">
                    Currency: {dest.currency}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
