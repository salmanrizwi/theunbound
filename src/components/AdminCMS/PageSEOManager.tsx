import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase } from '../../services/db';
import { CustomPage, User } from '../../types';
import { EntitySEO, SEOAuditItem } from '../../types/seo';
import { useAuth } from '../../context/AuthContext';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import {
  DEFAULT_GLOBAL_SEO_DEFAULTS,
  buildFallbackSEO,
  auditEntitySEO,
  sanitizeSlug
} from '../../services/seoEngine';
import {
  Globe,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Edit3,
  Save,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  FileText,
  Layers,
  ArrowLeft,
  X,
  Copy,
  Check,
  Clock,
  Compass
} from 'lucide-react';

interface PageSEOManagerProps {
  currentUser?: User | null;
  onSelectPage?: (pageId: string) => void;
}

export const PageSEOManager: React.FC<PageSEOManagerProps> = ({ currentUser, onSelectPage }) => {
  const db = AppDatabase.getInstance();
  const { user: authUser } = useAuth();
  const activeUser = currentUser || authUser || db.getCurrentUser();

  const [pages, setPages] = useState<CustomPage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETE' | 'WARNING' | 'CRITICAL' | 'NOINDEX'>('ALL');
  const [publishingFilter, setPublishingFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');

  // Currently editing page
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [editorSubTab, setEditorSubTab] = useState<'METADATA' | 'PREVIEW'>('METADATA');
  const [previewDevice, setPreviewMode] = useState<'GOOGLE_DESKTOP' | 'GOOGLE_MOBILE' | 'SOCIAL'>('GOOGLE_DESKTOP');
  const [saveSuccessNotice, setSaveNotice] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const loadPages = () => {
    const list = db.getCustomPages();
    setPages(list);
  };

  useEffect(() => {
    loadPages();
    const unsubscribe = db.subscribe(() => {
      loadPages();
    });
    return unsubscribe;
  }, []);

  // Compute live metrics across all pages
  const metrics = useMemo(() => {
    let total = pages.length;
    let configured = 0;
    let needsAttention = 0;
    let noindex = 0;

    pages.forEach(p => {
      const effectiveSeo = p.seo || {
        metaTitle: p.metaTitle || p.seoTitle || p.title,
        metaDescription: p.metaDescription || p.seoDescription || p.subtitle,
        slug: p.slug
      };
      const audit = auditEntitySEO('CUSTOM_PAGE', p, effectiveSeo, DEFAULT_GLOBAL_SEO_DEFAULTS);
      
      if (effectiveSeo.robots?.index === false) {
        noindex++;
      }
      if (audit.health === 'COMPLETE') {
        configured++;
      } else {
        needsAttention++;
      }
    });

    return { total, configured, needsAttention, noindex };
  }, [pages]);

  // Filtered pages list
  const filteredPages = useMemo(() => {
    return pages.filter(page => {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (page.title || '').toLowerCase().includes(q);
      const slugMatch = (page.slug || '').toLowerCase().includes(q);
      const metaTitleMatch = (page.metaTitle || page.seoTitle || '').toLowerCase().includes(q);
      const searchMatch = !q || titleMatch || slugMatch || metaTitleMatch;

      if (!searchMatch) return false;

      // Publishing filter
      if (publishingFilter === 'PUBLISHED' && !page.isPublished) return false;
      if (publishingFilter === 'DRAFT' && page.isPublished) return false;

      // Status filter
      const effectiveSeo = page.seo || {
        metaTitle: page.metaTitle || page.seoTitle || page.title,
        metaDescription: page.metaDescription || page.seoDescription || page.subtitle,
        slug: page.slug
      };
      const audit = auditEntitySEO('CUSTOM_PAGE', page, effectiveSeo, DEFAULT_GLOBAL_SEO_DEFAULTS);

      if (statusFilter === 'NOINDEX' && page.seo?.robots?.index !== false) return false;
      if (statusFilter === 'COMPLETE' && audit.health !== 'COMPLETE') return false;
      if (statusFilter === 'WARNING' && audit.health !== 'WARNING') return false;
      if (statusFilter === 'CRITICAL' && (audit.health as string) !== 'CRITICAL' && audit.health !== 'ERROR') return false;

      return true;
    });
  }, [pages, searchQuery, statusFilter, publishingFilter]);

  const handleOpenSEOEditor = (page: CustomPage) => {
    const fallbackSeo = buildFallbackSEO('CUSTOM_PAGE', page, DEFAULT_GLOBAL_SEO_DEFAULTS);
    const mergedSeo: EntitySEO = page.seo || {
      ...fallbackSeo,
      title: page.metaTitle || page.seoTitle || fallbackSeo.title || page.title,
      metaDescription: page.metaDescription || page.seoDescription || fallbackSeo.metaDescription || page.subtitle || '',
      slug: page.slug,
      robots: page.seo?.robots || { index: true, follow: true },
      schemaEnabled: page.seo?.schemaEnabled ?? true,
      ogImage: page.ogImage || page.heroImage || fallbackSeo.ogImage
    };

    setEditingPage({
      ...page,
      seo: mergedSeo,
      metaTitle: mergedSeo.title || page.metaTitle,
      metaDescription: mergedSeo.metaDescription || page.metaDescription
    });
  };

  const handleSavePageSEO = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPage) return;

    const now = new Date().toISOString();
    const updatedPage: CustomPage = {
      ...editingPage,
      metaTitle: editingPage.seo?.metaTitle || editingPage.metaTitle || editingPage.seoTitle || editingPage.title,
      metaDescription: editingPage.seo?.metaDescription || editingPage.metaDescription || editingPage.seoDescription,
      seoTitle: editingPage.seo?.metaTitle || editingPage.metaTitle,
      seoDescription: editingPage.seo?.metaDescription || editingPage.metaDescription,
      slug: editingPage.seo?.slug || editingPage.slug,
      keywords: editingPage.seo?.keywords || editingPage.keywords,
      ogImage: editingPage.seo?.ogImage || editingPage.ogImage || editingPage.heroImage,
      updatedAt: now
    };

    db.saveCustomPage(updatedPage, activeUser);
    loadPages();
    setSaveNotice(true);
    setTimeout(() => {
      setSaveNotice(false);
      setEditingPage(null);
    }, 1200);
  };

  const handleCopyPageUrl = (slug: string) => {
    const fullUrl = `https://theunbound.in/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6" id="page-seo-management-workspace">
      {/* Top Banner & Title */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-[#008972] flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#00C6A6]" />
              Page SEO & Indexing Command
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs text-slate-500 font-bold">
              {metrics.total} Canonical Pages
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Page SEO Management Engine
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Configure, audit, preview, and publish search engine metadata, OpenGraph social cards, canonical URLs, and schema markup across all custom pages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPages()}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Refresh Page Records"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Records</span>
          </button>
        </div>
      </div>

      {/* Live Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-50 text-[#008972]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900">{metrics.total}</div>
            <div className="text-[11px] font-bold text-slate-500">Total Pages</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-emerald-700">{metrics.configured}</div>
            <div className="text-[11px] font-bold text-slate-500">SEO Complete</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-amber-700">{metrics.needsAttention}</div>
            <div className="text-[11px] font-bold text-slate-500">Needs Review</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-100 text-slate-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black text-slate-700">{metrics.noindex}</div>
            <div className="text-[11px] font-bold text-slate-500">Noindex Pages</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by page title, slug, or SEO title..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6] outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500">SEO Health:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETE">Complete (High Score)</option>
              <option value="WARNING">Needs Attention</option>
              <option value="CRITICAL">Missing Meta</option>
              <option value="NOINDEX">Noindex Marked</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500">Status:</span>
            <select
              value={publishingFilter}
              onChange={e => setPublishingFilter(e.target.value as any)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
            >
              <option value="ALL">All Pages</option>
              <option value="PUBLISHED">Published Only</option>
              <option value="DRAFT">Draft Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Page Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#008972]" />
            <span>Page SEO Registry ({filteredPages.length})</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            Directly connected to published page HTML head
          </span>
        </div>

        {filteredPages.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Globe className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No matching Page SEO records found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your search query or filters to locate specific custom pages.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Page Title & Slug</th>
                  <th className="py-3 px-4">SEO Meta Title</th>
                  <th className="py-3 px-4">Meta Description</th>
                  <th className="py-3 px-4 text-center">Indexing</th>
                  <th className="py-3 px-4 text-center">SEO Score</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPages.map(page => {
                  const effectiveSeo = page.seo || {
                    metaTitle: page.metaTitle || page.seoTitle || page.title,
                    metaDescription: page.metaDescription || page.seoDescription || page.subtitle,
                    slug: page.slug
                  };
                  const audit = auditEntitySEO('CUSTOM_PAGE', page, effectiveSeo, DEFAULT_GLOBAL_SEO_DEFAULTS);
                  const isNoIndex = page.seo?.robots?.index === false;

                  return (
                    <tr key={page.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Title & Slug */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{page.title}</span>
                            {page.isPublished ? (
                              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-extrabold uppercase">
                                Published
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-extrabold uppercase">
                                Draft
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-[#008972]">
                            /{page.slug}
                          </div>
                        </div>
                      </td>

                      {/* SEO Meta Title */}
                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <p className="font-semibold text-slate-800 line-clamp-1">
                          {page.seo?.metaTitle || page.metaTitle || page.seoTitle || page.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {(page.seo?.metaTitle || page.metaTitle || page.title || '').length} chars
                        </p>
                      </td>

                      {/* Meta Description */}
                      <td className="py-3.5 px-4 align-top max-w-sm">
                        <p className="text-slate-600 text-[11px] line-clamp-2">
                          {page.seo?.metaDescription || page.metaDescription || page.seoDescription || page.subtitle || 'No meta description configured.'}
                        </p>
                      </td>

                      {/* Indexing Badge */}
                      <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                        {isNoIndex ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                            NOINDEX
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            INDEX
                          </span>
                        )}
                      </td>

                      {/* Health Score */}
                      <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black border inline-flex items-center gap-1 ${
                          audit.score >= 80 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          audit.score >= 50 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          <span>{audit.score}</span>
                          <span className="text-[9px] font-normal text-slate-400">/100</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenSEOEditor(page)}
                            className="px-3 py-1.5 bg-[#008972] hover:bg-[#00705d] text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit SEO</span>
                          </button>

                          <button
                            onClick={() => handleCopyPageUrl(page.slug)}
                            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            title="Copy Canonical URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED PAGE SEO EDITOR MODAL (25/75 WORKSPACE PATTERN) */}
      {/* ========================================================================= */}
      {editingPage && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-6xl w-full max-h-[92vh] overflow-y-auto space-y-6 shadow-2xl border border-slate-200 my-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-teal-50 text-[#008972]">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900">
                      Page SEO Editor • {editingPage.title}
                    </h3>
                    <span className="text-xs font-mono font-bold text-[#008972]">
                      /{editingPage.slug}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Authoritative SEO configuration bound directly to Firestore CustomPage record.
                  </p>
                </div>
              </div>

              {saveSuccessNotice && (
                <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>SEO Settings Saved & Synced!</span>
                </div>
              )}

              <button
                onClick={() => setEditingPage(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 25 / 75 WORKSPACE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT 25% COLUMN: PREVIEWS & HEALTH CONTEXT */}
              <div className="lg:col-span-4 space-y-4">
                {/* Page Context Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Page Context Snapshot
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{editingPage.title}</div>
                  <div className="font-mono text-[#008972]">https://theunbound.in/{editingPage.slug}</div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      editingPage.isPublished 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {editingPage.isPublished ? 'Live Published' : 'Draft Mode'}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Layout: {editingPage.layoutTemplate || 'STANDARD'}
                    </span>
                  </div>
                </div>

                {/* Google Search Snippet Preview */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-[#00C6A6]" />
                      Google Search Preview
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-bold bg-slate-100 p-0.5 rounded-lg">
                      <button
                        onClick={() => setPreviewMode('GOOGLE_DESKTOP')}
                        className={`px-2 py-0.5 rounded ${previewDevice === 'GOOGLE_DESKTOP' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                      >
                        Desktop
                      </button>
                      <button
                        onClick={() => setPreviewMode('GOOGLE_MOBILE')}
                        className={`px-2 py-0.5 rounded ${previewDevice === 'GOOGLE_MOBILE' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                      >
                        Mobile
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 font-sans text-xs">
                    <div className="text-[11px] text-[#202124] flex items-center gap-1 truncate">
                      <span className="font-semibold text-slate-700">theunbound.in</span>
                      <span className="text-slate-400">› {editingPage.slug}</span>
                    </div>
                    <div className="text-sm font-bold text-[#1a0dab] hover:underline cursor-pointer line-clamp-1">
                      {editingPage.seo?.metaTitle || editingPage.metaTitle || editingPage.title}
                    </div>
                    <div className="text-[11px] text-[#4d5156] line-clamp-2 leading-relaxed">
                      {editingPage.seo?.metaDescription || editingPage.metaDescription || 'No description provided.'}
                    </div>
                  </div>
                </div>

                {/* Social Share Card Preview */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-sky-600" />
                    OpenGraph Social Share Card
                  </span>

                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 text-xs">
                    <div className="h-32 bg-slate-200 relative overflow-hidden">
                      <img
                        src={editingPage.seo?.ogImage || editingPage.ogImage || editingPage.heroImage || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80'}
                        alt="Social Card Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3 space-y-1 bg-white">
                      <div className="text-[10px] font-mono text-slate-400 uppercase">THEUNBOUND.IN</div>
                      <div className="font-bold text-slate-900 line-clamp-1">
                        {editingPage.seo?.ogTitle || editingPage.seo?.metaTitle || editingPage.title}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-2">
                        {editingPage.seo?.ogDescription || editingPage.seo?.metaDescription || editingPage.subtitle || 'Luxury travel logistics.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT 75% COLUMN: CANONICAL SEO FORM VIA EntitySEOSettingsTab */}
              <div className="lg:col-span-8 space-y-6">
                <EntitySEOSettingsTab
                  entityType="CUSTOM_PAGE"
                  entity={editingPage}
                  seo={editingPage.seo || {
                    metaTitle: editingPage.metaTitle || editingPage.seoTitle || editingPage.title,
                    metaDescription: editingPage.metaDescription || editingPage.seoDescription || editingPage.subtitle,
                    slug: editingPage.slug,
                    canonicalUrl: `https://theunbound.in/${editingPage.slug}`,
                    keywords: editingPage.keywords || [],
                    ogImage: editingPage.ogImage || editingPage.heroImage
                  }}
                  onChange={(newSeo) => {
                    setEditingPage(prev => prev ? {
                      ...prev,
                      seo: newSeo,
                      metaTitle: newSeo.metaTitle || newSeo.title || prev.metaTitle,
                      metaDescription: newSeo.metaDescription || prev.metaDescription,
                      seoTitle: newSeo.metaTitle || newSeo.title || prev.seoTitle,
                      seoDescription: newSeo.metaDescription || prev.seoDescription,
                      keywords: newSeo.keywords || prev.keywords,
                      ogImage: newSeo.ogImage || prev.ogImage,
                      slug: newSeo.slug || prev.slug
                    } : null);
                  }}
                />

                {/* Bottom Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingPage(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSavePageSEO()}
                    className="px-6 py-2.5 bg-[#008972] hover:bg-[#00705d] text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Page SEO Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
