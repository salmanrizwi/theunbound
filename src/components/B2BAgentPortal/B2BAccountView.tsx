import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  Image, 
  DollarSign,
  Palette,
  AlertCircle,
  Landmark,
  Plus,
  Trash2,
  Edit3,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import {
  isTheUnboundBrandString,
  validateWhiteLabelReadiness
} from '../../services/quotePresentationModel';
import { cashbackService } from '../../services/cashbackService';
import { validateBankAccountInput } from '../../services/cashbackEngine';
import { AppDatabase } from '../../services/db';
import { UserBankAccount } from '../../types';

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
      quoteFooterText: proposalFooter.trim()
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  // Synchronized Cashback Bank Account Management
  const [bankRefreshTick, setBankRefreshTick] = useState(0);
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankHolderName, setBankHolderName] = useState(user?.name || '');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'SAVINGS' | 'CURRENT'>('CURRENT');
  const [ifscCode, setIfscCode] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [iban, setIban] = useState('');
  const [bankCountry, setBankCountry] = useState('India');
  const [bankCurrency, setBankCurrency] = useState('INR');
  const [isDefaultBank, setIsDefaultBank] = useState(true);
  const [bankStatusMsg, setBankStatusMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const db = AppDatabase.getInstance();
    return db.subscribeToCollections([
      'user_bank_accounts',
      'user_cashback_configs',
      'cashback_wallets',
      'system_users',
      'companies'
    ], () => setBankRefreshTick(t => t + 1));
  }, []);

  const bankAccounts = useMemo<UserBankAccount[]>(() => {
    if (!user?.id) return [];
    return cashbackService.getBankAccountsForUser(user.id, true);
  }, [user?.id, bankRefreshTick]);

  const resetBankForm = () => {
    setEditingBankId(null);
    setBankHolderName(user?.name || '');
    setBankName('');
    setBranchName('');
    setAccountNumber('');
    setAccountType('CURRENT');
    setIfscCode('');
    setSwiftCode('');
    setIban('');
    setBankCountry('India');
    setBankCurrency('INR');
    setIsDefaultBank(bankAccounts.length === 0);
  };

  const handleEditBank = (acc: UserBankAccount) => {
    setEditingBankId(acc.id);
    setBankHolderName(acc.accountHolderName);
    setBankName(acc.bankName);
    setBranchName(acc.branchName || '');
    setAccountNumber('');
    setAccountType(acc.accountType || 'CURRENT');
    setIfscCode(acc.ifscCode || '');
    setSwiftCode(acc.swiftCode || '');
    setIban(acc.iban || '');
    setBankCountry(acc.country || 'India');
    setBankCurrency(acc.currency || 'INR');
    setIsDefaultBank(acc.isDefault);
    setBankStatusMsg(null);
    setShowBankForm(true);
  };

  const handleSaveBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBankStatusMsg(null);
    const check = validateBankAccountInput({
      accountHolderName: bankHolderName,
      bankName,
      accountNumber,
      ifscCode,
      swiftCode,
      iban,
      country: bankCountry
    });
    if (!check.valid) {
      setBankStatusMsg({ kind: 'error', text: check.errors.join(' ') });
      return;
    }
    try {
      cashbackService.saveBankAccount({
        id: editingBankId || undefined,
        userId: user.id,
        accountHolderName: bankHolderName,
        bankName,
        branchName,
        accountNumber,
        accountType,
        ifscCode,
        swiftCode,
        iban,
        country: bankCountry,
        currency: bankCurrency,
        isDefault: isDefaultBank,
        actor: user
      });
      setBankStatusMsg({ kind: 'success', text: editingBankId ? 'Bank account updated securely.' : 'Bank account added securely.' });
      setShowBankForm(false);
      resetBankForm();
      setBankRefreshTick(t => t + 1);
    } catch (err: any) {
      setBankStatusMsg({ kind: 'error', text: err?.message || 'Unable to save bank account.' });
    }
  };

  const handleDeleteBank = (id: string) => {
    if (!user) return;
    try {
      cashbackService.deleteBankAccount({ bankAccountId: id, userId: user.id, actor: user });
      setBankStatusMsg({ kind: 'success', text: 'Bank account removed.' });
      setBankRefreshTick(t => t + 1);
    } catch (err: any) {
      setBankStatusMsg({ kind: 'error', text: err?.message || 'Unable to remove bank account.' });
    }
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
            {/* Card 2: Working Currency Preferences */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-5 shadow-xs">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <DollarSign className="w-4 h-4 text-[#00C6A6]" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Working Currency Preferences</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Preferred Quotation Currency</label>
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
                  <label className="font-bold text-slate-700 block mb-1">Authorized White-Label Commercial Quotation Terms</label>
                  <textarea
                    rows={3}
                    value={proposalDisclaimer}
                    onChange={(e) => setProposalDisclaimer(e.target.value)}
                    placeholder="1. Booking Status: No services or reservations are currently on hold or confirmed. All arrangements are subject to availability at the time of booking."
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

      {/* Cashback Payout Bank Account Details (Synced with My Cashback Wallet) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <Landmark className="w-4 h-4 text-[#00C6A6]" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Cashback Payout Bank Account Details</h2>
              <p className="text-xs text-slate-500">
                Manage payout destinations used for Cashback & Rewards Wallet withdrawals. Account numbers are masked for security.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              resetBankForm();
              setBankStatusMsg(null);
              setShowBankForm(!showBankForm);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            {showBankForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{showBankForm ? 'Close Form' : 'Add Bank Account'}</span>
          </button>
        </div>

        {bankStatusMsg && (
          <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            bankStatusMsg.kind === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{bankStatusMsg.text}</span>
          </div>
        )}

        {showBankForm && (
          <form onSubmit={handleSaveBankAccount} className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-4 text-xs">
            <div className="font-bold text-slate-900 text-sm">
              {editingBankId ? 'Update Bank Account Details (Re-enter full account number to verify)' : 'Register Payout Bank Account'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Holder Name *</label>
                <input
                  type="text"
                  required
                  value={bankHolderName}
                  onChange={(e) => setBankHolderName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Branch Name</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Number *</label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="6-24 digits"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono outline-none focus:border-[#00C6A6]"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">IFSC Code (India)</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono uppercase outline-none focus:border-[#00C6A6]"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">SWIFT / IBAN (International)</label>
                <input
                  type="text"
                  value={swiftCode || iban}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    if (val.length > 14) { setIban(val); setSwiftCode(''); } else { setSwiftCode(val); }
                  }}
                  placeholder="Optional SWIFT or IBAN"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono uppercase outline-none focus:border-[#00C6A6]"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Type</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as 'SAVINGS' | 'CURRENT')}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                >
                  <option value="CURRENT">Current</option>
                  <option value="SAVINGS">Savings</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Country</label>
                <input
                  type="text"
                  value={bankCountry}
                  onChange={(e) => setBankCountry(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Currency</label>
                <input
                  type="text"
                  value={bankCurrency}
                  onChange={(e) => setBankCurrency(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono uppercase outline-none focus:border-[#00C6A6]"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefaultBank}
                  onChange={(e) => setIsDefaultBank(e.target.checked)}
                  className="rounded border-slate-300 text-[#008972] focus:ring-[#00C6A6]"
                />
                <span>Set as default withdrawal payout account</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 font-bold cursor-pointer"
              >
                {editingBankId ? 'Update Bank Account' : 'Save Bank Account'}
              </button>
            </div>
          </form>
        )}

        {bankAccounts.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
            No payout bank accounts saved yet. Add a bank account above to enable Cashback withdrawal requests.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{acc.bankName}</span>
                      {acc.isDefault && (
                        <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[#008972] text-[10px] font-bold">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{acc.accountHolderName}</div>
                    <div className="text-xs font-mono text-slate-900 font-semibold mt-1 tabular-nums">
                      {acc.accountNumberMasked}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {acc.ifscCode ? `IFSC: ${acc.ifscCode}` : acc.swiftCode ? `SWIFT: ${acc.swiftCode}` : acc.iban ? `IBAN: ${acc.iban}` : ''} • {acc.currency}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditBank(acc)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                      title="Edit Bank Account"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBank(acc.id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete Bank Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
