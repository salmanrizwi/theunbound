import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Copy, 
  PlusCircle, 
  Eye, 
  Printer, 
  Download, 
  BookmarkCheck, 
  Trash2, 
  MapPin, 
  Clock, 
  Calendar, 
  Users, 
  ChevronRight, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Share2,
  History
} from 'lucide-react';
import { Quotation, QuoteStatus, CurrencyCode } from '../../types';
import { AppDatabase } from '../../services/db';
import { canUserViewInternalCostBreakdown } from '../../services/permissionEngine';
import { useAuth } from '../../context/AuthContext';
import { useDisplayCurrency } from '../../context/DisplayCurrencyContext';
import { inventoryVisibilityService } from '../../services/inventoryVisibilityService';
import { analyzeQuotationDestinationEligibility } from '../../services/destinationVisibility';

const ProposalDocumentView = React.lazy(() =>
  import('../ProposalDocumentView').then(m => ({ default: m.ProposalDocumentView }))
);
const QuotationVersionHistoryModal = React.lazy(() =>
  import('../Quotations/QuotationVersionHistoryModal').then(m => ({ default: m.QuotationVersionHistoryModal }))
);

interface B2BQuotesManagerViewProps {
  onOpenCreateQuote: () => void;
  onEditQuote: (quote: Quotation) => void;
  onOpenQuoteVersion?: (quoteId: string, options?: { version?: number; mode?: 'inspect' | 'edit' | 'readonly' | 'restore'; leadId?: string }) => void;
  onRestoreQuoteVersion?: (quoteId: string, version: number) => void;
  onConvertToBooking: (quote: Quotation) => void;
}

export const B2BQuotesManagerView: React.FC<B2BQuotesManagerViewProps> = ({
  onOpenCreateQuote,
  onEditQuote,
  onOpenQuoteVersion,
  onRestoreQuoteVersion,
  onConvertToBooking
}) => {
  const { user } = useAuth();
  const { convertForDisplay } = useDisplayCurrency();
  const db = AppDatabase.getInstance();
  const canViewInternalCosts = useMemo(() => canUserViewInternalCostBreakdown(user), [user]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  React.useEffect(() => {
    return db.subscribeToCollections(['saved_quotes', 'bookings', 'leads'], () => {
      setRefreshTrigger(prev => prev + 1);
    });
  }, [db]);

  const quotes = useMemo(() => {
    return db.getAllSavedQuotesForUser(user);
  }, [db, user, refreshTrigger]);

  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [previewingQuote, setPreviewingQuote] = useState<Quotation | null>(null);
  const [versionHistoryQuote, setVersionHistoryQuote] = useState<Quotation | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filteredQuotes = useMemo(() => {
    const qTerm = (debouncedSearchQuery || '').toLowerCase().trim();
    return quotes.filter(q => {
      const matchesSearch = !qTerm ||
        (q.quoteNumber || '').toLowerCase().includes(qTerm) ||
        (q.clientName && (q.clientName || '').toLowerCase().includes(qTerm)) ||
        (q.destination && (q.destination || '').toLowerCase().includes(qTerm)) ||
        (q.clientCompany && (q.clientCompany || '').toLowerCase().includes(qTerm));

      let matchesStatus = true;
      if (selectedStatusTab === 'DRAFT') {
        matchesStatus = q.status === 'DRAFT' || q.status === 'IN_PROGRESS';
      } else if (selectedStatusTab === 'SENT') {
        matchesStatus = q.status === 'SENT' || q.status === 'SENT_TO_CLIENT' || q.status === 'VIEWED';
      } else if (selectedStatusTab === 'APPROVED') {
        matchesStatus = q.status === 'APPROVED' || q.status === 'ACCEPTED';
      } else if (selectedStatusTab === 'CONVERTED') {
        matchesStatus = q.status === 'CONVERTED' || q.status === 'CONFIRMED' || q.status === 'BOOKING_SUBMITTED';
      }

      return matchesSearch && matchesStatus;
    });
  }, [quotes, debouncedSearchQuery, selectedStatusTab]);

  const [currentPage, setCurrentPage] = useState(1);
  const QUOTES_PAGE_SIZE = 20;
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatusTab, debouncedSearchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / QUOTES_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuotes = useMemo(() => {
    const start = (safePage - 1) * QUOTES_PAGE_SIZE;
    return filteredQuotes.slice(start, start + QUOTES_PAGE_SIZE);
  }, [filteredQuotes, safePage]);

  const handleDuplicate = (quote: Quotation) => {
    const duplicated = db.duplicateQuotation(quote.id, user);
    if (duplicated) {
      setActionSuccessMessage(`Successfully duplicated quote as ${duplicated.quoteNumber}!`);
      setRefreshTrigger(prev => prev + 1);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    }
  };

  const handleStatusChange = (quoteId: string, newStatus: QuoteStatus) => {
    db.updateQuotationStatus(quoteId, newStatus, user);
    setActionSuccessMessage(`Updated quotation status to ${newStatus}`);
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => setActionSuccessMessage(null), 3000);
  };

  const handleDelete = (quoteId: string) => {
    if (window.confirm('Are you sure you want to delete this quotation record?')) {
      db.deleteQuote(quoteId, user);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const statusTabs = useMemo(() => {
    let draft = 0;
    let sent = 0;
    let approved = 0;
    let converted = 0;
    for (const q of quotes) {
      if (q.status === 'DRAFT' || q.status === 'IN_PROGRESS') draft++;
      else if (q.status === 'SENT' || q.status === 'SENT_TO_CLIENT' || q.status === 'VIEWED') sent++;
      else if (q.status === 'APPROVED' || q.status === 'ACCEPTED') approved++;
      else if (q.status === 'CONVERTED' || q.status === 'CONFIRMED' || q.status === 'BOOKING_SUBMITTED') converted++;
    }
    return [
      { id: 'ALL', label: 'All Quotes', count: quotes.length },
      { id: 'DRAFT', label: 'Drafts', count: draft },
      { id: 'SENT', label: 'Sent to Client', count: sent },
      { id: 'APPROVED', label: 'Client Approved', count: approved },
      { id: 'CONVERTED', label: 'Bookings Converted', count: converted }
    ];
  }, [quotes]);

  const visibilityIndex = useMemo(
    () => inventoryVisibilityService.getVisibilityIndex(),
    [refreshTrigger]
  );

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
              Commercial Quotation Register
            </span>
            <span className="text-xs text-slate-400">({quotes.length} Total Records)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">My Quotations & Client Proposals</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Manage your proposals pipeline, track version histories, duplicate quotes for repeat clients, and convert to guaranteed reservations.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shrink-0 cursor-pointer"
        >
          <span>Create New Quote</span>
        </button>
      </div>

      {/* Success Notification */}
      {actionSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {statusTabs.map(tab => {
          const isActive = selectedStatusTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                isActive ? 'bg-[#00C6A6] text-slate-950 font-extrabold' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search quotations by quote reference (e.g. TUB-QT-2026), client name, or destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
          />
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredQuotes.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No quotation records found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No quotations match your current search or filter criteria. Create your first quote in minutes.
            </p>
            <button
              onClick={onOpenCreateQuote}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              <span>Launch Quotation Builder</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3 px-4">Quote Ref / Date</th>
                  <th className="py-3 px-4">Client Name & Org</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Final Selling Price</th>
                  {canViewInternalCosts && (
                    <th className="py-3 px-4">Margin</th>
                  )}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedQuotes.map(quote => {
                  const versionCount = Math.max(
                    quote.versionCount || 0,
                    quote.latestVersion || quote.version || 1
                  );
                  const activeVersion = quote.latestVersion || quote.version || 1;
                  const isDraftQuote = quote.status === 'DRAFT' || quote.status === 'IN_PROGRESS';
                  const draftReview = isDraftQuote
                    ? analyzeQuotationDestinationEligibility(quote, visibilityIndex)
                    : null;
                  return (
                  <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-900">{quote.quoteNumber}</span>
                        <span className="text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded">
                          v{activeVersion}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'Active'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{quote.clientName || 'Private Client'}</div>
                      <div className="text-[10px] text-slate-400">{quote.clientCompany || quote.clientEmail || 'Direct Traveler'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center space-x-1 font-medium text-slate-700">
                        <MapPin className="w-3 h-3 text-[#00C6A6]" />
                        <span>{quote.destination || 'Japan'}</span>
                      </span>
                      {draftReview?.requiresReview && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold uppercase tracking-wide">
                            <AlertCircle className="w-2.5 h-2.5" />
                            <span>Dest. Inactive — Review Required</span>
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {quote.items?.length || 0} products
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {(() => {
                        const sourceCurr = (quote.currency || quote.pricingSnapshot?.currency || 'USD') as CurrencyCode;
                        const rawSell = Number(quote.pricingSnapshot?.finalCustomerSellingPrice ?? quote.finalCustomerSellingPrice ?? quote.totalSellingPrice ?? 0);
                        const sellConv = convertForDisplay(rawSell, sourceCurr);
                        return (
                          <div>
                            <div className={sellConv.status === 'UNAVAILABLE' ? 'text-amber-700' : ''}>{sellConv.formatted}</div>
                            {sellConv.isConverted && (
                              <div className="text-[10px] font-normal text-slate-400">Quote: {sellConv.nativeFormatted}</div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {canViewInternalCosts && (
                      <td className="py-3.5 px-4 font-mono text-emerald-600 font-semibold">
                        {(() => {
                          const sourceCurr = (quote.currency || quote.pricingSnapshot?.currency || 'USD') as CurrencyCode;
                          const rawMargin = Number(quote.totalMargin ?? quote.totalMarginAmount ?? 0);
                          const marginConv = convertForDisplay(rawMargin, sourceCurr);
                          return (
                            <div>
                              <div className={marginConv.status === 'UNAVAILABLE' ? 'text-amber-700' : ''}>
                                {marginConv.status === 'UNAVAILABLE' ? marginConv.formatted : `+${marginConv.formatted}`}
                              </div>
                              {marginConv.isConverted && (
                                <div className="text-[10px] font-normal text-slate-400">+{marginConv.nativeFormatted}</div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    )}

                    <td className="py-3.5 px-4">
                      <select
                        value={quote.status}
                        onChange={(e) => handleStatusChange(quote.id, e.target.value as QuoteStatus)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                          quote.status === 'APPROVED' || quote.status === 'CONFIRMED' || quote.status === 'CONVERTED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : quote.status === 'SENT' || quote.status === 'SENT_TO_CLIENT'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="SENT">SENT TO CLIENT</option>
                        <option value="VIEWED">VIEWED</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="CONVERTED">CONVERTED TO BOOKING</option>
                        <option value="EXPIRED">EXPIRED</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Version History */}
                        <button
                          onClick={() => setVersionHistoryQuote(quote)}
                          className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center space-x-1"
                          title="Inspect Version History, Compare & Restore"
                        >
                          <History className="w-3 h-3" />
                          <span>Versions ({versionCount})</span>
                        </button>

                        {/* Quick Edit */}
                        <button
                          onClick={() => onEditQuote(quote)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition-colors cursor-pointer"
                          title="Open in Builder"
                        >
                          Edit
                        </button>

                        {/* Quick Duplicate (Requirement #18) */}
                        <button
                          onClick={() => handleDuplicate(quote)}
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Duplicate Quote (Create Repeat Copy)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* Preview Document */}
                        <button
                          onClick={async () => {
                            let target = quote;
                            if (target.masterHydratedFromVersionId && (!target.items || target.items.length === 0)) {
                              target =
                                (await db.hydrateMasterQuotationFromVersionAsync(
                                  target.id,
                                  target.masterHydratedFromVersionId,
                                  user
                                )) || target;
                            }
                            setPreviewingQuote(target);
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                          title="View Proposal Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Convert to Booking */}
                        <button
                          onClick={() => onConvertToBooking(quote)}
                          className="p-1 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Convert to Booking"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(quote.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Quote"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/70 text-xs">
                <span className="text-slate-600 font-medium">
                  Showing {(safePage - 1) * QUOTES_PAGE_SIZE + 1}–{Math.min(safePage * QUOTES_PAGE_SIZE, filteredQuotes.length)} of {filteredQuotes.length} quotations
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-mono font-bold text-slate-700">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewingQuote && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-[#00C6A6] uppercase tracking-wider block">
                  Proposal Document Preview
                </span>
                <h3 className="text-lg font-bold text-slate-900">{previewingQuote.quoteNumber} - {previewingQuote.clientName}</h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  onClick={() => setPreviewingQuote(null)}
                  className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
            </div>

            <Suspense fallback={null}>
              <ProposalDocumentView
                quote={previewingQuote}
                agentUser={user}
                onClose={() => setPreviewingQuote(null)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Quotation Version History Modal */}
      {versionHistoryQuote && (
        <Suspense fallback={null}>
          <QuotationVersionHistoryModal
            isOpen={!!versionHistoryQuote}
            onClose={() => setVersionHistoryQuote(null)}
            quoteId={versionHistoryQuote.id}
            initialQuote={versionHistoryQuote}
            currentUser={user}
            onOpenVersion={(qId, ver, mode) => {
              setVersionHistoryQuote(null);
              if (onOpenQuoteVersion) {
                onOpenQuoteVersion(qId, { version: ver, mode });
              } else {
                const target = db.getQuoteByIdAuthorized(qId, user);
                if (target) onEditQuote(target);
              }
            }}
            onRestoreVersion={(qId, ver) => {
              setVersionHistoryQuote(null);
              if (onRestoreQuoteVersion) {
                onRestoreQuoteVersion(qId, ver);
              } else if (onOpenQuoteVersion) {
                onOpenQuoteVersion(qId, { version: ver, mode: 'restore' });
              } else {
                const target = db.getQuoteByIdAuthorized(qId, user);
                if (target) onEditQuote(target);
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
