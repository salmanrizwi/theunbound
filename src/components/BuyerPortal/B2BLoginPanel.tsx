import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Users2, 
  Globe2, 
  Clock, 
  Zap, 
  FileText, 
  Layers, 
  TrendingUp, 
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck
} from 'lucide-react';
import { navigateTo } from '../../services/portalRouter';

interface B2BLoginPanelProps {
  onSuccess?: () => void;
  className?: string;
}

export const B2BLoginPanel: React.FC<B2BLoginPanelProps> = ({
  onSuccess,
  className = ''
}) => {
  const { login, register, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Quick Register fields
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAgency, setRegAgency] = useState('');
  const [regCountry, setRegCountry] = useState('United States');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both your registered email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    // Auto-detect role if admin/team staff signs in from hero B2B panel
    let roleToSubmit: UserRole = 'B2B_AGENT';
    if (['admin@theunbound.com', 'business@theunbound.in', 'marcus@theunbound.in'].includes(cleanEmail) || cleanEmail.endsWith('@theunbound.in')) {
      roleToSubmit = cleanEmail === 'kenji.ops@theunbound.in' ? 'TEAM_MEMBER' : 'ADMIN';
    }

    try {
      const res = await login(cleanEmail, roleToSubmit, password);
      if (res.success) {
        setSuccessMsg('Welcome back! Loading trade agent portal...');
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || 'Invalid credentials. Please verify your email and password.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication failed. Please verify your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail || !regPassword || !regAgency) {
      setErrorMsg('Please fill in required fields: Email, Password, and Agency Name.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const fullName = `${regFirstName} ${regLastName}`.trim() || regAgency;
      const res = await register({
        email: cleanEmail,
        name: fullName,
        role: 'B2B_AGENT',
        category: 'EXTERNAL',
        agencyName: regAgency.trim(),
        country: regCountry,
        password: regPassword
      });

      if (res.success) {
        setSuccessMsg('Trade registration submitted! Welcome to TheUnbound B2B Network.');
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || 'Registration failed. Please verify the provided details.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Trade registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      id="b2b-hero-login-card"
      className={`bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col backdrop-blur-md ${className}`}
    >
      {/* Card Header with Category Badges & Mode Switcher */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#00C6A6] animate-pulse"></span>
            <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-[#00E5C0]">
              B2B Partner Portal
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
            Wholesale Ground DMC
          </span>
        </div>

        {/* Tab switch: Sign In vs Register */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs font-bold">
          <button
            type="button"
            id="tab-b2b-login"
            onClick={() => {
              setActiveTab('LOGIN');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'LOGIN'
                ? 'bg-[#00C6A6] text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Agent Sign In</span>
          </button>
          <button
            type="button"
            id="tab-b2b-register"
            onClick={() => {
              setActiveTab('REGISTER');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'REGISTER'
                ? 'bg-[#00C6A6] text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Register Agency</span>
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {activeTab === 'LOGIN' ? (
          /* LOGIN FORM */
          <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-left">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Trade Email Address
              </label>
              <input
                type="email"
                id="b2b-login-email"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@travelagency.com"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20 text-xs font-medium text-slate-900 placeholder:text-slate-400 bg-slate-50/50 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => openAuthModal('Password Reset Assistance')}
                  className="text-[11px] text-[#008972] hover:text-[#00C6A6] font-semibold transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="b2b-login-password"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your confidential password"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#00C6A6] focus:ring-2 focus:ring-[#00C6A6]/20 text-xs font-medium text-slate-900 placeholder:text-slate-400 bg-slate-50/50 pr-12 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00C6A6] focus:ring-[#00C6A6] border-slate-300"
                />
                <span>Remember this terminal</span>
              </label>
            </div>

            <button
              type="submit"
              id="btn-b2b-hero-login"
              disabled={isLoading}
              className="w-full min-h-[44px] mt-2 py-3 px-4 bg-[#00C6A6] hover:bg-[#00b094] active:bg-[#009b82] text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-70 active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In to Trade Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-3 text-left">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#00C6A6] text-xs bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#00C6A6] text-xs bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                Agency / Company Name
              </label>
              <input
                type="text"
                required
                value={regAgency}
                onChange={(e) => setRegAgency(e.target.value)}
                placeholder="Apex Bespoke Journeys Ltd"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#00C6A6] text-xs bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                Work Email Address
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="advisor@apexjourneys.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#00C6A6] text-xs bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                Create Password
              </label>
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Min. 6 alphanumeric characters"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#00C6A6] text-xs bg-slate-50/50"
              />
            </div>

            <button
              type="submit"
              id="btn-b2b-hero-register"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-[#00C6A6] hover:bg-[#00b094] active:bg-[#009b82] text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-70 active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Create Agent Account</span>
                  <UserCheck className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Benefits Micro-List */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
          <div className="flex items-center space-x-2 text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
            <span>Confidential wholesale tariffs & net markups</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
            <span>Multi-currency client PDF white-label quotes</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
            <span>Direct ground operations in Japan, UK, and France</span>
          </div>
        </div>
      </div>
    </div>
  );
};
