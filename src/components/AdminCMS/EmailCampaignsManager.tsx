import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { EmailCampaignConfig, EmailCampaignType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  Mail, 
  Send, 
  Play, 
  Pause, 
  Edit, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Eye, 
  MousePointer, 
  X, 
  Save 
} from 'lucide-react';

export const EmailCampaignsManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [campaigns, setCampaigns] = useState<EmailCampaignConfig[]>(db.getEmailCampaigns());
  const [isEditing, setIsEditing] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<EmailCampaignConfig> | null>(null);
  const [testSentNotice, setTestSentNotice] = useState<string | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setCampaigns(db.getEmailCampaigns());
    });
  }, []);

  const handleToggleStatus = (id: string, currentEnabled: boolean) => {
    const target = campaigns.find(c => c.id === id);
    if (!target) return;
    const updated: EmailCampaignConfig = {
      ...target,
      isEnabled: !currentEnabled
    };
    db.saveEmailCampaign(updated, user);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign || !editingCampaign.name || !editingCampaign.subject) return;

    const completeCampaign: EmailCampaignConfig = {
      id: editingCampaign.id || `camp-${Date.now()}`,
      campaignType: (editingCampaign.campaignType || 'BOOKING_CONFIRMATION') as EmailCampaignType,
      name: editingCampaign.name,
      description: editingCampaign.description || 'Automated customer engagement trigger',
      isEnabled: editingCampaign.isEnabled ?? true,
      subject: editingCampaign.subject,
      templateHtml: editingCampaign.templateHtml || '<p>Dear Customer,</p><p>Your ground services are confirmed with TheUnbound.</p>',
      senderName: editingCampaign.senderName || 'TheUnbound Operations',
      senderEmail: editingCampaign.senderEmail || 'sales@theunbound.in',
      triggerCondition: editingCampaign.triggerCondition || 'On booking confirmation or quote submission',
      delayHours: Number(editingCampaign.delayHours || 0),
      dynamicVariables: editingCampaign.dynamicVariables || ['{{Customer Name}}', '{{Booking ID}}', '{{Destination}}'],
      sentCount: editingCampaign.sentCount || 0,
      lastDispatchedAt: editingCampaign.lastDispatchedAt
    };

    db.saveEmailCampaign(completeCampaign, user);
    setIsEditing(false);
    setEditingCampaign(null);
  };

  const handleSendTest = (campaign: EmailCampaignConfig) => {
    const success = db.dispatchEmailCampaign(campaign.id, user?.email || 'admin@theunbound.in', user);
    if (success) {
      setTestSentNotice(`Test dispatch for "${campaign.name}" sent to ${user?.email || 'admin@theunbound.in'}!`);
      setTimeout(() => setTestSentNotice(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider mb-1">
            <Mail className="w-4 h-4" />
            <span>Automated Marketing & Transactional Engine</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Email Campaign & Notification Rules</h2>
          <p className="text-sm text-slate-500">
            Configure automated transactional triggers: Instant Booking Confirmations, Saved Quote Reminders, Download Follow-ups, and Agent Onboarding.
          </p>
        </div>
      </div>

      {testSentNotice && (
        <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-2xl text-sm font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{testSentNotice}</span>
        </div>
      )}

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {campaigns.map(camp => (
          <div key={camp.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                  Trigger: {camp.campaignType.replace(/_/g, ' ')}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  camp.isEnabled 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {camp.isEnabled ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">{camp.name}</h3>
                <p className="text-xs text-slate-500 font-medium">Subject: <strong className="text-slate-700">{camp.subject}</strong></p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 font-mono line-clamp-3">
                {camp.templateHtml}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Dispatched Runs</span>
                  <span className="text-sm font-bold font-mono text-slate-800">{camp.sentCount}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Delay SLA</span>
                  <span className="text-sm font-bold font-mono text-emerald-600">
                    {camp.delayHours} Hours
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => handleToggleStatus(camp.id, camp.isEnabled)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  camp.isEnabled 
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {camp.isEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{camp.isEnabled ? 'Pause Trigger' : 'Activate Trigger'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleSendTest(camp)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer flex items-center space-x-1"
                  title="Send Test to Admin"
                >
                  <Send className="w-3 h-3 text-[#00C6A6]" />
                  <span>Send Test</span>
                </button>
                <button
                  onClick={() => {
                    setEditingCampaign(camp);
                    setIsEditing(true);
                  }}
                  className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Edit Template"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {isEditing && editingCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center space-x-2 text-[#00C6A6] font-bold text-xs uppercase tracking-wider">
                <Mail className="w-4 h-4" />
                <span>Edit Email Campaign Template</span>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  value={editingCampaign.name || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Trigger Event
                  </label>
                  <select
                    value={editingCampaign.campaignType || 'BOOKING_CONFIRMATION'}
                    onChange={e => setEditingCampaign({ ...editingCampaign, campaignType: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                  >
                    <option value="BOOKING_CONFIRMATION">Booking Confirmation</option>
                    <option value="SAVED_QUOTE_REMINDER">Saved Quote Reminder</option>
                    <option value="DOWNLOADED_QUOTE_REMINDER">Downloaded Quote Reminder</option>
                    <option value="FIRST_BOOKING_REMINDER">First Booking Agent Welcome</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Trigger Delay (Hours)
                  </label>
                  <input
                    type="number"
                    value={editingCampaign.delayHours || 0}
                    onChange={e => setEditingCampaign({ ...editingCampaign, delayHours: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  required
                  value={editingCampaign.subject || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, subject: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Content Template
                </label>
                <textarea
                  rows={6}
                  required
                  value={editingCampaign.templateHtml || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, templateHtml: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-xs"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-sm shadow-md shadow-[#00C6A6]/20 cursor-pointer"
                >
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
