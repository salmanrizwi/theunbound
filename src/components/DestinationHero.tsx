import React from 'react';
import { Destination } from '../types';
import { Calendar, Clock, Compass, Building2 } from 'lucide-react';
import { UniversalHero } from './UniversalHero';

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
  const hubsCount = destination.cities?.length || 0;

  return (
    <div className="w-full mb-8 sm:mb-10">
      <UniversalHero
        context="DESTINATION"
        config={{
          ...destination.heroConfig,
          showDiscoveryPanel: false,
          showPillars: false,
          showTrustStrip: false
        }}
        destination={destination}
        allDestinations={allDestinations}
        onExploreProducts={onExploreProducts}
        onSelectDestination={onSelectDestination}
      />

      {/* Destination Operational Metadata Bar */}
      <div className="relative z-10 bg-slate-900/95 backdrop-blur-md border-t border-white/10 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2.5 min-w-0">
            <Calendar className="w-4 h-4 text-[#00C6A6] shrink-0" />
            <div className="min-w-0 text-left">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Best Season</span>
              <span className="text-xs font-bold text-white break-words leading-tight block">{destination.bestTimeToVisit || 'All Year'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-2.5 min-w-0">
            <Clock className="w-4 h-4 text-[#00C6A6] shrink-0" />
            <div className="min-w-0 text-left">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Duration</span>
              <span className="text-xs font-bold text-white break-words leading-tight block">{destination.idealTripDuration || '7–10 Days'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-2.5 min-w-0">
            <Compass className="w-4 h-4 text-[#00C6A6] shrink-0" />
            <div className="min-w-0 text-left">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Travel Style</span>
              <span className="text-xs font-bold text-white break-words leading-tight block">{destination.travelStyle || 'Bespoke Luxury'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-2.5 min-w-0">
            <Building2 className="w-4 h-4 text-[#00C6A6] shrink-0" />
            <div className="min-w-0 text-left">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Regional Hubs</span>
              <span className="text-xs font-bold text-white break-words leading-tight block">{hubsCount} Managed Hubs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
