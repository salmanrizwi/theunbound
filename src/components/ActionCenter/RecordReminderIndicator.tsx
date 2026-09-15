import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRecordReminder } from '../../hooks/useRecordReminder';
import { ActionCenterEntityType, CalendarTask, User } from '../../types';
import { 
  Bell, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  X, 
  Moon, 
  ExternalLink,
  Loader2
} from 'lucide-react';
import { toast } from '../../services/toastService';

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
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 360 });

  // Update coords when opening
  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(360, window.innerWidth - 32);
    
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - 16 - popoverWidth;
    }
    if (left < 16) left = 16;

    let top = rect.bottom + 8;
    // Flip above if near bottom
    if (top + 340 > window.innerHeight && rect.top > 340) {
      top = rect.top - 340;
    }

    setPopoverCoords({ top, left, width: popoverWidth });
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleResize = () => updateCoords();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      };
    }
  }, [isOpen]);

  // Close popover when pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSnoozeMenuTaskId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!hasActiveReminder || count === 0) {
    return null;
  }

  // Light Brand Priority Color Styles
  const colorStyles = isOverdue
    ? {
        dotBg: 'bg-rose-500',
        ringColor: 'bg-rose-400',
        badgeBg: 'bg-rose-50 hover:bg-rose-100',
        badgeBorder: 'border-rose-200',
        badgeText: 'text-rose-700',
        icon: Flame,
        label: 'Overdue Action'
      }
    : highestPriority === 'CRITICAL' || highestPriority === 'URGENT'
    ? {
        dotBg: 'bg-rose-500',
        ringColor: 'bg-rose-400',
        badgeBg: 'bg-rose-50 hover:bg-rose-100',
        badgeBorder: 'border-rose-200',
        badgeText: 'text-rose-700',
        icon: AlertTriangle,
        label: 'Critical SLA'
      }
    : highestPriority === 'HIGH'
    ? {
        dotBg: 'bg-amber-500',
        ringColor: 'bg-amber-400',
        badgeBg: 'bg-amber-50 hover:bg-amber-100',
        badgeBorder: 'border-amber-200',
        badgeText: 'text-amber-800',
        icon: Clock,
        label: 'Action Required'
      }
    : {
        dotBg: 'bg-[#00C6A6]',
        ringColor: 'bg-[#00C6A6]/60',
        badgeBg: 'bg-[#00C6A6]/10 hover:bg-[#00C6A6]/20',
        badgeBorder: 'border-[#00C6A6]/30',
        badgeText: 'text-[#008f77]',
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
    if (actionLoadingTaskId) return;
    setActionLoadingTaskId(taskId);
    setActionType('completing');

    try {
      const result = await complete(taskId, 'Completed from Record Indicator');
      if (result.success) {
        toast.success('Task Completed', 'Item marked completed.');
        if (tasks.length <= 1) {
          setIsOpen(false);
        }
      } else {
        toast.error('Complete Failed', result.error || 'Unable to complete task');
      }
    } catch (err: any) {
      toast.error('Action Error', err?.message || 'Unable to complete task');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  const handleSnooze = async (taskId: string, hours: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionLoadingTaskId) return;
    setActionLoadingTaskId(taskId);
    setActionType('snoozing');
    setSnoozeMenuTaskId(null);

    try {
      const result = await snooze(taskId, hours);
      if (result.success) {
        toast.info('Task Snoozed', `Reminder postponed by ${hours} hours.`);
        if (tasks.length <= 1) {
          setIsOpen(false);
        }
      } else {
        toast.error('Snooze Failed', result.error || 'Unable to snooze task');
      }
    } catch (err: any) {
      toast.error('Action Error', err?.message || 'Unable to snooze task');
    } finally {
      setActionLoadingTaskId(null);
      setActionType(null);
    }
  };

  const handleOpenActionCenter = (task: CalendarTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onOpenActionCenter) {
      onOpenActionCenter(task);
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* 1. DOT VARIANT */}
      {variant === 'dot' && (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          title={`${count} active reminder${count > 1 ? 's' : ''}: ${primaryTask?.title || 'Action Required'}`}
          className="relative flex items-center justify-center p-1 rounded-full cursor-pointer hover:scale-110 transition-transform focus:outline-hidden"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorStyles.ringColor}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorStyles.dotBg}`} />
          </span>
          {showCount && count > 1 && (
            <span className="ml-1 text-[9px] font-black font-mono leading-none text-slate-700">
              {count}
            </span>
          )}
        </button>
      )}

      {/* 2. BADGE VARIANT (Standard for Table Rows & Cards) */}
      {variant === 'badge' && (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-2xs whitespace-nowrap ${colorStyles.badgeBg} ${colorStyles.badgeBorder} ${colorStyles.badgeText}`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorStyles.ringColor}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${colorStyles.dotBg}`} />
          </span>
          <IconComponent className="w-3 h-3 shrink-0" />
          <span>
            {count > 1 ? `${count} Actions` : (primaryTask?.actionRequired || colorStyles.label)}
          </span>
        </button>
      )}

      {/* 3. HEADER VARIANT */}
      {variant === 'header' && (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${colorStyles.badgeBg} ${colorStyles.badgeBorder} ${colorStyles.badgeText}`}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorStyles.ringColor}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorStyles.dotBg}`} />
          </span>
          <IconComponent className="w-3.5 h-3.5 shrink-0" />
          <div className="flex items-center gap-1.5 text-left">
            <span className="font-extrabold">
              {isOverdue ? 'Action Overdue' : 'Action Required'}
            </span>
            {count > 1 && (
              <span className="px-1.5 py-0.5 bg-white rounded-md text-[10px] font-mono border border-slate-200">
                {count} tasks
              </span>
            )}
          </div>
        </button>
      )}

      {/* 4. INLINE VARIANT */}
      {variant === 'inline' && (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1.5 cursor-pointer group focus:outline-hidden"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorStyles.ringColor}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${colorStyles.dotBg}`} />
          </span>
          <span className={`text-[10px] font-bold underline decoration-dotted group-hover:decoration-solid ${colorStyles.badgeText}`}>
            {count > 1 ? `${count} tasks` : (primaryTask?.actionRequired || 'Reminder')}
          </span>
        </button>
      )}

      {/* PORTAL-BASED POPOVER CARD */}
      {isOpen && createPortal(
        <>
          {/* Subtle click-outside backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              setSnoozeMenuTaskId(null);
            }}
          />

          <div
            className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 animate-in fade-in zoom-in-95 duration-150 text-left text-slate-800"
            style={{
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
              width: `${popoverCoords.width}px`,
              maxHeight: '380px',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${colorStyles.badgeBg} ${colorStyles.badgeText}`}>
                  <IconComponent className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {count > 1 ? `${count} Active Tasks` : 'Operational Task'}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {entityReference || entityType}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Task list */}
            <div className="mt-2.5 space-y-2.5 divide-y divide-slate-100">
              {tasks.map(task => {
                const isTaskOverdue = task.dueAt ? new Date(task.dueAt).getTime() < Date.now() : false;
                const isTaskLoading = actionLoadingTaskId === task.id;

                return (
                  <div key={task.id} className="pt-2 first:pt-0 space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 leading-snug">
                          {task.title}
                        </span>
                        {isTaskOverdue && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                            Overdue
                          </span>
                        )}
                      </div>

                      {task.actionRequired && (
                        <div className="mt-1 text-[11px] font-semibold text-[#007a66] bg-[#00C6A6]/10 px-2 py-0.5 rounded-md border border-[#00C6A6]/20 inline-block">
                          Action: {task.actionRequired}
                        </div>
                      )}

                      <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Due: {task.dueAt ? new Date(task.dueAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : `${task.startDate} ${task.startTime}`}</span>
                      </div>
                    </div>

                    {/* Quick Task Actions: Complete & Snooze */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={(e) => handleOpenActionCenter(task, e)}
                        className="text-[10px] font-bold text-slate-600 hover:text-[#008f77] flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Action Center</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>

                      <div className="flex items-center space-x-1.5">
                        {/* Snooze button & dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            disabled={!!actionLoadingTaskId}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSnoozeMenuTaskId(snoozeMenuTaskId === task.id ? null : task.id);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold flex items-center space-x-1 cursor-pointer"
                          >
                            <Moon className="w-2.5 h-2.5 text-slate-500" />
                            <span>Snooze</span>
                          </button>

                          {snoozeMenuTaskId === task.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-28 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 divide-y divide-slate-100">
                              <button
                                type="button"
                                onClick={(e) => handleSnooze(task.id, 1, e)}
                                className="w-full text-left px-2.5 py-1 text-[11px] hover:bg-[#00C6A6]/10 text-slate-700 font-medium cursor-pointer"
                              >
                                1 Hour
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSnooze(task.id, 4, e)}
                                className="w-full text-left px-2.5 py-1 text-[11px] hover:bg-[#00C6A6]/10 text-slate-700 font-medium cursor-pointer"
                              >
                                4 Hours
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSnooze(task.id, 24, e)}
                                className="w-full text-left px-2.5 py-1 text-[11px] hover:bg-[#00C6A6]/10 text-slate-700 font-medium cursor-pointer"
                              >
                                24 Hours
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Complete button */}
                        <button
                          type="button"
                          disabled={!!actionLoadingTaskId}
                          onClick={(e) => handleComplete(task.id, e)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 cursor-pointer shadow-2xs"
                        >
                          {isTaskLoading && actionType === 'completing' ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          )}
                          <span>Done</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
