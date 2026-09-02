import React from 'react';
import { Lock, X, ArrowRight, UserCheck, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { setIntendedPath } from '../services/portalRouter';

interface QuoteBuilderAuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

export const QuoteBuilderAuthRequiredModal: React.FC<QuoteBuilderAuthRequiredModalProps> = ({
  isOpen,
  onClose,
  onOpenLogin,
  onOpenRegister
}) => {
  if (!isOpen) return null;

  const handleLoginClick = () => {
    setIntendedPath('/b2b/quote-builder');
    onOpenLogin();
    onClose();
  };

  const handleRegisterClick = () => {
    setIntendedPath('/b2b/quote-builder');
    onOpenRegister();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        id="quote-builder-auth-modal"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white font-sans">
                Login Required
              </h2>
              <span className="text-[11px] text-[#00E5C0] font-semibold">
                Protected Quotation & Pricing Engine
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Please login to access the Quote Builder.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-start space-x-3 text-xs text-slate-700 leading-relaxed">
            <Briefcase className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-900 font-bold mb-0.5">Wholesale Tariffs & Contracted Rates</strong>
              The Unbound Quote Builder contains live contracted ground tariffs, multi-currency conversions, and custom itinerary tooling restricted to authenticated partners.
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Login Button */}
            <button
              id="quote-auth-login-btn"
              onClick={handleLoginClick}
              className="w-full bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Create Account Button */}
            <button
              id="quote-auth-register-btn"
              onClick={handleRegisterClick}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer border border-slate-200"
            >
              <UserCheck className="w-4 h-4 text-slate-600" />
              <span>Create Account</span>
            </button>

            {/* Close Button */}
            <button
              id="quote-auth-close-btn"
              onClick={onClose}
              className="w-full text-slate-500 hover:text-slate-700 font-semibold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer text-center"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
