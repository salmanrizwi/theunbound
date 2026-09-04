import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppDatabase } from '../../services/db';
import { AdminActivityRecord, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  AlertCircle,
  DollarSign, 
  UserPlus, 
  FileText, 
  Calendar, 
  RefreshCw, 
  ArrowRight, 
  X, 
  ExternalLink,
  Activity,
  Check
} from 'lucide-react';

interface CMSNotificationsDropdownProps {
  onNavigate: (section: string, subTab?: string, targetId?: string) => void;
  currentUser?: User | null;
}

export const CMSNotificationsDropdown: React.FC<CMSNotificationsDropdownProps> = ({
  onNavigate,
  currentUser: propUser
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterActionRequired, setFilterActionRequired] = useState(false);
  const [dbTick, setDbTick] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const db = AppDatabase.getInstance();
  const { user: authUser } = useAuth();

  const currentUser = propUser || authUser || null;

  // Real-time synchronization
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setDbTick(t => t + 1);
    });
    return () => unsub();
  }, [db]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch real activities from database
  const activities = useMemo(() => {
    return db.getAdminActivities(currentUser);
  }, [db, currentUser, dbTick]);

  // Counts
  const counts = useMemo(() => {
    return db.getActivityCountsByModule(currentUser);
  }, [db, currentUser, dbTick]);

  const unreadCount = counts.TOTAL.unread;
  const actionRequiredCount = counts.TOTAL.actionRequired;

  // Filtered dropdown items
  const displayItems = useMemo(() => {
    let items = activities;
    if (filterActionRequired) {
      items = items.filter(a => a.actionRequired);
    }
    return items.slice(0, 10);
  }, [activities, filterActionRequired]);

  const handleNotificationClick = (activity: AdminActivityRecord) => {
    if (!activity.read) {
      db.markAdminActivityAsRead(activity.activityId, currentUser?.name || 'admin');
    }
    setIsOpen(false);
    onNavigate(activity.targetSection, activity.targetSubTab, activity.recordId);
  };

  const handleMarkAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    db.markAllAdminActivitiesAsRead(undefined, currentUser?.name || 'admin');
  };

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
      return `${diffDays}d ago`;
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
        title="Admin Notifications & Activity Center"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 sm:w-[420px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                System Alerts & Activity
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#008972]/10 text-[#008972]">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-100 flex items-center space-x-2 text-xs">
            <button
              onClick={() => setFilterActionRequired(false)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                !filterActionRequired
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Recent
            </button>
            <button
              onClick={() => setFilterActionRequired(true)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                filterActionRequired
                  ? 'bg-rose-500 text-white shadow-2xs'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <span>Action Required</span>
              {actionRequiredCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                  filterActionRequired ? 'bg-white text-rose-600' : 'bg-rose-100 text-rose-700'
                }`}>
                  {actionRequiredCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-1">
            {displayItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/80" />
                <p className="text-xs font-bold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400">No urgent operational notifications right now.</p>
              </div>
            ) : (
              displayItems.map(item => {
                const isUnread = !item.read;

                return (
                  <button
                    key={item.activityId}
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-start space-x-3 cursor-pointer ${
                      isUnread ? 'bg-slate-50/90 hover:bg-slate-100/80' : 'bg-white hover:bg-slate-50 opacity-75'
                    }`}
                  >
                    {/* Status Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.severity === 'CRITICAL' || item.actionRequired
                        ? 'bg-rose-100 text-rose-600'
                        : item.severity === 'WARNING'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-[#008972]/10 text-[#008972]'
                    }`}>
                      {item.severity === 'CRITICAL' ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : item.severity === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          {item.category} • {item.actorName}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 shrink-0 ml-1">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <h5 className={`text-xs font-bold truncate ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {item.summary}
                      </h5>

                      {item.details?.actionNeeded && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          <strong className="text-slate-600">Action:</strong> {item.details.actionNeeded}
                        </p>
                      )}

                      {item.actionRequired && (
                        <div className="pt-0.5">
                          <span className="inline-flex items-center space-x-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">
                            <span className="w-1 h-1 rounded-full bg-rose-500 animate-ping" />
                            <span>{item.actionLabel || 'Action Required'}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Navigation */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('NOTIFICATIONS_MANAGEMENT', 'TASKS');
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Ground SLAs
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('INTEGRATIONS_DB', 'ACTIVITY_CENTER');
              }}
              className="text-xs font-bold text-[#008972] hover:text-[#00705d] flex items-center space-x-1 cursor-pointer"
            >
              <span>Open Admin Activity Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
