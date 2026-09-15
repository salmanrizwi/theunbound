import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../services/db';
import { 
  ChevronRight,
  AlertTriangle,
  Bell,
  Clock,
  CheckCircle2,
  ExternalLink,
  Flame
} from 'lucide-react';

interface GlobalRemindersBarProps {
  onNavigate?: (
    section: string, 
    subTab?: string, 
    recordId?: string, 
    targetRoute?: string,
    options?: { filterIds?: string[]; filterStatus?: string; targetElementId?: string }
  ) => void;
  onOpenActionCenter?: () => void;
  className?: string;
  variant?: 'admin' | 'b2b' | 'universal';
}

export const GlobalRemindersBar: React.FC<GlobalRemindersBarProps> = ({
  onNavigate,
  onOpenActionCenter,
  className = '',
  variant = 'universal'
}) => {
  const db = AppDatabase.getInstance();
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    return db.subscribe(() => {
      setDataVersion(v => v + 1);
    });
  }, [db]);

  // Real Database Counts
  const todayStr = new Date().toISOString().split('T')[0];
  const allTasks = db.getCalendarTasks() || [];
  const overdueTasks = allTasks.filter(t => {
    if (t.status !== 'PENDING') return false;
    const taskDate = t.dueAt ? t.dueAt.split('T')[0] : t.startDate;
    return taskDate && taskDate < todayStr;
  });
  const urgentTasks = allTasks.filter(t => t.status === 'PENDING' && t.slaStatus === 'SLA_BREACHED');
  const actionableTasks = overdueTasks.length > 0 ? overdueTasks : urgentTasks;
  const totalActionTasks = actionableTasks.length;

  const allBookings = db.getAllBookings() || [];
  const pendingBookings = allBookings.filter(b => b.status === 'PENDING_CONFIRMATION' || (b.status as string) === 'SUBMITTED');
  const pendingDocBookings = allBookings.filter(b => b.documentStatus === 'DOCUMENTS_PENDING' || b.paymentStatus === 'PARTIALLY_PAID' || b.paymentStatus === 'PENDING_PAYMENT');

  const allQuotes = db.getAllSavedQuotes() || [];
  const followUpQuotes = allQuotes.filter(q => {
    if ((q as any).followUpCompletedAt) return false;
    const terminalStatuses = ['CONFIRMED', 'ACCEPTED', 'CONVERTED', 'REJECTED', 'EXPIRED', 'ARCHIVED', 'CANCELLED'];
    if (terminalStatuses.includes(q.status)) return false;
    return (
      q.status === 'SENT' || 
      q.status === 'SENT_TO_CLIENT' || 
      q.status === 'VIEWED' || 
      q.status === 'VIEWED_BY_CLIENT' || 
      (q as any).followUpRequired === true
    );
  });

  const allUsers = db.getUsers() || [];
  const pendingUsers = allUsers.filter(u => u.approvalStatus === 'PENDING');

  // Total critical & warning count
  const criticalCount = totalActionTasks + pendingBookings.length;
  const warningCount = followUpQuotes.length + pendingDocBookings.length + pendingUsers.length;

  if (criticalCount === 0 && warningCount === 0 && totalActionTasks === 0) {
    return null;
  }

  // Handlers for traceable single/multiple navigation
  const handleQuotesClick = () => {
    if (followUpQuotes.length === 1) {
      const q = followUpQuotes[0];
      onNavigate?.('LEAD_MANAGEMENT', 'QUOTES', q.id, `/admin/quotes/${q.id}`);
    } else if (followUpQuotes.length > 1) {
      onNavigate?.('LEAD_MANAGEMENT', 'QUOTES', undefined, '/admin/quotes', {
        filterIds: followUpQuotes.map(q => q.id),
        filterStatus: 'AWAITING_FOLLOW_UP'
      });
    }
  };

  const handleBookingsClick = () => {
    if (pendingBookings.length === 1) {
      const b = pendingBookings[0];
      onNavigate?.('BOOKING_MANAGEMENT', 'BOOKINGS', b.id, `/admin/bookings/${b.id}`);
    } else if (pendingBookings.length > 1) {
      onNavigate?.('BOOKING_MANAGEMENT', 'BOOKINGS', undefined, '/admin/bookings', {
        filterIds: pendingBookings.map(b => b.id),
        filterStatus: 'PENDING_CONFIRMATION'
      });
    }
  };

  const handleDocBookingsClick = () => {
    if (pendingDocBookings.length === 1) {
      const b = pendingDocBookings[0];
      onNavigate?.('BOOKING_MANAGEMENT', 'BOOKINGS', b.id, `/admin/payments/${b.id}`, {
        targetElementId: 'booking-payment-proofs-section'
      });
    } else if (pendingDocBookings.length > 1) {
      onNavigate?.('BOOKING_MANAGEMENT', 'BOOKINGS', undefined, '/admin/payments', {
        filterIds: pendingDocBookings.map(b => b.id)
      });
    }
  };

  const handleTasksClick = () => {
    if (actionableTasks.length === 1) {
      const t = actionableTasks[0];
      const targetId = t.bookingId || t.quoteId || t.leadId || t.entityId || t.id;
      if (t.entityType === 'QUOTE' || t.quoteId) {
        onNavigate?.('LEAD_MANAGEMENT', 'QUOTES', targetId, `/admin/quotes/${targetId}`);
      } else if (t.entityType === 'BOOKING' || t.bookingId) {
        onNavigate?.('BOOKING_MANAGEMENT', 'BOOKINGS', targetId, `/admin/bookings/${targetId}`);
      } else if (t.entityType === 'LEAD' || t.leadId) {
        onNavigate?.('LEAD_MANAGEMENT', 'LEADS', targetId, `/admin/leads/${targetId}`);
      } else {
        onNavigate?.('OPERATIONS', 'CALENDAR_TASKS', t.id, `/admin/tasks/${t.id}`);
      }
    } else {
      if (onOpenActionCenter) {
        onOpenActionCenter();
      } else {
        onNavigate?.('OPERATIONS', 'CALENDAR_TASKS');
      }
    }
  };

  const handleUsersClick = () => {
    if (pendingUsers.length === 1) {
      onNavigate?.('ACCOUNT_MANAGEMENT', 'USERS_ACCESS', pendingUsers[0].id, `/admin/users/${pendingUsers[0].id}`);
    } else {
      onNavigate?.('ACCOUNT_MANAGEMENT', 'USERS_ACCESS');
    }
  };

  return (
    <div 
      id="global-reminders-bar"
      className={`bg-white border-b border-slate-200 text-slate-800 px-3 sm:px-6 py-2 transition-all shadow-2xs ${className}`}
    >
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Left Action Center Label Badge */}
        <button
          type="button"
          onClick={() => onOpenActionCenter ? onOpenActionCenter() : onNavigate?.('OPERATIONS', 'CALENDAR_TASKS')}
          className="flex items-center space-x-2 shrink-0 hover:opacity-85 transition-opacity cursor-pointer group"
          title="Open Action Center Drawer"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-[#00C6A6]/15 text-[#008f77] border border-[#00C6A6]/30">
            <Bell className="w-3 h-3 text-[#00C6A6]" />
          </div>
          <span className="font-extrabold text-slate-800 group-hover:text-[#008f77] uppercase tracking-wider text-[11px] transition-colors">
            Action Center
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
        </button>

        {/* Live Reminder Chips */}
        <div className="flex items-center flex-wrap gap-2 grow">
          {/* Overdue / Critical Tasks (Light Rose Pill) */}
          {totalActionTasks > 0 && (
            <button
              onClick={handleTasksClick}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-[11px] font-bold transition-colors cursor-pointer group shadow-2xs"
              title="Overdue and critical priority SLA tasks"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span>
                {overdueTasks.length > 0
                  ? (overdueTasks.length === 1 ? '1 Overdue Task' : `${overdueTasks.length} Overdue Tasks`)
                  : (urgentTasks.length === 1 ? '1 Priority Task' : `${urgentTasks.length} Priority Tasks`)}
              </span>
              <ChevronRight className="w-3 h-3 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Pending Bookings (Light Rose Pill) */}
          {pendingBookings.length > 0 && (
            <button
              onClick={handleBookingsClick}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-[11px] font-bold transition-colors cursor-pointer group shadow-2xs"
              title="Pending reservation confirmations needing dispatch"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>
                {pendingBookings.length === 1 ? '1 Pending Booking' : `${pendingBookings.length} Pending Bookings`}
              </span>
              <ChevronRight className="w-3 h-3 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Quotes Awaiting Follow-Up (Light Amber Pill) */}
          {followUpQuotes.length > 0 && (
            <button
              onClick={handleQuotesClick}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[11px] font-bold transition-colors cursor-pointer group shadow-2xs"
              title="Dispatched quotes awaiting client follow-up"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>
                {followUpQuotes.length === 1 ? '1 Quote Awaiting Follow-Up' : `${followUpQuotes.length} Quotes Awaiting Follow-Up`}
              </span>
              <ChevronRight className="w-3 h-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Pending Documents / Proofs (Light Amber Pill) */}
          {pendingDocBookings.length > 0 && (
            <button
              onClick={handleDocBookingsClick}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[11px] font-bold transition-colors cursor-pointer group shadow-2xs"
              title="Payment proofs and travel documents awaiting verification"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>
                {pendingDocBookings.length === 1 ? '1 Document / Proof Pending' : `${pendingDocBookings.length} Documents / Proofs Pending`}
              </span>
              <ChevronRight className="w-3 h-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Pending User Approvals (Light Amber Pill) */}
          {pendingUsers.length > 0 && variant !== 'b2b' && (
            <button
              onClick={handleUsersClick}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[11px] font-bold transition-colors cursor-pointer group shadow-2xs"
              title="New travel agent registrations awaiting approval"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>
                {pendingUsers.length === 1 ? '1 Agent Registration Pending' : `${pendingUsers.length} Agent Registrations Pending`}
              </span>
              <ChevronRight className="w-3 h-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* Action Center Trigger Button */}
        <div className="shrink-0 flex items-center space-x-2">
          <button
            onClick={() => onOpenActionCenter ? onOpenActionCenter() : onNavigate?.('OPERATIONS', 'CALENDAR_TASKS')}
            className="px-3.5 py-1.5 bg-[#00C6A6] hover:bg-[#00a88d] text-white rounded-xl text-xs font-extrabold transition-colors shadow-2xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Open Tasks</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
