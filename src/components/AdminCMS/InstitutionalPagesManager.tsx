import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { SitePagesConfig } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, 
  FileText, 
  ShieldCheck, 
  RefreshCw, 
  Save, 
  CheckCircle2, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Megaphone,
  HelpCircle,
  Sparkles
} from 'lucide-react';

export const InstitutionalPagesManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [config, setConfig] = useState<SitePagesConfig>(() => db.getSitePagesConfig());
  const [activeTab, setActiveTab] = useState<'CONTACT' | 'TERMS' | 'REFUND' | 'PRIVACY' | 'B2B_PORTAL'>('CONTACT');
  const [saveNotice, setSaveNotice] = useState(false);

  useEffect(() => {
    return db.subscribe(() => {
      setConfig(db.getSitePagesConfig());
    });
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateSitePagesConfig(config, user);
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Institutional & Legal Pages Control</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 font-sans">
            Page Management: Contact, Policies & Partner Portal
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Directly modify contact numbers, emails, registered address, 24–48h SLA terms, B2B wholesale policies, refund rules, and B2B portal announcements across the entire website.
          </p>
        </div>

        {saveNotice && (
          <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Changes published instantly!</span>
          </div>
        )}
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {[
          { id: 'CONTACT', label: 'Contact Us & Hotlines', icon: Phone },
          { id: 'TERMS', label: 'Terms & Conditions', icon: FileText },
          { id: 'REFUND', label: 'Refund & Cancellation', icon: RefreshCw },
          { id: 'PRIVACY', label: 'Privacy & Data Policy', icon: ShieldCheck },
          { id: 'B2B_PORTAL', label: 'B2B Partner Header', icon: Megaphone }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00E5C0]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form Area */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        {/* CONTACT US TAB */}
        {activeTab === 'CONTACT' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Contact Us Page Channels & Headquarters</h3>
              <p className="text-xs text-slate-500">Controls information displayed on `/contact-us` and global footers.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Hero Section Heading</label>
                <input
                  type="text"
                  value={config.contactPage.heroTitle}
                  onChange={(e) => setConfig({
                    ...config,
                    contactPage: { ...config.contactPage, heroTitle: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Hero Section Subtitle / Introduction</label>
                <textarea
                  rows={2}
                  value={config.contactPage.heroSubtitle}
                  onChange={(e) => setConfig({
                    ...config,
                    contactPage: { ...config.contactPage, heroSubtitle: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Registered Office Address</label>
                <input
                  type="text"
                  value={config.contactPage.officeAddress}
                  onChange={(e) => setConfig({
                    ...config,
                    contactPage: { ...config.contactPage, officeAddress: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Sales & Inquiries Email</label>
                <input
                  type="email"
                  value={config.contactPage.salesEmail}
                  onChange={(e) => setConfig({
                    ...config,
                    contactPage: { ...config.contactPage, salesEmail: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Operations & Logistics Email</label>
                <input
                  type="email"
                  value={config.contactPage.opsEmail}
                  onChange={(e) => setConfig({
                    ...config,
                    contactPage: { ...config.contactPage, opsEmail: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Primary Phone Number</label>
                <input
                  type="text"
                  value={config.contactPage.phone}
                  onChange={(e) => setConfig({
                    ...config,
                    contactPage: { ...config.contactPage, phone: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">WhatsApp Dispatch Number</label>
                <input
                  type="text"
                  value={config.contactPage.whatsappNumber}
                  onChange={(e) => setConfig({
                    ...config,
                    contactPage: { ...config.contactPage, whatsappNumber: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">Operational & Support Hours</label>
                <input
                  type="text"
                  value={config.contactPage.supportHours}
                  onChange={(e) => setConfig({
                    ...config,
                    contactPage: { ...config.contactPage, supportHours: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>
        )}

        {/* TERMS TAB */}
        {activeTab === 'TERMS' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Terms of Service & B2B Rules</h3>
              <p className="text-xs text-slate-500">Controls information displayed on `/terms-of-service` and quotation footer disclaimers.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Page Title</label>
                <input
                  type="text"
                  value={config.termsPage.title}
                  onChange={(e) => setConfig({
                    ...config,
                    termsPage: { ...config.termsPage, title: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">B2B Wholesale Protected Tariffs Clause</label>
                <textarea
                  rows={3}
                  value={config.termsPage.b2bWholesaleTerms}
                  onChange={(e) => setConfig({
                    ...config,
                    termsPage: { ...config.termsPage, b2bWholesaleTerms: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">24–48h SLA Ground Confirmation Guarantee Clause</label>
                <textarea
                  rows={3}
                  value={config.termsPage.cancellationSlaNotice}
                  onChange={(e) => setConfig({
                    ...config,
                    termsPage: { ...config.termsPage, cancellationSlaNotice: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">General Terms Summary Snippet</label>
                <textarea
                  rows={3}
                  value={config.termsPage.generalTermsSnippet}
                  onChange={(e) => setConfig({
                    ...config,
                    termsPage: { ...config.termsPage, generalTermsSnippet: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>
        )}

        {/* REFUND TAB */}
        {activeTab === 'REFUND' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Cancellation & Refund Policies</h3>
              <p className="text-xs text-slate-500">Controls rules on `/refund-policy` and client cancellation calculations.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Page Title</label>
                  <input
                    type="text"
                    value={config.refundPage.title}
                    onChange={(e) => setConfig({
                      ...config,
                      refundPage: { ...config.refundPage, title: e.target.value }
                    })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Refund Processing Timeline (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={config.refundPage.processingTimeDays}
                    onChange={(e) => setConfig({
                      ...config,
                      refundPage: { ...config.refundPage, processingTimeDays: Number(e.target.value) || 7 }
                    })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Standard Cancellation & Refund Rules</label>
                <textarea
                  rows={3}
                  value={config.refundPage.refundConditionsSnippet}
                  onChange={(e) => setConfig({
                    ...config,
                    refundPage: { ...config.refundPage, refundConditionsSnippet: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Force Majeure & Weather Disruption Clause</label>
                <textarea
                  rows={3}
                  value={config.refundPage.forceMajeurePolicy}
                  onChange={(e) => setConfig({
                    ...config,
                    refundPage: { ...config.refundPage, forceMajeurePolicy: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>
        )}

        {/* PRIVACY TAB */}
        {activeTab === 'PRIVACY' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Privacy & Data Protection Notice</h3>
              <p className="text-xs text-slate-500">Controls data policy displayed on `/privacy-policy`.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Data Controller Official Contact Email</label>
                <input
                  type="email"
                  value={config.privacyPage.dataControllerEmail}
                  onChange={(e) => setConfig({
                    ...config,
                    privacyPage: { ...config.privacyPage, dataControllerEmail: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">GDPR & Traveler Data Handling Snippet</label>
                <textarea
                  rows={4}
                  value={config.privacyPage.gdprNoticeSnippet}
                  onChange={(e) => setConfig({
                    ...config,
                    privacyPage: { ...config.privacyPage, gdprNoticeSnippet: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>
        )}

        {/* B2B PORTAL TAB */}
        {activeTab === 'B2B_PORTAL' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">B2B Agent Workspace Announcement & Banner</h3>
              <p className="text-xs text-slate-500">Controls announcement broadcast banner displayed on `/b2b-builder` and Agent portal.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="b2b-announce-active"
                  checked={config.b2bPortal.isAnnouncementActive}
                  onChange={(e) => setConfig({
                    ...config,
                    b2bPortal: { ...config.b2bPortal, isAnnouncementActive: e.target.checked }
                  })}
                  className="w-4 h-4 text-[#008972] rounded focus:ring-[#00C6A6]"
                />
                <label htmlFor="b2b-announce-active" className="text-xs font-bold text-slate-900 cursor-pointer">
                  Display Top Announcement Banner in B2B Quotation Builder
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Announcement Banner Text</label>
                <input
                  type="text"
                  value={config.b2bPortal.announcementBanner}
                  onChange={(e) => setConfig({
                    ...config,
                    b2bPortal: { ...config.b2bPortal, announcementBanner: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Contract Tariff Sheet Notice</label>
                <textarea
                  rows={2}
                  value={config.b2bPortal.contractDownloadNotice}
                  onChange={(e) => setConfig({
                    ...config,
                    b2bPortal: { ...config.b2bPortal, contractDownloadNotice: e.target.value }
                  })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="submit"
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 cursor-pointer shadow-md"
          >
            <Save className="w-4 h-4 text-[#00E5C0]" />
            <span>Save & Publish Live Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
