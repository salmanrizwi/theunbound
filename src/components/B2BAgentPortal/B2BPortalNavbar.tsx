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
  LayoutDashboard,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { B2BTabType, CurrencyCode, SUPPORTED_CURRENCIES } from '../../types';
import { formatCurrency } from '../../services/pricingEngine';
import { AppDatabase } from '../../services/db';
import { navigateTo } from '../../services/portalRouter';

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
  const visasCount = db.getVisas().filter(v => v.status === 'ACTIVE' || !v.status).length + 
    db.getTravelProtectionPlans().filter(p => p.status === 'ACTIVE' || !p.status).length + 
    db.getVipGroundServices().filter(s => s.status === 'ACTIVE' || !s.status).length + 
    db.getConnectivityPlans().filter(c => c.status === 'ACTIVE' || !c.status).length;
  const quotesCount = user ? db.getQuotesForUser(user).length : db.getAllSavedQuotes().length;
  const authorizedBookings = user ? db.getBookingsForUser(user) : [];
  const bookingsCount = authorizedBookings.length;
  const pendingBookingsCount = authorizedBookings.filter(b => b.status === 'NEW' || b.status === 'TO_BE_PROCESSED' || b.status === 'PROCESSING' || b.status === 'WAITING_FOR_UPDATE' || b.status === 'PENDING_CONFIRMATION').length;
  
  const authorizedLeads = user ? db.getLeadsAuthorized(user) : [];
  const leadsCount = authorizedLeads.length;

  const agentNotifications = user ? db.getAgentNotifications(user.id) : [];
  
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
    const pendingBks = authorizedBookings.filter(b => b.status === 'NEW' || b.status === 'TO_BE_PROCESSED' || b.status === 'PROCESSING' || b.status === 'WAITING_FOR_UPDATE' || b.status === 'PENDING_CONFIRMATION');
    const sentQuotes = (user ? db.getQuotesForUser(user) : db.getAllSavedQuotes()).filter(q => q.status === 'SENT' || q.status === 'DRAFT');
    const unquotedLeads = authorizedLeads.filter(l => !l.quoteNumber && !l.bookingReference);
    const unreadNotifications = agentNotifications.filter(n => !n.isRead);

    return {
      overdueTasks: overdue,
      pendingBookings: pendingBks,
      activeQuotes: sentQuotes,
      assignedLeads: unquotedLeads,
      notifications: unreadNotifications,
      totalUrgent: overdue.length + pendingBks.length + unquotedLeads.length + unreadNotifications.length
    };
  }, [allTasks, authorizedBookings, authorizedLeads, agentNotifications, db, user]);

  // Grouped Navigation Definition for Clean Desktop & Mobile Hierarchy
  const navSections = [
    {
      group: 'MAIN',
      items: [
        { id: 'home' as B2BTabType, label: 'Discovery', icon: Compass },
        { id: 'dashboard' as B2BTabType, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'products' as B2BTabType, label: 'Products', icon: ShoppingBag, count: productsCount },
        { id: 'hotels' as B2BTabType, label: 'Hotels', icon: Building2, count: hotelsCount },
        { id: 'packages' as B2BTabType, label: 'Packages', icon: Layers, count: packagesCount },
        { id: 'visa' as B2BTabType, label: 'Visa & Ancillaries', icon: FileCheck, count: visasCount },
      ]
    },
    {
      group: 'SALES',
      items: [
        { id: 'create-quote' as B2BTabType, label: 'Quote Builder', icon: PlusCircle, isPrimary: true },
        { id: 'my-quotes' as B2BTabType, label: 'My Quotes', icon: FileText, count: quotesCount },
        { id: 'bookings' as B2BTabType, label: 'Bookings', icon: BookmarkCheck, count: bookingsCount, alertCount: pendingBookingsCount },
      ]
    },
    {
      group: 'OPERATIONS',
      items: [
        { id: 'crm' as B2BTabType, label: 'Leads & CRM', icon: Users, count: leadsCount },
        { id: 'tasks' as B2BTabType, label: 'My Tasks', icon: CheckSquare, count: pendingTasksCount, alertCount: overdueTasksCount }
      ]
    }
  ];

  const allNavItems = useMemo(() => {
    return navSections.flatMap(s => s.items);
  }, [navSections]);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-2xs w-full max-w-full min-w-0">
      {/* Top Global Utility Bar */}
      <div className="bg-slate-900 text-white px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between text-xs border-b border-slate-800">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#00E5C0] animate-pulse"></span>
            <span className="font-bold text-[#00E5C0] uppercase tracking-wider text-[11px]">
              Travel Agent Portal
            </span>
          </div>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline text-slate-300 font-semibold truncate max-w-md">
            {user?.agencyName || 'Luxury Discovery Travel Trade Desk'}
          </span>
          <span className="hidden lg:inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 border border-slate-700 shrink-0">
            <ShieldCheck className="w-3 h-3 text-[#00C6A6]" />
            <span>Direct DMC Wholesale Contract</span>
          </span>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Main Website Link */}
          <button
            onClick={() => navigateTo('/')}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-bold transition-all cursor-pointer"
            title="Return to Public Portal (/)"
          >
            <Globe2 className="w-3 h-3 text-[#00E5C0]" />
            <span className="hidden sm:inline">Main Site</span>
          </button>

          {/* Currency Switcher */}
          <div className="flex items-center space-x-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg">
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

          {/* B2B Cart Trigger */}
          <button
            id="b2b-cart-drawer-trigger-btn"
            onClick={() => setIsQuoteDrawerOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all cursor-pointer"
            title="Open Quotation Cart"
          >
            <div className="relative">
              <ShoppingBag className="w-3.5 h-3.5 text-[#00E5C0]" />
              {items.length > 0 && (
                <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-[#00E5C0] text-slate-950 text-[9px] font-black flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </div>
            <span className="hidden sm:inline text-[11px] font-bold">Cart</span>
            {items.length > 0 && (
              <span className="hidden md:inline text-[11px] font-bold text-[#00E5C0] font-mono pl-1 border-l border-slate-700">
                {formatCurrency(totalSellingPrice, currency)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Navigation Row - Full Width */}
      <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14 bg-white">
        {/* Brand Logo & Compact Tag */}
        <div className="flex items-center space-x-6 min-w-0">
          <div 
            onClick={() => onSelectTab('home')}
            className="cursor-pointer flex items-center group shrink-0"
            title="TheUnbound B2B Agent Portal"
          >
            <img 
              src="/White Icon.jpg?v=3" 
              alt="TheUnbound" 
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/white-icon.jpg?v=3';
              }}
              className="w-8 h-8 rounded-lg mr-2 shadow-2xs transition-transform group-hover:scale-105 shrink-0 object-contain" 
            />
            <div>
              <span className="text-lg font-black lowercase tracking-tight text-slate-950 group-hover:text-[#00a88c] transition-colors font-sans block leading-none">
                theunbound
              </span>
              <span className="text-[8px] font-extrabold text-[#00a88c] uppercase tracking-widest block mt-0.5">
                B2B Agent Portal
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1 overflow-x-auto py-1" aria-label="B2B Main Navigation">
            {allNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'crm' && (activeTab === 'leads' || activeTab === 'customers'));
              const isPrimary = (item as any).isPrimary;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-2xs font-bold'
                      : isPrimary
                      ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 font-bold'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${
                    isActive 
                      ? 'text-[#00E5C0]' 
                      : isPrimary
                      ? 'text-teal-600'
                      : 'text-slate-400'
                  }`} />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
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

        {/* Right Section: Action Centre & Agent Profile */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Action Centre (Bell 🔔) */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              title="Action Centre & Alerts"
            >
              <Bell className="w-4 h-4" />
              {actionItems.totalUrgent > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                  {actionItems.totalUrgent}
                </span>
              )}
            </button>

            {/* Action Centre Dropdown Popover */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Action Centre</h4>
                    <p className="text-[11px] text-slate-500">Live booking alerts & SLA reminders</p>
                  </div>
                  {actionItems.totalUrgent > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                      {actionItems.totalUrgent} URGENT
                    </span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto p-3 space-y-2 text-xs">
                  {/* Overdue Tasks */}
                  {actionItems.overdueTasks.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
                      <div className="flex items-center justify-between text-rose-900 font-bold">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          Overdue Tasks ({actionItems.overdueTasks.length})
                        </span>
                        <button
                          onClick={() => {
                            onSelectTab('tasks');
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[10px] text-rose-700 underline font-bold"
                        >
                          View All
                        </button>
                      </div>
                      {actionItems.overdueTasks.slice(0, 2).map(t => (
                        <div key={t.id} className="text-[11px] text-rose-800 truncate font-mono">
                          • {t.title} (Due: {t.dueDate})
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending Bookings */}
                  {actionItems.pendingBookings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                      <div className="flex items-center justify-between text-amber-900 font-bold">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Pending Bookings ({actionItems.pendingBookings.length})
                        </span>
                        <button
                          onClick={() => {
                            onSelectTab('bookings');
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[10px] text-amber-700 underline font-bold"
                        >
                          View Desk
                        </button>
                      </div>
                      {actionItems.pendingBookings.slice(0, 2).map(bk => (
                        <div key={bk.id} className="text-[11px] text-amber-800 truncate font-mono">
                          • {bk.bookingReference} — {bk.leadPassengerName || 'Guest'}
                        </div>
                      ))}
                    </div>
                  )}

                  {actionItems.totalUrgent === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No urgent operational alerts at this time.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1.5 pr-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer text-xs"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-[#00E5C0] font-black flex items-center justify-center text-xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="text-left hidden md:block max-w-[120px] truncate">
                <div className="font-bold text-slate-900 text-xs truncate leading-tight">
                  {user?.name || 'Agent User'}
                </div>
                <div className="text-[10px] text-slate-400 truncate leading-none">
                  {user?.role || 'B2B Partner'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900 truncate">{user?.name || 'Agent User'}</div>
                  <div className="text-[11px] text-slate-400 truncate">{user?.email || 'agent@theunbound.in'}</div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      onSelectTab('account');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Agency Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      onSelectTab('dashboard');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigateTo('/');
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-teal-50 flex items-center gap-2 text-[#008f77] font-semibold"
                  >
                    <Globe2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>Return to Main Site</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-bold"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-950 focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 p-4 space-y-4 animate-in slide-in-from-top-2 max-h-[calc(100dvh-80px)] overflow-y-auto">
          {navSections.map(section => (
            <div key={section.group} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {section.group}
              </div>
              <div className="space-y-1">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id || (item.id === 'crm' && (activeTab === 'leads' || activeTab === 'customers'));
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span>{item.label}</span>
                      </div>
                      {item.count !== undefined && item.count > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.alertCount && item.alertCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={() => {
                onSelectTab('account');
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100"
            >
              <UserIcon className="w-4 h-4 text-slate-400" />
              <span>Agency Account & Profile</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default B2BPortalNavbar;
