import React from 'react';
import { Booking, BookingTimelineEvent } from '../../types';
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
  Archive,
  XCircle
} from 'lucide-react';

interface BookingTimelineViewProps {
  booking: Booking;
}

export const BookingTimelineView: React.FC<BookingTimelineViewProps> = ({ booking }) => {
  const events = booking.timeline || [];

  const getEventIcon = (type: BookingTimelineEvent['type']) => {
    switch (type) {
      case 'CREATION': return Sparkles;
      case 'STATUS_CHANGE': return CheckCircle2;
      case 'PASSENGER': return Users;
      case 'DOCUMENT': return FileText;
      case 'PAYMENT': return CreditCard;
      case 'SUPPLIER': return Building2;
      case 'COMMUNICATION': return Send;
      case 'SLA_REMINDER': return Clock;
      default: return Clock;
    }
  };

  const getEventColor = (type: BookingTimelineEvent['type']) => {
    switch (type) {
      case 'CREATION': return 'bg-teal-50 text-[#008f77] border-teal-300';
      case 'STATUS_CHANGE': return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'PASSENGER': return 'bg-purple-50 text-purple-800 border-purple-300';
      case 'DOCUMENT': return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'PAYMENT': return 'bg-teal-50 text-teal-800 border-teal-300';
      case 'SUPPLIER': return 'bg-indigo-50 text-indigo-800 border-indigo-300';
      case 'COMMUNICATION': return 'bg-cyan-50 text-cyan-800 border-cyan-300';
      case 'SLA_REMINDER': return 'bg-rose-50 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div id="booking-timeline-audit-section" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs mb-6">
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
        <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
          <Clock className="w-5 h-5 text-[#008f77]" />
        </div>
        <h3 className="text-lg font-black text-slate-900">
          Booking Lifecycle Timeline & Audit Trail
        </h3>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
          {events.length} Events Logged
        </span>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-6">No timeline events recorded yet.</p>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {events.map((evt, idx) => {
            const Icon = getEventIcon(evt.type);
            const colorClass = getEventColor(evt.type);

            return (
              <div key={evt.id || idx} className="relative flex items-start gap-4">
                {/* Timeline node icon */}
                <div className={`absolute -left-6 mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center ${colorClass}`}>
                  <Icon className="w-3 h-3" />
                </div>

                <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-xs font-black text-slate-900">
                      {evt.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {evt.description}
                  </p>
                  {evt.actorName && (
                    <span className="text-[10px] text-slate-400 font-mono block mt-1.5">
                      Logged by {evt.actorName}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
