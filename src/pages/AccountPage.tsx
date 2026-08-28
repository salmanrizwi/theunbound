import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { CurrencyCode, SUPPORTED_CURRENCIES, User, UserRole } from '../types';
import { 
  User as UserIcon, 
  Building2, 
  Camera, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Globe2, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Briefcase, 
  FileText, 
  Sparkles, 
  Save, 
  RotateCcw, 
  ExternalLink, 
  Lock, 
  Check, 
  X,
  CreditCard,
  Percent,
  Clock,
  Layers,
  Image as ImageIcon,
  BadgeCheck,
  ChevronRight
} from 'lucide-react';

const PRESET_AVATARS = [
  {
    label: 'Executive Woman (London)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'
  },
  {
    label: 'Executive Man (New York)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop'
  },
  {
    label: 'Travel Specialist (Tokyo)',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop'
  },
  {
    label: 'Senior Partner (Milan)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop'
  },
  {
    label: 'Concierge Director (Paris)',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&auto=format&fit=crop'
  },
  {
    label: 'Operations Lead (Dubai)',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=200&auto=format&fit=crop'
  },
  {
    label: 'Private Client Advisor',
    url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'
  },
  {
    label: 'Destination Manager',
    url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=200&auto=format&fit=crop'
  }
];

const BUSINESS_TYPES = [
  'Luxury Tour Operator & Wholesale Partner',
  'Retail Travel Agency / High-Street Consultant',
  'Corporate Travel Management Company (TMC)',
  'Bespoke Concierge & Private Client Office',
  'Independent Luxury Travel Designer / Host Agency',
  'Destination Management Company (DMC Affiliate)',
  'Online Travel Agency (OTA)',
  'Direct Private Traveler / Family Office'
];

interface AccountPageProps {
  onBackToExplore?: () => void;
  onNavigateToBuilder?: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  onBackToExplore,
  onNavigateToBuilder
}) => {
  const { user, updateUserProfile, role } = useAuth();
  const { currency, setCurrency } = useQuotation();

  const [activeTab, setActiveTab] = useState<'PROFILE' | 'COMPANY' | 'PREFERENCES' | 'SECURITY'>('PROFILE');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [avatarMode, setAvatarMode] = useState<'PRESETS' | 'CUSTOM_URL' | 'UPLOAD'>('PRESETS');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Profile
    name: user?.name || '',
    email: user?.email || '',
    jobTitle: user?.jobTitle || '',
    contactNumber: user?.contactNumber || '',
    avatarUrl: user?.avatarUrl || PRESET_AVATARS[0].url,
    bio: user?.bio || '',

    // Company Details
    agencyName: user?.agencyName || user?.companyName || '',
    companyName: user?.companyName || user?.agencyName || '',
    businessType: user?.businessType || BUSINESS_TYPES[0],
    companyWebsite: user?.companyWebsite || '',
    companyEmail: user?.companyEmail || user?.email || '',
    companyPhone: user?.companyPhone || user?.contactNumber || '',
    taxOrGstNumber: user?.taxOrGstNumber || '',
    iataOrAbtaNumber: user?.iataOrAbtaNumber || '',

    // Address
    companyAddress: user?.companyAddress || user?.address || '',
    companyCity: user?.companyCity || user?.city || '',
    companyState: user?.companyState || user?.state || '',
    companyPostalCode: user?.companyPostalCode || user?.postalCode || '',
    companyCountry: user?.companyCountry || user?.country || 'United Kingdom',

    // Branding & Preferences
    brandLogoUrl: user?.brandLogoUrl || '',
    primaryCurrency: (user?.primaryCurrency || currency || 'USD') as CurrencyCode,
    emergencyContactPerson: user?.emergencyContactPerson || '',
    emergencyContactPhone: user?.emergencyContactPhone || ''
  });

  // Sync state when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        jobTitle: user.jobTitle || '',
        contactNumber: user.contactNumber || '',
        avatarUrl: user.avatarUrl || PRESET_AVATARS[0].url,
        bio: user.bio || '',

        agencyName: user.agencyName || user.companyName || '',
        companyName: user.companyName || user.agencyName || '',
        businessType: user.businessType || BUSINESS_TYPES[0],
        companyWebsite: user.companyWebsite || '',
        companyEmail: user.companyEmail || user.email || '',
        companyPhone: user.companyPhone || user.contactNumber || '',
        taxOrGstNumber: user.taxOrGstNumber || '',
        iataOrAbtaNumber: user.iataOrAbtaNumber || '',

        companyAddress: user.companyAddress || user.address || '',
        companyCity: user.companyCity || user.city || '',
        companyState: user.companyState || user.state || '',
        companyPostalCode: user.companyPostalCode || user.postalCode || '',
        companyCountry: user.companyCountry || user.country || 'United Kingdom',

        brandLogoUrl: user.brandLogoUrl || '',
        primaryCurrency: (user.primaryCurrency || currency || 'USD') as CurrencyCode,
        emergencyContactPerson: user.emergencyContactPerson || '',
        emergencyContactPhone: user.emergencyContactPhone || ''
      });
      setHasUnsavedChanges(false);
    }
  }, [user]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image file size must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleInputChange('avatarUrl', event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      alert('Please enter your full name.');
      return;
    }

    setIsSaving(true);
    try {
      const updates: Partial<User> = {
        name: formData.name.trim(),
        jobTitle: formData.jobTitle.trim(),
        contactNumber: formData.contactNumber.trim(),
        avatarUrl: formData.avatarUrl,
        bio: formData.bio.trim(),

        agencyName: formData.agencyName.trim() || formData.companyName.trim(),
        companyName: formData.companyName.trim() || formData.agencyName.trim(),
        businessType: formData.businessType,
        companyWebsite: formData.companyWebsite.trim(),
        companyEmail: formData.companyEmail.trim(),
        companyPhone: formData.companyPhone.trim(),
        taxOrGstNumber: formData.taxOrGstNumber.trim(),
        iataOrAbtaNumber: formData.iataOrAbtaNumber.trim(),

        companyAddress: formData.companyAddress.trim(),
        companyCity: formData.companyCity.trim(),
        companyState: formData.companyState.trim(),
        companyPostalCode: formData.companyPostalCode.trim(),
        companyCountry: formData.companyCountry.trim(),
        country: formData.companyCountry.trim(),

        brandLogoUrl: formData.brandLogoUrl.trim(),
        primaryCurrency: formData.primaryCurrency,
        emergencyContactPerson: formData.emergencyContactPerson.trim(),
        emergencyContactPhone: formData.emergencyContactPhone.trim()
      };

      await updateUserProfile(updates);

      if (formData.primaryCurrency && formData.primaryCurrency !== currency) {
        setCurrency(formData.primaryCurrency);
      }

      setHasUnsavedChanges(false);
      setToastMessage('Account profile & company details updated successfully!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (err) {
      console.error('Failed to update user profile:', err);
      alert('An error occurred while saving profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!user) return;
    setFormData({
      name: user.name || '',
      email: user.email || '',
      jobTitle: user.jobTitle || '',
      contactNumber: user.contactNumber || '',
      avatarUrl: user.avatarUrl || PRESET_AVATARS[0].url,
      bio: user.bio || '',

      agencyName: user.agencyName || user.companyName || '',
      companyName: user.companyName || user.agencyName || '',
      businessType: user.businessType || BUSINESS_TYPES[0],
      companyWebsite: user.companyWebsite || '',
      companyEmail: user.companyEmail || user.email || '',
      companyPhone: user.companyPhone || user.contactNumber || '',
      taxOrGstNumber: user.taxOrGstNumber || '',
      iataOrAbtaNumber: user.iataOrAbtaNumber || '',

      companyAddress: user.companyAddress || user.address || '',
      companyCity: user.companyCity || user.city || '',
      companyState: user.companyState || user.state || '',
      companyPostalCode: user.companyPostalCode || user.postalCode || '',
      companyCountry: user.companyCountry || user.country || 'United Kingdom',

      brandLogoUrl: user.brandLogoUrl || '',
      primaryCurrency: (user.primaryCurrency || currency || 'USD') as CurrencyCode,
      emergencyContactPerson: user.emergencyContactPerson || '',
      emergencyContactPhone: user.emergencyContactPhone || ''
    });
    setHasUnsavedChanges(false);
  };

  const getRoleBadgeStyle = (r: UserRole) => {
    switch (r) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'TEAM_MEMBER':
      case 'DMC_STAFF':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'B2B_AGENT':
      case 'AGENT':
        return 'bg-[#00C6A6]/20 text-[#008f77] border-[#00C6A6]/40 font-bold';
      case 'BUYER':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Sign In Required</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Please log in to your TheUnbound DMC account to manage your profile picture, personal credentials, and company details.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white border border-[#00C6A6] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-[#00E5C0] shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Unsaved Changes Alert Bar */}
      {hasUnsavedChanges && (
        <div className="sticky top-20 z-30 bg-amber-50 border border-amber-300 text-amber-900 px-5 py-3 rounded-2xl shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>You have unsaved changes in your account profile.</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              className="px-3 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              Discard
            </button>
            <button
              onClick={() => handleSave()}
              disabled={isSaving}
              className="px-4 py-1 text-xs font-bold text-slate-950 bg-[#00C6A6] hover:bg-[#00b296] rounded-lg cursor-pointer transition-colors flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Header / Overview Profile Card */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00C6A6]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-teal-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar with Ring & Status Indicator */}
            <div className="relative shrink-0">
              <img
                src={formData.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                alt={formData.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover ring-4 ring-[#00C6A6]/40 shadow-xl bg-slate-800"
              />
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-5 h-5 rounded-full border-2 border-slate-950 flex items-center justify-center" title="Active Account">
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans">
                  {formData.name || 'Account User'}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${getRoleBadgeStyle(user.role)}`}>
                  {user.role}
                </span>
                {user.approvalStatus === 'APPROVED' ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <BadgeCheck className="w-3 h-3" />
                    <span>VERIFIED OPERATOR</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Clock className="w-3 h-3" />
                    <span>PENDING VERIFICATION</span>
                  </span>
                )}
              </div>

              <div className="text-slate-400 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>{formData.email}</span>
                </span>
                {(formData.companyName || formData.agencyName) && (
                  <span className="flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>{formData.companyName || formData.agencyName}</span>
                  </span>
                )}
                {formData.companyCountry && (
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>{formData.companyCountry}</span>
                  </span>
                )}
              </div>

              <p className="text-slate-400 text-xs pt-1 max-w-xl line-clamp-2">
                {formData.bio || 'Manage your destination management credentials, client quotation branding, and official company profiles across TheUnbound DMC global systems.'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              id="save-account-profile-btn"
              onClick={() => handleSave()}
              disabled={isSaving || !hasUnsavedChanges}
              className="inline-flex items-center justify-center space-x-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
            </button>

            {onNavigateToBuilder && (
              <button
                onClick={onNavigateToBuilder}
                className="inline-flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>B2B Builder</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 border-t border-slate-800/80 pt-4 mt-6 overflow-x-auto scrollbar-none">
          <button
            id="tab-account-profile"
            onClick={() => setActiveTab('PROFILE')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'PROFILE'
                ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Profile Picture & Identity</span>
          </button>

          {user.role !== 'BUYER' && (
            <>
              <button
                id="tab-account-company"
                onClick={() => setActiveTab('COMPANY')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'COMPANY'
                    ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Company & Agency Details</span>
              </button>

              <button
                id="tab-account-preferences"
                onClick={() => setActiveTab('PREFERENCES')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'PREFERENCES'
                    ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Branding & Preferences</span>
              </button>
            </>
          )}

          <button
            id="tab-account-security"
            onClick={() => setActiveTab('SECURITY')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
              activeTab === 'SECURITY'
                ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Access & Privileges</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Profile & Identity Management */}
      {activeTab === 'PROFILE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Avatar Selector Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Camera className="w-4 h-4 text-[#00C6A6]" />
                  <span>Profile Picture Management</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Avatar Studio</span>
              </div>

              {/* Current Preview */}
              <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <img
                  src={formData.avatarUrl || PRESET_AVATARS[0].url}
                  alt="Avatar Preview"
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#00C6A6] bg-white shadow-xs"
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900">Current Display Picture</p>
                  <p className="text-[11px] text-slate-500">Visible on DMC proposals, emails, and staff logs</p>
                </div>
              </div>

              {/* Avatar Source Selector Tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAvatarMode('PRESETS')}
                  className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                    avatarMode === 'PRESETS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Curated Presets
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarMode('UPLOAD')}
                  className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                    avatarMode === 'UPLOAD' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarMode('CUSTOM_URL')}
                  className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                    avatarMode === 'CUSTOM_URL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Custom URL
                </button>
              </div>

              {/* Option A: Presets Grid */}
              {avatarMode === 'PRESETS' && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Select a Professional Executive Avatar:
                  </p>
                  <div className="grid grid-cols-4 gap-3 pt-1">
                    {PRESET_AVATARS.map((avatar, idx) => {
                      const isSelected = formData.avatarUrl === avatar.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleInputChange('avatarUrl', avatar.url)}
                          className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition-all cursor-pointer group ${
                            isSelected ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/30' : 'border-slate-200 hover:border-slate-400'
                          }`}
                          title={avatar.label}
                        >
                          <img
                            src={avatar.url}
                            alt={avatar.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#00C6A6]/20 flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Option B: Upload File */}
              {avatarMode === 'UPLOAD' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-[#00C6A6] bg-slate-50 hover:bg-[#00C6A6]/5 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center mx-auto text-[#00C6A6]">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">Click to upload custom picture</p>
                    <p className="text-[10px] text-slate-400">PNG, JPG, or WEBP up to 2MB. Auto-cropped to square.</p>
                  </div>
                </div>
              )}

              {/* Option C: Custom URL */}
              {avatarMode === 'CUSTOM_URL' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Image Web Address (URL):</label>
                  <input
                    type="url"
                    value={formData.avatarUrl}
                    onChange={(e) => handleInputChange('avatarUrl', e.target.value)}
                    placeholder="https://example.com/my-photo.jpg"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Name & Identity Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <UserIcon className="w-4 h-4 text-[#00C6A6]" />
                  <span>Personal Identity & Credentials</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Contact Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="account-input-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g. Elena Rostova"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Email Address (Account ID)
                  </label>
                  <div className="relative">
                    <input
                      id="account-input-email"
                      type="email"
                      readOnly
                      value={formData.email}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 font-mono cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      VERIFIED
                    </span>
                  </div>
                </div>

                {/* Job Title / Role in Organization */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Job Title / Designation
                  </label>
                  <input
                    id="account-input-jobtitle"
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                    placeholder="e.g. Director of Luxury Travel, Senior Partner"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                  />
                </div>

                {/* Direct Phone / WhatsApp */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Direct Contact Number / WhatsApp
                  </label>
                  <input
                    id="account-input-phone"
                    type="tel"
                    value={formData.contactNumber}
                    onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                    placeholder="+44 20 7946 0912"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                  />
                </div>
              </div>

              {/* Bio & Operational Specialization */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Professional Bio & Travel Specialization
                </label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="e.g. Specializing in bespoke luxury itineraries, private rail charters, and VIP concierge services across Europe and Japan."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6] resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Member since {user.createdAt || '2026'}
                </span>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Company & Agency Details */}
      {activeTab === 'COMPANY' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#00C6A6]" />
                <span>Company & Travel Agency Credentials</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage commercial entity details, corporate registration, and official billing credentials used on wholesale invoices and ground contracts.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center space-x-1 text-xs font-bold text-[#008f77] bg-[#00C6A6]/10 px-3 py-1 rounded-lg">
              <BadgeCheck className="w-4 h-4" />
              <span>DMC Partner Profile</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Agency Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Agency / Company Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="company-input-agencyname"
                type="text"
                value={formData.agencyName}
                onChange={(e) => {
                  handleInputChange('agencyName', e.target.value);
                  handleInputChange('companyName', e.target.value);
                }}
                placeholder="e.g. Luxury Discovery Travel Partners Ltd."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
              />
            </div>

            {/* Business Model */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Business Category
              </label>
              <select
                id="company-input-businesstype"
                value={formData.businessType}
                onChange={(e) => handleInputChange('businessType', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#00C6A6] cursor-pointer"
              >
                {BUSINESS_TYPES.map((b, idx) => (
                  <option key={idx} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Official Website */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Official Company Website
              </label>
              <div className="relative">
                <input
                  id="company-input-website"
                  type="url"
                  value={formData.companyWebsite}
                  onChange={(e) => handleInputChange('companyWebsite', e.target.value)}
                  placeholder="https://www.luxurydiscovery.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                />
                {formData.companyWebsite && (
                  <a
                    href={formData.companyWebsite.startsWith('http') ? formData.companyWebsite : `https://${formData.companyWebsite}`}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-[#00C6A6]"
                    title="Open website in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Tax / GST / VAT ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Tax ID / VAT / GST Registration Number
              </label>
              <input
                id="company-input-taxid"
                type="text"
                value={formData.taxOrGstNumber}
                onChange={(e) => handleInputChange('taxOrGstNumber', e.target.value)}
                placeholder="e.g. GB 987 6543 21 / 07AAACL1234F1Z1"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
              />
            </div>

            {/* Trade Accreditations (IATA / ABTA) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                IATA / ABTA / ASTA Accreditation ID
              </label>
              <input
                id="company-input-iata"
                type="text"
                value={formData.iataOrAbtaNumber}
                onChange={(e) => handleInputChange('iataOrAbtaNumber', e.target.value)}
                placeholder="e.g. IATA 91-2 4912 0 / ABTA P7412"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
              />
            </div>

            {/* Official Billing Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Operations & Invoicing Email
              </label>
              <input
                id="company-input-email"
                type="email"
                value={formData.companyEmail}
                onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                placeholder="accounts@luxurydiscovery.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
              />
            </div>
          </div>

          {/* Registered Office Physical Address */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#00C6A6]" />
              <span>Registered Headquarters & Office Address</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Street Address</label>
                <input
                  id="company-input-address"
                  type="text"
                  value={formData.companyAddress}
                  onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                  placeholder="e.g. 45 Berkeley Square, Mayfair"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">City</label>
                <input
                  id="company-input-city"
                  type="text"
                  value={formData.companyCity}
                  onChange={(e) => handleInputChange('companyCity', e.target.value)}
                  placeholder="London"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Country</label>
                <input
                  id="company-input-country"
                  type="text"
                  value={formData.companyCountry}
                  onChange={(e) => handleInputChange('companyCountry', e.target.value)}
                  placeholder="United Kingdom"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Changes synchronize instantly to live Firestore database state.
            </span>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Details...' : 'Save Company Details'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Branding & White-Label Preferences */}
      {activeTab === 'PREFERENCES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* White Label Branding */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <ImageIcon className="w-4 h-4 text-[#00C6A6]" />
                  <span>White-Label Proposal Branding</span>
                </div>
                <span className="text-[10px] font-bold text-[#008f77] bg-[#00C6A6]/10 px-2 py-0.5 rounded">
                  PDF & Quotations
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Upload or link your agency brand logo. When generating customer-facing PDF quotations and itineraries, your logo and agency contact header will be applied automatically.
              </p>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Agency Brand Logo URL</label>
                <input
                  id="branding-input-logo"
                  type="url"
                  value={formData.brandLogoUrl}
                  onChange={(e) => handleInputChange('brandLogoUrl', e.target.value)}
                  placeholder="https://youragency.com/assets/logo.png"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                />

                {formData.brandLogoUrl ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Logo Preview</p>
                    <img
                      src={formData.brandLogoUrl}
                      alt="Brand Logo"
                      className="max-h-16 max-w-xs mx-auto object-contain bg-white p-2 rounded-lg border border-slate-200"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                    No custom brand logo attached. Defaulting to TheUnbound DMC official header.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Operational Preferences & Emergency Contact */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                  <Globe2 className="w-4 h-4 text-[#00C6A6]" />
                  <span>Currency & Emergency Ground Contacts</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Operations</span>
              </div>

              {/* Currency Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Default Pricing & Quote Currency
                </label>
                <select
                  id="preferences-input-currency"
                  value={formData.primaryCurrency}
                  onChange={(e) => handleInputChange('primaryCurrency', e.target.value as CurrencyCode)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#00C6A6] cursor-pointer"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol}) — {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  Quotations and product pricing will automatically compute in this baseline currency.
                </p>
              </div>

              {/* Emergency Contact */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-rose-500" />
                  <span>24/7 Ground Emergency Officer</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">Contact Person</label>
                    <input
                      type="text"
                      value={formData.emergencyContactPerson}
                      onChange={(e) => handleInputChange('emergencyContactPerson', e.target.value)}
                      placeholder="e.g. Marcus Operations"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">Emergency Hotline</label>
                    <input
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                      placeholder="+44 7700 900077"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="inline-flex items-center space-x-2 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Security, Roles & Access Control Overview */}
      {activeTab === 'SECURITY' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#00C6A6]" />
                <span>Commercial Access Control & Ground SLAs</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified permissions and contractual rate access assigned to your agency account.
              </p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${getRoleBadgeStyle(user.role)}`}>
              Role: {user.role}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">Contracted Markup Tier</span>
                <Percent className="w-4 h-4 text-[#00C6A6]" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {user.customAgentMarginPercent ?? (user.role === 'B2B_AGENT' ? 10 : 25)}%
              </div>
              <p className="text-[11px] text-slate-500">
                {user.role === 'B2B_AGENT' ? 'B2B Wholesale Agent Margin' : 'Standard Retail Customer Markup'}
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">Ground Dispatch SLA</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-900">
                24–48 Hours
              </div>
              <p className="text-[11px] text-slate-500">
                Guaranteed voucher and private driver allocation SLA
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-500">Account Authorization</span>
                <BadgeCheck className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {user.approvalStatus || 'APPROVED'}
              </div>
              <p className="text-[11px] text-slate-500">
                Firestore Role-Based Security Verified
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Active Authorized Privileges:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Access Dynamic Pricing Engine', active: true },
                { label: 'View Wholesale Net Tariffs', active: user.role === 'B2B_AGENT' || user.role === 'ADMIN' },
                { label: 'Instant Booking & Service Vouchers', active: true },
                { label: 'Download Branded PDF Quotations', active: true },
                { label: 'Wishlist & Multi-Folder Collections', active: true },
                { label: 'Administrative CMS Management', active: user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' }
              ].map((perm, idx) => (
                <div key={idx} className="flex items-center space-x-2.5 p-3 rounded-xl border border-slate-200 bg-white">
                  {perm.active ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span className={`text-xs ${perm.active ? 'font-semibold text-slate-800' : 'text-slate-400 line-through'}`}>
                    {perm.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
