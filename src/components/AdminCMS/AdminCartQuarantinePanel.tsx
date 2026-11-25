import React, { useEffect, useMemo, useState } from 'react';
import { QuarantinedLegacyCartItem, User } from '../../types';
import { auth } from '../../services/firebase';
import {
  isAuthorisedCartAdmin,
  resolveTargetAgentUid,
  userCartService
} from '../../services/userCartService';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  UserCheck
} from 'lucide-react';

interface AdminCartQuarantinePanelProps {
  currentUser: User | null;
  allUsers: User[];
  onOpenAgentCartModal: (agent?: User | null) => void;
}

export const AdminCartQuarantinePanel: React.FC<AdminCartQuarantinePanelProps> = ({
  currentUser,
  allUsers,
  onOpenAgentCartModal
}) => {
  const isAuthorizedAdmin = isAuthorisedCartAdmin(currentUser);
  const [records, setRecords] = useState<QuarantinedLegacyCartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignAgentMap, setAssignAgentMap] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const eligibleAgents = useMemo(() => {
    return allUsers
      .filter((u) => {
        const role = String(u.role || '').toUpperCase();
        return (
          (role === 'B2B_AGENT' || role === 'AGENT' || role === 'AGENCY_OWNER') &&
          (u.approvalStatus || 'APPROVED') === 'APPROVED' &&
          Boolean(resolveTargetAgentUid(u))
        );
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allUsers]);

  const loadQuarantine = async () => {
    if (!isAuthorizedAdmin || !currentUser) return;
    setLoading(true);
    try {
      const list = await userCartService.listQuarantinedLegacyItems(currentUser);
      setRecords(list);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Unable to load quarantined cart records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuarantine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorizedAdmin, currentUser?.id]);

  const handleAssign = async (record: QuarantinedLegacyCartItem) => {
    if (!currentUser || !isAuthorizedAdmin) return;
    const targetAgentId = assignAgentMap[record.id];
    const targetAgent = eligibleAgents.find((a) => a.id === targetAgentId);
    if (!targetAgent) {
      setStatusMessage({ type: 'error', text: 'Select a specific target B2B Agent before assigning.' });
      return;
    }

    try {
      await userCartService.assignQuarantinedItemToAgent({
        actor: currentUser,
        actorFirebaseUid: auth?.currentUser?.uid || currentUser.id,
        recordId: record.id,
        targetAgent
      });
      setStatusMessage({
        type: 'success',
        text: `Assigned "${record.productName}" exclusively to ${targetAgent.name} (${resolveTargetAgentUid(targetAgent)}).`
      });
      await loadQuarantine();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to assign quarantined item.' });
    }
  };

  const handleArchive = async (record: QuarantinedLegacyCartItem) => {
    if (!currentUser || !isAuthorizedAdmin) return;
    try {
      await userCartService.archiveQuarantinedItem({
        actor: currentUser,
        actorFirebaseUid: auth?.currentUser?.uid || currentUser.id,
        recordId: record.id,
        reason: 'Archived via Admin CMS Cart Isolation & Quarantine review'
      });
      setStatusMessage({
        type: 'success',
        text: `Archived legacy quarantined item "${record.productName}". Quotations and bookings were untouched.`
      });
      await loadQuarantine();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to archive quarantined item.' });
    }
  };

  if (!isAuthorizedAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-6 text-xs text-rose-800 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
        <span>Only authorised CMS Administrators can manage agent carts and review quarantined legacy cart items.</span>
      </div>
    );
  }

  const pendingCount = records.filter((r) => r.status === 'QUARANTINED').length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#008972]" />
            <h3 className="text-sm font-black text-slate-900">
              Strict User-Level Cart Isolation &amp; Legacy Quarantine Review
            </h3>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Every B2B Agent&apos;s cart is stored strictly under <code className="font-mono text-slate-900">users/&#123;uid&#125;/cart</code>.
            Unowned legacy browser cart records are quarantined here so they never leak to another agent, while historical quotations and bookings remain untouched.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadQuarantine()}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAgentCartModal(null)}
            className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add Item to Specific Agent Cart</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="text-xs font-bold text-slate-800">
            Quarantined Legacy Cart Records ({pendingCount} Pending Review • {records.length} Total)
          </div>
          <span className="text-[11px] font-mono text-slate-500">quarantined_legacy_cart_items</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading quarantined records...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <div className="text-xs font-bold text-slate-800">Zero Quarantined Legacy Cart Items</div>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              No unowned or shared legacy cart records are pending review. All active carts are isolated under individual Firebase Auth UIDs.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map((rec) => (
              <div key={rec.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{rec.productName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rec.status === 'QUARANTINED'
                          ? 'bg-amber-100 text-amber-800'
                          : rec.status === 'ASSIGNED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {rec.status}
                    </span>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {rec.quarantineReason}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Product ID: <span className="font-mono">{rec.productId}</span> • Source: {rec.sourceStorage} • Discovered:{' '}
                    {new Date(rec.discoveredAt).toLocaleString()}
                  </div>
                  {rec.assignedToUid && (
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      Assigned to {rec.assignedToName} (UID: {rec.assignedToUid})
                    </div>
                  )}
                </div>

                {rec.status === 'QUARANTINED' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={assignAgentMap[rec.id] || ''}
                      onChange={(e) =>
                        setAssignAgentMap((prev) => ({ ...prev, [rec.id]: e.target.value }))
                      }
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    >
                      <option value="">Select target B2B Agent...</option>
                      {eligibleAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.agencyName || a.email})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleAssign(rec)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Assign to Agent</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleArchive(rec)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
