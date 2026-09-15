import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast, ToastItem } from '../../services/toastService';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const GlobalToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe(updated => {
      setToasts(updated);
    });
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      id="theunbound-toast-portal"
      className="fixed bottom-6 right-4 sm:right-6 z-[99999] flex flex-col space-y-2.5 max-w-sm sm:max-w-md w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map(item => {
        const isSuccess = item.type === 'success';
        const isWarning = item.type === 'warning';
        const isError = item.type === 'error';
        const isInfo = item.type === 'info';

        return (
          <div
            key={item.id}
            className="pointer-events-auto bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xl flex items-start space-x-3 text-slate-800 animate-in slide-in-from-bottom-3 fade-in duration-200"
            role="alert"
          >
            {/* Status Icon */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isSuccess
                  ? 'bg-[#00C6A6]/15 text-[#008f77]'
                  : isWarning
                  ? 'bg-amber-100 text-amber-700'
                  : isError
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-sky-100 text-sky-700'
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#00C6A6]" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {isError && <AlertCircle className="w-4 h-4 text-rose-600" />}
              {isInfo && <Info className="w-4 h-4 text-sky-600" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                {item.title}
              </h5>
              {item.message && (
                <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                  {item.message}
                </p>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => toast.dismiss(item.id)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};
