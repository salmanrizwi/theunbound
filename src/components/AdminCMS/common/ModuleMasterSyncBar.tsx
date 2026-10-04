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
      <div className={`bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs text-slate-800 mb-6 ${className}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left section: Identity & Status */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-[#008972] border border-teal-200">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6] animate-pulse" />
                Google Sheets Live Sync Connected
              </span>

              <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#00C6A6]" />
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
              <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                {title || config.name}
              </h3>
              <span className="text-xs text-slate-500 hidden sm:inline">
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
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F8FAFA] text-slate-700 border border-slate-200"
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
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Open Google Sheet in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#008972]" />
              <span className="hidden sm:inline">View Sheet</span>
            </a>

            {onOpenMasterHub && (
              <button
                type="button"
                onClick={onOpenMasterHub}
                className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Open Master Google Sheets Integration Hub"
              >
                <Sliders className="w-3.5 h-3.5 text-[#008972]" />
                <span className="hidden sm:inline">Master Hub</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStartSync}
              disabled={isSyncing}
              className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                isSyncing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 active:scale-95'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-[#008972]">
                  <FileSpreadsheet className="w-5 h-5 text-[#00C6A6]" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Synchronizing {config.name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Master Google Sheets Engine • Safe Upsert & Dynamic Pricing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {isSyncing ? (
                <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-[#00C6A6] animate-spin" />
                    <RefreshCw className="w-6 h-6 text-[#00C6A6] absolute inset-0 m-auto" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-slate-900">
                      Pulling Canonical Worksheets...
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Executing hierarchical schema validation, commercial markup evaluation, and atomic upsert across {config.tabs.join(', ')}.
                    </p>
                  </div>
                </div>
              ) : syncReport ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                    syncReport.status === 'SUCCESS' 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {syncReport.status === 'SUCCESS' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">
                        {syncReport.status === 'SUCCESS' ? 'Synchronization Completed Successfully' : 'Synchronized with Notices'}
                      </h5>
                      <p className="text-xs mt-0.5 text-slate-600">
                        Processed {syncReport.totalRecords} records across {syncReport.tabsProcessed.length} tabs in {syncReport.durationMs}ms.
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-[#F8FAFA] border border-slate-200 p-3 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                        Created
                      </span>
                      <p className="text-xl font-bold text-emerald-700 mt-0.5">
                        +{syncReport.createdTotal}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFA] border border-slate-200 p-3 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                        Updated
                      </span>
                      <p className="text-xl font-bold text-blue-700 mt-0.5">
                        ~{syncReport.updatedTotal}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFA] border border-slate-200 p-3 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                        Unchanged
                      </span>
                      <p className="text-xl font-bold text-slate-700 mt-0.5">
                        {syncReport.unchangedTotal}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFA] border border-slate-200 p-3 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                        Issues
                      </span>
                      <p className={`text-xl font-bold mt-0.5 ${syncReport.errorsTotal > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {syncReport.errorsTotal}
                      </p>
                    </div>
                  </div>

                  {/* Synchronized Tabs breakdown */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
                      <span>Worksheet Tab</span>
                      <span>Created / Updated</span>
                    </div>
                    <div className="divide-y divide-slate-100 text-xs bg-white">
                      {syncReport.tabsProcessed.map(tab => {
                        const diff = syncReport.tabDiffs[tab];
                        return (
                          <div key={tab} className="px-3.5 py-2 flex items-center justify-between">
                            <span className="font-mono font-medium text-slate-800">{tab}</span>
                            <span className="text-slate-500">
                              <span className="text-emerald-700 font-semibold">+{diff?.createdCount || 0}</span> / 
                              <span className="text-blue-700 font-semibold ml-1">~{diff?.updatedCount || 0}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Execution Audit Ledger */}
                  <div>
                    <h6 className="text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Execution Audit Ledger
                    </h6>
                    <div className="bg-[#F8FAFA] text-slate-800 font-mono text-[11px] p-3 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-1">
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
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              {syncReport && (
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-[#00C6A6] hover:bg-[#00b094] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
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
