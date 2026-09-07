import React from 'react';
import { ArrowRight, Sparkles, ShieldCheck, Headphones, FileText, CheckCircle2 } from 'lucide-react';
import { navigateTo } from '../services/portalRouter';

interface FinalCTAProps {
  title?: string;
  subtitle?: string;
  primaryButtonText?: string;
  primaryButtonLink?: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  destinationName?: string;
  className?: string;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({
  title,
  subtitle,
  primaryButtonText,
  primaryButtonLink = '/b2b/quote-builder',
  secondaryButtonText,
  secondaryButtonLink = '/contact',
  destinationName,
  className = ''
}) => {
  const displayTitle = title || (
    destinationName 
      ? `Ready to Craft a Bespoke ${destinationName} Itinerary?` 
      : 'Ready to Expand Your Inbound Luxury Ground Program?'
  );

  const displaySubtitle = subtitle || (
    destinationName
      ? `Connect directly with our ${destinationName} ground operations desk or build instant wholesale quotations tailored to your discerning travelers.`
      : 'Connect directly with our destination operations desk or build instant wholesale quotations with confidential net tariffs.'
  );

  const displayPrimaryText = primaryButtonText || 'Access B2B Quotation Studio';
  const displaySecondaryText = secondaryButtonText || 'Speak with DMC Desk';

  const handlePrimaryClick = () => {
    if (primaryButtonLink.startsWith('http')) {
      window.open(primaryButtonLink, '_blank');
    } else if (primaryButtonLink.startsWith('/')) {
      navigateTo(primaryButtonLink);
    } else if (primaryButtonLink === 'quotation') {
      navigateTo('/b2b/quote-builder');
    } else {
      navigateTo(`/${primaryButtonLink}`);
    }
  };

  const handleSecondaryClick = () => {
    if (secondaryButtonLink.startsWith('http')) {
      window.open(secondaryButtonLink, '_blank');
    } else if (secondaryButtonLink.startsWith('/')) {
      navigateTo(secondaryButtonLink);
    } else {
      navigateTo(`/${secondaryButtonLink}`);
    }
  };

  return (
    <section id="final-cta-section" className={`w-full ${className}`}>
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 lg:p-14 text-center text-white shadow-xl">
        {/* Subtle dot matrix */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-25" 
          style={{
            backgroundImage: 'radial-gradient(rgba(0, 198, 166, 0.4) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* Ambient teal glow */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(0, 198, 166, 0.12), transparent 70%)'
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest bg-white/5 border border-white/10 text-[#00E5C0] backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
            <span>ESTABLISHED IN 2025 • DIRECT WHOLESALE GROUND CONTRACTS</span>
          </div>

          {/* Heading */}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
            {displayTitle}
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            {displaySubtitle}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handlePrimaryClick}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <span>{displayPrimaryText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleSecondaryClick}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
            >
              <Headphones className="w-4 h-4 text-slate-300" />
              <span>{displaySecondaryText}</span>
            </button>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-400">
            <div className="flex items-center justify-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
              <span>24–48h SLA Operations Desk</span>
            </div>
            <div className="flex items-center justify-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
              <span>Direct DMC Wholesale Pricing</span>
            </div>
            <div className="flex items-center justify-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
              <span>100% Confidential B2B Escrow</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
