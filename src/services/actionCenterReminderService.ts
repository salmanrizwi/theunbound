import { AppDatabase } from './db';
import { 
  CalendarTask, 
  ActionCenterEntityType, 
  ActionCenterPriority, 
  TaskStatus, 
  User,
  ActionTarget
} from '../types';

export interface RecordReminderSummary {
  hasActiveReminder: boolean;
  tasks: CalendarTask[];
  count: number;
  highestPriority: ActionCenterPriority;
  isOverdue: boolean;
  primaryTask: CalendarTask | null;
  displayStatus: 'NORMAL' | 'OVERDUE' | 'CRITICAL' | 'HIGH' | 'SNOOZED';
  shouldBlink: boolean;
}

export interface ActionCenterCounts {
  all: number;
  critical: number;
  overdue: number;
  today: number;
  upcoming: number;
}

export interface NavigationTarget {
  section: string;
  subTab?: string;
  recordId?: string;
  targetElementId?: string;
  label: string;
  targetRoute?: string;
}

class ActionCenterReminderService {
  private static instance: ActionCenterReminderService;
  private db: AppDatabase;
  private listeners: Set<() => void> = new Set();
  
  // Indexed cache
  private activeTaskIndex: Map<string, CalendarTask[]> = new Map();
  private allTasksCache: CalendarTask[] = [];
  private isSyncing = false;

  private constructor() {
    this.db = AppDatabase.getInstance();
    this.rebuildIndex();

    // Subscribe to DB updates
    this.db.subscribe(() => {
      this.rebuildIndex();
      this.notifyListeners();
    });

    // Register business event auto-completion hooks (Sections 8 & 9)
    this.db.registerActionCenterHooks({
      onBookingStatusChanged: (bId, bRef, status, user) => this.handleBookingStatusChanged(bId, bRef, status, user),
      onPaymentVerified: (bId, bRef, pId, user) => this.handlePaymentVerified(bId, bRef, pId, user),
      onQuoteStatusChanged: (qId, qNum, status, user) => this.handleQuoteStatusChanged(qId, qNum, status, user),
      onLeadStatusChanged: (lId, lNum, status, user) => this.handleLeadStatusChanged(lId, lNum, status, user)
    });

    // Check for expired snoozed tasks every 20 seconds to guarantee automatic reactivation
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.checkExpiredSnoozes();
      }, 20000);
    }
  }

  public static getInstance(): ActionCenterReminderService {
    if (!ActionCenterReminderService.instance) {
      ActionCenterReminderService.instance = new ActionCenterReminderService();
    }
    return ActionCenterReminderService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error('Error in reminder listener:', err);
      }
    });
  }

  /**
   * Normalizes entity identifiers (stripping leading hashes, whitespace, case)
   */
  public normalizeId(id?: string | null): string {
    if (!id) return '';
    return String(id).trim().replace(/^#/, '').toLowerCase();
  }

  /**
   * Synchronizes active tasks with live database records:
   * 1. Guarantees that active quotes awaiting follow-up have valid, traceable tasks with entityType, entityId, targetRoute.
   * 2. Auto-resolves tasks for quotes/bookings/leads that have reached terminal states or have follow-ups completed.
   * 3. Audits and repairs orphan tasks so NO fake or un-clickable task exists.
   */
  public syncLiveDatabaseTasks() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const allQuotes = this.db.getAllSavedQuotes() || [];
      const allBookings = this.db.getAllBookings() || [];
      const allLeads = this.db.getLeads() || [];
      let currentTasks = this.db.getCalendarTasks() || [];

      // A. SYNC QUOTES AWAITING FOLLOW-UP
      const followUpQuotes = allQuotes.filter(q => {
        if ((q as any).followUpCompletedAt) return false;
        const terminalStatuses = ['CONFIRMED', 'ACCEPTED', 'CONVERTED', 'REJECTED', 'EXPIRED', 'ARCHIVED', 'CANCELLED'];
        if (terminalStatuses.includes(q.status)) return false;
        return (
          q.status === 'SENT' || 
          q.status === 'SENT_TO_CLIENT' || 
          q.status === 'VIEWED' || 
          q.status === 'VIEWED_BY_CLIENT' || 
          (q as any).followUpRequired === true
        );
      });

      const followUpQuoteIds = new Set(followUpQuotes.map(q => q.id));

      // 1. Create or update tasks for active follow-up quotes
      for (const quote of followUpQuotes) {
        const normQId = this.normalizeId(quote.id);
        const normQNum = this.normalizeId(quote.quoteNumber);

        const existingTask = currentTasks.find(t => {
          const tQId = this.normalizeId(t.quoteId || t.entityId);
          const tQNum = this.normalizeId(t.quoteNumber);
          return (tQId && tQId === normQId) || (tQNum && tQNum === normQNum);
        });

        if (existingTask) {
          // TERMINAL STATE PROTECTION: NEVER resurrect completed, dismissed, or cancelled tasks!
          if (existingTask.status === 'COMPLETED' || existingTask.status === 'DISMISSED' || existingTask.status === 'CANCELLED') {
            // Keep quote followUpCompletedAt synchronized so quote won't remain in followUpQuotes
            if (!(quote as any).followUpCompletedAt && existingTask.status === 'COMPLETED') {
              (quote as any).followUpCompletedAt = existingTask.completedAt || new Date().toISOString();
              (quote as any).followUpRequired = false;
              this.db.saveQuote(quote, null, 'STATUS_CHANGED');
            }
            continue; // Do NOT touch, do NOT revert to PENDING
          }

          // SNOOZE STATE PROTECTION: Preserve snooze until snoozedUntil has passed
          if (existingTask.status === 'SNOOZED') {
            if (existingTask.snoozedUntil) {
              const snoozeTime = new Date(existingTask.snoozedUntil).getTime();
              if (!isNaN(snoozeTime) && snoozeTime > Date.now()) {
                // Still within active snooze period, preserve!
                continue;
              }
            }
            // Snooze has expired! Reactivate to PENDING
            existingTask.status = 'PENDING';
            existingTask.snoozedUntil = undefined;
            existingTask.updatedAt = new Date().toISOString();
            this.db.saveCalendarTask(existingTask);
            continue;
          }

          // Ensure task has all valid target attributes
          let needsUpdate = false;
          if (!existingTask.entityType || existingTask.entityType !== 'QUOTE') {
            existingTask.entityType = 'QUOTE';
            needsUpdate = true;
          }
          if (existingTask.entityId !== quote.id) {
            existingTask.entityId = quote.id;
            needsUpdate = true;
          }
          if (existingTask.quoteId !== quote.id) {
            existingTask.quoteId = quote.id;
            needsUpdate = true;
          }
          if (existingTask.targetRoute !== `/admin/quotes/${quote.id}`) {
            existingTask.targetRoute = `/admin/quotes/${quote.id}`;
            needsUpdate = true;
          }
          if (!existingTask.actionRequired) {
            existingTask.actionRequired = 'Follow up on quote';
            needsUpdate = true;
          }
          if (needsUpdate) {
            this.db.saveCalendarTask(existingTask);
          }
        } else {
          // Create new task traceable to this exact Quote record
          const newTask: CalendarTask = {
            id: `task-quote-followup-${quote.id}`,
            taskId: `task-quote-followup-${quote.id}`,
            taskType: 'QUOTE_FOLLOW_UP',
            title: `Follow Up: Quote #${quote.quoteNumber || quote.id}`,
            description: `Proposal for ${quote.clientName || 'Traveler'} (${quote.destination || 'Tour'}) dispatched. Follow up on proposal customization & booking conversion.`,
            assignedToEmail: (quote as any).createdByEmail || (quote as any).agentEmail || 'sales@theunbound.com',
            assignedToName: quote.agentName || 'Sales Desk',
            assignedDepartment: 'SALES',
            category: 'CLIENT_FOLLOW_UP',
            entityType: 'QUOTE',
            entityId: quote.id,
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            leadId: quote.leadId,
            customerName: quote.clientName,
            customerEmail: quote.clientEmail,
            destination: quote.destination,
            targetRoute: `/admin/quotes/${quote.id}`,
            actionRequired: 'Follow up on quote',
            status: 'PENDING',
            priority: 'HIGH',
            slaHours: 24,
            generatedAt: quote.updatedAt || quote.createdAt || new Date().toISOString(),
            dueAt: new Date(new Date(quote.updatedAt || quote.createdAt || Date.now()).getTime() + 24 * 3600 * 1000).toISOString(),
            startDate: new Date().toISOString().split('T')[0],
            startTime: '09:00',
            isSyncedToGoogleCalendar: false,
            calendarSyncStatus: 'NOT_SYNCED',
            createdAt: quote.createdAt || new Date().toISOString(),
            updatedAt: quote.updatedAt || new Date().toISOString()
          };
          this.db.saveCalendarTask(newTask);
        }
      }

      // 2. Resolve/complete tasks for quotes that are NO LONGER awaiting follow up
      for (const t of currentTasks) {
        if (t.entityType === 'QUOTE' || t.taskType === 'QUOTE_FOLLOW_UP') {
          const qId = t.quoteId || t.entityId;
          if (qId && !followUpQuoteIds.has(qId)) {
            // Check if quote is completed or no longer in follow-up list
            const matchedQuote = allQuotes.find(q => q.id === qId || q.quoteNumber === t.quoteNumber);
            if (!matchedQuote || (matchedQuote as any).followUpCompletedAt || ['CONFIRMED', 'ACCEPTED', 'CONVERTED', 'REJECTED', 'EXPIRED', 'ARCHIVED', 'CANCELLED'].includes(matchedQuote.status)) {
              if (t.status === 'PENDING' || t.status === 'OPEN') {
                t.status = 'COMPLETED';
                t.completedAt = new Date().toISOString();
                t.completedBy = 'System Auto-Sync';
                this.db.saveCalendarTask(t);
              }
            }
          }
        }
      }

      // B. SYNC BOOKINGS PENDING CONFIRMATION
      const pendingBookings = allBookings.filter(b => b.status === 'PENDING_CONFIRMATION' || (b.status as string) === 'SUBMITTED');
      const pendingBookingIds = new Set(pendingBookings.map(b => b.id));

      for (const booking of pendingBookings) {
        const normBId = this.normalizeId(booking.id);
        const normBRef = this.normalizeId(booking.bookingReference || (booking as any).referenceNumber);

        const existingTask = currentTasks.find(t => {
          const tBId = this.normalizeId(t.bookingId || t.entityId);
          const tBRef = this.normalizeId(t.bookingReference);
          return (tBId && tBId === normBId) || (tBRef && tBRef === normBRef);
        });

        if (existingTask) {
          // TERMINAL STATE PROTECTION
          if (existingTask.status === 'COMPLETED' || existingTask.status === 'DISMISSED' || existingTask.status === 'CANCELLED') {
            continue;
          }

          // SNOOZE STATE PROTECTION
          if (existingTask.status === 'SNOOZED') {
            if (existingTask.snoozedUntil) {
              const snoozeTime = new Date(existingTask.snoozedUntil).getTime();
              if (!isNaN(snoozeTime) && snoozeTime > Date.now()) {
                continue;
              }
            }
            existingTask.status = 'PENDING';
            existingTask.snoozedUntil = undefined;
            existingTask.updatedAt = new Date().toISOString();
            this.db.saveCalendarTask(existingTask);
            continue;
          }

          let needsUpdate = false;
          if (existingTask.entityType !== 'BOOKING') {
            existingTask.entityType = 'BOOKING';
            needsUpdate = true;
          }
          if (existingTask.entityId !== booking.id) {
            existingTask.entityId = booking.id;
            needsUpdate = true;
          }
          if (existingTask.targetRoute !== `/admin/bookings/${booking.id}`) {
            existingTask.targetRoute = `/admin/bookings/${booking.id}`;
            needsUpdate = true;
          }
          if (needsUpdate) {
            this.db.saveCalendarTask(existingTask);
          }
        } else {
          const newTask: CalendarTask = {
            id: `task-booking-confirm-${booking.id}`,
            taskId: `task-booking-confirm-${booking.id}`,
            taskType: 'BOOKING_CONFIRMATION_SLA',
            title: `Confirm Booking #${booking.bookingReference || (booking as any).referenceNumber || booking.id}`,
            description: `Ground reservation submitted for ${booking.customer?.leadTravelerName || 'Traveler'}. Verify provider allocations & issue booking confirmation.`,
            assignedToEmail: 'operations@theunbound.com',
            assignedToName: 'Operations Dispatch',
            assignedDepartment: 'OPERATIONS',
            category: 'OPERATIONS_SLA',
            entityType: 'BOOKING',
            entityId: booking.id,
            bookingId: booking.id,
            bookingReference: booking.bookingReference || (booking as any).referenceNumber,
            customerName: booking.customer?.leadTravelerName,
            customerEmail: booking.customer?.email,
            destination: booking.destinationName,
            targetRoute: `/admin/bookings/${booking.id}`,
            actionRequired: 'Review & confirm ground reservation',
            status: 'PENDING',
            priority: 'URGENT',
            slaHours: 24,
            generatedAt: booking.createdAt || new Date().toISOString(),
            dueAt: new Date(new Date(booking.createdAt || Date.now()).getTime() + 24 * 3600 * 1000).toISOString(),
            startDate: new Date().toISOString().split('T')[0],
            startTime: '09:00',
            isSyncedToGoogleCalendar: false,
            calendarSyncStatus: 'NOT_SYNCED',
            createdAt: booking.createdAt || new Date().toISOString(),
            updatedAt: booking.createdAt || new Date().toISOString()
          };
          this.db.saveCalendarTask(newTask);
        }
      }

      // Auto-complete booking confirmation tasks if booking is confirmed/processed/cancelled
      for (const t of currentTasks) {
        if (t.entityType === 'BOOKING' || t.taskType === 'BOOKING_CONFIRMATION_SLA') {
          const bId = t.bookingId || t.entityId;
          if (bId && !pendingBookingIds.has(bId)) {
            const matchedBooking = allBookings.find(b => b.id === bId || b.bookingReference === t.bookingReference || (b as any).referenceNumber === t.bookingReference);
            if (matchedBooking && ['CONFIRMED', 'PROCESSED', 'CANCELLED'].includes(matchedBooking.status)) {
              if (t.status === 'PENDING' || t.status === 'OPEN') {
                t.status = 'COMPLETED';
                t.completedAt = new Date().toISOString();
                t.completedBy = 'System Auto-Sync';
                this.db.saveCalendarTask(t);
              }
            }
          }
        }
      }

      // C. AUDIT & REPAIR ORPHAN TASKS (Requirement 11 & 19)
      currentTasks = this.db.getCalendarTasks() || [];
      for (const task of currentTasks) {
        if (!task.entityType || !task.entityId || !task.targetRoute) {
          // Attempt recovery from linked references
          if (task.quoteId || task.quoteNumber) {
            const q = allQuotes.find(item => item.id === task.quoteId || item.quoteNumber === task.quoteNumber);
            if (q) {
              task.entityType = 'QUOTE';
              task.entityId = q.id;
              task.quoteId = q.id;
              task.quoteNumber = q.quoteNumber;
              task.targetRoute = `/admin/quotes/${q.id}`;
              task.actionRequired = task.actionRequired || 'Follow up on quote';
              this.db.saveCalendarTask(task);
              continue;
            }
          }

          if (task.bookingId || task.bookingReference) {
            const b = allBookings.find(item => item.id === task.bookingId || item.bookingReference === task.bookingReference || (item as any).referenceNumber === task.bookingReference);
            if (b) {
              task.entityType = 'BOOKING';
              task.entityId = b.id;
              task.bookingId = b.id;
              task.bookingReference = b.bookingReference || (b as any).referenceNumber;
              task.targetRoute = `/admin/bookings/${b.id}`;
              task.actionRequired = task.actionRequired || 'Review & confirm ground reservation';
              this.db.saveCalendarTask(task);
              continue;
            }
          }

          if (task.leadId || task.leadNumber) {
            const l = allLeads.find(item => item.id === task.leadId || item.leadNumber === task.leadNumber);
            if (l) {
              task.entityType = 'LEAD';
              task.entityId = l.id;
              task.leadId = l.id;
              task.leadNumber = l.leadNumber;
              task.targetRoute = `/admin/leads/${l.id}`;
              task.actionRequired = task.actionRequired || 'Initial consultation and lead contact';
              this.db.saveCalendarTask(task);
              continue;
            }
          }

          // If it CANNOT be linked to any real database record:
          // Flag for repair and remove from active display to prevent fake/orphan tasks
          task.isOrphan = true;
          task.isFlaggedForRepair = true;
          if (task.status === 'PENDING' || task.status === 'OPEN') {
            task.status = 'DISMISSED';
            task.dismissedAt = new Date().toISOString();
            task.dismissedBy = 'Orphan Audit Sentinel';
            task.notes = (task.notes ? `${task.notes} | ` : '') + 'FLAGGED FOR REPAIR: Broken target reference with no database record';
            this.db.saveCalendarTask(task);
          }
        }
      }
    } catch (e) {
      console.error('Error syncing live database tasks with Action Center:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Rebuilds fast O(1) indexed lookup tables from database tasks
   */
  private rebuildIndex() {
    // 1. Synchronize tasks from live database first
    this.syncLiveDatabaseTasks();

    const tasks = this.db.getCalendarTasks();
    this.allTasksCache = tasks;
    const newIndex = new Map<string, CalendarTask[]>();

    const addToIndex = (key: string, task: CalendarTask) => {
      if (!key) return;
      const existing = newIndex.get(key) || [];
      existing.push(task);
      newIndex.set(key, existing);
    };

    for (const task of tasks) {
      // Determine if task is currently active or snoozed
      const active = this.isTaskActive(task);
      if (!active) continue;

      // Index by explicit entityType and entityId if available
      if (task.entityType && task.entityId) {
        const primaryKey = `${task.entityType}:${this.normalizeId(task.entityId)}`;
        addToIndex(primaryKey, task);
      }

      // Index by Booking
      if (task.bookingId) {
        addToIndex(`BOOKING:${this.normalizeId(task.bookingId)}`, task);
      }
      if (task.bookingReference) {
        addToIndex(`BOOKING:${this.normalizeId(task.bookingReference)}`, task);
      }

      // Index by Quote
      if (task.quoteId) {
        addToIndex(`QUOTE:${this.normalizeId(task.quoteId)}`, task);
      }
      if (task.quoteNumber) {
        addToIndex(`QUOTE:${this.normalizeId(task.quoteNumber)}`, task);
      }

      // Index by Lead
      if (task.leadId) {
        addToIndex(`LEAD:${this.normalizeId(task.leadId)}`, task);
      }
      if (task.leadNumber) {
        addToIndex(`LEAD:${this.normalizeId(task.leadNumber)}`, task);
      }

      // Index by Customer / User / Payment
      if (task.customerId) {
        addToIndex(`CUSTOMER:${this.normalizeId(task.customerId)}`, task);
      }
      if (task.userId) {
        addToIndex(`USER:${this.normalizeId(task.userId)}`, task);
      }
      if (task.paymentId) {
        addToIndex(`PAYMENT:${this.normalizeId(task.paymentId)}`, task);
      }
      if (task.serviceId) {
        addToIndex(`JOB:${this.normalizeId(task.serviceId)}`, task);
      }
    }

    this.activeTaskIndex = newIndex;
  }

  /**
   * Check if a task is currently actionable/active according to Section 6
   */
  public isTaskActive(task: CalendarTask): boolean {
    if (!task) return false;

    // Terminal states -> REMOVED
    if (
      task.status === 'COMPLETED' || 
      task.status === 'DISMISSED' || 
      task.status === 'CANCELLED'
    ) {
      return false;
    }

    // Snooze check: if snoozed and snooze time is still in the future -> NOT ACTIVE
    if (task.status === 'SNOOZED' && task.snoozedUntil) {
      const snoozeTime = new Date(task.snoozedUntil).getTime();
      if (!isNaN(snoozeTime) && snoozeTime > Date.now()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if a task is overdue based on SLA status and dueAt timestamp
   */
  public isTaskOverdue(task: CalendarTask): boolean {
    if (!this.isTaskActive(task)) return false;

    if (
      task.status === 'OVERDUE' || 
      (task.slaStatus as string) === 'OVERDUE' || 
      task.slaStatus === 'SLA_BREACHED'
    ) {
      return true;
    }

    if (task.dueAt) {
      const dueTime = new Date(task.dueAt).getTime();
      if (!isNaN(dueTime) && dueTime < Date.now()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determines highest visual priority among a list of tasks
   */
  public calculateHighestPriority(tasks: CalendarTask[]): ActionCenterPriority {
    if (!tasks || tasks.length === 0) return 'LOW';

    let hasOverdue = false;
    let hasCritical = false;
    let hasHigh = false;
    let hasMedium = false;

    for (const t of tasks) {
      if (this.isTaskOverdue(t) || t.priority === 'OVERDUE') {
        hasOverdue = true;
      } else if (t.priority === 'CRITICAL' || t.priority === 'URGENT') {
        hasCritical = true;
      } else if (t.priority === 'HIGH') {
        hasHigh = true;
      } else if (t.priority === 'MEDIUM') {
        hasMedium = true;
      }
    }

    if (hasOverdue) return 'OVERDUE';
    if (hasCritical) return 'CRITICAL';
    if (hasHigh) return 'HIGH';
    if (hasMedium) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Check if a user has permission to view an Action Center task (Section 16)
   */
  public isTaskVisibleToUser(task: CalendarTask, user?: User | null): boolean {
    if (!user) return true; // Default fallback for open admin sessions

    // Super admins and team admins can see all tasks
    if (user.role === 'ADMIN') return true;

    // Team members & DMC ops see tasks assigned to them, their department, or general operations
    if (user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      if (!task.assignedToEmail && !task.assignedDepartment) return true;
      if (task.assignedToEmail?.toLowerCase() === user.email?.toLowerCase()) return true;
      if (user.department && task.assignedDepartment === user.department) return true;
      return true;
    }

    // B2B Agent: can only see tasks related to their own agency or bookings/quotes
    if (user.role === 'B2B_AGENT') {
      if (task.assignedToEmail?.toLowerCase() === user.email?.toLowerCase()) return true;
      
      // If task has bookingReference or quoteNumber, verify agency ownership
      if (task.bookingId || task.bookingReference) {
        const bookings = this.db.getBookingsForUser(user);
        const hasBooking = bookings.some(b => 
          b.id === task.bookingId || 
          b.bookingReference === task.bookingReference
        );
        if (hasBooking) return true;
      }

      if (task.quoteId || task.quoteNumber) {
        const quotes = this.db.getQuotesForUser(user);
        const hasQuote = quotes.some(q => 
          q.id === task.quoteId || 
          q.quoteNumber === task.quoteNumber
        );
        if (hasQuote) return true;
      }

      if (task.leadId || task.leadNumber) {
        const leads = this.db.getLeadsAuthorized(user);
        const hasLead = leads.some(l => 
          l.id === task.leadId || 
          l.leadNumber === task.leadNumber
        );
        if (hasLead) return true;
      }

      return false;
    }

    // Buyer: only tasks related to their direct customer email or traveler name
    if (user.role === 'BUYER') {
      if (task.customerEmail?.toLowerCase() === user.email?.toLowerCase()) return true;
      return false;
    }

    return true;
  }

  /**
   * Retrieve active record reminders for a given entity (O(1) indexed lookup)
   */
  public getRecordReminder(
    entityType: ActionCenterEntityType,
    entityId?: string | null,
    entityReference?: string | null,
    currentUser?: User | null
  ): RecordReminderSummary {
    const emptyResult: RecordReminderSummary = {
      hasActiveReminder: false,
      tasks: [],
      count: 0,
      highestPriority: 'LOW',
      isOverdue: false,
      primaryTask: null,
      displayStatus: 'NORMAL',
      shouldBlink: false
    };

    if (!entityId && !entityReference) {
      return emptyResult;
    }

    const matchedTaskMap = new Map<string, CalendarTask>();

    // Lookup by entityId
    if (entityId) {
      const key1 = `${entityType}:${this.normalizeId(entityId)}`;
      const tasks1 = this.activeTaskIndex.get(key1) || [];
      tasks1.forEach(t => matchedTaskMap.set(t.id, t));
    }

    // Lookup by secondary entity reference (e.g. Booking Reference or Quote Number)
    if (entityReference) {
      const key2 = `${entityType}:${this.normalizeId(entityReference)}`;
      const tasks2 = this.activeTaskIndex.get(key2) || [];
      tasks2.forEach(t => matchedTaskMap.set(t.id, t));
    }

    // Filter by user role authorization
    const authorizedTasks = Array.from(matchedTaskMap.values()).filter(t => 
      this.isTaskVisibleToUser(t, currentUser)
    );

    if (authorizedTasks.length === 0) {
      return emptyResult;
    }

    // Sort by priority and overdue status
    const sortedTasks = [...authorizedTasks].sort((a, b) => {
      const aOverdue = this.isTaskOverdue(a) ? 1 : 0;
      const bOverdue = this.isTaskOverdue(b) ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;

      const priorityOrder: Record<ActionCenterPriority, number> = {
        OVERDUE: 5,
        CRITICAL: 4,
        URGENT: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1
      };
      const pDiff = (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);
      if (pDiff !== 0) return pDiff;

      // Sooner dueAt first
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : 9999999999999;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : 9999999999999;
      return aDue - bDue;
    });

    const primaryTask = sortedTasks[0];
    const highestPriority = this.calculateHighestPriority(sortedTasks);
    const isOverdue = sortedTasks.some(t => this.isTaskOverdue(t));

    return {
      hasActiveReminder: true,
      tasks: sortedTasks,
      count: sortedTasks.length,
      highestPriority,
      isOverdue,
      primaryTask,
      displayStatus: isOverdue ? 'OVERDUE' : (highestPriority === 'CRITICAL' ? 'CRITICAL' : 'HIGH'),
      shouldBlink: true
    };
  }

  /**
   * Real-time metrics counts across all active tasks (Section 12)
   */
  public getRealTimeCounts(currentUser?: User | null): ActionCenterCounts {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const counts: ActionCenterCounts = {
      all: 0,
      critical: 0,
      overdue: 0,
      today: 0,
      upcoming: 0
    };

    for (const task of this.allTasksCache) {
      if (!this.isTaskActive(task)) continue;
      if (!this.isTaskVisibleToUser(task, currentUser)) continue;

      counts.all++;

      const isOverdue = this.isTaskOverdue(task);
      if (isOverdue) {
        counts.overdue++;
      }

      if (task.priority === 'CRITICAL' || task.priority === 'URGENT') {
        counts.critical++;
      }

      if (task.dueAt) {
        const dueTime = new Date(task.dueAt).getTime();
        if (!isNaN(dueTime)) {
          if (dueTime >= todayStart.getTime() && dueTime <= todayEnd.getTime()) {
            counts.today++;
          } else if (dueTime > todayEnd.getTime()) {
            counts.upcoming++;
          }
        }
      }
    }

    return counts;
  }

  /**
   * Automatically check for and reactivate expired snoozes
   */
  public checkExpiredSnoozes(): void {
    const tasks = this.db.getCalendarTasks() || [];
    let hasExpired = false;
    const now = Date.now();

    for (const task of tasks) {
      if (task.status === 'SNOOZED' && task.snoozedUntil) {
        const snoozeTime = new Date(task.snoozedUntil).getTime();
        if (!isNaN(snoozeTime) && snoozeTime <= now) {
          task.status = 'PENDING';
          task.snoozedUntil = undefined;
          task.updatedAt = new Date().toISOString();
          task.notes = (task.notes ? `${task.notes} | ` : '') + 'Snooze expired - automatically reactivated to active';
          this.db.saveCalendarTask(task);
          hasExpired = true;
        }
      }
    }

    if (hasExpired) {
      this.rebuildIndex();
      this.notifyListeners();
    }
  }

  /**
   * Get all active tasks for a given user
   */
  public getActiveTasks(currentUser?: User | null): CalendarTask[] {
    return this.allTasksCache
      .filter(t => this.isTaskActive(t) && this.isTaskVisibleToUser(t, currentUser))
      .sort((a, b) => {
        const aOverdue = this.isTaskOverdue(a) ? 1 : 0;
        const bOverdue = this.isTaskOverdue(b) ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;

        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : 9999999999999;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : 9999999999999;
        return aDue - bDue;
      });
  }

  /**
   * Get all snoozed tasks for a given user
   */
  public getSnoozedTasks(currentUser?: User | null): CalendarTask[] {
    return this.allTasksCache
      .filter(t => t.status === 'SNOOZED' && this.isTaskVisibleToUser(t, currentUser))
      .sort((a, b) => {
        const aTime = a.snoozedUntil ? new Date(a.snoozedUntil).getTime() : 0;
        const bTime = b.snoozedUntil ? new Date(b.snoozedUntil).getTime() : 0;
        return aTime - bTime;
      });
  }

  /**
   * Get recently completed tasks for audit and review
   */
  public getCompletedTasks(currentUser?: User | null): CalendarTask[] {
    return this.allTasksCache
      .filter(t => t.status === 'COMPLETED' && this.isTaskVisibleToUser(t, currentUser))
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  // ==============================================================
  // USER ACTIONS: SNOOZE, COMPLETE, DISMISS
  // ==============================================================

  /**
   * Complete a task with mandatory Firestore persistence, atomic record updating,
   * linked record synchronization, and audit trail logging.
   */
  public async completeTask(
    taskId: string, 
    completedBy?: string, 
    notes?: string,
    currentUser?: User | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!taskId) {
      return { success: false, error: 'Task ID is required' };
    }

    const task = this.allTasksCache.find(t => t.id === taskId || t.taskId === taskId);
    if (!task) {
      return { success: false, error: 'Task not found in Action Center' };
    }

    if (task.status === 'COMPLETED') {
      return { success: true };
    }

    const now = new Date().toISOString();
    const actorName = completedBy || currentUser?.name || currentUser?.email || 'System Operator';

    const updated: CalendarTask = {
      ...task,
      previousStatus: task.status,
      status: 'COMPLETED',
      completedAt: now,
      completedBy: actorName,
      completionNote: notes || 'Task marked complete from Action Center',
      notes: notes ? (task.notes ? `${task.notes} | ${notes}` : notes) : task.notes,
      updatedAt: now
    };

    try {
      // 1. Mandatory Firestore remote persistence: Awaits server confirmation
      await this.db.saveCalendarTaskAsync(updated, currentUser);

      // 2. Synchronize linked business record so the record itself stops asking for action
      try {
        if (task.entityType === 'QUOTE' || task.quoteId) {
          const qId = task.quoteId || task.entityId;
          const allQuotes = this.db.getAllSavedQuotes() || [];
          const quote = allQuotes.find(q => q.id === qId || q.quoteNumber === task.quoteNumber);
          if (quote) {
            (quote as any).followUpCompletedAt = now;
            (quote as any).followUpRequired = false;
            (quote as any).lastFollowUpNotes = notes || 'Follow-up marked complete via Action Center';
            (quote as any).lastFollowUpAt = now;
            (quote as any).updatedAt = now;
            this.db.saveQuote(quote, currentUser || null, 'STATUS_CHANGED', 'Follow-up marked complete via Action Center');
          }
        } else if (task.entityType === 'BOOKING' || task.bookingId) {
          const bId = task.bookingId || task.entityId;
          const allBookings = this.db.getAllBookings() || [];
          const booking = allBookings.find(b => b.id === bId || b.bookingReference === task.bookingReference);
          if (booking) {
            (booking as any).confirmationTaskCompletedAt = now;
            (booking as any).updatedAt = now;
            this.db.saveBooking(booking, currentUser);
          }
        } else if (task.entityType === 'LEAD' || task.leadId) {
          const lId = task.leadId || task.entityId;
          const allLeads = this.db.getLeads() || [];
          const lead = allLeads.find(l => l.id === lId || l.leadNumber === task.leadNumber);
          if (lead && lead.followUps && Array.isArray(lead.followUps)) {
            let modified = false;
            lead.followUps.forEach(fu => {
              if (fu.status !== 'COMPLETED') {
                fu.status = 'COMPLETED';
                fu.completedAt = now;
                fu.completedBy = actorName;
                modified = true;
              }
            });
            if (modified) {
              this.db.saveLead(lead, currentUser);
            }
          }
        }
      } catch (linkedErr) {
        console.warn('[ACTION_CENTER] Error syncing linked business record:', linkedErr);
      }

      // 3. Update in-memory state and notify all subscribers immediately
      this.rebuildIndex();
      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      console.error(`[ACTION_CENTER] Failed to complete task ${taskId}:`, err);
      return { 
        success: false, 
        error: err?.message || 'Unable to complete this task. Your change was not saved. Please try again.' 
      };
    }
  }

  /**
   * Snooze a task for a specified duration in hours with mandatory Firestore persistence.
   */
  public async snoozeTask(
    taskId: string, 
    durationHours: number = 4, 
    currentUser?: User | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!taskId) {
      return { success: false, error: 'Task ID is required' };
    }

    const task = this.allTasksCache.find(t => t.id === taskId || t.taskId === taskId);
    if (!task) {
      return { success: false, error: 'Task not found in Action Center' };
    }

    const now = new Date();
    const snoozeExpiry = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();
    const actorName = currentUser?.name || currentUser?.email || 'User';

    const updated: CalendarTask = {
      ...task,
      previousStatus: task.status,
      status: 'SNOOZED',
      snoozedUntil: snoozeExpiry,
      snoozedBy: actorName,
      notes: task.notes 
        ? `${task.notes} | Snoozed for ${durationHours}h by ${actorName}` 
        : `Snoozed for ${durationHours}h by ${actorName}`,
      updatedAt: now.toISOString()
    };

    try {
      // 1. Mandatory Firestore remote persistence
      await this.db.saveCalendarTaskAsync(updated, currentUser);

      // 2. Update memory cache and notify
      this.rebuildIndex();
      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      console.error(`[ACTION_CENTER] Failed to snooze task ${taskId}:`, err);
      return { 
        success: false, 
        error: err?.message || 'Unable to snooze this task. Your change was not saved. Please try again.' 
      };
    }
  }

  /**
   * Dismiss an actionable reminder with database persistence.
   */
  public async dismissTask(
    taskId: string, 
    currentUser?: User | null, 
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!taskId) {
      return { success: false, error: 'Task ID is required' };
    }

    const task = this.allTasksCache.find(t => t.id === taskId || t.taskId === taskId);
    if (!task) {
      return { success: false, error: 'Task not found in Action Center' };
    }

    const now = new Date().toISOString();
    const actorName = currentUser?.name || currentUser?.email || 'Operator';

    const updated: CalendarTask = {
      ...task,
      previousStatus: task.status,
      status: 'DISMISSED',
      dismissedAt: now,
      dismissedBy: actorName,
      notes: reason ? (task.notes ? `${task.notes} | Dismissed: ${reason}` : `Dismissed: ${reason}`) : task.notes,
      updatedAt: now
    };

    try {
      await this.db.saveCalendarTaskAsync(updated, currentUser);
      this.rebuildIndex();
      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      console.error(`[ACTION_CENTER] Failed to dismiss task ${taskId}:`, err);
      return { 
        success: false, 
        error: err?.message || 'Unable to dismiss this task. Your change was not saved. Please try again.' 
      };
    }
  }

  // Centralized action aliases (Section 16 requirement)
  public async completeActionCenterTask(taskId: string, completedBy?: string, notes?: string, currentUser?: User | null) {
    return this.completeTask(taskId, completedBy, notes, currentUser);
  }

  public async snoozeActionCenterTask(taskId: string, durationHours: number = 4, currentUser?: User | null) {
    return this.snoozeTask(taskId, durationHours, currentUser);
  }

  public async dismissActionCenterTask(taskId: string, currentUser?: User | null, reason?: string) {
    return this.dismissTask(taskId, currentUser, reason);
  }

  /**
   * Reactivate a snoozed or dismissed task with database persistence.
   */
  public async reactivateTask(
    taskId: string,
    currentUser?: User | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!taskId) return { success: false, error: 'Task ID is required' };

    const task = this.allTasksCache.find(t => t.id === taskId || t.taskId === taskId);
    if (!task) return { success: false, error: 'Task not found' };

    const now = new Date().toISOString();
    const actorName = currentUser?.name || currentUser?.email || 'User';

    const updated: CalendarTask = {
      ...task,
      status: 'PENDING',
      snoozedUntil: undefined,
      snoozedBy: undefined,
      notes: (task.notes ? `${task.notes} | ` : '') + `Reactivated by ${actorName}`,
      updatedAt: now
    };

    try {
      await this.db.saveCalendarTaskAsync(updated, currentUser);
      this.rebuildIndex();
      this.notifyListeners();
      return { success: true };
    } catch (err: any) {
      console.error(`[ACTION_CENTER] Failed to reactivate task ${taskId}:`, err);
      return {
        success: false,
        error: err?.message || 'Unable to reactivate task. Please try again.'
      };
    }
  }

  // ==============================================================
  // BUSINESS-EVENT-DRIVEN AUTO-COMPLETION (Sections 8 & 9)
  // ==============================================================

  /**
   * Called when a booking status changes.
   * Auto-completes any pending confirmation tasks for this booking.
   */
  public handleBookingStatusChanged(
    bookingId: string, 
    bookingRef: string, 
    newStatus: string, 
    user?: User | null
  ) {
    if (!bookingId && !bookingRef) return;

    const terminalStatuses = ['CONFIRMED', 'PROCESSED', 'CANCELLED'];
    if (!terminalStatuses.includes(newStatus)) return;

    const normId = this.normalizeId(bookingId);
    const normRef = this.normalizeId(bookingRef);

    const relatedTasks = this.allTasksCache.filter(t => {
      if (!this.isTaskActive(t)) return false;
      const bId = this.normalizeId(t.bookingId);
      const bRef = this.normalizeId(t.bookingReference);
      return (bId && bId === normId) || (bRef && bRef === normRef);
    });

    for (const t of relatedTasks) {
      // Auto-complete booking confirmation or status SLAs
      this.completeTask(
        t.id, 
        user?.name || 'Automated Business Action Trigger', 
        `Auto-resolved upon booking status change to ${newStatus}`
      );
    }
  }

  /**
   * Called when a payment proof is verified.
   * Auto-completes payment verification tasks.
   */
  public handlePaymentVerified(
    bookingId: string, 
    bookingRef: string, 
    proofId: string, 
    user?: User | null
  ) {
    const normId = this.normalizeId(bookingId);
    const normRef = this.normalizeId(bookingRef);
    const normProof = this.normalizeId(proofId);

    const relatedTasks = this.allTasksCache.filter(t => {
      if (!this.isTaskActive(t)) return false;
      const bId = this.normalizeId(t.bookingId);
      const bRef = this.normalizeId(t.bookingReference);
      const pId = this.normalizeId(t.paymentId);
      const isPayCategory = t.category === 'PAYMENT_REMINDER' || t.title.toLowerCase().includes('payment');
      return ((bId && bId === normId) || (bRef && bRef === normRef) || (pId && pId === normProof)) && isPayCategory;
    });

    for (const t of relatedTasks) {
      this.completeTask(
        t.id, 
        user?.name || 'Payment Verification Trigger', 
        'Auto-resolved upon successful payment audit verification'
      );
    }
  }

  /**
   * Called when a quote is converted or accepted.
   * Auto-completes quote follow-up tasks.
   */
  public handleQuoteStatusChanged(
    quoteId: string, 
    quoteNumber: string, 
    newStatus: string, 
    user?: User | null
  ) {
    if (!['ACCEPTED', 'CONVERTED', 'REJECTED'].includes(newStatus)) return;

    const normId = this.normalizeId(quoteId);
    const normNum = this.normalizeId(quoteNumber);

    const relatedTasks = this.allTasksCache.filter(t => {
      if (!this.isTaskActive(t)) return false;
      const qId = this.normalizeId(t.quoteId);
      const qNum = this.normalizeId(t.quoteNumber);
      return (qId && qId === normId) || (qNum && qNum === normNum);
    });

    for (const t of relatedTasks) {
      this.completeTask(
        t.id, 
        user?.name || 'Quotation Workflow Trigger', 
        `Auto-resolved upon quote status update to ${newStatus}`
      );
    }
  }

  /**
   * Called when a lead status changes.
   */
  public handleLeadStatusChanged(
    leadId: string, 
    leadNumber: string, 
    newStatus: string, 
    user?: User | null
  ) {
    if (!['WON', 'LOST', 'CONTACTED', 'CONVERTED'].includes(newStatus)) return;

    const normId = this.normalizeId(leadId);
    const normNum = this.normalizeId(leadNumber);

    const relatedTasks = this.allTasksCache.filter(t => {
      if (!this.isTaskActive(t)) return false;
      const lId = this.normalizeId(t.leadId);
      const lNum = this.normalizeId(t.leadNumber);
      return (lId && lId === normId) || (lNum && lNum === normNum);
    });

    for (const t of relatedTasks) {
      this.completeTask(
        t.id, 
        user?.name || 'CRM Lead Workflow Trigger', 
        `Auto-resolved upon CRM lead update to ${newStatus}`
      );
    }
  }

  // ==============================================================
  // NAVIGATION RESOLVER & UNIVERSAL ENTITY ROUTE RESOLUTION
  // ==============================================================

  /**
   * Universal Entity Route Resolver: Translates an Action Center task or entity reference
   * into a canonical, record-level deep link and target configuration.
   * NO ACTION CENTER TASK MAY EXIST WITHOUT A VALID TARGET.
   */
  public getActionTarget(task: CalendarTask): ActionTarget {
    const entityType: ActionCenterEntityType = task.entityType || (
      task.bookingReference || task.bookingId ? 'BOOKING' :
      task.leadNumber || task.leadId ? 'LEAD' :
      task.quoteNumber || task.quoteId ? 'QUOTE' :
      task.paymentId ? 'PAYMENT' :
      task.userId ? 'USER' : 'TASK'
    );

    const rawTargetId = task.entityId || 
      task.quoteId || task.quoteNumber ||
      task.bookingId || task.bookingReference || 
      task.leadId || task.leadNumber || 
      task.userId || task.paymentId || task.id;
    const targetId = String(rawTargetId || '').trim();

    let isRecordAvailable = true;
    let section = 'OPERATIONS';
    let subTab = 'CALENDAR_TASKS';
    let targetRoute = task.targetRoute || `/admin/tasks/${task.id}`;
    let label = task.title || 'Action Item';
    let actionRequired = task.actionRequired || task.requiredAction || 'Operational action required';
    let targetElementId: string | undefined = undefined;

    switch (entityType) {
      case 'QUOTE': {
        section = 'LEAD_MANAGEMENT';
        subTab = 'QUOTES';
        targetRoute = `/admin/quotes/${targetId}`;
        label = `Quote #${task.quoteNumber || targetId}`;
        actionRequired = task.actionRequired || 'Follow up on quote with client or booking agent';
        targetElementId = 'quote-followup-section';

        // Verify record existence against live database
        const allQuotes = this.db.getAllSavedQuotes() || [];
        const normTarget = this.normalizeId(targetId);
        const exists = allQuotes.some(q => 
          this.normalizeId(q.id) === normTarget || 
          this.normalizeId(q.quoteNumber) === normTarget
        );
        isRecordAvailable = exists;
        break;
      }

      case 'BOOKING': {
        section = 'BOOKING_MANAGEMENT';
        subTab = 'BOOKINGS';
        targetRoute = `/admin/bookings/${targetId}`;
        label = `Booking #${task.bookingReference || targetId}`;
        actionRequired = task.actionRequired || 'Review & confirm ground reservation';

        const allBookings = this.db.getAllBookings() || [];
        const normTarget = this.normalizeId(targetId);
        const exists = allBookings.some(b => 
          this.normalizeId(b.id) === normTarget || 
          this.normalizeId(b.bookingReference) === normTarget ||
          this.normalizeId((b as any).referenceNumber) === normTarget
        );
        isRecordAvailable = exists;
        break;
      }

      case 'LEAD': {
        section = 'LEAD_MANAGEMENT';
        subTab = 'LEADS';
        targetRoute = `/admin/leads/${targetId}`;
        label = `Lead #${task.leadNumber || targetId}`;
        actionRequired = task.actionRequired || 'Initial consultation and lead contact';

        const allLeads = this.db.getLeads() || [];
        const normTarget = this.normalizeId(targetId);
        const exists = allLeads.some(l => 
          this.normalizeId(l.id) === normTarget || 
          this.normalizeId(l.leadNumber) === normTarget
        );
        isRecordAvailable = exists;
        break;
      }

      case 'PAYMENT': {
        section = 'BOOKING_MANAGEMENT';
        subTab = 'BOOKINGS';
        const bookingRef = task.bookingId || task.bookingReference || targetId;
        targetRoute = `/admin/payments/${bookingRef}`;
        targetElementId = 'booking-payment-proofs-section';
        label = `Payment Verification #${bookingRef}`;
        actionRequired = task.actionRequired || 'Audit & verify passenger payment tranche';

        const allBookings = this.db.getAllBookings() || [];
        const normTarget = this.normalizeId(bookingRef);
        const exists = allBookings.some(b => 
          this.normalizeId(b.id) === normTarget || 
          this.normalizeId(b.bookingReference) === normTarget ||
          this.normalizeId((b as any).referenceNumber) === normTarget
        );
        isRecordAvailable = exists;
        break;
      }

      case 'USER': {
        section = 'ACCOUNT_MANAGEMENT';
        subTab = 'USERS_ACCESS';
        targetRoute = `/admin/users/${targetId}`;
        label = `User Access #${targetId}`;
        actionRequired = task.actionRequired || 'Review and approve B2B agent credentials';

        const allUsers = this.db.getUsers() || [];
        const normTarget = this.normalizeId(targetId);
        const exists = allUsers.some(u => 
          this.normalizeId(u.id) === normTarget || 
          this.normalizeId(u.email) === normTarget
        );
        isRecordAvailable = exists;
        break;
      }

      case 'PRODUCT':
      case 'PACKAGE': {
        section = 'PRODUCT_MANAGEMENT';
        subTab = 'PRODUCTS';
        targetRoute = `/admin/products/${targetId}`;
        label = `Product #${targetId}`;
        break;
      }

      case 'HOTEL': {
        section = 'HOTEL_MANAGEMENT';
        subTab = 'HOTELS';
        targetRoute = `/admin/hotels/${targetId}`;
        label = `Hotel #${targetId}`;
        break;
      }

      case 'TASK':
      case 'JOB':
      default: {
        section = 'OPERATIONS';
        subTab = 'CALENDAR_TASKS';
        targetRoute = `/admin/tasks/${task.id}`;
        label = task.title || `Task #${task.id}`;
        break;
      }
    }

    return {
      entityType,
      entityId: targetId,
      targetRoute,
      section,
      subTab,
      recordId: targetId,
      targetElementId,
      actionRequired,
      label,
      isRecordAvailable
    };
  }

  /**
   * Translates a task or (entityType, entityId) into an operational navigation target
   */
  public resolveNavigationTarget(task: CalendarTask): NavigationTarget {
    const target = this.getActionTarget(task);
    return {
      section: target.section,
      subTab: target.subTab,
      recordId: target.recordId,
      targetElementId: target.targetElementId,
      label: target.label,
      targetRoute: target.targetRoute
    };
  }
}

export const actionCenterReminderService = ActionCenterReminderService.getInstance();
