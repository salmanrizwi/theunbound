import React from 'react';
import { ShieldAlert, ArrowRight, LogOut, Lock, Building2, Globe2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navigateTo, PortalNamespace } from '../services/portalRouter';

interface PortalAccessRestrictedProps {
  targetNamespace: PortalNamespace;
  reason?: string;
  message?: string;
  onRedirect?: () => void;
}

export const PortalAccessRestrictedView: React.FC<PortalAccessRestrictedProps> = ({
  targetNamespace,
  message,
  onRedirect
}) => {
  const { user, logout, openAuthModal } = useAuth();

  const handleReturnToAuthorizedPortal = () => {
    if (onRedirect) {
      onRedirect();
      return;
    }
    if (!user) {
      navigateTo('/');
      return;
    }
    if (user.role === 'B2B_AGENT' || user.role === 'AGENT') {
      navigateTo('/b2b');
    } else if (user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      navigateTo('/admin');
    } else {
      navigateTo('/');
    }
  };

  const getPortalLabel = (ns: PortalNamespace) => {
    switch (ns) {
      case 'ADMIN': return 'Administrative Operations CMS';
      case 'B2B': return 'B2B Wholesale Travel Agent Portal';
      case 'BUYER': return 'Consumer Buyer Portal';
    }
  };

  const getUserPortalLabel = () => {
    if (!user) return 'Public Guest';
    if (user.role === 'B2B_AGENT' || user.role === 'AGENT') return 'B2B Partner Agent';
    if (user.role === 'ADMIN') return 'Master Executive Admin';
    if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') return 'DMC Operations Officer';
    return 'Direct Buyer';
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/40">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 bg-rose-950/60 border border-rose-800/80 text-rose-300 rounded-full text-[11px] font-bold uppercase tracking-wider inline-flex items-center space-x-1.5">
            <Lock className="w-3 h-3" />
            <span>Access Restricted</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            {getPortalLabel(targetNamespace)}
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            {message || `You do not have authorization to view this portal. TheUnbound maintains strict separation between Buyer, B2B Agent, and Administrative operations.`}
          </p>
        </div>

        {user && (
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl text-left flex items-center space-x-3 text-xs">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-white border border-slate-700">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              <span className="text-[10px] font-semibold text-[#00E5C0] block mt-0.5">
                Current Role: {getUserPortalLabel()}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2.5 pt-2">
          <button
            onClick={handleReturnToAuthorizedPortal}
            className="w-full bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-black py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Return to Authorized Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {user ? (
            <button
              onClick={() => {
                logout();
                navigateTo('/');
              }}
              className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sign Out & Switch Account</span>
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('Authentication Required for Portal Access')}
              className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Sign In to Existing Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
