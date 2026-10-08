import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  Users, 
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  PlusCircle,
  Flag
} from 'lucide-react';
import { B2BTask } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../services/toastService';

export const B2BTasksManagerView: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const tasks = useMemo(() => {
    return db.getB2BTasks(user?.id);
  }, [db, user, refreshTrigger]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED'>('OVERDUE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<B2BTask | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    priority: 'HIGH' as const,
    relatedCustomerName: ''
  });

  // Categorized tasks
  const { overdueTasks, todayTasks, upcomingTasks, completedTasks } = useMemo(() => {
    const overdue: B2BTask[] = [];
    const today: B2BTask[] = [];
    const upcoming: B2BTask[] = [];
    const completed: B2BTask[] = [];

    tasks.forEach(t => {
      if (t.status === 'COMPLETED') {
        completed.push(t);
      } else if (t.dueDate && t.dueDate < todayStr) {
        overdue.push(t);
      } else if (t.dueDate && t.dueDate === todayStr) {
        today.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return { overdueTasks: overdue, todayTasks: today, upcomingTasks: upcoming, completedTasks: completed };
  }, [tasks, todayStr]);

  const currentTabTasks = useMemo(() => {
    let list: B2BTask[] = [];
    if (activeTab === 'OVERDUE') list = overdueTasks;
    else if (activeTab === 'TODAY') list = todayTasks;
    else if (activeTab === 'UPCOMING') list = upcomingTasks;
    else if (activeTab === 'COMPLETED') list = completedTasks;

    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(t => 
      (t.title || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.relatedCustomerName && (t.relatedCustomerName || '').toLowerCase().includes(q))
    );
  }, [activeTab, overdueTasks, todayTasks, upcomingTasks, completedTasks, searchQuery]);

  const toggleTaskStatus = (task: B2BTask) => {
    const isCompleted = task.status === 'COMPLETED';
    const updated: B2BTask = {
      ...task,
      status: isCompleted ? 'PENDING' : 'COMPLETED',
      updatedAt: new Date().toISOString()
    };
    db.saveB2BTask(updated);
    if (!isCompleted) {
      toast.success('Task Completed', `"${task.title}" marked as complete.`);
    } else {
      toast.info('Task Reopened', `"${task.title}" reopened.`);
    }
    setRefreshTrigger(prev => prev + 1);
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      priority: 'HIGH',
      relatedCustomerName: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: B2BTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate || todayStr,
      priority: task.priority || 'HIGH',
      relatedCustomerName: task.relatedCustomerName || ''
    });
    setIsModalOpen(true);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    if (editingTask) {
      const updated: B2BTask = {
        ...editingTask,
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        priority: formData.priority,
        relatedCustomerName: formData.relatedCustomerName,
        updatedAt: new Date().toISOString()
      };
      db.saveB2BTask(updated);
      toast.success('Reminder Updated', `"${formData.title}" updated.`);
    } else {
      const newTask: B2BTask = {
        id: `task-${Date.now()}`,
        agentId: user?.id || 'usr-agent-01',
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        priority: formData.priority,
        status: 'PENDING',
        relatedCustomerName: formData.relatedCustomerName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.saveB2BTask(newTask);
      toast.success('Reminder Created', `"${formData.title}" saved.`);
    }

    setIsModalOpen(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDeleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    db.deleteB2BTask(id);
    toast.info('Reminder Deleted', task ? `"${task.title}" deleted.` : 'Task removed.');
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="w-full max-w-full min-w-0 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
              Ground SLA & Follow-Up Reminders
            </span>
            <span className="text-xs text-slate-400 font-mono">({tasks.length} Total Reminders)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">My Tasks & Operational Action Register</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Track client proposal expirations, hotel allotment cut-offs, passport uploads, and ground confirmations.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <span>Add New Reminder</span>
        </button>
      </div>

      {/* 4 Categorized Tabs with Real Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          {/* Overdue (Strictly RED) */}
          <button
            onClick={() => setActiveTab('OVERDUE')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue Tasks</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'OVERDUE' ? 'bg-white text-rose-600' : 'bg-rose-600 text-white'
            }`}>
              {overdueTasks.length}
            </span>
          </button>

          {/* Due Today */}
          <button
            onClick={() => setActiveTab('TODAY')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'TODAY'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Due Today</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
              {todayTasks.length}
            </span>
          </button>

          {/* Upcoming */}
          <button
            onClick={() => setActiveTab('UPCOMING')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'UPCOMING'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Upcoming</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
              {upcomingTasks.length}
            </span>
          </button>

          {/* Completed */}
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Completed</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
              {completedTasks.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
          />
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {currentTabTasks.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/90 shadow-xs space-y-2">
            <CheckSquare className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No tasks in this category</h3>
            <p className="text-xs text-slate-400">All follow-ups in this register have been addressed.</p>
          </div>
        ) : (
          currentTabTasks.map(task => {
            const isCompleted = task.status === 'COMPLETED';
            const isOverdue = !isCompleted && task.dueDate && task.dueDate < todayStr;

            return (
              <div
                key={task.id}
                className={`bg-white rounded-2xl p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs ${
                  isOverdue
                    ? 'border-rose-300 bg-rose-50/20'
                    : isCompleted
                    ? 'border-slate-200/60 bg-slate-50/60 opacity-80'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Left: Checkbox & Info */}
                <div className="flex items-start space-x-3.5 flex-1">
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 hover:border-slate-500 bg-white'
                    }`}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h4 className={`text-sm font-extrabold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.title}
                      </h4>
                      {task.priority === 'HIGH' && (
                        <span className="px-2 py-0.2 rounded-md bg-rose-100 text-rose-800 font-bold text-[9px] uppercase">
                          High Priority
                        </span>
                      )}
                      {isOverdue && (
                        <span className="px-2 py-0.2 rounded-md bg-rose-600 text-white font-black text-[9px] uppercase animate-pulse">
                          Overdue
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{task.description}</p>
                    )}

                    <div className="flex items-center space-x-4 text-[11px] text-slate-500 pt-1">
                      <span className={`flex items-center space-x-1 font-mono font-medium ${isOverdue ? 'text-rose-600 font-bold' : ''}`}>
                        <Calendar className="w-3 h-3" />
                        <span>Due: {task.dueDate || 'No date set'}</span>
                      </span>
                      {task.relatedCustomerName && (
                        <span className="flex items-center space-x-1 text-slate-600">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>Guest: {task.relatedCustomerName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleOpenEdit(task)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Edit Task"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Red Delete Button */}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Reminder (Permanent)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Task Modal (Fits Viewport, Fixed Header/Footer, Scrollable via Portal) */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[90vh] overflow-hidden animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <h2 className="text-base font-black text-slate-900 font-sans">
                {editingTask ? 'Edit Action Reminder' : 'Add New Action Reminder'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="taskForm" onSubmit={handleSaveTask} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Confirm Room Allocation with Tokyo Capitol"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Priority Level</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                  >
                    <option value="HIGH">High Priority (Urgent)</option>
                    <option value="MEDIUM">Standard</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Related Lead / Guest Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Alistair Finch / Proposal #TUB-QUO-082"
                  value={formData.relatedCustomerName}
                  onChange={(e) => setFormData({ ...formData, relatedCustomerName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Notes & Details</label>
                <textarea
                  rows={3}
                  placeholder="Add specific instructions, hotel cutoff deadlines, passport numbers or room notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
                ></textarea>
              </div>
            </form>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="taskForm"
                className="px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00a88d] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
              >
                {editingTask ? 'Update Reminder' : 'Save Reminder'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
