import React, { useState, useEffect } from 'react';
import { 
  IntegrationServiceId, 
  IntegrationSummaryItem, 
  DatabaseHealthScoreReport, 
  User 
} from '../../types';
import { IntegrationsHubService } from '../../services/integrationsHubService';
import { IntegrationDashboardView } from './integrations/IntegrationDashboardView';
import { FirestoreManagementPanel } from './integrations/FirestoreManagementPanel';
import { GmailManagementPanel } from './integrations/GmailManagementPanel';
import { GoogleCalendarPanel } from './integrations/GoogleCalendarPanel';
import { GoogleSheetsPanel } from './integrations/GoogleSheetsPanel';
import { AuditGovernanceView } from './integrations/AuditGovernanceView';
import { IntegrationSetupWizard } from './integrations/IntegrationSetupWizard';
import { TechnicalGlossaryModal } from './integrations/TechnicalGlossaryModal';
import { 
  Database, 
  Mail, 
  Calendar, 
  FileSpreadsheet, 
  LayoutDashboard, 
  ShieldCheck, 
  Sparkles, 
  HelpCircle,
  RefreshCw,
  Layers,
  Wrench
} from 'lucide-react';

interface IntegrationsManagerProps {
  currentUser: User | null;
}

type TabType = 'DASHBOARD' | 'FIRESTORE' | 'GMAIL' | 'CALENDAR' | 'SHEETS' | 'AUDIT' | 'WIZARD';

export const IntegrationsManager: React.FC<IntegrationsManagerProps> = ({ currentUser }) => {
  const hubService = IntegrationsHubService.getInstance();

  const [activeTab, setActiveTab] = useState<TabType>('DASHBOARD');
  const [summaries, setSummaries] = useState<IntegrationSummaryItem[]>([]);
  const [healthReport, setHealthReport] = useState<DatabaseHealthScoreReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [repairFeedback, setRepairFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sum, health] = await Promise.all([
        hubService.getIntegrationsSummary(),
        hubService.runFullDatabaseAudit()
      ]);
      setSummaries(sum);
      setHealthReport(health);
    } catch (err) {
      console.error('Error loading integrations hub data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBulkRepair = async () => {
    setIsLoading(true);
    try {
      const res = await hubService.repairAllIssues(currentUser);
      setRepairFeedback(`One-Click Auto-Repair Complete: Fixed ${res.repairedCount} schema & relationship issues across all collections.`);
      setTimeout(() => setRepairFeedback(null), 5000);
      await loadData();
    } catch (err) {
      console.error('Bulk repair error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const navTabs = [
    { id: 'DASHBOARD' as TabType, label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'FIRESTORE' as TabType, label: 'Firestore / Database', icon: Database, badge: healthReport && healthReport.totalIssuesCount > 0 ? `${healthReport.totalIssuesCount}` : undefined },
    { id: 'GMAIL' as TabType, label: 'Gmail Operations', icon: Mail },
    { id: 'CALENDAR' as TabType, label: 'Google Calendar & SLAs', icon: Calendar },
    { id: 'SHEETS' as TabType, label: 'Google Sheets Pipeline', icon: FileSpreadsheet },
    { id: 'AUDIT' as TabType, label: 'Audit & Governance', icon: ShieldCheck },
    { id: 'WIZARD' as TabType, label: 'Setup Wizard', icon: Sparkles }
  ];

  return (
    <div className="space-y-6">
      {/* Top Level Section Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-1 overflow-x-auto">
        {navTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id.toLowerCase()}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#00E5C0]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isActive ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Global Repair Feedback Toast */}
      {repairFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-3 text-xs font-bold animate-in fade-in duration-200">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{repairFeedback}</span>
        </div>
      )}

      {/* Active Tab View Rendering */}
      {activeTab === 'DASHBOARD' && (
        <IntegrationDashboardView
          summaries={summaries}
          healthReport={healthReport}
          isLoading={isLoading}
          onRefresh={loadData}
          onNavigateToTab={(tabId) => setActiveTab(tabId as TabType)}
          onBulkRepair={handleBulkRepair}
          onOpenGlossary={() => setIsGlossaryOpen(true)}
          currentUser={currentUser}
        />
      )}

      {activeTab === 'FIRESTORE' && (
        <FirestoreManagementPanel
          healthReport={healthReport}
          onRefresh={loadData}
          currentUser={currentUser}
        />
      )}

      {activeTab === 'GMAIL' && (
        <GmailManagementPanel
          currentUser={currentUser}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'CALENDAR' && (
        <GoogleCalendarPanel
          currentUser={currentUser}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'SHEETS' && (
        <GoogleSheetsPanel
          currentUser={currentUser}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'AUDIT' && (
        <AuditGovernanceView
          currentUser={currentUser}
        />
      )}

      {activeTab === 'WIZARD' && (
        <IntegrationSetupWizard
          onComplete={() => {
            setActiveTab('DASHBOARD');
            loadData();
          }}
          currentUser={currentUser}
        />
      )}

      {/* Technical Glossary Modal */}
      <TechnicalGlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />
    </div>
  );
};
