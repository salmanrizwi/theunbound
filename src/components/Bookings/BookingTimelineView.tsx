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
      case 'CREATION': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300';
      case 'STATUS_CHANGE': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300';
      case 'PASSENGER': return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300';
      case 'DOCUMENT': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300';
      case 'PAYMENT': return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300';
      case 'SUPPLIER': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300';
      case 'COMMUNICATION': return 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300';
      case 'SLA_REMINDER': return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300';
      default: return 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300 border-stone-300';
    }
  };

  return (
    <div id="booking-timeline-audit-section" className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-stone-200 dark:border-stone-800 shadow-sm mb-6">
      <div className="flex items-center gap-2 pb-4 border-b border-stone-100 dark:border-stone-800 mb-6">
        <Clock className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
          Booking Lifecycle Timeline & Audit Trail
        </h3>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
          {events.length} Events Logged
        </span>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-stone-400 italic text-center py-6">No timeline events recorded yet.</p>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200 dark:before:bg-stone-800">
          {events.map((evt, idx) => {
            const Icon = getEventIcon(evt.type);
            const colorClass = getEventColor(evt.type);

            return (
              <div key={evt.id || idx} className="relative flex items-start gap-4">
                {/* Timeline node icon */}
                <div className={`absolute -left-6 mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center ${colorClass}`}>
                  <Icon className="w-3 h-3" />
                </div>

                <div className="flex-1 bg-stone-50/70 dark:bg-stone-800/40 p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-700/60">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {evt.title}
                    </h4>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300">
                    {evt.description}
                  </p>
                  {evt.actorName && (
                    <span className="text-[10px] text-stone-400 font-mono block mt-1">
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
