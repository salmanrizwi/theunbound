import React, { useState, useEffect, useRef } from 'react';
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
import { FooterNavigationBuilder } from './FooterNavigationBuilder';
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
import { GlobalRemindersBar } from '../GlobalRemindersBar';

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
  ExternalLink,
  Maximize2,
  Minimize2,
  Briefcase,
  Eye,
  SlidersHorizontal,
  LucideIcon
} from 'lucide-react';

export type TopSectionId = 
  | 'OVERVIEW'
  | 'OPERATIONS'
  | 'CONTENT'
  | 'FINANCE'
  | 'SYSTEM';

export type CMSSection = 
  | 'DASHBOARD'
  | 'PRODUCT_MANAGEMENT'
  | 'HOTEL_MANAGEMENT'
  | 'PACKAGE_MANAGEMENT'
  | 'BOOKING_MANAGEMENT'
  | 'LEAD_MANAGEMENT'
  | 'DESTINATION_MANAGEMENT'
  | 'PAGE_MANAGEMENT'
  | 'MARKETING_MANAGEMENT'
  | 'ACCOUNT_MANAGEMENT'
  | 'ANALYTICS_MANAGEMENT'
  | 'NOTIFICATIONS_MANAGEMENT'
  | 'CALENDAR_SLAS'
  | 'DATABASE_MANAGEMENT'
  | 'INTEGRATIONS_DB';

interface ModuleConfig {
  id: CMSSection;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badge?: string;
  alertCount?: number;
  description: string;
  subTabs: { id: string; label: string; icon?: LucideIcon }[];
}

interface TopSectionConfig {
  id: TopSectionId;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultModule: CMSSection;
  modules: ModuleConfig[];
}

interface AdminCMSHubProps {
  destinations: Destination[];
  products: Product[];
  onViewProduct?: (product: Product) => void;
  onViewArticle?: (article: BlogArticle) => void;
  onLoadQuote?: (quote: Quotation) => void;
  onCustomizePackage?: (pkg: any) => void;
  onSwitchToBuyerMode?: () => void;
  onSwitchToAgentMode?: () => void;
  initialTab?: string;
  initialSubTab?: string;
}

export const AdminCMSHub: React.FC<AdminCMSHubProps> = ({
  destinations,
  products,
  onViewProduct,
  onViewArticle,
  onLoadQuote,
  onCustomizePackage,
  onSwitchToBuyerMode,
  onSwitchToAgentMode,
  initialTab,
  initialSubTab
}) => {
  const db = AppDatabase.getInstance();

  // Active navigation states
  const [activeSection, setActiveSection] = useState<CMSSection>(() => {
    if (initialTab) {
      if (initialTab === 'PRODUCTS') return 'PRODUCT_MANAGEMENT';
      if (initialTab === 'HOTELS') return 'HOTEL_MANAGEMENT';
      if (initialTab === 'PACKAGES') return 'PACKAGE_MANAGEMENT';
      if (initialTab === 'BOOKINGS') return 'BOOKING_MANAGEMENT';
      if (initialTab === 'LEADS') return 'LEAD_MANAGEMENT';
      if (initialTab === 'DESTINATIONS') return 'DESTINATION_MANAGEMENT';
      if (initialTab === 'PAGES') return 'PAGE_MANAGEMENT';
      if (initialTab === 'MARKETING') return 'MARKETING_MANAGEMENT';
      if (initialTab === 'ACCOUNTS') return 'ACCOUNT_MANAGEMENT';
      if (initialTab === 'ANALYTICS') return 'ANALYTICS_MANAGEMENT';
      if (initialTab === 'TASKS' || initialTab === 'SLAS') return 'NOTIFICATIONS_MANAGEMENT';
      if (initialTab === 'INTEGRATIONS' || initialTab === 'DATABASE') return 'DATABASE_MANAGEMENT';
      return (initialTab as CMSSection);
    }
    return 'DASHBOARD';
  });

  const [activeSubTab, setActiveSubTab] = useState<string>(() => initialSubTab || 'OVERVIEW');
  const [openDropdown, setOpenDropdown] = useState<TopSectionId | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fullscreen toggle handler
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

  // 5 CORE TOP-LEVEL SECTIONS ARCHITECTURE
  const topSections: TopSectionConfig[] = [
    {
      id: 'OVERVIEW',
      label: 'Overview',
      icon: LayoutDashboard,
      description: 'Command Operations Center, SLA alerts, real-time KPI engines, and quick actions.',
      defaultModule: 'DASHBOARD',
      modules: [
        {
          id: 'DASHBOARD',
          label: 'Command Dashboard',
          shortLabel: 'Dashboard',
          icon: LayoutDashboard,
          description: 'Operations overview, urgent alerts, real-time database metrics, module health, and quick actions.',
          subTabs: [
            { id: 'OVERVIEW', label: 'Command Center Home', icon: LayoutDashboard }
          ]
        }
      ]
    },
    {
      id: 'OPERATIONS',
      label: 'Operations & Inventory',
      icon: Package,
      description: 'Master ground tour inventory, contracted luxury hotels, packages, reservations, and CRM pipeline.',
      defaultModule: 'PRODUCT_MANAGEMENT',
      modules: [
        {
          id: 'PRODUCT_MANAGEMENT',
          label: 'Product Management',
          shortLabel: 'Products & Visas',
          icon: Package,
          badge: `${counts.totalProducts}`,
          description: 'Master ground tour inventory engine, SKU specifications, child/infant rates, adult tiers, visas, and Google Sheets sync.',
          subTabs: [
            { id: 'PRODUCTS', label: `Product Inventory (${counts.totalProducts})`, icon: Package },
            { id: 'VISAS', label: 'Visa Requirements & Checklists', icon: FileText },
            { id: 'SHEETS_SYNC', label: 'Google Sheets Live Sync', icon: FileSpreadsheet }
          ]
        },
        {
          id: 'HOTEL_MANAGEMENT',
          label: 'Hotel Management',
          shortLabel: 'Hotels & Rates',
          icon: Hotel,
          badge: `${counts.hotels}`,
          description: 'Contracted luxury hotel allotments, room tiers, passenger min/max controls, kids age rules, and meal plan supplements.',
          subTabs: [
            { id: 'HOTELS', label: `Contracted Hotel Roster (${counts.hotels})`, icon: Hotel }
          ]
        },
        {
          id: 'PACKAGE_MANAGEMENT',
          label: 'Package Management',
          shortLabel: 'Packages & Circuits',
          icon: Layers,
          badge: `${db.getPackages().length}`,
          description: 'Ready-Made Multi-City Tour Packages, circuit itineraries, live vs locked pricing, day-by-day builder, and customization.',
          subTabs: [
            { id: 'PACKAGES', label: `Ready-Made Packages (${db.getPackages().length})`, icon: Layers }
          ]
        },
        {
          id: 'BOOKING_MANAGEMENT',
          label: 'Booking Management',
          shortLabel: 'Ground Bookings',
          icon: CalendarCheck,
          badge: pendingBookings > 0 ? `${pendingBookings} Alert` : 'Active',
          alertCount: pendingBookings,
          description: 'Ground reservation pipeline, supplier assignment, status verification, jobsheets, vouchers, invoices, and 12-hour SLA alerts.',
          subTabs: [
            { id: 'BOOKINGS', label: 'Ground Bookings & Supplier Operations', icon: CalendarCheck }
          ]
        },
        {
          id: 'LEAD_MANAGEMENT',
          label: 'Lead Management',
          shortLabel: 'CRM & Quotes',
          icon: Users,
          badge: pendingLeads > 0 ? `${pendingLeads} New` : `${db.getQuotesForUser(currentUser).length} Quotes`,
          alertCount: pendingLeads,
          description: 'B2B agent inquiries, CRM lead pipeline, Quotation Master Records across all users, PDF proposals, and sales conversion.',
          subTabs: [
            { id: 'LEADS', label: 'CRM Leads & Pipeline', icon: Users },
            { id: 'QUOTES', label: 'Quotation Master Records', icon: Layers }
          ]
        }
      ]
    },
    {
      id: 'CONTENT',
      label: 'Content & Destinations',
      icon: Compass,
      description: 'Multi-tier geographic taxonomy, CMS pages, legal policies, promotional campaigns, and editorial guides.',
      defaultModule: 'DESTINATION_MANAGEMENT',
      modules: [
        {
          id: 'DESTINATION_MANAGEMENT',
          label: 'Destination Management',
          shortLabel: 'Destinations & Hubs',
          icon: Compass,
          badge: `${counts.destinations} Dests`,
          description: 'Connected 4-Tier Hierarchy: 1. REGION (Macro) ↓ 2. DESTINATION (Country) ↓ 3. DESTINATION HUB / CITY ↓ 4. PRODUCT / HOTEL.',
          subTabs: [
            { id: 'REGIONS', label: `1. Master Regions (${counts.regions})`, icon: Globe2 },
            { id: 'DESTINATIONS', label: `2. Destinations (${counts.destinations})`, icon: Compass },
            { id: 'CITIES', label: `3. City Hubs (${counts.hubs})`, icon: Layers },
            { id: 'FAQS', label: 'Destination FAQs & Trade Notes', icon: Sparkles }
          ]
        },
        {
          id: 'PAGE_MANAGEMENT',
          label: 'Page Management',
          shortLabel: 'Pages & Layouts',
          icon: LayoutTemplate,
          badge: 'Live',
          description: 'Institutional contact/policies, homepage hero controls, menu builder, legal compliance pages, and footer builder.',
          subTabs: [
            { id: 'HOMEPAGE', label: 'Homepage & Hero Control', icon: LayoutTemplate },
            { id: 'NAVIGATION_MENU', label: 'Menu & Custom Pages', icon: Layers },
            { id: 'PAGES_LEGAL', label: 'Site Pages & Legal Policies', icon: ShieldCheck },
            { id: 'FOOTER_NAV', label: 'Footer Navigation Builder', icon: SlidersHorizontal }
          ]
        },
        {
          id: 'MARKETING_MANAGEMENT',
          label: 'Marketing Management',
          shortLabel: 'Promos & Reviews',
          icon: Megaphone,
          badge: 'Deals',
          description: 'Promotional discount campaigns, seasonal banners, customer moment gallery, Google reviews, editorial blogs, and automated email triggers.',
          subTabs: [
            { id: 'PROMOTIONS', label: 'Promotions & Deal Campaigns', icon: Megaphone },
            { id: 'GALLERY', label: 'Happy Customer Gallery', icon: Sparkles },
            { id: 'REVIEWS', label: 'Google Business Reviews', icon: CheckCircle2 },
            { id: 'BLOGS', label: 'Editorial Articles & Guides', icon: Compass },
            { id: 'CAMPAIGNS', label: 'Email Triggers & Broadcasts', icon: Sparkles }
          ]
        }
      ]
    },
    {
      id: 'FINANCE',
      label: 'Finance & Administration',
      icon: Receipt,
      description: 'Enterprise user approvals, B2B Agent RBAC, staff operational allocation, margin realization, and GST invoices.',
      defaultModule: 'ACCOUNT_MANAGEMENT',
      modules: [
        {
          id: 'ACCOUNT_MANAGEMENT',
          label: 'Account Management',
          shortLabel: 'Users & Roster',
          icon: UserCheck,
          badge: pendingUsers > 0 ? `${pendingUsers} Pending` : 'RBAC',
          alertCount: pendingUsers,
          description: 'Admin user approval panel, Direct Buyer vs. B2B Agent segregation, custom margin settings, and staff operations roster.',
          subTabs: [
            { id: 'USERS_ACCESS', label: 'User Approval & Segregation', icon: UserCheck },
            { id: 'ROSTER', label: 'Staff Roster & Ops Allocation', icon: Users }
          ]
        },
        {
          id: 'ANALYTICS_MANAGEMENT',
          label: 'Analytics & Financials',
          shortLabel: 'Finance & Reports',
          icon: BarChart3,
          badge: 'Financials',
          description: 'Commercial margin realization, tax on margin reporting, monthly sales revenue, conversion metrics, and official GST invoices.',
          subTabs: [
            { id: 'FINANCIALS', label: 'Financial Audit & Invoicing', icon: Receipt }
          ]
        }
      ]
    },
    {
      id: 'SYSTEM',
      label: 'System & Audit',
      icon: Database,
      description: 'Google Calendar Task SLA automation, production Integrations Hub, Firestore diagnostics, and audit governance ledger.',
      defaultModule: 'CALENDAR_SLAS',
      modules: [
        {
          id: 'CALENDAR_SLAS',
          label: 'Calendar & Ground SLAs',
          shortLabel: 'Calendar & SLAs',
          icon: Bell,
          badge: pendingTasks > 0 ? `${pendingTasks} Tasks` : 'SLAs',
          alertCount: pendingTasks,
          description: 'Google Calendar Task SLA automation, 12h booking confirmation alerts, 24h quote follow-up triggers, and ground service deadlines.',
          subTabs: [
            { id: 'TASKS', label: 'Calendar & Ground SLAs', icon: Bell }
          ]
        },
        {
          id: 'INTEGRATIONS_DB',
          label: 'Integrations & Database',
          shortLabel: 'Integrations & DB',
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

  // Helper mapping for aliases
  const normalizeSectionId = (sec: string): CMSSection => {
    if (sec === 'NOTIFICATIONS_MANAGEMENT') return 'CALENDAR_SLAS';
    if (sec === 'DATABASE_MANAGEMENT') return 'INTEGRATIONS_DB';
    return sec as CMSSection;
  };

  const allModules = topSections.flatMap(ts => ts.modules);
  const normalizedActiveSection = normalizeSectionId(activeSection);
  const currentModuleConfig = allModules.find(m => m.id === normalizedActiveSection || m.id === activeSection) || allModules[0];
  const currentTopSection = topSections.find(ts => ts.modules.some(m => m.id === currentModuleConfig.id)) || topSections[0];

  const handleNavigate = (section: string, subTab?: string, recordId?: string) => {
    const normalized = normalizeSectionId(section);
    const targetModule = allModules.find(m => m.id === normalized || m.id === section);
    if (targetModule) {
      setActiveSection(targetModule.id);
      if (subTab) {
        setActiveSubTab(subTab);
      } else if (targetModule.subTabs && targetModule.subTabs.length > 0) {
        setActiveSubTab(targetModule.subTabs[0].id);
      }
    }
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectModule = (moduleId: CMSSection, defaultSubTab?: string) => {
    setActiveSection(moduleId);
    const mod = allModules.find(m => m.id === moduleId);
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    } else if (mod && mod.subTabs && mod.subTabs.length > 0) {
      setActiveSubTab(mod.subTabs[0].id);
    }
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);
  };

  const handleSelectTopSection = (section: TopSectionConfig) => {
    if (section.modules.length === 1) {
      handleSelectModule(section.modules[0].id);
    } else {
      setOpenDropdown(openDropdown === section.id ? null : section.id);
    }
  };

  return (
    <div id="theunbound-admin-cms-root" className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-[#00C6A6] selection:text-slate-950">
      
      {/* Global Command Palette / Search Modal */}
      <CMSGlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* ========================================================================= */}
      {/* DEDICATED FULL-SCREEN CMS TOP HEADER */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-white shadow-xl shrink-0">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            
            {/* LEFT: CMS BRAND & IDENTITY */}
            <div className="flex items-center space-x-4 shrink-0">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="xl:hidden p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                title="Toggle CMS Navigation"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div 
                onClick={() => handleNavigate('DASHBOARD', 'OVERVIEW')}
                className="flex items-center space-x-3 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00C6A6] to-[#008972] flex items-center justify-center text-slate-950 font-black shadow-md shadow-[#00C6A6]/20 shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5 text-slate-950" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-base sm:text-lg font-black tracking-tight text-white font-sans lowercase">
                      theunbound
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#00C6A6]/20 border border-[#00C6A6]/40 text-[#00E5C0] text-[10px] font-extrabold uppercase tracking-wider">
                      CMS OS
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center space-x-1.5 text-[10px] text-slate-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Travel Operations Engine</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER: 5 TOP-LEVEL NAVIGATION DROPDOWNS (Desktop) */}
            <nav className="hidden xl:flex items-center space-x-1" ref={dropdownRef}>
              {topSections.map((sec) => {
                const isCurrentActiveSection = currentTopSection.id === sec.id;
                const isDropdownOpen = openDropdown === sec.id;
                const TopIcon = sec.icon;

                if (sec.modules.length === 1) {
                  const singleModule = sec.modules[0];
                  const isActive = currentModuleConfig.id === singleModule.id;
                  return (
                    <button
                      key={sec.id}
                      id={`top-nav-${sec.id}`}
                      onClick={() => handleSelectModule(singleModule.id)}
                      className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#008972] text-white shadow-sm ring-1 ring-[#00C6A6]/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <TopIcon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{sec.label}</span>
                    </button>
                  );
                }

                return (
                  <div key={sec.id} className="relative">
                    <button
                      id={`top-nav-${sec.id}`}
                      onClick={() => handleSelectTopSection(sec)}
                      onMouseEnter={() => setOpenDropdown(sec.id)}
                      className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCurrentActiveSection
                          ? 'bg-[#008972]/80 text-white ring-1 ring-[#00C6A6]/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <TopIcon className={`w-4 h-4 ${isCurrentActiveSection ? 'text-white' : 'text-slate-400'}`} />
                      <span>{sec.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                    </button>

                    {/* Mega Dropdown Menu */}
                    {isDropdownOpen && (
                      <div 
                        onMouseLeave={() => setOpenDropdown(null)}
                        className="absolute left-0 mt-2 w-80 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                      >
                        <div className="px-3 py-2 border-b border-slate-800/80 mb-1.5">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#00E5C0] flex items-center space-x-1.5">
                            <TopIcon className="w-3.5 h-3.5" />
                            <span>{sec.label}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                            {sec.description}
                          </p>
                        </div>

                        <div className="space-y-1">
                          {sec.modules.map((mod) => {
                            const ModIcon = mod.icon;
                            const isModActive = currentModuleConfig.id === mod.id;

                            return (
                              <button
                                key={mod.id}
                                id={`dropdown-mod-${mod.id}`}
                                onClick={() => handleSelectModule(mod.id)}
                                className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start space-x-3 cursor-pointer group ${
                                  isModActive
                                    ? 'bg-[#008972] text-white shadow-sm'
                                    : 'hover:bg-slate-900 text-slate-300 hover:text-white'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  isModActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-900 text-slate-400 group-hover:text-[#00E5C0] group-hover:bg-slate-800'
                                }`}>
                                  <ModIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold truncate">
                                      {mod.label}
                                    </span>
                                    {mod.alertCount && mod.alertCount > 0 ? (
                                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-rose-500 text-white rounded-full shrink-0">
                                        {mod.alertCount}
                                      </span>
                                    ) : mod.badge ? (
                                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium shrink-0 ${
                                        isModActive ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'
                                      }`}>
                                        {mod.badge}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className={`text-[10px] line-clamp-1 mt-0.5 ${
                                    isModActive ? 'text-emerald-100' : 'text-slate-500 group-hover:text-slate-400'
                                  }`}>
                                    {mod.shortLabel}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* RIGHT: GLOBAL TOOLS & UTILITIES */}
            <div className="flex items-center space-x-2.5 shrink-0">
              
              {/* Quick Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer group"
                title="Search Operations Engine (⌘K)"
              >
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00C6A6]" />
                <span className="hidden md:inline">Search...</span>
                <kbd className="hidden lg:inline px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-slate-400 font-mono">
                  ⌘K
                </kbd>
              </button>

              {/* Real-time Notifications & SLA Dropdown */}
              <CMSNotificationsDropdown onNavigate={handleNavigate} />

              {/* View/Preview Buyer Site Button */}
              {onSwitchToBuyerMode && (
                <button
                  onClick={onSwitchToBuyerMode}
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Preview Customer Buyer Experience"
                >
                  <Eye className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span className="hidden md:inline">Buyer View</span>
                </button>
              )}

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="hidden lg:flex p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Workspace'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* User Account Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-1 pl-1.5 pr-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#00C6A6] to-[#00E5C0] text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-bold text-white leading-tight truncate max-w-[100px]">{currentUser.name}</p>
                    <p className="text-[10px] font-semibold text-[#00E5C0] uppercase tracking-wider">{currentUser.role}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* User Dropdown */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in duration-150">
                    <div className="p-3 border-b border-slate-800">
                      <p className="text-xs font-bold text-white">{currentUser.name}</p>
                      <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded text-[10px] font-bold">
                          {currentUser.role}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {currentUser.agencyName}
                        </span>
                      </div>
                    </div>

                    <div className="py-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          handleNavigate('ACCOUNT_MANAGEMENT', 'USERS_ACCESS');
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg flex items-center space-x-2 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#00C6A6]" />
                        <span>User Access & RBAC</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          handleNavigate('INTEGRATIONS_DB', 'FIRESTORE_DIAGNOSTICS');
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg flex items-center space-x-2 cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5 text-[#00C6A6]" />
                        <span>Firestore Diagnostics</span>
                      </button>

                      {onSwitchToBuyerMode && (
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onSwitchToBuyerMode();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg flex items-center space-x-2 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#00C6A6]" />
                          <span>Switch to Buyer Portal</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* MOBILE NAVIGATION DRAWER */}
        {isMobileMenuOpen && (
          <div className="xl:hidden bg-slate-950 border-t border-slate-800 p-4 max-h-[80vh] overflow-y-auto space-y-4">
            <div className="space-y-4">
              {topSections.map((sec) => (
                <div key={sec.id} className="space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#00E5C0] px-2">
                    {sec.label}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {sec.modules.map((mod) => {
                      const ModIcon = mod.icon;
                      const isActive = currentModuleConfig.id === mod.id;
                      return (
                        <button
                          key={mod.id}
                          onClick={() => handleSelectModule(mod.id)}
                          className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                            isActive
                              ? 'bg-[#008972] text-white shadow-sm'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-850 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <ModIcon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{mod.label}</span>
                          </div>
                          {mod.alertCount && mod.alertCount > 0 ? (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-rose-500 text-white rounded-full shrink-0">
                              {mod.alertCount}
                            </span>
                          ) : mod.badge ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/80 text-slate-400 shrink-0">
                              {mod.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* SECONDARY CONTEXT & SUB-NAVIGATION BAR (For Module Drilldown) */}
      {/* ========================================================================= */}
      <section className="bg-slate-950 border-b border-slate-800/90 py-3.5 px-3 sm:px-6 lg:px-8 text-white shrink-0">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Breadcrumbs & Active Module Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[#00E5C0] shrink-0">
              <currentModuleConfig.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-medium">
                <button
                  onClick={() => handleNavigate('DASHBOARD', 'OVERVIEW')}
                  className="hover:text-white transition-colors"
                >
                  Overview
                </button>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="text-slate-300 font-semibold">{currentTopSection.label}</span>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="text-[#00E5C0] font-bold">{currentModuleConfig.label}</span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-white truncate">
                {currentModuleConfig.label}
              </h1>
            </div>
          </div>

          {/* Sub-Tabs Selector */}
          {currentModuleConfig.subTabs && currentModuleConfig.subTabs.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
              {currentModuleConfig.subTabs.map((st) => {
                const SubIcon = st.icon || Layers;
                const isTabActive = activeSubTab === st.id;
                return (
                  <button
                    key={st.id}
                    id={`cms-subtab-${st.id}`}
                    onClick={() => setActiveSubTab(st.id)}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isTabActive
                        ? 'bg-[#008972] text-white shadow-sm ring-1 ring-[#00C6A6]/40'
                        : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:text-white'
                    }`}
                  >
                    <SubIcon className={`w-3.5 h-3.5 ${isTabActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MAIN FULL-SCREEN WORKSPACE CONTENT */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full bg-slate-100 text-slate-900 p-3 sm:p-6 lg:p-8 space-y-6">
        
        {/* Urgent Action Center & Global Reminders Bar */}
        <div className="rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs">
          <GlobalRemindersBar 
            variant="admin" 
            onNavigate={(sec, sub) => handleNavigate(sec, sub)} 
          />
        </div>

        {/* Dynamic Module Content */}
        <div className="animate-in fade-in duration-200">
          
          {/* SECTION 1: OVERVIEW -> COMMAND DASHBOARD */}
          {(currentModuleConfig.id === 'DASHBOARD') && (
            <CMSDashboardHome 
              onNavigate={handleNavigate}
              currentUser={currentUser}
            />
          )}

          {/* SECTION 2: OPERATIONS & INVENTORY */}
          {/* 2.1 PRODUCT MANAGEMENT */}
          {currentModuleConfig.id === 'PRODUCT_MANAGEMENT' && (
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

          {/* 2.2 HOTEL MANAGEMENT */}
          {currentModuleConfig.id === 'HOTEL_MANAGEMENT' && (
            <HotelManager destinations={destinations} />
          )}

          {/* 2.3 READY-MADE PACKAGE MANAGEMENT */}
          {currentModuleConfig.id === 'PACKAGE_MANAGEMENT' && (
            <PackageManager 
              destinations={destinations}
              products={products}
              onViewProduct={onViewProduct}
              onCustomizePackage={onCustomizePackage}
            />
          )}

          {/* 2.4 BOOKING MANAGEMENT */}
          {currentModuleConfig.id === 'BOOKING_MANAGEMENT' && (
            <BookingsManager />
          )}

          {/* 2.5 LEAD MANAGEMENT */}
          {currentModuleConfig.id === 'LEAD_MANAGEMENT' && (
            <>
              {(!activeSubTab || activeSubTab === 'LEADS') && <LeadManager />}
              {activeSubTab === 'QUOTES' && (
                <QuoteMasterManager 
                  onLoadQuote={onLoadQuote} 
                  onNavigateToLeads={() => setActiveSubTab('LEADS')}
                />
              )}
            </>
          )}

          {/* SECTION 3: CONTENT & DESTINATIONS */}
          {/* 3.1 DESTINATION MANAGEMENT */}
          {currentModuleConfig.id === 'DESTINATION_MANAGEMENT' && (
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

          {/* 3.2 PAGE MANAGEMENT */}
          {currentModuleConfig.id === 'PAGE_MANAGEMENT' && (
            <>
              {activeSubTab === 'HOMEPAGE' && <HomepageManager destinations={destinations} />}
              {activeSubTab === 'NAVIGATION_MENU' && <MenuAndPagesManager />}
              {activeSubTab === 'PAGES_LEGAL' && <InstitutionalPagesManager />}
              {activeSubTab === 'FOOTER_NAV' && <FooterNavigationBuilder />}
            </>
          )}

          {/* 3.3 MARKETING MANAGEMENT */}
          {currentModuleConfig.id === 'MARKETING_MANAGEMENT' && (
            <>
              {activeSubTab === 'PROMOTIONS' && <PromotionManager destinations={destinations} products={products} />}
              {activeSubTab === 'GALLERY' && <GalleryManager />}
              {activeSubTab === 'REVIEWS' && <ReviewManager />}
              {activeSubTab === 'BLOGS' && <BlogCMSManager onViewArticle={onViewArticle} />}
              {activeSubTab === 'CAMPAIGNS' && <EmailCampaignsManager />}
            </>
          )}

          {/* SECTION 4: FINANCE & ADMINISTRATION */}
          {/* 4.1 ACCOUNT MANAGEMENT */}
          {currentModuleConfig.id === 'ACCOUNT_MANAGEMENT' && (
            <>
              {activeSubTab === 'USERS_ACCESS' && <UserApprovalAccessManager />}
              {activeSubTab === 'ROSTER' && <RosterAdminManager products={products} />}
            </>
          )}

          {/* 4.2 ANALYTICS & FINANCIALS */}
          {currentModuleConfig.id === 'ANALYTICS_MANAGEMENT' && (
            <FinancialsManager />
          )}

          {/* SECTION 5: SYSTEM & AUDIT */}
          {/* 5.1 CALENDAR & GROUND SLAS */}
          {(currentModuleConfig.id === 'CALENDAR_SLAS' || currentModuleConfig.id === 'NOTIFICATIONS_MANAGEMENT') && (
            <CMSCalendarTasksManager
              currentUser={currentUser}
              onNavigateToBooking={(id) => handleNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', id)}
              onNavigateToLead={(id) => handleNavigate('LEAD_MANAGEMENT', 'LEADS', id)}
            />
          )}

          {/* 5.2 INTEGRATIONS & DATABASE */}
          {(currentModuleConfig.id === 'INTEGRATIONS_DB' || currentModuleConfig.id === 'DATABASE_MANAGEMENT') && (
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
  );
};
