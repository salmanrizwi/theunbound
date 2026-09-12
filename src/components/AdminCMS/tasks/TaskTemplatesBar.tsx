import React, { useState } from 'react';
import { Sparkles, ArrowRight, ChevronRight } from 'lucide-react';
import { SALES_TEMPLATES, SalesTemplate } from './taskConstants';

interface TaskTemplatesBarProps {
  onSelectTemplate: (tmpl: SalesTemplate) => void;
}

export const TaskTemplatesBar: React.FC<TaskTemplatesBarProps> = ({ onSelectTemplate }) => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'SALES_FUNNEL' | 'OPERATIONS' | 'FINANCE'>('ALL');

  const filtered = activeCategory === 'ALL'
    ? SALES_TEMPLATES
    : SALES_TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#00E5C0]/20 text-[#00E5C0] flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white">Sales Funnel & Operations Templates</h3>
            <p className="text-[11px] text-slate-300">1-click task creator for sales stages, booking confirmations, and guest care</p>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
          {[
            { id: 'ALL', label: 'All Templates' },
            { id: 'SALES_FUNNEL', label: 'Sales Funnel' },
            { id: 'OPERATIONS', label: 'Operations' },
            { id: 'FINANCE', label: 'Finance' }
          ].map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeCategory === c.id
                  ? 'bg-[#008972] text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {filtered.slice(0, 8).map(tmpl => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => onSelectTemplate(tmpl)}
            className="p-3 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 hover:border-[#00E5C0]/50 rounded-2xl text-left transition-all cursor-pointer group flex flex-col justify-between space-y-2"
          >
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="font-semibold px-1.5 py-0.5 rounded bg-slate-700 text-[#00E5C0]">
                  {tmpl.badge}
                </span>
                <span>Within {tmpl.completeWithinHours}h</span>
              </div>
              <h4 className="text-xs font-bold text-white group-hover:text-[#00E5C0] transition-colors line-clamp-1">
                {tmpl.name}
              </h4>
              <p className="text-[10px] text-slate-400 line-clamp-2 mt-1">
                {tmpl.defaultNotes}
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-700/60">
              <span className="capitalize">{tmpl.relatedType.toLowerCase()} link</span>
              <span className="text-[#00E5C0] font-bold flex items-center space-x-0.5 group-hover:translate-x-0.5 transition-transform">
                <span>Use</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
