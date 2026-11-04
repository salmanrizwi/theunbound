import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Globe2,
  MapPin,
  Building2,
  Package,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppDatabase } from '../../services/db';
import { MasterDataService, GeographicalAuditReport } from '../../services/masterDataService';
import config from '../../../firebase-applet-config.json';

export const MasterDataDiagnosticBanner: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const masterData = MasterDataService.getInstance();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString());
  const [counts, setCounts] = useState({
    destinations: 0,
    regions: 0,
    hubs: 0,
    products: 0
  });
  const [auditReport, setAuditReport] = useState<GeographicalAuditReport | null>(null);

  const refreshCounts = () => {
    setIsChecking(true);
    try {
      const dests = db.getDestinations();
      const regions = db.getRegions();
      const hubs = db.getCityHubs();
      const products = db.getProducts();
      setCounts({
        destinations: dests.length,
        regions: regions.length,
        hubs: hubs.length,
        products: products.length
      });
      setAuditReport(masterData.auditAllGeographicalRelationships());
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setTimeout(() => setIsChecking(false), 300);
    }
  };

  useEffect(() => {
    refreshCounts();
    const unsub = db.subscribe(refreshCounts);
    return () => unsub();
  }, [db]);

  const projectId = config.projectId || 'ai-studio-theunbounddmctra-384adde8-26cf-49a7-8158-336473069762';
  const databaseId = config.firestoreDatabaseId || '(default)';
  const currentRole = user?.role || 'ADMIN';
  const currentUserUid = user?.id || (user as any)?.uid || 'usr-admin-business';
  const currentUserEmail = user?.email || 'business@theunbound.in';

  const totalIssues =
    (auditReport?.duplicateDestinations.length || 0) +
    (auditReport?.orphanedRegions.length || 0) +
    (auditReport?.orphanedHubs.length || 0) +
    (auditReport?.unmappedProducts.length || 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-xl mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Status & Hierarchy */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping absolute opacity-75"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black tracking-wider uppercase text-emerald-400">
                Authoritative Geographical Hierarchy
              </span>
              {totalIssues === 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-300 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>100% VALIDATED</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{totalIssues} INTEGRITY FLAGS</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Tier 1 Destination → Tier 2 Region → Tier 3 City Hub → Tier 4 Products
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 text-[11px]">Destinations:</span>
            <span className="font-bold text-white">{counts.destinations}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <Globe2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400 text-[11px]">Regions:</span>
            <span className="font-bold text-white">{counts.regions}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400 text-[11px]">City Hubs:</span>
            <span className="font-bold text-white">{counts.hubs}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <Package className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-slate-400 text-[11px]">Products:</span>
            <span className="font-bold text-white">{counts.products}</span>
          </div>

          <button
            type="button"
            onClick={refreshCounts}
            disabled={isChecking}
            title="Refresh database state"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-[#00C6A6]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/50"
          >
            <span>Relationship Audit</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Diagnostic Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Duplicate Destinations
              </div>
              <div className="font-bold text-sm text-emerald-400">
                {auditReport?.duplicateDestinations.length || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Unique destination records verified</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Orphaned Regions
              </div>
              <div className={`font-bold text-sm ${(auditReport?.orphanedRegions.length || 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {auditReport?.orphanedRegions.length || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">All regions linked to valid Destinations</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Orphaned / Mismatched Hubs
              </div>
              <div className={`font-bold text-sm ${(auditReport?.orphanedHubs.length || 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {auditReport?.orphanedHubs.length || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">All hubs linked to Destination & Region</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Unmapped Products
              </div>
              <div className={`font-bold text-sm ${(auditReport?.unmappedProducts.length || 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {auditReport?.unmappedProducts.length || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Last checked: {lastChecked} ({currentRole}: {currentUserEmail})
              </div>
            </div>
          </div>

          {totalIssues > 0 && auditReport && (
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 space-y-2">
              <div className="font-bold text-amber-300 text-xs">
                Geographical Relationship Review Items ({totalIssues}):
              </div>
              {auditReport.orphanedRegions.map(r => (
                <div key={r.id} className="text-[11px] text-amber-200">
                  • Region <strong>{r.name}</strong> ({r.id}): {r.reason}
                </div>
              ))}
              {auditReport.orphanedHubs.map(h => (
                <div key={h.id} className="text-[11px] text-amber-200">
                  • Hub <strong>{h.name}</strong> ({h.id}): {h.reason}
                </div>
              ))}
              {auditReport.unmappedProducts.slice(0, 10).map(p => (
                <div key={p.id} className="text-[11px] text-amber-200">
                  • Product <strong>{p.name}</strong> ({p.sku || p.id}): {p.issues.join('; ')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
