import React, { useState, useMemo } from 'react';
import { 
  Booking, 
  BookingItem, 
  User, 
  SupplierPriceType, 
  CurrencyCode, 
  BookingUploadedInvoice, 
  UploadedInvoiceType, 
  InvoiceAssociationType, 
  BookingVoucher,
  BookingActivityTimelineEvent,
  SupplierPriceHistoryEntry,
  Supplier
} from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { VoucherDocumentView } from './VoucherDocumentView';
import {
  AddServiceItemModal,
  EditServiceItemModal,
  ReplaceProductModal,
  CancelServiceItemModal,
  ConfirmationOverrideModal
} from './ServiceItemActionModals';
import { 
  Layers, 
  Building2, 
  DollarSign, 
  CheckCircle2, 
  FileCheck, 
  UploadCloud, 
  History, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Users, 
  MapPin, 
  Calendar, 
  Phone, 
  Mail, 
  FileText, 
  Printer, 
  Download, 
  Edit3, 
  Plus, 
  Search, 
  ChevronRight, 
  CheckSquare, 
  ShieldCheck, 
  Archive, 
  RefreshCw, 
  ArrowRight,
  Info,
  ExternalLink,
  Tag,
  AlertCircle,
  Eye,
  Trash2,
  FilePlus,
  ArrowUpRight
} from 'lucide-react';

interface BookingOperationsEngineProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
  initialTab?: 'ITEMS' | 'ALLOCATION' | 'PRICING' | 'CONFIRMATION' | 'VOUCHER' | 'INVOICES' | 'DOCUMENTS' | 'TIMELINE';
}

export const BookingOperationsEngine: React.FC<BookingOperationsEngineProps> = ({
  booking,
  currentUser,
  onRefresh,
  initialTab = 'ITEMS'
}) => {
  const db = AppDatabase.getInstance();
  const isAdminOrOps = currentUser?.role === 'ADMIN' || currentUser?.role === 'TEAM_MEMBER' || currentUser?.role === 'DMC_STAFF';

  // State
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'ALLOCATION' | 'PRICING' | 'CONFIRMATION' | 'VOUCHER' | 'INVOICES' | 'DOCUMENTS' | 'TIMELINE'>(initialTab);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(booking.items?.[0]?.id || null);
  const [filterQuery, setFilterQuery] = useState('');

  // Modals
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isInvoiceUploadModalOpen, setIsInvoiceUploadModalOpen] = useState(false);
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);
  const [isVoucherViewerOpen, setIsVoucherViewerOpen] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<BookingUploadedInvoice | null>(null);
  const [selectedVoucherForView, setSelectedVoucherForView] = useState<BookingVoucher | null>(null);

  // New Service Item CRUD Modals
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [targetItemForEdit, setTargetItemForEdit] = useState<BookingItem | null>(null);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [targetItemForReplace, setTargetItemForReplace] = useState<BookingItem | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [targetItemForCancel, setTargetItemForCancel] = useState<BookingItem | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  // Supplier Allocation Form
  const [allocTargetItem, setAllocTargetItem] = useState<BookingItem | null>(null);
  const [allocSupplierId, setAllocSupplierId] = useState('');
  const [allocSupplierName, setAllocSupplierName] = useState('');
  const [allocSupplierType, setAllocSupplierType] = useState<BookingItem['supplierType']>('GROUND_RESOURCE');
  const [allocSupplierPhone, setAllocSupplierPhone] = useState('');
  const [allocSupplierEmail, setAllocSupplierEmail] = useState('');
  const [allocConfirmationRef, setAllocConfirmationRef] = useState('');
  const [allocPaymentCutoffDate, setAllocPaymentCutoffDate] = useState('');
  const [allocServiceDate, setAllocServiceDate] = useState('');
  const [allocServiceTime, setAllocServiceTime] = useState('');
  const [allocTimezone, setAllocTimezone] = useState('Asia/Tokyo (JST, UTC+9)');
  const [allocSupplierNotes, setAllocSupplierNotes] = useState('');
  const [allocInternalNotes, setAllocInternalNotes] = useState('');

  // Supplier Price Form
  const [priceTargetItem, setPriceTargetItem] = useState<BookingItem | null>(null);
  const [newSupplierPrice, setNewSupplierPrice] = useState<string>('');
  const [newSupplierCurrency, setNewSupplierCurrency] = useState<CurrencyCode>(booking.currency || 'USD');
  const [newSupplierPriceType, setNewSupplierPriceType] = useState<SupplierPriceType>('Total Service Price');
  const [priceChangeReason, setPriceChangeReason] = useState<string>('');
  const [priceWarningConfirmed, setPriceWarningConfirmed] = useState(false);
  const [priceErrorMessage, setPriceErrorMessage] = useState<string | null>(null);

  // Invoice Upload Form
  const [invoiceType, setInvoiceType] = useState<UploadedInvoiceType>('Supplier Invoice');
  const [invoiceAssociation, setInvoiceAssociation] = useState<InvoiceAssociationType>('BOOKING');
  const [invoiceAssociatedItemId, setInvoiceAssociatedItemId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState<CurrencyCode>(booking.currency || 'USD');
  const [invoiceAmount, setInvoiceAmount] = useState<string>('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Invoice Actions (Replace / Archive / Note)
  const [archiveReason, setArchiveReason] = useState('');
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [targetInvoiceForAction, setTargetInvoiceForAction] = useState<BookingUploadedInvoice | null>(null);
  const [newInvoiceNoteText, setNewInvoiceNoteText] = useState('');

  // Reconfirmation Request State
  const [reconfirmReason, setReconfirmReason] = useState('');
  const [reconfirmItemId, setReconfirmItemId] = useState<string | null>(null);

  // Ensure normalized service items
  const items = useMemo(() => {
    return db.normalizeServiceItems(booking.items || [], booking);
  }, [booking, db]);

  // Master Suppliers from Directory
  const masterSuppliers = useMemo(() => {
    return (db.getSuppliers ? db.getSuppliers() : []).filter((s: Supplier) => s.status === 'ACTIVE');
  }, [db]);

  // Controlled Master Supplier Allocation State
  const [selectedMasterSupplierId, setSelectedMasterSupplierId] = useState<string>('');
  const [isManualSupplierException, setIsManualSupplierException] = useState(false);
  const [manualSupplierReason, setManualSupplierReason] = useState('');

  // Selected item reference
  const currentItem = useMemo(() => {
    if (!selectedItemId) return items[0] || null;
    return items.find(it => it.id === selectedItemId) || items[0] || null;
  }, [items, selectedItemId]);

  // Roster resources for quick selection
  const roster = useMemo(() => {
    return (db as any).getResources ? (db as any).getResources() : [];
  }, [db]);

  // Booking-level operational metrics & voucher eligibility
  const eligibility = useMemo(() => {
    return db.checkBookingVoucherEligibility(booking);
  }, [booking, db, items]);

  const vouchers = useMemo(() => {
    return booking.vouchersList || db.getBookingVouchers(booking.id);
  }, [booking, db]);

  const latestVoucher = vouchers[0] || null;

  const uploadedInvoices = useMemo(() => {
    const fromBooking = booking.uploadedInvoices || [];
    const fromGlobal = db.getUploadedInvoices(booking.id);
    // Combine unique
    const map = new Map<string, BookingUploadedInvoice>();
    [...fromBooking, ...fromGlobal].forEach(inv => map.set(inv.id, inv));
    return Array.from(map.values());
  }, [booking, db]);

  const activities = useMemo(() => {
    const list = db.getBookingActivities(booking.id);
    if (list.length > 0) return list;
    // Fallback to booking.timeline if not migrated yet
    return (booking.timeline || []).map((t: any) => ({
      eventId: t.id,
      bookingId: booking.id,
      eventType: 'OTHER' as const,
      actorId: 'system',
      actorRole: 'INTERNAL',
      actorName: t.actorName || 'Operations',
      timestamp: t.timestamp,
      description: t.title ? `${t.title} - ${t.description || ''}` : t.description
    }));
  }, [booking, db]);

  // Filtered service items
  const filteredItems = useMemo(() => {
    if (!filterQuery.trim()) return items;
    const q = filterQuery.toLowerCase();
    return items.filter(it => 
      it.productName.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q) ||
      (it.supplierName && it.supplierName.toLowerCase().includes(q)) ||
      (it.city && it.city.toLowerCase().includes(q))
    );
  }, [items, filterQuery]);

  // ----------------------------------------------------
  // HANDLERS: ALLOCATION
  // ----------------------------------------------------
  const handleOpenAllocateModal = (item: BookingItem) => {
    setAllocTargetItem(item);
    setAllocSupplierId(item.supplierId || `supp-${Date.now()}`);
    setAllocSupplierName(item.supplierName || '');
    setAllocSupplierType(item.supplierType || 'GROUND_RESOURCE');
    setAllocSupplierPhone(item.supplierPhone || '');
    setAllocSupplierEmail(item.supplierEmail || '');
    setAllocConfirmationRef(item.supplierConfirmationRef || '');
    setAllocPaymentCutoffDate(item.paymentCutoffDate || '');
    setAllocServiceDate(item.serviceDate || item.travelDate || '');
    setAllocServiceTime(item.serviceTime || '09:00 AM');
    setAllocTimezone(item.serviceTimezone || 'Asia/Tokyo (JST, UTC+9)');
    setAllocSupplierNotes(item.supplierNotes || '');
    setAllocInternalNotes(item.internalNotes || item.internalOpsNotes || '');

    // Match against active master directory suppliers
    const match = masterSuppliers.find(
      s => s.id === item.supplierId || s.name.toLowerCase() === (item.supplierName || '').toLowerCase()
    );
    if (match) {
      setSelectedMasterSupplierId(match.id);
      setIsManualSupplierException(false);
      setManualSupplierReason('');
    } else if (item.supplierName) {
      setSelectedMasterSupplierId('');
      setIsManualSupplierException(true);
      setManualSupplierReason('Existing unlisted supplier assignment');
    } else {
      setSelectedMasterSupplierId('');
      setIsManualSupplierException(false);
      setManualSupplierReason('');
    }

    setIsAllocateModalOpen(true);
  };

  const handleSelectMasterSupplier = (supplierId: string) => {
    setSelectedMasterSupplierId(supplierId);
    if (!supplierId) return;
    const sup = masterSuppliers.find(s => s.id === supplierId);
    if (!sup) return;
    setAllocSupplierId(sup.id);
    setAllocSupplierName(sup.name);
    setAllocSupplierPhone(sup.phone || sup.emergencyPhone || '');
    setAllocSupplierEmail(sup.email || '');

    const cat = sup.categories?.[0] || '';
    if (cat.includes('Hotel')) setAllocSupplierType('HOTEL');
    else if (cat.includes('Transfer') || cat.includes('Rail')) setAllocSupplierType('TRANSPORT');
    else if (cat.includes('Guide')) setAllocSupplierType('GUIDE');
    else if (cat.includes('Activity') || cat.includes('Yacht')) setAllocSupplierType('ACTIVITY');
    else setAllocSupplierType('GROUND_RESOURCE');

    setIsManualSupplierException(false);
    setManualSupplierReason('');
  };

  const handleSelectRosterResource = (resId: string) => {
    const res = roster.find((r: any) => r.id === resId);
    if (!res) return;
    setAllocSupplierId(res.id);
    setAllocSupplierName(res.name);
    setAllocSupplierType((res.type as any) || 'GUIDE');
    setAllocSupplierPhone(res.phone || '');
    setAllocSupplierEmail(res.email || '');
    setAllocSupplierNotes(`Allocated from Verified Ground Roster: ${res.city || ''} (${res.languages?.join(', ') || 'English'}).`);
    setIsManualSupplierException(false);
    setManualSupplierReason('');
    setSelectedMasterSupplierId('');
  };

  const handleSaveAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocTargetItem || !allocSupplierName.trim()) return;

    if (isManualSupplierException && !manualSupplierReason.trim()) {
      alert('An approved exception justification reason is required when manually entering an unlisted supplier.');
      return;
    }

    const notePrefix = isManualSupplierException 
      ? `[APPROVED MANUAL EXCEPTION: ${manualSupplierReason.trim()}] `
      : '';

    const res = db.allocateServiceItemSupplier(
      booking.id,
      allocTargetItem.id,
      {
        supplierId: allocSupplierId || `supp-${Date.now()}`,
        supplierName: allocSupplierName.trim(),
        supplierType: allocSupplierType,
        supplierContact: `${allocSupplierPhone.trim()} ${allocSupplierEmail.trim() ? '/ ' + allocSupplierEmail.trim() : ''}`.trim(),
        supplierPhone: allocSupplierPhone.trim(),
        supplierEmail: allocSupplierEmail.trim(),
        supplierConfirmationRef: allocConfirmationRef.trim(),
        paymentCutoffDate: allocPaymentCutoffDate || undefined,
        serviceDate: allocServiceDate || undefined,
        serviceTime: allocServiceTime.trim() || undefined,
        serviceTimezone: allocTimezone.trim() || undefined,
        supplierNotes: (notePrefix + (allocSupplierNotes.trim() || '')).trim() || undefined,
        internalNotes: allocInternalNotes.trim() || undefined
      },
      currentUser
    );

    if (!res.success) {
      alert(res.error || 'Failed to allocate supplier');
      return;
    }

    setIsAllocateModalOpen(false);
    onRefresh();
  };

  const handleUnallocateSupplierInModal = () => {
    if (!allocTargetItem) return;
    const res = db.allocateServiceItemSupplier(
      booking.id,
      allocTargetItem.id,
      null,
      currentUser
    );

    if (!res.success) {
      alert(res.error || 'Failed to unallocate supplier');
      return;
    }

    setIsAllocateModalOpen(false);
    onRefresh();
  };

  // ----------------------------------------------------
  // HANDLERS: SUPPLIER PRICING
  // ----------------------------------------------------
  const handleOpenPriceModal = (item: BookingItem) => {
    setPriceTargetItem(item);
    setNewSupplierPrice(item.supplierPrice !== undefined ? String(item.supplierPrice) : '');
    setNewSupplierCurrency(item.supplierCurrency || item.currency || booking.currency || 'USD');
    setNewSupplierPriceType(item.supplierPriceType || 'Total Service Price');
    setPriceChangeReason('');
    setPriceWarningConfirmed(false);
    setPriceErrorMessage(null);
    setIsPriceModalOpen(true);
  };

  const handleSaveSupplierPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceTargetItem) return;

    const numPrice = parseFloat(newSupplierPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      setPriceErrorMessage('Please enter a valid non-negative supplier price.');
      return;
    }

    const res = db.updateServiceItemSupplierPrice(
      booking.id,
      priceTargetItem.id,
      {
        supplierPrice: numPrice,
        supplierCurrency: newSupplierCurrency,
        supplierPriceType: newSupplierPriceType,
        changeReason: priceChangeReason.trim() || undefined,
        forceAfterConfirmation: priceWarningConfirmed
      },
      currentUser
    );

    if (!res.success) {
      if (res.requiresReconfirmation) {
        setPriceErrorMessage(res.error || 'Price change requires reconfirmation.');
      } else {
        setPriceErrorMessage(res.error || 'Failed to save supplier price.');
      }
      return;
    }

    setIsPriceModalOpen(false);
    onRefresh();
  };

  // ----------------------------------------------------
  // HANDLERS: CONFIRMATION
  // ----------------------------------------------------
  const handleConfirmItem = (item: BookingItem) => {
    const res = db.confirmServiceItem(booking.id, item.id, currentUser);
    if (!res.success) {
      alert(`Cannot confirm service item:\n• ${res.errors?.join('\n• ')}`);
      return;
    }
    onRefresh();
  };

  const handleRequestReconfirmation = (itemId: string) => {
    if (!reconfirmReason.trim()) {
      alert('Please enter a reason for requesting supplier reconfirmation.');
      return;
    }
    db.requestServiceItemReconfirmation(booking.id, itemId, reconfirmReason.trim(), currentUser);
    setReconfirmItemId(null);
    setReconfirmReason('');
    onRefresh();
  };

  // ----------------------------------------------------
  // HANDLERS: VOUCHER
  // ----------------------------------------------------
  const handleGenerateVoucher = (forceRegenerate: boolean = false) => {
    const res = db.generateBookingVoucher(booking.id, currentUser, forceRegenerate);
    if (!res.success) {
      alert(res.error || 'Failed to generate voucher');
      return;
    }
    if (res.voucher) {
      setSelectedVoucherForView(res.voucher);
      setIsVoucherViewerOpen(true);
    }
    onRefresh();
  };

  // ----------------------------------------------------
  // HANDLERS: INVOICE UPLOAD (MANUAL ONLY)
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (up to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit.');
      return;
    }

    setUploadedFileName(file.name);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFileBase64(reader.result as string);
    };
    reader.onerror = () => {
      setUploadError('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveInvoiceUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      setUploadError('Invoice Number is required.');
      return;
    }
    const numAmt = parseFloat(invoiceAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setUploadError('Valid invoice amount is required.');
      return;
    }
    if (!uploadedFileName) {
      setUploadError('Please select or drop an invoice document file.');
      return;
    }

    const associatedItem = items.find(it => it.id === invoiceAssociatedItemId);
    const invoiceId = `inv-up-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    const newInvoice: BookingUploadedInvoice = {
      id: invoiceId,
      invoiceId,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      bookingItemId: invoiceAssociation === 'SERVICE_ITEM' ? invoiceAssociatedItemId : undefined,
      serviceItemName: invoiceAssociation === 'SERVICE_ITEM' ? associatedItem?.productName : undefined,
      supplierId: associatedItem?.supplierId,
      supplierName: associatedItem?.supplierName,
      associationType: invoiceAssociation,
      invoiceType,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      dueDate: invoiceDueDate || undefined,
      currency: invoiceCurrency,
      amount: numAmt,
      uploadedFile: uploadedFileBase64 || undefined,
      uploadedFileName,
      uploadedBy: currentUser?.id || 'admin',
      uploadedByName: currentUser?.name || 'Operations Staff',
      uploadedAt: new Date().toISOString(),
      status: 'ACTIVE',
      notes: invoiceNotes.trim() || undefined,
      history: [
        {
          action: 'UPLOAD',
          timestamp: new Date().toISOString(),
          actor: currentUser?.name || 'Operations Staff',
          note: `Uploaded as ${invoiceType}`
        }
      ]
    };

    db.saveUploadedInvoice(newInvoice, currentUser);
    setIsInvoiceUploadModalOpen(false);
    // Reset form
    setInvoiceNumber('');
    setInvoiceAmount('');
    setUploadedFileBase64(null);
    setUploadedFileName('');
    setInvoiceNotes('');
    setUploadError(null);
    onRefresh();
  };

  const handleArchiveInvoice = () => {
    if (!targetInvoiceForAction) return;
    db.archiveUploadedInvoice(targetInvoiceForAction.id, archiveReason.trim() || 'Archived by operations', currentUser);
    setIsArchiveModalOpen(false);
    setTargetInvoiceForAction(null);
    setArchiveReason('');
    onRefresh();
  };

  const handleAddInvoiceNote = () => {
    if (!targetInvoiceForAction || !newInvoiceNoteText.trim()) return;
    db.addInvoiceNote(targetInvoiceForAction.id, newInvoiceNoteText.trim(), currentUser);
    setNewInvoiceNoteText('');
    onRefresh();
  };

  // Calculation helpers
  const totalCostEstimate = items.reduce((sum, it) => sum + (it.supplierPrice || 0), 0);
  const totalSellingPrice = booking.totalAmount || items.reduce((sum, it) => sum + it.totalPrice, 0);
  const estimatedGrossProfit = totalSellingPrice - totalCostEstimate;
  const estimatedMarginPercent = totalSellingPrice > 0 ? Math.round((estimatedGrossProfit / totalSellingPrice) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. BREADCRUMBS HIERARCHY */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 overflow-x-auto pb-1">
        <span className="hover:text-slate-800 transition-colors">Booking Management</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="hover:text-slate-800 transition-colors">Booking Operations & Reservations Engine</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md">
          Service Items & Supplier Operations Processing
        </span>
      </div>

      {/* 2. BOOKING-LEVEL OPERATIONAL STATUS DASHBOARD */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {booking.bookingReference}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                {booking.destinationName || 'Ground Itinerary'}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                {booking.travelStartDate || 'Flexible'} - {booking.travelEndDate || 'Dates'}
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white mt-2">
              Booking Operations & Supplier Allocation Desk
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Guest: <strong>{booking.customer?.leadTravelerName || 'Direct Guest'}</strong> • Assigned: {booking.assignedTeamMemberName || 'Operations DMC Desk'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {eligibility.isEligible ? (
              <button
                onClick={() => handleGenerateVoucher(Boolean(latestVoucher))}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                {latestVoucher ? 'Regenerate Voucher' : 'Generate Official Voucher'}
              </button>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-medium border border-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Voucher Blocked ({eligibility.pendingItems} Pending)</span>
              </div>
            )}

            <button
              onClick={() => setIsInvoiceUploadModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-teal-400" />
              Upload Manual Invoice
            </button>
          </div>
        </div>

        {/* Operational KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Items</div>
            <div className="text-xl font-black text-white mt-1">{eligibility.totalItems}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Ground services</div>
          </div>

          <div className="bg-emerald-950/40 rounded-2xl p-3 border border-emerald-500/30">
            <div className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Confirmed
            </div>
            <div className="text-xl font-black text-emerald-300 mt-1">{eligibility.confirmedItems}</div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div 
                className="bg-emerald-400 h-full transition-all" 
                style={{ width: `${eligibility.totalItems > 0 ? (eligibility.confirmedItems / eligibility.totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Pending
            </div>
            <div className="text-xl font-black text-amber-300 mt-1">{eligibility.pendingItems}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Needs action</div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Reconfirm
            </div>
            <div className="text-xl font-black text-rose-300 mt-1">{eligibility.reconfirmationRequiredItems}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Supplier amended</div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-teal-400 flex items-center gap-1">
              <FileCheck className="w-3 h-3" /> Voucher
            </div>
            <div className="text-xs font-black text-white mt-1.5">
              {latestVoucher ? (latestVoucher.isOutdated ? 'Outdated' : `v${latestVoucher.version || 1} Issued`) : (eligibility.isEligible ? 'Ready' : 'Pending Items')}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {latestVoucher ? latestVoucher.voucherNumber : 'No voucher'}
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-blue-400 flex items-center gap-1">
              <UploadCloud className="w-3 h-3" /> Invoices
            </div>
            <div className="text-xl font-black text-blue-300 mt-1">{uploadedInvoices.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Manual uploads</div>
          </div>

          <div className="bg-teal-950/40 rounded-2xl p-3 border border-teal-500/30">
            <div className="text-[10px] uppercase font-bold text-teal-300">Supplier Payable</div>
            <div className="text-sm font-black text-teal-200 mt-1">
              {formatCurrency(totalCostEstimate, booking.currency || 'USD')}
            </div>
            <div className="text-[10px] text-teal-300/70 mt-0.5">
              Margin: ~{estimatedMarginPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONNECTED SUB-TABS NAVIGATION */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto border border-slate-200">
        <button
          onClick={() => setActiveTab('ITEMS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'ITEMS'
              ? 'bg-[#008f77] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Service Items ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ALLOCATION')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'ALLOCATION'
              ? 'bg-[#008f77] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Supplier Allocation</span>
        </button>

        <button
          onClick={() => setActiveTab('PRICING')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'PRICING'
              ? 'bg-[#008f77] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Supplier Pricing</span>
        </button>

        <button
          onClick={() => setActiveTab('CONFIRMATION')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'CONFIRMATION'
              ? 'bg-[#008f77] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Confirmation Verification</span>
          {eligibility.pendingItems > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('VOUCHER')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'VOUCHER'
              ? 'bg-[#008f77] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Voucher Generation</span>
          {latestVoucher && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-800 font-black">
              v{latestVoucher.version || 1}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'INVOICES'
              ? 'bg-[#008f77] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Manual Invoices ({uploadedInvoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('DOCUMENTS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'DOCUMENTS'
              ? 'bg-[#008f77] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Dispatch Documents</span>
        </button>

        <button
          onClick={() => setActiveTab('TIMELINE')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'TIMELINE'
              ? 'bg-[#008f77] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Activity Audit ({activities.length})</span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}

      {/* TAB 1: SERVICE ITEMS (Connected Review & Quick Actions) */}
      {activeTab === 'ITEMS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Search service name, category, supplier, city..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Showing <strong>{filteredItems.length}</strong> of {items.length} services</span>
              {isAdminOrOps && (
                <button
                  id="btn-add-service-item"
                  onClick={() => setIsAddItemModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#008972] hover:bg-[#00705d] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Service Item</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {filteredItems.map((item, idx) => (
              <div 
                key={item.id || idx}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-slate-400 font-mono">
                        #{idx + 1}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 uppercase tracking-wider">
                        {item.category || 'Ground Service'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Item ID: {item.id}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      {item.productName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-teal-600" />
                        Destination: {item.destination || booking.destinationName} • Hub: {item.hub || item.city || 'Central'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        Service Date: <strong>{item.serviceDate || item.travelDate}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        Time: <strong>{item.serviceTime || '09:00 AM'}</strong> ({item.serviceTimezone || 'JST'})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-teal-600" />
                        Party: {item.passengerDetails || `${item.totalPax} Pax`}
                      </span>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Confirmation Status */}
                    {item.supplierConfirmationStatus === 'Confirmed' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Confirmed
                      </span>
                    ) : item.supplierConfirmationStatus === 'Supplier Reconfirmation Required' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Reconfirmation Required
                      </span>
                    ) : item.supplierConfirmationStatus === 'Price Pending' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Price Pending
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" /> Confirmation Pending
                      </span>
                    )}

                    {/* Voucher Status */}
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      item.supplierConfirmationStatus === 'Confirmed'
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      Voucher: {item.supplierConfirmationStatus === 'Confirmed' ? 'Eligible' : 'Not Ready'}
                    </span>

                    {/* Invoice Status */}
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      item.invoiceStatus === 'Uploaded'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      Invoice: {item.invoiceStatus || 'Not Uploaded'}
                    </span>
                  </div>
                </div>

                {/* Body row: Bento details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Supplier Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400">Allocated Supplier</span>
                      <button
                        onClick={() => handleOpenAllocateModal(item)}
                        className="text-teal-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    </div>
                    <div className="font-black text-slate-900 text-sm">
                      {item.supplierName || <span className="text-amber-600 italic">No supplier allocated</span>}
                    </div>
                    {item.supplierContact && (
                      <p className="text-slate-600 text-[11px]">
                        Contact: {item.supplierContact}
                      </p>
                    )}
                    <p className="text-slate-500 text-[11px]">
                      Confirmation Ref: <strong className="text-slate-800">{item.supplierConfirmationRef || 'Pending assignment'}</strong>
                    </p>
                    {item.paymentCutoffDate && (
                      <p className="text-amber-800 font-semibold text-[11px]">
                        Cut-off: {item.paymentCutoffDate}
                      </p>
                    )}
                  </div>

                  {/* Supplier Price Card (Internal Only) */}
                  <div className="p-4 rounded-2xl bg-teal-50/40 border border-teal-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-teal-800 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Supplier Commercial Price
                      </span>
                      {isAdminOrOps && (
                        <button
                          onClick={() => handleOpenPriceModal(item)}
                          className="text-teal-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Adjust
                        </button>
                      )}
                    </div>
                    <div className="text-lg font-black text-slate-950">
                      {item.supplierPrice !== undefined ? (
                        <>
                          {item.supplierCurrency || booking.currency} {item.supplierPrice.toLocaleString()}
                          <span className="text-xs font-normal text-slate-500 ml-2">
                            ({item.supplierPriceType || 'Total Service Price'})
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-700 italic">Price pending entry</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Version: <strong>v{item.supplierPriceVersion || 1}</strong> • Updated by {item.supplierPriceLastUpdatedBy || 'Operations'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Internal confidential rate. Strictly hidden from customer voucher.
                    </p>
                  </div>

                  {/* Operational Notes & Assigned Lead */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">Operations & Dispatch</span>
                    <p className="text-slate-700 text-[11px]">
                      Desk Lead: <strong>{item.assignedTeamMember || booking.assignedTeamMemberName || 'Operations DMC'}</strong>
                    </p>
                    <p className="text-slate-600 text-[11px] line-clamp-2">
                      Notes: {item.supplierNotes || item.internalNotes || 'Standard ground operations procedures apply.'}
                    </p>
                    {item.confirmedBy && (
                      <p className="text-emerald-700 font-semibold text-[10px]">
                        Confirmed by {item.confirmedByName || 'Operations'} on {new Date(item.confirmedAt!).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Quick Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleOpenAllocateModal(item)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5 text-teal-600" />
                      Allocate Supplier
                    </button>
                    <button
                      onClick={() => handleOpenPriceModal(item)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                      Set Supplier Price
                    </button>
                    <button
                      onClick={() => {
                        setTargetItemForEdit(item);
                        setIsEditItemModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        const res = db.duplicateServiceItem(booking.id, item.id, currentUser);
                        if (res.success) onRefresh();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Clone service item"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-600" />
                      Duplicate
                    </button>
                    <button
                      onClick={() => {
                        setTargetItemForReplace(item);
                        setIsReplaceModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                      Replace
                    </button>
                    {item.isCancelled ? (
                      <button
                        onClick={() => {
                          const res = db.restoreServiceItem(booking.id, item.id, currentUser);
                          if (res.success) onRefresh();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setTargetItemForCancel(item);
                          setIsCancelModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setInvoiceAssociation('SERVICE_ITEM');
                        setInvoiceAssociatedItemId(item.id);
                        setIsInvoiceUploadModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                      Invoice
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Permanently remove service item "${item.productName}"?`)) {
                          const res = db.removeServiceItem(booking.id, item.id, currentUser);
                          if (res.success) onRefresh();
                        }
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete item permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.supplierConfirmationStatus !== 'Confirmed' ? (
                      <button
                        onClick={() => handleConfirmItem(item)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark Service Confirmed
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setReconfirmItemId(item.id);
                          setReconfirmReason('');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Request Reconfirmation
                      </button>
                    )}
                  </div>
                </div>

                {/* Reconfirmation Reason Inline Prompt */}
                {reconfirmItemId === item.id && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Request Supplier Reconfirmation for "{item.productName}"
                    </div>
                    <input
                      type="text"
                      value={reconfirmReason}
                      onChange={e => setReconfirmReason(e.target.value)}
                      placeholder="Enter operational reason (e.g., flight reschedule, room change, driver reallocation)..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setReconfirmItemId(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-rose-100/50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRequestReconfirmation(item.id)}
                        className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Submit Reconfirmation Request
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIER ALLOCATION DESK */}
      {activeTab === 'ALLOCATION' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                Dedicated Supplier Allocation Operations
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign verified ground resources, transportation chauffeurs, hotels, and guides per service item.
              </p>
            </div>
            <div className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
              Allocated: <strong>{items.filter(i => Boolean(i.supplierName)).length}</strong> of {items.length} items
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, idx) => (
              <div 
                key={item.id || idx}
                className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  item.supplierName 
                    ? 'bg-slate-50/70 border-slate-200' 
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Service #{idx + 1}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.supplierName ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.supplierName ? 'Allocated' : 'Unallocated'}
                  </span>
                </div>

                <div className="font-bold text-slate-900 text-xs">
                  {item.productName}
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div>Supplier: <strong className="text-slate-900">{item.supplierName || 'None assigned'}</strong></div>
                  <div>Category: {item.supplierType || item.category}</div>
                  <div>Date: {item.serviceDate || item.travelDate} ({item.serviceTime || '09:00 AM'})</div>
                  {item.supplierConfirmationRef && (
                    <div className="text-teal-700 font-mono font-bold">
                      Ref: {item.supplierConfirmationRef}
                    </div>
                  )}
                  {item.paymentCutoffDate && (
                    <div className="text-amber-800">
                      Payment Cut-off: {item.paymentCutoffDate}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenAllocateModal(item)}
                    className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    {item.supplierName ? 'Reallocate Supplier' : 'Allocate Supplier'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIER PRICING */}
      {activeTab === 'PRICING' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-teal-600" />
                Authoritative Supplier Commercial Pricing
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Internal pricing given to or payable to suppliers. Strictly segregated from customer selling rates.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Supplier Payable</div>
                <div className="text-base font-black text-slate-900">
                  {formatCurrency(totalCostEstimate, booking.currency || 'USD')}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Service Name</th>
                  <th className="px-4 py-3">Allocated Supplier</th>
                  <th className="px-4 py-3">Customer Selling Price</th>
                  <th className="px-4 py-3">Supplier Commercial Price</th>
                  <th className="px-4 py-3">Price Type</th>
                  <th className="px-4 py-3">Version & Audit</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{item.productName}</div>
                      <div className="text-[11px] text-slate-400">ID: {item.id}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-800">{item.supplierName || 'Unallocated'}</div>
                      <div className="text-[11px] text-slate-400">{item.supplierType || 'GROUND_RESOURCE'}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatCurrency(item.totalPrice, item.currency || booking.currency)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-black text-slate-900 text-sm">
                        {item.supplierPrice !== undefined ? (
                          `${item.supplierCurrency || booking.currency} ${item.supplierPrice.toLocaleString()}`
                        ) : (
                          <span className="text-amber-600 italic">Not set</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                        {item.supplierPriceType || 'Total Service Price'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-[11px] font-bold text-slate-700">
                        v{item.supplierPriceVersion || 1}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.supplierPriceLastUpdatedBy || 'Ops'} • {item.supplierPriceLastUpdatedAt ? new Date(item.supplierPriceLastUpdatedAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenPriceModal(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all cursor-pointer"
                      >
                        Edit Price
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CONFIRMATION VERIFICATION */}
      {activeTab === 'CONFIRMATION' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                Service Confirmation & Operational Lock
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every service item must pass required field validations before voucher eligibility is unlocked.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                Confirmed: {eligibility.confirmedItems} / {eligibility.totalItems}
              </span>
              {isAdminOrOps && (
                <button
                  id="btn-override-confirmation"
                  onClick={() => setIsOverrideModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Authorised Override</span>
                </button>
              )}
            </div>
          </div>

          {/* Validation Checklist per Item */}
          <div className="space-y-4">
            {items.map((item, idx) => {
              const hasSupplier = Boolean(item.supplierName || item.supplierId);
              const hasPrice = item.supplierPrice !== undefined && item.supplierPrice >= 0;
              const hasCurrency = Boolean(item.supplierCurrency || item.currency);
              const hasDate = Boolean(item.serviceDate || item.travelDate);
              const isReady = hasSupplier && hasPrice && hasCurrency && hasDate;

              return (
                <div 
                  key={item.id || idx}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-400">Item #{idx + 1}</div>
                      <h4 className="text-sm font-black text-slate-900">{item.productName}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.supplierConfirmationStatus === 'Confirmed' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          CONFIRMED ({item.confirmedByName || 'Ops'})
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirmItem(item)}
                          disabled={!isReady}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isReady 
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs' 
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm Service
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Checklist Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2">
                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      hasSupplier ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {hasSupplier ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                      <span>Supplier Allocated: <strong>{item.supplierName || 'Missing'}</strong></span>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      hasPrice ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {hasPrice ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                      <span>Supplier Price: <strong>{hasPrice ? `${item.supplierCurrency} ${item.supplierPrice}` : 'Missing'}</strong></span>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      hasDate ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {hasDate ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                      <span>Service Date: <strong>{item.serviceDate || item.travelDate || 'Missing'}</strong></span>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      item.supplierConfirmationRef ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ref: <strong>{item.supplierConfirmationRef || 'Ops Pending'}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: VOUCHER GENERATION & DISPATCH */}
      {activeTab === 'VOUCHER' && (
        <div className="space-y-6">
          {/* Eligibility Banner */}
          {!eligibility.isEligible ? (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-amber-950 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-200/60 text-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-tight text-amber-950">
                    Voucher is Not Ready for Dispatch
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Complete and confirm all required Service Items before an official voucher can be issued.
                  </p>
                </div>
              </div>

              {eligibility.missingReasons.length > 0 && (
                <div className="bg-white/80 rounded-2xl p-4 border border-amber-200/60 space-y-2 text-xs">
                  <div className="font-bold text-amber-900 uppercase text-[10px]">
                    Items Requiring Attention ({eligibility.missingReasons.length}):
                  </div>
                  <ul className="space-y-1 text-slate-700">
                    {eligibility.missingReasons.map((mr, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>
                          <strong>{mr.itemName}:</strong> {mr.reasons.join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-emerald-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-200/60 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-tight text-emerald-950">
                    Voucher Status: Ready to Generate & Dispatch
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    All {eligibility.confirmedItems} service items are fully confirmed with verified supplier allocations.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerateVoucher(Boolean(latestVoucher))}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  {latestVoucher ? 'Regenerate Voucher (New Snapshot)' : 'Generate Official Voucher'}
                </button>
              </div>
            </div>
          )}

          {/* If voucher exists, show latest voucher viewer */}
          {latestVoucher && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Current Active Voucher ({latestVoucher.voucherNumber})
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Version: <strong>v{latestVoucher.version || 1}</strong> • Issued {new Date(latestVoucher.issuedAt || latestVoucher.generatedAt!).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <VoucherDocumentView
                voucher={latestVoucher}
                isOutdated={latestVoucher.isOutdated}
                onRegenerate={() => handleGenerateVoucher(true)}
              />
            </div>
          )}

          {/* Previous Versions History */}
          {vouchers.length > 1 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-teal-600" />
                Voucher Version Audit History ({vouchers.length})
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {vouchers.map((v, idx) => (
                  <div key={v.id || idx} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">
                        {v.voucherNumber} <span className="text-slate-400 font-normal">v{v.version || 1}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Issued on {new Date(v.issuedAt || v.generatedAt!).toLocaleString()} by {v.generatedByName || 'Operations'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedVoucherForView(v);
                        setIsVoucherViewerOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                    >
                      Inspect Snapshot
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MANUAL INVOICE UPLOAD & OPERATIONS */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Manual Invoices & Financial Documents
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  Strictly Manual Upload Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload supplier invoices, proforma, or tax bills manually. The system never generates invoices automatically.
              </p>
            </div>

            <button
              onClick={() => {
                setInvoiceAssociation('BOOKING');
                setIsInvoiceUploadModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#008f77] hover:bg-[#007b66] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Invoice
            </button>
          </div>

          {uploadedInvoices.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-sm font-black text-slate-800">No Invoices Uploaded Yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No invoices have been uploaded for this booking. Click the button above to upload supplier invoices, commercial invoices, or proforma documents manually.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Invoice Type & No</th>
                    <th className="px-4 py-3">Association</th>
                    <th className="px-4 py-3">Amount & Currency</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">File Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uploadedInvoices.map((inv, idx) => (
                    <tr key={inv.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{inv.invoiceNumber}</div>
                        <div className="text-[11px] text-teal-700 font-medium">{inv.invoiceType}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                          {inv.associationType === 'SERVICE_ITEM' ? (inv.serviceItemName || 'Service Item') : 'Complete Booking'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {inv.currency} {inv.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-slate-600">
                        <div>Inv: {inv.invoiceDate}</div>
                        {inv.dueDate && <div className="text-amber-800">Due: {inv.dueDate}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{inv.uploadedFileName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          By {inv.uploadedByName || 'Ops'} on {new Date(inv.uploadedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          inv.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          inv.status === 'REPLACED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          inv.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-teal-50 text-teal-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedInvoiceForView(inv);
                              setIsViewInvoiceModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="View Document & Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {inv.uploadedFile && (
                            <a
                              href={inv.uploadedFile}
                              download={inv.uploadedFileName}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {inv.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => {
                                setTargetInvoiceForAction(inv);
                                setIsArchiveModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Archive Invoice"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: DISPATCH DOCUMENTS (Consolidated) */}
      {activeTab === 'DOCUMENTS' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              Consolidated Dispatch & Operational Documents
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              All validated operational dispatch files, vouchers, payment proofs, and passenger manifests.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Voucher Card */}
            <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-teal-800">Ground Voucher</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                  {latestVoucher ? `v${latestVoucher.version || 1}` : 'Pending'}
                </span>
              </div>
              <div className="font-black text-slate-900 text-sm">
                {latestVoucher ? latestVoucher.voucherNumber : 'Not Yet Generated'}
              </div>
              <p className="text-xs text-slate-600">
                {latestVoucher ? 'Official voucher with verified items.' : 'Confirm all items to unlock.'}
              </p>
              {latestVoucher && (
                <button
                  onClick={() => {
                    setSelectedVoucherForView(latestVoucher);
                    setIsVoucherViewerOpen(true);
                  }}
                  className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> View Voucher Document
                </button>
              )}
            </div>

            {/* Uploaded Invoices Card */}
            <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-blue-800">Manual Invoices</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {uploadedInvoices.length} Files
                </span>
              </div>
              <div className="font-black text-slate-900 text-sm">
                Supplier & Commercial Invoices
              </div>
              <p className="text-xs text-slate-600">
                Uploaded manually by operations staff for bookkeeping and settlements.
              </p>
              <button
                onClick={() => setActiveTab('INVOICES')}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" /> Manage Invoices
              </button>
            </div>

            {/* Passenger Manifest Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500">Passenger Manifest</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {booking.passengers?.length || 0} Travelers
                </span>
              </div>
              <div className="font-black text-slate-900 text-sm">
                Traveler Passports & Visas
              </div>
              <p className="text-xs text-slate-600">
                Identifications matching airport and ground check-in regulations.
              </p>
              <div className="text-[11px] text-slate-500">
                Lead: {booking.customer?.leadTravelerName || 'Primary Guest'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: ACTIVITY TIMELINE AUDIT */}
      {activeTab === 'TIMELINE' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-teal-600" />
              Connected Operations Activity Timeline & Audit Log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive chronological record of all service modifications, allocations, price adjustments, vouchers, and uploads.
            </p>
          </div>

          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6">No operational events recorded yet.</p>
            ) : (
              activities.map((act, idx) => (
                <div key={act.eventId || idx} className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-700 shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900">
                        {act.eventType ? act.eventType.replace(/_/g, ' ') : 'Operational Event'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(act.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700">{act.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>Actor: <strong>{act.actorName || 'System'}</strong></span>
                      {act.serviceItemName && <span>Service: {act.serviceItemName}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* MODAL 1: SUPPLIER ALLOCATION */}
      {isAllocateModalOpen && allocTargetItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-600" />
                Supplier Allocation: {allocTargetItem.productName}
              </h3>
              <button 
                onClick={() => setIsAllocateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAllocation} className="space-y-4 text-xs">
              {/* Master Directory Supplier Controlled Dropdown */}
              <div className="p-3.5 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-700" />
                    Select Supplier from Master Directory (Account Management)
                  </label>
                  <span className="text-[10px] font-bold text-teal-700">
                    {masterSuppliers.length} Verified Partners
                  </span>
                </div>

                <select
                  value={selectedMasterSupplierId}
                  onChange={e => handleSelectMasterSupplier(e.target.value)}
                  disabled={isManualSupplierException}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-teal-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                >
                  <option value="">-- Choose Verified Supplier Partner --</option>
                  {masterSuppliers.map((s: Supplier) => (
                    <option key={s.id} value={s.id}>
                      [{s.supplierCode}] {s.name} • {s.destination} ({s.categories?.join(', ')})
                    </option>
                  ))}
                </select>

                {/* Exception Workflow Toggle */}
                <div className="pt-2 border-t border-teal-100 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isManualSupplierException}
                      onChange={e => {
                        const checked = e.target.checked;
                        setIsManualSupplierException(checked);
                        if (checked) {
                          setSelectedMasterSupplierId('');
                        }
                      }}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-[11px] font-bold text-slate-700">
                      Temporary Manual Supplier Exception (Unlisted partner)
                    </span>
                  </label>

                  {selectedMasterSupplierId && (
                    <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 font-black text-[10px]">
                      ✓ Directory Controlled
                    </span>
                  )}
                </div>

                {isManualSupplierException && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Manual Reference Exception Approval Required
                    </div>
                    <p className="text-[10px] text-amber-700 leading-snug">
                      Direct text entry is only permitted for temporary operational exceptions. Enter the mandatory audit reason below.
                    </p>
                    <input
                      type="text"
                      required={isManualSupplierException}
                      value={manualSupplierReason}
                      onChange={e => setManualSupplierReason(e.target.value)}
                      placeholder="e.g., One-off remote boat charter; supplier vetting form in progress."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Quick Roster Selector for ground guides/drivers */}
              {roster.length > 0 && !isManualSupplierException && (
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">
                    Or Quick-Select From Ground Resource Roster (Guides/Chauffeurs)
                  </label>
                  <select
                    onChange={e => handleSelectRosterResource(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Select partner / guide / driver from roster --</option>
                    {roster.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.type} - {r.city || 'Japan Network'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Allocated Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    readOnly={!isManualSupplierException && !!selectedMasterSupplierId}
                    value={allocSupplierName}
                    onChange={e => setAllocSupplierName(e.target.value)}
                    placeholder="Select from Master Directory above"
                    className={`w-full px-3 py-2 rounded-xl border text-xs mt-1 ${
                      !isManualSupplierException && selectedMasterSupplierId
                        ? 'bg-slate-100 text-slate-800 border-slate-200 font-bold'
                        : 'bg-slate-50 border-slate-200 focus:outline-none focus:border-teal-500'
                    }`}
                  />
                  {!isManualSupplierException && !selectedMasterSupplierId && !allocSupplierName && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      Please select a partner from the Master Directory dropdown above.
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Category</label>
                  <select
                    value={allocSupplierType}
                    onChange={e => setAllocSupplierType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
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
                  <label className="text-[10px] font-bold uppercase text-slate-500">Phone</label>
                  <input
                    type="text"
                    value={allocSupplierPhone}
                    onChange={e => setAllocSupplierPhone(e.target.value)}
                    placeholder="+81 3 5555 0192"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Email</label>
                  <input
                    type="email"
                    value={allocSupplierEmail}
                    onChange={e => setAllocSupplierEmail(e.target.value)}
                    placeholder="dispatch@groundpartner.jp"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Confirmation Ref</label>
                  <input
                    type="text"
                    value={allocConfirmationRef}
                    onChange={e => setAllocConfirmationRef(e.target.value)}
                    placeholder="e.g., CONF-JP-8921"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1 font-mono font-bold text-teal-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Payment Cut-off Date</label>
                  <input
                    type="date"
                    value={allocPaymentCutoffDate}
                    onChange={e => setAllocPaymentCutoffDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Service Date</label>
                  <input
                    type="date"
                    value={allocServiceDate}
                    onChange={e => setAllocServiceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Service Time & Timezone</label>
                  <input
                    type="text"
                    value={allocServiceTime}
                    onChange={e => setAllocServiceTime(e.target.value)}
                    placeholder="09:00 AM"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Operational Notes</label>
                <textarea
                  rows={2}
                  value={allocSupplierNotes}
                  onChange={e => setAllocSupplierNotes(e.target.value)}
                  placeholder="Notes for driver / guide / hotel check-in desk..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {allocTargetItem.supplierName ? (
                  <button
                    type="button"
                    onClick={handleUnallocateSupplierInModal}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center gap-1"
                  >
                    Unallocate Supplier
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAllocateModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Save Supplier Allocation
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SUPPLIER PRICING EDIT */}
      {isPriceModalOpen && priceTargetItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-teal-600" />
                Edit Supplier Commercial Price
              </h3>
              <button 
                onClick={() => setIsPriceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupplierPrice} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Target Service Item</div>
                <div className="font-black text-slate-900 text-xs mt-0.5">{priceTargetItem.productName}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Current Price: <strong>{priceTargetItem.supplierPrice !== undefined ? `${priceTargetItem.supplierCurrency} ${priceTargetItem.supplierPrice}` : 'None'}</strong>
                </div>
              </div>

              {priceErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>{priceErrorMessage}</div>
                </div>
              )}

              {priceTargetItem.supplierConfirmationStatus === 'Confirmed' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Warning: Item is Confirmed
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Altering the commercial rate after supplier confirmation will invalidate the confirmation and mark the item as <strong>Supplier Reconfirmation Required</strong>.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer pt-1 font-bold text-slate-900">
                    <input
                      type="checkbox"
                      checked={priceWarningConfirmed}
                      onChange={e => setPriceWarningConfirmed(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>I understand and authorize supplier reconfirmation</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newSupplierPrice}
                    onChange={e => setNewSupplierPrice(e.target.value)}
                    placeholder="e.g. 450.00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-900 focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Currency</label>
                  <select
                    value={newSupplierCurrency}
                    onChange={e => setNewSupplierCurrency(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1 font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="INR">INR</option>
                    <option value="AUD">AUD</option>
                    <option value="SGD">SGD</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Price Type *</label>
                <select
                  value={newSupplierPriceType}
                  onChange={e => setNewSupplierPriceType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                >
                  <option value="Total Service Price">Total Service Price</option>
                  <option value="Per Passenger">Per Passenger</option>
                  <option value="Per Room">Per Room</option>
                  <option value="Per Vehicle">Per Vehicle</option>
                  <option value="Per Group">Per Group</option>
                  <option value="Per Unit">Per Unit</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Reason for Price Adjustment</label>
                <input
                  type="text"
                  value={priceChangeReason}
                  onChange={e => setPriceChangeReason(e.target.value)}
                  placeholder="e.g., Seasonal surcharge applied / negotiated rate"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                />
              </div>

              {/* Version History snippet */}
              {priceTargetItem.supplierPriceHistory && priceTargetItem.supplierPriceHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Previous Versions</div>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-slate-500">
                    {priceTargetItem.supplierPriceHistory.map((h, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span>v{h.version}: {h.currency} {h.newPrice} ({h.priceType})</span>
                        <span className="text-[10px] text-slate-400">{new Date(h.updatedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPriceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={priceTargetItem.supplierConfirmationStatus === 'Confirmed' && !priceWarningConfirmed}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    priceTargetItem.supplierConfirmationStatus === 'Confirmed' && !priceWarningConfirmed
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-teal-600 hover:bg-teal-500 text-white'
                  }`}
                >
                  Save Commercial Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: INVOICE UPLOAD (MANUAL ONLY) */}
      {isInvoiceUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-teal-600" />
                  Manual Invoice Upload Desk
                </h3>
                <p className="text-[11px] text-slate-400">
                  Attach supplier invoices, proforma receipts, or commercial tax invoices.
                </p>
              </div>
              <button 
                onClick={() => setIsInvoiceUploadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInvoiceUpload} className="space-y-4 text-xs">
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>{uploadError}</div>
                </div>
              )}

              {/* Invoice Type & Association */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Invoice Type *</label>
                  <select
                    value={invoiceType}
                    onChange={e => setInvoiceType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  >
                    <option value="Supplier Invoice">Supplier Invoice</option>
                    <option value="Proforma Invoice">Proforma Invoice</option>
                    <option value="Tax Invoice">Tax Invoice</option>
                    <option value="Commercial Invoice">Commercial Invoice</option>
                    <option value="Other authorised invoice type">Other Authorised Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Association Scope *</label>
                  <select
                    value={invoiceAssociation}
                    onChange={e => setInvoiceAssociation(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  >
                    <option value="BOOKING">Complete Booking</option>
                    <option value="SERVICE_ITEM">Specific Service Item</option>
                    <option value="SUPPLIER">Specific Supplier</option>
                  </select>
                </div>
              </div>

              {/* If Service Item association selected */}
              {invoiceAssociation === 'SERVICE_ITEM' && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Select Service Item *</label>
                  <select
                    required
                    value={invoiceAssociatedItemId}
                    onChange={e => setInvoiceAssociatedItemId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  >
                    <option value="" disabled>-- Select service item --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        {it.productName} ({it.supplierName || 'Unallocated'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Number, Dates, Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Invoice Number *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g., INV-SUPP-9812"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Invoice Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={invoiceAmount}
                    onChange={e => setInvoiceAmount(e.target.value)}
                    placeholder="e.g., 1250.00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Currency</label>
                  <select
                    value={invoiceCurrency}
                    onChange={e => setInvoiceCurrency(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1 font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                    <option value="INR">INR</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>

              {/* File Drag-and-Drop & Picker */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-teal-500 transition-colors text-center space-y-2 bg-slate-50/50">
                <UploadCloud className="w-8 h-8 text-teal-600 mx-auto" />
                <div className="text-xs font-bold text-slate-800">
                  {uploadedFileName ? (
                    <span className="text-teal-700 font-black">{uploadedFileName}</span>
                  ) : (
                    'Click to select or drag and drop invoice document'
                  )}
                </div>
                <p className="text-[10px] text-slate-400">PDF, PNG, JPG, or DOCX (up to 10MB)</p>
                <input
                  type="file"
                  id="manualInvoiceFileInput"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('manualInvoiceFileInput')?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Choose Document File
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Operational Notes</label>
                <textarea
                  rows={2}
                  value={invoiceNotes}
                  onChange={e => setInvoiceNotes(e.target.value)}
                  placeholder="Notes regarding tax breakdown, VAT, wire transfer reference..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInvoiceUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer"
                >
                  Confirm & Upload Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: INVOICE DETAILS & VIEWER */}
      {isViewInvoiceModalOpen && selectedInvoiceForView && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  {selectedInvoiceForView.invoiceType}: #{selectedInvoiceForView.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Uploaded by {selectedInvoiceForView.uploadedByName} on {new Date(selectedInvoiceForView.uploadedAt).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={() => setIsViewInvoiceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="text-base font-black text-slate-900">
                  {selectedInvoiceForView.currency} {selectedInvoiceForView.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Scope:</span>
                <span className="font-bold text-slate-800">
                  {selectedInvoiceForView.associationType === 'SERVICE_ITEM' 
                    ? `Service Item: ${selectedInvoiceForView.serviceItemName || 'Assigned Item'}` 
                    : 'Complete Booking'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Document File:</span>
                <span className="font-mono text-slate-800 font-bold">{selectedInvoiceForView.uploadedFileName}</span>
              </div>
              {selectedInvoiceForView.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block">Notes:</span>
                  <p className="text-slate-700 whitespace-pre-line mt-0.5">{selectedInvoiceForView.notes}</p>
                </div>
              )}
            </div>

            {/* Document Preview / Download */}
            {selectedInvoiceForView.uploadedFile ? (
              <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-teal-950 font-bold">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Document file is attached</span>
                </div>
                <a
                  href={selectedInvoiceForView.uploadedFile}
                  download={selectedInvoiceForView.uploadedFileName}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download File
                </a>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No document binary preview available.</p>
            )}

            {/* Add note section */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">Add Operational Audit Note</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInvoiceNoteText}
                  onChange={e => setNewInvoiceNoteText(e.target.value)}
                  placeholder="Record wire payment, reconciliation, or verification note..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (selectedInvoiceForView && newInvoiceNoteText.trim()) {
                      db.addInvoiceNote(selectedInvoiceForView.id, newInvoiceNoteText.trim(), currentUser);
                      setNewInvoiceNoteText('');
                      onRefresh();
                      setIsViewInvoiceModalOpen(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  Post Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ARCHIVE INVOICE CONFIRMATION */}
      {isArchiveModalOpen && targetInvoiceForAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-rose-700 flex items-center gap-2">
              <Archive className="w-4 h-4 text-rose-600" />
              Archive Invoice Document
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to archive invoice <strong>{targetInvoiceForAction.invoiceNumber}</strong>?
            </p>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Reason for Archiving</label>
              <input
                type="text"
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                placeholder="e.g., Supceded by revised supplier tax invoice"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-rose-500 mt-1"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsArchiveModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveInvoice}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Archive Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: FULL VOUCHER VIEWER MODAL */}
      {isVoucherViewerOpen && selectedVoucherForView && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full my-8">
            <VoucherDocumentView
              voucher={selectedVoucherForView}
              isOutdated={selectedVoucherForView.isOutdated}
              onClose={() => setIsVoucherViewerOpen(false)}
              onRegenerate={() => {
                setIsVoucherViewerOpen(false);
                handleGenerateVoucher(true);
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL 7: ADD SERVICE ITEM */}
      {isAddItemModalOpen && (
        <AddServiceItemModal
          isOpen={isAddItemModalOpen}
          onClose={() => setIsAddItemModalOpen(false)}
          booking={booking}
          currentUser={currentUser}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* MODAL 8: EDIT SERVICE ITEM */}
      {isEditItemModalOpen && targetItemForEdit && (
        <EditServiceItemModal
          isOpen={isEditItemModalOpen}
          onClose={() => {
            setIsEditItemModalOpen(false);
            setTargetItemForEdit(null);
          }}
          booking={booking}
          item={targetItemForEdit}
          currentUser={currentUser}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* MODAL 9: REPLACE PRODUCT */}
      {isReplaceModalOpen && targetItemForReplace && (
        <ReplaceProductModal
          isOpen={isReplaceModalOpen}
          onClose={() => {
            setIsReplaceModalOpen(false);
            setTargetItemForReplace(null);
          }}
          booking={booking}
          item={targetItemForReplace}
          currentUser={currentUser}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* MODAL 10: CANCEL SERVICE ITEM */}
      {isCancelModalOpen && targetItemForCancel && (
        <CancelServiceItemModal
          isOpen={isCancelModalOpen}
          onClose={() => {
            setIsCancelModalOpen(false);
            setTargetItemForCancel(null);
          }}
          booking={booking}
          item={targetItemForCancel}
          currentUser={currentUser}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* MODAL 11: AUTHORISED CONFIRMATION OVERRIDE */}
      {isOverrideModalOpen && (
        <ConfirmationOverrideModal
          isOpen={isOverrideModalOpen}
          onClose={() => setIsOverrideModalOpen(false)}
          booking={booking}
          currentUser={currentUser}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
