import React from 'react';
import { Destination } from '../types';
import { Sparkles, Calendar, Clock, Compass, Shield, CheckCircle2 } from 'lucide-react';

interface DestinationHeroProps {
  destination: Destination;
  allDestinations?: Destination[];
  onSelectDestination?: (slug: string) => void;
  onExploreProducts?: () => void;
}

export const DestinationHero: React.FC<DestinationHeroProps> = ({
  destination,
  allDestinations = [],
  onSelectDestination,
  onExploreProducts
}) => {
  return (
    <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 text-white shadow-xl mb-10">
      {/* Background Hero Image with Subtle Dark Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={destination.heroImage}
          alt={destination.name}
          className="w-full h-full object-cover object-center opacity-45 scale-105 transition-transform duration-1000 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 sm:py-20 lg:px-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/40 backdrop-blur-md mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>DMC Premier Portfolio • {destination.country}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
          Explore {destination.name}
        </h1>

        <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed mb-6">
          {destination.tagline}
        </p>

        {/* Quick Meta Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-3xl mb-8">
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5">
            <div className="flex items-center space-x-2 text-[#00E5C0] mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Best Season</span>
            </div>
            <p className="text-sm font-medium text-white">{destination.bestTimeToVisit}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5">
            <div className="flex items-center space-x-2 text-[#00E5C0] mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Ideal Duration</span>
            </div>
            <p className="text-sm font-medium text-white">{destination.idealTripDuration}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5">
            <div className="flex items-center space-x-2 text-[#00E5C0] mb-1">
              <Compass className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Travel Style</span>
            </div>
            <p className="text-sm font-medium text-white">{destination.travelStyle}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="hero-explore-products-btn"
            onClick={() => {
              if (onExploreProducts) {
                onExploreProducts();
              } else {
                const target = document.getElementById('products-grid-section');
                if (target) target.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="bg-[#00C6A6] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#00b296] transition-colors shadow-xs cursor-pointer text-sm"
          >
            View All Products
          </button>
          
          <button
            onClick={() => {
              const infoEl = document.getElementById('destination-info-section');
              if (infoEl) infoEl.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-6 py-2.5 rounded-lg font-semibold hover:bg-white/30 transition-colors cursor-pointer text-sm"
          >
            Destination Info
          </button>

          <div className="flex items-center space-x-2 text-xs text-slate-300 ml-2">
            <Shield className="w-4 h-4 text-[#00C6A6]" />
            <span>B2B Net Rates Guaranteed</span>
          </div>
        </div>
      </div>

      {/* Selling Points Bar */}
      <div className="relative z-10 bg-slate-900/90 backdrop-blur-md border-t border-white/10 px-6 py-3.5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {destination.keySellingPoints.map((point, idx) => (
            <div key={idx} className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#00C6A6] shrink-0 mt-0.5" />
              <span className="text-xs text-slate-200 font-medium leading-snug">{point}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
