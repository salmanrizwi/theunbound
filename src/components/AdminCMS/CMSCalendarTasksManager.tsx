import React, { useState, useMemo, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  CalendarTask, 
  User, 
  SLAAutomationRule, 
  SLAAutomationAuditLog, 
  SLATaskType, 
  SLAStatus, 
  TaskStatus 
} from '../../types';
import { googleCalendarAutomation } from '../../services/googleCalendarAutomationService';
import { googleAuth } from '../../services/googleAuth';
import { 
  Calendar, 
  CheckCircle2, 
  Plus, 
  Search, 
  UserCheck, 
  ChevronRight,
  RefreshCw,
  Clock,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Zap,
  Sliders,
  History,
  ExternalLink,
  Edit2,
  Trash2,
  Building2,
  Mail,
  Bell,
  Play,
  Check,
  X,
  FileText,
  User as UserIcon,
  ArrowRight,
  Layers,
  Sparkles
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
  const [activeTab, setActiveTab] = useState<'TASKS' | 'RULES' | 'LOGS'>('TASKS');
  
  // Data state
  const [tasks, setTasks] = useState<CalendarTask[]>(() => db.getCalendarTasks());
  const [rules, setRules] = useState<SLAAutomationRule[]>(() => db.getSLAAutomationRules());
  const [auditLogs, setAuditLogs] = useState<SLAAutomationAuditLog[]>(() => db.getSLAAutomationAuditLogs());

  // Task filtering state
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterSlaStatus, setFilterSlaStatus] = useState<string>('ALL');
  const [filterTaskType, setFilterTaskType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Actions state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<SLAAutomationRule | null>(null);
  const [testingRule, setTestingRule] = useState<SLAAutomationRule | null>(null);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskType, setNewTaskType] = useState<SLATaskType>('BOOKING_CONFIRMATION');
  const [newTaskPriority, setNewTaskPriority] = useState<CalendarTask['priority']>('HIGH');
  const [newTaskSlaHours, setNewTaskSlaHours] = useState(12);
  const [newTaskAssigneeName, setNewTaskAssigneeName] = useState('Marcus Vance');
  const [newTaskAssigneeEmail, setNewTaskAssigneeEmail] = useState('business@theunbound.in');
  const [newTaskDepartment, setNewTaskDepartment] = useState<'OPERATIONS' | 'SALES' | 'GROUND_OPS'>('OPERATIONS');
  const [newTaskBookingRef, setNewTaskBookingRef] = useState('');
  const [newTaskQuoteNum, setNewTaskQuoteNum] = useState('');

  // Auto-refresh periodically to re-calculate SLA countdowns in real-time
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // 30s live ticker
    const unsubscribe = db.subscribe(() => {
      refreshAll();
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [db]);

  const refreshAll = () => {
    setTasks(db.getCalendarTasks());
    setRules(db.getSLAAutomationRules());
    setAuditLogs(db.getSLAAutomationAuditLogs());
  };

  const showToast = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // -------------------------------------------------------------
  // TASK ACTIONS
  // -------------------------------------------------------------
  const handleToggleTaskStatus = async (task: CalendarTask) => {
    const updatedStatus: TaskStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    await googleCalendarAutomation.updateTaskStatus(task.id, updatedStatus, currentUser);
    refreshAll();
    showToast(`Task marked as ${updatedStatus}`);
  };

  const handleManualCalendarSync = async (task: CalendarTask) => {
    setIsSyncingCalendar(task.id);
    try {
      const res = await googleCalendarAutomation.syncTaskToGoogleCalendar(task);
      refreshAll();
      if (res.success) {
        showToast(`Successfully synchronized to Google Calendar (${res.eventId})`);
      } else {
        showToast(`Sync note: ${res.error || 'Check Google Calendar connection'}`);
      }
    } catch (err: any) {
      showToast(`Sync error: ${err.message}`);
    } finally {
      setIsSyncingCalendar(null);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to remove this operational SLA task?')) {
      db.deleteCalendarTask(taskId, currentUser);
      refreshAll();
      showToast('Task removed.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const now = new Date();
    const generatedAt = now.toISOString();
    const dueAt = new Date(now.getTime() + newTaskSlaHours * 60 * 60 * 1000).toISOString();

    const task: CalendarTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || 'Manual operational SLA task assigned from CMS Tasks Engine.',
      taskType: newTaskType,
      category: 'OPERATIONS_SLA',
      priority: newTaskPriority,
      status: 'PENDING',
      slaHours: newTaskSlaHours,
      generatedAt,
      dueAt,
      slaStatus: 'WITHIN_SLA',
      startDate: dueAt.split('T')[0],
      startTime: dueAt.split('T')[1].substring(0, 5),
      assignedToName: newTaskAssigneeName,
      assignedToEmail: newTaskAssigneeEmail,
      assignedDepartment: newTaskDepartment,
      bookingReference: newTaskBookingRef.trim() || undefined,
      quoteNumber: newTaskQuoteNum.trim() || undefined,
      googleCalendarId: 'primary',
      isSyncedToGoogleCalendar: false,
      calendarSyncStatus: 'NOT_SYNCED',
      createdAt: generatedAt,
      updatedAt: generatedAt
    };

    const saved = db.saveCalendarTask(task, currentUser);
    
    // Sync to Google Calendar
    try {
      await googleCalendarAutomation.syncTaskToGoogleCalendar(saved);
    } catch (err) {
      console.debug('Calendar sync note:', err);
    }

    refreshAll();
    setShowCreateModal(false);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskBookingRef('');
    setNewTaskQuoteNum('');
    showToast('Task created and scheduled in Google Calendar.');
  };

  // -------------------------------------------------------------
  // RULE ACTIONS
  // -------------------------------------------------------------
  const handleToggleRule = (rule: SLAAutomationRule) => {
    const updated: SLAAutomationRule = {
      ...rule,
      isEnabled: !rule.isEnabled,
      updatedAt: new Date().toISOString()
    };
    db.saveSLAAutomationRule(updated, currentUser);
    refreshAll();
    showToast(`Rule "${rule.ruleName}" is now ${updated.isEnabled ? 'ENABLED' : 'DISABLED'}`);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    db.saveSLAAutomationRule(editingRule, currentUser);
    setEditingRule(null);
    refreshAll();
    showToast(`Updated rule settings for "${editingRule.ruleName}"`);
  };

  const handleExecuteSimulatedTrigger = async (rule: SLAAutomationRule) => {
    const mockRef = rule.taskType === 'QUOTE_FOLLOW_UP' ? `Q-${Math.floor(1000 + Math.random() * 9000)}` : `B-${Math.floor(10000 + Math.random() * 90000)}`;
    const mockClient = 'Test Traveler (CMS Diagnostic)';
    
    try {
      const triggeredTask = await googleCalendarAutomation.triggerSLA({
        triggerEvent: rule.triggerEvent,
        taskType: rule.taskType,
        bookingReference: rule.taskType !== 'QUOTE_FOLLOW_UP' ? mockRef : undefined,
        quoteNumber: rule.taskType === 'QUOTE_FOLLOW_UP' ? mockRef : undefined,
        clientName: mockClient,
        destination: 'Tokyo & Kyoto, Japan',
        notes: `Simulated trigger execution from SLA Rules Manager testing workbench. Rule: ${rule.ruleName}`,
        currentUser
      });

      refreshAll();
      setTestingRule(null);
      if (triggeredTask) {
        showToast(`Triggered SLA task "${triggeredTask.title}" and scheduled Google Calendar event!`);
      } else {
        showToast('Rule skipped or task already exists.');
      }
    } catch (err: any) {
      showToast(`Trigger error: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // COMPUTED STATS & FILTERED TASKS
  // -------------------------------------------------------------
  const processedTasks = useMemo(() => {
    return tasks.map(t => {
      const dynamicSLA = googleCalendarAutomation.calculateSLAStatus(t);
      return {
        ...t,
        slaStatus: dynamicSLA.slaStatus,
        slaRemainingMs: dynamicSLA.remainingMs,
        slaFormatted: dynamicSLA.formattedTimeText
      };
    });
  }, [tasks, tick]);

  const filteredTasks = useMemo(() => {
    return processedTasks.filter(t => {
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (filterSlaStatus !== 'ALL' && t.slaStatus !== filterSlaStatus) return false;
      if (filterTaskType !== 'ALL' && t.taskType !== filterTaskType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignedToName.toLowerCase().includes(q) ||
          t.assignedToEmail.toLowerCase().includes(q) ||
          (t.bookingReference && t.bookingReference.toLowerCase().includes(q)) ||
          (t.quoteNumber && t.quoteNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [processedTasks, filterStatus, filterSlaStatus, filterTaskType, searchQuery]);

  const stats = useMemo(() => {
    const total = processedTasks.length;
    const active = processedTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
    const overdue = active.filter(t => t.slaStatus === 'OVERDUE').length;
    const dueSoon = active.filter(t => t.slaStatus === 'DUE_SOON').length;
    const completed = processedTasks.filter(t => t.status === 'COMPLETED').length;
    const syncedToCalendar = processedTasks.filter(t => t.isSyncedToGoogleCalendar).length;
    
    return {
      total,
      activeCount: active.length,
      overdue,
      dueSoon,
      completed,
      syncedToCalendar
    };
  }, [processedTasks]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {actionSuccessMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-teal-500/40 flex items-center space-x-3 text-xs font-bold animate-in fade-in slide-in-from-top-3 duration-200">
          <Sparkles className="w-4 h-4 text-[#00E5C0]" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#008972] bg-[#008972]/10 px-3 py-1 rounded-full border border-[#008972]/20 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-[#008972]" />
                Google Calendar & Ground SLA Engine
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                TheUnbound Firestore Source of Truth
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Calendar & Ground SLA Automation Manager
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Real-time operational SLA tracking, automated 12-hour booking confirmation events, 24-hour quote follow-ups, team roster assignments, and Google Calendar event sync.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="cms-schedule-task-btn"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-[#008972] hover:bg-[#00705d] text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create SLA Task</span>
            </button>
            <button
              onClick={refreshAll}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Refresh Everything"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active SLA Queue</div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">{stats.activeCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{stats.total} total recorded</div>
          </div>

          <div 
            onClick={() => setFilterSlaStatus('OVERDUE')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              stats.overdue > 0 ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200' : 'bg-rose-50/50 border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Overdue SLA</span>
              {stats.overdue > 0 && <Flame className="w-3.5 h-3.5 text-rose-600 animate-pulse" />}
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-900 mt-1">{stats.overdue}</div>
            <div className="text-[10px] text-rose-600 font-bold mt-0.5">Requires immediate action</div>
          </div>

          <div 
            onClick={() => setFilterSlaStatus('DUE_SOON')}
            className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 cursor-pointer hover:bg-amber-100/60 transition-colors"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Due Soon (&lt; 3h)</div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-900 mt-1">{stats.dueSoon}</div>
            <div className="text-[10px] text-amber-700 mt-0.5">High attention</div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Completed</div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-900 mt-1">{stats.completed}</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">Operations fulfilled</div>
          </div>

          <div className="p-3.5 bg-teal-50/70 rounded-2xl border border-teal-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Google Calendar</div>
            <div className="text-xl sm:text-2xl font-extrabold text-teal-900 mt-1">{stats.syncedToCalendar}</div>
            <div className="text-[10px] text-teal-700 font-bold mt-0.5">Live Events Synced</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('TASKS')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'TASKS' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Operations Tasks (Live Queue)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'TASKS' ? 'bg-slate-800 text-teal-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {filteredTasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('RULES')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'RULES' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>SLA Automation Rules & Engine</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'RULES' ? 'bg-slate-800 text-teal-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {rules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'LOGS' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Automation Audit Logs</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'LOGS' ? 'bg-slate-800 text-teal-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {auditLogs.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OPERATIONS TASKS (LIVE QUEUE) */}
      {/* ========================================================================= */}
      {activeTab === 'TASKS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search booking ref, quote, assignee, notes..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#008972]"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterSlaStatus}
                onChange={(e) => setFilterSlaStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-hidden"
              >
                <option value="ALL">All SLA Statuses</option>
                <option value="OVERDUE">Overdue (Breached)</option>
                <option value="DUE_SOON">Due Soon (&lt; 3h)</option>
                <option value="WITHIN_SLA">Within SLA (Safe)</option>
                <option value="COMPLETED">Completed</option>
              </select>

              <select
                value={filterTaskType}
                onChange={(e) => setFilterTaskType(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-hidden"
              >
                <option value="ALL">All Task Types</option>
                <option value="BOOKING_CONFIRMATION">Booking Confirmation (12h)</option>
                <option value="QUOTE_FOLLOW_UP">Quote Follow-Up (24h)</option>
                <option value="TRANSFER_CONFIRMATION">Transfer Confirmation (6h)</option>
                <option value="HOTEL_CONFIRMATION">Hotel Confirmation (12h)</option>
                <option value="ACTIVITY_CONFIRMATION">Activity Confirmation (12h)</option>
                <option value="GUIDE_ASSIGNMENT">Guide Assignment (24h)</option>
                <option value="DRIVER_ASSIGNMENT">Driver Assignment (12h)</option>
                <option value="SUPPLIER_FOLLOW_UP">Supplier Follow-Up (24h)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-hidden"
              >
                <option value="ALL">All Action Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Task Cards List */}
          <div className="divide-y divide-slate-100 pt-2">
            {filteredTasks.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Calendar className="w-10 h-10 mx-auto text-slate-300 opacity-80" />
                <p className="text-sm font-semibold text-slate-600">No operational tasks match your selected criteria.</p>
                <p className="text-xs text-slate-400">Tasks are automatically created whenever a booking is placed or a PDF quotation is downloaded.</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const isCompleted = task.status === 'COMPLETED';
                const isOverdue = task.slaStatus === 'OVERDUE' && !isCompleted;
                const isDueSoon = task.slaStatus === 'DUE_SOON' && !isCompleted;

                return (
                  <div 
                    key={task.id} 
                    className={`py-4 px-3.5 my-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4 group transition-all rounded-2xl border ${
                      isCompleted 
                        ? 'bg-slate-50/70 border-slate-100 opacity-80' 
                        : isOverdue 
                        ? 'bg-rose-50/40 border-rose-200 hover:bg-rose-50/70' 
                        : isDueSoon 
                        ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/70' 
                        : 'bg-white border-slate-200/80 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                      {/* Checkbox toggle */}
                      <button
                        onClick={() => handleToggleTaskStatus(task)}
                        title={isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-1 transition-all cursor-pointer ${
                          isCompleted 
                            ? 'bg-emerald-500 border-emerald-600 text-white' 
                            : isOverdue 
                            ? 'border-rose-400 bg-white text-transparent hover:text-rose-400' 
                            : 'border-slate-300 hover:border-[#008972] bg-white text-transparent hover:text-slate-300'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`text-xs sm:text-sm font-extrabold ${isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                            {task.title}
                          </h4>

                          {/* SLA Badge */}
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                            isCompleted 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : isOverdue 
                              ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' 
                              : isDueSoon 
                              ? 'bg-amber-100 text-amber-800 border-amber-300' 
                              : 'bg-teal-50 text-teal-800 border-teal-200'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{task.slaFormatted}</span>
                          </span>

                          {/* Task Type Badge */}
                          <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {(task.taskType || 'OPERATIONAL').replace(/_/g, ' ')}
                          </span>

                          {/* Google Calendar Sync Badge */}
                          {task.isSyncedToGoogleCalendar ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 text-teal-600" />
                              <span>Google Calendar</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200">
                              Local Queue
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 pt-1">
                          <span className="flex items-center space-x-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Due: <strong>{task.dueAt ? new Date(task.dueAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : `${task.startDate} ${task.startTime}`}</strong></span>
                          </span>

                          <span className="flex items-center space-x-1.5 font-medium">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            <span>Assignee: <strong>{task.assignedToName}</strong> ({task.assignedToEmail})</span>
                          </span>

                          {task.assignedDepartment && (
                            <span className="flex items-center space-x-1 font-bold text-slate-600">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{task.assignedDepartment}</span>
                            </span>
                          )}

                          {task.bookingReference && (
                            <span className="font-mono font-bold text-[#008972]">
                              Ref: {task.bookingReference}
                            </span>
                          )}

                          {task.quoteNumber && (
                            <span className="font-mono font-bold text-indigo-600">
                              Quote: {task.quoteNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right action buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                      {task.googleCalendarLink && (
                        <a
                          href={task.googleCalendarLink}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg transition-colors flex items-center space-x-1 border border-teal-200"
                        >
                          <span>Calendar Event</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {!task.isSyncedToGoogleCalendar && (
                        <button
                          onClick={() => handleManualCalendarSync(task)}
                          disabled={isSyncingCalendar === task.id}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition-colors flex items-center space-x-1 border border-amber-200 disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isSyncingCalendar === task.id ? 'animate-spin' : ''}`} />
                          <span>Sync to Calendar</span>
                        </button>
                      )}

                      {task.bookingReference && onNavigateToBooking && (
                        <button
                          onClick={() => onNavigateToBooking(task.bookingReference!)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center space-x-1"
                        >
                          <span>Booking</span>
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
                        {isCompleted ? 'Mark Pending' : 'Complete SLA'}
                      </button>

                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SLA AUTOMATION RULES & ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'RULES' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Configured Automation Rules & Schedules</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Business rules automatically trigger Google Calendar events, calculate SLA targets, and dispatch email/popup alerts to designated duty managers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map(rule => (
                <div 
                  key={rule.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    rule.isEnabled ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          rule.isEnabled ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {rule.isEnabled ? 'ACTIVE RULE' : 'DISABLED'}
                        </span>
                        <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {rule.slaHours}h SLA Deadline
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900">{rule.ruleName}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Trigger: {rule.triggerEvent}
                      </p>
                    </div>

                    {/* Enable Toggle Switch */}
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        rule.isEnabled ? 'bg-[#008972]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          rule.isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Rule details */}
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Default Assignee:</span>
                      <span className="font-bold text-slate-800">{rule.defaultAssignee.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Assignee Email:</span>
                      <span className="font-mono text-slate-700">{rule.defaultAssignee.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Department:</span>
                      <span className="font-bold text-slate-800">{rule.department}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Title Template:</span>
                      <span className="font-mono text-[11px] text-slate-700 truncate max-w-[200px]" title={rule.titleTemplate}>
                        {rule.titleTemplate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Calendar Reminders:</span>
                      <span className="font-medium text-slate-700">
                        {rule.reminders.map(r => `${r.minutesBefore / 60}h (${r.method})`).join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Rule Action Buttons */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleExecuteSimulatedTrigger(rule)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-[#008972]" />
                      <span>Test Trigger</span>
                    </button>
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Rule</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUTOMATION AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">SLA Automation Audit Log Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable chronological event trail of SLA triggers, team assignments, deadline computations, and Google Calendar event syncs.
              </p>
            </div>
            <button
              onClick={refreshAll}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 pt-2">
            {auditLogs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <History className="w-10 h-10 mx-auto text-slate-300 opacity-80" />
                <p className="text-sm font-semibold text-slate-600">No automation logs recorded yet.</p>
                <p className="text-xs text-slate-400">Audit logs are registered whenever website events trigger SLA automation rules.</p>
              </div>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-slate-900">{log.automationRuleName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-slate-100 text-slate-600">
                        {log.triggerEvent}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md ${
                        log.calendarSyncStatus === 'SYNCED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Calendar: {log.calendarSyncStatus}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                      <span>Task: <strong>{log.taskId}</strong></span>
                      <span>Assigned to: <strong>{log.assignedUser}</strong></span>
                      <span>Deadline: <strong>{new Date(log.slaDeadline).toLocaleString()}</strong></span>
                      {log.googleCalendarEventId && (
                        <span>Google Event: <strong className="font-mono text-teal-700">{log.googleCalendarEventId}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 shrink-0 sm:text-right">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE MANUAL SLA TASK */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#008972]/10 text-[#008972] flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Schedule SLA & Calendar Task</h3>
                  <p className="text-[11px] text-slate-500">Creates operational task and syncs event to Google Calendar</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. [SLA] Ground Transfer Confirmation — B-9241"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-[#008972] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Task Type
                  </label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  >
                    <option value="BOOKING_CONFIRMATION">Booking Confirmation (12h)</option>
                    <option value="QUOTE_FOLLOW_UP">Quote Follow-Up (24h)</option>
                    <option value="TRANSFER_CONFIRMATION">Transfer Confirmation (6h)</option>
                    <option value="HOTEL_CONFIRMATION">Hotel Confirmation (12h)</option>
                    <option value="ACTIVITY_CONFIRMATION">Activity Confirmation (12h)</option>
                    <option value="GUIDE_ASSIGNMENT">Guide Assignment (24h)</option>
                    <option value="DRIVER_ASSIGNMENT">Driver Assignment (12h)</option>
                    <option value="SUPPLIER_FOLLOW_UP">Supplier Follow-Up (24h)</option>
                    <option value="CUSTOM">Custom Operational Task</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    SLA Window (Hours)
                  </label>
                  <select
                    value={newTaskSlaHours}
                    onChange={(e) => setNewTaskSlaHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  >
                    <option value={4}>4 Hours (High Urgency)</option>
                    <option value={6}>6 Hours (Ground Logistics)</option>
                    <option value={12}>12 Hours (Booking Confirmation SLA)</option>
                    <option value={24}>24 Hours (Quote Follow-Up SLA)</option>
                    <option value={48}>48 Hours (Standard)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assignee Name
                  </label>
                  <input
                    type="text"
                    value={newTaskAssigneeName}
                    onChange={(e) => setNewTaskAssigneeName(e.target.value)}
                    placeholder="e.g. Marcus Vance"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assignee Email
                  </label>
                  <input
                    type="email"
                    value={newTaskAssigneeEmail}
                    onChange={(e) => setNewTaskAssigneeEmail(e.target.value)}
                    placeholder="e.g. business@theunbound.in"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={newTaskDepartment}
                    onChange={(e) => setNewTaskDepartment(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  >
                    <option value="OPERATIONS">Operations</option>
                    <option value="SALES">Sales</option>
                    <option value="GROUND_OPS">Ground Ops</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Booking Ref
                  </label>
                  <input
                    type="text"
                    value={newTaskBookingRef}
                    onChange={(e) => setNewTaskBookingRef(e.target.value)}
                    placeholder="e.g. B-8841"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Quote #
                  </label>
                  <input
                    type="text"
                    value={newTaskQuoteNum}
                    onChange={(e) => setNewTaskQuoteNum(e.target.value)}
                    placeholder="e.g. Q-9021"
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
                  placeholder="Details on ground dispatch, chauffeur allocation, voucher status..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-[#008972] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#008972] hover:bg-[#00705d] rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT SLA AUTOMATION RULE */}
      {/* ========================================================================= */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5 text-[#00E5C0]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Edit SLA Automation Rule</h3>
                  <p className="text-[11px] text-slate-500">{editingRule.ruleName}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  value={editingRule.ruleName}
                  onChange={(e) => setEditingRule({ ...editingRule, ruleName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    SLA Window (Hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    required
                    value={editingRule.slaHours}
                    onChange={(e) => setEditingRule({ ...editingRule, slaHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={editingRule.department}
                    onChange={(e) => setEditingRule({ ...editingRule, department: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  >
                    <option value="OPERATIONS">OPERATIONS</option>
                    <option value="SALES">SALES</option>
                    <option value="GROUND_OPS">GROUND_OPS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assignee Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRule.defaultAssignee.name}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      defaultAssignee: { ...editingRule.defaultAssignee, name: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assignee Email
                  </label>
                  <input
                    type="email"
                    required
                    value={editingRule.defaultAssignee.email}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      defaultAssignee: { ...editingRule.defaultAssignee, email: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Title Template
                </label>
                <input
                  type="text"
                  required
                  value={editingRule.titleTemplate}
                  onChange={(e) => setEditingRule({ ...editingRule, titleTemplate: e.target.value })}
                  placeholder="e.g. [SLA] Booking Confirmation — {{bookingReference}}"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Available tags: <code>{'{{bookingReference}}'}</code>, <code>{'{{quoteNumber}}'}</code>, <code>{'{{clientName}}'}</code>
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
