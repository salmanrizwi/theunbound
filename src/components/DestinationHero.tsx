import React from 'react';
import { Destination } from '../types';
import { Sparkles, Calendar, Clock, Compass, Shield, CheckCircle2, Building2, MapPin, Globe2 } from 'lucide-react';

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
  const heroImage = destination.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop';
  const heroImageAlt = destination.heroImageAlt || `${destination.name} DMC Ground Operations & Contracted Services`;
  const overlayOpacity = destination.heroOverlayOpacity !== undefined ? destination.heroOverlayOpacity : 0.65;
  const heroEyebrow = destination.heroEyebrow || `DMC PREMIER PORTFOLIO • ${destination.country.toUpperCase()} GROUND OPERATIONS`;
  const heroTitle = destination.heroTitle || `Explore ${destination.name} Ground Operations`;
  
  const showPrimaryCta = destination.showPrimaryCta !== false;
  const primaryCtaText = destination.primaryCtaText || 'View Contracted Products';
  const showSecondaryCta = destination.showSecondaryCta !== false;
  const secondaryCtaText = destination.secondaryCtaText || 'Operational Advisory & FAQs';
  const trustBadge = destination.trustBadgeText || 'Direct Ground Operator • Verified Local Network';

  const hubsCount = destination.cities?.length || 0;

  return (
    <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 text-white shadow-xl mb-10 border border-slate-800">
      {/* Background Hero Image with Configurable Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt={heroImageAlt}
          className="w-full h-full object-cover object-center scale-105 transition-transform duration-1000 ease-out"
          referrerPolicy="no-referrer"
        />
        {/* Configurable overlay opacity layer */}
        <div 
          className="absolute inset-0 bg-slate-950 transition-opacity duration-300"
          style={{ opacity: overlayOpacity }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 sm:py-16 lg:px-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/40 backdrop-blur-md mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{heroEyebrow}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 leading-tight">
          {heroTitle}
        </h1>

        <p className="text-sm sm:text-base text-slate-200 max-w-3xl leading-relaxed mb-6">
          {destination.tagline || destination.description}
        </p>

        {/* Quick Meta Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mb-8">
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 hover:bg-white/15 transition-colors">
            <div className="flex items-center space-x-1.5 text-[#00E5C0] mb-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Best Season</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white truncate">{destination.bestTimeToVisit || 'All Year'}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 hover:bg-white/15 transition-colors">
            <div className="flex items-center space-x-1.5 text-[#00E5C0] mb-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Duration</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white truncate">{destination.idealTripDuration || '7–10 Days'}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 hover:bg-white/15 transition-colors">
            <div className="flex items-center space-x-1.5 text-[#00E5C0] mb-0.5">
              <Compass className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Travel Style</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white truncate">{destination.travelStyle || 'Bespoke Luxury'}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 hover:bg-white/15 transition-colors">
            <div className="flex items-center space-x-1.5 text-[#00E5C0] mb-0.5">
              <Building2 className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Regional Hubs</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white truncate">{hubsCount} Managed Hubs</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {showPrimaryCta && (
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
              className="bg-[#00C6A6] text-slate-950 px-6 py-2.5 rounded-xl font-bold hover:bg-[#00b296] transition-all shadow-md cursor-pointer text-xs sm:text-sm flex items-center space-x-2"
            >
              <Compass className="w-4 h-4" />
              <span>{primaryCtaText}</span>
            </button>
          )}
          
          {showSecondaryCta && (
            <button
              onClick={() => {
                const infoEl = document.getElementById('destination-info-section');
                if (infoEl) infoEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 px-5 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-xs sm:text-sm backdrop-blur-md flex items-center space-x-2"
            >
              <Globe2 className="w-4 h-4 text-[#00E5C0]" />
              <span>{secondaryCtaText}</span>
            </button>
          )}

          <div className="flex items-center space-x-2 text-xs text-slate-300 ml-1">
            <Shield className="w-4 h-4 text-[#00C6A6]" />
            <span>{trustBadge}</span>
          </div>
        </div>
      </div>

      {/* Selling Points Bar */}
      {destination.keySellingPoints && destination.keySellingPoints.length > 0 && (
        <div className="relative z-10 bg-slate-900/95 backdrop-blur-md border-t border-white/10 px-6 py-3.5">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {destination.keySellingPoints.map((point, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#00C6A6] shrink-0 mt-0.5" />
                <span className="text-xs text-slate-200 font-medium leading-snug">{point}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
