import React, { useState, useEffect, useMemo } from 'react';
import { 
  actionCenterReminderService, 
  ActionCenterCounts 
} from '../../services/actionCenterReminderService';
import { CalendarTask, User, ActionCenterEntityType, ActionTarget } from '../../types';
import { 
  Bell, 
  Search, 
  Clock, 
  AlertTriangle, 
  Flame, 
  CheckCircle2, 
  ExternalLink, 
  Moon, 
  X, 
  ChevronRight, 
  RotateCcw, 
  SlidersHorizontal,
  BookmarkCheck,
  Building2,
  Calendar,
  Filter,
  Route,
  Loader2,
  History,
  Check,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface ActionCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  initialTask?: CalendarTask | null;
  onNavigateToRecord: (
    targetOrSection: ActionTarget | string,
    subTab?: string,
    recordId?: string,
    targetElementId?: string
  ) => void;
}

export const ActionCenterDrawer: React.FC<ActionCenterDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialTask,
  onNavigateToRecord
}) => {
  const [tick, setTick] = useState(0);
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'SNOOZED' | 'COMPLETED'>('ACTIVE');
  const [activeCountTab, setActiveCountTab] = useState<'ALL' | 'CRITICAL' | 'OVERDUE' | 'TODAY' | 'UPCOMING'>('ALL');
  const [selectedEntityType, setSelectedEntityType] = useState<ActionCenterEntityType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [snoozeMenuTaskId, setSnoozeMenuTaskId] = useState<string | null>(null);

  // Loading & Async execution states (prevent duplicate clicks & show feedback)
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'completing' | 'snoozing' | 'reactivating' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Optional Note Dialog state
  const [noteModalTask, setNoteModalTask] = useState<CalendarTask | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  // Focus on initialTask if passed
  useEffect(() => {
    if (initialTask && initialTask.entityType) {
      setSelectedEntityType(initialTask.entityType);
    }
  }, [initialTask]);

  // Real-time synchronization
  useEffect(() => {
    const unsub = actionCenterReminderService.subscribe(() => {
      setTick(t => t + 1);
    });
    return unsub;
  }, []);

  const counts: ActionCenterCounts = useMemo(() => {
    return actionCenterReminderService.getRealTimeCounts(currentUser);
  }, [currentUser, tick]);

  const allActiveTasks = useMemo(() => {
    return actionCenterReminderService.getActiveTasks(currentUser);
  }, [currentUser, tick]);

  const allSnoozedTasks = useMemo(() => {
    return actionCenterReminderService.getSnoozedTasks(currentUser);
  }, [currentUser, tick]);

  const allCompletedTasks = useMemo(() => {
    return actionCenterReminderService.getCompletedTasks(currentUser);
  }, [currentUser, tick]);

  // Active pool based on current viewMode
  const currentTaskPool = useMemo(() => {
    if (viewMode === 'SNOOZED') return allSnoozedTasks;
    if (viewMode === 'COMPLETED') return allCompletedTasks;
    return allActiveTasks;
  }, [viewMode, allActiveTasks, allSnoozedTasks, allCompletedTasks]);

  // Filter tasks by category, entity, and search query
  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return currentTaskPool.filter(task => {
      // 1. Count Category Tab filter (only applicable for ACTIVE view)
      if (viewMode === 'ACTIVE') {
        if (activeCountTab === 'CRITICAL') {
          if (task.priority !== 'CRITICAL' && task.priority !== 'URGENT') return false;
        } else if (activeCountTab === 'OVERDUE') {
          if (!actionCenterReminderService.isTaskOverdue(task)) return false;
        } else if (activeCountTab === 'TODAY') {
          if (!task.dueAt) return false;
          const due = new Date(task.dueAt).getTime();
          if (isNaN(due) || due < todayStart.getTime() || due > todayEnd.getTime()) return false;
        } else if (activeCountTab === 'UPCOMING') {
          if (!task.dueAt) return false;
          const due = new Date(task.dueAt).getTime();
          if (isNaN(due) || due <= todayEnd.getTime()) return false;
        }
      }

      // 2. Entity Type filter
      if (selectedEntityType !== 'ALL') {
        const entityType = task.entityType || (
          task.bookingReference || task.bookingId ? 'BOOKING' :
          task.leadNumber || task.leadId ? 'LEAD' :
          task.quoteNumber || task.quoteId ? 'QUOTE' :
          task.paymentId ? 'PAYMENT' : 'TASK'
        );
        if (entityType !== selectedEntityType) return false;
      }

      // 3. Search query filter
      if (query) {
        const matchTitle = task.title?.toLowerCase().includes(query);
        const matchDesc = task.description?.toLowerCase().includes(query);
        const matchAction = task.actionRequired?.toLowerCase().includes(query) || task.requiredAction?.toLowerCase().includes(query);
        const matchBooking = task.bookingReference?.toLowerCase().includes(query);
        const matchQuote = task.quoteNumber?.toLowerCase().includes(query);
        const matchLead = task.leadNumber?.toLowerCase().includes(query);
        const matchCustomer = task.customerName?.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchAction && !matchBooking && !matchQuote && !matchLead && !matchCustomer) {
          return false;
        }
      }

      return true;
    });
  }, [currentTaskPool, viewMode, activeCountTab, selectedEntityType, searchQuery]);

  if (!isOpen) return null;

  const handleOpenRecord = (task: CalendarTask) => {
    const target = actionCenterReminderService.getActionTarget(task);
    onClose();
    if (typeof onNavigateToRecord === 'function') {
      (onNavigateToRecord as any)(target, target.subTab, target.recordId, target.targetElementId);
    }
  };

  const handleCompleteTask = async (taskId: string, notes?: string) => {
    if (actionLoadingTaskId) return; // Prevent duplicate clicks
    setActionLoadingTaskId(taskId);
    setActionType('completing');
    setActionError(null);

    try {
      const result = await actionCenterReminderService.completeTask(
        taskId, 
        currentUser?.name || currentUser?.email || 'Action Center User',
        notes || 'Completed from Action Center',
        currentUser
      );

      if (!result.success) {
        setActionError(result.error || 'Unable to complete this task. Your change was not saved. Please try again.');
      } else {
        setActionSuccessMessage('Task marked complete and persisted to database.');
        setTimeout(() => setActionSuccessMessage(null), 3500);
        if (noteModalTask) {
          setNoteModalTask(null);
          setCompletionNote('');
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unable to complete this task. Your change was not saved. Please try again.');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  const handleSnoozeTask = async (taskId: string, hours: number) => {
    if (actionLoadingTaskId) return; // Prevent duplicate clicks
    setActionLoadingTaskId(taskId);
    setActionType('snoozing');
    setActionError(null);
    setSnoozeMenuTaskId(null);

    try {
      const result = await actionCenterReminderService.snoozeTask(taskId, hours, currentUser);

      if (!result.success) {
        setActionError(result.error || 'Unable to snooze this task. Your change was not saved. Please try again.');
      } else {
        setActionSuccessMessage(`Task snoozed for ${hours}h and persisted.`);
        setTimeout(() => setActionSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unable to snooze this task. Your change was not saved. Please try again.');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  const handleReactivateTask = async (taskId: string) => {
    if (actionLoadingTaskId) return; // Prevent duplicate clicks
    setActionLoadingTaskId(taskId);
    setActionType('reactivating');
    setActionError(null);

    try {
      const result = await actionCenterReminderService.reactivateTask(taskId, currentUser);

      if (!result.success) {
        setActionError(result.error || 'Unable to reactivate this task. Please try again.');
      } else {
        setActionSuccessMessage('Task reactivated and returned to active queue.');
        setTimeout(() => setActionSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unable to reactivate this task. Please try again.');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-white dark:bg-stone-900 h-full shadow-2xl flex flex-col border-l border-stone-200 dark:border-stone-800 animate-in slide-in-from-right duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-stone-900 dark:text-stone-100">
                  TheUnbound Action Center
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-mono">
                  {counts.all} Active
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Actionable tasks and real-time database-persisted reminders
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
            title="Close Action Center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Banners: Success & Error */}
        {actionSuccessMessage && (
          <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button 
              onClick={() => setActionSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2 text-xs font-semibold text-rose-800 dark:text-rose-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button 
              onClick={() => setActionError(null)}
              className="text-rose-600 hover:text-rose-800 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Task Lifecycle View Switcher (Active, Snoozed, Completed) */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-100/50 dark:bg-stone-850/50 px-3 pt-2">
          <button
            onClick={() => setViewMode('ACTIVE')}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              viewMode === 'ACTIVE'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400 bg-white dark:bg-stone-800 rounded-t-xl'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <span>Active</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold">
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setViewMode('SNOOZED')}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              viewMode === 'SNOOZED'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400 bg-white dark:bg-stone-800 rounded-t-xl'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Moon className="w-3 h-3 text-stone-400" />
            <span>Snoozed</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold">
              {allSnoozedTasks.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode('COMPLETED')}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              viewMode === 'COMPLETED'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400 bg-white dark:bg-stone-800 rounded-t-xl'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-stone-400" />
            <span>Completed</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold">
              {allCompletedTasks.length}
            </span>
          </button>
        </div>

        {/* Section 12: Real-time Stored Counts Metric Badges (Only in ACTIVE view) */}
        {viewMode === 'ACTIVE' && (
          <div className="grid grid-cols-5 gap-1.5 p-3 sm:p-4 bg-stone-100/70 dark:bg-stone-800/40 border-b border-stone-200 dark:border-stone-800">
            {/* ALL */}
            <button
              onClick={() => setActiveCountTab('ALL')}
              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                activeCountTab === 'ALL'
                  ? 'bg-white dark:bg-stone-800 shadow-sm border border-stone-300 dark:border-stone-700 font-extrabold text-stone-900 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-white/50 dark:hover:bg-stone-800/40'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">All</div>
              <div className="text-base font-extrabold mt-0.5">{counts.all}</div>
            </button>

            {/* CRITICAL */}
            <button
              onClick={() => setActiveCountTab('CRITICAL')}
              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                activeCountTab === 'CRITICAL'
                  ? 'bg-rose-50 dark:bg-rose-950/60 shadow-sm border border-rose-300 dark:border-rose-800 font-extrabold text-rose-800 dark:text-rose-200'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50/50'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">Critical</div>
              <div className="text-base font-extrabold mt-0.5">{counts.critical}</div>
            </button>

            {/* OVERDUE */}
            <button
              onClick={() => setActiveCountTab('OVERDUE')}
              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                activeCountTab === 'OVERDUE'
                  ? 'bg-rose-100 dark:bg-rose-900/60 shadow-sm border border-rose-400 dark:border-rose-700 font-extrabold text-rose-900 dark:text-rose-100'
                  : 'text-rose-700 dark:text-rose-400 hover:bg-rose-100/40'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider flex items-center justify-center gap-0.5">
                <span>Overdue</span>
                {counts.overdue > 0 && <Flame className="w-2.5 h-2.5 animate-pulse" />}
              </div>
              <div className="text-base font-extrabold mt-0.5">{counts.overdue}</div>
            </button>

            {/* TODAY */}
            <button
              onClick={() => setActiveCountTab('TODAY')}
              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                activeCountTab === 'TODAY'
                  ? 'bg-amber-50 dark:bg-amber-950/60 shadow-sm border border-amber-300 dark:border-amber-800 font-extrabold text-amber-800 dark:text-amber-200'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50/50'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">Today</div>
              <div className="text-base font-extrabold mt-0.5">{counts.today}</div>
            </button>

            {/* UPCOMING */}
            <button
              onClick={() => setActiveCountTab('UPCOMING')}
              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                activeCountTab === 'UPCOMING'
                  ? 'bg-teal-50 dark:bg-teal-950/60 shadow-sm border border-teal-300 dark:border-teal-800 font-extrabold text-teal-800 dark:text-teal-200'
                  : 'text-teal-600 dark:text-teal-400 hover:bg-teal-50/50'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">Upcoming</div>
              <div className="text-base font-extrabold mt-0.5">{counts.upcoming}</div>
            </button>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="p-3 border-b border-stone-200 dark:border-stone-800 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, record reference (#BK...), traveler name..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Entity Type Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {(['ALL', 'BOOKING', 'LEAD', 'QUOTE', 'PAYMENT', 'TASK'] as const).map(type => (
              <button
                key={type}
                onClick={() => setSelectedEntityType(type)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedEntityType === type
                    ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                }`}
              >
                {type === 'ALL' ? 'All Records' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Task List Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-teal-500/50 mx-auto" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300">
                {viewMode === 'ACTIVE' 
                  ? 'All Clear — No Active Tasks' 
                  : viewMode === 'SNOOZED'
                  ? 'No Snoozed Tasks'
                  : 'No Completed Tasks in Log'}
              </h3>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                {viewMode === 'ACTIVE'
                  ? 'No actionable reminders match your active filter. All records are currently synchronized.'
                  : viewMode === 'SNOOZED'
                  ? 'Tasks snoozed for later review will appear here.'
                  : 'Tasks marked as done will be preserved here for audit tracking.'}
              </p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const isOverdue = actionCenterReminderService.isTaskOverdue(task);
              const target = actionCenterReminderService.getActionTarget(task);
              const isTaskLoading = actionLoadingTaskId === task.id;

              // Compute snooze expiration info if snoozed
              let snoozeTimeFormatted = '';
              let snoozeHoursLeft = '';
              if (task.snoozedUntil) {
                const sDate = new Date(task.snoozedUntil);
                if (!isNaN(sDate.getTime())) {
                  snoozeTimeFormatted = sDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const diffMs = sDate.getTime() - Date.now();
                  if (diffMs > 0) {
                    const hoursLeft = Math.ceil(diffMs / (1000 * 60 * 60));
                    snoozeHoursLeft = `(wakes in ~${hoursLeft}h)`;
                  } else {
                    snoozeHoursLeft = '(expired - waking soon)';
                  }
                }
              }

              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-2xl border transition-all text-xs ${
                    viewMode === 'COMPLETED'
                      ? 'bg-stone-50/80 dark:bg-stone-850/80 border-stone-200 dark:border-stone-800 opacity-90'
                      : viewMode === 'SNOOZED'
                      ? 'bg-sky-50/40 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50'
                      : isOverdue 
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60' 
                      : task.priority === 'CRITICAL' || task.priority === 'URGENT'
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                      : 'bg-white dark:bg-stone-850 border-stone-200 dark:border-stone-800 hover:shadow-xs'
                  }`}
                >
                  {/* Record Link Badge & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Blinking reminder dot (only for active tasks) */}
                      {viewMode === 'ACTIVE' && (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isOverdue ? 'bg-rose-400 animate-record-ring-urgent' : 'bg-amber-400 animate-record-ring'}`} />
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        </span>
                      )}

                      {viewMode === 'SNOOZED' && (
                        <Moon className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      )}

                      {viewMode === 'COMPLETED' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}

                      {/* Linked Record Tag */}
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900">
                        {target.entityType} #{target.entityId}
                      </span>

                      {/* Deep Link Route Badge */}
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800/80 flex items-center gap-1">
                        <Route className="w-2.5 h-2.5" />
                        <span>{target.targetRoute}</span>
                      </span>

                      {task.customerName && (
                        <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          {task.customerName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!target.isRecordAvailable && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Missing</span>
                        </span>
                      )}

                      {viewMode === 'COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono">
                          COMPLETED
                        </span>
                      ) : viewMode === 'SNOOZED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-mono">
                          SNOOZED
                        </span>
                      ) : isOverdue ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 animate-pulse">
                          OVERDUE SLA
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h4 className={`font-extrabold text-stone-900 dark:text-stone-100 text-sm leading-snug ${viewMode === 'COMPLETED' ? 'line-through text-stone-500' : ''}`}>
                    {task.title}
                  </h4>

                  {/* Explicit Action Required Callout */}
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/40 px-2.5 py-1 rounded-xl border border-teal-200/60 dark:border-teal-900/60">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-teal-600 dark:text-teal-400">Action:</span>
                    <span>{target.actionRequired}</span>
                  </div>

                  {task.description && (
                    <p className="text-stone-600 dark:text-stone-400 text-xs mt-1.5 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Snooze & Completion Details */}
                  {viewMode === 'SNOOZED' && (
                    <div className="mt-2 p-2 bg-sky-100/60 dark:bg-sky-950/40 rounded-xl border border-sky-200/70 dark:border-sky-800/70 text-[11px] text-sky-900 dark:text-sky-200 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-sky-600" />
                        <span>Snoozed until <strong>{snoozeTimeFormatted}</strong> {snoozeHoursLeft}</span>
                      </div>
                      {task.snoozedBy && (
                        <span className="text-[10px] text-sky-700 dark:text-sky-400">by {task.snoozedBy}</span>
                      )}
                    </div>
                  )}

                  {viewMode === 'COMPLETED' && (
                    <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/70 dark:border-emerald-800/70 text-[11px] text-emerald-900 dark:text-emerald-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Completed on <strong>{task.completedAt ? new Date(task.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'recently'}</strong></span>
                        </div>
                        {task.completedBy && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">by {task.completedBy}</span>
                        )}
                      </div>
                      {task.completionNote && (
                        <div className="mt-1 text-[11px] italic text-emerald-800 dark:text-emerald-300">
                          Note: "{task.completionNote}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meta Information */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400 mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>Due: <strong>{task.dueAt ? new Date(task.dueAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : `${task.startDate} ${task.startTime}`}</strong></span>
                    </span>

                    {task.assignedDepartment && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-stone-400" />
                        <span>{task.assignedDepartment}</span>
                      </span>
                    )}
                  </div>

                  {/* Actions Bar: Open Record + Snooze + Complete / Reactivate */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800">
                    {/* Primary [Open Record] Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenRecord(task)}
                      className="px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-teal-600 dark:hover:bg-teal-400 dark:hover:text-black rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>Open Record</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {/* Active View Actions: Snooze & Complete */}
                      {viewMode === 'ACTIVE' && (
                        <>
                          {/* Snooze Options */}
                          <div className="relative">
                            <button
                              type="button"
                              disabled={!!actionLoadingTaskId}
                              onClick={() => setSnoozeMenuTaskId(snoozeMenuTaskId === task.id ? null : task.id)}
                              className={`px-2.5 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold flex items-center gap-1 ${
                                actionLoadingTaskId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                              }`}
                            >
                              {isTaskLoading && actionType === 'snoozing' ? (
                                <Loader2 className="w-3 h-3 animate-spin text-teal-600" />
                              ) : (
                                <Moon className="w-3 h-3 text-stone-400" />
                              )}
                              <span>{isTaskLoading && actionType === 'snoozing' ? 'Snoozing...' : 'Snooze'}</span>
                            </button>

                            {snoozeMenuTaskId === task.id && !actionLoadingTaskId && (
                              <div 
                                className="absolute right-0 bottom-full mb-1 w-32 bg-white dark:bg-stone-800 rounded-xl shadow-lg border border-stone-200 dark:border-stone-700 py-1 z-30"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSnoozeTask(task.id, 1)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium cursor-pointer"
                                >
                                  1 Hour
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnoozeTask(task.id, 4)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium cursor-pointer"
                                >
                                  4 Hours
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnoozeTask(task.id, 24)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium cursor-pointer"
                                >
                                  24 Hours
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Complete Button with optional note */}
                          <button
                            type="button"
                            disabled={!!actionLoadingTaskId}
                            onClick={() => handleCompleteTask(task.id)}
                            className={`px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs ${
                              actionLoadingTaskId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            {isTaskLoading && actionType === 'completing' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>{isTaskLoading && actionType === 'completing' ? 'Saving...' : 'Complete'}</span>
                          </button>
                        </>
                      )}

                      {/* Snoozed View Actions: Reactivate Now or Complete */}
                      {viewMode === 'SNOOZED' && (
                        <>
                          <button
                            type="button"
                            disabled={!!actionLoadingTaskId}
                            onClick={() => handleReactivateTask(task.id)}
                            className={`px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs ${
                              actionLoadingTaskId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            {isTaskLoading && actionType === 'reactivating' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            <span>Wake Now</span>
                          </button>

                          <button
                            type="button"
                            disabled={!!actionLoadingTaskId}
                            onClick={() => handleCompleteTask(task.id)}
                            className={`px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs ${
                              actionLoadingTaskId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            {isTaskLoading && actionType === 'completing' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Done</span>
                          </button>
                        </>
                      )}

                      {/* Completed View Actions: Reopen task */}
                      {viewMode === 'COMPLETED' && (
                        <button
                          type="button"
                          disabled={!!actionLoadingTaskId}
                          onClick={() => handleReactivateTask(task.id)}
                          className={`px-2.5 py-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
                            actionLoadingTaskId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {isTaskLoading && actionType === 'reactivating' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Reopen</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
