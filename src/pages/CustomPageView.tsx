import React, { useState, useEffect } from 'react';
import { CustomPage, CustomPageBlock } from '../types';
import { AppDatabase } from '../services/db';
import { 
  Compass, 
  Calendar, 
  ArrowLeft, 
  Share2, 
  Check, 
  HelpCircle, 
  ChevronDown, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  PhoneCall, 
  Send,
  AlertTriangle,
  FileText,
  Layers,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { AboutUsPage } from './AboutUsPage';

interface CustomPageViewProps {
  pageSlug: string;
  onBackToExplore: () => void;
  onNavigateToBuilder?: () => void;
  onSelectDestination?: (slug: string) => void;
  onNavigateToContact?: () => void;
}

export const CustomPageView: React.FC<CustomPageViewProps> = ({ 
  pageSlug, 
  onBackToExplore,
  onNavigateToBuilder,
  onSelectDestination,
  onNavigateToContact
}) => {
  const isAboutPage = pageSlug === 'about-theunbound' || pageSlug === 'about' || pageSlug === 'about-us';

  const db = AppDatabase.getInstance();
  const page = db.getCustomPageBySlug(pageSlug);
  const [copied, setCopied] = useState(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  // SEO synchronization: update document title, meta description, and OpenGraph tags
  useEffect(() => {
    if (!isAboutPage && page) {
      const seoTitle = page.seo?.title || (page.seo as any)?.metaTitle || page.metaTitle || page.seoTitle || `${page.title} | TheUnbound DMC`;
      const seoDesc = page.seo?.metaDescription || page.metaDescription || page.seoDescription || page.subtitle || '';
      const seoImage = page.seo?.ogImage || page.ogImage || page.heroImage || '';

      document.title = seoTitle;

      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && seoDesc) {
        metaDesc.setAttribute('content', seoDesc);
      }

      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', seoTitle);

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc && seoDesc) ogDesc.setAttribute('content', seoDesc);

      let ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg && seoImage) ogImg.setAttribute('content', seoImage);
    }
  }, [page, isAboutPage]);

  // If viewing about theunbound, show the dedicated rich About Us page
  if (isAboutPage) {
    return (
      <AboutUsPage
        onBackToExplore={onBackToExplore}
        onNavigateToBuilder={onNavigateToBuilder}
        onSelectDestination={onSelectDestination}
        onNavigateToContact={onNavigateToContact}
      />
    );
  }

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Page Not Found</h2>
        <p className="text-sm text-slate-500">The requested custom page could not be located in TheUnbound CMS.</p>
        <button
          onClick={onBackToExplore}
          className="px-4 py-2 bg-[#00C6A6] text-slate-950 font-bold rounded-xl text-xs cursor-pointer hover:bg-[#00b296] transition-colors"
        >
          Return to Destinations
        </button>
      </div>
    );
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple paragraph & markdown heading formatter
  const renderFormattedContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-3" />;
      if (trimmed.startsWith('### ')) {
        return <h3 key={idx} className="text-lg font-bold text-slate-900 mt-4 mb-2">{trimmed.replace('### ', '')}</h3>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={idx} className="text-xl font-bold text-slate-900 mt-6 mb-3">{trimmed.replace('## ', '')}</h2>;
      }
      if (trimmed.startsWith('# ')) {
        return <h1 key={idx} className="text-2xl font-black text-slate-900 mt-8 mb-4">{trimmed.replace('# ', '')}</h1>;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={idx} className="ml-5 list-disc text-slate-700 text-sm leading-relaxed mb-1">
            {trimmed.substring(2)}
          </li>
        );
      }
      return (
        <p key={idx} className="text-slate-700 text-sm sm:text-base leading-relaxed mb-3">
          {trimmed}
        </p>
      );
    });
  };

  const layout = page.layoutTemplate || 'STANDARD';
  const hasBlocks = Array.isArray(page.blocks) && page.blocks.length > 0;

  // Render individual custom block
  const renderBlock = (block: CustomPageBlock, index: number) => {
    switch (block.type) {
      case 'RICH_TEXT':
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h3 className="text-xl font-bold text-slate-900 mb-2">{block.title}</h3>}
            {renderFormattedContent(block.content || '')}
          </div>
        );

      case 'FEATURE_GRID': {
        let items: Array<{ title: string; description: string; icon?: string }> = [];
        if (Array.isArray(block.data?.items)) {
          items = block.data.items;
        } else if (block.content) {
          // Parse lines as items
          items = block.content.split('\n').filter(Boolean).map(line => {
            const [t, ...rest] = line.split(':');
            return {
              title: t.replace(/^[-*]\s*/, '').trim(),
              description: rest.join(':').trim() || ''
            };
          });
        }
        return (
          <div key={block.id || index} className="space-y-4">
            {block.title && (
              <div>
                <h3 className="text-xl font-bold text-slate-900">{block.title}</h3>
                {block.subtitle && <p className="text-xs text-slate-500 mt-1">{block.subtitle}</p>}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-[#00C6A6]/10 text-[#00a88d] flex items-center justify-center font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{it.title}</h4>
                  {it.description && <p className="text-xs text-slate-600 leading-relaxed">{it.description}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'CTA':
        return (
          <div key={block.id || index} className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 border border-slate-800 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ground Operations Service Guarantee</span>
              </span>
              <h3 className="text-xl sm:text-2xl font-black">{block.title || 'Ready to Plan Your Custom Itinerary?'}</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {block.content || block.subtitle || 'Connect with our dedicated ground operations team for contracted B2B wholesale rates, licensed guides, and luxury transport.'}
              </p>
              <div className="pt-3 flex flex-wrap items-center gap-3">
                {onNavigateToBuilder && (
                  <button
                    onClick={onNavigateToBuilder}
                    className="px-4 py-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Launch B2B Quote Builder
                  </button>
                )}
                {onNavigateToContact && (
                  <button
                    onClick={onNavigateToContact}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  >
                    Contact Operations Desk
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      case 'FAQ': {
        let faqs: Array<{ q: string; a: string }> = [];
        if (Array.isArray(block.data?.faqs)) {
          faqs = block.data.faqs;
        } else if (block.content) {
          // Parse Q: and A:
          const parts = block.content.split('\n\n');
          parts.forEach(part => {
            const lines = part.split('\n');
            const qLine = lines.find(l => l.toLowerCase().startsWith('q:')) || lines[0];
            const aLine = lines.find(l => l.toLowerCase().startsWith('a:')) || lines.slice(1).join(' ');
            if (qLine) {
              faqs.push({
                q: qLine.replace(/^[Qq]:\s*/, '').trim(),
                a: aLine.replace(/^[Aa]:\s*/, '').trim()
              });
            }
          });
        }
        return (
          <div key={block.id || index} className="space-y-4">
            {block.title && <h3 className="text-xl font-bold text-slate-900">{block.title}</h3>}
            <div className="space-y-2">
              {faqs.map((faq, fIdx) => {
                const isExpanded = expandedFaqIndex === fIdx;
                return (
                  <div key={fIdx} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden transition-colors">
                    <button
                      onClick={() => setExpandedFaqIndex(isExpanded ? null : fIdx)}
                      className="w-full text-left p-4 flex items-center justify-between gap-4 font-bold text-sm text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-[#00C6A6] shrink-0" />
                        <span>{faq.q}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-[#00C6A6]' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="p-4 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/50">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'IMAGE_GALLERY': {
        const images: string[] = Array.isArray(block.data?.images) ? block.data.images : [];
        return (
          <div key={block.id || index} className="space-y-3">
            {block.title && <h3 className="text-xl font-bold text-slate-900">{block.title}</h3>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {images.map((img, iIdx) => (
                <div key={iIdx} className="rounded-2xl overflow-hidden h-48 bg-slate-100 border border-slate-200">
                  <img src={img} alt={`Gallery item ${iIdx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        );
      }

      default:
        return (
          <div key={block.id || index} className="space-y-2">
            {block.title && <h3 className="text-xl font-bold text-slate-900">{block.title}</h3>}
            {block.content && renderFormattedContent(block.content)}
          </div>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Draft Notification Banner */}
      {!page.isPublished && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-2xl p-4 flex items-center space-x-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Draft Page Preview:</strong> This page is currently unpublished and not visible to public visitors in website navigation.
          </div>
        </div>
      )}

      {/* Back button */}
      <button
        onClick={onBackToExplore}
        className="inline-flex items-center space-x-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 text-[#00C6A6]" />
        <span>Back to Destinations</span>
      </button>

      {/* Hero Banner (omitted or simplified if MINIMAL) */}
      {layout !== 'MINIMAL' ? (
        <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-slate-950 text-white min-h-[280px] flex flex-col justify-end p-6 sm:p-10">
          {page.heroImage && (
            <div className="absolute inset-0 z-0">
              <img
                src={page.heroImage}
                alt={page.title}
                className="w-full h-full object-cover opacity-50"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            </div>
          )}

          <div className="relative z-10 space-y-2 max-w-3xl">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#00E5C0]">
              <Compass className="w-4 h-4" />
              <span>TheUnbound Editorial & Destination Guides</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              {page.title}
            </h1>
            {page.subtitle && (
              <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
                {page.subtitle}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#00C6A6]">
            <Compass className="w-4 h-4" />
            <span>TheUnbound Editorial</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {page.title}
          </h1>
          {page.subtitle && (
            <p className="text-base text-slate-600 leading-relaxed font-medium">
              {page.subtitle}
            </p>
          )}
        </div>
      )}

      {/* Content Layout */}
      {layout === 'HERO_SIDEBAR' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Body */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#00C6A6]" />
                <span>Last Updated: {page.updatedAt ? new Date(page.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
              </div>

              <button
                onClick={handleShare}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copied ? 'Link Copied' : 'Share'}</span>
              </button>
            </div>

            <div className="space-y-4">
              {renderFormattedContent(page.content)}
            </div>

            {hasBlocks && (
              <div className="pt-6 border-t border-slate-100 space-y-6">
                {page.blocks!.map((block, idx) => renderBlock(block, idx))}
              </div>
            )}
          </div>

          {/* Sidebar Card */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 text-[#00E5C0] flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Direct DMC Ground Desk</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Contracted B2B ground tariffs, guaranteed vehicle logistics, and dedicated destination specialists.
                </p>
              </div>

              <div className="space-y-2 pt-2 text-xs border-t border-slate-800 text-slate-300">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#00C6A6]" />
                  <span>24–48h Ground Confirmation SLA</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
                  <span>Licensed VIP Transport & Guides</span>
                </div>
              </div>

              {onNavigateToContact && (
                <button
                  onClick={onNavigateToContact}
                  className="w-full py-2.5 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Request Custom Itinerary</span>
                </button>
              )}
            </div>

            {/* Quick Destination Hubs */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Operational Hubs</h4>
              <div className="space-y-1">
                {[
                  { name: 'Japan (Tokyo, Kyoto, Osaka)', slug: 'japan' },
                  { name: 'United Kingdom (London, Scotland)', slug: 'united-kingdom' },
                  { name: 'Western Europe (France, Italy, Switzerland)', slug: 'europe' },
                  { name: 'Iceland & Nordics', slug: 'iceland' },
                  { name: 'Australia & New Zealand', slug: 'australia' }
                ].map((d, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectDestination && onSelectDestination(d.slug)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-[#00C6A6] hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between"
                  >
                    <span>{d.name}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Standard or Feature Grid Layout */
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#00C6A6]" />
              <span>Last Updated: {page.updatedAt ? new Date(page.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
            </div>

            <button
              onClick={handleShare}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Link Copied' : 'Share Article'}</span>
            </button>
          </div>

          <div className="space-y-4">
            {renderFormattedContent(page.content)}
          </div>

          {/* Render Additional Custom Blocks if any */}
          {hasBlocks && (
            <div className="pt-8 border-t border-slate-100 space-y-8">
              {page.blocks!.map((block, idx) => renderBlock(block, idx))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
