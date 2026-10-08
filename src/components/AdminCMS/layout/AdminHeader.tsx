import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Bell, 
  HelpCircle, 
  ChevronDown, 
  Menu, 
  Maximize2, 
  Minimize2, 
  FileText, 
  Package, 
  Users, 
  CalendarCheck, 
  LayoutTemplate, 
  Globe2, 
  UserCheck, 
  Activity, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { User } from '../../../types';
import { CMSNotificationsDropdown } from '../CMSNotificationsDropdown';
import { navigateTo } from '../../../services/portalRouter';

interface AdminHeaderProps {
  currentUser: User;
  onOpenSearch: () => void;
  onToggleMobileMenu: () => void;
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
  onLogout: () => void;
  activePortalStats: {
    b2b: number;
    buyer: number;
    total: number;
  };
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentUser,
  onOpenSearch,
  onToggleMobileMenu,
  onNavigate,
  onLogout,
  activePortalStats
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const createRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click & support global Cmd+K shortcut
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setIsCreateOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenSearch]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleCreateAction = (action: string) => {
    setIsCreateOpen(false);
    switch (action) {
      case 'QUOTE':
        onNavigate('LEAD_MANAGEMENT', 'BUILDER', 'new');
        break;
      case 'PRODUCT':
        onNavigate('PRODUCT_MANAGEMENT', 'PRODUCTS');
        break;
      case 'LEAD':
        onNavigate('LEAD_MANAGEMENT', 'LEADS');
        break;
      case 'BOOKING':
        onNavigate('BOOKING_MANAGEMENT', 'BOOKINGS');
        break;
      case 'PAGE':
        onNavigate('PAGE_MANAGEMENT', 'HOMEPAGE');
        break;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 text-slate-800 shrink-0 w-full">
      <div className="w-full px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* LEFT: Mobile Menu Toggle & Global Search Box */}
          <div className="flex items-center space-x-3 flex-1 max-w-2xl min-w-0">
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Search Trigger Bar */}
            <div 
              onClick={onOpenSearch}
              className="flex-1 flex items-center space-x-2.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer shadow-2xs group min-w-0"
              title="Search operations database (⌘K)"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-[#008972] shrink-0" />
              <span className="text-xs text-slate-500 font-medium truncate select-none">
                Search products, hotels, destinations, quotes, bookings...
              </span>
              <kbd className="hidden sm:inline-block ml-auto text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs shrink-0 select-none">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* RIGHT: Tools, Quick Create, Notifications, Active Users, User Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            
            {/* Active Users Indicator */}
            <div
              onClick={() => onNavigate('ACCOUNT_MANAGEMENT', 'USERS_ACCESS')}
              className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer select-none"
              title={`Active Users: B2B: ${activePortalStats.b2b} · Buyer: ${activePortalStats.buyer}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-700 font-bold whitespace-nowrap text-xs">
                B2B: {activePortalStats.b2b}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 font-bold whitespace-nowrap text-xs">
                Buyer: {activePortalStats.buyer}
              </span>
            </div>

            {/* Quick "+ Create" Dropdown Menu */}
            <div className="relative" ref={createRef}>
              <button
                id="cms-quick-create-btn"
                onClick={() => setIsCreateOpen(!isCreateOpen)}
                className="flex items-center space-x-1.5 px-3 sm:px-3.5 py-2 bg-[#00C6A6] hover:bg-[#00A88F] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer select-none"
              >
                <span className="hidden sm:inline">Create</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCreateOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCreateOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Quick Operations
                    </p>
                  </div>

                  <button
                    onClick={() => handleCreateAction('QUOTE')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2.5 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#00C6A6]/15 text-[#008972] flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span>Create Quote</span>
                  </button>

                  <button
                    onClick={() => handleCreateAction('PRODUCT')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2.5 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <span>Add Product</span>
                  </button>

                  <button
                    onClick={() => handleCreateAction('LEAD')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2.5 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <span>Add Lead</span>
                  </button>

                  <button
                    onClick={() => handleCreateAction('BOOKING')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2.5 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-3.5 h-3.5" />
                    </div>
                    <span>New Booking</span>
                  </button>

                  <button
                    onClick={() => handleCreateAction('PAGE')}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2.5 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <LayoutTemplate className="w-3.5 h-3.5" />
                    </div>
                    <span>Create Page</span>
                  </button>
                </div>
              )}
            </div>

            {/* Notifications Dropdown */}
            <div className="shrink-0">
              <CMSNotificationsDropdown onNavigate={onNavigate} currentUser={currentUser} />
            </div>

            {/* Help / Docs */}
            <button
              onClick={() => onNavigate('INTEGRATIONS_DB', 'INTEGRATIONS_HUB')}
              className="hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="System Help & Integrations"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="hidden xl:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* User Profile Dropdown */}
            <div className="relative shrink-0" ref={userRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#00C6A6] to-[#008972] text-slate-950 font-black text-xs flex items-center justify-center shadow-xs">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[110px]">
                    {currentUser.name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold leading-none">
                    Admin
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in duration-150">
                  <div className="p-3 border-b border-slate-100 mb-1">
                    <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[10px] font-bold">
                        {currentUser.role}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate">
                        {currentUser.agencyName}
                      </span>
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigateTo('/');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[#008972] hover:bg-[#00C6A6]/10 rounded-xl flex items-center space-x-2.5 cursor-pointer"
                    >
                      <Globe2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                      <span>Canonical Homepage (/)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('ACCOUNT_MANAGEMENT', 'PERMISSIONS');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl flex items-center space-x-2.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#008972]" />
                      <span>User Access & RBAC</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate('INTEGRATIONS_DB', 'FIRESTORE_DIAGNOSTICS');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl flex items-center space-x-2.5 cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5 text-[#008972]" />
                      <span>Firestore Diagnostics</span>
                    </button>

                    <div className="pt-1 border-t border-slate-100 mt-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center space-x-2.5 cursor-pointer transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
