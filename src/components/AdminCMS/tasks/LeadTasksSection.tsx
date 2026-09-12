import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarTask, 
  TravelLead, 
  User, 
  TaskImportance, 
  TaskStatus, 
  ActionCenterPriority 
} from '../../../types';
import { AppDatabase } from '../../../services/db';
import { 
  CheckSquare, 
  Plus, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  User as UserIcon, 
  Search, 
  RotateCcw, 
  Trash2, 
  Sparkles, 
  ExternalLink,
  ChevronDown,
  Filter,
  Tag,
  ArrowUpRight
} from 'lucide-react';
import { TaskModal } from './TaskModal';

interface LeadTasksSectionProps {
  lead: TravelLead;
  currentUser: User | null;
  onNavigateToTasks?: () => void;
}

const LEAD_TASK_TEMPLATES = [
  { name: 'Contact new enquiry', hours: 2, priority: 'URGENT' as ActionCenterPriority, desc: 'Introduce TheUnbound and qualify itinerary requirements.' },
  { name: 'Request missing passenger details', hours: 4, priority: 'HIGH' as ActionCenterPriority, desc: 'Collect passenger names, passport numbers, and room preferences.' },
  { name: 'Confirm travel dates', hours: 4, priority: 'HIGH' as ActionCenterPriority, desc: 'Verify exact arrival and departure dates and flight info.' },
  { name: 'Ask for hotel preferences', hours: 6, priority: 'MEDIUM' as ActionCenterPriority, desc: 'Enquire about 4★/5★ luxury, ryokan stays, or boutique heritage lodging.' },
  { name: 'Prepare quotation', hours: 6, priority: 'HIGH' as ActionCenterPriority, desc: 'Generate proposal with live wholesale calculations and requested services.' },
  { name: 'Send quotation', hours: 4, priority: 'HIGH' as ActionCenterPriority, desc: 'Dispatch formal quotation via email and portal download.' },
  { name: 'Follow up after quote download', hours: 2, priority: 'URGENT' as ActionCenterPriority, desc: 'Client has downloaded PDF. Call to answer questions.' },
  { name: 'Follow up after WhatsApp sharing', hours: 4, priority: 'HIGH' as ActionCenterPriority, desc: 'Confirm receipt of interactive quotation link shared on WhatsApp.' },
  { name: 'Revise quotation', hours: 12, priority: 'HIGH' as ActionCenterPriority, desc: 'Apply requested adjustments to line items, meal plans, or vehicle.' },
  { name: 'Confirm budget', hours: 12, priority: 'MEDIUM' as ActionCenterPriority, desc: 'Verify expected budget allocation per passenger.' },
  { name: 'Check visa requirements', hours: 24, priority: 'MEDIUM' as ActionCenterPriority, desc: 'Confirm visa rules for nationality and issue invitation letters if needed.' },
  { name: 'Confirm decision-maker', hours: 24, priority: 'MEDIUM' as ActionCenterPriority, desc: 'Verify lead authority and decision timetable.' },
  { name: 'Follow up before travel date', hours: 48, priority: 'HIGH' as ActionCenterPriority, desc: 'Send countdown checklist and pre-departure emergency advisory.' },
  { name: 'Convert lead into booking', hours: 6, priority: 'URGENT' as ActionCenterPriority, desc: 'Secure client confirmation and proceed with booking file handover.' },
  { name: 'Contact the B2B Agent', hours: 8, priority: 'HIGH' as ActionCenterPriority, desc: 'Follow up with partner travel agency regarding client approval.' },
  { name: 'Request payment confirmation', hours: 4, priority: 'URGENT' as ActionCenterPriority, desc: 'Request bank wire receipt or credit card token for deposit.' },
];

export const LeadTasksSection: React.FC<LeadTasksSectionProps> = ({
  lead,
  currentUser,
  onNavigateToTasks
}) => {
  const db = AppDatabase.getInstance();
  const [tasks, setTasks] = useState<CalendarTask[]>(() => db.getTasksForLead(lead.id));

  // Granular Permission Gates
  const canCreate = useMemo(() => {
    if (!currentUser) return true;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') return true;
    const perms = currentUser.permissions;
    if (!perms) return true;
    if (perms.leadTasksCreate !== undefined) return perms.leadTasksCreate;
    if (perms.tasksCreate !== undefined) return perms.tasksCreate;
    return true;
  }, [currentUser]);

  const canEdit = useMemo(() => {
    if (!currentUser) return true;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') return true;
    const perms = currentUser.permissions;
    if (!perms) return true;
    if (perms.tasksEdit !== undefined) return perms.tasksEdit;
    return true;
  }, [currentUser]);

  const canComplete = useMemo(() => {
    if (!currentUser) return true;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') return true;
    const perms = currentUser.permissions;
    if (!perms) return true;
    if (perms.tasksComplete !== undefined) return perms.tasksComplete;
    return true;
  }, [currentUser]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED' | 'OVERDUE'>('OPEN');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<'ALL' | 'ME' | 'UNASSIGNED'>('ALL');
  const [showTemplates, setShowTemplates] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<CalendarTask | null>(null);

  // Synchronize with database
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setTasks(db.getTasksForLead(lead.id));
    });
    return () => unsub();
  }, [lead.id]);

  const summary = useMemo(() => {
    return db.getLeadTaskSummary(lead.id, currentUser?.email || currentUser?.name);
  }, [tasks, lead.id, currentUser]);

  // Filtered task items
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return tasks.filter(task => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        task.title.toLowerCase().includes(q) || 
        (task.taskName && task.taskName.toLowerCase().includes(q)) ||
        (task.description && task.description.toLowerCase().includes(q)) ||
        (task.assignedToName && task.assignedToName.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Status
      const taskDueDate = task.dueDate || task.startDate || (task.dueAt ? task.dueAt.split('T')[0] : '');
      const isOverdue = task.status !== 'COMPLETED' && taskDueDate && taskDueDate < todayStr;

      if (statusFilter === 'OPEN' && task.status === 'COMPLETED') return false;
      if (statusFilter === 'COMPLETED' && task.status !== 'COMPLETED') return false;
      if (statusFilter === 'OVERDUE' && !isOverdue) return false;

      // Priority
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;

      // Assignee
      if (assigneeFilter === 'ME') {
        const isMe = task.assignedToEmail === currentUser?.email || task.assignedToName === currentUser?.name;
        if (!isMe) return false;
      } else if (assigneeFilter === 'UNASSIGNED') {
        if (task.assignedToEmail || task.assignedToName) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, currentUser]);

  const handleToggleComplete = (task: CalendarTask) => {
    if (task.status === 'COMPLETED') {
      db.reopenTask(task.id, currentUser);
    } else {
      db.completeTask(task.id, currentUser);
    }
  };

  const handleQuickCreateTemplate = (tmpl: typeof LEAD_TASK_TEMPLATES[0]) => {
    const now = new Date();
    const targetMs = now.getTime() + tmpl.hours * 3600 * 1000;
    const dueDate = new Date(targetMs).toISOString().split('T')[0];
    const dueTime = new Date(targetMs).toTimeString().slice(0, 5);

    const newTask: Partial<CalendarTask> = {
      id: `task-lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      taskId: `task-lead-${Date.now()}`,
      title: tmpl.name,
      taskName: tmpl.name,
      description: tmpl.desc,
      status: 'TO_DO',
      priority: tmpl.priority,
      importance: tmpl.priority === 'URGENT' ? 'URGENT' : tmpl.priority === 'HIGH' ? 'IMPORTANT' : 'NORMAL',
      category: 'CLIENT_FOLLOW_UP',
      assignedDepartment: 'SALES',
      assignedToName: lead.assignedToName || currentUser?.name || 'Sales Team',
      assignedToEmail: lead.assignedToEmail || currentUser?.email || 'sales@theunbound.in',
      assignedTo: lead.assignedToName || currentUser?.name || 'Sales Team',
      createdBy: currentUser?.name || 'Sales Specialist',
      startDate: dueDate,
      startTime: dueTime,
      dueDate,
      dueTime,
      dueAt: new Date(targetMs).toISOString(),
      relatedEntityType: 'lead',
      relatedEntityId: lead.id,
      relatedEntityReference: lead.leadNumber,
      leadId: lead.id,
      leadNumber: lead.leadNumber,
      customerName: lead.contactName,
      customerEmail: lead.email,
      destination: lead.destinationName || lead.destination,
      targetRoute: `/admin/leads?id=${lead.id}`,
      source: 'lead_record',
      isCustomerFacing: false,
      isInternal: true,
      isSyncedToGoogleCalendar: false
    };

    db.saveCalendarTask(newTask as CalendarTask, currentUser);
  };

  const handleSaveModalTask = (taskData: Partial<CalendarTask>) => {
    const updatedTask: CalendarTask = {
      ...(taskToEdit || {}),
      ...taskData,
      id: taskToEdit?.id || `task-lead-${Date.now()}`,
      relatedEntityType: 'lead',
      relatedEntityId: lead.id,
      relatedEntityReference: lead.leadNumber,
      leadId: lead.id,
      leadNumber: lead.leadNumber,
      customerName: lead.contactName,
      customerEmail: lead.email,
      destination: lead.destinationName || lead.destination,
      targetRoute: `/admin/leads?id=${lead.id}`,
      source: taskToEdit?.source || 'lead_record',
      isInternal: true,
      isCustomerFacing: false,
      isSyncedToGoogleCalendar: false,
      createdAt: taskToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as CalendarTask;

    db.saveCalendarTask(updatedTask, currentUser);
    setIsModalOpen(false);
    setTaskToEdit(null);
  };

  return (
    <div className="space-y-5" id="lead-tasks-section">
      {/* 1. LEAD TASK SUMMARY METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Tasks</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-slate-900">{summary.totalTasks}</span>
            <span className="text-[11px] text-slate-400">logged</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Open Tasks</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-amber-600">{summary.openTasksCount}</span>
            <span className="text-[11px] text-slate-400">pending</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">Due Today</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-blue-600">{summary.dueTodayCount}</span>
            <span className="text-[11px] text-slate-400">today</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">Overdue</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-rose-600">{summary.overdueCount}</span>
            <span className="text-[11px] text-slate-400">action req.</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Completed</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-emerald-600">{summary.completedTasksCount}</span>
            <span className="text-[11px] text-slate-400">done</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#008f77] uppercase tracking-wider block">Assigned to Me</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-black text-[#008f77]">{summary.myTasksCount}</span>
            <span className="text-[11px] text-slate-400">mine</span>
          </div>
        </div>
      </div>

      {/* Next Upcoming & Last Completed Insight Banner */}
      {(summary.nextUpcomingTask || summary.lastCompletedTask) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.nextUpcomingTask && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/40 p-3.5 rounded-2xl border border-amber-200/80 flex items-start gap-3 text-xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Next Upcoming Task</span>
                <p className="font-bold text-slate-900 truncate">{summary.nextUpcomingTask.title || summary.nextUpcomingTask.taskName}</p>
                <div className="text-[11px] text-slate-600 flex items-center gap-2">
                  <span>Due: <strong>{summary.nextUpcomingTask.dueDate || summary.nextUpcomingTask.startDate} at {summary.nextUpcomingTask.dueTime || summary.nextUpcomingTask.startTime}</strong></span>
                  <span>•</span>
                  <span>Assignee: <strong>{summary.nextUpcomingTask.assignedToName || 'Unassigned'}</strong></span>
                </div>
              </div>
            </div>
          )}

          {summary.lastCompletedTask && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50/40 p-3.5 rounded-2xl border border-emerald-200/80 flex items-start gap-3 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Last Completed Task</span>
                <p className="font-bold text-slate-900 truncate">{summary.lastCompletedTask.title || summary.lastCompletedTask.taskName}</p>
                <div className="text-[11px] text-slate-600 flex items-center gap-2">
                  <span>Completed by: <strong>{summary.lastCompletedTask.completedBy || 'Staff'}</strong></span>
                  <span>•</span>
                  <span>{new Date(summary.lastCompletedTask.completedAt || summary.lastCompletedTask.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. ACTIONS BAR & QUICK TEMPLATES */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {canCreate ? (
              <>
                <button
                  id="lead-add-task-btn"
                  onClick={() => {
                    setTaskToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Task</span>
                </button>

                <button
                  onClick={() => setShowTemplates(prev => !prev)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Quick Templates</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-400 italic">View-only task access</span>
            )}
          </div>

          {onNavigateToTasks && (
            <button
              onClick={onNavigateToTasks}
              className="text-xs font-semibold text-[#008f77] hover:text-[#00705d] flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>Open in Central Tasks & Follow-Ups</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick 1-Click Templates Drawer */}
        {showTemplates && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 mb-2">Click any template to schedule a pre-configured sales follow-up task instantly:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {LEAD_TASK_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickCreateTemplate(tmpl)}
                  className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-[#00C6A6] hover:bg-emerald-50/40 bg-slate-50/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs group-hover:text-[#008f77]">{tmpl.name}</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                      tmpl.priority === 'URGENT' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      +{tmpl.hours}h
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{tmpl.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks by name or assignee..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#00C6A6]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('OPEN')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                statusFilter === 'OPEN' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Open ({summary.openTasksCount})
            </button>
            <button
              onClick={() => setStatusFilter('OVERDUE')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                statusFilter === 'OVERDUE' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Overdue ({summary.overdueCount})
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                statusFilter === 'COMPLETED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Done ({summary.completedTasksCount})
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({summary.totalTasks})
            </button>
          </div>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">Important</option>
            <option value="NORMAL">Normal</option>
          </select>

          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Assignees</option>
            <option value="ME">Assigned to Me</option>
            <option value="UNASSIGNED">Unassigned</option>
          </select>
        </div>
      </div>

      {/* 3. TASK LIST VIEW */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
            <CheckSquare className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No tasks match the active filters</p>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Create a new task or choose one of the quick templates above to keep this lead moving toward confirmed booking.
            </p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const isCompleted = task.status === 'COMPLETED';
            const todayStr = new Date().toISOString().split('T')[0];
            const taskDate = task.dueDate || task.startDate || (task.dueAt ? task.dueAt.split('T')[0] : '');
            const isOverdue = !isCompleted && taskDate && taskDate < todayStr;
            const isDueToday = !isCompleted && taskDate === todayStr;

            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl border transition-all text-xs ${
                  isCompleted 
                    ? 'bg-slate-50/80 border-slate-200 opacity-75' 
                    : isOverdue 
                    ? 'bg-rose-50/40 border-rose-200 shadow-xs' 
                    : isDueToday
                    ? 'bg-amber-50/40 border-amber-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => {
                        if (canComplete) handleToggleComplete(task);
                      }}
                      disabled={!canComplete}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        !canComplete
                          ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50'
                          : isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white cursor-pointer'
                          : 'border-slate-300 hover:border-[#00C6A6] bg-white cursor-pointer'
                      }`}
                      title={!canComplete ? 'Permission required to complete tasks' : isCompleted ? 'Mark as Open' : 'Mark as Done'}
                    >
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-bold text-sm ${isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {task.title || task.taskName}
                        </span>

                        {/* Priority Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          task.priority === 'URGENT' 
                            ? 'bg-rose-100 text-rose-800' 
                            : task.priority === 'HIGH' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {task.priority === 'URGENT' ? 'Urgent' : task.priority === 'HIGH' ? 'Important' : 'Normal'}
                        </span>

                        {/* Source Badge */}
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md">
                          {task.source === 'automatic' ? 'Automatic follow-up' : 'Lead follow-up'}
                        </span>

                        {isOverdue && (
                          <span className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        )}
                        {isDueToday && (
                          <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                            Due Today
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-slate-600 text-xs leading-relaxed">{task.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Due: <strong className="text-slate-800">{taskDate || 'Flexible'} {task.dueTime || task.startTime || ''}</strong></span>
                        </span>

                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>Assigned: <strong className="text-slate-800">{task.assignedToName || 'Unassigned'}</strong></span>
                        </span>

                        {task.completedAt && (
                          <span className="text-emerald-700 font-medium">
                            Completed {new Date(task.completedAt).toLocaleDateString()} by {task.completedBy || 'Staff'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canEdit && (
                      <button
                        onClick={() => {
                          setTaskToEdit(task);
                          setIsModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    )}

                    {canComplete && (
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                          isCompleted 
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isCompleted ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>{isCompleted ? 'Reopen' : 'Done'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Task Modal */}
      {isModalOpen && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setTaskToEdit(null);
          }}
          onSave={handleSaveModalTask}
          taskToEdit={taskToEdit}
          currentUser={currentUser}
          initialRelatedType="LEAD"
          initialRelatedId={lead.id}
        />
      )}
    </div>
  );
};
