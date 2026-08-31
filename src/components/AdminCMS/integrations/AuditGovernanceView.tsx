import React, { useState } from 'react';
import { AuditLog, AuditCategory, User } from '../../../types';
import { AppDatabase } from '../../../services/db';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  User as UserIcon, 
  Activity, 
  Database, 
  Mail, 
  FileSpreadsheet, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Code
} from 'lucide-react';

interface AuditGovernanceViewProps {
  currentUser: User | null;
}

export const AuditGovernanceView: React.FC<AuditGovernanceViewProps> = ({ currentUser }) => {
  const db = AppDatabase.getInstance();
  const [logs, setLogs] = useState<AuditLog[]>(() => db.getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const handleRefresh = () => {
    setLogs(db.getAuditLogs());
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `theunbound-audit-log-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Category', 'Action', 'Entity', 'Entity ID', 'Details'];
    const rows = logs.map(l => [
      `"${l.timestamp}"`,
      `"${l.userName || 'System'}"`,
      `"${l.userRole || 'SYSTEM'}"`,
      `"${l.category || 'GENERAL'}"`,
      `"${l.action}"`,
      `"${l.entity}"`,
      `"${l.entityId}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `theunbound-audit-log-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const filteredLogs = logs.filter(log => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = 
        (log.userName || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.entity || '').toLowerCase().includes(q) ||
        (log.entityId || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    // Category filter
    if (selectedCategory !== 'ALL') {
      const cat = log.category || (
        log.action.startsWith('USER') ? 'USER' :
        log.action.startsWith('PRODUCT') || log.action.startsWith('HOTEL') || log.action.startsWith('PACKAGE') || log.action.startsWith('DESTINATION') ? 'CMS' :
        log.action.startsWith('DATABASE') || log.action.startsWith('COLLECTION') ? 'DATABASE' :
        log.action.startsWith('INTEGRATION') || log.action.startsWith('GMAIL') || log.action.startsWith('CALENDAR') || log.action.startsWith('GOOGLE_SHEETS') ? 'INTEGRATION' :
        log.action.startsWith('PRICE') || log.action.startsWith('MARGIN') || log.action.startsWith('PROMOTION') ? 'PRICING' :
        log.action.startsWith('QUOTE') ? 'QUOTE' :
        log.action.startsWith('BOOKING') ? 'BOOKING' : 'GENERAL'
      );
      if (cat !== selectedCategory) return false;
    }

    // Service filter
    if (selectedService !== 'ALL') {
      if (log.integrationService !== selectedService) return false;
    }

    return true;
  });

  const getCategoryColor = (action: string) => {
    if (action.includes('REPAIR') || action.includes('HEALTH') || action.includes('DATABASE')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (action.includes('GMAIL') || action.includes('MAIL')) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (action.includes('CALENDAR')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (action.includes('SHEETS')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (action.includes('PRICE') || action.includes('MARGIN')) return 'bg-teal-100 text-teal-800 border-teal-200';
    if (action.includes('USER')) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Immutable Governance & Audit System</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            System Audit Trail & Compliance Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Real-time compliance logging tracking all administrative changes, database repairs, price edits, quotes, and integration dispatches.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            id="export-audit-csv-btn"
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            id="export-audit-json-btn"
            onClick={handleExportJson}
            className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            <Code className="w-3.5 h-3.5 text-[#00E5C0]" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search audit records by user, entity, action, or details..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#008972]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1">
            <span className="text-slate-400 font-bold text-[11px]">Category:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="DATABASE">Database & Repair</option>
              <option value="INTEGRATION">Integrations</option>
              <option value="CMS">CMS & Products</option>
              <option value="PRICING">Pricing & Margins</option>
              <option value="USER">User & Security</option>
              <option value="QUOTE">Quotes</option>
              <option value="BOOKING">Bookings</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Audit Event Log ({filteredLogs.length} Events)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log with actor identity, action type, target entity, and mutation details.
            </p>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">
            No audit records matching the specified search filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Timestamp</th>
                  <th className="py-3 px-4">User / Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-6">Mutation Details</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {log.userName || 'System Automation'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {log.userRole || 'SYSTEM'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${getCategoryColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-800">{log.entity}</span>
                          {log.entityId && (
                            <span className="font-mono text-[10px] text-slate-400 block truncate max-w-xs">
                              {log.entityId}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 max-w-md text-slate-700">
                          {log.details}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {(log.previousValue || log.newValue) && (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                              title={isExpanded ? 'Hide Diff' : 'View Diff'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Diff Row */}
                      {isExpanded && (log.previousValue || log.newValue) && (
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <td colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200">
                                <span className="text-[10px] font-bold uppercase text-rose-700 block mb-1">Previous Value:</span>
                                <pre className="text-slate-800 text-[11px] whitespace-pre-wrap">{log.previousValue || '(None)'}</pre>
                              </div>
                              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                                <span className="text-[10px] font-bold uppercase text-emerald-700 block mb-1">New Value:</span>
                                <pre className="text-slate-800 text-[11px] whitespace-pre-wrap">{log.newValue || '(None)'}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
