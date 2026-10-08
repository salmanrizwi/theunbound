import React, { useState, useEffect, useRef } from 'react';
import { AppDatabase } from '../../services/db';
import {
  EmailCampaignConfig,
  MarketingAutomationExecutionLog,
  MarketingTriggerKey,
  ScheduledAutomationJob,
  TriggerDelayUnit,
  TriggerStatus,
  TriggerTimingMode
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  marketingAutomationScheduler,
  VariableDefinition
} from '../../services/marketingAutomationScheduler';
import {
  Mail,
  Send,
  Edit,
  CheckCircle2,
  Clock,
  Eye,
  X,
  Copy,
  History,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  SlidersHorizontal,
  FileText,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  Minus,
  Heading2,
  MousePointerClick,
  Play,
  ShieldCheck,
  Search
} from 'lucide-react';

interface EmailCampaignsManagerProps {
  initialView?: 'TRIGGERS' | 'QUEUE' | 'LOGS';
}

const DELAY_PRESETS: Array<{ label: string; value: number; unit: TriggerDelayUnit }> = [
  { label: 'After 1 hour', value: 1, unit: 'HOURS' },
  { label: 'After 6 hours', value: 6, unit: 'HOURS' },
  { label: 'After 24 hours', value: 24, unit: 'HOURS' },
  { label: 'After 48 hours', value: 48, unit: 'HOURS' },
  { label: 'After 3 days', value: 3, unit: 'DAYS' },
  { label: 'After 7 days', value: 7, unit: 'DAYS' }
];

const EVENT_DISPLAY_LABELS: Record<MarketingTriggerKey, string> = {
  USER_REGISTERED: 'User Registered',
  QUOTE_SAVED: 'Quote Saved',
  QUOTE_DOWNLOADED: 'Quote Downloaded',
  FIRST_BOOKING_COMPLETED: 'First Booking',
  BOOKING_CONFIRMATION_SLA: 'Booking SLA'
};

export const EmailCampaignsManager: React.FC<EmailCampaignsManagerProps> = ({
  initialView = 'TRIGGERS'
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [activeTab, setActiveTab] = useState<'TRIGGERS' | 'QUEUE' | 'LOGS'>(initialView);
  const [triggers, setTriggers] = useState<EmailCampaignConfig[]>(() =>
    marketingAutomationScheduler.ensureCanonicalTriggers()
  );
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledAutomationJob[]>(() =>
    marketingAutomationScheduler.getScheduledJobs()
  );
  const [executionLogs, setExecutionLogs] = useState<MarketingAutomationExecutionLog[]>(() =>
    marketingAutomationScheduler.getExecutionLogs()
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'DRAFT'>('ALL');
  const [logTriggerFilter, setLogTriggerFilter] = useState<string>('ALL');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Workspace / Modal states
  const [workspaceTrigger, setWorkspaceTrigger] = useState<EmailCampaignConfig | null>(null);
  const [previewModalTrigger, setPreviewModalTrigger] = useState<EmailCampaignConfig | null>(null);
  const [testModalTrigger, setTestModalTrigger] = useState<EmailCampaignConfig | null>(null);
  const [testRecipientEmail, setTestRecipientEmail] = useState<string>(
    user?.email || 'business@theunbound.in'
  );
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);
  const [activeInsertTarget, setActiveInsertTarget] = useState<'SUBJECT' | 'BODY'>('BODY');
  const [internalRecipientInput, setInternalRecipientInput] = useState<string>('');

  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveTab(initialView);
  }, [initialView]);

  const refreshData = () => {
    setTriggers(marketingAutomationScheduler.ensureCanonicalTriggers());
    setScheduledJobs(marketingAutomationScheduler.getScheduledJobs());
    setExecutionLogs(marketingAutomationScheduler.getExecutionLogs());
  };

  useEffect(() => {
    return db.subscribe(() => {
      refreshData();
    });
  }, []);

  const showNotice = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner(prev => (prev?.message === message ? null : prev));
    }, 5500);
  };

  // Toggle Active / Inactive without deleting templates, logs, or analytics
  const handleToggleTriggerStatus = (trigger: EmailCampaignConfig) => {
    const currentStatus: TriggerStatus =
      trigger.status || (trigger.isEnabled ? 'ACTIVE' : 'INACTIVE');
    const nextStatus: TriggerStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated: EmailCampaignConfig = {
      ...trigger,
      status: nextStatus,
      isEnabled: nextStatus === 'ACTIVE',
      updatedAt: new Date().toISOString()
    };

    db.saveEmailCampaign(updated, user);
    refreshData();
    showNotice(
      `Trigger "${trigger.name}" set to ${nextStatus}. Existing templates, scheduled jobs, and audit logs remain preserved.`
    );
  };

  // Duplicate Template (non-destructive variant creation)
  const handleDuplicateTemplate = (trigger: EmailCampaignConfig) => {
    const duplicate: EmailCampaignConfig = {
      ...trigger,
      id: `trigger-copy-${Date.now()}`,
      name: `${trigger.name} (Copy)`,
      isSystemTrigger: false,
      status: 'DRAFT',
      isEnabled: false,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      templateVersion: 'v1.0',
      updatedAt: new Date().toISOString(),
      lastDispatchedAt: undefined
    };
    db.saveEmailCampaign(duplicate, user);
    refreshData();
    showNotice(`Created draft duplicate "${duplicate.name}".`);
  };

  // Open Full-Page Configuration Workspace
  const handleOpenWorkspace = (trigger: EmailCampaignConfig) => {
    setWorkspaceTrigger(JSON.parse(JSON.stringify(trigger)));
    setTestRecipientEmail(user?.email || 'business@theunbound.in');
  };

  // Explicit Save / Save & Activate from Workspace
  const handleSaveWorkspace = (activateImmediately: boolean) => {
    if (!workspaceTrigger) return;

    const currentVersionStr = workspaceTrigger.templateVersion || 'v1.0';
    const versionNum = parseFloat(currentVersionStr.replace(/^v/i, '')) || 1.0;
    const nextVersion = `v${(versionNum + 0.1).toFixed(1)}`;

    const nextStatus: TriggerStatus = activateImmediately
      ? 'ACTIVE'
      : workspaceTrigger.status || (workspaceTrigger.isEnabled ? 'ACTIVE' : 'INACTIVE');

    const delayVal = Number(workspaceTrigger.delayValue ?? workspaceTrigger.delayHours ?? 0);
    const delayUnit: TriggerDelayUnit = workspaceTrigger.delayUnit || 'HOURS';
    const computedDelayHours =
      workspaceTrigger.timingMode === 'IMMEDIATE'
        ? 0
        : delayUnit === 'MINUTES'
        ? Math.max(0, Math.round((delayVal / 60) * 100) / 100)
        : delayUnit === 'DAYS'
        ? delayVal * 24
        : delayVal;

    const historyEntry = {
      version: nextVersion,
      subject: workspaceTrigger.subject,
      preheaderText: workspaceTrigger.preheaderText,
      templateHtml: workspaceTrigger.templateHtml,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.email || 'business@theunbound.in'
    };

    const completeRecord: EmailCampaignConfig = {
      ...workspaceTrigger,
      status: nextStatus,
      isEnabled: nextStatus === 'ACTIVE',
      delayHours: computedDelayHours,
      delayValue: workspaceTrigger.timingMode === 'IMMEDIATE' ? 0 : delayVal,
      templateVersion: nextVersion,
      versionHistory: [historyEntry, ...(workspaceTrigger.versionHistory || [])].slice(0, 15),
      updatedAt: new Date().toISOString()
    };

    db.saveEmailCampaign(completeRecord, user);
    refreshData();
    setWorkspaceTrigger(null);
    showNotice(
      activateImmediately
        ? `Saved & activated "${completeRecord.name}" (${nextVersion}).`
        : `Saved configuration changes for "${completeRecord.name}" (${nextVersion}).`
    );
  };

  const handleDispatchTestEmail = async (
    targetTrigger: EmailCampaignConfig,
    recipient: string
  ) => {
    if (!recipient || !recipient.includes('@')) {
      showNotice('Please enter a valid recipient email address for the test.', 'error');
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await marketingAutomationScheduler.sendTestTriggerEmail(
        targetTrigger,
        recipient.trim(),
        user
      );
      refreshData();
      showNotice(
        `Test email for "${targetTrigger.name}" dispatched to ${recipient.trim()} (Ref: ${res.messageId}).`
      );
      setTestModalTrigger(null);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleInsertVariable = (variable: VariableDefinition) => {
    if (!workspaceTrigger) return;
    if (activeInsertTarget === 'SUBJECT') {
      const nextSubj = `${workspaceTrigger.subject || ''} ${variable.token}`.trim();
      setWorkspaceTrigger({ ...workspaceTrigger, subject: nextSubj });
      subjectInputRef.current?.focus();
    } else {
      const textarea = bodyTextareaRef.current;
      const currentBody = workspaceTrigger.templateHtml || '';
      if (textarea && typeof textarea.selectionStart === 'number') {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextBody =
          currentBody.slice(0, start) + variable.token + currentBody.slice(end);
        setWorkspaceTrigger({ ...workspaceTrigger, templateHtml: nextBody });
      } else {
        setWorkspaceTrigger({
          ...workspaceTrigger,
          templateHtml: `${currentBody}\n${variable.token}`
        });
      }
    }
  };

  const handleInsertHtmlSnippet = (snippetType: 'H2' | 'BOLD' | 'ITALIC' | 'LINK' | 'LIST' | 'BUTTON' | 'DIVIDER') => {
    if (!workspaceTrigger) return;
    const snippets: Record<typeof snippetType, string> = {
      H2: `<h2 style="font-size: 18px; font-weight: 700; color: #1F2933; margin: 16px 0 8px 0;">Section Heading</h2>`,
      BOLD: `<strong>Important Text</strong>`,
      ITALIC: `<em>Highlighted note</em>`,
      LINK: `<a href="https://theunbound.in" style="color: #008972; text-decoration: underline;">View Details</a>`,
      LIST: `<ul style="margin: 12px 0; padding-left: 20px; color: #5F6B73; font-size: 13px; line-height: 1.7;">\n  <li>First itinerary highlight</li>\n  <li>Second ground service note</li>\n</ul>`,
      BUTTON: `<div style="margin: 24px 0;">\n  <a href="https://theunbound.in" style="background-color: #00C6A6; color: #0F172A; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">Primary Call to Action</a>\n</div>`,
      DIVIDER: `<hr style="border: 0; border-top: 1px solid #DDE8E6; margin: 20px 0;" />`
    };
    const nextHtml = `${workspaceTrigger.templateHtml || ''}\n${snippets[snippetType]}`;
    setWorkspaceTrigger({ ...workspaceTrigger, templateHtml: nextHtml });
  };

  const samplePreviewVars: Record<string, string> = {};
  for (const v of marketingAutomationScheduler.getVariablesForTrigger(
    workspaceTrigger?.triggerKey || previewModalTrigger?.triggerKey || 'QUOTE_SAVED'
  )) {
    samplePreviewVars[v.token.replace(/^\{\{|\}\}$/g, '').trim()] = v.sampleValue;
  }

  // ============================================================================
  // FULL-PAGE TRIGGER CONFIGURATION WORKSPACE VIEW
  // ============================================================================
  if (workspaceTrigger) {
    const triggerKey: MarketingTriggerKey =
      workspaceTrigger.triggerKey || 'QUOTE_SAVED';
    const contextVariables = marketingAutomationScheduler.getVariablesForTrigger(triggerKey);
    const variableCategories = Array.from(new Set(contextVariables.map(v => v.category)));
    const triggerLogs = executionLogs.filter(
      l => l.triggerId === workspaceTrigger.id || l.triggerKey === triggerKey
    );
    const resolvedPreviewSubject = marketingAutomationScheduler.renderTemplateWithVariables(
      workspaceTrigger.subject,
      samplePreviewVars
    );
    const resolvedPreviewBody = marketingAutomationScheduler.renderTemplateWithVariables(
      workspaceTrigger.templateHtml,
      samplePreviewVars
    );
    const currentStatus: TriggerStatus =
      workspaceTrigger.status || (workspaceTrigger.isEnabled ? 'ACTIVE' : 'INACTIVE');

    return (
      <div className="min-h-screen bg-[#F8FAFA] text-[#1F2933] pb-28 space-y-6">
        {/* Top Workspace Header */}
        <div className="bg-white border border-[#DDE8E6] rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setWorkspaceTrigger(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5F6B73] hover:text-[#1F2933] cursor-pointer mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Marketing Triggers Hub</span>
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-[#1F2933] tracking-tight">
                  {workspaceTrigger.name}
                </h2>
                <span className="text-xs font-mono text-[#5F6B73]">
                  {triggerKey} · {workspaceTrigger.templateVersion || 'v1.0'}
                </span>
              </div>
              <p className="text-sm text-[#5F6B73] max-w-3xl">
                {workspaceTrigger.description}
              </p>
            </div>

            {/* Simple Active / Inactive Toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center bg-[#F8FAFA] border border-[#DDE8E6] rounded-xl p-1">
                {(['ACTIVE', 'INACTIVE', 'DRAFT'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      setWorkspaceTrigger({
                        ...workspaceTrigger,
                        status: st,
                        isEnabled: st === 'ACTIVE'
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      currentStatus === st
                        ? st === 'ACTIVE'
                          ? 'bg-[#00C6A6] text-slate-950'
                          : 'bg-slate-800 text-white'
                        : 'text-[#5F6B73] hover:text-[#1F2933]'
                    }`}
                  >
                    {st === 'ACTIVE' ? '● Active' : st === 'INACTIVE' ? '○ Inactive' : 'Draft'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {feedbackBanner && (
          <div className="bg-white border border-[#00C6A6] text-[#1F2933] px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>{feedbackBanner.message}</span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-[#5F6B73] hover:text-[#1F2933] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left 7 Columns: Configuration, Recipients, Timing, Template Editor */}
          <div className="xl:col-span-7 space-y-6">
            {/* Section 1: General Trigger Settings */}
            <div className="bg-white border border-[#DDE8E6] rounded-2xl p-6 space-y-4">
              <div className="border-b border-[#DDE8E6] pb-3">
                <h3 className="text-base font-bold text-[#1F2933]">
                  01. Trigger Configuration
                </h3>
                <p className="text-xs text-[#5F6B73]">
                  System event binding, internal description, and execution priority.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#1F2933] mb-1">
                    Trigger Name {workspaceTrigger.isSystemTrigger && '(System Read-Only)'}
                  </label>
                  <input
                    type="text"
                    readOnly={Boolean(workspaceTrigger.isSystemTrigger)}
                    value={workspaceTrigger.name}
                    onChange={e =>
                      setWorkspaceTrigger({ ...workspaceTrigger, name: e.target.value })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] font-semibold ${
                      workspaceTrigger.isSystemTrigger
                        ? 'bg-[#F8FAFA] text-[#5F6B73] cursor-not-allowed'
                        : 'bg-white text-[#1F2933]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1F2933] mb-1">
                    Trigger Key (Read-Only)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={triggerKey}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] bg-[#F8FAFA] text-[#5F6B73] font-mono font-semibold cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#1F2933] mb-1">
                    Internal Admin Description
                  </label>
                  <input
                    type="text"
                    value={workspaceTrigger.description || ''}
                    onChange={e =>
                      setWorkspaceTrigger({ ...workspaceTrigger, description: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1F2933] mb-1">
                    Automation Priority
                  </label>
                  <select
                    value={workspaceTrigger.priority || 1}
                    onChange={e =>
                      setWorkspaceTrigger({
                        ...workspaceTrigger,
                        priority: Number(e.target.value)
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933] font-semibold"
                  >
                    <option value={1}>Priority 1 — High</option>
                    <option value={2}>Priority 2 — Standard</option>
                    <option value={3}>Priority 3 — Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Recipient Configuration */}
            <div className="bg-white border border-[#DDE8E6] rounded-2xl p-6 space-y-4">
              <div className="border-b border-[#DDE8E6] pb-3">
                <h3 className="text-base font-bold text-[#1F2933]">
                  02. Recipient Configuration
                </h3>
                <p className="text-xs text-[#5F6B73]">
                  Primary recipient is resolved dynamically from the triggering entity. Internal copy addresses remain confidential to Admin.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#1F2933] mb-1">
                    Primary Recipient Resolution Rule
                  </label>
                  <select
                    value={workspaceTrigger.primaryRecipientRule || 'User Email'}
                    onChange={e =>
                      setWorkspaceTrigger({
                        ...workspaceTrigger,
                        primaryRecipientRule: e.target.value
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933] font-semibold"
                  >
                    <option value="User Email">User Email (Registration Account)</option>
                    <option value="Quote Owner Email">Quote Owner Email (Client / Agent)</option>
                    <option value="Booking/User Email">Booking / User Email</option>
                    <option value="Booking Contact Email">Booking Contact Email</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1F2933] mb-1">
                    Sender Display Name &amp; From Address
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={workspaceTrigger.senderName || ''}
                      onChange={e =>
                        setWorkspaceTrigger({ ...workspaceTrigger, senderName: e.target.value })
                      }
                      placeholder="Sender Name"
                      className="px-3 py-2.5 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933]"
                    />
                    <input
                      type="email"
                      value={workspaceTrigger.senderEmail || ''}
                      onChange={e =>
                        setWorkspaceTrigger({ ...workspaceTrigger, senderEmail: e.target.value })
                      }
                      placeholder="operations@theunbound.in"
                      className="px-3 py-2.5 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933] font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-2">
                <label className="block font-semibold text-[#1F2933]">
                  Internal Operations Copy Recipients (Admin-Only Audit Copy)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {(workspaceTrigger.internalCopyRecipients || []).map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F8FAFA] border border-[#DDE8E6] font-mono text-xs text-[#1F2933]"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setWorkspaceTrigger({
                            ...workspaceTrigger,
                            internalCopyRecipients: (
                              workspaceTrigger.internalCopyRecipients || []
                            ).filter(item => item !== email)
                          })
                        }
                        className="text-[#5F6B73] hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={internalRecipientInput}
                      onChange={e => setInternalRecipientInput(e.target.value)}
                      placeholder="Add internal email..."
                      className="px-3 py-1.5 rounded-lg border border-[#DDE8E6] bg-white text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = internalRecipientInput.trim().toLowerCase();
                        if (!clean || !clean.includes('@')) return;
                        const existing = workspaceTrigger.internalCopyRecipients || [];
                        if (!existing.includes(clean)) {
                          setWorkspaceTrigger({
                            ...workspaceTrigger,
                            internalCopyRecipients: [...existing, clean]
                          });
                        }
                        setInternalRecipientInput('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#F8FAFA] hover:bg-[#DDE8E6]/60 border border-[#DDE8E6] text-[#1F2933] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Add Recipient
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Timing Configuration (MarketingAutomationScheduler) */}
            <div className="bg-white border border-[#DDE8E6] rounded-2xl p-6 space-y-4">
              <div className="border-b border-[#DDE8E6] pb-3">
                <h3 className="text-base font-bold text-[#1F2933]">
                  03. Timing &amp; SLA Configuration (MarketingAutomationScheduler)
                </h3>
                <p className="text-xs text-[#5F6B73]">
                  Centralized scheduling engine evaluates live entity eligibility at execution time before dispatching.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(
                  [
                    { id: 'IMMEDIATE', label: 'Immediate (0 min)' },
                    { id: 'DELAYED', label: 'Preset Delay' },
                    { id: 'CUSTOM', label: 'Custom Delay' },
                    { id: 'SLA', label: 'Configured SLA' }
                  ] as Array<{ id: TriggerTimingMode; label: string }>
                ).map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setWorkspaceTrigger({
                        ...workspaceTrigger,
                        timingMode: mode.id,
                        delayValue: mode.id === 'IMMEDIATE' ? 0 : workspaceTrigger.delayValue || 24,
                        delayUnit: mode.id === 'IMMEDIATE' ? 'MINUTES' : workspaceTrigger.delayUnit || 'HOURS'
                      })
                    }
                    className={`py-2.5 px-3 rounded-xl font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                      workspaceTrigger.timingMode === mode.id
                        ? 'bg-[#00C6A6]/15 border-[#00C6A6] text-[#1F2933]'
                        : 'bg-[#F8FAFA] border-[#DDE8E6] text-[#5F6B73] hover:text-[#1F2933]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {workspaceTrigger.timingMode === 'DELAYED' && (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-[#1F2933]">
                    Select Standard Delay Window
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DELAY_PRESETS.map(preset => {
                      const isSelected =
                        workspaceTrigger.delayValue === preset.value &&
                        workspaceTrigger.delayUnit === preset.unit;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            setWorkspaceTrigger({
                              ...workspaceTrigger,
                              delayValue: preset.value,
                              delayUnit: preset.unit
                            })
                          }
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#00C6A6] text-slate-950 border-[#00C6A6]'
                              : 'bg-white text-[#1F2933] border-[#DDE8E6] hover:bg-[#F8FAFA]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {workspaceTrigger.timingMode === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
                  <div>
                    <label className="block font-semibold text-[#1F2933] mb-1">
                      Custom Delay Value
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={workspaceTrigger.delayValue ?? 24}
                      onChange={e =>
                        setWorkspaceTrigger({
                          ...workspaceTrigger,
                          delayValue: Math.max(1, Number(e.target.value))
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] font-mono font-bold text-[#1F2933]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#1F2933] mb-1">
                      Delay Unit
                    </label>
                    <select
                      value={workspaceTrigger.delayUnit || 'HOURS'}
                      onChange={e =>
                        setWorkspaceTrigger({
                          ...workspaceTrigger,
                          delayUnit: e.target.value as TriggerDelayUnit
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] bg-white font-semibold text-[#1F2933]"
                    >
                      <option value="MINUTES">Minutes</option>
                      <option value="HOURS">Hours</option>
                      <option value="DAYS">Days</option>
                    </select>
                  </div>
                </div>
              )}

              {(workspaceTrigger.timingMode === 'SLA' ||
                triggerKey === 'BOOKING_CONFIRMATION_SLA') && (
                <div className="bg-[#F8FAFA] border border-[#DDE8E6] rounded-xl p-4 space-y-3 text-xs">
                  <div className="font-bold text-[#1F2933]">
                    Booking Confirmation SLA Rules
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#5F6B73] mb-1">
                        SLA Duration
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={
                          workspaceTrigger.slaConfig?.slaDuration ??
                          workspaceTrigger.delayValue ??
                          24
                        }
                        onChange={e => {
                          const val = Math.max(1, Number(e.target.value));
                          setWorkspaceTrigger({
                            ...workspaceTrigger,
                            delayValue: val,
                            slaConfig: {
                              slaDuration: val,
                              slaUnit: workspaceTrigger.slaConfig?.slaUnit || 'HOURS',
                              eligibleStatuses: workspaceTrigger.slaConfig?.eligibleStatuses || [
                                'PENDING_CONFIRMATION',
                                'ON_HOLD'
                              ],
                              excludedStatuses: workspaceTrigger.slaConfig?.excludedStatuses || [
                                'CONFIRMED',
                                'CANCELLED',
                                'COMPLETED',
                                'CLOSED'
                              ]
                            }
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-[#DDE8E6] bg-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#5F6B73] mb-1">
                        SLA Unit
                      </label>
                      <select
                        value={workspaceTrigger.slaConfig?.slaUnit || 'HOURS'}
                        onChange={e => {
                          const unit = e.target.value as TriggerDelayUnit;
                          setWorkspaceTrigger({
                            ...workspaceTrigger,
                            delayUnit: unit,
                            slaConfig: {
                              slaDuration: workspaceTrigger.slaConfig?.slaDuration || 24,
                              slaUnit: unit,
                              eligibleStatuses: workspaceTrigger.slaConfig?.eligibleStatuses || [
                                'PENDING_CONFIRMATION',
                                'ON_HOLD'
                              ],
                              excludedStatuses: workspaceTrigger.slaConfig?.excludedStatuses || [
                                'CONFIRMED',
                                'CANCELLED',
                                'COMPLETED',
                                'CLOSED'
                              ]
                            }
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-[#DDE8E6] bg-white font-semibold"
                      >
                        <option value="MINUTES">Minutes</option>
                        <option value="HOURS">Hours</option>
                        <option value="DAYS">Days</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#5F6B73] leading-relaxed">
                    <strong>Eligible Booking Statuses:</strong>{' '}
                    <span className="font-mono text-[#1F2933]">
                      {(
                        workspaceTrigger.slaConfig?.eligibleStatuses || [
                          'PENDING_CONFIRMATION',
                          'ON_HOLD'
                        ]
                      ).join(', ')}
                    </span>{' '}
                    · <strong>Auto-Cancel When Status Reaches:</strong>{' '}
                    <span className="font-mono text-[#1F2933]">
                      {(
                        workspaceTrigger.slaConfig?.excludedStatuses || [
                          'CONFIRMED',
                          'CANCELLED',
                          'COMPLETED',
                          'CLOSED'
                        ]
                      ).join(', ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Email Template & Context-Aware Dynamic Variables */}
            <div className="bg-white border border-[#DDE8E6] rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDE8E6] pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#1F2933]">
                    04. Email Template &amp; Dynamic Variables
                  </h3>
                  <p className="text-xs text-[#5F6B73]">
                    Configure subject, preheader, and rich HTML body. Click any variable token below to insert at cursor.
                  </p>
                </div>
                {workspaceTrigger.versionHistory &&
                  workspaceTrigger.versionHistory.length > 0 && (
                    <div className="text-xs font-mono text-[#5F6B73]">
                      Active Version: <strong className="text-[#1F2933]">{workspaceTrigger.templateVersion || 'v1.0'}</strong>
                    </div>
                  )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#1F2933] mb-1">
                    Email Subject Line *
                  </label>
                  <input
                    ref={subjectInputRef}
                    type="text"
                    onFocus={() => setActiveInsertTarget('SUBJECT')}
                    value={workspaceTrigger.subject || ''}
                    onChange={e =>
                      setWorkspaceTrigger({ ...workspaceTrigger, subject: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933] font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1F2933] mb-1">
                    Preview Text (Optional Preheader)
                  </label>
                  <input
                    type="text"
                    value={workspaceTrigger.preheaderText || ''}
                    onChange={e =>
                      setWorkspaceTrigger({
                        ...workspaceTrigger,
                        preheaderText: e.target.value
                      })
                    }
                    placeholder="Short summary displayed in inbox preview next to subject line..."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933]"
                  />
                </div>

                {/* Context-Aware Dynamic Variables Picker */}
                <div className="bg-[#F8FAFA] border border-[#DDE8E6] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1F2933]">
                      Context-Aware Variable Picker ({triggerKey})
                    </span>
                    <span className="text-[11px] text-[#5F6B73]">
                      Inserting into:{' '}
                      <strong className="text-[#008972]">{activeInsertTarget}</strong>
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {variableCategories.map(cat => (
                      <div key={cat} className="space-y-1">
                        <div className="text-[11px] font-semibold text-[#5F6B73]">
                          {cat} Variables
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {contextVariables
                            .filter(v => v.category === cat)
                            .map(variable => (
                              <button
                                key={variable.token}
                                type="button"
                                onClick={() => handleInsertVariable(variable)}
                                title={`${variable.label} (e.g. ${variable.sampleValue})`}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#00C6A6]/15 border border-[#DDE8E6] hover:border-[#00C6A6] font-mono text-[11px] text-[#1F2933] transition-colors cursor-pointer"
                              >
                                {variable.token}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rich Formatting Toolbar */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="font-semibold text-[#1F2933]">
                      Email Body Template (Rich HTML) *
                    </label>
                    <div className="flex flex-wrap items-center gap-1 bg-[#F8FAFA] border border-[#DDE8E6] rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleInsertHtmlSnippet('H2')}
                        className="p-1.5 rounded-lg hover:bg-white text-[#1F2933] cursor-pointer"
                        title="Insert Heading"
                      >
                        <Heading2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtmlSnippet('BOLD')}
                        className="p-1.5 rounded-lg hover:bg-white text-[#1F2933] cursor-pointer"
                        title="Insert Bold"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtmlSnippet('ITALIC')}
                        className="p-1.5 rounded-lg hover:bg-white text-[#1F2933] cursor-pointer"
                        title="Insert Italic"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtmlSnippet('LINK')}
                        className="p-1.5 rounded-lg hover:bg-white text-[#1F2933] cursor-pointer"
                        title="Insert Link"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtmlSnippet('LIST')}
                        className="p-1.5 rounded-lg hover:bg-white text-[#1F2933] cursor-pointer"
                        title="Insert Bullet List"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtmlSnippet('BUTTON')}
                        className="p-1.5 rounded-lg hover:bg-white text-[#1F2933] cursor-pointer"
                        title="Insert Primary CTA Button"
                      >
                        <MousePointerClick className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertHtmlSnippet('DIVIDER')}
                        className="p-1.5 rounded-lg hover:bg-white text-[#1F2933] cursor-pointer"
                        title="Insert Horizontal Divider"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    ref={bodyTextareaRef}
                    rows={14}
                    onFocus={() => setActiveInsertTarget('BODY')}
                    value={workspaceTrigger.templateHtml || ''}
                    onChange={e =>
                      setWorkspaceTrigger({
                        ...workspaceTrigger,
                        templateHtml: e.target.value
                      })
                    }
                    className="w-full p-3.5 rounded-xl border border-[#DDE8E6] bg-white font-mono text-xs text-[#1F2933] leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Section 7: Trigger Execution History */}
            <div className="bg-white border border-[#DDE8E6] rounded-2xl p-6 space-y-4">
              <div className="border-b border-[#DDE8E6] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#1F2933]">
                    07. Execution History ({triggerLogs.length})
                  </h3>
                  <p className="text-xs text-[#5F6B73]">
                    Recent deliveries, duplicate-send suppressions, and SLA cancellations for this trigger.
                  </p>
                </div>
              </div>

              {triggerLogs.length === 0 ? (
                <p className="text-xs text-[#5F6B73] py-4">
                  No execution logs recorded yet for this trigger.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDE8E6] text-[#5F6B73] font-semibold">
                        <th className="py-2.5 pr-3">Timestamp</th>
                        <th className="py-2.5 px-3">Recipient</th>
                        <th className="py-2.5 px-3">Entity</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 pl-3">Audit Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE8E6]/60">
                      {triggerLogs.slice(0, 8).map(log => (
                        <tr key={log.id}>
                          <td className="py-2.5 pr-3 font-mono text-[11px] text-[#5F6B73] whitespace-nowrap">
                            {new Date(log.executedAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#1F2933]">
                            {log.recipientEmail}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#5F6B73]">
                            {log.entityId || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            <span
                              className={
                                log.status === 'SENT' || log.status === 'TEST_SENT'
                                  ? 'text-emerald-700'
                                  : log.status === 'FAILED'
                                  ? 'text-rose-600'
                                  : 'text-amber-700'
                              }
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 pl-3 text-[#5F6B73]">
                            {log.reason || `Delivered (${log.templateVersion})`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right 5 Columns: Live Email Preview & Test Email Dispatch */}
          <div className="xl:col-span-5 space-y-6">
            {/* Section 5: Live Email Preview */}
            <div className="bg-white border border-[#DDE8E6] rounded-2xl p-6 space-y-4">
              <div className="border-b border-[#DDE8E6] pb-3">
                <h3 className="text-base font-bold text-[#1F2933]">
                  05. Live Email Preview
                </h3>
                <p className="text-xs text-[#5F6B73]">
                  Rendered with context-aware sample data. Unresolved tokens are automatically sanitized.
                </p>
              </div>

              <div className="bg-[#F8FAFA] border border-[#DDE8E6] rounded-xl p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#5F6B73]">From:</span>
                  <span className="font-semibold text-[#1F2933]">
                    {workspaceTrigger.senderName} &lt;{workspaceTrigger.senderEmail}&gt;
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F6B73]">To Rule:</span>
                  <span className="font-mono text-[#1F2933]">
                    {workspaceTrigger.primaryRecipientRule || 'User Email'}
                  </span>
                </div>
                <div className="pt-1 border-t border-[#DDE8E6]">
                  <span className="text-[#5F6B73] block">Resolved Subject:</span>
                  <span className="font-bold text-[#1F2933]">{resolvedPreviewSubject}</span>
                </div>
                {workspaceTrigger.preheaderText && (
                  <div>
                    <span className="text-[#5F6B73] block">Preheader:</span>
                    <span className="text-[#5F6B73] italic">
                      {marketingAutomationScheduler.renderTemplateWithVariables(
                        workspaceTrigger.preheaderText,
                        samplePreviewVars
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div
                className="border border-[#DDE8E6] rounded-xl p-4 bg-[#F8FAFA] overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: resolvedPreviewBody }}
              />
            </div>

            {/* Section 6: Test Email Dispatch */}
            <div className="bg-white border border-[#DDE8E6] rounded-2xl p-6 space-y-4">
              <div className="border-b border-[#DDE8E6] pb-3">
                <h3 className="text-base font-bold text-[#1F2933]">
                  06. Send Test Email
                </h3>
                <p className="text-xs text-[#5F6B73]">
                  Dispatches a live test email through the centralized EmailNotificationService and logs a TEST_SENT audit record.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={testRecipientEmail}
                  onChange={e => setTestRecipientEmail(e.target.value)}
                  placeholder="Enter test recipient email..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] bg-white text-xs font-mono text-[#1F2933]"
                />
                <button
                  type="button"
                  disabled={isSendingTest}
                  onClick={() => handleDispatchTestEmail(workspaceTrigger, testRecipientEmail)}
                  className="px-4 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap transition-colors"
                >
                  {isSendingTest ? 'Sending Test...' : 'Send Test Email'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Save Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-t border-[#DDE8E6] px-6 py-3.5 flex items-center justify-between">
          <div className="text-xs text-[#5F6B73]">
            Changes are not auto-saved. Review your template and timing settings before saving.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setWorkspaceTrigger(null)}
              className="px-4 py-2 rounded-xl border border-[#DDE8E6] bg-white hover:bg-[#F8FAFA] text-[#1F2933] text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveWorkspace(false)}
              className="px-4 py-2 rounded-xl border border-[#1F2933] bg-[#1F2933] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => handleSaveWorkspace(true)}
              className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Save &amp; Activate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN MARKETING TRIGGERS & AUTOMATED EMAIL HUB VIEW
  // ============================================================================
  const filteredTriggers = triggers.filter(t => {
    const st: TriggerStatus = t.status || (t.isEnabled ? 'ACTIVE' : 'INACTIVE');
    if (statusFilter !== 'ALL' && st !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.triggerKey || '').toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredLogs = executionLogs.filter(l => {
    if (
      logTriggerFilter !== 'ALL' &&
      l.triggerKey !== logTriggerFilter &&
      l.triggerId !== logTriggerFilter
    ) {
      return false;
    }
    if (logStatusFilter !== 'ALL' && l.status !== logStatusFilter) {
      return false;
    }
    return true;
  });

  const activeCount = triggers.filter(
    t => (t.status || (t.isEnabled ? 'ACTIVE' : 'INACTIVE')) === 'ACTIVE'
  ).length;
  const totalSentCount = triggers.reduce((sum, t) => sum + (t.sentCount || 0), 0);
  const totalSuppressedCount = triggers.reduce((sum, t) => sum + (t.skippedCount || 0), 0);
  const pendingJobsCount = scheduledJobs.filter(j => j.status === 'SCHEDULED').length;

  return (
    <div className="space-y-6 bg-[#F8FAFA] text-[#1F2933] p-1">
      {/* Top Hub Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#DDE8E6] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1F2933] tracking-tight">
              Marketing Triggers &amp; Automated Email Hub
            </h2>
            <p className="text-xs sm:text-sm text-[#5F6B73]">
              Centralized Email Automation Engine &amp; <span className="font-mono">MarketingAutomationScheduler</span> connected to TheUnbound Gmail relay.
            </p>
          </div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div className="px-4 py-2.5 rounded-xl bg-[#F8FAFA] border border-[#DDE8E6]">
              <span className="text-[11px] text-[#5F6B73] block">Active Triggers</span>
              <span className="text-sm font-bold font-mono tabular-nums text-[#1F2933]">
                {activeCount} / {triggers.length}
              </span>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-[#F8FAFA] border border-[#DDE8E6]">
              <span className="text-[11px] text-[#5F6B73] block">Total Dispatched</span>
              <span className="text-sm font-bold font-mono tabular-nums text-[#008972]">
                {totalSentCount}
              </span>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-[#F8FAFA] border border-[#DDE8E6]">
              <span className="text-[11px] text-[#5F6B73] block">Conversion Suppressed</span>
              <span className="text-sm font-bold font-mono tabular-nums text-[#1F2933]">
                {totalSuppressedCount}
              </span>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-[#F8FAFA] border border-[#DDE8E6]">
              <span className="text-[11px] text-[#5F6B73] block">Scheduled Queue</span>
              <span className="text-sm font-bold font-mono tabular-nums text-[#1F2933]">
                {pendingJobsCount} Pending
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Filter Controls */}
        <div className="pt-4 border-t border-[#DDE8E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-[#F8FAFA] p-1 rounded-xl border border-[#DDE8E6]">
            <button
              type="button"
              onClick={() => setActiveTab('TRIGGERS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'TRIGGERS'
                  ? 'bg-white text-[#1F2933] shadow-2xs border border-[#DDE8E6]'
                  : 'text-[#5F6B73] hover:text-[#1F2933]'
              }`}
            >
              Trigger Management ({triggers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('QUEUE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'QUEUE'
                  ? 'bg-white text-[#1F2933] shadow-2xs border border-[#DDE8E6]'
                  : 'text-[#5F6B73] hover:text-[#1F2933]'
              }`}
            >
              Scheduled Automation Queue ({scheduledJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('LOGS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'LOGS'
                  ? 'bg-white text-[#1F2933] shadow-2xs border border-[#DDE8E6]'
                  : 'text-[#5F6B73] hover:text-[#1F2933]'
              }`}
            >
              Email Logs / Campaign Reports ({executionLogs.length})
            </button>
          </div>

          {activeTab === 'TRIGGERS' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#5F6B73] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search triggers..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-[#DDE8E6] bg-white text-xs text-[#1F2933]"
                />
              </div>
              {(['ALL', 'ACTIVE', 'INACTIVE', 'DRAFT'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#1F2933] text-white border-[#1F2933]'
                      : 'bg-white text-[#5F6B73] border-[#DDE8E6] hover:text-[#1F2933]'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {feedbackBanner && (
        <div className="bg-white border border-[#00C6A6] text-[#1F2933] px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{feedbackBanner.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-[#5F6B73] hover:text-[#1F2933] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          TAB 1: TRIGGER LIST TABLE
         ===================================================================== */}
      {activeTab === 'TRIGGERS' && (
        <div className="bg-white rounded-2xl border border-[#DDE8E6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFA] border-b border-[#DDE8E6] text-[#5F6B73] font-semibold">
                  <th className="py-3.5 px-5">Trigger</th>
                  <th className="py-3.5 px-4">Event</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Timing</th>
                  <th className="py-3.5 px-4">Last Updated</th>
                  <th className="py-3.5 px-4">Last Execution</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE8E6]">
                {filteredTriggers.map(trigger => {
                  const key: MarketingTriggerKey =
                    trigger.triggerKey || 'BOOKING_CONFIRMATION_SLA';
                  const st: TriggerStatus =
                    trigger.status || (trigger.isEnabled ? 'ACTIVE' : 'INACTIVE');
                  const timingLabel = marketingAutomationScheduler.formatTimingBadge(trigger);

                  return (
                    <tr
                      key={trigger.id}
                      className="hover:bg-[#F8FAFA]/80 transition-colors"
                    >
                      <td className="py-4 px-5 max-w-sm">
                        <div className="font-bold text-[#1F2933] text-sm">
                          {trigger.name}
                        </div>
                        <div className="text-xs text-[#5F6B73] line-clamp-1 mt-0.5">
                          Subject: <span className="text-[#1F2933]">{trigger.subject}</span>
                        </div>
                        <div className="text-[11px] text-[#5F6B73] mt-0.5 font-mono tabular-nums">
                          Recipient: {trigger.primaryRecipientRule || 'User Email'} ·{' '}
                          {trigger.sentCount || 0} sent · {trigger.skippedCount || 0} suppressed
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[#1F2933]">
                          {EVENT_DISPLAY_LABELS[key] || key}
                        </div>
                        <div className="font-mono text-[11px] text-[#5F6B73]">{key}</div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleTriggerStatus(trigger)}
                          title="Click to toggle Active / Inactive"
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            st === 'ACTIVE'
                              ? 'bg-[#00C6A6]/15 text-[#008972] border-[#00C6A6]/40'
                              : st === 'DRAFT'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-[#F8FAFA] text-[#5F6B73] border-[#DDE8E6]'
                          }`}
                        >
                          {st === 'ACTIVE'
                            ? '● Active'
                            : st === 'DRAFT'
                            ? '◐ Draft'
                            : '○ Inactive'}
                        </button>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap font-mono text-xs text-[#1F2933]">
                        {timingLabel}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap font-mono tabular-nums text-xs text-[#5F6B73]">
                        {trigger.updatedAt
                          ? new Date(trigger.updatedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '01 Oct 2026'}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap font-mono tabular-nums text-xs text-[#5F6B73]">
                        {trigger.lastDispatchedAt
                          ? new Date(trigger.lastDispatchedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '—'}
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenWorkspace(trigger)}
                            className="px-3 py-1.5 rounded-lg bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTriggerStatus(trigger)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E6] bg-white hover:bg-[#F8FAFA] text-[#1F2933] font-semibold text-xs cursor-pointer"
                          >
                            {st === 'ACTIVE' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewModalTrigger(trigger)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E6] bg-white hover:bg-[#F8FAFA] text-[#1F2933] font-semibold text-xs cursor-pointer"
                            title="Preview Email"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTestModalTrigger(trigger);
                              setTestRecipientEmail(user?.email || 'business@theunbound.in');
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E6] bg-white hover:bg-[#F8FAFA] text-[#1F2933] font-semibold text-xs cursor-pointer"
                            title="Send Test Email"
                          >
                            Send Test
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateTemplate(trigger)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E6] bg-white hover:bg-[#F8FAFA] text-[#5F6B73] hover:text-[#1F2933] font-semibold text-xs cursor-pointer"
                            title="Duplicate Template"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLogTriggerFilter(key);
                              setActiveTab('LOGS');
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E6] bg-white hover:bg-[#F8FAFA] text-[#5F6B73] hover:text-[#1F2933] font-semibold text-xs cursor-pointer"
                            title="View Delivery & Audit Logs"
                          >
                            Logs
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: SCHEDULED AUTOMATION QUEUE (MarketingAutomationScheduler)
         ===================================================================== */}
      {activeTab === 'QUEUE' && (
        <div className="bg-white rounded-2xl border border-[#DDE8E6] overflow-hidden">
          <div className="p-5 border-b border-[#DDE8E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#1F2933]">
                Scheduled Automation Jobs Queue
              </h3>
              <p className="text-xs text-[#5F6B73]">
                Delayed quote reminders and booking SLA checks awaiting execution time. At execution, the scheduler verifies live conversion/confirmation status.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFA] border-b border-[#DDE8E6] text-[#5F6B73] font-semibold">
                  <th className="py-3 px-5">Job ID &amp; Trigger</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Scheduled For</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Guard / Evaluation Note</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE8E6]">
                {scheduledJobs.map(job => (
                  <tr key={job.id} className="hover:bg-[#F8FAFA]/80">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-[#1F2933]">{job.triggerName}</div>
                      <div className="font-mono text-[11px] text-[#5F6B73]">
                        {job.triggerKey} · {job.id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#1F2933]">
                      {job.entityType}: {job.entityId}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#1F2933]">
                      {job.recipientEmail}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-[#5F6B73] whitespace-nowrap">
                      {new Date(job.scheduledFor).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold">
                      <span
                        className={
                          job.status === 'SCHEDULED'
                            ? 'text-[#008972]'
                            : job.status === 'EXECUTED'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#5F6B73] max-w-xs">
                      {job.statusReason ||
                        (job.triggerKey === 'BOOKING_CONFIRMATION_SLA'
                          ? 'Will verify booking is still PENDING_CONFIRMATION at SLA deadline'
                          : 'Will verify quote has not converted to a booking before sending')}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {job.status === 'SCHEDULED' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const result =
                              await marketingAutomationScheduler.evaluateAndExecuteJob(
                                job.id,
                                true
                              );
                            refreshData();
                            showNotice(
                              `Evaluated job ${job.id}: ${result.status} (${result.reason || 'Completed'})`
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Evaluate &amp; Execute Now
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-[#5F6B73]">
                          Finalized
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: EMAIL LOGS / CAMPAIGN REPORTS
         ===================================================================== */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-2xl border border-[#DDE8E6] overflow-hidden">
          <div className="p-5 border-b border-[#DDE8E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#1F2933]">
                Centralized Email Automation Delivery &amp; Audit Logs
              </h3>
              <p className="text-xs text-[#5F6B73]">
                Complete audit trail of sent emails, duplicate-send prevention blocks, quote-to-booking suppressions, and SLA cancellations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={logTriggerFilter}
                onChange={e => setLogTriggerFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933] font-semibold"
              >
                <option value="ALL">All Triggers</option>
                <option value="USER_REGISTERED">New User Registration</option>
                <option value="QUOTE_SAVED">Saved Quote Reminder</option>
                <option value="QUOTE_DOWNLOADED">Downloaded Quote Reminder</option>
                <option value="FIRST_BOOKING_COMPLETED">First Booking Welcome</option>
                <option value="BOOKING_CONFIRMATION_SLA">Booking Confirmation SLA</option>
              </select>

              <select
                value={logStatusFilter}
                onChange={e => setLogStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#DDE8E6] bg-white text-[#1F2933] font-semibold"
              >
                <option value="ALL">All Statuses</option>
                <option value="SENT">SENT</option>
                <option value="TEST_SENT">TEST_SENT</option>
                <option value="SKIPPED">SKIPPED (Suppressed)</option>
                <option value="CANCELLED">CANCELLED (SLA Closed)</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFA] border-b border-[#DDE8E6] text-[#5F6B73] font-semibold">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-4">Trigger &amp; Event</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Entity Ref</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5">Delivery / Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE8E6]">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-[#F8FAFA]/80">
                    <td className="py-3.5 px-5 font-mono tabular-nums text-[11px] text-[#5F6B73] whitespace-nowrap">
                      {new Date(log.executedAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#1F2933]">{log.triggerName}</div>
                      <div className="font-mono text-[11px] text-[#5F6B73]">
                        {log.triggerKey}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#1F2933]">
                      <div>{log.recipientEmail}</div>
                      {log.internalCopySentTo && log.internalCopySentTo.length > 0 && (
                        <div className="text-[10px] text-[#5F6B73]">
                          CC: {log.internalCopySentTo.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#1F2933]">
                      {log.entityId || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#5F6B73]">
                      {log.templateVersion}
                    </td>
                    <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                      <span
                        className={
                          log.status === 'SENT' || log.status === 'TEST_SENT'
                            ? 'text-[#008972]'
                            : log.status === 'FAILED'
                            ? 'text-rose-600'
                            : 'text-amber-700'
                        }
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#5F6B73] max-w-md">
                      <div className="text-[#1F2933] font-medium line-clamp-1">
                        {log.subject}
                      </div>
                      <div className="text-[11px]">
                        {log.reason || `Idempotency Key: ${log.idempotencyKey}`}
                      </div>
                      {log.status === 'FAILED' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await marketingAutomationScheduler.retryFailedExecution(
                              log.id,
                              user
                            );
                            refreshData();
                            showNotice(`Retried execution for ${log.recipientEmail}.`);
                          }}
                          className="mt-1 px-2.5 py-1 rounded bg-[#00C6A6] text-slate-950 font-bold text-[11px] cursor-pointer"
                        >
                          Retry Dispatch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: PREVIEW TRIGGER EMAIL
         ===================================================================== */}
      {previewModalTrigger && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-[#DDE8E6] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE8E6]">
              <div>
                <h3 className="text-base font-bold text-[#1F2933]">
                  Email Preview — {previewModalTrigger.name}
                </h3>
                <p className="text-xs text-[#5F6B73]">
                  Event: <span className="font-mono">{previewModalTrigger.triggerKey}</span> · Timing: {marketingAutomationScheduler.formatTimingBadge(previewModalTrigger)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalTrigger(null)}
                className="p-1.5 rounded-lg text-[#5F6B73] hover:text-[#1F2933] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#F8FAFA] border border-[#DDE8E6] rounded-xl p-3.5 text-xs space-y-1">
              <div>
                <span className="text-[#5F6B73]">Subject: </span>
                <strong className="text-[#1F2933]">
                  {marketingAutomationScheduler.renderTemplateWithVariables(
                    previewModalTrigger.subject,
                    samplePreviewVars
                  )}
                </strong>
              </div>
              <div>
                <span className="text-[#5F6B73]">Primary Recipient Rule: </span>
                <span className="font-mono text-[#1F2933]">
                  {previewModalTrigger.primaryRecipientRule || 'User Email'}
                </span>
              </div>
            </div>

            <div
              className="border border-[#DDE8E6] rounded-xl p-4 bg-[#F8FAFA]"
              dangerouslySetInnerHTML={{
                __html: marketingAutomationScheduler.renderTemplateWithVariables(
                  previewModalTrigger.templateHtml,
                  samplePreviewVars
                )
              }}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[#DDE8E6]">
              <button
                type="button"
                onClick={() => {
                  const target = previewModalTrigger;
                  setPreviewModalTrigger(null);
                  handleOpenWorkspace(target);
                }}
                className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs cursor-pointer"
              >
                Open in Configuration Workspace
              </button>
              <button
                type="button"
                onClick={() => setPreviewModalTrigger(null)}
                className="px-4 py-2 rounded-xl border border-[#DDE8E6] text-[#1F2933] font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: SEND TEST EMAIL
         ===================================================================== */}
      {testModalTrigger && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DDE8E6] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE8E6]">
              <h3 className="text-base font-bold text-[#1F2933]">
                Send Test Email — {testModalTrigger.name}
              </h3>
              <button
                type="button"
                onClick={() => setTestModalTrigger(null)}
                className="p-1 text-[#5F6B73] hover:text-[#1F2933] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#5F6B73] leading-relaxed">
              This will resolve all dynamic variables using sample data and dispatch a live test email via the centralized <span className="font-mono">EmailNotificationService</span>.
            </p>

            <div className="text-xs">
              <label className="block font-semibold text-[#1F2933] mb-1">
                Test Recipient Email Address
              </label>
              <input
                type="email"
                value={testRecipientEmail}
                onChange={e => setTestRecipientEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDE8E6] font-mono text-[#1F2933]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#DDE8E6]">
              <button
                type="button"
                onClick={() => setTestModalTrigger(null)}
                className="px-4 py-2 rounded-xl border border-[#DDE8E6] text-[#5F6B73] font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingTest}
                onClick={() => handleDispatchTestEmail(testModalTrigger, testRecipientEmail)}
                className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs cursor-pointer"
              >
                {isSendingTest ? 'Sending...' : 'Dispatch Test Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
