import React, { useState, useMemo } from 'react';
import { Booking, BookingVoucher, User } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { isInternalStaff } from '../../../services/permissionEngine';
import { VoucherDocumentView } from '../VoucherDocumentView';
import { 
  FileText, 
  Plus, 
  Eye, 
  Edit3, 
  Printer, 
  Download, 
  Share2, 
  Mail, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  Building2, 
  Calendar, 
  MapPin, 
  Users, 
  History, 
  X,
  Send,
  MessageCircle
} from 'lucide-react';

interface DeskActivityVouchersSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskActivityVouchersSection: React.FC<DeskActivityVouchersSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const isInternal = isInternalStaff(currentUser);

  // Modals & Active Selections
  const [selectedVoucherForPreview, setSelectedVoucherForPreview] = useState<BookingVoucher | null>(null);
  const [voucherToEdit, setVoucherToEdit] = useState<BookingVoucher | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [groupingType, setGroupingType] = useState<'activity' | 'category' | 'combined'>('activity');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [historyVoucher, setHistoryVoucher] = useState<BookingVoucher | null>(null);
  const [emailModalVoucher, setEmailModalVoucher] = useState<BookingVoucher | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSentNotice, setEmailSentNotice] = useState(false);

  // Edit Voucher Form State
  const [editServiceName, setEditServiceName] = useState('');
  const [editServiceDate, setEditServiceDate] = useState('');
  const [editServiceTime, setEditServiceTime] = useState('');
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editSupplierContact, setEditSupplierContact] = useState('');
  const [editSupplierRef, setEditSupplierRef] = useState('');
  const [editMeetingPoint, setEditMeetingPoint] = useState('');
  const [editPickupInfo, setEditPickupInfo] = useState('');
  const [editDropoffInfo, setEditDropoffInfo] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editInclusions, setEditInclusions] = useState('');
  const [editExclusions, setEditExclusions] = useState('');
  const [editAmendmentReason, setEditAmendmentReason] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationFeedback, setGenerationFeedback] = useState<{
    type: 'success' | 'partial' | 'error';
    message: string;
    details?: string[];
  } | null>(null);

  // Vouchers belonging to this booking that are NOT the single complete booking voucher
  const activityVouchers = useMemo(() => {
    const list = (booking.vouchersList || []).filter(v => !v.isCompleteBookingVoucher);
    return list;
  }, [booking.vouchersList]);

  const items = useMemo(() => db.normalizeServiceItems(booking.items || [], booking), [booking.items, booking, db]);
  
  const activityEligibleItems = useMemo(() => {
    return items.filter(it => db.isActivityVoucherEligible(it));
  }, [items, db]);

  const confirmedItems = useMemo(() => {
    return activityEligibleItems.filter(
      it => it.supplierConfirmationStatus === 'Confirmed' || it.supplierStatus === 'CONFIRMED_BY_SUPPLIER'
    );
  }, [activityEligibleItems]);

  const pendingItems = useMemo(() => {
    return activityEligibleItems.filter(
      it => it.supplierConfirmationStatus !== 'Confirmed' && it.supplierStatus !== 'CONFIRMED_BY_SUPPLIER'
    );
  }, [activityEligibleItems]);

  // Open Edit Modal
  const openEditModal = (v: BookingVoucher) => {
    setVoucherToEdit(v);
    setEditServiceName(v.serviceName || '');
    setEditServiceDate(v.serviceDate || '');
    setEditServiceTime(v.serviceTime || '');
    setEditSupplierName(v.supplierName || '');
    setEditSupplierContact(v.supplierContact || '');
    setEditSupplierRef(v.supplierConfirmationRef || '');
    setEditMeetingPoint(v.meetingPoint || '');
    setEditPickupInfo(v.pickupInfo || '');
    setEditDropoffInfo(v.dropoffInfo || '');
    setEditEmergencyContact(v.emergencyContact || '');
    setEditInstructions(v.specialInstructions || '');
    setEditInclusions(Array.isArray(v.inclusions) ? v.inclusions.join('\n') : '');
    setEditExclusions(Array.isArray(v.exclusions) ? v.exclusions.join('\n') : '');
    setEditAmendmentReason('');
  };

  const handleSaveVoucherEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherToEdit) return;

    const updated: BookingVoucher = {
      ...voucherToEdit,
      serviceName: editServiceName,
      serviceDate: editServiceDate,
      serviceTime: editServiceTime,
      supplierName: editSupplierName,
      supplierContact: editSupplierContact,
      supplierConfirmationRef: editSupplierRef,
      meetingPoint: editMeetingPoint,
      pickupInfo: editPickupInfo,
      dropoffInfo: editDropoffInfo,
      emergencyContact: editEmergencyContact,
      specialInstructions: editInstructions,
      inclusions: editInclusions.split('\n').map(s => s.trim()).filter(Boolean),
      exclusions: editExclusions.split('\n').map(s => s.trim()).filter(Boolean),
      status: 'ISSUED'
    };

    const res = db.updateBookingVoucher(booking.id, updated, currentUser, editAmendmentReason || 'Manual updates');
    if (res.success) {
      setVoucherToEdit(null);
      onRefresh();
    } else {
      alert(res.error || 'Failed to update voucher');
    }
  };

  const handleReissue = (voucherId: string) => {
    const reason = window.prompt('Enter reason for reissuing this voucher:', 'Updated itinerary timings');
    if (!reason) return;
    const res = db.reissueBookingVoucher(booking.id, voucherId, currentUser, reason);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error || 'Failed to reissue');
    }
  };

  const handleCancel = (voucherId: string) => {
    const reason = window.prompt('Enter reason for cancelling this voucher:', 'Service cancelled');
    if (!reason) return;
    const res = db.cancelBookingVoucher(booking.id, voucherId, currentUser, reason);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error || 'Failed to cancel');
    }
  };

  const handleGenerateVouchers = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationFeedback(null);

    try {
      const res = db.generateActivityVouchersGrouped(
        booking.id, 
        groupingType, 
        selectedItemIds.length > 0 ? selectedItemIds : undefined, 
        currentUser
      );

      if (res.success) {
        setIsGenerateModalOpen(false);
        setSelectedItemIds([]);
        if (res.failed > 0) {
          setGenerationFeedback({
            type: 'partial',
            message: `Generated ${res.successful} activity voucher(s). ${res.failed} item(s) could not be issued.`,
            details: res.errors?.map(e => `${e.productName || 'Service'}: ${e.reason}`)
          });
        } else {
          setGenerationFeedback({
            type: 'success',
            message: `Successfully generated ${res.successful} activity-level voucher(s).`
          });
        }
        onRefresh();
      } else {
        setGenerationFeedback({
          type: 'error',
          message: res.error || 'Failed to generate activity vouchers. Make sure services are supplier confirmed.',
          details: res.errors?.map(e => `${e.productName || 'Service'}: ${e.reason}`)
        });
      }
    } catch (err: any) {
      setGenerationFeedback({
        type: 'error',
        message: err.message || 'An unexpected error occurred while generating activity vouchers.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const openEmailModal = (v: BookingVoucher) => {
    setEmailModalVoucher(v);
    setEmailRecipient(booking.customer?.email || booking.agentEmailSnapshot || '');
    setEmailSubject(`Ground Service Voucher: ${v.serviceName} [${v.voucherNumber}] - Booking #${booking.bookingReference}`);
    setEmailBody(
`Dear ${v.leadPaxName || 'Traveler'},

Please find attached your official ground service voucher for ${v.serviceName} (Ref: ${v.voucherNumber}).

SERVICE DETAILS:
• Service: ${v.serviceName}
• Date: ${v.serviceDate}
• Time: ${v.serviceTime}
• Pickup / Meeting Point: ${v.meetingPoint || v.pickupInfo || 'As arranged'}
• Total Guests: ${v.totalPax}
• Emergency Contact: ${v.emergencyContact || '+91 9811654959'}

Please present this voucher upon arrival. Have a wonderful experience!

Warm regards,
TheUnbound Operations Team`
    );
    setEmailSentNotice(false);
  };

  const handleSendEmail = () => {
    // Record dispatch in booking timeline
    if (emailModalVoucher) {
      db.recordBookingActivity({
        eventId: `act-email-${Date.now()}`,
        bookingId: booking.id,
        eventType: 'STATUS_UPDATED',
        actorId: currentUser?.id || 'admin',
        actorRole: currentUser?.role || 'TEAM_MEMBER',
        actorName: currentUser?.name || 'Operations Lead',
        timestamp: new Date().toISOString(),
        metadata: { recipient: emailRecipient, voucherNumber: emailModalVoucher.voucherNumber },
        description: `Dispatched Activity Voucher #${emailModalVoucher.voucherNumber} to ${emailRecipient}`
      }, currentUser);
    }
    setEmailSentNotice(true);
    setTimeout(() => {
      setEmailModalVoucher(null);
      setEmailSentNotice(false);
      onRefresh();
    }, 1200);
  };

  const handleShareWhatsApp = (v: BookingVoucher) => {
    const text = `*TheUnbound Ground Voucher*\n` +
      `Voucher No: *#${v.voucherNumber}*\n` +
      `Booking Ref: *#${booking.bookingReference}*\n` +
      `Service: *${v.serviceName}*\n` +
      `Date: ${v.serviceDate} at ${v.serviceTime}\n` +
      `Meeting Point: ${v.meetingPoint || 'Hotel Lobby'}\n` +
      `Lead Guest: ${v.leadPaxName} (${v.totalPax} Pax)\n` +
      `24/7 Helpline: ${v.emergencyContact || '+91 9811654959'}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div id="desk-activity-vouchers-section" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-[#008972] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#00C6A6]" />
              Activity-Level Ground Vouchers
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs text-slate-500 font-bold">
              {activityVouchers.length} Issued
            </span>
            {pendingItems.length > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-amber-700 font-bold">
                  {pendingItems.length} Pending Supplier Confirmation
                </span>
              </>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Activity & Excursion Service Vouchers
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Individual and grouped vouchers for excursions, daily tours, cultural activities, and attractions. Generated directly from historical booking snapshots with exact vehicle, guide, and passenger allocations.
          </p>
        </div>

        {isInternal && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedItemIds([]);
                setIsGenerateModalOpen(true);
              }}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Generating Vouchers...' : 'Generate Activity-Level Vouchers'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Generation Result Banner */}
      {generationFeedback && (
        <div className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-xs ${
          generationFeedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : generationFeedback.type === 'partial'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-start gap-2.5">
            {generationFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">{generationFeedback.message}</div>
              {generationFeedback.details && generationFeedback.details.length > 0 && (
                <ul className="mt-1 space-y-0.5 list-disc list-inside text-[11px] opacity-90">
                  {generationFeedback.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button
            onClick={() => setGenerationFeedback(null)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Vouchers Grid / Table */}
      {activityVouchers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activityVouchers.map(voucher => {
            const isCancelled = voucher.status === 'CANCELLED';
            const isOutdated = voucher.status === 'OUTDATED';
            const isReissued = voucher.status === 'REISSUED';

            return (
              <div
                key={voucher.id}
                className={`bg-white rounded-3xl border p-5 shadow-xs flex flex-col justify-between transition-all space-y-4 ${
                  isCancelled ? 'border-rose-200 bg-rose-50/20 opacity-75' :
                  isOutdated ? 'border-amber-200 bg-amber-50/20' :
                  'border-slate-200 hover:border-teal-300'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black text-teal-800">
                        #{voucher.voucherNumber}
                      </span>
                      {voucher.version && voucher.version > 1 && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                          v{voucher.version}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-black text-slate-900 mt-1 line-clamp-1">
                      {voucher.serviceName}
                    </h3>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                    isCancelled ? 'bg-rose-100 text-rose-800 border-rose-300' :
                    isOutdated ? 'bg-amber-100 text-amber-800 border-amber-300' :
                    isReissued ? 'bg-purple-100 text-purple-800 border-purple-300' :
                    'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}>
                    {voucher.status || 'ISSUED'}
                  </span>
                </div>

                {/* Details snapshot */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{voucher.serviceDate} at {voucher.serviceTime || '09:00 AM'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{voucher.meetingPoint || voucher.pickupInfo || 'Meeting point scheduled'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{voucher.leadPaxName} ({voucher.totalPax} Pax)</span>
                  </div>
                  {(voucher.vehicle || voucher.guide || voucher.ticketType || (voucher.bookedPrice !== undefined && voucher.bookedPrice > 0)) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60 text-[10px]">
                      {voucher.vehicle && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                          {voucher.vehicle}
                        </span>
                      )}
                      {voucher.guide && (
                        <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 font-medium text-[#008972]">
                          {voucher.guide}
                        </span>
                      )}
                      {voucher.ticketType && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                          {voucher.ticketType}
                        </span>
                      )}
                      {voucher.bookedPrice !== undefined && voucher.bookedPrice > 0 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold ml-auto">
                          {voucher.currency || 'JPY'} {voucher.bookedPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  {isInternal && voucher.supplierName && (
                    <div className="flex items-center gap-2 text-slate-500 pt-1 border-t border-slate-200/60 text-[11px]">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Supplier: <strong>{voucher.supplierName}</strong></span>
                    </div>
                  )}
                </div>

                {/* Outdated Notice */}
                {isOutdated && voucher.outdatedReason && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                    {voucher.outdatedReason}
                  </p>
                )}

                {/* Actions Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedVoucherForPreview(voucher)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="Preview Voucher"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {isInternal && !isCancelled && (
                      <button
                        onClick={() => openEditModal(voucher)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title="Edit Voucher Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => openEmailModal(voucher)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="Email Voucher"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleShareWhatsApp(voucher)}
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                      title="Share via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>

                    {voucher.versionHistory && voucher.versionHistory.length > 0 && (
                      <button
                        onClick={() => setHistoryVoucher(voucher)}
                        className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors cursor-pointer"
                        title="Version History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isInternal && !isCancelled && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleReissue(voucher.id)}
                        className="p-2 rounded-xl text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer text-[11px] font-bold"
                        title="Reissue Voucher"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCancel(voucher.id)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Cancel Voucher"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900">No Activity Vouchers Generated Yet</h3>
            <p className="text-xs text-slate-500 mt-1">
              Confirmed activities, excursions, transfers, and daily services can be issued as individual or grouped vouchers.
            </p>
          </div>
          {isInternal && (
            <button
              onClick={() => {
                setSelectedItemIds([]);
                setIsGenerateModalOpen(true);
              }}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Generating Vouchers...' : 'Generate Activity-Level Vouchers'}</span>
            </button>
          )}
        </div>
      )}

      {/* MODAL 1: Generate Grouped Vouchers */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00C6A6]" />
                Generate Activity-Level Vouchers
              </h3>
              <button 
                onClick={() => !isGenerating && setIsGenerateModalOpen(false)} 
                disabled={isGenerating}
                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Voucher Generation Architecture</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupingType('activity')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      groupingType === 'activity'
                        ? 'border-teal-500 bg-teal-50 text-teal-900 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-bold text-slate-900">Per Activity Item</span>
                    <span className="text-[10px] text-slate-500 font-normal">1 voucher per service (Standard)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGroupingType('category')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      groupingType === 'category'
                        ? 'border-teal-500 bg-teal-50 text-teal-900 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-bold text-slate-900">By Category</span>
                    <span className="text-[10px] text-slate-500 font-normal">Tours, Excursions, etc.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGroupingType('combined')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      groupingType === 'combined'
                        ? 'border-teal-500 bg-teal-50 text-teal-900 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-bold text-slate-900">Combined Pass</span>
                    <span className="text-[10px] text-slate-500 font-normal">All activities in one pass</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Select Activity Services ({confirmedItems.length} Confirmed / {activityEligibleItems.length} Total)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-200">
                  {confirmedItems.length > 0 ? (
                    confirmedItems.map(item => (
                      <label key={item.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors text-xs">
                        <input
                          type="checkbox"
                          disabled={isGenerating}
                          checked={selectedItemIds.length === 0 || selectedItemIds.includes(item.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedItemIds(prev => [...prev, item.id]);
                            } else {
                              const currentAll = selectedItemIds.length === 0 ? confirmedItems.map(i => i.id) : selectedItemIds;
                              setSelectedItemIds(currentAll.filter(id => id !== item.id));
                            }
                          }}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-slate-800">{item.productName}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {item.category || 'Activity'} • {item.serviceDate || item.travelDate || 'Date TBD'} • Supplier: {item.supplierName || 'Ground Supplier'}
                          </span>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="p-4 text-center text-amber-700 text-xs">
                      No activity items are marked as "Confirmed" yet. Please confirm the supplier allocations in the "Service Items & Supplier Allocation" desk first.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateVouchers}
                disabled={confirmedItems.length === 0 || isGenerating}
                className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {isGenerating && <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />}
                <span>{isGenerating ? 'Generating Vouchers...' : 'Generate Activity-Level Vouchers'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Full Post-Generation Voucher Editor */}
      {voucherToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveVoucherEdit} className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-teal-600" />
                  Edit Service Voucher #{voucherToEdit.voucherNumber}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Update ground operational details. Changes will increment the voucher version and record an audit log.
                </p>
              </div>
              <button type="button" onClick={() => setVoucherToEdit(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Service / Activity Title</label>
                <input
                  type="text"
                  required
                  value={editServiceName}
                  onChange={e => setEditServiceName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Date</label>
                <input
                  type="date"
                  required
                  value={editServiceDate}
                  onChange={e => setEditServiceDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Time</label>
                <input
                  type="text"
                  value={editServiceTime}
                  onChange={e => setEditServiceTime(e.target.value)}
                  placeholder="e.g. 09:30 AM"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={editSupplierName}
                  onChange={e => setEditSupplierName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Supplier Confirmation Ref</label>
                <input
                  type="text"
                  value={editSupplierRef}
                  onChange={e => setEditSupplierRef(e.target.value)}
                  placeholder="e.g. SUP-REF-9812"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Meeting Point / Pickup Location</label>
                <input
                  type="text"
                  value={editMeetingPoint}
                  onChange={e => setEditMeetingPoint(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Pickup Information</label>
                <input
                  type="text"
                  value={editPickupInfo}
                  onChange={e => setEditPickupInfo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Emergency 24/7 Hotline</label>
                <input
                  type="text"
                  value={editEmergencyContact}
                  onChange={e => setEditEmergencyContact(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Inclusions (One per line)</label>
                <textarea
                  rows={2}
                  value={editInclusions}
                  onChange={e => setEditInclusions(e.target.value)}
                  placeholder="e.g. English speaking guide&#10;Entry tickets"
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Exclusions (One per line)</label>
                <textarea
                  rows={2}
                  value={editExclusions}
                  onChange={e => setEditExclusions(e.target.value)}
                  placeholder="e.g. Gratuities&#10;Personal expenses"
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Special Guest Instructions</label>
                <textarea
                  rows={2}
                  value={editInstructions}
                  onChange={e => setEditInstructions(e.target.value)}
                  placeholder="e.g. Wear comfortable walking shoes. Bring valid photo ID."
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2 p-3 bg-amber-50 rounded-2xl border border-amber-200">
                <label className="font-bold text-amber-900 block mb-1">Operational Amendment Reason (Required for Audit)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Updated pickup time per supplier reconfirmation"
                  value={editAmendmentReason}
                  onChange={e => setEditAmendmentReason(e.target.value)}
                  className="w-full p-2 rounded-xl border border-amber-300 bg-white text-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVoucherToEdit(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Save & Update Voucher Version
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Voucher Preview */}
      {selectedVoucherForPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full my-8">
            <VoucherDocumentView
              voucher={selectedVoucherForPreview}
              onClose={() => setSelectedVoucherForPreview(null)}
              onRegenerate={() => {
                handleReissue(selectedVoucherForPreview.id);
                setSelectedVoucherForPreview(null);
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL 4: Version History */}
      {historyVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  Version History: #{historyVoucher.voucherNumber}
                </h3>
                <p className="text-[11px] text-slate-400">Current version: v{historyVoucher.version || 1}</p>
              </div>
              <button onClick={() => setHistoryVoucher(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              {historyVoucher.versionHistory && historyVoucher.versionHistory.length > 0 ? (
                historyVoucher.versionHistory.map((ver, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Version {ver.version}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ver.amendedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600">Amended By: <strong>{ver.amendedByName || 'Operations Staff'}</strong></p>
                    <p className="text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100 mt-1">
                      "{ver.amendmentReason || 'Manual operational adjustment'}"
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400">No previous versions.</div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-right shrink-0">
              <button
                onClick={() => setHistoryVoucher(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Email Dispatch */}
      {emailModalVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-600" />
                Dispatch Voucher via Email
              </h3>
              <button onClick={() => setEmailModalVoucher(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailSentNotice ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">Voucher Dispatched Successfully!</h4>
                <p className="text-xs text-slate-500">Recorded in booking activity audit trail.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Recipient Email</label>
                  <input
                    type="email"
                    required
                    value={emailRecipient}
                    onChange={e => setEmailRecipient(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Body</label>
                  <textarea
                    rows={8}
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <a
                    href={`mailto:${emailRecipient}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-teal-700 font-bold hover:underline"
                  >
                    Open in Local Email Client / Gmail
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEmailModalVoucher(null)}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendEmail}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send & Log Dispatch</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
