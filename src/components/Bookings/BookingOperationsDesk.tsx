import React, { useState, useEffect, useMemo } from 'react';
import { Booking, User, BookingStatus } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  Building2, 
  ArrowLeft, 
  Calendar, 
  Users, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  CheckSquare, 
  Layers, 
  MessageSquare, 
  History, 
  Printer, 
  ChevronRight,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { DeskOverviewSection } from './desk/DeskOverviewSection';
import { DeskServiceItemsSection } from './desk/DeskServiceItemsSection';
import { DeskTasksSection } from './desk/DeskTasksSection';
import { DeskPassengersDocsSection } from './desk/DeskPassengersDocsSection';
import { DeskPaymentsSection } from './desk/DeskPaymentsSection';
import { DeskNotesSection } from './desk/DeskNotesSection';
import { DeskTimelineSection } from './desk/DeskTimelineSection';

export type DeskSection = 
  | 'OVERVIEW'
  | 'SERVICES'
  | 'TASKS'
  | 'PASSENGERS'
  | 'PAYMENTS'
  | 'NOTES'
  | 'TIMELINE';

interface BookingOperationsDeskProps {
  bookingId: string;
  currentUser: User | null;
  onBack: () => void;
  initialSection?: DeskSection;
}

export const BookingOperationsDesk: React.FC<BookingOperationsDeskProps> = ({
  bookingId: initialBookingId,
  currentUser,
  onBack,
  initialSection = 'OVERVIEW'
}) => {
  const db = AppDatabase.getInstance();

  const [activeBookingId, setActiveBookingId] = useState(initialBookingId);
  const [activeSection, setActiveSection] = useState<DeskSection>(initialSection);
  const [refreshKey, setRefreshKey] = useState(0);

  // Read all bookings for switcher
  const [allBookings, setAllBookings] = useState<Booking[]>(() => db.getAllBookings());

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setAllBookings(db.getAllBookings());
      setRefreshKey(prev => prev + 1);
    });
    return () => unsub();
  }, [db]);

  // Active Booking
  const booking = useMemo(() => {
    return allBookings.find(b => b.id === activeBookingId) || null;
  }, [allBookings, activeBookingId, refreshKey]);

  // Permission Check
  const isB2BOrBuyer = currentUser?.role === 'B2B_AGENT' || currentUser?.role === 'BUYER';
  const isInternalStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';

  // Navigation Items
  const navItems = useMemo(() => {
    if (!booking) return [];

    const totalServices = booking.items?.length || 0;
    const unallocatedCount = booking.items?.filter(it => !it.supplierId && !it.supplierName).length || 0;
    const bookingTasks = db.getTasksForBooking(booking.id);
    const openTasks = bookingTasks.filter(t => t.status !== 'COMPLETED').length;
    const missingDocsCount = booking.missingDocuments?.length || 0;
    const notesCount = (booking.internalNotesList?.length || 0) + (booking.customerUpdates?.length || 0);

    const base = [
      {
        id: 'OVERVIEW' as DeskSection,
        label: 'Booking Overview',
        icon: Building2,
        badge: null
      },
      {
        id: 'SERVICES' as DeskSection,
        label: 'Service Items & Supplier Allocation',
        icon: Layers,
        badge: isInternalStaff && unallocatedCount > 0 
          ? `${unallocatedCount} unallocated` 
          : `${totalServices} items`,
        badgeColor: unallocatedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
      },
      {
        id: 'TASKS' as DeskSection,
        label: 'Tasks & Follow-Ups',
        icon: CheckSquare,
        badge: openTasks > 0 ? `${openTasks} open` : null,
        badgeColor: 'bg-purple-100 text-purple-800'
      },
      {
        id: 'PASSENGERS' as DeskSection,
        label: 'Passengers & Docs',
        icon: Users,
        badge: missingDocsCount > 0 ? `${missingDocsCount} docs missing` : `${booking.passengers?.length || 0} pax`,
        badgeColor: missingDocsCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
      },
      {
        id: 'PAYMENTS' as DeskSection,
        label: 'Payments & Tranches',
        icon: CreditCard,
        badge: booking.paymentStatus === 'PAID' ? 'Settled' : 'Pending',
        badgeColor: booking.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
      }
    ];

    // Internal only tabs
    if (!isB2BOrBuyer) {
      base.push({
        id: 'NOTES' as DeskSection,
        label: 'Notes & Updates',
        icon: MessageSquare,
        badge: notesCount > 0 ? `${notesCount}` : null,
        badgeColor: 'bg-slate-100 text-slate-700'
      });
      base.push({
        id: 'TIMELINE' as DeskSection,
        label: 'Timeline & Audit',
        icon: History,
        badge: null,
        badgeColor: 'bg-slate-100 text-slate-700'
      });
    }

    return base;
  }, [booking, db, isB2BOrBuyer, isInternalStaff]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!booking) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-4 max-w-xl mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-lg font-black text-slate-900">Booking Record Not Found</h3>
        <p className="text-xs text-slate-500">
          The requested booking (ID: {activeBookingId}) could not be retrieved from the authoritative database.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800"
        >
          Return to Bookings List
        </button>
      </div>
    );
  }

  return (
    <div id="booking-operations-supplier-allocation-desk" className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & SINGLE PAGE TITLE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              id="btn-desk-back-to-bookings"
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Back to Bookings List"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#008f77] flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  Booking Operations & Supplier Allocation Desk
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-xs font-bold text-slate-900">
                  {booking.bookingReference}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                <span>{booking.customer?.leadTravelerName || 'Guest Booking'}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  booking.status === 'CONFIRMED' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                    : booking.status === 'CANCELLED'
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {booking.status}
                </span>
              </h1>
            </div>
          </div>

          {/* Quick Booking Switcher + Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Booking Switcher Dropdown */}
            <div className="relative">
              <select
                value={activeBookingId}
                onChange={e => setActiveBookingId(e.target.value)}
                className="pl-3 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#008f77] appearance-none"
              >
                {allBookings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bookingReference} — {b.customer?.leadTravelerName || 'Guest'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Print Voucher / Ops Sheet */}
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Print Operations Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Sheet</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. ONE AUTHORITATIVE BOOKING SUMMARY (COMPACT & SCANNABLE) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Travel Dates</span>
            <span className="font-bold text-slate-800 mt-0.5 block truncate">
              {booking.travelStartDate || 'TBA'} → {booking.travelEndDate || 'TBA'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Destination</span>
            <span className="font-bold text-slate-800 mt-0.5 block truncate">
              {booking.destinationName || booking.destination || 'Japan'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Passengers</span>
            <span className="font-bold text-slate-800 mt-0.5 block">
              {(booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) || 1} Pax
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Selling Total</span>
            <span className="font-bold text-slate-900 mt-0.5 block font-mono">
              {formatCurrency(booking.totalAmount || 0, booking.currency)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Status</span>
            <span className={`font-bold mt-0.5 block ${
              booking.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-blue-700'
            }`}>
              {booking.paymentStatus || 'PENDING'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Channel</span>
            <span className="font-bold text-slate-800 mt-0.5 block truncate">
              {booking.agencyName || booking.agentName || 'Direct VIP'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION NAVIGATION (EXACT 7 REQUIRED SECTIONS) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              id={`desk-nav-btn-${item.id.toLowerCase()}`}
              onClick={() => setActiveSection(item.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive 
                  ? 'bg-[#008f77] text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : item.badgeColor
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 4. ACTIVE SECTION CONTENT (ONLY ONE SECTION DETAILED AT A TIME) */}
      {/* ========================================================================= */}
      <div id="desk-active-section-viewport">
        {activeSection === 'OVERVIEW' && (
          <DeskOverviewSection
            booking={booking}
            currentUser={currentUser}
            onNavigateToSection={setActiveSection}
            onRefresh={handleRefresh}
          />
        )}

        {activeSection === 'SERVICES' && (
          <DeskServiceItemsSection
            booking={booking}
            currentUser={currentUser}
            onRefresh={handleRefresh}
          />
        )}

        {activeSection === 'TASKS' && (
          <DeskTasksSection
            booking={booking}
            currentUser={currentUser}
            onRefresh={handleRefresh}
          />
        )}

        {activeSection === 'PASSENGERS' && (
          <DeskPassengersDocsSection
            booking={booking}
            currentUser={currentUser}
            onRefresh={handleRefresh}
          />
        )}

        {activeSection === 'PAYMENTS' && (
          <DeskPaymentsSection
            booking={booking}
            currentUser={currentUser}
            onRefresh={handleRefresh}
          />
        )}

        {activeSection === 'NOTES' && !isB2BOrBuyer && (
          <DeskNotesSection
            booking={booking}
            currentUser={currentUser}
            onRefresh={handleRefresh}
          />
        )}

        {activeSection === 'TIMELINE' && !isB2BOrBuyer && (
          <DeskTimelineSection
            booking={booking}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
};
