import React, { useState } from 'react';
import { Booking, User, BookingStatus } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { formatCurrency } from '../../../services/pricingEngine';
import { isInternalStaff, isExternalUser, canEditSubmittedBooking } from '../../../services/permissionEngine';
import { 
  Calendar, 
  Users, 
  CreditCard, 
  Building2, 
  User as UserIcon, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  ArrowRight, 
  Plane, 
  ShieldCheck, 
  Edit3, 
  CheckSquare, 
  FileCheck2,
  DollarSign,
  TrendingUp,
  Lock,
  X,
  History,
  UserCheck,
  UserPlus
} from 'lucide-react';

interface DeskOverviewSectionProps {
  booking: Booking;
  currentUser: User | null;
  onNavigateToSection: (section: any) => void;
  onRefresh: () => void;
}

export const DeskOverviewSection: React.FC<DeskOverviewSectionProps> = ({
  booking,
  currentUser,
  onNavigateToSection,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();

  const isInternal = isInternalStaff(currentUser);
  const isExternal = isExternalUser(currentUser);
  const isSubmitted = booking.status !== 'DRAFT';

  // Calculation helpers
  const paymentSummary = db.calculateBookingPaymentSummary(booking);
  const percentagePaid = paymentSummary.totalAmount > 0 
    ? (paymentSummary.paidAmount / paymentSummary.totalAmount) * 100 
    : 0;
  const readiness = db.checkBookingConfirmationReadiness(booking);
  const bookingTasks = db.getTasksForBooking(booking.id);
  const openTasks = bookingTasks.filter(t => t.status !== 'COMPLETED');
  
  const totalItems = booking.items?.length || 0;
  const allocatedItems = booking.items?.filter(it => Boolean(it.supplierId || it.supplierName)).length || 0;
  const confirmedItems = booking.items?.filter(it => it.supplierConfirmationStatus === 'Confirmed').length || 0;

  const maxPax = (booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) || 
    booking.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) || 1;
  const registeredPax = booking.passengers?.length || 0;

  // Travel Dates Edit Modal State
  const [isDatesModalOpen, setIsDatesModalOpen] = useState(false);
  const [editStartDate, setEditStartDate] = useState(booking.travelStartDate || '');
  const [editEndDate, setEditEndDate] = useState(booking.travelEndDate || '');
  const [dateChangeReason, setDateChangeReason] = useState('');

  // Status Change State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<BookingStatus>(booking.status);
  const [statusReason, setStatusReason] = useState('');

  // B2B Agent Booking Assignment State
  const [selectedBookingAgentId, setSelectedBookingAgentId] = useState('');
  const [isAssigningBookingAgent, setIsAssigningBookingAgent] = useState(false);

  // Internal Team Member Operational Owner Assignment State
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState('');
  const [teamMemberNotes, setTeamMemberNotes] = useState('');
  const [isAssigningTeamMember, setIsAssigningTeamMember] = useState(false);
  const [showAssignmentHistoryModal, setShowAssignmentHistoryModal] = useState(false);

  const b2bAgents = React.useMemo(() => {
    return db.getUsers().filter(u => u.role === 'B2B_AGENT' && u.approvalStatus === 'APPROVED');
  }, [db]);

  const internalTeamMembers = React.useMemo(() => {
    return db.getUsers().filter(u => u.role !== 'B2B_AGENT' && u.role !== 'BUYER');
  }, [db]);

  const handleAssignBookingAgent = () => {
    if (!selectedBookingAgentId) return;
    try {
      db.assignBookingToAgent(booking.id, selectedBookingAgentId, currentUser);
      setIsAssigningBookingAgent(false);
      setSelectedBookingAgentId('');
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to assign agent to booking');
    }
  };

  const handleUnassignBookingAgent = () => {
    if (!window.confirm('Are you sure you want to unassign this B2B Agent from this booking? The booking will no longer be visible to them in their portal.')) return;
    db.unassignBooking(booking.id, currentUser, 'Unassigned from Operations Desk');
    onRefresh();
  };

  const handleAssignTeamMember = () => {
    if (!selectedTeamMemberId) return;
    try {
      db.assignBookingInternalTeamMember(booking.id, selectedTeamMemberId, currentUser, teamMemberNotes);
      setIsAssigningTeamMember(false);
      setSelectedTeamMemberId('');
      setTeamMemberNotes('');
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to assign internal team member');
    }
  };

  const handleUnassignTeamMember = () => {
    if (!window.confirm('Are you sure you want to unassign the operational owner? The booking will be marked as Pending Internal Assignment.')) return;
    try {
      db.unassignBookingTeamMember(booking.id, currentUser, 'Unassigned from Operations Desk');
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to unassign operational owner');
    }
  };

  // Save Booking Travel Dates (Authoritative)
  const handleSaveTravelDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStartDate || !editEndDate) return;

    const all = db.getAllBookings();
    const b = all.find(item => item.id === booking.id);
    if (!b) return;

    const prevStart = b.travelStartDate;
    const prevEnd = b.travelEndDate;
    b.travelStartDate = editStartDate;
    b.travelEndDate = editEndDate;
    b.updatedAt = new Date().toISOString();

    db.recordBookingActivity({
      eventId: `act-${Date.now()}`,
      bookingId: b.id,
      eventType: 'OTHER',
      previousValue: `${prevStart} to ${prevEnd}`,
      newValue: `${editStartDate} to ${editEndDate}`,
      actorId: currentUser?.id || 'staff',
      actorRole: currentUser?.role || 'TEAM_MEMBER',
      actorName: currentUser?.displayName || currentUser?.name || 'Operations Lead',
      timestamp: new Date().toISOString(),
      description: `Travel dates updated from ${prevStart} - ${prevEnd} to ${editStartDate} - ${editEndDate}. Reason: ${dateChangeReason || 'Schedule adjustment'}`
    }, currentUser);

    db.saveBooking(b, currentUser);
    setIsDatesModalOpen(false);
    onRefresh();
  };

  // Save Status Change
  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatus === 'CONFIRMED' && !readiness.canConfirm) {
      alert(`Cannot confirm booking: ${(readiness.blockingReasons || []).join(', ')}`);
      return;
    }

    db.updateBookingStatus(booking.id, newStatus, currentUser);
    setIsStatusModalOpen(false);
    onRefresh();
  };

  return (
    <div id="desk-overview-section" className="space-y-6">
      {/* 0. B2B AGENT SUBMITTED READ-ONLY BANNER */}
      {isExternal && isSubmitted && (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-700 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-sky-900">
                Submitted Booking (Read-Only)
              </h4>
              <p className="text-xs text-sky-800 mt-0.5">
                This booking has been submitted and is now read-only. Please contact the internal team if a correction is required.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToSection('PASSENGERS')}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer self-start sm:self-center flex items-center gap-1.5"
          >
            <span>Upload Documents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. KEY OPERATIONAL READINESS / DOCUMENTATION BANNER */}
      {isInternal && !readiness.canConfirm && booking.status !== 'CONFIRMED' && booking.status !== 'CANCELLED' && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-2xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-900">
                Action Items Required for Final Confirmation ({readiness.blockingReasons.length} Pending)
              </h4>
              <ul className="text-xs text-amber-800 mt-1.5 space-y-1 list-disc list-inside">
                {readiness.blockingReasons.map((reason, idx) => (
                  <li key={idx} className="leading-relaxed">{reason}</li>
                ))}
              </ul>
            </div>
          </div>
          <button
            onClick={() => {
              if (allocatedItems < totalItems) onNavigateToSection('SERVICES');
              else if (paymentSummary.paidAmount === 0) onNavigateToSection('PAYMENTS');
              else onNavigateToSection('PASSENGERS');
            }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5 self-start md:self-center transition-colors"
          >
            <span>Resolve Next Item</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* External User: Documentation Incomplete Banner */}
      {isExternal && registeredPax < maxPax && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                Passenger Documentation Required ({registeredPax}/{maxPax} Profiles Added)
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Please add all traveler details and upload passport and PAN copies to expedite confirmation.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToSection('PASSENGERS')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer self-start sm:self-center flex items-center gap-1.5"
          >
            <span>Manage Passengers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. PROGRESS METRICS GRID */}
      {isInternal ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Supplier Allocation Progress */}
          <div 
            onClick={() => onNavigateToSection('SERVICES')}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-teal-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Supplier Allocation</span>
              <span className="p-1.5 rounded-xl bg-teal-50 text-[#008f77] group-hover:bg-[#008f77] group-hover:text-white transition-colors">
                <Building2 className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{allocatedItems}</span>
              <span className="text-xs font-bold text-slate-400">/ {totalItems} Services</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-[#008f77] h-2 rounded-full transition-all duration-500"
                style={{ width: `${totalItems > 0 ? (allocatedItems / totalItems) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold block mt-2">
              {totalItems - allocatedItems === 0 ? 'All services allocated' : `${totalItems - allocatedItems} unallocated services`}
            </span>
          </div>

          {/* Confirmation Progress */}
          <div 
            onClick={() => onNavigateToSection('SERVICES')}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-emerald-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Supplier Confirmation</span>
              <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{confirmedItems}</span>
              <span className="text-xs font-bold text-slate-400">/ {totalItems} Confirmed</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${totalItems > 0 ? (confirmedItems / totalItems) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold block mt-2">
              {totalItems - confirmedItems === 0 ? '100% supplier confirmed' : `${totalItems - confirmedItems} pending confirmation`}
            </span>
          </div>

          {/* Payment Collection Progress */}
          <div 
            onClick={() => onNavigateToSection('PAYMENTS')}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Payments & Collection</span>
              <span className="p-1.5 rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CreditCard className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {formatCurrency(paymentSummary.paidAmount, booking.currency)}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  paymentSummary.pendingAmount <= 0 ? 'bg-emerald-600' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, percentagePaid)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold block mt-2">
              {paymentSummary.pendingAmount <= 0 
                ? 'Fully Settled' 
                : `Pending: ${formatCurrency(paymentSummary.pendingAmount, booking.currency)}`}
            </span>
          </div>

          {/* Tasks & Follow-Ups */}
          <div 
            onClick={() => onNavigateToSection('TASKS')}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-purple-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Tasks & Follow-Ups</span>
              <span className="p-1.5 rounded-xl bg-purple-50 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <CheckSquare className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{openTasks.length}</span>
              <span className="text-xs font-bold text-slate-400">Open ({bookingTasks.length} total)</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${bookingTasks.length > 0 ? ((bookingTasks.length - openTasks.length) / bookingTasks.length) * 100 : 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold block mt-2">
              {openTasks.length === 0 ? 'All tasks complete' : `${openTasks.length} action items pending`}
            </span>
          </div>
        </div>
      ) : (
        /* External B2B Agent Metrics Grid - Clean, commercial-free & documentation focused */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Booking Confirmation Status */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Booking Status</span>
              <span className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-slate-900">
                {booking.customerFacingStatus || (booking.status === 'CONFIRMED' ? 'Confirmed' : 'Processing')}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-bold block mt-3">
              Ref: <span className="font-mono text-slate-700">{booking.bookingReference || booking.id}</span>
            </span>
          </div>

          {/* Passenger Documentation Status */}
          <div 
            onClick={() => onNavigateToSection('PASSENGERS')}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-teal-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Passenger Manifest</span>
              <span className="p-1.5 rounded-xl bg-teal-50 text-[#008f77] group-hover:bg-[#008f77] group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{registeredPax}</span>
              <span className="text-xs font-bold text-slate-400">/ {maxPax} Passengers</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${registeredPax >= maxPax ? 'bg-emerald-600' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (registeredPax / Math.max(1, maxPax)) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold block mt-2">
              {registeredPax >= maxPax ? 'All passenger profiles added' : `${maxPax - registeredPax} profiles remaining`}
            </span>
          </div>

          {/* Client Selling Price & Payments */}
          <div 
            onClick={() => onNavigateToSection('PAYMENTS')}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Client Payments</span>
              <span className="p-1.5 rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CreditCard className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {formatCurrency(paymentSummary.paidAmount, booking.currency)}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  paymentSummary.pendingAmount <= 0 ? 'bg-emerald-600' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, percentagePaid)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold block mt-2">
              Total: {formatCurrency(paymentSummary.totalAmount, booking.currency)} ({percentagePaid.toFixed(0)}% paid)
            </span>
          </div>

          {/* Travel Dates & Destination */}
          <div 
            onClick={() => onNavigateToSection('SERVICES')}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-teal-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Trip Itinerary</span>
              <span className="p-1.5 rounded-xl bg-teal-50 text-[#008f77] group-hover:bg-[#008f77] group-hover:text-white transition-colors">
                <Plane className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2 truncate">
              <span className="text-base font-black text-slate-900 truncate">
                {booking.destinationName || booking.destination || 'Japan Tour'}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono block mt-2">
              {booking.travelStartDate || 'TBA'}
            </span>
            <span className="text-[10px] text-[#008f77] font-bold block mt-1">
              View Itinerary Services →
            </span>
          </div>
        </div>
      )}

      {/* 3. CORE DETAILS & STAKEHOLDERS (3 COLUMNS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Customer & Guest Contacts */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
                <UserIcon className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Customer & Guests
              </h3>
            </div>
            <button
              onClick={() => onNavigateToSection('PASSENGERS')}
              className="text-[11px] font-bold text-[#008f77] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Manifest</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Lead Traveler</span>
              <span className="font-bold text-slate-900 text-sm">
                {booking.customer?.leadTravelerName || 'Guest'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Phone</span>
                <span className="font-mono">{booking.customer?.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Email</span>
                <span className="truncate block font-mono">{booking.customer?.email || 'N/A'}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600">
              <span>Registered Pax: <strong>{registeredPax} / {maxPax}</strong></span>
              <span className="text-[11px] font-bold text-slate-500">
                {booking.customer?.totalAdults || 1}A • {booking.customer?.totalChildren || 0}C
              </span>
            </div>
          </div>
        </div>

        {/* B2B Agent & Booking Origin */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Channel & Origin
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
              {booking.sourceType || booking.source || 'MANUAL'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Submitting Channel / Partner</span>
              <span className="font-bold text-slate-900 text-sm">
                {booking.submittingAgentAgencySnapshot || booking.agencyName || booking.submittingAgentNameSnapshot || booking.agentName || 'Direct VIP Client'}
              </span>
              {booking.submittingAgentNameSnapshot && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Submitted by: <strong>{booking.submittingAgentNameSnapshot}</strong>
                  {booking.submittedByUserId && <span className="font-mono text-[10px] ml-1">({booking.submittedByUserId})</span>}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Agent Contact</span>
                <span>{booking.customer?.bookerName || booking.agentName || 'Direct Booker'}</span>
              </div>
              {isInternal && (
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Linked Lead</span>
                  <span className="font-mono text-[#008f77] font-bold">
                    {booking.leadNumber || booking.leadId || 'Direct'}
                  </span>
                </div>
              )}
            </div>

            {/* B2B Agent Portal Visibility & Assignment (Internal Staff Only) */}
            {isInternal && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Portal Assigned Agent</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                    booking.assignedAgentId 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {booking.assignedAgentId ? 'Visible in Agent Portal' : (booking.submittedByUserId ? 'Visible (Submitter)' : 'Internal Only')}
                  </span>
                </div>

                {booking.assignedAgentId ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-emerald-950 block">
                        {booking.assignedAgentNameSnapshot || 'Partner Agent'}
                      </span>
                      <span className="text-[10px] text-emerald-700 block">
                        Agency: {booking.assignedAgentAgencySnapshot || 'B2B Partner'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleUnassignBookingAgent}
                      className="px-2 py-1 rounded bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 text-[10px] font-bold cursor-pointer"
                    >
                      Unassign
                    </button>
                  </div>
                ) : (
                  <div>
                    {!isAssigningBookingAgent ? (
                      <button
                        type="button"
                        onClick={() => setIsAssigningBookingAgent(true)}
                        className="text-[11px] font-bold text-[#008f77] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        + Assign to B2B Partner Agent
                      </button>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <select
                          value={selectedBookingAgentId}
                          onChange={(e) => setSelectedBookingAgentId(e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="">-- Choose Agent --</option>
                          {b2bAgents.map(ag => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name} ({ag.agencyName || 'Independent'})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAssigningBookingAgent(false);
                              setSelectedBookingAgentId('');
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!selectedBookingAgentId}
                            onClick={handleAssignBookingAgent}
                            className="px-2.5 py-0.5 rounded bg-[#008f77] text-white text-[10px] font-bold disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Assigned Internal Team Member (Operational Owner) */}
            {isInternal && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Assigned Operational Owner</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                      booking.assignmentStatus === 'assigned'
                        ? 'bg-teal-50 text-[#008f77] border border-teal-200'
                        : booking.assignmentStatus === 'reassigned'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {booking.assignmentStatus === 'assigned'
                        ? 'Assigned'
                        : booking.assignmentStatus === 'reassigned'
                        ? 'Reassigned'
                        : 'Pending Internal Assignment'}
                    </span>
                    {booking.assignmentHistory && booking.assignmentHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAssignmentHistoryModal(true)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="View Assignment Audit History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {booking.assignedTeamMemberId ? (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#008f77]" />
                        {booking.assignedTeamMemberNameSnapshot || booking.assignedTeamMemberName || 'Internal Staff'}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {booking.assignedTeamMemberEmailSnapshot || 'Operations Owner'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsAssigningTeamMember(true)}
                        className="px-2 py-1 rounded bg-white text-[#008f77] hover:bg-teal-50 border border-teal-200 text-[10px] font-bold cursor-pointer"
                      >
                        Reassign
                      </button>
                      <button
                        type="button"
                        onClick={handleUnassignTeamMember}
                        className="px-2 py-1 rounded bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 text-[10px] font-bold cursor-pointer"
                      >
                        Unassign
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {!isAssigningTeamMember ? (
                      <button
                        type="button"
                        onClick={() => setIsAssigningTeamMember(true)}
                        className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer flex items-center"
                      >
                        Assign Internal Operational Owner
                      </button>
                    ) : null}
                  </div>
                )}

                {/* Team Member Assignment Inline Box */}
                {isAssigningTeamMember && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mt-2">
                    <label className="text-[10px] font-bold text-slate-700 block uppercase">
                      Select Operational Staff Member
                    </label>
                    <select
                      value={selectedTeamMemberId}
                      onChange={(e) => setSelectedTeamMemberId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Choose Team Member --</option>
                      {internalTeamMembers.map(tm => (
                        <option key={tm.id} value={tm.id}>
                          {tm.name} ({tm.role || 'Operations'}) - {tm.email}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={teamMemberNotes}
                      onChange={(e) => setTeamMemberNotes(e.target.value)}
                      placeholder="Optional handover / operational note..."
                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAssigningTeamMember(false);
                          setSelectedTeamMemberId('');
                          setTeamMemberNotes('');
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!selectedTeamMemberId}
                        onClick={handleAssignTeamMember}
                        className="px-2.5 py-0.5 rounded bg-[#008f77] text-white text-[10px] font-bold disabled:opacity-50"
                      >
                        Save Assignment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isInternal && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600">
                <span>Operational Desk Handler:</span>
                <span className="font-bold text-slate-800">{booking.assignedTeamMemberName || 'TheUnbound Operations Team'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Authoritative Travel Schedule & Logistics */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Travel Schedule & Hub
              </h3>
            </div>
            {isInternal && canEditSubmittedBooking(currentUser, booking) && (
              <button
                onClick={() => setIsDatesModalOpen(true)}
                className="text-[11px] font-bold text-[#008f77] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit Dates</span>
              </button>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Travel Start</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {booking.travelStartDate || 'Pending'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Travel End</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {booking.travelEndDate || 'Pending'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Primary Destination</span>
              <span className="font-bold text-slate-800">
                {booking.destinationName || booking.destination || 'Japan'}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600">
              <span>Arrival Flight:</span>
              <span className="font-mono font-bold text-slate-800">
                {booking.arrivalFlightNumber || 'TBA'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. FINANCIAL & PROFITABILITY HEALTH (INTERNAL ONLY) */}
      {isInternal && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Commercial Pricing & Profitability Snapshot
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Authoritative Currency: {booking.currency || 'USD'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Total Customer Price</span>
              <span className="text-lg font-black text-slate-900 mt-1 block">
                {formatCurrency(booking.totalAmount || 0, booking.currency)}
              </span>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">Authoritative Selling</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Total Supplier Cost</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">
                {formatCurrency(
                  booking.items?.reduce((sum, it) => sum + (it.supplierTotalCost || it.supplierPrice || 0), 0) || 0,
                  booking.currency
                )}
              </span>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">Commercial Buy Total</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[10px] font-black uppercase text-emerald-800 block">Gross Profit</span>
              <span className="text-lg font-black text-emerald-800 mt-1 block">
                {formatCurrency(
                  (booking.totalAmount || 0) - (booking.items?.reduce((sum, it) => sum + (it.supplierTotalCost || it.supplierPrice || 0), 0) || 0),
                  booking.currency
                )}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">Net Margin</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Verified Collections</span>
              <span className="text-lg font-black text-[#008f77] mt-1 block">
                {formatCurrency(paymentSummary.paidAmount, booking.currency)}
              </span>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                {percentagePaid.toFixed(0)}% Collected
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: EDIT TRAVEL DATES */}
      {isDatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#008f77]" />
                Update Authoritative Travel Dates
              </h3>
              <button
                onClick={() => setIsDatesModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTravelDates} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Travel Start Date *</label>
                <input
                  type="date"
                  required
                  value={editStartDate}
                  onChange={e => setEditStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-[#008f77] mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Travel End Date *</label>
                <input
                  type="date"
                  required
                  value={editEndDate}
                  onChange={e => setEditEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-[#008f77] mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Audit Change Justification *</label>
                <textarea
                  rows={2}
                  required
                  value={dateChangeReason}
                  onChange={e => setDateChangeReason(e.target.value)}
                  placeholder="e.g. Flight schedule change requested by agent..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#008f77] mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDatesModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold cursor-pointer"
                >
                  Save Travel Dates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 6. MODAL: ASSIGNMENT HISTORY AUDIT TRAIL */}
      {showAssignmentHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 text-[#008f77]">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Booking Assignment History
                  </h3>
                  <p className="text-xs text-slate-500">
                    Authoritative ownership audit trail for Booking #{booking.bookingReference || booking.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignmentHistoryModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 grow">
              {(!booking.assignmentHistory || booking.assignmentHistory.length === 0) ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No prior assignment history recorded.
                </div>
              ) : (
                booking.assignmentHistory.map((item, index) => (
                  <div key={item.id || index} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                        item.eventType === 'INITIAL_ASSIGNMENT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.eventType === 'REASSIGNMENT'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : item.eventType === 'UNASSIGNED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {(item.eventType || 'ASSIGNMENT').replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Staff</span>
                        <span className="font-semibold text-slate-800">
                          {item.assignedTeamMemberNameSnapshot || 'Unassigned'}
                        </span>
                        {item.assignedTeamMemberEmailSnapshot && (
                          <span className="text-[10px] text-slate-400 block">
                            {item.assignedTeamMemberEmailSnapshot}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">B2B Agent</span>
                        <span className="font-semibold text-slate-800">
                          {item.agentNameSnapshot || 'Not Assigned'}
                        </span>
                        {item.agentAgencySnapshot && (
                          <span className="text-[10px] text-slate-400 block">
                            Agency: {item.agentAgencySnapshot}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.notes && (
                      <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-600 italic">
                        "{item.notes}"
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-100">
                      <span>Action by: {item.assignedByUserNameSnapshot || 'System / Admin'}</span>
                      <span className="font-mono text-slate-400">{item.assignedByUserId}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowAssignmentHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
