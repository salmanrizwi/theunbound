import React from 'react';
import { Destination, HomepageConfig } from '../types';
import { Compass, ArrowRight, ShieldCheck, CheckCircle2, Globe2, Building2, Clock, Sparkles, MapPin, Award, Layers, PlusCircle } from 'lucide-react';
import { countingEngine } from '../services/countingEngine';
import { navigateTo } from '../services/portalRouter';

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
  const breakdown = countingEngine.getCountsBreakdown();
  const totalDestinations = destList.length;
  const totalHubs = breakdown.hubs;
  const totalProducts = breakdown.totalProducts;
  const totalHotels = breakdown.hotels;
  const destinationNamesList = destList.map(d => d.name).join(', ');
  const sampleHubNames = destList.flatMap(d => (d.cities ? d.cities.map(c => c.name) : [])).slice(0, 3).join(', ');

  // CMS Driven Values with Professional B2B DMC Fallbacks
  const heroImage = config?.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop';
  const heroImageAlt = config?.heroImageAlt || 'TheUnbound Premier Ground Operations & Wholesale DMC Network';
  const overlayOpacity = config?.heroOverlayOpacity !== undefined ? config.heroOverlayOpacity : 0.65;
  const heroBadge = config?.heroBadgeText || 'UNBOUND EXPERIENCES INDIA PVT LTD • OPERATIONS DESK';
  const heroTitle = config?.heroHeading || 'Premier Ground Operations & Wholesale DMC Network';
  const heroSubtitle = config?.heroSubheading || 'Contracted wholesale rates, verified licensed bilingual guides, executive transfers, and 24–48h SLA booking operations across Japan, the UK, Europe, Southeast Asia, and the Middle East.';
  
  const showPrimaryCta = config?.showPrimaryCta !== false;
  const primaryCtaText = config?.primaryCtaText || 'Explore Contracted Inventory';
  const showSecondaryCta = config?.showSecondaryCta !== false;
  const secondaryCtaText = config?.secondaryCtaText || 'View Destination Gateways';

  const trustBadges = (config?.heroTrustBadges && config.heroTrustBadges.length > 0)
    ? config.heroTrustBadges
    : [
        { label: 'Destinations', subtext: `${totalDestinations} Core Regions`, icon: 'Globe2' },
        { label: 'City Hubs', subtext: `${totalHubs} Direct Gateways`, icon: 'Building2' },
        { label: 'Ground Logistics', subtext: '100% Direct Contracts', icon: 'ShieldCheck' },
        { label: 'Operations SLA', subtext: '24–48h Booking Desk', icon: 'Clock' }
      ];

  const sellingPoints = (config?.heroSellingPoints && config.heroSellingPoints.length > 0)
    ? config.heroSellingPoints
    : [
        'Direct B2B net contracted rates with verified ground suppliers',
        'Dedicated on-ground operations desks in Tokyo, London, Paris & Bangkok',
        'Verified licensed bilingual private guides & executive chauffeur fleets',
        'Instant B2B white-label client quotation generation in multi-currency'
      ];

  const handleSecondaryCtaClick = () => {
    const el = document.getElementById('destinations-grid-heading');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollBy({ top: 500, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-8 mb-10">
      {/* Main Global Portfolio Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 text-white shadow-xl border border-slate-800">
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

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 sm:py-16 lg:px-8">
          {/* Operational Eyebrow Badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/40 backdrop-blur-md mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{heroBadge}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            {heroTitle}
          </h1>

          <p className="text-sm sm:text-base text-slate-200 max-w-3xl leading-relaxed mb-8">
            {heroSubtitle}
          </p>

          {/* Key Global DMC Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mb-8">
            {trustBadges.map((badge, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3.5 hover:bg-white/15 transition-colors">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block mb-0.5">
                  {badge.label}
                </span>
                <span className="text-lg sm:text-xl font-bold text-white block">
                  {badge.subtext}
                </span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {showPrimaryCta && (
              <button
                id="hero-explore-all-products-btn"
                onClick={onExploreProducts}
                className="bg-[#00C6A6] text-slate-950 px-6 py-2.5 rounded-xl font-bold hover:bg-[#00b296] transition-all shadow-md cursor-pointer text-xs sm:text-sm flex items-center space-x-2"
              >
                <Compass className="w-4 h-4" />
                <span>{primaryCtaText}</span>
              </button>
            )}

            {showSecondaryCta && (
              <button
                id="hero-view-gateways-btn"
                onClick={handleSecondaryCtaClick}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/20 px-5 py-2.5 rounded-xl font-bold transition-all cursor-pointer text-xs sm:text-sm backdrop-blur-md flex items-center space-x-2"
              >
                <Globe2 className="w-4 h-4 text-[#00E5C0]" />
                <span>{secondaryCtaText}</span>
              </button>
            )}

            <div className="flex items-center space-x-2 text-xs text-slate-300 ml-1">
              <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
              <span>Direct Inbound DMC Licensing & Wholesale Tariffs</span>
            </div>
          </div>

          {/* Quick Access Actions: Create Quote, AI Planner, Ready-Made Packages */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-white/10 mt-2">
            <button
              id="hero-create-quote-btn"
              onClick={() => navigateTo('/b2b/quote-builder')}
              className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md cursor-pointer hover:scale-[1.02]"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Quote</span>
            </button>

            <button
              id="hero-ai-planner-btn"
              onClick={() => navigateTo('/b2b/ai-planner')}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 hover:from-teal-800 hover:to-indigo-900 text-white px-4 py-2 rounded-xl text-xs font-bold border border-teal-500/40 transition-all shadow-md cursor-pointer hover:scale-[1.02] group"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00E5C0] group-hover:rotate-12 transition-transform" />
              <span>AI Planner</span>
              <span className="text-[9px] bg-[#00E5C0] text-slate-950 px-1 py-0.5 rounded-full font-black uppercase tracking-wider">AI</span>
            </button>

            <button
              id="hero-ready-made-packages-btn"
              onClick={() => {
                const el = document.getElementById('ready-made-packages-section');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigateTo('/b2b/packages');
                }
              }}
              className="inline-flex items-center space-x-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-md hover:scale-[1.02]"
            >
              <Layers className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>Ready-Made Packages</span>
            </button>
          </div>
        </div>

        {/* Value Highlights Bar */}
        <div className="relative z-10 bg-slate-900/95 backdrop-blur-md border-t border-white/10 px-6 py-3.5">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-300">
            {sellingPoints.map((point, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#00C6A6] shrink-0" />
                <span className="truncate">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Destination Feature Showcase Cards */}
      <div>
        <div id="destinations-grid-heading" className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Globe2 className="w-5 h-5 text-[#00C6A6]" />
              <span>Explore Our {totalDestinations} Core Destination Operations</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
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

                {/* Hub Count & Inventory Pill */}
                <div className="absolute top-3 right-3 flex items-center space-x-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#00C6A6] text-slate-950 shadow-xs">
                    {metrics.hubsCount || (dest.cities ? (dest.cities || []).length : 0)} Hubs
                  </span>
                  {metrics.productsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/90 text-white border border-white/20 backdrop-blur-xs">
                      {metrics.productsCount} Tours
                    </span>
                  )}
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
                  {dest.highlights && (dest.highlights || []).length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        DMC Key Highlights
                      </span>
                      <ul className="space-y-1">
                        {(dest.highlights || []).slice(0, 2).map((h, i) => (
                          <li key={i} className="text-xs text-slate-700 flex items-start space-x-1.5">
                            <span className="text-[#00C6A6] font-bold mt-0.5">•</span>
                            <span className="line-clamp-1">{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Hub Preview */}
                  {dest.cities && (dest.cities || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {(dest.cities || []).slice(0, 4).map((c, cIdx) => (
                        <span
                          key={`dest-city-${dest.id || dest.slug}-${c.id || c.name}-${cIdx}`}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium"
                        >
                          {c.name}
                        </span>
                      ))}
                      {(dest.cities || []).length > 4 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[11px]">
                          +{(dest.cities || []).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Link */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#008972] transition-colors flex items-center space-x-1">
                    <span>View {dest.name} Products ({metrics.productsCount})</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-slate-400">
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
