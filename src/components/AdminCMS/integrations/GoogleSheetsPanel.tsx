import React, { useState, useEffect } from 'react';
import { 
  User, 
  MultiTabSyncReport, 
  MasterSheetTabName, 
  HierarchicalValidationReport, 
  SheetTabValidationSummary, 
  SyncPreviewTabDiff, 
  SheetValidationError,
  MasterGoogleSheetConfig,
  DynamicWorkbookInspectionReport,
  DynamicModulePresetId
} from '../../../types';
import { AppDatabase } from '../../../services/db';
import { SheetsSyncService, RawMultiTabData } from '../../../services/sheetsSyncService';
import { CanonicalSchemaRegistry, CanonicalModuleSchema } from '../../../services/canonicalSchemaRegistry';
import { ModulePresetRegistry, ModulePresetDefinition } from '../../../services/modulePresetRegistry';
import { DynamicTemplateGenerator } from '../../../services/dynamicTemplateGenerator';
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
  Code2,
  Filter,
  CheckSquare,
  Square
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
}

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({ 
  currentUser: propUser, 
  onRefresh, 
  initialView = 'IMPORTER' 
}) => {
  const { user: authUser } = useAuth();
  const currentUser = propUser || authUser;
  const db = AppDatabase.getInstance();
  const syncService = SheetsSyncService.getInstance();

  // Navigation State
  const [managerView, setManagerView] = useState<'CONNECTION_HEALTH' | 'IMPORTER' | 'SELECTIVE_SYNC' | 'TEMPLATES' | 'HISTORY'>(initialView);

  // Configuration State
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

  // ----------------------------------------------------
  // Dynamic Module Preset & Importer Wizard State
  // ----------------------------------------------------
  const [selectedPresetId, setSelectedPresetId] = useState<DynamicModulePresetId>('all_canonical');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputMode, setInputMode] = useState<'GOOGLE_SHEET' | 'FILE_UPLOAD' | 'MANUAL_CSV' | 'CANONICAL_DATASET'>('GOOGLE_SHEET');
  const [sheetInput, setSheetInput] = useState(config.masterSpreadsheetId || '');
  const [manualCsvText, setManualCsvText] = useState('');
  const [manualCsvTabTarget, setManualCsvTabTarget] = useState('PRODUCTS');
  
  // Staged Data & Dynamic Inspection
  const [stagedData, setStagedData] = useState<RawMultiTabData>({});
  const [inspectionReport, setInspectionReport] = useState<DynamicWorkbookInspectionReport | null>(null);
  const [validationReport, setValidationReport] = useState<HierarchicalValidationReport | null>(null);
  const [validationFilter, setValidationFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const [previewDiffs, setPreviewDiffs] = useState<Record<string, SyncPreviewTabDiff>>({});
  const [activePreviewTab, setActivePreviewTab] = useState<string>('PRODUCTS');
  const [latestReport, setLatestReport] = useState<MultiTabSyncReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  // Templates / Schema Explorer State
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [selectedSchemaPreset, setSelectedSchemaPreset] = useState<DynamicModulePresetId>('all_canonical');
  const [selectedSchemaTab, setSelectedSchemaTab] = useState<string>('products_catalog');
  const [includeDemoDataInTemplate, setIncludeDemoDataInTemplate] = useState(false);

  // History State
  const [syncHistory, setSyncHistory] = useState<MultiTabSyncReport[]>([]);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<MultiTabSyncReport | null>(null);

  // Extracted clean Spreadsheet ID
  const cleanSheetId = React.useMemo(() => {
    const raw = sheetInput.trim();
    if (!raw) return config.masterSpreadsheetId || '';
    const urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    return raw;
  }, [sheetInput, config.masterSpreadsheetId]);

  // Available Presets from Registry
  const availablePresets = React.useMemo(() => {
    return ModulePresetRegistry.getAllPresets();
  }, []);

  const activePreset = React.useMemo(() => {
    return ModulePresetRegistry.getPreset(selectedPresetId) || availablePresets[0];
  }, [selectedPresetId, availablePresets]);

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
      console.debug('Failed to fetch server sheets stats', e);
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

  // Connection Probe
  const handleTestConnectionProbe = async () => {
    const targetId = cleanSheetId || config.masterSpreadsheetId;
    if (!targetId) {
      setStatusMessage('Master Spreadsheet ID is not configured.');
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
        setHealthStatusNotice('Live Google Sheets API connection verified successfully.');
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
  // PRESET DATASET LOADER (Canonical Sample Data)
  // ----------------------------------------------------
  const handleLoadCanonicalDatasetForPreset = (presetId: DynamicModulePresetId) => {
    setInputMode('CANONICAL_DATASET');
    const schemas = ModulePresetRegistry.getSchemasForPreset(presetId, true);
    const data: RawMultiTabData = {};

    for (const schema of schemas) {
      if (schema.schemaId === 'instructions') continue;
      data[schema.canonicalTabName] = [
        schema.columns.map(c => c.key),
        ...schema.sampleRows
      ];
    }
    setStagedData(data);
    const inspection = syncService.inspectWorkbookAgainstPreset(data, presetId);
    setInspectionReport(inspection);
    setStatusMessage(`Loaded canonical dataset for ${activePreset.name} (${Object.keys(data).length} worksheets ready).`);
  };

  // Handle local File Upload (.xlsx or .csv)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage(`Reading file "${file.name}"...`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const parsed: RawMultiTabData = {};
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (rows.length > 0) {
          parsed[sheetName] = rows;
        }
      }

      setStagedData(parsed);
      const inspection = syncService.inspectWorkbookAgainstPreset(parsed, selectedPresetId);
      setInspectionReport(inspection);
      setStatusMessage(`Discovered ${Object.keys(parsed).length} worksheet(s) in "${file.name}".`);
    } catch (err: any) {
      setStatusMessage(`File parse error: ${err?.message || 'Could not read Excel file.'}`);
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = '';
    }
  };

  // Handle Manual CSV Paste
  const handleApplyManualCsv = () => {
    if (!manualCsvText.trim()) {
      setStatusMessage('Please enter CSV data before parsing.');
      return;
    }
    const rows = syncService.parseCsvToRows(manualCsvText);
    if (rows.length < 1) {
      setStatusMessage('Invalid CSV text: No rows found.');
      return;
    }
    const updatedData = { ...stagedData, [manualCsvTabTarget]: rows };
    setStagedData(updatedData);
    const inspection = syncService.inspectWorkbookAgainstPreset(updatedData, selectedPresetId);
    setInspectionReport(inspection);
    setStatusMessage(`Parsed ${rows.length - 1} rows into "${manualCsvTabTarget}".`);
  };

  // ----------------------------------------------------
  // STEP 1 -> STEP 2: RUN VALIDATION
  // ----------------------------------------------------
  const handleProceedToValidation = async () => {
    setIsProcessing(true);
    setStatusMessage('Preparing and standardizing workbook tables for validation...');

    let dataToValidate: RawMultiTabData = { ...stagedData };

    if (inputMode === 'GOOGLE_SHEET') {
      if (!cleanSheetId) {
        setStatusMessage('Please enter a valid Google Spreadsheet ID or Sheet URL.');
        setIsProcessing(false);
        return;
      }
      setStatusMessage(`Fetching remote worksheets for preset "${activePreset.name}" from: ${cleanSheetId}...`);
      
      const schemas = ModulePresetRegistry.getSchemasForPreset(selectedPresetId, true);
      let fetchedCount = 0;
      const remoteData: RawMultiTabData = {};

      for (const schema of schemas) {
        if (schema.schemaId === 'instructions') continue;
        const rows = await syncService.fetchRemoteWorksheet(cleanSheetId, schema.canonicalTabName);
        if (rows && rows.length > 0) {
          remoteData[schema.canonicalTabName] = rows;
          fetchedCount++;
        }
      }

      if (fetchedCount === 0) {
        setStatusMessage(`Error: No rows could be retrieved from Google Sheet "${cleanSheetId}". Please verify the Sheet ID and sharing permissions.`);
        setIsProcessing(false);
        return;
      }

      setStatusMessage(`Successfully fetched ${fetchedCount} live worksheets from ${cleanSheetId}. Running schema validation...`);
      dataToValidate = remoteData;
      setStagedData(dataToValidate);
    }

    // Inspect workbook against preset
    const inspection = syncService.inspectWorkbookAgainstPreset(dataToValidate, selectedPresetId);
    setInspectionReport(inspection);

    // Run deep hierarchical validation
    const report = syncService.validateHierarchicalDataForPreset(dataToValidate, selectedPresetId);
    setValidationReport(report);
    setIsProcessing(false);
    setCurrentStep(2);
  };

  // ----------------------------------------------------
  // STEP 2 -> STEP 3: GENERATE PREVIEW DIFF
  // ----------------------------------------------------
  const handleProceedToPreview = () => {
    setIsProcessing(true);
    setStatusMessage('Calculating database diffs and transformations for preset...');
    const diffs = syncService.generateSyncPreviewForPreset(stagedData, selectedPresetId);
    setPreviewDiffs(diffs);

    const schemas = ModulePresetRegistry.getSchemasForPreset(selectedPresetId, false);
    if (schemas.length > 0) {
      setActivePreviewTab(schemas[0].canonicalTabName);
    }
    setIsProcessing(false);
    setCurrentStep(3);
  };

  // ----------------------------------------------------
  // STEP 3 -> STEP 4: EXECUTE SAFE COMMIT TO FIREBASE
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

    addLog(`Initiating Dynamic Preset Sync: "${activePreset.name}" (${activePreset.schemaVersion})`);
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

    try {
      addLog(`Validating canonical schemas and foreign key references for preset "${activePreset.name}"...`);
      
      const report = await syncService.commitPresetSync(
        stagedData,
        selectedPresetId,
        currentUser || null,
        cleanSheetId || config.masterSpreadsheetId || 'MASTER_PRESET_SYNC',
        config.spreadsheetName || 'Master Inventory & Tariff Sheet'
      );

      setLatestReport(report);
      loadSyncHistory();

      addLog(`Preset Synchronization completed with status: ${report.status}`);
      addLog(`Total Records Processed: ${report.totalRecords} (+${report.createdTotal} created, ~${report.updatedTotal} updated, =${report.unchangedTotal} unchanged).`);
      addLog('All system counters, caches, and configurator routes updated successfully.');

      setCurrentStep(4);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      addLog(`CRITICAL ERROR during preset synchronization: ${err?.message || 'Unexpected failure'}`);
      setStatusMessage(`Sync execution failed: ${err?.message || 'Unknown error'}`);
    } finally {
      if (lockAcquired) {
        try {
          await fetch('/api/integrations/sheets/release-lock', { method: 'POST' });
          addLog('Master concurrency lock released.');
        } catch (e) {}
      }
      setIsProcessing(false);
    }
  };

  // Helper: Download Template
  const handleDownloadTemplate = (presetId: DynamicModulePresetId, includeDemo: boolean) => {
    const blob = DynamicTemplateGenerator.generateWorkbookForPreset(presetId, includeDemo);
    const suffix = includeDemo ? 'demo_data' : 'blank_template';
    DynamicTemplateGenerator.downloadBlob(blob, `theunbound_${presetId}_${suffix}.xlsx`);
  };

  const handleDownloadSingleSchemaCsv = (schemaId: string, includeDemo: boolean) => {
    const csv = DynamicTemplateGenerator.generateCsvForSchema(schemaId, includeDemo);
    const suffix = includeDemo ? 'demo_data' : 'template';
    DynamicTemplateGenerator.downloadCsv(csv, `${schemaId}_${suffix}.csv`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ---------------------------------------------------- */}
      {/* MASTER SYNC HEADER & SUB-NAVIGATION */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-[#008972] shadow-2xs">
                <FileSpreadsheet className="w-6 h-6 text-[#00C6A6]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Google Sheets ↔ Firebase Master Sync</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-[#008972] border border-teal-200/60">
                    Schema-Driven Presets
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  Dynamic module presets, canonical schema mapping, relationship validation, and safe upserts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setManagerView('IMPORTER')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                managerView === 'IMPORTER'
                  ? 'bg-[#00C6A6] text-slate-950 font-bold shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Zap className="w-4 h-4" />
              Master Sync Wizard
            </button>
            <button
              onClick={() => setManagerView('TEMPLATES')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                managerView === 'TEMPLATES'
                  ? 'bg-[#00C6A6] text-slate-950 font-bold shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Download className="w-4 h-4" />
              Dynamic Templates
            </button>
            <button
              onClick={() => setManagerView('CONNECTION_HEALTH')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                managerView === 'CONNECTION_HEALTH'
                  ? 'bg-[#00C6A6] text-slate-950 font-bold shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              Connection Health
            </button>
            <button
              onClick={() => setManagerView('HISTORY')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                managerView === 'HISTORY'
                  ? 'bg-[#00C6A6] text-slate-950 font-bold shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              Sync History ({syncHistory.length})
            </button>
          </div>
        </div>

        {healthStatusNotice && (
          <div className="mt-4 p-3 rounded-xl bg-teal-50 border border-teal-200 text-[#008972] text-xs flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#00C6A6]" />
              {healthStatusNotice}
            </span>
            <button onClick={() => setHealthStatusNotice(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. MASTER SYNC WIZARD (IMPORTER) */}
      {/* ---------------------------------------------------- */}
      {managerView === 'IMPORTER' && (
        <div className="space-y-6">
          {/* STEP INDICATOR BAR */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
              <div className={`p-3 rounded-xl border transition-all ${
                currentStep === 1 
                  ? 'bg-teal-50/80 border-teal-200 text-[#008972]' 
                  : currentStep > 1 
                  ? 'bg-[#F8FAFA] border-slate-200 text-[#008972]' 
                  : 'bg-[#F8FAFA] border-slate-200/80 text-slate-400'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    currentStep > 1 ? 'bg-[#00C6A6] text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {currentStep > 1 ? '✓' : '1'}
                  </span>
                  <span>1. Preset & Discovery</span>
                </div>
              </div>

              <div className={`p-3 rounded-xl border transition-all ${
                currentStep === 2 
                  ? 'bg-teal-50/80 border-teal-200 text-[#008972]' 
                  : currentStep > 2 
                  ? 'bg-[#F8FAFA] border-slate-200 text-[#008972]' 
                  : 'bg-[#F8FAFA] border-slate-200/80 text-slate-400'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    currentStep > 2 ? 'bg-[#00C6A6] text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {currentStep > 2 ? '✓' : '2'}
                  </span>
                  <span>2. Schema Validation</span>
                </div>
              </div>

              <div className={`p-3 rounded-xl border transition-all ${
                currentStep === 3 
                  ? 'bg-teal-50/80 border-teal-200 text-[#008972]' 
                  : currentStep > 3 
                  ? 'bg-[#F8FAFA] border-slate-200 text-[#008972]' 
                  : 'bg-[#F8FAFA] border-slate-200/80 text-slate-400'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    currentStep > 3 ? 'bg-[#00C6A6] text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {currentStep > 3 ? '✓' : '3'}
                  </span>
                  <span>3. Diff Preview</span>
                </div>
              </div>

              <div className={`p-3 rounded-xl border transition-all ${
                currentStep === 4 
                  ? 'bg-teal-50/80 border-teal-200 text-[#008972]' 
                  : 'bg-[#F8FAFA] border-slate-200/80 text-slate-400'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    currentStep === 4 ? 'bg-[#00C6A6] text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                  }`}>
                    4
                  </span>
                  <span>4. Safe Commit</span>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 1: PRESET SELECTION & DISCOVERY */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* 1. MODULE PRESET SELECTOR CARDS */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[#008972]" />
                      Select Module Preset
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose which inventory or tariff module you want to synchronize. The schema, required worksheets, and relationships adapt dynamically.
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 bg-[#F8FAFA] px-3 py-1 rounded-lg border border-slate-200 font-semibold">
                    5 Authoritative Presets
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {availablePresets.map(preset => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          if (inputMode === 'CANONICAL_DATASET') {
                            handleLoadCanonicalDatasetForPreset(preset.id);
                          }
                        }}
                        className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50/50 border-[#00C6A6] ring-2 ring-[#00C6A6]/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                              {preset.badgeText}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-[#00C6A6]" />
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900">{preset.name}</h3>
                          <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed">
                            {preset.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{preset.schemaVersion}</span>
                          <span className="text-[#008972] font-semibold">{preset.requiredSchemaIds.length} Required Tab{preset.requiredSchemaIds.length > 1 ? 's' : ''}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. DATA INPUT SOURCE */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Database className="w-5 h-5 text-[#008972]" />
                      Workbook Source & Discovery
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Fetch remote Google Sheets via backend proxy, upload a local Excel workbook, paste CSV, or test with canonical sample dataset.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-[#F8FAFA] p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setInputMode('GOOGLE_SHEET')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        inputMode === 'GOOGLE_SHEET' ? 'bg-[#00C6A6] text-slate-950 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Google Sheet URL / ID
                    </button>
                    <button
                      onClick={() => setInputMode('FILE_UPLOAD')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        inputMode === 'FILE_UPLOAD' ? 'bg-[#00C6A6] text-slate-950 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Upload File (.xlsx)
                    </button>
                    <button
                      onClick={() => setInputMode('MANUAL_CSV')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        inputMode === 'MANUAL_CSV' ? 'bg-[#00C6A6] text-slate-950 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Paste CSV
                    </button>
                    <button
                      onClick={() => handleLoadCanonicalDatasetForPreset(selectedPresetId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        inputMode === 'CANONICAL_DATASET' ? 'bg-[#00C6A6] text-slate-950 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Load Demo Dataset
                    </button>
                  </div>
                </div>

                {/* GOOGLE SHEETS URL INPUT */}
                {inputMode === 'GOOGLE_SHEET' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Target Google Spreadsheet URL or Key
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={sheetInput}
                          onChange={(e) => setSheetInput(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/1C8I2TOnc_7_u07_G_Pz705yGg4Y6U5BPyY4t-rG9Hzo/edit"
                          className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00C6A6] focus:ring-1 focus:ring-[#00C6A6] font-mono"
                        />
                        <button
                          onClick={handleSaveMasterSheetConfig}
                          disabled={isSavingConfig}
                          className="px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-2 cursor-pointer shadow-2xs"
                        >
                          <Save className="w-4 h-4 text-[#008972]" />
                          {isSavingConfig ? 'Saving...' : 'Save Default'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Resolved Spreadsheet ID: <span className="font-mono text-[#008972] font-semibold">{cleanSheetId || 'Not configured'}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* FILE UPLOAD INPUT */}
                {inputMode === 'FILE_UPLOAD' && (
                  <div className="space-y-4">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Upload Local Excel Spreadsheet (.xlsx, .xls)
                    </label>
                    <div className="border-2 border-dashed border-slate-200 hover:border-[#00C6A6] rounded-2xl p-8 text-center transition-all bg-[#F8FAFA]">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="sheet-file-upload-input"
                      />
                      <label htmlFor="sheet-file-upload-input" className="cursor-pointer space-y-3 block">
                        <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#008972] flex items-center justify-center mx-auto border border-teal-200">
                          <Upload className="w-6 h-6 text-[#00C6A6]" />
                        </div>
                        <div className="text-sm font-semibold text-slate-900">
                          Click to browse or drop your Excel workbook here
                        </div>
                        <p className="text-xs text-slate-500">
                          Supports multi-tab workbooks formatted for "{activePreset.name}".
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {/* MANUAL CSV PASTE */}
                {inputMode === 'MANUAL_CSV' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Direct CSV Raw Text Input
                      </label>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">Target Schema Tab:</span>
                        <select
                          value={manualCsvTabTarget}
                          onChange={(e) => setManualCsvTabTarget(e.target.value)}
                          className="bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#00C6A6]"
                        >
                          {ModulePresetRegistry.getSchemasForPreset(selectedPresetId, true).map(s => (
                            <option key={s.schemaId} value={s.canonicalTabName}>{s.canonicalTabName} ({s.displayName})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <textarea
                      value={manualCsvText}
                      onChange={(e) => setManualCsvText(e.target.value)}
                      placeholder="product_id,product_code,product_name,category,region_id,destination_id,hub_id,supplier_id,native_currency,supplier_nett,margin_type,b2b_margin_value,status&#10;PROD-001,PRD-TYO-001,Tokyo Private Tour,Private Tour,REG-001,DST-JPN,HUB-TOKYO,SUP001,JPY,66000,PERCENTAGE,15,ACTIVE"
                      rows={6}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-[#00C6A6]"
                    />
                    <button
                      onClick={handleApplyManualCsv}
                      className="px-4 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      Parse & Apply to Staged Data
                    </button>
                  </div>
                )}

                {/* CANONICAL DATASET ACTIVE NOTIFICATION */}
                {inputMode === 'CANONICAL_DATASET' && (
                  <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-[#008972] text-xs flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#00C6A6]" />
                      Official canonical demo dataset loaded for <strong>{activePreset.name}</strong> ({Object.keys(stagedData).length} worksheets staged).
                    </span>
                    <button
                      onClick={() => handleDownloadTemplate(selectedPresetId, true)}
                      className="px-3 py-1 bg-[#00C6A6] text-slate-950 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Workbook (.xlsx)
                    </button>
                  </div>
                )}

                {/* 3. DYNAMIC PRESET WORKBOOK INSPECTION RESULTS */}
                {inspectionReport && (
                  <div className="mt-6 border border-slate-200 rounded-xl p-5 bg-[#F8FAFA] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${
                          inspectionReport.isValid ? 'bg-emerald-500 shadow-xs' : 'bg-amber-500 shadow-xs'
                        }`} />
                        <h3 className="text-sm font-bold text-slate-900">
                          Workbook Discovery & Schema Matching Report
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-mono">
                          Preset: {inspectionReport.presetName} ({inspectionReport.schemaVersion})
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        inspectionReport.isValid 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {inspectionReport.isValid ? 'SCHEMA PASSED' : 'SCHEMA REVIEW REQUIRED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block mb-1">Required Tabs</span>
                        <span className="font-bold text-slate-900">{inspectionReport.requiredTabs.length}</span>
                        <div className="text-[10px] text-slate-400 truncate mt-1">
                          {inspectionReport.requiredTabs.join(', ')}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block mb-1">Found Canonical Tabs</span>
                        <span className="font-bold text-[#008972]">{inspectionReport.foundTabs.length}</span>
                        <div className="text-[10px] text-emerald-600 truncate mt-1">
                          {inspectionReport.foundTabs.join(', ') || 'None'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block mb-1">Missing Required Tabs</span>
                        <span className={`font-bold ${inspectionReport.missingTabs.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {inspectionReport.missingTabs.length}
                        </span>
                        <div className="text-[10px] text-rose-500 truncate mt-1">
                          {inspectionReport.missingTabs.join(', ') || 'None (All present)'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block mb-1">Unexpected Worksheets</span>
                        <span className="font-bold text-slate-700">{inspectionReport.unexpectedTabs.length}</span>
                        <div className="text-[10px] text-slate-400 truncate mt-1">
                          {inspectionReport.unexpectedTabs.join(', ') || 'None'}
                        </div>
                      </div>
                    </div>

                    {/* MATCHED SCHEMAS COLUMN BREAKDOWN */}
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Matched Worksheets & Column Status
                      </h4>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                        {inspectionReport.matchedSchemas.map((m) => (
                          <div key={m.schemaId} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{m.matchedSheetName}</span>
                                <span className="text-[10px] text-slate-500 font-mono">→ {m.canonicalTabName}</span>
                                <span className="text-[10px] text-[#008972] font-semibold">({m.totalRows} data rows)</span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Discovered {m.discoveredColumns.length} columns: {m.discoveredColumns.slice(0, 6).join(', ')}{m.discoveredColumns.length > 6 ? ` (+${m.discoveredColumns.length - 6} more)` : ''}
                              </div>
                            </div>

                            <div>
                              {m.status === 'READY' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              )}
                              {m.status === 'WARNING' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Notice
                                </span>
                              )}
                              {m.status === 'BLOCKED' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Missing Required Columns
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* WIZARD ACTIONS */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    Preset: <strong className="text-slate-800">{activePreset.name}</strong> • Mode: <strong className="text-[#008972]">{inputMode}</strong>
                  </div>

                  <button
                    onClick={handleProceedToValidation}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold rounded-xl text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Fetching & Validating...
                      </>
                    ) : (
                      <>
                        Validate Schema & Relationships
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SCHEMA & RELATIONSHIP VALIDATION */}
          {currentStep === 2 && validationReport && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-[#008972]" />
                        Validation Results for {activePreset.name}
                      </h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        validationReport.isValid 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {validationReport.isValid ? 'ALL VALIDATIONS PASSED' : `${validationReport.errors.length} ISSUES DETECTED`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Verified data types, required fields, and relational foreign keys against database state.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      ← Back to Setup
                    </button>
                    <button
                      onClick={handleProceedToPreview}
                      disabled={isProcessing}
                      className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      Continue to Diff Preview →
                    </button>
                  </div>
                </div>

                {/* SUMMARY STATS GRID */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">Total Staged Records</span>
                    <span className="text-2xl font-bold text-slate-900">{validationReport.totalRows}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">Valid Records</span>
                    <span className="text-2xl font-bold text-[#008972]">{validationReport.validRows}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">Errors</span>
                    <span className={`text-2xl font-bold ${validationReport.errorRows > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {validationReport.errorRows}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">Active Schema Tabs</span>
                    <span className="text-2xl font-bold text-[#008972]">{Object.keys(validationReport.tabSummaries).length}</span>
                  </div>
                </div>

                {/* DETAILED ERRORS TABLE */}
                {validationReport.errors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Detailed Issues List ({validationReport.errors.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setValidationFilter('ALL')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            validationFilter === 'ALL' ? 'bg-teal-50 text-[#008972] border border-teal-200' : 'text-slate-500 hover:text-slate-900 bg-white border border-slate-200'
                          }`}
                        >
                          All ({validationReport.errors.length})
                        </button>
                        <button
                          onClick={() => setValidationFilter('CRITICAL')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            validationFilter === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-slate-500 hover:text-slate-900 bg-white border border-slate-200'
                          }`}
                        >
                          Critical ({validationReport.errors.filter(e => e.severity === 'CRITICAL').length})
                        </button>
                        <button
                          onClick={() => setValidationFilter('WARNING')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            validationFilter === 'WARNING' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-slate-500 hover:text-slate-900 bg-white border border-slate-200'
                          }`}
                        >
                          Warnings ({validationReport.errors.filter(e => e.severity === 'WARNING').length})
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                      {validationReport.errors
                        .filter(e => validationFilter === 'ALL' || e.severity === validationFilter)
                        .map((err, idx) => (
                          <div key={idx} className="p-3 text-xs flex items-start gap-3 hover:bg-slate-50/80">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              err.severity === 'CRITICAL' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {err.severity}
                            </span>
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 font-mono">
                                <span className="font-bold text-slate-900">{err.tabName}</span>
                                <span className="text-slate-400">Row {err.rowNumber}</span>
                                {err.recordId && <span className="text-[#008972] font-semibold">ID: {err.recordId}</span>}
                                <span className="text-slate-500 font-semibold">[{err.field}]</span>
                              </div>
                              <p className="text-slate-700">{err.error}</p>
                              {err.suggestedFix && (
                                <p className="text-[11px] text-[#008972] font-mono">
                                  Suggested Fix: {err.suggestedFix}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: DIFF PREVIEW MATRIX */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-[#008972]" />
                      Database Diff & Transformation Matrix
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review records to be created, updated, or left unchanged before executing atomic commit.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      ← Back to Validation
                    </button>
                    <button
                      onClick={handleExecuteCommit}
                      disabled={isProcessing}
                      className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      {isProcessing ? 'Executing Commit...' : 'Execute Safe Commit to Firebase →'}
                    </button>
                  </div>
                </div>

                {/* TAB SWITCHER FOR DIFFS */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {Object.keys(previewDiffs).map(tabKey => {
                    const diff = previewDiffs[tabKey];
                    const isActive = activePreviewTab === tabKey;
                    return (
                      <button
                        key={tabKey}
                        onClick={() => setActivePreviewTab(tabKey)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 border cursor-pointer ${
                          isActive
                            ? 'bg-teal-50 border-[#00C6A6] text-[#008972] font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span>{tabKey}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          isActive ? 'bg-white text-[#008972] border border-teal-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          +{diff.createdCount} ~{diff.updatedCount} ={diff.unchangedCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ACTIVE TAB DIFF ITEMS */}
                {previewDiffs[activePreviewTab] && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                        <span className="block text-[11px] uppercase tracking-wider text-emerald-600 font-bold">To Create</span>
                        <span className="text-xl font-bold">{previewDiffs[activePreviewTab].createdCount}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
                        <span className="block text-[11px] uppercase tracking-wider text-blue-600 font-bold">To Update</span>
                        <span className="text-xl font-bold">{previewDiffs[activePreviewTab].updatedCount}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F8FAFA] border border-slate-200 text-slate-600">
                        <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold">Unchanged</span>
                        <span className="text-xl font-bold">{previewDiffs[activePreviewTab].unchangedCount}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
                        <span className="block text-[11px] uppercase tracking-wider text-rose-600 font-bold">Blocked / Error</span>
                        <span className="text-xl font-bold">{previewDiffs[activePreviewTab].errorCount}</span>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white max-h-96 overflow-y-auto">
                      {previewDiffs[activePreviewTab].items.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          No items to preview for this worksheet.
                        </div>
                      ) : (
                        previewDiffs[activePreviewTab].items.map((item, idx) => (
                          <div key={idx} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50/80">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  item.action === 'UPDATE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  item.action === 'BLOCKED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  {item.action}
                                </span>
                                <span className="font-bold text-slate-900 font-mono">{item.id}</span>
                                <span className="text-slate-700">{item.title}</span>
                              </div>
                              {item.changedFields && item.changedFields.length > 0 && (
                                <div className="text-[11px] text-blue-600 font-mono">
                                  Changed fields: {item.changedFields.join(', ')}
                                </div>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">{item.details}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: SAFE COMMIT & RESULTS */}
          {currentStep === 4 && latestReport && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="text-center py-6 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Master Synchronization Complete!
                  </h2>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Preset <strong>{latestReport.presetName || activePreset.name}</strong> successfully synchronized into local database & Firestore in {latestReport.durationMs}ms.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">Total Processed</span>
                    <span className="text-2xl font-bold text-slate-900">{latestReport.totalRecords}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-xs text-emerald-700 block mb-1 font-bold">Created Records</span>
                    <span className="text-2xl font-bold text-emerald-700">+{latestReport.createdTotal}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-xs text-blue-700 block mb-1 font-bold">Updated Records</span>
                    <span className="text-2xl font-bold text-blue-700">~{latestReport.updatedTotal}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1 font-bold">Unchanged</span>
                    <span className="text-2xl font-bold text-slate-700">={latestReport.unchangedTotal}</span>
                  </div>
                </div>

                {/* EXECUTION LOGS */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Real-Time Execution Logs
                  </h3>
                  <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200 font-mono text-xs text-slate-700 space-y-1.5 max-h-64 overflow-y-auto">
                    {latestReport.logs.map((log, i) => (
                      <div key={i} className="leading-relaxed">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setCurrentStep(1);
                      setStagedData({});
                      setInspectionReport(null);
                      setValidationReport(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    Start New Sync Job
                  </button>

                  <button
                    onClick={() => setManagerView('HISTORY')}
                    className="px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                  >
                    View in Audit History →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. DYNAMIC TEMPLATES & SCHEMA REGISTRY EXPLORER */}
      {/* ---------------------------------------------------- */}
      {managerView === 'TEMPLATES' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Download className="w-5 h-5 text-[#008972]" />
                  Dynamic Schema & Template Generator
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download authentic, schema-validated Google Sheets & Excel templates for any module preset.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDemoDataInTemplate}
                    onChange={(e) => setIncludeDemoDataInTemplate(e.target.checked)}
                    className="rounded border-slate-300 text-[#00C6A6] focus:ring-[#00C6A6]"
                  />
                  <span>Include Demo Rows (DEMO ONLY)</span>
                </label>

                <button
                  onClick={() => handleDownloadTemplate(selectedSchemaPreset, includeDemoDataInTemplate)}
                  className="px-4 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Preset Workbook (.xlsx)
                </button>
              </div>
            </div>

            {/* PRESET SELECTOR FOR TEMPLATES */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {availablePresets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedSchemaPreset(preset.id);
                    const schemas = ModulePresetRegistry.getSchemasForPreset(preset.id, true);
                    if (schemas.length > 0) {
                      setSelectedSchemaTab(schemas[0].schemaId);
                    }
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    selectedSchemaPreset === preset.id
                      ? 'bg-teal-50 border-[#00C6A6] text-[#008972] font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[10px] text-[#008972] uppercase font-bold">{preset.badgeText}</div>
                  <div className="truncate mt-0.5 font-semibold text-slate-900">{preset.name}</div>
                </button>
              ))}
            </div>

            {/* SCHEMA SPECIFICATION VIEWER */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* SCHEMA TABS LIST */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Worksheets in this Preset
                </h3>
                <div className="space-y-1.5">
                  {ModulePresetRegistry.getSchemasForPreset(selectedSchemaPreset, true).map(schema => {
                    const isSelected = selectedSchemaTab === schema.schemaId;
                    return (
                      <button
                        key={schema.schemaId}
                        onClick={() => setSelectedSchemaTab(schema.schemaId)}
                        className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50 border-teal-200/90 text-[#008972] font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-mono text-slate-900 font-bold">{schema.canonicalTabName}</div>
                          <div className="text-[11px] text-slate-500 truncate">{schema.displayName}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ACTIVE SCHEMA DETAILS */}
              <div className="lg:col-span-3 space-y-4">
                {(() => {
                  const schema = CanonicalSchemaRegistry.getSchema(selectedSchemaTab) || CanonicalSchemaRegistry.getAllSchemas()[0];
                  if (!schema) return null;
                  return (
                    <div className="border border-slate-200 rounded-xl p-5 bg-[#F8FAFA] space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 font-mono">{schema.canonicalTabName}</h3>
                            <span className="text-xs px-2 py-0.5 rounded bg-white text-[#008972] border border-slate-200 font-mono font-bold">
                              {schema.schemaVersion}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{schema.description}</p>
                        </div>

                        <button
                          onClick={() => handleDownloadSingleSchemaCsv(schema.schemaId, includeDemoDataInTemplate)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-[#008972]" />
                          Download CSV
                        </button>
                      </div>

                      {/* COLUMNS TABLE */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Canonical Column Definitions ({schema.columns.length} columns)
                        </h4>
                        <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="p-2.5 font-semibold">Column Key</th>
                                <th className="p-2.5 font-semibold">Type</th>
                                <th className="p-2.5 font-semibold">Required</th>
                                <th className="p-2.5 font-semibold">Sample Value</th>
                                <th className="p-2.5 font-semibold">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {schema.columns.map((col, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="p-2.5 font-bold text-slate-900">{col.key}</td>
                                  <td className="p-2.5 text-[#008972] font-semibold">{col.type}</td>
                                  <td className="p-2.5">
                                    {col.required ? (
                                      <span className="text-rose-600 font-bold">YES</span>
                                    ) : (
                                      <span className="text-slate-400">OPTIONAL</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-slate-600 max-w-xs truncate">{col.sampleValue}</td>
                                  <td className="p-2.5 font-sans text-slate-500">{col.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. CONNECTION HEALTH & SETTINGS */}
      {/* ---------------------------------------------------- */}
      {managerView === 'CONNECTION_HEALTH' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#008972]" />
                  Google Sheets Connection Health & Webhooks
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify backend API connectivity, token status, and Apps Script real-time sync hooks.
                </p>
              </div>

              <button
                onClick={handleTestConnectionProbe}
                disabled={isTestingProbe}
                className="px-4 py-2 bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingProbe ? 'animate-spin' : ''}`} />
                {isTestingProbe ? 'Probing Gateway...' : 'Test Connection Probe'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200 space-y-1">
                <span className="text-xs text-slate-500 block">Connection Status</span>
                <span className={`text-lg font-bold ${config.connectionStatus === 'CONNECTED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {config.connectionStatus}
                </span>
                <p className="text-[11px] text-slate-400">
                  Last checked: {config.lastSuccessfulConnectionCheck ? new Date(config.lastSuccessfulConnectionCheck).toLocaleString() : 'Never'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200 space-y-1">
                <span className="text-xs text-slate-500 block">Master Spreadsheet ID</span>
                <span className="text-sm font-bold text-slate-900 font-mono truncate block">
                  {config.masterSpreadsheetId || 'None'}
                </span>
                <p className="text-[11px] text-slate-400">
                  {config.spreadsheetName || 'Master Rate Sheet'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFA] border border-slate-200 space-y-1">
                <span className="text-xs text-slate-500 block">Sync History Total</span>
                <span className="text-lg font-bold text-[#008972]">
                  {syncHistory.length} Jobs
                </span>
                <p className="text-[11px] text-slate-400">
                  Total safe upserts logged
                </p>
              </div>
            </div>

            {testProbeResult && (
              <div className="border border-slate-200 rounded-xl p-4 bg-[#F8FAFA] space-y-2">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Probe Diagnostic Output
                </h3>
                <pre className="p-3 rounded-lg bg-white border border-slate-200 text-xs font-mono text-[#008972] overflow-x-auto">
                  {JSON.stringify(testProbeResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. SYNC HISTORY & AUDIT LOGS */}
      {/* ---------------------------------------------------- */}
      {managerView === 'HISTORY' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-[#008972]" />
                  Master Synchronization Audit Trail
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete historical record of schema synchronizations, created/updated records, and duration.
                </p>
              </div>
              <span className="text-xs text-slate-600 bg-[#F8FAFA] px-3 py-1 rounded-lg border border-slate-200 font-semibold">
                {syncHistory.length} Total Executions
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {syncHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No synchronization runs recorded yet.
                </div>
              ) : (
                syncHistory.map((report) => (
                  <div key={report.id} className="p-4 space-y-2 hover:bg-slate-50/80 transition-all">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          report.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {report.status}
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          {report.presetName || report.presetId || 'Canonical Sync'}
                        </span>
                        <span className="text-slate-400">• {new Date(report.timestamp).toLocaleString()}</span>
                      </div>

                      <span className="text-slate-500 font-mono text-[11px]">
                        {report.durationMs}ms
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="text-emerald-700 font-bold">+{report.createdTotal} Created</span>
                      <span className="text-blue-700 font-bold">~{report.updatedTotal} Updated</span>
                      <span className="text-slate-500">={report.unchangedTotal} Unchanged</span>
                      <span className="text-slate-400">Processed {report.tabsProcessed.length} Tabs: [{report.tabsProcessed.join(', ')}]</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleSheetsPanel;
