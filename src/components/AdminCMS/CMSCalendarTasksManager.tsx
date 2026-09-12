import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckSquare, Calendar, Clock, User as UserIcon, Users, 
  Search, Filter, Plus, ArrowUpDown, CheckCircle, AlertTriangle, 
  History, Sparkles, RefreshCw, Sliders, ShieldCheck, Zap,
  Archive, ChevronRight, Inbox, Eye, ArrowRight, BookOpen
} from 'lucide-react';
import { 
  CalendarTask, User, TaskStatus, TaskImportance, SLAAutomationRule, 
  SLAAutomationAuditLog, ActionCenterEntityType 
} from '../../types';
import { db } from '../../services/db';
import { googleCalendarAutomation } from '../../services/googleCalendarAutomationService';
import { TaskModal } from './tasks/TaskModal';
import { AutomaticFollowUpModal } from './tasks/AutomaticFollowUpModal';
import { TaskCalendarView } from './tasks/TaskCalendarView';
import { TaskKanbanView } from './tasks/TaskKanbanView';
import { DeleteTaskModal } from './tasks/DeleteTaskModal';
import { TaskRow } from './tasks/TaskRow';
import { TaskTemplatesBar } from './tasks/TaskTemplatesBar';
import { 
  getTaskImportanceBadgeColor, 
  getTaskLateInfo, 
  getTaskProgressBadgeColor, 
  getTaskProgressLabel,
  SalesTemplate
} from './tasks/taskConstants';

interface CMSCalendarTasksManagerProps {
  currentUser: User | null;
  onNavigateToBooking?: (bookingId: string) => void;
  onNavigateToLead?: (leadId: string) => void;
  onNavigateToQuote?: (quoteId: string) => void;
  onNavigateToSupplier?: (supplierId: string) => void;
}

export const CMSCalendarTasksManager: React.FC<CMSCalendarTasksManagerProps> = ({
  currentUser,
  onNavigateToBooking,
  onNavigateToLead,
  onNavigateToQuote,
  onNavigateToSupplier
}) => {
  // Primary state
  const [tasks, setTasks] = useState<CalendarTask[]>(() => db.getCalendarTasks());
  const [rules, setRules] = useState<SLAAutomationRule[]>(() => db.getSLAAutomationRules());
  const [auditLogs, setAuditLogs] = useState<SLAAutomationAuditLog[]>(() => db.getSLAAutomationAuditLogs());

  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<'MY_TASKS' | 'TEAM_TASKS' | 'CALENDAR' | 'KANBAN' | 'AUTOMATIC_RULES' | 'HISTORY'>('MY_TASKS');

  // Quick Filter for My Tasks & Team Tasks
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'DUE_TODAY' | 'DUE_TOMORROW' | 'THIS_WEEK' | 'OVERDUE' | 'WAITING' | 'COMPLETED' | 'ARCHIVED'>('ALL');
  
  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [importanceFilter, setImportanceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showTemplatesBar, setShowTemplatesBar] = useState(true);

  // Modals state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<CalendarTask | null>(null);
  const [initialTaskDate, setInitialTaskDate] = useState<string | undefined>(undefined);

  const [showAutoRuleModal, setShowAutoRuleModal] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<SLAAutomationRule | null>(null);

  const [taskToDelete, setTaskToDelete] = useState<CalendarTask | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Sync listener with db
  const refreshData = () => {
    setTasks(db.getCalendarTasks());
    setRules(db.getSLAAutomationRules());
    setAuditLogs(db.getSLAAutomationAuditLogs());
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setTasks(db.getCalendarTasks());
      setRules(db.getSLAAutomationRules());
      setAuditLogs(db.getSLAAutomationAuditLogs());
    });
    return () => unsub();
  }, []);

  // Flash toast notice helper
  const showToast = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 4000);
  };

  // Safe Record Navigation
  const handleNavigateToRecord = (entityType?: string, entityId?: string) => {
    if (!entityId) {
      showToast('This record is no longer available.');
      return;
    }

    if (entityType === 'BOOKING' && onNavigateToBooking) {
      onNavigateToBooking(entityId);
    } else if (entityType === 'LEAD' && onNavigateToLead) {
      onNavigateToLead(entityId);
    } else if (entityType === 'QUOTE' && onNavigateToQuote) {
      onNavigateToQuote(entityId);
    } else if (entityType === 'SUPPLIER' && onNavigateToSupplier) {
      onNavigateToSupplier(entityId);
    } else if (onNavigateToLead) {
      // Default to lead if ambiguous
      onNavigateToLead(entityId);
    } else {
      showToast(`Record ${entityId} selected`);
    }
  };

  // Metrics calculation
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const metrics = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'ARCHIVED');
    const myEmail = currentUser?.email?.toLowerCase().trim() || '';

    const myTasksCount = active.filter(t => 
      t.status !== 'COMPLETED' && 
      (t.assignedToEmail?.toLowerCase().trim() === myEmail || (!t.assignedToEmail && myEmail))
    ).length;

    const dueTodayCount = active.filter(t => {
      if (t.status === 'COMPLETED') return false;
      const d = t.startDate || (t.dueAt ? t.dueAt.split('T')[0] : '');
      return d === todayStr;
    }).length;

    const dueThisWeekCount = active.filter(t => {
      if (t.status === 'COMPLETED') return false;
      const d = t.startDate || (t.dueAt ? t.dueAt.split('T')[0] : '');
      if (!d) return false;
      const targetTime = new Date(d).getTime();
      const now = Date.now();
      const weekFromNow = now + 7 * 24 * 3600 * 1000;
      return targetTime >= now && targetTime <= weekFromNow;
    }).length;

    const overdueCount = active.filter(t => {
      if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
      return getTaskLateInfo(t).isOverdue;
    }).length;

    const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
    const unassignedCount = active.filter(t => !t.assignedToEmail && t.status !== 'COMPLETED').length;

    return {
      myTasksCount,
      dueTodayCount,
      dueThisWeekCount,
      overdueCount,
      completedCount,
      unassignedCount
    };
  }, [tasks, currentUser, todayStr]);

  // Filter tasks based on view tab, quick filter, and search
  const filteredTasks = useMemo(() => {
    const myEmail = currentUser?.email?.toLowerCase().trim() || '';
    const q = searchTerm.toLowerCase().trim();

    return tasks.filter(task => {
      // Tab base filtering
      if (activeTab === 'MY_TASKS') {
        const isAssignedToMe = task.assignedToEmail?.toLowerCase().trim() === myEmail || 
          (!task.assignedToEmail && task.assignedDepartment === 'SALES');
        if (!isAssignedToMe) return false;
      }

      // Quick filter
      const taskDate = task.startDate || (task.dueAt ? task.dueAt.split('T')[0] : '');
      const lateInfo = getTaskLateInfo(task);

      if (quickFilter === 'DUE_TODAY') {
        if (task.status === 'COMPLETED' || taskDate !== todayStr) return false;
      } else if (quickFilter === 'DUE_TOMORROW') {
        if (task.status === 'COMPLETED' || taskDate !== tomorrowStr) return false;
      } else if (quickFilter === 'THIS_WEEK') {
        if (task.status === 'COMPLETED' || !taskDate) return false;
        const tMs = new Date(taskDate).getTime();
        const now = Date.now();
        if (tMs < now || tMs > now + 7 * 24 * 3600 * 1000) return false;
      } else if (quickFilter === 'OVERDUE') {
        if (task.status === 'COMPLETED' || !lateInfo.isOverdue) return false;
      } else if (quickFilter === 'WAITING') {
        if (task.status !== 'WAITING_FOR_REPLY') return false;
      } else if (quickFilter === 'COMPLETED') {
        if (task.status !== 'COMPLETED') return false;
      } else if (quickFilter === 'ARCHIVED') {
        if (task.status !== 'ARCHIVED' && !task.isArchived) return false;
      } else {
        // 'ALL' hides archived by default unless specifically selected
        if (task.status === 'ARCHIVED' || task.isArchived) return false;
      }

      // Secondary dropdown filters
      if (departmentFilter !== 'ALL' && task.assignedDepartment !== departmentFilter) {
        return false;
      }
      if (importanceFilter !== 'ALL') {
        const imp = task.importance || task.priority;
        if (imp !== importanceFilter) return false;
      }
      if (statusFilter !== 'ALL' && task.status !== statusFilter) {
        return false;
      }

      // Search match
      if (q) {
        const inTitle = task.title.toLowerCase().includes(q);
        const inDesc = (task.description || '').toLowerCase().includes(q);
        const inAssignee = (task.assignedToName || '').toLowerCase().includes(q);
        const inRef = (task.bookingReference || task.quoteNumber || task.leadNumber || task.customerName || '').toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inAssignee && !inRef) return false;
      }

      return true;
    });
  }, [tasks, activeTab, quickFilter, searchTerm, departmentFilter, importanceFilter, statusFilter, currentUser, todayStr, tomorrowStr]);

  // Task actions: Create / Edit
  const handleSaveTask = (taskPayload: Partial<CalendarTask>) => {
    let saved: CalendarTask;
    if (taskToEdit) {
      saved = {
        ...taskToEdit,
        ...taskPayload,
        updatedAt: new Date().toISOString()
      };
      db.saveCalendarTask(saved, currentUser);
      showToast(`Updated task: "${saved.title}"`);
    } else {
      const nowIso = new Date().toISOString();
      const newTask: CalendarTask = {
        id: `task-${Date.now()}`,
        title: taskPayload.title || 'New Task',
        description: taskPayload.description || '',
        notes: taskPayload.notes || '',
        assignedToEmail: taskPayload.assignedToEmail || currentUser?.email || 'admin@theunbound.in',
        assignedToName: taskPayload.assignedToName || currentUser?.name || 'Staff',
        assignedDepartment: taskPayload.assignedDepartment || 'SALES',
        category: taskPayload.category || 'CLIENT_FOLLOW_UP',
        status: taskPayload.status || 'TO_DO',
        priority: taskPayload.priority || (taskPayload.importance === 'URGENT' ? 'URGENT' : taskPayload.importance === 'IMPORTANT' ? 'HIGH' : taskPayload.importance === 'LOW' ? 'LOW' : 'MEDIUM'),
        importance: taskPayload.importance || 'NORMAL',
        startDate: taskPayload.startDate || todayStr,
        startTime: taskPayload.startTime || '09:00',
        dueAt: taskPayload.dueAt || nowIso,
        entityType: taskPayload.entityType,
        entityId: taskPayload.entityId,
        bookingId: taskPayload.bookingId,
        bookingReference: taskPayload.bookingReference,
        quoteId: taskPayload.quoteId,
        quoteNumber: taskPayload.quoteNumber,
        leadId: taskPayload.leadId,
        leadNumber: taskPayload.leadNumber,
        customerName: taskPayload.customerName,
        isSyncedToGoogleCalendar: false,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      saved = db.saveCalendarTask(newTask, currentUser);
      showToast(`Created task: "${saved.title}"`);
    }

    setTaskToEdit(null);
    refreshData();
  };

  // Toggle complete / reopen
  const handleToggleComplete = (task: CalendarTask) => {
    const isNowDone = task.status !== 'COMPLETED';
    const updated: CalendarTask = {
      ...task,
      status: isNowDone ? 'COMPLETED' : 'TO_DO',
      completedAt: isNowDone ? new Date().toISOString() : undefined,
      completedBy: isNowDone ? (currentUser?.name || currentUser?.email || 'User') : undefined,
      updatedAt: new Date().toISOString()
    };
    db.saveCalendarTask(updated, currentUser);
    showToast(isNowDone ? `Marked complete: "${task.title}"` : `Reopened: "${task.title}"`);
    refreshData();
  };

  // Quick Snooze
  const handleSnooze = (task: CalendarTask, days: number) => {
    const curDate = task.startDate ? new Date(task.startDate) : new Date();
    curDate.setDate(curDate.getDate() + days);
    const newDateStr = curDate.toISOString().split('T')[0];
    const newDueIso = new Date(`${newDateStr}T${task.startTime || '09:00'}:00`).toISOString();

    const updated: CalendarTask = {
      ...task,
      status: 'SNOOZED',
      startDate: newDateStr,
      dueAt: newDueIso,
      snoozedUntil: newDueIso,
      snoozedBy: currentUser?.name || currentUser?.email || 'User',
      updatedAt: new Date().toISOString()
    };
    db.saveCalendarTask(updated, currentUser);
    showToast(`Snoozed for ${days} day(s) until ${newDateStr}`);
    refreshData();
  };

  // Move status (Kanban)
  const handleUpdateStatus = (task: CalendarTask, newStatus: TaskStatus) => {
    const updated: CalendarTask = {
      ...task,
      status: newStatus,
      completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : task.completedAt,
      completedBy: newStatus === 'COMPLETED' ? (currentUser?.name || 'User') : task.completedBy,
      updatedAt: new Date().toISOString()
    };
    db.saveCalendarTask(updated, currentUser);
    showToast(`Updated progress to "${getTaskProgressLabel(newStatus)}"`);
    refreshData();
  };

  // Delete & Archive handlers
  const handleConfirmDelete = (reason: string) => {
    if (!taskToDelete) return;
    db.deleteCalendarTask(taskToDelete.id, currentUser);
    showToast(`Permanently deleted task: "${taskToDelete.title}"`);
    setTaskToDelete(null);
    refreshData();
  };

  const handleConfirmArchive = (reason: string) => {
    if (!taskToDelete) return;
    db.archiveCalendarTask(taskToDelete.id, currentUser);
    showToast(`Archived task: "${taskToDelete.title}"`);
    setTaskToDelete(null);
    refreshData();
  };

  // 1-Click Template selected
  const handleSelectTemplate = (tmpl: SalesTemplate) => {
    setTaskToEdit({
      id: '',
      title: tmpl.name,
      description: tmpl.defaultNotes,
      notes: tmpl.defaultNotes,
      assignedToEmail: currentUser?.email || 'sales@theunbound.in',
      assignedToName: currentUser?.name || 'Me',
      assignedDepartment: tmpl.category === 'OPERATIONS' ? 'OPERATIONS' : tmpl.category === 'FINANCE' ? 'FINANCE' : 'SALES',
      category: tmpl.category === 'FINANCE' ? 'PAYMENT_REMINDER' : 'CLIENT_FOLLOW_UP',
      status: 'TO_DO',
      priority: tmpl.importance === 'URGENT' ? 'URGENT' : tmpl.importance === 'IMPORTANT' ? 'HIGH' : tmpl.importance === 'LOW' ? 'LOW' : 'MEDIUM',
      importance: tmpl.importance,
      startDate: todayStr,
      startTime: '09:00',
      entityType: tmpl.relatedType,
      isSyncedToGoogleCalendar: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setShowTaskModal(true);
  };

  // Save automatic follow-up rule
  const handleSaveAutoRule = (rule: SLAAutomationRule) => {
    db.saveSLAAutomationRule(rule, currentUser);
    showToast(`Saved automatic follow-up: "${rule.ruleName}"`);
    setRuleToEdit(null);
    refreshData();
  };

  // Toggle automatic rule enabled
  const handleToggleRule = (rule: SLAAutomationRule) => {
    const updated: SLAAutomationRule = {
      ...rule,
      isEnabled: !rule.isEnabled,
      updatedAt: new Date().toISOString()
    };
    db.saveSLAAutomationRule(updated, currentUser);
    showToast(`${updated.isEnabled ? 'Activated' : 'Paused'} follow-up: "${rule.ruleName}"`);
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Notice */}
      {noticeMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-[#00E5C0]" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider mb-1">
            <CheckSquare className="w-4 h-4" />
            <span>Work Planner & Operations Dispatch</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Tasks & Follow-Ups
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Manage your work, follow up with leads, coordinate booking activities, and keep every trip moving forward.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => setShowTemplatesBar(prev => !prev)}
            className="px-3.5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <Sparkles className="w-4 h-4 text-[#008972]" />
            <span>{showTemplatesBar ? 'Hide Templates' : 'Templates'}</span>
          </button>

          <button
            onClick={() => {
              setTaskToEdit(null);
              setInitialTaskDate(todayStr);
              setShowTaskModal(true);
            }}
            className="px-5 py-2.5 text-xs font-bold text-white bg-[#008972] hover:bg-[#00705d] rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Task</span>
          </button>
        </div>
      </div>

      {/* 1-Click Templates Bar */}
      {showTemplatesBar && (
        <TaskTemplatesBar onSelectTemplate={handleSelectTemplate} />
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => {
            setActiveTab('MY_TASKS');
            setQuickFilter('ALL');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'MY_TASKS' && quickFilter === 'ALL'
              ? 'bg-[#008972]/10 border-[#008972]'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">My Tasks</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.myTasksCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Assigned to you</div>
        </div>

        <div 
          onClick={() => {
            setActiveTab('TEAM_TASKS');
            setQuickFilter('DUE_TODAY');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            quickFilter === 'DUE_TODAY'
              ? 'bg-blue-50 border-blue-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Due Today</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.dueTodayCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Scheduled today</div>
        </div>

        <div 
          onClick={() => {
            setActiveTab('TEAM_TASKS');
            setQuickFilter('THIS_WEEK');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            quickFilter === 'THIS_WEEK'
              ? 'bg-indigo-50 border-indigo-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Due This Week</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.dueThisWeekCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Next 7 days</div>
        </div>

        {/* OVERDUE / NEEDS ATTENTION CARD */}
        <div 
          onClick={() => {
            setActiveTab('TEAM_TASKS');
            setQuickFilter('OVERDUE');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            metrics.overdueCount > 0 
              ? 'bg-rose-50 border-rose-300 hover:border-rose-400 ring-1 ring-rose-300/40' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue</span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">{metrics.overdueCount}</div>
          <div className="text-[10px] text-rose-600/80 mt-0.5">Needs attention</div>
        </div>

        <div 
          onClick={() => {
            setActiveTab('TEAM_TASKS');
            setQuickFilter('COMPLETED');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            quickFilter === 'COMPLETED'
              ? 'bg-emerald-50 border-emerald-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Completed</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.completedCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Finished tasks</div>
        </div>

        <div 
          onClick={() => {
            setActiveTab('TEAM_TASKS');
            setDepartmentFilter('ALL');
            setQuickFilter('ALL');
          }}
          className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs transition-all cursor-pointer"
        >
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unassigned</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.unassignedCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Needs allocation</div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200 p-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-2 mb-4 px-2">
          {[
            { id: 'MY_TASKS', label: 'My Tasks', icon: UserIcon },
            { id: 'TEAM_TASKS', label: 'Team Tasks', icon: Users },
            { id: 'CALENDAR', label: 'Calendar View', icon: Calendar },
            { id: 'KANBAN', label: 'Kanban View', icon: Sliders },
            { id: 'AUTOMATIC_RULES', label: 'Automatic Follow-Ups', icon: Zap },
            { id: 'HISTORY', label: 'Activity History', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00E5C0]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* SUB-VIEW 1 & 2: MY TASKS & TEAM TASKS LIST */}
        {(activeTab === 'MY_TASKS' || activeTab === 'TEAM_TASKS') && (
          <div className="space-y-4 px-2 pb-2">
            {/* Quick Filter Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-100">
              {[
                { id: 'ALL', label: 'All Tasks' },
                { id: 'DUE_TODAY', label: 'Due Today' },
                { id: 'DUE_TOMORROW', label: 'Due Tomorrow' },
                { id: 'THIS_WEEK', label: 'This Week' },
                { id: 'OVERDUE', label: 'Overdue (Late)' },
                { id: 'WAITING', label: 'Waiting for Reply' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'ARCHIVED', label: 'Archived' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setQuickFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    quickFilter === f.id
                      ? f.id === 'OVERDUE'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-[#008972] text-white shadow-xs'
                      : f.id === 'OVERDUE'
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search & Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title, client, or reference..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              {activeTab === 'TEAM_TASKS' && (
                <div>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  >
                    <option value="ALL">All Departments</option>
                    <option value="SALES">Sales Funnel</option>
                    <option value="OPERATIONS">Operations & Hotels</option>
                    <option value="GROUND_OPS">Ground Ops & Chauffeurs</option>
                    <option value="FINANCE">Finance & Invoicing</option>
                  </select>
                </div>
              )}

              <div>
                <select
                  value={importanceFilter}
                  onChange={(e) => setImportanceFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                >
                  <option value="ALL">All Importance</option>
                  <option value="URGENT">Urgent</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                >
                  <option value="ALL">All Progress</option>
                  <option value="TO_DO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_FOR_REPLY">Waiting for Reply</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="SNOOZED">Snoozed</option>
                </select>
              </div>
            </div>

            {/* Task Rows List */}
            <div className="space-y-2.5 pt-2">
              {filteredTasks.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <Inbox className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No tasks found</p>
                  <p className="text-xs text-slate-400">
                    {activeTab === 'MY_TASKS' 
                      ? 'You are all caught up! Click "+ Add Task" to schedule a new follow-up.'
                      : 'Try adjusting your search or quick filters to see other tasks.'}
                  </p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onSelect={(t) => {
                      setTaskToEdit(t);
                      setShowTaskModal(true);
                    }}
                    onToggleComplete={handleToggleComplete}
                    onSnooze={handleSnooze}
                    onDeletePrompt={(t) => setTaskToDelete(t)}
                    onNavigateToRecord={handleNavigateToRecord}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* SUB-VIEW 3: INTERACTIVE CALENDAR */}
        {activeTab === 'CALENDAR' && (
          <div className="p-2">
            <TaskCalendarView
              tasks={tasks}
              onSelectTask={(t) => {
                setTaskToEdit(t);
                setShowTaskModal(true);
              }}
              onAddTaskOnDate={(dateStr) => {
                setTaskToEdit(null);
                setInitialTaskDate(dateStr);
                setShowTaskModal(true);
              }}
              onToggleComplete={handleToggleComplete}
            />
          </div>
        )}

        {/* SUB-VIEW 4: KANBAN BOARD */}
        {activeTab === 'KANBAN' && (
          <div className="p-2">
            <TaskKanbanView
              tasks={tasks}
              onSelectTask={(t) => {
                setTaskToEdit(t);
                setShowTaskModal(true);
              }}
              onUpdateStatus={handleUpdateStatus}
              onNavigateToRecord={handleNavigateToRecord}
            />
          </div>
        )}

        {/* SUB-VIEW 5: AUTOMATIC FOLLOW-UPS (REPLACING SLA RULES) */}
        {activeTab === 'AUTOMATIC_RULES' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Automatic Follow-Up Processes</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-configured follow-up actions triggered automatically when bookings, inquiries, or quotes occur.
                </p>
              </div>

              <button
                onClick={() => {
                  setRuleToEdit(null);
                  setShowAutoRuleModal(true);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 text-[#00E5C0]" />
                <span>+ New Automatic Process</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3 ${
                    rule.isEnabled
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      When: {rule.triggerEvent.replace(/_/g, ' ')}
                    </span>

                    {/* Enable / Disable toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                        rule.isEnabled 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rule.isEnabled ? 'Active' : 'Paused'}
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{rule.ruleName}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {rule.titleTemplate}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div>
                      <span>Complete within: <strong>{rule.slaHours} hours</strong></span>
                    </div>
                    <div>
                      <span>Assigned to: <strong>{rule.defaultAssignee.name}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRuleToEdit(rule);
                        setShowAutoRuleModal(true);
                      }}
                      className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Edit Process
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB-VIEW 6: ACTIVITY HISTORY */}
        {activeTab === 'HISTORY' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Task & Follow-Up Activity History</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete audit trail of task creations, assignments, scheduled deadlines, and completions.
                </p>
              </div>

              <button
                onClick={refreshData}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Trail</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <History className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No activity logged yet</p>
                  <p className="text-xs text-slate-400">Events are logged automatically when tasks are created or updated.</p>
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900">{log.automationRuleName || log.action || 'Task Event'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {log.triggerEvent}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          log.calendarSyncStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          Calendar: {log.calendarSyncStatus || 'Synced'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                        <span>Task: <strong>{log.taskId}</strong></span>
                        <span>Assigned to: <strong>{log.assignedUser}</strong></span>
                        <span>Complete By: <strong>{new Date(log.slaDeadline).toLocaleString()}</strong></span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 shrink-0 sm:text-right">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Add / Edit Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskToEdit(null);
        }}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        currentUser={currentUser}
        initialDate={initialTaskDate}
      />

      {/* 2. Automatic Follow-Up Setup Modal */}
      <AutomaticFollowUpModal
        isOpen={showAutoRuleModal}
        onClose={() => {
          setShowAutoRuleModal(false);
          setRuleToEdit(null);
        }}
        onSave={handleSaveAutoRule}
        ruleToEdit={ruleToEdit}
        currentUser={currentUser}
      />

      {/* 3. Delete or Archive Task Modal */}
      <DeleteTaskModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        task={taskToDelete}
        onConfirmDelete={handleConfirmDelete}
        onConfirmArchive={handleConfirmArchive}
      />
    </div>
  );
};

export default CMSCalendarTasksManager;
