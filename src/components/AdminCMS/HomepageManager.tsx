import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { HomepageConfig, Destination, HomepageFAQItem } from '../../types';
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
  MessageSquare
} from 'lucide-react';

interface HomepageManagerProps {
  destinations: Destination[];
}

export const HomepageManager: React.FC<HomepageManagerProps> = ({ destinations }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [config, setConfig] = useState<HomepageConfig>(db.getHomepageConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'LAYOUT' | 'HERO' | 'DESTINATIONS' | 'FAQS'>('LAYOUT');

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
      {activeSubTab === 'HERO' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold">
                <Sliders className="w-5 h-5 text-[#008972]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hero Section Content & Visuals</h3>
                <p className="text-xs text-slate-500">Customize the top headline, operational badge, and high-resolution backdrop image.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hero Operational Badge Text
                </label>
                <input
                  type="text"
                  value={config.heroBadgeText}
                  onChange={e => setConfig({ ...config, heroBadgeText: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-xs font-bold"
                  placeholder="e.g. UNBOUND EXPERIENCES INDIA PVT LTD • OPERATIONS DESK"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Main Hero Heading (H1)
                </label>
                <input
                  type="text"
                  value={config.heroHeading}
                  onChange={e => setConfig({ ...config, heroHeading: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Subheading / Operational SLA Description
                </label>
                <textarea
                  rows={3}
                  value={config.heroSubheading}
                  onChange={e => setConfig({ ...config, heroSubheading: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hero Background Image URL (Unsplash / CDN)
                </label>
                <input
                  type="url"
                  value={config.heroImage}
                  onChange={e => setConfig({ ...config, heroImage: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-xs"
                />
                {config.heroImage && (
                  <div className="mt-2 h-32 rounded-xl overflow-hidden border border-slate-200">
                    <img src={config.heroImage} alt="Hero Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Bottom Conversion CTA Banner</h3>
                <p className="text-xs text-slate-500">Customize the final call-to-action banner driving travel agents to the Quotation Studio.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">CTA Headline</label>
                <input
                  type="text"
                  value={config.ctaTitle || ''}
                  onChange={e => setConfig({ ...config, ctaTitle: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">CTA Subtitle</label>
                <input
                  type="text"
                  value={config.ctaSubtitle || ''}
                  onChange={e => setConfig({ ...config, ctaSubtitle: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">CTA Button Text</label>
                <input
                  type="text"
                  value={config.ctaButtonText || ''}
                  onChange={e => setConfig({ ...config, ctaButtonText: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </form>
      )}

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
