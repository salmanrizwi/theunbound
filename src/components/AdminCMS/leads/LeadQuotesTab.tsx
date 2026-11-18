import React, { useMemo, useState } from 'react';
import {
  GroupedLeadQuotationVersions,
  TravelLead,
  Quotation,
  QuoteVersionRecord,
  User
} from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { AppDatabase } from '../../../services/db';
import { canUserViewInternalCostBreakdown } from '../../../services/permissionEngine';
import { downloadQuotationPDF } from '../../../services/pdfGenerator';
import { QuotationVersionHistoryModal } from '../../Quotations/QuotationVersionHistoryModal';
import {
  DollarSign,
  History,
  FileText,
  Briefcase,
  ArrowRight,
  CheckCircle2,
  Tag,
  Download,
  Eye,
  RotateCcw,
  GitCompare,
  X,
  Lock
} from 'lucide-react';

export interface LeadQuotesTabProps {
  lead: TravelLead;
  linkedQuotes: Quotation[];
  linkedQuoteVersions: QuoteVersionRecord[];
  groupedQuoteVersions?: GroupedLeadQuotationVersions[];
  currentUser: User | null;
  onOpenQuote?: (
    quoteId: string,
    options?: {
      version?: number;
      mode?: 'inspect' | 'edit' | 'readonly' | 'restore';
      leadId?: string;
    }
  ) => void;
  onConvertToBooking: (quote: Quotation) => void;
  onNavigateToBookingsTab?: () => void;
  isConverting?: boolean;
}

export const LeadQuotesTab: React.FC<LeadQuotesTabProps> = ({
  lead,
  linkedQuotes,
  groupedQuoteVersions,
  currentUser,
  onOpenQuote,
  onConvertToBooking,
  onNavigateToBookingsTab,
  isConverting = false
}) => {
  const db = AppDatabase.getInstance();
  const activeSnapshot = lead.quoteSnapshot;
  const canViewInternalCosts = useMemo(
    () => canUserViewInternalCostBreakdown(currentUser),
    [currentUser]
  );

  // Strict per-quotation isolated groups resolved canonically
  const isolatedGroups = useMemo<GroupedLeadQuotationVersions[]>(() => {
    if (groupedQuoteVersions && groupedQuoteVersions.length > 0) {
      return groupedQuoteVersions;
    }
    return db.getQuoteVersionsGroupedByQuoteForLead(lead.id, currentUser);
  }, [groupedQuoteVersions, db, lead.id, currentUser]);

  // Modals & Preview States
  const [previewingQuote, setPreviewingQuote] = useState<Quotation | null>(null);
  const [versionModalTarget, setVersionModalTarget] = useState<{
    quoteId: string;
    initialQuote?: Quotation | null;
    initialTab: 'HISTORY' | 'INSPECT' | 'COMPARE';
    initialVersion?: number;
  } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setActionFeedback({ message, type });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const getQuoteForVersion = (v: QuoteVersionRecord, groupQuote?: Quotation | null): Quotation | null => {
    const direct =
      groupQuote ||
      linkedQuotes.find(item => item.id === v.quoteId) ||
      db.getQuoteByIdAuthorized(v.quoteId, currentUser);

    if (direct && (direct.version || 1) === v.version && (!v.items || v.items.length === 0)) {
      return direct;
    }

    if (direct) {
      return {
        ...direct,
        id: v.quoteId || direct.id,
        version: v.version,
        totalSellingPrice: v.totalSellingPrice ?? direct.totalSellingPrice,
        finalCustomerSellingPrice:
          v.authoritativeSnapshot?.pricing?.finalCustomerSellingPrice ??
          v.totalSellingPrice ??
          direct.finalCustomerSellingPrice,
        ...(canViewInternalCosts
          ? {
              totalNetCost: v.totalNetCost ?? direct.totalNetCost,
              totalMargin: v.marginAmount ?? direct.totalMargin
            }
          : {
              totalNetCost: 0,
              totalMargin: 0
            }),
        currency: v.currency || direct.currency,
        items: v.items && v.items.length > 0 ? v.items : direct.items,
        routeHubs: v.routeHubs && v.routeHubs.length > 0 ? v.routeHubs : direct.routeHubs
      };
    }

    return null;
  };

  const getQuoteForVersionAsync = async (v: QuoteVersionRecord, groupQuote?: Quotation | null): Promise<Quotation | null> => {
    let resolvedVer = v;
    if (v.storageFormat === 'SPLIT_SECTIONS_V2' && !v.hasHydratedSections && v.quoteId) {
      const hydrated = await db.loadQuotationVersionFullAsync(v.quoteId, v.version, currentUser).catch(() => null);
      if (hydrated) resolvedVer = hydrated;
    }
    return getQuoteForVersion(resolvedVer, groupQuote);
  };

  const openPreviewForQuoteAsync = async (q: Quotation | null | undefined, versionRecord?: QuoteVersionRecord) => {
    if (!q) return;
    let targetQuote = q;
    if (versionRecord && versionRecord.storageFormat === 'SPLIT_SECTIONS_V2' && !versionRecord.hasHydratedSections) {
      const hydrated = await getQuoteForVersionAsync(versionRecord, q);
      if (hydrated) targetQuote = hydrated;
    } else if (targetQuote.masterHydratedFromVersionId && (!targetQuote.items || targetQuote.items.length === 0)) {
      targetQuote = (await db.hydrateMasterQuotationFromVersionAsync(targetQuote.id, targetQuote.masterHydratedFromVersionId, currentUser)) || targetQuote;
    }
    setPreviewingQuote(targetQuote);
  };

  const handleDownloadPDFForQuote = async (q: Quotation, versionRecord?: QuoteVersionRecord) => {
    try {
      let targetQuote = q;
      if (versionRecord && versionRecord.storageFormat === 'SPLIT_SECTIONS_V2' && !versionRecord.hasHydratedSections) {
        const hydratedQuote = await getQuoteForVersionAsync(versionRecord, q);
        if (hydratedQuote) targetQuote = hydratedQuote;
      } else if (targetQuote.masterHydratedFromVersionId && (!targetQuote.items || targetQuote.items.length === 0)) {
        targetQuote = (await db.hydrateMasterQuotationFromVersionAsync(targetQuote.id, targetQuote.masterHydratedFromVersionId, currentUser)) || targetQuote;
      }
      await downloadQuotationPDF({
        quote: targetQuote,
        agentName: targetQuote.agentName || targetQuote.createdByName || currentUser?.name,
        agentAgency: targetQuote.agentAgency || targetQuote.agentCompany || currentUser?.agencyName || currentUser?.companyName,
        agentLogoUrl: targetQuote.agentLogoUrl || currentUser?.brandLogoUrl || currentUser?.logoUrl,
        leadId: lead.id
      });
      showFeedback(`Downloaded branded proposal PDF for #${targetQuote.quoteNumber} (v${targetQuote.version || 1})`);
    } catch (err: any) {
      showFeedback(`PDF generation error: ${err?.message || 'Failed to download'}`, 'error');
    }
  };

  const handleRestoreVersion = (quoteId: string, version: number) => {
    if (onOpenQuote) {
      onOpenQuote(quoteId, {
        version,
        mode: 'restore',
        leadId: lead.id
      });
      showFeedback(
        `Loaded Version ${version} as an Unsaved Working Draft in Quote Builder. Click Save Draft when ready to save a new version.`
      );
      return;
    }
    setVersionModalTarget({
      quoteId,
      initialQuote: linkedQuotes.find(q => q.id === quoteId) || db.getQuoteByIdAuthorized(quoteId, currentUser),
      initialTab: 'INSPECT',
      initialVersion: version
    });
  };

  const totalVersionsAcrossQuotes = isolatedGroups.reduce((sum, g) => sum + g.versions.length, 0);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border shadow-sm ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
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

            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border self-start sm:self-auto ${
                activeSnapshot.status === 'ACCEPTED' || activeSnapshot.status === 'BOOKING_SUBMITTED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : activeSnapshot.status === 'ISSUED'
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              {activeSnapshot.status}
            </span>
          </div>

          <div className={`grid grid-cols-2 ${canViewInternalCosts ? 'sm:grid-cols-4' : 'sm:grid-cols-2'} gap-3 text-xs`}>
            {canViewInternalCosts && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block text-[11px]">Net Supplier Cost</span>
                <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                  {activeSnapshot.currency || 'USD'} {(activeSnapshot.totalNetCost || 0).toLocaleString()}
                </span>
              </div>
            )}

            {canViewInternalCosts && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block text-[11px]">Target Margin</span>
                <span className="font-mono font-bold text-[#008f77] text-sm mt-0.5 block">
                  {activeSnapshot.marginPercent || 15}% ({activeSnapshot.currency || 'USD'}{' '}
                  {(activeSnapshot.marginAmount || 0).toLocaleString()})
                </span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[11px]">Gross Selling Price</span>
              <span className="font-mono font-black text-slate-900 text-base mt-0.5 block">
                {activeSnapshot.currency || 'USD'}{' '}
                {(activeSnapshot.finalSellingPrice || activeSnapshot.totalSellingPrice || 0).toLocaleString()}
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
                    void openPreviewForQuoteAsync(q);
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

      {/* 2. Isolated Per-Quotation Cards & Their Own Version Timelines */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#00C6A6]" />
              <span>
                Quotations &amp; Version History ({isolatedGroups.length}{' '}
                {isolatedGroups.length === 1 ? 'Quote' : 'Quotes'} • {totalVersionsAcrossQuotes}{' '}
                {totalVersionsAcrossQuotes === 1 ? 'Version' : 'Versions'})
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Each quotation attached to this lead maintains its own strictly isolated version timeline, pricing snapshot, and comparison scope.
            </p>
          </div>
        </div>

        {isolatedGroups.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
            <DollarSign className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No Quotations Generated Yet</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              Use the Quotation Builder to create an itemized luxury itinerary proposal for this lead.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {isolatedGroups.map(group => {
              const quote =
                group.quote ||
                linkedQuotes.find(q => q.id === group.quoteId) ||
                db.getQuoteByIdAuthorized(group.quoteId, currentUser);
              const isAlreadyConverted =
                quote?.status === 'BOOKING_SUBMITTED' ||
                quote?.status === 'CONVERTED' ||
                Boolean(lead.bookingId) ||
                Boolean(lead.bookingReference);
              // Strict per-quote invariant: guarantee every displayed version belongs solely to this quoteId
              const quoteOnlyVersions = group.versions.filter(v => v.quoteId === group.quoteId);
              const latestVer =
                quoteOnlyVersions.find(v => v.version === group.latestVersionNumber) || quoteOnlyVersions[0];

              return (
                <div
                  key={group.quoteId}
                  data-quote-group-id={group.quoteId}
                  className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/70 space-y-4"
                >
                  {/* Group Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-slate-900 text-sm bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                        #{group.quoteNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#00C6A6]/20 text-[#00705d] border border-[#00C6A6]/40">
                        Latest v{group.latestVersionNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {group.title}
                      </span>
                      {quote?.isLocked && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300 inline-flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Locked Snapshot
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          group.status === 'BOOKING_SUBMITTED' || group.status === 'CONVERTED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : group.status === 'ACCEPTED' || group.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : group.status === 'ISSUED' || group.status === 'SENT'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {group.status}
                      </span>
                      <span className="font-mono font-black text-sm text-slate-900">
                        {formatCurrency(group.latestTotalSellingPrice || 0, group.currency || 'USD')}
                      </span>
                    </div>
                  </div>

                  {/* Group Summary Grid */}
                  <div
                    className={`grid grid-cols-2 ${
                      canViewInternalCosts ? 'sm:grid-cols-5' : 'sm:grid-cols-4'
                    } gap-2 text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80`}
                  >
                    <div>
                      <span className="text-slate-400 block">Traveler / Destination</span>
                      <span className="font-bold text-slate-800">
                        {quote?.clientName || lead.contactName || lead.clientName || 'Client'} •{' '}
                        {group.destination || lead.destinationName || 'Multi-City'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Pax Count</span>
                      <span className="font-bold text-slate-800">
                        {quote?.totalPax || lead.totalPassengers || 2} Pax
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Travel Dates &amp; Scope</span>
                      <span className="font-bold text-slate-800">
                        {quote?.travelStartDate || lead.travelDates || 'Flexible'} •{' '}
                        {quote?.routeHubs?.length || 0} Hubs • {latestVer?.totalItems ?? quote?.items?.length ?? 0} Services
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Activity Summary</span>
                      <span className="font-semibold text-slate-700 truncate block">
                        {latestVer?.changesSummary || quote?.latestSaveNote || 'Saved snapshot'}
                      </span>
                    </div>
                    {canViewInternalCosts && (
                      <div>
                        <span className="text-slate-400 block">Net Cost</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatCurrency(
                            latestVer?.totalNetCost ?? quote?.totalNetCost ?? 0,
                            group.currency || 'USD'
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Group Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div className="text-[11px] text-slate-500">
                      Updated: {new Date(group.updatedAt || Date.now()).toLocaleString()}
                      {latestVer?.createdByName && (
                        <span>
                          {' '}
                          • Saved by <strong>{latestVer.createdByName}</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {quoteOnlyVersions.length >= 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setVersionModalTarget({
                              quoteId: group.quoteId,
                              initialQuote: quote,
                              initialTab: 'COMPARE'
                            })
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          <span>Compare Versions</span>
                        </button>
                      )}

                      {quote && (
                        <>
                          <button
                            type="button"
                            onClick={() => void openPreviewForQuoteAsync(quote, latestVer)}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadPDFForQuote(quote)}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-600" />
                            <span>PDF</span>
                          </button>
                        </>
                      )}

                      {onOpenQuote && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenQuote(group.quoteId, {
                              version: group.latestVersionNumber,
                              mode: quote?.isLocked ? 'inspect' : 'edit',
                              leadId: lead.id
                            })
                          }
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
                          <span>View Booking</span>
                          <ArrowRight className="w-3 h-3 text-emerald-600" />
                        </button>
                      ) : quote ? (
                        <button
                          type="button"
                          onClick={() => onConvertToBooking(quote)}
                          disabled={isConverting}
                          className="px-3.5 py-1.5 rounded-xl bg-[#008f77] hover:bg-[#00705d] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>Convert to Booking</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Isolated Per-Quotation Version History List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-[#008f77]" />
                        <span>
                          Version History for #{group.quoteNumber} ({quoteOnlyVersions.length})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setVersionModalTarget({
                            quoteId: group.quoteId,
                            initialQuote: quote,
                            initialTab: 'HISTORY'
                          })
                        }
                        className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer normal-case"
                      >
                        Full History &amp; Diff
                      </button>
                    </div>

                    <div className="space-y-2">
                      {quoteOnlyVersions.map(v => {
                        const isLatest = v.version === group.latestVersionNumber;
                        const associatedQuote = getQuoteForVersion(v, quote);

                        return (
                          <div
                            key={v.id || `${v.quoteId}__v${v.version}`}
                            className={`p-3 rounded-xl border text-xs space-y-2 ${
                              isLatest
                                ? 'border-teal-300 bg-white shadow-2xs'
                                : 'border-slate-200 bg-white/80'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-black text-slate-900">
                                  v{v.version}
                                </span>
                                {isLatest ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00C6A6]/20 text-[#00705d] border border-[#00C6A6]/40">
                                    LATEST
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    Saved Snapshot
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-500">
                                  {new Date(v.updatedAt || v.createdAt).toLocaleString()}
                                </span>
                                <span className="text-[11px] text-slate-600">
                                  by <strong>{v.createdByName || v.createdBy || 'Agent'}</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-slate-900">
                                  {formatCurrency(v.totalSellingPrice || 0, v.currency || 'USD')}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {v.status || 'DRAFT'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span>
                                {v.changesSummary || 'Explicit quotation draft saved'} •{' '}
                                <strong>{v.totalItems ?? v.items?.length ?? 0}</strong> services
                                {canViewInternalCosts && v.totalNetCost !== undefined && (
                                  <span>
                                    {' '}
                                    • Net:{' '}
                                    <strong className="font-mono">
                                      {formatCurrency(v.totalNetCost, v.currency || 'USD')}
                                    </strong>
                                  </span>
                                )}
                              </span>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVersionModalTarget({
                                      quoteId: group.quoteId,
                                      initialQuote: quote,
                                      initialTab: 'INSPECT',
                                      initialVersion: v.version
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View Version</span>
                                </button>

                                {onOpenQuote && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenQuote(group.quoteId, {
                                        version: v.version,
                                        mode: isLatest ? 'inspect' : 'readonly',
                                        leadId: lead.id
                                      })
                                    }
                                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <FileText className="w-3 h-3 text-[#00E5C0]" />
                                    <span>Open Version</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRestoreVersion(group.quoteId, v.version)}
                                  className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Load this version as an unsaved working draft (Save Draft creates a new version)"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </button>

                                {associatedQuote && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDownloadPDFForQuote(associatedQuote, v)}
                                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title={`Download v${v.version} PDF`}
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>PDF</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: PROPOSAL DOCUMENT PREVIEW */}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Client Name</span>
                  <strong className="text-sm text-slate-900">{previewingQuote.clientName || lead.clientName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Travel Dates</span>
                  <strong className="text-slate-900">
                    {previewingQuote.travelStartDate || 'Flexible'} → {previewingQuote.travelEndDate || 'Flexible'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Passengers</span>
                  <strong className="text-slate-900">
                    {previewingQuote.totalPax || 2} Guests ({previewingQuote.adultsCount || 2} Adults
                    {previewingQuote.childrenCount ? `, ${previewingQuote.childrenCount} Children` : ''})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Total Package Value</span>
                  <strong className="text-base font-mono font-black text-emerald-700">
                    {formatCurrency(previewingQuote.totalSellingPrice || 0, previewingQuote.currency)}
                  </strong>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Included Service Items ({previewingQuote.items?.length || 0})
                </h4>
                {!previewingQuote.items || previewingQuote.items.length === 0 ? (
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
                            Pax:{' '}
                            {typeof item.pax === 'object' && item.pax !== null
                              ? `${item.pax.adults ?? 2} Adults${item.pax.children ? `, ${item.pax.children} Ch` : ''}${
                                  item.pax.infants ? `, ${item.pax.infants} Inf` : ''
                                }`
                              : item.pax || 2}
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

      {/* ISOLATED PER-QUOTATION VERSION HISTORY, INSPECTOR & COMPARE MODAL */}
      {versionModalTarget && (
        <QuotationVersionHistoryModal
          isOpen={!!versionModalTarget}
          onClose={() => setVersionModalTarget(null)}
          quoteId={versionModalTarget.quoteId}
          initialQuote={versionModalTarget.initialQuote}
          currentUser={currentUser}
          initialTab={versionModalTarget.initialTab}
          initialVersion={versionModalTarget.initialVersion}
          onOpenVersion={(qId, ver, mode) => {
            setVersionModalTarget(null);
            onOpenQuote?.(qId, { version: ver, mode, leadId: lead.id });
          }}
          onRestoreVersion={(qId, ver) => {
            setVersionModalTarget(null);
            handleRestoreVersion(qId, ver);
          }}
        />
      )}
    </div>
  );
};
