import React, { useState, useEffect } from 'react';
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
  Layers,
  ArrowRight,
  Printer,
  Mail,
  Briefcase,
  Eye,
  MessageCircle
} from 'lucide-react';
import { AuditLog, User, Quotation } from '../../../types';
import { SystemHealthReport } from '../../../services/dashboardMetricsService';
import { AppDatabase } from '../../../services/db';
import { ProposalDocumentView } from '../../ProposalDocumentView';
import { ShareWhatsAppModal } from '../../B2BAgentPortal/ShareWhatsAppModal';

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
  const db = AppDatabase.getInstance();
  const [quotations, setQuotations] = useState<Quotation[]>(() => db.getAllSavedQuotesForUser(currentUser));
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);
  const [whatsAppQuote, setWhatsAppQuote] = useState<Quotation | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      const qList = db.getAllSavedQuotesForUser(currentUser);
      setQuotations(qList);
      if (qList.length > 0 && !selectedQuoteId) {
        setSelectedQuoteId(qList[0].id);
      }
    });
    return unsub;
  }, [db, currentUser, selectedQuoteId]);

  useEffect(() => {
    if (quotations.length > 0 && !selectedQuoteId) {
      setSelectedQuoteId(quotations[0].id);
    }
  }, [quotations, selectedQuoteId]);

  const activeQuote = quotations.find(q => q.id === selectedQuoteId) || (quotations.length > 0 ? quotations[0] : null);

  const handleConvertToBooking = (quote: Quotation) => {
    try {
      const booking = db.submitBookingFromQuote(quote.id, currentUser);
      setActionNotice(`Quote #${quote.quoteNumber} converted to Ground Booking #${booking.bookingReference}`);
      setTimeout(() => setActionNotice(null), 4000);
      onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', booking.id);
    } catch (e: any) {
      setActionNotice(e.message || 'Error converting quote to booking');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleEmailClient = (quote: Quotation) => {
    const email = quote.clientEmail || '';
    const subject = encodeURIComponent(`TheUnbound DMC Proposal - ${quote.destination || 'Luxury Travel'} (#${quote.quoteNumber})`);
    const totalPax = (quote as any).totalGuests || (quote as any).pax || 2;
    const travelDate = (quote as any).travelStartDate || (quote as any).dateRange || 'Flexible';
    const body = encodeURIComponent(`Dear ${quote.clientName || 'Valued Partner'},\n\nPlease find your curated itinerary and quotation proposal (#${quote.quoteNumber}) for ${quote.destination || 'your destination'}.\n\nTotal Pax: ${totalPax}\nTravel Dates: ${travelDate}\n\nWarm regards,\nTheUnbound Operational Concierge`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

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
      desc: 'Open new proposal workspace',
      icon: FileText,
      color: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
      action: () => onNavigate('LEAD_MANAGEMENT', 'BUILDER', 'new')
    },
    {
      id: 'qa-quote-ledger',
      title: 'Quotation Records',
      desc: 'Inspect existing quotes & versions',
      icon: Layers,
      color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
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
              QUICK ACTION LAUNCHPAD
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

        {/* Action Notice Alert */}
        {actionNotice && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Quotation Operations Launchpad (8 Mandatory Actions) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>QUOTATION OPERATIONS LAUNCHPAD</span>
              </h3>
              <p className="text-[11px] text-slate-500">Live proposal execution, PDF generation, messaging & conversion</p>
            </div>
            <button
              id="qa-new-quote-top-btn"
              onClick={() => onNavigate('LEAD_MANAGEMENT', 'BUILDER', 'new')}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Quotation</span>
            </button>
          </div>

          {quotations.length === 0 ? (
            <div className="p-5 text-center rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
              <p className="text-xs text-slate-500">
                Authoritative Firestore quotation ledger currently contains 0 records.
              </p>
              <button
                id="qa-empty-create-quote-btn"
                onClick={() => onNavigate('LEAD_MANAGEMENT', 'BUILDER', 'new')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Quotation</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Quote Selector */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Select Active Quotation Record ({quotations.length} Live in Firestore)
                </label>
                <select
                  id="qa-quote-selector"
                  value={selectedQuoteId || activeQuote?.id || ''}
                  onChange={(e) => setSelectedQuoteId(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-purple-500 transition-colors"
                >
                  {quotations.map(q => (
                    <option key={q.id} value={q.id}>
                      #{q.quoteNumber || q.id} — {q.clientName || 'Client'} ({q.destination || 'Destination'}) • {q.currency || 'USD'} {Number(q.totalPrice || 0).toLocaleString()} [{q.status || 'DRAFT'}]
                    </option>
                  ))}
                </select>
              </div>

              {activeQuote && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {/* Action 1: Create Quotation */}
                  <button
                    id="qa-btn-create-quote"
                    onClick={() => onNavigate('LEAD_MANAGEMENT', 'BUILDER', 'new')}
                    className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-purple-900 text-left cursor-pointer transition-colors flex flex-col justify-between"
                    title="Create Quotation: Open new quotation workspace"
                  >
                    <Plus className="w-4 h-4 text-purple-600 mb-1.5" />
                    <div>
                      <div className="text-[11px] font-extrabold leading-tight">Create Quotation</div>
                      <div className="text-[9px] text-purple-700">New workspace</div>
                    </div>
                  </button>

                  {/* Action 2: Open Quotation */}
                  <button
                    id="qa-btn-open-quote"
                    onClick={() => onNavigate('LEAD_MANAGEMENT', 'QUOTES', activeQuote.id)}
                    className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900 text-left cursor-pointer transition-colors flex flex-col justify-between"
                    title="Open Quotation: View quote records & versions"
                  >
                    <Layers className="w-4 h-4 text-indigo-600 mb-1.5" />
                    <div>
                      <div className="text-[11px] font-extrabold leading-tight">Open Quotation</div>
                      <div className="text-[9px] text-indigo-700">Ledger details</div>
                    </div>
                  </button>

                  {/* Action 3: Open in Builder */}
                  <button
                    id="qa-btn-open-builder"
                    onClick={() => onNavigate('LEAD_MANAGEMENT', 'BUILDER', activeQuote.id)}
                    className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-900 text-left cursor-pointer transition-colors flex flex-col justify-between"
                    title="Open in Builder: Edit quotation in workspace"
                  >
                    <FileText className="w-4 h-4 text-blue-600 mb-1.5" />
                    <div>
                      <div className="text-[11px] font-extrabold leading-tight">Open in Builder</div>
                      <div className="text-[9px] text-blue-700">Edit items & rates</div>
                    </div>
                  </button>

                  {/* Action 4: Preview Proposal */}
                  <button
                    id="qa-btn-preview-proposal"
                    onClick={() => setPreviewQuote(activeQuote)}
                    className="p-2.5 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100 text-teal-900 text-left cursor-pointer transition-colors flex flex-col justify-between"
                    title="Preview Proposal: View authoritative client proposal"
                  >
                    <Eye className="w-4 h-4 text-[#008972] mb-1.5" />
                    <div>
                      <div className="text-[11px] font-extrabold leading-tight">Preview Proposal</div>
                      <div className="text-[9px] text-teal-700">Document view</div>
                    </div>
                  </button>

                  {/* Action 5: Download PDF */}
                  <button
                    id="qa-btn-download-pdf"
                    onClick={() => setPreviewQuote(activeQuote)}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-left cursor-pointer transition-colors flex flex-col justify-between"
                    title="Download PDF: Export printable proposal"
                  >
                    <Printer className="w-4 h-4 text-slate-700 mb-1.5" />
                    <div>
                      <div className="text-[11px] font-extrabold leading-tight">Download PDF</div>
                      <div className="text-[9px] text-slate-500">Printable export</div>
                    </div>
                  </button>

                  {/* Action 6: Share WhatsApp */}
                  <button
                    id="qa-btn-share-whatsapp"
                    onClick={() => setWhatsAppQuote(activeQuote)}
                    className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-900 text-left cursor-pointer transition-colors flex flex-col justify-between"
                    title="Share WhatsApp: Client-ready WhatsApp summary"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600 mb-1.5" />
                    <div>
                      <div className="text-[11px] font-extrabold leading-tight">Share WhatsApp</div>
                      <div className="text-[9px] text-emerald-700">Instant dispatch</div>
                    </div>
                  </button>

                  {/* Action 7: Email Client */}
                  <button
                    id="qa-btn-email-client"
                    onClick={() => handleEmailClient(activeQuote)}
                    className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/50 hover:bg-sky-100 text-sky-900 text-left cursor-pointer transition-colors flex flex-col justify-between"
                    title="Email Client: Send quote via mail client"
                  >
                    <Mail className="w-4 h-4 text-sky-600 mb-1.5" />
                    <div>
                      <div className="text-[11px] font-extrabold leading-tight">Email Client</div>
                      <div className="text-[9px] text-sky-700">Direct mailto</div>
                    </div>
                  </button>

                  {/* Action 8: Convert to Booking */}
                  <button
                    id="qa-btn-convert-booking"
                    onClick={() => handleConvertToBooking(activeQuote)}
                    className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white text-left cursor-pointer transition-colors flex flex-col justify-between shadow-xs"
                    title="Convert to Booking: Create authoritative Firestore booking"
                  >
                    <Briefcase className="w-4 h-4 text-emerald-100 mb-1.5" />
                    <div>
                      <div className="text-[11px] font-extrabold leading-tight">Convert to Booking</div>
                      <div className="text-[9px] text-emerald-100">Confirmed reserve</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
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

      {/* MODAL: Authoritative Proposal Document Preview */}
      {previewQuote && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-fadeIn">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#008972]" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Authoritative Proposal Document — #{previewQuote.quoteNumber || previewQuote.id}
                </h3>
              </div>
              <button
                onClick={() => setPreviewQuote(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
              <ProposalDocumentView
                quote={previewQuote}
                onClose={() => setPreviewQuote(null)}
                onBookNow={() => {
                  setPreviewQuote(null);
                  handleConvertToBooking(previewQuote);
                }}
                onShareWhatsApp={() => {
                  setWhatsAppQuote(previewQuote);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WhatsApp Quotation Dispatch */}
      {whatsAppQuote && (
        <ShareWhatsAppModal
          quote={whatsAppQuote}
          user={currentUser}
          onClose={() => setWhatsAppQuote(null)}
          onSuccess={(updatedQuote) => {
            setWhatsAppQuote(null);
            setActionNotice(`Quote #${updatedQuote.quoteNumber} dispatched via WhatsApp.`);
            setTimeout(() => setActionNotice(null), 4000);
          }}
        />
      )}
    </div>
  );
};
