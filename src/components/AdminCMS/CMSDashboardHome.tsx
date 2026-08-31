import React, { useMemo, useState } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  Product, 
  Hotel, 
  Destination, 
  TravelLead, 
  Quotation, 
  Booking, 
  User, 
  AuditLog,
  CalendarTask
} from '../../types';
import { 
  Package, 
  Hotel as HotelIcon, 
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
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  ArrowRight, 
  Clock, 
  FileSpreadsheet, 
  Activity, 
  Mail, 
  Sparkles, 
  Layers, 
  Calendar as CalendarIcon,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Globe2,
  FileText,
  X
} from 'lucide-react';

interface CMSDashboardHomeProps {
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
  currentUser?: User | null;
}

export const CMSDashboardHome: React.FC<CMSDashboardHomeProps> = ({
  onNavigate,
  currentUser
}) => {
  const db = AppDatabase.getInstance();
  const [showAllActionsModal, setShowAllActionsModal] = useState(false);

  // Load live real records from database
  const products = useMemo(() => db.getProducts(), [db]);
  const hotels = useMemo(() => db.getHotels(), [db]);
  const destinations = useMemo(() => db.getDestinations(), [db]);
  const cityHubs = useMemo(() => db.getCityHubs(), [db]);
  const masterRegions = useMemo(() => db.getMasterRegions(), [db]);
  const leads = useMemo(() => db.getLeads(), [db]);
  const quotes = useMemo(() => db.getAllSavedQuotes(), [db]);
  const bookings = useMemo(() => db.getAllBookings(), [db]);
  const users = useMemo(() => db.getUsers(), [db]);
  const promotions = useMemo(() => db.getPromotions(), [db]);
  const blogs = useMemo(() => db.getBlogs(), [db]);
  const reviews = useMemo(() => db.getReviews(), [db]);
  const tasks = useMemo(() => db.getCalendarTasks(), [db]);
  const auditLogs = useMemo(() => db.getAuditLogs().slice(0, 6), [db]);

  // 1. KEY BUSINESS METRICS (6 Core KPI Cards)
  const kpiMetrics = useMemo(() => {
    const activeLeads = leads.filter(l => l.status === 'NEW' || l.status === 'OPEN' || l.status === 'IN_PROGRESS').length;
    const newLeadsCount = leads.filter(l => l.status === 'NEW').length;

    const activeQuotes = quotes.filter(q => q.status === 'DRAFT' || q.status === 'SAVED' || q.status === 'DOWNLOADED_PDF').length;
    const pdfDownloadedQuotes = quotes.filter(q => q.status === 'DOWNLOADED_PDF').length;

    const pendingBookings = bookings.filter(b => b.status === 'PENDING_CONFIRMATION' || b.status === 'PROCESSING').length;
    const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED').length;

    const activeProducts = products.filter(p => p.status === 'ACTIVE').length;
    const activeHotels = hotels.filter(h => h.status === 'ACTIVE').length;
    const contractedRooms = hotels.reduce((acc, h) => acc + (h.rooms?.length || 0), 0);

    return [
      {
        id: 'kpi-leads',
        label: 'Active Leads',
        value: activeLeads,
        subtext: newLeadsCount > 0 ? `${newLeadsCount} new this week` : 'Pipeline active',
        alert: newLeadsCount > 0,
        section: 'LEAD_MANAGEMENT',
        subTab: 'LEADS'
      },
      {
        id: 'kpi-quotes',
        label: 'Active Quotes',
        value: activeQuotes,
        subtext: pdfDownloadedQuotes > 0 ? `${pdfDownloadedQuotes} proposals exported` : 'B2B proposals ready',
        alert: false,
        section: 'BOOKING_MANAGEMENT',
        subTab: 'QUOTES'
      },
      {
        id: 'kpi-pending-bookings',
        label: 'Pending Bookings',
        value: pendingBookings,
        subtext: pendingBookings > 0 ? '12h Confirmation SLA' : 'All dispatched',
        alert: pendingBookings > 0,
        section: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS'
      },
      {
        id: 'kpi-confirmed-bookings',
        label: 'Confirmed Bookings',
        value: confirmedBookings,
        subtext: 'Guaranteed ground ops',
        alert: false,
        section: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS'
      },
      {
        id: 'kpi-products',
        label: 'Active Products',
        value: activeProducts,
        subtext: `${products.length} total SKUs across hubs`,
        alert: false,
        section: 'PRODUCT_MANAGEMENT',
        subTab: 'PRODUCTS'
      },
      {
        id: 'kpi-hotels',
        label: 'Active Hotels',
        value: activeHotels,
        subtext: `${contractedRooms} contracted room tiers`,
        alert: false,
        section: 'HOTEL_MANAGEMENT',
        subTab: 'HOTELS'
      }
    ];
  }, [leads, quotes, bookings, products, hotels]);

  // 2. NEEDS ATTENTION: Prioritized Actionable Queue
  const attentionItems = useMemo(() => {
    const items: {
      id: string;
      count: number;
      title: string;
      description: string;
      priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
      actionLabel: string;
      section: string;
      subTab?: string;
    }[] = [];

    const newLeads = leads.filter(l => l.status === 'NEW').length;
    if (newLeads > 0) {
      items.push({
        id: 'att-new-leads',
        count: newLeads,
        title: `${newLeads} New Inquir${newLeads === 1 ? 'y' : 'ies'} Awaiting Qualification`,
        description: 'New B2B agent and direct traveler leads ready for sales assignment.',
        priority: 'CRITICAL',
        actionLabel: 'Qualify Leads',
        section: 'LEAD_MANAGEMENT',
        subTab: 'LEADS'
      });
    }

    const pendingBookings = bookings.filter(b => b.status === 'PENDING_CONFIRMATION').length;
    if (pendingBookings > 0) {
      items.push({
        id: 'att-pending-bookings',
        count: pendingBookings,
        title: `${pendingBookings} Booking${pendingBookings === 1 ? '' : 's'} Awaiting 12-Hour Confirmation`,
        description: 'Instant bookings submitted requiring local chauffeur, vehicle and guide allocation.',
        priority: 'CRITICAL',
        actionLabel: 'Confirm Bookings',
        section: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS'
      });
    }

    const pendingProofs = bookings.filter(b => 
      b.paymentProofs?.some(p => p.verifiedStatus === 'PENDING_VERIFICATION')
    ).length;
    if (pendingProofs > 0) {
      items.push({
        id: 'att-payment-proofs',
        count: pendingProofs,
        title: `${pendingProofs} Payment Proof${pendingProofs === 1 ? '' : 's'} Awaiting Verification`,
        description: 'Bank transfer receipts and remittance slips uploaded for financial clearance.',
        priority: 'HIGH',
        actionLabel: 'Verify Payments',
        section: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS'
      });
    }

    const downloadedQuotes = quotes.filter(q => q.status === 'DOWNLOADED_PDF').length;
    if (downloadedQuotes > 0) {
      items.push({
        id: 'att-quote-followup',
        count: downloadedQuotes,
        title: `${downloadedQuotes} PDF Quote${downloadedQuotes === 1 ? '' : 's'} Ready for 24h Follow-Up`,
        description: 'Custom luxury itineraries exported by clients ready for concierge outreach.',
        priority: 'NORMAL',
        actionLabel: 'View Quotes',
        section: 'BOOKING_MANAGEMENT',
        subTab: 'QUOTES'
      });
    }

    const pendingUsers = users.filter(u => u.approvalStatus === 'PENDING').length;
    if (pendingUsers > 0) {
      items.push({
        id: 'att-user-approvals',
        count: pendingUsers,
        title: `${pendingUsers} B2B Partner Account Registration${pendingUsers === 1 ? '' : 's'}`,
        description: 'Travel agent documentation and wholesale margin tier configuration.',
        priority: 'NORMAL',
        actionLabel: 'Review Accounts',
        section: 'ACCOUNT_MANAGEMENT',
        subTab: 'USERS_ACCESS'
      });
    }

    const pendingTasks = tasks.filter(t => t.status === 'PENDING' && (t.priority === 'URGENT' || t.priority === 'HIGH')).length;
    if (pendingTasks > 0) {
      items.push({
        id: 'att-sla-tasks',
        count: pendingTasks,
        title: `${pendingTasks} Priority Ground SLA Task${pendingTasks === 1 ? '' : 's'} Due`,
        description: 'Hotel voucher dispatches, driver assignments, and airport greeter schedules.',
        priority: 'HIGH',
        actionLabel: 'View SLA Tasks',
        section: 'NOTIFICATIONS_MANAGEMENT',
        subTab: 'TASKS'
      });
    }

    return items;
  }, [leads, bookings, quotes, users, tasks]);

  // 3. OPERATIONS TODAY SNAPSHOT
  const operationsSnapshot = useMemo(() => {
    const bookingsToProcess = bookings.filter(b => b.status === 'PENDING_CONFIRMATION' || b.status === 'PROCESSING').length;
    const urgentTasks = tasks.filter(t => t.status === 'PENDING').length;
    const paymentChecks = bookings.filter(b => b.paymentStatus === 'PARTIALLY_PAID' || b.paymentStatus === 'UNPAID').length;
    const activePromotions = promotions.filter(p => p.isActive).length;

    return [
      {
        label: 'Bookings to Process',
        value: bookingsToProcess,
        note: 'Ground dispatch queue',
        section: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS',
        actionText: 'Process Bookings →'
      },
      {
        label: 'Ground SLA Tasks',
        value: urgentTasks,
        note: 'Duty schedule checkpoints',
        section: 'NOTIFICATIONS_MANAGEMENT',
        subTab: 'TASKS',
        actionText: 'View Tasks →'
      },
      {
        label: 'Payment Follow-Ups',
        value: paymentChecks,
        note: 'Balances & wire remittances',
        section: 'ANALYTICS_MANAGEMENT',
        subTab: 'FINANCIALS',
        actionText: 'View Financials →'
      },
      {
        label: 'Active Market Deals',
        value: activePromotions,
        note: 'Seasonal & early bird promos',
        section: 'MARKETING_MANAGEMENT',
        subTab: 'PROMOTIONS',
        actionText: 'View Promotions →'
      }
    ];
  }, [bookings, tasks, promotions]);

  // 4. CURATED TOP 6 QUICK ACTIONS
  const primaryQuickActions = [
    { label: 'Create Quote', icon: Receipt, section: 'BOOKING_MANAGEMENT', subTab: 'QUOTES' },
    { label: 'Add Product', icon: Package, section: 'PRODUCT_MANAGEMENT', subTab: 'PRODUCTS' },
    { label: 'Add Hotel', icon: HotelIcon, section: 'HOTEL_MANAGEMENT', subTab: 'HOTELS' },
    { label: 'Add Lead', icon: Users, section: 'LEAD_MANAGEMENT', subTab: 'LEADS' },
    { label: 'Create Promotion', icon: Megaphone, section: 'MARKETING_MANAGEMENT', subTab: 'PROMOTIONS' },
    { label: 'Add Blog Article', icon: LayoutTemplate, section: 'PAGE_MANAGEMENT', subTab: 'BLOGS' }
  ];

  // Secondary actions inside modal
  const secondaryQuickActions = [
    { label: 'Google Sheets Live Sync', icon: FileSpreadsheet, section: 'PRODUCT_MANAGEMENT', subTab: 'SHEETS_SYNC', category: 'Operations' },
    { label: 'Add Master Region', icon: Globe2, section: 'DESTINATION_MANAGEMENT', subTab: 'REGIONS', category: 'Content' },
    { label: 'Add Destination Country', icon: Compass, section: 'DESTINATION_MANAGEMENT', subTab: 'DESTINATIONS', category: 'Content' },
    { label: 'Add City Hub', icon: Layers, section: 'DESTINATION_MANAGEMENT', subTab: 'CITIES', category: 'Content' },
    { label: 'Add Visa Product', icon: FileText, section: 'PRODUCT_MANAGEMENT', subTab: 'VISAS', category: 'Operations' },
    { label: 'Edit Homepage & Hero', icon: LayoutTemplate, section: 'PAGE_MANAGEMENT', subTab: 'HOMEPAGE', category: 'Content' },
    { label: 'Manage Customer Gallery', icon: Sparkles, section: 'PAGE_MANAGEMENT', subTab: 'GALLERY', category: 'Content' },
    { label: 'Google Business Reviews', icon: CheckCircle2, section: 'PAGE_MANAGEMENT', subTab: 'REVIEWS', category: 'Content' },
    { label: 'Staff Roster & Allocation', icon: Users, section: 'ACCOUNT_MANAGEMENT', subTab: 'ROSTER', category: 'Admin' },
    { label: 'User Access & Margin Tiers', icon: UserCheck, section: 'ACCOUNT_MANAGEMENT', subTab: 'USERS_ACCESS', category: 'Admin' },
    { label: 'Email Campaigns & Broadcasts', icon: Mail, section: 'MARKETING_MANAGEMENT', subTab: 'CAMPAIGNS', category: 'Marketing' },
    { label: 'Financial Audit & Invoicing', icon: BarChart3, section: 'ANALYTICS_MANAGEMENT', subTab: 'FINANCIALS', category: 'Finance' },
    { label: 'Firestore Live Diagnostics', icon: Database, section: 'DATABASE_MANAGEMENT', subTab: 'FIRESTORE_DIAGNOSTICS', category: 'System' },
    { label: 'Complete Security Audit Trail', icon: ShieldCheck, section: 'DATABASE_MANAGEMENT', subTab: 'AUDIT_TRAIL', category: 'System' }
  ];

  // 5. SYSTEM HEALTH INDICATORS
  const systemHealth = [
    { name: 'Firebase Firestore', status: 'Connected', section: 'DATABASE_MANAGEMENT', subTab: 'FIRESTORE_DIAGNOSTICS' },
    { name: 'Google Sheets', status: 'Connected', section: 'PRODUCT_MANAGEMENT', subTab: 'SHEETS_SYNC' },
    { name: 'Gmail Gateway', status: 'Connected', section: 'DATABASE_MANAGEMENT', subTab: 'AUDIT_TRAIL' },
    { name: 'Google Calendar', status: 'Connected', section: 'NOTIFICATIONS_MANAGEMENT', subTab: 'TASKS' },
    { name: 'Google Business', status: 'Connected', section: 'PAGE_MANAGEMENT', subTab: 'REVIEWS' },
    { name: 'PDF Generation', status: 'Operational', section: 'BOOKING_MANAGEMENT', subTab: 'QUOTES' }
  ];

  // Format relative timestamp helper
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const now = new Date().getTime();
      const time = new Date(isoString).getTime();
      const diffMinutes = Math.floor((now - time) / (1000 * 60));
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div id="cms-dashboard-home" className="max-w-6xl mx-auto space-y-10 sm:space-y-12 pb-12 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* LEVEL 1: DASHBOARD HEADER */}
      {/* ========================================================================= */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2 border-b border-slate-200/80 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#008972]">
              TheUnbound Command Center
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">
              Japan • Europe • UK Ground Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {getGreeting()}, {currentUser?.name ? currentUser.name.split(' ')[0] : 'Marcus'}
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Here's an overview of your business operations and the key items requiring attention today.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-full flex items-center space-x-2 text-xs text-emerald-800 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Firestore Live</span>
          </div>
          <div className="px-3.5 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-600 font-semibold flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* LEVEL 2: KEY BUSINESS METRICS (6 Spacious Cards) */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Key Business Metrics
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Live database counts
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiMetrics.map(kpi => (
            <button
              key={kpi.id}
              onClick={() => onNavigate(kpi.section, kpi.subTab)}
              className={`p-5 rounded-2xl border text-left transition-all group flex flex-col justify-between cursor-pointer hover:shadow-sm ${
                kpi.alert
                  ? 'bg-amber-50/40 border-amber-200/90 hover:border-amber-400'
                  : 'bg-white border-slate-200/90 hover:border-[#008972]/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 transition-colors">
                  {kpi.label}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#008972] group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-1 truncate">
                  {kpi.subtext}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* LEVEL 3: NEEDS ATTENTION (Clean, Spacious List) */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Needs Attention
              </h2>
              {attentionItems.length > 0 && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {attentionItems.length} Urgent Item{attentionItems.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Prioritized actions required to fulfill ground SLAs and maintain response times.
            </p>
          </div>

          <span className="text-xs text-slate-400 font-medium self-start sm:self-auto">
            Updated just now
          </span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">All caught up!</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no pending booking confirmations, unverified payments, or overdue SLA ground tasks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {attentionItems.map(item => (
              <div
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start space-x-4 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 mt-0.5 ${
                    item.priority === 'CRITICAL'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : item.priority === 'HIGH'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {item.count}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#008972] transition-colors">
                        {item.title}
                      </h4>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        item.priority === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : item.priority === 'HIGH'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate(item.section, item.subTab)}
                  className="px-4 py-2 bg-slate-50 hover:bg-[#008972] text-slate-700 hover:text-white border border-slate-200 hover:border-[#008972] rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 self-end sm:self-center cursor-pointer shadow-2xs"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* LEVEL 4: OPERATIONS TODAY & QUICK ACTIONS (2 Clean Panels) */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Operations Today (7 Cols on lg) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Operations Today
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Active ground reservations, dispatch rosters & financial pipeline.
              </p>
            </div>
            <CalendarIcon className="w-4 h-4 text-slate-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {operationsSnapshot.map((op, idx) => (
              <button
                key={idx}
                onClick={() => onNavigate(op.section, op.subTab)}
                className="p-4 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 hover:border-[#008972]/50 text-left transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-slate-500">
                    {op.label}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                    {op.value}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {op.note}
                  </div>
                </div>

                <div className="text-xs font-bold text-[#008972] mt-3 flex items-center space-x-1 group-hover:translate-x-0.5 transition-transform">
                  <span>{op.actionText}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions (5 Cols on lg) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Quick Actions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Frequently used creation shortcuts.
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-[#008972]" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {primaryQuickActions.map((qa, i) => {
              const Icon = qa.icon;
              return (
                <button
                  key={i}
                  onClick={() => onNavigate(qa.section, qa.subTab)}
                  className="p-3 bg-slate-50/80 hover:bg-[#008972]/10 hover:text-[#008972] border border-slate-200/80 hover:border-[#008972]/40 rounded-xl text-left text-xs font-bold text-slate-700 transition-all flex items-center space-x-2 cursor-pointer group"
                >
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-[#008972] shrink-0" />
                  <span className="truncate">{qa.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowAllActionsModal(true)}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>View All Quick Actions ({secondaryQuickActions.length + primaryQuickActions.length})</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* LEVEL 5: RECENT ACTIVITY TIMELINE */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Recent Activity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live operational event log across tariffs, quotes, bookings, and team updates.
            </p>
          </div>

          <button
            onClick={() => onNavigate('DATABASE_MANAGEMENT', 'AUDIT_TRAIL')}
            className="text-xs font-bold text-[#008972] hover:text-[#00705d] flex items-center space-x-1 self-start sm:self-center transition-colors cursor-pointer"
          >
            <span>View Full Audit Log</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3.5">
          {auditLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No recent activity recorded yet.
            </div>
          ) : (
            auditLogs.map((log, idx) => (
              <div
                key={log.id || idx}
                className="flex items-start sm:items-center justify-between gap-3 text-xs py-1.5"
              >
                <div className="flex items-start sm:items-center space-x-3 min-w-0">
                  <span className="text-[11px] font-mono text-slate-400 shrink-0 w-16 text-right">
                    {getRelativeTime(log.timestamp)}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mt-1.5 sm:mt-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 mr-1.5">{log.userName}</span>
                    <span className="text-slate-600">{log.details}</span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase shrink-0 hidden md:inline-block">
                  {log.actionType || 'UPDATE'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* LEVEL 6: SYSTEM HEALTH (Quiet, Low Profile) */}
      {/* ========================================================================= */}
      <section className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              System Health & Connected Services
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 pt-1">
            {systemHealth.map((sh, idx) => (
              <div key={idx} className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-slate-500">{sh.name}:</span>
                <span className="font-semibold text-slate-800">{sh.status}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => onNavigate('DATABASE_MANAGEMENT', 'FIRESTORE_DIAGNOSTICS')}
          className="text-xs font-bold text-[#008972] hover:text-[#00705d] flex items-center space-x-1 shrink-0 self-start md:self-center transition-colors cursor-pointer"
        >
          <span>View Integrations</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </section>

      {/* ========================================================================= */}
      {/* MODAL: ALL QUICK ACTIONS */}
      {/* ========================================================================= */}
      {showAllActionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#008972]/10 text-[#008972] flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">All CMS Actions & Shortcuts</h3>
                  <p className="text-[11px] text-slate-500">1-click jump to any administrative workflow</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllActionsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Primary Actions */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                  Core Management Shortcuts
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {primaryQuickActions.map((qa, i) => {
                    const Icon = qa.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setShowAllActionsModal(false);
                          onNavigate(qa.section, qa.subTab);
                        }}
                        className="p-3 bg-slate-50 hover:bg-[#008972]/10 hover:text-[#008972] border border-slate-200 hover:border-[#008972]/40 rounded-xl text-left text-xs font-bold text-slate-800 transition-all flex items-center space-x-2.5 cursor-pointer group"
                      >
                        <Icon className="w-4 h-4 text-slate-500 group-hover:text-[#008972] shrink-0" />
                        <span className="truncate">{qa.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secondary Actions */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                  Inventory, Content & System Tools
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {secondaryQuickActions.map((qa, i) => {
                    const Icon = qa.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setShowAllActionsModal(false);
                          onNavigate(qa.section, qa.subTab);
                        }}
                        className="p-3 bg-slate-50 hover:bg-[#008972]/10 hover:text-[#008972] border border-slate-200 hover:border-[#008972]/40 rounded-xl text-left text-xs font-bold text-slate-800 transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Icon className="w-4 h-4 text-slate-500 group-hover:text-[#008972] shrink-0" />
                          <span className="truncate">{qa.label}</span>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 shrink-0">
                          {qa.category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowAllActionsModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

