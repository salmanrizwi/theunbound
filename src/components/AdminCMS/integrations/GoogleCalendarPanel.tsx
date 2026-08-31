import React, { useState, useEffect } from 'react';
import { 
  GoogleCalendarSyncConfig, 
  User 
} from '../../../types';
import { IntegrationsHubService } from '../../../services/integrationsHubService';
import { AppDatabase } from '../../../services/db';
import { GoogleAuthCard } from './GoogleAuthCard';
import { googleAuth } from '../../../services/googleAuth';
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Clock, 
  CheckSquare, 
  ShieldCheck, 
  Layers, 
  Zap,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface GoogleCalendarPanelProps {
  currentUser: User | null;
  onRefresh: () => void;
}

export const GoogleCalendarPanel: React.FC<GoogleCalendarPanelProps> = ({
  currentUser,
  onRefresh
}) => {
  const hubService = IntegrationsHubService.getInstance();
  const db = AppDatabase.getInstance();

  const [config, setConfig] = useState<GoogleCalendarSyncConfig>(() => hubService.getCalendarConfig());
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; calendarSummary?: string; details: string } | null>(null);

  // Test Event State
  const [testTitle, setTestTitle] = useState<string>('SLA: 12h Ground Confirmation - Tokyo Highlights');
  const [testDate, setTestDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [testNotes, setTestNotes] = useState<string>('Ground logistics verification for VIP passenger group.');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; details: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await hubService.verifyCalendarConnection();
      setVerifyResult(res);
    } catch (err: any) {
      setVerifyResult({ success: false, details: err?.message || 'Verification failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (googleAuth.getAccessToken()) {
      handleVerify();
    }
  }, []);

  const handleSaveConfig = () => {
    hubService.saveCalendarConfig(config, currentUser);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleToggle = (key: keyof GoogleCalendarSyncConfig) => {
    if (key === 'calendarId') return;
    setConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCreateTestEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingEvent(true);
    setCreateResult(null);
    try {
      const res = await hubService.createTestCalendarEvent(testTitle, testDate, testNotes, currentUser);
      setCreateResult(res);
      onRefresh();
    } catch (err: any) {
      setCreateResult({ success: false, details: err?.message || 'Failed' });
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const calendarTasks = db.getCalendarTasks();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-amber-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4" />
            <span>Ground Operations & Task Dispatch</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Google Calendar & Ground SLA Management
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Synchronize hotel check-ins, airport transfers, guide rosters, and 12-hour supplier confirmation SLAs directly with Google Calendar & Tasks.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            id="verify-calendar-btn"
            onClick={handleVerify}
            disabled={isVerifying}
            className="inline-flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Verifying Calendar API...' : 'Verify Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Google OAuth Authentication Card */}
      <GoogleAuthCard 
        serviceName="Google Calendar & Tasks"
        requiredScopesDesc="dispatching ground logistics events, airport transfer reminders, guide duty rosters, and 12-hour supplier confirmation SLAs"
        onAuthenticated={() => {
          handleVerify();
          onRefresh();
        }}
      />

      {/* Verification Notice */}
      {verifyResult && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-200 ${
          verifyResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center space-x-3">
            {verifyResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div>
              <span className="font-extrabold">{verifyResult.success ? 'Calendar Connected:' : 'Notice:'}</span>{' '}
              <span>{verifyResult.details}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {verifyResult.calendarSummary ? (
              <span className="font-mono font-bold bg-emerald-100 px-2.5 py-1 rounded-lg text-emerald-800 shrink-0">
                {verifyResult.calendarSummary}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await googleAuth.signIn();
                      handleVerify();
                      onRefresh();
                    } catch (e: any) {
                      console.error(e);
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>Authenticate with Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const demoToken = `ya29.theunbound_workspace_token_${Date.now()}_simulated`;
                    googleAuth.setManualToken(demoToken, 'business@theunbound.in');
                    handleVerify();
                    onRefresh();
                  }}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Instant Connect
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid: Calendar Settings + Create Test Event */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Configuration & Target Calendar */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Ground SLA Synchronizer
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
              12h SLA Sync Engine
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Target Google Calendar ID / Queue
              </label>
              <input
                type="text"
                value={config.calendarId}
                onChange={e => setConfig({ ...config, calendarId: e.target.value })}
                placeholder="primary or ops@theunbound.in"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">Sync Confirmed Bookings:</span>
                <input
                  type="checkbox"
                  checked={config.syncBookings}
                  onChange={() => handleToggle('syncBookings')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">Sync Airport Transfers & Drivers:</span>
                <input
                  type="checkbox"
                  checked={config.syncTransfers}
                  onChange={() => handleToggle('syncTransfers')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">Sync Guide Duties & Excursions:</span>
                <input
                  type="checkbox"
                  checked={config.syncGuideDuties}
                  onChange={() => handleToggle('syncGuideDuties')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-bold">12-Hour Confirmation SLAs:</span>
                <input
                  type="checkbox"
                  checked={config.syncPaymentSlas}
                  onChange={() => handleToggle('syncPaymentSlas')}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            className="w-full inline-flex items-center justify-center space-x-2 bg-[#008972] hover:bg-[#00705e] text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            <span>{saveSuccess ? 'Settings Saved!' : 'Save Calendar Configurations'}</span>
          </button>
        </div>

        {/* Right: Create Test Event */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Interactive Calendar Dispatcher
            </span>
            <span className="text-xs text-amber-600 font-extrabold">
              Live Event Dispatch
            </span>
          </div>

          <form onSubmit={handleCreateTestEvent} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Event / Task Title
              </label>
              <input
                type="text"
                required
                value={testTitle}
                onChange={e => setTestTitle(e.target.value)}
                placeholder="e.g. Airport Transfer - Tokyo Narita"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Target Due Date
              </label>
              <input
                type="date"
                required
                value={testDate}
                onChange={e => setTestDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Operational Notes & Details
              </label>
              <textarea
                rows={2}
                value={testNotes}
                onChange={e => setTestNotes(e.target.value)}
                placeholder="Details, vehicle model, guide phone..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isCreatingEvent}
              className="w-full inline-flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Plus className={`w-3.5 h-3.5 ${isCreatingEvent ? 'animate-spin' : ''}`} />
              <span>{isCreatingEvent ? 'Scheduling...' : 'Dispatch Live Calendar SLA Task'}</span>
            </button>
          </form>

          {createResult && (
            <div className={`p-3 rounded-xl border text-xs ${
              createResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="font-extrabold flex items-center space-x-1">
                {createResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                <span>{createResult.details}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Queue Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Active Ground Operations SLA Queue ({calendarTasks.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live synchronization queue for reservation confirmation SLAs, driver assignments, and guide schedules.
            </p>
          </div>
        </div>

        {calendarTasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">
            Queue is empty. Dispatch a task above or create a booking to populate tasks.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Task Title</th>
                  <th className="py-3 px-4">Booking Ref</th>
                  <th className="py-3 px-4">Due Date / SLA</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calendarTasks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {t.title}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {t.bookingReference || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {t.startDate ? `${t.startDate} ${t.startTime || ''}` : 'Immediate'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        t.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.priority || 'NORMAL'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="inline-flex items-center space-x-1 text-emerald-800 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{t.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
