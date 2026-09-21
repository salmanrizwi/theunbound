import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  SlidersHorizontal, 
  Printer, 
  AlertTriangle, 
  Building2, 
  Car, 
  Compass, 
  Sparkles, 
  Users, 
  Send, 
  CheckCircle2, 
  FileText, 
  Layers, 
  Grid, 
  List, 
  MapPin, 
  X,
  ArrowRight,
  ShieldCheck,
  Eye,
  Check
} from 'lucide-react';
import { Booking, User, Supplier, CalendarTask } from '../../types';
import { AppDatabase } from '../../services/db';
import { 
  OperationalItem, 
  HorizonViewMode, 
  OperationalHorizonFilters,
  OperationalCategory 
} from './horizon/horizonTypes';
import { 
  resolveOperationalItems, 
  calculateDailyMetrics, 
  groupItemsByTimeSlot,
  normalizeDate 
} from './horizon/horizonUtils';
import { OperationalHorizonSummaryCards } from './horizon/OperationalHorizonSummaryCards';
import { OperationalNeedsAttentionPanel } from './horizon/OperationalNeedsAttentionPanel';
import { OperationalItemCard } from './horizon/OperationalItemCard';
import { OperationalDispatchModal } from './horizon/OperationalDispatchModal';
import { DailyDispatchPrintView } from './horizon/DailyDispatchPrintView';

interface OperationalHorizonDeskProps {
  currentUser: User | null;
  onOpenBooking: (bookingId: string) => void;
  onBackToAllocationDesk?: () => void;
}

export const OperationalHorizonDesk: React.FC<OperationalHorizonDeskProps> = ({
  currentUser,
  onOpenBooking,
  onBackToAllocationDesk
}) => {
  const db = AppDatabase.getInstance();

  // 1. Initial State & Dates
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [filters, setFilters] = useState<OperationalHorizonFilters>({
    date: todayStr,
    isRangeMode: false,
    endDate: todayStr,
    category: 'ALL',
    destination: 'ALL',
    hub: 'ALL',
    supplierId: 'ALL',
    operationalStatus: 'ALL',
    voucherStatus: 'ALL',
    quickFilter: 'ALL',
    searchQuery: ''
  });

  const [viewMode, setViewMode] = useState<HorizonViewMode>('TIMELINE');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [selectedItemForDispatch, setSelectedItemForDispatch] = useState<OperationalItem | null>(null);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // 2. Fetch authoritative records from db
  const [rawBookings, setRawBookings] = useState<Booking[]>([]);
  const [rawTasks, setRawTasks] = useState<CalendarTask[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const loadData = () => {
    setIsRefreshing(true);
    try {
      const allBookings = db.getAllBookings();
      const allTasks = db.getCalendarTasks();
      const allSuppliers = db.getSuppliers();

      // If user is B2B agent, restrict strictly to their own bookings
      const isInternal = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';
      const filteredBookings = isInternal 
        ? allBookings 
        : allBookings.filter(b => b.agentId === currentUser?.id || b.b2bAgentId === currentUser?.id || b.userId === currentUser?.id);

      setRawBookings(filteredBookings);
      setRawTasks(allTasks);
      setSuppliers(allSuppliers);
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // If today has 0 items, check if there's any bookings with items and pick the nearest date with active items
  useEffect(() => {
    if (rawBookings.length > 0 && filters.date === todayStr) {
      const allDatesWithServices: string[] = [];
      rawBookings.forEach(b => {
        (b.items || []).forEach(it => {
          const d = normalizeDate(it.serviceHotelDetails?.checkInDate || it.serviceDate || it.travelDate || b.travelStartDate);
          if (d) allDatesWithServices.push(d);
        });
      });
      // If current date has no items but bookings exist, let user stay on today or suggest dates
    }
  }, [rawBookings]);

  // 3. Resolve all operational items for the selected date or range
  const allResolvedItems = useMemo(() => {
    return resolveOperationalItems(
      rawBookings,
      rawTasks,
      filters.date,
      filters.isRangeMode,
      filters.endDate
    );
  }, [rawBookings, rawTasks, filters.date, filters.isRangeMode, filters.endDate]);

  // 4. Compute daily summary metrics for the date
  const dailyMetrics = useMemo(() => {
    return calculateDailyMetrics(allResolvedItems);
  }, [allResolvedItems]);

  // 5. Filter the items based on user filters
  const filteredItems = useMemo(() => {
    return allResolvedItems.filter(item => {
      // Category filter
      if (filters.category !== 'ALL') {
        if (filters.category === 'HOTEL_CHECK_IN' && item.operationalType !== 'HOTEL_CHECK_IN') return false;
        if (filters.category === 'HOTEL_CHECK_OUT' && item.operationalType !== 'HOTEL_CHECK_OUT') return false;
        if (filters.category !== 'HOTEL_CHECK_IN' && filters.category !== 'HOTEL_CHECK_OUT' && item.category !== filters.category) return false;
      }

      // Destination / Hub
      if (filters.destination !== 'ALL' && item.destination !== filters.destination) return false;
      if (filters.hub !== 'ALL' && item.hub !== filters.hub) return false;

      // Supplier
      if (filters.supplierId !== 'ALL') {
        if (filters.supplierId === 'UNALLOCATED' && (item.supplierId || item.supplierName)) return false;
        if (filters.supplierId !== 'UNALLOCATED' && item.supplierId !== filters.supplierId) return false;
      }

      // Operational Status
      if (filters.operationalStatus !== 'ALL' && item.operationalStatus !== filters.operationalStatus) return false;

      // Voucher Status
      if (filters.voucherStatus !== 'ALL' && item.voucherStatus !== filters.voucherStatus) return false;

      // Quick Filters
      if (filters.quickFilter === 'NEEDS_ATTENTION') {
        if (item.attentionFlags.length === 0 && item.conflicts.length === 0) return false;
      } else if (filters.quickFilter === 'MISSING_SUPPLIER') {
        if (item.supplierId || item.supplierName) return false;
      } else if (filters.quickFilter === 'AWAITING_CONFIRMATION') {
        if (item.supplierConfirmationStatus === 'Confirmed') return false;
      } else if (filters.quickFilter === 'MISSING_VOUCHER') {
        if (item.voucherStatus === 'Issued' || item.voucherStatus === 'Generated') return false;
      } else if (filters.quickFilter === 'MISSING_REPORTING_TIME') {
        if (item.reportingTime) return false;
      } else if (filters.quickFilter === 'READY_DISPATCH') {
        if (!item.operationalStatus.toLowerCase().includes('dispatch') && !item.operationalStatus.toLowerCase().includes('ready')) return false;
      } else if (filters.quickFilter === 'IN_PROGRESS') {
        if (!item.operationalStatus.toLowerCase().includes('progress')) return false;
      } else if (filters.quickFilter === 'COMPLETED') {
        if (!item.operationalStatus.toLowerCase().includes('completed')) return false;
      } else if (filters.quickFilter === 'HAS_CONFLICTS') {
        if (item.conflicts.length === 0) return false;
      }

      // Search Query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        const match = 
          item.bookingReference.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.leadPassengerName.toLowerCase().includes(q) ||
          (item.b2bAgentName && item.b2bAgentName.toLowerCase().includes(q)) ||
          (item.supplierName && item.supplierName.toLowerCase().includes(q)) ||
          (item.driverName && item.driverName.toLowerCase().includes(q)) ||
          (item.guideName && item.guideName.toLowerCase().includes(q)) ||
          (item.pickupLocation && item.pickupLocation.toLowerCase().includes(q)) ||
          (item.dropoffLocation && item.dropoffLocation.toLowerCase().includes(q)) ||
          item.destination.toLowerCase().includes(q) ||
          item.hub.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allResolvedItems, filters]);

  // 6. Find all distinct upcoming dates that have active services in the database
  const datesWithServices = useMemo(() => {
    const datesMap = new Map<string, number>();
    rawBookings.forEach(b => {
      (b.items || []).forEach(it => {
        const d = normalizeDate(it.serviceHotelDetails?.checkInDate || it.serviceDate || it.travelDate || b.travelStartDate);
        if (d) {
          datesMap.set(d, (datesMap.get(d) || 0) + 1);
        }
      });
    });
    return Array.from(datesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 8);
  }, [rawBookings]);

  // 7. Dynamic filter options
  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    allResolvedItems.forEach(it => {
      if (it.destination) set.add(it.destination);
    });
    return Array.from(set).sort();
  }, [allResolvedItems]);

  const hubOptions = useMemo(() => {
    const set = new Set<string>();
    allResolvedItems.forEach(it => {
      if (it.hub) set.add(it.hub);
    });
    return Array.from(set).sort();
  }, [allResolvedItems]);

  // Date step handlers
  const handleStepDay = (days: number) => {
    const curr = new Date(filters.date);
    curr.setDate(curr.getDate() + days);
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    const nextDate = `${y}-${m}-${d}`;
    setFilters(prev => ({
      ...prev,
      date: nextDate,
      endDate: prev.isRangeMode ? nextDate : prev.endDate
    }));
  };

  const handleSetQuickDate = (dateVal: string) => {
    setFilters(prev => ({
      ...prev,
      date: dateVal,
      endDate: prev.isRangeMode ? dateVal : prev.endDate
    }));
  };

  // Quick Status Update
  const handleQuickStatusUpdate = (item: OperationalItem, newStatus: string) => {
    if (!item.serviceItemId) return;
    db.updateServiceItem(item.bookingId, item.serviceItemId, {
      operationalStatus: newStatus as any
    }, currentUser);
    loadData();
  };

  const isInternal = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';

  // Format header date string
  const formattedDateHeader = useMemo(() => {
    try {
      const d = new Date(filters.date + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return filters.date;
    }
  }, [filters.date]);

  // Check if any filters are active
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category !== 'ALL') count++;
    if (filters.destination !== 'ALL') count++;
    if (filters.hub !== 'ALL') count++;
    if (filters.supplierId !== 'ALL') count++;
    if (filters.operationalStatus !== 'ALL') count++;
    if (filters.voucherStatus !== 'ALL') count++;
    if (filters.quickFilter !== 'ALL') count++;
    if (filters.searchQuery.trim()) count++;
    return count;
  }, [filters]);

  const resetAllFilters = () => {
    setFilters(prev => ({
      ...prev,
      category: 'ALL',
      destination: 'ALL',
      hub: 'ALL',
      supplierId: 'ALL',
      operationalStatus: 'ALL',
      voucherStatus: 'ALL',
      quickFilter: 'ALL',
      searchQuery: ''
    }));
  };

  return (
    <div className="space-y-6" id="operational-horizon-desk">
      {/* 1. Master Desk Header & Breadcrumb */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 flex-wrap">
              <span>Booking Management</span>
              <span>/</span>
              {onBackToAllocationDesk ? (
                <button
                  type="button"
                  onClick={onBackToAllocationDesk}
                  className="hover:text-slate-900 text-slate-600 transition-colors cursor-pointer"
                >
                  Booking Operations & Supplier Allocation
                </button>
              ) : (
                <span>Booking Operations & Supplier Allocation</span>
              )}
              <span>/</span>
              <span className="text-[#008972] font-black">
                Operational Horizon & Ground Dispatch Desk
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Operational Horizon & Ground Dispatch Desk
              </h1>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                <span>Live Firestore Operations</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500">
              Centralized ground operations console showing every confirmed tour, transfer, hotel check-in/out, and scheduled service item for daily dispatch.
            </p>
          </div>

          {/* Top Actions: Switch view, Print manifest, Refresh */}
          <div className="flex items-center space-x-2.5 self-start lg:self-center shrink-0 flex-wrap gap-y-2">
            {onBackToAllocationDesk && (
              <button
                type="button"
                onClick={onBackToAllocationDesk}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1.5"
              >
                <span>Back to Supplier Allocation</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Daily Dispatch Roster</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1.5 disabled:opacity-50"
              title={`Last refreshed at ${lastRefreshed.toLocaleTimeString()}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Desk</span>
            </button>
          </div>
        </div>

        {/* 2. Operational Date Navigator Controls */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Main Date stepper */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleStepDay(-1)}
              className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shadow-2xs"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl">
              <CalendarIcon className="w-4 h-4 text-[#008972]" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => {
                  if (e.target.value) {
                    setFilters(prev => ({
                      ...prev,
                      date: e.target.value,
                      endDate: prev.isRangeMode ? e.target.value : prev.endDate
                    }));
                  }
                }}
                className="text-xs font-bold bg-transparent text-slate-900 focus:outline-hidden cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => handleStepDay(1)}
              className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shadow-2xs"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSetQuickDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filters.date === todayStr 
                  ? 'bg-slate-900 text-white shadow-2xs' 
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                const tmr = new Date();
                tmr.setDate(tmr.getDate() + 1);
                handleSetQuickDate(tmr.toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
            >
              Tomorrow
            </button>
          </div>

          {/* Formatted Date Banner */}
          <div className="flex items-center space-x-3 text-right">
            <div>
              <span className="text-sm sm:text-base font-black text-slate-900 block">
                {formattedDateHeader}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {allResolvedItems.length} operational service{allResolvedItems.length !== 1 ? 's' : ''} scheduled
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Daily Summary Cards */}
      <OperationalHorizonSummaryCards
        metrics={dailyMetrics}
        filters={filters}
        onFilterChange={(updates) => setFilters(prev => ({ ...prev, ...updates }))}
      />

      {/* 4. "Needs Attention" Panel (Collapsible Alert Drawer) */}
      <OperationalNeedsAttentionPanel
        items={allResolvedItems}
        onOpenBooking={onOpenBooking}
        onQuickDispatch={(item) => {
          setSelectedItemForDispatch(item);
          setIsDispatchModalOpen(true);
        }}
      />

      {/* 5. Search Bar & Multi-Dimensional Filters Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              placeholder="Search reference (#BK-), guest name, service title, driver, guide, supplier, hub..."
              className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#008972] transition-colors"
            />
            {filters.searchQuery && (
              <button
                type="button"
                onClick={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode switcher */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('TIMELINE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'TIMELINE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('CATEGORY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'CATEGORY' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Category</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('DESTINATION')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'DESTINATION' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Hub</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('SUPPLIER')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'SUPPLIER' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Supplier</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('STATUS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'STATUS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Status</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Roster</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#008972]"
            >
              <option value="ALL">All Categories</option>
              <option value="HOTEL_CHECK_IN">Hotel Check-ins</option>
              <option value="HOTEL_CHECK_OUT">Hotel Check-outs</option>
              <option value="HOTEL">Hotels (All Stays)</option>
              <option value="TRANSFER">Transfers & Chauffeurs</option>
              <option value="TOUR">Sightseeing & Tours</option>
              <option value="ACTIVITY">Attractions & Activities</option>
              <option value="GUIDE">Licensed Guides</option>
              <option value="VISA">Visas & Appointments</option>
              <option value="TASK">Operational Tasks</option>
            </select>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Destination
            </label>
            <select
              value={filters.destination}
              onChange={(e) => setFilters(prev => ({ ...prev, destination: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#008972]"
            >
              <option value="ALL">All Destinations</option>
              {destinationOptions.map((dest) => (
                <option key={dest} value={dest}>{dest}</option>
              ))}
            </select>
          </div>

          {/* City Hub */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              City / Hub
            </label>
            <select
              value={filters.hub}
              onChange={(e) => setFilters(prev => ({ ...prev, hub: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#008972]"
            >
              <option value="ALL">All Hubs</option>
              {hubOptions.map((hub) => (
                <option key={hub} value={hub}>{hub}</option>
              ))}
            </select>
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Ground Supplier
            </label>
            <select
              value={filters.supplierId}
              onChange={(e) => setFilters(prev => ({ ...prev, supplierId: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#008972]"
            >
              <option value="ALL">All Suppliers</option>
              <option value="UNALLOCATED">⚠️ Unallocated Only</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Operational Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Dispatch Status
            </label>
            <select
              value={filters.operationalStatus}
              onChange={(e) => setFilters(prev => ({ ...prev, operationalStatus: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-hidden focus:border-[#008972]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Ready for Dispatch">Ready for Dispatch</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Pending Supplier">Pending Supplier</option>
              <option value="Confirmation Pending">Confirmation Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Quick Filter Reset */}
          <div className="flex items-end">
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={resetAllFilters}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center justify-center space-x-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 py-2 block text-center w-full">
                No active filters
              </span>
            )}
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Quick Views:</span>
          {[
            { id: 'ALL', label: 'All Items' },
            { id: 'NEEDS_ATTENTION', label: '⚠️ Needs Attention' },
            { id: 'MISSING_SUPPLIER', label: 'Missing Supplier' },
            { id: 'AWAITING_CONFIRMATION', label: 'Awaiting Confirmation' },
            { id: 'READY_DISPATCH', label: 'Ready for Dispatch' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'HAS_CONFLICTS', label: 'Schedule Conflicts' }
          ].map((qf) => (
            <button
              key={qf.id}
              type="button"
              onClick={() => setFilters(prev => ({ ...prev, quickFilter: qf.id as any }))}
              className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                filters.quickFilter === qf.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {qf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Active Operational Items Render Area */}
      {filteredItems.length === 0 ? (
        /* Empty state: Clean, helpful, shows real dates with data */
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1">
            No Operational Services Scheduled for {filters.date}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            There are no tours, transfers, hotel check-ins, or tasks scheduled on this day matching your current filters.
          </p>

          {/* Helpful suggestions from live database */}
          {datesWithServices.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 max-w-xl mx-auto text-left">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Upcoming dates with active operational bookings:
              </span>
              <div className="flex flex-wrap gap-2">
                {datesWithServices.map(([dateVal, count]) => (
                  <button
                    key={dateVal}
                    type="button"
                    onClick={() => handleSetQuickDate(dateVal)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs inline-flex items-center space-x-1.5"
                  >
                    <span>{dateVal}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-teal-50 text-teal-800 font-mono text-[10px] font-bold border border-teal-200">
                      {count} items
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Render items according to selected view mode */
        <div className="space-y-6">
          {/* VIEW 1: Chronological Daily Timeline View */}
          {viewMode === 'TIMELINE' && (
            <div className="space-y-6">
              {groupItemsByTimeSlot(filteredItems).map((slot) => {
                if (slot.items.length === 0) return null;
                return (
                  <div key={slot.id} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">
                            {slot.label}
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            {slot.subLabel} • <span className="font-mono">{slot.timeRange}</span>
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {slot.items.length} Service{slot.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {slot.items.map((item) => (
                        <OperationalItemCard
                          key={item.id}
                          item={item}
                          isInternal={isInternal}
                          onOpenBooking={onOpenBooking}
                          onQuickDispatch={(it) => {
                            setSelectedItemForDispatch(it);
                            setIsDispatchModalOpen(true);
                          }}
                          onQuickStatusUpdate={handleQuickStatusUpdate}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 2: Category View */}
          {viewMode === 'CATEGORY' && (
            <div className="space-y-6">
              {[
                { cat: 'HOTEL', label: 'Hotel Operations (Check-ins, Check-outs & Stays)', icon: Building2 },
                { cat: 'TRANSFER', label: 'Ground Transfers & Chauffeur Dispatches', icon: Car },
                { cat: 'TOUR', label: 'Sightseeing & Excursions', icon: Compass },
                { cat: 'ACTIVITY', label: 'Attractions & Special Activities', icon: Sparkles },
                { cat: 'TASK', label: 'Operational Ground Tasks', icon: FileText },
                { cat: 'OTHER', label: 'Other Scheduled Services', icon: Layers }
              ].map(({ cat, label, icon: CatIcon }) => {
                const groupItems = filteredItems.filter(it => it.category === cat);
                if (groupItems.length === 0) return null;

                return (
                  <div key={cat} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center">
                          <CatIcon className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900">{label}</h3>
                      </div>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {groupItems.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupItems.map((item) => (
                        <OperationalItemCard
                          key={item.id}
                          item={item}
                          isInternal={isInternal}
                          onOpenBooking={onOpenBooking}
                          onQuickDispatch={(it) => {
                            setSelectedItemForDispatch(it);
                            setIsDispatchModalOpen(true);
                          }}
                          onQuickStatusUpdate={handleQuickStatusUpdate}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 3: Destination & Hub View */}
          {viewMode === 'DESTINATION' && (
            <div className="space-y-6">
              {Array.from(new Set(filteredItems.map(it => it.hub || it.destination || 'Unspecified Hub'))).map((hubName) => {
                const groupItems = filteredItems.filter(it => (it.hub || it.destination || 'Unspecified Hub') === hubName);
                return (
                  <div key={hubName} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-black text-slate-900">{hubName}</h3>
                      </div>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {groupItems.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupItems.map((item) => (
                        <OperationalItemCard
                          key={item.id}
                          item={item}
                          isInternal={isInternal}
                          onOpenBooking={onOpenBooking}
                          onQuickDispatch={(it) => {
                            setSelectedItemForDispatch(it);
                            setIsDispatchModalOpen(true);
                          }}
                          onQuickStatusUpdate={handleQuickStatusUpdate}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 4: Supplier View */}
          {viewMode === 'SUPPLIER' && (
            <div className="space-y-6">
              {Array.from(new Set(filteredItems.map(it => it.supplierName || 'Unallocated Ground Supplier'))).map((supName) => {
                const groupItems = filteredItems.filter(it => (it.supplierName || 'Unallocated Ground Supplier') === supName);
                return (
                  <div key={supName} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-black text-slate-900">{supName}</h3>
                      </div>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {groupItems.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupItems.map((item) => (
                        <OperationalItemCard
                          key={item.id}
                          item={item}
                          isInternal={isInternal}
                          onOpenBooking={onOpenBooking}
                          onQuickDispatch={(it) => {
                            setSelectedItemForDispatch(it);
                            setIsDispatchModalOpen(true);
                          }}
                          onQuickStatusUpdate={handleQuickStatusUpdate}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 5: Status View */}
          {viewMode === 'STATUS' && (
            <div className="space-y-6">
              {Array.from(new Set(filteredItems.map(it => it.operationalStatus || 'Confirmed'))).map((stName) => {
                const groupItems = filteredItems.filter(it => (it.operationalStatus || 'Confirmed') === stName);
                return (
                  <div key={stName} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-black text-slate-900">{stName}</h3>
                      </div>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {groupItems.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupItems.map((item) => (
                        <OperationalItemCard
                          key={item.id}
                          item={item}
                          isInternal={isInternal}
                          onOpenBooking={onOpenBooking}
                          onQuickDispatch={(it) => {
                            setSelectedItemForDispatch(it);
                            setIsDispatchModalOpen(true);
                          }}
                          onQuickStatusUpdate={handleQuickStatusUpdate}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 6: High-Density Operational Roster View (Table) */}
          {viewMode === 'LIST' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="p-3.5 pl-6 w-24">Time</th>
                      <th className="p-3.5 w-36">Booking Ref</th>
                      <th className="p-3.5">Service Item</th>
                      <th className="p-3.5">Lead Guest</th>
                      <th className="p-3.5">Pickup / Route</th>
                      <th className="p-3.5">Supplier / Fleet</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 pr-6 text-right w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 pl-6 font-mono font-bold text-slate-900">
                          {it.reportingTime || it.startTime || 'Flex'}
                        </td>
                        <td className="p-3.5 font-mono">
                          <button
                            type="button"
                            onClick={() => onOpenBooking(it.bookingId)}
                            className="font-bold text-slate-900 hover:text-[#008972] transition-colors cursor-pointer"
                          >
                            #{it.bookingReference}
                          </button>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-900">
                          <div className="line-clamp-1">{it.title}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{it.operationalTypeLabel}</div>
                        </td>
                        <td className="p-3.5 text-slate-700 font-medium">
                          {it.leadPassengerName} ({it.totalPax}p)
                        </td>
                        <td className="p-3.5 text-slate-600">
                          <span className="line-clamp-1">{it.pickupLocation || it.hub}</span>
                        </td>
                        <td className="p-3.5 text-slate-700">
                          <div className="font-semibold line-clamp-1">{it.supplierName || 'Unallocated'}</div>
                          {it.driverName && <div className="text-[10px] text-teal-800">Chauffeur: {it.driverName}</div>}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {it.operationalStatus}
                          </span>
                        </td>
                        <td className="p-3.5 pr-6 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemForDispatch(it);
                                setIsDispatchModalOpen(true);
                              }}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="Quick Dispatch"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenBooking(it.bookingId)}
                              className="p-1 rounded-lg hover:bg-slate-100 text-[#008972] cursor-pointer"
                              title="Open Booking Desk"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Quick Dispatch Modal */}
      <OperationalDispatchModal
        item={selectedItemForDispatch}
        isOpen={isDispatchModalOpen}
        onClose={() => {
          setIsDispatchModalOpen(false);
          setSelectedItemForDispatch(null);
        }}
        currentUser={currentUser}
        suppliers={suppliers}
        onSaved={loadData}
      />

      {/* 8. Daily Dispatch Print / Manifest Modal */}
      <DailyDispatchPrintView
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        selectedDate={filters.date}
        items={allResolvedItems}
      />
    </div>
  );
};
