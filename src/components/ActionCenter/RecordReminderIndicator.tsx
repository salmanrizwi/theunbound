import React, { useState, useRef, useEffect } from 'react';
import { useRecordReminder } from '../../hooks/useRecordReminder';
import { ActionCenterEntityType, CalendarTask, User } from '../../types';
import { 
  Bell, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  ChevronRight, 
  X, 
  Moon, 
  ExternalLink,
  ShieldAlert,
  Loader2
} from 'lucide-react';

export interface RecordReminderIndicatorProps {
  entityType: ActionCenterEntityType;
  entityId?: string | null;
  entityReference?: string | null;
  currentUser?: User | null;
  variant?: 'dot' | 'badge' | 'header' | 'inline';
  showCount?: boolean;
  className?: string;
  onOpenActionCenter?: (task: CalendarTask) => void;
}

export const RecordReminderIndicator: React.FC<RecordReminderIndicatorProps> = ({
  entityType,
  entityId,
  entityReference,
  currentUser,
  variant = 'badge',
  showCount = true,
  className = '',
  onOpenActionCenter
}) => {
  const {
    hasActiveReminder,
    tasks,
    count,
    highestPriority,
    isOverdue,
    primaryTask,
    snooze,
    complete
  } = useRecordReminder(entityType, entityId, entityReference, currentUser);

  const [isOpen, setIsOpen] = useState(false);
  const [snoozeMenuTaskId, setSnoozeMenuTaskId] = useState<string | null>(null);
  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'completing' | 'snoozing' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSnoozeMenuTaskId(null);
        setActionError(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!hasActiveReminder || count === 0) {
    return null;
  }

  // Priority-based color palettes
  const colorStyles = isOverdue
    ? {
        dotBg: 'bg-rose-500',
        ringColor: 'bg-rose-400',
        badgeBg: 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60',
        badgeBorder: 'border-rose-200 dark:border-rose-800',
        badgeText: 'text-rose-700 dark:text-rose-300',
        pulseClass: 'animate-record-urgent',
        ringClass: 'animate-record-ring-urgent',
        icon: Flame,
        label: isOverdue ? 'Overdue Action' : 'Action Required'
      }
    : highestPriority === 'CRITICAL' || highestPriority === 'URGENT'
    ? {
        dotBg: 'bg-rose-500',
        ringColor: 'bg-rose-400',
        badgeBg: 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60',
        badgeBorder: 'border-rose-200 dark:border-rose-800',
        badgeText: 'text-rose-700 dark:text-rose-300',
        pulseClass: 'animate-record-pulse',
        ringClass: 'animate-record-ring',
        icon: AlertTriangle,
        label: 'Critical SLA'
      }
    : highestPriority === 'HIGH'
    ? {
        dotBg: 'bg-amber-500',
        ringColor: 'bg-amber-400',
        badgeBg: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60',
        badgeBorder: 'border-amber-200 dark:border-amber-800',
        badgeText: 'text-amber-750 dark:text-amber-300',
        pulseClass: 'animate-record-pulse',
        ringClass: 'animate-record-ring',
        icon: Clock,
        label: 'Action Required'
      }
    : {
        dotBg: 'bg-teal-500',
        ringColor: 'bg-teal-400',
        badgeBg: 'bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 dark:hover:bg-teal-900/60',
        badgeBorder: 'border-teal-200 dark:border-teal-800',
        badgeText: 'text-teal-800 dark:text-teal-300',
        pulseClass: 'animate-record-pulse',
        ringClass: 'animate-record-ring',
        icon: Bell,
        label: 'Reminder'
      };

  const IconComponent = colorStyles.icon;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  const handleComplete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionLoadingTaskId) return; // Prevent duplicate clicks
    setActionLoadingTaskId(taskId);
    setActionType('completing');
    setActionError(null);

    try {
      const result = await complete(taskId, 'Completed from Record Indicator');
      if (!result.success) {
        setActionError(result.error || 'Unable to complete this task. Your change was not saved. Please try again.');
      } else {
        if (tasks.length <= 1) {
          setIsOpen(false);
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unable to complete this task. Your change was not saved. Please try again.');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  const handleSnooze = async (taskId: string, hours: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionLoadingTaskId) return; // Prevent duplicate clicks
    setActionLoadingTaskId(taskId);
    setActionType('snoozing');
    setActionError(null);
    setSnoozeMenuTaskId(null);

    try {
      const result = await snooze(taskId, hours);
      if (!result.success) {
        setActionError(result.error || 'Unable to snooze this task. Your change was not saved. Please try again.');
      } else {
        if (tasks.length <= 1) {
          setIsOpen(false);
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unable to snooze this task. Your change was not saved. Please try again.');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative inline-flex items-center align-middle select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. DOT ONLY VARIANT */}
      {variant === 'dot' && (
        <button
          type="button"
          onClick={handleToggle}
          title={`${count} active reminder${count > 1 ? 's' : ''}: ${primaryTask?.title || 'Action Required'}`}
          className="relative flex items-center justify-center p-1 rounded-full cursor-pointer hover:scale-110 transition-transform focus:outline-none"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${colorStyles.ringColor} ${colorStyles.ringClass}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorStyles.dotBg} ${colorStyles.pulseClass}`} />
          </span>
          {showCount && count > 1 && (
            <span className="ml-1 text-[9px] font-black font-mono leading-none text-slate-700 dark:text-slate-200">
              {count}
            </span>
          )}
        </button>
      )}

      {/* 2. BADGE VARIANT (Standard for Table Rows & Cards) */}
      {variant === 'badge' && (
        <button
          type="button"
          onClick={handleToggle}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${colorStyles.badgeBg} ${colorStyles.badgeBorder} ${colorStyles.badgeText}`}
        >
          {/* Animated Blinking Dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${colorStyles.ringColor} ${colorStyles.ringClass}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${colorStyles.dotBg} ${colorStyles.pulseClass}`} />
          </span>

          <IconComponent className="w-2.5 h-2.5 shrink-0" />

          <span>
            {count > 1 ? `${count} Actions` : (primaryTask?.actionRequired || colorStyles.label)}
          </span>
        </button>
      )}

      {/* 3. HEADER VARIANT (Prominent for Detail Drawers & Workspaces) */}
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleToggle}
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${colorStyles.badgeBg} ${colorStyles.badgeBorder} ${colorStyles.badgeText}`}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${colorStyles.ringColor} ${colorStyles.ringClass}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorStyles.dotBg} ${colorStyles.pulseClass}`} />
          </span>

          <IconComponent className="w-3.5 h-3.5 shrink-0" />

          <div className="flex items-center gap-1.5 text-left">
            <span className="font-extrabold">
              {isOverdue ? 'Action Overdue' : 'Action Required'}
            </span>
            {count > 1 && (
              <span className="px-1.5 py-0.2 bg-white/70 dark:bg-black/30 rounded-md text-[10px] font-mono">
                {count} tasks
              </span>
            )}
          </div>
        </button>
      )}

      {/* 4. INLINE VARIANT */}
      {variant === 'inline' && (
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1 cursor-pointer group focus:outline-none"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${colorStyles.ringColor} ${colorStyles.ringClass}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${colorStyles.dotBg} ${colorStyles.pulseClass}`} />
          </span>
          <span className={`text-[10px] font-bold underline decoration-dotted group-hover:decoration-solid ${colorStyles.badgeText}`}>
            {count > 1 ? `${count} tasks` : (primaryTask?.actionRequired || 'Reminder')}
          </span>
        </button>
      )}

      {/* POPUP / POPOVER CARD */}
      {isOpen && (
        <div 
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorStyles.dotBg}`} />
              </span>
              <span className="text-xs font-extrabold text-stone-900 dark:text-stone-100">
                Active Action Center Reminders
              </span>
              <span className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] font-bold rounded-md font-mono">
                {count}
              </span>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Error Banner */}
          {actionError && (
            <div className="mb-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-medium flex items-center justify-between gap-1.5">
              <span>{actionError}</span>
              <button 
                onClick={() => setActionError(null)} 
                className="text-rose-500 hover:text-rose-700 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Task List */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {tasks.map((task) => {
              const taskOverdue = (task.slaStatus === 'SLA_BREACHED' || (task.slaStatus as string) === 'OVERDUE' || task.status === 'OVERDUE') || 
                (task.dueAt && new Date(task.dueAt).getTime() < Date.now());
              const isTaskLoading = actionLoadingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className={`p-2.5 rounded-xl border text-xs transition-colors ${
                    taskOverdue 
                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60' 
                      : 'bg-stone-50 dark:bg-stone-850 border-stone-200/80 dark:border-stone-750'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-stone-900 dark:text-stone-100 leading-snug">
                      {task.title}
                    </div>
                    {taskOverdue ? (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                        OVERDUE
                      </span>
                    ) : (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                        {task.priority}
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400 mt-2 pt-2 border-t border-stone-200/60 dark:border-stone-800">
                    <div className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>
                        Due: {task.dueAt ? new Date(task.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${task.startDate} ${task.startTime}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Snooze Dropdown Trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          disabled={!!actionLoadingTaskId}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSnoozeMenuTaskId(snoozeMenuTaskId === task.id ? null : task.id);
                          }}
                          className={`px-2 py-1 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-[10px] font-semibold border border-stone-200 dark:border-stone-700 flex items-center gap-1 ${
                            actionLoadingTaskId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {isTaskLoading && actionType === 'snoozing' ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-teal-600" />
                          ) : (
                            <Moon className="w-2.5 h-2.5 text-stone-400" />
                          )}
                          <span>{isTaskLoading && actionType === 'snoozing' ? 'Snoozing...' : 'Snooze'}</span>
                        </button>

                        {/* Snooze Options */}
                        {snoozeMenuTaskId === task.id && !actionLoadingTaskId && (
                          <div 
                            className="absolute right-0 bottom-full mb-1 w-28 bg-white dark:bg-stone-800 rounded-xl shadow-lg border border-stone-200 dark:border-stone-700 py-1 z-30"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleSnooze(task.id, 1, e)}
                              className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium"
                            >
                              1 Hour
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSnooze(task.id, 4, e)}
                              className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium"
                            >
                              4 Hours
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSnooze(task.id, 24, e)}
                              className="w-full text-left px-2.5 py-1 text-[10px] hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium"
                            >
                              24 Hours
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Complete Button */}
                      <button
                        type="button"
                        disabled={!!actionLoadingTaskId}
                        onClick={(e) => handleComplete(task.id, e)}
                        className={`px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors shadow-2xs ${
                          actionLoadingTaskId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        {isTaskLoading && actionType === 'completing' ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        )}
                        <span>{isTaskLoading && actionType === 'completing' ? 'Saving...' : 'Done'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Center Footer Link */}
          {onOpenActionCenter && primaryTask && (
            <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800 text-right">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenActionCenter(primaryTask);
                }}
                className="text-[11px] text-teal-700 dark:text-teal-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Manage in Action Center</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
