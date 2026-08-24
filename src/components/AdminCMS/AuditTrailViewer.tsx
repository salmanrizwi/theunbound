import React, { useState } from 'react';
import { AuditLog } from '../../types';
import { AppDatabase } from '../../services/db';
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  User as UserIcon, 
  Activity, 
  CheckCircle2, 
  Clock,
  Layers,
  FileCode
} from 'lucide-react';

export const AuditTrailViewer: React.FC = () => {
  const db = AppDatabase.getInstance();
  const [logs, setLogs] = useState<AuditLog[]>(() => db.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');

  const refreshLogs = () => {
    setLogs(db.getAuditLogs());
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `audit-trail-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filtered = logs.filter(l => {
    const matchesSearch = l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = filterAction === 'ALL' || l.action === filterAction;
    const matchesRole = filterRole === 'ALL' || l.userRole === filterRole;
    return matchesSearch && matchesAction && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            <span>Compliance, Accountability & Forensics</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Admin Audit Trail ({logs.length} Recorded Events)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all product changes, commercial pricing adjustments, Sheets syncs, and quote management actions.
          </p>
        </div>

        <button
          onClick={handleExportJSON}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#00E5C0]" />
          <span>Export Audit Log (JSON)</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search details, user, entity..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Action Types</option>
            <option value="PRODUCT_CREATED">Product Created</option>
            <option value="PRODUCT_UPDATED">Product Updated</option>
            <option value="PRICE_CHANGED">Pricing Adjustment</option>
            <option value="PROMOTION_CREATED">Promotion Created</option>
            <option value="GOOGLE_SHEETS_SYNC">Google Sheets Sync</option>
            <option value="SETTINGS_UPDATED">Settings / Quote Update</option>
          </select>
        </div>

        <div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Operator Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="TEAM_MEMBER">Team Member</option>
            <option value="B2B_AGENT">B2B Agent</option>
            <option value="BUYER">Buyer</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity & Target ID</th>
                <th className="py-3 px-4">Activity Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {log.timestamp.replace('T', ' ').substring(0, 19)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 text-xs">{log.userName}</div>
                    <span className="inline-block font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800">{log.entity}</div>
                    <div className="font-mono text-[10px] text-slate-400">{log.entityId}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    <p className="max-w-md">{log.details}</p>
                    {log.previousValue && log.newValue && (
                      <div className="mt-1 text-[10px] font-mono bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-500">
                        <span className="text-rose-600">Old: {log.previousValue}</span>
                        <br />
                        <span className="text-emerald-600">New: {log.newValue}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No audit records match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
