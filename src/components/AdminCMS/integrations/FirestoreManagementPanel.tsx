import React, { useState } from 'react';
import { 
  DatabaseHealthScoreReport, 
  CollectionVerificationResult, 
  DatabaseIssueItem, 
  User 
} from '../../../types';
import { IntegrationsHubService } from '../../../services/integrationsHubService';
import firebaseConfigJson from '../../../../firebase-applet-config.json';
import { 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Wrench, 
  Code, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Layers, 
  Key, 
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
  Zap
} from 'lucide-react';

interface FirestoreManagementPanelProps {
  healthReport: DatabaseHealthScoreReport | null;
  onRefresh: () => void;
  currentUser: User | null;
}

export const FirestoreManagementPanel: React.FC<FirestoreManagementPanelProps> = ({
  healthReport,
  onRefresh,
  currentUser
}) => {
  const hubService = IntegrationsHubService.getInstance();
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs: number; details: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('products');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [devModeIssueId, setDevModeIssueId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const [repairingIssueId, setRepairingIssueId] = useState<string | null>(null);
  const [repairSuccessMessage, setRepairSuccessMessage] = useState<string | null>(null);

  const handlePing = async () => {
    setIsPinging(true);
    try {
      const result = await hubService.verifyFirestoreConnection();
      setPingResult(result);
    } catch (err: any) {
      setPingResult({
        success: false,
        latencyMs: 0,
        details: err?.message || 'Connection failed'
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handleRepairSingle = async (issue: DatabaseIssueItem) => {
    setRepairingIssueId(issue.id);
    try {
      const ok = await hubService.repairIssue(issue, currentUser);
      if (ok) {
        setRepairSuccessMessage(`Successfully repaired: "${issue.recordTitle}"`);
        setTimeout(() => setRepairSuccessMessage(null), 4000);
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRepairingIssueId(null);
    }
  };

  const handleRepairAllInCollection = async (collectionKey: string) => {
    const colResult = healthReport?.collectionResults[collectionKey];
    if (!colResult) return;

    setRepairingIssueId(`collection-${collectionKey}`);
    try {
      for (const issue of colResult.issues) {
        if (issue.canAutoFix) {
          await hubService.repairIssue(issue, currentUser);
        }
      }
      setRepairSuccessMessage(`Auto-repaired all fixable issues in "${colResult.displayName}"`);
      setTimeout(() => setRepairSuccessMessage(null), 4000);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setRepairingIssueId(null);
    }
  };

  const activeCollectionResult: CollectionVerificationResult | undefined = 
    healthReport?.collectionResults[selectedCollection];

  const filteredIssues = activeCollectionResult?.issues.filter(issue => {
    if (severityFilter === 'ALL') return true;
    return issue.severity === severityFilter;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Database className="w-4 h-4" />
            <span>Cloud Database Control & Verification</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Firestore / Firebase Management Panel
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Live database health probe, foreign key relationship validator, schema invariant checker, and automated repair console.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            id="ping-firestore-btn"
            onClick={handlePing}
            disabled={isPinging}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Activity className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Pinging Server...' : 'Test Connection'}</span>
          </button>

          <button
            id="refresh-database-audit-btn"
            onClick={onRefresh}
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#00E5C0]" />
            <span>Re-Run Audit</span>
          </button>
        </div>
      </div>

      {/* Ping Results Notification */}
      {pingResult && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
          pingResult.success 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center space-x-3">
            {pingResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div>
              <span className="font-extrabold">{pingResult.success ? 'Live Server Responding:' : 'Connection Alert:'}</span>{' '}
              <span>{pingResult.details}</span>
            </div>
          </div>
          {pingResult.success && (
            <span className="font-mono font-bold bg-emerald-100/80 px-2.5 py-1 rounded-lg text-emerald-800 shrink-0">
              {pingResult.latencyMs} ms
            </span>
          )}
        </div>
      )}

      {/* Repair Success Notification */}
      {repairSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-3 text-xs animate-in fade-in duration-200 font-bold">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{repairSuccessMessage}</span>
        </div>
      )}

      {/* Project Specs & Configuration Box */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#00E5C0]" />
            <span className="text-xs font-extrabold tracking-wider uppercase text-slate-300">
              Production Database Configuration
            </span>
          </div>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-900/60 text-[#00E5C0] border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5C0] animate-pulse"></span>
            <span>Production Authoritative Database</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">GCP Project ID</div>
            <div className="font-mono font-bold text-white mt-1 truncate" title={firebaseConfigJson.projectId}>
              {firebaseConfigJson.projectId || 'Not Configured'}
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">Firestore Database ID</div>
            <div className="font-mono font-bold text-[#00E5C0] mt-1 truncate" title={firebaseConfigJson.firestoreDatabaseId}>
              {firebaseConfigJson.firestoreDatabaseId || '(default)'}
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">Storage Bucket</div>
            <div className="font-mono font-bold text-white mt-1 truncate" title={firebaseConfigJson.storageBucket}>
              {firebaseConfigJson.storageBucket || 'firebasestorage.app'}
            </div>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-slate-400">Firebase API Key</div>
              <div className="font-mono font-bold text-slate-300 mt-1 truncate">
                {showApiKey ? firebaseConfigJson.apiKey : 'AIzaSyCDWKdg••••••••••••••••••••'}
              </div>
            </div>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
              title={showApiKey ? 'Mask Key' : 'Show Key'}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Collection Navigator & Health Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Collections Integrity & Relationship Inspector
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a collection below to inspect field completeness, foreign key relations, duplicate keys, and one-click auto-repair.
            </p>
          </div>

          {activeCollectionResult && activeCollectionResult.issues.length > 0 && (
            <button
              id="fix-all-in-collection-btn"
              onClick={() => handleRepairAllInCollection(selectedCollection)}
              disabled={repairingIssueId === `collection-${selectedCollection}`}
              className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00705e] text-white font-extrabold px-3.5 py-2 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Fix All in {activeCollectionResult.displayName}</span>
            </button>
          )}
        </div>

        {/* Collection Pills / Selector */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center space-x-2 overflow-x-auto">
          {healthReport && Object.entries(healthReport.collectionResults).map(([key, colData]) => {
            const col = colData as CollectionVerificationResult;
            const isSelected = selectedCollection === key;
            return (
              <button
                key={key}
                id={`select-collection-${key}`}
                onClick={() => setSelectedCollection(key)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-xs font-extrabold' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>{col.displayName}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'
                }`}>
                  {col.totalRecords}
                </span>
                {col.issues && col.issues.length > 0 && (
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-amber-500'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Collection Summary Header */}
        {activeCollectionResult && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Records</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{activeCollectionResult.totalRecords}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="text-[10px] uppercase font-bold text-emerald-600">Valid Records</div>
                <div className="text-lg font-black text-emerald-900 mt-0.5">{activeCollectionResult.validRecords}</div>
              </div>
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="text-[10px] uppercase font-bold text-amber-600">Missing Fields</div>
                <div className="text-lg font-black text-amber-900 mt-0.5">{activeCollectionResult.missingFieldsCount}</div>
              </div>
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="text-[10px] uppercase font-bold text-rose-600">Broken Relations</div>
                <div className="text-lg font-black text-rose-900 mt-0.5">{activeCollectionResult.brokenRelationshipsCount}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400">Duplicate Keys</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{activeCollectionResult.duplicateRecordsCount}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-400">Orphan Records</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{activeCollectionResult.orphanRecordsCount}</div>
              </div>
            </div>

            {/* Filter Controls & Issues List */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Verification Breakdown & Actionable Solutions ({filteredIssues.length})
                </h4>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400 font-bold">Severity:</span>
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                    {(['ALL', 'CRITICAL', 'WARNING'] as const).map(sev => (
                      <button
                        key={sev}
                        onClick={() => setSeverityFilter(sev)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          severityFilter === sev 
                            ? 'bg-white text-slate-900 shadow-xs' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredIssues.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <div className="font-extrabold text-slate-800 text-sm">All Records Fully Compliant</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Zero schema anomalies, missing fields, or broken relational references detected in {activeCollectionResult.displayName}.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIssues.map(issue => {
                    const isExpanded = expandedIssueId === issue.id;
                    const isDevModeOpen = devModeIssueId === issue.id;

                    return (
                      <div 
                        key={issue.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          issue.severity === 'CRITICAL' 
                            ? 'bg-rose-50/40 border-rose-200' 
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        {/* Issue Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                issue.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {issue.severity}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {issue.category.replace('_', ' ')}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border">
                                ID: {issue.documentId}
                              </span>
                            </div>
                            <div className="font-extrabold text-slate-900 text-sm">
                              {issue.recordTitle}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {issue.canAutoFix && (
                              <button
                                onClick={() => handleRepairSingle(issue)}
                                disabled={repairingIssueId === issue.id}
                                className="inline-flex items-center space-x-1.5 bg-[#008972] hover:bg-[#00705e] text-white font-extrabold px-3 py-1.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                                <span>{repairingIssueId === issue.id ? 'Fixing...' : 'Fix Issue'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border text-slate-600 transition-colors cursor-pointer"
                              title={isExpanded ? 'Collapse' : 'Expand Details'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Plain Business Language Explanation Section */}
                        <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 block">
                              1. Problem
                            </span>
                            <p className="text-slate-700 leading-relaxed font-medium">
                              {issue.problem}
                            </p>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 block">
                              2. What This Means
                            </span>
                            <p className="text-slate-700 leading-relaxed">
                              {issue.businessImpact}
                            </p>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block">
                              3. How To Fix
                            </span>
                            <p className="text-slate-700 leading-relaxed">
                              {issue.recommendedFix}
                            </p>
                          </div>
                        </div>

                        {/* Developer Mode Dropdown / Inspector */}
                        <div className="mt-3 pt-2 border-t border-slate-200/60">
                          <button
                            onClick={() => setDevModeIssueId(isDevModeOpen ? null : issue.id)}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          >
                            <Code className="w-3.5 h-3.5 text-slate-400" />
                            <span>{isDevModeOpen ? 'Hide Developer Inspection ▴' : 'Developer Mode (Technical Details) ▾'}</span>
                          </button>

                          {isDevModeOpen && (
                            <div className="mt-2 p-3 bg-slate-900 rounded-xl text-slate-300 font-mono text-[11px] space-y-2 overflow-x-auto">
                              <div className="flex items-center justify-between text-slate-400 text-[10px] border-b border-slate-800 pb-1">
                                <span>FIELD: {issue.technicalDetails.fieldName || 'N/A'}</span>
                                <span>TARGET: {issue.technicalDetails.targetCollection || 'CURRENT'}</span>
                              </div>
                              <pre className="text-slate-200 text-[10px] leading-relaxed">
                                {JSON.stringify(issue.technicalDetails, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
