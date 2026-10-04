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
  ChevronRight,
  ChevronLeft,
  ChevronUp,
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
  Search,
  Train,
  Car,
  HelpCircle,
  Plus,
  Building,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { B2BTabType, CurrencyCode, SUPPORTED_CURRENCIES } from '../../types';
import { formatCurrency } from '../../services/pricingEngine';
import { AppDatabase } from '../../services/db';
import { navigateTo } from '../../services/portalRouter';

export type { B2BTabType };

interface SidebarNavChild {
  id: string;
  label: string;
  subCategory: 'VISA' | 'PROTECTION' | 'GROUND';
  icon: React.ElementType;
}

interface SidebarNavItem {
  id: B2BTabType;
  label: string;
  icon: React.ElementType;
  count?: number;
  alertCount?: number;
  isPrimary?: boolean;
  children?: SidebarNavChild[];
}

interface SidebarNavGroup {
  title: string;
  items: SidebarNavItem[];
}

interface B2BPortalSidebarProps {
  activeTab: B2BTabType;
  activeSubCategory?: string;
  onSelectTab: (tab: B2BTabType, subCategory?: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

/**
 * Persistent Fixed Left Sidebar Navigation Component
 * Features a TOP-positioned collapse/expand toggle button inside the top header.
 * Collapses from ~240px to ~72px, revealing maximum workspace width seamlessly.
 */
export const B2BPortalSidebar: React.FC<B2BPortalSidebarProps> = ({
  activeTab,
  activeSubCategory,
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [dataVersion, setDataVersion] = useState(0);

  // Sidebar Collapse / Expand state with LocalStorage persistence
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('b2b_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Expanded sections state for collapsible groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({ visa: true });

  useEffect(() => {
    return db.subscribe(() => {
      setDataVersion(v => v + 1);
    });
  }, [db]);

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('b2b_sidebar_collapsed', String(next));
      } catch (e) {
        console.error('Failed to save sidebar collapse state:', e);
      }
      return next;
    });
  };

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

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

  const allTasks = db.getB2BTasks(user?.id);
  const pendingTasksCount = allTasks.filter(t => t.status !== 'COMPLETED').length;
  const overdueTasksCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return allTasks.filter(t => t.status !== 'COMPLETED' && t.dueDate && t.dueDate < today).length;
  }, [allTasks]);

  // Grouped Navigation Definition as in Reference Design
  const navGroups: SidebarNavGroup[] = [
    {
      title: 'EXPLORE & OVERVIEW',
      items: [
        { id: 'home', label: 'Discovery Home', icon: Compass },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'OPERATIONS & INVENTORY',
      items: [
        { id: 'products', label: 'Products & Tours', icon: ShoppingBag, count: productsCount },
        { id: 'hotels', label: 'Hotels & Ryokans', icon: Building2, count: hotelsCount },
        { 
          id: 'visa', 
          label: 'Visa & Ancillaries', 
          icon: FileCheck, 
          count: visasCount,
          children: [
            { id: 'visa_services', label: 'Visa Services', subCategory: 'VISA', icon: FileText },
            { id: 'travel_protection', label: 'Travel Protection', subCategory: 'PROTECTION', icon: ShieldCheck },
            { id: 'ground_connectivity', label: 'Ground & Connectivity', subCategory: 'GROUND', icon: Sparkles }
          ]
        },
        { id: 'packages', label: 'Tour Packages', icon: Layers, count: packagesCount }
      ]
    },
    {
      title: 'SALES & CRM',
      items: [
        { id: 'create-quote', label: 'Quote Builder', icon: PlusCircle, isPrimary: true },
        { id: 'my-quotes', label: 'My Quotes', icon: FileText, count: quotesCount },
        { id: 'bookings', label: 'Bookings', icon: BookmarkCheck, count: bookingsCount, alertCount: pendingBookingsCount },
        { id: 'crm', label: 'Leads & CRM', icon: Users, count: leadsCount },
        { id: 'tasks', label: 'Tasks & SLA', icon: CheckSquare, count: pendingTasksCount, alertCount: overdueTasksCount }
      ]
    },
    {
      title: 'ACCOUNT',
      items: [
        { id: 'account', label: 'Agency & Profile', icon: UserIcon }
      ]
    }
  ];

  const renderNavContent = () => (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Header: Logo + TOP Positioned Toggle Arrow */}
      {!isCollapsed ? (
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10 h-16">
          <div 
            onClick={() => {
              onSelectTab('home');
              if (onCloseMobile) onCloseMobile();
            }}
            className="cursor-pointer flex items-center group shrink-0 min-w-0"
            title="TheUnbound B2B Agent Portal"
          >
            <img 
              src="/White Icon.jpg?v=3" 
              alt="TheUnbound" 
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/white-icon.jpg?v=3';
              }}
              className="w-8 h-8 rounded-lg mr-2.5 shadow-2xs transition-transform group-hover:scale-105 shrink-0 object-contain" 
            />
            <div className="min-w-0 truncate">
              <span className="text-base font-black lowercase tracking-tight text-slate-950 group-hover:text-[#00a88c] transition-colors font-sans block leading-none truncate">
                theunbound
              </span>
              <span className="text-[8px] font-extrabold text-[#00a88c] uppercase tracking-widest block mt-0.5 truncate">
                JAPAN TRAVEL DMC
              </span>
            </div>
          </div>

          {/* Top Positioned Collapse Button ◀ */}
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-[#00C6A6] transition-all cursor-pointer shadow-2xs shrink-0 ml-1"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Close Button for Mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Close Mobile Navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      ) : (
        /* Collapsed Top Header: Compact Logo + TOP Positioned Expand Button ▶ */
        <div className="p-3 border-b border-slate-100 flex flex-col items-center justify-center shrink-0 bg-white sticky top-0 z-10 h-16 gap-1">
          <div 
            onClick={() => onSelectTab('home')}
            className="cursor-pointer group"
            title="TheUnbound B2B Agent Portal"
          >
            <img 
              src="/White Icon.jpg?v=3" 
              alt="TheUnbound" 
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/white-icon.jpg?v=3';
              }}
              className="w-7 h-7 rounded-lg shadow-2xs object-contain group-hover:scale-105 transition-transform" 
            />
          </div>

          {/* Top Positioned Expand Button ▶ */}
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-[#00C6A6] transition-all cursor-pointer shadow-2xs"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Navigation Scrollable Body */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-1.5 py-3 space-y-3' : 'px-3 py-4 space-y-5'} scrollbar-thin scrollbar-thumb-slate-200`}>
        {navGroups.map(group => {
          const isGroupCollapsed = collapsedGroups[group.title];
          return (
            <div key={group.title} className="space-y-1">
              {/* Group Header */}
              {!isCollapsed ? (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full px-2 py-1 flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <span>{group.title}</span>
                  {isGroupCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              ) : (
                <div className="h-px bg-slate-100 my-1.5 mx-1" />
              )}

              {/* Group Items */}
              {(!isGroupCollapsed || isCollapsed) && (
                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id || (item.id === 'crm' && (activeTab === 'leads' || activeTab === 'customers'));
                    const isPrimary = item.isPrimary;

                    if (isCollapsed) {
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectTab(item.id);
                            if (onCloseMobile) onCloseMobile();
                          }}
                          title={`${item.label}${item.count ? ` (${item.count})` : ''}`}
                          className={`w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all cursor-pointer relative group ${
                            isActive
                              ? 'bg-teal-50 text-[#008f77] border-l-2 border-[#00C6A6] font-bold shadow-2xs'
                              : isPrimary
                              ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold'
                              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive 
                              ? 'text-[#00C6A6]' 
                              : isPrimary
                              ? 'text-emerald-600'
                              : 'text-slate-400 group-hover:text-slate-600'
                          }`} />

                          {/* Compact Alert / Count Dot */}
                          {item.count !== undefined && item.count > 0 && (
                            <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                              item.alertCount && item.alertCount > 0
                                ? 'bg-rose-500 animate-pulse'
                                : 'bg-[#00C6A6]'
                            }`} />
                          )}
                        </button>
                      );
                    }

                    const hasChildren = !!(item.children && item.children.length > 0);
                    const isExpanded = expandedItems[item.id] ?? true;

                    return (
                      <div key={item.id} className="space-y-0.5">
                        <div
                          onClick={() => {
                            onSelectTab(item.id);
                            if (hasChildren && !expandedItems[item.id]) {
                              setExpandedItems(prev => ({ ...prev, [item.id]: true }));
                            }
                            if (!hasChildren && onCloseMobile) onCloseMobile();
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer group ${
                            isActive
                              ? 'bg-teal-50 text-[#008f77] border-l-4 border-[#00C6A6] font-bold shadow-2xs'
                              : isPrimary
                              ? 'bg-emerald-50/80 text-emerald-900 border border-emerald-200/80 hover:bg-emerald-100/80 font-bold'
                              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive 
                                ? 'text-[#00C6A6]' 
                                : isPrimary
                                ? 'text-emerald-600'
                                : 'text-slate-400 group-hover:text-slate-600'
                            }`} />
                            <span className="truncate">{item.label}</span>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            {/* Counts / Alert Badge */}
                            {item.count !== undefined && item.count > 0 && (
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold shrink-0 ${
                                item.alertCount && item.alertCount > 0
                                  ? 'bg-rose-500 text-white animate-pulse'
                                  : isActive
                                  ? 'bg-[#00C6A6]/20 text-[#008f77]'
                                  : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                              }`}>
                                {item.count}
                              </span>
                            )}
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                                }}
                                className="p-1 hover:bg-slate-200/60 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                                title={isExpanded ? 'Collapse sub-items' : 'Expand sub-items'}
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Indented Children Sub-Tree */}
                        {hasChildren && isExpanded && (
                          <div className="pl-4 pr-1 space-y-0.5 border-l-2 border-[#00C6A6]/30 ml-4.5 my-1 animate-in fade-in slide-in-from-top-1">
                            {item.children!.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = activeTab === 'visa' && (
                                activeSubCategory === child.subCategory ||
                                (!activeSubCategory && child.subCategory === 'VISA')
                              );

                              return (
                                <button
                                  key={child.id}
                                  id={`b2b-nav-child-${child.id}`}
                                  onClick={() => {
                                    onSelectTab('visa', child.subCategory);
                                    if (onCloseMobile) onCloseMobile();
                                  }}
                                  className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                                    isChildActive
                                      ? 'bg-[#00C6A6]/20 text-[#008972] font-black shadow-2xs border border-[#00C6A6]/40'
                                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
                                  }`}
                                >
                                  <ChildIcon className={`w-3.5 h-3.5 shrink-0 ${isChildActive ? 'text-[#008972]' : 'text-slate-400'}`} />
                                  <span className="truncate">{child.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Card: Trusted Japan Partner Banner (Visible when expanded) */}
      {!isCollapsed && (
        <div className="p-3 shrink-0 border-t border-slate-100">
          <div className="bg-gradient-to-br from-teal-50/90 via-emerald-50/40 to-slate-50 text-slate-800 p-3.5 rounded-2xl space-y-2.5 border border-teal-100/90 shadow-2xs relative overflow-hidden">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#00C6A6] animate-pulse" />
              <span className="text-[10px] font-black text-[#008972] uppercase tracking-wider">
                Trusted DMC Partner
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-600 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
                <span>Real-time Wholesale Pricing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
                <span>Instant Quotation Engine</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
                <span>Dedicated On-Ground Support</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Fixed Sidebar with Smooth Collapse Transition */}
      <aside 
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200/90 shrink-0 h-screen sticky top-0 overflow-y-auto z-30 shadow-2xs transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-16 xl:w-18' : 'w-60 xl:w-64'
        }`}
      >
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Overlay Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200">
            {renderNavContent()}
          </aside>
        </div>
      )}
    </>
  );
};

interface B2BPortalHeaderProps {
  activeTab: B2BTabType;
  onSelectTab: (tab: B2BTabType) => void;
  onToggleMobileMenu?: () => void;
  onOpenCreateQuote?: () => void;
}

/**
 * Top Header Bar Component
 * Provides global search, + Create action button, currency selector, cart drawer trigger,
 * Action Centre notifications popover, and agent profile menu.
 */
export const B2BPortalHeader: React.FC<B2BPortalHeaderProps> = ({
  activeTab,
  onSelectTab,
  onToggleMobileMenu,
  onOpenCreateQuote
}) => {
  const { user, logout } = useAuth();
  const { items, totalSellingPrice, currency, setCurrency, setIsQuoteDrawerOpen } = useQuotation();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');

  const db = AppDatabase.getInstance();
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Database alerts & notification counts
  const allTasks = db.getB2BTasks(user?.id);
  const authorizedBookings = user ? db.getBookingsForUser(user) : [];
  const authorizedLeads = user ? db.getLeadsAuthorized(user) : [];
  const agentNotifications = user ? db.getAgentNotifications(user.id) : [];

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerSearchQuery.trim()) return;
    // Navigate to products catalog or home discovery with pre-filled search
    onSelectTab('products');
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/90 h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 w-full max-w-full min-w-0">
      {/* Left: Mobile Toggle & Global Search Input */}
      <div className="flex items-center space-x-3 flex-1 max-w-xl min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-colors"
            aria-label="Toggle Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Global Search Bar */}
        <form onSubmit={handleGlobalSearchSubmit} className="relative w-full min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search products, hotels, destinations, quotes, bookings..."
            value={headerSearchQuery}
            onChange={(e) => setHeaderSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100/80 border border-slate-200/80 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
          />
        </form>
      </div>

      {/* Right Actions Toolbar */}
      <div className="flex items-center space-x-2.5 shrink-0 pl-3">
        {/* + Create Dropdown Action */}
        <div className="relative" ref={createMenuRef}>
          <button
            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b395] text-slate-950 text-xs font-extrabold transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {isCreateMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
              <button
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  if (onOpenCreateQuote) onOpenCreateQuote();
                  else onSelectTab('create-quote');
                }}
                className="w-full text-left px-4 py-2 hover:bg-teal-50 hover:text-[#008f77] flex items-center space-x-2 font-bold text-slate-800"
              >
                <PlusCircle className="w-4 h-4 text-[#00C6A6]" />
                <span>New Quote</span>
              </button>
              <button
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  onSelectTab('products');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center space-x-2 font-medium text-slate-700"
              >
                <ShoppingBag className="w-4 h-4 text-slate-400" />
                <span>Browse Inventory</span>
              </button>
              <button
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  onSelectTab('crm');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center space-x-2 font-medium text-slate-700"
              >
                <Users className="w-4 h-4 text-slate-400" />
                <span>View Assigned Leads</span>
              </button>
            </div>
          )}
        </div>

        {/* Currency Switcher */}
        <div className="hidden sm:flex items-center space-x-1 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-xl">
          <Globe2 className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="bg-transparent text-slate-900 text-xs font-bold outline-none cursor-pointer"
          >
            {SUPPORTED_CURRENCIES.map(c => (
              <option key={c.code} value={c.code} className="bg-white text-slate-900">
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>

        {/* Quotation Cart Drawer Trigger */}
        <button
          onClick={() => setIsQuoteDrawerOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-900 border border-slate-200 transition-all cursor-pointer relative"
          title="Open Quotation Cart"
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4 text-[#00C6A6]" />
            {items.length > 0 && (
              <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-[#00C6A6] text-slate-950 text-[9px] font-black flex items-center justify-center">
                {items.length}
              </span>
            )}
          </div>
          {items.length > 0 && (
            <span className="hidden md:inline text-xs font-bold text-slate-900 font-mono pl-1 border-l border-slate-300">
              {formatCurrency(totalSellingPrice, currency)}
            </span>
          )}
        </button>

        {/* Action Centre Notifications (Bell 🔔) */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            title="Action Centre & Operational Alerts"
          >
            <Bell className="w-4 h-4" />
            {actionItems.totalUrgent > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                {actionItems.totalUrgent}
              </span>
            )}
          </button>

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

        {/* Need Help / Support Link */}
        <button
          onClick={() => navigateTo('/')}
          className="hidden xl:flex items-center space-x-1 p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-semibold"
          title="Need Help / Support Desk"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
        </button>

        {/* User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2 p-1 pr-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer text-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200/80 text-[#008972] font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="text-left hidden md:block max-w-[110px] truncate">
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
      </div>
    </header>
  );
};

/**
 * Backward Compatible Navbar Wrapper Component
 */
export const B2BPortalNavbar: React.FC<{
  activeTab: B2BTabType;
  onSelectTab: (tab: B2BTabType) => void;
  quoteItemCount?: number;
}> = (props) => {
  return (
    <B2BPortalHeader
      activeTab={props.activeTab}
      onSelectTab={props.onSelectTab}
    />
  );
};

export default B2BPortalNavbar;
