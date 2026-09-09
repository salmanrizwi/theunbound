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
  Check
} from 'lucide-react';
import { RecordReminderIndicator } from '../ActionCenter/RecordReminderIndicator';

interface LeadDetailDrawerProps {
  lead: TravelLead | null;
  onClose: () => void;
  onUpdateLead: (updatedLead: TravelLead) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onUpdateLead
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

  if (!lead) return null;

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
            { id: 'followups', label: `Follow-Ups (${lead.followUps?.length || 0})`, icon: Clock },
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

              {/* Brief Travel Requirements Overview */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Travel Requirements Summary</h3>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {lead.travelRequirements || 'Standard VIP ground arrangements requested.'}
                </p>
                {lead.specialRequests && (
                  <div className="mt-3">
                    <span className="text-xs font-bold text-amber-800 uppercase block mb-1">Special Dietary / VIP Requests:</span>
                    <p className="text-xs text-slate-700 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                      {lead.specialRequests}
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

          {/* TAB: FOLLOW-UPS & GOOGLE CALENDAR SLAS */}
          {activeTab === 'followups' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#00C6A6]" />
                      <span>Follow-Up Tasks & SLA Automations</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Syncs with Google Calendar to ensure zero missed client inquiries.
                    </p>
                  </div>
                  <button
                    id="add-followup-toggle-btn"
                    onClick={() => setShowAddFollowUp(!showAddFollowUp)}
                    className="bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule Follow-Up</span>
                  </button>
                </div>

                {/* Add Follow-Up Form */}
                {showAddFollowUp && (
                  <form onSubmit={handleAddFollowUp} className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase">New Follow-Up Task</h4>
                    <input
                      type="text"
                      placeholder="Task Title (e.g., Call client regarding ryokan allotment approval)..."
                      value={newFollowUpTitle}
                      onChange={e => setNewFollowUpTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-[#00C6A6]"
                      required
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-1">Due Date & Time</label>
                        <input
                          type="datetime-local"
                          value={newFollowUpDate}
                          onChange={e => setNewFollowUpDate(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-1">SLA Target (Hours)</label>
                        <input
                          type="number"
                          value={newFollowUpSla}
                          onChange={e => setNewFollowUpSla(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-semibold block mb-1">Assignee</label>
                        <input
                          type="text"
                          value={newFollowUpAssignee}
                          onChange={e => setNewFollowUpAssignee(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddFollowUp(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-bold bg-[#00C6A6] text-slate-950 rounded-lg hover:bg-[#00b094]"
                      >
                        Save Task
                      </button>
                    </div>
                  </form>
                )}

                {/* Follow Ups List */}
                {(!lead.followUps || lead.followUps.length === 0) ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No active follow-ups. Automated SLAs trigger on quote download (24h) and booking submission (12h).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lead.followUps.map(fu => {
                      const isCompleted = fu.status === 'COMPLETED';
                      return (
                        <div
                          key={fu.id}
                          className={`p-4 rounded-xl border transition-all text-xs ${
                            isCompleted ? 'bg-slate-50/60 border-slate-200 opacity-80' : 'bg-white border-amber-200 shadow-xs'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {fu.status}
                                </span>
                                <span className="font-bold text-slate-900">{fu.title}</span>
                              </div>
                              <p className="text-slate-600">{fu.description}</p>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                                <span>Due: <strong className="text-slate-800">{new Date(fu.dueAt).toLocaleString()}</strong></span>
                                <span>Assigned to: <strong className="text-slate-800">{fu.assignedToName}</strong></span>
                                {fu.googleCalendarLink && (
                                  <a
                                    href={fu.googleCalendarLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Google Calendar Event
                                  </a>
                                )}
                              </div>
                            </div>

                            {!isCompleted && (
                              <button
                                id={`complete-followup-${fu.id}`}
                                onClick={() => handleCompleteFollowUp(fu.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark Done</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
                    {lead.notes.map(note => (
                      <div key={note.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800">
                            {note.authorName} {note.authorRole ? `(${note.authorRole})` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(note.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{note.text}</p>
                      </div>
                    ))}
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
