import React, { useState } from 'react';
import { 
  Briefcase, 
  PlusCircle, 
  Layers, 
  ShoppingBag, 
  Building2, 
  FileText, 
  BookmarkCheck, 
  Users, 
  CheckSquare, 
  User as UserIcon, 
  LogOut, 
  Eye, 
  Clock, 
  ShieldCheck, 
  Globe2, 
  ChevronDown, 
  Menu, 
  X,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { B2BTabType, CurrencyCode, SUPPORTED_CURRENCIES } from '../../types';
import { formatCurrency } from '../../services/pricingEngine';

export type { B2BTabType };

interface B2BPortalNavbarProps {
  activeTab: B2BTabType;
  onSelectTab: (tab: B2BTabType) => void;
  quoteItemCount?: number;
  onSwitchToBuyerMode?: () => void;
  onSwitchToBuyerView?: () => void;
}

export const B2BPortalNavbar: React.FC<B2BPortalNavbarProps> = ({
  activeTab,
  onSelectTab,
  quoteItemCount,
  onSwitchToBuyerMode: _onSwitchToBuyerMode,
  onSwitchToBuyerView: _onSwitchToBuyerView
}) => {
  const { user, logout } = useAuth();
  const { items, totalSellingPrice, currency, setCurrency, setIsQuoteDrawerOpen } = useQuotation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: { id: B2BTabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Briefcase },
    { id: 'create-quote', label: 'Create Quote', icon: PlusCircle },
    { id: 'packages', label: 'Packages', icon: Layers },
    { id: 'products', label: 'Products', icon: ShoppingBag },
    { id: 'hotels', label: 'Hotels', icon: Building2 },
    { id: 'my-quotes', label: 'My Quotes', icon: FileText },
    { id: 'bookings', label: 'Bookings', icon: BookmarkCheck },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'account', label: 'Account', icon: UserIcon }
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 shadow-md">
      {/* Top Professional B2B Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800/80 px-4 sm:px-6 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#00E5C0] animate-pulse"></span>
            <span className="font-bold text-[#00E5C0] uppercase tracking-wider text-[11px]">
              Travel Agent Portal
            </span>
          </div>
          <span className="hidden md:inline text-slate-400">|</span>
          <span className="hidden md:inline text-slate-300 font-medium truncate max-w-xs">
            {user?.agencyName || 'Luxury Discovery Travel Partners'}
          </span>
          <span className="hidden lg:inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
            <ShieldCheck className="w-3 h-3 text-[#00C6A6]" />
            <span>Verified Wholesale Rates & Instant SLA</span>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Currency Switcher */}
          <div className="flex items-center space-x-1 bg-slate-800/90 border border-slate-700 px-2 py-1 rounded-md">
            <Globe2 className="w-3 h-3 text-slate-400" />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="bg-transparent text-white text-[11px] font-bold outline-none cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map(c => (
                <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Agent Navigation Row */}
      <div className="px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Brand Logo & Tag */}
        <div className="flex items-center space-x-6">
          <div 
            onClick={() => onSelectTab('DASHBOARD')}
            className="cursor-pointer flex items-center space-x-2"
          >
            <span className="text-xl font-black lowercase tracking-tight text-white font-sans">
              theunbound
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30 uppercase tracking-widest">
              B2B Agent
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center space-x-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#00C6A6] text-slate-950 shadow-sm font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Active Quote Drawer Button & Agent Profile */}
        <div className="flex items-center space-x-3">
          {/* Active Quotation Badge */}
          <button
            onClick={() => setIsQuoteDrawerOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#00C6A6]" />
            <div className="text-left hidden sm:block">
              <span className="text-[10px] text-slate-400 block leading-tight">Active Quote</span>
              <span className="text-xs font-bold text-[#00E5C0] font-mono leading-tight">
                {(items || []).length > 0 ? formatCurrency(totalSellingPrice, currency) : 'Empty'}
              </span>
            </div>
            <span className="w-5 h-5 rounded-full bg-[#00C6A6] text-slate-950 text-[11px] font-extrabold flex items-center justify-center">
              {(items || []).length}
            </span>
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-900 text-slate-200 transition-colors cursor-pointer border border-transparent hover:border-slate-800"
            >
              <img
                src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                alt={user?.name || 'Agent'}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#00C6A6]"
              />
              <span className="hidden md:inline text-xs font-bold text-slate-200 max-w-[100px] truncate">
                {user?.name || 'Agent'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setIsUserMenuOpen(false)}
              >
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-xs font-bold text-white">{user?.name || 'Elena Rostova'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email || 'agent@theunbound.in'}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00C6A6]/20 text-[#00E5C0]">
                    {user?.agencyName || 'Partner Agency'}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => onSelectTab('ACCOUNT')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center space-x-2"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Agency Account & Profile</span>
                  </button>
                  <button
                    onClick={() => onSelectTab('MY_QUOTES')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center space-x-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Quotes & Proposals</span>
                  </button>
                  <button
                    onClick={() => onSelectTab('BOOKINGS')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 flex items-center space-x-2"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Manage Bookings & Vouchers</span>
                  </button>
                </div>

                <div className="border-t border-slate-800 pt-1">
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-950/40 flex items-center space-x-2"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="xl:hidden p-2 text-slate-400 hover:text-white focus:outline-none"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Strip on Medium Screens / Tablet */}
      <div className="hidden md:flex xl:hidden px-4 sm:px-6 py-2 bg-slate-900/90 border-t border-slate-800/80 overflow-x-auto gap-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#00C6A6] text-slate-950 font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden bg-slate-900 border-t border-slate-800 p-4 space-y-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                  isActive
                    ? 'bg-[#00C6A6] text-slate-950 font-extrabold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
