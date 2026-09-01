import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { googleCalendarAutomation } from '../../services/googleCalendarAutomationService';
import { PassengerManifestManager } from './PassengerManifestManager';
import { PaymentProofsManager } from './PaymentProofsManager';
import { SupplierServicesManager } from './SupplierServicesManager';
import { CustomerAndInternalNotes } from './CustomerAndInternalNotes';
import { BookingTimelineView } from './BookingTimelineView';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Download, 
  User as UserIcon, 
  Mail, 
  Phone, 
  Building2, 
  Plane, 
  ShieldCheck, 
  Send,
  X,
  FileCheck2,
  Lock,
  Globe
} from 'lucide-react';

interface BookingWorkspaceProps {
  bookingId: string;
  currentUser: User | null;
  onBack: () => void;
}

export const BookingWorkspace: React.FC<BookingWorkspaceProps> = ({
  bookingId,
  currentUser,
  onBack
}) => {
  const db = AppDatabase.getInstance();
  const [booking, setBooking] = useState<Booking | null>(() => {
    return db.getAllBookings().find(b => b.id === bookingId) || null;
  });

  const [activeTab, setActiveTab] = useState<'ALL' | 'PASSENGERS' | 'PAYMENTS' | 'SUPPLIERS' | 'NOTES' | 'TIMELINE'>('ALL');
  const [isReadinessModalOpen, setIsReadinessModalOpen] = useState(false);
  const [readinessResult, setReadinessResult] = useState<{ canConfirm: boolean; blockingReasons: string[] } | null>(null);

  const refreshBooking = () => {
    const updated = db.getAllBookings().find(b => b.id === bookingId);
    if (updated) {
      setBooking({ ...updated });
    }
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      refreshBooking();
    });
    return unsub;
  }, [bookingId]);

  if (!booking) {
    return (
      <div className="p-8 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-stone-700 dark:text-stone-300 font-bold">Booking Not Found</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-xl text-xs font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const readiness = db.checkBookingConfirmationReadiness(booking);
  const paymentSummary = db.calculateBookingPaymentSummary(booking);
  const maxPax = (booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0) || 
    booking.items?.reduce((max, it) => Math.max(max, it.totalPax), 0) || 1;
  const currentPaxCount = booking.passengers?.length || 0;

  const handleStatusChange = (newStatus: BookingStatus) => {
    if (newStatus === 'CONFIRMED' && !readiness.canConfirm) {
      setReadinessResult(readiness);
      setIsReadinessModalOpen(true);
      return;
    }

    db.updateBookingStatus(booking.id, newStatus, currentUser);

    // Google Calendar SLA sync
    try {
      const activeTask = googleCalendarAutomation.findActiveTaskByRelationship({
        bookingId: booking.id,
        taskType: 'BOOKING_CONFIRMATION'
      });
      if (activeTask) {
        if (newStatus === 'CONFIRMED') {
          googleCalendarAutomation.updateTaskStatus(activeTask.id, 'COMPLETED', currentUser);
        } else if (newStatus === 'CANCELLED') {
          googleCalendarAutomation.updateTaskStatus(activeTask.id, 'CANCELLED', currentUser);
        }
      }
    } catch (e) {
      console.debug('Calendar sync:', e);
    }

    refreshBooking();
  };

  const handleForceConfirm = () => {
    setIsReadinessModalOpen(false);
    db.updateBookingStatus(booking.id, 'CONFIRMED', currentUser);
    refreshBooking();
  };

  const handlePrintVoucher = () => {
    window.print();
  };

  return (
    <div id="booking-operations-workspace" className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-dashboard"
            onClick={onBack}
            className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                {booking.bookingReference}
              </span>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                {booking.customer?.leadTravelerName || 'Guest Booking Workspace'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                booking.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                booking.status === 'CANCELLED' ? 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300' :
                booking.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {booking.status}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-mono mt-0.5">
              Created: {new Date(booking.createdAt).toLocaleString()} • Travel: {booking.travelStartDate || 'Flexible'} to {booking.travelEndDate || 'Flexible'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Confirmation Button */}
          {booking.status !== 'CONFIRMED' && booking.status !== 'CANCELLED' && (
            <button
              id="btn-confirm-booking-workflow"
              onClick={() => handleStatusChange('CONFIRMED')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
            >
              <FileCheck2 className="w-4 h-4" />
              Confirm Booking
            </button>
          )}

          {/* Status Selector */}
          <div className="relative">
            <select
              id="select-booking-status-quick"
              value={booking.status}
              onChange={(e) => handleStatusChange(e.target.value as BookingStatus)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500"
            >
              <option value="NEW">Status: NEW</option>
              <option value="TO_BE_PROCESSED">Status: TO BE PROCESSED</option>
              <option value="PROCESSING">Status: PROCESSING</option>
              <option value="WAITING_FOR_UPDATE">Status: WAITING FOR UPDATE</option>
              <option value="CONFIRMED">Status: CONFIRMED</option>
              <option value="CANCELLED">Status: CANCELLED</option>
              <option value="COMPLETED">Status: COMPLETED</option>
            </select>
          </div>

          <button
            onClick={handlePrintVoucher}
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors text-xs font-semibold flex items-center gap-1"
            title="Print Operations Sheet & Voucher"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirmation Readiness Alert Banner */}
      {!readiness.canConfirm && booking.status !== 'CANCELLED' && booking.status !== 'CONFIRMED' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Action Items Required Before Final Confirmation ({readiness.blockingReasons.length} pending)
              </h4>
              <ul className="text-xs text-amber-800 dark:text-amber-300 mt-1 list-disc list-inside space-y-0.5">
                {readiness.blockingReasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
          <button
            onClick={() => handleStatusChange('CONFIRMED')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-sm"
          >
            Check Status
          </button>
        </div>
      )}

      {/* Customer & Agent Details Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Booker Info */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-stone-800">
            <UserIcon className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
              Customer & Booker Details
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-stone-400 block uppercase font-medium">Lead Traveler</span>
              <span className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                {booking.customer?.leadTravelerName || 'Guest'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-stone-600 dark:text-stone-300">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                {booking.customer?.phone || 'N/A'}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                {booking.customer?.email || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 block uppercase font-medium">Travel Party</span>
              <span className="font-mono text-stone-800 dark:text-stone-200">
                {booking.customer?.totalAdults || 1} Adults • {booking.customer?.totalChildren || 0} Children ({maxPax} Total PAX)
              </span>
            </div>
          </div>
        </div>

        {/* Agency / Agent Partner */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-stone-800">
            <Building2 className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
              B2B Agency & Booker
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-stone-400 block uppercase font-medium">Agency Name</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">
                {booking.agencyName || booking.agentName || 'Direct VIP Client'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-stone-600 dark:text-stone-300">
              <span>Agent: <strong>{booking.agentName || booking.customer?.leadTravelerName}</strong></span>
              <span>Ref: <strong className="font-mono">{booking.agencyReference || 'N/A'}</strong></span>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 block uppercase font-medium">Booking Channel</span>
              <span className="font-mono text-stone-800 dark:text-stone-200">
                {booking.channel || 'B2B_PORTAL'} • Managed by {booking.assignedTeamMemberName || 'Operations DMC Desk'}
              </span>
            </div>
          </div>
        </div>

        {/* Flights & Logistics */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-stone-800">
            <Plane className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
              Arrival & Ground Logistics
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-stone-400 block uppercase font-medium">Arrival Flight / Port</span>
              <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                {booking.arrivalFlightNumber ? `${booking.arrivalFlightNumber} (${booking.arrivalAirport || 'NRT'})` : 'Flight details pending'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-stone-400 block uppercase font-medium">Pickup & Dropoff</span>
              <span className="text-stone-700 dark:text-stone-300 truncate block">
                {booking.pickupLocation || 'Narita Airport (NRT) Terminal 1'} → {booking.dropoffLocation || 'Tokyo Central'}
              </span>
            </div>
            {booking.specialRequests && (
              <div>
                <span className="text-[10px] text-stone-400 block uppercase font-medium">Special Requests</span>
                <span className="text-stone-700 dark:text-stone-300 italic">
                  {booking.specialRequests}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Operations Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-2">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ALL'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          All Workspace Sections
        </button>
        <button
          onClick={() => setActiveTab('PASSENGERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PASSENGERS'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          Passengers & Docs ({currentPaxCount}/{maxPax})
        </button>
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PAYMENTS'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          Payments & Tranches ({booking.paymentProofs?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'SUPPLIERS'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          Services & Suppliers ({booking.items?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('NOTES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'NOTES'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          Notes & Updates ({booking.internalNotesList?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('TIMELINE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'TIMELINE'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          Timeline & Audit ({booking.timeline?.length || 0})
        </button>
      </div>

      {/* SECTION 1: PASSENGERS & DOCUMENTS */}
      {(activeTab === 'ALL' || activeTab === 'PASSENGERS') && (
        <PassengerManifestManager
          booking={booking}
          currentUser={currentUser}
          onRefresh={refreshBooking}
        />
      )}

      {/* SECTION 2: PAYMENTS & MULTI-TRANCHE PROOFS */}
      {(activeTab === 'ALL' || activeTab === 'PAYMENTS') && (
        <PaymentProofsManager
          booking={booking}
          currentUser={currentUser}
          onRefresh={refreshBooking}
        />
      )}

      {/* SECTION 3: SERVICES & SUPPLIER OPERATIONS */}
      {(activeTab === 'ALL' || activeTab === 'SUPPLIERS') && (
        <SupplierServicesManager
          booking={booking}
          currentUser={currentUser}
          onRefresh={refreshBooking}
        />
      )}

      {/* SECTION 4: NOTES & CUSTOMER COMMUNICATIONS */}
      {(activeTab === 'ALL' || activeTab === 'NOTES') && (
        <CustomerAndInternalNotes
          booking={booking}
          currentUser={currentUser}
          onRefresh={refreshBooking}
        />
      )}

      {/* SECTION 5: TIMELINE & AUDIT TRAIL */}
      {(activeTab === 'ALL' || activeTab === 'TIMELINE') && (
        <BookingTimelineView booking={booking} />
      )}

      {/* Confirmation Readiness Warning Modal */}
      {isReadinessModalOpen && readinessResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full border border-stone-200 dark:border-stone-800 shadow-2xl p-6">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Confirmation Compliance Incomplete
              </h3>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 mb-4 leading-relaxed">
              Standard operations policy requires all traveler documents, advance deposit verification, and supplier confirmation references before advancing to <strong>CONFIRMED</strong>:
            </p>

            <ul className="space-y-1.5 mb-6 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl text-rose-800 dark:text-rose-300">
              {readinessResult.blockingReasons.map((r, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReadinessModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Go Back & Complete Items
              </button>
              <button
                type="button"
                onClick={handleForceConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Override & Force Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
