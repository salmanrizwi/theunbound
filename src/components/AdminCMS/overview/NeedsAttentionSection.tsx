import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Filter, 
  Clock, 
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { NeedsAttentionItem, PriorityLevel } from '../../../services/dashboardMetricsService';

interface NeedsAttentionSectionProps {
  items: NeedsAttentionItem[];
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
}

export const NeedsAttentionSection: React.FC<NeedsAttentionSectionProps> = ({
  items,
  onNavigate
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL' | 'LEAD' | 'QUOTE' | 'BOOKING' | 'TASK' | 'SUPPLIER'>('ALL');

  const filteredItems = items.filter(item => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'CRITICAL') return item.priority === 'CRITICAL';
    return item.category === selectedFilter;
  });

  const criticalCount = items.filter(i => i.priority === 'CRITICAL').length;

  return (
    <section id="cms-needs-attention-section" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Needs Attention
            </h2>
            {criticalCount > 0 && (
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                {criticalCount} Critical Action{criticalCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prioritized exceptions required to fulfill customer ground SLAs, avoid booking errors and unblock revenue.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {[
            { id: 'ALL', label: `All (${items.length})` },
            { id: 'CRITICAL', label: `Critical (${criticalCount})` },
            { id: 'BOOKING', label: 'Bookings' },
            { id: 'LEAD', label: 'Leads' },
            { id: 'QUOTE', label: 'Quotes' },
            { id: 'TASK', label: 'Tasks' },
            { id: 'SUPPLIER', label: 'Suppliers' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id as any)}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                selectedFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">Operational Horizon Clear</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Zero pending exceptions found in this category. All customer quotes, confirmed booking vouchers, passenger documents, and supplier allocations meet operational thresholds.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredItems.map(item => {
            const isCritical = item.priority === 'CRITICAL';
            const isHigh = item.priority === 'HIGH';

            return (
              <div
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50/50 -mx-2 px-2 rounded-2xl transition-colors"
              >
                <div className="flex items-start space-x-3.5 min-w-0">
                  {/* Badge */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 mt-0.5 border ${
                    isCritical
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : isHigh
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {item.count}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#008972] transition-colors">
                        {item.title}
                      </h4>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        isCritical
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : isHigh
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {item.priority}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        · {item.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <button
                  id={`btn-action-${item.id}`}
                  onClick={() => onNavigate(item.section, item.subTab, item.recordId)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 self-end sm:self-center cursor-pointer shadow-2xs ${
                    isCritical
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-900 hover:bg-[#008972] text-white'
                  }`}
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
