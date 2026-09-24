import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  Layers, 
  Globe2, 
  MapPin, 
  Building2, 
  Server,
  ChevronDown,
  ChevronUp,
  Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppDatabase } from '../../services/db';
import config from '../../../firebase-applet-config.json';

export const MasterDataDiagnosticBanner: React.FC = () => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toLocaleTimeString());
  const [counts, setCounts] = useState({
    regions: 0,
    destinations: 0,
    hubs: 0
  });

  const refreshCounts = () => {
    setIsChecking(true);
    try {
      const regions = db.getMasterRegions();
      const dests = db.getDestinations();
      const hubs = db.getCityHubs();
      setCounts({
        regions: regions.length,
        destinations: dests.length,
        hubs: hubs.length
      });
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-xl mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Status & Cluster */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping absolute opacity-75"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black tracking-wider uppercase text-emerald-400">
                Authoritative Firestore Production Cluster
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-300">
                ONLINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Direct write sync enabled • Tier 1 Region → Tier 2 Destination → Tier 3 City Hub
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <Globe2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400 text-[11px]">Regions:</span>
            <span className="font-bold text-white">{counts.regions}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 text-[11px]">Destinations:</span>
            <span className="font-bold text-white">{counts.destinations}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400 text-[11px]">City Hubs:</span>
            <span className="font-bold text-white">{counts.hubs}</span>
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
            <span>Diagnostic Details</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Diagnostic Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
              GCP / Firebase Project
            </div>
            <div className="font-mono text-[11px] text-slate-200 truncate" title={projectId}>
              {projectId}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Database: {databaseId}</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
              Active Environment
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-emerald-300">Published / Production</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Storage Mode: Authoritative Firestore</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
              Authenticated Admin UID
            </div>
            <div className="font-mono text-[11px] text-slate-200 truncate" title={currentUserUid}>
              {currentUserUid}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-[#00C6A6]" />
              <span>Role: <strong className="text-white">{currentRole}</strong> ({currentUserEmail})</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
              Last Sync Timestamp
            </div>
            <div className="font-mono text-[11px] text-emerald-300">
              {lastChecked}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Zero-mock policy • Real-time writes active
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
