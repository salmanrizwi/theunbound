import React, { useState, useMemo } from 'react';
import { Booking, BookingVoucher, User } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { isInternalStaff } from '../../../services/permissionEngine';
import { VoucherDocumentView } from '../VoucherDocumentView';
import { 
  FileCheck, 
  Plus, 
  Eye, 
  Edit3, 
  Printer, 
  Download, 
  Share2, 
  Mail, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  MapPin, 
  Users, 
  History, 
  X,
  Send,
  MessageCircle,
  Sparkles,
  Info
} from 'lucide-react';

interface DeskCompleteVoucherSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskCompleteVoucherSection: React.FC<DeskCompleteVoucherSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const isInternal = isInternalStaff(currentUser);

  // Modals & States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSentNotice, setEmailSentNotice] = useState(false);

  // The active complete booking voucher (if any)
  const completeVoucher: BookingVoucher | undefined = useMemo(() => {
    return (booking.vouchersList || []).find(v => v.isCompleteBookingVoucher && v.status !== 'CANCELLED');
  }, [booking.vouchersList]);

  // Normalized items
  const items = db.normalizeServiceItems(booking.items || [], booking);
  const confirmedItems = items.filter(it => it.supplierConfirmationStatus === 'Confirmed');

  // Edit fields
  const [editTitle, setEditTitle] = useState('');
  const [editLeadPax, setEditLeadPax] = useState('');
  const [editTotalPax, setEditTotalPax] = useState(1);
  const [editMeetingPoint, setEditMeetingPoint] = useState('');
  const [editEmergency, setEditEmergency] = useState('');
  const [editInclusions, setEditInclusions] = useState('');
  const [editExclusions, setEditExclusions] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editTerms, setEditTerms] = useState('');
  const [editAmendmentReason, setEditAmendmentReason] = useState('');

  const openEditModal = () => {
    if (!completeVoucher) return;
    setEditTitle(completeVoucher.serviceName || 'Complete Itinerary Master Voucher');
    setEditLeadPax(completeVoucher.leadPaxName || booking.customer?.leadTravelerName || '');
    setEditTotalPax(completeVoucher.totalPax || (booking.customer?.totalAdults || 1));
    setEditMeetingPoint(completeVoucher.meetingPoint || booking.customer?.pickupLocation || '');
    setEditEmergency(completeVoucher.emergencyContact || '+91 9811654959 (TheUnbound 24/7 Helpline)');
    setEditInclusions(Array.isArray(completeVoucher.inclusions) ? completeVoucher.inclusions.join('\n') : '');
    setEditExclusions(Array.isArray(completeVoucher.exclusions) ? completeVoucher.exclusions.join('\n') : '');
    setEditInstructions(completeVoucher.specialInstructions || '');
    setEditTerms(completeVoucher.termsAndConditions || '');
    setEditAmendmentReason('');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeVoucher) return;

    const updated: BookingVoucher = {
      ...completeVoucher,
      serviceName: editTitle,
      leadPaxName: editLeadPax,
      totalPax: Number(editTotalPax),
      meetingPoint: editMeetingPoint,
      emergencyContact: editEmergency,
      inclusions: editInclusions.split('\n').map(s => s.trim()).filter(Boolean),
      exclusions: editExclusions.split('\n').map(s => s.trim()).filter(Boolean),
      specialInstructions: editInstructions,
      termsAndConditions: editTerms,
      status: 'ISSUED'
    };

    const res = db.updateBookingVoucher(booking.id, updated, currentUser, editAmendmentReason || 'Manual edit saved');
    if (res.success) {
      setIsEditModalOpen(false);
      onRefresh();
    } else {
      alert(res.error || 'Failed to update complete voucher');
    }
  };

  const handleGenerateCompleteVoucher = () => {
    const res = db.generateBookingVoucher(booking.id, currentUser);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error || 'Failed to generate complete voucher. Ensure at least one service item is confirmed.');
    }
  };

  const handleReissue = () => {
    if (!completeVoucher) return;
    const reason = window.prompt('Enter reason for reissuing the complete booking voucher:', 'Updated itinerary schedule');
    if (!reason) return;

    const res = db.reissueBookingVoucher(booking.id, completeVoucher.id, currentUser, reason);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error || 'Failed to reissue');
    }
  };

  const openEmailModal = () => {
    if (!completeVoucher) return;
    setEmailRecipient(booking.customer?.email || booking.agentEmailSnapshot || '');
    setEmailSubject(`TheUnbound Complete Master Ground Voucher [${completeVoucher.voucherNumber}] - Booking #${booking.bookingReference}`);
    setEmailBody(
`Dear ${completeVoucher.leadPaxName || 'Traveler'},

Greetings from TheUnbound!

Please find your official Complete Ground Travel Voucher for your upcoming journey to ${booking.destinationName || 'your destination'}.

VOUCHER DETAILS:
• Voucher Reference: ${completeVoucher.voucherNumber} (v${completeVoucher.version || 1})
• Booking Reference: #${booking.bookingReference}
• Travel Dates: ${booking.travelStartDate} to ${booking.travelEndDate}
• Lead Traveler: ${completeVoucher.leadPaxName} (${completeVoucher.totalPax} Guests)
• Emergency 24/7 Contact: ${completeVoucher.emergencyContact || '+91 9811654959'}

CONFIRMED SERVICES INCLUDED:
${items.map((it, idx) => `${idx + 1}. ${it.productName} (${it.category}) - ${it.serviceDate || 'Date TBD'}`).join('\n')}

INSTRUCTIONS:
${completeVoucher.specialInstructions || 'Please have a digital or printed copy accessible upon check-in.'}

Warmest regards,
TheUnbound Operations Team`
    );
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = () => {
    if (completeVoucher) {
      db.recordBookingActivity({
        eventId: `act-email-comp-${Date.now()}`,
        bookingId: booking.id,
        eventType: 'STATUS_UPDATED',
        actorId: currentUser?.id || 'admin',
        actorRole: currentUser?.role || 'TEAM_MEMBER',
        actorName: currentUser?.name || 'Operations Lead',
        timestamp: new Date().toISOString(),
        metadata: { recipient: emailRecipient, voucherNumber: completeVoucher.voucherNumber },
        description: `Dispatched Complete Master Voucher #${completeVoucher.voucherNumber} to ${emailRecipient}`
      }, currentUser);
    }
    setEmailSentNotice(true);
    setTimeout(() => {
      setIsEmailModalOpen(false);
      setEmailSentNotice(false);
      onRefresh();
    }, 1200);
  };

  const handleShareWhatsApp = () => {
    if (!completeVoucher) return;
    const text = `*TheUnbound Complete Master Travel Voucher*\n` +
      `Voucher: *#${completeVoucher.voucherNumber}* (v${completeVoucher.version || 1})\n` +
      `Booking: *#${booking.bookingReference}*\n` +
      `Destination: ${booking.destinationName || 'Tour'}\n` +
      `Lead Traveler: ${completeVoucher.leadPaxName} (${completeVoucher.totalPax} Pax)\n` +
      `Travel Dates: ${booking.travelStartDate} - ${booking.travelEndDate}\n` +
      `Total Confirmed Services: ${items.length}\n` +
      `24/7 Helpline: ${completeVoucher.emergencyContact || '+91 9811654959'}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div id="desk-complete-voucher-section" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4" />
              Complete Booking Master Voucher
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs text-slate-500 font-bold">
              {completeVoucher ? `#${completeVoucher.voucherNumber}` : 'Pending Generation'}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Consolidated Itinerary & Ground Master Voucher
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            The single authoritative master document presented to travelers and ground representatives. Consolidates all confirmed hotel stays, transfers, daily excursions, and 24/7 emergency dispatch lines.
          </p>
        </div>

        {completeVoucher ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview Master Voucher</span>
            </button>

            {isInternal && (
              <button
                onClick={openEditModal}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
            )}

            <button
              onClick={openEmailModal}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        ) : (
          isInternal && (
            <button
              onClick={handleGenerateCompleteVoucher}
              disabled={confirmedItems.length === 0}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Master Voucher Now</span>
            </button>
          )
        )}
      </div>

      {completeVoucher ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          {/* Status & Version Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    {completeVoucher.serviceName || 'Complete Master Booking Voucher'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                    v{completeVoucher.version || 1}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Issued: {new Date(completeVoucher.issuedAt || completeVoucher.generatedAt || Date.now()).toLocaleDateString()} by {completeVoucher.generatedByName || 'Operations Desk'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{completeVoucher.status || 'ISSUED'}</span>
              </span>

              {isInternal && (
                <button
                  onClick={handleReissue}
                  className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-purple-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reissue</span>
                </button>
              )}

              {completeVoucher.versionHistory && completeVoucher.versionHistory.length > 0 && (
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History ({completeVoucher.versionHistory.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Master Parameters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Lead Traveler</span>
              <span className="text-sm font-black text-slate-900 mt-0.5 block">
                {completeVoucher.leadPaxName}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Party of {completeVoucher.totalPax} Guests
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Destination / Region</span>
              <span className="text-sm font-black text-slate-900 mt-0.5 block">
                {booking.destinationName || completeVoucher.destination}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {booking.travelStartDate} to {booking.travelEndDate}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Pickup / Meeting Point</span>
              <span className="text-sm font-bold text-slate-800 mt-0.5 block truncate">
                {completeVoucher.meetingPoint || booking.customer?.pickupLocation || 'Airport / Hotel Lobby'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Rep Meet & Greet Included
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">24/7 Emergency Dispatch</span>
              <span className="text-sm font-bold text-teal-800 mt-0.5 block">
                {completeVoucher.emergencyContact || '+91 9811654959'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Operational duty manager on call
              </span>
            </div>
          </div>

          {/* Chronological Service Items Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Included Ground Services ({items.length} Items)</span>
              <span className="text-[11px] font-normal text-slate-400">Snapshot locked into document</span>
            </h4>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {items.map((item, idx) => (
                <div key={item.id} className="p-3.5 bg-white hover:bg-slate-50 flex items-center justify-between text-xs transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-800 font-bold text-center flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <h5 className="font-bold text-slate-900">{item.productName}</h5>
                      <p className="text-[11px] text-slate-400">
                        {item.category} • Date: {item.serviceDate || item.travelDate || 'TBD'} • {item.city || booking.destinationName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      item.supplierConfirmationStatus === 'Confirmed'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {item.supplierConfirmationStatus || 'Pending Confirmation'}
                    </span>
                    {item.supplierConfirmationRef && (
                      <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                        Ref: {item.supplierConfirmationRef}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inclusions & Instructions Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Consolidated Inclusions</span>
              </h5>
              <div className="text-slate-600 space-y-1">
                {Array.isArray(completeVoucher.inclusions) && completeVoucher.inclusions.length > 0 ? (
                  completeVoucher.inclusions.map((inc, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-teal-600">•</span>
                      <span>{inc}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 italic">All items explicitly enumerated in the confirmed itinerary breakdown above.</p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Special Passenger Instructions</span>
              </h5>
              <p className="text-slate-600 leading-relaxed">
                {completeVoucher.specialInstructions || 'Please retain this document throughout your trip. Present to local drivers and hotel front-desk staff at each destination.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4">
          <FileCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900">No Master Voucher Generated</h3>
            <p className="text-xs text-slate-500 mt-1">
              Generate the complete consolidated itinerary voucher once ground suppliers and service items are reviewed and confirmed.
            </p>
          </div>
          {isInternal && (
            <button
              onClick={handleGenerateCompleteVoucher}
              disabled={confirmedItems.length === 0}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Complete Booking Voucher</span>
            </button>
          )}
        </div>
      )}

      {/* MODAL 1: Master Voucher Preview */}
      {isPreviewOpen && completeVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full my-8">
            <VoucherDocumentView
              voucher={completeVoucher}
              onClose={() => setIsPreviewOpen(false)}
              onRegenerate={() => {
                handleReissue();
                setIsPreviewOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Master Voucher */}
      {isEditModalOpen && completeVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-teal-600" />
                  Edit Complete Master Voucher #{completeVoucher.voucherNumber}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Update itinerary instructions, lead traveler details, or emergency numbers.
                </p>
              </div>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Voucher Header Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lead Traveler Name</label>
                <input
                  type="text"
                  required
                  value={editLeadPax}
                  onChange={e => setEditLeadPax(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Total Pax Count</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editTotalPax}
                  onChange={e => setEditTotalPax(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Primary Pickup / Meeting Point</label>
                <input
                  type="text"
                  value={editMeetingPoint}
                  onChange={e => setEditMeetingPoint(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">24/7 Operations Helpline</label>
                <input
                  type="text"
                  value={editEmergency}
                  onChange={e => setEditEmergency(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Inclusions (One per line)</label>
                <textarea
                  rows={3}
                  value={editInclusions}
                  onChange={e => setEditInclusions(e.target.value)}
                  placeholder="e.g. All intercity transfers&#10;Daily breakfast at hotels"
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Exclusions (One per line)</label>
                <textarea
                  rows={3}
                  value={editExclusions}
                  onChange={e => setEditExclusions(e.target.value)}
                  placeholder="e.g. Personal travel insurance&#10;Visa fees"
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Special Passenger Instructions</label>
                <textarea
                  rows={2}
                  value={editInstructions}
                  onChange={e => setEditInstructions(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={editTerms}
                  onChange={e => setEditTerms(e.target.value)}
                  placeholder="Standard voucher conditions apply."
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="sm:col-span-2 p-3 bg-amber-50 rounded-2xl border border-amber-200">
                <label className="font-bold text-amber-900 block mb-1">Amendment Reason (Audited)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corrected passenger spelling / updated emergency desk contact"
                  value={editAmendmentReason}
                  onChange={e => setEditAmendmentReason(e.target.value)}
                  className="w-full p-2 rounded-xl border border-amber-300 bg-white text-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Save Master Voucher
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Version History */}
      {isHistoryOpen && completeVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  Master Voucher History
                </h3>
                <p className="text-[11px] text-slate-400">Current version: v{completeVoucher.version || 1}</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              {completeVoucher.versionHistory && completeVoucher.versionHistory.length > 0 ? (
                completeVoucher.versionHistory.map((ver, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Version {ver.version}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ver.amendedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600">Amended By: <strong>{ver.amendedByName || 'Operations Staff'}</strong></p>
                    <p className="text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100 mt-1">
                      "{ver.amendmentReason || 'Manual adjustment'}"
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400">No previous versions.</div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-right shrink-0">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Email Dispatch */}
      {isEmailModalOpen && completeVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-600" />
                Dispatch Master Itinerary Voucher
              </h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailSentNotice ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">Master Voucher Dispatched!</h4>
                <p className="text-xs text-slate-500">Activity logged into booking audit trail.</p>
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
                    rows={9}
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
                    Open in Local Email / Gmail
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEmailModalOpen(false)}
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
