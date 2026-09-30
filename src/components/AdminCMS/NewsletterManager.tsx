import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { HomepageConfig, HomepageNewsletterConfig } from '../../types';
import { INITIAL_HOMEPAGE_CONFIG } from '../../data/initialHomepage';
import { useAuth } from '../../context/AuthContext';
import { 
  Mail, 
  Sparkles, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Eye, 
  ShieldCheck, 
  Layers, 
  Settings2, 
  RefreshCw,
  Sliders
} from 'lucide-react';
import { NewsletterSignup } from '../Newsletter/NewsletterSignup';

export const NewsletterManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [config, setConfig] = useState<HomepageConfig>(db.getHomepageConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'CONTENT' | 'SETTINGS' | 'PREVIEW'>('CONTENT');

  const newsletterConfig: HomepageNewsletterConfig = config.newsletterConfig || INITIAL_HOMEPAGE_CONFIG.newsletterConfig || {
    enabled: true,
    eyebrow: 'STAY INSPIRED',
    heading: 'Get Japan Travel Inspiration in Your Inbox',
    description: 'Receive destination inspiration, travel ideas, curated experiences, and updates from TheUnbound.',
    emailPlaceholder: 'Enter your email address',
    buttonText: 'Subscribe',
    privacyText: 'By subscribing, you agree to receive newsletter emails. You can unsubscribe at any time.',
    successHeading: "You're subscribed!",
    successDescription: "You'll receive our latest travel inspiration and updates in your inbox.",
    alreadySubscribedMessage: "You're already subscribed to our newsletter.",
    errorMessage: "We couldn't complete your subscription right now. Please try again.",
    sendyListId: 'NL-THEUNBOUND-2026'
  };

  useEffect(() => {
    return db.subscribe(() => {
      setConfig(db.getHomepageConfig());
    });
  }, []);

  const handleUpdateNewsletterConfig = (updates: Partial<HomepageNewsletterConfig>) => {
    const updatedNewsletter = {
      ...newsletterConfig,
      ...updates
    };
    const updatedHomepage: HomepageConfig = {
      ...config,
      newsletterConfig: updatedNewsletter,
      showNewsletterSection: updates.enabled !== undefined ? updates.enabled : config.showNewsletterSection
    };
    setConfig(updatedHomepage);
    db.updateHomepageConfig(updatedHomepage, user);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleToggleGlobalVisibility = (enabled: boolean) => {
    const updatedNewsletter = {
      ...newsletterConfig,
      enabled
    };
    const updatedHomepage: HomepageConfig = {
      ...config,
      showNewsletterSection: enabled,
      newsletterConfig: updatedNewsletter
    };
    setConfig(updatedHomepage);
    db.updateHomepageConfig(updatedHomepage, user);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset newsletter subscription configuration to recommended default settings?')) {
      const defaultNewsletter = INITIAL_HOMEPAGE_CONFIG.newsletterConfig!;
      const updatedHomepage: HomepageConfig = {
        ...config,
        showNewsletterSection: true,
        newsletterConfig: defaultNewsletter
      };
      setConfig(updatedHomepage);
      db.updateHomepageConfig(updatedHomepage, user);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center font-bold">
              <Mail className="w-5 h-5 text-[#008972]" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Homepage Newsletter Subscription (Sendy)</h2>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              config.showNewsletterSection !== false && newsletterConfig.enabled !== false
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {config.showNewsletterSection !== false && newsletterConfig.enabled !== false ? 'Active on Homepage' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Configure the public newsletter invitation on the live storefront, sync directly with the server-side Sendy API, and manage customer communications.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-[#008972]" />
              <span>Saved & Published!</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Global Master Toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-100 rounded-xl">
            <Eye className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Display Newsletter on Homepage</div>
            <div className="text-xs text-slate-500">Enable or disable the public newsletter subscription block across the live buyer storefront.</div>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.showNewsletterSection !== false && newsletterConfig.enabled !== false}
            onChange={(e) => handleToggleGlobalVisibility(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008972]"></div>
        </label>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 max-w-fit overflow-x-auto">
        {[
          { id: 'CONTENT', label: 'Copy & Messaging', icon: Layers },
          { id: 'SETTINGS', label: 'Sendy & Integration Settings', icon: Settings2 },
          { id: 'PREVIEW', label: 'Live Storefront Preview', icon: Eye }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#008972]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: COPY & MESSAGING */}
      {activeTab === 'CONTENT' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Invitation Copy */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-[#008972]" />
              <h3 className="text-sm font-bold text-slate-900">Newsletter Invitation Copy</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Eyebrow Badge Text</label>
                <input
                  type="text"
                  value={newsletterConfig.eyebrow || ''}
                  onChange={e => handleUpdateNewsletterConfig({ eyebrow: e.target.value })}
                  placeholder="STAY INSPIRED"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Main Heading</label>
                <input
                  type="text"
                  value={newsletterConfig.heading || ''}
                  onChange={e => handleUpdateNewsletterConfig({ heading: e.target.value })}
                  placeholder="Get Japan Travel Inspiration in Your Inbox"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Subheading</label>
                <textarea
                  rows={3}
                  value={newsletterConfig.description || ''}
                  onChange={e => handleUpdateNewsletterConfig({ description: e.target.value })}
                  placeholder="Receive destination inspiration, travel ideas, curated experiences, and updates from TheUnbound."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Input Placeholder</label>
                  <input
                    type="text"
                    value={newsletterConfig.emailPlaceholder || ''}
                    onChange={e => handleUpdateNewsletterConfig({ emailPlaceholder: e.target.value })}
                    placeholder="Enter your email address"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Submit Button Text</label>
                  <input
                    type="text"
                    value={newsletterConfig.buttonText || ''}
                    onChange={e => handleUpdateNewsletterConfig({ buttonText: e.target.value })}
                    placeholder="Subscribe"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Privacy & Consent Disclaimer</label>
                <textarea
                  rows={2}
                  value={newsletterConfig.privacyText || ''}
                  onChange={e => handleUpdateNewsletterConfig({ privacyText: e.target.value })}
                  placeholder="By subscribing, you agree to receive newsletter emails. You can unsubscribe at any time."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                />
              </div>
            </div>
          </div>

          {/* Response & Feedback States */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-[#008972]" />
              <h3 className="text-sm font-bold text-slate-900">Feedback & Response Messages</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Success Heading</label>
                <input
                  type="text"
                  value={newsletterConfig.successHeading || ''}
                  onChange={e => handleUpdateNewsletterConfig({ successHeading: e.target.value })}
                  placeholder="You're subscribed!"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Success Description</label>
                <textarea
                  rows={2}
                  value={newsletterConfig.successDescription || ''}
                  onChange={e => handleUpdateNewsletterConfig({ successDescription: e.target.value })}
                  placeholder="You'll receive our latest travel inspiration and updates in your inbox."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Already Subscribed Notice</label>
                <textarea
                  rows={2}
                  value={newsletterConfig.alreadySubscribedMessage || ''}
                  onChange={e => handleUpdateNewsletterConfig({ alreadySubscribedMessage: e.target.value })}
                  placeholder="You're already subscribed to our newsletter."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Error Fallback Notice</label>
                <textarea
                  rows={2}
                  value={newsletterConfig.errorMessage || ''}
                  onChange={e => handleUpdateNewsletterConfig({ errorMessage: e.target.value })}
                  placeholder="We couldn't complete your subscription right now. Please try again."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: SENDY INTEGRATION */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6 max-w-3xl">
          <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-[#008972]" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Sendy Server-Side Integration Settings</h3>
              <p className="text-xs text-slate-500">Security guarantee: Sendy API credentials remain strictly server-side.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Sendy List ID</label>
              <input
                type="text"
                value={newsletterConfig.sendyListId || ''}
                onChange={e => handleUpdateNewsletterConfig({ sendyListId: e.target.value.trim() })}
                placeholder="NL-THEUNBOUND-2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 focus:border-[#008972]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The encrypted or plain alphanumeric List ID generated inside your Sendy installation (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">NL-THEUNBOUND-2026</code> or <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">a87bc65d...</code>).
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Backend Route Active</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Requests are processed by <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">POST /api/newsletter/subscribe</code> with server-side rate limiting (10 requests/min per IP), RFC 5322 normalization, honeypot anti-spam protection, and Sendy response handling.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: PREVIEW */}
      {activeTab === 'PREVIEW' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Live Component Render</h3>
            <span className="text-xs text-slate-500 font-medium">Interactive preview with current configuration</span>
          </div>

          <div className="p-6 bg-slate-100 rounded-3xl border border-slate-200">
            <NewsletterSignup config={newsletterConfig} />
          </div>
        </div>
      )}
    </div>
  );
};
