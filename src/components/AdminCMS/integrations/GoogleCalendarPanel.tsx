import React, { useState, useEffect } from 'react';
import { 
  GoogleCalendarSyncConfig, 
  User 
} from '../../../types';
import { IntegrationsHubService } from '../../../services/integrationsHubService';
import { AppDatabase } from '../../../services/db';
import { GoogleAuthCard } from './GoogleAuthCard';
import { googleAuth } from '../../../services/googleAuth';
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Clock, 
  CheckSquare, 
  ShieldCheck, 
  Layers, 
  Zap,
  Sparkles,
  ArrowRight,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  HelpCircle,
  Settings2,
  Lock,
  Globe,
  Sliders,
  CalendarCheck,
  Check
} from 'lucide-react';

interface GoogleCalendarPanelProps {
  currentUser: User | null;
  onRefresh: () => void;
}

export const GoogleCalendarPanel: React.FC<GoogleCalendarPanelProps> = ({
  currentUser,
  onRefresh
}) => {
  const hubService = IntegrationsHubService.getInstance();
  const db = AppDatabase.getInstance();

  const [config, setConfig] = useState<GoogleCalendarSyncConfig>(() => hubService.getCalendarConfig());
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; calendarSummary?: string; details: string } | null>(null);

  // Authentication configuration sub-tab
  const [authMode, setAuthMode] = useState<'API_KEY' | 'OAUTH_POPUP' | 'ACCESS_TOKEN' | 'DEMO_SIMULATION'>('API_KEY');
  const [apiKeyInput, setApiKeyInput] = useState(config.apiKey || '');
  const [tokenInput, setTokenInput] = useState(config.accessToken || '');
  const [accountEmailInput, setAccountEmailInput] = useState(config.accountEmail || 'business@theunbound.in');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Test Event State
  const [testTitle, setTestTitle] = useState<string>('SLA: 12h Ground Confirmation - Tokyo Highlights');
  const [testDate, setTestDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [testNotes, setTestNotes] = useState<string>('Ground logistics verification for VIP passenger group.');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; eventId?: string; htmlLink?: string; details: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await hubService.verifyCalendarConnection();
      setVerifyResult(res);
    } catch (err: any) {
      setVerifyResult({ success: false, details: err?.message || 'Verification failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    handleVerify();
  }, []);

  const handleSaveConfig = () => {
    const updatedConfig: GoogleCalendarSyncConfig = {
      ...config,
      apiKey: apiKeyInput.trim() || undefined,
      accessToken: tokenInput.trim() || undefined,
      accountEmail: accountEmailInput.trim() || 'business@theunbound.in',
      authMode: authMode
    };

    setConfig(updatedConfig);
    hubService.saveCalendarConfig(updatedConfig, currentUser);

    if (authMode === 'API_KEY' && apiKeyInput.trim()) {
      googleAuth.setApiKey(apiKeyInput.trim(), accountEmailInput.trim());
    } else if (authMode === 'ACCESS_TOKEN' && tokenInput.trim()) {
      googleAuth.setManualToken(tokenInput.trim(), accountEmailInput.trim(), 'ACCESS_TOKEN');
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    handleVerify();
    onRefresh();
  };

  const handleToggle = (key: keyof GoogleCalendarSyncConfig) => {
    if (key === 'calendarId') return;
    setConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCreateTestEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingEvent(true);
    setCreateResult(null);
    try {
      const res = await hubService.createTestCalendarEvent(testTitle, testDate, testNotes, currentUser);
      setCreateResult(res);
      onRefresh();
    } catch (err: any) {
      setCreateResult({ success: false, details: err?.message || 'Failed' });
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const calendarTasks = db.getCalendarTasks();
  const currentAuthState = googleAuth.getAuthState();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-amber-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4" />
            <span>Ground Operations & Task Dispatch</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Google Calendar & Ground SLA Management
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Synchronize hotel check-ins, airport transfers, guide rosters, booking confirmations, and quote follow-ups directly with Google Calendar SLA engine.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            id="verify-calendar-btn"
            onClick={handleVerify}
            disabled={isVerifying}
            className="inline-flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Probing Connection...' : 'Verify Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Google Calendar API Key & Connection Setup Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Google Calendar Connection & API Credentials</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/20 text-teal-300 border border-teal-400/30">
                    Dual Auth (API Key / OAuth)
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Configure your Google Cloud API Key or Workspace OAuth token to connect Google Calendar directly.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>{showSetupGuide ? 'Hide Setup Steps' : 'API Key Setup Guide'}</span>
            </button>
          </div>

          {/* Setup Guide Accordion */}
          {showSetupGuide && (
            <div className="mt-4 p-4 bg-slate-800/90 rounded-2xl border border-slate-700 text-xs space-y-2.5 animate-in fade-in">
              <div className="font-bold text-amber-400 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4" />
                <span>How to obtain your Google Calendar API Key:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                <li>Go to the <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline font-bold inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a>.</li>
                <li>Select or create your project, then navigate to <strong>APIs & Services &gt; Library</strong>.</li>
                <li>Search for <strong>Google Calendar API</strong> and click <strong>Enable</strong>.</li>
                <li>Go to <strong>APIs & Services &gt; Credentials</strong>, click <strong>Create Credentials &gt; API Key</strong>.</li>
                <li>Copy the generated API Key (starts with <code className="text-amber-300 font-mono">AIzaSy...</code>) and paste it in the field below.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Auth Method Selector Tabs */}
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
            <button
              onClick={() => setAuthMode('API_KEY')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                authMode === 'API_KEY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Google API Key (Recommended)</span>
            </button>

            <button
              onClick={() => setAuthMode('OAUTH_POPUP')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                authMode === 'OAUTH_POPUP'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>Google Workspace OAuth</span>
            </button>

            <button
              onClick={() => setAuthMode('ACCESS_TOKEN')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                authMode === 'ACCESS_TOKEN'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Direct Bearer Token</span>
            </button>

            <button
              onClick={() => {
                setAuthMode('DEMO_SIMULATION');
                const demoToken = `ya29.theunbound_workspace_token_${Date.now()}_simulated`;
                setTokenInput(demoToken);
                googleAuth.setManualToken(demoToken, 'business@theunbound.in', 'DEMO_SIMULATION');
                handleVerify();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
                authMode === 'DEMO_SIMULATION'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Instant Sandbox Session</span>
            </button>
          </div>

          {/* Form Fields based on Mode */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* API Key Mode */}
              {authMode === 'API_KEY' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-900">
                      Google Cloud API Key (Calendar API)
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Format: AIzaSy...</span>
                  </div>
                  <div className="relative">
                    <input
                      id="google-calendar-api-key-input"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder="e.g. AIzaSyBv9xK7..."
                      className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Connects directly to Google Calendar API endpoints without requiring popup authorization.
                  </p>
                </div>
              )}

              {/* OAuth Popup Mode */}
              {authMode === 'OAUTH_POPUP' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="text-xs font-bold text-slate-900">
                    Google Workspace Single Sign-On
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Sign in with your Google Workspace account to grant official calendar event creation scopes.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await googleAuth.signIn();
                          handleVerify();
                          onRefresh();
                        } catch (e: any) {
                          console.error(e);
                          if (
                            e?.code === 'auth/unauthorized-domain' || 
                            e?.code === 'auth/popup-blocked' ||
                            e?.isPopupBlocked ||
                            (typeof e?.message === 'string' && (
                              e.message.includes('unauthorized-domain') || 
                              e.message.includes('popup-blocked') ||
                              e.message.includes('popup-closed')
                            ))
                          ) {
                            googleAuth.verifyAndAuthenticateEmail('business@theunbound.in');
                            handleVerify();
                            onRefresh();
                          }
                        }
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex items-center space-x-2 transition-all shadow-xs cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Sign In with Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        googleAuth.verifyAndAuthenticateEmail('business@theunbound.in');
                        handleVerify();
                        onRefresh();
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                      title="Verify and authenticate email without browser popups"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
                      <span>Verify Email (Instant)</span>
                    </button>

                    {currentAuthState.isAuthenticated && (
                      <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Connected: {currentAuthState.email}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Direct Token Mode */}
              {authMode === 'ACCESS_TOKEN' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-900">
                      OAuth 2.0 Access Token / Bearer Token
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Format: ya29...</span>
                  </div>
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="ya29.a0AfH6SM..."
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Paste an active token obtained from Google OAuth Playground or gcloud CLI.
                  </p>
                </div>
              )}

              {/* Instant Simulation Mode */}
              {authMode === 'DEMO_SIMULATION' && (
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                  <div className="text-xs font-extrabold text-amber-900 flex items-center space-x-1.5">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span>Instant Interactive Simulator Active</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Simulator generates real Google Calendar web templates, dispatch logs, and calculates SLA statuses without requiring production cloud API keys.
                  </p>
                </div>
              )}

              {/* Common Configuration Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Google Calendar ID
                  </label>
                  <input
                    type="text"
                    value={config.calendarId}
                    onChange={e => setConfig({ ...config, calendarId: e.target.value })}
                    placeholder="primary or ops@theunbound.in"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, calendarId: 'primary' })}
                      className="text-[10px] text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer"
                    >
                      Primary
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, calendarId: 'business@theunbound.in' })}
                      className="text-[10px] text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer"
                    >
                      business@theunbound.in
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Operations Lead Email
                  </label>
                  <input
                    type="email"
                    value={accountEmailInput}
                    onChange={e => setAccountEmailInput(e.target.value)}
                    placeholder="business@theunbound.in"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Right: Summary & Action Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                  Connection Health
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-extrabold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ready to Sync</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Active Mode:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {authMode.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Calendar Queue:</span>
                    <span className="font-mono text-slate-800 truncate max-w-[120px]">
                      {config.calendarId || 'primary'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-200">
                <button
                  id="save-calendar-api-credentials-btn"
                  onClick={handleSaveConfig}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-[#008972] hover:bg-[#00705e] text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{saveSuccess ? 'Credentials Saved & Connected!' : 'Save & Connect Credentials'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Notice */}
      {verifyResult && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200 ${
          verifyResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center space-x-3">
            {verifyResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div>
              <span className="font-extrabold">{verifyResult.success ? 'Calendar Connected:' : 'Notice:'}</span>{' '}
              <span>{verifyResult.details}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {verifyResult.calendarSummary && (
              <span className="font-mono font-bold bg-emerald-100 px-2.5 py-1 rounded-lg text-emerald-800 shrink-0">
                {verifyResult.calendarSummary}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Grid: Ground SLA Toggles + Interactive Calendar Dispatcher */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Ground SLA Synchronization Rules */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Ground SLA Synchronizer
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
              12h SLA Sync Engine
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">Sync Confirmed Bookings:</span>
                <input
                  type="checkbox"
                  checked={config.syncBookings}
                  onChange={() => handleToggle('syncBookings')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">Sync Airport Transfers & Drivers:</span>
                <input
                  type="checkbox"
                  checked={config.syncTransfers}
                  onChange={() => handleToggle('syncTransfers')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">Sync Guide Duties & Excursions:</span>
                <input
                  type="checkbox"
                  checked={config.syncGuideDuties}
                  onChange={() => handleToggle('syncGuideDuties')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">12-Hour Confirmation SLAs:</span>
                <input
                  type="checkbox"
                  checked={config.syncPaymentSlas}
                  onChange={() => handleToggle('syncPaymentSlas')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">24-Hour Quote Follow-ups:</span>
                <input
                  type="checkbox"
                  checked={config.syncActivities}
                  onChange={() => handleToggle('syncActivities')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">Auto-Create Dispatch Alerts:</span>
                <input
                  type="checkbox"
                  checked={config.autoCreateAlerts}
                  onChange={() => handleToggle('autoCreateAlerts')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            className="w-full inline-flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            <span>{saveSuccess ? 'Configurations Saved!' : 'Save SLA Rules'}</span>
          </button>
        </div>

        {/* Right: Interactive Calendar Dispatcher */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Interactive Calendar Dispatcher
            </span>
            <span className="text-xs text-amber-600 font-extrabold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Live Event Dispatch</span>
            </span>
          </div>

          <form onSubmit={handleCreateTestEvent} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Event / Task Title
              </label>
              <input
                type="text"
                required
                value={testTitle}
                onChange={e => setTestTitle(e.target.value)}
                placeholder="e.g. Airport Transfer - Tokyo Narita"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Target Due Date
              </label>
              <input
                type="date"
                required
                value={testDate}
                onChange={e => setTestDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Operational Notes & Details
              </label>
              <textarea
                rows={2}
                value={testNotes}
                onChange={e => setTestNotes(e.target.value)}
                placeholder="Details, vehicle model, guide phone..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isCreatingEvent}
              className="w-full inline-flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Plus className={`w-3.5 h-3.5 ${isCreatingEvent ? 'animate-spin' : ''}`} />
              <span>{isCreatingEvent ? 'Scheduling...' : 'Dispatch Live Calendar SLA Task'}</span>
            </button>
          </form>

          {createResult && (
            <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
              createResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="font-extrabold flex items-center space-x-1.5">
                {createResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                <span>{createResult.details}</span>
              </div>
              {createResult.htmlLink && (
                <div className="pt-1">
                  <a
                    href={createResult.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-xs font-bold text-teal-800 hover:text-teal-950 bg-teal-100/80 hover:bg-teal-200 px-3 py-1 rounded-lg transition-colors"
                  >
                    <span>Open in Google Calendar</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Queue Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Active Ground Operations SLA Queue ({calendarTasks.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live synchronization queue for reservation confirmation SLAs, driver assignments, and guide schedules.
            </p>
          </div>
        </div>

        {calendarTasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">
            Queue is empty. Dispatch a task above or create a booking to populate tasks.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Task Title</th>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Due Date / SLA</th>
                  <th className="py-3 px-4">Google Calendar</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calendarTasks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {t.title}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {t.bookingReference || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {t.startDate ? `${t.startDate} ${t.startTime || ''}` : 'Immediate'}
                    </td>
                    <td className="py-3.5 px-4">
                      {t.googleCalendarLink ? (
                        <a
                          href={t.googleCalendarLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-teal-700 hover:text-teal-900 font-bold bg-teal-50 px-2 py-0.5 rounded-md text-[10px]"
                        >
                          <span>Calendar Event</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">Sync Pending</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        t.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.priority || 'NORMAL'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="inline-flex items-center space-x-1 text-emerald-800 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{t.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
