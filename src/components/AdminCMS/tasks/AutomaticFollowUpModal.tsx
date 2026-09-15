import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Zap, CheckSquare, ArrowRight, ArrowLeft, Bell, Users, Clock, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { SLAAutomationRule, User } from '../../../types';

interface AutomaticFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: SLAAutomationRule) => void;
  ruleToEdit?: SLAAutomationRule | null;
  currentUser: User | null;
}

export const AutomaticFollowUpModal: React.FC<AutomaticFollowUpModalProps> = ({
  isOpen,
  onClose,
  onSave,
  ruleToEdit,
  currentUser
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [ruleName, setRuleName] = useState(ruleToEdit?.ruleName || '');
  const [triggerEvent, setTriggerEvent] = useState<string>(ruleToEdit?.triggerEvent || 'LEAD_CREATED');
  const [actionType, setActionType] = useState<'TASK' | 'EMAIL' | 'NOTIFICATION' | 'REMINDER'>('TASK');
  const [assigneeTarget, setAssigneeTarget] = useState<'LEAD_OWNER' | 'BOOKING_OWNER' | 'OPERATIONS' | 'FINANCE' | 'USER'>('LEAD_OWNER');
  const [assigneeName, setAssigneeName] = useState(ruleToEdit?.defaultAssignee.name || 'Sales Follow-up Desk');
  const [assigneeEmail, setAssigneeEmail] = useState(ruleToEdit?.defaultAssignee.email || 'sales@theunbound.in');
  const [completeWithinHours, setCompleteWithinHours] = useState<number>(ruleToEdit?.slaHours || 24);
  const [titleTemplate, setTitleTemplate] = useState(
    ruleToEdit?.titleTemplate || 'Follow up with {{clientName}} — {{bookingReference}}'
  );
  const [lateEscalation, setLateEscalation] = useState(true);

  const TRIGGER_OPTIONS = [
    { id: 'LEAD_CREATED', label: 'When a new lead is created', desc: 'Triggers fast initial response to qualify traveler requirements' },
    { id: 'QUOTE_PDF_DOWNLOADED', label: 'When a proposal is downloaded', desc: 'Triggers immediate sales outreach while interest is active' },
    { id: 'BOOKING_CONFIRMED', label: 'When a booking is confirmed', desc: 'Triggers hotel and ground transfer confirmation workflow' },
    { id: 'GROUND_TRANSFER_BOOKED', label: 'When an airport transfer is booked', desc: 'Assigns chauffeur and flight tracking to Ground Ops' },
    { id: 'GROUND_HOTEL_BOOKED', label: 'When hotel rooms are booked', desc: 'Ensures room vouchers and confirmations are secured' },
    { id: 'SUPPLIER_FOLLOWUP_REQUIRED', label: 'When supplier response is overdue', desc: 'Flags supplier delays to destination management team' },
    { id: 'PAYMENT_DUE', label: 'When a balance payment is due', desc: 'Alerts finance and traveler prior to travel cutoff date' },
    { id: 'CUSTOM', label: 'Custom operational condition', desc: 'Configurable internal process trigger' }
  ];

  const COMPLETE_OPTIONS = [
    { hours: 2, label: 'Within 2 hours', desc: 'Immediate inquiry outreach' },
    { hours: 4, label: 'Within 4 hours', desc: 'High-urgency proposal follow-up' },
    { hours: 12, label: 'Within 12 hours', desc: 'Same-day hotel / logistics confirmation' },
    { hours: 24, label: 'Within 24 hours', desc: 'Standard next-day follow-up' },
    { hours: 48, label: 'Within 2 days', desc: 'Traveler documentation / visa check' },
    { hours: 168, label: 'Within 7 days', desc: 'Weekly check-in or booking balance review' }
  ];

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();

    const newRule: SLAAutomationRule = {
      id: ruleToEdit?.id || `auto-rule-${Date.now()}`,
      ruleName: ruleName.trim() || `Automatic Follow-Up: ${triggerEvent}`,
      triggerEvent: triggerEvent as any,
      taskType: 'CUSTOM' as any,
      isEnabled: true,
      slaHours: completeWithinHours,
      department: assigneeTarget === 'OPERATIONS' ? 'OPERATIONS' : assigneeTarget === 'FINANCE' ? 'FINANCE' : 'SALES',
      defaultAssignee: {
        type: 'SPECIFIC_USER',
        name: assigneeName,
        email: assigneeEmail,
        department: assigneeTarget === 'OPERATIONS' ? 'OPERATIONS' : assigneeTarget === 'FINANCE' ? 'FINANCE' : 'SALES'
      },
      titleTemplate: titleTemplate.trim(),
      calendarId: 'primary',
      reminders: [{ method: 'popup', minutesBefore: 30 }],
      updatedAt: new Date().toISOString()
    };

    onSave(newRule);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/25 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/15 text-[#008f77] flex items-center justify-center font-bold shadow-xs">
              <Zap className="w-5 h-5 text-[#00C6A6]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                {ruleToEdit ? 'Edit Automatic Follow-Up' : 'New Automatic Follow-Up'}
              </h3>
              <p className="text-xs text-slate-500">
                Simple 4-step guided setup to automatically create tasks and reminders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="bg-slate-100/70 px-6 py-2.5 border-b border-slate-200/60 flex items-center justify-between text-xs">
          {[
            { num: 1, label: '1. When' },
            { num: 2, label: '2. What' },
            { num: 3, label: '3. Who' },
            { num: 4, label: '4. Complete Within' }
          ].map(s => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as any)}
              className={`font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                step === s.num ? 'text-[#008972]' : step > s.num ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${
                step === s.num ? 'bg-[#008972] text-white' : step > s.num ? 'bg-slate-300 text-slate-700' : 'bg-slate-200 text-slate-400'
              }`}>
                {s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* STEP 1: When should this happen? */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Step 1: When should this happen?</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the customer or operations event that triggers this automatic follow-up.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Follow-Up Process Name
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Lead Follow-Up: 24h Inquiry Response"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Choose Trigger Event
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TRIGGER_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTriggerEvent(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        triggerEvent === opt.id
                          ? 'border-[#008972] bg-[#008972]/5 ring-2 ring-[#008972]/30 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-900">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: What should be created? */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Step 2: What should happen?</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose the follow-up action to create when the event occurs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'TASK', label: 'Create Task & Calendar Event', desc: 'Adds task to team board and syncs with Google Calendar' },
                  { id: 'NOTIFICATION', label: 'In-App Follow-Up Alert', desc: 'Sends direct alert to assigned team member in Action Center' },
                  { id: 'EMAIL', label: 'Internal Follow-Up Email', desc: 'Sends email reminder to assignee email address' },
                  { id: 'REMINDER', label: 'Manager Escalation Notice', desc: 'Highlights task if unaddressed before deadline' }
                ].map(act => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionType(act.id as any)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      actionType === act.id
                        ? 'border-[#008972] bg-[#008972]/5 ring-2 ring-[#008972]/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">{act.label}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{act.desc}</div>
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Generated Task Title Template
                </label>
                <input
                  type="text"
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  placeholder="e.g. Follow up with {{clientName}} — {{bookingReference}}"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 block">
                  Tags: <code>{'{{clientName}}'}</code>, <code>{'{{bookingReference}}'}</code>, <code>{'{{destination}}'}</code>
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Who should receive it? */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Step 3: Who should do this?</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select which team or specific person will be assigned this follow-up.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'LEAD_OWNER', label: 'Lead / Sales Owner', desc: 'Assigned to the sales consultant managing the enquiry' },
                  { id: 'OPERATIONS', label: 'Operations Team', desc: 'Assigned to operations desk for hotel/voucher fulfillment' },
                  { id: 'FINANCE', label: 'Finance Team', desc: 'Assigned to finance for payment reconciliation' },
                  { id: 'USER', label: 'Specific Person', desc: 'Route to an individual team member directly' }
                ].map(target => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setAssigneeTarget(target.id as any)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      assigneeTarget === target.id
                        ? 'border-[#008972] bg-[#008972]/5 ring-2 ring-[#008972]/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">{target.label}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{target.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Assignee Name
                  </label>
                  <input
                    type="text"
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Assignee Email
                  </label>
                  <input
                    type="email"
                    value={assigneeEmail}
                    onChange={(e) => setAssigneeEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: When should it be completed? */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Step 4: When should it be completed?</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set the expected response time and late task reminder.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COMPLETE_OPTIONS.map(opt => (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => setCompleteWithinHours(opt.hours)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      completeWithinHours === opt.hours
                        ? 'border-[#008972] bg-[#008972]/5 ring-2 ring-[#008972]/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">{opt.label}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* What happens if the task is late? */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>What happens if this task is late?</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  If this follow-up is not completed within {completeWithinHours} hours, it will automatically appear in the <strong>Overdue (Needs Attention)</strong> view, and send an escalation reminder.
                </p>
                <label className="flex items-center space-x-2 text-xs text-amber-900 font-semibold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={lateEscalation}
                    onChange={(e) => setLateEscalation(e.target.checked)}
                    className="rounded text-amber-600 w-4 h-4"
                  />
                  <span>Send escalation reminder to manager if late</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl cursor-pointer flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as any)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-6 py-2.5 text-xs font-bold text-white bg-[#008972] hover:bg-[#00705d] rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Save Automatic Follow-Up</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
