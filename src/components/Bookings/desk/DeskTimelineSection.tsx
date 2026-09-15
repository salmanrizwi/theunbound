import React, { useState, useMemo } from 'react';
import { Booking, BookingTimelineEvent, BookingActivityTimelineEvent, User } from '../../../types';
import { 
  Clock, 
  CheckCircle2, 
  FileText, 
  CreditCard, 
  Building2, 
  Users, 
  Send, 
  AlertCircle, 
  MessageSquare, 
  Sparkles, 
  DollarSign, 
  Calendar,
  Filter,
  Search,
  Layers,
  ArrowRight
} from 'lucide-react';

interface DeskTimelineSectionProps {
  booking: Booking;
  currentUser: User | null;
}

interface ConsolidatedEvent {
  id: string;
  timestamp: string;
  category: 'ALL' | 'SUPPLIER' | 'PRICING' | 'PAYMENT' | 'STATUS' | 'PASSENGERS' | 'DOCS' | 'TASKS' | 'NOTES';
  title: string;
  description: string;
  actorName: string;
  actorRole?: string;
  serviceItemName?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  rawType: string;
}

export const DeskTimelineSection: React.FC<DeskTimelineSectionProps> = ({
  booking,
  currentUser
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Consolidate both booking.timeline and booking.serviceItemActivities
  const consolidatedEvents: ConsolidatedEvent[] = useMemo(() => {
    const list: ConsolidatedEvent[] = [];

    // 1. Map standard timeline events
    (booking.timeline || []).forEach((ev, idx) => {
      let cat: ConsolidatedEvent['category'] = 'ALL';
      if (ev.type === 'SUPPLIER') cat = 'SUPPLIER';
      else if (ev.type === 'PAYMENT') cat = 'PAYMENT';
      else if (ev.type === 'STATUS_CHANGE' || ev.type === 'CREATION') cat = 'STATUS';
      else if (ev.type === 'PASSENGER') cat = 'PASSENGERS';
      else if (ev.type === 'DOCUMENT') cat = 'DOCS';
      else if (ev.type === 'COMMUNICATION' || ev.type === 'SLA_REMINDER') cat = 'NOTES';

      list.push({
        id: ev.id || `tl-${idx}`,
        timestamp: ev.timestamp,
        category: cat,
        title: ev.title || (ev.type ? ev.type.replace(/_/g, ' ') : 'Lifecycle Event'),
        description: ev.description,
        actorName: ev.actor || 'System',
        rawType: ev.type
      });
    });

    // 2. Map serviceItemActivities
    (booking.serviceItemActivities || []).forEach((act, idx) => {
      let cat: ConsolidatedEvent['category'] = 'SUPPLIER';
      const typeStr = act.eventType || '';
      if (typeStr.includes('PRICE') || typeStr.includes('COST')) cat = 'PRICING';
      else if (typeStr.includes('SUPPLIER')) cat = 'SUPPLIER';
      else if (typeStr.includes('STATUS') || typeStr.includes('CONFIRM')) cat = 'STATUS';
      else if (typeStr.includes('PAYMENT')) cat = 'PAYMENT';
      else if (typeStr.includes('DOCUMENT') || typeStr.includes('VOUCHER') || typeStr.includes('INVOICE')) cat = 'DOCS';

      list.push({
        id: act.eventId || `act-${idx}`,
        timestamp: act.timestamp,
        category: cat,
        title: act.eventType ? act.eventType.replace(/_/g, ' ') : 'Operations Action',
        description: act.description,
        actorName: act.actorName || 'Operations Staff',
        actorRole: act.actorRole,
        serviceItemName: act.serviceItemName,
        previousValue: act.previousValue,
        newValue: act.newValue,
        reason: (act as any).reason,
        rawType: act.eventType
      });
    });

    // De-duplicate by title + timestamp (within 1 second)
    const seen = new Set<string>();
    const unique = list.filter(item => {
      const key = `${item.title}-${item.timestamp.slice(0, 19)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort descending by timestamp
    return unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [booking.timeline, booking.serviceItemActivities]);

  // Filtered
  const filteredEvents = useMemo(() => {
    return consolidatedEvents.filter(ev => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        ev.title.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q) ||
        ev.actorName.toLowerCase().includes(q) ||
        (ev.serviceItemName && ev.serviceItemName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;

      return true;
    });
  }, [consolidatedEvents, searchQuery, categoryFilter]);

  const getEventBadge = (cat: ConsolidatedEvent['category']) => {
    switch (cat) {
      case 'STATUS': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'SUPPLIER': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'PRICING': return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'PAYMENT': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'PASSENGERS': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'DOCS': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'TASKS': return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getEventIcon = (cat: ConsolidatedEvent['category']) => {
    switch (cat) {
      case 'STATUS': return CheckCircle2;
      case 'SUPPLIER': return Building2;
      case 'PRICING': return DollarSign;
      case 'PAYMENT': return CreditCard;
      case 'PASSENGERS': return Users;
      case 'DOCS': return FileText;
      case 'TASKS': return Clock;
      default: return Clock;
    }
  };

  return (
    <div id="desk-timeline-section" className="space-y-6">
      {/* Search & Category Filter Controls */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail, users, services, amounts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#008f77]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#008f77]"
          >
            <option value="ALL">All Audit Events ({consolidatedEvents.length})</option>
            <option value="SUPPLIER">Supplier Allocations</option>
            <option value="PRICING">Commercial Pricing</option>
            <option value="STATUS">Status & Amendments</option>
            <option value="PAYMENT">Payments & Tranches</option>
            <option value="PASSENGERS">Passengers</option>
            <option value="DOCS">Documents & Vouchers</option>
          </select>
        </div>
      </div>

      {/* Main Consolidated Timeline */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#008f77]" />
              Authoritative Booking Timeline & Audit Log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidated, tamper-evident chronological ledger of booking actions, status changes, supplier assignments, and price versions.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {filteredEvents.length} recorded events
          </span>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Layers className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-bold">No events found matching this filter.</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {filteredEvents.map(ev => {
              const IconComponent = getEventIcon(ev.category);
              const badgeClass = getEventBadge(ev.category);

              return (
                <div key={ev.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-[#008f77] flex items-center justify-center shadow-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#008f77]" />
                  </div>

                  {/* Event Card */}
                  <div className="bg-slate-50/70 group-hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-4 transition-all space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${badgeClass}`}>
                          {ev.category}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{ev.title}</h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(ev.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{ev.description}</p>

                    {/* Diff / Value Change where applicable */}
                    {(ev.previousValue || ev.newValue) && (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 text-[11px] font-mono flex items-center gap-2">
                        <span className="text-slate-400 line-through truncate max-w-[45%]">
                          {ev.previousValue || 'None'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800 truncate max-w-[45%]">
                          {ev.newValue}
                        </span>
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 pt-1 border-t border-slate-200/50">
                      <span>User: <strong className="text-slate-600">{ev.actorName}</strong> {ev.actorRole ? `(${ev.actorRole})` : ''}</span>
                      {ev.serviceItemName && (
                        <span>Service: <strong className="text-slate-600">{ev.serviceItemName}</strong></span>
                      )}
                      {ev.reason && (
                        <span>Reason: <em className="text-slate-600">{ev.reason}</em></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
