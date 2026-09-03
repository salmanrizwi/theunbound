import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe2, 
  Search, 
  FileText, 
  User as UserIcon, 
  LogOut, 
  ShieldCheck, 
  Sparkles, 
  BookOpen, 
  Layers,
  ChevronDown,
  Menu,
  X,
  Briefcase,
  Calendar,
  Clock,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { CurrencyCode, DestinationRegion, Destination, SUPPORTED_CURRENCIES, MenuItemConfig } from '../types';
import { AppDatabase } from '../services/db';
import { canUserAccessCMS, canUserAccessQuoteBuilder } from '../services/permissionEngine';

export type MainNavTab = 'DESTINATIONS' | 'VISAS' | 'B2B_BUILDER' | 'DASHBOARD' | 'ADMIN' | 'ACCOUNT' | 'BLOGS' | 'CONTACT' | 'TERMS' | 'PRIVACY' | 'REFUND' | 'CUSTOM_PAGE' | 'ABOUT';

interface NavbarProps {
  destinations?: Destination[];
  selectedDestinationSlug?: string;
  activeDestination?: string;
  onSelectDestination: (dest: string) => void;
  activeTab?: MainNavTab;
  onSelectTab?: (tab: MainNavTab) => void;
  onSelectCustomPage?: (slug: string) => void;
  activeCustomPageSlug?: string;
  onOpenSearch?: () => void;
  onOpenSpecs: () => void;
  onOpenAdmin?: () => void;
  onOpenDashboard?: () => void;
  onOpenBookings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  destinations = [],
  selectedDestinationSlug,
  activeDestination,
  onSelectDestination,
  activeTab = 'DESTINATIONS',
  onSelectTab,
  onSelectCustomPage,
  activeCustomPageSlug,
  onOpenSearch,
  onOpenSpecs,
  onOpenAdmin,
  onOpenDashboard,
  onOpenBookings
}) => {
  const { user, isAuthenticated, logout, openAuthModal, role } = useAuth();
  const { items, currency, setCurrency, setIsQuoteDrawerOpen } = useQuotation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const db = AppDatabase.getInstance();
  const [cmsMenuItems, setCmsMenuItems] = useState<MenuItemConfig[]>(() => db.getMenuItems());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setCmsMenuItems(db.getMenuItems());
    });
  }, [db]);

  const currentActiveDest = selectedDestinationSlug || activeDestination || 'japan';

  const canAccessB2BQuotes = canUserAccessQuoteBuilder(user, 'B2B').allowed;
  const canAccessAdminCMS = canUserAccessCMS(user);

  // Visible menu items ordered by displayOrder
  const visibleMenuItems = useMemo(() => {
    return cmsMenuItems.filter(m => m.isVisible !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [cmsMenuItems]);

  // Separate Header vs Secondary items
  const headerMenuItems = useMemo(() => {
    return visibleMenuItems.filter(m => !m.menuLocation || m.menuLocation === 'HEADER');
  }, [visibleMenuItems]);

  const secondaryMenuItems = useMemo(() => {
    return visibleMenuItems.filter(m => m.menuLocation === 'SECONDARY');
  }, [visibleMenuItems]);

  // Root header items and helper for child items (hierarchical dropdowns)
  const rootHeaderItems = useMemo(() => {
    return headerMenuItems.filter(m => !m.parentId);
  }, [headerMenuItems]);

  const getChildItems = (parentId: string) => {
    return headerMenuItems.filter(m => m.parentId === parentId);
  };

  const handleMenuItemClick = (item: MenuItemConfig) => {
    setIsMobileNavOpen(false);
    setOpenDropdownId(null);

    // Handle openIn _blank
    if (item.openIn === '_blank') {
      if (item.type === 'CUSTOM_PAGE') {
        window.open(`/pages/${item.targetId}`, '_blank', 'noopener,noreferrer');
        return;
      } else if (item.type === 'CUSTOM_LINK' && item.customUrl) {
        window.open(item.customUrl, '_blank', 'noopener,noreferrer');
        return;
      } else if (item.type === 'EXTERNAL_LINK' && (item.targetUrl || item.customUrl)) {
        window.open(item.targetUrl || item.customUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    }

    if (item.type === 'CUSTOM_PAGE') {
      if (onSelectCustomPage && item.targetId) {
        onSelectCustomPage(item.targetId);
      }
    } else if (item.type === 'DESTINATION') {
      if (onSelectTab) onSelectTab('DESTINATIONS');
      if (item.targetId) onSelectDestination(item.targetId);
    } else if (item.type === 'CUSTOM_LINK' && item.customUrl) {
      if (item.customUrl.startsWith('http')) {
        window.open(item.customUrl, '_blank', 'noopener,noreferrer');
      } else if (item.customUrl.startsWith('#')) {
        const el = document.querySelector(item.customUrl);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.location.href = item.customUrl;
      }
    } else if (item.type === 'SYSTEM_VIEW') {
      const target = item.targetId || 'home';
      if (target === 'home' || target === 'destinations') {
        if (onSelectTab) onSelectTab('DESTINATIONS');
        onSelectDestination('all');
      } else if (target === 'japan' || target === 'united-kingdom' || target === 'europe') {
        if (onSelectTab) onSelectTab('DESTINATIONS');
        onSelectDestination(target);
      } else if (target === 'visas') {
        if (onSelectTab) onSelectTab('VISAS');
      } else if (target === 'b2b') {
        if (onSelectTab) onSelectTab('B2B_BUILDER');
      } else if (target === 'contact') {
        if (onSelectTab) onSelectTab('CONTACT');
      } else if (target === 'about') {
        if (onSelectTab) onSelectTab('ABOUT');
        if (onSelectCustomPage) onSelectCustomPage('about-theunbound');
      } else if (target === 'blogs') {
        if (onSelectTab) onSelectTab('BLOGS');
      } else if (target === 'terms') {
        if (onSelectTab) onSelectTab('TERMS');
      } else if (target === 'privacy') {
        if (onSelectTab) onSelectTab('PRIVACY');
      } else if (target === 'refund') {
        if (onSelectTab) onSelectTab('REFUND');
      }
    }
  };

  const isItemActive = (item: MenuItemConfig): boolean => {
    if (item.type === 'CUSTOM_PAGE') {
      return activeTab === 'CUSTOM_PAGE' && activeCustomPageSlug === item.targetId;
    } else if (item.type === 'DESTINATION') {
      return activeTab === 'DESTINATIONS' && currentActiveDest === item.targetId;
    } else if (item.type === 'SYSTEM_VIEW') {
      if (item.targetId === 'home' || item.targetId === 'destinations') {
        return activeTab === 'DESTINATIONS' && (currentActiveDest === 'all' || !currentActiveDest);
      } else if (item.targetId === 'b2b') {
        return activeTab === 'B2B_BUILDER';
      } else if (item.targetId === 'contact') {
        return activeTab === 'CONTACT';
      } else if (item.targetId === 'about') {
        return activeTab === 'ABOUT' || (activeTab === 'CUSTOM_PAGE' && activeCustomPageSlug === 'about-theunbound');
      } else if (item.targetId === 'blogs') {
        return activeTab === 'BLOGS';
      } else if (item.targetId === 'terms') {
        return activeTab === 'TERMS';
      } else if (item.targetId === 'privacy') {
        return activeTab === 'PRIVACY';
      } else if (item.targetId === 'refund') {
        return activeTab === 'REFUND';
      } else {
        return activeTab === 'DESTINATIONS' && currentActiveDest === item.targetId;
      }
    }
    return false;
  };

  const isB2BAgentOrAdmin = role === 'B2B_AGENT' || role === 'ADMIN' || role === 'TEAM_MEMBER' || role === 'DMC_STAFF';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner for Operations & SLA Status */}
      <div className="bg-slate-950 text-slate-300 text-xs px-4 sm:px-8 py-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            DMC Operations Portal
          </span>
          <span className="hidden sm:inline text-slate-400 text-xs flex items-center space-x-1.5">
            <Clock className="w-3 h-3 text-[#00C6A6]" />
            <span>24–48h Ground Confirmation SLA • Contracted B2B Wholesale Inventory</span>
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {/* Secondary Menu Utility Links */}
          {secondaryMenuItems.length > 0 && (
            <div className="hidden lg:flex items-center space-x-3 text-xs border-r border-slate-800 pr-3 mr-1">
              {secondaryMenuItems.map(secItem => (
                <button
                  key={secItem.id}
                  id={`sec-nav-${secItem.id}`}
                  onClick={() => handleMenuItemClick(secItem)}
                  className="text-slate-300 hover:text-[#00E5C0] font-medium transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <span>{secItem.label}</span>
                  {secItem.badgeText && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-[#00C6A6]/20 text-[#00E5C0] rounded">
                      {secItem.badgeText}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <button 
            id="nav-btn-specs"
            onClick={onOpenSpecs}
            className="flex items-center space-x-1.5 text-[#00C6A6] hover:text-[#00E5C0] font-medium transition-colors cursor-pointer text-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Platform Specs</span>
          </button>
          <span className="text-slate-700 hidden md:inline">|</span>
          {canAccessAdminCMS && onOpenAdmin && (
            <button
              id="top-nav-admin-cms"
              onClick={onOpenAdmin}
              className="flex items-center space-x-1 px-2.5 py-0.5 rounded bg-[#00C6A6]/20 hover:bg-[#00C6A6]/30 border border-[#00C6A6]/40 text-[#00E5C0] text-xs font-bold transition-colors cursor-pointer"
              title="Open Admin CMS Operations Engine"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>Admin CMS</span>
            </button>
          )}
          <div className="flex items-center space-x-2 text-slate-400 text-xs">
            <Globe2 className="w-3.5 h-3.5 text-[#00C6A6]" />
            <span className="hidden sm:inline">Currency:</span>
            <select
              id="currency-selector"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="bg-slate-800 text-white rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#00C6A6] cursor-pointer border border-slate-700 hover:bg-slate-750 transition-colors"
            >
              {SUPPORTED_CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Quotation Cart in Upper Section */}
          {(isB2BAgentOrAdmin || items.length > 0) && (
            <button
              id="quote-cart-btn"
              onClick={() => setIsQuoteDrawerOpen(true)}
              className="relative flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-xs"
              title="Open Quotation Cart"
            >
              <FileText className="w-3.5 h-3.5 text-[#00C6A6]" />
              <span className="hidden sm:inline">Cart</span>
              {items.length > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-[#00C6A6] text-slate-950 rounded-full">
                  {items.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Destination Tabs */}
          <div className="flex items-center space-x-6">
            <div 
              onClick={() => {
                if (onSelectTab) onSelectTab('DESTINATIONS');
                onSelectDestination('all');
              }} 
              className="flex items-center cursor-pointer group"
              id="brand-logo"
            >
              <span className="text-xl sm:text-2xl font-black tracking-tight text-[#00C6A6] font-sans lowercase select-none group-hover:text-[#00b296] transition-colors">
                theunbound
              </span>
            </div>

            {/* Desktop Dynamic Navigation Links from CMS */}
            <nav className="hidden lg:flex items-center space-x-1 pl-4 border-l border-slate-200">
              {rootHeaderItems.map((item) => {
                const children = getChildItems(item.id);
                const hasChildren = children.length > 0;
                const isCurrentActive = isItemActive(item) || children.some(c => isItemActive(c));
                const isDropdownOpen = openDropdownId === item.id;

                if (hasChildren) {
                  return (
                    <div 
                      key={item.id} 
                      className="relative"
                      onMouseEnter={() => setOpenDropdownId(item.id)}
                      onMouseLeave={() => setOpenDropdownId(null)}
                    >
                      <button
                        id={`menu-nav-${item.id}`}
                        onClick={() => setOpenDropdownId(isDropdownOpen ? null : item.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          isCurrentActive
                            ? 'bg-[#00C6A6]/10 text-[#00C6A6] font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isCurrentActive ? 'bg-[#00C6A6]' : 'bg-slate-300'}`}></span>
                        <span>{item.label}</span>
                        {item.badgeText && (
                          <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded-full bg-[#00C6A6]/20 text-[#00a88d]">
                            {item.badgeText}
                          </span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-[#00C6A6]' : 'text-slate-400'}`} />
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                          {/* Option to navigate to parent if parent has a target */}
                          {item.type !== 'CUSTOM_LINK' && (
                            <button
                              onClick={() => handleMenuItemClick(item)}
                              className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50 flex items-center justify-between border-b border-slate-100"
                            >
                              <span>Overview ({item.label})</span>
                            </button>
                          )}
                          {children.map(child => {
                            const isChildActive = isItemActive(child);
                            return (
                              <button
                                key={child.id}
                                id={`menu-sub-${child.id}`}
                                onClick={() => handleMenuItemClick(child)}
                                className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                  isChildActive 
                                    ? 'bg-[#00C6A6]/10 text-[#00C6A6] font-bold' 
                                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                <span>{child.label}</span>
                                {child.badgeText && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-[#00C6A6]/20 text-[#00a88d]">
                                    {child.badgeText}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    id={`menu-nav-${item.id}`}
                    onClick={() => handleMenuItemClick(item)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      isCurrentActive
                        ? 'bg-[#00C6A6]/10 text-[#00C6A6] font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isCurrentActive ? 'bg-[#00C6A6]' : 'bg-slate-300'}`}></span>
                    <span>{item.label}</span>
                    {item.badgeText && (
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded-full bg-[#00C6A6]/20 text-[#00a88d]">
                        {item.badgeText}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Action Icons & Auth */}
          <div className="flex items-center space-x-3">
            {/* Search Trigger */}
            {onOpenSearch && (
              <button
                id="search-trigger-btn"
                onClick={onOpenSearch}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4 text-slate-400" />
                <span className="hidden xl:inline text-xs text-slate-500 font-medium">Quick Search...</span>
              </button>
            )}

            {/* User Auth Section */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-1 pl-1.5 pr-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 bg-white transition-colors cursor-pointer"
                >
                  <img
                    src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-[#00C6A6]"
                  />
                  <div className="text-left hidden md:block">
                    <p className="text-xs font-bold text-slate-800 leading-tight">{user.name}</p>
                    <p className="text-[10px] font-semibold text-[#00C6A6] uppercase tracking-wider">{user.role}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu - Includes Dashboard & Quotes exclusively for B2B Agents */}
                {isUserMenuOpen && (
                  <div 
                    id="user-dropdown-panel"
                    className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in"
                  >
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      {user.agencyName && (
                        <p className="text-[11px] text-[#00C6A6] font-medium mt-0.5">{user.agencyName}</p>
                      )}
                    </div>

                    <div className="py-1">
                      <button
                        id="user-menu-account"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onSelectTab) onSelectTab('ACCOUNT');
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer font-medium"
                      >
                        <UserIcon className="w-4 h-4 text-[#00C6A6]" />
                        <span>Profile & Company Details</span>
                      </button>

                      <button
                        id="user-menu-bookings"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onOpenBookings) onOpenBookings();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer font-medium"
                      >
                        <Calendar className="w-4 h-4 text-[#00C6A6]" />
                        <span>Bookings</span>
                      </button>

                      <button
                        id="user-menu-dashboard"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          if (onSelectTab) onSelectTab('DASHBOARD');
                          if (onOpenDashboard) onOpenDashboard();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                      >
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>Quotes & Dashboard</span>
                      </button>

                      {canAccessAdminCMS && onOpenAdmin && (
                        <button
                          id="user-menu-admin-cms"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenAdmin();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 cursor-pointer font-bold border-b border-slate-100"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Admin CMS Operations</span>
                        </button>
                      )}

                      <button
                        id="user-menu-specs"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenSpecs();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <span>Platform Specifications</span>
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      <button
                        id="user-menu-logout"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  id="nav-login-btn"
                  onClick={() => openAuthModal('Sign in to access B2B dynamic pricing, custom quotes, and ground bookings.')}
                  className="bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm shadow-[#00C6A6]/20 cursor-pointer"
                >
                  Agent Login
                </button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              {isMobileNavOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {isMobileNavOpen && (
          <div className="lg:hidden border-t border-slate-200 py-3 space-y-1 animate-in fade-in">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Navigation Menu</p>
            {rootHeaderItems.map((item) => {
              const children = getChildItems(item.id);
              const hasChildren = children.length > 0;
              const isCurrentActive = isItemActive(item) || children.some(c => isItemActive(c));
              const isSubOpen = openDropdownId === item.id;

              if (hasChildren) {
                return (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-slate-50">
                      <button
                        onClick={() => handleMenuItemClick(item)}
                        className={`flex items-center gap-2 text-sm font-medium ${
                          isCurrentActive ? 'text-[#00C6A6] font-bold' : 'text-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isCurrentActive ? 'bg-[#00C6A6]' : 'bg-slate-300'}`}></span>
                        <span>{item.label}</span>
                        {item.badgeText && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#00C6A6]/20 text-[#00a88d]">
                            {item.badgeText}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setOpenDropdownId(isSubOpen ? null : item.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isSubOpen ? 'rotate-180 text-[#00C6A6]' : ''}`} />
                      </button>
                    </div>

                    {isSubOpen && (
                      <div className="pl-6 space-y-0.5 border-l-2 border-slate-100 ml-4 py-1">
                        {children.map(child => {
                          const isChildActive = isItemActive(child);
                          return (
                            <button
                              key={child.id}
                              onClick={() => handleMenuItemClick(child)}
                              className={`w-full text-left px-3 py-1.5 text-xs rounded-md flex items-center justify-between ${
                                isChildActive ? 'bg-[#00C6A6]/10 text-[#00C6A6] font-bold' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span>{child.label}</span>
                              {child.badgeText && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#00C6A6]/20 text-[#00a88d]">
                                  {child.badgeText}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuItemClick(item)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                    isCurrentActive ? 'bg-[#00C6A6]/10 text-[#00C6A6] font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isCurrentActive ? 'bg-[#00C6A6]' : 'bg-slate-300'}`}></span>
                    <span>{item.label}</span>
                  </div>
                  {item.badgeText && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#00C6A6]/20 text-[#00a88d]">
                      {item.badgeText}
                    </span>
                  )}
                </button>
              );
            })}

            {secondaryMenuItems.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-0.5">
                <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick Links</p>
                {secondaryMenuItems.map(secItem => (
                  <button
                    key={secItem.id}
                    onClick={() => handleMenuItemClick(secItem)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 rounded flex items-center justify-between"
                  >
                    <span>{secItem.label}</span>
                    {secItem.badgeText && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#00C6A6]/20 text-[#00a88d]">
                        {secItem.badgeText}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {onSelectTab && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                {isAuthenticated && (
                  <>
                    <button
                      onClick={() => {
                        onSelectTab('ACCOUNT');
                        setIsMobileNavOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-sm font-bold text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="flex items-center space-x-2">
                        <UserIcon className="w-4 h-4 text-[#00C6A6]" />
                        <span>Profile & Company Details</span>
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        if (onOpenBookings) onOpenBookings();
                        setIsMobileNavOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-sm font-bold text-slate-800 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-[#00C6A6]" />
                        <span>Bookings</span>
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectTab('DASHBOARD');
                        if (onOpenDashboard) onOpenDashboard();
                        setIsMobileNavOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span className="flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>Quotes & Dashboard</span>
                      </span>
                    </button>
                    {canAccessAdminCMS && onOpenAdmin && (
                      <button
                        onClick={() => {
                          onOpenAdmin();
                          setIsMobileNavOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-between"
                      >
                        <span className="flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Admin CMS Operations</span>
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center px-3">
              <span className="text-xs text-slate-500 font-bold flex items-center space-x-1.5">
                <Globe2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Currency</span>
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="bg-slate-100 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold border border-slate-200"
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) - {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
