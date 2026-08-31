import React, { useState, useEffect } from 'react';
import { Product, Destination, Quotation, BlogArticle, User } from '../../types';
import { AppDatabase } from '../../services/db';
import { countingEngine } from '../../services/countingEngine';

// Import Sub-Module Managers
import { CMSDashboardHome } from './CMSDashboardHome';
import { CMSGlobalSearch } from './CMSGlobalSearch';
import { CMSNotificationsDropdown } from './CMSNotificationsDropdown';
import { CMSCalendarTasksManager } from './CMSCalendarTasksManager';
import { ProductManager } from './ProductManager';
import { HotelManager } from './HotelManager';
import { BookingsManager } from './BookingsManager';
import { QuoteMasterManager } from './QuoteMasterManager';
import { HomepageManager } from './HomepageManager';
import { InstitutionalPagesManager } from './InstitutionalPagesManager';
import { MenuAndPagesManager } from './MenuAndPagesManager';
import { BlogCMSManager } from './BlogCMSManager';
import { GalleryManager } from './GalleryManager';
import { ReviewManager } from './ReviewManager';
import { RegionCMSManager } from './RegionCMSManager';
import { DestinationCMSManager } from './DestinationCMSManager';
import { CityHubsManager } from './CityHubsManager';
import { DestinationFAQManager } from './DestinationFAQManager';
import { LeadManager } from './LeadManager';
import { UserApprovalAccessManager } from './UserApprovalAccessManager';
import { FinancialsManager } from './FinancialsManager';
import { PromotionManager } from './PromotionManager';
import { EmailCampaignsManager } from './EmailCampaignsManager';
import { AuditTrailViewer } from './AuditTrailViewer';
import { GoogleSheetsSyncManager } from './GoogleSheetsSyncManager';
import { FirestoreDiagnosticsViewer } from './FirestoreDiagnosticsViewer';
import { VisaCMSManager } from './VisaCMSManager';
import { PackageManager } from './PackageManager';
import { RosterAdminManager } from '../RosterAdminManager';
import { IntegrationsManager } from './IntegrationsManager';

// Lucide Icons
import { 
  ShieldCheck, 
  Package, 
  Hotel, 
  CalendarCheck, 
  LayoutTemplate, 
  Compass, 
  Globe2,
  Users, 
  UserCheck, 
  Receipt, 
  Megaphone, 
  BarChart3, 
  Bell, 
  Database, 
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Layers,
  Sparkles,
  CheckCircle2,
  Activity,
  Search,
  LayoutDashboard,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  LucideIcon
} from 'lucide-react';

export type CMSSection = 
  | 'DASHBOARD'
  | 'PRODUCT_MANAGEMENT'
  | 'HOTEL_MANAGEMENT'
  | 'PACKAGE_MANAGEMENT'
  | 'BOOKING_MANAGEMENT'
  | 'PAGE_MANAGEMENT'
  | 'DESTINATION_MANAGEMENT'
  | 'LEAD_MANAGEMENT'
  | 'ACCOUNT_MANAGEMENT'
  | 'MARKETING_MANAGEMENT'
  | 'ANALYTICS_MANAGEMENT'
  | 'NOTIFICATIONS_MANAGEMENT'
  | 'DATABASE_MANAGEMENT';

interface AdminCMSHubProps {
  destinations: Destination[];
  products: Product[];
  onViewProduct?: (product: Product) => void;
  onViewArticle?: (article: BlogArticle) => void;
  onLoadQuote?: (quote: Quotation) => void;
  onCustomizePackage?: (pkg: any) => void;
  initialTab?: string;
}

export const AdminCMSHub: React.FC<AdminCMSHubProps> = ({
  destinations,
  products,
  onViewProduct,
  onViewArticle,
  onLoadQuote,
  onCustomizePackage,
}) => {
  const [activeSection, setActiveSection] = useState<CMSSection>('DASHBOARD');
  const [activeSubTab, setActiveSubTab] = useState<string>('OVERVIEW');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('theunbound_cms_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const db = AppDatabase.getInstance();

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('theunbound_cms_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Get current active admin user
  const currentUser: User = {
    id: 'usr-admin-01',
    name: 'Marcus Vance',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    approvalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00Z',
    agencyName: 'TheUnbound HQ'
  };

  const counts = countingEngine.getCountsBreakdown({ onlyPublished: false });
  const pendingLeads = db.getLeads().filter(l => l.status === 'NEW').length;
  const pendingBookings = db.getAllBookings().filter(b => b.status === 'PENDING_CONFIRMATION').length;
  const pendingUsers = db.getUsers().filter(u => u.approvalStatus === 'PENDING').length;
  const pendingTasks = db.getCalendarTasks().filter(t => t.status === 'PENDING').length;

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 11 Core Parts categorized logically for scanning
  const sidebarGroups: {
    category: string;
    items: { 
      id: CMSSection; 
      partNumber?: number; 
      label: string; 
      icon: LucideIcon; 
      badge?: string;
      alertCount?: number;
      description: string;
      subTabs: { id: string; label: string; icon?: LucideIcon }[];
    }[];
  }[] = [
    {
      category: 'Overview',
      items: [
        {
          id: 'DASHBOARD',
          label: 'Command Dashboard',
          icon: LayoutDashboard,
          description: 'Operations overview, urgent alerts, real-time database metrics, module health, and quick actions.',
          subTabs: [
            { id: 'OVERVIEW', label: 'Command Center Home', icon: LayoutDashboard }
          ]
        }
      ]
    },
    {
      category: 'Operations & Inventory',
      items: [
        {
          id: 'PRODUCT_MANAGEMENT',
          partNumber: 1,
          label: 'Product Management',
          icon: Package,
          badge: `${counts.totalProducts}`,
          description: 'Master ground tour inventory engine, SKU specifications, child/infant rates, adult tiers, and Google Sheets sync.',
          subTabs: [
            { id: 'PRODUCTS', label: `Product Inventory (${counts.totalProducts})`, icon: Package },
            { id: 'VISAS', label: 'Visa Products & Consular Checklists', icon: FileText },
            { id: 'SHEETS_SYNC', label: 'Google Sheets Live Sync', icon: FileSpreadsheet }
          ]
        },
        {
          id: 'HOTEL_MANAGEMENT',
          partNumber: 2,
          label: 'Hotel Management',
          icon: Hotel,
          badge: `${counts.hotels}`,
          description: 'Contracted luxury hotel allotments, room tiers, passenger min/max controls, kids age rules, and meal plan supplements.',
          subTabs: [
            { id: 'HOTELS', label: `Contracted Hotel Roster (${counts.hotels})`, icon: Hotel }
          ]
        },
        {
          id: 'PACKAGE_MANAGEMENT',
          partNumber: 4,
          label: 'Package Management',
          icon: Layers,
          badge: `${db.getPackages().length}`,
          description: 'Ready-Made Multi-City Tour Packages, circuit itineraries, live vs locked pricing, day-by-day builder, and B2B agent customization.',
          subTabs: [
            { id: 'PACKAGES', label: `Ready-Made Packages (${db.getPackages().length})`, icon: Layers }
          ]
        },
        {
          id: 'BOOKING_MANAGEMENT',
          partNumber: 3,
          label: 'Booking Management',
          icon: CalendarCheck,
          badge: `${pendingBookings > 0 ? pendingBookings + ' Alert' : 'Active'}`,
          alertCount: pendingBookings,
          description: 'Ground reservation pipeline, supplier assignment, status verification, 12-hour SLA alerts, and quote archives.',
          subTabs: [
            { id: 'BOOKINGS', label: 'Ground Bookings & Supplier Operations', icon: CalendarCheck },
            { id: 'QUOTES', label: 'Quotation Master Records', icon: Layers }
          ]
        },
        {
          id: 'LEAD_MANAGEMENT',
          partNumber: 6,
          label: 'Lead Management',
          icon: Users,
          badge: `${pendingLeads > 0 ? pendingLeads + ' New' : 'CRM'}`,
          alertCount: pendingLeads,
          description: 'B2B agent inquiries, contact form leads, saved quote requests, PDF download leads, and sales assignment.',
          subTabs: [
            { id: 'LEADS', label: 'CRM Leads & Pipeline', icon: Users }
          ]
        }
      ]
    },
    {
      category: 'Content & Destinations',
      items: [
        {
          id: 'DESTINATION_MANAGEMENT',
          partNumber: 5,
          label: 'Destination Management',
          icon: Compass,
          badge: `${counts.destinations} Dests`,
          description: 'Connected 4-Tier Hierarchy: 1. REGION (Macro) ↓ 2. DESTINATION (Country) ↓ 3. DESTINATION HUB / CITY ↓ 4. PRODUCT / HOTEL / ACTIVITY / TRANSFER / GUIDE.',
          subTabs: [
            { id: 'REGIONS', label: `1. Master Regions (${counts.regions})`, icon: Globe2 },
            { id: 'DESTINATIONS', label: `2. Destinations (${counts.destinations})`, icon: Compass },
            { id: 'CITIES', label: `3. City Hubs (${counts.hubs})`, icon: Layers },
            { id: 'FAQS', label: 'Destination FAQs & Trade Notes', icon: Sparkles }
          ]
        },
        {
          id: 'PAGE_MANAGEMENT',
          partNumber: 4,
          label: 'Page Management',
          icon: LayoutTemplate,
          badge: 'Live',
          description: 'Institutional contact/policies, homepage hero controls, live customer moment gallery, Google reviews, and blogs.',
          subTabs: [
            { id: 'HOMEPAGE', label: 'Homepage & Hero Control', icon: LayoutTemplate },
            { id: 'NAVIGATION_MENU', label: 'Menu & Custom Pages', icon: Layers },
            { id: 'PAGES_LEGAL', label: 'Site Pages & Legal Policies', icon: ShieldCheck },
            { id: 'GALLERY', label: 'Happy Customer Gallery', icon: Sparkles },
            { id: 'REVIEWS', label: 'Google Business Reviews', icon: CheckCircle2 },
            { id: 'BLOGS', label: 'Editorial Articles & Guides', icon: Compass }
          ]
        },
        {
          id: 'MARKETING_MANAGEMENT',
          partNumber: 8,
          label: 'Marketing Management',
          icon: Megaphone,
          badge: 'Deals',
          description: 'Promotional discount campaigns, seasonal banners, early-bird deals, and automated email trigger dispatch.',
          subTabs: [
            { id: 'PROMOTIONS', label: 'Promotions & Deal Campaigns', icon: Megaphone },
            { id: 'CAMPAIGNS', label: 'Email Triggers & Broadcasts', icon: Sparkles }
          ]
        }
      ]
    },
    {
      category: 'Finance & Administration',
      items: [
        {
          id: 'ACCOUNT_MANAGEMENT',
          partNumber: 7,
          label: 'Account Management',
          icon: UserCheck,
          badge: `${pendingUsers > 0 ? pendingUsers + ' Pending' : 'RBAC'}`,
          alertCount: pendingUsers,
          description: 'Admin user approval panel, Direct Buyer vs. B2B Agent segregation, custom margin settings, and staff roster.',
          subTabs: [
            { id: 'USERS_ACCESS', label: 'User Approval & Segregation', icon: UserCheck },
            { id: 'ROSTER', label: 'Staff Roster & Ops Allocation', icon: Users }
          ]
        },
        {
          id: 'ANALYTICS_MANAGEMENT',
          partNumber: 9,
          label: 'Analytics & Financials',
          icon: BarChart3,
          badge: 'Financials',
          description: 'Commercial margin realization, tax on margin reporting, monthly sales revenue, and official GST invoices.',
          subTabs: [
            { id: 'FINANCIALS', label: 'Financial Audit & Invoicing', icon: Receipt }
          ]
        }
      ]
    },
    {
      category: 'System & Audit',
      items: [
        {
          id: 'NOTIFICATIONS_MANAGEMENT',
          partNumber: 10,
          label: 'Notifications & Tasks',
          icon: Bell,
          badge: `${pendingTasks > 0 ? pendingTasks + ' Tasks' : 'SLAs'}`,
          alertCount: pendingTasks,
          description: 'Google Calendar Task SLA automation, 12h booking confirmation alerts, and quote follow-up triggers.',
          subTabs: [
            { id: 'TASKS', label: 'Google Calendar & Ground SLAs', icon: Bell }
          ]
        },
        {
          id: 'DATABASE_MANAGEMENT',
          partNumber: 11,
          label: 'Integrations & Database',
          icon: Database,
          badge: 'Live',
          description: 'Production Integrations Hub for Firestore, Gmail, Calendar, and Sheets, along with database verification & audit trail.',
          subTabs: [
            { id: 'INTEGRATIONS_HUB', label: 'Integrations & Database Hub', icon: Sparkles },
            { id: 'FIRESTORE_DIAGNOSTICS', label: 'Firestore Diagnostics', icon: Activity },
            { id: 'AUDIT_TRAIL', label: 'Audit & Governance Ledger', icon: ShieldCheck },
            { id: 'SHEETS_SYNC', label: 'Tariff Sheets Sync', icon: FileSpreadsheet }
          ]
        }
      ]
    }
  ];

  // Flatten for quick lookup
  const allSections = sidebarGroups.flatMap(g => g.items);
  const currentSectionConfig = allSections.find(s => s.id === activeSection) || allSections[0];

  const handleNavigate = (section: string, subTab?: string, recordId?: string) => {
    const validSection = allSections.find(s => s.id === section);
    if (validSection) {
      setActiveSection(validSection.id);
      if (subTab) {
        setActiveSubTab(subTab);
      } else if (validSection.subTabs && validSection.subTabs.length > 0) {
        setActiveSubTab(validSection.subTabs[0].id);
      }
    }
    setIsMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSectionSelect = (sectionId: CMSSection) => {
    setActiveSection(sectionId);
    const sec = allSections.find(s => s.id === sectionId);
    if (sec && sec.subTabs && sec.subTabs.length > 0) {
      setActiveSubTab(sec.subTabs[0].id);
    }
    setIsMobileSidebarOpen(false);
  };

  return (
    <div id="company-management-system-hub" className="min-h-screen bg-slate-100/70 -mt-8 -mx-4 sm:-mx-6 lg:-mx-8 p-4 sm:p-6 lg:p-8">
      {/* Global Command Palette / Search Modal */}
      <CMSGlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 items-start">
        
        {/* ========================================================================= */}
        {/* PERSISTENT CMS SIDEBAR (Desktop Collapsible & Mobile Drawer) */}
        {/* ========================================================================= */}
        <aside className={`
          fixed lg:sticky top-6 inset-y-0 left-0 z-40 bg-slate-950 text-white rounded-none lg:rounded-3xl p-4 sm:p-5 shadow-2xl lg:shadow-xl flex flex-col justify-between shrink-0 transition-all duration-200 overflow-y-auto max-h-screen lg:max-h-[calc(100vh-3rem)]
          ${isMobileSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}
        `}>
          {/* Top Brand & Header */}
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="min-w-0 animate-in fade-in duration-150">
                    <h2 className="text-sm font-extrabold tracking-wider text-white uppercase truncate">
                      TheUnbound CMS
                    </h2>
                    <span className="text-[10px] font-bold text-[#00E5C0]">
                      Operations Hub
                    </span>
                  </div>
                )}
              </div>

              {/* Desktop Collapse Toggle */}
              <button
                onClick={toggleSidebarCollapse}
                className="hidden lg:flex p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>

              {/* Close Mobile Drawer */}
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Search Button in Sidebar */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className={`w-full p-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-xl text-left text-xs text-slate-400 hover:text-slate-200 transition-all flex items-center cursor-pointer group ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              }`}
              title="Search CMS (⌘K)"
            >
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-slate-500 group-hover:text-[#00C6A6] shrink-0" />
                {!isSidebarCollapsed && <span className="truncate">Search CMS...</span>}
              </div>
              {!isSidebarCollapsed && (
                <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-400 font-mono">
                  ⌘K
                </kbd>
              )}
            </button>

            {/* Grouped Navigation Links */}
            <nav className="space-y-4">
              {sidebarGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  {!isSidebarCollapsed && (
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-2 py-0.5">
                      {group.category}
                    </div>
                  )}

                  {group.items.map(sec => {
                    const Icon = sec.icon;
                    const isActive = activeSection === sec.id;

                    return (
                      <button
                        key={sec.id}
                        onClick={() => handleSectionSelect(sec.id)}
                        className={`w-full text-left p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer group ${
                          isActive
                            ? 'bg-[#008972] text-white shadow-sm'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                        title={isSidebarCollapsed ? sec.label : undefined}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400 group-hover:text-white'
                          }`}>
                            {sec.partNumber !== undefined ? (
                              <span className="font-mono text-xs font-black">{sec.partNumber}</span>
                            ) : (
                              <Icon className="w-4 h-4" />
                            )}
                          </div>
                          {!isSidebarCollapsed && <span className="truncate">{sec.label}</span>}
                        </div>

                        {!isSidebarCollapsed && (
                          <div className="flex items-center space-x-1 shrink-0 pl-1">
                            {sec.alertCount && sec.alertCount > 0 ? (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-rose-500 text-white rounded-full">
                                {sec.alertCount}
                              </span>
                            ) : sec.badge ? (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                                isActive ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'
                              }`}>
                                {sec.badge}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>

          {/* Sidebar Footer: Current User & System Status */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5 mt-4">
            <div className={`flex items-center p-2 bg-slate-900/80 rounded-xl ${isSidebarCollapsed ? 'justify-center' : 'space-x-2.5'}`}>
              <div className="w-7 h-7 rounded-full bg-[#00C6A6]/20 text-[#00E5C0] flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-[#00E5C0] font-semibold">{currentUser.role} • Ops Lead</div>
                </div>
              )}
            </div>

            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Firestore Live</span>
                </span>
                <span>v3.2.0</span>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {isMobileSidebarOpen && (
          <div 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/60 z-30 lg:hidden backdrop-blur-xs"
          />
        )}

        {/* ========================================================================= */}
        {/* MAIN WORKSPACE CONTENT */}
        {/* ========================================================================= */}
        <main className="flex-1 w-full space-y-6 min-w-0">
          
          {/* Top Control & Utilities Bar */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex items-center justify-between gap-4">
            {/* Left: Mobile Menu Toggle & Breadcrumbs */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={() => handleNavigate('DASHBOARD')}
                  className="font-bold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  CMS
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-extrabold text-slate-900">
                  {currentSectionConfig.label}
                </span>
                {activeSection !== 'DASHBOARD' && activeSubTab && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[#008972] font-extrabold uppercase text-[11px] tracking-wider">
                      {activeSubTab.replace(/_/g, ' ')}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right: Global Search Trigger & Notification Bell */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden sm:flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Search className="w-4 h-4 text-slate-500" />
                <span>Search CMS</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] text-slate-500 font-mono">
                  ⌘K
                </kbd>
              </button>

              <CMSNotificationsDropdown onNavigate={handleNavigate} />
            </div>
          </div>

          {/* Header Context Bar (Shown when inside any of the 11 modules) */}
          {activeSection !== 'DASHBOARD' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#008972]/10 border border-[#008972]/20 flex items-center justify-center text-[#008972] font-mono font-black text-lg shrink-0">
                    {currentSectionConfig.partNumber}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Module Part {currentSectionConfig.partNumber} of 11
                      </span>
                      {currentSectionConfig.badge && (
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          {currentSectionConfig.badge}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      {currentSectionConfig.label}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => handleNavigate('DASHBOARD')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-1.5 self-start md:self-auto cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Return to Command Dashboard</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {currentSectionConfig.description}
              </p>

              {/* Sub-Tabs Navigation */}
              {currentSectionConfig.subTabs && currentSectionConfig.subTabs.length > 1 && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Module Operations & Sub-Views:
                  </div>
                  <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                    {currentSectionConfig.subTabs.map(st => {
                      const SubIcon = st.icon || Layers;
                      const isActive = activeSubTab === st.id;
                      return (
                        <button
                          key={st.id}
                          id={`cms-subtab-${st.id}`}
                          onClick={() => setActiveSubTab(st.id)}
                          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            isActive
                              ? 'bg-[#008972] text-white shadow-xs font-extrabold'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <SubIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                          <span>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* DYNAMIC MODULE CONTENT RENDERER */}
          {/* ========================================================================= */}
          <div className="animate-in fade-in duration-200">
            
            {/* VIEW 0: COMMAND CENTER DASHBOARD */}
            {activeSection === 'DASHBOARD' && (
              <CMSDashboardHome 
                onNavigate={handleNavigate}
                currentUser={currentUser}
              />
            )}

            {/* PART 1: PRODUCT MANAGEMENT */}
            {activeSection === 'PRODUCT_MANAGEMENT' && (
              <>
                {activeSubTab === 'PRODUCTS' && (
                  <ProductManager destinations={destinations} onViewProduct={onViewProduct} />
                )}
                {activeSubTab === 'VISAS' && (
                  <VisaCMSManager destinations={destinations} />
                )}
                {activeSubTab === 'SHEETS_SYNC' && (
                  <GoogleSheetsSyncManager />
                )}
              </>
            )}

            {/* PART 2: HOTEL MANAGEMENT */}
            {activeSection === 'HOTEL_MANAGEMENT' && (
              <HotelManager destinations={destinations} />
            )}

            {/* PART 2.5: READY-MADE PACKAGE MANAGEMENT */}
            {activeSection === 'PACKAGE_MANAGEMENT' && (
              <PackageManager 
                destinations={destinations}
                products={products}
                onViewProduct={onViewProduct}
                onCustomizePackage={onCustomizePackage}
              />
            )}

            {/* PART 3: BOOKING MANAGEMENT */}
            {activeSection === 'BOOKING_MANAGEMENT' && (
              <>
                {activeSubTab === 'BOOKINGS' && <BookingsManager />}
                {activeSubTab === 'QUOTES' && <QuoteMasterManager onLoadQuote={onLoadQuote} />}
              </>
            )}

            {/* PART 4: PAGE MANAGEMENT */}
            {activeSection === 'PAGE_MANAGEMENT' && (
              <>
                {activeSubTab === 'HOMEPAGE' && <HomepageManager destinations={destinations} />}
                {activeSubTab === 'NAVIGATION_MENU' && <MenuAndPagesManager />}
                {activeSubTab === 'PAGES_LEGAL' && <InstitutionalPagesManager />}
                {activeSubTab === 'GALLERY' && <GalleryManager />}
                {activeSubTab === 'REVIEWS' && <ReviewManager />}
                {activeSubTab === 'BLOGS' && <BlogCMSManager onViewArticle={onViewArticle} />}
              </>
            )}

            {/* PART 5: DESTINATION MANAGEMENT */}
            {activeSection === 'DESTINATION_MANAGEMENT' && (
              <>
                {activeSubTab === 'REGIONS' && (
                  <RegionCMSManager
                    onNavigateToDestinations={() => setActiveSubTab('DESTINATIONS')}
                    onNavigateToHubs={() => setActiveSubTab('CITIES')}
                  />
                )}
                {activeSubTab === 'DESTINATIONS' && (
                  <DestinationCMSManager 
                    onNavigateToHubs={() => setActiveSubTab('CITIES')}
                    onNavigateToRegions={() => setActiveSubTab('REGIONS')}
                  />
                )}
                {activeSubTab === 'CITIES' && <CityHubsManager destinations={destinations} />}
                {activeSubTab === 'FAQS' && <DestinationFAQManager destinations={destinations} />}
              </>
            )}

            {/* PART 6: LEAD MANAGEMENT */}
            {activeSection === 'LEAD_MANAGEMENT' && (
              <LeadManager />
            )}

            {/* PART 7: ACCOUNT MANAGEMENT */}
            {activeSection === 'ACCOUNT_MANAGEMENT' && (
              <>
                {activeSubTab === 'USERS_ACCESS' && <UserApprovalAccessManager />}
                {activeSubTab === 'ROSTER' && <RosterAdminManager products={products} />}
              </>
            )}

            {/* PART 8: MARKETING MANAGEMENT */}
            {activeSection === 'MARKETING_MANAGEMENT' && (
              <>
                {activeSubTab === 'PROMOTIONS' && <PromotionManager destinations={destinations} products={products} />}
                {activeSubTab === 'CAMPAIGNS' && <EmailCampaignsManager />}
              </>
            )}

            {/* PART 9: ANALYTICS & FINANCIALS */}
            {activeSection === 'ANALYTICS_MANAGEMENT' && (
              <FinancialsManager />
            )}

            {/* PART 10: NOTIFICATIONS MANAGEMENT */}
            {activeSection === 'NOTIFICATIONS_MANAGEMENT' && (
              <CMSCalendarTasksManager
                currentUser={currentUser}
                onNavigateToBooking={(id) => handleNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', id)}
                onNavigateToLead={(id) => handleNavigate('LEAD_MANAGEMENT', 'LEADS', id)}
              />
            )}

            {/* PART 11: DATABASE & AUDIT LOGS */}
            {activeSection === 'DATABASE_MANAGEMENT' && (
              <>
                {(activeSubTab === 'INTEGRATIONS_HUB' || activeSubTab === 'OVERVIEW' || !activeSubTab) && (
                  <IntegrationsManager currentUser={currentUser} />
                )}
                {activeSubTab === 'FIRESTORE_DIAGNOSTICS' && <FirestoreDiagnosticsViewer />}
                {activeSubTab === 'AUDIT_TRAIL' && <AuditTrailViewer />}
                {activeSubTab === 'SHEETS_SYNC' && <GoogleSheetsSyncManager />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
