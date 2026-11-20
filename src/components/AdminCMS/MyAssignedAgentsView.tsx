import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import {
  getTeamMemberAssignedWorkspaceSummary,
  AssignedAgentOperationalSummary
} from '../../services/accountManagerService';
import { formatCurrency } from '../../services/pricingEngine';
import {
  Users,
  Building2,
  Mail,
  Phone,
  Calendar,
  FileText,
  Briefcase,
  CheckSquare,
  Search,
  Clock,
  ShieldCheck,
  ExternalLink,
  Compass,
  Activity
} from 'lucide-react';

interface MyAssignedAgentsViewProps {
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToQuote?: (quoteId: string) => void;
  onNavigateToBooking?: (bookingId: string) => void;
}

export const MyAssignedAgentsView: React.FC<MyAssignedAgentsViewProps> = ({
  onNavigateToLead,
  onNavigateToQuote,
  onNavigateToBooking
}) => {
  const { user: currentUser } = useAuth();
  const db = AppDatabase.getInstance();
  const [refreshTick, setRefreshTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'LEADS' | 'QUOTES' | 'BOOKINGS' | 'TASKS'>('LEADS');

  useEffect(() => {
    const unsub = db.subscribeToCollections(
      ['system_users', 'leads', 'saved_quotes', 'bookings', 'calendar_tasks', 'account_manager_assignment_history'],
      () => setRefreshTick(t => t + 1)
    );
    return () => unsub();
  }, [db]);

  const workspaceSummaries = useMemo<AssignedAgentOperationalSummary[]>(() => {
    if (!currentUser?.id) return [];
    return getTeamMemberAssignedWorkspaceSummary(currentUser.id, currentUser);
  }, [currentUser, refreshTick]);

  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workspaceSummaries.filter(item => {
      const status = (item.agent.approvalStatus || 'APPROVED') as 'APPROVED' | 'PENDING' | 'REJECTED';
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;
      if (!q) return true;
      return (
        (item.agent.name || '').toLowerCase().includes(q) ||
        (item.agent.email || '').toLowerCase().includes(q) ||
        (item.agent.agencyName || '').toLowerCase().includes(q) ||
        (item.agent.companyName || '').toLowerCase().includes(q)
      );
    });
  }, [workspaceSummaries, searchQuery, statusFilter]);

  const selectedSummary = useMemo(() => {
    if (filteredSummaries.length === 0) return null;
    if (selectedAgentId) {
      return filteredSummaries.find(s => s.agent.id === selectedAgentId) || filteredSummaries[0];
    }
    return filteredSummaries[0];
  }, [filteredSummaries, selectedAgentId]);

  const totals = useMemo(() => {
    return workspaceSummaries.reduce(
      (acc, item) => {
        acc.agents += 1;
        acc.leads += item.leads.length;
        acc.quotes += item.quotations.length;
        acc.bookings += item.bookings.length;
        acc.tasks += item.pendingTasks.length;
        return acc;
      },
      { agents: 0, leads: 0, quotes: 0, bookings: 0, tasks: 0 }
    );
  }, [workspaceSummaries]);

  return (
    <div id="my-assigned-agents-workspace" className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#008972] text-xs font-bold uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Personal Portfolio • User-Level Account Management</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">
            My Assigned B2B Agents
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Isolated portfolio displaying strictly the individual B2B Agent accounts assigned to{' '}
            <strong className="text-slate-800">{currentUser?.name}</strong>. Track partner leads, quotations, bookings, and pending follow-up tasks without impacting historical record ownership.
          </p>
        </div>

        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs shrink-0 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
          <div>
            <div className="font-bold text-slate-900">Account Manager Scope</div>
            <div className="text-[11px] text-slate-500 font-mono">UID: {currentUser?.id}</div>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Agents</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{totals.agents}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Individual partner accounts</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Associated Leads</div>
          <div className="text-2xl font-black text-indigo-600 font-mono mt-1">{totals.leads}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">From assigned agents</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quotations</div>
          <div className="text-2xl font-black text-[#008972] font-mono mt-1">{totals.quotes}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Proposals generated</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bookings</div>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-1">{totals.bookings}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Confirmed & active</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Tasks</div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">{totals.tasks}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Open follow-ups</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your assigned B2B agents by name, email, or agency..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
        >
          <option value="ALL">All Statuses ({workspaceSummaries.length})</option>
          <option value="APPROVED">Active / Approved</option>
          <option value="PENDING">Pending Approval</option>
          <option value="REJECTED">Suspended / Rejected</option>
        </select>
      </div>

      {filteredSummaries.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {workspaceSummaries.length === 0
              ? 'No B2B Agents Assigned to Your Account Yet'
              : 'No Assigned B2B Agents Match Your Filter'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            An Administrator assigns individual B2B Agents from Account Management → User Management. Once assigned, each partner agent and their associated activity appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Assigned Agent Cards */}
          <div className="lg:col-span-5 space-y-3">
            {filteredSummaries.map((item) => {
              const isSelected = selectedSummary?.agent.id === item.agent.id;
              const status = item.agent.approvalStatus || 'APPROVED';
              return (
                <button
                  key={item.agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(item.agent.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? 'bg-white border-[#00C6A6] ring-2 ring-[#00C6A6]/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#00E5C0] flex items-center justify-center font-black text-sm shrink-0">
                        {item.agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">
                          {item.agent.name}
                        </div>
                        <div className="text-xs font-semibold text-[#008972] flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {item.agent.agencyName || item.agent.companyName || 'Independent Partner'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${
                        status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-mono truncate">{item.agent.email}</span>
                    </div>
                    {(item.agent.phone || item.agent.contactNumber) && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{item.agent.phone || item.agent.contactNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>
                        Assigned:{' '}
                        {item.assignedAt
                          ? new Date(item.assignedAt).toLocaleDateString()
                          : 'Recently'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                    <div className="flex items-center gap-2 font-mono font-bold text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {item.leads.length} Leads
                      </span>
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-[#008972]">
                        {item.quotations.length} Quotes
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                        {item.bookings.length} Bookings
                      </span>
                    </div>
                    {item.pendingTasks.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                        {item.pendingTasks.length} Tasks
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                    <Activity className="w-3 h-3 text-[#00C6A6] shrink-0" />
                    <span className="truncate">{item.recentActivitySummary}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Selected Agent Operational Activity Workspace */}
          {selectedSummary && (
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0]">
                    Partner Operational Dossier
                  </div>
                  <h3 className="text-lg font-black mt-0.5">{selectedSummary.agent.name}</h3>
                  <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap mt-0.5">
                    <span>
                      {selectedSummary.agent.agencyName ||
                        selectedSummary.agent.companyName ||
                        'B2B Partner Agency'}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-slate-400">{selectedSummary.agent.email}</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-300">
                  <div>
                    Assigned:{' '}
                    <strong className="text-white">
                      {selectedSummary.assignedAt
                        ? new Date(selectedSummary.assignedAt).toLocaleDateString()
                        : 'Active'}
                    </strong>
                  </div>
                  {selectedSummary.assignedByName && (
                    <div className="text-slate-400 text-[10px]">
                      By {selectedSummary.assignedByName}
                    </div>
                  )}
                </div>
              </div>

              {/* Detail Tabs */}
              <div className="px-4 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: 'LEADS' as const, label: `Leads (${selectedSummary.leads.length})`, icon: Compass },
                  { id: 'QUOTES' as const, label: `Quotations (${selectedSummary.quotations.length})`, icon: FileText },
                  { id: 'BOOKINGS' as const, label: `Bookings (${selectedSummary.bookings.length})`, icon: Briefcase },
                  { id: 'TASKS' as const, label: `Pending Tasks (${selectedSummary.pendingTasks.length})`, icon: CheckSquare }
                ].map(tab => {
                  const TabIcon = tab.icon;
                  const active = activeDetailTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveDetailTab(tab.id)}
                      className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        active
                          ? 'border-[#00C6A6] text-[#008972]'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Detail Body */}
              <div className="p-5 space-y-3 max-h-[540px] overflow-y-auto">
                {activeDetailTab === 'LEADS' && (
                  selectedSummary.leads.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No leads associated with {selectedSummary.agent.name} yet.
                    </div>
                  ) : (
                    selectedSummary.leads.map(lead => (
                      <div
                        key={lead.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {lead.leadNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                              {lead.status}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {lead.contactName} • {lead.destinationName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {lead.travelDates || 'Flexible dates'} • Est.{' '}
                            {formatCurrency(
                              Number(lead.estimatedBudget || lead.bookingValue || 0),
                              lead.currency || 'USD'
                            )}
                          </div>
                        </div>
                        {onNavigateToLead && (
                          <button
                            type="button"
                            onClick={() => onNavigateToLead(lead.id)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#00C6A6] text-xs font-bold text-slate-800 flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )
                )}

                {activeDetailTab === 'QUOTES' && (
                  selectedSummary.quotations.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No quotations generated by {selectedSummary.agent.name} yet.
                    </div>
                  ) : (
                    selectedSummary.quotations.map(q => (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {q.quoteNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-teal-50 text-[#008972] text-[10px] font-bold">
                              {q.status}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {q.title || q.destination || 'Quotation'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Client: {q.clientName || 'Partner Client'} •{' '}
                            {formatCurrency(q.totalSellingPrice || 0, q.currency || 'USD')}
                          </div>
                        </div>
                        {onNavigateToQuote && (
                          <button
                            type="button"
                            onClick={() => onNavigateToQuote(q.id)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#00C6A6] text-xs font-bold text-slate-800 flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )
                )}

                {activeDetailTab === 'BOOKINGS' && (
                  selectedSummary.bookings.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No bookings attributed to {selectedSummary.agent.name} yet.
                    </div>
                  ) : (
                    selectedSummary.bookings.map(b => (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {b.bookingReference}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                              {b.status}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {b.customer?.leadTravelerName || 'Guest Booking'} •{' '}
                            {b.destinationName || b.destination || 'Japan'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {b.travelStartDate || 'TBA'} → {b.travelEndDate || 'TBA'} •{' '}
                            {formatCurrency(b.totalAmount || 0, b.currency || 'USD')}
                          </div>
                        </div>
                        {onNavigateToBooking && (
                          <button
                            type="button"
                            onClick={() => onNavigateToBooking(b.id)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#00C6A6] text-xs font-bold text-slate-800 flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )
                )}

                {activeDetailTab === 'TASKS' && (
                  selectedSummary.pendingTasks.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No pending follow-up tasks for {selectedSummary.agent.name}.
                    </div>
                  ) : (
                    selectedSummary.pendingTasks.map(task => (
                      <div
                        key={task.id}
                        className="p-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {task.title || task.taskName || 'Follow-Up Task'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Due: {task.dueDate || task.startDate || 'Upcoming'} • Status:{' '}
                            <span className="font-semibold">{task.status}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
