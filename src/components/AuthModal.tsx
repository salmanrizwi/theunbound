import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, UserCategory } from '../types';
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
  BadgeCheck
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalReason, login } = useAuth();
  
  // User Category: External User by default
  const [userCategory, setUserCategory] = useState<UserCategory>('EXTERNAL');
  
  // Specific role under active category
  const [selectedExternalRole, setSelectedExternalRole] = useState<'BUYER' | 'B2B_AGENT'>('B2B_AGENT');
  const [selectedInternalRole, setSelectedInternalRole] = useState<'ADMIN' | 'TEAM_MEMBER'>('ADMIN');
  
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const activeRole: UserRole = userCategory === 'EXTERNAL' ? selectedExternalRole : selectedInternalRole;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'FORGOT') {
      setStatusMessage(`Password reset instructions sent to ${email || 'your email'}.`);
      setTimeout(() => {
        setStatusMessage(null);
        setAuthMode('LOGIN');
      }, 2500);
      return;
    }

    if (authMode === 'REGISTER') {
      login(email || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`, activeRole);
      return;
    }

    // Login with selected role
    login(email, activeRole);
  };

  const handleQuickDemoLogin = (role: UserRole) => {
    const demoEmails: Partial<Record<UserRole, string>> = {
      BUYER: 'james.buyer@horizonventures.com',
      B2B_AGENT: 'elena@luxurydiscovery.com',
      AGENT: 'elena@luxurydiscovery.com',
      ADMIN: 'marcus@theunbound.in',
      TEAM_MEMBER: 'kenji.ops@theunbound.in',
      DMC_STAFF: 'kenji.ops@theunbound.in'
    };
    login(demoEmails[role] || 'elena@luxurydiscovery.com', role);
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

        {/* Auth Body */}
        <div className="p-6 space-y-5">
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
                onClick={() => setUserCategory('EXTERNAL')}
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
                onClick={() => setUserCategory('INTERNAL')}
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
                  onClick={() => setSelectedExternalRole('BUYER')}
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
                  onClick={() => setSelectedExternalRole('B2B_AGENT')}
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
                    Travel Agent & Tour Operator. Wholesale net rates & custom markups.
                  </p>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Admin */}
                <button
                  type="button"
                  id="role-select-admin"
                  onClick={() => setSelectedInternalRole('ADMIN')}
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
                    DMC Master Admin. Full Sheets sync, Roster & System Control.
                  </p>
                </button>

                {/* 2. Team Member */}
                <button
                  type="button"
                  id="role-select-team-member"
                  onClick={() => setSelectedInternalRole('TEAM_MEMBER')}
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
                    Operations & Reservations Ground Staff. Bookings & Roster dispatch.
                  </p>
                </button>
              </div>
            )}
          </div>

          {/* Quick 1-Click Demo Login Shortcuts */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Instant 1-Click Demo Login</span>
              </span>
              <span className="text-[10px] text-slate-400">Testing Environments</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                id="demo-login-buyer"
                onClick={() => handleQuickDemoLogin('BUYER')}
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer shadow-2xs"
              >
                <UserIcon className="w-3 h-3 text-[#008972]" />
                <span>Buyer</span>
              </button>

              <button
                type="button"
                id="demo-login-b2b-agent"
                onClick={() => handleQuickDemoLogin('B2B_AGENT')}
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer shadow-2xs"
              >
                <Briefcase className="w-3 h-3 text-[#008972]" />
                <span>B2B Agent</span>
              </button>

              <button
                type="button"
                id="demo-login-admin"
                onClick={() => handleQuickDemoLogin('ADMIN')}
                className="bg-slate-900 hover:bg-slate-800 text-white px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3 text-[#00C6A6]" />
                <span>Admin</span>
              </button>

              <button
                type="button"
                id="demo-login-team-member"
                onClick={() => handleQuickDemoLogin('TEAM_MEMBER')}
                className="bg-slate-900 hover:bg-slate-800 text-white px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors cursor-pointer"
              >
                <Users2 className="w-3 h-3 text-[#00C6A6]" />
                <span>Team Member</span>
              </button>
            </div>
          </div>

          {/* Mode Selector Tabs (Sign In / Register) */}
          <div className="flex border-b border-slate-100 pb-1">
            <button
              onClick={() => setAuthMode('LOGIN')}
              className={`pb-2 text-xs font-bold transition-all mr-4 cursor-pointer ${
                authMode === 'LOGIN'
                  ? 'text-slate-900 border-b-2 border-[#00C6A6]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('REGISTER')}
              className={`pb-2 text-xs font-bold transition-all mr-4 cursor-pointer ${
                authMode === 'REGISTER'
                  ? 'text-slate-900 border-b-2 border-[#00C6A6]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {userCategory === 'EXTERNAL' ? 'Register Account' : 'Internal Staff Enrollment'}
            </button>
            <button
              onClick={() => setAuthMode('FORGOT')}
              className={`pb-2 text-xs font-bold transition-all cursor-pointer ${
                authMode === 'FORGOT'
                  ? 'text-slate-900 border-b-2 border-[#00C6A6]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Forgot Password
            </button>
          </div>

          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {authMode === 'REGISTER' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {userCategory === 'EXTERNAL' ? 'Full Name' : 'Staff Officer Name'}
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder={userCategory === 'EXTERNAL' ? 'Elena Rostova' : 'Kenji Sato'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                    />
                  </div>
                </div>

                {userCategory === 'EXTERNAL' && selectedExternalRole === 'B2B_AGENT' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Agency / Company Name</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="Luxury Discovery Travel Partners"
                        value={agencyName}
                        onChange={(e) => setAgencyName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {userCategory === 'INTERNAL' ? 'TheUnbound Official Email' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder={
                    userCategory === 'INTERNAL'
                      ? 'officer@theunbound.in'
                      : selectedExternalRole === 'BUYER'
                      ? 'buyer@horizonventures.com'
                      : 'agent@luxurytravel.com'
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                />
              </div>
            </div>

            {authMode !== 'FORGOT' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white"
                  />
                </div>
              </div>
            )}

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
                  onClick={() => setAuthMode('FORGOT')}
                  className="text-xs text-[#008972] font-semibold hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              id="auth-submit-btn"
              className="w-full bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer mt-2"
            >
              <span>
                {authMode === 'LOGIN' && `Sign In as ${userCategory === 'EXTERNAL' ? (selectedExternalRole === 'BUYER' ? 'Buyer' : 'B2B Agent') : (selectedInternalRole === 'ADMIN' ? 'Admin' : 'Team Member')}`}
                {authMode === 'REGISTER' && 'Complete Registration'}
                {authMode === 'FORGOT' && 'Send Password Reset'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
