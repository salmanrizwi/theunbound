import React, { useState } from 'react';
import { Product, Destination, Quotation, BlogArticle } from '../../types';
import { ProductManager } from './ProductManager';
import { PricingManager } from './PricingManager';
import { HotelManager } from './HotelManager';
import { BookingsManager } from './BookingsManager';
import { QuoteMasterManager } from './QuoteMasterManager';
import { HomepageManager } from './HomepageManager';
import { BlogCMSManager } from './BlogCMSManager';
import { GalleryManager } from './GalleryManager';
import { ReviewManager } from './ReviewManager';
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
import { RosterAdminManager } from '../RosterAdminManager';
import { 
  ShieldCheck, 
  Package, 
  Hotel, 
  CalendarCheck, 
  LayoutTemplate, 
  Compass, 
  Users, 
  UserCheck,
  Receipt, 
  Megaphone, 
  BarChart3, 
  Bell, 
  Database, 
  FileSpreadsheet,
  DollarSign,
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

  // The 11 Core Parts of the Company Management System (CMS)
  const cmsSections: { 
    id: CMSSection; 
    partNumber: number; 
    label: string; 
    icon: LucideIcon; 
    description: string;
    subTabs: { id: string; label: string }[];
  }[] = [
    {
      id: 'PRODUCT_MANAGEMENT',
      partNumber: 1,
      label: 'Product Management',
      icon: Package,
      description: 'Master ground tour inventory, SKU specifications, child/infant costs, and commercial pricing matrices.',
      subTabs: [
        { id: 'PRODUCTS', label: 'Product Inventory & SKUs' },
        { id: 'PRICING', label: 'Commercial Pricing & Margin Matrix' },
        { id: 'SHEETS_SYNC', label: 'Google Sheets Live Sync' }
      ]
    },
    {
      id: 'HOTEL_MANAGEMENT',
      partNumber: 2,
      label: 'Hotel Management',
      icon: Hotel,
      description: 'Contracted luxury hotel allotments, room tiers, seasonal base currency tariffs, and meal plan supplements.',
      subTabs: [
        { id: 'HOTELS', label: 'Contracted Hotel Roster' }
      ]
    },
    {
      id: 'BOOKING_MANAGEMENT',
      partNumber: 3,
      label: 'Booking Management',
      icon: CalendarCheck,
      description: 'Live reservation pipeline, ground dispatch status, 12-hour SLA tracking, and instant PDF quotation archive.',
      subTabs: [
        { id: 'BOOKINGS', label: 'Ground Bookings & Dispatch' },
        { id: 'QUOTES', label: 'Quotation Master Records' }
      ]
    },
    {
      id: 'PAGE_MANAGEMENT',
      partNumber: 4,
      label: 'Page Management',
      icon: LayoutTemplate,
      description: 'Storefront layout controls, live customer moment gallery, verified Google reviews, and destination travel blogs.',
      subTabs: [
        { id: 'HOMEPAGE', label: 'Homepage & Hero Manager' },
        { id: 'GALLERY', label: 'Happy Customer Gallery' },
        { id: 'REVIEWS', label: 'Google Business Reviews' },
        { id: 'BLOGS', label: 'Editorial Articles & Guides' }
      ]
    },
    {
      id: 'DESTINATION_MANAGEMENT',
      partNumber: 5,
      label: 'Destination Management',
      icon: Compass,
      description: 'Destination definitions, city hubs, trade selling points, and local FAQ modules with base currency locks.',
      subTabs: [
        { id: 'DESTINATIONS', label: 'Destination Master Directory' },
        { id: 'CITIES', label: 'City Hubs & Gateways' },
        { id: 'FAQS', label: 'Destination FAQs & Trade Notes' }
      ]
    },
    {
      id: 'LEAD_MANAGEMENT',
      partNumber: 6,
      label: 'Lead Management',
      icon: Users,
      description: 'B2B agent inquiries, custom itinerary requests, lead stage Kanban, and concierge assignment.',
      subTabs: [
        { id: 'LEADS', label: 'CRM Leads & Pipeline' }
      ]
    },
    {
      id: 'ACCOUNT_MANAGEMENT',
      partNumber: 7,
      label: 'Account Management',
      icon: UserCheck,
      description: 'Admin user approval panel, Direct Buyer vs. B2B Agent segregation, custom margin settings, and internal function permissions.',
      subTabs: [
        { id: 'USERS_ACCESS', label: 'User Approval & Segregation' },
        { id: 'ROSTER', label: 'Staff Roster & Ops Allocation' }
      ]
    },
    {
      id: 'MARKETING_MANAGEMENT',
      partNumber: 8,
      label: 'Marketing Management',
      icon: Megaphone,
      description: 'Promotional discount campaigns, seasonal banners, early-bird deals, and targeted email broadcasts.',
      subTabs: [
        { id: 'PROMOTIONS', label: 'Promotions & Deal Campaigns' },
        { id: 'CAMPAIGNS', label: 'Email Newsletter Campaigns' }
      ]
    },
    {
      id: 'ANALYTICS_MANAGEMENT',
      partNumber: 9,
      label: 'Analytics & Financials',
      icon: BarChart3,
      description: 'Commercial margin realization, tax on margin reporting, monthly sales revenue, and official GST invoices.',
      subTabs: [
        { id: 'FINANCIALS', label: 'Financial Audit & Invoicing' }
      ]
    },
    {
      id: 'NOTIFICATIONS_MANAGEMENT',
      partNumber: 10,
      label: 'Notifications & Tasks',
      icon: Bell,
      description: 'Google Tasks workflow automation, 12h booking confirmation alerts, and quote follow-up triggers.',
      subTabs: [
        { id: 'TASKS', label: 'Google Tasks & System Alerts' }
      ]
    },
    {
      id: 'DATABASE_MANAGEMENT',
      partNumber: 11,
      label: 'Database & Audit Logs',
      icon: Database,
      description: 'Firestore live database state, immutable audit trail, system configuration, and data backups.',
      subTabs: [
        { id: 'AUDIT_TRAIL', label: 'Security & Action Audit Logs' },
        { id: 'SHEETS_SYNC', label: 'Sync & Backup Pipeline' }
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
      <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#00C6A6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 bg-[#00C6A6]/20 border border-[#00C6A6]/30 px-3 py-1 rounded-full text-[#00E5C0] text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TheUnbound Master Operating System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Company Management System (CMS)
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
              11-Part Central Operating Architecture: Product Inventory, Hotel Contracts, Booking Engine, Page Control, Destination Gateways, Lead CRM, Account & User Segregation, Marketing, Financial Analytics, Notifications, and Database Sync.
            </p>
          </div>
        </div>
      </div>

      {/* Main CMS Layout with Left-Side Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side CMS Navigation Menu */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-1.5 sticky top-24">
          <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>CMS Modules (11 Parts)</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">11</span>
          </div>

          <div className="space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
            {cmsSections.map(sec => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  id={`cms-nav-btn-${sec.id}`}
                  onClick={() => handleSectionSelect(sec.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#00C6A6] text-slate-950 shadow-md shadow-[#00C6A6]/20 font-extrabold'
                      : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 border border-transparent hover:border-slate-200'
                  }`}
                >
                  <span className={`text-[10px] w-5 h-5 rounded-lg flex items-center justify-center font-mono font-bold shrink-0 ${
                    isActive ? 'bg-slate-950 text-[#00E5C0]' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {sec.partNumber}
                  </span>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span className="truncate flex-1">{sec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side CMS Content Area */}
        <div className="lg:col-span-9 space-y-4">
          {/* Sub-Tabs Bar (if multiple tabs exist for the part) */}
          {currentSectionConfig.subTabs.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-2 overflow-x-auto">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 shrink-0">
                  Views:
                </span>
                {currentSectionConfig.subTabs.map(st => (
                  <button
                    key={st.id}
                    id={`cms-subtab-${st.id}`}
                    onClick={() => setActiveSubTab(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      activeSubTab === st.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 italic pr-3 hidden xl:block">
                {currentSectionConfig.description}
              </div>
            </div>
          )}

          {/* Module Content Switcher */}
          <div className="animate-in fade-in duration-200">
            {/* PART 1: PRODUCT MANAGEMENT */}
            {activeSection === 'PRODUCT_MANAGEMENT' && (
              <>
                {activeSubTab === 'PRODUCTS' && (
                  <ProductManager destinations={destinations} onViewProduct={onViewProduct} />
                )}
                {activeSubTab === 'PRICING' && (
                  <PricingManager destinations={destinations} />
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
                {activeSubTab === 'GALLERY' && <GalleryManager />}
                {activeSubTab === 'REVIEWS' && <ReviewManager />}
                {activeSubTab === 'BLOGS' && <BlogCMSManager onViewArticle={onViewArticle} />}
              </>
            )}

            {/* PART 5: DESTINATION MANAGEMENT */}
            {activeSection === 'DESTINATION_MANAGEMENT' && (
              <>
                {activeSubTab === 'DESTINATIONS' && <DestinationCMSManager />}
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
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Google Tasks & Ground Notification Triggers</h3>
                    <p className="text-xs text-slate-500">Automated 12-Hour Booking Confirmation Tasks & PDF Quote Download Alerts.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="font-bold text-xs text-slate-800">12-Hour Booking Confirmation SLA Task</div>
                    <p className="text-xs text-slate-600">Triggers automatically upon instant booking submission to guarantee local driver/vehicle dispatch within 12 hours.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="font-bold text-xs text-slate-800">Downloaded PDF Quotation Follow-Up Task</div>
                    <p className="text-xs text-slate-600">Logs a 24-hour CRM follow-up task whenever a client or B2B partner exports a formal branded PDF quotation.</p>
                  </div>
                </div>
              </div>
            )}

            {/* PART 11: DATABASE & AUDIT LOGS */}
            {activeSection === 'DATABASE_MANAGEMENT' && (
              <>
                {activeSubTab === 'AUDIT_TRAIL' && <AuditTrailViewer />}
                {activeSubTab === 'SHEETS_SYNC' && <GoogleSheetsSyncManager />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
