import { CalendarTask, TaskStatus, TaskImportance } from '../../../types';

export interface SalesTemplate {
  id: string;
  name: string;
  category: 'SALES_FUNNEL' | 'OPERATIONS' | 'FINANCE' | 'SUPPLIER';
  relatedType: 'LEAD' | 'QUOTE' | 'BOOKING' | 'SUPPLIER' | 'PAYMENT' | 'CUSTOMER';
  importance: TaskImportance;
  completeWithinHours: number;
  timePreset: 'NONE' | 'MORNING' | 'AFTERNOON' | 'EVENING';
  reminderPreset: 'NONE' | 'ON_DUE_DATE' | 'ONE_DAY_BEFORE';
  defaultNotes: string;
  badge: string;
}

export const SALES_TEMPLATES: SalesTemplate[] = [
  {
    id: 'call-new-lead',
    name: 'Call new lead',
    category: 'SALES_FUNNEL',
    relatedType: 'LEAD',
    importance: 'URGENT',
    completeWithinHours: 2,
    timePreset: 'MORNING',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'Immediate outreach: qualify client destination, group size, estimated dates, and budget preference.',
    badge: 'Quick Response'
  },
  {
    id: 'send-first-response',
    name: 'Send first response & itinerary intro',
    category: 'SALES_FUNNEL',
    relatedType: 'LEAD',
    importance: 'NORMAL',
    completeWithinHours: 4,
    timePreset: 'AFTERNOON',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'Send welcome email, confirm receipt of enquiry, and introduce proposed destination highlights.',
    badge: 'Sales Funnel'
  },
  {
    id: 'follow-up-quotation',
    name: 'Follow up on quotation',
    category: 'SALES_FUNNEL',
    relatedType: 'QUOTE',
    importance: 'IMPORTANT',
    completeWithinHours: 24,
    timePreset: 'MORNING',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'Connect with traveler or B2B agent to review proposal details, address questions, and discuss revisions.',
    badge: 'Follow-Up'
  },
  {
    id: 'ask-booking-confirmation',
    name: 'Ask for booking confirmation & deposit',
    category: 'SALES_FUNNEL',
    relatedType: 'QUOTE',
    importance: 'IMPORTANT',
    completeWithinHours: 24,
    timePreset: 'AFTERNOON',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'Inquire if client is ready to lock in rates and dates. Request initial deposit or booking token.',
    badge: 'Closing'
  },
  {
    id: 'send-revised-proposal',
    name: 'Send revised quotation',
    category: 'SALES_FUNNEL',
    relatedType: 'QUOTE',
    importance: 'URGENT',
    completeWithinHours: 6,
    timePreset: 'AFTERNOON',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'Apply requested adjustments (hotels, room type, activities) and reissue updated proposal PDF.',
    badge: 'Fast Turnaround'
  },
  {
    id: 'proposal-downloaded-alert',
    name: 'Follow up after proposal download',
    category: 'SALES_FUNNEL',
    relatedType: 'QUOTE',
    importance: 'IMPORTANT',
    completeWithinHours: 4,
    timePreset: 'MORNING',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'The client or B2B agent just downloaded the quotation. Reach out while the itinerary is top of mind.',
    badge: 'High Intent'
  },
  {
    id: 'collect-missing-details',
    name: 'Collect missing travel details & passports',
    category: 'OPERATIONS',
    relatedType: 'BOOKING',
    importance: 'NORMAL',
    completeWithinHours: 48,
    timePreset: 'MORNING',
    reminderPreset: 'ONE_DAY_BEFORE',
    defaultNotes: 'Obtain passenger passport copies, dietary restrictions, arrival flight numbers, and bed preferences.',
    badge: 'Guest Prep'
  },
  {
    id: 'confirm-hotel-availability',
    name: 'Confirm hotel availability & room block',
    category: 'OPERATIONS',
    relatedType: 'BOOKING',
    importance: 'IMPORTANT',
    completeWithinHours: 12,
    timePreset: 'AFTERNOON',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'Verify room block, check-in dates, meal plan, and special guest requests directly with hotel reservation desk.',
    badge: 'Operations'
  },
  {
    id: 'request-supplier-confirmation',
    name: 'Request supplier confirmation voucher',
    category: 'SUPPLIER',
    relatedType: 'SUPPLIER',
    importance: 'URGENT',
    completeWithinHours: 6,
    timePreset: 'MORNING',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'Follow up with local DMC/ground operator for driver contact details, guide roster, and service vouchers.',
    badge: 'Ground Ops'
  },
  {
    id: 'send-payment-reminder',
    name: 'Send balance payment reminder',
    category: 'FINANCE',
    relatedType: 'PAYMENT',
    importance: 'IMPORTANT',
    completeWithinHours: 24,
    timePreset: 'MORNING',
    reminderPreset: 'ONE_DAY_BEFORE',
    defaultNotes: 'Notify client/agent that final balance payment is due prior to issuing travel vouchers.',
    badge: 'Collections'
  },
  {
    id: 'agent-check-in',
    name: 'Check whether B2B agent needs help',
    category: 'SALES_FUNNEL',
    relatedType: 'LEAD',
    importance: 'NORMAL',
    completeWithinHours: 48,
    timePreset: 'AFTERNOON',
    reminderPreset: 'ON_DUE_DATE',
    defaultNotes: 'Check in with partner agency. Offer customized collateral or itinerary tweaking to help win the deal.',
    badge: 'B2B Partner'
  },
  {
    id: 'close-inactive-lead',
    name: 'Close inactive lead or archive',
    category: 'SALES_FUNNEL',
    relatedType: 'LEAD',
    importance: 'LOW',
    completeWithinHours: 72,
    timePreset: 'EVENING',
    reminderPreset: 'NONE',
    defaultNotes: 'Perform final courtesy check-in. If unresponsive, mark lead as cold or archived for future marketing.',
    badge: 'Funnel Hygiene'
  }
];

// Human-friendly status normalization
export function getTaskProgressLabel(status: TaskStatus | string): string {
  switch (status) {
    case 'TO_DO':
    case 'OPEN':
    case 'PENDING':
      return 'To Do';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'WAITING_FOR_REPLY':
      return 'Waiting for Reply';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'SNOOZED':
      return 'Snoozed';
    case 'ARCHIVED':
      return 'Archived';
    case 'OVERDUE':
      return 'To Do';
    default:
      return 'To Do';
  }
}

export function getTaskProgressBadgeColor(status: TaskStatus | string): string {
  switch (status) {
    case 'TO_DO':
    case 'OPEN':
    case 'PENDING':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'IN_PROGRESS':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'WAITING_FOR_REPLY':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'SNOOZED':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'ARCHIVED':
      return 'bg-slate-100 text-slate-500 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getTaskImportanceLabel(importance?: TaskImportance | string): string {
  switch (importance) {
    case 'URGENT':
    case 'CRITICAL':
      return 'Urgent';
    case 'IMPORTANT':
    case 'HIGH':
      return 'Important';
    case 'NORMAL':
    case 'MEDIUM':
      return 'Normal';
    case 'LOW':
      return 'Low';
    default:
      return 'Normal';
  }
}

export function getTaskImportanceBadgeColor(importance?: TaskImportance | string): string {
  switch (importance) {
    case 'URGENT':
    case 'CRITICAL':
      return 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
    case 'IMPORTANT':
    case 'HIGH':
      return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
    case 'NORMAL':
    case 'MEDIUM':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'LOW':
      return 'bg-slate-50 text-slate-500 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

// Compute simple human time status without technical SLA acronyms
export function getTaskLateInfo(task: CalendarTask): {
  isOverdue: boolean;
  isDueSoon: boolean;
  timeLabel: string;
  badgeClass: string;
} {
  const isCompleted = task.status === 'COMPLETED';
  if (isCompleted) {
    return {
      isOverdue: false,
      isDueSoon: false,
      timeLabel: 'Completed',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    };
  }

  if (task.status === 'CANCELLED' || task.status === 'ARCHIVED') {
    return {
      isOverdue: false,
      isDueSoon: false,
      timeLabel: task.status === 'ARCHIVED' ? 'Archived' : 'Cancelled',
      badgeClass: 'text-slate-500 bg-slate-50 border-slate-200'
    };
  }

  const now = Date.now();
  let dueMs: number;

  if (task.dueAt) {
    dueMs = new Date(task.dueAt).getTime();
  } else if (task.startDate) {
    const timeStr = task.startTime || '18:00';
    dueMs = new Date(`${task.startDate}T${timeStr}:00`).getTime();
  } else if (task.createdAt) {
    const hours = task.slaHours || 24;
    dueMs = new Date(task.createdAt).getTime() + hours * 3600 * 1000;
  } else {
    dueMs = now + 24 * 3600 * 1000;
  }

  const diffMs = dueMs - now;
  const isOverdue = diffMs < 0;
  const isDueSoon = !isOverdue && diffMs <= 4 * 3600 * 1000; // within 4 hours

  const absDiff = Math.abs(diffMs);
  const diffHours = Math.floor(absDiff / (1000 * 60 * 60));
  const diffMins = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let timeString = '';
  if (diffDays > 0) {
    timeString = `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    timeString = `${diffHours}h ${diffMins}m`;
  } else {
    timeString = `${diffMins}m`;
  }

  if (isOverdue) {
    return {
      isOverdue: true,
      isDueSoon: false,
      timeLabel: `Overdue by ${timeString}`,
      badgeClass: 'text-rose-700 bg-rose-50 border-rose-200 font-bold'
    };
  }

  if (isDueSoon) {
    return {
      isOverdue: false,
      isDueSoon: true,
      timeLabel: `Due in ${timeString}`,
      badgeClass: 'text-amber-800 bg-amber-50 border-amber-200 font-semibold'
    };
  }

  return {
    isOverdue: false,
    isDueSoon: false,
    timeLabel: `Due in ${timeString}`,
    badgeClass: 'text-slate-600 bg-slate-100 border-slate-200'
  };
}
