import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Compass, 
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
  Clock, 
  ShieldCheck, 
  Globe2, 
  ChevronDown, 
  Menu, 
  X,
  FileCheck,
  Bell,
  AlertTriangle,
  Calendar,
  DollarSign,
  Briefcase,
  ArrowRight,
  TrendingUp,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { B2BTabType, CurrencyCode, SUPPORTED_CURRENCIES } from '../../types';
import { formatCurrency } from '../../services/pricingEngine';
import { AppDatabase } from '../../services/db';
import { VISA_CATALOG } from './B2BVisaView';

export type { B2BTabType };

interface B2BPortalNavbarProps {
  activeTab: B2BTabType;
  onSelectTab: (tab: B2BTabType) => void;
  quoteItemCount?: number;
}

export const B2BPortalNavbar: React.FC<B2BPortalNavbarProps> = ({
  activeTab,
  onSelectTab,
  quoteItemCount
}) => {
  const { user, logout } = useAuth();
  const { items, totalSellingPrice, currency, setCurrency, setIsQuoteDrawerOpen } = useQuotation();
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const db = AppDatabase.getInstance();
  const [dataVersion, setDataVersion] = useState(0);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setDataVersion(v => v + 1);
    });
  }, [db]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live Database Counts for B2B Navigation
  const packagesCount = db.getPackages().length;
  const productsCount = db.getProducts().length;
  const hotelsCount = db.getHotels().length;
  const visasCount = VISA_CATALOG.length;
  const quotesCount = user ? db.getQuotesForUser(user).length : db.getAllSavedQuotes().length;
  const bookingsCount = user ? db.getBookingsForUser(user).length : db.getAllBookings().length;
  const pendingBookingsCount = db.getAllBookings().filter(b => b.status === 'NEW' || b.status === 'TO_BE_PROCESSED' || b.status === 'PROCESSING' || b.status === 'WAITING_FOR_UPDATE').length;
  const customersCount = db.getB2BCustomers().length;
  
  // Real Tasks and Overdue Counts
  const allTasks = db.getB2BTasks(user?.id);
  const pendingTasksCount = allTasks.filter(t => t.status !== 'COMPLETED').length;
  const overdueTasksCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return allTasks.filter(t => t.status !== 'COMPLETED' && t.dueDate && t.dueDate < today).length;
  }, [allTasks]);

  // Action Centre Aggregated Items
  const actionItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const overdue = allTasks.filter(t => t.status !== 'COMPLETED' && t.dueDate && t.dueDate < today);
    const pendingBks = db.getAllBookings().filter(b => b.status === 'NEW' || b.status === 'TO_BE_PROCESSED' || b.status === 'PROCESSING' || b.status === 'WAITING_FOR_UPDATE');
    const sentQuotes = (user ? db.getQuotesForUser(user) : db.getAllSavedQuotes()).filter(q => q.status === 'SENT' || q.status === 'DRAFT');

    return {
      overdueTasks: overdue,
      pendingBookings: pendingBks,
      activeQuotes: sentQuotes,
      totalUrgent: overdue.length + pendingBks.length
    };
  }, [allTasks, db, user]);

  const navItems: { 
    id: B2BTabType; 
    label: string; 
    icon: React.FC<{ className?: string }>;
    count?: number;
    alertCount?: number;
  }[] = [
    { id: 'home', label: 'Home', icon: Compass },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: ShoppingBag, count: productsCount },
    { id: 'hotels', label: 'Hotels', icon: Building2, count: hotelsCount },
    { id: 'packages', label: 'Packages', icon: Layers, count: packagesCount },
    { id: 'visa', label: 'Visa', icon: FileCheck, count: visasCount },
    { id: 'create-quote', label: 'Quote Builder', icon: PlusCircle },
    { id: 'bookings', label: 'Bookings', icon: BookmarkCheck, count: bookingsCount, alertCount: pendingBookingsCount },
    { id: 'tasks', label: 'My Tasks', icon: CheckSquare, count: pendingTasksCount, alertCount: overdueTasksCount }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs">
      {/* Top Professional B2B Header Bar (Bright & Crisp) */}
      <div className="bg-slate-900 text-white px-4 sm:px-6 py-1.5 flex items-center justify-between text-xs border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#00E5C0] animate-pulse"></span>
            <span className="font-bold text-[#00E5C0] uppercase tracking-wider text-[11px]">
              Travel Agent Portal
            </span>
          </div>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline text-slate-300 font-semibold truncate max-w-xs">
            {user?.agencyName || 'Luxury Discovery Travel Trade Desk'}
          </span>
          <span className="hidden lg:inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
            <ShieldCheck className="w-3 h-3 text-[#00C6A6]" />
            <span>Verified Wholesale Rates & 24h Ground SLA</span>
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Currency Switcher */}
          <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg">
            <Globe2 className="w-3 h-3 text-slate-400" />
            <select
              id="b2b-currency-selector-nav-upper"
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

          {/* B2B Cart Drawer Trigger Button in Upper Header Bar */}
          <button
            id="b2b-cart-drawer-trigger-btn"
            onClick={() => setIsQuoteDrawerOpen(true)}
            className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all cursor-pointer shadow-xs"
            title="Open Quotation Cart & Configured Items"
          >
            <div className="relative">
              <ShoppingBag className="w-3.5 h-3.5 text-[#00E5C0]" />
              {items.length > 0 && (
                <span className="absolute -top-2 -right-2 w-3.5 h-3.5 rounded-full bg-[#00E5C0] text-slate-950 text-[9px] font-black flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </div>
            <span className="hidden sm:inline text-[11px] font-bold">Cart</span>
            {items.length > 0 && (
              <span className="hidden md:inline text-[11px] font-extrabold text-[#00E5C0] font-mono pl-1.5 border-l border-slate-700">
                {formatCurrency(totalSellingPrice, currency)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Agent Navigation Row */}
      <div className="px-4 sm:px-6 flex items-center justify-between h-16 bg-white">
        {/* Brand Logo & Portal Badge */}
        <div className="flex items-center space-x-8">
          <div 
            onClick={() => onSelectTab('home')}
            className="cursor-pointer flex items-center group"
          >
            <img 
              src="/White Icon.jpg?v=3" 
              alt="TheUnbound" 
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/white-icon.jpg?v=3';
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg mr-2.5 sm:mr-3 shadow-xs transition-transform group-hover:scale-105 shrink-0 object-contain" 
            />
            <div>
              <span className="text-xl font-black lowercase tracking-tight text-slate-950 group-hover:text-[#00a88c] transition-colors font-sans block leading-none">
                theunbound
              </span>
              <span className="text-[9px] font-extrabold text-[#00a88c] uppercase tracking-widest block mt-0.5">
                B2B Agent Portal
              </span>
            </div>
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
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-950 text-white shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#00E5C0]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      item.alertCount && item.alertCount > 0
                        ? 'bg-rose-500 text-white animate-pulse'
                        : isActive
                        ? 'bg-slate-800 text-[#00E5C0]'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Action Centre (Bell), Agent Profile */}
        <div className="flex items-center space-x-2.5">
          {/* Action Centre (Bell 🔔 with Live Aggregated Notifications) */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              title="Action Centre & Reminders"
            >
              <Bell className="w-4 h-4" />
              {actionItems.totalUrgent > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                  {actionItems.totalUrgent}
                </span>
              )}
            </button>

            {/* Action Centre Dropdown Popover */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-5 py-2 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Action Centre</h4>
                    <p className="text-[11px] text-slate-500">Live booking alerts & SLA reminders</p>
                  </div>
                  {actionItems.totalUrgent > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                      {actionItems.totalUrgent} URGENT
                    </span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto p-3 space-y-2 text-xs">
                  {/* Overdue Tasks (RED) */}
                  {actionItems.overdueTasks.length > 0 && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-rose-800 flex items-center space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Overdue Tasks ({actionItems.overdueTasks.length})</span>
                        </span>
                        <button
                          onClick={() => {
                            onSelectTab('tasks');
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                        >
                          View Tasks →
                        </button>
                      </div>
                      <div className="space-y-1">
                        {actionItems.overdueTasks.slice(0, 2).map(task => (
                          <div key={task.id} className="text-[11px] text-rose-900 flex items-center justify-between">
                            <span className="font-medium truncate max-w-[200px]">{task.title}</span>
                            <span className="text-[10px] font-mono text-rose-600 font-bold">Due {task.dueDate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending Bookings (RED / Operations Alert) */}
                  {actionItems.pendingBookings.length > 0 && (
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-amber-800 flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pending Bookings ({actionItems.pendingBookings.length})</span>
                        </span>
                        <button
                          onClick={() => {
                            onSelectTab('bookings');
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                        >
                          View Bookings →
                        </button>
                      </div>
                      <div className="space-y-1">
                        {actionItems.pendingBookings.slice(0, 2).map(bk => (
                          <div key={bk.id} className="text-[11px] text-amber-900 flex items-center justify-between">
                            <span className="font-medium truncate max-w-[190px]">{bk.bookingReference} — {bk.leadPassengerName || 'Guest'}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">Awaiting Ops</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Quotations Requiring Follow-Up */}
                  {actionItems.activeQuotes.length > 0 && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span>Active Proposals ({actionItems.activeQuotes.length})</span>
                        </span>
                        <button
                          onClick={() => {
                            onSelectTab('my-quotes');
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[11px] font-bold text-slate-700 hover:underline cursor-pointer"
                        >
                          View Quotes →
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">Proposals ready for client sharing or conversion to booking.</p>
                    </div>
                  )}

                  {actionItems.totalUrgent === 0 && actionItems.activeQuotes.length === 0 && (
                    <div className="p-4 text-center text-slate-400 space-y-1">
                      <ShieldCheck className="w-6 h-6 mx-auto text-[#00C6A6]" />
                      <p className="font-bold text-slate-700">All Operations Current</p>
                      <p className="text-[11px]">No overdue tasks or pending booking SLA blockers.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Account Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-2xl hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer border border-slate-200"
            >
              <img
                src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                alt={user?.name || 'Agent'}
                className="w-7 h-7 rounded-xl object-cover ring-1 ring-[#00C6A6]"
              />
              <span className="hidden md:inline text-xs font-bold text-slate-900 max-w-[110px] truncate">
                {user?.name || 'Partner Agent'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-3xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                onClick={() => setIsUserMenuOpen(false)}
              >
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-900">{user?.name || 'Partner Travel Agent'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email || 'agent@theunbound.in'}</p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#00C6A6]/20 text-[#008a73]">
                    {user?.agencyName || 'Wholesale Partner Agency'}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => onSelectTab('dashboard')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 font-bold"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Performance Dashboard</span>
                  </button>
                  <button
                    onClick={() => onSelectTab('my-quotes')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 font-medium"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Quotes & Proposals</span>
                  </button>
                  <button
                    onClick={() => onSelectTab('customers')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 font-medium"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Leads & Clients (CRM)</span>
                  </button>
                  <button
                    onClick={() => onSelectTab('account')}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 font-medium"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Agency Account & Profile</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer font-bold"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="xl:hidden p-2 text-slate-600 hover:text-slate-950 focus:outline-none"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Strip on Medium Screens / Tablet */}
      <div className="hidden md:flex xl:hidden px-4 sm:px-6 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto gap-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                isActive
                  ? 'bg-slate-950 text-white font-extrabold'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00E5C0]' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  item.alertCount && item.alertCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden bg-white border-t border-slate-200 p-4 space-y-2 animate-in slide-in-from-top-2">
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
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-xs font-bold cursor-pointer transition-all ${
                  isActive
                    ? 'bg-slate-950 text-white font-extrabold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    item.alertCount && item.alertCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
