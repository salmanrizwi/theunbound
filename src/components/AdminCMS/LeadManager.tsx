import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { TravelLead, LeadStatus, LeadPriority, LeadSource, LeadStageConfig } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ExternalLink,
  Filter,
  TrendingUp,
  AlertTriangle,
  FileText,
  Package,
  Layers,
  ChevronRight,
  Eye,
  RefreshCw,
  Building,
  UserCheck,
  Kanban,
  LayoutGrid,
  LayoutList,
  CheckSquare,
  Square,
  X,
  Sparkles
} from 'lucide-react';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { LeadEditModal } from './LeadEditModal';
import { LeadKanbanBoard } from './LeadKanbanBoard';
import { RecordReminderIndicator } from '../ActionCenter/RecordReminderIndicator';
import { CalendarTask } from '../../types';

export const STAFF_SPECIALISTS = [
  { id: 'staff-01', name: 'Marcus Vance', email: 'marcus.v@theunbound.in', department: 'SALES' as const },
  { id: 'staff-02', name: 'Elena Rostova', email: 'elena.r@theunbound.in', department: 'SALES' as const },
  { id: 'staff-03', name: 'Liam Chen', email: 'liam.c@theunbound.in', department: 'OPERATIONS' as const },
  { id: 'staff-04', name: 'Sophia Sterling', email: 'sophia.s@theunbound.in', department: 'MANAGEMENT' as const },
  { id: 'staff-05', name: 'Aria Tanaka', email: 'aria.t@theunbound.in', department: 'SALES' as const }
];

export interface LeadManagerProps {
  initialLeadId?: string | null;
  onOpenActionCenter?: (task: CalendarTask) => void;
  onOpenBooking?: (bookingId: string) => void;
  onOpenQuote?: (quoteId: string, options?: { version?: number; mode?: 'inspect' | 'edit' | 'readonly'; leadId?: string }) => void;
}

export const LeadManager: React.FC<LeadManagerProps> = ({
  initialLeadId,
  onOpenActionCenter,
  onOpenBooking,
  onOpenQuote
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [leads, setLeads] = useState<TravelLead[]>(db.getLeadsAuthorized(user));
  const stages: LeadStageConfig[] = db.getLeadStages();
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'assigned' | 'needs_assignment' | 'pending_internal' | 'pending_agent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'kanban'>(() => {
    try {
      const saved = localStorage.getItem('unbound_lead_manager_view');
      if (saved === 'kanban' || saved === 'table' || saved === 'cards') {
        return saved;
      }
    } catch {}
    return 'kanban';
  });

  const handleSelectViewMode = (mode: 'table' | 'cards' | 'kanban') => {
    setViewMode(mode);
    try {
      localStorage.setItem('unbound_lead_manager_view', mode);
    } catch {}
  };

  // Bulk action selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkStaffId, setBulkStaffId] = useState<string>('');
  const [bulkStageId, setBulkStageId] = useState<string>('');

  // Drawer / Modal states
  const [selectedLead, setSelectedLead] = useState<TravelLead | null>(null);
  const [editingLead, setEditingLead] = useState<Partial<TravelLead> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    return db.subscribe(() => {
      setLeads(db.getLeadsAuthorized(user));
    });
  }, [user]);

  useEffect(() => {
    if (initialLeadId && leads.length > 0) {
      const clean = initialLeadId.replace(/^#/, '').trim().toLowerCase();
      const target = leads.find(l => 
        l.id === initialLeadId || 
        l.leadNumber === initialLeadId ||
        (l.id || '').toLowerCase() === clean ||
        l.leadNumber?.toLowerCase() === clean ||
        l.leadNumber?.replace(/^#/, '').trim().toLowerCase() === clean
      );
      if (target) {
        setSelectedLead(target);
      }
    }
  }, [initialLeadId, leads]);

  // Lead metrics calculations
  const totalLeads = leads.length;
  const proposalSavedLeads = leads.filter(l => l.status === 'PROPOSAL_SAVED' || l.source === 'QUOTATION_SAVED').length;
  const quoteDownloadedLeads = leads.filter(l => l.status === 'QUOTE_DOWNLOADED' || l.source === 'PROPOSAL_DOWNLOADED').length;
  const bookingSubmittedLeads = leads.filter(l => l.status === 'BOOKING_SUBMITTED' || l.source === 'BOOKING_SUBMISSION').length;
  const wonLeads = leads.filter(l => l.status === 'WON' || l.conversionStatus === 'CONVERTED').length;
  const urgentLeads = leads.filter(l => l.priority === 'URGENT').length;

  // Dual-Ownership Metrics
  const fullyAssignedLeads = leads.filter(l => 
    Boolean(l.responsibleAgentId || l.assignedAgentId) && 
    Boolean(l.assignedTeamMemberId || l.assignedStaffId)
  ).length;
  const needsAssignmentLeads = leads.filter(l => 
    !Boolean(l.responsibleAgentId || l.assignedAgentId) || 
    !Boolean(l.assignedTeamMemberId || l.assignedStaffId)
  ).length;
  const pendingInternalLeads = leads.filter(l => 
    !Boolean(l.assignedTeamMemberId || l.assignedStaffId)
  ).length;
  const pendingAgentLeads = leads.filter(l => 
    !Boolean(l.responsibleAgentId || l.assignedAgentId)
  ).length;

  const totalPipelineValue = leads.reduce((acc, l) => acc + Number(l.estimatedBudget || l.bookingValue || 0), 0);

  // Filtering
  const filteredLeads = leads.filter(l => {
    const matchesStage = stageFilter === 'all' || l.stageId === stageFilter;
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || l.priority === priorityFilter;
    const matchesSource = sourceFilter === 'all' || l.source === sourceFilter;
    
    // Dual Ownership Filter
    const hasAgent = Boolean(l.responsibleAgentId || l.assignedAgentId);
    const hasTeamMember = Boolean(l.assignedTeamMemberId || l.assignedStaffId);
    let matchesOwnership = true;
    if (ownershipFilter === 'assigned') {
      matchesOwnership = hasAgent && hasTeamMember;
    } else if (ownershipFilter === 'needs_assignment') {
      matchesOwnership = !hasAgent || !hasTeamMember;
    } else if (ownershipFilter === 'pending_internal') {
      matchesOwnership = !hasTeamMember;
    } else if (ownershipFilter === 'pending_agent') {
      matchesOwnership = !hasAgent;
    }

    const query = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !query || 
      (l.contactName || '').toLowerCase().includes(query) ||
      (l.email || '').toLowerCase().includes(query) ||
      (l.leadNumber || '').toLowerCase().includes(query) ||
      (l.agencyName && l.agencyName.toLowerCase().includes(query)) ||
      (l.destinationName && l.destinationName.toLowerCase().includes(query)) ||
      (l.responsibleAgentNameSnapshot && l.responsibleAgentNameSnapshot.toLowerCase().includes(query)) ||
      (l.assignedTeamMemberNameSnapshot && l.assignedTeamMemberNameSnapshot.toLowerCase().includes(query)) ||
      (l.quoteNumber && l.quoteNumber.toLowerCase().includes(query)) ||
      (l.bookingReference && l.bookingReference.toLowerCase().includes(query));

    return matchesStage && matchesStatus && matchesPriority && matchesSource && matchesOwnership && matchesSearch;
  });

  const handleStageChange = (leadId: string, stageId: string) => {
    const res = db.updateLeadStage(leadId, stageId, user);
    if (res?.lead) {
      setLeads(db.getLeadsAuthorized(user));
      if (selectedLead?.id === leadId) setSelectedLead(res.lead);
    }
  };

  const handleToggleSelect = (leadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const handleBulkAssign = (staffId: string) => {
    const targetStaff = STAFF_SPECIALISTS.find(s => s.id === staffId);
    if (!targetStaff || selectedLeadIds.length === 0) return;
    db.bulkAssignLeads(selectedLeadIds, targetStaff, user);
    setLeads(db.getLeadsAuthorized(user));
    setSelectedLeadIds([]);
    setBulkStaffId('');
  };

  const handleBulkStage = (targetStageId: string) => {
    if (!targetStageId || selectedLeadIds.length === 0) return;
    db.bulkUpdateLeadStage(selectedLeadIds, targetStageId, user);
    setLeads(db.getLeadsAuthorized(user));
    setSelectedLeadIds([]);
    setBulkStageId('');
  };

  const handleOpenAdd = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setEditingLead({
      id: `lead-${Date.now()}`,
      leadNumber: `LED-2026-${randomNum}`,
      contactName: '',
      email: '',
      phone: '',
      agencyName: '',
      source: 'WEBSITE',
      status: 'NEW',
      priority: 'NORMAL',
      assignedStaffId: user?.id || 'staff-01',
      assignedStaffName: user?.name || 'Marcus Vance (Senior Ops)',
      assignedTeamMemberId: user?.id || 'staff-01',
      assignedTeamMemberNameSnapshot: user?.name || 'Marcus Vance (Senior Ops)',
      assignedTeamMemberEmailSnapshot: user?.email || 'business@theunbound.in',
      assignedTeamMemberDepartment: 'SALES',
      destinationId: 'japan',
      destinationName: 'Japan',
      travelDates: 'Autumn 2026',
      paxAdults: 2,
      paxChildren: 0,
      estimatedBudget: 8500,
      currency: 'USD',
      travelRequirements: '',
      notes: [],
      timeline: [],
      followUps: [],
      requestedProducts: []
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (lead: TravelLead, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingLead(lead);
    setIsEditModalOpen(true);
  };

  const handleOpenDetail = (lead: TravelLead) => {
    setSelectedLead(lead);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this lead record? This action is tracked in audit logs.')) {
      db.deleteLead(id, user);
      if (selectedLead?.id === id) setSelectedLead(null);
    }
  };

  const handleStatusChange = (leadId: string, newStatus: LeadStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const updated = db.updateLeadStatus(leadId, newStatus, user);
    if (updated && selectedLead?.id === leadId) setSelectedLead(updated);
  };

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'NEW': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'PROPOSAL_SAVED': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'QUOTE_DOWNLOADED': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'BOOKING_SUBMITTED': return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
      case 'CONTACTED': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'QUALIFIED': return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      case 'QUOTED': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'WON': return 'bg-teal-50 text-teal-800 border-teal-200 font-bold';
      case 'LOST': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority?: LeadPriority) => {
    switch (priority) {
      case 'URGENT':
        return <span className="bg-red-100 text-red-800 border border-red-200 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Urgent</span>;
      case 'HIGH':
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" /> High</span>;
      case 'LOW':
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px]">Low</span>;
      default:
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px]">Normal</span>;
    }
  };

  const hasActiveFilters = stageFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || sourceFilter !== 'all' || ownershipFilter !== 'all' || !!searchQuery.trim();

  const handleResetFilters = () => {
    setStageFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSourceFilter('all');
    setOwnershipFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6 w-full max-w-[1920px] mx-auto min-w-0 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-teal-50/50 via-teal-50/20 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5">
              <span className="px-3 py-1 rounded-full bg-teal-50 border border-[#00C6A6]/30 text-[#008f77] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>CRM & Lead Engine</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">Enterprise Pipeline Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Lead & Customer Journey Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Unified commercial hub for traveler inquiries, proposal saves, PDF quote downloads, direct bookings, SLA calendar tracking, and multi-version quotation histories.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              id="create-new-lead-btn"
              onClick={handleOpenAdd}
              className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-black px-6 py-3 rounded-2xl transition-all cursor-pointer shadow-md shadow-[#00C6A6]/20 text-xs sm:text-sm hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
              <span>Capture New Lead</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Ribbon Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2 transition-all hover:border-slate-300">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Leads</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-950">{totalLeads}</div>
            <p className="text-[11px] font-mono font-semibold text-[#008f77] mt-0.5">
              ${(totalPipelineValue / 1000).toFixed(0)}k Pipeline
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-purple-200/90 shadow-xs flex flex-col justify-between space-y-2 transition-all hover:border-purple-300">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Proposals Saved</span>
            <FileText className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-purple-950">{proposalSavedLeads}</div>
            <span className="inline-block mt-1 text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md font-bold">
              Inquiry Phase
            </span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/90 shadow-xs flex flex-col justify-between space-y-2 transition-all hover:border-amber-300">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">PDF Downloaded</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-950">{quoteDownloadedLeads}</div>
            <span className="inline-block mt-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
              24h Follow-up SLA
            </span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/90 shadow-xs flex flex-col justify-between space-y-2 transition-all hover:border-emerald-300">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Bookings Sub.</span>
            <Package className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-950">{bookingSubmittedLeads}</div>
            <span className="inline-block mt-1 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
              12h SLA Priority
            </span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-teal-200/90 shadow-xs flex flex-col justify-between space-y-2 transition-all hover:border-[#00C6A6]/60">
          <div className="flex items-center justify-between text-teal-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#008f77]">Won / Converted</span>
            <CheckCircle2 className="w-4 h-4 text-[#00C6A6]" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-950">{wonLeads}</div>
            <span className="inline-block mt-1 text-[10px] bg-teal-50 text-[#008f77] border border-[#00C6A6]/30 px-2 py-0.5 rounded-md font-bold">
              Converted
            </span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/90 shadow-xs flex flex-col justify-between space-y-2 transition-all hover:border-rose-300">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Urgent SLA</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-rose-950">{urgentLeads}</div>
            <span className="inline-block mt-1 text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
              Immediate SLA
            </span>
          </div>
        </div>
      </div>

      {/* Filter Controls & Search */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="w-full lg:flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              id="lead-search-input"
              type="text"
              placeholder="Search by client name, email, phone, agency, lead #, quote #, booking #..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#00C6A6] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode switcher */}
          <div className="flex items-center justify-between w-full lg:w-auto gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200" role="tablist" aria-label="Lead Management Views">
              <button
                id="lead-view-kanban-btn"
                onClick={() => handleSelectViewMode('kanban')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'kanban' ? 'bg-white shadow-xs text-slate-950 font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Kanban Pipeline View"
              >
                <Kanban className={`w-3.5 h-3.5 ${viewMode === 'kanban' ? 'text-[#008f77]' : 'text-slate-400'}`} />
                <span>Kanban</span>
              </button>
              <button
                id="lead-view-table-btn"
                onClick={() => handleSelectViewMode('table')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table' ? 'bg-white shadow-xs text-slate-950 font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="List View"
              >
                <LayoutList className={`w-3.5 h-3.5 ${viewMode === 'table' ? 'text-[#008f77]' : 'text-slate-400'}`} />
                <span>List</span>
              </button>
              <button
                id="lead-view-cards-btn"
                onClick={() => handleSelectViewMode('cards')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white shadow-xs text-slate-950 font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Card View"
              >
                <LayoutGrid className={`w-3.5 h-3.5 ${viewMode === 'cards' ? 'text-[#008f77]' : 'text-slate-400'}`} />
                <span>Card</span>
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold">Filters:</span>
            </div>

            {/* Status Filter */}
            <select
              id="lead-status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="all">All Statuses ({leads.length})</option>
              <option value="NEW">New Inquiries</option>
              <option value="PROPOSAL_SAVED">Proposal Saved</option>
              <option value="QUOTE_DOWNLOADED">Quote Downloaded</option>
              <option value="BOOKING_SUBMISSION">Booking Submitted</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="QUOTED">Quoted</option>
              <option value="WON">Won (Converted)</option>
              <option value="LOST">Lost</option>
            </select>

            {/* Pipeline Stage Filter */}
            <select
              id="lead-stage-filter"
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="all">All Pipeline Stages ({stages.length})</option>
              {stages.map(st => (
                <option key={st.id} value={st.id}>
                  {st.name} ({leads.filter(l => l.stageId === st.id).length})
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              id="lead-priority-filter"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="URGENT">Urgent SLA</option>
              <option value="HIGH">High Priority</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>

            {/* Source Filter */}
            <select
              id="lead-source-filter"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-[#00C6A6] cursor-pointer"
            >
              <option value="all">All Sources</option>
              <option value="PROPOSAL_DOWNLOADED">PDF Quote Download</option>
              <option value="QUOTATION_SAVED">Proposal Saved</option>
              <option value="BOOKING_SUBMISSION">Direct Booking</option>
              <option value="B2B_PARTNER">B2B Partner</option>
              <option value="WEBSITE">Website Form</option>
              <option value="MARKETING_CAMPAIGN">Campaign</option>
            </select>

            {/* Mandatory Dual Ownership Filter */}
            <select
              id="lead-ownership-filter"
              value={ownershipFilter}
              onChange={e => setOwnershipFilter(e.target.value as any)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                ownershipFilter === 'needs_assignment'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : ownershipFilter !== 'all'
                  ? 'bg-teal-50 border-[#00C6A6] text-[#008f77]'
                  : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white'
              }`}
            >
              <option value="all">Ownership: All ({leads.length})</option>
              <option value="assigned">Fully Assigned ({fullyAssignedLeads})</option>
              <option value="needs_assignment">⚠️ Needs Assignment ({needsAssignmentLeads})</option>
              <option value="pending_internal">Pending Internal Staff ({pendingInternalLeads})</option>
              <option value="pending_agent">Pending B2B Agent ({pendingAgentLeads})</option>
            </select>

            {/* Quick Needs Assignment Filter Pill */}
            {needsAssignmentLeads > 0 && ownershipFilter !== 'needs_assignment' && (
              <button
                type="button"
                id="quick-filter-needs-assignment"
                onClick={() => setOwnershipFilter('needs_assignment')}
                className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer flex items-center gap-1.5 animate-pulse"
                title="Filter leads missing either a B2B Agent or an Internal Team Member"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Needs Assignment ({needsAssignmentLeads})</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                id="reset-lead-filters-btn"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredLeads.length}</strong> of <span className="font-semibold">{leads.length}</span> leads
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedLeadIds.length > 0 && (
        <div className="sticky top-2 z-30 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="bg-[#00C6A6] text-slate-950 font-black px-2.5 py-0.5 rounded-full text-xs">
              {selectedLeadIds.length} Selected
            </span>
            <span className="text-xs text-slate-300">
              Bulk actions for chosen pipeline opportunities:
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Bulk Assign */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-[#00C6A6]" />
              <select
                id="bulk-assign-select"
                value={bulkStaffId}
                onChange={e => {
                  setBulkStaffId(e.target.value);
                  if (e.target.value) handleBulkAssign(e.target.value);
                }}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="" className="text-slate-900">Assign Specialist...</option>
                {STAFF_SPECIALISTS.map(st => (
                  <option key={st.id} value={st.id} className="text-slate-900">
                    {st.name} ({st.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk Move Stage */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
              <Layers className="w-3.5 h-3.5 text-teal-400" />
              <select
                id="bulk-stage-select"
                value={bulkStageId}
                onChange={e => {
                  setBulkStageId(e.target.value);
                  if (e.target.value) handleBulkStage(e.target.value);
                }}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="" className="text-slate-900">Move to Stage...</option>
                {stages.map(st => (
                  <option key={st.id} value={st.id} className="text-slate-900">
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedLeadIds([])}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KANBAN PIPELINE VIEW */}
      {viewMode === 'kanban' && (
        <LeadKanbanBoard
          leads={filteredLeads}
          stages={stages}
          onOpenDetail={handleOpenDetail}
          onOpenEdit={handleOpenEdit}
          onStageChange={handleStageChange}
          onOpenActionCenter={onOpenActionCenter}
        />
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.length > 0 && selectedLeadIds.length === filteredLeads.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-[#008f77] focus:ring-[#008f77] cursor-pointer"
                    />
                  </th>
                  <th className="py-4 px-4">Lead # & Stage</th>
                  <th className="py-4 px-4">Client Contact & Agency</th>
                  <th className="py-4 px-4">Destination & Timeline</th>
                  <th className="py-4 px-4">Pipeline Deal Value</th>
                  <th className="py-4 px-4">Inquiry Origin</th>
                  <th className="py-4 px-4">Dual Ownership (Agent / Team)</th>
                  <th className="py-4 px-4">SLA Priority</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Search className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">No matching leads found</h4>
                        <p className="text-xs text-slate-500">
                          Try adjusting your search criteria, clearing filter chips, or capturing a new inquiry.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Clear all filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    const leadStage = stages.find(s => s.id === lead.stageId);
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => handleOpenDetail(lead)}
                        className={`hover:bg-slate-50/90 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-4 px-3 w-10 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(lead.id)}
                            className="rounded border-slate-300 text-[#008f77] focus:ring-[#008f77] cursor-pointer"
                          />
                        </td>

                        {/* Lead # and Stage */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                {lead.leadNumber}
                              </span>
                              <RecordReminderIndicator
                                entityType="LEAD"
                                entityId={lead.id}
                                entityReference={lead.leadNumber}
                                currentUser={user}
                                variant="badge"
                                onOpenActionCenter={onOpenActionCenter}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {leadStage && (
                                <span 
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-slate-800"
                                  style={{ backgroundColor: `${leadStage.color}15`, borderColor: `${leadStage.color}40` }}
                                >
                                  {leadStage.name}
                                </span>
                              )}
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${getStatusColor(lead.status)}`}>
                                {lead.status ? lead.status.replace(/_/g, ' ') : 'NEW'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Contact & Agency */}
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block group-hover:text-[#008f77] transition-colors text-sm">
                              {lead.contactName}
                            </span>
                            {lead.agencyName && (
                              <span className="text-xs font-semibold text-[#008f77] block flex items-center gap-1">
                                <Building className="w-3 h-3 text-[#00C6A6]" />
                                <span>{lead.agencyName}</span>
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">{lead.email}</span>
                          </div>
                        </td>

                        {/* Destination & Dates */}
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block text-xs">{lead.destinationName}</span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">
                              {lead.travelDates || 'Upcoming 2026'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium block">
                              {lead.paxAdults || 2} Adults {lead.paxChildren ? `• ${lead.paxChildren} Children` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Deal Value */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <span className="font-mono text-sm font-black text-slate-950 block">
                              {lead.currency || 'USD'} {(Number(lead.estimatedBudget || lead.bookingValue || 0)).toLocaleString()}
                            </span>
                            {lead.quoteNumber && (
                              <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 font-bold px-2 py-0.5 rounded block w-fit">
                                Quote #{lead.quoteNumber}
                              </span>
                            )}
                            {lead.bookingReference && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold px-2 py-0.5 rounded block w-fit">
                                Booking #{lead.bookingReference}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Source & Campaign */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md block w-fit border border-slate-200">
                              {lead.source}
                            </span>
                            {lead.campaignName && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-[130px]">
                                {lead.campaignName}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Dual Ownership (Commercial Agent & Internal Team Member) */}
                        <td className="py-4 px-4">
                          {(() => {
                            const agentName = lead.responsibleAgentNameSnapshot || lead.assignedAgentNameSnapshot || (lead.userType === 'B2B_AGENT' ? lead.agencyName : undefined);
                            const staffName = lead.assignedTeamMemberNameSnapshot || lead.assignedStaffName;
                            const hasAgent = Boolean(lead.responsibleAgentId || lead.assignedAgentId || agentName);
                            const hasStaff = Boolean(lead.assignedTeamMemberId || lead.assignedStaffId || staffName);

                            return (
                              <div className="space-y-1.5 min-w-[180px]">
                                {/* B2B Agent Indicator */}
                                <div className="flex items-center gap-1.5">
                                  <Building className={`w-3.5 h-3.5 shrink-0 ${hasAgent ? 'text-indigo-600' : 'text-amber-500'}`} />
                                  <div className="truncate">
                                    {hasAgent ? (
                                      <span className="text-xs font-bold text-slate-900 truncate block">
                                        {agentName || 'B2B Partner Agent'}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-block">
                                        Needs B2B Agent
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Internal Team Member Indicator */}
                                <div className="flex items-center gap-1.5">
                                  <UserCheck className={`w-3.5 h-3.5 shrink-0 ${hasStaff ? 'text-[#008f77]' : 'text-rose-500'}`} />
                                  <div className="truncate">
                                    {hasStaff ? (
                                      <span className="text-xs font-semibold text-slate-700 truncate block">
                                        {staffName} <span className="text-[10px] text-slate-400">({lead.assignedDepartment || 'OPS'})</span>
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded inline-block">
                                        Needs Internal Staff
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Status Chip */}
                                <div>
                                  {hasAgent && hasStaff ? (
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                                      Dual Owned
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                                      Assignment Incomplete
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Priority */}
                        <td className="py-4 px-4">
                          {getPriorityBadge(lead.priority)}
                        </td>

                        {/* Quick Actions */}
                        <td className="py-4 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              id={`view-lead-btn-${lead.id}`}
                              onClick={() => handleOpenDetail(lead)}
                              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Open Profile & Timeline"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              id={`edit-lead-btn-${lead.id}`}
                              onClick={e => handleOpenEdit(lead, e)}
                              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Edit Lead"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              id={`delete-lead-btn-${lead.id}`}
                              onClick={e => handleDelete(lead.id, e)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARDS VIEW */}
      {viewMode === 'cards' && (
        <div>
          {filteredLeads.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No matching leads found</h4>
              <p className="text-xs text-slate-500">
                Try adjusting your search criteria, clearing filter chips, or capturing a new inquiry.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Clear all filters</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredLeads.map(lead => {
                const isSelected = selectedLeadIds.includes(lead.id);
                const leadStage = stages.find(s => s.id === lead.stageId);
                return (
                  <div
                    key={lead.id}
                    onClick={() => handleOpenDetail(lead)}
                    className={`bg-white rounded-3xl border p-6 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-5 relative ${
                      isSelected ? 'border-[#008f77] ring-2 ring-[#008f77]/20 bg-teal-50/10' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Top bar: Select checkbox, Lead reference, Reminder, Priority & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(lead.id)}
                              className="rounded border-slate-300 text-[#008f77] focus:ring-[#008f77] cursor-pointer"
                            />
                          </div>
                          <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {lead.leadNumber}
                          </span>
                          <RecordReminderIndicator
                            entityType="LEAD"
                            entityId={lead.id}
                            entityReference={lead.leadNumber}
                            currentUser={user}
                            variant="badge"
                            onOpenActionCenter={onOpenActionCenter}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {getPriorityBadge(lead.priority)}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(lead.status)}`}>
                            {lead.status ? lead.status.replace(/_/g, ' ') : 'NEW'}
                          </span>
                        </div>
                      </div>

                      {/* Contact & Agency info */}
                      <div>
                        <h3 className="text-base font-black text-slate-950 group-hover:text-[#008f77] transition-colors">
                          {lead.contactName}
                        </h3>
                        {lead.agencyName && (
                          <span className="text-xs font-bold text-[#008f77] block mt-0.5 flex items-center gap-1">
                            <Building className="w-3 h-3 text-[#00C6A6]" />
                            <span>{lead.agencyName}</span>
                          </span>
                        )}
                        <span className="text-xs text-slate-400 block mt-0.5">{lead.email}</span>
                      </div>

                      {/* Stage Badge & Quick Stage Selector */}
                      <div className="flex items-center justify-between gap-2 pt-1" onClick={e => e.stopPropagation()}>
                        {leadStage ? (
                          <span 
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full border text-slate-800"
                            style={{ backgroundColor: `${leadStage.color}15`, borderColor: `${leadStage.color}40` }}
                          >
                            {leadStage.name}
                          </span>
                        ) : <span />}
                        <select
                          value={lead.stageId || 'inquiry-received'}
                          onChange={e => handleStageChange(lead.id, e.target.value)}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 font-bold focus:outline-none cursor-pointer"
                        >
                          {stages.map(st => (
                            <option key={st.id} value={st.id}>
                              Move: {st.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Spec summary box */}
                      <div className="p-4 bg-slate-50/80 rounded-2xl text-xs space-y-2 border border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Destination:</span>
                          <span className="font-bold text-slate-900">{lead.destinationName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-medium">Travel Dates:</span>
                          <span className="font-semibold text-slate-800">{lead.travelDates || 'Flexible 2026'}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                          <span className="text-slate-400 font-medium">Deal Pipeline:</span>
                          <span className="font-mono text-sm font-black text-[#008f77]">
                            {lead.currency || 'USD'} {(Number(lead.estimatedBudget || lead.bookingValue || 0)).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Requirements teaser */}
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {typeof lead.travelRequirements === 'string'
                          ? lead.travelRequirements
                          : Array.isArray(lead.travelRequirements)
                            ? (lead.travelRequirements as any[]).map(r => typeof r === 'string' ? r : r?.text || '').filter(Boolean).join(', ')
                            : 'VIP bespoke travel preferences requested.'}
                      </p>
                    </div>

                    {/* Dual Ownership Card Strip */}
                    <div className="pt-3 border-t border-slate-100/80 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {/* Commercial Agent */}
                        <div className="bg-slate-50/90 rounded-xl p-2 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                            B2B Agent
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Building className={`w-3 h-3 shrink-0 ${lead.responsibleAgentId || lead.assignedAgentId ? 'text-indigo-600' : 'text-amber-500'}`} />
                            <span className="font-bold text-slate-800 truncate block">
                              {lead.responsibleAgentNameSnapshot || lead.assignedAgentNameSnapshot || (lead.userType === 'B2B_AGENT' ? lead.agencyName : 'Needs Agent')}
                            </span>
                          </div>
                        </div>

                        {/* Internal Operations Staff */}
                        <div className="bg-slate-50/90 rounded-xl p-2 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                            Internal Staff
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <UserCheck className={`w-3 h-3 shrink-0 ${lead.assignedTeamMemberId || lead.assignedStaffId ? 'text-[#008f77]' : 'text-rose-500'}`} />
                            <span className="font-bold text-slate-800 truncate block">
                              {lead.assignedTeamMemberNameSnapshot || lead.assignedStaffName || 'Needs Staff'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions & Details */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          {Boolean(lead.responsibleAgentId || lead.assignedAgentId) && Boolean(lead.assignedTeamMemberId || lead.assignedStaffId) ? (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                              ✓ Dual Assigned
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              <span>Needs Assignment</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(lead)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>Details</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                          <button
                            type="button"
                            onClick={e => handleOpenEdit(lead, e)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Edit Lead"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Detail Drawer */}
      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateLead={updatedLead => {
            setSelectedLead(updatedLead);
            setLeads(db.getLeadsAuthorized(user));
          }}
          onOpenBooking={onOpenBooking}
          onOpenQuote={onOpenQuote}
        />
      )}

      {/* Edit / Add Modal */}
      {isEditModalOpen && (
        <LeadEditModal
          lead={editingLead}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingLead(null);
          }}
          onSaved={savedLead => {
            setLeads(db.getLeadsAuthorized(user));
          }}
        />
      )}
    </div>
  );
};
