import React, { useState } from 'react';
import { TravelLead, Quotation, QuoteVersionRecord, User } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { AppDatabase } from '../../../services/db';
import { downloadQuotationPDF } from '../../../services/pdfGenerator';
import { 
  DollarSign, 
  History, 
  FileText, 
  Briefcase, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Copy,
  ExternalLink,
  Layers,
  Tag,
  Download,
  Eye,
  RotateCcw,
  GitCompare,
  X,
  AlertCircle,
  Calendar,
  Users,
  MapPin,
  Sparkles
} from 'lucide-react';

export interface LeadQuotesTabProps {
  lead: TravelLead;
  linkedQuotes: Quotation[];
  linkedQuoteVersions: QuoteVersionRecord[];
  currentUser: User | null;
  onOpenQuote?: (quoteId: string, options?: { version?: number; mode?: 'inspect' | 'edit' | 'readonly'; leadId?: string }) => void;
  onConvertToBooking: (quote: Quotation) => void;
  onNavigateToBookingsTab?: () => void;
  isConverting?: boolean;
}

export const LeadQuotesTab: React.FC<LeadQuotesTabProps> = ({
  lead,
  linkedQuotes,
  linkedQuoteVersions,
  currentUser,
  onOpenQuote,
  onConvertToBooking,
  onNavigateToBookingsTab,
  isConverting = false
}) => {
  const db = AppDatabase.getInstance();
  const activeSnapshot = lead.quoteSnapshot;

  // Modals & Preview States
  const [previewingQuote, setPreviewingQuote] = useState<Quotation | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedV1Version, setSelectedV1Version] = useState<number | null>(null);
  const [selectedV2Version, setSelectedV2Version] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setActionFeedback({ message, type });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Helper to find authoritative quote document for a version record
  const getQuoteForVersion = (v: QuoteVersionRecord): Quotation | null => {
    // 1. Check linkedQuotes
    let q = linkedQuotes.find(item => item.id === v.quoteId || (item.version === v.version && (item.leadId === lead.id || item.linkedLeadId === lead.id)));
    if (q) return q;

    // 2. Check DB
    q = db.getQuoteByIdAuthorized(v.quoteId, currentUser);
    if (q) return q;

    // 3. Reconstruct minimal quotation structure from version record
    const allQuotes = db.getAllSavedQuotes();
    const fallbackBase = allQuotes.find(item => item.leadId === lead.id || item.linkedLeadId === lead.id);
    if (fallbackBase) {
      return {
        ...fallbackBase,
        id: v.quoteId || fallbackBase.id,
        version: v.version,
        totalSellingPrice: v.totalSellingPrice ?? fallbackBase.totalSellingPrice,
        totalNetCost: v.totalNetCost ?? fallbackBase.totalNetCost,
        currency: v.currency || fallbackBase.currency,
        items: v.items && v.items.length > 0 ? v.items : fallbackBase.items
      };
    }
    return null;
  };

  const handleDownloadPDFForQuote = (q: Quotation) => {
    try {
      downloadQuotationPDF({
        quote: q,
        agentName: q.agentName || q.createdByName || currentUser?.name,
        agentAgency: q.agentAgency || q.agentCompany || currentUser?.agencyName || currentUser?.companyName,
        agentLogoUrl: q.agentLogoUrl || currentUser?.brandLogoUrl || currentUser?.logoUrl,
        leadId: lead.id
      });
      showFeedback(`Downloaded branded proposal PDF for #${q.quoteNumber} (v${q.version || 1})`);
    } catch (err: any) {
      showFeedback(`PDF generation error: ${err?.message || 'Failed to download'}`, 'error');
    }
  };

  const handleRestoreVersion = (v: QuoteVersionRecord) => {
    try {
      const restored = db.restoreQuotationVersion(v.quoteId, v.version, currentUser);
      if (restored) {
        showFeedback(`Successfully restored Version ${v.version} as new editable Version ${restored.version} (#${restored.quoteNumber})`);
        if (onOpenQuote) {
          onOpenQuote(restored.id, { version: restored.version, mode: 'edit', leadId: lead.id });
        }
      } else {
        showFeedback('Could not restore version: parent quotation record not found.', 'error');
      }
    } catch (err: any) {
      showFeedback(`Restore failed: ${err.message || 'Error occurred'}`, 'error');
    }
  };

  // Determine latest version number
  const maxVersionNumber = linkedQuoteVersions.length > 0
    ? Math.max(...linkedQuoteVersions.map(v => v.version || 1))
    : (linkedQuotes.length > 0 ? Math.max(...linkedQuotes.map(q => q.version || 1)) : 1);

  // Initialize version comparison default targets
  const handleOpenCompare = () => {
    if (linkedQuoteVersions.length >= 2) {
      setSelectedV1Version(linkedQuoteVersions[linkedQuoteVersions.length - 1].version);
      setSelectedV2Version(linkedQuoteVersions[0].version);
    } else if (linkedQuotes.length >= 2) {
      setSelectedV1Version(linkedQuotes[linkedQuotes.length - 1].version || 1);
      setSelectedV2Version(linkedQuotes[0].version || 2);
    }
    setIsCompareModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border shadow-sm animate-fadeIn ${
          actionFeedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
            : 'bg-rose-50 text-rose-800 border-rose-300'
        }`}>
          <span>{actionFeedback.message}</span>
          <button onClick={() => setActionFeedback(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Active Proposal Snapshot */}
      {activeSnapshot ? (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#008f77] flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Active Proposal Snapshot
              </span>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">
                Quotation #{activeSnapshot.quoteNumber} (v{activeSnapshot.version || 1})
              </h3>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border self-start sm:self-auto ${
              activeSnapshot.status === 'ACCEPTED' || activeSnapshot.status === 'BOOKING_SUBMITTED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : activeSnapshot.status === 'ISSUED'
                ? 'bg-blue-50 text-blue-800 border-blue-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {activeSnapshot.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[11px]">Net Supplier Cost</span>
              <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                {activeSnapshot.currency || 'USD'} {(activeSnapshot.totalNetCost || 0).toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[11px]">Target Margin</span>
              <span className="font-mono font-bold text-[#008f77] text-sm mt-0.5 block">
                {activeSnapshot.marginPercent || 15}% ({activeSnapshot.currency || 'USD'} {(activeSnapshot.marginAmount || 0).toLocaleString()})
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[11px]">Gross Selling Price</span>
              <span className="font-mono font-black text-slate-900 text-base mt-0.5 block">
                {activeSnapshot.currency || 'USD'} {(activeSnapshot.finalSellingPrice || activeSnapshot.totalSellingPrice || 0).toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[11px]">Commercial State</span>
              <span className="font-bold text-slate-800 mt-0.5 block truncate">
                {lead.bookingReference ? `Linked to #${lead.bookingReference}` : 'Ready for Conversion'}
              </span>
            </div>
          </div>

          {(activeSnapshot.quoteId || lead.quoteId) && onOpenQuote && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Authoritative record loaded with exact original itinerary items and contracted pricing.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const qId = activeSnapshot.quoteId || lead.quoteId!;
                    const q = linkedQuotes.find(item => item.id === qId) || db.getQuoteByIdAuthorized(qId, currentUser);
                    if (q) setPreviewingQuote(q);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Proposal</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetQId = activeSnapshot.quoteId || lead.quoteId!;
                    onOpenQuote(targetQId, {
                      version: activeSnapshot.version,
                      leadId: lead.id,
                      mode: 'inspect'
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-[#00E5C0]" />
                  <span>Open in Quote Builder</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* 2. Connected Quotations List */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#00C6A6]" />
              <span>Commercial Quotations ({linkedQuotes.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Proposals created for this lead with active pricing, itemization, and version states.
            </p>
          </div>

          {linkedQuoteVersions.length >= 2 || linkedQuotes.length >= 2 ? (
            <button
              type="button"
              onClick={handleOpenCompare}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Versions</span>
            </button>
          ) : null}
        </div>

        {linkedQuotes.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
            <DollarSign className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No Quotations Generated Yet</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              Use the Quotation Builder to create an itemized luxury itinerary proposal for this lead.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {linkedQuotes.map(quote => {
              const isAlreadyConverted = quote.status === 'BOOKING_SUBMITTED' || 
                Boolean(lead.bookingId) || 
                Boolean(lead.bookingReference);

              return (
                <div 
                  key={quote.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        #{quote.quoteNumber}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-semibold text-slate-700">
                        v{quote.version || 1}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-500">
                        {quote.destination || lead.destinationName}
                      </span>
                      {quote.isLocked && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                          Locked Snapshot
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        quote.status === 'BOOKING_SUBMITTED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : quote.status === 'ACCEPTED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : quote.status === 'ISSUED'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        {quote.status}
                      </span>
                      <span className="font-mono font-black text-sm text-slate-900">
                        {formatCurrency(quote.totalSellingPrice || 0, quote.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Traveler</span>
                      <span className="font-bold text-slate-800">{quote.clientName || lead.clientName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Pax Count</span>
                      <span className="font-bold text-slate-800">{quote.totalPax || lead.totalPassengers || 2} Pax</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Travel Dates</span>
                      <span className="font-bold text-slate-800">{quote.travelStartDate || lead.travelDates || 'Flexible'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Net Cost</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatCurrency(quote.totalNetCost || 0, quote.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Created: {new Date(quote.createdAt).toLocaleDateString()}</span>
                      {quote.createdByName && (
                        <span>by <strong>{quote.createdByName}</strong></span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewingQuote(quote)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Preview Proposal Document"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadPDFForQuote(quote)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Download Proposal PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-600" />
                        <span>PDF</span>
                      </button>

                      {onOpenQuote && (
                        <button
                          type="button"
                          onClick={() => onOpenQuote(quote.id, {
                            version: quote.version,
                            mode: quote.isLocked ? 'inspect' : 'edit',
                            leadId: lead.id
                          })}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Quote Builder</span>
                        </button>
                      )}

                      {isAlreadyConverted ? (
                        <button
                          type="button"
                          onClick={onNavigateToBookingsTab}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>View Operational Booking</span>
                          <ArrowRight className="w-3 h-3 text-emerald-600" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onConvertToBooking(quote)}
                          disabled={isConverting}
                          className="px-3.5 py-1.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>Convert to Booking</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Proposal Version History */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-[#00C6A6]" />
            <span>Proposal Version History ({linkedQuoteVersions.length})</span>
          </h3>
          {linkedQuoteVersions.length > 1 && (
            <span className="text-[11px] font-semibold text-slate-500">
              Each version preserves its exact contracted rates and item selections
            </span>
          )}
        </div>

        {linkedQuoteVersions.length === 0 ? (
          <div className="text-slate-400 text-xs py-4 text-center">
            Single proposal record active (#{lead.quoteNumber || 'Initial Draft'}).
          </div>
        ) : (
          <div className="space-y-3">
            {linkedQuoteVersions.map(v => {
              const isLatest = v.version === maxVersionNumber;
              const isSuperseded = !isLatest;
              const associatedQuote = getQuoteForVersion(v);

              return (
                <div 
                  key={v.id || `${v.quoteId}-v${v.version}`} 
                  className={`p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
                    isLatest 
                      ? 'border-teal-200 bg-teal-50/30 shadow-2xs' 
                      : 'border-slate-200 bg-slate-50/70 opacity-90 hover:opacity-100'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        Version {v.version}
                      </span>
                      {isLatest ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00C6A6]/20 text-[#00705d] border border-[#00C6A6]/40">
                          Current Active Version
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                          Superseded / Archived
                        </span>
                      )}
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-slate-500">
                        {v.updatedAt ? new Date(v.updatedAt).toLocaleString() : new Date(v.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900">
                        {formatCurrency(v.totalSellingPrice || 0, v.currency || 'USD')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        v.status === 'ACCEPTED' || v.status === 'BOOKED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {v.status || 'DRAFT'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span>Created by: <strong>{v.createdByName || v.createdBy || 'Travel Consultant'}</strong></span>
                      {v.updatedBy && v.updatedBy !== v.createdByName && (
                        <span className="ml-2">| Updated by: <strong>{v.updatedBy}</strong></span>
                      )}
                    </div>
                    <div>
                      <span>Items: <strong>{v.items?.length || v.totalItems || 0} scheduled services</strong></span>
                      {v.totalNetCost !== undefined && (
                        <span className="ml-2">| Net: <strong>{formatCurrency(v.totalNetCost, v.currency || 'USD')}</strong></span>
                      )}
                    </div>
                  </div>

                  {v.changesSummary && (
                    <div className="text-slate-600 bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                      {v.changesSummary}
                    </div>
                  )}

                  {/* Operational Action Buttons for this specific Version */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                    <span className="text-[11px] text-slate-400">
                      Target quote identifier: <strong className="font-mono text-slate-600">{v.quoteId}</strong>
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* 1. Preview */}
                      <button
                        type="button"
                        onClick={() => {
                          if (associatedQuote) {
                            setPreviewingQuote(associatedQuote);
                          } else {
                            showFeedback('Quote details unavailable for preview.', 'error');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Preview Version"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>Preview</span>
                      </button>

                      {/* 2. Download PDF */}
                      <button
                        type="button"
                        onClick={() => {
                          if (associatedQuote) {
                            handleDownloadPDFForQuote(associatedQuote);
                          } else {
                            showFeedback('Cannot generate PDF: quotation record unavailable.', 'error');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Download PDF"
                      >
                        <Download className="w-3 h-3 text-slate-500" />
                        <span>PDF</span>
                      </button>

                      {/* 3. Restore Version */}
                      {isSuperseded && (
                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(v)}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="Restore and branch this version as the new active draft"
                        >
                          <RotateCcw className="w-3 h-3 text-purple-600" />
                          <span>Restore</span>
                        </button>
                      )}

                      {/* 4. Convert to Booking */}
                      {!lead.bookingReference && associatedQuote && (
                        <button
                          type="button"
                          onClick={() => onConvertToBooking(associatedQuote)}
                          className="px-2.5 py-1 rounded-lg bg-[#008f77]/10 hover:bg-[#008f77]/20 text-[#008f77] border border-[#008f77]/30 font-bold transition-colors cursor-pointer flex items-center gap-1"
                          title="Convert this specific version to booking"
                        >
                          <Briefcase className="w-3 h-3 text-[#008f77]" />
                          <span>Book v{v.version}</span>
                        </button>
                      )}

                      {/* 5. Open in Builder (Target Version Guaranteed) */}
                      {onOpenQuote && (
                        <button
                          type="button"
                          onClick={() => onOpenQuote(v.quoteId, {
                            version: v.version,
                            mode: 'inspect',
                            leadId: lead.id
                          })}
                          className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          title={`Open Version ${v.version} in Builder for verification`}
                        >
                          <FileText className="w-3 h-3 text-[#00E5C0]" />
                          <span>Open v{v.version} in Builder</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: PROPOSAL DOCUMENT PREVIEW */}
      {/* ========================================================================= */}
      {previewingQuote && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00E5C0]/20 text-[#00E5C0] border border-[#00E5C0]/30">
                    Proposal Preview (v{previewingQuote.version || 1})
                  </span>
                  <span className="font-mono text-xs text-slate-300">
                    #{previewingQuote.quoteNumber}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  {previewingQuote.title || `${previewingQuote.destination || lead.destinationName} Travel Proposal`}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPDFForQuote(previewingQuote)}
                  className="px-3 py-1.5 bg-[#00C6A6] hover:bg-[#00B598] text-slate-950 text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                {onOpenQuote && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenQuote(previewingQuote.id, {
                        version: previewingQuote.version,
                        mode: 'inspect',
                        leadId: lead.id
                      });
                      setPreviewingQuote(null);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open in Builder</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewingQuote(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-xs">
              {/* Client & Itinerary Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Client Name</span>
                  <strong className="text-sm text-slate-900">{previewingQuote.clientName || lead.clientName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Travel Dates</span>
                  <strong className="text-slate-900">{previewingQuote.travelStartDate || 'Flexible'} → {previewingQuote.travelEndDate || 'Flexible'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Passengers</span>
                  <strong className="text-slate-900">{previewingQuote.totalPax || 2} Guests ({previewingQuote.adultsCount || 2} Adults{previewingQuote.childrenCount ? `, ${previewingQuote.childrenCount} Children` : ''})</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Total Package Value</span>
                  <strong className="text-base font-mono font-black text-emerald-700">
                    {formatCurrency(previewingQuote.totalSellingPrice || 0, previewingQuote.currency)}
                  </strong>
                </div>
              </div>

              {/* Service Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Included Service Items ({previewingQuote.items?.length || 0})
                </h4>
                {(!previewingQuote.items || previewingQuote.items.length === 0) ? (
                  <p className="text-slate-400 italic">No individual service items recorded.</p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    {previewingQuote.items.map((item, idx) => (
                      <div key={item.id || idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                              {item.category || item.productType || 'Service'}
                            </span>
                            <strong className="text-slate-900">{item.name}</strong>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {item.cityHub && `📍 ${item.cityHub} • `}
                            {item.travelDate && `Date: ${item.travelDate} • `}
                            {item.nights ? `${item.nights} Nights • ` : ''}
                            Pax: {typeof item.pax === 'object' && item.pax !== null
                              ? `${item.pax.adults ?? 2} Adults${item.pax.children ? `, ${item.pax.children} Ch` : ''}${item.pax.infants ? `, ${item.pax.infants} Inf` : ''}`
                              : (item.pax || 2)}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          {formatCurrency(item.totalPrice || item.sellingPrice || 0, previewingQuote.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SIDE-BY-SIDE PROPOSAL VERSION COMPARISON */}
      {/* ========================================================================= */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
                  <GitCompare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Proposal Version Comparison</h3>
                  <p className="text-xs text-slate-400">Inspect pricing, itinerary additions, and margin differences between iterations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* Version Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Base Version (A)
                  </label>
                  <select
                    value={selectedV1Version || ''}
                    onChange={(e) => setSelectedV1Version(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                  >
                    {linkedQuoteVersions.map(v => (
                      <option key={v.version} value={v.version}>
                        Version {v.version} ({formatCurrency(v.totalSellingPrice || 0, v.currency || 'USD')}) - {new Date(v.createdAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Comparison Version (B)
                  </label>
                  <select
                    value={selectedV2Version || ''}
                    onChange={(e) => setSelectedV2Version(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                  >
                    {linkedQuoteVersions.map(v => (
                      <option key={v.version} value={v.version}>
                        Version {v.version} ({formatCurrency(v.totalSellingPrice || 0, v.currency || 'USD')}) - {new Date(v.createdAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Side-by-Side Breakdown Table */}
              {(() => {
                const recA = linkedQuoteVersions.find(v => v.version === selectedV1Version) || linkedQuoteVersions[linkedQuoteVersions.length - 1];
                const recB = linkedQuoteVersions.find(v => v.version === selectedV2Version) || linkedQuoteVersions[0];

                if (!recA || !recB) {
                  return <p className="text-center text-slate-400 py-6">Select two versions to compare.</p>;
                }

                const priceDiff = (recB.totalSellingPrice || 0) - (recA.totalSellingPrice || 0);

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Column A */}
                      <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="font-black text-sm text-slate-900">Version {recA.version}</span>
                          <span className="font-mono font-black text-base text-slate-900">
                            {formatCurrency(recA.totalSellingPrice || 0, recA.currency || 'USD')}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-[11px]">
                          <div>Created by: <strong>{recA.createdByName || recA.createdBy || 'Staff'}</strong></div>
                          <div>Date: <strong>{new Date(recA.createdAt).toLocaleString()}</strong></div>
                          <div>Items: <strong>{recA.items?.length || recA.totalItems || 0} services</strong></div>
                          {recA.totalNetCost !== undefined && (
                            <div>Net Cost: <strong>{formatCurrency(recA.totalNetCost, recA.currency || 'USD')}</strong></div>
                          )}
                        </div>
                        {onOpenQuote && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenQuote(recA.quoteId, {
                                version: recA.version,
                                mode: 'inspect',
                                leadId: lead.id
                              });
                              setIsCompareModalOpen(false);
                            }}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
                          >
                            Open Version {recA.version} in Builder
                          </button>
                        )}
                      </div>

                      {/* Column B */}
                      <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/20 space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="font-black text-sm text-slate-900">Version {recB.version}</span>
                          <span className="font-mono font-black text-base text-slate-900">
                            {formatCurrency(recB.totalSellingPrice || 0, recB.currency || 'USD')}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-[11px]">
                          <div>Created by: <strong>{recB.createdByName || recB.createdBy || 'Staff'}</strong></div>
                          <div>Date: <strong>{new Date(recB.createdAt).toLocaleString()}</strong></div>
                          <div>Items: <strong>{recB.items?.length || recB.totalItems || 0} services</strong></div>
                          {recB.totalNetCost !== undefined && (
                            <div>Net Cost: <strong>{formatCurrency(recB.totalNetCost, recB.currency || 'USD')}</strong></div>
                          )}
                        </div>
                        {onOpenQuote && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenQuote(recB.quoteId, {
                                version: recB.version,
                                mode: 'inspect',
                                leadId: lead.id
                              });
                              setIsCompareModalOpen(false);
                            }}
                            className="w-full py-2 bg-[#008f77] hover:bg-[#00705d] text-white rounded-xl font-bold transition-colors cursor-pointer"
                          >
                            Open Version {recB.version} in Builder
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Price Variance Summary */}
                    <div className="p-3 bg-slate-100 rounded-xl text-center text-xs">
                      Difference from v{recA.version} to v{recB.version}: {' '}
                      <strong className={priceDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {priceDiff >= 0 ? `+${formatCurrency(priceDiff, recB.currency || 'USD')}` : formatCurrency(priceDiff, recB.currency || 'USD')}
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
