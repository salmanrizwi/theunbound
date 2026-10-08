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
  Save,
  Building2,
  Users,
  ShieldCheck,
  Zap
} from 'lucide-react';

export const EmailCampaignsManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [campaigns, setCampaigns] = useState<EmailCampaignConfig[]>(db.getEmailCampaigns());
  const [isEditing, setIsEditing] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<EmailCampaignConfig> | null>(null);
  const [testSentNotice, setTestSentNotice] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');

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
      description: editingCampaign.description || 'Automated customer and DMC operations engagement trigger',
      isEnabled: editingCampaign.isEnabled ?? true,
      subject: editingCampaign.subject,
      templateHtml: editingCampaign.templateHtml || '<p>Dear Partner,</p><p>Your ground services are confirmed with our operations desk.</p>',
      senderName: editingCampaign.senderName || 'Operations Desk',
      senderEmail: editingCampaign.senderEmail || 'sales@theunbound.in',
      triggerCondition: editingCampaign.triggerCondition || 'Dispatches to both traveler and DMC operations (business@theunbound.in)',
      delayHours: Number(editingCampaign.delayHours || 0),
      dynamicVariables: editingCampaign.dynamicVariables || ['{{Customer Name}}', '{{Booking ID}}', '{{Destination}}', '{{DMC Email}}'],
      sentCount: editingCampaign.sentCount || 0,
      lastDispatchedAt: editingCampaign.lastDispatchedAt
    };

    db.saveEmailCampaign(completeCampaign, user);
    setIsEditing(false);
    setEditingCampaign(null);
  };

  const handleSendTestToBoth = (campaign: EmailCampaignConfig) => {
    const userTarget = user?.email || 'traveler@example.com';
    const dmcTarget = 'business@theunbound.in';

    // Dispatch to user
    db.dispatchEmailCampaign(campaign.id, userTarget, user);
    // Dispatch copy to DMC ops
    db.dispatchEmailCampaign(campaign.id, dmcTarget, user);

    setTestSentNotice(`Active Trigger "${campaign.name}" dispatched successfully to User (${userTarget}) & DMC Ground Desk (${dmcTarget})!`);
    setTimeout(() => setTestSentNotice(null), 5000);
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (activeFilter === 'ACTIVE') return c.isEnabled;
    if (activeFilter === 'PAUSED') return !c.isEnabled;
    return true;
  });

  const activeTriggersCount = campaigns.filter(c => c.isEnabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#008972]">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-sans">
                Marketing Triggers & Automated Email Hub
              </h2>
              <p className="text-xs text-slate-500">
                Automated transactional triggers dispatched to users/agents and TheUnbound DMC operations (<span className="font-mono font-bold text-slate-700">business@theunbound.in</span>).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-900 font-bold text-xs">
              <span>Active Triggers: </span>
              <span className="font-mono text-sm ml-1 text-emerald-700">{activeTriggersCount} / {campaigns.length}</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === filter
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {filter === 'ALL' ? 'All Triggers' : filter === 'ACTIVE' ? 'Active Triggers' : 'Paused'}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setEditingCampaign({
                id: `camp-${Date.now()}`,
                name: '14-Day Rate Expiry Alert',
                campaignType: 'SAVED_QUOTE_REMINDER',
                subject: 'Your 14-Day DMC Guaranteed Tariff is Expiring Soon',
                templateHtml: '<p>Dear {{Customer Name}},</p><p>Your locked wholesale quotation for {{Destination}} expires in 48 hours.</p>',
                senderName: 'Operations Desk',
                senderEmail: 'sales@theunbound.in',
                delayHours: 24,
                isEnabled: true
              });
              setIsEditing(true);
            }}
            className="px-3.5 py-1.5 bg-[#008972] hover:bg-[#007460] text-white rounded-xl text-xs font-bold flex items-center cursor-pointer shadow-xs"
          >
            <span>Create New Trigger</span>
          </button>
        </div>
      </div>

      {testSentNotice && (
        <div className="flex items-center space-x-2.5 bg-emerald-50 text-emerald-900 border border-emerald-200 p-4 rounded-2xl text-xs font-bold animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testSentNotice}</span>
        </div>
      )}

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCampaigns.map((camp, idx) => (
          <div key={camp.id || `camp-${idx}`} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  {(camp.campaignType || 'CAMPAIGN').replace(/_/g, ' ')}
                </span>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  camp.isEnabled 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {camp.isEnabled ? '● ACTIVE LIVE' : '○ PAUSED'}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">{camp.name}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Subject: <strong className="text-slate-700">{camp.subject}</strong></p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-600 font-mono line-clamp-2">
                {camp.templateHtml}
              </div>

              {/* Recipient Badges */}
              <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-500">
                <span className="bg-slate-100 px-2 py-0.5 rounded flex items-center space-x-1">
                  <Users className="w-3 h-3 text-[#008972]" />
                  <span>To: User / Traveler</span>
                </span>
                <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded flex items-center space-x-1 border border-emerald-100">
                  <Building2 className="w-3 h-3 text-[#008972]" />
                  <span>Copy: DMC (business@theunbound.in)</span>
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Dispatches</span>
                  <span className="text-xs font-bold font-mono text-slate-800">{camp.sentCount || 0} Runs</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Delay SLA</span>
                  <span className="text-xs font-bold font-mono text-emerald-700">
                    {camp.delayHours === 0 ? 'Instant' : `${camp.delayHours || 0} Hours`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => handleToggleStatus(camp.id, camp.isEnabled)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  camp.isEnabled 
                    ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' 
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                {camp.isEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{camp.isEnabled ? 'Pause' : 'Activate'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleSendTestToBoth(camp)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#008972] text-white hover:bg-[#007460] cursor-pointer flex items-center space-x-1 shadow-xs"
                  title="Dispatch live test email to User and DMC"
                >
                  <Send className="w-3 h-3 text-[#00E5C0]" />
                  <span>Test Trigger (User + DMC)</span>
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider">
                <Mail className="w-4 h-4" />
                <span>Edit Marketing Trigger Template</span>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Trigger / Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingCampaign.name || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Event Trigger
                  </label>
                  <select
                    value={editingCampaign.campaignType || 'BOOKING_CONFIRMATION'}
                    onChange={e => setEditingCampaign({ ...editingCampaign, campaignType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                  >
                    <option value="BOOKING_CONFIRMATION">Booking Confirmation SLA</option>
                    <option value="SAVED_QUOTE_REMINDER">Saved Quote Reminder</option>
                    <option value="DOWNLOADED_QUOTE_REMINDER">Downloaded Quote Reminder</option>
                    <option value="FIRST_BOOKING_REMINDER">First Booking Welcome</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Dispatch Delay (Hours)
                  </label>
                  <input
                    type="number"
                    value={editingCampaign.delayHours === undefined || isNaN(Number(editingCampaign.delayHours)) ? '' : editingCampaign.delayHours}
                    onChange={e => setEditingCampaign({ ...editingCampaign, delayHours: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email Subject Line *
                </label>
                <input
                  type="text"
                  required
                  value={editingCampaign.subject || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email HTML / Content Template *
                </label>
                <textarea
                  rows={5}
                  required
                  value={editingCampaign.templateHtml || ''}
                  onChange={e => setEditingCampaign({ ...editingCampaign, templateHtml: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs text-slate-900"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-900 space-y-1">
                <span className="font-bold block">✓ Dual-Recipient Verification Guarantee:</span>
                <span>All active triggers automatically send to the traveler/agent and copy TheUnbound DMC Ground Operations (<strong className="font-mono">business@theunbound.in</strong>).</span>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#008972] hover:bg-[#007460] text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Save Trigger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
