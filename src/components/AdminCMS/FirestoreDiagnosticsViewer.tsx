import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Server, 
  ShieldCheck, 
  Clock, 
  Download, 
  Layers,
  Terminal,
  Wifi,
  WifiOff
} from 'lucide-react';
import { runFirestoreDiagnostics, FirestoreDiagnosticReport } from '../../services/firestoreDiagnostic';

export const FirestoreDiagnosticsViewer: React.FC = () => {
  const [report, setReport] = useState<FirestoreDiagnosticReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const executeDiagnosticCheck = async () => {
    setIsRunning(true);
    try {
      const result = await runFirestoreDiagnostics();
      setReport(result);
      setLastChecked(new Date());
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    executeDiagnosticCheck();
  }, []);

  const handleExportReport = () => {
    if (!report) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `firestore-diagnostics-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>LIVE FIRESTORE</span>
          </span>
        );
      case 'RESTRICTED_BY_RULES':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Protected by RBAC security rules">
            <ShieldCheck className="w-3 h-3 text-indigo-600" />
            <span>PROTECTED BY RBAC RULES</span>
          </span>
        );
      case 'EMPTY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            <span>EMPTY (SEEDING ON WRITE)</span>
          </span>
        );
      case 'ERROR':
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3" />
            <span>ERROR / FALLBACK</span>
          </span>
        );
    }
  };

  const collectionKeys = report ? (Object.keys(report.collections) as Array<keyof typeof report.collections>) : [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4" />
            <span>Live Firestore Diagnostic & Verification Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Database Connectivity & Source-of-Truth Auditor
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Directly probes the production Firebase Firestore instance to verify that Products, Quotes, Bookings, and Users are querying the live database instead of local mock fixtures.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {report && (
            <button
              id="export-diagnostics-json-btn"
              onClick={handleExportReport}
              className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON</span>
            </button>
          )}

          <button
            id="run-firestore-diagnostics-btn"
            onClick={executeDiagnosticCheck}
            disabled={isRunning}
            className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00705e] text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Auditing Database...' : 'Run Diagnostics'}</span>
          </button>
        </div>
      </div>

      {/* Overall Health Status Panel */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Status */}
          <div className={`p-5 rounded-3xl border ${
            report.overallStatus === 'HEALTHY' 
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
              : report.overallStatus === 'DEGRADED'
              ? 'bg-amber-50/70 border-amber-200 text-amber-950'
              : 'bg-rose-50/70 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Live Health</span>
              {report.overallStatus === 'HEALTHY' ? (
                <Wifi className="w-4 h-4 text-emerald-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="text-xl font-black">{report.overallStatus}</div>
            <div className="text-xs text-slate-600 mt-1">
              {report.summary.connectedCollections} of {report.summary.totalCollectionsChecked} collections active
            </div>
          </div>

          {/* Card 2: Database ID */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Target Database</span>
              <Database className="w-4 h-4 text-[#008972]" />
            </div>
            <div className="text-xs font-mono font-bold text-slate-900 truncate" title={report.databaseId}>
              {report.databaseId}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Project: {report.projectId}
            </div>
          </div>

          {/* Card 3: Query Roundtrip Latency */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Total Latency</span>
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {report.totalLatencyMs} <span className="text-xs font-normal text-slate-500">ms</span>
            </div>
            <div className="text-xs text-slate-500">
              Server ping {report.serverPingSuccess ? 'responded' : 'pending'}
            </div>
          </div>

          {/* Card 4: Source of Truth */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Source of Truth</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-sm font-extrabold text-slate-900">
              {report.summary.isAuthoritativeLiveDb ? 'Cloud Firestore (Live)' : 'Local Fallback'}
            </div>
            <div className="text-xs text-slate-500">
              {lastChecked ? `Checked ${lastChecked.toLocaleTimeString()}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Collection Diagnostic Grid */}
      {report && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
              <Layers className="w-4 h-4 text-[#008972]" />
              <span>Collection Verification Breakdown</span>
            </div>
            <span className="text-xs text-slate-500">
              {collectionKeys.length} Collections Audited
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collectionKeys.map(key => {
              const item = report.collections[key];
              const keyStr = String(key);
              return (
                <div 
                  key={keyStr}
                  id={`diagnostic-coll-${keyStr}`}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        /{item.collectionName}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">{item.displayName}</h4>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Live Document Count</span>
                      <span className="font-mono font-bold text-slate-900">{item.documentCount} docs</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Fetch Latency</span>
                      <span className="font-mono font-bold text-slate-900">{item.latencyMs} ms</span>
                    </div>
                  </div>

                  {item.sampleIds && (item.sampleIds || []).length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-slate-400 text-[10px] block mb-1">Sample Firestore Document IDs:</span>
                      <div className="flex flex-wrap gap-1">
                        {(item.sampleIds || []).map(id => (
                          <span key={id} className="text-[9px] font-mono bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-full">
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.errorDetails && (
                    <div className={`pt-2 border-t text-xs ${item.status === 'RESTRICTED_BY_RULES' ? 'border-indigo-100 text-indigo-700' : 'border-rose-200 text-rose-700'}`}>
                      <span className="font-bold">{item.status === 'RESTRICTED_BY_RULES' ? 'Security Policy: ' : 'Error: '}</span>{item.errorDetails}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Terminal Output / Diagnostic Trace Logs */}
      {report && report.notes && (report.notes || []).length > 0 && (
        <div className="bg-slate-950 text-slate-200 rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 text-xs font-mono text-[#00E5C0]">
            <Terminal className="w-4 h-4" />
            <span>Diagnostic Audit Trace Logs</span>
          </div>
          <div className="space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto pr-2 text-slate-300">
            {(report.notes || []).map((note, idx) => (
              <div key={idx} className="leading-relaxed">
                <span className="text-slate-500 mr-2">&gt;</span>
                {typeof note === 'string' ? note : (note as any)?.text || JSON.stringify(note)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
