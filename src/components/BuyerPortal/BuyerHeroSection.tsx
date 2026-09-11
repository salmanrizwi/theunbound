import React from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Sparkles, 
  Globe2, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Compass, 
  Layers,
  Search,
  PhoneCall,
  Zap,
  Users
} from 'lucide-react';
import { Destination } from '../../types';
import { B2BLoginPanel } from './B2BLoginPanel';
import { useAuth } from '../../context/AuthContext';
import { navigateTo } from '../../services/portalRouter';

interface BuyerHeroSectionProps {
  allDestinations: Destination[];
  onSelectDestination: (slug: string) => void;
  onOpenRegister?: () => void;
}

export const BuyerHeroSection: React.FC<BuyerHeroSectionProps> = ({
  allDestinations,
  onSelectDestination,
  onOpenRegister
}) => {
  const { openAuthModal } = useAuth();

  return (
    <section 
      id="buyer-homepage-hero"
      className="relative w-full bg-[#051124] text-white overflow-hidden border-b border-slate-800"
    >
      {/* Background Ambience & Photographic Layer */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <img
          src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2200&auto=format&fit=crop"
          alt="TheUnbound Global DMC Operations"
          className="w-full h-full object-cover object-center opacity-30 mix-blend-luminosity scale-105"
        />
        {/* Deep Slate Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#051124] via-[#051124]/95 to-[#051124]/75" />
        {/* Subtle Radial Glow in #00C6A6 */}
        <div 
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: '#00C6A6' }}
        />
        <div 
          className="absolute -bottom-24 right-1/4 w-[32rem] h-[32rem] rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: '#00C6A6' }}
        />
        {/* Subtle Grid Accent */}
        <div 
          className="absolute inset-0 opacity-[0.07]" 
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT COLUMN (7 Cols): B2B Value Proposition, DMC Positioning, Quick Discovery */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
            
            {/* Top Operational Eyebrow Pill */}
            <div className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-[#00C6A6]/10 border border-[#00C6A6]/30 text-[#00E5C0] text-xs font-black uppercase tracking-wider backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#00C6A6] animate-pulse"></span>
              <span>B2B Destination Management Company (DMC)</span>
            </div>

            {/* Main Headline with High Visual Contrast */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[50px] font-black tracking-tight text-white leading-[1.12] uppercase font-sans">
                Your Exclusive <span className="text-[#00C6A6]">B2B DMC</span> Travel Platform
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
                TheUnbound provides authorised travel partners with direct access to curated travel services, operational support, wholesale net tariffs, and B2B booking tools.
              </p>
            </div>

            {/* Quick Action Discovery Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                id="hero-login-b2b-btn"
                onClick={() => {
                  const input = document.getElementById('b2b-login-email');
                  if (input) {
                    input.focus();
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else {
                    openAuthModal('Sign in to access your authorized B2B wholesale portal.');
                  }
                }}
                className="px-6 py-3 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] active:bg-[#009b82] text-slate-950 text-xs sm:text-sm font-black transition-all shadow-lg shadow-[#00C6A6]/20 flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
              >
                <Lock className="w-4 h-4" />
                <span>Login as B2B Agent</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                id="hero-request-partnership-btn"
                onClick={() => {
                  if (onOpenRegister) {
                    onOpenRegister();
                  } else {
                    openAuthModal('Register your travel agency to apply for an authorized B2B partner account.');
                  }
                }}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-bold transition-all backdrop-blur-md flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
              >
                <Building2 className="w-4 h-4 text-[#00C6A6]" />
                <span>Become a B2B Partner</span>
              </button>
            </div>

            {/* 3 Core Value Pillars Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-1">
                <div className="flex items-center space-x-2 text-[#00C6A6]">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Direct Contracts</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Zero brokers. Owned vehicle fleets and accredited local guides.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-1">
                <div className="flex items-center space-x-2 text-[#00C6A6]">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">24–48h SLA</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Guaranteed turnaround on complex multi-city bespoke proposals.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-1">
                <div className="flex items-center space-x-2 text-[#00C6A6]">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Net Wholesale</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Confidential tariffs, multi-currency conversions & custom markups.
                </p>
              </div>
            </div>

            {/* Quick Destination Pill Bar */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Active Ground Operations Hubs:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {allDestinations.map(dest => (
                  <button
                    key={dest.id || dest.slug}
                    onClick={() => onSelectDestination(dest.slug)}
                    className="px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-[#00C6A6]/20 border border-slate-700 hover:border-[#00C6A6]/50 text-xs font-bold text-slate-200 hover:text-[#00E5C0] transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>{dest.name}</span>
                    <span className="text-[10px] text-slate-400">({dest.country})</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (5 Cols): Integrated High-Conversion B2B Login/Register Terminal */}
          <div className="lg:col-span-5 w-full">
            <B2BLoginPanel />
          </div>

        </div>
      </div>
    </section>
  );
};
