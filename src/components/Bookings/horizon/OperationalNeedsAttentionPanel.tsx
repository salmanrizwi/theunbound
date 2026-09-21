import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  HelpCircle, 
  Clock, 
  ArrowRight, 
  FileCheck, 
  UserX,
  ExternalLink
} from 'lucide-react';
import { OperationalItem } from './horizonTypes';

interface OperationalNeedsAttentionPanelProps {
  items: OperationalItem[];
  onOpenBooking: (bookingId: string) => void;
  onQuickDispatch: (item: OperationalItem) => void;
}

export const OperationalNeedsAttentionPanel: React.FC<OperationalNeedsAttentionPanelProps> = ({
  items,
  onOpenBooking,
  onQuickDispatch
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Filter items that have attention flags or conflicts
  const attentionItems = items.filter(it => it.attentionFlags.length > 0 || it.conflicts.length > 0);
  const totalIssues = attentionItems.reduce((acc, it) => acc + it.attentionFlags.length + it.conflicts.length, 0);

  if (attentionItems.length === 0) {
    return null;
  }

  return (
    <div 
      id="horizon-needs-attention-panel" 
      className="bg-white rounded-3xl border border-rose-200/80 shadow-xs overflow-hidden transition-all"
    >
      {/* Header bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 px-6 bg-rose-50/70 hover:bg-rose-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-rose-950">
                Operational Risks & Action Items
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-200/80 text-rose-900">
                {totalIssues} Issue{totalIssues > 1 ? 's' : ''} across {attentionItems.length} Service{attentionItems.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-rose-700/80 mt-0.5">
              Service items scheduled for this operational horizon require attention before dispatch or execution.
            </p>
          </div>
        </div>

        <button 
          type="button" 
          className="p-1.5 rounded-xl hover:bg-rose-100 text-rose-800 transition-colors cursor-pointer"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded list of issues */}
      {isExpanded && (
        <div className="divide-y divide-rose-100 max-h-[380px] overflow-y-auto">
          {attentionItems.map((item) => (
            <div 
              key={item.id} 
              className="p-4 px-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                    #{item.bookingReference}
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {item.title}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    • {item.leadPassengerName} ({item.totalPax} Pax)
                  </span>
                  {item.reportingTime && (
                    <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                      🕒 {item.reportingTime}
                    </span>
                  )}
                </div>

                {/* Flags and Conflicts */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {item.conflicts.map(c => (
                    <span 
                      key={c.id}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                    >
                      <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>{c.title}: {c.message}</span>
                    </span>
                  ))}

                  {item.attentionFlags.map(f => (
                    <span 
                      key={f.id}
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                        f.severity === 'critical' 
                          ? 'bg-rose-50 text-rose-800 border-rose-200' 
                          : f.severity === 'warning'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                    >
                      {f.type === 'MISSING_SUPPLIER' && <HelpCircle className="w-3 h-3 text-amber-600 shrink-0" />}
                      {f.type === 'MISSING_REPORTING_TIME' && <Clock className="w-3 h-3 text-amber-600 shrink-0" />}
                      {f.type === 'MISSING_VOUCHER' && <FileCheck className="w-3 h-3 text-blue-600 shrink-0" />}
                      {f.type === 'UNASSIGNED_OWNER' && <UserX className="w-3 h-3 text-slate-600 shrink-0" />}
                      <span>{f.label}: {f.description}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => onQuickDispatch(item)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
                >
                  <span>Quick Resolve</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenBooking(item.bookingId)}
                  className="px-3 py-1.5 rounded-xl bg-[#008972] hover:bg-[#00705d] text-white text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
                >
                  <span>Open Desk</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
