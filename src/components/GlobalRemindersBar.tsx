import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../services/db';
import { 
  ChevronRight,
  AlertTriangle
} from 'lucide-react';

interface GlobalRemindersBarProps {
  onNavigate?: (section: string, subTab?: string) => void;
  className?: string;
  variant?: 'admin' | 'b2b' | 'universal';
}

export const GlobalRemindersBar: React.FC<GlobalRemindersBarProps> = ({
  onNavigate,
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
  const totalActionTasks = overdueTasks.length > 0 ? overdueTasks.length : urgentTasks.length;

  const allBookings = db.getAllBookings() || [];
  const pendingBookings = allBookings.filter(b => b.status === 'PENDING_CONFIRMATION');
  const pendingDocBookings = allBookings.filter(b => b.documentStatus === 'DOCUMENTS_PENDING' || b.paymentStatus === 'PARTIALLY_PAID' || b.paymentStatus === 'PENDING_PAYMENT');

  const allQuotes = db.getAllSavedQuotes() || [];
  const followUpQuotes = allQuotes.filter(q => q.status === 'SENT' || q.status === 'SENT_TO_CLIENT' || q.status === 'VIEWED' || q.status === 'VIEWED_BY_CLIENT');

  const allUsers = db.getUsers() || [];
  const pendingUsers = allUsers.filter(u => u.approvalStatus === 'PENDING');

  // Total critical & warning count
  const criticalCount = (overdueTasks.length > 0 ? overdueTasks.length : 0) + pendingBookings.length;
  const warningCount = followUpQuotes.length + pendingDocBookings.length + pendingUsers.length;

  if (criticalCount === 0 && warningCount === 0 && totalActionTasks === 0) {
    return null;
  }

  return (
    <div 
      id="global-reminders-bar"
      className={`bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-6 py-2 transition-all shadow-sm ${className}`}
    >
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Left Label */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
          </div>
          <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
            Action Center
          </span>
          <span className="text-slate-500 hidden sm:inline">•</span>
        </div>

        {/* Live Reminder Chips */}
        <div className="flex items-center flex-wrap gap-2 grow">
          {/* Overdue / Critical Tasks (RED) */}
          {totalActionTasks > 0 && (
            <button
              onClick={() => onNavigate?.('NOTIFICATIONS_MANAGEMENT', 'TASKS') || onNavigate?.('tasks')}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-colors cursor-pointer group shadow-xs"
              title="Overdue and critical priority SLA tasks"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span>{overdueTasks.length > 0 ? `${overdueTasks.length} Overdue Tasks` : `${urgentTasks.length} Priority Tasks`}</span>
              <ChevronRight className="w-3 h-3 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Pending Bookings (RED) */}
          {pendingBookings.length > 0 && (
            <button
              onClick={() => onNavigate?.('BOOKING_MANAGEMENT', 'BOOKINGS') || onNavigate?.('bookings')}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-colors cursor-pointer group shadow-xs"
              title="Pending reservation confirmations needing 24-48h dispatch"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{pendingBookings.length} Pending Bookings</span>
              <ChevronRight className="w-3 h-3 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Quotes Awaiting Follow-Up (AMBER) */}
          {followUpQuotes.length > 0 && (
            <button
              onClick={() => onNavigate?.('LEAD_MANAGEMENT', 'QUOTES') || onNavigate?.('my-quotes')}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-colors cursor-pointer group"
              title="Dispatched quotes awaiting client follow-up"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>{followUpQuotes.length} Quotes Awaiting Follow-Up</span>
              <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Pending Documents / Proofs (AMBER) */}
          {pendingDocBookings.length > 0 && (
            <button
              onClick={() => onNavigate?.('BOOKING_MANAGEMENT', 'BOOKINGS') || onNavigate?.('bookings')}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-colors cursor-pointer group"
              title="Payment proofs and travel documents awaiting verification"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>{pendingDocBookings.length} Documents / Proofs Pending</span>
              <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Pending User Approvals (AMBER) */}
          {pendingUsers.length > 0 && variant !== 'b2b' && (
            <button
              onClick={() => onNavigate?.('ACCOUNT_MANAGEMENT', 'USERS_ACCESS')}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-colors cursor-pointer group"
              title="New travel agent registrations awaiting approval"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>{pendingUsers.length} Agent Registrations Pending</span>
              <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* SLA Status indicator */}
        <div className="hidden lg:flex items-center space-x-2 text-[11px] text-slate-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C0]"></span>
          <span>DMC Live Engine Active</span>
        </div>
      </div>
    </div>
  );
};
