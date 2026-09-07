import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { HomepageConfig, Destination, HomepageFAQItem } from '../../types';
import { INITIAL_HOMEPAGE_CONFIG } from '../../data/initialHomepage';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutTemplate, 
  Save, 
  Eye, 
  Star, 
  Image as ImageIcon, 
  Tag, 
  CheckCircle2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles,
  Sliders,
  HelpCircle,
  Plus,
  Trash2,
  Edit2,
  Grid,
  Layers,
  Search,
  Check,
  Building2,
  MessageSquare,
  RotateCcw,
  Compass,
  ShieldCheck,
  Clock,
  Globe2,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Video,
  Award,
  Zap,
  Users,
  CheckSquare
} from 'lucide-react';
import { UniversalHero } from '../UniversalHero';
import { UniversalHeroConfig, HeroTrustItem } from '../../types';

interface HomepageManagerProps {
  destinations: Destination[];
}

export const HomepageManager: React.FC<HomepageManagerProps> = ({ destinations }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [config, setConfig] = useState<HomepageConfig>(db.getHomepageConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'LAYOUT' | 'HERO' | 'DESTINATIONS' | 'FAQS'>('LAYOUT');

  // Hero CMS Specific State
  const [previewDevice, setPreviewDevice] = useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('DESKTOP');
  const [heroConfigSection, setHeroConfigSection] = useState<'COPY' | 'MEDIA' | 'DISCOVERY' | 'PROMOTION' | 'PILLARS' | 'TRUST' | 'CTA'>('COPY');

  // FAQ Modal state
  const [isEditingFaq, setIsEditingFaq] = useState(false);
  const [faqForm, setFaqForm] = useState<Partial<HomepageFAQItem>>({
    question: '',
    answer: '',
    category: 'General',
    displayOrder: 1,
    isPublished: true
  });

  // Destination Search for adding to ordering
  const [destSearchQuery, setDestSearchQuery] = useState('');
  const [sellingPointInput, setSellingPointInput] = useState('');

  const HERO_IMAGE_PRESETS = [
    { name: 'Tokyo Operations (Modern)', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop' },
    { name: 'Global DMC Portfolio (Skyline)', url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=2000&auto=format&fit=crop' },
    { name: 'London & UK Heritage', url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=2000&auto=format&fit=crop' },
    { name: 'Western Europe & Alps', url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=2000&auto=format&fit=crop' },
    { name: 'Southeast Asia Hubs', url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=2000&auto=format&fit=crop' },
    { name: 'Middle East Executive', url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=2000&auto=format&fit=crop' }
  ];

  useEffect(() => {
    return db.subscribe(() => {
      setConfig(db.getHomepageConfig());
    });
  }, []);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    db.updateHomepageConfig(config, user);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const moveDestination = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...config.destinationOrdering];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    const updated = { ...config, destinationOrdering: newOrder };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const toggleFeaturedDestination = (destId: string) => {
    const isCurrentlyFeatured = (config.featuredDestinationIds || []).includes(destId);
    let updatedFeatured: string[];
    if (isCurrentlyFeatured) {
      updatedFeatured = (config.featuredDestinationIds || []).filter(id => id !== destId);
    } else {
      updatedFeatured = [...(config.featuredDestinationIds || []), destId];
    }
    const updated = { ...config, featuredDestinationIds: updatedFeatured };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const toggleDestinationInOrdering = (destId: string) => {
    let updatedOrdering = [...(config.destinationOrdering || [])];
    if (updatedOrdering.includes(destId)) {
      if (updatedOrdering.length <= 1) return; // Keep at least one
      updatedOrdering = updatedOrdering.filter(id => id !== destId);
    } else {
      updatedOrdering.push(destId);
    }
    const updated = { ...config, destinationOrdering: updatedOrdering };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  // FAQ CRUD
  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question || !faqForm.answer) return;

    const existingFaqs = config.homepageFAQs ? [...config.homepageFAQs] : [];
    if (faqForm.id) {
      const idx = existingFaqs.findIndex(f => f.id === faqForm.id);
      if (idx >= 0) {
        existingFaqs[idx] = {
          id: faqForm.id,
          question: faqForm.question,
          answer: faqForm.answer,
          category: faqForm.category || 'General',
          displayOrder: faqForm.displayOrder || (idx + 1),
          isPublished: faqForm.isPublished !== false
        };
      }
    } else {
      existingFaqs.push({
        id: `hfaq-${Date.now()}`,
        question: faqForm.question,
        answer: faqForm.answer,
        category: faqForm.category || 'General',
        displayOrder: existingFaqs.length + 1,
        isPublished: faqForm.isPublished !== false
      });
    }

    const updated = { ...config, homepageFAQs: existingFaqs };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
    setIsEditingFaq(false);
    setFaqForm({ question: '', answer: '', category: 'General', displayOrder: 1, isPublished: true });
  };

  const handleDeleteFaq = (faqId: string) => {
    const filtered = (config.homepageFAQs || []).filter(f => f.id !== faqId);
    const updated = { ...config, homepageFAQs: filtered };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const handleToggleFaqPublished = (faqId: string) => {
    const faqs = (config.homepageFAQs || []).map(f => f.id === faqId ? { ...f, isPublished: !f.isPublished } : f);
    const updated = { ...config, homepageFAQs: faqs };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
            <LayoutTemplate className="w-4 h-4 text-[#00C6A6]" />
            <span>Storefront Presentation & Layout Engine</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Homepage Control & Layout Manager</h2>
          <p className="text-sm text-slate-500">
            Control module visibility, grid density, hero presentation, destination hub hierarchies, and dedicated homepage trade FAQs.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#008972]" />
              <span>Published live to Homepage!</span>
            </div>
          )}
          <button
            onClick={() => handleSave()}
            className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-6 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-xs"
          >
            <Save className="w-4 h-4" />
            <span>Publish All Changes</span>
          </button>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 max-w-fit">
        {[
          { id: 'LAYOUT', label: 'Modules & Grid Layout', icon: Grid },
          { id: 'HERO', label: 'Hero Banner & CTA', icon: Sliders },
          { id: 'DESTINATIONS', label: 'Destinations & Ordering', icon: LayoutTemplate },
          { id: 'FAQS', label: 'Homepage FAQs Manager', icon: HelpCircle }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#008972]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB TAB 1: MODULES & GRID LAYOUT */}
      {activeSubTab === 'LAYOUT' && (
        <div className="space-y-6">
          {/* Section: Module Display Toggles */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold">
                <Eye className="w-5 h-5 text-[#008972]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Module Display Toggles (Live Homepage Synchronized)</h3>
                <p className="text-xs text-slate-500">Toggle individual sections on or off. State immediately reflects in the live storefront.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'showHeroSection', label: 'Hero Banner Section', desc: 'Main visual backdrop, headlines & SLA badge' },
                { key: 'showDestinationFilter', label: 'Destination Hub Filter', desc: 'Destination tabs & region pill selectors' },
                { key: 'showCityHubs', label: 'City Hubs & Gateways Bar', desc: 'Sub-regional cities (Tokyo, Kyoto, London, etc.)' },
                { key: 'showCategoryFilters', label: 'Category Filter Badges', desc: 'Tours, Transfers, Day Excursions, VIP Hosts' },
                { key: 'showProductGrid', label: 'Contracted Product Grid', desc: 'Card catalog with prices, ratings & booking SLAs' },
                { key: 'showGoogleReviews', label: 'Google Business Reviews', desc: 'Verified client reviews with 5-star badges' },
                { key: 'showHappyCustomerGallery', label: 'Happy Customer Gallery', desc: 'Real guest photo mosaic & testimonials' },
                { key: 'showHomepageFAQs', label: 'Homepage FAQs Accordion', desc: 'Trade buyer & operational SLA Q&A section' },
                { key: 'showPromotionsBanner', label: 'Promotions & Deals Ribbon', desc: 'Wholesale seasonal discount banners' },
                { key: 'showConversionCTA', label: 'B2B Quotation Conversion CTA', desc: 'Bottom call-to-action to launch Quote Studio' }
              ].map(item => {
                const isEnabled = (config as any)[item.key] !== false;
                return (
                  <label 
                    key={item.key}
                    className={`flex items-start justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                      isEnabled 
                        ? 'bg-emerald-50/50 border-emerald-200' 
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="space-y-1 pr-3">
                      <span className="block text-xs font-bold text-slate-900">{item.label}</span>
                      <span className="block text-[11px] text-slate-500 leading-tight">{item.desc}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={e => {
                        const updated = { ...config, [item.key]: e.target.checked };
                        setConfig(updated);
                        db.updateHomepageConfig(updated, user);
                      }}
                      className="w-4 h-4 text-[#008972] rounded focus:ring-[#00C6A6] mt-0.5"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section: Grid Density & Layout Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <Grid className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Grid Layout & Card Density Controls</h3>
                <p className="text-xs text-slate-500">Configure column counts and card arrangements across responsive breakpoints.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product Catalog Columns
                </label>
                <select
                  value={config.productGridColumns || 3}
                  onChange={e => {
                    const updated = { ...config, productGridColumns: Number(e.target.value) as any };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50"
                >
                  <option value={2}>2 Columns (Spacious Cards)</option>
                  <option value={3}>3 Columns (Standard DMC - Recommended)</option>
                  <option value={4}>4 Columns (High Density)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Destination Grid Columns
                </label>
                <select
                  value={config.destinationGridColumns || 3}
                  onChange={e => {
                    const updated = { ...config, destinationGridColumns: Number(e.target.value) as any };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50"
                >
                  <option value={2}>2 Columns</option>
                  <option value={3}>3 Columns (Standard)</option>
                  <option value={4}>4 Columns (Compact Hubs)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Customer Gallery Rows
                </label>
                <select
                  value={config.happyCustomerGalleryRows || 2}
                  onChange={e => {
                    const updated = { ...config, happyCustomerGalleryRows: Number(e.target.value) };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50"
                >
                  <option value={1}>1 Row (Compact Strip)</option>
                  <option value={2}>2 Rows (Standard Grid)</option>
                  <option value={3}>3 Rows (Expanded Mosaic)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Customer Gallery Columns
                </label>
                <select
                  value={config.happyCustomerGalleryCols || 3}
                  onChange={e => {
                    const updated = { ...config, happyCustomerGalleryCols: Number(e.target.value) };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50"
                >
                  <option value={2}>2 Columns</option>
                  <option value={3}>3 Columns (Recommended)</option>
                  <option value={4}>4 Columns (High Density)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: HERO BANNER & CTA */}
      {activeSubTab === 'HERO' && (() => {
        const heroCfg: UniversalHeroConfig = config.heroConfig || INITIAL_HOMEPAGE_CONFIG.heroConfig || {};

        const updateHero = (updates: Partial<UniversalHeroConfig>) => {
          const current = config.heroConfig || INITIAL_HOMEPAGE_CONFIG.heroConfig || {};
          const nextHero: UniversalHeroConfig = {
            ...current,
            ...updates,
            media: {
              ...(current.media || {}),
              ...(updates.media || {})
            },
            ctas: {
              ...(current.ctas || {}),
              ...(updates.ctas || {})
            },
            discoveryPanelConfig: {
              ...(current.discoveryPanelConfig || {}),
              ...(updates.discoveryPanelConfig || {})
            },
            promotion: {
              ...(current.promotion || {}),
              ...(updates.promotion || {})
            }
          };

          const nextConfig: HomepageConfig = {
            ...config,
            heroConfig: nextHero,
            heroHeading: nextHero.heading ?? config.heroHeading,
            heroSubheading: nextHero.subheading ?? config.heroSubheading,
            heroBadgeText: nextHero.eyebrowText ?? config.heroBadgeText,
            heroImage: nextHero.media?.desktopImageUrl ?? config.heroImage,
            heroImageAlt: nextHero.media?.altText ?? config.heroImageAlt,
            heroOverlayOpacity: nextHero.media?.overlayOpacity ?? config.heroOverlayOpacity,
            primaryCtaText: nextHero.ctas?.primaryCtaText ?? config.primaryCtaText,
            secondaryCtaText: nextHero.ctas?.secondaryCtaText ?? config.secondaryCtaText,
            showPrimaryCta: nextHero.ctas?.showPrimaryCta ?? config.showPrimaryCta,
            showSecondaryCta: nextHero.ctas?.showSecondaryCta ?? config.showSecondaryCta
          };

          setConfig(nextConfig);
        };

        const activePromotions = db.getActivePromotions();

        return (
          <div className="space-y-6">
            {/* Header Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center font-bold shrink-0">
                  <Sliders className="w-5 h-5 text-[#00C6A6]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">B2B Destination Management Hero CMS</h3>
                  <p className="text-xs text-slate-500">Universal Hero architecture powering Homepage, Destination pages, and Campaigns.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Device Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('DESKTOP')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      previewDevice === 'DESKTOP' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('TABLET')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      previewDevice === 'TABLET' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Tablet className="w-3.5 h-3.5" />
                    <span>Tablet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('MOBILE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      previewDevice === 'MOBILE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset Hero settings to standard TheUnbound B2B DMC defaults?')) {
                      const restored: HomepageConfig = {
                        ...config,
                        heroConfig: INITIAL_HOMEPAGE_CONFIG.heroConfig,
                        heroBadgeText: INITIAL_HOMEPAGE_CONFIG.heroBadgeText,
                        heroHeading: INITIAL_HOMEPAGE_CONFIG.heroHeading,
                        heroSubheading: INITIAL_HOMEPAGE_CONFIG.heroSubheading,
                        heroImage: INITIAL_HOMEPAGE_CONFIG.heroImage,
                        heroImageAlt: INITIAL_HOMEPAGE_CONFIG.heroImageAlt,
                        heroOverlayOpacity: INITIAL_HOMEPAGE_CONFIG.heroOverlayOpacity,
                        showPrimaryCta: INITIAL_HOMEPAGE_CONFIG.showPrimaryCta,
                        primaryCtaText: INITIAL_HOMEPAGE_CONFIG.primaryCtaText,
                        showSecondaryCta: INITIAL_HOMEPAGE_CONFIG.showSecondaryCta,
                        secondaryCtaText: INITIAL_HOMEPAGE_CONFIG.secondaryCtaText,
                        heroTrustBadges: INITIAL_HOMEPAGE_CONFIG.heroTrustBadges,
                        heroSellingPoints: INITIAL_HOMEPAGE_CONFIG.heroSellingPoints
                      };
                      setConfig(restored);
                      db.updateHomepageConfig(restored, user);
                      setSavedSuccess(true);
                      setTimeout(() => setSavedSuccess(false), 3000);
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="inline-flex items-center space-x-1.5 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save CMS</span>
                </button>
              </div>
            </div>

            {/* Interactive Live Preview Box with Viewport Resizing */}
            <div className="bg-slate-950 rounded-3xl p-3 sm:p-5 text-white overflow-hidden shadow-xl border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3 px-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                  <Eye className="w-4 h-4 text-[#00C6A6]" />
                  <span className="uppercase tracking-wider">Live Universal Hero Preview ({previewDevice})</span>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                  <span>Overlay: {Math.round((heroCfg.media?.overlayOpacity ?? config.heroOverlayOpacity ?? 0.65) * 100)}%</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6]" />
                  <span className="text-[#00C6A6]">WYSIWYG Mode</span>
                </div>
              </div>

              {/* Viewport Frame */}
              <div className="w-full overflow-x-auto flex justify-center py-2 bg-slate-900/60 rounded-2xl border border-white/5">
                <div 
                  className={`w-full transition-all duration-300 overflow-hidden ${
                    previewDevice === 'DESKTOP' 
                      ? 'max-w-full' 
                      : previewDevice === 'TABLET' 
                        ? 'max-w-[768px] border-4 border-slate-800 rounded-2xl shadow-2xl' 
                        : 'max-w-[390px] border-4 border-slate-800 rounded-3xl shadow-2xl'
                  }`}
                >
                  <UniversalHero
                    context="HOMEPAGE"
                    config={heroCfg}
                    homepageConfig={config}
                    allDestinations={destinations}
                  />
                </div>
              </div>
            </div>

            {/* Sub-Section Navigation Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-200">
              {[
                { key: 'COPY', label: '1. Copy & Positioning', icon: Sliders },
                { key: 'MEDIA', label: '2. Media & Contrast', icon: ImageIcon },
                { key: 'DISCOVERY', label: '3. Trip Discovery Panel', icon: Search },
                { key: 'PROMOTION', label: '4. Campaign Integration', icon: Tag },
                { key: 'PILLARS', label: '5. The Three Pillars', icon: Layers },
                { key: 'TRUST', label: '6. Trust & Value Strip', icon: ShieldCheck },
                { key: 'CTA', label: '7. Action Buttons', icon: ExternalLink }
              ].map(tab => {
                const Icon = tab.icon;
                const active = heroConfigSection === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setHeroConfigSection(tab.key as any)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-2 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-Section 1: COPY */}
            {heroConfigSection === 'COPY' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Headlines, Eyebrow & Brand Positioning</h4>
                  <p className="text-xs text-slate-500">Control the central H1 display title, orange highlight emphasis, and descriptive lead paragraph.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Eyebrow Pill Tag
                    </label>
                    <input
                      type="text"
                      value={heroCfg.eyebrowText ?? config.heroBadgeText ?? ''}
                      onChange={e => updateHero({ eyebrowText: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-xs font-bold font-mono"
                      placeholder="e.g. ESTABLISHED IN 2025 • B2B DESTINATION MANAGEMENT COMPANY"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Main Display Heading (H1)
                      </label>
                      <input
                        type="text"
                        value={heroCfg.heading ?? config.heroHeading ?? ''}
                        onChange={e => updateHero({ heading: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-sm font-black"
                        placeholder="e.g. DESTINATION MANAGEMENT"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Heading Accent Highlight (Brand Teal Emphasis)
                      </label>
                      <input
                        type="text"
                        value={heroCfg.headingHighlight ?? 'SIMPLIFIED BY INTELLIGENCE.'}
                        onChange={e => updateHero({ headingHighlight: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-sm font-black text-[#008972]"
                        placeholder="e.g. SIMPLIFIED BY INTELLIGENCE."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Lead Paragraph / Operational Value Proposition
                    </label>
                    <textarea
                      rows={3}
                      value={heroCfg.subheading ?? config.heroSubheading ?? ''}
                      onChange={e => updateHero({ subheading: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-xs leading-relaxed"
                      placeholder="TheUnbound combines destination expertise, travel technology and AI-powered package creation..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Section 2: MEDIA */}
            {heroConfigSection === 'MEDIA' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Visual Assets, Video & Scrim Contrast</h4>
                  <p className="text-xs text-slate-500">Configure responsive imagery (Desktop, Tablet, Mobile), video backgrounds, and contrast overlays.</p>
                </div>

                <div className="space-y-4">
                  {/* Presets Gallery */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Quick High-Res Destination Presets:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {HERO_IMAGE_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => updateHero({ media: { desktopImageUrl: preset.url } })}
                          className="text-left p-1.5 rounded-xl border border-slate-200 hover:border-[#00C6A6] bg-slate-50 text-[11px] transition-all cursor-pointer group"
                        >
                          <img src={preset.url} alt={preset.name} className="w-full h-14 rounded-lg object-cover mb-1 group-hover:scale-102 transition-transform" />
                          <span className="truncate block font-semibold text-slate-800">{preset.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Desktop Image URL
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.desktopImageUrl ?? config.heroImage ?? ''}
                        onChange={e => updateHero({ media: { desktopImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tablet Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.tabletImageUrl ?? ''}
                        onChange={e => updateHero({ media: { tabletImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="Falls back to Desktop image if empty"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Mobile Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.mobileImageUrl ?? ''}
                        onChange={e => updateHero({ media: { mobileImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="Falls back to Tablet image if empty"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Video URL (MP4 / WebM - Optional)
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.videoUrl ?? ''}
                        onChange={e => updateHero({ media: { videoUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="https://cdn.example.com/hero-video.mp4"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Video Poster Fallback Image URL
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.posterImageUrl ?? ''}
                        onChange={e => updateHero({ media: { posterImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Image Alt Text (SEO & Accessibility)
                      </label>
                      <input
                        type="text"
                        value={heroCfg.media?.altText ?? config.heroImageAlt ?? ''}
                        onChange={e => updateHero({ media: { altText: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        placeholder="TheUnbound B2B Destination Operations Hub"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Dark Overlay Scrim: {Math.round((heroCfg.media?.overlayOpacity ?? config.heroOverlayOpacity ?? 0.65) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="0.95"
                        step="0.05"
                        value={heroCfg.media?.overlayOpacity ?? config.heroOverlayOpacity ?? 0.65}
                        onChange={e => updateHero({ media: { overlayOpacity: parseFloat(e.target.value) } })}
                        className="w-full accent-[#00C6A6] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Section 3: DISCOVERY PANEL */}
            {heroConfigSection === 'DISCOVERY' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Trip Discovery & Inventory Search Panel</h4>
                    <p className="text-xs text-slate-500">Configure which search parameters travel agents can interact with directly in the Hero.</p>
                  </div>
                  <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroCfg.showDiscoveryPanel !== false}
                      onChange={e => updateHero({ showDiscoveryPanel: e.target.checked })}
                      className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                    />
                    <span>Show Search Panel</span>
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'showDestination', label: 'Destination Selector' },
                      { key: 'showHub', label: 'Regional Hub Cascading Dropdown' },
                      { key: 'showDates', label: 'Travel Dates & Nights Calculator' },
                      { key: 'showTravelers', label: 'Passenger Classification (ADT/CWB/CNB/INF)' },
                      { key: 'showTravelStyle', label: 'Travel Style Filter' },
                      { key: 'showProductType', label: 'Product Type Filter' },
                      { key: 'showAiPlannerShortcut', label: 'Quick AI Planner Callout' }
                    ].map(field => {
                      const isChecked = (heroCfg.discoveryPanelConfig as any)?.[field.key] !== false;
                      return (
                        <label 
                          key={field.key}
                          className="flex items-center space-x-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-xs font-semibold text-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const curr = heroCfg.discoveryPanelConfig || {};
                              updateHero({
                                discoveryPanelConfig: {
                                  ...curr,
                                  [field.key]: e.target.checked
                                }
                              });
                            }}
                            className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                          />
                          <span>{field.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Search CTA Button Text
                      </label>
                      <input
                        type="text"
                        value={heroCfg.discoveryPanelConfig?.ctaText || 'Search Inventory'}
                        onChange={e => {
                          const curr = heroCfg.discoveryPanelConfig || {};
                          updateHero({
                            discoveryPanelConfig: {
                              ...curr,
                              ctaText: e.target.value
                            }
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                        placeholder="Search Inventory"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        30-Second AI Itinerary Callout Text
                      </label>
                      <input
                        type="text"
                        value={heroCfg.aiQuickBannerText ? String(heroCfg.aiQuickBannerText) : 'BUILD A COMPLETE TRAVEL PACKAGE IN AS LITTLE AS 30 SECONDS.'}
                        onChange={e => updateHero({ aiQuickBannerText: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        placeholder="BUILD A COMPLETE TRAVEL PACKAGE IN AS LITTLE AS 30 SECONDS."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Section 4: PROMOTION */}
            {heroConfigSection === 'PROMOTION' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Active Promotion & Campaign Integration</h4>
                    <p className="text-xs text-slate-500">Showcase active B2B campaigns, seasonal flash promotions, or special wholesale tariffs.</p>
                  </div>
                  <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroCfg.promotion?.enabled !== false}
                      onChange={e => {
                        const curr = heroCfg.promotion || {};
                        updateHero({
                          promotion: {
                            ...curr,
                            enabled: e.target.checked
                          }
                        });
                      }}
                      className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                    />
                    <span>Enable Campaign Banner</span>
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Selection Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'AUTO', label: 'Highest Priority (Auto)' },
                          { id: 'MANUAL', label: 'Specific Campaign' }
                        ].map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              const curr = heroCfg.promotion || {};
                              updateHero({
                                promotion: {
                                  ...curr,
                                  mode: m.id as any
                                }
                              });
                            }}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              (heroCfg.promotion?.mode || 'AUTO') === m.id
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Custom Badge Tag
                      </label>
                      <input
                        type="text"
                        value={heroCfg.promotion?.customBadge || 'SPECIAL CAMPAIGN'}
                        onChange={e => {
                          const curr = heroCfg.promotion || {};
                          updateHero({
                            promotion: {
                              ...curr,
                              customBadge: e.target.value
                            }
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase"
                        placeholder="SPECIAL CAMPAIGN"
                      />
                    </div>
                  </div>

                  {heroCfg.promotion?.mode === 'MANUAL' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Select Promotion from Active Campaigns ({activePromotions.length} Available)
                      </label>
                      <select
                        value={heroCfg.promotion?.manualPromotionId || ''}
                        onChange={e => {
                          const curr = heroCfg.promotion || {};
                          updateHero({
                            promotion: {
                              ...curr,
                              manualPromotionId: e.target.value
                            }
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                      >
                        <option value="">-- Choose Campaign --</option>
                        {activePromotions.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.discountType === 'PERCENTAGE' ? `${p.discountValue}% OFF` : `$${p.discountValue} OFF`}) - {p.promoCode || 'No Code'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-Section 5: PILLARS */}
            {heroConfigSection === 'PILLARS' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">The Three Pillars with Connected Arc</h4>
                    <p className="text-xs text-slate-500">The core triad illustrating Travel, Technology, and Intelligence.</p>
                  </div>
                  <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroCfg.showPillars !== false}
                      onChange={e => updateHero({ showPillars: e.target.checked })}
                      className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                    />
                    <span>Show Three Pillars</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pillar 1 */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">PILLAR 1: TRAVEL</span>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={heroCfg.pillar1Title || 'DESTINATION EXPERTISE'}
                        onChange={e => updateHero({ pillar1Title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Subtitle</label>
                      <textarea
                        rows={2}
                        value={heroCfg.pillar1Subtitle || 'Local knowledge. Destination services. Ground operations.'}
                        onChange={e => updateHero({ pillar1Subtitle: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* Pillar 2 */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">PILLAR 2: TECHNOLOGY</span>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={heroCfg.pillar2Title || 'DIGITAL SOLUTIONS'}
                        onChange={e => updateHero({ pillar2Title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Subtitle</label>
                      <textarea
                        rows={2}
                        value={heroCfg.pillar2Subtitle || 'Package creation. Quotations. Connected workflows.'}
                        onChange={e => updateHero({ pillar2Subtitle: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* Pillar 3 */}
                  <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#008972] block">PILLAR 3: INTELLIGENCE</span>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={heroCfg.pillar3Title || 'AI-POWERED'}
                        onChange={e => updateHero({ pillar3Title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-teal-200 text-xs font-bold bg-white text-[#008972]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Subtitle</label>
                      <textarea
                        rows={2}
                        value={heroCfg.pillar3Subtitle || 'Intelligent travel package creation in 30 seconds.'}
                        onChange={e => updateHero({ pillar3Subtitle: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Section 6: TRUST */}
            {heroConfigSection === 'TRUST' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">B2B Trust & Operational USP Strip</h4>
                    <p className="text-xs text-slate-500">The 4 key ground capabilities displayed on the bottom bar of the hero.</p>
                  </div>
                  <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroCfg.showTrustStrip !== false}
                      onChange={e => updateHero({ showTrustStrip: e.target.checked })}
                      className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                    />
                    <span>Show Trust Strip</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(heroCfg.trustItems || [
                    { title: 'Direct B2B Net Wholesale Rates', description: 'Contracted rates with verified ground suppliers', icon: 'ShieldCheck' },
                    { title: '24–48h SLA Operations Desk', description: 'Dedicated on-ground operations in key hubs', icon: 'Clock' },
                    { title: 'Verified Licensed Guides', description: 'Bilingual guides & executive chauffeur fleets', icon: 'Building2' },
                    { title: 'White-Label Proposals', description: 'Instant multi-currency quotes & client itineraries', icon: 'Globe2' }
                  ]).map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">USP Item {idx + 1}</span>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Headline</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={e => {
                            const updated = [...(heroCfg.trustItems || [])];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            updateHero({ trustItems: updated });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => {
                            const updated = [...(heroCfg.trustItems || [])];
                            updated[idx] = { ...updated[idx], description: e.target.value };
                            updateHero({ trustItems: updated });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Section 7: CTA */}
            {heroConfigSection === 'CTA' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Action CTA Buttons & Destinations Routing</h4>
                  <p className="text-xs text-slate-500">Configure button visibility, labels, and target destinations for the Hero buttons.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Primary CTA */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Primary Button</label>
                      <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={heroCfg.ctas?.showPrimaryCta !== false}
                          onChange={e => {
                            const curr = heroCfg.ctas || {};
                            updateHero({ ctas: { ...curr, showPrimaryCta: e.target.checked } });
                          }}
                          className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                        />
                        <span>Show</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Button Label</label>
                      <input
                        type="text"
                        value={heroCfg.ctas?.primaryCtaText || 'EXPLORE PACKAGES'}
                        onChange={e => {
                          const curr = heroCfg.ctas || {};
                          updateHero({ ctas: { ...curr, primaryCtaText: e.target.value } });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                      />
                    </div>
                  </div>

                  {/* Secondary CTA */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Secondary Button</label>
                      <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={heroCfg.ctas?.showSecondaryCta !== false}
                          onChange={e => {
                            const curr = heroCfg.ctas || {};
                            updateHero({ ctas: { ...curr, showSecondaryCta: e.target.checked } });
                          }}
                          className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                        />
                        <span>Show</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Button Label</label>
                      <input
                        type="text"
                        value={heroCfg.ctas?.secondaryCtaText || 'BECOME A PARTNER'}
                        onChange={e => {
                          const curr = heroCfg.ctas || {};
                          updateHero({ ctas: { ...curr, secondaryCtaText: e.target.value } });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSave()}
                className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-8 py-3 rounded-xl shadow-xs transition-all cursor-pointer text-xs"
              >
                <Save className="w-4 h-4" />
                <span>Publish Hero Changes Live</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* SUB TAB 3: DESTINATIONS & ORDERING */}
      {activeSubTab === 'DESTINATIONS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <LayoutTemplate className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Destination Hubs Ordering & Featured Status</h3>
                  <p className="text-xs text-slate-500">Search, select, reorder, and toggle featured badges for destination hubs on the homepage.</p>
                </div>
              </div>

              {/* Destination Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={destSearchQuery}
                  onChange={e => setDestSearchQuery(e.target.value)}
                  placeholder="Search destination..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Destination Selection & Reordering List */}
            <div className="space-y-3">
              {(config.destinationOrdering || [])
                .filter(destId => {
                  if (!destSearchQuery) return true;
                  const d = destinations.find(dest => dest.id === destId || dest.slug === destId);
                  return d?.name.toLowerCase().includes(destSearchQuery.toLowerCase());
                })
                .map((destId, idx) => {
                  const destination = destinations.find(d => d.id === destId || d.slug === destId);
                  if (!destination) return null;
                  const isFeatured = (config.featuredDestinationIds || []).some(id => id === destId || id === destination.id || id === destination.slug);

                  return (
                    <div 
                      key={`homepage-dest-order-${destId}-${destination.id}-${idx}`}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <span className="w-6 text-center text-xs font-mono font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        <img 
                          src={destination.heroImage} 
                          alt={destination.name} 
                          className="w-12 h-10 rounded-lg object-cover border border-slate-200" 
                        />
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{destination.name}</h4>
                          <p className="text-[11px] text-slate-500">{destination.tagline || destination.country}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => toggleFeaturedDestination(destination.id || destId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            isFeatured 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold' 
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {isFeatured ? '★ Featured on Home' : 'Standard'}
                        </button>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveDestination(idx, 'up')}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === (config.destinationOrdering?.length || 0) - 1}
                            onClick={() => moveDestination(idx, 'down')}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Unlisted Destinations Pool */}
            {destinations.some(d => !(config.destinationOrdering || []).some(id => id === d.id || id === d.slug)) && (
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Available Destinations (Click to Add to Homepage Ordering)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {destinations
                    .filter(d => !(config.destinationOrdering || []).some(id => id === d.id || id === d.slug))
                    .map((d, dIdx) => (
                      <button
                        key={`unlisted-dest-${d.id || d.slug}-${dIdx}`}
                        onClick={() => toggleDestinationInOrdering(d.id)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#00C6A6]/20 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#00C6A6]" />
                        <span>{d.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB TAB 4: HOMEPAGE FAQS MANAGER */}
      {activeSubTab === 'FAQS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Homepage FAQs Manager (General & Trade Operations)</h3>
                  <p className="text-xs text-slate-500">
                    Dedicated general FAQs displayed on the home storefront (distinct from destination-specific FAQs).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFaqForm({ question: '', answer: '', category: 'Operations', displayOrder: (config.homepageFAQs?.length || 0) + 1, isPublished: true });
                  setIsEditingFaq(true);
                }}
                className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#00C6A6]" />
                <span>Add Homepage FAQ</span>
              </button>
            </div>

            {/* FAQs List */}
            <div className="space-y-3">
              {(config.homepageFAQs || []).map((faq, idx) => (
                <div 
                  key={faq.id}
                  className={`p-4 rounded-xl border transition-all ${
                    faq.isPublished ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          Order #{faq.displayOrder || idx + 1}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded">
                          {faq.category || 'General'}
                        </span>
                        {!faq.isPublished && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 rounded">
                            Draft / Hidden
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 pt-1">{faq.question}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{faq.answer}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleFaqPublished(faq.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          faq.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {faq.isPublished ? 'Published' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFaqForm(faq);
                          setIsEditingFaq(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Edit FAQ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(faq.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete FAQ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {(!config.homepageFAQs || (config.homepageFAQs || []).length === 0) && (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  No homepage FAQs defined yet. Click &quot;Add Homepage FAQ&quot; to create one.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create FAQ Modal */}
      {isEditingFaq && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveFaq} className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {faqForm.id ? 'Edit Homepage FAQ' : 'Add New Homepage FAQ'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingFaq(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Operations, Bookings & SLA, B2B Quotations"
                value={faqForm.category || ''}
                onChange={e => setFaqForm({ ...faqForm, category: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Question</label>
              <input
                type="text"
                required
                placeholder="e.g. What is TheUnbound ground network coverage?"
                value={faqForm.question || ''}
                onChange={e => setFaqForm({ ...faqForm, question: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Answer</label>
              <textarea
                rows={4}
                required
                placeholder="Provide a clear, detailed answer for travel advisors and prospective clients..."
                value={faqForm.answer || ''}
                onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  min={1}
                  value={faqForm.displayOrder || 1}
                  onChange={e => setFaqForm({ ...faqForm, displayOrder: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={faqForm.isPublished !== false}
                    onChange={e => setFaqForm({ ...faqForm, isPublished: e.target.checked })}
                    className="w-4 h-4 text-[#008972] rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">Published Live</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditingFaq(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] text-white hover:bg-[#00C6A6] hover:text-slate-950 cursor-pointer shadow-xs"
              >
                Save FAQ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
