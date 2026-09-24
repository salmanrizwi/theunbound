import React, { useState, useMemo, useEffect } from 'react';
import { 
  RailStation, 
  RailRoute, 
  RailRate, 
  RailMarkupRule, 
  RailSeasonCalendarPeriod,
  RailSeasonType,
  RailServiceGroup,
  RailCarType
} from '../../../types/rail';
import { Product, CurrencyCode } from '../../../types';
import { 
  RAIL_SEASON_ADJUSTMENTS, 
  determineRailSeason, 
  resolveRailSeasonForDate,
  detectSeasonOverlaps,
  SeasonOverlapConflict
} from '../../../data/initialRailSeasons';
import { railPricingEngine } from '../../../services/railPricingEngine';
import { formatCurrency } from '../../../services/currencyEngine';
import { AppDatabase } from '../../../services/db';
import { useAuth } from '../../../context/AuthContext';
import { 
  Train, 
  MapPin, 
  Route as RouteIcon, 
  DollarSign, 
  Calendar, 
  Percent, 
  FileSpreadsheet, 
  Search, 
  Plus, 
  Edit3, 
  Check, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Info,
  X,
  Compass,
  ShieldCheck,
  Trash2,
  Copy,
  AlertCircle,
  Eye,
  Sliders,
  CalendarDays
} from 'lucide-react';

import { JapanRailJourneyConfigurator } from '../../JapanRail/JapanRailJourneyConfigurator';

type RailTab = 'OVERVIEW' | 'JOURNEY_CONFIGURATOR' | 'STATIONS' | 'ROUTES' | 'RATES' | 'SEASONS' | 'MARKUP' | 'SHEETS_SYNC';

interface RailManagerProps {
  initialTab?: string;
  onSubTabChange?: (tab: string) => void;
}

interface DeleteTarget {
  type: 'STATION' | 'ROUTE' | 'RATE' | 'SEASON' | 'PRODUCT';
  id: string;
  title: string;
  subtitle?: string;
  itemTypeLabel: string;
}

export const RailManager: React.FC<RailManagerProps> = ({ initialTab, onSubTabChange }) => {
  const { user } = useAuth();
  const db = useMemo(() => AppDatabase.getInstance(), []);

  const [activeTab, setActiveTab] = useState<RailTab>(
    (initialTab?.toUpperCase() as RailTab) || 'OVERVIEW'
  );

  // Sync tab with external prop
  useEffect(() => {
    if (initialTab) {
      const normalized = initialTab.toUpperCase() as RailTab;
      setActiveTab(normalized);
    }
  }, [initialTab]);

  const handleTabChange = (tab: RailTab) => {
    setActiveTab(tab);
    onSubTabChange?.(tab);
  };

  // Journey Configurator Modal state
  const [isJourneyConfiguratorOpen, setIsJourneyConfiguratorOpen] = useState(false);
  const [selectedProductForConfig, setSelectedProductForConfig] = useState<Product | undefined>(undefined);

  // Live state connected to authoritative database
  const [dbVersion, setDbVersion] = useState(0);
  const [stations, setStations] = useState<RailStation[]>(() => db.getRailStations());
  const [routes, setRoutes] = useState<RailRoute[]>(() => db.getRailRoutes());
  const [rates, setRates] = useState<RailRate[]>(() => db.getRailRates());
  const [seasons, setSeasons] = useState<RailSeasonCalendarPeriod[]>(() => db.getRailSeasons());
  const [markupRule, setMarkupRule] = useState<RailMarkupRule>(() => db.getRailMarkupRule());

  // Subscribe to live database updates
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setStations(db.getRailStations());
      setRoutes(db.getRailRoutes());
      setRates(db.getRailRates());
      setSeasons(db.getRailSeasons());
      setMarkupRule(db.getRailMarkupRule());
      setDbVersion(v => v + 1);
    });
    return () => unsub();
  }, [db]);

  // Search & Filter state
  const [stationSearch, setStationSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const [rateOriginFilter, setRateOriginFilter] = useState('JP-ST-TOKYO');
  const [rateDestFilter, setRateDestFilter] = useState('JP-ST-KYOTO');

  // Season year filter
  const [seasonYearFilter, setSeasonYearFilter] = useState<string>('ALL');

  // Interactive Season test date (Data-driven: defaults to current date)
  const [testDate, setTestDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Production Delete Workflow state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Station Form Modal state
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [stationModalMode, setStationModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [stationFormData, setStationFormData] = useState<Partial<RailStation>>({
    stationCode: '',
    stationName: '',
    displayName: '',
    city: '',
    country: 'Japan',
    regionId: 'reg-east-asia',
    destinationId: 'dest-japan',
    railOperator: 'JR Central',
    timezone: 'Asia/Tokyo',
    active: true,
    latitude: 35.0,
    longitude: 135.0,
    searchAliases: []
  });

  // Season Form Modal state
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [seasonModalMode, setSeasonModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [seasonFormData, setSeasonFormData] = useState<Partial<RailSeasonCalendarPeriod>>({
    id: '',
    title: '',
    seasonType: 'HIGH',
    startDate: '',
    endDate: '',
    adultAdjustmentJPY: 200,
    childAdjustmentJPY: 100,
    pricingMultiplier: 1.0,
    priority: 70,
    active: true,
    notes: '',
    daysOfWeek: []
  });
  const [seasonFormErrors, setSeasonFormErrors] = useState<string[]>([]);

  // Google Sheets import/export state
  const [csvText, setCsvText] = useState('');
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [syncMessage, setSyncMessage] = useState('');
  const [isMarkupSavedFeedback, setIsMarkupSavedFeedback] = useState(false);

  // Dismiss toast automatically
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  // Master commercial rail products
  const masterProducts = useMemo(() => {
    const allProds = db.getProducts();
    return allProds.filter(p => p.id === 'RAIL-JP-ORD-RESERVED' || p.id === 'RAIL-JP-GREEN-RESERVED');
  }, [db, dbVersion]);

  // Filtered Stations
  const filteredStations = useMemo(() => {
    if (!stationSearch.trim()) return stations;
    const q = stationSearch.toLowerCase().trim();
    return stations.filter(s => 
      s.stationName.toLowerCase().includes(q) ||
      s.stationCode.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.displayName.toLowerCase().includes(q)
    );
  }, [stations, stationSearch]);

  // Filtered Routes
  const filteredRoutes = useMemo(() => {
    if (!routeSearch.trim()) return routes;
    const q = routeSearch.toLowerCase().trim();
    return routes.filter(r => 
      r.originStationName.toLowerCase().includes(q) ||
      r.destinationStationName.toLowerCase().includes(q) ||
      r.routeId.toLowerCase().includes(q)
    );
  }, [routes, routeSearch]);

  // Rates for selected origin/destination pair
  const selectedRates = useMemo(() => {
    return rates.filter(r => 
      (r.originStationId === rateOriginFilter && r.destinationStationId === rateDestFilter) ||
      (r.originStationId === rateDestFilter && r.destinationStationId === rateOriginFilter)
    );
  }, [rates, rateOriginFilter, rateDestFilter]);

  // Detect season overlap conflicts
  const seasonOverlaps = useMemo(() => {
    return detectSeasonOverlaps(seasons);
  }, [seasons]);

  // Dynamic available years list from stored season calendar
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    seasons.forEach(s => {
      if (s.applicableYear) set.add(String(s.applicableYear));
      if (s.startDate) set.add(s.startDate.substring(0, 4));
      if (s.endDate) set.add(s.endDate.substring(0, 4));
    });
    return Array.from(set).sort();
  }, [seasons]);

  // Filtered seasons by year
  const filteredSeasons = useMemo(() => {
    let list = seasons;
    if (seasonYearFilter !== 'ALL') {
      const yr = seasonYearFilter;
      list = list.filter(s => 
        String(s.applicableYear) === yr ||
        s.startDate.startsWith(yr) ||
        s.endDate.startsWith(yr)
      );
    }
    // Sort by priority descending, then by start date
    return [...list].sort((a, b) => {
      const pa = a.priority ?? 50;
      const pb = b.priority ?? 50;
      if (pb !== pa) return pb - pa;
      return a.startDate.localeCompare(b.startDate);
    });
  }, [seasons, seasonYearFilter]);

  // Evaluated Season for Interactive Test Date
  const evaluatedTestSeason = useMemo(() => {
    return resolveRailSeasonForDate(testDate, seasons);
  }, [testDate, seasons]);

  // Permissions check
  const isMasterAdmin = user?.role === 'ADMIN';
  const isTeamMember = user?.role === 'TEAM_MEMBER';
  const canModifyInventory = isMasterAdmin || isTeamMember;

  // =========================================================================
  // PRODUCTION DELETE WORKFLOW
  // =========================================================================
  const handleOpenDeleteModal = (target: DeleteTarget) => {
    if (!canModifyInventory) {
      alert('Permission Denied: Only administrators have clearance to delete Japan Rail inventory.');
      return;
    }
    setDeleteError(null);
    setDeleteTarget(target);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (deleteTarget.type === 'STATION') {
        const ok = await db.deleteRailStationAsync(deleteTarget.id, user);
        if (!ok) throw new Error('Station record could not be removed.');
        setSuccessToast(`Station "${deleteTarget.title}" deleted from database.`);
      } else if (deleteTarget.type === 'ROUTE') {
        const ok = await db.deleteRailRouteAsync(deleteTarget.id, user);
        if (!ok) throw new Error('Route record could not be removed.');
        setSuccessToast(`Route "${deleteTarget.title}" deleted from database.`);
      } else if (deleteTarget.type === 'RATE') {
        const ok = await db.deleteRailRateAsync(deleteTarget.id, user);
        if (!ok) throw new Error('Rate record could not be removed.');
        setSuccessToast(`Rate "${deleteTarget.id}" deleted from database.`);
      } else if (deleteTarget.type === 'SEASON') {
        const ok = await db.deleteRailSeasonAsync(deleteTarget.id, user);
        if (!ok) throw new Error('Season period could not be removed.');
        setSuccessToast(`Season "${deleteTarget.title}" deleted from database.`);
      }

      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete record from database.');
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  // STATION MANAGEMENT
  // =========================================================================
  const handleOpenCreateStation = () => {
    setStationModalMode('CREATE');
    setStationFormData({
      stationCode: '',
      stationName: '',
      displayName: '',
      city: '',
      country: 'Japan',
      regionId: 'reg-east-asia',
      destinationId: 'dest-japan',
      railOperator: 'JR Central',
      timezone: 'Asia/Tokyo',
      active: true,
      latitude: 35.0,
      longitude: 135.0,
      searchAliases: []
    });
    setIsStationModalOpen(true);
  };

  const handleOpenEditStation = (s: RailStation) => {
    setStationModalMode('EDIT');
    setStationFormData({ ...s });
    setIsStationModalOpen(true);
  };

  const handleSaveStationForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationFormData.stationCode || !stationFormData.stationName) return;

    try {
      const stationId = stationModalMode === 'CREATE'
        ? `JP-ST-${stationFormData.stationName.toUpperCase().replace(/\s+/g, '-')}`
        : (stationFormData.stationId || `JP-ST-${stationFormData.stationCode}`);

      const station: RailStation = {
        stationId,
        stationCode: stationFormData.stationCode.toUpperCase(),
        stationName: stationFormData.stationName,
        displayName: stationFormData.displayName || `${stationFormData.stationName} (${stationFormData.stationCode})`,
        searchAliases: stationFormData.searchAliases?.length ? stationFormData.searchAliases : [stationFormData.stationName, stationFormData.stationCode],
        country: 'Japan',
        regionId: 'reg-east-asia',
        destinationId: 'dest-japan',
        city: stationFormData.city || 'Japan',
        railOperator: stationFormData.railOperator || 'JR Central',
        latitude: Number(stationFormData.latitude) || 35.0,
        longitude: Number(stationFormData.longitude) || 135.0,
        timezone: 'Asia/Tokyo',
        active: stationFormData.active !== false,
        shinkansenLine: stationFormData.shinkansenLine || 'Tokaido / Sanyo Shinkansen'
      };

      db.saveRailStation(station, user);
      setIsStationModalOpen(false);
      setSuccessToast(`Station ${station.stationName} (${station.stationCode}) saved.`);
    } catch (err: any) {
      alert(`Save error: ${err?.message || err}`);
    }
  };

  const handleToggleStationActive = (station: RailStation) => {
    try {
      const updated = { ...station, active: !station.active };
      db.saveRailStation(updated, user);
      setSuccessToast(`Station ${station.stationName} is now ${updated.active ? 'Active' : 'Disabled'}.`);
    } catch (err: any) {
      alert(`Update error: ${err?.message || err}`);
    }
  };

  // =========================================================================
  // SEASON CALENDAR MANAGEMENT
  // =========================================================================
  const handleOpenCreateSeason = () => {
    setSeasonModalMode('CREATE');
    setSeasonFormErrors([]);
    setSeasonFormData({
      id: `cal-season-${Date.now()}`,
      title: '',
      seasonType: 'HIGH',
      startDate: '',
      endDate: '',
      adultAdjustmentJPY: 200,
      childAdjustmentJPY: 100,
      pricingMultiplier: 1.0,
      priority: 70,
      active: true,
      notes: '',
      daysOfWeek: []
    });
    setIsSeasonModalOpen(true);
  };

  const handleOpenEditSeason = (s: RailSeasonCalendarPeriod) => {
    setSeasonModalMode('EDIT');
    setSeasonFormErrors([]);
    setSeasonFormData({ ...s });
    setIsSeasonModalOpen(true);
  };

  const handleDuplicateSeason = (source: RailSeasonCalendarPeriod) => {
    try {
      const newId = `cal-season-${Date.now()}`;
      const duplicateRecord: RailSeasonCalendarPeriod = {
        ...source,
        id: newId,
        title: `${source.title} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.saveRailSeason(duplicateRecord, user);
      setSuccessToast(`Duplicated season: "${duplicateRecord.title}" created.`);
    } catch (err: any) {
      alert(`Duplication error: ${err?.message || err}`);
    }
  };

  const handleToggleSeasonActive = (s: RailSeasonCalendarPeriod) => {
    try {
      const updated = { ...s, active: !s.active };
      db.saveRailSeason(updated, user);
      setSuccessToast(`Season "${s.title}" is now ${updated.active ? 'Active' : 'Disabled'}.`);
    } catch (err: any) {
      alert(`Update error: ${err?.message || err}`);
    }
  };

  const handleSaveSeasonForm = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!seasonFormData.title?.trim()) {
      errors.push('Season title is required.');
    }
    if (!seasonFormData.startDate) {
      errors.push('Start date is required.');
    }
    if (!seasonFormData.endDate) {
      errors.push('End date is required.');
    }
    if (seasonFormData.startDate && seasonFormData.endDate) {
      if (seasonFormData.endDate < seasonFormData.startDate) {
        errors.push('End date cannot be earlier than start date.');
      }
    }

    if (errors.length > 0) {
      setSeasonFormErrors(errors);
      return;
    }

    try {
      const seasonId = seasonFormData.id || `cal-season-${Date.now()}`;
      const seasonType = (seasonFormData.seasonType || 'HIGH') as RailSeasonType;
      const defaultAdj = RAIL_SEASON_ADJUSTMENTS[seasonType] || RAIL_SEASON_ADJUSTMENTS.REGULAR;

      const record: RailSeasonCalendarPeriod = {
        id: seasonId,
        title: seasonFormData.title!.trim(),
        seasonType,
        startDate: seasonFormData.startDate!,
        endDate: seasonFormData.endDate!,
        adultAdjustmentJPY: Number(seasonFormData.adultAdjustmentJPY ?? defaultAdj.adultAdjustmentJPY),
        childAdjustmentJPY: Number(seasonFormData.childAdjustmentJPY ?? defaultAdj.childAdjustmentJPY),
        pricingMultiplier: Number(seasonFormData.pricingMultiplier ?? 1.0),
        priority: Number(seasonFormData.priority ?? 50),
        active: seasonFormData.active !== false,
        notes: seasonFormData.notes?.trim() || '',
        daysOfWeek: seasonFormData.daysOfWeek && seasonFormData.daysOfWeek.length > 0 ? seasonFormData.daysOfWeek : undefined,
        applicableYear: seasonFormData.startDate ? parseInt(seasonFormData.startDate.substring(0, 4)) : undefined
      };

      db.saveRailSeason(record, user);
      setIsSeasonModalOpen(false);
      setSuccessToast(`Season "${record.title}" saved successfully.`);
    } catch (err: any) {
      setSeasonFormErrors([err?.message || 'Failed to save season.']);
    }
  };

  // =========================================================================
  // DYNAMIC MARKUP
  // =========================================================================
  const handleSaveMarkupRules = () => {
    try {
      db.saveRailMarkupRule(markupRule, user);
      setIsMarkupSavedFeedback(true);
      setSuccessToast('Dynamic rail markup rules saved and active.');
      setTimeout(() => setIsMarkupSavedFeedback(false), 3000);
    } catch (err: any) {
      alert(`Failed to save markup: ${err?.message || err}`);
    }
  };

  // =========================================================================
  // CSV EXPORT & IMPORT
  // =========================================================================
  const handleExportRatesCsv = () => {
    const headers = [
      'Rate ID',
      'Route ID',
      'Origin Station ID',
      'Destination Station ID',
      'Product ID',
      'Car Type',
      'Seat Type',
      'Service Group',
      'Passenger Type',
      'Base Fare (JPY)',
      'Super Express (JPY)',
      'Green Surcharge (JPY)',
      'Regular Total (JPY)',
      'Supplier'
    ];

    const rows = rates.map(r => [
      r.rateId,
      r.routeId,
      r.originStationId,
      r.destinationStationId,
      r.productId,
      r.carType,
      r.seatType,
      r.serviceGroup,
      r.passengerType,
      r.baseFareJPY,
      r.superExpressSurchargeJPY,
      r.greenCarSurchargeJPY,
      r.regularTotalFareJPY,
      r.supplierName
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `theunbound_japan_rail_rates.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportRatesCsv = () => {
    try {
      if (!csvText.trim()) {
        setSyncStatus('ERROR');
        setSyncMessage('Please paste valid CSV rate data.');
        return;
      }

      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) {
        setSyncStatus('ERROR');
        setSyncMessage('CSV does not contain header and records.');
        return;
      }

      let importedCount = 0;
      const effectiveDate = new Date().toISOString().split('T')[0];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length >= 13) {
          const rate: RailRate = {
            rateId: cols[0],
            routeId: cols[1],
            originStationId: cols[2],
            destinationStationId: cols[3],
            productId: cols[4] as any,
            carType: cols[5] as any,
            seatType: cols[6] as any,
            serviceGroup: cols[7] as any,
            passengerType: cols[8] as any,
            currency: 'JPY',
            baseFareJPY: Number(cols[9]) || 0,
            superExpressSurchargeJPY: Number(cols[10]) || 0,
            greenCarSurchargeJPY: Number(cols[11]) || 0,
            regularTotalFareJPY: Number(cols[12]) || 0,
            supplierId: 'sup-jp-smartex',
            supplierName: cols[13] || 'smartEX / JR Central & JR West',
            effectiveDate,
            active: true
          };
          db.saveRailRate(rate, user);
          importedCount++;
        }
      }

      if (importedCount > 0) {
        setSyncStatus('SUCCESS');
        setSyncMessage(`Successfully parsed & synced ${importedCount} normalized rail rate records into active database!`);
        setSuccessToast(`Synced ${importedCount} rates to database.`);
      } else {
        setSyncStatus('ERROR');
        setSyncMessage('Failed to parse rows. Verify column structure matches export format.');
      }
    } catch (err: any) {
      setSyncStatus('ERROR');
      setSyncMessage(`Sync error: ${err?.message || 'Invalid CSV syntax'}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toast notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-teal-500/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-[#00C6A6] shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-[#00C6A6] text-slate-950">
              Dynamic smartEX Inventory
            </span>
            <span className="text-xs text-slate-300 font-medium">
              JR Central • JR West • JR Kyushu
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Train className="w-6 h-6 text-[#00C6A6]" />
            Japan Rail Inventory & Dynamic Pricing Engine
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Centralized dynamic inventory operations for high-speed Shinkansen bullet trains. Manages normalized stations, routes, dynamic triangular fare matrices, season calendar surcharges, and DMC markups behind exactly TWO master commercial products.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportRatesCsv}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#00C6A6]" />
            <span>Export Rates (CSV)</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex items-center space-x-1 border-b border-slate-200 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'OVERVIEW', label: 'Master Products & Engine', icon: Train },
          { id: 'JOURNEY_CONFIGURATOR', label: 'Journey Configurator Engine', icon: Sparkles },
          { id: 'STATIONS', label: `Station Master (${stations.length})`, icon: MapPin },
          { id: 'ROUTES', label: `Route Network (${routes.length})`, icon: RouteIcon },
          { id: 'RATES', label: `Rate Explorer (${rates.length})`, icon: DollarSign },
          { id: 'SEASONS', label: `Season Calendar (${seasons.length})`, icon: Calendar },
          { id: 'MARKUP', label: 'Dynamic Markup & Rules', icon: Percent },
          { id: 'SHEETS_SYNC', label: 'Google Sheets Sync', icon: FileSpreadsheet }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id as RailTab)}
              className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'border-[#00C6A6] text-slate-900 bg-teal-50/40 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & MASTER PRODUCTS */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          
          {/* Architectural Principle Notice Card */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 text-indigo-950 flex flex-col md:flex-row items-start gap-4 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-bold text-indigo-950">
                Architectural Principle: Dynamic Inventory Behind 2 Commercial Master Products
              </h3>
              <p className="text-xs text-indigo-900/80 leading-relaxed">
                TheUnbound avoids creating 4,000+ separate product records for every route and service. All routes, stations, train service groups, passenger types, and seasons exist dynamically as normalized inventory and rate records behind these two commercial master products.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] font-mono text-indigo-800">
                <span>• Country: Japan</span>
                <span>• Destination: dest-japan</span>
                <span>• Category: Rail</span>
                <span>• Supplier: smartEX / JR Central & JR West</span>
              </div>
            </div>
          </div>

          {/* Master Products Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {masterProducts.map(prod => {
              const isGreen = prod.id === 'RAIL-JP-GREEN-RESERVED';
              return (
                <div 
                  key={prod.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="relative h-44 bg-slate-800 overflow-hidden">
                    <img 
                      src={prod.heroImage || prod.images?.[0]} 
                      alt={prod.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isGreen ? 'bg-emerald-600 text-white' : 'bg-[#00C6A6] text-slate-950'
                      }`}>
                        {isGreen ? 'Green Car • First Class' : 'Ordinary Car • Reserved'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900/80 text-slate-200 border border-slate-700">
                        {prod.id}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-base font-bold text-white leading-tight">
                        {prod.name}
                      </h3>
                      <p className="text-[11px] text-slate-300 truncate">
                        {prod.shortDescription}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Product Type</span>
                        <span className="text-xs font-bold text-slate-900">Rail</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Seat Type</span>
                        <span className="text-xs font-bold text-slate-900">Reserved</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Currency</span>
                        <span className="text-xs font-bold text-slate-900">JPY (¥)</span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">B2B Markup</span>
                        <span className="text-xs font-bold text-emerald-600">{prod.b2bAgentMarkupPercent || 12}%</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Supplier:</span>
                        <span className="font-semibold text-slate-900">{prod.supplierName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Inventory Mechanism:</span>
                        <span className="font-mono text-[#00A88F] font-bold">Dynamic smartEX</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Destination Scope:</span>
                        <span className="font-semibold text-slate-900">Japan Only (dest-japan)</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Starting Reference Fare</span>
                        <span className="text-lg font-black text-slate-900 font-mono">
                          ¥{prod.adultNetPrice.toLocaleString()} JPY
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductForConfig(prod);
                            setIsJourneyConfiguratorOpen(true);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[#00E5C0] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Configure & Simulate</span>
                        </button>
                        <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
              <span className="text-xs text-slate-500 font-medium block">Station Master Entities</span>
              <span className="text-2xl font-black text-slate-900">{stations.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Tokaido • Sanyo • Kyushu</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
              <span className="text-xs text-slate-500 font-medium block">Active Route Network</span>
              <span className="text-2xl font-black text-slate-900">{routes.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Normalized Pairs</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
              <span className="text-xs text-slate-500 font-medium block">Normalized Rates</span>
              <span className="text-2xl font-black text-slate-900">{rates.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Adult & Child • Nozomi/Hikari</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
              <span className="text-xs text-slate-500 font-medium block">Configured Seasons</span>
              <span className="text-2xl font-black text-indigo-600">{seasons.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Editable Calendar Periods</span>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: JOURNEY CONFIGURATOR ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'JOURNEY_CONFIGURATOR' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#00A88F] bg-[#00C6A6]/10 px-2 py-0.5 rounded border border-[#00C6A6]/30">
                  Authoritative Cross-Portal Component
                </span>
                <h2 className="text-lg font-black text-slate-900 font-sans flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00C6A6]" />
                  Japan Rail Dynamic Journey Configurator Engine
                </h2>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Single authoritative engine used across Buyer Portal, B2B Quote Builder, Product Management, B2B Agent Portal, and Admin CMS. Supports dynamic sector creation (Tokyo ➔ Kyoto ➔ Osaka ➔ Hiroshima), real-time smartEX tariffs, calendar-based seasonal pricing, and role-based margins.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedProductForConfig(masterProducts[0]);
                  setIsJourneyConfiguratorOpen(true);
                }}
                className="px-5 py-3 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0 hover:scale-[1.02]"
              >
                <Train className="w-4 h-4" />
                <span>LAUNCH JOURNEY CONFIGURATOR</span>
              </button>
            </div>

            {/* Architecture Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                  <Compass className="w-4 h-4 text-indigo-600" />
                  <span>Dynamic Multi-Sector Builder</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Allows adding, removing, and reordering arbitrary journey sectors. Auto-chains consecutive stations (e.g. Sector 1 arrives at Kyoto ➔ Sector 2 departs from Kyoto).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Authoritative Validation Engine</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Enforces origin ≠ destination, valid station IDs, route network connectivity, chronological date sequencing, and Tokaido oversized baggage rules without silent corrections.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                  <DollarSign className="w-4 h-4 text-[#00A88F]" />
                  <span>Unified Role-Aware Pricing</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Computes smartEX regular fares, seasonal calendar adjustments from live Firestore configurations, and DMC markups while projecting clean wholesale/retail prices by user role.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STATION MASTER */}
      {/* ========================================================================= */}
      {activeTab === 'STATIONS' && (
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search station name, code, city, alias..."
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 pl-9 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <button
              type="button"
              onClick={handleOpenCreateStation}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#00C6A6]" />
              <span>Add Station</span>
            </button>
          </div>

          {/* Station Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Station ID</th>
                    <th className="px-3 py-3">Code</th>
                    <th className="px-4 py-3">Station Name</th>
                    <th className="px-4 py-3">City & Operator</th>
                    <th className="px-4 py-3">Coordinates</th>
                    <th className="px-3 py-3">Line</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStations.map(s => (
                    <tr key={s.stationId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {s.stationId}
                      </td>
                      <td className="px-3 py-3 font-mono font-extrabold text-indigo-600">
                        {s.stationCode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{s.displayName}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">
                          Aliases: {s.searchAliases?.join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{s.city}</div>
                        <div className="text-[10px] text-slate-400">{s.railOperator}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-slate-600">
                        {s.shinkansenLine}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {s.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStation(s)}
                            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edit Station"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStationActive(s)}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer ${
                              s.active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {s.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal({
                              type: 'STATION',
                              id: s.stationId,
                              title: `${s.displayName || s.stationName} (${s.stationCode})`,
                              subtitle: `City: ${s.city} • Line: ${s.shinkansenLine}`,
                              itemTypeLabel: 'Station'
                            })}
                            className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Station"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ROUTE NETWORK */}
      {/* ========================================================================= */}
      {activeTab === 'ROUTES' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search route by origin or destination..."
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 pl-9 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredRoutes.length} of {routes.length} routes
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoutes.map(r => (
              <div key={r.routeId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {r.routeId}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {r.active ? 'Active' : 'Disabled'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal({
                        type: 'ROUTE',
                        id: r.routeId,
                        title: `${r.originStationName} ➔ ${r.destinationStationName}`,
                        subtitle: `Distance: ${r.distanceKm} km`,
                        itemTypeLabel: 'Route'
                      })}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer transition-colors"
                      title="Delete Route"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="text-center">
                    <span className="text-sm font-bold text-slate-900 block">{r.originStationName}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">Origin</span>
                  </div>
                  <div className="flex-1 px-3 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-500 mb-0.5">
                      {r.distanceKm} km
                    </span>
                    <div className="w-full h-0.5 bg-slate-200 relative flex items-center justify-center">
                      <Train className="w-3.5 h-3.5 text-[#00C6A6] bg-white px-0.5" />
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-slate-900 block">{r.destinationStationName}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">Destination</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div>
                    Nozomi: ~{r.travelDurationMinutes?.nozomiMizuho || 135}m
                  </div>
                  <div>
                    Hikari: ~{r.travelDurationMinutes?.hikariKodamaSakura || 160}m
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RATE EXPLORER */}
      {/* ========================================================================= */}
      {activeTab === 'RATES' && (
        <div className="space-y-6">
          
          {/* Rate Lookup Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#00C6A6]" />
              <span>smartEX Source Rate Table Explorer</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Select Origin Station</label>
                <select
                  value={rateOriginFilter}
                  onChange={(e) => setRateOriginFilter(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6] bg-white"
                >
                  {stations.filter(s => s.active).map(s => (
                    <option key={s.stationId} value={s.stationId}>
                      {s.stationName} ({s.stationCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Select Destination Station</label>
                <select
                  value={rateDestFilter}
                  onChange={(e) => setRateDestFilter(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6] bg-white"
                >
                  {stations.filter(s => s.active).map(s => (
                    <option key={s.stationId} value={s.stationId}>
                      {s.stationName} ({s.stationCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Rates Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900">
                  Normalized Fares for {stations.find(s => s.stationId === rateOriginFilter)?.stationName} ↔ {stations.find(s => s.stationId === rateDestFilter)?.stationName}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Regular-season listed one-way smartEX source values in Japanese Yen (JPY)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-[#00A88F]">
                {selectedRates.length} rate permutations
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Rate ID</th>
                    <th className="px-3 py-3">Car Class</th>
                    <th className="px-3 py-3">Service Group</th>
                    <th className="px-3 py-3">Pax Type</th>
                    <th className="px-3 py-3 text-right">Base Fare</th>
                    <th className="px-3 py-3 text-right">Super Express</th>
                    <th className="px-3 py-3 text-right">Green Surcharge</th>
                    <th className="px-4 py-3 text-right">Regular Total (JPY)</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {selectedRates.map(r => {
                    const isGreen = r.carType === 'Green';
                    return (
                      <tr key={r.rateId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-700 text-[11px]">
                          {r.rateId}
                        </td>
                        <td className="px-3 py-3 font-sans font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            isGreen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {r.carType} Car
                          </span>
                        </td>
                        <td className="px-3 py-3 font-sans text-slate-700">
                          {r.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi / Mizuho' : 'Hikari / Kodama / Sakura'}
                        </td>
                        <td className="px-3 py-3 font-sans font-semibold text-slate-800">
                          {r.passengerType}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          ¥{r.baseFareJPY.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          ¥{r.superExpressSurchargeJPY.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          {r.greenCarSurchargeJPY > 0 ? `¥${r.greenCarSurchargeJPY.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
                          ¥{r.regularTotalFareJPY.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal({
                              type: 'RATE',
                              id: r.rateId,
                              title: `${r.rateId} (${r.carType} Car, ¥${r.regularTotalFareJPY})`,
                              subtitle: `Route: ${r.originStationId} ➔ ${r.destinationStationId}`,
                              itemTypeLabel: 'Rate'
                            })}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                            title="Delete Rate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: EDITABLE SEASON CALENDAR */}
      {/* ========================================================================= */}
      {activeTab === 'SEASONS' && (
        <div className="space-y-6">

          {/* Overlap Warning Banner */}
          {seasonOverlaps.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-950 flex items-start gap-3.5 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1 text-xs">
                <span className="font-bold block text-sm text-amber-900">
                  Season Overlap Detected ({seasonOverlaps.length} {seasonOverlaps.length === 1 ? 'Period' : 'Periods'})
                </span>
                <p className="text-amber-800 leading-relaxed">
                  The following active season periods contain overlapping dates. The dynamic pricing engine strictly evaluates priority (highest priority wins). You can either adjust dates or set explicit priorities below:
                </p>
                <div className="pt-1 space-y-1">
                  {seasonOverlaps.slice(0, 4).map((c, i) => (
                    <div key={i} className="font-mono text-[11px] bg-amber-100/60 p-1.5 rounded border border-amber-200 text-amber-900">
                      • <strong>{c.seasonA.title}</strong> (Priority: {c.seasonA.priority ?? 50}) overlaps with <strong>{c.seasonB.title}</strong> (Priority: {c.seasonB.priority ?? 50}) between {c.overlapStartDate} and {c.overlapEndDate}
                    </div>
                  ))}
                  {seasonOverlaps.length > 4 && (
                    <span className="text-[10px] text-amber-700 italic block">
                      + {seasonOverlaps.length - 4} more overlaps detected.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Configurable Season Types Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.values(RAIL_SEASON_ADJUSTMENTS).map(adj => (
              <div key={adj.seasonType} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 truncate">{adj.label}</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    adj.adultAdjustmentJPY > 0 
                      ? 'bg-rose-100 text-rose-800' 
                      : adj.adultAdjustmentJPY < 0 
                        ? 'bg-sky-100 text-sky-800' 
                        : 'bg-slate-100 text-slate-800'
                  }`}>
                    {adj.adultAdjustmentJPY > 0 ? `+¥${adj.adultAdjustmentJPY}` : adj.adultAdjustmentJPY < 0 ? `-¥${Math.abs(adj.adultAdjustmentJPY)}` : '±¥0'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                  {adj.description}
                </p>
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex justify-between font-mono">
                  <span>Adult: {adj.adultAdjustmentJPY > 0 ? `+¥${adj.adultAdjustmentJPY}` : adj.adultAdjustmentJPY < 0 ? `-¥${Math.abs(adj.adultAdjustmentJPY)}` : '¥0'}</span>
                  <span>Child: {adj.childAdjustmentJPY > 0 ? `+¥${adj.childAdjustmentJPY}` : adj.childAdjustmentJPY < 0 ? `-¥${Math.abs(adj.childAdjustmentJPY)}` : '¥0'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Dynamic Season Calculator Test */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#00C6A6]" />
                <span>Authoritative Travel Date Season Matcher</span>
              </h4>
              <p className="text-xs text-slate-500">
                Select any scheduled journey date to preview dynamic season calendar evaluation and surcharge calculation.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="text-xs p-2 rounded-lg border border-slate-300 font-medium"
              />
              <div className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold font-mono flex items-center gap-2 shrink-0">
                <span>{evaluatedTestSeason.seasonType}</span>
                <span className="text-[#00E5C0]">
                  ({evaluatedTestSeason.adultAdjustmentJPY >= 0 ? `+¥${evaluatedTestSeason.adultAdjustmentJPY}` : `-¥${Math.abs(evaluatedTestSeason.adultAdjustmentJPY)}`})
                </span>
              </div>
            </div>
          </div>

          {/* Season Calendar Header & Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Filter Applicability Period:</span>
              <select
                value={seasonYearFilter}
                onChange={(e) => setSeasonYearFilter(e.target.value)}
                className="text-xs p-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
              >
                <option value="ALL">All Configured Periods</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr} Season Periods</option>
                ))}
              </select>
              <span className="text-xs text-slate-400">
                ({filteredSeasons.length} records)
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateSeason}
              className="px-4 py-2 rounded-lg bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Season</span>
            </button>
          </div>

          {/* Editable Season Calendar Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Season Name & Notes</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-4 py-3">Validity Date Range</th>
                    <th className="px-3 py-3">Days</th>
                    <th className="px-3 py-3 text-right">Adult Adj.</th>
                    <th className="px-3 py-3 text-right">Child Adj.</th>
                    <th className="px-3 py-3 text-center">Priority</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSeasons.map(s => {
                    const adj = RAIL_SEASON_ADJUSTMENTS[s.seasonType] || RAIL_SEASON_ADJUSTMENTS.REGULAR;
                    const adultAdj = typeof s.adultAdjustmentJPY === 'number' ? s.adultAdjustmentJPY : adj.adultAdjustmentJPY;
                    const childAdj = typeof s.childAdjustmentJPY === 'number' ? s.childAdjustmentJPY : adj.childAdjustmentJPY;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{s.title}</div>
                          {s.notes && (
                            <div className="text-[11px] text-slate-400 max-w-xs truncate">{s.notes}</div>
                          )}
                          <div className="font-mono text-[10px] text-slate-400">{s.id}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            s.seasonType === 'PEAK_HIGH' || s.seasonType === 'HOLIDAY'
                              ? 'bg-rose-100 text-rose-800'
                              : s.seasonType === 'HIGH'
                                ? 'bg-amber-100 text-amber-800'
                                : s.seasonType === 'LOW'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-slate-100 text-slate-800'
                          }`}>
                            {s.seasonType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                          {s.startDate} ➔ {s.endDate}
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-[11px]">
                          {s.daysOfWeek && s.daysOfWeek.length > 0 
                            ? `${s.daysOfWeek.length} days/wk`
                            : 'Daily'
                          }
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                          {adultAdj >= 0 ? `+¥${adultAdj}` : `-¥${Math.abs(adultAdj)}`}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-600">
                          {childAdj >= 0 ? `+¥${childAdj}` : `-¥${Math.abs(childAdj)}`}
                        </td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-indigo-600">
                          {s.priority ?? 50}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {s.active !== false ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSeason(s)}
                              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Season"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateSeason(s)}
                              className="p-1 rounded text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="Duplicate Season"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSeasonActive(s)}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer ${
                                s.active !== false ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {s.active !== false ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal({
                                type: 'SEASON',
                                id: s.id,
                                title: s.title,
                                subtitle: `Validity: ${s.startDate} to ${s.endDate} • Type: ${s.seasonType}`,
                                itemTypeLabel: 'Season'
                              })}
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Season"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: DYNAMIC MARKUP */}
      {/* ========================================================================= */}
      {activeTab === 'MARKUP' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-[#00C6A6]" />
              <span>TheUnbound Dynamic Rail Commercial Markup Rules</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure wholesale B2B and direct consumer pricing margins applied dynamically on top of net smartEX supplier costs.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Wholesale B2B Travel Agent Markup (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={markupRule.b2bAgentMarkupPercent}
                  onChange={(e) => setMarkupRule({ ...markupRule, b2bAgentMarkupPercent: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-[#00C6A6]"
                />
                <span className="text-slate-500">Default wholesale DMC markup applied to verified travel partners.</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Direct Buyer / Retail Markup (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={markupRule.buyerMarkupPercent}
                  onChange={(e) => setMarkupRule({ ...markupRule, buyerMarkupPercent: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-[#00C6A6]"
                />
                <span className="text-slate-500">Retail consumer markup applied to public inquiries & quotes.</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Minimum Guaranteed Margin (JPY)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={markupRule.minMarginJPY}
                  onChange={(e) => setMarkupRule({ ...markupRule, minMarginJPY: Number(e.target.value) })}
                  className="w-32 p-2 rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-[#00C6A6]"
                />
                <span className="text-slate-500">Ensures minimum gross margin per seat reservation even on short hops.</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Last modified: {markupRule.lastUpdated}
              </span>
              <div className="flex items-center gap-2">
                {isMarkupSavedFeedback && (
                  <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved & Active!</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveMarkupRules}
                  className="px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold shadow-xs cursor-pointer"
                >
                  Save Markup Rules
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: GOOGLE SHEETS SYNC */}
      {/* ========================================================================= */}
      {activeTab === 'SHEETS_SYNC' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Google Sheets & CSV Rail Rate Sync</span>
            </h3>
            <p className="text-xs text-slate-500">
              Seamlessly sync, validate, and update Japan Rail fare matrices directly from Google Sheets or CSV exports.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Paste CSV / Google Sheets Tab Data:
            </label>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste rate rows exported from Google Sheets..."
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleImportRatesCsv}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload className="w-4 h-4 text-[#00C6A6]" />
                <span>Validate & Sync Rates</span>
              </button>
              <button
                type="button"
                onClick={handleExportRatesCsv}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Rates Template (CSV)</span>
              </button>
            </div>

            {syncStatus !== 'IDLE' && (
              <div className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
                syncStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                {syncStatus === 'SUCCESS' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{syncMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIVERSAL PRODUCTION DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Delete Japan Rail {deleteTarget.itemTypeLabel}?
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Target ID: {deleteTarget.id}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed bg-rose-50/60 p-3 rounded-xl border border-rose-200 text-rose-950">
                This will remove the selected inventory record from the active database. This action cannot be undone unless the record is restored through an approved recovery process.
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900">{deleteTarget.title}</div>
                {deleteTarget.subtitle && (
                  <div className="text-[11px] text-slate-500">{deleteTarget.subtitle}</div>
                )}
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting from Firestore...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEASON CREATE / EDIT MODAL */}
      {/* ========================================================================= */}
      {isSeasonModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#00C6A6]" />
                <span>{seasonModalMode === 'CREATE' ? 'Add New Season Period' : 'Edit Season Period'}</span>
              </h3>
              <button onClick={() => setIsSeasonModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {seasonFormErrors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                {seasonFormErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveSeasonForm} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Season Name / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Golden Week Holiday Rush"
                  value={seasonFormData.title || ''}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Season Type *</label>
                  <select
                    value={seasonFormData.seasonType}
                    onChange={(e) => {
                      const st = e.target.value as RailSeasonType;
                      const def = RAIL_SEASON_ADJUSTMENTS[st] || RAIL_SEASON_ADJUSTMENTS.REGULAR;
                      setSeasonFormData({
                        ...seasonFormData,
                        seasonType: st,
                        adultAdjustmentJPY: def.adultAdjustmentJPY,
                        childAdjustmentJPY: def.childAdjustmentJPY
                      });
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                  >
                    <option value="REGULAR">Regular Season (±¥0)</option>
                    <option value="LOW">Low / Off-Peak (-¥200)</option>
                    <option value="HIGH">High Peak (+¥200)</option>
                    <option value="PEAK_HIGH">Peak High (+¥400)</option>
                    <option value="HOLIDAY">Holiday Surge (+¥400)</option>
                    <option value="SPECIAL">Special Event (+¥300)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Evaluation Priority</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="e.g. 70"
                    value={seasonFormData.priority ?? 50}
                    onChange={(e) => setSeasonFormData({ ...seasonFormData, priority: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold focus:ring-1 focus:ring-[#00C6A6]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Higher wins on overlapping dates</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={seasonFormData.startDate || ''}
                    onChange={(e) => setSeasonFormData({ ...seasonFormData, startDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={seasonFormData.endDate || ''}
                    onChange={(e) => setSeasonFormData({ ...seasonFormData, endDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Adult Fare Adjustment (JPY)</label>
                  <input
                    type="number"
                    step="50"
                    value={seasonFormData.adultAdjustmentJPY ?? 0}
                    onChange={(e) => setSeasonFormData({ ...seasonFormData, adultAdjustmentJPY: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Child Fare Adjustment (JPY)</label>
                  <input
                    type="number"
                    step="50"
                    value={seasonFormData.childAdjustmentJPY ?? 0}
                    onChange={(e) => setSeasonFormData({ ...seasonFormData, childAdjustmentJPY: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Operational Notes & Restrictions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Golden Week national holiday travel peak..."
                  value={seasonFormData.notes || ''}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="seasonActiveCheckbox"
                  checked={seasonFormData.active !== false}
                  onChange={(e) => setSeasonFormData({ ...seasonFormData, active: e.target.checked })}
                  className="rounded text-[#00C6A6] focus:ring-[#00C6A6] h-4 w-4"
                />
                <label htmlFor="seasonActiveCheckbox" className="font-bold text-slate-800">
                  Active in dynamic pricing engine
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSeasonModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-black shadow-xs cursor-pointer"
                >
                  Save Season
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATION CREATE / EDIT MODAL */}
      {/* ========================================================================= */}
      {isStationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#00C6A6]" />
                <span>{stationModalMode === 'CREATE' ? 'Add New Station' : 'Edit Station'}</span>
              </h3>
              <button onClick={() => setIsStationModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStationForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Station Name (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nagano"
                  value={stationFormData.stationName || ''}
                  onChange={(e) => setStationFormData({ ...stationFormData, stationName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Station Code (3 letters) *</label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  placeholder="e.g. NGN"
                  value={stationFormData.stationCode || ''}
                  onChange={(e) => setStationFormData({ ...stationFormData, stationCode: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 uppercase font-bold focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Display Name (with Kanji)</label>
                <input
                  type="text"
                  placeholder="e.g. Nagano (長野)"
                  value={stationFormData.displayName || ''}
                  onChange={(e) => setStationFormData({ ...stationFormData, displayName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Nagano"
                    value={stationFormData.city || ''}
                    onChange={(e) => setStationFormData({ ...stationFormData, city: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rail Operator</label>
                  <select
                    value={stationFormData.railOperator || 'JR Central'}
                    onChange={(e) => setStationFormData({ ...stationFormData, railOperator: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-1 focus:ring-[#00C6A6]"
                  >
                    <option value="JR Central">JR Central</option>
                    <option value="JR West">JR West</option>
                    <option value="JR Kyushu">JR Kyushu</option>
                    <option value="JR East">JR East</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsStationModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold shadow-xs cursor-pointer"
                >
                  Save Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Journey Configurator Engine Modal */}
      {isJourneyConfiguratorOpen && (
        <JapanRailJourneyConfigurator
          portalOrigin="ADMIN_CMS"
          initialProduct={selectedProductForConfig}
          onClose={() => {
            setIsJourneyConfiguratorOpen(false);
            setSelectedProductForConfig(undefined);
          }}
        />
      )}

    </div>
  );
};
