import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Plus, 
  History, 
  X, 
  Minimize2, 
  Maximize2, 
  RotateCcw, 
  MapPin, 
  Calendar, 
  Users, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  ChatSession, 
  ChatMessage, 
  ChatbotAction,
  CurrencyCode, 
  User,
  AiPlannerOptionPlan,
  AiPlannerStructuredRequirements,
  QuoteBuilderHandoffPayload
} from '../../types';
import { AiChatbotService } from '../../services/aiChatbotService';
import { ChatbotMessageCard } from './ChatbotMessageCard';
import { ChatbotSessionsDrawer } from './ChatbotSessionsDrawer';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';
import { navigateTo } from '../../services/portalRouter';

interface ChatbotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  portal?: 'BUYER' | 'B2B_AGENT' | 'ADMIN';
  initialPrompt?: string;
  onOpenInQuoteBuilder?: (plan: AiPlannerOptionPlan, requirements: AiPlannerStructuredRequirements) => void;
}

const STARTER_PRESETS = [
  {
    title: 'Japan Golden Route (8 Nights)',
    desc: 'Tokyo & Kyoto for 4 Adults in 5-Star Luxury with Private Transfers',
    prompt: 'Plan an 8-night luxury itinerary in Japan for 4 adults starting in Tokyo and finishing in Kyoto with 5-star hotels, private transfers, and curated cultural experiences.'
  },
  {
    title: 'Tokyo & Hakone Ryokan (6 Nights)',
    desc: 'Family of 3 (2 Adults, 1 Child 7yo) with Onsen Experience',
    prompt: 'Family of 3 (2 adults, 1 child aged 7) traveling to Japan for 6 nights. 4 nights in Tokyo and 2 nights in Hakone Ryokan with hot spring onsen and private transfers.'
  },
  {
    title: 'Cultural Explorer (7 Nights)',
    desc: 'Boutique stay for 2 Adults with culinary walking tours',
    prompt: '7-night cultural and gastronomy itinerary for 2 adults visiting Tokyo and Kyoto with boutique accommodations, tea ceremony, and food walking tours.'
  }
];

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({
  isOpen,
  onClose,
  portal = 'B2B_AGENT',
  initialPrompt,
  onOpenInQuoteBuilder
}) => {
  const { user } = useAuth();
  const { currency, loadAiPlannerPayload } = useQuotation();
  const chatbotService = AiChatbotService.getInstance();

  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load user sessions on mount
  useEffect(() => {
    if (isOpen) {
      const allSessions = chatbotService.getSessions(user?.id);
      setSessions(allSessions);

      if (allSessions.length > 0 && !activeSession) {
        const latest = allSessions[0];
        setActiveSession(latest);
        setMessages(chatbotService.getMessages(latest.sessionId));
      } else if (!activeSession) {
        handleStartNewSession();
      }
    }
  }, [isOpen, user?.id]);

  // Handle initialPrompt if provided
  useEffect(() => {
    if (isOpen && initialPrompt && activeSession && messages.length === 0) {
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt, activeSession]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Show temporary toast
  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleStartNewSession = async () => {
    setIsLoading(true);
    try {
      const newSession = await chatbotService.createSession(user, portal as 'BUYER' | 'B2B_AGENT' | 'ADMIN');
      setActiveSession(newSession);
      setMessages([]);
      setSessions(chatbotService.getSessions(user?.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    const session = chatbotService.getSession(sessionId);
    if (session) {
      setActiveSession(session);
      setMessages(chatbotService.getMessages(sessionId));
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    setIsLoading(true);

    try {
      let session = activeSession;
      if (!session) {
        session = await chatbotService.createSession(user, portal as 'BUYER' | 'B2B_AGENT' | 'ADMIN');
        setActiveSession(session);
      }

      const result = await chatbotService.sendMessage({
        sessionId: session.sessionId,
        text,
        user,
        currency,
        portal: portal as 'BUYER' | 'B2B_AGENT' | 'ADMIN'
      });

      setActiveSession(result.session);
      setMessages(chatbotService.getMessages(result.session.sessionId));
      setSessions(chatbotService.getSessions(user?.id));
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast('Error', 'Unable to complete AI travel request. Please try again.');
    } finally {
      setIsLoading(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleActionClick = (action: ChatbotAction, payload?: any) => {
    if (action.actionType === 'OPEN_QUOTE_BUILDER') {
      const plan: AiPlannerOptionPlan = payload?.plan || activeSession?.currentPlan?.options?.[0];
      const requirements: AiPlannerStructuredRequirements = payload?.requirements || activeSession?.tripState;

      if (!plan || !requirements) {
        showToast('Quote Builder', 'Opening Quote Builder for custom itinerary design...');
        navigateTo('/b2b/quote-builder');
        onClose();
        return;
      }

      if (onOpenInQuoteBuilder) {
        onOpenInQuoteBuilder(plan, requirements);
      } else {
        const handoff = chatbotService.buildQuoteHandoffPayload(plan, requirements, user);
        loadAiPlannerPayload(handoff);
        showToast('Loaded into Quote Builder', `${plan.badge}: ${plan.routeSummary?.join(' → ')}`);
        navigateTo('/b2b/quote-builder');
      }
      onClose();

    } else if (action.actionType === 'VIEW_BOOKING') {
      const path = action.payload?.path || (portal === 'BUYER' ? '/buyer/bookings' : '/b2b/bookings');
      navigateTo(path);
      onClose();

    } else if (action.actionType === 'CUSTOM_PROMPT') {
      const prompt = action.payload?.prompt || action.label;
      if (prompt) {
        handleSendMessage(prompt);
      }

    } else if (action.actionType === 'VIEW_DETAIL') {
      if (payload?.type === 'BOOKING') {
        const path = portal === 'BUYER' ? '/buyer/bookings' : '/b2b/bookings';
        navigateTo(path);
        onClose();
      } else if (payload?.type === 'HOTEL') {
        handleSendMessage(`Tell me more about hotel: ${payload.title} and prices`);
      } else if (payload?.type === 'PACKAGE') {
        handleSendMessage(`Tell me more about package: ${payload.title}`);
      } else if (payload?.type === 'PRODUCT') {
        handleSendMessage(`Tell me more about activity: ${payload.title} and price`);
      }

    } else if (action.actionType === 'SAVE_QUOTE') {
      showToast('Quote Saved', 'Your itinerary quote has been saved to your active quotations.');

    } else if (action.actionType === 'SHARE_WHATSAPP') {
      const plan: AiPlannerOptionPlan = payload?.plan || activeSession?.currentPlan?.options?.[0];
      if (plan) {
        const nights = activeSession?.tripState?.duration?.nights?.value || (plan.days.length > 1 ? plan.days.length - 1 : plan.days.length);
        const text = `*TheUnbound Luxury Itinerary: ${plan.destinationName} (${nights} Nights)*\n` +
          `Route: ${plan.routeSummary.join(' → ')}\n` +
          `Authoritative Price: ${formatCurrency(plan.totalSellingPrice, plan.currency || currency)}\n` +
          `Crafted with TheUnbound AI Travel Specialist.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }

    } else if (action.actionType === 'TALK_TO_EXPERT') {
      navigateTo('/contact');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed z-50 transition-all duration-300 flex flex-col bg-white shadow-2xl border border-slate-200 overflow-hidden ${
        isExpanded
          ? 'inset-4 sm:inset-10 rounded-2xl'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[95vw] sm:w-[540px] h-[85vh] sm:h-[680px] max-h-[85vh] rounded-2xl'
      }`}
    >
      {/* Sessions Drawer */}
      <ChatbotSessionsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sessions={sessions}
        activeSessionId={activeSession?.sessionId || null}
        onSelectSession={handleSelectSession}
        onNewSession={handleStartNewSession}
      />

      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00C6A6] to-[#008f77] flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight text-white">TheUnbound AI</h3>
              <span className="text-[10px] bg-[#00C6A6]/20 text-[#00C6A6] font-semibold px-2 py-0.5 rounded-full border border-[#00C6A6]/30">
                Live Inventory
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">
              DMC Travel Specialist & Planning Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* History / Sessions Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors relative"
            title="Saved Trips"
          >
            <History className="w-4 h-4" />
            {sessions.length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#00C6A6] rounded-full" />
            )}
          </button>

          {/* New Trip Button */}
          <button
            onClick={handleStartNewSession}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Start New Trip"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Maximize / Restore Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden sm:inline-flex p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={isExpanded ? 'Restore size' : 'Expand window'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="absolute top-16 left-4 right-4 z-40 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-[#00C6A6] shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-white">{toastMessage.title}</div>
            <div className="text-[11px] text-slate-300">{toastMessage.desc}</div>
          </div>
        </div>
      )}

      {/* Message Thread Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/60 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-[#00A88F] flex items-center justify-center mb-3 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1">
              Where would your client like to travel?
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
              Ask for personalized multi-city itineraries, live hotel availability, curated activities, or ground transfer routing.
            </p>

            <div className="w-full space-y-2 text-left max-w-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                Suggested Requests
              </div>
              {STARTER_PRESETS.map((preset, pIdx) => (
                <div
                  key={pIdx}
                  onClick={() => handleSendMessage(preset.prompt)}
                  className="p-3 bg-white border border-slate-200 hover:border-[#00C6A6] rounded-xl cursor-pointer hover:shadow-xs transition-all group"
                >
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[#00A88F] flex items-center justify-between">
                    <span>{preset.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00A88F] transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{preset.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, mIdx) => (
            <ChatbotMessageCard
              key={msg.messageId || mIdx}
              message={msg}
              currency={currency}
              onActionClick={handleActionClick}
              onQuickPromptClick={handleSendMessage}
            />
          ))
        )}

        {/* Loading Reasoning Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2.5 mb-4">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#00C6A6] to-[#00A88F] flex items-center justify-center text-white shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00C6A6] animate-pulse" />
                <span className="text-xs font-semibold text-slate-700">
                  TheUnbound AI is evaluating inventory & calculating live rates...
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Checking hub routing, hotel allocations, and pricing authority rules.
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your travel request (e.g. 8 nights in Japan for 2 adults in 5-star hotels)..."
            disabled={isLoading}
            className="flex-1 py-2 px-3.5 bg-slate-50 border border-slate-200 focus:border-[#00C6A6] focus:bg-white rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none transition-all"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] disabled:bg-slate-200 text-white disabled:text-slate-400 flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-1.5">
          <span>Shift + Enter for new line</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Live TheUnbound Pricing Engine
          </span>
        </div>
      </div>
    </div>
  );
};
