import React, { useState, useEffect } from 'react';
import { googleAuth, GoogleAuthState } from '../../../services/googleAuth';
import { 
  CheckCircle2, 
  AlertTriangle, 
  LogOut, 
  RefreshCw, 
  Key, 
  ShieldCheck, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info
} from 'lucide-react';

interface GoogleAuthCardProps {
  serviceName?: string;
  requiredScopesDesc?: string;
  onAuthenticated?: () => void;
  compact?: boolean;
}

export const GoogleAuthCard: React.FC<GoogleAuthCardProps> = ({
  serviceName = 'Google Workspace',
  requiredScopesDesc = 'Gmail transactional dispatches, calendar duty rosters, and spreadsheet pricing tariffs',
  onAuthenticated,
  compact = false
}) => {
  const [authState, setAuthState] = useState<GoogleAuthState>(() => googleAuth.getAuthState());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualEmail, setManualEmail] = useState('business@theunbound.in');

  useEffect(() => {
    const unsubscribe = googleAuth.subscribe((state) => {
      setAuthState(state);
    });

    const handleStorageChange = () => {
      setAuthState(googleAuth.getAuthState());
    };
    window.addEventListener('google-auth-changed', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsubscribe();
      window.removeEventListener('google-auth-changed', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setErrorMsg(null);
    try {
      await googleAuth.signIn();
      if (onAuthenticated) onAuthenticated();
    } catch (err: any) {
      console.error('Sign in failure:', err);
      setErrorMsg(err?.message || 'Authentication was not completed. You can also paste an OAuth token below.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = () => {
    googleAuth.signOut();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    try {
      googleAuth.setManualToken(manualToken, manualEmail);
      setManualToken('');
      setShowManualInput(false);
      setErrorMsg(null);
      if (onAuthenticated) onAuthenticated();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save token');
    }
  };

  const handleQuickDemoConnect = () => {
    // Generate a developer test session token for instantaneous in-app testing
    const demoToken = `ya29.theunbound_workspace_token_${Date.now()}_simulated`;
    googleAuth.setManualToken(demoToken, 'business@theunbound.in');
    if (onAuthenticated) onAuthenticated();
  };

  if (compact) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-slate-800 flex items-center space-x-1.5">
              <span>Google Workspace Authorization</span>
              {authState.isAuthenticated ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-md">Connected</span>
              ) : (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.2 rounded-md">Auth Required</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {authState.isAuthenticated ? (authState.email || 'Authorized Account') : 'No session token detected'}
            </div>
          </div>
        </div>

        <div>
          {authState.isAuthenticated ? (
            <button
              onClick={handleSignOut}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isAuthenticating ? 'animate-spin' : ''}`} />
              <span>{isAuthenticating ? 'Connecting...' : 'Authenticate'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border transition-all ${
      authState.isAuthenticated 
        ? 'bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/40 border-emerald-200/80 shadow-xs' 
        : 'bg-gradient-to-r from-amber-50/90 via-white to-rose-50/50 border-amber-200 shadow-xs'
    } p-6 space-y-4`}>
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-extrabold text-slate-900">
                Google Workspace Account Authentication
              </h3>
              {authState.isAuthenticated ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Authenticated & Ready</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>Action Required</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorizes {serviceName} to perform live operations with permission: {requiredScopesDesc}.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {authState.isAuthenticated ? (
            <>
              <button
                id="re-authenticate-google-btn"
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isAuthenticating ? 'animate-spin' : ''}`} />
                <span>{isAuthenticating ? 'Re-authorizing...' : 'Switch / Re-auth'}</span>
              </button>
              <button
                id="signout-google-btn"
                onClick={handleSignOut}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              id="authenticate-google-workspace-btn"
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="inline-flex items-center space-x-2.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition-all shadow-md hover:shadow-lg transform active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isAuthenticating ? 'Connecting to Google...' : 'Authenticate with Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Authentication Notice:</span> {errorMsg}
            </div>
          </div>
          <button
            onClick={() => setShowManualInput(true)}
            className="text-[11px] font-extrabold text-rose-700 underline hover:text-rose-900 shrink-0 cursor-pointer"
          >
            Direct Token Input
          </button>
        </div>
      )}

      {/* Account Details when Connected */}
      {authState.isAuthenticated ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-white/90 border border-slate-200/80 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Authorized Account</span>
            <span className="font-mono font-bold text-slate-900 truncate block mt-0.5">
              {authState.email || 'business@theunbound.in'}
            </span>
          </div>

          <div className="p-3 bg-white/90 border border-slate-200/80 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">OAuth Bearer Token</span>
            <span className="font-mono text-emerald-700 font-bold block mt-0.5 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
              <span>Active in Memory ({authState.accessToken ? `${authState.accessToken.slice(0, 10)}...` : 'Session Active'})</span>
            </span>
          </div>

          <div className="p-3 bg-white/90 border border-slate-200/80 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Workspace Scopes</span>
            <span className="text-slate-700 font-medium block mt-0.5 truncate" title="Gmail, Calendar, Tasks, Sheets">
              Gmail (Send/Read), Calendar, Tasks, Sheets
            </span>
          </div>
        </div>
      ) : (
        /* Callout when not connected */
        <div className="p-4 bg-white/90 border border-amber-200/80 rounded-2xl space-y-3 text-xs">
          <div className="flex items-center justify-between text-slate-700 font-medium">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                To send booking confirmation emails and sync calendar events with Google, authorize your Google Workspace account above.
              </span>
            </div>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer shrink-0 ml-2"
            >
              <span>Developer / Manual Token</span>
              {showManualInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Quick Demo Connect Shortcut */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              In preview sandbox? You can also activate an instant session token for full dispatch simulation:
            </span>
            <button
              onClick={handleQuickDemoConnect}
              className="text-[11px] font-extrabold text-[#008972] hover:text-[#00705e] bg-teal-50 hover:bg-teal-100 px-3 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Instant Session Connect (Simulated)
            </button>
          </div>
        </div>
      )}

      {/* Manual / Direct Token Collapsible Input */}
      {showManualInput && (
        <form onSubmit={handleManualSubmit} className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 text-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-teal-400 flex items-center space-x-1.5 text-[11px]">
              <Key className="w-3.5 h-3.5" />
              <span>Direct OAuth Access Token Injection</span>
            </span>
            <button
              type="button"
              onClick={() => setShowManualInput(false)}
              className="text-slate-400 hover:text-white text-[11px]"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-slate-400 mb-1">Google OAuth Access Token (ya29...)</label>
              <input
                type="text"
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                placeholder="ya29.a0AfH6SM..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-white focus:outline-none focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Account Email</label>
              <input
                type="email"
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
                placeholder="business@theunbound.in"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-white focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Apply Access Token
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
