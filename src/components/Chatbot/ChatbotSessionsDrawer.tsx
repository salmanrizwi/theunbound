import React from 'react';
import { ChatSession } from '../../types';
import { 
  Plus, 
  Clock, 
  MapPin, 
  ChevronRight, 
  X, 
  Sparkles, 
  Layers, 
  FileText 
} from 'lucide-react';

interface ChatbotSessionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export const ChatbotSessionsDrawer: React.FC<ChatbotSessionsDrawerProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-30 bg-slate-900/40 backdrop-blur-xs flex">
      <div className="w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00C6A6]" />
            <h3 className="font-bold text-slate-900 text-sm">Travel Planning Trips</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Start New Trip Button */}
        <div className="p-3 border-b border-slate-100">
          <button
            onClick={() => {
              onNewSession();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#00C6A6] hover:bg-[#00b094] text-white py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Plan a New Journey</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No saved sessions yet. Start by sending a message!
            </div>
          ) : (
            sessions.map(s => {
              const isActive = s.sessionId === activeSessionId;
              return (
                <div
                  key={s.sessionId}
                  onClick={() => {
                    onSelectSession(s.sessionId);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isActive
                      ? 'border-[#00C6A6] bg-teal-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {s.title || 'Untitled Journey'}
                    </span>
                    {s.leadId && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded shrink-0">
                        {s.leadId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(s.lastMessageAt || s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    {s.destinationName && (
                      <>
                        <span>•</span>
                        <span className="truncate">{s.destinationName}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="flex-1" onClick={onClose} />
    </div>
  );
};
