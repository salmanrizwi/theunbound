import React from 'react';
import { 
  Activity, 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  User as UserIcon, 
  Calendar, 
  FileText, 
  Users, 
  Building2, 
  Send, 
  Download, 
  ShieldCheck, 
  RefreshCw,
  Server,
  Zap,
  ArrowRight
} from 'lucide-react';
import { AuditLog, User } from '../../../types';
import { SystemHealthReport } from '../../../services/dashboardMetricsService';

interface AuditStreamAndQuickActionsSectionProps {
  auditLogs: AuditLog[];
  systemHealth: SystemHealthReport | null;
  currentUser: User | null;
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
  onOpenQuickActionModal?: (action: string) => void;
}

export const AuditStreamAndQuickActionsSection: React.FC<AuditStreamAndQuickActionsSectionProps> = ({
  auditLogs,
  systemHealth,
  currentUser,
  onNavigate,
  onOpenQuickActionModal
}) => {
  const quickActions = [
    {
      id: 'qa-booking',
      title: 'New Booking',
      desc: 'Create or record reservation',
      icon: Plus,
      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
      action: () => onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS')
    },
    {
      id: 'qa-lead',
      title: 'Log Inbound Lead',
      desc: 'Capture agency inquiry',
      icon: Users,
      color: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
      action: () => onNavigate('LEAD_MANAGEMENT', 'LEADS')
    },
    {
      id: 'qa-quote',
      title: 'Create Quotation',
      desc: 'Price custom FIT/Group proposal',
      icon: FileText,
      color: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
      action: () => onNavigate('LEAD_MANAGEMENT', 'QUOTES')
    },
    {
      id: 'qa-supplier',
      title: 'Register Supplier',
      desc: 'Add DMC hotel, transfer, or guide',
      icon: Building2,
      color: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
      action: () => onNavigate('ACCOUNT_MANAGEMENT', 'SUPPLIERS')
    },
    {
      id: 'qa-system-analysis',
      title: 'Audit System Integrity',
      desc: 'Run full data & price diagnostics',
      icon: Zap,
      color: 'bg-teal-50 text-[#008972] hover:bg-teal-100',
      action: () => onNavigate('SYSTEM_ANALYSIS')
    },
    {
      id: 'qa-database-export',
      title: 'Export Operations DB',
      desc: 'Download CSV / JSON backup',
      icon: Download,
      color: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      action: () => onNavigate('DATABASE_MANAGEMENT', 'DATABASE')
    }
  ];

  return (
    <div id="cms-audit-and-quick-actions" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: Live Audit Activity Feed (7 Cols on lg) */}
      <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#008972] flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Live Operational Audit Stream
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Authoritative transaction logs, pricing overrides, document exports and status changes.
            </p>
          </div>

          <button
            onClick={() => onNavigate('DATABASE_MANAGEMENT', 'AUDIT_LOGS')}
            className="text-xs font-bold text-[#008972] hover:underline flex items-center space-x-1"
          >
            <span>Full Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
            No audit records logged yet in this session.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {auditLogs.slice(0, 6).map((log) => {
              const timeStr = log.timestamp 
                ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now';

              return (
                <div key={log.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs group">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-slate-900">
                          {log.userName || log.userEmail || 'System Operator'}
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold uppercase">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          · {log.entityType}
                        </span>
                      </div>

                      <p className="text-slate-600 text-xs truncate">
                        {log.details || `Performed ${log.action} on ${log.entityType} (${log.entityId})`}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono shrink-0 whitespace-nowrap">
                    {timeStr}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT: Quick Action Launchpad & System Health Status (5 Cols on lg) */}
      <div className="lg:col-span-5 space-y-6">
        {/* Quick Actions Grid */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Quick Action Launchpad
            </h3>
            <p className="text-[11px] text-slate-500">Accelerated navigation to daily execution modules</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map(qa => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.id}
                  id={qa.id}
                  onClick={qa.action}
                  className={`p-3 rounded-2xl border border-slate-200/80 text-left transition-all cursor-pointer flex flex-col justify-between group ${qa.color}`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="w-4 h-4" />
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="mt-2">
                    <div className="font-extrabold text-xs text-slate-900 leading-tight">
                      {qa.title}
                    </div>
                    <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {qa.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live System Health */}
        {systemHealth && (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Live System Health
                </span>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                systemHealth.overallStatus === 'HEALTHY'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {systemHealth.overallStatus}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {systemHealth.services.slice(0, 4).map((srv, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      srv.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                    <span className="font-bold text-slate-800 truncate">{srv.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate max-w-[160px]">
                    {srv.details}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
