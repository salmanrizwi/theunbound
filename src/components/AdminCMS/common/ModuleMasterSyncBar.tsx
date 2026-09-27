import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  Sparkles, 
  Clock, 
  Database, 
  X, 
  ChevronRight,
  Sliders,
  Check
} from 'lucide-react';
import { AppDatabase } from '../../../services/db';
import { SheetsSyncService } from '../../../services/sheetsSyncService';
import { useAuth } from '../../../context/AuthContext';
import { MultiTabSyncReport, MasterSheetTabName } from '../../../types';

export interface ModuleMasterSyncBarProps {
  moduleType: 'PRODUCTS' | 'HOTELS' | 'VISA_ANCILLARY' | 'JAPAN_RAIL';
  title?: string;
  description?: string;
  onSyncCompleted?: (report: MultiTabSyncReport) => void;
  onOpenMasterHub?: () => void;
  className?: string;
}

const MODULE_CONFIGS = {
  PRODUCTS: {
    name: 'Products & Tours Catalog',
    tabs: ['PRODUCTS', 'PRODUCT_PRICING', 'PRODUCT_CAPACITY'] as MasterSheetTabName[],
    accentColor: 'indigo',
    icon: Layers,
    description: 'Direct synchronization for Tours, Excursions, Product Rates, and Vehicle/Yacht Capacity tiers.'
  },
  HOTELS: {
    name: 'Luxury Hotels & Allotments',
    tabs: ['HOTELS', 'HOTEL_ROOMS', 'HOTEL_MEAL_PLANS', 'HOTEL_RATES'] as MasterSheetTabName[],
    accentColor: 'emerald',
    icon: Database,
    description: 'Contracted Hotel Allotments, Room Types, Meal Plans (RO, BB, HB, FB), and Nightly Net Rates.'
  },
  VISA_ANCILLARY: {
    name: 'Visa, Protection & Ancillaries',
    tabs: ['VISA', 'VISA_RATES', 'TRAVEL_PROTECTION', 'VIP_GROUND', 'CONNECTIVITY'] as MasterSheetTabName[],
    accentColor: 'amber',
    icon: ShieldCheck,
    description: 'Consular Visa Checklists, Embassy Tariffs, Travel Insurance Plans, VIP Airport Concierge, and 5G eSIMs.'
  },
  JAPAN_RAIL: {
    name: 'Japan Rail & Dynamic Pricing',
    tabs: ['RAIL_STATIONS', 'RAIL_ROUTES', 'RAIL_SERVICES', 'RAIL_FARES', 'RAIL_CLASS_RULES'] as MasterSheetTabName[],
    accentColor: 'rose',
    icon: Sparkles,
    description: 'Official Shinkansen Station Nodes, Intercity Segments, Authoritative smartEX Tariffs, and Peak Season Rules.'
  }
};

export const ModuleMasterSyncBar: React.FC<ModuleMasterSyncBarProps> = ({
  moduleType,
  title,
  description,
  onSyncCompleted,
  onOpenMasterHub,
  className = ''
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const syncService = SheetsSyncService.getInstance();
  const config = MODULE_CONFIGS[moduleType];

  const sheetConfig = db.getMasterGoogleSheetConfig();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncReport, setSyncReport] = useState<MultiTabSyncReport | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    const rawTime = sheetConfig.lastSuccessfulSync || (sheetConfig as any).lastSyncAt;
    return rawTime ? new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  });

  const spreadsheetId = moduleType === 'JAPAN_RAIL' && (sheetConfig as any).japanRailSheetUrl
    ? (sheetConfig as any).japanRailSheetUrl
    : (sheetConfig.masterSpreadsheetId || '1C8I2TOnc_7_u07_G_Pz705yGg4Y6U5BPyY4t-rG9Hzo');

  const sheetUrl = spreadsheetId.startsWith('http')
    ? spreadsheetId
    : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const handleStartSync = async () => {
    setIsSyncing(true);
    setShowSyncModal(true);
    setSyncReport(null);

    try {
      const report = await syncService.executeModuleSync(moduleType, user);
      setSyncReport(report);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      onSyncCompleted?.(report);
    } catch (err: any) {
      console.error('Module sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <div className={`bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 rounded-xl p-4 shadow-lg text-white mb-6 ${className}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left section: Identity & Status */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Google Sheets Live Sync Connected
              </span>

              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                {sheetConfig.spreadsheetName || 'TheUnbound Master Inventory'}
              </span>

              {lastSyncTime && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Synced today at {lastSyncTime}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                {title || config.name}
              </h3>
              <span className="text-xs text-slate-400 hidden sm:inline">
                • {description || config.description}
              </span>
            </div>

            {/* Canonical Worksheet Tab Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mr-1">
                Canonical Tabs:
              </span>
              {config.tabs.map(tab => (
                <span 
                  key={tab}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700"
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>

          {/* Right section: Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <a 
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              title="Open Google Sheet in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Sheet</span>
            </a>

            {onOpenMasterHub && (
              <button
                type="button"
                onClick={onOpenMasterHub}
                className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                title="Open Master Google Sheets Integration Hub"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Master Hub</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStartSync}
              disabled={isSyncing}
              className={`px-4 py-2 text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2 ${
                isSyncing
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-emerald-950/40'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'SYNCING...' : 'SYNC FROM GOOGLE SHEETS'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sync Execution & Results Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">
                    Synchronizing {config.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Master Google Sheets Engine • Safe Upsert & Dynamic Pricing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {isSyncing ? (
                <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
                    <RefreshCw className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">
                      Pulling Canonical Worksheets...
                    </h5>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Executing hierarchical schema validation, commercial markup evaluation, and atomic upsert across {config.tabs.join(', ')}.
                    </p>
                  </div>
                </div>
              ) : syncReport ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                    syncReport.status === 'SUCCESS' 
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' 
                      : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                  }`}>
                    {syncReport.status === 'SUCCESS' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h5 className="text-sm font-bold text-white">
                        {syncReport.status === 'SUCCESS' ? 'Synchronization Completed Successfully' : 'Synchronized with Notices'}
                      </h5>
                      <p className="text-xs mt-0.5 text-slate-300">
                        Processed {syncReport.totalRecords} records across {syncReport.tabsProcessed.length} tabs in {syncReport.durationMs}ms.
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        Created
                      </span>
                      <p className="text-xl font-bold text-emerald-400 mt-0.5">
                        +{syncReport.createdTotal}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        Updated
                      </span>
                      <p className="text-xl font-bold text-blue-400 mt-0.5">
                        ~{syncReport.updatedTotal}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        Unchanged
                      </span>
                      <p className="text-xl font-bold text-slate-300 mt-0.5">
                        {syncReport.unchangedTotal}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        Issues
                      </span>
                      <p className={`text-xl font-bold mt-0.5 ${syncReport.errorsTotal > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {syncReport.errorsTotal}
                      </p>
                    </div>
                  </div>

                  {/* Synchronized Tabs breakdown */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-3.5 py-2 bg-slate-800/80 border-b border-slate-800 text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Worksheet Tab</span>
                      <span>Created / Updated</span>
                    </div>
                    <div className="divide-y divide-slate-800 text-xs bg-slate-900/40">
                      {syncReport.tabsProcessed.map(tab => {
                        const diff = syncReport.tabDiffs[tab];
                        return (
                          <div key={tab} className="px-3.5 py-2 flex items-center justify-between">
                            <span className="font-mono font-medium text-slate-200">{tab}</span>
                            <span className="text-slate-400">
                              <span className="text-emerald-400 font-semibold">+{diff?.createdCount || 0}</span> / 
                              <span className="text-blue-400 font-semibold ml-1">~{diff?.updatedCount || 0}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Terminal Log Stream */}
                  <div>
                    <h6 className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Execution Audit Ledger
                    </h6>
                    <div className="bg-black/90 text-emerald-400 font-mono text-[11px] p-3 rounded-xl border border-slate-800 max-h-40 overflow-y-auto space-y-1">
                      {syncReport.logs.map((log, idx) => (
                        <div key={idx} className="leading-tight">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
              {syncReport && (
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  View Updated Records
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
