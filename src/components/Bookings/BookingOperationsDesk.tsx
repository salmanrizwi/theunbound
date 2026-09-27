import React, { useState, useEffect, useMemo } from 'react';
import { Booking, User, BookingStatus } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  canAccessBookingDeskSection, 
  isInternalStaff, 
  isExternalUser 
} from '../../services/permissionEngine';
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
  ChevronDown,
  UserCheck,
  Ticket,
  FileCheck,
  Receipt
} from 'lucide-react';
import { DeskOverviewSection } from './desk/DeskOverviewSection';
import { DeskAssignmentSection } from './desk/DeskAssignmentSection';
import { DeskServiceItemsSection } from './desk/DeskServiceItemsSection';
import { DeskFinancialsSection } from './desk/DeskFinancialsSection';
import { DeskActivityVouchersSection } from './desk/DeskActivityVouchersSection';
import { DeskCompleteVoucherSection } from './desk/DeskCompleteVoucherSection';
import { DeskProformaInvoiceSection } from './desk/DeskProformaInvoiceSection';
import { DeskTasksSection } from './desk/DeskTasksSection';
import { DeskPassengersDocsSection } from './desk/DeskPassengersDocsSection';
import { DeskNotesSection } from './desk/DeskNotesSection';
import { DeskTimelineSection } from './desk/DeskTimelineSection';
import { OperationalHorizonDesk } from './OperationalHorizonDesk';
import { AdminWorkspaceLayout } from '../common/AdminWorkspaceLayout';
import { Compass } from 'lucide-react';

export type DeskSection = 
  | 'OVERVIEW'
  | 'ASSIGNMENT'
  | 'SERVICES'
  | 'OPERATIONAL_HORIZON'
  | 'FINANCIALS'
  | 'ACTIVITY_VOUCHERS'
  | 'COMPLETE_VOUCHER'
  | 'PROFORMA_INVOICE'
  | 'PASSENGERS'
  | 'PAYMENTS'
  | 'TASKS'
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

  const isExternal = isExternalUser(currentUser);
  const isInternal = isInternalStaff(currentUser);

  const [activeBookingId, setActiveBookingId] = useState(initialBookingId);
  const [activeSection, setActiveSection] = useState<DeskSection>(
    canAccessBookingDeskSection(currentUser, initialSection) ? initialSection : 'OVERVIEW'
  );
  const [refreshKey, setRefreshKey] = useState(0);

  // Read all bookings for switcher (filtered for external agent)
  const getAccessibleBookings = () => {
    const all = db.getAllBookings();
    if (isExternal) {
      return all.filter(b => 
        b.assignedAgentId === currentUser?.id || 
        b.submittedByUserId === currentUser?.id || 
        b.agentId === currentUser?.id
      );
    }
    return all;
  };

  const [allBookings, setAllBookings] = useState<Booking[]>(getAccessibleBookings);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setAllBookings(getAccessibleBookings());
      setRefreshKey(prev => prev + 1);
    });
    return () => unsub();
  }, [db, currentUser]);

  // Active Booking
  const booking = useMemo(() => {
    return allBookings.find(b => b.id === activeBookingId) || null;
  }, [allBookings, activeBookingId, refreshKey]);

  // Navigation Items (Strictly governed by permissionEngine)
  const navItems = useMemo(() => {
    if (!booking) return [];

    const totalServices = booking.items?.length || 0;
    const unallocatedCount = booking.items?.filter(it => !it.supplierId && !it.supplierName).length || 0;
    const bookingTasks = db.getTasksForBooking(booking.id);
    const openTasks = bookingTasks.filter(t => t.status !== 'COMPLETED').length;
    const missingDocsCount = booking.missingDocuments?.length || 0;
    const notesCount = (booking.internalNotesList?.length || 0) + (booking.customerUpdates?.length || 0);

    const candidates = [
      {
        id: 'OVERVIEW' as DeskSection,
        label: 'Booking Overview',
        icon: Building2,
        badge: null
      },
      {
        id: 'ASSIGNMENT' as DeskSection,
        label: 'Assignment & Ownership',
        icon: UserCheck,
        badge: booking.operationalOwnerName ? 'Assigned' : 'Pending',
        badgeColor: booking.operationalOwnerName ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
      },
      {
        id: 'SERVICES' as DeskSection,
        label: 'Service Items & Supplier Allocation',
        icon: Layers,
        badge: isInternal && unallocatedCount > 0 
          ? `${unallocatedCount} unallocated` 
          : `${totalServices} items`,
        badgeColor: unallocatedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
      },
      {
        id: 'OPERATIONAL_HORIZON' as DeskSection,
        label: 'Operational Horizon Desk',
        icon: Compass,
        badge: 'Ground Ops',
        badgeColor: 'bg-teal-100 text-teal-800'
      },
      {
        id: 'FINANCIALS' as DeskSection,
        label: 'Financials & Tranches',
        icon: CreditCard,
        badge: booking.paymentStatus === 'PAID' ? 'Settled' : 'Pending',
        badgeColor: booking.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
      },
      {
        id: 'ACTIVITY_VOUCHERS' as DeskSection,
        label: 'Activity Vouchers',
        icon: Ticket,
        badge: (booking.activityVoucherIds?.length || 0) > 0 ? `${booking.activityVoucherIds?.length}` : null,
        badgeColor: 'bg-emerald-100 text-emerald-800'
      },
      {
        id: 'COMPLETE_VOUCHER' as DeskSection,
        label: 'Complete Voucher',
        icon: FileCheck,
        badge: booking.completeBookingVoucherId ? 'Issued' : null,
        badgeColor: 'bg-teal-100 text-teal-800'
      },
      {
        id: 'PROFORMA_INVOICE' as DeskSection,
        label: 'Proforma Invoice',
        icon: Receipt,
        badge: (booking.proformaInvoiceIds?.length || 0) > 0 ? `${booking.proformaInvoiceIds?.length}` : null,
        badgeColor: 'bg-indigo-100 text-indigo-800'
      },
      {
        id: 'PASSENGERS' as DeskSection,
        label: 'Passengers & Docs',
        icon: Users,
        badge: missingDocsCount > 0 ? `${missingDocsCount} docs missing` : `${booking.passengers?.length || 0} pax`,
        badgeColor: missingDocsCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
      },
      {
        id: 'TASKS' as DeskSection,
        label: 'Tasks & Follow-Ups',
        icon: CheckSquare,
        badge: openTasks > 0 ? `${openTasks} open` : null,
        badgeColor: 'bg-purple-100 text-purple-800'
      },
      {
        id: 'NOTES' as DeskSection,
        label: 'Notes & Updates',
        icon: MessageSquare,
        badge: notesCount > 0 ? `${notesCount}` : null,
        badgeColor: 'bg-slate-100 text-slate-700'
      },
      {
        id: 'TIMELINE' as DeskSection,
        label: 'Timeline & Audit',
        icon: History,
        badge: null,
        badgeColor: 'bg-slate-100 text-slate-700'
      }
    ];

    return candidates.filter(item => canAccessBookingDeskSection(currentUser, item.id));
  }, [booking, db, currentUser, isInternal]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleNavigateSection = (section: DeskSection) => {
    if (canAccessBookingDeskSection(currentUser, section)) {
      setActiveSection(section);
    } else {
      setActiveSection('OVERVIEW');
    }
  };

  const currentSection = canAccessBookingDeskSection(currentUser, activeSection) ? activeSection : 'OVERVIEW';

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
                  {isExternal ? 'Booking Overview & Documentation Desk' : 'Booking Operations & Supplier Allocation Desk'}
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
      </div>

      <AdminWorkspaceLayout
        sidebar={
          <div className="space-y-6">
            {/* 1. Authoritative Booking Context Preview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Booking Summary</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                  booking.status === 'CONFIRMED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {booking.status}
                </span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Travel Dates</span>
                  <span className="font-bold text-slate-900 leading-snug">
                    {booking.travelStartDate || 'TBA'} ➔ {booking.travelEndDate || 'TBA'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Destination</span>
                  <span className="font-semibold text-slate-800">{booking.destinationName || booking.destination || 'Japan'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Group Size</span>
                  <span className="font-semibold text-slate-800">
                    {(booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) || 1} Passengers
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Channel & Agent</span>
                  <span className="font-semibold text-slate-800 block truncate">{booking.agencyName || booking.agentName || 'Direct VIP'}</span>
                </div>

                <div className="pt-2.5 border-t border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Payment & Selling Total</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-base font-black text-[#008f77] font-mono">
                      {formatCurrency(booking.totalAmount || 0, booking.currency)}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                      booking.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {booking.paymentStatus || 'PENDING'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Vertical Desk Navigation Section Tabs */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = currentSection === item.id;
                return (
                  <button
                    key={item.id}
                    id={`desk-nav-btn-${item.id.toLowerCase()}`}
                    type="button"
                    onClick={() => handleNavigateSection(item.id)}
                    className={`w-full text-left p-3.5 transition-all text-xs font-bold flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-[#00C6A6]/10 text-slate-950 font-black border-l-4 border-[#00C6A6]'
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-slate-900 text-white' : item.badgeColor
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        }
        content={
          <div id="desk-active-section-viewport" className="space-y-6">
            {currentSection === 'OVERVIEW' && (
              <DeskOverviewSection
                booking={booking}
                currentUser={currentUser}
                onNavigateToSection={handleNavigateSection}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'ASSIGNMENT' && (
              <DeskAssignmentSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'SERVICES' && (
              <DeskServiceItemsSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'OPERATIONAL_HORIZON' && (
              <OperationalHorizonDesk
                currentUser={currentUser}
                initialDate={booking.travelStartDate || undefined}
                onOpenBooking={(bId) => {
                  setActiveBookingId(bId);
                  setActiveSection('OVERVIEW');
                }}
                onBackToAllocationDesk={() => setActiveSection('SERVICES')}
              />
            )}

            {isInternal && (currentSection === 'FINANCIALS' || currentSection === 'PAYMENTS') && (
              <DeskFinancialsSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'ACTIVITY_VOUCHERS' && (
              <DeskActivityVouchersSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'COMPLETE_VOUCHER' && (
              <DeskCompleteVoucherSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'PROFORMA_INVOICE' && (
              <DeskProformaInvoiceSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {currentSection === 'PASSENGERS' && (
              <DeskPassengersDocsSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'TASKS' && (
              <DeskTasksSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'NOTES' && (
              <DeskNotesSection
                booking={booking}
                currentUser={currentUser}
                onRefresh={handleRefresh}
              />
            )}

            {isInternal && currentSection === 'TIMELINE' && (
              <DeskTimelineSection
                booking={booking}
                currentUser={currentUser}
              />
            )}
          </div>
        }
      />
    </div>
  );
};
