import React, { useEffect, useMemo, useState } from 'react';
import {
  Booking,
  PaymentInstallmentItem,
  PaymentSchedule,
  PaymentScheduleAuditEntry,
  User
} from '../../../types';
import { AppDatabase } from '../../../services/db';
import { formatCurrency } from '../../../services/pricingEngine';
import {
  PaymentScheduleRecalculationPreview,
  resolveAdminManualDiscountPermissions,
  resolveAuthoritativeBookingFinancials,
  roundMoney
} from '../../../services/bookingManualDiscountEngine';
import {
  fetchBookingPaymentSchedulesAsync,
  previewBookingPaymentScheduleRecalculationAsync,
  saveBookingPaymentScheduleVersionAsync
} from '../../../services/paymentScheduleApiService';
import { PaymentProofsManager } from '../PaymentProofsManager';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileSpreadsheet,
  History,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Trash2,
  X
} from 'lucide-react';

interface DeskPaymentScheduleSectionProps {
  booking: Booking;
  currentUser: User | null;
  onRefresh: () => void;
}

interface EditableTrancheRow {
  id: string;
  title: string;
  milestone: string;
  description: string;
  paymentTerms: string;
  calculationMode: 'PERCENTAGE' | 'FIXED';
  dueDate: string;
  amount: string;
  percentage: string;
  notes: string;
  isLockedPaid: boolean;
  paidAmount: number;
  status: PaymentInstallmentItem['status'];
}

function defaultDueDateOffset(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function makeIdempotencyKey(prefix: string, bookingId: string): string {
  return `${prefix}-${bookingId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DeskPaymentScheduleSection: React.FC<DeskPaymentScheduleSectionProps> = ({
  booking,
  currentUser,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const permissions = useMemo(
    () => resolveAdminManualDiscountPermissions(currentUser),
    [currentUser]
  );
  const canManageSchedule = Boolean(permissions.canManagePaymentSchedule);

  const [localRevision, setLocalRevision] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rows, setRows] = useState<EditableTrancheRow[]>([]);
  const [allowPartialSchedule, setAllowPartialSchedule] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [editIdempotencyKey, setEditIdempotencyKey] = useState('');
  const [isEditingFromRecalc, setIsEditingFromRecalc] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(true);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Recalculation preview workflow state (Scenario B / C / D)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [recalcPreview, setRecalcPreview] = useState<PaymentScheduleRecalculationPreview | null>(null);
  const [recalcReason, setRecalcReason] = useState('');
  const [recalcIdempotencyKey, setRecalcIdempotencyKey] = useState('');

  useEffect(() => {
    const collections = ['bookings'];
    if (permissions.canViewInternalMargin) {
      collections.push('booking_pricing_snapshots', 'booking_manual_discounts');
    }
    if (permissions.canViewInternalMargin || permissions.canManagePaymentSchedule) {
      collections.push('booking_payment_schedules');
    }
    return db.subscribeToCollections(collections, () => setLocalRevision(prev => prev + 1));
  }, [db, permissions.canViewInternalMargin, permissions.canManagePaymentSchedule]);

  // Hydrate persisted Firestore payment schedule versions on mount, refresh, or re-login
  useEffect(() => {
    if (!booking?.id || !currentUser || (!canManageSchedule && !permissions.canViewInternalMargin)) {
      return;
    }
    let cancelled = false;
    fetchBookingPaymentSchedulesAsync({
      bookingId: booking.id,
      user: currentUser
    })
      .then(res => {
        if (!cancelled && res.ok && res.schedules.length > 0) {
          setLocalRevision(prev => prev + 1);
        }
      })
      .catch(() => {
        // Non-blocking hydration fallback; local synced collection remains visible
      });
    return () => {
      cancelled = true;
    };
  }, [booking.id, currentUser?.id, canManageSchedule, permissions.canViewInternalMargin]);

  const snapshots = useMemo(
    () => db.getBookingPricingSnapshots(booking.id),
    [db, booking.id, booking.updatedAt, booking.currentPricingSnapshotVersion, localRevision]
  );

  const financials = useMemo(
    () => resolveAuthoritativeBookingFinancials(booking, snapshots),
    [booking, snapshots, localRevision]
  );

  const scheduleVersions: PaymentSchedule[] = useMemo(
    () => db.getBookingPaymentSchedules(booking.id),
    [db, booking.id, booking.updatedAt, localRevision]
  );

  const originalBookingAmount = roundMoney(financials.originalBookingAmount);
  const adminManualDiscountTotal = roundMoney(financials.adminManualDiscountTotal);
  const b2bPromoDiscount = roundMoney(financials.b2bPromotionDiscountAmount);
  const totalDiscountApplied = roundMoney(adminManualDiscountTotal + b2bPromoDiscount);
  const authoritativeTotal = roundMoney(financials.revisedBookingAmount);
  const amountReceived = roundMoney(financials.verifiedPaidAmount);
  const remainingBalance = roundMoney(financials.outstandingBalance);
  const creditBalance = roundMoney(financials.creditBalance);
  const currency = financials.currency;

  const currentSchedule = financials.paymentSchedule || booking.paymentSchedule;
  const currentInstallments = currentSchedule?.installments || [];
  const auditHistory: PaymentScheduleAuditEntry[] = currentSchedule?.auditHistory || [];

  const totalScheduledActive = useMemo(
    () => roundMoney(currentInstallments.reduce((s, i) => s + Number(i.amount || 0), 0)),
    [currentInstallments]
  );
  const activeUnallocated = roundMoney(Math.max(0, authoritativeTotal - totalScheduledActive));
  const activeVariance = roundMoney(totalScheduledActive - authoritativeTotal);
  const isCommittedPartial = Boolean(currentSchedule?.isPartialSchedule && activeVariance < -0.02);
  const snapshotVersionMismatch = Boolean(
    currentSchedule?.financialSnapshotVersion &&
      currentSchedule.financialSnapshotVersion !== financials.latestSnapshotVersion
  );
  const needsRecalculation = Boolean(
    currentSchedule?.requiresAdjustment ||
      currentSchedule?.scheduleStatus === 'RECALCULATION_REQUIRED' ||
      snapshotVersionMismatch ||
      (!isCommittedPartial && Math.abs(activeVariance) > 0.02)
  );

  const buildRowsFromInstallments = (source: PaymentInstallmentItem[]): EditableTrancheRow[] =>
    source.map((inst, idx) => {
      const amt = roundMoney(Number(inst.amount || 0));
      const pct =
        typeof inst.percentage === 'number'
          ? roundMoney(inst.percentage)
          : authoritativeTotal > 0
            ? roundMoney((amt / authoritativeTotal) * 100)
            : 0;
      return {
        id: inst.id || `inst-${booking.id}-${idx + 1}`,
        title: inst.title || `Instalment ${idx + 1}`,
        milestone: inst.milestone || '',
        description: inst.description || '',
        paymentTerms: inst.paymentTerms || '',
        calculationMode: inst.calculationMode || 'PERCENTAGE',
        dueDate: inst.dueDate || defaultDueDateOffset(7 * (idx + 1)),
        amount: String(amt),
        percentage: String(pct),
        notes: inst.notes || '',
        isLockedPaid: inst.status === 'PAID',
        paidAmount: roundMoney(Number(inst.paidAmount || 0)),
        status: inst.status
      };
    });

  const startEditing = (fromRecalculated?: PaymentInstallmentItem[]) => {
    const initialRows: EditableTrancheRow[] =
      fromRecalculated && fromRecalculated.length > 0
        ? buildRowsFromInstallments(fromRecalculated)
        : currentInstallments.length > 0
          ? buildRowsFromInstallments(currentInstallments)
          : [
              {
                id: `inst-${booking.id}-1`,
                title: 'Deposit / Tranche 1',
                milestone: 'Booking Confirmation',
                description: 'Initial booking confirmation deposit',
                paymentTerms: 'Bank Wire / Remittance',
                calculationMode: 'PERCENTAGE',
                dueDate: defaultDueDateOffset(3),
                amount: String(roundMoney(authoritativeTotal * 0.3)),
                percentage: '30',
                notes: '',
                isLockedPaid: false,
                paidAmount: 0,
                status: 'PENDING'
              },
              {
                id: `inst-${booking.id}-2`,
                title: 'Final Balance / Tranche 2',
                milestone: 'Pre-Departure Cut-off',
                description: 'Final balance prior to departure cut-off',
                paymentTerms: 'Bank Wire / Remittance',
                calculationMode: 'PERCENTAGE',
                dueDate: booking.paymentCutoffDate || defaultDueDateOffset(21),
                amount: String(roundMoney(authoritativeTotal - roundMoney(authoritativeTotal * 0.3))),
                percentage: '70',
                notes: '',
                isLockedPaid: false,
                paidAmount: 0,
                status: 'PENDING'
              }
            ];

    setRows(initialRows);
    setAllowPartialSchedule(Boolean(currentSchedule?.isPartialSchedule) && !fromRecalculated);
    setChangeReason(
      fromRecalculated
        ? `Recalculated payment schedule against Financial Snapshot v${financials.latestSnapshotVersion}`
        : ''
    );
    setEditIdempotencyKey(makeIdempotencyKey('ps-edit', booking.id));
    setIsEditingFromRecalc(Boolean(fromRecalculated));
    setFormError(null);
    setRecalcPreview(null);
    setIsEditing(true);
  };

  // Reconcile cent-exact rounding when all editable rows are PERCENTAGE summing to ~100%
  const applyFinalTrancheCentRounding = (candidateRows: EditableTrancheRow[]): EditableTrancheRow[] => {
    if (candidateRows.length === 0) return candidateRows;
    const anyLocked = candidateRows.some(r => r.isLockedPaid);
    const allPct = candidateRows.every(r => r.calculationMode === 'PERCENTAGE');
    if (anyLocked || !allPct) return candidateRows;

    const pctSum = roundMoney(candidateRows.reduce((s, r) => s + (Number(r.percentage) || 0), 0));
    if (Math.abs(pctSum - 100) > 0.02) return candidateRows;

    let running = 0;
    return candidateRows.map((r, idx) => {
      if (idx === candidateRows.length - 1) {
        const finalAmt = roundMoney(Math.max(0, authoritativeTotal - running));
        return { ...r, amount: String(finalAmt) };
      }
      const amt = roundMoney((authoritativeTotal * (Number(r.percentage) || 0)) / 100);
      running = roundMoney(running + amt);
      return { ...r, amount: String(amt) };
    });
  };

  // Live totals during edit mode
  const editTotalScheduled = useMemo(
    () => roundMoney(rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)),
    [rows]
  );
  const editTotalPercent = useMemo(
    () => roundMoney(rows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0)),
    [rows]
  );
  const editVariance = roundMoney(editTotalScheduled - authoritativeTotal);
  const editUnallocated = roundMoney(Math.max(0, authoritativeTotal - editTotalScheduled));
  const isEditOverAllocated = editVariance > 0.02;
  const isEditExactMatch = Math.abs(editVariance) <= 0.02;
  const isEditValidAllocation =
    !isEditOverAllocated && (isEditExactMatch || (allowPartialSchedule && editTotalScheduled >= 0));

  const handleRowModeChange = (idx: number, mode: 'PERCENTAGE' | 'FIXED') => {
    setRows(prev => {
      const updated = prev.map((r, i) => (i === idx && !r.isLockedPaid ? { ...r, calculationMode: mode } : r));
      return applyFinalTrancheCentRounding(updated);
    });
    setFormError(null);
  };

  const handleRowAmountChange = (idx: number, rawAmount: string) => {
    setRows(prev =>
      prev.map((row, i) => {
        if (i !== idx || row.isLockedPaid) return row;
        const amt = Number(rawAmount);
        const pct =
          Number.isFinite(amt) && authoritativeTotal > 0
            ? String(roundMoney((amt / authoritativeTotal) * 100))
            : row.percentage;
        return { ...row, calculationMode: 'FIXED', amount: rawAmount, percentage: pct };
      })
    );
    setFormError(null);
  };

  const handleRowPercentChange = (idx: number, rawPct: string) => {
    setRows(prev => {
      const next = prev.map((row, i) => {
        if (i !== idx || row.isLockedPaid) return row;
        const pct = Number(rawPct);
        const amt =
          Number.isFinite(pct) && authoritativeTotal > 0
            ? String(roundMoney((authoritativeTotal * pct) / 100))
            : row.amount;
        return { ...row, calculationMode: 'PERCENTAGE' as const, percentage: rawPct, amount: amt };
      });
      return applyFinalTrancheCentRounding(next);
    });
    setFormError(null);
  };

  const handleAddTranche = () => {
    const remainingUnallocated = roundMoney(Math.max(0, authoritativeTotal - editTotalScheduled));
    const pct = authoritativeTotal > 0 ? roundMoney((remainingUnallocated / authoritativeTotal) * 100) : 0;
    const nextIdx = rows.length + 1;
    setRows(prev => [
      ...prev,
      {
        id: `inst-${booking.id}-${Date.now()}-${nextIdx}`,
        title: `Instalment Tranche ${nextIdx}`,
        milestone: '',
        description: '',
        paymentTerms: '',
        calculationMode: 'PERCENTAGE',
        dueDate: defaultDueDateOffset(7 * nextIdx),
        amount: String(remainingUnallocated),
        percentage: String(pct),
        notes: '',
        isLockedPaid: false,
        paidAmount: 0,
        status: 'PENDING'
      }
    ]);
    setFormError(null);
  };

  const handleDeleteTranche = (idx: number) => {
    if (rows[idx]?.isLockedPaid) return;
    setRows(prev => prev.filter((_, i) => i !== idx));
    setFormError(null);
  };

  const handleAutoBalanceRemaining = () => {
    const editableIndices = rows
      .map((r, i) => (r.isLockedPaid ? -1 : i))
      .filter(i => i >= 0);
    if (editableIndices.length === 0) {
      setFormError('All existing tranches are already paid and locked.');
      return;
    }
    const targetIdx = editableIndices[editableIndices.length - 1];
    const sumOthers = roundMoney(
      rows.reduce((sum, r, i) => (i === targetIdx ? sum : sum + (Number(r.amount) || 0)), 0)
    );
    const needed = roundMoney(Math.max(0, authoritativeTotal - sumOthers));
    const neededPct = authoritativeTotal > 0 ? roundMoney((needed / authoritativeTotal) * 100) : 0;
    setRows(prev =>
      prev.map((row, i) =>
        i === targetIdx
          ? { ...row, amount: String(needed), percentage: String(neededPct) }
          : row
      )
    );
    setFormError(null);
  };

  const handleSplitRemainingEqually = () => {
    const editableIndices = rows
      .map((r, i) => (r.isLockedPaid ? -1 : i))
      .filter(i => i >= 0);
    if (editableIndices.length === 0) return;

    const lockedSum = roundMoney(
      rows.reduce((sum, r) => (r.isLockedPaid ? sum + (Number(r.amount) || 0) : sum), 0)
    );
    const remainingToSplit = roundMoney(Math.max(0, authoritativeTotal - lockedSum));
    const perTranche = roundMoney(remainingToSplit / editableIndices.length);
    let distributed = 0;

    setRows(prev =>
      prev.map((row, i) => {
        if (row.isLockedPaid) return row;
        const pos = editableIndices.indexOf(i);
        const isLast = pos === editableIndices.length - 1;
        const amt = isLast ? roundMoney(Math.max(0, remainingToSplit - distributed)) : perTranche;
        distributed = roundMoney(distributed + amt);
        const pct = authoritativeTotal > 0 ? roundMoney((amt / authoritativeTotal) * 100) : 0;
        return { ...row, amount: String(amt), percentage: String(pct) };
      })
    );
    setFormError(null);
  };

  const handleOpenRecalculationPreview = async () => {
    setIsLoadingPreview(true);
    setStatusNotice(null);
    const res = await previewBookingPaymentScheduleRecalculationAsync({
      booking,
      user: currentUser
    });
    setIsLoadingPreview(false);
    if (!res.ok) {
      setStatusNotice({ type: 'error', message: res.error });
      return;
    }
    setRecalcPreview(res.preview);
    setRecalcReason(
      `Recalculated Payment Schedule against committed Financial Snapshot v${res.preview.financialSnapshotVersion} (${formatCurrency(res.preview.revisedBookingAmount, res.preview.currency)})`
    );
    setRecalcIdempotencyKey(makeIdempotencyKey('ps-recalc', booking.id));
  };

  const handleConfirmSaveRecalculatedSchedule = async () => {
    if (!recalcPreview || isSaving) return;
    if (recalcReason.trim().length < 3) {
      setStatusNotice({
        type: 'error',
        message: 'Please provide a brief audit reason (at least 3 characters) before saving the recalculated schedule.'
      });
      return;
    }
    setIsSaving(true);
    const saveRes = await saveBookingPaymentScheduleVersionAsync({
      booking,
      tranches: recalcPreview.recalculatedInstallments.map(inst => ({
        id: inst.id,
        title: inst.title,
        milestone: inst.milestone,
        description: inst.description,
        paymentTerms: inst.paymentTerms,
        calculationMode: inst.calculationMode || 'FIXED',
        dueDate: inst.dueDate,
        amount: roundMoney(inst.amount),
        percentage: inst.percentage,
        notes: inst.notes
      })),
      reason: recalcReason.trim(),
      allowPartialSchedule: recalcPreview.unallocatedBalance > 0.02,
      idempotencyKey: recalcIdempotencyKey || makeIdempotencyKey('ps-recalc', booking.id),
      expectedSnapshotVersion: recalcPreview.financialSnapshotVersion,
      isRecalculation: true,
      user: currentUser
    });
    setIsSaving(false);

    if (!saveRes.ok) {
      setStatusNotice({ type: 'error', message: saveRes.error });
      return;
    }

    setRecalcPreview(null);
    setLocalRevision(prev => prev + 1);
    setStatusNotice({
      type: 'success',
      message: `Saved recalculated Payment Schedule v${saveRes.newSchedule.scheduleVersion} linked to Financial Snapshot v${saveRes.newSchedule.financialSnapshotVersion} (${formatCurrency(saveRes.newSchedule.totalAmount, currency)}). Previous schedule version preserved in history.`
    });
    onRefresh();
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError(null);

    if (isEditOverAllocated) {
      setFormError(
        `Over-allocation blocked: scheduled tranches (${formatCurrency(editTotalScheduled, currency)}) cannot exceed Revised Booking Amount (${formatCurrency(authoritativeTotal, currency)}).`
      );
      return;
    }
    if (!isEditValidAllocation) {
      setFormError(
        `Scheduled tranches (${formatCurrency(editTotalScheduled, currency)}) must equal Revised Booking Amount (${formatCurrency(authoritativeTotal, currency)}), or enable "Allow Partial Schedule".`
      );
      return;
    }
    if (changeReason.trim().length < 3) {
      setFormError('Please enter a reason (at least 3 characters) for this payment schedule version.');
      return;
    }

    setIsSaving(true);
    const res = await saveBookingPaymentScheduleVersionAsync({
      booking,
      tranches: rows.map(r => ({
        id: r.id,
        title: r.title.trim(),
        milestone: r.milestone.trim() || undefined,
        description: r.description.trim() || undefined,
        paymentTerms: r.paymentTerms.trim() || undefined,
        calculationMode: r.calculationMode,
        dueDate: r.dueDate,
        amount: roundMoney(Number(r.amount) || 0),
        percentage: roundMoney(Number(r.percentage) || 0),
        notes: r.notes.trim() || undefined
      })),
      reason: changeReason.trim(),
      allowPartialSchedule,
      idempotencyKey: editIdempotencyKey || makeIdempotencyKey('ps-edit', booking.id),
      expectedSnapshotVersion: financials.latestSnapshotVersion,
      isRecalculation: isEditingFromRecalc,
      user: currentUser
    });
    setIsSaving(false);

    if (res.ok) {
      setIsEditing(false);
      setChangeReason('');
      setIsEditingFromRecalc(false);
      setLocalRevision(prev => prev + 1);
      setStatusNotice({
        type: 'success',
        message: `Saved Payment Schedule v${res.newSchedule.scheduleVersion} (Snapshot v${res.newSchedule.financialSnapshotVersion}) with ${res.newSchedule.installments.length} tranche(s) totalling ${formatCurrency(res.newSchedule.totalAmount, currency)}${res.newSchedule.isPartialSchedule ? ` • Unallocated: ${formatCurrency(res.newSchedule.unallocatedBalance || 0, currency)}` : ''}.`
      });
      onRefresh();
    } else {
      setFormError(res.error || 'Failed to save payment schedule.');
    }
  };

  return (
    <div id="desk-payment-schedule-section" className="space-y-6">
      {statusNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            statusNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="font-semibold flex items-center gap-2">
            {statusNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusNotice.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Non-Silent-Overwrite Recalculation Required Banner (Scenario B / C / D) */}
      {needsRecalculation && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 text-xs text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black text-sm">Payment Schedule Requires Recalculation</p>
                <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 font-mono text-[10px] font-black">
                  Schedule v{currentSchedule?.scheduleVersion || 1} → Snapshot v{financials.latestSnapshotVersion}
                </span>
              </div>
              <p className="text-[11px] text-amber-900">
                {currentSchedule?.adjustmentNotice ||
                  `Saved tranche schedule (${formatCurrency(totalScheduledActive, currency)}) differs from the Latest Committed Booking Amount (${formatCurrency(authoritativeTotal, currency)}). Saved tranches were preserved without silent modification.`}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-[11px] text-amber-950">
                <span>
                  Previous Schedule Basis:{' '}
                  <strong>
                    {formatCurrency(
                      currentSchedule?.previousBookingAmount ?? totalScheduledActive,
                      currency
                    )}
                  </strong>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  Revised Booking Amount:{' '}
                  <strong>{formatCurrency(authoritativeTotal, currency)}</strong>
                </span>
              </div>
            </div>
          </div>
          {canManageSchedule && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                disabled={isLoadingPreview}
                onClick={handleOpenRecalculationPreview}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                <span>{isLoadingPreview ? 'Preparing Preview...' : 'Recalculate Payment Schedule'}</span>
              </button>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => startEditing()}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Manual Edit</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Side-by-Side Recalculation Preview Panel (Shown BEFORE saving new schedule version) */}
      {recalcPreview && (
        <div className="bg-white rounded-3xl p-6 border-2 border-amber-400 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                  Preview Before Commit
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Schedule v{recalcPreview.previousScheduleVersion || 1} → v{recalcPreview.nextScheduleVersion} • Linked to Snapshot v{recalcPreview.financialSnapshotVersion}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 mt-1">
                Recalculated Payment Schedule Preview
              </h3>
              <p className="text-xs text-slate-500">
                Review revised tranche amounts derived from the Latest Committed Booking Financial Snapshot before saving version v{recalcPreview.nextScheduleVersion}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRecalcPreview(null)}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer self-start"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Original Booking Amount</span>
              <span className="text-sm font-black font-mono text-slate-800 mt-0.5 block">
                {formatCurrency(recalcPreview.originalBookingAmount, recalcPreview.currency)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold uppercase text-amber-700 block">Approved Discount Total</span>
              <span className="text-sm font-black font-mono text-amber-900 mt-0.5 block">
                -{formatCurrency(recalcPreview.totalDiscountAmount, recalcPreview.currency)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900 text-white border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-teal-300 block">Revised Booking Amount</span>
              <span className="text-sm font-black font-mono mt-0.5 block">
                {formatCurrency(recalcPreview.revisedBookingAmount, recalcPreview.currency)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                Paid / Revised Outstanding
              </span>
              <span className="text-sm font-black font-mono text-emerald-900 mt-0.5 block">
                {formatCurrency(recalcPreview.verifiedPaidAmount, recalcPreview.currency)} /{' '}
                {formatCurrency(recalcPreview.outstandingBalance, recalcPreview.currency)}
              </span>
            </div>
          </div>

          {recalcPreview.warnings.length > 0 && (
            <div className="space-y-2">
              {recalcPreview.warnings.map((w, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Tranche</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Previous Amount</th>
                  <th className="py-2.5 px-3 text-right">Recalculated Amount</th>
                  <th className="py-2.5 px-3 text-right">New Share (%)</th>
                  <th className="py-2.5 px-3 text-right">Change</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recalcPreview.trancheDiffs.map(diff => (
                  <tr key={diff.id} className={diff.isLockedPaid ? 'bg-emerald-50/40' : ''}>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{diff.installmentNumber}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{diff.title}</span>
                        {diff.isLockedPaid && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black inline-flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> Paid Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{diff.dueDate}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {formatCurrency(diff.previousAmount, recalcPreview.currency)} ({diff.previousPercentage}%)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                      {formatCurrency(diff.recalculatedAmount, recalcPreview.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {diff.recalculatedPercentage}%
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        diff.deltaAmount < 0
                          ? 'text-amber-700'
                          : diff.deltaAmount > 0
                            ? 'text-indigo-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {diff.deltaAmount > 0 ? '+' : ''}
                      {formatCurrency(diff.deltaAmount, recalcPreview.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-black uppercase">
                        {diff.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-7 text-xs">
              <label className="block font-bold text-slate-700 mb-1">
                Schedule Version v{recalcPreview.nextScheduleVersion} Audit Reason *
              </label>
              <input
                type="text"
                value={recalcReason}
                onChange={e => setRecalcReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-900"
              />
            </div>
            <div className="md:col-span-5 flex items-center justify-end gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => startEditing(recalcPreview.recalculatedInstallments)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Customize in Editor</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmSaveRecalculatedSchedule}
                className="px-4 py-2.5 rounded-xl bg-[#008f77] hover:bg-[#007360] text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {isSaving
                    ? 'Saving...'
                    : `Save Schedule v${recalcPreview.nextScheduleVersion}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Summary KPIs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Commercial Payment Governance
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold">
                Snapshot v{financials.latestSnapshotVersion}
              </span>
              {currentSchedule?.scheduleVersion && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-mono font-bold">
                  Schedule v{currentSchedule.scheduleVersion}
                </span>
              )}
              {currentSchedule?.isPartialSchedule && (
                <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-black uppercase">
                  Partial Schedule
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Payment Schedule &amp; Instalment Tranches
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Synchronized with Latest Committed Booking Financial Snapshot ({financials.latestSnapshotId}).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {scheduleVersions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowVersionHistory(prev => !prev)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Versions ({scheduleVersions.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAuditLog(prev => !prev)}
              className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit Log ({auditHistory.length})</span>
            </button>
            {canManageSchedule && !isEditing && (
              <button
                type="button"
                onClick={() => startEditing()}
                className="px-4 py-2 rounded-xl bg-[#008f77] hover:bg-[#007360] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Manage / Edit Tranches</span>
              </button>
            )}
          </div>
        </div>

        {/* Authoritative KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Original Amount</span>
            <span className="text-sm font-black font-mono text-slate-800 mt-0.5 block">
              {formatCurrency(originalBookingAmount, currency)}
            </span>
            {totalDiscountApplied > 0 && (
              <span className="text-[10px] text-amber-700 font-mono font-bold block mt-0.5">
                Discount: -{formatCurrency(totalDiscountApplied, currency)}
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800">
            <span className="text-[10px] font-bold uppercase text-teal-300 block">Revised Booking Amount</span>
            <span className="text-base font-black font-mono mt-0.5 block">
              {formatCurrency(authoritativeTotal, currency)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              Snapshot v{financials.latestSnapshotVersion}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Scheduled</span>
            <span className="text-base font-black font-mono text-slate-900 mt-0.5 block">
              {formatCurrency(isEditing ? editTotalScheduled : totalScheduledActive, currency)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              {isEditing ? rows.length : currentInstallments.length} tranche(s)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[10px] font-bold uppercase text-emerald-700 block">Payments Applied</span>
            <span className="text-base font-black font-mono text-emerald-800 mt-0.5 block">
              {formatCurrency(amountReceived, currency)}
            </span>
            {financials.pendingVerificationAmount > 0 && (
              <span className="text-[10px] text-amber-700 font-mono block mt-0.5">
                Pending verify: {formatCurrency(financials.pendingVerificationAmount, currency)}
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
            <span className="text-[10px] font-bold uppercase text-amber-700 block">
              {creditBalance > 0 ? 'Credit / Overpayment' : 'Outstanding Balance'}
            </span>
            <span
              className={`text-base font-black font-mono mt-0.5 block ${
                creditBalance > 0 ? 'text-indigo-700' : 'text-amber-800'
              }`}
            >
              {formatCurrency(creditBalance > 0 ? creditBalance : remainingBalance, currency)}
            </span>
          </div>

          <div
            className={`p-3.5 rounded-2xl border ${
              isEditing
                ? isEditValidAllocation
                  ? 'bg-teal-50/70 border-teal-200'
                  : 'bg-rose-50 border-rose-200'
                : !needsRecalculation
                  ? 'bg-teal-50/70 border-teal-200'
                  : 'bg-amber-50 border-amber-300'
            }`}
          >
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Schedule Status</span>
            {isEditing ? (
              isEditExactMatch ? (
                <span className="text-xs font-black text-teal-800 flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  Matched (100%)
                </span>
              ) : isEditValidAllocation && allowPartialSchedule ? (
                <span className="text-xs font-black text-sky-800 block mt-1">
                  Partial • Unallocated {formatCurrency(editUnallocated, currency)}
                </span>
              ) : (
                <span className="text-xs font-black text-rose-700 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Diff {formatCurrency(editVariance, currency)}
                </span>
              )
            ) : needsRecalculation ? (
              <span className="text-xs font-black text-amber-900 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Recalc Required
              </span>
            ) : isCommittedPartial ? (
              <span className="text-xs font-black text-sky-800 block mt-1">
                Unallocated: {formatCurrency(activeUnallocated, currency)}
              </span>
            ) : (
              <span className="text-xs font-black text-teal-800 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                Synced (100%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Admin Tranche Editor */}
      {isEditing ? (
        <form
          onSubmit={handleSaveSchedule}
          className="bg-white rounded-3xl p-6 border-2 border-teal-300 shadow-sm space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Configure Instalment Tranches ({rows.length}) • Snapshot v{financials.latestSnapshotVersion}
              </h3>
              <p className="text-[11px] text-slate-500">
                Supports Percentage (%) mode (final tranche absorbs rounding to the cent) and Fixed Amount mode. Already-PAID tranches remain locked.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPartialSchedule}
                  onChange={e => {
                    setAllowPartialSchedule(e.target.checked);
                    setFormError(null);
                  }}
                  className="rounded border-sky-300"
                />
                <span>Allow Partial Schedule</span>
              </label>
              <button
                type="button"
                onClick={handleSplitRemainingEqually}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Split Evenly</span>
              </button>
              <button
                type="button"
                onClick={handleAutoBalanceRemaining}
                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auto-Balance Last Tranche</span>
              </button>
              <button
                type="button"
                onClick={handleAddTranche}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tranche</span>
              </button>
            </div>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p>{formError}</p>
                  <p className="text-[11px] font-normal text-rose-700">
                    Your unsaved tranche edits have been preserved. Fix any issue or click Save again to retry safely without creating duplicate versions.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div
                key={row.id}
                className={`p-4 rounded-2xl border space-y-3 ${
                  row.isLockedPaid ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[11px] font-black font-mono flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-black text-slate-800">Tranche #{idx + 1}</span>
                    {!row.isLockedPaid && (
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => handleRowModeChange(idx, 'PERCENTAGE')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer ${
                            row.calculationMode === 'PERCENTAGE'
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          % Share
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRowModeChange(idx, 'FIXED')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer ${
                            row.calculationMode === 'FIXED'
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Fixed Amt
                        </button>
                      </div>
                    )}
                    {row.isLockedPaid && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Paid &amp; Locked
                      </span>
                    )}
                  </div>
                  {!row.isLockedPaid && rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTranche(idx)}
                      className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs">
                  <div className="lg:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Tranche Name *</label>
                    <input
                      type="text"
                      required
                      value={row.title}
                      onChange={e =>
                        setRows(prev => prev.map((r, i) => (i === idx ? { ...r, title: e.target.value } : r)))
                      }
                      placeholder="e.g. Booking Deposit"
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Milestone</label>
                    <input
                      type="text"
                      value={row.milestone}
                      onChange={e =>
                        setRows(prev => prev.map((r, i) => (i === idx ? { ...r, milestone: e.target.value } : r)))
                      }
                      placeholder="e.g. Hotel Cut-off"
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">Description / Payment Terms</label>
                    <input
                      type="text"
                      value={row.description}
                      onChange={e =>
                        setRows(prev => prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))
                      }
                      placeholder="e.g. Wire due 30 days before arrival"
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={row.dueDate}
                      onChange={e =>
                        setRows(prev => prev.map((r, i) => (i === idx ? { ...r, dueDate: e.target.value } : r)))
                      }
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1">% Share</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      disabled={row.isLockedPaid}
                      value={row.percentage}
                      onChange={e => handleRowPercentChange(idx, e.target.value)}
                      className={`w-full p-2 rounded-xl border font-mono font-bold ${
                        row.isLockedPaid
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block font-bold text-slate-700 mb-1">Amt ({currency}) *</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      disabled={row.isLockedPaid}
                      value={row.amount}
                      onChange={e => handleRowAmountChange(idx, e.target.value)}
                      className={`w-full p-2 rounded-xl border font-mono font-bold ${
                        row.isLockedPaid
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Live Reconciliation Strip */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
              isEditValidAllocation
                ? isEditExactMatch
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-sky-50 border-sky-200 text-sky-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex flex-wrap items-center gap-4 font-mono">
              <span>
                Scheduled Sum: <strong>{formatCurrency(editTotalScheduled, currency)}</strong> ({editTotalPercent}%)
              </span>
              <span>
                Revised Booking Amount: <strong>{formatCurrency(authoritativeTotal, currency)}</strong>
              </span>
              {editUnallocated > 0.02 && (
                <span>
                  Unallocated Balance: <strong>{formatCurrency(editUnallocated, currency)}</strong>
                </span>
              )}
            </div>
            <span className="font-black">
              {isEditExactMatch
                ? 'Valid: Matches Revised Booking Amount (100%)'
                : isEditOverAllocated
                  ? `Blocked: Over-allocated by ${formatCurrency(editVariance, currency)}`
                  : allowPartialSchedule
                    ? `Valid Partial Schedule • Unallocated: ${formatCurrency(editUnallocated, currency)}`
                    : `Unallocated Balance: ${formatCurrency(editUnallocated, currency)}`}
            </span>
          </div>

          {/* Audited Reason */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs">
            <label className="block font-bold text-amber-950 mb-1">
              Payment Schedule Version Reason (Audited &amp; Immutable) *
            </label>
            <input
              type="text"
              required
              value={changeReason}
              onChange={e => setChangeReason(e.target.value)}
              placeholder="e.g. Configured 3-tranche corporate instalment schedule against Snapshot v2"
              className="w-full p-2.5 rounded-xl border border-amber-300 bg-white text-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                setIsEditing(false);
                setFormError(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isEditValidAllocation || isSaving}
              className="px-5 py-2 rounded-xl bg-[#008f77] hover:bg-[#007360] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving Version...' : 'Save Payment Schedule Version'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* Read-Only Authoritative Tranches Table */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Active Payment Instalment Tranches ({currentInstallments.length})
              </h3>
              {isCommittedPartial && (
                <p className="text-[11px] font-semibold text-sky-700 mt-0.5">
                  Partial schedule active • Unallocated booking balance: {formatCurrency(activeUnallocated, currency)}
                </p>
              )}
            </div>
            {currentSchedule?.lastAdjustedAt && (
              <span className="text-[11px] text-slate-400">
                Updated {new Date(currentSchedule.lastAdjustedAt).toLocaleString()} by {currentSchedule.lastAdjustedBy || 'Admin'}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Tranche &amp; Milestone</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Mode</th>
                  <th className="py-3 px-4 text-right">Share (%)</th>
                  <th className="py-3 px-4 text-right">Tranche Amount</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Remaining</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentInstallments.map((inst, idx) => {
                  const amt = roundMoney(Number(inst.amount || 0));
                  const paid = roundMoney(Number(inst.paidAmount || 0));
                  const rem = roundMoney(Math.max(0, amt - paid));
                  return (
                    <tr key={inst.id || idx} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-slate-500 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{inst.title}</span>
                          {inst.milestone && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              {inst.milestone}
                            </span>
                          )}
                        </div>
                        {inst.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{inst.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{inst.dueDate || 'TBA'}</td>
                      <td className="py-3 px-4 text-right font-mono text-[10px] text-slate-500 uppercase">
                        {inst.calculationMode || 'PERCENTAGE'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {typeof inst.percentage === 'number' ? `${inst.percentage}%` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(amt, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                        {formatCurrency(paid, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-amber-800">
                        {formatCurrency(rem, currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            inst.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inst.status === 'PARTIAL'
                                ? 'bg-sky-100 text-sky-800'
                                : inst.status === 'OVERDUE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inst.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Immutable Payment Schedule Version History */}
      {showVersionHistory && scheduleVersions.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Immutable Payment Schedule Versions ({scheduleVersions.length})</span>
            </h3>
          </div>
          <div className="space-y-2">
            {scheduleVersions.map(ver => (
              <div
                key={ver.scheduleId || `v-${ver.scheduleVersion}`}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[10px] font-black">
                      v{ver.scheduleVersion || 1}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {ver.scheduleId}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-mono text-[10px] font-bold">
                      Snapshot v{ver.financialSnapshotVersion || 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        ver.scheduleStatus === 'SUPERSEDED'
                          ? 'bg-slate-200 text-slate-700'
                          : ver.scheduleStatus === 'RECALCULATION_REQUIRED'
                            ? 'bg-amber-100 text-amber-900'
                            : ver.scheduleStatus === 'PARTIAL'
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {ver.scheduleStatus || 'ACTIVE'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {ver.createdAt ? new Date(ver.createdAt).toLocaleString() : ver.updatedAt} •{' '}
                    {ver.createdByName || ver.lastAdjustedBy || 'Admin'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 font-mono text-[11px] text-slate-600">
                  <span>
                    Revised Booking:{' '}
                    <strong>{formatCurrency(ver.revisedBookingAmount ?? ver.totalAmount, ver.currency)}</strong>
                  </span>
                  <span>
                    Scheduled: <strong>{formatCurrency(ver.totalAmount, ver.currency)}</strong> ({ver.installments?.length || 0} tranches)
                  </span>
                  {(ver.unallocatedBalance || 0) > 0 && (
                    <span>
                      Unallocated: <strong>{formatCurrency(ver.unallocatedBalance || 0, ver.currency)}</strong>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bank Remittance Proofs & Payment Verification */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Payment Collection &amp; Bank Remittance Proofs</h3>
            <p className="text-[11px] text-slate-400">Record received payments and verify remittance advices against scheduled tranches</p>
          </div>
        </div>
        <div className="p-5">
          <PaymentProofsManager booking={booking} currentUser={currentUser} onRefresh={onRefresh} />
        </div>
      </div>

      {/* Payment Schedule Modification Audit Trail */}
      {showAuditLog && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600" />
              <span>Payment Schedule Audit Trail ({auditHistory.length})</span>
            </h3>
          </div>
          {auditHistory.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No manual schedule modifications recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {auditHistory.map(entry => (
                <div key={entry.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          entry.action === 'FLAGGED_FOR_ADJUSTMENT'
                            ? 'bg-amber-100 text-amber-900'
                            : entry.action === 'TRANCHE_DELETED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-slate-800">{entry.actorName}</span>
                      {entry.scheduleVersion && (
                        <span className="font-mono text-[10px] text-slate-500">
                          Schedule v{entry.scheduleVersion} • Snapshot v{entry.financialSnapshotVersion || 1}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-700">{entry.reason}</p>
                  {entry.trancheSummary && (
                    <p className="text-[11px] font-mono text-slate-500 bg-white p-2 rounded-xl border border-slate-100">
                      {entry.trancheSummary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
