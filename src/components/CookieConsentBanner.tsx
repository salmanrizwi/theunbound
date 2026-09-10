import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, Settings, X, Check, ArrowRight } from 'lucide-react';

export interface CookiePreferences {
  strictlyNecessary: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  timestamp: string;
}

const STORAGE_KEY = 'theunbound_cookie_consent';

export function getStoredCookiePreferences(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function saveCookiePreferences(prefs: CookiePreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('theunbound_cookie_consent_updated', { detail: prefs }));
  } catch (err) {
    console.error('Failed to save cookie preferences', err);
  }
}

interface CookieConsentBannerProps {
  onNavigateToCookiePolicy?: () => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  onNavigateToCookiePolicy
}) => {
  const [hasConsent, setHasConsent] = useState<boolean>(true); // Default true to avoid layout flicker
  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);
  const [functionalEnabled, setFunctionalEnabled] = useState<boolean>(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(false);

  useEffect(() => {
    const stored = getStoredCookiePreferences();
    if (!stored) {
      setHasConsent(false);
    } else {
      setFunctionalEnabled(stored.functional);
      setAnalyticsEnabled(stored.analytics);
    }

    const handleReopen = () => {
      const current = getStoredCookiePreferences();
      if (current) {
        setFunctionalEnabled(current.functional);
        setAnalyticsEnabled(current.analytics);
      }
      setIsCustomizeOpen(true);
      setHasConsent(false);
    };

    window.addEventListener('theunbound_open_cookie_preferences', handleReopen);
    return () => {
      window.removeEventListener('theunbound_open_cookie_preferences', handleReopen);
    };
  }, []);

  const handleAcceptAll = () => {
    const prefs: CookiePreferences = {
      strictlyNecessary: true,
      functional: true,
      analytics: true,
      timestamp: new Date().toISOString()
    };
    saveCookiePreferences(prefs);
    setHasConsent(true);
    setIsCustomizeOpen(false);
  };

  const handleRejectNonEssential = () => {
    const prefs: CookiePreferences = {
      strictlyNecessary: true,
      functional: false,
      analytics: false,
      timestamp: new Date().toISOString()
    };
    saveCookiePreferences(prefs);
    setHasConsent(true);
    setIsCustomizeOpen(false);
  };

  const handleSavePreferences = () => {
    const prefs: CookiePreferences = {
      strictlyNecessary: true,
      functional: functionalEnabled,
      analytics: analyticsEnabled,
      timestamp: new Date().toISOString()
    };
    saveCookiePreferences(prefs);
    setHasConsent(true);
    setIsCustomizeOpen(false);
  };

  if (hasConsent && !isCustomizeOpen) return null;

  return (
    <>
      {/* Banner docked at screen bottom */}
      {!isCustomizeOpen && !hasConsent && (
        <aside
          role="region"
          aria-label="Cookie and Privacy Consent"
          className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-5 bg-slate-900/98 backdrop-blur-md border-t border-slate-800 shadow-2xl text-white transition-all animate-in slide-in-from-bottom duration-300"
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5 max-w-4xl">
              <div className="w-9 h-9 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0] shrink-0 mt-0.5">
                <Cookie className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Privacy & Cookie Preferences</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    GDPR & DPDP Act 2023 Compliant
                  </span>
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  We use strictly necessary cookies to ensure secure login, quotations, and ground operations. We also respect your right to control optional functional and performance analytics. We never sell your personal data.
                </p>
                <div className="pt-0.5 flex items-center gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={onNavigateToCookiePolicy}
                    className="text-[#00E5C0] hover:underline font-semibold cursor-pointer"
                  >
                    Read Cookie Policy
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToCookiePolicy) onNavigateToCookiePolicy();
                      window.dispatchEvent(new CustomEvent('theunbound_open_privacy_policy'));
                    }}
                    className="text-slate-300 hover:text-white underline cursor-pointer"
                  >
                    Privacy Statement
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 justify-end">
              <button
                type="button"
                id="cookie-reject-nonessential-btn"
                onClick={handleRejectNonEssential}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Reject Non-Essential
              </button>

              <button
                type="button"
                id="cookie-customize-btn"
                onClick={() => setIsCustomizeOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Customize</span>
              </button>

              <button
                type="button"
                id="cookie-accept-all-btn"
                onClick={handleAcceptAll}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-[#00C6A6] hover:bg-[#00b296] rounded-xl shadow-md transition-all cursor-pointer"
              >
                Accept All
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Granular Preference Customization Modal */}
      {isCustomizeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-preferences-title"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="inline-flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Transparent Consent Framework</span>
                </div>
                <h2 id="cookie-preferences-title" className="text-lg sm:text-xl font-bold text-slate-900">
                  Cookie & Local Storage Preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Select which categories of cookies and browser storage you permit TheUnbound to use.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomizeOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                aria-label="Close preferences"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Strictly Necessary (Locked) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">1. Strictly Necessary Cookies</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Always Active
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    aria-label="Strictly necessary cookies cannot be disabled"
                    className="w-4 h-4 rounded text-[#00C6A6] cursor-not-allowed opacity-80"
                  />
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Essential for authenticating B2B agents, dispatching live quotes, securing session integrity via Firebase Auth, and preventing CSRF attacks. Cannot be turned off.
                </p>
                <div className="text-[11px] text-slate-400 font-mono">
                  Keys: theunbound_auth_user, theunbound_cookie_consent, Firebase Auth tokens.
                </div>
              </div>

              {/* 2. Functional Preferences */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">2. Functional Preferences</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="cookie-toggle-functional"
                      checked={functionalEnabled}
                      onChange={(e) => setFunctionalEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00C6A6]"></div>
                  </label>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Remembers your chosen billing currency (USD, INR, JPY, GBP, EUR), draft itinerary items, and portal customization.
                </p>
                <div className="text-[11px] text-slate-400 font-mono">
                  Keys: theunbound_currency, theunbound_quotation_v2.
                </div>
              </div>

              {/* 3. Performance & Analytics */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">3. Performance & Operational Telemetry</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="cookie-toggle-analytics"
                      checked={analyticsEnabled}
                      onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00C6A6]"></div>
                  </label>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Gathers non-identifiable, aggregated usage data to optimize server response times, FX currency refresh speed, and ground booking workflow efficiency. No cross-site ad profiling.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-center"
              >
                Decline Optional
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  id="cookie-save-custom-btn"
                  onClick={handleSavePreferences}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-950 bg-[#00C6A6] hover:bg-[#00b296] rounded-xl transition-all shadow-md cursor-pointer text-center"
                >
                  Save My Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
