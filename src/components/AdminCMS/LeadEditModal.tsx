import React, { useState, useEffect } from 'react';
import { TravelLead, LeadStatus, LeadPriority, LeadSource } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { X, Save, User, Mail, Phone, Building, MapPin, Calendar, DollarSign, Plus, UserCheck, ShieldCheck, AlertTriangle } from 'lucide-react';

interface LeadEditModalProps {
  lead: Partial<TravelLead> | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (lead: TravelLead) => void;
}

export const LeadEditModal: React.FC<LeadEditModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSaved
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [formData, setFormData] = useState<Partial<TravelLead>>(() => lead || {});

  useEffect(() => {
    if (lead) {
      setFormData({ ...lead });
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  const destinations = [
    { id: 'japan', name: 'Japan' },
    { id: 'united-kingdom', name: 'United Kingdom' },
    { id: 'france', name: 'France' },
    { id: 'italy', name: 'Italy' },
    { id: 'switzerland', name: 'Switzerland' },
    { id: 'united-states', name: 'United States' },
    { id: 'indonesia', name: 'Indonesia (Bali)' },
    { id: 'thailand', name: 'Thailand' },
    { id: 'united-arab-emirates', name: 'UAE (Dubai & Abu Dhabi)' }
  ];

  // Approved B2B partner agents
  const b2bAgents = React.useMemo(() => {
    return db.getUsers().filter(u => u.role === 'B2B_AGENT' && u.approvalStatus === 'APPROVED');
  }, [db]);

  // Internal operations & sales staff members
  const internalStaffList = React.useMemo(() => {
    const preset = [
      { id: 'staff-01', name: 'Marcus Vance (Senior Ops)', email: 'business@theunbound.in', dept: 'OPERATIONS' as const },
      { id: 'staff-02', name: 'Kenji Takahashi (Japan Ground Lead)', email: 'kenji@theunbound.in', dept: 'SALES' as const },
      { id: 'staff-03', name: 'Elena Rostova (B2B Concierge)', email: 'elena@theunbound.in', dept: 'SALES' as const },
      { id: 'staff-04', name: 'Aarav Patel (Client Success)', email: 'aarav@theunbound.in', dept: 'MANAGEMENT' as const }
    ];
    const dbStaff = db.getUsers()
      .filter(u => (u.role === 'ADMIN' || u.role === 'DMC_STAFF' || u.role === 'TEAM_MEMBER') && !preset.some(p => p.id === u.id || p.email === u.email))
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        dept: ((u as any).department || 'SALES') as 'SALES' | 'OPERATIONS' | 'MANAGEMENT'
      }));
    return [...preset, ...dbStaff];
  }, [db]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactName || !formData.email) return;

    // Resolve authoritative staff & agent
    const selectedStaff = internalStaffList.find(s => s.id === formData.assignedTeamMemberId || s.id === formData.assignedStaffId);
    const selectedAgent = b2bAgents.find(a => a.id === formData.responsibleAgentId || a.id === formData.assignedAgentId);

    const fullLead: TravelLead = {
      id: formData.id || `lead-${Date.now()}`,
      leadNumber: formData.leadNumber || `LED-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      contactName: formData.contactName,
      email: formData.email,
      phone: formData.phone || '',
      country: formData.country || 'Global',
      agencyName: formData.agencyName || selectedAgent?.agencyName || selectedAgent?.companyName,
      companyName: formData.companyName || formData.agencyName || selectedAgent?.companyName || selectedAgent?.agencyName,
      userId: formData.userId,
      userType: formData.userType || (formData.responsibleAgentId ? 'B2B_AGENT' : 'BUYER'),
      b2bAgentId: formData.responsibleAgentId || formData.b2bAgentId,
      source: formData.source || 'WEBSITE',
      campaignName: formData.campaignName,
      status: formData.status || 'NEW',
      priority: formData.priority || 'NORMAL',

      // Mandatory Commercial B2B Agent (authoritative)
      responsibleAgentId: formData.responsibleAgentId || selectedAgent?.id,
      responsibleAgentNameSnapshot: formData.responsibleAgentNameSnapshot || selectedAgent?.name,
      responsibleAgentEmailSnapshot: formData.responsibleAgentEmailSnapshot || selectedAgent?.email,
      responsibleAgencyNameSnapshot: formData.responsibleAgencyNameSnapshot || selectedAgent?.agencyName || selectedAgent?.companyName,
      submittingAgentId: formData.submittingAgentId || formData.responsibleAgentId || selectedAgent?.id,
      submittingAgentNameSnapshot: formData.submittingAgentNameSnapshot || formData.responsibleAgentNameSnapshot || selectedAgent?.name,

      // Legacy Agent support
      assignedAgentId: formData.responsibleAgentId || selectedAgent?.id || formData.assignedAgentId,
      assignedAgentNameSnapshot: formData.responsibleAgentNameSnapshot || selectedAgent?.name || formData.assignedAgentNameSnapshot,
      assignedAgentEmailSnapshot: formData.responsibleAgentEmailSnapshot || selectedAgent?.email || formData.assignedAgentEmailSnapshot,
      assignedAgentAgencySnapshot: formData.responsibleAgencyNameSnapshot || selectedAgent?.agencyName || selectedAgent?.companyName || formData.assignedAgentAgencySnapshot,

      // Mandatory Internal Team Member (authoritative)
      assignedTeamMemberId: formData.assignedTeamMemberId || selectedStaff?.id || user?.id || 'staff-01',
      assignedTeamMemberNameSnapshot: formData.assignedTeamMemberNameSnapshot || selectedStaff?.name || user?.name || 'Marcus Vance (Senior Ops)',
      assignedTeamMemberEmailSnapshot: formData.assignedTeamMemberEmailSnapshot || selectedStaff?.email || user?.email || 'business@theunbound.in',
      assignedTeamMemberDepartment: formData.assignedTeamMemberDepartment || selectedStaff?.dept || 'SALES',

      // Legacy Staff support
      assignedStaffId: formData.assignedTeamMemberId || selectedStaff?.id || user?.id || 'staff-01',
      assignedStaffName: formData.assignedTeamMemberNameSnapshot || selectedStaff?.name || user?.name || 'Marcus Vance (Senior Ops)',
      assignedStaffEmail: formData.assignedTeamMemberEmailSnapshot || selectedStaff?.email || user?.email || 'business@theunbound.in',
      assignedDepartment: formData.assignedTeamMemberDepartment || selectedStaff?.dept || 'SALES',

      destinationId: formData.destinationId || 'japan',
      destinationName: formData.destinationName || 'Japan',
      travelDates: formData.travelDates || 'Autumn 2026',
      travelStartDate: formData.travelStartDate,
      travelEndDate: formData.travelEndDate,
      numberOfNights: Number(formData.numberOfNights || 7),
      paxAdults: Number(formData.paxAdults || 2),
      paxChildren: Number(formData.paxChildren || 0),
      paxInfants: Number(formData.paxInfants || 0),
      totalPassengers: Number(formData.paxAdults || 2) + Number(formData.paxChildren || 0) + Number(formData.paxInfants || 0),
      roomsCount: Number(formData.roomsCount || 1),
      roomOccupancy: formData.roomOccupancy || 'Double / Twin',
      mealPlan: formData.mealPlan || 'Daily Breakfast',
      hotelPreferences: formData.hotelPreferences,
      transportPreferences: formData.transportPreferences,
      activityPreferences: formData.activityPreferences,
      specialRequests: formData.specialRequests,
      estimatedBudget: Number(formData.estimatedBudget || 5000),
      currency: formData.currency || 'USD',
      travelRequirements: formData.travelRequirements || '',
      notes: formData.notes || [],
      timeline: formData.timeline || [],
      followUps: formData.followUps || [],
      requestedProducts: formData.requestedProducts || [],
      documents: formData.documents || [],
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = db.saveLead(fullLead, user);
    onSaved(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full max-h-[94dvh] sm:max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-white text-slate-800 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div>
            <span className="text-[#008972] text-[10px] sm:text-xs font-bold uppercase tracking-wider block">
              Lead Management CRM
            </span>
            <h2 className="text-base sm:text-xl font-bold text-slate-900">
              {formData.id && formData.contactName ? `Edit Lead: ${formData.contactName}` : 'Capture New Travel Lead'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 bg-slate-50/50 modal-body-scroll text-xs">
          {/* Section 1: Customer Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Contact & Commercial Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={formData.contactName || ''}
                  onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="e.g. Alistair Montgomery"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="client@agency.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+44 20 7946 0912"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Agency / Company Name</label>
                <input
                  type="text"
                  value={formData.agencyName || ''}
                  onChange={e => setFormData({ ...formData, agencyName: e.target.value })}
                  placeholder="Montgomery Luxury Journeys"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Lead Source</label>
                <select
                  value={formData.source || 'WEBSITE'}
                  onChange={e => setFormData({ ...formData, source: e.target.value as LeadSource })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  <option value="WEBSITE">Website Form</option>
                  <option value="B2B_PARTNER">B2B Agent Partner</option>
                  <option value="PROPOSAL_DOWNLOADED">Quote PDF Download</option>
                  <option value="QUOTATION_SAVED">Quotation Saved</option>
                  <option value="BOOKING_SUBMISSION">Direct Booking Submission</option>
                  <option value="PACKAGE_INQUIRY">Package Landing Inquiry</option>
                  <option value="MARKETING_CAMPAIGN">Marketing Campaign</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Priority</label>
                <select
                  value={formData.priority || 'NORMAL'}
                  onChange={e => setFormData({ ...formData, priority: e.target.value as LeadPriority })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent SLA</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Mandatory Dual Ownership */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#008f77]" />
                  <span>Mandatory Lead Ownership (Commercial Agent & Internal Lead Owner)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Every lead must have both an assigned commercial B2B agent and an assigned internal team member.
                </p>
              </div>
              {((formData.responsibleAgentId || formData.assignedAgentId) && (formData.assignedTeamMemberId || formData.assignedStaffId)) ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0 self-start sm:self-auto">
                  ✓ Dual Ownership Active
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0 self-start sm:self-auto">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>Assignment Incomplete</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* 1. Commercial Relationship: Responsible B2B Agent */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Commercial B2B Partner Agent</span>
                  </span>
                  <span className="text-[10px] text-indigo-600 font-bold uppercase">Commercial Owner</span>
                </label>
                <select
                  value={formData.responsibleAgentId || formData.assignedAgentId || ''}
                  onChange={e => {
                    const agentId = e.target.value;
                    const ag = b2bAgents.find(a => a.id === agentId);
                    setFormData({
                      ...formData,
                      responsibleAgentId: agentId || undefined,
                      responsibleAgentNameSnapshot: ag?.name,
                      responsibleAgentEmailSnapshot: ag?.email,
                      responsibleAgencyNameSnapshot: ag?.agencyName || ag?.companyName,
                      assignedAgentId: agentId || undefined,
                      assignedAgentNameSnapshot: ag?.name,
                      assignedAgentEmailSnapshot: ag?.email,
                      assignedAgentAgencySnapshot: ag?.agencyName || ag?.companyName,
                      submittingAgentId: formData.submittingAgentId || agentId || undefined,
                      submittingAgentNameSnapshot: formData.submittingAgentNameSnapshot || ag?.name
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                >
                  <option value="">-- Direct Lead / No Commercial Agent --</option>
                  {b2bAgents.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.agencyName || ag.companyName || 'Independent'}) - {ag.email}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 leading-normal">
                  The authoritative B2B Agent who commercially owns the client relationship and is granted visibility in the Agent Portal.
                </p>
              </div>

              {/* 2. Operational Processing: Assigned Internal Team Member */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-[#008f77]" />
                    <span>Assigned Internal Team Member</span>
                  </span>
                  <span className="text-[10px] text-[#008f77] font-bold uppercase">Operational Owner</span>
                </label>
                <select
                  value={formData.assignedTeamMemberId || formData.assignedStaffId || 'staff-01'}
                  onChange={e => {
                    const staffId = e.target.value;
                    const st = internalStaffList.find(s => s.id === staffId);
                    setFormData({
                      ...formData,
                      assignedTeamMemberId: staffId,
                      assignedTeamMemberNameSnapshot: st?.name,
                      assignedTeamMemberEmailSnapshot: st?.email,
                      assignedTeamMemberDepartment: st?.dept,
                      assignedStaffId: staffId,
                      assignedStaffName: st?.name,
                      assignedStaffEmail: st?.email,
                      assignedDepartment: st?.dept
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                >
                  {internalStaffList.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.dept})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 leading-normal">
                  The internal team member responsible for quoting, itineraries, ground operations, and conversion.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Travel Requirements */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Destination & Travel Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Destination</label>
                <select
                  value={formData.destinationId || 'japan'}
                  onChange={e => {
                    const dest = destinations.find(d => d.id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      destinationId: e.target.value,
                      destinationName: dest?.name || 'Japan'
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                >
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Travel Dates / Window</label>
                <input
                  type="text"
                  value={formData.travelDates || ''}
                  onChange={e => setFormData({ ...formData, travelDates: e.target.value })}
                  placeholder="2026-10-12 to 2026-10-24"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Estimated Budget</label>
                <div className="flex gap-2">
                  <select
                    value={formData.currency || 'USD'}
                    onChange={e => setFormData({ ...formData, currency: e.target.value as any })}
                    className="w-20 px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="INR">INR</option>
                    <option value="AED">AED</option>
                  </select>
                  <input
                    type="number"
                    value={formData.estimatedBudget || 5000}
                    onChange={e => setFormData({ ...formData, estimatedBudget: Number(e.target.value) })}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Adults</label>
                <input
                  type="number"
                  min={1}
                  value={formData.paxAdults || 2}
                  onChange={e => setFormData({ ...formData, paxAdults: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Children</label>
                <input
                  type="number"
                  min={0}
                  value={formData.paxChildren || 0}
                  onChange={e => setFormData({ ...formData, paxChildren: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Number of Nights</label>
                <input
                  type="number"
                  min={1}
                  value={formData.numberOfNights || 7}
                  onChange={e => setFormData({ ...formData, numberOfNights: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1 text-xs">Detailed Travel Requirements & Itinerary Notes</label>
              <textarea
                rows={3}
                value={formData.travelRequirements || ''}
                onChange={e => setFormData({ ...formData, travelRequirements: e.target.value })}
                placeholder="Private luxury ground transport, 5-star ryokans, private local tour guides..."
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
          </div>
        </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 sm:gap-3 p-4 sm:px-6 py-3 border-t border-slate-200 bg-white shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center"
            >
              <Save className="w-4 h-4" />
              <span>Save Lead Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
