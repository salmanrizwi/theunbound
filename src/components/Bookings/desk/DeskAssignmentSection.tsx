import React, { useState, useMemo } from 'react';
import { Booking, User, BookingAssignmentStatus } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { isInternalStaff } from '../../../services/permissionEngine';
import { 
  UserCheck, 
  UserPlus, 
  Building2, 
  ShieldCheck, 
  History, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  User as UserIcon, 
  Briefcase, 
  FileText, 
  Mail, 
  Phone,
  RotateCcw,
  Info,
  X
} from 'lucide-react';

interface DeskAssignmentSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskAssignmentSection: React.FC<DeskAssignmentSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const isInternal = isInternalStaff(currentUser);

  // Modals state
  const [isAssignAgentModalOpen, setIsAssignAgentModalOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agentAssignmentNotes, setAgentAssignmentNotes] = useState('');

  const [isAssignTeamModalOpen, setIsAssignTeamModalOpen] = useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState('');
  const [teamMemberNotes, setTeamMemberNotes] = useState('');

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Master Users
  const b2bAgents = useMemo(() => {
    return db.getUsers().filter(u => u.role === 'B2B_AGENT' && u.approvalStatus === 'APPROVED');
  }, [db]);

  const internalTeamMembers = useMemo(() => {
    return db.getUsers().filter(u => u.role !== 'B2B_AGENT' && u.role !== 'BUYER');
  }, [db]);

  // Derived assignment state
  const assignmentStatus: BookingAssignmentStatus = booking.assignmentStatus || 
    (!booking.assignedTeamMemberId ? 'pending_internal_assignment' : 
     (!booking.agentId && !booking.submittingAgentId ? 'pending_agent_assignment' : 'assigned'));

  const assignedAgent = b2bAgents.find(a => a.id === (booking.agentId || booking.submittingAgentId || booking.assignedAgentId));
  const assignedTeamMember = internalTeamMembers.find(t => t.id === booking.assignedTeamMemberId);

  const handleAssignAgent = () => {
    if (!selectedAgentId) return;
    try {
      db.assignBookingToAgent(booking.id, selectedAgentId, currentUser);
      setIsAssignAgentModalOpen(false);
      setSelectedAgentId('');
      setAgentAssignmentNotes('');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to assign B2B Agent to booking');
    }
  };

  const handleUnassignAgent = () => {
    if (!window.confirm('Are you sure you want to unassign this B2B Agent? The booking will no longer appear in their portal.')) return;
    try {
      db.unassignBooking(booking.id, currentUser, 'Unassigned from Assignment & Ownership desk');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to unassign agent');
    }
  };

  const handleAssignTeamMember = () => {
    if (!selectedTeamMemberId) return;
    try {
      db.assignBookingInternalTeamMember(booking.id, selectedTeamMemberId, currentUser, teamMemberNotes);
      setIsAssignTeamModalOpen(false);
      setSelectedTeamMemberId('');
      setTeamMemberNotes('');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to assign internal operational owner');
    }
  };

  const handleUnassignTeamMember = () => {
    if (!window.confirm('Are you sure you want to remove the operational owner? This will flag the booking as pending internal assignment.')) return;
    try {
      db.unassignBookingTeamMember(booking.id, currentUser, 'Unassigned operational owner');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to unassign team member');
    }
  };

  return (
    <div id="desk-assignment-section" className="space-y-6">
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 rounded-lg">
            <X className="w-4 h-4 text-rose-500" />
          </button>
        </div>
      )}

      {/* Top Banner with Assignment Status */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Ownership & SLA Responsibility
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs text-slate-500 font-bold">
              Ref: {booking.bookingReference}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Booking Assignment & Governance
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Every ground booking strictly links a verified B2B Agent partner with an assigned Internal Team Member responsible for SLA adherence, supplier fulfillment, and dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Governance Status</span>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border mt-0.5 ${
              assignmentStatus === 'assigned'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : assignmentStatus === 'reassigned'
                ? 'bg-purple-50 text-purple-800 border-purple-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {assignmentStatus === 'assigned' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              {assignmentStatus === 'reassigned' && <RotateCcw className="w-3.5 h-3.5 text-purple-600" />}
              {assignmentStatus === 'pending_internal_assignment' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
              {assignmentStatus === 'pending_agent_assignment' && <UserPlus className="w-3.5 h-3.5 text-amber-600" />}
              <span className="capitalize">{assignmentStatus.replace(/_/g, ' ')}</span>
            </span>
          </div>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="View Assignment History"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Audit Log</span>
          </button>
        </div>
      </div>

      {/* Two Pillars Grid: B2B Agent + Internal Operational Owner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pillar 1: B2B Agent Partner Association */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">B2B Agent Association</h3>
                <p className="text-[11px] text-slate-400">Commercial buyer & client coordinator</p>
              </div>
            </div>

            {isInternal && (
              <button
                onClick={() => {
                  setSelectedAgentId(booking.agentId || booking.submittingAgentId || '');
                  setIsAssignAgentModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-teal-200"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{booking.agentId || booking.submittingAgentId ? 'Reassign Agent' : 'Assign Agent'}</span>
              </button>
            )}
          </div>

          {booking.agentId || booking.submittingAgentId || booking.agentNameSnapshot ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Agency / Partner</span>
                    <span className="text-sm font-black text-slate-900">
                      {booking.agentAgencySnapshot || booking.agencyName || assignedAgent?.agencyName || 'Independent Travel Partner'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Active Partner
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
                  <div className="flex items-center gap-2 text-slate-700">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-bold truncate">
                      {booking.agentNameSnapshot || booking.agentName || assignedAgent?.name || 'Verified Agent'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{booking.agentEmailSnapshot || assignedAgent?.email || 'N/A'}</span>
                  </div>
                </div>

                {assignedAgent?.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{assignedAgent.phone}</span>
                  </div>
                )}
              </div>

              {/* Submitting vs Assigned Notes */}
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Submitting Agent:</span>
                  <span className="font-semibold text-slate-800">
                    {booking.submittingAgentNameSnapshot || booking.agentName || 'Original Submitter Preserved'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Agent Portal Visibility:</span>
                  <span className="font-semibold text-emerald-700">VISIBLE (Authorised)</span>
                </div>
              </div>

              {isInternal && (
                <div className="pt-2">
                  <button
                    onClick={handleUnassignAgent}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                  >
                    Unassign B2B Agent from Booking
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-amber-50/60 border border-amber-200 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <div>
                <h4 className="text-xs font-black text-amber-900">No B2B Agent Assigned</h4>
                <p className="text-[11px] text-amber-700 max-w-sm mx-auto mt-0.5">
                  This booking was booked directly or is pending B2B partner linking. Assign an agent to enable wholesale partner visibility.
                </p>
              </div>
              {isInternal && (
                <button
                  onClick={() => setIsAssignAgentModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-all shadow-xs inline-flex items-center"
                >
                  Assign B2B Agent Now
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pillar 2: Assigned Internal Team Member (Operational Owner) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Assigned Operational Owner</h3>
                <p className="text-[11px] text-slate-400">Internal Team Member responsible for dispatch & SLA</p>
              </div>
            </div>

            {isInternal && (
              <button
                onClick={() => {
                  setSelectedTeamMemberId(booking.assignedTeamMemberId || '');
                  setIsAssignTeamModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-blue-200"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{booking.assignedTeamMemberId ? 'Reassign Owner' : 'Assign Owner'}</span>
              </button>
            )}
          </div>

          {booking.assignedTeamMemberId || booking.assignedTeamMemberNameSnapshot ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Operational Lead</span>
                    <span className="text-sm font-black text-slate-900">
                      {booking.assignedTeamMemberNameSnapshot || booking.assignedTeamMemberName || assignedTeamMember?.name || 'Staff Member'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                    Operations Desk
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {booking.assignedTeamMemberEmailSnapshot || assignedTeamMember?.email || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Assigned: {booking.assignedAt ? new Date(booking.assignedAt).toLocaleDateString() : 'Active'}</span>
                  </div>
                </div>

                {booking.assignmentNotes && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Handover Notes:</span>
                    <p className="italic">"{booking.assignmentNotes}"</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Assigned By:</span>
                  <span className="font-semibold text-slate-800">
                    {booking.assignedByUserNameSnapshot || 'System Administrator'}
                  </span>
                </div>
                {booking.lastReassignedAt && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Last Reassigned:</span>
                    <span className="font-semibold text-purple-700">
                      {new Date(booking.lastReassignedAt).toLocaleDateString()} by {booking.lastReassignedByUserNameSnapshot || 'Admin'}
                    </span>
                  </div>
                )}
              </div>

              {isInternal && (
                <div className="pt-2">
                  <button
                    onClick={handleUnassignTeamMember}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                  >
                    Release Operational Ownership
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-amber-50/60 border border-amber-200 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <div>
                <h4 className="text-xs font-black text-amber-900">Unassigned Operational Owner</h4>
                <p className="text-[11px] text-amber-700 max-w-sm mx-auto mt-0.5">
                  This booking has no dedicated team member assigned for SLA adherence and dispatch tracking.
                </p>
              </div>
              {isInternal && (
                <button
                  onClick={() => setIsAssignTeamModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-all shadow-xs inline-flex items-center"
                >
                  Claim / Assign Owner Now
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Governance & Rules Box */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-slate-800">Operational Ownership Rules</h4>
          <p className="text-[11px] leading-relaxed">
            The assigned internal team member is the operational owner responsible for supplier reconfirmations within the 12-hour SLA window, vouchers dispatch, and balance settlements. B2B Agents can view approved booking statuses but cannot reassign internal personnel or amend locked ground reservations.
          </p>
        </div>
      </div>

      {/* MODAL 1: Assign B2B Agent */}
      {isAssignAgentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-600" />
                Assign B2B Agent Partner
              </h3>
              <button onClick={() => setIsAssignAgentModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Approved B2B Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- Choose Agent --</option>
                  {b2bAgents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.agencyName || 'Agency'}) • {a.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assignment / Commission Notes (Optional)</label>
                <textarea
                  value={agentAssignmentNotes}
                  onChange={e => setAgentAssignmentNotes(e.target.value)}
                  placeholder="e.g. Assigned per partner phone confirmation..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-teal-500 h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsAssignAgentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignAgent}
                disabled={!selectedAgentId}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Confirm Agent Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Assign Internal Team Member */}
      {isAssignTeamModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                Assign Operational Owner
              </h3>
              <button onClick={() => setIsAssignTeamModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Internal Staff Member</label>
                <select
                  value={selectedTeamMemberId}
                  onChange={e => setSelectedTeamMemberId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Team Member --</option>
                  {internalTeamMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role}) • {m.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Operational Handover Notes</label>
                <textarea
                  value={teamMemberNotes}
                  onChange={e => setTeamMemberNotes(e.target.value)}
                  placeholder="e.g. VIP client traveling next week. Hotel allotment already held under ref #9041..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-blue-500 h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsAssignTeamModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTeamMember}
                disabled={!selectedTeamMemberId}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Confirm Ownership Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Assignment History Audit */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700" />
                Assignment & Ownership History Log
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {booking.assignmentHistory && booking.assignmentHistory.length > 0 ? (
                booking.assignmentHistory.map((h, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{h.action || 'Assignment Event'}</span>
                      <span className="text-[10px] text-slate-400">
                        {h.timestamp ? new Date(h.timestamp).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      <strong>Assigned To:</strong> {h.assignedToUserNameSnapshot || h.assignedToStaffName || 'Internal Member'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      <strong>Assigned By:</strong> {h.assignedByUserNameSnapshot || 'Administrator'}
                    </p>
                    {h.notes && (
                      <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-xl border border-slate-100 mt-1">
                        "{h.notes}"
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 space-y-2">
                  <History className="w-6 h-6 text-slate-300 mx-auto" />
                  <p>Initial assignment record established upon booking creation.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-right shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
