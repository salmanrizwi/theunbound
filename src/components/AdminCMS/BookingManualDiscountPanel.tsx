import React, { useState, useMemo } from 'react';
import {
  Booking,
  BookingManualDiscountAdjustment,
  BookingManualDiscountSource,
  BookingManualDiscountType,
  CurrencyCode,
  Promotion,
  User
} from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import {
  buildInitialBookingPricingSnapshot,
  calculateBookingManualDiscountPreview,
  getLatestBookingPricingSnapshot,
  getReversedAdjustmentIdSet,
  isBookingEligibleForManualDiscount,
  resolveAdminManualDiscountPermissions,
  resolveAuthoritativeBookingFinancials
} from '../../services/bookingManualDiscountEngine';
import {
  applyBookingManualDiscountAsync,
  reverseBookingManualDiscountAsync
} from '../../services/bookingManualDiscountApiService';
import { evaluateProformaInvoiceFreshness } from '../../services/bookingOperationsSyncService';
import { generateAndPersistProformaInvoice } from '../../services/proformaInvoiceService';
import { resolveEffectivePromotionStatus } from '../../services/promotionEngine';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Lock,
  Percent,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Ticket
} from 'lucide-react';

interface BookingManualDiscountPanelProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
  onNavigateToInvoices?: () => void;
}

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'JPY', 'EUR', 'GBP', 'AED', 'SGD'];

export const BookingManualDiscountPanel: React.FC<BookingManualDiscountPanelProps> = ({
  booking,
  currentUser,
  onRefresh,
  onNavigateToInvoices
}) => {
  const db = AppDatabase.getInstance();
  const permissions = useMemo(
    () => resolveAdminManualDiscountPermissions(currentUser),
    [currentUser]
  );

  // Strict confidentiality gate: external users & unauthorized staff never see this panel
  if (!permissions.canViewInternalMargin) {
    return null;
  }

  const bookingCurrency: CurrencyCode = booking.currency || 'USD';
  const eligibility = useMemo(() => isBookingEligibleForManualDiscount(booking), [booking]);
  const snapshots = useMemo(() => db.getBookingPricingSnapshots(booking.id), [db, booking]);
  const baselineSnapshot = useMemo(
    () => (snapshots.length > 0 ? snapshots[0] : buildInitialBookingPricingSnapshot(booking)),
    [booking, snapshots]
  );
  const latestSnapshot = useMemo(
    () => getLatestBookingPricingSnapshot(booking, snapshots),
    [booking, snapshots]
  );
  const adjustments = useMemo(() => {
    const raw = db.getBookingManualDiscountAdjustments(booking.id);
    return [...raw].sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );
  }, [db, booking]);
  const reversedIds = useMemo(() => getReversedAdjustmentIdSet(adjustments), [adjustments]);
  const bookingInvoices = useMemo(
    () => db.getBookingInvoices(booking.id),
    [db, booking.id, booking.updatedAt, booking.proformaInvoiceIds?.length, booking.activeProformaInvoiceId]
  );
  const existingInvoicesCount = bookingInvoices.length;
  const authoritativeFinancials = useMemo(
    () => resolveAuthoritativeBookingFinancials(booking, snapshots),
    [booking, snapshots]
  );

  // Admin Manual Coupons configured in existing Promotion Management Engine
  const adminManualCoupons = useMemo<Promotion[]>(() => {
    return db.getPromotions().filter(p => {
      const channel = p.couponChannel || 'B2B_AGENT';
      if (channel !== 'ADMIN_MANUAL' && channel !== 'BOTH') return false;
      if (p.permittedForExistingBookings === false) return false;
      return resolveEffectivePromotionStatus(p) === 'ACTIVE';
    });
  }, [db, booking.updatedAt]);

  // Form state
  const [discountSource, setDiscountSource] = useState<BookingManualDiscountSource>(
    adminManualCoupons.length > 0 && permissions.canApplyAdminCoupon
      ? 'ADMIN_MANUAL_COUPON'
      : 'ADMIN_MANUAL_ADJUSTMENT'
  );
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  const [discountType, setDiscountType] = useState<BookingManualDiscountType>('FIXED');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [discountCurrency, setDiscountCurrency] = useState<CurrencyCode>(bookingCurrency);
  const [reason, setReason] = useState<string>('');
  const [internalReference, setInternalReference] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [approvalReference, setApprovalReference] = useState<string>('');
  const [allowMarginOverride, setAllowMarginOverride] = useState<boolean>(false);
  const [marginOverrideReason, setMarginOverrideReason] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGeneratingRevisedInvoice, setIsGeneratingRevisedInvoice] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [lastCommitDetails, setLastCommitDetails] = useState<{
    snapshotId: string;
    snapshotVersion: number;
    revisedAmount: number;
    discountApplied: number;
    outstandingBalance: number;
    creditBalance: number;
    outdatedInvoiceNumbers: string[];
    autoIssuedInvoice?: {
      invoiceNumber: string;
      invoiceVersion: number;
      amount: number;
      currency: CurrencyCode;
    };
    supersededInvoiceNumbers?: string[];
  } | null>(null);
  const [pendingSubmitKey, setPendingSubmitKey] = useState<string | null>(null);

  // Reversal state
  const [reversingAdjustmentId, setReversingAdjustmentId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [isReversing, setIsReversing] = useState<boolean>(false);

  // Snapshot timeline toggle
  const [showSnapshotHistory, setShowSnapshotHistory] = useState<boolean>(false);

  const selectedCoupon = useMemo(
    () => adminManualCoupons.find(c => c.id === selectedCouponId) || null,
    [adminManualCoupons, selectedCouponId]
  );

  const numericValue = useMemo(() => {
    if (discountSource === 'ADMIN_MANUAL_COUPON') {
      return selectedCoupon ? Number(selectedCoupon.discountValue || 0) : 0;
    }
    const parsed = parseFloat(discountValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [discountSource, selectedCoupon, discountValue]);

  // Central Pricing Engine Live Preview (Zero independent UI calculations)
  const preview = useMemo(() => {
    return calculateBookingManualDiscountPreview({
      booking,
      discountSource,
      discountType: selectedCoupon
        ? selectedCoupon.discountType === 'PERCENTAGE'
          ? 'PERCENTAGE'
          : 'FIXED'
        : discountType,
      discountValue: numericValue,
      discountCurrency: selectedCoupon ? selectedCoupon.currency || bookingCurrency : discountCurrency,
      coupon: discountSource === 'ADMIN_MANUAL_COUPON' ? selectedCoupon : null,
      allowMarginOverride,
      marginOverrideReason,
      approvalReference,
      permissions,
      externalSnapshots: snapshots,
      existingInvoicesCount
    });
  }, [
    booking,
    discountSource,
    selectedCoupon,
    discountType,
    numericValue,
    bookingCurrency,
    discountCurrency,
    allowMarginOverride,
    marginOverrideReason,
    approvalReference,
    permissions,
    snapshots,
    existingInvoicesCount
  ]);

  const canApplyAny =
    eligibility.eligible &&
    (permissions.canApplyManualDiscount || permissions.canApplyAdminCoupon);

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);

    if (!reason.trim() || reason.trim().length < 3) {
      setFeedbackError('Please provide a clear internal reason (at least 3 characters).');
      return;
    }

    const attemptKey =
      pendingSubmitKey ||
      `bmd-ui-${booking.id}-v${latestSnapshot.version}-${preview.discountType}-${preview.discountValue}-${Date.now()}`;
    if (!pendingSubmitKey) {
      setPendingSubmitKey(attemptKey);
    }

    setIsSubmitting(true);
    try {
      const result = await applyBookingManualDiscountAsync({
        booking,
        user: currentUser,
        payload: {
          bookingId: booking.id,
          discountSource,
          discountType: preview.discountType,
          discountValue: preview.discountValue,
          discountCurrency: preview.discountCurrency,
          couponId: selectedCoupon?.id,
          couponCode: selectedCoupon?.promoCode,
          reason: reason.trim(),
          internalReference: internalReference.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
          allowMarginOverride,
          marginOverrideReason: allowMarginOverride ? marginOverrideReason.trim() : undefined,
          approvalReference: approvalReference.trim() || undefined,
          expectedSnapshotVersion: latestSnapshot.version,
          idempotencyKey: attemptKey
        }
      });

      if (!result.ok) {
        setFeedbackError(result.error);
        setPendingSubmitKey(null);
        return;
      }

      const updatedInvoices = db.getBookingInvoices(booking.id);
      const outdatedInvoiceNumbers = updatedInvoices
        .filter(inv => {
          const freshness = evaluateProformaInvoiceFreshness(inv, result.updatedBooking, updatedInvoices);
          return freshness.isOutdated && !freshness.isSupersededByNewerVersion;
        })
        .map(inv => `#${inv.invoiceNumber} (v${inv.invoiceVersion || 1})`);
      const postFin = resolveAuthoritativeBookingFinancials(result.updatedBooking);
      const supersededNums = (result.supersededInvoices || []).map(
        inv => `#${inv.invoiceNumber} (v${inv.invoiceVersion || 1})`
      );

      setLastCommitDetails({
        snapshotId: result.newSnapshot.snapshotId,
        snapshotVersion: result.newSnapshot.version,
        revisedAmount: result.newSnapshot.revisedCustomerSellingPrice,
        discountApplied: result.adjustment.discountAmountInBookingCurrency,
        outstandingBalance: postFin.outstandingBalance,
        creditBalance: postFin.creditBalance,
        outdatedInvoiceNumbers,
        autoIssuedInvoice: result.revisedInvoice
          ? {
              invoiceNumber: result.revisedInvoice.invoiceNumber,
              invoiceVersion: result.revisedInvoice.invoiceVersion || 1,
              amount: result.revisedInvoice.proformaFinalBookingAmount ?? result.revisedInvoice.totalAmount,
              currency: result.revisedInvoice.currency
            }
          : undefined,
        supersededInvoiceNumbers: supersededNums
      });
      setFeedbackSuccess(
        `Applied ${formatCurrency(result.adjustment.discountAmountInBookingCurrency, bookingCurrency)} manual discount (Snapshot ${result.newSnapshot.snapshotId} / v${result.newSnapshot.version}). Revised Booking Amount: ${formatCurrency(result.newSnapshot.revisedCustomerSellingPrice, bookingCurrency)}.${
          result.revisedInvoice
            ? ` Auto-issued Revised Proforma Invoice #${result.revisedInvoice.invoiceNumber} (v${result.revisedInvoice.invoiceVersion || 1}).`
            : ''
        }`
      );
      setPendingSubmitKey(null);
      setDiscountValue('');
      setSelectedCouponId('');
      setReason('');
      setInternalReference('');
      setInternalNotes('');
      setApprovalReference('');
      setAllowMarginOverride(false);
      setMarginOverrideReason('');
      onRefresh();
    } catch (err: any) {
      setPendingSubmitKey(null);
      setFeedbackError(err?.message || 'Unexpected error applying manual discount.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateRevisedProformaInline = async () => {
    if (isGeneratingRevisedInvoice) return;
    setIsGeneratingRevisedInvoice(true);
    setFeedbackError(null);
    try {
      const res = await generateAndPersistProformaInvoice(booking.id, currentUser, {
        forceRegenerate: true,
        reason: `Revised Proforma Invoice issued after Manual Discount Adjustment (Snapshot v${lastCommitDetails?.snapshotVersion || latestSnapshot.version})`
      });
      if (res.success && res.invoice) {
        setLastCommitDetails(prev =>
          prev ? { ...prev, outdatedInvoiceNumbers: [] } : null
        );
        setFeedbackSuccess(
          `Generated Revised Proforma Invoice #${res.invoice.invoiceNumber} (v${res.invoice.invoiceVersion || 1}) locked to Snapshot v${res.invoice.sourcePricingSnapshotVersion || latestSnapshot.version} for ${formatCurrency(res.invoice.proformaFinalBookingAmount ?? res.invoice.totalAmount, res.invoice.currency)}.`
        );
        onRefresh();
      } else {
        setFeedbackError(
          res.error?.message ||
            'The discount adjustment remains safely committed, but generating the revised Proforma Invoice failed. Please retry from Proforma Invoices.'
        );
      }
    } catch (err: any) {
      setFeedbackError(
        err?.message ||
          'The discount adjustment remains safely committed, but generating the revised Proforma Invoice failed.'
      );
    } finally {
      setIsGeneratingRevisedInvoice(false);
    }
  };

  const handleConfirmReverse = async (adj: BookingManualDiscountAdjustment) => {
    if (isReversing) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);

    if (!reversalReason.trim() || reversalReason.trim().length < 3) {
      setFeedbackError('A mandatory reversal reason (at least 3 characters) is required.');
      return;
    }

    setIsReversing(true);
    try {
      const result = await reverseBookingManualDiscountAsync({
        booking,
        user: currentUser,
        payload: {
          bookingId: booking.id,
          adjustmentId: adj.adjustmentId,
          reason: reversalReason.trim()
        }
      });

      if (!result.ok) {
        setFeedbackError(result.error);
        return;
      }

      setFeedbackSuccess(
        `Reversed manual discount (${formatCurrency(adj.discountAmountInBookingCurrency, bookingCurrency)}). Snapshot v${result.newSnapshot.version} committed; Revised Selling Price restored to ${formatCurrency(result.newSnapshot.revisedCustomerSellingPrice, bookingCurrency)}.${
          result.revisedInvoice
            ? ` Auto-issued Revised Proforma Invoice #${result.revisedInvoice.invoiceNumber} (v${result.revisedInvoice.invoiceVersion || 1}).`
            : ''
        }`
      );
      setReversingAdjustmentId(null);
      setReversalReason('');
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err?.message || 'Unexpected error reversing manual discount.');
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div id="admin-manual-discount-panel" className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">
                Admin Manual Discount Coupons &amp; Margin Governance
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                Margin-Funded Only
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 font-mono">
                Snapshot v{latestSnapshot.version}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Strictly internal Admin control. Discounts are funded solely from TheUnbound&apos;s applicable margin — Supplier Nett Cost and B2B Agent promotions remain intact and independently audited.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSnapshotHistory(prev => !prev)}
          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <History className="w-3.5 h-3.5 text-slate-500" />
          <span>Snapshot Ledger ({snapshots.length})</span>
          {showSnapshotHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Revised Pricing After Invoice Notice */}
        {booking.hasRevisedPricingAfterInvoice && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Revised Pricing Issued After Historical Invoice</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {booking.revisedPricingNotice ||
                    'Historical invoices remain immutable. Issue a revised versioned proforma invoice to reflect the updated customer selling price.'}
                </p>
              </div>
            </div>
            {onNavigateToInvoices && (
              <button
                type="button"
                onClick={onNavigateToInvoices}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Issue Revised Proforma</span>
              </button>
            )}
          </div>
        )}

        {/* Authoritative Financial Waterfall Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Supplier Nett (Locked)
            </span>
            <span className="text-sm font-black text-rose-700 font-mono mt-1 block">
              {formatCurrency(latestSnapshot.supplierNettCost, bookingCurrency)}
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Lock className="w-2.5 h-2.5" /> Untouched
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Original Margin
            </span>
            <span className="text-sm font-black text-slate-800 font-mono mt-1 block">
              {formatCurrency(latestSnapshot.originalTheUnboundMargin, bookingCurrency)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Base: {formatCurrency(latestSnapshot.originalBaseSellingPrice, bookingCurrency)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/70">
            <span className="text-[10px] font-bold text-sky-700 uppercase block">
              B2B Promo Discount
            </span>
            <span className="text-sm font-black text-sky-900 font-mono mt-1 block">
              -{formatCurrency(latestSnapshot.b2bPromotionDiscountAmount, bookingCurrency)}
            </span>
            <span className="text-[10px] text-sky-700 block mt-0.5 truncate">
              {latestSnapshot.b2bPromotionCode ? `Code: ${latestSnapshot.b2bPromotionCode}` : 'Agent Applied: None'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/70">
            <span className="text-[10px] font-bold text-indigo-700 uppercase block">
              Admin Manual Discounts
            </span>
            <span className="text-sm font-black text-indigo-900 font-mono mt-1 block">
              -{formatCurrency(latestSnapshot.cumulativeAdminManualDiscount, bookingCurrency)}
            </span>
            <span className="text-[10px] text-indigo-700 block mt-0.5">
              Active adjustments: {adjustments.filter(a => a.actionType === 'APPLY' && !reversedIds.has(a.adjustmentId)).length}
            </span>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              latestSnapshot.remainingTheUnboundMargin < 0
                ? 'bg-rose-50 border-rose-300'
                : 'bg-emerald-50/70 border-emerald-200/80'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase block ${
                latestSnapshot.remainingTheUnboundMargin < 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              Remaining Margin
            </span>
            <span
              className={`text-sm font-black font-mono mt-1 block ${
                latestSnapshot.remainingTheUnboundMargin < 0 ? 'text-rose-800' : 'text-emerald-900'
              }`}
            >
              {formatCurrency(latestSnapshot.remainingTheUnboundMargin, bookingCurrency)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {latestSnapshot.isLossMaking ? 'Loss Override Active' : 'Available for Margin Discount'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800">
            <span className="text-[10px] font-bold text-slate-300 uppercase block">
              Current Selling Price
            </span>
            <span className="text-sm font-black font-mono mt-1 block text-teal-300">
              {formatCurrency(latestSnapshot.revisedCustomerSellingPrice, bookingCurrency)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Original (Immutable): {formatCurrency(baselineSnapshot.originalCustomerSellingPrice, bookingCurrency)}
            </span>
          </div>
        </div>

        {/* Feedback Alerts */}
        {feedbackError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{feedbackError}</span>
          </div>
        )}
        {feedbackSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2.5">
            <div className="flex items-start gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{feedbackSuccess}</span>
            </div>
            {lastCommitDetails && (
              <div className="pl-6 space-y-2">
                <div className="flex flex-wrap gap-3 text-[11px] font-mono text-emerald-900">
                  <span>
                    Snapshot: <strong>{lastCommitDetails.snapshotId} (v{lastCommitDetails.snapshotVersion})</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Current Selling Price: <strong>{formatCurrency(lastCommitDetails.revisedAmount, bookingCurrency)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    {lastCommitDetails.creditBalance > 0
                      ? `Credit/Overpayment: ${formatCurrency(lastCommitDetails.creditBalance, bookingCurrency)}`
                      : `Balance Outstanding: ${formatCurrency(lastCommitDetails.outstandingBalance, bookingCurrency)}`}
                  </span>
                </div>
                {lastCommitDetails.autoIssuedInvoice && (
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-emerald-950">
                    <div className="text-[11px]">
                      <p className="font-bold">
                        Revised Proforma Invoice Auto-Issued: #{lastCommitDetails.autoIssuedInvoice.invoiceNumber} (v{lastCommitDetails.autoIssuedInvoice.invoiceVersion}) —{' '}
                        <span className="font-mono">
                          {formatCurrency(lastCommitDetails.autoIssuedInvoice.amount, lastCommitDetails.autoIssuedInvoice.currency)}
                        </span>
                      </p>
                      {lastCommitDetails.supersededInvoiceNumbers && lastCommitDetails.supersededInvoiceNumbers.length > 0 && (
                        <p className="text-emerald-800 mt-0.5">
                          Prior version(s) marked Superseded (historical records preserved immutably): {lastCommitDetails.supersededInvoiceNumbers.join(', ')}
                        </p>
                      )}
                    </div>
                    {onNavigateToInvoices && (
                      <button
                        type="button"
                        onClick={onNavigateToInvoices}
                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Open Proforma Invoices
                      </button>
                    )}
                  </div>
                )}
                {lastCommitDetails.outdatedInvoiceNumbers.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-amber-950">
                    <div className="text-[11px]">
                      <p className="font-bold">
                        {lastCommitDetails.outdatedInvoiceNumbers.length} Existing Proforma Invoice{lastCommitDetails.outdatedInvoiceNumbers.length > 1 ? 's' : ''} Now Marked Outdated:
                      </p>
                      <p className="text-amber-800 mt-0.5">
                        {lastCommitDetails.outdatedInvoiceNumbers.join(', ')} (preserved immutably). Generate a revised version to reflect the updated amount.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isGeneratingRevisedInvoice}
                        onClick={handleGenerateRevisedProformaInline}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingRevisedInvoice ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingRevisedInvoice ? 'Generating...' : 'Generate Revised Proforma'}</span>
                      </button>
                      {onNavigateToInvoices && (
                        <button
                          type="button"
                          onClick={onNavigateToInvoices}
                          className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-[11px] font-bold cursor-pointer"
                        >
                          View Invoices
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status Eligibility Gate */}
        {!eligibility.eligible && (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>Financial Controls Locked:</strong> {eligibility.reason}
            </span>
          </div>
        )}

        {/* Apply Manual Discount Form */}
        {canApplyAny && (
          <form onSubmit={handleApplyDiscount} className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Apply New Admin Manual Discount / Coupon
                </h4>
                <p className="text-[11px] text-slate-500">
                  Calculated via central pricing engine against remaining eligible margin ({formatCurrency(Math.max(0, latestSnapshot.remainingTheUnboundMargin), bookingCurrency)}).
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200">
                {permissions.canApplyAdminCoupon && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountSource('ADMIN_MANUAL_COUPON');
                      setFeedbackError(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      discountSource === 'ADMIN_MANUAL_COUPON'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    Admin Coupon ({adminManualCoupons.length})
                  </button>
                )}
                {permissions.canApplyManualDiscount && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountSource('ADMIN_MANUAL_ADJUSTMENT');
                      setSelectedCouponId('');
                      setFeedbackError(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      discountSource === 'ADMIN_MANUAL_ADJUSTMENT'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    Direct Margin Discount
                  </button>
                )}
              </div>
            </div>

            {discountSource === 'ADMIN_MANUAL_COUPON' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Select Admin Manual Coupon *
                  </label>
                  <select
                    value={selectedCouponId}
                    onChange={e => setSelectedCouponId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Choose an active Admin Manual Coupon --</option>
                    {adminManualCoupons.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.promoCode ? `[${c.promoCode}] ` : ''}
                        {c.title} — {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : formatCurrency(c.discountValue, c.currency || bookingCurrency)}
                        {c.requiresAdminApproval ? ' (Approval Req.)' : ''}
                      </option>
                    ))}
                  </select>
                  {adminManualCoupons.length === 0 && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      No active Admin Manual Coupons configured yet. Create one under Marketing Management → Promotion Management Engine (Channel: Admin Manual), or switch to Direct Margin Discount.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Approval Reference {selectedCoupon?.requiresAdminApproval ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    value={approvalReference}
                    onChange={e => setApprovalReference(e.target.value)}
                    placeholder="e.g. FIN-APR-2026-042"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as BookingManualDiscountType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="FIXED">Fixed Amount</option>
                    <option value="PERCENTAGE">Percentage (% of Current Base Selling)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    {discountType === 'PERCENTAGE' ? 'Discount Percentage (%)' : `Discount Amount (${discountCurrency})`} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'PERCENTAGE' ? 'e.g. 5' : 'e.g. 5000'}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Discount Currency
                  </label>
                  <select
                    disabled={discountType === 'PERCENTAGE'}
                    value={discountType === 'PERCENTAGE' ? bookingCurrency : discountCurrency}
                    onChange={e => setDiscountCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {SUPPORTED_CURRENCIES.map(cur => (
                      <option key={cur} value={cur}>
                        {cur}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Reason, Internal Reference & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Mandatory Internal Reason *
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. VIP repeat partner goodwill adjustment approved by Sales Director"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Internal Reference (Optional)
                </label>
                <input
                  type="text"
                  value={internalReference}
                  onChange={e => setInternalReference(e.target.value)}
                  placeholder="e.g. DISC-APR-2026-014 or Ticket ID"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Internal Audit Notes (Admin Only)
                </label>
                <input
                  type="text"
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  placeholder="Optional commercial approval context"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Live Central Engine Calculation Preview (Complete Section 8 Breakdown) */}
            {numericValue > 0 && (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    Central Pricing Engine Live Preview ({preview.discountType === 'PERCENTAGE' ? `${preview.discountValue}% Percentage` : `Fixed ${formatCurrency(preview.discountValue, preview.discountCurrency)}`})
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <span>Current Snapshot: v{preview.latestSnapshotVersion} → Next: v{preview.latestSnapshotVersion + 1}</span>
                    {preview.fxRateApplied !== 1 && (
                      <span>
                        | FX: 1 {preview.discountCurrency} = {preview.fxRateApplied} {bookingCurrency}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Original Booking Amount</span>
                    <span className="font-mono font-black text-slate-900 block mt-0.5">
                      {formatCurrency(preview.originalCustomerSellingPrice, bookingCurrency)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Prior Active: {formatCurrency(preview.previousCustomerSellingPrice, bookingCurrency)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase block">
                      Calculated Discount ({preview.discountType})
                    </span>
                    <span className="font-mono font-black text-indigo-800 block mt-0.5">
                      -{formatCurrency(preview.requestedDiscountAmount, bookingCurrency)}
                    </span>
                    <span className="text-[10px] text-indigo-700 block">
                      Cumulative: -{formatCurrency(preview.cumulativeAdminManualDiscountAfter, bookingCurrency)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 text-white border border-slate-800">
                    <span className="text-[10px] font-bold text-teal-300 uppercase block">Revised Booking Amount</span>
                    <span className="font-mono font-black text-white block mt-0.5">
                      {formatCurrency(preview.revisedCustomerSellingPrice, bookingCurrency)}
                    </span>
                    <span className="text-[10px] text-slate-300 block">
                      Authoritative Snapshot v{preview.latestSnapshotVersion + 1}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      {preview.isOverpaidAfterDiscount ? 'Revised Balance / Credit' : 'Revised Outstanding Balance'}
                    </span>
                    <span
                      className={`font-mono font-black block mt-0.5 ${
                        preview.isOverpaidAfterDiscount
                          ? 'text-indigo-700'
                          : (preview.revisedOutstandingBalance ?? 0) > 0
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {preview.isOverpaidAfterDiscount
                        ? `Credit ${formatCurrency(preview.revisedCreditBalance ?? 0, bookingCurrency)}`
                        : formatCurrency(preview.revisedOutstandingBalance ?? preview.revisedCustomerSellingPrice, bookingCurrency)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Paid: {formatCurrency(preview.amountAlreadyPaid ?? authoritativeFinancials.verifiedPaidAmount, bookingCurrency)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Supplier Nett Cost (Protected)</span>
                      <span className="font-mono font-black text-slate-800">
                        {formatCurrency(preview.supplierNettCost, bookingCurrency)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Unchanged
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Remaining Internal Margin</span>
                      <span
                        className={`font-mono font-black ${
                          preview.remainingTheUnboundMarginAfter < 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(preview.availableMarginBeforeDiscount, bookingCurrency)} →{' '}
                        {formatCurrency(preview.remainingTheUnboundMarginAfter, bookingCurrency)}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">Funded from Margin</span>
                  </div>
                </div>

                {/* Margin Protection Block / Controlled Loss-Making Override */}
                {preview.requiresLossOverride && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2.5">
                    <div className="flex items-start gap-2 text-xs text-rose-900">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black">
                          Margin Protection Triggered — Available Margin is {formatCurrency(Math.max(0, preview.availableMarginBeforeDiscount), bookingCurrency)}
                        </p>
                        <p className="text-[11px] text-rose-800 mt-0.5">
                          This discount exceeds remaining applicable TheUnbound margin by{' '}
                          <strong>{formatCurrency(Math.abs(preview.remainingTheUnboundMarginAfter), bookingCurrency)}</strong>.
                          {!permissions.canOverrideMarginProtection &&
                            ' Your role does not have Loss-Making Margin Override permission.'}
                        </p>
                      </div>
                    </div>

                    {permissions.canOverrideMarginProtection && (
                      <div className="pt-2 border-t border-rose-200 space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-rose-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowMarginOverride}
                            onChange={e => setAllowMarginOverride(e.target.checked)}
                            className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span>Authorize Explicit Loss-Making Margin Override (Logged to Financial Audit)</span>
                        </label>
                        {allowMarginOverride && (
                          <input
                            type="text"
                            value={marginOverrideReason}
                            onChange={e => setMarginOverrideReason(e.target.value)}
                            placeholder="Mandatory override justification & executive approval reference..."
                            className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {preview.validationErrors.length > 0 && (
                  <ul className="space-y-1 text-[11px] text-rose-700 font-semibold list-disc list-inside">
                    {preview.validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
                {preview.validationWarnings.length > 0 && (
                  <ul className="space-y-1 text-[11px] text-amber-800 list-disc list-inside">
                    {preview.validationWarnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !preview.canApply || reason.trim().length < 3}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'Committing Snapshot...' : 'Apply Margin-Funded Discount'}
              </button>
            </div>
          </form>
        )}

        {/* Immutable Manual Discount Adjustment Ledger */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Manual Discount Adjustment History ({adjustments.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              Append-only immutable audit ledger
            </span>
          </div>

          {adjustments.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
              No Admin manual discounts have been applied to this booking.
            </div>
          ) : (
            <div className="space-y-2.5">
              {adjustments.map(adj => {
                const isReversalRecord = adj.actionType === 'REVERSE';
                const isAlreadyReversed = !isReversalRecord && reversedIds.has(adj.adjustmentId);
                const canReverseThis =
                  !isReversalRecord &&
                  !isAlreadyReversed &&
                  permissions.canReverseManualDiscount &&
                  eligibility.eligible;

                return (
                  <div
                    key={adj.adjustmentId}
                    className={`p-4 rounded-2xl border text-xs space-y-2 ${
                      isReversalRecord
                        ? 'bg-amber-50/60 border-amber-200'
                        : isAlreadyReversed
                          ? 'bg-slate-50 border-slate-200 opacity-75'
                          : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            isReversalRecord
                              ? 'bg-amber-200 text-amber-900'
                              : isAlreadyReversed
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isReversalRecord ? 'REVERSAL' : isAlreadyReversed ? 'REVERSED' : 'ACTIVE'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {adj.discountSource === 'ADMIN_MANUAL_COUPON'
                            ? `Admin Coupon${adj.couponCode ? `: ${adj.couponCode}` : ''}`
                            : 'Direct Manual Margin Discount'}
                        </span>
                        <span className="font-mono font-black text-indigo-700">
                          {isReversalRecord ? '+' : '-'}
                          {formatCurrency(adj.discountAmountInBookingCurrency, adj.bookingCurrency)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Snapshot v{adj.previousSnapshotVersion} → v{adj.resultingSnapshotVersion}
                        </span>
                        {adj.marginOverrideUsed && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            Loss Override
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{adj.appliedByName} ({adj.appliedByRole})</span>
                        <span>•</span>
                        <span>{new Date(adj.appliedAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-xl">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Original Booking Amount</span>
                        <strong className="font-mono text-slate-800">
                          {formatCurrency(
                            adj.originalBookingAmount ?? baselineSnapshot.originalCustomerSellingPrice,
                            adj.bookingCurrency
                          )}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">
                          Selling Price ({adj.discountType === 'PERCENTAGE' ? `${adj.discountValue}%` : 'Fixed'})
                        </span>
                        <strong className="font-mono text-slate-900">
                          {formatCurrency(adj.sellingPriceBefore, adj.bookingCurrency)} →{' '}
                          {formatCurrency(adj.sellingPriceAfter, adj.bookingCurrency)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">TheUnbound Margin</span>
                        <strong className="font-mono text-slate-900">
                          {formatCurrency(adj.marginBefore, adj.bookingCurrency)} →{' '}
                          {formatCurrency(adj.marginAfter, adj.bookingCurrency)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Supplier Nett (Locked)</span>
                        <strong className="font-mono text-slate-900">
                          {formatCurrency(adj.supplierNettCostSnapshot, adj.bookingCurrency)}
                        </strong>
                      </div>
                    </div>

                    {/* Previous vs. Revised Payment Schedule Snapshot */}
                    {(adj.previousPaymentSchedule || adj.revisedPaymentSchedule) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] bg-slate-50/60 border border-slate-200/70 p-2.5 rounded-xl">
                        {adj.previousPaymentSchedule && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Previous Payment Schedule (Total:{' '}
                              <span className="font-mono">
                                {formatCurrency(adj.previousPaymentSchedule.totalAmount, adj.bookingCurrency)}
                              </span>
                              )
                            </span>
                            <div className="space-y-0.5 text-slate-600">
                              {(adj.previousPaymentSchedule.installments || []).map(inst => (
                                <div key={inst.id} className="flex items-center justify-between font-mono text-[10px]">
                                  <span className="font-sans truncate pr-2">
                                    #{inst.installmentNumber} {inst.title}
                                  </span>
                                  <span>
                                    {formatCurrency(inst.amount, adj.bookingCurrency)} ({inst.status})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {adj.revisedPaymentSchedule && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase text-indigo-700 block">
                              Revised Payment Schedule (Total:{' '}
                              <span className="font-mono">
                                {formatCurrency(adj.revisedPaymentSchedule.totalAmount, adj.bookingCurrency)}
                              </span>
                              )
                            </span>
                            <div className="space-y-0.5 text-slate-800">
                              {(adj.revisedPaymentSchedule.installments || []).map(inst => (
                                <div key={inst.id} className="flex items-center justify-between font-mono text-[10px]">
                                  <span className="font-sans font-semibold truncate pr-2">
                                    #{inst.installmentNumber} {inst.title}
                                  </span>
                                  <span className="font-bold text-indigo-900">
                                    {formatCurrency(inst.amount, adj.bookingCurrency)} ({inst.status})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Associated Invoice & Document Versions */}
                    {adj.associatedInvoiceVersions && adj.associatedInvoiceVersions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-indigo-50/50 border border-indigo-200/70 px-2.5 py-2 rounded-xl">
                        <span className="font-bold uppercase text-indigo-900 mr-1">
                          Associated Invoices:
                        </span>
                        {adj.associatedInvoiceVersions.map(invVer => (
                          <span
                            key={`${invVer.invoiceId}-${invVer.status}`}
                            className={`px-2 py-0.5 rounded-md font-mono font-bold border ${
                              invVer.status === 'ISSUED_REVISED' || invVer.status === 'CURRENT'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {invVer.invoiceNumber} v{invVer.invoiceVersion} • {invVer.status.replace(/_/g, ' ')} •{' '}
                            {formatCurrency(invVer.amount, invVer.currency)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-700">
                        <strong className="text-slate-900">Reason:</strong> {adj.reason}
                        {adj.internalReference && (
                          <span className="text-slate-500 ml-2 font-mono">
                            (Ref: {adj.internalReference})
                          </span>
                        )}
                        {adj.marginOverrideReason && (
                          <span className="text-rose-700 ml-2">
                            (Override Reason: {adj.marginOverrideReason})
                          </span>
                        )}
                      </p>

                      {canReverseThis && reversingAdjustmentId !== adj.adjustmentId && (
                        <button
                          type="button"
                          onClick={() => {
                            setReversingAdjustmentId(adj.adjustmentId);
                            setReversalReason('');
                            setFeedbackError(null);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reverse Discount</span>
                        </button>
                      )}
                    </div>

                    {reversingAdjustmentId === adj.adjustmentId && (
                      <div className="pt-2.5 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={reversalReason}
                          onChange={e => setReversalReason(e.target.value)}
                          placeholder="Enter mandatory reversal reason (logged to immutable audit)..."
                          className="flex-1 px-3 py-2 rounded-xl border border-rose-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isReversing || reversalReason.trim().length < 3}
                            onClick={() => handleConfirmReverse(adj)}
                            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-[11px] font-bold cursor-pointer"
                          >
                            {isReversing ? 'Reversing...' : 'Confirm Reversal'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReversingAdjustmentId(null);
                              setReversalReason('');
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Versioned Pricing Snapshot History Table */}
        {showSnapshotHistory && (
          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Immutable Versioned Booking Pricing Snapshots
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Ver.</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Supplier Nett</th>
                    <th className="py-2.5 px-3">B2B Promo</th>
                    <th className="py-2.5 px-3">Admin Manual</th>
                    <th className="py-2.5 px-3">Remaining Margin</th>
                    <th className="py-2.5 px-3">Customer Selling</th>
                    <th className="py-2.5 px-3">Committed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshots.map(snap => (
                    <tr key={snap.snapshotId} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-black text-slate-900">v{snap.version}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{snap.sourceAction.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 px-3 font-mono text-rose-700">
                        {formatCurrency(snap.supplierNettCost, snap.currency)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-sky-700">
                        -{formatCurrency(snap.b2bPromotionDiscountAmount, snap.currency)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">
                        -{formatCurrency(snap.cumulativeAdminManualDiscount, snap.currency)}
                      </td>
                      <td className={`py-2.5 px-3 font-mono font-bold ${snap.remainingTheUnboundMargin < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {formatCurrency(snap.remainingTheUnboundMargin, snap.currency)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                        {formatCurrency(snap.revisedCustomerSellingPrice, snap.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {snap.createdByName} · {new Date(snap.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
