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
  category: 'User' | 'Quote' | 'Booking' | 'Trip' | 'Agent' | 'Verification';
}

export interface TriggerValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TriggerDryRunResult {
  validConfig: boolean;
  validationErrors: string[];
  triggerEnabled: boolean;
  conditionPassed: boolean;
  conditionReason: string;
  resolvedRecipient: string;
  internalCopyRecipients: string[];
  senderHeader: string;
  timingMode: string;
  scheduledFor: string;
  renderedSubject: string;
  renderedHtml: string;
  variablesUsed: Record<string, string>;
  entityUsed: {
    entityType: 'USER' | 'QUOTE' | 'BOOKING' | 'PREVIEW';
    entityId: string;
    isRealRecord: boolean;
  };
}

export const CONTEXTUAL_VARIABLE_CATALOG: VariableDefinition[] = [
  // User
  { token: '{{user.firstName}}', label: 'User First Name', sampleValue: 'Eleanor', category: 'User' },
  { token: '{{user.lastName}}', label: 'User Last Name', sampleValue: 'Vance', category: 'User' },
  { token: '{{user.fullName}}', label: 'User Full Legal Name', sampleValue: 'Eleanor Vance', category: 'User' },
  { token: '{{user.email}}', label: 'User Email Address', sampleValue: 'eleanor.vance@mayfairtravel.co.uk', category: 'User' },
  { token: '{{user.companyName}}', label: 'Company / Agency Name', sampleValue: 'Mayfair Bespoke Travel Ltd.', category: 'User' },

  // Verification & Status
  { token: '{{company.name}}', label: 'Company Name', sampleValue: 'Mayfair Bespoke Travel Ltd.', category: 'Verification' },
  { token: '{{verification.status}}', label: 'Account Verification Status', sampleValue: 'Pending Verification', category: 'Verification' },
  { token: '{{verification.notes}}', label: 'Verification Reviewer Notes', sampleValue: 'Please supply your official IATA license certificate and commercial tax number.', category: 'Verification' },
  { token: '{{verification.rejectedReason}}', label: 'Rejection Reason / Requirements Needed', sampleValue: 'Trade certificate verification required.', category: 'Verification' },
  { token: '{{verification.requirementsList}}', label: 'Requirements Checklist', sampleValue: 'Valid IATA/ABTA registration certificate, verified business registration license, commercial billing address', category: 'Verification' },
  { token: '{{verification.reviewedBy}}', label: 'Admin Reviewer / Onboarding Officer', sampleValue: 'TheUnbound Partner Verification Desk', category: 'Verification' },
  { token: '{{verification.reviewedAt}}', label: 'Verification Review Date', sampleValue: '08 Oct 2026', category: 'Verification' },
  { token: '{{verification.nextSteps}}', label: 'Next Verification Steps', sampleValue: 'Our partner desk will review your submitted trade credentials within 24 business hours.', category: 'Verification' },

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
  ACCOUNT_PENDING_VERIFICATION: ['User', 'Agent', 'Verification'],
  ACCOUNT_VERIFICATION_APPROVED: ['User', 'Agent', 'Verification'],
  ACCOUNT_VERIFICATION_REJECTED: ['User', 'Agent', 'Verification'],
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

const LEGACY_FABRICATED_LOG_IDS = new Set([
  'exec-log-101',
  'exec-log-101b',
  'exec-log-101c',
  'exec-log-101d',
  'exec-log-102',
  'exec-log-103',
  'exec-log-104',
  'exec-log-105'
]);

const LEGACY_FABRICATED_JOB_IDS = new Set([
  'job-sched-201',
  'job-sched-202'
]);

export function isValidDeliverableEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return false;
  if (clean.endsWith('@example.com') || clean.endsWith('@test.invalid') || clean === 'client@theunbound.in' || clean === 'traveler@example.com') {
    return false;
  }
  return true;
}

export class MarketingAutomationScheduler {
  private static instance: MarketingAutomationScheduler;
  private inFlightLocks: Set<string> = new Set();
  private inFlightJobIds: Set<string> = new Set();
  private isDatabaseBound: boolean = false;
  private schedulerInterval: any = null;

  private constructor() {
    this.purgeFabricatedSeeds();
    this.bindDatabaseEventProducers();
    this.startSchedulerLoop();
  }

  public static getInstance(): MarketingAutomationScheduler {
    if (!MarketingAutomationScheduler.instance) {
      MarketingAutomationScheduler.instance = new MarketingAutomationScheduler();
    }
    return MarketingAutomationScheduler.instance;
  }

  /**
   * Purges legacy fabricated execution logs and scheduled jobs from localStorage so only real executions are shown.
   */
  private purgeFabricatedSeeds(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const rawLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (rawLogs) {
        const parsedLogs: MarketingAutomationExecutionLog[] = JSON.parse(rawLogs);
        if (Array.isArray(parsedLogs)) {
          const filtered = parsedLogs.filter(l => l && l.id && !LEGACY_FABRICATED_LOG_IDS.has(l.id));
          if (filtered.length !== parsedLogs.length) {
            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(filtered));
          }
        }
      }
      const rawJobs = localStorage.getItem(STORAGE_KEYS.JOBS);
      if (rawJobs) {
        const parsedJobs: ScheduledAutomationJob[] = JSON.parse(rawJobs);
        if (Array.isArray(parsedJobs)) {
          const filtered = parsedJobs.filter(j => j && j.id && !LEGACY_FABRICATED_JOB_IDS.has(j.id));
          if (filtered.length !== parsedJobs.length) {
            localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(filtered));
          }
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  /**
   * Directly wires MarketingAutomationScheduler to AppDatabase event hooks so triggers fire
   * reliably across all user, quotation, and booking workflows.
   */
  public bindDatabaseEventProducers(): void {
    if (this.isDatabaseBound) return;
    this.isDatabaseBound = true;

    try {
      const db = AppDatabase.getInstance();

      db.onUserRegistered((newUser) => {
        this.onUserRegistered(newUser).catch(err =>
          console.error('[MarketingAutomation] onUserRegistered error:', err)
        );
      });

      db.onUserStatusChanged((user, actor, action, notes, requirements) => {
        if (action === 'PENDING') {
          this.onAccountPendingVerification(user).catch(err =>
            console.error('[MarketingAutomation] onAccountPendingVerification error:', err)
          );
        } else if (action === 'APPROVED') {
          this.onAccountVerificationApproved(user, actor).catch(err =>
            console.error('[MarketingAutomation] onAccountVerificationApproved error:', err)
          );
        } else if (action === 'REJECTED') {
          this.onAccountVerificationRejected(user, actor, notes, requirements).catch(err =>
            console.error('[MarketingAutomation] onAccountVerificationRejected error:', err)
          );
        }
      });

      db.onQuotationSaved((quote, user, _isNew, actionType) => {
        const isDownloaded =
          actionType === 'DOWNLOADED' ||
          actionType === 'PRINTED' ||
          quote.status === 'DOWNLOADED_PDF' ||
          quote.status === 'DOWNLOADED';
        if (isDownloaded) {
          this.onQuoteDownloaded(quote, user).catch(err =>
            console.error('[MarketingAutomation] onQuoteDownloaded error:', err)
          );
        } else if (
          quote.status !== 'CONVERTED' &&
          quote.status !== 'BOOKED' &&
          quote.status !== 'CANCELLED' &&
          quote.status !== 'EXPIRED'
        ) {
          this.onQuoteSaved(quote, user).catch(err =>
            console.error('[MarketingAutomation] onQuoteSaved error:', err)
          );
        }
      });

      db.onBookingSaved((booking, user, isNew) => {
        if (isNew) {
          this.onBookingCreated(booking, user).catch(err =>
            console.error('[MarketingAutomation] onBookingCreated error:', err)
          );
        } else {
          this.onBookingStatusChanged(booking);
        }
      });
    } catch (err) {
      console.error('[MarketingAutomation] Failed to bind database event producers:', err);
    }
  }

  /**
   * Starts a background scheduler loop that periodically evaluates and executes due SCHEDULED jobs.
   */
  public startSchedulerLoop(intervalMs: number = 10000): void {
    if (this.schedulerInterval) return;

    // Run an initial check shortly after initialization to process any overdue scheduled jobs
    setTimeout(() => {
      this.processDueScheduledJobs().catch(err =>
        console.debug('[MarketingAutomation] Initial scheduled job check note:', err)
      );
    }, 1500);

    this.schedulerInterval = setInterval(() => {
      this.processDueScheduledJobs().catch(err =>
        console.debug('[MarketingAutomation] Scheduled job loop note:', err)
      );
    }, intervalMs);
  }

  public stopSchedulerLoop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Evaluates and processes all SCHEDULED jobs whose scheduledFor timestamp is <= now.
   */
  public async processDueScheduledJobs(): Promise<number> {
    const jobs = this.getScheduledJobs();
    const now = Date.now();
    const dueJobs = jobs.filter(
      j =>
        j &&
        j.status === 'SCHEDULED' &&
        !this.inFlightJobIds.has(j.id) &&
        new Date(j.scheduledFor).getTime() <= now
    );

    let processedCount = 0;
    for (const job of dueJobs) {
      const res = await this.evaluateAndExecuteJob(job.id, false);
      if (res.status !== 'SCHEDULED') {
        processedCount++;
      }
    }
    return processedCount;
  }

  /**
   * Validates a trigger configuration before saving or executing.
   */
  public validateTriggerConfig(trigger: Partial<EmailCampaignConfig>): TriggerValidationResult {
    const errors: string[] = [];

    if (!trigger.name || !trigger.name.trim()) {
      errors.push('Trigger name is required.');
    }
    const eventKey = trigger.triggerKey || trigger.campaignType;
    if (!eventKey) {
      errors.push('Trigger event type is required.');
    }
    if (!trigger.subject || !trigger.subject.trim()) {
      errors.push('Email subject line is required.');
    }
    if (!trigger.templateHtml || !trigger.templateHtml.trim()) {
      errors.push('Email HTML template content is required.');
    }
    if (trigger.senderEmail && trigger.senderEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trigger.senderEmail.trim())) {
      errors.push(`Sender email "${trigger.senderEmail}" is not a valid email address.`);
    }
    if (trigger.internalCopyRecipients && Array.isArray(trigger.internalCopyRecipients)) {
      for (const cc of trigger.internalCopyRecipients) {
        if (cc && cc.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cc.trim())) {
          errors.push(`Internal copy (CC) address "${cc}" is not a valid email address.`);
        }
      }
    }
    const mode = trigger.timingMode || 'IMMEDIATE';
    if (mode === 'DELAYED') {
      const val = Number(trigger.delayValue ?? trigger.delayHours ?? 0);
      if (isNaN(val) || val < 0) {
        errors.push('Delay value must be a non-negative number.');
      }
    }
    if (mode === 'SLA') {
      const slaDur = Number(trigger.slaConfig?.slaDuration ?? trigger.delayValue ?? trigger.delayHours ?? 24);
      if (isNaN(slaDur) || slaDur <= 0) {
        errors.push('SLA duration must be greater than 0.');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Ensures all 8 canonical system triggers exist and preserves any custom created triggers.
   */
  public ensureCanonicalTriggers(): EmailCampaignConfig[] {
    const db = AppDatabase.getInstance();
    const existing = db.getEmailCampaigns();

    const canonicalKeys: MarketingTriggerKey[] = [
      'USER_REGISTERED',
      'ACCOUNT_PENDING_VERIFICATION',
      'ACCOUNT_VERIFICATION_APPROVED',
      'ACCOUNT_VERIFICATION_REJECTED',
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
        case 'ACCOUNT_PENDING_VERIFICATION':
          return 'ACCOUNT_PENDING_VERIFICATION';
        case 'ACCOUNT_VERIFICATION_APPROVED':
          return 'ACCOUNT_VERIFICATION_APPROVED';
        case 'ACCOUNT_VERIFICATION_REJECTED':
          return 'ACCOUNT_VERIFICATION_REJECTED';
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
    const seenIds = new Set<string>();
    const deduplicatedExisting: EmailCampaignConfig[] = [];

    for (const c of existing) {
      if (!c || !c.id) continue;
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        deduplicatedExisting.push(c);
      } else {
        modified = true;
      }
    }

    const seenSystemKeys = new Set<MarketingTriggerKey>();
    const normalized: EmailCampaignConfig[] = [];

    for (const c of deduplicatedExisting) {
      const resolvedKey = mapLegacyTypeToKey(c);
      const isCanonicalId = INITIAL_CAMPAIGNS.some(ic => ic.id === c.id);
      const isSys = c.isSystemTrigger === true || (c.isSystemTrigger === undefined && isCanonicalId);

      if (isSys && seenSystemKeys.has(resolvedKey)) {
        modified = true;
        continue;
      }
      if (isSys) {
        seenSystemKeys.add(resolvedKey);
      }

      const templateDefault = INITIAL_CAMPAIGNS.find(ic => ic.triggerKey === resolvedKey);
      const nextStatus = c.status || (c.isEnabled ? 'ACTIVE' : 'INACTIVE');
      const isEnabledResolved = c.isEnabled !== undefined ? Boolean(c.isEnabled) : nextStatus === 'ACTIVE';

      normalized.push({
        ...(isSys ? templateDefault : {}),
        ...c,
        triggerKey: resolvedKey,
        campaignType: resolvedKey,
        status: isEnabledResolved ? (nextStatus === 'DRAFT' ? 'DRAFT' : 'ACTIVE') : 'INACTIVE',
        isEnabled: isEnabledResolved && nextStatus !== 'DRAFT' && nextStatus !== 'INACTIVE',
        isSystemTrigger: isSys,
        primaryRecipientRule: c.primaryRecipientRule || templateDefault?.primaryRecipientRule || 'User Email',
        internalCopyRecipients: Array.isArray(c.internalCopyRecipients)
          ? c.internalCopyRecipients
          : (templateDefault?.internalCopyRecipients || ['business@theunbound.in']),
        timingMode: c.timingMode || templateDefault?.timingMode || (c.delayHours > 0 ? 'DELAYED' : 'IMMEDIATE'),
        delayValue: c.delayValue ?? c.delayHours ?? templateDefault?.delayValue ?? 0,
        delayHours: c.delayHours ?? c.delayValue ?? templateDefault?.delayHours ?? 0,
        delayUnit: c.delayUnit || templateDefault?.delayUnit || 'HOURS',
        templateVersion: c.templateVersion || templateDefault?.templateVersion || 'v1.0',
        dynamicVariables: c.dynamicVariables?.length ? c.dynamicVariables : (templateDefault?.dynamicVariables || []),
        sentCount: typeof c.sentCount === 'number' ? c.sentCount : 0,
        skippedCount: typeof c.skippedCount === 'number' ? c.skippedCount : 0,
        failedCount: typeof c.failedCount === 'number' ? c.failedCount : 0,
        updatedAt: c.updatedAt || templateDefault?.updatedAt || new Date().toISOString()
      });
    }

    for (const key of canonicalKeys) {
      if (!normalized.some(c => c.isSystemTrigger && c.triggerKey === key)) {
        const seed = INITIAL_CAMPAIGNS.find(ic => ic.triggerKey === key);
        if (seed) {
          if (!seenIds.has(seed.id)) {
            normalized.push({ ...seed });
            seenIds.add(seed.id);
          } else {
            const uniqueSeed = { ...seed, id: `trigger-${key.toLowerCase().replace(/_/g, '-')}-${Date.now()}` };
            normalized.push(uniqueSeed);
            seenIds.add(uniqueSeed.id);
          }
          modified = true;
        }
      }
    }

    if (modified) {
      db.saveAllEmailCampaigns(normalized);
    }

    return normalized;
  }

  /**
   * Creates a new custom trigger configuration and persists it to AppDatabase and Firestore.
   */
  public async createCustomTrigger(
    params: {
      name: string;
      description?: string;
      triggerKey: MarketingTriggerKey;
      subject?: string;
      preheaderText?: string;
      templateHtml?: string;
      timingMode: TriggerTimingMode;
      delayValue?: number;
      delayUnit?: TriggerDelayUnit;
      primaryRecipientRule?: string;
      internalCopyRecipients?: string[];
      senderName?: string;
      senderEmail?: string;
      triggerCondition?: string;
      isEnabled?: boolean;
    },
    actor?: User | null
  ): Promise<{ success: boolean; trigger?: EmailCampaignConfig; errors?: string[]; syncedToFirestore?: boolean }> {
    const templateDefault = INITIAL_CAMPAIGNS.find(ic => ic.triggerKey === params.triggerKey);
    const delayVal = Number(params.delayValue ?? (params.timingMode === 'IMMEDIATE' ? 0 : 24));
    const isEnabled = params.isEnabled !== false;
    const defaultSubj = (
      params.subject ||
      templateDefault?.subject ||
      `[TheUnbound] Automated Notification — ${params.name}`
    ).trim();
    const defaultHtml =
      params.templateHtml ||
      templateDefault?.templateHtml ||
      `<div style="font-family: sans-serif; color: #1F2933; line-height: 1.6;"><p>Dear {{user.fullName}},</p><p>This is an automated update regarding <strong>${params.name}</strong>.</p><p>Warm regards,<br/>TheUnbound Ground Operations Desk</p></div>`;

    const newTrigger: EmailCampaignConfig = {
      id: `trigger-custom-${params.triggerKey.toLowerCase().replace(/_/g, '-')}-${Date.now()}`,
      campaignType: params.triggerKey,
      triggerKey: params.triggerKey,
      name: params.name.trim(),
      description: (params.description || `Custom automated trigger for ${params.triggerKey}`).trim(),
      isEnabled,
      status: isEnabled ? 'ACTIVE' : 'INACTIVE',
      isSystemTrigger: false,
      priority: 2,
      subject: defaultSubj,
      preheaderText: (params.preheaderText || templateDefault?.preheaderText || '').trim(),
      templateHtml: defaultHtml,
      senderName: (params.senderName || templateDefault?.senderName || 'TheUnbound Operations Desk').trim(),
      senderEmail: (params.senderEmail || templateDefault?.senderEmail || 'business@theunbound.in').trim(),
      primaryRecipientRule: (params.primaryRecipientRule || templateDefault?.primaryRecipientRule || 'User Email').trim(),
      internalCopyRecipients: params.internalCopyRecipients || ['business@theunbound.in'],
      triggerCondition: (params.triggerCondition || templateDefault?.triggerCondition || `On ${params.triggerKey} event`).trim(),
      timingMode: params.timingMode,
      delayHours: params.timingMode === 'IMMEDIATE' ? 0 : delayVal,
      delayValue: params.timingMode === 'IMMEDIATE' ? 0 : delayVal,
      delayUnit: params.delayUnit || 'HOURS',
      slaConfig: params.timingMode === 'SLA'
        ? {
            slaDuration: delayVal || 24,
            slaUnit: params.delayUnit || 'HOURS',
            reminderTiming: `At SLA threshold (${delayVal || 24} ${params.delayUnit || 'HOURS'} after submission)`,
            eligibleStatuses: ['PENDING_CONFIRMATION', 'ON_HOLD'],
            excludedStatuses: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'CLOSED']
          }
        : undefined,
      dynamicVariables: this.getVariablesForTrigger(params.triggerKey).map(v => v.token),
      templateVersion: 'v1.0',
      versionHistory: [
        {
          version: 'v1.0',
          subject: defaultSubj,
          preheaderText: (params.preheaderText || templateDefault?.preheaderText || '').trim(),
          templateHtml: 'Initial custom trigger template',
          updatedAt: new Date().toISOString(),
          updatedBy: actor?.email || 'business@theunbound.in'
        }
      ],
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      updatedAt: new Date().toISOString()
    };

    const validation = this.validateTriggerConfig(newTrigger);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const db = AppDatabase.getInstance();
    const saveRes = await db.saveEmailCampaignAsync(newTrigger, actor || null);
    return {
      success: true,
      trigger: saveRes.campaign,
      syncedToFirestore: saveRes.syncedToFirestore
    };
  }

  public getVariablesForTrigger(triggerKey: MarketingTriggerKey): VariableDefinition[] {
    const allowedCategories = TRIGGER_ALLOWED_CATEGORIES[triggerKey] || ['User', 'Quote', 'Booking', 'Trip', 'Agent'];
    return CONTEXTUAL_VARIABLE_CATALOG.filter(v => allowedCategories.includes(v.category));
  }

  public formatTimingBadge(trigger: EmailCampaignConfig): string {
    const mode = trigger.timingMode || (trigger.delayHours === 0 ? 'IMMEDIATE' : 'DELAYED');
    if (mode === 'IMMEDIATE' || (trigger.delayValue === 0 && trigger.delayHours === 0 && mode !== 'SLA')) {
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
   * Resolves dynamic variables safely.
   * In live mode (isPreview = false), uses real entity values or clean neutral defaults (never unrelated fake sample personas).
   * In preview / test mode (isPreview = true), uses sample values when a variable is not provided.
   */
  public renderTemplateWithVariables(
    rawText: string,
    variables: Record<string, string | number | undefined>,
    options?: { isPreview?: boolean }
  ): string {
    if (!rawText) return '';
    const isPreview = options?.isPreview ?? false;

    const sampleFallbacks: Record<string, string> = {};
    for (const item of CONTEXTUAL_VARIABLE_CATALOG) {
      const cleanKey = item.token.replace(/^\{\{|\}\}$/g, '').trim();
      sampleFallbacks[cleanKey] = item.sampleValue;
    }

    const neutralLiveFallbacks: Record<string, string> = {
      'user.firstName': 'Valued',
      'user.lastName': 'Partner',
      'user.fullName': 'Valued Partner',
      'user.email': '',
      'user.companyName': 'Travel Partner Agency',
      'company.name': 'Travel Partner Agency',
      'verification.status': 'Pending Verification',
      'verification.notes': 'Please review your account verification details in the partner portal.',
      'verification.rejectedReason': 'Additional trade documentation is required.',
      'verification.requirementsList': 'Valid trade registration certificate and official company tax ID.',
      'verification.reviewedBy': 'TheUnbound Partner Verification Desk',
      'verification.reviewedAt': new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'verification.nextSteps': 'Our verification team will notify you once review is complete.',
      'quote.quoteId': 'Proposal',
      'quote.quoteReference': 'Proposal',
      'quote.createdAt': new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'quote.validUntil': '14 Days from Issue',
      'quote.total': 'As Quoted',
      'quote.currency': 'USD',
      'booking.bookingId': 'Reservation',
      'booking.bookingReference': 'Reservation',
      'booking.bookingDate': new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'booking.status': 'PENDING_CONFIRMATION',
      'trip.destination': 'Japan',
      'trip.startDate': 'Scheduled Departure',
      'trip.endDate': 'Scheduled Return',
      'trip.passengerCount': '2',
      'agent.agencyName': 'Partner Travel Agency',
      'agent.agentName': 'Travel Partner',
      'agent.agentEmail': ''
    };

    const legacyAliases: Record<string, string> = {
      'Customer Name': String(
        variables['user.firstName']
          ? `${variables['user.firstName']} ${variables['user.lastName'] || ''}`.trim()
          : (isPreview ? sampleFallbacks['user.firstName'] : 'Valued Partner')
      ),
      'Booking Reference': String(variables['booking.bookingReference'] || (isPreview ? sampleFallbacks['booking.bookingReference'] : 'Reservation')),
      'Booking ID': String(variables['booking.bookingId'] || (isPreview ? sampleFallbacks['booking.bookingId'] : 'Reservation')),
      'Quote Number': String(variables['quote.quoteReference'] || (isPreview ? sampleFallbacks['quote.quoteReference'] : 'Proposal')),
      'Destination': String(variables['trip.destination'] || (isPreview ? sampleFallbacks['trip.destination'] : 'Japan')),
      'Travel Date': String(variables['trip.startDate'] || (isPreview ? sampleFallbacks['trip.startDate'] : 'Scheduled Departure')),
      'Amount': String(variables['quote.total'] || (isPreview ? '4,850.00' : 'As Quoted')),
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
      if (isPreview && sampleFallbacks[key]) {
        return sampleFallbacks[key];
      }
      if (neutralLiveFallbacks[key] !== undefined) {
        return neutralLiveFallbacks[key];
      }
      return 'Valued Partner';
    });
  }

  /**
   * Resolves the recipient email address for a trigger based on its primaryRecipientRule and the source entity.
   */
  public resolveRecipientEmail(
    trigger: EmailCampaignConfig,
    entityType: 'USER' | 'QUOTE' | 'BOOKING',
    entity: User | Quotation | Booking,
    actor?: User | null
  ): { email: string; name?: string; optOut?: boolean; errorReason?: string } {
    const rule = (trigger.primaryRecipientRule || '').trim();
    const db = AppDatabase.getInstance();

    // Check if primaryRecipientRule is a direct custom email address
    if (rule.includes('@') && isValidDeliverableEmail(rule)) {
      return { email: rule.toLowerCase(), name: 'Configured Recipient' };
    }

    if (entityType === 'USER') {
      const u = entity as User;
      if (u.emailOptOut) {
        return { email: '', name: u.name, optOut: true, errorReason: `User ${u.email} has opted out of marketing/automated emails.` };
      }
      if (isValidDeliverableEmail(u.email)) {
        return { email: u.email.trim().toLowerCase(), name: u.name };
      }
      return { email: '', name: u.name, errorReason: `User record (${u.id}) does not have a valid deliverable email address (${u.email || 'empty'}).` };
    }

    if (entityType === 'QUOTE') {
      const q = entity as Quotation;
      const ownerUser = (q.agentId && db.getUserById(q.agentId)) || (q.userId && db.getUserById(q.userId)) || actor || null;
      if (ownerUser?.emailOptOut) {
        return { email: '', name: ownerUser.name, optOut: true, errorReason: `Quote owner ${ownerUser.email} has opted out of automated emails.` };
      }

      const candidates =
        rule.toLowerCase().includes('client') || rule.toLowerCase().includes('customer')
          ? [q.clientEmail, q.agentEmail, ownerUser?.email, actor?.email]
          : [q.agentEmail, ownerUser?.email, actor?.email, q.clientEmail];

      for (const cand of candidates) {
        if (isValidDeliverableEmail(cand)) {
          return {
            email: cand!.trim().toLowerCase(),
            name: q.agentName || ownerUser?.name || q.clientName || actor?.name
          };
        }
      }
      return {
        email: '',
        name: q.clientName || q.agentName,
        errorReason: `Quote ${q.quoteNumber || q.id} has no deliverable owner or client email address.`
      };
    }

    // BOOKING
    const b = entity as Booking;
    const bookingUser =
      (b.agentId && db.getUserById(b.agentId)) ||
      (b.userId && db.getUserById(b.userId)) ||
      ((b as any).submittedByUserId && db.getUserById((b as any).submittedByUserId)) ||
      actor ||
      null;

    if (bookingUser?.emailOptOut) {
      return { email: '', name: bookingUser.name, optOut: true, errorReason: `Booking user ${bookingUser.email} has opted out of automated emails.` };
    }

    const bookingCandidates = [
      b.agentEmailSnapshot,
      bookingUser?.email,
      actor?.email,
      b.customer?.email
    ];

    for (const cand of bookingCandidates) {
      if (isValidDeliverableEmail(cand)) {
        return {
          email: cand!.trim().toLowerCase(),
          name: b.agentName || bookingUser?.name || b.customer?.name || actor?.name
        };
      }
    }

    return {
      email: '',
      name: b.customer?.name,
      errorReason: `Booking ${b.bookingReference || b.id} has no deliverable contact or agent email address.`
    };
  }

  public getScheduledJobs(): ScheduledAutomationJob[] {
    try {
      const db = AppDatabase.getInstance();
      const dbJobs = db.getAutomationJobs<any>();
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.JOBS) : null;
      const localJobs: ScheduledAutomationJob[] = raw ? JSON.parse(raw) : [];

      const map = new Map<string, ScheduledAutomationJob>();
      for (const j of dbJobs) {
        const id = j?.id || j?.jobId;
        if (id && !LEGACY_FABRICATED_JOB_IDS.has(id)) {
          map.set(id, { ...j, id });
        }
      }
      for (const j of localJobs) {
        if (j && j.id && !LEGACY_FABRICATED_JOB_IDS.has(j.id)) {
          map.set(j.id, { ...(map.get(j.id) || {}), ...j });
        }
      }

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    } catch {
      return [];
    }
  }

  private saveScheduledJobs(jobs: ScheduledAutomationJob[]): void {
    try {
      const cleanJobs = jobs.filter(j => j && j.id && !LEGACY_FABRICATED_JOB_IDS.has(j.id));
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(cleanJobs));
      }
      const db = AppDatabase.getInstance();
      db.saveAllAutomationJobs(cleanJobs.map(j => ({ ...j, jobId: j.id })));
    } catch (e) {
      console.error('Failed to save scheduled automation jobs:', e);
    }
  }

  public getExecutionLogs(triggerIdOrKey?: string): MarketingAutomationExecutionLog[] {
    try {
      const db = AppDatabase.getInstance();
      const dbLogs = db.getAutomationLogs<MarketingAutomationExecutionLog>();
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOGS) : null;
      const localLogs: MarketingAutomationExecutionLog[] = raw ? JSON.parse(raw) : [];

      const map = new Map<string, MarketingAutomationExecutionLog>();
      for (const l of dbLogs) {
        if (l && l.id && !LEGACY_FABRICATED_LOG_IDS.has(l.id)) {
          map.set(l.id, l);
        }
      }
      for (const l of localLogs) {
        if (l && l.id && !LEGACY_FABRICATED_LOG_IDS.has(l.id)) {
          map.set(l.id, { ...(map.get(l.id) || {}), ...l });
        }
      }

      const list = Array.from(map.values()).sort(
        (a, b) => new Date(b.executedAt || 0).getTime() - new Date(a.executedAt || 0).getTime()
      );

      if (!triggerIdOrKey) return list;
      return list.filter(l => l.triggerId === triggerIdOrKey || l.triggerKey === triggerIdOrKey);
    } catch {
      return [];
    }
  }

  private appendExecutionLog(log: MarketingAutomationExecutionLog): void {
    const current = this.getExecutionLogs();
    const updated = [log, ...current.filter(l => l.id !== log.id)].slice(0, 500);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));
      }
      const db = AppDatabase.getInstance();
      db.saveAutomationLog(log);
    } catch (e) {
      console.error('Failed to save automation execution log:', e);
    }
  }

  private hasIdempotencyExecution(idempotencyKey: string): boolean {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.IDEMPOTENCY) : null;
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      if (map[idempotencyKey]) return true;
      return this.getExecutionLogs().some(l => l.idempotencyKey === idempotencyKey && l.status === 'SENT');
    } catch {
      return false;
    }
  }

  private recordIdempotencyExecution(idempotencyKey: string, messageId: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEYS.IDEMPOTENCY);
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        map[idempotencyKey] = messageId || new Date().toISOString();
        localStorage.setItem(STORAGE_KEYS.IDEMPOTENCY, JSON.stringify(map));
      }
    } catch (e) {
      console.error('Failed to record idempotency key:', e);
    }
  }

  private findActiveTriggers(triggerKey: MarketingTriggerKey): EmailCampaignConfig[] {
    const triggers = this.ensureCanonicalTriggers();
    return triggers.filter(
      t =>
        (t.triggerKey === triggerKey || t.campaignType === triggerKey) &&
        t.isEnabled === true &&
        t.status !== 'INACTIVE' &&
        t.status !== 'DRAFT'
    );
  }

  // ============================================================================
  // 1. NEW USER REGISTRATION (USER_REGISTERED)
  // ============================================================================
  public async onUserRegistered(user: User): Promise<void> {
    if (!user) return;
    const triggers = this.findActiveTriggers('USER_REGISTERED');
    if (triggers.length === 0) return;

    const nameParts = (user.name || '').trim().split(/\s+/);
    const firstName = user.firstName || nameParts[0] || 'Partner';
    const lastName = user.lastName || nameParts.slice(1).join(' ') || '';

    const context: Record<string, string> = {
      'user.firstName': firstName,
      'user.lastName': lastName,
      'user.fullName': user.name || `${firstName} ${lastName}`.trim(),
      'user.email': user.email || '',
      'user.companyName': user.companyName || user.agencyName || 'Independent Travel Partner',
      'agent.agencyName': user.agencyName || user.companyName || 'Travel Partner Agency',
      'agent.agentName': user.name || firstName,
      'agent.agentEmail': user.email || ''
    };

    for (const trigger of triggers) {
      const idempotencyKey = `USER_REGISTERED:${trigger.id}:${(user.id || user.email || '').toLowerCase()}`;
      if (this.inFlightLocks.has(idempotencyKey)) {
        continue;
      }
      if (this.hasIdempotencyExecution(idempotencyKey)) {
        const alreadyLoggedSkip = this.getExecutionLogs().some(
          l => l.idempotencyKey === idempotencyKey && l.status === 'SKIPPED'
        );
        if (!alreadyLoggedSkip) {
          this.recordSkippedExecution(
            trigger,
            'USER',
            user.id,
            user.email || '',
            idempotencyKey,
            'Duplicate event suppressed by idempotency guard (already sent)'
          );
        }
        continue;
      }

      const recipient = this.resolveRecipientEmail(trigger, 'USER', user);
      if (recipient.optOut) {
        this.recordSkippedExecution(trigger, 'USER', user.id, user.email || 'OPT_OUT', idempotencyKey, recipient.errorReason || 'User opted out');
        continue;
      }
      if (!recipient.email) {
        this.recordFailedExecution(trigger, 'USER', user.id, user.email || 'MISSING_EMAIL', idempotencyKey, recipient.errorReason || 'Invalid recipient email');
        continue;
      }

      const scheduledTime = this.calculateScheduledTime(trigger);
      if (trigger.timingMode === 'IMMEDIATE' || scheduledTime.getTime() <= Date.now() + 2000) {
        this.inFlightLocks.add(idempotencyKey);
        try {
          await this.dispatchTriggerEmailNow({
            trigger,
            recipientEmail: recipient.email,
            entityType: 'USER',
            entityId: user.id,
            idempotencyKey,
            context
          });
        } finally {
          this.inFlightLocks.delete(idempotencyKey);
        }
      } else {
        this.enqueueJob({
          trigger,
          entityType: 'USER',
          entityId: user.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || user.name,
          scheduledFor: scheduledTime.toISOString(),
          idempotencyKey,
          contextSnapshot: context
        });
      }
    }
  }

  // ============================================================================
  // 1B. ACCOUNT UNDER VERIFICATION (ACCOUNT_PENDING_VERIFICATION)
  // ============================================================================
  public async onAccountPendingVerification(user: User): Promise<void> {
    if (!user) return;
    const triggers = this.findActiveTriggers('ACCOUNT_PENDING_VERIFICATION');
    if (triggers.length === 0) return;

    const context = this.buildVerificationVariables(user, {
      status: 'Pending Verification',
      nextSteps: 'Our partner onboarding team is verifying your registration credentials.'
    });

    for (const trigger of triggers) {
      const idempotencyKey = `ACCOUNT_PENDING_VERIFICATION:${trigger.id}:${(user.id || user.email || '').toLowerCase()}`;
      if (this.inFlightLocks.has(idempotencyKey)) {
        continue;
      }
      if (this.hasIdempotencyExecution(idempotencyKey)) {
        const alreadyLoggedSkip = this.getExecutionLogs().some(
          l => l.idempotencyKey === idempotencyKey && l.status === 'SKIPPED'
        );
        if (!alreadyLoggedSkip) {
          this.recordSkippedExecution(
            trigger,
            'USER',
            user.id,
            user.email || '',
            idempotencyKey,
            'Duplicate event suppressed by idempotency guard (already sent)'
          );
        }
        continue;
      }

      const recipient = this.resolveRecipientEmail(trigger, 'USER', user);
      if (recipient.optOut) {
        this.recordSkippedExecution(trigger, 'USER', user.id, user.email || 'OPT_OUT', idempotencyKey, recipient.errorReason || 'User opted out');
        continue;
      }
      if (!recipient.email) {
        this.recordFailedExecution(trigger, 'USER', user.id, user.email || 'MISSING_EMAIL', idempotencyKey, recipient.errorReason || 'Invalid recipient email');
        continue;
      }

      const scheduledTime = this.calculateScheduledTime(trigger);
      if (trigger.timingMode === 'IMMEDIATE' || scheduledTime.getTime() <= Date.now() + 2000) {
        this.inFlightLocks.add(idempotencyKey);
        try {
          await this.dispatchTriggerEmailNow({
            trigger,
            recipientEmail: recipient.email,
            entityType: 'USER',
            entityId: user.id,
            idempotencyKey,
            context
          });
        } finally {
          this.inFlightLocks.delete(idempotencyKey);
        }
      } else {
        this.enqueueJob({
          trigger,
          entityType: 'USER',
          entityId: user.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || user.name,
          scheduledFor: scheduledTime.toISOString(),
          idempotencyKey,
          contextSnapshot: context
        });
      }
    }
  }

  // ============================================================================
  // 1C. ACCOUNT VERIFICATION APPROVED (ACCOUNT_VERIFICATION_APPROVED)
  // ============================================================================
  public async onAccountVerificationApproved(user: User, actor?: User | null): Promise<void> {
    if (!user) return;
    const triggers = this.findActiveTriggers('ACCOUNT_VERIFICATION_APPROVED');
    if (triggers.length === 0) return;

    const context = this.buildVerificationVariables(user, {
      status: 'Verified & Approved',
      reviewedBy: actor?.name || 'Administrator',
      reviewedAt: new Date().toISOString()
    });

    for (const trigger of triggers) {
      const idempotencyKey = `ACCOUNT_VERIFICATION_APPROVED:${trigger.id}:${(user.id || user.email || '').toLowerCase()}`;
      if (this.inFlightLocks.has(idempotencyKey)) {
        continue;
      }
      if (this.hasIdempotencyExecution(idempotencyKey)) {
        const alreadyLoggedSkip = this.getExecutionLogs().some(
          l => l.idempotencyKey === idempotencyKey && l.status === 'SKIPPED'
        );
        if (!alreadyLoggedSkip) {
          this.recordSkippedExecution(
            trigger,
            'USER',
            user.id,
            user.email || '',
            idempotencyKey,
            'Duplicate event suppressed by idempotency guard (already sent)'
          );
        }
        continue;
      }

      const recipient = this.resolveRecipientEmail(trigger, 'USER', user, actor);
      if (recipient.optOut) {
        this.recordSkippedExecution(trigger, 'USER', user.id, user.email || 'OPT_OUT', idempotencyKey, recipient.errorReason || 'User opted out');
        continue;
      }
      if (!recipient.email) {
        this.recordFailedExecution(trigger, 'USER', user.id, user.email || 'MISSING_EMAIL', idempotencyKey, recipient.errorReason || 'Invalid recipient email');
        continue;
      }

      const scheduledTime = this.calculateScheduledTime(trigger);
      if (trigger.timingMode === 'IMMEDIATE' || scheduledTime.getTime() <= Date.now() + 2000) {
        this.inFlightLocks.add(idempotencyKey);
        try {
          await this.dispatchTriggerEmailNow({
            trigger,
            recipientEmail: recipient.email,
            entityType: 'USER',
            entityId: user.id,
            idempotencyKey,
            context
          });
        } finally {
          this.inFlightLocks.delete(idempotencyKey);
        }
      } else {
        this.enqueueJob({
          trigger,
          entityType: 'USER',
          entityId: user.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || user.name,
          scheduledFor: scheduledTime.toISOString(),
          idempotencyKey,
          contextSnapshot: context
        });
      }
    }
  }

  // ============================================================================
  // 1D. ACCOUNT VERIFICATION REJECTED (ACCOUNT_VERIFICATION_REJECTED)
  // ============================================================================
  public async onAccountVerificationRejected(
    user: User,
    actor?: User | null,
    notes?: string,
    requirements?: string[] | string
  ): Promise<void> {
    if (!user) return;
    const triggers = this.findActiveTriggers('ACCOUNT_VERIFICATION_REJECTED');
    if (triggers.length === 0) return;

    const context = this.buildVerificationVariables(user, {
      status: 'Action Required / Rejected',
      notes: notes || user.verificationNotes || 'Additional trade documentation is required to verify your B2B account.',
      rejectedReason: notes || user.verificationNotes || 'Additional trade documentation required.',
      requirements: requirements || user.verificationRequirements,
      reviewedBy: actor?.name || 'Partner Onboarding Team',
      reviewedAt: new Date().toISOString()
    });

    for (const trigger of triggers) {
      const notesSignature = (notes || user.verificationNotes || 'default').trim().substring(0, 32);
      const idempotencyKey = `ACCOUNT_VERIFICATION_REJECTED:${trigger.id}:${(user.id || user.email || '').toLowerCase()}:${notesSignature}`;
      if (this.hasIdempotencyExecution(idempotencyKey) || this.inFlightLocks.has(idempotencyKey)) {
        continue;
      }

      const recipient = this.resolveRecipientEmail(trigger, 'USER', user, actor);
      if (recipient.optOut) {
        this.recordSkippedExecution(trigger, 'USER', user.id, user.email || 'OPT_OUT', idempotencyKey, recipient.errorReason || 'User opted out');
        continue;
      }
      if (!recipient.email) {
        this.recordFailedExecution(trigger, 'USER', user.id, user.email || 'MISSING_EMAIL', idempotencyKey, recipient.errorReason || 'Invalid recipient email');
        continue;
      }

      const scheduledTime = this.calculateScheduledTime(trigger);
      if (trigger.timingMode === 'IMMEDIATE' || scheduledTime.getTime() <= Date.now() + 2000) {
        this.inFlightLocks.add(idempotencyKey);
        try {
          await this.dispatchTriggerEmailNow({
            trigger,
            recipientEmail: recipient.email,
            entityType: 'USER',
            entityId: user.id,
            idempotencyKey,
            context
          });
        } finally {
          this.inFlightLocks.delete(idempotencyKey);
        }
      } else {
        this.enqueueJob({
          trigger,
          entityType: 'USER',
          entityId: user.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || user.name,
          scheduledFor: scheduledTime.toISOString(),
          idempotencyKey,
          contextSnapshot: context
        });
      }
    }
  }

  public buildVerificationVariables(
    user: User,
    verificationData?: {
      status?: string;
      notes?: string;
      rejectedReason?: string;
      requirements?: string[] | string;
      reviewedBy?: string;
      reviewedAt?: string;
      nextSteps?: string;
    }
  ): Record<string, string> {
    const nameParts = (user.name || '').trim().split(/\s+/);
    const firstName = user.firstName || nameParts[0] || 'Partner';
    const lastName = user.lastName || nameParts.slice(1).join(' ') || '';
    const fullName = user.name || `${firstName} ${lastName}`.trim();
    const company = user.companyName || user.agencyName || 'Registered Travel Partner';

    const reqList = Array.isArray(verificationData?.requirements)
      ? verificationData.requirements.join(', ')
      : (verificationData?.requirements || 'Valid business registration license, verified trade credential (IATA/ABTA/GST), and official agency billing address.');

    const reviewedAt = verificationData?.reviewedAt
      ? new Date(verificationData.reviewedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return {
      'user.firstName': firstName,
      'user.lastName': lastName,
      'user.fullName': fullName,
      'user.email': user.email || '',
      'user.companyName': company,
      'company.name': company,
      'agent.agencyName': company,
      'agent.agentName': fullName,
      'agent.agentEmail': user.email || '',
      'verification.status': verificationData?.status || user.approvalStatus || 'Pending Verification',
      'verification.notes': verificationData?.notes || user.verificationNotes || 'Please provide updated trade credentials for partner verification.',
      'verification.rejectedReason': verificationData?.rejectedReason || verificationData?.notes || user.verificationNotes || 'Additional trade documentation required.',
      'verification.requirementsList': reqList,
      'verification.reviewedAt': reviewedAt,
      'verification.reviewedBy': verificationData?.reviewedBy || user.verifiedBy || user.verificationRejectedBy || 'TheUnbound Partner Verification Desk',
      'verification.nextSteps': verificationData?.nextSteps || 'Our verification desk will notify you once review is complete.'
    };
  }

  // ============================================================================
  // 2. SAVED QUOTE REMINDER (QUOTE_SAVED)
  // ============================================================================
  public async onQuoteSaved(quote: Quotation, actor?: User | null): Promise<void> {
    if (!quote || !quote.id) return;
    const triggers = this.findActiveTriggers('QUOTE_SAVED');
    if (triggers.length === 0) return;

    const context = this.buildQuoteVariables(quote, actor);

    for (const trigger of triggers) {
      const idempotencyKey = `QUOTE_SAVED:${trigger.id}:${quote.id}`;
      if (this.hasIdempotencyExecution(idempotencyKey) || this.inFlightLocks.has(idempotencyKey)) {
        continue;
      }

      const recipient = this.resolveRecipientEmail(trigger, 'QUOTE', quote, actor);
      if (recipient.optOut) {
        this.recordSkippedExecution(trigger, 'QUOTE', quote.id, 'OPT_OUT', idempotencyKey, recipient.errorReason || 'Quote owner opted out');
        continue;
      }
      if (!recipient.email) {
        this.recordFailedExecution(trigger, 'QUOTE', quote.id, quote.clientEmail || quote.agentEmail || 'MISSING_EMAIL', idempotencyKey, recipient.errorReason || 'Missing deliverable quote email');
        continue;
      }

      const scheduledTime = this.calculateScheduledTime(trigger);
      if (trigger.timingMode === 'IMMEDIATE' || scheduledTime.getTime() <= Date.now() + 2000) {
        this.inFlightLocks.add(idempotencyKey);
        try {
          await this.dispatchTriggerEmailNow({
            trigger,
            recipientEmail: recipient.email,
            entityType: 'QUOTE',
            entityId: quote.id,
            idempotencyKey,
            context
          });
        } finally {
          this.inFlightLocks.delete(idempotencyKey);
        }
      } else {
        this.enqueueJob({
          trigger,
          entityType: 'QUOTE',
          entityId: quote.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || quote.clientName || quote.agentName || actor?.name,
          scheduledFor: scheduledTime.toISOString(),
          idempotencyKey,
          contextSnapshot: context
        });
      }
    }
  }

  // ============================================================================
  // 3. DOWNLOADED QUOTE REMINDER (QUOTE_DOWNLOADED)
  // ============================================================================
  public async onQuoteDownloaded(quote: Quotation, actor?: User | null): Promise<void> {
    if (!quote || !quote.id) return;
    const triggers = this.findActiveTriggers('QUOTE_DOWNLOADED');
    if (triggers.length === 0) return;

    const context = this.buildQuoteVariables(quote, actor);

    for (const trigger of triggers) {
      const idempotencyKey = `QUOTE_DOWNLOADED:${trigger.id}:${quote.id}`;
      if (this.hasIdempotencyExecution(idempotencyKey) || this.inFlightLocks.has(idempotencyKey)) {
        continue;
      }

      const recipient = this.resolveRecipientEmail(trigger, 'QUOTE', quote, actor);
      if (recipient.optOut) {
        this.recordSkippedExecution(trigger, 'QUOTE', quote.id, 'OPT_OUT', idempotencyKey, recipient.errorReason || 'Quote owner opted out');
        continue;
      }
      if (!recipient.email) {
        this.recordFailedExecution(trigger, 'QUOTE', quote.id, quote.clientEmail || quote.agentEmail || 'MISSING_EMAIL', idempotencyKey, recipient.errorReason || 'Missing deliverable quote email');
        continue;
      }

      const scheduledTime = this.calculateScheduledTime(trigger);
      if (trigger.timingMode === 'IMMEDIATE' || scheduledTime.getTime() <= Date.now() + 2000) {
        this.inFlightLocks.add(idempotencyKey);
        try {
          await this.dispatchTriggerEmailNow({
            trigger,
            recipientEmail: recipient.email,
            entityType: 'QUOTE',
            entityId: quote.id,
            idempotencyKey,
            context
          });
        } finally {
          this.inFlightLocks.delete(idempotencyKey);
        }
      } else {
        this.enqueueJob({
          trigger,
          entityType: 'QUOTE',
          entityId: quote.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || quote.clientName || quote.agentName || actor?.name,
          scheduledFor: scheduledTime.toISOString(),
          idempotencyKey,
          contextSnapshot: context
        });
      }
    }
  }

  // ============================================================================
  // 4. FIRST BOOKING WELCOME (FIRST_BOOKING_COMPLETED) &
  // 5. BOOKING CONFIRMATION SLA (BOOKING_CONFIRMATION_SLA)
  // ============================================================================
  public async onBookingCreated(booking: Booking, actor?: User | null): Promise<void> {
    if (!booking || !booking.id) return;
    const db = AppDatabase.getInstance();

    // If this booking came from a quote, automatically cancel any pending QUOTE_SAVED or QUOTE_DOWNLOADED reminders
    const linkedQuoteId = booking.linkedQuoteId || (booking as any).quoteId;
    if (linkedQuoteId) {
      this.cancelPendingQuoteReminders(linkedQuoteId, booking.bookingReference || booking.id);
    }

    const context = this.buildBookingVariables(booking, actor);

    // --- 4A. FIRST BOOKING WELCOME (Strictly Once Per Account/User) ---
    const firstBookingTriggers = this.findActiveTriggers('FIRST_BOOKING_COMPLETED');
    for (const firstBookingTrigger of firstBookingTriggers) {
      const recipient = this.resolveRecipientEmail(firstBookingTrigger, 'BOOKING', booking, actor);
      if (recipient.optOut) {
        this.recordSkippedExecution(
          firstBookingTrigger,
          'BOOKING',
          booking.bookingReference || booking.id,
          'OPT_OUT',
          `FIRST_BOOKING_COMPLETED:${firstBookingTrigger.id}:${booking.id}`,
          recipient.errorReason || 'User opted out'
        );
        continue;
      }
      if (!recipient.email) {
        this.recordFailedExecution(
          firstBookingTrigger,
          'BOOKING',
          booking.bookingReference || booking.id,
          booking.customer?.email || 'MISSING_EMAIL',
          `FIRST_BOOKING_COMPLETED:${firstBookingTrigger.id}:${booking.id}`,
          recipient.errorReason || 'Invalid booking recipient email'
        );
        continue;
      }

      const recipientEmail = recipient.email;
      const accountKey = (actor?.id || booking.agentId || booking.userId || (booking as any).submittedByUserId || recipientEmail).toLowerCase();
      const idempotencyKey = `FIRST_BOOKING_COMPLETED:${firstBookingTrigger.id}:${accountKey}`;

      if (!this.inFlightLocks.has(idempotencyKey)) {
        this.inFlightLocks.add(idempotencyKey);
        try {
          const ledgerRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.FIRST_BOOKING_LEDGER) : null;
          const ledger: Record<string, { sentAt: string; messageId: string; bookingId: string }> = ledgerRaw
            ? JSON.parse(ledgerRaw)
            : {};

          const matchingUser = db.getUsers().find(
            u =>
              (actor?.id && u.id === actor.id) ||
              (booking.agentId && u.id === booking.agentId) ||
              (booking.userId && u.id === booking.userId) ||
              ((booking as any).submittedByUserId && u.id === (booking as any).submittedByUserId) ||
              (u.email && u.email.toLowerCase() === recipientEmail)
          );

          const allUserBookings = db.getAllBookings().filter(b => {
            const bEmail = (b.agentEmailSnapshot || b.customer?.email || '').toLowerCase();
            return (
              (actor?.id && (b.agentId === actor.id || b.userId === actor.id || (b as any).submittedByUserId === actor.id)) ||
              (booking.agentId && b.agentId === booking.agentId) ||
              (booking.userId && b.userId === booking.userId) ||
              ((booking as any).submittedByUserId && (b as any).submittedByUserId === (booking as any).submittedByUserId) ||
              (bEmail && bEmail === recipientEmail)
            );
          });

          const alreadySent =
            Boolean(ledger[accountKey]) ||
            Boolean(matchingUser?.firstBookingWelcomeSentAt) ||
            this.hasIdempotencyExecution(idempotencyKey);

          // Check if any prior booking (excluding the current newly created booking) exists for this account
          const priorBookingsCount = allUserBookings.filter(b => b.id !== booking.id && b.bookingReference !== booking.bookingReference).length;

          if (alreadySent || priorBookingsCount > 0) {
            this.recordSkippedExecution(
              firstBookingTrigger,
              'BOOKING',
              booking.bookingReference || booking.id,
              recipientEmail,
              idempotencyKey,
              alreadySent
                ? `First Booking Welcome already sent at ${ledger[accountKey]?.sentAt || matchingUser?.firstBookingWelcomeSentAt || 'prior session'}`
                : `Account already has ${priorBookingsCount} prior booking(s) (only triggers on 1st booking)`
            );
          } else {
            const scheduledTime = this.calculateScheduledTime(firstBookingTrigger);
            if (firstBookingTrigger.timingMode === 'IMMEDIATE' || scheduledTime.getTime() <= Date.now() + 2000) {
              const dispatchResult = await this.dispatchTriggerEmailNow({
                trigger: firstBookingTrigger,
                recipientEmail,
                entityType: 'BOOKING',
                entityId: booking.bookingReference || booking.id,
                idempotencyKey,
                context
              });

              if (dispatchResult.success) {
                const sentAt = new Date().toISOString();
                ledger[accountKey] = {
                  sentAt,
                  messageId: dispatchResult.messageId || `welcome-${Date.now()}`,
                  bookingId: booking.id
                };
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(STORAGE_KEYS.FIRST_BOOKING_LEDGER, JSON.stringify(ledger));
                }
                if (matchingUser) {
                  db.saveUser(
                    {
                      ...matchingUser,
                      firstBookingWelcomeSentAt: sentAt,
                      firstBookingWelcomeMessageId: dispatchResult.messageId
                    },
                    null,
                    'USER_ROLE_CHANGED',
                    'Recorded First Booking Welcome milestone dispatch',
                    true
                  );
                }
              }
            } else {
              this.enqueueJob({
                trigger: firstBookingTrigger,
                entityType: 'BOOKING',
                entityId: booking.bookingReference || booking.id,
                recipientEmail,
                recipientName: recipient.name || booking.customer?.name || actor?.name,
                scheduledFor: scheduledTime.toISOString(),
                idempotencyKey,
                contextSnapshot: context
              });
            }
          }
        } finally {
          this.inFlightLocks.delete(idempotencyKey);
        }
      }
    }

    // --- 5. BOOKING CONFIRMATION SLA ---
    const slaTriggers = this.findActiveTriggers('BOOKING_CONFIRMATION_SLA');
    for (const slaTrigger of slaTriggers) {
      const excluded = slaTrigger.slaConfig?.excludedStatuses || ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'CLOSED'];
      const slaIdempotencyKey = `BOOKING_CONFIRMATION_SLA:${slaTrigger.id}:${booking.id}`;

      if (excluded.includes(booking.status)) {
        this.recordSkippedExecution(
          slaTrigger,
          'BOOKING',
          booking.bookingReference || booking.id,
          booking.customer?.email || actor?.email || 'N/A',
          slaIdempotencyKey,
          `Booking created with excluded status ${booking.status}; SLA timer not required.`
        );
        continue;
      }

      const recipient = this.resolveRecipientEmail(slaTrigger, 'BOOKING', booking, actor);
      if (recipient.optOut) {
        this.recordSkippedExecution(slaTrigger, 'BOOKING', booking.id, 'OPT_OUT', slaIdempotencyKey, recipient.errorReason || 'User opted out');
        continue;
      }
      if (!recipient.email) {
        this.recordFailedExecution(slaTrigger, 'BOOKING', booking.id, 'MISSING_EMAIL', slaIdempotencyKey, recipient.errorReason || 'Invalid booking contact email');
        continue;
      }

      const slaScheduledTime = this.calculateScheduledTime(slaTrigger);
      if (slaTrigger.timingMode === 'IMMEDIATE' || slaScheduledTime.getTime() <= Date.now() + 2000) {
        await this.dispatchTriggerEmailNow({
          trigger: slaTrigger,
          recipientEmail: recipient.email,
          entityType: 'BOOKING',
          entityId: booking.id,
          idempotencyKey: slaIdempotencyKey,
          context
        });
      } else {
        this.enqueueJob({
          trigger: slaTrigger,
          entityType: 'BOOKING',
          entityId: booking.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || booking.customer?.name || actor?.name,
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
          const matchingTrigger = triggers.find(t => t.id === job.triggerId) || slaTrigger;
          if (matchingTrigger) {
            this.recordCancelledExecution(
              matchingTrigger,
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
        const trigger = triggers.find(t => t.id === job.triggerId || t.triggerKey === job.triggerKey);
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
   * Evaluates and executes a scheduled job (checking live Quote/Booking status rules and atomic locks).
   */
  public async evaluateAndExecuteJob(jobId: string, forceImmediate = false): Promise<{ status: string; reason?: string }> {
    if (this.inFlightJobIds.has(jobId)) {
      return { status: 'IN_PROGRESS', reason: 'Job is currently being processed by another worker tick.' };
    }

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

    this.inFlightJobIds.add(jobId);
    try {
      const db = AppDatabase.getInstance();
      const triggers = this.ensureCanonicalTriggers();
      const trigger = triggers.find(t => t.id === job.triggerId || t.triggerKey === job.triggerKey);

      if (!trigger || !trigger.isEnabled || trigger.status === 'INACTIVE' || trigger.status === 'DRAFT') {
        const reason = 'Trigger was disabled or set to Inactive/Draft prior to scheduled execution.';
        jobs[jobIndex] = { ...job, status: 'SKIPPED', executedAt: new Date().toISOString(), statusReason: reason };
        this.saveScheduledJobs(jobs);
        if (trigger) {
          this.recordSkippedExecution(trigger, job.entityType, job.entityId, job.recipientEmail, job.idempotencyKey, reason);
        }
        return { status: 'SKIPPED', reason };
      }

      if (this.hasIdempotencyExecution(job.idempotencyKey)) {
        const reason = 'Duplicate-send prevention: Email already dispatched for this entity event.';
        jobs[jobIndex] = { ...job, status: 'SKIPPED', executedAt: new Date().toISOString(), statusReason: reason };
        this.saveScheduledJobs(jobs);
        return { status: 'SKIPPED', reason };
      }

      // Check QUOTE_SAVED and QUOTE_DOWNLOADED live conversion/expiration status
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
              Boolean(quote.bookingId) ||
              (Array.isArray(quote.linkedBookingIds) && quote.linkedBookingIds.length > 0)))
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

      // Check BOOKING_CONFIRMATION_SLA live status
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

      const refreshedJobs = this.getScheduledJobs();
      const targetIdx = refreshedJobs.findIndex(j => j.id === job.id);
      if (targetIdx >= 0) {
        refreshedJobs[targetIdx] = {
          ...refreshedJobs[targetIdx],
          status: res.success ? 'EXECUTED' : 'FAILED',
          executedAt: new Date().toISOString(),
          statusReason: res.success ? `Dispatched (${res.messageId || 'OK'})` : (res.error || 'Provider dispatch failed'),
          retryCount: res.success ? job.retryCount : job.retryCount + 1
        };
        this.saveScheduledJobs(refreshedJobs);
        return { status: refreshedJobs[targetIdx].status, reason: refreshedJobs[targetIdx].statusReason };
      }

      return { status: res.success ? 'EXECUTED' : 'FAILED', reason: res.error };
    } finally {
      this.inFlightJobIds.delete(jobId);
    }
  }

  /**
   * Simulates a trigger execution (Dry Run) against real or sample application data without sending an email.
   */
  public dryRunTrigger(
    trigger: EmailCampaignConfig,
    optionsOrRecipient?: { recipientEmailOverride?: string; entityId?: string } | string
  ): TriggerDryRunResult {
    const options =
      typeof optionsOrRecipient === 'string'
        ? { recipientEmailOverride: optionsOrRecipient }
        : optionsOrRecipient;
    const validation = this.validateTriggerConfig(trigger);
    const db = AppDatabase.getInstance();
    const triggerKey = trigger.triggerKey || trigger.campaignType || 'USER_REGISTERED';

    let entityType: 'USER' | 'QUOTE' | 'BOOKING' | 'PREVIEW' = 'PREVIEW';
    let entityId = options?.entityId || 'SAMPLE-PREVIEW';
    let isRealRecord = false;
    let variablesUsed: Record<string, string> = {};
    let conditionPassed = true;
    let conditionReason = `Trigger "${trigger.name}" is eligible for execution on ${triggerKey}.`;
    let resolvedRecipient = (options?.recipientEmailOverride || '').trim();

    if (
      triggerKey === 'USER_REGISTERED' ||
      triggerKey === 'ACCOUNT_PENDING_VERIFICATION' ||
      triggerKey === 'ACCOUNT_VERIFICATION_APPROVED' ||
      triggerKey === 'ACCOUNT_VERIFICATION_REJECTED'
    ) {
      entityType = 'USER';
      const users = db.getUsers();
      const targetUser =
        (options?.entityId && users.find(u => u.id === options.entityId || u.email === options.entityId)) ||
        users.find(u => isValidDeliverableEmail(u.email));

      if (targetUser) {
        isRealRecord = true;
        entityId = targetUser.id;
        variablesUsed = this.buildVerificationVariables(targetUser, {
          status:
            triggerKey === 'ACCOUNT_VERIFICATION_APPROVED'
              ? 'Verified & Approved'
              : triggerKey === 'ACCOUNT_VERIFICATION_REJECTED'
              ? 'Action Required / Rejected'
              : 'Pending Verification'
        });
        if (!resolvedRecipient) {
          const rec = this.resolveRecipientEmail(trigger, 'USER', targetUser);
          resolvedRecipient = rec.email;
          if (!rec.email) {
            conditionPassed = false;
            conditionReason = rec.errorReason || 'No valid recipient email.';
          }
        }
      }
    } else if (triggerKey === 'QUOTE_SAVED' || triggerKey === 'QUOTE_DOWNLOADED') {
      entityType = 'QUOTE';
      const quotes = db.getAllSavedQuotes();
      const targetQuote =
        (options?.entityId && quotes.find(q => q.id === options.entityId || q.quoteNumber === options.entityId)) ||
        quotes[0];

      if (targetQuote) {
        isRealRecord = true;
        entityId = targetQuote.quoteNumber || targetQuote.id;
        variablesUsed = this.buildQuoteVariables(targetQuote);
        if (!resolvedRecipient) {
          const rec = this.resolveRecipientEmail(trigger, 'QUOTE', targetQuote);
          resolvedRecipient = rec.email;
        }
        if (targetQuote.status === 'BOOKED' || targetQuote.status === 'ACCEPTED') {
          conditionPassed = false;
          conditionReason = `Quote ${entityId} has already converted to BOOKED; reminder would be skipped at execution time.`;
        } else if (targetQuote.status === 'EXPIRED') {
          conditionPassed = false;
          conditionReason = `Quote ${entityId} is EXPIRED; reminder would be skipped.`;
        } else {
          conditionReason = `Quote ${entityId} is active (${targetQuote.status || 'DRAFT'}) and not yet booked; eligible for reminder.`;
        }
      }
    } else if (triggerKey === 'FIRST_BOOKING_COMPLETED' || triggerKey === 'BOOKING_CONFIRMATION_SLA') {
      entityType = 'BOOKING';
      const bookings = db.getAllBookings();
      const targetBooking =
        (options?.entityId && bookings.find(b => b.id === options.entityId || b.bookingReference === options.entityId)) ||
        bookings[0];

      if (targetBooking) {
        isRealRecord = true;
        entityId = targetBooking.bookingReference || targetBooking.id;
        variablesUsed = this.buildBookingVariables(targetBooking);
        if (!resolvedRecipient) {
          const rec = this.resolveRecipientEmail(trigger, 'BOOKING', targetBooking);
          resolvedRecipient = rec.email;
        }
        if (triggerKey === 'BOOKING_CONFIRMATION_SLA') {
          const excluded = trigger.slaConfig?.excludedStatuses || ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'CLOSED'];
          if (excluded.includes(targetBooking.status)) {
            conditionPassed = false;
            conditionReason = `Booking ${entityId} is already ${targetBooking.status} (excluded status); SLA escalation would be cancelled.`;
          } else {
            conditionReason = `Booking ${entityId} is in ${targetBooking.status} status; SLA escalation will fire if unconfirmed at threshold.`;
          }
        }
      }
    }

    // Fallback to catalog sample variables if no live entity record was found
    if (Object.keys(variablesUsed).length === 0) {
      for (const v of CONTEXTUAL_VARIABLE_CATALOG) {
        const k = v.token.replace(/^\{\{|\}\}$/g, '').trim();
        variablesUsed[k] = v.sampleValue;
      }
    }
    if (resolvedRecipient) {
      variablesUsed['user.email'] = resolvedRecipient;
    } else {
      resolvedRecipient = variablesUsed['user.email'] || 'partner@theunbound.in';
    }

    const scheduledDate = this.calculateScheduledTime(trigger);
    const renderedSubject = this.renderTemplateWithVariables(trigger.subject, variablesUsed, { isPreview: !isRealRecord });
    const renderedHtml = this.renderTemplateWithVariables(trigger.templateHtml, variablesUsed, { isPreview: !isRealRecord });

    const senderHeader = trigger.senderEmail
      ? (trigger.senderName ? `${trigger.senderName} <${trigger.senderEmail}>` : trigger.senderEmail)
      : 'TheUnbound Operations <business@theunbound.in>';

    return {
      validConfig: validation.valid,
      validationErrors: validation.errors,
      triggerEnabled: Boolean(trigger.isEnabled && trigger.status !== 'INACTIVE' && trigger.status !== 'DRAFT'),
      conditionPassed: validation.valid && conditionPassed,
      conditionReason: !validation.valid ? validation.errors.join(' ') : conditionReason,
      resolvedRecipient,
      internalCopyRecipients: trigger.internalCopyRecipients || ['business@theunbound.in'],
      senderHeader,
      timingMode: this.formatTimingBadge(trigger),
      scheduledFor: scheduledDate.toISOString(),
      renderedSubject,
      renderedHtml,
      variablesUsed,
      entityUsed: {
        entityType,
        entityId,
        isRealRecord
      }
    };
  }

  /**
   * Sends a live Test Email for a trigger configuration and accurately records TEST_SENT or FAILED.
   */
  public async sendTestTriggerEmail(
    trigger: EmailCampaignConfig,
    recipientEmail: string,
    actor?: User | null
  ): Promise<{ success: boolean; messageId?: string; error?: string; dryRun?: TriggerDryRunResult }> {
    const cleanRecipient = (recipientEmail || '').trim();
    if (!isValidDeliverableEmail(cleanRecipient)) {
      return {
        success: false,
        error: `Please provide a valid deliverable recipient email address (received "${cleanRecipient || 'empty'}").`
      };
    }

    const validation = this.validateTriggerConfig(trigger);
    if (!validation.valid) {
      return {
        success: false,
        error: `Trigger configuration is invalid: ${validation.errors.join(' ')}`
      };
    }

    const dryRun = this.dryRunTrigger(trigger, { recipientEmailOverride: cleanRecipient });
    const resolvedSubject = `[TEST] ${dryRun.renderedSubject}`;
    const resolvedBody = dryRun.renderedHtml;

    const emailService = EmailNotificationService.getInstance();
    const res = await emailService.sendViaGmailApi(
      cleanRecipient,
      resolvedSubject,
      resolvedBody,
      {
        recipientType: 'ADMIN',
        eventType: 'OPERATIONAL_ALERT_SENT',
        sentBy: actor?.id || 'admin',
        sentByName: actor?.name || 'Admin Test Runner',
        idempotencyKey: `TEST:${trigger.id}:${Date.now()}`,
        cc: trigger.internalCopyRecipients,
        senderName: trigger.senderName,
        senderEmail: trigger.senderEmail
      }
    );

    if (!res.success) {
      this.appendExecutionLog({
        id: `exec-test-fail-${Date.now()}`,
        triggerId: trigger.id,
        triggerKey: trigger.triggerKey || 'USER_REGISTERED',
        triggerName: trigger.name,
        entityType: 'TEST',
        entityId: dryRun.entityUsed.entityId,
        recipientEmail: cleanRecipient,
        internalCopySentTo: trigger.internalCopyRecipients || ['business@theunbound.in'],
        subject: resolvedSubject,
        templateVersion: trigger.templateVersion || 'v1.0',
        status: 'FAILED',
        reason: `Test email dispatch failed: ${res.error || 'Provider rejected request'}`,
        executedAt: new Date().toISOString(),
        idempotencyKey: `TEST:${trigger.id}:${Date.now()}`
      });
      return { success: false, error: res.error || 'Test email dispatch failed', dryRun };
    }

    const db = AppDatabase.getInstance();
    db.dispatchEmailCampaign(trigger.id, cleanRecipient, actor || null);

    this.appendExecutionLog({
      id: `exec-test-${Date.now()}`,
      triggerId: trigger.id,
      triggerKey: trigger.triggerKey || 'USER_REGISTERED',
      triggerName: trigger.name,
      entityType: 'TEST',
      entityId: dryRun.entityUsed.entityId,
      recipientEmail: cleanRecipient,
      internalCopySentTo: trigger.internalCopyRecipients || ['business@theunbound.in'],
      subject: resolvedSubject,
      templateVersion: trigger.templateVersion || 'v1.0',
      status: 'TEST_SENT',
      reason: `Live test email accepted by provider (${res.providerStatus || 'OK'})`,
      messageId: res.messageId,
      executedAt: new Date().toISOString(),
      idempotencyKey: `TEST:${trigger.id}:${Date.now()}`
    });

    return { success: true, messageId: res.messageId, dryRun };
  }

  public async retryFailedExecution(logId: string, actor?: User | null): Promise<boolean> {
    const logs = this.getExecutionLogs();
    const target = logs.find(l => l.id === logId);
    if (!target) return false;

    const triggers = this.ensureCanonicalTriggers();
    const trigger = triggers.find(t => t.id === target.triggerId || t.triggerKey === target.triggerKey);
    if (!trigger) return false;

    if (target.entityType === 'TEST') {
      const testRes = await this.sendTestTriggerEmail(trigger, target.recipientEmail, actor);
      return testRes.success;
    }

    const retryKey = `${target.idempotencyKey}:RETRY:${Date.now()}`;
    const res = await this.dispatchTriggerEmailNow({
      trigger,
      recipientEmail: target.recipientEmail,
      entityType: target.entityType as 'USER' | 'QUOTE' | 'BOOKING',
      entityId: target.entityId,
      idempotencyKey: retryKey,
      context: { 'user.email': target.recipientEmail }
    });
    return res.success;
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
  }): ScheduledAutomationJob {
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
      createdAt: existingIdx >= 0 ? jobs[existingIdx].createdAt : new Date().toISOString(),
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
    return jobRecord;
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

    const validation = this.validateTriggerConfig(trigger);
    if (!validation.valid) {
      const errMsg = `Invalid trigger configuration: ${validation.errors.join(' ')}`;
      this.recordFailedExecution(trigger, entityType, entityId, recipientEmail, idempotencyKey, errMsg, jobId);
      return { success: false, error: errMsg };
    }

    if (!isValidDeliverableEmail(recipientEmail)) {
      const errMsg = `Undeliverable recipient email address: "${recipientEmail}"`;
      this.recordFailedExecution(trigger, entityType, entityId, recipientEmail, idempotencyKey, errMsg, jobId);
      return { success: false, error: errMsg };
    }

    const resolvedSubject = this.renderTemplateWithVariables(trigger.subject, context, { isPreview: false });
    const resolvedBody = this.renderTemplateWithVariables(trigger.templateHtml, context, { isPreview: false });

    const emailService = EmailNotificationService.getInstance();
    const res = await emailService.sendViaGmailApi(
      recipientEmail,
      resolvedSubject,
      resolvedBody,
      {
        quoteId: entityType === 'QUOTE' ? entityId : undefined,
        bookingId: entityType === 'BOOKING' ? entityId : undefined,
        recipientType: entityType === 'USER' ? 'B2B_AGENT' : 'BUYER',
        eventType: entityType === 'QUOTE' ? 'QUOTE_EMAIL_SENT' : 'BOOKING_EMAIL_SENT',
        idempotencyKey,
        cc: trigger.internalCopyRecipients,
        senderName: trigger.senderName,
        senderEmail: trigger.senderEmail
      }
    );

    if (!res.success) {
      this.recordFailedExecution(
        trigger,
        entityType,
        entityId,
        recipientEmail,
        idempotencyKey,
        res.error || 'Email provider failed to accept message',
        jobId
      );
      return { success: false, error: res.error || 'Email provider failed to accept message' };
    }

    const messageId = res.messageId || `tx-msg-${Date.now()}`;
    this.recordIdempotencyExecution(idempotencyKey, messageId);

    const db = AppDatabase.getInstance();
    const freshTriggers = db.getEmailCampaigns();
    const currentTrigger = freshTriggers.find(t => t.id === trigger.id) || trigger;
    const updatedTrigger: EmailCampaignConfig = {
      ...currentTrigger,
      sentCount: (currentTrigger.sentCount || 0) + 1,
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
      reason: `Email accepted by provider (${res.providerStatus || 'OK'})`,
      messageId,
      executedAt: new Date().toISOString(),
      idempotencyKey
    });

    return { success: true, messageId };
  }

  private recordFailedExecution(
    trigger: EmailCampaignConfig,
    entityType: 'USER' | 'QUOTE' | 'BOOKING',
    entityId: string,
    recipientEmail: string,
    idempotencyKey: string,
    reason: string,
    jobId?: string
  ): void {
    const db = AppDatabase.getInstance();
    const freshTriggers = db.getEmailCampaigns();
    const currentTrigger = freshTriggers.find(t => t.id === trigger.id) || trigger;
    db.saveEmailCampaign(
      {
        ...currentTrigger,
        failedCount: (currentTrigger.failedCount || 0) + 1
      },
      null
    );

    this.appendExecutionLog({
      id: `exec-fail-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      jobId,
      triggerId: trigger.id,
      triggerKey: trigger.triggerKey || 'USER_REGISTERED',
      triggerName: trigger.name,
      entityType,
      entityId,
      recipientEmail,
      internalCopySentTo: trigger.internalCopyRecipients || ['business@theunbound.in'],
      subject: trigger.subject,
      templateVersion: trigger.templateVersion || 'v1.0',
      status: 'FAILED',
      reason,
      executedAt: new Date().toISOString(),
      idempotencyKey
    });
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
    const freshTriggers = db.getEmailCampaigns();
    const currentTrigger = freshTriggers.find(t => t.id === trigger.id) || trigger;
    db.saveEmailCampaign(
      {
        ...currentTrigger,
        skippedCount: (currentTrigger.skippedCount || 0) + 1
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
      quote.items?.reduce((acc, i: any) => Math.max(acc, (i.adults || 0) + (i.children || 0)), 2) ||
      2;

    const createdDate = quote.createdAt ? new Date(quote.createdAt) : new Date();
    const validUntilDate = quote.validUntil
      ? new Date(quote.validUntil)
      : new Date(createdDate.getTime() + 14 * 24 * 3600 * 1000);

    const bestEmail =
      (isValidDeliverableEmail(quote.agentEmail) && quote.agentEmail) ||
      (isValidDeliverableEmail(actor?.email) && actor?.email) ||
      (isValidDeliverableEmail(quote.clientEmail) && quote.clientEmail) ||
      quote.agentEmail ||
      quote.clientEmail ||
      '';

    return {
      'user.firstName': parts[0] || 'Valued',
      'user.lastName': parts.slice(1).join(' ') || 'Partner',
      'user.fullName': fullName,
      'user.email': bestEmail,
      'user.companyName': quote.clientCompany || quote.agentAgency || quote.agentCompany || actor?.companyName || actor?.agencyName || 'Travel Partner Agency',
      'quote.quoteId': quote.id,
      'quote.quoteReference': quote.quoteNumber || quote.id,
      'quote.createdAt': createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'quote.validUntil': validUntilDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'quote.total': formatCurrency(quote.finalCustomerSellingPrice || quote.totalSellingPrice || 0, quote.currency || 'USD'),
      'quote.currency': quote.currency || 'USD',
      'trip.destination': quote.destination || (quote.items?.[0] as any)?.product?.city || 'Japan',
      'trip.startDate': quote.travelStartDate || 'Upcoming Season',
      'trip.endDate': quote.travelEndDate || quote.travelStartDate || 'Scheduled Return',
      'trip.passengerCount': String(paxCount),
      'agent.agencyName': quote.agentAgency || quote.agentCompany || actor?.agencyName || 'Partner Travel Desk',
      'agent.agentName': quote.agentName || actor?.name || fullName,
      'agent.agentEmail': quote.agentEmail || actor?.email || bestEmail
    };
  }

  private buildBookingVariables(booking: Booking, actor?: User | null): Record<string, string> {
    const fullName = booking.customer?.name || booking.agentName || actor?.name || 'Valued Partner';
    const parts = fullName.trim().split(/\s+/);
    const paxCount =
      booking.items?.reduce((acc, i: any) => Math.max(acc, (i.adults || 0) + (i.children || 0) + (i.infants || 0)), 2) || 2;

    const bestEmail =
      (isValidDeliverableEmail(booking.agentEmailSnapshot) && booking.agentEmailSnapshot) ||
      (isValidDeliverableEmail(actor?.email) && actor?.email) ||
      (isValidDeliverableEmail(booking.customer?.email) && booking.customer?.email) ||
      booking.customer?.email ||
      '';

    return {
      'user.firstName': parts[0] || 'Valued',
      'user.lastName': parts.slice(1).join(' ') || 'Partner',
      'user.fullName': fullName,
      'user.email': bestEmail,
      'user.companyName': booking.agencyName || booking.agentAgency || actor?.companyName || actor?.agencyName || 'Travel Partner',
      'booking.bookingId': booking.id,
      'booking.bookingReference': booking.bookingReference || booking.id,
      'booking.bookingDate': new Date(booking.submittedAt || Date.now()).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      'booking.status': booking.status || 'PENDING_CONFIRMATION',
      'trip.destination': booking.destination || (booking as any).destinationName || (booking.items?.[0] as any)?.product?.city || 'Japan',
      'trip.startDate': booking.travelStartDate || 'Scheduled Departure',
      'trip.endDate': booking.travelEndDate || booking.travelStartDate || 'Scheduled Return',
      'trip.passengerCount': String(paxCount),
      'agent.agencyName': booking.agencyName || booking.agentAgency || actor?.agencyName || 'Partner Agency',
      'agent.agentName': booking.agentName || actor?.name || fullName,
      'agent.agentEmail': booking.agentEmailSnapshot || actor?.email || bestEmail
    };
  }
}

export const marketingAutomationScheduler = MarketingAutomationScheduler.getInstance();
