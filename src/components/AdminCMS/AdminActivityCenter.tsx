import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  AdminActivityRecord, 
  AdminActivityCategory, 
  AdminActivitySeverity, 
  User 
} from '../../types';
import { 
  Activity, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Clock, 
  ArrowRight, 
  ExternalLink, 
  FileDown, 
  Sparkles, 
  Users, 
  Receipt, 
  CalendarCheck, 
  CreditCard, 
  UserCheck, 
  Eye, 
  X, 
  RefreshCw, 
  ChevronRight, 
  Check, 
  ShieldCheck, 
  ShieldAlert, 
  Layers,
  FileText
} from 'lucide-react';

interface AdminActivityCenterProps {
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
  currentUser?: User | null;
  initialFilter?: {
    category?: AdminActivityCategory | 'ALL';
    severity?: AdminActivitySeverity | 'ALL';
    actionRequiredOnly?: boolean;
    unreadOnly?: boolean;
    searchQuery?: string;
  };
}

export const AdminActivityCenter: React.FC<AdminActivityCenterProps> = ({
  onNavigate,
  currentUser,
  initialFilter
}) => {
  const db = AppDatabase.getInstance();
  const [dbTick, setDbTick] = useState(0);

  // Filters State
  const [searchQuery, setSearchQuery] = useState(initialFilter?.searchQuery || '');
  const [selectedCategory, setSelectedCategory] = useState<AdminActivityCategory | 'ALL'>(initialFilter?.category || 'ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<AdminActivitySeverity | 'ALL'>(initialFilter?.severity || 'ALL');
  const [actionRequiredOnly, setActionRequiredOnly] = useState<boolean>(initialFilter?.actionRequiredOnly || false);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(initialFilter?.unreadOnly || false);
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK'>('ALL');

  // Selected Activity for Detail Modal / Slide-out
  const [selectedActivity, setSelectedActivity] = useState<AdminActivityRecord | null>(null);

  // Subscribe to real-time database updates
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setDbTick(t => t + 1);
    });
    return () => unsub();
  }, [db]);

  // Load activities respecting role permissions
  const allActivities = useMemo(() => {
    return db.getAdminActivities(currentUser);
  }, [db, currentUser, dbTick]);

  // Summary Metrics (Section 53)
  const todayMetrics = useMemo(() => {
    return db.getTodayActivitySummary(currentUser);
  }, [db, currentUser, dbTick]);

  // Counts by module
  const moduleCounts = useMemo(() => {
    return db.getActivityCountsByModule(currentUser);
  }, [db, currentUser, dbTick]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

    return allActivities.filter(act => {
      // Category filter
      if (selectedCategory !== 'ALL' && act.category !== selectedCategory) {
        return false;
      }
      // Severity filter
      if (selectedSeverity !== 'ALL' && act.severity !== selectedSeverity) {
        return false;
      }
      // Action Required filter
      if (actionRequiredOnly && !act.actionRequired) {
        return false;
      }
      // Unread filter
      if (unreadOnly && act.read) {
        return false;
      }
      // Time filter
      if (timeFilter !== 'ALL') {
        const actTime = new Date(act.timestamp).getTime();
        if (timeFilter === 'TODAY' && actTime < startOfToday) return false;
        if (timeFilter === 'YESTERDAY' && (actTime < startOfYesterday || actTime >= startOfToday)) return false;
        if (timeFilter === 'WEEK' && actTime < startOfWeek) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesSummary = act.summary.toLowerCase().includes(query);
        const matchesActor = act.actorName.toLowerCase().includes(query);
        const matchesEntity = (act.entityId || '').toLowerCase().includes(query) || (act.bookingReference || '').toLowerCase().includes(query) || (act.leadId || '').toLowerCase().includes(query) || (act.quoteId || '').toLowerCase().includes(query);
        const matchesCustomer = (act.details?.customerName || '').toLowerCase().includes(query);
        const matchesDestination = (act.details?.destinationName || '').toLowerCase().includes(query);
        if (!matchesSummary && !matchesActor && !matchesEntity && !matchesCustomer && !matchesDestination) {
          return false;
        }
      }
      return true;
    });
  }, [allActivities, selectedCategory, selectedSeverity, actionRequiredOnly, unreadOnly, timeFilter, searchQuery]);

  // Relative Time Formatter
  const formatRelativeTime = (timestamp: string): string => {
    try {
      const now = new Date().getTime();
      const past = new Date(timestamp).getTime();
      const diffSecs = Math.max(0, Math.floor((now - past) / 1000));

      if (diffSecs < 60) return 'Just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return timestamp;
    }
  };

  // Helper for Category Icons & Colors
  const getCategoryBadge = (category: AdminActivityCategory) => {
    switch (category) {
      case 'BOOKING':
        return { label: 'Booking', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'LEAD':
        return { label: 'Lead CRM', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'QUOTE':
        return { label: 'Quote', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'AI_PLANNER':
        return { label: 'AI Planner', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'PAYMENT':
        return { label: 'Payment', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'USER':
        return { label: 'User RBAC', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      case 'OPERATIONS':
        return { label: 'Operations', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'PRODUCT':
        return { label: 'Product', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'DESTINATION':
        return { label: 'Destination', bg: 'bg-orange-50 text-orange-700 border-orange-200' };
      case 'SYSTEM':
        return { label: 'System', bg: 'bg-slate-100 text-slate-700 border-slate-300' };
      default:
        return { label: category, bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  // Helper for Severity Style
  const getSeverityIcon = (severity: AdminActivitySeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'INFO':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  // Handle Mark Read
  const handleMarkAsRead = (e: React.MouseEvent, activityId: string) => {
    e.stopPropagation();
    db.markAdminActivityAsRead(activityId, currentUser?.name || currentUser?.email || 'admin');
  };

  // Handle Mark All Read
  const handleMarkAllAsRead = () => {
    db.markAllAdminActivitiesAsRead(
      selectedCategory === 'ALL' ? undefined : selectedCategory,
      currentUser?.name || currentUser?.email || 'admin'
    );
  };

  // Deep Link Action (Section 42)
  const handleDeepLink = (activity: AdminActivityRecord) => {
    // Mark as read when clicked
    if (!activity.read) {
      db.markAdminActivityAsRead(activity.activityId, currentUser?.name || 'admin');
    }
    onNavigate(activity.targetSection, activity.targetSubTab, activity.recordId);
  };

  // Export Activities to JSON/CSV
  const handleExportActivities = (format: 'JSON' | 'CSV') => {
    if (format === 'JSON') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredActivities, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `theunbound-admin-activities-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      const headers = ['Activity ID', 'Timestamp', 'Category', 'Type', 'Severity', 'Actor', 'Summary', 'Target Section', 'Action Required', 'Read'];
      const rows = filteredActivities.map(a => [
        `"${a.activityId}"`,
        `"${a.timestamp}"`,
        `"${a.category}"`,
        `"${a.activityType}"`,
        `"${a.severity}"`,
        `"${a.actorName}"`,
        `"${(a.summary || '').replace(/"/g, '""')}"`,
        `"${a.targetSection}"`,
        `"${a.actionRequired ? 'YES' : 'NO'}"`,
        `"${a.read ? 'YES' : 'NO'}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', encodeURI(csvContent));
      downloadAnchor.setAttribute('download', `theunbound-admin-activities-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  const categories: { id: AdminActivityCategory | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'All Streams' },
    { id: 'BOOKING', label: 'Bookings' },
    { id: 'LEAD', label: 'Leads' },
    { id: 'QUOTE', label: 'Quotes' },
    { id: 'AI_PLANNER', label: 'AI Planner' },
    { id: 'PAYMENT', label: 'Payments' },
    { id: 'USER', label: 'Users & RBAC' },
    { id: 'OPERATIONS', label: 'Ground Ops' },
    { id: 'PRODUCT', label: 'Products' },
    { id: 'DESTINATION', label: 'Destinations' },
    { id: 'SYSTEM', label: 'System' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* 1. HEADER & LIVE ACTIVITY CONTROLS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#008972]/10 text-[#008972] flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Admin Activity & Notification Center
                </h1>
                <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium mt-0.5">
                  <span className="flex items-center text-emerald-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                    Live Activity Stream Active
                  </span>
                  <span>•</span>
                  <span>Consolidated events across Buyers, B2B Agents, Operations & AI Planner</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2.5">
            {moduleCounts.TOTAL.unread > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Mark All Read ({moduleCounts.TOTAL.unread})</span>
              </button>
            )}

            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
              <button
                onClick={() => handleExportActivities('CSV')}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white transition-all flex items-center space-x-1 cursor-pointer"
                title="Export filtered activities to CSV"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => handleExportActivities('JSON')}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white transition-all flex items-center space-x-1 cursor-pointer"
                title="Export filtered activities to JSON"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TODAY'S ACTIVITY METRIC CARDS (Section 53) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3 pt-6 mt-6 border-t border-slate-100">
          {todayMetrics.map(card => {
            const isAlert = card.alert;
            return (
              <button
                key={card.id}
                onClick={() => {
                  if (card.section === 'LEAD_MANAGEMENT' && card.subTab === 'LEADS') {
                    setSelectedCategory('LEAD');
                  } else if (card.section === 'LEAD_MANAGEMENT' && card.subTab === 'QUOTES' && card.filterKey === 'AI_PLAN') {
                    setSelectedCategory('AI_PLANNER');
                  } else if (card.section === 'LEAD_MANAGEMENT' && card.subTab === 'QUOTES') {
                    setSelectedCategory('QUOTE');
                  } else if (card.section === 'BOOKING_MANAGEMENT' && card.filterKey === 'PAYMENT_PENDING') {
                    setSelectedCategory('PAYMENT');
                  } else if (card.section === 'BOOKING_MANAGEMENT') {
                    setSelectedCategory('BOOKING');
                  } else if (card.section === 'ACCOUNT_MANAGEMENT') {
                    setSelectedCategory('USER');
                  } else if (card.section === 'NOTIFICATIONS_MANAGEMENT') {
                    setSelectedCategory('OPERATIONS');
                  } else if (card.section === 'INTEGRATIONS_DB') {
                    setSelectedCategory('SYSTEM');
                  }
                  setTimeFilter('ALL');
                }}
                className={`text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isAlert 
                    ? 'bg-rose-50/50 hover:bg-rose-50 border-rose-200/80 shadow-2xs' 
                    : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                      {card.label}
                    </span>
                    {isAlert && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </div>
                  <div className={`text-xl font-black mt-1 ${isAlert ? 'text-rose-600' : 'text-slate-900'}`}>
                    {card.count}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-1">
                  {card.subtext}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FILTER & SEARCH CONTROL CONSOLE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, booking ref, lead #, quote #, or agent..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#008972]/30 focus:border-[#008972] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Unread Only Toggle */}
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                unreadOnly 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Unread</span>
              {moduleCounts.TOTAL.unread > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${unreadOnly ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {moduleCounts.TOTAL.unread}
                </span>
              )}
            </button>

            {/* Action Required Toggle */}
            <button
              onClick={() => setActionRequiredOnly(!actionRequiredOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                actionRequiredOnly 
                  ? 'bg-rose-600 text-white border-rose-600 shadow-2xs' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Action Required</span>
              {moduleCounts.TOTAL.actionRequired > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${actionRequiredOnly ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700'}`}>
                  {moduleCounts.TOTAL.actionRequired}
                </span>
              )}
            </button>

            {/* Severity Selector */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              aria-label="Filter activities by severity"
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#008972]/30 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Alerts</option>
              <option value="WARNING">Warnings</option>
              <option value="INFO">Informational</option>
            </select>

            {/* Time Filter */}
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              aria-label="Filter activities by time range"
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#008972]/30 cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="WEEK">Past 7 Days</option>
            </select>
          </div>
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none pt-1">
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#008972] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ACTIVITY FEED STREAM */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
        
        {/* Stream Header */}
        <div className="p-4 sm:px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="text-slate-900 font-extrabold uppercase tracking-wider">
              Activity Stream
            </span>
            <span className="text-slate-400">({filteredActivities.length} items)</span>
          </div>
          <div className="flex items-center space-x-4">
            {(selectedCategory !== 'ALL' || selectedSeverity !== 'ALL' || actionRequiredOnly || unreadOnly || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedSeverity('ALL');
                  setActionRequiredOnly(false);
                  setUnreadOnly(false);
                  setSearchQuery('');
                  setTimeFilter('ALL');
                }}
                className="text-[#008972] hover:text-[#00705d] font-bold transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>

        {/* Empty State */}
        {filteredActivities.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Activity className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No activities match your criteria</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try broadening your category, severity, or search query to view older or completed events.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedSeverity('ALL');
                setActionRequiredOnly(false);
                setUnreadOnly(false);
                setSearchQuery('');
                setTimeFilter('ALL');
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              Show All Activities
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredActivities.map(activity => {
              const badge = getCategoryBadge(activity.category);
              const severityIcon = getSeverityIcon(activity.severity);
              const isUnread = !activity.read;

              return (
                <div
                  key={activity.activityId}
                  onClick={() => setSelectedActivity(activity)}
                  className={`p-4 sm:p-5 transition-all hover:bg-slate-50/80 cursor-pointer flex flex-col md:flex-row md:items-start justify-between gap-4 ${
                    isUnread ? 'bg-slate-50/40' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                    
                    {/* Unread / Status Indicator */}
                    <div className="mt-1 shrink-0 flex items-center space-x-1.5">
                      {isUnread ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#008972] shrink-0" title="Unread notification" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-200 shrink-0" title="Read" />
                      )}
                      <div className="p-1 rounded-lg bg-slate-100">
                        {severityIcon}
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      
                      {/* Meta Pills */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${badge.bg}`}>
                          {badge.label}
                        </span>

                        <span className="text-[11px] font-semibold text-slate-500">
                          by <strong className="text-slate-800 font-bold">{activity.actorName}</strong> ({activity.actorType || 'SYSTEM'})
                        </span>

                        <span className="text-[11px] text-slate-400 font-medium">
                          • {formatRelativeTime(activity.timestamp)}
                        </span>

                        {activity.actionRequired && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            <span>{activity.actionLabel || 'Action Required'}</span>
                          </span>
                        )}
                      </div>

                      {/* Summary Title */}
                      <h4 className={`text-sm font-bold tracking-tight ${isUnread ? 'text-slate-900 font-extrabold' : 'text-slate-800'}`}>
                        {activity.summary}
                      </h4>

                      {/* Context Box */}
                      {activity.details && Object.keys(activity.details).length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          {activity.details.customerName && (
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase font-bold block">Client / Traveler</span>
                              <span className="font-semibold text-slate-800">{activity.details.customerName}</span>
                            </div>
                          )}
                          {activity.details.destinationName && (
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase font-bold block">Destination</span>
                              <span className="font-semibold text-slate-800">{activity.details.destinationName}</span>
                            </div>
                          )}
                          {activity.details.travelDates && (
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase font-bold block">Travel Dates</span>
                              <span className="font-semibold text-slate-800">{activity.details.travelDates}</span>
                            </div>
                          )}
                          {activity.details.totalAmount !== undefined && (
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase font-bold block">Value</span>
                              <span className="font-bold text-[#008972]">
                                {activity.details.currency || 'USD'} {activity.details.totalAmount.toLocaleString()}
                              </span>
                            </div>
                          )}
                          {activity.details.actionNeeded && (
                            <div className="w-full text-slate-700 font-medium text-[11px] pt-1 border-t border-slate-200/50 mt-1">
                              <span className="text-slate-400 font-bold mr-1">Required Next Step:</span>
                              {activity.details.actionNeeded}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Right Column */}
                  <div className="shrink-0 flex items-center md:flex-col md:items-end justify-between md:justify-start gap-2 pt-2 md:pt-0">
                    
                    {/* Deep Link Action Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeepLink(activity);
                      }}
                      className="px-3.5 py-1.5 bg-[#008972] hover:bg-[#00705d] text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>{activity.actionLabel ? activity.actionLabel : 'Open Record'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Mark Read Toggle */}
                    {isUnread ? (
                      <button
                        onClick={(e) => handleMarkAsRead(e, activity.activityId)}
                        className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Mark read</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">
                        Read
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. ACTIVITY DETAIL INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                  {getSeverityIcon(selectedActivity.severity)}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Activity Record Details
                  </span>
                  <h3 className="text-sm font-black text-slate-900">
                    {selectedActivity.activityType}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              
              {/* Summary Statement */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  {selectedActivity.summary}
                </h4>
                <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Actor: <strong>{selectedActivity.actorName}</strong> ({selectedActivity.actorType || 'SYSTEM'})</span>
                  <span>•</span>
                  <span>Recorded: {new Date(selectedActivity.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Core Context Details */}
              <div className="space-y-3">
                <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Event Parameters & Payload
                </h5>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Target CMS Module</span>
                    <span className="font-bold text-slate-800">{selectedActivity.targetSection}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">SubTab / Record ID</span>
                    <span className="font-bold text-slate-800">{selectedActivity.targetSubTab || 'DEFAULT'} / {selectedActivity.recordId || selectedActivity.entityId}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Severity Level</span>
                    <span className="font-bold text-slate-800">{selectedActivity.severity}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Action Required</span>
                    <span className={`font-bold ${selectedActivity.actionRequired ? 'text-rose-600' : 'text-slate-600'}`}>
                      {selectedActivity.actionRequired ? 'YES — ' + (selectedActivity.actionLabel || 'Pending Action') : 'NO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Raw Details JSON Inspector */}
              <div className="space-y-2">
                <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Full Context Dictionary
                </h5>
                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-2xl text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedActivity.details || {}, null, 2)}
                </pre>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    if (!selectedActivity.read) {
                      db.markAdminActivityAsRead(selectedActivity.activityId, currentUser?.name || 'admin');
                    }
                    setSelectedActivity(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    handleDeepLink(selectedActivity);
                    setSelectedActivity(null);
                  }}
                  className="px-5 py-2 bg-[#008972] hover:bg-[#00705d] text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <span>Open Target CMS Module</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
