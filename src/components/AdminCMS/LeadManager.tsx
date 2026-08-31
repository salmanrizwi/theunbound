import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { TravelLead, LeadStatus, LeadPriority, LeadSource } from '../../types';
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
  UserCheck
} from 'lucide-react';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { LeadEditModal } from './LeadEditModal';

export const LeadManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [leads, setLeads] = useState<TravelLead[]>(db.getLeadsAuthorized(user));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Drawer / Modal states
  const [selectedLead, setSelectedLead] = useState<TravelLead | null>(null);
  const [editingLead, setEditingLead] = useState<Partial<TravelLead> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    return db.subscribe(() => {
      setLeads(db.getLeadsAuthorized(user));
    });
  }, [user]);

  // Lead metrics calculations
  const totalLeads = leads.length;
  const proposalSavedLeads = leads.filter(l => l.status === 'PROPOSAL_SAVED' || l.source === 'QUOTATION_SAVED').length;
  const quoteDownloadedLeads = leads.filter(l => l.status === 'QUOTE_DOWNLOADED' || l.source === 'PROPOSAL_DOWNLOADED').length;
  const bookingSubmittedLeads = leads.filter(l => l.status === 'BOOKING_SUBMITTED' || l.source === 'BOOKING_SUBMISSION').length;
  const wonLeads = leads.filter(l => l.status === 'WON' || l.conversionStatus === 'CONVERTED').length;
  const urgentLeads = leads.filter(l => l.priority === 'URGENT').length;

  const totalPipelineValue = leads.reduce((acc, l) => acc + Number(l.estimatedBudget || l.bookingValue || 0), 0);

  // Filtering
  const filteredLeads = leads.filter(l => {
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || l.priority === priorityFilter;
    const matchesSource = sourceFilter === 'all' || l.source === sourceFilter;
    
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      l.contactName.toLowerCase().includes(query) ||
      l.email.toLowerCase().includes(query) ||
      l.leadNumber.toLowerCase().includes(query) ||
      (l.agencyName && l.agencyName.toLowerCase().includes(query)) ||
      (l.destinationName && l.destinationName.toLowerCase().includes(query)) ||
      (l.quoteNumber && l.quoteNumber.toLowerCase().includes(query)) ||
      (l.bookingReference && l.bookingReference.toLowerCase().includes(query));

    return matchesStatus && matchesPriority && matchesSource && matchesSearch;
  });

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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Company Management System • CRM Engine</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Lead & Customer Journey Management</h2>
          <p className="text-sm text-slate-500 max-w-3xl mt-1">
            Unified single source of truth for traveler inquiries, proposal saves, PDF quote downloads, direct bookings, Google Calendar SLA follow-ups, and quotation versions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="create-new-lead-btn"
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold px-5 py-2.5 rounded-2xl transition-all cursor-pointer shadow-md shadow-[#00C6A6]/20 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Capture New Lead</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-400 block">Total Active Leads</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{totalLeads}</span>
            <span className="text-xs font-mono font-bold text-slate-500">${(totalPipelineValue / 1000).toFixed(0)}k Pipeline</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-purple-700 block">Proposals Saved</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-purple-900">{proposalSavedLeads}</span>
            <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">Inquiry</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-amber-700 block">PDF Downloaded</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-900">{quoteDownloadedLeads}</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">24h SLA</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-emerald-700 block">Bookings Submitted</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-900">{bookingSubmittedLeads}</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">12h SLA</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-teal-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-teal-700 block">Won / Converted</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-teal-900">{wonLeads}</span>
            <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">Closed</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-red-700 block">Urgent Action</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-red-900">{urgentLeads}</span>
            <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">Attention</span>
          </div>
        </div>
      </div>

      {/* Filter Controls & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            id="lead-search-input"
            type="text"
            placeholder="Search by client name, email, phone, agency, lead #, quote #, booking #..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            id="lead-status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <option value="all">All Statuses ({leads.length})</option>
            <option value="NEW">New Inquiries</option>
            <option value="PROPOSAL_SAVED">Proposal Saved</option>
            <option value="QUOTE_DOWNLOADED">Quote Downloaded</option>
            <option value="BOOKING_SUBMITTED">Booking Submitted</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="QUOTED">Quoted</option>
            <option value="WON">Won (Converted)</option>
            <option value="LOST">Lost</option>
          </select>

          {/* Priority Filter */}
          <select
            id="lead-priority-filter"
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
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
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
          >
            <option value="all">All Sources</option>
            <option value="PROPOSAL_DOWNLOADED">PDF Quote Download</option>
            <option value="QUOTATION_SAVED">Proposal Saved</option>
            <option value="BOOKING_SUBMISSION">Direct Booking</option>
            <option value="B2B_PARTNER">B2B Partner</option>
            <option value="WEBSITE">Website Form</option>
            <option value="MARKETING_CAMPAIGN">Campaign</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                viewMode === 'cards' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Lead # & Status</th>
                  <th className="py-3.5 px-4">Contact & Agency</th>
                  <th className="py-3.5 px-4">Destination & Dates</th>
                  <th className="py-3.5 px-4">Deal Value</th>
                  <th className="py-3.5 px-4">Source & Campaign</th>
                  <th className="py-3.5 px-4">Assigned Staff</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No leads match the specified filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => handleOpenDetail(lead)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Lead # and Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {lead.leadNumber}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${getStatusColor(lead.status)}`}>
                            {lead.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>

                      {/* Contact & Agency */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-bold text-slate-900 block group-hover:text-[#008f77] transition-colors">
                            {lead.contactName}
                          </span>
                          {lead.agencyName && (
                            <span className="text-[11px] font-semibold text-[#008f77] block">
                              {lead.agencyName}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 block">{lead.email}</span>
                        </div>
                      </td>

                      {/* Destination & Dates */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-semibold text-slate-800 block">{lead.destinationName}</span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[150px]">
                            {lead.travelDates || 'Upcoming 2026'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {lead.paxAdults || 2}A {lead.paxChildren ? `• ${lead.paxChildren}C` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Deal Value */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-mono font-bold text-slate-900 block">
                            {lead.currency || 'USD'} {(Number(lead.estimatedBudget || lead.bookingValue || 0)).toLocaleString()}
                          </span>
                          {lead.quoteNumber && (
                            <span className="text-[10px] text-purple-700 font-semibold block">
                              Quote #{lead.quoteNumber}
                            </span>
                          )}
                          {lead.bookingReference && (
                            <span className="text-[10px] text-emerald-700 font-bold block">
                              Booking #{lead.bookingReference}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Source & Campaign */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded block w-fit">
                            {lead.source}
                          </span>
                          {lead.campaignName && (
                            <span className="text-[10px] text-slate-500 mt-0.5 block truncate max-w-[130px]">
                              {lead.campaignName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Assigned Staff */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-slate-700 font-medium block">
                          {lead.assignedStaffName || 'Unassigned'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {lead.assignedDepartment || 'SALES'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4">
                        {getPriorityBadge(lead.priority)}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`view-lead-btn-${lead.id}`}
                            onClick={() => handleOpenDetail(lead)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Open Profile & Timeline"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`edit-lead-btn-${lead.id}`}
                            onClick={e => handleOpenEdit(lead, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Edit Lead"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            id={`delete-lead-btn-${lead.id}`}
                            onClick={e => handleDelete(lead.id, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARDS VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map(lead => (
            <div
              key={lead.id}
              onClick={() => handleOpenDetail(lead)}
              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    {lead.leadNumber}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getPriorityBadge(lead.priority)}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(lead.status)}`}>
                      {lead.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{lead.contactName}</h3>
                  {lead.agencyName && (
                    <span className="text-xs font-semibold text-[#008f77] block">{lead.agencyName}</span>
                  )}
                  <span className="text-xs text-slate-400 block mt-0.5">{lead.email}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination:</span>
                    <span className="font-bold text-slate-800">{lead.destinationName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Travel Dates:</span>
                    <span className="font-bold text-slate-800">{lead.travelDates || 'Flexible'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Budget / Value:</span>
                    <span className="font-mono font-bold text-[#008f77]">
                      {lead.currency || 'USD'} {(Number(lead.estimatedBudget || lead.bookingValue || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">
                  {lead.travelRequirements || 'VIP ground arrangements requested.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Assigned: <strong className="text-slate-700">{lead.assignedStaffName || 'Desk'}</strong></span>
                <span className="text-[#008f77] font-bold flex items-center gap-1">
                  <span>View Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
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
