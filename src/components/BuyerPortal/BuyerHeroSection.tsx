import React, { useState, useEffect } from 'react';
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
import { Destination, HomepageConfig, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { navigateTo } from '../../services/portalRouter';

interface BuyerHeroSectionProps {
  allDestinations: Destination[];
  onSelectDestination: (slug: string) => void;
  onOpenRegister?: () => void;
  config?: HomepageConfig;
  homepageConfig?: HomepageConfig;
}

export const BuyerHeroSection: React.FC<BuyerHeroSectionProps> = ({
  allDestinations,
  onSelectDestination,
  onOpenRegister,
  config,
  homepageConfig
}) => {
  const activeIncomingConfig = homepageConfig || config;
  const { user, isAuthenticated, openAuthModal, login } = useAuth();
  const isUserAdmin = isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER');
  const isUserAgent = isAuthenticated && (user?.role === 'B2B_AGENT' || user?.role === 'AGENT');
  const [currentConfig, setCurrentConfig] = useState<HomepageConfig>(() => activeIncomingConfig || db.getHomepageConfig());

  useEffect(() => {
    if (activeIncomingConfig) {
      setCurrentConfig(activeIncomingConfig);
    }
  }, [activeIncomingConfig]);

  useEffect(() => {
    return db.subscribe(() => {
      setCurrentConfig(db.getHomepageConfig());
    });
  }, []);

  // Inline Quick Terminal state for the visual card
  const [showInlineTerminal, setShowInlineTerminal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If Hero Section is disabled in CMS layout manager, hide
  if (currentConfig.showHeroSection === false) {
    return null;
  }

  // Resolved CMS copy & media values
  const eyebrowText = currentConfig.heroConfig?.eyebrowText || currentConfig.heroBadgeText || 'B2B Destination Management Company (DMC)';
  const heading = currentConfig.heroConfig?.heading || currentConfig.heroHeading || 'Your Exclusive B2B DMC Travel Platform';
  const headingHighlight = currentConfig.heroConfig?.headingHighlight || currentConfig.heroHighlightText || 'B2B DMC';
  const subheading = currentConfig.heroConfig?.subheading || currentConfig.heroSubheading || 'TheUnbound provides verified travel agencies with direct ground operations, wholesale net tariffs, customized white-label itineraries, and guaranteed 24–48h proposal SLAs.';
  
  const showPrimaryCta = (currentConfig.showPrimaryCta !== false) && (currentConfig.heroConfig?.ctas?.showPrimaryCta !== false);
  const primaryCtaText = currentConfig.heroConfig?.ctas?.primaryCtaText || currentConfig.primaryCtaText || 'Login as B2B Agent';
  
  const showSecondaryCta = (currentConfig.showSecondaryCta !== false) && (currentConfig.heroConfig?.ctas?.showSecondaryCta !== false);
  const secondaryCtaText = currentConfig.heroConfig?.ctas?.secondaryCtaText || currentConfig.secondaryCtaText || 'Become a B2B Partner';

  const showPillars = (currentConfig.heroConfig?.showPillars !== false) && (currentConfig.showHeroPillars !== false);
  const pillar1Title = currentConfig.heroConfig?.pillar1Title || currentConfig.pillar1Title || 'Direct Contracts';
  const pillar1Subtitle = currentConfig.heroConfig?.pillar1Subtitle || currentConfig.pillar1Subtitle || 'Zero brokers. Owned vehicle fleets & verified local guides.';
  const pillar2Title = currentConfig.heroConfig?.pillar2Title || currentConfig.pillar2Title || '24–48h SLA';
  const pillar2Subtitle = currentConfig.heroConfig?.pillar2Subtitle || currentConfig.pillar2Subtitle || 'Guaranteed turnaround on bespoke multi-city proposals.';
  const pillar3Title = currentConfig.heroConfig?.pillar3Title || currentConfig.pillar3Title || 'Net Wholesale';
  const pillar3Subtitle = currentConfig.heroConfig?.pillar3Subtitle || currentConfig.pillar3Subtitle || 'Confidential tariffs, multi-currency conversions & markups.';

  const showGateways = currentConfig.showHeroGateways !== false;
  const heroImage = currentConfig.heroConfig?.media?.desktopImageUrl || currentConfig.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop';
  const heroMobileImage = currentConfig.heroMobileImage || currentConfig.heroConfig?.media?.mobileImageUrl;
  const heroVideoUrl = currentConfig.heroVideoUrl || currentConfig.heroConfig?.media?.videoUrl;
  const heroImageAlt = currentConfig.heroConfig?.media?.altText || currentConfig.heroImageAlt || 'TheUnbound Premier Ground Operations & Wholesale DMC Network';
  const overlayOpacity = currentConfig.heroConfig?.media?.overlayOpacity ?? currentConfig.heroOverlayOpacity ?? 0.65;
  const statusBadgeText = currentConfig.heroStatusBadgeText || 'Operations Desk • Japan, Europe & UK';
  const tradeBadgeText = currentConfig.heroTradeBadgeText || 'Trade Only';
  const visualPanelTitle = currentConfig.heroVisualPanelTitle || 'Direct B2B Ground Tariffs';
  const visualPanelDesc = currentConfig.heroVisualPanelDescription || 'Contracted wholesale rates & white-label quotes';
  const visualMaxHeight = Math.min(Math.max(currentConfig.heroVisualMaxHeight || 420, 300), 480);

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both your registered trade email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    let roleToSubmit: UserRole = 'B2B_AGENT';
    if (['admin@theunbound.com', 'business@theunbound.in', 'marcus@theunbound.in'].includes(cleanEmail) || cleanEmail.endsWith('@theunbound.in')) {
      roleToSubmit = cleanEmail === 'kenji.ops@theunbound.in' ? 'TEAM_MEMBER' : 'ADMIN';
    }

    try {
      const res = await login(cleanEmail, roleToSubmit, password);
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
    if (isAuthenticated) {
      if (isUserAdmin) {
        navigateTo('/b2b');
      } else {
        navigateTo('/b2b/quote-builder');
      }
      return;
    }
    if (onOpenRegister) {
      onOpenRegister();
    } else {
      openAuthModal('Register your travel agency to apply for an authorized B2B partner account.');
    }
  };

  const handleLoginClick = () => {
    if (isAuthenticated) {
      if (isUserAdmin) {
        navigateTo('/admin');
      } else {
        navigateTo('/b2b');
      }
      return;
    }
    openAuthModal('Sign in to access your authorized B2B wholesale portal.');
  };

  // Headline rendering with highlighted keyword accent
  const renderHeadline = () => {
    if (!headingHighlight || !heading.toLowerCase().includes(headingHighlight.toLowerCase())) {
      return (
        <>
          {heading} {headingHighlight && !heading.toLowerCase().includes(headingHighlight.toLowerCase()) && (
            <span className="text-[#00C6A6]">{headingHighlight}</span>
          )}
        </>
      );
    }
    const escaped = headingHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = heading.split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === headingHighlight.toLowerCase() ? (
            <span key={i} className="text-[#00C6A6]">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <section 
      id="buyer-homepage-hero"
      className="relative w-full bg-[#051124] text-white overflow-hidden border-b border-slate-800 flex items-center justify-center transition-all"
      style={{
        minHeight: 'calc(100svh - var(--header-height, 94px))'
      }}
    >
      {/* 1. Background Ambience & Photographic / Video Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {heroVideoUrl ? (
          <video
            src={heroVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover object-center mix-blend-luminosity scale-105"
            style={{ opacity: Math.max(0.15, 1 - overlayOpacity) }}
          />
        ) : (
          <picture className="w-full h-full block">
            {heroMobileImage && <source media="(max-width: 640px)" srcSet={heroMobileImage} />}
            <img
              src={heroImage}
              alt={heroImageAlt}
              className="w-full h-full object-cover object-center mix-blend-luminosity scale-105"
              style={{ opacity: Math.max(0.15, 1 - overlayOpacity) }}
              referrerPolicy="no-referrer"
            />
          </picture>
        )}
        {/* Deep Slate Contrast Gradient */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-[#051124] via-[#051124]/95 to-[#051124]/80"
          style={{ opacity: overlayOpacity }}
        />
        
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

      {/* 2. Core Viewport Container (Vertically Centered, Viewport-Aware) */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-4 xl:py-6 flex items-center my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center w-full">
          
          {/* LEFT COLUMN (7 Cols): .hero-content (Max Width 620px) */}
          <div className="lg:col-span-7 w-full max-w-[620px] space-y-3 sm:space-y-4 text-left">
            
            {/* Operational Eyebrow Pill */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#00C6A6]/10 border border-[#00C6A6]/30 text-[#00E5C0] text-[10px] sm:text-xs font-black uppercase tracking-wider backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#00C6A6] animate-pulse"></span>
              <span>{eyebrowText}</span>
            </div>

            {/* Main Display Headline (Mathematically Balanced for 1366x768 & 1280x720) */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-[32px] xl:text-[38px] font-black tracking-tight text-white leading-[1.14] uppercase font-sans">
                {renderHeadline()}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-normal leading-relaxed line-clamp-3">
                {subheading}
              </p>
            </div>

            {/* Action Buttons: Primary & Secondary CTAs (Always Visible in First Viewport) */}
            {(showPrimaryCta || showSecondaryCta) && (
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-0.5">
                {showPrimaryCta && (
                  <button
                    type="button"
                    id="hero-login-b2b-btn"
                    onClick={handleLoginClick}
                    className="px-5 sm:px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] active:bg-[#009b82] text-slate-950 text-xs sm:text-sm font-black transition-all shadow-md shadow-[#00C6A6]/20 flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Lock className="w-4 h-4 text-slate-950" />
                    <span>{isAuthenticated ? (isUserAdmin ? 'Enter Admin Operations' : 'Enter B2B Portal') : primaryCtaText}</span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </button>
                )}

                {showSecondaryCta && (
                  <button
                    type="button"
                    id="hero-request-partnership-btn"
                    onClick={handlePartnerClick}
                    className="px-4.5 sm:px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-bold transition-all backdrop-blur-md flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Building2 className="w-4 h-4 text-[#00C6A6]" />
                    <span>{isAuthenticated ? (isUserAdmin ? 'Wholesale B2B View' : 'Quotation Studio') : secondaryCtaText}</span>
                  </button>
                )}
              </div>
            )}

            {/* 3 Core Value Pillars Matrix (Tightly Grouped, Compact Heights) */}
            {showPillars && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-xs space-y-1">
                  <div className="flex items-center space-x-1.5 text-[#00C6A6]">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">
                      {pillar1Title}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {pillar1Subtitle}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-xs space-y-1">
                  <div className="flex items-center space-x-1.5 text-[#00C6A6]">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">
                      {pillar2Title}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {pillar2Subtitle}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-xs space-y-1">
                  <div className="flex items-center space-x-1.5 text-[#00C6A6]">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">
                      {pillar3Title}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {pillar3Subtitle}
                  </p>
                </div>
              </div>
            )}

            {/* Quick Destination Gateway Bar (Single Row, No Overflow) */}
            {showGateways && allDestinations && allDestinations.length > 0 && (
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
              className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-900 group aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11]"
              style={{
                maxHeight: `min(${visualMaxHeight}px, calc(100svh - var(--header-height, 94px) - 48px))`
              }}
            >
              {/* Primary Visual Media */}
              {heroVideoUrl ? (
                <video
                  src={heroVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                />
              ) : (
                <img
                  src={heroImage}
                  alt={heroImageAlt}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              )}

              {/* Ambient Visual Shading for Contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-slate-950/60 pointer-events-none" />

              {/* Top Left Floating Status Badge */}
              <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/70 text-[10px] font-bold text-white shadow-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6] animate-pulse"></span>
                <span>{statusBadgeText}</span>
              </div>

              {/* Top Right Confidential Access Pill */}
              <div className="absolute top-2.5 sm:top-3 right-2.5 sm:right-3 inline-flex items-center space-x-1 px-2 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/70 text-[10px] font-bold text-slate-300">
                <Lock className="w-3 h-3 text-[#00C6A6]" />
                <span>{tradeBadgeText}</span>
              </div>

              {/* Bottom Docked Quick Access & Interactive Terminal Strip */}
              {!showInlineTerminal ? (
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent backdrop-blur-xs border-t border-slate-800/80 text-white flex flex-col justify-end space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6]"></span>
                        <span>{visualPanelTitle}</span>
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-400">
                        {visualPanelDesc}
                      </p>
                    </div>

                    {!isAuthenticated && (
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
                    )}
                    {isAuthenticated && (
                      <span className="px-2 py-0.5 rounded-md bg-[#00C6A6]/20 border border-[#00C6A6]/40 text-[#00E5C0] text-[10px] font-bold">
                        {isUserAdmin ? 'Ops Admin' : 'Trade Partner'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      id="hero-visual-login-btn"
                      onClick={handleLoginClick}
                      className="w-full py-2 px-3 rounded-lg bg-[#00C6A6] hover:bg-[#00b094] active:bg-[#009b82] text-slate-950 text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs shadow-[#00C6A6]/20"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-950" />
                      <span>{isAuthenticated ? (isUserAdmin ? 'Admin CMS' : 'B2B Portal') : 'Agent Login'}</span>
                    </button>

                    <button
                      type="button"
                      id="hero-visual-register-btn"
                      onClick={handlePartnerClick}
                      className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold transition-all backdrop-blur-sm flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                      <span>{isAuthenticated ? (isUserAdmin ? 'Wholesale View' : 'Quote Studio') : 'Register Agency'}</span>
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

                  <form onSubmit={handleInlineLogin} className="space-y-2.5 my-auto">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Agency Email
                      </label>
                      <input
                        type="email"
                        id="b2b-hero-inline-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="agency@partner.com"
                        required
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C6A6]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="b2b-hero-inline-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C6A6] pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-slate-700 text-[#00C6A6] focus:ring-0 w-3 h-3 bg-slate-900"
                        />
                        <span>Remember</span>
                      </label>
                      <button
                        type="button"
                        onClick={handlePartnerClick}
                        className="text-[#00C6A6] hover:underline cursor-pointer"
                      >
                        Apply for account
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2 rounded-lg bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 mt-2"
                    >
                      {isLoading ? (
                        <span>Authenticating...</span>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Authorize & Enter Portal</span>
                        </>
                      )}
                    </button>
                  </form>

                  <div className="text-[10px] text-center text-slate-400 border-t border-slate-800/80 pt-1.5">
                    <span>Verified Trade Accounts Only • 256-bit Ground Encryption</span>
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

