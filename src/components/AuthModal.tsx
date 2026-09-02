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
  ArrowLeft
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

  // Status & Feedback State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingApprovalUser, setPendingApprovalUser] = useState<User | null>(null);

  React.useEffect(() => {
    if (isAuthModalOpen) {
      if (authModalReason && (authModalReason.toLowerCase().includes('register') || authModalReason.toLowerCase().includes('create an account'))) {
        setAuthMode('REGISTER');
      } else {
        setAuthMode('LOGIN');
      }
    }
  }, [isAuthModalOpen, authModalReason]);

  if (!isAuthModalOpen) return null;

  const activeRole: UserRole = userCategory === 'EXTERNAL' ? selectedExternalRole : selectedInternalRole;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setFirstName('');
    setLastName('');
    setAgencyName('');
    setContactNumber('');
    setCountry('');
    setJobTitle('');
    setTaxOrGstNumber('');
    setIataOrAbtaNumber('');
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingApprovalUser(null);
  };

  const handleTabSwitch = (mode: 'LOGIN' | 'REGISTER' | 'FORGOT') => {
    setAuthMode(mode);
    setErrorMessage(null);
    setStatusMessage(null);
    setPendingApprovalUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    // 1. FORGOT PASSWORD
    if (authMode === 'FORGOT') {
      const cleanEmail = email.trim();
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
      const trimmedEmail = email.trim();
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

      const result = register({
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
    }

    // 3. LOGIN
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    const res = login(cleanEmail, activeRole, password);
    if (!res.success) {
      setErrorMessage(res.error || 'Invalid credentials or login failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        id="auth-modal-dialog"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            id="close-auth-modal-btn"
            onClick={closeAuthModal}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold font-sans text-white">
                TheUnbound Portal Access
              </h2>
              <span className="text-[11px] text-[#00E5C0] font-semibold">
                Multi-Role B2B & DMC Operations System
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {authModalReason || 'Sign in to access dynamic pricing calculators, custom proposals, or DMC operational hubs.'}
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {/* SCREEN: PENDING APPROVAL CONFIRMATION AFTER REGISTRATION */}
          {pendingApprovalUser ? (
            <div id="pending-approval-card" className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
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
                <div className="mt-4 pt-3.5 border-t border-amber-200/60 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Registered Email</span>
                    <span className="font-semibold text-slate-800 truncate block">{pendingApprovalUser.email}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Agency Name</span>
                    <span className="font-semibold text-slate-800 truncate block">{pendingApprovalUser.agencyName || 'N/A'}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Country / Region</span>
                    <span className="font-semibold text-slate-800 truncate block">{pendingApprovalUser.country || 'Global'}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Approval Status</span>
                    <span className="font-bold text-amber-700 block">Pending Review (24-48h SLA)</span>
                  </div>
                </div>

                <div className="mt-3.5 p-3 bg-amber-100/60 rounded-xl text-amber-900 text-xs flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>B2B Access Security:</strong> To protect confidential wholesale tariffs and B2B pricing, B2B Agent accounts can only log in once reviewed and approved by TheUnbound DMC Admin team. You will be able to log in with your email once approved.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  id="return-to-login-btn"
                  onClick={() => {
                    setPendingApprovalUser(null);
                    setAuthMode('LOGIN');
                    setEmail(pendingApprovalUser.email);
                  }}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
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
            <>
              {/* User Category Selector: External User by default vs Internal User */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Select Account Type
                  </label>
                  <span className="text-[10px] font-semibold text-[#008972] bg-emerald-50 px-2 py-0.5 rounded-md">
                    {userCategory === 'EXTERNAL' ? 'External User (Default)' : 'Internal DMC Operations'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    id="select-cat-external"
                    onClick={() => {
                      setUserCategory('EXTERNAL');
                      setErrorMessage(null);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      userCategory === 'EXTERNAL'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Globe2 className="w-4 h-4 text-[#008972]" />
                    <span>External User</span>
                  </button>

                  <button
                    type="button"
                    id="select-cat-internal"
                    onClick={() => {
                      setUserCategory('INTERNAL');
                      setErrorMessage(null);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      userCategory === 'INTERNAL'
                        ? 'bg-slate-900 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#00C6A6]" />
                    <span>Internal User</span>
                  </button>
                </div>
              </div>

              {/* Sub-Role Choice under Category */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Select Specific Role
                </label>

                {userCategory === 'EXTERNAL' ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* 1. Buyer */}
                    <button
                      type="button"
                      id="role-select-buyer"
                      onClick={() => {
                        setSelectedExternalRole('BUYER');
                        setErrorMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedExternalRole === 'BUYER'
                          ? 'border-[#00C6A6] bg-emerald-50/40 ring-1 ring-[#00C6A6]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-[#008972]" />
                          <span>1. Buyer</span>
                        </span>
                        {selectedExternalRole === 'BUYER' && (
                          <BadgeCheck className="w-4 h-4 text-[#00C6A6]" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Direct Client & Corporate Traveler. Standard proposal access.
                      </p>
                    </button>

                    {/* 2. B2B Agent */}
                    <button
                      type="button"
                      id="role-select-b2b-agent"
                      onClick={() => {
                        setSelectedExternalRole('B2B_AGENT');
                        setErrorMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedExternalRole === 'B2B_AGENT'
                          ? 'border-[#00C6A6] bg-emerald-50/40 ring-1 ring-[#00C6A6]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-[#008972]" />
                          <span>2. B2B Agent</span>
                        </span>
                        {selectedExternalRole === 'B2B_AGENT' && (
                          <BadgeCheck className="w-4 h-4 text-[#00C6A6]" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Travel Agent & Tour Operator. Wholesale tariffs (Admin approval required).
                      </p>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* 1. Admin */}
                    <button
                      type="button"
                      id="role-select-admin"
                      onClick={() => {
                        setSelectedInternalRole('ADMIN');
                        setErrorMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedInternalRole === 'ADMIN'
                          ? 'border-slate-900 bg-slate-900 text-white ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold flex items-center space-x-1.5 ${selectedInternalRole === 'ADMIN' ? 'text-white' : 'text-slate-900'}`}>
                          <ShieldCheck className="w-3.5 h-3.5 text-[#00C6A6]" />
                          <span>1. Admin</span>
                        </span>
                        {selectedInternalRole === 'ADMIN' && (
                          <BadgeCheck className="w-4 h-4 text-[#00C6A6]" />
                        )}
                      </div>
                      <p className={`text-[11px] leading-tight ${selectedInternalRole === 'ADMIN' ? 'text-slate-300' : 'text-slate-500'}`}>
                        DMC Master Admin. User Vetting & Approvals, System Control.
                      </p>
                    </button>

                    {/* 2. Team Member */}
                    <button
                      type="button"
                      id="role-select-team-member"
                      onClick={() => {
                        setSelectedInternalRole('TEAM_MEMBER');
                        setErrorMessage(null);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedInternalRole === 'TEAM_MEMBER'
                          ? 'border-slate-900 bg-slate-900 text-white ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold flex items-center space-x-1.5 ${selectedInternalRole === 'TEAM_MEMBER' ? 'text-white' : 'text-slate-900'}`}>
                          <Users2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                          <span>2. Team Member</span>
                        </span>
                        {selectedInternalRole === 'TEAM_MEMBER' && (
                          <BadgeCheck className="w-4 h-4 text-[#00C6A6]" />
                        )}
                      </div>
                      <p className={`text-[11px] leading-tight ${selectedInternalRole === 'TEAM_MEMBER' ? 'text-slate-300' : 'text-slate-500'}`}>
                        Operations & Reservations Ground Staff. Bookings dispatch.
                      </p>
                    </button>
                  </div>
                )}
              </div>

              {/* Mode Selector Tabs (Sign In / Register / Forgot) */}
              <div className="flex border-b border-slate-100 pb-1">
                <button
                  type="button"
                  id="tab-auth-login"
                  onClick={() => handleTabSwitch('LOGIN')}
                  className={`pb-2 text-xs font-bold transition-all mr-4 cursor-pointer ${
                    authMode === 'LOGIN'
                      ? 'text-slate-900 border-b-2 border-[#00C6A6]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="tab-auth-register"
                  onClick={() => handleTabSwitch('REGISTER')}
                  className={`pb-2 text-xs font-bold transition-all mr-4 cursor-pointer ${
                    authMode === 'REGISTER'
                      ? 'text-slate-900 border-b-2 border-[#00C6A6]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {userCategory === 'EXTERNAL' ? 'Register New Profile' : 'Enroll Staff Officer'}
                </button>
                <button
                  type="button"
                  id="tab-auth-forgot"
                  onClick={() => handleTabSwitch('FORGOT')}
                  className={`pb-2 text-xs font-bold transition-all cursor-pointer ${
                    authMode === 'FORGOT'
                      ? 'text-slate-900 border-b-2 border-[#00C6A6]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Forgot Password
                </button>
              </div>

              {/* Error Message Banner */}
              {errorMessage && (
                <div id="auth-error-banner" className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start space-x-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block text-rose-900">Access Notice</span>
                    <p className="text-[11px] leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Status Message Banner */}
              {statusMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{statusMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {authMode === 'REGISTER' && (
                  <>
                    {/* B2B Vetting Policy Notice for Agent Registrations */}
                    {userCategory === 'EXTERNAL' && selectedExternalRole === 'B2B_AGENT' && (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-900 text-xs flex items-start space-x-2">
                        <FileCheck className="w-4 h-4 text-[#008972] shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed">
                          <strong>B2B Vetting Policy:</strong> Travel agent registrations undergo administrative review before wholesale rate access is granted. Please enter accurate agency details.
                        </p>
                      </div>
                    )}

                    {/* First & Last Name Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          First Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
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
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Last Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
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
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Agency / Company Details for B2B Agents */}
                    {userCategory === 'EXTERNAL' && selectedExternalRole === 'B2B_AGENT' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Travel Agency / Company Legal Name <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              required
                              id="register-input-agency"
                              placeholder="e.g. Wright Luxury Journeys Ltd"
                              value={agencyName}
                              onChange={(e) => setAgencyName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Designation / Job Title</label>
                            <input
                              type="text"
                              id="register-input-title"
                              placeholder="e.g. Managing Director"
                              value={jobTitle}
                              onChange={(e) => setJobTitle(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
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
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">WhatsApp / Phone Contact</label>
                            <div className="relative">
                              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                id="register-input-phone"
                                placeholder="e.g. +44 20 7946 0192"
                                value={contactNumber}
                                onChange={(e) => setContactNumber(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">IATA / ABTA / Tax Code (Optional)</label>
                            <input
                              type="text"
                              id="register-input-iata"
                              placeholder="e.g. IATA 912384"
                              value={iataOrAbtaNumber}
                              onChange={(e) => setIataOrAbtaNumber(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {userCategory === 'INTERNAL' ? 'TheUnbound Official Email' : 'Official Business Email'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
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
                          ? 'james.buyer@horizonventures.com'
                          : 'elena@luxurydiscovery.com'
                      }
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
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
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        id="auth-input-password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Login Remember & Forgot Links */}
                {authMode === 'LOGIN' && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                      />
                      <span>Remember session</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('FORGOT')}
                      className="text-xs text-[#008972] font-semibold hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  id="auth-submit-btn"
                  className="w-full bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer mt-2"
                >
                  <span>
                    {authMode === 'LOGIN' && `Sign In as ${userCategory === 'EXTERNAL' ? (selectedExternalRole === 'BUYER' ? 'Buyer' : 'B2B Agent') : (selectedInternalRole === 'ADMIN' ? 'Admin' : 'Team Member')}`}
                    {authMode === 'REGISTER' && (userCategory === 'EXTERNAL' && selectedExternalRole === 'B2B_AGENT' ? 'Submit B2B Agent Profile for Review' : 'Complete Profile Registration')}
                    {authMode === 'FORGOT' && 'Send Password Reset'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

