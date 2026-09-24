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
  if (clean === 'VISA' || clean === 'VISAS' || clean === 'VISAANCILLARYSERVICES' || clean === 'ANCILLARY' || clean === 'ANCILLARIES' || clean === 'VISASERVICES' || clean === 'TRAVELPROTECTION' || clean === 'VISASANCILLARY') return 'VISA_ANCILLARY_SERVICES';
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
    }
    if (initialSubTab) {
      const subUpper = initialSubTab.toUpperCase();
      if (subUpper === 'MENU' || subUpper === 'NAVIGATION') {
        setActiveSubTab('NAVIGATION_MENU');
      } else if (subUpper === 'CUSTOM_PAGES' || subUpper === 'PAGES') {
        setActiveSubTab('CUSTOM_PAGES');
      } else {
        setActiveSubTab(subUpper);
      }
    }
  }, [initialTab, initialSubTab]);
  const [openDropdown, setOpenDropdown] = useState<TopSectionId | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      description: 'User-level analytics, complete 360° journey tracking, quotes, bookings, transactions, and AI Planner performance.',
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
            { id: 'FUNNEL_ANALYSIS', label: 'Conversion & AI Funnel', icon: BarChart3 }
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
            { id: 'VIP_CONNECTIVITY', label: 'VIP Ground & 5G eSIM', icon: Sparkles },
            { id: 'FIELD_PARITY', label: 'Field Contract Matrix', icon: FileSpreadsheet }
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
            { id: 'OVERVIEW', label: 'Master Products & Engine', icon: Train },
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
            { id: 'CAMPAIGNS', label: 'Email Triggers & Broadcasts', icon: Sparkles }
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
      const subSlug = chosenSubTab && chosenSubTab !== 'OVERVIEW' ? `/${chosenSubTab.toLowerCase()}` : '';
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
    <div id="theunbound-admin-cms-root" className="min-h-screen w-full max-w-full overflow-x-hidden min-w-0 bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-[#00C6A6] selection:text-slate-950">
      
      {/* Global Command Palette / Search Modal */}
      <CMSGlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* ========================================================================= */}
      {/* UNIFIED FULL-SCREEN CMS HEADER (ROW 1: GLOBAL NAV + ROW 2: MODULE CONTEXT) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-slate-950/98 backdrop-blur-md border-b border-slate-800 text-white shadow-xl shrink-0 w-full">
        {/* ROW 1: BRAND, PRIMARY TOP-LEVEL SECTIONS, SEARCH & ACCOUNT TOOLS */}
        <div className="w-full px-2.5 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-15 gap-1.5 sm:gap-2">
            
            {/* LEFT: CMS BRAND & IDENTITY */}
            <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                title="Toggle CMS Navigation"
                aria-label="Toggle CMS Navigation"
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              <div 
                onClick={() => handleNavigate('DASHBOARD', 'OVERVIEW')}
                className="flex items-center space-x-2 cursor-pointer group select-none"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[#00C6A6] to-[#008972] flex items-center justify-center text-slate-950 font-black shadow-md shadow-[#00C6A6]/20 shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4 text-slate-950" />
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm sm:text-base font-black tracking-tight text-white font-sans lowercase">
                    theunbound
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#00C6A6]/20 border border-[#00C6A6]/40 text-[#00E5C0] text-[9px] font-extrabold uppercase tracking-wider">
                    CMS
                  </span>
                </div>
              </div>
            </div>

            {/* CENTER: 5 TOP-LEVEL NAVIGATION DROPDOWNS (Desktop) */}
            <nav className="hidden lg:flex items-center space-x-1 shrink-0" ref={dropdownRef}>
              {accessibleTopSections.map((sec) => {
                const isCurrentActiveSection = currentTopSection.id === sec.id;
                const isDropdownOpen = openDropdown === sec.id;
                const TopIcon = sec.icon;
                const isRightAligned = sec.id === 'FINANCE' || sec.id === 'SYSTEM';

                if (sec.modules.length === 1) {
                  const singleModule = sec.modules[0];
                  const isActive = currentModuleConfig.id === singleModule.id;
                  return (
                    <button
                      key={sec.id}
                      id={`top-nav-${sec.id}`}
                      onClick={() => handleSelectModule(singleModule.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#008972] text-white shadow-xs ring-1 ring-[#00C6A6]/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <span>{sec.label}</span>
                      {sec.fullLabel && sec.label && sec.fullLabel !== sec.label && (
                        <span className="hidden 2xl:inline">
                          {(sec.fullLabel || '').replace(sec.label || '', '')}
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <div key={sec.id} className="relative">
                    <button
                      id={`top-nav-${sec.id}`}
                      onClick={() => handleSelectTopSection(sec)}
                      onMouseEnter={() => setOpenDropdown(sec.id)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                        isCurrentActiveSection
                          ? 'bg-[#008972] text-white shadow-xs ring-1 ring-[#00C6A6]/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <span>{sec.label}</span>
                      {sec.fullLabel && sec.label && sec.fullLabel !== sec.label && (
                        <span className="hidden 2xl:inline">
                          {(sec.fullLabel || '').replace(sec.label || '', '')}
                        </span>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isDropdownOpen ? 'rotate-180 text-white' : ''}`} />
                    </button>

                    {/* Mega Dropdown Menu - Anchored & Clamped */}
                    {isDropdownOpen && (
                      <div 
                        className={`absolute ${isRightAligned ? 'right-0' : 'left-0'} top-full pt-1.5 z-50`}
                        onMouseEnter={() => setOpenDropdown(sec.id)}
                        onMouseLeave={() => setOpenDropdown(null)}
                      >
                        <div className="w-80 sm:w-84 max-w-[90vw] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2.5 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-slate-800">
                          <div className="px-3 py-2 border-b border-slate-800/80 mb-1.5">
                            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#00E5C0] flex items-center space-x-1.5">
                              <TopIcon className="w-3.5 h-3.5" />
                              <span>{sec.fullLabel || sec.label}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                              {sec.description}
                            </p>
                          </div>

                          <div className="space-y-1 max-h-[65vh] overflow-y-auto scrollbar-thin">
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
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* RIGHT: GLOBAL TOOLS & UTILITIES */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              
              {/* Active Users Count (B2B + Buyer Portal) */}
              <div
                id="cms-active-users-count"
                onClick={() => handleNavigate('ACCOUNT_MANAGEMENT', 'USERS_ACCESS')}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-[#00C6A6]/40 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none shrink-0"
                title={`Active Users: B2B: ${activePortalStats.b2b} · Buyer: ${activePortalStats.buyer} (Total: ${activePortalStats.total}). Click to manage.`}
              >
                {/* Live pulsing indicator */}
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>

                <span className="text-emerald-400 font-bold whitespace-nowrap text-xs">
                  B2B:{activePortalStats.b2b}
                </span>
                <span className="text-slate-600 text-xs">·</span>
                <span className="text-slate-300 font-bold whitespace-nowrap text-xs">
                  Buyer:{activePortalStats.buyer}
                </span>
              </div>

              {/* Canonical Home Link */}
              <button
                onClick={() => navigateTo('/')}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-[#00C6A6]/40 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer group shrink-0"
                title="Return to TheUnbound Canonical Home Page (/)"
              >
                <Globe2 className="w-3.5 h-3.5 text-[#00E5C0]" />
                <span className="hidden md:inline text-xs font-semibold">Home</span>
              </button>

              {/* Quick Search Button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer group shrink-0"
                title="Search Operations Engine (⌘K)"
              >
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00C6A6]" />
                <span className="hidden xl:inline text-xs font-semibold">Search</span>
                <kbd className="hidden 2xl:inline-block text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-mono">⌘K</kbd>
              </button>

              {/* Action Center Drawer Trigger */}
              <button
                type="button"
                onClick={() => setIsActionCenterDrawerOpen(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer group shrink-0"
                title="Action Center (Tasks & Live Record Reminders)"
              >
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="hidden sm:inline text-xs font-semibold">Action Center</span>
              </button>

              {/* Real-time Notifications & SLA Dropdown */}
              <div className="shrink-0">
                <CMSNotificationsDropdown onNavigate={handleNavigate} currentUser={currentUser} />
              </div>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="hidden lg:flex p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Workspace'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {/* User Account Menu */}
              <div className="relative shrink-0" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-1.5 p-1 sm:px-2 sm:py-1 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-colors cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#00C6A6] to-[#00E5C0] text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    {currentUser.name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-white leading-none hidden 2xl:inline truncate max-w-[90px]">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* User Dropdown */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in duration-150 ring-1 ring-slate-800">
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
                          handleNavigate('PAGE_MANAGEMENT', 'NAVIGATION_MENU');
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg flex items-center space-x-2 cursor-pointer"
                      >
                        <Menu className="w-3.5 h-3.5 text-[#00C6A6]" />
                        <span>Menu & Custom Pages</span>
                      </button>

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

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigateTo('/');
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-[#00E5C0] hover:text-[#00C6A6] hover:bg-emerald-950/30 rounded-lg flex items-center space-x-2 cursor-pointer"
                      >
                        <Globe2 className="w-3.5 h-3.5 text-[#00E5C0]" />
                        <span>Home Page (/)</span>
                      </button>

                      <div className="pt-1 border-t border-slate-800/80 mt-1">
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            authLogout();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg flex items-center space-x-2 cursor-pointer transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5 text-rose-400" />
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

        {/* ROW 2: MODULE CONTEXT, BREADCRUMBS & SUB-TABS SELECTOR */}
        <div className="bg-slate-950/95 border-t border-slate-800/80 py-2 sm:py-2.5 px-2.5 sm:px-4 lg:px-6 text-white shrink-0">
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
            
            {/* Breadcrumbs & Active Module Title */}
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[#00E5C0] shrink-0">
                <currentModuleConfig.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-medium leading-none mb-0.5">
                  <button
                    onClick={() => handleNavigate('DASHBOARD', 'OVERVIEW')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Overview
                  </button>
                  <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                  <span className="text-slate-300 font-medium truncate max-w-[140px]">{currentTopSection.label}</span>
                  <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                  <span className="text-[#00E5C0] font-semibold truncate max-w-[180px]">{currentModuleConfig.label}</span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-white truncate leading-tight">
                  {currentModuleConfig.label}
                </h1>
              </div>
            </div>

            {/* Sub-Tabs Selector */}
            {(() => {
              const permittedSubTabs = (currentModuleConfig.subTabs || []).filter(st => 
                canUserAccessCMSSubTab(currentUser, currentModuleConfig.id, st.id)
              );
              if (permittedSubTabs.length === 0) return null;

              return (
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0 max-w-full">
                  {permittedSubTabs.map((st) => {
                    const SubIcon = st.icon || Layers;
                    const isTabActive = activeSubTab === st.id;
                    return (
                      <button
                        key={st.id}
                        id={`cms-subtab-${st.id}`}
                        onClick={() => setActiveSubTab(st.id)}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          isTabActive
                            ? 'bg-[#008972] text-white shadow-xs ring-1 ring-[#00C6A6]/40'
                            : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:text-white'
                        }`}
                      >
                        <SubIcon className={`w-3.5 h-3.5 ${isTabActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* MOBILE NAVIGATION DRAWER */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-slate-950 border-t border-slate-800 p-3.5 sm:p-4 max-h-[calc(100dvh-120px)] overflow-y-auto modal-body-scroll space-y-4 pb-safe shadow-2xl">
            <div className="space-y-4">
              {accessibleTopSections.map((sec) => (
                <div key={sec.id} className="space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#00E5C0] px-2">
                    {sec.fullLabel || sec.label}
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
      {/* MAIN FULL-SCREEN WORKSPACE CONTENT */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full min-w-0 max-w-full bg-slate-100 text-slate-900 p-3 sm:p-6 lg:p-8 space-y-6">
        
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
              {activeSubTab === 'VISAS' && (
                <VisaCMSManager 
                  destinations={destinations} 
                  initialSubTab="VISA_SERVICES"
                  onSubTabChange={setActiveSubTab}
                />
              )}
            </>
          )}

          {/* 2.2 VISA & ANCILLARY SERVICES */}
          {currentModuleConfig.id === 'VISA_ANCILLARY_SERVICES' && (
            <VisaCMSManager 
              destinations={destinations} 
              initialSubTab={activeSubTab}
              onSubTabChange={setActiveSubTab}
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
