import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, 
  Plus, CheckCircle, AlertTriangle, User as UserIcon, X,
  ExternalLink, RefreshCw, Trash2, CheckCircle2, AlertCircle,
  FileText, Link as LinkIcon, Edit3, ShieldCheck
} from 'lucide-react';
import { CalendarTask } from '../../../types';
import { 
  getTaskImportanceBadgeColor, 
  getTaskLateInfo, 
  getTaskProgressBadgeColor, 
  getTaskProgressLabel 
} from './taskConstants';

interface TaskCalendarViewProps {
  tasks: CalendarTask[];
  onSelectTask: (task: CalendarTask) => void;
  onAddTaskOnDate: (dateStr: string) => void;
  onToggleComplete: (task: CalendarTask) => void;
  onSyncTask?: (task: CalendarTask) => Promise<void> | void;
  onRemoveSync?: (task: CalendarTask) => Promise<void> | void;
  onRetrySync?: (task: CalendarTask) => Promise<void> | void;
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
  tasks,
  onSelectTask,
  onAddTaskOnDate,
  onToggleComplete,
  onSyncTask,
  onRemoveSync,
  onRetrySync
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [activeDrawerTask, setActiveDrawerTask] = useState<CalendarTask | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Keep drawer task updated if tasks list changes
  const liveDrawerTask = useMemo(() => {
    if (!activeDrawerTask) return null;
    return tasks.find(t => t.id === activeDrawerTask.id) || activeDrawerTask;
  }, [tasks, activeDrawerTask]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigate calendar
  const handlePrev = () => {
    if (viewMode === 'MONTH') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === 'MONTH') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Build Month Grid
  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const mStr = String(prevMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      days.push({
        dateStr: `${prevYear}-${mStr}-${dStr}`,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: false
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    // Next month filler to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const mStr = String(nextMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      days.push({
        dateStr: `${nextYear}-${mStr}-${dStr}`,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: false
      });
    }

    return days;
  }, [year, month]);

  // Map tasks to dates
  const tasksByDate = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const task of tasks) {
      if (task.status === 'ARCHIVED') continue;
      let dateKey = '';
      if (task.startDate) {
        dateKey = task.startDate;
      } else if (task.dueAt) {
        dateKey = task.dueAt.split('T')[0];
      } else if (task.createdAt) {
        dateKey = task.createdAt.split('T')[0];
      }
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(task);
      }
    }
    return map;
  }, [tasks]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Calendar Header & Controls */}
      <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-[#008972]/10 text-[#008972] flex items-center justify-center font-bold">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
              {monthNames[month]} {year}
            </h3>
            <p className="text-xs text-slate-500">
              Interactive timeline of team tasks, lead follow-ups, and booking confirmations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={handlePrev}
              className="p-2 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <button
              onClick={handleNext}
              className="p-2 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-500 py-2.5">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-100/50">
        {monthDays.map((day, idx) => {
          const dayTasks = tasksByDate[day.dateStr] || [];
          return (
            <div
              key={idx}
              className={`min-h-[110px] p-2 bg-white transition-colors relative group flex flex-col ${
                !day.isCurrentMonth ? 'bg-slate-50/60 text-slate-300' : ''
              }`}
            >
              {/* Day Number & Add button */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-xs font-extrabold w-6 h-6 flex items-center justify-center rounded-full ${
                    day.isToday
                      ? 'bg-[#008972] text-white shadow-xs'
                      : day.isCurrentMonth
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {day.dayNumber}
                </span>

                <button
                  onClick={() => onAddTaskOnDate(day.dateStr)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-[#008972] hover:bg-[#008972]/10 transition-all cursor-pointer"
                  title="Add task on this date"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Day Tasks List */}
              <div className="space-y-1 overflow-y-auto flex-1 max-h-24">
                {dayTasks.map(task => {
                  const lateInfo = getTaskLateInfo(task);
                  const isCompleted = task.status === 'COMPLETED';
                  const isGoogleSynced = task.syncWithGoogleCalendar && (task.isSyncedToGoogleCalendar || task.googleCalendarSyncStatus === 'SYNCED');
                  const isGoogleSyncFailed = task.syncWithGoogleCalendar && task.googleCalendarSyncStatus === 'SYNC_FAILED';
                  const isGoogleSyncing = task.googleCalendarSyncStatus === 'SYNCING';

                  return (
                    <div
                      key={task.id}
                      onClick={() => setActiveDrawerTask(task)}
                      className={`p-1.5 rounded-lg border text-left text-[11px] transition-all cursor-pointer hover:shadow-xs flex items-center justify-between gap-1 group/item ${
                        isCompleted
                          ? 'bg-slate-50 text-slate-400 line-through border-slate-200'
                          : lateInfo.isOverdue
                          ? 'bg-rose-50 border-rose-200 text-rose-900 font-medium'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="truncate flex-1">
                        <div className="flex items-center space-x-1">
                          <span className="truncate font-semibold">{task.title}</span>
                          {/* Google Calendar Sync Indicator */}
                          {isGoogleSynced && (
                            <span 
                              title="Synced to Google Calendar" 
                              className="shrink-0 inline-flex items-center text-emerald-600 bg-emerald-50 rounded px-1 text-[9px] font-bold border border-emerald-200"
                            >
                              <CalendarIcon className="w-2.5 h-2.5 mr-0.5" />
                              <span>GCal</span>
                            </span>
                          )}
                          {isGoogleSyncFailed && (
                            <span 
                              title={`Google Calendar sync failed: ${task.googleCalendarSyncError || 'Check connection'}`} 
                              className="shrink-0 inline-flex items-center text-rose-600 bg-rose-50 rounded px-1 text-[9px] font-bold border border-rose-200"
                            >
                              <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                              <span>Error</span>
                            </span>
                          )}
                          {isGoogleSyncing && (
                            <span 
                              title="Syncing with Google Calendar..." 
                              className="shrink-0 inline-flex items-center text-teal-600 bg-teal-50 rounded px-1 text-[9px] font-bold"
                            >
                              <RefreshCw className="w-2.5 h-2.5 mr-0.5 animate-spin" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                          {task.startTime && (
                            <span className="flex items-center space-x-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{task.startTime}</span>
                            </span>
                          )}
                          {task.assignedToName && (
                            <span className="truncate">• {task.assignedToName.split(' ')[0]}</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(task);
                        }}
                        className={`p-0.5 rounded cursor-pointer ${
                          isCompleted ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-600'
                        }`}
                        title={isCompleted ? 'Reopen task' : 'Mark complete'}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Details Drawer without leaving Calendar View */}
      {liveDrawerTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div 
            className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-[#008972]/10 text-[#008972] flex items-center justify-center font-bold">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Task Details</h3>
                  <p className="text-[11px] text-slate-500">Quick view & Google Calendar actions</p>
                </div>
              </div>

              <button
                onClick={() => setActiveDrawerTask(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              {/* Task Title and Status badges */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTaskProgressBadgeColor(liveDrawerTask.status)}`}>
                    {getTaskProgressLabel(liveDrawerTask.status)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] border font-bold ${getTaskImportanceBadgeColor(liveDrawerTask.importance || liveDrawerTask.priority)}`}>
                    {liveDrawerTask.importance || liveDrawerTask.priority || 'NORMAL'}
                  </span>
                  {liveDrawerTask.category && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 font-semibold">
                      {liveDrawerTask.category.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                  {liveDrawerTask.title}
                </h2>

                {liveDrawerTask.description && (
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {liveDrawerTask.description}
                  </p>
                )}
              </div>

              {/* Schedule and Assignee Metadata */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Scheduled Date</span>
                  </span>
                  <span className="font-bold text-slate-800">
                    {liveDrawerTask.startDate || liveDrawerTask.dueAt?.split('T')[0] || 'Unscheduled'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Time</span>
                  </span>
                  <span className="font-bold text-slate-800">
                    {liveDrawerTask.startTime || '09:00 AM'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Assigned To</span>
                  </span>
                  <span className="font-bold text-slate-800">
                    {liveDrawerTask.assignedToName || liveDrawerTask.assignedToEmail || 'Unassigned'}
                  </span>
                </div>

                {(liveDrawerTask.bookingReference || liveDrawerTask.quoteNumber || liveDrawerTask.leadNumber || liveDrawerTask.customerName) && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium flex items-center space-x-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>Related Record</span>
                    </span>
                    <span className="font-bold text-[#008972]">
                      {liveDrawerTask.bookingReference || liveDrawerTask.quoteNumber || liveDrawerTask.leadNumber || liveDrawerTask.customerName}
                    </span>
                  </div>
                )}
              </div>

              {/* GOOGLE CALENDAR SYNCHRONIZATION SECTION */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#008972] flex items-center justify-center font-bold">
                      <CalendarIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-900">Google Calendar Sync</span>
                  </div>

                  {liveDrawerTask.syncWithGoogleCalendar && (liveDrawerTask.isSyncedToGoogleCalendar || liveDrawerTask.googleCalendarSyncStatus === 'SYNCED') ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Synced</span>
                    </span>
                  ) : liveDrawerTask.googleCalendarSyncStatus === 'SYNC_FAILED' ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      <span>Sync Failed</span>
                    </span>
                  ) : liveDrawerTask.googleCalendarSyncStatus === 'SYNCING' ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-[#008972]">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Syncing...</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      Not Synced
                    </span>
                  )}
                </div>

                {/* If Not Synced: Direct Sync Button */}
                {(!liveDrawerTask.syncWithGoogleCalendar || (!liveDrawerTask.isSyncedToGoogleCalendar && liveDrawerTask.googleCalendarSyncStatus !== 'SYNCED')) && liveDrawerTask.googleCalendarSyncStatus !== 'SYNC_FAILED' && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      This task is not yet on Google Calendar. Only tasks explicitly selected are synchronized.
                    </p>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        if (onSyncTask) {
                          setActionLoading(true);
                          await onSyncTask(liveDrawerTask);
                          setActionLoading(false);
                        }
                      }}
                      className="w-full py-2 px-3 text-xs font-bold text-white bg-[#008972] hover:bg-[#00705d] rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Sync with Google Calendar</span>
                    </button>
                  </div>
                )}

                {/* If Synced: Links and Management */}
                {liveDrawerTask.syncWithGoogleCalendar && (liveDrawerTask.isSyncedToGoogleCalendar || liveDrawerTask.googleCalendarSyncStatus === 'SYNCED') && (
                  <div className="space-y-3 pt-1">
                    <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Account:</span>
                        <span className="font-semibold text-slate-800">{liveDrawerTask.googleCalendarAccount || 'TheUnbound Workspace'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Calendar:</span>
                        <span className="font-semibold text-slate-800">{liveDrawerTask.googleCalendarName || 'TheUnbound Operations Calendar'}</span>
                      </div>
                      {liveDrawerTask.googleCalendarLastSyncedAt && (
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Last Synced:</span>
                          <span>{new Date(liveDrawerTask.googleCalendarLastSyncedAt).toLocaleDateString()} {new Date(liveDrawerTask.googleCalendarLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {(liveDrawerTask.googleCalendarEventUrl || liveDrawerTask.googleCalendarLink) && (
                        <a
                          href={liveDrawerTask.googleCalendarEventUrl || liveDrawerTask.googleCalendarLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 px-3 text-xs font-bold text-[#008972] hover:bg-teal-50 border border-teal-200 rounded-xl transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View in Google Calendar</span>
                        </a>
                      )}

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={async () => {
                            if (onSyncTask) {
                              setActionLoading(true);
                              await onSyncTask(liveDrawerTask);
                              setActionLoading(false);
                            }
                          }}
                          className="flex-1 py-1.5 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                          <span>Update Event</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={async () => {
                            if (onRemoveSync) {
                              setActionLoading(true);
                              await onRemoveSync(liveDrawerTask);
                              setActionLoading(false);
                            }
                          }}
                          className="py-1.5 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Sync Failed: Display Retry */}
                {liveDrawerTask.googleCalendarSyncStatus === 'SYNC_FAILED' && (
                  <div className="space-y-2.5 pt-1">
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800">
                      <p className="font-bold flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Synchronization failed</span>
                      </p>
                      <p className="mt-1 text-rose-700">{liveDrawerTask.googleCalendarSyncError || 'Network or token error'}</p>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        if (onRetrySync) {
                          setActionLoading(true);
                          await onRetrySync(liveDrawerTask);
                          setActionLoading(false);
                        }
                      }}
                      className="w-full py-2 px-3 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                      <span>Retry Google Calendar Sync</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onToggleComplete(liveDrawerTask);
                }}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  liveDrawerTask.status === 'COMPLETED'
                    ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-100'
                    : 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{liveDrawerTask.status === 'COMPLETED' ? 'Reopen' : 'Mark Done'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = liveDrawerTask;
                  setActiveDrawerTask(null);
                  onSelectTask(t);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#00E5C0]" />
                <span>Edit Full Task</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
