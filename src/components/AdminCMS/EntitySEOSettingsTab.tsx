import React, { useState, useId } from 'react';
import {
  Search,
  Globe,
  Share2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Smartphone,
  Monitor,
  Code2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Tag,
  FileText
} from 'lucide-react';
import { EntitySEO, SEOEntityType, StructuredDataType } from '../../types/seo';
import {
  DEFAULT_GLOBAL_SEO_DEFAULTS,
  buildFallbackSEO,
  auditEntitySEO,
  generateStructuredData,
  sanitizeSlug
} from '../../services/seoEngine';

interface EntitySEOSettingsTabProps {
  entityType: SEOEntityType;
  entity: any;
  seo?: EntitySEO;
  onChange: (updatedSeo: EntitySEO) => void;
  readOnly?: boolean;
}

export const EntitySEOSettingsTab: React.FC<EntitySEOSettingsTabProps> = ({
  entityType,
  entity,
  seo,
  onChange,
  readOnly = false
}) => {
  const [activeSubView, setActiveSubView] = useState<'METADATA' | 'SOCIAL' | 'SCHEMA' | 'ADVANCED'>('METADATA');
  const [previewMode, setPreviewMode] = useState<'GOOGLE_DESKTOP' | 'GOOGLE_MOBILE' | 'SOCIAL'>('GOOGLE_DESKTOP');
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Generate unique IDs for all form inputs
  const titleInputId = useId();
  const metaDescInputId = useId();
  const slugInputId = useId();
  const canonicalInputId = useId();
  const focusKeywordInputId = useId();
  const imageAltInputId = useId();
  const breadcrumbInputId = useId();
  const ogTitleInputId = useId();
  const ogDescInputId = useId();
  const ogImageInputId = useId();
  const twitterTitleInputId = useId();
  const twitterDescInputId = useId();
  const twitterImageInputId = useId();
  const schemaTypeSelectId = useId();
  const customSchemaTextareaId = useId();

  // Effective SEO initialized with fallback if empty
  const effectiveSEO: EntitySEO = React.useMemo(() => {
    if (seo && (seo.title || seo.slug)) {
      return {
        ...buildFallbackSEO(entityType, entity, DEFAULT_GLOBAL_SEO_DEFAULTS),
        ...seo
      };
    }
    return buildFallbackSEO(entityType, entity, DEFAULT_GLOBAL_SEO_DEFAULTS);
  }, [seo, entity, entityType]);

  // Real-time Audit
  const audit = React.useMemo(() => {
    return auditEntitySEO(entityType, entity, effectiveSEO, DEFAULT_GLOBAL_SEO_DEFAULTS);
  }, [entityType, entity, effectiveSEO]);

  // Real-time Structured Data
  const jsonLd = React.useMemo(() => {
    return generateStructuredData(entityType, entity, effectiveSEO, DEFAULT_GLOBAL_SEO_DEFAULTS);
  }, [entityType, entity, effectiveSEO]);

  const updateField = <K extends keyof EntitySEO>(field: K, value: EntitySEO[K]) => {
    const updated: EntitySEO = {
      ...effectiveSEO,
      [field]: value,
      lastUpdated: new Date().toISOString()
    };
    onChange(updated);
  };

  const handleAutoGenerate = () => {
    const generated = buildFallbackSEO(entityType, entity, DEFAULT_GLOBAL_SEO_DEFAULTS);
    onChange({
      ...generated,
      slug: effectiveSEO.slug || generated.slug
    });
  };

  const handleSlugify = () => {
    const name = entity.name || entity.title || entity.country || '';
    const clean = sanitizeSlug(name);
    if (clean) {
      updateField('slug', clean);
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(JSON.stringify(jsonLd, null, 2));
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const titleLen = (effectiveSEO.title || '').length;
  const descLen = (effectiveSEO.metaDescription || '').length;

  const scoreColor = audit.score >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    audit.score >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-rose-600 bg-rose-50 border-rose-200';

  const previewSlug = effectiveSEO.slug || sanitizeSlug(entity.name || entity.title || 'item');
  const previewDomain = DEFAULT_GLOBAL_SEO_DEFAULTS.canonicalDomain.replace(/^https?:\/\//, '');

  return (
    <div className="space-y-6" id="entity-seo-settings-tab">
      {/* HEADER: AUDIT SCORE & 1-CLICK OPTIMIZE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center font-black ${scoreColor}`}>
            <span className="text-xl leading-none">{audit.score}</span>
            <span className="text-[9px] uppercase tracking-wider font-bold">SEO Score</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-base font-bold text-slate-900">SEO & Metadata Management</h4>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-full border ${
                effectiveSEO.robots?.index === false ? 'bg-rose-100 text-rose-700 border-rose-200' :
                audit.health === 'COMPLETE' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                audit.health === 'WARNING' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-rose-100 text-rose-800 border-rose-200'
              }`}>
                {effectiveSEO.robots?.index === false ? 'No-Index' : audit.health}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Optimized metadata for Google, Bing, social card previews, and Schema.org rich snippets.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={readOnly}
            className="px-3.5 py-2 bg-[#008972] hover:bg-[#007460] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            id="btn-auto-optimize-seo"
          >
            <Sparkles className="w-4 h-4" />
            <span>Auto-Generate Optimized SEO</span>
          </button>
        </div>
      </div>

      {/* TABS SUB-NAVIGATION */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          type="button"
          onClick={() => setActiveSubView('METADATA')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeSubView === 'METADATA'
              ? 'border-[#008972] text-[#008972]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="tab-seo-metadata"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Core Meta & SERP</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('SOCIAL')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeSubView === 'SOCIAL'
              ? 'border-[#008972] text-[#008972]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="tab-seo-social"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Social Sharing (OG / Twitter)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('SCHEMA')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeSubView === 'SCHEMA'
              ? 'border-[#008972] text-[#008972]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="tab-seo-schema"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Structured Data (JSON-LD)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('ADVANCED')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeSubView === 'ADVANCED'
              ? 'border-[#008972] text-[#008972]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="tab-seo-advanced"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Robots & Indexing</span>
        </button>
      </div>

      {/* 2-COLUMN LAYOUT: FORM ON LEFT, LIVE PREVIEW ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: FORM CONTROLS (7 COLS) */}
        <div className="lg:col-span-7 space-y-5">
          {activeSubView === 'METADATA' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={titleInputId} className="text-xs font-bold text-slate-800">
                    SEO Meta Title <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-mono font-bold ${
                    titleLen >= 50 && titleLen <= 60 ? 'text-emerald-600' :
                    titleLen > 65 ? 'text-rose-600' : 'text-amber-600'
                  }`}>
                    {titleLen} / 60 chars
                  </span>
                </div>
                <input
                  id={titleInputId}
                  type="text"
                  value={effectiveSEO.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  disabled={readOnly}
                  placeholder="e.g. Japan Luxury Tours & Private Ground Handling | TheUnbound"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972] font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Appears as the clickable blue headline in Google search results. Recommended: 50-60 characters.
                </p>
              </div>

              {/* Meta Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={metaDescInputId} className="text-xs font-bold text-slate-800">
                    Meta Description <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-mono font-bold ${
                    descLen >= 120 && descLen <= 160 ? 'text-emerald-600' :
                    descLen > 165 ? 'text-rose-600' : 'text-amber-600'
                  }`}>
                    {descLen} / 160 chars
                  </span>
                </div>
                <textarea
                  id={metaDescInputId}
                  rows={3}
                  value={effectiveSEO.metaDescription || ''}
                  onChange={(e) => updateField('metaDescription', e.target.value)}
                  disabled={readOnly}
                  placeholder="Compelling 120-160 character summary with call-to-action..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972] font-medium resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Summarizes the page content under the headline in SERP snippets. Recommended: 120-160 characters.
                </p>
              </div>

              {/* URL Slug */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={slugInputId} className="text-xs font-bold text-slate-800">
                    URL Slug <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSlugify}
                    disabled={readOnly}
                    className="text-[11px] text-[#008972] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate from Name</span>
                  </button>
                </div>
                <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-slate-50 focus-within:ring-2 focus-within:ring-[#008972]">
                  <span className="px-3 text-xs text-slate-400 font-mono select-none border-r border-slate-200">
                    /{previewSlug.split('/')[0] ? previewSlug.split('/')[0] + '/' : ''}
                  </span>
                  <input
                    id={slugInputId}
                    type="text"
                    value={effectiveSEO.slug || ''}
                    onChange={(e) => updateField('slug', sanitizeSlug(e.target.value))}
                    disabled={readOnly}
                    placeholder="e.g. luxury-kyoto-ryokan-escape"
                    className="flex-1 px-3 py-2.5 bg-white text-xs text-slate-900 font-mono focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Use lowercase alphanumeric letters and hyphens only. Changing an existing slug automatically records a 301 permanent redirect.
                </p>
              </div>

              {/* Canonical URL */}
              <div>
                <label htmlFor={canonicalInputId} className="block text-xs font-bold text-slate-800 mb-1.5">
                  Canonical URL Override (Optional)
                </label>
                <input
                  id={canonicalInputId}
                  type="url"
                  value={effectiveSEO.canonicalUrl || ''}
                  onChange={(e) => updateField('canonicalUrl', e.target.value)}
                  disabled={readOnly}
                  placeholder={`https://${previewDomain}/...`}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972] font-mono text-[11px]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Self-referential by default. Only specify if consolidating duplicate or syndicated pages to a primary authority URL.
                </p>
              </div>

              {/* Focus Keyword & Secondary Keywords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor={focusKeywordInputId} className="block text-xs font-bold text-slate-800 mb-1.5">
                    Primary Focus Keyword
                  </label>
                  <div className="relative">
                    <Tag className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      id={focusKeywordInputId}
                      type="text"
                      value={effectiveSEO.focusKeyword || ''}
                      onChange={(e) => updateField('focusKeyword', e.target.value)}
                      disabled={readOnly}
                      placeholder="e.g. Japan luxury tour"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={imageAltInputId} className="block text-xs font-bold text-slate-800 mb-1.5">
                    Hero Image ALT Attribute
                  </label>
                  <input
                    id={imageAltInputId}
                    type="text"
                    value={effectiveSEO.imageAltText || ''}
                    onChange={(e) => updateField('imageAltText', e.target.value)}
                    disabled={readOnly}
                    placeholder="Descriptive image text for search engines..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
                  />
                </div>
              </div>

              {/* Breadcrumb Label */}
              <div>
                <label htmlFor={breadcrumbInputId} className="block text-xs font-bold text-slate-800 mb-1.5">
                  Breadcrumb Navigation Label
                </label>
                <input
                  id={breadcrumbInputId}
                  type="text"
                  value={effectiveSEO.breadcrumbTitle || ''}
                  onChange={(e) => updateField('breadcrumbTitle', e.target.value)}
                  disabled={readOnly}
                  placeholder={entity.name || entity.title || 'Page'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
                />
              </div>
            </div>
          )}

          {activeSubView === 'SOCIAL' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h5 className="text-xs font-bold text-slate-900">Open Graph & Social Cards</h5>
                <button
                  type="button"
                  onClick={() => {
                    updateField('ogTitle', effectiveSEO.title);
                    updateField('ogDescription', effectiveSEO.metaDescription);
                    updateField('twitterTitle', effectiveSEO.title);
                    updateField('twitterDescription', effectiveSEO.metaDescription);
                  }}
                  disabled={readOnly}
                  className="text-[11px] text-[#008972] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Sync with Meta Title & Description</span>
                </button>
              </div>

              <div>
                <label htmlFor={ogTitleInputId} className="block text-xs font-bold text-slate-800 mb-1.5">
                  Social Share Title (og:title)
                </label>
                <input
                  id={ogTitleInputId}
                  type="text"
                  value={effectiveSEO.ogTitle || ''}
                  onChange={(e) => updateField('ogTitle', e.target.value)}
                  disabled={readOnly}
                  placeholder={effectiveSEO.title || 'Social title...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
                />
              </div>

              <div>
                <label htmlFor={ogDescInputId} className="block text-xs font-bold text-slate-800 mb-1.5">
                  Social Share Description (og:description)
                </label>
                <textarea
                  id={ogDescInputId}
                  rows={2}
                  value={effectiveSEO.ogDescription || ''}
                  onChange={(e) => updateField('ogDescription', e.target.value)}
                  disabled={readOnly}
                  placeholder={effectiveSEO.metaDescription || 'Social summary...'}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972] resize-none"
                />
              </div>

              <div>
                <label htmlFor={ogImageInputId} className="block text-xs font-bold text-slate-800 mb-1.5">
                  Social Share Image URL (og:image / 1200x630px recommended)
                </label>
                <input
                  id={ogImageInputId}
                  type="url"
                  value={effectiveSEO.ogImage || ''}
                  onChange={(e) => updateField('ogImage', e.target.value)}
                  disabled={readOnly}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972] font-mono text-[11px]"
                />
                {effectiveSEO.ogImage && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 max-h-36 bg-slate-100 relative group">
                    <img
                      src={effectiveSEO.ogImage}
                      alt="OG Preview"
                      className="w-full h-36 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                      1200 × 630 Ratio Preview
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <h5 className="text-xs font-bold text-slate-900">Twitter Card Overrides (Optional)</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={twitterTitleInputId} className="block text-[11px] font-bold text-slate-700 mb-1">
                      Twitter Title
                    </label>
                    <input
                      id={twitterTitleInputId}
                      type="text"
                      value={effectiveSEO.twitterTitle || ''}
                      onChange={(e) => updateField('twitterTitle', e.target.value)}
                      disabled={readOnly}
                      placeholder="Same as OG Title"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor={twitterDescInputId} className="block text-[11px] font-bold text-slate-700 mb-1">
                      Twitter Description
                    </label>
                    <input
                      id={twitterDescInputId}
                      type="text"
                      value={effectiveSEO.twitterDescription || ''}
                      onChange={(e) => updateField('twitterDescription', e.target.value)}
                      disabled={readOnly}
                      placeholder="Same as OG Description"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor={twitterImageInputId} className="block text-[11px] font-bold text-slate-700 mb-1">
                    Twitter Image URL
                  </label>
                  <input
                    id={twitterImageInputId}
                    type="url"
                    value={effectiveSEO.twitterImage || ''}
                    onChange={(e) => updateField('twitterImage', e.target.value)}
                    disabled={readOnly}
                    placeholder="Same as OG Image"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSubView === 'SCHEMA' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-900">Schema.org JSON-LD Structured Data</h5>
                  <p className="text-[11px] text-slate-500">
                    Provides Google with machine-readable entities for Rich Snippets and Knowledge Panels.
                  </p>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectiveSEO.schemaEnabled !== false}
                    onChange={(e) => updateField('schemaEnabled', e.target.checked)}
                    disabled={readOnly}
                    className="w-4 h-4 text-[#008972] rounded focus:ring-[#008972]"
                  />
                  <span className="text-xs font-bold text-slate-700">Enable Schema</span>
                </label>
              </div>

              <div>
                <label htmlFor={schemaTypeSelectId} className="block text-xs font-bold text-slate-800 mb-1.5">
                  Schema Entity Type
                </label>
                <select
                  id={schemaTypeSelectId}
                  value={effectiveSEO.schemaType || 'TouristDestination'}
                  onChange={(e) => updateField('schemaType', e.target.value as StructuredDataType)}
                  disabled={readOnly || effectiveSEO.schemaEnabled === false}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972] bg-white font-medium"
                >
                  <option value="TouristDestination">TouristDestination (Destinations / Hubs)</option>
                  <option value="Product">Product / Tour (Excursions, transfers, packages)</option>
                  <option value="Hotel">Hotel / Lodging (Hotels, Ryokans, Villas)</option>
                  <option value="TouristTrip">TouristTrip (Multi-day guided journeys)</option>
                  <option value="Article">Article / Blog (Editorial stories, travel guides)</option>
                  <option value="FAQPage">FAQPage (Help questions & answers)</option>
                  <option value="Organization">Organization (Company profile)</option>
                  <option value="WebPage">Standard WebPage</option>
                  <option value="Custom">Custom Handcrafted JSON-LD</option>
                </select>
              </div>

              {effectiveSEO.schemaType === 'Custom' && (
                <div>
                  <label htmlFor={customSchemaTextareaId} className="block text-xs font-bold text-slate-800 mb-1.5">
                    Custom JSON-LD Markup
                  </label>
                  <textarea
                    id={customSchemaTextareaId}
                    rows={8}
                    value={effectiveSEO.customSchema || ''}
                    onChange={(e) => updateField('customSchema', e.target.value)}
                    disabled={readOnly}
                    placeholder='{\n  "@context": "https://schema.org",\n  "@type": "..." \n}'
                    className="w-full p-3 font-mono text-[11px] bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* JSON Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800">Generated JSON-LD Output</span>
                  <button
                    type="button"
                    onClick={handleCopySchema}
                    className="text-[11px] text-[#008972] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedSchema ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSchema ? 'Copied!' : 'Copy JSON-LD'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 border border-slate-800">
                  {JSON.stringify(jsonLd, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {activeSubView === 'ADVANCED' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
              <div>
                <h5 className="text-xs font-bold text-slate-900">Robots & Search Indexing Controls</h5>
                <p className="text-[11px] text-slate-500">
                  Control how web crawlers (Googlebot, Bingbot) index and follow links on this page.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Index in Search Engines</div>
                    <div className="text-[11px] text-slate-500">Allow page to appear in Google search results</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={effectiveSEO.robots?.index !== false}
                    onChange={(e) => updateField('robots', { ...effectiveSEO.robots, index: e.target.checked })}
                    disabled={readOnly}
                    className="w-4 h-4 text-[#008972] rounded focus:ring-[#008972]"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Follow Page Links</div>
                    <div className="text-[11px] text-slate-500">Allow search bots to follow links on this page</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={effectiveSEO.robots?.follow !== false}
                    onChange={(e) => updateField('robots', { ...effectiveSEO.robots, follow: e.target.checked })}
                    disabled={readOnly}
                    className="w-4 h-4 text-[#008972] rounded focus:ring-[#008972]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">No-Archive Directive</div>
                    <div className="text-[11px] text-slate-500">Prevents search engines from caching page copies</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={effectiveSEO.robots?.noarchive === true}
                    onChange={(e) => updateField('robots', { ...effectiveSEO.robots, noarchive: e.target.checked })}
                    disabled={readOnly}
                    className="w-4 h-4 text-[#008972] rounded focus:ring-[#008972]"
                  />
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">No-Snippet Directive</div>
                    <div className="text-[11px] text-slate-500">Prevents snippet descriptions in search results</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={effectiveSEO.robots?.nosnippet === true}
                    onChange={(e) => updateField('robots', { ...effectiveSEO.robots, nosnippet: e.target.checked })}
                    disabled={readOnly}
                    className="w-4 h-4 text-[#008972] rounded focus:ring-[#008972]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Indexing Precaution:</span> Marking this entity as "No-Index" will instruct search engines to drop this page from search results and exclude it from the auto-generated XML sitemap.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: REAL-TIME PREVIEW & AUDIT DIAGNOSTICS (5 COLS) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* LIVE PREVIEW CONTAINER */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Live SERP Preview</span>
              </span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-slate-600">
                <button
                  type="button"
                  onClick={() => setPreviewMode('GOOGLE_DESKTOP')}
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    previewMode === 'GOOGLE_DESKTOP' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                  }`}
                  title="Google Desktop"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('GOOGLE_MOBILE')}
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    previewMode === 'GOOGLE_MOBILE' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                  }`}
                  title="Google Mobile"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('SOCIAL')}
                  className={`p-1 rounded-md transition-all cursor-pointer ${
                    previewMode === 'SOCIAL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                  }`}
                  title="Social Card"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* GOOGLE PREVIEW */}
            {(previewMode === 'GOOGLE_DESKTOP' || previewMode === 'GOOGLE_MOBILE') && (
              <div className={`p-4 rounded-xl border border-slate-200/80 bg-white font-sans ${
                previewMode === 'GOOGLE_MOBILE' ? 'max-w-[340px] mx-auto text-[13px]' : 'text-sm'
              }`}>
                {/* SERP URL & Breadcrumb */}
                <div className="flex items-center space-x-2 text-[11px] text-slate-600 mb-1">
                  <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-[#008972]">
                    U
                  </div>
                  <div className="truncate">
                    <span className="text-slate-900 font-medium">{DEFAULT_GLOBAL_SEO_DEFAULTS.siteName}</span>
                    <span className="text-slate-400 mx-1">›</span>
                    <span className="text-slate-500">{previewDomain} › {previewSlug}</span>
                  </div>
                </div>

                {/* SERP Title */}
                <h4 className="text-[#1a0dab] hover:underline font-normal text-base leading-snug cursor-pointer line-clamp-2">
                  {effectiveSEO.title || 'Page Title'}
                </h4>

                {/* SERP Description */}
                <p className="text-xs text-[#4d5156] mt-1 leading-relaxed line-clamp-3">
                  {effectiveSEO.metaDescription || 'Add a compelling meta description to see how this page appears in Google search engine results.'}
                </p>

                {/* Schema Rich Snippet Tag */}
                {effectiveSEO.schemaEnabled && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center space-x-2 text-[10px] text-emerald-700 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Rich Snippet: {effectiveSEO.schemaType || 'TouristDestination'}</span>
                  </div>
                )}
              </div>
            )}

            {/* SOCIAL CARD PREVIEW */}
            {previewMode === 'SOCIAL' && (
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                <div className="h-36 bg-slate-200 relative overflow-hidden">
                  {effectiveSEO.ogImage || entity.heroImage ? (
                    <img
                      src={effectiveSEO.ogImage || entity.heroImage}
                      alt="Social card"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                      No Image Configured
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white border-t border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {previewDomain}
                  </div>
                  <div className="text-xs font-bold text-slate-900 line-clamp-1 mt-0.5">
                    {effectiveSEO.ogTitle || effectiveSEO.title || 'Social Title'}
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                    {effectiveSEO.ogDescription || effectiveSEO.metaDescription || 'Social Description'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* REAL-TIME AUDIT DIAGNOSTICS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <h5 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#008972]" />
              <span>SEO Audit Checklist</span>
            </h5>

            {audit.issues.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600">Critical Issues ({audit.issues.length})</span>
                {audit.issues.map((issue, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-xs text-rose-700 bg-rose-50/60 p-2 rounded-lg border border-rose-100">
                    <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            )}

            {audit.warnings.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">Recommendations ({audit.warnings.length})</span>
                {audit.warnings.map((warning, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-xs text-amber-700 bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {audit.issues.length === 0 && audit.warnings.length === 0 && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">Flawless SEO! All metadata directives pass strict validation.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
