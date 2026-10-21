import React, { useState, useMemo } from 'react';
import { 
  Building, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  Image, 
  DollarSign,
  Palette,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import {
  isTheUnboundBrandString,
  validateWhiteLabelReadiness
} from '../../services/quotePresentationModel';

export const B2BAccountView: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const { currency, setCurrency } = useQuotation();

  const initialAgencyName = user?.agencyName || user?.companyName || '';
  const initialEmail = user?.companyEmail || (user?.email && !isTheUnboundBrandString(user.email) ? user.email : '') || '';
  const initialPhone = user?.companyPhone || user?.phone || user?.contactNumber || '';

  const [agencyName, setAgencyName] = useState(
    !isTheUnboundBrandString(initialAgencyName) ? initialAgencyName : ''
  );
  const [consultantName, setConsultantName] = useState(user?.name || '');
  const [iataNumber, setIataNumber] = useState(user?.iataOrAbtaNumber || 'IATA-91283021');
  const [contactEmail, setContactEmail] = useState(initialEmail);
  const [contactPhone, setContactPhone] = useState(
    !isTheUnboundBrandString(initialPhone) ? initialPhone : ''
  );
  const [website, setWebsite] = useState(user?.companyWebsite || '');
  const [address, setAddress] = useState(user?.companyAddress || user?.address || '');
  const [quoteTagline, setQuoteTagline] = useState(
    user?.quoteTagline || 'Official Travel Proposal & Bespoke Concierge Itinerary'
  );
  const [defaultMarkup, setDefaultMarkup] = useState(
    String(user?.customAgentMarginPercent ?? 15)
  );
  const [logoUrl, setLogoUrl] = useState(user?.brandLogoUrl || user?.logoUrl || '');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(user?.brandPrimaryColor || '#0f172a');
  const [brandAccentColor, setBrandAccentColor] = useState(user?.brandAccentColor || '#4f46e5');
  const [proposalDisclaimer, setProposalDisclaimer] = useState(
    user?.quoteDisclaimer && !isTheUnboundBrandString(user.quoteDisclaimer)
      ? user.quoteDisclaimer
      : ''
  );
  const [proposalFooter, setProposalFooter] = useState(
    user?.quoteFooterText && !isTheUnboundBrandString(user.quoteFooterText)
      ? user.quoteFooterText
      : ''
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const readiness = useMemo(() => {
    return validateWhiteLabelReadiness({
      agencyName,
      email: contactEmail,
      phone: contactPhone,
      logoUrl,
      address,
      website
    });
  }, [agencyName, contactEmail, contactPhone, logoUrl, address, website]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMarkup = parseFloat(defaultMarkup);
    updateUserProfile({
      name: consultantName.trim() || user?.name || 'Senior Travel Specialist',
      agencyName: agencyName.trim(),
      companyName: agencyName.trim(),
      iataOrAbtaNumber: iataNumber.trim(),
      companyEmail: contactEmail.trim(),
      companyPhone: contactPhone.trim(),
      phone: contactPhone.trim(),
      contactNumber: contactPhone.trim(),
      companyWebsite: website.trim(),
      companyAddress: address.trim(),
      address: address.trim(),
      quoteTagline: quoteTagline.trim(),
      brandLogoUrl: logoUrl.trim(),
      logoUrl: logoUrl.trim(),
      brandPrimaryColor,
      brandAccentColor,
      quoteDisclaimer: proposalDisclaimer.trim(),
      quoteFooterText: proposalFooter.trim(),
      customAgentMarginPercent: !isNaN(parsedMarkup) ? parsedMarkup : 15
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-[#00E5C0] text-[10px] font-bold uppercase tracking-wider">
              Verified Partner ID: {user?.id || 'AGT-9902'}
            </span>
            <span className="text-xs text-emerald-600 font-bold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authorized B2B Partner Account</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Agency Settings & White-Label Profile</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Configure your agency white-label branding, logo, colors, contact details, and authorized terms for customer-facing quotations across PDF, Email, WhatsApp, and Rich Text.
          </p>
        </div>

        <div className={`px-4 py-2.5 rounded-2xl border text-xs flex items-center space-x-2 shrink-0 ${
          readiness.isReady
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          {readiness.isReady ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold">White-Label Quote Ready</div>
                <div className="text-[10px] text-emerald-700">All mandatory agency branding fields configured</div>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <div className="font-bold">White-Label Setup Incomplete</div>
                <div className="text-[10px] text-amber-700">Required: {readiness.missingMandatoryFields.join(', ')}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Agency profile and White-Label quotation branding saved to your account. All future White-Label quotations will use these settings.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Agency Brand Details */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Building className="w-4 h-4 text-[#00C6A6]" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Agency Identity & Contact Dossier</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Registered Agency / Company Name *</label>
                <input
                  type="text"
                  required
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="e.g. Mayfair Luxury Travel Ltd"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lead Travel Specialist Name</label>
                <input
                  type="text"
                  value={consultantName}
                  onChange={(e) => setConsultantName(e.target.value)}
                  placeholder="e.g. Victoria Sterling"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">IATA / ABTA / License Number</label>
                <input
                  type="text"
                  value={iataNumber}
                  onChange={(e) => setIataNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Official Business Email *</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="concierge@youragency.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Contact Phone / WhatsApp *</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+44 20 7946 0912"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Agency Website</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.youragency.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Proposal Header Subtitle / Tagline</label>
                <input
                  type="text"
                  value={quoteTagline}
                  onChange={(e) => setQuoteTagline(e.target.value)}
                  placeholder="Bespoke Travel & Private Concierge Services"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Registered Business Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 42 Berkeley Square, Mayfair, London W1J 5AW"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Card 2: Commercial Margins & Default Currency */}
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

            {/* Card 3: White-Label Proposal Customization */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-5 shadow-xs">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Image className="w-4 h-4 text-[#00C6A6]" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">White-Label Quotation Branding</h2>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Agency Logo Image URL (Optional)</label>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://your-agency.com/logo.png"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Displayed in the header of White-Label PDF quotations, HTML Email proposals, and In-App Proposal Previews. If omitted, a clean typographic agency header is used.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 flex items-center space-x-1 mb-1">
                      <Palette className="w-3.5 h-3.5 text-slate-500" />
                      <span>Primary Brand Color</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={brandPrimaryColor}
                        onChange={(e) => setBrandPrimaryColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={brandPrimaryColor}
                        onChange={(e) => setBrandPrimaryColor(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono outline-none focus:border-[#00C6A6]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 flex items-center space-x-1 mb-1">
                      <Palette className="w-3.5 h-3.5 text-slate-500" />
                      <span>Accent Brand Color</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={brandAccentColor}
                        onChange={(e) => setBrandAccentColor(e.target.value)}
                        className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={brandAccentColor}
                        onChange={(e) => setBrandAccentColor(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono outline-none focus:border-[#00C6A6]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Authorized White-Label Commercial Terms & Disclaimer</label>
                  <textarea
                    rows={2}
                    value={proposalDisclaimer}
                    onChange={(e) => setProposalDisclaimer(e.target.value)}
                    placeholder={`This quotation is issued by ${agencyName || 'our agency'}. Rates are valid for 14 calendar days from generation date. All reservations are subject to availability upon deposit.`}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Authorized White-Label Document Footer Line</label>
                  <input
                    type="text"
                    value={proposalFooter}
                    onChange={(e) => setProposalFooter(e.target.value)}
                    placeholder={`${agencyName || 'Your Agency'} • ${contactEmail || 'concierge@agency.com'} • ${contactPhone || ''} • Official Quotation Document`}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                </div>
              </div>
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
            <span>Save Agency & White-Label Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
