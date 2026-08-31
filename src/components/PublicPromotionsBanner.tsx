import React, { useState, useEffect, useRef } from 'react';
import { Promotion } from '../types';
import { AppDatabase } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { campaignAnalytics } from '../services/campaignAnalyticsService';
import { 
  Tag, 
  Sparkles, 
  X, 
  Copy, 
  Check, 
  ArrowRight, 
  Percent, 
  DollarSign,
  Gift
} from 'lucide-react';

interface PublicPromotionsBannerProps {
  onNavigateDestination?: (destSlug: string) => void;
}

export const PublicPromotionsBanner: React.FC<PublicPromotionsBannerProps> = ({ onNavigateDestination }) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const audience = user?.role === 'B2B_AGENT' ? 'B2B_AGENT' : user?.role === 'BUYER' ? 'BUYER' : 'ALL';
  const activePromos = db.getActivePromotions(audience);

  // Find top banner promo and modal promo
  const bannerPromo = activePromos.find(p => p.displayPlacement === 'BANNER');
  const modalPromo = activePromos.find(p => p.displayPlacement === 'MODAL');

  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Deduplication refs for component lifecycle
  const trackedBannerIdRef = useRef<string | null>(null);
  const trackedModalIdRef = useRef<string | null>(null);

  // Track Banner View
  useEffect(() => {
    if (bannerPromo && !isBannerDismissed && trackedBannerIdRef.current !== bannerPromo.id) {
      trackedBannerIdRef.current = bannerPromo.id;
      campaignAnalytics.trackView(bannerPromo.id, 'BANNER', {
        title: bannerPromo.title,
        destinationId: bannerPromo.destinationId
      });
    }
  }, [bannerPromo?.id, isBannerDismissed]);

  // Modal display logic & View Tracking
  useEffect(() => {
    if (modalPromo) {
      const hasSeenModal = sessionStorage.getItem(`seen_promo_${modalPromo.id}`);
      if (!hasSeenModal || modalPromo.frequency === 'ALWAYS') {
        const timer = setTimeout(() => {
          setIsModalOpen(true);
          sessionStorage.setItem(`seen_promo_${modalPromo.id}`, 'true');
          
          if (trackedModalIdRef.current !== modalPromo.id) {
            trackedModalIdRef.current = modalPromo.id;
            campaignAnalytics.trackView(modalPromo.id, 'MODAL', {
              title: modalPromo.title,
              destinationId: modalPromo.destinationId
            });
          }
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [modalPromo?.id]);

  const handleCopyCode = (promo: Promotion, placement: string, ctaId: string) => {
    if (!promo.promoCode) return;
    navigator.clipboard.writeText(promo.promoCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);

    // Track click on promo code copy
    campaignAnalytics.trackClick(
      promo.id,
      placement,
      ctaId,
      `Copy Code: ${promo.promoCode}`,
      { destinationId: promo.destinationId }
    );
  };

  const handlePromoClick = (promo: Promotion, placement: string, ctaId: string) => {
    // Record genuine campaign click event with attribution
    campaignAnalytics.trackClick(
      promo.id,
      placement,
      ctaId,
      promo.ctaText || 'Learn More',
      { destinationId: promo.destinationId, ctaLink: promo.ctaLink }
    );

    if (promo.ctaLink && onNavigateDestination) {
      if (promo.ctaLink.startsWith('/destinations/')) {
        const slug = promo.ctaLink.replace('/destinations/', '');
        onNavigateDestination(slug);
      }
    }
  };

  return (
    <>
      {/* Top Banner */}
      {bannerPromo && !isBannerDismissed && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white border-b border-[#00C6A6]/30 px-4 py-2.5 text-xs relative z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3 overflow-hidden">
              <span className="hidden sm:inline-flex items-center space-x-1 bg-[#00C6A6]/20 border border-[#00C6A6]/40 text-[#00E5C0] font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
                <Sparkles className="w-3 h-3" />
                <span>Special Offer</span>
              </span>

              <div className="truncate">
                <strong className="text-white font-bold">{bannerPromo.title}:</strong>{' '}
                <span className="text-slate-300 hidden md:inline">{bannerPromo.subtitle || bannerPromo.description}</span>
              </div>

              {bannerPromo.promoCode && (
                <button
                  onClick={() => handleCopyCode(bannerPromo, 'BANNER', 'banner_copy_code')}
                  className="hidden sm:inline-flex items-center space-x-1 font-mono text-[10px] bg-slate-800 hover:bg-slate-700 text-[#00E5C0] border border-slate-700 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                  title="Click to copy promo code"
                >
                  <span>{bannerPromo.promoCode}</span>
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              {bannerPromo.ctaText && (
                <button
                  onClick={() => handlePromoClick(bannerPromo, 'BANNER', 'banner_explore_btn')}
                  className="inline-flex items-center space-x-1 text-[#00E5C0] hover:text-white font-bold text-[11px] underline underline-offset-4 cursor-pointer"
                >
                  <span>{bannerPromo.ctaText}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => setIsBannerDismissed(true)}
                className="text-slate-400 hover:text-white p-1 rounded-full cursor-pointer"
                title="Dismiss banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup Promo */}
      {modalPromo && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-900/60 text-white hover:bg-slate-900 flex items-center justify-center cursor-pointer transition-colors backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative h-48 bg-slate-900">
              <img
                src={modalPromo.bannerImage || 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=800&auto=format&fit=crop'}
                alt={modalPromo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 text-white">
                <span className="inline-flex items-center space-x-1 bg-[#00C6A6] text-slate-950 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-1 shadow-md">
                  <Gift className="w-3 h-3" />
                  <span>Exclusive Privilege</span>
                </span>
                <h3 className="text-xl font-bold text-white leading-tight">
                  {modalPromo.title}
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600">
              <p className="text-sm font-semibold text-slate-800 leading-snug">
                {modalPromo.subtitle}
              </p>
              <p className="text-slate-500 leading-relaxed">
                {modalPromo.description}
              </p>

              {modalPromo.promoCode && (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Exclusive Code</span>
                    <span className="font-mono text-sm font-bold text-slate-900 tracking-wider">
                      {modalPromo.promoCode}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(modalPromo, 'MODAL', 'modal_copy_code')}
                    className="inline-flex items-center space-x-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  No thanks
                </button>
                <button
                  onClick={() => {
                    handlePromoClick(modalPromo, 'MODAL', 'modal_claim_btn');
                    setIsModalOpen(false);
                  }}
                  className="px-6 py-2.5 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold rounded-xl shadow-md cursor-pointer transition-colors text-xs"
                >
                  {modalPromo.ctaText || 'Explore Privileges'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
