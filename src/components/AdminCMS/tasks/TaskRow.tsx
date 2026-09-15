import React, { useState } from 'react';
import { 
  CheckCircle, Clock, Link as LinkIcon, User as UserIcon, 
  MoreVertical, Calendar, AlertTriangle, MessageSquare, 
  CornerDownRight, Trash2, Edit2, ShieldAlert
} from 'lucide-react';
import { CalendarTask, TaskStatus, TaskImportance } from '../../../types';
import { 
  getTaskImportanceBadgeColor, 
  getTaskLateInfo, 
  getTaskProgressBadgeColor, 
  getTaskProgressLabel 
} from './taskConstants';

interface TaskRowProps {
  task: CalendarTask;
  onSelect: (task: CalendarTask) => void;
  onToggleComplete: (task: CalendarTask) => void;
  onSnooze: (task: CalendarTask, days: number) => void;
  onDeletePrompt: (task: CalendarTask) => void;
  onNavigateToRecord: (entityType?: string, entityId?: string) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onSelect,
  onToggleComplete,
  onSnooze,
  onDeletePrompt,
  onNavigateToRecord
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const isCompleted = task.status === 'COMPLETED';
  const lateInfo = getTaskLateInfo(task);

  const relatedName = task.bookingReference || task.quoteNumber || task.leadNumber || task.customerName || task.supplierName;

  return (
    <div 
      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group relative ${
        isCompleted
          ? 'bg-slate-50/70 border-slate-200/80 opacity-75'
          : lateInfo.isOverdue
          ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300 shadow-2xs'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      {/* Left side: Checkbox + Title + Description + Badges */}
      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task);
          }}
          className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            isCompleted
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-slate-300 hover:border-emerald-600 hover:bg-emerald-50 text-transparent hover:text-emerald-600'
          }`}
          title={isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
        >
          <CheckCircle className="w-4 h-4" />
        </button>

        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Progress Badge */}
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTaskProgressBadgeColor(task.status)}`}>
              {getTaskProgressLabel(task.status)}
            </span>

            {/* Importance Badge */}
            <span className={`px-2 py-0.5 rounded-md text-[10px] border ${getTaskImportanceBadgeColor(task.importance || task.priority)}`}>
              {task.importance || task.priority || 'Normal'}
            </span>

            {/* Time / Late Badge */}
            <span className={`px-2 py-0.5 rounded-md text-[10px] border flex items-center space-x-1 ${lateInfo.badgeClass}`}>
              <Clock className="w-2.5 h-2.5" />
              <span>{lateInfo.timeLabel}</span>
            </span>

            {/* Google Calendar Sync Indicator */}
            {task.syncWithGoogleCalendar && (task.isSyncedToGoogleCalendar || task.googleCalendarSyncStatus === 'SYNCED') && (
              <a
                href={task.googleCalendarEventUrl || task.googleCalendarLink || '#'}
                target={task.googleCalendarEventUrl || task.googleCalendarLink ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!task.googleCalendarEventUrl && !task.googleCalendarLink) e.preventDefault();
                  e.stopPropagation();
                }}
                className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold flex items-center space-x-1 hover:bg-emerald-100 transition-colors"
                title="Synced with Google Calendar (Click to view)"
              >
                <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                <span>Google Calendar</span>
              </a>
            )}
            {task.syncWithGoogleCalendar && task.googleCalendarSyncStatus === 'SYNC_FAILED' && (
              <span 
                className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-semibold flex items-center space-x-1"
                title={`Sync failed: ${task.googleCalendarSyncError || 'Click to edit or retry'}`}
              >
                <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                <span>Sync Failed</span>
              </span>
            )}
            {task.googleCalendarSyncStatus === 'SYNCING' && (
              <span className="px-1.5 py-0.5 rounded bg-teal-50 text-[#008972] border border-teal-200 text-[10px] font-semibold flex items-center space-x-1">
                <Clock className="w-2.5 h-2.5 animate-spin" />
                <span>Syncing...</span>
              </span>
            )}
          </div>

          {/* Task Title */}
          <div 
            onClick={() => onSelect(task)}
            className="cursor-pointer"
          >
            <h4 className={`text-sm font-extrabold text-slate-900 group-hover:text-[#008972] transition-colors leading-snug ${
              isCompleted ? 'line-through text-slate-400' : ''
            }`}>
              {task.title}
            </h4>

            {(task.description || task.notes) && (
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                {typeof task.description === 'string'
                  ? task.description
                  : typeof task.notes === 'string'
                    ? task.notes
                    : ''}
              </p>
            )}
          </div>

          {/* Related Record Link */}
          {relatedName && (
            <div className="flex items-center space-x-2 pt-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToRecord(task.entityType, task.entityId || task.bookingId || task.leadId || task.quoteId);
                }}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-[#008972]/10 hover:text-[#008972] text-slate-700 text-[11px] font-semibold border border-slate-200 transition-colors cursor-pointer"
              >
                <LinkIcon className="w-3 h-3 text-slate-400" />
                <span className="truncate max-w-[200px]">
                  {task.entityType ? `${task.entityType}: ` : ''}{relatedName}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Assignee & Quick Actions */}
      <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {/* Assignee pill */}
        <div className="flex items-center space-x-2 text-xs text-slate-600">
          <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-xs shadow-2xs">
            {(task.assignedToName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-800 text-[11px] leading-tight">
              {task.assignedToName || 'Unassigned'}
            </div>
            <div className="text-[10px] text-slate-400">
              {task.assignedDepartment || 'Team'}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          {/* Quick Snooze +1 Day */}
          {!isCompleted && (
            <button
              type="button"
              onClick={() => onSnooze(task, 1)}
              className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Snooze for 1 day"
            >
              +1d
            </button>
          )}

          {/* Edit */}
          <button
            type="button"
            onClick={() => onSelect(task)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Edit task"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          {/* Delete / Archive */}
          <button
            type="button"
            onClick={() => onDeletePrompt(task)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Delete or Archive task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
