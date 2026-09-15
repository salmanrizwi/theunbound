import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  Layers,
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Globe2, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Sparkles,
  MapPin,
  ChevronRight,
  Terminal
} from 'lucide-react';
import { Destination } from '../../types';
import { useAuth } from '../../context/AuthContext';

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
  const { openAuthModal, login } = useAuth();

  // Inline Quick Terminal state for the visual card
  const [showInlineTerminal, setShowInlineTerminal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both your registered trade email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await login(email.trim(), 'B2B_AGENT', password);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid credentials. Please verify your email and password.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign in failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePartnerClick = () => {
    if (onOpenRegister) {
      onOpenRegister();
    } else {
      openAuthModal('Register your travel agency to apply for an authorized B2B partner account.');
    }
  };

  const handleLoginClick = () => {
    openAuthModal('Sign in to access your authorized B2B wholesale portal.');
  };

  return (
    <section 
      id="buyer-homepage-hero"
      className="relative w-full bg-[#051124] text-white overflow-hidden border-b border-slate-800 flex items-center justify-center transition-all"
      style={{
        minHeight: 'calc(100svh - var(--header-height, 94px))'
      }}
    >
      {/* 1. Background Ambience & Photographic Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2200&auto=format&fit=crop"
          alt="TheUnbound Global DMC Operations Ambience"
          className="w-full h-full object-cover object-center opacity-25 mix-blend-luminosity scale-105"
          referrerPolicy="no-referrer"
        />
        {/* Deep Slate Contrast Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#051124] via-[#051124]/95 to-[#051124]/80" />
        
        {/* Subtle Brand Radial Lighting in #00C6A6 */}
        <div 
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: '#00C6A6' }}
        />
        <div 
          className="absolute -bottom-20 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: '#00C6A6' }}
        />
        
        {/* Ambient Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.06] pointer-events-none" 
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* 2. Core Viewport Container (Vertically Centered, No Excess Padding) */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-4 xl:py-6 flex items-center my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center w-full">
          
          {/* LEFT COLUMN (7 Cols): .hero-content (Max Width 620px) */}
          <div className="lg:col-span-7 w-full max-w-[620px] space-y-3 sm:space-y-4 text-left">
            
            {/* Operational Eyebrow Pill */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#00C6A6]/10 border border-[#00C6A6]/30 text-[#00E5C0] text-[10px] sm:text-xs font-black uppercase tracking-wider backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#00C6A6] animate-pulse"></span>
              <span>B2B Destination Management Company (DMC)</span>
            </div>

            {/* Main Display Headline (Mathematically Balanced for 1366x768 & 1280x720) */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-[32px] xl:text-[38px] font-black tracking-tight text-white leading-[1.14] uppercase font-sans">
                Your Exclusive <span className="text-[#00C6A6]">B2B DMC</span> Travel Platform
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-normal leading-relaxed">
                TheUnbound provides verified travel agencies with direct ground operations, wholesale net tariffs, customized white-label itineraries, and guaranteed 24–48h proposal SLAs.
              </p>
            </div>

            {/* Action Buttons: Primary & Secondary CTAs (Always Visible in First Viewport) */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-0.5">
              <button
                type="button"
                id="hero-login-b2b-btn"
                onClick={handleLoginClick}
                className="px-5 sm:px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] active:bg-[#009b82] text-slate-950 text-xs sm:text-sm font-black transition-all shadow-md shadow-[#00C6A6]/20 flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
              >
                <Lock className="w-4 h-4 text-slate-950" />
                <span>Login as B2B Agent</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>

              <button
                type="button"
                id="hero-request-partnership-btn"
                onClick={handlePartnerClick}
                className="px-4.5 sm:px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-bold transition-all backdrop-blur-md flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
              >
                <Building2 className="w-4 h-4 text-[#00C6A6]" />
                <span>Become a B2B Partner</span>
              </button>
            </div>

            {/* 3 Core Value Pillars Matrix (Tightly Grouped, Compact Heights) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-[#00C6A6]">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">Direct Contracts</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug">
                  Zero brokers. Owned vehicle fleets & verified local guides.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-[#00C6A6]">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">24–48h SLA</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug">
                  Guaranteed turnaround on bespoke multi-city proposals.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-[#00C6A6]">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">Net Wholesale</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug">
                  Confidential tariffs, multi-currency conversions & markups.
                </p>
              </div>
            </div>

            {/* Quick Destination Gateway Bar (Single Row, No Overflow) */}
            {allDestinations && allDestinations.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center space-x-1">
                  <Globe2 className="w-3 h-3 text-[#00C6A6]" />
                  <span>Ground Hubs:</span>
                </span>
                {allDestinations.slice(0, 6).map(dest => (
                  <button
                    key={dest.id || dest.slug}
                    onClick={() => onSelectDestination(dest.slug)}
                    className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-[#00C6A6]/20 border border-slate-700/80 hover:border-[#00C6A6]/50 text-[11px] font-medium text-slate-300 hover:text-[#00E5C0] transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <span>{dest.name}</span>
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* RIGHT COLUMN (5 Cols): .hero-visual (Constrained Viewport Height & Responsive Media) */}
          <div className="lg:col-span-5 w-full flex items-center justify-center">
            <div 
              id="hero-visual-card"
              className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-900 group aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11] max-h-[320px] sm:max-h-[360px] lg:max-h-[420px] xl:max-h-[460px]"
              style={{
                maxHeight: 'calc(100svh - var(--header-height, 94px) - 48px)'
              }}
            >
              {/* Primary Visual Media */}
              <img
                src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop"
                alt="TheUnbound Premier Ground Operations & Wholesale DMC Network"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />

              {/* Ambient Visual Shading for Contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-slate-950/60 pointer-events-none" />

              {/* Top Left Floating Status Badge */}
              <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/70 text-[10px] font-bold text-white shadow-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6] animate-pulse"></span>
                <span>Operations Desk • Japan, Europe & UK</span>
              </div>

              {/* Top Right Confidential Access Pill */}
              <div className="absolute top-2.5 sm:top-3 right-2.5 sm:right-3 inline-flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/70 text-[10px] font-bold text-slate-300">
                <Lock className="w-3 h-3 text-[#00C6A6]" />
                <span>Trade Only</span>
              </div>

              {/* Bottom Docked Quick Access & Interactive Terminal Strip */}
              {!showInlineTerminal ? (
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent backdrop-blur-xs border-t border-slate-800/80 text-white flex flex-col justify-end space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6]"></span>
                        <span>Direct B2B Ground Tariffs</span>
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-400">
                        Contracted wholesale rates & white-label quotes
                      </p>
                    </div>

                    <button
                      type="button"
                      id="hero-visual-toggle-terminal-btn"
                      onClick={() => setShowInlineTerminal(true)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-[10px] font-bold text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center space-x-1"
                      title="Open Fast Sign In Terminal"
                    >
                      <Terminal className="w-3 h-3 text-[#00C6A6]" />
                      <span className="hidden sm:inline">Fast Sign In</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      id="hero-visual-login-btn"
                      onClick={handleLoginClick}
                      className="w-full py-2 px-3 rounded-lg bg-[#00C6A6] hover:bg-[#00b094] active:bg-[#009b82] text-slate-950 text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs shadow-[#00C6A6]/20"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-950" />
                      <span>Agent Login</span>
                    </button>

                    <button
                      type="button"
                      id="hero-visual-register-btn"
                      onClick={handlePartnerClick}
                      className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold transition-all backdrop-blur-sm flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                      <span>Register Agency</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Inline Quick Terminal Overlay (Fits Comfortably in the Same Visual Frame) */
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md p-3.5 sm:p-4.5 flex flex-col justify-between overflow-y-auto animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-[#00C6A6] animate-pulse"></span>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                        B2B Agent Terminal
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInlineTerminal(false)}
                      className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded-md hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      Close ✕
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-[11px] flex items-start space-x-1.5 my-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleInlineLogin} className="space-y-2.5 my-auto text-left">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Trade Email Address
                      </label>
                      <input
                        type="email"
                        id="b2b-login-email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="agent@travelagency.com"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:border-[#00C6A6] focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => openAuthModal('Password Reset Assistance')}
                          className="text-[10px] text-[#00C6A6] hover:underline"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="b2b-login-password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:border-[#00C6A6] focus:outline-none pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="btn-inline-hero-login"
                      disabled={isLoading}
                      className="w-full py-2 px-3 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-black text-xs rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {isLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <span>Sign In to Trade Portal</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="text-[10px] text-slate-400 text-center pt-1 border-t border-slate-800/80 flex items-center justify-between">
                    <span>Authorized trade access only</span>
                    <button
                      type="button"
                      onClick={handlePartnerClick}
                      className="text-[#00C6A6] hover:underline font-bold cursor-pointer"
                    >
                      New Agency? Register
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
