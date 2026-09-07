import React, { useState, useMemo } from 'react';
import { Promotion, HeroPromotionConfig } from '../../types';
import { AppDatabase } from '../../services/db';
import { Tag, Sparkles, ArrowRight, Copy, Check, Clock, ExternalLink } from 'lucide-react';
import { navigateTo } from '../../services/portalRouter';

interface HeroPromotionBannerProps {
  config?: HeroPromotionConfig;
  destinationId?: string;
  className?: string;
}

export const HeroPromotionBanner: React.FC<HeroPromotionBannerProps> = ({
  config,
  destinationId,
  className = ''
}) => {
  const db = AppDatabase.getInstance();
  const [copied, setCopied] = useState(false);

  // Find promotion based on configuration
  const activePromo = useMemo(() => {
    if (config?.enabled === false) return null;

    const allActive = db.getActivePromotions();
    if (allActive.length === 0) return null;

    // If manual promotion specified
    if (config?.mode === 'MANUAL' && config.manualPromotionId) {
      const found = allActive.find(p => p.id === config.manualPromotionId);
      if (found) return found;
    }

    // Filter by destination if on destination page
    if (destinationId && destinationId !== 'all') {
      const destPromo = allActive.find(p => p.destinationId === destinationId);
      if (destPromo) return destPromo;
    }

    // Default: Top priority active promotion
    return allActive[0];
  }, [config, destinationId, db]);

  if (!activePromo) return null;

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activePromo.promoCode) {
      navigator.clipboard.writeText(activePromo.promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCtaClick = () => {
    if (activePromo.ctaLink) {
      if (activePromo.ctaLink.startsWith('http')) {
        window.open(activePromo.ctaLink, '_blank', 'noopener,noreferrer');
      } else {
        navigateTo(activePromo.ctaLink);
      }
    } else {
      navigateTo('/b2b/quote-builder');
    }
  };

  const discountBadge = activePromo.discountType === 'PERCENTAGE'
    ? `${activePromo.discountValue}% OFF`
    : `${activePromo.currency || '$'}${activePromo.discountValue} OFF`;

  return (
    <div 
      className={`w-full max-w-4xl mx-auto mb-3 px-3 py-1.5 rounded-full bg-slate-950/70 border border-[#00C6A6]/30 backdrop-blur-md shadow-md flex flex-wrap items-center justify-between gap-2 text-white ${className}`}
      id="hero-active-campaign-banner"
    >
      {/* Left Details */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#00C6A6] text-slate-950 shadow-xs shrink-0 flex items-center space-x-1">
          <Sparkles className="w-2.5 h-2.5 text-slate-950" />
          <span>{config?.customBadge || 'SPECIAL OFFER'}</span>
        </span>

        <div className="flex items-center space-x-2 min-w-0 truncate">
          <span className="text-xs font-bold text-white truncate">
            {activePromo.title}
          </span>
          <span className="text-[11px] font-extrabold text-[#00E5C0] shrink-0">
            • {discountBadge}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2 shrink-0 ml-auto">
        {activePromo.promoCode && (
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] font-mono font-bold text-slate-200 transition-colors cursor-pointer"
            title="Click to copy promo code"
          >
            {copied ? <Check className="w-2.5 h-2.5 text-[#00C6A6]" /> : <Copy className="w-2.5 h-2.5 text-slate-400" />}
            <span>{activePromo.promoCode}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleCtaClick}
          className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <span>{activePromo.ctaText || 'Claim'}</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};
