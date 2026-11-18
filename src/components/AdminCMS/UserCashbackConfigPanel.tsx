import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  UserCashbackConfiguration,
  UserCashbackConfigHistoryRecord
} from '../../types';
import { cashbackService } from '../../services/cashbackService';
import { validateCashbackPercentInput } from '../../services/cashbackEngine';
import {
  Wallet,
  Percent,
  CheckCircle2,
  AlertTriangle,
  History,
  Save,
  ShieldCheck,
  Clock
} from 'lucide-react';

interface UserCashbackConfigPanelProps {
  targetUser: User;
  currentUser: User | null;
  onUpdated?: (cfg: UserCashbackConfiguration) => void;
}

export const UserCashbackConfigPanel: React.FC<UserCashbackConfigPanelProps> = ({
  targetUser,
  currentUser,
  onUpdated
}) => {
  const [tick, setTick] = useState(0);
  const existingConfig = useMemo(
    () => cashbackService.getUserConfiguration(targetUser.id),
    [targetUser.id, tick]
  );
  const policy = useMemo(() => cashbackService.getPolicy(), [tick]);
  const wallet = useMemo(() => cashbackService.getWalletForUser(targetUser.id), [targetUser.id, tick]);
  const history = useMemo<UserCashbackConfigHistoryRecord[]>(
    () => cashbackService.getConfigHistory(targetUser.id),
    [targetUser.id, tick]
  );

  const [isEligible, setIsEligible] = useState<boolean>(existingConfig?.isEligible ?? false);
  const [cashbackPercent, setCashbackPercent] = useState<string>(
    existingConfig?.cashbackPercent !== undefined ? String(existingConfig.cashbackPercent) : '2'
  );
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>(
    existingConfig?.status || (existingConfig?.isEligible ? 'ACTIVE' : 'INACTIVE')
  );
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    existingConfig?.effectiveFrom || new Date().toISOString().slice(0, 10)
  );
  const [effectiveTo, setEffectiveTo] = useState<string>(existingConfig?.effectiveTo || '');
  const [showInfoWhenIneligible, setShowInfoWhenIneligible] = useState<boolean>(
    existingConfig?.showInformationalNoticeWhenIneligible ?? false
  );
  const [notes, setNotes] = useState<string>(existingConfig?.notes || '');
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<boolean>(false);

  useEffect(() => {
    setIsEligible(existingConfig?.isEligible ?? false);
    setCashbackPercent(existingConfig?.cashbackPercent !== undefined ? String(existingConfig.cashbackPercent) : '2');
    setStatus(existingConfig?.status || (existingConfig?.isEligible ? 'ACTIVE' : 'INACTIVE'));
    setEffectiveFrom(existingConfig?.effectiveFrom || new Date().toISOString().slice(0, 10));
    setEffectiveTo(existingConfig?.effectiveTo || '');
    setShowInfoWhenIneligible(existingConfig?.showInformationalNoticeWhenIneligible ?? false);
    setNotes(existingConfig?.notes || '');
    setErrorMsg(null);
    setPendingConfirm(false);
  }, [targetUser.id, existingConfig]);

  const parsedValidation = useMemo(
    () => validateCashbackPercentInput(cashbackPercent, policy.maxCashbackPercentCeiling),
    [cashbackPercent, policy.maxCashbackPercentCeiling]
  );

  const hasRateOrEligibilityChange =
    !existingConfig ||
    existingConfig.isEligible !== isEligible ||
    existingConfig.cashbackPercent !== parsedValidation.normalized ||
    existingConfig.status !== status;

  const commitSave = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!parsedValidation.valid) {
      setErrorMsg(parsedValidation.error || 'Enter a valid cashback percentage.');
      return;
    }
    try {
      const saved = cashbackService.configureUserCashback({
        targetUserId: targetUser.id,
        isEligible,
        cashbackPercent: parsedValidation.normalized,
        status: isEligible ? status : 'INACTIVE',
        effectiveFrom: effectiveFrom || new Date().toISOString().slice(0, 10),
        effectiveTo: effectiveTo.trim() || null,
        showInformationalNoticeWhenIneligible: showInfoWhenIneligible,
        notes,
        reason: reason.trim() || 'Updated user cashback configuration',
        actor: currentUser
      });
      setPendingConfirm(false);
      setReason('');
      setTick((t) => t + 1);
      setSuccessMsg(
        `Saved ${saved.cashbackPercent}% (${saved.status}) cashback configuration for ${targetUser.name}.`
      );
      if (onUpdated) onUpdated(saved);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save cashback configuration.');
    }
  };

  const handleSaveClick = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!parsedValidation.valid) {
      setErrorMsg(parsedValidation.error || 'Enter a valid cashback percentage.');
      return;
    }
    if (hasRateOrEligibilityChange && !pendingConfirm) {
      setPendingConfirm(true);
      return;
    }
    commitSave();
  };

  const presets = [1, 2, 5];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 text-xs">
      {/* Header + UID binding notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">User Cashback &amp; Rewards Configuration</h3>
            <p className="text-[11px] text-slate-500">
              Configured individually for Firebase UID <span className="font-mono text-slate-700">{targetUser.id}</span> — never shared across agency accounts.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
              isEligible && status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {isEligible && status === 'ACTIVE'
              ? `Eligible · ${parsedValidation.valid ? parsedValidation.normalized : existingConfig?.cashbackPercent ?? 0}%`
              : 'Not Earning Cashback'}
          </span>
        </div>
      </div>

      {/* Live Wallet Snapshot (Tabular Nums) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="text-[10px] font-bold uppercase text-slate-500">Pending (3d Hold)</div>
          <div className="text-sm font-bold text-amber-700 tabular-nums mt-0.5">
            {wallet?.primaryCurrency || policy.defaultCurrency || 'INR'} {(wallet?.pendingCashback ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="text-[10px] font-bold uppercase text-slate-500">Available</div>
          <div className="text-sm font-bold text-emerald-700 tabular-nums mt-0.5">
            {wallet?.primaryCurrency || policy.defaultCurrency || 'INR'} {(wallet?.availableBalance ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="text-[10px] font-bold uppercase text-slate-500">Held Withdrawal</div>
          <div className="text-sm font-bold text-slate-800 tabular-nums mt-0.5">
            {wallet?.primaryCurrency || policy.defaultCurrency || 'INR'} {(wallet?.withdrawalPendingBalance ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="text-[10px] font-bold uppercase text-slate-500">Total Credited</div>
          <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
            {wallet?.primaryCurrency || policy.defaultCurrency || 'INR'} {(wallet?.totalCredited ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="text-[10px] font-bold uppercase text-slate-500">Total Paid Out</div>
          <div className="text-sm font-bold text-slate-700 tabular-nums mt-0.5">
            {wallet?.primaryCurrency || policy.defaultCurrency || 'INR'} {(wallet?.totalWithdrawn ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Eligibility & Percentage Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">Cashback Eligibility</div>
              <div className="text-[11px] text-slate-500">Enable or pause cashback earning for future bookings</div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !isEligible;
                setIsEligible(next);
                setStatus(next ? 'ACTIVE' : 'INACTIVE');
                setPendingConfirm(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                isEligible
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {isEligible ? 'ELIGIBLE (ON)' : 'DISABLED (OFF)'}
            </button>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Status</label>
            <select
              value={isEligible ? status : 'INACTIVE'}
              disabled={!isEligible}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800 disabled:opacity-60"
            >
              <option value="ACTIVE">ACTIVE (Earn &amp; Withdraw Enabled)</option>
              <option value="INACTIVE">INACTIVE (Earning Paused)</option>
              <option value="SUSPENDED">SUSPENDED (Blocked)</option>
            </select>
          </div>

          <label className="flex items-start space-x-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showInfoWhenIneligible}
              onChange={(e) => setShowInfoWhenIneligible(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600"
            />
            <span className="text-[11px] text-slate-600">
              Show informational Rewards Wallet notice in B2B Portal even if not eligible
            </span>
          </label>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center space-x-1.5">
              <Percent className="w-3.5 h-3.5 text-emerald-600" />
              <span>Assigned Cashback Rate (%)</span>
            </span>
            <span className="text-[10px] text-slate-500">
              Admin Ceiling: {policy.maxCashbackPercentCeiling}%
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {presets.map((p) => {
              const active = Number(cashbackPercent) === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setCashbackPercent(String(p));
                    setPendingConfirm(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer tabular-nums ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {p}%
                </button>
              );
            })}
            <div className="flex items-center space-x-1 flex-1">
              <input
                type="number"
                min="0"
                max={policy.maxCashbackPercentCeiling}
                step="0.25"
                value={cashbackPercent}
                onChange={(e) => {
                  setCashbackPercent(e.target.value);
                  setPendingConfirm(false);
                }}
                placeholder="Custom %"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 tabular-nums"
              />
              <span className="font-bold text-slate-500">%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Effective From</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Expiry Date (Optional)</label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reason & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Change Reason (Audit Log)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Approved 2% preferred partner tier cashback"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">Internal Finance Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional agreement notes"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
          />
        </div>
      </div>

      {/* Confirmation Guardrail Banner */}
      {pendingConfirm && (
        <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 space-y-2">
          <div className="font-bold flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Confirm Cashback Configuration Change</span>
          </div>
          <p className="text-[11px]">
            Applying <strong>{parsedValidation.normalized}%</strong> ({isEligible ? status : 'INACTIVE'}) for{' '}
            <strong>{targetUser.name}</strong> applies strictly to future eligible bookings. Previously booked quotes &amp; locked booking cashback snapshots remain immutable.
          </p>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={commitSave}
              className="px-3 py-1.5 bg-slate-900 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
            >
              Confirm &amp; Persist to Database
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirm(false)}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 font-bold rounded-lg cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!pendingConfirm && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveClick}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Cashback Configuration</span>
          </button>
        </div>
      )}

      {/* Configuration History */}
      <div className="border-t border-slate-200 pt-4 space-y-2">
        <div className="flex items-center space-x-1.5 font-bold text-slate-800">
          <History className="w-3.5 h-3.5 text-slate-500" />
          <span>Configuration Change History ({history.length})</span>
        </div>
        {history.length === 0 ? (
          <div className="text-[11px] text-slate-400 italic py-2">
            No prior cashback configuration changes recorded for this user.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Previous</th>
                  <th className="py-2 px-3">New Rate</th>
                  <th className="py-2 px-3">Changed By</th>
                  <th className="py-2 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.slice(0, 10).map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 px-3 tabular-nums text-slate-600">
                      <span className="inline-flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(h.changedAt).toLocaleString()}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 tabular-nums text-slate-500">
                      {h.previousPercent !== null ? `${h.previousPercent}% (${h.previousStatus})` : 'NONE'}
                    </td>
                    <td className="py-2 px-3 tabular-nums font-bold text-slate-900">
                      {h.newPercent}% ({h.newStatus})
                    </td>
                    <td className="py-2 px-3 text-slate-700">{h.changedByName}</td>
                    <td className="py-2 px-3 text-slate-600">{h.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
