import React, { useState, useEffect } from 'react';
import { SheetsSyncService } from '../../services/sheetsSyncService';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { SyncDetailedReport } from '../../types';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  History, 
  Database, 
  Settings,
  Terminal,
  FileCheck,
  Clock,
  Layers,
  ArrowRight,
  Download
} from 'lucide-react';

export const GoogleSheetsSyncManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [syncHistory, setSyncHistory] = useState<SyncDetailedReport[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncDetailedReport | null>(null);
  const [sheetId, setSheetId] = useState('1X9aBcD_TheUnbound_MasterRateSheet_2026');
  const [sheetName, setSheetName] = useState('MasterInventory2026');
  const [selectedReport, setSelectedReport] = useState<SyncDetailedReport | null>(null);

  useEffect(() => {
    const reports = db.getSyncReports();
    setSyncHistory(reports);
    if (reports.length > 0) {
      setSelectedReport(reports[0]);
    }
  }, []);

  const handleDownloadSampleFormat = () => {
    const headers = [
      'Product ID',
      'Destination ID',
      'Product Name',
      'Category',
      'Base Price USD',
      'Discounted Price USD',
      'Min Pax',
      'Max Pax',
      'Duration Hours',
      'Cutoff Notice Hours',
      'Instant Confirmation (TRUE/FALSE)',
      'Included Items (comma separated)',
      'Languages (comma separated)',
      'Status (ACTIVE/INACTIVE)'
    ];

    const sampleRows = [
      [
        'exp-jp-tea-ceremony',
        'japan',
        'Private Authentic Tea Ceremony with Master',
        'TOURS',
        '180',
        '155',
        '1',
        '8',
        '2',
        '24',
        'TRUE',
        'Ceremonial Matcha, Traditional Wagashi Sweets, Master Interpretation',
        'English, Japanese',
        'ACTIVE'
      ],
      [
        'exp-fr-louvre-vip',
        'france',
        'After-Hours Louvre VIP Tour & Masterpieces',
        'TOURS',
        '380',
        '340',
        '2',
        '6',
        '3',
        '48',
        'TRUE',
        'Skip-the-line VIP Access, Art Historian Guide, Whispers Audio',
        'English, French',
        'ACTIVE'
      ],
      [
        'trans-dxb-luxury-van',
        'dubai',
        'Chauffeur Mercedes V-Class Airport Transfer',
        'TRANSFERS',
        '160',
        '140',
        '1',
        '6',
        '2',
        '12',
        'TRUE',
        'Airport Meet & Greet, Bottled Water, Wi-Fi on Board, 60min Wait Time',
        'English, Arabic',
        'ACTIVE'
      ]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...sampleRows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'TheUnbound_MasterRateSheet_SampleFormat.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const syncService = SheetsSyncService.getInstance();
      const report = await syncService.executeSync(sheetId, sheetName, user);
      
      setSyncResult(report);
      setSelectedReport(report);
      setSyncHistory(db.getSyncReports());
    } catch (err: any) {
      console.error('Sync failed', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4 text-[#00C6A6]" />
            <span>Master Inventory Pipeline</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Google Sheets Manual Sync Manager</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Admin-controlled manual sync pipeline: validate sheet formulas, reconcile contracted catalog rates, and commit data to persistent database storage.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={handleDownloadSampleFormat}
            className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl transition-all cursor-pointer text-xs border border-slate-200"
            title="Download CSV template format for suppliers & DMCs"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download Sample Format</span>
          </button>

          <button
            id="btn-trigger-manual-sync"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-6 py-3 rounded-xl shadow-xs transition-all cursor-pointer text-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Executing Sync Pipeline...' : 'Run Manual Sync Now'}</span>
          </button>
        </div>
      </div>


      {syncResult && (
        <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center space-x-3 animate-in fade-in ${
          syncResult.status === 'SUCCESS' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          {syncResult.status === 'SUCCESS' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <span>
            Sync Completed ({syncResult.status}): {syncResult.counts.updatedRecords} products verified & updated across {syncResult.counts.totalProcessed} total items in {syncResult.durationMs}ms.
          </span>
        </div>
      )}

      {/* Architecture & Flow Diagram */}
      <div className="bg-slate-950 text-white rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
        <div className="flex items-center space-x-2 text-[#00E5C0] text-xs font-bold uppercase tracking-wider mb-4">
          <Database className="w-4 h-4" />
          <span>Three-Tier Operational Sync Architecture</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono text-[#00E5C0] uppercase font-bold block mb-1">Step 1 • Supplier Source</span>
            <h4 className="text-sm font-bold text-white mb-1">Google Sheets Catalog</h4>
            <p className="text-xs text-slate-400">Master raw rate sheets maintained by local destination DMCs and contracting teams.</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-xl border border-[#00C6A6]/40 relative">
            <span className="text-[10px] font-mono text-[#00E5C0] uppercase font-bold block mb-1">Step 2 • Admin Validation</span>
            <h4 className="text-sm font-bold text-[#00E5C0] mb-1">Manual Sync Pipeline</h4>
            <p className="text-xs text-slate-400">Admin-initiated formula validation, type checking, and currency normalizer.</p>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono text-[#00E5C0] uppercase font-bold block mb-1">Step 3 • Application Storage</span>
            <h4 className="text-sm font-bold text-white mb-1">Persistent App Database</h4>
            <p className="text-xs text-slate-400">Serving fast, reliable quotations, instant booking SLAs, and buyer storefronts.</p>
          </div>
        </div>
      </div>

      {/* Sheet Connection Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
            <Settings className="w-4 h-4 text-[#00C6A6]" />
            <span>Google Spreadsheet Source Parameters</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Google Sheets Spreadsheet ID / Key
            </label>
            <input
              type="text"
              value={sheetId}
              onChange={e => setSheetId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              placeholder="e.g. 1X9aBcD_TheUnbound_MasterRateSheet_2026"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Active Sheet Tab Name
            </label>
            <input
              type="text"
              value={sheetName}
              onChange={e => setSheetName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
              placeholder="e.g. MasterInventory2026"
            />
          </div>
        </div>
      </div>

      {/* Sync History & Execution Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <History className="w-4 h-4 text-slate-500" />
              <span>Audit Log History</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {syncHistory.length} Runs
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {syncHistory.map(report => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedReport?.id === report.id ? 'bg-[#00C6A6]/10' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    report.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {report.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{report.userEmail}</span>
                  <span className="font-mono">{report.counts.updatedRecords} items • {report.durationMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Report Inspection */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
              <Terminal className="w-4 h-4 text-slate-600" />
              <span>Sync Execution Trace & Logs</span>
            </div>
            {selectedReport && (
              <span className="text-xs font-mono text-slate-400">
                {selectedReport.id}
              </span>
            )}
          </div>

          {selectedReport ? (
            <div className="space-y-4">
              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Processed</span>
                  <p className="text-lg font-bold text-slate-900 font-mono">{selectedReport.counts.totalProcessed}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Updated</span>
                  <p className="text-lg font-bold text-[#008f77] font-mono">{selectedReport.counts.updatedRecords}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Validation Warnings</span>
                  <p className="text-lg font-bold text-amber-600 font-mono">{selectedReport.counts.errorsCount}</p>
                </div>
              </div>

              {/* Logs Stream */}
              <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-56 overflow-y-auto">
                {selectedReport.logs.map((log, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-[#00E5C0] select-none">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              Select a sync run from history to inspect detailed logs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
