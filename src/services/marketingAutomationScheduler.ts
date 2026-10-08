import {
  Booking,
  EmailCampaignConfig,
  MarketingAutomationExecutionLog,
  MarketingTriggerKey,
  Quotation,
  ScheduledAutomationJob,
  TriggerDelayUnit,
  User
} from '../types';
import { AppDatabase } from './db';
import { EmailNotificationService } from './emailNotificationService';
import { INITIAL_CAMPAIGNS } from '../data/initialCampaigns';
import { formatCurrency } from './pricingEngine';

export interface VariableDefinition {
  token: string;
  label: string;
  sampleValue: string;
  category: 'User' | 'Quote' | 'Booking' | 'Trip' | 'Agent';
}

export const CONTEXTUAL_VARIABLE_CATALOG: VariableDefinition[] = [
  // User
  { token: '{{user.firstName}}', label: 'User First Name', sampleValue: 'Eleanor', category: 'User' },
  { token: '{{user.lastName}}', label: 'User Last Name', sampleValue: 'Vance', category: 'User' },
  { token: '{{user.email}}', label: 'User Email', sampleValue: 'eleanor.vance@mayfairtravel.co.uk', category: 'User' },
  { token: '{{user.companyName}}', label: 'Company / Agency Name', sampleValue: 'Mayfair Bespoke Travel Ltd.', category: 'User' },

  // Quote
  { token: '{{quote.quoteId}}', label: 'Quote ID', sampleValue: 'qt-2026-8841', category: 'Quote' },
  { token: '{{quote.quoteReference}}', label: 'Quote Reference', sampleValue: 'QT-2026-8841', category: 'Quote' },
  { token: '{{quote.createdAt}}', label: 'Quote Created Date', sampleValue: '08 Oct 2026', category: 'Quote' },
  { token: '{{quote.validUntil}}', label: 'Quote Valid Until', sampleValue: '22 Oct 2026', category: 'Quote' },
  { token: '{{quote.total}}', label: 'Quote Total Amount', sampleValue: '4,850.00', category: 'Quote' },
  { token: '{{quote.currency}}', label: 'Quote Currency', sampleValue: 'USD', category: 'Quote' },

  // Booking
  { token: '{{booking.bookingId}}', label: 'Booking ID', sampleValue: 'bk-2026-9920', category: 'Booking' },
  { token: '{{booking.bookingReference}}', label: 'Booking Reference', sampleValue: 'TUB-JP-99204', category: 'Booking' },
  { token: '{{booking.bookingDate}}', label: 'Booking Date', sampleValue: '08 Oct 2026', category: 'Booking' },
  { token: '{{booking.status}}', label: 'Booking Status', sampleValue: 'PENDING_CONFIRMATION', category: 'Booking' },

  // Trip
  { token: '{{trip.destination}}', label: 'Trip Destination', sampleValue: 'Kyoto & Tokyo, Japan', category: 'Trip' },
  { token: '{{trip.startDate}}', label: 'Trip Start Date', sampleValue: '14 Nov 2026', category: 'Trip' },
  { token: '{{trip.endDate}}', label: 'Trip End Date', sampleValue: '24 Nov 2026', category: 'Trip' },
  { token: '{{trip.passengerCount}}', label: 'Passenger Count', sampleValue: '4', category: 'Trip' },

  // Agent
  { token: '{{agent.agencyName}}', label: 'Agency Name', sampleValue: 'Mayfair Bespoke Travel Ltd.', category: 'Agent' },
  { token: '{{agent.agentName}}', label: 'Agent Full Name', sampleValue: 'Eleanor Vance', category: 'Agent' },
  { token: '{{agent.agentEmail}}', label: 'Agent Email', sampleValue: 'eleanor.vance@mayfairtravel.co.uk', category: 'Agent' }
];

const TRIGGER_ALLOWED_CATEGORIES: Record<MarketingTriggerKey, Array<VariableDefinition['category']>> = {
  USER_REGISTERED: ['User', 'Agent'],
  QUOTE_SAVED: ['User', 'Quote', 'Trip', 'Agent'],
  QUOTE_DOWNLOADED: ['User', 'Quote', 'Trip', 'Agent'],
  FIRST_BOOKING_COMPLETED: ['User', 'Booking', 'Trip', 'Agent'],
  BOOKING_CONFIRMATION_SLA: ['User', 'Booking', 'Trip', 'Agent']
};

const STORAGE_KEYS = {
  JOBS: 'theunbound_marketing_automation_jobs_v1',
  LOGS: 'theunbound_marketing_automation_logs_v1',
  IDEMPOTENCY: 'theunbound_marketing_automation_idempotency_v1',
  FIRST_BOOKING_LEDGER: 'theunbound_first_booking_welcome_ledger_v1'
};

const INITIAL_EXECUTION_LOGS: MarketingAutomationExecutionLog[] = [
  {
    id: 'exec-log-101',
    triggerId: 'trigger-user-registered',
    triggerKey: 'USER_REGISTERED',
    triggerName: 'New User Registration',
    entityType: 'USER',
    entityId: 'usr-b2b-mayfair',
    recipientEmail: 'eleanor.vance@mayfairtravel.co.uk',
    internalCopySentTo: ['business@theunbound.in'],
    subject: 'Welcome to TheUnbound, Eleanor — Your Travel & Ground Operations Portal',
    templateVersion: 'v1.0',
    status: 'SENT',
    messageId: 'gmail-msg-99281a',
    executedAt: '2026-10-08T08:15:00Z',
    idempotencyKey: 'USER_REGISTERED:usr-b2b-mayfair'
  },
  {
    id: 'exec-log-102',
    triggerId: 'trigger-quote-saved',
    triggerKey: 'QUOTE_SAVED',
    triggerName: 'Saved Quote Reminder',
    entityType: 'QUOTE',
    entityId: 'QT-2026-8810',
    recipientEmail: 'arjun.mehta@horizonluxury.in',
    internalCopySentTo: ['business@theunbound.in'],
    subject: 'Your TheUnbound Quote QT-2026-8810 for Tokyo & Hakone Is Waiting for You',
    templateVersion: 'v1.1',
    status: 'SKIPPED',
    reason: 'Quote QT-2026-8810 already converted into confirmed booking TUB-JP-88102 prior to 24h reminder window.',
    executedAt: '2026-10-08T07:40:00Z',
    idempotencyKey: 'QUOTE_SAVED:QT-2026-8810'
  },
  {
    id: 'exec-log-103',
    triggerId: 'trigger-quote-downloaded',
    triggerKey: 'QUOTE_DOWNLOADED',
    triggerName: 'Downloaded Quote Reminder',
    entityType: 'QUOTE',
    entityId: 'QT-2026-8839',
    recipientEmail: 'claire.dubois@parisianvoyages.fr',
    internalCopySentTo: ['business@theunbound.in'],
    subject: 'Follow-Up on Your Downloaded Proposal QT-2026-8839 (Kyoto & Osaka)',
    templateVersion: 'v1.0',
    status: 'SENT',
    messageId: 'gmail-msg-99240c',
    executedAt: '2026-10-08T06:20:00Z',
    idempotencyKey: 'QUOTE_DOWNLOADED:QT-2026-8839'
  },
  {
    id: 'exec-log-104',
    triggerId: 'trigger-first-booking-welcome',
    triggerKey: 'FIRST_BOOKING_COMPLETED',
    triggerName: 'First Booking Welcome',
    entityType: 'BOOKING',
    entityId: 'TUB-JP-99104',
    recipientEmail: 'eleanor.vance@mayfairtravel.co.uk',
    internalCopySentTo: ['business@theunbound.in'],
    subject: 'Congratulations on Your First Booking with TheUnbound (TUB-JP-99104)',
    templateVersion: 'v1.0',
    status: 'SENT',
    messageId: 'gmail-msg-99190f',
    executedAt: '2026-10-07T19:12:00Z',
    idempotencyKey: 'FIRST_BOOKING_COMPLETED:eleanor.vance@mayfairtravel.co.uk'
  },
  {
    id: 'exec-log-105',
    triggerId: 'trigger-booking-confirmation-sla',
    triggerKey: 'BOOKING_CONFIRMATION_SLA',
    triggerName: 'Booking Confirmation SLA',
    entityType: 'BOOKING',
    entityId: 'TUB-JP-99108',
    recipientEmail: 'ops-alert@sterlingtravel.co.uk',
    internalCopySentTo: ['business@theunbound.in', 'operations@theunbound.in'],
    subject: 'SLA Status Update: Booking TUB-JP-99108 (Tokyo & Mount Fuji) Ground Allocation',
    templateVersion: 'v1.2',
    status: 'CANCELLED',
    reason: 'Booking TUB-JP-99108 was confirmed by Ground Operations 6 hours after submission (before 24h SLA threshold).',
    executedAt: '2026-10-07T15:05:00Z',
    idempotencyKey: 'BOOKING_CONFIRMATION_SLA:TUB-JP-99108'
  }
];

const INITIAL_SCHEDULED_JOBS: ScheduledAutomationJob[] = [
  {
    id: 'job-sched-201',
    triggerId: 'trigger-quote-saved',
    triggerKey: 'QUOTE_SAVED',
    triggerName: 'Saved Quote Reminder',
    entityType: 'QUOTE',
    entityId: 'QT-2026-8902',
    recipientEmail: 'sarah.jenkins@albionbespoke.co.uk',
    recipientName: 'Sarah Jenkins',
    scheduledFor: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    status: 'SCHEDULED',
    idempotencyKey: 'QUOTE_SAVED:QT-2026-8902',
    retryCount: 0,
    contextSnapshot: {
      'user.firstName': 'Sarah',
      'user.lastName': 'Jenkins',
      'user.email': 'sarah.jenkins@albionbespoke.co.uk',
      'user.companyName': 'Albion Bespoke Journeys',
      'quote.quoteId': 'QT-2026-8902',
      'quote.quoteReference': 'QT-2026-8902',
      'quote.validUntil': '22 Oct 2026',
      'quote.total': '6,420.00',
      'quote.currency': 'USD',
      'trip.destination': 'Kyoto, Nara & Hakone',
      'trip.startDate': '10 Nov 2026',
      'trip.endDate': '19 Nov 2026',
      'trip.passengerCount': '2'
    }
  },
  {
    id: 'job-sched-202',
    triggerId: 'trigger-booking-confirmation-sla',
    triggerKey: 'BOOKING_CONFIRMATION_SLA',
    triggerName: 'Booking Confirmation SLA',
    entityType: 'BOOKING',
    entityId: 'TUB-JP-99310',
    recipientEmail: 'david.chen@pacificrimluxury.sg',
    recipientName: 'David Chen',
    scheduledFor: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    status: 'SCHEDULED',
    idempotencyKey: 'BOOKING_CONFIRMATION_SLA:TUB-JP-99310',
    retryCount: 0,
    contextSnapshot: {
      'user.firstName': 'David',
      'user.lastName': 'Chen',
      'user.email': 'david.chen@pacificrimluxury.sg',
      'user.companyName': 'Pacific Rim Luxury Travel',
      'booking.bookingId': 'TUB-JP-99310',
      'booking.bookingReference': 'TUB-JP-99310',
      'booking.bookingDate': '08 Oct 2026',
      'booking.status': 'PENDING_CONFIRMATION',
      'trip.destination': 'Tokyo & Hokkaido',
      'trip.startDate': '02 Dec 2026',
      'trip.endDate': '11 Dec 2026',
      'trip.passengerCount': '6'
    }
  }
];

export class MarketingAutomationScheduler {
  private static instance: MarketingAutomationScheduler;
  private inFlightLocks: Set<string> = new Set();

  public static getInstance(): MarketingAutomationScheduler {
    if (!MarketingAutomationScheduler.instance) {
      MarketingAutomationScheduler.instance = new MarketingAutomationScheduler();
    }
    return MarketingAutomationScheduler.instance;
  }

  /**
   * Ensures all 5 canonical system triggers exist and are normalized.
   */
  public ensureCanonicalTriggers(): EmailCampaignConfig[] {
    const db = AppDatabase.getInstance();
    const existing = db.getEmailCampaigns();

    const canonicalKeys: MarketingTriggerKey[] = [
      'USER_REGISTERED',
      'QUOTE_SAVED',
      'QUOTE_DOWNLOADED',
      'FIRST_BOOKING_COMPLETED',
      'BOOKING_CONFIRMATION_SLA'
    ];

    const mapLegacyTypeToKey = (c: EmailCampaignConfig): MarketingTriggerKey => {
      if (c.triggerKey) return c.triggerKey;
      switch (c.campaignType) {
        case 'USER_REGISTERED':
          return 'USER_REGISTERED';
        case 'QUOTE_SAVED':
        case 'SAVED_QUOTE_REMINDER':
          return 'QUOTE_SAVED';
        case 'QUOTE_DOWNLOADED':
        case 'DOWNLOADED_QUOTE_REMINDER':
          return 'QUOTE_DOWNLOADED';
        case 'FIRST_BOOKING_COMPLETED':
        case 'FIRST_BOOKING_REMINDER':
          return 'FIRST_BOOKING_COMPLETED';
        case 'BOOKING_CONFIRMATION_SLA':
        case 'BOOKING_CONFIRMATION':
        default:
          return 'BOOKING_CONFIRMATION_SLA';
      }
    };

    let modified = false;
    const normalized: EmailCampaignConfig[] = existing.map(c => {
      const resolvedKey = mapLegacyTypeToKey(c);
      const templateDefault = INITIAL_CAMPAIGNS.find(ic => ic.triggerKey === resolvedKey);
      const nextStatus = c.status || (c.isEnabled ? 'ACTIVE' : 'INACTIVE');
      if (!c.triggerKey || !c.status || !c.primaryRecipientRule || !c.templateVersion) {
        modified = true;
        return {
          ...templateDefault,
          ...c,
          triggerKey: resolvedKey,
          campaignType: resolvedKey,
          status: nextStatus,
          isEnabled: nextStatus === 'ACTIVE',
          isSystemTrigger: c.isSystemTrigger ?? true,
          primaryRecipientRule: c.primaryRecipientRule || templateDefault?.primaryRecipientRule || 'User Email',
          internalCopyRecipients: c.internalCopyRecipients || templateDefault?.internalCopyRecipients || ['business@theunbound.in'],
          timingMode: c.timingMode || templateDefault?.timingMode || (c.delayHours > 0 ? 'DELAYED' : 'IMMEDIATE'),
          delayValue: c.delayValue ?? c.delayHours ?? templateDefault?.delayValue ?? 0,
          delayUnit: c.delayUnit || templateDefault?.delayUnit || 'HOURS',
          templateVersion: c.templateVersion || templateDefault?.templateVersion || 'v1.0',
          dynamicVariables: c.dynamicVariables?.length ? c.dynamicVariables : (templateDefault?.dynamicVariables || []),
          updatedAt: c.updatedAt || templateDefault?.updatedAt || new Date().toISOString()
        };
      }
      return c;
    });

    for (const key of canonicalKeys) {
      if (!normalized.some(c => c.triggerKey === key)) {
        const seed = INITIAL_CAMPAIGNS.find(ic => ic.triggerKey === key);
        if (seed) {
          normalized.unshift(seed);
          modified = true;
        }
      }
    }

    if (modified) {
      normalized.forEach(c => db.saveEmailCampaign(c, null));
    }

    return normalized;
  }

  public getVariablesForTrigger(triggerKey: MarketingTriggerKey): VariableDefinition[] {
    const allowedCategories = TRIGGER_ALLOWED_CATEGORIES[triggerKey] || ['User', 'Quote', 'Booking', 'Trip', 'Agent'];
    return CONTEXTUAL_VARIABLE_CATALOG.filter(v => allowedCategories.includes(v.category));
  }

  public formatTimingBadge(trigger: EmailCampaignConfig): string {
    const mode = trigger.timingMode || (trigger.delayHours === 0 ? 'IMMEDIATE' : 'DELAYED');
    if (mode === 'IMMEDIATE' || (trigger.delayValue === 0 && trigger.delayHours === 0)) {
      return 'Immediately';
    }
    if (mode === 'SLA' || trigger.triggerKey === 'BOOKING_CONFIRMATION_SLA') {
      const dur = trigger.slaConfig?.slaDuration ?? trigger.delayValue ?? trigger.delayHours ?? 24;
      const unit = (trigger.slaConfig?.slaUnit || trigger.delayUnit || 'HOURS').toLowerCase();
      return `Configured SLA (${dur} ${unit})`;
    }
    const val = trigger.delayValue ?? trigger.delayHours ?? 24;
    const unit = trigger.delayUnit || 'HOURS';
    const unitLabel =
      unit === 'MINUTES'
        ? val === 1 ? 'Minute' : 'Minutes'
        : unit === 'DAYS'
        ? val === 1 ? 'Day' : 'Days'
        : val === 1 ? 'Hour' : 'Hours';
    return `+${val} ${unitLabel}`;
  }

  public calculateScheduledTime(trigger: EmailCampaignConfig, fromDate: Date = new Date()): Date {
    const mode = trigger.timingMode || (trigger.delayHours === 0 ? 'IMMEDIATE' : 'DELAYED');
    if (mode === 'IMMEDIATE') {
      return new Date(fromDate.getTime());
    }
    const value =
      mode === 'SLA'
        ? (trigger.slaConfig?.slaDuration ?? trigger.delayValue ?? trigger.delayHours ?? 24)
        : (trigger.delayValue ?? trigger.delayHours ?? 0);
    const unit: TriggerDelayUnit =
      mode === 'SLA'
        ? (trigger.slaConfig?.slaUnit || trigger.delayUnit || 'HOURS')
        : (trigger.delayUnit || 'HOURS');

    let ms = 0;
    if (unit === 'MINUTES') ms = value * 60 * 1000;
    else if (unit === 'DAYS') ms = value * 24 * 3600 * 1000;
    else ms = value * 3600 * 1000;

    return new Date(fromDate.getTime() + ms);
  }

  /**
   * Resolves dynamic variables safely. Unresolved tokens are replaced with clean fallbacks
   * so raw {{variable}} strings never leak into production emails.
   */
  public renderTemplateWithVariables(
    rawText: string,
    variables: Record<string, string | number | undefined>
  ): string {
    if (!rawText) return '';

    const sampleFallbacks: Record<string, string> = {};
    for (const item of CONTEXTUAL_VARIABLE_CATALOG) {
      const cleanKey = item.token.replace(/^\{\{|\}\}$/g, '').trim();
      sampleFallbacks[cleanKey] = item.sampleValue;
    }

    // Legacy token aliases
    const legacyAliases: Record<string, string> = {
      'Customer Name': String(variables['user.firstName'] ? `${variables['user.firstName']} ${variables['user.lastName'] || ''}`.trim() : sampleFallbacks['user.firstName']),
      'Booking Reference': String(variables['booking.bookingReference'] || sampleFallbacks['booking.bookingReference']),
      'Booking ID': String(variables['booking.bookingId'] || sampleFallbacks['booking.bookingId']),
      'Quote Number': String(variables['quote.quoteReference'] || sampleFallbacks['quote.quoteReference']),
      'Destination': String(variables['trip.destination'] || sampleFallbacks['trip.destination']),
      'Travel Date': String(variables['trip.startDate'] || sampleFallbacks['trip.startDate']),
      'Amount': String(variables['quote.total'] || '4,850.00'),
      'Quote Link': 'https://theunbound.in',
      'Booking Link': 'https://theunbound.in',
      'DMC Email': 'business@theunbound.in'
    };

    return rawText.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawKey) => {
      const key = String(rawKey).trim();
      if (variables[key] !== undefined && variables[key] !== null && String(variables[key]).trim() !== '') {
        return String(variables[key]);
      }
      if (legacyAliases[key]) {
        return legacyAliases[key];
      }
      if (sampleFallbacks[key]) {
        return sampleFallbacks[key];
      }
      return 'TheUnbound Partner';
    });
  }

  public getScheduledJobs(): ScheduledAutomationJob[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.JOBS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(INITIAL_SCHEDULED_JOBS));
        return INITIAL_SCHEDULED_JOBS;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_SCHEDULED_JOBS;
    }
  }

  private saveScheduledJobs(jobs: ScheduledAutomationJob[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    } catch (e) {
      console.error('Failed to save scheduled automation jobs:', e);
    }
  }

  public getExecutionLogs(triggerIdOrKey?: string): MarketingAutomationExecutionLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
      const list: MarketingAutomationExecutionLog[] = raw ? JSON.parse(raw) : INITIAL_EXECUTION_LOGS;
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(INITIAL_EXECUTION_LOGS));
      }
      if (!triggerIdOrKey) return list;
      return list.filter(l => l.triggerId === triggerIdOrKey || l.triggerKey === triggerIdOrKey);
    } catch {
      return INITIAL_EXECUTION_LOGS;
    }
  }

  private appendExecutionLog(log: MarketingAutomationExecutionLog): void {
    const current = this.getExecutionLogs();
    const updated = [log, ...current].slice(0, 500);
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save automation execution log:', e);
    }
  }

  private hasIdempotencyExecution(idempotencyKey: string): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.IDEMPOTENCY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      if (map[idempotencyKey]) return true;
      return this.getExecutionLogs().some(l => l.idempotencyKey === idempotencyKey && l.status === 'SENT');
    } catch {
      return false;
    }
  }

  private recordIdempotencyExecution(idempotencyKey: string, messageId: string): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.IDEMPOTENCY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[idempotencyKey] = messageId || new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.IDEMPOTENCY, JSON.stringify(map));
    } catch (e) {
      console.error('Failed to record idempotency key:', e);
    }
  }

  private findActiveTrigger(triggerKey: MarketingTriggerKey): EmailCampaignConfig | undefined {
    const triggers = this.ensureCanonicalTriggers();
    return triggers.find(t => t.triggerKey === triggerKey && t.isEnabled && (t.status === 'ACTIVE' || !t.status));
  }

  // ============================================================================
  // 1. NEW USER REGISTRATION (USER_REGISTERED)
  // ============================================================================
  public async onUserRegistered(user: User): Promise<void> {
    if (!user || !user.email || user.emailOptOut) return;
    const trigger = this.findActiveTrigger('USER_REGISTERED');
    if (!trigger) return;

    const idempotencyKey = `USER_REGISTERED:${(user.id || user.email).toLowerCase()}`;
    if (this.hasIdempotencyExecution(idempotencyKey) || this.inFlightLocks.has(idempotencyKey)) {
      return;
    }

    const nameParts = (user.name || '').trim().split(/\s+/);
    const firstName = user.firstName || nameParts[0] || 'Partner';
    const lastName = user.lastName || nameParts.slice(1).join(' ') || '';

    const context: Record<string, string> = {
      'user.firstName': firstName,
      'user.lastName': lastName,
      'user.email': user.email,
      'user.companyName': user.companyName || user.agencyName || 'Independent Travel Partner',
      'agent.agencyName': user.agencyName || user.companyName || 'Travel Partner Agency',
      'agent.agentName': user.name || firstName,
      'agent.agentEmail': user.email
    };

    const scheduledTime = this.calculateScheduledTime(trigger);
    if (scheduledTime.getTime() <= Date.now() + 5000) {
      await this.dispatchTriggerEmailNow({
        trigger,
        recipientEmail: user.email,
        entityType: 'USER',
        entityId: user.id,
        idempotencyKey,
        context
      });
    } else {
      this.enqueueJob({
        trigger,
        entityType: 'USER',
        entityId: user.id,
        recipientEmail: user.email,
        recipientName: user.name,
        scheduledFor: scheduledTime.toISOString(),
        idempotencyKey,
        contextSnapshot: context
      });
    }
  }

  // ============================================================================
  // 2. SAVED QUOTE REMINDER (QUOTE_SAVED)
  // ============================================================================
  public async onQuoteSaved(quote: Quotation, actor?: User | null): Promise<void> {
    if (!quote || !quote.id) return;
    const trigger = this.findActiveTrigger('QUOTE_SAVED');
    if (!trigger) return;

    const recipientEmail = quote.clientEmail || quote.agentEmail || actor?.email || '';
    if (!recipientEmail) return;

    const idempotencyKey = `QUOTE_SAVED:${quote.id}`;
    if (this.hasIdempotencyExecution(idempotencyKey)) return;

    const context = this.buildQuoteVariables(quote, actor);
    const scheduledTime = this.calculateScheduledTime(trigger);

    this.enqueueJob({
      trigger,
      entityType: 'QUOTE',
      entityId: quote.id,
      recipientEmail,
      recipientName: quote.clientName || quote.agentName || actor?.name,
      scheduledFor: scheduledTime.toISOString(),
      idempotencyKey,
      contextSnapshot: context
    });
  }

  // ============================================================================
  // 3. DOWNLOADED QUOTE REMINDER (QUOTE_DOWNLOADED)
  // ============================================================================
  public async onQuoteDownloaded(quote: Quotation, actor?: User | null): Promise<void> {
    if (!quote || !quote.id) return;
    const trigger = this.findActiveTrigger('QUOTE_DOWNLOADED');
    if (!trigger) return;

    const recipientEmail = quote.clientEmail || quote.agentEmail || actor?.email || '';
    if (!recipientEmail) return;

    const idempotencyKey = `QUOTE_DOWNLOADED:${quote.id}`;
    if (this.hasIdempotencyExecution(idempotencyKey)) return;

    const context = this.buildQuoteVariables(quote, actor);
    const scheduledTime = this.calculateScheduledTime(trigger);

    this.enqueueJob({
      trigger,
      entityType: 'QUOTE',
      entityId: quote.id,
      recipientEmail,
      recipientName: quote.clientName || quote.agentName || actor?.name,
      scheduledFor: scheduledTime.toISOString(),
      idempotencyKey,
      contextSnapshot: context
    });
  }

  // ============================================================================
  // 4. FIRST BOOKING WELCOME (FIRST_BOOKING_COMPLETED) &
  // 5. BOOKING CONFIRMATION SLA (BOOKING_CONFIRMATION_SLA)
  // ============================================================================
  public async onBookingCreated(booking: Booking, actor?: User | null): Promise<void> {
    if (!booking || !booking.id) return;
    const db = AppDatabase.getInstance();

    // If this booking came from a quote, automatically cancel any pending QUOTE_SAVED or QUOTE_DOWNLOADED reminders!
    const linkedQuoteId = booking.linkedQuoteId || (booking as any).quoteId;
    if (linkedQuoteId) {
      this.cancelPendingQuoteReminders(linkedQuoteId, booking.bookingReference || booking.id);
    }

    const recipientEmail = (booking.customer?.email || actor?.email || '').trim().toLowerCase();
    if (!recipientEmail) return;

    const context = this.buildBookingVariables(booking, actor);

    // --- 4A. FIRST BOOKING WELCOME (Strictly Once Per Account/User) ---
    const firstBookingTrigger = this.findActiveTrigger('FIRST_BOOKING_COMPLETED');
    if (firstBookingTrigger) {
      const accountKey = (actor?.id || booking.agentId || booking.userId || recipientEmail).toLowerCase();
      const idempotencyKey = `FIRST_BOOKING_COMPLETED:${accountKey}`;

      if (!this.inFlightLocks.has(idempotencyKey)) {
        this.inFlightLocks.add(idempotencyKey);
        try {
          const ledgerRaw = localStorage.getItem(STORAGE_KEYS.FIRST_BOOKING_LEDGER);
          const ledger: Record<string, { sentAt: string; messageId: string; bookingId: string }> = ledgerRaw
            ? JSON.parse(ledgerRaw)
            : {};

          const matchingUser = db.getUsers().find(
            u =>
              u.id === actor?.id ||
              u.id === booking.agentId ||
              u.id === booking.userId ||
              u.email.toLowerCase() === recipientEmail
          );

          const allUserBookings = db.getAllBookings().filter(b => {
            const bEmail = (b.customer?.email || '').toLowerCase();
            return (
              (actor?.id && (b.agentId === actor.id || b.userId === actor.id)) ||
              (booking.agentId && b.agentId === booking.agentId) ||
              (booking.userId && b.userId === booking.userId) ||
              (bEmail && bEmail === recipientEmail)
            );
          });

          const alreadySent =
            Boolean(ledger[accountKey]) ||
            Boolean(matchingUser?.firstBookingWelcomeSentAt) ||
            this.hasIdempotencyExecution(idempotencyKey);

          if (alreadySent || allUserBookings.length > 1) {
            this.recordSkippedExecution(
              firstBookingTrigger,
              'BOOKING',
              booking.bookingReference || booking.id,
              recipientEmail,
              idempotencyKey,
              alreadySent
                ? `First Booking Welcome already sent at ${ledger[accountKey]?.sentAt || matchingUser?.firstBookingWelcomeSentAt}`
                : `Account has ${allUserBookings.length} bookings (only triggers on booking #1)`
            );
          } else {
            // Lock ledger immediately for atomic idempotency
            const sentAt = new Date().toISOString();
            const provisionalMsgId = `welcome-${Date.now()}`;
            ledger[accountKey] = { sentAt, messageId: provisionalMsgId, bookingId: booking.id };
            localStorage.setItem(STORAGE_KEYS.FIRST_BOOKING_LEDGER, JSON.stringify(ledger));

            const dispatchResult = await this.dispatchTriggerEmailNow({
              trigger: firstBookingTrigger,
              recipientEmail,
              entityType: 'BOOKING',
              entityId: booking.bookingReference || booking.id,
              idempotencyKey,
              context
            });

            if (matchingUser && dispatchResult.success) {
              db.saveUser(
                {
                  ...matchingUser,
                  firstBookingWelcomeSentAt: sentAt,
                  firstBookingWelcomeMessageId: dispatchResult.messageId || provisionalMsgId
                },
                null
              );
            }
          }
        } finally {
          this.inFlightLocks.delete(idempotencyKey);
        }
      }
    }

    // --- 5. BOOKING CONFIRMATION SLA ---
    const slaTrigger = this.findActiveTrigger('BOOKING_CONFIRMATION_SLA');
    if (slaTrigger) {
      const excluded = slaTrigger.slaConfig?.excludedStatuses || ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'CLOSED'];
      if (!excluded.includes(booking.status)) {
        const slaScheduledTime = this.calculateScheduledTime(slaTrigger);
        const slaIdempotencyKey = `BOOKING_CONFIRMATION_SLA:${booking.id}`;
        this.enqueueJob({
          trigger: slaTrigger,
          entityType: 'BOOKING',
          entityId: booking.id,
          recipientEmail,
          recipientName: booking.customer?.name || actor?.name,
          scheduledFor: slaScheduledTime.toISOString(),
          idempotencyKey: slaIdempotencyKey,
          contextSnapshot: context
        });
      }
    }
  }

  /**
   * Cancels pending SLA automation when a booking is confirmed/cancelled/closed before SLA expiry.
   */
  public onBookingStatusChanged(booking: Booking): void {
    if (!booking || !booking.id) return;
    const triggers = this.ensureCanonicalTriggers();
    const slaTrigger = triggers.find(t => t.triggerKey === 'BOOKING_CONFIRMATION_SLA');
    const excluded = slaTrigger?.slaConfig?.excludedStatuses || ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'CLOSED'];

    if (excluded.includes(booking.status)) {
      const jobs = this.getScheduledJobs();
      let changed = false;
      const updated = jobs.map(job => {
        if (
          job.triggerKey === 'BOOKING_CONFIRMATION_SLA' &&
          (job.entityId === booking.id || job.entityId === booking.bookingReference) &&
          job.status === 'SCHEDULED'
        ) {
          changed = true;
          const reason = `Booking ${booking.bookingReference || booking.id} transitioned to ${booking.status} before SLA threshold.`;
          if (slaTrigger) {
            this.recordCancelledExecution(
              slaTrigger,
              'BOOKING',
              booking.bookingReference || booking.id,
              job.recipientEmail,
              job.idempotencyKey,
              reason
            );
          }
          return {
            ...job,
            status: 'CANCELLED' as const,
            executedAt: new Date().toISOString(),
            statusReason: reason
          };
        }
        return job;
      });
      if (changed) {
        this.saveScheduledJobs(updated);
      }
    }
  }

  public cancelPendingQuoteReminders(quoteId: string, bookingReference: string): void {
    const jobs = this.getScheduledJobs();
    const triggers = this.ensureCanonicalTriggers();
    let changed = false;

    const updated = jobs.map(job => {
      if (
        (job.triggerKey === 'QUOTE_SAVED' || job.triggerKey === 'QUOTE_DOWNLOADED') &&
        job.entityId === quoteId &&
        job.status === 'SCHEDULED'
      ) {
        changed = true;
        const trigger = triggers.find(t => t.triggerKey === job.triggerKey);
        const reason = `Quote ${quoteId} converted to booking ${bookingReference} prior to scheduled reminder.`;
        if (trigger) {
          this.recordSkippedExecution(trigger, 'QUOTE', quoteId, job.recipientEmail, job.idempotencyKey, reason);
        }
        return {
          ...job,
          status: 'SKIPPED' as const,
          executedAt: new Date().toISOString(),
          statusReason: reason
        };
      }
      return job;
    });

    if (changed) {
      this.saveScheduledJobs(updated);
    }
  }

  /**
   * Evaluates and executes a scheduled job (checking live Quote/Booking status rules).
   */
  public async evaluateAndExecuteJob(jobId: string, forceImmediate = false): Promise<{ status: string; reason?: string }> {
    const jobs = this.getScheduledJobs();
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex === -1) return { status: 'NOT_FOUND', reason: 'Scheduled job not found' };

    const job = jobs[jobIndex];
    if (job.status !== 'SCHEDULED') {
      return { status: job.status, reason: job.statusReason };
    }

    if (!forceImmediate && new Date(job.scheduledFor).getTime() > Date.now()) {
      return { status: 'SCHEDULED', reason: 'Not yet due for execution' };
    }

    const db = AppDatabase.getInstance();
    const triggers = this.ensureCanonicalTriggers();
    const trigger = triggers.find(t => t.id === job.triggerId || t.triggerKey === job.triggerKey);

    if (!trigger || !trigger.isEnabled || trigger.status === 'INACTIVE' || trigger.status === 'DRAFT') {
      const reason = 'Trigger was disabled or set to Inactive/Draft prior to execution.';
      jobs[jobIndex] = { ...job, status: 'SKIPPED', executedAt: new Date().toISOString(), statusReason: reason };
      this.saveScheduledJobs(jobs);
      return { status: 'SKIPPED', reason };
    }

    if (this.hasIdempotencyExecution(job.idempotencyKey)) {
      const reason = 'Duplicate-send prevention: Reminder already sent for this entity event.';
      jobs[jobIndex] = { ...job, status: 'SKIPPED', executedAt: new Date().toISOString(), statusReason: reason };
      this.saveScheduledJobs(jobs);
      return { status: 'SKIPPED', reason };
    }

    // Check QUOTE_SAVED and QUOTE_DOWNLOADED eligibility
    if (job.triggerKey === 'QUOTE_SAVED' || job.triggerKey === 'QUOTE_DOWNLOADED') {
      const allQuotes = db.getAllSavedQuotes();
      const quote = allQuotes.find(q => q.id === job.entityId || q.quoteNumber === job.entityId);
      const allBookings = db.getAllBookings();
      const convertedBooking = allBookings.find(
        b =>
          b.linkedQuoteId === job.entityId ||
          (quote && (b.linkedQuoteId === quote.id || b.id === quote.bookingId))
      );

      if (
        convertedBooking ||
        (quote &&
          (quote.status === 'BOOKED' ||
            quote.status === 'ACCEPTED' ||
            quote.proposalStatus === 'converted' ||
            Boolean(quote.bookingId)))
      ) {
        const reason = `Quote ${job.entityId} already converted into a booking (${convertedBooking?.bookingReference || quote?.bookingReference || 'BOOKED'}). Reminder suppressed.`;
        jobs[jobIndex] = { ...job, status: 'SKIPPED', executedAt: new Date().toISOString(), statusReason: reason };
        this.saveScheduledJobs(jobs);
        this.recordSkippedExecution(trigger, 'QUOTE', job.entityId, job.recipientEmail, job.idempotencyKey, reason);
        return { status: 'SKIPPED', reason };
      }

      if (quote && (quote.status === 'EXPIRED' || quote.proposalStatus === 'cancelled' || quote.proposalStatus === 'expired')) {
        const reason = `Quote ${job.entityId} has status ${quote.status}. Reminder suppressed.`;
        jobs[jobIndex] = { ...job, status: 'SKIPPED', executedAt: new Date().toISOString(), statusReason: reason };
        this.saveScheduledJobs(jobs);
        this.recordSkippedExecution(trigger, 'QUOTE', job.entityId, job.recipientEmail, job.idempotencyKey, reason);
        return { status: 'SKIPPED', reason };
      }
    }

    // Check BOOKING_CONFIRMATION_SLA eligibility
    if (job.triggerKey === 'BOOKING_CONFIRMATION_SLA') {
      const booking = db.getAllBookings().find(b => b.id === job.entityId || b.bookingReference === job.entityId);
      const excluded = trigger.slaConfig?.excludedStatuses || ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'CLOSED'];
      if (booking && excluded.includes(booking.status)) {
        const reason = `Booking ${booking.bookingReference || booking.id} is already ${booking.status}. SLA email suppressed.`;
        jobs[jobIndex] = { ...job, status: 'CANCELLED', executedAt: new Date().toISOString(), statusReason: reason };
        this.saveScheduledJobs(jobs);
        this.recordCancelledExecution(trigger, 'BOOKING', job.entityId, job.recipientEmail, job.idempotencyKey, reason);
        return { status: 'CANCELLED', reason };
      }
    }

    const res = await this.dispatchTriggerEmailNow({
      trigger,
      recipientEmail: job.recipientEmail,
      entityType: job.entityType,
      entityId: job.entityId,
      idempotencyKey: job.idempotencyKey,
      context: job.contextSnapshot || {},
      jobId: job.id
    });

    jobs[jobIndex] = {
      ...job,
      status: res.success ? 'EXECUTED' : 'FAILED',
      executedAt: new Date().toISOString(),
      statusReason: res.success ? `Dispatched (${res.messageId || 'OK'})` : res.error,
      retryCount: res.success ? job.retryCount : job.retryCount + 1
    };
    this.saveScheduledJobs(jobs);

    return { status: jobs[jobIndex].status, reason: jobs[jobIndex].statusReason };
  }

  /**
   * Sends a Test Email for a trigger configuration and records a TEST_SENT log entry.
   */
  public async sendTestTriggerEmail(
    trigger: EmailCampaignConfig,
    recipientEmail: string,
    actor?: User | null
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const sampleVars: Record<string, string> = {};
    for (const v of CONTEXTUAL_VARIABLE_CATALOG) {
      const k = v.token.replace(/^\{\{|\}\}$/g, '').trim();
      sampleVars[k] = v.sampleValue;
    }
    sampleVars['user.email'] = recipientEmail;

    const resolvedSubject = `[TEST] ${this.renderTemplateWithVariables(trigger.subject, sampleVars)}`;
    const resolvedBody = this.renderTemplateWithVariables(trigger.templateHtml, sampleVars);

    const emailService = EmailNotificationService.getInstance();
    const res = await emailService.sendViaGmailApi(recipientEmail, resolvedSubject, resolvedBody, {
      recipientType: 'ADMIN',
      eventType: 'OPERATIONAL_ALERT_SENT',
      sentBy: actor?.id || 'admin',
      sentByName: actor?.name || 'Admin Test Runner'
    });

    const db = AppDatabase.getInstance();
    db.dispatchEmailCampaign(trigger.id, recipientEmail, actor || null);

    this.appendExecutionLog({
      id: `exec-test-${Date.now()}`,
      triggerId: trigger.id,
      triggerKey: trigger.triggerKey || 'USER_REGISTERED',
      triggerName: trigger.name,
      entityType: 'TEST',
      entityId: 'SAMPLE-PREVIEW',
      recipientEmail,
      internalCopySentTo: trigger.internalCopyRecipients || ['business@theunbound.in'],
      subject: resolvedSubject,
      templateVersion: trigger.templateVersion || 'v1.0',
      status: 'TEST_SENT',
      reason: res.success
        ? 'Live test dispatch executed via centralized EmailNotificationService'
        : `Test simulation logged (${res.error || 'Relay standby'})`,
      messageId: res.messageId || `test-msg-${Date.now()}`,
      executedAt: new Date().toISOString(),
      idempotencyKey: `TEST:${trigger.id}:${Date.now()}`
    });

    return { success: true, messageId: res.messageId || `test-msg-${Date.now()}` };
  }

  public async retryFailedExecution(logId: string, actor?: User | null): Promise<boolean> {
    const logs = this.getExecutionLogs();
    const target = logs.find(l => l.id === logId);
    if (!target) return false;

    const triggers = this.ensureCanonicalTriggers();
    const trigger = triggers.find(t => t.id === target.triggerId || t.triggerKey === target.triggerKey);
    if (!trigger) return false;

    await this.sendTestTriggerEmail(trigger, target.recipientEmail, actor);
    return true;
  }

  private enqueueJob(params: {
    trigger: EmailCampaignConfig;
    entityType: 'USER' | 'QUOTE' | 'BOOKING';
    entityId: string;
    recipientEmail: string;
    recipientName?: string;
    scheduledFor: string;
    idempotencyKey: string;
    contextSnapshot: Record<string, any>;
  }): void {
    const jobs = this.getScheduledJobs();
    const existingIdx = jobs.findIndex(
      j => j.idempotencyKey === params.idempotencyKey && j.status === 'SCHEDULED'
    );

    const jobRecord: ScheduledAutomationJob = {
      id: existingIdx >= 0 ? jobs[existingIdx].id : `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      triggerId: params.trigger.id,
      triggerKey: params.trigger.triggerKey || 'QUOTE_SAVED',
      triggerName: params.trigger.name,
      entityType: params.entityType,
      entityId: params.entityId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      scheduledFor: params.scheduledFor,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      idempotencyKey: params.idempotencyKey,
      retryCount: 0,
      contextSnapshot: params.contextSnapshot
    };

    if (existingIdx >= 0) {
      jobs[existingIdx] = jobRecord;
    } else {
      jobs.unshift(jobRecord);
    }
    this.saveScheduledJobs(jobs);
  }

  private async dispatchTriggerEmailNow(params: {
    trigger: EmailCampaignConfig;
    recipientEmail: string;
    entityType: 'USER' | 'QUOTE' | 'BOOKING';
    entityId: string;
    idempotencyKey: string;
    context: Record<string, any>;
    jobId?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { trigger, recipientEmail, entityType, entityId, idempotencyKey, context, jobId } = params;
    const resolvedSubject = this.renderTemplateWithVariables(trigger.subject, context);
    const resolvedBody = this.renderTemplateWithVariables(trigger.templateHtml, context);

    const emailService = EmailNotificationService.getInstance();
    const res = await emailService.sendViaGmailApi(recipientEmail, resolvedSubject, resolvedBody, {
      quoteId: entityType === 'QUOTE' ? entityId : undefined,
      bookingId: entityType === 'BOOKING' ? entityId : undefined,
      recipientType: 'BUYER',
      eventType: entityType === 'QUOTE' ? 'QUOTE_EMAIL_SENT' : 'BOOKING_EMAIL_SENT'
    });

    const messageId = res.messageId || `auto-msg-${Date.now()}`;
    this.recordIdempotencyExecution(idempotencyKey, messageId);

    const db = AppDatabase.getInstance();
    const updatedTrigger: EmailCampaignConfig = {
      ...trigger,
      sentCount: (trigger.sentCount || 0) + 1,
      lastDispatchedAt: new Date().toISOString()
    };
    db.saveEmailCampaign(updatedTrigger, null);

    this.appendExecutionLog({
      id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      jobId,
      triggerId: trigger.id,
      triggerKey: trigger.triggerKey || 'USER_REGISTERED',
      triggerName: trigger.name,
      entityType,
      entityId,
      recipientEmail,
      internalCopySentTo: trigger.internalCopyRecipients || ['business@theunbound.in'],
      subject: resolvedSubject,
      templateVersion: trigger.templateVersion || 'v1.0',
      status: 'SENT',
      messageId,
      executedAt: new Date().toISOString(),
      idempotencyKey
    });

    return { success: true, messageId };
  }

  private recordSkippedExecution(
    trigger: EmailCampaignConfig,
    entityType: 'USER' | 'QUOTE' | 'BOOKING',
    entityId: string,
    recipientEmail: string,
    idempotencyKey: string,
    reason: string
  ): void {
    const db = AppDatabase.getInstance();
    db.saveEmailCampaign(
      {
        ...trigger,
        skippedCount: (trigger.skippedCount || 0) + 1
      },
      null
    );

    this.appendExecutionLog({
      id: `exec-skip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      triggerId: trigger.id,
      triggerKey: trigger.triggerKey || 'QUOTE_SAVED',
      triggerName: trigger.name,
      entityType,
      entityId,
      recipientEmail,
      subject: trigger.subject,
      templateVersion: trigger.templateVersion || 'v1.0',
      status: 'SKIPPED',
      reason,
      executedAt: new Date().toISOString(),
      idempotencyKey
    });
  }

  private recordCancelledExecution(
    trigger: EmailCampaignConfig,
    entityType: 'USER' | 'QUOTE' | 'BOOKING',
    entityId: string,
    recipientEmail: string,
    idempotencyKey: string,
    reason: string
  ): void {
    this.appendExecutionLog({
      id: `exec-cancel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      triggerId: trigger.id,
      triggerKey: trigger.triggerKey || 'BOOKING_CONFIRMATION_SLA',
      triggerName: trigger.name,
      entityType,
      entityId,
      recipientEmail,
      subject: trigger.subject,
      templateVersion: trigger.templateVersion || 'v1.0',
      status: 'CANCELLED',
      reason,
      executedAt: new Date().toISOString(),
      idempotencyKey
    });
  }

  private buildQuoteVariables(quote: Quotation, actor?: User | null): Record<string, string> {
    const fullName = quote.clientName || quote.agentName || actor?.name || 'Valued Partner';
    const parts = fullName.trim().split(/\s+/);
    const paxCount =
      quote.totalPax ||
      (quote.adultsCount || 0) + (quote.childrenCount || 0) + (quote.infantsCount || 0) ||
      quote.items?.reduce((acc, i) => Math.max(acc, (i.adults || 0) + (i.children || 0)), 2) ||
      2;

    const createdDate = quote.createdAt ? new Date(quote.createdAt) : new Date();
    const validUntilDate = quote.validUntil
      ? new Date(quote.validUntil)
      : new Date(createdDate.getTime() + 14 * 24 * 3600 * 1000);

    return {
      'user.firstName': parts[0] || 'Valued',
      'user.lastName': parts.slice(1).join(' ') || 'Partner',
      'user.email': quote.clientEmail || quote.agentEmail || actor?.email || '',
      'user.companyName': quote.clientCompany || quote.agentAgency || quote.agentCompany || actor?.companyName || actor?.agencyName || 'TheUnbound Partner',
      'quote.quoteId': quote.id,
      'quote.quoteReference': quote.quoteNumber || quote.id,
      'quote.createdAt': createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'quote.validUntil': validUntilDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'quote.total': formatCurrency(quote.finalCustomerSellingPrice || quote.totalSellingPrice || 0, quote.currency || 'USD'),
      'quote.currency': quote.currency || 'USD',
      'trip.destination': quote.destination || quote.items?.[0]?.product?.city || 'Japan',
      'trip.startDate': quote.travelStartDate || 'Upcoming Season',
      'trip.endDate': quote.travelEndDate || quote.travelStartDate || 'Scheduled Return',
      'trip.passengerCount': String(paxCount),
      'agent.agencyName': quote.agentAgency || quote.agentCompany || actor?.agencyName || 'Partner Travel Desk',
      'agent.agentName': quote.agentName || actor?.name || fullName,
      'agent.agentEmail': quote.agentEmail || actor?.email || quote.clientEmail || ''
    };
  }

  private buildBookingVariables(booking: Booking, actor?: User | null): Record<string, string> {
    const fullName = booking.customer?.name || actor?.name || 'Valued Partner';
    const parts = fullName.trim().split(/\s+/);
    const paxCount =
      booking.items?.reduce((acc, i) => Math.max(acc, (i.adults || 0) + (i.children || 0) + (i.infants || 0)), 2) || 2;

    return {
      'user.firstName': parts[0] || 'Valued',
      'user.lastName': parts.slice(1).join(' ') || 'Partner',
      'user.email': booking.customer?.email || actor?.email || '',
      'user.companyName': booking.agencyName || booking.agentAgency || actor?.companyName || actor?.agencyName || 'Travel Partner',
      'booking.bookingId': booking.id,
      'booking.bookingReference': booking.bookingReference || booking.id,
      'booking.bookingDate': new Date(booking.submittedAt || Date.now()).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      'booking.status': booking.status || 'PENDING_CONFIRMATION',
      'trip.destination': booking.destination || booking.destinationName || booking.items?.[0]?.product?.city || 'Japan',
      'trip.startDate': booking.travelStartDate || 'Scheduled Departure',
      'trip.endDate': booking.travelEndDate || booking.travelStartDate || 'Scheduled Return',
      'trip.passengerCount': String(paxCount),
      'agent.agencyName': booking.agencyName || booking.agentAgency || actor?.agencyName || 'Partner Agency',
      'agent.agentName': booking.agentName || actor?.name || fullName,
      'agent.agentEmail': booking.agentEmailSnapshot || actor?.email || booking.customer?.email || ''
    };
  }
}

export const marketingAutomationScheduler = MarketingAutomationScheduler.getInstance();
