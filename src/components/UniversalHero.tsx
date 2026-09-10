import React from 'react';
import { 
  UniversalHeroConfig, 
  Destination, 
  HomepageConfig, 
  HeroSearchParams,
  HeroContextType 
} from '../types';
import { Plane, Cpu, Sparkles, ArrowRight } from 'lucide-react';
import { navigateTo } from '../services/portalRouter';
import { HeroTrustStrip } from './Hero/HeroTrustStrip';
import { HeroPromotionBanner } from './Hero/HeroPromotionBanner';
import { useAuth } from '../context/AuthContext';

export interface UniversalHeroProps {
  context?: HeroContextType;
  config?: UniversalHeroConfig;
  homepageConfig?: HomepageConfig; // Backwards compatibility & legacy fallbacks
  destination?: Destination;       // When in DESTINATION context
  allDestinations?: Destination[];
  onSearch?: (params: HeroSearchParams) => void;
  onExploreProducts?: () => void;
  onSelectDestination?: (slug: string) => void;
  className?: string;
}

export const UniversalHero: React.FC<UniversalHeroProps> = ({
  context = 'HOMEPAGE',
  config,
  homepageConfig,
  destination,
  allDestinations = [],
  onSearch,
  onExploreProducts,
  onSelectDestination,
  className = ''
}) => {
  // Authentication-aware rendering to guarantee no Hero search for authenticated users
  const { isAuthenticated, user } = useAuth();
  const isLoggedIn = isAuthenticated || !!user;

  // Merge structured heroConfig with legacy / fallback properties
  const isDest = context === 'DESTINATION' && !!destination;

  // Media resolution
  const mediaConfig = config?.media || destination?.heroConfig?.media || homepageConfig?.heroConfig?.media;
  
  const desktopImage = mediaConfig?.desktopImageUrl || 
    (isDest ? destination?.heroImage : homepageConfig?.heroImage) ||
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop';
  
  const tabletImage = mediaConfig?.tabletImageUrl || desktopImage;
  const mobileImage = mediaConfig?.mobileImageUrl || tabletImage;
  const videoUrl = mediaConfig?.videoUrl;
  const posterImage = mediaConfig?.posterImageUrl || desktopImage;
  const altText = mediaConfig?.altText || 
    (isDest ? destination?.heroImageAlt : homepageConfig?.heroImageAlt) || 
    'TheUnbound Travel DMC Platform';

  // Overlay calculation
  let overlayOpacity = 0.65;
  if (mediaConfig?.overlayOpacity !== undefined) {
    overlayOpacity = mediaConfig.overlayOpacity;
  } else if (mediaConfig?.overlayIntensity) {
    switch (mediaConfig.overlayIntensity) {
      case 'none': overlayOpacity = 0.15; break;
      case 'light': overlayOpacity = 0.35; break;
      case 'medium': overlayOpacity = 0.65; break;
      case 'strong': overlayOpacity = 0.85; break;
      case 'custom': overlayOpacity = mediaConfig.overlayOpacity ?? 0.65; break;
    }
  } else if (isDest && destination?.heroOverlayOpacity !== undefined) {
    overlayOpacity = destination.heroOverlayOpacity;
  } else if (homepageConfig?.heroOverlayOpacity !== undefined) {
    overlayOpacity = homepageConfig.heroOverlayOpacity;
  }

  // Eyebrow Tag
  const eyebrow = config?.eyebrowText || 
    (isDest ? (destination?.heroEyebrow || (destination?.country ? `${destination.country.toUpperCase()} • GROUND DMC OPERATIONS` : 'CURATED JOURNEYS')) : 
    (homepageConfig?.heroBadgeText || 'ESTABLISHED IN 2025 • B2B DESTINATION MANAGEMENT COMPANY'));

  // Heading & Highlighting
  const heading = config?.heading || 
    (isDest ? (destination?.name ? destination.name.toUpperCase() : 'DESTINATION') : 
    (homepageConfig?.heroHeading || 'DESTINATION MANAGEMENT'));

  const headingHighlight = config?.headingHighlight !== undefined 
    ? config.headingHighlight 
    : (isDest ? '' : (homepageConfig?.heroHeadingHighlight || 'SIMPLIFIED BY INTELLIGENCE.'));

  // Subheading / Description
  const subheading = config?.subheading || 
    (isDest ? 
      (destination?.heroTitle 
        ? `${destination.heroTitle} — ${destination.tagline || destination.description || ''}`
        : (destination?.tagline || destination?.description || `Thoughtfully curated journeys, stays and experiences across ${destination?.name}'s most inspiring destinations.`)) : 
    (homepageConfig?.heroSubheading || 'TheUnbound combines destination expertise, travel technology and AI-powered package creation for modern travel professionals.'));

  // CTAs
  const ctas = config?.ctas || {
    showPrimaryCta: isDest ? (destination?.showPrimaryCta !== false) : (homepageConfig?.showPrimaryCta !== false),
    primaryCtaText: isDest ? (destination?.primaryCtaText || `EXPLORE ${destination?.name?.toUpperCase()} EXPERIENCES`) : (homepageConfig?.primaryCtaText || 'EXPLORE DESTINATIONS'),
    primaryCtaAction: 'EXPLORE_PRODUCTS',
    showSecondaryCta: isDest ? (destination?.showSecondaryCta !== false) : (homepageConfig?.showSecondaryCta !== false),
    secondaryCtaText: isDest ? (destination?.secondaryCtaText || 'BECOME A PARTNER') : (homepageConfig?.secondaryCtaText || 'BECOME A PARTNER'),
    secondaryCtaAction: 'QUOTE_BUILDER'
  };

  // Pillars & Trust Strip (Disabled when logged in or on destination hero to maintain clean editorial viewport)
  const showPillars = !isLoggedIn && context === 'HOMEPAGE' && config?.showPillars === true;
  const pillar1Title = config?.pillar1Title || 'DESTINATION EXPERTISE';
  const pillar1Subtitle = config?.pillar1Subtitle || 'Local knowledge. Destination services. Ground operations.';
  const pillar2Title = config?.pillar2Title || 'DIGITAL SOLUTIONS';
  const pillar2Subtitle = config?.pillar2Subtitle || 'Package creation. Quotations. Connected workflows.';
  const pillar3Title = config?.pillar3Title || 'AI-POWERED';
  const pillar3Subtitle = config?.pillar3Subtitle || 'Intelligent travel package creation in 30 seconds.';

  // Promotion Banner (Subtle single-line badge when configured)
  const promotionConfig = config?.promotion;

  // Trust Strip Items
  const showTrustStrip = !isLoggedIn && context === 'HOMEPAGE' && config?.showTrustStrip === true;
  const trustItems = config?.trustItems || [
    {
      title: 'Direct B2B Net Wholesale Rates',
      description: 'Contracted rates with verified ground suppliers',
      icon: 'ShieldCheck'
    },
    {
      title: '24–48h SLA Operations Desk',
      description: 'Dedicated on-ground operations in key hubs',
      icon: 'Clock'
    },
    {
      title: 'Verified Licensed Guides',
      description: 'Bilingual guides & executive chauffeur fleets',
      icon: 'Building2'
    },
    {
      title: 'White-Label Proposals',
      description: 'Instant multi-currency quotes & client itineraries',
      icon: 'Globe2'
    }
  ];

  // CTA Clicks
  const handlePrimaryCtaClick = () => {
    if (ctas.primaryCtaAction === 'CUSTOM' && ctas.primaryCtaLink) {
      navigateTo(ctas.primaryCtaLink);
    } else if (onExploreProducts) {
      onExploreProducts();
    } else {
      navigateTo('/b2b/quote-builder');
    }
  };

  const handleSecondaryCtaClick = () => {
    if (ctas.secondaryCtaAction === 'CUSTOM' && ctas.secondaryCtaLink) {
      navigateTo(ctas.secondaryCtaLink);
    } else if (ctas.secondaryCtaAction === 'AI_PLANNER') {
      navigateTo('/b2b/ai-planner');
    } else {
      navigateTo('/b2b/quote-builder');
    }
  };

  return (
    <div className={`w-full ${className}`} id="theunbound-universal-hero">
      {/* 1. Full-Width Digital Space Hero Container */}
      <div className="w-full bg-[#061329] text-white relative overflow-hidden border-b border-slate-800/80">
        
        {/* MEDIA LAYER: Image or Video */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {videoUrl ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={posterImage}
              className="w-full h-full object-cover object-center"
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
          ) : (
            <picture>
              <source media="(max-width: 640px)" srcSet={mobileImage} />
              <source media="(max-width: 1024px)" srcSet={tabletImage} />
              <img
                src={desktopImage}
                alt={altText}
                className="w-full h-full object-cover object-center transition-transform duration-1000 scale-100"
                style={{ objectPosition: mediaConfig?.focalPoint || 'center' }}
                referrerPolicy="no-referrer"
              />
            </picture>
          )}

          {/* Dynamic Contrast Tint Overlay */}
          <div 
            className="absolute inset-0 bg-slate-950 transition-opacity"
            style={{ opacity: overlayOpacity }}
          />
        </div>

        {/* Ambient Grid Pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20 z-1" 
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* Subtle Brand Teal Radial Lighting */}
        <div 
          className="absolute inset-0 pointer-events-none z-1"
          style={{
            background: 'radial-gradient(ellipse 60% 45% at 50% 25%, rgba(0, 198, 166, 0.08), transparent 70%)'
          }}
        />

        {/* Compact Inner Hero Content (Strictly Above-the-Fold on 1366x768 & 1440x900) */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 lg:py-11 relative z-10 text-center flex flex-col items-center justify-center w-full my-auto">
          
          {/* 1. Active Campaign Promotion Banner (compact single-line badge) */}
          {promotionConfig?.enabled !== false && (
            <HeroPromotionBanner
              config={promotionConfig}
              destinationId={destination?.id || destination?.slug}
              className="mb-2 sm:mb-2.5"
            />
          )}

          {/* 2. Top Pill Tag */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold tracking-widest text-[#00E5C0] bg-[#00C6A6]/10 border border-[#00C6A6]/25 uppercase backdrop-blur-md shadow-xs mb-2 sm:mb-2.5">
            <span>{eyebrow}</span>
          </div>

          {/* 3. Main Display Headline */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-extrabold font-sans tracking-tight text-white leading-[1.14] uppercase max-w-3xl mx-auto mb-2 sm:mb-2.5">
            {heading}{' '}
            {headingHighlight && (
              <span className="text-[#00C6A6]">{headingHighlight}</span>
            )}
          </h1>

          {/* 4. Subheading / Short Description */}
          <p className="text-xs sm:text-sm md:text-[15px] text-slate-200/90 max-w-xl mx-auto leading-relaxed font-normal mb-3 sm:mb-4">
            {subheading}
          </p>

          {/* 5. Primary & Secondary CTA Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full max-w-md mx-auto">
            {ctas.showPrimaryCta !== false && (
              <button
                id="hero-primary-cta-btn"
                onClick={handlePrimaryCtaClick}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs sm:text-sm font-black transition-all shadow-lg shadow-teal-950/40 cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
              >
                <span>{ctas.primaryCtaText}</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>
            )}

            {ctas.showSecondaryCta !== false && (
              <button
                id="hero-secondary-cta-btn"
                onClick={handleSecondaryCtaClick}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-bold transition-all backdrop-blur-xs cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
              >
                <span>{ctas.secondaryCtaText}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. THE THREE PILLARS (Rendered ONLY if explicitly enabled in CMS and user is logged out) */}
      {showPillars && (
        <div className="w-full bg-[#071326] border-b border-slate-800/80 px-4 sm:px-6 py-4 sm:py-5">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {/* Pillar 1: TRAVEL */}
              <div className="flex items-center space-x-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-[#00C6A6]/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl border border-[#00C6A6]/30 bg-[#00C6A6]/10 flex items-center justify-center text-[#00C6A6] shrink-0 group-hover:border-[#00C6A6] transition-colors">
                  <Plane className="w-4 h-4 text-[#00C6A6]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#00C6A6]">
                      TRAVEL
                    </span>
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-white truncate">
                    {pillar1Title}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {pillar1Subtitle}
                  </p>
                </div>
              </div>

              {/* Pillar 2: TECHNOLOGY */}
              <div className="flex items-center space-x-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-[#00C6A6]/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl border border-[#00C6A6]/30 bg-[#00C6A6]/10 flex items-center justify-center text-[#00C6A6] shrink-0 group-hover:border-[#00C6A6] transition-colors">
                  <Cpu className="w-4 h-4 text-[#00C6A6]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#00C6A6]">
                      TECHNOLOGY
                    </span>
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-white truncate">
                    {pillar2Title}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {pillar2Subtitle}
                  </p>
                </div>
              </div>

              {/* Pillar 3: INTELLIGENCE */}
              <div className="flex items-center space-x-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-[#00C6A6]/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl border border-[#00C6A6]/30 bg-[#00C6A6]/10 flex items-center justify-center text-[#00C6A6] shrink-0 group-hover:border-[#00C6A6] transition-colors">
                  <Sparkles className="w-4 h-4 text-[#00C6A6]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#00C6A6]">
                      INTELLIGENCE
                    </span>
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-white truncate">
                    {pillar3Title}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {pillar3Subtitle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. B2B Trust & Value Strip (Rendered ONLY if explicitly enabled in CMS and user is logged out) */}
      {showTrustStrip && (
        <HeroTrustStrip items={trustItems} />
      )}
    </div>
  );
};
