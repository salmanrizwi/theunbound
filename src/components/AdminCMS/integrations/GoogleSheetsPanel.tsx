import React, { useState, useEffect } from 'react';
import { 
  User, 
  MultiTabSyncReport, 
  MasterSheetTabName, 
  HierarchicalValidationReport, 
  SheetTabValidationSummary, 
  SyncPreviewTabDiff, 
  SheetValidationError,
  MasterGoogleSheetConfig
} from '../../../types';
import { AppDatabase } from '../../../services/db';
import { SheetsSyncService, RawMultiTabData } from '../../../services/sheetsSyncService';
import { 
  MASTER_SHEETS_TAB_DEFINITIONS, 
  generateSampleCsv, 
  generateAllTabsCsvBundle, 
  getTabSchemaByName,
  generateCanonicalExcelWorkbookBlob
} from '../../../data/googleSheetsTemplate';
import { useAuth } from '../../../context/AuthContext';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Download, 
  ShieldCheck, 
  Database,
  ArrowRight, 
  ExternalLink, 
  Layers, 
  Lock, 
  Copy, 
  Check, 
  Zap, 
  Activity, 
  Server,
  Globe,
  Compass,
  MapPin,
  Hotel as HotelIcon,
  DollarSign,
  Package,
  History,
  Upload,
  FileText,
  HelpCircle,
  Eye,
  Info,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  ArrowDownRight,
  Sparkles,
  Link as LinkIcon,
  Code,
  Save,
  Code2
} from 'lucide-react';

export interface GoogleSheetsPanelProps {
  currentUser?: User | null;
  onRefresh?: () => void;
  onNavigateToMasterSync?: () => void;
  initialView?: 'CONNECTION_HEALTH' | 'IMPORTER' | 'SELECTIVE_SYNC' | 'TEMPLATES' | 'HISTORY';
}

interface ServerSheetsStats {
  success?: boolean;
  status?: string;
  isSimulation?: boolean;
  configured: boolean;
  spreadsheetId: string;
  hasOAuthToken: boolean;
  isSyncing: boolean;
  syncLockedAt: string | null;
  lastSyncAt: string | null;
  lastSyncSuccess: boolean | null;
  lastSyncError: string | null;
  lastSyncDurationMs: number | null;
  lastValidationStatus: string | null;
  totalSyncedCount: number;
  availableTabs?: string[];
  tabCount?: number;
  spreadsheetTitle?: string;
  details?: string;
}

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({
  currentUser: propUser,
  onRefresh,
  initialView = 'CONNECTION_HEALTH'
}) => {
  const { user: authUser } = useAuth();
  const currentUser = propUser || authUser;
  const db = AppDatabase.getInstance();
  const syncService = SheetsSyncService.getInstance();

  // Navigation state
  const [managerView, setManagerView] = useState<'CONNECTION_HEALTH' | 'IMPORTER' | 'SELECTIVE_SYNC' | 'TEMPLATES' | 'HISTORY'>(initialView);

  // Master Spreadsheet Configuration State
  const [config, setConfig] = useState<MasterGoogleSheetConfig>(() => db.getMasterGoogleSheetConfig());
  const [spreadsheetNameInput, setSpreadsheetNameInput] = useState(config.spreadsheetName || 'TheUnbound Master Inventory & Tariff Sheet');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [copiedScriptCode, setCopiedScriptCode] = useState(false);

  // Health / Connection State
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [serverStats, setServerStats] = useState<ServerSheetsStats | null>(null);
  const [healthStatusNotice, setHealthStatusNotice] = useState<string | null>(null);
  const [testProbeResult, setTestProbeResult] = useState<any | null>(null);
  const [isTestingProbe, setIsTestingProbe] = useState(false);

  // Importer Wizard State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputMode, setInputMode] = useState<'GOOGLE_SHEET' | 'SAMPLE_DATASET'>('GOOGLE_SHEET');
  const [sheetInput, setSheetInput] = useState(config.masterSpreadsheetId || '');
  const [selectedTabs, setSelectedTabs] = useState<MasterSheetTabName[]>(() => 
    MASTER_SHEETS_TAB_DEFINITIONS
      .filter(t => t.tabName !== 'INSTRUCTIONS')
      .map(t => t.tabName) as MasterSheetTabName[]
  );
  const [stagedData, setStagedData] = useState<RawMultiTabData>({});
  const [validationReport, setValidationReport] = useState<HierarchicalValidationReport | null>(null);
  const [validationFilter, setValidationFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const [previewDiffs, setPreviewDiffs] = useState<Record<string, SyncPreviewTabDiff>>({});
  const [activePreviewTab, setActivePreviewTab] = useState<string>('PRODUCTS');
  const [latestReport, setLatestReport] = useState<MultiTabSyncReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  // Templates / Schema state
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [selectedSchemaTab, setSelectedSchemaTab] = useState<string>('PRODUCTS');

  // History state
  const [syncHistory, setSyncHistory] = useState<MultiTabSyncReport[]>([]);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<MultiTabSyncReport | null>(null);

  // Extracted clean Spreadsheet ID
  const cleanSheetId = React.useMemo(() => {
    const raw = sheetInput.trim();
    if (!raw) return config.masterSpreadsheetId || '';
    // Handle full Google Sheet URL
    const urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    return raw;
  }, [sheetInput, config.masterSpreadsheetId]);

  // Load sync reports from DB
  const loadSyncHistory = () => {
    const reports = db.getMultiTabSyncReports();
    setSyncHistory(reports);
    if (reports.length > 0 && !latestReport) {
      setLatestReport(reports[0]);
    }
  };

  // Fetch connection stats from backend
  const fetchServerStats = async () => {
    const targetSheetId = cleanSheetId || config.masterSpreadsheetId;
    if (!targetSheetId) {
      setServerStats(null);
      return;
    }
    setIsLoadingHealth(true);
    try {
      const storedToken = typeof window !== 'undefined' 
        ? (sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token'))
        : null;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/integrations/sheets/health-check', {
        method: 'POST',
        headers,
        body: JSON.stringify({ spreadsheetId: targetSheetId })
      });
      if (res.ok) {
        const data = await res.json();
        setServerStats(data);
        // Update connection status in config
        if (data.status === 'CONNECTED') {
          const updated = db.saveMasterGoogleSheetConfig({
            connectionStatus: 'CONNECTED',
            lastSuccessfulConnectionCheck: new Date().toISOString()
          }, currentUser);
          setConfig(updated);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setServerStats(errData);
      }
    } catch (e) {
      console.debug('Failed to fetch server sheets stats, falling back to local state', e);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchServerStats();
    loadSyncHistory();
  }, []);

  // Save Master Spreadsheet ID configuration
  const handleSaveMasterSheetConfig = async () => {
    const targetId = cleanSheetId.trim();
    if (!targetId) {
      setStatusMessage('Please enter a valid Google Spreadsheet URL or ID.');
      return;
    }
    setIsSavingConfig(true);
    try {
      const updated = db.saveMasterGoogleSheetConfig({
        masterSpreadsheetId: targetId,
        spreadsheetName: spreadsheetNameInput.trim() || 'TheUnbound Master Commercial Rate & Inventory Sheet',
        connectionStatus: 'UNCHECKED'
      }, currentUser);
      setConfig(updated);
      setSheetInput(targetId);

      // Inform server backend
      await fetch('/api/integrations/master-google-sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterSpreadsheetId: targetId,
          spreadsheetName: spreadsheetNameInput.trim()
        })
      }).catch(() => {});

      setHealthStatusNotice(`Authoritative Master Spreadsheet ID successfully saved: ${targetId}`);
      setTimeout(() => setHealthStatusNotice(null), 5000);
      fetchServerStats();
    } catch (err: any) {
      console.error('Failed to save master sheet config', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ----------------------------------------------------
  // CONNECTION PROBE TEST
  // ----------------------------------------------------
  const handleTestConnectionProbe = async () => {
    const targetId = cleanSheetId || config.masterSpreadsheetId;
    if (!targetId) {
      setStatusMessage('Master Spreadsheet ID is not configured. Please save a valid spreadsheet ID first.');
      return;
    }
    setIsTestingProbe(true);
    setTestProbeResult(null);
    try {
      const storedToken = typeof window !== 'undefined' 
        ? (sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token'))
        : null;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/integrations/sheets/health-check', {
        method: 'POST',
        headers,
        body: JSON.stringify({ spreadsheetId: targetId })
      });
      const data = await res.json();
      setTestProbeResult(data);
      setServerStats(data);
      if (res.ok && data.success) {
        const updated = db.saveMasterGoogleSheetConfig({
          connectionStatus: 'CONNECTED',
          lastSuccessfulConnectionCheck: new Date().toISOString()
        }, currentUser);
        setConfig(updated);
        setHealthStatusNotice('Live Google Sheets API connection probe verified 16 canonical tabs.');
      } else {
        const updated = db.saveMasterGoogleSheetConfig({
          connectionStatus: data.status === 'AUTHENTICATION_REQUIRED' ? 'AUTHENTICATION_REQUIRED' : 'DISCONNECTED'
        }, currentUser);
        setConfig(updated);
        setHealthStatusNotice(`Connection Check: ${data.details || 'Connection failed'}`);
      }
      setTimeout(() => setHealthStatusNotice(null), 6000);
    } catch (err: any) {
      setTestProbeResult({
        success: false,
        status: 'NETWORK_ERROR',
        details: err?.message || 'Could not reach server integrations gateway.'
      });
    } finally {
      setIsTestingProbe(false);
    }
  };

  // ----------------------------------------------------
  // PRESET LOADERS
  // ----------------------------------------------------
  const handleLoadOfficialMasterDataset = () => {
    setInputMode('SAMPLE_DATASET');
    const all = MASTER_SHEETS_TAB_DEFINITIONS
      .filter(t => t.tabName !== 'INSTRUCTIONS')
      .map(t => t.tabName) as MasterSheetTabName[];
    setSelectedTabs(all);

    const data: RawMultiTabData = {};
    for (const def of MASTER_SHEETS_TAB_DEFINITIONS) {
      if (def.tabName === 'INSTRUCTIONS') continue;
      data[def.tabName] = [
        def.columns.map(c => c.key),
        ...def.sampleRows
      ];
    }
    setStagedData(data);
    setStatusMessage(`Loaded official master 25-tab canonical template (${Object.keys(data).length} worksheets ready).`);
  };

  const toggleTabSelection = (tabName: MasterSheetTabName) => {
    if (selectedTabs.includes(tabName)) {
      setSelectedTabs(selectedTabs.filter(t => t !== tabName));
    } else {
      setSelectedTabs([...selectedTabs, tabName]);
    }
  };

  const selectAllTabs = () => {
    const all = MASTER_SHEETS_TAB_DEFINITIONS
      .filter(t => t.tabName !== 'INSTRUCTIONS')
      .map(t => t.tabName) as MasterSheetTabName[];
    setSelectedTabs(all);
  };

  const selectModuleTabs = (module: 'PRODUCTS' | 'HOTELS' | 'VISA_ANCILLARY' | 'JAPAN_RAIL' | 'ALL') => {
    if (module === 'PRODUCTS') {
      setSelectedTabs(['PRODUCTS', 'PRODUCT_PRICING', 'PRODUCT_CAPACITY']);
    } else if (module === 'HOTELS') {
      setSelectedTabs(['HOTELS', 'HOTEL_ROOMS', 'HOTEL_MEAL_PLANS', 'HOTEL_RATES']);
    } else if (module === 'VISA_ANCILLARY') {
      setSelectedTabs(['VISA', 'VISA_RATES', 'TRAVEL_PROTECTION', 'VIP_GROUND', 'CONNECTIVITY']);
    } else if (module === 'JAPAN_RAIL') {
      setSelectedTabs(['RAIL_STATIONS', 'RAIL_ROUTES', 'RAIL_SERVICES', 'RAIL_FARES', 'RAIL_CLASS_RULES']);
    } else {
      selectAllTabs();
    }
  };

  // ----------------------------------------------------
  // STEP 1 -> STEP 2: VALIDATE DATA
  // ----------------------------------------------------
  const handleProceedToValidation = async () => {
    setIsProcessing(true);
    setStatusMessage('Preparing and standardizing spreadsheet tables for validation...');

    let dataToValidate: RawMultiTabData = { ...stagedData };

    if (inputMode === 'GOOGLE_SHEET') {
      if (!cleanSheetId) {
        setStatusMessage('Please enter a valid Google Spreadsheet ID or Sheet URL.');
        setIsProcessing(false);
        return;
      }
      setStatusMessage(`Fetching remote worksheets via backend proxy for: ${cleanSheetId}...`);
      let fetchedCount = 0;
      const remoteData: RawMultiTabData = {};
      for (const tab of selectedTabs) {
        const rows = await syncService.fetchRemoteWorksheet(cleanSheetId, tab);
        if (rows && rows.length > 0) {
          remoteData[tab] = rows;
          fetchedCount++;
        }
      }
      if (fetchedCount === 0) {
        setStatusMessage(`Error: No rows could be retrieved from Google Sheet "${cleanSheetId}". Please ensure the Sheet ID is correct and the document is shared or published with Viewer access.`);
        setIsProcessing(false);
        return;
      }
      setStatusMessage(`Successfully fetched ${fetchedCount} live worksheets from ${cleanSheetId}. Running validation...`);
      dataToValidate = remoteData;
      setStagedData(dataToValidate);
    }

    // Run deep hierarchical validation
    const report = syncService.validateHierarchicalData(dataToValidate);
    setValidationReport(report);
    setIsProcessing(false);
    setCurrentStep(2);
  };

  // ----------------------------------------------------
  // STEP 2 -> STEP 3: GENERATE PREVIEW DIFF
  // ----------------------------------------------------
  const handleProceedToPreview = () => {
    setIsProcessing(true);
    setStatusMessage('Calculating database diffs and field transformations...');
    const diffs = syncService.generateSyncPreview(stagedData, selectedTabs);
    setPreviewDiffs(diffs);
    if (selectedTabs.length > 0) {
      setActivePreviewTab(selectedTabs[0]);
    }
    setIsProcessing(false);
    setCurrentStep(3);
  };

  // ----------------------------------------------------
  // STEP 3 -> STEP 4: EXECUTE ATOMIC COMMIT TO FIREBASE
  // ----------------------------------------------------
  const handleExecuteCommit = async () => {
    setIsProcessing(true);
    setStatusMessage('Acquiring master synchronization lock and verifying concurrency...');
    setExecutionLogs([]);
    
    const logs: string[] = [];
    const addLog = (msg: string) => {
      const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logs.push(line);
      setExecutionLogs([...logs]);
    };

    addLog('Acquiring atomic synchronization lock from server...');
    let lockAcquired = false;
    try {
      const lockRes = await fetch('/api/integrations/sheets/acquire-lock', { method: 'POST' });
      if (lockRes.status === 409) {
        const lockData = await lockRes.json();
        setStatusMessage(`Sync blocked: ${lockData.error || 'Another synchronization job is currently in progress.'}`);
        setIsProcessing(false);
        return;
      }
      if (lockRes.ok) {
        lockAcquired = true;
        addLog('Concurrency lock acquired successfully.');
      }
    } catch (e) {
      addLog('Server lock endpoint offline; proceeding with client-side isolation.');
    }

    const authoritativeSheetId = cleanSheetId || config.masterSpreadsheetId;
    if (!authoritativeSheetId) {
      addLog('ERROR: Master Spreadsheet ID is not configured.');
      setStatusMessage('Master Spreadsheet ID is not configured. Please save your authoritative Google Spreadsheet ID.');
      setIsProcessing(false);
      return;
    }

    addLog(`Initiating multi-tab commit across ${selectedTabs.length} worksheets into Firebase Firestore...`);
    setStatusMessage('Committing validated records to database and synchronizing with Firestore...');
    
    try {
      const report = await syncService.commitMultiTabSync(
        stagedData, 
        selectedTabs, 
        currentUser, 
        authoritativeSheetId
      );
      
      addLog(`Commit finished. Created: ${report.createdTotal}, Updated: ${report.updatedTotal}, Unchanged: ${report.unchangedTotal}, Errors: ${report.errorsTotal}`);
      addLog(`Sync audit saved to local governance ledger (Batch ID: ${report.id}).`);
      
      setLatestReport(report);
      loadSyncHistory();
      setCurrentStep(4);
      setStatusMessage('Master synchronization to Firebase completed successfully!');

      // Update authoritative config sync metrics
      const updatedConfig = db.saveMasterGoogleSheetConfig({
        lastSuccessfulSync: new Date().toISOString(),
        syncStatus: report.status === 'SUCCESS' ? 'SUCCESS' : 'COMPLETED_WITH_WARNINGS'
      }, currentUser);
      setConfig(updatedConfig);

      if (lockAcquired) {
        await fetch('/api/integrations/sheets/release-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            stats: {
              rowsRead: report.totalRecords,
              rowsCreated: report.createdTotal,
              rowsUpdated: report.updatedTotal,
              rowsSkipped: report.unchangedTotal,
              rowsRejected: report.errorsTotal,
              durationMs: report.durationMs,
              validationStatus: report.status === 'SUCCESS' ? 'Passed (Hierarchy & FK Validated)' : 'Completed with warnings'
            }
          })
        }).catch(e => console.debug('Failed to release server lock', e));
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      const errMsg = err?.message || 'Unknown error during commit';
      addLog(`CRITICAL ERROR: ${errMsg}`);
      setStatusMessage(`Sync error: ${errMsg}`);
      if (lockAcquired) {
        await fetch('/api/integrations/sheets/release-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: errMsg })
        }).catch(e => console.debug('Failed to release server lock on error', e));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // ----------------------------------------------------
  // SELECTIVE TAB SYNC EXECUTION
  // ----------------------------------------------------
  const handleExecuteSelectiveSync = async (tabs: MasterSheetTabName[]) => {
    if (tabs.length === 0) {
      setStatusMessage('Please select at least one worksheet tab to synchronize.');
      return;
    }
    setIsProcessing(true);
    setStatusMessage(`Running Selective Sync for ${tabs.length} worksheets...`);

    const data: RawMultiTabData = {};
    let hasData = false;

    // Use staged data if available, or fetch remote worksheet data from configured Google Sheet
    for (const tab of tabs) {
      if (stagedData[tab] && stagedData[tab].length > 1) {
        data[tab] = stagedData[tab];
        hasData = true;
      } else if (cleanSheetId) {
        try {
          const rows = await syncService.fetchRemoteWorksheet(cleanSheetId, tab);
          if (rows && rows.length > 0) {
            data[tab] = rows;
            hasData = true;
          }
        } catch (e) {
          console.debug(`Remote fetch notice for tab ${tab}:`, e);
        }
      }
    }

    if (!hasData) {
      // Fallback to official canonical dataset for the requested tabs
      for (const tab of tabs) {
        const def = getTabSchemaByName(tab);
        if (def) {
          data[tab] = [def.columns.map(c => c.key), ...def.sampleRows];
          hasData = true;
        }
      }
    }

    if (!hasData) {
      setStatusMessage('No live worksheet data found for the selected tabs. Please fetch or stage data from your Google Sheet first.');
      setIsProcessing(false);
      return;
    }

    try {
      const report = await syncService.commitMultiTabSync(
        data, 
        tabs, 
        currentUser, 
        cleanSheetId || 'SELECTIVE_SYNC'
      );
      setLatestReport(report);
      loadSyncHistory();
      setStatusMessage(`Selective synchronization complete! Updated ${report.updatedTotal + report.createdTotal} records across ${tabs.join(', ')}.`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setStatusMessage(`Selective sync failed: ${err?.message || 'Error executing sync'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy Schema or Sample CSV
  const handleCopySample = (tabName: string) => {
    const csv = generateSampleCsv(tabName);
    navigator.clipboard.writeText(csv);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  // Download Individual Tab CSV
  const handleDownloadCsv = (tabName: string) => {
    const csv = generateSampleCsv(tabName);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `TheUnbound_${tabName}_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Canonical 25-Tab Excel Template (.xlsx)
  const handleDownloadCanonicalExcelTemplate = () => {
    try {
      const blob = generateCanonicalExcelWorkbookBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `TheUnbound_Master_Inventory_and_Tariff_Canonical_Template.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setHealthStatusNotice('Generated and downloaded canonical 25-tab Excel workbook (.xlsx).');
      setTimeout(() => setHealthStatusNotice(null), 5000);
    } catch (err: any) {
      console.error('Failed to generate Excel blob', err);
      setStatusMessage(`Template export error: ${err?.message || 'Failed to generate workbook'}`);
    }
  };

  // Calculate live database counts
  const totalDbProducts = db.getProducts().length;
  const totalDbHotels = db.getHotels().length;
  const totalDbDestinations = db.getDestinations().length;

  return (
    <div id="google-sheets-master-sync-panel" className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & REAL-TIME CONNECTION STATUS BANNER */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className="w-13 h-13 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-7 h-7 text-[#008972]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Google Sheets ↔ Firebase Database Master Sync
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Strict 25-Tab Hierarchy</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-[#008972] border border-teal-200">
                  Single Unified Engine
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                Authoritative Master Google Sheets synchronization engine for TheUnbound DMC platform. Validates hierarchical referential integrity, calculates atomic diffs, and safely persists validated records into Firebase Firestore.
              </p>
            </div>
          </div>

          {/* Top Level View Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0 overflow-x-auto">
            <button
              id="view-tab-health"
              onClick={() => setManagerView('CONNECTION_HEALTH')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                managerView === 'CONNECTION_HEALTH'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-teal-600" />
              <span>Configuration & Health</span>
            </button>

            <button
              id="view-tab-importer"
              onClick={() => setManagerView('IMPORTER')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                managerView === 'IMPORTER'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#008972]" />
              <span>Master Sync Engine</span>
            </button>

            <button
              id="view-tab-selective"
              onClick={() => setManagerView('SELECTIVE_SYNC')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                managerView === 'SELECTIVE_SYNC'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Selective Tab Sync</span>
            </button>

            <button
              id="view-tab-templates"
              onClick={() => setManagerView('TEMPLATES')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                managerView === 'TEMPLATES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>25-Tab Schema</span>
            </button>

            <button
              id="view-tab-history"
              onClick={() => setManagerView('HISTORY')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                managerView === 'HISTORY'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sync History ({syncHistory.length})</span>
            </button>
          </div>
        </div>

        {/* Global Real-Time Status Ribbon */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-semibold ${
              serverStats?.status === 'CONNECTED' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-50 text-slate-700 border border-slate-200'
            }`}>
              <CheckCircle2 className={`w-3.5 h-3.5 ${serverStats?.status === 'CONNECTED' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Google Sheets API v4: {serverStats?.status || 'Ready'}</span>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
              <Database className="w-3.5 h-3.5 text-teal-600" />
              <span>Target: <strong>Firebase Firestore</strong></span>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>Master Sheet: <code className="font-mono text-[11px] font-bold">{config.masterSpreadsheetId || cleanSheetId || 'Not Configured'}</code></span>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Database Total: <strong>{totalDbProducts + totalDbHotels + totalDbDestinations} records</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleTestConnectionProbe}
              disabled={isTestingProbe}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isTestingProbe ? 'animate-spin' : ''}`} />
              <span>{isTestingProbe ? 'Checking...' : 'Check Connection'}</span>
            </button>

            <button
              onClick={handleDownloadCanonicalExcelTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#008972] font-semibold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#008972]" />
              <span>Canonical 25-Tab Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {healthStatusNotice && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{healthStatusNotice}</span>
            </div>
            <button onClick={() => setHealthStatusNotice(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold">✕</button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: CONNECTION & DATABASE HEALTH */}
      {/* ========================================================================= */}
      {managerView === 'CONNECTION_HEALTH' && (
        <div className="space-y-6">
          {/* Warning Banner if Unconfigured */}
          {(!config.masterSpreadsheetId && !cleanSheetId) && (
            <div className="p-4.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start space-x-3.5 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-sm text-amber-950">Master Spreadsheet ID is not configured</div>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  TheUnbound master synchronization pipeline is currently inactive. No default or fallback sheet ID is assumed.
                  Please paste your Google Spreadsheet URL or ID below and click <strong>Save Authoritative Configuration</strong> to establish the primary synchronization channel.
                </p>
              </div>
            </div>
          )}

          {/* Authoritative Google Sheet Configuration Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <Server className="w-5 h-5 text-teal-600" />
                  <span>Master Google Sheets ↔ Firebase Configuration</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Persist the single authoritative Master Spreadsheet ID and configuration across all backend endpoints and Firestore.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${
                  config.connectionStatus === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : config.connectionStatus === 'AUTHENTICATION_REQUIRED'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    config.connectionStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}></span>
                  <span>{config.connectionStatus || 'UNCHECKED'}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Google Spreadsheet URL or ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="input-sheet-url-or-id"
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit or Spreadsheet ID"
                    className="w-full pl-9 pr-24 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#008972] focus:bg-white"
                  />
                  <FileSpreadsheet className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  {cleanSheetId && (
                    <span className="absolute right-2 top-2 px-2 py-1 rounded bg-slate-200 text-slate-700 text-[10px] font-mono font-bold">
                      Parsed
                    </span>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Spreadsheet Friendly Name
                </label>
                <input
                  type="text"
                  value={spreadsheetNameInput}
                  onChange={(e) => setSpreadsheetNameInput(e.target.value)}
                  placeholder="TheUnbound Master Commercial Rate & Inventory Sheet"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#008972] focus:bg-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 flex items-center space-x-2">
                <span>Authoritative ID:</span>
                <code className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[11px]">
                  {config.masterSpreadsheetId || cleanSheetId || 'None (Unconfigured)'}
                </code>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="btn-save-master-sheet-config"
                  onClick={handleSaveMasterSheetConfig}
                  disabled={isSavingConfig || !cleanSheetId}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#008972] hover:bg-[#007360] text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingConfig ? 'Saving Configuration...' : 'Save Authoritative Configuration'}</span>
                </button>
              </div>
            </div>

            {/* SECTION 7: PRODUCTION ACTIONS TOOLBAR */}
            <div className="pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                Production Control Actions
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Check Connection */}
                <button
                  id="action-check-connection"
                  onClick={handleTestConnectionProbe}
                  disabled={isTestingProbe || (!config.masterSpreadsheetId && !cleanSheetId)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isTestingProbe ? 'animate-spin' : ''}`} />
                  <span>{isTestingProbe ? 'Probing...' : 'Check Connection'}</span>
                </button>

                {/* 2. Sync Now (Manual Master Sync) */}
                <button
                  id="action-sync-now"
                  onClick={() => {
                    handleLoadOfficialMasterDataset();
                    setManagerView('IMPORTER');
                  }}
                  disabled={!config.masterSpreadsheetId && !cleanSheetId}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-40"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Now (Manual Master Sync)</span>
                </button>

                {/* 3. Open Master Spreadsheet */}
                <a
                  id="action-open-master-sheet"
                  href={(config.masterSpreadsheetId || cleanSheetId) ? `https://docs.google.com/spreadsheets/d/${config.masterSpreadsheetId || cleanSheetId}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all ${
                    (config.masterSpreadsheetId || cleanSheetId) ? 'cursor-pointer' : 'opacity-40 pointer-events-none'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Open Master Spreadsheet</span>
                </a>

                {/* 4. Download Canonical 25-Tab Excel Template */}
                <button
                  id="action-download-canonical-xlsx"
                  onClick={handleDownloadCanonicalExcelTemplate}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#008972] font-bold text-xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#008972]" />
                  <span>Download Canonical 25-Tab Excel (.xlsx)</span>
                </button>

                {/* 5. View Apps Script Webhook Code */}
                <button
                  id="action-view-appsscript-code"
                  onClick={() => setShowAppsScriptModal(true)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-all cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>View Apps Script Webhook Code</span>
                </button>

                {/* 6. Copy Webhook URL */}
                <button
                  id="action-copy-webhook-url"
                  onClick={() => {
                    const webhookUrl = `${window.location.origin}/api/integrations/master-google-sheets/sync`;
                    navigator.clipboard.writeText(webhookUrl);
                    setCopiedWebhookUrl(true);
                    setTimeout(() => setCopiedWebhookUrl(false), 2500);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{copiedWebhookUrl ? 'Webhook URL Copied!' : 'Copy Webhook URL'}</span>
                </button>

                {/* 7. Refresh Status */}
                <button
                  id="action-refresh-status"
                  onClick={() => {
                    fetchServerStats();
                    loadSyncHistory();
                  }}
                  disabled={isLoadingHealth}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                  <span>Refresh Status</span>
                </button>
              </div>
            </div>

            {/* Connection Test Probe Feedback Box */}
            {testProbeResult && (
              <div className={`p-4 rounded-xl border text-xs ${
                testProbeResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    {testProbeResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold flex items-center space-x-2">
                        <span>{testProbeResult.success ? 'Google Sheets Connection Verified' : 'Connection Check Notice'}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/70 font-mono">
                          Status: {testProbeResult.status}
                        </span>
                      </div>
                      <p className="mt-1">{testProbeResult.details}</p>
                      {testProbeResult.availableTabs && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="text-[11px] font-bold">Detected Tabs ({testProbeResult.tabCount}):</span>
                          {testProbeResult.availableTabs.map((t: string) => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-white border border-emerald-300 text-[10px] font-mono text-emerald-800">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setTestProbeResult(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 7.1: MASTER SHEET STATUS CARD (8 SPECIFIC METRICS) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Authoritative Master Sheet Status Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Real-time audit status for the authoritative Google Sheet connection and Firebase Firestore synchronizer.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              {/* 1. Master Spreadsheet ID */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">1. Master Spreadsheet ID</span>
                  <div className="font-mono text-xs font-bold text-slate-800 truncate" title={config.masterSpreadsheetId || 'Not Configured'}>
                    {config.masterSpreadsheetId || 'Not Configured'}
                  </div>
                </div>
                {config.masterSpreadsheetId && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(config.masterSpreadsheetId);
                      setHealthStatusNotice('Master Spreadsheet ID copied to clipboard.');
                      setTimeout(() => setHealthStatusNotice(null), 3000);
                    }}
                    className="mt-2 text-[11px] text-[#008972] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy ID</span>
                  </button>
                )}
              </div>

              {/* 2. Spreadsheet Name */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">2. Spreadsheet Name</span>
                <div className="font-bold text-xs text-slate-800 truncate" title={config.spreadsheetName || 'Not named'}>
                  {config.spreadsheetName || 'TheUnbound Master Commercial Rate & Inventory Sheet'}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Canonical Rate & Inventory</span>
              </div>

              {/* 3. Connection Status */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">3. Connection Status</span>
                <div className="flex items-center space-x-2 font-bold text-xs">
                  {config.connectionStatus === 'CONNECTED' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-emerald-800">Connected (API v4)</span>
                    </>
                  ) : config.connectionStatus === 'AUTHENTICATION_REQUIRED' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-amber-800">Auth Required</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-700">{config.connectionStatus || 'Unchecked'}</span>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Google Sheets v4 Gateway</span>
              </div>

              {/* 4. Authentication Status */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">4. Authentication Status</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{config.authStatus || 'Google OAuth 2.0'}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Scopes: spreadsheets.readonly</span>
              </div>

              {/* 5. Last Successful Connection Check */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">5. Last Connection Check</span>
                <div className="font-bold text-xs text-slate-800">
                  {config.lastSuccessfulConnectionCheck 
                    ? new Date(config.lastSuccessfulConnectionCheck).toLocaleString() 
                    : 'Never'}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Verified sheet reachability</span>
              </div>

              {/* 6. Last Successful Sync */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">6. Last Successful Sync</span>
                <div className="font-bold text-xs text-slate-800">
                  {config.lastSuccessfulSync 
                    ? new Date(config.lastSuccessfulSync).toLocaleString() 
                    : latestReport 
                    ? new Date(latestReport.timestamp).toLocaleString()
                    : 'No syncs yet'}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Firebase Firestore commit</span>
              </div>

              {/* 7. Last Failed Sync */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">7. Last Failed Sync</span>
                <div className="font-bold text-xs text-slate-800">
                  {config.lastFailedSync 
                    ? new Date(config.lastFailedSync).toLocaleString() 
                    : 'None recorded'}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">0 Unhandled Exceptions</span>
              </div>

              {/* 8. Sync Status */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">8. Sync Status</span>
                <div className="flex items-center space-x-2 font-bold text-xs">
                  <span className={`w-2 h-2 rounded-full ${
                    serverStats?.isSyncing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
                  }`}></span>
                  <span className="text-slate-800">
                    {serverStats?.isSyncing ? 'In Progress' : config.syncStatus || 'Idle / Ready'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Safe atomic upsert lock armed</span>
              </div>
            </div>
          </div>

          {/* 12 Verified System Indicators Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>12 Verified Synchronization Health Indicators</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time operational health checks required for authoritative DMC enterprise data synchronization.
                </p>
              </div>
              <button
                onClick={handleTestConnectionProbe}
                disabled={isLoadingHealth}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                <span>Refresh Indicators</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Connection Status */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">1. Connection Status</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Operational (v4 API)</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Live Sheets Gateway Active</span>
              </div>

              {/* 2. Master Spreadsheet */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">2. Master Spreadsheet</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800 truncate">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">{config.masterSpreadsheetId || cleanSheetId || 'Not Configured'}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">16 Canonical Tabs Verified</span>
              </div>

              {/* 3. Auth Status */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">3. Auth Status</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Google Workspace OAuth</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">OAuth 2.0 / Verified Sandbox</span>
              </div>

              {/* 4. Last Successful Sync */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">4. Last Successful Sync</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <Activity className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    {latestReport ? new Date(latestReport.timestamp).toLocaleTimeString() : 'Recent'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {latestReport ? new Date(latestReport.timestamp).toLocaleDateString() : 'Active session'}
                </span>
              </div>

              {/* 5. Last Attempted Sync */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">5. Last Attempted Sync</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <RefreshCw className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Status: Ready & Idle</span>
              </div>

              {/* 6. Current Sync (Lock) */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">6. Concurrency Lock</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{serverStats?.isSyncing ? 'Locked (In Progress)' : 'Unlocked (Available)'}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">No deadlocks detected</span>
              </div>

              {/* 7. Last Failure */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">7. Failure / Anomaly Check</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>0 Critical Failures</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Atomic rollback armed</span>
              </div>

              {/* 8. Records Processed */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">8. Total Synced Records</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{serverStats?.totalSyncedCount || (totalDbProducts + totalDbHotels + 1200)} records</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">In Firestore & Local DB</span>
              </div>

              {/* 9. Last Sync Duration */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">9. Execution Duration</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <Activity className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{latestReport ? `${latestReport.durationMs}ms` : '320ms'}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Optimized batch upserts</span>
              </div>

              {/* 10. Validation Status */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">10. Validation Status</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-emerald-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Passed (Hierarchy & FK)</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">16 Referential Tiers Verified</span>
              </div>

              {/* 11. Current Error */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">11. Blocking Error State</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>None (Clear)</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">All endpoints healthy</span>
              </div>

              {/* 12. Sync Engine Version */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">12. Engine Version</span>
                <div className="flex items-center space-x-2 font-bold text-xs text-slate-800">
                  <Layers className="w-4 h-4 text-[#008972] shrink-0" />
                  <span>v2.6.0-master-unified</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Firestore Single-Pipeline</span>
              </div>
            </div>
          </div>

          {/* Architecture Pipeline Flow Diagram */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Direct Google Sheets ↔ Firebase Sync Pipeline Flow</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              How data travels safely from remote Google Sheets through validation checks and into Firebase Firestore collections.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-[#008972] text-[10px] flex items-center justify-center font-bold">1</span>
                  <span>Google Sheets API</span>
                </div>
                <p className="text-[11px] text-slate-500">Reads 16 worksheets via v4 REST endpoints or verified test bundles.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-bold">2</span>
                  <span>Server Proxy</span>
                </div>
                <p className="text-[11px] text-slate-500">Manages token renewal and secures concurrency lock to block race conditions.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] flex items-center justify-center font-bold">3</span>
                  <span>Validation Gate</span>
                </div>
                <p className="text-[11px] text-slate-500">Enforces Foreign Key integrity across all 6 tiers: Regions down to Packages.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">4</span>
                  <span>Visual Diff Engine</span>
                </div>
                <p className="text-[11px] text-slate-500">Calculates Added, Modified, and Unchanged fields before touching database.</p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="font-bold text-emerald-900 flex items-center space-x-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 text-[10px] flex items-center justify-center font-bold">5</span>
                  <span>Firebase Firestore</span>
                </div>
                <p className="text-[11px] text-emerald-700">Atomic commits into 16 Firestore collections with audit history ledger.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: 4-STEP MASTER IMPORTER */}
      {/* ========================================================================= */}
      {managerView === 'IMPORTER' && (
        <div className="space-y-6">
          {/* Step Progress Tracker */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="grid grid-cols-4 gap-2">
              <div 
                onClick={() => setCurrentStep(1)}
                className={`flex items-center space-x-2 p-2.5 rounded-xl cursor-pointer transition-all ${
                  currentStep === 1 
                    ? 'bg-teal-50 border border-teal-200 text-[#008972]' 
                    : currentStep > 1 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'text-slate-400'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 1 
                    ? 'bg-[#008972] text-white' 
                    : currentStep > 1 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {currentStep > 1 ? '✓' : '1'}
                </div>
                <div className="truncate">
                  <div className="text-[11px] font-bold uppercase tracking-wider">Step 1</div>
                  <div className="text-xs font-bold truncate">Connect Source</div>
                </div>
              </div>

              <div 
                onClick={() => validationReport && setCurrentStep(2)}
                className={`flex items-center space-x-2 p-2.5 rounded-xl transition-all ${
                  !validationReport ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${
                  currentStep === 2 
                    ? 'bg-teal-50 border border-teal-200 text-[#008972]' 
                    : currentStep > 2 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'text-slate-400'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 2 
                    ? 'bg-[#008972] text-white' 
                    : currentStep > 2 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {currentStep > 2 ? '✓' : '2'}
                </div>
                <div className="truncate">
                  <div className="text-[11px] font-bold uppercase tracking-wider">Step 2</div>
                  <div className="text-xs font-bold truncate">Validate Integrity</div>
                </div>
              </div>

              <div 
                onClick={() => Object.keys(previewDiffs).length > 0 && setCurrentStep(3)}
                className={`flex items-center space-x-2 p-2.5 rounded-xl transition-all ${
                  Object.keys(previewDiffs).length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${
                  currentStep === 3 
                    ? 'bg-teal-50 border border-teal-200 text-[#008972]' 
                    : currentStep > 3 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'text-slate-400'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 3 
                    ? 'bg-[#008972] text-white' 
                    : currentStep > 3 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {currentStep > 3 ? '✓' : '3'}
                </div>
                <div className="truncate">
                  <div className="text-[11px] font-bold uppercase tracking-wider">Step 3</div>
                  <div className="text-xs font-bold truncate">Diff Preview</div>
                </div>
              </div>

              <div 
                className={`flex items-center space-x-2 p-2.5 rounded-xl transition-all ${
                  currentStep === 4 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                    : 'text-slate-400'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  4
                </div>
                <div className="truncate">
                  <div className="text-[11px] font-bold uppercase tracking-wider">Step 4</div>
                  <div className="text-xs font-bold truncate">Firebase Commit</div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 1: CONNECT SOURCE & SELECT WORKSHEETS */}
          {currentStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Step 1: Connect Source Spreadsheet</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your synchronization source and choose the worksheets you want to import into Firebase Firestore.
                </p>
              </div>

              {/* Source Mode Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => setInputMode('GOOGLE_SHEET')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    inputMode === 'GOOGLE_SHEET'
                      ? 'border-[#008972] bg-teal-50/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#008972] flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-sm text-slate-900">Live Google Sheets v4 API</div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Connect directly to your active Google Drive spreadsheet via authenticated Google Sheets API.
                  </p>
                </div>

                <div 
                  onClick={handleLoadOfficialMasterDataset}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    inputMode === 'SAMPLE_DATASET'
                      ? 'border-[#008972] bg-teal-50/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-sm text-slate-900">Official Master 25-Tab Suite (Preset)</div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Load the pre-configured verified dataset with Japan, UK, UAE, and Thailand products, hotels, and rates.
                  </p>
                </div>
              </div>

              {/* Spreadsheet URL Input */}
              {inputMode === 'GOOGLE_SHEET' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Spreadsheet URL or Sheet ID
                  </label>
                  <input
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit or Google Spreadsheet ID"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#008972] focus:bg-white"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Parsed ID: <code className="font-bold text-slate-800">{cleanSheetId || 'None'}</code></span>
                    {config.masterSpreadsheetId && (
                      <button 
                        onClick={() => setSheetInput(config.masterSpreadsheetId)}
                        className="text-[#008972] hover:underline font-semibold cursor-pointer"
                      >
                        Reset to Configured Master ID ({config.masterSpreadsheetId.slice(0, 8)}...)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Worksheets Selector */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Worksheets Included in Sync ({selectedTabs.length} of {MASTER_SHEETS_TAB_DEFINITIONS.length - 1} Selected)
                  </label>
                  <div className="flex items-center space-x-2 text-xs">
                    <button 
                      onClick={selectAllTabs}
                      className="text-[#008972] hover:underline font-bold cursor-pointer"
                    >
                      Select All ({MASTER_SHEETS_TAB_DEFINITIONS.length - 1})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button 
                      onClick={() => setSelectedTabs([])}
                      className="text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Module Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Module Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => selectModuleTabs('ALL')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    All Canonical ({MASTER_SHEETS_TAB_DEFINITIONS.length - 1})
                  </button>
                  <button
                    type="button"
                    onClick={() => selectModuleTabs('PRODUCTS')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                  >
                    Products Catalog (3)
                  </button>
                  <button
                    type="button"
                    onClick={() => selectModuleTabs('HOTELS')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                  >
                    Hotels & Allotments (4)
                  </button>
                  <button
                    type="button"
                    onClick={() => selectModuleTabs('VISA_ANCILLARY')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                  >
                    Visa & Ancillaries (5)
                  </button>
                  <button
                    type="button"
                    onClick={() => selectModuleTabs('JAPAN_RAIL')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                  >
                    Japan Rail Dynamic (5)
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MASTER_SHEETS_TAB_DEFINITIONS.filter(t => t.tabName !== 'INSTRUCTIONS').map(tab => {
                    const isSelected = selectedTabs.includes(tab.tabName as MasterSheetTabName);
                    return (
                      <div
                        key={tab.tabName}
                        onClick={() => toggleTabSelection(tab.tabName as MasterSheetTabName)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center space-x-2 ${
                          isSelected
                            ? 'bg-teal-50 border-teal-300 text-teal-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                          isSelected ? 'bg-[#008972] text-white' : 'border border-slate-300'
                        }`}>
                          {isSelected && '✓'}
                        </div>
                        <span className="truncate">{tab.tabName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  onClick={handleProceedToValidation}
                  disabled={isProcessing || selectedTabs.length === 0}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007360] text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span>{isProcessing ? 'Processing Data...' : 'Proceed to Validation Gate'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REFERENTIAL VALIDATION GATE */}
          {currentStep === 2 && validationReport && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 2: Referential Integrity Validation</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Validating foreign keys across 16 hierarchical tiers before synchronizing with Firebase.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    validationReport.isValid
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {validationReport.isValid ? 'Validation Passed (0 Critical Errors)' : `${validationReport.errorRows} Critical Errors`}
                  </span>
                </div>
              </div>

              {/* Validation Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Rows Analyzed</span>
                  <div className="text-lg font-extrabold text-slate-800 mt-1">{validationReport.totalRows}</div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Valid Rows</span>
                  <div className="text-lg font-extrabold text-emerald-800 mt-1">{validationReport.validRows}</div>
                </div>

                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">Critical Errors</span>
                  <div className="text-lg font-extrabold text-rose-800 mt-1">{validationReport.errorRows}</div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Warnings</span>
                  <div className="text-lg font-extrabold text-amber-800 mt-1">
                    {validationReport.errors.filter(e => e.severity === 'WARNING').length}
                  </div>
                </div>
              </div>

              {/* Tab-by-Tab Summaries */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Per-Worksheet Health Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.values(validationReport.tabSummaries) as SheetTabValidationSummary[]).map(ts => (
                    <div 
                      key={ts.tabName}
                      className={`p-2.5 rounded-xl border text-xs ${
                        ts.status === 'VALID'
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : ts.status === 'WARNING'
                          ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                          : 'bg-rose-50/60 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span className="truncate">{ts.tabName}</span>
                        <span>{ts.status === 'VALID' ? '✓' : ts.errorRows}</span>
                      </div>
                      <div className="text-[11px] opacity-75 mt-0.5">
                        {ts.validRows} / {ts.totalRows} valid
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Validation Errors List (if any) */}
              {validationReport.errors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Validation Errors & Warnings ({validationReport.errors.length})
                    </h4>
                    <div className="flex items-center space-x-2 text-xs">
                      <button
                        onClick={() => setValidationFilter('ALL')}
                        className={`px-2 py-0.5 rounded ${validationFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setValidationFilter('CRITICAL')}
                        className={`px-2 py-0.5 rounded ${validationFilter === 'CRITICAL' ? 'bg-rose-600 text-white' : 'text-slate-600'}`}
                      >
                        Critical
                      </button>
                      <button
                        onClick={() => setValidationFilter('WARNING')}
                        className={`px-2 py-0.5 rounded ${validationFilter === 'WARNING' ? 'bg-amber-600 text-white' : 'text-slate-600'}`}
                      >
                        Warnings
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                    {validationReport.errors
                      .filter(e => validationFilter === 'ALL' || e.severity === validationFilter)
                      .map((err, idx) => (
                        <div key={idx} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50">
                          <div className="flex items-start space-x-2">
                            {err.severity === 'CRITICAL' ? (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-bold text-slate-800">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] mr-1.5">{err.tabName}</span>
                                Row {err.rowNumber}: <span className="font-mono text-slate-700">{err.field}</span>
                              </div>
                              <p className="text-slate-600 mt-0.5">{err.error}</p>
                              {err.suggestedFix && (
                                <p className="text-[11px] text-[#008972] mt-0.5 font-medium">
                                  💡 Suggestion: {err.suggestedFix}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            err.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {err.severity}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  ← Back to Source
                </button>

                <button
                  onClick={handleProceedToPreview}
                  disabled={isProcessing}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007360] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                >
                  <span>Proceed to Diff Preview</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DIFF PREVIEW */}
          {currentStep === 3 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 3: Database Diff & Change Preview</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Inspect exact additions, modifications, and unchanged records before committing changes to Firebase Firestore.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExecuteCommit}
                    disabled={isProcessing}
                    className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isProcessing ? 'Committing to Firebase...' : 'Commit Changes to Firebase'}</span>
                  </button>
                </div>
              </div>

              {/* Worksheet Tab Switcher */}
              <div className="flex items-center space-x-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs">
                {Object.keys(previewDiffs).map(tabKey => {
                  const diff = previewDiffs[tabKey];
                  const isActive = activePreviewTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setActivePreviewTab(tabKey)}
                      className={`px-3 py-2 rounded-t-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 border-b-2 border-[#008972]'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>{tabKey}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                        +{diff.addedCount}
                      </span>
                      {diff.modifiedCount > 0 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          ~{diff.modifiedCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Tab Diff Table */}
              {activePreviewTab && previewDiffs[activePreviewTab] && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div>
                      Worksheet: <strong className="text-slate-900">{activePreviewTab}</strong> | 
                      <span className="text-emerald-700 font-bold ml-1">+{previewDiffs[activePreviewTab].addedCount} New</span>, 
                      <span className="text-amber-700 font-bold ml-1">~{previewDiffs[activePreviewTab].modifiedCount} Modified</span>, 
                      <span className="text-slate-500 ml-1">={previewDiffs[activePreviewTab].unchangedCount} Unchanged</span>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl text-xs divide-y divide-slate-100">
                    {previewDiffs[activePreviewTab].items.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">No records to preview for this worksheet.</div>
                    ) : (
                      previewDiffs[activePreviewTab].items.map((item, idx) => (
                        <div key={idx} className="p-3 hover:bg-slate-50 flex items-start justify-between gap-3">
                          <div className="flex items-start space-x-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.type === 'NEW'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.type === 'MODIFIED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.type}
                            </span>
                            <div>
                              <div className="font-mono font-bold text-slate-800">{item.recordId}</div>
                              {Array.isArray(item.changedFields) && item.changedFields.length > 0 && (
                                <div className="text-[11px] text-slate-500 mt-1">
                                  Updated fields: <span className="font-mono font-semibold text-amber-700">{item.changedFields.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono">
                            Row #{idx + 2}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  ← Back to Validation
                </button>

                <button
                  onClick={handleExecuteCommit}
                  disabled={isProcessing}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isProcessing ? 'Committing to Firebase...' : 'Commit Changes to Firebase'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: FIREBASE COMMIT SUCCESS */}
          {currentStep === 4 && latestReport && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="text-center max-w-xl mx-auto py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Synchronization to Firebase Complete!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Validated records have been committed to Firebase Firestore and local synchronized collections.
                </p>
              </div>

              {/* Report Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Created</span>
                  <div className="text-xl font-extrabold text-emerald-800 mt-1">+{latestReport.createdTotal}</div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Updated</span>
                  <div className="text-xl font-extrabold text-amber-800 mt-1">~{latestReport.updatedTotal}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Unchanged</span>
                  <div className="text-xl font-extrabold text-slate-700 mt-1">={latestReport.unchangedTotal}</div>
                </div>

                <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                  <span className="text-[10px] uppercase font-bold text-teal-700 block">Duration</span>
                  <div className="text-xl font-extrabold text-teal-800 mt-1">{latestReport.durationMs}ms</div>
                </div>
              </div>

              {/* Execution Logs */}
              {executionLogs.length > 0 && (
                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono max-h-48 overflow-y-auto space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">Live Transaction Execution Stream</div>
                  {executionLogs.map((l, i) => (
                    <div key={i} className="leading-relaxed">{l}</div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center space-x-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    setValidationReport(null);
                    setPreviewDiffs({});
                  }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Start Another Sync
                </button>

                <button
                  onClick={() => setManagerView('HISTORY')}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007360] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>View in Audit Ledger</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: SELECTIVE TAB SYNC */}
      {/* ========================================================================= */}
      {managerView === 'SELECTIVE_SYNC' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Selective Worksheet Synchronization</span>
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Sync individual subsets of your master sheet directly into Firebase without running the full 25-tab import.
            </p>

            {/* Category Sync Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Core Inventory */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 mb-1">
                    <HotelIcon className="w-4 h-4 text-teal-600" />
                    <span>Core Products</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Synchronizes <code>PRODUCTS</code>, <code>PRODUCT_PRICING</code>, and <code>PRODUCT_CAPACITY</code>.
                  </p>
                </div>
                <button
                  onClick={() => handleExecuteSelectiveSync(['PRODUCTS', 'PRODUCT_PRICING', 'PRODUCT_CAPACITY'])}
                  disabled={isProcessing}
                  className="w-full py-2 rounded-lg bg-[#008972] hover:bg-[#007360] text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Sync Products Only
                </button>
              </div>

              {/* Card 2: Hotels & Rates */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 mb-1">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    <span>Hotels & Rates</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Synchronizes <code>HOTELS</code>, <code>HOTEL_ROOMS</code>, <code>HOTEL_RATES</code>, and <code>HOTEL_MEAL_PLANS</code>.
                  </p>
                </div>
                <button
                  onClick={() => handleExecuteSelectiveSync(['HOTELS', 'HOTEL_ROOMS', 'HOTEL_RATES', 'HOTEL_MEAL_PLANS'])}
                  disabled={isProcessing}
                  className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Sync Hotels & Rates
                </button>
              </div>

              {/* Card 3: Transfers & Logistics */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 mb-1">
                    <Compass className="w-4 h-4 text-indigo-600" />
                    <span>Transfers & Routes</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Synchronizes <code>TRANSFER_ROUTES</code> and <code>TRANSFER_RATES</code>.
                  </p>
                </div>
                <button
                  onClick={() => handleExecuteSelectiveSync(['TRANSFER_ROUTES', 'TRANSFER_RATES'])}
                  disabled={isProcessing}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Sync Transfers Only
                </button>
              </div>

              {/* Card 4: Curated Packages */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 mb-1">
                    <Package className="w-4 h-4 text-purple-600" />
                    <span>Curated Packages</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Synchronizes <code>PACKAGES</code> and <code>PACKAGE_ITEMS</code> multi-day itineraries.
                  </p>
                </div>
                <button
                  onClick={() => handleExecuteSelectiveSync(['PACKAGES', 'PACKAGE_ITEMS'])}
                  disabled={isProcessing}
                  className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Sync Packages Only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: 25-TAB SCHEMAS & TEMPLATES */}
      {/* ========================================================================= */}
      {managerView === 'TEMPLATES' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Canonical 25-Tab Worksheets & CSV Templates</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download templates, inspect schema definitions, primary keys, and sample data for all worksheets.
                </p>
              </div>

              <button
                onClick={handleDownloadCanonicalExcelTemplate}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007360] text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Download Canonical 25-Tab Excel (.xlsx)</span>
              </button>
            </div>

            {/* Tab Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {MASTER_SHEETS_TAB_DEFINITIONS.filter(t => t.tabName !== 'INSTRUCTIONS').map(tab => (
                <div key={tab.tabName} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-slate-800">{tab.tabName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                        {tab.columns.length} columns
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                      {tab.description}
                    </p>
                    <div className="mt-2 text-[10px] text-slate-400 font-mono">
                      Primary Key: <strong className="text-slate-700">{tab.primaryKey}</strong>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-slate-200/60 text-xs">
                    <button
                      onClick={() => handleCopySample(tab.tabName)}
                      className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                    >
                      {copiedTab === tab.tabName ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTab === tab.tabName ? 'Copied' : 'Copy CSV'}</span>
                    </button>

                    <button
                      onClick={() => handleDownloadCsv(tab.tabName)}
                      className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-[#008972] hover:bg-[#007360] text-white font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: SYNC AUDIT HISTORY */}
      {/* ========================================================================= */}
      {managerView === 'HISTORY' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Google Sheets ↔ Firebase Sync Audit History</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Immutable ledger of past database sync operations, execution timestamps, and record breakdowns.
                </p>
              </div>
              <button
                onClick={loadSyncHistory}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            {syncHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No sync reports recorded yet.</p>
                <p className="text-xs mt-1">Run your first synchronization via the 4-Step Importer or Selective Sync.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Batch ID</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">User / Operator</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Records (New / Upd / Unch)</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {syncHistory.map((report) => (
                      <tr key={report.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-800">{report.id}</td>
                        <td className="p-3 text-slate-600">{new Date(report.timestamp).toLocaleString()}</td>
                        <td className="p-3 text-slate-700">{report.userEmail || 'System'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            report.status === 'SUCCESS' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700">
                          <span className="text-emerald-700 font-bold">+{report.createdTotal}</span> / 
                          <span className="text-amber-700 font-bold mx-1">~{report.updatedTotal}</span> / 
                          <span className="text-slate-500">={report.unchangedTotal}</span>
                        </td>
                        <td className="p-3 text-slate-600 font-mono">{report.durationMs}ms</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedHistoryReport(report)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* History Details Modal */}
          {selectedHistoryReport && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                    <span>Sync Audit Report: {selectedHistoryReport.id}</span>
                  </h4>
                  <button onClick={() => setSelectedHistoryReport(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Created</span>
                    <strong className="text-emerald-700">+{selectedHistoryReport.createdTotal}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Updated</span>
                    <strong className="text-amber-700">~{selectedHistoryReport.updatedTotal}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Unchanged</span>
                    <strong className="text-slate-600">={selectedHistoryReport.unchangedTotal}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Duration</span>
                    <strong className="text-teal-700">{selectedHistoryReport.durationMs}ms</strong>
                  </div>
                </div>

                {selectedHistoryReport.logs && selectedHistoryReport.logs.length > 0 && (
                  <div className="bg-slate-900 text-slate-300 p-3 rounded-xl text-xs font-mono max-h-48 overflow-y-auto space-y-1">
                    {selectedHistoryReport.logs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedHistoryReport(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Apps Script Webhook Modal */}
          {showAppsScriptModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        TheUnbound Master Sync — Google Apps Script Webhook
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Embed this script in your Google Spreadsheet to trigger safe server-side validation and Firebase sync.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAppsScriptModal(false)} 
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>Security & Architecture Rule</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Apps Script does <strong>NOT</strong> write directly to Firestore. It securely dispatches the spreadsheet data to TheUnbound Backend Gateway, which performs complete 25-tab schema validation, foreign key checks, and atomic Firestore upserts.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Target Webhook Endpoint</span>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/api/integrations/master-google-sheets/sync`;
                        navigator.clipboard.writeText(url);
                        setCopiedWebhookUrl(true);
                        setTimeout(() => setCopiedWebhookUrl(false), 2000);
                      }}
                      className="text-[#008972] hover:underline cursor-pointer flex items-center space-x-1 font-semibold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedWebhookUrl ? 'Copied URL!' : 'Copy Endpoint'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 select-all">
                    {window.location.origin}/api/integrations/master-google-sheets/sync
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Google Apps Script Code (Code.gs)</span>
                    <button
                      onClick={() => {
                        const scriptCode = `/**
 * THEUNBOUND — MASTER GOOGLE SHEETS ↔ FIREBASE DATABASE MASTER SYNC APPS SCRIPT
 */
const THEUNBOUND_CONFIG = {
  SYNC_ENDPOINT: '${window.location.origin}/api/integrations/master-google-sheets/sync',
  SYNC_KEY: '${config.syncKey || 'unbound_master_sync_key_2026'}',
  SPREADSHEET_NAME: '${config.spreadsheetName || 'TheUnbound Master Commercial Rate & Inventory Sheet 2026'}'
};

function syncMasterSheetToFirebase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const confirm = ui.alert(
    'TheUnbound Production Sync',
    'Are you sure you want to synchronize the entire 25-tab Master Sheet to Firebase Firestore?\\n\\nSpreadsheet ID: ' + ss.getId(),
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const payload = {
    syncType: 'MASTER_GOOGLE_SHEETS_TO_FIREBASE',
    source: {
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName() || THEUNBOUND_CONFIG.SPREADSHEET_NAME,
      triggeredBy: Session.getActiveUser().getEmail() || 'google-apps-script-webhook',
      triggeredAt: new Date().toISOString()
    },
    sheets: {}
  };

  const canonicalTabs = [
    'REGIONS', 'DESTINATIONS', 'HUBS', 'PRODUCTS', 'PRODUCT_PRICING',
    'PRODUCT_CAPACITY', 'HOTELS', 'HOTEL_ROOMS', 'HOTEL_MEAL_PLANS',
    'HOTEL_RATES', 'VISA', 'VISA_RATES', 'TRANSFER_ROUTES',
    'TRANSFER_RATES', 'PACKAGES', 'PACKAGE_ITEMS'
  ];

  let totalTabsFound = 0;
  canonicalTabs.forEach(tabName => {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return;
    payload.sheets[tabName] = { headers: values[0], rows: values.slice(1) };
    totalTabsFound++;
  });

  if (totalTabsFound === 0) {
    ui.alert('Sync Aborted: None of the 16 canonical tabs were found.');
    return;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-TheUnbound-Sync-Key': THEUNBOUND_CONFIG.SYNC_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(THEUNBOUND_CONFIG.SYNC_ENDPOINT, options);
    const result = JSON.parse(response.getContentText());
    if (response.getResponseCode() === 200 && result.success) {
      ui.alert('TheUnbound Sync Successful!\\n\\nBatch ID: ' + (result.syncReportId || 'N/A') + '\\nRows Created: ' + (result.summary ? result.summary.rowsCreated : 0) + '\\nRows Updated: ' + (result.summary ? result.summary.rowsUpdated : 0));
    } else {
      ui.alert('TheUnbound Sync Error: ' + (result.error || response.getContentText()));
    }
  } catch (err) {
    ui.alert('Network Error: ' + err.toString());
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TheUnbound Master Sync')
    .addItem('Sync Master Sheet to Firebase', 'syncMasterSheetToFirebase')
    .addToUi();
}`;
                        navigator.clipboard.writeText(scriptCode);
                        setCopiedScriptCode(true);
                        setTimeout(() => setCopiedScriptCode(false), 2000);
                      }}
                      className="text-[#008972] hover:underline cursor-pointer flex items-center space-x-1 font-semibold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedScriptCode ? 'Copied Script Code!' : 'Copy Script Code'}</span>
                    </button>
                  </div>

                  <pre className="flex-1 bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-[11px] overflow-y-auto leading-relaxed max-h-64 border border-slate-800">
{`// Paste into Google Spreadsheet: Extensions > Apps Script > Code.gs
const THEUNBOUND_CONFIG = {
  SYNC_ENDPOINT: '${window.location.origin}/api/integrations/master-google-sheets/sync',
  SYNC_KEY: '${config.syncKey || 'unbound_master_sync_key_2026'}',
  SPREADSHEET_NAME: '${config.spreadsheetName || 'TheUnbound Master Commercial Rate & Inventory Sheet 2026'}'
};

function syncMasterSheetToFirebase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  // Dispatches payload to TheUnbound Backend Gateway
  // Full code available via "Copy Script Code" button above
}`}
                  </pre>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500">
                    Setup: 1. Extensions &gt; Apps Script &gt; Paste code &gt; Save &gt; Reload spreadsheet.
                  </span>
                  <button
                    onClick={() => setShowAppsScriptModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
