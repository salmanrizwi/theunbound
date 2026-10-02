import React, { useState, useMemo, useEffect } from 'react';
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
  Printer,
  CreditCard,
  Building2,
  AlertTriangle,
  FileWarning,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Booking, BookingStatus, CurrencyCode } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { BookingWorkspace } from '../Bookings/BookingWorkspace';

interface B2BBookingsManagerViewProps {
  onOpenCreateQuote: () => void;
}

export const B2BBookingsManagerView: React.FC<B2BBookingsManagerViewProps> = ({
  onOpenCreateQuote
}) => {
  const { user } = useAuth();
  const { currency } = useQuotation();
  const db = AppDatabase.getInstance();

  const [bookings, setBookings] = useState<Booking[]>(() => db.getBookingsForUser(user));
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ACTION_REQUIRED' | 'UPCOMING' | 'CONFIRMED' | 'COMPLETED'>('ACTION_REQUIRED');

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setBookings(db.getBookingsForUser(user));
    });
    return unsub;
  }, [user]);

  // Categorize bookings
  const { actionRequiredBookings, upcomingBookings, confirmedBookings, completedBookings } = useMemo(() => {
    const actionRequired: Booking[] = [];
    const upcoming: Booking[] = [];
    const confirmed: Booking[] = [];
    const completed: Booking[] = [];

    bookings.forEach(b => {
      const isActionReq = 
        b.status === 'WAITING_FOR_UPDATE' || 
        b.paymentStatus === 'UNPAID' || 
        b.paymentStatus === 'PENDING' ||
        b.documentStatus === 'DOCUMENTS_PENDING' ||
        b.documentStatus === 'PENDING' ||
        !b.documentStatus;

      if (b.status === 'COMPLETED') {
        completed.push(b);
      } else if (isActionReq) {
        actionRequired.push(b);
      } else if (b.status === 'CONFIRMED') {
        confirmed.push(b);
      } else {
        upcoming.push(b);
      }
    });

    return { 
      actionRequiredBookings: actionRequired, 
      upcomingBookings: upcoming, 
      confirmedBookings: confirmed, 
      completedBookings: completed 
    };
  }, [bookings]);

  const currentTabBookings = useMemo(() => {
    let list: Booking[] = [];
    if (activeTab === 'ACTION_REQUIRED') list = actionRequiredBookings;
    else if (activeTab === 'UPCOMING') list = upcomingBookings;
    else if (activeTab === 'CONFIRMED') list = confirmedBookings;
    else if (activeTab === 'COMPLETED') list = completedBookings;

    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(b => 
      b.bookingReference.toLowerCase().includes(q) ||
      b.customer?.leadTravelerName?.toLowerCase().includes(q) ||
      b.customer?.agencyName?.toLowerCase().includes(q) ||
      (b.destinationName && b.destinationName.toLowerCase().includes(q)) ||
      b.items?.some(it => it.productName.toLowerCase().includes(q))
    );
  }, [activeTab, actionRequiredBookings, upcomingBookings, confirmedBookings, completedBookings, searchQuery]);

  if (selectedBookingId) {
    return (
      <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 py-6">
        <BookingWorkspace
          bookingId={selectedBookingId}
          currentUser={user}
          onBack={() => setSelectedBookingId(null)}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
              B2B Live Operations & Reservations
            </span>
            <span className="text-xs text-slate-400 font-mono">({bookings.length} Total Bookings)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Bookings & Travel Operations</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Manage passenger manifest passports & PAN, upload wire transfer receipts, track ground supplier vouchers, and view live itinerary operations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenCreateQuote}
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
          >
            <span>+ Build New Quotation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Categorized Tabs with Real Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          {/* Action Required (Strictly RED) */}
          <button
            onClick={() => setActiveTab('ACTION_REQUIRED')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'ACTION_REQUIRED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Action Required</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'ACTION_REQUIRED' ? 'bg-white text-rose-600' : 'bg-rose-600 text-white'
            }`}>
              {actionRequiredBookings.length}
            </span>
          </button>

          {/* Upcoming Travel */}
          <button
            onClick={() => setActiveTab('UPCOMING')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'UPCOMING'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Upcoming Travel</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
              {upcomingBookings.length}
            </span>
          </button>

          {/* Confirmed */}
          <button
            onClick={() => setActiveTab('CONFIRMED')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'CONFIRMED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Confirmed</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
              {confirmedBookings.length}
            </span>
          </button>

          {/* Completed */}
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'COMPLETED'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Completed Trips</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
              {completedBookings.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search booking # or guest..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
          />
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {currentTabBookings.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <BookmarkCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No bookings in this category</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All bookings in this stage have been processed or moved to operational execution.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Lead Traveler</th>
                  <th className="py-3 px-4">Destination & Dates</th>
                  <th className="py-3 px-4">PAX Manifest</th>
                  <th className="py-3 px-4">Payment & Docs</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentTabBookings.map(b => {
                  const maxPax = (b.customer?.totalAdults || 0) + (b.customer?.totalChildren || 0) || 
                    b.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) || 1;
                  const currentPax = b.passengers?.length || 0;
                  const paymentSummary = db.calculateBookingPaymentSummary(b);
                  const isActionReq = 
                    b.paymentStatus === 'UNPAID' || 
                    b.paymentStatus === 'PENDING' ||
                    b.documentStatus === 'DOCUMENTS_PENDING' ||
                    !b.documentStatus;

                  return (
                    <tr 
                      key={b.id} 
                      onClick={() => setSelectedBookingId(b.id)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isActionReq ? 'bg-rose-50/10' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-900">{b.bookingReference}</div>
                        <div className="text-[10px] text-slate-400">Created: {new Date(b.createdAt).toLocaleDateString()}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{b.customer?.leadTravelerName || b.leadPassengerName || 'Guest'}</div>
                        <div className="text-[10px] text-slate-400">{b.customer?.email || b.leadPassengerEmail}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center space-x-1 font-medium text-slate-700 block">
                          <MapPin className="w-3 h-3 text-[#00C6A6]" />
                          <span>{b.destinationName || b.items?.[0]?.city || 'Japan'}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {b.travelStartDate || 'Upcoming'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-700 font-mono">
                          {currentPax}/{maxPax} Configured
                        </div>
                        {currentPax < maxPax && (
                          <span className="text-[10px] text-rose-600 font-bold block">
                            Missing {maxPax - currentPax} pax
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          {formatCurrency(paymentSummary.totalAmount, b.currency || currency)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            b.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            b.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {b.paymentStatus ? b.paymentStatus.replace(/_/g, ' ') : 'PENDING'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            b.documentStatus === 'DOCUMENTS_VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {b.documentStatus ? b.documentStatus.replace(/_/g, ' ') : 'DOCS PENDING'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                          b.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'PROCESSING'
                            ? 'bg-blue-100 text-blue-800'
                            : b.status === 'WAITING_FOR_UPDATE'
                            ? 'bg-rose-100 text-rose-800 font-extrabold'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {b.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBookingId(b.id);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          Workspace
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
