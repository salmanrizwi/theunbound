import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppDatabase } from '../../services/db';
import { cashbackService } from '../../services/cashbackService';
import { UserCashbackConfigPanel } from './UserCashbackConfigPanel';
import {
  User,
  UserBankAccount,
  CashbackWithdrawalRequest,
  BookingCashbackRecord,
  CashbackPolicyConfig,
  WithdrawalStatus
} from '../../types';
import {
  Wallet,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SlidersHorizontal,
  Play,
  RefreshCw,
  ShieldCheck,
  Eye,
  PlusCircle,
  ArrowUpRight,
  Clock,
  Landmark,
  FileSpreadsheet
} from 'lucide-react';

type AdminCashbackTab = 'OVERVIEW_USERS' | 'WITHDRAWALS' | 'BOOKINGS_LEDGER' | 'POLICY' | 'RECONCILIATION';

export const CashbackManagementView: React.FC<{ initialSubTab?: string }> = ({ initialSubTab }) => {
  const { user: currentUser } = useAuth();
  const db = AppDatabase.getInstance();
  const [tick, setTick] = useState(0);

  const resolveInitialTab = (): AdminCashbackTab => {
    const clean = (initialSubTab || '').toUpperCase();
    if (clean === 'WITHDRAWALS') return 'WITHDRAWALS';
    if (clean === 'BOOKINGS_LEDGER' || clean === 'LEDGER') return 'BOOKINGS_LEDGER';
    if (clean === 'POLICY') return 'POLICY';
    if (clean === 'RECONCILIATION' || clean === 'SCHEDULER') return 'RECONCILIATION';
    return 'OVERVIEW_USERS';
  };

  const [activeTab, setActiveTab] = useState<AdminCashbackTab>(resolveInitialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [wdFilterStatus, setWdFilterStatus] = useState<string>('ALL');
  const [usersPage, setUsersPage] = useState(1);
  const [wdPage, setWdPage] = useState(1);
  const [bookingsPage, setBookingsPage] = useState(1);
  const CASHBACK_PAGE_SIZE = 20;
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Payout modal state
  const [payoutTarget, setPayoutTarget] = useState<CashbackWithdrawalRequest | null>(null);
  const [payRef, setPayRef] = useState('');
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [internalNoteInput, setInternalNoteInput] = useState('');

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<CashbackWithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Restricted Unmasked Bank Modal
  const [unmaskedBankModal, setUnmaskedBankModal] = useState<{
    withdrawalId: string;
    bank: UserBankAccount;
  } | null>(null);

  // Manual Adjustment Form
  const [adjUserId, setAdjUserId] = useState('');
  const [adjType, setAdjType] = useState<'ADMIN_CREDIT_ADJUSTMENT' | 'ADMIN_DEBIT_ADJUSTMENT'>('ADMIN_CREDIT_ADJUSTMENT');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjCurrency, setAdjCurrency] = useState('INR');
  const [adjReason, setAdjReason] = useState('');

  // Reconciliation result
  const [reconSummary, setReconSummary] = useState<{
    checkedUsers: number;
    discrepancyCount: number;
    discrepancies: Array<{ userId: string; storedAvailable: number; ledgerAvailable: number }>;
  } | null>(null);

  useEffect(() => {
    return db.subscribeToCollections([
      'cashback_policies',
      'user_cashback_configs',
      'cashback_wallets',
      'booking_cashback_records',
      'cashback_transactions',
      'user_bank_accounts',
      'cashback_withdrawal_requests',
      'cashback_audit_logs',
      'system_users',
      'companies',
      'bookings'
    ], () => setTick((t) => t + 1));
  }, [db]);

  const users = useMemo(() => db.getUsers(), [db, tick]);
  const configs = useMemo(() => cashbackService.getAllUserConfigurations(), [tick]);
  const wallets = useMemo(() => cashbackService.getAllWallets(), [tick]);
  const withdrawals = useMemo(() => cashbackService.getAllWithdrawalRequests(), [tick]);
  const bookingRecords = useMemo(() => cashbackService.getAllBookingCashbackRecords(), [tick]);
  const ledgerTxs = useMemo(() => cashbackService.getAllLedgerTransactions(), [tick]);
  const auditLogs = useMemo(() => cashbackService.getAuditLogs(200), [tick]);
  const metrics = useMemo(() => cashbackService.getDashboardMetrics(), [tick]);
  const policy = useMemo(() => cashbackService.getPolicy(), [tick]);
  const schedulerMeta = useMemo(() => cashbackService.getSchedulerMeta(), [tick]);

  const [policyDraft, setPolicyDraft] = useState<CashbackPolicyConfig>(policy);
  useEffect(() => {
    setPolicyDraft(policy);
  }, [policy.version]);

  const cfgByUid = useMemo(() => {
    const map = new Map<string, (typeof configs)[number]>();
    configs.forEach((c) => map.set(c.userId, c));
    return map;
  }, [configs]);

  const walletByUid = useMemo(() => {
    const map = new Map<string, (typeof wallets)[number]>();
    wallets.forEach((w) => map.set(w.userId, w));
    return map;
  }, [wallets]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (!q) return true;
      const hay = `${u.name || ''} ${u.email || ''} ${u.agencyName || ''} ${u.companyName || ''} ${u.id || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, searchQuery]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (wdFilterStatus !== 'ALL' && w.status !== wdFilterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${w.requestNumber} ${w.userName} ${w.userEmail || ''} ${w.bankSnapshotMasked.bankName} ${w.bankSnapshotMasked.accountNumberMasked}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [withdrawals, wdFilterStatus, searchQuery]);

  useEffect(() => {
    setUsersPage(1);
    setWdPage(1);
  }, [searchQuery, wdFilterStatus]);

  const totalUsersPages = Math.max(1, Math.ceil(filteredUsers.length / CASHBACK_PAGE_SIZE));
  const safeUsersPage = Math.min(usersPage, totalUsersPages);
  const paginatedUsers = useMemo(() => {
    const start = (safeUsersPage - 1) * CASHBACK_PAGE_SIZE;
    return filteredUsers.slice(start, start + CASHBACK_PAGE_SIZE);
  }, [filteredUsers, safeUsersPage]);

  const totalWdPages = Math.max(1, Math.ceil(filteredWithdrawals.length / CASHBACK_PAGE_SIZE));
  const safeWdPage = Math.min(wdPage, totalWdPages);
  const paginatedWithdrawals = useMemo(() => {
    const start = (safeWdPage - 1) * CASHBACK_PAGE_SIZE;
    return filteredWithdrawals.slice(start, start + CASHBACK_PAGE_SIZE);
  }, [filteredWithdrawals, safeWdPage]);

  const totalBookingPages = Math.max(1, Math.ceil(bookingRecords.length / CASHBACK_PAGE_SIZE));
  const safeBookingsPage = Math.min(bookingsPage, totalBookingPages);
  const paginatedBookingRecords = useMemo(() => {
    const start = (safeBookingsPage - 1) * CASHBACK_PAGE_SIZE;
    return bookingRecords.slice(start, start + CASHBACK_PAGE_SIZE);
  }, [bookingRecords, safeBookingsPage]);

  const handleTransitionWithdrawal = (
    wd: CashbackWithdrawalRequest,
    targetStatus: WithdrawalStatus,
    extra?: { paymentReference?: string; paymentMethod?: string; paymentDate?: string; rejectionReason?: string; internalNotes?: string }
  ) => {
    setBannerMsg(null);
    try {
      const updated = cashbackService.transitionWithdrawalRequest({
        withdrawalRequestId: wd.id,
        targetStatus,
        paymentReference: extra?.paymentReference,
        paymentMethod: extra?.paymentMethod,
        paymentDate: extra?.paymentDate,
        rejectionReason: extra?.rejectionReason,
        internalNotes: extra?.internalNotes,
        actor: currentUser
      });
      setBannerMsg({
        type: 'ok',
        text: `Withdrawal ${updated.requestNumber} updated to ${updated.status}.`
      });
      setPayoutTarget(null);
      setRejectTarget(null);
      setTick((t) => t + 1);
    } catch (err: any) {
      setBannerMsg({ type: 'err', text: err?.message || 'Withdrawal transition failed.' });
    }
  };

  const handleViewUnmaskedBank = (wd: CashbackWithdrawalRequest) => {
    setBannerMsg(null);
    try {
      const bank = cashbackService.getUnmaskedBankAccountForFinancePayout({
        bankAccountId: wd.bankAccountId,
        withdrawalRequestId: wd.id,
        actor: currentUser
      });
      if (!bank) {
        setBannerMsg({ type: 'err', text: 'Original bank account record no longer exists (masked snapshot retained).' });
        return;
      }
      setUnmaskedBankModal({ withdrawalId: wd.requestNumber, bank });
      setTick((t) => t + 1);
    } catch (err: any) {
      setBannerMsg({ type: 'err', text: err?.message || 'Unable to inspect payout bank details.' });
    }
  };

  const handleRunSchedulerNow = () => {
    setBannerMsg(null);
    const result = cashbackService.runScheduledAutoCreditBatch({
      actor: currentUser,
      source: 'MANUAL_ADMIN'
    });
    setBannerMsg({
      type: 'ok',
      text: `Scheduler completed: ${result.creditedCount} credited, ${result.heldCount} held, ${result.cancelledCount} cancelled, ${result.skippedCount} waiting.`
    });
    setTick((t) => t + 1);
  };

  const handleRunReconciliation = () => {
    const res = cashbackService.reconcileAllWallets();
    setReconSummary(res);
    setBannerMsg({
      type: res.discrepancyCount === 0 ? 'ok' : 'err',
      text: `Reconciled ${res.checkedUsers} user wallets: ${res.discrepancyCount} discrepancies found and corrected from immutable ledger.`
    });
    setTick((t) => t + 1);
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    try {
      const updated = cashbackService.updatePolicy(policyDraft, currentUser);
      setBannerMsg({
        type: 'ok',
        text: `Saved Cashback Policy v${updated.version} (Credit Delay: ${updated.creditDelayDays}d, Min Withdrawal: ${updated.defaultCurrency} ${updated.minWithdrawalAmount}).`
      });
      setTick((t) => t + 1);
    } catch (err: any) {
      setBannerMsg({ type: 'err', text: err?.message || 'Failed to update cashback policy.' });
    }
  };

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    if (!adjUserId) {
      setBannerMsg({ type: 'err', text: 'Select a target user for manual adjustment.' });
      return;
    }
    try {
      const tx = cashbackService.createManualLedgerAdjustment({
        targetUserId: adjUserId,
        type: adjType,
        amount: Number(adjAmount),
        currency: adjCurrency,
        reason: adjReason,
        actor: currentUser
      });
      setAdjAmount('');
      setAdjReason('');
      setBannerMsg({
        type: 'ok',
        text: `Posted ${tx.type} (${tx.currency} ${tx.amount.toLocaleString()}) for user ${tx.userId}.`
      });
      setTick((t) => t + 1);
    } catch (err: any) {
      setBannerMsg({ type: 'err', text: err?.message || 'Manual adjustment failed.' });
    }
  };

  const handleToggleDisputeHold = (rec: BookingCashbackRecord) => {
    setBannerMsg(null);
    try {
      cashbackService.setBookingDisputeHold({
        bookingId: rec.bookingId,
        isDisputed: !rec.isDisputed,
        reason: !rec.isDisputed ? 'Placed on dispute hold by Finance Admin' : 'Dispute cleared by Finance Admin',
        actor: currentUser
      });
      setBannerMsg({
        type: 'ok',
        text: `Booking ${rec.bookingReference} cashback ${!rec.isDisputed ? 'placed on dispute hold' : 'hold released'}.`
      });
      setTick((t) => t + 1);
    } catch (err: any) {
      setBannerMsg({ type: 'err', text: err?.message || 'Failed to update dispute status.' });
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-slate-900 text-[#00E5C0] text-[10px] font-bold uppercase">
              Finance &amp; Administration
            </span>
            <span className="text-[11px] text-slate-500 font-semibold">
              Global Credit Rule: +{policy.creditDelayDays} Days Post-Travel
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">Cashback &amp; Rewards Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer per-user cashback percentages, monitor post-travel crediting, approve withdrawal payouts, and audit financial ledger reconciliation.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleRunSchedulerNow}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-bold cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Auto-Credit Job Now</span>
          </button>
          <button
            type="button"
            onClick={handleRunReconciliation}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconcile Wallets</span>
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div
          className={`p-3.5 rounded-xl border font-semibold flex items-center space-x-2 ${
            bannerMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {bannerMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{bannerMsg.text}</span>
        </div>
      )}

      {/* Database-Driven Dashboard Metrics (11 Live Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-500">Configured Users</div>
          <div className="text-lg font-black text-slate-900 tabular-nums mt-0.5">{metrics.totalCashbackUsers}</div>
          <div className="text-[10px] text-emerald-700 font-semibold">{metrics.eligibleUsersCount} Eligible Active</div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-500">Pending Cashback</div>
          <div className="text-lg font-black text-amber-600 tabular-nums mt-0.5">
            {policy.defaultCurrency} {(metrics.totalPendingCashback ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400">Waiting +{policy.creditDelayDays}d window</div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-500">Total Credited</div>
          <div className="text-lg font-black text-slate-900 tabular-nums mt-0.5">
            {policy.defaultCurrency} {(metrics.totalCreditedCashback ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400">Ledger credited total</div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-500">Available Wallet Pool</div>
          <div className="text-lg font-black text-emerald-700 tabular-nums mt-0.5">
            {policy.defaultCurrency} {(metrics.totalAvailableForWithdrawal ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400">Withdrawable balance</div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-500">Withdrawal Queue</div>
          <div className="text-lg font-black text-slate-900 tabular-nums mt-0.5">
            {metrics.pendingWithdrawalRequests ?? 0} Pending
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.approvedWithdrawalsCount ?? 0} Approved · {metrics.rejectedWithdrawalsCount ?? 0} Rejected
          </div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200">
          <div className="text-[10px] font-bold uppercase text-slate-500">Total Paid Out</div>
          <div className="text-lg font-black text-slate-900 tabular-nums mt-0.5">
            {policy.defaultCurrency} {(metrics.totalPaidOut ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.paidWithdrawalsCount ?? 0} / {metrics.totalWithdrawalRequests ?? 0} Requests Paid
          </div>
        </div>
      </div>

      {/* Module Sub-Tabs */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 px-4 flex items-center space-x-2 overflow-x-auto">
          {(
            [
              { id: 'OVERVIEW_USERS', label: 'User Eligibility & Wallets', icon: Wallet },
              { id: 'WITHDRAWALS', label: `Withdrawal Approvals (${withdrawals.length})`, icon: Landmark },
              { id: 'BOOKINGS_LEDGER', label: `Bookings & Ledger (${bookingRecords.length})`, icon: FileSpreadsheet },
              { id: 'POLICY', label: 'Policy Rules', icon: SlidersHorizontal },
              { id: 'RECONCILIATION', label: 'Reconciliation & Audit', icon: ShieldCheck }
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`py-3 px-3 font-bold border-b-2 flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  active ? 'border-[#00C6A6] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* SUBTAB 1: USER ELIGIBILITY & WALLETS */}
        {activeTab === 'OVERVIEW_USERS' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users by name, email, agency, or UID..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Each user account maintains isolated eligibility, cashback rate, and wallet balances.
              </div>
            </div>

            {editingUser && (
              <div className="space-y-2 border border-emerald-300 rounded-xl p-2 bg-emerald-50/30">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="font-bold text-slate-900">
                    Configuring Cashback for {editingUser.name} ({editingUser.email})
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Close Panel
                  </button>
                </div>
                <UserCashbackConfigPanel
                  targetUser={editingUser}
                  currentUser={currentUser}
                  onUpdated={() => setTick((t) => t + 1)}
                />
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">User &amp; Agency</th>
                    <th className="py-2.5 px-3">Eligibility</th>
                    <th className="py-2.5 px-3 text-right">Rate (%)</th>
                    <th className="py-2.5 px-3 text-right">Pending</th>
                    <th className="py-2.5 px-3 text-right">Available</th>
                    <th className="py-2.5 px-3 text-right">Held</th>
                    <th className="py-2.5 px-3 text-right">Withdrawn</th>
                    <th className="py-2.5 px-3 text-right">Configure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUsers.map((u) => {
                    const cfg = cfgByUid.get(u.id);
                    const w = walletByUid.get(u.id);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                          {(u.agencyName || u.companyName) && (
                            <div className="text-[10px] text-slate-400">{u.agencyName || u.companyName}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {cfg && cfg.isEligible && cfg.status === 'ACTIVE' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              ACTIVE
                            </span>
                          ) : cfg ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                              {cfg.status}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Not Configured</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                          {cfg ? `${cfg.cashbackPercent}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">
                          {w ? `${w.primaryCurrency || policy.defaultCurrency} ${(w.pendingCashback ?? 0).toLocaleString()}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-700">
                          {w ? `${w.primaryCurrency || policy.defaultCurrency} ${(w.availableBalance ?? 0).toLocaleString()}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                          {w ? `${w.primaryCurrency || policy.defaultCurrency} ${(w.withdrawalPendingBalance ?? 0).toLocaleString()}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                          {w ? `${w.primaryCurrency || policy.defaultCurrency} ${(w.totalWithdrawn ?? 0).toLocaleString()}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingUser(u)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                          >
                            Configure %
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalUsersPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-600">
                <span>
                  Showing {(safeUsersPage - 1) * CASHBACK_PAGE_SIZE + 1}–{Math.min(safeUsersPage * CASHBACK_PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={safeUsersPage <= 1}
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded border border-slate-200 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="font-mono font-bold text-slate-900">
                    {safeUsersPage} / {totalUsersPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeUsersPage >= totalUsersPages}
                    onClick={() => setUsersPage((p) => Math.min(totalUsersPages, p + 1))}
                    className="px-2.5 py-1 rounded border border-slate-200 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: WITHDRAWAL APPROVAL QUEUE */}
        {activeTab === 'WITHDRAWALS' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                {['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setWdFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border cursor-pointer ${
                      wdFilterStatus === st
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredWithdrawals.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No withdrawal requests match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Request ID</th>
                      <th className="py-2.5 px-3">User / Agency</th>
                      <th className="py-2.5 px-3">Bank Snapshot (Masked)</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Finance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedWithdrawals.map((wd) => (
                      <tr key={wd.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          <div>{wd.requestNumber}</div>
                          <div className="text-[10px] font-sans font-normal text-slate-400">
                            {new Date(wd.submittedAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{wd.userName}</div>
                          <div className="text-[11px] text-slate-500">{wd.userEmail}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{wd.bankSnapshotMasked.bankName}</div>
                          <div className="font-mono text-[11px] text-slate-600">
                            {wd.bankSnapshotMasked.accountNumberMasked}
                            {wd.bankSnapshotMasked.ifscCode ? ` · ${wd.bankSnapshotMasked.ifscCode}` : ''}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleViewUnmaskedBank(wd)}
                            className="mt-1 inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Payout Details (Audited)</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                          {wd.currency} {(wd.requestedAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              wd.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : wd.status === 'REJECTED' || wd.status === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {wd.status}
                          </span>
                          {wd.paymentReference && (
                            <div className="text-[10px] font-mono text-emerald-700 mt-0.5">
                              Ref: {wd.paymentReference}
                            </div>
                          )}
                          {wd.rejectionReason && (
                            <div className="text-[10px] text-rose-600 mt-0.5">{wd.rejectionReason}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                          {wd.status === 'SUBMITTED' && (
                            <button
                              type="button"
                              onClick={() => handleTransitionWithdrawal(wd, 'UNDER_REVIEW')}
                              className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold cursor-pointer"
                            >
                              Review
                            </button>
                          )}
                          {(wd.status === 'SUBMITTED' || wd.status === 'UNDER_REVIEW') && (
                            <button
                              type="button"
                              onClick={() => handleTransitionWithdrawal(wd, 'APPROVED')}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {wd.status === 'APPROVED' && (
                            <button
                              type="button"
                              onClick={() => handleTransitionWithdrawal(wd, 'PROCESSING')}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                            >
                              Processing
                            </button>
                          )}
                          {(wd.status === 'APPROVED' || wd.status === 'PROCESSING') && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayoutTarget(wd);
                                setPayRef('');
                                setPayMethod('BANK_TRANSFER');
                                setPayDate(new Date().toISOString().slice(0, 10));
                                setInternalNoteInput(wd.internalNotes || '');
                              }}
                              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          )}
                          {(wd.status === 'SUBMITTED' ||
                            wd.status === 'UNDER_REVIEW' ||
                            wd.status === 'APPROVED' ||
                            wd.status === 'PROCESSING') && (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectTarget(wd);
                                setRejectReason('');
                              }}
                              className="px-2.5 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalWdPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-600">
                <span>
                  Showing {(safeWdPage - 1) * CASHBACK_PAGE_SIZE + 1}–{Math.min(safeWdPage * CASHBACK_PAGE_SIZE, filteredWithdrawals.length)} of {filteredWithdrawals.length} withdrawals
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={safeWdPage <= 1}
                    onClick={() => setWdPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded border border-slate-200 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="font-mono font-bold text-slate-900">
                    {safeWdPage} / {totalWdPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeWdPage >= totalWdPages}
                    onClick={() => setWdPage((p) => Math.min(totalWdPages, p + 1))}
                    className="px-2.5 py-1 rounded border border-slate-200 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 3: BOOKINGS CASHBACK BREAKDOWN & MANUAL ADJUSTMENTS */}
        {activeTab === 'BOOKINGS_LEDGER' && (
          <div className="p-5 space-y-6">
            {/* Manual Ledger Adjustment Form */}
            <form onSubmit={handleSubmitAdjustment} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>Audited Manual Cashback Ledger Adjustment</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <select
                  value={adjUserId}
                  onChange={(e) => setAdjUserId(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">Select user account...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="ADMIN_CREDIT_ADJUSTMENT">+ Credit Adjustment</option>
                  <option value="ADMIN_DEBIT_ADJUSTMENT">- Debit Adjustment</option>
                </select>
                <div className="flex space-x-1">
                  <select
                    value={adjCurrency}
                    onChange={(e) => setAdjCurrency(e.target.value)}
                    className="px-2 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Mandatory audit reason..."
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Post Adjustment
                </button>
              </div>
            </form>

            {/* Booking Cashback Records */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900">Booking Cashback Snapshots &amp; Schedules ({bookingRecords.length})</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Booking</th>
                      <th className="py-2 px-3">User</th>
                      <th className="py-2 px-3 text-right">Booking Total</th>
                      <th className="py-2 px-3 text-right">Hotel Excluded</th>
                      <th className="py-2 px-3 text-right">Eligible Land Part</th>
                      <th className="py-2 px-3 text-right">Snapshot %</th>
                      <th className="py-2 px-3 text-right">Cashback</th>
                      <th className="py-2 px-3">Credit Schedule</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Dispute Hold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedBookingRecords.map((r) => {
                      const hotelExcluded = r.hotelAccommodationTotal ?? r.componentBreakdown?.hotelAccommodationTotal ?? 0;
                      const landEligible = r.landPartTotal ?? r.eligibleAmount ?? 0;
                      const bookingTot = r.bookingTotalSnapshot ?? (landEligible + hotelExcluded);
                      const landItems = r.componentBreakdown?.landPartLineItems || [];
                      const excludedHotels = r.componentBreakdown?.excludedAccommodationItems || [];
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">
                            <div>{r.bookingReference}</div>
                            <div className="text-[10px] font-normal text-slate-400">{r.destinationName || '-'}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-700">{r.userName}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                            {r.currency} {bookingTot.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                            <div>{hotelExcluded > 0 ? `${r.currency} ${hotelExcluded.toLocaleString()}` : '—'}</div>
                            {excludedHotels.length > 0 && (
                              <div className="text-[10px] text-slate-400" title={excludedHotels.map((i) => i.title).join(', ')}>
                                {excludedHotels.length} hotel item{excludedHotels.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-800">
                            <div>{r.currency} {landEligible.toLocaleString()}</div>
                            {landItems.length > 0 && (
                              <div className="text-[10px] font-normal text-slate-400" title={landItems.map((i) => i.title).join(', ')}>
                                {landItems.length} land item{landItems.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold">{r.cashbackPercent}%</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">
                            {r.currency} {(r.remainingCashbackAmount ?? r.cashbackAmount ?? 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 tabular-nums text-slate-600">
                            {r.status === 'NOT_ELIGIBLE' ? '—' : r.scheduledCreditDate}
                            <span className="block text-[10px] text-slate-400">{r.destinationTimezone}</span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'CREDITED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : r.status === 'NOT_ELIGIBLE'
                                    ? 'bg-slate-100 text-slate-600'
                                    : r.status === 'HELD'
                                      ? 'bg-orange-50 text-orange-800'
                                      : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {r.status}
                            </span>
                            {r.verificationStatus === 'UNVERIFIED_HOLD' && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-bold">
                                UNVERIFIED_HOLD
                              </span>
                            )}
                            {r.holdReason && <div className="text-[10px] text-rose-600 mt-0.5">{r.holdReason}</div>}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {(r.status === 'PENDING' || r.status === 'HELD') && (
                              <button
                                type="button"
                                onClick={() => handleToggleDisputeHold(r)}
                                className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-bold cursor-pointer"
                              >
                                {r.isDisputed ? 'Release Hold' : 'Hold Dispute'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {bookingRecords.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No booking cashback records created yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalBookingPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-[11px] text-slate-600">
                  <span>
                    Showing {(safeBookingsPage - 1) * CASHBACK_PAGE_SIZE + 1}–{Math.min(safeBookingsPage * CASHBACK_PAGE_SIZE, bookingRecords.length)} of {bookingRecords.length} booking records
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={safeBookingsPage <= 1}
                      onClick={() => setBookingsPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded border border-slate-200 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <span className="font-mono font-bold text-slate-900">
                      {safeBookingsPage} / {totalBookingPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeBookingsPage >= totalBookingPages}
                      onClick={() => setBookingsPage((p) => Math.min(totalBookingPages, p + 1))}
                      className="px-2.5 py-1 rounded border border-slate-200 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Ledger Transactions */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-900">Global Financial Cashback Ledger ({ledgerTxs.length})</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">User UID</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerTxs.slice(0, 50).map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2 px-3 tabular-nums text-slate-500">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700">{tx.userId}</td>
                        <td className="py-2 px-3 font-mono text-[10px] font-bold text-slate-900">{tx.type}</td>
                        <td className="py-2 px-3 text-slate-700">{tx.description}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold">
                          {tx.currency} {(tx.amount ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: CASHBACK POLICY CONFIGURATION */}
        {activeTab === 'POLICY' && (
          <form onSubmit={handleSavePolicy} className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Post-Travel Credit Delay (Days)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={policyDraft.creditDelayDays}
                  onChange={(e) => setPolicyDraft({ ...policyDraft, creditDelayDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Minimum Withdrawal Amount</label>
                <input
                  type="number"
                  min={0}
                  value={policyDraft.minWithdrawalAmount}
                  onChange={(e) => setPolicyDraft({ ...policyDraft, minWithdrawalAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Maximum Single Withdrawal</label>
                <input
                  type="number"
                  min={0}
                  value={policyDraft.maxWithdrawalAmount}
                  onChange={(e) => setPolicyDraft({ ...policyDraft, maxWithdrawalAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Max Allowed Cashback % Ceiling</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  step="0.5"
                  value={policyDraft.maxCashbackPercentCeiling}
                  onChange={(e) =>
                    setPolicyDraft({ ...policyDraft, maxCashbackPercentCeiling: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Default Wallet Currency</label>
                <select
                  value={policyDraft.defaultCurrency}
                  onChange={(e) => setPolicyDraft({ ...policyDraft, defaultCurrency: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyDraft.requireFullPaymentBeforeCredit}
                  onChange={(e) =>
                    setPolicyDraft({ ...policyDraft, requireFullPaymentBeforeCredit: e.target.checked })
                  }
                />
                <span className="font-semibold text-slate-700">Require Full Payment Before Credit</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyDraft.requireConfirmedBookingStatus}
                  onChange={(e) =>
                    setPolicyDraft({ ...policyDraft, requireConfirmedBookingStatus: e.target.checked })
                  }
                />
                <span className="font-semibold text-slate-700">Require Confirmed Booking Status</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyDraft.eligibleComponents.includeTaxes}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      eligibleComponents: { ...policyDraft.eligibleComponents, includeTaxes: e.target.checked }
                    })
                  }
                />
                <span className="font-semibold text-slate-700">Include Taxes in Eligible Base</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyDraft.eligibleComponents.includeServiceFees}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      eligibleComponents: {
                        ...policyDraft.eligibleComponents,
                        includeServiceFees: e.target.checked
                      }
                    })
                  }
                />
                <span className="font-semibold text-slate-700">Include Service Fees</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyDraft.eligibleComponents.deductDiscounts}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      eligibleComponents: {
                        ...policyDraft.eligibleComponents,
                        deductDiscounts: e.target.checked
                      }
                    })
                  }
                />
                <span className="font-semibold text-slate-700">Deduct Promotional Discounts</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyDraft.showCashbackTabToIneligibleUsers}
                  onChange={(e) =>
                    setPolicyDraft({ ...policyDraft, showCashbackTabToIneligibleUsers: e.target.checked })
                  }
                />
                <span className="font-semibold text-slate-700">Show Informational Tab to Ineligible Users</span>
              </label>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-100/80 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">
                    Hotel &amp; Accommodation Cashback: Always Excluded (Mandatory Land-Part-Only Rule)
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Cashback applies strictly to Land Part Total (Tours, Activities, Transfers, Rail, Guides, Visas, Ground Packages). Hotels, ryokans, and accommodation packages are locked at 0% eligibility.
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-[10px] font-bold uppercase shrink-0">
                Locked: Excluded
              </span>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
              >
                Save Global Cashback Policy (v{policy.version})
              </button>
            </div>
          </form>
        )}

        {/* SUBTAB 5: RECONCILIATION, SCHEDULER & AUDIT LOG */}
        {activeTab === 'RECONCILIATION' && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Scheduled Auto-Credit Execution Status</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Last Run: <strong>{schedulerMeta.lastRunAt ? new Date(schedulerMeta.lastRunAt).toLocaleString() : 'Not yet triggered'}</strong>
                </div>
                <div className="text-[11px] text-slate-600">
                  Last Result: Credited {schedulerMeta.creditedCount ?? 0} · Held {schedulerMeta.heldCount ?? 0} · Cancelled {schedulerMeta.cancelledCount ?? 0} · Waiting {schedulerMeta.skippedCount ?? 0}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="font-bold text-slate-900">Ledger-to-Wallet Reconciliation Status</div>
                {reconSummary ? (
                  <div className="text-[11px] text-slate-700">
                    Checked <strong>{reconSummary.checkedUsers}</strong> wallets ·{' '}
                    <strong>{reconSummary.discrepancyCount}</strong> discrepancies repaired.
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    Click &ldquo;Reconcile Wallets&rdquo; above to verify every wallet bucket against immutable ledger transactions.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-slate-900">Cashback Audit Log ({auditLogs.length})</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Actor</th>
                      <th className="py-2 px-3">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.slice(0, 60).map((log) => (
                      <tr key={log.id}>
                        <td className="py-2 px-3 tabular-nums text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono text-[10px] font-bold text-slate-900">{log.action}</td>
                        <td className="py-2 px-3 text-slate-700">{log.actorName}</td>
                        <td className="py-2 px-3 text-slate-700">{log.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MARK PAID MODAL */}
      {payoutTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900">
              Complete Cashback Payout · {payoutTarget.requestNumber}
            </h3>
            <div className="text-[11px] text-slate-600">
              Amount: <strong>{payoutTarget.currency} {(payoutTarget.requestedAmount ?? 0).toLocaleString()}</strong> to{' '}
              {payoutTarget.bankSnapshotMasked.bankName} ({payoutTarget.bankSnapshotMasked.accountNumberMasked})
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Reference / UTR *</label>
                <input
                  type="text"
                  required
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UTR-HDFC-9928172"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="BANK_TRANSFER">NEFT / RTGS / IMPS</option>
                    <option value="WIRE">International Wire</option>
                    <option value="INTERNAL_SETTLEMENT">Partner Settlement</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Internal Finance Notes</label>
                <input
                  type="text"
                  value={internalNoteInput}
                  onChange={(e) => setInternalNoteInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayoutTarget(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransitionWithdrawal(payoutTarget, 'PAID', {
                    paymentReference: payRef,
                    paymentMethod: payMethod,
                    paymentDate: payDate,
                    internalNotes: internalNoteInput
                  })
                }
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                Confirm Payout Settled
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT WITHDRAWAL MODAL */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-black text-rose-800">
              Reject Withdrawal · {rejectTarget.requestNumber}
            </h3>
            <p className="text-[11px] text-slate-600">
              Rejecting this withdrawal will release the held {rejectTarget.currency} {(rejectTarget.requestedAmount ?? 0).toLocaleString()} back into the user&apos;s available cashback balance.
            </p>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mandatory Rejection Reason *</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Specify exact bank mismatch, compliance, or booking adjustment reason..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTransitionWithdrawal(rejectTarget, 'REJECTED', {
                    rejectionReason: rejectReason
                  })
                }
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                Reject &amp; Release Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTRICTED FINANCE-ONLY UNMASKED PAYOUT BANK MODAL */}
      {unmaskedBankModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-3">
            <div className="flex items-center space-x-2 text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-bold">
                Sensitive Payout Bank View Logged in Security Audit Trail
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900">
              Payout Bank Details · {unmaskedBankModal.withdrawalId}
            </h3>
            <div className="space-y-1.5 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div><strong>Holder Name:</strong> {unmaskedBankModal.bank.accountHolderName}</div>
              <div><strong>Bank:</strong> {unmaskedBankModal.bank.bankName}</div>
              <div>
                <strong>Account Number:</strong>{' '}
                <span className="font-mono font-bold text-slate-900">
                  {unmaskedBankModal.bank.accountNumberStored || unmaskedBankModal.bank.accountNumberMasked}
                </span>
              </div>
              {unmaskedBankModal.bank.ifscCode && (
                <div><strong>IFSC:</strong> <span className="font-mono">{unmaskedBankModal.bank.ifscCode}</span></div>
              )}
              {unmaskedBankModal.bank.swiftCode && (
                <div><strong>SWIFT:</strong> <span className="font-mono">{unmaskedBankModal.bank.swiftCode}</span></div>
              )}
              {unmaskedBankModal.bank.iban && (
                <div><strong>IBAN:</strong> <span className="font-mono">{unmaskedBankModal.bank.iban}</span></div>
              )}
              <div><strong>Country / Currency:</strong> {unmaskedBankModal.bank.country} / {unmaskedBankModal.bank.currency}</div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setUnmaskedBankModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
