import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User as UserIcon, 
  AlertTriangle, 
  ShieldAlert, 
  History, 
  X,
  Lock
} from 'lucide-react';
import { User, UserRole, AiPlannerPermissionAuditLog } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { isMasterAdmin } from '../../services/permissionEngine';

export const AIPlannerAccessManager: React.FC = () => {
  const db = AppDatabase.getInstance();
  const { user: currentUser } = useAuth();
  
  const [users, setUsers] = useState<User[]>(() => db.getUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedAccessStatus, setSelectedAccessStatus] = useState<string>('ALL'); // ALL, ENABLED, DISABLED
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audit History Modal
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [auditLogs, setAuditLogs] = useState<AiPlannerPermissionAuditLog[]>([]);

  // Load audit logs from localStorage
  const loadAuditLogs = (): AiPlannerPermissionAuditLog[] => {
    try {
      const raw = localStorage.getItem('theunbound_ai_planner_perm_audit');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveAuditLog = (log: AiPlannerPermissionAuditLog) => {
    try {
      const existing = loadAuditLogs();
      existing.unshift(log);
      if (existing.length > 300) existing.splice(300);
      localStorage.setItem('theunbound_ai_planner_perm_audit', JSON.stringify(existing));
      setAuditLogs(existing);
    } catch (e) {
      console.warn('Failed to save audit log:', e);
    }
  };

  useEffect(() => {
    setAuditLogs(loadAuditLogs());
    return db.subscribe(() => {
      setUsers(db.getUsers());
    });
  }, [db]);

  const handleToggleAccess = (targetUser: User, enable: boolean) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Safety: prevent last admin from locking themselves out
    if (!enable && targetUser.id === currentUser?.id && isMasterAdmin(targetUser)) {
      setErrorMessage('Critical Safety: Administrators cannot revoke their own master access.');
      return;
    }

    const previousValue = Boolean(targetUser.permissions?.aiPlannerAccess);
    const timestamp = new Date().toISOString();

    const updatedUser: User = {
      ...targetUser,
      permissions: {
        ...targetUser.permissions,
        aiPlannerAccess: enable,
        aiPlannerGrantedBy: enable ? (currentUser?.name || 'Admin') : undefined,
        aiPlannerGrantedAt: enable ? timestamp : undefined
      }
    };

    try {
      db.saveUser(updatedUser, currentUser || null, 'USER_PERMISSIONS_CHANGED', `AI Planner access ${enable ? 'granted' : 'revoked'}`);
      setUsers(db.getUsers());

      // Save structured audit log
      const auditEntry: AiPlannerPermissionAuditLog = {
        id: `aud-${Date.now()}`,
        actorUserId: currentUser?.id || 'admin',
        actorName: currentUser?.name || 'System Admin',
        targetUserId: targetUser.id,
        targetUserName: targetUser.name || `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email,
        targetUserEmail: targetUser.email,
        permission: 'aiPlanner.access',
        previousValue,
        newValue: enable,
        timestamp,
        reason: enable ? 'Administrator allocated AI Planner access' : 'Administrator revoked AI Planner access'
      };
      saveAuditLog(auditEntry);

      db.logAudit(
        currentUser || null,
        'PERMISSIONS_UPDATED' as any,
        'User',
        targetUser.id,
        `AI Planner Access ${enable ? 'GRANTED' : 'REVOKED'} for user ${targetUser.email}`
      );

      setSuccessMessage(
        `AI Planner access ${enable ? 'granted to' : 'revoked from'} ${targetUser.name || targetUser.email}.`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: any) {
      setErrorMessage(`Failed to update permissions: ${e.message}`);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Role Filter
      if (selectedRole !== 'ALL' && u.role !== selectedRole) {
        return false;
      }
      // Access Status Filter
      const hasAccess = Boolean(u.permissions?.aiPlannerAccess || isMasterAdmin(u));
      if (selectedAccessStatus === 'ENABLED' && !hasAccess) return false;
      if (selectedAccessStatus === 'DISABLED' && hasAccess) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = (u.name || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase();
        const email = u.email.toLowerCase();
        const company = (u.agencyName || u.companyName || '').toLowerCase();
        return fullName.includes(q) || email.includes(q) || company.includes(q);
      }

      return true;
    });
  }, [users, selectedRole, selectedAccessStatus, searchQuery]);

  const userLogs = useMemo(() => {
    if (!historyUser) return [];
    return auditLogs.filter(l => l.targetUserId === historyUser.id);
  }, [historyUser, auditLogs]);

  return (
    <div id="ai-planner-access-manager" className="space-y-6">
      {/* Header Info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-slate-900" />
              <h2 className="text-xl font-bold text-slate-900">AI Planner Access Governance</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Only authorized Administrators can allocate AI Planner access. Users do not automatically receive access by role.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Strict Role & Individual User Permission Control</span>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by name, email, agency..."
              className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="B2B_AGENT">B2B Agent</option>
              <option value="BUYER">Buyer</option>
              <option value="TEAM_MEMBER">Team Member / DMC Staff</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <div>
            <select
              value={selectedAccessStatus}
              onChange={(e) => setSelectedAccessStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">All AI Planner Statuses</option>
              <option value="ENABLED">AI Planner: Enabled</option>
              <option value="DISABLED">AI Planner: Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Access Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider">User</th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider">Role</th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider">AI Planner Status</th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider">Granted By</th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider">Granted At</th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No users match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((targetUser) => {
                  const isEnabled = Boolean(targetUser.permissions?.aiPlannerAccess || isMasterAdmin(targetUser));
                  const isMaster = isMasterAdmin(targetUser);

                  return (
                    <tr key={targetUser.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold">
                            {targetUser.name?.[0] || targetUser.firstName?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{targetUser.name || `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email}</p>
                            <p className="text-slate-500">{targetUser.email}</p>
                            {(targetUser.agencyName || targetUser.companyName) && (
                              <p className="text-[11px] text-slate-400">{targetUser.agencyName || targetUser.companyName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          {targetUser.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isEnabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Enabled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Disabled</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {isMaster ? (
                          <span className="text-slate-400 italic">System Master Admin</span>
                        ) : (
                          targetUser.permissions?.aiPlannerGrantedBy || '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {targetUser.permissions?.aiPlannerGrantedAt ? (
                          new Date(targetUser.permissions.aiPlannerGrantedAt).toLocaleString()
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setHistoryUser(targetUser)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50"
                            title="View Permission History"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>

                          {isEnabled ? (
                            <button
                              type="button"
                              disabled={isMaster && targetUser.id === currentUser?.id}
                              onClick={() => handleToggleAccess(targetUser, false)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-40"
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleAccess(targetUser, true)}
                              className="rounded-lg bg-slate-900 px-3 py-1 font-bold text-white hover:bg-slate-800 transition"
                            >
                              Enable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission History Modal */}
      {historyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Permission Audit History</h3>
                <p className="text-xs text-slate-500">{historyUser.firstName} {historyUser.lastName} ({historyUser.email})</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto space-y-3">
              {userLogs.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No permission change logs recorded for this user yet.
                </p>
              ) : (
                userLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${log.newValue ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {log.newValue ? 'Access Granted' : 'Access Revoked'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">{log.reason}</p>
                    <p className="mt-1 text-[11px] text-slate-400">Admin: {log.actorName}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 text-right">
              <button
                type="button"
                onClick={() => setHistoryUser(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
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
