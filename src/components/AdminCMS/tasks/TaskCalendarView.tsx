import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, 
  Plus, CheckCircle, AlertTriangle, User as UserIcon
} from 'lucide-react';
import { CalendarTask } from '../../../types';
import { getTaskImportanceBadgeColor, getTaskLateInfo } from './taskConstants';

interface TaskCalendarViewProps {
  tasks: CalendarTask[];
  onSelectTask: (task: CalendarTask) => void;
  onAddTaskOnDate: (dateStr: string) => void;
  onToggleComplete: (task: CalendarTask) => void;
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
  tasks,
  onSelectTask,
  onAddTaskOnDate,
  onToggleComplete
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK'>('MONTH');

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

                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`p-1.5 rounded-lg border text-left text-[11px] transition-all cursor-pointer hover:shadow-xs flex items-center justify-between gap-1 ${
                        isCompleted
                          ? 'bg-slate-50 text-slate-400 line-through border-slate-200'
                          : lateInfo.isOverdue
                          ? 'bg-rose-50 border-rose-200 text-rose-900 font-medium'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="truncate flex-1">
                        <span className="truncate block font-semibold">{task.title}</span>
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
    </div>
  );
};
