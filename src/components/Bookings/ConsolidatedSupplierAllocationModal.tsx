import React, { useMemo, useState, useEffect } from 'react';
import {
  Booking,
  BookingItem,
  ConsolidatedAllocationDocument,
  ConsolidatedPriceAllocationMethod,
  Hotel,
  Product,
  Supplier,
  SupplierAllocationRecord,
  SupplierAllocationStatus,
  User
} from '../../types';
import { AppDatabase } from '../../services/db';
import { auth as firebaseAuth } from '../../services/firebase';
import { formatCurrency } from '../../services/pricingEngine';
import {
  HydratedBookingServiceItem,
  hydrateBookingServiceItem,
  CANONICAL_ALLOCATION_STATUSES
} from '../../services/bookingOperationsSyncService';
import {
  distributeConsolidatedCommercialPrice,
  validateConsolidatedCurrency,
  validateSupplierEligibilityForItems,
  roundCurrency
} from '../../services/supplierAllocationEngine';
import {
  X,
  Building2,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  MapPin,
  Users,
  ShieldAlert,
  DollarSign,
  FileText,
  History,
  Trash2,
  Plus,
  ExternalLink,
  Car,
  Info
} from 'lucide-react';

async function getFirebaseBearerToken(): Promise<string | null> {
  try {
    const current = firebaseAuth?.currentUser;
    if (!current) return null;
    return await current.getIdToken();
  } catch {
    return null;
  }
}

interface ConsolidatedSupplierAllocationModalProps {
  isOpen: boolean;
  mode: 'CREATE' | 'DETAIL';
  booking: Booking;
  selectedItemIds?: string[];
  existingAllocation?: SupplierAllocationRecord | null;
  currentUser: User | null;
  onClose: () => void;
  onSuccess: () => void;
  onRemoveSelectedItem?: (itemId: string) => void;
}

const PARENT_STATUS_OPTIONS: Array<{ value: SupplierAllocationRecord['status']; label: string }> = [
  { value: 'ALLOCATED', label: 'Allocated (Supplier Selected)' },
  { value: 'SENT_TO_SUPPLIER', label: 'Sent to Supplier' },
  { value: 'AWAITING_CONFIRMATION', label: 'Awaiting Confirmation' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'AMENDMENT_REQUIRED', label: 'Amendment Required' }
];

export const ConsolidatedSupplierAllocationModal: React.FC<ConsolidatedSupplierAllocationModalProps> = ({
  isOpen,
  mode,
  booking,
  selectedItemIds = [],
  existingAllocation = null,
  currentUser,
  onClose,
  onSuccess,
  onRemoveSelectedItem
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

  const activeSuppliers = useMemo(() => {
    return db.getSuppliers().filter((s: Supplier) => s.status !== 'ARCHIVED');
  }, [db]);

  const targetItemIds = useMemo(() => {
    if (mode === 'DETAIL' && existingAllocation) {
      return existingAllocation.serviceItemIds || (existingAllocation.serviceItemId ? [existingAllocation.serviceItemId] : []);
    }
    return selectedItemIds;
  }, [mode, existingAllocation, selectedItemIds]);

  const targetRawItems: BookingItem[] = useMemo(() => {
    const idSet = new Set(targetItemIds);
    return (booking.items || []).filter(it => idSet.has(it.id));
  }, [booking.items, targetItemIds]);

  const hydratedItems: HydratedBookingServiceItem[] = useMemo(() => {
    return targetRawItems.map(it =>
      hydrateBookingServiceItem(
        it,
        booking,
        it.productId ? productMap.get(it.productId) || null : null,
        (it.hotelId || it.productId) ? hotelMap.get(it.hotelId || it.productId) || null : null
      )
    );
  }, [targetRawItems, booking, productMap, hotelMap]);

  // CREATE MODE STATE
  const [supplierId, setSupplierId] = useState('');
  const [commercialPriceInput, setCommercialPriceInput] = useState('');
  const [allocationMethod, setAllocationMethod] = useState<ConsolidatedPriceAllocationMethod>('PROPORTIONAL_NET_COST');
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
  const [parentStatus, setParentStatus] = useState<SupplierAllocationRecord['status']>('ALLOCATED');
  const [confirmationRef, setConfirmationRef] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [supportingDocs, setSupportingDocs] = useState<ConsolidatedAllocationDocument[]>([]);
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [idempotencyKey] = useState(() => `csa-idem-${booking.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // DETAIL MODE STATE
  const [itemStatusDrafts, setItemStatusDrafts] = useState<Record<string, SupplierAllocationStatus>>({});
  const [itemRefDrafts, setItemRefDrafts] = useState<Record<string, string>>({});
  const [applyParentStatusToAll, setApplyParentStatusToAll] = useState(false);
  const [updateNote, setUpdateNote] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // UI STATE
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync Detail mode initial values
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setShowCancelConfirm(false);
    setCancelReason('');
    setUpdateNote('');
    setApplyParentStatusToAll(false);

    if (mode === 'DETAIL' && existingAllocation) {
      setSupplierId(existingAllocation.supplierId || '');
      setParentStatus(existingAllocation.status || 'ALLOCATED');
      setConfirmationRef(existingAllocation.confirmationRef || '');
      setSupplierNotes(existingAllocation.supplierNotes || '');
      setInternalNotes(existingAllocation.internalNotes || '');
      setSupportingDocs(existingAllocation.supportingDocuments || []);

      const stDraft: Record<string, SupplierAllocationStatus> = {};
      const refDraft: Record<string, string> = {};
      (existingAllocation.itemAllocations || []).forEach(ia => {
        stDraft[ia.serviceItemId] = ia.confirmationStatus;
        refDraft[ia.serviceItemId] = ia.itemConfirmationRef || '';
      });
      setItemStatusDrafts(stDraft);
      setItemRefDrafts(refDraft);
    } else if (mode === 'CREATE') {
      const initialTotalNet = hydratedItems.reduce((sum, it) => sum + (it.resolvedNetPrice || 0), 0);
      if (!commercialPriceInput && initialTotalNet > 0) {
        setCommercialPriceInput(String(roundCurrency(initialTotalNet)));
      }
    }
  }, [isOpen, mode, existingAllocation]);

  const selectedSupplier = useMemo(
    () => activeSuppliers.find(s => s.id === supplierId) || null,
    [activeSuppliers, supplierId]
  );

  // Currency mismatch validation
  const currencyValidation = useMemo(() => {
    return validateConsolidatedCurrency(targetRawItems, booking, productMap, hotelMap);
  }, [targetRawItems, booking, productMap, hotelMap]);

  // Supplier-Category eligibility validation
  const supplierEligibility = useMemo(() => {
    if (!selectedSupplier) return null;
    return validateSupplierEligibilityForItems(selectedSupplier, targetRawItems, productMap, hotelMap);
  }, [selectedSupplier, targetRawItems, productMap, hotelMap]);

  // Parsed manual allocations
  const parsedManualAllocations = useMemo(() => {
    const out: Record<string, number> = {};
    targetRawItems.forEach(it => {
      const raw = manualAmounts[it.id];
      out[it.id] = raw !== undefined && raw !== '' ? Number(raw) : 0;
    });
    return out;
  }, [targetRawItems, manualAmounts]);

  // Live distribution & margin preview (CREATE mode)
  const liveDistribution = useMemo(() => {
    const priceNum = Number(commercialPriceInput);
    return distributeConsolidatedCommercialPrice({
      items: targetRawItems,
      booking,
      productMap,
      hotelMap,
      consolidatedCommercialPrice: Number.isFinite(priceNum) ? priceNum : 0,
      allocationMethod,
      manualAllocations: allocationMethod === 'MANUAL' ? parsedManualAllocations : undefined
    });
  }, [targetRawItems, booking, productMap, hotelMap, commercialPriceInput, allocationMethod, parsedManualAllocations]);

  const toggleExpandItem = (id: string) => {
    setExpandedItemIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSeedManualFromProportional = () => {
    const prop = distributeConsolidatedCommercialPrice({
      items: targetRawItems,
      booking,
      productMap,
      hotelMap,
      consolidatedCommercialPrice: Number(commercialPriceInput) || 0,
      allocationMethod: 'PROPORTIONAL_NET_COST'
    });
    const next: Record<string, string> = {};
    prop.itemAllocations.forEach(a => {
      next[a.serviceItemId] = a.allocatedCommercialPrice.toFixed(2);
    });
    setManualAmounts(next);
  };

  const handleAddSupportingDoc = () => {
    if (!newDocName.trim()) return;
    setSupportingDocs(prev => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        name: newDocName.trim(),
        url: newDocUrl.trim() || undefined,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser?.displayName || currentUser?.name || 'Operations'
      }
    ]);
    setNewDocName('');
    setNewDocUrl('');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (targetRawItems.length === 0) {
      setErrorMessage('Select at least one Service Item to create a consolidated allocation.');
      return;
    }
    if (!selectedSupplier) {
      setErrorMessage('Select an active supplier from Supplier Management.');
      return;
    }
    if (supplierEligibility && !supplierEligibility.eligible) {
      setErrorMessage('Selected supplier is incompatible with one or more Service Items. Review the eligibility warning below.');
      return;
    }
    if (!currencyValidation.valid) {
      setErrorMessage(currencyValidation.error || 'Currency mismatch across selected items.');
      return;
    }
    if (!liveDistribution.valid) {
      setErrorMessage(liveDistribution.errors.join(' '));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        bookingId: booking.id,
        serviceItemIds: targetRawItems.map(i => i.id),
        supplierId: selectedSupplier.id,
        consolidatedCommercialPrice: liveDistribution.consolidatedCommercialPrice,
        allocationMethod,
        manualAllocations: allocationMethod === 'MANUAL' ? parsedManualAllocations : undefined,
        status: parentStatus,
        confirmationRef: confirmationRef.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        supplierNotes: supplierNotes.trim() || undefined,
        supportingDocuments: supportingDocs,
        idempotencyKey
      };

      const token = await getFirebaseBearerToken();
      if (token) {
        const res = await fetch('/api/admin/supplier-allocations/consolidated', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.allocation) {
          db.syncConsolidatedAllocationFromServer(data.allocation, data.booking);
          onSuccess();
          onClose();
          return;
        }
        // Only fall back to local db if server is unavailable (503/network); surface explicit 4xx validation errors!
        if (res.status >= 400 && res.status < 500) {
          setErrorMessage(data.error || 'Consolidated allocation validation failed on server.');
          return;
        }
      }

      const localRes = db.createConsolidatedSupplierAllocation(payload, currentUser);
      if (!localRes.success) {
        setErrorMessage(localRes.error || 'Failed to create consolidated supplier allocation.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const localRes = db.createConsolidatedSupplierAllocation(
        {
          bookingId: booking.id,
          serviceItemIds: targetRawItems.map(i => i.id),
          supplierId: selectedSupplier.id,
          consolidatedCommercialPrice: liveDistribution.consolidatedCommercialPrice,
          allocationMethod,
          manualAllocations: allocationMethod === 'MANUAL' ? parsedManualAllocations : undefined,
          status: parentStatus,
          confirmationRef: confirmationRef.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
          supplierNotes: supplierNotes.trim() || undefined,
          supportingDocuments: supportingDocs,
          idempotencyKey
        },
        currentUser
      );
      if (!localRes.success) {
        setErrorMessage(localRes.error || err?.message || 'Failed to save consolidated allocation.');
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetailUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingAllocation) return;
    setErrorMessage(null);
    setSubmitting(true);

    const itemUpdates = (existingAllocation.itemAllocations || []).map(ia => ({
      serviceItemId: ia.serviceItemId,
      confirmationStatus: itemStatusDrafts[ia.serviceItemId] || ia.confirmationStatus,
      itemConfirmationRef: itemRefDrafts[ia.serviceItemId] ?? ia.itemConfirmationRef
    }));

    const payload = {
      expectedVersion: existingAllocation.version || 1,
      status: parentStatus,
      confirmationRef: confirmationRef.trim(),
      internalNotes: internalNotes.trim(),
      supplierNotes: supplierNotes.trim(),
      supportingDocuments: supportingDocs,
      itemUpdates,
      applyStatusToAllItems: applyParentStatusToAll,
      note: updateNote.trim() || undefined
    };

    try {
      const token = await getFirebaseBearerToken();
      if (token) {
        const res = await fetch(`/api/admin/supplier-allocations/${encodeURIComponent(existingAllocation.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.allocation) {
          db.syncConsolidatedAllocationFromServer(data.allocation, data.booking);
          onSuccess();
          onClose();
          return;
        }
        if (res.status >= 400 && res.status < 500) {
          setErrorMessage(data.error || 'Failed to update consolidated allocation.');
          return;
        }
      }

      const localRes = db.updateConsolidatedSupplierAllocation(existingAllocation.id, payload, currentUser);
      if (!localRes.success) {
        setErrorMessage(localRes.error || 'Failed to update consolidated allocation.');
        return;
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const localRes = db.updateConsolidatedSupplierAllocation(existingAllocation.id, payload, currentUser);
      if (!localRes.success) {
        setErrorMessage(localRes.error || err?.message || 'Failed to update consolidated allocation.');
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAllocation = async () => {
    if (!existingAllocation) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const token = await getFirebaseBearerToken();
      if (token) {
        const res = await fetch(`/api/admin/supplier-allocations/${encodeURIComponent(existingAllocation.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            expectedVersion: existingAllocation.version || 1,
            status: 'CANCELLED',
            note: cancelReason.trim() || 'Consolidated supplier allocation cancelled by Admin.'
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.allocation) {
          db.syncConsolidatedAllocationFromServer(data.allocation, data.booking);
          onSuccess();
          onClose();
          return;
        }
      }

      const localRes = db.cancelConsolidatedSupplierAllocation(
        existingAllocation.id,
        cancelReason.trim() || 'Consolidated supplier allocation cancelled by Admin.',
        currentUser
      );
      if (!localRes.success) {
        setErrorMessage(localRes.error || 'Failed to cancel consolidated allocation.');
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const displayCurrency = mode === 'DETAIL' && existingAllocation?.currency
    ? existingAllocation.currency
    : liveDistribution.currency || booking.currency || 'USD';

  const summaryNet = mode === 'DETAIL' && existingAllocation
    ? (existingAllocation.totalNetCost ?? 0)
    : liveDistribution.totalNetCost;

  const summaryCommercial = mode === 'DETAIL' && existingAllocation
    ? (existingAllocation.consolidatedCommercialPrice ?? 0)
    : liveDistribution.consolidatedCommercialPrice;

  const summaryMarginAmt = mode === 'DETAIL' && existingAllocation
    ? (existingAllocation.totalMarginAmount ?? roundCurrency(summaryCommercial - summaryNet))
    : liveDistribution.totalMarginAmount;

  const summaryMarginPct = mode === 'DETAIL' && existingAllocation
    ? (existingAllocation.totalMarginPercent ?? (summaryNet > 0 ? roundCurrency((summaryMarginAmt / summaryNet) * 100) : null))
    : liveDistribution.totalMarginPercent;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 my-6 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#008f77]" />
              <h3 className="text-base font-black text-slate-900">
                {mode === 'CREATE'
                  ? 'Create Consolidated Multi-Service Supplier Allocation'
                  : `Consolidated Supplier Allocation • ${existingAllocation?.id}`}
              </h3>
              {mode === 'DETAIL' && existingAllocation && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border bg-teal-50 text-teal-800 border-teal-200">
                  {existingAllocation.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Booking <span className="font-mono font-bold text-slate-800">#{booking.bookingReference}</span> •{' '}
              {hydratedItems.length} Service Item{hydratedItems.length === 1 ? '' : 's'} linked •{' '}
              Individual Service Items remain distinct for operations &amp; vouchers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form
          onSubmit={mode === 'CREATE' ? handleCreateSubmit : handleDetailUpdateSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-xs"
        >
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* 1. AUTO-RETRIEVED BOOKING CONTEXT (READ-ONLY) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#008f77]">
                Auto-Retrieved Booking Information (Authoritative Record)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Currency: <strong>{booking.currency || displayCurrency}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/70">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Booking Ref</span>
                <strong className="text-slate-900 font-mono">{booking.bookingReference}</strong>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/70">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Lead Traveller</span>
                <strong className="text-slate-900">{booking.customer?.leadTravelerName || booking.customer?.name || 'Guest'}</strong>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/70">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Agency / Client</span>
                <strong className="text-slate-900">{booking.agencyName || booking.customer?.companyName || 'Direct'}</strong>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/70">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Travel Dates</span>
                <strong className="text-slate-900">
                  {booking.travelStartDate || 'TBD'}{booking.travelEndDate ? ` → ${booking.travelEndDate}` : ''}
                </strong>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/70">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Total PAX</span>
                <strong className="text-slate-900">
                  {booking.customer?.totalPax || ((booking.customer?.totalAdults || 0) + (booking.customer?.totalChildren || 0)) || 1} PAX
                </strong>
              </div>
            </div>
          </div>

          {/* 2. SUPPLIER SELECTION & ELIGIBILITY VALIDATION */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#008f77]" />
                {mode === 'CREATE' ? 'Select Supplier & Verify Category Eligibility' : 'Assigned Supplier & Parent Status'}
              </h4>
              {mode === 'DETAIL' && existingAllocation && (
                <span className="text-[11px] font-bold text-slate-700">
                  {existingAllocation.supplierNameSnapshot}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {mode === 'CREATE' ? (
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Active Supplier (from Supplier Management) *
                  </label>
                  <select
                    required
                    value={supplierId}
                    onChange={e => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 mt-1 focus:outline-none focus:border-[#008f77]"
                  >
                    <option value="">-- Choose Eligible Supplier Partner --</option>
                    {activeSuppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({(s.categories || []).join(', ') || 'General'} • {s.city || s.destination || 'Global'}) [{s.status}]
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Partner</label>
                  <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 mt-1">
                    {existingAllocation?.supplierNameSnapshot}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Parent Allocation Status</label>
                <select
                  value={parentStatus}
                  onChange={e => setParentStatus(e.target.value as SupplierAllocationRecord['status'])}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 mt-1 focus:outline-none focus:border-[#008f77]"
                >
                  {PARENT_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {mode === 'DETAIL' && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Parent Confirmation Ref</label>
                  <input
                    type="text"
                    value={confirmationRef}
                    onChange={e => setConfirmationRef(e.target.value)}
                    placeholder="e.g. SUP-CONSOL-2026-991"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-[#008f77] mt-1 focus:outline-none focus:border-[#008f77]"
                  />
                </div>
              )}
            </div>

            {mode === 'CREATE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Parent Supplier Confirmation Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={confirmationRef}
                    onChange={e => setConfirmationRef(e.target.value)}
                    placeholder="e.g. SUP-CONSOL-2026-991"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-[#008f77] mt-1 focus:outline-none focus:border-[#008f77]"
                  />
                </div>
                <div className="flex items-end">
                  {supplierEligibility && (
                    supplierEligibility.eligible ? (
                      <div className="w-full p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-[11px] font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Eligible for all {hydratedItems.length} selected Service Item{hydratedItems.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-[11px] font-bold">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          Ineligible Supplier — {supplierEligibility.incompatibleItems.length} incompatible item(s)
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Detailed Eligibility Warnings */}
            {mode === 'CREATE' && supplierEligibility && !supplierEligibility.eligible && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                <div className="text-[11px] font-black text-rose-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Supplier-Category Eligibility Blocked
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-800">
                  {supplierEligibility.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Currency Mismatch Blocker */}
            {mode === 'CREATE' && !currencyValidation.valid && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-1">
                <div className="text-[11px] font-black text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Currency Mismatch Detected ({currencyValidation.detectedCurrencies.join(', ')})
                </div>
                <p className="text-[11px] text-amber-800">{currencyValidation.error}</p>
              </div>
            )}
          </div>

          {/* 3. CONSOLIDATED COMMERCIAL PRICING, ALLOCATION METHOD & MARGIN SUMMARY */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#008f77]" />
                Consolidated Commercial Pricing &amp; Internal Margin Breakdown
              </h4>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Internal Admin / Finance View Only • Never Shown to Agents or Customers
              </span>
            </div>

            {/* KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Net Cost</span>
                <span className="text-sm font-black font-mono text-slate-900">
                  {formatCurrency(summaryNet, displayCurrency)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200">
                <span className="text-[10px] font-bold uppercase text-teal-700 block">Consolidated Commercial Price</span>
                <span className="text-sm font-black font-mono text-teal-900">
                  {formatCurrency(summaryCommercial, displayCurrency)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Margin Amount</span>
                <span className={`text-sm font-black font-mono ${summaryMarginAmt >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {formatCurrency(summaryMarginAmt, displayCurrency)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Margin %</span>
                <span className={`text-sm font-black font-mono ${(summaryMarginPct ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {summaryMarginPct !== null ? `${summaryMarginPct.toFixed(2)}%` : '—'}
                </span>
              </div>
            </div>

            {mode === 'CREATE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Consolidated Supplier Commercial Price ({displayCurrency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={commercialPriceInput}
                    onChange={e => setCommercialPriceInput(e.target.value)}
                    placeholder="Enter agreed consolidated commercial total..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-black text-slate-900 mt-1 focus:outline-none focus:border-[#008f77]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Price Distribution Method *
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setAllocationMethod('PROPORTIONAL_NET_COST')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        allocationMethod === 'PROPORTIONAL_NET_COST'
                          ? 'bg-[#008f77] text-white border-[#008f77] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Proportional (by Net Cost)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAllocationMethod('MANUAL');
                        if (Object.keys(manualAmounts).length === 0) {
                          handleSeedManualFromProportional();
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        allocationMethod === 'MANUAL'
                          ? 'bg-[#008f77] text-white border-[#008f77] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Manual Allocation
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reconciliation Status Badge */}
            {mode === 'CREATE' && (
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      liveDistribution.reconciliationDelta === 0 && liveDistribution.valid
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    Reconciliation Variance: {formatCurrency(liveDistribution.reconciliationDelta, displayCurrency)}
                  </span>
                  {allocationMethod === 'MANUAL' && (
                    <button
                      type="button"
                      onClick={handleSeedManualFromProportional}
                      className="text-[11px] font-bold text-[#008f77] hover:underline cursor-pointer"
                    >
                      Auto-fill Proportional Baseline
                    </button>
                  )}
                </div>
                {liveDistribution.errors.length > 0 && (
                  <span className="text-[11px] font-semibold text-rose-700">
                    {liveDistribution.errors[0]}
                  </span>
                )}
              </div>
            )}

            {/* Per-Item Distribution & Independent Confirmation Tracking Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <th className="py-2.5 px-3">Service Item (Auto-Synced)</th>
                    <th className="py-2.5 px-3">Date &amp; Hub</th>
                    <th className="py-2.5 px-3 text-right">Net Cost</th>
                    <th className="py-2.5 px-3 text-right">Allocated Commercial</th>
                    <th className="py-2.5 px-3 text-right">Margin</th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                    {mode === 'DETAIL' && <th className="py-2.5 px-3">Item Confirmation &amp; Ref</th>}
                    {mode === 'CREATE' && onRemoveSelectedItem && <th className="py-2.5 px-3 text-right">Remove</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hydratedItems.map(hItem => {
                    const distRow =
                      mode === 'DETAIL' && existingAllocation
                        ? existingAllocation.itemAllocations?.find(a => a.serviceItemId === hItem.id)
                        : liveDistribution.itemAllocations.find(a => a.serviceItemId === hItem.id);
                    const isExpanded = Boolean(expandedItemIds[hItem.id]);

                    return (
                      <React.Fragment key={hItem.id}>
                        <tr className="hover:bg-slate-50/70">
                          <td className="py-3 px-3 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-bold uppercase border border-slate-200">
                                  {hItem.resolvedCategoryLabel}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">{hItem.id}</span>
                              </div>
                              <div className="font-bold text-slate-900">{hItem.productName}</div>
                              <button
                                type="button"
                                onClick={() => toggleExpandItem(hItem.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#008f77] hover:underline cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {isExpanded ? 'Hide Operational Details' : 'Inspect Full Operational Details'}
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div className="font-bold text-slate-800">{hItem.resolvedServiceDate || 'TBD'}</div>
                            <div className="text-[10px] text-slate-500">
                              {[hItem.destination || hItem.destinationName, hItem.hub || hItem.city].filter(Boolean).join(' • ') || '—'}
                            </div>
                            <div className="text-[10px] text-slate-500">{hItem.resolvedPassengerBreakdown}</div>
                          </td>

                          <td className="py-3 px-3 align-top text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {formatCurrency(distRow?.netCost ?? hItem.resolvedNetPrice, displayCurrency)}
                          </td>

                          <td className="py-3 px-3 align-top text-right font-mono whitespace-nowrap">
                            {mode === 'CREATE' && allocationMethod === 'MANUAL' ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={manualAmounts[hItem.id] ?? ''}
                                onChange={e => setManualAmounts(prev => ({ ...prev, [hItem.id]: e.target.value }))}
                                className="w-28 px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 text-right font-mono font-bold text-slate-900 focus:outline-none focus:border-[#008f77]"
                              />
                            ) : (
                              <strong className="text-teal-900">
                                {formatCurrency(distRow?.allocatedCommercialPrice ?? 0, displayCurrency)}
                              </strong>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top text-right font-mono whitespace-nowrap">
                            <div className={`font-bold ${(distRow?.marginAmount ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {formatCurrency(distRow?.marginAmount ?? 0, displayCurrency)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {distRow?.marginPercent !== null && distRow?.marginPercent !== undefined
                                ? `${distRow.marginPercent.toFixed(2)}%`
                                : '—'}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(distRow?.sellingPrice ?? hItem.resolvedSellingPrice, displayCurrency)}
                          </td>

                          {mode === 'DETAIL' && (
                            <td className="py-3 px-3 align-top min-w-[200px]">
                              <div className="space-y-1.5">
                                <select
                                  value={itemStatusDrafts[hItem.id] || distRow?.confirmationStatus || 'Supplier Selected'}
                                  onChange={e =>
                                    setItemStatusDrafts(prev => ({
                                      ...prev,
                                      [hItem.id]: e.target.value as SupplierAllocationStatus
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-800"
                                >
                                  {CANONICAL_ALLOCATION_STATUSES.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={itemRefDrafts[hItem.id] ?? ''}
                                  onChange={e =>
                                    setItemRefDrafts(prev => ({
                                      ...prev,
                                      [hItem.id]: e.target.value
                                    }))
                                  }
                                  placeholder="Item confirmation ref..."
                                  className="w-full px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-[#008f77]"
                                />
                              </div>
                            </td>
                          )}

                          {mode === 'CREATE' && onRemoveSelectedItem && (
                            <td className="py-3 px-3 align-top text-right">
                              <button
                                type="button"
                                onClick={() => onRemoveSelectedItem(hItem.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                                title="Remove from selection"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>

                        {/* Expandable Full Operational Details (Zero Manual Re-Entry) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90">
                            <td colSpan={8} className="p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                                <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                                  <div className="text-[9px] font-black uppercase text-slate-400">Identifiers &amp; Timing</div>
                                  <div><strong>Product ID:</strong> <span className="font-mono">{hItem.productId}</span></div>
                                  <div><strong>Time:</strong> {hItem.resolvedTicketEntryTime || hItem.resolvedPickupTime || hItem.resolvedStartTime || 'Not Set'}{hItem.resolvedTimeZone ? ` (${hItem.resolvedTimeZone})` : ''}</div>
                                  {hItem.duration && <div><strong>Duration:</strong> {hItem.duration}</div>}
                                  <div><strong>PAX:</strong> {hItem.resolvedPassengerBreakdown}</div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                                  <div className="text-[9px] font-black uppercase text-slate-400">Location &amp; Logistics</div>
                                  {hItem.resolvedMeetingPoint && <div><strong>Meeting Point:</strong> {hItem.resolvedMeetingPoint}</div>}
                                  {hItem.resolvedAddress && <div><strong>Address:</strong> {hItem.resolvedAddress}</div>}
                                  {hItem.isTransportService && hItem.resolvedPickupLocation && <div><strong>Pickup:</strong> {hItem.resolvedPickupLocation}</div>}
                                  {hItem.isTransportService && hItem.resolvedDropoffLocation && <div><strong>Drop-off:</strong> {hItem.resolvedDropoffLocation}</div>}
                                  {hItem.isTransportService && hItem.vehicleType && (
                                    <div><strong>Vehicle:</strong> {hItem.vehicleType}{hItem.vehicleSeaterCapacity ? ` (${hItem.vehicleSeaterCapacity} Seats)` : ''}</div>
                                  )}
                                  {!hItem.resolvedMeetingPoint && !hItem.resolvedPickupLocation && !hItem.resolvedAddress && (
                                    <div className="text-slate-400 italic">No location overrides recorded.</div>
                                  )}
                                </div>

                                <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                                  <div className="text-[9px] font-black uppercase text-slate-400">Instructions &amp; Inclusions</div>
                                  {hItem.resolvedImportantInstructions && <div><strong>Instructions:</strong> {hItem.resolvedImportantInstructions}</div>}
                                  {hItem.resolvedInclusions && hItem.resolvedInclusions.length > 0 && (
                                    <div><strong>Inclusions:</strong> {hItem.resolvedInclusions.slice(0, 4).join(', ')}</div>
                                  )}
                                  {hItem.resolvedExclusions && hItem.resolvedExclusions.length > 0 && (
                                    <div><strong>Exclusions:</strong> {hItem.resolvedExclusions.slice(0, 4).join(', ')}</div>
                                  )}
                                </div>
                              </div>

                              {(hItem.resolvedDescription || hItem.resolvedNarrative || hItem.resolvedOverview) && (
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                                  {hItem.resolvedDescription && (
                                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                                      <div className="text-[9px] font-black uppercase text-[#008f77] mb-1">Description</div>
                                      <div className="text-slate-700 whitespace-pre-line">{hItem.resolvedDescription}</div>
                                    </div>
                                  )}
                                  {hItem.resolvedNarrative && (
                                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                                      <div className="text-[9px] font-black uppercase text-[#008f77] mb-1">Narrative</div>
                                      <div className="text-slate-700 whitespace-pre-line">{hItem.resolvedNarrative}</div>
                                    </div>
                                  )}
                                  {hItem.resolvedOverview && (
                                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                                      <div className="text-[9px] font-black uppercase text-[#008f77] mb-1">Overview</div>
                                      <div className="text-slate-700 whitespace-pre-line">{hItem.resolvedOverview}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {mode === 'DETAIL' && (
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={applyParentStatusToAll}
                  onChange={e => setApplyParentStatusToAll(e.target.checked)}
                  className="rounded text-[#008f77] focus:ring-[#008f77]"
                />
                <span>Apply Parent Status &amp; Parent Confirmation Ref to ALL linked Service Items (leave unchecked to preserve independent per-item statuses)</span>
              </label>
            )}
          </div>

          {/* 4. NOTES & SUPPORTING DOCUMENTS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Dispatch / Commercial Notes</label>
              <textarea
                rows={2}
                value={supplierNotes}
                onChange={e => setSupplierNotes(e.target.value)}
                placeholder="Notes shared with supplier reservations desk..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008f77]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Internal Ops / Finance Notes</label>
              <textarea
                rows={2}
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                placeholder="Internal commercial margin rationale or contracting notes..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1 focus:outline-none focus:border-[#008f77]"
              />
            </div>
          </div>

          {/* Supporting Documents */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#008f77]" />
              Supporting Documents ({supportingDocs.length})
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newDocName}
                onChange={e => setNewDocName(e.target.value)}
                placeholder="Document title (e.g. Supplier Rate Confirmation PDF)"
                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs"
              />
              <input
                type="url"
                value={newDocUrl}
                onChange={e => setNewDocUrl(e.target.value)}
                placeholder="Reference URL (optional)"
                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs"
              />
              <button
                type="button"
                onClick={handleAddSupportingDoc}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {supportingDocs.length > 0 && (
              <div className="divide-y divide-slate-200/70 bg-white rounded-xl border border-slate-200 px-3">
                {supportingDocs.map(doc => (
                  <div key={doc.id} className="py-2 flex items-center justify-between gap-2 text-[11px]">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      <span>{doc.name}</span>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#008f77] hover:underline inline-flex items-center gap-0.5"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSupportingDocs(prev => prev.filter(d => d.id !== doc.id))}
                      className="text-rose-500 hover:underline text-[10px] font-bold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DETAIL MODE: Status History & Update Note */}
          {mode === 'DETAIL' && existingAllocation && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Audit Update Note (Optional)</label>
                <input
                  type="text"
                  value={updateNote}
                  onChange={e => setUpdateNote(e.target.value)}
                  placeholder="Describe confirmation update or status change..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs mt-1"
                />
              </div>

              {existingAllocation.statusHistory && existingAllocation.statusHistory.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#008f77]" />
                    Allocation Status History ({existingAllocation.statusHistory.length})
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {existingAllocation.statusHistory.map((h, i) => (
                      <div key={i} className="text-[11px] bg-white p-2 rounded-xl border border-slate-200/70 flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-slate-900">{h.status.replace(/_/g, ' ')}</strong>
                          {h.note && <span className="text-slate-600"> — {h.note}</span>}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {h.actorName} • {new Date(h.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancel / Unlink Confirmation Box */}
              {existingAllocation.status !== 'CANCELLED' && (
                <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-2">
                  {!showCancelConfirm ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-800">
                        Need to dissolve this consolidated allocation and unlink its Service Items?
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        className="px-3 py-1.5 rounded-xl border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                      >
                        Cancel &amp; Unlink Allocation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] font-black text-rose-900">
                        Confirm Cancellation of Consolidated Allocation {existingAllocation.id}
                      </div>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        placeholder="Reason for cancellation / unlinking..."
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-xs"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(false)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-white cursor-pointer"
                        >
                          Keep Allocation
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleCancelAllocation}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Confirm Cancel &amp; Unlink
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                (mode === 'CREATE' &&
                  (!selectedSupplier ||
                    !currencyValidation.valid ||
                    !liveDistribution.valid ||
                    Boolean(supplierEligibility && !supplierEligibility.eligible)))
              }
              className="px-5 py-2.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] disabled:opacity-50 text-white text-xs font-black shadow-xs cursor-pointer"
            >
              {submitting
                ? 'Saving...'
                : mode === 'CREATE'
                ? `Create Consolidated Allocation (${hydratedItems.length} Items)`
                : 'Save Allocation Updates'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
