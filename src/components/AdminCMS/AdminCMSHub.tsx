import React, { useState, useEffect, useRef } from 'react';
import { Product, Destination, Quotation, BlogArticle, User, ActionTarget } from '../../types';
import { AppDatabase } from '../../services/db';
import { countingEngine } from '../../services/countingEngine';
import { useAuth } from '../../context/AuthContext';

// Import Sub-Module Managers
import { CMSDashboardHome } from './CMSDashboardHome';
import { CMSGlobalSearch } from './CMSGlobalSearch';
import { CMSNotificationsDropdown } from './CMSNotificationsDropdown';
import { AdminActivityCenter } from './AdminActivityCenter';
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
import { CurrencyManagementPanel } from './CurrencyManagement/CurrencyManagementPanel';
import { PromotionManager } from './PromotionManager';
import { EmailCampaignsManager } from './EmailCampaignsManager';
import { NewsletterManager } from './NewsletterManager';
import { AuditTrailViewer } from './AuditTrailViewer';
import { GoogleSheetsSyncManager } from './GoogleSheetsSyncManager';
import { FirestoreDiagnosticsViewer } from './FirestoreDiagnosticsViewer';
import { VisaCMSManager } from './VisaCMSManager';
import { PackageManager } from './PackageManager';
import { RosterAdminManager } from '../RosterAdminManager';
import { IntegrationsManager } from './IntegrationsManager';
import { DataSyncAuditViewer } from './DataSyncAuditViewer';
import { SystemAnalysis } from './SystemAnalysis';
import { SEOManager } from './SEOManager';
import { SupplierManager } from './SupplierManager';
import { RailManager } from './RailManager';
import { OperationalAssetsManager } from './OperationalAssetsManager';
import { AdminSidebar } from './layout/AdminSidebar';
import { AdminHeader } from './layout/AdminHeader';
import { GlobalRemindersBar } from '../GlobalRemindersBar';
import { ActionCenterDrawer } from '../ActionCenter/ActionCenterDrawer';
import { CalendarTask, TravelLead } from '../../types';
import { UnifiedB2BQuotationBuilder } from '../B2BAgentPortal/UnifiedB2BQuotationBuilder';
import { resolveAndValidateQuoteForBuilder } from '../../services/quotationRouting';
import { 
  canUserAccessCMS, 
  canUserAccessTopSection, 
  canUserAccessCMSModule, 
  canUserAccessCMSSubTab 
} from '../../services/permissionEngine';
import { navigateTo } from '../../services/portalRouter';

// Lucide Icons
import { 
  Building2,
  ShieldCheck, 
  Shield,
  Lock,
  Package, 
  Hotel, 
  CalendarCheck, 
  LayoutTemplate, 
  Compass, 
  Globe2,
  Users, 
  UserCheck, 
  Receipt, 
  CircleDollarSign,
  Calculator,
  History,
  Megaphone, 
  BarChart3, 
  Bell, 
  CheckSquare,
  Database, 
  FileSpreadsheet,
  FileText,
  FileCheck,
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
  Train,
  MapPin,
  Mail,
  Route as RouteIcon,
  DollarSign,
  Calendar,
  Percent,
  LucideIcon
} from 'lucide-react';

export type TopSectionId = 
  | 'OVERVIEW'
  | 'SYSTEM_ANALYSIS'
  | 'OPERATIONS'
  | 'CONTENT'
  | 'FINANCE'
  | 'SYSTEM';

export type CMSSection = 
  | 'DASHBOARD'
  | 'SYSTEM_ANALYSIS'
  | 'PRODUCT_MANAGEMENT'
  | 'VISA_ANCILLARY_SERVICES'
  | 'RAIL_MANAGEMENT'
  | 'HOTEL_MANAGEMENT'
  | 'PACKAGE_MANAGEMENT'
  | 'BOOKING_MANAGEMENT'
  | 'LEAD_MANAGEMENT'
  | 'DESTINATION_MANAGEMENT'
  | 'PAGE_MANAGEMENT'
  | 'MARKETING_MANAGEMENT'
  | 'SEO_MANAGEMENT'
  | 'ACCOUNT_MANAGEMENT'
  | 'ANALYTICS_MANAGEMENT'
  | 'CURRENCY_MANAGEMENT'
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
  fullLabel?: string;
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

const SECTION_SLUG_MAP: Record<CMSSection, string> = {
  DASHBOARD: 'dashboard',
  SYSTEM_ANALYSIS: 'system-analysis',
  PRODUCT_MANAGEMENT: 'products',
  VISA_ANCILLARY_SERVICES: 'visas-ancillary',
  RAIL_MANAGEMENT: 'rail',
  HOTEL_MANAGEMENT: 'hotels',
  PACKAGE_MANAGEMENT: 'packages',
  BOOKING_MANAGEMENT: 'bookings',
  LEAD_MANAGEMENT: 'leads',
  DESTINATION_MANAGEMENT: 'destinations',
  PAGE_MANAGEMENT: 'pages',
  MARKETING_MANAGEMENT: 'marketing',
  SEO_MANAGEMENT: 'seo',
  ACCOUNT_MANAGEMENT: 'accounts',
  ANALYTICS_MANAGEMENT: 'analytics',
  CURRENCY_MANAGEMENT: 'currency',
  NOTIFICATIONS_MANAGEMENT: 'tasks',
  CALENDAR_SLAS: 'tasks',
  DATABASE_MANAGEMENT: 'database',
  INTEGRATIONS_DB: 'integrations'
};

function resolveSectionFromSlug(slug?: string): CMSSection {
  if (!slug) return 'DASHBOARD';
  const clean = slug.trim().toUpperCase().replace(/[-_]/g, '');
  if (clean === 'PRODUCTS' || clean === 'PRODUCT' || clean === 'PRODUCTMANAGEMENT') return 'PRODUCT_MANAGEMENT';
  if (clean === 'VISA' || clean === 'VISAS' || clean === 'VISAANCILLARYSERVICES' || clean === 'ANCILLARY' || clean === 'ANCILLARIES' || clean === 'VISASERVICES' || clean === 'TRAVELPROTECTION' || clean === 'VISASANCILLARY' || clean === 'GROUNDCONNECTIVITY' || clean === 'VIP' || clean === 'CONNECTIVITY' || clean === 'ESIM' || clean === 'MASTERSCHEMAMATRIX' || clean === 'FIELDPARITY' || clean === 'SCHEMAMATRIX' || clean === 'MATRIX' || clean === 'PROTECTION' || clean === 'INSURANCE') return 'VISA_ANCILLARY_SERVICES';
  if (clean === 'RAIL' || clean === 'JAPANRAIL' || clean === 'RAILMANAGEMENT' || clean === 'SHINKANSEN') return 'RAIL_MANAGEMENT';
  if (clean === 'HOTELS' || clean === 'HOTEL' || clean === 'HOTELMANAGEMENT') return 'HOTEL_MANAGEMENT';
  if (clean === 'PACKAGES' || clean === 'PACKAGE' || clean === 'PACKAGEMANAGEMENT') return 'PACKAGE_MANAGEMENT';
  if (clean === 'BOOKINGS' || clean === 'BOOKING' || clean === 'BOOKINGMANAGEMENT') return 'BOOKING_MANAGEMENT';
  if (clean === 'LEADS' || clean === 'LEAD' || clean === 'LEADMANAGEMENT') return 'LEAD_MANAGEMENT';
  if (clean === 'DESTINATIONS' || clean === 'DESTINATION' || clean === 'DESTINATIONMANAGEMENT') return 'DESTINATION_MANAGEMENT';
  if (clean === 'PAGES' || clean === 'PAGE' || clean === 'PAGEMANAGEMENT' || clean === 'MENU' || clean === 'NAVIGATION') return 'PAGE_MANAGEMENT';
  if (clean === 'MARKETING' || clean === 'MARKETINGMANAGEMENT') return 'MARKETING_MANAGEMENT';
  if (clean === 'SEO' || clean === 'SEOMANAGEMENT') return 'SEO_MANAGEMENT';
  if (clean === 'ACCOUNTS' || clean === 'ACCOUNT' || clean === 'ACCOUNTMANAGEMENT' || clean === 'USERS' || clean === 'USER' || clean === 'SUPPLIERS') return 'ACCOUNT_MANAGEMENT';
  if (clean === 'ANALYTICS' || clean === 'ANALYTICSMANAGEMENT' || clean === 'FINANCIALS') return 'ANALYTICS_MANAGEMENT';
  if (clean === 'CURRENCY' || clean === 'CURRENCYMANAGEMENT' || clean === 'FX') return 'CURRENCY_MANAGEMENT';
  if (clean === 'TASKS' || clean === 'TASK' || clean === 'SLAS' || clean === 'SLA' || clean === 'NOTIFICATIONS' || clean === 'NOTIFICATIONSMANAGEMENT' || clean === 'CALENDARSLAS') return 'NOTIFICATIONS_MANAGEMENT';
  if (clean === 'INTEGRATIONS' || clean === 'INTEGRATIONSDB') return 'INTEGRATIONS_DB';
  if (clean === 'DATABASE' || clean === 'DATABASEMANAGEMENT') return 'DATABASE_MANAGEMENT';
  if (clean === 'SYSTEMANALYSIS' || clean === 'ANALYSIS') return 'SYSTEM_ANALYSIS';
  if (clean === 'DASHBOARD' || clean === 'OVERVIEW') return 'DASHBOARD';
  return 'DASHBOARD';
}

function resolveSubTabFromRoute(tab?: string, subTab?: string): string {
  const target = (subTab || tab || '').trim();
  const clean = target.toUpperCase().replace(/[-_]/g, '');

  if (clean === 'TRAVELPROTECTION' || clean === 'PROTECTION' || clean === 'INSURANCE') {
    return 'TRAVEL_PROTECTION';
  }
  if (clean === 'GROUNDCONNECTIVITY' || clean === 'GROUND' || clean === 'CONNECTIVITY' || clean === 'VIP' || clean === 'ESIM') {
    return 'GROUND_CONNECTIVITY';
  }
  if (clean === 'MASTERSCHEMAMATRIX' || clean === 'FIELDPARITY' || clean === 'SCHEMAMATRIX' || clean === 'MATRIX' || clean === 'SCHEMA' || clean === 'PARITY') {
    return 'FIELD_PARITY';
  }
  if (clean === 'VISASERVICES' || clean === 'VISASERVICE' || clean === 'VISAS' || clean === 'VISA' || clean === 'VISASANCILLARY' || clean === 'ANCILLARY' || clean === 'ANCILLARIES') {
    return 'VISA_SERVICES';
  }

  if (subTab) {
    const subUpper = subTab.toUpperCase();
    if (subUpper === 'MENU' || subUpper === 'NAVIGATION') return 'NAVIGATION_MENU';
    if (subUpper === 'CUSTOM_PAGES' || subUpper === 'PAGES') return 'CUSTOM_PAGES';
    return subUpper;
  }

  return 'OVERVIEW';
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
  const [activeSection, setActiveSection] = useState<CMSSection>(() => resolveSectionFromSlug(initialTab));

  const [activeSubTab, setActiveSubTab] = useState<string>(() => {
    const sec = resolveSectionFromSlug(initialTab);
    if (sec === 'VISA_ANCILLARY_SERVICES') {
      return resolveSubTabFromRoute(initialTab, initialSubTab);
    }
    if (initialSubTab) {
      const subUpper = initialSubTab.toUpperCase();
      if (subUpper === 'MENU' || subUpper === 'NAVIGATION') return 'NAVIGATION_MENU';
      if (subUpper === 'CUSTOM_PAGES' || subUpper === 'PAGES') return 'CUSTOM_PAGES';
      return subUpper;
    }
    return 'OVERVIEW';
  });

  // React to browser Back/Forward or direct route navigation
  useEffect(() => {
    if (initialTab) {
      const resolved = resolveSectionFromSlug(initialTab);
      setActiveSection(resolved);
      if (initialTab.toUpperCase() === 'SUPPLIERS') {
        setActiveSubTab('SUPPLIERS');
      }
      if (resolved === 'VISA_ANCILLARY_SERVICES') {
        setActiveSubTab(resolveSubTabFromRoute(initialTab, initialSubTab));
      }
    }
    if (initialSubTab) {
      const resolved = resolveSectionFromSlug(initialTab);
      if (resolved !== 'VISA_ANCILLARY_SERVICES') {
        const subUpper = initialSubTab.toUpperCase();
        if (subUpper === 'MENU' || subUpper === 'NAVIGATION') {
          setActiveSubTab('NAVIGATION_MENU');
        } else if (subUpper === 'CUSTOM_PAGES' || subUpper === 'PAGES') {
          setActiveSubTab('CUSTOM_PAGES');
        } else {
          setActiveSubTab(subUpper);
        }
      }
    }
  }, [initialTab, initialSubTab]);
  const [openDropdown, setOpenDropdown] = useState<TopSectionId | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cms_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cms_sidebar_collapsed', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leadForNewQuote, setLeadForNewQuote] = useState<TravelLead | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { user: authUser, logout: authLogout } = useAuth();

  // Get current active admin user from AuthContext, DB, or fallback
  const dbUser = authUser?.email ? db.getUsers().find(u => u.email.toLowerCase() === authUser.email.toLowerCase()) : null;
  const currentUser: User = authUser || dbUser || db.getUsers().find(u => u.email.toLowerCase() === 'business@theunbound.in') || db.getUsers().find(u => u.role === 'ADMIN') || {
    id: 'usr-admin-business',
    name: 'TheUnbound Executive Admin',
    email: 'business@theunbound.in',
    role: 'ADMIN',
    approvalStatus: 'APPROVED',
    createdAt: '2025-01-01T00:00:00Z',
    agencyName: 'TheUnbound DMC Global Headquarters'
  };

  // Active users count (total count of active users using B2B + Buyer portal)
  const [dbTick, setDbTick] = useState(0);

  const counts = countingEngine.getCountsBreakdown({ onlyPublished: false });
  const pendingLeads = db.getLeads().filter(l => l.status === 'NEW').length;
  const pendingBookings = db.getAllBookings().filter(b => b.status === 'PENDING_CONFIRMATION').length;
  const pendingUsers = db.getUsers().filter(u => u.approvalStatus === 'PENDING').length;
  const pendingTasks = db.getCalendarTasks().filter(t => t.status === 'PENDING').length;

  const [activePortalStats, setActivePortalStats] = useState(() => {
    const users = db.getUsers();
    const b2b = users.filter(u => 
      (u.role === 'B2B_AGENT' || u.role === 'AGENT' || u.permissions?.b2bQuoteBuilderAccess) && 
      (u.approvalStatus === 'APPROVED' || !u.approvalStatus) &&
      u.role !== 'ADMIN' && u.role !== 'TEAM_MEMBER'
    ).length;
    const buyer = users.filter(u => 
      (u.role === 'BUYER' || u.permissions?.buyerQuoteBuilderAccess) && 
      (u.approvalStatus === 'APPROVED' || !u.approvalStatus) &&
      u.role !== 'ADMIN' && u.role !== 'TEAM_MEMBER'
    ).length;
    return { b2b, buyer, total: b2b + buyer };
  });

  useEffect(() => {
    const updateStats = () => {
      const users = db.getUsers();
      const b2b = users.filter(u => 
        (u.role === 'B2B_AGENT' || u.role === 'AGENT' || u.permissions?.b2bQuoteBuilderAccess) && 
        (u.approvalStatus === 'APPROVED' || !u.approvalStatus) &&
        u.role !== 'ADMIN' && u.role !== 'TEAM_MEMBER'
      ).length;
      const buyer = users.filter(u => 
        (u.role === 'BUYER' || u.permissions?.buyerQuoteBuilderAccess) && 
        (u.approvalStatus === 'APPROVED' || !u.approvalStatus) &&
        u.role !== 'ADMIN' && u.role !== 'TEAM_MEMBER'
      ).length;
      setActivePortalStats({ b2b, buyer, total: b2b + buyer });
      setDbTick(t => t + 1);
    };

    const unsub = db.subscribe(() => {
      updateStats();
    });

    window.addEventListener('storage', updateStats);
    window.addEventListener('focus', updateStats);
    const interval = setInterval(updateStats, 4000);
    return () => {
      unsub();
      window.removeEventListener('storage', updateStats);
      window.removeEventListener('focus', updateStats);
      clearInterval(interval);
    };
  }, [db]);

  // Keyboard shortcut for search (Cmd+K or Ctrl+K) and Escape to close modals/menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
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

  // 6 CORE TOP-LEVEL SECTIONS ARCHITECTURE
  const topSections: TopSectionConfig[] = [
    {
      id: 'OVERVIEW',
      label: 'Overview',
      fullLabel: 'Command Overview',
      icon: LayoutDashboard,
      description: 'Command Operations Center, SLA alerts, real-time KPI engines, and quick actions.',
      defaultModule: 'DASHBOARD',
      modules: [
        {
          id: 'DASHBOARD',
          label: 'QUICK ACTION LAUNCHPAD',
          shortLabel: 'Launchpad',
          icon: LayoutDashboard,
          description: 'Operations overview, urgent alerts, real-time database metrics, module health, and quick actions launchpad.',
          subTabs: [
            { id: 'OVERVIEW', label: 'Quick Action Launchpad', icon: LayoutDashboard }
          ]
        }
      ]
    },
    {
      id: 'SYSTEM_ANALYSIS',
      label: 'System Analysis',
      fullLabel: 'System Analysis & Journeys',
      icon: Activity,
      description: 'User-level analytics, complete 360° journey tracking, quotes, bookings, transactions, and conversion performance.',
      defaultModule: 'SYSTEM_ANALYSIS',
      modules: [
        {
          id: 'SYSTEM_ANALYSIS',
          label: 'System Analysis',
          shortLabel: 'System Analysis',
          icon: Activity,
          badge: '360° Live',
          description: 'Deep-dive user intelligence, activity ledger, individual timeline reconstruction, and conversion funnel analytics.',
          subTabs: [
            { id: 'USERS_MATRIX', label: 'User Performance Directory', icon: Users },
            { id: 'USER_JOURNEY', label: '360° User Journey Timeline', icon: Compass },
            { id: 'EVENT_STREAM', label: 'System Event Stream', icon: Activity },
            { id: 'FUNNEL_ANALYSIS', label: 'Conversion Funnel & Analytics', icon: BarChart3 }
          ]
        }
      ]
    },
    {
      id: 'OPERATIONS',
      label: 'Operations',
      fullLabel: 'Operations & Inventory',
      icon: Package,
      description: 'Master ground tour inventory, contracted luxury hotels, packages, reservations, and CRM pipeline.',
      defaultModule: 'PRODUCT_MANAGEMENT',
      modules: [
        {
          id: 'PRODUCT_MANAGEMENT',
          label: 'Product Management',
          shortLabel: 'Product Inventory',
          icon: Package,
          badge: `${counts.totalProducts}`,
          description: 'Master ground tour inventory engine, SKU specifications, child/infant rates, and adult tiers.',
          subTabs: [
            { id: 'PRODUCTS', label: `Product Inventory (${counts.totalProducts})`, icon: Package },
            { id: 'OPERATIONAL_ASSETS', label: 'Authoritative Operational Master Inventory', icon: Database },
            { id: 'VISAS', label: 'Visa Requirements & Checklists', icon: FileText }
          ]
        },
        {
          id: 'VISA_ANCILLARY_SERVICES',
          label: 'Visa & Ancillary Services',
          shortLabel: 'Visa & Ancillaries',
          icon: FileCheck,
          badge: 'Verified',
          description: 'Official Visa requirements & checklists, global travel protection, VIP airport concierge, and 5G eSIM connectivity.',
          subTabs: [
            { id: 'VISA_SERVICES', label: 'Visa Services & Assistance', icon: FileText },
            { id: 'TRAVEL_PROTECTION', label: 'Travel Protection & Medical', icon: ShieldCheck },
            { id: 'GROUND_CONNECTIVITY', label: 'Ground & Connectivity', icon: Sparkles },
            { id: 'FIELD_PARITY', label: 'Master Schema Matrix', icon: FileSpreadsheet }
          ]
        },
        {
          id: 'RAIL_MANAGEMENT',
          label: 'Japan Rail Inventory',
          shortLabel: 'Japan Rail',
          icon: Train,
          badge: 'smartEX Dynamic',
          description: 'Dynamic Japan Rail Shinkansen stations, routes, normalized tariff rates, season calendar rules, and dynamic pricing engine.',
          subTabs: [
            { id: 'OVERVIEW', label: 'Master Architecture', icon: Train },
            { id: 'COMMERCIAL_PRODUCTS', label: 'Commercial Master Products (2)', icon: Sparkles },
            { id: 'STATIONS', label: 'Station Master', icon: MapPin },
            { id: 'ROUTES', label: 'Route Network', icon: RouteIcon },
            { id: 'RATES', label: 'Rate Explorer', icon: DollarSign },
            { id: 'SEASONS', label: 'Season Calendar', icon: Calendar },
            { id: 'MARKUP', label: 'Dynamic Markup', icon: Percent },
            { id: 'SHEETS_SYNC', label: 'Google Sheets Sync', icon: FileSpreadsheet }
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
            { id: 'BOOKINGS', label: 'Ground Bookings & Supplier Operations', icon: CalendarCheck },
            { id: 'HORIZON', label: 'Operational Horizon & Ground Dispatch', icon: Compass }
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
            { id: 'QUOTES', label: 'Quotation Master Records', icon: Layers },
            { id: 'BUILDER', label: 'Quote Builder', icon: FileText }
          ]
        }
      ]
    },
    {
      id: 'CONTENT',
      label: 'Content',
      fullLabel: 'Content & Destinations',
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
            { id: 'CAMPAIGNS', label: 'Email Triggers & Broadcasts', icon: Sparkles },
            { id: 'NEWSLETTER', label: 'Newsletter & Sendy', icon: Mail }
          ]
        },
        {
          id: 'SEO_MANAGEMENT',
          label: 'SEO Management Engine',
          shortLabel: 'SEO & Indexing',
          icon: Globe2,
          badge: 'Live',
          description: 'Centralized SEO engine across all platform entities: global defaults, URL pattern templates, 301 redirects, robots.txt, dynamic sitemap.xml, and entity audit health.',
          subTabs: [
            { id: 'AUDIT', label: 'Site-wide SEO Audit', icon: ShieldCheck },
            { id: 'DEFAULTS', label: 'Global Defaults & Brand', icon: SlidersHorizontal },
            { id: 'TEMPLATES', label: 'URL & Meta Templates', icon: Layers },
            { id: 'REDIRECTS', label: '301 / 302 Redirects', icon: Compass },
            { id: 'TECHNICAL', label: 'Robots & Sitemap Tools', icon: Globe2 }
          ]
        }
      ]
    },
    {
      id: 'FINANCE',
      label: 'Finance',
      fullLabel: 'Finance & Administration',
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
            { id: 'PERMISSIONS', label: 'Access & Permissions', icon: Shield },
            { id: 'USERS_ACCESS', label: 'User Approval & Segregation', icon: UserCheck },
            { id: 'COMPANIES', label: 'Corporate Partners & Companies', icon: Building2 },
            { id: 'ROSTER', label: 'Staff Roster & Ops Allocation', icon: Users },
            { id: 'SUPPLIERS', label: 'Suppliers', icon: Building2 }
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
        },
        {
          id: 'CURRENCY_MANAGEMENT',
          label: 'Currency Management',
          shortLabel: 'Currency & FX',
          icon: CircleDollarSign,
          badge: 'Google Finance',
          description: 'Standardized currency conversion engine, authoritative Google Finance live rates, CMS manual adjustments, and audit trail.',
          subTabs: [
            { id: 'RATES_TABLE', label: 'Currency Pairs & Adjustments', icon: CircleDollarSign },
            { id: 'CALCULATOR_PREVIEW', label: 'Rate Preview & Simulator', icon: Calculator },
            { id: 'AUDIT_LOGS', label: 'FX Rate Audit Log', icon: History }
          ]
        }
      ]
    },
    {
      id: 'SYSTEM',
      label: 'System',
      fullLabel: 'System & Operations',
      icon: Database,
      description: 'Tasks & follow-ups management, production Integrations Hub, Firestore diagnostics, and audit governance ledger.',
      defaultModule: 'CALENDAR_SLAS',
      modules: [
        {
          id: 'CALENDAR_SLAS',
          label: 'Tasks & Follow-Ups',
          shortLabel: 'Tasks & Follow-Ups',
          icon: CheckSquare,
          badge: pendingTasks > 0 ? `${pendingTasks} Open` : 'Tasks',
          alertCount: pendingTasks,
          description: 'Manage your work, follow up with leads, coordinate booking activities, and keep every trip moving forward.',
          subTabs: [
            { id: 'TASKS', label: 'Tasks & Follow-Ups', icon: CheckSquare }
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
            { id: 'ACTIVITY_CENTER', label: 'Activity & Notification Center', icon: Activity },
            { id: 'DATA_SYNC_AUDIT', label: 'Data Sync & Consistency Audit', icon: ShieldCheck },
            { id: 'INTEGRATIONS_HUB', label: 'Integrations & Database Hub', icon: Sparkles },
            { id: 'FIRESTORE_DIAGNOSTICS', label: 'Firestore Diagnostics', icon: Activity },
            { id: 'AUDIT_TRAIL', label: 'Audit & Governance Ledger', icon: ShieldCheck },
            { id: 'SHEETS_SYNC', label: 'Master Google Sheets Sync', icon: FileSpreadsheet }
          ]
        }
      ]
    }
  ];

  // Helper mapping for aliases
  const normalizeSectionId = (sec: string): CMSSection => {
    if (sec === 'NOTIFICATIONS_MANAGEMENT') return 'CALENDAR_SLAS';
    if (sec === 'DATABASE_MANAGEMENT') return 'INTEGRATIONS_DB';
    if (sec === 'ACTIVITY_CENTER') return 'INTEGRATIONS_DB';
    return sec as CMSSection;
  };

  const allModules = topSections.flatMap(ts => ts.modules);
  const normalizedActiveSection = normalizeSectionId(activeSection);
  const currentModuleConfig = allModules.find(m => m.id === normalizedActiveSection || m.id === activeSection) || allModules[0];
  const currentTopSection = topSections.find(ts => ts.modules.some(m => m.id === currentModuleConfig.id)) || topSections[0];

  // Filter top-level navigation by current user permissions
  const accessibleTopSections = topSections
    .filter(ts => canUserAccessTopSection(currentUser, ts.id))
    .map(ts => ({
      ...ts,
      modules: ts.modules.filter(m => canUserAccessCMSModule(currentUser, m.id))
    }))
    .filter(ts => ts.modules.length > 0);

  const isCMSAllowed = canUserAccessCMS(currentUser);
  const isModuleAllowed = isCMSAllowed && canUserAccessCMSModule(currentUser, currentModuleConfig.id);
  const isSubTabAllowed = isModuleAllowed && (activeSubTab ? canUserAccessCMSSubTab(currentUser, currentModuleConfig.id, activeSubTab) : true);

  // Action Center Drawer & Linked Record Navigation state
  const [isActionCenterDrawerOpen, setIsActionCenterDrawerOpen] = useState(false);
  const [focusedActionCenterTask, setFocusedActionCenterTask] = useState<CalendarTask | null>(null);
  const [initialRecordIds, setInitialRecordIds] = useState<{
    bookingId?: string | null;
    leadId?: string | null;
    quoteId?: string | null;
    quoteVersion?: number | null;
    quoteMode?: 'inspect' | 'edit' | 'readonly' | null;
  }>({});

  const handleOpenActionCenter = (task?: CalendarTask) => {
    setFocusedActionCenterTask(task || null);
    setIsActionCenterDrawerOpen(true);
  };

  const handleOpenQuoteInBuilder = (
    quoteId: string, 
    options?: { version?: number; mode?: 'inspect' | 'edit' | 'readonly'; leadId?: string }
  ) => {
    if (quoteId === 'new') {
      setInitialRecordIds(prev => ({
        ...prev,
        quoteId: 'new',
        quoteVersion: 1,
        quoteMode: 'edit',
        leadId: options?.leadId || null
      }));
      setActiveSection('LEAD_MANAGEMENT');
      setActiveSubTab('BUILDER');
      return;
    }

    const resolution = resolveAndValidateQuoteForBuilder(
      db,
      {
        quoteId,
        quoteVersion: options?.version,
        mode: options?.mode || 'inspect',
        leadId: options?.leadId
      },
      currentUser
    );

    if (!resolution.isValid || !resolution.quote) {
      alert(resolution.errorMessage || 'Unable to open quotation in builder.');
      return;
    }

    setInitialRecordIds(prev => ({
      ...prev,
      quoteId: resolution.quote.id,
      quoteVersion: resolution.targetVersion,
      quoteMode: resolution.mode,
      leadId: options?.leadId || resolution.quote.leadId || null
    }));
    setActiveSection('LEAD_MANAGEMENT');
    setActiveSubTab('BUILDER');
  };

  const handleNavigate = (
    section: string, 
    subTab?: string, 
    recordId?: string,
    targetElementId?: string
  ) => {
    const normalized = normalizeSectionId(section);
    const targetModule = allModules.find(m => m.id === normalized || m.id === section);
    if (targetModule) {
      setActiveSection(targetModule.id);
      let chosenSubTab = subTab;
      if (chosenSubTab) {
        setActiveSubTab(chosenSubTab);
      } else if (targetModule.subTabs && targetModule.subTabs.length > 0) {
        chosenSubTab = targetModule.subTabs[0].id;
        setActiveSubTab(chosenSubTab);
      }
      const slug = SECTION_SLUG_MAP[targetModule.id] || targetModule.id.toLowerCase();
      let subSlug = '';
      if (targetModule.id === 'VISA_ANCILLARY_SERVICES') {
        const cleanSub = (chosenSubTab || 'VISA_SERVICES').toLowerCase().replace(/_/g, '-');
        subSlug = `/${cleanSub === 'field-parity' ? 'master-schema-matrix' : cleanSub}`;
      } else if (chosenSubTab && chosenSubTab !== 'OVERVIEW') {
        subSlug = `/${chosenSubTab.toLowerCase()}`;
      }
      const targetUrl = `/admin/${slug}${subSlug}`;
      if (typeof window !== 'undefined' && window.location.pathname !== targetUrl) {
        navigateTo(targetUrl);
      }
    }
    if (recordId) {
      if (section === 'BOOKING_MANAGEMENT' || subTab === 'BOOKINGS') {
        setInitialRecordIds(prev => ({ ...prev, bookingId: recordId }));
      } else if (subTab === 'BUILDER') {
        setInitialRecordIds(prev => ({ ...prev, quoteId: recordId }));
      } else if ((section === 'LEAD_MANAGEMENT' && subTab === 'QUOTES') || subTab === 'QUOTES' || section === 'QUOTES') {
        setInitialRecordIds(prev => ({ ...prev, quoteId: recordId }));
      } else if (section === 'LEAD_MANAGEMENT' || subTab === 'LEADS') {
        setInitialRecordIds(prev => ({ ...prev, leadId: recordId }));
      }
    }
    if (targetElementId) {
      setTimeout(() => {
        const el = document.getElementById(targetElementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-teal-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-teal-400'), 3000);
        }
      }, 400);
    }
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectModule = (moduleId: CMSSection, defaultSubTab?: string) => {
    setActiveSection(moduleId);
    const mod = allModules.find(m => m.id === moduleId);
    let chosenSubTab = defaultSubTab;
    if (chosenSubTab) {
      setActiveSubTab(chosenSubTab);
    } else if (mod && mod.subTabs && mod.subTabs.length > 0) {
      chosenSubTab = mod.subTabs[0].id;
      setActiveSubTab(chosenSubTab);
    }
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);

    const slug = SECTION_SLUG_MAP[moduleId] || moduleId.toLowerCase();
    const subSlug = chosenSubTab && chosenSubTab !== 'OVERVIEW' ? `/${chosenSubTab.toLowerCase()}` : '';
    const targetUrl = `/admin/${slug}${subSlug}`;
    if (typeof window !== 'undefined' && window.location.pathname !== targetUrl) {
      navigateTo(targetUrl);
    }
  };

  const handleSelectTopSection = (section: TopSectionConfig) => {
    if (section.modules.length === 1) {
      handleSelectModule(section.modules[0].id);
    } else {
      setOpenDropdown(openDropdown === section.id ? null : section.id);
    }
  };

  return (
    <div id="theunbound-admin-cms-root" className="flex h-screen w-full max-w-full overflow-hidden bg-[#F8FAFB] text-slate-900 font-sans selection:bg-[#00C6A6] selection:text-slate-950">
      
      {/* Global Command Palette / Search Modal */}
      <CMSGlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
        currentUser={currentUser}
      />

      {/* Standard Admin Sidebar (Fixed to Viewport, Independent Navigation Scroll) */}
      <AdminSidebar
        activeSection={activeSection}
        activeSubTab={activeSubTab}
        onNavigate={handleNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        counts={{
          products: counts.totalProducts,
          hotels: counts.hotels,
          packages: db.getPackages().length,
          leads: pendingLeads,
          bookings: pendingBookings,
          tasks: pendingTasks,
          users: pendingUsers,
          destinations: counts.destinations,
          hubs: counts.hubs
        }}
      />

      {/* Right Main Content Area (Independently Scrollable Workspace Column) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto w-full">
        
        {/* Standard Top Header */}
        <AdminHeader
          currentUser={currentUser}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onNavigate={handleNavigate}
          onLogout={authLogout}
          activePortalStats={activePortalStats}
        />

        {/* Sub-Tabs Bar (for modules with multiple tabs) */}
        {(() => {
          const permittedSubTabs = (currentModuleConfig.subTabs || []).filter(st => 
            canUserAccessCMSSubTab(currentUser, currentModuleConfig.id, st.id)
          );
          if (permittedSubTabs.length <= 1) return null;

          return (
            <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center space-x-1.5 overflow-x-auto scrollbar-none shrink-0 w-full select-none shadow-2xs">
              {permittedSubTabs.map((st) => {
                const SubIcon = st.icon || Layers;
                const isTabActive = activeSubTab === st.id || 
                  (st.id === 'VISA_SERVICES' && (activeSubTab === 'VISAS' || activeSubTab === 'OVERVIEW')) ||
                  (st.id === 'FIELD_PARITY' && (activeSubTab === 'MASTER_SCHEMA_MATRIX' || activeSubTab === 'SCHEMA_MATRIX'));
                return (
                  <button
                    key={st.id}
                    id={`cms-subtab-${st.id}`}
                    onClick={() => {
                      setActiveSubTab(st.id);
                      if (currentModuleConfig.id === 'VISA_ANCILLARY_SERVICES') {
                        const cleanSub = st.id.toLowerCase().replace(/_/g, '-');
                        const subSlug = cleanSub === 'field-parity' ? 'master-schema-matrix' : cleanSub;
                        const targetUrl = `/admin/visas-ancillary/${subSlug}`;
                        if (typeof window !== 'undefined' && window.location.pathname !== targetUrl) {
                          window.history.replaceState(null, '', targetUrl);
                        }
                      }
                    }}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isTabActive
                        ? 'bg-[#00C6A6]/15 text-[#008972] border border-[#00C6A6]/40 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <SubIcon className={`w-3.5 h-3.5 ${isTabActive ? 'text-[#008972]' : 'text-slate-400'}`} />
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* MAIN FULL-SCREEN WORKSPACE CONTENT */}
        <main className="flex-1 w-full min-w-0 max-w-full bg-[#F8FAFB] text-slate-900 p-3 sm:p-6 lg:p-8 space-y-6">
        
        {/* Urgent Action Center & Global Reminders Bar */}
        <div className="rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs">
          <GlobalRemindersBar 
            variant="admin" 
            onNavigate={(sec, sub, recId, _route, opts) => handleNavigate(sec, sub, recId, opts?.targetElementId)} 
            onOpenActionCenter={() => setIsActionCenterDrawerOpen(true)}
          />
        </div>

        {/* Dynamic Module Content or Access Restricted Gate */}
        {!isCMSAllowed || !isModuleAllowed || !isSubTabAllowed ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm animate-in fade-in">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              You do not have administrative clearance to access this module ({currentModuleConfig.label}). Please contact your system administrator if you require access.
            </p>
            <div className="pt-2">
              <button
                onClick={() => handleNavigate('DASHBOARD', 'OVERVIEW')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Return to Dashboard Overview
              </button>
            </div>
          </div>
        ) : (
        <div className="animate-in fade-in duration-200">
          
          {/* SECTION 1: OVERVIEW -> COMMAND DASHBOARD */}
          {(currentModuleConfig.id === 'DASHBOARD') && (
            <CMSDashboardHome 
              onNavigate={handleNavigate}
              currentUser={currentUser}
            />
          )}

          {/* SECTION: SYSTEM ANALYSIS & USER JOURNEY INTELLIGENCE */}
          {currentModuleConfig.id === 'SYSTEM_ANALYSIS' && (
            <SystemAnalysis 
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onLoadQuote={onLoadQuote}
            />
          )}

          {/* SECTION 2: OPERATIONS & INVENTORY */}
          {/* 2.1 PRODUCT MANAGEMENT */}
          {currentModuleConfig.id === 'PRODUCT_MANAGEMENT' && (
            <>
              {activeSubTab === 'PRODUCTS' && (
                <ProductManager destinations={destinations} onViewProduct={onViewProduct} />
              )}
              {activeSubTab === 'OPERATIONAL_ASSETS' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <OperationalAssetsManager
                    destinations={destinations}
                    cityHubs={db.getCityHubs()}
                    suppliers={db.getSuppliers()}
                  />
                </div>
              )}
              {(activeSubTab === 'VISAS' || activeSubTab === 'VISA_SERVICES' || activeSubTab === 'TRAVEL_PROTECTION' || activeSubTab === 'GROUND_CONNECTIVITY' || activeSubTab === 'FIELD_PARITY') && (
                <VisaCMSManager 
                  destinations={destinations} 
                  initialSubTab={activeSubTab === 'VISAS' ? 'VISA_SERVICES' : activeSubTab}
                  onSubTabChange={(tab) => {
                    setActiveSubTab(tab);
                    setActiveSection('VISA_ANCILLARY_SERVICES');
                    const subSlug = tab.toLowerCase().replace(/_/g, '-');
                    const targetUrl = `/admin/visas-ancillary/${subSlug}`;
                    if (typeof window !== 'undefined' && window.location.pathname !== targetUrl) {
                      window.history.replaceState(null, '', targetUrl);
                    }
                  }}
                />
              )}
            </>
          )}

          {/* 2.2 VISA & ANCILLARY SERVICES */}
          {currentModuleConfig.id === 'VISA_ANCILLARY_SERVICES' && (
            <VisaCMSManager 
              destinations={destinations} 
              initialSubTab={activeSubTab}
              onSubTabChange={(tab) => {
                setActiveSubTab(tab);
                const cleanSub = tab.toLowerCase().replace(/_/g, '-');
                const subSlug = cleanSub === 'field-parity' ? 'master-schema-matrix' : cleanSub;
                const targetUrl = `/admin/visas-ancillary/${subSlug}`;
                if (typeof window !== 'undefined' && window.location.pathname !== targetUrl) {
                  window.history.replaceState(null, '', targetUrl);
                }
              }}
            />
          )}

          {/* 2.2 JAPAN RAIL INVENTORY & DYNAMIC PRICING ENGINE */}
          {currentModuleConfig.id === 'RAIL_MANAGEMENT' && (
            <RailManager 
              initialTab={activeSubTab} 
              onSubTabChange={setActiveSubTab}
            />
          )}

          {/* 2.3 HOTEL MANAGEMENT */}
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
            <BookingsManager 
              initialBookingId={initialRecordIds.bookingId}
              initialSubTab={activeSubTab}
              onOpenActionCenter={handleOpenActionCenter}
            />
          )}

          {/* 2.5 LEAD MANAGEMENT */}
          {currentModuleConfig.id === 'LEAD_MANAGEMENT' && (
            <>
              {(!activeSubTab || activeSubTab === 'LEADS') && (
                <LeadManager 
                  initialLeadId={initialRecordIds.leadId}
                  onOpenActionCenter={handleOpenActionCenter}
                  onOpenBooking={(bId) => {
                    handleNavigate('BOOKING_MANAGEMENT', 'OPERATIONS', bId);
                  }}
                  onOpenQuote={(qId, options) => {
                    handleOpenQuoteInBuilder(qId, options);
                  }}
                  onViewQuoteInLedger={(qId) => {
                    handleNavigate('LEAD_MANAGEMENT', 'QUOTES', qId);
                  }}
                  onCreateQuoteForLead={(lead) => {
                    setLeadForNewQuote(lead);
                    handleOpenQuoteInBuilder('new', { leadId: lead.id, mode: 'edit' });
                  }}
                />
              )}
              {activeSubTab === 'QUOTES' && (
                <QuoteMasterManager 
                  initialQuoteId={initialRecordIds.quoteId}
                  onLoadQuote={(q) => {
                    onLoadQuote?.(q);
                    handleOpenQuoteInBuilder(q.id, { version: q.version, mode: q.isLocked ? 'inspect' : 'edit', leadId: q.leadId });
                  }}
                  onNavigateToLeads={() => setActiveSubTab('LEADS')}
                  onNavigateToBuilder={(qId, options) => {
                    if (!qId || qId === 'new') {
                      handleOpenQuoteInBuilder('new');
                    } else {
                      handleOpenQuoteInBuilder(qId, options);
                    }
                  }}
                  onOpenActionCenter={handleOpenActionCenter}
                />
              )}
              {activeSubTab === 'BUILDER' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => setActiveSubTab('QUOTES')}
                        className="font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>← Quotation Master Records</span>
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => setActiveSubTab('LEADS')}
                        className="font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>CRM Leads</span>
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {initialRecordIds.quoteId && initialRecordIds.quoteId !== 'new' ? (
                        <span>Authoritative Record: <strong className="font-mono text-slate-900 font-bold">{initialRecordIds.quoteId}</strong>{initialRecordIds.quoteVersion ? ` (Version ${initialRecordIds.quoteVersion})` : ''} [{initialRecordIds.quoteMode?.toUpperCase() || 'INSPECT'}]</span>
                      ) : (
                        <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                          New Quotation Workspace (In-Memory / Unsaved)
                        </span>
                      )}
                    </div>
                  </div>
                  <UnifiedB2BQuotationBuilder 
                    destinations={destinations}
                    products={products}
                    targetQuoteId={initialRecordIds.quoteId === 'new' ? undefined : (initialRecordIds.quoteId || undefined)}
                    targetQuoteVersion={initialRecordIds.quoteVersion || undefined}
                    initialMode={initialRecordIds.quoteMode || 'inspect'}
                    isNewQuoteMode={initialRecordIds.quoteId === 'new' || !initialRecordIds.quoteId}
                    prefillLead={leadForNewQuote}
                    onBackToDashboard={() => handleNavigate('DASHBOARD', 'OVERVIEW')}
                    onViewMyQuotes={() => setActiveSubTab('QUOTES')}
                  />
                </div>
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
              {(!activeSubTab || activeSubTab === 'NAVIGATION_MENU' || activeSubTab === 'MENU' || activeSubTab === 'CUSTOM_PAGES' || activeSubTab === 'PAGES') && (
                <MenuAndPagesManager 
                  defaultTab={activeSubTab === 'CUSTOM_PAGES' || activeSubTab === 'PAGES' ? 'CUSTOM_PAGES' : 'MENU'} 
                  currentUser={currentUser}
                />
              )}
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
              {activeSubTab === 'NEWSLETTER' && <NewsletterManager />}
            </>
          )}

          {/* 3.4 SEO MANAGEMENT ENGINE */}
          {currentModuleConfig.id === 'SEO_MANAGEMENT' && (
            <SEOManager />
          )}

          {/* SECTION 4: FINANCE & ADMINISTRATION */}
          {/* 4.1 ACCOUNT MANAGEMENT */}
          {currentModuleConfig.id === 'ACCOUNT_MANAGEMENT' && (
            <>
              {(!activeSubTab || activeSubTab === 'PERMISSIONS') && <UserApprovalAccessManager initialTab="PERMISSIONS" />}
              {activeSubTab === 'USERS_ACCESS' && <UserApprovalAccessManager initialTab="USERS_ACCESS" />}
              {activeSubTab === 'COMPANIES' && <UserApprovalAccessManager initialTab="COMPANIES" />}
              {activeSubTab === 'ROSTER' && <RosterAdminManager products={products} />}
              {activeSubTab === 'SUPPLIERS' && (
                <SupplierManager
                  currentUser={currentUser}
                  onNavigateToBooking={(bookingId) => handleNavigate('BOOKING_MANAGEMENT', 'OPERATIONS', bookingId)}
                />
              )}
            </>
          )}

          {/* 4.2 ANALYTICS & FINANCIALS */}
          {currentModuleConfig.id === 'ANALYTICS_MANAGEMENT' && (
            <FinancialsManager />
          )}

          {/* 4.3 CURRENCY MANAGEMENT & FX ENGINE */}
          {currentModuleConfig.id === 'CURRENCY_MANAGEMENT' && (
            <CurrencyManagementPanel currentUser={currentUser} />
          )}

          {/* SECTION 5: SYSTEM & OPERATIONS */}
          {/* 5.1 TASKS & FOLLOW-UPS */}
          {(currentModuleConfig.id === 'CALENDAR_SLAS' || currentModuleConfig.id === 'NOTIFICATIONS_MANAGEMENT') && (
            <CMSCalendarTasksManager
              currentUser={currentUser}
              onNavigateToBooking={(id) => handleNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', id)}
              onNavigateToLead={(id) => handleNavigate('LEAD_MANAGEMENT', 'LEADS', id)}
              onNavigateToQuote={(id) => handleNavigate('LEAD_MANAGEMENT', 'QUOTES', id)}
            />
          )}

          {/* 5.2 INTEGRATIONS & DATABASE */}
          {(currentModuleConfig.id === 'INTEGRATIONS_DB' || currentModuleConfig.id === 'DATABASE_MANAGEMENT') && (
            <>
              {(!activeSubTab || activeSubTab === 'ACTIVITY_CENTER') && (
                <AdminActivityCenter onNavigate={handleNavigate} currentUser={currentUser} />
              )}
              {activeSubTab === 'DATA_SYNC_AUDIT' && <DataSyncAuditViewer currentUser={currentUser} />}
              {activeSubTab === 'INTEGRATIONS_HUB' && (
                <IntegrationsManager currentUser={currentUser} />
              )}
              {activeSubTab === 'FIRESTORE_DIAGNOSTICS' && <FirestoreDiagnosticsViewer />}
              {activeSubTab === 'AUDIT_TRAIL' && <AuditTrailViewer />}
              {activeSubTab === 'SHEETS_SYNC' && <GoogleSheetsSyncManager />}
            </>
          )}
        </div>
        )}
      </main>
      </div>

      {/* Global Action Center Drawer */}
      <ActionCenterDrawer
        isOpen={isActionCenterDrawerOpen}
        onClose={() => {
          setIsActionCenterDrawerOpen(false);
          setFocusedActionCenterTask(null);
        }}
        currentUser={currentUser}
        initialTask={focusedActionCenterTask}
        onNavigateToRecord={(targetOrType: any, secondArg?: string, thirdArg?: string, fourthArg?: string) => {
          setIsActionCenterDrawerOpen(false);
          if (typeof targetOrType === 'object' && targetOrType !== null) {
            const target = targetOrType as ActionTarget;
            handleNavigate(target.section, target.subTab, target.recordId, target.targetElementId);
          } else {
            const entityType = targetOrType;
            const entityId = secondArg;
            if (entityType === 'BOOKING' || entityType === 'PAYMENT' || entityType === 'SERVICE' || entityType === 'SUPPLIER') {
              handleNavigate('BOOKING_MANAGEMENT', 'BOOKINGS', entityId, fourthArg);
            } else if (entityType === 'LEAD') {
              handleNavigate('LEAD_MANAGEMENT', 'LEADS', entityId, fourthArg);
            } else if (entityType === 'QUOTE') {
              handleNavigate('LEAD_MANAGEMENT', 'QUOTES', entityId, fourthArg);
            } else {
              handleNavigate(entityType, secondArg, thirdArg, fourthArg);
            }
          }
        }}
      />
    </div>
  );
};
