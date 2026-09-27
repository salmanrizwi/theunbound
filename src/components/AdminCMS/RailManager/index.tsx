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
import { SheetsSyncService } from '../../../services/sheetsSyncService';
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
import { AdminWorkspaceLayout } from '../../common/AdminWorkspaceLayout';
import { ModuleMasterSyncBar } from '../common/ModuleMasterSyncBar';

type RailTab = 'OVERVIEW' | 'STATIONS' | 'ROUTES' | 'RATES' | 'SEASONS' | 'MARKUP' | 'SHEETS_SYNC';

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

  // Google Sheets import/export & dynamic sync state
  const [csvText, setCsvText] = useState('');
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [syncMessage, setSyncMessage] = useState('');
  const [isMarkupSavedFeedback, setIsMarkupSavedFeedback] = useState(false);

  // Japan Rail Sheet URL state (persistent and reactive)
  const [japanRailSheetUrl, setJapanRailSheetUrl] = useState(() => {
    const config = db.getMasterGoogleSheetConfig();
    return (config as any).japanRailSheetUrl || 'https://docs.google.com/spreadsheets/d/1C8I2TOnc_7_u07_G_Pz705yGg4Y6U5BPyY4t-rG9Hzo/edit#gid=0';
  });

  useEffect(() => {
    const config = db.getMasterGoogleSheetConfig();
    if ((config as any).japanRailSheetUrl) {
      setJapanRailSheetUrl((config as any).japanRailSheetUrl);
    }
  }, [dbVersion, db]);

  const [isSyncingRail, setIsSyncingRail] = useState(false);
  const [syncReportCard, setSyncReportCard] = useState<{
    status: 'SUCCESS' | 'WARNING' | 'CRITICAL_ERROR';
    stationsCount: { created: number; updated: number };
    routesCount: { created: number; updated: number };
    ratesCount: { created: number; updated: number };
    seasonsCount: { created: number; updated: number };
    errors: string[];
    warnings: string[];
    logs: { type: 'success' | 'warning' | 'error' | 'info'; text: string }[];
  } | null>(null);

  // Helper converters
  const extractSpreadsheetId = (url: string): string => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url.trim();
  };

  const convertUrlToCsvExport = (url: string): string => {
    const sheetId = extractSpreadsheetId(url);
    if (!sheetId) return url;
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  };

  // Normalization Helpers
  const normalizeStationRow = (row: Record<string, any>): RailStation => {
    const stationId = (row.station_id || row.stationId || '').trim();
    const stationCode = (row.station_code || row.stationCode || '').trim().toUpperCase();
    const stationName = (row.station_name || row.stationName || '').trim();
    const displayName = (row.station_name_local || row.displayName || '').trim() || `${stationName} (${stationCode})`;
    return {
      stationId,
      stationCode,
      stationName,
      displayName,
      searchAliases: [stationName, stationCode].filter(Boolean),
      country: 'Japan',
      regionId: 'reg-east-asia',
      destinationId: 'dest-japan',
      city: (row.city || '').trim() || 'Japan',
      railOperator: (row.rail_operator || row.railOperator || 'JR Central').trim(),
      latitude: Number(row.latitude) || 35.0,
      longitude: Number(row.longitude) || 135.0,
      timezone: 'Asia/Tokyo',
      active: String(row.status || row.active || 'ACTIVE').toUpperCase().includes('ACT') || row.active === true || row.active === 'true',
      shinkansenLine: (row.shinkansen_line || row.shinkansenLine || 'Tokaido Shinkansen').trim()
    };
  };

  const validateStation = (st: RailStation): string[] => {
    const errors: string[] = [];
    if (!st.stationId) errors.push("Station ID is required.");
    if (!st.stationCode || st.stationCode.length < 2) errors.push("Station Code must be at least 2 characters.");
    if (!st.stationName) errors.push("Station Name is required.");
    if (st.latitude < 30.0 || st.latitude > 45.0) {
      errors.push(`Latitude ${st.latitude} is outside Japan bounds (30.0 to 45.0).`);
    }
    if (st.longitude < 128.0 || st.longitude > 146.0) {
      errors.push(`Longitude ${st.longitude} is outside Japan bounds (128.0 to 146.0).`);
    }
    return errors;
  };

  const normalizeRouteRow = (row: Record<string, any>): RailRoute => {
    const routeId = (row.route_id || row.routeId || '').trim();
    const originStationId = (row.origin_station_id || row.originStationId || '').trim();
    const destinationStationId = (row.destination_station_id || row.destinationStationId || '').trim();
    return {
      routeId,
      originStationId,
      destinationStationId,
      originStationName: (row.origin_station_name || row.originStationName || '').trim() || originStationId.replace('JP-ST-', ''),
      destinationStationName: (row.destination_station_name || row.destinationStationName || '').trim() || destinationStationId.replace('JP-ST-', ''),
      country: 'Japan',
      destinationId: 'dest-japan',
      railOperator: (row.rail_operator || row.railOperator || 'JR Central / JR West').trim(),
      availableProductIds: ['RAIL-JP-ORD-RESERVED', 'RAIL-JP-GREEN-RESERVED'],
      availableServiceGroups: ['NOZOMI_MIZUHO', 'HIKARI_KODAMA_SAKURA_TSUBAME'],
      distanceKm: Number(row.distance_km || row.distanceKm) || 0,
      durationMinutes: Number(row.duration_minutes || row.durationMinutes) || 120,
      active: String(row.status || row.active || 'ACTIVE').toUpperCase().includes('ACT') || row.active === true || row.active === 'true'
    };
  };

  const validateRoute = (rt: RailRoute, validStationIds: Set<string>): string[] => {
    const errors: string[] = [];
    if (!rt.routeId) errors.push("Route ID is required.");
    if (!rt.originStationId) errors.push("Origin Station ID is required.");
    if (!rt.destinationStationId) errors.push("Destination Station ID is required.");
    if (rt.distanceKm && rt.distanceKm <= 0) errors.push(`Distance ${rt.distanceKm} km must be a positive number.`);
    if (!validStationIds.has(rt.originStationId)) {
      errors.push(`Origin station '${rt.originStationId}' does not exist in stations master.`);
    }
    if (!validStationIds.has(rt.destinationStationId)) {
      errors.push(`Destination station '${rt.destinationStationId}' does not exist in stations master.`);
    }
    return errors;
  };

  const normalizeRateRow = (row: Record<string, any>, effectiveDate: string): RailRate => {
    const rateId = (row.rate_id || row.rateId || '').trim();
    const routeId = (row.route_id || row.routeId || '').trim();
    const originStationId = (row.origin_station_id || row.originStationId || '').trim();
    const destinationStationId = (row.destination_station_id || row.destinationStationId || '').trim();
    const productId = (row.product_id || row.productId || '').trim() || 'RAIL-JP-ORD-RESERVED';
    const carType = (row.car_type || row.carType || 'Ordinary').trim() as any;
    const seatType = (row.seat_type || row.seatType || 'Reserved').trim() as any;
    const serviceGroup = (row.service_group || row.serviceGroup || 'NOZOMI_MIZUHO').trim() as any;
    const passengerType = (row.passenger_type || row.passengerType || 'ADULT').trim() as any;
    
    const baseFareJPY = Number(row.base_fare_jpy || row.baseFareJPY) || 0;
    const superExpressSurchargeJPY = Number(row.super_express_surcharge_jpy || row.superExpressSurchargeJPY) || 0;
    const greenCarSurchargeJPY = Number(row.green_car_surcharge_jpy || row.greenCarSurchargeJPY) || 0;
    const regularTotalFareJPY = Number(row.regular_total_fare_jpy || row.regularTotalFareJPY) || (baseFareJPY + superExpressSurchargeJPY + greenCarSurchargeJPY);

    return {
      rateId,
      routeId,
      originStationId,
      destinationStationId,
      productId: productId as any,
      carType,
      seatType,
      serviceGroup,
      passengerType,
      currency: 'JPY',
      baseFareJPY,
      superExpressSurchargeJPY,
      greenCarSurchargeJPY,
      regularTotalFareJPY,
      supplierId: 'sup-jp-smartex',
      supplierName: (row.supplier_name || row.supplierName || 'smartEX / JR Central & JR West').trim(),
      effectiveDate,
      active: true
    };
  };

  const validateRate = (rate: RailRate, validStationIds: Set<string>, validRouteIds: Set<string>): string[] => {
    const errors: string[] = [];
    if (!rate.rateId) errors.push("Rate ID is required.");
    if (!rate.productId || (rate.productId !== 'RAIL-JP-ORD-RESERVED' && rate.productId !== 'RAIL-JP-GREEN-RESERVED')) {
      errors.push(`Product ID '${rate.productId}' must be either RAIL-JP-ORD-RESERVED or RAIL-JP-GREEN-RESERVED.`);
    }
    if (rate.passengerType !== 'ADULT' && rate.passengerType !== 'CHILD' && rate.passengerType !== 'ADT' && rate.passengerType !== 'CNB') {
      errors.push(`Passenger Type '${rate.passengerType}' must be ADULT or CHILD.`);
    }
    if (rate.regularTotalFareJPY <= 0) {
      errors.push(`Regular Total Fare JPY (${rate.regularTotalFareJPY}) must be positive.`);
    }
    if (rate.regularTotalFareJPY > 100000) {
      errors.push(`Regular Total Fare JPY (${rate.regularTotalFareJPY}) exceeds safety upper limit of 100,000 JPY.`);
    }
    if (!validStationIds.has(rate.originStationId)) {
      errors.push(`Origin station '${rate.originStationId}' does not exist.`);
    }
    if (!validStationIds.has(rate.destinationStationId)) {
      errors.push(`Destination station '${rate.destinationStationId}' does not exist.`);
    }
    if (!validRouteIds.has(rate.routeId)) {
      errors.push(`Route ID '${rate.routeId}' does not exist.`);
    }
    return errors;
  };

  const normalizeSeasonRow = (row: Record<string, any>): RailSeasonCalendarPeriod => {
    const id = (row.season_id || row.id || '').trim();
    const seasonType = (row.season_type || row.seasonType || 'HIGH').trim() as any;
    const startDate = (row.start_date || row.startDate || '').trim();
    return {
      id,
      seasonType,
      title: (row.title || row.season_name || 'Season Calendar Period').trim(),
      startDate,
      endDate: (row.end_date || row.endDate || '').trim(),
      adultAdjustmentJPY: Number(row.adult_adjustment_jpy || row.adultAdjustmentJPY) || 0,
      childAdjustmentJPY: Number(row.child_adjustment_jpy || row.childAdjustmentJPY) || 0,
      pricingMultiplier: Number(row.pricing_multiplier || row.pricingMultiplier) || 1.0,
      priority: Number(row.priority) || 50,
      active: String(row.status || row.active || 'ACTIVE').toUpperCase().includes('ACT') || row.active === true || row.active === 'true',
      notes: (row.notes || '').trim(),
      applicableYear: startDate ? parseInt(startDate.substring(0, 4)) : undefined
    };
  };

  const validateSeason = (season: RailSeasonCalendarPeriod): string[] => {
    const errors: string[] = [];
    if (!season.id) errors.push("Season ID is required.");
    if (!season.startDate) errors.push("Start Date is required.");
    if (!season.endDate) errors.push("End Date is required.");
    if (season.startDate && season.endDate && season.endDate < season.startDate) {
      errors.push(`End Date '${season.endDate}' cannot be earlier than Start Date '${season.startDate}'.`);
    }
    return errors;
  };

  const handleSaveSheetUrl = () => {
    try {
      db.saveMasterGoogleSheetConfig({
        ...db.getMasterGoogleSheetConfig(),
        japanRailSheetUrl
      } as any, user);
      setSuccessToast('Google Sheet URL saved persistently in Firebase!');
    } catch (err: any) {
      alert(`Save error: ${err?.message || err}`);
    }
  };

  const handleSyncFromGoogleSheets = async () => {
    if (!japanRailSheetUrl.trim()) {
      alert('Please enter a valid Google Sheets URL.');
      return;
    }

    setIsSyncingRail(true);
    setSyncReportCard(null);

    const logs: { type: 'success' | 'warning' | 'error' | 'info'; text: string }[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    let stationsCreated = 0;
    let stationsUpdated = 0;
    let routesCreated = 0;
    let routesUpdated = 0;
    let ratesCreated = 0;
    let ratesUpdated = 0;
    let seasonsCreated = 0;
    let seasonsUpdated = 0;

    const addLog = (text: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
      logs.push({ type, text: `[${new Date().toLocaleTimeString()}] ${text}` });
      if (type === 'error') errors.push(text);
      if (type === 'warning') warnings.push(text);
    };

    addLog(`Initiating Japan Rail Google Sheets Sync pipeline...`, 'info');
    addLog(`Target URL: ${japanRailSheetUrl}`, 'info');

    // Extract Spreadsheet ID
    const spreadsheetId = extractSpreadsheetId(japanRailSheetUrl);

    if (!spreadsheetId) {
      addLog(`Failed to extract a valid Google Spreadsheet ID from the URL. Please verify the URL structure.`, 'error');
      setIsSyncingRail(false);
      setSyncReportCard({
        status: 'CRITICAL_ERROR',
        stationsCount: { created: 0, updated: 0 },
        routesCount: { created: 0, updated: 0 },
        ratesCount: { created: 0, updated: 0 },
        seasonsCount: { created: 0, updated: 0 },
        errors,
        warnings,
        logs
      });
      return;
    }

    addLog(`Extracted Spreadsheet ID: ${spreadsheetId}`, 'info');

    try {
      const syncService = SheetsSyncService.getInstance();
      addLog(`Checking for distinct Japan Rail database tabs...`, 'info');
      
      let railStationsData: string[][] | null = null;
      let railRoutesData: string[][] | null = null;
      let railRatesData: string[][] | null = null;
      let railSeasonsData: string[][] | null = null;

      try {
        addLog(`Attempting to fetch RAIL_STATIONS tab...`, 'info');
        railStationsData = await syncService.fetchRemoteWorksheet(spreadsheetId, 'RAIL_STATIONS');
        if (!railStationsData) {
          addLog(`RAIL_STATIONS tab not found. Trying fallback 'Japan Rail Stations'...`, 'info');
          railStationsData = await syncService.fetchRemoteWorksheet(spreadsheetId, '18. Japan Rail Stations (RAIL_STATIONS)');
        }
      } catch (e) {
        addLog(`Fetch error for RAIL_STATIONS: ${e instanceof Error ? e.message : String(e)}`, 'warning');
      }

      try {
        addLog(`Attempting to fetch RAIL_ROUTES tab...`, 'info');
        railRoutesData = await syncService.fetchRemoteWorksheet(spreadsheetId, 'RAIL_ROUTES');
        if (!railRoutesData) {
          addLog(`RAIL_ROUTES tab not found. Trying fallback 'Japan Rail Routes'...`, 'info');
          railRoutesData = await syncService.fetchRemoteWorksheet(spreadsheetId, '19. Japan Rail Routes (RAIL_ROUTES)');
        }
      } catch (e) {
        addLog(`Fetch error for RAIL_ROUTES: ${e instanceof Error ? e.message : String(e)}`, 'warning');
      }

      try {
        addLog(`Attempting to fetch RAIL_RATES tab...`, 'info');
        railRatesData = await syncService.fetchRemoteWorksheet(spreadsheetId, 'RAIL_RATES');
        if (!railRatesData) {
          addLog(`RAIL_RATES tab not found. Trying fallback RAIL_FARES...`, 'info');
          railRatesData = await syncService.fetchRemoteWorksheet(spreadsheetId, 'RAIL_FARES');
          if (!railRatesData) {
            addLog(`RAIL_FARES tab not found. Trying '21. Japan Rail Fares & Pricing (RAIL_FARES)'...`, 'info');
            railRatesData = await syncService.fetchRemoteWorksheet(spreadsheetId, '21. Japan Rail Fares & Pricing (RAIL_FARES)');
          }
        }
      } catch (e) {
        addLog(`Fetch error for RAIL_RATES: ${e instanceof Error ? e.message : String(e)}`, 'warning');
      }

      try {
        addLog(`Attempting to fetch RAIL_SEASONS tab...`, 'info');
        railSeasonsData = await syncService.fetchRemoteWorksheet(spreadsheetId, 'RAIL_SEASONS');
        if (!railSeasonsData) {
          addLog(`RAIL_SEASONS tab not found. Trying fallback RAIL_CLASS_RULES...`, 'info');
          railSeasonsData = await syncService.fetchRemoteWorksheet(spreadsheetId, 'RAIL_CLASS_RULES');
          if (!railSeasonsData) {
            addLog(`RAIL_CLASS_RULES tab not found. Trying '22. Japan Rail Season Calendar & Rules (RAIL_CLASS_RULES)'...`, 'info');
            railSeasonsData = await syncService.fetchRemoteWorksheet(spreadsheetId, '22. Japan Rail Season Calendar & Rules (RAIL_CLASS_RULES)');
          }
        }
      } catch (e) {
        addLog(`Fetch error for RAIL_SEASONS: ${e instanceof Error ? e.message : String(e)}`, 'warning');
      }

      const hasMultipleTabs = railStationsData || railRoutesData || railRatesData || railSeasonsData;

      if (hasMultipleTabs) {
        addLog(`Multi-sheet layout detected. Running Multi-Sheet Sync Algorithm...`, 'success');
        
        // 1. Process STATIONS
        const validStationIds = new Set<string>();
        if (railStationsData && railStationsData.length > 1) {
          addLog(`Processing ${railStationsData.length - 1} station rows...`, 'info');
          const objects = syncService.rowsToObjects(railStationsData);
          for (const obj of objects) {
            try {
              const station = normalizeStationRow(obj);
              const valErrors = validateStation(station);
              if (valErrors.length > 0) {
                addLog(`Station validation skipped row ${obj._rowIndex || '?'}: ${valErrors.join('; ')}`, 'warning');
                continue;
              }
              const isNew = !db.getRailStations().some(s => s.stationId === station.stationId);
              db.saveRailStation(station, user);
              validStationIds.add(station.stationId);
              if (isNew) stationsCreated++; else stationsUpdated++;
            } catch (err: any) {
              addLog(`Failed to sync station row: ${err?.message || err}`, 'warning');
            }
          }
          addLog(`Stations sync complete. Created: ${stationsCreated}, Updated: ${stationsUpdated}`, 'success');
        } else {
          addLog(`No valid Station tab data found or empty. Using existing stations from database.`, 'info');
          db.getRailStations().forEach(s => validStationIds.add(s.stationId));
        }

        // 2. Process ROUTES
        const validRouteIds = new Set<string>();
        if (railRoutesData && railRoutesData.length > 1) {
          addLog(`Processing ${railRoutesData.length - 1} route rows...`, 'info');
          const objects = syncService.rowsToObjects(railRoutesData);
          for (const obj of objects) {
            try {
              const route = normalizeRouteRow(obj);
              const valErrors = validateRoute(route, validStationIds);
              if (valErrors.length > 0) {
                addLog(`Route validation skipped row ${obj._rowIndex || '?'}: ${valErrors.join('; ')}`, 'warning');
                continue;
              }
              const isNew = !db.getRailRoutes().some(r => r.routeId === route.routeId);
              db.saveRailRoute(route, user);
              validRouteIds.add(route.routeId);
              if (isNew) routesCreated++; else routesUpdated++;
            } catch (err: any) {
              addLog(`Failed to sync route row: ${err?.message || err}`, 'warning');
            }
          }
          addLog(`Routes sync complete. Created: ${routesCreated}, Updated: ${routesUpdated}`, 'success');
        } else {
          addLog(`No valid Route tab data found or empty. Using existing routes from database.`, 'info');
          db.getRailRoutes().forEach(r => validRouteIds.add(r.routeId));
        }

        // 3. Process RATES
        const effectiveDate = new Date().toISOString().split('T')[0];
        if (railRatesData && railRatesData.length > 1) {
          addLog(`Processing ${railRatesData.length - 1} rate rows...`, 'info');
          const objects = syncService.rowsToObjects(railRatesData);
          for (const obj of objects) {
            try {
              const rate = normalizeRateRow(obj, effectiveDate);
              const valErrors = validateRate(rate, validStationIds, validRouteIds);
              if (valErrors.length > 0) {
                addLog(`Rate validation skipped row ${obj._rowIndex || '?'}: ${valErrors.join('; ')}`, 'warning');
                continue;
              }
              const isNew = !db.getRailRates().some(r => r.rateId === rate.rateId);
              db.saveRailRate(rate, user);
              if (isNew) ratesCreated++; else ratesUpdated++;
            } catch (err: any) {
              addLog(`Failed to sync rate row: ${err?.message || err}`, 'warning');
            }
          }
          addLog(`Rates sync complete. Created: ${ratesCreated}, Updated: ${ratesUpdated}`, 'success');
        } else {
          addLog(`No valid Rates/Fares tab data found.`, 'warning');
        }

        // 4. Process SEASONS
        if (railSeasonsData && railSeasonsData.length > 1) {
          addLog(`Processing ${railSeasonsData.length - 1} season rows...`, 'info');
          const objects = syncService.rowsToObjects(railSeasonsData);
          for (const obj of objects) {
            try {
              const season = normalizeSeasonRow(obj);
              const valErrors = validateSeason(season);
              if (valErrors.length > 0) {
                addLog(`Season validation skipped row ${obj._rowIndex || '?'}: ${valErrors.join('; ')}`, 'warning');
                continue;
              }
              const isNew = !db.getRailSeasons().some(s => s.id === season.id);
              db.saveRailSeason(season, user);
              if (isNew) seasonsCreated++; else seasonsUpdated++;
            } catch (err: any) {
              addLog(`Failed to sync season row: ${err?.message || err}`, 'warning');
            }
          }
          addLog(`Seasons sync complete. Created: ${seasonsCreated}, Updated: ${seasonsUpdated}`, 'success');
        } else {
          addLog(`No valid Season tab data found or empty.`, 'info');
        }

      } else {
        // Fallback: single consolidated rate sheet
        addLog(`No distinct tabs detected. Executing Single-Sheet Consolidated Fallback Sync...`, 'info');
        addLog(`Fetching direct CSV export endpoint of single sheet...`, 'info');
        
        const exportUrl = convertUrlToCsvExport(japanRailSheetUrl);
        const res = await fetch(exportUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch CSV export. Status: ${res.status}`);
        }
        
        const csvContent = await res.text();
        const rows = syncService.parseCsvToRows(csvContent);
        
        if (rows.length < 2) {
          throw new Error('Retrieved CSV does not contain a header and record rows.');
        }

        addLog(`Fetched ${rows.length - 1} records from consolidated sheet. Parsing & reconstructing hierarchy...`, 'info');
        const objects = syncService.rowsToObjects(rows);
        
        const validStationIds = new Set<string>(db.getRailStations().map(s => s.stationId));
        const validRouteIds = new Set<string>(db.getRailRoutes().map(r => r.routeId));
        const effectiveDate = new Date().toISOString().split('T')[0];

        for (const obj of objects) {
          try {
            // 1. Reconstruct Station (Origin)
            const originId = (obj.origin_station_id || obj.originStationId || '').trim();
            if (originId && !validStationIds.has(originId)) {
              const derivedCode = originId.replace('JP-ST-', '').substring(0, 4).toUpperCase();
              const derivedName = originId.replace('JP-ST-', '').split('-').map((s: string) => s.charAt(0).toUpperCase() + s.substring(1).toLowerCase()).join(' ');
              const newStation: RailStation = {
                stationId: originId,
                stationCode: derivedCode || 'STN',
                stationName: derivedName || 'Derived Station',
                displayName: `${derivedName} (${derivedCode})`,
                searchAliases: [derivedName, derivedCode].filter(Boolean),
                city: derivedName,
                country: 'Japan',
                regionId: 'reg-east-asia',
                destinationId: 'dest-japan',
                railOperator: 'JR Central',
                latitude: 35.0,
                longitude: 135.0,
                timezone: 'Asia/Tokyo',
                active: true,
                shinkansenLine: 'Tokaido Shinkansen'
              };
              db.saveRailStation(newStation, user);
              validStationIds.add(originId);
              stationsCreated++;
              addLog(`Dynamically reconstructed Station: ${originId}`, 'success');
            }

            // Reconstruct Station (Destination)
            const destId = (obj.destination_station_id || obj.destinationStationId || '').trim();
            if (destId && !validStationIds.has(destId)) {
              const derivedCode = destId.replace('JP-ST-', '').substring(0, 4).toUpperCase();
              const derivedName = destId.replace('JP-ST-', '').split('-').map((s: string) => s.charAt(0).toUpperCase() + s.substring(1).toLowerCase()).join(' ');
              const newStation: RailStation = {
                stationId: destId,
                stationCode: derivedCode || 'STN',
                stationName: derivedName || 'Derived Station',
                displayName: `${derivedName} (${derivedCode})`,
                searchAliases: [derivedName, derivedCode].filter(Boolean),
                city: derivedName,
                country: 'Japan',
                regionId: 'reg-east-asia',
                destinationId: 'dest-japan',
                railOperator: 'JR Central',
                latitude: 35.0,
                longitude: 135.0,
                timezone: 'Asia/Tokyo',
                active: true,
                shinkansenLine: 'Tokaido Shinkansen'
              };
              db.saveRailStation(newStation, user);
              validStationIds.add(destId);
              stationsCreated++;
              addLog(`Dynamically reconstructed Station: ${destId}`, 'success');
            }

            // 2. Reconstruct Route
            const routeId = (obj.route_id || obj.routeId || '').trim();
            if (routeId && !validRouteIds.has(routeId)) {
              const newRoute: RailRoute = {
                routeId,
                originStationId: originId,
                destinationStationId: destId,
                originStationName: originId.replace('JP-ST-', ''),
                destinationStationName: destId.replace('JP-ST-', ''),
                country: 'Japan',
                destinationId: 'dest-japan',
                railOperator: 'JR Central / JR West',
                availableProductIds: ['RAIL-JP-ORD-RESERVED', 'RAIL-JP-GREEN-RESERVED'],
                availableServiceGroups: ['NOZOMI_MIZUHO', 'HIKARI_KODAMA_SAKURA_TSUBAME'],
                distanceKm: Number(obj.distance_km || obj.distanceKm) || 100,
                durationMinutes: Number(obj.duration_minutes || obj.durationMinutes) || 60,
                active: true
              };
              db.saveRailRoute(newRoute, user);
              validRouteIds.add(routeId);
              routesCreated++;
              addLog(`Dynamically reconstructed Route: ${routeId}`, 'success');
            }

            // 3. Process Rail Rate
            const rate = normalizeRateRow(obj, effectiveDate);
            const valErrors = validateRate(rate, validStationIds, validRouteIds);
            if (valErrors.length > 0) {
              addLog(`Consolidated rate validation skipped row ${obj._rowIndex || '?'}: ${valErrors.join('; ')}`, 'warning');
              continue;
            }
            const isNew = !db.getRailRates().some(r => r.rateId === rate.rateId);
            db.saveRailRate(rate, user);
            if (isNew) ratesCreated++; else ratesUpdated++;
          } catch (err: any) {
            addLog(`Failed to process row in single sheet parser: ${err?.message || err}`, 'warning');
          }
        }
      }

      // Save URL config persistently in Firebase
      db.saveMasterGoogleSheetConfig({
        ...db.getMasterGoogleSheetConfig(),
        japanRailSheetUrl
      } as any, user);

      const status = errors.length > 0 ? 'CRITICAL_ERROR' : (warnings.length > 0 ? 'WARNING' : 'SUCCESS');
      
      addLog(`Japan Rail inventory synchronization finalized successfully!`, 'success');
      
      // Save global audit log
      db.logAudit(
        user || null,
        'GOOGLE_SHEETS_SYNC',
        'JapanRailInventory',
        spreadsheetId,
        `Synced Japan Rail inventory from Sheet URL. Stations (+${stationsCreated}/~${stationsUpdated}), Routes (+${routesCreated}/~${routesUpdated}), Rates (+${ratesCreated}/~${ratesUpdated}), Seasons (+${seasonsCreated}/~${seasonsUpdated})`
      );

      setSyncReportCard({
        status,
        stationsCount: { created: stationsCreated, updated: stationsUpdated },
        routesCount: { created: routesCreated, updated: routesUpdated },
        ratesCount: { created: ratesCreated, updated: ratesUpdated },
        seasonsCount: { created: seasonsCreated, updated: seasonsUpdated },
        errors,
        warnings,
        logs
      });

      setSuccessToast(`Synchronized ${stationsCreated + routesCreated + ratesCreated + seasonsCreated} items to active database!`);

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      addLog(`CRITICAL ERROR during sync: ${errMsg}`, 'error');
      
      setSyncReportCard({
        status: 'CRITICAL_ERROR',
        stationsCount: { created: 0, updated: 0 },
        routesCount: { created: 0, updated: 0 },
        ratesCount: { created: 0, updated: 0 },
        seasonsCount: { created: 0, updated: 0 },
        errors,
        warnings,
        logs
      });
    } finally {
      setIsSyncingRail(false);
    }
  };

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

      {/* Google Sheets Master Sync Bar */}
      <ModuleMasterSyncBar 
        moduleType="JAPAN_RAIL" 
        onSyncCompleted={() => {
          setStations(db.getRailStations());
          setRoutes(db.getRailRoutes());
          setRates(db.getRailRates());
          setSeasons(db.getRailSeasons());
        }}
      />

      {/* Navigation Sub-Tabs Bar & Workspace */}
      <AdminWorkspaceLayout
        sidebar={
          <div className="space-y-6">
            
            {/* Live Journey & Season Surcharge Evaluator */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3.5 shadow-xs text-xs text-slate-700">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Journey Context</h4>
              
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Origin Station</label>
                  <select
                    value={rateOriginFilter}
                    onChange={(e) => setRateOriginFilter(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-[#00C6A6] cursor-pointer"
                  >
                    {stations.map(st => (
                      <option key={st.stationId} value={st.stationId}>{st.displayName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Destination Station</label>
                  <select
                    value={rateDestFilter}
                    onChange={(e) => setRateDestFilter(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-[#00C6A6] cursor-pointer"
                  >
                    {stations.map(st => (
                      <option key={st.stationId} value={st.stationId}>{st.displayName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Test Travel Date</label>
                  <input
                    type="date"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-[#00C6A6]"
                  />
                </div>

                <div className="pt-2.5 border-t border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Season Assessment</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      evaluatedTestSeason ? 'bg-[#00C6A6]/10 text-[#008F77]' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {evaluatedTestSeason ? `${evaluatedTestSeason.seasonType} SEASON` : 'REGULAR SEASON'}
                    </span>
                  </div>
                  {evaluatedTestSeason && (
                    <div className="text-[10px] text-slate-500 leading-snug">
                      <p className="font-semibold text-slate-700">{evaluatedTestSeason.title}</p>
                      <p className="mt-0.5 font-mono">Adult: +¥{evaluatedTestSeason.adultAdjustmentJPY.toLocaleString()}</p>
                      <p className="font-mono">Multiplier: {evaluatedTestSeason.pricingMultiplier}x</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vertical Sub-Tabs List */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {[
                { id: 'OVERVIEW', label: 'Master Products', icon: Train },
                { id: 'STATIONS', label: `Stations (${stations.length})`, icon: MapPin },
                { id: 'ROUTES', label: `Routes (${routes.length})`, icon: RouteIcon },
                { id: 'RATES', label: `Rate Explorer (${rates.length})`, icon: DollarSign },
                { id: 'SEASONS', label: `Seasons (${seasons.length})`, icon: Calendar },
                { id: 'MARKUP', label: 'Markup & Rules', icon: Percent },
                { id: 'SHEETS_SYNC', label: 'Google Sheets Sync', icon: FileSpreadsheet }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id as RailTab)}
                    className={`w-full text-left p-3.5 transition-all text-xs font-bold flex items-center space-x-2.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#00C6A6]/10 text-slate-950 font-black border-l-4 border-[#00C6A6]'
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

          </div>
        }
        content={
          <div className="space-y-6">
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
              <span>Japan Rail Google Sheets Sync Engine</span>
            </h3>
            <p className="text-xs text-slate-500">
              Synchronize Japan Rail Stations, Routes, Rates, and Surcharge Seasons directly from an authoritative Google Sheets URL.
            </p>
          </div>

          <div className="space-y-4">
            {/* Google Sheets URL input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Authoritative Google Sheets URL:
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={japanRailSheetUrl}
                    onChange={(e) => setJapanRailSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0"
                    className="w-full text-xs p-2.5 pl-9 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00C6A6]"
                  />
                  <FileSpreadsheet className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSaveSheetUrl}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Save URL</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSyncingRail}
                    onClick={handleSyncFromGoogleSheets}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    {isSyncingRail ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#00C6A6]" />
                        <span>Synchronizing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 text-[#00C6A6]" />
                        <span>Sync From Google Sheets</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Default Fallback: <span className="font-mono text-slate-600">https://docs.google.com/spreadsheets/d/1C8I2TOnc_7_u07_G_Pz705yGg4Y6U5BPyY4t-rG9Hzo/edit#gid=0</span>
              </p>
            </div>

            {/* Sync Report Card */}
            {syncReportCard && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${
                      syncReportCard.status === 'SUCCESS' ? 'bg-emerald-500 animate-pulse' :
                      syncReportCard.status === 'WARNING' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500 animate-pulse'
                    }`} />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                        Operational Sync Status
                      </h4>
                      <span className={`text-[11px] font-bold ${
                        syncReportCard.status === 'SUCCESS' ? 'text-emerald-700' :
                        syncReportCard.status === 'WARNING' ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {syncReportCard.status === 'SUCCESS' && 'SUCCESS (0 Errors)'}
                        {syncReportCard.status === 'WARNING' && `COMPLETED WITH ${syncReportCard.warnings.length} WARNINGS`}
                        {syncReportCard.status === 'CRITICAL_ERROR' && 'CRITICAL ERROR (Sync Halted)'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Batch: sync-{Date.now().toString().substring(6)}
                  </div>
                </div>

                {/* Counts Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Stations</span>
                    <span className="text-sm font-black text-slate-900">
                      +{syncReportCard.stationsCount.created} / ~{syncReportCard.stationsCount.updated}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Created / Updated</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Routes</span>
                    <span className="text-sm font-black text-slate-900">
                      +{syncReportCard.routesCount.created} / ~{syncReportCard.routesCount.updated}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Created / Updated</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Rates</span>
                    <span className="text-sm font-black text-slate-900">
                      +{syncReportCard.ratesCount.created} / ~{syncReportCard.ratesCount.updated}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Created / Updated</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Seasons</span>
                    <span className="text-sm font-black text-slate-900">
                      +{syncReportCard.seasonsCount.created} / ~{syncReportCard.seasonsCount.updated}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Created / Updated</span>
                  </div>
                </div>

                {/* Black Scrollable Console Logs */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Chronological Audit Trail / Logs:</span>
                  <div className="bg-slate-950 text-slate-300 font-mono text-[11px] p-4 rounded-xl border border-slate-800 h-64 overflow-y-auto space-y-1 leading-normal shadow-inner animate-in fade-in duration-300">
                    {syncReportCard.logs.map((log, index) => {
                      const colorClass = 
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'warning' ? 'text-amber-400' :
                        log.type === 'error' ? 'text-rose-400 font-bold' : 'text-slate-400';
                      return (
                        <div key={index} className={`${colorClass} whitespace-pre-wrap`}>
                          {log.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
          </div>
        }
      />

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
