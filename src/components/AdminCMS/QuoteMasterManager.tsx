import React, { useState, useEffect } from 'react';
import { Quotation, QuoteStatus } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../services/pricingEngine';
import { downloadQuotationPDF } from '../../services/pdfGenerator';
import { 
  FileSpreadsheet, 
  Search, 
  Filter, 
  ShieldCheck, 
  Lock, 
  Eye, 
  Trash2, 
  Download, 
  Calendar, 
  User as UserIcon, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  Copy,
  Tag,
  Check
} from 'lucide-react';

interface QuoteMasterManagerProps {
  onLoadQuote?: (quote: Quotation) => void;
}

export const QuoteMasterManager: React.FC<QuoteMasterManagerProps> = ({ onLoadQuote }) => {
  const db = AppDatabase.getInstance();
  const { user, role } = useAuth();
  const [quotes, setQuotes] = useState<Quotation[]>(() => db.getQuotesForUser(user));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewingQuote, setViewingQuote] = useState<Quotation | null>(null);
  const [editingLeadIdQuoteId, setEditingLeadIdQuoteId] = useState<string | null>(null);
  const [leadIdInput, setLeadIdInput] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const isB2BAgent = role === 'B2B_AGENT';

  useEffect(() => {
    return db.subscribe(() => {
      setQuotes(db.getQuotesForUser(user));
    });
  }, [db, user]);

  const refresh = () => {
    setQuotes(db.getQuotesForUser(user));
  };

  const handleStatusChange = (quoteId: string, status: QuoteStatus) => {
    const q = db.getQuoteByIdAuthorized(quoteId, user);
    if (q) {
      db.saveQuote({ ...q, status }, user);
      refresh();
    }
  };

  const handleDelete = (quoteId: string) => {
    const q = db.getQuoteByIdAuthorized(quoteId, user);
    if (q?.isLocked && isB2BAgent) {
      alert('Locked quotations cannot be deleted.');
      return;
    }
    if (confirm('Are you sure you want to delete this quotation record?')) {
      db.deleteQuote(quoteId, user);
      refresh();
      if (viewingQuote?.id === quoteId) setViewingQuote(null);
    }
  };

  const handleCreateNewVersion = (quoteId: string) => {
    const newQuote = db.createQuotationVersion(quoteId, user);
    if (newQuote) {
      setActionSuccessMsg(`Created new draft version v${newQuote.version || 2} of quotation!`);
      refresh();
      setTimeout(() => setActionSuccessMsg(''), 4000);
      if (onLoadQuote) {
        onLoadQuote(newQuote);
      }
    }
  };

  const handleSaveLeadId = (quoteId: string) => {
    if (leadIdInput.trim()) {
      db.updateQuotationLeadId(quoteId, leadIdInput.trim(), user);
      setEditingLeadIdQuoteId(null);
      setLeadIdInput('');
      refresh();
    }
  };

  const handleDownloadPDF = (q: Quotation) => {
    downloadQuotationPDF({
      quote: q,
      agentName: q.agentName || user?.name,
      agentAgency: q.agentAgency || user?.agencyName || user?.companyName,
      agentLogoUrl: q.agentLogoUrl || user?.brandLogoUrl || user?.logoUrl,
      leadId: q.leadId
    });
  };

  const filtered = quotes.filter(q => {
    const matchesSearch = q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.destination && q.destination.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.leadId && q.leadId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.agentName && q.agentName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === 'ALL' || q.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Operational B2B Quotes Ledger</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {isB2BAgent ? 'My Quotations & Lead Management' : 'Quotation Management & Access Control'} ({quotes.length} Quotes)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isB2BAgent 
              ? 'Manage your quotes, assign Lead IDs for ground ops, branch new versions, and export branded PDFs.' 
              : 'Admin oversight of all system quotes, client budgets, wholesale margins, and PDF issuance logs.'}
          </p>
        </div>

        {/* Security Isolation Banner */}
        <div className="bg-slate-900 text-slate-200 px-4 py-2.5 rounded-xl text-xs border border-slate-800 flex items-center space-x-2 shrink-0">
          <Lock className="w-4 h-4 text-[#00E5C0]" />
          <div>
            <span className="text-[10px] text-slate-400 block font-mono">BACKEND AUTHORIZATION ACTIVE</span>
            <span className="font-bold text-[#00E5C0]">Role-Based Quote Isolation</span>
          </div>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Search & Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by quote #, lead ID, client name, agent, destination..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00C6A6]"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="ACCEPTED">Accepted / Confirmed</option>
            <option value="EXPIRED">Expired</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Quote # & Version</th>
                <th className="py-3 px-4">Lead ID</th>
                <th className="py-3 px-4">Client & Contact</th>
                <th className="py-3 px-4">Gross Selling</th>
                <th className="py-3 px-4">Net Cost / Margin</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(q => (
                <tr key={q.id} className={`hover:bg-slate-50/80 transition-colors ${q.isLocked ? 'bg-slate-50/40' : ''}`}>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                        {q.quoteNumber}
                      </span>
                      {q.version && (
                        <span className="text-[9px] font-bold bg-[#00C6A6]/20 text-[#008972] px-1.5 py-0.5 rounded">
                          v{q.version}
                        </span>
                      )}
                      {q.isLocked && (
                        <span className="inline-flex items-center space-x-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded" title="Locked parent quote">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 text-xs mt-0.5">{q.title}</div>
                    <div className="text-[10px] text-slate-400">
                      {q.destination}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {editingLeadIdQuoteId === q.id ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={leadIdInput}
                          onChange={e => setLeadIdInput(e.target.value)}
                          placeholder="e.g. LED-10492"
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono w-28 focus:outline-none focus:border-[#00C6A6]"
                        />
                        <button
                          onClick={() => handleSaveLeadId(q.id)}
                          className="p-1 bg-[#00C6A6] text-slate-950 rounded hover:bg-[#00b296] cursor-pointer"
                          title="Save Lead ID"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingLeadIdQuoteId(null)}
                          className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        {q.leadId ? (
                          <span className="font-mono text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                            {q.leadId}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No Lead ID</span>
                        )}
                        <button
                          onClick={() => {
                            setEditingLeadIdQuoteId(q.id);
                            setLeadIdInput(q.leadId || '');
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                          title="Assign or Edit Lead ID"
                        >
                          <Tag className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800 text-xs">{q.clientName}</div>
                    <div className="text-[10px] text-slate-400">{q.clientEmail || 'No email provided'}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold font-mono text-[#008972] text-xs">
                      {formatCurrency(q.totalSellingPrice || 0, q.currency)}
                    </div>
                    <div className="text-[10px] text-slate-400">Gross Payable</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-mono text-slate-700 text-xs">
                      Net: {formatCurrency(q.totalNetCost || 0, q.currency)}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold">
                      Margin: +{formatCurrency(q.totalMargin || 0, q.currency)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={q.status}
                      disabled={q.isLocked && isB2BAgent}
                      onChange={e => handleStatusChange(q.id, e.target.value as QuoteStatus)}
                      className={`text-[10px] font-bold py-1 px-2 rounded-lg border cursor-pointer ${
                        q.status === 'ACCEPTED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : q.status === 'ISSUED'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : q.status === 'EXPIRED'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="ISSUED">ISSUED</option>
                      <option value="ACCEPTED">ACCEPTED</option>
                      <option value="EXPIRED">EXPIRED</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => handleDownloadPDF(q)}
                        className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                        title="Download Branded PDF with Logo & Lead ID"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleCreateNewVersion(q.id)}
                        className="p-1.5 text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                        title="New Version (Copy & Edit New Draft)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setViewingQuote(q)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="View Financial Breakdown"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {onLoadQuote && !q.isLocked && (
                        <button
                          onClick={() => onLoadQuote(q)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="Open in Quotation Builder"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(!q.isLocked || !isB2BAgent) && (
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          title="Delete Quote"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No quotation records found matching search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote Details View Modal */}
      {viewingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                  {viewingQuote.quoteNumber}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{viewingQuote.title}</h3>
                <p className="text-xs text-slate-500">
                  Client: <strong>{viewingQuote.clientName}</strong> ({viewingQuote.clientEmail || 'N/A'})
                </p>
              </div>
              <button
                onClick={() => setViewingQuote(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Financial Summary Card */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Gross Selling Amount:</span>
                <span className="text-lg font-bold font-mono text-[#00E5C0]">
                  {formatCurrency(viewingQuote.totalSellingPrice || 0, viewingQuote.currency)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Total Net Cost</span>
                  <span className="font-mono font-bold text-white">
                    {formatCurrency(viewingQuote.totalNetCost || 0, viewingQuote.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Gross Margin</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{formatCurrency(viewingQuote.totalMargin || 0, viewingQuote.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Applied Taxes</span>
                  <span className="font-mono font-bold text-white">
                    {formatCurrency(viewingQuote.totalTaxes || 0, viewingQuote.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Items Count</span>
                  <span className="font-mono font-bold text-white">
                    {viewingQuote.items.length} Activities
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-800">Itinerary Line Items ({viewingQuote.items.length})</h4>
              <div className="space-y-1.5">
                {viewingQuote.items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{item.product?.name || `Item ${idx + 1}`}</div>
                      <div className="text-[10px] text-slate-400">
                        Date: {item.travelDate || 'Day ' + (idx + 1)} • {item.product?.duration || 'Flexible'}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-slate-900">
                        {formatCurrency(item.calculation?.totalSellingPrice || 0, viewingQuote.currency)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Net: {formatCurrency(item.calculation?.totalNetCost || 0, viewingQuote.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setViewingQuote(null)}
                className="px-5 py-2 bg-slate-900 text-white font-semibold rounded-xl text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
