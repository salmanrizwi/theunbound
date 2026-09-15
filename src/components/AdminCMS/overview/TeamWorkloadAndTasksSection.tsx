import React, { useState } from 'react';
import { 
  Users, 
  CalendarCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  ArrowRight,
  UserCheck,
  Briefcase,
  Layers,
  FileText
} from 'lucide-react';
import { User, TravelLead, Quotation, Booking, CalendarTask } from '../../../types';

interface TeamWorkloadAndTasksSectionProps {
  users: User[];
  leads: TravelLead[];
  quotes: Quotation[];
  bookings: Booking[];
  tasks: CalendarTask[];
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
}

export const TeamWorkloadAndTasksSection: React.FC<TeamWorkloadAndTasksSectionProps> = ({
  users,
  leads,
  quotes,
  bookings,
  tasks,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'WORKLOAD' | 'TASKS'>('WORKLOAD');

  // Filter operational team members (Admin, Operations, Agents)
  const opsSpecialists = users.filter(u => 
    u.role === 'ADMIN' || u.role === 'OPERATIONS' || u.role === 'SPECIALIST' || u.role === 'SUPER_ADMIN'
  );

  // Unassigned metrics
  const unassignedLeads = leads.filter(l => !l.assignedTo && l.status !== 'CONVERTED' && l.status !== 'LOST');
  const unassignedQuotes = quotes.filter(q => !q.assignedTo && q.status !== 'CONVERTED_TO_BOOKING' && q.status !== 'EXPIRED');
  const unassignedBookings = bookings.filter(b => !b.assignedTo && b.status !== 'CANCELLED');

  // Compute workload per specialist
  const specialistsWorkload = opsSpecialists.map(specialist => {
    const assignedLeadsCount = leads.filter(l => l.assignedTo === specialist.id && l.status !== 'CONVERTED' && l.status !== 'LOST').length;
    const assignedQuotesCount = quotes.filter(q => q.assignedTo === specialist.id && q.status !== 'CONVERTED_TO_BOOKING' && q.status !== 'EXPIRED').length;
    const assignedBookingsCount = bookings.filter(b => b.assignedTo === specialist.id && b.status !== 'CANCELLED').length;
    const totalActiveRecords = assignedLeadsCount + assignedQuotesCount + assignedBookingsCount;

    return {
      specialist,
      assignedLeadsCount,
      assignedQuotesCount,
      assignedBookingsCount,
      totalActiveRecords
    };
  }).sort((a, b) => b.totalActiveRecords - a.totalActiveRecords);

  // Tasks breakdown
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.dueDate && t.dueDate < todayStr);
  const todayTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.dueDate === todayStr);
  const upcomingTasks = tasks.filter(t => t.status !== 'COMPLETED' && (!t.dueDate || t.dueDate > todayStr));

  return (
    <section id="cms-team-workload-section" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Team Workload & Operational Task Backlog
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Specialist caseload balancing, unassigned queue monitoring, and SLA completion tracking.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('WORKLOAD')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'WORKLOAD'
                ? 'bg-[#008972] text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Specialist Workload
          </button>
          <button
            onClick={() => setActiveTab('TASKS')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'TASKS'
                ? 'bg-[#008972] text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tasks & SLA ({tasks.filter(t => t.status !== 'COMPLETED').length})
          </button>
        </div>
      </div>

      {/* Unassigned Backlog Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
        <div 
          onClick={() => onNavigate('LEAD_MANAGEMENT', 'LEADS')}
          className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/70 hover:border-blue-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black">
              {unassignedLeads.length}
            </div>
            <span className="text-xs font-bold text-slate-700">Unassigned Leads</span>
          </div>
          <span className="text-[11px] font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center">
            Queue <ChevronRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>

        <div 
          onClick={() => onNavigate('LEAD_MANAGEMENT', 'QUOTES')}
          className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/70 hover:border-purple-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-black">
              {unassignedQuotes.length}
            </div>
            <span className="text-xs font-bold text-slate-700">Unassigned Quotes</span>
          </div>
          <span className="text-[11px] font-bold text-purple-600 group-hover:translate-x-0.5 transition-transform flex items-center">
            Queue <ChevronRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>

        <div 
          onClick={() => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS')}
          className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/70 hover:border-emerald-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black">
              {unassignedBookings.length}
            </div>
            <span className="text-xs font-bold text-slate-700">Unassigned Bookings</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform flex items-center">
            Queue <ChevronRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>
      </div>

      {activeTab === 'WORKLOAD' ? (
        /* SPECIALIST WORKLOAD LIST */
        <div className="space-y-3">
          {specialistsWorkload.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
              No active operations specialists configured in User Directory.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {specialistsWorkload.map(({ specialist, assignedLeadsCount, assignedQuotesCount, assignedBookingsCount, totalActiveRecords }) => (
                <div key={specialist.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {specialist.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 truncate">{specialist.name}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                          {specialist.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{specialist.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 shrink-0 self-end sm:self-center">
                    <div className="flex items-center space-x-3 text-[11px]">
                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold">
                        {assignedLeadsCount} Leads
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-bold">
                        {assignedQuotesCount} Quotes
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold">
                        {assignedBookingsCount} Bookings
                      </span>
                    </div>

                    <div className="w-16 text-right">
                      <span className="text-xs font-black text-slate-900">{totalActiveRecords} total</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TASKS & SLA OVERVIEW */
        <div className="space-y-4">
          {/* Overdue Tasks Alert */}
          {overdueTasks.length > 0 && (
            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-xs space-y-2">
              <div className="flex items-center space-x-2 text-rose-800 font-extrabold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{overdueTasks.length} Overdue Operational Tasks Requiring Immediate Completion</span>
              </div>
              <div className="divide-y divide-rose-200/60">
                {overdueTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="py-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-rose-900 truncate mr-2">{task.title}</span>
                    <span className="text-rose-700 font-mono shrink-0">Due: {task.dueDate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Tasks */}
          <div>
            <h4 className="text-xs font-extrabold text-slate-700 mb-2 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-[#008972]" />
              <span>Due Today ({todayTasks.length})</span>
            </h4>
            {todayTasks.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
                No tasks due for today.
              </div>
            ) : (
              <div className="space-y-1.5">
                {todayTasks.map(task => (
                  <div key={task.id} className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 truncate mr-2">
                      <span className="w-2 h-2 rounded-full bg-[#008972] shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{task.title}</span>
                      {task.priority && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold uppercase shrink-0">
                          {task.priority}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">{task.dueTime || 'Today'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
