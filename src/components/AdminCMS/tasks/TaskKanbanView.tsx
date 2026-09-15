import React from 'react';
import { 
  CheckCircle, Clock, AlertTriangle, ArrowRight, User as UserIcon, 
  Link as LinkIcon, MoreHorizontal
} from 'lucide-react';
import { CalendarTask, TaskStatus } from '../../../types';
import { 
  getTaskImportanceBadgeColor, 
  getTaskLateInfo, 
  getTaskProgressLabel 
} from './taskConstants';

interface TaskKanbanViewProps {
  tasks: CalendarTask[];
  onSelectTask: (task: CalendarTask) => void;
  onUpdateStatus: (task: CalendarTask, newStatus: TaskStatus) => void;
  onNavigateToRecord: (entityType?: string, entityId?: string) => void;
}

export const TaskKanbanView: React.FC<TaskKanbanViewProps> = ({
  tasks,
  onSelectTask,
  onUpdateStatus,
  onNavigateToRecord
}) => {
  const activeTasks = tasks.filter(t => t.status !== 'ARCHIVED');

  const columns: Array<{
    id: TaskStatus;
    title: string;
    badgeColor: string;
    filter: (t: CalendarTask) => boolean;
  }> = [
    {
      id: 'TO_DO',
      title: 'To Do',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      filter: (t) => t.status === 'TO_DO' || t.status === 'OPEN' || t.status === 'PENDING' || t.status === 'OVERDUE'
    },
    {
      id: 'IN_PROGRESS',
      title: 'In Progress',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      filter: (t) => t.status === 'IN_PROGRESS'
    },
    {
      id: 'WAITING_FOR_REPLY',
      title: 'Waiting for Reply',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      filter: (t) => t.status === 'WAITING_FOR_REPLY'
    },
    {
      id: 'COMPLETED',
      title: 'Completed',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      filter: (t) => t.status === 'COMPLETED'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {columns.map(col => {
        const colTasks = activeTasks.filter(col.filter);

        return (
          <div
            key={col.id}
            className="bg-slate-100/70 rounded-3xl border border-slate-200 p-4 flex flex-col min-h-[500px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm text-slate-800">{col.title}</span>
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${col.badgeColor}`}>
                  {colTasks.length}
                </span>
              </div>
            </div>

            {/* Task Cards */}
            <div className="space-y-3 overflow-y-auto flex-1">
              {colTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No tasks in this column
                </div>
              ) : (
                colTasks.map(task => {
                  const lateInfo = getTaskLateInfo(task);
                  const isCompleted = task.status === 'COMPLETED';

                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-3 group"
                    >
                      {/* Importance & Late badges */}
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className={`px-2 py-0.5 rounded-md border font-bold ${getTaskImportanceBadgeColor(task.importance || task.priority)}`}>
                          {task.importance || task.priority || 'Normal'}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md border text-[10px] ${lateInfo.badgeClass}`}>
                          {lateInfo.timeLabel}
                        </span>
                      </div>

                      {/* Title & Notes */}
                      <div>
                        <h4 className={`text-xs font-bold text-slate-900 leading-snug group-hover:text-[#008972] transition-colors ${
                          isCompleted ? 'line-through text-slate-400' : ''
                        }`}>
                          {task.title}
                        </h4>
                        {(task.description || task.notes) && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                            {typeof task.description === 'string'
                              ? task.description
                              : typeof task.notes === 'string'
                                ? task.notes
                                : ''}
                          </p>
                        )}
                      </div>

                      {/* Related Record Link */}
                      {(task.leadNumber || task.bookingReference || task.quoteNumber || task.customerName) && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToRecord(task.entityType, task.entityId || task.bookingId || task.leadId || task.quoteId);
                          }}
                          className="inline-flex items-center space-x-1.5 px-2 py-1 bg-slate-50 hover:bg-[#008972]/10 hover:text-[#008972] rounded-lg text-[11px] font-medium text-slate-600 border border-slate-200 transition-colors"
                        >
                          <LinkIcon className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[160px]">
                            {task.bookingReference || task.quoteNumber || task.leadNumber || task.customerName}
                          </span>
                        </div>
                      )}

                      {/* Assignee & Date */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        <div className="flex items-center space-x-1.5 truncate max-w-[140px]">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {(task.assignedToName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{task.assignedToName || 'Unassigned'}</span>
                        </div>

                        {task.startDate && (
                          <span className="text-[10px] font-semibold text-slate-500">
                            {new Date(task.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {/* Quick Move Status Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-medium">Move to:</span>
                        <div className="flex items-center space-x-1">
                          {col.id !== 'TO_DO' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(task, 'TO_DO');
                              }}
                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                            >
                              To Do
                            </button>
                          )}
                          {col.id !== 'IN_PROGRESS' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(task, 'IN_PROGRESS');
                              }}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded transition-colors cursor-pointer"
                            >
                              In Progress
                            </button>
                          )}
                          {col.id !== 'WAITING_FOR_REPLY' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(task, 'WAITING_FOR_REPLY');
                              }}
                              className="px-1.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded transition-colors cursor-pointer"
                            >
                              Waiting
                            </button>
                          )}
                          {col.id !== 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(task, 'COMPLETED');
                              }}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded transition-colors cursor-pointer"
                            >
                              Done
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
        );
      })}
    </div>
  );
};
