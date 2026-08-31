import React, { useState } from 'react';
import { 
  Building, 
  ShieldCheck, 
  Percent, 
  Save, 
  CheckCircle2, 
  Image, 
  CreditCard, 
  Mail, 
  Phone, 
  Globe, 
  FileText,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';

export const B2BAccountView: React.FC = () => {
  const { user } = useAuth();
  const { currency, setCurrency } = useQuotation();

  const [agencyName, setAgencyName] = useState(user?.agencyName || 'Mayfair Luxury Travel Ltd');
  const [iataNumber, setIataNumber] = useState('IATA-91283021');
  const [contactEmail, setContactEmail] = useState(user?.email || 'agent@theunbound.com');
  const [contactPhone, setContactPhone] = useState('+44 20 7946 0912');
  const [website, setWebsite] = useState('https://mayfairtravel.co.uk');
  const [defaultMarkup, setDefaultMarkup] = useState('15');
  const [logoUrl, setLogoUrl] = useState('https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80');
  const [proposalFooter, setProposalFooter] = useState('Rates are fully guaranteed upon quote acceptance. Custom itineraries subject to TheUnbound Wholesale DMC Terms & Conditions.');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-[#00E5C0] text-[10px] font-bold uppercase tracking-wider">
            Verified Partner ID: AGT-9902
          </span>
          <span className="text-xs text-emerald-600 font-bold flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Tier-1 Direct Contract DMC Active</span>
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Agency Settings & White-Label Profile</h1>
        <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
          Configure your agency white-label branding, default markup margins, client proposal headers, and payment settlements.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Agency settings and proposal white-label configurations saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Agency Brand Details */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-[#00C6A6]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Agency Legal & Commercial Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Registered Agency Name *</label>
              <input
                type="text"
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">IATA / ABTA / CLIA Number</label>
              <input
                type="text"
                value={iataNumber}
                onChange={(e) => setIataNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Official Contact Email *</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
              />
            </div>
          </div>
        </div>

        {/* Card 2: White-Label Proposal Customization */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Image className="w-4 h-4 text-[#00C6A6]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Client Proposal White-Labeling</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Custom Agency Logo Image URL</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://your-domain.com/logo.png"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                This logo replaces the generic header on all client quotation documents and print PDFs.
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Custom Quotation Terms & Footer Note</label>
              <textarea
                rows={3}
                value={proposalFooter}
                onChange={(e) => setProposalFooter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Commercial Margins & Default Currency */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <DollarSign className="w-4 h-4 text-[#00C6A6]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Commercial Markup & Currency Defaults</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Agency Commission / Markup %</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Working Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6] cursor-pointer"
              >
                <option value="USD">USD ($ - United States Dollar)</option>
                <option value="GBP">GBP (£ - British Pound Sterling)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="JPY">JPY (¥ - Japanese Yen)</option>
                <option value="AUD">AUD (A$ - Australian Dollar)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Agency Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
