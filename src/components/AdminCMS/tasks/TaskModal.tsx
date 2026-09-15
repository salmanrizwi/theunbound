import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, CheckSquare, Calendar, Clock, User as UserIcon, Users, 
  Link as LinkIcon, AlertTriangle, Repeat, Bell, Sparkles, FileText, Search,
  ExternalLink, RefreshCw, Trash2, CheckCircle2, ShieldCheck, AlertCircle,
  Briefcase, Plane, Hotel as HotelIcon, Car, Compass, Check, History
} from 'lucide-react';
import { CalendarTask, User, TaskImportance, TaskStatus, ActionCenterEntityType } from '../../../types';
import { db } from '../../../services/db';
import { SALES_TEMPLATES, SalesTemplate } from './taskConstants';
import { googleAuth } from '../../../services/googleAuth';
import { googleCalendarAutomation } from '../../../services/googleCalendarAutomationService';
import { toast } from '../../../services/toastService';

export interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<CalendarTask>) => void;
  taskToEdit?: CalendarTask | null;
  currentUser: User | null;
  initialRelatedType?: ActionCenterEntityType;
  initialRelatedId?: string;
  initialDate?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  taskToEdit,
  currentUser,
  initialRelatedType,
  initialRelatedId,
  initialDate
}) => {
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Retrieve existing business records for linking
  const allUsers = useMemo(() => db.getUsers(), []);
  const allLeads = useMemo(() => db.getLeads(), []);
  const allQuotes = useMemo(() => db.getAllSavedQuotes(), []);
  const allBookings = useMemo(() => db.getAllBookings(), []);
  const allSuppliers = useMemo(() => db.getSuppliers(), []);

  // Form State
  const [taskName, setTaskName] = useState(taskToEdit?.title || '');
  const [notes, setNotes] = useState(taskToEdit?.description || taskToEdit?.notes || '');
  
  // Assignment State
  const [assigneeMode, setAssigneeMode] = useState<'ME' | 'USER' | 'TEAM' | 'UNASSIGNED'>(() => {
    if (!taskToEdit) return 'ME';
    if (taskToEdit.assignedToEmail === currentUser?.email) return 'ME';
    if (taskToEdit.assignedDepartment && !taskToEdit.assignedToEmail) return 'TEAM';
    if (taskToEdit.assignedToEmail) return 'USER';
    return 'ME';
  });
  
  const [selectedUserEmail, setSelectedUserEmail] = useState(taskToEdit?.assignedToEmail || currentUser?.email || '');
  const [selectedDepartment, setSelectedDepartment] = useState<'OPERATIONS' | 'SALES' | 'GROUND_OPS' | 'FINANCE'>(
    taskToEdit?.assignedDepartment || 'SALES'
  );

  // Related Record State
  const [relatedType, setRelatedType] = useState<ActionCenterEntityType>(
    taskToEdit?.entityType || initialRelatedType || 'LEAD'
  );
  const [recordSearch, setRecordSearch] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(
    taskToEdit?.entityId || taskToEdit?.bookingId || taskToEdit?.leadId || taskToEdit?.quoteId || initialRelatedId || ''
  );
  const [selectedRecordSummary, setSelectedRecordSummary] = useState(
    taskToEdit?.bookingReference || taskToEdit?.quoteNumber || taskToEdit?.leadNumber || taskToEdit?.customerName || ''
  );

  // Booking Service Item link (if linked to a booking)
  const [selectedBookingItemId, setSelectedBookingItemId] = useState<string>(
    taskToEdit?.bookingItemId || ''
  );
  const [selectedBookingItemName, setSelectedBookingItemName] = useState<string>(
    taskToEdit?.bookingItemName || ''
  );

  // Due Date & Time
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [dueDate, setDueDate] = useState<string>(() => {
    if (taskToEdit?.startDate) return taskToEdit.startDate;
    if (taskToEdit?.dueAt) return taskToEdit.dueAt.split('T')[0];
    if (initialDate) return initialDate;
    return todayStr;
  });

  const [timePreset, setTimePreset] = useState<'NONE' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CUSTOM'>(
    taskToEdit?.timePreset || 'MORNING'
  );
  const [customTime, setCustomTime] = useState(taskToEdit?.startTime || '10:00');

  // Importance & Progress
  const [importance, setImportance] = useState<TaskImportance>(
    taskToEdit?.importance || (taskToEdit?.priority === 'URGENT' ? 'URGENT' : taskToEdit?.priority === 'HIGH' ? 'IMPORTANT' : 'NORMAL')
  );
  const [progress, setProgress] = useState<TaskStatus>(taskToEdit?.status || 'TO_DO');

  // Reminder & Repeat
  const [reminderPreset, setReminderPreset] = useState<'NONE' | 'ON_DUE_DATE' | 'ONE_DAY_BEFORE' | 'TWO_DAYS_BEFORE'>(
    taskToEdit?.reminderPreset || 'ON_DUE_DATE'
  );
  const [repeat, setRepeat] = useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>(
    taskToEdit?.repeat || 'NONE'
  );

  // Google Calendar Synchronization State (Default: false)
  const [syncWithGoogleCalendar, setSyncWithGoogleCalendar] = useState<boolean>(() => {
    return taskToEdit?.syncWithGoogleCalendar ?? false;
  });
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [localSyncStatus, setLocalSyncStatus] = useState<'NOT_SYNCED' | 'SYNCED' | 'SYNC_FAILED' | 'SYNCING' | 'DISCONNECTED'>(() => {
    if (taskToEdit?.googleCalendarSyncStatus) return taskToEdit.googleCalendarSyncStatus;
    return taskToEdit?.isSyncedToGoogleCalendar ? 'SYNCED' : 'NOT_SYNCED';
  });
  const [localSyncError, setLocalSyncError] = useState<string | undefined>(
    taskToEdit?.googleCalendarSyncError || taskToEdit?.syncError
  );

  // Sync state when taskToEdit changes
  useEffect(() => {
    if (taskToEdit) {
      setTaskName(taskToEdit.title || '');
      setNotes(taskToEdit.description || taskToEdit.notes || '');
      setImportance(taskToEdit.importance || (taskToEdit.priority === 'URGENT' ? 'URGENT' : taskToEdit.priority === 'HIGH' ? 'IMPORTANT' : 'NORMAL'));
      setProgress(taskToEdit.status || 'TO_DO');
      setDueDate(taskToEdit.startDate || (taskToEdit.dueAt ? taskToEdit.dueAt.split('T')[0] : todayStr));
      setCustomTime(taskToEdit.startTime || '10:00');
      setTimePreset(taskToEdit.timePreset || 'MORNING');
      setReminderPreset(taskToEdit.reminderPreset || 'ON_DUE_DATE');
      setRepeat(taskToEdit.repeat || 'NONE');
      setRelatedType(taskToEdit.entityType || 'LEAD');
      setSelectedRecordId(taskToEdit.entityId || taskToEdit.bookingId || taskToEdit.leadId || taskToEdit.quoteId || '');
      setSelectedRecordSummary(taskToEdit.bookingReference || taskToEdit.quoteNumber || taskToEdit.leadNumber || taskToEdit.customerName || '');
      setSelectedBookingItemId(taskToEdit.bookingItemId || '');
      setSelectedBookingItemName(taskToEdit.bookingItemName || '');
      setSyncWithGoogleCalendar(taskToEdit.syncWithGoogleCalendar ?? false);
      setLocalSyncStatus(taskToEdit.googleCalendarSyncStatus || (taskToEdit.isSyncedToGoogleCalendar ? 'SYNCED' : 'NOT_SYNCED'));
    }
  }, [taskToEdit, todayStr]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Find linked booking object if relatedType is BOOKING
  const linkedBooking = useMemo(() => {
    if (relatedType !== 'BOOKING' || !selectedRecordId) return null;
    return allBookings.find(b => b.id === selectedRecordId || b.bookingReference === selectedRecordId) || null;
  }, [relatedType, selectedRecordId, allBookings]);

  // Quick template selection handler
  const handleApplyTemplate = (tmpl: SalesTemplate) => {
    setTaskName(tmpl.name);
    setNotes(tmpl.defaultNotes);
    setImportance(tmpl.importance);
    setTimePreset(tmpl.timePreset);
    setReminderPreset(tmpl.reminderPreset);
    setRelatedType(tmpl.relatedType);

    const targetMs = Date.now() + tmpl.completeWithinHours * 3600 * 1000;
    setDueDate(new Date(targetMs).toISOString().split('T')[0]);
  };

  // Quick date chips
  const handleSetQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDueDate(d.toISOString().split('T')[0]);
  };

  // Filtered records matching search
  const filteredRecords = useMemo(() => {
    const q = recordSearch.toLowerCase().trim();
    if (relatedType === 'LEAD') {
      return allLeads
        .filter(l => !q || l.contactName.toLowerCase().includes(q) || l.destination.toLowerCase().includes(q) || l.id.toLowerCase().includes(q))
        .slice(0, 8)
        .map(l => ({
          id: l.id,
          label: `${l.contactName} (${l.destination})`,
          subtext: `Stage: ${l.stage} • Ref: ${l.id.slice(0, 8)}`,
          entityRef: l.id,
          clientName: l.contactName,
          leadNumber: l.id
        }));
    }
    if (relatedType === 'QUOTE') {
      return allQuotes
        .filter(qItem => !q || (qItem.quoteNumber || '').toLowerCase().includes(q) || (qItem.clientName || '').toLowerCase().includes(q) || (qItem.destination || '').toLowerCase().includes(q))
        .slice(0, 8)
        .map(qItem => ({
          id: qItem.id || qItem.quoteNumber,
          label: `${qItem.quoteNumber || 'Quotation'} — ${qItem.clientName || 'Client'}`,
          subtext: `${qItem.destination || 'Custom Tour'} • Status: ${qItem.status || 'Draft'}`,
          entityRef: qItem.id || qItem.quoteNumber,
          quoteNumber: qItem.quoteNumber,
          clientName: qItem.clientName
        }));
    }
    if (relatedType === 'BOOKING') {
      return allBookings
        .filter(b => !q || (b.bookingReference || '').toLowerCase().includes(q) || (b.customerName || '').toLowerCase().includes(q) || (b.destination || '').toLowerCase().includes(q))
        .slice(0, 8)
        .map(b => ({
          id: b.id,
          label: `${b.bookingReference} — ${b.customerName}`,
          subtext: `${b.destination} • Status: ${b.status} • Travel: ${b.travelDate || 'Pending'}`,
          entityRef: b.id,
          bookingReference: b.bookingReference,
          clientName: b.customerName
        }));
    }
    if (relatedType === 'SUPPLIER') {
      return allSuppliers
        .filter(s => !q || (s.name || '').toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q) || (s.serviceType || '').toLowerCase().includes(q))
        .slice(0, 8)
        .map(s => ({
          id: s.id,
          label: `${s.name} (${s.serviceType || 'Supplier'})`,
          subtext: `${s.city || ''} • Contact: ${s.contactEmail || s.contactPhone || 'On file'}`,
          entityRef: s.id,
          supplierName: s.name,
          clientName: s.name
        }));
    }
    return [];
  }, [allLeads, allQuotes, allBookings, allSuppliers, relatedType, recordSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) {
      toast.error('Task Name is required', 'Please enter a descriptive title for this task.');
      return;
    }

    // Resolve assigned details
    let assignedEmail = '';
    let assignedName = '';
    let assignedDept: 'OPERATIONS' | 'SALES' | 'GROUND_OPS' | 'FINANCE' | undefined = undefined;

    if (assigneeMode === 'ME') {
      assignedEmail = currentUser?.email || 'me@theunbound.in';
      assignedName = currentUser?.name || 'Me';
      assignedDept = 'SALES';
    } else if (assigneeMode === 'USER') {
      const u = allUsers.find(user => user.email === selectedUserEmail);
      assignedEmail = selectedUserEmail;
      assignedName = u?.name || selectedUserEmail.split('@')[0];
      assignedDept = selectedDepartment;
    } else if (assigneeMode === 'TEAM') {
      assignedDept = selectedDepartment;
      assignedName = `${selectedDepartment} Team`;
      assignedEmail = `${selectedDepartment.toLowerCase()}@theunbound.in`;
    }

    // Resolve time
    let resolvedTime = '09:00';
    if (timePreset === 'MORNING') resolvedTime = '09:00';
    else if (timePreset === 'AFTERNOON') resolvedTime = '14:00';
    else if (timePreset === 'EVENING') resolvedTime = '17:00';
    else if (timePreset === 'CUSTOM') resolvedTime = customTime;

    const dueAtIso = new Date(`${dueDate}T${resolvedTime}:00`).toISOString();

    const taskPayload: Partial<CalendarTask> = {
      title: taskName.trim(),
      description: notes.trim(),
      notes: notes.trim(),
      assignedToEmail: assignedEmail,
      assignedToName: assignedName,
      assignedDepartment: assignedDept,
      entityType: relatedType,
      entityId: selectedRecordId,
      bookingId: relatedType === 'BOOKING' ? selectedRecordId : taskToEdit?.bookingId,
      bookingReference: relatedType === 'BOOKING' ? selectedRecordSummary : taskToEdit?.bookingReference,
      bookingItemId: relatedType === 'BOOKING' ? selectedBookingItemId : undefined,
      bookingItemName: relatedType === 'BOOKING' ? selectedBookingItemName : undefined,
      quoteId: relatedType === 'QUOTE' ? selectedRecordId : taskToEdit?.quoteId,
      quoteNumber: relatedType === 'QUOTE' ? selectedRecordSummary : taskToEdit?.quoteNumber,
      leadId: relatedType === 'LEAD' ? selectedRecordId : taskToEdit?.leadId,
      leadNumber: relatedType === 'LEAD' ? selectedRecordSummary : taskToEdit?.leadNumber,
      supplierId: relatedType === 'SUPPLIER' ? selectedRecordId : taskToEdit?.supplierId,
      supplierName: relatedType === 'SUPPLIER' ? selectedRecordSummary : taskToEdit?.supplierName,
      customerName: selectedRecordSummary || taskToEdit?.customerName,
      startDate: dueDate,
      startTime: resolvedTime,
      dueAt: dueAtIso,
      importance: importance,
      priority: importance === 'URGENT' ? 'URGENT' : importance === 'IMPORTANT' ? 'HIGH' : importance === 'LOW' ? 'LOW' : 'MEDIUM',
      status: progress,
      reminderPreset: reminderPreset,
      timePreset: timePreset,
      repeat: repeat,
      syncWithGoogleCalendar: syncWithGoogleCalendar,
      category: relatedType === 'LEAD' || relatedType === 'QUOTE' ? 'CLIENT_FOLLOW_UP' : 'OPERATIONS_SLA'
    };

    onSave(taskPayload);
    toast.success(
      taskToEdit ? 'Task Updated' : 'Task Created',
      `"${taskName.trim()}" has been saved to the task manager.`
    );
    onClose();
  };

  const handleToggleCompleted = () => {
    const isCurrentlyDone = progress === 'COMPLETED';
    const newProgress: TaskStatus = isCurrentlyDone ? 'TO_DO' : 'COMPLETED';
    setProgress(newProgress);

    if (taskToEdit?.id) {
      if (isCurrentlyDone) {
        db.reopenTask(taskToEdit.id, currentUser);
        toast.info('Task Reopened', `"${taskToEdit.title}" is returned to active tasks.`);
      } else {
        db.completeTask(taskToEdit.id, currentUser, 'Marked done from Task Manager Modal');
        toast.success('Task Completed', `"${taskToEdit.title}" has been marked complete.`);
      }
      onClose();
    }
  };

  const handleImmediateSyncNow = async () => {
    if (!taskToEdit?.id) {
      setSyncWithGoogleCalendar(true);
      return;
    }
    setIsSyncingNow(true);
    try {
      const res = await googleCalendarAutomation.explicitSyncTaskToGoogleCalendar(taskToEdit.id, currentUser);
      if (res.success) {
        setSyncWithGoogleCalendar(true);
        setLocalSyncStatus('SYNCED');
        setLocalSyncError(undefined);
        toast.success('Google Calendar Synced', `"${taskToEdit.title}" event synchronized.`);
      } else {
        setLocalSyncStatus('SYNC_FAILED');
        setLocalSyncError(res.error);
        toast.error('Sync Failed', res.error || 'Check Google connection in settings');
      }
    } catch (e: any) {
      setLocalSyncStatus('SYNC_FAILED');
      setLocalSyncError(e?.message || 'Sync failed');
      toast.error('Sync Error', e?.message || 'Calendar synchronization failed');
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleImmediateRemoveSync = async () => {
    if (!taskToEdit?.id) {
      setSyncWithGoogleCalendar(false);
      setLocalSyncStatus('NOT_SYNCED');
      return;
    }
    setIsSyncingNow(true);
    try {
      await googleCalendarAutomation.removeTaskFromGoogleCalendar(taskToEdit.id, currentUser);
      setSyncWithGoogleCalendar(false);
      setLocalSyncStatus('NOT_SYNCED');
      setLocalSyncError(undefined);
      toast.info('Removed from Calendar', `"${taskToEdit.title}" event removed from Google Calendar.`);
    } catch (e: any) {
      console.warn('Remove sync error:', e);
    } finally {
      setIsSyncingNow(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      id="theunbound-task-modal-portal"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/25 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        // Outside click on backdrop closes modal cleanly
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalContentRef}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/15 text-[#008f77] flex items-center justify-center font-bold shrink-0 shadow-xs">
              <CheckSquare className="w-5 h-5 text-[#00C6A6]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                  {taskToEdit ? 'Edit Task' : 'Add New Task'}
                </h3>
                {taskToEdit && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    taskToEdit.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : taskToEdit.status === 'OVERDUE' || (taskToEdit.dueAt && new Date(taskToEdit.dueAt).getTime() < Date.now())
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-teal-50 text-teal-800 border border-teal-200'
                  }`}>
                    {taskToEdit.status || 'Active'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {selectedRecordSummary
                  ? `Linked: ${relatedType} • ${selectedRecordSummary}`
                  : 'Follow-up manager for bookings, leads, quotes, and suppliers'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick Suggested Templates (Creation mode) */}
          {!taskToEdit && (
            <div className="space-y-1.5 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Quick Sales & Operations Templates:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SALES_TEMPLATES.slice(0, 6).map(tmpl => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-[#00C6A6]/10 hover:text-[#008f77] text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer text-left flex items-center space-x-1"
                  >
                    <span>+ {tmpl.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. Task Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Task Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Confirm hotel room allocation, Follow up with traveler..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] focus:outline-hidden transition-colors"
            />
          </div>

          {/* 2. Assignee Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Who should do this?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssigneeMode('ME')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                  assigneeMode === 'ME'
                    ? 'bg-[#00C6A6] text-white border-[#00C6A6] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Myself ({currentUser?.name?.split(' ')[0] || 'Me'})</span>
              </button>

              <button
                type="button"
                onClick={() => setAssigneeMode('USER')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                  assigneeMode === 'USER'
                    ? 'bg-[#00C6A6] text-white border-[#00C6A6] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Team Member</span>
              </button>

              <button
                type="button"
                onClick={() => setAssigneeMode('TEAM')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                  assigneeMode === 'TEAM'
                    ? 'bg-[#00C6A6] text-white border-[#00C6A6] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Entire Team</span>
              </button>
            </div>

            {assigneeMode === 'USER' && (
              <div className="pt-1">
                <select
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden"
                >
                  {allUsers.map(u => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.role || 'Staff'}) — {u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {assigneeMode === 'TEAM' && (
              <div className="pt-1">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value as any)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden"
                >
                  <option value="SALES">Sales Team (Funnel & Enquiries)</option>
                  <option value="OPERATIONS">Operations Team (Hotels & Vouchers)</option>
                  <option value="GROUND_OPS">Ground Ops Team (Drivers & Guides)</option>
                  <option value="FINANCE">Finance Team (Invoicing & Payments)</option>
                </select>
              </div>
            )}
          </div>

          {/* 3. Related Business Record Selector */}
          <div className="space-y-2.5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Link to Record</span>
              </label>
              <div className="flex space-x-1">
                {(['LEAD', 'QUOTE', 'BOOKING', 'SUPPLIER'] as ActionCenterEntityType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setRelatedType(type);
                      setSelectedRecordId('');
                      setSelectedRecordSummary('');
                      setSelectedBookingItemId('');
                      setSelectedBookingItemName('');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      relatedType === type 
                        ? 'bg-[#00C6A6] text-white shadow-2xs' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {type === 'LEAD' ? 'Lead' : type === 'QUOTE' ? 'Quote' : type === 'BOOKING' ? 'Booking' : 'Supplier'}
                  </button>
                ))}
              </div>
            </div>

            {/* Record Search & Selection */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  placeholder={`Search ${relatedType.toLowerCase()}s by client name or reference...`}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                />
              </div>

              {selectedRecordSummary && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                  <div className="flex items-center space-x-2 truncate">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Selected: <strong>{selectedRecordSummary}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecordId('');
                      setSelectedRecordSummary('');
                      setSelectedBookingItemId('');
                      setSelectedBookingItemName('');
                    }}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline shrink-0 cursor-pointer ml-2"
                  >
                    Change
                  </button>
                </div>
              )}

              {!selectedRecordSummary && (
                <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 p-1">
                  {filteredRecords.length === 0 ? (
                    <div className="p-2 text-[11px] text-slate-400 text-center">
                      No matching {relatedType.toLowerCase()} records found.
                    </div>
                  ) : (
                    filteredRecords.map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => {
                          setSelectedRecordId(rec.id);
                          setSelectedRecordSummary(rec.label);
                        }}
                        className="w-full text-left p-2 hover:bg-[#00C6A6]/10 rounded-lg text-xs transition-colors cursor-pointer flex flex-col"
                      >
                        <span className="font-bold text-slate-800">{rec.label}</span>
                        <span className="text-[10px] text-slate-500">{rec.subtext}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* If Booking is selected, allow linking to a specific Service Item */}
            {relatedType === 'BOOKING' && selectedRecordId && linkedBooking && linkedBooking.serviceItems && linkedBooking.serviceItems.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 mt-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                  <Briefcase className="w-3 h-3 text-[#00C6A6]" />
                  <span>Linked Service Item (Optional)</span>
                </label>
                <select
                  value={selectedBookingItemId}
                  onChange={(e) => {
                    const itemId = e.target.value;
                    setSelectedBookingItemId(itemId);
                    const matchedItem = linkedBooking.serviceItems?.find(s => s.id === itemId);
                    setSelectedBookingItemName(matchedItem ? `${matchedItem.category}: ${matchedItem.serviceName}` : '');
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden"
                >
                  <option value="">Whole Booking / General Follow-up</option>
                  {linkedBooking.serviceItems.map(item => (
                    <option key={item.id} value={item.id}>
                      [{item.category}] {item.serviceName} • {item.supplierName || 'Unallocated'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 4. Due Date & Scheduled Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center space-x-1 mb-1.5">
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(0)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-[#00C6A6]/15 hover:text-[#008f77] text-slate-700 rounded-md border border-slate-200 transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(1)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-[#00C6A6]/15 hover:text-[#008f77] text-slate-700 rounded-md border border-slate-200 transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(2)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-[#00C6A6]/15 hover:text-[#008f77] text-slate-700 rounded-md border border-slate-200 transition-colors"
                >
                  In 2 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(7)}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-[#00C6A6]/15 hover:text-[#008f77] text-slate-700 rounded-md border border-slate-200 transition-colors"
                >
                  In 1 Week
                </button>
              </div>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Scheduled Time
              </label>
              <div className="grid grid-cols-4 gap-1 mb-1">
                {[
                  { id: 'NONE', label: 'Anytime' },
                  { id: 'MORNING', label: '09:00' },
                  { id: 'AFTERNOON', label: '14:00' },
                  { id: 'EVENING', label: '17:00' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTimePreset(t.id as any)}
                    className={`py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer ${
                      timePreset === t.id 
                        ? 'bg-slate-900 text-white border-slate-900' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {timePreset === 'CUSTOM' ? (
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setTimePreset('CUSTOM')}
                  className="text-[11px] text-[#008f77] font-semibold hover:underline block pt-1 cursor-pointer"
                >
                  Or set custom time...
                </button>
              )}
            </div>
          </div>

          {/* 5. Importance & Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Priority Level
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'LOW', label: 'Low', color: 'bg-slate-100 text-slate-700' },
                  { id: 'NORMAL', label: 'Normal', color: 'bg-teal-50 text-teal-800 border-teal-200' },
                  { id: 'IMPORTANT', label: 'Important', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                  { id: 'URGENT', label: 'Urgent', color: 'bg-rose-50 text-rose-800 border-rose-200' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setImportance(item.id as TaskImportance)}
                    className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                      importance === item.id
                        ? 'ring-2 ring-slate-900 border-slate-900 ' + item.color
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Status
              </label>
              <select
                value={progress}
                onChange={(e) => setProgress(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden"
              >
                <option value="TO_DO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_FOR_REPLY">Waiting for Reply</option>
                <option value="COMPLETED">Completed</option>
                <option value="SNOOZED">Snoozed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* 6. Reminders & Repeat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1">
                <Bell className="w-3.5 h-3.5 text-slate-500" />
                <span>Reminder Alert</span>
              </label>
              <select
                value={reminderPreset}
                onChange={(e) => setReminderPreset(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden"
              >
                <option value="NONE">No reminder</option>
                <option value="ON_DUE_DATE">On the due date (Morning)</option>
                <option value="ONE_DAY_BEFORE">1 day before</option>
                <option value="TWO_DAYS_BEFORE">2 days before</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1">
                <Repeat className="w-3.5 h-3.5 text-slate-500" />
                <span>Recurrence</span>
              </label>
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden"
              >
                <option value="NONE">Does not repeat</option>
                <option value="DAILY">Every day</option>
                <option value="WEEKLY">Every week</option>
                <option value="MONTHLY">Every month</option>
              </select>
            </div>
          </div>

          {/* 7. Notes & Remarks */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Notes & Instructions
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key context, supplier instructions, hotel cutoff deadlines, traveler preferences..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#00C6A6] focus:border-[#00C6A6] focus:outline-hidden transition-colors"
            />
          </div>

          {/* 8. Google Calendar Sync Section */}
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#00C6A6]" />
                <span className="text-xs font-bold text-slate-800">Google Calendar Sync</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncWithGoogleCalendar}
                  onChange={(e) => setSyncWithGoogleCalendar(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00C6A6]"></div>
              </label>
            </div>

            {syncWithGoogleCalendar && (
              <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center space-x-1.5">
                  <span className={`w-2 h-2 rounded-full ${localSyncStatus === 'SYNCED' ? 'bg-emerald-500' : localSyncStatus === 'SYNC_FAILED' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <span>Status: {localSyncStatus === 'SYNCED' ? 'Synchronized' : localSyncStatus === 'SYNC_FAILED' ? 'Sync Failed' : 'Ready to Sync'}</span>
                </span>

                {taskToEdit?.id && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleImmediateSyncNow}
                      disabled={isSyncingNow}
                      className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingNow ? 'animate-spin' : ''}`} />
                      <span>Re-sync</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleImmediateRemoveSync}
                      disabled={isSyncingNow}
                      className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Pinned Visible Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div>
            {taskToEdit?.id && (
              <button
                type="button"
                onClick={handleToggleCompleted}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  progress === 'COMPLETED'
                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{progress === 'COMPLETED' ? 'Reopen Task' : 'Mark Complete'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#00C6A6] hover:bg-[#00a88d] rounded-xl shadow-xs cursor-pointer flex items-center space-x-2 transition-colors"
            >
              <CheckSquare className="w-4 h-4" />
              <span>{taskToEdit ? 'Save Changes' : 'Create Task'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
