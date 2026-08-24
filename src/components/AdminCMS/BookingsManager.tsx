import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus } from '../../types';
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
  UserCheck
} from 'lucide-react';

export const BookingsManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [bookings, setBookings] = useState<Booking[]>(() => db.getAllBookings());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  const filteredBookings = bookings.filter(b => {
    const matchesQuery = 
      b.bookingReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer.leadTravelerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.customer.agencyName && b.customer.agencyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      b.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const pendingCount = bookings.filter(b => b.status === 'PENDING_CONFIRMATION').length;
  const confirmedCount = bookings.filter(b => b.status === 'CONFIRMED').length;

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#008972]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-sans">
                Bookings & Ground Operations Command
              </h2>
              <p className="text-xs text-slate-500">
                Manage agent bookings, voucher dispatches, and enforce 24–48h operational confirmation SLAs.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-amber-900 font-bold">
              <span>Pending SLA (24-48h): </span>
              <span className="font-mono text-sm ml-1 text-amber-700">{pendingCount}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-900 font-bold">
              <span>Confirmed: </span>
              <span className="font-mono text-sm ml-1 text-emerald-700">{confirmedCount}</span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, agency, guest..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
            />
          </div>

          <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {st === 'ALL' ? 'All Bookings' : st === 'PENDING_CONFIRMATION' ? 'Pending 24-48h' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-bold text-sm text-slate-700">No bookings found</p>
            <p className="text-xs text-slate-400">Bookings submitted by travel agents or travelers will appear here instantly.</p>
          </div>
        ) : (
          filteredBookings.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-5 shadow-xs transition-all space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                  <span className="font-mono font-extrabold text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">
                    {b.bookingReference}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                    b.status === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : b.status === 'PENDING_CONFIRMATION'
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {b.status === 'PENDING_CONFIRMATION' ? 'Pending 24-48h Update' : b.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    Booked on {new Date(b.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-bold uppercase">Total Value:</span>
                  <span className="font-mono font-black text-slate-900 text-base">
                    {formatCurrency(b.totalAmount, b.currency)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Lead Guest / Agency</span>
                  <p className="font-bold text-slate-900 text-sm">{b.customer.leadTravelerName}</p>
                  {b.customer.agencyName && (
                    <p className="text-[#008972] font-semibold text-xs mt-0.5">Agency: {b.customer.agencyName}</p>
                  )}
                  <p className="text-slate-500 font-mono text-[11px] mt-0.5">{b.customer.email}</p>
                  <p className="text-slate-500 font-mono text-[11px]">{b.customer.phone}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Ground Services ({b.items.length})</span>
                  <div className="space-y-1">
                    {b.items.map((item, idx) => (
                      <div key={idx} className="text-slate-700 text-xs">
                        • <strong>{item.productName}</strong> ({item.travelDate})
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-between items-start sm:items-end">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">24-48h SLA Notice</span>
                    <span className="text-[11px] text-slate-600 block max-w-xs">
                      {b.confirmationNotice}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mt-3">
                    {b.status === 'PENDING_CONFIRMATION' && (
                      <button
                        onClick={() => handleUpdateStatus(b.id, 'CONFIRMED')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Booking</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedBooking(b)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#00E5C0]" />
                      <span>Details & Dossier</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DMC Ground Operations Record</span>
                <h3 className="text-lg font-extrabold text-slate-900 font-mono">{selectedBooking.bookingReference}</h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-900 block">Customer Information:</span>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>Lead Traveler: <strong>{selectedBooking.customer.leadTravelerName}</strong></div>
                <div>Agency: <strong>{selectedBooking.customer.agencyName || 'Direct B2B'}</strong></div>
                <div>Email: <strong className="font-mono">{selectedBooking.customer.email}</strong></div>
                <div>Phone: <strong className="font-mono">{selectedBooking.customer.phone}</strong></div>
                {selectedBooking.customer.specialRequests && (
                  <div className="col-span-2 text-slate-600 bg-white p-2 rounded border mt-1">
                    Special Requests: {selectedBooking.customer.specialRequests}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-500">Booked Items & Pricing</h4>
              {selectedBooking.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border flex justify-between text-xs">
                  <div>
                    <strong className="text-slate-900 block">{item.productName}</strong>
                    <span className="text-slate-500 text-[11px]">📅 {item.travelDate} • 📍 {item.destinationName} • 👥 {item.totalPax} Pax</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(item.totalPrice, item.currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-900 text-white rounded-xl flex justify-between items-center text-xs">
              <span className="font-bold">Total Confirmed Value:</span>
              <span className="font-mono font-black text-base text-[#00E5C0]">
                {formatCurrency(selectedBooking.totalAmount, selectedBooking.currency)}
              </span>
            </div>

            {selectedBooking.notificationEmailsSent.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#008972]" />
                  <span>Dispatched Notifications ({selectedBooking.notificationEmailsSent.length})</span>
                </h4>
                <div className="space-y-1.5">
                  {selectedBooking.notificationEmailsSent.map((em, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-lg text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 block">{em.subject}</span>
                        <span className="text-[10px] text-slate-500">To: {em.recipient} ({em.recipientType})</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold">Delivered</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t">
              <div className="flex space-x-2">
                <button
                  onClick={() => handleUpdateStatus(selectedBooking.id, 'CONFIRMED')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Mark Confirmed
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedBooking.id, 'CANCELLED')}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold"
                >
                  Cancel Booking
                </button>
              </div>

              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
