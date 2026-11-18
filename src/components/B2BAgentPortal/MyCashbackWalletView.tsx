import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppDatabase } from '../../services/db';
import { cashbackService } from '../../services/cashbackService';
import { validateBankAccountInput, roundMoney } from '../../services/cashbackEngine';
import {
  BookingCashbackRecord,
  CashbackLedgerTransaction,
  CashbackCurrencyBucket,
  UserBankAccount,
  CashbackWithdrawalRequest
} from '../../types';
import {
  Wallet,
  Clock,
  CheckCircle2,
  ArrowDownToLine,
  Landmark,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Info,
  Receipt,
  Ban
} from 'lucide-react';

type WalletTab = 'OVERVIEW' | 'TRANSACTIONS' | 'PENDING' | 'WITHDRAWALS' | 'BANK_ACCOUNTS';

export const MyCashbackWalletView: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [activeTab, setActiveTab] = useState<WalletTab>('OVERVIEW');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return db.subscribeToCollections([
      'cashback_policies',
      'user_cashback_configs',
      'cashback_wallets',
      'booking_cashback_records',
      'cashback_transactions',
      'user_bank_accounts',
      'cashback_withdrawal_requests',
      'bookings',
      'system_users'
    ], () => setTick((t) => t + 1));
  }, [db]);

  const userId = user?.id || '';
  const policy = useMemo(() => cashbackService.getPolicy(), [tick]);
  const config = useMemo(() => cashbackService.getUserConfiguration(userId), [userId, tick]);
  const wallet = useMemo(() => cashbackService.getWalletForUser(userId), [userId, tick]);
  const bookingRecords = useMemo<BookingCashbackRecord[]>(
    () => cashbackService.getBookingCashbackRecordsForUser(userId, true),
    [userId, tick]
  );
  const transactions = useMemo<CashbackLedgerTransaction[]>(
    () => cashbackService.getLedgerTransactionsForUser(userId),
    [userId, tick]
  );
  const bankAccounts = useMemo<UserBankAccount[]>(
    () => cashbackService.getBankAccountsForUser(userId, true),
    [userId, tick]
  );
  const withdrawals = useMemo<CashbackWithdrawalRequest[]>(
    () => cashbackService.getWithdrawalRequestsForUser(userId),
    [userId, tick]
  );

  // Withdrawal Form State
  const [wdAmount, setWdAmount] = useState<string>('');
  const [wdCurrency, setWdCurrency] = useState<string>(wallet.primaryCurrency || policy.defaultCurrency || 'INR');
  const [wdBankId, setWdBankId] = useState<string>('');
  const [wdNotes, setWdNotes] = useState<string>('');
  const [wdError, setWdError] = useState<string | null>(null);
  const [wdSuccess, setWdSuccess] = useState<string | null>(null);

  useEffect(() => {
    const def = bankAccounts.find((b) => b.isDefault) || bankAccounts[0];
    if (def && !wdBankId) setWdBankId(def.id);
  }, [bankAccounts, wdBankId]);

  useEffect(() => {
    const currencies = Object.keys(wallet.balancesByCurrency || {});
    if (currencies.length > 0 && !currencies.includes(wdCurrency)) {
      setWdCurrency(currencies[0]);
    }
  }, [wallet.balancesByCurrency, wdCurrency]);

  // Bank Account Form State
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | undefined>(undefined);
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'SAVINGS' | 'CURRENT'>('CURRENT');
  const [ifscCode, setIfscCode] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [iban, setIban] = useState('');
  const [bankCountry, setBankCountry] = useState('India');
  const [bankCurrency, setBankCurrency] = useState('INR');
  const [isDefaultBank, setIsDefaultBank] = useState(true);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSuccess, setBankSuccess] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Sign in with your verified B2B account to view your Cashback &amp; Rewards Wallet.
      </div>
    );
  }

  const isEligibleActive = Boolean(config && config.isEligible && config.status === 'ACTIVE');
  const availableForSelectedCurrency = wallet.balancesByCurrency[wdCurrency]?.availableBalance ?? 0;

  const handleOpenAddBank = () => {
    setEditingBankId(undefined);
    setHolderName(user.name || '');
    setBankName('');
    setBranchName('');
    setAccountNumber('');
    setAccountType('CURRENT');
    setIfscCode('');
    setSwiftCode('');
    setIban('');
    setBankCountry('India');
    setBankCurrency('INR');
    setIsDefaultBank(bankAccounts.length === 0);
    setBankError(null);
    setShowBankForm(true);
  };

  const handleOpenEditBank = (acc: UserBankAccount) => {
    setEditingBankId(acc.id);
    setHolderName(acc.accountHolderName);
    setBankName(acc.bankName);
    setBranchName(acc.branchName || '');
    setAccountNumber('');
    setAccountType(acc.accountType || 'CURRENT');
    setIfscCode(acc.ifscCode || '');
    setSwiftCode(acc.swiftCode || '');
    setIban(acc.iban || '');
    setBankCountry(acc.country);
    setBankCurrency(acc.currency);
    setIsDefaultBank(acc.isDefault);
    setBankError(null);
    setShowBankForm(true);
  };

  const handleSaveBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setBankError(null);
    setBankSuccess(null);

    const validation = validateBankAccountInput({
      accountHolderName: holderName,
      bankName,
      accountNumber,
      ifscCode,
      swiftCode,
      iban,
      country: bankCountry,
      currency: bankCurrency
    });
    if (!validation.valid) {
      setBankError(validation.errors.join(' '));
      return;
    }

    try {
      const saved = cashbackService.saveBankAccount({
        id: editingBankId,
        userId: user.id,
        accountHolderName: holderName,
        bankName,
        branchName,
        accountNumber,
        accountType,
        ifscCode,
        swiftCode,
        iban,
        country: bankCountry,
        currency: bankCurrency,
        isDefault: isDefaultBank,
        actor: user
      });
      setShowBankForm(false);
      setAccountNumber('');
      setWdBankId(saved.id);
      setBankSuccess(`Saved payout bank account ${saved.bankName} (${saved.accountNumberMasked}).`);
      setTick((t) => t + 1);
    } catch (err: any) {
      setBankError(err?.message || 'Unable to save bank account.');
    }
  };

  const handleDeleteBank = (accId: string) => {
    try {
      cashbackService.deleteBankAccount({ bankAccountId: accId, userId: user.id, actor: user });
      if (wdBankId === accId) setWdBankId('');
      setTick((t) => t + 1);
    } catch (err: any) {
      setBankError(err?.message || 'Failed to delete bank account.');
    }
  };

  const handleSubmitWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    setWdError(null);
    setWdSuccess(null);
    const amountNum = roundMoney(Number(wdAmount));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setWdError('Enter a valid withdrawal amount greater than zero.');
      return;
    }
    try {
      const created = cashbackService.submitWithdrawalRequest({
        userId: user.id,
        requestedAmount: amountNum,
        currency: wdCurrency,
        bankAccountId: wdBankId,
        userNotes: wdNotes,
        actor: user
      });
      setWdAmount('');
      setWdNotes('');
      setWdSuccess(
        `Withdrawal request ${created.requestNumber} for ${created.currency} ${created.requestedAmount.toLocaleString()} submitted to ${created.bankSnapshotMasked.bankName} (${created.bankSnapshotMasked.accountNumberMasked}).`
      );
      setTick((t) => t + 1);
    } catch (err: any) {
      setWdError(err?.message || 'Failed to submit withdrawal request.');
    }
  };

  const handleCancelWithdrawal = (reqId: string) => {
    setWdError(null);
    setWdSuccess(null);
    try {
      const cancelled = cashbackService.cancelOwnWithdrawal({ withdrawalRequestId: reqId, actor: user });
      setWdSuccess(
        `Withdrawal ${cancelled.requestNumber} cancelled. ${cancelled.currency} ${cancelled.requestedAmount.toLocaleString()} returned to available balance.`
      );
      setTick((t) => t + 1);
    } catch (err: any) {
      setWdError(err?.message || 'Failed to cancel withdrawal.');
    }
  };

  const pendingBookingRecords = bookingRecords.filter((r) => r.status === 'PENDING' || r.status === 'HELD');
  const currencyEntries = Object.values(wallet.balancesByCurrency || {}) as CashbackCurrencyBucket[];

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-6 text-xs">
      {/* Top Bar */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded bg-slate-900 text-[#00E5C0] text-[10px] font-bold uppercase tracking-wider">
              Rewards Wallet
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                isEligibleActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {isEligibleActive
                ? `Active Tier · ${config!.cashbackPercent}% Cashback`
                : 'Informational / Historical View'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">My Cashback &amp; Rewards Wallet</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track earned booking rewards, automatic post-travel crediting ({policy.creditDelayDays} days after travel completion), payout bank accounts, and withdrawal requests.
          </p>
        </div>

        {config && (
          <div className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white flex items-center space-x-3 shrink-0">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Your Cashback Rate</div>
              <div className="text-base font-black text-slate-900 tabular-nums">
                {config.isEligible ? `${config.cashbackPercent}%` : 'Disabled'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Non-earning notice if user sees informational tab without active eligibility */}
      {!isEligibleActive && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start space-x-3 text-slate-700">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-slate-900">Cashback Earning Currently Not Active</div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Your account is not currently configured to earn cashback on new bookings. Any previously earned rewards or historical transactions remain recorded below. Contact TheUnbound Finance Team for partner tier cashback activation.
            </p>
          </div>
        </div>
      )}

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-[10px] font-bold uppercase text-slate-500">Available for Withdrawal</div>
          <div className="text-xl font-black text-emerald-700 tabular-nums mt-1">
            {wallet?.primaryCurrency || policy.defaultCurrency} {(wallet?.availableBalance ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Reconciled from ledger</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-[10px] font-bold uppercase text-slate-500">Pending Cashback</div>
          <div className="text-xl font-black text-amber-600 tabular-nums mt-1">
            {wallet?.primaryCurrency || policy.defaultCurrency} {(wallet?.pendingCashback ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Auto-credits +{policy.creditDelayDays}d post-travel</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-[10px] font-bold uppercase text-slate-500">Held in Withdrawals</div>
          <div className="text-xl font-black text-slate-800 tabular-nums mt-1">
            {wallet?.primaryCurrency || policy.defaultCurrency} {(wallet?.withdrawalPendingBalance ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Awaiting payout completion</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-[10px] font-bold uppercase text-slate-500">Total Credited</div>
          <div className="text-xl font-black text-slate-900 tabular-nums mt-1">
            {wallet?.primaryCurrency || policy.defaultCurrency} {(wallet?.totalCredited ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Lifetime credited rewards</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-[10px] font-bold uppercase text-slate-500">Total Withdrawn</div>
          <div className="text-xl font-black text-slate-700 tabular-nums mt-1">
            {wallet?.primaryCurrency || policy.defaultCurrency} {(wallet?.totalWithdrawn ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Completed bank payouts</div>
        </div>
      </div>

      {/* Multi-currency bucket breakdown when multiple currencies exist */}
      {currencyEntries.length > 1 && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
          <div className="font-bold text-slate-800">Multi-Currency Wallet Balances (Isolated Per Currency)</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currencyEntries.map((b) => (
              <div key={b.currency} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="font-black text-slate-900">{b.currency}</div>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    Pending: {(b.pendingBalance ?? 0).toLocaleString()} · Held: {(b.heldInWithdrawals ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm font-black text-emerald-700 tabular-nums">
                  {(b.availableBalance ?? 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-slate-200 flex items-center space-x-2 overflow-x-auto">
        {(
          [
            { id: 'OVERVIEW', label: 'Overview', icon: Wallet },
            { id: 'TRANSACTIONS', label: `Cashback Transactions (${transactions.length})`, icon: Receipt },
            { id: 'PENDING', label: `Pending Cashback (${pendingBookingRecords.length})`, icon: Clock },
            { id: 'WITHDRAWALS', label: `Withdrawal Requests (${withdrawals.length})`, icon: ArrowDownToLine },
            { id: 'BANK_ACCOUNTS', label: `Bank Account Details (${bankAccounts.length})`, icon: Landmark }
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                active
                  ? 'border-[#00C6A6] text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Booking Cashback Activity</h2>
              <span className="text-[11px] text-slate-500">{bookingRecords.length} booking records</span>
            </div>
            {bookingRecords.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No eligible booking cashback records yet. Once you confirm an eligible booking, pending cashback and its post-travel credit schedule will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Booking</th>
                      <th className="py-2 px-3">Travel End</th>
                      <th className="py-2 px-3 text-right">Booking Total</th>
                      <th className="py-2 px-3 text-right">Hotel Excluded</th>
                      <th className="py-2 px-3 text-right">Eligible Land Part</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Cashback</th>
                      <th className="py-2 px-3">Credit Schedule</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookingRecords.slice(0, 10).map((r) => {
                      const hotelExcluded = r.hotelAccommodationTotal ?? r.componentBreakdown?.hotelAccommodationTotal ?? 0;
                      const landEligible = r.landPartTotal ?? r.eligibleAmount ?? 0;
                      const bookingTot = r.bookingTotalSnapshot ?? (landEligible + hotelExcluded);
                      const landCount = r.componentBreakdown?.landPartLineItems?.length ?? 0;
                      const hotelCount = r.componentBreakdown?.excludedAccommodationItems?.length ?? 0;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div>{r.bookingReference}</div>
                            <div className="text-[10px] font-normal text-slate-500">{r.customerName}</div>
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-slate-600">{r.travelEndDate}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                            {r.currency} {bookingTot.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-400">
                            {hotelExcluded > 0 ? `${r.currency} ${hotelExcluded.toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                            <div>{r.currency} {landEligible.toLocaleString()}</div>
                            {(landCount > 0 || hotelCount > 0) && (
                              <div className="text-[10px] font-normal text-slate-400">
                                {landCount} land · {hotelCount} hotel excl.
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                            {r.cashbackPercent}%
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                            {r.currency} {(r.remainingCashbackAmount ?? r.cashbackAmount ?? 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-slate-600">
                            {r.status === 'NOT_ELIGIBLE' ? '—' : r.scheduledCreditDate}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'CREDITED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : r.status === 'PENDING'
                                    ? 'bg-amber-50 text-amber-700'
                                    : r.status === 'HELD'
                                      ? 'bg-orange-50 text-orange-700'
                                      : r.status === 'NOT_ELIGIBLE'
                                        ? 'bg-slate-100 text-slate-600'
                                        : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {r.status}
                            </span>
                            {r.verificationStatus === 'UNVERIFIED_HOLD' && (
                              <div className="text-[10px] text-orange-700 mt-0.5">Breakdown audit hold</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Program Terms &amp; Payout Rules</h2>
            <ul className="space-y-2.5 text-[11px] text-slate-600">
              <li className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Cashback is calculated exclusively on the <strong>Land Part Total</strong> of eligible bookings. <strong>Hotel Accommodation Total is always excluded</strong>.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Cashback is locked at your assigned percentage on the booking date and is unaffected by future rate changes.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Pending rewards credit automatically <strong>{policy.creditDelayDays} days</strong> after travel/service completion in the destination timezone.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <span>
                  Minimum withdrawal: <strong>{policy.defaultCurrency} {policy.minWithdrawalAmount.toLocaleString()}</strong>. Withdrawals hold the requested balance immediately until Finance settlement.
                </span>
              </li>
            </ul>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('WITHDRAWALS')}
                className="w-full py-2 bg-slate-900 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
              >
                Request Cashback Withdrawal
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('BANK_ACCOUNTS')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg cursor-pointer"
              >
                Manage Bank Account Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CASHBACK TRANSACTIONS LEDGER */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Cashback Financial Ledger History</h2>
            <span className="text-[11px] text-slate-500">Immutable ledger entries</span>
          </div>
          {transactions.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              No ledger transactions posted yet. Pending booking rewards move here automatically once credited (+{policy.creditDelayDays} days post-travel).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Reference</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-right">Available After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 tabular-nums text-slate-600">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px] font-bold">
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {tx.bookingReference || tx.withdrawalRequestId || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{tx.description}</td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                          tx.direction === 'CREDIT' || tx.direction === 'RELEASE'
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {tx.direction === 'CREDIT' || tx.direction === 'RELEASE' ? '+' : '-'}
                        {tx.currency} {(tx.amount ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-800 font-semibold">
                        {tx.currency} {(tx.balanceAfterAvailable ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENDING CASHBACK */}
      {activeTab === 'PENDING' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Pending &amp; Held Post-Travel Cashback</h2>
          {pendingBookingRecords.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              No pending cashback records at the moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="py-2 px-3">Booking Ref</th>
                    <th className="py-2 px-3">Destination</th>
                    <th className="py-2 px-3">Service End Date</th>
                    <th className="py-2 px-3">Scheduled Credit Date</th>
                    <th className="py-2 px-3 text-right">Booking Total</th>
                    <th className="py-2 px-3 text-right">Hotel Excluded</th>
                    <th className="py-2 px-3 text-right">Eligible Land Part</th>
                    <th className="py-2 px-3 text-right">Cashback</th>
                    <th className="py-2 px-3">Status / Hold Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingBookingRecords.map((r) => {
                    const hotelExcluded = r.hotelAccommodationTotal ?? r.componentBreakdown?.hotelAccommodationTotal ?? 0;
                    const landEligible = r.landPartTotal ?? r.eligibleAmount ?? 0;
                    const bookingTot = r.bookingTotalSnapshot ?? (landEligible + hotelExcluded);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{r.bookingReference}</td>
                        <td className="py-2.5 px-3 text-slate-600">{r.destinationName || '-'}</td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-700">{r.travelEndDate}</td>
                        <td className="py-2.5 px-3 tabular-nums font-bold text-slate-900">
                          {r.scheduledCreditDate}
                          <span className="block text-[10px] font-normal text-slate-400">{r.destinationTimezone}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                          {r.currency} {bookingTot.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-400">
                          {hotelExcluded > 0 ? `${r.currency} ${hotelExcluded.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                          {r.currency} {landEligible.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-amber-700">
                          {r.currency} {(r.remainingCashbackAmount ?? r.cashbackAmount ?? 0).toLocaleString()} ({r.cashbackPercent}%)
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'HELD' ? 'bg-orange-50 text-orange-800' : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                          {r.holdReason && <div className="text-[10px] text-rose-600 mt-0.5">{r.holdReason}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WITHDRAWAL REQUESTS */}
      {activeTab === 'WITHDRAWALS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSubmitWithdrawal} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">Withdraw Available Cashback</h2>
            </div>

            {wdError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold">
                {wdError}
              </div>
            )}
            {wdSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                {wdSuccess}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Currency Wallet</label>
              <select
                value={wdCurrency}
                onChange={(e) => setWdCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
              >
                {(currencyEntries.length > 0 ? currencyEntries.map((c) => c.currency) : [policy.defaultCurrency]).map(
                  (curr) => (
                    <option key={curr} value={curr}>
                      {curr} (Available: {(wallet.balancesByCurrency[curr]?.availableBalance ?? 0).toLocaleString()})
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Withdrawal Amount ({wdCurrency})
              </label>
              <input
                type="number"
                step="0.01"
                min={policy.minWithdrawalAmount}
                max={availableForSelectedCurrency}
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                placeholder={`Min ${policy.minWithdrawalAmount}`}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 tabular-nums"
              />
              <div className="text-[10px] text-slate-500 mt-1 tabular-nums">
                Available: {wdCurrency} {availableForSelectedCurrency.toLocaleString()} · Min: {wdCurrency} {policy.minWithdrawalAmount.toLocaleString()}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Payout Bank Account</label>
                <button
                  type="button"
                  onClick={() => setActiveTab('BANK_ACCOUNTS')}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  + Add / Manage
                </button>
              </div>
              <select
                value={wdBankId}
                onChange={(e) => setWdBankId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              >
                <option value="">Select saved bank account...</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} ({b.accountNumberMasked}) {b.isDefault ? '· Default' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Optional Note</label>
              <input
                type="text"
                value={wdNotes}
                onChange={(e) => setWdNotes(e.target.value)}
                placeholder="Optional payout instruction"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>

            <button
              type="submit"
              disabled={!isEligibleActive || availableForSelectedCurrency < policy.minWithdrawalAmount || !wdBankId}
              className="w-full py-2.5 bg-slate-900 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-40"
            >
              Submit Withdrawal Request
            </button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Your Withdrawal Request History</h2>
            {withdrawals.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No cashback withdrawal requests submitted yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Request ID</th>
                      <th className="py-2 px-3">Submitted</th>
                      <th className="py-2 px-3">Bank Account</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{w.requestNumber}</td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-600">
                          {new Date(w.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <div>{w.bankSnapshotMasked.bankName}</div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {w.bankSnapshotMasked.accountNumberMasked}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                          {w.currency} {(w.requestedAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              w.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : w.status === 'REJECTED' || w.status === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {w.status}
                          </span>
                          {w.paymentReference && (
                            <div className="text-[10px] text-emerald-700 mt-0.5 font-mono">
                              Ref: {w.paymentReference}
                            </div>
                          )}
                          {w.rejectionReason && (
                            <div className="text-[10px] text-rose-600 mt-0.5">{w.rejectionReason}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {w.status === 'SUBMITTED' && (
                            <button
                              type="button"
                              onClick={() => handleCancelWithdrawal(w.id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold cursor-pointer"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: BANK ACCOUNT DETAILS */}
      {activeTab === 'BANK_ACCOUNTS' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Saved Payout Bank Accounts</h2>
              <p className="text-[11px] text-slate-500">
                Bank account numbers are stored securely and displayed masked (XXXXXX1234) across all wallet screens, notifications, and logs.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddBank}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bank Account</span>
            </button>
          </div>

          {bankSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
              {bankSuccess}
            </div>
          )}
          {bankError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{bankError}</span>
            </div>
          )}

          {showBankForm && (
            <form onSubmit={handleSaveBankAccount} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
              <div className="font-bold text-slate-900">
                {editingBankId ? 'Update Bank Account Details' : 'Add Payout Bank Account'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Holder Name *</label>
                  <input
                    type="text"
                    required
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank / ICICI Bank"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Number *</label>
                  <input
                    type="password"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Enter full account number"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as 'SAVINGS' | 'CURRENT')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="CURRENT">Current</option>
                    <option value="SAVINGS">Savings</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={bankCountry}
                    onChange={(e) => setBankCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">IFSC Code (Required for India)</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SWIFT Code (International)</label>
                  <input
                    type="text"
                    value={swiftCode}
                    onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono uppercase text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Currency *</label>
                  <select
                    value={bankCurrency}
                    onChange={(e) => setBankCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>
              </div>
              <label className="inline-flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefaultBank}
                  onChange={(e) => setIsDefaultBank(e.target.checked)}
                />
                <span className="font-semibold text-slate-700">Set as default payout account</span>
              </label>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBankForm(false)}
                  className="px-3.5 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Save Bank Account
                </button>
              </div>
            </form>
          )}

          {bankAccounts.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No bank accounts added yet. Add a verified payout bank account before raising a withdrawal request.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{acc.bankName}</span>
                      {acc.isDefault && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-slate-700 font-semibold">{acc.accountHolderName}</div>
                    <div className="font-mono text-slate-900 font-bold">{acc.accountNumberMasked}</div>
                    <div className="text-[11px] text-slate-500">
                      {acc.ifscCode ? `IFSC: ${acc.ifscCode}` : acc.swiftCode ? `SWIFT: ${acc.swiftCode}` : ''} · {acc.country} ({acc.currency})
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditBank(acc)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                      title="Edit bank account"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBank(acc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Remove bank account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
