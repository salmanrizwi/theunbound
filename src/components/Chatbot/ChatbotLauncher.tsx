import React, { useState } from 'react';
import { Sparkles, MessageSquare, X } from 'lucide-react';
import { ChatbotPanel } from './ChatbotPanel';
import { useAuth } from '../../context/AuthContext';
import { canUserAccessChatbot } from '../../services/permissionEngine';
import { AiPlannerOptionPlan, AiPlannerStructuredRequirements } from '../../types';

interface ChatbotLauncherProps {
  portal?: 'BUYER' | 'B2B_AGENT' | 'ADMIN';
  onOpenInQuoteBuilder?: (plan: AiPlannerOptionPlan, requirements: AiPlannerStructuredRequirements) => void;
}

export const ChatbotLauncher: React.FC<ChatbotLauncherProps> = ({
  portal = 'B2B_AGENT',
  onOpenInQuoteBuilder
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Strict: Plan with AI chat button is only visible to Buyer or approved B2B Agent; no one sees it if logged out
  if (!user || !isAuthenticated) {
    return null;
  }

  const accessCheck = canUserAccessChatbot(user, portal);
  if (!accessCheck.allowed) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 group">
          {/* Tooltip on hover */}
          <div className="hidden sm:flex items-center bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span>TheUnbound AI Assistant</span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            id="theunbound-chatbot-launcher-btn"
            className="flex items-center gap-2.5 bg-[#00C6A6] hover:bg-[#00b094] text-white p-3.5 sm:px-4 sm:py-3.5 rounded-full sm:rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white/40"
            aria-label="Open TheUnbound AI Travel Chatbot"
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-[#00C6A6]" />
            </div>
            <span className="hidden sm:inline font-bold text-xs sm:text-sm tracking-wide">
              Plan with AI
            </span>
          </button>
        </div>
      )}

      {/* Main Chatbot Panel */}
      <ChatbotPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        portal={portal}
        onOpenInQuoteBuilder={onOpenInQuoteBuilder}
      />
    </>
  );
};
