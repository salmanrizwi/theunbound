import React from 'react';
import { CustomPage } from '../types';
import { AppDatabase } from '../services/db';
import { Compass, Calendar, ArrowLeft, Share2, Check } from 'lucide-react';

interface CustomPageViewProps {
  pageSlug: string;
  onBackToExplore: () => void;
}

export const CustomPageView: React.FC<CustomPageViewProps> = ({ pageSlug, onBackToExplore }) => {
  const db = AppDatabase.getInstance();
  const page = db.getCustomPageBySlug(pageSlug);
  const [copied, setCopied] = React.useState(false);

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">Page Not Found</h2>
        <p className="text-sm text-slate-500">The requested custom page could not be located.</p>
        <button
          onClick={onBackToExplore}
          className="px-4 py-2 bg-[#00C6A6] text-slate-950 font-bold rounded-xl text-xs"
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

  // Simple paragraph & heading formatter
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Back button */}
      <button
        onClick={onBackToExplore}
        className="inline-flex items-center space-x-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 text-[#00C6A6]" />
        <span>Back to Destinations</span>
      </button>

      {/* Hero Banner */}
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
            <span>TheUnbound Editorial & Guides</span>
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

      {/* Content Body */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-6">
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

        <div className="space-y-1">
          {renderFormattedContent(page.content)}
        </div>
      </div>
    </div>
  );
};
