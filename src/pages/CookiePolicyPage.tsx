import React from 'react';
import { 
  Cookie, 
  ShieldCheck, 
  Settings, 
  Lock, 
  Database, 
  Sliders, 
  HelpCircle,
  Building2,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export const CookiePolicyPage: React.FC = () => {
  const handleOpenPreferences = () => {
    window.dispatchEvent(new CustomEvent('theunbound_open_cookie_preferences'));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <Cookie className="w-3.5 h-3.5" />
            <span>Compliance with GDPR, UK PECR & India DPDP Act 2023</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight text-white">
            Cookie & Local Storage Policy
          </h1>

          <p className="text-xs sm:text-sm text-slate-300">
            Effective Date: August 2026 • Legal Entity: Unbound Experiences India Pvt Ltd
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        {/* Intro */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#008972]" />
            <span>1. Overview & Purpose</span>
          </h2>
          <p>
            This Cookie Policy explains how <strong className="text-slate-900">Unbound Experiences India Pvt Ltd</strong> ("TheUnbound", "we", "us", or "our"), incorporated in New Delhi, India, utilizes cookies, local storage, session storage, and similar web technologies across our Destination Management Company (DMC) web portal.
          </p>
          <p>
            We believe in complete transparency. We strictly prohibit invasive cross-site tracking, third-party advertising networks, and data broker syndication.
          </p>
        </section>

        {/* Quick Action Button */}
        <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/70 border border-teal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-[#008972]" />
              <span>Manage Your Current Consent Settings</span>
            </h3>
            <p className="text-xs text-slate-600">
              You can adjust or revoke your consent for non-essential cookies and functional storage at any time.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenPreferences}
            className="px-5 py-2.5 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            Customize Cookie Settings
          </button>
        </div>

        {/* Categories of Cookies */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Database className="w-5 h-5 text-[#008972]" />
            <span>2. Categories of Storage & Cookies in Use</span>
          </h2>
          <p>
            We classify all web storage technologies into three clearly defined tiers:
          </p>

          <div className="space-y-4 pt-1">
            {/* Tier 1 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  Tier 1: Strictly Necessary (Essential)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Always Active
                </span>
              </div>
              <p className="text-xs text-slate-600">
                These are strictly required for the technical operation, authentication, and security of the portal. Under GDPR (Article 6(1)(f)) and PECR Regulation 6(4)(b), user consent is not required for strictly necessary cookies because the service cannot function without them.
              </p>
              <div className="overflow-x-auto pt-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-800 font-bold border-b border-slate-200">
                      <th className="p-2">Identifier / Key</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Duration</th>
                      <th className="p-2">Operational Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="p-2 font-mono font-semibold text-slate-900">theunbound_auth_user</td>
                      <td className="p-2">Local Storage</td>
                      <td className="p-2">Persistent until logout</td>
                      <td className="p-2">Maintains authenticated B2B agent/buyer session tokens securely.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-semibold text-slate-900">theunbound_cookie_consent</td>
                      <td className="p-2">Local Storage</td>
                      <td className="p-2">12 Months</td>
                      <td className="p-2">Stores your cookie consent choices so the banner is not repeatedly displayed.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-semibold text-slate-900">Firebase Auth Tokens</td>
                      <td className="p-2">IndexedDB / Session</td>
                      <td className="p-2">Session / Token lifecycle</td>
                      <td className="p-2">Validates secure API calls to our Google Cloud Firestore cluster.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tier 2 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  Tier 2: Functional & Customization Storage
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-[#008972] border border-teal-200">
                  Optional (Consent-Based)
                </span>
              </div>
              <p className="text-xs text-slate-600">
                These enhance usability by remembering your configuration, chosen billing currency, and active itinerary builder drafts.
              </p>
              <div className="overflow-x-auto pt-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-800 font-bold border-b border-slate-200">
                      <th className="p-2">Identifier / Key</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Duration</th>
                      <th className="p-2">Operational Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="p-2 font-mono font-semibold text-slate-900">theunbound_currency</td>
                      <td className="p-2">Local Storage</td>
                      <td className="p-2">Persistent until reset</td>
                      <td className="p-2">Preserves preferred display currency (USD, JPY, GBP, EUR, INR).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-semibold text-slate-900">theunbound_quotation_v2</td>
                      <td className="p-2">Local Storage</td>
                      <td className="p-2">Persistent until cleared</td>
                      <td className="p-2">Retains draft quotation builder items between page reloads so your work is not lost.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  Tier 3: Operational Telemetry & Performance Analytics
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                  Optional (Consent-Based)
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Measures portal response speed, FX engine calculation latency, and client-side error handling to diagnose operational issues. We do not use third-party analytics trackers (such as Google Analytics or Meta Pixel) that profile user behavior across other websites.
              </p>
            </div>
          </div>
        </section>

        {/* Third Party Verification */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#008972]" />
            <span>3. No Third-Party Advertising Trackers</span>
          </h2>
          <p>
            TheUnbound enforces a strict privacy policy:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong className="text-slate-900">No Advertising Pixels:</strong> We do not deploy Meta Pixel, TikTok Pixel, LinkedIn Insight Tag, or third-party behavioral ad trackers.</li>
            <li><strong className="text-slate-900">No Cross-Site Profiling:</strong> We do not sell or share browsing activity with data brokers.</li>
            <li><strong className="text-slate-900">First-Party Only:</strong> All quotation calculation and itinerary operations run entirely on our secure backend and first-party domain.</li>
          </ul>
        </section>

        {/* Browser Controls */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Lock className="w-5 h-5 text-[#008972]" />
            <span>4. Managing Cookies via Your Web Browser</span>
          </h2>
          <p>
            In addition to our built-in Consent Manager, you can restrict or block cookies through your browser settings:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong className="text-slate-900">Google Chrome:</strong> Settings &gt; Privacy and security &gt; Third-party cookies.</li>
            <li><strong className="text-slate-900">Apple Safari:</strong> Preferences &gt; Privacy &gt; Prevent cross-site tracking.</li>
            <li><strong className="text-slate-900">Mozilla Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Enhanced Tracking Protection.</li>
            <li><strong className="text-slate-900">Microsoft Edge:</strong> Settings &gt; Cookies and site permissions &gt; Manage and delete cookies.</li>
          </ul>
          <p className="text-xs text-slate-500 pt-1">
            Note: Disabling strictly necessary cookies may degrade core functionality, such as preventing secure B2B agent sign-in or itinerary calculation.
          </p>
        </section>

        {/* Contact info footer */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
          <p className="font-bold text-slate-700">Privacy Compliance & Inquiries:</p>
          <p>
            Unbound Experiences India Pvt Ltd • Address: A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India • Corporate Email: <a href="mailto:business@theunbound.in" className="text-[#008972] font-semibold underline">business@theunbound.in</a> • Operations Desk: <a href="mailto:sales@theunbound.in" className="text-[#008972] font-semibold underline">sales@theunbound.in</a>
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Entity Identification: [CORPORATE_IDENTIFICATION_NUMBER_CIN] • Tax ID: [GSTIN]
          </p>
        </div>
      </div>
    </div>
  );
};
