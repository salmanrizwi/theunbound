import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, UserRole, UserCategory } from '../types';
import { 
  X, 
  Lock, 
  Mail, 
  KeyRound, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  User as UserIcon,
  Briefcase,
  Users2,
  Globe2,
  BadgeCheck,
  Clock,
  AlertTriangle,
  Phone,
  HelpCircle,
  FileCheck,
  ShieldAlert,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalReason, login, register } = useAuth();
  
  // User Category: External User by default
  const [userCategory, setUserCategory] = useState<UserCategory>('EXTERNAL');
  
  // Specific role under active category
  const [selectedExternalRole, setSelectedExternalRole] = useState<'BUYER' | 'B2B_AGENT'>('B2B_AGENT');
  const [selectedInternalRole, setSelectedInternalRole] = useState<'ADMIN' | 'TEAM_MEMBER'>('ADMIN');
  
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');

  // Form State (Default completely empty - no demo data)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [country, setCountry] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [taxOrGstNumber, setTaxOrGstNumber] = useState('');
  const [iataOrAbtaNumber, setIataOrAbtaNumber] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedToLegal, setAgreedToLegal] = useState(false);

  // Status & Feedback State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingApprovalUser, setPendingApprovalUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatAuthError = (raw: any): string => {
    if (!raw) return 'Authentication error. Please try again.';
    const str = typeof raw === 'string' ? raw : raw?.message || String(raw);
    let cleaned = str.replace(/^Firebase:\s*Error\s*\(([^)]+)\)\.?/i, '$1');
    if (cleaned.includes('auth/operation-not-allowed') || cleaned.includes('operation-not-allowed')) {
      return 'Sign-in method is being verified via Firestore cloud database. Please try again.';
    }
    if (cleaned.includes('auth/invalid-credential') || cleaned.includes('auth/user-not-found')) {
      return 'Invalid email or password. Please check your credentials or register a new account.';
    }
    if (cleaned.includes('auth/wrong-password')) {
      return 'Incorrect password. Please verify your credentials and try again.';
    }
    if (cleaned.includes('auth/email-already-in-use')) {
      return 'An account with this email address already exists. Please sign in or reset your password.';
    }
    if (cleaned.includes('auth/weak-password')) {
      return 'Password must be at least 6 characters in length.';
    }
    return cleaned;
  };

  React.useEffect(() => {
    if (isAuthModalOpen) {
      if (authModalReason && (authModalReason.toLowerCase().includes('register') || authModalReason.toLowerCase().includes('create an account') || authModalReason.toLowerCase().includes('apply'))) {
        setAuthMode('REGISTER');
      } else {
        setAuthMode('LOGIN');
      }
      if (authModalReason && (authModalReason.toLowerCase().includes('agent') || authModalReason.toLowerCase().includes('trade') || authModalReason.toLowerCase().includes('wholesale') || authModalReason.toLowerCase().includes('b2b'))) {
        setUserCategory('EXTERNAL');
        setSelectedExternalRole('B2B_AGENT');
      }
    }
  }, [isAuthModalOpen, authModalReason]);

  // Handle ESC key to dismiss modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const activeRole: UserRole = userCategory === 'EXTERNAL' ? selectedExternalRole : selectedInternalRole;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setName('');
    setFirstName('');
    setLastName('');
    setAgencyName('');
    setContactNumber('');
    setCountry('');
    setJobTitle('');
    setTaxOrGstNumber('');
    setIataOrAbtaNumber('');
    setAgreedToLegal(false);
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingApprovalUser(null);
  };

  const handleTabSwitch = (mode: 'LOGIN' | 'REGISTER' | 'FORGOT') => {
    setAuthMode(mode);
    setAgreedToLegal(false);
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingApprovalUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setStatusMessage(null);

    // 1. FORGOT PASSWORD
    if (authMode === 'FORGOT') {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        setErrorMessage('Please enter your email address to receive password reset instructions.');
        return;
      }
      setStatusMessage(`Password reset instructions sent to ${cleanEmail}. Check your inbox.`);
      setTimeout(() => {
        setStatusMessage(null);
        setAuthMode('LOGIN');
      }, 3000);
      return;
    }

    // 2. REGISTER / CREATE PROFILE
    if (authMode === 'REGISTER') {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const trimmedName = (name.trim() || `${trimmedFirst} ${trimmedLast}`.trim());
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedAgency = agencyName.trim();

      // Strict validation - no demo / empty / garbage
      if (!trimmedName || trimmedName.length < 2) {
        setErrorMessage('Please enter your first and last name (minimum 2 characters).');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
        setErrorMessage('Please provide a valid official business email address.');
        return;
      }

      if (!password || password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }

      if (userCategory === 'EXTERNAL' && selectedExternalRole === 'B2B_AGENT') {
        if (!trimmedAgency || trimmedAgency.length < 2) {
          setErrorMessage('Travel Agency or Company Name is required for B2B Agent registration.');
          return;
        }
      }

      if (!agreedToLegal) {
        setErrorMessage('Please accept the Terms of Service and Privacy Policy to create your account.');
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await register({
          name: trimmedName,
          firstName: trimmedFirst || undefined,
          lastName: trimmedLast || undefined,
          email: trimmedEmail,
          password,
          role: activeRole,
          category: userCategory,
          agencyName: trimmedAgency,
          companyName: trimmedAgency,
          country: country.trim() || 'Global',
          contactNumber: contactNumber.trim(),
          jobTitle: jobTitle.trim(),
          taxOrGstNumber: taxOrGstNumber.trim(),
          iataOrAbtaNumber: iataOrAbtaNumber.trim()
        });

        if (!result.success) {
          setErrorMessage(result.error || 'Failed to create profile. Please check your details.');
          return;
        }

        // If B2B Agent requires admin approval
        if (result.requiresApproval && result.user) {
          setPendingApprovalUser(result.user);
          return;
        }

        // Auto-approved buyer or internal user
        setStatusMessage('Registration successful! Logging you in...');
        return;
      } catch (err: any) {
        setErrorMessage(err?.message || 'Registration failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 3. LOGIN
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(cleanEmail, activeRole, password);
      if (!res.success) {
        setErrorMessage(formatAuthError(res.error || 'Invalid credentials or login failed.'));
      }
    } catch (err: any) {
      setErrorMessage(formatAuthError(err?.message || 'Authentication error. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="fixed inset-0 -z-10" onClick={closeAuthModal} aria-hidden="true" />

      <div 
        id="auth-modal-dialog"
        className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md sm:max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(92vh,740px)] overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header - Compact, Sticky, High Contrast */}
        <div className="shrink-0 bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-3.5 relative border-b border-slate-800">
          <button
            id="close-auth-modal-btn"
            onClick={closeAuthModal}
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5 sm:space-x-3 pr-8">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0] shrink-0">
              <Lock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-black font-sans text-white tracking-tight truncate">
                  TheUnbound Portal Access
                </h2>
                <span className="text-[10px] bg-[#00C6A6]/20 text-[#00E5C0] font-bold px-2 py-0.5 rounded-md border border-[#00C6A6]/30 shrink-0">
                  B2B DMC
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 truncate leading-tight">
                {authModalReason || 'Sign in to access confidential trade pricing & operations.'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Content / Screens */}
        {pendingApprovalUser ? (
          /* SCREEN: PENDING APPROVAL CONFIRMATION AFTER REGISTRATION */
          <div id="pending-approval-card" className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
            <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl">
              <div className="flex items-start space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex flex-wrap items-center gap-1.5">
                    <span>B2B Agent Application Submitted</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200">
                      Pending Admin Approval
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Thank you, <strong className="text-slate-900 font-bold">{pendingApprovalUser.name}</strong>. Your agency profile for <strong className="text-slate-900 font-bold">{pendingApprovalUser.agencyName || pendingApprovalUser.companyName}</strong> has been registered.
                  </p>
                </div>
              </div>

              {/* Details Summary */}
              <div className="mt-3 pt-3 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Registered Email</span>
                  <span className="font-semibold text-slate-800 truncate block">{pendingApprovalUser.email}</span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Agency Name</span>
                  <span className="font-semibold text-slate-800 truncate block">{pendingApprovalUser.agencyName || 'N/A'}</span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Country / Region</span>
                  <span className="font-semibold text-slate-800 truncate block">{pendingApprovalUser.country || 'Global'}</span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Approval Status</span>
                  <span className="font-bold text-amber-700 block">Pending Review (24-48h SLA)</span>
                </div>
              </div>

              <div className="mt-3 p-2.5 bg-amber-100/60 rounded-xl text-amber-900 text-xs flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>B2B Access Security:</strong> To protect confidential wholesale tariffs and B2B pricing, B2B Agent accounts can only log in once reviewed and approved by TheUnbound DMC Admin team. You will be able to log in with your email once approved.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 pt-1">
              <button
                type="button"
                id="return-to-login-btn"
                onClick={() => {
                  setPendingApprovalUser(null);
                  setAuthMode('LOGIN');
                  setEmail(pendingApprovalUser.email);
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Sign In</span>
              </button>
              <button
                type="button"
                onClick={closeAuthModal}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Sticky Navigation Tabs: Sign In / Register / Reset */}
            <div className="shrink-0 bg-slate-50/90 border-b border-slate-200 px-4 py-2 sm:px-6 sm:py-2.5 flex items-center justify-between gap-2">
              <div className="flex space-x-1 bg-slate-200/70 p-1 rounded-xl">
                <button
                  type="button"
                  id="tab-auth-login"
                  onClick={() => handleTabSwitch('LOGIN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'LOGIN'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="tab-auth-register"
                  onClick={() => handleTabSwitch('REGISTER')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'REGISTER'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {userCategory === 'EXTERNAL' ? 'Register Agency' : 'Enroll Staff'}
                </button>
                <button
                  type="button"
                  id="tab-auth-forgot"
                  onClick={() => handleTabSwitch('FORGOT')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'FORGOT'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Forgot
                </button>
              </div>

              <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                {activeRole === 'B2B_AGENT' ? '🏢 B2B Trade' : activeRole === 'BUYER' ? '👤 Buyer' : '🛡️ DMC Staff'}
              </span>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 sm:px-6 sm:py-3.5 space-y-3 custom-scrollbar">
              
              {/* Compact Account Type & Role Switcher */}
              <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Account Profile
                  </span>
                  <div className="flex items-center space-x-1 bg-slate-200/80 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      id="select-cat-external"
                      onClick={() => {
                        setUserCategory('EXTERNAL');
                        setErrorMessage(null);
                      }}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        userCategory === 'EXTERNAL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      External
                    </button>
                    <button
                      type="button"
                      id="select-cat-internal"
                      onClick={() => {
                        setUserCategory('INTERNAL');
                        setErrorMessage(null);
                      }}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        userCategory === 'INTERNAL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Internal Staff
                    </button>
                  </div>
                </div>

                {userCategory === 'EXTERNAL' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="role-select-b2b-agent"
                      onClick={() => {
                        setSelectedExternalRole('B2B_AGENT');
                        setErrorMessage(null);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        selectedExternalRole === 'B2B_AGENT'
                          ? 'border-[#00C6A6] bg-[#00C6A6]/10 ring-1 ring-[#00C6A6]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center space-x-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-[#008972] shrink-0" />
                          <span className="text-xs font-bold text-slate-900 truncate">B2B Agent</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">Wholesale rates</p>
                      </div>
                      {selectedExternalRole === 'B2B_AGENT' && (
                        <BadgeCheck className="w-4 h-4 text-[#00C6A6] shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      id="role-select-buyer"
                      onClick={() => {
                        setSelectedExternalRole('BUYER');
                        setErrorMessage(null);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        selectedExternalRole === 'BUYER'
                          ? 'border-[#00C6A6] bg-[#00C6A6]/10 ring-1 ring-[#00C6A6]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center space-x-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-[#008972] shrink-0" />
                          <span className="text-xs font-bold text-slate-900 truncate">Direct Buyer</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">Standard booking</p>
                      </div>
                      {selectedExternalRole === 'BUYER' && (
                        <BadgeCheck className="w-4 h-4 text-[#00C6A6] shrink-0" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="role-select-admin"
                      onClick={() => {
                        setSelectedInternalRole('ADMIN');
                        setErrorMessage(null);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        selectedInternalRole === 'ADMIN'
                          ? 'border-slate-900 bg-slate-900 text-white ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center space-x-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
                          <span className={`text-xs font-bold truncate ${selectedInternalRole === 'ADMIN' ? 'text-white' : 'text-slate-900'}`}>Admin</span>
                        </div>
                        <p className={`text-[10px] truncate mt-0.5 ${selectedInternalRole === 'ADMIN' ? 'text-slate-300' : 'text-slate-500'}`}>CMS Master</p>
                      </div>
                      {selectedInternalRole === 'ADMIN' && (
                        <BadgeCheck className="w-4 h-4 text-[#00C6A6] shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      id="role-select-team-member"
                      onClick={() => {
                        setSelectedInternalRole('TEAM_MEMBER');
                        setErrorMessage(null);
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        selectedInternalRole === 'TEAM_MEMBER'
                          ? 'border-slate-900 bg-slate-900 text-white ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center space-x-1.5">
                          <Users2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
                          <span className={`text-xs font-bold truncate ${selectedInternalRole === 'TEAM_MEMBER' ? 'text-white' : 'text-slate-900'}`}>Team Member</span>
                        </div>
                        <p className={`text-[10px] truncate mt-0.5 ${selectedInternalRole === 'TEAM_MEMBER' ? 'text-slate-300' : 'text-slate-500'}`}>Ground Ops</p>
                      </div>
                      {selectedInternalRole === 'TEAM_MEMBER' && (
                        <BadgeCheck className="w-4 h-4 text-[#00C6A6] shrink-0" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Error Message Banner */}
              {errorMessage && (
                <div id="auth-error-banner" className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start space-x-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block text-rose-900 text-[11px]">Notice</span>
                    <p className="text-[11px] leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Status Message Banner */}
              {statusMessage && (
                <div className="p-2.5 sm:p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-[11px] sm:text-xs">{statusMessage}</span>
                </div>
              )}

              {/* REGISTRATION SPECIFIC FIELDS */}
              {authMode === 'REGISTER' && (
                <div className="space-y-2.5">
                  {/* B2B Vetting Policy Notice for Agent Registrations */}
                  {userCategory === 'EXTERNAL' && selectedExternalRole === 'B2B_AGENT' && (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-900 text-xs flex items-start space-x-2">
                      <FileCheck className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        <strong>B2B Vetting Policy:</strong> Travel agent registrations undergo administrative review before wholesale rate access is granted.
                      </p>
                    </div>
                  )}

                  {/* First & Last Name Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          id="register-input-firstname"
                          placeholder="e.g. Alexander"
                          value={firstName}
                          onChange={(e) => {
                            setFirstName(e.target.value);
                            setName(`${e.target.value} ${lastName}`.trim());
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 sm:py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        id="register-input-lastname"
                        placeholder="e.g. Wright"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          setName(`${firstName} ${e.target.value}`.trim());
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Agency / Company Details for B2B Agents */}
                  {userCategory === 'EXTERNAL' && selectedExternalRole === 'B2B_AGENT' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Agency / Company Legal Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            required
                            id="register-input-agency"
                            placeholder="e.g. Wright Luxury Journeys Ltd"
                            value={agencyName}
                            onChange={(e) => setAgencyName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 sm:py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Designation / Title</label>
                          <input
                            type="text"
                            id="register-input-title"
                            placeholder="e.g. Managing Director"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Country / Region</label>
                          <input
                            type="text"
                            id="register-input-country"
                            placeholder="e.g. United Kingdom"
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">WhatsApp / Phone</label>
                          <div className="relative">
                            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              id="register-input-phone"
                              placeholder="e.g. +44 20 7946 0192"
                              value={contactNumber}
                              onChange={(e) => setContactNumber(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 sm:py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">IATA / ABTA (Optional)</label>
                          <input
                            type="text"
                            id="register-input-iata"
                            placeholder="e.g. IATA 912384"
                            value={iataOrAbtaNumber}
                            onChange={(e) => setIataOrAbtaNumber(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {userCategory === 'INTERNAL' ? 'TheUnbound Official Email' : 'Official Business Email'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 sm:top-3" />
                  <input
                    type="email"
                    required
                    id="auth-input-email"
                    placeholder={
                      authMode === 'REGISTER'
                        ? 'e.g. yourname@agencydomain.com'
                        : userCategory === 'INTERNAL'
                        ? 'officer@theunbound.in'
                        : selectedExternalRole === 'BUYER'
                        ? 'buyer@agency.com'
                        : 'partner@agency.com'
                    }
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                  />
                </div>
              </div>

              {/* Password */}
              {authMode !== 'FORGOT' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 sm:top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      id="auth-input-password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-9 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 sm:top-2.5 text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Login Remember & Forgot Links */}
              {authMode === 'LOGIN' && (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center space-x-1.5 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded text-[#00C6A6] focus:ring-[#00C6A6] w-3.5 h-3.5"
                    />
                    <span className="text-[11px]">Remember session</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('FORGOT')}
                    className="text-[11px] text-[#008972] font-semibold hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Registration Terms Consent */}
              {authMode === 'REGISTER' && (
                <div className="pt-1">
                  <label className="flex items-start space-x-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      id="register-terms-consent"
                      checked={agreedToLegal}
                      onChange={(e) => {
                        setAgreedToLegal(e.target.checked);
                        if (e.target.checked) setErrorMessage(null);
                      }}
                      className="mt-0.5 w-3.5 h-3.5 rounded text-[#00C6A6] focus:ring-[#00C6A6] border-slate-300 shrink-0"
                    />
                    <span className="leading-snug text-[10px] sm:text-[11px]">
                      I agree to TheUnbound's{' '}
                      <button
                        type="button"
                        onClick={() => window.open('/terms', '_blank')}
                        className="text-[#008972] font-bold underline hover:text-[#00C6A6]"
                      >
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={() => window.open('/privacy', '_blank')}
                        className="text-[#008972] font-bold underline hover:text-[#00C6A6]"
                      >
                        Privacy Policy
                      </button>
                      . Confidential trade data is strictly guarded.
                    </span>
                  </label>
                </div>
              )}

              {/* Forgot Password Guidance */}
              {authMode === 'FORGOT' && (
                <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                  Enter your registered agency or buyer email above. An authorized password reset token and verification link will be dispatched to your inbox.
                </p>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-4 py-3 sm:px-6 sm:py-3.5">
              <button
                type="submit"
                id="auth-submit-btn"
                disabled={isSubmitting}
                className={`w-full bg-[#00C6A6] hover:bg-[#00b094] active:bg-[#009b82] text-slate-950 font-black py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99] ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying credentials...</span>
                  </>
                ) : (
                  <>
                    <span className="truncate">
                      {authMode === 'LOGIN' && `Sign In as ${userCategory === 'EXTERNAL' ? (selectedExternalRole === 'BUYER' ? 'Buyer' : 'B2B Agent') : (selectedInternalRole === 'ADMIN' ? 'Admin' : 'Team Member')}`}
                      {authMode === 'REGISTER' && (userCategory === 'EXTERNAL' && selectedExternalRole === 'B2B_AGENT' ? 'Submit B2B Agent Profile for Review' : 'Complete Profile Registration')}
                      {authMode === 'FORGOT' && 'Send Password Reset'}
                    </span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};


