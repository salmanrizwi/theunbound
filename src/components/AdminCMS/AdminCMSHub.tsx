import React, { useState } from 'react';
import { Product, Destination, Quotation, BlogArticle } from '../../types';
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
import { RosterAdminManager } from '../RosterAdminManager';
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
  LucideIcon
} from 'lucide-react';

export type CMSSection = 
  | 'PRODUCT_MANAGEMENT'
  | 'HOTEL_MANAGEMENT'
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
  initialTab?: string;
}

export const AdminCMSHub: React.FC<AdminCMSHubProps> = ({
  destinations,
  products,
  onViewProduct,
  onViewArticle,
  onLoadQuote,
}) => {
  const [activeSection, setActiveSection] = useState<CMSSection>('PRODUCT_MANAGEMENT');
  const [activeSubTab, setActiveSubTab] = useState<string>('PRODUCTS');

  // The 11 Core Parts of Company Management System (CMS)
  const cmsSections: { 
    id: CMSSection; 
    partNumber: number; 
    label: string; 
    icon: LucideIcon; 
    badge?: string;
    description: string;
    subTabs: { id: string; label: string; icon?: LucideIcon }[];
  }[] = [
    {
      id: 'PRODUCT_MANAGEMENT',
      partNumber: 1,
      label: 'Product Management',
      icon: Package,
      badge: 'Core Engine',
      description: 'Master ground tour inventory engine, SKU specifications, child/infant rates, adult tiers, and Google Sheets sync.',
      subTabs: [
        { id: 'PRODUCTS', label: 'Product Inventory Engine & SKUs', icon: Package },
        { id: 'VISAS', label: 'Visa Products & Consular Checklists', icon: FileText },
        { id: 'SHEETS_SYNC', label: 'Google Sheets Live Sync', icon: FileSpreadsheet }
      ]
    },
    {
      id: 'HOTEL_MANAGEMENT',
      partNumber: 2,
      label: 'Hotel Management',
      icon: Hotel,
      badge: 'Allotments & Pax',
      description: 'Contracted luxury hotel allotments, room tiers, passenger min/max controls, kids age rules, and meal plan supplements.',
      subTabs: [
        { id: 'HOTELS', label: 'Contracted Hotel Roster & Rates', icon: Hotel }
      ]
    },
    {
      id: 'BOOKING_MANAGEMENT',
      partNumber: 3,
      label: 'Booking Management',
      icon: CalendarCheck,
      badge: 'Supplier Allocation',
      description: 'Ground reservation pipeline, supplier assignment, status verification, 12-hour SLA alerts, and quote archives.',
      subTabs: [
        { id: 'BOOKINGS', label: 'Ground Bookings & Supplier Operations', icon: CalendarCheck },
        { id: 'QUOTES', label: 'Quotation Master Records', icon: Layers }
      ]
    },
    {
      id: 'PAGE_MANAGEMENT',
      partNumber: 4,
      label: 'Page Management',
      icon: LayoutTemplate,
      badge: 'Dynamic Pages',
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
      id: 'DESTINATION_MANAGEMENT',
      partNumber: 5,
      label: 'Destination Management',
      icon: Compass,
      badge: 'Hierarchy',
      description: 'Connected 4-Tier Hierarchy: 1. REGION (Macro) ↓ 2. DESTINATION (Country) ↓ 3. DESTINATION HUB / CITY ↓ 4. PRODUCT / HOTEL / ACTIVITY / TRANSFER / GUIDE.',
      subTabs: [
        { id: 'REGIONS', label: '1. Master Regions (Tier 1)', icon: Globe2 },
        { id: 'DESTINATIONS', label: '2. Destinations (Tier 2)', icon: Compass },
        { id: 'CITIES', label: '3. City Hubs (Tier 3)', icon: Layers },
        { id: 'FAQS', label: 'Destination FAQs & Trade Notes', icon: Sparkles }
      ]
    },
    {
      id: 'LEAD_MANAGEMENT',
      partNumber: 6,
      label: 'Lead Management',
      icon: Users,
      badge: 'Live CRM',
      description: 'B2B agent inquiries, contact form leads, saved quote requests, PDF download leads, and sales assignment.',
      subTabs: [
        { id: 'LEADS', label: 'CRM Leads & Pipeline', icon: Users }
      ]
    },
    {
      id: 'ACCOUNT_MANAGEMENT',
      partNumber: 7,
      label: 'Account Management',
      icon: UserCheck,
      description: 'Admin user approval panel, Direct Buyer vs. B2B Agent segregation, custom margin settings, and staff roster.',
      subTabs: [
        { id: 'USERS_ACCESS', label: 'User Approval & Segregation', icon: UserCheck },
        { id: 'ROSTER', label: 'Staff Roster & Ops Allocation', icon: Users }
      ]
    },
    {
      id: 'MARKETING_MANAGEMENT',
      partNumber: 8,
      label: 'Marketing Management',
      icon: Megaphone,
      badge: 'Email Triggers',
      description: 'Promotional discount campaigns, seasonal banners, early-bird deals, and automated email trigger dispatch.',
      subTabs: [
        { id: 'PROMOTIONS', label: 'Promotions & Deal Campaigns', icon: Megaphone },
        { id: 'CAMPAIGNS', label: 'Email Triggers & Broadcasts', icon: Sparkles }
      ]
    },
    {
      id: 'ANALYTICS_MANAGEMENT',
      partNumber: 9,
      label: 'Analytics & Financials',
      icon: BarChart3,
      description: 'Commercial margin realization, tax on margin reporting, monthly sales revenue, and official GST invoices.',
      subTabs: [
        { id: 'FINANCIALS', label: 'Financial Audit & Invoicing', icon: Receipt }
      ]
    },
    {
      id: 'NOTIFICATIONS_MANAGEMENT',
      partNumber: 10,
      label: 'Notifications & Tasks',
      icon: Bell,
      description: 'Google Tasks workflow automation, 12h booking confirmation alerts, and quote follow-up triggers.',
      subTabs: [
        { id: 'TASKS', label: 'Google Tasks & Ground SLAs', icon: Bell }
      ]
    },
    {
      id: 'DATABASE_MANAGEMENT',
      partNumber: 11,
      label: 'Database & Audit Logs',
      icon: Database,
      description: 'Firestore live database state, live collection connectivity auditor, immutable audit trail, and sync pipeline.',
      subTabs: [
        { id: 'FIRESTORE_DIAGNOSTICS', label: 'Live Firestore Diagnostics', icon: Activity },
        { id: 'AUDIT_TRAIL', label: 'Security & Action Audit Logs', icon: ShieldCheck },
        { id: 'SHEETS_SYNC', label: 'Sync & Backup Pipeline', icon: FileSpreadsheet }
      ]
    }
  ];

  const currentSectionConfig = cmsSections.find(s => s.id === activeSection) || cmsSections[0];

  const handleSectionSelect = (sectionId: CMSSection) => {
    setActiveSection(sectionId);
    const sec = cmsSections.find(s => s.id === sectionId);
    if (sec && sec.subTabs.length > 0) {
      setActiveSubTab(sec.subTabs[0].id);
    }
  };

  return (
    <div id="company-management-system-hub" className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#00C6A6]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-[#00C6A6]/20 border border-[#00C6A6]/40 px-3 py-1 rounded-full text-[#00E5C0] text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TheUnbound Master Operating System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white font-sans">
              Company Management System (CMS)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              11-Part Central Operating Architecture: Product Inventory, Hotel Contracts, Booking Engine, Page Control, Destination Gateways, Lead CRM, Account & User Segregation, Marketing, Financial Analytics, Notifications, and Database Sync.
            </p>
          </div>

          {/* Quick Module Switcher Dropdown on Mobile / Header */}
          <div className="w-full md:w-auto shrink-0">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-lg">
              <label htmlFor="cms-quick-select" className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5 px-1">
                Jump to Module (1 to 11):
              </label>
              <div className="relative">
                <select
                  id="cms-quick-select"
                  value={activeSection}
                  onChange={(e) => handleSectionSelect(e.target.value as CMSSection)}
                  className="w-full md:w-72 bg-slate-950 text-white text-xs font-bold py-2.5 pl-3 pr-8 rounded-xl border border-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#00C6A6] cursor-pointer"
                >
                  {cmsSections.map(sec => (
                    <option key={sec.id} value={sec.id} className="bg-slate-950 text-white py-1">
                      Part {sec.partNumber}: {sec.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main CMS Layout (Full-Width with Top Dropdown & Subtabs Navigation) */}
      <div className="w-full space-y-6">
        {/* Active Module Header & Submenu Bar */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
          {/* Active Part Context Title & Dropdown Switcher */}
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative">
                <select
                  id="cms-active-module-select"
                  aria-label="Select CMS Module"
                  value={activeSection}
                  onChange={(e) => handleSectionSelect(e.target.value as CMSSection)}
                  className="w-full sm:w-80 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-bold py-2.5 pl-3.5 pr-9 rounded-xl border border-slate-300 appearance-none focus:outline-hidden focus:ring-2 focus:ring-[#008972] cursor-pointer shadow-2xs transition-colors"
                >
                  {cmsSections.map(sec => (
                    <option key={sec.id} value={sec.id}>
                      Part {sec.partNumber}: {sec.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {currentSectionConfig.description}
          </p>

          {/* Sub-Tabs Navigation (Visible when a module has multiple sub-views) */}
          {currentSectionConfig.subTabs.length > 1 && (
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

        {/* Module Content Switcher */}
        <div className="animate-in fade-in duration-200">
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
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Google Tasks & Ground SLA Automations</h3>
                  <p className="text-xs text-slate-500">Automated 12-Hour Booking Confirmation Dispatch & 24h PDF Quote Download Follow-Ups.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">12-Hour Booking Confirmation SLA Task</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">Active SLA</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Triggers automatically upon instant booking submission to guarantee local driver/vehicle dispatch within 12 hours.
                  </p>
                </div>
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">Downloaded PDF Quotation Follow-Up Task</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">24h SLA</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Logs a 24-hour CRM follow-up task whenever a client or B2B partner exports a formal branded PDF quotation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PART 11: DATABASE & AUDIT LOGS */}
          {activeSection === 'DATABASE_MANAGEMENT' && (
            <>
              {activeSubTab === 'FIRESTORE_DIAGNOSTICS' && <FirestoreDiagnosticsViewer />}
              {activeSubTab === 'AUDIT_TRAIL' && <AuditTrailViewer />}
              {activeSubTab === 'SHEETS_SYNC' && <GoogleSheetsSyncManager />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
