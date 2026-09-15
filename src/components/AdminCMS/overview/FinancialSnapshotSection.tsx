import React from 'react';
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  AlertCircle, 
  Lock, 
  ArrowUpRight, 
  ChevronRight, 
  PieChart, 
  Wallet, 
  Receipt, 
  ShieldCheck,
  Building
} from 'lucide-react';
import { Booking, CurrencyCode, User } from '../../../types';
import { CurrencyEngine } from '../../../services/currencyEngine';

interface FinancialSnapshotSectionProps {
  bookings: Booking[];
  currency: CurrencyCode;
  currentUser: User | null;
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
}

export const FinancialSnapshotSection: React.FC<FinancialSnapshotSectionProps> = ({
  bookings,
  currency,
  currentUser,
  onNavigate
}) => {
  const fx = CurrencyEngine.getInstance();

  // Role authorization check: Admin, Finance, or explicit canAccessFinancials flag
  const isAuthorized = currentUser 
    ? (currentUser.role === 'ADMIN' || currentUser.role === 'FINANCE' || currentUser.permissions?.canAccessFinancials === true)
    : false;

  // Aggregate authoritative metrics across all bookings in selected currency
  const activeBookings = bookings.filter(b => b.status !== 'CANCELLED');
  const confirmedBookings = activeBookings.filter(b => b.status === 'CONFIRMED');

  let totalGrossBookingValue = 0;
  let totalReceivedPayments = 0;
  let totalOutstandingReceivables = 0;
  let totalOverdueReceivables = 0;
  let totalSupplierPayables = 0;
  let depositPaymentsReceived = 0;
  let balancePaymentsPending = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  activeBookings.forEach(b => {
    const bookingCurrency = b.currency || 'USD';
    const sellingPrice = b.totalAmount || b.finalCustomerSellingPrice || 0;
    const convertedSelling = fx.convert(sellingPrice, bookingCurrency, currency);
    totalGrossBookingValue += convertedSelling;

    // Payments received calculation
    if (b.paidAmount && b.paidAmount > 0) {
      totalReceivedPayments += fx.convert(b.paidAmount, bookingCurrency, currency);
    }

    // Outstanding calculation
    if (b.paymentStatus === 'PAID') {
      // fully paid
    } else {
      const remaining = Math.max(0, sellingPrice - (b.paidAmount || 0));
      const convertedRemaining = fx.convert(remaining, bookingCurrency, currency);
      totalOutstandingReceivables += convertedRemaining;

      // Check overdue status
      const isOverdue = b.paymentStatus === 'OVERDUE' || (b.paymentCutoffDate && b.paymentCutoffDate < todayStr);
      if (isOverdue) {
        totalOverdueReceivables += convertedRemaining;
      }
    }

    // Schedule breakdown
    if (b.paymentSchedule?.tranches) {
      b.paymentSchedule.tranches.forEach(tranche => {
        const trancheConverted = fx.convert(tranche.amount || 0, bookingCurrency, currency);
        if (tranche.status === 'PAID') {
          if (tranche.type === 'DEPOSIT' || tranche.name?.toLowerCase().includes('deposit')) {
            depositPaymentsReceived += trancheConverted;
          }
        } else {
          if (tranche.type === 'BALANCE' || tranche.name?.toLowerCase().includes('balance')) {
            balancePaymentsPending += trancheConverted;
          }
        }
      });
    }

    // Internal supplier cost calculation (strictly for authorized roles)
    if (isAuthorized) {
      if (b.items) {
        b.items.forEach(it => {
          if (it.netCost || it.costPrice) {
            const costVal = it.netCost || it.costPrice || 0;
            totalSupplierPayables += fx.convert(costVal, it.costCurrency || bookingCurrency, currency);
          }
        });
      }
    }
  });

  const estimatedGrossMargin = totalGrossBookingValue - totalSupplierPayables;
  const marginPercentage = totalGrossBookingValue > 0 
    ? Math.round((estimatedGrossMargin / totalGrossBookingValue) * 100) 
    : 0;

  const collectionRate = totalGrossBookingValue > 0
    ? Math.round((totalReceivedPayments / totalGrossBookingValue) * 100)
    : 0;

  return (
    <section id="cms-financial-snapshot-section" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Authoritative Financial Snapshot
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Customer receivables, settlement compliance, deposit tranches and operational payables.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-goto-finance-ledger"
            onClick={() => onNavigate('BOOKING_MANAGEMENT', 'PAYMENTS')}
            className="flex items-center space-x-1 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <span>View Payments Ledger</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {!isAuthorized ? (
        /* Role-gated fallback */
        <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto border border-slate-200">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">Financial Ledger Access Restricted</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Internal pricing margins, net supplier settlements, and organizational receivables are restricted to Admin and Finance management profiles.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 4 Core Financial KPI Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Gross Booking Value */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Gross Booking Value</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {fx.format(totalGrossBookingValue, currency)}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                <span>{confirmedBookings.length} confirmed bookings</span>
              </div>
            </div>

            {/* 2. Received Payments */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Realized Receipts</span>
                <Receipt className="w-4 h-4 text-[#008972]" />
              </div>
              <div className="text-2xl font-black text-[#008972] tracking-tight">
                {fx.format(totalReceivedPayments, currency)}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                <span className="font-bold text-emerald-700">{collectionRate}% collection rate</span>
              </div>
            </div>

            {/* 3. Outstanding Receivables */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Outstanding Receivables</span>
                <CreditCard className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-700 tracking-tight">
                {fx.format(totalOutstandingReceivables, currency)}
              </div>
              <div className="text-[11px] text-slate-500">
                {totalOverdueReceivables > 0 ? (
                  <span className="text-rose-600 font-extrabold flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{fx.format(totalOverdueReceivables, currency)} Overdue</span>
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold">No overdue tranches</span>
                )}
              </div>
            </div>

            {/* 4. Estimated Ground Margin */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Estimated Gross Margin</span>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-purple-900 tracking-tight">
                {marginPercentage}%
              </div>
              <div className="text-[11px] text-slate-500">
                <span>Est. Net {fx.format(estimatedGrossMargin, currency)}</span>
              </div>
            </div>
          </div>

          {/* Cashflow & Tranche Breakdown Progress Bars */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Progress: Collection Status */}
            <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                <span>Client Collection Health</span>
                <span className="text-emerald-700">{collectionRate}% Received</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${Math.min(100, collectionRate)}%` }} 
                  className="bg-[#008972] h-full"
                  title={`Collected: ${fx.format(totalReceivedPayments, currency)}`}
                />
                <div 
                  style={{ width: `${Math.min(100, Math.max(0, 100 - collectionRate))}%` }} 
                  className="bg-amber-400 h-full"
                  title={`Pending: ${fx.format(totalOutstandingReceivables, currency)}`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#008972]" />
                  <span>Collected: {fx.format(totalReceivedPayments, currency)}</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Pending: {fx.format(totalOutstandingReceivables, currency)}</span>
                </span>
              </div>
            </div>

            {/* Supplier Payables Commitment */}
            <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                <span>Supplier Payables Commitment</span>
                <span className="text-slate-600 font-mono text-xs">{fx.format(totalSupplierPayables, currency)}</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${Math.min(100, Math.max(10, Math.round((totalSupplierPayables / (totalGrossBookingValue || 1)) * 100)))}%` }} 
                  className="bg-slate-700 h-full"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Hotels, ground transport, activities & guides</span>
                <span className="font-bold text-slate-700">Contracted Cost Base</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
