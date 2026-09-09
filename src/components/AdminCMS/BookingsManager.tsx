import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../services/pricingEngine';
import { BookingDashboardCards } from '../Bookings/BookingDashboardCards';
import { BookingWorkspace } from '../Bookings/BookingWorkspace';
import { 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Users, 
  CreditCard, 
  Building2, 
  FileText, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileWarning, 
  Sparkles,
  ArrowUpDown,
  Download,
  RotateCcw,
  X
} from 'lucide-react';
import { RecordReminderIndicator } from '../ActionCenter/RecordReminderIndicator';
import { CalendarTask } from '../../types';

export interface BookingsManagerProps {
  initialBookingId?: string | null;
  onOpenActionCenter?: (task: CalendarTask) => void;
}

export const BookingsManager: React.FC<BookingsManagerProps> = ({
  initialBookingId,
  onOpenActionCenter
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  
  const [bookings, setBookings] = useState<Booking[]>(() => db.getAllBookings());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(initialBookingId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Booking Form State
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [totalAdults, setTotalAdults] = useState('2');
  const [totalChildren, setTotalChildren] = useState('0');
  const [agencyName, setAgencyName] = useState('');
  const [travelStartDate, setTravelStartDate] = useState('');
  const [travelEndDate, setTravelEndDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [initialAmount, setInitialAmount] = useState('2500');

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setBookings(db.getAllBookings());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (initialBookingId) {
      const clean = initialBookingId.replace(/^#/, '').trim().toLowerCase();
      const match = bookings.find(b => 
        b.id === initialBookingId || 
        b.bookingReference === initialBookingId ||
        b.id.toLowerCase() === clean ||
        b.bookingReference?.toLowerCase() === clean
      );
      if (match) {
        setSelectedBookingId(match.id);
      } else {
        setSelectedBookingId(initialBookingId);
      }
    }
  }, [initialBookingId, bookings]);

  const handleSelectFilter = (filterKey: string) => {
    setActiveFilter(filterKey);
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim() || !leadEmail.trim()) return;

    const adults = Math.max(1, parseInt(totalAdults) || 1);
    const children = Math.max(0, parseInt(totalChildren) || 0);
    const totalPax = adults + children;
    const amount = parseFloat(initialAmount) || 2500;

    const newBooking = db.createBooking({
      sourceType: 'MANUAL',
      destinationName: 'Japan',
      currency: (currency || 'USD') as any,
      totalAmount: amount,
      travelStartDate: travelStartDate || '2026-10-15',
      travelEndDate: travelEndDate || '2026-10-22',
      customer: {
        leadTravelerName: leadName.trim(),
        bookerName: leadName.trim(),
        email: leadEmail.trim(),
        phone: leadPhone.trim() || '+1 555 019 2831',
        nationality: 'Indian',
        totalAdults: adults,
        totalChildren: children
      },
      items: [
        {
          id: `item-${Date.now()}-1`,
          productId: 'PKG-JP-CUSTOM-01',
          productSku: 'PKG-JP-CUSTOM-01',
          productName: 'Bespoke Private Japan Itinerary & DMC Land Arrangements',
          destinationName: 'Japan',
          category: 'PACKAGE',
          travelDate: travelStartDate || '2026-10-15',
          serviceDate: travelStartDate || '2026-10-15',
          serviceTime: '09:00 AM',
          serviceTimezone: 'Asia/Tokyo (JST, UTC+9)',
          unitNetPrice: amount / totalPax,
          unitSellingPrice: amount / totalPax,
          totalPrice: amount,
          currency: currency || 'USD',
          totalPax: totalPax,
          adults: adults,
          children: children,
          infants: 0,
          city: 'Tokyo & Kyoto',
          supplierStatus: 'PENDING_DISPATCH',
          supplierName: 'Unbound Ground Operations Japan',
          supplierType: 'GROUND_RESOURCE'
        }
      ]
    }, user);

    setIsCreateModalOpen(false);
    setSelectedBookingId(newBooking.id);
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    // Search matching
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      !q ||
      b.bookingReference.toLowerCase().includes(q) ||
      b.customer?.leadTravelerName?.toLowerCase().includes(q) ||
      b.customer?.name?.toLowerCase().includes(q) ||
      b.customer?.email?.toLowerCase().includes(q) ||
      b.agencyName?.toLowerCase().includes(q) ||
      b.items?.some(it => it.productName.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // Channel filter
    if (channelFilter !== 'ALL' && b.channel !== channelFilter) return false;

    // Metrics Card Active Filter
    if (activeFilter === 'STATUS_NEW') return b.status === 'NEW' || b.status === 'PENDING_CONFIRMATION';
    if (activeFilter === 'STATUS_TO_BE_PROCESSED') return b.status === 'TO_BE_PROCESSED';
    if (activeFilter === 'STATUS_PROCESSING') return b.status === 'PROCESSING' || b.status === 'IN_PROGRESS';
    if (activeFilter === 'STATUS_WAITING_FOR_UPDATE') return b.status === 'WAITING_FOR_UPDATE';
    if (activeFilter === 'PAY_PENDING') return b.paymentStatus === 'PENDING_PAYMENT';
    if (activeFilter === 'PAY_PARTIAL') return b.paymentStatus === 'PARTIALLY_PAID';
    if (activeFilter === 'PAY_PAID') return b.paymentStatus === 'PAID';
    if (activeFilter === 'DOCS_PENDING') return b.documentStatus === 'DOCUMENTS_PENDING' || (b.missingDocuments && b.missingDocuments.length > 0);
    if (activeFilter === 'SUPPLIER_PENDING') return b.supplierAllocationStatus !== 'FULLY_CONFIRMED_BY_SUPPLIERS' && b.status !== 'CANCELLED' && b.status !== 'COMPLETED';
    if (activeFilter === 'STATUS_CONFIRMED') return b.status === 'CONFIRMED';
    if (activeFilter === 'STATUS_CANCELLED') return b.status === 'CANCELLED';
    if (activeFilter === 'STATUS_COMPLETED') return b.status === 'COMPLETED';

    return true;
  });

  // If a booking is selected, render the full Workspace
  if (selectedBookingId) {
    return (
      <div id="booking-management-view" className="p-6 max-w-7xl mx-auto">
        <BookingWorkspace
          bookingId={selectedBookingId}
          currentUser={user}
          onBack={() => setSelectedBookingId(null)}
        />
      </div>
    );
  }

  return (
    <div id="booking-management-dashboard-view" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-stone-100">
                Booking Operations Engine
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Full end-to-end booking journey: Passengers, Documents, Payments, Ground Suppliers, & Confirmation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-create-booking"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create Booking Request
          </button>
        </div>
      </div>

      {/* 13 Live Dashboard Status Cards */}
      <BookingDashboardCards
        bookings={bookings}
        activeFilter={activeFilter}
        onSelectFilter={handleSelectFilter}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-bookings"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Booking Ref, Lead Traveler, Email, Agency, or SKU..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            id="select-channel-filter"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-medium"
          >
            <option value="ALL">All Channels</option>
            <option value="B2B_PORTAL">B2B Agent Portal</option>
            <option value="DIRECT_WEB">Direct B2C Web</option>
            <option value="INTERNAL_OPS">Internal Ops</option>
          </select>

          {activeFilter !== 'ALL' && (
            <button
              onClick={() => setActiveFilter('ALL')}
              className="px-3 py-2 rounded-xl text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
              No Bookings Found Matching Current Criteria
            </p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              Try adjusting your search query or reset the dashboard metric card filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table id="table-booking-records" className="w-full text-left text-xs">
              <thead className="bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Booking Ref & Date</th>
                  <th className="py-3 px-4">Lead Traveler & Agency</th>
                  <th className="py-3 px-4">Travel Dates & PAX</th>
                  <th className="py-3 px-4">Value & Payment</th>
                  <th className="py-3 px-4">Documents</th>
                  <th className="py-3 px-4">Suppliers</th>
                  <th className="py-3 px-4">Operational Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {filteredBookings.map((b) => {
                  const maxPax = (b.customer?.totalAdults || 0) + (b.customer?.totalChildren || 0) || 
                    b.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) || 1;
                  const currentPax = b.passengers?.length || 0;
                  const paymentSummary = db.calculateBookingPaymentSummary(b);
                  const isReady = db.checkBookingConfirmationReadiness(b).canConfirm;

                  return (
                    <tr 
                      key={b.id} 
                      id={`booking-row-${b.id}`}
                      onClick={() => setSelectedBookingId(b.id)}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/50 cursor-pointer transition-colors"
                    >
                      {/* Ref & Date */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 flex-wrap">
                          <span>{b.bookingReference}</span>
                          <RecordReminderIndicator
                            entityType="BOOKING"
                            entityId={b.id}
                            entityReference={b.bookingReference}
                            currentUser={user}
                            variant="badge"
                            onOpenActionCenter={onOpenActionCenter}
                          />
                          {isReady && b.status !== 'CONFIRMED' && (
                            <span title="All conditions met for confirmation" className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Lead Traveler & Agency */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-stone-900 dark:text-stone-100">
                          {b.customer?.leadTravelerName || b.customer?.name || 'Guest'}
                        </div>
                        <div className="text-[11px] text-stone-500 truncate max-w-[180px]">
                          {b.agencyName || b.agentName || 'Direct B2C VIP'}
                        </div>
                      </td>

                      {/* Travel Dates & PAX */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-stone-800 dark:text-stone-200">
                          {b.travelStartDate || 'Flexible'}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          {currentPax}/{maxPax} PAX Configured
                        </div>
                      </td>

                      {/* Value & Payment */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold font-mono text-stone-900 dark:text-stone-100">
                          {formatCurrency(paymentSummary.totalAmount, b.currency)}
                        </div>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          b.paymentStatus === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' :
                          'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {b.paymentStatus ? b.paymentStatus.replace(/_/g, ' ') : 'PENDING PAYMENT'}
                        </span>
                      </td>

                      {/* Documents */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.documentStatus === 'DOCUMENTS_VERIFIED' || b.documentStatus === 'DOCUMENTS_SUBMITTED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {b.documentStatus ? b.documentStatus.replace(/_/g, ' ') : 'DOCS PENDING'}
                        </span>
                        {b.missingDocuments && b.missingDocuments.length > 0 && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono mt-0.5">
                            {b.missingDocuments.length} files missing
                          </div>
                        )}
                      </td>

                      {/* Suppliers */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.supplierAllocationStatus === 'FULLY_CONFIRMED_BY_SUPPLIERS'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                        }`}>
                          {b.supplierAllocationStatus ? b.supplierAllocationStatus.replace(/_/g, ' ') : 'UNALLOCATED'}
                        </span>
                      </td>

                      {/* Operational Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                          b.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800' :
                          b.status === 'CANCELLED' ? 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300' :
                          b.status === 'PROCESSING' ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800' :
                          b.status === 'TO_BE_PROCESSED' ? 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 border border-orange-300 dark:border-orange-800' :
                          'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                        }`}>
                          {b.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBookingId(b.id);
                          }}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors"
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

      {/* Create Booking Request Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-stone-200 dark:border-stone-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Create Operational Booking Record
                </h3>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Lead Traveler Full Name *</label>
                <input
                  type="text"
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="e.g. Vikramaditya Singhania"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="e.g. vikram@luxuryholidays.in"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="e.g. +91 98200 11223"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Adults *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={totalAdults}
                    onChange={(e) => setTotalAdults(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Children</label>
                  <input
                    type="number"
                    min="0"
                    value={totalChildren}
                    onChange={(e) => setTotalChildren(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Agency Name (Optional)</label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="e.g. Wanderlust Luxury Voyages"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Total Booking Value</label>
                  <input
                    type="number"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Travel Start Date</label>
                  <input
                    type="date"
                    value={travelStartDate}
                    onChange={(e) => setTravelStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Travel End Date</label>
                  <input
                    type="date"
                    value={travelEndDate}
                    onChange={(e) => setTravelEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Create & Open Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
