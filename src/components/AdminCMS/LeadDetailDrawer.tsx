import React, { useState } from 'react';
import { 
  TravelLead, 
  LeadStatus, 
  LeadPriority, 
  LeadNote,
  LeadFollowUpTask,
  CurrencyCode
} from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Building, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Package, 
  ShieldCheck, 
  Send, 
  Plus, 
  ExternalLink,
  History,
  Tag,
  Briefcase,
  ChevronRight,
  TrendingUp,
  Award,
  Users,
  Compass,
  Check,
  BookmarkCheck
} from 'lucide-react';
import { RecordReminderIndicator } from '../ActionCenter/RecordReminderIndicator';
import { LeadTasksSection } from './tasks/LeadTasksSection';
import { CheckSquare } from 'lucide-react';

interface LeadDetailDrawerProps {
  lead: TravelLead | null;
  onClose: () => void;
  onUpdateLead: (updatedLead: TravelLead) => void;
  onNavigateToTasks?: () => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onUpdateLead,
  onNavigateToTasks
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'requirements' | 'products' | 'quotes' | 'timeline' | 'followups' | 'notes' | 'documents'
  >('overview');

  const [newNoteText, setNewNoteText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(true);

  // Follow up state
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [newFollowUpTitle, setNewFollowUpTitle] = useState('');
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newFollowUpSla, setNewFollowUpSla] = useState(24);
  const [newFollowUpAssignee, setNewFollowUpAssignee] = useState(user?.name || 'Marcus Vance');

  // Quick staff assignment
  const staffList = [
    { id: 'staff-01', name: 'Marcus Vance (Senior Ops)', email: 'business@theunbound.in', dept: 'OPERATIONS' as const },
    { id: 'staff-02', name: 'Kenji Takahashi (Japan Ground Lead)', email: 'kenji@theunbound.in', dept: 'SALES' as const },
    { id: 'staff-03', name: 'Elena Rostova (B2B Concierge)', email: 'elena@theunbound.in', dept: 'SALES' as const },
    { id: 'staff-04', name: 'Aarav Patel (Client Success)', email: 'aarav@theunbound.in', dept: 'MANAGEMENT' as const }
  ];

  // B2B Partner Agent Assignment
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [isAssigningAgent, setIsAssigningAgent] = useState(false);

  const b2bAgents = React.useMemo(() => {
    return db.getUsers().filter(u => u.role === 'B2B_AGENT' && u.approvalStatus === 'APPROVED');
  }, [db]);

  if (!lead) return null;

  const handleAssignAgent = () => {
    if (!selectedAgentId) return;
    try {
      const updated = db.assignLeadToAgent(lead.id, selectedAgentId, user, assignmentNote.trim() || undefined);
      if (updated) {
        onUpdateLead(updated);
        setSelectedAgentId('');
        setAssignmentNote('');
        setIsAssigningAgent(false);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to assign agent');
    }
  };

  const handleUnassignAgent = () => {
    if (!window.confirm('Are you sure you want to unassign this B2B Agent? The lead will immediately be hidden from the agent portal.')) return;
    const updated = db.unassignLead(lead.id, user, 'Unassigned via CMS Lead Drawer');
    if (updated) {
      onUpdateLead(updated);
    }
  };

  const handleStatusChange = (newStatus: LeadStatus) => {
    const updated = db.updateLeadStatus(lead.id, newStatus, user);
    if (updated) onUpdateLead(updated);
  };

  const handlePriorityChange = (newPriority: LeadPriority) => {
    const updated = db.updateLeadPriority(lead.id, newPriority, user);
    if (updated) onUpdateLead(updated);
  };

  const handleAssignStaff = (staffId: string) => {
    const targetStaff = staffList.find(s => s.id === staffId);
    if (!targetStaff) return;
    const updated = db.assignLead(
      lead.id,
      { id: targetStaff.id, name: targetStaff.name, email: targetStaff.email, department: targetStaff.dept },
      user,
      `Manual assignment by ${user?.name || 'Admin'}`
    );
    if (updated) onUpdateLead(updated);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const updated = db.addLeadNote(lead.id, newNoteText.trim(), user, isInternalNote);
    if (updated) {
      onUpdateLead(updated);
      setNewNoteText('');
    }
  };

  const handleAddFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFollowUpTitle.trim() || !newFollowUpDate) return;
    const updated = db.addLeadFollowUp(
      lead.id,
      {
        taskType: 'MANUAL_FOLLOW_UP',
        title: newFollowUpTitle.trim(),
        description: `Scheduled manual follow-up with ${lead.contactName}`,
        assignedToName: newFollowUpAssignee,
        assignedToEmail: user?.email || 'business@theunbound.in',
        assignedDepartment: 'SALES',
        dueAt: new Date(newFollowUpDate).toISOString(),
        slaHours: Number(newFollowUpSla) || 24,
        status: 'PENDING',
        priority: lead.priority || 'NORMAL'
      },
      user
    );
    if (updated) {
      onUpdateLead(updated);
      setShowAddFollowUp(false);
      setNewFollowUpTitle('');
      setNewFollowUpDate('');
    }
  };

  const handleCompleteFollowUp = (followUpId: string) => {
    const updated = db.completeLeadFollowUp(lead.id, followUpId, user);
    if (updated) onUpdateLead(updated);
  };

  const getPriorityBadge = (priority?: LeadPriority) => {
    switch (priority) {
      case 'URGENT':
        return <span className="bg-red-100 text-red-800 border border-red-300 font-bold px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-600" /> Urgent SLA</span>;
      case 'HIGH':
        return <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3 text-amber-600" /> High Priority</span>;
      case 'LOW':
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 font-medium px-2.5 py-0.5 rounded-full text-xs">Low Priority</span>;
      default:
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 font-semibold px-2.5 py-0.5 rounded-full text-xs">Normal</span>;
    }
  };

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'PROPOSAL_SAVED': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'QUOTE_DOWNLOADED': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'BOOKING_SUBMITTED': return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
      case 'QUALIFIED': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'QUOTED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'WON': return 'bg-teal-100 text-teal-800 border-teal-300 font-bold';
      case 'LOST': return 'bg-slate-100 text-slate-600 border-slate-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        id={`lead-drawer-${lead.id}`}
        className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200"
      >
        {/* Top Header */}
        <div className="p-6 bg-slate-900 text-white flex flex-col gap-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold bg-white/10 text-[#00C6A6] px-2.5 py-1 rounded-md">
                {lead.leadNumber}
              </span>
              <RecordReminderIndicator
                entityType="LEAD"
                entityId={lead.id}
                entityReference={lead.leadNumber}
                currentUser={user}
                variant="header"
              />
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadge(lead.status)}`}>
                {lead.status.replace(/_/g, ' ')}
              </span>
              {getPriorityBadge(lead.priority)}
            </div>

            <button
              id="lead-drawer-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{lead.contactName}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                {lead.agencyName && (
                  <span className="flex items-center gap-1 text-[#00C6A6] font-semibold">
                    <Building className="w-3.5 h-3.5" />
                    {lead.agencyName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {lead.email}
                </span>
                {lead.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {lead.phone}
                  </span>
                )}
                {lead.country && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {lead.country}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Status</span>
                <select
                  id="lead-status-quick-select"
                  value={lead.status}
                  onChange={e => handleStatusChange(e.target.value as LeadStatus)}
                  className="bg-slate-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-[#00C6A6]"
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="PROPOSAL_SAVED">Proposal Saved</option>
                  <option value="QUOTE_DOWNLOADED">Quote Downloaded</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="QUOTED">Quoted</option>
                  <option value="BOOKING_SUBMITTED">Booking Submitted</option>
                  <option value="WON">Won (Converted)</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Priority</span>
                <select
                  id="lead-priority-quick-select"
                  value={lead.priority || 'NORMAL'}
                  onChange={e => handlePriorityChange(e.target.value as LeadPriority)}
                  className="bg-slate-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-[#00C6A6]"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent SLA</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="bg-slate-800/60 p-2 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Destination</span>
              <span className="font-bold text-white">{lead.destinationName}</span>
            </div>
            <div className="bg-slate-800/60 p-2 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Est. Value</span>
              <span className="font-bold text-[#00C6A6]">
                {lead.currency || 'USD'} {(Number(lead.estimatedBudget || lead.bookingValue || 0)).toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-800/60 p-2 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Travel Dates</span>
              <span className="font-bold text-white truncate block">{lead.travelDates || 'Flexible 2026'}</span>
            </div>
            <div className="bg-slate-800/60 p-2 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lead Source</span>
              <span className="font-bold text-amber-300 truncate block">{lead.source}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Briefcase },
            { id: 'requirements', label: 'Travel Details', icon: Compass },
            { id: 'products', label: `Products (${lead.requestedProducts?.length || 0})`, icon: Package },
            { id: 'quotes', label: `Quote & Versions (${lead.quoteVersions?.length || (lead.quoteNumber ? 1 : 0)})`, icon: DollarSign },
            { id: 'timeline', label: `Timeline (${lead.timeline?.length || 0})`, icon: History },
            { id: 'followups', label: `Tasks & Follow-Ups (${db.getTasksForLead(lead.id).length})`, icon: CheckSquare },
            { id: 'notes', label: `Notes (${lead.notes?.length || 0})`, icon: FileText },
            { id: 'documents', label: `Documents (${lead.documents?.length || 0})`, icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`lead-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Assignment & Owner Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Lead Ownership & Assignment</span>
                  <span className="text-xs font-normal text-slate-500">Dept: {lead.assignedDepartment || 'SALES'}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1">Assigned Specialist</label>
                    <select
                      value={staffList.find(s => s.name === lead.assignedStaffName || s.id === lead.assignedStaffId)?.id || 'staff-01'}
                      onChange={e => handleAssignStaff(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                    >
                      {staffList.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.dept})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-semibold block mb-1">User Account Link</label>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                      <span className="font-medium text-slate-700">
                        {lead.userType ? `${lead.userType} Account` : 'Direct Consumer / Guest'}
                      </span>
                      {lead.userId && (
                        <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                          {lead.userId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* B2B Partner Agent Assignment & Portal Visibility */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-[#00C6A6]" />
                      <span>B2B Partner Agent Assignment</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      lead.assignedAgentId 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {lead.assignedAgentId ? 'Visible in Agent Portal' : 'Internal Only (Hidden from Agents)'}
                    </span>
                  </div>

                  {lead.assignedAgentId ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-emerald-950">
                            {lead.assignedAgentNameSnapshot || 'Partner Agent'}
                          </span>
                          {lead.assignedAgentAgencySnapshot && (
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-800 font-medium">
                              {lead.assignedAgentAgencySnapshot}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Assigned by {lead.assignedByUserNameSnapshot || 'Operations'} • {lead.assignedAt ? new Date(lead.assignedAt).toLocaleDateString() : 'Recently'}
                          {lead.assignedAgentEmailSnapshot && ` • ${lead.assignedAgentEmailSnapshot}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleUnassignAgent}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Unassign Agent
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-500">
                        Assign this lead to an approved B2B Agent to grant them visibility and fulfillment permissions in their portal.
                      </p>
                      {!isAssigningAgent ? (
                        <button
                          type="button"
                          onClick={() => setIsAssigningAgent(true)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Assign to B2B Partner Agent</span>
                        </button>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">Select Approved Agent</label>
                              <select
                                value={selectedAgentId}
                                onChange={(e) => setSelectedAgentId(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                              >
                                <option value="">-- Choose B2B Agent --</option>
                                {b2bAgents.map(ag => (
                                  <option key={ag.id} value={ag.id}>
                                    {ag.name} ({ag.agencyName || ag.companyName || 'Independent'}) - {ag.email}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">Assignment Note (Optional)</label>
                              <input
                                type="text"
                                value={assignmentNote}
                                onChange={(e) => setAssignmentNote(e.target.value)}
                                placeholder="e.g. VIP client requesting high-end Ryokan"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#00C6A6]"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAssigningAgent(false);
                                setSelectedAgentId('');
                                setAssignmentNote('');
                              }}
                              className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!selectedAgentId}
                              onClick={handleAssignAgent}
                              className="px-3.5 py-1 rounded-lg bg-[#00C6A6] hover:bg-[#00b094] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Confirm & Notify Agent
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Commercial Summary Banner */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border-r border-slate-100 pr-4">
                  <span className="text-xs font-semibold text-slate-400 block uppercase">Conversion Funnel</span>
                  <span className="text-base font-bold text-slate-900 mt-1 block">
                    {lead.conversionStatus || (lead.bookingId ? 'CONVERTED' : 'IN_PROGRESS')}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {lead.bookingReference ? `Linked Booking #${lead.bookingReference}` : lead.quoteNumber ? `Linked Quote #${lead.quoteNumber}` : 'Inquiry Stage'}
                  </p>
                </div>

                <div className="border-r border-slate-100 pr-4">
                  <span className="text-xs font-semibold text-slate-400 block uppercase">Commercial Attribution</span>
                  <span className="text-base font-bold text-slate-900 mt-1 block">
                    {lead.campaignName || lead.source}
                  </span>
                  {lead.campaignSource && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{lead.campaignSource}</p>
                  )}
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">Total Deal Value</span>
                  <span className="text-xl font-black text-[#00C6A6] mt-1 block">
                    {lead.currency || 'USD'} {(Number(lead.estimatedBudget || lead.bookingValue || 0)).toLocaleString()}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {lead.numberOfNights || 7} Nights • {lead.paxAdults || 2} Adults
                  </p>
                </div>
              </div>

              {/* Linked Commercial Records (Quotations & Bookings) */}
              {(lead.quoteNumber || lead.bookingReference || (lead.linkedBookingIds && lead.linkedBookingIds.length > 0)) && (
                <div className="bg-white p-5 rounded-2xl border border-teal-200/80 bg-teal-50/20 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <BookmarkCheck className="w-4 h-4 text-[#00C6A6]" />
                      <span>Linked Commercial Transactions</span>
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#00C6A6]/10 text-[#008f77]">
                      Bi-directional Link Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {lead.quoteNumber && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Proposal</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-50 text-sky-700">
                            {lead.quoteSnapshot?.status || 'Active'}
                          </span>
                        </div>
                        <p className="font-mono font-bold text-slate-900 text-sm">#{lead.quoteNumber}</p>
                        {lead.quoteSnapshot?.totalSellingPrice && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Value: {lead.quoteSnapshot.currency || 'USD'} {Number(lead.quoteSnapshot.totalSellingPrice).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {(lead.bookingReference || lead.bookingId) && (
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Confirmed Booking</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {lead.conversionStatus || 'CONVERTED'}
                          </span>
                        </div>
                        <p className="font-mono font-bold text-emerald-800 text-sm">#{lead.bookingReference || lead.bookingId}</p>
                        {lead.bookingValue && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Gross Booking Value: {lead.currency || 'USD'} {Number(lead.bookingValue).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Brief Travel Requirements Overview */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Travel Requirements Summary</h3>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {typeof lead.travelRequirements === 'string'
                    ? lead.travelRequirements
                    : Array.isArray(lead.travelRequirements)
                      ? (lead.travelRequirements as any[]).map((r: any) => typeof r === 'string' ? r : r?.text || '').filter(Boolean).join('\n')
                      : 'Standard VIP ground arrangements requested.'}
                </p>
                {lead.specialRequests && (
                  <div className="mt-3">
                    <span className="text-xs font-bold text-amber-800 uppercase block mb-1">Special Dietary / VIP Requests:</span>
                    <p className="text-xs text-slate-700 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                      {typeof lead.specialRequests === 'string'
                        ? lead.specialRequests
                        : Array.isArray(lead.specialRequests)
                          ? (lead.specialRequests as any[]).map((s: any) => typeof s === 'string' ? s : s?.text || '').filter(Boolean).join('\n')
                          : JSON.stringify(lead.specialRequests)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: TRAVEL REQUIREMENTS */}
          {activeTab === 'requirements' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#00C6A6]" />
                  <span>Comprehensive Travel Specifications</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 font-semibold block">Primary Destination</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">{lead.destinationName}</span>
                    {lead.regionName && <span className="text-[11px] text-slate-500">Region: {lead.regionName}</span>}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 font-semibold block">Travel Dates</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">{lead.travelDates || 'Flexible'}</span>
                    <span className="text-[11px] text-slate-500">Duration: {lead.numberOfNights || 7} Nights</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 font-semibold block">Passenger Breakdown</span>
                    <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                      {lead.totalPassengers || (lead.paxAdults + (lead.paxChildren || 0))} Total Pax
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lead.paxAdults} Adults, {lead.paxChildren || 0} Children, {lead.paxInfants || 0} Infants
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 font-semibold block">Rooms & Occupancy</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {lead.roomsCount || 1} Rooms ({lead.roomOccupancy || 'Double/Twin'})
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 font-semibold block">Meal Plan</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{lead.mealPlan || 'Daily Breakfast'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 font-semibold block">Target Budget</span>
                    <span className="font-bold text-[#008f77] mt-0.5 block">
                      {lead.currency || 'USD'} {(Number(lead.estimatedBudget) || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Cities and Hubs */}
                {lead.cities && lead.cities.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 block mb-2">Target Cities / Regions:</span>
                    <div className="flex flex-wrap gap-2">
                      {lead.cities.map((city, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium">
                          {city}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Preferences */}
                <div className="mt-4 space-y-3 pt-4 border-t border-slate-100 text-xs">
                  {lead.hotelPreferences && (
                    <div>
                      <span className="font-bold text-slate-700 block">Hotel & Accommodation Preferences:</span>
                      <p className="text-slate-600 mt-0.5">{lead.hotelPreferences}</p>
                    </div>
                  )}
                  {lead.transportPreferences && (
                    <div>
                      <span className="font-bold text-slate-700 block">Transport & Chauffeur Preferences:</span>
                      <p className="text-slate-600 mt-0.5">{lead.transportPreferences}</p>
                    </div>
                  )}
                  {lead.activityPreferences && (
                    <div>
                      <span className="font-bold text-slate-700 block">Activity & Experience Preferences:</span>
                      <p className="text-slate-600 mt-0.5">{lead.activityPreferences}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PRODUCTS SNAPSHOT */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Requested & Quoted Services Snapshot
                    </h3>
                    <p className="text-xs text-slate-500">
                      Preserved historical service lines attached to this commercial lead.
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-[#00C6A6]/10 text-[#008f77] px-3 py-1 rounded-full">
                    {lead.requestedProducts?.length || 0} Line Items
                  </span>
                </div>

                {(!lead.requestedProducts || lead.requestedProducts.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No specific line products attached yet. Generate a quotation or customize itinerary services.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                          <th className="pb-2">Service / Product</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2">Destination</th>
                          <th className="pb-2">Travel Date</th>
                          <th className="pb-2 text-right">Net Cost</th>
                          <th className="pb-2 text-right">Selling Price</th>
                          <th className="pb-2 text-right">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lead.requestedProducts.map(prod => (
                          <tr key={prod.id} className="hover:bg-slate-50">
                            <td className="py-2.5 font-bold text-slate-800 max-w-[200px]">
                              {prod.productName}
                              {prod.selectedAddonNames && prod.selectedAddonNames.length > 0 && (
                                <div className="text-[10px] text-slate-400 font-normal">
                                  + {prod.selectedAddonNames.join(', ')}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {prod.category}
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-600">{prod.city || prod.destinationName}</td>
                            <td className="py-2.5 text-slate-600">{prod.travelDate || 'Flexible'}</td>
                            <td className="py-2.5 text-right font-mono text-slate-600">
                              {prod.currency} {(prod.totalNetCost || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                              {prod.currency} {(prod.totalSellingPrice || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 text-right font-bold text-[#008f77]">
                              {prod.marginPercent ? `${prod.marginPercent}%` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: QUOTE & VERSION CONTROL */}
          {activeTab === 'quotes' && (
            <div className="space-y-4">
              {/* Active Snapshot */}
              {lead.quoteSnapshot && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                    Active Quotation Snapshot: #{lead.quoteSnapshot.quoteNumber} (v{lead.quoteSnapshot.version})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block">Total Net Cost</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {lead.quoteSnapshot.currency} {lead.quoteSnapshot.totalNetCost.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block">Margin Applied</span>
                      <span className="font-mono font-bold text-[#008f77] text-sm">
                        {lead.quoteSnapshot.marginPercent}% ({lead.quoteSnapshot.currency} {lead.quoteSnapshot.marginAmount.toLocaleString()})
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block">Selling Price</span>
                      <span className="font-mono font-black text-slate-900 text-base">
                        {lead.quoteSnapshot.currency} {lead.quoteSnapshot.finalSellingPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 block">Quote Status</span>
                      <span className="font-bold text-amber-700">{lead.quoteSnapshot.status}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Version History Log */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#00C6A6]" />
                  <span>Version Control & Modifications Log</span>
                </h3>

                {(!lead.quoteVersions || lead.quoteVersions.length === 0) ? (
                  <div className="text-slate-400 text-xs py-4 text-center">
                    Single version recorded (#{lead.quoteNumber || 'Initial Draft'}).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lead.quoteVersions.map(v => (
                      <div key={v.version} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900">
                            Version {v.version} • {new Date(v.createdAt).toLocaleString()}
                          </span>
                          <span className="font-mono font-bold text-[#008f77]">
                            {v.currency} {v.totalSellingPrice.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] mb-1">
                          Modified by: <strong>{v.createdBy}</strong> ({v.createdByUserType}) • {v.totalItems} Items
                        </p>
                        {v.changesSummary && (
                          <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 mt-1 font-mono text-[11px]">
                            {v.changesSummary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: ACTIVITY TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-[#00C6A6]" />
                <span>Customer Journey & Activity Timeline</span>
              </h3>

              {(!lead.timeline || lead.timeline.length === 0) ? (
                <div className="text-center py-6 text-slate-400 text-xs">No activity logged yet.</div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {lead.timeline.map((evt, idx) => (
                    <div key={evt.id || idx} className="relative group">
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#00C6A6] border-2 border-white shadow-xs" />
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-slate-900">{evt.title}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-600">{evt.description}</p>
                        <div className="text-[10px] text-slate-400 mt-1">
                          By: <strong className="text-slate-700">{evt.performedBy}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: TASKS & SALES FOLLOW-UPS */}
          {activeTab === 'followups' && (
            <div className="space-y-4">
              <LeadTasksSection
                lead={lead}
                currentUser={user}
                onNavigateToTasks={onNavigateToTasks}
              />
            </div>
          )}

          {/* TAB: NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Internal Operations Notes</h3>
                
                {/* Note input */}
                <form onSubmit={handleAddNote} className="space-y-2 mb-4">
                  <textarea
                    id="lead-new-note-textarea"
                    placeholder="Enter confidential internal operational note..."
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    rows={3}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-[#00C6A6]"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={e => setIsInternalNote(e.target.checked)}
                        className="rounded text-[#00C6A6] focus:ring-0"
                      />
                      <span>Internal staff note only</span>
                    </label>
                    <button
                      id="lead-save-note-btn"
                      type="submit"
                      disabled={!newNoteText.trim()}
                      className="bg-[#00C6A6] hover:bg-[#00b094] disabled:opacity-50 text-slate-950 font-bold px-4 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post Note</span>
                    </button>
                  </div>
                </form>

                {/* Notes List */}
                {(!lead.notes || lead.notes.length === 0) ? (
                  <div className="text-center py-6 text-slate-400 text-xs">No notes recorded yet.</div>
                ) : (
                  <div className="space-y-3">
                    {lead.notes.map((note: any, idx: number) => {
                      const noteId = note?.id || `note-${idx}`;
                      const author = typeof note === 'object' && note ? (note.authorName || 'Staff') : 'Staff';
                      const role = typeof note === 'object' && note ? note.authorRole : undefined;
                      const time = typeof note === 'object' && note?.timestamp ? new Date(note.timestamp).toLocaleString() : '';
                      const content = typeof note === 'object' && note ? (note.text || '') : String(note || '');
                      return (
                        <div key={noteId} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800">
                              {author} {role ? `(${role})` : ''}
                            </span>
                            {time && (
                              <span className="text-[10px] text-slate-400">
                                {time}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap">{content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00C6A6]" />
                <span>Commercial Documents & Generated PDFs</span>
              </h3>

              {(!lead.documents || lead.documents.length === 0) ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No documents attached yet. Documents are automatically linked when PDF quotes and vouchers are generated.
                </div>
              ) : (
                <div className="space-y-3">
                  {lead.documents.map(doc => (
                    <div key={doc.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-red-500" />
                        <div>
                          <span className="font-bold text-slate-900 block">{doc.title}</span>
                          <span className="text-[11px] text-slate-500">
                            Type: {doc.type} • {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-[11px] font-mono">
                        {doc.fileSize || 'PDF'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
