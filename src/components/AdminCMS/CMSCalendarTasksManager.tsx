import React, { useState, useMemo } from 'react';
import { AppDatabase } from '../../services/db';
import { CalendarTask, User } from '../../types';
import { 
  Calendar, 
  CheckCircle2, 
  Plus, 
  Search, 
  UserCheck, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface CMSCalendarTasksManagerProps {
  currentUser?: User | null;
  onNavigateToBooking?: (bookingId: string) => void;
  onNavigateToLead?: (leadId: string) => void;
}

export const CMSCalendarTasksManager: React.FC<CMSCalendarTasksManagerProps> = ({
  currentUser,
  onNavigateToBooking,
  onNavigateToLead
}) => {
  const db = AppDatabase.getInstance();
  const [tasks, setTasks] = useState<CalendarTask[]>(() => db.getCalendarTasks());
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<CalendarTask['category']>('CLIENT_FOLLOW_UP');
  const [newTaskPriority, setNewTaskPriority] = useState<CalendarTask['priority']>('HIGH');
  const [newTaskDate, setNewTaskDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTaskTime, setNewTaskTime] = useState('10:00');
  const [newTaskAssignee, setNewTaskAssignee] = useState('Marcus Vance');
  const [newTaskEmail, setNewTaskEmail] = useState('business@theunbound.in');

  const refreshTasks = () => {
    setTasks(db.getCalendarTasks());
  };

  const handleToggleTaskStatus = (task: CalendarTask) => {
    const updatedStatus: CalendarTask['status'] = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    const updatedTask: CalendarTask = {
      ...task,
      status: updatedStatus,
      updatedAt: new Date().toISOString()
    };
    db.saveCalendarTask(updatedTask, currentUser || null);
    refreshTasks();
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const task: CalendarTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      category: newTaskCategory,
      priority: newTaskPriority,
      status: 'PENDING',
      startDate: newTaskDate,
      startTime: newTaskTime,
      assignedToName: newTaskAssignee,
      assignedToEmail: newTaskEmail,
      isSyncedToGoogleCalendar: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveCalendarTask(task, currentUser || null);
    refreshTasks();
    setShowCreateModal(false);
    setNewTaskTitle('');
    setNewTaskDesc('');
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignedToName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, filterStatus, filterCategory, searchQuery]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const urgent = tasks.filter(t => t.status === 'PENDING' && (t.priority === 'URGENT' || t.priority === 'HIGH')).length;
    return { total, pending, completed, urgent };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Google Calendar & SLA Task Engine
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Synchronized with Ground Ops
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              Operations Calendar & Follow-Up SLA Tasks
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Automated 12-Hour Booking Confirmation SLA assignments, 24-Hour PDF Quote Follow-Ups, and duty manager operations schedule.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-[#008972] hover:bg-[#00705d] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule SLA Task</span>
            </button>
            <button
              onClick={refreshTasks}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="Refresh Tasks"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tasks</div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
          </div>
          <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Actions</div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-900 mt-1">{stats.pending}</div>
          </div>
          <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">High / Urgent Priority</div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-900 mt-1">{stats.urgent}</div>
          </div>
          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Completed</div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-900 mt-1">{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* Filters & Task List */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, descriptions, assignees..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#008972]"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-2 overflow-x-auto">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-hidden"
            >
              <option value="ALL">All Categories</option>
              <option value="CLIENT_FOLLOW_UP">Client Follow-Up</option>
              <option value="GROUND_DISPATCH">Ground Dispatch</option>
              <option value="SUPPLIER_CUTOFF">Supplier Cutoff</option>
              <option value="PAYMENT_REMINDER">Payment Reminder</option>
              <option value="VIP_ARRIVAL">VIP Arrival</option>
              <option value="VISA_SUBMISSION">Visa Submission</option>
            </select>
          </div>
        </div>

        {/* Task Cards */}
        <div className="divide-y divide-slate-100 pt-2">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Calendar className="w-10 h-10 mx-auto text-slate-300 opacity-80" />
              <p className="text-sm font-semibold text-slate-600">No scheduled tasks match your filter.</p>
              <p className="text-xs text-slate-400">Automated SLA tasks appear here as new bookings and quote downloads occur.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const isCompleted = task.status === 'COMPLETED';

              return (
                <div 
                  key={task.id} 
                  className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-colors rounded-2xl p-3 ${
                    isCompleted ? 'bg-slate-50/60 opacity-75' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <button
                      onClick={() => handleToggleTaskStatus(task)}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                        isCompleted 
                          ? 'bg-emerald-500 border-emerald-600 text-white' 
                          : 'border-slate-300 hover:border-[#008972] bg-white text-transparent hover:text-slate-300'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`text-xs sm:text-sm font-bold ${isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {task.title}
                        </h4>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          task.priority === 'URGENT' 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : task.priority === 'HIGH'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {task.priority} Priority
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          {task.category.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-2">
                        {task.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Due: {task.startDate} {task.startTime}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>Assigned: {task.assignedToName}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    {task.bookingReference && onNavigateToBooking && (
                      <button
                        onClick={() => onNavigateToBooking(task.bookingReference!)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <span>View Booking</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                    {task.leadNumber && onNavigateToLead && (
                      <button
                        onClick={() => onNavigateToLead(task.leadNumber!)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <span>View Lead</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleTaskStatus(task)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        isCompleted 
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                          : 'bg-[#008972]/10 text-[#008972] hover:bg-[#008972] hover:text-white'
                      }`}
                    >
                      {isCompleted ? 'Mark Pending' : 'Mark Done'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#008972]/10 text-[#008972] flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Schedule SLA & Calendar Task</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. 12-Hour Confirmation Dispatch for Booking #B-8841"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-[#008972] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  >
                    <option value="CLIENT_FOLLOW_UP">Client Follow-Up</option>
                    <option value="GROUND_DISPATCH">Ground Dispatch</option>
                    <option value="SUPPLIER_CUTOFF">Supplier Cutoff</option>
                    <option value="PAYMENT_REMINDER">Payment Reminder</option>
                    <option value="VIP_ARRIVAL">VIP Arrival</option>
                    <option value="VISA_SUBMISSION">Visa Submission</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  >
                    <option value="URGENT">Urgent (SLA)</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assignee Name
                  </label>
                  <input
                    type="text"
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    placeholder="e.g. Duty Manager"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assignee Email
                  </label>
                  <input
                    type="email"
                    value={newTaskEmail}
                    onChange={(e) => setNewTaskEmail(e.target.value)}
                    placeholder="e.g. ops@theunbound.in"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Operational Notes
                </label>
                <textarea
                  rows={3}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Details on ground dispatch, chauffeur assignment, hotel voucher status..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-[#008972] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#008972] hover:bg-[#00705d] rounded-xl shadow-xs cursor-pointer"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
