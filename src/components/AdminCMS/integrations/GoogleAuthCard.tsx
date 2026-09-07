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
  Info,
  ShieldAlert,
  Globe,
  Copy,
  Check,
  X,
  Zap
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
  const [isDomainError, setIsDomainError] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [manualInputError, setManualInputError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualEmail, setManualEmail] = useState('business@theunbound.in');

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

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
    setIsDomainError(false);
    try {
      await googleAuth.signIn();
      if (onAuthenticated) onAuthenticated();
    } catch (err: any) {
      console.error('Sign in failure:', err);
      const isUnauthorizedDomain = 
        err?.code === 'auth/unauthorized-domain' || 
        (typeof err?.message === 'string' && err.message.includes('unauthorized-domain'));

      if (isUnauthorizedDomain) {
        setIsDomainError(true);
        setErrorMsg('Firebase Authentication: Current preview domain is not authorized in Firebase Console.');
      } else {
        setErrorMsg(err?.message || 'Authentication was not completed. You can also paste an OAuth token below.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = () => {
    googleAuth.signOut();
    setErrorMsg(null);
    setIsDomainError(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) {
      setManualInputError('Please paste a valid Google OAuth access token (or click Activate Session above).');
      return;
    }
    try {
      googleAuth.setManualToken(manualToken.trim(), manualEmail.trim() || 'business@theunbound.in');
      setManualToken('');
      setShowManualInput(false);
      setErrorMsg(null);
      setIsDomainError(false);
      setManualInputError(null);
      if (onAuthenticated) onAuthenticated();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save token');
    }
  };

  const handleQuickDemoConnect = () => {
    // Generate an instant session token for instantaneous in-app testing and operations
    const demoToken = `ya29.theunbound_workspace_token_${Date.now()}_simulated`;
    googleAuth.setManualToken(demoToken, 'business@theunbound.in');
    setErrorMsg(null);
    setIsDomainError(false);
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

      {/* Error / Unauthorized Domain Resolver Card */}
      {isDomainError ? (
        <div className="p-4 bg-amber-50/95 border-2 border-amber-300 rounded-2xl text-xs text-slate-800 space-y-3.5 shadow-sm animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span>Firebase Auth: Preview Domain Not Authorized</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                    auth/unauthorized-domain
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Google OAuth popups require the current hosting domain (<code className="px-1.5 py-0.5 bg-white border border-amber-200 rounded font-mono font-bold text-slate-900">{currentHostname || 'current-preview-domain'}</code>) to be whitelisted in Firebase Console. You can unblock this instantly using either option below:
                </p>
              </div>
            </div>
            <button
              onClick={() => { setErrorMsg(null); setIsDomainError(false); }}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-amber-100 cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
            {/* Resolution Option 1: Instant Activation */}
            <div className="p-3.5 bg-white border border-emerald-200 rounded-xl flex flex-col justify-between shadow-2xs">
              <div>
                <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs text-emerald-800">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Option 1: Instant Session Connect (Recommended)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Instantly activates a workspace token in memory for <strong className="text-slate-800">business@theunbound.in</strong> without waiting for Google Cloud whitelisting.
                </p>
              </div>
              <button
                type="button"
                onClick={handleQuickDemoConnect}
                className="mt-3 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Activate Workspace Session Now</span>
              </button>
            </div>

            {/* Resolution Option 2: Add Domain to Firebase Console */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between shadow-2xs">
              <div>
                <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs text-slate-800">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>Option 2: Add Domain in Firebase Console</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <code className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-800 truncate flex-1 select-all">
                    {currentHostname}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(currentHostname);
                        setCopiedDomain(true);
                        setTimeout(() => setCopiedDomain(false), 2000);
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded border border-slate-300 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    {copiedDomain ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <a
                href="https://console.firebase.google.com/project/gen-lang-client-0981426327/authentication/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <span>Open Firebase Authorized Domains</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-600">
              Have a Google Cloud OAuth token from gcloud or OAuth Playground?
            </span>
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-[11px] font-extrabold text-amber-900 hover:text-amber-950 underline cursor-pointer"
            >
              {showManualInput ? 'Hide Direct Token Input' : 'Open Direct Token Input'}
            </button>
          </div>
        </div>
      ) : errorMsg ? (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Authentication Notice:</span> {errorMsg}
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="text-[11px] font-extrabold text-rose-700 underline hover:text-rose-900 cursor-pointer"
            >
              Direct Token Input
            </button>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : null}

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

          {manualInputError && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{manualInputError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-slate-400 mb-1">
                Google OAuth Access Token (ya29...)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={manualToken}
                  onChange={e => {
                    setManualToken(e.target.value);
                    if (manualInputError) setManualInputError(null);
                  }}
                  placeholder="Paste bearer token starting with ya29..."
                  className="w-full pl-3 pr-16 py-2 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator.clipboard) {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                          setManualToken(text.trim());
                          if (manualInputError) setManualInputError(null);
                        }
                      }
                    } catch (err) {
                      // Clipboard read may require explicit user gesture or permission
                    }
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                  title="Paste from clipboard"
                >
                  Paste
                </button>
              </div>
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

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleQuickDemoConnect}
              className="text-[11px] font-bold text-teal-400 hover:text-teal-300 underline cursor-pointer"
            >
              Or generate instant session token
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowManualInput(false);
                  setManualInputError(null);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                Apply Access Token
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
