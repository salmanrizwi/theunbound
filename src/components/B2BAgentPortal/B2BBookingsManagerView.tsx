import React, { useState, useMemo } from 'react';
import { 
  BookmarkCheck, 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  Download, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Eye, 
  ShieldCheck, 
  Users,
  ChevronRight,
  Printer
} from 'lucide-react';
import { Booking, BookingStatus, CurrencyCode } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';

interface B2BBookingsManagerViewProps {
  onOpenCreateQuote: () => void;
}

export const B2BBookingsManagerView: React.FC<B2BBookingsManagerViewProps> = ({
  onOpenCreateQuote
}) => {
  const { user } = useAuth();
  const { currency } = useQuotation();
  const db = AppDatabase.getInstance();

  const bookings = useMemo(() => {
    return db.getBookingsForUser(user);
  }, [db, user]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Booking | null>(null);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = 
        b.bookingReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.leadPassengerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.leadPassengerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.destinationName && b.destinationName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = selectedStatus === 'ALL' || b.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, selectedStatus]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
              Guaranteed Operations Reservations
            </span>
            <span className="text-xs text-slate-400">({bookings.length} Confirmed Records)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Bookings & Travel Vouchers</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Track confirmed guest manifests, download official TheUnbound supplier vouchers, and monitor on-ground operations SLAs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenCreateQuote}
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer"
          >
            <span>+ New Quotation</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by booking reference (e.g. TUB-BK-), guest name, or destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
        >
          <option value="ALL">All Booking Statuses</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="PENDING_PAYMENT">PENDING PAYMENT</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
        </select>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <BookmarkCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No bookings found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven't converted any quotations to confirmed bookings yet. Convert an approved quotation to issue official vouchers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Lead Passenger</th>
                  <th className="py-3 px-4">Destination & Dates</th>
                  <th className="py-3 px-4">Pax</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">{b.bookingReference}</div>
                      <div className="text-[10px] text-slate-400">Quote: {b.quoteNumber || 'Direct'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{b.leadPassengerName}</div>
                      <div className="text-[10px] text-slate-400">{b.leadPassengerEmail}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center space-x-1 font-medium text-slate-700 block">
                        <MapPin className="w-3 h-3 text-[#00C6A6]" />
                        <span>{b.destinationName || 'Japan'}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {b.travelStartDate || 'Upcoming'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {b.passengers?.length || 2} Guests
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatCurrency(b.totalAmount, b.currency || currency)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.status === 'PENDING_PAYMENT'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedBookingDetails(b)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          View Voucher
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Voucher Modal */}
      {selectedBookingDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                  Official Wholesale Confirmation Voucher
                </span>
                <h3 className="text-xl font-black text-slate-900 font-sans">{selectedBookingDetails.bookingReference}</h3>
                <span className="text-xs text-slate-400">Lead Guest: {selectedBookingDetails.leadPassengerName}</span>
              </div>
              <button
                onClick={() => setSelectedBookingDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Destination:</span>
                <span className="font-bold text-slate-900">{selectedBookingDetails.destinationName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Travel Date:</span>
                <span className="font-bold text-slate-900">{selectedBookingDetails.travelStartDate || 'Confirmed 2026'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Guaranteed SLA:</span>
                <span className="text-emerald-700 font-bold">24/7 Operations Desk Dispatch</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Amount:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(selectedBookingDetails.totalAmount, selectedBookingDetails.currency || currency)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Voucher</span>
              </button>

              <button
                onClick={() => setSelectedBookingDetails(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
