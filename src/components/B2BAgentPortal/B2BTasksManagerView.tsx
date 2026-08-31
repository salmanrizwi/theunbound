import React, { useState, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { B2BTask } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

export const B2BTasksManagerView: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const tasks = useMemo(() => {
    return db.getB2BTasks(user?.id);
  }, [db, user, refreshTrigger]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    priority: 'HIGH' as const,
    relatedCustomerName: ''
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.relatedCustomerName && t.relatedCustomerName.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesFilter = true;
      if (selectedFilter === 'PENDING') matchesFilter = t.status !== 'COMPLETED';
      if (selectedFilter === 'COMPLETED') matchesFilter = t.status === 'COMPLETED';

      return matchesSearch && matchesFilter;
    });
  }, [tasks, searchQuery, selectedFilter]);

  const toggleTaskStatus = (task: B2BTask) => {
    const updated: B2BTask = {
      ...task,
      status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
      updatedAt: new Date().toISOString()
    };
    db.saveB2BTask(updated);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

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
    setIsAddModalOpen(false);
    setFormData({
      title: '',
      description: '',
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      priority: 'HIGH',
      relatedCustomerName: ''
    });
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDeleteTask = (id: string) => {
    db.deleteB2BTask(id);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
              Client Follow-Ups & Ground Operations
            </span>
            <span className="text-xs text-slate-400">({tasks.length} Total Reminders)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Agent Follow-Up Action Register</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Never miss a proposal validity deadline, hotel cut-off date, or client room preference confirmation.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Reminder</span>
        </button>
      </div>

      {/* Filter Strip */}
      <div className="flex items-center space-x-2">
        {(['ALL', 'PENDING', 'COMPLETED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedFilter === f
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'ALL' ? 'All Reminders' : f === 'PENDING' ? 'Pending Actions' : 'Completed'}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No reminders found. All actions are cleared!
          </div>
        ) : (
          filteredTasks.map(task => {
            const isCompleted = task.status === 'COMPLETED';
            return (
              <div
                key={task.id}
                className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                  isCompleted ? 'bg-slate-50/60 opacity-60' : 'hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 hover:border-[#00C6A6]'
                    }`}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className={`text-xs font-bold text-slate-900 ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                        {task.title}
                      </h4>
                      <span className={`px-2 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                        task.priority === 'URGENT' || task.priority === 'HIGH'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {task.priority}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      {task.description}
                    </p>

                    <div className="flex items-center space-x-4 text-[11px] text-slate-400 pt-1">
                      {task.relatedCustomerName && (
                        <span className="flex items-center space-x-1 font-medium text-slate-600">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>Client: {task.relatedCustomerName}</span>
                        </span>
                      )}

                      <span className="flex items-center space-x-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Due: {task.dueDate}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTask}
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in fade-in zoom-in-95"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add New Follow-Up Action</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Action Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Confirm VIP Hakone Ryokan Suite availability"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Details & Remarks</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Follow up with client regarding dinner kaiseki dietary restrictions..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Related Client Name</label>
                <input
                  type="text"
                  value={formData.relatedCustomerName}
                  onChange={(e) => setFormData({ ...formData, relatedCustomerName: e.target.value })}
                  placeholder="Lord Alexander Wright"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-[#00C6A6]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Save Reminder
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
