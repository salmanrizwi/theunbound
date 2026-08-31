import React, { useState, useMemo } from 'react';
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
  Share2
} from 'lucide-react';
import { Quotation, QuoteStatus, CurrencyCode } from '../../types';
import { AppDatabase } from '../../services/db';
import { formatCurrency } from '../../services/pricingEngine';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { ProposalDocumentView } from '../ProposalDocumentView';

interface B2BQuotesManagerViewProps {
  onOpenCreateQuote: () => void;
  onEditQuote: (quote: Quotation) => void;
  onConvertToBooking: (quote: Quotation) => void;
}

export const B2BQuotesManagerView: React.FC<B2BQuotesManagerViewProps> = ({
  onOpenCreateQuote,
  onEditQuote,
  onConvertToBooking
}) => {
  const { user } = useAuth();
  const { currency } = useQuotation();
  const db = AppDatabase.getInstance();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const quotes = useMemo(() => {
    return db.getAllSavedQuotesForUser(user);
  }, [db, user, refreshTrigger]);

  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewingQuote, setPreviewingQuote] = useState<Quotation | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchesSearch = 
        q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.clientName && q.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (q.destination && q.destination.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (q.clientCompany && q.clientCompany.toLowerCase().includes(searchQuery.toLowerCase()));

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
  }, [quotes, searchQuery, selectedStatusTab]);

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

  const statusTabs = [
    { id: 'ALL', label: 'All Quotes', count: quotes.length },
    { id: 'DRAFT', label: 'Drafts', count: quotes.filter(q => q.status === 'DRAFT' || q.status === 'IN_PROGRESS').length },
    { id: 'SENT', label: 'Sent to Client', count: quotes.filter(q => q.status === 'SENT' || q.status === 'SENT_TO_CLIENT' || q.status === 'VIEWED').length },
    { id: 'APPROVED', label: 'Client Approved', count: quotes.filter(q => q.status === 'APPROVED' || q.status === 'ACCEPTED').length },
    { id: 'CONVERTED', label: 'Bookings Converted', count: quotes.filter(q => q.status === 'CONVERTED' || q.status === 'CONFIRMED' || q.status === 'BOOKING_SUBMITTED').length }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
          className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
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
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#00C6A6]" />
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
                  <th className="py-3 px-4">Selling Value</th>
                  <th className="py-3 px-4">Margin</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map(quote => (
                  <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">{quote.quoteNumber}</div>
                      <div className="text-[10px] text-slate-400">
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
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {quote.items?.length || 0} products
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatCurrency(quote.totalSellingPrice, quote.currency || currency)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-emerald-600 font-semibold">
                      +{formatCurrency(quote.totalMarginAmount || (quote.totalSellingPrice * 0.15), quote.currency || currency)}
                    </td>

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
                          onClick={() => setPreviewingQuote(quote)}
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
                ))}
              </tbody>
            </table>
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

            <ProposalDocumentView
              quote={previewingQuote}
              onClose={() => setPreviewingQuote(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
