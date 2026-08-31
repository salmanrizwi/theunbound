import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  UserPlus, 
  FileText, 
  Calendar, 
  RefreshCw, 
  ArrowRight,
  X,
  ExternalLink
} from 'lucide-react';

export interface SystemNotificationItem {
  id: string;
  type: 'NEW_LEAD' | 'BOOKING_PENDING' | 'PAYMENT_PROOF' | 'QUOTE_FOLLOWUP' | 'SYNC_ALERT' | 'USER_APPROVAL' | 'TASK_DUE';
  title: string;
  message: string;
  timestamp: string;
  relativeTime: string;
  isRead: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  moduleSection: string;
  subTab?: string;
  targetId?: string;
}

interface CMSNotificationsDropdownProps {
  onNavigate: (section: string, subTab?: string, targetId?: string) => void;
}

export const CMSNotificationsDropdown: React.FC<CMSNotificationsDropdownProps> = ({
  onNavigate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const db = AppDatabase.getInstance();

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

  // Compute live real system notifications from actual db records
  const notifications = useMemo<SystemNotificationItem[]>(() => {
    const items: SystemNotificationItem[] = [];

    // 1. Leads with status 'NEW'
    const newLeads = db.getLeads().filter(l => l.status === 'NEW');
    newLeads.slice(0, 5).forEach(l => {
      items.push({
        id: `notif-lead-${l.id}`,
        type: 'NEW_LEAD',
        title: `New Lead: ${l.contactName}`,
        message: `${l.agencyName ? l.agencyName + ' • ' : ''}Requested ${l.destinationName || 'Tour'} (${l.paxAdults} Pax) — Est. ${l.currency} ${l.estimatedBudget || 0}`,
        timestamp: l.notes?.[0]?.timestamp || l.createdAt || new Date().toISOString(),
        relativeTime: 'Action Required',
        isRead: readIds.has(`notif-lead-${l.id}`),
        priority: 'HIGH',
        moduleSection: 'LEAD_MANAGEMENT',
        subTab: 'LEADS',
        targetId: l.id
      });
    });

    // 2. Bookings with status 'PENDING_CONFIRMATION'
    const pendingBookings = db.getAllBookings().filter(b => b.status === 'PENDING_CONFIRMATION');
    pendingBookings.slice(0, 5).forEach(b => {
      items.push({
        id: `notif-booking-${b.id}`,
        type: 'BOOKING_PENDING',
        title: `Booking Pending: ${b.bookingReference}`,
        message: `${b.customer.leadTravelerName} • ${b.items?.length || 0} items • Travel: ${b.travelStartDate}`,
        timestamp: b.travelStartDate,
        relativeTime: 'Ground Dispatch Required',
        isRead: readIds.has(`notif-booking-${b.id}`),
        priority: 'HIGH',
        moduleSection: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS',
        targetId: b.id
      });
    });

    // 3. Payment proofs pending verification
    const bookingsWithProofs = db.getAllBookings().filter(b => 
      b.paymentProofs?.some(p => p.verifiedStatus === 'PENDING_VERIFICATION')
    );
    bookingsWithProofs.slice(0, 3).forEach(b => {
      items.push({
        id: `notif-payment-${b.id}`,
        type: 'PAYMENT_PROOF',
        title: `Payment Proof Uploaded: ${b.bookingReference}`,
        message: `Customer ${b.customer.leadTravelerName} uploaded payment proof for verification.`,
        timestamp: new Date().toISOString(),
        relativeTime: 'Finance Review',
        isRead: readIds.has(`notif-payment-${b.id}`),
        priority: 'HIGH',
        moduleSection: 'BOOKING_MANAGEMENT',
        subTab: 'BOOKINGS',
        targetId: b.id
      });
    });

    // 4. Users pending approval
    const pendingUsers = db.getUsers().filter(u => u.approvalStatus === 'PENDING');
    pendingUsers.slice(0, 3).forEach(u => {
      items.push({
        id: `notif-user-${u.id}`,
        type: 'USER_APPROVAL',
        title: `User Approval Pending: ${u.name}`,
        message: `Role: ${u.role} • ${u.agencyName || u.email} requested portal access.`,
        timestamp: u.createdAt,
        relativeTime: 'Account Access',
        isRead: readIds.has(`notif-user-${u.id}`),
        priority: 'MEDIUM',
        moduleSection: 'ACCOUNT_MANAGEMENT',
        subTab: 'USERS_ACCESS',
        targetId: u.id
      });
    });

    // 5. Calendar Tasks due today
    const calendarTasks = db.getCalendarTasks().filter(t => t.status === 'PENDING');
    calendarTasks.slice(0, 3).forEach(t => {
      items.push({
        id: `notif-task-${t.id}`,
        type: 'TASK_DUE',
        title: `Task Due: ${t.title}`,
        message: `Assigned to ${t.assignedToName} • Due: ${t.startDate} ${t.startTime}`,
        timestamp: t.createdAt,
        relativeTime: `${t.priority} Priority`,
        isRead: readIds.has(`notif-task-${t.id}`),
        priority: t.priority === 'URGENT' || t.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
        moduleSection: 'NOTIFICATIONS_MANAGEMENT',
        subTab: 'CALENDAR_TASKS',
        targetId: t.id
      });
    });

    return items;
  }, [readIds, db]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllAsRead = () => {
    const newSet = new Set(readIds);
    notifications.forEach(n => newSet.add(n.id));
    setReadIds(newSet);
  };

  const handleNotificationClick = (item: SystemNotificationItem) => {
    const newSet = new Set(readIds);
    newSet.add(item.id);
    setReadIds(newSet);
    setIsOpen(false);
    onNavigate(item.moduleSection, item.subTab, item.targetId);
  };

  const getIcon = (type: SystemNotificationItem['type']) => {
    switch (type) {
      case 'NEW_LEAD': return UserPlus;
      case 'BOOKING_PENDING': return Clock;
      case 'PAYMENT_PROOF': return DollarSign;
      case 'USER_APPROVAL': return AlertTriangle;
      case 'TASK_DUE': return Calendar;
      default: return Bell;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center cursor-pointer"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                Actionable Alerts
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#008972]/10 text-[#008972]">
                {unreadCount} New
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-1">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/80" />
                <p className="text-xs font-bold text-slate-600">All caught up!</p>
                <p className="text-[11px] text-slate-400">No urgent operational alerts right now.</p>
              </div>
            ) : (
              notifications.map(item => {
                const Icon = getIcon(item.type);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start space-x-3 cursor-pointer ${
                      item.isRead ? 'bg-white hover:bg-slate-50 opacity-75' : 'bg-slate-50/80 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      item.priority === 'HIGH' 
                        ? 'bg-rose-100 text-rose-600' 
                        : 'bg-[#008972]/10 text-[#008972]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className={`text-xs font-bold truncate ${item.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                          {item.title}
                        </h5>
                        <span className="text-[9px] font-bold text-slate-400 shrink-0 ml-1">
                          {item.relativeTime}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                        {item.message}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('NOTIFICATIONS_MANAGEMENT', 'CALENDAR_TASKS');
              }}
              className="text-xs font-bold text-[#008972] hover:text-[#00705d] flex items-center justify-center space-x-1 mx-auto"
            >
              <span>View All SLA Tasks & Follow-Ups</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
