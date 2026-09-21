import React, { useState, useMemo, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  User, 
  Quotation, 
  Booking, 
  TravelLead, 
  SystemUserJourneyEvent, 
  JourneyEventCategory,
  UserRole
} from '../../types';
import { canUserAccessSystemAnalysis } from '../../services/permissionEngine';
import { 
  Activity, 
  Users, 
  UserCheck, 
  Sparkles, 
  CalendarCheck, 
  FileText, 
  Receipt, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Clock, 
  ArrowRight, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  BarChart3, 
  ExternalLink, 
  ShieldCheck, 
  Eye, 
  Share2, 
  MessageSquare, 
  DollarSign, 
  Layers, 
  Globe, 
  Compass, 
  Star, 
  X, 
  ChevronDown, 
  SlidersHorizontal,
  Lock,
  Calendar,
  Building2,
  Mail,
  Phone,
  Tag,
  Info
} from 'lucide-react';

interface SystemAnalysisProps {
  onNavigate?: (section: string, subTab?: string, recordId?: string) => void;
  currentUser?: User | null;
  onLoadQuote?: (quote: Quotation) => void;
}

type TimeRangeFilter = 'TODAY' | '7D' | '30D' | '90D' | 'ALL';
type ActiveSubView = 'USERS_MATRIX' | 'USER_JOURNEY' | 'EVENT_STREAM' | 'FUNNEL_ANALYSIS';

export const SystemAnalysis: React.FC<SystemAnalysisProps> = ({
  onNavigate,
  currentUser,
  onLoadQuote
}) => {
  const db = AppDatabase.getInstance();
  const [dbTick, setDbTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // View state
  const [activeSubView, setActiveSubView] = useState<ActiveSubView>('USERS_MATRIX');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected user for 360° deep dive
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [journeyCategoryFilter, setJourneyCategoryFilter] = useState<string>('ALL');
  const [userProfileTab, setUserProfileTab] = useState<'TIMELINE' | 'QUOTES' | 'BOOKINGS' | 'TRANSACTIONS' | 'AI_PLANNER'>('TIMELINE');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Subscribe to real-time database changes
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setDbTick(t => t + 1);
    });
    return () => unsub();
  }, [db]);

  // Permission checks
  const canViewSystemAnalysis = useMemo(() => {
    return canUserAccessSystemAnalysis(currentUser, 'view');
  }, [currentUser]);

  const canExportReport = useMemo(() => {
    return canUserAccessSystemAnalysis(currentUser, 'export');
  }, [currentUser]);

  const canViewTransactions = useMemo(() => {
    return canUserAccessSystemAnalysis(currentUser, 'transactionAnalysis');
  }, [currentUser]);

  // Load production real data directly from database instance
  const rawUsers = useMemo(() => db.getUsers(), [db, dbTick]);
  const rawQuotes = useMemo(() => db.getAllSavedQuotes(), [db, dbTick]);
  const rawBookings = useMemo(() => db.getAllBookings(), [db, dbTick]);
  const rawLeads = useMemo(() => db.getLeads(), [db, dbTick]);
  const rawActivities = useMemo(() => db.getUserActivityEvents(), [db, dbTick]);

  // Handle manual data refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setDbTick(t => t + 1);
      setIsRefreshing(false);
    }, 450);
  };

  // Date filtering logic
  const dateThreshold = useMemo(() => {
    if (timeRange === 'ALL') return null;
    const now = new Date();
    if (timeRange === 'TODAY') {
      now.setHours(0, 0, 0, 0);
      return now;
    }
    if (timeRange === '7D') {
      now.setDate(now.getDate() - 7);
      return now;
    }
    if (timeRange === '30D') {
      now.setDate(now.getDate() - 30);
      return now;
    }
    if (timeRange === '90D') {
      now.setDate(now.getDate() - 90);
      return now;
    }
    return null;
  }, [timeRange]);

  // Filtered dataset according to time range
  const filteredQuotes = useMemo(() => {
    if (!dateThreshold) return rawQuotes;
    return rawQuotes.filter(q => {
      const d = new Date(q.createdAt || q.updatedAt || 0);
      return d >= dateThreshold;
    });
  }, [rawQuotes, dateThreshold]);

  const filteredBookings = useMemo(() => {
    if (!dateThreshold) return rawBookings;
    return rawBookings.filter(b => {
      const d = new Date(b.createdAt || b.updatedAt || 0);
      return d >= dateThreshold;
    });
  }, [rawBookings, dateThreshold]);

  const filteredActivities = useMemo(() => {
    if (!dateThreshold) return rawActivities;
    return rawActivities.filter(a => {
      const d = new Date(a.timestamp || 0);
      return d >= dateThreshold;
    });
  }, [rawActivities, dateThreshold]);

  // Aggregate user statistics & engagement tiers
  const userMetricsList = useMemo(() => {
    return rawUsers.map(user => {
      const userQuotes = rawQuotes.filter(q => 
        q.agentId === user.id || 
        q.createdBy === user.id || 
        q.clientUserId === user.id || 
        (user.email && (q.clientEmail?.toLowerCase() === user.email.toLowerCase() || q.agentEmail?.toLowerCase() === user.email.toLowerCase()))
      );

      const userBookings = rawBookings.filter(b => 
        b.userId === user.id || 
        b.agentId === user.id || 
        (user.email && b.customer?.email?.toLowerCase() === user.email.toLowerCase())
      );

      const userActivities = rawActivities.filter(a => a.userId === user.id);
      const userLeads = rawLeads.filter(l => l.userId === user.id || (user.email && l.email?.toLowerCase() === user.email.toLowerCase()));

      const pdfDownloads = userQuotes.filter(q => 
        q.status === 'DOWNLOADED_PDF' || 
        q.status === 'DOWNLOADED' ||
        q.activityLog?.some(a => a.action === 'DOWNLOADED' || a.action === 'PRINTED')
      ).length;

      const whatsappShares = userQuotes.filter(q => Boolean(q.lastSharedViaWhatsAppAt)).length;
      const confirmedBookings = userBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length;

      const totalBookingSpend = userBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
      const totalQuoteValue = userQuotes.reduce((sum, q) => sum + (Number(q.totalSellingPrice) || 0), 0);

      const aiInteractions = userActivities.filter(a => 
        a.type === 'AI_PLANNER_USED' || 
        a.type === 'CALCULATOR_USED' || 
        a.details?.isAiPlanner
      ).length + userQuotes.filter(q => q.items?.some(it => it.source === 'AI_PLANNER' || it.aiSuggested)).length;

      // Determine engagement tier based on real production milestones
      let engagementTier: 'SUPER_USER' | 'HIGH' | 'ACTIVE' | 'NEW' = 'NEW';
      const totalTouchpoints = userQuotes.length + userBookings.length + userActivities.length;

      if (userBookings.length >= 2 || userQuotes.length >= 4 || totalBookingSpend > 5000) {
        engagementTier = 'SUPER_USER';
      } else if (userBookings.length >= 1 || userQuotes.length >= 2 || userActivities.length >= 6) {
        engagementTier = 'HIGH';
      } else if (totalTouchpoints > 0) {
        engagementTier = 'ACTIVE';
      }

      // Latest activity calculation
      const timestamps = [
        user.createdAt,
        ...userQuotes.map(q => q.updatedAt || q.createdAt),
        ...userBookings.map(b => b.updatedAt || b.createdAt),
        ...userActivities.map(a => a.timestamp)
      ].filter(Boolean).map(t => new Date(t).getTime());

      const latestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : new Date(user.createdAt || 0).getTime();

      return {
        user,
        quotesCount: userQuotes.length,
        pdfDownloads,
        whatsappShares,
        bookingsCount: userBookings.length,
        confirmedBookings,
        totalBookingSpend,
        totalQuoteValue,
        aiInteractions,
        leadsCount: userLeads.length,
        activitiesCount: userActivities.length,
        engagementTier,
        latestActivityAt: new Date(latestTimestamp).toISOString(),
        quotes: userQuotes,
        bookings: userBookings,
        activities: userActivities
      };
    });
  }, [rawUsers, rawQuotes, rawBookings, rawActivities, rawLeads]);

  // Overall Executive KPI Cards (All from Real Data)
  const executiveKPIs = useMemo(() => {
    const totalUsers = rawUsers.length;
    const b2bAgents = rawUsers.filter(u => u.role === 'B2B_AGENT' || u.role === 'AGENT').length;
    const buyers = rawUsers.filter(u => u.role === 'BUYER').length;
    const staffAndAdmins = rawUsers.filter(u => u.role === 'ADMIN' || u.role === 'TEAM_MEMBER' || u.role === 'DMC_STAFF').length;

    // Active users in timeframe
    const activeUsersInTimeframe = userMetricsList.filter(m => {
      if (!dateThreshold) return m.activitiesCount > 0 || m.quotesCount > 0 || m.bookingsCount > 0;
      return new Date(m.latestActivityAt) >= dateThreshold;
    }).length;

    const superUsersCount = userMetricsList.filter(m => m.engagementTier === 'SUPER_USER').length;

    const totalQuotesCount = filteredQuotes.length;
    const pdfDownloadedQuotes = filteredQuotes.filter(q => 
      q.status === 'DOWNLOADED_PDF' || q.status === 'DOWNLOADED' ||
      q.activityLog?.some(a => a.action === 'DOWNLOADED' || a.action === 'PRINTED')
    ).length;
    const whatsappSharedQuotes = filteredQuotes.filter(q => Boolean(q.lastSharedViaWhatsAppAt)).length;

    const totalBookingsCount = filteredBookings.length;
    const confirmedBookingsCount = filteredBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length;

    const grossBookingValue = filteredBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

    const verifiedPaymentsSum = filteredBookings.reduce((sum, b) => {
      const verifiedProofs = (b.paymentProofs || []).filter(p => p.verificationStatus === 'VERIFIED');
      return sum + verifiedProofs.reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
    }, 0);

    const totalAiInteractions = userMetricsList.reduce((sum, m) => sum + m.aiInteractions, 0);

    // Conversion rate: Bookings / Quotes (or Bookings / Total Users)
    const quoteToBookingConversionRate = totalQuotesCount > 0 
      ? ((totalBookingsCount / totalQuotesCount) * 100).toFixed(1)
      : '0.0';

    return {
      totalUsers,
      b2bAgents,
      buyers,
      staffAndAdmins,
      activeUsersInTimeframe,
      superUsersCount,
      totalQuotesCount,
      pdfDownloadedQuotes,
      whatsappSharedQuotes,
      totalBookingsCount,
      confirmedBookingsCount,
      grossBookingValue,
      verifiedPaymentsSum,
      totalAiInteractions,
      quoteToBookingConversionRate
    };
  }, [rawUsers, userMetricsList, filteredQuotes, filteredBookings, dateThreshold]);

  // Filtered user table list
  const filteredUsersList = useMemo(() => {
    return userMetricsList.filter(item => {
      // Role filter
      if (selectedRoleFilter === 'B2B_AGENT' && (item.user.role !== 'B2B_AGENT' && item.user.role !== 'AGENT')) return false;
      if (selectedRoleFilter === 'BUYER' && item.user.role !== 'BUYER') return false;
      if (selectedRoleFilter === 'INTERNAL' && item.user.role !== 'ADMIN' && item.user.role !== 'TEAM_MEMBER' && item.user.role !== 'DMC_STAFF') return false;
      if (selectedRoleFilter === 'SUPER_USERS' && item.engagementTier !== 'SUPER_USER') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.user.name?.toLowerCase().includes(q);
        const matchesEmail = item.user.email?.toLowerCase().includes(q);
        const matchesAgency = (item.user.agencyName || item.user.companyName || '').toLowerCase().includes(q);
        const matchesId = item.user.id.toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesAgency || matchesId;
      }
      return true;
    });
  }, [userMetricsList, selectedRoleFilter, searchQuery]);

  // Currently inspected user object and complete chronological journey
  const selectedUserObject = useMemo(() => {
    if (!selectedUserId) return null;
    return userMetricsList.find(m => m.user.id === selectedUserId) || null;
  }, [selectedUserId, userMetricsList]);

  const selectedUserJourneyEvents = useMemo(() => {
    if (!selectedUserId) return [];
    return db.getUserCompleteJourney(selectedUserId);
  }, [db, selectedUserId, dbTick]);

  const filteredUserJourneyEvents = useMemo(() => {
    if (journeyCategoryFilter === 'ALL') return selectedUserJourneyEvents;
    return selectedUserJourneyEvents.filter(ev => ev.category === journeyCategoryFilter);
  }, [selectedUserJourneyEvents, journeyCategoryFilter]);

  // System-wide live event feed
  const systemWideEvents = useMemo(() => {
    return db.getAllSystemJourneyEvents(120);
  }, [db, dbTick]);

  const filteredSystemWideEvents = useMemo(() => {
    let list = systemWideEvents;
    if (journeyCategoryFilter !== 'ALL') {
      list = list.filter(ev => ev.category === journeyCategoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(ev => 
        ev.title.toLowerCase().includes(q) || 
        ev.description.toLowerCase().includes(q) || 
        ev.userEmail.toLowerCase().includes(q) ||
        (ev.userName && ev.userName.toLowerCase().includes(q)) ||
        (ev.entityId && ev.entityId.toLowerCase().includes(q))
      );
    }
    return list;
  }, [systemWideEvents, journeyCategoryFilter, searchQuery]);

  // Export intelligence report handler
  const handleExportReport = () => {
    if (!canExportReport) {
      alert('Permission Denied: You do not have permission to export System Analysis intelligence reports.');
      return;
    }

    try {
      const headers = [
        'User ID',
        'Name',
        'Email',
        'Agency/Company',
        'Role',
        'Approval Status',
        'Engagement Tier',
        'Total Quotes',
        'PDF Exports',
        'WhatsApp Shares',
        'Total Bookings',
        'Confirmed Bookings',
        'Total Booking Spend (USD)',
        'AI Interactions',
        'Registration Date',
        'Last Active Date'
      ];

      const rows = userMetricsList.map(m => [
        `"${m.user.id}"`,
        `"${(m.user.name || '').replace(/"/g, '""')}"`,
        `"${m.user.email}"`,
        `"${(m.user.agencyName || m.user.companyName || 'Direct').replace(/"/g, '""')}"`,
        `"${m.user.role}"`,
        `"${m.user.approvalStatus || 'APPROVED'}"`,
        `"${m.engagementTier}"`,
        m.quotesCount,
        m.pdfDownloads,
        m.whatsappShares,
        m.bookingsCount,
        m.confirmedBookings,
        m.totalBookingSpend,
        m.aiInteractions,
        `"${m.user.createdAt || ''}"`,
        `"${m.latestActivityAt || ''}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `theunbound-system-analysis-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export system analysis report:', err);
      alert('Error generating export file.');
    }
  };

  // Helper for Category Styling & Icons
  const getCategoryMeta = (category: JourneyEventCategory) => {
    switch (category) {
      case 'QUOTE':
        return { label: 'Quote', icon: FileText, bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'BOOKING':
        return { label: 'Booking', icon: CalendarCheck, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'AI_PLANNER':
        return { label: 'AI Planner', icon: Sparkles, bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'TRANSACTION':
        return { label: 'Payment', icon: Receipt, bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'LEAD':
        return { label: 'CRM Lead', icon: Users, bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'PRODUCT':
        return { label: 'Product/Hotel', icon: Compass, bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'COMMUNICATION':
        return { label: 'Communication', icon: MessageSquare, bg: 'bg-pink-50 text-pink-700 border-pink-200' };
      case 'USER':
      default:
        return { label: 'Account', icon: UserCheck, bg: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  // Access check fallback
  if (!canViewSystemAnalysis) {
    return (
      <div id="system-analysis-access-denied" className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-12 space-y-4 shadow-sm">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Access Restricted</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          System Analysis is reserved exclusively for Administrators and authorized internal operations staff.
        </p>
        {onNavigate && (
          <button
            onClick={() => onNavigate('DASHBOARD')}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
          >
            Return to Dashboard
          </button>
        )}
      </div>
    );
  }

  return (
    <div id="system-analysis-hub" className="space-y-6 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE HEADER & CONTROLS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Live Status Indicator */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#008972] border border-[#00C6A6]/30 flex items-center justify-center shadow-xs">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    SYSTEM ANALYSIS
                  </h1>
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Production Firestore</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Central user-level analytics, real-time activity tracking &amp; 360° journey analysis
                </p>
              </div>
            </div>
          </div>

          {/* Action Tools: Timeframe, Refresh, Export */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Timeframe Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              {(['ALL', '30D', '7D', 'TODAY'] as TimeRangeFilter[]).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeRange(tf)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    timeRange === tf 
                      ? 'bg-white text-slate-900 shadow-xs font-black' 
                      : 'hover:text-slate-900'
                  }`}
                >
                  {tf === 'ALL' ? 'All Time' : tf === '30D' ? '30 Days' : tf === '7D' ? '7 Days' : 'Today'}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              id="system-analysis-refresh-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
              title="Refresh live Firestore data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#008972]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export Intelligence Report */}
            {canExportReport && (
              <button
                id="system-analysis-export-btn"
                onClick={handleExportReport}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#008972] hover:bg-[#007562] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Intelligence</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-t border-slate-100 pt-4 overflow-x-auto scrollbar-none">
          <button
            id="subview-tab-users-matrix"
            onClick={() => setActiveSubView('USERS_MATRIX')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubView === 'USERS_MATRIX'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Performance Directory ({rawUsers.length})</span>
          </button>

          <button
            id="subview-tab-user-journey"
            onClick={() => {
              setActiveSubView('USER_JOURNEY');
              if (!selectedUserId && rawUsers.length > 0) {
                // Pre-select most active user
                const topUser = [...userMetricsList].sort((a, b) => b.quotesCount - a.quotesCount)[0];
                setSelectedUserId(topUser?.user.id || rawUsers[0].id);
              }
            }}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubView === 'USER_JOURNEY'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>360° Complete User Journey</span>
            {selectedUserObject && (
              <span className="px-1.5 py-0.2 bg-teal-500/20 text-teal-400 text-[10px] rounded-md font-mono">
                {selectedUserObject.user.name}
              </span>
            )}
          </button>

          <button
            id="subview-tab-event-stream"
            onClick={() => setActiveSubView('EVENT_STREAM')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubView === 'EVENT_STREAM'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System Event Ledger ({systemWideEvents.length})</span>
          </button>

          <button
            id="subview-tab-funnel-analysis"
            onClick={() => setActiveSubView('FUNNEL_ANALYSIS')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubView === 'FUNNEL_ANALYSIS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>AI Planner &amp; Funnel Conversion</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REAL PRODUCTION EXECUTIVE KPI CARDS (Zero Fake Data) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        
        {/* KPI 1: Total Registered Users */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Users</span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {executiveKPIs.totalUsers}
          </div>
          <div className="flex items-center space-x-1 text-[10px] text-slate-500 truncate">
            <span className="font-bold text-slate-700">{executiveKPIs.b2bAgents}</span> B2B • 
            <span className="font-bold text-slate-700 ml-1">{executiveKPIs.buyers}</span> Buyers
          </div>
        </div>

        {/* KPI 2: Active Users */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Users</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {executiveKPIs.activeUsersInTimeframe}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {executiveKPIs.totalUsers > 0 
              ? `${Math.round((executiveKPIs.activeUsersInTimeframe / executiveKPIs.totalUsers) * 100)}% platform reach`
              : '0% reach'}
          </div>
        </div>

        {/* KPI 3: Super Users */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Super Users</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            {executiveKPIs.superUsersCount}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            High-volume agents &amp; bookers
          </div>
        </div>

        {/* KPI 4: Quotes Generated */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quotes Created</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {executiveKPIs.totalQuotesCount}
          </div>
          <div className="flex items-center space-x-1 text-[10px] text-slate-500 truncate">
            <span className="font-bold text-indigo-600">{executiveKPIs.pdfDownloadedQuotes}</span> PDF • 
            <span className="font-bold text-emerald-600 ml-1">{executiveKPIs.whatsappSharedQuotes}</span> WA
          </div>
        </div>

        {/* KPI 5: Bookings & Conversion */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bookings</span>
            <div className="w-6 h-6 rounded-lg bg-teal-50 text-[#008972] flex items-center justify-center">
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#008972]">
            {executiveKPIs.totalBookingsCount}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            <span className="font-bold text-emerald-600">{executiveKPIs.confirmedBookingsCount} Confirmed</span> ({executiveKPIs.quoteToBookingConversionRate}%)
          </div>
        </div>

        {/* KPI 6: Financial Gross Volume */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Booking Volume</span>
            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 truncate" title={`$${executiveKPIs.grossBookingValue.toLocaleString()}`}>
            ${Math.round(executiveKPIs.grossBookingValue).toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold truncate">
            ${Math.round(executiveKPIs.verifiedPaymentsSum).toLocaleString()} verified
          </div>
        </div>

        {/* KPI 7: AI Planner Interactions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AI Planner</span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600">
            {executiveKPIs.totalAiInteractions}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            Prompts &amp; generated plans
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. SUB-VIEW 1: USERS PERFORMANCE & ACTIVITY MATRIX */}
      {/* ========================================================================= */}
      {activeSubView === 'USERS_MATRIX' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
          
          {/* Table Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="user-search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search users by name, email, agency, or ID..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 transition-all text-slate-900"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              {[
                { id: 'ALL', label: `All Users (${userMetricsList.length})` },
                { id: 'SUPER_USERS', label: `Super Users (${userMetricsList.filter(m => m.engagementTier === 'SUPER_USER').length})` },
                { id: 'B2B_AGENT', label: `B2B Agents (${userMetricsList.filter(m => m.user.role === 'B2B_AGENT' || m.user.role === 'AGENT').length})` },
                { id: 'BUYER', label: `Buyers (${userMetricsList.filter(m => m.user.role === 'BUYER').length})` },
                { id: 'INTERNAL', label: 'Internal Staff' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedRoleFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedRoleFilter === f.id
                      ? 'bg-[#008972] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">User &amp; Organization</th>
                  <th className="py-3 px-3">Role &amp; Status</th>
                  <th className="py-3 px-3">Tier</th>
                  <th className="py-3 px-3 text-center">Quotes Created</th>
                  <th className="py-3 px-3 text-center">Bookings</th>
                  <th className="py-3 px-3 text-right">Total Volume</th>
                  <th className="py-3 px-3 text-center">AI Interactions</th>
                  <th className="py-3 px-3">Last Active</th>
                  <th className="py-3 px-4 text-right">360° Journey</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUsersList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-bold">No users match your criteria.</p>
                      <p className="text-[11px] text-slate-400">Try adjusting your filters or search query.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsersList.map(item => {
                    const isSelected = selectedUserId === item.user.id;
                    return (
                      <tr 
                        key={item.user.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        {/* User identity */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {item.user.name?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">
                                {item.user.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {item.user.email}
                              </div>
                              {item.user.agencyName && (
                                <div className="text-[10px] text-slate-400 flex items-center space-x-1 truncate mt-0.5">
                                  <Building2 className="w-3 h-3 shrink-0" />
                                  <span>{item.user.agencyName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role & status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.user.role === 'ADMIN'
                                ? 'bg-rose-100 text-rose-800'
                                : item.user.role === 'B2B_AGENT' || item.user.role === 'AGENT'
                                ? 'bg-blue-100 text-blue-800'
                                : item.user.role === 'BUYER'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {item.user.role}
                            </span>
                            <div>
                              <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                                item.user.approvalStatus === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {item.user.approvalStatus || 'APPROVED'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Tier */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {item.engagementTier === 'SUPER_USER' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-300">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>Super User</span>
                            </span>
                          ) : item.engagementTier === 'HIGH' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span>High Active</span>
                            </span>
                          ) : item.engagementTier === 'ACTIVE' ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-400">
                              <span>New / Dormant</span>
                            </span>
                          )}
                        </td>

                        {/* Quotes */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="font-bold text-slate-900">{item.quotesCount}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.pdfDownloads > 0 && <span className="text-indigo-600 font-bold">{item.pdfDownloads} PDF</span>}
                            {item.whatsappShares > 0 && <span className="text-emerald-600 font-bold ml-1">{item.whatsappShares} WA</span>}
                          </div>
                        </td>

                        {/* Bookings */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="font-bold text-slate-900">{item.bookingsCount}</div>
                          {item.confirmedBookings > 0 && (
                            <div className="text-[10px] text-emerald-600 font-bold">
                              {item.confirmedBookings} Confirmed
                            </div>
                          )}
                        </td>

                        {/* Spend Volume */}
                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                          {item.totalBookingSpend > 0 ? (
                            <span>${Math.round(item.totalBookingSpend).toLocaleString()}</span>
                          ) : item.totalQuoteValue > 0 ? (
                            <span className="text-slate-400" title="Quoted Value">(${Math.round(item.totalQuoteValue).toLocaleString()})</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* AI Interactions */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {item.aiInteractions > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[10px]">
                              <Sparkles className="w-3 h-3" />
                              <span>{item.aiInteractions}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Last active */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                          {item.latestActivityAt 
                            ? new Date(item.latestActivityAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : '—'}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            id={`inspect-journey-${item.user.id}`}
                            onClick={() => {
                              setSelectedUserId(item.user.id);
                              setActiveSubView('USER_JOURNEY');
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-900 hover:bg-[#008972] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            <span>Inspect 360°</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUB-VIEW 2: 360° COMPLETE USER JOURNEY DEEP DIVE */}
      {/* ========================================================================= */}
      {activeSubView === 'USER_JOURNEY' && (
        <div className="space-y-6">
          
          {/* User Selector Dropdown Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500">Active User Profile:</span>
              <select
                id="journey-user-selector"
                value={selectedUserId || ''}
                onChange={e => setSelectedUserId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 cursor-pointer"
              >
                {userMetricsList.map(m => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name} ({m.user.email}) • {m.user.role} {m.engagementTier === 'SUPER_USER' ? '★ Super User' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setActiveSubView('USERS_MATRIX')}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
            >
              <span>Back to Directory</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {selectedUserObject ? (
            <>
              {/* User 360° Hero Card */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                  
                  {/* Avatar & Contact info */}
                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                      {selectedUserObject.user.name?.charAt(0) || 'U'}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h2 className="text-xl font-black text-slate-900">
                          {selectedUserObject.user.name}
                        </h2>
                        {selectedUserObject.engagementTier === 'SUPER_USER' && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-300">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>Super User</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{selectedUserObject.user.email}</span>
                        </span>
                        {selectedUserObject.user.agencyName && (
                          <span className="flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-slate-700">{selectedUserObject.user.agencyName}</span>
                          </span>
                        )}
                        <span className="text-slate-400">•</span>
                        <span>Role: <strong className="text-slate-800">{selectedUserObject.user.role}</strong></span>
                        <span className="text-slate-400">•</span>
                        <span>User ID: <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-mono">{selectedUserObject.user.id}</code></span>
                      </div>
                    </div>
                  </div>

                  {/* High-level KPIs for this user */}
                  <div className="flex items-center space-x-3 self-stretch md:self-auto overflow-x-auto scrollbar-none">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center min-w-[90px]">
                      <div className="text-lg font-black text-slate-900">{selectedUserObject.quotesCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quotes</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center min-w-[90px]">
                      <div className="text-lg font-black text-[#008972]">{selectedUserObject.bookingsCount}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bookings</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center min-w-[100px]">
                      <div className="text-lg font-black text-slate-900">
                        ${Math.round(selectedUserObject.totalBookingSpend).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lifetime Spend</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center min-w-[90px]">
                      <div className="text-lg font-black text-purple-600">{selectedUserObject.aiInteractions}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Sessions</div>
                    </div>
                  </div>
                </div>

                {/* Profile Tabs */}
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 overflow-x-auto scrollbar-none">
                  {[
                    { id: 'TIMELINE', label: `Complete Timeline (${selectedUserJourneyEvents.length} Events)`, icon: Clock },
                    { id: 'QUOTES', label: `Quotes Created (${selectedUserObject.quotesCount})`, icon: FileText },
                    { id: 'BOOKINGS', label: `Bookings Pipeline (${selectedUserObject.bookingsCount})`, icon: CalendarCheck },
                    { id: 'TRANSACTIONS', label: 'Payment & Remittance', icon: Receipt },
                    { id: 'AI_PLANNER', label: `AI Planner Sessions (${selectedUserObject.aiInteractions})`, icon: Sparkles }
                  ].map(tab => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        id={`profile-tab-${tab.id}`}
                        onClick={() => setUserProfileTab(tab.id as any)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          userProfileTab === tab.id
                            ? 'bg-[#008972] text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        <TabIcon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: Complete Chronological Journey Timeline */}
                {userProfileTab === 'TIMELINE' && (
                  <div className="space-y-4">
                    {/* Category Filter Pills */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-1">
                        {[
                          { id: 'ALL', label: 'All Events' },
                          { id: 'QUOTE', label: 'Quotes' },
                          { id: 'BOOKING', label: 'Bookings' },
                          { id: 'AI_PLANNER', label: 'AI Planner' },
                          { id: 'TRANSACTION', label: 'Payments' },
                          { id: 'COMMUNICATION', label: 'WhatsApp / Shares' },
                          { id: 'USER', label: 'Account' }
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setJourneyCategoryFilter(f.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                              journeyCategoryFilter === f.id
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <span className="text-[11px] text-slate-400 font-medium shrink-0">
                        {filteredUserJourneyEvents.length} events logged
                      </span>
                    </div>

                    {/* Chronological Vertical Timeline */}
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                      {filteredUserJourneyEvents.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="font-bold">No journey events recorded in this category.</p>
                        </div>
                      ) : (
                        filteredUserJourneyEvents.map((event, idx) => {
                          const meta = getCategoryMeta(event.category);
                          const IconComp = meta.icon;
                          const isExpanded = expandedEventId === event.id;

                          return (
                            <div key={event.id || idx} className="relative group">
                              {/* Timeline dot */}
                              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center group-hover:border-[#008972] transition-colors shadow-xs">
                                <div className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-[#008972]"></div>
                              </div>

                              {/* Event Card */}
                              <div className="bg-slate-50/70 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200 transition-all space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                  <div className="flex items-center space-x-2">
                                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.bg}`}>
                                      <IconComp className="w-3 h-3" />
                                      <span>{meta.label}</span>
                                    </span>
                                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                                      {event.title}
                                    </h4>
                                  </div>

                                  <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>
                                      {new Date(event.timestamp).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {event.description}
                                </p>

                                {/* Metadata and quick actions */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                                  <div className="flex items-center space-x-2">
                                    {event.entityId && (
                                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">
                                        ID: {event.entityId}
                                      </span>
                                    )}
                                    {event.metadata && (
                                      <button
                                        onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
                                      >
                                        <Info className="w-3 h-3" />
                                        <span>{isExpanded ? 'Hide Payload' : 'Inspect Payload'}</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Deep-link action if quote */}
                                  {event.category === 'QUOTE' && event.entityId && onLoadQuote && (
                                    <button
                                      onClick={() => {
                                        const q = rawQuotes.find(quote => quote.id === event.entityId);
                                        if (q) onLoadQuote(q);
                                      }}
                                      className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#008972] hover:underline cursor-pointer"
                                    >
                                      <span>Open Quote in Builder</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {/* Expanded Payload Snapshot */}
                                {isExpanded && event.metadata && (
                                  <div className="p-3 bg-slate-900 rounded-xl text-slate-200 text-[10px] font-mono overflow-x-auto space-y-1">
                                    <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Event Metadata Payload:</div>
                                    <pre className="whitespace-pre-wrap">
                                      {JSON.stringify(event.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: User's Quotations */}
                {userProfileTab === 'QUOTES' && (
                  <div className="space-y-4">
                    {selectedUserObject.quotes.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-bold">No quotes generated by this user yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Quote #</th>
                              <th className="py-3 px-3">Destination</th>
                              <th className="py-3 px-3">Travel Dates &amp; Pax</th>
                              <th className="py-3 px-3 text-right">Selling Price</th>
                              <th className="py-3 px-3">Status</th>
                              <th className="py-3 px-3">Created</th>
                              <th className="py-3 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedUserObject.quotes.map(q => (
                              <tr key={q.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4 font-bold text-slate-900">
                                  #{q.quoteNumber || q.id}
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-700">
                                  {q.destination}
                                </td>
                                <td className="py-3 px-3 text-slate-500">
                                  {q.totalPax || 2} Pax • {q.travelStartDate || 'Flexible'}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                  {q.currency || 'USD'} {Number(q.totalSellingPrice || 0).toLocaleString()}
                                </td>
                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                    {q.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-slate-500 text-[11px]">
                                  {new Date(q.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {onLoadQuote && (
                                    <button
                                      onClick={() => onLoadQuote(q)}
                                      className="px-2.5 py-1 bg-slate-900 hover:bg-[#008972] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                                    >
                                      Load
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: User's Bookings */}
                {userProfileTab === 'BOOKINGS' && (
                  <div className="space-y-4">
                    {selectedUserObject.bookings.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-bold">No ground bookings submitted by this user yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Booking Ref</th>
                              <th className="py-3 px-3">Lead Passenger</th>
                              <th className="py-3 px-3">Destination</th>
                              <th className="py-3 px-3 text-right">Total Amount</th>
                              <th className="py-3 px-3">Status</th>
                              <th className="py-3 px-3">Payment</th>
                              <th className="py-3 px-4 text-right">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedUserObject.bookings.map(b => (
                              <tr key={b.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                                  {b.bookingReference || b.id}
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-800">
                                  {b.customer?.leadTravelerName || 'Lead Traveler'}
                                </td>
                                <td className="py-3 px-3 text-slate-600">
                                  {b.destinationName || b.destination}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                  {b.currency || 'USD'} {Number(b.totalAmount || 0).toLocaleString()}
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    b.status === 'CONFIRMED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {b.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                                    {b.paymentStatus || 'PENDING'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right text-slate-500 text-[11px]">
                                  {new Date(b.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: Transactions & Payment Proofs */}
                {userProfileTab === 'TRANSACTIONS' && (
                  <div className="space-y-4">
                    {!canViewTransactions ? (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
                        <Lock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                        <p className="text-xs font-bold text-slate-600">Financial Clearance Required</p>
                        <p className="text-[11px] text-slate-400">Detailed transaction audits are restricted to Admin and Finance users.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedUserObject.bookings.every(b => !b.paymentProofs || b.paymentProofs.length === 0) ? (
                          <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="font-bold">No payment slips or bank transfer receipts uploaded for this user.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                  <th className="py-3 px-4">Booking Ref</th>
                                  <th className="py-3 px-3">Tranche</th>
                                  <th className="py-3 px-3 text-right">Amount</th>
                                  <th className="py-3 px-3">Verification Status</th>
                                  <th className="py-3 px-3">Verified By</th>
                                  <th className="py-3 px-4 text-right">Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {selectedUserObject.bookings.flatMap(b => 
                                  (b.paymentProofs || []).map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                      <td className="py-3 px-4 font-bold font-mono text-slate-900">
                                        {b.bookingReference}
                                      </td>
                                      <td className="py-3 px-3 text-slate-700">
                                        {p.trancheLabel || 'Tranche'}
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                        {p.currency || 'USD'} {Number(p.amount || 0).toLocaleString()}
                                      </td>
                                      <td className="py-3 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          p.verificationStatus === 'VERIFIED'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {p.verificationStatus}
                                        </span>
                                      </td>
                                      <td className="py-3 px-3 text-slate-500">
                                        {p.verifiedByName || 'Ops Team'}
                                      </td>
                                      <td className="py-3 px-4 text-right text-slate-500 text-[11px]">
                                        {p.verifiedAt ? new Date(p.verifiedAt).toLocaleDateString() : '—'}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5: AI Planner Sessions */}
                {userProfileTab === 'AI_PLANNER' && (
                  <div className="space-y-4">
                    {selectedUserJourneyEvents.filter(e => e.category === 'AI_PLANNER').length === 0 ? (
                      <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-400" />
                        <p className="font-bold">No AI Planner sessions logged for this user.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedUserJourneyEvents.filter(e => e.category === 'AI_PLANNER').map(aiEvent => (
                          <div key={aiEvent.id} className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                <h5 className="font-bold text-xs text-purple-950">{aiEvent.title}</h5>
                              </div>
                              <p className="text-xs text-slate-600">{aiEvent.description}</p>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono shrink-0">
                              {new Date(aiEvent.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-bold text-slate-700">Please select a user to inspect their 360° complete journey.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUB-VIEW 3: SYSTEM-WIDE EVENT LEDGER (Live Unified Event Feed) */}
      {/* ========================================================================= */}
      {activeSubView === 'EVENT_STREAM' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search event ledger by title, action, user email, or ID..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00C6A6]/30 text-slate-900"
              />
            </div>

            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              {[
                { id: 'ALL', label: 'All Categories' },
                { id: 'QUOTE', label: 'Quotes' },
                { id: 'BOOKING', label: 'Bookings' },
                { id: 'AI_PLANNER', label: 'AI Planner' },
                { id: 'TRANSACTION', label: 'Payments' },
                { id: 'LEAD', label: 'CRM Leads' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setJourneyCategoryFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    journeyCategoryFilter === f.id
                      ? 'bg-[#008972] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Event Stream List */}
          <div className="space-y-3">
            {filteredSystemWideEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-bold">No system events found.</p>
              </div>
            ) : (
              filteredSystemWideEvents.map(event => {
                const meta = getCategoryMeta(event.category);
                const IconComp = meta.icon;

                return (
                  <div
                    key={event.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                            {event.title}
                          </h4>
                          <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${meta.bg}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {event.description}
                        </p>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700">{event.userName || 'User'}</span>
                          <span>({event.userEmail})</span>
                          {event.entityId && (
                            <>
                              <span className="text-slate-300">•</span>
                              <code className="text-[10px] font-mono bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                {event.entityId}
                              </code>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
                      <div className="text-right text-[11px] text-slate-400 font-mono">
                        {new Date(event.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedUserId(event.userId);
                          setActiveSubView('USER_JOURNEY');
                        }}
                        className="p-2 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
                        title="View User 360° Profile"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SUB-VIEW 4: AI PLANNER & CONVERSION FUNNEL ANALYTICS */}
      {/* ========================================================================= */}
      {activeSubView === 'FUNNEL_ANALYSIS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900">
              End-to-End User Conversion Funnel
            </h3>
            <p className="text-xs text-slate-500">
              Real conversion progression from user registration through AI Planner engagement, quote generation, and confirmed booking.
            </p>
          </div>

          {/* Funnel Steps */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 pt-2">
            
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 relative">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 1: Registered</div>
              <div className="text-2xl font-black text-slate-900">{executiveKPIs.totalUsers}</div>
              <p className="text-[11px] text-slate-500">Total User Base</p>
              <div className="text-[10px] font-bold text-slate-700 pt-1">100% Top of Funnel</div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-2 relative">
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-600">Step 2: AI Planner</div>
              <div className="text-2xl font-black text-purple-700">{executiveKPIs.totalAiInteractions}</div>
              <p className="text-[11px] text-slate-500">Engagements</p>
              <div className="text-[10px] font-bold text-purple-700 pt-1">
                {executiveKPIs.totalUsers > 0 
                  ? `${Math.min(100, Math.round((executiveKPIs.totalAiInteractions / executiveKPIs.totalUsers) * 100))}% Interaction Rate`
                  : '0%'}
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 relative">
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Step 3: Quotes Saved</div>
              <div className="text-2xl font-black text-indigo-700">{executiveKPIs.totalQuotesCount}</div>
              <p className="text-[11px] text-slate-500">Proposals Created</p>
              <div className="text-[10px] font-bold text-indigo-700 pt-1">
                {executiveKPIs.totalAiInteractions > 0
                  ? `${Math.min(100, Math.round((executiveKPIs.totalQuotesCount / Math.max(1, executiveKPIs.totalAiInteractions)) * 100))}% AI → Quote`
                  : '—'}
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2 relative">
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">Step 4: Shared / Export</div>
              <div className="text-2xl font-black text-blue-700">
                {executiveKPIs.pdfDownloadedQuotes + executiveKPIs.whatsappSharedQuotes}
              </div>
              <p className="text-[11px] text-slate-500">PDFs &amp; WhatsApp</p>
              <div className="text-[10px] font-bold text-blue-700 pt-1">
                {executiveKPIs.totalQuotesCount > 0
                  ? `${Math.round(((executiveKPIs.pdfDownloadedQuotes + executiveKPIs.whatsappSharedQuotes) / Math.max(1, executiveKPIs.totalQuotesCount)) * 100)}% Quote Export Rate`
                  : '0%'}
              </div>
            </div>

            {/* Step 5 */}
            <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-2 relative">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#008972]">Step 5: Booking Submitted</div>
              <div className="text-2xl font-black text-[#008972]">{executiveKPIs.totalBookingsCount}</div>
              <p className="text-[11px] text-slate-500">Ground Requests</p>
              <div className="text-[10px] font-bold text-[#008972] pt-1">
                {executiveKPIs.quoteToBookingConversionRate}% Quote → Booking
              </div>
            </div>

            {/* Step 6 */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2 relative">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Step 6: Confirmed &amp; Paid</div>
              <div className="text-2xl font-black text-emerald-700">{executiveKPIs.confirmedBookingsCount}</div>
              <p className="text-[11px] text-slate-500">Closed Ground Sales</p>
              <div className="text-[10px] font-bold text-emerald-700 pt-1">
                {executiveKPIs.totalBookingsCount > 0 
                  ? `${Math.round((executiveKPIs.confirmedBookingsCount / executiveKPIs.totalBookingsCount) * 100)}% Fulfilled`
                  : '0%'}
              </div>
            </div>

          </div>

          {/* AI Planner Impact Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>AI Planner vs Manual Quotation Conversion</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Quotations created with AI-curated itineraries exhibit faster customer decision times and higher proposal download frequency.
              </p>
              <div className="space-y-2 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Quotes Featuring AI-Generated Itineraries</span>
                    <span className="text-purple-600 font-black">
                      {rawQuotes.filter(q => q.items?.some(it => it.source === 'AI_PLANNER' || it.aiSuggested)).length} Quotes
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-purple-600 h-full rounded-full"
                      style={{ 
                        width: `${rawQuotes.length > 0 
                          ? (rawQuotes.filter(q => q.items?.some(it => it.source === 'AI_PLANNER' || it.aiSuggested)).length / rawQuotes.length) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Traditional Manual Catalog Quotes</span>
                    <span className="text-slate-600 font-black">
                      {rawQuotes.filter(q => !q.items?.some(it => it.source === 'AI_PLANNER' || it.aiSuggested)).length} Quotes
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-slate-600 h-full rounded-full"
                      style={{ 
                        width: `${rawQuotes.length > 0 
                          ? (rawQuotes.filter(q => !q.items?.some(it => it.source === 'AI_PLANNER' || it.aiSuggested)).length / rawQuotes.length) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <Globe className="w-4 h-4 text-[#008972]" />
                <span>Top Quoted &amp; Booked Destinations</span>
              </div>
              <div className="space-y-2 pt-1">
                {(() => {
                  const destCounts: Record<string, number> = {};
                  rawQuotes.forEach(q => {
                    if (q.destination) {
                      destCounts[q.destination] = (destCounts[q.destination] || 0) + 1;
                    }
                  });
                  const sorted = Object.entries(destCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
                  if (sorted.length === 0) return <p className="text-xs text-slate-400">No destinations quoted yet.</p>;

                  return sorted.map(([dest, count]) => (
                    <div key={dest} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/60 last:border-none">
                      <span className="font-bold text-slate-800">{dest}</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">
                        {count} Proposals
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
