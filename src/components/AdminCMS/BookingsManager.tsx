import React, { useState, useEffect, useMemo } from 'react';
import { Booking, BookingStatus } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useDisplayCurrency } from '../../context/DisplayCurrencyContext';
import { resolveUserAccountManager } from '../../services/accountManagerService';
import { resolveAuthoritativeBookingFinancials } from '../../services/bookingManualDiscountEngine';
import { BookingDashboardCards } from '../Bookings/BookingDashboardCards';
import { BookingOperationsDesk, DeskSection } from '../Bookings/BookingOperationsDesk';
import { ManualOperationalBookingModal } from '../Bookings/ManualOperationalBookingModal';
import { OperationalHorizonDesk } from '../Bookings/OperationalHorizonDesk';
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
  RotateCcw, 
  ShieldCheck, 
  Layers,
  ArrowRight,
  TrendingUp,
  UserCheck,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import { CalendarTask } from '../../types';

export interface BookingsManagerProps {
  initialBookingId?: string | null;
  initialSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
  onOpenActionCenter?: (task: CalendarTask) => void;
}

export const BookingsManager: React.FC<BookingsManagerProps> = ({
  initialBookingId,
  initialSubTab,
  onSubTabChange,
  onOpenActionCenter
}) => {
  const { user } = useAuth();
  const { convertForDisplay } = useDisplayCurrency();
  const db = AppDatabase.getInstance();
  
  const [bookings, setBookings] = useState<Booking[]>(() => db.getAllBookings());
  const [internalTeamMembers, setInternalTeamMembers] = useState(() => db.getEligibleInternalTeamMembers());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(initialBookingId || null);
  const isHorizonSubTab = initialSubTab === 'HORIZON';
  const [initialDeskSection, setInitialDeskSection] = useState<DeskSection>('OVERVIEW');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const bookingsPageSize = 25;
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('ALL');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // When user switches to Booking Management -> Operational Horizon & Ground Dispatch Desk, clear any open booking detail view
  useEffect(() => {
    if (isHorizonSubTab) {
      setSelectedBookingId(null);
    }
  }, [isHorizonSubTab]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, channelFilter, ownershipFilter]);

  const handleRunMigration = () => {
    setIsMigrating(true);
    setMigrationNotice(null);
    try {
      const res = db.migrateBookingAssignments();
      setMigrationNotice({
        type: 'success',
        message: `Assignment reconciliation completed — Migrated/Updated: ${res.migratedCount}, Already Complete: ${res.alreadyAssignedCount}, Pending Owner: ${res.pendingInternalCount}, Pending Agent: ${res.pendingAgentCount}.`
      });
      setBookings(db.getAllBookings());
      setInternalTeamMembers(db.getEligibleInternalTeamMembers());
    } catch (e: any) {
      setMigrationNotice({
        type: 'error',
        message: `Migration error: ${e?.message || e}`
      });
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    const unsub = db.subscribeToCollections(
      ['bookings', 'system_users', 'booking_pricing_snapshots', 'booking_manual_discounts'],
      () => {
        setBookings(db.getAllBookings());
        setInternalTeamMembers(db.getEligibleInternalTeamMembers());
      }
    );
    return unsub;
  }, [db]);

  useEffect(() => {
    if (initialBookingId) {
      const clean = initialBookingId.replace(/^#/, '').trim().toLowerCase();
      const match = bookings.find(b => 
        b.id === initialBookingId || 
        b.bookingReference === initialBookingId ||
        (b.id || '').toLowerCase() === clean ||
        (b.bookingReference || '').toLowerCase() === clean
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

  // Filter Bookings
  const filteredBookings = useMemo(() => {
    const q = (debouncedSearchQuery || '').toLowerCase().trim();
    return bookings.filter((b) => {
      const matchesSearch = 
        !q ||
        (b.bookingReference || '').toLowerCase().includes(q) ||
        (b.customer?.leadTravelerName || '').toLowerCase().includes(q) ||
        (b.customer?.name || '').toLowerCase().includes(q) ||
        (b.customer?.email || '').toLowerCase().includes(q) ||
        (b.agencyName || '').toLowerCase().includes(q) ||
        (b.assignedTeamMemberNameSnapshot || '').toLowerCase().includes(q) ||
        (b.assignedTeamMemberName || '').toLowerCase().includes(q) ||
        (b.agentNameSnapshot || '').toLowerCase().includes(q) ||
        (b.agentAgencySnapshot || '').toLowerCase().includes(q) ||
        b.items?.some(it => (it.productName || '').toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (channelFilter !== 'ALL' && b.sourceType !== channelFilter) return false;

      // Ownership / Assigned Team Member Filter
      if (ownershipFilter === 'ASSIGNED_TO_ME') {
        if (b.assignedTeamMemberId !== user?.id) return false;
      } else if (ownershipFilter === 'PENDING_INTERNAL' || ownershipFilter === 'UNASSIGNED') {
        if (b.assignedTeamMemberId && b.assignmentStatus !== 'pending_internal_assignment') return false;
      } else if (ownershipFilter === 'PENDING_AGENT') {
        if (b.agentId || b.submittingAgentId || b.assignedAgentId) return false;
      } else if (ownershipFilter !== 'ALL') {
        if (b.assignedTeamMemberId !== ownershipFilter) return false;
      }

      if (activeFilter === 'STATUS_NEW') return b.status === 'NEW' || b.status === 'PENDING_CONFIRMATION';
      if (activeFilter === 'STATUS_TO_BE_PROCESSED') return b.status === 'TO_BE_PROCESSED';
      if (activeFilter === 'STATUS_PROCESSING') return b.status === 'PROCESSING' || b.status === 'IN_PROGRESS';
      if (activeFilter === 'STATUS_WAITING_FOR_UPDATE') return b.status === 'WAITING_FOR_UPDATE';
      if (activeFilter === 'PAY_PENDING') return b.paymentStatus === 'PENDING_PAYMENT';
      if (activeFilter === 'PAY_PARTIAL') return b.paymentStatus === 'PARTIALLY_PAID';
      if (activeFilter === 'PAY_PAID') return b.paymentStatus === 'PAID';
      if (activeFilter === 'CONFIRMED') return b.status === 'CONFIRMED';
      if (activeFilter === 'UNALLOCATED') return b.items?.some(it => !it.supplierId && !it.supplierName);

      return true;
    });
  }, [bookings, debouncedSearchQuery, channelFilter, ownershipFilter, activeFilter, user?.id]);

  // Dedicated Booking Management -> Operational Horizon & Ground Dispatch Desk view
  // Exclusively accessible under Booking Management -> Operational Horizon & Ground Dispatch Desk
  if (isHorizonSubTab && !selectedBookingId) {
    return (
      <div id="operational-horizon-management-view" className="space-y-6">
        <OperationalHorizonDesk
          currentUser={user}
          onOpenBooking={(id) => {
            onSubTabChange?.('BOOKINGS');
            setInitialDeskSection('OVERVIEW');
            setSelectedBookingId(id);
          }}
          onBackToAllocationDesk={() => {
            onSubTabChange?.('BOOKINGS');
          }}
        />
      </div>
    );
  }

  // If a booking is selected, render the full unified Booking Operations & Supplier Allocation Desk
  if (selectedBookingId) {
    return (
      <div id="booking-management-view" className="space-y-6">
        <BookingOperationsDesk
          bookingId={selectedBookingId}
          currentUser={user}
          onBack={() => setSelectedBookingId(null)}
          initialSection={initialDeskSection}
        />
      </div>
    );
  }

  return (
    <div id="booking-management-dashboard-view" className="space-y-6">
      {migrationNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            migrationNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="font-semibold">{migrationNotice.message}</span>
          <button
            type="button"
            onClick={() => setMigrationNotice(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header Banner matching CMS Hub Theme */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4 text-[#008972]" />
            <span>Booking Management • Booking Pipeline &amp; Supplier Allocation</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Booking Pipeline &amp; Supplier Allocation
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl mt-1">
            Unified ground reservation pipeline, service item allocation, commercial supplier pricing, proforma invoices, payment tranches, and compliance tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900 text-slate-200 px-4 py-2 rounded-2xl text-xs border border-slate-800 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#00E5C0]" />
            <div>
              <span className="text-[10px] text-slate-400 block font-mono">PIPELINE</span>
              <span className="font-bold text-[#00E5C0]">{bookings.length} Bookings</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunMigration}
            disabled={isMigrating}
            title="Reconcile legacy bookings to populate missing agent and internal owner snapshots"
            className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2.5 rounded-2xl transition-all cursor-pointer text-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
            <span>Reconcile Ownership</span>
          </button>

          <button
            id="btn-create-manual-booking"
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center bg-[#008972] hover:bg-[#00705d] text-white font-bold px-4 py-2.5 rounded-2xl transition-all cursor-pointer shadow-xs text-xs sm:text-sm"
          >
            <span>Create Booking</span>
          </button>
        </div>
      </div>

      {/* Dashboard Status Metric Cards */}
      <BookingDashboardCards
        bookings={bookings}
        activeFilter={activeFilter}
        onSelectFilter={handleSelectFilter}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-bookings"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookings by Reference, Lead Passenger, Agency, or SKU..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-[#008972] focus:ring-2 focus:ring-[#008972]/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            id="select-ownership-filter"
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl text-xs bg-white border border-slate-200 text-slate-700 font-semibold focus:outline-hidden focus:border-[#008972]"
          >
            <option value="ALL">All Team Assignments</option>
            <option value="UNASSIGNED">Unassigned (Pending Internal Owner)</option>
            <option value="ASSIGNED_TO_ME">Assigned to Me (Owner)</option>
            <option value="PENDING_AGENT">Pending Agent Association</option>
            {internalTeamMembers.length === 0 ? (
              <option value="" disabled>No active team members available</option>
            ) : (
              <optgroup label="Internal Team Members">
                {internalTeamMembers.map(tm => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name} ({tm.role})
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <select
            id="select-channel-filter"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl text-xs bg-white border border-slate-200 text-slate-700 font-semibold focus:outline-hidden focus:border-[#008972]"
          >
            <option value="ALL">All Sources</option>
            <option value="B2B_PORTAL">B2B Agent Portal</option>
            <option value="DIRECT_WEB">Direct B2C Web</option>
            <option value="MANUAL">Internal Ops / Manual</option>
          </select>

          {(activeFilter !== 'ALL' || ownershipFilter !== 'ALL') && (
            <button
              onClick={() => {
                setActiveFilter('ALL');
                setOwnershipFilter('ALL');
              }}
              className="px-3.5 py-2.5 rounded-xl text-xs text-[#008972] hover:bg-[#008972]/10 border border-slate-200 flex items-center gap-1.5 font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Authoritative Bookings Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">
              No Bookings Found Matching Current Criteria
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Try adjusting your search query or reset the dashboard metric card filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table id="table-operations-desk" className="w-full text-left text-xs">
              <thead className="bg-teal-900 text-teal-100 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Booking & Channel</th>
                  <th className="py-3.5 px-4">Lead Passenger & Hub</th>
                  <th className="py-3.5 px-4">Dual Assignment</th>
                  <th className="py-3.5 px-4">Schedule</th>
                  <th className="py-3.5 px-4">Service Items</th>
                  <th className="py-3.5 px-4">Supplier Allocation</th>
                  <th className="py-3.5 px-4 text-right">Selling Total</th>
                  <th className="py-3.5 px-4 text-center">Booking Status</th>
                  <th className="py-3.5 px-4 text-right">Desk Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings
                  .slice((currentPage - 1) * bookingsPageSize, currentPage * bookingsPageSize)
                  .map((b) => {
                  const totalItems = b.items?.length || 0;
                  const allocatedItems = b.items?.filter(it => Boolean(it.supplierId || it.supplierName)).length || 0;
                  const unallocatedCount = totalItems - allocatedItems;

                  return (
                    <tr 
                      key={b.id} 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        setInitialDeskSection('OVERVIEW');
                        setSelectedBookingId(b.id);
                      }}
                    >
                      {/* Booking Ref & Channel */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-slate-900 block text-xs">
                            {b.bookingReference}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[9px] font-bold">
                            {b.sourceType || 'DIRECT'}
                          </span>
                        </div>
                      </td>

                      {/* Lead Traveler */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block">
                            {b.customer?.leadTravelerName || 'Guest'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {b.destinationName || b.destination || 'Japan'}
                          </span>
                        </div>
                      </td>

                      {/* Dual Assignment (B2B Agent & Internal Operational Owner) */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1.5 min-w-[170px]">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">B2B Agent</span>
                            <span className="font-semibold text-slate-900 block text-xs truncate max-w-[180px]">
                              {b.agentNameSnapshot || b.agencyName || (b.submittingAgentId ? 'Partner Agent' : 'Direct')}
                            </span>
                            {b.agentAgencySnapshot && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-[180px]">
                                {b.agentAgencySnapshot}
                              </span>
                            )}
                            {(() => {
                              const agentUid = b.submittingAgentId || b.assignedAgentId || b.agentId;
                              const am = agentUid ? resolveUserAccountManager(agentUid) : null;
                              if (!am || !agentUid) return null;
                              return (
                                <span className={`text-[10px] font-semibold block truncate max-w-[180px] mt-0.5 ${am.isAssigned ? 'text-indigo-700' : 'text-amber-700'}`}>
                                  AM: {am.isAssigned ? am.name : 'Unassigned'}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] text-slate-400 font-bold block uppercase mb-0.5">Operational Owner</span>
                            <select
                              value={b.assignedTeamMemberId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                try {
                                  if (!val) {
                                    db.unassignBookingTeamMember(b.id, user, 'Unassigned from Bookings listing');
                                  } else {
                                    db.assignBookingInternalTeamMember(b.id, val, user, 'Assigned from Bookings listing');
                                  }
                                  setBookings(db.getAllBookings());
                                } catch (err: any) {
                                  setMigrationNotice({
                                    type: 'error',
                                    message: err?.message || 'Failed to update booking assignment'
                                  });
                                }
                              }}
                              className={`w-full px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer focus:outline-none ${
                                b.assignedTeamMemberId
                                  ? 'bg-teal-50 text-[#008f77] border-teal-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <option value="">-- Unassigned --</option>
                              {internalTeamMembers.length === 0 ? (
                                <option value="" disabled>No active team members available</option>
                              ) : (
                                internalTeamMembers.map(tm => (
                                  <option key={tm.id} value={tm.id}>
                                    {tm.name} ({tm.role})
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <div className="space-y-0.5 text-[11px] text-slate-600 font-mono">
                          <div>{b.travelStartDate || 'TBA'}</div>
                          <div className="text-slate-400">→ {b.travelEndDate || 'TBA'}</div>
                        </div>
                      </td>

                      {/* Services */}
                      <td className="py-4 px-4 align-top">
                        <span className="font-bold text-slate-800">
                          {totalItems} {totalItems === 1 ? 'Service' : 'Services'}
                        </span>
                      </td>

                      {/* Supplier Allocation Desk Badge */}
                      <td className="py-4 px-4 align-top">
                        {totalItems === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">No services</span>
                        ) : unallocatedCount === 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            Fully Allocated ({allocatedItems}/{totalItems})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                            {unallocatedCount} Pending Allocation
                          </span>
                        )}
                      </td>

                      {/* Selling Price */}
                      {(() => {
                        const fin = resolveAuthoritativeBookingFinancials(b);
                        const amtConv = convertForDisplay(fin.revisedBookingAmount, fin.currency || b.currency || 'USD');
                        const discConv = fin.hasManualDiscount
                          ? convertForDisplay(fin.adminManualDiscountTotal, fin.currency || b.currency || 'USD')
                          : null;
                        return (
                          <td className="py-4 px-4 align-top text-right whitespace-nowrap font-mono">
                            <span className={`font-bold block ${amtConv.status === 'UNAVAILABLE' ? 'text-amber-700' : 'text-slate-900'}`}>
                              {amtConv.formatted}
                            </span>
                            {fin.hasManualDiscount && discConv && (
                              <span className="text-[10px] font-bold text-emerald-700 block">
                                Disc −{discConv.formatted} (v{fin.latestSnapshotVersion})
                              </span>
                            )}
                            {amtConv.isConverted && (
                              <span className="text-[10px] text-slate-400 block">
                                Booked: {amtConv.nativeFormatted}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold block ${
                              fin.isOverpaid
                                ? 'text-indigo-700'
                                : fin.paymentStatus === 'PAID'
                                ? 'text-emerald-700'
                                : 'text-blue-700'
                            }`}>
                              {fin.isOverpaid ? 'PAID (CREDIT)' : (fin.paymentStatus || 'PENDING')}
                            </span>
                          </td>
                        );
                      })()}

                      {/* Status */}
                      <td className="py-4 px-4 align-top text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-block ${
                          b.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : b.status === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          {b.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInitialDeskSection('OVERVIEW');
                            setSelectedBookingId(b.id);
                          }}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-xs"
                        >
                          <span>Open Desk</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredBookings.length > bookingsPageSize && (() => {
              const totalPages = Math.max(1, Math.ceil(filteredBookings.length / bookingsPageSize));
              const safePage = Math.min(currentPage, totalPages);
              return (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-600">
                  <span>
                    Showing <strong>{((safePage - 1) * bookingsPageSize) + 1}</strong> to{' '}
                    <strong>{Math.min(safePage * bookingsPageSize, filteredBookings.length)}</strong> of{' '}
                    <strong>{filteredBookings.length}</strong> bookings
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      Prev
                    </button>
                    <span className="font-mono font-bold px-2">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Single Authoritative Booking Creation Modal */}
      {isManualModalOpen && (
        <ManualOperationalBookingModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          currentUser={user}
          onSuccess={(createdBookingId) => {
            setIsManualModalOpen(false);
            setInitialDeskSection('SERVICES');
            setSelectedBookingId(createdBookingId);
          }}
        />
      )}
    </div>
  );
};
