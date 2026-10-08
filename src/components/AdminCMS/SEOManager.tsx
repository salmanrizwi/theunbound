import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Filter,
  Layers,
  ArrowRight,
  Code2,
  Save,
  Link as LinkIcon,
  Sliders,
  FileText
} from 'lucide-react';
import { db } from '../../services/db';
import {
  EntitySEO,
  SEOAuditItem,
  SEOEntityType,
  SEORedirect,
  GlobalSEODefaults,
  SEOHealthStatus
} from '../../types/seo';
import {
  DEFAULT_GLOBAL_SEO_DEFAULTS,
  generateSitemapXml,
  generateRobotsTxt
} from '../../services/seoEngine';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';

export const SEOManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'DEFAULTS' | 'TEMPLATES' | 'REDIRECTS' | 'TECHNICAL'>('AUDIT');
  const [auditItems, setAuditItems] = useState<SEOAuditItem[]>([]);
  const [redirects, setRedirects] = useState<SEORedirect[]>([]);
  const [globalDefaults, setGlobalDefaults] = useState<GlobalSEODefaults>(DEFAULT_GLOBAL_SEO_DEFAULTS);
  
  // Search & Filter for Audit
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [healthFilter, setHealthFilter] = useState<string>('ALL');

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<SEOAuditItem | null>(null);
  const [tempSEO, setTempSEO] = useState<EntitySEO | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // New Redirect Form
  const [newRedirect, setNewRedirect] = useState({
    sourceUrl: '',
    destinationUrl: '',
    statusCode: 301 as 301 | 302,
    notes: ''
  });

  // Copied status
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const loadData = () => {
    const items = db.getAllSEOAuditItems();
    setAuditItems(items);
    setRedirects(db.getSEORedirects());
    setGlobalDefaults(db.getGlobalSEODefaults());
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const handleEditItem = (item: SEOAuditItem) => {
    setEditingItem(item);
    setTempSEO(item.seo);
  };

  const handleSaveItemSEO = async () => {
    if (!editingItem || !tempSEO) return;
    setIsSaving(true);
    try {
      await db.updateEntitySEO(editingItem.entityType, editingItem.entityId, tempSEO);
      setSaveSuccessMsg(`SEO updated successfully for "${editingItem.name}".`);
      setEditingItem(null);
      loadData();
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error saving entity SEO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDefaults = async () => {
    setIsSaving(true);
    try {
      await db.saveGlobalSEODefaults(globalDefaults);
      setSaveSuccessMsg('Global SEO defaults and social branding saved successfully.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error saving global SEO defaults:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRedirect.sourceUrl || !newRedirect.destinationUrl) return;

    try {
      await db.saveSEORedirect({
        id: `redir-${Date.now()}`,
        sourceUrl: newRedirect.sourceUrl,
        destinationUrl: newRedirect.destinationUrl,
        statusCode: newRedirect.statusCode,
        createdAt: new Date().toISOString(),
        createdBy: 'Admin User',
        hits: 0,
        notes: newRedirect.notes,
        active: true
      });
      setNewRedirect({ sourceUrl: '', destinationUrl: '', statusCode: 301, notes: '' });
      loadData();
      setSaveSuccessMsg('301 redirect created successfully.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error adding redirect:', err);
    }
  };

  const handleDeleteRedirect = async (id: string) => {
    if (!confirm('Are you sure you want to delete this redirect?')) return;
    try {
      await db.deleteSEORedirect(id);
      loadData();
    } catch (err) {
      console.error('Error deleting redirect:', err);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Filtered Audit Items
  const filteredItems = auditItems.filter(item => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = !q ||
      (item.name || '').toLowerCase().includes(q) ||
      (item.url || '').toLowerCase().includes(q) ||
      Boolean(item.seo?.focusKeyword && (item.seo.focusKeyword || '').toLowerCase().includes(q));
    const matchesType = typeFilter === 'ALL' || item.entityType === typeFilter;
    const matchesHealth = healthFilter === 'ALL' || item.health === healthFilter;
    return matchesSearch && matchesType && matchesHealth;
  });

  // KPI Metrics
  const totalCount = auditItems.length;
  const healthyCount = auditItems.filter(i => i.health === 'COMPLETE').length;
  const warningCount = auditItems.filter(i => i.health === 'WARNING').length;
  const errorCount = auditItems.filter(i => i.health === 'ERROR').length;
  const noindexCount = auditItems.filter(i => i.health === 'NOINDEX').length;
  const averageScore = totalCount > 0
    ? Math.round(auditItems.reduce((acc, curr) => acc + curr.score, 0) / totalCount)
    : 100;

  return (
    <div className="space-y-6" id="seo-management-engine">
      
      {/* TOAST SUCCESS MESSAGE */}
      {saveSuccessMsg && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{saveSuccessMsg}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-[#008972]/10 text-[#008972] flex items-center justify-center font-black">
            <Globe className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900">SEO Management Engine</h2>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                Live Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Centralized SEO engine across all entities: meta tags, structured data, canonical URLs, 301 redirects, and XML sitemaps.
            </p>
          </div>
        </div>

        {/* TOP QUICK STATS */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-lg font-black text-slate-900 leading-tight">{averageScore}%</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Quality</div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-lg font-black text-emerald-600 leading-tight">{healthyCount}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Flawless</div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-lg font-black text-amber-600 leading-tight">{warningCount}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Warnings</div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div className="text-lg font-black text-slate-900 leading-tight">{redirects.length}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Redirects</div>
          </div>
        </div>
      </div>

      {/* TOP NAVIGATION TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('AUDIT')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'AUDIT'
              ? 'bg-[#008972] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
          id="btn-seo-tab-audit"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Site-wide SEO Audit ({auditItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DEFAULTS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'DEFAULTS'
              ? 'bg-[#008972] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
          id="btn-seo-tab-defaults"
        >
          <Sliders className="w-4 h-4" />
          <span>Global Defaults & Identity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TEMPLATES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'TEMPLATES'
              ? 'bg-[#008972] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
          id="btn-seo-tab-templates"
        >
          <Layers className="w-4 h-4" />
          <span>URL & Pattern Templates</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REDIRECTS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'REDIRECTS'
              ? 'bg-[#008972] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
          id="btn-seo-tab-redirects"
        >
          <LinkIcon className="w-4 h-4" />
          <span>301 / 302 Redirects ({redirects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TECHNICAL')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'TECHNICAL'
              ? 'bg-[#008972] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
          id="btn-seo-tab-technical"
        >
          <Code2 className="w-4 h-4" />
          <span>Robots.txt & Sitemap.xml</span>
        </button>
      </div>

      {/* TAB 1: SITE-WIDE SEO AUDIT */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-4">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entities, URLs, or keywords..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#008972]"
              >
                <option value="ALL">All Entity Types</option>
                <option value="DESTINATION">Destinations</option>
                <option value="REGION">Regions</option>
                <option value="CITY_HUB">City Hubs</option>
                <option value="PRODUCT">Products / Activities</option>
                <option value="HOTEL">Hotels</option>
                <option value="PACKAGE">Packages</option>
                <option value="BLOG">Blogs</option>
                <option value="VISA">Visas</option>
                <option value="HOMEPAGE">Homepage</option>
                <option value="LEGAL">Legal Pages</option>
              </select>

              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#008972]"
              >
                <option value="ALL">All Health Statuses</option>
                <option value="COMPLETE">Complete (80-100%)</option>
                <option value="WARNING">Warnings (50-79%)</option>
                <option value="ERROR">Critical Issues (&lt;50%)</option>
                <option value="NOINDEX">Noindex Flagged</option>
              </select>
            </div>
          </div>

          {/* AUDIT TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Entity</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">URL Path</th>
                    <th className="py-3.5 px-4">Focus Keyword</th>
                    <th className="py-3.5 px-4">Score</th>
                    <th className="py-3.5 px-4">Indexing</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.seo.title}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                          {(item.entityType || 'ENTITY').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        {item.url}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.seo.focusKeyword ? (
                          <span className="font-medium text-slate-800">{item.seo.focusKeyword}</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${
                          item.score >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {item.score}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.seo.robots?.index === false ? (
                          <span className="text-rose-600 font-bold flex items-center space-x-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>noindex</span>
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>index</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleEditItem(item)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#008972] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition-all inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit SEO</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No entities found matching your search and filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL DEFAULTS & IDENTITY */}
      {activeTab === 'DEFAULTS' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Global Search & Social Identity</h3>
              <p className="text-xs text-slate-500">
                Fallback brand defaults applied across all indexable URLs when entity-specific tags are omitted.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveDefaults}
              disabled={isSaving}
              className="px-4 py-2 bg-[#008972] hover:bg-[#007460] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Global Defaults'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Site Name</label>
              <input
                type="text"
                value={globalDefaults.siteName}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, siteName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Title Suffix (Appended to page titles)</label>
              <input
                type="text"
                value={globalDefaults.titleSuffix}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, titleSuffix: e.target.value })}
                placeholder=" | TheUnbound DMC"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Default Fallback Meta Description</label>
              <textarea
                rows={3}
                value={globalDefaults.defaultMetaDescription}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, defaultMetaDescription: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Canonical Domain (including https://)</label>
              <input
                type="url"
                value={globalDefaults.canonicalDomain}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, canonicalDomain: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Default Open Graph Image URL (1200x630)</label>
              <input
                type="url"
                value={globalDefaults.defaultOgImage}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, defaultOgImage: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Organization Legal Name</label>
              <input
                type="text"
                value={globalDefaults.organizationName}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, organizationName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Organization Official Logo URL</label>
              <input
                type="url"
                value={globalDefaults.organizationLogo}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, organizationLogo: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Contact Email</label>
              <input
                type="email"
                value={globalDefaults.contactEmail}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, contactEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Contact Phone</label>
              <input
                type="text"
                value={globalDefaults.contactPhone}
                onChange={(e) => setGlobalDefaults({ ...globalDefaults, contactPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#008972]"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: URL & PATTERN TEMPLATES */}
      {activeTab === 'TEMPLATES' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Dynamic Title & Meta Pattern Templates</h3>
              <p className="text-xs text-slate-500">
                Rule-based generation patterns automatically populating new destinations, products, and hotels.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveDefaults}
              disabled={isSaving}
              className="px-4 py-2 bg-[#008972] hover:bg-[#007460] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Templates'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="font-bold text-slate-800">Dynamic Tokens:</span>{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-[#008972]">{'{name}'}</code>,{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-[#008972]">{'{destinationName}'}</code>,{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-[#008972]">{'{country}'}</code>,{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-[#008972]">{'{city}'}</code>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Destination Template */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Globe className="w-4 h-4 text-[#008972]" />
                <span>Destination Template</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Title Template</label>
                <input
                  type="text"
                  value={globalDefaults.templates.destination.titleTemplate}
                  onChange={(e) => setGlobalDefaults({
                    ...globalDefaults,
                    templates: {
                      ...globalDefaults.templates,
                      destination: { ...globalDefaults.templates.destination, titleTemplate: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Description Template</label>
                <textarea
                  rows={2}
                  value={globalDefaults.templates.destination.descTemplate}
                  onChange={(e) => setGlobalDefaults({
                    ...globalDefaults,
                    templates: {
                      ...globalDefaults.templates,
                      destination: { ...globalDefaults.templates.destination, descTemplate: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px] resize-none"
                />
              </div>
            </div>

            {/* Product Template */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-[#008972]" />
                <span>Product / Tour Template</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Title Template</label>
                <input
                  type="text"
                  value={globalDefaults.templates.product.titleTemplate}
                  onChange={(e) => setGlobalDefaults({
                    ...globalDefaults,
                    templates: {
                      ...globalDefaults.templates,
                      product: { ...globalDefaults.templates.product, titleTemplate: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Description Template</label>
                <textarea
                  rows={2}
                  value={globalDefaults.templates.product.descTemplate}
                  onChange={(e) => setGlobalDefaults({
                    ...globalDefaults,
                    templates: {
                      ...globalDefaults.templates,
                      product: { ...globalDefaults.templates.product, descTemplate: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px] resize-none"
                />
              </div>
            </div>

            {/* Hotel Template */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-[#008972]" />
                <span>Hotel Template</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Title Template</label>
                <input
                  type="text"
                  value={globalDefaults.templates.hotel.titleTemplate}
                  onChange={(e) => setGlobalDefaults({
                    ...globalDefaults,
                    templates: {
                      ...globalDefaults.templates,
                      hotel: { ...globalDefaults.templates.hotel, titleTemplate: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Description Template</label>
                <textarea
                  rows={2}
                  value={globalDefaults.templates.hotel.descTemplate}
                  onChange={(e) => setGlobalDefaults({
                    ...globalDefaults,
                    templates: {
                      ...globalDefaults.templates,
                      hotel: { ...globalDefaults.templates.hotel, descTemplate: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px] resize-none"
                />
              </div>
            </div>

            {/* Blog Template */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-[#008972]" />
                <span>Blog & Article Template</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Title Template</label>
                <input
                  type="text"
                  value={globalDefaults.templates.blog.titleTemplate}
                  onChange={(e) => setGlobalDefaults({
                    ...globalDefaults,
                    templates: {
                      ...globalDefaults.templates,
                      blog: { ...globalDefaults.templates.blog, titleTemplate: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Description Template</label>
                <textarea
                  rows={2}
                  value={globalDefaults.templates.blog.descTemplate}
                  onChange={(e) => setGlobalDefaults({
                    ...globalDefaults,
                    templates: {
                      ...globalDefaults.templates,
                      blog: { ...globalDefaults.templates.blog, descTemplate: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 font-mono text-[11px] resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 301 / 302 REDIRECT MANAGER */}
      {activeTab === 'REDIRECTS' && (
        <div className="space-y-6">
          {/* CREATE REDIRECT FORM */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Create URL Redirect</h3>
            <form onSubmit={handleAddRedirect} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Source Path (e.g. /old-tour)</label>
                <input
                  type="text"
                  value={newRedirect.sourceUrl}
                  onChange={(e) => setNewRedirect({ ...newRedirect, sourceUrl: e.target.value })}
                  placeholder="/old-slug"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 font-mono"
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Destination Path (e.g. /destinations/japan)</label>
                <input
                  type="text"
                  value={newRedirect.destinationUrl}
                  onChange={(e) => setNewRedirect({ ...newRedirect, destinationUrl: e.target.value })}
                  placeholder="/new-slug"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Status Code</label>
                <select
                  value={newRedirect.statusCode}
                  onChange={(e) => setNewRedirect({ ...newRedirect, statusCode: Number(e.target.value) as 301 | 302 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white"
                >
                  <option value={301}>301 Permanent</option>
                  <option value={302}>302 Temporary</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-[#008972] hover:bg-[#007460] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-xs"
                >
                  <span>Add Redirect</span>
                </button>
              </div>
            </form>
          </div>

          {/* REDIRECTS TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Source URL</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Hits</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {redirects.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-900 font-medium">
                      {r.sourceUrl}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#008972]">
                      {r.destinationUrl}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">
                        {r.statusCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-bold">
                      {r.hits || 0}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteRedirect(r.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete redirect"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {redirects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No active URL redirects configured. Slug changes in CMS automatically appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: TECHNICAL SEO (ROBOTS.TXT & SITEMAP.XML) */}
      {activeTab === 'TECHNICAL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* XML SITEMAP */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-[#008972]" />
                  <span>Dynamic XML Sitemap</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time generated sitemap index serving all indexable destinations, products, and articles.
                </p>
              </div>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-[#008972] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer hover:bg-[#007460]"
              >
                <span>Open /sitemap.xml</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-mono text-slate-700">{globalDefaults.canonicalDomain}/sitemap.xml</span>
              <button
                type="button"
                onClick={() => handleCopy(`${globalDefaults.canonicalDomain}/sitemap.xml`, 'sitemap')}
                className="text-[#008972] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
              >
                {copiedLink === 'sitemap' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink === 'sitemap' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Sitemap XML Raw Sample Preview
              </span>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-64 border border-slate-800">
                {generateSitemapXml(auditItems.slice(0, 5), globalDefaults)}
              </pre>
            </div>
          </div>

          {/* ROBOTS.TXT */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-[#008972]" />
                  <span>Robots.txt Directives</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instructions for search engines on which folders are crawlable vs restricted (admin, B2B, checkout).
                </p>
              </div>
              <a
                href="/robots.txt"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer hover:bg-slate-800"
              >
                <span>Open /robots.txt</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-mono text-slate-700">{globalDefaults.canonicalDomain}/robots.txt</span>
              <button
                type="button"
                onClick={() => handleCopy(`${globalDefaults.canonicalDomain}/robots.txt`, 'robots')}
                className="text-[#008972] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
              >
                {copiedLink === 'robots' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink === 'robots' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Robots.txt Output Preview
              </span>
              <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[11px] font-mono overflow-x-auto max-h-64 border border-slate-800">
                {generateRobotsTxt(globalDefaults, redirects)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && tempSEO && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Editing {editingItem.entityType} SEO
                </span>
                <h3 className="text-lg font-bold text-slate-900">{editingItem.name}</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveItemSEO}
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#008972] hover:bg-[#007460] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>

            <EntitySEOSettingsTab
              entityType={editingItem.entityType}
              entity={{ id: editingItem.entityId, name: editingItem.name }}
              seo={tempSEO}
              onChange={(updated) => setTempSEO(updated)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
