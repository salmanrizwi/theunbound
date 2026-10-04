import React, { useState, useMemo } from 'react';
import { Booking, BookingItem, BookingVoucher, User, Supplier } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { formatCurrency } from '../../../services/pricingEngine';
import { hasBookingOperationsPermission } from '../../../services/permissionEngine';
import { 
  Plus, 
  Search, 
  Filter, 
  Building2, 
  Calendar, 
  Clock, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  FileText, 
  Printer, 
  ShieldCheck, 
  Lock,
  Layers,
  Sparkles,
  DollarSign,
  ChevronDown,
  Info,
  Sliders,
  X
} from 'lucide-react';
import { 
  EditServiceItemModal, 
  AddServiceItemModal, 
  ConfirmationOverrideModal 
} from '../ServiceItemActionModals';
import { VoucherDocumentView } from '../VoucherDocumentView';
import { GlobalConfiguratorRouter } from '../../Configurators/GlobalConfiguratorRouter';

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
  const items = booking.items || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [allocationFilter, setAllocationFilter] = useState('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BookingItem | null>(null);
  const [configuringItem, setConfiguringItem] = useState<BookingItem | null>(null);
  const [selectedVoucherForPreview, setSelectedVoucherForPreview] = useState<BookingVoucher | null>(null);
  const [deletingItem, setDeletingItem] = useState<BookingItem | null>(null);
  const [overrideItem, setOverrideItem] = useState<BookingItem | null>(null);

  // Quick Allocate Modal State
  const [isQuickAllocOpen, setIsQuickAllocOpen] = useState(false);
  const [quickAllocItem, setQuickAllocItem] = useState<BookingItem | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [allocNotes, setAllocNotes] = useState('');

  // Quick Price Modal State
  const [isQuickPriceOpen, setIsQuickPriceOpen] = useState(false);
  const [quickPriceItem, setQuickPriceItem] = useState<BookingItem | null>(null);
  const [newQuickPrice, setNewQuickPrice] = useState('');
  const [quickPriceReason, setQuickPriceReason] = useState('');
  const [quickForceReconfirm, setQuickForceReconfirm] = useState(false);

  // Role permissions
  const isInternal = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';
  const canAllocate = hasBookingOperationsPermission(currentUser, 'allocate_supplier');
  const canManagePrices = hasBookingOperationsPermission(currentUser, 'manage_supplier_prices');
  const canAddItems = isInternal;

  // Master Suppliers
  const masterSuppliers = useMemo(() => {
    return db.getSuppliers().filter(s => s.status !== 'ARCHIVED');
  }, [db]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        item.productName.toLowerCase().includes(q) ||
        (item.city && item.city.toLowerCase().includes(q)) ||
        (item.destinationName && item.destinationName.toLowerCase().includes(q)) ||
        (item.supplierName && item.supplierName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      if (allocationFilter === 'ALLOCATED') return Boolean(item.supplierId || item.supplierName);
      if (allocationFilter === 'UNALLOCATED') return !item.supplierId && !item.supplierName;
      if (allocationFilter === 'RECONFIRMATION_REQUIRED') return item.supplierConfirmationStatus === 'Supplier Reconfirmation Required';

      return true;
    });
  }, [items, searchQuery, categoryFilter, allocationFilter]);

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
    onRefresh();
  };

  // Quick Allocate Supplier Submit
  const handleQuickAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAllocItem) return;

    if (!selectedSupplierId) {
      // Unallocate
      const res = db.allocateServiceItemSupplier(booking.id, quickAllocItem.id, null, currentUser);
      if (!res.success) alert(res.error || 'Failed to unallocate');
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
        supplierNotes: allocNotes.trim() || undefined
      }, currentUser);

      if (!res.success) alert(res.error || 'Failed to allocate');
    }

    setIsQuickAllocOpen(false);
    setQuickAllocItem(null);
    onRefresh();
  };

  // Quick Price Submit
  const handleQuickPriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPriceItem) return;

    const priceNum = parseFloat(newQuickPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Please enter a valid non-negative price');
      return;
    }

    const res = db.updateServiceItemSupplierPrice(
      booking.id,
      quickPriceItem.id,
      {
        supplierPrice: priceNum,
        supplierCurrency: quickPriceItem.supplierCurrency || booking.currency || 'USD',
        supplierPriceType: quickPriceItem.supplierPriceType || 'Total Service Price',
        changeReason: quickPriceReason.trim() || undefined,
        forceAfterConfirmation: quickForceReconfirm
      },
      currentUser
    );

    if (!res.success) {
      alert(res.error || 'Failed to update supplier price');
      return;
    }

    setIsQuickPriceOpen(false);
    setQuickPriceItem(null);
    onRefresh();
  };

  return (
    <div id="desk-service-items-section" className="space-y-6">
      {/* Top Controls: Search, Category Filter, Allocation Filter, Add Item */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services, hotels, guides, activities..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#008f77] focus:ring-1 focus:ring-[#008f77]"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#008f77]"
          >
            <option value="ALL">All Categories ({items.length})</option>
            <option value="HOTEL">Hotels & Lodging</option>
            <option value="TRANSFER">Transfers & Transport</option>
            <option value="ACTIVITY">Activities & Excursions</option>
            <option value="TOUR">Tours & Sightseeing</option>
            <option value="PACKAGE">Packages</option>
            <option value="MEAL">Meals & Dining</option>
            <option value="RAIL">Rail & Bullet Trains</option>
            <option value="VISA">Visa & Concierge</option>
            <option value="YACHT">Private Yacht</option>
          </select>

          {/* Allocation Status Filter (Internal Only) */}
          {isInternal && (
            <select
              value={allocationFilter}
              onChange={e => setAllocationFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#008f77]"
            >
              <option value="ALL">All Allocations</option>
              <option value="ALLOCATED">Allocated</option>
              <option value="UNALLOCATED">Unallocated Pending</option>
              <option value="RECONFIRMATION_REQUIRED">Reconfirmation Required</option>
            </select>
          )}
        </div>

        {/* Action Button: Add Service Item */}
        {canAddItems && (
          <button
            id="btn-add-service-item"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-[#008f77] hover:bg-[#00705d] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Service Item</span>
          </button>
        )}
      </div>

      {/* Main Authoritative Service Items Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No Service Items Match Filter</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your search keywords or category filters, or add a new service item to this booking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Service & Product</th>
                  <th className="py-3.5 px-4">Schedule & Hub</th>
                  <th className="py-3.5 px-4 text-center">PAX</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  {isInternal && <th className="py-3.5 px-4">Allocated Supplier</th>}
                  {isInternal && <th className="py-3.5 px-4 text-right">Supplier Buy Cost</th>}
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => {
                  const isAllocated = Boolean(item.supplierId || item.supplierName);
                  const hasPrice = item.supplierPrice !== undefined && item.supplierPrice > 0;
                  const itemMargin = item.totalPrice && item.supplierTotalCost 
                    ? item.totalPrice - item.supplierTotalCost 
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Service & Category */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[9px] uppercase tracking-wide border border-slate-200">
                              {item.category || 'SERVICE'}
                            </span>
                            {item.isManualServiceItem && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[9px] border border-amber-200">
                                Bespoke
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-slate-900 leading-snug">{item.productName}</p>
                          <p className="text-[11px] text-slate-400">{item.city || item.destinationName || 'Destination Hub'}</p>
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-slate-800 font-bold">
                            <Calendar className="w-3.5 h-3.5 text-[#008f77]" />
                            <span>{item.serviceDate || item.travelDate || 'Date Pending'}</span>
                          </div>
                          {item.serviceTime && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                              <Clock className="w-3 h-3" />
                              <span>{item.serviceTime}</span>
                            </div>
                          )}
                          {item.duration && (
                            <span className="text-[10px] text-slate-400 block">{item.duration}</span>
                          )}
                        </div>
                      </td>

                      {/* PAX */}
                      <td className="py-4 px-4 align-top text-center font-mono font-bold text-slate-700">
                        {item.totalPax || (item.adults || 0) + (item.children || 0) || 1}
                      </td>

                      {/* Customer Selling Price */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap font-mono">
                        <span className="font-bold text-slate-900">
                          {formatCurrency(item.totalPrice || 0, item.currency || booking.currency)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">Customer Gross</span>
                      </td>

                      {/* Allocated Supplier (Internal Only) */}
                      {isInternal && (
                        <td className="py-4 px-4 align-top">
                          <div className="space-y-1">
                            {isAllocated ? (
                              <div>
                                <span className="font-bold text-slate-900 block flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5 text-[#008f77] shrink-0" />
                                  <span className="truncate max-w-[150px]">{item.supplierName}</span>
                                </span>
                                {item.supplierConfirmationRef && (
                                  <span className="text-[10px] font-mono text-slate-500 block">
                                    Ref: {item.supplierConfirmationRef}
                                  </span>
                                )}
                                {canAllocate && (
                                  <button
                                    onClick={() => {
                                      setQuickAllocItem(item);
                                      setSelectedSupplierId(item.supplierId || '');
                                      setAllocNotes(item.supplierNotes || '');
                                      setIsQuickAllocOpen(true);
                                    }}
                                    className="text-[10px] text-[#008f77] hover:underline font-bold cursor-pointer mt-0.5 block"
                                  >
                                    Change Supplier
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                  Unallocated
                                </span>
                                {canAllocate && (
                                  <button
                                    onClick={() => {
                                      setQuickAllocItem(item);
                                      setSelectedSupplierId('');
                                      setAllocNotes('');
                                      setIsQuickAllocOpen(true);
                                    }}
                                    className="text-[10px] text-[#008f77] hover:underline font-bold cursor-pointer mt-0.5 block"
                                  >
                                    + Assign Supplier
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Supplier Commercial Buy Cost (Internal Only) */}
                      {isInternal && (
                        <td className="py-4 px-4 align-top text-right whitespace-nowrap font-mono">
                          <div className="space-y-0.5">
                            {hasPrice ? (
                              <>
                                <span className="font-bold text-slate-800">
                                  {formatCurrency(item.supplierTotalCost || item.supplierPrice || 0, item.supplierCurrency || booking.currency)}
                                </span>
                                {itemMargin !== null && (
                                  <span className={`text-[10px] font-bold block ${itemMargin >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                    Margin: {formatCurrency(itemMargin, booking.currency)}
                                  </span>
                                )}
                                {item.supplierPriceVersion && (
                                  <span className="text-[9px] text-slate-400 block">v{item.supplierPriceVersion}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Price Pending</span>
                            )}
                            {canManagePrices && (
                              <button
                                onClick={() => {
                                  setQuickPriceItem(item);
                                  setNewQuickPrice(item.supplierPrice !== undefined ? String(item.supplierPrice) : '');
                                  setQuickPriceReason('');
                                  setQuickForceReconfirm(false);
                                  setIsQuickPriceOpen(true);
                                }}
                                className="text-[10px] text-[#008f77] hover:underline font-bold cursor-pointer block text-right"
                              >
                                {hasPrice ? 'Update Price' : '+ Add Price'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-4 px-4 align-top text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${
                          item.supplierConfirmationStatus === 'Confirmed' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : item.supplierConfirmationStatus === 'Supplier Reconfirmation Required'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          {item.supplierConfirmationStatus || 'Pending'}
                        </span>
                      </td>

                      {/* Row Action Buttons */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Dedicated Configurator Launcher */}
                          <button
                            id={`btn-config-item-${item.id}`}
                            onClick={() => setConfiguringItem(item)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-teal-700 hover:text-teal-900 cursor-pointer"
                            title="Launch Dedicated Category Configurator"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Comprehensive Edit Modal Trigger */}
                          <button
                            id={`btn-edit-item-${item.id}`}
                            onClick={() => setEditingItem(item)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                            title="Edit Service Item, Supplier & Commercial Pricing"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Voucher View / Download */}
                          <button
                            onClick={() => {
                              const res = db.generateActivityVoucher(booking.id, item.id, currentUser);
                              if (res.success && res.voucher) {
                                setSelectedVoucherForPreview(res.voucher);
                                onRefresh();
                              } else {
                                alert(res.error || 'Failed to generate activity voucher. Ensure item is confirmed.');
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-[#008972] cursor-pointer"
                            title="Generate / View Activity-Level Voucher"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Item (Internal only) */}
                          {isInternal && (
                            <button
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

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
          onRefresh={onRefresh}
        />
      )}

      {/* 2. ADD SERVICE ITEM MODAL */}
      {isAddModalOpen && (
        <AddServiceItemModal
          booking={booking}
          currentUser={currentUser}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onRefresh={onRefresh}
        />
      )}

      {/* 3. VOUCHER DOCUMENT PREVIEW MODAL */}
      {selectedVoucherForPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00C6A6]" />
                Activity Service Voucher • {selectedVoucherForPreview.serviceName}
              </h3>
              <button
                onClick={() => setSelectedVoucherForPreview(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <VoucherDocumentView
              voucher={selectedVoucherForPreview}
              onClose={() => setSelectedVoucherForPreview(null)}
            />
          </div>
        </div>
      )}

      {/* 4. QUICK ALLOCATE SUPPLIER MODAL */}
      {isQuickAllocOpen && quickAllocItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#008f77]" />
                Allocate Supplier Partner
              </h3>
              <button
                onClick={() => setIsQuickAllocOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Target Service</span>
              <span className="font-bold text-slate-900">{quickAllocItem.productName}</span>
            </div>

            <form onSubmit={handleQuickAllocateSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Master Supplier Partner</label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#008f77] mt-1"
                >
                  <option value="">-- Unallocated / Remove Supplier --</option>
                  {masterSuppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.category || 'General'} • {sup.city || 'Japan'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Dispatch / Operational Notes</label>
                <textarea
                  rows={2}
                  value={allocNotes}
                  onChange={e => setAllocNotes(e.target.value)}
                  placeholder="Special instructions for driver, guide, or desk..."
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
                  Save Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. QUICK SUPPLIER PRICING MODAL */}
      {isQuickPriceOpen && quickPriceItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#008f77]" />
                Update Supplier Commercial Price
              </h3>
              <button
                onClick={() => setIsQuickPriceOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Service</span>
              <span className="font-bold text-slate-900">{quickPriceItem.productName}</span>
              <div className="flex items-center justify-between mt-1 text-slate-600">
                <span>Customer Price: <strong>{formatCurrency(quickPriceItem.totalPrice || 0, booking.currency)}</strong></span>
                <span>Current Cost: <strong>{formatCurrency(quickPriceItem.supplierPrice || 0, booking.currency)}</strong></span>
              </div>
            </div>

            <form onSubmit={handleQuickPriceSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Authoritative Supplier Price *</label>
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
                <label className="text-[10px] font-bold uppercase text-slate-500">Reason for Price Change *</label>
                <input
                  type="text"
                  required
                  value={quickPriceReason}
                  onChange={e => setQuickPriceReason(e.target.value)}
                  placeholder="e.g. Contract tariff update, season surcharge..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-[#008f77] mt-1"
                />
              </div>

              {quickPriceItem.supplierConfirmationStatus === 'Confirmed' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Price change on confirmed service</span>
                  </div>
                  <p className="text-rose-700 text-[11px]">
                    Updating price on a confirmed service will reset status to "Supplier Reconfirmation Required".
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
                  Save Price
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
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Keep Item
              </button>
              <button
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
