import React, { useState, useEffect } from 'react';
import { SheetsSyncService, RawMultiTabData } from '../../services/sheetsSyncService';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { 
  MasterSheetTabName, 
  HierarchicalValidationReport, 
  SheetTabValidationSummary,
  SyncPreviewTabDiff, 
  MultiTabSyncReport, 
  SheetValidationError 
} from '../../types';
import { 
  MASTER_SHEETS_TAB_DEFINITIONS, 
  generateSampleCsv, 
  generateAllTabsCsvBundle,
  getTabSchemaByName 
} from '../../data/googleSheetsTemplate';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  History, 
  Database, 
  Settings,
  Layers,
  ArrowRight,
  Download,
  Upload,
  Hotel as HotelIcon,
  Package,
  FileText,
  Globe,
  MapPin,
  Compass,
  DollarSign,
  Car,
  FileCheck2,
  HelpCircle,
  Eye,
  Check,
  X,
  Sparkles,
  Info,
  ChevronRight,
  ChevronDown,
  Copy,
  ExternalLink,
  ShieldAlert,
  ArrowDownRight
} from 'lucide-react';

export const GoogleSheetsSyncManager: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const syncService = SheetsSyncService.getInstance();

  // Top-level Navigation View
  const [managerView, setManagerView] = useState<'IMPORTER' | 'SELECTIVE_SYNC' | 'TEMPLATES' | 'HISTORY'>('IMPORTER');

  // Importer Step State (1: Connect, 2: Validate, 3: Preview, 4: Commit)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Configuration & Data Source State
  const [sheetId, setSheetId] = useState('');
  const [selectedTabs, setSelectedTabs] = useState<MasterSheetTabName[]>([
    'REGIONS',
    'DESTINATIONS',
    'HUBS',
    'PRODUCTS',
    'PRODUCT_PRICING',
    'PRODUCT_CAPACITY',
    'HOTELS',
    'HOTEL_ROOMS',
    'HOTEL_MEAL_PLANS',
    'HOTEL_RATES',
    'VISA',
    'VISA_RATES',
    'TRANSFER_ROUTES',
    'TRANSFER_RATES',
    'PACKAGES',
    'PACKAGE_ITEMS'
  ]);
  const [inputMode, setInputMode] = useState<'GOOGLE_SHEET' | 'SAMPLE_DATA'>('GOOGLE_SHEET');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Loaded Raw Multi-Tab Data
  const [stagedData, setStagedData] = useState<RawMultiTabData>({});

  // Validation & Preview Results
  const [validationReport, setValidationReport] = useState<HierarchicalValidationReport | null>(null);
  const [previewDiffs, setPreviewDiffs] = useState<Record<string, SyncPreviewTabDiff> | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<string>('PRODUCTS');
  const [activeValidationFilter, setActiveValidationFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

  // Execution & Sync Reports
  const [syncHistory, setSyncHistory] = useState<MultiTabSyncReport[]>([]);
  const [latestReport, setLatestReport] = useState<MultiTabSyncReport | null>(null);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<MultiTabSyncReport | null>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    loadSyncHistory();
    // Default load sample data for instant readiness
    loadMasterSampleData();
  }, []);

  const loadSyncHistory = () => {
    const history = db.getMultiTabSyncReports();
    setSyncHistory(history);
  };

  // 1-Click Load Official Master Template Data
  const loadMasterSampleData = () => {
    const bundle: RawMultiTabData = {};
    for (const def of MASTER_SHEETS_TAB_DEFINITIONS) {
      if (def.tabName === 'INSTRUCTIONS') continue;
      const rows = [
        def.columns.map(c => c.name),
        ...def.sampleRows
      ];
      bundle[def.tabName] = rows;
    }
    setStagedData(bundle);
    setStatusMessage('Loaded official TheUnbound Master Multi-Tab Dataset (15 Tabs with Japan, UK, UAE, Thailand).');
  };

  // Handle Tab Selection Toggle
  const toggleTabSelection = (tabName: MasterSheetTabName) => {
    if (selectedTabs.includes(tabName)) {
      if (selectedTabs.length === 1) return; // keep at least 1
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

  // Step 1 -> Step 2: Validate Data
  const handleProceedToValidation = async () => {
    setIsProcessing(true);
    setStatusMessage('Preparing and standardizing spreadsheet tables for validation...');

    let dataToValidate: RawMultiTabData = { ...stagedData };

    if (inputMode === 'GOOGLE_SHEET') {
      if (!sheetId.trim()) {
        setStatusMessage('Please enter a valid Google Spreadsheet ID or Sheet URL.');
        setIsProcessing(false);
        return;
      }
      setStatusMessage(`Fetching remote worksheets via backend proxy for: ${sheetId}...`);
      let fetchedCount = 0;
      const remoteData: RawMultiTabData = {};
      for (const tab of selectedTabs) {
        const rows = await syncService.fetchRemoteWorksheet(sheetId.trim(), tab);
        if (rows && rows.length > 0) {
          remoteData[tab] = rows;
          fetchedCount++;
        }
      }
      if (fetchedCount === 0) {
        setStatusMessage(`Could not fetch data for spreadsheet "${sheetId}". Verify ID, permissions, and tab names.`);
        setIsProcessing(false);
        return;
      }
      dataToValidate = remoteData;
      setStagedData(dataToValidate);
    }

    // Run deep hierarchical validation
    const report = syncService.validateHierarchicalData(dataToValidate);
    setValidationReport(report);
    setIsProcessing(false);
    setCurrentStep(2);
  };

  // Step 2 -> Step 3: Generate Preview
  const handleProceedToPreview = () => {
    setIsProcessing(true);
    setStatusMessage('Calculating database diffs and field transformations...');
    const diffs = syncService.generateSyncPreview(stagedData, selectedTabs);
    setPreviewDiffs(diffs);
    // Default active tab to first tab in selected list
    if (selectedTabs.length > 0) {
      setActivePreviewTab(selectedTabs[0]);
    }
    setIsProcessing(false);
    setCurrentStep(3);
  };

  // Step 3 -> Step 4: Execute Atomic Commit
  const handleExecuteCommit = async () => {
    setIsProcessing(true);
    setStatusMessage('Acquiring master synchronization lock and verifying concurrency...');
    
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
      }
    } catch (e) {
      console.debug('Lock acquisition via backend proxy skipped or offline', e);
    }

    setStatusMessage('Committing validated records to database and synchronizing with Firestore...');
    try {
      const report = await syncService.commitMultiTabSync(
        stagedData, 
        selectedTabs, 
        user, 
        sheetId || 'THEUNBOUND_MASTER_SHEET'
      );
      setLatestReport(report);
      loadSyncHistory();
      setCurrentStep(4);
      setStatusMessage('Master synchronization completed successfully!');

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
    } catch (err: any) {
      setStatusMessage(`Sync error: ${err?.message || 'Unknown error during commit'}`);
      if (lockAcquired) {
        await fetch('/api/integrations/sheets/release-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: err?.message || 'Sync error during commit'
          })
        }).catch(e => console.debug('Failed to release server lock on error', e));
      }
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

  // Download All 15 Tabs as Consolidated CSV Bundle
  const handleDownloadAllTabs = () => {
    const bundle = generateAllTabsCsvBundle();
    let combinedText = `=== THEUNBOUND MASTER GOOGLE SHEETS TEMPLATE BUNDLE ===\n\n`;
    for (const [tab, csv] of Object.entries(bundle)) {
      combinedText += `\n#################################################################\n`;
      combinedText += `### TAB: ${tab}\n`;
      combinedText += `#################################################################\n\n`;
      combinedText += csv + `\n\n`;
    }
    const blob = new Blob([combinedText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `TheUnbound_Master_GoogleSheets_All_15_Tabs.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-[#008972]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">Master Google Sheets → Firebase Sync</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Strict 16-Tab Hierarchy
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                Scale and feed large volumes of Regions, Destinations, Hubs, Products, Hotels, Rates, Transfers, and Curated Packages from one master Google Spreadsheet into Firestore with strict referential validation and commercial pricing integrity.
              </p>
            </div>
          </div>

          {/* Top View Navigation Tabs */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0 overflow-x-auto">
            <button
              onClick={() => setManagerView('IMPORTER')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                managerView === 'IMPORTER'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#008972]" />
              <span>4-Step Importer</span>
            </button>

            <button
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
              onClick={() => setManagerView('TEMPLATES')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                managerView === 'TEMPLATES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>Templates & Schema</span>
            </button>

            <button
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

        {/* Visual Data Hierarchy Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tier 1: Macro</span>
            <div className="font-bold text-slate-800 flex items-center justify-center space-x-1">
              <Globe className="w-3 h-3 text-teal-600" />
              <span>REGIONS</span>
            </div>
            <span className="text-[10px] text-slate-500">REG-001 (East Asia)</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tier 2: Territory</span>
            <div className="font-bold text-slate-800 flex items-center justify-center space-x-1">
              <Compass className="w-3 h-3 text-indigo-600" />
              <span>DESTINATIONS</span>
            </div>
            <span className="text-[10px] text-slate-500">DST-JPN (Japan)</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tier 3: Gateway</span>
            <div className="font-bold text-slate-800 flex items-center justify-center space-x-1">
              <MapPin className="w-3 h-3 text-blue-600" />
              <span>HUBS / CITIES</span>
            </div>
            <span className="text-[10px] text-slate-500">HUB-TYO (Tokyo)</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tier 4: Core Entity</span>
            <div className="font-bold text-slate-800 flex items-center justify-center space-x-1">
              <HotelIcon className="w-3 h-3 text-amber-600" />
              <span>PRODUCTS & HOTELS</span>
            </div>
            <span className="text-[10px] text-slate-500">PRD-TYO, HTL-TYO</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tier 5: Commercial</span>
            <div className="font-bold text-slate-800 flex items-center justify-center space-x-1">
              <DollarSign className="w-3 h-3 text-emerald-600" />
              <span>RATES & TARIFFS</span>
            </div>
            <span className="text-[10px] text-slate-500">Net Tariffs & Windows</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tier 6: Curated</span>
            <div className="font-bold text-slate-800 flex items-center justify-center space-x-1">
              <Package className="w-3 h-3 text-purple-600" />
              <span>PACKAGES</span>
            </div>
            <span className="text-[10px] text-slate-500">Multi-Day Circuits</span>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* VIEW 1: 4-STEP MASTER IMPORTER */}
      {/* ========================================== */}
      {managerView === 'IMPORTER' && (
        <div className="space-y-6">
          {/* Step Progress Tracker */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className={`flex items-center space-x-2 text-xs font-bold transition-all ${
                  currentStep === 1 ? 'text-[#008972]' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === 1 ? 'bg-[#008972] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  1
                </div>
                <span>1. Connect & Select</span>
              </button>

              <ArrowRight className="w-4 h-4 text-slate-300" />

              <button
                onClick={() => validationReport && setCurrentStep(2)}
                disabled={!validationReport}
                className={`flex items-center space-x-2 text-xs font-bold transition-all ${
                  currentStep === 2 ? 'text-[#008972]' : (validationReport ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed')
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === 2 ? 'bg-[#008972] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  2
                </div>
                <span>2. Validate Hierarchy</span>
              </button>

              <ArrowRight className="w-4 h-4 text-slate-300" />

              <button
                onClick={() => previewDiffs && setCurrentStep(3)}
                disabled={!previewDiffs}
                className={`flex items-center space-x-2 text-xs font-bold transition-all ${
                  currentStep === 3 ? 'text-[#008972]' : (previewDiffs ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed')
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === 3 ? 'bg-[#008972] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  3
                </div>
                <span>3. Preview Diffs</span>
              </button>

              <ArrowRight className="w-4 h-4 text-slate-300" />

              <button
                onClick={() => latestReport && setCurrentStep(4)}
                disabled={!latestReport}
                className={`flex items-center space-x-2 text-xs font-bold transition-all ${
                  currentStep === 4 ? 'text-[#008972]' : (latestReport ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 cursor-not-allowed')
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === 4 ? 'bg-[#008972] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  4
                </div>
                <span>4. Commit & Sync</span>
              </button>
            </div>
          </div>

          {/* STEP 1: CONFIGURE & SELECT DATA */}
          {currentStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 1: Configure Spreadsheet Data Source</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connect a live Google Spreadsheet, upload CSVs, or load official Master Dataset samples.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadMasterSampleData}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-[#008972] text-xs font-bold hover:bg-teal-100 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Master Sample (16 Tabs)</span>
                  </button>
                </div>
              </div>

              {/* Data Input Mode Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => setInputMode('GOOGLE_SHEET')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    inputMode === 'GOOGLE_SHEET'
                      ? 'border-[#008972] bg-teal-50/50 ring-1 ring-[#008972]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-xs text-slate-900">Live Master Google Sheet</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Sync directly from Google Sheets v4 API via authenticated server proxy.
                  </p>
                </button>

                <button
                  onClick={() => setInputMode('SAMPLE_DATA')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    inputMode === 'SAMPLE_DATA'
                      ? 'border-[#008972] bg-teal-50/50 ring-1 ring-[#008972]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Sparkles className="w-4 h-4 text-[#008972]" />
                    <span className="font-bold text-xs text-slate-900">Master Dataset Simulation (16 Tabs)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Use full 16-tab pre-loaded dataset covering Japan, UK, France, Dubai, and Thailand.
                  </p>
                </button>
              </div>

              {/* Connected Google Sheet ID inputs */}
              {inputMode === 'GOOGLE_SHEET' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Google Spreadsheet ID or Full Share URL
                  </label>
                  <input
                    type="text"
                    value={sheetId}
                    onChange={e => setSheetId(e.target.value)}
                    placeholder="e.g. 1X9aBcD_TheUnbound_MasterRateSheet_2026 or full Google Docs URL"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-white focus:ring-2 focus:ring-[#008972] focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 flex items-center space-x-1">
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Spreadsheet must contain matching tab names: REGIONS, DESTINATIONS, HUBS, PRODUCTS, HOTELS, VISA, etc.</span>
                  </p>
                </div>
              )}

              {/* Tabs Included in Sync Checkbox Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Worksheets Included in Sync ({selectedTabs.length} of {MASTER_SHEETS_TAB_DEFINITIONS.length - 1} Selected)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={selectAllTabs}
                      className="text-xs text-[#008972] font-bold hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2">
                  {MASTER_SHEETS_TAB_DEFINITIONS.filter(t => t.tabName !== 'INSTRUCTIONS').map(tab => {
                    const isSelected = selectedTabs.includes(tab.tabName as MasterSheetTabName);
                    return (
                      <button
                        key={tab.tabName}
                        onClick={() => toggleTabSelection(tab.tabName as MasterSheetTabName)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'border-teal-300 bg-teal-50 text-teal-900 font-bold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="text-xs block truncate">{tab.tabName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">Tier {tab.hierarchyLevel}</span>
                        </div>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#008972] text-white' : 'border border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Action */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {statusMessage || 'Ready to analyze and validate spreadsheet integrity.'}
                </p>

                <button
                  onClick={handleProceedToValidation}
                  disabled={isProcessing}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007460] text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing & Validating...</span>
                    </>
                  ) : (
                    <>
                      <span>Validate Spreadsheet Integrity</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: VALIDATE HIERARCHY & PREVENT ERRORS */}
          {currentStep === 2 && validationReport && (
            <div className="space-y-6">
              {/* Hierarchy Health Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-4 rounded-2xl border ${
                  validationReport.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Hierarchy Status</span>
                    {validationReport.isValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-rose-600" />
                    )}
                  </div>
                  <span className={`text-xl font-bold font-mono mt-2 block ${
                    validationReport.isValid ? 'text-emerald-800' : 'text-rose-800'
                  }`}>
                    {validationReport.isValid ? '100% VALID' : `${validationReport.errorRows} ISSUES`}
                  </span>
                  <span className="text-[10px] text-slate-500">Referential integrity verified</span>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <span className="text-xs font-bold text-slate-700">Total Rows Verified</span>
                  <span className="text-xl font-bold font-mono text-slate-900 mt-2 block">
                    {validationReport.totalRows}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    {validationReport.validRows} compliant rows
                  </span>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <span className="text-xs font-bold text-slate-700">Orphan Entities</span>
                  <span className={`text-xl font-bold font-mono mt-2 block ${
                    (validationReport.hierarchyHealth.orphanDestinations + validationReport.hierarchyHealth.orphanHubs + validationReport.hierarchyHealth.orphanProducts + validationReport.hierarchyHealth.orphanHotels) > 0
                      ? 'text-rose-600'
                      : 'text-slate-900'
                  }`}>
                    {validationReport.hierarchyHealth.orphanDestinations + validationReport.hierarchyHealth.orphanHubs + validationReport.hierarchyHealth.orphanProducts + validationReport.hierarchyHealth.orphanHotels}
                  </span>
                  <span className="text-[10px] text-slate-500">Unlinked foreign keys</span>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <span className="text-xs font-bold text-slate-700">Commercial Rate Checks</span>
                  <span className="text-xl font-bold font-mono text-slate-900 mt-2 block">
                    {validationReport.hierarchyHealth.rateMismatches === 0 ? 'Verified' : `${validationReport.hierarchyHealth.rateMismatches} Errors`}
                  </span>
                  <span className="text-[10px] text-slate-500">Adult / child net rate formats</span>
                </div>
              </div>

              {/* Tab Summary Pills */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">Per-Worksheet Verification Summary</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActiveValidationFilter('ALL')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        activeValidationFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      All ({validationReport.errors.length})
                    </button>
                    <button
                      onClick={() => setActiveValidationFilter('CRITICAL')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        activeValidationFilter === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      Critical ({validationReport.errors.filter(e => e.severity === 'CRITICAL').length})
                    </button>
                    <button
                      onClick={() => setActiveValidationFilter('WARNING')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        activeValidationFilter === 'WARNING' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      Warnings ({validationReport.errors.filter(e => e.severity === 'WARNING').length})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {Object.entries(validationReport.tabSummaries).map(([tabKey, rawSummary]) => {
                    const summary = rawSummary as SheetTabValidationSummary;
                    return (
                    <div
                      key={tabKey}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        summary.status === 'VALID'
                          ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                          : summary.status === 'WARNING'
                          ? 'border-amber-200 bg-amber-50/40 text-amber-900'
                          : 'border-rose-200 bg-rose-50/40 text-rose-900'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-xs block">{tabKey}</span>
                        <span className="text-[10px] text-slate-500">
                          {summary.validRows}/{summary.totalRows} valid
                        </span>
                      </div>
                      {summary.status === 'VALID' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : summary.status === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                    </div>
                  );
                  })}
                </div>

                {/* Validation Errors Table if any exist */}
                {validationReport.errors.length > 0 ? (
                  <div className="mt-4 pt-4 border-t border-slate-100 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-bold text-slate-600">
                          <th className="p-2.5">Severity</th>
                          <th className="p-2.5">Tab Name</th>
                          <th className="p-2.5">Row</th>
                          <th className="p-2.5">Record ID</th>
                          <th className="p-2.5">Field</th>
                          <th className="p-2.5">Issue Description</th>
                          <th className="p-2.5">Suggested Fix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {validationReport.errors
                          .filter(e => activeValidationFilter === 'ALL' || e.severity === activeValidationFilter)
                          .map((err, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  err.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {err.severity}
                                </span>
                              </td>
                              <td className="p-2.5 font-bold text-slate-900">{err.tabName}</td>
                              <td className="p-2.5 text-slate-600">Row {err.rowNumber}</td>
                              <td className="p-2.5 font-bold text-slate-800">{err.recordId}</td>
                              <td className="p-2.5 text-indigo-700">{err.field}</td>
                              <td className="p-2.5 font-sans text-slate-700">{err.error}</td>
                              <td className="p-2.5 font-sans text-emerald-700">{err.suggestedFix}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All records and foreign keys passed validation with zero critical integrity errors.</span>
                  </div>
                )}
              </div>

              {/* Step 2 Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  ← Back to Configuration
                </button>

                <button
                  onClick={handleProceedToPreview}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007460] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <span>Proceed to Change Preview</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW DIFFS BEFORE COMMIT */}
          {currentStep === 3 && previewDiffs && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 3: Preview Database Modifications</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review entities to be created or updated in Firestore before committing.
                  </p>
                </div>

                <button
                  onClick={handleExecuteCommit}
                  disabled={isProcessing}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007460] text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Syncing with Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Commit & Apply All Changes</span>
                    </>
                  )}
                </button>
              </div>

              {/* Tab Selector for Preview */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-100">
                {Object.entries(previewDiffs).map(([tabKey, rawDiff]) => {
                  const diff = rawDiff as SyncPreviewTabDiff;
                  return (
                  <button
                    key={tabKey}
                    onClick={() => setActivePreviewTab(tabKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center space-x-2 ${
                      activePreviewTab === tabKey
                        ? 'bg-[#008972] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tabKey}</span>
                    <div className="flex items-center space-x-1 text-[10px]">
                      {diff.createdCount > 0 && (
                        <span className="bg-emerald-500 text-white px-1.5 py-0.2 rounded-full">+{diff.createdCount}</span>
                      )}
                      {diff.updatedCount > 0 && (
                        <span className="bg-blue-500 text-white px-1.5 py-0.2 rounded-full">~{diff.updatedCount}</span>
                      )}
                    </div>
                  </button>
                );
                })}
              </div>

              {/* Active Tab Preview List */}
              {previewDiffs[activePreviewTab] && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-3 text-center text-xs">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">New Records</span>
                      <span className="text-lg font-bold font-mono">+{previewDiffs[activePreviewTab].createdCount}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                      <span className="text-[10px] uppercase font-bold text-blue-700 block">Modified Records</span>
                      <span className="text-lg font-bold font-mono">~{previewDiffs[activePreviewTab].updatedCount}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Unchanged</span>
                      <span className="text-lg font-bold font-mono">={previewDiffs[activePreviewTab].unchangedCount}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                      <span className="text-[10px] uppercase font-bold text-rose-700 block">Blocked</span>
                      <span className="text-lg font-bold font-mono">!{previewDiffs[activePreviewTab].errorCount}</span>
                    </div>
                  </div>

                  {/* List of items */}
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    {previewDiffs[activePreviewTab].items.map((item, idx) => (
                      <div key={idx} className="p-3.5 bg-white hover:bg-slate-50 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-900">{item.title}</span>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                              {item.id}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">{item.details}</p>
                        </div>

                        <div>
                          {item.action === 'CREATE' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              + INSERT
                            </span>
                          )}
                          {item.action === 'UPDATE' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              ~ UPDATE
                            </span>
                          )}
                          {item.action === 'UNCHANGED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              = IDENTICAL
                            </span>
                          )}
                          {item.action === 'BLOCKED' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              ! BLOCKED
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  ← Back to Validation
                </button>

                <button
                  onClick={handleExecuteCommit}
                  disabled={isProcessing}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007460] text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Execute Sync & Upsert to Firebase</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SYNC RESULT REPORT */}
          {currentStep === 4 && latestReport && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Sync Execution Completed Successfully</h3>
                    <span className="text-xs text-slate-500 font-mono">
                      Batch ID: {latestReport.id} • {new Date(latestReport.timestamp).toLocaleString()} • Duration: {latestReport.durationMs}ms
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCurrentStep(1);
                    loadMasterSampleData();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
                >
                  Start New Sync
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Records</span>
                  <span className="text-xl font-bold font-mono text-slate-900">{latestReport.totalRecords}</span>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Created / Added</span>
                  <span className="text-xl font-bold font-mono text-emerald-800">+{latestReport.createdTotal}</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Updated</span>
                  <span className="text-xl font-bold font-mono text-blue-800">~{latestReport.updatedTotal}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Worksheets Processed</span>
                  <span className="text-xl font-bold font-mono text-slate-900">{latestReport.tabsProcessed.length}</span>
                </div>
              </div>

              {/* Execution Audit Log */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Execution Pipeline Audit Log</h4>
                <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs space-y-1 max-h-56 overflow-y-auto">
                  {latestReport.logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 2: SELECTIVE TAB SYNC TOOL */}
      {/* ========================================== */}
      {managerView === 'SELECTIVE_SYNC' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Selective Tab Synchronizer</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Target and update specific worksheets (e.g. only update seasonal Hotel Rates or newly contracted Transfer Routes) without re-importing the entire spreadsheet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MASTER_SHEETS_TAB_DEFINITIONS.filter(t => t.tabName !== 'INSTRUCTIONS').map(tab => (
              <div key={tab.tabName} className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{tab.displayName}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                    Tier {tab.hierarchyLevel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{tab.description}</p>
                <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono">PK: {tab.primaryKey}</span>
                  <button
                    onClick={() => {
                      setSelectedTabs([tab.tabName as MasterSheetTabName]);
                      setManagerView('IMPORTER');
                      setCurrentStep(1);
                    }}
                    className="flex items-center space-x-1 text-xs font-bold text-[#008972] hover:underline cursor-pointer"
                  >
                    <span>Sync This Tab</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 3: TEMPLATES & SCHEMA DOWNLOADER */}
      {/* ========================================== */}
      {managerView === 'TEMPLATES' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Official Google Sheets Template & Schema Downloader</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download ready-to-use CSV templates with verified column headers and sample data for all 15 master worksheets.
                </p>
              </div>

              <button
                onClick={handleDownloadAllTabs}
                className="flex items-center space-x-2 bg-[#008972] hover:bg-[#007460] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Download Complete Master Bundle (All 15 Tabs)</span>
              </button>
            </div>
          </div>

          {/* Tab Definitions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MASTER_SHEETS_TAB_DEFINITIONS.map(tab => (
              <div key={tab.tabName} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#008972]" />
                    <h4 className="font-bold text-xs text-slate-900">{tab.displayName}</h4>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                    {tab.columns.length} Columns
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">{tab.description}</p>

                {/* Column badges */}
                <div className="flex flex-wrap gap-1">
                  {tab.columns.slice(0, 6).map(c => (
                    <span key={c.key} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                      {c.name} {c.required && '*'}
                    </span>
                  ))}
                  {tab.columns.length > 6 && (
                    <span className="text-[10px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded-md">
                      +{tab.columns.length - 6} more
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleCopySample(tab.tabName)}
                    className="flex items-center space-x-1 text-xs text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
                  >
                    {copiedTab === tab.tabName ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy CSV</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDownloadCsv(tab.tabName)}
                    className="flex items-center space-x-1 text-xs text-[#008972] hover:text-[#007460] font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 4: SYNC HISTORY & AUDIT LOGS */}
      {/* ========================================== */}
      {managerView === 'HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Synchronization & Audit Log History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete historical record of all Google Sheets import operations, batch IDs, user emails, and record diff summaries.
            </p>
          </div>

          {syncHistory.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No previous sync batches recorded</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Execute your first sync to generate audit trails.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {syncHistory.map((report) => (
                <div key={report.id} className="p-4 hover:bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        report.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                      <span className="font-bold text-xs text-slate-900">{report.id}</span>
                      <span className="text-[11px] text-slate-500">by {report.userEmail}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(report.timestamp).toLocaleString()} ({report.durationMs}ms)
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-xs font-mono">
                    <span className="text-slate-600">Total: {report.totalRecords}</span>
                    <span className="text-emerald-700 font-bold">+{report.createdTotal} Added</span>
                    <span className="text-blue-700 font-bold">~{report.updatedTotal} Updated</span>
                    <span className="text-slate-500">{report.tabsProcessed?.length || 0} Tabs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
