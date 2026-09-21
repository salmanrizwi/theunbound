import React, { useState, useMemo } from 'react';
import { Booking, User, CurrencyCode } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { formatCurrency, convertCurrency } from '../../../services/pricingEngine';
import { isInternalStaff } from '../../../services/permissionEngine';
import { PaymentProofsManager } from '../PaymentProofsManager';
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  Receipt, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Coins, 
  FileText, 
  Calendar, 
  Lock, 
  Percent, 
  Plus, 
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface DeskFinancialsSectionProps {
  booking: Booking;
  currentUser: User | null;
  onNavigateToSection?: (section: any) => void;
  onRefresh: () => void;
}

export const DeskFinancialsSection: React.FC<DeskFinancialsSectionProps> = ({
  booking,
  currentUser,
  onNavigateToSection,
  onRefresh
}) => {
  const db = AppDatabase.getInstance();
  const isInternal = isInternalStaff(currentUser);

  const paymentSummary = db.calculateBookingPaymentSummary(booking);
  const items = db.normalizeServiceItems(booking.items || [], booking);

  // Supplier Commercial Calculations (Internal Only)
  const totalCommercialCost = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.supplierPrice || 0), 0);
  }, [items]);

  const totalSellingPrice = booking.totalAmount || 0;
  const grossMargin = totalSellingPrice - totalCommercialCost;
  const grossMarginPercent = totalSellingPrice > 0 ? Math.round((grossMargin / totalSellingPrice) * 100) : 0;
  const taxOnMargin = grossMargin > 0 ? Math.round(grossMargin * 0.18) : 0; // Standard 18% GST on Margin
  const netMarginRealized = grossMargin - taxOnMargin;

  // Conversion Preview (e.g. from Native Currency to USD / EUR if different)
  const [targetDisplayCurrency, setTargetDisplayCurrency] = useState<CurrencyCode>('USD');
  const convertedSellingPrice = useMemo(() => {
    if (booking.currency === targetDisplayCurrency) return totalSellingPrice;
    try {
      return convertCurrency(totalSellingPrice, booking.currency || 'USD', targetDisplayCurrency);
    } catch {
      return totalSellingPrice;
    }
  }, [totalSellingPrice, booking.currency, targetDisplayCurrency]);

  // Adjustments & Refunds State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'REFUND' | 'COMMERCIAL_CREDIT' | 'FEE_WAIVER' | 'SURCHARGE'>('REFUND');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const handleAddAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(adjustmentAmount);
    if (!amt || amt <= 0) return;

    db.recordBookingActivity({
      eventId: `act-adj-${Date.now()}`,
      bookingId: booking.id,
      eventType: 'PAYMENT_RECORDED',
      previousValue: paymentSummary.paidAmount,
      newValue: adjustmentType === 'REFUND' ? paymentSummary.paidAmount - amt : paymentSummary.paidAmount + amt,
      actorId: currentUser?.id || 'admin',
      actorRole: currentUser?.role || 'FINANCE',
      actorName: currentUser?.name || 'Finance Lead',
      timestamp: new Date().toISOString(),
      metadata: { type: adjustmentType, amount: amt, reason: adjustmentReason },
      description: `Financial Adjustment (${adjustmentType}): ${formatCurrency(amt, booking.currency)} - ${adjustmentReason}`
    }, currentUser);

    setIsAdjustmentModalOpen(false);
    setAdjustmentAmount('');
    setAdjustmentReason('');
    onRefresh();
  };

  const proformaInvoices = useMemo(() => {
    return db.getBookingInvoices(booking.id);
  }, [db, booking.id]);

  return (
    <div id="desk-financials-section" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              Financial Operations & Native Ledger
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs text-slate-500 font-bold">
              Currency: {booking.currency || 'USD'}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Commercial Selling, Payments & Profitability
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Full financial audit trail: customer selling price locked at quotation, authoritative payment tranches, wire proof verifications, and real-time supplier margin realization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToSection && (
            <button
              onClick={() => onNavigateToSection('PROFORMA_INVOICE')}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Proforma Invoice ({proformaInvoices.length})</span>
            </button>
          )}

          {isInternal && (
            <button
              onClick={() => setIsAdjustmentModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Adjustment</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Core Financial Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            Total Selling Price ({booking.currency})
          </span>
          <div className="text-xl font-black text-slate-900 font-mono">
            {formatCurrency(totalSellingPrice, booking.currency)}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
            <span>Snapshot:</span>
            <span className="font-semibold text-slate-700">{items.length} Service Line Items</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            Amount Received
          </span>
          <div className="text-xl font-black text-emerald-700 font-mono">
            {formatCurrency(paymentSummary.paidAmount, booking.currency)}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{totalSellingPrice > 0 ? Math.round((paymentSummary.paidAmount / totalSellingPrice) * 100) : 0}% Collected</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            Balance Outstanding
          </span>
          <div className={`text-xl font-black font-mono ${paymentSummary.pendingAmount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            {formatCurrency(paymentSummary.pendingAmount, booking.currency)}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Status: <strong className="text-slate-700">{booking.paymentStatus || 'PENDING'}</strong></span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            FX Display Conversion
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-800 font-mono">
              {formatCurrency(convertedSellingPrice, targetDisplayCurrency)}
            </span>
            <select
              value={targetDisplayCurrency}
              onChange={e => setTargetDisplayCurrency(e.target.value as CurrencyCode)}
              className="text-[10px] font-bold bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-0.5 text-slate-700"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
              <option value="AED">AED</option>
              <option value="SGD">SGD</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Live Google Finance Rate Simulator
          </div>
        </div>
      </div>

      {/* Internal Staff Commercial Profitability Desk (Restricted from B2B Agents) */}
      {isInternal ? (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>Internal Commercial Margin & Profitability Realization</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                    Confidential
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Strictly hidden from B2B agents and end-clients. Derived from authoritative supplier commercial rates.
                </p>
              </div>
            </div>

            <span className="text-xs font-black text-purple-800 bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl">
              Gross Margin: {grossMarginPercent}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Client Selling</span>
              <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                {formatCurrency(totalSellingPrice, booking.currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Supplier Nett Commercial Cost</span>
              <span className="text-base font-black text-rose-700 font-mono mt-0.5 block">
                {formatCurrency(totalCommercialCost, booking.currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Pre-Tax Gross Margin</span>
              <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                {formatCurrency(grossMargin, booking.currency)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Estimated Net Retained (Post-Tax)</span>
              <span className="text-base font-black text-teal-800 font-mono mt-0.5 block">
                {formatCurrency(netMarginRealized, booking.currency)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          <span>Commercial supplier rates and margin analytics are restricted to internal DMC operations staff.</span>
        </div>
      )}

      {/* Embedded Tranches & Payment Proof Verification */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Payment Tranches & Bank Remittance Proofs</h3>
              <p className="text-[11px] text-slate-400">Scheduled deposit milestones, wire advices, and accountant verification</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <PaymentProofsManager
            booking={booking}
            currentUser={currentUser}
            onRefresh={onRefresh}
          />
        </div>
      </div>

      {/* MODAL: Record Adjustment */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleAddAdjustment} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-teal-600" />
                Record Financial Adjustment
              </h3>
              <button type="button" onClick={() => setIsAdjustmentModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Adjustment Type</label>
                <select
                  value={adjustmentType}
                  onChange={e => setAdjustmentType(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-teal-500"
                >
                  <option value="REFUND">Customer Refund / Cash Back</option>
                  <option value="COMMERCIAL_CREDIT">Commercial Credit Note</option>
                  <option value="FEE_WAIVER">Operational Fee Waiver</option>
                  <option value="SURCHARGE">Late Payment / Amendment Surcharge</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Amount ({booking.currency || 'USD'})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 250"
                  value={adjustmentAmount}
                  onChange={e => setAdjustmentAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 font-mono text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason / Banking Reference</label>
                <textarea
                  required
                  placeholder="Provide explicit operational justification for this financial adjustment..."
                  value={adjustmentReason}
                  onChange={e => setAdjustmentReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-teal-500 h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Save Adjustment to Audit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
