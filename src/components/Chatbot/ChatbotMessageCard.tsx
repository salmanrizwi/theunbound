import React, { useState } from 'react';
import { 
  ChatMessage, 
  AiPlannerOptionPlan, 
  AiPlannerDaySlot, 
  ChatCardItem, 
  ChatbotAction,
  CurrencyCode 
} from '../../types';
import { formatCurrency } from '../../services/pricingEngine';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Building2, 
  Compass, 
  Car, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Share2, 
  FileText, 
  Star, 
  Info,
  PhoneCall,
  Check,
  Zap,
  BookmarkCheck
} from 'lucide-react';

interface ChatbotMessageCardProps {
  message: ChatMessage;
  currency: CurrencyCode;
  onActionClick: (action: ChatbotAction, payload?: any) => void;
  onQuickPromptClick: (prompt: string) => void;
  onSelectOption?: (optionIndex: number) => void;
}

export const ChatbotMessageCard: React.FC<ChatbotMessageCardProps> = ({
  message,
  currency,
  onActionClick,
  onQuickPromptClick,
  onSelectOption
}) => {
  const isUser = message.sender === 'USER';
  const plan = message.structuredPlan;
  const [selectedOptIdx, setSelectedOptIdx] = useState(message.selectedOptionIndex || 0);
  const [isDayScheduleExpanded, setIsDayScheduleExpanded] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);

  const activeOption: AiPlannerOptionPlan | undefined = plan?.options?.[selectedOptIdx];

  const handleSwitchOption = (idx: number) => {
    setSelectedOptIdx(idx);
    if (onSelectOption) {
      onSelectOption(idx);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] sm:max-w-[75%] bg-[#0F172A] text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
          <span className="text-[10px] text-slate-400 block text-right mt-1">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-6">
      <div className="max-w-full sm:max-w-[92%] w-full">
        {/* Assistant Avatar & Name */}
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#00C6A6] to-[#00A88F] flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-700 tracking-wide">TheUnbound AI Travel Specialist</span>
          <span className="text-[10px] text-slate-400">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Text Body */}
        <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm p-4 sm:p-5 shadow-xs text-slate-800">
          <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap prose prose-slate max-w-none">
            {message.content}
          </div>

          {/* Structured Travel Plan Card */}
          {plan && activeOption && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              {/* Option Selector Tabs */}
              {plan.options.length > 1 && (
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl mb-4 overflow-x-auto">
                  {plan.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSwitchOption(idx)}
                      className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-lg text-xs font-medium transition-all text-center whitespace-nowrap ${
                        selectedOptIdx === idx
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{opt.badge}</span>
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {formatCurrency(opt.totalSellingPrice, opt.currency || currency)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Itinerary Header Summary Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#00A88F] bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      {activeOption.badge}
                    </span>
                    <h4 className="text-base font-bold text-slate-900">
                      {activeOption.destinationName} • {plan.requirements.duration?.nights?.value || (activeOption.days.length > 1 ? activeOption.days.length - 1 : activeOption.days.length)} Nights
                    </h4>
                  </div>
                  {/* Feasibility Badge */}
                  {message.feasibility && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      message.feasibility.status === 'PASS' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Feasibility: {message.feasibility.status}
                    </span>
                  )}
                </div>

                {/* Route Flow */}
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium my-2 overflow-x-auto pb-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800">Route:</span>
                  {activeOption.routeSummary.map((hub, hIdx) => (
                    <React.Fragment key={hIdx}>
                      <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-medium whitespace-nowrap">
                        {hub}
                      </span>
                      {hIdx < activeOption.routeSummary.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Authoritative Live Price Breakdown */}
                <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                      Authoritative Selling Price
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {formatCurrency(activeOption.totalSellingPrice, activeOption.currency || currency)}
                    </span>
                    <span className="text-xs text-slate-500 ml-2 font-medium">
                      ({formatCurrency(Math.round(activeOption.totalSellingPrice / Math.max(1, plan.requirements.travelers?.adults?.value || 2)), activeOption.currency || currency)} / pax)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <Zap className="w-3 h-3" /> Live Contract Rates Applied
                    </span>
                  </div>
                </div>
              </div>

              {/* Day-by-Day Detailed Itinerary Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => setIsDayScheduleExpanded(!isDayScheduleExpanded)}
                  className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#00C6A6]" />
                    <span>View Day-by-Day Program ({activeOption.days.length} Days)</span>
                  </span>
                  {isDayScheduleExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isDayScheduleExpanded && (
                  <div className="mt-2 space-y-2 border border-slate-200 rounded-lg p-3 bg-white max-h-96 overflow-y-auto">
                    {activeOption.days.map(day => (
                      <div key={day.dayNumber} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedDay(expandedDay === day.dayNumber ? null : day.dayNumber)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                              {day.dayNumber}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{day.themeTitle || `Day ${day.dayNumber}`}</div>
                              <div className="text-[11px] text-slate-500">{day.hubName}</div>
                            </div>
                          </div>
                          {expandedDay === day.dayNumber ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        </div>

                        {expandedDay === day.dayNumber && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 space-y-2 text-xs">
                            {day.items.map((item, iIdx) => (
                              <div key={iIdx} className="flex items-start gap-2 text-slate-700 bg-white p-2 rounded border border-slate-100">
                                {item.type === 'HOTEL' && <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
                                {item.type === 'TRANSFER' && <Car className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />}
                                {item.type === 'ACTIVITY' && <Compass className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />}
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-900">{item.name}</div>
                                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                    <span>{item.timeSlot || 'SCHEDULED'} • {item.hubName || day.hubName}</span>
                                    {item.sellingPrice > 0 && <span>{formatCurrency(item.sellingPrice, currency)}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => onActionClick(
                    { id: 'handoff', label: 'Open in Quote Builder', actionType: 'OPEN_QUOTE_BUILDER' },
                    { plan: activeOption, requirements: plan.requirements }
                  )}
                  className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-[#00C6A6] hover:bg-[#00b094] text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  <span>Open in Guided Quote Builder</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onActionClick(
                    { id: 'save', label: 'Save as Quote', actionType: 'SAVE_QUOTE' },
                    { plan: activeOption, requirements: plan.requirements }
                  )}
                  className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Save Quote</span>
                </button>

                <button
                  onClick={() => onActionClick(
                    { id: 'whatsapp', label: 'Share on WhatsApp', actionType: 'SHARE_WHATSAPP' },
                    { plan: activeOption, requirements: plan.requirements }
                  )}
                  className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          )}

          {/* Real Inventory Search Cards */}
          {message.cards && message.cards.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {message.cards.map((card, cIdx) => (
                  <div 
                    key={cIdx} 
                    className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/70 hover:bg-white transition-all flex gap-3 items-center group cursor-pointer"
                    onClick={() => onActionClick({ id: card.id, label: 'View Detail', actionType: 'VIEW_DETAIL', payload: card })}
                  >
                    {card.imageUrl ? (
                      <img 
                        src={card.imageUrl} 
                        alt={card.title} 
                        className="w-14 h-14 object-cover rounded-lg shrink-0 border border-slate-200" 
                      />
                    ) : card.type === 'BOOKING' ? (
                      <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                        <BookmarkCheck className="w-6 h-6" />
                      </div>
                    ) : card.type === 'PACKAGE' ? (
                      <div className="w-14 h-14 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-center text-[#00A88F] shrink-0">
                        <Compass className="w-6 h-6" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                        <Building2 className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {card.starRating && (
                          <div className="flex text-amber-400">
                            {[...Array(card.starRating)].map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400" />
                            ))}
                          </div>
                        )}
                        {card.badge && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ml-auto ${
                            card.type === 'BOOKING'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate mt-0.5">{card.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{card.subtitle}</div>
                      {card.priceText && (
                        <div className="text-xs font-bold text-[#00A88F] mt-0.5">{card.priceText}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions for Non-Plan Messages (e.g. Booking Status, Package Search, Hotel Price, Activity) */}
          {!plan && message.actions && message.actions.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
              {message.actions.map((act) => (
                <button
                  key={act.id}
                  onClick={() => onActionClick(act, act.payload)}
                  className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    act.variant === 'primary'
                      ? 'bg-[#00C6A6] hover:bg-[#00A88F] text-slate-900 shadow-xs'
                      : act.variant === 'secondary'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  {act.actionType === 'OPEN_QUOTE_BUILDER' && <Zap className="w-3.5 h-3.5 text-slate-900" />}
                  {act.actionType === 'VIEW_BOOKING' && <BookmarkCheck className="w-3.5 h-3.5 text-[#00A88F]" />}
                  {act.actionType === 'CUSTOM_PROMPT' && <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{act.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Citations / Authorities */}
          {message.citations && message.citations.length > 0 && (
            <div className="mt-3 text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-500">Grounded in:</span>
              {message.citations.map((c, i) => (
                <span key={i} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick Follow-up Prompt Pills */}
        {message.quickPrompts && message.quickPrompts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5 px-1">
            {message.quickPrompts.map((qp, qIdx) => (
              <button
                key={qIdx}
                onClick={() => onQuickPromptClick(qp)}
                className="text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 hover:border-slate-300 py-1.5 px-3 rounded-full transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] font-medium"
              >
                {qp}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
