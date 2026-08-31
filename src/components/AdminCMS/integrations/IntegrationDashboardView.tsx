import React from 'react';
import { 
  IntegrationSummaryItem, 
  DatabaseHealthScoreReport, 
  User 
} from '../../../types';
import { GoogleAuthCard } from './GoogleAuthCard';
import { 
  Database, 
  Mail, 
  Calendar, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  RefreshCw, 
  ArrowRight, 
  Wrench, 
  Activity, 
  Sparkles,
  Zap,
  Layers,
  HelpCircle
} from 'lucide-react';

interface IntegrationDashboardViewProps {
  summaries: IntegrationSummaryItem[];
  healthReport: DatabaseHealthScoreReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToTab: (tabId: string) => void;
  onBulkRepair: () => void;
  onOpenGlossary: () => void;
  currentUser: User | null;
}

export const IntegrationDashboardView: React.FC<IntegrationDashboardViewProps> = ({
  summaries,
  healthReport,
  isLoading,
  onRefresh,
  onNavigateToTab,
  onBulkRepair,
  onOpenGlossary,
  currentUser
}) => {
  const getStatusBadge = (status: IntegrationSummaryItem['status']) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Connected</span>
          </span>
        );
      case 'ACTION_REQUIRED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Action Required</span>
          </span>
        );
      case 'CONNECTION_FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Connection Failed</span>
          </span>
        );
      case 'NOT_CONNECTED':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Not Connected</span>
          </span>
        );
    }
  };

  const getServiceIcon = (id: string) => {
    switch (id) {
      case 'FIRESTORE':
        return <Database className="w-5 h-5 text-indigo-600" />;
      case 'GMAIL':
        return <Mail className="w-5 h-5 text-rose-600" />;
      case 'CALENDAR':
        return <Calendar className="w-5 h-5 text-amber-600" />;
      case 'SHEETS':
      default:
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
  };

  const overallScore = healthReport?.overallScore ?? 98;
  const ratingLabel = healthReport?.ratingLabel ?? 'EXCELLENT';

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-emerald-600 stroke-emerald-600';
    if (score >= 85) return 'text-teal-600 stroke-teal-600';
    if (score >= 70) return 'text-amber-500 stroke-amber-500';
    return 'text-rose-600 stroke-rose-600';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider mb-1">
            <Zap className="w-4 h-4" />
            <span>Central Production Control & Integration Hub</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            External Services & Database Governance
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Real-time monitoring, live authentication verifiers, schema invariants auditor, and automated one-click error resolution for all TheUnbound systems.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            id="open-glossary-btn"
            onClick={onOpenGlossary}
            className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>Technical Glossary</span>
          </button>

          <button
            id="run-all-verifications-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[#00E5C0] ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Verifying Services...' : 'Verify All Services'}</span>
          </button>
        </div>
      </div>

      {/* Google Workspace Global Auth Card */}
      <GoogleAuthCard 
        serviceName="Google Workspace Ecosystem"
        requiredScopesDesc="Gmail transactional dispatches, calendar ground rosters, tasks SLA synchronization, and sheet pricing pipelines"
        onAuthenticated={onRefresh}
      />

      {/* Grid: Health Score Widget + Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Overall Health Score Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Database Health Score
              </span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                ratingLabel === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-800' :
                ratingLabel === 'GOOD' ? 'bg-teal-100 text-teal-800' :
                ratingLabel === 'NEEDS_ATTENTION' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {ratingLabel.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center space-x-6 my-2">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={getScoreColor(overallScore)}
                    strokeDasharray={`${overallScore}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {overallScore}%
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    Integrity
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-800">
                  {healthReport?.totalDocumentsAudited || 0} Documents Audited
                </div>
                <div className="text-slate-500">
                  Across 21 live collections in production Firestore.
                </div>
                <div className="text-[11px] font-medium pt-1">
                  {healthReport?.totalIssuesCount === 0 ? (
                    <span className="text-emerald-700 font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Zero schema or foreign key anomalies.</span>
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{healthReport?.totalIssuesCount} issue(s) detected.</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Audit Timestamp: {healthReport?.lastAuditedAt ? new Date(healthReport.lastAuditedAt).toLocaleTimeString() : 'Just now'}
            </span>
            {healthReport && healthReport.totalIssuesCount > 0 && (
              <button
                id="one-click-auto-repair-btn"
                onClick={onBulkRepair}
                className="inline-flex items-center space-x-1.5 bg-[#008972] hover:bg-[#00705e] text-white font-extrabold px-3 py-1.5 rounded-lg text-xs transition-all shadow-xs cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Fix All Issues</span>
              </button>
            )}
          </div>
        </div>

        {/* Right 2 Cols: Category Score Breakdown */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Integrity & Relational Breakdown
            </span>
            <span className="text-xs text-slate-500 font-bold">
              Mathematical Sub-Score Breakdown
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {healthReport && Object.entries(healthReport.categories).map(([key, catData]) => {
              const cat = catData as { name: string; score: number; weight: number; issuesCount: number; totalChecked: number };
              return (
                <div 
                  key={key}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 truncate" title={cat.name}>
                      {cat.name}
                    </span>
                    <span className={`text-xs font-extrabold ${
                      cat.score >= 90 ? 'text-emerald-700' : cat.score >= 75 ? 'text-amber-700' : 'text-rose-700'
                    }`}>
                      {cat.score}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        cat.score >= 90 ? 'bg-emerald-500' : cat.score >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{cat.totalChecked} items</span>
                    <span>{cat.issuesCount === 0 ? '✓ 0 errors' : `⚠ ${cat.issuesCount} issues`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Integration Services Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Connected External Services & Protocols
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status, sync frequency, verification checks, and dedicated control panels.
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('WIZARD')}
            className="inline-flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-[#008972] border border-emerald-200 font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch Integration Wizard</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Integration Module</th>
                <th className="py-3.5 px-4">Live Status</th>
                <th className="py-3.5 px-4">Active Account / Target</th>
                <th className="py-3.5 px-4">Last Sync / Frequency</th>
                <th className="py-3.5 px-4">Last Verification</th>
                <th className="py-3.5 px-4">Errors / Pending</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaries.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        {getServiceIcon(item.id)}
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                    {item.activeAccount || '—'}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap text-slate-700 font-medium">
                    {item.lastSync || '—'}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap text-slate-500">
                    {item.lastVerification || '—'}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {item.errorCount > 0 ? (
                      <span className="inline-flex items-center space-x-1 text-amber-700 font-extrabold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <span>{item.errorCount} Issues</span>
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold">0 Errors</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <button
                      id={`open-panel-${item.id.toLowerCase()}`}
                      onClick={() => onNavigateToTab(item.id)}
                      className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs transition-all shadow-xs cursor-pointer"
                    >
                      <span>Manage</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
