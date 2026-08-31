import React, { useState, useEffect } from 'react';
import { Booking, User, BookingStatus } from '../types';
import { AppDatabase } from '../services/db';
import { formatCurrency } from '../services/pricingEngine';
import { 
  X, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Mail, 
  Phone, 
  FileText, 
  Building2, 
  Users, 
  Eye, 
  Filter,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Copy
} from 'lucide-react';

interface BookingsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSelectBookingForView?: (booking: Booking) => void;
}

export const BookingsManagementModal: React.FC<BookingsManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectBookingForView
}) => {
  const db = AppDatabase.getInstance();
  const [bookings, setBookings] = useState<Booking[]>(() => db.getBookingsForUser(currentUser));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setBookings(db.getBookingsForUser(currentUser));
    });
    return unsub;
  }, [currentUser]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b-2 border-[#00C6A6]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00E5C0] bg-white/10 px-2 py-0.5 rounded-md">
                  Ground Operations Center
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">24–48h SLA Tracking</span>
              </div>
              <h2 className="text-xl font-bold font-sans mt-0.5 text-white">
                Bookings & Reservations Hub ({bookings.length})
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 24-48 Hour SLA Tracker Banner */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center space-x-2 text-emerald-950 font-medium">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>DMC Ground Protocol:</strong> All submitted bookings undergo local guide allotment and partner voucher dispatch within <strong>24–48 hours</strong>.
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-800 shrink-0">
            Emergency Desk: 011-41185542
          </span>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, traveler, tour..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
            />
          </div>

          <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'PENDING_CONFIRMATION', 'CONFIRMED', 'COMPLETED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'ALL' ? 'All Bookings' : st === 'PENDING_CONFIRMATION' ? 'Pending 24-48h' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No bookings found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery ? 'Try adjusting your search criteria.' : 'You haven’t submitted any bookings yet. Book any product or itinerary quote to see it here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-4 sm:p-5 shadow-xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span className="font-mono font-extrabold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {b.bookingReference}
                      </span>
                      <button
                        onClick={() => handleCopy(b.bookingReference)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                        title="Copy Reference"
                      >
                        {copiedId === b.bookingReference ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}>
                        {b.status === 'PENDING_CONFIRMATION' ? 'Pending 24-48h Update' : b.status}
                      </span>

                      <span className="text-[11px] text-slate-500 font-medium">
                        Submitted: {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Lead Traveler</span>
                        <span className="font-bold text-slate-800">{b.customer.leadTravelerName}</span>
                        {b.customer.agencyName && (
                          <span className="text-[10px] text-emerald-700 block">Agency: {b.customer.agencyName}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Travel Dates & Pax</span>
                        <span className="text-slate-700">📅 {b.travelStartDate} {b.travelEndDate && b.travelEndDate !== b.travelStartDate ? `to ${b.travelEndDate}` : ''}</span>
                        <span className="text-[10px] text-slate-500 block">
                          👥 {(b.items || []).reduce((acc, i) => acc + (i.totalPax || 1), 0)} Pax ({(b.items || []).length} services)
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Contact & Updates</span>
                        <span className="font-mono text-slate-700 block truncate">{b.customer.email}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{b.customer.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      {(b.items || []).slice(0, 2).map((item, idx) => (
                        <span key={idx} className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-md truncate max-w-[200px]">
                          {item.productName}
                        </span>
                      ))}
                      {(b.items || []).length > 2 && (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          +{(b.items || []).length - 2} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Value</span>
                      <span className="text-lg font-black font-mono text-slate-900">
                        {formatCurrency(b.totalAmount, b.currency)}
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedBooking(b)}
                      className="mt-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#00E5C0]" />
                      <span>View Dossier</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#008972]" />
            <span>TheUnbound DMC Ground Reservation Protocol</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Selected Booking Detail Drawer/Submodal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Booking Dossier</span>
                <h3 className="text-lg font-extrabold text-slate-900 font-mono">{selectedBooking.bookingReference}</h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              <strong>Notice:</strong> {selectedBooking.confirmationNotice}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-500">Booked Services</h4>
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
              <span className="font-bold">Total Confirmed Amount:</span>
              <span className="font-mono font-black text-base text-[#00E5C0]">
                {formatCurrency(selectedBooking.totalAmount, selectedBooking.currency)}
              </span>
            </div>

            {selectedBooking.notificationEmailsSent && (selectedBooking.notificationEmailsSent || []).length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#008972]" />
                  <span>Dispatched Notifications ({(selectedBooking.notificationEmailsSent || []).length})</span>
                </h4>
                <div className="space-y-1.5">
                  {(selectedBooking.notificationEmailsSent || []).map((em, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-lg text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 block">{em.subject}</span>
                        <span className="text-[10px] text-slate-500">To: {em.recipient} • Status: {em.status}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold">Sent</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
