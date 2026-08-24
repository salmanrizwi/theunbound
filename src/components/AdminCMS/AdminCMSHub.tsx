import React, { useState } from 'react';
import { Product, Destination, Quotation, BlogArticle } from '../../types';
import { HomepageManager } from './HomepageManager';
import { CityHubsManager } from './CityHubsManager';
import { DestinationFAQManager } from './DestinationFAQManager';
import { GalleryManager } from './GalleryManager';
import { HotelManager } from './HotelManager';
import { LeadManager } from './LeadManager';
import { FinancialsManager } from './FinancialsManager';
import { EmailCampaignsManager } from './EmailCampaignsManager';
import { GoogleSheetsSyncManager } from './GoogleSheetsSyncManager';
import { PromotionManager } from './PromotionManager';
import { DestinationCMSManager } from './DestinationCMSManager';
import { ProductManager } from './ProductManager';
import { PricingManager } from './PricingManager';
import { BlogCMSManager } from './BlogCMSManager';
import { ReviewManager } from './ReviewManager';
import { QuoteMasterManager } from './QuoteMasterManager';
import { BookingsManager } from './BookingsManager';
import { AuditTrailViewer } from './AuditTrailViewer';
import { RosterAdminManager } from '../RosterAdminManager';
import { 
  ShieldCheck, 
  Tag, 
  MapPin, 
  Package, 
  DollarSign, 
  BookOpen, 
  Star, 
  FileSpreadsheet, 
  CalendarCheck,
  History, 
  Users, 
  Compass, 
  Layers, 
  LayoutTemplate, 
  Building2, 
  HelpCircle, 
  Camera, 
  Hotel, 
  Receipt, 
  Mail, 
  RefreshCw,
  LucideIcon
} from 'lucide-react';

export type AdminModuleTab = 
  | 'HOMEPAGE'
  | 'CITIES'
  | 'FAQS'
  | 'GALLERY'
  | 'HOTELS'
  | 'LEADS'
  | 'FINANCIALS'
  | 'CAMPAIGNS'
  | 'SHEETS_SYNC'
  | 'PROMOTIONS'
  | 'DESTINATIONS'
  | 'PRODUCTS'
  | 'PRICING'
  | 'BLOGS'
  | 'REVIEWS'
  | 'QUOTES'
  | 'BOOKINGS'
  | 'AUDIT_TRAIL'
  | 'ROSTER';

interface AdminCMSHubProps {
  destinations: Destination[];
  products: Product[];
  onViewProduct?: (product: Product) => void;
  onViewArticle?: (article: BlogArticle) => void;
  onLoadQuote?: (quote: Quotation) => void;
  initialTab?: AdminModuleTab;
}

export const AdminCMSHub: React.FC<AdminCMSHubProps> = ({
  destinations,
  products,
  onViewProduct,
  onViewArticle,
  onLoadQuote,
  initialTab = 'HOMEPAGE'
}) => {
  const [activeTab, setActiveTab] = useState<AdminModuleTab>(initialTab);

  const tabs: { id: AdminModuleTab; label: string; icon: LucideIcon; category: 'CORE' | 'CATALOG' | 'OPS' | 'SYSTEM'; badge?: string }[] = [
    // CORE STOREFRONT & MARKETING
    { id: 'HOMEPAGE', label: 'Homepage Control', icon: LayoutTemplate, category: 'CORE', badge: 'Hero & Grid' },
    { id: 'PROMOTIONS', label: 'Promotions & Deals', icon: Tag, category: 'CORE', badge: 'Offers' },
    { id: 'GALLERY', label: 'Customer Gallery', icon: Camera, category: 'CORE' },
    { id: 'REVIEWS', label: 'Google Reviews', icon: Star, category: 'CORE' },
    { id: 'BLOGS', label: 'Blog & Editorial', icon: BookOpen, category: 'CORE' },
    { id: 'FAQS', label: 'Destination FAQs', icon: HelpCircle, category: 'CORE' },

    // CATALOG & CONTRACTING
    { id: 'DESTINATIONS', label: 'Destinations', icon: Compass, category: 'CATALOG' },
    { id: 'CITIES', label: 'Cities & Hubs', icon: Building2, category: 'CATALOG' },
    { id: 'HOTELS', label: 'Hotels & Rates', icon: Hotel, category: 'CATALOG', badge: 'B2B' },
    { id: 'PRODUCTS', label: 'Product Inventory', icon: Package, category: 'CATALOG', badge: `${products.length}` },
    { id: 'PRICING', label: 'Dynamic Pricing', icon: DollarSign, category: 'CATALOG' },
    { id: 'SHEETS_SYNC', label: 'Google Sheets Sync', icon: FileSpreadsheet, category: 'CATALOG', badge: 'Manual' },

    // OPERATIONS & SALES CRM
    { id: 'LEADS', label: 'Leads & CRM', icon: Users, category: 'OPS', badge: 'Pipeline' },
    { id: 'QUOTES', label: 'Quotes & Access', icon: FileSpreadsheet, category: 'OPS' },
    { id: 'BOOKINGS', label: 'Bookings & Ground Ops', icon: CalendarCheck, category: 'OPS', badge: 'SLA' },
    { id: 'FINANCIALS', label: 'Financials & Invoicing', icon: Receipt, category: 'OPS', badge: 'Tax/GST' },
    { id: 'CAMPAIGNS', label: 'Email Campaigns', icon: Mail, category: 'OPS', badge: 'Automated' },

    // SYSTEM & ACCESS
    { id: 'ROSTER', label: 'Roster & Roles', icon: Users, category: 'SYSTEM' },
    { id: 'AUDIT_TRAIL', label: 'Audit Log', icon: History, category: 'SYSTEM' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#00C6A6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-[#00C6A6]/20 border border-[#00C6A6]/30 px-3 py-1 rounded-full text-[#00E5C0] text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TheUnbound Master Operations Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Company Management System & Admin CMS
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl">
              Comprehensive internal operating system: storefront controls, destination hubs, luxury hotel contracts, dynamic quotation pricing, CRM leads pipeline, GST invoicing & ground service vouchers, automated email campaigns, and Google Sheets manual inventory sync.
            </p>
          </div>
        </div>

        {/* Tab Navigation Bar with Categories */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          <div className="flex items-center space-x-2 min-w-max">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#00C6A6] text-slate-950 shadow-md shadow-[#00C6A6]/20'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      isActive ? 'bg-slate-950 text-[#00E5C0]' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Module Content */}
      <div className="animate-in fade-in duration-200">
        {activeTab === 'HOMEPAGE' && (
          <HomepageManager destinations={destinations} />
        )}
        {activeTab === 'CITIES' && (
          <CityHubsManager destinations={destinations} />
        )}
        {activeTab === 'FAQS' && (
          <DestinationFAQManager destinations={destinations} />
        )}
        {activeTab === 'GALLERY' && (
          <GalleryManager />
        )}
        {activeTab === 'HOTELS' && (
          <HotelManager destinations={destinations} />
        )}
        {activeTab === 'LEADS' && (
          <LeadManager />
        )}
        {activeTab === 'FINANCIALS' && (
          <FinancialsManager />
        )}
        {activeTab === 'CAMPAIGNS' && (
          <EmailCampaignsManager />
        )}
        {activeTab === 'SHEETS_SYNC' && (
          <GoogleSheetsSyncManager />
        )}
        {activeTab === 'PROMOTIONS' && (
          <PromotionManager destinations={destinations} products={products} />
        )}
        {activeTab === 'DESTINATIONS' && (
          <DestinationCMSManager />
        )}
        {activeTab === 'PRODUCTS' && (
          <ProductManager destinations={destinations} onViewProduct={onViewProduct} />
        )}
        {activeTab === 'PRICING' && (
          <PricingManager destinations={destinations} />
        )}
        {activeTab === 'BLOGS' && (
          <BlogCMSManager onViewArticle={onViewArticle} />
        )}
        {activeTab === 'REVIEWS' && (
          <ReviewManager />
        )}
        {activeTab === 'QUOTES' && (
          <QuoteMasterManager onLoadQuote={onLoadQuote} />
        )}
        {activeTab === 'BOOKINGS' && (
          <BookingsManager />
        )}
        {activeTab === 'AUDIT_TRAIL' && (
          <AuditTrailViewer />
        )}
        {activeTab === 'ROSTER' && (
          <RosterAdminManager products={products} />
        )}
      </div>
    </div>
  );
};
