import React, { useState, useMemo, useEffect } from 'react';
import { 
  Booking, 
  BookingItem, 
  User, 
  CurrencyCode, 
  SupplierPriceType,
  Supplier
} from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { hasBookingOperationsPermission } from '../../services/permissionEngine';
import { 
  X, 
  Building2, 
  Calendar, 
  Clock, 
  MapPin, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Car, 
  Compass, 
  Sparkles, 
  Plane, 
  Users, 
  FileCheck, 
  Ship, 
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
  AlertCircle,
  History,
  Info,
  Trash2,
  Tag,
  Lock,
  Check
} from 'lucide-react';

const SERVICE_CATEGORIES = [
  { id: 'Hotel accommodation', label: 'Hotel Accommodation' },
  { id: 'Private transfer', label: 'Private Transfer' },
  { id: 'Guided tour', label: 'Guided Tour' },
  { id: 'Activity/experience', label: 'Activity / Experience' },
  { id: 'Rail ticket', label: 'Rail / Train Service' },
  { id: 'Guide service', label: 'Licensed Guide' },
  { id: 'Visa assistance', label: 'Visa Service' },
  { id: 'Private Yacht charter', label: 'Private Yacht Charter' },
  { id: 'Other approved travel service', label: 'Other Travel Service' }
];

// =========================================================================
// 1. ADD SERVICE ITEM MODAL
// =========================================================================
interface AddServiceItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  currentUser: User | null;
  onSuccess: (newItem: BookingItem) => void;
}

export const AddServiceItemModal: React.FC<AddServiceItemModalProps> = ({
  isOpen,
  onClose,
  booking,
  currentUser,
  onSuccess
}) => {
  const db = AppDatabase.getInstance();
  const [sourceMode, setSourceMode] = useState<'MASTER_INVENTORY' | 'MANUAL_ITEM'>('MANUAL_ITEM');
  const [category, setCategory] = useState('Private transfer');
  const [productName, setProductName] = useState('');
  const [productId, setProductId] = useState('');
  const [destination, setDestination] = useState(booking.destination || 'Bali');
  const [hub, setHub] = useState('Seminyak');
  const [serviceDate, setServiceDate] = useState(booking.travelStartDate || '');
  const [serviceTime, setServiceTime] = useState('09:00');
  const [serviceEndDate, setServiceEndDate] = useState('');
  const [duration, setDuration] = useState('');
  const [totalPax, setTotalPax] = useState<number>(booking.customer?.totalPax || 2);
  const [adults, setAdults] = useState<number>(booking.customer?.totalAdults || 2);
  const [children, setChildren] = useState<number>(booking.customer?.totalChildren || 0);
  const [unitSellingPrice, setUnitSellingPrice] = useState<number>(50);
  const [currency, setCurrency] = useState<CurrencyCode>(booking.currency || 'USD');
  const [operationalInstructions, setOperationalInstructions] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [customerFacingNotes, setCustomerFacingNotes] = useState('');

  // Initial Supplier Allocation (Optional)
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPrice, setSupplierPrice] = useState<string>('');
  const [supplierPriceType, setSupplierPriceType] = useState<SupplierPriceType>('Total Service Price');
  const [isManualSupplier, setIsManualSupplier] = useState(false);
  const [manualExceptionReason, setManualExceptionReason] = useState('');

  const activeSuppliers = useMemo(() => {
    return (db.getSuppliers ? db.getSuppliers() : []).filter((s: Supplier) => s.status === 'ACTIVE');
  }, [db]);

  // Master product search
  const [searchQuery, setSearchQuery] = useState('');
  const masterProducts = useMemo(() => {
    const list = db.getProducts ? db.getProducts() : [];
    if (!searchQuery.trim()) return list.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return list.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category?.toLowerCase().includes(q) ||
      (p as any).destination?.toLowerCase().includes(q) ||
      (p as any).destinationName?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [db, searchQuery]);

  const handleSelectMasterProduct = (p: any) => {
    setProductId(p.id);
    setProductName(p.name);
    if (p.category) setCategory(p.category);
    if (p.destination) setDestination(p.destination);
    if (p.price) setUnitSellingPrice(p.price);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      alert('Service / Product name is required.');
      return;
    }

    const res = db.addServiceItemToBooking(booking.id, {
      productName: productName.trim(),
      productId: productId || `prod-${Date.now()}`,
      category,
      isManualServiceItem: sourceMode === 'MANUAL_ITEM',
      destination,
      hub,
      serviceDate: serviceDate || booking.travelStartDate,
      serviceTime,
      serviceEndDate: serviceEndDate || undefined,
      duration: duration || undefined,
      totalPax,
      adults,
      children,
      unitSellingPrice,
      totalPrice: unitSellingPrice * totalPax,
      currency,
      operationalInstructions,
      internalNotes,
      customerFacingNotes,
      supplierName: supplierName.trim() || undefined,
      supplierPrice: supplierPrice ? parseFloat(supplierPrice) : undefined,
      supplierPriceType
    }, currentUser);

    if (res.success && res.item) {
      onSuccess(res.item);
      onClose();
    } else {
      alert(res.error || 'Failed to add service item.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#008972]" />
              Add Operational Service Item
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Append a new ground service to booking {booking.bookingReference}.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Mode Toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSourceMode('MANUAL_ITEM')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sourceMode === 'MANUAL_ITEM' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            Manual Service Item (Custom Ground Arrangement)
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('MASTER_INVENTORY')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sourceMode === 'MASTER_INVENTORY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            Master Catalog Product
          </button>
        </div>

        {/* Master Product Selection */}
        {sourceMode === 'MASTER_INVENTORY' && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search master catalog products, excursions, transfers..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs"
              />
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
              {masterProducts.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectMasterProduct(p)}
                  className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer hover:bg-teal-50 transition-colors ${
                    productId === p.id ? 'bg-teal-50 font-bold text-[#008972]' : 'text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.category} • {p.destination}</div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-600">
                    {formatCurrency(p.price || 0, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Service Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 mt-1"
              >
                {SERVICE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Service / Product Name *</label>
              <input
                type="text"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="e.g. Luxury Catamaran Sunset Cruise"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium mt-1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Service Date</label>
              <input
                type="date"
                value={serviceDate}
                onChange={e => setServiceDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Service Time</label>
              <input
                type="time"
                value={serviceTime}
                onChange={e => setServiceTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Hub / City</label>
              <input
                type="text"
                value={hub}
                onChange={e => setHub(e.target.value)}
                placeholder="e.g. Ubud"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1"
              />
            </div>
          </div>

          {/* Pricing & Commercial Split */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-700">Customer Selling Price</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-[10px] text-slate-400">Unit Price ({currency})</span>
                  <input
                    type="number"
                    min={0}
                    value={unitSellingPrice}
                    onChange={e => setUnitSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">PAX</span>
                  <input
                    type="number"
                    min={1}
                    value={totalPax}
                    onChange={e => setTotalPax(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-center"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-teal-50/50 rounded-2xl border border-teal-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-teal-700" />
                  Initial Supplier Allocation (Directory Controlled)
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isManualSupplier}
                    onChange={e => {
                      setIsManualSupplier(e.target.checked);
                      if (e.target.checked) setSelectedSupplierId('');
                    }}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  Manual Exception
                </label>
              </div>

              {!isManualSupplier ? (
                <div>
                  <select
                    value={selectedSupplierId}
                    onChange={e => {
                      const supId = e.target.value;
                      setSelectedSupplierId(supId);
                      const found = activeSuppliers.find((s: Supplier) => s.id === supId);
                      setSupplierName(found ? found.name : '');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-teal-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- Select Master Supplier Partner (Optional) --</option>
                    {activeSuppliers.map((s: Supplier) => (
                      <option key={s.id} value={s.id}>
                        [{s.supplierCode}] {s.name} ({s.destination} - {s.categories?.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Temporary Unlisted Supplier Exception
                  </div>
                  <input
                    type="text"
                    required={isManualSupplier}
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="Enter manual supplier name..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs"
                  />
                  <input
                    type="text"
                    required={isManualSupplier}
                    value={manualExceptionReason}
                    onChange={e => setManualExceptionReason(e.target.value)}
                    placeholder="Mandatory exception justification reason..."
                    className="w-full px-2 py-1 rounded-lg bg-white border border-amber-200 text-[11px]"
                  />
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-500 font-semibold">Contracted / Quoted Supplier Nett Price</span>
                <input
                  type="number"
                  min={0}
                  value={supplierPrice}
                  onChange={e => setSupplierPrice(e.target.value)}
                  placeholder="e.g. 70"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#008972] mt-0.5"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">Operational Instructions</label>
            <input
              type="text"
              value={operationalInstructions}
              onChange={e => setOperationalInstructions(e.target.value)}
              placeholder="e.g. Private dock slip #4 at Benoa Harbor. Briefing 15 mins prior."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] hover:bg-[#00705d] text-white shadow-xs transition-all cursor-pointer"
            >
              Add Service Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 2. EDIT SERVICE ITEM MODAL
// =========================================================================
interface EditServiceItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  item: BookingItem;
  currentUser: User | null;
  onSuccess: () => void;
}

export const EditServiceItemModal: React.FC<EditServiceItemModalProps> = ({
  isOpen,
  onClose,
  booking,
  item,
  currentUser,
  onSuccess
}) => {
  const db = AppDatabase.getInstance();

  // Navigation tab within the edit modal
  const [activeSubTab, setActiveSubTab] = useState<'OPERATIONS' | 'SUPPLIER' | 'PRICING'>('OPERATIONS');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Master Suppliers Directory
  const masterSuppliers = useMemo(() => {
    return db.getSuppliers().filter(s => s.status !== 'ARCHIVED');
  }, [db]);

  // Permissions
  const canAllocate = useMemo(() => {
    return hasBookingOperationsPermission(currentUser, 'allocate_supplier') || 
      currentUser?.role === 'ADMIN' || 
      currentUser?.role === 'MASTER_ADMIN';
  }, [currentUser]);

  const canManagePricing = useMemo(() => {
    return hasBookingOperationsPermission(currentUser, 'manage_supplier_prices') || 
      currentUser?.role === 'ADMIN' || 
      currentUser?.role === 'MASTER_ADMIN';
  }, [currentUser]);

  // Operational Fields
  const [productName, setProductName] = useState(item.productName || '');
  const [category, setCategory] = useState(item.category || 'Private transfer');
  const [destination, setDestination] = useState(item.destination || booking.destination || 'Bali');
  const [hub, setHub] = useState(item.hub || '');
  const [serviceDate, setServiceDate] = useState(item.serviceDate || item.travelDate || '');
  const [serviceTime, setServiceTime] = useState(item.serviceTime || '09:00');
  const [serviceEndDate, setServiceEndDate] = useState(item.serviceEndDate || '');
  const [duration, setDuration] = useState(item.duration || '');
  const [totalPax, setTotalPax] = useState<number>(item.totalPax || 1);
  const [operationalInstructions, setOperationalInstructions] = useState(item.operationalInstructions || '');
  const [internalNotes, setInternalNotes] = useState(item.internalNotes || '');
  const [internalOpsNotes, setInternalOpsNotes] = useState(item.internalOpsNotes || '');
  const [customerFacingNotes, setCustomerFacingNotes] = useState(item.customerFacingNotes || '');

  // Allocated Supplier Fields
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(item.supplierId || '');
  const [supplierName, setSupplierName] = useState(item.supplierName || '');
  const [supplierType, setAllocSupplierType] = useState<string>(item.supplierType || 'GROUND_RESOURCE');
  const [supplierPhone, setSupplierPhone] = useState(item.supplierPhone || '');
  const [supplierEmail, setSupplierEmail] = useState(item.supplierEmail || '');
  const [supplierConfirmationRef, setSupplierConfirmationRef] = useState(item.supplierConfirmationRef || '');
  const [paymentCutoffDate, setPaymentCutoffDate] = useState(item.paymentCutoffDate || '');
  const [supplierNotes, setSupplierNotes] = useState(item.supplierNotes || '');
  const [isManualSupplierException, setIsManualSupplierException] = useState(false);
  const [manualSupplierReason, setManualSupplierReason] = useState('');

  // Commercial Pricing Fields
  const [supplierPrice, setSupplierPrice] = useState<string>(
    item.supplierPrice !== undefined && item.supplierPrice !== null ? String(item.supplierPrice) : ''
  );
  const [supplierCurrency, setSupplierCurrency] = useState<CurrencyCode>(
    item.supplierCurrency || (booking.currency as CurrencyCode) || 'USD'
  );
  const [supplierPriceType, setSupplierPriceType] = useState<SupplierPriceType>(
    item.supplierPriceType || 'Total Service Price'
  );
  const [supplierAdultPrice, setSupplierAdultPrice] = useState<string>(
    item.supplierAdultPrice !== undefined ? String(item.supplierAdultPrice) : ''
  );
  const [supplierChildPrice, setSupplierChildPrice] = useState<string>(
    item.supplierChildPrice !== undefined ? String(item.supplierChildPrice) : ''
  );
  const [supplierQuantity, setSupplierQuantity] = useState<number>(
    item.supplierQuantity || item.totalPax || 1
  );
  const [supplierTaxAmount, setSupplierTaxAmount] = useState<string>(
    item.supplierTaxAmount !== undefined ? String(item.supplierTaxAmount) : '0'
  );
  const [supplierAdditionalFees, setSupplierAdditionalFees] = useState<string>(
    item.supplierAdditionalFees !== undefined ? String(item.supplierAdditionalFees) : '0'
  );
  const [supplierDiscount, setSupplierDiscount] = useState<string>(
    item.supplierDiscount !== undefined ? String(item.supplierDiscount) : '0'
  );
  const [supplierPaymentCutoffDate, setSupplierPaymentCutoffDate] = useState(
    item.supplierPaymentCutoffDate || item.paymentCutoffDate || ''
  );
  const [supplierCancellationDeadline, setSupplierCancellationDeadline] = useState(
    item.supplierCancellationDeadline || ''
  );
  const [supplierPricingNotes, setSupplierPricingNotes] = useState(
    item.supplierPricingNotes || ''
  );
  const [supplierPriceChangeReason, setSupplierPriceChangeReason] = useState('');
  const [showPriceHistory, setShowPriceHistory] = useState(false);

  // Reconfirmation Warning Acknowledgement
  const isCurrentlyConfirmed = item.supplierConfirmationStatus === 'Confirmed';
  const [authorizeReconfirmation, setAuthorizeReconfirmation] = useState(false);

  // Sync state whenever modal opens or item changes
  useEffect(() => {
    if (!isOpen || !item) return;

    setProductName(item.productName || '');
    setCategory(item.category || 'Private transfer');
    setDestination(item.destination || booking.destination || 'Bali');
    setHub(item.hub || '');
    setServiceDate(item.serviceDate || item.travelDate || '');
    setServiceTime(item.serviceTime || '09:00');
    setServiceEndDate(item.serviceEndDate || '');
    setDuration(item.duration || '');
    setTotalPax(item.totalPax || 1);
    setOperationalInstructions(item.operationalInstructions || '');
    setInternalNotes(item.internalNotes || '');
    setInternalOpsNotes(item.internalOpsNotes || '');
    setCustomerFacingNotes(item.customerFacingNotes || '');

    // Match supplier against master directory
    const match = masterSuppliers.find(
      s => s.id === item.supplierId || (item.supplierName && s.name.toLowerCase() === item.supplierName.toLowerCase())
    );
    if (match) {
      setSelectedSupplierId(match.id);
      setSupplierName(match.name);
      setIsManualSupplierException(false);
      setManualSupplierReason('');
    } else if (item.supplierName) {
      setSelectedSupplierId('');
      setSupplierName(item.supplierName);
      setIsManualSupplierException(true);
      setManualSupplierReason('Operational partner allocation');
    } else {
      setSelectedSupplierId('');
      setSupplierName('');
      setIsManualSupplierException(false);
      setManualSupplierReason('');
    }

    setAllocSupplierType(item.supplierType || 'GROUND_RESOURCE');
    setSupplierPhone(item.supplierPhone || '');
    setSupplierEmail(item.supplierEmail || '');
    setSupplierConfirmationRef(item.supplierConfirmationRef || '');
    setPaymentCutoffDate(item.paymentCutoffDate || '');
    setSupplierNotes(item.supplierNotes || '');

    setSupplierPrice(
      item.supplierPrice !== undefined && item.supplierPrice !== null ? String(item.supplierPrice) : ''
    );
    setSupplierCurrency(item.supplierCurrency || (booking.currency as CurrencyCode) || 'USD');
    setSupplierPriceType(item.supplierPriceType || 'Total Service Price');
    setSupplierAdultPrice(item.supplierAdultPrice !== undefined ? String(item.supplierAdultPrice) : '');
    setSupplierChildPrice(item.supplierChildPrice !== undefined ? String(item.supplierChildPrice) : '');
    setSupplierQuantity(item.supplierQuantity || item.totalPax || 1);
    setSupplierTaxAmount(item.supplierTaxAmount !== undefined ? String(item.supplierTaxAmount) : '0');
    setSupplierAdditionalFees(item.supplierAdditionalFees !== undefined ? String(item.supplierAdditionalFees) : '0');
    setSupplierDiscount(item.supplierDiscount !== undefined ? String(item.supplierDiscount) : '0');
    setSupplierPaymentCutoffDate(item.supplierPaymentCutoffDate || item.paymentCutoffDate || '');
    setSupplierCancellationDeadline(item.supplierCancellationDeadline || '');
    setSupplierPricingNotes(item.supplierPricingNotes || '');
    setSupplierPriceChangeReason('');
    setAuthorizeReconfirmation(false);
    setErrorMessage(null);
    setIsSaving(false);
  }, [isOpen, item, booking, masterSuppliers]);

  // Master supplier selector handler
  const handleSelectMasterSupplier = (supId: string) => {
    setSelectedSupplierId(supId);
    if (!supId) {
      setSupplierName('');
      return;
    }
    const sup = masterSuppliers.find(s => s.id === supId);
    if (!sup) return;

    setSupplierName(sup.name);
    setSupplierPhone(sup.phone || sup.emergencyPhone || '');
    setSupplierEmail(sup.email || '');

    const cat = sup.categories?.[0] || '';
    if (cat.includes('Hotel')) setAllocSupplierType('HOTEL');
    else if (cat.includes('Transfer') || cat.includes('Rail')) setAllocSupplierType('TRANSPORT');
    else if (cat.includes('Guide')) setAllocSupplierType('GUIDE');
    else if (cat.includes('Activity') || cat.includes('Yacht')) setAllocSupplierType('ACTIVITY');
    else setAllocSupplierType('GROUND_RESOURCE');

    setIsManualSupplierException(false);
    setManualSupplierReason('');
  };

  // Unallocate supplier handler
  const handleUnallocateSupplier = () => {
    setSelectedSupplierId('');
    setSupplierName('');
    setSupplierPhone('');
    setSupplierEmail('');
    setSupplierConfirmationRef('');
    setPaymentCutoffDate('');
    setSupplierNotes('');
    setIsManualSupplierException(false);
    setManualSupplierReason('');
  };

  // Dynamic live total calculation for supplier cost
  const liveSupplierCost = useMemo(() => {
    const unitRate = parseFloat(supplierPrice) || 0;
    const qty = supplierQuantity || 1;
    const tax = parseFloat(supplierTaxAmount) || 0;
    const fees = parseFloat(supplierAdditionalFees) || 0;
    const discount = parseFloat(supplierDiscount) || 0;
    return Math.max(0, (unitRate * qty) + tax + fees - discount);
  }, [supplierPrice, supplierQuantity, supplierTaxAmount, supplierAdditionalFees, supplierDiscount]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!productName.trim()) {
      setErrorMessage('Service item name is required.');
      setActiveSubTab('OPERATIONS');
      return;
    }

    if (isManualSupplierException && !manualSupplierReason.trim()) {
      setErrorMessage('An approved exception justification reason is required for manual supplier entry.');
      setActiveSubTab('SUPPLIER');
      return;
    }

    // Commercial price validation
    let parsedPrice: number | undefined = undefined;
    if (supplierPrice.trim() !== '') {
      parsedPrice = parseFloat(supplierPrice);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setErrorMessage('Supplier Commercial Price must be a valid non-negative number.');
        setActiveSubTab('PRICING');
        return;
      }
    }

    // Check if supplier or price is materially changed on a confirmed item
    const isSupplierAltered = (item.supplierName || '') !== supplierName.trim();
    const isPriceAltered = parsedPrice !== undefined && item.supplierPrice !== parsedPrice;

    if (isCurrentlyConfirmed && (isSupplierAltered || isPriceAltered) && !authorizeReconfirmation) {
      setErrorMessage(
        'This service item is currently CONFIRMED. Modifying the allocated supplier or commercial rate requires checking the reconfirmation authorization box below.'
      );
      return;
    }

    setIsSaving(true);

    try {
      const isUnallocating = !supplierName.trim() && !selectedSupplierId;
      const effectiveSupplierId = isUnallocating 
        ? undefined 
        : (selectedSupplierId || item.supplierId || `supp-${Date.now()}`);

      const notePrefix = isManualSupplierException && manualSupplierReason.trim()
        ? `[APPROVED MANUAL EXCEPTION: ${manualSupplierReason.trim()}] `
        : '';

      const updates: Partial<BookingItem> & { changeReason?: string; forceAfterConfirmation?: boolean } = {
        // Operations details
        productName: productName.trim(),
        category,
        destination: destination.trim(),
        hub: hub.trim(),
        serviceDate,
        travelDate: serviceDate,
        serviceTime: serviceTime.trim(),
        serviceEndDate: serviceEndDate || undefined,
        duration: duration.trim(),
        totalPax: Number(totalPax) || 1,
        operationalInstructions: operationalInstructions.trim(),
        internalNotes: internalNotes.trim(),
        internalOpsNotes: internalOpsNotes.trim(),
        customerFacingNotes: customerFacingNotes.trim(),

        // Allocated Supplier
        supplierId: effectiveSupplierId,
        supplierName: isUnallocating ? undefined : supplierName.trim(),
        supplierNameSnapshot: isUnallocating ? undefined : supplierName.trim(),
        supplierType: isUnallocating ? undefined : (supplierType as any),
        supplierContact: isUnallocating 
          ? undefined 
          : `${supplierPhone.trim()} ${supplierEmail.trim() ? '/ ' + supplierEmail.trim() : ''}`.trim() || undefined,
        supplierPhone: isUnallocating ? undefined : supplierPhone.trim(),
        supplierEmail: isUnallocating ? undefined : supplierEmail.trim(),
        supplierConfirmationRef: isUnallocating ? undefined : supplierConfirmationRef.trim(),
        paymentCutoffDate: isUnallocating ? undefined : (paymentCutoffDate || undefined),
        supplierNotes: isUnallocating ? undefined : (notePrefix + (supplierNotes.trim() || '')).trim() || undefined,

        // Supplier Commercial Pricing
        supplierPrice: parsedPrice,
        supplierCurrency: supplierCurrency,
        supplierPriceType: supplierPriceType,
        supplierAdultPrice: supplierAdultPrice ? parseFloat(supplierAdultPrice) : undefined,
        supplierChildPrice: supplierChildPrice ? parseFloat(supplierChildPrice) : undefined,
        supplierQuantity: supplierQuantity || totalPax || 1,
        supplierTaxAmount: parseFloat(supplierTaxAmount) || 0,
        supplierAdditionalFees: parseFloat(supplierAdditionalFees) || 0,
        supplierDiscount: parseFloat(supplierDiscount) || 0,
        supplierTotalCost: Math.round(liveSupplierCost * 100) / 100,
        supplierPaymentCutoffDate: supplierPaymentCutoffDate || undefined,
        supplierCancellationDeadline: supplierCancellationDeadline || undefined,
        supplierPricingNotes: supplierPricingNotes.trim() || undefined,
        supplierPriceChangeReason: supplierPriceChangeReason.trim() || undefined,
        changeReason: supplierPriceChangeReason.trim() || undefined,
        forceAfterConfirmation: authorizeReconfirmation
      };

      const res = db.updateServiceItem(booking.id, item.id, updates, currentUser);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update service item in Firestore.');
        setIsSaving(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while saving.');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#008972]" />
                Edit Service Item: {item.productName}
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                {item.id}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                item.supplierConfirmationStatus === 'Confirmed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : item.supplierConfirmationStatus === 'Supplier Reconfirmation Required'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {item.supplierConfirmationStatus || 'Not Confirmed'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Booking Ref: <strong className="text-slate-700">{booking.bookingReference}</strong> • Category: <strong className="text-slate-700">{item.category}</strong>
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="font-semibold">{errorMessage}</div>
          </div>
        )}

        {/* Confirmed Item Invalidation Warning */}
        {isCurrentlyConfirmed && (
          <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-amber-950 text-xs space-y-2">
            <div className="flex items-center gap-2 font-black text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Confirmation Protection Warning
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              This service item is marked as <strong>CONFIRMED</strong> with supplier <strong>{item.supplierName || 'current partner'}</strong>. Modifying the allocated supplier or altering the commercial price will invalidate this status, trigger a <em>Supplier Reconfirmation Required</em> state, and mark existing vouchers for regeneration.
            </p>
            <label className="flex items-center gap-2 pt-1 font-bold text-slate-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={authorizeReconfirmation}
                onChange={e => setAuthorizeReconfirmation(e.target.checked)}
                className="rounded text-[#008972] focus:ring-[#008972]"
              />
              <span className="text-[11px] text-slate-800">
                I authorize supplier reallocation / commercial price revision and trigger the reconfirmation workflow.
              </span>
            </label>
          </div>
        )}

        {/* Sub-tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('OPERATIONS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'OPERATIONS'
                ? 'bg-[#008972] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            1. Service Details
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('SUPPLIER')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'SUPPLIER'
                ? 'bg-[#008972] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            2. Allocated Supplier
            {supplierName ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('PRICING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'PRICING'
                ? 'bg-[#008972] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            3. Supplier Commercial Price
            {supplierPrice ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* TAB 1: OPERATIONS */}
          {activeSubTab === 'OPERATIONS' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Service Name *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 mt-1 focus:outline-none focus:border-[#008972]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 mt-1 focus:outline-none focus:border-[#008972]"
                  >
                    {SERVICE_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Destination</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Hub / Area</label>
                  <input
                    type="text"
                    value={hub}
                    onChange={e => setHub(e.target.value)}
                    placeholder="e.g. Ubud, Kyoto, Tokyo"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Service Date</label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={e => setServiceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Service Time</label>
                  <input
                    type="time"
                    value={serviceTime}
                    onChange={e => setServiceTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Service End Date</label>
                  <input
                    type="date"
                    value={serviceEndDate}
                    onChange={e => setServiceEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Total PAX</label>
                  <input
                    type="number"
                    min={1}
                    value={totalPax}
                    onChange={e => setTotalPax(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold mt-1 text-center focus:outline-none focus:border-[#008972]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Operational Instructions</label>
                <textarea
                  rows={2}
                  value={operationalInstructions}
                  onChange={e => setOperationalInstructions(e.target.value)}
                  placeholder="Meeting point directions, lead guide name, driver dispatch guidance..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Customer-Facing Notes</label>
                  <input
                    type="text"
                    value={customerFacingNotes}
                    onChange={e => setCustomerFacingNotes(e.target.value)}
                    placeholder="Voucher notes for the guest..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Internal Operations Notes</label>
                  <input
                    type="text"
                    value={internalOpsNotes || internalNotes}
                    onChange={e => {
                      setInternalOpsNotes(e.target.value);
                      setInternalNotes(e.target.value);
                    }}
                    placeholder="Confidential ops notes..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALLOCATED SUPPLIER */}
          {activeSubTab === 'SUPPLIER' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Permission & Status Header */}
              <div className="flex items-center justify-between p-3 bg-teal-50/60 rounded-2xl border border-teal-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-bold text-teal-950">
                    Allocated Supplier Status: <strong>{supplierName ? supplierName : 'Unallocated'}</strong>
                  </span>
                </div>
                {!canAllocate ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    <Lock className="w-3 h-3 text-slate-400" /> Read-only (Permission required)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleUnallocateSupplier}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Unallocate / Remove Supplier
                  </button>
                )}
              </div>

              {/* Master Supplier Partner Selector */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    Select Supplier from Master Directory (Live Firestore Suppliers)
                  </label>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                    {masterSuppliers.length} Verified Partners
                  </span>
                </div>

                <select
                  disabled={!canAllocate || isManualSupplierException}
                  value={selectedSupplierId}
                  onChange={e => handleSelectMasterSupplier(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#008972] disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                >
                  <option value="">-- Choose Verified Supplier Partner --</option>
                  {masterSuppliers.map((s: Supplier) => (
                    <option key={s.id} value={s.id}>
                      [{s.supplierCode}] {s.name} • {s.destination} ({s.categories?.join(', ') || 'General'})
                    </option>
                  ))}
                </select>

                {/* Manual Exception Option */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={!canAllocate}
                      checked={isManualSupplierException}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsManualSupplierException(checked);
                        if (checked) {
                          setSelectedSupplierId('');
                        }
                      }}
                      className="rounded text-[#008972] focus:ring-[#008972]"
                    />
                    <span className="text-[11px] font-bold text-slate-700">
                      Temporary Manual Supplier Exception (Unlisted partner)
                    </span>
                  </label>

                  {selectedSupplierId && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-700" /> Directory Controlled
                    </span>
                  )}
                </div>

                {isManualSupplierException && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Approved Manual Supplier Exception Details
                    </div>
                    <input
                      type="text"
                      disabled={!canAllocate}
                      required={isManualSupplierException}
                      value={manualSupplierReason}
                      onChange={e => setManualSupplierReason(e.target.value)}
                      placeholder="Mandatory exception reason (e.g. Direct local vessel charter)..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Editable Supplier Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Allocated Supplier Name *</label>
                  <input
                    type="text"
                    disabled={!canAllocate || (!isManualSupplierException && !!selectedSupplierId)}
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="Select from Master Directory or enter manual name"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 mt-1 focus:outline-none focus:border-[#008972] disabled:bg-slate-100 disabled:text-slate-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Type / Category</label>
                  <select
                    disabled={!canAllocate}
                    value={supplierType}
                    onChange={e => setAllocSupplierType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  >
                    <option value="HOTEL">Hotel Partner</option>
                    <option value="TRANSPORT">Transport / Chauffeur</option>
                    <option value="GUIDE">Guide / Host</option>
                    <option value="ACTIVITY">Activity Provider</option>
                    <option value="TICKET_PARTNER">Ticket Desk</option>
                    <option value="DMC_PARTNER">Local Sub-DMC Partner</option>
                    <option value="GROUND_RESOURCE">Ground Resource</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Phone</label>
                  <input
                    type="text"
                    disabled={!canAllocate}
                    value={supplierPhone}
                    onChange={e => setSupplierPhone(e.target.value)}
                    placeholder="+81 3 5555 0192"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Email</label>
                  <input
                    type="email"
                    disabled={!canAllocate}
                    value={supplierEmail}
                    onChange={e => setSupplierEmail(e.target.value)}
                    placeholder="operations@supplier.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Confirmation Ref</label>
                  <input
                    type="text"
                    disabled={!canAllocate}
                    value={supplierConfirmationRef}
                    onChange={e => setSupplierConfirmationRef(e.target.value)}
                    placeholder="e.g. CONF-BALI-8921"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-teal-800 mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Payment Cut-off Date</label>
                  <input
                    type="date"
                    disabled={!canAllocate}
                    value={paymentCutoffDate}
                    onChange={e => setPaymentCutoffDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Operational Notes / Special Requests</label>
                <textarea
                  rows={2}
                  disabled={!canAllocate}
                  value={supplierNotes}
                  onChange={e => setSupplierNotes(e.target.value)}
                  placeholder="Notes for hotel check-in desk, driver dispatch, luggage instructions..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                />
              </div>
            </div>
          )}

          {/* TAB 3: SUPPLIER COMMERCIAL PRICE */}
          {activeSubTab === 'PRICING' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Permission & Version Header */}
              <div className="flex items-center justify-between p-3.5 bg-teal-50/70 rounded-2xl border border-teal-200">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-black text-teal-950">
                      Confidential Supplier Commercial Rate
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold text-[10px]">
                      v{item.supplierPriceVersion || 1}
                    </span>
                  </div>
                  <p className="text-[10px] text-teal-700">
                    Internal payable rate. Strictly hidden from customer invoice and traveller vouchers.
                  </p>
                </div>
                {!canManagePricing ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    <Lock className="w-3 h-3 text-slate-400" /> Read-only (Permission required)
                  </span>
                ) : (
                  item.supplierPriceHistory && item.supplierPriceHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPriceHistory(!showPriceHistory)}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      {showPriceHistory ? 'Hide Price History' : `History (${item.supplierPriceHistory.length})`}
                    </button>
                  )
                )}
              </div>

              {/* Price Version History Drawer */}
              {showPriceHistory && item.supplierPriceHistory && item.supplierPriceHistory.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-in fade-in">
                  <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                    <History className="w-3 h-3 text-slate-400" /> Previous Price Audit Versions
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1.5">
                    {item.supplierPriceHistory.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] bg-white p-2 rounded-xl border border-slate-100">
                        <div>
                          <strong className="text-slate-800">v{h.version}: {h.currency} {h.newPrice}</strong>
                          <span className="text-slate-500 ml-1">({h.priceType})</span>
                          {h.changeReason && <p className="text-[10px] text-slate-400 mt-0.5">{h.changeReason}</p>}
                        </div>
                        <div className="text-right text-[10px] text-slate-400">
                          <div>{h.updatedByName || 'Operations Lead'}</div>
                          <div>{new Date(h.updatedAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Rate Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Rate (Net Unit) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!canManagePricing}
                    value={supplierPrice}
                    onChange={e => setSupplierPrice(e.target.value)}
                    placeholder="e.g. 150.00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-900 mt-1 focus:outline-none focus:border-[#008972] disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Currency</label>
                  <select
                    disabled={!canManagePricing}
                    value={supplierCurrency}
                    onChange={e => setSupplierCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 mt-1 focus:outline-none focus:border-[#008972]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="SGD">SGD ($)</option>
                    <option value="AED">AED (AED)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Price Structure *</label>
                  <select
                    disabled={!canManagePricing}
                    value={supplierPriceType}
                    onChange={e => setSupplierPriceType(e.target.value as SupplierPriceType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 mt-1 focus:outline-none focus:border-[#008972]"
                  >
                    <option value="Total Service Price">Total Service Price</option>
                    <option value="Per Passenger">Per Passenger</option>
                    <option value="Per Room">Per Room</option>
                    <option value="Per Vehicle">Per Vehicle</option>
                    <option value="Per Group">Per Group</option>
                    <option value="Per Unit">Per Unit</option>
                  </select>
                </div>
              </div>

              {/* Extended Cost Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Quantity / PAX</label>
                  <input
                    type="number"
                    min={1}
                    disabled={!canManagePricing}
                    value={supplierQuantity}
                    onChange={e => setSupplierQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold mt-1 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Tax / VAT ({supplierCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={!canManagePricing}
                    value={supplierTaxAmount}
                    onChange={e => setSupplierTaxAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold mt-1 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Additional Fees</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={!canManagePricing}
                    value={supplierAdditionalFees}
                    onChange={e => setSupplierAdditionalFees(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold mt-1 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Discount ({supplierCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    disabled={!canManagePricing}
                    value={supplierDiscount}
                    onChange={e => setSupplierDiscount(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold mt-1 text-center"
                  />
                </div>
              </div>

              {/* Computed Live Total Cost Display */}
              <div className="p-4 bg-teal-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-teal-200 tracking-wider">
                    Calculated Supplier Total Payable
                  </div>
                  <div className="text-xl font-black mt-0.5">
                    {supplierCurrency} {liveSupplierCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right text-[11px] text-teal-200">
                  <span>Unit: {supplierPrice ? `${supplierCurrency} ${supplierPrice}` : '0.00'} × {supplierQuantity} qty</span>
                  <div className="text-[10px] text-teal-300">
                    + Tax ({supplierTaxAmount}) + Fees ({supplierAdditionalFees}) - Disc ({supplierDiscount})
                  </div>
                </div>
              </div>

              {/* Deadlines and Reasons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Payment Cutoff Date</label>
                  <input
                    type="date"
                    disabled={!canManagePricing}
                    value={supplierPaymentCutoffDate}
                    onChange={e => setSupplierPaymentCutoffDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Cancellation Deadline</label>
                  <input
                    type="date"
                    disabled={!canManagePricing}
                    value={supplierCancellationDeadline}
                    onChange={e => setSupplierCancellationDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Reason for Price Adjustment (Audit Log)</label>
                <input
                  type="text"
                  disabled={!canManagePricing}
                  value={supplierPriceChangeReason}
                  onChange={e => setSupplierPriceChangeReason(e.target.value)}
                  placeholder="e.g. Seasonal contracted rate / negotiated group reduction"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Confidential Commercial Pricing Notes</label>
                <textarea
                  rows={2}
                  disabled={!canManagePricing}
                  value={supplierPricingNotes}
                  onChange={e => setSupplierPricingNotes(e.target.value)}
                  placeholder="Billing terms, deposit paid ref, wire instructions..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008972]"
                />
              </div>
            </div>
          )}

          {/* Modal Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeSubTab !== 'OPERATIONS' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeSubTab === 'PRICING') setActiveSubTab('SUPPLIER');
                    else if (activeSubTab === 'SUPPLIER') setActiveSubTab('OPERATIONS');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Previous Tab
                </button>
              )}

              {activeSubTab !== 'PRICING' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeSubTab === 'OPERATIONS') setActiveSubTab('SUPPLIER');
                    else if (activeSubTab === 'SUPPLIER') setActiveSubTab('PRICING');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  Next Section
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isSaving || (isCurrentlyConfirmed && !authorizeReconfirmation && ((item.supplierName || '') !== supplierName.trim() || (supplierPrice !== '' && item.supplierPrice !== parseFloat(supplierPrice))))}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] hover:bg-[#00705d] text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving to Firestore...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save Service Item
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 3. REPLACE PRODUCT MODAL
// =========================================================================
interface ReplaceProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  item: BookingItem;
  currentUser: User | null;
  onSuccess: () => void;
}

export const ReplaceProductModal: React.FC<ReplaceProductModalProps> = ({
  isOpen,
  onClose,
  booking,
  item,
  currentUser,
  onSuccess
}) => {
  const db = AppDatabase.getInstance();
  const [newProductName, setNewProductName] = useState('');
  const [newCategory, setNewCategory] = useState(item.category || 'Hotel accommodation');
  const [replacementReason, setReplacementReason] = useState('');
  const [isManual, setIsManual] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      alert('Replacement product name is required.');
      return;
    }
    if (!replacementReason.trim()) {
      alert('Mandatory replacement reason must be provided for audit compliance.');
      return;
    }

    const res = db.replaceServiceItemProduct(booking.id, item.id, {
      productId: `repl-${Date.now()}`,
      productName: newProductName.trim(),
      category: newCategory,
      isManualServiceItem: isManual
    }, currentUser, replacementReason.trim());

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      alert(res.error || 'Failed to replace product.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-600" />
              Replace Service Product
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Replacing: <strong className="text-slate-800">{item.productName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Replacing a confirmed product will require supplier reconfirmation. Existing selling prices remain preserved.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">New Product Name *</label>
            <input
              type="text"
              value={newProductName}
              onChange={e => setNewProductName(e.target.value)}
              placeholder="e.g. Four Seasons Resort Bali (Deluxe Villa)"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 mt-1"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">Category</label>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 mt-1"
            >
              {SERVICE_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Mandatory Replacement Audit Reason *
            </label>
            <textarea
              rows={3}
              value={replacementReason}
              onChange={e => setReplacementReason(e.target.value)}
              placeholder="e.g. Original property overbooked; guest upgraded to Ocean Suite with supplier absorption."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 text-slate-900"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            >
              Execute Replacement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 4. CANCEL SERVICE ITEM MODAL
// =========================================================================
interface CancelServiceItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  item: BookingItem;
  currentUser: User | null;
  onSuccess: () => void;
}

export const CancelServiceItemModal: React.FC<CancelServiceItemModalProps> = ({
  isOpen,
  onClose,
  booking,
  item,
  currentUser,
  onSuccess
}) => {
  const db = AppDatabase.getInstance();
  const [cancelReason, setCancelReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      alert('Mandatory cancellation reason is required.');
      return;
    }

    const res = db.cancelServiceItem(booking.id, item.id, cancelReason.trim(), currentUser);
    if (res.success) {
      onSuccess();
      onClose();
    } else {
      alert(res.error || 'Failed to cancel service item.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Cancel Service Item
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Service: <strong className="text-slate-800">{item.productName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-700">
              Mandatory Cancellation Reason *
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Passenger requested flight change; excursion no longer feasible due to schedule clash."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 text-slate-900 focus:outline-hidden focus:border-rose-500"
              required
            />
            <span className="text-[10px] text-slate-400 block mt-1">
              Recorded in the immutable operational audit log.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Keep Active
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
            >
              Confirm Cancellation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 5. CONFIRMATION OVERRIDE MODAL
// =========================================================================
interface ConfirmationOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  currentUser: User | null;
  onSuccess: () => void;
}

export const ConfirmationOverrideModal: React.FC<ConfirmationOverrideModalProps> = ({
  isOpen,
  onClose,
  booking,
  currentUser,
  onSuccess
}) => {
  const db = AppDatabase.getInstance();
  const [overrideReason, setOverrideReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert('Mandatory override reason must be recorded.');
      return;
    }

    const res = db.overrideBookingConfirmation(booking.id, overrideReason.trim(), currentUser);
    if (res.success) {
      onSuccess();
      onClose();
    } else {
      alert(res.error || 'Failed to override confirmation.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-amber-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Authorised Operational Override
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Force Operationally Confirmed Status for {booking.bookingReference}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs">
          <strong>Security Notice:</strong> Only authorised internal team members can override unconfirmed service items. A detailed explanation must be documented in the permanent audit trail.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-700">
              Mandatory Authorised Override Reason *
            </label>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="e.g. VIP ground contract pre-approved via direct WhatsApp agreement with resort GM."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 text-slate-900 focus:outline-hidden focus:border-amber-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
            >
              Apply Authorised Override
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
