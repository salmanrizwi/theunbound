import React, { useState, useMemo } from 'react';
import { useQuotation } from '../context/QuotationContext';
import { useAuth } from '../context/AuthContext';
import { useRoster } from '../context/RosterContext';
import { formatCurrency } from '../services/pricingEngine';
import { RosterCalendarPicker } from './RosterCalendarPicker';
import { Quotation } from '../types';
import { 
  X, 
  Trash2, 
  FileDown, 
  Bookmark, 
  Send, 
  Calendar, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  Printer, 
  Check, 
  Lock,
  ArrowRight,
  Globe2,
  FileText,
  AlertTriangle,
  CalendarX,
  CalendarCheck,
  UserCheck,
  RefreshCw,
  AlertOctagon
} from 'lucide-react';

interface QuoteBuilderDrawerProps {
  onBookQuote?: (quote: Quotation) => void;
}

export const QuoteBuilderDrawer: React.FC<QuoteBuilderDrawerProps> = ({ onBookQuote }) => {
  const {
    items,
    currency,
    isQuoteDrawerOpen,
    setIsQuoteDrawerOpen,
    removeProductFromQuote,
    updateItemPax,
    updateItemTravelDate,
    clearQuote,
    clientName,
    setClientName,
    clientEmail,
    setClientEmail,
    clientCompany,
    setClientCompany,
    agentNotes,
    setAgentNotes,
    overallDiscountPercent,
    setOverallDiscountPercent,
    totalNetCost,
    totalSellingPrice,
    totalTaxes,
    totalServiceFees,
    totalMarginAmount,
    saveCurrentQuote
  } = useQuotation();

  const { user, role } = useAuth();
  const { checkDateAvailability, getNextAvailableDate } = useRoster();
  const isInternalUser = role === 'ADMIN' || role === 'DMC_STAFF';
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);
  const [showProposalPreview, setShowProposalPreview] = useState(false);
  const [calendarPickerItemId, setCalendarPickerItemId] = useState<string | null>(null);

  // Identify any products with Roster date conflicts
  const conflictedItems = useMemo(() => {
    return items.filter(item => {
      const check = checkDateAvailability(
        item.product.id,
        item.travelDate,
        item.pax.adults + item.pax.children
      );
      return !check.isAvailable;
    });
  }, [items, checkDateAvailability]);

  const hasRosterConflict = conflictedItems.length > 0;

  // Auto-resolve all blocked dates in 1 click
  const handleAutoResolveAllConflicts = () => {
    items.forEach(item => {
      const check = checkDateAvailability(
        item.product.id,
        item.travelDate,
        item.pax.adults + item.pax.children
      );
      if (!check.isAvailable) {
        const nextDate = getNextAvailableDate(item.product.id, item.travelDate);
        if (nextDate) {
          updateItemTravelDate(item.id, nextDate);
        }
      }
    });
  };

  if (!isQuoteDrawerOpen) return null;

  const handleSaveQuote = () => {
    if (hasRosterConflict) return;
    const saved = saveCurrentQuote();
    if (saved) {
      setIsSavedSuccessfully(true);
      setTimeout(() => setIsSavedSuccessfully(false), 3000);
    }
  };

  const handlePrintProposal = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        id="quote-builder-drawer-panel"
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C6A6]">
                TheUnbound Quotation Builder
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-xs text-slate-300 font-semibold">{items.length} Selected Items</span>
            </div>
            <h2 className="text-lg font-bold text-white">Client Travel Proposal & Pricing</h2>
          </div>

          <div className="flex items-center space-x-2">
            {items.length > 0 && (
              <button
                onClick={clearQuote}
                className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
            <button
              id="close-quote-drawer-btn"
              onClick={() => setIsQuoteDrawerOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="overflow-y-auto p-5 space-y-6 flex-1">
          {items.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Sparkles className="w-8 h-8 text-[#00C6A6]" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">Your quotation is currently empty</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                Browse our curated destination catalogue for Europe, UK, and Japan to add hotels, transfers, and private tours.
              </p>
              <button
                onClick={() => setIsQuoteDrawerOpen(false)}
                className="bg-[#00C6A6] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-[#00C6A6]/20 cursor-pointer"
              >
                Explore Travel Products
              </button>
            </div>
          ) : (
            <>
              {/* Roster Conflict Warning Alert Banner */}
              {hasRosterConflict && (
                <div className="p-3.5 rounded-2xl bg-rose-950 border border-rose-700 text-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
                  <div className="flex items-start space-x-2.5">
                    <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-extrabold text-rose-200">
                        Roster Conflict: {conflictedItems.length} Product(s) Have Blocked Dates
                      </h4>
                      <p className="text-[11px] text-rose-300">
                        Zero-Risk Policy: Proposals and bookings are locked until all items are verified open in the DMC Roster.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoResolveAllConflicts}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center space-x-1.5 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Auto-Resolve All Dates</span>
                  </button>
                </div>
              )}

              {/* Client & Itinerary Meta Inputs */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Client & Proposal Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Client Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Lord & Lady Harrington"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Client Email</label>
                    <input
                      type="email"
                      placeholder="client@luxurytravel.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Company / Agency</label>
                    <input
                      type="text"
                      placeholder="VIP Travel Club"
                      value={clientCompany}
                      onChange={(e) => setClientCompany(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>
                </div>
              </div>

              {/* Selected Products List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Itinerary Product Items ({items.length})
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">Currency: {currency}</span>
                </div>

                {items.map((item, idx) => {
                  const availability = checkDateAvailability(
                    item.product.id,
                    item.travelDate,
                    item.pax.adults + item.pax.children
                  );
                  const isCalendarOpen = calendarPickerItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl bg-white border transition-all space-y-3 ${
                        !availability.isAvailable
                          ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/30'
                          : 'border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3">
                          <span className={`w-6 h-6 rounded-full font-mono text-xs flex items-center justify-center shrink-0 ${
                            availability.isAvailable ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white font-bold'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                {item.product.category}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {item.product.city}
                              </span>
                              {availability.isAvailable ? (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  <CalendarCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Roster Confirmed</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.2 rounded">
                                  <CalendarX className="w-3 h-3 text-rose-600" />
                                  <span>Date Blocked in Roster</span>
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug mt-0.5">
                              {item.product.name}
                            </h4>
                          </div>
                        </div>

                        <button
                          onClick={() => removeProductFromQuote(item.id)}
                          className="text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                          title="Remove product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Controls Row: Pax & Travel Date */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center space-x-2">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div className="flex items-center space-x-1.5 text-xs">
                            <span className="text-slate-500 font-medium">Adults:</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={item.pax.adults}
                              onChange={(e) =>
                                updateItemPax(item.id, {
                                  ...item.pax,
                                  adults: Math.max(1, parseInt(e.target.value) || 1)
                                })
                              }
                              className="w-12 bg-slate-50 border border-slate-200 rounded text-center font-bold text-xs py-0.5"
                            />
                            <span className="text-slate-500 font-medium ml-1">Child:</span>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={item.pax.children}
                              onChange={(e) =>
                                updateItemPax(item.id, {
                                  ...item.pax,
                                  children: Math.max(0, parseInt(e.target.value) || 0)
                                })
                              }
                              className="w-12 bg-slate-50 border border-slate-200 rounded text-center font-bold text-xs py-0.5"
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setCalendarPickerItemId(isCalendarOpen ? null : item.id)}
                            className="text-[11px] text-[#008972] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                            title="Open Roster Calendar"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{isCalendarOpen ? 'Close Roster' : 'Check Roster'}</span>
                          </button>
                          <input
                            type="date"
                            value={item.travelDate}
                            min={item.product.validityFrom}
                            max={item.product.validityTo}
                            onChange={(e) => updateItemTravelDate(item.id, e.target.value)}
                            className={`border rounded-lg text-xs px-2.5 py-1 font-mono font-medium ${
                              availability.isAvailable
                                ? 'bg-slate-50 border-slate-200 text-slate-700'
                                : 'bg-rose-50 border-rose-400 text-rose-900 font-bold'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expandable Roster Calendar for this item */}
                      {isCalendarOpen && (
                        <div className="pt-2 border-t border-slate-100">
                          <RosterCalendarPicker
                            productId={item.product.id}
                            selectedDate={item.travelDate}
                            onSelectDate={(newDate) => {
                              updateItemTravelDate(item.id, newDate);
                            }}
                            paxCount={item.pax.adults + item.pax.children}
                            minDate={item.product.validityFrom}
                            maxDate={item.product.validityTo}
                          />
                        </div>
                      )}

                      {/* Roster Conflict Alert & Quick-Fix Button */}
                      {!availability.isAvailable && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-2">
                          <div className="flex items-start space-x-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold text-rose-900">Roster Conflict on {item.travelDate}: </span>
                              <span className="text-rose-700">{availability.reason}</span>
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-rose-200 flex items-center justify-between">
                            <span className="text-[10px] text-rose-600">Booking blocked to prevent operational failure.</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = getNextAvailableDate(item.product.id, item.travelDate);
                                if (next) updateItemTravelDate(item.id, next);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-colors cursor-pointer shadow-xs"
                            >
                              <span>Auto-Fix to Next Open Date</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Item Financial Summary */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div className="text-slate-500 text-[11px]">
                          {isInternalUser ? (
                            <span>Net: <span className="font-mono">{formatCurrency(item.calculation.totalNetCost, currency)}</span></span>
                          ) : (
                            <span>Rate: <span className="font-mono font-medium text-slate-700">{formatCurrency(item.calculation.adultPricePerPax, currency)} / adult</span></span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Item Selling Total</span>
                          <span className="font-extrabold text-sm text-slate-900 font-mono">
                            {formatCurrency(item.calculation.finalTotalSellingPrice, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Agent Itinerary Notes & DMC Rate Validation */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#008972]" />
                    <span>Internal Agent Itinerary Notes</span>
                  </span>
                  <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Verified DMC Rates</span>
                  </span>
                </div>

                <textarea
                  rows={2}
                  placeholder="VIP guests celebrating 25th anniversary; private champagne greeting requested."
                  value={agentNotes}
                  onChange={(e) => setAgentNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:ring-1 focus:ring-[#00C6A6]"
                />

                <p className="text-[10px] text-slate-500 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-[#00C6A6] shrink-0" />
                  <span>Wholesale contracted rates and margins are locked to ensure supplier parity.</span>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer with Financial Totals and Action Buttons */}
        {items.length > 0 && (
          <div className="bg-slate-900 text-white p-5 border-t border-slate-800 shrink-0 space-y-4">
            {/* Quick summary for agents */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="text-slate-400">Total Curated Services:</span>
              <span className="font-semibold text-white">{items.length} {items.length === 1 ? 'Product' : 'Products'}</span>
            </div>

            {/* Internal DMC Profit & Margin (Visible ONLY to Admin / Staff) */}
            {isInternalUser && (
              <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 space-y-1.5 text-[11px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Internal DMC Financial Breakdown</p>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div className="flex justify-between">
                    <span>Net Base:</span>
                    <span className="font-mono">{formatCurrency(totalNetCost, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes & VAT:</span>
                    <span className="font-mono">+{formatCurrency(totalTaxes, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Fees:</span>
                    <span className="font-mono">+{formatCurrency(totalServiceFees, currency)}</span>
                  </div>
                  <div className="flex justify-between text-[#00E5C0] font-bold">
                    <span>Gross Margin:</span>
                    <span className="font-mono">{formatCurrency(totalMarginAmount, currency)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Booking Lock Warning if Roster Conflicts exist */}
            {hasRosterConflict && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[11px] font-semibold">
                  Proposal Generation Locked: Resolve {conflictedItems.length} conflicting date(s) in Roster before creating client quote.
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-baseline justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Final Itinerary Price
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[#00E5C0] font-sans">
                  {formatCurrency(totalSellingPrice, currency)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="btn-save-quote"
                  disabled={hasRosterConflict}
                  onClick={handleSaveQuote}
                  className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    hasRosterConflict
                      ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800'
                      : 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer'
                  }`}
                >
                  {isSavedSuccessfully ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5 text-[#00C6A6]" />
                      <span>Save Quote</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-preview-proposal"
                  disabled={hasRosterConflict}
                  onClick={() => setShowProposalPreview(true)}
                  className={`flex items-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                    hasRosterConflict
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer'
                  }`}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Proposal</span>
                </button>

                {onBookQuote && (
                  <button
                    id="btn-drawer-book-quote"
                    disabled={hasRosterConflict}
                    onClick={() => {
                      const quote = saveCurrentQuote();
                      if (quote) {
                        setIsQuoteDrawerOpen(false);
                        onBookQuote(quote);
                      }
                    }}
                    className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md ${
                      hasRosterConflict
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-[#00C6A6] hover:bg-[#008972] text-slate-950 shadow-[#00C6A6]/20 cursor-pointer hover:scale-102'
                    }`}
                  >
                    <CalendarCheck className="w-3.5 h-3.5 text-slate-950" />
                    <span>Book (24-48h SLA)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Client Proposal Printable PDF Viewer */}
        {showProposalPreview && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Proposal Modal Header */}
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Globe2 className="w-5 h-5 text-[#00C6A6]" />
                  <span className="font-bold text-sm">Official Client Travel Proposal</span>
                </div>
                <div className="flex items-center space-x-2">
                  {onBookQuote && (
                    <button
                      onClick={() => {
                        const quote = saveCurrentQuote();
                        if (quote) {
                          setShowProposalPreview(false);
                          setIsQuoteDrawerOpen(false);
                          onBookQuote(quote);
                        }
                      }}
                      className="flex items-center space-x-1.5 bg-[#00C6A6] text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-[#008972] cursor-pointer"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>Book (24-48h SLA)</span>
                    </button>
                  )}
                  <button
                    onClick={handlePrintProposal}
                    className="flex items-center space-x-1.5 bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-700 cursor-pointer border border-slate-700"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    onClick={() => setShowProposalPreview(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Itinerary Document Body */}
              <div className="overflow-y-auto p-8 space-y-6 text-slate-900 bg-white" id="printable-client-proposal">
                {/* Brand & Reference Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div>
                    {role === 'B2B_AGENT' || role === 'AGENT' ? (
                      <>
                        <h1 className="text-2xl font-black font-sans tracking-tight text-slate-900">
                          {user?.name || 'Travel Agent Partner'}
                        </h1>
                        <p className="text-xs uppercase tracking-widest text-[#008972] font-bold">
                          {user?.agencyName || 'Authorized Travel Partner Agency'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Tailored Travel Itinerary • In Association with TheUnbound DMC
                        </p>
                      </>
                    ) : (
                      <>
                        <h1 className="text-2xl font-black font-sans tracking-tight text-slate-900">TheUnbound</h1>
                        <p className="text-xs uppercase tracking-widest text-[#008972] font-bold">
                          Destination Management Company (DMC)
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Direct Ground Logistics & Tour Operations Hub
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          sales@theunbound.in • Landline: 011-41185542 • Mobile: +91-9811654959, +91-9718894959
                        </p>
                      </>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-slate-900">
                      REF: UBQ-2026-{Math.floor(1000 + Math.random() * 9000)}
                    </p>
                    <p className="text-xs text-slate-500">Date: {new Date().toLocaleDateString()}</p>
                    <p className="text-xs text-slate-700 font-semibold mt-1">
                      {role === 'B2B_AGENT' || role === 'AGENT'
                        ? `Agent: ${user?.name || 'B2B Agent'} (${user?.agencyName || 'Agency'})`
                        : role === 'ADMIN'
                        ? `DMC Operator: TheUnbound (Admin: ${user?.name || 'Marcus Vance'})`
                        : `DMC Operator: TheUnbound (Team Member: ${user?.name || 'Kenji Sato'})`}
                    </p>
                  </div>
                </div>

                {/* Client Reference Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Valued Guest / Client:</p>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">{clientName || 'Private Client Group'}</p>
                    {clientEmail && <p className="text-slate-600">{clientEmail}</p>}
                    {clientCompany && <p className="text-slate-600">{clientCompany}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Quotation Status:</p>
                    <p className="font-bold text-emerald-700 text-sm mt-0.5">CONFIRMED ITINERARY RATES</p>
                    <p className="text-slate-500">Valid for 14 calendar days</p>
                  </div>
                </div>

                {/* Detailed Line Items Table */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
                    Curated Itinerary Products & Services
                  </h3>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-500">
                        <th className="py-2 font-semibold">Service Description</th>
                        <th className="py-2 font-semibold">Destination / City</th>
                        <th className="py-2 font-semibold">Date</th>
                        <th className="py-2 font-semibold">Pax</th>
                        <th className="py-2 font-semibold text-right">Published Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-3 font-bold text-slate-900">{item.product.name}</td>
                          <td className="py-3 text-slate-600">{item.product.destinationName} ({item.product.city})</td>
                          <td className="py-3 text-slate-600 font-mono">{item.travelDate}</td>
                          <td className="py-3 text-slate-600">{item.pax.adults}A {item.pax.children > 0 ? `${item.pax.children}C` : ''}</td>
                          <td className="py-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.calculation.finalTotalSellingPrice, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Final Price Summary Box */}
                <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-baseline">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Total Net Inclusions & Taxes</p>
                    <p className="text-[11px] text-slate-500">All local city taxes, VAT, and chauffeur charges included.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Total Quotation Value:</span>
                    <span className="text-2xl font-black text-slate-950 font-sans">
                      {formatCurrency(totalSellingPrice, currency)}
                    </span>
                  </div>
                </div>

                {/* Terms and Sign-off */}
                <div className="bg-slate-50 p-4 rounded-xl text-[11px] text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">Terms & Conditions:</p>
                  <p>1. Services are held on provisional allotment and subject to ground supplier confirmation upon written voucher deposit.</p>
                  <p>2. Chauffeur waiting times and baggage assistance adhere strictly to DMC standard operating protocol.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
