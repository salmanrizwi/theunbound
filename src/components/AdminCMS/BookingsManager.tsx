import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus, BookingItem, BookingSupplierAllocation } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  Calendar, 
  Clock, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Mail, 
  Phone, 
  Building2, 
  Users, 
  Eye, 
  FileText, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  X,
  Send,
  UserCheck,
  Truck,
  ExternalLink,
  Save,
  Plus
} from 'lucide-react';

export const BookingsManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [bookings, setBookings] = useState<Booking[]>(() => db.getAllBookings());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<'ALL' | 'UNALLOCATED' | 'SENT_TO_SUPPLIER' | 'CONFIRMED_BY_SUPPLIER' | 'REJECTED_BY_SUPPLIER'>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [editingAllocationItemIdx, setEditingAllocationItemIdx] = useState<number | null>(null);
  
  // Supplier allocation form state
  const [supplierName, setSupplierName] = useState('');
  const [supplierStatus, setSupplierStatus] = useState<'PENDING_DISPATCH' | 'SENT_TO_SUPPLIER' | 'CONFIRMED_BY_SUPPLIER' | 'REJECTED_BY_SUPPLIER' | 'AMENDMENT_REQUESTED'>('SENT_TO_SUPPLIER');
  const [supplierRefNumber, setSupplierRefNumber] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setBookings(db.getAllBookings());
    });
    return unsub;
  }, []);

  const handleUpdateStatus = (bookingId: string, newStatus: BookingStatus) => {
    setIsUpdatingStatus(true);
    db.updateBookingStatus(bookingId, newStatus, user);
    if (selectedBooking && selectedBooking.id === bookingId) {
      setSelectedBooking(prev => prev ? { ...prev, status: newStatus } : null);
    }
    setTimeout(() => setIsUpdatingStatus(false), 300);
  };

  const handleOpenAllocationEditor = (item: BookingItem, idx: number) => {
    setEditingAllocationItemIdx(idx);
    setSupplierName(item.supplierName || 'Japan Ground Logistics DMC');
    setSupplierStatus(item.supplierStatus || 'SENT_TO_SUPPLIER');
    setSupplierRefNumber(item.supplierConfirmationRef || '');
    setSupplierContact('');
    setSupplierNotes(item.supplierNotes || '');
  };

  const handleSaveSupplierAllocation = () => {
    if (!selectedBooking || editingAllocationItemIdx === null) return;

    const updatedItems = [...selectedBooking.items];
    const currentItem = updatedItems[editingAllocationItemIdx];

    const updatedItem: BookingItem = {
      ...currentItem,
      supplierName: supplierName,
      supplierStatus: supplierStatus,
      supplierConfirmationRef: supplierRefNumber,
      supplierNotes: supplierNotes
    };

    updatedItems[editingAllocationItemIdx] = updatedItem;

    const allocationRecord: BookingSupplierAllocation = {
      supplierId: `supp-${supplierName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      supplierName: supplierName,
      supplierType: 'DMC_PARTNER',
      serviceName: currentItem.productName,
      status: supplierStatus,
      dispatchedAt: new Date().toISOString(),
      confirmedAt: supplierStatus === 'CONFIRMED_BY_SUPPLIER' ? new Date().toISOString() : undefined,
      supplierConfirmationRef: supplierRefNumber,
      assignedContact: supplierContact,
      contactPhone: supplierContact,
      notes: supplierNotes
    };

    const existingAllocations = selectedBooking.supplierAllocations || [];
    const updatedAllocations = [
      ...existingAllocations.filter(a => a.serviceName !== currentItem.productName),
      allocationRecord
    ];

    const updatedBooking: Booking = {
      ...selectedBooking,
      items: updatedItems,
      supplierAllocations: updatedAllocations,
      updatedAt: new Date().toISOString()
    };

    db.saveBooking(updatedBooking, user);
    setSelectedBooking(updatedBooking);
    setEditingAllocationItemIdx(null);
  };

  const filteredBookings = bookings.filter(b => {
    const matchesQuery = 
      b.bookingReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer.leadTravelerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.customer.agencyName && b.customer.agencyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.customer.email && b.customer.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

    let matchesSupplier = true;
    if (supplierFilter === 'UNALLOCATED') {
      matchesSupplier = b.items.some(it => !it.supplierName || it.supplierStatus === 'PENDING_DISPATCH');
    } else if (supplierFilter === 'SENT_TO_SUPPLIER') {
      matchesSupplier = b.items.some(it => it.supplierStatus === 'SENT_TO_SUPPLIER');
    } else if (supplierFilter === 'CONFIRMED_BY_SUPPLIER') {
      matchesSupplier = b.items.every(it => it.supplierStatus === 'CONFIRMED_BY_SUPPLIER');
    } else if (supplierFilter === 'REJECTED_BY_SUPPLIER') {
      matchesSupplier = b.items.some(it => it.supplierStatus === 'REJECTED_BY_SUPPLIER');
    }

    return matchesQuery && matchesStatus && matchesSupplier;
  });

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              Booking Management & Ground Supplier Allocation
            </h2>
            <p className="text-xs text-slate-500">
              Manage received client reservations, assign ground tour/fleet suppliers, check status, and track SLAs.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">Total Active Bookings:</span>
            <span className="px-3 py-1 bg-slate-900 text-white rounded-full font-mono text-xs font-bold">
              {bookings.length}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search reference, traveler, agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-[#008972]"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="ALL">All Reservation Statuses</option>
              <option value="PENDING_CONFIRMATION">⏳ Pending Confirmation</option>
              <option value="CONFIRMED">✓ Confirmed</option>
              <option value="IN_PROGRESS">🚀 In Progress</option>
              <option value="COMPLETED">✅ Completed</option>
              <option value="CANCELLED">🚫 Cancelled</option>
            </select>
          </div>

          <div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="ALL">All Supplier Allocations</option>
              <option value="UNALLOCATED">⚠️ Unallocated Items</option>
              <option value="SENT_TO_SUPPLIER">⏳ Sent to Supplier</option>
              <option value="CONFIRMED_BY_SUPPLIER">✓ Supplier Confirmed</option>
              <option value="REJECTED_BY_SUPPLIER">🚫 Rejected / Reallocate</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-2">
            <Truck className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-bold text-slate-600 text-sm">No reservations match the filter criteria.</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-sm bg-slate-100 text-slate-900 px-3 py-1 rounded-lg">
                    {b.bookingReference}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    b.status === 'CONFIRMED' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : b.status === 'PENDING_CONFIRMATION'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Travel: {b.travelStartDate} → {b.travelEndDate}</span>
                </div>
              </div>

              {/* Guest, Agency & Financials */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Lead Traveler & Contact</span>
                  <strong className="text-slate-900 block">{b.customer.leadTravelerName}</strong>
                  <span className="text-slate-500 font-mono block">{b.customer.email}</span>
                  <span className="text-slate-500 font-mono block">{b.customer.phone}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Agency & Source</span>
                  <span className="font-bold text-[#008972] block">{b.customer.agencyName || 'Direct Traveler'}</span>
                  <span className="text-slate-500 block">Source: {b.sourceType}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Value</span>
                  <span className="text-base font-extrabold font-mono text-slate-900 block">
                    {formatCurrency(b.totalAmount, b.currency)}
                  </span>
                  <span className="text-[10px] text-slate-400">{b.items.length} Ground Service(s)</span>
                </div>

                <div className="flex items-center justify-start md:justify-end space-x-2">
                  {b.status === 'PENDING_CONFIRMATION' && (
                    <button
                      onClick={() => handleUpdateStatus(b.id, 'CONFIRMED')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Booking</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedBooking(b)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    <Truck className="w-3.5 h-3.5 text-[#00E5C0]" />
                    <span>Manage Suppliers</span>
                  </button>
                </div>
              </div>

              {/* Itemized Suppliers overview */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex flex-wrap gap-2">
                  {b.items.map((item, idx) => {
                    const suppStatus = item.supplierStatus || 'PENDING_DISPATCH';
                    return (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs flex items-center space-x-2">
                        <span className="font-bold text-slate-800 truncate max-w-xs">{item.productName}</span>
                        <span className="text-[10px] text-slate-400">({item.supplierName || 'Unassigned'})</span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                          suppStatus === 'CONFIRMED_BY_SUPPLIER' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : suppStatus === 'SENT_TO_SUPPLIER'
                            ? 'bg-blue-100 text-blue-800'
                            : suppStatus === 'REJECTED_BY_SUPPLIER'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {suppStatus.replace(/_/g, ' ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Booking Detail & Supplier Operations Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#008972]">DMC Ground Operations & Supplier Control</span>
                <h3 className="text-lg font-extrabold text-slate-900 font-mono">{selectedBooking.bookingReference}</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedBooking(null);
                  setEditingAllocationItemIdx(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Overview */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-900 block">Lead Guest & Agency Info:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                <div>Lead Traveler: <strong>{selectedBooking.customer.leadTravelerName}</strong></div>
                <div>Agency: <strong>{selectedBooking.customer.agencyName || 'Direct Traveler'}</strong></div>
                <div>Email: <strong className="font-mono">{selectedBooking.customer.email}</strong></div>
                <div>Phone: <strong className="font-mono">{selectedBooking.customer.phone}</strong></div>
                {selectedBooking.customer.specialRequests && (
                  <div className="col-span-2 sm:col-span-4 text-slate-600 bg-white p-2 rounded border mt-1">
                    Special Requests: {selectedBooking.customer.specialRequests}
                  </div>
                )}
              </div>
            </div>

            {/* Ground Services & Supplier Allocation Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center space-x-1.5">
                  <Truck className="w-4 h-4 text-[#008972]" />
                  <span>Ground Services & Supplier Allocation Matrix</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Click "Allocate / Update Supplier" to update ground status</span>
              </div>

              {selectedBooking.items.map((item, idx) => {
                const isEditingThis = editingAllocationItemIdx === idx;
                const suppStatus = item.supplierStatus || 'PENDING_DISPATCH';

                return (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <strong className="text-slate-900 block text-xs">{item.productName}</strong>
                        <span className="text-slate-500 text-[11px]">
                          📅 {item.travelDate} • 📍 {item.destinationName} • 👥 {item.totalPax} Pax
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          suppStatus === 'CONFIRMED_BY_SUPPLIER'
                            ? 'bg-emerald-100 text-emerald-800'
                            : suppStatus === 'SENT_TO_SUPPLIER'
                            ? 'bg-blue-100 text-blue-800'
                            : suppStatus === 'REJECTED_BY_SUPPLIER'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {suppStatus.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {formatCurrency(item.totalPrice, item.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Supplier Summary if already assigned */}
                    {!isEditingThis && item.supplierName && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Assigned Supplier</span>
                          <span className="font-bold text-slate-800">{item.supplierName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Supplier Voucher / Ref #</span>
                          <span className="font-mono font-bold text-slate-700">{item.supplierConfirmationRef || 'Pending Issue'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Internal Notes</span>
                          <span className="text-slate-600 truncate block">{item.supplierNotes || 'No notes logged'}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions & In-place Allocation Form */}
                    {!isEditingThis ? (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleOpenAllocationEditor(item, idx)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                        >
                          <Truck className="w-3.5 h-3.5 text-[#00E5C0]" />
                          <span>{item.supplierName ? 'Update Supplier Status' : 'Allocate Supplier'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-xl border-2 border-[#008972] space-y-3 text-xs animate-in fade-in">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="font-extrabold text-slate-900 flex items-center space-x-1">
                            <span>Supplier Assignment for {item.productName}</span>
                          </span>
                          <button
                            onClick={() => setEditingAllocationItemIdx(null)}
                            className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Supplier / Fleet Partner Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={supplierName}
                              onChange={(e) => setSupplierName(e.target.value)}
                              placeholder="e.g. Tokyo Express Transport DMC, Kyoto Local Guides"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Supplier Confirmation Status *
                            </label>
                            <select
                              value={supplierStatus}
                              onChange={(e) => setSupplierStatus(e.target.value as any)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                            >
                              <option value="SENT_TO_SUPPLIER">⏳ Sent to Supplier (Awaiting Confirmation)</option>
                              <option value="CONFIRMED_BY_SUPPLIER">✓ Confirmed & Vouched by Supplier</option>
                              <option value="REJECTED_BY_SUPPLIER">🚫 Declined by Supplier (Reallocate)</option>
                              <option value="AMENDMENT_REQUESTED">🔄 Amendment Requested</option>
                              <option value="PENDING_DISPATCH">⚠️ Pending Dispatch</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Supplier Confirmation / Booking Ref #
                            </label>
                            <input
                              type="text"
                              value={supplierRefNumber}
                              onChange={(e) => setSupplierRefNumber(e.target.value)}
                              placeholder="e.g. SUP-TYO-99482"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Supplier Contact Person / Phone
                            </label>
                            <input
                              type="text"
                              value={supplierContact}
                              onChange={(e) => setSupplierContact(e.target.value)}
                              placeholder="e.g. Kenji Sato (+81 90 1234 5678)"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Operational Notes & Dispatch Updates
                            </label>
                            <input
                              type="text"
                              value={supplierNotes}
                              onChange={(e) => setSupplierNotes(e.target.value)}
                              placeholder="e.g. Driver assigned Toyota Alphard, meeting at Terminal 3 Exit"
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setEditingAllocationItemIdx(null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-bold text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveSupplierAllocation}
                            className="px-4 py-1.5 bg-[#008972] hover:bg-[#007460] text-white rounded-lg font-bold text-xs flex items-center space-x-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Supplier Status</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
