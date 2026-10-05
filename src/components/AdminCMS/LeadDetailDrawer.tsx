import React, { useState } from 'react';
import { 
  TravelLead, 
  LeadStatus, 
  LeadPriority, 
  LeadNote,
  LeadFollowUpTask,
  CurrencyCode,
  Booking,
  Quotation,
  BookingVoucher,
  BookingInvoice,
  QuoteVersionRecord
} from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../services/pricingEngine';
import { VoucherDocumentView } from '../Bookings/VoucherDocumentView';
import { ProformaInvoiceModal } from './leads/ProformaInvoiceModal';
import { validateProformaInvoicePreflight, ProformaPreflightError } from '../../services/proformaInvoicePreflight';
import { ProformaGenerationErrorModal, ProformaGenerationSuccessModal } from './invoices/ProformaGenerationModals';
import { LeadQuotesTab } from './leads/LeadQuotesTab';
import { LeadBookingsTab } from './leads/LeadBookingsTab';
import { LeadVouchersTab } from './leads/LeadVouchersTab';
import { LeadFinancialsTab } from './leads/LeadFinancialsTab';
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
  BookmarkCheck,
  UserCheck,
  Receipt,
  Printer,
  CreditCard,
  ArrowUpRight,
  Eye,
  FileCheck,
  ArrowLeft,
  Edit,
  Edit3
} from 'lucide-react';
import { RecordReminderIndicator } from '../ActionCenter/RecordReminderIndicator';
import { LeadTasksSection } from './tasks/LeadTasksSection';
import { CheckSquare } from 'lucide-react';

interface LeadDetailDrawerProps {
  lead: TravelLead | null;
  onClose: () => void;
  onUpdateLead: (updatedLead: TravelLead) => void;
  onNavigateToTasks?: () => void;
  onOpenBooking?: (bookingId: string) => void;
  onOpenQuote?: (quoteId: string, options?: { version?: number; mode?: 'inspect' | 'edit' | 'readonly'; leadId?: string }) => void;
  onOpenEdit?: (lead: TravelLead) => void;
  onCreateQuoteForLead?: (lead: TravelLead) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onUpdateLead,
  onNavigateToTasks,
  onOpenBooking,
  onOpenQuote,
  onOpenEdit,
  onCreateQuoteForLead
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'requirements' | 'products' | 'quotes' | 'bookings' | 'vouchers' | 'financials' | 'timeline' | 'followups' | 'notes' | 'documents'
  >('overview');

  const [previewVoucher, setPreviewVoucher] = useState<BookingVoucher | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<BookingInvoice | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

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
  const [preflightError, setPreflightError] = useState<ProformaPreflightError | null>(null);

  const b2bAgents = React.useMemo(() => {
    return db.getUsers().filter(u => u.role === 'B2B_AGENT' && u.approvalStatus === 'APPROVED');
  }, [db]);

  const linkedQuotes = React.useMemo(() => {
    if (!lead) return [];
    return db.getQuotesForLead(lead.id, user);
  }, [db, lead, user]);

  const linkedQuoteVersions = React.useMemo(() => {
    if (!lead) return [];
    return db.getQuoteVersionsForLead(lead.id);
  }, [db, lead]);

  const linkedBookings = React.useMemo(() => {
    if (!lead) return [];
    const all = db.getAllBookings();
    return all.filter(b => 
      b.leadId === lead.id || 
      b.linkedLeadId === lead.id || 
      (lead.bookingId && b.id === lead.bookingId) || 
      (lead.bookingReference && b.bookingReference === lead.bookingReference) ||
      (lead.linkedBookingIds && lead.linkedBookingIds.includes(b.id))
    );
  }, [db, lead]);

  const linkedVouchers = React.useMemo(() => {
    if (!lead) return [];
    return db.getVouchersForLead(lead.id);
  }, [db, lead]);

  const linkedInvoices = React.useMemo(() => {
    if (!lead) return [];
    return db.getInvoicesForLead(lead.id);
  }, [db, lead]);

  const financialSummary = React.useMemo(() => {
    if (!lead) return null;
    return db.getFinancialSummaryForLead(lead.id, user);
  }, [db, lead, user]);

  if (!lead) return null;

  const handleConvertToBooking = (quote: Quotation) => {
    try {
      setIsConverting(true);
      setActionErrorMessage(null);
      const newBooking = db.submitBookingFromQuote(quote.id, user);
      const refreshed = db.getLeadById(lead.id);
      if (refreshed) onUpdateLead(refreshed);
      setActionSuccessMessage(`Successfully converted Quote #${quote.quoteNumber} into Ground Booking #${newBooking.bookingReference}!`);
      setActiveTab('bookings');
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Failed to convert quote to booking');
    } finally {
      setIsConverting(false);
    }
  };

  const handleGenerateCompleteVoucher = (bookingId: string) => {
    try {
      const res = db.generateBookingVoucher(bookingId, user);
      if (!res.success || !res.voucher) {
        setActionErrorMessage(res.error || 'Failed to generate complete itinerary voucher');
        return;
      }
      const refreshed = db.getLeadById(lead.id);
      if (refreshed) onUpdateLead(refreshed);
      setPreviewVoucher(res.voucher);
      setActionSuccessMessage(`Generated complete itinerary voucher #${res.voucher.voucherNumber}`);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Failed to generate voucher');
    }
  };

  const handleGenerateActivityVoucher = (bookingId: string, itemId: string) => {
    try {
      const res = db.generateActivityVoucher(bookingId, itemId, user);
      if (!res.success || !res.voucher) {
        setActionErrorMessage(res.error || 'Failed to generate activity voucher');
        return;
      }
      const refreshed = db.getLeadById(lead.id);
      if (refreshed) onUpdateLead(refreshed);
      setPreviewVoucher(res.voucher);
      setActionSuccessMessage(`Generated activity voucher #${res.voucher.voucherNumber}`);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Failed to generate activity voucher');
    }
  };

  const handleGenerateInvoice = (bookingId: string) => {
    try {
      // 1. Preflight Validation Check
      const precheck = validateProformaInvoicePreflight(bookingId, user);
      if (!precheck.valid || precheck.error) {
        setPreflightError(precheck.error || null);
        return;
      }

      // 2. Perform Generation
      const res = db.generateProformaInvoice(bookingId, user, true);
      if (!res.success || !res.invoice) {
        setPreflightError({
          code: 'UNKNOWN_ERROR',
          title: 'Invoice Generation Failed',
          message: res.error || 'Failed to generate commercial proforma invoice.',
          missingRequirements: ['Valid booking data structure'],
          actionableInstruction: 'Please check your connection and try again.',
          bookingId
        });
        return;
      }

      const refreshed = db.getLeadById(lead.id);
      if (refreshed) onUpdateLead(refreshed);
      setPreviewInvoice(res.invoice);
      setActionSuccessMessage(`Issued commercial proforma invoice #${res.invoice.invoiceNumber}`);
    } catch (err: any) {
      setPreflightError({
        code: 'UNKNOWN_ERROR',
        title: 'Execution Error',
        message: err.message || 'Failed to generate proforma invoice.',
        missingRequirements: ['Valid booking record'],
        actionableInstruction: 'Please refresh and try again.',
        bookingId
      });
    }
  };

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
    <div id={`lead-workspace-${lead.id}`} className="w-full min-w-0 bg-[#F8FAFA] space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="lead-detail-back-btn"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>Back to Leads</span>
          </button>
          <span className="text-slate-300 font-bold">/</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-teal-50 text-[#008f77] px-2.5 py-1 rounded-lg border border-teal-200/80">
              #{lead.leadNumber}
            </span>
            <span className="text-base font-black text-slate-900">{lead.contactName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RecordReminderIndicator
            entityType="LEAD"
            entityId={lead.id}
            entityReference={lead.leadNumber}
            currentUser={user}
            variant="header"
          />
          {onOpenEdit && (
            <button
              type="button"
              onClick={() => onOpenEdit(lead)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
              <span>Edit Lead</span>
            </button>
          )}
          {onCreateQuoteForLead && (
            <button
              type="button"
              onClick={() => onCreateQuoteForLead(lead)}
              className="px-3.5 py-1.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Quotation</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Lead Record Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{lead.contactName}</h1>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${getStatusBadge(lead.status)}`}>
                {(lead.status || 'NEW').replace(/_/g, ' ')}
              </span>
              {getPriorityBadge(lead.priority)}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              {lead.agencyName && (
                <span className="flex items-center gap-1 text-[#008f77] font-bold">
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

          {/* Quick Header Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Stage / Status</span>
              <select
                id="lead-status-quick-select"
                value={lead.status}
                onChange={e => handleStatusChange(e.target.value as LeadStatus)}
                className="bg-slate-50 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#008f77]"
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
              <span className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Priority</span>
              <select
                id="lead-priority-quick-select"
                value={lead.priority || 'NORMAL'}
                onChange={e => handlePriorityChange(e.target.value as LeadPriority)}
                className="bg-slate-50 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#008f77]"
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Primary Destination</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{lead.destinationName}</span>
          </div>
          <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/60">
            <span className="text-[10px] font-bold uppercase text-teal-800 block">Estimated Deal Value</span>
            <span className="font-extrabold text-[#008f77] text-base mt-0.5 block">
              {lead.currency || 'USD'} {(Number(lead.estimatedBudget || lead.bookingValue || 0)).toLocaleString()}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Travel Schedule</span>
            <span className="font-bold text-slate-900 truncate block mt-0.5">{lead.travelDates || 'Flexible 2026'}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Lead Source</span>
            <span className="font-bold text-amber-700 truncate block mt-0.5">{lead.source}</span>
          </div>
        </div>
      </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 px-3 sm:px-6 py-2 border-b border-slate-200 flex items-center gap-1.5 sm:gap-2 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'overview', label: 'Overview', icon: Briefcase },
            { id: 'requirements', label: 'Travel Details', icon: Compass },
            { id: 'products', label: `Products (${lead.requestedProducts?.length || 0})`, icon: Package },
            { id: 'quotes', label: `Quotes & Proposals (${linkedQuotes.length || (lead.quoteNumber ? 1 : 0)})`, icon: DollarSign },
            { id: 'bookings', label: `Bookings (${linkedBookings.length})`, icon: Building },
            { id: 'vouchers', label: `Vouchers (${linkedVouchers.length})`, icon: ShieldCheck },
            { id: 'financials', label: `Invoices & Settlement (${linkedInvoices.length})`, icon: Receipt },
            { id: 'timeline', label: `Timeline (${lead.timeline?.length || 0})`, icon: History },
            { id: 'followups', label: `Tasks (${db.getTasksForLead(lead.id).length})`, icon: CheckSquare },
            { id: 'notes', label: `Notes (${lead.notes?.length || 0})`, icon: FileText },
            { id: 'documents', label: `Documents (${lead.documents?.length || 0})`, icon: FileCheck }
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
          {/* Action Success / Error Notifications */}
          {actionSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{actionSuccessMessage}</span>
              </div>
              <button 
                onClick={() => setActionSuccessMessage(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {actionErrorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold">{actionErrorMessage}</span>
              </div>
              <button 
                onClick={() => setActionErrorMessage(null)}
                className="text-rose-700 hover:text-rose-950 font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Dual Ownership & Assignment Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#008f77]" />
                    <span>Mandatory Dual Ownership</span>
                  </h3>
                  {((lead.responsibleAgentId || lead.assignedAgentId) && (lead.assignedTeamMemberId || lead.assignedStaffId)) ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      ✓ Dual Assigned
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Needs Assignment</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Internal Team Member (Operational Owner) */}
                  <div className="p-3.5 rounded-xl bg-teal-50/40 border border-teal-100/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#008f77]" />
                        <span>Internal Team Member</span>
                      </span>
                      <span className="text-[10px] font-bold text-[#008f77] uppercase bg-white px-2 py-0.5 rounded-md border border-[#00C6A6]/20">
                        {lead.assignedTeamMemberDepartment || lead.assignedDepartment || 'SALES'}
                      </span>
                    </div>

                    <select
                      value={staffList.find(s => s.name === (lead.assignedTeamMemberNameSnapshot || lead.assignedStaffName) || s.id === (lead.assignedTeamMemberId || lead.assignedStaffId))?.id || 'staff-01'}
                      onChange={e => handleAssignStaff(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-teal-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-[#00C6A6]"
                    >
                      {staffList.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.dept})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500">
                      Authoritative internal lead owner responsible for processing, follow-ups, quotes, and conversion.
                    </p>
                  </div>

                  {/* Submitting vs Commercial Agent Info */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 block">Lead Source & Submitter</span>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Submitter:</span>
                        <span className="font-semibold text-slate-800">
                          {lead.submittingAgentNameSnapshot || (lead.userType === 'B2B_AGENT' ? lead.agencyName : 'Website / Direct')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Account Type:</span>
                        <span className="font-medium text-slate-700">
                          {lead.userType || 'BUYER'} {lead.userId ? `(${lead.userId})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* B2B Partner Agent Assignment & Portal Visibility */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Commercial B2B Agent (Client Relationship Owner)</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      (lead.responsibleAgentId || lead.assignedAgentId)
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {(lead.responsibleAgentId || lead.assignedAgentId) ? 'Portal Access Enabled' : 'Internal Only (No Agent)'}
                    </span>
                  </div>

                  {(lead.responsibleAgentId || lead.assignedAgentId) ? (
                    <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-indigo-950">
                            {lead.responsibleAgentNameSnapshot || lead.assignedAgentNameSnapshot || 'Partner Agent'}
                          </span>
                          {(lead.responsibleAgencyNameSnapshot || lead.assignedAgentAgencySnapshot) && (
                            <span className="text-xs px-2 py-0.5 rounded bg-indigo-100/70 text-indigo-800 font-medium">
                              {lead.responsibleAgencyNameSnapshot || lead.assignedAgentAgencySnapshot}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-indigo-700 mt-0.5">
                          Assigned by {lead.assignedByUserNameSnapshot || 'Operations'} • {lead.assignedAt ? new Date(lead.assignedAt).toLocaleDateString() : 'Active'}
                          {(lead.responsibleAgentEmailSnapshot || lead.assignedAgentEmailSnapshot) && ` • ${lead.responsibleAgentEmailSnapshot || lead.assignedAgentEmailSnapshot}`}
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

              {/* Linked Commercial Records (Quotations, Bookings, Vouchers & Invoices) */}
              <div className="bg-white p-5 rounded-2xl border border-teal-200/80 bg-teal-50/20 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <BookmarkCheck className="w-4 h-4 text-[#00C6A6]" />
                    <span>Linked Commercial & Operational Pipeline</span>
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#00C6A6]/10 text-[#008f77]">
                    Bi-directional Link Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Proposal Card */}
                  <div 
                    onClick={() => {
                      const targetQId = lead.quoteId || (linkedQuotes.length > 0 ? linkedQuotes[0].id : null);
                      if (targetQId && onOpenQuote) {
                        onOpenQuote(targetQId, {
                          version: lead.quoteSnapshot?.version || (linkedQuotes.length > 0 ? linkedQuotes[0].version : undefined),
                          leadId: lead.id,
                          mode: 'inspect'
                        });
                      } else {
                        setActiveTab('quotes');
                      }
                    }}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-[#00C6A6] hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Proposal / Quote</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#008f77] transition-colors" />
                      </div>
                      <p className="font-mono font-bold text-slate-900 text-sm">
                        {lead.quoteNumber ? `#${lead.quoteNumber}` : linkedQuotes.length > 0 ? `#${linkedQuotes[0].quoteNumber}` : 'Drafting'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {lead.quoteSnapshot?.totalSellingPrice 
                          ? `${lead.quoteSnapshot.currency || 'USD'} ${Number(lead.quoteSnapshot.totalSellingPrice).toLocaleString()}`
                          : linkedQuotes.length > 0
                          ? `${linkedQuotes[0].currency} ${(linkedQuotes[0].totalSellingPrice || 0).toLocaleString()}`
                          : `${linkedQuotes.length} Quotes Available`}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#008f77] font-bold mt-2 inline-flex items-center gap-1 group-hover:underline">
                      Inspect Proposals →
                    </span>
                  </div>

                  {/* Confirmed Booking Card */}
                  <div 
                    onClick={() => {
                      const targetBookingId = lead.bookingId || (linkedBookings.length > 0 ? linkedBookings[0].id : null);
                      if (targetBookingId && onOpenBooking) {
                        onOpenBooking(targetBookingId);
                      } else {
                        setActiveTab('bookings');
                      }
                    }}
                    className={`p-3.5 bg-white rounded-xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between ${
                      (lead.bookingReference || lead.bookingId || linkedBookings.length > 0)
                        ? 'border-emerald-200 hover:border-emerald-400'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Ground Booking</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-700 transition-colors" />
                      </div>
                      <p className="font-mono font-bold text-emerald-800 text-sm">
                        {lead.bookingReference ? `#${lead.bookingReference}` : lead.bookingId ? `#${lead.bookingId}` : linkedBookings.length > 0 ? `#${linkedBookings[0].bookingReference}` : 'Not Converted'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {lead.bookingValue 
                          ? `${lead.currency || 'USD'} ${Number(lead.bookingValue).toLocaleString()}`
                          : linkedBookings.length > 0
                          ? `${linkedBookings[0].currency} ${(linkedBookings[0].totalAmount || 0).toLocaleString()}`
                          : 'Pending Conversion'}
                      </p>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold mt-2 inline-flex items-center gap-1 group-hover:underline">
                      Operations Desk →
                    </span>
                  </div>

                  {/* Vouchers Card */}
                  <div 
                    onClick={() => setActiveTab('vouchers')}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Issued Vouchers</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-700 transition-colors" />
                      </div>
                      <p className="font-mono font-bold text-purple-900 text-sm">
                        {linkedVouchers.length} Vouchers
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {linkedVouchers.length > 0 ? `Latest: ${linkedVouchers[0].voucherNumber}` : 'Awaiting confirmation'}
                      </p>
                    </div>
                    <span className="text-[10px] text-purple-700 font-bold mt-2 inline-flex items-center gap-1 group-hover:underline">
                      View Vouchers →
                    </span>
                  </div>

                  {/* Settlement / Financials Card */}
                  <div 
                    onClick={() => setActiveTab('financials')}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-teal-300 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Financial Balance</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-700 transition-colors" />
                      </div>
                      <p className="font-mono font-bold text-slate-900 text-sm">
                        {linkedInvoices.length} Proformas
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {financialSummary 
                          ? `Due: ${formatCurrency(financialSummary.totalBalanceDue, financialSummary.currency)}`
                          : 'No invoices yet'}
                      </p>
                    </div>
                    <span className="text-[10px] text-teal-700 font-bold mt-2 inline-flex items-center gap-1 group-hover:underline">
                      Financial Summary →
                    </span>
                  </div>
                </div>
              </div>

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
                              {Array.isArray(prod.selectedAddonNames) && prod.selectedAddonNames.length > 0 && (
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

          {/* TAB: QUOTES & PROPOSALS */}
          {activeTab === 'quotes' && (
            <LeadQuotesTab
              lead={lead}
              linkedQuotes={linkedQuotes}
              linkedQuoteVersions={linkedQuoteVersions}
              onOpenQuote={onOpenQuote}
              onConvertToBooking={handleConvertToBooking}
              isConverting={isConverting}
            />
          )}

          {/* TAB: GROUND BOOKINGS */}
          {activeTab === 'bookings' && (
            <LeadBookingsTab
              lead={lead}
              linkedBookings={linkedBookings}
              onOpenBooking={onOpenBooking}
              onGenerateCompleteVoucher={handleGenerateCompleteVoucher}
              onGenerateActivityVoucher={handleGenerateActivityVoucher}
              onGenerateInvoice={handleGenerateInvoice}
            />
          )}

          {/* TAB: ITINERARY & ACTIVITY VOUCHERS */}
          {activeTab === 'vouchers' && (
            <LeadVouchersTab
              lead={lead}
              linkedVouchers={linkedVouchers}
              linkedBookings={linkedBookings}
              onViewVoucher={voucher => setPreviewVoucher(voucher)}
              onGenerateCompleteVoucher={handleGenerateCompleteVoucher}
            />
          )}

          {/* TAB: FINANCIALS & PROFORMA INVOICES */}
          {activeTab === 'financials' && (
            <LeadFinancialsTab
              lead={lead}
              linkedInvoices={linkedInvoices}
              linkedBookings={linkedBookings}
              financialSummary={financialSummary}
              onViewInvoice={invoice => setPreviewInvoice(invoice)}
              onGenerateInvoice={handleGenerateInvoice}
            />
          )}

          {/* TAB: ACTIVITY TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              {/* Chronological Dual-Ownership & Assignment Audit Trail */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#008f77]" />
                    <span>Ownership & Assignment Audit Trail</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {lead.assignmentHistory?.length || 0} Records
                  </span>
                </h3>

                {(!lead.assignmentHistory || lead.assignmentHistory.length === 0) ? (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    No ownership reassignments recorded yet. Current assignment: {lead.responsibleAgentNameSnapshot || 'No Agent'} (Commercial) & {lead.assignedTeamMemberNameSnapshot || lead.assignedStaffName} (Operations).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lead.assignmentHistory.map((entry, aIdx) => (
                      <div key={entry.id || aIdx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              entry.changeType === 'AGENT_REASSIGNED' || entry.changeType === 'AGENT_INITIAL' ? 'bg-indigo-600' : 'bg-teal-600'
                            }`} />
                            <span className="uppercase text-[11px] tracking-wide">
                              {(entry.changeType || 'UPDATE').replace(/_/g, ' ')}
                            </span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-700 font-medium">
                          {entry.previousAssigneeName && (
                            <>
                              <span className="line-through text-slate-400">{entry.previousAssigneeName}</span>
                              <span className="text-slate-400">→</span>
                            </>
                          )}
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {entry.newAssigneeName || 'Unassigned'}
                          </span>
                          {entry.newAssigneeAgency && (
                            <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] border border-indigo-100">
                              {entry.newAssigneeAgency}
                            </span>
                          )}
                        </div>
                        {entry.notes && (
                          <p className="text-[11px] text-slate-600 italic mt-1">"{entry.notes}"</p>
                        )}
                        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                          <span>Action by: <strong className="text-slate-700">{entry.performedByName}</strong> ({entry.performedByRole || 'User'})</span>
                          <span className="font-mono text-[9px] text-slate-400">{entry.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Journey Timeline */}
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

      {/* Voucher Document Preview Modal */}
      {previewVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <VoucherDocumentView
              voucher={previewVoucher}
              onClose={() => setPreviewVoucher(null)}
            />
          </div>
        </div>
      )}

      {/* Commercial Proforma Invoice Preview Modal */}
      {previewInvoice && (
        <ProformaInvoiceModal
          invoice={previewInvoice}
          isOpen={true}
          onClose={() => setPreviewInvoice(null)}
        />
      )}

      {/* Preflight Error Modal */}
      <ProformaGenerationErrorModal
        error={preflightError}
        onClose={() => setPreflightError(null)}
      />
    </div>
  );
};

export const LeadDetailView = LeadDetailDrawer;
