import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AssociatedPartner, HomepageConfig } from '../../types';
import { AppDatabase } from '../../services/db';
import { ChevronLeft, ChevronRight, ExternalLink, Handshake } from 'lucide-react';

interface AssociatedPartnersCarouselProps {
  homepageConfig?: HomepageConfig;
  className?: string;
  previewPartners?: AssociatedPartner[]; // Allows Admin CMS preview
  showEvenIfEmptyInPreview?: boolean;
}

export const AssociatedPartnersCarousel: React.FC<AssociatedPartnersCarouselProps> = ({
  homepageConfig,
  className = '',
  previewPartners,
  showEvenIfEmptyInPreview = false
}) => {
  const db = AppDatabase.getInstance();
  const [livePartners, setLivePartners] = useState<AssociatedPartner[]>(() => {
    if (previewPartners) return previewPartners;
    return db.getAssociatedPartners(true);
  });
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Scroller refs for manual navigation & drag
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    if (previewPartners) {
      setLivePartners(previewPartners);
      return;
    }
    const update = () => {
      setLivePartners(db.getAssociatedPartners(true));
    };
    const unsub = db.subscribe(update);
    return () => unsub();
  }, [previewPartners, db]);

  // Reduced motion detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const activePartners = useMemo(() => {
    return (livePartners || []).filter(p => p.isActive !== false);
  }, [livePartners]);

  // Configuration strings
  const badgeText = homepageConfig?.associatedPartnersBadge || 'STRATEGIC COLLABORATION';
  const sectionTitle = homepageConfig?.associatedPartnersTitle || 'Our Associated Partners';
  const sectionSubtitle =
    homepageConfig?.associatedPartnersSubtitle ||
    'Working together with trusted partners to create seamless travel experiences.';

  const handleImageError = (partnerId: string) => {
    setFailedImages(prev => ({ ...prev, [partnerId]: true }));
  };

  // Manual scrolling controls
  const handleScroll = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollAmount = Math.max(container.clientWidth * 0.6, 260);
    const targetScroll =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }, []);

  // Pointer drag & touch gestures
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - container.offsetLeft;
    scrollLeftRef.current = container.scrollLeft;
    setIsPaused(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Drag sensitivity
    container.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    setIsPaused(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    isDraggingRef.current = true;
    startXRef.current = e.touches[0].pageX - container.offsetLeft;
    scrollLeftRef.current = container.scrollLeft;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const x = e.touches[0].pageX - container.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    container.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    setIsPaused(false);
  };

  // Continuous auto-scrolling ticker when not paused and motion is allowed
  useEffect(() => {
    if (prefersReducedMotion || isPaused || activePartners.length <= 1) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    const speed = 0.55; // Pixels per frame (slow, elegant speed)

    const scrollStep = (currentTime: number) => {
      if (!isPaused && !isDraggingRef.current && container) {
        const delta = Math.min(currentTime - lastTime, 50);
        lastTime = currentTime;

        container.scrollLeft += speed * (delta / 16.667);

        // Infinite seamless loop wrap: half of content width
        const scrollWidthHalf = container.scrollWidth / 2;
        if (scrollWidthHalf > 0 && container.scrollLeft >= scrollWidthHalf) {
          container.scrollLeft -= scrollWidthHalf;
        }
      } else {
        lastTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(scrollStep);
    };

    animationFrameId = requestAnimationFrame(scrollStep);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, prefersReducedMotion, activePartners.length]);

  // If no active partners and not in preview mode, cleanly return null (STRICT NO DUMMY DATA)
  if (activePartners.length === 0) {
    if (showEvenIfEmptyInPreview) {
      return (
        <section
          id="homepage-associated-partners"
          className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}
        >
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
            <Handshake className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Our Associated Partners</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No active partner logos added yet. Use the Admin CMS to add partner organizations,
              airlines, hotel groups, or tourism boards.
            </p>
          </div>
        </section>
      );
    }
    return null;
  }

  // Multiply items to achieve infinite seamless loop
  // Need at least 14 items across the marquee loop track
  const duplicatedPartners =
    activePartners.length >= 7
      ? [...activePartners, ...activePartners]
      : activePartners.length >= 4
      ? [...activePartners, ...activePartners, ...activePartners]
      : [...activePartners, ...activePartners, ...activePartners, ...activePartners, ...activePartners];

  return (
    <section
      id="homepage-associated-partners"
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}
      aria-label="Our Associated Partners"
    >
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xs space-y-6 sm:space-y-8 relative overflow-hidden group">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-100 pb-5 text-left">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-[#008972] text-xs font-bold uppercase tracking-wider">
              <Handshake className="w-3.5 h-3.5 text-[#008972]" />
              <span>{badgeText}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {sectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              {sectionSubtitle}
            </p>
          </div>

          {/* Navigation Arrows for manual browsing */}
          <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              aria-label="Previous partner logos"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-[#00C6A6] text-slate-700 hover:text-slate-950 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80 shadow-2xs focus-visible:ring-2 focus-visible:ring-[#00C6A6] focus-visible:outline-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              aria-label="Next partner logos"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-[#00C6A6] text-slate-700 hover:text-slate-950 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80 shadow-2xs focus-visible:ring-2 focus-visible:ring-[#00C6A6] focus-visible:outline-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel Landscape Container */}
        <div
          className="relative w-full overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={handleMouseUpOrLeave}
        >
          {/* Subtle Left & Right edge blur gradients */}
          <div
            className="absolute left-0 inset-y-0 w-8 sm:w-16 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10"
            aria-hidden="true"
          />
          <div
            className="absolute right-0 inset-y-0 w-8 sm:w-16 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10"
            aria-hidden="true"
          />

          {/* Scrollable Track */}
          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex items-center space-x-4 sm:space-x-6 overflow-x-auto scrollbar-none py-2 cursor-grab active:cursor-grabbing select-none"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {duplicatedPartners.map((partner, index) => {
              const uniqueKey = `partner-${partner.id}-${index}`;
              const isImageBroken = failedImages[partner.id] || !partner.logoUrl;
              const hasLink = Boolean(partner.websiteUrl && partner.websiteUrl.trim());

              const cardContent = (
                <div
                  className={`relative flex items-center justify-center h-20 sm:h-24 px-5 sm:px-6 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/90 hover:border-[#00C6A6]/60 shadow-2xs hover:shadow-md transition-all duration-300 shrink-0 w-40 sm:w-52 md:w-56 group/card ${
                    hasLink ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  title={partner.name}
                >
                  {/* Category Pill / Kicker if present */}
                  {partner.category && (
                    <span className="absolute top-1.5 left-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 group-hover/card:text-[#008972] transition-colors truncate max-w-[85%]">
                      {partner.category}
                    </span>
                  )}

                  {/* Logo Display or Text Fallback */}
                  <div className="w-full h-11 sm:h-12 flex items-center justify-center overflow-hidden px-1">
                    {!isImageBroken ? (
                      <img
                        src={partner.logoUrl}
                        alt={`${partner.name} logo`}
                        className="max-h-full max-w-full object-contain filter grayscale group-hover/card:grayscale-0 contrast-125 opacity-75 group-hover/card:opacity-100 transition-all duration-300"
                        onError={() => handleImageError(partner.id)}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="text-xs sm:text-sm font-black text-slate-800 tracking-tight group-hover/card:text-[#008972] transition-colors line-clamp-1">
                          {partner.name}
                        </span>
                        {partner.description && (
                          <span className="text-[10px] text-slate-400 line-clamp-1">
                            {partner.description}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* External link hint icon */}
                  {hasLink && (
                    <div className="absolute bottom-1.5 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3 text-[#008972]" />
                    </div>
                  )}
                </div>
              );

              if (hasLink) {
                return (
                  <a
                    key={uniqueKey}
                    href={partner.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit ${partner.name} website`}
                    className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C6A6] rounded-2xl"
                  >
                    {cardContent}
                  </a>
                );
              }

              return (
                <div key={uniqueKey} className="shrink-0">
                  {cardContent}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
