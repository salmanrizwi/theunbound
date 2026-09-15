import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  actionCenterReminderService, 
  ActionCenterCounts 
} from '../../services/actionCenterReminderService';
import { CalendarTask, User, ActionCenterEntityType, ActionTarget } from '../../types';
import { db } from '../../services/db';
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
  Building2, 
  Calendar, 
  Filter, 
  Route, 
  Loader2, 
  Check, 
  Sparkles, 
  Plus,
  Edit3,
  FileText,
  Briefcase
} from 'lucide-react';
import { TaskModal } from '../AdminCMS/tasks/TaskModal';
import { toast } from '../../services/toastService';

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

  // Task Modal state for editing or creating from drawer
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<CalendarTask | null>(null);

  // Loading & Async execution states
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'completing' | 'snoozing' | 'reactivating' | null>(null);

  // Note dialog state for completion notes
  const [noteModalTask, setNoteModalTask] = useState<CalendarTask | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isTaskModalOpen && !noteModalTask) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isTaskModalOpen, noteModalTask]);

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
    if (actionLoadingTaskId) return;
    setActionLoadingTaskId(taskId);
    setActionType('completing');

    try {
      const result = await actionCenterReminderService.completeTask(
        taskId, 
        currentUser?.name || currentUser?.email || 'Operations Specialist',
        notes
      );

      if (result.success) {
        toast.success('Task Completed', 'Action item successfully closed.');
      } else {
        toast.error('Complete Failed', result.error || 'Failed to complete task');
      }
    } catch (e: any) {
      toast.error('Action Error', e?.message || 'Failed to complete task');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
      setNoteModalTask(null);
      setCompletionNote('');
    }
  };

  const handleSnoozeTask = async (taskId: string, hours: number) => {
    if (actionLoadingTaskId) return;
    setActionLoadingTaskId(taskId);
    setActionType('snoozing');
    setSnoozeMenuTaskId(null);

    try {
      const result = await actionCenterReminderService.snoozeTask(
        taskId, 
        hours, 
        currentUser?.name || currentUser?.email || 'Operations Specialist'
      );

      if (result.success) {
        toast.info('Task Snoozed', `Reminder postponed by ${hours} hours.`);
      } else {
        toast.error('Snooze Failed', result.error || 'Failed to snooze task');
      }
    } catch (e: any) {
      toast.error('Action Error', e?.message || 'Failed to snooze task');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  const handleReactivateTask = async (taskId: string) => {
    if (actionLoadingTaskId) return;
    setActionLoadingTaskId(taskId);
    setActionType('reactivating');

    try {
      const result = await actionCenterReminderService.reactivateTask(
        taskId, 
        currentUser?.name || currentUser?.email || 'Operations Specialist'
      );

      if (result.success) {
        toast.info('Task Reactivated', 'Task returned to active operations.');
      } else {
        toast.error('Wake Failed', result.error || 'Failed to reactivate task');
      }
    } catch (e: any) {
      toast.error('Action Error', e?.message || 'Failed to reactivate task');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  return createPortal(
    <div
      id="theunbound-action-center-portal"
      className="fixed inset-0 z-[9998] flex justify-end bg-slate-900/20 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 relative text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/15 text-[#008f77] flex items-center justify-center font-bold shadow-xs">
              <Bell className="w-5 h-5 text-[#00C6A6]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Action Center
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00C6A6]/15 text-[#008f77] border border-[#00C6A6]/30">
                  {counts.all} Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Operational tasks, supplier follow-ups, and booking alerts
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setTaskToEdit(null);
                setIsTaskModalOpen(true);
              }}
              className="px-3 py-1.5 bg-[#00C6A6] hover:bg-[#00a88d] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Close Action Center (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Switcher: Active / Snoozed / Completed */}
        <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs">
            <button
              onClick={() => {
                setViewMode('ACTIVE');
                setActiveCountTab('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'ACTIVE'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Active ({counts.all})
            </button>
            <button
              onClick={() => setViewMode('SNOOZED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'SNOOZED'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Snoozed ({allSnoozedTasks.length})
            </button>
            <button
              onClick={() => setViewMode('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'COMPLETED'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Completed ({allCompletedTasks.length})
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Live SLA Monitor
          </span>
        </div>

        {/* Active View Quick Filter Chips (Critical, Overdue, Today, Upcoming) */}
        {viewMode === 'ACTIVE' && (
          <div className="px-5 py-2 border-b border-slate-100 flex items-center space-x-1.5 overflow-x-auto no-scrollbar shrink-0 bg-white">
            <button
              onClick={() => setActiveCountTab('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeCountTab === 'ALL'
                  ? 'bg-[#00C6A6] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setActiveCountTab('CRITICAL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center space-x-1 ${
                activeCountTab === 'CRITICAL'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>Critical ({counts.critical})</span>
            </button>
            <button
              onClick={() => setActiveCountTab('OVERDUE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center space-x-1 ${
                activeCountTab === 'OVERDUE'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Overdue ({counts.overdue})</span>
            </button>
            <button
              onClick={() => setActiveCountTab('TODAY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center space-x-1 ${
                activeCountTab === 'TODAY'
                  ? 'bg-[#00C6A6] text-white'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/80'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Due Today ({counts.today})</span>
            </button>
            <button
              onClick={() => setActiveCountTab('UPCOMING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeCountTab === 'UPCOMING'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Upcoming ({counts.upcoming})
            </button>
          </div>
        )}

        {/* Search & Entity Filters */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by task title, client, booking reference, or description..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] focus:outline-hidden transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pr-1">Filter:</span>
            {[
              { id: 'ALL', label: 'All Records' },
              { id: 'BOOKING', label: 'Bookings' },
              { id: 'LEAD', label: 'Leads' },
              { id: 'QUOTE', label: 'Quotes' },
              { id: 'SUPPLIER', label: 'Suppliers' },
              { id: 'PAYMENT', label: 'Payments' },
              { id: 'TASK', label: 'General' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedEntityType(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedEntityType === tab.id
                    ? 'bg-slate-900 text-white font-bold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No matching tasks found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {searchQuery || selectedEntityType !== 'ALL' || activeCountTab !== 'ALL'
                  ? 'Try adjusting your filters or search keywords.'
                  : 'All operational items in this category are completed and up to date.'}
              </p>
              <button
                onClick={() => {
                  setTaskToEdit(null);
                  setIsTaskModalOpen(true);
                }}
                className="mt-4 px-4 py-2 bg-[#00C6A6] hover:bg-[#00a88d] text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Task</span>
              </button>
            </div>
          ) : (
            filteredTasks.map(task => {
              const target = actionCenterReminderService.getActionTarget(task);
              const isOverdue = actionCenterReminderService.isTaskOverdue(task);
              const isTaskLoading = actionLoadingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-[#00C6A6]/60 p-4 shadow-2xs transition-all flex flex-col space-y-3"
                >
                  {/* Top Bar: Entity & Status Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/80">
                        {target.entityType}
                      </span>

                      {Boolean(task.bookingReference || task.leadNumber || task.quoteNumber || task.relatedEntityReference || target.recordId) && (
                        <button
                          type="button"
                          onClick={() => handleOpenRecord(task)}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#00C6A6]/10 hover:bg-[#00C6A6]/20 text-[#008f77] border border-[#00C6A6]/30 flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <span>{task.bookingReference || task.leadNumber || task.quoteNumber || task.relatedEntityReference || target.recordId}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}

                      {task.bookingItemName && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 truncate max-w-[160px]">
                          {task.bookingItemName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {isOverdue && viewMode === 'ACTIVE' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Overdue</span>
                        </span>
                      )}

                      {(task.priority === 'CRITICAL' || task.priority === 'URGENT') && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          {task.priority}
                        </span>
                      )}

                      {task.priority === 'HIGH' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          High
                        </span>
                      )}

                      {task.status === 'COMPLETED' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task Title & Action Required Callout */}
                  <div>
                    <h4 className={`text-sm font-bold text-slate-900 leading-snug ${viewMode === 'COMPLETED' ? 'line-through text-slate-400' : ''}`}>
                      {task.title}
                    </h4>

                    {target.actionRequired && (
                      <div className="mt-1.5 flex items-center space-x-1.5 text-xs font-semibold text-[#007a66] bg-[#00C6A6]/10 px-3 py-1.5 rounded-xl border border-[#00C6A6]/20">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-[#008f77]">Action:</span>
                        <span>{target.actionRequired}</span>
                      </div>
                    )}

                    {task.description && (
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Meta Information: Due Date & Assignee */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Due: <strong>{task.dueAt ? new Date(task.dueAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : `${task.startDate} ${task.startTime}`}</strong></span>
                      </span>

                      {task.assignedToName && (
                        <span className="flex items-center space-x-1">
                          <span className="text-slate-400">Assigned:</span>
                          <strong className="text-slate-700">{task.assignedToName}</strong>
                        </span>
                      )}
                    </div>

                    {task.assignedDepartment && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                        {task.assignedDepartment}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons Bar */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 gap-2">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenRecord(task)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-[#00C6A6] text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Open Record</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTaskToEdit(task);
                          setIsTaskModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                        title="Edit Task in Modal"
                      >
                        <Edit3 className="w-3 h-3 text-slate-500" />
                        <span>Edit</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {/* Active View Actions: Snooze & Complete */}
                      {viewMode === 'ACTIVE' && (
                        <>
                          {/* Snooze Dropdown */}
                          <div className="relative">
                            <button
                              type="button"
                              disabled={!!actionLoadingTaskId}
                              onClick={() => setSnoozeMenuTaskId(snoozeMenuTaskId === task.id ? null : task.id)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                            >
                              {isTaskLoading && actionType === 'snoozing' ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[#00C6A6]" />
                              ) : (
                                <Moon className="w-3 h-3 text-slate-400" />
                              )}
                              <span>Snooze</span>
                            </button>

                            {snoozeMenuTaskId === task.id && !actionLoadingTaskId && (
                              <div className="absolute right-0 bottom-full mb-1.5 w-32 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 divide-y divide-slate-100">
                                <button
                                  type="button"
                                  onClick={() => handleSnoozeTask(task.id, 1)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#00C6A6]/10 text-slate-700 font-medium cursor-pointer"
                                >
                                  1 Hour
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnoozeTask(task.id, 4)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#00C6A6]/10 text-slate-700 font-medium cursor-pointer"
                                >
                                  4 Hours
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnoozeTask(task.id, 24)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#00C6A6]/10 text-slate-700 font-medium cursor-pointer"
                                >
                                  24 Hours
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnoozeTask(task.id, 72)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#00C6A6]/10 text-slate-700 font-medium cursor-pointer"
                                >
                                  3 Days
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Complete Button */}
                          <button
                            type="button"
                            disabled={!!actionLoadingTaskId}
                            onClick={() => handleCompleteTask(task.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                          >
                            {isTaskLoading && actionType === 'completing' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Complete</span>
                          </button>
                        </>
                      )}

                      {/* Snoozed View Actions */}
                      {viewMode === 'SNOOZED' && (
                        <>
                          <button
                            type="button"
                            disabled={!!actionLoadingTaskId}
                            onClick={() => handleReactivateTask(task.id)}
                            className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Wake Now</span>
                          </button>
                          <button
                            type="button"
                            disabled={!!actionLoadingTaskId}
                            onClick={() => handleCompleteTask(task.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </button>
                        </>
                      )}

                      {/* Completed View Actions */}
                      {viewMode === 'COMPLETED' && (
                        <button
                          type="button"
                          disabled={!!actionLoadingTaskId}
                          onClick={() => handleReactivateTask(task.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
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

        {/* Nested Standardized TaskModal for edits/creations from Action Center */}
        {isTaskModalOpen && (
          <TaskModal
            isOpen={isTaskModalOpen}
            onClose={() => {
              setIsTaskModalOpen(false);
              setTaskToEdit(null);
            }}
            onSave={(savedData) => {
              const fullTask: CalendarTask = {
                ...(taskToEdit || {}),
                ...savedData,
                id: taskToEdit?.id || `task-${Date.now()}`,
                createdBy: taskToEdit?.createdBy || currentUser?.email || 'admin'
              } as CalendarTask;
              db.saveCalendarTask(fullTask, currentUser);
              setTick(t => t + 1);
            }}
            taskToEdit={taskToEdit}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>,
    document.body
  );
};
