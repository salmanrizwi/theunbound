import React, { useState } from 'react';
import { Booking, BookingItem, User, Supplier } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { googleCalendarAutomation } from '../../services/googleCalendarAutomationService';
import { 
  Building2, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Edit, 
  Phone, 
  Mail, 
  MapPin, 
  Users, 
  ShieldCheck,
  Send,
  X,
  FileCheck,
  Tag,
  CheckSquare
} from 'lucide-react';

interface SupplierServicesManagerProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const SupplierServicesManager: React.FC<SupplierServicesManagerProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const items = booking.items || [];
  const roster = (db as any).getResources ? (db as any).getResources() : [];

  const [editingItem, setEditingItem] = useState<{ item: BookingItem; index: number } | null>(null);
  
  // Modal Edit Form State
  const [supplierName, setSupplierName] = useState('');
  const [supplierType, setSupplierType] = useState<BookingItem['supplierType']>('GROUND_RESOURCE');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierStatus, setSupplierStatus] = useState<BookingItem['supplierStatus']>('SENT_TO_SUPPLIER');
  const [supplierConfirmationRef, setSupplierConfirmationRef] = useState('');
  const [paymentCutoffDate, setPaymentCutoffDate] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('');
  const [serviceTimezone, setServiceTimezone] = useState('Asia/Tokyo (JST, UTC+9)');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [internalOpsNotes, setInternalOpsNotes] = useState('');

  // Master Suppliers
  const masterSuppliers = (db.getSuppliers ? db.getSuppliers() : []).filter((s: Supplier) => s.status === 'ACTIVE');
  const [selectedMasterSupplierId, setSelectedMasterSupplierId] = useState('');
  const [isManualSupplierException, setIsManualSupplierException] = useState(false);
  const [manualSupplierReason, setManualSupplierReason] = useState('');

  const isAdminOrOps = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';

  const openEditModal = (item: BookingItem, index: number) => {
    setEditingItem({ item, index });
    setSupplierName(item.supplierName || '');
    setSupplierType(item.supplierType || 'GROUND_RESOURCE');
    setSupplierPhone(item.supplierPhone || '');
    setSupplierEmail(item.supplierEmail || '');
    setSupplierStatus(item.supplierStatus || 'SENT_TO_SUPPLIER');
    setSupplierConfirmationRef(item.supplierConfirmationRef || '');
    setPaymentCutoffDate(item.paymentCutoffDate || '');
    setServiceDate(item.serviceDate || item.travelDate || '');
    setServiceTime(item.serviceTime || '09:00 AM');
    setServiceTimezone(item.serviceTimezone || 'Asia/Tokyo (JST, UTC+9)');
    setSupplierNotes(item.supplierNotes || '');
    setInternalOpsNotes(item.internalOpsNotes || '');

    const match = masterSuppliers.find(
      s => s.id === item.supplierId || s.name.toLowerCase() === (item.supplierName || '').toLowerCase()
    );
    if (match) {
      setSelectedMasterSupplierId(match.id);
      setIsManualSupplierException(false);
      setManualSupplierReason('');
    } else if (item.supplierName) {
      setSelectedMasterSupplierId('');
      setIsManualSupplierException(true);
      setManualSupplierReason('Existing unlisted supplier assignment');
    } else {
      setSelectedMasterSupplierId('');
      setIsManualSupplierException(false);
      setManualSupplierReason('');
    }
  };

  const handleSelectMasterSupplier = (supId: string) => {
    setSelectedMasterSupplierId(supId);
    if (!supId) return;
    const sup = masterSuppliers.find(s => s.id === supId);
    if (!sup) return;
    setSupplierName(sup.name);
    setSupplierPhone(sup.phone || sup.emergencyPhone || '');
    setSupplierEmail(sup.email || '');

    const cat = sup.categories?.[0] || '';
    if (cat.includes('Hotel')) setSupplierType('HOTEL');
    else if (cat.includes('Transfer') || cat.includes('Rail')) setSupplierType('TRANSPORTER');
    else if (cat.includes('Guide')) setSupplierType('GUIDE');
    else if (cat.includes('Activity') || cat.includes('Yacht')) setSupplierType('ACTIVITY');
    else setSupplierType('GROUND_RESOURCE');

    setIsManualSupplierException(false);
    setManualSupplierReason('');
  };

  const handleSelectFromRoster = (resourceId: string) => {
    const res = roster.find(r => r.id === resourceId);
    if (!res) return;
    setSupplierName(res.name);
    setSupplierType((res.type as any) || 'GUIDE');
    setSupplierPhone(res.phone || '');
    setSupplierEmail(res.email || '');
    setSupplierNotes(`Allocated from Verified Ground Resource Roster (${res.city}, ${res.languages?.join(', ') || 'English'}). Rating: ${res.rating || 5.0}★`);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    db.updateBookingSupplierService(
      booking.id,
      editingItem.item.id,
      {
        supplierName: supplierName.trim(),
        supplierType,
        supplierPhone: supplierPhone.trim(),
        supplierEmail: supplierEmail.trim(),
        supplierContact: `${supplierPhone.trim()} ${supplierEmail.trim() ? '/ ' + supplierEmail.trim() : ''}`.trim(),
        supplierStatus,
        supplierConfirmationRef: supplierConfirmationRef.trim(),
        paymentCutoffDate: paymentCutoffDate || undefined,
        serviceDate: serviceDate || undefined,
        serviceTime: serviceTime.trim() || undefined,
        serviceTimezone: serviceTimezone.trim() || undefined,
        supplierNotes: supplierNotes.trim() || undefined,
        internalOpsNotes: internalOpsNotes.trim() || undefined
      },
      currentUser
    );

    // Auto-create/sync SLA task in Google Calendar Automation
    if (paymentCutoffDate) {
      try {
        const generatedAt = new Date().toISOString();
        const dueAt = `${paymentCutoffDate}T17:00:00Z`;
        const task: any = {
          id: `task-supp-pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          taskType: 'SUPPLIER_PAYMENT_REMINDER',
          title: `Supplier Payment Cut-off: ${supplierName || editingItem.item.productName} (${booking.bookingReference})`,
          description: `Cut-off date for service "${editingItem.item.productName}". Ref: ${supplierConfirmationRef || 'Pending'}. Total Value: ${editingItem.item.currency} ${editingItem.item.totalPrice}.`,
          assignedToEmail: 'business@theunbound.in',
          assignedToName: booking.assignedTeamMemberName || 'Operations Lead',
          assignedDepartment: 'OPERATIONS',
          category: 'SUPPLIER_CUTOFF',
          generatedAt,
          dueAt,
          startDate: paymentCutoffDate,
          startTime: '10:00',
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          customerName: booking.customer?.leadTravelerName || 'Guest',
          customerEmail: booking.customer?.email,
          supplierName: supplierName || editingItem.item.supplierName,
          quoteValue: editingItem.item.totalPrice,
          currency: editingItem.item.currency || booking.currency,
          requiredAction: `Settle balance with supplier ${supplierName || 'Ground Partner'} before cut-off date.`,
          isSyncedToGoogleCalendar: false,
          calendarSyncStatus: 'NOT_SYNCED'
        };
        db.saveCalendarTask(task, currentUser);
        googleCalendarAutomation.syncAllPendingTasksToGoogleCalendar(currentUser);
      } catch (err) {
        console.debug('Calendar automation dispatch note:', err);
      }
    }

    setEditingItem(null);
    onRefresh();
  };

  return (
    <div id="booking-supplier-services-section" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs mb-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-teal-50 text-[#008f77]">
              <Building2 className="w-5 h-5 text-[#008f77]" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Service Items & Supplier Operations Processing
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              booking.supplierAllocationStatus === 'FULLY_CONFIRMED_BY_SUPPLIERS'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}>
              {booking.supplierAllocationStatus ? booking.supplierAllocationStatus.replace(/_/g, ' ') : 'UNALLOCATED'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Service-level tracking: ground resource allocation, confirmation reference numbers, payment cut-off deadlines, and service schedule.
          </p>
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-4">
        {items.map((item, idx) => {
          const isConfirmed = item.supplierStatus === 'CONFIRMED_BY_SUPPLIER';
          const isPending = item.supplierStatus === 'PENDING_DISPATCH' || !item.supplierStatus;
          const isSent = item.supplierStatus === 'SENT_TO_SUPPLIER' || item.supplierStatus === 'WAITING_FOR_SUPPLIER';

          return (
            <div 
              key={item.id || idx}
              id={`service-item-row-${item.id || idx}`}
              className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs transition-all hover:border-slate-300"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Service Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {item.category || 'SERVICE'}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      {item.city ? `${item.city} • ` : ''}{item.productSku || 'SKU-N/A'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      isConfirmed ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
                      isSent ? 'bg-teal-50 text-[#008f77] border-teal-200' :
                      'bg-amber-50 text-amber-900 border-amber-300'
                    }`}>
                      {item.supplierStatus ? item.supplierStatus.replace(/_/g, ' ') : 'PENDING DISPATCH'}
                    </span>
                    {item.id && db.getTasksForBookingItem(booking.id, item.id).length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#008f77] border border-teal-200 flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" />
                        <span>{db.getTasksForBookingItem(booking.id, item.id).length} Task{db.getTasksForBookingItem(booking.id, item.id).length > 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-black text-slate-900 mb-2">
                    {item.productName}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Service Date & Time</span>
                      <span className="font-bold text-slate-800">
                        {item.serviceDate || item.travelDate || 'Not Fixed'} at {item.serviceTime || '09:00 AM'}
                      </span>
                      {item.serviceTimezone && (
                        <span className="text-[10px] text-slate-400 block font-mono">{item.serviceTimezone}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Assigned Supplier</span>
                      <span className="font-bold text-slate-800 block truncate">
                        {item.supplierName || 'Unassigned / DMC In-House'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Type: {item.supplierType || 'GROUND_RESOURCE'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Supplier Ref & Cut-Off</span>
                      <span className="font-mono font-bold text-teal-800 block">
                        Ref: {item.supplierConfirmationRef || 'Awaiting Ref'}
                      </span>
                      <span className="text-[11px] text-rose-600 font-bold block">
                        Cut-Off: {item.paymentCutoffDate || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Notes & Special Instructions */}
                  {(item.supplierNotes || item.internalOpsNotes) && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {item.supplierNotes && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Supplier Instructions</span>
                          <p className="text-slate-700">{item.supplierNotes}</p>
                        </div>
                      )}
                      {item.internalOpsNotes && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                          <span className="text-[10px] font-black uppercase text-amber-800 block mb-0.5">Internal Ops Note</span>
                          <p className="text-amber-900">{item.internalOpsNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Side Pricing & Actions */}
                <div className="flex flex-col justify-between items-end gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block font-bold">Service Value</span>
                    <span className="text-lg font-black font-mono text-slate-900">
                      {formatCurrency(item.totalPrice, item.currency || booking.currency)}
                    </span>
                    {isAdminOrOps && item.unitNetPrice && (
                      <span className="text-[11px] text-slate-400 font-mono block">
                        Net: {formatCurrency(item.unitNetPrice * (item.totalPax || 1), item.currency || booking.currency)}
                      </span>
                    )}
                  </div>

                  {isAdminOrOps && (
                    <button
                      onClick={() => openEditModal(item, idx)}
                      className="px-3.5 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Manage Supplier & Times</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Supplier Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Supplier Allocation: {editingItem.item.productName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  City: {editingItem.item.city || 'N/A'} • Pax: {editingItem.item.totalPax || 2}
                </p>
              </div>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              {/* Pick from Ground Roster */}
              {roster.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-200">
                  <label className="block text-xs font-bold text-teal-900 mb-1">
                    Quick Assign from Ground Resource Roster
                  </label>
                  <select
                    onChange={(e) => handleSelectFromRoster(e.target.value)}
                    defaultValue=""
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-teal-200 text-slate-900 cursor-pointer"
                  >
                    <option value="" disabled>-- Select a verified guide, driver, or fleet partner --</option>
                    {roster.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.type} • {r.city} • {r.languages?.join(', ') || 'English'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Master Directory Supplier Controlled Dropdown */}
              <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-teal-950 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-700" />
                    Select from Master Directory (Account Management)
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isManualSupplierException}
                      onChange={e => {
                        setIsManualSupplierException(e.target.checked);
                        if (e.target.checked) setSelectedMasterSupplierId('');
                      }}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    Manual Exception
                  </label>
                </div>

                {!isManualSupplierException ? (
                  <select
                    value={selectedMasterSupplierId}
                    onChange={e => handleSelectMasterSupplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-teal-300 text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Verified Supplier Partner --</option>
                    {masterSuppliers.map((s: Supplier) => (
                      <option key={s.id} value={s.id}>
                        [{s.supplierCode}] {s.name} • {s.destination} ({s.categories?.join(', ')})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1.5 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Temporary Unlisted Supplier Exception
                    </div>
                    <input
                      type="text"
                      required={isManualSupplierException}
                      value={manualSupplierReason}
                      onChange={e => setManualSupplierReason(e.target.value)}
                      placeholder="Mandatory exception justification reason..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Supplier Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Partner Name *</label>
                  <input
                    type="text"
                    required
                    readOnly={!isManualSupplierException && !!selectedMasterSupplierId}
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Select from Master Directory above"
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      !isManualSupplierException && selectedMasterSupplierId
                        ? 'bg-slate-100 text-slate-800 font-bold border-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6]'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Type</label>
                  <select
                    value={supplierType}
                    onChange={(e: any) => setSupplierType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20 cursor-pointer"
                  >
                    <option value="HOTEL">Hotel / Resort</option>
                    <option value="GUIDE">Licensed Guide</option>
                    <option value="TRANSPORTER">Transporter / Chauffeur Fleet</option>
                    <option value="ACTIVITY">Activity / Experience Provider</option>
                    <option value="ATTRACTION">Attraction / Museum</option>
                    <option value="GROUND_RESOURCE">Ground Resource</option>
                  </select>
                </div>
              </div>

              {/* Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Phone</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="e.g. +81 3 5555 0199"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Email</label>
                  <input
                    type="email"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    placeholder="e.g. dispatch@unbounddmc.jp"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
              </div>

              {/* Status & Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirmation Status *</label>
                  <select
                    value={supplierStatus}
                    onChange={(e: any) => setSupplierStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20 cursor-pointer"
                  >
                    <option value="PENDING_DISPATCH">Pending Dispatch</option>
                    <option value="SENT_TO_SUPPLIER">Sent to Supplier</option>
                    <option value="WAITING_FOR_SUPPLIER">Waiting for Supplier Confirmation</option>
                    <option value="CONFIRMED_BY_SUPPLIER">Confirmed by Supplier (Ready)</option>
                    <option value="AMENDMENT_REQUESTED">Amendment Requested</option>
                    <option value="REJECTED_BY_SUPPLIER">Rejected by Supplier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Confirmation Ref *</label>
                  <input
                    type="text"
                    value={supplierConfirmationRef}
                    onChange={(e) => setSupplierConfirmationRef(e.target.value)}
                    placeholder="e.g. TLF-TRF-2026-9081"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
              </div>

              {/* Cut-off, Service Date, Service Time, Timezone */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Cut-Off Date</label>
                  <input
                    type="date"
                    value={paymentCutoffDate}
                    onChange={(e) => setPaymentCutoffDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Date</label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Time</label>
                  <input
                    type="text"
                    value={serviceTime}
                    onChange={(e) => setServiceTime(e.target.value)}
                    placeholder="e.g. 07:30 AM"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={serviceTimezone}
                    onChange={(e) => setServiceTimezone(e.target.value)}
                    placeholder="e.g. Asia/Tokyo (JST)"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Notes (Guest Instructions)</label>
                <textarea
                  rows={2}
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  placeholder="e.g. Chauffeur with guest nameboard at arrivals gate."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Internal Operations Notes</label>
                <textarea
                  rows={2}
                  value={internalOpsNotes}
                  onChange={(e) => setInternalOpsNotes(e.target.value)}
                  placeholder="e.g. Driver Hiroshi assigned. Plate number confirmed."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 rounded-xl text-xs font-black shadow-md shadow-[#00C6A6]/20 cursor-pointer transition-colors"
                >
                  Save Service & Supplier Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
