import React, { useState, useMemo, useEffect } from 'react';
import {
  Booking,
  BookingItem,
  BookingVoucher,
  Hotel,
  Product,
  Supplier,
  SupplierAllocationRecord,
  User
} from '../../../types';
import { AppDatabase } from '../../../services/db';
import { formatCurrency } from '../../../services/pricingEngine';
import { hasBookingOperationsPermission } from '../../../services/permissionEngine';
import {
  Search,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Trash2,
  FileText,
  Layers,
  DollarSign,
  Sliders,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Link2
} from 'lucide-react';
import {
  EditServiceItemModal,
  AddServiceItemModal
} from '../ServiceItemActionModals';
import { ConsolidatedSupplierAllocationModal } from '../ConsolidatedSupplierAllocationModal';
import { VoucherDocumentView } from '../VoucherDocumentView';
import { GlobalConfiguratorRouter } from '../../Configurators/GlobalConfiguratorRouter';
import {
  CANONICAL_ALLOCATION_STATUSES,
  CanonicalAllocationStatus,
  HydratedBookingServiceItem,
  hydrateBookingServiceItem,
  resolveCanonicalAllocationStatus
} from '../../../services/bookingOperationsSyncService';
import {
  buildConfiguredCategoryFilterOptions,
  calculateMarginMetrics,
  isItemEligibleForNewConsolidatedAllocation,
  matchesCategoryFilter,
  roundCurrency
} from '../../../services/supplierAllocationEngine';

interface DeskServiceItemsSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

export const DeskServiceItemsSection: React.FC<DeskServiceItemsSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    db.getProducts().forEach(p => { if (p?.id) m.set(p.id, p); });
    return m;
  }, [db]);

  const hotelMap = useMemo(() => {
    const m = new Map<string, Hotel>();
    db.getHotels().forEach(h => { if (h?.id) m.set(h.id, h); });
    return m;
  }, [db]);

  const items: HydratedBookingServiceItem[] = useMemo(() => {
    return (booking.items || []).map(it =>
      hydrateBookingServiceItem(
        it,
        booking,
        it.productId ? productMap.get(it.productId) || null : null,
        (it.hotelId || it.productId) ? hotelMap.get(it.hotelId || it.productId) || null : null
      )
    );
  }, [booking, productMap, hotelMap]);

  const consolidatedAllocations: SupplierAllocationRecord[] = useMemo(() => {
    return db.getBookingConsolidatedAllocations(booking.id);
  }, [booking, db]);

  // Role permissions (Net Price, Margin & Supplier Allocation strictly internal)
  const isInternal =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'TEAM_MEMBER' ||
    currentUser?.role === 'DMC_STAFF';
  const canAllocate = hasBookingOperationsPermission(currentUser, 'allocate_supplier');
  const canManagePrices = hasBookingOperationsPermission(currentUser, 'manage_supplier_prices');
  const canAddItems = isInternal;

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [allocationFilter, setAllocationFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [destinationFilter, setDestinationFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Inline feedback banner (no window.alert)
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Content Preview Expansion per Service Item
  const [expandedContentIds, setExpandedContentIds] = useState<Record<string, boolean>>({});

  // Multi-Select State for Consolidated Supplier Allocation
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isConsolidatedCreateOpen, setIsConsolidatedCreateOpen] = useState(false);
  const [viewingConsolidatedAllocation, setViewingConsolidatedAllocation] = useState<SupplierAllocationRecord | null>(null);

  // Existing Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BookingItem | null>(null);
  const [configuringItem, setConfiguringItem] = useState<BookingItem | null>(null);
  const [selectedVoucherForPreview, setSelectedVoucherForPreview] = useState<BookingVoucher | null>(null);
  const [deletingItem, setDeletingItem] = useState<BookingItem | null>(null);

  // Individual Synchronised Supplier Allocation Modal State
  const [isQuickAllocOpen, setIsQuickAllocOpen] = useState(false);
  const [quickAllocItem, setQuickAllocItem] = useState<HydratedBookingServiceItem | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [allocStatus, setAllocStatus] = useState<CanonicalAllocationStatus>('Pending Allocation');
  const [allocConfirmationRef, setAllocConfirmationRef] = useState('');
  const [allocNotes, setAllocNotes] = useState('');

  // Quick Price Modal State
  const [isQuickPriceOpen, setIsQuickPriceOpen] = useState(false);
  const [quickPriceItem, setQuickPriceItem] = useState<HydratedBookingServiceItem | null>(null);
  const [newQuickPrice, setNewQuickPrice] = useState('');
  const [quickPriceReason, setQuickPriceReason] = useState('');
  const [quickForceReconfirm, setQuickForceReconfirm] = useState(false);

  // Master Suppliers
  const masterSuppliers = useMemo(() => {
    return db.getSuppliers().filter((s: Supplier) => s.status !== 'ARCHIVED');
  }, [db]);

  // Authoritative Category Filter Options (from Product Management & Hotel Management)
  const categoryOptions = useMemo(() => {
    return buildConfiguredCategoryFilterOptions(booking.items || [], productMap, hotelMap);
  }, [booking.items, productMap, hotelMap]);

  // Unique Suppliers & Destinations for Combined Filters
  const supplierFilterOptions = useMemo(() => {
    const names = new Set<string>();
    items.forEach(it => { if (it.supplierName) names.add(it.supplierName); });
    return Array.from(names).sort();
  }, [items]);

  const destinationFilterOptions = useMemo(() => {
    const dests = new Set<string>();
    items.forEach(it => {
      const d = it.destination || it.destinationName || it.city || it.hub;
      if (d) dests.add(d);
    });
    return Array.from(dests).sort();
  }, [items]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, allocationFilter, supplierFilter, destinationFilter, dateFilter, pageSize]);

  // Prune selected IDs that are no longer eligible after refresh
  useEffect(() => {
    setSelectedItemIds(prev =>
      prev.filter(id => {
        const it = items.find(i => i.id === id);
        if (!it) return false;
        return isItemEligibleForNewConsolidatedAllocation(it, consolidatedAllocations).eligible;
      })
    );
  }, [items, consolidatedAllocations]);

  // Combined Filter Pipeline
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return items.filter(item => {
      const matchesSearch =
        !q ||
        item.productName.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.city && item.city.toLowerCase().includes(q)) ||
        (item.hub && item.hub.toLowerCase().includes(q)) ||
        (item.destination && item.destination.toLowerCase().includes(q)) ||
        (item.destinationName && item.destinationName.toLowerCase().includes(q)) ||
        (item.supplierName && item.supplierName.toLowerCase().includes(q)) ||
        item.resolvedCategoryLabel.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      // Authoritative Category Filter (Product Management / Hotel Management / canonical snapshot)
      const prod = item.productId ? productMap.get(item.productId) || null : null;
      const hotel = (item.hotelId || item.productId)
        ? hotelMap.get(item.hotelId || item.productId) || null
        : null;
      if (!matchesCategoryFilter(item, categoryFilter, prod, hotel)) return false;

      // Allocation Status Filter
      if (allocationFilter === 'ALLOCATED' && !item.supplierId && !item.supplierName) return false;
      if (allocationFilter === 'UNALLOCATED' && (item.supplierId || item.supplierName)) return false;
      if (allocationFilter === 'CONSOLIDATED' && !item.consolidatedAllocationId) return false;
      if (
        allocationFilter === 'RECONFIRMATION_REQUIRED' &&
        item.supplierConfirmationStatus !== 'Supplier Reconfirmation Required' &&
        item.resolvedCanonicalAllocationStatus !== 'Amendment Required'
      ) {
        return false;
      }

      // Supplier Filter
      if (supplierFilter !== 'ALL' && item.supplierName !== supplierFilter) return false;

      // Destination Filter
      if (destinationFilter !== 'ALL') {
        const itemDest = item.destination || item.destinationName || item.city || item.hub || '';
        if (itemDest !== destinationFilter) return false;
      }

      // Service Date Filter
      if (dateFilter) {
        const itemDate = (item.resolvedServiceDate || item.serviceDate || item.travelDate || '').slice(0, 10);
        if (itemDate !== dateFilter) return false;
      }

      return true;
    });
  }, [
    items,
    searchQuery,
    categoryFilter,
    allocationFilter,
    supplierFilter,
    destinationFilter,
    dateFilter,
    productMap,
    hotelMap
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    categoryFilter !== 'ALL' ||
    allocationFilter !== 'ALL' ||
    supplierFilter !== 'ALL' ||
    destinationFilter !== 'ALL' ||
    dateFilter
  );

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setAllocationFilter('ALL');
    setSupplierFilter('ALL');
    setDestinationFilter('ALL');
    setDateFilter('');
    setCurrentPage(1);
  };

  // Reconciled Financial Summary for currently filtered items (Internal Admin/Finance only)
  const financialTotals = useMemo(() => {
    const totalNet = roundCurrency(filteredItems.reduce((sum, it) => sum + (it.resolvedNetPrice || 0), 0));
    const totalSelling = roundCurrency(filteredItems.reduce((sum, it) => sum + (it.resolvedSellingPrice || 0), 0));
    const metrics = calculateMarginMetrics(totalNet, totalSelling);
    const missingNetCount = filteredItems.filter(it => it.resolvedIsLegacyMissingNet).length;
    return {
      totalNet,
      totalSelling,
      totalMargin: metrics.marginAmount,
      marginPercent: metrics.marginPercent,
      missingNetCount
    };
  }, [filteredItems]);

  // Multi-select helpers
  const eligibleOnCurrentPage = useMemo(() => {
    return paginatedItems.filter(
      it => isItemEligibleForNewConsolidatedAllocation(it, consolidatedAllocations).eligible
    );
  }, [paginatedItems, consolidatedAllocations]);

  const allEligibleOnPageSelected =
    eligibleOnCurrentPage.length > 0 &&
    eligibleOnCurrentPage.every(it => selectedItemIds.includes(it.id));

  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAllOnPage = () => {
    const pageEligibleIds = eligibleOnCurrentPage.map(it => it.id);
    if (allEligibleOnPageSelected) {
      setSelectedItemIds(prev => prev.filter(id => !pageEligibleIds.includes(id)));
    } else {
      setSelectedItemIds(prev => Array.from(new Set([...prev, ...pageEligibleIds])));
    }
  };

  const selectedItemsList = useMemo(() => {
    const idSet = new Set(selectedItemIds);
    return items.filter(it => idSet.has(it.id));
  }, [items, selectedItemIds]);

  const selectedSummary = useMemo(() => {
    const net = roundCurrency(selectedItemsList.reduce((s, i) => s + (i.resolvedNetPrice || 0), 0));
    const selling = roundCurrency(selectedItemsList.reduce((s, i) => s + (i.resolvedSellingPrice || 0), 0));
    return { net, selling };
  }, [selectedItemsList]);

  // Handle Delete Service Item
  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    const all = db.getAllBookings();
    const b = all.find(item => item.id === booking.id);
    if (!b || !b.items) return;

    const removedItemName = deletingItem.productName;
    b.items = b.items.filter(it => it.id !== deletingItem.id);
    b.updatedAt = new Date().toISOString();

    db.recordBookingActivity({
      eventId: `act-${Date.now()}`,
      bookingId: b.id,
      eventType: 'SERVICE_ITEM_REMOVED',
      previousValue: removedItemName,
      newValue: 'DELETED',
      actorId: currentUser?.id || 'staff',
      actorRole: currentUser?.role || 'TEAM_MEMBER',
      actorName: currentUser?.displayName || currentUser?.name || 'Operations Lead',
      timestamp: new Date().toISOString(),
      description: `Service item removed: "${removedItemName}"`
    }, currentUser);

    db.saveBooking(b, currentUser);
    setDeletingItem(null);
    setFeedbackBanner({ type: 'success', message: `Removed "${removedItemName}" from booking.` });
    onRefresh();
  };

  // Individual Synchronised Supplier Allocation Submit
  const handleQuickAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAllocItem) return;

    if (!selectedSupplierId) {
      const res = db.allocateServiceItemSupplier(booking.id, quickAllocItem.id, null, currentUser);
      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Failed to unallocate supplier.' });
        return;
      }
    } else {
      const sup = masterSuppliers.find(s => s.id === selectedSupplierId);
      if (!sup) return;

      const res = db.allocateServiceItemSupplier(booking.id, quickAllocItem.id, {
        supplierId: sup.id,
        supplierName: sup.name,
        supplierType: quickAllocItem.supplierType || 'GROUND_RESOURCE',
        supplierContact: `${sup.phone || ''} ${sup.email || ''}`.trim(),
        supplierPhone: sup.phone,
        supplierEmail: sup.email,
        supplierConfirmationRef: allocConfirmationRef.trim() || undefined,
        allocationStatus: allocStatus,
        supplierNotes: allocNotes.trim() || undefined
      }, currentUser);

      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Failed to allocate supplier.' });
        return;
      }
    }

    setIsQuickAllocOpen(false);
    setQuickAllocItem(null);
    setFeedbackBanner({ type: 'success', message: 'Individual supplier allocation saved and synchronised.' });
    onRefresh();
  };

  // Quick Price Submit (updates internal net/supplier buy price without overwriting customer selling price)
  const handleQuickPriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPriceItem) return;

    const priceNum = parseFloat(newQuickPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setFeedbackBanner({ type: 'error', message: 'Please enter a valid non-negative Net / Supplier Price.' });
      return;
    }

    const res = db.updateServiceItemSupplierPrice(
      booking.id,
      quickPriceItem.id,
      {
        supplierPrice: priceNum,
        supplierCurrency: quickPriceItem.supplierCurrency || booking.currency || 'USD',
        supplierPriceType: 'Total Service Price',
        changeReason: quickPriceReason.trim() || undefined,
        forceAfterConfirmation: quickForceReconfirm
      },
      currentUser
    );

    if (!res.success) {
      setFeedbackBanner({ type: 'error', message: res.error || 'Failed to update internal net / supplier price.' });
      return;
    }

    // Keep explicit netPrice synchronized with updated supplier cost
    db.updateServiceItem(
      booking.id,
      quickPriceItem.id,
      {
        netPrice: priceNum,
        forceAfterConfirmation: true
      },
      currentUser
    );

    setIsQuickPriceOpen(false);
    setQuickPriceItem(null);
    setFeedbackBanner({ type: 'success', message: 'Internal Net / Supplier Price updated.' });
    onRefresh();
  };

  const activeConsolidatedList = useMemo(
    () => consolidatedAllocations.filter(a => a.status !== 'REMOVED'),
    [consolidatedAllocations]
  );

  return (
    <div id="desk-service-items-section" className="space-y-5">
      {/* Inline Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            feedbackBanner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Internal Financial Reconciliation Summary Strip (Internal Admin/Ops/Finance ONLY) */}
      {isInternal && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Net Cost (Internal)
            </span>
            <div className="text-base font-black font-mono text-slate-900 mt-0.5">
              {formatCurrency(financialTotals.totalNet, booking.currency)}
            </div>
            {financialTotals.missingNetCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700 mt-0.5 block">
                {financialTotals.missingNetCount} item(s) missing Net Price
              </span>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Selling Price (Customer)
            </span>
            <div className="text-base font-black font-mono text-slate-900 mt-0.5">
              {formatCurrency(financialTotals.totalSelling, booking.currency)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Showing {filteredItems.length} of {items.length} Service Item(s)
            </span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Margin Amount
            </span>
            <div
              className={`text-base font-black font-mono mt-0.5 ${
                financialTotals.totalMargin >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {formatCurrency(financialTotals.totalMargin, booking.currency)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Selling Price − Net Price
            </span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Margin Percentage
            </span>
            <div
              className={`text-base font-black font-mono mt-0.5 ${
                (financialTotals.marginPercent ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {financialTotals.marginPercent !== null ? `${financialTotals.marginPercent.toFixed(2)}%` : '—'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              (Margin ÷ Net Cost) × 100
            </span>
          </div>
        </div>
      )}

      {/* Top Controls: Search, Authoritative Category Filter, Combined Filters & Add Item */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Box */}
            <div className="relative min-w-[210px] flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search services, IDs, hotels, hubs, suppliers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#008f77] focus:ring-1 focus:ring-[#008f77]"
              />
            </div>

            {/* Authoritative Category Filter (Resolved from Product Management & Hotel Management) */}
            <select
              aria-label="Filter by Product Category"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#008f77]"
            >
              <option value="ALL">All Categories ({items.length})</option>
              {categoryOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>

            {/* Allocation Status Filter (Internal Only) */}
            {isInternal && (
              <select
                aria-label="Filter by Allocation Status"
                value={allocationFilter}
                onChange={e => setAllocationFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#008f77]"
              >
                <option value="ALL">All Allocations</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="UNALLOCATED">Unallocated Pending</option>
                <option value="CONSOLIDATED">Consolidated Allocations</option>
                <option value="RECONFIRMATION_REQUIRED">Amendment / Reconfirmation</option>
              </select>
            )}

            {/* Supplier Filter (Internal Only) */}
            {isInternal && supplierFilterOptions.length > 0 && (
              <select
                aria-label="Filter by Supplier"
                value={supplierFilter}
                onChange={e => setSupplierFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#008f77]"
              >
                <option value="ALL">All Suppliers</option>
                {supplierFilterOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            {/* Destination Filter */}
            {destinationFilterOptions.length > 1 && (
              <select
                aria-label="Filter by Destination"
                value={destinationFilter}
                onChange={e => setDestinationFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#008f77]"
              >
                <option value="ALL">All Destinations</option>
                {destinationFilterOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {/* Service Date Filter */}
            <input
              type="date"
              aria-label="Filter by Service Date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#008f77]"
            />

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Add Service Item */}
          {canAddItems && (
            <button
              id="btn-add-service-item"
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-[#008f77] hover:bg-[#00705d] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <span>Add Service Item</span>
            </button>
          )}
        </div>

        {/* Multi-Select Consolidated Supplier Allocation Bar (Internal & canAllocate ONLY) */}
        {isInternal && canAllocate && selectedItemIds.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-[#008f77] text-white text-[11px] font-black">
                  {selectedItemIds.length} Selected
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Booking #{booking.bookingReference} • Total Net:{' '}
                  <span className="font-mono">{formatCurrency(selectedSummary.net, booking.currency)}</span> • Selling:{' '}
                  <span className="font-mono">{formatCurrency(selectedSummary.selling, booking.currency)}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedItemsList.map(it => (
                  <span
                    key={it.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-teal-200 text-[11px] font-semibold text-slate-700"
                  >
                    <span className="truncate max-w-[180px]">{it.productName}</span>
                    <button
                      type="button"
                      onClick={() => toggleSelectItem(it.id)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Remove from selection"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedItemIds([])}
                className="px-3 py-2 rounded-xl border border-teal-300 bg-white hover:bg-teal-50 text-teal-900 text-xs font-bold cursor-pointer"
              >
                Clear Selection
              </button>
              <button
                id="btn-create-consolidated-allocation"
                type="button"
                onClick={() => setIsConsolidatedCreateOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Create Consolidated Supplier Allocation</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Consolidated Supplier Allocations Overview Panel (Internal Only) */}
      {isInternal && activeConsolidatedList.length > 0 && (
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#008f77]" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Consolidated Supplier Allocations ({activeConsolidatedList.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">
              Multi-service supplier groups with independent per-item tracking
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeConsolidatedList.map(alloc => {
              const itemCount = alloc.serviceItemIds?.length || alloc.itemAllocations?.length || 1;
              const confirmedCount = (alloc.itemAllocations || []).filter(
                ia => ia.confirmationStatus === 'Supplier Confirmed' || ia.confirmationStatus === 'Confirmed'
              ).length;

              return (
                <div
                  key={alloc.id}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                          {alloc.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            alloc.status === 'CONFIRMED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : alloc.status === 'CANCELLED'
                              ? 'bg-slate-100 text-slate-500 border-slate-200'
                              : alloc.status === 'AMENDMENT_REQUIRED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-teal-50 text-teal-800 border-teal-200'
                          }`}
                        >
                          {alloc.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="font-black text-slate-900 text-xs mt-1 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#008f77]" />
                        <span>{alloc.supplierNameSnapshot}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {itemCount} Service Item{itemCount === 1 ? '' : 's'} • {confirmedCount}/{itemCount} Confirmed •{' '}
                        {alloc.allocationMethod === 'MANUAL' ? 'Manual Split' : 'Proportional Split'}
                        {alloc.confirmationRef ? ` • Ref: ${alloc.confirmationRef}` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewingConsolidatedAllocation(alloc)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#008f77] text-[#008f77] text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View / Manage</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-[11px] font-mono">
                    <div>
                      <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">Net Cost</span>
                      <strong className="text-slate-800">
                        {formatCurrency(alloc.totalNetCost || 0, alloc.currency || booking.currency)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">Commercial</span>
                      <strong className="text-teal-900">
                        {formatCurrency(alloc.consolidatedCommercialPrice || 0, alloc.currency || booking.currency)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">Margin</span>
                      <strong className={(alloc.totalMarginAmount ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {formatCurrency(alloc.totalMarginAmount || 0, alloc.currency || booking.currency)}
                        {alloc.totalMarginPercent !== null && alloc.totalMarginPercent !== undefined
                          ? ` (${alloc.totalMarginPercent.toFixed(1)}%)`
                          : ''}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Authoritative Service Items Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No Service Items Match Filter</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your search keywords, category, supplier, destination, or date filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    {isInternal && canAllocate && (
                      <th className="py-3.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all eligible items on current page"
                          checked={allEligibleOnPageSelected}
                          disabled={eligibleOnCurrentPage.length === 0}
                          onChange={toggleSelectAllOnPage}
                          className="rounded text-[#008f77] focus:ring-[#008f77] cursor-pointer disabled:opacity-40"
                        />
                      </th>
                    )}
                    <th className="py-3.5 px-4">Service &amp; Product</th>
                    <th className="py-3.5 px-4">Schedule &amp; Hub</th>
                    <th className="py-3.5 px-3 text-center">PAX</th>
                    {isInternal && <th className="py-3.5 px-4 text-right">Net Price (Internal)</th>}
                    <th className="py-3.5 px-4 text-right">Selling Price</th>
                    {isInternal && <th className="py-3.5 px-4 text-right">Margin</th>}
                    {isInternal && <th className="py-3.5 px-4">Allocated Supplier</th>}
                    <th className="py-3.5 px-3 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedItems.map(item => {
                    const isAllocated = Boolean(item.supplierId || item.supplierName);
                    const eligibility = isItemEligibleForNewConsolidatedAllocation(item, consolidatedAllocations);
                    const isSelected = selectedItemIds.includes(item.id);
                    const hasContent = Boolean(
                      item.resolvedDescription || item.resolvedNarrative || item.resolvedOverview
                    );
                    const isContentOpen = Boolean(expandedContentIds[item.id]);
                    const linkedConsolidated = item.consolidatedAllocationId
                      ? consolidatedAllocations.find(a => a.id === item.consolidatedAllocationId)
                      : undefined;

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? 'bg-teal-50/40' : ''
                          }`}
                        >
                          {/* Multi-Select Checkbox */}
                          {isInternal && canAllocate && (
                            <td className="py-4 px-3 align-top text-center">
                              <input
                                type="checkbox"
                                aria-label={`Select ${item.productName}`}
                                checked={isSelected}
                                disabled={!eligibility.eligible}
                                title={
                                  eligibility.eligible
                                    ? 'Select for Consolidated Supplier Allocation'
                                    : eligibility.reason
                                }
                                onChange={() => toggleSelectItem(item.id)}
                                className="rounded text-[#008f77] focus:ring-[#008f77] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                              />
                            </td>
                          )}

                          {/* Service, Authoritative Category & Content Indicators */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[9px] uppercase tracking-wide border border-slate-200">
                                  {item.resolvedCategoryLabel}
                                </span>
                                {item.isManualServiceItem && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[9px] border border-amber-200">
                                    Bespoke
                                  </span>
                                )}
                                {linkedConsolidated && (
                                  <button
                                    type="button"
                                    onClick={() => setViewingConsolidatedAllocation(linkedConsolidated)}
                                    className="px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold text-[9px] border border-teal-200 inline-flex items-center gap-0.5 hover:bg-teal-100 cursor-pointer"
                                    title={`Linked to Consolidated Allocation ${linkedConsolidated.id}`}
                                  >
                                    <Link2 className="w-2.5 h-2.5" />
                                    Consolidated
                                  </button>
                                )}
                              </div>
                              <p className="font-bold text-slate-900 leading-snug">{item.productName}</p>
                              <p className="text-[11px] text-slate-400">
                                {[item.destination || item.destinationName, item.hub || item.city].filter(Boolean).join(' • ') || 'Destination Hub'}
                              </p>
                              {hasContent && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedContentIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-[#008f77] hover:underline pt-0.5 cursor-pointer"
                                >
                                  {isContentOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  <span>
                                    {[
                                      item.resolvedDescription ? 'Description' : null,
                                      item.resolvedNarrative ? 'Narrative' : null,
                                      item.resolvedOverview ? 'Overview' : null
                                    ]
                                      .filter(Boolean)
                                      .join(' • ')}
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Schedule */}
                          <td className="py-4 px-4 align-top whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-slate-800 font-bold">
                                <Calendar className="w-3.5 h-3.5 text-[#008f77]" />
                                <span>{item.resolvedServiceDate || item.serviceDate || item.travelDate || 'Date Pending'}</span>
                              </div>
                              {(item.resolvedTicketEntryTime || item.resolvedPickupTime || item.resolvedStartTime || item.serviceTime) && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {item.resolvedTicketEntryTime || item.resolvedPickupTime || item.resolvedStartTime || item.serviceTime}
                                  </span>
                                </div>
                              )}
                              {item.duration && (
                                <span className="text-[10px] text-slate-400 block">{item.duration}</span>
                              )}
                            </div>
                          </td>

                          {/* PAX */}
                          <td className="py-4 px-3 align-top text-center font-mono font-bold text-slate-700">
                            {item.totalPax || (item.adults || 0) + (item.children || 0) || 1}
                          </td>

                          {/* Net Price (Internal Admin/Finance ONLY) */}
                          {isInternal && (
                            <td className="py-4 px-4 align-top text-right whitespace-nowrap font-mono">
                              <div className="space-y-0.5">
                                {item.resolvedHasNetPrice ? (
                                  <>
                                    <span className="font-bold text-slate-800">
                                      {formatCurrency(item.resolvedNetPrice, item.supplierCurrency || item.currency || booking.currency)}
                                    </span>
                                    {typeof item.allocatedCommercialPrice === 'number' && (
                                      <span className="text-[10px] font-bold text-teal-700 block">
                                        Alloc: {formatCurrency(item.allocatedCommercialPrice, item.supplierCurrency || booking.currency)}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[10px] text-amber-700 font-sans font-bold">
                                    Net Missing
                                  </span>
                                )}
                                {canManagePrices && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickPriceItem(item);
                                      setNewQuickPrice(item.resolvedHasNetPrice ? String(item.resolvedNetPrice) : '');
                                      setQuickPriceReason('');
                                      setQuickForceReconfirm(false);
                                      setIsQuickPriceOpen(true);
                                    }}
                                    className="text-[10px] font-sans text-[#008f77] hover:underline font-bold cursor-pointer block ml-auto"
                                  >
                                    {item.resolvedHasNetPrice ? 'Update Net' : 'Set Net Price'}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Authoritative Selling Price */}
                          <td className="py-4 px-4 align-top text-right whitespace-nowrap font-mono">
                            <span className="font-bold text-slate-900">
                              {formatCurrency(item.resolvedSellingPrice, item.currency || booking.currency)}
                            </span>
                            <span className="text-[10px] font-sans text-slate-400 block">Customer Selling</span>
                          </td>

                          {/* Margin Amount & Margin % (Internal Admin/Finance ONLY) */}
                          {isInternal && (
                            <td className="py-4 px-4 align-top text-right whitespace-nowrap font-mono">
                              <div
                                className={`font-bold ${
                                  item.resolvedMarginAmount >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {formatCurrency(item.resolvedMarginAmount, item.currency || booking.currency)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.resolvedMarginPercent !== null
                                  ? `${item.resolvedMarginPercent.toFixed(2)}%`
                                  : '—'}
                              </div>
                            </td>
                          )}

                          {/* Allocated Supplier (Internal Only) */}
                          {isInternal && (
                            <td className="py-4 px-4 align-top">
                              <div className="space-y-1">
                                {isAllocated ? (
                                  <div>
                                    <span className="font-bold text-slate-900 flex items-center gap-1">
                                      <Building2 className="w-3.5 h-3.5 text-[#008f77] shrink-0" />
                                      <span className="truncate max-w-[140px]">{item.supplierName}</span>
                                    </span>
                                    {item.supplierConfirmationRef && (
                                      <span className="text-[10px] font-mono text-slate-500 block">
                                        Ref: {item.supplierConfirmationRef}
                                      </span>
                                    )}
                                    {linkedConsolidated ? (
                                      <button
                                        type="button"
                                        onClick={() => setViewingConsolidatedAllocation(linkedConsolidated)}
                                        className="text-[10px] text-[#008f77] hover:underline font-bold cursor-pointer mt-0.5 block"
                                      >
                                        Manage Consolidated
                                      </button>
                                    ) : (
                                      canAllocate && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setQuickAllocItem(item);
                                            setSelectedSupplierId(item.supplierId || '');
                                            setAllocStatus(resolveCanonicalAllocationStatus(item));
                                            setAllocConfirmationRef(item.supplierConfirmationRef || '');
                                            setAllocNotes(item.supplierNotes || '');
                                            setIsQuickAllocOpen(true);
                                          }}
                                          className="text-[10px] text-[#008f77] hover:underline font-bold cursor-pointer mt-0.5 block"
                                        >
                                          Manage Allocation
                                        </button>
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                      Pending Allocation
                                    </span>
                                    {canAllocate && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setQuickAllocItem(item);
                                          setSelectedSupplierId('');
                                          setAllocStatus('Pending Allocation');
                                          setAllocConfirmationRef('');
                                          setAllocNotes('');
                                          setIsQuickAllocOpen(true);
                                        }}
                                        className="text-[10px] text-[#008f77] hover:underline font-bold cursor-pointer mt-0.5 block"
                                      >
                                        + Assign Individual
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Confirmation Status */}
                          <td className="py-4 px-3 align-top text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                                item.supplierConfirmationStatus === 'Confirmed'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : item.supplierConfirmationStatus === 'Supplier Reconfirmation Required' ||
                                    item.resolvedCanonicalAllocationStatus === 'Amendment Required'
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              {item.supplierConfirmationStatus || 'Pending'}
                            </span>
                          </td>

                          {/* Row Action Buttons */}
                          <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                id={`btn-config-item-${item.id}`}
                                type="button"
                                onClick={() => setConfiguringItem(item)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-teal-700 hover:text-teal-900 cursor-pointer"
                                title="Launch Dedicated Category Configurator"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>

                              <button
                                id={`btn-edit-item-${item.id}`}
                                type="button"
                                onClick={() => setEditingItem(item)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                                title="Edit Service Item, Content, Supplier & Pricing"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const res = db.generateActivityVoucher(booking.id, item.id, currentUser);
                                  if (res.success && res.voucher) {
                                    setSelectedVoucherForPreview(res.voucher);
                                    onRefresh();
                                  } else {
                                    setFeedbackBanner({
                                      type: 'error',
                                      message: res.error || 'Failed to generate activity voucher. Ensure item is confirmed.'
                                    });
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-[#008972] cursor-pointer"
                                title="Generate / View Activity-Level Voucher"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {isInternal && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingItem(item)}
                                  className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                                  title="Delete Service Item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Product Content Row (Description, Narrative, Overview — empty fields omitted) */}
                        {isContentOpen && hasContent && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={isInternal ? 10 : 6} className="px-5 py-3.5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                                {item.resolvedDescription && (
                                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-[#008f77] mb-1">
                                      Service Description
                                    </div>
                                    <div className="text-slate-700 leading-relaxed whitespace-pre-line">
                                      {item.resolvedDescription}
                                    </div>
                                  </div>
                                )}
                                {item.resolvedNarrative && (
                                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-[#008f77] mb-1">
                                      Itinerary Narrative
                                    </div>
                                    <div className="text-slate-700 leading-relaxed whitespace-pre-line">
                                      {item.resolvedNarrative}
                                    </div>
                                  </div>
                                )}
                                {item.resolvedOverview && (
                                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-[#008f77] mb-1">
                                      Operational Overview
                                    </div>
                                    <div className="text-slate-700 leading-relaxed whitespace-pre-line">
                                      {item.resolvedOverview}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="text-slate-500">
                Showing{' '}
                <strong className="text-slate-800">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredItems.length)}
                </strong>{' '}
                of <strong className="text-slate-800">{filteredItems.length}</strong> Service Item(s)
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Items per page"
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>

                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-bold text-slate-700 px-1">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* CONSOLIDATED SUPPLIER ALLOCATION: CREATE MODE */}
      {isConsolidatedCreateOpen && (
        <ConsolidatedSupplierAllocationModal
          isOpen={isConsolidatedCreateOpen}
          mode="CREATE"
          booking={booking}
          selectedItemIds={selectedItemIds}
          currentUser={currentUser}
          onRemoveSelectedItem={(itemId) => {
            setSelectedItemIds(prev => {
              const next = prev.filter(id => id !== itemId);
              if (next.length === 0) setIsConsolidatedCreateOpen(false);
              return next;
            });
          }}
          onClose={() => setIsConsolidatedCreateOpen(false)}
          onSuccess={() => {
            setSelectedItemIds([]);
            setFeedbackBanner({
              type: 'success',
              message: 'Consolidated Supplier Allocation created and linked across selected Service Items.'
            });
            onRefresh();
          }}
        />
      )}

      {/* CONSOLIDATED SUPPLIER ALLOCATION: DETAIL / MANAGE MODE */}
      {viewingConsolidatedAllocation && (
        <ConsolidatedSupplierAllocationModal
          isOpen={Boolean(viewingConsolidatedAllocation)}
          mode="DETAIL"
          booking={booking}
          existingAllocation={viewingConsolidatedAllocation}
          currentUser={currentUser}
          onClose={() => setViewingConsolidatedAllocation(null)}
          onSuccess={() => {
            setFeedbackBanner({
              type: 'success',
              message: 'Consolidated Supplier Allocation updated and synchronised.'
            });
            onRefresh();
          }}
        />
      )}

      {/* 0. DEDICATED CATEGORY CONFIGURATOR ROUTER */}
      {configuringItem && (
        <GlobalConfiguratorRouter
          isOpen={true}
          itemOrProduct={{
            ...configuringItem,
            id: configuringItem.productId || configuringItem.id,
            name: configuringItem.productName,
            product_category: configuringItem.category,
            category: configuringItem.category,
            city: configuringItem.city,
            destinationName: configuringItem.destinationName
          }}
          portalOrigin="ADMIN_CMS"
          initialTravelDate={configuringItem.serviceDate || configuringItem.travelDate}
          initialAdults={configuringItem.adults || configuringItem.totalPax}
          initialChildren={configuringItem.children}
          initialNotes={configuringItem.operationalInstructions || configuringItem.internalNotes}
          onClose={() => setConfiguringItem(null)}
          onSuccess={() => {
            setConfiguringItem(null);
            onRefresh();
          }}
        />
      )}

      {/* 1. COMPREHENSIVE EDIT SERVICE ITEM MODAL */}
      {editingItem && (
        <EditServiceItemModal
          booking={booking}
          item={editingItem}
          currentUser={currentUser}
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          onSuccess={onRefresh}
        />
      )}

      {/* 2. ADD SERVICE ITEM MODAL */}
      {isAddModalOpen && (
        <AddServiceItemModal
          booking={booking}
          currentUser={currentUser}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={onRefresh}
        />
      )}

      {/* 3. VOUCHER DOCUMENT PREVIEW MODAL */}
      {selectedVoucherForPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 my-8">
            <VoucherDocumentView
              voucher={selectedVoucherForPreview}
              booking={booking}
              isOutdated={selectedVoucherForPreview.isOutdated}
              onClose={() => setSelectedVoucherForPreview(null)}
            />
          </div>
        </div>
      )}

      {/* 4. INDIVIDUAL SYNCHRONISED SUPPLIER ALLOCATION MODAL */}
      {isQuickAllocOpen && quickAllocItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[92vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#008f77]" />
                  Synchronised Supplier Allocation
                </h3>
                <p className="text-[11px] text-slate-500">
                  Bound directly to authoritative Service Item <span className="font-mono font-bold">{quickAllocItem.id}</span> • Booking #{booking.bookingReference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAllocOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] text-[#008972] font-black uppercase tracking-wider block">
                    Authoritative Service Specification (Live Synced)
                  </span>
                  <div className="font-black text-slate-900 text-sm mt-0.5">{quickAllocItem.productName}</div>
                  <div className="text-[11px] text-slate-500">
                    {quickAllocItem.resolvedCategoryLabel} • {[quickAllocItem.destination, quickAllocItem.hub].filter(Boolean).join(' • ')}
                  </div>
                </div>
              </div>

              {(quickAllocItem.resolvedDescription || quickAllocItem.resolvedNarrative || quickAllocItem.resolvedOverview) && (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-[11px] text-slate-700 leading-relaxed whitespace-pre-line">
                  {quickAllocItem.resolvedDescription || quickAllocItem.resolvedNarrative || quickAllocItem.resolvedOverview}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Service Date</span>
                  <strong className="text-slate-900">{quickAllocItem.resolvedServiceDate || 'Pending Date'}</strong>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">
                    {quickAllocItem.isTicketedActivity ? 'Ticket Entry Time' : quickAllocItem.isTransportService ? 'Pickup Time' : 'Service Time'}
                  </span>
                  <strong className="text-slate-900">
                    {quickAllocItem.resolvedTicketEntryTime || quickAllocItem.resolvedPickupTime || quickAllocItem.resolvedStartTime || 'Not Set'}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Passengers</span>
                  <strong className="text-slate-900">{quickAllocItem.resolvedPassengerBreakdown}</strong>
                </div>
              </div>
            </div>

            <form onSubmit={handleQuickAllocateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Master Supplier Partner</label>
                  <select
                    value={selectedSupplierId}
                    onChange={e => {
                      setSelectedSupplierId(e.target.value);
                      if (e.target.value && allocStatus === 'Pending Allocation') {
                        setAllocStatus('Supplier Selected');
                      } else if (!e.target.value) {
                        setAllocStatus('Pending Allocation');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#008f77] mt-1"
                  >
                    <option value="">-- Unallocated / Remove Supplier --</option>
                    {masterSuppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} ({sup.categories?.[0] || 'Partner'} • {sup.city || sup.destination || 'Global'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Allocation Status</label>
                  <select
                    value={allocStatus}
                    onChange={e => setAllocStatus(e.target.value as CanonicalAllocationStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#008f77] mt-1"
                  >
                    {CANONICAL_ALLOCATION_STATUSES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Confirmation Reference</label>
                <input
                  type="text"
                  value={allocConfirmationRef}
                  onChange={e => setAllocConfirmationRef(e.target.value)}
                  placeholder="e.g., SUP-CONF-2026-8841"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-[#008972] focus:outline-none focus:border-[#008f77] mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Dispatch / Supplier Notes</label>
                <textarea
                  rows={2}
                  value={allocNotes}
                  onChange={e => setAllocNotes(e.target.value)}
                  placeholder="Special instructions for driver, guide, or supplier reservations desk..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#008f77] mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickAllocOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] text-white text-xs font-bold cursor-pointer"
                >
                  Save Synchronised Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. QUICK INTERNAL NET / SUPPLIER PRICE MODAL */}
      {isQuickPriceOpen && quickPriceItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#008f77]" />
                Update Internal Net / Supplier Cost
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickPriceOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Service</span>
              <span className="font-bold text-slate-900 block">{quickPriceItem.productName}</span>
              <div className="flex items-center justify-between text-slate-600 pt-1">
                <span>Selling Price: <strong>{formatCurrency(quickPriceItem.resolvedSellingPrice, booking.currency)}</strong></span>
                <span>Current Net: <strong>{formatCurrency(quickPriceItem.resolvedNetPrice, booking.currency)}</strong></span>
              </div>
            </div>

            <form onSubmit={handleQuickPriceSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Internal Net / Supplier Cost *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={newQuickPrice}
                  onChange={e => setNewQuickPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#008f77] mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Reason for Net Cost Adjustment *</label>
                <input
                  type="text"
                  required
                  value={quickPriceReason}
                  onChange={e => setQuickPriceReason(e.target.value)}
                  placeholder="e.g. Contract tariff update, negotiated supplier rate..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#008f77] mt-1"
                />
              </div>

              {quickPriceItem.supplierConfirmationStatus === 'Confirmed' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Cost change on confirmed service</span>
                  </div>
                  <p className="text-rose-700 text-[11px]">
                    Updating supplier cost on a confirmed service will trigger reconfirmation tracking.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={quickForceReconfirm}
                      onChange={e => setQuickForceReconfirm(e.target.checked)}
                      className="rounded text-[#008f77] focus:ring-[#008f77]"
                    />
                    <span className="text-[11px] font-bold text-rose-900">
                      I authorize reconfirmation workflow
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickPriceOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickPriceItem.supplierConfirmationStatus === 'Confirmed' && !quickForceReconfirm}
                  className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#00705d] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  Save Net Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-black text-slate-900">Remove Service Item?</h4>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <strong>"{deletingItem.productName}"</strong> from this booking?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Keep Item
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
